#!/usr/bin/env python3
"""HealthWiz Kingdom: Medius's reaction frames for the Wizard's Counsel (js/v6-counsel.js).

Reads assets/img/study.jpg and writes assets/img/medius-reactions.webp (lossless), a sheet of small patches drawn in
the study's own style and colours: eyes (closed, happy, soft, looking up, wide), brows (raised inside ends, lifted),
mouth (smile, frown, open). His hands are never redrawn: they stay as painted. Each patch holds only the pixels that change; everything else stays the
study image. It also prints the patch layout that js/v6-counsel.js keeps in SHEET.

The nod and the breathing need no stored pixels: js/v6-counsel.js redraws the study itself shifted by a few pixels
inside the head outline HEAD below (the same polygon is in the script).

Needs Python 3 with Pillow and NumPy:   python3 tools/art/make_medius_reactions.py
"""
import json, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(ROOT, 'assets', 'img', 'study.jpg')
OUT = os.path.join(ROOT, 'assets', 'img', 'medius-reactions.webp')
A = np.asarray(Image.open(SRC).convert('RGB')).astype(np.int16)

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

def patch(edit):
    """Run edit(img) on a copy of the study; return (x, y, rgba) holding only the pixels that changed."""
    img = A.copy(); edit(img); ch = (img != A).any(-1)
    ys, xs = np.nonzero(ch); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); sub = ch[y0:y1, x0:x1]
    rgba[..., :3] = img[y0:y1, x0:x1]; rgba[..., 3] = np.where(sub, 255, 0)
    return int(x0), int(y0), rgba
PARTS = {}
for n, e in EYES.items():
    PARTS['eyes:' + n] = patch(lambda im, e=e: (paint(im, 458, 150, e, EYEP), paint(im, 485, 150, [r[::-1] for r in e], EYEP)))
for n, b in BROWS.items():
    PARTS['brows:' + n] = patch(lambda im, b=b: (paint(im, 455, 139, b, BROWP), paint(im, 483, 139, [r[::-1] for r in b], BROWP)))
for n, m in MOUTHS.items():
    PARTS['mouth:' + n] = patch(lambda im, m=m: paint(im, 464, 177, m, MOUTHP))

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
