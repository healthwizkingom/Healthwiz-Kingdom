"""Luke (the apprentice of Add More Food) from the owner's character design sheets (2026-10-15), as pixel art.

    python3 tools/art/make_luke.py TURNAROUND ACTIONS EXPRESSIONS_1 EXPRESSIONS_2 PROPS ROOM [OUT_DIR]   # default OUT_DIR: assets/img

Input: five 1024 x 572 "LUKE" sheets (made with Gemini from briefs written in the session) and his painted room:
  TURNAROUND    front, three-quarter (with his wand), side, back
  ACTIONS       walking, casting a spell, reading his spellbook, inspecting a potion, waving hello, resting
  EXPRESSIONS_1 happy, confused, nervous, determined, surprised, tired
  EXPRESSIONS_2 excited, curious, thinking, laughing, sad, annoyed
  PROPS         portrait, wand, backpack, spellbooks, magical notes, scrolls, potion (and the colour palette, which is
                information and not cut)
  ROOM          his room, the painted night study
Everything on the sheets is used, cut with the same code as Luna's (tools/art/make_luna_poses.py: the lavender background is
flood-filled away from the edges only, so his cream hoodie stays; enclosed background is cleared; captions and the sheet's
ground line are trimmed; pieces of neighbours are dropped; each figure is scaled by its body height; hard alpha; one shared
palette without dithering), so the app draws crisp pixel art at whole-number scales (docs/PIXEL_STYLE.md, rule 5):
  → luke-poses.webp  all 22 figures, 120 x 180 frames, in POSES order (js/v6-addfood.js reads the same order)
  → luke-faces.webp  twelve expressions, 64 x 64, the heads of the expression figures, in FACES order
  → luke-props.webp  seven 40 x 40 tiles, in PROPS order (the portrait is the round one)
  → luke-room.webp   his room, 640 x 358, 128 colours: a painting, so the app draws it smoothed (image-rendering: auto)
luna-room.webp (Luna's room) is not made here any more; it is unchanged. Budget: tests/24-performance.test.mjs.
"""
import os
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import make_luna_poses as M   # the same cutting code; the sheets' background is within its tolerance

# name: the sheet's figures left to right, the x between neighbours (the turnaround's are the empty columns between its
# figures; the expression sheets' are the quietest columns near the gaps: their hats overlap a little)
# the last number is the bottom edge: the turnaround has no captions; on the expression sheets the feet end above the
# sheet's ground line (y 542) and the captions are under it
ROWS = [
    ('turn', ['front', 'three', 'side', 'back'], [258, 544, 770], 572),
    ('expr1', ['happy', 'confused', 'nervous', 'determined', 'surprised', 'tired'], [215, 376, 523, 679, 843], 541),
    ('expr2', ['excited', 'curious', 'think', 'laugh', 'sad', 'annoyed'], [224, 383, 539, 711, 858], 541),
]
# the actions sheet is two rows, so its boxes are explicit: (left, top, right, bottom)
ACTIONS = {'walk': (0, 48, 240, 546), 'cast': (240, 48, 535, 546), 'read': (535, 48, 790, 278), 'inspect': (790, 48, 1024, 279),
           'wave': (535, 300, 750, 546), 'rest': (750, 300, 1024, 549)}
POSES = ['front', 'three', 'side', 'back', 'walk', 'cast', 'read', 'inspect', 'wave', 'rest', 'happy', 'confused', 'nervous',
         'determined', 'surprised', 'tired', 'excited', 'curious', 'think', 'laugh', 'sad', 'annoyed']
FACES = [('happy', 'happy'), ('confused', 'confused'), ('nervous', 'nervous'), ('determined', 'determined'), ('surprised', 'surprised'),
         ('tired', 'tired'), ('excited', 'excited'), ('curious', 'curious'), ('thinking', 'think'), ('laughing', 'laugh'), ('sad', 'sad'),
         ('annoyed', 'annoyed')]
# the props sheet: (name, box); the portrait (a round picture) is last
PROPS = [('books', (585, 80, 760, 248)), ('notes', (815, 78, 1000, 248)), ('wand', (225, 120, 300, 470)),
         ('backpack', (22, 285, 218, 462)), ('scrolls', (578, 288, 780, 422)), ('potion', (858, 284, 962, 404)),
         ('portrait', (35, 58, 215, 240))]
H, FW, BODY, PCOLORS = 180, 120, 156, 64
FS, FCOLORS, PS, PROPCOLORS = 64, 64, 40, 56
ROOM_SIZE, ROOM_COLORS = (640, 358), 128

def clean(im):
    """Paints out the sheet's ground line (a thin row of lavender-grey across the whole width)."""
    px, w = im.load(), im.size[0]
    for y in range(40, im.size[1]):
        row = [sum(abs(a - b) for a, b in zip(px[x, y], M.BG)) for x in range(5, w - 5)]
        if sum(1 for d in row if 25 < d < 110) > 0.6 * w:
            for x in range(w):
                if sum(abs(a - b) for a, b in zip(px[x, y], M.BG)) < 110:
                    px[x, y] = M.BG
    return im

def head(im, box):
    """The head square of the figure in `box`: (left, top, size)."""
    l, t, r, b = box
    px = im.load()
    ink = lambda p: not M.near(p, 60)
    cols = lambda y: [x for x in range(l, r) if ink(px[x, y])]
    top = next(y for y in range(t + 2, b) if len(cols(y)) >= 8)
    foot = max(y for y in range(t, min(b, 520)) if cols(y))
    h = foot - top
    xs = [x for y in range(top + int(h * 0.22), top + int(h * 0.34)) for x in cols(y)]   # hair and face
    size = int(h * 0.34)
    c = round(sum(xs) / len(xs))
    return c - size // 2, top + int(h * 0.12), size

def quantize(img, colors):
    return img.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)

def main(turn, actions, expr1, expr2, props, room, out):
    sheets = {'turn': clean(Image.open(turn).convert('RGB')), 'expr1': clean(Image.open(expr1).convert('RGB')),
              'expr2': clean(Image.open(expr2).convert('RGB'))}
    acts = clean(Image.open(actions).convert('RGB'))
    cuts, heads = {}, {}
    for key, names, splits, bottom in ROWS:
        xs = [0] + splits + [1024]
        for i, n in enumerate(names):
            box = (xs[i], M.TITLE, xs[i + 1], bottom)
            cuts[n] = M.cut(sheets[key], box, 3)
            if key != 'turn':
                heads[n] = (sheets[key], box)
    for n, box in ACTIONS.items():
        cuts[n] = M.cut(acts, box, 3)
    M.build(cuts, out, 'luke-poses.webp', POSES, H, FW, BODY, PCOLORS)
    strip = Image.new('RGB', (FS * len(FACES), FS))
    for i, (_, pose) in enumerate(FACES):
        im, box = heads[pose]
        x, y, s = head(im, box)
        strip.paste(im.crop((x, y, x + s, y + s)).resize((FS, FS), Image.BOX), (i * FS, 0))
    dst = os.path.join(out, 'luke-faces.webp')
    quantize(strip, FCOLORS).convert('RGB').save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), strip.size, os.path.getsize(dst), 'bytes')
    sheet = clean(Image.open(props).convert('RGB'))
    tiles = Image.new('RGBA', (PS * len(PROPS), PS), (0, 0, 0, 0))
    for i, (name, box) in enumerate(PROPS):
        f = M.cut(sheet, box, 3)
        k = min(PS / f.size[0], PS / f.size[1])
        s = f.resize((max(1, round(f.size[0] * k)), max(1, round(f.size[1] * k))), Image.BOX)
        tiles.paste(s, (i * PS + (PS - s.size[0]) // 2, (PS - s.size[1]) // 2), s)
    a = tiles.split()[3].point(lambda v: 255 if v > 140 else 0)
    rgba = quantize(tiles.convert('RGB'), PROPCOLORS).convert('RGBA')
    rgba.putalpha(a)
    dst = os.path.join(out, 'luke-props.webp')
    rgba.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), rgba.size, os.path.getsize(dst), 'bytes')
    r = Image.open(room).convert('RGB')
    if r.size != (1024, 572):
        sys.exit('expected the 1024 x 572 room painting, got %s x %s' % r.size)
    r = quantize(r.resize(ROOM_SIZE, Image.LANCZOS), ROOM_COLORS).convert('RGB')
    dst = os.path.join(out, 'luke-room.webp')
    r.save(dst, lossless=True, quality=100, method=6)
    print(os.path.normpath(dst), r.size, os.path.getsize(dst), 'bytes')

if __name__ == '__main__':
    if len(sys.argv) not in (7, 8):
        sys.exit(__doc__)
    main(*sys.argv[1:7], sys.argv[7] if len(sys.argv) == 8 else os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'img'))
