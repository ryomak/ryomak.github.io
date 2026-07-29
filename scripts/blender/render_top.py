# -----------------------------------------------------------------------------
# Zanarkand top-page sequence renderer.  (Blender 5.x)
#
# Reuses the procedural stadium in ./zanarkand.py and wraps it in everything the
# GLB never needed: a sunset sky, an ocean, haze, pyreflies, and an animation.
#
# The shot is one continuous 360-degree orbit. It opens on the ruin under a low
# sun — only the surviving stone, metal and dead glow are there — and as the
# camera comes round, the cladding and the light that were lost a thousand years
# ago fly back in piece by piece, from the waterline up, until the blitzball
# arena and the six waterfront districts stand whole again at the same angle we
# began from.
#
# The reveal is per-mesh-island: every box and prism the generator pushed is its
# own island, so "assemble" is thousands of individual pieces landing rather
# than a wipe. It is driven off Scene Time inside Geometry Nodes, which makes
# any frame a pure function of the frame number — so a chunked render (needed to
# keep each call short) produces exactly the same result as one long one.
#
# Usage, from Blender's Python:
#     import render_top; render_top.setup()
#     render_top.render_chunk(1, 20, "hi", "/abs/out")
# -----------------------------------------------------------------------------
import bpy
import math
import os
import sys

TAU = math.pi * 2

# The shot -------------------------------------------------------------------
FRAMES = 120           # scroll is mapped onto this many stills
ORBIT_TURNS = 1.0      # a full circle, so the last frame answers the first
START_ANGLE = math.radians(18.0)

# Where the restoration sits inside the shot. It finishes before the end so the
# last chapter of the page plays against a city that is already whole.
RESTORE_IN, RESTORE_OUT = 0.10, 0.86

TIERS = {
    "hi": (1600, 900, 82),
    "lo": (800, 450, 74),
}


# --------------------------------------------------------------- node helpers
def _new(tree, kind, x, y, **props):
    n = tree.nodes.new(kind)
    n.location = (x, y)
    for k, v in props.items():
        setattr(n, k, v)
    return n


def _sock(tree, name, in_out, kind):
    return tree.interface.new_socket(name=name, in_out=in_out, socket_type=kind)


def _try(obj, attr, value):
    if hasattr(obj, attr):
        try:
            setattr(obj, attr, value)
            return True
        except (AttributeError, TypeError, ValueError):
            pass
    return False


# ------------------------------------------------------------ assembly effect
def make_assemble_group(name, z_lo, z_hi, seed, lift, spread, delay=0.0, span=0.30):
    """Geometry Nodes that assemble a mesh island by island.

    Each island takes its start time from its own height — so the rebuild reads
    as a front rising out of the water — jittered by a per-island random, so it
    is a swarm of pieces arriving and not a clean horizontal line. Before its
    start the island is deleted outright; over its own short window it flies in
    from above and outward and eases into place.
    """
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    _sock(ng, "Geometry", "INPUT", "NodeSocketGeometry")
    _sock(ng, "Geometry", "OUTPUT", "NodeSocketGeometry")
    gin = _new(ng, "NodeGroupInput", -1500, 0)
    gout = _new(ng, "NodeGroupOutput", 950, 0)
    link = ng.links.new

    # ---- global progress, straight off the timeline -------------------------
    time = _new(ng, "GeometryNodeInputSceneTime", -1500, -460)
    prog = _new(ng, "ShaderNodeMapRange", -1300, -460)
    prog.inputs["From Min"].default_value = 1.0 + (FRAMES - 1) * RESTORE_IN
    prog.inputs["From Max"].default_value = 1.0 + (FRAMES - 1) * RESTORE_OUT
    prog.clamp = True
    link(time.outputs["Frame"], prog.inputs["Value"])

    # ---- when this island is due --------------------------------------------
    pos = _new(ng, "GeometryNodeInputPosition", -1500, 300)
    sep = _new(ng, "ShaderNodeSeparateXYZ", -1320, 300)
    link(pos.outputs["Position"], sep.inputs["Vector"])

    hgt = _new(ng, "ShaderNodeMapRange", -1140, 340)      # height, normalised
    hgt.inputs["From Min"].default_value = z_lo
    hgt.inputs["From Max"].default_value = max(z_hi, z_lo + 1e-3)
    hgt.clamp = True
    link(sep.outputs["Z"], hgt.inputs["Value"])

    island = _new(ng, "GeometryNodeInputMeshIsland", -1500, 100)
    jitter = _new(ng, "FunctionNodeRandomValue", -1320, 100)
    jitter.data_type = "FLOAT"
    jitter.inputs[0].default_value = 0.0     # Min
    jitter.inputs[1].default_value = 1.0     # Max
    jitter.inputs[3].default_value = seed    # Seed
    link(island.outputs["Island Index"], jitter.inputs[2])   # ID

    h_w = _new(ng, "ShaderNodeMath", -940, 340, operation="MULTIPLY")
    h_w.inputs[1].default_value = 0.62
    link(hgt.outputs["Result"], h_w.inputs[0])

    j_w = _new(ng, "ShaderNodeMath", -940, 170, operation="MULTIPLY")
    j_w.inputs[1].default_value = 0.38
    link(jitter.outputs[0], j_w.inputs[0])

    mix = _new(ng, "ShaderNodeMath", -760, 260, operation="ADD")
    link(h_w.outputs[0], mix.inputs[0])
    link(j_w.outputs[0], mix.inputs[1])

    # squeeze the starts into whatever is left once this island's own reveal
    # span and its layer's delay are accounted for
    start = _new(ng, "ShaderNodeMath", -580, 260, operation="MULTIPLY_ADD")
    start.inputs[1].default_value = max(0.0, 1.0 - span - delay)
    start.inputs[2].default_value = delay
    link(mix.outputs[0], start.inputs[0])

    end = _new(ng, "ShaderNodeMath", -580, 90, operation="ADD")
    end.inputs[1].default_value = span
    link(start.outputs[0], end.inputs[0])

    local = _new(ng, "ShaderNodeMapRange", -380, 260)
    local.clamp = True
    link(prog.outputs["Result"], local.inputs["Value"])
    link(start.outputs[0], local.inputs["From Min"])
    link(end.outputs[0], local.inputs["From Max"])

    # ease-out: the piece leaves fast and settles gently
    inv = _new(ng, "ShaderNodeMath", -180, 90, operation="SUBTRACT")
    inv.inputs[0].default_value = 1.0
    link(local.outputs["Result"], inv.inputs[1])
    ease = _new(ng, "ShaderNodeMath", 0, 90, operation="POWER")
    ease.inputs[1].default_value = 2.4
    link(inv.outputs[0], ease.inputs[0])

    # ---- where it comes in from ---------------------------------------------
    outward = _new(ng, "ShaderNodeVectorMath", -1140, 60, operation="MULTIPLY")
    outward.inputs[1].default_value = (spread, spread, 0.0)
    link(pos.outputs["Position"], outward.inputs[0])

    rise = _new(ng, "ShaderNodeCombineXYZ", -1140, -140)
    rise.inputs["Z"].default_value = lift

    away = _new(ng, "ShaderNodeVectorMath", -940, -60, operation="ADD")
    link(outward.outputs["Vector"], away.inputs[0])
    link(rise.outputs["Vector"], away.inputs[1])

    offset = _new(ng, "ShaderNodeVectorMath", 200, -60, operation="SCALE")
    link(away.outputs["Vector"], offset.inputs[0])
    link(ease.outputs[0], offset.inputs["Scale"])

    # ---- drop what is not due yet, move what is -----------------------------
    gone = _new(ng, "ShaderNodeMath", 200, 260, operation="LESS_THAN")
    gone.inputs[1].default_value = 0.0005
    link(local.outputs["Result"], gone.inputs[0])

    delete = _new(ng, "GeometryNodeDeleteGeometry", 440, 0, domain="POINT", mode="ALL")
    link(gin.outputs[0], delete.inputs["Geometry"])
    link(gone.outputs[0], delete.inputs["Selection"])

    setpos = _new(ng, "GeometryNodeSetPosition", 700, 0)
    link(delete.outputs["Geometry"], setpos.inputs["Geometry"])
    link(offset.outputs["Vector"], setpos.inputs["Offset"])
    link(setpos.outputs["Geometry"], gout.inputs[0])
    return ng


# ------------------------------------------------------------------ pyreflies
def make_pyreflies(name, count, extent, top, speed, mat):
    """A drifting cloud of spirit-lights, rising and wrapping.

    Points rather than a particle system: the motion is a pure function of the
    frame, so any frame renders correctly on its own — which is what makes a
    chunked render safe.
    """
    ng = bpy.data.node_groups.new(name, "GeometryNodeTree")
    _sock(ng, "Geometry", "INPUT", "NodeSocketGeometry")
    _sock(ng, "Geometry", "OUTPUT", "NodeSocketGeometry")
    _new(ng, "NodeGroupInput", -1300, -420)
    gout = _new(ng, "NodeGroupOutput", 900, 0)
    link = ng.links.new

    pts = _new(ng, "GeometryNodePoints", -1060, 0)
    pts.inputs["Count"].default_value = count

    idx = _new(ng, "GeometryNodeInputIndex", -1300, 300)
    place = _new(ng, "FunctionNodeRandomValue", -1100, 300)
    place.data_type = "FLOAT_VECTOR"
    place.inputs[0].default_value = (-extent, -extent, 0.0)
    place.inputs[1].default_value = (extent, extent, 1.0)
    place.inputs[3].default_value = 5
    link(idx.outputs["Index"], place.inputs[2])

    rate = _new(ng, "FunctionNodeRandomValue", -1100, 90)
    rate.data_type = "FLOAT"
    rate.inputs[0].default_value = 0.45
    rate.inputs[1].default_value = 1.0
    rate.inputs[3].default_value = 9
    link(idx.outputs["Index"], rate.inputs[2])

    sep = _new(ng, "ShaderNodeSeparateXYZ", -900, 300)
    link(place.outputs[0], sep.inputs["Vector"])

    base_z = _new(ng, "ShaderNodeMath", -720, 240, operation="MULTIPLY")
    base_z.inputs[1].default_value = top
    link(sep.outputs["Z"], base_z.inputs[0])

    time = _new(ng, "GeometryNodeInputSceneTime", -1100, -180)
    drift = _new(ng, "ShaderNodeMath", -900, -180, operation="MULTIPLY")
    drift.inputs[1].default_value = speed
    link(time.outputs["Frame"], drift.inputs[0])
    drift2 = _new(ng, "ShaderNodeMath", -720, -180, operation="MULTIPLY")
    link(drift.outputs[0], drift2.inputs[0])
    link(rate.outputs[0], drift2.inputs[1])

    raw = _new(ng, "ShaderNodeMath", -540, 60, operation="ADD")
    link(base_z.outputs[0], raw.inputs[0])
    link(drift2.outputs[0], raw.inputs[1])

    wrap = _new(ng, "ShaderNodeMath", -360, 60, operation="WRAP")
    wrap.inputs[1].default_value = top
    wrap.inputs[2].default_value = -4.0
    link(raw.outputs[0], wrap.inputs[0])

    comb = _new(ng, "ShaderNodeCombineXYZ", -160, 160)
    link(sep.outputs["X"], comb.inputs["X"])
    link(sep.outputs["Y"], comb.inputs["Y"])
    link(wrap.outputs[0], comb.inputs["Z"])

    setpos = _new(ng, "GeometryNodeSetPosition", 60, 0)
    link(pts.outputs["Points"], setpos.inputs["Geometry"])
    link(comb.outputs["Vector"], setpos.inputs["Position"])

    mote = _new(ng, "GeometryNodeMeshIcoSphere", 60, -300)
    mote.inputs["Radius"].default_value = 0.62
    mote.inputs["Subdivisions"].default_value = 1

    inst = _new(ng, "GeometryNodeInstanceOnPoints", 380, 0)
    link(setpos.outputs["Geometry"], inst.inputs["Points"])
    link(mote.outputs["Mesh"], inst.inputs["Instance"])

    setmat = _new(ng, "GeometryNodeSetMaterial", 640, 0)
    setmat.inputs["Material"].default_value = mat
    link(inst.outputs["Instances"], setmat.inputs["Geometry"])
    link(setmat.outputs["Geometry"], gout.inputs[0])
    return ng


# ------------------------------------------------------------------ the world
def build_environment():
    scene = bpy.context.scene
    coll = scene.collection

    # ---- sky ----------------------------------------------------------------
    world = bpy.data.worlds.new("Zanarkand")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = _new(nt, "ShaderNodeOutputWorld", 400, 0)
    bg = _new(nt, "ShaderNodeBackground", 200, 0)
    sky = _new(nt, "ShaderNodeTexSky", -60, 0)
    # "Nishita" was renamed to multiple-scattering in 5.x
    for kind in ("MULTIPLE_SCATTERING", "NISHITA"):
        if _try(sky, "sky_type", kind):
            break
    sky.sun_elevation = math.radians(2.4)      # the sun sitting on the water
    sky.sun_rotation = math.radians(-118.0)
    sky.sun_intensity = 0.45
    sky.sun_size = math.radians(3.2)
    sky.altitude = 0.0
    sky.air_density = 2.6                      # heavy air: long orange scatter
    _try(sky, "aerosol_density", 5.4)
    _try(sky, "dust_density", 5.4)             # pre-5.x name
    sky.ozone_density = 0.9
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    bg.inputs["Strength"].default_value = 0.38
    bg.inputs["Strength"].keyframe_insert("default_value", frame=1)
    bg.inputs["Strength"].default_value = 0.58
    bg.inputs["Strength"].keyframe_insert("default_value", frame=FRAMES)

    # ---- the sun ------------------------------------------------------------
    sun_data = bpy.data.lights.new("Sun", "SUN")
    sun_data.energy = 4.4
    sun_data.angle = math.radians(1.8)
    sun_data.color = (1.0, 0.60, 0.32)
    sun = bpy.data.objects.new("Sun", sun_data)
    sun.rotation_euler = (math.radians(88.0), 0.0, math.radians(-118.0))
    coll.objects.link(sun)

    # a cold counter-light from the far side, so shadowed faces read as stone
    # rather than as a black cut-out
    fill_data = bpy.data.lights.new("Fill", "SUN")
    fill_data.energy = 0.6
    fill_data.color = (0.40, 0.56, 0.86)
    fill = bpy.data.objects.new("Fill", fill_data)
    fill.rotation_euler = (math.radians(56.0), 0.0, math.radians(58.0))
    coll.objects.link(fill)

    # ---- the sea ------------------------------------------------------------
    bpy.ops.mesh.primitive_plane_add(size=9000, location=(0, 0, 0))
    ocean = bpy.context.object
    ocean.name = "Ocean"
    mat = bpy.data.materials.new("Ocean")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.010, 0.026, 0.042, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.085
    bsdf.inputs["Metallic"].default_value = 0.28
    noise = _new(nt, "ShaderNodeTexNoise", -640, -280)
    noise.inputs["Scale"].default_value = 46.0
    noise.inputs["Detail"].default_value = 6.0
    bump = _new(nt, "ShaderNodeBump", -380, -280)
    bump.inputs["Strength"].default_value = 0.26
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    ocean.data.materials.append(mat)

    # ---- haze ---------------------------------------------------------------
    # One large volume. Without it the far districts sit at the same apparent
    # depth as the arena and the shot has no air in it.
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 200))
    haze = bpy.context.object
    haze.name = "Haze"
    haze.scale = (3800, 3800, 500)
    hmat = bpy.data.materials.new("Haze")
    hmat.use_nodes = True
    hnt = hmat.node_tree
    hnt.nodes.clear()
    hout = _new(hnt, "ShaderNodeOutputMaterial", 300, 0)
    vol = _new(hnt, "ShaderNodeVolumePrincipled", 0, 0)
    vol.inputs["Color"].default_value = (0.54, 0.40, 0.33, 1.0)
    vol.inputs["Density"].default_value = 0.00040
    vol.inputs["Emission Strength"].default_value = 0.008
    vol.inputs["Emission Color"].default_value = (1.0, 0.50, 0.20, 1.0)
    hnt.links.new(vol.outputs["Volume"], hout.inputs["Volume"])
    haze.data.materials.append(hmat)
    _try(haze, "visible_shadow", False)

    # ---- pyreflies ----------------------------------------------------------
    pmat = bpy.data.materials.new("Pyrefly")
    pmat.use_nodes = True
    pb = pmat.node_tree.nodes["Principled BSDF"]
    pb.inputs["Base Color"].default_value = (0.75, 0.95, 1.0, 1.0)
    pb.inputs["Emission Color"].default_value = (0.62, 0.94, 1.0, 1.0)
    pb.inputs["Emission Strength"].default_value = 28.0

    for tag, count, extent, top, speed in (
        ("Near", 900, 200.0, 220.0, 0.85),
        ("Far", 700, 580.0, 350.0, 0.55),
    ):
        obj = bpy.data.objects.new(f"Pyreflies{tag}", bpy.data.meshes.new(f"Pyreflies{tag}"))
        coll.objects.link(obj)
        m = obj.modifiers.new("Pyreflies", "NODES")
        m.node_group = make_pyreflies(f"PyreflyGN{tag}", count, extent, top, speed, pmat)
        _try(obj, "visible_shadow", False)
    return ocean


# ------------------------------------------------------------------ the orbit
def build_camera():
    scene = bpy.context.scene
    coll = scene.collection

    target = bpy.data.objects.new("CamTarget", None)
    target.empty_display_size = 4.0
    coll.objects.link(target)

    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 34.0
    cam_data.clip_start = 0.5
    cam_data.clip_end = 14000.0
    cam = bpy.data.objects.new("Camera", cam_data)
    coll.objects.link(cam)
    scene.camera = cam

    track = cam.constraints.new("DAMPED_TRACK")
    track.target = target
    track.track_axis = "TRACK_NEGATIVE_Z"

    for f in range(1, FRAMES + 1):
        p = (f - 1) / (FRAMES - 1)
        swing = math.sin(math.pi * p)          # 0 at both ends, 1 mid-shot

        a = START_ANGLE + TAU * ORBIT_TURNS * p
        # in close and low across the middle, wide and high at the ends, so the
        # first and last frames are the same establishing shot
        r = 340.0 - 158.0 * swing ** 1.15
        z = 178.0 - 112.0 * swing ** 1.35

        cam.location = (math.cos(a) * r, math.sin(a) * r, z)
        cam.keyframe_insert("location", frame=f)
        target.location = (0.0, 0.0, 30.0 + 14.0 * swing)
        target.keyframe_insert("location", frame=f)

    return cam


# ------------------------------------------------------------------ the build
def setup():
    """Build the whole scene from scratch. Safe to call again."""
    here = os.path.dirname(os.path.abspath(__file__))
    if here not in sys.path:
        sys.path.insert(0, here)
    import importlib
    import zanarkand
    importlib.reload(zanarkand)

    # The camera is sampled every frame, so its curves must not be smoothed
    # between samples — a Bezier handle across a 360-degree orbit bows the path
    # off the circle. Setting the default here rather than walking the f-curves
    # afterwards: action data moved to slots/channelbags in 4.4 and the walk is
    # version-dependent, while this is not.
    prefs = bpy.context.preferences.edit
    prev_interp = prefs.keyframe_new_interpolation_type
    prefs.keyframe_new_interpolation_type = "LINEAR"

    objs, stats = zanarkand.build_city()
    by_name = {o.name: o for o in objs}

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = FRAMES

    # ---- the rebuild --------------------------------------------------------
    # Each restored layer has its own timing: cladding first and over the
    # longest window, the light snapping on behind it, the cascades last.
    plan = {
        "Clad":  dict(seed=3,  lift=230.0, spread=0.26, delay=0.00, span=0.30),
        "Neon":  dict(seed=17, lift=130.0, spread=0.12, delay=0.12, span=0.20),
        "Falls": dict(seed=29, lift=100.0, spread=0.08, delay=0.26, span=0.24),
    }
    for name, kw in plan.items():
        obj = by_name.get(name)
        if not obj:
            continue
        zs = [v.co.z for v in obj.data.vertices]
        m = obj.modifiers.new("Assemble", "NODES")
        m.node_group = make_assemble_group(f"Assemble{name}", min(zs), max(zs), **kw)

    # The sphere pool and its water are the arena filling — one smooth island
    # each, so they scale up into place instead of assembling.
    for name in ("Pool", "Water"):
        obj = by_name.get(name)
        if not obj:
            continue
        obj.scale = (0.001, 0.001, 0.001)
        obj.keyframe_insert("scale", frame=int(1 + (FRAMES - 1) * 0.36))
        obj.scale = (1.0, 1.0, 1.0)
        obj.keyframe_insert("scale", frame=int(1 + (FRAMES - 1) * 0.64))

    # ---- the light coming back ----------------------------------------------
    def ramp(mat_name, lo, hi, f0, f1):
        mat = bpy.data.materials.get(mat_name)
        bsdf = mat.node_tree.nodes.get("Principled BSDF") if mat and mat.use_nodes else None
        if not bsdf or "Emission Strength" not in bsdf.inputs:
            return
        s = bsdf.inputs["Emission Strength"]
        s.default_value = lo
        s.keyframe_insert("default_value", frame=f0)
        s.default_value = hi
        s.keyframe_insert("default_value", frame=f1)

    ramp("Glow", 1.2, 7.0, 1, int(1 + (FRAMES - 1) * 0.80))
    ramp("Neon", 2.0, 12.0, int(1 + (FRAMES - 1) * 0.20), int(1 + (FRAMES - 1) * 0.78))

    build_environment()
    build_camera()
    configure_render()
    prefs.keyframe_new_interpolation_type = prev_interp
    return stats


def configure_render():
    scene = bpy.context.scene
    _try(scene.render, "engine", "BLENDER_EEVEE")

    ee = scene.eevee
    for attr, value in (
        ("taa_render_samples", 48),
        ("use_raytracing", True),
        ("use_shadows", True),
        ("shadow_ray_count", 2),
        ("shadow_step_count", 6),
        ("use_fast_gi", True),
        ("volumetric_start", 1.0),
        ("volumetric_end", 6000.0),
        ("volumetric_samples", 56),
        ("use_volume_custom_range", True),
        ("use_volumetric_shadows", True),
        ("use_bloom", True),            # 4.1 and earlier only; ignored after
        ("bloom_intensity", 0.05),
    ):
        _try(ee, attr, value)

    scene.render.film_transparent = False
    _try(scene.view_settings, "view_transform", "AgX")
    scene.view_settings.exposure = 0.30

    # Bloom lives in the compositor from 4.2 on, and the whole look leans on it
    # — a Zanarkand with no halation around the neon is just a grey model. In
    # 5.x the scene's compositor is a node group hung off the scene rather than
    # a tree with a Composite node in it.
    ng = bpy.data.node_groups.get("ZanarkandComp")
    if ng:
        bpy.data.node_groups.remove(ng)
    ng = bpy.data.node_groups.new("ZanarkandComp", "CompositorNodeTree")
    _sock(ng, "Image", "INPUT", "NodeSocketColor")
    _sock(ng, "Image", "OUTPUT", "NodeSocketColor")
    gin = _new(ng, "NodeGroupInput", -300, 0)
    glare = _new(ng, "CompositorNodeGlare", 0, 0)
    gout = _new(ng, "NodeGroupOutput", 320, 0)
    for key, value in (("Type", "BLOOM"), ("Quality", "HIGH"), ("Threshold", 0.70),
                       ("Strength", 0.42), ("Size", 8.0), ("Smoothness", 0.4)):
        if key in glare.inputs:
            try:
                glare.inputs[key].default_value = value
            except (TypeError, ValueError):
                pass
    ng.links.new(gin.outputs[0], glare.inputs["Image"])
    ng.links.new(glare.outputs["Image"], gout.inputs[0])
    scene.use_nodes = True
    _try(scene, "compositing_node_group", ng)


# --------------------------------------------------------------------- output
def render_chunk(first, last, tier, out_dir):
    """Render frames [first, last] of one tier.

    Chunked so no single call runs long enough to be cut off. Every frame is a
    pure function of the frame number, so the chunks are independent.
    """
    w, h, q = TIERS[tier]
    scene = bpy.context.scene
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = q
    scene.render.image_settings.color_mode = "RGB"

    path = os.path.join(out_dir, tier)
    os.makedirs(path, exist_ok=True)
    scene.render.filepath = os.path.join(path, "f")
    scene.frame_start = first
    scene.frame_end = last
    bpy.ops.render.render(animation=True)
    scene.frame_start = 1
    scene.frame_end = FRAMES
    return len([n for n in os.listdir(path) if n.endswith(".webp")])


def render_still(frame, path, width=960, height=540, samples=32):
    """One frame to PNG, for checking the look without committing to a run."""
    scene = bpy.context.scene
    scene.frame_set(frame)
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.image_settings.file_format = "PNG"
    scene.eevee.taa_render_samples = samples
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return path


if __name__ == "__main__":
    print("ZANARKAND setup:", setup())
