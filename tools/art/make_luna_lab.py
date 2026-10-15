"""The Science Laboratory's background: Luna's cosy study, from the owner's painted room (2026-10-15).

    python3 tools/art/make_luna_lab.py ROOM.png [OUT_DIR]
      → OUT_DIR/lab-scene.webp   640 x 358 (the 1024 x 572 painting reduced with a Lanczos filter), snapped to 128 colours
                                 without dithering and saved as lossless WebP, which keeps it under the 100 KB per image
                                 limit (≈ 99 KB). It replaces the old pixel-art laboratory panel; the owner asked for the
                                 new HD scene, so it is drawn smoothed (image-rendering: auto), not pixelated.
Luna's figures come from tools/art/make_luna_poses.py (luna-poses.webp, luna-lab.webp). Budget: the owner raised the image
total for this (tests/24-performance.test.mjs).
"""
import os
import sys
from PIL import Image

W, H, COLORS = 640, 358, 128

def main(src, out):
    im = Image.open(src).convert('RGB')
    if im.size != (1024, 572):
        sys.exit('expected the 1024 x 572 room painting, got %s x %s' % im.size)
    c = im.resize((W, H), Image.LANCZOS).quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    dst = os.path.join(out, 'lab-scene.webp')
    c.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), c.size, os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
