#!/usr/bin/env python3
"""Exercise sprites for the Wizard's Training Hall (js/v6-exercise.js).

Stand-in for the Blender pipeline: the Blender connector was not reachable when this was made, so the same steps run
here in plain Python (numpy + Pillow, no other dependency):

  1. A simple 3D knight built from primitives (capsules, spheres, rounded boxes), coloured like assets/img/kn.webp:
     maroon-brown cape, steel armour, gold trim, blue shield, brown hair and boots.
  2. Each exercise is posed with 2 keyframes; the in-between frame is interpolated, giving a 4-frame loop
     (start, middle, end, middle).
  3. Every frame is ray-marched (signed distance fields, orthographic camera, one ray per pixel, so no anti-aliasing)
     at 96 x 96 px, cel-shaded into 4 tones per material from one light, and given a 1-pixel ink outline.
  4. Every pixel is one of the fixed palette PAL below (28 colours). No smoothing, no dithering.
  5. Output, lossless WebP:
       assets/img/exercise/moves.webp    one row per exercise (ORDER), 4 frames of 96 x 96
       assets/img/exercise/muscles.webp  the muscle map: column 0 front, column 1 back, 64 x 96 each;
                                         row 0 the knight, row 1 + i the mask of muscle MUSCLES[i] (one colour mask
                                         per muscle group, mana-teal on transparent)
     and rewrites the block between the MAP-DATA markers in js/v6-exercise.js (tap map, run-length encoded).

Run:  python3 tools/art/make_exercise.py
"""
import math, os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
OUT = os.path.join(ROOT, 'assets', 'img', 'exercise')

# ---------- palette (fixed, 28 colours) ----------
HEX = {
    'ink': '#1b1626',
    'st0': '#2e313b', 'st1': '#5d5f61', 'st2': '#828c91', 'st3': '#bcc2c5', 'st4': '#dfded8', 'wht': '#f8f9f3',
    'ir1': '#38444e',
    'sk0': '#6e3e2e', 'sk1': '#935c45', 'sk2': '#c5a68d', 'sk3': '#e3c4a6',
    'hr0': '#29121b', 'hr1': '#5b3932', 'hr2': '#8a5434', 'hr3': '#b07a4a',
    'cp0': '#3e191e', 'cp1': '#7b181c', 'cp2': '#99392e', 'cp3': '#c0503a',
    'gd0': '#6b4a12', 'gd1': '#a8781e', 'gd2': '#d9a62e', 'gd3': '#f2d26a',
    'bl0': '#14284a', 'bl1': '#3f6fae', 'bl2': '#8fb4e0',
    'lt1': '#3a2418',
}
PAL = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in HEX.items()}
RAMP = {  # dark → light; a 5th entry is the specular glint
    'steel': ['st0', 'st1', 'st2', 'st3', 'wht'],
    'iron': ['ink', 'st0', 'ir1', 'st1', 'st2'],
    'skin': ['sk0', 'sk1', 'sk2', 'sk3', 'sk3'],
    'hair': ['hr0', 'hr1', 'hr2', 'hr3', 'hr3'],
    'cape': ['cp0', 'cp1', 'cp2', 'cp3', 'cp3'],
    'gold': ['gd0', 'gd1', 'gd2', 'gd3', 'wht'],
    'blue': ['bl0', 'bl0', 'bl1', 'bl2', 'bl2'],
    'leather': ['hr0', 'lt1', 'hr1', 'sk1', 'sk1'],
    'eye': ['ink', 'ink', 'ink', 'ink', 'ink'],
    'mail': ['st0', 'st1', 'st1', 'st2', 'st3'],
}
TEAL = [(26, 165, 150), (62, 230, 208), (170, 255, 240)]  # mask tones (not part of the knight's palette)

# ---------- signed distance functions ----------
def nrm(v):
    v = np.asarray(v, float); n = np.linalg.norm(v); return v / n if n else v

def frame(up, fwd):
    """Rotation whose columns are right, up, forward (world)."""
    u = nrm(up); f = nrm(np.asarray(fwd, float) - u * np.dot(fwd, u)); r = np.cross(u, f)
    return np.stack([r, u, f], axis=1)

def axis_frame(ax):
    """A frame whose up axis is `ax`."""
    a = nrm(ax); ref = np.array([0, 0, 1.0]) if abs(a[2]) < .9 else np.array([1.0, 0, 0])
    return frame(a, ref)

class Prim:
    def __init__(s, kind, mat, **k): s.kind, s.mat, s.k = kind, mat, k
    def d(s, p):
        k = s.k
        if s.kind == 'cap':
            a, b, r = k['a'], k['b'], k['r']; pa = p - a; ba = b - a
            h = np.clip((pa @ ba) / max(ba @ ba, 1e-9), 0, 1)
            return np.linalg.norm(pa - h[:, None] * ba, axis=1) - r
        if s.kind == 'sph':
            return np.linalg.norm(p - k['c'], axis=1) - k['r']
        q = (p - k['c']) @ k['M']  # local coordinates
        if s.kind == 'box':
            rr = k.get('rr', 1.0); q = np.abs(q) - (k['h'] - rr)
            return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(axis=1), 0) - rr
        if s.kind == 'ell':
            r = k['h']; k0 = np.linalg.norm(q / r, axis=1); k1 = np.linalg.norm(q / (r * r), axis=1)
            return k0 * (k0 - 1) / np.maximum(k1, 1e-9)
        if s.kind == 'cyl':  # along local up
            d = np.stack([np.hypot(q[:, 0], q[:, 2]) - k['r'], np.abs(q[:, 1]) - k['hh']], axis=1)
            return np.minimum(d.max(axis=1), 0) + np.linalg.norm(np.maximum(d, 0), axis=1)
        raise ValueError(s.kind)

def cap(a, b, r, m): return Prim('cap', m, a=np.asarray(a, float), b=np.asarray(b, float), r=r)
def sph(c, r, m): return Prim('sph', m, c=np.asarray(c, float), r=r)
def box(c, h, M, m, rr=1.0): return Prim('box', m, c=np.asarray(c, float), h=np.asarray(h, float), M=M, rr=rr)
def ell(c, h, M, m): return Prim('ell', m, c=np.asarray(c, float), h=np.asarray(h, float), M=M)
def cyl(c, ax, r, hh, m): return Prim('cyl', m, c=np.asarray(c, float), M=axis_frame(ax), r=r, hh=hh)

# ---------- the knight ----------
DOWN, UP, FWD, BACK = (0, -1, 0), (0, 1, 0), (0, 0, 1), (0, 0, -1)
L_UA, L_FA, L_TH, L_SH = 14, 13, 17, 17

def V(*a): return nrm(a)

def knight(P, shield=True, cape=True):
    """P: pose. Returns (prims, skeleton). Limb directions are world vectors; s = +1 for the limb on +x (torso right)."""
    pel = np.asarray(P['pel'], float); M = frame(P.get('up', UP), P.get('fwd', FWD)); R, U, F = M[:, 0], M[:, 1], M[:, 2]
    T = lambda x, y, z: pel + R * x + U * y + F * z
    out, sk = [], {'M': M}
    # torso, belt, collar
    out += [box(T(0, 12, 0), (8.5, 10, 5.2), M, 'steel', 3.5), box(T(0, 1, 0), (7.6, 4, 4.6), M, 'steel', 2.5),
            box(T(0, 3.2, .2), (8.8, 1.5, 5.4), M, 'leather', 1), box(T(0, 3.2, 5.3), (1.6, 1.4, .6), M, 'gold', .4),
            box(T(0, 20, .5), (7, 1, 5.2), M, 'gold', .8), box(T(0, 12, 4.3), (5.5, 6.5, 1.3), M, 'steel', 2.5)]
    neck, head = T(0, 23, 0), T(0, 31, .5)
    out += [cap(T(0, 20, 0), neck + U * 2, 3.6, 'mail'), sph(head, 8.4, 'skin'), sph(head + U * 1.8 - F * 1.6, 8.9, 'hair'),
            sph(head + U * 4.6 + F * 3.4 + R * 2, 5.2, 'hair'), sph(head + U * 5.2 + F * 2.4 - R * 3, 4.6, 'hair'),
            sph(head + F * 7.7 + U * .4 + R * 3, 1.25, 'eye'), sph(head + F * 7.7 + U * .4 - R * 3, 1.25, 'eye')]
    sk['head'] = head
    if cape:
        out.append(box(T(0, 7, -6.6), (9.5, 15, .9), frame(U * .97 - F * .25, F), 'cape', .8))
    if shield:
        out += [ell(T(0, 13, -8.6), (7.4, 9, 1.3), M, 'gold'), ell(T(0, 13, -9.2), (6.4, 8, 1.3), M, 'blue')]
    # arms
    for s, ua, fa in ((1, P['ua'][0], P['fa'][0]), (-1, P['ua'][1], P['fa'][1])):
        sh = T(12 * s, 19 + P.get('shrug', 0), 0); el = sh + nrm(ua) * L_UA; wr = el + nrm(fa) * L_FA
        hd = wr + nrm(P.get('hand', [fa, fa])[0 if s > 0 else 1]) * 2.4
        out += [sph(sh, 5.6, 'steel'), cap(sh, el, 3.6, 'steel'), cap(el, wr, 3.4, 'steel'), sph(el, 2.3, 'gold'),
                cap(wr, hd, 2.6, 'steel')]
        sk['arm', s] = (sh, el, wr, hd)
        db = P.get('db')
        if db is not None:
            ax = nrm(db[0 if s > 0 else 1]) if np.ndim(db) == 2 else nrm(db)
            out += [cap(hd - ax * 4.5, hd + ax * 4.5, 1.1, 'iron'), cyl(hd + ax * 4.8, ax, 3.4, 1.4, 'iron'),
                    cyl(hd - ax * 4.8, ax, 3.4, 1.4, 'iron')]
    # legs
    for s, th, sn in ((1, P['th'][0], P['sh'][0]), (-1, P['th'][1], P['sh'][1])):
        hp = T(5 * s, -1, 0); kn = hp + nrm(th) * L_TH; an = kn + nrm(sn) * L_SH
        ft = an + nrm(P.get('ft', [FWD, FWD])[0 if s > 0 else 1]) * 5
        out += [cap(hp, kn, 4.5, 'steel'), cap(kn, an, 4.0, 'steel'),
                sph(kn + (F if np.dot(nrm(th), F) < .5 else U) * 2.6, 2.6, 'gold'), cap(an, ft, 3.3, 'leather'), cap(an - nrm(sn) * 3, an, 4.1, 'leather')]
        sk['leg', s] = (hp, kn, an, ft)
    return out + P.get('props', []), sk

# ---------- renderer ----------
LIGHT = nrm([-.55, .8, .6])  # camera space: from the top left, in front

def cam(yaw, el=0.0):
    t, e = math.radians(yaw), math.radians(el)
    f = np.array([-math.sin(t) * math.cos(e), -math.sin(e), -math.cos(t) * math.cos(e)])  # view direction
    r = nrm(np.cross(f, [0, 1, 0])); u = np.cross(r, f)
    return r, u, f

def scene_d(prims, p):
    D = np.stack([q.d(p) for q in prims], axis=0)
    return D.min(axis=0), D.argmin(axis=0)

def render(prims, yaw, W, H, center, scale=1.0, el=0.0):
    """→ (rgb, fg mask, depth, hit points, material index). center = world point at the image centre."""
    r, u, f = cam(yaw, el); ys, xs = np.mgrid[0:H, 0:W]
    px = ((xs + .5) - W / 2) / scale; py = (H / 2 - (ys + .5)) / scale
    o = np.asarray(center) + px.reshape(-1, 1) * r + py.reshape(-1, 1) * u - f * 160
    t = np.zeros(len(o)); hit = np.zeros(len(o), bool); alive = np.ones(len(o), bool)
    for _ in range(110):
        idx = np.where(alive)[0]
        if not len(idx): break
        d, _ = scene_d(prims, o[idx] + f * t[idx, None])
        t[idx] += d
        done = d < .04; hit[idx[done]] = True; alive[idx[done]] = False
        alive[idx[t[idx] > 330]] = False
    p = o + f * t[:, None]; rgb = np.zeros((len(o), 3), np.uint8); mat = np.full(len(o), -1)
    hi = np.where(hit)[0]
    if len(hi):
        ph = p[hi]; _, m = scene_d(prims, ph); e = .05
        n = np.stack([scene_d(prims, ph + np.eye(3)[i] * e)[0] - scene_d(prims, ph - np.eye(3)[i] * e)[0] for i in range(3)], 1)
        n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
        nc = np.stack([n @ r, n @ u, -(n @ f)], 1)  # camera space, z toward the viewer
        lam = nc @ LIGHT; hv = nrm(LIGHT + np.array([0, 0, 1])); spec = nc @ hv
        tone = np.select([lam < .08, lam < .45, lam < .8], [0, 1, 2], 3)
        for j, i in enumerate(hi):
            ramp = RAMP[prims[m[j]].mat]; k = 4 if (spec[j] > .97 and prims[m[j]].mat in ('steel', 'gold', 'iron')) else tone[j]
            rgb[i] = PAL[ramp[k]]
        mat[hi] = m
    return rgb.reshape(H, W, 3), hit.reshape(H, W), t.reshape(H, W), p.reshape(H, W, 3), mat.reshape(H, W)

def outline(rgb, fg, depth):
    """1-pixel ink outline outside the silhouette, and on depth breaks inside it."""
    H, W = fg.shape; out = rgb.copy(); a = fg.copy(); ink = PAL['ink']
    pad = np.pad(fg, 1)
    nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    edge = nb & ~fg; out[edge] = ink; a |= edge
    dp = np.pad(np.where(fg, depth, 1e9), 1, constant_values=1e9)
    for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nbd = dp[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx]
        brk = fg & (depth - nbd > 3.5)  # this pixel is well behind its neighbour
        out[brk] = ink
    return out, a

# ---------- props ----------
def bench(c, h, M=None):
    M = frame(UP, FWD) if M is None else M; c = np.asarray(c, float)
    top = box(c, h, M, 'leather', 1.2); legs = []
    for sx in (-1, 1):
        legs.append(cap(c + M[:, 2] * sx * (h[2] - 3) - M[:, 1] * h[1], c + M[:, 2] * sx * (h[2] - 3) - np.array([0, c[1], 0]) + np.array([0, .5, 0]), 1.6, 'iron'))
    return [top] + legs

# ---------- poses (world directions; the knight faces +z) ----------
def lerp_pose(A, B, w):
    out = {}
    for k, a in A.items():
        b = B.get(k, a)
        if k == 'props':
            out[k] = a if w < .5 else b
        elif isinstance(a, (int, float)):
            out[k] = a + (b - a) * w
        elif isinstance(a, (list, tuple)) and len(a) == 2 and np.ndim(a[0]) == 1:
            out[k] = [nrm(np.asarray(a[i]) * (1 - w) + np.asarray(b[i]) * w + 1e-6) for i in range(2)]
        elif isinstance(a, (list, tuple, np.ndarray)) and np.ndim(a) == 1 and len(a) == 3:
            out[k] = list(np.asarray(a) * (1 - w) + np.asarray(b) * w)
        else:
            out[k] = a
    if 'mk' in A: out['props'] = A['mk'](out)  # props that follow the body (cable, roller pad)
    return out

def stand(**k):
    P = {'pel': [0, 36, 0], 'ua': [V(.12, -1, 0), V(-.12, -1, 0)], 'fa': [V(.08, -1, .05), V(-.08, -1, .05)],
         'th': [V(.05, -1, 0), V(-.05, -1, 0)], 'sh': [V(0, -1, 0), V(0, -1, 0)], 'db': V(0, 0, 1)}
    P.update(k); return P

def pair(v, mirror=True):
    v = np.asarray(v, float); return [nrm(v), nrm(v * [-1, 1, 1])] if mirror else [nrm(v), nrm(v)]

def bent(pitch, **k):
    """Bent over at the hips, knees soft. pitch: degrees from upright."""
    a = math.radians(pitch); up = [0, math.cos(a), math.sin(a)]
    P = stand(up=up, fwd=[0, -math.sin(a), math.cos(a)], pel=[0, 33, -2], th=pair([.08, -1, .25]), sh=pair([0, -1, -.15]))
    P.update(k); return P

LY_M = frame(BACK, UP)  # lying face up: head toward -z, chest up

def lying(**k):
    P = {'pel': [0, 30, 6], 'up': BACK, 'fwd': UP, 'th': pair([.15, -.25, 1]), 'sh': pair([0, -1, .1]), 'ft': pair([0, 0, 1]),
         'ua': pair([.3, 1, 0]), 'fa': pair([0, 1, 0]), 'db': V(1, 0, 0)}
    P.update(k); return P

def seated(**k):
    P = stand(pel=[0, 25, 0], th=pair([.15, 0, 1]), sh=pair([0, -1, .05]), props=bench([0, 20, 4], (9, 2.5, 12)))
    P.update(k); return P

EX = {}
EX['shrug'] = (25, stand(), stand(shrug=5.5))
EX['row_sup'] = (-70, bent(50, ua=pair([.1, -1, .25]), fa=pair([.05, -1, .1]), db=V(1, 0, 0)),
                 bent(50, ua=pair([.25, -.35, -1]), fa=pair([0, -1, -.1]), db=V(1, 0, 0)))
EX['row_neu'] = (-70, bent(50, ua=pair([.05, -1, .2]), fa=pair([0, -1, .1]), db=V(0, 0, 1)),
                 bent(50, ua=pair([.08, -.3, -1]), fa=pair([0, -1, -.05]), db=V(0, 0, 1)))
_hyper = [box([0, 30, 4], (8, 2.5, 5), frame(V(0, 1, -1), V(0, 1, 1)), 'leather', 1.2), cap([0, 28, 4], [0, 0, 4], 1.8, 'iron'),
          cap([0, 6, -22], [0, 0, -22], 1.6, 'iron'), cap([0, 6, -22], [0, 22, 0], 1.6, 'iron')]
def _br(p):
    a = math.radians(p); return {'pel': [0, 33, 0], 'up': [0, math.cos(a), math.sin(a)], 'fwd': [0, -math.sin(a), math.cos(a)],
                                 'th': pair([0, -.75, -1]), 'sh': pair([0, -.75, -1]), 'ft': pair([0, -1, .2]),
                                 'ua': pair([.2, 0, 0]), 'fa': pair([-1, 0, 0]), 'props': _hyper}
def _brp(p):
    P = _br(p); a = math.radians(p); U = np.array([0, math.cos(a), math.sin(a)]); F = np.array([0, -math.sin(a), math.cos(a)])
    P['ua'] = [nrm(F * .9 - U * .3 + [.3, 0, 0]), nrm(F * .9 - U * .3 - [.3, 0, 0])]; P['fa'] = [nrm(U * .9 - [.5, 0, 0]), nrm(U * .9 + [.5, 0, 0])]
    return P
EX['back_raise'] = (-90, _brp(110), _brp(40))
EX['press'] = (20, stand(ua=pair([1, .05, .1]), fa=pair([0, 1, 0]), db=V(1, 0, 0)), stand(ua=pair([.3, 1, 0]), fa=pair([.05, 1, 0]), db=V(1, 0, 0)))
EX['front_raise'] = (-55, stand(ua=pair([.1, -1, .3]), fa=pair([.05, -1, .35]), db=V(1, 0, 0)),
                     stand(ua=pair([.05, 0, 1]), fa=pair([0, .05, 1]), db=V(1, 0, 0)))
EX['lat_raise'] = (10, stand(ua=pair([.35, -1, .05]), fa=pair([.3, -1, .15])), stand(ua=pair([1, .05, .05]), fa=pair([1, -.1, .25])))
EX['rear_fly'] = (35, bent(65, ua=pair([.15, -1, .1]), fa=pair([.1, -1, .15])), bent(65, ua=pair([1, -.25, 0]), fa=pair([1, -.4, .1])))
EX['curl'] = (-60, stand(ua=pair([.1, -1, 0]), fa=pair([.1, -1, .15]), db=V(1, 0, 0)), stand(ua=pair([.1, -1, .05]), fa=pair([0, .8, 1]), db=V(1, 0, 0)))
EX['hammer'] = (-60, stand(ua=pair([.1, -1, 0]), fa=pair([.1, -1, .15]), db=V(0, 0, 1)), stand(ua=pair([.1, -1, .05]), fa=pair([0, .8, 1]), db=V(0, 1, .3)))
_wr = dict(ua=pair([.2, -1, .45]), fa=pair([0, -.05, 1]), db=V(1, 0, 0))
EX['wrist_ext'] = (-55, seated(**_wr, hand=pair([0, -1, .4])), seated(**_wr, hand=pair([0, .8, 1])))
EX['wrist_curl'] = (-55, seated(**_wr, hand=pair([0, -.9, .5])), seated(**_wr, hand=pair([0, .9, .8])))
_cable = lambda: [cap([0, 32, 14], [0, 95, 14], .8, 'iron'), box([0, 93, 14], (5, 2, 3), frame(UP, FWD), 'iron', .5)]
def _pd(fa):
    P = stand(ua=pair([.12, -1, .15]), fa=pair(fa), db=None); P['props'] = []; return P
def _pdp(P):
    a = np.asarray(P['pel']) + [12, 19, 0] + nrm(P['ua'][0]) * L_UA + nrm(P['fa'][0]) * L_FA
    return [cap(a * [0, 1, 1] + [-12, 0, 0], a, .9, 'iron'), cap(a * [0, 1, 1], [0, 95, a[2]], .7, 'iron')]
def _pdc(P):
    P['mk'] = _pdp; P['props'] = _pdp(P); return P
EX['pushdown'] = (-75, _pdc(_pd([.05, .1, 1])), _pdc(_pd([.05, -1, .12])))
EX['oh_ext'] = (-75, stand(ua=pair([.12, 1, .1]), fa=pair([-.1, -.6, -1]), db=V(1, 0, 0)), stand(ua=pair([.12, 1, .05]), fa=pair([0, 1, .1]), db=V(1, 0, 0)))
_fb = bench([0, 24, 0], (8, 2.5, 20))
EX['skull'] = (-90, lying(ua=pair([.12, 1, -.2]), fa=pair([0, -.5, -1]), props=_fb), lying(ua=pair([.12, 1, -.2]), fa=pair([0, 1, -.15]), props=_fb))
_ib = bench([0, 24, 6], (8, 2.5, 8)) + [box([0, 38, -6], (8, 2.5, 14), frame(V(0, 1, .7), V(0, -.7, 1)), 'leather', 1.2), cap([0, 30, -10], [0, 0, -14], 1.6, 'iron')]
def _inc(**k):
    P = {'pel': [0, 30, 4], 'up': V(0, .82, -.57), 'fwd': V(0, .57, .82), 'th': pair([.15, -.1, 1]), 'sh': pair([0, -1, .05]), 'db': V(1, 0, 0), 'props': _ib}
    P.update(k); return P
EX['incline'] = (-70, _inc(ua=pair([1, -.45, 0]), fa=pair([0, 1, .45])), _inc(ua=pair([.35, 1, .5]), fa=pair([.05, 1, .5])))
EX['flat'] = (-70, lying(ua=pair([1, -.35, 0]), fa=pair([0, 1, 0]), props=_fb), lying(ua=pair([.3, 1, 0]), fa=pair([.05, 1, 0]), props=_fb))
def _dip(y, ua, fa):
    P = stand(pel=[0, y, 0], ua=pair(ua), fa=pair(fa), th=pair([.1, -1, .3]), sh=pair([0, -.5, -1]), db=None)
    hand = np.asarray(P['pel']) + [12, 19, 0] + nrm(ua) * L_UA + nrm(fa) * L_FA; h = 33 + 2
    P['props'] = [cap([hand[0] + 2, h, -14], [hand[0] + 2, h, 14], 1.6, 'iron'), cap([-hand[0] - 2, h, -14], [-hand[0] - 2, h, 14], 1.6, 'iron'),
                  cap([hand[0] + 2, h, 12], [hand[0] + 2, 0, 12], 1.6, 'iron'), cap([-hand[0] - 2, h, 12], [-hand[0] - 2, 0, 12], 1.6, 'iron')]
    return P
EX['dips'] = (-60, _dip(44, [.15, -1, 0], [.08, -1, 0]), _dip(33, [.12, -.15, -1], [.1, -1, 0]))
EX['squat'] = (-70, stand(), stand(pel=[0, 23, -5], up=V(0, 1, .55), fwd=V(0, -.55, 1), th=pair([.25, -.12, 1]), sh=pair([0, -1, -.25]),
                                    ua=pair([.12, -1, -.1]), fa=pair([.1, -1, 0])))
_le = [box([0, 21, 2], (8, 2.5, 9), frame(UP, FWD), 'leather', 1.2), box([0, 32, -8], (8, 9, 2.2), frame(UP, FWD), 'leather', 1.2), cap([0, 19, 2], [0, 0, 2], 1.8, 'iron')]
def _lxp(P):
    an = np.asarray(P['pel']) + [5, -1, 0] + nrm(P['th'][0]) * L_TH + nrm(P['sh'][0]) * L_SH
    return _le + [cap(an * [0, 1, 1] + [-9, 0, 1.5], an * [0, 1, 1] + [9, 0, 1.5], 2.2, 'leather')]
def _lx(sn):
    P = seated(sh=pair(sn), ua=pair([.3, -1, .1]), fa=pair([0, -.3, 1]), db=None); P['mk'] = _lxp; P['props'] = _lxp(P); return P
EX['leg_ext'] = (-90, _lx([0, -1, .05]), _lx([0, -.05, 1]))
_pb = bench([0, 22, 2], (8, 2.5, 22))
def _lc(sn):
    P = {'pel': [0, 28, 4], 'up': BACK, 'fwd': DOWN, 'th': pair([.1, 0, 1]), 'sh': pair(sn), 'ft': pair([0, -.4, 1]),
         'ua': pair([.3, -.3, -1]), 'fa': pair([-.2, -.4, -1]), 'props': _pb, 'db': None}
    return P
EX['leg_curl'] = (-90, _lc([0, -.05, 1]), _lc([0, 1, .08]))
_step = [box([0, 2, 6], (12, 2, 6), frame(UP, FWD), 'iron', .6)]
EX['calf'] = (-70, stand(pel=[0, 40, 0], ft=pair([0, 0, 1]), props=_step), stand(pel=[0, 44, 0], ft=pair([0, -.7, 1]), props=_step))

ORDER = ['shrug', 'row_sup', 'row_neu', 'back_raise', 'press', 'front_raise', 'lat_raise', 'rear_fly', 'curl', 'hammer', 'wrist_ext',
         'wrist_curl', 'pushdown', 'oh_ext', 'skull', 'incline', 'flat', 'dips', 'squat', 'leg_ext', 'leg_curl', 'calf']

def to_img(rgb, a):
    im = np.zeros(rgb.shape[:2] + (4,), np.uint8); im[..., :3] = rgb; im[..., 3] = np.where(a, 255, 0); im[~a, :3] = 0
    return Image.fromarray(im, 'RGBA')

def moves():
    S = 96; sheet = Image.new('RGBA', (S * 4, S * len(ORDER)), (0, 0, 0, 0))
    for row, name in enumerate(ORDER):
        yaw, A, B = EX[name]
        poses = [A, lerp_pose(A, B, .5), B]
        # fit: one centre and scale for all frames of the move, so the knight does not jump
        pts = []
        for P in poses:
            pr, _ = knight(P)
            for q in pr:
                for kk in ('a', 'b', 'c'):
                    if kk in q.k: pts.append(q.k[kk])
        pts = np.array(pts); r, u, _ = cam(yaw)
        sx, sy = pts @ r, pts @ u
        span = max(sx.max() - sx.min() + 14, sy.max() - sy.min() + 16); scale = min(1.0, (S - 4) / span)
        c = r * (sx.max() + sx.min()) / 2 + u * (sy.max() + sy.min()) / 2
        frames = []
        for P in poses:
            pr, _ = knight(P)
            rgb, fg, dep, _, _ = render(pr, yaw, S, S, c, scale)
            frames.append(to_img(*outline(rgb, fg, dep)))
        for i, fi in enumerate([0, 1, 2, 1]):
            sheet.paste(frames[fi], (i * S, row * S))
        print('move', name, 'scale %.2f' % scale, file=sys.stderr)
    return sheet

# ---------- muscle map ----------
MUSCLES = ['traps', 'upperback', 'lats', 'erectors', 'frontdelt', 'sidedelt', 'reardelt', 'biceps', 'brachialis', 'brachioradialis',
           'forearmext', 'forearmflex', 'triceps', 'upperchest', 'midchest', 'lowerchest', 'quads', 'hamstrings', 'calves']
MAPPOSE = stand(ua=pair([.42, -1, 0]), fa=pair([.5, -1, .12]), db=None, hand=pair([.5, -1, .3]),
                th=pair([.14, -1, 0]), sh=pair([.06, -1, 0]))

def classify(p, sk):
    """Muscle index (or -1) for a world point on the knight's surface in MAPPOSE."""
    M = sk['M']; R, U, F = M[:, 0], M[:, 1], M[:, 2]; pel = np.asarray(MAPPOSE['pel'], float)
    q = p - pel; x, y, z = q @ R, q @ U, q @ F; ax = abs(x); best = (-1, 9.0)
    def take(i, d):
        nonlocal best
        if d < best[1]: best = (i, d)
    def el(cx, cy, cz, rx, ry, rz): return ((ax - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2
    if ax < 9.5 and y > 4 and y < 24:  # torso
        if z > 1:
            take(13, el(4.4, 18.6, 5.5, 5, 2.0, 4)); take(14, el(4.4, 15.2, 5.5, 5, 2.0, 4)); take(15, el(4.4, 11.8, 5.5, 5, 1.8, 4))
        else:
            take(0, el(0, 21, -3, 9, 4.6, 5)); take(1, el(0, 16.5, -5.5, 6, 3.4, 4)); take(2, el(6.5, 11, -4, 3.6, 6, 5))
            take(3, el(2.2, 6.5, -5.5, 2.2, 5, 4))
    if y > 20 and z > -1 and ax < 9 and ax > 2: take(0, el(5, 22.5, 0, 4, 2.5, 6))  # traps seen over the shoulders
    for s in (1, -1):
        sh, elb, wr, hd = sk['arm', s]
        if np.linalg.norm(p - sh) < 7.2:  # shoulder ball: front / side / rear delt
            v = p - sh; f, l = v @ F, (v @ R) * s
            take(5 if l > 3.4 else 4 if f > 1.5 else 6 if f < -1.5 else 5, .5)
        for seg, (a, b) in (('ua', (sh, elb)), ('fa', (elb, wr))):
            ab = b - a; t = np.clip((p - a) @ ab / (ab @ ab), 0, 1); c = a + ab * t; v = p - c; dist = np.linalg.norm(v)
            if dist > 5 or t <= 0 or t >= 1: continue
            u = nrm(ab); fr = nrm(F - u * (F @ u)); lat = nrm(np.cross(u, fr)); lat = lat if lat @ R * s > 0 else -lat
            ang = math.degrees(math.atan2(v @ lat, v @ fr))  # 0 = front, +90 = outer side
            if seg == 'ua' and t > .2:
                if abs(ang) < 55 and t < .9: take(7, .4)
                elif abs(ang) > 115: take(12, .4)
                elif ang > 15 and t > .45: take(8, .45)
            if seg == 'fa' and t < .95:
                if ang > 20 and ang < 110 and t < .5: take(9, .4)
                elif abs(ang) <= 40 or ang < -40 and ang > -140: take(11, .45)
                elif abs(ang) >= 110: take(10, .45)
    for s in (1, -1):
        hp, kn, an, _ = sk['leg', s]
        for seg, (a, b) in (('th', (hp, kn)), ('sh', (kn, an))):
            ab = b - a; t = np.clip((p - a) @ ab / (ab @ ab), 0, 1); v = p - (a + ab * t)
            if np.linalg.norm(v) > 5.5 or t <= .06 or t >= .94: continue
            fz = v @ F
            if seg == 'th': take(16 if fz > .4 else 17 if fz < -.4 else -1, .5)
            if seg == 'sh' and fz < -.5 and t < .6: take(18, .5)
    return best[0]

def rle(grid):
    """'a'+index for a muscle, '.' for none; runs as <count><char>."""
    s = ''.join('.' if v < 0 else chr(97 + v) for v in grid.flatten()); out = []; i = 0
    while i < len(s):
        j = i
        while j < len(s) and s[j] == s[i]: j += 1
        out.append((str(j - i) if j - i > 1 else '') + s[i]); i = j
    return ''.join(out)

def muscles():
    W, H = 64, 96; sheet = Image.new('RGBA', (W * 2, H * (1 + len(MUSCLES))), (0, 0, 0, 0))
    pr, sk = knight(MAPPOSE, shield=False, cape=False); data = {}
    for col, yaw in ((0, 0), (1, 180)):
        rgb, fg, dep, P, _ = render(pr, yaw, W, H, [0, 44, 0], 1.0)
        rgbo, a = outline(rgb, fg, dep); sheet.paste(to_img(rgbo, a), (col * W, 0))
        ids = np.full((H, W), -1)
        for yy, xx in zip(*np.where(fg)):
            ids[yy, xx] = classify(P[yy, xx], sk)
        lum = rgb.astype(int).sum(axis=2)
        for i in range(len(MUSCLES)):
            m = ids == i; im = np.zeros((H, W, 4), np.uint8)
            if m.any():
                t = np.where(lum < 240, 0, np.where(lum < 480, 1, 2))
                for k in range(3):
                    sel = m & (t == k); im[sel, :3] = TEAL[k]; im[sel, 3] = 255
            sheet.paste(Image.fromarray(im, 'RGBA'), (col * W, (1 + i) * H))
            if not m.any() and ((col == 0 and i in (4, 7, 13, 14, 15, 16, 11)) or (col == 1 and i in (0, 1, 2, 3, 6, 12, 17, 18))):
                print('WARNING: no pixels for', MUSCLES[i], 'in view', col, file=sys.stderr)
        data['front' if col == 0 else 'back'] = rle(ids)
    return sheet, data

def write_js(data):
    js = os.path.join(ROOT, 'js', 'v6-exercise.js'); src = open(js, encoding='utf8').read()
    block = "/*MAP-DATA*/const MAPW=64,MAPH=96,MAPRLE={front:'" + data['front'] + "',back:'" + data['back'] + "'};/*/MAP-DATA*/"
    new, n = re.subn(r'/\*MAP-DATA\*/.*?/\*/MAP-DATA\*/', lambda _: block, src, flags=re.S)
    if n != 1: sys.exit('MAP-DATA markers not found in js/v6-exercise.js')
    open(js, 'w', encoding='utf8').write(new)

def save(im, name):
    path = os.path.join(OUT, name); im.save(path, 'WEBP', lossless=True, quality=100, method=6, exact=True)
    print(name, os.path.getsize(path), 'bytes', file=sys.stderr)

def check_palette(im, extra=()):
    a = np.asarray(im); cols = {tuple(c) for c in a[a[..., 3] > 0][:, :3]}
    allowed = set(PAL.values()) | set(extra); bad = cols - allowed
    assert not bad, 'colours outside the palette: %r' % list(bad)[:5]
    return len(cols)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:]
    if not only or 'moves' in only:
        mv = moves(); print('moves colours', check_palette(mv), file=sys.stderr); save(mv, 'moves.webp')
    if not only or 'muscles' in only:
        ms, data = muscles(); print('map colours', check_palette(ms, TEAL), file=sys.stderr); save(ms, 'muscles.webp'); write_js(data)
