"""The Science Laboratory's background and Luna's full figure, from the owner's two reference images, as pixel art.

    python3 tools/art/make_luna_lab.py CONCEPT.png CHARACTER_SHEET.png
      → assets/img/lab-scene.webp   290 x 210, the "SCIENCE LABORATORY" panel of the owner's HealthWiz Kingdom concept
                                    sheet (1536 x 1024), cut between the panel's menu chips and the witch at the desk,
                                    snapped to 80 colours without dithering
      → assets/img/luna-full.webp   69 x 150, pose 1 "Front view (idle)" of the character reference sheet (1536 x 1024):
                                    the light background is flood-filled away from the edges (transparent), the figure
                                    reduced with a box filter and snapped to 32 colours; alpha is hard (0 or 255)
Both are drawn at whole-number scales with image-rendering: pixelated (docs/PIXEL_STYLE.md). Budget: the owner raised the
image total to 740 KB for these (tests/24-performance.test.mjs).
"""
import os
import sys
from collections import deque
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img')
LAB_BOX = (540, 250, 830, 460)          # in the concept sheet
LUNA_BOX = (10, 135, 180, 490)          # pose 1 in the character sheet
SHEET_BG = (234, 235, 251)

def save(img, name):
    dst = os.path.join(OUT, name)
    img.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), img.size, os.path.getsize(dst), 'bytes')

def lab(src):
    im = Image.open(src).convert('RGB')
    if im.size != (1536, 1024):
        sys.exit('expected the 1536 x 1024 concept sheet')
    c = im.crop(LAB_BOX).quantize(colors=80, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    save(c, 'lab-scene.webp')

def luna(src):
    im = Image.open(src).convert('RGBA')
    if im.size != (1536, 1024):
        sys.exit('expected the 1536 x 1024 character sheet')
    im = im.crop(LUNA_BOX)
    w, h = im.size
    px = im.load()
    near = lambda p: sum(abs(a - b) for a, b in zip(p[:3], SHEET_BG)) < 40
    seen, q = set(), deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:                                   # only background connected to the edge goes, so light parts of her stay
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if not near(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    im = im.crop(im.getbbox())
    H = 150
    s = im.resize((round(im.size[0] * H / im.size[1]), H), Image.BOX)
    a = s.split()[3].point(lambda v: 255 if v > 140 else 0)
    out = s.convert('RGB').quantize(colors=32, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    out.putalpha(a)
    save(out, 'luna-full.webp')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    lab(sys.argv[1])
    luna(sys.argv[2])
