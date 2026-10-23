"""The staircase stop the 3D map draws (observatory/stops3d.js): the owner's Pokestop heart (prototypes/pokestop-heart, merged
2026-10-23), its final pose built here as one light static model, since the prototype itself (a prism that tumbles into a
disc, 27 parts, about 12,000 triangles, a 10 s animation) is far too heavy for 25 stops on a map.

    blender -b --factory-startup -P tools/art/make_pokestop_glb.py -- assets/models/heart-stop.glb

A blue disc with a darker inner circle and a cyan rim, a white heart on it, a thin white rim and a white dashed orbit with a
bead, as on the prototype's contact sheet. Two meshes, 1 unit tall, standing upright on the post-less disc's axis, which is
the vertical (so it spins in place like a Pokestop):
  "tint"   the disc, the inner circle and the rim, in shades of white (vertex colours): the map multiplies it by the
           staircase's difficulty colour (Mild, Moderate, Vigorous), one material per difficulty
  "white"  the heart, the thin rim, the orbit and its bead: never tinted
About 1,500 triangles in all, so the map draws every stop in a handful of instanced calls.
"""
import bpy, math, os, sys

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'assets/models/heart-stop.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
C, R = .66, .31            # the disc's centre height and radius: .35 to .97 tall, the rest is air for the ground glow
UP = (math.radians(90), 0, 0)   # a cylinder or torus standing on its edge, its face toward the viewer (-y)

def material(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Roughness'].default_value = .45
    return m
MAT = material('stop')

def colour(ob, shade):
    a = ob.data.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT')
    for d in a.data:
        d.color = (shade, shade, shade, 1)
def part(ob, shade, smooth=True):
    ob.data.materials.clear(); ob.data.materials.append(MAT)
    for p in ob.data.polygons:
        p.use_smooth = smooth
    colour(ob, shade)
    return ob
def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); objs[0].name = name; objs[0].data.name = name
    return objs[0]

# ---- tinted: the disc, the inner circle (darker) and the rim (lighter)
tint = []
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=R, depth=.07, location=(0, 0, C), rotation=UP); tint.append(part(bpy.context.object, .88, False))
bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=R * .72, depth=.08, location=(0, -.012, C), rotation=UP); tint.append(part(bpy.context.object, .58, False))
bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=5, major_radius=R + .005, minor_radius=.024, location=(0, -.02, C), rotation=UP); tint.append(part(bpy.context.object, 1.0))
join(tint, 'tint')

# ---- white: the heart (the app's heart curve, flat and thick), the thin rim, the dashed orbit and its bead
white = []
import bmesh
bm = bmesh.new(); M = 40; vs = []
for i in range(M):
    t = i / M * 2 * math.pi
    x = 16 * math.sin(t) ** 3; y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
    vs.append(bm.verts.new((x / 21, y / 21 + .1, -.5)))
f = bm.faces.new(vs); r = bmesh.ops.extrude_face_region(bm, geom=[f])
for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]:
    v.co.z = .5
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('heart'); bm.to_mesh(me); bm.free()
heart = bpy.data.objects.new('heart', me); bpy.context.scene.collection.objects.link(heart)
heart.rotation_euler = UP; heart.scale = (.19, .19, .09); heart.location = (0, -.05, C - .01)   # about .38 wide, .09 thick, standing out of the inner circle
white.append(part(heart, 1.0))
bpy.ops.mesh.primitive_torus_add(major_segments=40, minor_segments=4, major_radius=R * .86, minor_radius=.01, location=(0, -.045, C), rotation=UP); white.append(part(bpy.context.object, 1.0))
# the orbit: a ring a little wider than the disc, tilted so it reads as an ellipse in front of and behind it, in six dashes
bpy.ops.mesh.primitive_torus_add(major_segments=36, minor_segments=4, major_radius=R * 1.22, minor_radius=.013, location=(0, 0, C), rotation=(math.radians(72), 0, math.radians(-18)))
orb = bpy.context.object
bm = bmesh.new(); bm.from_mesh(orb.data); bm.faces.ensure_lookup_table()
drop = [f for f in bm.faces if int(((math.atan2(f.calc_center_median().y, f.calc_center_median().x) % (2 * math.pi)) / (2 * math.pi)) * 12) % 2 == 1]   # every other twelfth
bmesh.ops.delete(bm, geom=drop, context='FACES')
bm.to_mesh(orb.data); bm.free()
white.append(part(orb, 1.0))
bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=5, radius=.034, location=(R * 1.22 * math.cos(math.radians(-18)), R * 1.22 * math.sin(math.radians(-18)) * math.cos(math.radians(72)) * 0, C + .0)); bead = bpy.context.object
bead.location = orb.matrix_world @ __import__('mathutils').Vector((R * 1.22, 0, 0))
white.append(part(bead, 1.0))
join(white, 'white')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)   # the vertices sit where they stand: the map instances the bare meshes
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                          export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False,
                          export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True)
print('POKESTOP', OUT, os.path.getsize(OUT), 'bytes', {o.name: len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH'})
