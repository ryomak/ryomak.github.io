"""An original water city, authored for the home-page journey.

blender --background --factory-startup --python scripts/blender/dream_city.py
Builds a reproducible PBR GLB, editable .blend and two preview renders.
Metres, Blender Z-up. No external models or textures.
"""
import bpy
import math
import random
import os
import json
import numpy as np
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / '.preview/dream-city'
OUT.mkdir(parents=True, exist_ok=True)
random.seed(1024)
TAU = math.tau
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

# Seamless mineral/algae maps. Texture detail survives glTF export, unlike nodes.
N = 512
yy, xx = np.mgrid[0:N, 0:N].astype(float) / N
rng = np.random.default_rng(19)
height = np.zeros((N, N))
for freq, amp in [(2, .3), (5, .2), (13, .12), (31, .07), (81, .025)]:
    for _ in range(4):
        a, b = rng.integers(-freq, freq + 1, 2)
        height += np.sin(TAU * (a * xx + b * yy) + rng.random() * TAU) * amp / 4
height += rng.random((N, N)) * .07
height = (height - height.min()) / (height.max() - height.min())

def image(name, pixels):
    img = bpy.data.images.new(name, N, N, alpha=True)
    img.pixels.foreach_set(pixels.astype(np.float32).ravel())
    img.filepath_raw = str(OUT / (name + '.png'))
    img.file_format = 'PNG'
    img.save()
    img.pack()
    return img

base = np.ones((N, N, 4))
for k, tint in enumerate([.69, .72, .66]):
    base[:, :, k] = (.39 + height * .55) * tint
base[:, :, 1] += np.maximum(0, .4 - height) * .13
color_map = image('mineral-color', base)
norm = np.ones((N, N, 4))
dx = np.roll(height, 1, 1) - np.roll(height, -1, 1)
dy = np.roll(height, 1, 0) - np.roll(height, -1, 0)
v = np.stack([dx * 2, dy * 2, np.ones_like(dx)], axis=-1)
v /= np.linalg.norm(v, axis=-1, keepdims=True)
norm[:, :, :3] = v * .5 + .5
normal_map = image('mineral-normal', norm)
normal_map.colorspace_settings.name = 'Non-Color'

def material(name, color, metallic=0, roughness=.6, emission=None, textured=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metallic
    bs.inputs['Roughness'].default_value = roughness
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    if textured:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = color_map
        m.node_tree.links.new(tex.outputs['Color'], bs.inputs['Base Color'])
        texn = m.node_tree.nodes.new('ShaderNodeTexImage')
        texn.image = normal_map
        normal = m.node_tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = .6
        m.node_tree.links.new(texn.outputs['Color'], normal.inputs['Color'])
        m.node_tree.links.new(normal.outputs['Normal'], bs.inputs['Normal'])
    return m

MATS = {
    'Limestone': material('Limestone', (.48,.51,.46), roughness=.84, textured=True),
    'RuinStone': material('RuinStone', (.39,.36,.31), roughness=.94, textured=True),
    'Basalt': material('Basalt', (.08,.115,.13), roughness=.85, textured=True),
    'Bronze': material('Bronze', (.29,.21,.105), .78, .3),
    'Patina': material('Patina', (.10,.25,.24), .58, .35),
    'Obsidian': material('Obsidian', (.022,.042,.062), .28, .27),
    'Ivory': material('Ivory', (.63,.66,.60), .1, .42),
    'WindowGold': material('WindowGold', (1,.58,.22), emission=3),
    'WindowBlue': material('WindowBlue', (.24,.72,1), emission=2.4),
    'LightJade': material('LightJade', (.12,.85,.69), emission=3),
    'WaterVolume': material('WaterVolume', (.05,.39,.51), .25, .13),
}

class Batch:
    def __init__(self, era, mat):
        self.era, self.mat = era, mat
        self.v, self.f, self.uv, self.colors = [], [], [], []
    def push(self, verts, faces, uv=None, shade=1):
        off = len(self.v)
        self.v.extend(verts)
        self.f.extend([tuple(off + j for j in f) for f in faces])
        self.uv.extend(uv or [(p[0]/12, p[2]/12) for p in verts])
        for p in verts:
            wear = .84 + .1 * math.sin(p[0]*.7 + p[1]*.31) * math.sin(p[2]*.27)
            if self.mat == 'RuinStone':
                wear *= .66 + .3 * min(1, max(0, p[2]/30))
            if self.mat == 'Basalt': wear *= .35
            self.colors.append((wear*shade, wear*shade, wear*shade, 1))
    def mesh(self, parent):
        if not self.v: return
        me = bpy.data.meshes.new(self.era + '_' + self.mat)
        me.from_pydata(self.v, [], self.f)
        me.materials.append(MATS[self.mat])
        uv = me.uv_layers.new(name='UVMap')
        colors = me.color_attributes.new(name='COLOR_0', type='BYTE_COLOR', domain='CORNER')
        for poly in me.polygons:
            poly.use_smooth = True
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                uv.data[li].uv = self.uv[vi]
                colors.data[li].color = self.colors[vi]
        me.update()
        ob = bpy.data.objects.new(self.era + '_' + self.mat, me)
        bpy.context.collection.objects.link(ob)
        ob.parent = parent
        return ob

batches = {}
def B(era, mat):
    key = (era, mat)
    if key not in batches: batches[key] = Batch(era, mat)
    return batches[key]

def lathe(batch, center, profile, segments=48, start=0, span=TAU, broken=False):
    verts, uv, faces = [], [], []
    for j, (r,z) in enumerate(profile):
        for i in range(segments+1):
            a = start + i/segments * span
            dz = 0
            if broken and z >= max(v[1] for v in profile) - .01:
                dz = math.sin(a*7.0+1.3)*3.2 + math.sin(a*13.0)*1.8
            verts.append((center[0]+r*math.cos(a),center[1]+r*math.sin(a),z+dz))
            uv.append((i/segments * max(1,r*.3), z/12))
    for j in range(len(profile)-1):
        for i in range(segments):
            k = j*(segments+1)+i
            faces.append((k,k+1,k+segments+2,k+segments+1))
    batch.push(verts,faces,uv)

def box(batch, center, dims, angle=0, shade=1):
    x,y,z = center
    w,d,h = (v/2 for v in dims)
    cs,sn = math.cos(angle),math.sin(angle)
    # Split vertices per face: flat normals on masonry and crisp slab edges.
    corners = [(-w,-d,-h),(w,-d,-h),(w,d,-h),(-w,d,-h),(-w,-d,h),(w,-d,h),(w,d,h),(-w,d,h)]
    for f in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
        verts = [(x+corners[k][0]*cs-corners[k][1]*sn,y+corners[k][0]*sn+corners[k][1]*cs,z+corners[k][2]) for k in f]
        batch.push(verts, [(0,1,2,3)], shade=shade)

def tube(batch, points, radius, sides=7):
    verts, faces = [], []
    for i,pt in enumerate(points):
        p=Vector(pt)
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
        tangent.normalize()
        ref=Vector((0,0,1)) if abs(tangent.z)<.95 else Vector((1,0,0))
        n=tangent.cross(ref).normalized()
        b=tangent.cross(n).normalized()
        rr=radius if isinstance(radius,(int,float)) else radius[i]
        for j in range(sides):
            a=j/sides*TAU
            verts.append(tuple(p+rr*(n*math.cos(a)+b*math.sin(a))))
    for i in range(len(points)-1):
        for j in range(sides):
            k=i*sides+j
            nj=i*sides+(j+1)%sides
            faces.append((k,nj,nj+sides,k+sides))
    batch.push(verts,faces)

def arcbeam(batch, radius, z, start, span, thickness=.5):
    tube(batch,[(radius*math.cos(start+t/32*span),radius*math.sin(start+t/32*span),z) for t in range(33)],thickness)

# City composition: open water in front, dense districts behind and on the flanks.
towers=[]
for i in range(62):
    a = .24 + i * 2.399963
    r = 245 + (i%5)*62 + random.uniform(-20,20)
    x,y = math.cos(a)*r, math.sin(a)*r
    # Reserve the camera-side canal. No tower crosses the hero sightline.
    if y < -90 and abs(x)<170: continue
    height=random.uniform(62,160) + (55 if y>130 and i%4==0 else 0)
    towers.append((x,y,random.uniform(9,18),height,i))
# Landmark towers establish an intentionally asymmetrical skyline.
towers += [(-225,65,23,218,100),(220,165,21,248,101),(-350,240,24,273,102),(105,385,25,235,103)]

# Four elevated water districts, with overflow lips feeding WebGL waterfalls.
for j,(x,y) in enumerate([(-300,160),(300,230),(-480,320),(480,380)]):
    towers.append((x,y,24,170+j*16,104+j))
    lathe(B('Permanent','Basalt'),(x,y),[(72,-8),(75,0),(65,16),(70,36),(76,40),(76,43),(0,43)],64)
    lathe(B('Dream','Ivory'),(x,y),[(70,40),(78,41),(78,44),(70,44)],64)
    lathe(B('Dream','LightJade'),(x,y),[(77.9,42),(77.9,42.4)],64)
    # Overflow basin behind the cascade.
    box(B('Dream','Obsidian'),(x,y-60,44),(48,26,1))

for x,y,r,h,i in towers:
    starts={key:len(batch.v) for key,batch in batches.items()}

    center=(x,y)
    plinth=[(r*1.5,-5),(r*1.5,5),(r*1.35,8),(r*1.35,12),(r,15)]
    lathe(B('Permanent','Basalt'),center,plinth,32)
    if i%3 == 0:
        # Bulbous crown and needle: echoes the city's ornate, aquatic silhouette.
        profile=[(r,12),(r,19),(r*.85,22),(r*.85,h*.60),(r*.75,h*.70),(r*1.12,h*.80),(r*1.14,h*.86),(r*.98,h*.94),(r*.52,h*1.02),(r*.08,h*1.11)]
    elif i%3 == 1:
        # Stepped lantern tower, with broad terraces below its crown.
        profile=[(r,12),(r,21),(r*.9,23),(r*.9,h*.48),(r*1.06,h*.50),(r*1.06,h*.56),(r*.76,h*.59),(r*.76,h*.82),(r*.91,h*.84),(r*.70,h*.93),(r*.1,h+12)]
    else:
        profile=[(r,12),(r,19),(r*.85,22),(r*.85,h*.55),(r*.76,h*.72),(r*.64,h*.87),(r*.50,h*.94),(r*.08,h+18)]
    lathe(B('Dream','Limestone'),center,profile,40)
    # Crown terraces and undercut balcony cornices.
    for z,rr in [(20,r*1.13),(h*.42,r),(h*.70,r*.95),(h*.86,r*.80),(h*.94,r*.62)]:
        lathe(B('Dream','Bronze'),center,[(rr*.86,z-2),(rr,z-1),(rr,z+.5),(rr*.86,z+1)],40)
    # Sweeping exterior ribs, each ending in a slender finial.
    for k in range(8):
        a=k/8*TAU
        points=[]
        for j in range(12):
            t=j/11
            rr=r*(1.09-.58*t+.16*math.sin(t*math.pi))
            points.append((x+rr*math.cos(a),y+rr*math.sin(a),14+t*(h+8)))
        tube(B('Dream','Patina'),points,[1.0*(1-j/14) for j in range(12)])
    # Rooms, recessed between the ribs; no unbroken neon cylinder.
    for floor in range(5,int(h*.86),7):
        z=floor+17
        rr=r*.85
        for (r0,z0),(r1,z1) in zip(profile,profile[1:]):
            if z0 <= z <= z1 and z1 > z0:
                rr=r0+(r1-r0)*(z-z0)/(z1-z0)
                break
        rr+=.18
        for k in range(16):
            if random.random()<.19: continue
            a=k/16*TAU
            mat='WindowGold' if random.random()<.7 else 'WindowBlue'
            # curved panes built in short angular segments
            lathe(B('Dream',mat),center,[(rr,z),(rr,z+2.1)],2,a+.05,.13)
    # The same footprint survives, with hollow jagged walls and missing cornices.
    cut=h*random.uniform(.27,.63)
    lathe(B('Ruins','RuinStone'),center,[(r,12),(r,18),(r*.87,22),(r*.87,cut),(r*.69,cut),(r*.69,16)],32,broken=True)
    for z in range(25,int(cut-5),18):
        lathe(B('Ruins','RuinStone'),center,[(r*.86,z-1),(r*1.02,z),(r*1.02,z+1),(r*.86,z+2)],24, start=.3*i,span=TAU*.83)
    for k in range(5):
        a=k/5*TAU+i
        tube(B('Ruins','Bronze'),[(x+r*.88*math.cos(a),y+r*.88*math.sin(a),15),(x+r*.88*math.cos(a),y+r*.88*math.sin(a),cut+random.uniform(-3,7))],.6,5)
    for j in range(5):
        a=random.random()*TAU
        rr=random.uniform(r,r*2)
        box(B('Ruins','RuinStone'),(x+math.cos(a)*rr,y+math.sin(a)*rr,3+random.random()*2),(random.uniform(3,9),random.uniform(3,7),random.uniform(2,5)),a)

    if i>=104:
        for key,batch in batches.items():
            start=starts.get(key,0)
            batch.v[start:]=[(vx,vy,vz+43) for vx,vy,vz in batch.v[start:]]

# Aqueduct districts: two concentric arcades with gaps facing the viewer.
for radius in [195,330]:
    for i in range(48):
        a=i/48*TAU
        if math.sin(a)<-.72: continue
        span=TAU/48
        for era in ['Dream','Ruins']:
            if era=='Ruins' and i%5 in [0,1]: continue
            stone='Limestone' if era=='Dream' else 'RuinStone'
            lathe(B(era,stone),(0,0),[(radius-7,25),(radius-7,28),(radius+7,28),(radius+7,25)],6,a,span*.98)
            # Inverted U with real open space beneath it.
            points=[]
            for k in range(17):
                t=k/16
                aa=a+t*span
                z=5+19*math.sin(t*math.pi)**.7
                points.append((radius*math.cos(aa),radius*math.sin(aa),z))
            tube(B(era,stone),points,2.0,6)
            if era=='Dream':
                for rr in [radius-6,radius+6]: arcbeam(B(era,'Bronze'),rr,31,a,span,.35)
                arcbeam(B(era,'LightJade'),radius+7,26,a,span,.22)

# Stadium: an inhabitable, layered bowl, with seats, concourses and radial stairs.
for era in ['Dream','Ruins']:
    stone='Ivory' if era=='Dream' else 'RuinStone'
    for sector in range(24):
        if era=='Ruins' and sector%5 in [0,1]: continue
        a=sector/24*TAU
        span=TAU/24*.94
        profile=[(72,7),(94,9),(110,17),(124,36),(124,41),(119,42),(88,17),(72,15)]
        lathe(B(era,stone),(0,0),profile,8,a,span)
        if era=='Dream':
            for row in range(18):
                rr=87+row*1.8
                z=17+row*1.28
                lathe(B(era,'Obsidian'),(0,0),[(rr,z),(rr,z+.55),(rr+1.3,z+.55),(rr+1.3,z)],7,a,span)
                # tiny seating markers catch light, rather than a flat empty bowl
                for seat in range(8):
                    aa=a+(seat+.5)/8*span
                    box(B(era,'Patina'),(rr*math.cos(aa),rr*math.sin(aa),z+.8),(.85,1,.65),aa)
            arcbeam(B(era,'LightJade'),124.3,40,a,span,.45)
            arcbeam(B(era,'WindowGold'),111,18,a,span,.4)
            for j in range(7):
                aa=a+j/7*span
                tube(B(era,'Bronze'),[(124*math.cos(aa),124*math.sin(aa),7),(124*math.cos(aa),124*math.sin(aa),38)],.9)
    # Monumental curved buttresses cradle the water sphere without enclosing it.
    for k in range(10):
        a=k/10*TAU
        limit=21 if era=='Dream' else 7+(k%4)
        points=[]
        for j in range(limit):
            t=j/20
            rr=131-48*t+17*math.sin(t*math.pi)
            points.append((rr*math.cos(a),rr*math.sin(a),5+156*t))
        tube(B(era,'Patina' if era=='Dream' else 'RuinStone'),points,[3.8*(1-j/25) for j in range(limit)],9)
        if era=='Dream':
            tube(B(era,'Bronze'),[(x*1.018,y*1.018,z) for x,y,z in points],.52,6)
            # Outer light strips stop below the tips; keep the silhouette elegant.
            tube(B(era,'LightJade'),[(x*.985,y*.985,z) for x,y,z in points[2:16]],.28,5)
    lathe(B(era,stone),(0,0),[(62,4),(70,5),(74,9),(74,12),(62,12)],96)

# Crown above the arena is deliberately broken into arcs, not a sci-fi halo.
for k in range(10):
    a=k/10*TAU
    arcbeam(B('Dream','Bronze'),99,128,a,.40,1.25)
    arcbeam(B('Dream','WindowGold'),99,127.4,a,.40,.24)

# Front ceremonial causeway, and its broken predecessor.
for era in ['Dream','Ruins']:
    stone='Limestone' if era=='Dream' else 'RuinStone'
    for j in range(14):
        if era=='Ruins' and j in [3,4,8,11]: continue
        y=-139-j*14
        box(B(era,stone),(0,y,9),(22,13.7,3))
        for x in [-10,10]:
            box(B(era,stone),(x,y,3),(2.8,4,12))
            if era=='Dream':
                box(B(era,'Bronze'),(x,y,13),(1,13.7,.7))
                box(B(era,'WindowGold'),(x,y,13.5),(.3,13.7,.24))

# Sea stacks and natural islands: broad eroded strata, never a spiky heightfield.
for i in range(14):
    a=.2+i/14*TAU
    radius=650+(i%3)*80
    x,y=math.cos(a)*radius,math.sin(a)*radius
    if y<0 and abs(x)<500: continue
    rr=80+random.random()*95
    h=35+random.random()*85
    profile=[(rr*1.25,-8),(rr*1.20,2),(rr,12),(rr*.88,h*.5),(rr*.65,h),(rr*.3,h*1.08),(0,h*1.04)]
    lathe(B('Permanent','Basalt'),(x,y),profile,40,broken=True)

# Roots remain separate so each era has exactly one transition contract.
roots={}
for era in ['Permanent','Ruins','Dream']:
    ob=bpy.data.objects.new(era,None)
    bpy.context.collection.objects.link(ob)
    roots[era]=ob
for (era,mat),batch in batches.items(): batch.mesh(roots[era])

bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=64,radius=63,location=(0,0,101))
sphere=bpy.context.object
sphere.name='WaterVolume'
sphere.data.materials.append(MATS['WaterVolume'])
sphere.parent=roots['Dream']
for poly in sphere.data.polygons: poly.use_smooth=True

# GLB is authored geometry + portable PBR only. Sea/sky/particles live in WebGL.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/dream-city.glb'),export_format='GLB',
    use_selection=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_normals=True,export_texcoords=True,export_extras=True)
print('MODEL_EXPORTED',flush=True)

# Offline look-development: render both states before wiring the browser.
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1440
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.world.use_nodes=True
world=scene.world.node_tree.nodes.get('Background')
world.inputs['Color'].default_value=(.11,.19,.31,1)
world.inputs['Strength'].default_value=.45
scene.view_settings.view_transform='AgX'

bpy.ops.mesh.primitive_plane_add(size=8000,location=(0,0,0))
sea=bpy.context.object
sea.name='Preview_Ocean'
sea.data.materials.append(material('PreviewOcean',(.025,.075,.095),.65,.18))
# Small normal undulations for the preview water.
bs=sea.active_material.node_tree.nodes.get('Principled BSDF')
noise=sea.active_material.node_tree.nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value=1.4
bump=sea.active_material.node_tree.nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value=.15
bump.inputs['Distance'].default_value=.8
sea.active_material.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
sea.active_material.node_tree.links.new(bump.outputs['Normal'],bs.inputs['Normal'])

def area(name,pos,color,power,size,target=(0,0,70)):
    data=bpy.data.lights.new(name,'AREA')
    data.energy=power
    data.color=color
    data.shape='DISK'
    data.size=size
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=pos
    ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob

key=area('Moon',(-150,-100,450),(.43,.66,1),2500000,400)
fill=area('CityBounce',(100,-250,180),(.25,1,.78),1800000,280)
bpy.ops.object.light_add(type='SUN',location=(-400,400,100))
sun=bpy.context.object
sun.rotation_euler=(math.radians(65),math.radians(-25),math.radians(-145))
sun.data.energy=2
sun.data.color=(.48,.66,1)
bpy.ops.object.camera_add(location=(310,-480,210))
cam=bpy.context.object
cam.rotation_euler=(Vector((0,30,82))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens=42
scene.camera=cam
# Dream sphere is a translucent volume in the offline render.
bs=MATS['WaterVolume'].node_tree.nodes.get('Principled BSDF')
bs.inputs['Transmission Weight'].default_value=.7
bs.inputs['IOR'].default_value=1.333
bs.inputs['Emission Color'].default_value=(.03,.30,.38,1)
bs.inputs['Emission Strength'].default_value=.25

def visible(root, value):
    for obj in root.children_recursive: obj.hide_render=not value

visible(roots['Ruins'],False)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'dream-city.blend'))
scene.render.filepath=str(OUT/'dream.png')
bpy.ops.render.render(write_still=True)
visible(roots['Dream'],False)
visible(roots['Ruins'],True)
cam.location=(240,-540,130)
cam.rotation_euler=(Vector((0,55,45))-cam.location).to_track_quat('-Z','Y').to_euler()
sun.data.color=(1,.61,.34)
sun.data.energy=2.8
key.data.color=(1,.63,.35)
fill.data.energy=700000
world.inputs['Color'].default_value=(.35,.19,.13,1)
scene.render.filepath=str(OUT/'ruins.png')
bpy.ops.render.render(write_still=True)
print('PREVIEWS_COMPLETE',flush=True)
