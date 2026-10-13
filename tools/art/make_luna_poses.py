"""Every Luna figure on the owner's character reference sheet, cut out and turned into pixel art.

    python3 tools/art/make_luna_poses.py path/to/luna-reference-sheet.png [OUT_DIR]   # default OUT_DIR: assets/img

Input: the 1536 x 1024 "HealthWiz Kingdom - Character Reference Sheet" (Meet Luna). Each figure is cut with the box in
POSES (measured on the sheet). The lavender sheet background is removed only where it touches the box edge (flood fill),
so light parts of Luna stay; pieces of the neighbouring figures that reach into a box (touching its left or right edge)
are dropped, and her own props (cards, the spirit cat, sparkles) stay. Each figure is reduced with a box filter to H
pixels high, the alpha is made hard (0 or 255), and all figures share one palette of COLORS colours without dithering, so
the app draws them as crisp pixel art at whole-number scales (docs/PIXEL_STYLE.md, rule 5).
Output: assets/img/luna-poses.webp, one row of frames, each FW wide (figure centred, bottom-aligned), in POSES order.
js/v6-luna.js reads the same order (POSES there). Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from collections import deque
from PIL import Image

# name: (left, top, right, bottom) on the sheet
POSES = [
    ('idle',     (15, 140, 172, 488)),     # 1 front view (idle)
    ('staff',    (172, 140, 352, 488)),    # 2 three-quarter view with staff
    ('walk',     (336, 140, 494, 488)),    # 3 walking (key pose)
    ('cast',     (474, 136, 690, 488)),    # 4 casting a spell (nutrition card)
    ('point',    (684, 160, 876, 488)),    # 5 pointing to chart (explain result)
    ('think',    (870, 150, 1012, 488)),   # 6 thinking (examining evidence)
    ('happy',    (1000, 150, 1140, 488)),  # 7 happy (task completed)
    ('confused', (1134, 170, 1272, 488)),  # 8 confused (data missing)
    ('wave',     (1272, 170, 1412, 488)),  # 9 greeting (wave)
]
BG, TOL, H, COLORS, FW = (230, 229, 245), 52, 120, 48, 80

def cut(im, box):
    c = im.crop(box).convert('RGBA')
    w, h = c.size
    px = c.load()
    near = lambda p: sum(abs(a - b) for a, b in zip(p[:3], BG)) < TOL
    seen, q = set(), deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if not near(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    # connected pieces: drop the ones touching the left or right edge unless they are the largest (Luna herself)
    lab, comps = {}, []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in lab:
                k, pts, q = len(comps), [], deque([(x, y)])
                lab[(x, y)] = k
                while q:
                    a, b = q.popleft()
                    pts.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (a + dx, b + dy)
                            if 0 <= n[0] < w and 0 <= n[1] < h and n not in lab and px[n][3]:
                                lab[n] = k
                                q.append(n)
                comps.append(pts)
    big = max(range(len(comps)), key=lambda i: len(comps[i]))
    for i, pts in enumerate(comps):
        edge = any(x <= 1 or x >= w - 2 for x, _ in pts)
        if i != big and (edge or len(pts) < 12):
            for p in pts:
                px[p] = (0, 0, 0, 0)
    return c.crop(c.getbbox())

def main(src, out):
    im = Image.open(src).convert('RGB')
    if im.size != (1536, 1024):
        sys.exit('expected the 1536 x 1024 reference sheet, got %s x %s' % im.size)
    frames = []
    for name, box in POSES:
        f = cut(im, box)
        s = f.resize((max(1, round(f.size[0] * H / f.size[1])), H), Image.BOX)
        if s.size[0] > FW:                                 # a wide pose (a card or a cat) is scaled to fit the frame
            s = f.resize((FW, max(1, round(f.size[1] * FW / f.size[0]))), Image.BOX)
        frames.append(s)
    strip = Image.new('RGBA', (FW * len(frames), H), (0, 0, 0, 0))
    for i, s in enumerate(frames):
        strip.paste(s, (i * FW + (FW - s.size[0]) // 2, H - s.size[1]), s)
    a = strip.split()[3].point(lambda v: 255 if v > 140 else 0)
    rgb = strip.convert('RGB').quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    rgb.putalpha(a)
    dst = os.path.join(out, 'luna-poses.webp')
    rgb.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), rgb.size, os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
