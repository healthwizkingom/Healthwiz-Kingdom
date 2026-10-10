"""Blender side of the Training Hall art (run by make_exercise_blender.py; do not run on its own).

Runs headless in Blender 4.2 LTS with the MPFB add-on (MakeHuman for Blender) and the MakeHuman system asset pack (CC0):
  1. The knight: an athletic adult male MakeHuman body (anatomically modelled, rigged with MPFB's game-engine rig),
     in the HealthWiz knight's colours with anime styling in the spirit of a modern fantasy RPG (an original design):
     layered spiky red hair, red eyes, a dark fitted jacket and trousers with long gold-trimmed coat tails, a steel
     cuirass with a blue gem, steel pauldrons with gold rims, steel bracers, dark gloves, tall strapped boots and the
     red cape. The head is posed 30% larger than life (the anime and pixel-art ratio) so the face reads at 96 x 96.
  2. Poses: each stand-in pose (tools/art/make_exercise.py) is retargeted to the rig: the hips go where the stand-in's
     hips are, the torso turns to its frame, and each limb bone turns the least it must to point where the stand-in's
     limb points. Fingers close into a grip. Move k is keyframed at frames 10(k+1)+1 / +2 / +3 (start, middle, end);
     the cape is keyframed shorter as the torso leans (cloth falls, it does not stick out). Dumbbells follow the
     hands; the other props (benches, cable, bars, machines, step) are keyframed objects, one collection per move.
  3. Framing is measured on the posed meshes: one centre and scale per move, so the knight is as large as it can be
     and does not jump between frames. Written to <OUT>/cams.json.
  4. Each frame is rendered four ways with Cycles (CPU, orthographic, no anti-aliasing): ao, nrm (smooth normal),
     pos (world position) and id (material key), to <OUT>/<move>_<frame>_<pass>.npy (float32, row 0 = top). The
     muscle map is the rest pose without cape and coat tails, front and back: <OUT>/map_<view>_<pass>.npy, plus the
     posed joints in <OUT>/map_skeleton.json for the muscle classifier.
  5. Saves the .blend.

make_exercise_blender.py turns the passes into pixel art (palette, cel shading, outline).
Argument order after "--": POSE_JSON OUT_DIR BLEND_OUT [comma-separated moves to render, for previews]
"""
import bpy
import bmesh
import json
import math
import os
import sys
import numpy as np
from mathutils import Vector, Matrix, Quaternion
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

argv = sys.argv[sys.argv.index('--') + 1:]
POSE_JSON, OUT, BLEND_OUT = argv[:3]
ONLY = set(argv[3].split(',')) if len(argv) > 3 and argv[3] else None
os.makedirs(OUT, exist_ok=True)
D = json.load(open(POSE_JSON))
KEYS = D['keys']               # material keys; the id pass writes (index + 1) / 32
K = 33.8                       # stand-in units per metre: the hip joints land where the stand-in's are
HEAD_SCALE = 1.3
RES = D['res']                 # sheet pixels per layout pixel
SIDES = (('l', 'L'), ('r', 'R'))  # MakeHuman's _l side is +x, the stand-in's s = +1 ('L' in the joints)


def B(v):
    """Stand-in (x right, y up, z forward) -> Blender (x right, y forward, z up)."""
    return Vector((float(v[0]), -float(v[2]), float(v[1])))


def basis(R, U, F):
    return Matrix((R, U, F)).transposed()


# ---------- scene ----------
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.filter_type = 'BOX'
sc.cycles.filter_width = 0.01
sc.cycles.max_bounces = 2
sc.cycles.use_denoising = False
sc.render.film_transparent = True
sc.view_settings.view_transform = 'Raw'
sc.render.image_settings.file_format = 'OPEN_EXR'
sc.render.image_settings.color_depth = '32'
sc.render.image_settings.color_mode = 'RGBA'
sc.render.image_settings.exr_codec = 'NONE'
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
sc.world = bpy.data.worlds.new('world')


# ---------- pass materials ----------
def emission_material(name, build):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(build(nt), e.inputs['Color'])
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    m.use_fake_user = True  # MPFB purges unused data while it builds the body
    return m


def encoded(output, mul, add):
    def build(nt):
        g = nt.nodes.new('ShaderNodeNewGeometry')
        a = nt.nodes.new('ShaderNodeVectorMath')
        a.operation = 'MULTIPLY'
        a.inputs[1].default_value = (mul, mul, mul)
        b = nt.nodes.new('ShaderNodeVectorMath')
        b.operation = 'ADD'
        b.inputs[1].default_value = (add, add, add)
        nt.links.new(g.outputs[output], a.inputs[0])
        nt.links.new(a.outputs[0], b.inputs[0])
        return b.outputs[0]
    return build


def ao_build(nt):
    ao = nt.nodes.new('ShaderNodeAmbientOcclusion')
    ao.samples = 16
    ao.inputs['Distance'].default_value = 4.0
    return ao.outputs['AO']


def flat_build(rgb):
    def build(nt):
        c = nt.nodes.new('ShaderNodeRGB')
        c.outputs[0].default_value = (*rgb, 1)
        return c.outputs[0]
    return build


PASS = {'pos': emission_material('pass_pos', encoded('Position', 1 / 256, .5)),
        'nrm': emission_material('pass_nrm', encoded('Normal', .5, .5)),
        'ao': emission_material('pass_ao', ao_build)}
ID = {k: emission_material('pass_id_' + k, flat_build(((i + 1) / 32, 0, 0))) for i, k in enumerate(KEYS)}
VIEW = {}  # key -> viewport colour material, so the .blend opens readable


def key_material(key):
    if key not in VIEW:
        m = bpy.data.materials.new('knight_' + key)
        m.diffuse_color = (*D['preview_rgb'][key], 1)
        m.use_fake_user = True
        VIEW[key] = m
    return VIEW[key]


def set_keys(ob, keys):
    """One material key per slot; slots are object-linked so the passes can swap them."""
    me = ob.data
    while len(me.materials) < len(keys):
        me.materials.append(None)
    for i, k in enumerate(keys):
        slot = ob.material_slots[i]
        slot.link = 'OBJECT'
        slot.material = key_material(k)
    ob['keys'] = ','.join(keys)


def set_pass(mode):
    for ob in bpy.data.objects:
        if ob.type != 'MESH' or 'keys' not in ob:
            continue
        for slot, k in zip(ob.material_slots, ob['keys'].split(',')):
            slot.material = PASS[mode] if mode in PASS else ID[k] if mode == 'id' else key_material(k)


# ---------- mesh helpers ----------
def finish(bm, name, sharp=40):
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if sharp:
        me.set_sharp_from_angle(angle=math.radians(sharp))
    return me


def sphere_mesh(n=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=n, v_segments=n // 2, radius=1)
    return finish(bm, 'sphere', 0)


def cone_mesh(r1, r2, depth, n=24):
    """Radius r1 at z = -depth/2, r2 at z = +depth/2."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=n, radius1=r1, radius2=r2, depth=depth)
    low = [v.co for v in bm.verts if v.co.z < 0]
    if low and abs(max(Vector((c.x, c.y)).length for c in low) - r1) > 1e-4:
        bmesh.ops.scale(bm, vec=(1, 1, -1), verts=bm.verts)
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return finish(bm, 'cone')


def torus_mesh(R, r):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=32, minor_segments=8)
    o = bpy.context.object
    me = o.data
    bpy.data.objects.remove(o, do_unlink=True)
    for p in me.polygons:
        p.use_smooth = True
    return me


def bevel_cube_mesh():
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=.2, segments=2, profile=.5, affect='EDGES')
    return finish(bm, 'box')


def trs(loc, rot=None, scale=(1, 1, 1)):
    return Matrix.Translation(loc) @ (rot or Matrix.Identity(3)).to_4x4() @ Matrix.Diagonal((*scale, 1))


def along(d):
    return Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()


def sheet(name, nu, nv, point):
    """A grid mesh: point(u, v) for u in [0, 1] across, v in [0, 1] down."""
    bm = bmesh.new()
    grid = [[bm.verts.new(point(i / nu, j / nv)) for i in range(nu + 1)] for j in range(nv + 1)]
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    return finish(bm, name, 0)


# ---------- the knight ----------
MH = LocationService.get_user_data()
macro = TargetService.get_default_macro_info_dict()
macro.update({'gender': 1.0, 'age': .45, 'muscle': .85, 'weight': .42, 'proportions': 1.0, 'height': .7})
macro['race'] = {'asian': .5, 'caucasian': .5, 'african': 0.0}
BODY = HumanService.create_human(macro_detail_dict=macro, scale=0.1)
RIG = HumanService.add_builtin_rig(BODY, 'game_engine')
ASSET = {}
for key, sub, kind in (('coat', 'clothes/male_elegantsuit01/male_elegantsuit01.mhclo', 'Clothes'),
                       ('boots', 'clothes/shoes03/shoes03.mhclo', 'Clothes'),
                       ('eye', 'eyes/low-poly/low-poly.mhclo', 'Eyes'),
                       ('brow', 'eyebrows/eyebrow001/eyebrow001.mhclo', 'Eyebrows')):
    ASSET[key] = HumanService.add_mhclo_asset(os.path.join(MH, sub), BODY, asset_type=kind, subdiv_levels=0)
    set_keys(ASSET[key], [key])
RIG.scale = (K, K, K)
bpy.context.view_layer.update()
KN = RIG.users_collection[0]

# gloves: the faces of the body mesh weighted to the hand and finger bones
hand_groups = {g.index for g in BODY.vertex_groups
               if g.name.split('_')[0] in ('hand', 'index', 'middle', 'ring', 'pinky', 'thumb')}
is_hand = [sum(g.weight for g in v.groups if g.group in hand_groups) > .5 for v in BODY.data.vertices]
set_keys(BODY, ['skin', 'glove'])
for p in BODY.data.polygons:
    p.material_index = 1 if sum(is_hand[i] for i in p.vertices) * 2 > len(p.vertices) else 0


def bone_world(name, tail=False):
    b = RIG.data.bones[name]
    return RIG.matrix_world @ (b.tail_local if tail else b.head_local)


PARTS = []      # (object, bone)
BACKSIDE = []   # hidden on the muscle map (cape, coat tails)


def part(me, key, M, bone, name, hide_on_map=False):
    ob = bpy.data.objects.new(name, me)
    KN.objects.link(ob)
    me.materials.clear()
    me.materials.append(None)
    ob.matrix_world = M
    set_keys(ob, [key])
    PARTS.append((ob, bone))
    if hide_on_map:
        BACKSIDE.append(ob)
    return ob


def ell(c, radii, key, bone, name, rot=None, **kw):
    return part(sphere_mesh(), key, trs(c, rot, radii), bone, name, **kw)


def tube(a, b, r1, r2, key, bone, name, **kw):
    return part(cone_mesh(r1, r2, (b - a).length), key, trs((a + b) / 2, along(b - a)), bone, name, **kw)


def ring(c, axis, R, r, key, bone, name, scale=(1, 1, 1), **kw):
    return part(torus_mesh(R, r), key, trs(c, along(axis), scale), bone, name, **kw)


m = K  # metres -> scene units
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))  # the rest pose faces -Y

# hair: a cap on the skull and tapered locks, anchored on the eyes
eyes = ASSET['eye']
eye_c = sum((eyes.matrix_world @ Vector(c) for c in eyes.bound_box), Vector()) / 8
skull = Vector((0, eye_c.y + .085 * m, eye_c.z + .025 * m))
ell(skull + Vector((0, .022, .03)) * m, (.112 * m, .112 * m, .108 * m), 'hair', 'head', 'hair_cap')


def ribbon(base, d, bend, length, width, flat=.35, name='hair_lock'):
    """A lock of anime hair: a flat, tapered, curved ribbon (wide across, thin through), from base along d,
    curving toward bend. Lies flat on the head: its thin axis faces away from the skull centre."""
    d, bend = d.normalized(), bend.normalized()
    out = (base - skull).normalized()
    bm = bmesh.new()
    nl, nr = 9, 10
    rings = []
    for i in range(nl + 1):
        t = i / nl
        c = base + (d * t + bend * t * t * .6) * length * m
        tangent = (d + bend * 1.2 * t).normalized()
        thin = (out - tangent * out.dot(tangent)).normalized()
        wide = tangent.cross(thin).normalized()
        w = width * m * (1 - t) ** .75 + .0015 * m
        rings.append([bm.verts.new(c + wide * math.cos(a) * w + thin * math.sin(a) * w * flat)
                      for a in (2 * math.pi * k / nr for k in range(nr))])
    for i in range(nl):
        for k in range(nr):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % nr], rings[i + 1][(k + 1) % nr], rings[i + 1][k]))
    bm.faces.new(rings[0][::-1])
    part(finish(bm, name, 0), 'hair', Matrix.Identity(4), 'head', name)


def on_skull(az, el, lift=0.0):
    """A point on the hair cap: az from the front (-Y) toward +x, el above the eye line; and its outward normal."""
    a, e = math.radians(az), math.radians(el)
    o = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    return skull + Vector((o.x * .1, o.y * .104, o.z * .1)) * m * (1 + lift), o


DOWN, BACK = -Z, Y
# The hair follows the silhouette of the reference sheets (shape only; the geometry is this file's own): wide and
# voluminous, layered locks flicking outward at cheek and jaw height, heavy pointed bangs past the eyes with one lock
# between them, long side locks framing the face, two strands springing up on the crown, and a broad low tail.
for az in range(0, 360, 40):     # crown: puffed layers, rounded on top
    p, o = on_skull(az, 64)
    ribbon(p, o * .6 + DOWN * .55 + BACK * .15, DOWN + o * .2, .1, .085, .3)
for az in range(62, 299, 22):    # the mane: wide locks falling past the ears, tips flicking out
    p, o = on_skull(az, 34, .03)
    ribbon(p, DOWN + o * .32 + BACK * .12, o * 1.1 + DOWN * .2, .155, .078, .3)
for az in range(120, 241, 24):   # the back mass to the nape
    p, o = on_skull(az, 8, .03)
    ribbon(p, DOWN + BACK * .25, o * .5 + DOWN, .14, .075, .3)
# bangs: thick pointed locks from the hairline falling past the eyes; the middle one between the eyes
for az, ln, tilt in ((-46, .14, -.3), (-24, .13, -.15), (0, .15, .0), (22, .125, .12), (44, .14, .3)):
    p, o = on_skull(az, 56, .05)
    ribbon(p, DOWN - Y * .03 + X * tilt, -Y * .08 + X * tilt * .6, ln, .05 if az else .034, .28, name='bang')
# side locks framing the face to below the jaw, flicking out at the tips
for s in (1, -1):
    p, o = on_skull(s * 88, 26, .05)
    ribbon(p, DOWN * 1.5 - Y * .05 + X * s * .08, X * s * 1.2, .19, .045, .28, name='side_lock')
# two strands springing up from the crown
for dx, lean in ((-.01, -.6), (.012, .5)):
    p, o = on_skull(15, 86, .06)
    ribbon(p + X * dx * m, Z * 1.2 + X * lean * .3 + BACK * .2, X * lean + BACK * .5 - Z * .4, .06, .016, .3,
           name='crown_strand')
# a broad low tail, tied at the nape, falling to the upper back with flicks at the end
nape, _ = on_skull(180, -26)
ring(nape + BACK * .01 * m, BACK + DOWN * .6, .03 * m, .011 * m, 'boots', 'head', 'hair_tie')
for dx in (-.02, -.007, .007, .02):
    ribbon(nape + X * dx * m + BACK * .01 * m, DOWN * 1.6 + BACK * .35, DOWN + X * dx * 30 + BACK * .3, .3, .05, .3,
           name='tail')


# anime eyes: MakeHuman's eyeballs sit behind its eyelids, so each eye gets a flat almond on the face surface
# (the packer draws it as a dark lash line over a red iris)
for side in (1, -1):
    vs = [eyes.matrix_world @ v.co for v in eyes.data.vertices if v.co.x * side > 0]
    c = sum(vs, Vector()) / len(vs)
    front = min(v.y for v in vs)
    ell(Vector((c.x * 1.05, front - .011 * m, c.z)), (.016 * m, .005 * m, .011 * m), 'eye', 'head', 'anime_eye')

# torso: cuirass (breast and back plate) with a gold collar and the blue gem; belt with a gold buckle
chest = bone_world('spine_03')
neck = bone_world('neck_01')
pel = bone_world('pelvis')
# (the jacket's chest surface is about .175 m in front of the spine and .1 m behind it; the plates sit outside it)
cu = Vector((0, chest.y - .06 * m, (chest.z + neck.z) / 2 - .02 * m))
ell(cu, (.19 * m, .152 * m, .17 * m), 'steel', 'spine_03', 'cuirass')
for x in (-.045, .045):  # gold piping down the coat front, from the cuirass to the belt
    tube(Vector((x * m, cu.y - .135 * m, cu.z - .12 * m)), Vector((x * m * 1.2, pel.y - .19 * m, pel.z + .06 * m)),
         .008 * m, .008 * m, 'trim', 'spine_01', 'piping')
ring(Vector((0, cu.y, neck.z - .025 * m)), Z, .075 * m, .012 * m, 'trim', 'spine_03', 'collar', (1, .85, 1))
ell(Vector((0, cu.y - .157 * m, cu.z + .03 * m)), (.022 * m, .012 * m, .028 * m), 'gem', 'spine_03', 'gem')
ell(Vector((0, cu.y - .151 * m, cu.z + .03 * m)), (.033 * m, .008 * m, .04 * m), 'trim', 'spine_03', 'gem_mount')
waist = Vector((0, pel.y - .04 * m, pel.z + .045 * m))
ring(waist, Z, .18 * m, .016 * m, 'boots', 'pelvis', 'belt', (1, .85, 1))
ell(waist + Vector((0, -.155 * m, 0)), (.026 * m, .008 * m, .02 * m), 'trim', 'pelvis', 'buckle')

# long coat tails from the belt to the knees, open at the front, with a gold band at the hem
A0, A1 = math.radians(38), math.radians(322)


def tail_point(u, v, grow=0.0):
    a = A0 + (A1 - A0) * u
    rx, ry = (.16 + .1 * v) * m + grow, (.125 + .12 * v) * m + grow
    z = waist.z - (.035 + .5 * v) * m - (.03 * m * v if abs(math.cos(a)) < .4 else 0)
    return (math.sin(a) * rx, waist.y - math.cos(a) * ry, z)


tails = part(sheet('coat_tails', 28, 10, tail_point), 'coat', Matrix.Identity(4), 'pelvis', 'coat_tails', hide_on_map=True)
tails.modifiers.new('thickness', 'SOLIDIFY').thickness = .006 * m
hem = part(sheet('coat_hem', 28, 1, lambda u, v: tail_point(u, .93 + .07 * v, .004 * m)), 'trim', Matrix.Identity(4),
           'pelvis', 'coat_hem', hide_on_map=True)
hem.modifiers.new('thickness', 'SOLIDIFY').thickness = .004 * m

# arms: pauldrons with gold rims, bracers with gold bands
for sd, _ in SIDES:
    sh, el, wr = bone_world('upperarm_' + sd), bone_world('lowerarm_' + sd), bone_world('hand_' + sd)
    out = Vector((1 if sd == 'l' else -1, 0, 0))
    ell(sh + (Z * .035 + out * .025) * m, (.095 * m, .09 * m, .068 * m), 'steel', 'upperarm_' + sd, 'pauldron')
    ell(sh + (Z * -.012 + out * .05) * m, (.08 * m, .08 * m, .05 * m), 'steel', 'upperarm_' + sd, 'pauldron_lame')
    ring(sh + (Z * .005 + out * .025) * m, Z, .09 * m, .012 * m, 'trim', 'upperarm_' + sd, 'pauldron_rim')
    d = (wr - el).normalized()
    tube(el + d * .1 * m, wr - d * .015 * m, .058 * m, .05 * m, 'steel', 'lowerarm_' + sd, 'bracer')
    ring(wr - d * .02 * m, d, .052 * m, .009 * m, 'trim', 'lowerarm_' + sd, 'bracer_band')
    ring(el + d * .1 * m, d, .059 * m, .009 * m, 'trim', 'lowerarm_' + sd, 'bracer_band')

# legs: tall boots over the MakeHuman boots, with gold straps
for sd, _ in SIDES:
    kn, an = bone_world('calf_' + sd), bone_world('foot_' + sd)
    d = (kn - an).normalized()
    tube(an + d * .04 * m, an + d * .3 * m, .058 * m, .063 * m, 'boots', 'calf_' + sd, 'boot_shaft')
    ring(an + d * .3 * m, d, .066 * m, .012 * m, 'boots', 'calf_' + sd, 'boot_cuff')
    for t in (.12, .22):
        ring(an + d * t * m, d, .061 * m, .006 * m, 'trim', 'calf_' + sd, 'boot_strap')

# cape: from the shoulders down the back; origin on the top edge, so scaling local z shortens it from there
cape_top = Vector((0, chest.y + .11 * m, neck.z - .06 * m))


def cape_point(u, v):
    w = u * 2 - 1
    return (w * (.19 + .1 * v) * m, (.02 + .16 * v) * m + .025 * m * math.cos(w * math.pi * 2.5) * v, -1.08 * v * m)


CAPE = part(sheet('cape', 18, 14, cape_point), 'cape', Matrix.Translation(cape_top), 'spine_03', 'cape', hide_on_map=True)
CAPE.modifiers.new('thickness', 'SOLIDIFY').thickness = .008 * m
for s in (1, -1):  # gold clasps at the shoulders
    ell(cape_top + Vector((s * .15, -.02, .01)) * m, (.022 * m,) * 3, 'trim', 'spine_03', 'clasp', hide_on_map=True)

bpy.context.view_layer.update()
for ob, bone in PARTS:
    mw = ob.matrix_world.copy()
    ob.parent = RIG
    ob.parent_type = 'BONE'
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = mw

CAPE_BASE = CAPE.scale.copy()  # parenting to the scaled rig gave the cape a compensating scale; keep it

# ---------- posing ----------
for pb in RIG.pose.bones:
    pb.rotation_mode = 'QUATERNION'
AW = RIG.matrix_world.copy()
AWI = AW.inverted()
R0, U0, F0 = X, Z, -Y
REST_HIPS = (RIG.data.bones['thigh_l'].head_local + RIG.data.bones['thigh_r'].head_local) / 2
FINGERS = [n for n in RIG.pose.bones.keys() if n.split('_')[0] in ('index', 'middle', 'ring', 'pinky', 'thumb')]


def aim(name, d_world):
    """Turn a bone the least it must so it points along d_world (from where its parents left it)."""
    pb = RIG.pose.bones[name]
    cur = pb.matrix.copy()
    y = cur.col[1].xyz.normalized()
    d = (AWI.to_3x3() @ d_world).normalized()
    h = cur.translation.copy()
    pb.matrix = Matrix.Translation(h) @ y.rotation_difference(d).to_matrix().to_4x4() @ Matrix.Translation(-h) @ cur
    bpy.context.view_layer.update()


def pose(p):
    for pb in RIG.pose.bones:
        pb.location, pb.rotation_quaternion, pb.scale = (0, 0, 0), (1, 0, 0, 0), (1, 1, 1)
    bpy.context.view_layer.update()
    J = {k: B(v) for k, v in p['joints'].items()}
    Mx = p['M']
    Rt, Ut, Ft = (B([Mx[0][j], Mx[1][j], Mx[2][j]]) for j in range(3))
    Q = (basis(Rt, Ut, Ft) @ basis(R0, U0, F0).transposed()).to_4x4()
    root = RIG.pose.bones['Root']
    root.matrix = Matrix.Translation(AWI @ ((J['hpL'] + J['hpR']) / 2)) @ Q @ Matrix.Translation(-REST_HIPS) @ root.matrix
    bpy.context.view_layer.update()
    for sd, S in SIDES:
        if p['shrug']:
            cl = RIG.pose.bones['clavicle_' + sd]
            aim('clavicle_' + sd, (AW @ cl.tail + Ut * p['shrug']) - AW @ cl.head)
        aim('upperarm_' + sd, J['el' + S] - J['sh' + S])
        aim('lowerarm_' + sd, J['wr' + S] - J['el' + S])
        aim('hand_' + sd, J['tip' + S] - J['wr' + S])
        aim('thigh_' + sd, J['kn' + S] - J['hp' + S])
        aim('calf_' + sd, J['an' + S] - J['kn' + S])
        aim('foot_' + sd, (J['ft' + S] - J['an' + S]).normalized() + (J['an' + S] - J['kn' + S]).normalized() * .5)
    for n in FINGERS:  # a loose fist
        RIG.pose.bones[n].rotation_quaternion = Quaternion((1, 0, 0), math.radians(25 if n.startswith('thumb') else 55))
    RIG.pose.bones['head'].scale = (HEAD_SCALE,) * 3
    bpy.context.view_layer.update()
    k = min(max((Ut.z - .35) / .5, 0), 1)
    CAPE.scale = (CAPE_BASE.x, CAPE_BASE.y, CAPE_BASE.z * (.3 + .7 * k))


def key_all(frame):
    for pb in RIG.pose.bones:
        for path in ('location', 'rotation_quaternion', 'scale'):
            pb.keyframe_insert(path, frame=frame)
    CAPE.keyframe_insert('scale', frame=frame)


def grip(sd):
    return AW @ RIG.pose.bones['middle_01_' + sd].head


# ---------- props ----------
UNIT = {}


def unit(kind):
    if kind not in UNIT:
        UNIT[kind] = {'sphere': sphere_mesh, 'cyl': lambda: cone_mesh(1, 1, 2), 'cube': bevel_cube_mesh}[kind]()
        UNIT[kind].use_fake_user = True
    return UNIT[kind]


def specs_of(q):
    k, kind, key = q['k'], q['kind'], {'leather': 'pad', 'chrome': 'chrome'}.get(q['mat'], 'iron')
    if kind == 'sph':
        r = k['r']
        return [('sphere', B(k['c']), Matrix.Identity(3), Vector((r, r, r)), key)]
    if kind == 'cap':
        a, b, r = B(k['a']), B(k['b']), k['r']
        return [('cyl', (a + b) / 2, along(b - a), Vector((r, r, (b - a).length / 2)), key),
                ('sphere', a, Matrix.Identity(3), Vector((r, r, r)), key),
                ('sphere', b, Matrix.Identity(3), Vector((r, r, r)), key)]
    M = k['M']
    c = [B([M[0][j], M[1][j], M[2][j]]) for j in range(3)]
    if kind == 'box':
        return [('cube', B(k['c']), basis(*c), Vector(k['h']), key)]
    if kind == 'ell':
        return [('sphere', B(k['c']), basis(*c), Vector(k['h']), key)]
    if kind == 'cyl':
        return [('cyl', B(k['c']), basis(c[2], c[0], c[1]), Vector((k['r'], k['r'], k['hh'])), key)]
    raise ValueError(kind)


def dumbbell_specs(p):
    out = []
    if not p['db']:
        return out
    for i, (sd, _) in enumerate(SIDES):
        ax = B(p['db'][i]).normalized()
        g = grip(sd)
        out += [('cyl', g, along(ax), Vector((.7, .7, 3.4)), 'chrome'),
                ('cyl', g + ax * 3.5, along(ax), Vector((2.2, 2.2, 1.0)), 'iron'),
                ('cyl', g - ax * 3.5, along(ax), Vector((2.2, 2.2, 1.0)), 'iron')]
    return out


def keyed_objects(name, lists, coll, frames):
    n = len(lists[0])
    assert all(len(x) == n for x in lists), 'prop count differs between poses of ' + name
    for i in range(n):
        ss = [x[i] for x in lists]
        ob = bpy.data.objects.new('%s.prop%03d' % (name, i), unit(ss[0][0]))
        coll.objects.link(ob)
        if not ob.data.materials:
            ob.data.materials.append(None)
        set_keys(ob, [ss[0][4]])
        ob.rotation_mode = 'QUATERNION'
        qs = [s[2].to_quaternion() for s in ss]
        for j in range(1, len(qs)):
            if qs[j].dot(qs[j - 1]) < 0:
                qs[j] = -qs[j]
        for j, (s, f) in enumerate(zip(ss, frames)):
            ob.location, ob.rotation_quaternion, ob.scale = s[1], qs[j], s[3]
            for path in ('location', 'rotation_quaternion', 'scale'):
                ob.keyframe_insert(path, frame=f)


MOVE_COLL = {}
for k, mv in enumerate(D['moves']):
    base = 10 * (k + 1)
    coll = bpy.data.collections.new('props_' + mv['name'])
    sc.collection.children.link(coll)
    MOVE_COLL[mv['name']] = coll.name
    dbs = []
    for f, p in enumerate(mv['poses'], start=1):
        pose(p)
        key_all(base + f)
        dbs.append(dumbbell_specs(p))
    props = [[s for q in p['props'] for s in specs_of(q)] + d for p, d in zip(mv['poses'], dbs)]
    keyed_objects(mv['name'], props, coll, [base + 1, base + 2, base + 3])
MAP_FRAME = 900
pose(D['map']['pose'])
key_all(MAP_FRAME)
sc.frame_start, sc.frame_end = 1, MAP_FRAME

# ---------- camera, framing, passes ----------
cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam_data.sensor_fit = 'VERTICAL'
cam_data.clip_start, cam_data.clip_end = .1, 600
CAM = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(CAM)
sc.camera = CAM


def show(coll_name, map_view=False):
    for lc in bpy.context.view_layer.layer_collection.children:
        if lc.name.startswith('props_'):
            lc.exclude = lc.name != coll_name
    for ob in BACKSIDE:
        ob.hide_render = map_view


def visible_points(r, u):
    """Projected bounding-box corners of what the camera will see at the current frame, and the low ones."""
    dg = bpy.context.evaluated_depsgraph_get()
    xs, ys, lows = [], [], []
    for ob in bpy.context.view_layer.objects:
        if ob.type != 'MESH' or ob.hide_render or 'keys' not in ob:
            continue
        ev = ob.evaluated_get(dg)
        for c in ev.bound_box:
            w = ev.matrix_world @ Vector(c)
            xs.append(w.dot(r))
            ys.append(w.dot(u))
            if w.z < 12:
                lows.append(w)
    return xs, ys, lows


def frame_move(k, ci, logical=96, margin=8):
    r, u = B(ci['r']), B(ci['u'])
    xs, ys, lows = [], [], []
    for fr in (1, 2, 3):
        sc.frame_set(10 * (k + 1) + fr)
        a, b, c = visible_points(r, u)
        xs, ys, lows = xs + a, ys + b, lows + c
    span = max(max(xs) - min(xs) + margin, max(ys) - min(ys) + margin + 4)
    scale = min(1.35, (logical - 4) / span)
    centre = r * (max(xs) + min(xs)) / 2 + u * (max(ys) + min(ys)) / 2
    lx = [w.x for w in lows] or [0]
    lz = [-w.y for w in lows] or [0]  # stand-in z = -Blender y
    floor = [(min(lx) + max(lx)) / 2, (min(lz) + max(lz)) / 2, (max(lx) - min(lx)) / 2 + 4, (max(lz) - min(lz)) / 2 + 4]
    return dict(ci, center=[centre.x, centre.z, -centre.y], scale=scale, floor=floor)


def point(ci, logical_h):
    f, r, u = B(ci['f']), B(ci['r']), B(ci['u'])
    cam_data.ortho_scale = logical_h / ci['scale']
    CAM.location = B(ci['center']) - f * 200
    CAM.rotation_mode = 'QUATERNION'
    CAM.rotation_quaternion = basis(r, u, -f).to_quaternion()


def render_pass(W, H, mode, out_path):
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W, H, 100
    sc.cycles.samples = 64 if mode == 'ao' else 1
    set_pass(mode)
    tmp = os.path.join(OUT, 'tmp.exr')
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(tmp, check_existing=False)
    arr = np.empty(W * H * 4, np.float32)
    img.pixels.foreach_get(arr)
    bpy.data.images.remove(img)
    np.save(out_path, arr.reshape(H, W, 4)[::-1])


PASSES = ('ao', 'nrm', 'pos', 'id')
cams = {}
for k, mv in enumerate(D['moves']):
    if ONLY and mv['name'] not in ONLY:
        continue
    show(MOVE_COLL[mv['name']])
    ci = frame_move(k, mv['cam'])
    cams[mv['name']] = ci
    point(ci, 96)
    for fr in (1, 2, 3):
        sc.frame_set(10 * (k + 1) + fr)
        for mode in PASSES:
            render_pass(96 * RES, 96 * RES, mode, os.path.join(OUT, '%s_%d_%s.npy' % (mv['name'], fr, mode)))
    print('RENDERED', mv['name'], 'scale %.2f' % ci['scale'], flush=True)

if not ONLY or 'map' in ONLY:
    show('', map_view=True)
    sc.frame_set(MAP_FRAME)
    for v in D['map']['views']:
        point(v, 96)
        for mode in PASSES:
            render_pass(64 * RES, 96 * RES, mode, os.path.join(OUT, 'map_%s_%s.npy' % (v['name'], mode)))
        cams['map_' + v['name']] = v
        print('RENDERED map', v['name'], flush=True)
    for ob in BACKSIDE:
        ob.hide_render = False
json.dump(cams, open(os.path.join(OUT, 'cams.json'), 'w'))

# the posed joints at the map frame, in stand-in coordinates, for the muscle classifier
sc.frame_set(MAP_FRAME)
skel = {n: AW @ RIG.pose.bones[n].head for n in ('pelvis', 'spine_03', 'neck_01', 'head')}
for sd, _ in SIDES:
    for n in ('upperarm', 'lowerarm', 'hand', 'thigh', 'calf', 'foot', 'ball', 'middle_01'):
        skel[n + '_' + sd] = AW @ RIG.pose.bones[n + '_' + sd].head
json.dump({k: [v.x, v.z, -v.y] for k, v in skel.items()}, open(os.path.join(OUT, 'map_skeleton.json'), 'w'))

set_pass('view')  # open the .blend with readable colours
for lc in bpy.context.view_layer.layer_collection.children:
    lc.exclude = False
sc.frame_set(11)
bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
print('SAVED', BLEND_OUT, 'objects', len(bpy.data.objects), flush=True)
