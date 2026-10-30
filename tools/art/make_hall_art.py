#!/usr/bin/env python3
"""Health Hall card backgrounds, the image buttons and Luke's tutorial faces, composed from art already in assets/img/.
Run from the repo root:  python3 tools/art/make_hall_art.py
Writes lossless WebP (each under 100 KB; the whole folder is capped in tests/24-performance.test.mjs):
  hall-{food,sleep,stair,exercise,stress,body,stats,score}.webp   192 x 108 card pictures (shown pixelated, cover)
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
def card_food():
    im = grad(W, H, (58, 38, 26), (30, 22, 18))
    d = ImageDraw.Draw(im); d.rectangle((W // 2 + 8, 0, W, H), fill=(26, 34, 58, 255)); d.rectangle((W // 2 + 6, 0, W // 2 + 8, H), fill=(14, 10, 24, 255))
    stars(im, 20, 5, (W // 2 + 10, 0, W, 70))
    d.rectangle((0, 94, W // 2 + 5, H), fill=(110, 70, 36, 255)); d.rectangle((0, 94, W // 2 + 5, 95), fill=(150, 100, 50, 255))
    for k, x in (('apple', 6), ('bread', 78), ('leg', 100), ('fish', 54), ('carrot', 24)): put(im, up(FOODS[k], 2), x, 84)
    lk = fit_h(LUKE(0), 90, Image.LANCZOS); put(im, lk, 14, 10)
    put(im, up(FOODS['drop'], 2), W - 18, 8)
    save(im, 'hall-food.webp')
def well():   # 40 x 44, transparent: roof, posts, stone ring. Shaft inside: x 9-31, y 28-40 (the app draws the water there, see js/v6-art.js)
    im = Image.new('RGBA', (40, 44), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.polygon([(2, 12), (38, 12), (20, 0)], fill=(180, 72, 56, 255)); d.rectangle((2, 12, 37, 14), fill=(150, 60, 50, 255))
    d.rectangle((5, 14, 7, 28), fill=(110, 76, 40, 255)); d.rectangle((32, 14, 34, 28), fill=(110, 76, 40, 255))
    d.rectangle((3, 24, 36, 43), fill=(124, 128, 146, 255))
    for yy in range(24, 43, 6):
        for xx in range(3, 36, 8): d.rectangle((xx + ((yy - 24) // 6 % 2) * 4, yy, xx + ((yy - 24) // 6 % 2) * 4 + 6, yy + 4), outline=(86, 90, 108, 255))
    d.rectangle((9, 28, 30, 39), fill=(18, 20, 40, 255)); d.rectangle((2, 22, 37, 25), fill=(160, 164, 180, 255))
    save(im, 'hall-well.webp')
def card_sleep():
    im = grad(W, H, (22, 18, 56), (54, 30, 72)); stars(im, 50, 9, (0, 0, W, 60)); d = ImageDraw.Draw(im)
    d.ellipse((W - 40, 8, W - 20, 28), fill=(250, 240, 200, 255)); d.ellipse((W - 34, 6, W - 16, 24), fill=(34, 24, 66, 255))
    d.rectangle((0, 90, W, H), fill=(36, 28, 52, 255)); d.rectangle((0, 90, W, 91), fill=(70, 54, 90, 255))
    kn = fit_h(load(I + 'kn.webp'), 76); oc = fit_h(load(I + 'orc.webp'), 66)
    put(im, kn, 34, 92 - kn.height + 4); put(im, oc, 162 - oc.width, 92 - oc.height + 6, flip=True)
    save(im, 'hall-sleep.webp')
def card_stair():
    im = grad(W, H, (26, 20, 64), (52, 34, 84)); stars(im, 30, 12, (0, 0, W, 50))
    s = keyout(load(SRC + 'stair-fantasy.png'), (26, 20, 64)); s = s.crop(s.getbbox())
    s = s.resize((round(s.width * 88 / s.height), 88), Image.LANCZOS); put(im, s, 24, 10)
    save(im, 'hall-stair.webp')
def card_exercise():
    im = grad(W, H, (40, 30, 56), (22, 18, 34)); d = ImageDraw.Draw(im)
    d.rectangle((0, 88, W, H), fill=(64, 46, 40, 255)); d.rectangle((0, 88, W, 89), fill=(104, 78, 60, 255))
    for x in range(0, W, 24): d.line([(x, 88), (x - 10, H)], fill=(52, 38, 34, 255))
    for x in (22, W - 30): d.rectangle((x, 26, x + 8, 88), fill=(70, 70, 92, 255)); d.rectangle((x - 3, 24, x + 11, 28), fill=(110, 110, 140, 255))   # racks
    d.rectangle((24, 36, W - 24, 39), fill=(140, 140, 168, 255))
    kn = load(I + 'exercise/moves.webp').crop((0, 0, 384, 384)); kn = fit_h(kn, 80, Image.LANCZOS); put(im, kn, 40, 14)
    save(im, 'hall-exercise.webp')
def card_stress():
    s = load(I + 'study.jpg').resize((W, H), Image.LANCZOS); save(s, 'hall-stress.webp')
def bolt(d, p0, p1, seed):
    r = random.Random(seed); n = 9; pts = [p0]
    for k in range(1, n):
        t = k / n; pts.append((p0[0] + (p1[0] - p0[0]) * t + r.randint(-6, 6), p0[1] + (p1[1] - p0[1]) * t + r.randint(-9, 9)))
    pts.append(p1); d.line(pts, fill=(255, 190, 40, 255), width=4); d.line(pts, fill=(255, 245, 160, 255), width=2); d.line(pts, fill=(255, 255, 255, 255), width=1)
def card_body():
    im = grad(W, H, (30, 22, 70), (70, 34, 90)); d = ImageDraw.Draw(im); cx, cy = 150, 54
    for y in range(H):   # a glow around the orb, in stepped rings (pixel look)
        for x in range(W):
            dist = math.hypot(x - cx, (y - cy) * 1.1); k = int(dist // 9)
            if dist < 62 and k % 2 == 0: r0, g0, b0, _ = im.getpixel((x, y)); t = (62 - dist) / 62 * .28; im.putpixel((x, y), (int(r0 + (140 - r0) * t), int(g0 + (120 - g0) * t), int(b0 + (255 - b0) * t), 255))
    stars(im, 46, 7, (0, 0, W, H))
    wz = load(I + 'avatar-wz.webp'); wb = wz.getbbox(); wz = wz.crop(wb); sc = 86 / wz.height; wz = wz.resize((round(wz.width * sc), 86), Image.LANCZOS)
    px = wz.load(); tips = [(x, y) for y in range(wz.height // 3) for x in range(wz.width) if px[x, y][3] > 200 and px[x, y][2] > 200 and px[x, y][1] > 170 and px[x, y][0] < 170]
    tx, ty = (sum(t[0] for t in tips) // len(tips), sum(t[1] for t in tips) // len(tips)) if tips else (wz.width * 3 // 4, 6)
    ox, oy = 14, 12; put(im, wz, ox, oy); p0 = (ox + tx, oy + ty)
    for rr, c in ((14, (60, 40, 140, 255)), (11, (110, 80, 220, 255)), (8, (190, 150, 255, 255))): d.ellipse((cx - rr - 4, cy - rr - 4, cx + rr + 4, cy + rr + 4), outline=c, width=2)   # the orb of energy
    d.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=(120, 230, 255, 255)); d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=(190, 250, 255, 255)); d.ellipse((cx - 6, cy - 7, cx - 1, cy - 2), fill=(255, 255, 255, 255))
    bolt(d, p0, (cx - 14, cy - 3), 11); bolt(d, p0, (cx - 12, cy + 8), 23)
    r = random.Random(5)
    for _ in range(22):   # sparks flying off the bolt
        x, y = r.randint(p0[0], cx + 20), r.randint(p0[1] - 22, cy + 30); c = r.choice([(255, 230, 90, 255), (255, 255, 255, 255), (130, 220, 255, 255)])
        d.rectangle((x, y, x + 1, y + 1), fill=c)
    for (x, y) in ((cx + 24, cy - 28), (cx - 26, cy + 28), (cx + 30, cy + 20), (12, 12)):   # four-point twinkles
        d.line([(x - 3, y), (x + 3, y)], fill=(255, 245, 170, 255)); d.line([(x, y - 3), (x, y + 3)], fill=(255, 245, 170, 255))
    save(im, 'hall-body.webp')
def tower_card():
    t = load(I + 'monument-card.webp'); return t
def card_stats():
    t = tower_card().crop((0, 0, 96, 112)); fade = Image.new('L', t.size, 255); fp = fade.load()
    for y in range(t.height):
        for x in range(t.width):
            e = min(x, t.width - 1 - x, y, t.height - 1 - y); fp[x, y] = 255 if e >= 12 else int(255 * e / 12)
    t.putalpha(Image.composite(t.getchannel('A'), Image.new('L', t.size, 0), fade)); t = t.resize((round(96 * 92 / 112), 92), Image.NEAREST)
    im = grad(W, H, (16, 14, 52), (40, 28, 84)); stars(im, 60, 31, (0, 0, W, H)); put(im, t, 34, 8)
    save(im, 'hall-stats.webp')
def card_score():
    o = load(I + 'orb-scene.webp').crop((269 - 40, 568 - 12, 269 + 360, 568 + 238)).resize((W, H), Image.LANCZOS); save(o, 'hall-score.webp')

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
    luke_ask(); well()
    for f in (card_food, card_sleep, card_stair, card_exercise, card_stress, card_body, card_stats, card_score, btn_quests, btn_lab, btn_obs, btn_time, btn_monument): f()
