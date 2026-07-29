# -----------------------------------------------------------------------------
# The blitzball stadium, built with the tower's vocabulary.
#
# This is the building the whole page is about, so it gets the detail budget.
# Everything is assembled from the parts library in ztower.py — mouldings,
# dentils, brackets, balustrades, arched bays with real reveals, dome ribs —
# which is the entire point of having built that first: the ornament is
# authored once and spent everywhere.
#
# The shape is read off the aerial reference: a ring standing on the water, a
# bowl of tiered seating inside it, eight great arms leaving the ground outside
# and curling up around the rim, and the sphere of water held above the middle
# with the pitch inside it.
#
#     import zarena; zarena.build(); zarena.hero()
# -----------------------------------------------------------------------------
import bpy
import math
import random
from mathutils import Vector, Euler

import ztower
from ztower import (Part, revolve, box, ring_of, torus_profile, ogee_profile,
                    fillet, dentil_course, bracket_course, pilasters,
                    balustrade, arched_bay, dome_ribs, onion, reset)

TAU = math.pi * 2

R = 110.0        # outer radius of the ring
H = 64.0         # height of the outer wall
POOL_R = 52.0    # radius of the sphere of water
ARMS = 8


def _bez(p0, p1, p2, t):
    u = 1.0 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


# --------------------------------------------------------------------- the arm
def great_arm(part, trim, angle, rise, seed=0):
    """One of the eight arms.

    A tapering fin that leaves the ground outside the ring, rises past the lip
    and curls back in over the bowl. Built as a chain of segments with a rib
    along the outer edge and a flange either side, because a plain swept box
    reads as a cable and these are structure.
    """
    rnd = random.Random(seed)
    p0 = (R * 1.30, 4.0)
    p1 = (R * 1.22, rise * 1.18)
    p2 = (R * 0.52, rise * 0.86)

    steps = 26
    pts = []
    for i in range(steps + 1):
        t = i / steps
        rr, zz = _bez(p0, p1, p2, t)
        a = angle + 0.26 * t * t          # a little spiral, so they are not eight flat planes
        pts.append(Vector((math.cos(a) * rr, math.sin(a) * rr, zz)))

    for i in range(steps):
        t = (i + 0.5) / steps
        a, b = pts[i], pts[i + 1]
        d = b - a
        if d.length < 1e-4:
            continue
        w = 11.0 * (1.0 - 0.72 * t)       # tapers hard toward the tip
        th = 6.5 * (1.0 - 0.60 * t)
        mid = (a + b) * 0.5
        rot = tuple(d.to_track_quat("Z", "Y").to_euler())
        box(part, tuple(mid), (w, th, d.length * 1.02), rot=rot)
        # the rib along the outer edge, and a flange on each face
        side = Vector((-d.y, d.x, 0.0))
        side = side.normalized() if side.length > 1e-4 else Vector((1, 0, 0))
        up = d.normalized().cross(side).normalized()
        box(trim, tuple(mid + up * th * 0.55), (w * 0.34, th * 0.30, d.length * 1.02),
            rot=rot)
        for s in (-1, 1):
            box(trim, tuple(mid + side * w * s * 0.52),
                (w * 0.16, th * 1.15, d.length * 1.02), rot=rot)
        # A collar every eighth segment, and only a shallow one. At every
        # third, and standing this proud, the arms read as caterpillar tracks
        # — the ribs were bigger than the thing they were ribbing.
        if i % 8 == 4:
            box(trim, tuple(mid), (w * 1.06, th * 1.06, d.length * 0.30), rot=rot)

    # the pier it stands on
    px, py = math.cos(angle) * R * 1.30, math.sin(angle) * R * 1.30
    revolve(part, [(15.0, -14.0), (14.0, 0.0), (13.0, 10.0), (11.5, 22.0),
                   (12.8, 25.0), (10.5, 30.0)], 20, cx=px, cy=py, phase=angle)
    revolve(trim, torus_profile(13.2, 1.1, 2.4), 20, cx=px, cy=py, z0=10.0)
    bracket_course(trim, 11.0, 27.0, 6, w=2.2, d=3.0, h=3.2)
    return pts


# ---------------------------------------------------------------- the interior
def seating(part, trim, rows=22, top_r=R * 0.93, bot_r=R * 0.34,
            top_z=H * 0.96, bot_z=H * 0.20):
    """Tiers.

    Modelled as actual rows — a step and a riser each — rather than as a smooth
    cone. From the air the concentric rings are most of what says stadium, and
    they cost almost nothing because they are one revolve with a stepped
    profile.
    """
    prof = []
    for i in range(rows + 1):
        t = i / rows
        r = top_r + (bot_r - top_r) * t
        z = top_z + (bot_z - top_z) * t
        step = (top_r - bot_r) / rows
        prof.append((r, z))
        prof.append((r - step * 0.62, z))
        prof.append((r - step * 0.62, z - (top_z - bot_z) / rows * 0.55))
    revolve(part, prof, 128, z0=0.0)

    # gangways: a lit strip every so many rows
    for i in range(3, rows, 5):
        t = i / rows
        r = top_r + (bot_r - top_r) * t
        z = top_z + (bot_z - top_z) * t
        revolve(trim, fillet(r * 0.999, 0.5), 96, z0=z + 0.2)

    # vomitoria — the tunnel mouths the crowd comes out of
    def mouth(x, y, zz, a):
        # set into the bank, not standing on it
        box(part, (x, y, zz), (11.0, 9.0, 6.0), rot=(0, 0, a))
        box(trim, (x, y, zz + 3.4), (12.5, 10.5, 1.2), rot=(0, 0, a))
    for k in range(10):
        a = TAU * k / 10 + 0.31
        t = 0.58
        r = top_r + (bot_r - top_r) * t
        zz = top_z + (bot_z - top_z) * t
        mouth(math.cos(a) * r, math.sin(a) * r, zz, a)


def pitch(P, cx=0.0, cy=0.0, cz=H * 1.30):
    """The sphere of water, and what is inside it."""
    water, trim, metal, glass = P["water"], P["trim"], P["metal"], P["glass"]
    prof = []
    for i in range(0, 33):
        t = math.pi * i / 32
        prof.append((POOL_R * math.sin(t), -POOL_R * math.cos(t)))
    revolve(water, prof, 72, cx=cx, cy=cy, z0=cz)

    # the two goals, facing each other down the long axis
    for side in (0.0, math.pi):
        # Pulled in. At 0.60 out with a goal a third of the pool across, the
        # corners of the frame reached the surface and broke through it — a
        # goal sticking out of the water is the one thing that instantly says
        # "model" rather than "a ball of water with a pitch in it".
        gx = cx + math.cos(side) * POOL_R * 0.44
        gy = cy + math.sin(side) * POOL_R * 0.44
        s = POOL_R * 0.26
        M = (Vector((gx, gy, cz)), side)
        apex = Vector((0.0, 0.0, -s))
        left = Vector((0.0, -s * 0.92, s * 0.58))
        right = Vector((0.0, s * 0.92, s * 0.58))

        def place(p):
            v = p.copy()
            v.rotate(Euler((0.0, 0.0, side), "XYZ"))
            return v + M[0]

        for (p, q) in ((apex, left), (apex, right), (left, right)):
            a, b = place(p), place(q)
            d = b - a
            box(metal, tuple((a + b) * 0.5), (s * 0.10, s * 0.10, d.length),
                rot=tuple(d.to_track_quat("Z", "Y").to_euler()))
        # the net, as a grid of thin bars
        for k in range(1, 6):
            t = k / 6.0
            a = place(apex.lerp(left, t))
            b = place(apex.lerp(right, t))
            d = b - a
            box(trim, tuple((a + b) * 0.5), (s * 0.02, s * 0.02, d.length),
                rot=tuple(d.to_track_quat("Z", "Y").to_euler()))

    # the board, hanging in the middle
    bw = POOL_R * 0.22
    box(glass, (cx, cy, cz + POOL_R * 0.20), (bw * 0.10, bw * 1.7, bw * 0.62))
    box(metal, (cx, cy, cz + POOL_R * 0.20), (bw * 0.22, bw * 1.85, bw * 0.74))
    for s in (-1, 1):
        revolve(metal, [(bw * 0.16, -bw * 0.42), (bw * 0.20, -bw * 0.30),
                        (bw * 0.20, bw * 0.30), (bw * 0.16, bw * 0.42)],
                14, cx=cx, cy=cy + s * bw * 0.95, z0=cz + POOL_R * 0.20)


# ------------------------------------------------------------------- the whole
def build_arena(P, seed=2):
    stone, trim, glass, metal = P["stone"], P["trim"], P["glass"], P["metal"]
    rnd = random.Random(seed)

    # ---- the podium it stands on -------------------------------------------
    # The podium is a wide flat surface directly under eight house lights, so
    # in the same stone as the walls it came out as the brightest thing in the
    # frame — a white dish with a dark building on it. It gets its own, much
    # darker material.
    for i, (rr, z0, hh) in enumerate(((1.46, -18.0, 12.0), (1.40, -6.0, 6.0),
                                      (1.34, 0.0, 5.0))):
        revolve(P["deck"], fillet(R * rr, hh), 128, z0=z0, cap_bottom=(i == 0))
        revolve(trim, torus_profile(R * rr + 0.4, 1.4, 2.0), 128, z0=z0 + hh)
    z = 5.0

    # ---- the outer wall: two arcade levels ---------------------------------
    lower_h = H * 0.42
    revolve(stone, fillet(R * 1.00, lower_h), 128, z0=z, scallop=(64, 0.012))
    pilasters(trim, R * 1.005, z, z + lower_h, 32, proud=R * 0.018,
              width=R * 0.030, phase=TAU / 64)
    for k in range(32):
        arched_bay(trim, glass, R * 1.00, z + lower_h * 0.14, lower_h * 0.70,
                   0.135, phase=TAU * k / 32, depth=R * 0.010, segments=7)
    revolve(trim, ogee_profile(R * 1.01, R * 1.05, H * 0.026), 128, z0=z + lower_h)
    dentil_course(trim, R * 1.035, z + lower_h + H * 0.014, 128,
                  w=R * 0.012, d=R * 0.012, h=H * 0.012)
    z += lower_h + H * 0.026

    upper_h = H * 0.40
    revolve(stone, fillet(R * 0.985, upper_h), 128, z0=z)
    pilasters(trim, R * 0.99, z, z + upper_h, 32, proud=R * 0.016,
              width=R * 0.026, phase=TAU / 64)
    for k in range(32):
        arched_bay(trim, glass, R * 0.985, z + upper_h * 0.16, upper_h * 0.62,
                   0.135, phase=TAU * k / 32, depth=R * 0.009, segments=7)
    z += upper_h

    # ---- the cornice and the crown ring ------------------------------------
    bracket_course(trim, R * 0.99, z + H * 0.012, 64, w=R * 0.020, d=R * 0.028,
                   h=H * 0.026)
    revolve(trim, ogee_profile(R * 0.99, R * 1.09, H * 0.024), 128, z0=z + H * 0.026)
    dentil_course(trim, R * 1.06, z + H * 0.040, 96, w=R * 0.014, d=R * 0.014,
                  h=H * 0.011)
    revolve(stone, fillet(R * 1.11, H * 0.016), 128, z0=z + H * 0.050)
    balustrade(trim, R * 1.09, z + H * 0.066, 128, H * 0.052)
    # the ring of light along the lip
    revolve(P["neon"], fillet(R * 1.115, H * 0.012), 128, z0=z + H * 0.052)
    z += H * 0.066

    # ---- inside -------------------------------------------------------------
    seating(stone, trim)
    revolve(stone, fillet(R * 0.34, H * 0.20), 96, z0=0.0, cap_top=True)
    revolve(trim, torus_profile(R * 0.345, 1.2, 2.0), 96, z0=H * 0.20)

    # ---- buttresses ---------------------------------------------------------
    # The eight arms are gone. They were the most eye-catching thing in the
    # frame and the least like the reference — a cage of curved tubes over a
    # building that does not need one. What the outside actually wants is
    # weight: paired buttresses running up the wall, which say the ring is
    # holding something back.
    def buttress(x, y, zz, a):
        depth = R * 0.055
        # Pulled back against the wall. Standing them off it turned them into a
        # free colonnade around the building, which is a different — and much
        # weaker — idea than a wall with weight in it.
        for s in (-1, 1):
            ox = x + math.cos(a + s * 0.048) * depth * 0.18
            oy = y + math.sin(a + s * 0.048) * depth * 0.18
            revolve(stone, [(R * 0.028, 0.0), (R * 0.024, H * 0.30),
                            (R * 0.018, H * 0.74), (R * 0.022, H * 0.80),
                            (R * 0.013, H * 0.86)],
                    12, cx=ox, cy=oy, z0=zz, phase=a)
        # the spur that ties it back into the wall
        box(stone, (x - math.cos(a) * depth * 0.55, y - math.sin(a) * depth * 0.55,
                    zz + H * 0.34), (depth * 1.5, R * 0.052, H * 0.62), rot=(0, 0, a))
        # the arch between the pair, and a finial over it
        box(trim, (x + math.cos(a) * depth * 0.4, y + math.sin(a) * depth * 0.4,
                   zz + H * 0.80), (depth * 1.1, R * 0.085, H * 0.030), rot=(0, 0, a))
        revolve(trim, ztower.onion(R * 0.024, H * 0.075),
                12, cx=x + math.cos(a) * depth * 0.4,
                cy=y + math.sin(a) * depth * 0.4, z0=zz + H * 0.83)
    ring_of(buttress, 16, R * 1.045, 5.0, phase=TAU / 32)

    # ---- masts around the rim ----------------------------------------------
    # Standards, not street lamps. Sixteen tall masts around the rim looked
    # like a car park; eight short ones with a lit finial read as the building
    # having a crown.
    def mast(x, y, zz, a):
        revolve(stone, [(2.6, 0.0), (2.2, 3.0), (1.5, 4.0), (1.3, 15.0),
                        (1.9, 16.5), (1.5, 18.0)], 12, cx=x, cy=y, z0=zz)
        revolve(P["neon"], [(0.0, 0.0), (1.5, 1.2), (1.1, 3.4), (0.0, 4.6)],
                12, cx=x, cy=y, z0=zz + 18.0)
    ring_of(mast, 8, R * 1.09, z + H * 0.052, phase=TAU / 16)

    # ---- the water and the pitch -------------------------------------------
    # Held well above the rim. Sitting it low put it inside the bowl, where it
    # hid the seating that had just been built and read as a lid.
    pitch(P, cz=H * 1.60)

    # ---- the house lights ---------------------------------------------------
    # A stadium at night is lit from inside the bowl, and no amount of emissive
    # window does that job — the light has to actually be in the room.
    for k in range(8):
        a = TAU * k / 8 + 0.4
        data = bpy.data.lights.new("House%d" % k, type="AREA")
        data.energy = 55000.0
        data.size = 34.0
        data.color = (0.62, 0.86, 1.0)
        lamp = bpy.data.objects.new("House%d" % k, data)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = (math.cos(a) * R * 0.88, math.sin(a) * R * 0.88, H * 1.05)
        lamp.rotation_euler = (math.radians(58), 0.0, a + math.pi * 0.5)

    # ---- the wall wash ------------------------------------------------------
    # The arcade was a black band. Emissive windows light themselves and
    # nothing else, so the facade needs something actually pointed at it —
    # cool, low, and from outside, the way a building like this would be lit.
    for k in range(10):
        a = TAU * k / 10 + 0.2
        data = bpy.data.lights.new("Wash%d" % k, type="AREA")
        data.energy = 26000.0
        data.size = 26.0
        data.color = (0.46, 0.72, 1.0)
        lamp = bpy.data.objects.new("Wash%d" % k, data)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = (math.cos(a) * R * 1.62, math.sin(a) * R * 1.62, H * 0.20)
        lamp.rotation_euler = (math.radians(74), 0.0, a + math.pi * 1.5)
    return z


def make_materials():
    mats = ztower.make_materials()
    water = bpy.data.materials.new("ArenaWater")
    water.use_nodes = True
    b = water.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.30, 0.66, 0.86, 1.0)
    b.inputs["Roughness"].default_value = 0.06
    for k in ("Transmission Weight", "Transmission"):
        if k in b.inputs:
            b.inputs[k].default_value = 0.86
            break
    if "IOR" in b.inputs:
        b.inputs["IOR"].default_value = 1.333
    for k in ("Emission Color", "Emission"):
        if k in b.inputs:
            b.inputs[k].default_value = (0.14, 0.42, 0.72, 1.0)
            break
    if "Emission Strength" in b.inputs:
        # Water, not a lamp. At 0.7 the sphere was the brightest thing in the
        # frame by a distance and everything else became its background.
        b.inputs["Emission Strength"].default_value = 0.22
    # a little colour in the volume, so it is blue *through* rather than blue on
    for k in ("Transmission Weight", "Transmission"):
        if k in b.inputs:
            b.inputs[k].default_value = 0.94
            break

    neon = bpy.data.materials.new("ArenaNeon")
    neon.use_nodes = True
    n = neon.node_tree.nodes["Principled BSDF"]
    n.inputs["Base Color"].default_value = (0.6, 0.9, 1.0, 1.0)
    for k in ("Emission Color", "Emission"):
        if k in n.inputs:
            n.inputs[k].default_value = (0.55, 0.90, 1.0, 1.0)
            break
    if "Emission Strength" in n.inputs:
        n.inputs["Emission Strength"].default_value = 9.0

    far = bpy.data.materials.new("ArenaFar")
    far.use_nodes = True
    fb = far.node_tree.nodes["Principled BSDF"]
    fb.inputs["Base Color"].default_value = (0.020, 0.030, 0.042, 1.0)
    fb.inputs["Roughness"].default_value = 0.95

    seam = bpy.data.materials.new("ArenaSea")
    seam.use_nodes = True
    sb = seam.node_tree.nodes["Principled BSDF"]
    sb.inputs["Base Color"].default_value = (0.006, 0.014, 0.024, 1.0)
    sb.inputs["Roughness"].default_value = 0.11
    sb.inputs["Metallic"].default_value = 0.30

    deck = bpy.data.materials.new("ArenaDeck")
    deck.use_nodes = True
    db = deck.node_tree.nodes["Principled BSDF"]
    db.inputs["Base Color"].default_value = (0.030, 0.042, 0.046, 1.0)
    db.inputs["Roughness"].default_value = 0.72

    mats["deck"] = deck
    mats["water"] = water
    mats["neon"] = neon
    mats["far"] = far
    mats["sea"] = seam
    return mats


def build(seed=2):
    reset()
    mats = make_materials()
    P = {k: Part(k.capitalize(), m) for k, m in mats.items()}
    build_arena(P, seed=seed)
    rnd = random.Random(seed + 77)
    sea(P)
    surroundings(P, rnd)
    coll = bpy.context.scene.collection
    for p in P.values():
        p.build(coll, smooth_angle=30)
    return {p.name: len(p.verts) for p in P.values()}



# ------------------------------------------------------- the world around it
def place_tower(P, x, y, z, H_, R_, seed):
    """Drop one of ztower's towers at a point.

    ztower builds at the origin and has no idea about placement, which is the
    right way round: it is a parts library, not a city. Rather than thread
    coordinates through every one of its helpers, the tower is built into
    scratch buffers and the vertices are moved on the way out.
    """
    tmp = {k: Part(k, None) for k in ("stone", "trim", "glass", "metal")}
    ztower.build_tower(tmp, H=H_, R=R_, seed=seed)
    for k, part in tmp.items():
        off = len(P[k].verts)
        P[k].verts.extend([(vx + x, vy + y, vz + z) for (vx, vy, vz) in part.verts])
        P[k].faces.extend([[i + off for i in f] for f in part.faces])


def surroundings(P, rnd, near=13, far=26, ring=(10.0, 15.0), out=(17.0, 30.0)):
    """The city the arena stands in.

    Two rings, and both of them are outside the camera's orbit.
    
    That last part is not decoration. The orbit closes from 719 units to 220,
    and the districts used to start at 256 — so somewhere in the middle of the
    scroll the camera flew straight through a tower and the shot went black.
    Everything the camera can reach has to be empty.
    """
    stone, trim, dark = P["stone"], P["trim"], P["stone"]

    placed = []
    for _ in range(near * 6):
        if len(placed) >= near:
            break
        a = rnd.uniform(0, TAU)
        d = rnd.uniform(R * ring[0], R * ring[1])
        x, y = math.cos(a) * d, math.sin(a) * d
        if any((x - px) ** 2 + (y - py) ** 2 < (R * 1.5) ** 2 for px, py in placed):
            continue
        placed.append((x, y))

        # the islet it stands on
        isl = rnd.uniform(R * 0.30, R * 0.52)
        revolve(stone, [(isl, -26.0), (isl * 0.97, -6.0), (isl * 0.86, 0.0),
                        (isl * 0.80, 5.0), (isl * 0.72, 7.0)],
                24, cx=x, cy=y, phase=a)
        revolve(trim, torus_profile(isl * 0.80, 1.6, 2.4), 24, cx=x, cy=y, z0=5.0)

        h = rnd.uniform(150.0, 360.0)
        rr = rnd.uniform(9.0, 17.0)
        place_tower(P, x, y, 6.0, h, rr, seed=rnd.randint(1, 9999))

        # an uplight at its foot. Without one the near towers were pure
        # silhouette — all that carved ornament, and not a photon on any of it.
        data = bpy.data.lights.new("Up", type="AREA")
        data.energy = 9000.0
        data.size = 16.0
        data.color = (0.52, 0.74, 1.0)
        lamp = bpy.data.objects.new("Up", data)
        bpy.context.scene.collection.objects.link(lamp)
        lamp.location = (x + math.cos(a) * rr * 2.6,
                         y + math.sin(a) * rr * 2.6, 10.0)
        lamp.rotation_euler = (math.radians(-58), 0.0, a + math.pi * 0.5)

        # a few low blocks around its feet, so it is a district and not a pole
        for _ in range(rnd.randint(2, 4)):
            sa = rnd.uniform(0, TAU)
            sd = rnd.uniform(isl * 0.35, isl * 0.75)
            sx, sy = x + math.cos(sa) * sd, y + math.sin(sa) * sd
            bh = rnd.uniform(18.0, 52.0)
            bw = rnd.uniform(7.0, 14.0)
            revolve(stone, [(bw, 0.0), (bw * 0.94, bh * 0.8), (bw * 0.80, bh)],
                    12, cx=sx, cy=sy, z0=6.0, phase=sa)
            revolve(trim, torus_profile(bw * 0.86, 0.9, 1.4), 12,
                    cx=sx, cy=sy, z0=6.0 + bh)
            for k in range(max(1, int(bh / 16))):
                revolve(P["neon"], fillet(bw * 0.82, 0.9), 12, cx=sx, cy=sy,
                        z0=6.0 + bh * (0.25 + 0.55 * k / max(1, int(bh / 16))))

    # ---- the far ring: silhouettes only
    for _ in range(far):
        a = rnd.uniform(0, TAU)
        d = rnd.uniform(R * out[0], R * out[1])
        x, y = math.cos(a) * d, math.sin(a) * d
        h = rnd.uniform(120.0, 420.0)
        rr = rnd.uniform(12.0, 34.0)
        revolve(P["far"], [(rr * 1.5, -30.0), (rr * 1.15, 0.0), (rr, h * 0.10),
                           (rr * 0.72, h * 0.72), (rr * 0.34, h * 0.86)],
                10, cx=x, cy=y, phase=a)
        revolve(P["far"], ztower.onion(rr * 0.34, h * 0.14), 10, cx=x, cy=y,
                z0=h * 0.86)
        for k in range(1, max(2, int(h / 70))):
            revolve(P["neon"], fillet(rr * 0.80, 1.6), 10, cx=x, cy=y,
                    z0=h * 0.12 * k)


def sea(P, radius=R * 34.0, z=-24.0, segs=96):
    """Open water out to the horizon."""
    verts = [(0.0, 0.0, z)]
    for j in range(segs):
        a = TAU * j / segs
        verts.append((math.cos(a) * radius, math.sin(a) * radius, z))
    faces = [[0, 1 + j, 1 + (j + 1) % segs] for j in range(segs)]
    P["sea"].push(verts, faces)


# --------------------------------------------------------------- the pyreflies
def pyreflies(count=90, seed=7, low=-4.0, high=H * 2.6, r_in=R * 0.5,
              r_out=R * 4.0, avoid=None, avoid_r=150.0, scale=(0.5, 1.7),
              variants=3):
    """Scatter the pyreflies from zpyre through the scene.

    A handful of distinct swarms, each instanced many times. They have to be
    separate objects for the placement to vary, and they have to share meshes
    or a hundred of them would be a hundred copies of three hundred grains.
    """
    import zpyre
    rnd = random.Random(seed)

    grain_mat = zpyre._emissive("SceneGrain", 1.9, use_attr=True, soft=False)
    head_mat = zpyre._emissive("SceneHeadPt", 28.0, tint=(1.0, 0.96, 0.84),
                               use_attr=False, soft=False)

    meshes = []
    for v in range(variants):
        verts, faces, cols = zpyre.build_swarm(grains=300, scale=6.0, seed=seed + v)
        hv, hf, hc = zpyre.build_head_point(scale=6.0)
        off = len(verts)
        allv = verts + hv
        allf = faces + [[i + off for i in f] for f in hf]
        allc = cols + hc
        mesh = bpy.data.meshes.new("PyreSwarm%d" % v)
        mesh.from_pydata(allv, [], allf)
        mesh.validate()
        attr = mesh.color_attributes.new(name="hue", type="FLOAT_COLOR",
                                         domain="POINT")
        for i, c in enumerate(allc):
            attr.data[i].color = (c[0], c[1], c[2], 1.0)
        mesh.materials.append(grain_mat)
        mesh.materials.append(head_mat)
        n_grain = len(faces)
        for i, poly in enumerate(mesh.polygons):
            poly.material_index = 0 if i < n_grain else 1
            poly.use_smooth = (i >= n_grain)
        mesh.update()
        meshes.append(mesh)

    coll = bpy.data.collections.new("Pyreflies")
    bpy.context.scene.collection.children.link(coll)
    placed = 0
    tries = 0
    while placed < count and tries < count * 30:
        tries += 1
        a = rnd.uniform(0, TAU)
        rr = r_in + (r_out - r_in) * rnd.random() ** 1.6
        z = low + (high - low) * rnd.random() ** 1.8
        pos = (math.cos(a) * rr, math.sin(a) * rr, z)
        if avoid is not None:
            dx, dy, dz = pos[0] - avoid[0], pos[1] - avoid[1], pos[2] - avoid[2]
            if dx * dx + dy * dy + dz * dz < avoid_r * avoid_r:
                continue
        obj = bpy.data.objects.new("Pyre%04d" % placed,
                                   meshes[placed % len(meshes)])
        coll.objects.link(obj)
        obj.location = pos
        sc = rnd.uniform(*scale)
        obj.scale = (sc, sc, sc)
        # Rising.
        #
        # The swarm is authored with its head at the origin and its tail
        # running out along +X, so a quarter turn about Y drops the tail
        # underneath and points the head at the sky. The jitter keeps them
        # from looking like a printed pattern; the yaw is free.
        obj.rotation_euler = (rnd.uniform(-0.34, 0.34),
                              math.pi * 0.5 + rnd.uniform(-0.30, 0.30),
                              rnd.uniform(0, TAU))
        placed += 1
    return placed


def add_glare(kind="FOG_GLOW", size=8, threshold=0.6):
    """Cycles has no bloom of its own, and without it every emissive surface
    stops at its own silhouette — which is exactly what a pyrefly must not do."""
    sc = bpy.context.scene
    # Blender 5 moved the compositor onto a node *group* hung off the scene;
    # earlier versions used scene.node_tree with scene.use_nodes.
    nt = None
    if hasattr(sc, "node_tree"):
        sc.use_nodes = True
        nt = sc.node_tree
    else:
        group = bpy.data.node_groups.get("Comp") or bpy.data.node_groups.new(
            "Comp", "CompositorNodeTree")
        nt = group
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        # The interface has to exist before anything is wired to it. Linking
        # `NodeGroupInput.outputs[0]` while the group still had no sockets
        # attached to the virtual "new socket" slot instead, and the whole
        # render came out blank white with no error.
        for item in list(nt.interface.items_tree):
            nt.interface.remove(item)
        nt.interface.new_socket("Image", in_out="INPUT",
                                socket_type="NodeSocketColor")
        nt.interface.new_socket("Image", in_out="OUTPUT",
                                socket_type="NodeSocketColor")
        sc.compositing_node_group = group

    if hasattr(sc, "node_tree"):
        for n in list(nt.nodes):
            nt.nodes.remove(n)

    glare = nt.nodes.new("CompositorNodeGlare")

    # In Blender 5 the glare settings moved from node properties onto node
    # *inputs*; before that they were attributes. Set whichever exists.
    def cfg(name, attr, value):
        if name in glare.inputs:
            try:
                glare.inputs[name].default_value = value
                return
            except Exception:
                pass
        try:
            setattr(glare, attr, value)
        except Exception:
            pass

    cfg("Type", "glare_type", kind)
    cfg("Quality", "quality", "HIGH")
    cfg("Size", "size", size)
    cfg("Threshold", "threshold", threshold)
    cfg("Strength", "mix", 1.0)

    if hasattr(sc, "node_tree"):
        src = nt.nodes.new("CompositorNodeRLayers")
        dst = nt.nodes.new("CompositorNodeComposite")
        nt.links.new(src.outputs["Image"], glare.inputs[0])
        nt.links.new(glare.outputs[0], dst.inputs[0])
    else:
        src = nt.nodes.new("NodeGroupInput")
        src.location = (-400, 0)
        dst = nt.nodes.new("NodeGroupOutput")
        dst.location = (400, 0)
        nt.links.new(src.outputs["Image"], glare.inputs["Image"])
        nt.links.new(glare.outputs["Image"], dst.inputs["Image"])


# ------------------------------------------------------------------ the render
def hero(path=None, width=1280, height=720, samples=110,
         cam=(300.0, -330.0, 210.0), look=(0.0, 0.0, 70.0), lens=55.0,
         night=0.0):
    """One serious frame, so the model can be judged rather than guessed at."""
    import os
    sc = bpy.context.scene

    w = bpy.data.worlds.new("W")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    co = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.3
    mr.inputs["From Max"].default_value = 0.6
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    if night < 0.5:
        cr.elements[0].color = (0.80, 0.34, 0.10, 1)
        cr.elements[1].color = (0.045, 0.065, 0.125, 1)
        cr.elements.new(0.24).color = (0.44, 0.19, 0.15, 1)
        strength, sun_e, sun_c = 0.6, 8.0, (1.0, 0.50, 0.20)
    else:
        # Night. The sky is barely a light source at all — the building has to
        # be lit by its own windows, which is the whole point of the palette.
        cr.elements[0].color = (0.020, 0.048, 0.078, 1)
        cr.elements[1].color = (0.002, 0.005, 0.014, 1)
        cr.elements.new(0.28).color = (0.008, 0.018, 0.040, 1)
        strength, sun_e, sun_c = 0.16, 0.30, (0.45, 0.62, 1.0)
    nt.links.new(co.outputs["Normal"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs[0], out.inputs["Surface"])

    ld = bpy.data.lights.new("Sun", type="SUN")
    ld.energy = sun_e
    ld.angle = math.radians(1.6)
    ld.color = sun_c
    sun = bpy.data.objects.new("Sun", ld)
    sc.collection.objects.link(sun)
    b, e = math.radians(212.0), math.radians(6.0 if night < 0.5 else 42.0)
    dv = Vector((math.cos(b) * math.cos(e), math.sin(b) * math.cos(e), math.sin(e)))
    sun.rotation_euler = (-dv).to_track_quat("Z", "Y").to_euler()

    cd = bpy.data.cameras.new("C")
    cd.lens = lens
    cd.clip_end = 20000
    c = bpy.data.objects.new("C", cd)
    sc.collection.objects.link(c)
    sc.camera = c
    c.location = cam
    d = Vector(look) - Vector(cam)
    c.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

    sc.render.engine = "CYCLES"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    path = path or "/tmp/arena.png"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc.render.filepath = path
    return path


# ------------------------------------------------------------------ the export
def export_glb(path, seed=2, near=10, far=22, draco=True):
    """Build at web weight and write the model out.

    Everything up to here has lived in Blender and in rendered stills, which is
    why the page never changed: the site loads glTF, and nothing had ever been
    written. This is the missing step.

    The lighting does not travel — the web renderer lights itself — so what
    ships is geometry, material names, and nothing else. The near ring is
    thinned because the tower parts are by far the heaviest thing here: the
    trim alone is most of the vertex count, and it is the one thing a visitor
    on a phone will never resolve.
    """
    import os
    reset()
    mats = make_materials()
    P = {k: Part(k.capitalize(), m) for k, m in mats.items()}
    rnd = random.Random(seed + 77)
    build_arena(P, seed=seed)
    sea(P)
    surroundings(P, rnd, near=near, far=far)

    coll = bpy.context.scene.collection
    for p in P.values():
        p.build(coll, smooth_angle=30)

    # the lights that build_arena added are not part of the model
    for obj in list(bpy.data.objects):
        if obj.type != "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
        else:
            obj.select_set(True)

    kwargs = dict(filepath=path, export_format="GLB", use_selection=True,
                  export_apply=True, export_yup=True, export_normals=False,
                  export_texcoords=False, export_vertex_color="NONE")
    if draco:
        kwargs.update(export_draco_mesh_compression_enable=True,
                      export_draco_mesh_compression_level=6)
    bpy.ops.export_scene.gltf(**kwargs)
    return {"MB": round(os.path.getsize(path) / 1e6, 2),
            "verts": {p.name: len(p.verts) for p in P.values()}}
