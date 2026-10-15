"""Luna's expression portraits, cropped from the owner's new character design sheet and turned into pixel art.

    python3 tools/art/make_luna_faces.py path/to/luna-design-sheet.png [OUT_DIR]   # writes OUT_DIR/luna-faces.webp

Input: the 1024 x 572 "LUNA - CHARACTER DESIGN" sheet (see make_luna_poses.py). The sheet has no separate close-ups,
so each portrait is the head of an expression figure: a SIZE x SIZE square, centred on the middle of her hair and face
(found from the figure's own pixels) and starting a little under the hat tip (one source pixel per portrait pixel, so nothing is blurred) and
snapped to one shared palette without dithering, so it is crisp pixel art that the app draws at whole-number scales
(docs/PIXEL_STYLE.md, rule 5). Output: one lossless WebP strip, 64 x 64 per portrait, in js/v6-luna.js's order:
cheerful, curious, focused, thoughtful, surprised, encouraging, apologetic, laughing, shocked, sad, annoyed.
Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from PIL import Image

# portrait: the figure's box on the sheet (left, top, right, bottom): the same boxes as make_luna_poses.py
FACES = [
    ('cheerful',    (617, 38, 724, 225)),    # the happy figure
    ('curious',     (915, 41, 996, 225)),
    ('focused',     (539, 36, 618, 225)),    # the neutral figure
    ('thoughtful',  (184, 357, 283, 551)),   # reading her spellbook
    ('surprised',   (525, 229, 630, 409)),
    ('encouraging', (817, 41, 908, 225)),    # the excited figure
    ('apologetic',  (830, 229, 912, 409)),
    ('laughing',    (723, 38, 810, 225)),
    ('shocked',     (636, 228, 726, 409)),
    ('sad',         (734, 230, 833, 409)),
    ('annoyed',     (921, 229, 997, 409)),
]
BG = (217, 217, 242)
SIZE, OUT, COLORS = 64, 64, 48

def centre(im, box):
    """x of the middle of the head: the mean column of the non-background pixels in the hair and face rows."""
    l, t, r, b = box
    xs = []
    for y in range(t + 24, t + 52):
        for x in range(l, r):
            if sum(abs(a - c) for a, c in zip(im.getpixel((x, y)), BG)) > 60:
                xs.append(x)
    return round(sum(xs) / len(xs))

def main(src, out):
    im = Image.open(src).convert('RGB')
    if im.size != (1024, 572):
        sys.exit('expected the 1024 x 572 design sheet, got %s x %s' % im.size)
    strip = Image.new('RGB', (OUT * len(FACES), OUT))
    for i, (_, box) in enumerate(FACES):
        c, top = centre(im, box), box[1] + 10
        face = im.crop((c - SIZE // 2, top, c + SIZE // 2, top + SIZE))
        strip.paste(face.resize((OUT, OUT), Image.BOX), (i * OUT, 0))
    strip = strip.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    dst = os.path.join(out, 'luna-faces.webp')
    strip.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), strip.size, os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
