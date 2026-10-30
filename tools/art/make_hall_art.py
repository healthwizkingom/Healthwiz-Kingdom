#!/usr/bin/env python3
"""Health Hall card backgrounds, the image buttons and Luke's tutorial faces, composed from art already in assets/img/.
Run from the repo root:  python3 tools/art/make_hall_art.py
Writes lossless WebP (each under 100 KB; the whole folder is capped in tests/24-performance.test.mjs):
  hall-{food,sleep,stair,exercise,stress,body,stats,score}.webp   the owner's card pictures (tools/art/src/hall-*.jpg, reduced to 256 wide), shown pixelated
  btn-{quests,lab,obs,time,monument}.webp                          240 x 48 button pictures (shown pixelated, left, height 100%)
  luke-ask.webp                                                    7 expression faces, 80 x 80 each
Sources: tools/art/src/luke-expressions.png (the owner's expression sheet) and tools/art/src/stair-fantasy.png (assets/models/stairs/
demo-fantasy.glb rendered with the vendored three.js), plus the sprites under assets/img/."""
import random, math, os
from PIL import Image, ImageDraw, ImageFilter
I = 'assets/img/'; SRC = 'tools/art/src/'
def load(p): return Image.open(p).convert('RGBA')
def save(im, name):
    im.convert('RGBA').save(I + name, lossless=True, quality=100, method=6); print(name, os.path.getsize(I + name))
def grad(w, h, top, bot):
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1); d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)) + (255,))
    return im
def hgrad(w, h, left, right):
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
    for x in range(w):
        t = x / max(1, w - 1); d.line([(x, 0), (x, h)], fill=tuple(int(left[i] + (right[i] - left[i]) * t) for i in range(3)) + (255,))
    return im
def stars(im, n, seed, box=None):
    r = random.Random(seed); d = ImageDraw.Draw(im); w, h = im.size; b = box or (0, 0, w, h)
    for _ in range(n):
        x, y = r.randrange(b[0], b[2]), r.randrange(b[1], b[3]); c = r.choice([(255, 255, 255, 255), (255, 232, 160, 255), (160, 200, 255, 255)])
        d.point((x, y), fill=c)
        if r.random() < .15: d.point((x + 1, y), fill=c); d.point((x, y + 1), fill=c)
def fit_h(sp, h, resample=Image.LANCZOS):
    bb = sp.getbbox(); sp = sp.crop(bb) if bb else sp; w = max(1, round(sp.width * h / sp.height)); return sp.resize((w, h), resample)
def put(im, sp, x, y, flip=False):
    if flip: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
    im.alpha_composite(sp, (x, y))
def frame(sheet, i, w, h=None): s = load(sheet); h = h or s.height; return s.crop((i * w, 0, (i + 1) * w, h))
def keyout(im, rgb, tol=6):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]
            if abs(p[0] - rgb[0]) < tol and abs(p[1] - rgb[1]) < tol and abs(p[2] - rgb[2]) < tol: px[x, y] = (0, 0, 0, 0)
    return im
def bits(rows, pal):   # tiny hand-drawn sprite from text rows
    im = Image.new('RGBA', (max(map(len, rows)), len(rows)), (0, 0, 0, 0)); px = im.load()
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in pal: px[x, y] = pal[c]
    return im
def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)

LUKE = lambda i=0: frame(I + 'luke-hires-1.webp', i, 167)   # the sharper design sheet: 6 poses of 167 x 192; 0 = smiling, arms open
LUNA = lambda i=0: frame(I + 'luna-poses.webp', i, 120)
W, H = 192, 108

# ---------- Luke's expression faces (the owner's sheet), 7 x 80 ----------
def luke_ask():
    s = load(SRC + 'luke-expressions.png'); xs = [46, 354, 666, 968, 1272, 1571, 1864]; out = Image.new('RGBA', (80 * 7, 80), (0, 0, 0, 0))
    for i, x in enumerate(xs):   # one 280 px square per card: the whole hat and face centred; the symbol beside the head is painted over with the card colour
        c = s.crop((x + 2, 160, x + 2 + 284, 160 + 284)); bg = c.getpixel((60, 6)); d = ImageDraw.Draw(c)
        d.rectangle((236, 176, 284, 250), fill=bg); d.rectangle((246, 14, 284, 56), fill=bg)
        out.alpha_composite(c.resize((80, 80), Image.LANCZOS), (i * 80, 0))
    save(out, 'luke-ask.webp')

# ---------- card pictures ----------
FOODS = {
 'apple': bits(['..g..', '.rrrr', 'rrwrr', 'rrrrr', '.rrr.'], {'g': (80, 170, 60, 255), 'r': (214, 60, 52, 255), 'w': (255, 190, 180, 255)}),
 'bread': bits(['.bbbb.', 'bbtbtb', 'bbbbbb', '.dddd.'], {'b': (214, 160, 80, 255), 't': (240, 200, 120, 255), 'd': (150, 100, 48, 255)}),
 'leg':   bits(['.mmm..', 'mmmmm.', 'mmmmm.', '.mmm..', '..w...', '.ww.w.', '..w.ww'], {'m': (190, 100, 50, 255), 'w': (240, 232, 214, 255)}),
 'fish':  bits(['..bbb.b', '.bbbbbb', 'bebbbb.', '.bbbbbb', '..bbb.b'], {'b': (110, 170, 220, 255), 'e': (20, 20, 40, 255)}),
 'carrot': bits(['..gg', '.ooo', '.ooo', '..oo', '..o.'], {'g': (80, 170, 60, 255), 'o': (240, 140, 40, 255)}),
 'drop':  bits(['..b..', '..b..', '.bbb.', 'bbwbb', 'bbbbb', '.bbb.'], {'b': (60, 160, 240, 255), 'w': (200, 240, 255, 255)}),
}
def ref(name, w=256):   # the owner's own pictures, reduced to w wide (pixel look kept, lossless)
    im = Image.open(SRC + 'hall-%s.jpg' % name).convert('RGBA'); save(im.resize((w, round(im.height * w / im.width)), Image.LANCZOS), 'hall-%s.webp' % name)
def card_stress():
    s = load(I + 'study.jpg').resize((W, H), Image.LANCZOS); save(s, 'hall-stress.webp')
def tower_card():
    t = load(I + 'monument-card.webp'); return t
# ---------- image buttons, 240 x 48 ----------
BW, BH = 240, 48
def btn_quests():
    im = hgrad(BW, BH, (74, 46, 24), (42, 28, 18)); d = ImageDraw.Draw(im)
    for y in range(0, BH, 8): d.line([(0, y), (BW, y)], fill=(54, 34, 18, 255))
    d.rectangle((2, 3, 70, 44), outline=(150, 100, 48, 255), width=2); d.rectangle((4, 5, 68, 42), fill=(96, 62, 32, 255))   # the guild notice board
    sc = fit_h(frame(I + 'luke-props.webp', 1, 40), 30); put(im, sc, 8, 9); put(im, fit_h(frame(I + 'luke-props.webp', 4, 40), 26), 42, 12)
    lk = fit_h(LUKE(0), 46, Image.LANCZOS); put(im, lk, 74, 1)
    r = random.Random(4)
    for i, k in enumerate(('apple', 'bread', 'leg', 'fish', 'carrot', 'apple')): put(im, up(FOODS[k], 2), 108 + i * 17, 20 + (i % 2) * 8)
    save(im, 'btn-quests.webp')
def btn_lab():
    lab = load(I + 'lab-scene.webp'); im = lab.crop((60, 70, 60 + 640, 70 + 128)).resize((200, 40), Image.LANCZOS)
    c = hgrad(BW, BH, (26, 20, 58), (26, 20, 58)); c.alpha_composite(im.resize((BW - 40, BH), Image.LANCZOS), (0, 0))
    fade = Image.new('RGBA', (BW, BH)); fp = fade.load()
    for x in range(BW - 90, BW):
        a = min(255, int((x - (BW - 90)) / 90 * 255))
        for y in range(BH): fp[x, y] = (26, 20, 58, a)
    c.alpha_composite(fade); lu = LUNA(0).crop((10, 0, 110, 66)); lu = lu.resize((round(lu.width * 46 / lu.height), 46), Image.LANCZOS); put(c, lu, 6, 2)
    save(c, 'btn-lab.webp')
def stop(col, hi, dark):
    return bits(['..hhh..', '.hCCCh.', 'hCCwCCh', 'hCCCCCh', '.hCCCh.', '..ddd..', '..ddd..', '.ddddd.'], {'h': hi, 'C': col, 'w': (255, 255, 255, 255), 'd': dark})
def btn_obs():
    im = grad(BW, BH, (18, 24, 52), (24, 44, 56)); d = ImageDraw.Draw(im); stars(im, 24, 8, (0, 0, BW, 20))
    for x in range(0, BW, 16): d.line([(x, 0), (x, BH)], fill=(30, 52, 70, 255))
    for y in range(0, BH, 12): d.line([(0, y), (BW, y)], fill=(30, 52, 70, 255))
    d.line([(14, 40), (50, 30), (90, 38), (130, 22)], fill=(230, 210, 120, 255), width=2)
    for i, (c, h, dk) in enumerate([((60, 210, 90, 255), (190, 255, 200, 255), (30, 110, 50, 255)), ((250, 214, 60, 255), (255, 244, 170, 255), (150, 120, 20, 255)), ((236, 70, 70, 255), (255, 180, 170, 255), (130, 30, 40, 255))]):
        put(im, up(stop(c, h, dk), 4), 12 + i * 34, 8 + (i % 2) * 4)
    save(im, 'btn-obs.webp')
def gear(r, teeth, col, hub):
    s = r * 2 + 8; g = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(g); c = s // 2
    pts = []
    for i in range(teeth * 2):
        a = math.pi * i / teeth; rr = r + (3 if i % 2 == 0 else -1); pts += [(c + rr * math.cos(a), c + rr * math.sin(a)), (c + rr * math.cos(a + math.pi / teeth * .5), c + rr * math.sin(a + math.pi / teeth * .5))]
    d.polygon(pts, fill=col); d.ellipse((c - r // 2, c - r // 2, c + r // 2, c + r // 2), fill=hub); d.ellipse((c - 2, c - 2, c + 2, c + 2), fill=col); return g
def clock(r):
    s = r * 2 + 4; g = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(g); c = s // 2
    d.ellipse((0, 0, s - 1, s - 1), fill=(214, 168, 70, 255)); d.ellipse((3, 3, s - 4, s - 4), fill=(246, 238, 214, 255))
    for k in range(12): a = math.pi * k / 6; d.point((c + (r - 3) * math.sin(a), c - (r - 3) * math.cos(a)), fill=(40, 30, 20, 255))
    d.line([(c, c), (c, c - r + 5)], fill=(40, 30, 20, 255)); d.line([(c, c), (c + r // 2, c + 2)], fill=(40, 30, 20, 255)); return g
def btn_time():
    im = hgrad(BW, BH, (16, 52, 60), (24, 34, 44)); d = ImageDraw.Draw(im)
    for y in range(0, BH, 6): d.line([(0, y), (BW, y)], fill=(20, 60, 68, 255))
    put(im, gear(16, 10, (190, 140, 56, 255), (24, 40, 50, 255)), 4, 8); put(im, gear(11, 8, (110, 190, 190, 255), (24, 40, 50, 255)), 40, 22)
    put(im, clock(18), 66, 6); put(im, gear(9, 8, (214, 170, 80, 255), (24, 40, 50, 255)), 106, 4); put(im, clock(10), 124, 22)
    put(im, gear(13, 9, (120, 200, 200, 255), (24, 40, 50, 255)), 146, 6)
    save(im, 'btn-time.webp')
def btn_monument():
    im = grad(BW, BH, (16, 14, 52), (44, 30, 86)); stars(im, 40, 17, (0, 0, BW, BH)); t = tower_card()
    tw = fit_h(t, BH - 2, Image.NEAREST); put(im, tw, 8, 1); put(im, fit_h(t, 30, Image.NEAREST), 62, 17); put(im, fit_h(t, 22, Image.NEAREST), 92, 25)
    save(im, 'btn-monument.webp')

if __name__ == '__main__':
    luke_ask()
    for f in (card_stress,): f()
    for n in ('food', 'sleep', 'stair', 'exercise', 'body', 'stats', 'score'): ref(n)
    for f in (btn_quests, btn_lab, btn_obs, btn_time, btn_monument): f()
