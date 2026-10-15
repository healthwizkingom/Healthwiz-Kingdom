"""Luna's expression portraits, cropped from the owner's character design sheets and turned into pixel art.

    python3 tools/art/make_luna_faces.py VIEWS ACTIONS EXPRESSIONS_A EXPRESSIONS_B [OUT_DIR]   # writes OUT_DIR/luna-faces.webp

Input: the four 1024 x 572 sheets of make_luna_poses.py (use the same files, in the same order). The sheets have no
separate close-ups, so each portrait is the head of an expression figure: a square about 30 % of the figure's
height, centred on the middle of her hair and face (found from the figure's own pixels) and starting just under the hat
tip, reduced to 64 x 64 with a box filter and snapped to one shared palette without dithering, so it is crisp pixel art
that the app draws at whole-number scales (docs/PIXEL_STYLE.md, rule 5). Output: one lossless WebP strip, 64 x 64 per
portrait, in js/v6-luna.js's order: cheerful, curious, focused, thoughtful, surprised, encouraging, apologetic,
laughing, shocked, sad, annoyed, neutral. Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from make_luna_poses import SHEETS, boxes, near   # the same figure cuts

# portrait: the pose it is cut from
FACES = [('cheerful', 'happy'), ('curious', 'curious'), ('focused', 'focused'), ('thoughtful', 'think'), ('surprised', 'surprised'),
         ('encouraging', 'excited'), ('apologetic', 'apologetic'), ('laughing', 'laugh'), ('shocked', 'shocked'), ('sad', 'sad'),
         ('annoyed', 'annoyed'), ('neutral', 'idle')]
OUT, COLORS = 64, 64
INK = lambda p: not near(p, 60)

def head(im, box):
    """The head square of the figure in `box`: (left, top, size)."""
    l, t, r, b = box
    px = im.load()
    cols = lambda y: [x for x in range(l, r) if INK(px[x, y])]
    top = next(y for y in range(t + 2, b) if len(cols(y)) >= 8)            # the hat tip (a staff's top is thinner)
    foot = max(y for y in range(t, min(b, 500)) if cols(y))
    h = foot - top
    xs = [x for y in range(top + int(h * 0.16), top + int(h * 0.30)) for x in cols(y)]   # hair and face
    size = int(h * 0.30)
    c = round(sum(xs) / len(xs))
    return c - size // 2, top + int(h * 0.12), size

def main(paths, out):
    cuts = {}
    for (label, names, splits), path in zip(SHEETS, paths):
        im = Image.open(path).convert('RGB')
        for n, box in boxes(im, names, splits).items():
            cuts[n] = (im, box)
    strip = Image.new('RGB', (OUT * len(FACES), OUT))
    for i, (_, pose) in enumerate(FACES):
        im, box = cuts[pose]
        x, y, s = head(im, box)
        strip.paste(im.crop((x, y, x + s, y + s)).resize((OUT, OUT), Image.BOX), (i * OUT, 0))
    strip = strip.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    dst = os.path.join(out, 'luna-faces.webp')
    strip.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), strip.size, os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    if len(sys.argv) not in (5, 6):
        sys.exit(__doc__)
    main(sys.argv[1:5], sys.argv[5] if len(sys.argv) == 6 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
