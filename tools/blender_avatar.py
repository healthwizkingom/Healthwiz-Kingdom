"""Make a map avatar (a small rigged GLB with 'idle' and 'walk' clips) from a supplied character model, in Blender.

Run headless (Blender 4.2 LTS, no add-ons), from the repository root:

    blender -b --factory-startup -P tools/blender_avatar.py -- <source.glb|.usdz> <out.glb> [--tris N] [--tex PX] [--name NAME]

This is the prototype's tools/blender_tom.py (prototypes/campus-observatory), generalised for any standing character, so
the Observatory's avatars (observatory/avatar.js) all have the same size, rig and clips:
  1. imports the source (glTF/GLB or USD/USDZ), removes stray objects, puts a skinned source in its rest pose, joins its
     meshes, stands it on the ground (feet at z = 0, centred) and scales it to 1.8 m tall;
  2. welds texture seams and reduces it to about N triangles (default 14,000);
  3. unwraps the reduced mesh and bakes the source's base colour onto one new PX-pixel texture (default 1024);
  4. builds a simple skeleton (hips, spine, chest, neck, head, thighs, shins, feet, shoulders, upper arms, forearms,
     hands): at the source's own joints when it has a Rigify-style skeleton (DEF- bones), otherwise from the body's
     proportions; an A- or T-pose is lowered to arms at the sides and made the rest pose; skins the mesh with automatic
     weights and keys two looping clips, 'idle' (breathing, a slow look around) and 'walk';
  5. exports one skinned mesh with one matte material, front facing +z, y up, feet at y = 0.
The source's own skeleton and animation are not kept: every avatar gets this rig and these two motions, made here.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
pos = [a for a in argv if not a.startswith('--')]
opt = {argv[i][2:]: argv[i + 1] for i in range(len(argv) - 1) if argv[i].startswith('--')}
SRC, OUT = pos[0], pos[1]
TRIS = int(opt.get('tris', 14000)); TEX = int(opt.get('tex', 1024)); NAME = opt.get('name', os.path.splitext(os.path.basename(OUT))[0])
HEIGHT = 1.8
pr = lambda *a: print(*a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
sc.view_settings.view_transform = 'Standard'

# ---------- 1. import, rest pose, join, stand, scale ----------
if SRC.lower().endswith(('.usd', '.usdz', '.usdc', '.usda')): bpy.ops.wm.usd_import(filepath=SRC)
else: bpy.ops.import_scene.gltf(filepath=SRC)
arms = [o for o in sc.objects if o.type == 'ARMATURE']
meshes = [o for o in sc.objects if o.type == 'MESH' and len(o.data.polygons) > 500]   # drops stray helpers (an icosphere)
src_arm = arms[0] if arms else None
landmarks = {}
if src_arm:
    src_arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    for b in src_arm.data.bones:
        n = b.name
        for key in ('thigh.L', 'thigh.R', 'shin.L', 'shin.R', 'foot.L', 'foot.R', 'toe.L', 'toe.R', 'upper_arm.L', 'upper_arm.R',
                    'forearm.L', 'forearm.R', 'hand.L', 'hand.R', 'shoulder.L', 'shoulder.R'):
            if n.startswith('DEF-' + key + '_') or n == 'DEF-' + key:
                landmarks[key] = (src_arm.matrix_world @ b.head_local, src_arm.matrix_world @ b.tail_local)
        if n.startswith('DEF-spine_') or n == 'DEF-spine': landmarks['spine0'] = (src_arm.matrix_world @ b.head_local, src_arm.matrix_world @ b.tail_local)
        for i, k in ((3, 'chest'), (4, 'neck'), (5, 'neck2'), (6, 'head')):
            if n.startswith('DEF-spine.00%d_' % i) or n == 'DEF-spine.00%d' % i: landmarks[k] = (src_arm.matrix_world @ b.head_local, src_arm.matrix_world @ b.tail_local)
for o in meshes:   # bake the rest pose into each mesh and drop its skin
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers):
        if m.type == 'ARMATURE': bpy.ops.object.modifier_apply(modifier=m.name)
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
for o in list(sc.objects):
    if o not in meshes: bpy.data.objects.remove(o)
for a in list(bpy.data.actions): bpy.data.actions.remove(a)   # the source's own clips are not kept
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1: bpy.ops.object.join()
hi = bpy.context.view_layer.objects.active; hi.name = NAME + '_high'
for vg in list(hi.vertex_groups): hi.vertex_groups.remove(vg)
vs = [v.co.copy() for v in hi.data.vertices]
zmin = min(v.z for v in vs); zmax = max(v.z for v in vs); k = HEIGHT / (zmax - zmin)
foot = [v for v in vs if v.z < zmin + .06 * (zmax - zmin)]
cx = sum(v.x for v in foot) / len(foot); cy = sum(v.y for v in foot) / len(foot)
T = lambda p: Vector(((p.x - cx) * k, (p.y - cy) * k, (p.z - zmin) * k))
for v in hi.data.vertices: v.co = T(v.co)
hi.data.update()
landmarks = {n: (T(a), T(b)) for n, (a, b) in landmarks.items()}
pr('HIGH tris', len(hi.data.polygons), 'source landmarks', sorted(landmarks))

# ---------- the base colour of every source material, as plain emission (the baked pixels are the texture colours) ----------
for i, mt in enumerate(hi.data.materials):
    img = None; col = (0.6, 0.6, 0.6, 1)
    if mt and mt.use_nodes:
        bsdf = next((n for n in mt.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            sock = bsdf.inputs['Base Color']; col = tuple(sock.default_value)
            def find(node, depth=0):
                if node.type == 'TEX_IMAGE': return node.image
                if depth > 4: return None
                for s in node.inputs:
                    for l in s.links:
                        r = find(l.from_node, depth + 1)
                        if r: return r
                return None
            if sock.links: img = find(sock.links[0].from_node)
    em_m = bpy.data.materials.new('src_emit_%d' % i); em_m.use_nodes = True
    nt = em_m.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    if img:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Linear'; nt.links.new(t.outputs['Color'], em.inputs['Color'])
    else: em.inputs['Color'].default_value = col
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    hi.data.materials[i] = em_m
    pr('MATERIAL', i, mt and mt.name, 'texture' if img else 'colour', img and img.name)

# ---------- 2. a welded copy, reduced ----------
lo = hi.copy(); lo.data = hi.data.copy(); lo.name = NAME
sc.collection.objects.link(lo)
bm = bmesh.new(); bm.from_mesh(lo.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(lo.data); bm.free()
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); bpy.context.view_layer.objects.active = lo
tris_now = sum(len(p.vertices) - 2 for p in lo.data.polygons)
mod = lo.modifiers.new('dec', 'DECIMATE'); mod.decimate_type = 'COLLAPSE'; mod.ratio = min(1.0, TRIS / tris_now); mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
pr('REDUCED tris', len(lo.data.polygons), 'from', tris_now)

# ---------- 3. unwrap and bake the colour ----------
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.004)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()
img = bpy.data.images.new(NAME + '_color', TEX, TEX, alpha=False); img.colorspace_settings.name = 'sRGB'
m_dst = bpy.data.materials.new(NAME); m_dst.use_nodes = True
nt = m_dst.node_tree; nt.nodes.clear()
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img; tn.interpolation = 'Linear'
bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); out = nt.nodes.new('ShaderNodeOutputMaterial')
bs.inputs['Metallic'].default_value = 0; bs.inputs['Roughness'].default_value = .82
nt.links.new(tn.outputs['Color'], bs.inputs['Base Color']); nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
lo.data.materials.clear(); lo.data.materials.append(m_dst)
nt.nodes.active = tn
bpy.ops.object.select_all(action='DESELECT'); hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type='EMIT', use_selected_to_active=True, cage_extrusion=.03, max_ray_distance=.06, margin=8, margin_type='EXTEND', use_clear=True)
tmp = os.path.join(os.path.dirname(os.path.abspath(OUT)), '_' + NAME + '_color.png')
img.filepath_raw = tmp; img.file_format = 'PNG'; img.save()

# ---------- 4. joints: the source's own (Rigify DEF bones) or estimated from the body; then the skeleton ----------
V = [v.co.copy() for v in lo.data.vertices]
def band(z0, z1): return [v for v in V if z0 * HEIGHT <= v.z <= z1 * HEIGHT]
def mean(P): return sum(P, Vector()) / len(P)
H = HEIGHT
# blender: x right of the character's left side? the character faces -y; its right hand is at -x... use 'R' for +x as Tom's script
if all(k in landmarks for k in ('thigh.L', 'thigh.R', 'shin.L', 'foot.L', 'upper_arm.L', 'forearm.L', 'hand.L')):
    L = landmarks
    J = {}
    for s in ('L', 'R'):
        J['thigh.' + s] = L['thigh.' + s][0]; J['knee.' + s] = L['shin.' + s][0]; J['ankle.' + s] = L['foot.' + s][0]
        J['toe.' + s] = L['toe.' + s][1] if 'toe.' + s in L else L['foot.' + s][1]
        J['shoulder.' + s] = L['shoulder.' + s][0] if 'shoulder.' + s in L else L['upper_arm.' + s][0] * Vector((.3, 1, 1))
        J['arm.' + s] = L['upper_arm.' + s][0]; J['elbow.' + s] = L['forearm.' + s][0]; J['wrist.' + s] = L['hand.' + s][0]; J['fingers.' + s] = L['hand.' + s][1]
    hipz = (J['thigh.L'].z + J['thigh.R'].z) / 2 + .04
    J['hips'] = Vector((0, mean([J['thigh.L'], J['thigh.R']]).y, hipz))
    J['spine'] = L['spine0'][1] if 'spine0' in L else Vector((0, J['hips'].y, hipz + .17))
    J['chest'] = L['chest'][0] if 'chest' in L else Vector((0, J['hips'].y, J['arm.L'].z - .14))
    J['neck'] = L['neck'][0] if 'neck' in L else Vector((0, J['hips'].y, J['arm.L'].z + .03))
    J['head'] = L['head'][0] if 'head' in L else J['neck'] + Vector((0, 0, .1))
    J['top'] = Vector((J['head'].x, J['head'].y, H))
    pr('JOINTS from the source skeleton')
else:
    # estimated: an anime-proportioned figure, measured where the body allows (feet, hands, shoulders)
    feet = band(0, .05)
    fL = mean([v for v in feet if v.x > 0]); fR = mean([v for v in feet if v.x < 0])
    side = lambda P, s: [v for v in P if (v.x > 0) == (s == 'L')]
    J = {}
    torso_y = mean(band(.55, .75)).y
    for s, sx in (('L', 1), ('R', -1)):
        f = fL if s == 'L' else fR
        J['ankle.' + s] = Vector((f.x, f.y + .02, .055 * H)); J['toe.' + s] = Vector((f.x, min(v.y for v in side(feet, s)) + .02, .02))
        J['knee.' + s] = Vector((f.x * .85 + sx * .005, torso_y, .28 * H)); J['thigh.' + s] = Vector((sx * .055 * H, torso_y, .5 * H))
        # the hand: the farthest point of the arm on this side (an A- or T-pose spreads it out; arms down keep it by the hip)
        arm_pts = [v for v in band(.35, .82) if sx * v.x > .1 * H]
        tip = max(arm_pts, key=lambda v: sx * v.x) if arm_pts else Vector((sx * .15 * H, torso_y, .45 * H))
        sh = Vector((sx * .1 * H, torso_y, .805 * H))
        J['shoulder.' + s] = Vector((sx * .02 * H, torso_y, .8 * H)); J['arm.' + s] = sh
        d = (tip - sh); Ltot = d.length
        J['elbow.' + s] = sh + d * (.43 if Ltot > .3 * H else .45); J['wrist.' + s] = sh + d * .8; J['fingers.' + s] = tip
    J['hips'] = Vector((0, torso_y, .53 * H)); J['spine'] = Vector((0, torso_y, .62 * H)); J['chest'] = Vector((0, torso_y, .7 * H))
    J['neck'] = Vector((0, torso_y, .82 * H)); J['head'] = Vector((0, torso_y, .86 * H)); J['top'] = Vector((0, torso_y, H))
    pr('JOINTS estimated from the body')
for n in sorted(J): pr('  ', n, tuple(round(c, 3) for c in J[n]))

arm_data = bpy.data.armatures.new(NAME + '_rig'); rig = bpy.data.objects.new(NAME + '_rig', arm_data); sc.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
def bone(name, head, tail, parent=None):
    b = eb.new(name); b.head = head; b.tail = tail
    if (b.tail - b.head).length < .02: b.tail = b.head + Vector((0, 0, .05))
    if parent: b.parent = eb[parent]
bone('hips', J['hips'], J['spine'])
bone('spine', J['spine'], J['chest'], 'hips')
bone('chest', J['chest'], J['neck'], 'spine')
bone('neck', J['neck'], J['head'], 'chest')
bone('head', J['head'], J['top'], 'neck')
for s in ('R', 'L'):
    bone('thigh.' + s, J['thigh.' + s], J['knee.' + s], 'hips')
    bone('shin.' + s, J['knee.' + s], J['ankle.' + s], 'thigh.' + s)
    bone('foot.' + s, J['ankle.' + s], J['toe.' + s], 'shin.' + s)
    bone('shoulder.' + s, J['shoulder.' + s], J['arm.' + s], 'chest')
    bone('upperarm.' + s, J['arm.' + s], J['elbow.' + s], 'shoulder.' + s)
    bone('forearm.' + s, J['elbow.' + s], J['wrist.' + s], 'upperarm.' + s)
    bone('hand.' + s, J['wrist.' + s], J['fingers.' + s], 'forearm.' + s)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
names = [b.name for b in arm_data.bones]
seg = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in arm_data.bones}
def dist(p, a, b):
    ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared)); return (p - (a + ab * t)).length
missed = 0
for v in lo.data.vertices:
    if not any(g.weight > 1e-4 for g in v.groups):
        n = min(names, key=lambda q: dist(v.co, *seg[q])); lo.vertex_groups[n].add([v.index], 1.0, 'REPLACE'); missed += 1
pr('RIG vertices without automatic weights:', missed, 'of', len(lo.data.vertices))

P = rig.pose.bones
def rw(pb, ang_deg=(0, 0, 0)):
    """Pose bone pb by rotating it about its head by (rx, ry, rz) degrees about the WORLD axes, relative to rest."""
    R0 = pb.bone.matrix_local.to_3x3()
    Rw = Matrix.Rotation(math.radians(ang_deg[2]), 3, 'Z') @ Matrix.Rotation(math.radians(ang_deg[1]), 3, 'Y') @ Matrix.Rotation(math.radians(ang_deg[0]), 3, 'X')
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (R0.inverted() @ Rw @ R0).to_quaternion()
def rest_all():
    for pb in P: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
def hips_move(dx, dy, dz):  # a world-space move (glTF-style x right, y up, z forward) of the hips, as bone-local location
    P['hips'].location = P['hips'].bone.matrix_local.to_3x3().inverted() @ Vector((dx, -dz, dy))

# an A- or T-pose: lower each arm to hang about 8 degrees out from straight down, and make that the rest pose
rest_all()
lowered = []
for s, sx in (('L', 1), ('R', -1)):
    d = J['wrist.' + s] - J['arm.' + s]
    out_deg = math.degrees(math.atan2(sx * d.x, -d.z))      # 0 = straight down, 90 = straight out
    if out_deg > 14:
        rw(P['upperarm.' + s], (0, sx * (out_deg - 8), 0)); lowered.append((s, round(out_deg, 1)))
pr('ARMS lowered from', lowered or 'already down')
if lowered:
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); bpy.context.view_layer.objects.active = lo
    amod = [m for m in lo.modifiers if m.type == 'ARMATURE'][0]
    bpy.ops.object.modifier_apply(modifier=amod.name)
    amod = lo.modifiers.new('Armature', 'ARMATURE'); amod.object = rig
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
rest_all()

def key(f):
    for pb in P:
        pb.keyframe_insert('rotation_quaternion', frame=f)
        if pb.name == 'hips': pb.keyframe_insert('location', frame=f)
def clip(name, frames, fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data_create(); rig.animation_data.action = act
    for pb in P: pb.rotation_mode = 'QUATERNION'
    for f in range(frames + 1):
        fn(2 * math.pi * f / frames); key(f)
    for fc in act.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'; kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
    sc.frame_start, sc.frame_end = 0, frames
hip_h = J['hips'].z
A, KN, ARM = 22.0, 34.0, 20.0    # thigh swing, knee bend, arm swing (degrees): Tom's walk
def walk(ph):
    rest_all()
    s = math.sin(ph)
    th = {'R': A * s, 'L': -A * s}
    for side in ('R', 'L'):
        t = th[side]; swing_fwd = max(0.0, math.cos(ph) if side == 'R' else -math.cos(ph))
        rw(P['thigh.' + side], (-t, 0, 0))
        rw(P['shin.' + side], (KN * swing_fwd ** 1.3 + 4, 0, 0))
        rw(P['foot.' + side], (t * .45 - KN * swing_fwd * .35, 0, 0))
        arm = ARM * s * (-1 if side == 'R' else 1)
        rw(P['upperarm.' + side], (-arm, 0, 0))
        rw(P['forearm.' + side], (-(14 + 16 * max(0.0, -arm / ARM)), 0, 0))
        rw(P['hand.' + side], (-4, 0, 0))
    rw(P['spine'], (-4 + 1.2 * math.cos(2 * ph), 0, 3.5 * s)); rw(P['chest'], (-2, 0, -4.5 * s))
    rw(P['neck'], (0, 0, 0)); rw(P['head'], (1.5, 0, -2.0 * s)); rw(P['hips'], (0, 0, 3.0 * s))
    hips_move(.012 * s, -(hip_h * (1 - math.cos(math.radians(A * abs(s)))) + .004), 0)
def idle(ph):
    rest_all()
    s = math.sin(ph); s2 = math.sin(2 * ph)
    rw(P['spine'], (1.2 * s, 0, 0)); rw(P['chest'], (1.6 * s, 0, 0)); rw(P['head'], (-1.0 * s, 0, 5 * math.sin(ph + 1.2)))
    for side, sx in (('R', -1), ('L', 1)):
        rw(P['upperarm.' + side], (0, 0, sx * 1.2 * s)); rw(P['forearm.' + side], (-3 - 2 * s, 0, 0))
    hips_move(0, .006 * s2, 0)
clip('walk', 24, walk); clip('idle', 72, idle)
rest_all(); rig.animation_data.action = bpy.data.actions['idle']; sc.frame_set(0)

# ---------- 5. export the skinned mesh and the skeleton with both clips ----------
bpy.data.objects.remove(hi)
bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=False, export_animations=True, export_animation_mode='ACTIONS', export_skins=True, export_all_influences=False,
                          export_image_format='JPEG', export_jpeg_quality=86, export_materials='EXPORT', export_normals=True, export_texcoords=True)
os.remove(tmp)
pr('AVATAR', OUT, os.path.getsize(OUT), 'bytes,', len(lo.data.polygons), 'triangles')
