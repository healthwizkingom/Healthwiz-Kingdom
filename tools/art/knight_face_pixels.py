"""The knight's face as hand-placed pixel art: the approved front preview, and the stamps the sprite sheets use.

Every pixel is placed at the sheet's native resolution (make_exercise_blender.py, RES = 4): the jaw is one explicit span
per row, the eyes, brows, nose and mouth are literal pixel maps, and each bang is a tapered lock rasterised row by row.
Nothing is drawn large and reduced. Palette colours only (make_exercise.PAL); light from the top left.

Style: a mature, sharp, serious anime-fantasy hero (large banded crimson eyes with a winged lash, determined brows,
small nose and mouth, a defined jaw to a narrow chin), an original HealthWiz character, with crimson hair (approved).

The sheets (make_exercise_blender.py) stamp the same eye, brow, nose and mouth maps on every frame: STAMPS holds them
per view (front, three-quarter, profile), drawn for a face turned to the picture's right and mirrored for the left;
LANDMARKS_PX holds where the approved preview puts each feature in the front map frame, from which the packer works
out the feature positions on the 3D head.

Run (preview):  python3 tools/art/knight_face_pixels.py HEAD_CROP.png OUT_DIR
      HEAD_CROP.png: the front map pose's head, cropped at (101, 76, 155, 147) from the shaded 256 x 384 frame, on the
      preview background (30, 34, 58). Writes before / auburn / crimson at 1x and 4x (nearest neighbour)."""
import sys
import numpy as np
from PIL import Image

import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_exercise as ME  # noqa: E402

W, H = 46, 55            # the grid: crop x 4..49, y 6..60 of the head crop
GX, GY = 4, 6
OFF = 11                 # face rows start this far down the grid

HAIR = {'auburn': {'1': 'hr0', '2': 'hr1', '3': 'hr2', '4': 'hr3', '5': 'hr3'},
        'crimson': {'1': 'hr0', '2': 'cp0', '3': 'cp1', '4': 'cp2', '5': 'cp3'}}
FIXED = {'h': 'hr1', 'O': 'cp3', '1': 'hr0', 'K': 'ink', 'a': 'sk0', 'b': 'sk1', 'c': 'sk2', 'd': 'sk3', 'E': 'cp0', 'R': 'cp1', 'r': 'cp2', 'G': 'gd2',
         'W': 'wht', 'T': 'st4', 'S': 'st3'}

# ---- the face: one span per row (outline included), a sharp jaw to a narrow chin ----
SPAN0 = {r: (8, 37) for r in range(0, 17)}
SPAN0.update({17: (7, 38), 18: (7, 38), 19: (7, 38), 20: (7, 38), 21: (7, 38), 22: (7, 38), 23: (8, 37), 24: (8, 37),
             25: (8, 37), 26: (9, 36), 27: (9, 36), 28: (10, 35), 29: (10, 35), 30: (11, 34), 31: (12, 33),
             32: (13, 32), 33: (14, 31), 34: (15, 30), 35: (16, 29), 36: (17, 28), 37: (18, 27), 38: (19, 26),
             39: (20, 25), 40: (21, 24)})
SPAN = {r + OFF: v for r, v in SPAN0.items()}

# ---- features, as pixel maps (row offset, col offset, rows) ----
# The eye: the owner's chosen design (the earlier painted eye), re-drawn as pixels a little smaller: a heavy arched
# upper lash with a winged outer corner and a dark-red inner end; a tall iris in bands, deep red at the top to bright
# at the bottom with an amber glow; an upright pupil; a big catch-light upper left and a small one lower right; the
# lid's shadow on the white; a soft lower lash under the outer half. Outer corner on the left (the picture's left eye).
EYE = ["...KKKKKK...",
       "..KKKKKKKKK.",
       "KKSERRRRESK1",
       "KSSWWKKRRSS1",
       ".hTWRKKRRT..",
       ".hTrrKKTrT..",
       "..hOOOOOO...",
       "...hOGGO....",
       "....hh......"]
IRIS = (slice(2, 7), slice(3, 9))      # rows, columns of the iris block: copied unmirrored to the right eye
BROW = ["1112......",         # determined: the outer tail high, the inner end low and heavy
        "..21111...",
        ".....21111",
        ".......111"]


def mirrored(rows):
    return [row[::-1] for row in rows]


def eye_right():
    """The eye with its outer corner on the right: the outline mirrored, the iris as drawn (catch-lights on the lit
    side)."""
    right = mirrored(EYE)
    rows, cols = IRIS
    for r in range(rows.start, rows.stop):
        right[r] = right[r][:cols.start] + EYE[r][cols] + right[r][cols.stop:]
    return right


def drop_cols(rows, cols):
    return [''.join(ch for i, ch in enumerate(row) if i not in cols) for row in rows]


# the nose and mouth of the front view, as they sit in the preview: eye-socket shading at the inner corners, the
# bridge on the shaded side, the tip and its shadow; the mouth line and the shadow under the lower lip
NOSE = ["c....c",
        "c....c",
        "......",
        "......",
        "....c.",
        "....c.",
        "....c.",
        "....c.",
        "....c.",
        "....c.",
        "...cc.",
        ".cbb.."]
MOUTH = [".bbaabb",
         "...cc..",
         "..cc..."]
# three-quarter and profile parts, for a face turned to the picture's right (nose pointing right)
EYE_FAR = drop_cols(EYE, {1, 2, 8})                        # the far eye, foreshortened: its outer white and one iris column
BROW_FAR = drop_cols(BROW, {1, 2})
EYE_SIDE = ["KKK.....",                                    # profile: the lash sweeps back to the wing, the iris shows
            ".KKKKKK.",                                    # as a tall half-oval at the front
            "..SERRK.",
            "..TWKRK.",
            "..TrKr..",
            "...OGO..",
            "...hh..."]
BROW_SIDE = ["112...",
             ".21111"]
NOSE_34 = [".c",
           ".c",
           ".c",
           "cc",
           "bb"]
MOUTH_34 = [".bbaa",
            "..cc."]
MOUTH_SIDE = ["ba"]

# (map, anchor col, anchor row): the anchor is the pixel placed on the landmark
STAMPS = {
    'front': {'eye_l': (EYE, 5, 4), 'eye_r': (eye_right(), 6, 4), 'brow_l': (BROW, 5, 2),
              'brow_r': (mirrored(BROW), 4, 2), 'nose': (NOSE, 3, 11), 'mouth': (MOUTH, 3, 0)},
    'three_quarter': {'eye_near': (EYE, 5, 4), 'eye_far': (EYE_FAR, 4, 4), 'brow_near': (BROW, 5, 2),
                      'brow_far': (BROW_FAR, 3, 2), 'nose': (NOSE_34, 1, 4), 'mouth': (MOUTH_34, 3, 0)},
    'profile': {'eye_near': (EYE_SIDE, 4, 3), 'brow_near': (BROW_SIDE, 3, 1), 'mouth': (MOUTH_SIDE, 1, 0)},
}
# where the preview puts each anchor, in the shaded front map frame (256 x 384): grid (col, row) -> frame (105 + col,
# 82 + row); the face rows start OFF rows down the grid
LANDMARKS_PX = {'eye_l': (118, 111), 'eye_r': (137, 111), 'brow_l': (119, 105), 'brow_r': (136, 105),
                'nose': (128, 120), 'mouth': (127, 124)}
# depth of each landmark out of the face (the face frame's z, scene units at rest; the frame sits on the corneas)
LANDMARKS_Z = {'eye_l': -.25, 'eye_r': -.25, 'brow_l': -.2, 'brow_r': -.2, 'nose': .55, 'mouth': -.05}
CRIMSON = dict(FIXED, **HAIR['crimson'])


def put(g, r0, c0, rows, mirror=False):
    r0 += OFF
    for dr, row in enumerate(rows):
        row = row[::-1] if mirror else row
        for dc, ch in enumerate(row):
            if ch != '.':
                g[r0 + dr][c0 + dc] = ch


def face_grid():
    g = [['.'] * W for _ in range(H)]
    for r, (l, rr) in SPAN.items():
        for c in range(l, rr + 1):
            g[r][c] = 'd'
        # the shaded (right) side: a 3-pixel band, wider on the jaw; the jaw and chin outlined
        for c in range(rr - 2, rr + 1):
            g[r][c] = 'c'
        if r >= 24:
            g[r][l] = g[r][rr] = 'K'
    for c in range(21, 25):
        g[40 + OFF][c] = 'K'
    for c in range(20, 26):
        g[39 + OFF][c] = 'c' if g[39 + OFF][c] != 'K' else 'K'
    # cheek planes: a short cluster under each cheekbone
    for r, c in ((25, 10), (26, 10), (26, 11), (24, 33), (24, 34), (25, 32), (25, 33)):
        g[r + OFF][c] = 'c'
    put(g, 16, 20, NOSE)              # eye-socket corners, the nose bridge and tip
    put(g, 31, 19, MOUTH)
    # the eyes and brows
    put(g, 10, 9, BROW)
    put(g, 10, 27, BROW, mirror=True)
    return put_eyes(g)


def put_eyes(g):
    """Both eyes (the right one from eye_right()). Also called after the hair: anime convention, the eyes show
    through the bangs."""
    put(g, 14, 8, EYE)
    put(g, 14, 26, eye_right())
    return g


# ---- bangs: tapered locks, rasterised row by row: (left, right) at the top row, the tip (col, row) ----
TOP = 4                                  # the locks fall from here (crop y 10), out of the crown
SHEEN = 8
CHIN = 40 + OFF


def SKULL_HW(r):
    """Half-width of the head's hair outline at grid row r: rounded at the top, full width from row 16."""
    return 23.0 if r >= 16 else 23.0 * max(0.0, 1 - ((16 - r) / 15.0) ** 2) ** .5
LOCKS = [((1, 11), (6, 42), 'side', .75),       # side locks frame the face down to the ear, tips curling in
         ((34, 44), (39, 42), 'side', .75),
         ((4, 15), (9, 26), 'lock', .8),
         ((11, 22), (15, 21), 'lock', .8),
         ((17, 29), (23, 31), 'lock', .8),      # the long lock between the eyes
         ((25, 34), (30, 20), 'lock', .8),
         ((30, 41), (36, 27), 'lock', .8),
         ((14, 18), (12, 25), 'strand', .9),    # thin strands laid over the locks, for layering
         ((31, 35), (33, 24), 'strand', .9)]


def lock_spans(top, tip, k=.85):
    (l0, r0), (tc, tr) = top, tip
    out = {}
    for r in range(TOP, tr + 1):
        t = (r - TOP) / (tr - TOP)
        w = (1 - t) ** k
        mid = (l0 + r0) / 2 + ((tc) - (l0 + r0) / 2) * t ** 1.3
        half = (r0 - l0) / 2 * w
        out[r] = (int(round(mid - half)), int(round(mid + half)))
    return out


def draw_hair(g):
    hair = [[False] * W for _ in range(H)]
    for top, tip, kind, k in LOCKS:
        sp = lock_spans(top, tip, k)
        for r in list(sp):                                    # a rounded skull: no square top corners
            hw = SKULL_HW(r)
            l, rr = sp[r]
            sp[r] = (max(l, int(round(22.5 - hw))), min(rr, int(round(22.5 + hw))))
            if sp[r][0] > sp[r][1]:
                del sp[r]
        for r, (l, rr) in sp.items():
            for c in range(max(l, 0), min(rr, W - 1) + 1):
                g[r][c] = '3'
                hair[r][c] = True
            if 0 <= l < W:
                g[r][l] = '4'                                 # lit edge (light from the top left)
            if 0 <= rr < W and rr != l:
                g[r][rr] = '1' if kind == 'lock' else '2'    # dark edge on the shaded side
        # the sheen: a short band across each lock (together they read as one ring of light on the head)
        for r, n in ((SHEEN, 3), (SHEEN + 1, 2)):
            if r in sp:
                l, rr = sp[r]
                for c in range(l + 1, min(rr, l + 1 + n)):
                    g[r][c] = '5' if r == SHEEN else '4'
    # shadow cast on the skin right under the hair
    for r in range(1, H):
        for c in range(W):
            if g[r][c] in 'd' and hair[r - 1][c]:
                g[r][c] = 'c'
    return g


def apply(base, grid, ramp):
    a = np.asarray(base).copy()
    lut = dict(FIXED, **HAIR[ramp])
    for r in range(H):
        for c in range(W):
            ch = grid[r][c]
            if ch != '.':
                a[GY + r, GX + c, :3] = ME.PAL[lut[ch]]
                a[GY + r, GX + c, 3] = 255
    return a


def recolour_crown(a, ramp):
    if ramp != 'crimson':
        return a
    m = {ME.PAL['hr1']: ME.PAL['cp0'], ME.PAL['hr2']: ME.PAL['cp1'], ME.PAL['hr3']: ME.PAL['cp2']}
    out = a.copy()
    for src, dst in m.items():
        sel = np.all(a[..., :3] == src, -1) & (a[..., 3] > 0)
        out[sel, :3] = dst
    return out


def main():
    src, out = sys.argv[1], sys.argv[2]
    base = Image.open(src).convert('RGBA')
    a0 = np.asarray(base).copy()
    a0.setflags(write=False)
    # inside the grid, the render's old hair and face become hair behind the face (redrawn below)
    hairish = {ME.PAL[k] for k in ('hr0', 'hr1', 'hr2', 'hr3', 'sk0', 'sk1', 'sk2', 'sk3', 'cp0', 'cp1', 'cp2', 'cp3',
                                   'wht', 'st4', 'st3', 'gd2')}
    g = put_eyes(draw_hair(face_grid()))
    outs = []
    for ramp in ('auburn', 'crimson'):
        a = recolour_crown(a0, ramp).copy()
        for r in range(H):
            for c in range(W):
                y, x = GY + r, GX + c
                if TOP <= r <= CHIN and tuple(a0[y, x, :3]) in hairish:
                    # under the new jaw: the neck in shadow at the centre, hair behind elsewhere
                    neck = r > 24 + OFF and 15 <= c <= 30
                    a[y, x, :3] = ME.PAL['sk1'] if neck else ME.PAL[HAIR[ramp]['2']]
        # the crown above the locks, in the same banded style: lit on the left, base, shaded on the right
        for y in range(0, GY + TOP):
            for x in range(a.shape[1]):
                if a0[y, x, 3] and tuple(a0[y, x, :3]) in hairish:
                    c = x - GX
                    tone = '4' if c < 15 else '3' if c < 31 else '2'
                    a[y, x, :3] = ME.PAL[HAIR[ramp][tone]]
        a = apply(a, g, ramp)
        outs.append(a)
    before = a0
    row = [before] + outs
    gap = 6
    w = sum(x.shape[1] for x in row) + gap * (len(row) - 1)
    sheet = Image.new('RGBA', (w, row[0].shape[0]), (20, 22, 36, 255))
    x = 0
    for im in row:
        sheet.alpha_composite(Image.fromarray(im, 'RGBA'), (x, 0))
        x += im.shape[1] + gap
    sheet.save(os.path.join(out, 'preview_1x.png'))
    sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST).save(os.path.join(out, 'preview_4x.png'))
    for name, im in zip(('auburn', 'crimson'), outs):
        Image.fromarray(im, 'RGBA').save(os.path.join(out, 'new_%s_1x.png' % name))
    pal = set(ME.PAL.values()) | {(30, 34, 58)}
    for im in outs:
        cols = {tuple(c) for c in im[im[..., 3] > 0][:, :3]}
        assert cols <= pal, cols - pal
    print('ok', sheet.size)


if __name__ == '__main__':
    main()
