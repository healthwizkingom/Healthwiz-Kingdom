"""Make the map avatar (assets/models/tom.glb) from the supplied high-detail character model, in Blender.

Run headless (Blender 4.2 LTS, no add-ons), from the project folder:

    blender -b --factory-startup -P tools/blender_tom.py -- <source.glb> assets/models/tom.glb [triangles] [texture_px]

The source is the character model "Tom, resolute in uniform" that was supplied for this prototype (a 252,000-triangle mesh
with four 2048-pixel textures, 16 MB). It is far too heavy for a phone map, so this script:
  1. stands it on the ground (feet at y = 0, centred) and sets its height to 1.8 m, so the avatar has a known size;
  2. welds the seams the source uses for its texture islands, then reduces it to about 14,000 triangles;
  3. unwraps the reduced mesh and bakes the source's colour texture onto one new 1024-pixel texture (the rest of the
     source's textures, a normal map and a metal-rough map for the high-detail mesh, are not needed);
  4. gives it a simple skeleton (hips, spine, chest, neck, head, thighs, shins, feet, upper arms, forearms, hands), skins the
     mesh to it with automatic weights, and keys two looping clips, 'idle' (breathing, a slow look around) and 'walk';
  5. exports a small GLB: one skinned mesh, one material (base colour only, matte), front facing +z, y up, feet at y = 0.
The source model has no skeleton and no animation: this rig and these two motions are made here, not part of the source.
js/avatar.js plays them.
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = argv[0]
OUT = argv[1] if len(argv) > 1 else 'assets/models/tom.glb'
TRIS = int(argv[2]) if len(argv) > 2 else 14000
TEX = int(argv[3]) if len(argv) > 3 else 1024
HEIGHT = 1.8

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 1
sc.view_settings.view_transform = 'Standard'

bpy.ops.import_scene.gltf(filepath=SRC)
hi = [o for o in sc.objects if o.type == 'MESH'][0]
for o in list(sc.objects):
    if o is not hi: bpy.data.objects.remove(o)
hi.name = 'tom_high'
bpy.context.view_layer.objects.active = hi
hi.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 1. stand it on the ground and scale to HEIGHT
mw = hi.matrix_world
vs = [mw @ v.co for v in hi.data.vertices]
zmin = min(v.z for v in vs); zmax = max(v.z for v in vs)
k = HEIGHT / (zmax - zmin)
foot = [v for v in vs if v.z < zmin + .06 * (zmax - zmin)]
cx = sum(v.x for v in foot) / len(foot); cy = sum(v.y for v in foot) / len(foot)
for v in hi.data.vertices:
    p = hi.matrix_world @ v.co
    v.co = Vector(((p.x - cx) * k, (p.y - cy) * k, (p.z - zmin) * k))
hi.data.update()
print('HIGH tris', len(hi.data.polygons), 'height', HEIGHT)

# the colour texture of the source
src_img = None
for n in hi.active_material.node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.outputs[0].links and n.outputs[0].links[0].to_socket.name == 'Base Color':
        src_img = n.image
assert src_img, 'no base colour texture in the source'

# the source material as a plain emission of that texture, so the baked pixels are exactly the texture colours
m_src = bpy.data.materials.new('src_emit'); m_src.use_nodes = True
nt = m_src.node_tree; nt.nodes.clear()
t = nt.nodes.new('ShaderNodeTexImage'); t.image = src_img; t.interpolation = 'Linear'
em = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(t.outputs['Color'], em.inputs['Color']); nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
hi.data.materials.clear(); hi.data.materials.append(m_src)

# 2. a welded copy, reduced
lo = hi.copy(); lo.data = hi.data.copy(); lo.name = 'tom'
sc.collection.objects.link(lo)
bm = bmesh.new(); bm.from_mesh(lo.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
bm.to_mesh(lo.data); bm.free()
while lo.data.uv_layers: lo.data.uv_layers.remove(lo.data.uv_layers[0])
print('WELDED tris', len(lo.data.polygons))
bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); bpy.context.view_layer.objects.active = lo
mod = lo.modifiers.new('dec', 'DECIMATE'); mod.decimate_type = 'COLLAPSE'; mod.ratio = min(1.0, TRIS / (len(lo.data.polygons) * 1.0)); mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
print('REDUCED tris', len(lo.data.polygons))

# 3. unwrap and bake the colour
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.004)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth()
img = bpy.data.images.new('tom_color', TEX, TEX, alpha=False); img.colorspace_settings.name = 'sRGB'
m_dst = bpy.data.materials.new('tom'); m_dst.use_nodes = True
nt = m_dst.node_tree; nt.nodes.clear()
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img; tn.interpolation = 'Linear'
bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); out = nt.nodes.new('ShaderNodeOutputMaterial')
bs.inputs['Metallic'].default_value = 0; bs.inputs['Roughness'].default_value = .82
nt.links.new(tn.outputs['Color'], bs.inputs['Base Color']); nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
lo.data.materials.clear(); lo.data.materials.append(m_dst)
nt.nodes.active = tn
bpy.ops.object.select_all(action='DESELECT'); hi.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
bpy.ops.object.bake(type='EMIT', use_selected_to_active=True, cage_extrusion=.03, max_ray_distance=.06, margin=8, margin_type='EXTEND', use_clear=True)
tmp = os.path.join(os.path.dirname(os.path.abspath(OUT)), '_tom_color.png')
img.filepath_raw = tmp; img.file_format = 'PNG'; img.save()


# 4. a simple skeleton, automatic skin weights, and two looping clips
from mathutils import Matrix
CX = .03                                    # the body's centre line (glTF x); the stance is slightly off the model's origin
def B(x, y, z): return Vector((CX + x, -z, y))   # glTF-style (x right, y up, z forward) offset from the centre line -> Blender (z up, forward -y)
arm_data = bpy.data.armatures.new('tom_rig'); rig = bpy.data.objects.new('tom_rig', arm_data); sc.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
def bone(name, head, tail, parent=None):
    b = eb.new(name); b.head = B(*head); b.tail = B(*tail)
    if parent: b.parent = eb[parent]
bone('hips', (0, .92, 0), (0, 1.10, 0))
bone('spine', (0, 1.10, 0), (0, 1.30, 0), 'hips')
bone('chest', (0, 1.30, 0), (0, 1.46, 0), 'spine')
bone('neck', (0, 1.46, 0), (0, 1.56, .0), 'chest')
bone('head', (0, 1.56, 0), (0, 1.80, 0), 'neck')
for side, sx in (('R', 1), ('L', -1)):      # R is the +x side (the red-ribbon wrist)
    bone('thigh.' + side, (sx * .10, .92, 0), (sx * .155, .46, 0), 'hips')
    bone('shin.' + side, (sx * .155, .46, 0), (sx * .215, .08, -.02), 'thigh.' + side)
    bone('foot.' + side, (sx * .215, .08, -.02), (sx * .215, .03, .21), 'shin.' + side)
    bone('shoulder.' + side, (sx * .04, 1.43, 0), (sx * .17, 1.45, 0), 'chest')
    bone('upperarm.' + side, (sx * .19, 1.42, 0), (sx * .24, 1.14, 0), 'shoulder.' + side)
    bone('forearm.' + side, (sx * .24, 1.14, 0), (sx * .30, .93, 0), 'upperarm.' + side)
    bone('hand.' + side, (sx * .30, .93, 0), (sx * .34, .80, 0), 'forearm.' + side)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# any vertex the automatic weights missed (separate bits of hair, the ribbon) follows its nearest bone
names = [b.name for b in arm_data.bones]
seg = {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in arm_data.bones}
def dist(p, a, b):
    ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared)); return (p - (a + ab * t)).length
missed = 0
for v in lo.data.vertices:
    if not any(g.weight > 1e-4 for g in v.groups):
        n = min(names, key=lambda k: dist(v.co, *seg[k])); lo.vertex_groups[n].add([v.index], 1.0, 'REPLACE'); missed += 1
print('RIG vertices without automatic weights:', missed, 'of', len(lo.data.vertices))

def rw(pb, ang_deg=(0, 0, 0)):
    """Pose bone pb by rotating it about its head by (rx, ry, rz) degrees about the WORLD axes, relative to rest."""
    R0 = pb.bone.matrix_local.to_3x3()
    Rw = Matrix.Rotation(math.radians(ang_deg[2]), 3, 'Z') @ Matrix.Rotation(math.radians(ang_deg[1]), 3, 'Y') @ Matrix.Rotation(math.radians(ang_deg[0]), 3, 'X')
    pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (R0.inverted() @ Rw @ R0).to_quaternion()
def key(f):
    for pb in rig.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=f)
        if pb.name == 'hips': pb.keyframe_insert('location', frame=f)
def clip(name, frames, fn):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    rig.animation_data_create(); rig.animation_data.action = act
    for pb in rig.pose.bones: pb.rotation_mode = 'QUATERNION'
    for f in range(frames + 1):
        fn(2 * math.pi * f / frames)
        key(f)
    for fc in act.fcurves:
        for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'; kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
    sc.frame_start, sc.frame_end = 0, frames
P = rig.pose.bones
def rest_all():
    for pb in P: pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
def hips_move(dx, dy, dz):  # a world-space move of the hips (and with them everything), as bone-local location
    P['hips'].location = P['hips'].bone.matrix_local.to_3x3().inverted() @ Vector((dx, -dz, dy))

# The source stands in a wide, braced pose: feet far apart, shoulders hunched, arms held out, head bowed. First give him a
# normal standing pose, and make that the skeleton's rest pose (the mesh is re-shaped to it), so both clips start from it.
STAND = dict(legs_in=10.0, shoulders_down=7.0, arms_in=(-4.0, 1.0), arms_back=(0.0, 7.0), head_up=9.0,   # degrees; arm values for the -x and +x arm
             untwist=(15.0, 17.0), head_turn=(-9.0, -11.0), head_level=(2.0, 3.0))   # the source's upper body is turned about 24 degrees: square the spine and chest, then the neck and head
def stand():
    rest_all()
    for side, sx in (('R', 1), ('L', -1)):
        rw(P['thigh.' + side], (0, sx * STAND['legs_in'], 0))           # feet under the hips instead of wide apart
        rw(P['foot.' + side], (0, -sx * STAND['legs_in'], 0))           # soles flat on the ground again
        rw(P['shoulder.' + side], (0, sx * STAND['shoulders_down'], 0)) # lower the hunched shoulders, level on both sides
        rw(P['upperarm.' + side], (STAND['arms_back'][side == 'R'], sx * STAND['arms_in'][side == 'R'], 0))  # arms hang at the sides
    rw(P['spine'], (0, 0, STAND['untwist'][0])); rw(P['chest'], (0, 0, STAND['untwist'][1]))       # shoulders square to the front
    rw(P['neck'], (-STAND['head_up'] * .5, STAND['head_level'][0], STAND['head_turn'][0]))   # face straight ahead, level, not down
    rw(P['head'], (-STAND['head_up'] * .5, STAND['head_level'][1], STAND['head_turn'][1]))
stand()
bpy.context.view_layer.update()
# bake that pose into the mesh, then make it the rest pose of the skeleton
bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); bpy.context.view_layer.objects.active = lo
amod = [m for m in lo.modifiers if m.type == 'ARMATURE'][0]
bpy.ops.object.modifier_apply(modifier=amod.name)
amod = lo.modifiers.new('Armature', 'ARMATURE'); amod.object = rig
bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='POSE'); bpy.ops.pose.armature_apply(selected=False); bpy.ops.object.mode_set(mode='OBJECT')
rest_all()

A, KN, ARM, IN = 22.0, 34.0, 20.0, 0.0    # thigh swing, knee bend, arm swing, extra inward lean of the legs (degrees)
def walk(ph):
    rest_all()
    s, c = math.sin(ph), math.cos(ph)
    th = {'R': A * s, 'L': -A * s}                 # +angle swings the leg forward (toward -y in Blender, +z in glTF)
    for side, sx in (('R', 1), ('L', -1)):
        t = th[side]; swing_fwd = max(0.0, math.cos(ph) if side == 'R' else -math.cos(ph))
        # forward is -y in Blender: a rotation by -a about world x swings a downward limb forward
        rw(P['thigh.' + side], (-t, sx * IN, 0))
        rw(P['shin.' + side], (KN * swing_fwd ** 1.3 + 4, 0, 0))      # the knee folds the lower leg backward while it swings
        rw(P['foot.' + side], (t * .45 - KN * swing_fwd * .35, -sx * IN, 0))   # keeps the sole roughly level; the foot is rotated back out of the leg's tilt
        arm = ARM * s * (-1 if side == 'R' else 1)
        rw(P['upperarm.' + side], (-arm, 0, 0))
        rw(P['forearm.' + side], (-(14 + 16 * max(0.0, -arm / ARM)), 0, 0))   # the elbow bends a little, more as the hand swings forward
        rw(P['hand.' + side], (-4, 0, 0))
    rw(P['spine'], (-4 + 1.2 * math.cos(2 * ph), 0, 3.5 * s))
    rw(P['chest'], (-2, 0, -4.5 * s))
    rw(P['neck'], (0, 0, 0)); rw(P['head'], (1.5, 0, -2.0 * s))   # the head turns against the hips' (3), spine's (3.5) and chest's (-4.5) sway, so he keeps looking straight ahead
    rw(P['hips'], (0, 0, 3.0 * s))
    lower = .92 * (1 - math.cos(math.radians(A * abs(s)))) + .004
    hips_move(.012 * s, -lower, 0)
def idle(ph):
    rest_all()
    s = math.sin(ph); s2 = math.sin(2 * ph)
    rw(P['spine'], (1.2 * s, 0, 0)); rw(P['chest'], (1.6 * s, 0, 0)); rw(P['head'], (-1.0 * s, 0, 5 * math.sin(ph + 1.2)))
    for side, sx in (('R', 1), ('L', -1)):
        rw(P['upperarm.' + side], (0, 0, sx * 1.2 * s)); rw(P['forearm.' + side], (-3 - 2 * s, 0, 0))
    hips_move(0, .006 * s2, 0)
clip('walk', 24, walk); clip('idle', 72, idle)
rest_all(); rig.animation_data.action = bpy.data.actions['idle']; sc.frame_set(0)

# 5. export the skinned mesh and the skeleton with both clips
bpy.data.objects.remove(hi)
bpy.ops.object.select_all(action='DESELECT'); lo.select_set(True); rig.select_set(True); bpy.context.view_layer.objects.active = rig
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True, export_apply=False, export_animations=True, export_animation_mode='ACTIONS', export_skins=True, export_all_influences=False,
                          export_image_format='JPEG', export_jpeg_quality=86, export_materials='EXPORT', export_normals=True, export_texcoords=True)
os.remove(tmp)
print('TOM', OUT, os.path.getsize(OUT), 'bytes,', len(lo.data.polygons), 'triangles')
