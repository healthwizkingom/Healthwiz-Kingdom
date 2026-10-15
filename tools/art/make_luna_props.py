"""Luna's things, cut from the props sheet of the owner's character design sheets and turned into pixel art.

    python3 tools/art/make_luna_props.py PROPS [OUT_DIR]   # writes OUT_DIR/luna-props.webp

Input: the 1024 x 572 props sheet (the wooden staff, the leather satchel, the spirit cat sitting and curled up, a
close-up of the satchel's potion flasks, and the colour palette; the palette swatches are information, not art, and are
not cut). Each prop is cut with the box in PROPS using the same background removal as make_luna_poses.py (the flask
close-up is a picture with its own background, so it is only cropped), reduced with a box filter to fit a 48 x 48 tile
(centred) and snapped to one shared palette without dithering, so it is crisp pixel art at whole-number scales
(docs/PIXEL_STYLE.md, rule 5). Output: one lossless WebP strip of five 48 x 48 tiles in js/v6-luna.js's order:
staff, satchel, cat, curled, flasks. Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from make_luna_poses import cut

# name: (left, top, right, bottom) on the sheet, above each caption
PROPS = [('staff', (60, 48, 215, 538)), ('satchel', (265, 92, 480, 300)), ('cat', (600, 105, 750, 285)),
         ('curled', (765, 180, 925, 285)), ('flasks', (283, 358, 468, 548))]
T, COLORS = 48, 64

def main(src, out):
    im = Image.open(src).convert('RGB')
    if im.size != (1024, 572):
        sys.exit('expected the 1024 x 572 props sheet, got %s x %s' % im.size)
    strip = Image.new('RGBA', (T * len(PROPS), T), (0, 0, 0, 0))
    for i, (name, box) in enumerate(PROPS):
        f = im.crop(box).convert('RGBA') if name == 'flasks' else cut(im, box)
        k = min(T / f.size[0], T / f.size[1])
        s = f.resize((max(1, round(f.size[0] * k)), max(1, round(f.size[1] * k))), Image.BOX)
        strip.paste(s, (i * T + (T - s.size[0]) // 2, (T - s.size[1]) // 2), s)
    a = strip.split()[3].point(lambda v: 255 if v > 140 else 0)
    rgb = strip.convert('RGB').quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    rgb.putalpha(a)
    dst = os.path.join(out, 'luna-props.webp')
    rgb.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), rgb.size, os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
