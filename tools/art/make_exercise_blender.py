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
    'skin': ['sk1', 'sk2', 'sk3', 'sk3', 'sk3'],      # anime skin is lit flat: the light tones only (face: two)
    'glove': ['ink', 'hr0', 'lt1', 'hr1', 'hr1'],
    'coat': ['ink', 'st0', 'ir1', 'st1', 'st2'],
    'trim': ['gd0', 'gd1', 'gd2', 'gd3', 'wht'],
    'steel': ['st1', 'st2', 'st3', 'st4', 'wht'],
    'hair': ['hr0', 'hr1', 'hr1', 'hr2', 'hr3'],       # the knight's brown (assets/img/kn.webp), mostly mid-dark
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


# The face, drawn like pixel art and anchored where the eye meshes land (the rendered head is too small for rendered
# features). FRONT[RES] rows: (offset from the upper lids, pattern centred on the nose bridge); SIDE[RES]: the eye in
# profile, inner corner first. '.' leaves the render as it is.
FRONT = {
    1: [(-2, '.BB..BB.'), (0, 'LLL..LLL'), (1, 'WIi..iIW'), (3, '...n....'), (5, '...mm...')],
    2: [(-4, '.BB..........BB.'),      # brows: inner ends low, outer ends raised (composed, confident)
        (-3, '...BBB....BBB...'),
        (-1, 'L..............L'),      # the upper lids flick up at the outer corners
        (0, '.LLLLL....LLLLL.'),       # heavy upper lids
        (1, '.WiHi......iHiW.'),       # dark top of the irises, a catch-light, white at the outer corners
        (2, '..III......III..'),       # bright lower irises
        (3, '...w........w...'),       # a soft lower lid
        (5, '........n.......'),       # the nose: a shadow down one side
        (6, '.......nn.......'),
        (8, '......MmmM......')],      # the mouth: dark centre, soft corners
}


def front_face(width, left_eye, eye_at, brow, brow_at, centre):
    """A front face pattern: the left eye and brow as drawn (outer corner first), mirrored for the right, plus the
    centre rows (nose, mouth). Rows are (offset from the upper lids, pattern) of the given width."""
    rows = {}

    def place(dy, col, text):
        row = rows.setdefault(dy, ['.'] * width)
        for i, ch in enumerate(text):
            if ch != '.':
                row[col + i] = ch

    for dy, text in left_eye:
        place(dy, eye_at, text)
        place(dy, width - eye_at - len(text), text[::-1])
    for dy, text in brow:
        place(dy, brow_at, text)
        place(dy, width - brow_at - len(text), text[::-1])
    for dy, text in centre:
        place(dy, 0, text)
    return sorted((dy, ''.join(r)) for dy, r in rows.items())


FRONT[4] = front_face(
    32,
    [(-1, 'L.........'),        # the lid flicks up at the outer corner
     (0, 'LLLLLLLLLl'),         # heavy upper lid, thinner toward the nose
     (1, 'LWiippiiW.'),         # dark top of the iris, the pupil
     (2, 'WWiHppiIW.'),         # catch-light beside the pupil
     (3, '.WIIiiIIW.'),         # bright lower iris
     (4, '..WIIIIW..'),
     (5, '...wwww...')],        # soft lower lid
    3,
    [(-8, 'BB....'), (-7, '.BBBBB'), (-6, '....BBBBB')],   # brows: raised outer ends, lower toward the nose
    1,
    [(9, '.................n..............'),            # the nose: a shadow down one side and under the tip
     (10, '.................n..............'),
     (11, '...............nn...............'),
     (15, '.............MmmmmM.............'),           # the mouth
     (16, '...............ww...............')])          # lower-lip shadow
# both catch-lights sit toward the light (top left), so the right eye's is not mirrored
FRONT[4] = [(dy, row[:20] + 'WIiHppiWW' + row[29:]) if dy == 2 else (dy, row) for dy, row in FRONT[4]]
SIDE = {1: [(0, 'LLLl'), (1, 'IiW.')],
        2: [(-1, '....L'), (0, 'LLLLL'), (1, 'iHiW.'), (2, 'III..'), (3, '.w...')],
        4: [(-1, '......L'), (0, 'LLLLLLL'), (1, 'iippiW.'), (2, 'IHpiWW.'), (3, 'IIiIW..'), (4, '.IIW...'),
            (5, '.www...')]}
FACE_INK = {'B': 'hr0', 'L': 'hr0', 'l': 'hr1', 'I': 'cp3', 'i': 'cp1', 'p': 'cp0', 'H': 'wht', 'W': 'st4',
            'w': 'sk1', 'n': 'sk1', 'm': 'sk0', 'M': 'sk1'}


def draw_eyes(rgb, ids, front=None, side=None, ink=None):
    """Anime eyes (dark-brown upper lids, two-tone red irises with a catch-light, a little white) and, from the front,
    brows, a nose shadow and a mouth. No black rings, so the eyes do not look hollow. Eyes and brows may cover bang
    tips (the bangs fall past the eyes); the nose, mouth and lower lids only ever sit on skin."""
    front, side, ink = front or FRONT[RES], side or SIDE[RES], ink or FACE_INK
    E = ids == KEYS.index('eye') + 1
    if not E.any():
        return
    on = lambda keys: np.isin(ids, [KEYS.index(k) + 1 for k in keys])
    skin, faceish = on(('skin', 'nose', 'mouth')), on(('skin', 'eye', 'hair', 'brow', 'nose', 'mouth'))
    H, W = ids.shape

    def put(y, x, ch):
        if ch == '.' or not (0 <= y < H and 0 <= x < W):
            return
        if (skin if ch in 'nmMw' else faceish)[y, x]:
            rgb[y, x] = ME.PAL[ink[ch]]

    ys, xs = np.where(E)
    half = len(front[0][1]) // 2
    if len(components(E)) > 1 or xs.max() - xs.min() + 1 >= 3 * RES + 1:   # both eyes in view: the front face
        y0, cx = ys.min(), int(round(xs.mean() + .5))
        for dy, row in front:
            for i, ch in enumerate(row):
                put(y0 + dy, cx - half + i, ch)
        return
    cy, cx = ys.mean(), xs.mean()                           # one eye in view: the outer corner faces the hair
    hx = np.where(on(('hair',))[max(0, int(cy) - 8 * RES):int(cy) + 8 * RES])[1]
    out = 1 if len(hx) and hx.mean() > cx else -1
    x_in = int(round(cx)) - out * RES
    for dy, row in side:
        for i, ch in enumerate(row):
            put(ys.min() + dy, x_in + out * i, ch)


def face_skin(ids, reach=7 * RES):
    """Skin within a few pixels of the eyes: the face (the neck and hands keep their shading)."""
    skin = np.isin(ids, [KEYS.index(k) + 1 for k in ('skin', 'nose', 'mouth')])
    ys, xs = np.where(ids == KEYS.index('eye') + 1)
    if not len(ys):
        return np.zeros_like(skin)
    yy, xx = np.mgrid[0:ids.shape[0], 0:ids.shape[1]]
    near = (np.abs(yy - ys.mean()) <= reach) & (np.abs(xx - xs.mean()) <= reach)
    return skin & near


def shade(out_dir, stem, cam, shadow=True):
    fg, ids, N, P, ao = passes(out_dir, stem)
    f = np.array(cam['f'])
    depth = np.where(fg, (P - (np.array(cam['center']) - f * 200)) @ f, 1e9)
    t = tones(fg, ids, N, ao, cam)
    t = np.where(face_skin(ids), np.maximum(t, 2), t)        # the face takes the two lightest skin tones
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
