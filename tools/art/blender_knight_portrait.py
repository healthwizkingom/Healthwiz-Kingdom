"""High-quality renders of the HealthWiz knight's 3D model (not the sprites).

The exercise sprites (make_exercise_blender.py) only use Blender for data passes: no lights, no shading materials,
1 sample, no anti-aliasing; every pixel is shaded afterwards in 2D. This script opens the same character
(tools/art/exercise_knight.blend) and gives it what a real render needs, without touching the sprite pipeline:

  * eyes with depth: MakeHuman's high-poly eyeballs (in the sockets, under the eyelids) with a painted amber anime
    iris (dark limbal ring, deep red-brown above to bright amber below, radial streaks, pupil) under a glossy cornea,
    so the catch-lights are real reflections; MakeHuman's eyelashes (CC0) and the eyebrow mesh;
  * materials: skin with subsurface scattering, auburn hair with a soft sheen, white-silver steel and gold trim,
    the dark coat, leather, the red cape and the blue gem;
  * smooth subdivision (render level 1) on the body, clothes and hair;
  * neutral studio lighting (key, fill and rim, soft grey world), AgX colour, a portrait lens, denoised Cycles.

Renders: a front facial close-up, a three-quarter facial close-up and a full-body view. Saves the set-up as
tools/art/knight_hq.blend.

Run:  blender -b --addons bl_ext.user_default.mpfb tools/art/exercise_knight.blend -P tools/art/blender_knight_portrait.py -- OUT_DIR
"""
import bpy
import math
import os
import sys
import numpy as np
from mathutils import Vector, Matrix
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

OUT = sys.argv[sys.argv.index('--') + 1]
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
sc = bpy.context.scene
BODY, RIG = bpy.data.objects['Human'], bpy.data.objects['Human.rig']
K = RIG.scale.x                     # scene units per metre
MH = LocationService.get_user_data()
POSE_FRAME, FACE_FRAME = 11, 900    # a standing exercise start (full body), the relaxed map pose (close-ups)


# ---------- eyes, lashes, brows ----------
def iris_texture(size=1024):
    """MakeHuman's eye UV layout (two discs, iris centred on each) painted as an amber anime iris."""
    img = bpy.data.images.new('knight_iris', size, size, alpha=False)
    v, u = np.mgrid[0:size, 0:size] / size                 # Blender images: row 0 at the bottom
    col = np.ones((size, size, 3)) * np.array([.93, .91, .88])   # the whites
    for cu, cv in ((.29, .30), (.70, .71)):
        du, dv = u - cu, v - cv
        r = np.hypot(du, dv)
        iris, pupil = r < .118, r < .046
        t = np.clip((dv / .118 + 1) / 2, 0, 1)             # 0 at the bottom of the iris, 1 at the top
        base = np.array([.95, .56, .12]) * (1 - t)[..., None] + np.array([.32, .06, .03]) * t[..., None]
        streak = 1 + .08 * np.sin(np.arctan2(dv, du) * 28)
        ring = np.clip((r - .095) / .023, 0, 1)[..., None]  # darker toward the limbal ring
        irisc = base * streak[..., None] * (1 - .7 * ring)
        col = np.where(iris[..., None], irisc, col)
        col = np.where(pupil[..., None], np.array([.03, .02, .02]), col)
    rgba = np.concatenate([col, np.ones((size, size, 1))], -1).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.pack()
    return img


def principled(name, base, rough=.5, metal=0.0, **extra):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*base, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    for k, val in extra.items():
        p.inputs[k].default_value = val
    return m


ASSET_EYES = HumanService.add_mhclo_asset(os.path.join(MH, 'eyes/high-poly/high-poly.mhclo'), BODY,
                                          asset_type='Eyes', subdiv_levels=0)
LASHES = HumanService.add_mhclo_asset(os.path.join(MH, 'eyelashes/eyelashes01/eyelashes01.mhclo'), BODY,
                                      asset_type='Eyelashes', subdiv_levels=0)
bpy.data.objects['Human.low-poly'].hide_render = True
BROWS = bpy.data.objects['Human.eyebrow001']
BROWS.hide_render = False

eye_mat = principled('knight_eye_hq', (1, 1, 1), .25, **{'Coat Weight': 1.0, 'Coat Roughness': .03})
tex = eye_mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = iris_texture()
eye_mat.node_tree.links.new(tex.outputs['Color'], eye_mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])


def alpha_material(name, rgb, source):
    """A flat-coloured card material that keeps the asset's own alpha texture (lashes, brows)."""
    m = principled(name, rgb, .6)
    nt = m.node_tree
    img = next((n.image for n in source.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None) if source else None
    if img:
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = img
        nt.links.new(t.outputs['Alpha'], nt.nodes['Principled BSDF'].inputs['Alpha'])
    m.blend_method = 'HASHED'
    return m


def original(ob):
    return next((m for m in bpy.data.materials if m.name == ob.name), None)


# ---------- materials ----------
MAT = {
    'skin': principled('knight_skin_hq', (.80, .60, .50), .45, **{'Subsurface Weight': .25,
                                                                   'Subsurface Scale': .004 * K}),
    'glove': principled('knight_glove_hq', (.06, .04, .035), .5),
    'coat': principled('knight_coat_hq', (.05, .055, .07), .65, **{'Sheen Weight': .3}),
    'trim': principled('knight_gold_hq', (1.0, .74, .32), .28, 1.0),
    'steel': principled('knight_steel_hq', (.86, .87, .9), .22, .9),
    'hair': principled('knight_hair_hq', (.36, .14, .06), .38, **{'Coat Weight': .25, 'Coat Roughness': .2,
                                                                   'Sheen Weight': .4}),
    'eye': eye_mat,
    'brow': alpha_material('knight_brow_hq', (.12, .05, .03), original(BROWS)),
    'boots': principled('knight_leather_hq', (.11, .055, .03), .5),
    'cape': principled('knight_cape_hq', (.42, .05, .06), .7, **{'Sheen Weight': .6}),
    'gem': principled('knight_gem_hq', (.06, .25, .85), .05, **{'Coat Weight': 1.0}),
    'iron': principled('knight_iron_hq', (.05, .05, .055), .4, .6),
    'pad': principled('knight_pad_hq', (.1, .06, .06), .5),
    'chrome': principled('knight_chrome_hq', (.9, .9, .92), .1, 1.0),
}
for ob in bpy.data.objects:
    if ob.type != 'MESH' or 'keys' not in ob:
        continue
    for slot, k in zip(ob.material_slots, ob['keys'].split(',')):
        slot.link = 'OBJECT'
        slot.material = MAT.get(k, MAT['iron'])
for ob in (ASSET_EYES,):
    for slot in ob.material_slots:
        slot.material = eye_mat
for slot in LASHES.material_slots:
    slot.material = alpha_material('knight_lash_hq', (.04, .025, .025), original(LASHES))

# smooth subdivision for the render (after the armature and masks)
for ob in bpy.data.objects:
    if ob.type == 'MESH' and ('keys' in ob or ob in (ASSET_EYES, LASHES)) and not ob.name.split('.')[0].endswith('prop'):
        if '.prop' in ob.name:
            continue
        sub = ob.modifiers.new('smooth', 'SUBSURF')
        sub.levels, sub.render_levels = 0, 1

# ---------- studio ----------
for lc in bpy.context.view_layer.layer_collection.children:     # the knight alone: no exercise props
    lc.exclude = lc.name.startswith('props_')
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 96
sc.cycles.use_denoising = True
sc.cycles.filter_width = 1.5
sc.cycles.max_bounces = 6
sc.render.film_transparent = False
sc.view_settings.view_transform = 'AgX'
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
sc.render.image_settings.color_depth = '8'
w = sc.world
w.use_nodes = True
bgn = w.node_tree.nodes.get('Background') or w.node_tree.nodes.new('ShaderNodeBackground')
bgn.inputs['Color'].default_value = (.32, .33, .36, 1)
bgn.inputs['Strength'].default_value = .35
if not any(l.is_linked for l in bgn.outputs):
    out = w.node_tree.nodes.get('World Output') or w.node_tree.nodes.new('ShaderNodeOutputWorld')
    w.node_tree.links.new(bgn.outputs[0], out.inputs['Surface'])


def sun(name, energy, rot, angle=12):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = energy
    ld.angle = math.radians(angle)
    ob = bpy.data.objects.new(name, ld)
    sc.collection.objects.link(ob)
    ob.rotation_euler = [math.radians(a) for a in rot]
    return ob


sun('studio_key', 3.2, (55, 0, -35))      # front-left, above
sun('studio_fill', 1.0, (75, 0, 40))      # front-right, softer
sun('studio_rim', 2.4, (60, 0, 160))      # behind, edging hair and shoulders

cam_data = bpy.data.cameras.new('portrait')
cam_data.lens = 85
cam_data.clip_start, cam_data.clip_end = .5, 2000
CAM = bpy.data.objects.new('portrait', cam_data)
sc.collection.objects.link(CAM)
sc.camera = CAM


def look(cam, target, yaw_deg, dist, height=0.0):
    a = math.radians(yaw_deg)
    pos = target + Vector((math.sin(a) * dist, -math.cos(a) * dist, height))
    d = (target - pos).normalized()
    cam.location = pos
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = d.to_track_quat('-Z', 'Y')


def head_centre():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ASSET_EYES.evaluated_get(dg)
    pts = [ev.matrix_world @ v.co for v in ev.to_mesh().vertices]
    ev.to_mesh_clear()
    return sum(pts, Vector()) / len(pts)


def render(path, w, h):
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = w, h, 100
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print('RENDERED', path, flush=True)


sc.frame_set(FACE_FRAME)
c = head_centre() + Vector((0, 0, -.03 * K))
look(CAM, c, 0, 1.45 * K, .02 * K)
render(os.path.join(OUT, 'knight_face_front.png'), 1200, 1200)
look(CAM, c, 38, 1.45 * K, .03 * K)
render(os.path.join(OUT, 'knight_face_three_quarter.png'), 1200, 1200)

sc.frame_set(POSE_FRAME)
cam_data.lens = 50
c = head_centre()
look(CAM, Vector((c.x, c.y, c.z * .52)), 28, 5.4 * K, .25 * K)
render(os.path.join(OUT, 'knight_full_body.png'), 1000, 1500)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'knight_hq.blend'))
print('SAVED', os.path.join(HERE, 'knight_hq.blend'), flush=True)
