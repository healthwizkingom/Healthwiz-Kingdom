#!/usr/bin/env python3
"""Training Hall sprites rendered in Blender (replaces the ray-marched stand-in's output; same layout and palette).

Pipeline:
  1. export: the stand-in's poses (tools/art/make_exercise.py: EX, ORDER, MAPPOSE, cam) as JSON;
  2. Blender: tools/art/blender_exercise_render.py builds the knight and props as keyframed objects and renders
     shade / pos / id passes to .npy (headless Cycles, CPU);
  3. pack: quantise each pixel to the 28-colour PAL (4 tones per material, no dithering), add the 1-pixel ink
     outline, write moves.webp and muscles.webp, rewrite MAP-DATA in js/v6-exercise.js.

Run:  BLENDER=/path/to/blender python3 tools/art/make_exercise_blender.py
      (BLENDER defaults to 'blender' on PATH; Blender 4.2 LTS was used.)
Intermediate files go to SCRATCH (not the repo).
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_exercise as ME  # noqa: E402  (palette, outline, to_img, check_palette, rle, write_js, save, poses)

MATS = ['steel', 'iron', 'skin', 'hair', 'cape', 'gold', 'blue', 'leather', 'eye', 'mail']
AMB, SUN, SHADE_SAMPLES = 0.12, 0.9, 32
# tone thresholds on the shade pass: the stand-in's lambert cut-offs (.08 / .45 / .8) mapped onto AMB + SUN * lambert
THRESH = [AMB + SUN * t for t in (.08, .45, .8)]
SCRATCH = os.environ.get('EXERCISE_SCRATCH', os.path.join(tempfile.gettempdir(), 'exercise_blender'))
BLENDER = os.environ.get('BLENDER', 'blender')
BLEND_OUT = os.path.join(HERE, 'exercise_knight.blend')


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


def prims(P, shield=True, cape=True):
    pr, _ = ME.knight(P, shield=shield, cape=cape)
    return [ser(q) for q in pr]


def fit(yaw, poses):
    """The same framing as moves() in make_exercise.py: one centre and scale for all frames of a move."""
    pts = []
    for P in poses:
        pr, _ = ME.knight(P)
        for q in pr:
            for kk in ('a', 'b', 'c'):
                if kk in q.k:
                    pts.append(q.k[kk])
    pts = np.array(pts)
    r, u, _ = ME.cam(yaw)
    sx, sy = pts @ r, pts @ u
    span = max(sx.max() - sx.min() + 14, sy.max() - sy.min() + 16)
    scale = min(1.0, (96 - 4) / span)
    c = r * (sx.max() + sx.min()) / 2 + u * (sy.max() + sy.min()) / 2
    return c, scale


def light_world(yaw):
    """The stand-in's light (camera space) expressed in stand-in world space, for this view."""
    r, u, f = ME.cam(yaw)
    return ME.LIGHT[0] * r + ME.LIGHT[1] * u + ME.LIGHT[2] * (-f)


def view(yaw, center, scale):
    r, u, f = ME.cam(yaw)
    return {'f': f.tolist(), 'center': np.asarray(center, float).tolist(), 'scale': float(scale),
            'light': light_world(yaw).tolist()}


def export(path):
    moves = []
    for name in ME.ORDER:
        yaw, A, B = ME.EX[name]
        poses = [A, ME.lerp_pose(A, B, .5), B]
        c, scale = fit(yaw, poses)
        cam = view(yaw, c, scale)
        pose_prims = [prims(P) for P in poses]
        kinds = [[q['kind'] for q in pp] for pp in pose_prims]
        assert kinds[0] == kinds[1] == kinds[2], 'primitive list differs between poses of %s' % name
        moves.append({'name': name, 'cam': cam, 'poses': pose_prims})
    map_prims = prims(ME.MAPPOSE, shield=False, cape=False)
    map_views = []
    for name, yaw in (('front', 0), ('back', 180)):
        v = view(yaw, [0, 44, 0], 1.0)
        v['name'] = name
        map_views.append(v)
    data = {'mats': MATS, 'amb': AMB, 'sun': SUN, 'shade_samples': SHADE_SAMPLES, 'moves': moves,
            'map': {'prims': map_prims, 'views': map_views}}
    json.dump(data, open(path, 'w'))


def run_blender(pose_json, out_dir):
    cmd = [BLENDER, '-b', '--factory-startup', '-P', os.path.join(HERE, 'blender_exercise_render.py'), '--',
           pose_json, out_dir, BLEND_OUT]
    subprocess.run(cmd, check=True)


def load(out_dir, name):
    return np.load(os.path.join(out_dir, name))


def valid_pos(pos):
    """Position samples that were encoded inside the range; the edge of the range means the pass was clamped."""
    rgb = pos[..., :3]
    return np.all((rgb > 0.002) & (rgb < 0.998), axis=-1)


def sprite_frame(out_dir, name, frame, cam):
    shade = load(out_dir, '%s_%d_shade.npy' % (name, frame))[..., 0]
    pos = load(out_dir, '%s_%d_pos.npy' % (name, frame))
    idp = load(out_dir, '%s_%d_id.npy' % (name, frame))
    ids = np.rint(idp[..., 0] * 32).astype(int)            # material id 1..10, 0 = background
    fg = (ids > 0) & valid_pos(pos)
    P = pos[..., :3] * 256 - 128                              # Blender world (x, y forward, z up)
    Ps = np.stack([P[..., 0], P[..., 2], -P[..., 1]], -1)     # back to stand-in world (x, y up, z forward)
    f = np.array(cam['f']); o = np.array(cam['center']) - f * 160
    depth = np.where(fg, (Ps - o) @ f, 1e9)
    tone = np.select([shade < THRESH[0], shade < THRESH[1], shade < THRESH[2]], [0, 1, 2], 3)
    lut = np.array([[ME.PAL[ME.RAMP[m][t]] for t in range(4)] for m in MATS], np.uint8)
    rgb = lut[np.clip(ids - 1, 0, len(MATS) - 1), tone]
    out, a = ME.outline(rgb, fg, depth)
    return ME.to_img(out, a)


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
        shade = load(out_dir, 'map_%s_shade.npy' % v['name'])[..., 0]
        alpha = load(out_dir, 'map_%s_shade.npy' % v['name'])[..., 3]
        pos = load(out_dir, 'map_%s_pos.npy' % v['name'])
        idp = load(out_dir, 'map_%s_id.npy' % v['name'])
        fg = (alpha > 0.5) & valid_pos(pos)
        mat_ids = np.rint(idp[..., 0] * 32).astype(int)
        tone = np.select([shade < THRESH[0], shade < THRESH[1], shade < THRESH[2]], [0, 1, 2], 3)
        P = pos[..., :3] * 256 - 128
        Ps = np.stack([P[..., 0], P[..., 2], -P[..., 1]], -1)
        ids = np.full((H, W), -1)
        for yy, xx in zip(*np.where(fg)):
            ids[yy, xx] = ME.classify(Ps[yy, xx], sk)
        # knight picture in row 0: the same palette lookup as the moves, with the outline
        lut = np.array([[ME.PAL[ME.RAMP[m][t]] for t in range(4)] for m in MATS], np.uint8)
        rgb = lut[np.clip(mat_ids - 1, 0, len(MATS) - 1), tone]
        out, a = ME.outline(rgb, fg, np.where(fg, 0.0, 1e9))
        sheet.paste(ME.to_img(out, a), (col * W, 0))
        for i in range(len(ME.MUSCLES)):
            m = ids == i
            im = np.zeros((H, W, 4), np.uint8)
            for k in range(3):
                # tones 0-1 -> the darkest teal, 2 -> middle, 3 -> lightest (the stand-in's lum thresholds)
                sel = m & (np.clip(tone - 1, 0, 2) == k)
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
    export(pose_json)
    data = json.load(open(pose_json))
    if '--no-blender' not in sys.argv:
        run_blender(pose_json, out_dir)
    mv = moves_sheet(out_dir, data)
    print('moves colours', ME.check_palette(mv), file=sys.stderr)
    ME.save(mv, 'moves.webp')
    ms, maps = muscles_sheet(out_dir, data)
    print('map colours', ME.check_palette(ms, ME.TEAL), file=sys.stderr)
    ME.save(ms, 'muscles.webp')
    ME.write_js(maps)
    print('MAP-DATA rewritten', file=sys.stderr)
