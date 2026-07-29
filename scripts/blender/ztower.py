# -----------------------------------------------------------------------------
# One Zanarkand tower, built properly.
#
# The city generator so far has been making buildings out of a handful of
# stacked revolves and colouring them flat, and no amount of camera work fixes
# that — at any distance where a building fills more than a few hundred pixels,
# what reads is *ornament*: mouldings, dentils, balustrades, window reveals,
# the ribs on a dome. Those are what the eye uses to judge scale and age, and
# there were none of them.
#
# So this file does the opposite of the last one. It builds a single tower and
# spends everything on it. Once it holds up, the city generator stops modelling
# buildings and starts placing copies of this with different parameters — which
# is what kitbashing is, and it is how the detail gets amortised.
#
# Nothing here is textured. All of the surface variation comes from geometry
# plus a Cycles material that reads mesh curvature, so there is no UV work and
# no image to ship — and the same trick survives the trip to glTF as baked
# vertex colour if it has to.
# -----------------------------------------------------------------------------
import bpy
import math
import random
from mathutils import Vector, Euler, Matrix

TAU = math.pi * 2


# ------------------------------------------------------------------ scaffolding
class Part:
    """Geometry for one material, emitted as a single mesh."""

    def __init__(self, name, material=None):
        self.name = name
        self.material = material
        self.verts = []
        self.faces = []

    def push(self, verts, faces):
        o = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend([[i + o for i in f] for f in faces])

    def build(self, collection, smooth_angle=None):
        if not self.verts:
            return None
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.validate()
        if self.material:
            mesh.materials.append(self.material)
        mesh.update()
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)
        if smooth_angle:
            # Shade smooth, but keep hard edges where the model means them —
            # a moulding that has been smoothed across its arris stops being a
            # moulding and becomes a bulge.
            for poly in mesh.polygons:
                poly.use_smooth = True
            mod = obj.modifiers.new("Smooth", "SMOOTH_BY_ANGLE") if hasattr(
                bpy.types, "SmoothByAngleModifier") else None
            if mod is None:
                try:
                    obj.data.use_auto_smooth = True
                    obj.data.auto_smooth_angle = math.radians(smooth_angle)
                except Exception:
                    pass
        return obj


def revolve(part, profile, segments=48, cx=0.0, cy=0.0, z0=0.0, phase=0.0,
            cap_bottom=False, cap_top=False, arc=None, scallop=None):
    """Spin a (radius, height) profile around the vertical axis.

    `scallop=(count, depth)` modulates the radius with the angle, which is how
    a fluted shaft is actually made: the flutes are *in* the drum. The first
    version stuck separate thin boxes on the outside of a smooth cylinder and
    they read as a bundle of sticks leaning against a pipe — which, modelled
    literally, is what they were.
    """
    n = len(profile)
    closed = arc is None
    a0, a1 = (0.0, TAU) if closed else arc
    cols = segments if closed else segments + 1
    verts, faces = [], []
    for (r, z) in profile:
        for j in range(cols):
            a = phase + a0 + (a1 - a0) * (j / segments)
            rr = r
            if scallop:
                count, depth = scallop
                rr = r * (1.0 - depth * abs(math.sin(a * count * 0.5)) ** 0.7)
            verts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr, z0 + z))
    for i in range(n - 1):
        for j in range(segments):
            p = i * cols + j
            q = i * cols + (j + 1) % cols
            faces.append([p, q, q + cols, p + cols])
    if cap_top and closed and profile[-1][0] > 1e-4:
        c = len(verts)
        verts.append((cx, cy, z0 + profile[-1][1]))
        base = (n - 1) * cols
        for j in range(segments):
            faces.append([base + j, base + (j + 1) % cols, c])
    if cap_bottom and closed and profile[0][0] > 1e-4:
        c = len(verts)
        verts.append((cx, cy, z0 + profile[0][1]))
        for j in range(segments):
            faces.append([c, (j + 1) % cols, j])
    part.push(verts, faces)


def box(part, center, size, rot=(0, 0, 0), taper=1.0):
    sx, sy, sz = size
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    tx, ty = hx * taper, hy * taper
    local = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
             (-tx, -ty, hz), (tx, -ty, hz), (tx, ty, hz), (-tx, ty, hz)]
    e = Euler(rot, "XYZ")
    o = Vector(center)
    verts = []
    for p in local:
        v = Vector(p)
        v.rotate(e)
        verts.append(tuple(v + o))
    part.push(verts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1],
                      [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]])


def ring_of(fn, count, radius, z, phase=0.0, **kw):
    """Place something `count` times around a ring, facing outward."""
    for i in range(count):
        a = phase + TAU * i / count
        fn(math.cos(a) * radius, math.sin(a) * radius, z, a, **kw)


# ------------------------------------------------------------------- mouldings
# The vocabulary. Everything below is assembled out of these five profiles,
# which is roughly what a real cornice is: a stack of standard sections.

def torus_profile(r, w, h, steps=7):
    """A half-round bead standing proud of a wall."""
    out = []
    for i in range(steps + 1):
        t = math.pi * i / steps
        out.append((r + w * math.sin(t), -h * 0.5 + h * (i / steps)))
    return out


def ogee_profile(r0, r1, h, steps=8):
    """An S-curve between two radii — the workhorse transition."""
    out = []
    for i in range(steps + 1):
        t = i / steps
        s = t * t * (3 - 2 * t)
        out.append((r0 + (r1 - r0) * s, h * t))
    return out


def fillet(r, h):
    return [(r, 0.0), (r, h)]


def dentil_course(part, radius, z, count, w, d, h):
    """A row of little blocks under a cornice. Nothing says 'built' faster."""
    def one(x, y, zz, a):
        box(part, (x, y, zz), (d, w, h), rot=(0, 0, a))
    ring_of(one, count, radius, z)


def bracket_course(part, radius, z, count, w, d, h):
    """Corbels: brackets that carry the overhang, tapered so they read as
    supporting something rather than sticking out of the wall."""
    def one(x, y, zz, a):
        box(part, (x + math.cos(a) * d * 0.25, y + math.sin(a) * d * 0.25, zz),
            (d, w, h), rot=(0, 0, a), taper=0.55)
        box(part, (x + math.cos(a) * d * 0.5, y + math.sin(a) * d * 0.5, zz + h * 0.55),
            (d * 1.5, w * 1.6, h * 0.28), rot=(0, 0, a))
    ring_of(one, count, radius, z)


def pilasters(part, radius, z0, z1, count, proud, width, phase=0.0):
    """Flat strips standing off a wall, with a base and a capital.

    Not flutes — flutes are cut into the drum by `revolve(scallop=…)`. These
    are the wider vertical members that divide a facade into bays, and they
    need the base and cap or they read as tape stuck to the building.
    """
    h = z1 - z0

    def one(x, y, zz, a):
        box(part, (x, y, (z0 + z1) * 0.5), (proud, width, h), rot=(0, 0, a))
        box(part, (x, y, z0 + h * 0.02), (proud * 1.7, width * 1.5, h * 0.035),
            rot=(0, 0, a))
        box(part, (x, y, z1 - h * 0.02), (proud * 1.7, width * 1.5, h * 0.035),
            rot=(0, 0, a))
    ring_of(one, count, radius, 0.0, phase=phase)


def balustrade(part, radius, z, count, height, rail_h=0.22):
    """A parapet: bottom rail, turned balusters, top rail."""
    revolve(part, fillet(radius, rail_h), 48, z0=z)
    revolve(part, fillet(radius, rail_h), 48, z0=z + height - rail_h)
    revolve(part, torus_profile(radius, rail_h * 0.5, rail_h * 0.8),
            48, z0=z + height)
    bal = [(0.30, 0.0), (0.34, 0.06), (0.22, 0.16), (0.30, 0.30),
           (0.38, 0.46), (0.30, 0.62), (0.20, 0.76), (0.28, 0.90), (0.30, 1.0)]
    h = height - rail_h * 2

    def one(x, y, zz, a):
        revolve(part, [(r * height * 0.9, hh * h) for (r, hh) in bal],
                8, cx=x, cy=y, z0=z + rail_h)
    ring_of(one, count, radius, 0.0)


def arched_bay(part, glass, radius, z, height, width_a, phase, depth=0.5,
               segments=9, mullion=True):
    """A window: a reveal cut back into the wall, a round-arched head, a sill,
    and a lit pane behind the opening.

    The reveal is the whole point. A pane flush with the wall face reads as a
    decal at any distance; the same pane set back a metre behind an arched
    surround reads as a hole in a building with light coming out of it. Every
    piece here exists to make that depth visible from an oblique angle.
    """
    half = width_a * 0.5
    spring = z + height * 0.58
    head_h = height - (spring - z)
    inner = radius - depth * 2.2          # the plane the glass sits on
    jamb_w = radius * width_a * 0.16      # tangential thickness of the surround

    def arc_z(t):
        return spring + math.sin(math.pi * min(1.0, t)) * head_h * 0.92

    # ---- the surround, standing a little proud of the wall
    for s in (-1, 1):
        a = phase + s * half
        box(part, (math.cos(a) * (radius + depth * 0.3),
                   math.sin(a) * (radius + depth * 0.3), (z + spring) * 0.5),
            (depth * 1.4, jamb_w, spring - z), rot=(0, 0, a))
    for i in range(segments + 1):
        t = i / segments
        aa = phase - half + width_a * t
        box(part, (math.cos(aa) * (radius + depth * 0.3),
                   math.sin(aa) * (radius + depth * 0.3), arc_z(t)),
            (depth * 1.4, jamb_w * 1.05, height * 0.085), rot=(0, 0, aa))

    # ---- the reveal: short returns from the wall face back to the glass
    for s in (-1, 1):
        a = phase + s * half * 0.86
        box(part, ((math.cos(a) * (radius + inner) * 0.5),
                   (math.sin(a) * (radius + inner) * 0.5), (z + spring) * 0.5),
            (radius - inner, jamb_w * 0.5, spring - z), rot=(0, 0, a))

    # ---- sill
    sa = phase
    box(part, (math.cos(sa) * (radius + depth * 0.5),
               math.sin(sa) * (radius + depth * 0.5), z - height * 0.012),
        (depth * 2.2, radius * width_a * 1.25, height * 0.035), rot=(0, 0, sa))

    # ---- the pane
    for i in range(segments):
        t0, t1 = i / segments, (i + 1) / segments
        a0 = phase - half * 0.88 + width_a * 0.88 * t0
        a1 = phase - half * 0.88 + width_a * 0.88 * t1
        glass.push([
            (math.cos(a0) * inner, math.sin(a0) * inner, z + height * 0.03),
            (math.cos(a1) * inner, math.sin(a1) * inner, z + height * 0.03),
            (math.cos(a1) * inner, math.sin(a1) * inner, arc_z(t1) - height * 0.03),
            (math.cos(a0) * inner, math.sin(a0) * inner, arc_z(t0) - height * 0.03),
        ], [[0, 1, 2, 3]])

    # ---- a mullion and a transom, so the opening has a scale to be read at
    if mullion:
        box(part, (math.cos(phase) * (inner + depth * 0.4),
                   math.sin(phase) * (inner + depth * 0.4), (z + spring) * 0.5),
            (depth * 0.8, jamb_w * 0.5, spring - z), rot=(0, 0, phase))
        for i in range(segments):
            t = (i + 0.5) / segments
            aa = phase - half * 0.88 + width_a * 0.88 * t
            box(part, (math.cos(aa) * (inner + depth * 0.4),
                       math.sin(aa) * (inner + depth * 0.4), spring),
                (depth * 0.8, radius * width_a * 0.11, height * 0.022),
                rot=(0, 0, aa))


def dome_ribs(part, profile, count, width, proud, z0=0.0):
    """Meridional ribs over a dome. The single most recognisable thing about a
    Zanarkand roofline after its outline."""
    for k in range(count):
        a = TAU * k / count
        prev = None
        for (r, z) in profile:
            if r < 1e-3:
                continue
            p = (math.cos(a) * (r + proud), math.sin(a) * (r + proud), z0 + z)
            if prev is not None:
                d = Vector(p) - Vector(prev)
                if d.length > 1e-4:
                    box(part, tuple((Vector(p) + Vector(prev)) * 0.5),
                        (width, width * 0.6, d.length),
                        rot=tuple(d.to_track_quat("Z", "Y").to_euler()))
            prev = p


ONION = [
    (1.00, 0.00), (1.13, 0.09), (1.19, 0.21), (1.14, 0.33), (1.01, 0.45),
    (0.82, 0.57), (0.60, 0.69), (0.38, 0.80), (0.19, 0.89), (0.07, 0.96),
    (0.00, 1.00),
]


def onion(radius, height, z0=0.0):
    return [(radius * r, z0 + height * h) for (r, h) in ONION]


# ------------------------------------------------------------------- the tower
def build_tower(P, H=200.0, R=14.0, seed=1, segments=56):
    """The whole thing, bottom to top."""
    rnd = random.Random(seed)
    stone, trim, glass, metal = P["stone"], P["trim"], P["glass"], P["metal"]

    z = 0.0
    # ---- plinth: three steps, each with a small chamfer ---------------------
    for i, (rr, hh) in enumerate(((1.62, 0.012), (1.48, 0.011), (1.36, 0.010))):
        revolve(stone, [(R * rr, 0.0), (R * rr, H * hh), (R * rr * 0.985, H * hh)],
                segments, z0=z, cap_bottom=(i == 0))
        z += H * hh
    revolve(trim, torus_profile(R * 1.34, R * 0.05, H * 0.010), segments, z0=z)

    # ---- podium: a plain drum between two mouldings, with a dentil course ---
    podium_h = H * 0.075
    revolve(stone, fillet(R * 1.22, podium_h), segments, z0=z)
    dentil_course(trim, R * 1.25, z + podium_h * 0.86, 44,
                  w=R * 0.10, d=R * 0.09, h=H * 0.010)
    revolve(trim, ogee_profile(R * 1.28, R * 1.10, H * 0.020), segments,
            z0=z + podium_h)
    z += podium_h + H * 0.020

    # ---- lower shaft: fluted, two courses of bays ---------------------------
    shaft_h = H * 0.26
    # The drum itself is fluted — 120 segments so each flute has a proper
    # curved section rather than a facet.
    revolve(stone, fillet(R * 1.06, shaft_h), 120, z0=z, scallop=(24, 0.035))
    pilasters(trim, R * 1.07, z + shaft_h * 0.03, z + shaft_h * 0.97, 8,
              proud=R * 0.06, width=R * 0.16, phase=TAU / 16)
    for course in range(2):
        zz = z + shaft_h * (0.14 + 0.44 * course)
        for k in range(8):
            arched_bay(trim, glass, R * 1.06, zz, shaft_h * 0.32, 0.46,
                       phase=TAU * k / 8, depth=R * 0.05)
    z += shaft_h

    # ---- first balcony ------------------------------------------------------
    revolve(trim, ogee_profile(R * 1.08, R * 1.34, H * 0.016), segments, z0=z)
    bracket_course(trim, R * 1.30, z + H * 0.008, 24,
                   w=R * 0.13, d=R * 0.16, h=H * 0.018)
    z += H * 0.026
    revolve(stone, fillet(R * 1.42, H * 0.010), segments, z0=z, cap_top=False)
    balustrade(trim, R * 1.40, z + H * 0.010, 56, H * 0.030)
    z += H * 0.010

    # ---- upper shaft: narrower, ribbed, one course of taller bays -----------
    up_h = H * 0.22
    revolve(stone, ogee_profile(R * 1.02, R * 0.92, up_h), 120, z0=z,
            scallop=(18, 0.030))
    pilasters(trim, R * 0.99, z + up_h * 0.04, z + up_h * 0.96, 6,
              proud=R * 0.055, width=R * 0.15, phase=TAU / 12)
    for k in range(6):
        arched_bay(trim, glass, R * 0.96, z + up_h * 0.20, up_h * 0.50, 0.52,
                   phase=TAU * k / 6, depth=R * 0.045)
    z += up_h

    # ---- cornice ------------------------------------------------------------
    bracket_course(trim, R * 0.94, z + H * 0.010, 20,
                   w=R * 0.14, d=R * 0.18, h=H * 0.020)
    revolve(trim, ogee_profile(R * 0.92, R * 1.16, H * 0.018), segments, z0=z + H * 0.020)
    dentil_course(trim, R * 1.10, z + H * 0.030, 36,
                  w=R * 0.10, d=R * 0.10, h=H * 0.009)
    revolve(stone, fillet(R * 1.20, H * 0.012), segments, z0=z + H * 0.038)
    z += H * 0.050

    # ---- arcade drum: a ring of open arches on little columns ---------------
    arc_h = H * 0.085
    revolve(stone, fillet(R * 0.80, arc_h), segments, z0=z)
    for k in range(10):
        arched_bay(trim, glass, R * 0.80, z + arc_h * 0.10, arc_h * 0.80, 0.50,
                   phase=TAU * k / 10, depth=R * 0.038, mullion=False)

    def colonnette(x, y, zz, a):
        revolve(trim, [(R * 0.045, 0.0), (R * 0.055, arc_h * 0.06),
                       (R * 0.040, arc_h * 0.14), (R * 0.038, arc_h * 0.80),
                       (R * 0.052, arc_h * 0.88), (R * 0.062, arc_h * 0.95),
                       (R * 0.048, arc_h)], 10, cx=x, cy=y, z0=z)
    ring_of(colonnette, 12, R * 0.86, 0.0, phase=TAU / 24)
    revolve(trim, ogee_profile(R * 0.82, R * 0.98, H * 0.014), segments, z0=z + arc_h)
    z += arc_h + H * 0.014

    # ---- the dome -----------------------------------------------------------
    dome_h = H * 0.15
    prof = onion(R * 0.86, dome_h)
    revolve(stone, prof, segments, z0=z)
    dome_ribs(trim, prof, 16, R * 0.055, R * 0.020, z0=z)
    revolve(trim, torus_profile(R * 0.86, R * 0.05, H * 0.012), segments, z0=z)
    z += dome_h

    # ---- lantern and finial -------------------------------------------------
    lan_h = H * 0.055
    revolve(stone, fillet(R * 0.20, lan_h), 24, z0=z)
    for k in range(6):
        arched_bay(trim, glass, R * 0.20, z + lan_h * 0.12, lan_h * 0.70, 0.62,
                   phase=TAU * k / 6, depth=R * 0.022, segments=5, mullion=False)
    revolve(trim, ogee_profile(R * 0.22, R * 0.30, H * 0.010), 24, z0=z + lan_h)
    z += lan_h + H * 0.010
    lp = onion(R * 0.28, H * 0.05)
    revolve(stone, lp, 24, z0=z)
    dome_ribs(trim, lp, 8, R * 0.030, R * 0.012, z0=z)
    z += H * 0.05
    revolve(metal, [(R * 0.05, 0.0), (R * 0.07, H * 0.006), (R * 0.03, H * 0.020),
                    (R * 0.045, H * 0.030), (R * 0.012, H * 0.055),
                    (R * 0.004, H * 0.10)], 12, z0=z, cap_top=True)
    return z + H * 0.10


# ----------------------------------------------------------------- the surface
def make_materials():
    """Cycles materials with no textures and no UVs.

    All of the surface interest comes from `Geometry > Pointiness`, which reads
    mesh curvature: convex edges get lighter and drier, concave corners collect
    dirt. On a model made of mouldings that is exactly where wear would be, and
    it costs nothing to author and nothing to ship.
    """
    def base(name, color, rough, metal=0.0, dirt=0.55):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        bsdf.inputs["Metallic"].default_value = metal

        geo = nt.nodes.new("ShaderNodeNewGeometry")
        geo.location = (-1000, 200)
        cur = nt.nodes.new("ShaderNodeMapRange")
        cur.location = (-820, 200)
        cur.inputs["From Min"].default_value = 0.42
        cur.inputs["From Max"].default_value = 0.58
        nt.links.new(geo.outputs["Pointiness"], cur.inputs["Value"])

        noise = nt.nodes.new("ShaderNodeTexNoise")
        noise.location = (-1000, -120)
        noise.inputs["Scale"].default_value = 5.0
        noise.inputs["Detail"].default_value = 8.0

        mixn = nt.nodes.new("ShaderNodeMix")
        mixn.data_type = "RGBA"
        mixn.location = (-620, 200)
        mixn.inputs[0].default_value = dirt
        # dark, cool grime in the crevices; bleached stone on the arrises
        # A wide spread between the two. With a dark base colour, a 1.25x
        # arris is invisible; the ornament only reads if the edges are several
        # times brighter than the hollows they sit between.
        mixn.inputs[6].default_value = (color[0] * 0.42, color[1] * 0.48,
                                        color[2] * 0.55, 1.0)
        mixn.inputs[7].default_value = (min(1, color[0] * 3.4),
                                        min(1, color[1] * 3.0),
                                        min(1, color[2] * 2.7), 1.0)
        nt.links.new(cur.outputs["Result"], mixn.inputs[0])
        nt.links.new(mixn.outputs[2], bsdf.inputs["Base Color"])

        rmix = nt.nodes.new("ShaderNodeMapRange")
        rmix.location = (-620, -60)
        rmix.inputs["To Min"].default_value = min(1.0, rough + 0.12)
        rmix.inputs["To Max"].default_value = max(0.05, rough - 0.14)
        nt.links.new(cur.outputs["Result"], rmix.inputs["Value"])
        nt.links.new(rmix.outputs["Result"], bsdf.inputs["Roughness"])

        bump = nt.nodes.new("ShaderNodeBump")
        bump.location = (-400, -260)
        bump.inputs["Strength"].default_value = 0.22
        nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        return mat

    # The palette.
    #
    # Zanarkand is not grey. It is a dark blue-green city — verdigris and wet
    # slate — with warm light inside it and cold light on its public
    # structure, and the contrast between those two is most of its character.
    # The renders up to here were all one warm brown because the stone had no
    # hue to lose, so the sunset supplied all of it.
    stone = base("TowerStone", (0.062, 0.086, 0.084), 0.80, dirt=0.66)
    trim = base("TowerTrim", (0.055, 0.115, 0.112), 0.42, metal=0.55, dirt=0.52)
    metal = base("TowerMetal", (0.34, 0.30, 0.17), 0.26, metal=0.95, dirt=0.40)

    # Two window colours out of one material: the emission is tinted by object
    # position through a noise, so one facade has warm rooms among cold ones
    # without needing a second mesh.
    glass = bpy.data.materials.new("TowerGlass")
    glass.use_nodes = True
    nt = glass.node_tree
    g = nt.nodes["Principled BSDF"]
    g.inputs["Base Color"].default_value = (0.10, 0.16, 0.20, 1.0)
    g.inputs["Roughness"].default_value = 0.16

    obj = nt.nodes.new("ShaderNodeTexCoord")
    obj.location = (-1000, -200)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-820, -200)
    noise.inputs["Scale"].default_value = 24.0
    noise.inputs["Detail"].default_value = 2.0
    nt.links.new(obj.outputs["Object"], noise.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.location = (-620, -200)
    ramp.color_ramp.interpolation = "CONSTANT"
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.42, 0.86, 1.00, 1.0)
    e = ramp.color_ramp.elements.new(0.46)
    e.color = (1.00, 0.66, 0.28, 1.0)
    e2 = ramp.color_ramp.elements.new(0.78)
    e2.color = (0.30, 0.72, 0.95, 1.0)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    for key in ("Emission Color", "Emission"):
        if key in g.inputs:
            nt.links.new(ramp.outputs["Color"], g.inputs[key])
            break
    if "Emission Strength" in g.inputs:
        # Bright. These are small, deeply recessed panes seen from outside at
        # an angle — most of what they emit never reaches the camera, so at a
        # strength that looks sane in isolation the building reads as unlit.
        g.inputs["Emission Strength"].default_value = 30.0
    return {"stone": stone, "trim": trim, "glass": glass, "metal": metal}


def reset():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras,
                  bpy.data.lights, bpy.data.worlds):
        for item in list(block):
            block.remove(item)


def build(H=200.0, R=14.0, seed=1):
    reset()
    mats = make_materials()
    P = {k: Part(k.capitalize(), m) for k, m in mats.items()}
    top = build_tower(P, H=H, R=R, seed=seed)
    coll = bpy.context.scene.collection
    objs = [p.build(coll, smooth_angle=32) for p in P.values()]
    return {p.name: len(p.verts) for p in P.values()}, top
