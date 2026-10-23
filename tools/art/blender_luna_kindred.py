"""Luna's figures and portraits from the owner's 3D model "Spirit Blossom Kindred" (owner's request, 2026-10-23: "replace
Luna with Spirit Blossom Kindred, but name her still Luna, copy Luna's previous gestures"). Blender side; the packing into
the app's sheets is tools/art/make_luna_kindred.py.

    blender -b --factory-startup -P tools/art/blender_luna_kindred.py -- MODEL_DIR OUT_DIR [POSE ...]

MODEL_DIR: the unzipped model (scene.gltf, scene.bin, textures/). Model: "Spirit Blossom Kindred"
(https://sketchfab.com/3d-models/spirit-blossom-kindred-85187f9f246f4702b7c137dcc6c0fc12) by Retronous
(https://sketchfab.com/Retronous), CC BY 4.0: credited in js/v6-luna.js and in Meet Luna.
Writes OUT_DIR/pose_<name>.png (full figure, transparent) and OUT_DIR/face_<name>.png (the head, transparent).

The model comes in one pose, unrigged and unlit (its colours are painted into its emission maps): it is drawn flat, with
those painted colours, which suits the pixel art. A skeleton is fitted to the joints measured on the model (front and side
views; facing +y, her right toward +x) and bound with Blender's automatic weights. Her legs stay as modelled (she
balances on her left leg, the right knee raised behind her). Each of Luna's 21 figures (the design-sheet poses of
js/v6-luna.js POSES) is given by the arms, the spine, the head, the eyes and how the figure is turned; the bow she holds
is carried upright in her left hand where Luna carried her staff, and put away elsewhere. The gestures that raise an arm
(laugh, excited, surprised, shocked, apologetic, cast, point, wave) tear her wide sleeves, so those figures keep her pose
as modelled, bow in hand, and show the gesture's expression only (owner's rule, 2026-10-23).
"""
import bpy, json, math, os, sys
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
ONLY = argv[2:]
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# ---------------------------------------------------------------- the model, drawn with its painted colours
def load(path):
    bpy.ops.import_scene.gltf(filepath=os.path.join(path, 'scene.gltf'))
    g = json.load(open(os.path.join(path, 'scene.gltf')))
    for o in list(bpy.data.objects):
        if o.parent and 'BG' in o.parent.name:
            bpy.data.objects.remove(o)
    imgs = {}
    for m in g['materials']:
        em = m.get('emissiveTexture')
        mat = bpy.data.materials.get(m['name'])
        if not em or not mat:
            continue
        uri = g['images'][g['textures'][em['index']]['source']]['uri']
        pbr = m.get('pbrMetallicRoughness', {})
        alpha = pbr.get('baseColorTexture')
        nt = mat.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial'); t = nt.nodes.new('ShaderNodeTexImage')
        t.image = imgs.get(uri) or bpy.data.images.load(os.path.join(path, uri)); imgs[uri] = t.image
        e = nt.nodes.new('ShaderNodeEmission'); nt.links.new(t.outputs['Color'], e.inputs['Color'])
        op = pbr.get('baseColorFactor', [0, 0, 0, 1])[3]
        if alpha or (m.get('alphaMode') == 'BLEND' and op < 1):
            tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
            if alpha:
                ta = nt.nodes.new('ShaderNodeTexImage')
                ta.image = bpy.data.images.load(os.path.join(path, g['images'][g['textures'][alpha['index']]['source']]['uri']))
                nt.links.new(ta.outputs['Alpha'], mx.inputs[0])
            else:
                mx.inputs[0].default_value = op
            nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(e.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], out.inputs['Surface'])
        else:
            nt.links.new(e.outputs[0], out.inputs['Surface'])
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in meshes:   # world space, no parents: the armature becomes their only parent
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
        o.data = o.data.copy(); o.data.transform(o.matrix_world); o.matrix_world = Matrix()
    for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(o)
    return meshes

meshes = load(SRC)
part = lambda o: o.name   # Object_N; the part is told by its material
def kind(o):
    names = ' '.join(m.name for m in o.data.materials if m)
    if 'bow' in names: return 'bow'
    if 'hair' in names: return 'hair'          # the hair, the flower, the eyebrows
    if 'clothes' in names: return 'clothes'
    dz = max(v.co.z for v in o.data.vertices) - min(v.co.z for v in o.data.vertices)
    return 'body' if dz > .5 else 'face'       # eyes, teeth, tongue
K = {o: kind(o) for o in meshes}
bow = next(o for o in meshes if K[o] == 'bow')

# ---------------------------------------------------------------- the skeleton (metres; facing +y, her right +x)
J = {
    'root': ((0, 0, .60), (0, 0, .85), None),
    'spine': ((0, 0, .85), (0, 0, 1.10), 'root'),
    'chest': ((0, 0, 1.10), (0, 0, 1.36), 'spine'),
    'neck': ((0, .0, 1.36), (0, .01, 1.44), 'chest'),
    'head': ((0, .01, 1.44), (0, .01, 1.74), 'neck'),
    'upper_arm.R': ((.12, -.02, 1.30), (.17, -.01, 1.10), 'chest'),
    'forearm.R': ((.17, -.01, 1.10), (.12, .08, .99), 'upper_arm.R'),
    'hand.R': ((.12, .08, .99), (.11, .12, .88), 'forearm.R'),
    'upper_arm.L': ((-.12, -.02, 1.30), (-.15, -.01, 1.10), 'chest'),
    'forearm.L': ((-.15, -.01, 1.10), (.03, .08, .99), 'upper_arm.L'),
    'hand.L': ((.03, .08, .99), (.02, .12, .88), 'forearm.L'),
    'thigh.L': ((-.04, 0, .75), (-.03, 0, .40), 'root'),
    'shin.L': ((-.03, 0, .40), (0, .02, .05), 'thigh.L'),
    'thigh.R': ((.08, 0, .75), (.10, 0, .56), 'root'),
    'shin.R': ((.10, 0, .56), (-.18, -.14, .48), 'thigh.R'),
}
arm = bpy.data.objects.new('rig', bpy.data.armatures.new('rig')); sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
for n, (h, t, p) in J.items():
    b = arm.data.edit_bones.new(n); b.head, b.tail = Vector(h), Vector(t)
    if p: b.parent = arm.data.edit_bones[p]; b.use_connect = False
bpy.ops.object.mode_set(mode='OBJECT')

# bind: the hair, the face parts and the flower to the head; the body with automatic weights; the clothes take the
# weights of the body under them (automatic weights cannot solve the open clothes meshes: a cuff stayed behind)
body = max((o for o in meshes if K[o] == 'body'), key=lambda o: len(o.data.vertices))
for o in sorted(meshes, key=lambda o: K[o] == 'clothes'):   # the body first
    if o is bow:
        continue
    if K[o] == 'clothes':
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
        bpy.ops.object.parent_set(type='ARMATURE_NAME')
        dt = o.modifiers.new('weights', 'DATA_TRANSFER'); dt.object = body; dt.use_vert_data = True
        dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
        dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.datalayout_transfer(modifier=dt.name); bpy.ops.object.modifier_apply(modifier=dt.name)
        # the coat lies right under her hands, so it would follow them: only the small pieces (cuffs, gloves, under 15 cm
        # across) keep the arm weights; the large ones keep the torso's
        armg = {o.vertex_groups[n].index for n in o.vertex_groups.keys() if n.split('.')[0] in ('upper_arm', 'forearm', 'hand')}
        import bmesh
        bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
        seen, big = set(), []
        for v0 in bm.verts:
            if v0.index in seen:
                continue
            isl, st = [], [v0]
            while st:
                v = st.pop()
                if v.index in seen:
                    continue
                seen.add(v.index); isl.append(v.index); st += [e.other_vert(v) for e in v.link_edges]
            cs = [o.data.vertices[i].co for i in isl]
            if (Vector([max(c[k] for c in cs) for k in range(3)]) - Vector([min(c[k] for c in cs) for k in range(3)])).length > .15:
                big += isl
        bm.free()
        for i in big:
            v = o.data.vertices[i]
            for g in list(v.groups):
                if g.group in armg:
                    o.vertex_groups[g.group].remove([i])
            if not v.groups or sum(g.weight for g in v.groups) < 1e-4:
                o.vertex_groups['chest' if v.co.z > 1.1 else 'spine'].add([i], 1.0, 'REPLACE')
        continue
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    if K[o] in ('hair', 'face'):
        bpy.ops.object.parent_set(type='ARMATURE_NAME')
        vg = o.vertex_groups['head']; vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
    else:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# the bow as modelled (held across, in both hands), for the figures in her original pose; and a copy carried upright
bow0 = bow.copy(); bow0.data = bow.data.copy(); sc.collection.objects.link(bow0); bow0.hide_render = True
# the bow: upright in her left hand, its grip (the middle of the bow) in the hand
bc = sum((v.co for v in bow.data.vertices), Vector()) / len(bow.data.vertices)
bow.data.transform(Matrix.Translation(-bc)); bow.data.transform(Matrix.Rotation(math.radians(90), 4, 'Y'))
bow.location = Vector((.03, .1, .93))
bpy.context.view_layer.update()
bow.parent = arm; bow.parent_type = 'BONE'; bow.parent_bone = 'hand.L'
hb = arm.pose.bones['hand.L']
bow.matrix_parent_inverse = (arm.matrix_world @ hb.matrix @ Matrix.Translation((0, hb.length, 0))).inverted()   # a bone parent sits at the bone's tail

# ---------------------------------------------------------------- posing
P = arm.pose.bones
def turn(name, axis, deg):
    """Turn a bone (and so its children) about a world axis through its head."""
    bpy.context.view_layer.update()
    pb = P[name]; hd = (arm.matrix_world @ pb.matrix).to_translation()
    R = Matrix.Translation(hd) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-hd)
    pb.matrix = arm.matrix_world.inverted() @ R @ arm.matrix_world @ pb.matrix
def reset():
    for pb in P:
        pb.matrix_basis = Matrix()
    arm.rotation_euler = (0, 0, 0)
    for o in meshes:
        if K[o] == 'face':
            o.scale = (1, 1, 1)

X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
# turn(): about world axes. Her right arm is +x: about Y, minus lifts it out to her side, plus lifts the left one; about X,
# plus swings a limb pointing forward up toward the face; the head about X: plus looks up; the spine about X: minus leans in.
EYES = [o for o in meshes if K[o] == 'face' and sum(v.co.z for v in o.data.vertices) / len(o.data.vertices) > 1.5]
EYE0 = {o: [v.co.copy() for v in o.data.vertices] for o in EYES}
def eyes(k):
    """Open the eyes wider (k > 1) or close them to a line (k small), each about its own middle, vertically."""
    def f():
        for o in EYES:
            c = sum(EYE0[o], Vector()) / len(EYE0[o])
            for v, b in zip(o.data.vertices, EYE0[o]):
                v.co = Vector((b.x, b.y, c.z + (b.z - c.z) * k))
    return f
def staff(on=True):
    """The bow upright in her left hand, held at her side as Luna held her staff; off: put away."""
    def f():
        bow.hide_render = not on; bow0.hide_render = True
        if on:
            turn('upper_arm.L', Y, 18); turn('forearm.L', Z, 55); turn('forearm.L', X, 20)
    return f
def original():
    """Her pose as modelled, the bow held across in both hands: for the gestures that raise an arm, which tear her wide
    sleeves into slabs (owner, 2026-10-23: "if certain poses ruin the character, just the initial pose from the file");
    those keep only their expression (the head and the eyes)."""
    bow.hide_render = True; bow0.hide_render = False
def t(name, axis, deg):
    return lambda: turn(name, axis, deg)
def face(r):
    return lambda: setattr(arm.rotation_euler, 'z', math.radians(r))
OPEN, SHUT = eyes(1.0), eyes(.12)
CHIN_R = [t('upper_arm.R', X, 25), t('upper_arm.R', Y, -10), t('forearm.R', X, 85), t('forearm.R', Z, 25)]          # right hand at the chin
CHEST = [t('forearm.R', X, 45), t('forearm.L', X, 45)]                                                                     # hands clasped at the chest
POSES = {
    'idle': [staff(False), OPEN],                                                         # hands clasped in front: as modelled
    'happy': [staff(False), *CHEST, t('head', Y, 8), SHUT],
    'laugh': [original, t('head', Y, 10), t('head', X, 6), SHUT],
    'excited': [original, SHUT, t('head', X, 5)],
    'curious': [staff(False), *CHIN_R, t('head', Y, 14), eyes(1.1)],
    'think': [staff(False), *CHIN_R, t('forearm.L', X, 25), t('head', Y, -6), t('head', X, 6), eyes(.8)],
    'focused': [staff(True), t('forearm.R', X, 30), t('head', X, -4), eyes(.85)],
    'surprised': [original, t('head', X, 6), eyes(1.25)],
    'shocked': [original, t('head', X, 8), eyes(1.35)],
    'sad': [staff(False), t('upper_arm.R', Y, 8), t('upper_arm.L', Y, -8), t('spine', X, -6), t('head', X, -18), eyes(.55)],
    'apologetic': [original, t('head', Y, -12), t('head', X, -6), SHUT],
    'annoyed': [staff(False), t('forearm.R', X, 60), t('forearm.L', X, 60), t('forearm.R', Z, 20), t('forearm.L', Z, -20), t('head', Z, 20), t('head', X, 4), eyes(.6)],
    'cast': [original, t('head', X, 10), eyes(1.1)],
    'walk': [staff(False), t('forearm.R', X, 40), t('forearm.L', X, 40), t('head', X, -14), face(-18), eyes(.7)],
    'point': [original, t('head', Z, -15), OPEN],
    'wave': [original, t('head', Y, 8), SHUT],
    'rest': [staff(False), t('spine', X, -8), t('head', X, -20), t('head', Y, 10), SHUT],
    'front': [staff(False), OPEN],
    'side': [staff(False), OPEN, face(-90)],
    'back': [staff(False), OPEN, face(180)],
    'three': [staff(True), OPEN, face(-35)],
}
CAM = {}

def render(name, steps, face=False):
    reset(); OPEN()
    for s in steps:
        s()
    bpy.context.view_layer.update()
    cam = sc.camera
    if face:   # the head close-up for the portraits: centred on the head bone (it moves with the pose), horns included
        hb = P['head']; c = arm.matrix_world @ (hb.head + (hb.tail - hb.head) * .42)
        cam.data.ortho_scale = .46; cam.location = (c.x, 5, c.z)
    else:
        cam.data.ortho_scale = 2.0; cam.location = (0, 5, .86)
    sc.render.resolution_x, sc.render.resolution_y = (512, 512) if face else (640, 960)
    sc.render.filepath = os.path.join(OUT, ('face_' if face else 'pose_') + name + '.png')
    bpy.ops.render.render(write_still=True)

cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.rotation_euler = (math.radians(90), 0, math.radians(180)); cam.data.clip_end = 20
sc.render.engine = 'BLENDER_EEVEE_NEXT'; sc.render.film_transparent = True
sc.view_settings.view_transform = 'Standard'; sc.render.filter_size = .8
FACE_POSES = ['happy', 'curious', 'focused', 'think', 'surprised', 'excited', 'apologetic', 'laugh', 'shocked', 'sad', 'annoyed', 'idle']   # make_luna_faces.FACES
for n, steps in POSES.items():
    if not ONLY or n in ONLY:
        render(n, steps)
        if n in FACE_POSES:
            render(n, steps, face=True)
print('LUNA', len(POSES), 'poses ->', OUT)
