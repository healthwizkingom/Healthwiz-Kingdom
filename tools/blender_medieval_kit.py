"""The Fantasy map's medieval houses and castle, cut from the owner's model packs (2026-10-23) into one small kit:
tools/art/medieval-kit.glb, which tools/blender_campus.py --medieval places on the OpenStreetMap footprints.

    blender -b --factory-startup -P tools/blender_medieval_kit.py -- HOUSES_A HOUSES_B CASTLE [OUT]

Each argument is an unzipped .usdz folder (scene.usdc and its folder 0/ of textures):
  HOUSES_A  "Medieval House Pack"                          timber houses with tiled roofs
  HOUSES_B  "PACK 01 Stylized Medieval Houses (UE Ready)"  half-timbered houses with red roofs
  CASTLE    "CurtPrcelain ... T.W.O"                        the castle with spired towers (for the large academic block)

A pack is one scene of several houses: its meshes are grouped into houses by overlapping outlines (seen from above).
Loose pieces (a group of one mesh: a door, a wall panel, a spare roof) and houses more than 1.6 times as tall as they are wide (the watchtowers)
are left out. Every house and the castle become a closed low-poly shell (a voxel remesh of the whole piece, reduced to
HOUSE_TRIS or CASTLE_TRIS triangles) with the full-detail piece baked onto it (Cycles, colour only, no lighting: one
512 x 512 texture per house, 1024 x 1024 for the castle), so the map draws each in one call. Reducing the pieces
themselves broke them: pack A's houses are thousands of loose shingles and beams, and the castle, cut from 1.26 million
triangles, fell apart into shards (owner's report, 2026-10-23).
Every piece is stored with its base at the origin and its footprint centred, z up, named house_NN or castle, with its
size in metres as custom properties (the packs' units are not metres: the campus script scales each piece to its footprint).
"""
import bpy, bmesh, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
HOUSES_A, HOUSES_B, CASTLE = argv[:3]
OUT = argv[3] if len(argv) > 3 else 'tools/art/medieval-kit.glb'
HOUSE_TRIS, CASTLE_TRIS, TEX = 1200, 10000, 512   # the map draws ~120 houses: about the old buildings' 123,000 triangles in all
TMP = os.path.abspath(os.path.join(os.path.dirname(OUT) or '.', '.kit_tmp'))
os.makedirs(TMP, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
sc.render.bake.margin = 4

def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return Vector([min(p[i] for p in pts) for i in range(3)]), Vector([max(p[i] for p in pts) for i in range(3)])

def load(folder):
    before = set(bpy.data.objects)
    bpy.ops.wm.usd_import(filepath=os.path.join(folder, 'scene.usdc'))
    return [o for o in bpy.data.objects if o not in before and o.type == 'MESH']

def houses(meshes):
    """Group meshes whose outlines (x, y) overlap: one group per house."""
    bb = {o: bounds([o]) for o in meshes}
    par = {o: o for o in meshes}
    def root(o):
        while par[o] is not o:
            par[o] = par[par[o]]; o = par[o]
        return o
    for i, a in enumerate(meshes):
        for b in meshes[i + 1:]:
            A, B = bb[a], bb[b]
            if all(A[0][k] - 1 <= B[1][k] and B[0][k] - 1 <= A[1][k] for k in range(2)):
                par[root(a)] = root(b)
    groups = {}
    for o in meshes:
        groups.setdefault(root(o), []).append(o)
    return sorted(groups.values(), key=lambda g: tuple(bounds(g)[0]))

def join(objs, name):
    for o in objs:
        o.data = o.data.copy()
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(objs) > 1:
        bpy.ops.object.join()
    ob = objs[0]; ob.name = name; ob.data.name = name
    return ob

def decimate(ob, tris):
    for _ in range(3):   # a collapse can stop short of the target (seams, loose parts): again from where it stopped
        n = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        if n <= tris * 1.05:
            break
        m = ob.modifiers.new('cut', 'DECIMATE'); m.ratio = tris / n; m.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = ob; bpy.ops.object.modifier_apply(modifier=m.name)
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)

def smooth(ob, angle):
    """Shade smooth across edges flatter than angle (radians): neighbouring triangles then share their vertices in the file."""
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.shade_smooth_by_angle(angle=angle)

def to_origin(ob):
    mn, mx = bounds([ob])
    d = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    ob.data.transform(__import__('mathutils').Matrix.Translation(-d)); ob.location = (0, 0, 0)
    size = mx - mn
    ob['w'], ob['d'], ob['h'] = round(size.x, 4), round(size.y, 4), round(size.z, 4)   # in the pack's units

def glass(m):
    return any(k in m.name.lower() for k in ('vetro', 'glass', 'window', 'finestra'))

def finish_material(ob, col, emi=None):
    """One material reading the baked texture(s) through the 'bake' unwrap; the other unwraps go."""
    out = bpy.data.materials.new(ob.name + '_mat'); out.use_nodes = True
    nt = out.node_tree; b = nt.nodes['Principled BSDF']
    def tex(img, name):
        p = os.path.join(TMP, name + '.png'); img.filepath_raw = p; img.file_format = 'PNG'; img.save()
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'bake'; nt.links.new(uvn.outputs['UV'], t.inputs['Vector'])
        return t
    nt.links.new(tex(col, ob.name + '_col').outputs['Color'], b.inputs['Base Color'])
    if emi:
        nt.links.new(tex(emi, ob.name + '_emi').outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = 1.0
    b.inputs['Roughness'].default_value = .9
    ob.data.materials.clear(); ob.data.materials.append(out)
    for l in [l for l in ob.data.uv_layers if l.name != 'bake']:
        ob.data.uv_layers.remove(l)
    ob.data.uv_layers['bake'].active_render = True

def unwrap(ob):
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.004)   # 66°: few, large islands, so few seams
    bpy.ops.object.mode_set(mode='OBJECT')

def shell(high, tris, fine=110, tex=TEX):
    """A closed low-poly shell around the house (voxel remesh, reduced), with the full house baked onto it."""
    low = high.copy(); low.data = high.data.copy(); sc.collection.objects.link(low)
    vox = max(high.dimensions) / fine
    m = low.modifiers.new('shell', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = vox
    bpy.context.view_layer.objects.active = low; bpy.ops.object.modifier_apply(modifier=m.name)
    decimate(low, tris)
    smooth(low, 3.1416)   # the shell is one rounded surface; its detail is in the texture
    for l in list(low.data.uv_layers):
        low.data.uv_layers.remove(l)
    low.data.uv_layers.new(name='bake'); unwrap(low)
    col = bpy.data.images.new(high.name + '_col', tex, tex)
    tm = bpy.data.materials.new('bake_target'); tm.use_nodes = True
    t = tm.node_tree.nodes.new('ShaderNodeTexImage'); t.image = col; tm.node_tree.nodes.active = t
    low.data.materials.clear(); low.data.materials.append(tm)
    bk = sc.render.bake
    bk.use_selected_to_active = True; bk.cage_extrusion = vox * 1.5; bk.max_ray_distance = vox * 6
    bk.use_pass_direct = bk.use_pass_indirect = False; bk.use_pass_color = True
    bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); low.select_set(True); bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type='DIFFUSE')
    bk.use_selected_to_active = False
    name = high.name; bpy.data.objects.remove(high, do_unlink=True)
    low.name = name; low.data.name = name
    finish_material(low, col)
    return low

def bake(ob, emissive):
    """One material: the colours baked into a new unwrap (and the window glass into an emissive texture)."""
    src_uv = ob.data.uv_layers.active.name if ob.data.uv_layers else None
    uv = ob.data.uv_layers.new(name='bake')
    for i, l in enumerate(ob.data.uv_layers):
        l.active_render = (l.name == src_uv)   # the source textures read their own unwrap
    ob.data.uv_layers.active = uv              # the bake writes into the new one
    unwrap(ob)
    col = bpy.data.images.new(ob.name + '_col', TEX, TEX); emi = None
    def target(img):
        for m in ob.data.materials:
            if not m or not m.use_nodes:
                continue
            nt = m.node_tree
            t = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage'); t.name = 'bake_target'
            t.image = img; nt.nodes.active = t; t.select = True
    target(col)
    sc.render.bake.use_pass_direct = sc.render.bake.use_pass_indirect = False; sc.render.bake.use_pass_color = True
    bpy.ops.object.bake(type='DIFFUSE')
    if emissive and any(m and glass(m) for m in ob.data.materials):
        emi = bpy.data.images.new(ob.name + '_emi', TEX // 2, TEX // 2)
        for m in ob.data.materials:   # the glass glows warm; everything else is black
            if not m or not m.use_nodes:
                continue
            b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if b:
                b.inputs['Emission Color'].default_value = (1, .72, .38, 1) if glass(m) else (0, 0, 0, 1)
                b.inputs['Emission Strength'].default_value = 1.0 if glass(m) else 0.0
                for l in list(b.inputs['Emission Color'].links):
                    m.node_tree.links.remove(l)
        target(emi)
        bpy.ops.object.bake(type='EMIT')
    finish_material(ob, col, emi)

kit = []
n = 0
for folder, emissive, shelled in ((HOUSES_A, False, True), (HOUSES_B, True, True)):
    meshes = load(folder)
    for g in houses(meshes):
        mn, mx = bounds(g); s = mx - mn
        tris = sum(len(p.vertices) - 2 for o in g for p in o.data.polygons)
        if len(g) < 2 or tris < 15000 or s.z > 1.6 * min(s.x, s.y):   # loose pieces and the watchtowers
            continue
        n += 1
        ob = join(g, 'house_%02d' % n)
        if shelled:
            ob = shell(ob, HOUSE_TRIS)
        else:
            decimate(ob, HOUSE_TRIS); bake(ob, emissive)
        t = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        to_origin(ob); kit.append(ob)
        print('KIT', ob.name, t, 'tris', [ob['w'], ob['d'], ob['h']])
    for o in [o for o in bpy.data.objects if o not in kit]:
        bpy.data.objects.remove(o, do_unlink=True)

meshes = load(CASTLE)
ob = join(meshes, 'castle')
ob = shell(ob, CASTLE_TRIS, 220, 1024)   # finer than a house's, so the spires keep their points
t = sum(len(p.vertices) - 2 for p in ob.data.polygons)
to_origin(ob); kit.append(ob)
print('KIT castle', t, 'tris', [ob['w'], ob['d'], ob['h']])

for i, o in enumerate(kit):   # side by side in the file
    o.location = (i * 400.0, 0, 0)
for o in [o for o in bpy.data.objects if o not in kit]:
    bpy.data.objects.remove(o, do_unlink=True)
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_yup=True, export_apply=True, export_extras=True,
                          export_image_format='JPEG', export_jpeg_quality=85, export_materials='EXPORT')
for f in os.listdir(TMP):
    os.remove(os.path.join(TMP, f))
os.rmdir(TMP)
print('KIT', len(kit), 'pieces ->', OUT, os.path.getsize(OUT), 'bytes')
