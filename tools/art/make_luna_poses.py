"""Every Luna figure on the owner's character design sheets, cut out and turned into pixel art.

    python3 tools/art/make_luna_poses.py VIEWS ACTIONS EXPRESSIONS_A EXPRESSIONS_B [OUT_DIR]   # default OUT_DIR: assets/img

Input: four 1024 x 572 "LUNA - CHARACTER DESIGN" sheets (owner, 2026-10-15; made with Gemini from briefs written in the
session), each a row of full-body figures on a lavender background under a title bar, with a caption below each figure:
  VIEWS         front, side, back, three-quarter with the staff
  ACTIONS       casting a spell, reading her spellbook, pointing at a chart, waving, sitting with the spirit cat
  EXPRESSIONS_A neutral, happy, laughing, excited, curious, thinking
  EXPRESSIONS_B focused, surprised, shocked, sad, apologetic, annoyed
Twenty-one figures. Each sheet is cut at the measured boundaries between its figures (SHEETS); the sheet's lavender background is removed only where it touches the cut's edge (flood fill), so light parts of
Luna stay, then any large patch of background enclosed by her (between the legs, inside the casting circle) is cleared;
the caption under each figure is trimmed off (the empty rows above it mark where it starts); pieces of a neighbouring
figure that reach into a cut (touching its left or right edge) are dropped, and her own props (the staff, the spellbook,
the floating chart, the casting circle, sparkles, the spirit cat) stay.
The figures are drawn at slightly different sizes on the sheets, so each is scaled by its BODY height (from the first row
that is wide enough to be more than the hat tip or the top of a staff, down to the boots) to the same body size; a tall
prop then only extends into the headroom. A box filter does the reduction, the alpha is made hard (0 or 255), and all
figures share one palette without dithering, so the app draws crisp pixel art at whole-number scales (docs/PIXEL_STYLE.md,
rule 5). Output, in POSES order (js/v6-luna.js reads the same order):
  assets/img/luna-poses.webp  all 21 figures, 80 x 120 frames, centred, bottom-aligned
  assets/img/luna-lab.webp    the Science Laboratory's larger Luna: the LAB_POSES, 160 x 240 frames (twice the size)
Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from collections import deque
from PIL import Image

# per sheet: the poses left to right, the x between neighbouring figures (measured on the sheet: where it has the least ink;
# the pointing / waving cut is a few pixels right of that so the floating chart's glow is not clipped)
SHEETS = [
    ('views',   ['front', 'side', 'back', 'three'],                                  [266, 512, 750]),
    ('actions', ['cast', 'walk', 'point', 'wave', 'rest'],                           [280, 454, 651, 821]),
    ('exprA',   ['idle', 'happy', 'laugh', 'excited', 'curious', 'think'],           [189, 353, 515, 677, 836]),
    ('exprB',   ['focused', 'surprised', 'shocked', 'sad', 'apologetic', 'annoyed'], [192, 358, 536, 691, 847]),
]
POSES = ['idle', 'happy', 'laugh', 'excited', 'curious', 'think', 'focused', 'surprised', 'shocked', 'sad', 'apologetic',
         'annoyed', 'cast', 'walk', 'point', 'wave', 'rest', 'front', 'side', 'back', 'three']
TITLE = 48                                    # the title bar's height on every sheet
BG, TOL, TIGHT = (217, 217, 242), 52, 30
LAB_POSES = ['idle', 'point', 'cast', 'walk', 'curious', 'wave']
# file, poses, frame height, frame width, body height, palette size
SETS = [('luna-poses.webp', POSES, 120, 80, 104, 96), ('luna-lab.webp', LAB_POSES, 240, 160, 208, 96)]

near = lambda p, tol=TOL: sum(abs(a - b) for a, b in zip(p[:3], BG)) < tol

def trim_caption(c, px):
    """Drops the caption under a figure: the last run of rows (at most 40 high) after six or more empty rows."""
    w, h = c.size
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
    if end >= start and end - start < 40 and gap >= 6 and y >= 0:
        return c.crop((0, 0, w, start))       # that run is the caption
    return c

def cut(im, box):
    c = im.crop(box).convert('RGBA')
    c = trim_caption(c, c.load())
    w, h = c.size
    px = c.load()
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
    tight = lambda p: p[3] and near(p, TIGHT)
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
            if len(patch) >= 40:
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
        if i != big and (edge or len(pts) < 40):
            for p in pts:
                px[p] = (0, 0, 0, 0)
    return c.crop(c.getbbox())

def body_height(f):
    """Rows from the first one wide enough to be more than the hat tip or a staff's top (6 % of the figure's height)
    to the bottom."""
    a, (w, h) = f.split()[3].load(), f.size
    need = max(14, round(h * 0.06))
    for y in range(h):
        if sum(1 for x in range(w) if a[x, y]) >= need:
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

def boxes(im, names, splits):
    """The cut box of each figure on a sheet: between the measured x positions, under the title bar."""
    xs = [0] + list(splits) + [im.size[0]]
    return {n: (xs[i], TITLE, xs[i + 1], im.size[1]) for i, n in enumerate(names)}

def main(paths, out):
    cuts = {}
    for (label, names, splits), path in zip(SHEETS, paths):
        im = Image.open(path).convert('RGB')
        if im.size != (1024, 572):
            sys.exit('%s: expected a 1024 x 572 sheet, got %s x %s' % (path, *im.size))
        for n, box in boxes(im, names, splits).items():
            cuts[n] = cut(im, box)
    for name, poses, H, FW, BODY, COLORS in SETS:
        build(cuts, out, name, poses, H, FW, BODY, COLORS)

if __name__ == '__main__':
    if len(sys.argv) not in (5, 6):
        sys.exit(__doc__)
    main(sys.argv[1:5], sys.argv[5] if len(sys.argv) == 6 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
