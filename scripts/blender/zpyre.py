# -----------------------------------------------------------------------------
# One pyrefly, at close range.
#
# The versions inside zarena.py are built to be seen at a hundred metres in a
# crowd of two hundred. This one is built to be looked at, and the difference
# is entirely structure:
#
#   * The tail is a BRAID. In the reference it is not a smooth cone — it is a
#     dozen separate filaments spiralling around a common axis, and the reason
#     the colours read as separated light rather than as a tinted object is
#     that each filament is its own hue and they cross each other. A single
#     tube with a radial gradient can only ever be an airbrushed approximation
#     of that.
#   * The head is an ELLIPSOID, not a sphere. It is moving, and it is longer
#     along the direction of travel than across it.
#   * Every surface dissolves at its own silhouette, so nothing in the mote has
#     an outline.
#
# The glow is not done here. Blender 5's compositor defeated me twice, so the
# bloom is applied afterwards, outside Blender, where it is twenty lines of
# numpy and behaves exactly as asked.
#
#     import zpyre; zpyre.solo(); zpyre.render("/abs/out.png")
# -----------------------------------------------------------------------------
import bpy
import math
import random

TAU = math.pi * 2


def _pos(v):
    """Clamp to zero before a fractional power.

    Floating point lets `u` land a hair over 1.0 at the end of a loop, and
    `(1 - u) ** 0.85` on a negative base returns a *complex* number in Python
    — which then fails a comparison twenty lines later with an error that says
    nothing about where it came from.
    """
    return v if v > 0.0 else 0.0


def _reset():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras,
                  bpy.data.lights, bpy.data.worlds):
        for item in list(block):
            block.remove(item)


def _mesh_from(name, verts, faces, cols, material, smooth=True):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    attr = mesh.color_attributes.new(name="hue", type="FLOAT_COLOR",
                                     domain="POINT")
    for i, c in enumerate(cols):
        attr.data[i].color = (c[0], c[1], c[2], 1.0)
    mesh.materials.append(material)
    for p in mesh.polygons:
        p.use_smooth = smooth
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def _hue_rgb(h):
    """A saturated spectrum, so the filaments are unmistakably different."""
    h = h % 1.0
    r = abs(h * 6.0 - 3.0) - 1.0
    g = 2.0 - abs(h * 6.0 - 2.0)
    b = 2.0 - abs(h * 6.0 - 4.0)
    return (min(1.0, max(0.0, r)), min(1.0, max(0.0, g)), min(1.0, max(0.0, b)))


# ------------------------------------------------------------------- the swarm
#
# What a pyrefly actually is, from the reference: not a body at all.
#
# It is a curving trail of small separate grains of light. A hot white point at
# the head, and behind it a chain of specks that shifts through cyan, green and
# blue into violet as it falls away, spreading wider as it goes, the whole
# thing arcing over and down. Everything before this was a solid form with a
# skin on it — a fish, a dart, a raindrop — and no amount of shading could
# have made any of them read as this, because the subject is granular and they
# were continuous.


def _path(t, scale=6.0):
    """The arc the trail follows.

    Read straight off the reference: it leaves the head climbing to the right,
    turns over the top, and falls away — so it is a curve with a real
    inflection in it, not a bent line.
    """
    x = scale * (1.35 * t - 0.16 * math.sin(math.pi * t))
    z = scale * (0.62 * math.sin(math.pi * (0.62 * t + 0.05)) - 0.42 * t * t)
    y = scale * 0.10 * math.sin(math.pi * 1.7 * t)
    return (x, y, z)


def _trail_colour(t):
    """Hot white at the head, running out through the spectrum to violet."""
    # Saturated, and with the green given real estate of its own. The first
    # pass ran white straight into pale blue and the middle of the trail — the
    # part the reference is most identifiable by — came out as a wash.
    stops = [
        (0.00, (1.00, 0.90, 0.58)),
        (0.05, (1.00, 1.00, 0.98)),
        (0.13, (0.26, 1.00, 1.00)),   # cyan
        (0.27, (0.24, 1.00, 0.44)),   # green
        (0.42, (0.30, 0.98, 0.86)),   # back through cyan
        (0.58, (0.34, 0.66, 1.00)),   # blue
        (0.78, (0.56, 0.42, 1.00)),   # violet
        (1.00, (0.40, 0.20, 0.96)),
    ]
    for i in range(len(stops) - 1):
        a, ca = stops[i]
        b, cb = stops[i + 1]
        if a <= t <= b:
            u = (t - a) / (b - a) if b > a else 0.0
            return tuple(ca[k] + (cb[k] - ca[k]) * u for k in range(3))
    return stops[-1][1]


def build_swarm(grains=340, scale=6.0, seed=4, spread=0.055, grain=0.052):
    """The chain of specks.

    Each grain is a small block, not a sphere: in the reference they are
    visibly angular — the trail looks pixelated, and smoothing that away loses
    the thing that makes it read as a swarm rather than as a smear.
    """
    rnd = random.Random(seed)
    verts, faces, cols = [], [], []

    for i in range(grains):
        # biased toward the head, where the reference is densest
        t = (i / grains) ** 1.25
        px, py, pz = _path(t, scale)
        # the cloud opens out as the trail falls behind
        r = scale * spread * (0.18 + 1.5 * t ** 1.25)
        ox = rnd.gauss(0.0, r)
        oy = rnd.gauss(0.0, r * 0.9)
        oz = rnd.gauss(0.0, r)
        size = scale * grain * rnd.uniform(0.45, 1.5) * (1.0 - 0.35 * t)
        colour = _trail_colour(t)
        # brighter near the head, and every grain a little different
        f = (0.34 + 0.52 * _pos(1.0 - t) ** 0.8) * rnd.uniform(0.55, 1.25)
        c = (colour[0] * f, colour[1] * f, colour[2] * f)

        cx, cy, cz = px + ox, py + oy, pz + oz
        h = size * 0.5
        base = len(verts)
        for sx in (-h, h):
            for sy in (-h, h):
                for sz in (-h, h):
                    verts.append((cx + sx, cy + sy, cz + sz))
                    cols.append(c)
        # 0:--- 1:--+ 2:-+- 3:-++ 4:+-- 5:+-+ 6:++- 7:+++
        for quad in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
                     (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
            faces.append([base + q for q in quad])
    return verts, faces, cols


def build_head_point(scale=6.0, r=0.10, seg=18, rings=12):
    """The hot point the trail is leaving behind."""
    verts, faces, cols = [], [], []
    px, py, pz = _path(0.0, scale)
    rr = scale * r
    for i in range(rings + 1):
        phi = math.pi * i / rings
        for j in range(seg):
            a = TAU * j / seg
            verts.append((px + rr * math.sin(phi) * math.cos(a),
                          py + rr * math.sin(phi) * math.sin(a),
                          pz + rr * math.cos(phi)))
            cols.append((1.0, 0.97, 0.86))
    for i in range(rings):
        for j in range(seg):
            p = i * seg + j
            q = i * seg + (j + 1) % seg
            faces.append([p, q, q + seg, p + seg])
    return verts, faces, cols


def _iridescent(name, strength=6.0, alpha=0.6):
    """Colour that depends on the angle the surface is seen at.

    This is what a veil of light does, and it is why every earlier attempt
    missed: they painted a rainbow *onto* a shape, so the colours were nailed
    to the geometry. Here the hue is a function of how square-on the surface is
    to the lens, exactly as in a soap film — the bands live on the surface,
    slide as it turns, and read as light rather than as pigment.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = strength

    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.location = (-1100, 0)
    lw.inputs["Blend"].default_value = 0.5

    spread = nt.nodes.new("ShaderNodeMath")
    spread.operation = "MULTIPLY"
    spread.location = (-920, 120)
    # Several turns of hue across the surface. At 1.9 only a narrow band
    # of the spectrum ever appeared and the veil read as mother-of-pearl
    # rather than as a rainbow.
    spread.inputs[1].default_value = 3.4
    nt.links.new(lw.outputs["Facing"], spread.inputs[0])

    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-740, 120)
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.98, 0.34, 0.86, 1.0)     # magenta at the rim
    cr.elements[1].position = 1.0
    cr.elements[1].color = (0.98, 0.60, 0.95, 1.0)
    for pos, col in ((0.18, (0.44, 0.42, 1.00, 1.0)),   # violet-blue
                     (0.36, (0.34, 0.92, 1.00, 1.0)),   # cyan
                     (0.54, (0.44, 1.00, 0.60, 1.0)),   # green
                     (0.72, (1.00, 0.92, 0.52, 1.0))):  # gold
        cr.elements.new(pos).color = col
    nt.links.new(spread.outputs["Value"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], emit.inputs["Color"])

    # densest at grazing angles, like any thin film seen edge-on
    fres = nt.nodes.new("ShaderNodeMath")
    fres.operation = "POWER"
    fres.location = (-920, -220)
    fres.inputs[1].default_value = 1.5
    nt.links.new(lw.outputs["Fresnel"], fres.inputs[0])
    gain = nt.nodes.new("ShaderNodeMath")
    gain.operation = "MULTIPLY"
    gain.location = (-740, -220)
    gain.inputs[1].default_value = alpha
    nt.links.new(fres.outputs["Value"], gain.inputs[0])
    nt.links.new(gain.outputs["Value"], mix.inputs["Fac"])

    nt.links.new(trans.outputs[0], mix.inputs[1])
    nt.links.new(emit.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return mat


# ------------------------------------------------------------------- the braid
def build_filaments(count=16, length=9.0, seed=3, seg=7, twist=3.6):
    """The tail: filaments spiralling around the axis of travel.

    Each strand starts almost on the axis, just behind the head, and works
    outward as it falls behind, so the braid opens into a fan. The strands are
    given different rates so they cross rather than running parallel — parallel
    strands read as a comb.
    """
    rnd = random.Random(seed)
    verts, faces, cols = [], [], []
    steps = 30

    for k in range(count):
        phase = TAU * k / count + rnd.uniform(-0.12, 0.12)
        rate = twist * rnd.uniform(0.75, 1.35)
        # A tight braid. At three times this the strands swung out into a
        # jellyfish — the reference's tail stays close to its own axis, and the
        # fan is only ever a suggestion.
        flare = rnd.uniform(0.34, 0.88)
        hue = (k / count + rnd.uniform(-0.03, 0.03)) % 1.0
        colour = _hue_rgb(hue)
        wob = rnd.uniform(0.6, 1.6)

        base = len(verts)
        for i in range(steps + 1):
            t = i / steps
            # along the axis, falling behind the head
            z = 0.55 - length * (t ** 0.92)
            # spiralling out
            r = 0.08 + 1.05 * flare * (t ** 0.85)
            a = phase + rate * t + math.sin(t * 3.1 * wob) * 0.28
            cx = math.cos(a) * r
            cy = math.sin(a) * r
            # thickness: fattest a third of the way down, gone at the tip
            w = 0.082 * math.sin(math.pi * min(1.0, t * 1.08)) ** 0.55
            w *= (1.0 - t) ** 0.30
            w = max(1e-4, w)
            for j in range(seg):
                aa = TAU * j / seg
                verts.append((cx + math.cos(aa) * w, cy + math.sin(aa) * w, z))
                # brightness falls along the strand, so the braid fades out
                # flatter than a straight falloff, so the tip still has
                # colour left in it rather than fading to nothing
                f = 0.38 + 0.62 * (1.0 - t) ** 0.85
                cols.append((colour[0] * f, colour[1] * f, colour[2] * f))
        for i in range(steps):
            for j in range(seg):
                p = base + i * seg + j
                q = base + i * seg + (j + 1) % seg
                faces.append([p, q, q + seg, p + seg])
    return verts, faces, cols


def build_head(r=0.62, stretch=1.85, rings=22, seg=28):
    """An ellipsoid, drawn out along the direction of travel."""
    verts, faces, cols = [], [], []
    for i in range(rings + 1):
        phi = math.pi * i / rings
        sp, cp = math.sin(phi), math.cos(phi)
        for j in range(seg):
            th = TAU * j / seg
            verts.append((r * sp * math.cos(th), r * sp * math.sin(th),
                          r * stretch * cp))
            cols.append((1.0, 1.0, 1.0))
    for i in range(rings):
        for j in range(seg):
            p = i * seg + j
            q = i * seg + (j + 1) % seg
            faces.append([p, q, q + seg, p + seg])
    return verts, faces, cols


# ---------------------------------------------------------------- the surfaces
def _emissive(name, strength, tint=(1.0, 1.0, 1.0), facing=1.6, use_attr=True,
              soft=True):
    """Emission that dissolves where the surface turns away from the lens.

    This is the single most important trick in the whole file. A glowing thing
    with a crisp silhouette reads as a plastic model of a glowing thing; fading
    the surface out as it becomes edge-on is what a volume of light does, and
    it costs one Layer Weight node.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    trans = nt.nodes.new("ShaderNodeBsdfTransparent")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = strength

    if use_attr:
        attr = nt.nodes.new("ShaderNodeAttribute")
        attr.attribute_name = "hue"
        attr.location = (-900, 120)
        tintn = nt.nodes.new("ShaderNodeMix")
        tintn.data_type = "RGBA"
        tintn.blend_type = "MULTIPLY"
        tintn.location = (-700, 120)
        tintn.inputs[0].default_value = 1.0
        tintn.inputs[7].default_value = (*tint, 1.0)
        nt.links.new(attr.outputs["Color"], tintn.inputs[6])
        nt.links.new(tintn.outputs[2], emit.inputs["Color"])
    else:
        emit.inputs["Color"].default_value = (*tint, 1.0)

    if soft:
        lw = nt.nodes.new("ShaderNodeLayerWeight")
        lw.location = (-900, -200)
        lw.inputs["Blend"].default_value = 0.5
        pw = nt.nodes.new("ShaderNodeMath")
        pw.operation = "POWER"
        pw.location = (-700, -200)
        pw.inputs[1].default_value = facing
        nt.links.new(lw.outputs["Facing"], pw.inputs[0])
        nt.links.new(pw.outputs["Value"], mix.inputs["Fac"])
    else:
        mix.inputs["Fac"].default_value = 1.0

    nt.links.new(trans.outputs[0], mix.inputs[1])
    nt.links.new(emit.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    return mat


def _volume_glow(name, colour, density=2.4, falloff=2.2):
    """A real volumetric halo.

    Two attempts at this were surfaces — a big transparent shell round the
    core — and both drew their own outline: the first as dark rings, the
    second as a pink doughnut. A surface always has a silhouette, however it
    is shaded. A volume does not, so this is a volume: emission distributed
    through a ball, densest at the centre and falling off to nothing well
    inside the mesh, so the bounding sphere is never visible.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*colour, 1.0)

    coord = nt.nodes.new("ShaderNodeTexCoord")
    coord.location = (-1000, 0)
    off = nt.nodes.new("ShaderNodeVectorMath")
    off.operation = "SUBTRACT"
    off.location = (-820, 0)
    off.inputs[1].default_value = (0.5, 0.5, 0.5)
    nt.links.new(coord.outputs["Generated"], off.inputs[0])
    rad = nt.nodes.new("ShaderNodeVectorMath")
    rad.operation = "LENGTH"
    rad.location = (-660, 0)
    nt.links.new(off.outputs["Vector"], rad.inputs[0])
    twice = nt.nodes.new("ShaderNodeMath")
    twice.operation = "MULTIPLY"
    twice.location = (-500, 0)
    twice.inputs[1].default_value = 2.0
    nt.links.new(rad.outputs["Value"], twice.inputs[0])
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.location = (-340, 0)
    inv.inputs[0].default_value = 1.0
    nt.links.new(twice.outputs["Value"], inv.inputs[1])
    clamp = nt.nodes.new("ShaderNodeClamp")
    clamp.location = (-200, 0)
    nt.links.new(inv.outputs["Value"], clamp.inputs["Value"])
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.location = (-60, 0)
    pw.inputs[1].default_value = falloff
    nt.links.new(clamp.outputs["Result"], pw.inputs[0])
    gain = nt.nodes.new("ShaderNodeMath")
    gain.operation = "MULTIPLY"
    gain.location = (80, 0)
    gain.inputs[1].default_value = density
    nt.links.new(pw.outputs["Value"], gain.inputs[0])
    nt.links.new(gain.outputs["Value"], emit.inputs["Strength"])
    nt.links.new(emit.outputs[0], out.inputs["Volume"])
    return mat


def solo(seed=4, scale=6.0, grains=340):
    """One pyrefly, alone, on black."""
    _reset()

    # Dim. Every grain carries its own colour in a vertex attribute, and at
    # 22 each one clipped to white before that colour could survive the
    # transform — the trail had the right shape and none of its spectrum.
    grain_mat = _emissive("PyreGrain", 1.9, use_attr=True, soft=False)
    head_mat = _emissive("PyreHeadPt", 28.0, tint=(1.0, 0.96, 0.84),
                         use_attr=False, soft=False)
    # the big soft bloom the reference has sitting around the head — a volume,
    # so it has no edge of its own
    halo_mat = _volume_glow("PyreHalo", (0.72, 0.86, 0.92), density=0.55,
                            falloff=2.0)

    v, f, c = build_swarm(grains=grains, scale=scale, seed=seed)
    _mesh_from("Swarm", v, f, c, grain_mat, smooth=False)

    v, f, c = build_head_point(scale=scale)
    _mesh_from("HeadPoint", v, f, c, head_mat)

    v, f, c = build_head_point(scale=scale, r=0.62, seg=20, rings=14)
    _mesh_from("Halo", v, f, c, halo_mat)

    world = bpy.data.worlds.new("Black")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.0, 0.0, 0.0, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    return {"grains": grains}


def render(path, width=1000, height=1000, samples=256,
           cam=(16.0, -23.0, 7.0), look=(0.0, 0.0, -4.0), lens=80.0):
    from mathutils import Vector
    sc = bpy.context.scene
    cd = bpy.data.cameras.new("C")
    cd.lens = lens
    c = bpy.data.objects.new("C", cd)
    sc.collection.objects.link(c)
    sc.camera = c
    c.location = cam
    d = Vector(look) - Vector(cam)
    c.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.transparent_max_bounces = 64
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.render.image_settings.file_format = "PNG"
    # Standard, not AgX.
    #
    # This is the answer to every "why is it white" in this file. AgX is built
    # to desaturate highlights on their way to white — which is right for a
    # photographic render and exactly wrong for a thing whose entire subject is
    # the colour of its own light. Under AgX no amount of saturation in the
    # shader survives, because the transform removes it at the end. Standard
    # keeps the hue; the rolloff is handled afterwards in the bloom pass.
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.exposure = -0.2
    sc.render.filepath = path
    return path
