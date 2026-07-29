# -----------------------------------------------------------------------------
# Zanarkand — procedural generator, second attempt.
#
# The first pass built the city out of stacked prisms and shaded it with flat
# colours, and it looked like grey clay. This one is built the other way round:
#
#   1. the LAND first, as a real displaced heightfield, because the reference
#      frame is two thirds rock and the rock is what everything else is read
#      against;
#   2. WEAR baked into vertex colours — height, cavity, waterline, sun-facing —
#      so a flat-shaded material still has variation across a surface;
#   3. buildings authored WHOLE, then broken by a fracture pass, rather than
#      modelled as broken shapes. Damage that follows a plane through a solid
#      reads as damage; damage drawn by hand reads as a lumpy cylinder.
#
# Two states share one mesh. Anything in the RUIN layer is always present.
# Anything in the RESTORED layer (clad, glass, neon) is revealed by a world-
# space front that rises as the page scrolls, so the city rebuilds itself from
# the waterline up.
#
# Blender is Z-up; sea level is Z = 0; the arena stands at the origin. The glTF
# export flips to Y-up, so three.js sees (x, z, -y).
# -----------------------------------------------------------------------------
import bpy
import math
import random
from mathutils import Vector, Euler, Matrix

SEED = 20260728
TAU = math.pi * 2

# The world, in metres.
# The sun sits dead ahead of the opening shot, just clear of the horizon.
SUN_BEARING = 180.0
SUN_ELEVATION = 2.2

SEA_R = 2600.0        # radius of the water plane
BASIN_R = 620.0       # the drowned bowl the city stands in
ARENA_R = 112.0       # outer radius of the arena


# ----------------------------------------------------------------------- noise
# A small value-noise implementation. Blender's own texture nodes cannot be
# sampled from Python cheaply enough to displace a few hundred thousand
# vertices, and the point of doing it here is that the *mesh* carries the
# shape — the web renderer gets it for free with no shader work.
def _hash3(x, y, z):
    n = x * 374761393 + y * 668265263 + z * 1442695040888963407
    n = (n ^ (n >> 13)) * 1274126177
    return ((n ^ (n >> 16)) & 0xFFFFFF) / 0xFFFFFF


def _smooth(t):
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def value_noise(x, y, z=0.0):
    xi, yi, zi = math.floor(x), math.floor(y), math.floor(z)
    xf, yf, zf = x - xi, y - yi, z - zi
    u, v, w = _smooth(xf), _smooth(yf), _smooth(zf)
    out = 0.0
    for dz in (0, 1):
        for dy in (0, 1):
            for dx in (0, 1):
                h = _hash3(xi + dx, yi + dy, zi + dz)
                wx = u if dx else 1.0 - u
                wy = v if dy else 1.0 - v
                wz = w if dz else 1.0 - w
                out += h * wx * wy * wz
    return out * 2.0 - 1.0


def fbm(x, y, octaves=5, lacunarity=2.03, gain=0.5, z=0.0):
    amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
    for _ in range(octaves):
        total += value_noise(x * freq, y * freq, z * freq) * amp
        norm += amp
        amp *= gain
        freq *= lacunarity
    return total / norm


def ridged(x, y, octaves=5, lacunarity=2.07, gain=0.52, z=0.0):
    """Ridged multifractal — the one that makes rock look like rock.

    Ordinary fBm gives rolling hills. Folding each octave about zero and
    squaring turns the zero-crossings into creases, which is what a weathered
    cliff face is: a field of sharp ridges with smooth flanks between them.
    """
    amp, freq, total, norm = 1.0, 1.0, 0.0, 0.0
    for _ in range(octaves):
        n = 1.0 - abs(value_noise(x * freq, y * freq, z * freq))
        total += n * n * amp
        norm += amp
        amp *= gain
        freq *= lacunarity
    return total / norm


# ------------------------------------------------------------------- accumulator
class Part:
    """Geometry for one material, emitted as a single mesh.

    Carries a colour per vertex alongside the position. Everything that draws
    into a Part is expected to say how worn it is; `build` writes the result
    into a colour attribute that the web materials multiply into base colour.
    """

    def __init__(self, name, material, smooth=False):
        self.name = name
        self.material = material
        self.smooth = smooth
        self.verts = []
        self.faces = []
        self.cols = []

    # -- primitives ---------------------------------------------------------
    def push(self, verts, faces, cols=None):
        o = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend([[i + o for i in f] for f in faces])
        if cols is None:
            self.cols.extend([(1.0, 1.0, 1.0)] * len(verts))
        else:
            self.cols.extend(cols)

    def build(self, collection):
        if not self.verts:
            return None
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.validate()
        # Byte colours, not float: this is a wear multiplier, 8 bits of it is
        # more than the eye can find, and float colours quadruple the size of
        # the attribute in the exported file for nothing.
        attr = mesh.color_attributes.new(name="wear", type="BYTE_COLOR", domain="CORNER")
        clamped = [(min(1.0, max(0.0, c[0])), min(1.0, max(0.0, c[1])),
                    min(1.0, max(0.0, c[2]))) for c in self.cols]
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                c = clamped[mesh.loops[li].vertex_index]
                attr.data[li].color = (c[0], c[1], c[2], 1.0)
        mesh.materials.append(self.material)
        for poly in mesh.polygons:
            poly.use_smooth = self.smooth
        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)
        return obj


# ----------------------------------------------------------------- scene reset
def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras,
                  bpy.data.lights, bpy.data.worlds):
        for item in list(block):
            block.remove(item)


def make_material(name, color, rough=0.9, metal=0.0, emit=None, emit_strength=1.0,
                  use_wear=True):
    """A Principled material whose base colour is multiplied by the `wear`
    attribute, so the preview render shows the same variation the web build
    will show."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal

    if use_wear:
        attr = nt.nodes.new("ShaderNodeAttribute")
        attr.attribute_name = "wear"
        attr.location = (-620, 120)
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 1.0
        mix.inputs["Color1"].default_value = (*color, 1.0)
        mix.location = (-380, 120)
        nt.links.new(attr.outputs["Color"], mix.inputs["Color2"])
        nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)

    if emit is not None:
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = (*emit, 1.0)
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


# -------------------------------------------------------------------- the land
def _terrace(z, step, bite):
    """Pull a height partway toward the nearest multiple of `step`.

    Sedimentary rock erodes in benches, and a cliff without them looks
    extruded. Doing it in the height function rather than as a shader means the
    silhouette gets the benches too, which is where they actually read.
    """
    q = round(z / step) * step
    return z + (q - z) * bite


def land_height(x, y):
    """Height of the ground at (x, y), before the sea is drawn over it.

    The shape is one idea: a drowned basin ringed by a broken rim. Inside
    BASIN_R the floor is below sea level, so the city stands in water; outside
    it the rim climbs into headlands, and past that it falls away again into
    the open sea. The reference shot is taken standing on that rim.

    The rim is deliberately asymmetric — a near-vertical scarp on the basin
    side, a long scree slope on the sea side. A symmetric ridge reads as a
    mound; the scarp is what makes it read as something that broke.
    """
    d = math.hypot(x, y)
    a = math.atan2(y, x)
    ca, sa = math.cos(a), math.sin(a)

    # the rim, varying with bearing so it is a broken crater and not a wall
    rim_h = 150.0 + 130.0 * fbm(ca * 1.7, sa * 1.7, octaves=3)
    rim_r = BASIN_R * (1.0 + 0.17 * fbm(ca * 2.3 + 11.0, sa * 2.3 + 11.0, octaves=3))
    # gates: places where the rim is breached down to the water
    gate = max(0.0, ridged(ca * 3.1 + 40.0, sa * 3.1 + 40.0, octaves=2) - 0.52) * 2.4
    rim_h *= max(0.16, 1.0 - gate)

    # The view corridor. The opening shot looks along -X at a sun sitting on
    # the horizon, and it can only do that if there is no rim in the way, so
    # the far side is deliberately broken open along that bearing. This is the
    # one piece of the terrain that is composed rather than grown.
    da = abs(((a - math.pi + math.pi) % TAU) - math.pi)
    rim_h *= 1.0 - 0.97 * math.exp(-(da / 0.78) ** 2)

    t = d / rim_r
    if t < 0.80:
        # Dry. The ruin is not a drowned city — it is a dead one on a plain,
        # and the sea is only ever a line on the horizon past the broken rim.
        # An earlier version flooded the basin, which made a rather beautiful
        # picture of somewhere that is not Zanarkand.
        u = t / 0.80
        base = 40.0 - 16.0 * u ** 1.4
    elif t < 0.955:
        # the scarp — the whole climb happens in this narrow band
        u = (t - 0.80) / 0.155
        base = 24.0 + (rim_h - 24.0) * _smooth(u) ** 1.35
    elif t < 1.20:
        # the crest, undulating rather than flat
        u = (t - 0.955) / 0.245
        base = rim_h * (1.0 - 0.20 * u + 0.16 * fbm(x * 0.004, y * 0.004, octaves=3))
    else:
        u = min(1.0, (t - 1.20) / 1.30)
        base = rim_h * 0.80 * (1.0 - u) ** 2.1 - 34.0 * u

    exposure = max(0.0, min(1.0, (base + 26.0) / 90.0))

    # Rock detail. Two fields: broad ridges that carve the mass into buttresses
    # and gullies, and a fine vertical striation on anything steep, which is
    # what a sea cliff has and a noise-displaced hill does not.
    s = 0.0021
    ridge = (ridged(x * s, y * s, octaves=6) - 0.40) * 150.0
    # anisotropic: stretched around the rim so gullies run down the face
    flute = (ridged(ca * 26.0, sa * 26.0, octaves=3, z=d * 0.0016) - 0.45) * 27.0
    grain = fbm(x * s * 7.0, y * s * 7.0, octaves=4) * 15.0

    scarp = math.exp(-((t - 0.90) / 0.13) ** 2)   # 1 on the face, 0 elsewhere
    # Two more bands of detail. Without them the ground is smooth at every
    # scale between the ridge system (hundreds of metres) and the polygon, and
    # close to the lens it reads as dunes — which is exactly what the first
    # preview looked like.
    mid = fbm(x * 0.0105, y * 0.0105, octaves=4) * 20.0
    fine = (ridged(x * 0.042, y * 0.042, octaves=3) - 0.5) * 7.0
    # Inside the basin the detail is held right down. The city stands on this
    # ground, and a plain with ninety metres of relief in it either swallows
    # the ruins or leaves them perched on spikes.
    inside = 1.0 - _smooth(min(1.0, max(0.0, (t - 0.62) / 0.24)))
    relief = 1.0 - 0.82 * inside
    z = (base + (ridge + grain) * (0.18 + 0.82 * exposure) * relief
         + flute * scarp * exposure + (mid + fine) * exposure * (0.35 + 0.65 * (1.0 - inside)))

    # and it never dips to sea level, because there is no water here
    if t < 0.98:
        floor = 8.0 * min(1.0, (0.98 - t) / 0.10)
        z = max(z, floor)

    # benches, only on exposed rock
    if z > 8.0:
        z = _terrace(z, 26.0, 0.13 * exposure)
    return z


def _radii(count, radius):
    """Ring radii, concentrated on the rim.

    An even spread wastes most of its vertices on the basin floor, which is
    under water and barely seen, and on the outer slope, which is horizon. Two
    thirds of the rings land between 0.7 and 1.3 of the basin radius — the
    scarp, the crest, and the ground the camera stands on.
    """
    out = []
    for i in range(count + 1):
        t = i / count
        if t < 0.22:
            r = BASIN_R * 0.72 * (t / 0.22) ** 1.3
        elif t < 0.80:
            u = (t - 0.22) / 0.58
            r = BASIN_R * (0.72 + 0.62 * u)
        else:
            u = (t - 0.80) / 0.20
            r = BASIN_R * 1.34 + (radius - BASIN_R * 1.34) * u ** 1.9
        out.append(max(1.0, r))
    return out


def build_land(P, rnd, radius=2100.0, rings=310, segments=380):
    """The heightfield, as a radial grid whose ring spacing follows the shot."""
    rock = P["rock"]
    verts, faces, cols = [], [], []

    for r in _radii(rings, radius):
        for j in range(segments):
            a = TAU * j / segments
            x, y = math.cos(a) * r, math.sin(a) * r
            z = land_height(x, y)
            verts.append((x, y, z))
            cols.append(rock_wear(x, y, z))

    for i in range(rings):
        for j in range(segments):
            a0 = i * segments + j
            a1 = i * segments + (j + 1) % segments
            b0 = (i + 1) * segments + j
            b1 = (i + 1) * segments + (j + 1) % segments
            faces.append([a0, a1, b1, b0])

    rock.push(verts, faces, cols)


def rock_wear(x, y, z):
    """Vertex colour for the ground.

    Four things are folded together, and between them they do the job a texture
    would: the waterline is dark and wet, the flanks are lighter where the sun
    has bleached them, creases hold shadow, and there is a low-frequency
    mottle so no two square metres match.
    """
    # wet band either side of the waterline
    wet = math.exp(-((z - 2.0) / 16.0) ** 2)
    # bleaching with height
    high = max(0.0, min(1.0, (z - 30.0) / 140.0))
    # creases: sample the ridged field again, cheaply
    crease = ridged(x * 0.0042, y * 0.0042, octaves=3)
    mottle = fbm(x * 0.011, y * 0.011, octaves=3) * 0.5 + 0.5

    v = 0.52 + 0.44 * high + 0.20 * (crease - 0.5) + 0.20 * (mottle - 0.5)
    v *= 1.0 - 0.46 * wet
    v = max(0.16, min(1.35, v))
    # warmer where the sun reaches, cooler in the wet
    return (v * (1.0 + 0.10 * high), v, v * (1.0 - 0.06 * high + 0.10 * wet))


def build_sea(P):
    """The open sea, past the rim.

    An annulus, not a disc. The ruin itself is dry — there is no water in the
    basin at all — and a full disc at sea level was quietly drawing itself
    across the whole plain wherever the ground was thin. This starts outside
    the rim, so the only water anywhere is the line on the horizon.
    """
    sea = P["sea"]
    segs = 128
    inner, outer = BASIN_R * 1.55, SEA_R
    verts, faces = [], []
    for j in range(segs):
        a = TAU * j / segs
        verts.append((math.cos(a) * inner, math.sin(a) * inner, -6.0))
        verts.append((math.cos(a) * outer, math.sin(a) * outer, -6.0))
    for j in range(segs):
        k = (j + 1) % segs
        faces.append([j * 2, k * 2, k * 2 + 1, j * 2 + 1])
    sea.push(verts, faces)


# ------------------------------------------------------------------- materials
def make_materials():
    return {
        "rock": make_material("Rock", (0.204, 0.176, 0.152), rough=0.94),
        "stone": make_material("Stone", (0.208, 0.196, 0.180), rough=0.88),
        "dark": make_material("StoneDark", (0.116, 0.112, 0.106), rough=0.92),
        "metal": make_material("Metal", (0.150, 0.152, 0.158), rough=0.34, metal=0.92),
        # The restored city is not pale concrete. In the reference it is a
        # dark blue-green metal, almost black in the mass, and everything you
        # can see of it is edge light and window light against that.
        "clad": make_material("Clad", (0.052, 0.078, 0.076), rough=0.42, metal=0.42),
        "falls": make_material("Falls", (0.55, 0.82, 0.86), rough=0.10,
                               emit=(0.20, 0.44, 0.50), emit_strength=0.5),
        "glow": make_material("Glow", (0.28, 0.72, 0.78), rough=0.4,
                              emit=(0.40, 0.90, 0.96), emit_strength=4.0),
        "neon": make_material("Neon", (0.55, 0.92, 1.0), rough=0.3,
                              emit=(0.60, 0.94, 1.0), emit_strength=9.0),
        "sea": make_material("Sea", (0.030, 0.058, 0.072), rough=0.08,
                             use_wear=False),
        "pool": make_material("Pool", (0.42, 0.74, 0.96), rough=0.02,
                              emit=(0.24, 0.62, 0.96), emit_strength=1.4,
                              use_wear=False),
        "far": make_material("Far", (0.120, 0.126, 0.140), rough=1.0,
                             use_wear=False),
    }


# ------------------------------------------------------------ preview lighting
def setup_preview(sun_deg=SUN_ELEVATION, sun_bearing=SUN_BEARING):
    """A sunset rig for looking at the model in Blender.

    None of this is exported — the web build lights itself — but the whole
    point of the reference frame is a low sun behind the ruin, and judging
    silhouettes under a default lamp is judging the wrong picture.
    """
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Sky")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    # An authored sky, not a physical one.
    #
    # Blender's atmosphere model gives a correct sunset, and a correct sunset
    # is not what the reference is: that sky is a painted one — a hard orange
    # band along the horizon, heavy dark cloud over it, and the sun sitting in
    # the gap as a blown-out disc. A physically-shaded sky at 1 degree of
    # elevation just goes blue-grey. This builds the painted version, and the
    # web renderer gets the same gradient so the two agree.
    b = math.radians(sun_bearing)
    e = math.radians(sun_deg)
    sun_dir = (math.cos(b) * math.cos(e), math.sin(b) * math.cos(e), math.sin(e))

    coord = nt.nodes.new("ShaderNodeTexCoord")
    coord.location = (-1400, 0)

    # ---- the vertical gradient ---------------------------------------------
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (-1200, 200)
    nt.links.new(coord.outputs["Normal"], sep.inputs["Vector"])
    lift = nt.nodes.new("ShaderNodeMapRange")
    lift.location = (-1020, 200)
    lift.inputs["From Min"].default_value = -0.18
    lift.inputs["From Max"].default_value = 0.55
    nt.links.new(sep.outputs["Z"], lift.inputs["Value"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-840, 200)
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.62, 0.20, 0.05, 1.0)
    cr.elements[1].position = 1.0
    cr.elements[1].color = (0.035, 0.045, 0.085, 1.0)
    for pos, col in ((0.14, (1.00, 0.44, 0.10, 1.0)),
                     (0.30, (0.72, 0.26, 0.10, 1.0)),
                     (0.55, (0.20, 0.11, 0.13, 1.0))):
        el = cr.elements.new(pos)
        el.color = col
    nt.links.new(lift.outputs["Result"], ramp.inputs["Fac"])

    # ---- the sun and its glow ----------------------------------------------
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.location = (-1200, -160)
    dot.inputs[1].default_value = sun_dir
    nt.links.new(coord.outputs["Normal"], dot.inputs[0])

    glow = nt.nodes.new("ShaderNodeMath")
    glow.operation = "POWER"
    glow.location = (-1020, -160)
    glow.inputs[1].default_value = 26.0
    nt.links.new(dot.outputs["Value"], glow.inputs[0])

    disc = nt.nodes.new("ShaderNodeMath")
    disc.operation = "POWER"
    disc.location = (-1020, -340)
    disc.inputs[1].default_value = 3600.0
    nt.links.new(dot.outputs["Value"], disc.inputs[0])

    glow_col = nt.nodes.new("ShaderNodeMixRGB")
    glow_col.blend_type = "ADD"
    glow_col.location = (-620, 100)
    glow_col.inputs["Color2"].default_value = (2.4, 0.95, 0.28, 1.0)
    nt.links.new(ramp.outputs["Color"], glow_col.inputs["Color1"])
    nt.links.new(glow.outputs["Value"], glow_col.inputs["Fac"])

    disc_col = nt.nodes.new("ShaderNodeMixRGB")
    disc_col.blend_type = "ADD"
    disc_col.location = (-440, 100)
    disc_col.inputs["Color2"].default_value = (16.0, 9.0, 4.0, 1.0)
    nt.links.new(glow_col.outputs["Color"], disc_col.inputs["Color1"])
    nt.links.new(disc.outputs["Value"], disc_col.inputs["Fac"])

    # ---- cloud bands --------------------------------------------------------
    # Stretched hard along the horizon, so they read as strata rather than as
    # noise, and only allowed to darken — a sunset's clouds are silhouettes.
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.location = (-1200, 420)
    mapping.inputs["Scale"].default_value = (1.6, 1.6, 11.0)
    nt.links.new(coord.outputs["Normal"], mapping.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-1020, 420)
    noise.inputs["Scale"].default_value = 2.6
    noise.inputs["Detail"].default_value = 7.0
    noise.inputs["Roughness"].default_value = 0.62
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    cloud_ramp = nt.nodes.new("ShaderNodeValToRGB")
    cloud_ramp.location = (-840, 420)
    cloud_ramp.color_ramp.elements[0].position = 0.44
    cloud_ramp.color_ramp.elements[1].position = 0.72
    nt.links.new(noise.outputs["Fac"], cloud_ramp.inputs["Fac"])
    cloud_mask = nt.nodes.new("ShaderNodeMath")
    cloud_mask.operation = "MULTIPLY"
    cloud_mask.location = (-660, 420)
    cloud_mask.inputs[1].default_value = 0.72
    nt.links.new(cloud_ramp.outputs["Color"], cloud_mask.inputs[0])
    clouded = nt.nodes.new("ShaderNodeMixRGB")
    clouded.blend_type = "MIX"
    clouded.location = (-260, 200)
    clouded.inputs["Color2"].default_value = (0.055, 0.040, 0.048, 1.0)
    nt.links.new(disc_col.outputs["Color"], clouded.inputs["Color1"])
    nt.links.new(cloud_mask.outputs["Value"], clouded.inputs["Fac"])

    # What the camera sees and what the scene is lit by are separated here.
    # A sky bright enough to read as a sunset is also bright enough to fill
    # every shadow, and the reference has no fill at all — the rock in front is
    # nearly black. So rays that are not camera rays get a heavily darkened
    # copy, and the silhouettes survive.
    dim = nt.nodes.new("ShaderNodeMixRGB")
    dim.blend_type = "MULTIPLY"
    dim.location = (-80, 380)
    dim.inputs["Fac"].default_value = 1.0
    dim.inputs["Color2"].default_value = (0.20, 0.17, 0.20, 1.0)
    nt.links.new(clouded.outputs["Color"], dim.inputs["Color1"])

    path = nt.nodes.new("ShaderNodeLightPath")
    path.location = (-80, 700)
    pick = nt.nodes.new("ShaderNodeMixRGB")
    pick.location = (120, 200)
    nt.links.new(path.outputs["Is Camera Ray"], pick.inputs["Fac"])
    nt.links.new(dim.outputs["Color"], pick.inputs["Color1"])
    nt.links.new(clouded.outputs["Color"], pick.inputs["Color2"])

    nt.links.new(pick.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0
    nt.links.new(bg.outputs[0], out.inputs["Surface"])

    sun_data = bpy.data.lights.new("Sun", type="SUN")
    sun_data.energy = 5.5
    sun_data.angle = math.radians(2.4)
    sun_data.color = (1.0, 0.40, 0.14)
    sun = bpy.data.objects.new("Sun", sun_data)
    bpy.context.scene.collection.objects.link(sun)
    b = math.radians(sun_bearing)
    e = math.radians(sun_deg)
    d = Vector((math.cos(b) * math.cos(e), math.sin(b) * math.cos(e), math.sin(e)))
    sun.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()

    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {
        i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
    } else "BLENDER_EEVEE"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -0.4
    for attr, val in (("use_gtao", True), ("use_bloom", True)):
        try:
            setattr(scene.eevee, attr, val)
        except Exception:
            pass
    try:
        scene.eevee.use_raytracing = True
    except Exception:
        pass
    return sun


def preview_camera(pos, target, lens=42.0):
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = lens
    cam_data.clip_end = 20000.0
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = pos
    d = Vector(target) - Vector(pos)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def show_state(state="ruin"):
    """Preview one of the two states.

    Both live in the same file, so looking at the ruin means hiding the layers
    the restoration puts back — otherwise every preview shows the finished city
    and the half of the model that does the actual work is never checked.
    """
    restored = {"Clad", "Neon", "Pool", "Falls"}
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        obj.hide_render = (obj.name in restored) if state == "ruin" else False


def render_to(path, width=1280, height=720, samples=32):
    scene = bpy.context.scene
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = path
    try:
        scene.eevee.taa_render_samples = samples
    except Exception:
        pass
    bpy.ops.render.render(write_still=True)


# -------------------------------------------------------------------- the city
#
# Buildings are authored as a PROFILE — a list of (radius, height) pairs — and
# swept around an axis. One sweep produces the flare at the foot, the entasis
# of the shaft, every collar, the neck, the onion bulb and the needle, as a
# single continuous surface. The previous generator stacked a separate prism
# per feature, which is why its towers read as a pile of cans: every junction
# was a hard step with a visible seam, and none of the curves were curves.
#
# Damage is then applied to the profile, not drawn by hand. A tower is built
# whole, a break height is chosen, and everything above it moves into the
# RESTORED layer. So the ruin and the finished city are the same building,
# and the restoration front genuinely puts back what fell.


def sweep(part, cx, cy, profile, segments, phase, wear, z0=0.0, cap_top=True,
          jitter=0.0, rnd=None, arc=None):
    """Revolve a profile around the vertical axis through (cx, cy).

    `wear` is called per vertex with (radius, z, angle) and returns a colour,
    which is how a swept surface gets dirt in its creases and bleaching on its
    shoulders without a texture.

    `arc` sweeps only part of the way round, with the profile closed off at
    both ends. That is how the arena is broken: the bowl is built as a ring of
    sectors, each truncated at its own height, and the missing ones are simply
    not swept.
    """
    verts, faces, cols = [], [], []
    n = len(profile)
    closed = arc is None
    a0_, a1_ = (0.0, TAU) if closed else arc
    cols_n = segments if closed else segments + 1

    for (r, z) in profile:
        for j in range(cols_n):
            a = phase + a0_ + (a1_ - a0_) * (j / segments if not closed
                                             else j / segments)
            rr = r
            if jitter and rnd is not None:
                rr *= 1.0 + rnd.uniform(-jitter, jitter)
            verts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z0 + z))
            cols.append(wear(r, z, a))

    for i in range(n - 1):
        for j in range(segments):
            a0 = i * cols_n + j
            a1 = i * cols_n + (j + 1) % cols_n
            b0 = (i + 1) * cols_n + j
            b1 = (i + 1) * cols_n + (j + 1) % cols_n
            faces.append([a0, a1, b1, b0])

    if not closed:
        # close the two cut ends with the profile itself
        for j in (0, cols_n - 1):
            strip = [i * cols_n + j for i in range(n)]
            for i in range(n - 2):
                faces.append([strip[0], strip[i + 1], strip[i + 2]])
    if cap_top and closed and profile[-1][0] > 0.05:
        c = len(verts)
        verts.append((cx, cy, z0 + profile[-1][1]))
        cols.append(wear(0.0, profile[-1][1], 0.0))
        base = (n - 1) * cols_n
        for j in range(segments):
            faces.append([base + j, base + (j + 1) % cols_n, c])
    part.push(verts, faces, cols)


def _res(profile, step=3.0):
    """Subdivide a profile so long straight runs still get vertices.

    Wear is per-vertex, so a shaft described by two points has nowhere to put
    the gradient down its length. This inserts intermediate rings.
    """
    out = [profile[0]]
    for i in range(1, len(profile)):
        r0, z0 = profile[i - 1]
        r1, z1 = profile[i]
        span = math.hypot(r1 - r0, z1 - z0)
        for k in range(1, max(1, int(span / step))):
            t = k / max(1, int(span / step))
            out.append((r0 + (r1 - r0) * t, z0 + (z1 - z0) * t))
        out.append((r1, z1))
    return out


def profile_tower(h, w, rnd, collars=None, bulb=True, entasis=0.06):
    """The city's own idiom, as a profile.

    Read off the reference skyline: a wide skirt at the foot, a shaft that
    swells slightly before it tapers, three or four collars stepping it in, a
    pinched neck, an onion bulb, and a needle. Getting the *proportions* right
    matters more than any detail on the surface — the silhouette is what is
    recognisable at the distance these are usually seen from.
    """
    # Two collars, not five. The first draft put one every fifth of the height
    # and the result read as a stack of barrels — the shaft never got long
    # enough anywhere to be a shaft. The collars are also much shallower now:
    # a lip that catches the sun, not a flange.
    collars = collars if collars is not None else rnd.randint(1, 3)
    p = [(w * 1.62, 0.0), (w * 1.46, h * 0.010), (w * 1.04, h * 0.038),
         (w * 0.98, h * 0.052)]

    top_of_shaft = h * 0.74
    for k in range(collars):
        t0 = 0.052 + (0.74 - 0.052) * (k / collars)
        t1 = 0.052 + (0.74 - 0.052) * ((k + 1) / collars)
        taper = 1.0 - 0.52 * (k / max(1, collars))
        r_mid = w * (0.46 + 0.52 * taper)
        r_next = w * (0.46 + 0.52 * (1.0 - 0.52 * ((k + 1) / max(1, collars))))
        # a long run with a slight belly, then a shallow collar into the next
        p.append((r_mid * (1.0 + entasis), h * (t0 + (t1 - t0) * 0.40)))
        p.append((r_mid * 1.00, h * (t0 + (t1 - t0) * 0.86)))
        p.append((r_mid * 1.07, h * (t0 + (t1 - t0) * 0.90)))   # collar lip
        p.append((r_mid * 1.05, h * (t0 + (t1 - t0) * 0.945)))
        p.append((r_next * 1.01, h * (t0 + (t1 - t0) * 0.985)))

    neck_r = w * 0.32
    p.append((neck_r, top_of_shaft))
    if bulb:
        # The onion: bulges past the neck, then draws into a long needle. Kept
        # tight — a fat bulb on a slim shaft reads as a bullet, and it is the
        # needle that is doing the work in the silhouette anyway.
        for (fr, fz) in ((1.20, 0.030), (1.42, 0.068), (1.36, 0.108),
                         (1.02, 0.144), (0.62, 0.174), (0.28, 0.196)):
            p.append((neck_r * fr, top_of_shaft + h * fz))
    p.append((neck_r * 0.14, top_of_shaft + h * 0.215))
    p.append((neck_r * 0.07, h * 0.97))
    p.append((0.0, h))
    return _res(p, step=max(1.2, h * 0.012))


def profile_hall(h, w, rnd):
    """A low, broad building: a shell with a shallow dome. These fill the
    ground between towers, and without them a district is a bundle of sticks."""
    p = [(w * 1.10, 0.0), (w * 1.00, h * 0.10), (w * 0.97, h * 0.42),
         (w * 0.99, h * 0.52), (w * 0.92, h * 0.60)]
    for k in range(1, 8):
        t = k / 8.0
        p.append((w * 0.92 * math.cos(t * math.pi * 0.5) ** 0.75,
                  h * (0.60 + 0.40 * math.sin(t * math.pi * 0.5))))
    p.append((0.0, h))
    return _res(p, step=max(1.0, h * 0.05))


def make_wear(rnd, tint=(1.0, 1.0, 1.0), grime=0.55, top_bleach=0.30, h=1.0,
              streaks=True):
    """A wear function for one building.

    Three effects, all of which a real weathered surface has and a flat colour
    does not: dirt pooling low down and in the lee, bleaching on the top
    surfaces, and vertical streaks where water has run off the collars.
    """
    seed = rnd.uniform(0.0, 100.0)

    def f(r, z, a):
        t = min(1.0, max(0.0, z / max(1e-5, h)))
        v = 1.0 - grime * (1.0 - t) ** 1.6          # dirty at the base
        v += top_bleach * t ** 1.8                  # sun on the shoulders
        if streaks:
            v *= 1.0 - 0.22 * max(0.0, value_noise(math.cos(a) * 5.0 + seed,
                                                   math.sin(a) * 5.0 + seed,
                                                   z * 0.06))
        v *= 0.88 + 0.24 * (0.5 + 0.5 * value_noise(r * 0.2 + seed, z * 0.09, a))
        v = max(0.10, min(1.5, v))
        return (v * tint[0], v * tint[1], v * tint[2])

    return f


def broken_rim(part, cx, cy, r, z, rnd, wear, teeth=None, depth=None):
    """The jagged edge left where a shaft snapped.

    A clean horizontal cut is the single most common tell that a ruin was
    modelled rather than broken, so the survivors get an uneven crown of
    fragments and the gaps between them go *below* the cut line.
    """
    teeth = teeth or max(5, int(r * 1.6))
    depth = depth or r * 0.9
    for i in range(teeth):
        a0 = TAU * i / teeth
        a1 = TAU * (i + 1) / teeth
        hh = rnd.uniform(-0.35, 1.0) * depth
        if hh < 0:
            continue
        inner = r * 0.86
        pts = []
        for (rr, zz) in ((r, 0.0), (inner, 0.0), (inner, hh), (r, hh)):
            pts.append((rr, zz))
        verts, faces, cols = [], [], []
        for (rr, zz) in pts:
            for a in (a0, a1):
                verts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z + zz))
                cols.append(wear(rr, z + zz, a))
        # 0,1 outer bottom; 2,3 inner bottom; 4,5 inner top; 6,7 outer top
        faces.extend([[0, 1, 3, 2], [4, 5, 7, 6], [2, 3, 5, 4],
                      [0, 2, 4, 6], [1, 3, 5, 7][::-1], [0, 1, 7, 6]])
        part.push(verts, faces, cols)


def debris(P, cx, cy, spread, count, rnd, scale=1.0, ground=0.0):
    """Rubble. Boxes, tumbled and half-buried — cheap, and the thing that most
    reliably says a building fell rather than was never finished."""
    dark, stone = P["dark"], P["stone"]
    for _ in range(count):
        a = rnd.uniform(0, TAU)
        d = rnd.uniform(0.25, 1.0) ** 0.6 * spread
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        s = rnd.uniform(0.5, 1.6) * scale
        part = stone if rnd.random() < 0.6 else dark
        box(part, (x, y, ground + s * 0.3),
            (s * rnd.uniform(1.4, 3.4), s * rnd.uniform(1.2, 2.6), s * rnd.uniform(0.8, 2.4)),
            rot=(rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), rnd.uniform(0, TAU)),
            shade=rnd.uniform(0.22, 0.52))


def box(part, center, size, rot=(0, 0, 0), shade=1.0, base_pivot=False, taper=1.0):
    sx, sy, sz = size
    hx, hy = sx * 0.5, sy * 0.5
    tx, ty = hx * taper, hy * taper
    zlo, zhi = (0.0, sz) if base_pivot else (-sz * 0.5, sz * 0.5)
    local = [(-hx, -hy, zlo), (hx, -hy, zlo), (hx, hy, zlo), (-hx, hy, zlo),
             (-tx, -ty, zhi), (tx, -ty, zhi), (tx, ty, zhi), (-tx, ty, zhi)]
    euler = Euler(rot, "XYZ")
    origin = Vector(center)
    verts = []
    for p in local:
        v = Vector(p)
        v.rotate(euler)
        verts.append(tuple(v + origin))
    s = shade if isinstance(shade, (tuple, list)) else (shade, shade, shade)
    cols = [tuple(s)] * 4 + [tuple(v * 1.18 for v in s)] * 4
    part.push(verts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1],
                      [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], cols)


def arch(part, p0, p1, rise, width, thick, rnd, wear_shade=0.8, gap=None, steps=16):
    """A sweeping arm between two points.

    Zanarkand's arms are broad flat fins, not tubes — the width is what reads
    against the sky. `gap` removes a run of segments so the arm is snapped.
    """
    a, b = Vector(p0), Vector(p1)
    pts = []
    for i in range(steps + 1):
        t = i / steps
        p = a.lerp(b, t)
        p.z += rise * math.sin(math.pi * t) ** 0.85
        pts.append(p)
    for i in range(steps):
        if gap and gap[0] <= i < gap[1]:
            continue
        t = (i + 0.5) / steps
        w = width * (1.0 - 0.42 * abs(t - 0.5) * 2.0)
        d = pts[i + 1] - pts[i]
        side = Vector((-d.y, d.x, 0.0))
        side = side.normalized() if side.length > 1e-5 else Vector((1.0, 0.0, 0.0))
        up = Vector((0.0, 0.0, thick * 0.5))
        v = [pts[i] - side * w - up, pts[i] + side * w - up,
             pts[i + 1] + side * w - up, pts[i + 1] - side * w - up,
             pts[i] - side * w + up, pts[i] + side * w + up,
             pts[i + 1] + side * w + up, pts[i + 1] - side * w + up]
        s = wear_shade * rnd.uniform(0.92, 1.08)
        cols = [(s * 0.8,) * 3] * 4 + [(s * 1.15,) * 3] * 4
        part.push([tuple(q) for q in v],
                  [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1],
                   [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], cols)
    return pts


def window_bands(P, cx, cy, profile, h, rnd, phase, ground=0.0, count=None, lit=0.34):
    """Courses of lit windows, set flat against the shaft.

    Placed by sampling the profile, so they follow the taper instead of
    floating off it. Kept small and sparse: at the size the first pass drew
    them the towers read as illuminated barcodes, and any window wide enough to
    see from a kilometre away is a window fifty metres across.
    """
    neon = P["neon"]
    count = count or max(3, int(h / 22))
    for k in range(count):
        t = (k + 0.6) / (count + 0.6)
        z = h * 0.08 + (h * 0.70 - h * 0.08) * t
        if ground + z < 3.0:       # nothing lit below the waterline
            continue
        r = _profile_radius(profile, z)
        if r <= 0.2:
            continue
        per = max(8, int(r * 2.6))
        for i in range(per):
            if rnd.random() > lit:
                continue
            a = TAU * i / per + phase + k * 0.11
            # Amber and cyan, mixed per course. The reference city is lit in
            # both — cold light in the public structure, warm light in the
            # windows people are behind — and one colour alone reads as neon
            # signage rather than as a city with somebody in it.
            shade = (1.0, 0.66, 0.30) if rnd.random() < 0.42 else (0.42, 0.84, 1.0)
            box(neon, (cx + math.cos(a) * r * 0.998, cy + math.sin(a) * r * 0.998, z),
                (r * 0.06, r * 0.14, h * 0.0055), rot=(0, 0, a), shade=shade)


def _profile_radius(profile, z):
    for i in range(len(profile) - 1):
        z0, z1 = profile[i][1], profile[i + 1][1]
        if z0 <= z <= z1 and z1 > z0:
            t = (z - z0) / (z1 - z0)
            return profile[i][0] + (profile[i + 1][0] - profile[i][0]) * t
    return 0.0


def fallen_trunk(P, rnd, cx, cy, w, h, break_z, ground, phase):
    """The part of a tower that is no longer standing.

    A ruin with nothing lying at its feet reads as a building that was never
    finished. This drops the missing length of shaft on the ground beside the
    stump, in two or three pieces, broken where it hit.
    """
    stone, dark = P["stone"], P["dark"]
    missing = h * 0.62 - break_z
    if missing < 12.0:
        return
    a = phase + rnd.uniform(0, TAU)
    pieces = rnd.randint(2, 3)
    run = w * 1.8
    for k in range(pieces):
        seg = missing / pieces * rnd.uniform(0.6, 0.95)
        r0 = w * (0.70 - 0.15 * k / pieces)
        x = cx + math.cos(a) * (run + seg * 0.5)
        y = cy + math.sin(a) * (run + seg * 0.5)
        # Built lying down: a frame tipped through 90 degrees, so the piece
        # runs along the ground away from the stump rather than standing in it.
        M = _frame(x, y, land_height(x, y) + r0 * 0.75,
                   math.pi * 0.5 + rnd.uniform(-0.12, 0.12),
                   a + rnd.uniform(-0.25, 0.25))
        seg_n = 9
        verts, faces = [], []
        for i, (rr, zz) in enumerate(((r0, -seg * 0.5), (r0 * 0.96, seg * 0.5))):
            for j in range(seg_n):
                th = TAU * j / seg_n
                verts.append((math.cos(th) * rr, math.sin(th) * rr, zz))
        for j in range(seg_n):
            faces.append([j, (j + 1) % seg_n, seg_n + (j + 1) % seg_n, seg_n + j])
        _emit(stone if k % 2 == 0 else dark, M, verts, faces,
              shade=rnd.uniform(0.30, 0.48), shade_top=rnd.uniform(0.55, 0.78))
        debris(P, x, y, r0 * 2.4, 6, rnd, scale=r0 * 0.22, ground=land_height(x, y))
        run += seg * rnd.uniform(1.05, 1.28)


def building(P, rnd, cx, cy, h, w, phase, ground=0.0, kind="tower", ruin=0.42):
    """One building, in both states.

    `ruin` is the fraction of its height that survived. Everything up to there
    is stone and always visible; everything above it — and the cladding over
    the whole thing — is the restored layer the scroll brings back.
    """
    stone, clad, glow = P["stone"], P["clad"], P["glow"]
    profile = (profile_tower(h, w, rnd) if kind == "tower"
               else profile_hall(h, w, rnd))
    break_z = h * ruin * rnd.uniform(0.86, 1.14)

    # ---- what survives ------------------------------------------------------
    surv = [(r, z) for (r, z) in profile if z <= break_z]
    if len(surv) < 2:
        surv = profile[:2]
    r_break = surv[-1][0]
    ruin_wear = make_wear(rnd, tint=(1.0, 0.97, 0.92), grime=0.62, top_bleach=0.22, h=h)
    sweep(stone, cx, cy, surv, max(10, int(w * 0.9)), phase, ruin_wear, z0=ground,
          cap_top=False)
    broken_rim(stone, cx, cy, r_break, ground + surv[-1][1], rnd, ruin_wear)

    # The wall does not survive all the way round. Slabs of it are pulled off
    # at random heights, which is the difference between a broken building and
    # a short one.
    for _ in range(rnd.randint(2, 5)):
        za = ground + break_z * rnd.uniform(0.25, 0.95)
        aa = phase + rnd.uniform(0, TAU)
        rr = _profile_radius(profile, za - ground)
        if rr < 0.3:
            continue
        box(P["dark"], (cx + math.cos(aa) * rr * 0.86, cy + math.sin(aa) * rr * 0.86, za),
            (rr * 0.5, rr * rnd.uniform(0.5, 1.1), break_z * rnd.uniform(0.10, 0.30)),
            rot=(0, 0, aa), shade=0.16)

    # the shaft that came down, lying where it fell
    fallen_trunk(P, rnd, cx, cy, w, h, break_z, ground, phase)
    debris(P, cx, cy, w * 3.4, int(14 + w * 1.3), rnd, scale=w * 0.12, ground=ground)

    # a light or two that outlived everything
    if rnd.random() < 0.30:
        z = ground + break_z * rnd.uniform(0.35, 0.85)
        sweep(glow, cx, cy, [(_profile_radius(profile, z - ground) * 1.005, 0.0),
                             (_profile_radius(profile, z - ground) * 1.005, h * 0.006)],
              max(10, int(w * 0.9)), phase, lambda r, z_, a: (1.0, 1.0, 1.0), z0=z)

    # ---- what is put back ---------------------------------------------------
    rest = [(r, z) for (r, z) in profile if z >= break_z * 0.98]
    if len(rest) > 2:
        new_wear = make_wear(rnd, tint=(1.0, 1.0, 1.02), grime=0.26, top_bleach=0.08, h=h)
        sweep(clad, cx, cy, rest, max(10, int(w * 0.9)), phase, new_wear, z0=ground)
    # the cladding sleeve over the surviving stump, very slightly proud of it
    sleeve = [(r * 1.012, z) for (r, z) in surv if z > h * 0.04]
    if len(sleeve) > 2:
        sweep(clad, cx, cy, sleeve, max(10, int(w * 0.9)), phase,
              make_wear(rnd, grime=0.20, top_bleach=0.18, h=h), z0=ground, cap_top=False)

    window_bands(P, cx, cy, profile, h, rnd, phase, ground=ground)

    # ---- the things that make it Zanarkand and not a tower block ------------
    # Balconies at the collars, a lit ring or two set into the shaft, and water
    # falling off it. In the reference every large building is pouring water
    # from somewhere, and it is most of what stops the city looking like an
    # arrangement of dark cones.
    if kind == "tower":
        for k in range(rnd.randint(2, 4)):
            z = h * rnd.uniform(0.16, 0.66)
            r = _profile_radius(profile, z)
            if r < 0.4:
                continue
            sweep(clad, cx, cy,
                  [(r * 1.02, 0.0), (r * 1.34, h * 0.004), (r * 1.36, h * 0.014),
                   (r * 1.30, h * 0.020), (r * 1.02, h * 0.022)],
                  max(12, int(w * 1.2)), phase,
                  make_wear(rnd, grime=0.30, top_bleach=0.05, h=h), z0=ground + z,
                  cap_top=False)
            sweep(P["neon"], cx, cy,
                  [(r * 1.30, h * 0.0175), (r * 1.30, h * 0.0205)],
                  max(12, int(w * 1.2)), phase,
                  lambda rr, zz, aa: (0.42, 0.86, 1.0), z0=ground + z, cap_top=False)

        # the big round window — the one feature every establishing shot has
        if rnd.random() < 0.55:
            z = h * rnd.uniform(0.20, 0.52)
            r = _profile_radius(profile, z)
            a = phase + rnd.uniform(0, TAU)
            for ring, col in ((1.0, (0.30, 0.92, 1.0)), (0.55, (0.85, 0.97, 1.0))):
                _lring(P["neon"], _frame(cx + math.cos(a) * r * 1.005,
                                         cy + math.sin(a) * r * 1.005,
                                         ground + z, 0.0, a + math.pi * 0.5),
                       0.0, w * 0.34 * ring, w * 0.05, shade=col[1])

        if rnd.random() < 0.45:
            waterfall(P, rnd, cx, cy, profile, h, ground, phase)
    return profile


def waterfall(P, rnd, cx, cy, profile, h, ground, phase):
    """Water pouring off a building and into the sea below it.

    Two thin sheets and a plume where it lands. It is cheap geometry and it
    does more for the restored city than another hundred windows.
    """
    falls = P["falls"]
    z = h * rnd.uniform(0.24, 0.60)
    r = _profile_radius(profile, z)
    if r < 0.5:
        return
    a = phase + rnd.uniform(0, TAU)
    x, y = cx + math.cos(a) * r * 0.98, cy + math.sin(a) * r * 0.98
    drop = ground + z - 1.0
    wdt = r * rnd.uniform(0.28, 0.55)
    for k in range(2):
        off = (k - 0.5) * wdt * 0.5
        px = x + math.cos(a + math.pi * 0.5) * off
        py = y + math.sin(a + math.pi * 0.5) * off
        box(falls, (px, py, ground + z - drop * 0.5),
            (wdt * 0.5, wdt * 0.16, drop), rot=(0, 0, a), shade=1.0)
    # the plume at the bottom
    sweep(falls, x, y, [(wdt * 0.9, 0.0), (wdt * 1.5, 3.0), (wdt * 1.1, 6.0)],
          12, a, lambda rr, zz, aa: (1.0, 1.0, 1.0), z0=0.0, cap_top=False)


def district(P, rnd, cx, cy, radius, scale=1.0):
    """A cluster: one tall tower, a few lesser ones, halls filling the ground,
    and arms reaching out over the water."""
    ground = land_height(cx, cy)
    big_h = rnd.uniform(210.0, 360.0) * scale
    big_w = rnd.uniform(9.0, 15.0) * scale
    a0 = rnd.uniform(0, TAU)
    # Survival is bimodal on purpose: most towers are stumps, but a few stand
    # most of the way up. A city where everything broke at the same height
    # reads as having been mown rather than having fallen.
    def survived():
        return (rnd.uniform(0.10, 0.30) if rnd.random() < 0.72
                else rnd.uniform(0.40, 0.66))

    building(P, rnd, cx, cy, big_h, big_w, a0, ground=ground, ruin=survived())

    peers = []
    for k in range(rnd.randint(2, 4)):
        a = a0 + TAU * k / 4.0 + rnd.uniform(-0.5, 0.5)
        d = rnd.uniform(radius * 0.35, radius * 0.95)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        h = big_h * rnd.uniform(0.32, 0.68)
        w = big_w * rnd.uniform(0.55, 0.85)
        building(P, rnd, x, y, h, w, a, ground=land_height(x, y), ruin=survived())
        peers.append((x, y, h, w))

    for k in range(rnd.randint(2, 4)):
        a = rnd.uniform(0, TAU)
        d = rnd.uniform(radius * 0.5, radius * 1.25)
        x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
        building(P, rnd, x, y, rnd.uniform(16.0, 40.0) * scale,
                 rnd.uniform(12.0, 22.0) * scale, a, ground=land_height(x, y),
                 kind="hall", ruin=rnd.uniform(0.45, 0.80))

    # arms between the big tower and its peers, most of them broken
    for (x, y, h, w) in peers:
        if rnd.random() < 0.45:
            continue
        z0 = ground + big_h * rnd.uniform(0.22, 0.38)
        z1 = land_height(x, y) + h * rnd.uniform(0.45, 0.70)
        g0 = rnd.randint(4, 9)
        arch(P["stone"], (cx, cy, z0), (x, y, z1),
             rise=rnd.uniform(10.0, 26.0), width=rnd.uniform(2.4, 5.0),
             thick=1.8, rnd=rnd, gap=(g0, g0 + rnd.randint(2, 4)))
    return (cx, cy, big_h)


# ------------------------------------------------------------------ the arena
#
# The blitzball stadium: the one building anybody would name if asked what
# Zanarkand looks like. A bowl of stands with a ball of water held above it,
# ringed by the arms that carry it.
#
# It is built as a ring of angular sectors rather than as one revolve, because
# that is what lets the ruin break unevenly — each sector decides for itself
# how much of the wall it kept, and a few decide they kept none of it.


def spline_arm(part, pts, width0, width1, thick, shade=0.8, twist=0.0):
    """A tapering fin swept along a path.

    The arena's arms are the shape the whole building is remembered for: they
    leave the ground outside the ring, rise, and curl back in over the water.
    A straight beam or a circular arch does not do that — the path has to bend
    in two planes — so this takes an arbitrary polyline and skins it.
    """
    n = len(pts) - 1
    for i in range(n):
        t = i / n
        a, b = Vector(pts[i]), Vector(pts[i + 1])
        d = b - a
        if d.length < 1e-5:
            continue
        w0 = width0 + (width1 - width0) * t
        w1 = width0 + (width1 - width0) * ((i + 1) / n)
        side = Vector((-d.y, d.x, 0.0))
        side = side.normalized() if side.length > 1e-4 else Vector((1.0, 0.0, 0.0))
        up = d.cross(side).normalized() * (thick * 0.5)
        v = [a - side * w0 - up, a + side * w0 - up, b + side * w1 - up, b - side * w1 - up,
             a - side * w0 + up, a + side * w0 + up, b + side * w1 + up, b - side * w1 + up]
        s = shade * (0.85 + 0.3 * t)
        cols = [(s * 0.72,) * 3] * 4 + [(s * 1.2,) * 3] * 4
        part.push([tuple(q) for q in v],
                  [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1],
                   [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], cols)


def _bez(p0, p1, p2, t):
    u = 1.0 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def arena_profile(r, h):
    """Outside wall up, over the lip, and back down the inside — one closed
    section, so a single sweep produces a bowl with thickness."""
    # Outside wall up, over the lip, then down the inside in seating tiers to
    # the floor. The tiers are what the aerial reference is mostly made of —
    # concentric rings stepping down to the water — so they are in the section
    # rather than added on top of a smooth bowl.
    p = [(r * 1.00, 0.0), (r * 1.06, h * 0.08), (r * 1.10, h * 0.30),
         (r * 1.09, h * 0.74), (r * 1.13, h * 0.88),
         (r * 1.10, h * 1.00), (r * 0.98, h * 1.00)]
    tiers = 6
    for k in range(tiers):
        t0 = k / tiers
        t1 = (k + 1) / tiers
        rr = r * (0.96 - 0.62 * t0)
        p.append((rr, h * (1.00 - 0.62 * t0)))
        p.append((rr, h * (1.00 - 0.62 * t1) + h * 0.02))
        p.append((r * (0.96 - 0.62 * t1), h * (1.00 - 0.62 * t1) + h * 0.02))
    p.append((r * 0.30, h * 0.34))
    p.append((r * 0.28, h * 0.10))
    p.append((r * 0.86, 0.0))
    return _res(p, step=max(1.5, h * 0.05))


def arena(P, rnd, cx=0.0, cy=0.0):
    """The stadium, in both states."""
    stone, clad, metal, glow, neon = (P["stone"], P["clad"], P["metal"],
                                      P["glow"], P["neon"])
    ground = land_height(cx, cy)
    h = 96.0
    prof = arena_profile(ARENA_R, h)
    sectors = 22
    ruin_wear = make_wear(rnd, tint=(1.0, 0.97, 0.93), grime=0.66, top_bleach=0.20, h=h)
    new_wear = make_wear(rnd, grime=0.24, top_bleach=0.08, h=h)

    for k in range(sectors):
        a0 = TAU * k / sectors
        a1 = TAU * (k + 1) / sectors
        # how much of this sector survived
        keep = rnd.random()
        if keep < 0.18:
            frac = 0.0                      # gone entirely
        elif keep < 0.62:
            frac = rnd.uniform(0.18, 0.46)
        else:
            frac = rnd.uniform(0.52, 0.92)

        # The arena belongs to the living city only. A thousand years later
        # there is no stadium on the site — just the low broken footprint of
        # something that used to be round — so the wall is entirely in the
        # restored layer and the ruin keeps a stump of it at most.
        if frac > 0.55:
            cut = h * 0.06 * rnd.uniform(0.6, 1.4)
            surv = [(r, min(z, cut)) for (r, z) in prof]
            surv = [(r, z) for (r, z) in surv if z < cut] or surv[:2]
            surv.append((surv[-1][0], cut))
            sweep(stone, cx, cy, surv, 4, 0.0, ruin_wear, z0=ground,
                  cap_top=False, arc=(a0, a1))

        sweep(clad, cx, cy, prof, 4, 0.0, new_wear, z0=ground,
              cap_top=False, arc=(a0, a1))

    # the ring of light along the lip, a line under each tier, and the
    # concourse windows behind the outer wall
    sweep(neon, cx, cy, [(ARENA_R * 1.135, h * 0.885), (ARENA_R * 1.135, h * 0.915)],
          80, 0.0, lambda r, z, a: (0.55, 0.92, 1.0), z0=ground, cap_top=False)
    for k in range(6):
        t = k / 6
        rr = ARENA_R * (0.96 - 0.62 * t)
        zz = h * (1.00 - 0.62 * t)
        sweep(neon, cx, cy, [(rr * 0.995, zz + 0.5), (rr * 0.995, zz + 1.1)],
              64, 0.0, lambda r, z, a: (0.20, 0.44, 0.56), z0=ground, cap_top=False)
    for k in range(72):
        a = TAU * k / 72
        box(neon, (cx + math.cos(a) * ARENA_R * 1.105,
                   cy + math.sin(a) * ARENA_R * 1.105, ground + h * 0.46),
            (1.0, 4.2, 2.0), rot=(0, 0, a),
            shade=(1.0, 0.70, 0.34) if k % 3 else (0.42, 0.84, 1.0))

    # ---- the arms and the sphere -------------------------------------------
    # Eight of them, leaving the ground outside the ring, rising past the lip
    # and curling back in over the water. In the reference they read almost as
    # claws holding the sphere, and getting that curl is most of what makes the
    # building recognisable from the air.
    pool_z = ground + h * 1.30
    pool_r = 42.0
    for k in range(8):
        a = TAU * k / 8 + 0.22
        ca, sa = math.cos(a), math.sin(a)
        p0 = (ARENA_R * 1.36, ground + 4.0)
        p1 = (ARENA_R * 1.30, pool_z + pool_r * 1.30)
        # They stay out over the ring and never reach the water. Nothing
        # touches the sphere: it hangs on its own, and every tube that arcs
        # near it turns a held volume of water into plumbing.
        p2 = (ARENA_R * 0.78, pool_z - pool_r * 0.35)
        pts = []
        for i in range(21):
            t = i / 20
            rr, zz = _bez(p0, p1, p2, t)
            # a little lateral sweep, so the arms spiral rather than sit in
            # eight flat planes
            aa = a + 0.30 * t * t
            pts.append((cx + math.cos(aa) * rr, cy + math.sin(aa) * rr, zz))
        spline_arm(clad, pts, 9.0, 2.4, 5.0, shade=0.75)
        # the light running up the inside edge of each arm
        lit = [(x, y, z + 3.0) for (x, y, z) in pts[5:]]
        spline_arm(neon, lit, 0.5, 0.2, 0.34, shade=0.55)
        # the pylon it stands on
        sweep(clad, cx + ca * ARENA_R * 1.36, cy + sa * ARENA_R * 1.36,
              _res([(13.0, 0.0), (11.0, 14.0), (7.5, 34.0)], step=4.0),
              10, a, new_wear, z0=ground - 6.0, cap_top=False)

    # The water itself is restored-only: what is left in the ruin is the dry
    # cradle. Its own material, so the web build can give it a moving surface.
    sweep(P["pool"], cx, cy,
          _res([(0.0, -pool_r)] +
               [(pool_r * math.sin(math.pi * i / 18), -pool_r * math.cos(math.pi * i / 18))
                for i in range(1, 18)] + [(0.0, pool_r)], step=2.0),
          46, 0.0, lambda r, z, a: (1.0, 1.0, 1.0), z0=pool_z, cap_top=False)

    # ---- what is inside it --------------------------------------------------
    # A pitch. Two goals facing each other down the long axis, apex down, and
    # the board hanging between them. Without these the sphere is a bead of
    # glass; with them it is unmistakably a blitzball match waiting to start.
    for side in (0.0, math.pi):
        # bearing = side, not side + 90°: the triangle is authored in the local
        # y-z plane, so its face normal is local +X, and the pair only look at
        # each other when that normal runs along the line between them
        blitz_goal(P, _frame(cx + math.cos(side) * pool_r * 0.62,
                             cy + math.sin(side) * pool_r * 0.62,
                             pool_z + pool_r * 0.06, 0.0, side),
                   pool_r * 0.34)
    scoreboard(P, _frame(cx, cy, pool_z + pool_r * 0.26, 0.0, 0.0), pool_r * 0.15)

    # What the ruin actually has here: a ring of rubble and a few stumps of
    # the columns that carried the concourse.
    debris(P, cx, cy, ARENA_R * 1.4, 120, rnd, scale=2.2, ground=ground)
    for k in range(18):
        a = TAU * k / 18 + rnd.uniform(-0.08, 0.08)
        if rnd.random() < 0.35:
            continue
        px, py = cx + math.cos(a) * ARENA_R * 1.02, cy + math.sin(a) * ARENA_R * 1.02
        hh = rnd.uniform(5.0, 20.0)
        sweep(stone, px, py, _res([(4.6, 0.0), (3.8, hh * 0.1), (3.5, hh)], step=2.5),
              9, a, make_wear(rnd, grime=0.66, top_bleach=0.24, h=hh),
              z0=ground - 1.0, cap_top=False)
        broken_rim(stone, px, py, 3.5, ground - 1.0 + hh, rnd,
                   make_wear(rnd, grime=0.5, h=hh), teeth=7, depth=4.5)


# --------------------------------------------------------------- the memorial
#
# The weapons planted in the ridge. In the reference they are the first thing
# the eye lands on: enormous blades and staves driven into the rock at the
# angle they fell, silhouetted against the sun, with the dead city behind them.
# They are what tells you people died here — the ruin on its own only says a
# city fell down.
#
# Each is built in its own frame, blade along +Z, then tipped and planted, so
# the shapes can be written the way you would draw them rather than in world
# coordinates.


def _frame(x, y, z, tilt, bearing):
    return (Matrix.Translation((x, y, z))
            @ Euler((0.0, 0.0, bearing), "XYZ").to_matrix().to_4x4()
            @ Euler((tilt, 0.0, 0.0), "XYZ").to_matrix().to_4x4())


def _emit(part, M, verts, faces, shade=1.0, shade_top=None):
    # `shade` may be a scalar or an rgb triple: the lit parts want a hue, and
    # everything else only wants to be darker at the bottom than the top.
    base = shade if isinstance(shade, (tuple, list)) else (shade, shade, shade)
    top = shade_top if shade_top is not None else base
    top = top if isinstance(top, (tuple, list)) else (top, top, top)
    zs = [v[2] for v in verts]
    lo, hi = min(zs), max(zs) + 1e-5
    cols = []
    out = []
    for v in verts:
        w = M @ Vector(v)
        out.append((w.x, w.y, w.z))
        t = (v[2] - lo) / (hi - lo)
        cols.append(tuple(base[i] + (top[i] - base[i]) * t for i in range(3)))
    part.push(out, faces, cols)


def _lbox(part, M, center, size, shade=1.0, taper=1.0, taper_y=None, rot=(0, 0, 0)):
    sx, sy, sz = size
    hx, hy = sx * 0.5, sy * 0.5
    tx = hx * taper
    ty = hy * (taper if taper_y is None else taper_y)
    local = [(-hx, -hy, -sz * 0.5), (hx, -hy, -sz * 0.5), (hx, hy, -sz * 0.5),
             (-hx, hy, -sz * 0.5), (-tx, -ty, sz * 0.5), (tx, -ty, sz * 0.5),
             (tx, ty, sz * 0.5), (-tx, ty, sz * 0.5)]
    e = Euler(rot, "XYZ")
    o = Vector(center)
    verts = []
    for p in local:
        v = Vector(p)
        v.rotate(e)
        verts.append(tuple(v + o))
    _emit(part, M, verts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1],
                           [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]], shade)


def _lring(part, M, cz, radius, tube, shade=1.0, major=20, minor=6, plane="xz"):
    verts, faces = [], []
    for i in range(major):
        u = TAU * i / major
        for j in range(minor):
            v = TAU * j / minor
            rr = radius + tube * math.cos(v)
            t = tube * math.sin(v)
            if plane == "xz":
                verts.append((rr * math.cos(u), t, cz + rr * math.sin(u)))
            else:
                verts.append((rr * math.cos(u), rr * math.sin(u), cz + t))
    for i in range(major):
        for j in range(minor):
            faces.append([i * minor + j, i * minor + (j + 1) % minor,
                          ((i + 1) % major) * minor + (j + 1) % minor,
                          ((i + 1) % major) * minor + j])
    _emit(part, M, verts, faces, shade)


def _blade(part, M, length, width, thick, shade, curve=0.0, segments=9):
    """A tapering blade with a raised spine, optionally curved.

    Built as a strip of quads rather than one box: the spine is what catches
    the sun along the length, and a straight box catches nothing.
    """
    verts, faces = [], []
    for i in range(segments + 1):
        t = i / segments
        w = width * (1.0 - 0.72 * t ** 1.7)
        th = thick * (1.0 - 0.6 * t)
        x = curve * length * (t ** 2)
        z = length * t
        verts.extend([(x - w, -th, z), (x, -th * 0.35, z),
                      (x + w, -th, z), (x + w, th, z),
                      (x, th * 0.35, z), (x - w, th, z)])
    for i in range(segments):
        a, b = i * 6, (i + 1) * 6
        for k in range(6):
            faces.append([a + k, a + (k + 1) % 6, b + (k + 1) % 6, b + k])
    _emit(part, M, verts, faces, shade * 0.75, shade * 1.25)


def _lbeam(part, M, p0, p1, w, shade=0.8, thick=None):
    """A box spanning two points in the local frame."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    if d.length < 1e-5:
        return
    rot = d.to_track_quat("Z", "Y").to_euler()
    _lbox(part, M, tuple((a + b) * 0.5), (w, thick or w, d.length),
          rot=tuple(rot), shade=shade)


def blitz_goal(P, M, size, shade=0.85):
    """One goal.

    An inverted triangle — apex down — hanging in the water with a hoop at the
    point. The pair face each other across the sphere, which is the only reason
    the inside of a ball of water reads as a pitch.
    """
    metal, neon = P["metal"], P["neon"]
    apex = (0.0, 0.0, -size)
    left = (0.0, -size * 0.92, size * 0.58)
    right = (0.0, size * 0.92, size * 0.58)
    for (p, q) in ((apex, left), (apex, right), (left, right)):
        _lbeam(metal, M, p, q, size * 0.10, shade=shade)
        _lbeam(neon, M, p, q, size * 0.045, shade=(0.45, 0.88, 1.0))
    _lring(metal, M, -size * 0.86, size * 0.20, size * 0.035, shade=shade, plane="xy")
    _lring(neon, M, -size * 0.86, size * 0.20, size * 0.018,
           shade=(1.0, 0.72, 0.34), plane="xy")


def scoreboard(P, M, width, shade=0.9):
    """The board that hangs in the middle of the sphere.

    Two rollers with a lit panel stretched between them, as in the game. It is
    small on screen and it is the single most legible piece of blitzball
    iconography there is.
    """
    metal, neon = P["metal"], P["neon"]
    h = width * 0.62
    _lbox(neon, M, (0.0, 0.0, 0.0), (width * 0.02, width * 1.72, h),
          shade=(0.34, 0.78, 1.0))
    _lbox(metal, M, (0.0, 0.0, 0.0), (width * 0.06, width * 1.80, h * 1.10),
          shade=shade * 0.7)
    for side in (-1, 1):
        _lbox(metal, M, (0.0, side * width * 0.98, 0.0),
              (width * 0.22, width * 0.22, h * 1.30), shade=shade)
        _lring(neon, M, 0.0, width * 0.13, width * 0.03, shade=(0.9, 0.95, 1.0))
    # the arms it hangs from
    for side in (-1, 1):
        _lbeam(metal, M, (0.0, side * width * 0.98, h * 0.65),
               (0.0, side * width * 1.9, h * 1.9), width * 0.07, shade=shade * 0.8)


def planted_weapon(P, rnd, x, y, z, height, tilt, bearing, kind=None):
    """One weapon driven into the ground.

    Scale is the whole point: these read as monuments, not as props, so the
    smallest is about the height of a house and the largest stands over the
    ridge like a mast.
    """
    metal, dark, stone, glow = P["metal"], P["dark"], P["stone"], P["glow"]
    kind = kind or rnd.choice(["sword", "katana", "spear", "staff", "greatsword"])
    M = _frame(x, y, z, tilt, bearing)
    # buried depth: the grip end sits below the rock
    bury = height * 0.18

    if kind in ("sword", "greatsword"):
        blade_l = height * (0.72 if kind == "sword" else 0.80)
        w = height * (0.035 if kind == "sword" else 0.055)
        _blade(metal, M @ Matrix.Translation((0, 0, -bury)), blade_l, w,
               w * 0.30, shade=0.9)
        # cross guard and grip, above the blade because it is planted point-down
        gz = blade_l - bury
        _lbox(metal, M, (0, 0, gz + height * 0.012),
              (w * 6.0, w * 1.4, height * 0.022), shade=0.8)
        _lbox(dark, M, (0, 0, gz + height * 0.075),
              (w * 1.5, w * 1.5, height * 0.115), shade=0.5)
        _lbox(metal, M, (0, 0, gz + height * 0.142),
              (w * 2.0, w * 2.0, height * 0.026), shade=0.85)
    elif kind == "katana":
        blade_l = height * 0.80
        w = height * 0.024
        _blade(metal, M @ Matrix.Translation((0, 0, -bury)), blade_l, w,
               w * 0.5, shade=1.0, curve=0.05)
        gz = blade_l - bury
        _lring(metal, M, gz + height * 0.006, w * 2.4, w * 0.45, shade=0.8, plane="xy")
        _lbox(dark, M, (0, 0, gz + height * 0.085),
              (w * 1.6, w * 1.1, height * 0.15), shade=0.42)
    elif kind == "spear":
        shaft_l = height * 0.86
        r = height * 0.011
        _lbox(dark, M, (0, 0, shaft_l * 0.5 - bury), (r * 2, r * 2, shaft_l), shade=0.45)
        _blade(metal, M @ Matrix.Translation((0, 0, shaft_l - bury)),
               height * 0.20, height * 0.030, height * 0.010, shade=0.95)
        for k in range(3):
            _lring(metal, M, shaft_l * (0.30 + 0.22 * k) - bury, r * 2.2, r * 0.7,
                   shade=0.8, plane="xy")
    else:  # staff — the summoner's, with its ringed wheel
        shaft_l = height * 0.88
        r = height * 0.013
        _lbox(dark, M, (0, 0, shaft_l * 0.5 - bury), (r * 2, r * 2, shaft_l), shade=0.5)
        hz = shaft_l - bury + height * 0.10
        _lring(metal, M, hz, height * 0.085, height * 0.010, shade=0.9)
        _lring(glow, M, hz, height * 0.085, height * 0.004, shade=1.0)
        for k in range(6):
            a = TAU * k / 6
            _lbox(metal, M, (math.cos(a) * height * 0.043, 0.0,
                             hz + math.sin(a) * height * 0.043),
                  (height * 0.006, height * 0.006, height * 0.086),
                  rot=(0.0, -a, 0.0), shade=0.75)

    # the ground broken open where it went in
    debris(P, x, y, height * 0.10, 7, rnd, scale=height * 0.012, ground=z - height * 0.02)


def memorial(P, rnd, count=26):
    """Weapons scattered along the crest of the rim, thickest where the shot
    opens. Bearings are biased to lean away from the basin, as if everything
    was driven in facing the city."""
    for i in range(count):
        # cluster around the opening bearing, with stragglers all round
        if i < count * 0.65:
            # Off to the sides of the opening shot, never down the middle of
            # it: one of these across the lens is a blindfold, not a monument.
            a = math.radians(rnd.choice((-1.0, 1.0)) * rnd.uniform(15.0, 46.0))
        else:
            a = rnd.uniform(0, TAU)
        d = BASIN_R * rnd.uniform(0.94, 1.22)
        x, y = math.cos(a) * d, math.sin(a) * d
        z = land_height(x, y)
        if z < 6.0:
            continue
        (ox, oy, oz), _ = opening_camera()
        if math.hypot(x - ox, y - oy) < 150.0:
            continue
        h = rnd.choice([rnd.uniform(16.0, 30.0)] * 4 + [rnd.uniform(34.0, 52.0)])
        tilt = rnd.uniform(0.10, 0.46) * rnd.choice((-1.0, 1.0))
        planted_weapon(P, rnd, x, y, z + h * 0.02, h, tilt,
                       a + math.pi + rnd.uniform(-1.1, 1.1))


# -------------------------------------------------------- the opening picture
#
# Everything above can build a plausible Zanarkand from any seed. This section
# builds *the* Zanarkand — the frame the page opens on, composed against the
# reference: a rock ledge in the immediate foreground on the right, the dead
# city spread low across the middle, and the sun sitting on the horizon dead
# ahead with the ruin in silhouette against it.
#
# The camera looks along -X. Screen-right is therefore +Y, which is why the
# crag is placed at positive Y and the tall landmark at negative.

def opening_camera():
    """Where the page starts, and what it looks at."""
    x = BASIN_R * 1.16
    y = 0.0
    # Standing height is not enough. The rim is rock, and at eighteen units up
    # a knuckle of it rises straight into the middle of the frame — the dark
    # lump that sat in front of the city in every early render was the ground
    # the camera was standing on. Forty-two clears it.
    z = land_height(x, y) + 42.0
    # aimed a little low, so the ledge the shot is taken from stays in frame —
    # the reference is looking down at the city, not level with it
    return (x, y, z), (-BASIN_R * 0.55, 12.0, 18.0)


def hero_layout(P, rnd):
    """The landmarks of the opening frame, placed relative to the camera."""
    (cx, cy, cz), _ = opening_camera()
    stone, dark = P["stone"], P["dark"]

    # ---- the foreground crag ------------------------------------------------
    # The right quarter of the reference is a single rock face, close enough
    # that it is out of focus and reads as pure silhouette. It is the thing
    # that makes the shot feel like it was taken from somewhere.
    # Well off to the side. At 92 units of offset the mass is only 35 degrees
    # off the lens axis and, being 46 wide at the base, it reached back into
    # the middle of the frame and stood in front of the city. In the reference
    # the rock is at the very edge — it frames the shot, it does not block it.
    gx, gy = cx - 60.0, cy + 155.0
    gz = land_height(gx, gy)
    crag = _res([(46.0, 0.0), (44.0, 22.0), (38.0, 58.0), (40.0, 74.0),
                 (30.0, 96.0), (33.0, 112.0), (22.0, 140.0), (24.0, 152.0),
                 (12.0, 178.0), (6.0, 190.0)], step=4.0)
    sweep(dark, gx, gy, crag, 13, rnd.uniform(0, TAU),
          make_wear(rnd, grime=0.55, top_bleach=0.35, h=190.0), z0=gz - 30.0,
          jitter=0.16, rnd=rnd)
    # slabs peeling off its face, as in the reference
    for _ in range(12):
        a = rnd.uniform(0, TAU)
        zz = rnd.uniform(0.1, 0.85) * 150.0
        rr = 40.0 - zz * 0.16
        box(dark, (gx + math.cos(a) * rr, gy + math.sin(a) * rr, gz - 20.0 + zz),
            (rnd.uniform(6, 22), rnd.uniform(4, 10), rnd.uniform(8, 30)),
            rot=(rnd.uniform(-0.4, 0.4), rnd.uniform(-0.35, 0.35), a),
            shade=rnd.uniform(0.20, 0.44))
    for _ in range(4):
        # kept on the far side of the crag from the lens, so they extend the
        # headland rather than stepping in front of the shot
        a = rnd.uniform(0.3, 2.6)
        d = rnd.uniform(52.0, 110.0)
        px, py = gx + math.cos(a) * d, gy + math.sin(a) * d
        sweep(dark, px, py,
              _res([(rnd.uniform(9, 17), 0.0), (rnd.uniform(7, 13), 30.0),
                    (rnd.uniform(3, 7), 62.0), (1.0, 74.0)], step=4.0),
              9, rnd.uniform(0, TAU),
              make_wear(rnd, grime=0.5, top_bleach=0.3, h=74.0),
              z0=land_height(px, py) - 8.0, jitter=0.2, rnd=rnd)

    # ---- the near rubble ----------------------------------------------------
    # Broken columns and slabs strewn over the ledge between camera and drop.
    for _ in range(30):
        a = rnd.uniform(-1.5, 1.5)
        d = rnd.uniform(120.0, 300.0)
        px = cx - d * math.cos(a * 0.5)
        py = cy + d * math.sin(a)
        pz = land_height(px, py)
        if pz < 4.0:
            continue
        # nothing tall directly down the barrel of the opening shot
        if abs(py - cy) < 62.0 and d < 270.0:
            continue
        if rnd.random() < 0.55:
            hh = rnd.uniform(6.0, 20.0)
            ww = rnd.uniform(2.2, 5.5)
            sweep(stone, px, py,
                  _res([(ww * 1.3, 0.0), (ww, hh * 0.12), (ww * 0.95, hh)], step=2.0),
                  9, rnd.uniform(0, TAU),
                  make_wear(rnd, grime=0.6, top_bleach=0.3, h=hh),
                  z0=pz - 2.0, cap_top=False)
            broken_rim(stone, px, py, ww * 0.95, pz - 2.0 + hh, rnd,
                       make_wear(rnd, grime=0.5, h=hh), teeth=6, depth=ww * 1.4)
        else:
            box(stone, (px, py, pz + 1.0),
                (rnd.uniform(4, 14), rnd.uniform(3, 9), rnd.uniform(2, 7)),
                rot=(rnd.uniform(-0.35, 0.35), rnd.uniform(-0.35, 0.35),
                     rnd.uniform(0, TAU)), shade=rnd.uniform(0.24, 0.55))

    # ---- the landmarks on the sight line ------------------------------------
    # Left of centre: the stepped spire that dominates the reference skyline.
    lx, ly = -BASIN_R * 0.34, -BASIN_R * 0.30
    building(P, rnd, lx, ly, 300.0, 13.0, 0.4, ground=land_height(lx, ly), ruin=0.74)
    # Centre: a wide broken hall with its arms still standing over it.
    hx, hy = -BASIN_R * 0.16, -BASIN_R * 0.02
    building(P, rnd, hx, hy, 84.0, 42.0, 1.1, ground=land_height(hx, hy),
             kind="hall", ruin=0.52)
    for k in range(3):
        aa = 1.1 + k * 1.9
        arch(stone, (hx, hy, land_height(hx, hy) + 60.0),
             (hx + math.cos(aa) * 130.0, hy + math.sin(aa) * 130.0,
              land_height(hx + math.cos(aa) * 130.0, hy + math.sin(aa) * 130.0) + 20.0),
             rise=34.0, width=6.0, thick=3.0, rnd=rnd,
             gap=(rnd.randint(6, 9), rnd.randint(10, 13)))
    # Right of centre: a low colonnade, half of it gone.
    for k in range(14):
        px = -BASIN_R * 0.30 + k * 11.0
        py = BASIN_R * 0.26 + math.sin(k * 0.7) * 8.0
        pz = land_height(px, py)
        if rnd.random() < 0.3:
            continue
        hh = rnd.uniform(16.0, 34.0)
        sweep(stone, px, py, _res([(4.2, 0.0), (3.4, hh * 0.1), (3.1, hh)], step=2.5),
              9, 0.0, make_wear(rnd, grime=0.62, top_bleach=0.28, h=hh),
              z0=pz - 2.0, cap_top=False)
        broken_rim(stone, px, py, 3.1, pz - 2.0 + hh, rnd,
                   make_wear(rnd, grime=0.5, h=hh), teeth=7, depth=4.0)


# -------------------------------------------------------------------- assembly
def build_world(land_rings=310, land_segments=380):
    reset_scene()
    mats = make_materials()
    P = {k: Part(k.capitalize(), m, smooth=(k in ("sea", "pool", "falls")))
         for k, m in mats.items()}
    rnd = random.Random(SEED)

    build_land(P, rnd, rings=land_rings, segments=land_segments)
    build_sea(P)

    # ---- the city -----------------------------------------------------------
    # Districts on the drowned plain, laid out as clusters with open water
    # between them rather than as an even field. The near ones are placed on
    # the far side of the basin from the opening camera, so the shot looks
    # across the memorial and the water at them.
    arena(P, rnd)

    placed = []
    for i in range(13):
        for _ in range(80):
            a = rnd.uniform(0, TAU)
            d = rnd.uniform(120.0, BASIN_R * 0.84)
            cx, cy = math.cos(a) * d, math.sin(a) * d
            # keep the near third of the basin clear: it is the ground the
            # opening shot looks across, and a district there blocks the city
            if cx > BASIN_R * 0.34:
                continue
            if land_height(cx, cy) < -14.0:
                continue
            if any((cx - px) ** 2 + (cy - py) ** 2 < 115.0 ** 2 for px, py, _ in placed):
                continue
            placed.append(district(P, rnd, cx, cy, rnd.uniform(48.0, 88.0),
                                   scale=rnd.uniform(0.7, 1.25)))
            break

    hero_layout(P, rnd)
    memorial(P, rnd)

    coll = bpy.context.scene.collection
    objs = [p.build(coll) for p in P.values()]
    return P, [o for o in objs if o], {p.name: len(p.verts) for p in P.values()}


def export_glb(path, rings=190, segments=240):
    """Rebuild at web resolution and write the model out.

    The land is the only thing that gets coarser: it is 40% of the vertices at
    preview resolution and almost none of what the eye is reading, whereas
    dropping a course of windows is immediately visible. Normals are left out —
    the web materials are flat-shaded and recompute the smooth ones — and the
    wear colours ship as bytes, which together is most of the difference
    between a three megabyte model and a seven megabyte one.
    """
    P, objs, stats = build_world(land_rings=rings, land_segments=segments)

    # The restored layers are dead weight in this file. The city the page
    # rebuilds into is the earlier model, loaded alongside this one, so the
    # cladding, neon, water and falls authored here are never drawn — they were
    # about a third of the vertices and none of the picture.
    for name in ("Clad", "Neon", "Pool", "Falls"):
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)

    for obj in bpy.data.objects:
        obj.select_set(obj.type == "MESH")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True, export_normals=False,
        export_texcoords=False, export_vertex_color="ACTIVE",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )
    return stats


if __name__ == "__main__":
    P, objs, stats = build_world()
    print("ZANARKAND2", stats)
