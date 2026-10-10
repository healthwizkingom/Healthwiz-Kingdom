#!/usr/bin/env python3
"""Training Hall sprites rendered in Blender: an anatomically modelled, anime-styled HealthWiz knight as pixel art.

Pipeline:
  1. export: the stand-in's poses (tools/art/make_exercise.py: EX, ORDER, MAPPOSE, knight(), cam) as rig targets
     (joint positions and torso frame), shoulder shrug, dumbbell axes and props, plus the camera direction per move;
  2. Blender: tools/art/blender_exercise_render.py builds the knight on a MakeHuman body (MPFB add-on, CC0 assets),
     retargets the poses to its rig, keyframes the 22 moves and renders ambient occlusion, normal, position and
     material passes (headless Cycles, CPU, no anti-aliasing);
  3. pack, in the style of docs/PIXEL_STYLE.md (a modern pixel-art RPG, light from the top left):
       * cel shading from the normals: key light from the top left, a rim light on the far edge, ambient occlusion in
         the creases, a glint on steel and gold; 4 tones per material from the 28-colour PAL, no dithering;
       * a selective outline: ink around the silhouette, the material's own darkest tone on inner edges;
       * a hard oval ground shadow; the camera looks down a little (EL degrees) so the floor reads;
     then writes moves.webp (1536 x 8448) and muscles.webp (512 x 7680) at RES = 4 (the page draws them at the
     384 x 2112 / 128 x 1920 layout size, so the face and hair get four times the detail), lossless, and rewrites MAP-DATA in
     js/v6-exercise.js. The muscle masks come from the stand-in's classify() on the rendered surface points, with the
     rig's own joints.

Needs Blender 4.2 LTS with the MPFB extension (extensions.blender.org/add-ons/mpfb) and the MakeHuman system asset
pack (CC0) unpacked into MPFB's user data folder.
Run:  BLENDER=/path/to/blender python3 tools/art/make_exercise_blender.py [--only curl,squat] [--no-blender]
      --only renders and packs a preview sheet (SCRATCH/preview.png) without touching the app's art.
Intermediate files go to SCRATCH (not the repo).
"""
import json
import math
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_exercise as ME  # noqa: E402  (palette, outline, to_img, check_palette, rle, write_js, save, poses)
import knight_face_pixels as KF  # noqa: E402  (the hand-placed pixel face: stamps and their landmarks)

# material key -> 5 palette entries, dark to light; the 5th is the glint
RAMPS = {
    'skin': ['sk1', 'sk2', 'sk3', 'sk3', 'sk3'],      # anime skin is lit flat: the light tones only (face: two)
    'glove': ['ink', 'hr0', 'lt1', 'hr1', 'hr1'],
    'coat': ['ink', 'st0', 'ir1', 'st1', 'st2'],
    'trim': ['gd0', 'gd1', 'gd2', 'gd3', 'wht'],
    'steel': ['st1', 'st2', 'st3', 'st4', 'wht'],
    'hair': ['hr0', 'cp0', 'cp1', 'cp2', 'cp3'],       # crimson (approved with the pixel face)
    'eye': ['ink', 'cp1', 'cp2', 'cp3', 'wht'],
    'brow': ['hr0', 'hr0', 'hr1', 'hr1', 'hr1'],
    'nose': ['sk2', 'sk2', 'sk3', 'sk3', 'sk3'],       # the nose and mouth marks render as skin; the face
    'mouth': ['sk2', 'sk2', 'sk3', 'sk3', 'sk3'],      # pattern (FRONT_FACE) draws them
    'boots': ['ink', 'hr0', 'lt1', 'hr1', 'hr2'],
    'cape': ['cp0', 'cp1', 'cp2', 'cp3', 'cp3'],
    'gem': ['bl0', 'bl1', 'bl2', 'bl2', 'wht'],
    'iron': ['ink', 'st0', 'ir1', 'st1', 'st2'],
    'pad': ['hr0', 'lt1', 'hr1', 'sk1', 'sk1'],
    'chrome': ['st1', 'st2', 'st3', 'st4', 'wht'],
}
KEYS = list(RAMPS)
GLINT = {'steel', 'trim', 'chrome', 'gem'}
RES = 4                                   # sheet pixels per layout pixel (the page draws the sheets at layout size)
EL = 12                                   # camera elevation for the moves (degrees, looking down)
TONES = (.42, .62, .80)                   # cut-offs of the light level between the 4 tones
SHADOW_ALPHA = 96                         # hard ground shadow: ink at a fixed opacity, no blur
SCRATCH = os.environ.get('EXERCISE_SCRATCH', os.path.join(tempfile.gettempdir(), 'exercise_blender'))
BLENDER = os.environ.get('BLENDER', 'blender')
BLEND_OUT = os.path.join(HERE, 'exercise_knight.blend')
LUT = np.array([[ME.PAL[RAMPS[k][t]] for t in range(5)] for k in KEYS], np.uint8)


# ---------- export ----------
def ser(q):
    k = {}
    for key, v in q.k.items():
        k[key] = v.tolist() if isinstance(v, np.ndarray) else float(v) if isinstance(v, np.generic) else v
    return {'kind': q.kind, 'mat': q.mat, 'k': k}


def rig_pose(P):
    """Targets for the rig: the stand-in's joints and torso frame, shrug and dumbbell axes, and its props."""
    _, sk = ME.knight(P, shield=False, cape=False)
    J = {'pel': np.asarray(P['pel'], float)}
    for s, sd in ((1, 'L'), (-1, 'R')):
        sh, el, wr, hd = sk['arm', s]
        J.update({'sh' + sd: sh, 'el' + sd: el, 'wr' + sd: wr, 'tip' + sd: wr + ME.nrm(hd - wr) * 6})
        hp, kn, an, ft = sk['leg', s]
        J.update({'hp' + sd: hp, 'kn' + sd: kn, 'an' + sd: an, 'ft' + sd: ft})
    db = P.get('db')
    if db is not None:
        db = [ME.nrm(db[0]), ME.nrm(db[1])] if np.ndim(db) == 2 else [ME.nrm(db)] * 2
        db = [np.asarray(a, float).tolist() for a in db]
    return {'joints': {k: np.asarray(v, float).tolist() for k, v in J.items()}, 'M': sk['M'].tolist(),
            'shrug': float(P.get('shrug', 0)), 'db': db, 'props': [ser(q) for q in P.get('props', [])]}


def view(yaw, el, center=(0, 0, 0), scale=1.0):
    r, u, f = ME.cam(yaw, el)
    return {'r': r.tolist(), 'u': u.tolist(), 'f': f.tolist(), 'center': list(map(float, center)), 'scale': float(scale)}


def export(path):
    moves = []
    for name in ME.ORDER:
        yaw, A, B = ME.EX[name]
        poses = [A, ME.lerp_pose(A, B, .5), B]
        moves.append({'name': name, 'cam': view(yaw, EL), 'poses': [rig_pose(P) for P in poses]})
    views = []
    for name, yaw in (('front', 0), ('back', 180)):
        v = view(yaw, 0, [0, 40, 0], 1.0)
        v['name'] = name
        views.append(v)
    preview_rgb = {k: [(c / 255) ** 2.2 for c in ME.PAL[RAMPS[k][2]]] for k in KEYS}
    tex = os.path.join(os.path.dirname(path), 'face.png')
    face_texture(tex)
    json.dump({'keys': KEYS, 'res': RES, 'preview_rgb': preview_rgb, 'moves': moves,
               'face': {'tex': tex, 'ss': FACE_SS, 'eye_u': FACE_EYE_U, 'eye_v': FACE_EYE_V, 'none': NONE,
                        'dark': [ME.PAL[k] for k in FACE_DARK]},
               'map': {'pose': rig_pose(ME.MAPPOSE), 'views': views}}, open(path, 'w'))


def run_blender(pose_json, out_dir, only=''):
    cmd = [BLENDER, '-b', '--addons', 'bl_ext.user_default.mpfb', '-P', os.path.join(HERE, 'blender_exercise_render.py'),
           '--', pose_json, out_dir, BLEND_OUT, only]
    subprocess.run(cmd, check=True)


# ---------- pack ----------
def load(out_dir, name):
    return np.load(os.path.join(out_dir, name))


def to_stand(v):
    """Blender (x, y forward, z up) -> stand-in (x, y up, z forward)."""
    return np.stack([v[..., 0], v[..., 2], -v[..., 1]], -1)


def passes(out_dir, stem):
    ao, nrm = load(out_dir, stem + '_ao.npy'), load(out_dir, stem + '_nrm.npy')
    pos, idp = load(out_dir, stem + '_pos.npy'), load(out_dir, stem + '_id.npy')
    ids = np.rint(idp[..., 0] * 32).astype(int)            # key index + 1, 0 = background
    valid = np.all((pos[..., :3] > .002) & (pos[..., :3] < .998), axis=-1)
    fg = (ids > 0) & (ids <= len(KEYS)) & valid
    N = to_stand(nrm[..., :3] * 2 - 1)
    N /= np.maximum(np.linalg.norm(N, axis=-1, keepdims=True), 1e-6)
    return fg, np.where(fg, ids, 0), N, to_stand(pos[..., :3] * 256 - 128), np.clip(ao[..., 0], 0, 1)


def tones(fg, ids, N, ao, cam):
    """Cel tone 0..3 per pixel (4 = glint): key light, ambient occlusion, rim light and glint."""
    r, u, f = (np.array(cam[k]) for k in ('r', 'u', 'f'))
    n = np.stack([N @ r, N @ u, -(N @ f)], -1)              # camera space, z toward the viewer
    lam = n @ ME.LIGHT
    v = (0.5 * lam + 0.5) * (0.55 + 0.45 * ao)              # half-lambert, darkened in the creases
    t = np.select([v < TONES[0], v < TONES[1], v < TONES[2]], [0, 1, 2], 3)
    rim = (n[..., 0] > .6) & (n[..., 2] < .5) & (lam < .2)  # far edge, away from the key light
    t = np.where(rim, np.minimum(t + 1, 3), t)
    h = ME.nrm(ME.LIGHT + np.array([0, 0, 1.0]))
    shiny = np.isin(ids, [KEYS.index(k) + 1 for k in GLINT])
    t = np.where(shiny & (n @ h > .965) & (ao > .8), 4, t)
    return smooth_hair(np.where(fg, t, 0), ids)


def smooth_hair(t, ids):
    """Overlapping locks leave single stray tones; a 3 x 3 majority vote over the hair gives flat anime bands."""
    hair = ids == KEYS.index('hair') + 1
    H, W = t.shape
    pad_t, pad_h = np.pad(t, 1), np.pad(hair, 1)
    votes = np.zeros((5, H, W), int)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            tt, hh = pad_t[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx], pad_h[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]
            for k in range(5):
                votes[k] += (tt == k) & hh
    return np.where(hair, votes.argmax(axis=0), t)


def ground_shadow(cam, fg_a, W, H):
    """Hard oval shadow on the floor under the knight and the props, behind everything else."""
    cx, cz, hx, hz = cam['floor']
    r, u = np.array(cam['r']), np.array(cam['u'])
    c, s = np.array(cam['center']), cam['scale'] * RES
    th = np.linspace(0, 2 * np.pi, 48, endpoint=False)
    pts = np.stack([cx + hx * np.cos(th), np.zeros_like(th), cz + hz * np.sin(th)], -1) - c
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon([(W / 2 + float(p @ r) * s, H / 2 - float(p @ u) * s) for p in pts], fill=255)
    return (np.asarray(m) > 0) & ~fg_a


# ---------- the face ----------
# The face is hand-placed pixel art (knight_face_pixels.py, approved as a front preview). Blender's face pass only marks
# the face surface (the texture is plain skin; the pass hides the hair, so it marks the face under the bangs too); the
# features are stamped afterwards, pixel for pixel, at landmarks fixed in the head's face frame: each frame's frame
# (Blender: face_frames.json) places them, the head's turn picks the front, three-quarter or profile stamps, and its
# roll turns them. Nothing is drawn large and reduced.
FACE_TEX, FACE_SS, FACE_EYE_U, FACE_EYE_V = 64, 1, .2, .6875
NONE = (255, 0, 255)          # 'no face here' in the face pass (not a palette colour)
FACE_DARK = ('ink', 'hr0', 'cp0')
YAW_FRONT, YAW_THREE_QUARTER, YAW_PROFILE = 20, 58, 105   # degrees: the face's turn away from the camera
SNAP_ROLL = 25                                           # degrees: a roll this close to a right angle snaps to it


def face_texture(path):
    """The face pass texture: plain skin (the features are stamped later)."""
    Image.new('RGBA', (FACE_TEX, FACE_TEX), ME.PAL['sk3'] + (255,)).save(path)


_FRAMES = {}


def face_frames(out_dir):
    if out_dir not in _FRAMES:
        p = os.path.join(out_dir, 'face_frames.json')
        _FRAMES[out_dir] = {k: {a: np.array(v) for a, v in fr.items()} for k, fr in json.load(open(p)).items()}
    return _FRAMES[out_dir]


def project(cam, p, W, H):
    """Scene point (stand-in coordinates) -> sheet pixel coordinates (x right, y down), as Blender renders it."""
    r, u, c = (np.array(cam[k]) for k in ('r', 'u', 'center'))
    s = RES * cam['scale']
    return np.array([W / 2 + (p - c) @ r * s, H / 2 - (p - c) @ u * s])


_LOCAL = {}


def landmarks_local(out_dir, cams):
    """The preview's feature anchors (front map frame pixels) as points in the face frame (x, y solved from the
    projection, z from KF.LANDMARKS_Z), so they can be placed on the head in any pose."""
    if out_dir not in _LOCAL:
        fr, cam = face_frames(out_dir)['map_front'], cams['map_front']
        r, u, c = (np.array(cam[k]) for k in ('r', 'u', 'center'))
        s, W, H = RES * cam['scale'], 64 * RES, 96 * RES
        A = np.array([[fr['x'] @ r, fr['y'] @ r], [fr['x'] @ u, fr['y'] @ u]])
        out = {}
        for k, (px, py) in KF.LANDMARKS_PX.items():
            lz = KF.LANDMARKS_Z[k]
            base = fr['o'] + fr['z'] * lz - c
            rhs = np.array([(px + .5 - W / 2) / s - base @ r, (H / 2 - py - .5) / s - base @ u])
            lx, ly = np.linalg.solve(A, rhs)
            out[k] = np.array([lx, ly, lz])
        _LOCAL[out_dir] = out
    return _LOCAL[out_dir]


def stamp(rgb, rows, ax, ay, pos, theta, ok):
    """Paint a pixel map with its anchor (ax, ay) on pos, turned by theta (screen, clockwise), nearest neighbour by
    inverse mapping (no holes); only where ok(y, x)."""
    H, W = rgb.shape[:2]
    h, w = len(rows), len(rows[0])
    c, s_ = math.cos(theta), math.sin(theta)
    reach = int(math.ceil(math.hypot(max(ax, w - ax), max(ay, h - ay)))) + 1
    for ty in range(pos[1] - reach, pos[1] + reach + 1):
        for tx in range(pos[0] - reach, pos[0] + reach + 1):
            if not (0 <= ty < H and 0 <= tx < W) or not ok(ty, tx):
                continue
            dx, dy = tx - pos[0], ty - pos[1]
            sx, sy = int(round(dx * c + dy * s_)) + ax, int(round(-dx * s_ + dy * c)) + ay
            if 0 <= sy < h and 0 <= sx < w and rows[sy][sx] != '.':
                rgb[ty, tx] = ME.PAL[KF.CRIMSON[rows[sy][sx]]]


def stamp_face(rgb, out_dir, stem, cam, cams, surface, skin_face):
    """The pixel face on one frame. surface: the face surface (under the hair too); skin_face: where it shows."""
    frames = face_frames(out_dir)
    if stem not in frames:
        return
    fr, H, W = frames[stem], rgb.shape[0], rgb.shape[1]
    r, u, f = (np.array(cam[k]) for k in ('r', 'u', 'f'))
    # how far the face is turned from the camera (any direction: a face on its back turned to the ceiling is seen in
    # profile from the side, though it barely turns left or right)
    turn = math.degrees(math.acos(np.clip(-(fr['z'] @ f) / np.linalg.norm(fr['z']), -1, 1)))
    view = ('front' if turn < YAW_FRONT else 'three_quarter' if turn < YAW_THREE_QUARTER else
            'profile' if turn < YAW_PROFILE else None)
    if view is None:
        return
    theta = math.atan2(fr['y'] @ r, fr['y'] @ u)            # the head's roll on screen (clockwise)
    k90 = round(theta / (math.pi / 2)) * (math.pi / 2)
    if abs(theta - k90) < math.radians(SNAP_ROLL):
        theta = k90
    c_, s_ = math.cos(theta), math.sin(theta)

    def upright(v):                                          # a screen offset, with the roll taken out
        return np.array([v[0] * c_ + v[1] * s_, -v[0] * s_ + v[1] * c_])
    loc = landmarks_local(out_dir, cams)
    world = {k: fr['o'] + fr['x'] * l[0] + fr['y'] * l[1] + fr['z'] * l[2] for k, l in loc.items()}
    pix = {k: project(cam, p, W, H) for k, p in world.items()}
    origin = project(cam, fr['o'], W, H)
    zs = upright(project(cam, fr['o'] + fr['z'], W, H) - origin)
    right = zs[0] > 0                                        # the nose points to the picture's right
    depth = {k: (p - np.array(cam['center'])) @ f for k, p in world.items()}
    at = {k: (int(math.floor(v[0])), int(math.floor(v[1]))) for k, v in pix.items()}
    eye_ok = lambda y, x: surface[y, x]
    skin_ok = lambda y, x: skin_face[y, x]
    S = KF.STAMPS[view]
    jobs = []
    if view == 'front':
        for part in ('eye', 'brow'):
            a, b = part + '_l', part + '_r'
            left, right_ = (a, b) if upright(pix[a] - origin)[0] < upright(pix[b] - origin)[0] else (b, a)
            jobs += [(S[part + '_l'], at[left], part), (S[part + '_r'], at[right_], part)]
        jobs += [(S['nose'], at['nose'], 'nose'), (S['mouth'], at['mouth'], 'mouth')]
    else:
        near_eye = min(('eye_l', 'eye_r'), key=lambda k: depth[k])
        far_eye = 'eye_r' if near_eye == 'eye_l' else 'eye_l'
        near_brow, far_brow = near_eye.replace('eye', 'brow'), far_eye.replace('eye', 'brow')
        jobs += [(S['eye_near'], at[near_eye], 'eye'), (S['brow_near'], at[near_brow], 'brow')]
        if view == 'three_quarter':
            jobs += [(S['eye_far'], at[far_eye], 'eye'), (S['brow_far'], at[far_brow], 'brow'),
                     (S['nose'], at['nose'], 'nose')]
        jobs += [(S['mouth'], at['mouth'], 'mouth')]
    for (rows, ax, ay), pos, part in jobs:
        if view != 'front' and not right:                    # three-quarter and profile stamps face right
            rows, ax = KF.mirrored(rows), len(rows[0]) - 1 - ax
        if not (0 <= pos[1] < H and 0 <= pos[0] < W):
            continue
        if part == 'eye':
            if not surface[pos[1], pos[0]]:                  # the eye is hidden (a hand, a dumbbell, the far cheek)
                continue
            stamp(rgb, rows, ax, ay, pos, theta, eye_ok)     # eyes show through the bangs
        else:
            stamp(rgb, rows, ax, ay, pos, theta, skin_ok)


def face_pass(out_dir, stem):
    p = os.path.join(out_dir, stem + '_face.npy')
    return np.load(p) if os.path.exists(p) else None


def majority(t, mask, passes=2):
    """Clean colour clusters: each masked pixel takes the most common tone among its masked 3 x 3 neighbours."""
    H, W = t.shape
    for _ in range(passes):
        pt, pm = np.pad(t, 1), np.pad(mask, 1)
        votes = np.zeros((5, H, W), int)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                tt, mm = pt[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx], pm[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]
                for k in range(5):
                    votes[k] += (tt == k) & mm
        t = np.where(mask, votes.argmax(axis=0), t)
    return t


def face_tones(t, ids, N, cam, face):
    """Skin tone on the face (skin ramp: 0 sk1, 1 sk2, 2 sk3): one clean highlight tone, a slim midtone band along
    the contour on the shaded side and under the bangs, the darkest tone only under the jaw; smoothed into clusters."""
    if not face.any():
        return t
    r, u, f = (np.array(cam[k]) for k in ('r', 'u', 'f'))
    lam = np.stack([N @ r, N @ u, -(N @ f)], -1) @ ME.LIGHT
    inner, dist = face.copy(), np.zeros(face.shape, int)
    for _ in range(2 * RES):
        p = np.pad(inner, 1)
        inner = inner & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        dist += inner
    ft = np.full(face.shape, 2)
    ft = np.where(face & (lam < -.15) & (dist < RES), 1, ft)
    ft = np.where(face & (lam < -.6) & (dist < RES // 2 + 1), 0, ft)
    hair = ids == KEYS.index('hair') + 1
    under = np.zeros_like(hair)
    for dy in range(1, 3):                                   # a thin shadow just below the bangs
        under[dy:] |= hair[:-dy]
    ft = np.where(under & face, np.minimum(ft, 1), ft)
    ft = majority(ft, face, 3)
    return np.where(face, ft, t)


def outline_sel(rgb, fg, depth, ids, face=None):
    """Ink around the silhouette; inner edges (depth breaks) in the darkest tone of the nearer material, but none
    inside the face (it is painted)."""
    out, a = ME.outline(rgb, fg, np.where(fg, 0.0, 1e9))   # silhouette only
    H, W = fg.shape
    dp = np.pad(np.where(fg, depth, 1e9), 1, constant_values=1e9)
    brk = np.zeros_like(fg)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        brk |= fg & (depth - dp[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] > 3.0)
    if face is not None:
        brk &= ~face
    dark = LUT[np.clip(ids - 1, 0, len(KEYS) - 1), 0]
    out[brk] = dark[brk]
    return out, a


def shade(out_dir, stem, cam, shadow=True, cams=None):
    fg, ids, N, P, ao = passes(out_dir, stem)
    f = np.array(cam['f'])
    depth = np.where(fg, (P - (np.array(cam['center']) - f * 200)) @ f, 1e9)
    t = tones(fg, ids, N, ao, cam)
    fp = face_pass(out_dir, stem)
    skin = ids == KEYS.index('skin') + 1
    surface = fg & np.any(fp != NONE, axis=-1) if fp is not None else np.zeros_like(skin)
    face = skin & surface
    t = face_tones(t, ids, N, cam, face)
    rgb = LUT[np.clip(ids - 1, 0, len(KEYS) - 1), t]
    out, a = outline_sel(rgb, fg, depth, ids, face)
    if fp is not None and cams is not None:
        stamp_face(out, out_dir, stem, cam, cams, surface, face)
    im = np.asarray(ME.to_img(out, a)).copy()
    if shadow:
        sh = ground_shadow(cam, a, *fg.shape[::-1])
        im[sh, :3] = ME.PAL['ink']
        im[sh, 3] = SHADOW_ALPHA
    return Image.fromarray(im, 'RGBA'), fg, t, P


def moves_sheet(out_dir, cams, names):
    S = 96 * RES
    sheet = Image.new('RGBA', (S * 4, S * len(names)), (0, 0, 0, 0))
    for row, name in enumerate(names):
        frames = [shade(out_dir, '%s_%d' % (name, f), cams[name], cams=cams)[0] for f in (1, 2, 3)]
        for i, fi in enumerate([0, 1, 2, 1]):
            sheet.paste(frames[fi], (i * S, row * S))
    return sheet


def map_skeleton(out_dir):
    """The rig's joints at the map pose, in the shape classify() expects."""
    j = {k: np.array(v) for k, v in json.load(open(os.path.join(out_dir, 'map_skeleton.json'))).items()}
    sk = {'M': np.eye(3)}
    for sd, s in (('l', 1), ('r', -1)):
        sk['arm', s] = (j['upperarm_' + sd], j['lowerarm_' + sd], j['hand_' + sd], j['middle_01_' + sd])
        sk['leg', s] = (j['thigh_' + sd], j['calf_' + sd], j['foot_' + sd], j['ball_' + sd])
    return sk


def muscles_sheet(out_dir, cams):
    W, H = 64 * RES, 96 * RES
    sheet = Image.new('RGBA', (W * 2, H * (1 + len(ME.MUSCLES))), (0, 0, 0, 0))
    sk = map_skeleton(out_dir)
    maps = {}
    for col, name in enumerate(('front', 'back')):
        im, fg, t, P = shade(out_dir, 'map_' + name, cams['map_' + name], shadow=False, cams=cams)
        sheet.paste(im, (col * W, 0))
        ids = np.full((H, W), -1)
        for yy, xx in zip(*np.where(fg)):
            ids[yy, xx] = ME.classify(P[yy, xx], sk)
        tt = np.minimum(t, 3)
        for i in range(len(ME.MUSCLES)):
            m = ids == i
            mk = np.zeros((H, W, 4), np.uint8)
            for k in range(3):  # tones 0-1 -> the darkest teal, 2 -> middle, 3 -> lightest
                sel = m & (np.clip(tt - 1, 0, 2) == k)
                mk[sel, :3] = ME.TEAL[k]
                mk[sel, 3] = 255
            sheet.paste(Image.fromarray(mk, 'RGBA'), (col * W, (1 + i) * H))
            seen = (col == 0 and i in (4, 7, 13, 14, 15, 16, 11)) or (col == 1 and i in (0, 1, 2, 3, 6, 12, 17, 18))
            if seen and not m.any():
                print('WARNING: no pixels for', ME.MUSCLES[i], 'in view', name, file=sys.stderr)
        maps[name] = ME.rle(ids[RES // 2::RES, RES // 2::RES])  # the tap map stays 64 x 96 per view
    return sheet, maps


def preview(out_dir, cams, names, path):
    """A review sheet: the frames at 1x on the page's dark panel, and the same at 4x."""
    sheet = moves_sheet(out_dir, cams, names)
    bg = Image.new('RGBA', sheet.size, (30, 34, 58, 255))
    bg.alpha_composite(sheet)
    big = bg.resize((bg.width * 4, bg.height * 4), Image.NEAREST)
    out = Image.new('RGBA', (big.width + bg.width + 16, max(big.height, bg.height)), (20, 22, 36, 255))
    out.paste(bg, (0, 0))
    out.paste(big, (bg.width + 16, 0))
    out.save(path)


if __name__ == '__main__':
    args = sys.argv[1:]
    only = args[args.index('--only') + 1] if '--only' in args else ''
    os.makedirs(SCRATCH, exist_ok=True)
    pose_json = os.path.join(SCRATCH, 'poses.json')
    out_dir = os.path.join(SCRATCH, 'render')
    os.makedirs(out_dir, exist_ok=True)
    if '--no-blender' not in args:
        export(pose_json)
        run_blender(pose_json, out_dir, only)
    cams = json.load(open(os.path.join(out_dir, 'cams.json')))
    if only:
        names = [n for n in ME.ORDER if n in only.split(',')]
        preview(out_dir, cams, names, os.path.join(SCRATCH, 'preview.png'))
        print('preview', os.path.join(SCRATCH, 'preview.png'), file=sys.stderr)
        sys.exit(0)
    mv = moves_sheet(out_dir, cams, ME.ORDER)
    print('moves colours', ME.check_palette(mv), file=sys.stderr)
    ME.save(mv, 'moves.webp')
    ms, maps = muscles_sheet(out_dir, cams)
    print('map colours', ME.check_palette(ms, ME.TEAL), file=sys.stderr)
    ME.save(ms, 'muscles.webp')
    ME.write_js(maps)
    print('MAP-DATA rewritten', file=sys.stderr)
