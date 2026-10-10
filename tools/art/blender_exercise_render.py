"""Blender side of the Training Hall art (run by make_exercise_blender.py; do not run on its own).

Runs headless in Blender 4.2 LTS:
  1. Turns every primitive of the stand-in knight (tools/art/make_exercise.py) into a Blender object: spheres,
     capsules (a cylinder and two end caps), boxes, ellipsoids and cylinders. Props (dumbbells, benches, cable,
     dip bars, machines, step) are the same kind of primitives, so they come along.
  2. Keyframes each object at start (frame 1), middle (frame 2) and end (frame 3) of each move, with the poses
     from the stand-in, so a move is a real Blender animation.
  3. Renders each frame three ways with Cycles on the CPU, orthographic camera, no anti-aliasing:
       shade: white diffuse lit by one sun and a dim world; gives the light level per pixel
       pos:   emission of the world position, so each pixel knows its surface point
       id:    flat emission of the material id (1..10), so each pixel knows its material
     Results go to <OUT>/<name>_<frame>_<pass>.npy as float32 H x W x 4 arrays (row 0 = top).
  4. Renders the muscle map (knight without cape and shield, front and back views) with shade and pos passes.
  5. Saves the .blend so the rig can be reopened and edited.

Argument order after "--": POSE_JSON OUT_DIR BLEND_OUT
"""
import bpy
import json
import os
import sys
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
POSE_JSON, OUT, BLEND_OUT = argv
os.makedirs(OUT, exist_ok=True)
D = json.load(open(POSE_JSON))
MATS = D['mats']
AMB, SUN, SHADE_SAMPLES = D['amb'], D['sun'], D['shade_samples']


def B(v):
    """Stand-in (x right, y up, z forward) -> Blender (x right, y forward, z up). A proper rotation."""
    return Vector((float(v[0]), -float(v[2]), float(v[1])))


def Mb(cols):
    """Three stand-in column vectors -> Blender rotation matrix."""
    c = [B(x) for x in cols]
    return Matrix(((c[0].x, c[1].x, c[2].x), (c[0].y, c[1].y, c[2].y), (c[0].z, c[1].z, c[2].z)))


def cols_of(M):
    return [[M[0][j], M[1][j], M[2][j]] for j in range(3)]


# ---------- scene and materials ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.filter_type = 'BOX'
sc.cycles.filter_width = 0.01          # effectively no anti-aliasing
sc.cycles.max_bounces = 2
sc.cycles.diffuse_bounces = 1
sc.cycles.use_denoising = False
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Raw'
sc.view_settings.look = 'None'
sc.render.image_settings.file_format = 'OPEN_EXR'
sc.render.image_settings.color_depth = '32'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.image_settings.exr_codec = 'NONE'
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'

sc.world = bpy.data.worlds.new('world')
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (AMB, AMB, AMB, 1)


def make_material(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(build(nt), out.inputs['Surface'])
    return m


def diffuse_white(nt):
    d = nt.nodes.new('ShaderNodeBsdfDiffuse')
    d.inputs['Color'].default_value = (1, 1, 1, 1)
    return d.outputs['BSDF']


def emit_colour(r, g, b):
    def build(nt):
        e = nt.nodes.new('ShaderNodeEmission')
        e.inputs['Color'].default_value = (r, g, b, 1)
        e.inputs['Strength'].default_value = 1.0
        return e.outputs['Emission']
    return build


def emit_position(nt):
    g = nt.nodes.new('ShaderNodeNewGeometry')
    mul = nt.nodes.new('ShaderNodeVectorMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = (1 / 256, 1 / 256, 1 / 256)
    add = nt.nodes.new('ShaderNodeVectorMath')
    add.operation = 'ADD'
    add.inputs[1].default_value = (0.5, 0.5, 0.5)
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Strength'].default_value = 1.0
    nt.links.new(g.outputs['Position'], mul.inputs[0])
    nt.links.new(mul.outputs[0], add.inputs[0])
    nt.links.new(add.outputs[0], e.inputs['Color'])
    return e.outputs['Emission']


WHITE = make_material('pass_shade', diffuse_white)
POS = make_material('pass_pos', emit_position)
ID_MAT = [make_material('pass_id_%d' % (i + 1), emit_colour((i + 1) / 32, 0, 0)) for i in range(len(MATS))]

MESH = {}


def shape_mesh(kind):
    if kind not in MESH:
        if kind == 'cube':
            bpy.ops.mesh.primitive_cube_add(size=2)
        elif kind == 'sphere':
            bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=20, ring_count=10)
        else:
            bpy.ops.mesh.primitive_cylinder_add(radius=1, depth=2, vertices=14)
        o = bpy.context.object
        me = o.data
        me.name = 'shape_' + kind
        me.use_fake_user = True
        me.materials.append(WHITE)
        bpy.data.objects.remove(o, do_unlink=True)
        MESH[kind] = me
    return MESH[kind]


# ---------- stand-in primitives -> Blender object specs ----------
def specs_of(q):
    """(shape, location, rotation, scale, material) for one stand-in primitive."""
    k, kind, mat = q['k'], q['kind'], q['mat']
    if kind == 'sph':
        r = k['r']
        return [('sphere', B(k['c']), Matrix.Identity(3), Vector((r, r, r)), mat)]
    if kind == 'cap':
        a, b, r = np.array(k['a']), np.array(k['b']), k['r']
        d = b - a
        L = float(np.linalg.norm(d))
        z = d / L
        h = np.array([1.0, 0, 0]) if abs(z[0]) < .9 else np.array([0, 1.0, 0])
        x = np.cross(h, z)
        x /= np.linalg.norm(x)
        y = np.cross(z, x)
        return [('cyl', B((a + b) / 2), Mb([x, y, z]), Vector((r, r, L / 2)), mat),
                ('sphere', B(a), Matrix.Identity(3), Vector((r, r, r)), mat),
                ('sphere', B(b), Matrix.Identity(3), Vector((r, r, r)), mat)]
    if kind == 'box':
        return [('cube', B(k['c']), Mb(cols_of(k['M'])), Vector(k['h']), mat)]
    if kind == 'ell':
        return [('sphere', B(k['c']), Mb(cols_of(k['M'])), Vector(k['h']), mat)]
    if kind == 'cyl':
        M = k['M']  # local up (column 1) is the cylinder axis
        return [('cyl', B(k['c']), Mb([[M[0][2], M[1][2], M[2][2]], [M[0][0], M[1][0], M[2][0]],
                                      [M[0][1], M[1][1], M[2][1]]]), Vector((k['r'], k['r'], k['hh'])), mat)]
    raise ValueError(kind)


def pose_specs(prims):
    out = []
    for q in prims:
        out += specs_of(q)
    return out


def build(name, poses, coll, frames):
    """poses: list of spec lists (same length and order), one per keyframe in frames."""
    n = len(poses[0])
    for p in poses:
        assert len(p) == n, 'prim count differs between poses of %s' % name
    for i in range(n):
        ss = [p[i] for p in poses]
        shape, mat = ss[0][0], ss[0][4]
        for s in ss:
            assert s[0] == shape and s[4] == mat, 'primitive %d of %s changes shape or material' % (i, name)
        ob = bpy.data.objects.new('%s.%03d' % (name, i), shape_mesh(shape))
        coll.objects.link(ob)
        ob['mat_id'] = MATS.index(mat) + 1
        ob.rotation_mode = 'QUATERNION'
        qs = [s[2].to_quaternion() for s in ss]
        for j in range(1, len(qs)):  # keep the quaternions in one hemisphere so they blend the short way
            if qs[j].dot(qs[j - 1]) < 0:
                qs[j] = -qs[j]
        for j, (s, f) in enumerate(zip(ss, frames)):
            ob.location = s[1]
            ob.rotation_quaternion = qs[j]
            ob.scale = s[3]
            ob.keyframe_insert('location', frame=f)
            ob.keyframe_insert('rotation_quaternion', frame=f)
            ob.keyframe_insert('scale', frame=f)
        ob.material_slots[0].link = 'OBJECT'
        ob.material_slots[0].material = WHITE


# ---------- camera, sun and render passes ----------
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.sensor_fit = 'VERTICAL'
cam_data.clip_start = 0.1
cam_data.clip_end = 400
CAM = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(CAM)
SUNDATA = bpy.data.lights.new('sun', 'SUN')
SUNDATA.energy = SUN
SUNOB = bpy.data.objects.new('sun', SUNDATA)
sc.collection.objects.link(SUNOB)


def point_camera(ci, H):
    """ci: stand-in view: centre (world point at the image centre), scale (px per unit), f (view direction)."""
    f = B(ci['f'])
    cam_data.ortho_scale = H / ci['scale']
    CAM.location = B(ci['center']) - f * 160
    CAM.rotation_mode = 'QUATERNION'
    back = -f                                      # camera +Z points away from the scene
    right = Vector((0, 0, 1)).cross(back)          # camera +X; world up stays up on screen
    cam_up = back.cross(right)                     # camera +Y
    CAM.rotation_quaternion = Matrix((right, cam_up, back)).transposed().to_quaternion()
    sc.camera = CAM
    Lb = -B(ci['light'])  # the sun's travel direction: from the light toward the knight
    SUNOB.rotation_mode = 'QUATERNION'
    SUNOB.rotation_quaternion = Lb.normalized().to_track_quat('-Z', 'Y')


def set_pass(mode):
    for ob in bpy.context.view_layer.objects:
        if ob.type != 'MESH':
            continue
        slot = ob.material_slots[0]
        if mode == 'shade':
            slot.material = WHITE
        elif mode == 'pos':
            slot.material = POS
        else:
            slot.material = ID_MAT[ob['mat_id'] - 1]


def render_pass(W, H, mode, out_path):
    sc.render.resolution_x, sc.render.resolution_y = W, H
    sc.render.resolution_percentage = 100
    sc.cycles.samples = SHADE_SAMPLES if mode == 'shade' else 1
    set_pass(mode)
    tmp = os.path.join(OUT, 'tmp.exr')
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp, check_existing=False)
    arr = np.empty(W * H * 4, np.float32)
    img.pixels.foreach_get(arr)
    bpy.data.images.remove(img)
    np.save(out_path, arr.reshape(H, W, 4)[::-1])  # Blender rows run bottom-up


def set_visible(coll_name):
    for lc in bpy.context.view_layer.layer_collection.children:
        lc.exclude = lc.name != coll_name


# ---------- build every move ----------
MOVE_COLL = {}
for mv in D['moves']:
    coll = bpy.data.collections.new('move_' + mv['name'])
    sc.collection.children.link(coll)
    build(mv['name'], [pose_specs(p) for p in mv['poses']], coll, [1, 2, 3])
    MOVE_COLL[mv['name']] = coll.name

map_coll = bpy.data.collections.new('muscle_map')
sc.collection.children.link(map_coll)
build('map', [pose_specs(D['map']['prims'])], map_coll, [1])

# ---------- render ----------
report = []
for mv in D['moves']:
    set_visible(MOVE_COLL[mv['name']])
    ci = mv['cam']
    point_camera(ci, 96)
    for f in (1, 2, 3):
        sc.frame_set(f)
        for mode in ('shade', 'pos', 'id'):
            render_pass(96, 96, mode, os.path.join(OUT, '%s_%d_%s.npy' % (mv['name'], f, mode)))
    report.append(mv['name'])
    print('RENDERED', mv['name'], flush=True)

set_visible('muscle_map')
sc.frame_set(1)
for view in D['map']['views']:
    point_camera(view, 96)
    render_pass(64, 96, 'shade', os.path.join(OUT, 'map_%s_shade.npy' % view['name']))
    render_pass(64, 96, 'pos', os.path.join(OUT, 'map_%s_pos.npy' % view['name']))
    render_pass(64, 96, 'id', os.path.join(OUT, 'map_%s_id.npy' % view['name']))
    print('RENDERED map', view['name'], flush=True)

bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print('SAVED', BLEND_OUT, 'objects', len(bpy.data.objects), flush=True)
