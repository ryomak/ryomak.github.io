# -----------------------------------------------------------------------------
# Zanarkand — the orbit shot.
#
# One continuous move: the camera circles the stadium once, and as it comes
# round, the cladding and the light that were lost a thousand years ago return
# from the waterline up, until the arena and the waterfront stand whole again
# at the same angle we started from. The sky turns over with it — a low sun
# behind the ruin at the start, a night city at the end.
#
# There are no chapters and no stops. The previous version cut the scroll into
# five and parked the camera at each, and every stop broke the thread: you were
# somewhere, then you were somewhere else, and nothing connected the two. A
# single orbit means the reader always knows where they are, because they never
# left.
#
# This renders it as an animation first, so the motion can be judged on its own
# before any of it is ported to the web.
#
# Usage, from Blender's Python:
#     import orbit; orbit.setup()
#     orbit.render_range(1, 120, "/abs/out", 960, 540)
#     orbit.encode("/abs/out", "/abs/out/orbit.mp4")     # needs ffmpeg
# -----------------------------------------------------------------------------
import bpy
import math
import os
import sys

import zanarkand

TAU = math.pi * 2

# ---- the shot ---------------------------------------------------------------
FRAMES = 120
START_ANGLE = math.radians(18.0)

# The orbit tightens and drops as it comes round, so the last third is inside
# the city rather than looking at it from the same distance as the first.
ORBIT_R = (330.0, 210.0)
ORBIT_Z = (165.0, 88.0)
LOOK_AT = (0.0, 0.0, 34.0)
LENS = 38.0

# Where the restoration sits inside the shot. It starts late and finishes
# early: the ruin gets the opening to itself, the finished city gets the end,
# and the change happens in the middle where it is being watched.
RESTORE_IN, RESTORE_OUT = 0.14, 0.82
# The world-space height the front travels through.
FRONT_Z = (-30.0, 420.0)

# When the sky turns over.
NIGHT_IN, NIGHT_OUT = 0.30, 0.88

SUN_BEARING = 196.0
SUN_ELEVATION = 2.4


def _clamp01(v):
    return 0.0 if v < 0.0 else (1.0 if v > 1.0 else v)


def _smooth(t):
    t = _clamp01(t)
    return t * t * (3.0 - 2.0 * t)


def _smoothstep(a, b, x):
    return _smooth((x - a) / (b - a)) if b != a else 0.0


def _lerp(a, b, t):
    return a + (b - a) * t


def _try(obj, attr, value):
    try:
        setattr(obj, attr, value)
        return True
    except Exception:
        return False


# ------------------------------------------------------------------- the sky
# Authored, not simulated. A physical atmosphere at two degrees of elevation
# renders a flat blue-grey; what this shot needs is the painted version — a
# hard warm band on the horizon with the sun sitting in it, going over to a
# starfield as the city comes back.
_SKY = {}


def _build_sky():
    world = bpy.data.worlds.new("OrbitSky")
    bpy.context.scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    coord.location = (-1500, 0)

    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sep.location = (-1320, 200)
    nt.links.new(coord.outputs["Normal"], sep.inputs["Vector"])

    lift = nt.nodes.new("ShaderNodeMapRange")
    lift.location = (-1140, 200)
    lift.inputs["From Min"].default_value = -0.18
    lift.inputs["From Max"].default_value = 0.55
    nt.links.new(sep.outputs["Z"], lift.inputs["Value"])

    def ramp(colors, y):
        node = nt.nodes.new("ShaderNodeValToRGB")
        node.location = (-960, y)
        cr = node.color_ramp
        cr.elements[0].position, cr.elements[0].color = colors[0]
        cr.elements[1].position, cr.elements[1].color = colors[-1]
        for pos, col in colors[1:-1]:
            cr.elements.new(pos).color = col
        nt.links.new(lift.outputs["Result"], node.inputs["Fac"])
        return node

    dusk = ramp([
        (0.0, (0.62, 0.22, 0.05, 1.0)),
        (0.13, (0.86, 0.36, 0.09, 1.0)),
        (0.31, (0.52, 0.18, 0.10, 1.0)),
        (0.58, (0.15, 0.08, 0.11, 1.0)),
        (1.0, (0.030, 0.038, 0.072, 1.0)),
    ], 340)
    night = ramp([
        (0.0, (0.045, 0.090, 0.135, 1.0)),
        (0.18, (0.026, 0.052, 0.090, 1.0)),
        (0.52, (0.010, 0.020, 0.044, 1.0)),
        (1.0, (0.004, 0.008, 0.020, 1.0)),
    ], 90)

    turn = nt.nodes.new("ShaderNodeMixRGB")
    turn.location = (-700, 220)
    turn.inputs["Fac"].default_value = 0.0
    nt.links.new(dusk.outputs["Color"], turn.inputs["Color1"])
    nt.links.new(night.outputs["Color"], turn.inputs["Color2"])

    # ---- the sun ------------------------------------------------------------
    b, e = math.radians(SUN_BEARING), math.radians(SUN_ELEVATION)
    sun_dir = (math.cos(b) * math.cos(e), math.sin(b) * math.cos(e), math.sin(e))

    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.location = (-1320, -220)
    dot.inputs[1].default_value = sun_dir
    nt.links.new(coord.outputs["Normal"], dot.inputs[0])

    def power(exp, y):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = "POWER"
        n.location = (-1140, y)
        n.inputs[1].default_value = exp
        nt.links.new(dot.outputs["Value"], n.inputs[0])
        return n

    glow_p = power(24.0, -180)
    disc_p = power(4200.0, -360)

    # Held down deliberately. A blown-out white disc plus bloom is not a bright
    # sunset, it is an uncomfortable screen — the sun should read by being
    # warmer than the sky around it.
    def fade(src, y):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = "MULTIPLY"
        n.location = (-960, y)
        n.inputs[1].default_value = 1.0
        nt.links.new(src.outputs["Value"], n.inputs[0])
        return n

    glow_f = fade(glow_p, -180)
    disc_f = fade(disc_p, -360)

    glow_add = nt.nodes.new("ShaderNodeMixRGB")
    glow_add.blend_type = "ADD"
    glow_add.location = (-520, 200)
    glow_add.inputs["Color2"].default_value = (1.30, 0.52, 0.16, 1.0)
    nt.links.new(turn.outputs["Color"], glow_add.inputs["Color1"])
    nt.links.new(glow_f.outputs["Value"], glow_add.inputs["Fac"])

    disc_add = nt.nodes.new("ShaderNodeMixRGB")
    disc_add.blend_type = "ADD"
    disc_add.location = (-340, 200)
    disc_add.inputs["Color2"].default_value = (2.6, 1.7, 0.9, 1.0)
    nt.links.new(glow_add.outputs["Color"], disc_add.inputs["Color1"])
    nt.links.new(disc_f.outputs["Value"], disc_add.inputs["Fac"])

    # ---- cloud bands --------------------------------------------------------
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.location = (-1320, 460)
    mapping.inputs["Scale"].default_value = (1.5, 1.5, 10.0)
    nt.links.new(coord.outputs["Normal"], mapping.inputs["Vector"])
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.location = (-1140, 460)
    noise.inputs["Scale"].default_value = 2.4
    noise.inputs["Detail"].default_value = 7.0
    noise.inputs["Roughness"].default_value = 0.6
    nt.links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    cramp = nt.nodes.new("ShaderNodeValToRGB")
    cramp.location = (-960, 460)
    cramp.color_ramp.elements[0].position = 0.46
    cramp.color_ramp.elements[1].position = 0.74
    nt.links.new(noise.outputs["Fac"], cramp.inputs["Fac"])
    cmul = nt.nodes.new("ShaderNodeMath")
    cmul.operation = "MULTIPLY"
    cmul.location = (-780, 460)
    cmul.inputs[1].default_value = 0.66
    nt.links.new(cramp.outputs["Color"], cmul.inputs[0])

    clouded = nt.nodes.new("ShaderNodeMixRGB")
    clouded.location = (-160, 240)
    clouded.inputs["Color2"].default_value = (0.045, 0.032, 0.040, 1.0)
    nt.links.new(disc_add.outputs["Color"], clouded.inputs["Color1"])
    nt.links.new(cmul.outputs["Value"], clouded.inputs["Fac"])

    nt.links.new(clouded.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.42
    nt.links.new(bg.outputs[0], out.inputs["Surface"])

    _SKY.update(turn=turn, glow=glow_f, disc=disc_f, bg=bg, cloud=cmul,
                sun_dir=sun_dir)


def _build_sun():
    data = bpy.data.lights.new("KeySun", type="SUN")
    data.energy = 6.0
    data.angle = math.radians(2.0)
    data.color = (1.0, 0.44, 0.16)
    obj = bpy.data.objects.new("KeySun", data)
    bpy.context.scene.collection.objects.link(obj)
    from mathutils import Vector
    d = Vector(_SKY["sun_dir"])
    obj.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()
    _SKY["sun"] = obj

    # A weak cool fill from the opposite side. The key is almost edge-on to
    # everything, so without this the near faces of the ruin are pure black and
    # the silhouettes lose their shape.
    fdata = bpy.data.lights.new("Fill", type="SUN")
    fdata.energy = 0.55
    fdata.color = (0.35, 0.52, 0.85)
    fill = bpy.data.objects.new("Fill", fdata)
    bpy.context.scene.collection.objects.link(fill)
    fill.rotation_euler = (math.radians(58), 0.0, math.radians(40))
    _SKY["fill"] = fill


# ----------------------------------------------------------- the restoration
# The restored layers are clipped against a world-space height that rises with
# the frame. Clipping rather than building means the whole city is present from
# frame one and the reveal costs a single number — and, more usefully, that the
# same idea ports to the web renderer unchanged.
_FRONT = []


def _build_restore_clip(names=("Clad", "Neon")):
    for name in names:
        mat = bpy.data.materials.get(name)
        if not mat or not mat.use_nodes:
            continue
        nt = mat.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        if not bsdf:
            continue

        geo = nt.nodes.new("ShaderNodeNewGeometry")
        geo.location = (-900, -300)
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        sep.location = (-720, -300)
        nt.links.new(geo.outputs["Position"], sep.inputs["Vector"])

        front = nt.nodes.new("ShaderNodeValue")
        front.name = "Front"
        front.label = "Front"
        front.location = (-720, -460)
        front.outputs[0].default_value = FRONT_Z[0]

        below = nt.nodes.new("ShaderNodeMath")
        below.operation = "LESS_THAN"
        below.location = (-520, -340)
        nt.links.new(sep.outputs["Z"], below.inputs[0])
        nt.links.new(front.outputs[0], below.inputs[1])
        nt.links.new(below.outputs["Value"], bsdf.inputs["Alpha"])

        # Blender renamed the alpha mode more than once; try each in turn.
        if not _try(mat, "blend_method", "CLIP"):
            _try(mat, "surface_render_method", "DITHERED")
        _try(mat, "shadow_method", "CLIP")

        _FRONT.append(front)


def _build_camera():
    data = bpy.data.cameras.new("OrbitCam")
    data.lens = LENS
    data.clip_end = 20000.0
    cam = bpy.data.objects.new("OrbitCam", data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    _SKY["cam"] = cam


def setup():
    """Build the city and everything the shot needs around it."""
    zanarkand.build_city()
    _FRONT.clear()
    _build_sky()
    _build_sun()
    _build_restore_clip()
    _build_camera()

    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = FRAMES
    scene.render.fps = 30
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    _try(scene.view_settings, "look", "AgX - Medium High Contrast")
    scene.view_settings.exposure = -0.3
    _try(scene.eevee, "use_raytracing", True)
    _try(scene.eevee, "use_gtao", True)
    _try(scene.eevee, "use_bloom", True)
    _try(scene.eevee, "bloom_intensity", 0.05)
    apply_frame(1)
    return {"front_nodes": len(_FRONT)}


def apply_frame(f):
    """Place everything for one frame. Pure function of the frame number, so a
    chunked render produces exactly the same result as one long one."""
    from mathutils import Vector
    t = (f - 1) / max(1, FRAMES - 1)

    # ---- camera: one full turn, tightening and dropping as it comes round
    a = START_ANGLE + TAU * t
    ease = _smooth(t)
    r = _lerp(ORBIT_R[0], ORBIT_R[1], ease)
    z = _lerp(ORBIT_Z[0], ORBIT_Z[1], ease)
    cam = _SKY["cam"]
    cam.location = (math.cos(a) * r, math.sin(a) * r, z)
    d = Vector(LOOK_AT) - Vector(cam.location)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

    # ---- the restoration front
    grow = _smoothstep(RESTORE_IN, RESTORE_OUT, t)
    front = _lerp(FRONT_Z[0], FRONT_Z[1], grow)
    for node in _FRONT:
        node.outputs[0].default_value = front

    # ---- the sky turning over
    night = _smoothstep(NIGHT_IN, NIGHT_OUT, t)
    _SKY["turn"].inputs["Fac"].default_value = night
    _SKY["glow"].inputs[1].default_value = 0.85 * (1.0 - night)
    _SKY["disc"].inputs[1].default_value = 1.5 * (1.0 - night)
    _SKY["cloud"].inputs[1].default_value = _lerp(0.66, 0.34, night)
    _SKY["bg"].inputs["Strength"].default_value = _lerp(0.42, 0.30, night)

    sun = _SKY["sun"].data
    sun.energy = _lerp(6.0, 0.35, night)
    sun.color = (_lerp(1.0, 0.55, night), _lerp(0.44, 0.66, night),
                 _lerp(0.16, 1.0, night))
    _SKY["fill"].data.energy = _lerp(0.55, 0.9, night)
    return {"t": round(t, 3), "front": round(front, 1), "night": round(night, 3)}


def render_range(first, last, out_dir, width=960, height=540, samples=24):
    """Render a span of frames. Kept chunkable so no single call runs long."""
    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    _try(scene.eevee, "taa_render_samples", samples)
    for f in range(first, last + 1):
        scene.frame_set(f)
        apply_frame(f)
        scene.render.filepath = os.path.join(out_dir, "f%04d.png" % f)
        bpy.ops.render.render(write_still=True)
    return {"rendered": [first, last]}


def encode(out_dir, mp4, fps=30):
    """Stitch the frames with ffmpeg, if it is on the path."""
    import subprocess
    cmd = ["ffmpeg", "-y", "-framerate", str(fps),
           "-i", os.path.join(out_dir, "f%04d.png"),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", mp4]
    p = subprocess.run(cmd, capture_output=True, text=True)
    return {"code": p.returncode, "err": p.stderr[-600:]}
