# -----------------------------------------------------------------------------
# Zanarkand blitzball stadium — procedural generator for ryomak.jp
#
# One building, alone on the water, with the sphere pool held above its bowl.
# The camera orbits it; the only other geometry is a silhouette of the city on
# the far horizon, there purely to give the stadium a scale to be read against.
#
# Everything is authored twice over the same skeleton:
#   RUIN     — what survives a thousand years later (stone / dark / metal / emit)
#   RESTORED — the cladding and light that were lost (clad / neon)
# The web renderer raises a world-space front through the RESTORED layers as the
# page scrolls, so the stadium rebuilds itself from the waterline up.
#
# Blender is Z-up and the stadium sits at the origin; water level is Z=0.
# glTF export flips to Y-up, so three.js sees (x, z, -y).
# -----------------------------------------------------------------------------
import bpy
import math
import random
from mathutils import Vector, Euler

SEED = 20260726
TAU = math.pi * 2
STADIUM_R = 58.0   # outer radius of the bowl
POOL_R = 21.0      # radius of the water sphere
POOL_Z = 25.0      # height of its centre — it nestles down inside the bowl


# ----------------------------------------------------------------- scene reset
def reset_scene():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def make_material(name, color, rough=0.9, metal=0.0, emit=None, emit_strength=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = (*emit, 1.0)
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat


# --------------------------------------------------------------- mesh builders
class Part:
    """Accumulates geometry for one material, emitted as a single mesh object."""

    def __init__(self, name, material, smooth=False):
        self.name = name
        self.material = material
        self.smooth = smooth
        self.verts = []
        self.faces = []

    def push(self, verts, faces):
        o = len(self.verts)
        self.verts.extend(verts)
        self.faces.extend([[i + o for i in f] for f in faces])

    def quad(self, a, b, c, d):
        self.push([a, b, c, d], [[0, 1, 2, 3]])

    def box(self, center, size, rot=(0, 0, 0), taper=1.0, taper_y=None, base_pivot=False):
        sx, sy, sz = size
        hx, hy = sx * 0.5, sy * 0.5
        tx = hx * taper
        ty = hy * (taper if taper_y is None else taper_y)
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
        self.push(verts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1],
                          [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]])

    def prism(self, center, r_bot, r_top, height, segments=8, rot=(0, 0, 0),
              phase=0.0, base_pivot=True, hollow=None):
        zlo, zhi = (0.0, height) if base_pivot else (-height * 0.5, height * 0.5)
        euler = Euler(rot, "XYZ")
        origin = Vector(center)

        def place(p):
            v = Vector(p)
            v.rotate(euler)
            return tuple(v + origin)

        verts, faces = [], []
        for i in range(segments):
            a0 = phase + TAU * i / segments
            a1 = phase + TAU * (i + 1) / segments
            if hollow is not None and not (hollow[0] <= ((a0 + a1) * 0.5 - phase) % TAU <= hollow[1]):
                continue
            base = len(verts)
            verts.extend([
                place((math.cos(a0) * r_bot, math.sin(a0) * r_bot, zlo)),
                place((math.cos(a1) * r_bot, math.sin(a1) * r_bot, zlo)),
                place((math.cos(a1) * r_top, math.sin(a1) * r_top, zhi)),
                place((math.cos(a0) * r_top, math.sin(a0) * r_top, zhi)),
            ])
            faces.append([base, base + 1, base + 2, base + 3])
        self.push(verts, faces)

    def sphere(self, center, radius, rings=20, segments=32):
        cx, cy, cz = center
        verts, faces = [], []
        for i in range(rings + 1):
            phi = math.pi * i / rings
            sp, cp = math.sin(phi), math.cos(phi)
            for j in range(segments):
                th = TAU * j / segments
                verts.append((cx + radius * sp * math.cos(th),
                              cy + radius * sp * math.sin(th),
                              cz + radius * cp))
        for i in range(rings):
            for j in range(segments):
                faces.append([i * segments + j,
                              i * segments + (j + 1) % segments,
                              (i + 1) * segments + (j + 1) % segments,
                              (i + 1) * segments + j])
        self.push(verts, faces)

    def rounded_cube(self, center, half, roundness=0.26, n=18):
        """A cube whose edges are eased toward a sphere — the shape a contained
        volume of water actually takes. Vertices are welded across the six
        faces so it can be shaded smooth without seams."""
        cx, cy, cz = center
        index = {}
        verts, faces = [], []

        def vid(p):
            d = Vector(p).normalized()
            q = Vector(p) * (1.0 - roundness) + d * roundness
            key = (round(q.x, 5), round(q.y, 5), round(q.z, 5))
            if key not in index:
                index[key] = len(verts)
                verts.append((cx + q.x * half, cy + q.y * half, cz + q.z * half))
            return index[key]

        for axis in range(3):
            for sign in (-1, 1):
                for i in range(n):
                    for j in range(n):
                        corners = []
                        for du, dv in ((0, 0), (1, 0), (1, 1), (0, 1)):
                            u = -1.0 + 2.0 * (i + du) / n
                            v = -1.0 + 2.0 * (j + dv) / n
                            p = [0.0, 0.0, 0.0]
                            p[axis] = float(sign)
                            p[(axis + 1) % 3] = u
                            p[(axis + 2) % 3] = v
                            corners.append(vid(p))
                        faces.append(corners if sign > 0 else corners[::-1])
        self.push(verts, faces)

    def torus(self, center, radius, tube, rot=(0, 0, 0), major=28, minor=8):
        cx, cy, cz = center
        euler = Euler(rot, "XYZ")
        verts, faces = [], []
        for i in range(major):
            u = TAU * i / major
            for j in range(minor):
                v = TAU * j / minor
                p = Vector(((radius + tube * math.cos(v)) * math.cos(u),
                            (radius + tube * math.cos(v)) * math.sin(u),
                            tube * math.sin(v)))
                p.rotate(euler)
                verts.append((cx + p.x, cy + p.y, cz + p.z))
        for i in range(major):
            for j in range(minor):
                faces.append([i * minor + j,
                              i * minor + (j + 1) % minor,
                              ((i + 1) % major) * minor + (j + 1) % minor,
                              ((i + 1) % major) * minor + j])
        self.push(verts, faces)


    def slab(self, p0, p1, half_w0, half_w1, thick):
        """A flat plate segment between two centre points.

        The stadium's arms are broad horizontal fins, not tubes, so they are
        built from these rather than from beams: the width is what reads.
        """
        a, b = Vector(p0), Vector(p1)
        d = b - a
        if d.length < 1e-5:
            return
        # width runs horizontally, square to the direction of travel
        side = Vector((-d.y, d.x, 0.0))
        if side.length < 1e-5:
            side = Vector((1.0, 0.0, 0.0))
        side.normalize()
        up = Vector((0.0, 0.0, thick * 0.5))
        verts = [
            tuple(a - side * half_w0 - up), tuple(a + side * half_w0 - up),
            tuple(b + side * half_w1 - up), tuple(b - side * half_w1 - up),
            tuple(a - side * half_w0 + up), tuple(a + side * half_w0 + up),
            tuple(b + side * half_w1 + up), tuple(b - side * half_w1 + up),
        ]
        self.push(verts, [[0, 1, 2, 3], [7, 6, 5, 4], [0, 4, 5, 1],
                          [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]])

    def beam(self, p0, p1, width, thick=None):
        a, b = Vector(p0), Vector(p1)
        d = b - a
        if d.length < 1e-5:
            return
        self.box(tuple((a + b) * 0.5), (width, thick or width, d.length),
                 rot=tuple(d.to_track_quat("Z", "Y").to_euler()))

    def build(self, collection):
        if not self.verts:
            return None
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata(self.verts, [], self.faces)
        mesh.validate()
        mesh.update()
        mesh.materials.append(self.material)
        for poly in mesh.polygons:
            poly.use_smooth = self.smooth
        obj = bpy.data.objects.new(self.name, mesh)
        collection.objects.link(obj)
        return obj


# ------------------------------------------------------------------ landmarks
# The profile of an onion dome, as (radius factor, height factor) pairs. The
# bulge above the springing line and the long taper into a needle are what make
# a Zanarkand roofline read at a glance.
ONION = [
    (1.00, 0.00), (1.16, 0.10), (1.21, 0.24), (1.12, 0.38),
    (0.92, 0.52), (0.66, 0.66), (0.40, 0.79), (0.18, 0.90), (0.05, 1.00),
]


def onion_dome(part, x, y, z, radius, height, seg, phase):
    for i in range(len(ONION) - 1):
        r0, h0 = ONION[i]
        r1, h1 = ONION[i + 1]
        part.prism((x, y, z + height * h0), radius * r0, radius * r1,
                   height * (h1 - h0), segments=seg, phase=phase)


def waterfall(P, x, y, top_z, width, rnd, depth=None, segments=5):
    """A sheet of water falling from a building into the sea.

    The reference is full of these — whole facades venting cascades — and they
    are what stops the city reading as dry ruins. The sheet widens and frays as
    it falls, and breaks into mist where it lands.
    """
    falls, water, neon = P["falls"], P["water"], P["neon"]
    depth = depth or width * 0.22
    drop = top_z

    # the lip it pours over
    P["stone"].box((x, y, top_z), (width * 1.35, depth * 3.2, 1.6))
    neon.box((x, y, top_z - 0.9), (width * 1.1, depth * 2.2, 0.5))

    # the sheet, in a few panels that splay outward as they fall
    n = 4
    for i in range(n):
        z0 = top_z - drop * i / n
        z1 = top_z - drop * (i + 1) / n
        w0 = width * (1.0 + 0.28 * i / n)
        w1 = width * (1.0 + 0.28 * (i + 1) / n)
        wob = rnd.uniform(-0.6, 0.6)
        falls.prism((x + wob, y, z1), w1 * 0.5, w0 * 0.5, z0 - z1,
                    segments=segments, phase=rnd.uniform(0, TAU))

    # mist and spray where it lands
    for _ in range(rnd.randint(7, 12)):
        a = rnd.uniform(0, TAU)
        rr = width * rnd.uniform(0.4, 1.5)
        water.sphere((x + math.cos(a) * rr, y + math.sin(a) * rr, rnd.uniform(0.0, width * 0.7)),
                     rnd.uniform(width * 0.16, width * 0.42), rings=7, segments=9)
    neon.prism((x, y, 0.6), width * 1.4, width * 1.5, 1.0, segments=10)


def blitz_goal(P, cx, cy, cz, size, axis_x=True):
    """A blitzball goal: an inverted triangle hung in the water.

    Apex down, two uprights spreading above it, webbed across with a lit net —
    the shape is distinctive enough that it identifies the sport on sight.
    """
    metal, neon = P["metal"], P["neon"]

    def pt(u, v):
        # u runs across the goal, v up it; the plane faces along the other axis
        return (cx + (0.0 if axis_x else u), cy + (u if axis_x else 0.0), cz + v)

    apex = pt(0.0, -size)
    left = pt(-size * 0.92, size * 0.62)
    right = pt(size * 0.92, size * 0.62)

    for a, b in ((apex, left), (apex, right), (left, right)):
        metal.beam(a, b, size * 0.085, size * 0.085)
        neon.beam(a, b, size * 0.040, size * 0.040)

    # an inner rim, set back, so the frame has depth
    inner = 0.62
    ia = pt(0.0, -size * inner)
    il = pt(-size * 0.92 * inner, size * 0.62 * inner)
    ir = pt(size * 0.92 * inner, size * 0.62 * inner)
    for a, b in ((ia, il), (ia, ir), (il, ir)):
        metal.beam(a, b, size * 0.045, size * 0.045)
    for outer, inr in ((apex, ia), (left, il), (right, ir)):
        metal.beam(outer, inr, size * 0.040, size * 0.040)

    # the net: a few strands each way is enough to read as webbing
    for i in range(1, 5):
        t = i / 5.0
        a = (apex[0] + (left[0] - apex[0]) * t, apex[1] + (left[1] - apex[1]) * t,
             apex[2] + (left[2] - apex[2]) * t)
        b = (apex[0] + (right[0] - apex[0]) * t, apex[1] + (right[1] - apex[1]) * t,
             apex[2] + (right[2] - apex[2]) * t)
        neon.beam(a, b, size * 0.018, size * 0.018)
    for i in range(1, 4):
        t = i / 4.0
        a = (left[0] + (right[0] - left[0]) * t, left[1] + (right[1] - left[1]) * t,
             left[2] + (right[2] - left[2]) * t)
        neon.beam(apex, a, size * 0.018, size * 0.018)


def scoreboard(P, cx, cy, cz, width, rnd):
    """The hanging scoreboard, with its two fluted columns and fanned caps."""
    stone, metal, neon, clad = P["stone"], P["metal"], P["neon"], P["clad"]
    h = width * 0.52
    ang = 0.0   # broadside to the orbit, so it reads from the camera

    # the lit face, divided into cells
    metal.box((cx, cy, cz), (width * 0.06, width, h), rot=(0, 0, ang))
    neon.box((cx, cy, cz), (width * 0.02, width * 0.93, h * 0.86), rot=(0, 0, ang))
    for i in (-1, 1):
        for j in (-1, 1):
            neon.box((cx, cy + 0.0, cz + j * h * 0.20),
                     (width * 0.03, width * 0.36, h * 0.28),
                     rot=(0, 0, ang))
    # a divider and a ticker strip
    metal.box((cx, cy, cz), (width * 0.07, width * 0.03, h * 0.86), rot=(0, 0, ang))
    neon.box((cx, cy, cz - h * 0.52), (width * 0.05, width * 0.9, h * 0.07), rot=(0, 0, ang))

    # flanking columns with fanned caps
    for side in (-1, 1):
        ox = math.cos(ang + math.pi * 0.5) * width * 0.58 * side
        oy = math.sin(ang + math.pi * 0.5) * width * 0.58 * side
        px, py = cx + ox, cy + oy
        stone.prism((px, py, cz - h * 0.75), width * 0.075, width * 0.065, h * 1.5,
                    segments=10, phase=ang)
        for k in range(6):
            a = ang + TAU * k / 6
            neon.box((px + math.cos(a) * width * 0.072, py + math.sin(a) * width * 0.072,
                      cz - h * 0.2), (0.4, width * 0.02, h * 0.9), rot=(0, 0, a))
        # the fan cap
        for k in range(9):
            a = ang - 0.9 + 1.8 * k / 8.0
            stone.box((px, py, cz + h * 0.75),
                      (width * 0.020, width * 0.30, width * 0.035),
                      rot=(0, 0, a), base_pivot=True)
        stone.prism((px, py, cz + h * 0.72), width * 0.10, width * 0.085, width * 0.06,
                    segments=10, phase=ang)
        stone.prism((px, py, cz - h * 0.80), width * 0.12, width * 0.10, width * 0.07,
                    segments=10, phase=ang)

    # the gantry it hangs from
    clad.box((cx, cy, cz + h * 0.95), (width * 0.08, width * 1.25, width * 0.05), rot=(0, 0, ang))


def great_stadium(P, cx, cy, radius, rnd):
    """The blitzball stadium: a tiered bowl open to the sky, ringed by curved
    arms that sweep up and over it without closing.

    It is deliberately not a dome — the reference is an open structure, and an
    open structure also lets the camera drop in over the rim.

    Roughly half of what is built here is `clad`: the outer colonnade, the upper
    deck, the banner masts, most of the arms and a long breach in the wall are
    all things the ruin has lost. They return as the page scrolls, which is the
    whole point of the piece, so the two states have to differ a lot.
    """
    stone, dark, metal = P["stone"], P["dark"], P["metal"]
    clad, neon, emit = P["clad"], P["neon"], P["emit"]
    seg = 64
    rim_z = radius * 0.42
    rim_top = 7.0 + rim_z

    def ruined(a):
        """True in the quadrant that has fallen away."""
        a %= TAU
        return 1.05 < a < 2.55

    # ---- hull ---------------------------------------------------------------
    dark.prism((cx, cy, -16.0), radius * 1.34, radius * 1.30, 18.0, segments=seg)
    stone.prism((cx, cy, 2.0), radius * 1.30, radius * 1.22, 5.0, segments=seg)
    neon.prism((cx, cy, 5.4), radius * 1.235, radius * 1.235, 1.4, segments=seg)
    for i in range(seg):
        a = TAU * i / seg
        if rnd.random() < 0.5:
            continue
        px, py = cx + math.cos(a) * radius * 1.32, cy + math.sin(a) * radius * 1.32
        dark.box((px, py, -4.0), (2.0, 4.0, 7.0), rot=(0, 0, a), base_pivot=True)

    # ---- outer wall, with a long breach -------------------------------------
    for i in range(seg):
        a0 = TAU * i / seg
        target = clad if ruined(a0) else stone
        target.prism((cx, cy, 7.0), radius * 1.22, radius * 1.16, rim_z,
                     segments=seg, hollow=(a0, a0 + TAU / seg))
    for i in range(32):
        a = TAU * i / 32
        px, py = cx + math.cos(a) * radius * 1.19, cy + math.sin(a) * radius * 1.19
        neon.box((px, py, 7.0 + rim_z * 0.45), (0.6, 3.4, 3.4), rot=(0, 0, a))
        (clad if ruined(a) else stone).box((px, py, 7.0), (2.6, 3.6, rim_z * 0.95),
                                           rot=(0, 0, a), taper=0.72, base_pivot=True)

    # ---- layered rim coping -------------------------------------------------
    for i in range(seg):
        a0 = TAU * i / seg
        target = clad if ruined(a0) else stone
        for r0, r1, z0, h in ((1.26, 1.26, 0.0, 1.2), (1.30, 1.22, 1.2, 2.0), (1.22, 1.18, 3.2, 1.4)):
            target.prism((cx, cy, rim_top + z0), radius * r0, radius * r1, h,
                         segments=seg, hollow=(a0, a0 + TAU / seg))
    neon.prism((cx, cy, rim_top + 2.6), radius * 1.245, radius * 1.245, 0.8, segments=seg)
    neon.prism((cx, cy, rim_top + 4.6), radius * 1.185, radius * 1.185, 0.6, segments=seg)

    # ---- the upper deck: a colonnade the ruin has lost entirely --------------
    cols = 40
    for i in range(cols):
        a = TAU * i / cols
        px, py = cx + math.cos(a) * radius * 1.24, cy + math.sin(a) * radius * 1.24
        clad.prism((px, py, rim_top + 4.6), 2.1, 1.7, 15.0, segments=8, phase=a)
        clad.prism((px, py, rim_top + 19.6), 3.0, 2.6, 1.6, segments=8, phase=a)
        neon.box((px, py, rim_top + 12.0), (0.5, 2.6, 9.0), rot=(0, 0, a))
        # in the ruin only the stumps are left, and only outside the breach
        if not ruined(a):
            stone.prism((px, py, rim_top + 4.6), 2.3, 2.0, rnd.uniform(1.5, 5.0),
                        segments=8, phase=a)
    for i in range(seg):
        a0 = TAU * i / seg
        clad.prism((cx, cy, rim_top + 21.2), radius * 1.30, radius * 1.22, 3.4,
                   segments=seg, hollow=(a0, a0 + TAU / seg))
    neon.prism((cx, cy, rim_top + 24.6), radius * 1.255, radius * 1.255, 0.9, segments=seg)

    # ---- banner masts, restored only ---------------------------------------
    for i in range(18):
        a = TAU * i / 18
        px, py = cx + math.cos(a) * radius * 1.28, cy + math.sin(a) * radius * 1.28
        clad.prism((px, py, rim_top + 24.6), 0.9, 0.35, 26.0, segments=6, phase=a)
        neon.box((px, py, rim_top + 34.0), (0.35, 4.6, 15.0), rot=(0, 0, a))

    # ---- buttresses down the outside ---------------------------------------
    for i in range(28):
        a = TAU * i / 28 + 0.11
        px, py = cx + math.cos(a) * radius * 1.245, cy + math.sin(a) * radius * 1.245
        target = clad if ruined(a) else stone
        target.box((px, py, 6.0), (2.8, 3.6, rim_z * 0.95), rot=(0, 0, a),
                   taper=0.68, base_pivot=True)
        stone.prism((px, py, 2.0), 3.4, 2.4, 5.0, segments=6)

    # ---- concourse: an arcaded gallery set into the wall --------------------
    conc_z = 7.0 + rim_z * 0.34
    for i in range(seg):
        a0 = TAU * i / seg
        (clad if ruined(a0) else stone).prism((cx, cy, conc_z), radius * 1.20, radius * 1.20,
                                              rim_z * 0.055, segments=seg,
                                              hollow=(a0, a0 + TAU / seg))
    for i in range(36):
        a = TAU * i / 36 + TAU / 72
        px, py = cx + math.cos(a) * radius * 1.20, cy + math.sin(a) * radius * 1.20
        target = clad if ruined(a) else stone
        # jamb, jamb, lintel — reads as an opening rather than a painted stripe
        for side in (-1, 1):
            target.box((px, py, conc_z), (1.9, 2.0, rim_z * 0.30), rot=(0, 0, a), base_pivot=True)
        target.box((px, py, conc_z + rim_z * 0.30), (2.1, 6.4, rim_z * 0.06),
                   rot=(0, 0, a), base_pivot=True)
        neon.box((px, py, conc_z + rim_z * 0.15), (0.5, 3.4, rim_z * 0.22), rot=(0, 0, a))
    # a lit fascia above it
    neon.prism((cx, cy, conc_z + rim_z * 0.38), radius * 1.215, radius * 1.215,
               rim_z * 0.035, segments=seg)

    # ---- cascades pouring off the rim --------------------------------------
    for i in range(9):
        a = TAU * i / 9 + 0.22
        waterfall(P, cx + math.cos(a) * radius * 1.30, cy + math.sin(a) * radius * 1.30,
                  rim_top, 7.0, rnd)

    # ---- tiered seating -----------------------------------------------------
    tiers = 14
    for t in range(tiers):
        rr = radius * (1.16 - t * 0.058)
        zz = rim_top - t * (rim_z / tiers) * 1.05
        for i in range(seg):
            a0, a1 = TAU * i / seg, TAU * (i + 1) / seg
            if ruined(a0) and rnd.random() < 0.72:
                continue
            (clad if ruined(a0) else dark).beam(
                (cx + math.cos(a0) * rr, cy + math.sin(a0) * rr, zz),
                (cx + math.cos(a1) * rr, cy + math.sin(a1) * rr, zz), 4.6, 1.5)
        if t % 3 == 0:
            for i in range(seg):
                a0 = TAU * i / seg
                if ruined(a0) or rnd.random() < 0.55:
                    continue
                neon.box((cx + math.cos(a0) * rr, cy + math.sin(a0) * rr, zz + 1.4),
                         (2.4, 2.4, 0.34))
    # stairs radiating down through the stands
    for i in range(16):
        a = TAU * i / 16 + 0.1
        for t in range(tiers):
            rr = radius * (1.16 - t * 0.058)
            zz = rim_top - t * (rim_z / tiers) * 1.05
            (clad if ruined(a) else stone).box(
                (cx + math.cos(a) * rr, cy + math.sin(a) * rr, zz),
                (2.2, 2.6, 1.0), rot=(0, 0, a))

    # ---- the blades ---------------------------------------------------------
    # Broad flat fins sweeping out across the water and curling as they go,
    # rather than the tall thin arches an earlier pass had. In the reference
    # these are the silhouette: wide, low, tapering to points.
    def blade(theta, reach, rise, base_w, broken, curl=0.40):
        steps = 16
        pts = []
        for k in range(steps + 1):
            t = k / steps
            r_at = radius * (0.98 + (reach - 0.98) * t)
            z_at = 9.0 + radius * rise * math.sin(t * math.pi * 0.62)
            lean = theta + t * curl
            pts.append((cx + math.cos(lean) * r_at, cy + math.sin(lean) * r_at, z_at))

        def half_w(t):
            # A petal, not a shark fin. The width comes up fast off the root and
            # then *stays* broad for most of the span, only drawing to a point
            # over the last fifth. Tapering from the root outward — which an
            # earlier version did — made these read as short spiky fins.
            rise_w = math.sin(min(1.0, t * 3.2) * math.pi * 0.5)
            hold = 0.62 + 0.55 * math.sin(min(1.0, t * 1.05) * math.pi * 0.78)
            close = 1.0 if t < 0.78 else max(0.03, ((1.0 - t) / 0.22) ** 0.8)
            return radius * base_w * rise_w * hold * close

        for k in range(steps):
            t0, t1 = k / steps, (k + 1) / steps
            target = stone if t0 < broken else clad
            target.slab(pts[k], pts[k + 1], half_w(t0), half_w(t1),
                        radius * 0.055 * (1.0 - t0 * 0.5))
            # a raised spine along the middle, lit
            if k % 2 == 0:
                target.beam(pts[k], pts[k + 1], radius * 0.030, radius * 0.048)
            neon.beam(pts[k], pts[k + 1], radius * 0.014, radius * 0.014)
            # ribs running out to the edges
            if k % 3 == 1 and t0 < broken:
                dx = pts[k + 1][0] - pts[k][0]
                dy = pts[k + 1][1] - pts[k][1]
                ln = math.hypot(dx, dy) or 1.0
                ox, oy = -dy / ln * half_w(t0), dx / ln * half_w(t0)
                neon.beam((pts[k][0] - ox, pts[k][1] - oy, pts[k][2] + radius * 0.03),
                          (pts[k][0] + ox, pts[k][1] + oy, pts[k][2] + radius * 0.03),
                          radius * 0.010, radius * 0.010)
        # the hooked tip: the blades in the reference curl over and down
        if broken >= 0.98:
            tip = pts[-1]
            prev = pts[-3]
            dx, dy = tip[0] - prev[0], tip[1] - prev[1]
            ln = math.hypot(dx, dy) or 1.0
            for k in range(4):
                t = (k + 1) / 4
                hook = (tip[0] + dx / ln * radius * 0.22 * t,
                        tip[1] + dy / ln * radius * 0.22 * t,
                        tip[2] - radius * 0.30 * t * t)
                stone.slab(pts[-1] if k == 0 else prev_hook, hook,
                           half_w(1.0) * (1.6 - t * 0.9), half_w(1.0) * (1.6 - t * 1.2),
                           radius * 0.030)
                prev_hook = hook

        # the shoulder it grows out of
        stone.prism((pts[0][0], pts[0][1], -12.0), radius * 0.16, radius * 0.12, 24.0, segments=10)
        emit.prism((pts[0][0], pts[0][1], 8.0), radius * 0.045, radius * 0.030, 7.0, segments=6)
        return pts[-1]

    # No two are alike: reach, rise, width, how hard they curl, and whether
    # they fork or carry a pod all vary. A ring of identical fins reads as a
    # turbine; the reference reads as grown, mismatched limbs.
    SHAPES = [
        # reach, rise, width, curl, pod, fork
        (2.75, 0.20, 0.30, 0.46, True,  False),
        (2.10, 0.09, 0.22, 0.18, False, True),
        (2.55, 0.28, 0.26, 0.60, True,  False),
        (1.85, 0.06, 0.32, 0.10, False, False),
        (2.95, 0.15, 0.19, 0.36, False, True),
        (2.05, 0.24, 0.28, 0.52, True,  False),
        (2.45, 0.12, 0.24, 0.28, False, False),
    ]
    for i, (reach, rise, base_w, curl, pod, fork) in enumerate(SHAPES):
        theta = TAU * i / len(SHAPES) + 0.42
        broken = 1.0 if rnd.random() < 0.55 else rnd.uniform(0.55, 0.85)
        if ruined(theta):
            broken = min(broken, 0.42)
        tip = blade(theta, reach, rise, base_w, broken, curl=curl)

        # bulbous machinery riding the blade, as in the reference
        if pod:
            for frac, size in ((0.34, 0.115), (0.66, 0.075)):
                r_at = radius * (0.98 + (reach - 0.98) * frac)
                lean = theta + frac * curl
                px = cx + math.cos(lean) * r_at
                py = cy + math.sin(lean) * r_at
                pz = 9.0 + radius * rise * math.sin(frac * math.pi * 0.62) + radius * 0.05
                target = stone if frac < broken else clad
                target.sphere((px, py, pz), radius * size, rings=12, segments=16)
                neon.torus((px, py, pz), radius * size * 1.06, radius * 0.012,
                           major=20, minor=5)
        # a second, shorter blade splitting off the same shoulder
        if fork:
            blade(theta + 0.30, reach * 0.62, rise * 0.7, base_w * 0.55,
                  min(1.0, broken * 1.2), curl=curl * 1.4)

    # ---- machinery pods around the rim, as in the reference -----------------
    for i in range(11):
        a = TAU * i / 11 + 0.27
        px, py = cx + math.cos(a) * radius * 1.30, cy + math.sin(a) * radius * 1.30
        target = clad if ruined(a) else stone
        h = radius * rnd.uniform(0.14, 0.24)
        target.prism((px, py, rim_top - 2.0), radius * 0.075, radius * 0.062, h, segments=10, phase=a)
        onion_dome(target, px, py, rim_top - 2.0 + h, radius * 0.062, h * 0.8, 10, a)
        neon.prism((px, py, rim_top - 2.0 + h * 0.5), radius * 0.079, radius * 0.079,
                   h * 0.14, segments=10, phase=a)

    # ---- searchlights -------------------------------------------------------
    # Searchlights raking the sky. In the reference these are as much of the
    # silhouette as the structure is, so they are wide, long and leaning.
    for i in range(12):
        a = TAU * i / 12 + 0.4
        if ruined(a):
            continue
        px, py = cx + math.cos(a) * radius * 1.12, cy + math.sin(a) * radius * 1.12
        lean = 0.20 + rnd.uniform(-0.06, 0.06)
        emit.prism((px, py, rim_top - 3.0), radius * 0.055, radius * 0.040, 6.0, segments=8)
        neon.prism((px, py, rim_top + 2.0), 1.1, radius * 0.085, radius * 4.6,
                   segments=6, rot=(math.sin(a) * lean, -math.cos(a) * lean, 0))

    # ---- the pitch ----------------------------------------------------------
    dark.prism((cx, cy, 2.0), radius * 0.46, radius * 0.42, 3.0, segments=40)
    neon.prism((cx, cy, 5.0), radius * 0.42, radius * 0.42, 0.7, segments=40)
    for i in range(3):
        rr = radius * (0.34 - i * 0.09)
        neon.prism((cx, cy, 5.4 + i * 0.5), rr, rr, 0.35, segments=32)
    for i in range(16):
        a = TAU * i / 16
        px, py = cx + math.cos(a) * radius * 0.44, cy + math.sin(a) * radius * 0.44
        metal.prism((px, py, 5.0), 0.7, 0.5, 7.0, segments=5)
        neon.prism((px, py, 11.0), 1.1, 0.3, 1.6, segments=5)

    # ---- rubble from the collapsed quadrant ---------------------------------
    for _ in range(70):
        a = rnd.uniform(1.05, 2.55)
        rr = radius * rnd.uniform(0.95, 1.8)
        dark.box((cx + math.cos(a) * rr, cy + math.sin(a) * rr, rnd.uniform(0, 3)),
                 (rnd.uniform(2, 10), rnd.uniform(2, 10), rnd.uniform(1.5, 7)),
                 rot=(rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), rnd.uniform(0, TAU)))


def sphere_pool(P, cx, cy, cz, radius, rnd):
    """The blitzball sphere: a ball of water held in the air above the open
    bowl, ringed by its containment hoops.

    It has its own material so the renderer can drive a refractive, moving-water
    shader — it is the one thing in the city that is unmistakably alive.
    """
    pool, metal, stone, neon = P["pool"], P["metal"], P["stone"], P["neon"]

    pool.sphere((cx, cy, cz), radius, rings=36, segments=54)

    # A goal at each end, their faces square-on to each other across the water.
    # `axis_x=False` spreads each triangle in X so its plane is normal to Y —
    # the axis the pair are separated along, which is what makes them face.
    for side in (-1, 1):
        blitz_goal(P, cx, cy + side * radius * 0.45, cz, radius * 0.24, axis_x=False)

    # The scoreboard hangs off to one side of the pool rather than dead centre,
    # so it frames the play instead of sitting on top of it.
    scoreboard(P, cx - radius * 0.46, cy, cz + radius * 0.40, radius * 0.30, rnd)

    # A single equatorial hoop and its cradle. Deliberately bare metal — an
    # additive glow wrapped around the surface was most of the reason the pool
    # read as a neon ball rather than as water.
    metal.torus((cx, cy, cz), radius * 1.04, 0.9, major=52, minor=6)
    for i in range(8):
        a = TAU * i / 8
        px, py = cx + math.cos(a) * radius * 1.04, cy + math.sin(a) * radius * 1.04
        metal.beam((px, py, cz), (px * 1.5, py * 1.5, 6.0), 0.9, 0.9)

    # Pylons under the cradle. The sphere is fed from below rather than poured
    # into from above — no visible plumbing.
    for i in range(6):
        a = TAU * i / 6 + 0.52
        sx, sy = cx + math.cos(a) * radius * 1.55, cy + math.sin(a) * radius * 1.55
        stone.prism((sx, sy, 2.0), 4.6, 3.0, 7.0, segments=8)
        neon.prism((sx, sy, 9.0), 1.4, 0.9, 1.8, segments=8)


def rock_shelf(P, cx, cy, r, h, rnd, segments=9):
    P["dark"].prism((cx, cy, -h), r, r * rnd.uniform(0.82, 0.98), h + 1.2,
                    segments=segments, phase=rnd.uniform(0, TAU))


# ------------------------------------------------------------------- assembly
def build_city():
    """The scene is one building.

    Earlier drafts spread a whole city along a corridor, which spent the whole
    vertex budget on things the camera only ever glimpsed. Now the stadium sits
    alone on the water at the origin, the camera orbits it, and everything that
    was going into outlying towers goes into this one structure instead. The
    skyline survives only as a silhouette on the far horizon, for scale.
    """
    reset_scene()
    mats = {
        "stone": make_material("Stone", (0.190, 0.235, 0.238), rough=0.62),
        "dark": make_material("StoneDark", (0.095, 0.120, 0.128), rough=0.80),
        "metal": make_material("Metal", (0.240, 0.250, 0.268), rough=0.55, metal=0.85),
        "emit": make_material("Glow", (0.30, 0.86, 0.86), rough=0.4,
                              emit=(0.45, 0.95, 0.98), emit_strength=6.0),
        "clad": make_material("Clad", (0.235, 0.285, 0.288), rough=0.52),
        "neon": make_material("Neon", (0.55, 0.92, 1.0), rough=0.3,
                              emit=(0.60, 0.94, 1.0), emit_strength=9.0),
        "water": make_material("Water", (0.16, 0.62, 0.78), rough=0.06),
        "pool": make_material("Pool", (0.42, 0.74, 0.96), rough=0.02,
                              emit=(0.24, 0.62, 0.96), emit_strength=1.6),
        "falls": make_material("Falls", (0.42, 0.78, 0.86), rough=0.10),
        "far": make_material("Far", (0.140, 0.148, 0.170), rough=1.0),
    }
    P = {k: Part(k.capitalize(), m, smooth=(k in ("water", "falls", "pool"))) for k, m in mats.items()}
    rnd = random.Random(SEED)

    # the island the stadium stands on
    rock_shelf(P, 0, 0, 104, 13, rnd, segments=22)

    great_stadium(P, 0, 0, STADIUM_R, rnd)
    sphere_pool(P, 0, 0, POOL_Z, POOL_R, rnd)

    # a ring of silhouettes on the far horizon — pure backdrop, no detail
    far, neon = P["far"], P["neon"]
    for _ in range(320):
        a = rnd.uniform(0, TAU)
        d = rnd.uniform(620, 1500)
        near = 1.0 - min(1.0, (d - 620) / 880)
        w = rnd.uniform(18, 60)
        h = rnd.uniform(40, 165) + 130 * near * rnd.random()
        x, y = math.cos(a) * d, math.sin(a) * d
        r = w * 0.5
        far.prism((x, y, -12.0), r, r * rnd.uniform(0.7, 0.92), h, segments=6,
                  phase=rnd.uniform(0, TAU))
        if rnd.random() < 0.6:
            onion_dome(far, x, y, h - 12.0, r * 0.8, h * 0.22, 6, 0.0)
            far.prism((x, y, h - 12.0 + h * 0.22), r * 0.07, r * 0.02, h * 0.26, segments=5)
        for i in range(1, int(h / 34)):
            # thicker than they need to be up close: at 600–1500 units a 1.7-unit
            # band lands under a pixel and strobes as the camera moves
            neon.prism((x, y, i * 34.0), r * 0.86, r * 0.86, 5.5, segments=6)

    coll = bpy.context.scene.collection
    parts = [p for p in P.values() if isinstance(p, Part)]
    objs = [p.build(coll) for p in parts]
    stats = {p.name: len(p.verts) for p in parts}
    return [o for o in objs if o], stats


def export_glb(path, draco=True):
    for obj in bpy.data.objects:
        obj.select_set(obj.type == "MESH")
    kwargs = dict(filepath=path, export_format="GLB", use_selection=True,
                  export_apply=True, export_yup=True)
    if draco:
        try:
            bpy.ops.export_scene.gltf(export_draco_mesh_compression_enable=True,
                                      export_draco_mesh_compression_level=6, **kwargs)
            return
        except TypeError:
            pass
    bpy.ops.export_scene.gltf(**kwargs)


if __name__ == "__main__":
    objs, stats = build_city()
    print("ZANARKAND", stats)
