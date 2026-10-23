"""The campus map's trees: three oaks from the owner's "Oak trees pack (17 variants, LODs, seasons, game-ready)"
(2026-10-23, a .usdz), cut down to what the map can draw ~900 times, exported as assets/models/campus-trees.glb.

    blender -b --factory-startup -P tools/blender_campus_trees.py -- PACK_DIR [OUT]

PACK_DIR: the unzipped .usdz (scene.usdc and its folder 0/ of textures). OUT defaults to assets/models/campus-trees.glb.

Taken from the pack: Small_oak_tree__001/002/003 at their lowest mesh LOD (LOD2, 160 to 250 triangles each: the medium
oaks' 1,100 made the map lag with ~900 of them, owner's report 2026-10-23, and look the same at map scale), summer
leaves (Cluster_Mat) and bark. Each tree becomes one mesh named oak1..oak3 with its trunk base at the origin, y up, and
a height of exactly 1 (the map scales every tree to the same fixed height: observatory/trees3d.js). The leaf texture is
reduced to 256 x 256 and the bark to 64 x 128; the leaves are drawn with an alpha test, so the alpha stays.
"""
import bpy, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
PACK = argv[0]
OUT = argv[1] if len(argv) > 1 else 'assets/models/campus-trees.glb'
TREES = ['Small_oak_tree__001', 'Small_oak_tree__002', 'Small_oak_tree__003']
TMP = os.path.join(os.path.dirname(os.path.abspath(OUT)), '.trees_tmp')
os.makedirs(TMP, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.usd_import(filepath=os.path.join(PACK, 'scene.usdc'))

def small(name, size):
    im = bpy.data.images.load(os.path.join(PACK, '0', name))
    im.scale(*size)
    p = os.path.join(TMP, name.rsplit('.', 1)[0] + '.png')
    im.filepath_raw = p; im.file_format = 'PNG'; im.save()
    return im

def material(name, img, alpha):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    if alpha:
        nt.links.new(t.outputs['Alpha'], b.inputs['Alpha'])
        m.blend_method = 'CLIP' if hasattr(m, 'blend_method') else m.blend_method
    b.inputs['Roughness'].default_value = .95
    return m

LEAF = material('oak_leaves', small('Cluster_Mat_baseColor.png', (256, 256)), True)
BARK = material('oak_bark', small('Bark_Mat_baseColor.jpg', (64, 128)), False)

keep = []
for i, name in enumerate(TREES, 1):
    parts = [o for o in bpy.data.objects if o.type == 'MESH' and o.parent and o.parent.name == name + '_LOD2']
    if not parts:
        raise SystemExit('no LOD2 meshes for ' + name)
    for o in parts:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world); o.parent = None; o.matrix_world.identity()
        leaf = 'Cluster' in o.name
        o.data.materials.clear(); o.data.materials.append(LEAF if leaf else BARK)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = parts[0]; ob.name = 'oak%d' % i; ob.data.name = 'oak%d' % i
    vs = [v.co for v in ob.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    base = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z)); h = mx.z - mn.z
    for v in ob.data.vertices:
        v.co = (v.co - base) / h
    ob.location = (i * 2.0, 0, 0)   # side by side in the file; the map places each one itself
    keep.append(ob)

for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_yup=True, export_apply=True,
                          export_image_format='AUTO', export_materials='EXPORT', export_normals=True, export_texcoords=True)
for f in os.listdir(TMP):
    os.remove(os.path.join(TMP, f))
os.rmdir(TMP)
print('TREES', [(o.name, len(o.data.polygons)) for o in keep], '->', OUT, os.path.getsize(OUT), 'bytes')
