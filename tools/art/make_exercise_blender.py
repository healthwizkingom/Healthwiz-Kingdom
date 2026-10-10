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
     then writes moves.webp (768 x 4224) and muscles.webp (256 x 3840) at RES = 2 (the page draws them at the
     384 x 2112 / 128 x 1920 layout size, so they show twice the detail), lossless, and rewrites MAP-DATA in
     js/v6-exercise.js. The muscle masks come from the stand-in's classify() on the rendered surface points, with the
     rig's own joints.

Needs Blender 4.2 LTS with the MPFB extension (extensions.blender.org/add-ons/mpfb) and the MakeHuman system asset
pack (CC0) unpacked into MPFB's user data folder.
Run:  BLENDER=/path/to/blender python3 tools/art/make_exercise_blender.py [--only curl,squat] [--no-blender]
      --only renders and packs a preview sheet (SCRATCH/preview.png) without touching the app's art.
Intermediate files go to SCRATCH (not the repo).
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_exercise as ME  # noqa: E402  (palette, outline, to_img, check_palette, rle, write_js, save, poses)

# material key -> 5 palette entries, dark to light; the 5th is the glint
RAMPS = {
    'skin': ['sk1', 'sk2', 'sk3', 'sk3', 'sk3'],      # anime faces are lit flat: the three light tones only
    'glove': ['ink', 'hr0', 'lt1', 'hr1', 'hr1'],
    'coat': ['ink', 'st0', 'ir1', 'st1', 'st2'],
    'trim': ['gd0', 'gd1', 'gd2', 'gd3', 'wht'],
    'steel': ['st1', 'st2', 'st3', 'st4', 'wht'],
    'hair': ['cp0', 'cp1', 'cp1', 'cp2', 'cp3'],       # deep crimson, orange-red only where the light is strongest
    'eye': ['ink', 'cp1', 'cp2', 'cp3', 'wht'],
    'brow': ['ink', 'hr0', 'cp0', 'cp1', 'cp1'],
    'boots': ['ink', 'hr0', 'lt1', 'hr1', 'hr2'],
    'cape': ['cp0', 'cp1', 'cp2', 'cp3', 'cp3'],
    'gem': ['bl0', 'bl1', 'bl2', 'bl2', 'wht'],
    'iron': ['ink', 'st0', 'ir1', 'st1', 'st2'],
    'pad': ['hr0', 'lt1', 'hr1', 'sk1', 'sk1'],
    'chrome': ['st1', 'st2', 'st3', 'st4', 'wht'],
}
KEYS = list(RAMPS)
GLINT = {'steel', 'trim', 'chrome', 'gem'}
RES = 2                                   # sheet pixels per layout pixel (the page draws the sheets at layout size)
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
    json.dump({'keys': KEYS, 'res': RES, 'preview_rgb': preview_rgb, 'moves': moves,
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


def outline_sel(rgb, fg, depth, ids):
    """Ink around the silhouette; inner edges (depth breaks) in the darkest tone of the nearer material."""
    out, a = ME.outline(rgb, fg, np.where(fg, 0.0, 1e9))   # silhouette only
    H, W = fg.shape
    dp = np.pad(np.where(fg, depth, 1e9), 1, constant_values=1e9)
    brk = np.zeros_like(fg)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        brk |= fg & (depth - dp[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] > 3.0)
    dark = LUT[np.clip(ids - 1, 0, len(KEYS) - 1), 0]
    out[brk] = dark[brk]
    return out, a


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


def components(mask):
    """4-connected pixel groups of a small mask, as lists of (y, x)."""
    seen, out = np.zeros_like(mask), []
    for y, x in zip(*np.where(mask)):
        if seen[y, x]:
            continue
        stack, comp = [(y, x)], []
        seen[y, x] = True
        while stack:
            cy, cx = stack.pop()
            comp.append((cy, cx))
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < mask.shape[0] and 0 <= nx < mask.shape[1] and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    stack.append((ny, nx))
        out.append(comp)
    return out


def draw_eyes(rgb, ids):
    """Anime eyes, drawn as a pixel artist would at this size (the eye meshes only say where): a thick dark upper lash
    that flicks up at the outer corner, a red iris dark above and bright below with a white catch-light, and a white
    corner. Bangs drawn over the eye stay on top."""
    E = ids == KEYS.index('eye') + 1
    eyes = [c for c in components(E) if len(c) >= 1]
    if not eyes:
        return
    face = (ids == KEYS.index('skin') + 1) | E
    hair = ids == KEYS.index('hair') + 1
    centres = [(np.mean([p[0] for p in c]), np.mean([p[1] for p in c]), c) for c in eyes]
    mid_x = np.mean([c[1] for c in centres]) if len(centres) > 1 else None
    ink, dark, bright, white = ME.PAL['ink'], ME.PAL['cp1'], ME.PAL['cp3'], ME.PAL['wht']
    H, W = ids.shape

    def put(y, x, col):
        if 0 <= y < H and 0 <= x < W and face[y, x]:
            rgb[y, x] = col

    for cy, cx, comp in centres:
        if mid_x is not None:
            out_dir = 1 if cx > mid_x else -1
        else:                                   # one eye in view: the outer corner is toward the hair mass
            hy, hx = np.where(hair[max(0, int(cy) - 12):int(cy) + 12])
            out_dir = 1 if len(hx) and hx.mean() > cx else -1
        xs = [p[1] for p in comp]
        w = int(np.clip(max(xs) - min(xs) + 1, 3, 5))
        y0 = min(p[0] for p in comp)
        x_in = int(round(cx)) - out_dir * (w // 2)
        cols = [x_in + out_dir * i for i in range(w)]
        for x in cols:                          # upper lash, and its flick past the outer corner
            put(y0, x, ink)
        put(y0, cols[-1] + out_dir, ink)
        put(y0 - 1, cols[-1] + out_dir, ink)
        iris = cols[1:-1] if w >= 4 else cols[:-1]
        for x in iris:
            put(y0 + 1, x, dark)
            put(y0 + 2, x, bright)
        put(y0 + 1, iris[0], white)             # catch-light
        put(y0 + 1, cols[-1], ink)              # the lash wraps the outer corner
        if w >= 4:
            put(y0 + 1, cols[0], white)         # white of the eye at the inner corner
            put(y0 + 2, cols[-1], white)        # and under the outer corner


def shade(out_dir, stem, cam, shadow=True):
    fg, ids, N, P, ao = passes(out_dir, stem)
    f = np.array(cam['f'])
    depth = np.where(fg, (P - (np.array(cam['center']) - f * 200)) @ f, 1e9)
    t = tones(fg, ids, N, ao, cam)
    rgb = LUT[np.clip(ids - 1, 0, len(KEYS) - 1), t]
    draw_eyes(rgb, ids)
    out, a = outline_sel(rgb, fg, depth, ids)
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
        frames = [shade(out_dir, '%s_%d' % (name, f), cams[name])[0] for f in (1, 2, 3)]
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
        im, fg, t, P = shade(out_dir, 'map_' + name, cams['map_' + name], shadow=False)
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
