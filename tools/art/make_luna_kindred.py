"""Luna's sheets from the Blender renders of the "Spirit Blossom Kindred" model (owner's request, 2026-10-23; she is still
called Luna). The renders come from tools/art/blender_luna_kindred.py:

    blender -b --factory-startup -P tools/art/blender_luna_kindred.py -- MODEL_DIR RENDERS
    python3 tools/art/make_luna_kindred.py RENDERS [OUT_DIR]          # default OUT_DIR: assets/img

Writes the same three files, sizes and orders as before, so js/v6-luna.js is unchanged:
  luna-poses.webp  all 21 figures (js/v6-luna.js POSES), 80 x 120 frames      } packed by make_luna_poses.build(): scaled
  luna-lab.webp    the Laboratory's six (LAB_POSES), 160 x 240 frames          } to one body height, bottom-aligned, hard alpha
  luna-faces.webp  the twelve portraits (make_luna_faces.FACES order), 64 x 64 on the sheets' lavender, from the head renders
Each is snapped to one shared palette without dithering (docs/PIXEL_STYLE.md, rule 5). Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from make_luna_poses import SETS, BG, build
from make_luna_faces import FACES, OUT as FACE, COLORS as FACE_COLORS

def main(src, out):
    cuts = {}
    for name in {p for _, poses, *_ in SETS for p in poses}:
        im = Image.open(os.path.join(src, 'pose_%s.png' % name)).convert('RGBA')
        im.putalpha(im.split()[3].point(lambda v: v if v > 24 else 0))   # no faint fringe in the crop
        cuts[name] = im.crop(im.getbbox())
    for name, poses, H, FW, BODY, COLORS in SETS:
        build(cuts, out, name, poses, H, FW, BODY, COLORS)
    strip = Image.new('RGB', (FACE * len(FACES), FACE), BG)
    for i, (_, pose) in enumerate(FACES):
        im = Image.open(os.path.join(src, 'face_%s.png' % pose)).convert('RGBA')
        bg = Image.new('RGBA', im.size, BG + (255,)); bg.alpha_composite(im)
        strip.paste(bg.convert('RGB').resize((FACE, FACE), Image.BOX), (i * FACE, 0))
    strip = strip.quantize(colors=FACE_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    dst = os.path.join(out, 'luna-faces.webp')
    strip.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), strip.size, os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
