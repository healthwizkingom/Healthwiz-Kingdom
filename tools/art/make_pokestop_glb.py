"""The staircase stop the 3D map draws (observatory/stops3d.js): the owner's Pokestop heart (prototypes/pokestop-heart, merged
2026-10-23), built here as one light model that the map animates on the GPU. The prototype itself (27 parts, about 12,000
triangles, keyframes) is far too heavy for 25 stops; this has the same look and loop in about 1,300 triangles.

    blender -b --factory-startup -P tools/art/make_pokestop_glb.py -- assets/models/heart-stop.glb

Three meshes, 1 unit tall, the disc's axis along the glTF z (it faces the viewer; the map turns it about the vertical):
  "body"   the pentagonal prism, with one shape key, "Disc": the flat disc it morphs into (the same vertices)
  "tint"   the inner circle and the cyan rim, which grow in as the disc forms
  "white"  the heart, the thin white rim and the dashed orbit with its bead (the heart pops in with the rim, the orbit is
           always there and turns)
Shades of white are vertex colours; the map multiplies body and tint by the staircase's difficulty colour (Mild, Moderate,
Vigorous) and leaves white white. Every vertex has a "_part" number (0 body, 1 inner circle, 2 cyan rim, 3 heart, 4 white rim,
5 orbit and bead) which the map's vertex shader uses to play the prototype's timeline (10 s, 240 frames at 24 fps):
  1-90 the prism tumbles in 3D and flattens (50-90) into the disc; 85-105 the inner circle, rims and heart grow in;
  105-217 the heart pulses and the orbit turns; 217-241 everything reverses to the prism, so the loop is seamless.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'assets/models/heart-stop.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
C, R = .66, .31            # the disc's centre height and radius: .35 to .97 tall, the rest is air for the ground glow
UP = (math.radians(90), 0, 0)   # a cylinder or torus standing on its edge, its face toward the viewer (-y)
N = 30                      # vertices round the prism's and the disc's outline (a multiple of 5: six to a pentagon side)
PR, PD, DD = .15, .17, .07  # the prism's corner radius and depth, the disc's depth (the prototype's 1.33 : 1.6 : 0.3 against a disc of 3.0)

def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = .45
    return m
MAT = material('stop')

def tag(ob, shade, part, smooth=True):
    ob.data.materials.clear(); ob.data.materials.append(MAT)
    for p in ob.data.polygons:
        p.use_smooth = smooth
    a = ob.data.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
    for d in a.data:
        d.color = (shade, shade, shade, 1)
    b = ob.data.attributes.new('_part', 'FLOAT', 'POINT')
    for d in b.data:
        d.value = part
    return ob
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); objs[0].name = name; objs[0].data.name = name
    return objs[0]

# ---- body: the pentagonal prism and, in the shape key, the disc (same vertices: N round each face, plus a centre each)
def pentagon(i, y):
    k, j = divmod(i, N // 5)
    a0, a1 = math.radians(90 + 72 * k), math.radians(90 + 72 * (k + 1))
    p0, p1 = (PR * math.cos(a0), PR * math.sin(a0)), (PR * math.cos(a1), PR * math.sin(a1))
    t = j / (N // 5)
    return Vector((p0[0] + (p1[0] - p0[0]) * t, y, C + p0[1] + (p1[1] - p0[1]) * t))
def circle(i, y):
    a = math.radians(90) + 2 * math.pi * i / N
    return Vector((R * math.cos(a), y, C + R * math.sin(a)))
prism = [pentagon(i, -PD / 2) for i in range(N)] + [pentagon(i, PD / 2) for i in range(N)] + [Vector((0, -PD / 2, C)), Vector((0, PD / 2, C))]
disc = [circle(i, -DD / 2) for i in range(N)] + [circle(i, DD / 2) for i in range(N)] + [Vector((0, -DD / 2, C)), Vector((0, DD / 2, C))]
faces = []
for i in range(N):
    j = (i + 1) % N
    faces.append((i, N + i, N + j, j))                  # the side, facing out
    faces.append((2 * N, i, j))                         # the front cap (toward the viewer, -y)
    faces.append((2 * N + 1, N + j, N + i))             # the back cap
me = bpy.data.meshes.new('body'); me.from_pydata([tuple(v) for v in prism], [], faces); me.update()
body = bpy.data.objects.new('body', me); bpy.context.scene.collection.objects.link(body)
body.shape_key_add(name='Basis'); sk = body.shape_key_add(name='Disc')
for i, v in enumerate(disc):
    sk.data[i].co = v
tag(body, .88, 0, smooth=False)

# ---- tint: the inner circle (darker) and the cyan rim, grown in from the disc's centre
tint = []
# (a turning coin shows its face on both sides: the inner circle and the rim stand out of the disc to the front and the back,
# and the thin white rim and the heart below are in pairs)
bpy.ops.mesh.primitive_cylinder_add(vertices=N, radius=R * .72, depth=DD + .02, location=(0, 0, C), rotation=UP); tint.append(tag(bpy.context.object, .58, 1, False))
bpy.ops.mesh.primitive_torus_add(major_segments=N, minor_segments=4, major_radius=R + .005, minor_radius=.03, location=(0, 0, C), rotation=UP); tint.append(tag(bpy.context.object, 1.0, 2))
join(tint, 'tint')

# ---- white: the heart (the app's heart curve, flat and thick), the thin rim, the dashed orbit and its bead
white = []
bm = bmesh.new(); M = 28; vs = []
for i in range(M):
    t = i / M * 2 * math.pi
    x = 16 * math.sin(t) ** 3; y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
    vs.append(bm.verts.new((x / 21, y / 21 + .1, -.5)))
f = bm.faces.new(vs); r = bmesh.ops.extrude_face_region(bm, geom=[f])
for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]:
    v.co.z = .5
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
hm = bpy.data.meshes.new('heart'); bm.to_mesh(hm); bm.free()
heart = bpy.data.objects.new('heart', hm); bpy.context.scene.collection.objects.link(heart)
heart.rotation_euler = UP; heart.scale = (.19, .19, .09); heart.location = (0, -.05, C - .01)   # about .38 wide, .09 thick, standing out of the inner circle
white.append(tag(heart, 1.0, 3))
heart2 = heart.copy(); heart2.data = heart.data.copy(); bpy.context.scene.collection.objects.link(heart2); heart2.location = (0, .05, C - .01)   # the same on the back
white.append(tag(heart2, 1.0, 3))
for y in (-.045, .045):
    bpy.ops.mesh.primitive_torus_add(major_segments=N, minor_segments=3, major_radius=R * .86, minor_radius=.011, location=(0, y, C), rotation=UP); white.append(tag(bpy.context.object, 1.0, 4))
# the orbit: a ring a little wider than the disc, tilted so it reads as an ellipse in front of and behind it, in six dashes
TILT = (math.radians(72), 0, math.radians(-18))
bpy.ops.mesh.primitive_torus_add(major_segments=36, minor_segments=3, major_radius=R * 1.22, minor_radius=.015, location=(0, 0, C), rotation=TILT)
orb = bpy.context.object
bm = bmesh.new(); bm.from_mesh(orb.data); bm.faces.ensure_lookup_table()
drop = [f for f in bm.faces if int(((math.atan2(f.calc_center_median().y, f.calc_center_median().x) % (2 * math.pi)) / (2 * math.pi)) * 12) % 2 == 1]   # every other twelfth
bmesh.ops.delete(bm, geom=drop, context='FACES')
bm.to_mesh(orb.data); bm.free()
white.append(tag(orb, 1.0, 5))
bpy.ops.mesh.primitive_uv_sphere_add(segments=6, ring_count=4, radius=.036); bead = bpy.context.object
bead.location = orb.matrix_world @ Vector((R * 1.22, 0, 0))
white.append(tag(bead, 1.0, 5))
join(white, 'white')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)   # the vertices sit where they stand: the map instances the bare meshes
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True,
                          export_attributes=True, export_morph=True, export_morph_normal=True)
print('POKESTOP', OUT, os.path.getsize(OUT), 'bytes', {o.name: len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'})
