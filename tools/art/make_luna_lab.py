"""The Science Laboratory's background, from the owner's concept sheet, as pixel art.

    python3 tools/art/make_luna_lab.py CONCEPT.png
      → assets/img/lab-scene.webp   290 x 210, the "SCIENCE LABORATORY" panel of the owner's HealthWiz Kingdom concept
                                    sheet (1536 x 1024), cut between the panel's menu chips and the witch at the desk,
                                    snapped to 80 colours without dithering
Luna's full figure used to come from here too (luna-full.webp); all nine poses now come from
tools/art/make_luna_poses.py (luna-poses.webp). It is drawn at whole-number scales with image-rendering: pixelated (docs/PIXEL_STYLE.md). Budget: the owner raised the
image total to 740 KB for these (tests/24-performance.test.mjs).
"""
import os
import sys
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img')
LAB_BOX = (540, 250, 830, 460)          # in the concept sheet

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

if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    lab(sys.argv[1])
