#!/usr/bin/env python3
"""HealthWiz Kingdom: Medius's reaction frames for the Wizard's Counsel (js/v6-counsel.js).

Reads assets/img/study.jpg and writes assets/img/medius-reactions.webp (lossless), a sheet of small patches drawn in
the study's own style and colours: eyes (closed, happy, soft, looking up, wide), brows (raised inside ends, lifted),
mouth (smile, frown, open) and his hands (the left alone in his lap, the right raised to his beard in two stroke
positions, or held out with the palm open). Each patch holds only the pixels that change; everything else stays the
study image. It also prints the patch layout that js/v6-counsel.js keeps in SHEET.

The nod and the breathing need no stored pixels: js/v6-counsel.js redraws the study itself shifted by a few pixels
inside the head outline HEAD below (the same polygon is in the script).

Needs Python 3 with Pillow and NumPy:   python3 tools/art/make_medius_reactions.py
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(ROOT, 'assets', 'img', 'study.jpg')
OUT = os.path.join(ROOT, 'assets', 'img', 'medius-reactions.webp')
A = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)
RNG = np.random.default_rng(7)

# Head outline (hat, face, hair, beard) in study.jpg pixels: shifted by the nod and the breathing.
HEAD = [(402, 150), (402, 128), (406, 120), (410, 112), (410, 104), (414, 97), (418, 92), (424, 86), (432, 80), (440, 76),
        (448, 73), (458, 73), (462, 77), (466, 80), (470, 85), (474, 90), (478, 96), (482, 101), (488, 109), (494, 116),
        (500, 122), (506, 126), (512, 130), (518, 133), (524, 136), (530, 139), (536, 143), (539, 146), (530, 149),
        (520, 149), (518, 160), (518, 190), (516, 200), (512, 212), (508, 230), (500, 248), (490, 262), (480, 266),
        (468, 262), (458, 250), (448, 236), (440, 222), (432, 214), (424, 206), (414, 196), (408, 180), (404, 164)]

H = lambda s: np.array([int(s[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.int16)
LID, LID2, LIDL, LASH, DARK = H('a0614f'), H('8b4b42'), H('bc8173'), H('2a0a05'), H('1b0605')
SCL, HL, IRIS, FORE = H('c6c7c1'), H('f9ebeb'), H('12121a'), H('c88a5c')
BROW, BROWL, BROWD = H('9a8a80'), H('baa9a1'), H('6d5f56')
LIP, LIPD, MOUTH, TONG = H('8a5148'), H('3f1d11'), H('200500'), H('8d5755')

def paint(img, x0, y0, rows, pal):
    for j, r in enumerate(rows):
        for i, c in enumerate(r):
            if c in pal: img[y0 + j, x0 + i] = pal[c]

EYEP = {'s': LID, 'S': LID2, 'l': LIDL, 'd': LASH, 'k': DARK, 'w': SCL, 'h': HL, 'i': IRIS, 'f': FORE}
EYES = {  # 16 x 8 at (458,150) for the left eye, mirrored at (485,150) for the right
    'closed': ['..ssssssssssss..', '.ssllllllllllss.', '.sssssssssssss..', '.ssssssssssssss.', '..ddsssssssddd..', '....ddddddd.....', '.....SSSSSS.....', '................'],
    'happy': ['..ssssssssssss..', '.ssssssssssssss.', '.sssssddddssss..', '.sssddsssssddss.', '..sdssssssssds..', '..sssssssssssS..', '.....SSSSSS.....', '................'],
    'soft': ['..ssssssssssss..', '.sslllllllllss..', '.ssssssssssssss.', '.sdddddddddddds.', '..kiiiiiiihiik..', '...kiiiiiiiik...', '................', '................'],
    'up': ['..ssssssssssss..', '.skkiihiikkkks..', '.kiiiiiiiwwwwk..', '.kwiiiwwwwwwwk..', '..kwwwwwwwwwk...', '...kkkkkkkkk....', '................', '................'],
    'wide': ['..ddddddddddd...', '.dkiiiiiiihhid..', '.kiiiiiiiihhik..', '.kiiiiiiiiiiik..', '.kwiiiiiiiiiwk..', '..kkkkkkkkkkk...', '................', '................'],
}
BROWP = {'b': BROW, 'l': BROWL, 'd': BROWD}
BROWS = {  # 20 x 8 at (455,139) left, mirrored at (483,139)
    'up': ['..............bb....', '.............bbl....', '............bbld....', '...........bbbd.....'] + ['.' * 20] * 4,
    'lift': ['.' * 20, '....bbbbbbbbbbbb....', '...blllllllllllbb...'] + ['.' * 20] * 5,
}
MOUTHP = {'l': LIP, 'L': LIPD, 'o': MOUTH, 't': TONG}
MOUTHS = {  # 32 x 8 at (464,177)
    'smile': ['.' * 32, '.' * 32, '...LL......................LL...', '....LL....................LL....', '.....LLLLLLLLLLLLLLLLLLLLLL.....', '......llllllllllllllllllll......', '.......LLLLLLLLLLLLLLLLLL.......', '.' * 32],
    'frown': ['.' * 32, '.' * 32, '.' * 32, '......LLLLLLLLLLLLLLLLLLLL......', '.....LLllllllllllllllllllLL.....', '....LL.llllllllllllllllll.LL....', '...LL......................LL...', '.' * 32],
    'open': ['.' * 32, '.' * 32, '.......LLLLLLLLLLLLLLLLLL.......', '......Loooooooooooooooooool.....', '......Loooooooooooooooooool.....', '.......Lootttttttttttttol.......', '........LLlllllllllllLL.........', '.' * 32],
}

ROBE = [(14, 18, 30), (24, 28, 42), (36, 40, 56), (52, 56, 72), (70, 76, 94)]
TRIM = [(46, 44, 50), (78, 74, 76), (106, 96, 84), (150, 126, 82), (178, 156, 110)]
SKIN = [(58, 22, 14), (112, 58, 38), (160, 92, 60), (200, 128, 82), (224, 156, 104), (240, 186, 134)]

def layer(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))
def texture(L, poly, base, dark, light, n):
    d = ImageDraw.Draw(L); d.polygon(poly, fill=base)
    m = Image.new('L', L.size, 0); ImageDraw.Draw(m).polygon(poly, fill=255); M = np.asarray(m) > 0
    xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
    for _ in range(n):
        x = int(RNG.integers(min(xs), max(xs))); y = int(RNG.integers(min(ys), max(ys)))
        if 0 <= y < M.shape[0] and 0 <= x < M.shape[1] and M[y, x]: d.rectangle([x, y, x + 1, y + 1], fill=dark if RNG.random() < .5 else light)
def outline(L, robe=True):
    a = np.asarray(L); al = a[..., 3] > 0
    edge = al & ~(np.roll(al, 1, 0) & np.roll(al, -1, 0) & np.roll(al, 1, 1) & np.roll(al, -1, 1))
    b = a.copy(); skin = a[..., 0] > 120
    b[edge & skin] = (*SKIN[0], 255)
    if robe: b[edge & ~skin] = (*ROBE[0], 255)
    return Image.fromarray(b)
def snap(L, step=2):
    """The study's details are 2-4 px: average 2 x 2 cells and make alpha hard, so new art sits on the same grain."""
    a = np.asarray(L).astype(float); h, w = a.shape[:2]; h2, w2 = h // step * step, w // step * step; a = a[:h2, :w2]
    b = a.reshape(h2 // step, step, w2 // step, step, 4); al = b[..., 3].mean((1, 3))
    rgb = (b[..., :3] * b[..., 3:4]).sum((1, 3)) / np.maximum(b[..., 3].sum((1, 3))[..., None], 1)
    out = np.zeros((h2 // step, w2 // step, 4)); out[..., :3] = rgb; out[..., 3] = np.where(al >= 128, 255, 0)
    return np.repeat(np.repeat(out, step, 0), step, 1).astype(np.uint8)

def hand_beard(stroke):  # layer origin (472,200), 88 x 100
    L = layer(88, 100); d = ImageDraw.Draw(L); dy = 4 * stroke
    texture(L, [(66, 98), (86, 98), (84, 74), (74, 52), (60, 40 + dy), (44, 36 + dy), (38, 48 + dy), (48, 64), (58, 84)], ROBE[1], ROBE[0], ROBE[2], 120)
    d.line([(68, 96), (64, 80), (54, 60), (48, 50 + dy)], fill=ROBE[3], width=2)
    d.line([(84, 96), (82, 76), (74, 56), (64, 44 + dy)], fill=ROBE[4], width=2)
    d.line([(60, 98), (54, 82), (44, 64), (38, 50 + dy)], fill=ROBE[0], width=2)
    d.polygon([(38, 44 + dy), (62, 36 + dy), (66, 44 + dy), (42, 54 + dy)], fill=TRIM[1])
    d.line([(39, 48 + dy), (64, 40 + dy)], fill=TRIM[2], width=2)
    for k in range(5): d.rectangle([41 + k * 5, 50 + dy - k * 2, 42 + k * 5, 51 + dy - k * 2], fill=TRIM[3])
    d.line([(38, 44 + dy), (62, 36 + dy)], fill=TRIM[4], width=1)
    d.polygon([(28, 34 + dy), (42, 28 + dy), (50, 34 + dy), (48, 44 + dy), (36, 50 + dy), (26, 44 + dy)], fill=SKIN[3])
    d.polygon([(30, 34 + dy), (42, 30 + dy), (46, 34 + dy), (34, 40 + dy)], fill=SKIN[4])
    for k in range(4):
        y = 30 + dy + k * 5; d.rounded_rectangle([16, y, 32, y + 4], radius=2, fill=SKIN[3]); d.line([(17, y), (30, y)], fill=SKIN[4]); d.line([(16, y + 4), (32, y + 4)], fill=SKIN[1])
    d.polygon([(34, 26 + dy), (44, 20 + dy), (48, 24 + dy), (38, 32 + dy)], fill=SKIN[4]); d.line([(34, 26 + dy), (44, 20 + dy)], fill=SKIN[5])
    return outline(L)
def lap_left():  # layer origin (440,280), 120 x 48: his left hand alone, the right one is up
    L = layer(120, 48); d = ImageDraw.Draw(L)
    texture(L, [(44, 4), (116, 0), (118, 44), (48, 46)], ROBE[1], ROBE[0], ROBE[2], 160)
    d.line([(70, 10), (84, 40)], fill=ROBE[3], width=2); d.line([(96, 6), (104, 42)], fill=ROBE[2], width=2)
    d.polygon([(14, 14), (40, 10), (58, 12), (66, 18), (66, 30), (56, 36), (30, 36), (14, 30)], fill=SKIN[3])
    d.polygon([(18, 15), (40, 12), (56, 14), (40, 20), (20, 22)], fill=SKIN[4])
    d.polygon([(16, 28), (40, 30), (60, 32), (54, 36), (30, 36)], fill=SKIN[2])
    for k in range(4):
        y = 16 + k * 5; d.rounded_rectangle([56, y, 76 - k * 2, y + 4], radius=2, fill=SKIN[3]); d.line([(57, y), (74 - k * 2, y)], fill=SKIN[4]); d.line([(56, y + 4), (75 - k * 2, y + 4)], fill=SKIN[1])
    return outline(L, robe=False)
def palm():  # layer origin (512,252), 92 x 52: open palm toward the candle
    L = layer(92, 52); d = ImageDraw.Draw(L)
    texture(L, [(0, 30), (14, 22), (40, 18), (52, 24), (50, 40), (30, 46), (4, 48)], ROBE[1], ROBE[0], ROBE[2], 80)
    d.line([(6, 26), (40, 20)], fill=ROBE[4], width=2)
    d.polygon([(40, 16), (52, 20), (54, 42), (42, 44)], fill=TRIM[1]); d.line([(46, 18), (48, 43)], fill=TRIM[3], width=2)
    for k in range(4): d.rectangle([43, 22 + k * 5, 44, 23 + k * 5], fill=TRIM[4])
    d.polygon([(52, 24), (66, 18), (80, 20), (84, 28), (78, 36), (58, 38)], fill=SKIN[4])
    d.polygon([(56, 26), (70, 22), (78, 24), (66, 30)], fill=SKIN[5])
    for k in range(4):
        y = 20 + k * 4; d.rounded_rectangle([76, y, 90, y + 3], radius=1, fill=SKIN[4]); d.line([(77, y), (89, y)], fill=SKIN[5]); d.line([(76, y + 3), (90, y + 3)], fill=SKIN[2])
    d.polygon([(62, 18), (68, 8), (73, 9), (70, 20)], fill=SKIN[4]); d.line([(68, 9), (73, 9)], fill=SKIN[5])
    return outline(L)

def patch(edit):
    """Run edit(img) on a copy of the study; return (x, y, rgba) holding only the pixels that changed."""
    img = A.copy(); edit(img); ch = (img != A).any(-1)
    ys, xs = np.nonzero(ch); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); sub = ch[y0:y1, x0:x1]
    rgba[..., :3] = img[y0:y1, x0:x1]; rgba[..., 3] = np.where(sub, 255, 0)
    return int(x0), int(y0), rgba
def put(img, arr, x0, y0):
    h, w = arr.shape[:2]; m = arr[..., 3] > 0; img[y0:y0 + h, x0:x0 + w][m] = arr[..., :3][m]

PARTS = {}
for n, e in EYES.items():
    PARTS['eyes:' + n] = patch(lambda im, e=e: (paint(im, 458, 150, e, EYEP), paint(im, 485, 150, [r[::-1] for r in e], EYEP)))
for n, b in BROWS.items():
    PARTS['brows:' + n] = patch(lambda im, b=b: (paint(im, 455, 139, b, BROWP), paint(im, 483, 139, [r[::-1] for r in b], BROWP)))
for n, m in MOUTHS.items():
    PARTS['mouth:' + n] = patch(lambda im, m=m: paint(im, 464, 177, m, MOUTHP))
PARTS['hands:lap'] = patch(lambda im: put(im, snap(lap_left()), 440, 280))
PARTS['hands:beard0'] = patch(lambda im: put(im, snap(hand_beard(0)), 472, 200))
PARTS['hands:beard1'] = patch(lambda im: put(im, snap(hand_beard(1)), 472, 200))
PARTS['hands:palm'] = patch(lambda im: put(im, snap(palm()), 512, 252))

# pack in one row-wrapped sheet
order = list(PARTS); W = 256; x = y = rowh = 0; layout = {}
for n in order:
    _, _, a = PARTS[n]; h, w = a.shape[:2]
    if x + w > W: x = 0; y += rowh + 1; rowh = 0
    layout[n] = (x, y, w, h); x += w + 1; rowh = max(rowh, h)
sheet = np.zeros((y + rowh, W, 4), np.uint8)
for n in order:
    sx, sy, w, h = layout[n]; sheet[sy:sy + h, sx:sx + w] = PARTS[n][2]
Image.fromarray(sheet).save(OUT, 'WEBP', lossless=True, quality=100, method=6)
print('wrote', os.path.relpath(OUT, ROOT), sheet.shape[1], 'x', sheet.shape[0], os.path.getsize(OUT), 'bytes')
print('SHEET=' + json.dumps({n: [layout[n][0], layout[n][1], layout[n][2], layout[n][3], PARTS[n][0], PARTS[n][1]] for n in order}, separators=(',', ':')))
print('HEAD=' + json.dumps(HEAD, separators=(',', ':')))
