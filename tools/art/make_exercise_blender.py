#!/usr/bin/env python3
"""Training Hall sprites rendered in Blender (replaces the ray-marched stand-in's output; same layout and palette).

Pipeline:
  1. export: the stand-in's poses (tools/art/make_exercise.py: EX, ORDER, MAPPOSE, cam) as JSON, plus armour detail
     (shoulder plates with gold rims, gauntlet cuffs, boot tops, chest emblem) that follows each pose;
  2. Blender: tools/art/blender_exercise_render.py builds the knight and props as keyframed objects (bevelled, smooth
     shaded) and renders ambient occlusion, normal, position and material-id passes to .npy (headless Cycles, CPU);
  3. pack, in the style of docs/PIXEL_STYLE.md (a modern pixel-art RPG, light from the top left):
       * cel shading from the normals: key light from the top left, a rim light on the far edge, ambient occlusion in
         the creases, a specular glint on steel and gold; 4 tones per material from the 28-colour PAL, no dithering;
       * a selective outline: ink around the silhouette, the material's own darkest tone on inner edges;
       * a hard oval ground shadow; the camera looks down a little (EL degrees) so the floor reads;
     then writes moves.webp and muscles.webp and rewrites MAP-DATA in js/v6-exercise.js.

Run:  BLENDER=/path/to/blender python3 tools/art/make_exercise_blender.py
      (BLENDER defaults to 'blender' on PATH; Blender 4.2 LTS was used.)  --no-blender repacks the last renders.
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

MATS = ['steel', 'iron', 'skin', 'hair', 'cape', 'gold', 'blue', 'leather', 'eye', 'mail']
METAL = {'steel', 'gold', 'iron'}
AMB, SUN, AO_SAMPLES = 0.12, 0.9, 128   # AMB / SUN only light the scene file; the sprites are shaded from the passes
EL = 12                                   # camera elevation for the moves (degrees, looking down)
TONES = (.42, .62, .80)                   # cut-offs of the light level between the 4 tones
SHADOW_ALPHA = 96                         # hard ground shadow: ink at a fixed opacity, no blur
SCRATCH = os.environ.get('EXERCISE_SCRATCH', os.path.join(tempfile.gettempdir(), 'exercise_blender'))
BLENDER = os.environ.get('BLENDER', 'blender')
BLEND_OUT = os.path.join(HERE, 'exercise_knight.blend')
LUT = np.array([[ME.PAL[ME.RAMP[m][t]] for t in range(5)] for m in MATS], np.uint8)


# ---------- export ----------
def ser(q):
    k = {}
    for key, v in q.k.items():
        if isinstance(v, np.ndarray):
            k[key] = v.tolist()
        elif isinstance(v, np.generic):
            k[key] = float(v)
        else:
            k[key] = v
    assert q.mat in MATS, q.mat
    return {'kind': q.kind, 'mat': q.mat, 'k': k}


def extras(P, sk):
    """Armour detail on top of the stand-in knight; built from the pose's skeleton so it moves with the body."""
    M = sk['M']
    R, U, F = M[:, 0], M[:, 1], M[:, 2]
    pel = np.asarray(P['pel'], float)
    out = [ME.ell(pel + U * 14.5 + F * 5.9, (2.4, 2.8, .9), M, 'gold')]  # chest emblem
    for s in (1, -1):
        sh, el, wr, _ = sk['arm', s]
        out += [ME.ell(sh + U * 1.8 + R * s * .8, (6.4, 4.2, 6.4), M, 'steel'),   # shoulder plate
                ME.ell(sh + U * .3 + R * s * .8, (6.9, 1.2, 6.9), M, 'gold')]     # its gold rim
        fa = ME.nrm(wr - el)
        out.append(ME.cyl(wr - fa * 1.6, fa, 3.9, .9, 'gold'))                   # gauntlet cuff
        _, kn, an, _ = sk['leg', s]
        sn = ME.nrm(an - kn)
        out.append(ME.cyl(an - sn * 4.6, sn, 4.7, 1.1, 'leather'))               # boot top
    return out


def build(P, shield=True, cape=True):
    pr, sk = ME.knight(P, shield=shield, cape=cape)
    return pr + extras(P, sk)


def prims(P, shield=True, cape=True):
    return [ser(q) for q in build(P, shield, cape)]


def key_points(poses):
    pts = []
    for P in poses:
        for q in build(P):
            for kk in ('a', 'b', 'c'):
                if kk in q.k:
                    pts.append(q.k[kk])
    return np.array(pts)


def fit(yaw, el, poses):
    """Like moves() in make_exercise.py: one centre and scale for all frames of a move, so the knight does not jump."""
    pts = key_points(poses)
    r, u, _ = ME.cam(yaw, el)
    sx, sy = pts @ r, pts @ u
    span = max(sx.max() - sx.min() + 14, sy.max() - sy.min() + 18)
    scale = min(1.0, (96 - 4) / span)
    c = r * (sx.max() + sx.min()) / 2 + u * (sy.max() + sy.min()) / 2
    return c, scale


def floor_print(poses):
    """Footprint on the floor (y = 0) of what stands on it: centre x, z and half sizes."""
    pts = key_points(poses)
    low = pts[pts[:, 1] < 12]
    low = low if len(low) else pts
    (x0, z0), (x1, z1) = low[:, [0, 2]].min(axis=0), low[:, [0, 2]].max(axis=0)
    return [(x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2 + 5, (z1 - z0) / 2 + 5]


def view(yaw, el, center, scale):
    r, u, f = ME.cam(yaw, el)
    light = ME.LIGHT[0] * r + ME.LIGHT[1] * u + ME.LIGHT[2] * (-f)  # the stand-in's camera-space light, in world space
    return {'r': r.tolist(), 'u': u.tolist(), 'f': f.tolist(), 'center': np.asarray(center, float).tolist(),
            'scale': float(scale), 'light': light.tolist()}


def export(path):
    moves = []
    for name in ME.ORDER:
        yaw, A, B = ME.EX[name]
        poses = [A, ME.lerp_pose(A, B, .5), B]
        c, scale = fit(yaw, EL, poses)
        cam = view(yaw, EL, c, scale)
        cam['floor'] = floor_print(poses)
        pose_prims = [prims(P) for P in poses]
        kinds = [[q['kind'] for q in pp] for pp in pose_prims]
        assert kinds[0] == kinds[1] == kinds[2], 'primitive list differs between poses of %s' % name
        moves.append({'name': name, 'cam': cam, 'poses': pose_prims})
    map_views = []
    for name, yaw in (('front', 0), ('back', 180)):
        v = view(yaw, 0, [0, 44, 0], 1.0)
        v['name'] = name
        map_views.append(v)
    data = {'mats': MATS, 'amb': AMB, 'sun': SUN, 'shade_samples': AO_SAMPLES, 'moves': moves,
            'map': {'prims': prims(ME.MAPPOSE, shield=False, cape=False), 'views': map_views}}
    json.dump(data, open(path, 'w'))


def run_blender(pose_json, out_dir):
    cmd = [BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'blender_exercise_render.py'), '--',
           pose_json, out_dir, BLEND_OUT]
    subprocess.run(cmd, check=True)


# ---------- pack ----------
def load(out_dir, name):
    return np.load(os.path.join(out_dir, name))


def valid_pos(pos):
    """Position samples that were encoded inside the range; the edge of the range means the pass was clamped."""
    rgb = pos[..., :3]
    return np.all((rgb > 0.002) & (rgb < 0.998), axis=-1)


def to_stand(v):
    """Blender (x, y forward, z up) -> stand-in (x, y up, z forward)."""
    return np.stack([v[..., 0], v[..., 2], -v[..., 1]], -1)


def passes(out_dir, stem):
    ao = load(out_dir, stem + '_ao.npy')
    nrm = load(out_dir, stem + '_nrm.npy')
    pos = load(out_dir, stem + '_pos.npy')
    idp = load(out_dir, stem + '_id.npy')
    ids = np.rint(idp[..., 0] * 32).astype(int)            # material id 1..10, 0 = background
    fg = (ids > 0) & valid_pos(pos)
    N = to_stand(nrm[..., :3] * 2 - 1)
    N /= np.maximum(np.linalg.norm(N, axis=-1, keepdims=True), 1e-6)
    P = to_stand(pos[..., :3] * 256 - 128)
    return fg, ids, N, P, np.clip(ao[..., 0], 0, 1)


def tones(fg, ids, N, ao, cam):
    """Cel tone 0..3 per pixel (4 = specular glint): key light, ambient occlusion, rim light and glint."""
    r, u, f = (np.array(cam[k]) for k in ('r', 'u', 'f'))
    n = np.stack([N @ r, N @ u, -(N @ f)], -1)              # camera space, z toward the viewer
    lam = n @ ME.LIGHT
    v = (0.5 * lam + 0.5) * (0.55 + 0.45 * ao)              # half-lambert, darkened in the creases
    t = np.select([v < TONES[0], v < TONES[1], v < TONES[2]], [0, 1, 2], 3)
    rim = (n[..., 0] > .6) & (n[..., 2] < .5) & (lam < .2)  # far edge, away from the key light
    t = np.where(rim, np.minimum(t + 1, 3), t)
    h = ME.nrm(ME.LIGHT + np.array([0, 0, 1.0]))
    metal = np.isin(ids, [MATS.index(m) + 1 for m in METAL])
    t = np.where(metal & (n @ h > .965) & (ao > .8), 4, t)
    return np.where(fg, t, 0)


def outline_sel(rgb, fg, depth, ids):
    """Ink around the silhouette; inner edges (depth breaks) in the darkest tone of the nearer material."""
    out, a = ME.outline(rgb, fg, np.where(fg, 0.0, 1e9))   # silhouette only
    H, W = fg.shape
    dp = np.pad(np.where(fg, depth, 1e9), 1, constant_values=1e9)
    brk = np.zeros_like(fg)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        brk |= fg & (depth - dp[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] > 3.5)
    dark = LUT[np.clip(ids - 1, 0, len(MATS) - 1), 0]
    out[brk] = dark[brk]
    return out, a


def ground_shadow(cam, fg_a, W, H):
    """Hard oval shadow on the floor under the knight and the props, behind everything else."""
    cx, cz, hx, hz = cam['floor']
    r, u = np.array(cam['r']), np.array(cam['u'])
    c, s = np.array(cam['center']), cam['scale']
    th = np.linspace(0, 2 * np.pi, 48, endpoint=False)
    pts = np.stack([cx + hx * np.cos(th), np.zeros_like(th), cz + hz * np.sin(th)], -1) - c
    poly = [(W / 2 + float(p @ r) * s, H / 2 - float(p @ u) * s) for p in pts]
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    return (np.asarray(m) > 0) & ~fg_a


def sprite_frame(out_dir, name, frame, cam):
    fg, ids, N, P, ao = passes(out_dir, '%s_%d' % (name, frame))
    f = np.array(cam['f'])
    depth = np.where(fg, (P - (np.array(cam['center']) - f * 160)) @ f, 1e9)
    t = tones(fg, ids, N, ao, cam)
    rgb = LUT[np.clip(ids - 1, 0, len(MATS) - 1), t]
    out, a = outline_sel(rgb, fg, depth, ids)
    im = np.asarray(ME.to_img(out, a)).copy()
    sh = ground_shadow(cam, a, *fg.shape[::-1])
    im[sh, :3] = ME.PAL['ink']
    im[sh, 3] = SHADOW_ALPHA
    return Image.fromarray(im, 'RGBA')


def moves_sheet(out_dir, data):
    S = 96
    sheet = Image.new('RGBA', (S * 4, S * len(ME.ORDER)), (0, 0, 0, 0))
    for row, mv in enumerate(data['moves']):
        frames = [sprite_frame(out_dir, mv['name'], f, mv['cam']) for f in (1, 2, 3)]
        for i, fi in enumerate([0, 1, 2, 1]):
            sheet.paste(frames[fi], (i * S, row * S))
    return sheet


def muscles_sheet(out_dir, data):
    W, H = 64, 96
    sheet = Image.new('RGBA', (W * 2, H * (1 + len(ME.MUSCLES))), (0, 0, 0, 0))
    _, sk = ME.knight(ME.MAPPOSE, shield=False, cape=False)
    maps = {}
    for col, v in enumerate(data['map']['views']):
        fg, mat_ids, N, P, ao = passes(out_dir, 'map_' + v['name'])
        t = tones(fg, mat_ids, N, ao, v)
        ids = np.full((H, W), -1)
        for yy, xx in zip(*np.where(fg)):
            ids[yy, xx] = ME.classify(P[yy, xx], sk)
        rgb = LUT[np.clip(mat_ids - 1, 0, len(MATS) - 1), t]
        f = np.array(v['f'])
        depth = np.where(fg, (P - (np.array(v['center']) - f * 160)) @ f, 1e9)
        out, a = outline_sel(rgb, fg, depth, mat_ids)
        sheet.paste(ME.to_img(out, a), (col * W, 0))
        tt = np.minimum(t, 3)
        for i in range(len(ME.MUSCLES)):
            m = ids == i
            im = np.zeros((H, W, 4), np.uint8)
            for k in range(3):
                # tones 0-1 -> the darkest teal, 2 -> middle, 3 -> lightest
                sel = m & (np.clip(tt - 1, 0, 2) == k)
                im[sel, :3] = ME.TEAL[k]
                im[sel, 3] = 255
            sheet.paste(Image.fromarray(im, 'RGBA'), (col * W, (1 + i) * H))
            if not m.any() and ((col == 0 and i in (4, 7, 13, 14, 15, 16, 11)) or (col == 1 and i in (0, 1, 2, 3, 6, 12, 17, 18))):
                print('WARNING: no pixels for', ME.MUSCLES[i], 'in view', col, file=sys.stderr)
        maps['front' if col == 0 else 'back'] = ME.rle(ids)
    return sheet, maps


if __name__ == '__main__':
    os.makedirs(SCRATCH, exist_ok=True)
    pose_json = os.path.join(SCRATCH, 'poses.json')
    out_dir = os.path.join(SCRATCH, 'render')
    os.makedirs(out_dir, exist_ok=True)
    if '--no-blender' not in sys.argv:
        export(pose_json)
        run_blender(pose_json, out_dir)
    data = json.load(open(pose_json))
    mv = moves_sheet(out_dir, data)
    print('moves colours', ME.check_palette(mv), file=sys.stderr)
    ME.save(mv, 'moves.webp')
    ms, maps = muscles_sheet(out_dir, data)
    print('map colours', ME.check_palette(ms, ME.TEAL), file=sys.stderr)
    ME.save(ms, 'muscles.webp')
    ME.write_js(maps)
    print('MAP-DATA rewritten', file=sys.stderr)
