"""Luke (the apprentice of Add More Food, first called the Wannabe Wizard), his room, and Luna's room, from the owner's images.

    python3 tools/art/make_luke.py SHEET.png HIS_ROOM.png LUNA_ROOM.png [OUT_DIR]   # default OUT_DIR: assets/img

SHEET.png is the owner's 1536 x 1024 "The Wannabe Wizard" reference sheet; the rooms are their 1672 x 941 scenes.
Everything on the sheet is used:
  → luke-poses.webp  all six angles (front, three-quarter, side, back, walking, casting), 120 x 180 frames: each cut
                     with the box in POSES, the light sheet background flood-filled away from the edges only (so his
                     cream shirt stays), pieces of neighbours dropped, reduced with a box filter, hard alpha
  → luke-faces.webp  all seven expressions (happy, confused, nervous, determined, surprised, tired, excited), 64 x 64
                     each, the square inside each EXPRESSIONS card
  → luke-props.webp  the six PROPS & ITEMS (books, notes, wand, backpack, scrolls, potion) and the COMPACT PORTRAIT
                     (round), 40 x 40 each, in that order
  → luke-room.webp   his room (WIZARD'S ROOM), 336 x 189
  → luna-room.webp   Luna's room, 336 x 189
Each set shares one palette, snapped without dithering, so the app draws crisp pixel art (docs/PIXEL_STYLE.md, rule 5).
Budget: tests/24-performance.test.mjs (the owner raised it to 880 KB).
"""
import os
import sys
from collections import deque
from PIL import Image, ImageDraw

POSES = [('front', (22, 150, 162, 500)), ('three', (171, 160, 300, 500)), ('side', (306, 160, 432, 500)),
         ('back', (435, 160, 560, 500)), ('walk', (578, 175, 712, 500)), ('cast', (720, 160, 893, 505))]
FACES = [('happy', 25), ('confused', 177), ('nervous', 327), ('determined', 479), ('surprised', 631), ('tired', 784), ('excited', 935)]
FACE_TOP, FACE_SIZE = 614, 128
H, FW, PCOL, FS, FCOL = 180, 120, 56, 64, 40
# PROPS & ITEMS: (name, box on the sheet); then the COMPACT PORTRAIT (a circle) last
PROPS = [('books', (872, 830, 944, 896)), ('notes', (966, 832, 1034, 896)), ('wand', (1040, 828, 1112, 896)),
         ('backpack', (872, 904, 944, 968)), ('scrolls', (966, 908, 1034, 968)), ('potion', (1050, 904, 1108, 968))]
PORTRAIT, PS, PCOLS = (1156, 818, 1310, 964), 40, 40
ROOM, RCOL = (336, 189), 96

def light(p):
    r, g, b = p[:3]
    return min(r, g, b) > 196 and max(r, g, b) - min(r, g, b) < 42

def cut(im, box, only_big=False):
    c = im.crop(box).convert('RGBA')
    w, h = c.size
    px = c.load()
    seen, q = set(), deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if not light(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    # enclosed holes of sheet background (between an arm and the body): only exact-ish sheet colour, at least 30 px,
    # so his cream shirt (yellower: blue well below red) stays
    sheet = lambda p: light(p) and p[2] >= p[0] - 14
    hole, done = [], set()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in done and sheet(px[x, y]):
                pts, qq = [], deque([(x, y)])
                done.add((x, y))
                while qq:
                    a, b = qq.popleft()
                    pts.append((a, b))
                    for n in ((a + 1, b), (a - 1, b), (a, b + 1), (a, b - 1)):
                        if 0 <= n[0] < w and 0 <= n[1] < h and n not in done and px[n][3] and sheet(px[n]):
                            done.add(n)
                            qq.append(n)
                if len(pts) >= 30:
                    hole.extend(pts)
    for p in hole:
        px[p] = (0, 0, 0, 0)
    lab, comps = {}, []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in lab:
                k, pts, qq = len(comps), [], deque([(x, y)])
                lab[(x, y)] = k
                while qq:
                    a, b = qq.popleft()
                    pts.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (a + dx, b + dy)
                            if 0 <= n[0] < w and 0 <= n[1] < h and n not in lab and px[n][3]:
                                lab[n] = k
                                qq.append(n)
                comps.append(pts)
    big = max(range(len(comps)), key=lambda i: len(comps[i]))
    for i, pts in enumerate(comps):
        if i != big and (only_big or any(x <= 1 or x >= w - 2 for x, _ in pts) or len(pts) < 12):
            for p in pts:
                px[p] = (0, 0, 0, 0)
    return c.crop(c.getbbox())

def quant(img, n):
    a = img.split()[3].point(lambda v: 255 if v > 140 else 0) if img.mode == 'RGBA' else None
    out = img.convert('RGB').quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA' if a else 'RGB')
    if a:
        out.putalpha(a)
    return out

def save(img, out, name):
    dst = os.path.join(out, name)
    img.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), img.size, os.path.getsize(dst), 'bytes')

def main(sheet, his, hers, out):
    im = Image.open(sheet).convert('RGB')
    if im.size != (1536, 1024):
        sys.exit('expected the 1536 x 1024 Wannabe Wizard sheet, got %s x %s' % im.size)
    strip = Image.new('RGBA', (FW * len(POSES), H), (0, 0, 0, 0))
    for i, (_, box) in enumerate(POSES):
        f = cut(im, box)
        s = f.resize((max(1, round(f.size[0] * H / f.size[1])), H), Image.BOX)
        if s.size[0] > FW:
            s = f.resize((FW, max(1, round(f.size[1] * FW / f.size[0]))), Image.BOX)
        strip.paste(s, (i * FW + (FW - s.size[0]) // 2, H - s.size[1]), s)
    save(quant(strip, PCOL), out, 'luke-poses.webp')
    faces = Image.new('RGB', (FS * len(FACES), FS))
    for i, (_, x) in enumerate(FACES):
        c = x + 68                                       # the card's centre
        faces.paste(im.crop((c - FACE_SIZE // 2, FACE_TOP, c + FACE_SIZE // 2, FACE_TOP + FACE_SIZE)).resize((FS, FS), Image.BOX), (i * FS, 0))
    save(quant(faces, FCOL), out, 'luke-faces.webp')
    tiles = Image.new('RGBA', (PS * (len(PROPS) + 1), PS), (0, 0, 0, 0))
    for i, (_, box) in enumerate(PROPS):
        f = cut(im, box, True)       # only the object itself: its caption below is dropped
        k = min((PS - 2) / f.size[0], (PS - 2) / f.size[1])
        t = f.resize((max(1, round(f.size[0] * k)), max(1, round(f.size[1] * k))), Image.BOX)
        tiles.paste(t, (i * PS + (PS - t.size[0]) // 2, PS - 1 - t.size[1]), t)
    pt = im.crop(PORTRAIT).convert('RGBA').resize((PS, PS), Image.BOX)
    mask = Image.new('L', (PS * 4, PS * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, PS * 4 - 1, PS * 4 - 1), fill=255)
    pt.putalpha(mask.resize((PS, PS), Image.BOX).point(lambda v: 255 if v > 128 else 0))
    tiles.paste(pt, (len(PROPS) * PS, 0), pt)
    save(quant(tiles, PCOLS), out, 'luke-props.webp')
    for src, name in ((his, 'luke-room.webp'), (hers, 'luna-room.webp')):
        r = Image.open(src).convert('RGB').resize(ROOM, Image.BOX)
        save(quant(r, RCOL), out, name)

if __name__ == '__main__':
    if len(sys.argv) not in (4, 5):
        sys.exit(__doc__)
    main(*sys.argv[1:4], sys.argv[4] if len(sys.argv) == 5 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
