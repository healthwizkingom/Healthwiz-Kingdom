"""Luna's seven expression portraits, cropped from the owner's character reference sheet and turned into pixel art.

    python3 tools/art/make_luna_faces.py path/to/luna-reference-sheet.png   # writes assets/img/luna-faces.webp

Input: the 1536 x 1024 "HealthWiz Kingdom - Character Reference Sheet" (Meet Luna), EXPRESSION SHEET row. Each portrait
panel starts at the x below (measured on the sheet, top of the faces at y = 636); a 124 x 124 square centred on the face is
cut, reduced to 64 x 64 with a box filter (each pixel is the mean of about 2 x 2 source pixels) and snapped to one shared
palette of 40 colours without dithering, so it is crisp pixel art that the app draws at whole-number scales
(docs/PIXEL_STYLE.md, rule 5). Output: one 448 x 64 lossless WebP strip in js/v6-luna.js's order:
cheerful, curious, focused, thoughtful, surprised, encouraging, apologetic. Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from PIL import Image

PANELS = [33, 198, 361, 520, 687, 837, 1001]   # left edge of each expression panel on the sheet
TOP, SIZE, OUT, COLORS = 636, 124, 64, 40

def main(src):
    im = Image.open(src).convert('RGB')
    if im.size != (1536, 1024):
        sys.exit('expected the 1536 x 1024 reference sheet, got %s x %s' % im.size)
    strip = Image.new('RGB', (OUT * len(PANELS), OUT))
    for i, x in enumerate(PANELS):
        c = x + 75                                    # centre of the panel's face
        face = im.crop((c - SIZE // 2, TOP, c + SIZE // 2, TOP + SIZE))
        strip.paste(face.resize((OUT, OUT), Image.BOX), (i * OUT, 0))
    strip = strip.quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    dst = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img', 'luna-faces.webp')
    strip.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
