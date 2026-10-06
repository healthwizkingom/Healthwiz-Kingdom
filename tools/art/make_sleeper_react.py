#!/usr/bin/env python3
"""HealthWiz Kingdom: the sleeper's surprised face for the Counting Sheep dream (js/v6-sheep.js).

When Medius leaps the fence, the sleeper reacts without waking: brows up, eyes squeezed shut, a small "o" mouth.
This makes that face as a patch of assets/img/bedroom.webp, built only from the picture's own pixels so the shading
matches the art:
  * brows up: the lid and brow above each closed eye are re-sampled along the face's "up" direction (the head lies
    tilted on the pillow), so the brow moves up two pixels and the lid stretches with its own colours;
  * eyes squeezed: the lash line gets one pixel heavier and a soft crease appears under each eye, in the face's
    existing shadow tone;
  * "o" mouth: a small round mouth in the lip colours, over the resting smile.

Writes assets/img/sleeper-react.webp (lossless), drawn at (X0, Y0) over the head. Run after make_bedroom.py:
    python3 tools/art/make_sleeper_react.py
"""
import math, os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(ROOT, 'assets', 'img', 'bedroom.webp')
OUT = os.path.join(ROOT, 'assets', 'img', 'sleeper-react.webp')
X0, Y0, X1, Y1 = 42, 84, 86, 130          # the patch (js/v6-sheep.js draws it at X0, Y0)

im = Image.open(SRC).convert('RGB')
src = im.copy()
px, sp = im.load(), src.load()

# the face's "up": perpendicular to the line through both closed eyes (lower eye → upper eye)
ex, ey = 73 - 56, 104 - 117
n = math.hypot(ex, ey)
UP = (ey / n, -ex / n)                    # ≈ (-0.6, -0.8)
if UP[1] > 0:
    UP = (-UP[0], -UP[1])

def raise_brow(lash, lid, lift=2.0, fall=6.0):
    """Re-sample the band above a lash line: points at distance d above the lash move to d + s(d), with s rising
    0 → lift across the lid and easing back to 0 above the brow, so nothing outside the band moves."""
    (ax, ay), (bx, by) = lash
    lx, ly = bx - ax, by - ay
    ln = math.hypot(lx, ly)
    tx, ty = lx / ln, ly / ln

    def s(d):
        if d <= 0:
            return 0.0
        if d <= lid:
            return lift * d / lid
        if d <= lid + 2:
            return lift
        return max(0.0, lift * (1 - (d - lid - 2) / fall))

    for y in range(Y0, Y1):
        for x in range(X0, X1):
            rx, ry = x + .5 - ax, y + .5 - ay
            along = rx * tx + ry * ty
            if along < -2 or along > ln + 2:
                continue
            d2 = rx * UP[0] + ry * UP[1]      # distance above the lash line, in the face's up direction
            if d2 <= 0 or d2 > lid + 2 + fall:
                continue
            d = d2                             # solve d + s(d) = d2 for the source point
            for _ in range(12):
                d = d2 - s(d)
            sx, sy = x - (d2 - d) * UP[0], y - (d2 - d) * UP[1]
            px[x, y] = sp[int(math.floor(sx)), int(math.floor(sy))]

UPPER = ((67.5, 107.5), (78.5, 100.0))
LOWER = ((52.5, 119.0), (60.5, 114.5))
raise_brow(UPPER, lid=5.5)
raise_brow(LOWER, lid=4.5)

LASH, CREASE = (46, 25, 38), (203, 157, 126)  # the lash ink and the face's own shadow tone (#2e1926, #cb9d7e)

def stroke(a, b, c, off=(0, 0)):
    (ax, ay), (bx, by) = a, b
    k = int(max(abs(bx - ax), abs(by - ay)))
    for i in range(k + 1):
        x = round(ax + (bx - ax) * i / k + off[0])
        y = round(ay + (by - ay) * i / k + off[1])
        if X0 <= x < X1 and Y0 <= y < Y1:
            px[x, y] = c

# squeezed: a heavier lash (one more pixel on the cheek side) and a crease under each eye
stroke((68, 108), (77, 102), LASH)
stroke((54, 119), (59, 116), LASH)
stroke((69, 110), (76, 105), CREASE)
stroke((54, 121), (58, 119), CREASE)
for c in ((79, 99), (80, 101), (51, 118)):     # little lines at the outer corners
    px[c] = CREASE

# a small round "o" mouth over the resting smile, in the lip colours
SKIN = (228, 177, 139)                         # #e4b18b, the flat skin round the mouth
for x in range(68, 77):
    for y in range(121, 128):
        if sp[x, y] in ((174, 115, 88), (180, 132, 105), (197, 137, 104), (161, 98, 80), (141, 90, 80)):
            px[x, y] = SKIN
RING, INNER = (118, 67, 67), (74, 36, 47)      # #764343, #4a242f
for x, y in ((72, 123), (73, 123), (71, 124), (74, 124), (71, 125), (74, 125), (72, 126), (73, 126)):
    px[x, y] = RING
for x, y in ((72, 124), (73, 124), (72, 125), (73, 125)):
    px[x, y] = INNER

im.crop((X0, Y0, X1, Y1)).save(OUT, 'WEBP', lossless=True, quality=100, method=6)
print('wrote', os.path.relpath(OUT, ROOT), X1 - X0, 'x', Y1 - Y0, os.path.getsize(OUT), 'bytes')
