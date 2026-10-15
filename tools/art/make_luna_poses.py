"""Every Luna figure on the owner's new character design sheet, cut out and turned into pixel art.

    python3 tools/art/make_luna_poses.py path/to/luna-design-sheet.png [OUT_DIR]   # default OUT_DIR: assets/img

Input: the 1024 x 572 "LUNA - CHARACTER DESIGN" sheet (owner, 2026-10-15; made with Gemini from the brief in the session):
front, side and back views; ten expression poses; casting, walking and reading, pointing, waving and resting. Each figure
is cut with the box in POSES (measured on the sheet by finding the figures' connected shapes). The sheet's lavender
background is removed only where it touches the box edge (flood fill), so light parts of Luna stay; the caption under
each figure is trimmed off (the empty rows above it mark where it starts); pieces of the neighbouring figures that reach
into a box (touching its left or right edge) are dropped, and her own props (the staff, the spellbook, the floating chart,
the casting circle, sparkles, the spirit cat) stay.
The figures are drawn at different sizes on the sheet, so each is scaled by its BODY height (from the first row that is
14 pixels wide, which skips the thin hat tip and staff top, down to the boots) to the same body size; a tall prop then
only extends into the headroom. A box filter does the reduction, the alpha is made hard (0 or 255), and all figures
share one palette without dithering, so the app draws crisp pixel art at whole-number scales (docs/PIXEL_STYLE.md, rule 5).
Output, in POSES order (js/v6-luna.js reads the same order):
  assets/img/luna-poses.webp  all 18 figures, 80 x 120 frames, centred, bottom-aligned
  assets/img/luna-lab.webp    the Science Laboratory's larger Luna: the LAB_POSES, 120 x 180 frames (1.5 times the size)
Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from collections import deque
from PIL import Image

# name: (left, top, right, bottom) on the sheet (right and bottom exclusive)
POSES = [
    ('idle',       (539, 36, 618, 225)),    # neutral
    ('happy',      (617, 38, 724, 225)),
    ('laugh',      (723, 38, 810, 225)),    # laughing
    ('excited',    (817, 41, 908, 225)),
    ('curious',    (915, 41, 996, 225)),
    ('surprised',  (525, 229, 630, 409)),
    ('shocked',    (636, 228, 726, 409)),
    ('sad',        (734, 230, 833, 409)),
    ('apologetic', (830, 229, 912, 409)),
    ('annoyed',    (921, 229, 997, 409)),
    ('cast',       (21, 333, 176, 567)),    # casting a spell, with the circle at her feet
    ('walk',       (184, 357, 283, 551)),   # walking and reading her spellbook
    ('point',      (307, 353, 433, 567)),   # pointing at a floating chart
    ('wave',       (433, 355, 527, 567)),
    ('rest',       (553, 412, 668, 567)),   # resting, cross-legged with the spirit cat
    ('front',      (31, 35, 155, 321)),     # the design views
    ('side',       (173, 35, 287, 321)),
    ('back',       (298, 35, 422, 321)),
]
BG, TOL, TIGHT = (217, 217, 242), 52, 30
LAB_POSES = ['idle', 'point', 'cast', 'walk', 'curious', 'wave']
# file, poses, frame height, frame width, body height, palette size
SETS = [('luna-poses.webp', [n for n, _ in POSES], 120, 80, 104, 64), ('luna-lab.webp', LAB_POSES, 180, 120, 156, 64)]

def trim_caption(c, px):
    """Drops the caption under a figure: the last run of rows (at most 18 high) after three or more empty rows."""
    w, h = c.size
    near = lambda p: sum(abs(a - b) for a, b in zip(p[:3], BG)) < TOL
    rows = [sum(1 for x in range(w) if not near(px[x, y])) for y in range(h)]
    y = h - 1
    while y >= 0 and rows[y] == 0:
        y -= 1
    end = y                                   # last inked row
    while y >= 0 and rows[y] > 0:
        y -= 1
    start = y + 1                             # first row of the last run
    gap = 0
    while y >= 0 and rows[y] == 0:
        gap += 1
        y -= 1
    if end >= start and end - start < 18 and gap >= 3 and y >= 0:
        return c.crop((0, 0, w, start))       # that run is the caption
    return c

def cut(im, box):
    c = im.crop(box).convert('RGBA')
    c = trim_caption(c, c.load())
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
    # background enclosed by the figure (between the legs, inside a circle) never touches the edge: clear every sizeable
    # patch whose colour is the sheet's background within a tight tolerance
    tight = lambda p: p[3] and sum(abs(a - b) for a, b in zip(p[:3], BG)) < TIGHT
    done = set()
    for y in range(h):
        for x in range(w):
            if (x, y) in done or not tight(px[x, y]):
                continue
            patch, q = [], deque([(x, y)])
            done.add((x, y))
            while q:
                a, b = q.popleft()
                patch.append((a, b))
                for n in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                    if 0 <= n[0] < w and 0 <= n[1] < h and n not in done and tight(px[n]):
                        done.add(n)
                        q.append(n)
            if len(patch) >= 12:
                for p in patch:
                    px[p] = (0, 0, 0, 0)
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

def body_height(f):
    """Rows from the first one at least 14 pixels wide (below the hat tip and the top of a staff) to the bottom."""
    a, (w, h) = f.split()[3].load(), f.size
    for y in range(h):
        if sum(1 for x in range(w) if a[x, y]) >= 14:
            return h - y
    return h

def build(cuts, out, name, poses, H, FW, BODY, COLORS):
    frames = []
    for n in poses:
        f = cuts[n]
        k = BODY / body_height(f)
        s = f.resize((max(1, round(f.size[0] * k)), max(1, round(f.size[1] * k))), Image.BOX)
        if s.size[1] > H:                                   # a tall prop (a staff) is scaled to fit the frame
            s = f.resize((max(1, round(f.size[0] * H / f.size[1])), H), Image.BOX)
        if s.size[0] > FW:                                  # a wide pose (a cushion, a circle) is scaled to fit the frame
            s = f.resize((FW, max(1, round(f.size[1] * FW / f.size[0]))), Image.BOX)
        frames.append(s)
    strip = Image.new('RGBA', (FW * len(frames), H), (0, 0, 0, 0))
    for i, s in enumerate(frames):
        strip.paste(s, (i * FW + (FW - s.size[0]) // 2, H - s.size[1]), s)
    a = strip.split()[3].point(lambda v: 255 if v > 140 else 0)
    rgb = strip.convert('RGB').quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    rgb.putalpha(a)
    dst = os.path.join(out, name)
    rgb.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), rgb.size, os.path.getsize(dst), 'bytes')

def main(src, out):
    im = Image.open(src).convert('RGB')
    if im.size != (1024, 572):
        sys.exit('expected the 1024 x 572 design sheet, got %s x %s' % im.size)
    cuts = {name: cut(im, box) for name, box in POSES}
    for name, poses, H, FW, BODY, COLORS in SETS:
        build(cuts, out, name, poses, H, FW, BODY, COLORS)

if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) == 3 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
