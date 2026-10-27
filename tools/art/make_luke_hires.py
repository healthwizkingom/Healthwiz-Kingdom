"""Luke's high-detail upper bodies, cut from the owner's two expression sheets (tools/art/luke_sheets/expressions-1.jpg and -2.jpg,
sent 2026-10-27, "LUKE - EXPRESSIONS PART 1 and 2").

Why: the 22 pixel figures of assets/img/luke-poses.webp are 120 x 180; enlarged for the Add More Food scene they go chunky or soft.
The owner's sheets are about 4 times as detailed, so the twelve expression figures are cut out here, head to waist, and the scene uses
them in place of the pixel figure for those twelve expressions (the other ten poses keep their pixel figure).

What it does: keys the lavender sheet background to transparent (soft edge, colour un-mixed from the background), finds the six figures
on each sheet, crops each from the hat to the waist, centres it on its head, scales it to CELL and packs the six of a sheet side by side.
Output: assets/img/luke-hires-1.webp (happy, confused, nervous, determined, surprised, tired) and luke-hires-2.webp (excited, curious,
thinking, laughing, sad, annoyed), lossless WebP, six cells of CELL_W x CELL_H each, in that order (js/v6-addfood.js FACES order).

Run:  python3 tools/art/make_luke_hires.py     (needs pillow, numpy, scipy; outside the app, nothing at run time)"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = [os.path.join(HERE, 'luke_sheets', f) for f in ('expressions-1.jpg', 'expressions-2.jpg')]
OUT = [os.path.join(ROOT, 'assets', 'img', f) for f in ('luke-hires-1.webp', 'luke-hires-2.webp')]
BG = np.array([222, 222, 243])
CROP_W, CROP_H = 270, 310          # source pixels: hat to waist
SCALE = float(os.environ.get('SCALE', '0.62'))
CELL_W, CELL_H = round(CROP_W * SCALE), round(CROP_H * SCALE)
COLOURS = int(os.environ.get('COLOURS', '176'))

def figures(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    d = np.max(np.abs(a - BG), axis=2)
    fg = d > 52                              # the faint guide lines of the sheet stay below this and so do not join the figures
    fg[:42, :] = False                       # the title band
    fg[430:, :] = False                      # legs, boots and the captions: only head to waist is wanted
    fg = ndi.binary_closing(fg, iterations=2)
    # the six figures touch at the hat brims, so they are told apart by their cream hoodies: each pixel belongs to the nearest hoodie
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    hood = (np.abs(R - G) < 14) & (R - B > 24) & (R > 200) & (G > 195)
    hood[:150, :] = False; hood[430:, :] = False
    lab, n = ndi.label(ndi.binary_closing(ndi.binary_opening(hood, iterations=1), structure=np.ones((41, 41))))   # join the pieces of one hoodie
    sizes = ndi.sum(lab > 0, lab, range(1, n + 1))
    keep = sorted(np.argsort(sizes)[-6:] + 1)
    cxs = sorted(ndi.center_of_mass(lab == k)[1] for k in keep)
    assert len(cxs) == 6, (path, cxs)
    xs = np.arange(a.shape[1])
    owner = np.argmin(np.abs(xs[None, :] - np.array(cxs)[:, None]), axis=0)      # figure index for each column
    out = []
    for k, hx in enumerate(cxs):
        region = fg & (owner[None, :] == k)
        lab2, n2 = ndi.label(region)
        sz = ndi.sum(region, lab2, range(1, n2 + 1))
        mask = ndi.binary_dilation(lab2 == (np.argmax(sz) + 1), iterations=2) & (owner[None, :] == k)
        # enclosed pale areas (the hoodie, a lens glint, teeth) are part of the figure; only a very large enclosed gap would stay see-through
        filled = ndi.binary_fill_holes(mask)
        holes, hn = ndi.label(filled & ~mask)
        for j in range(1, hn + 1):
            h = holes == j
            if h.sum() < 12000: mask |= h        # a pale hoodie or a lens glint is the figure, not background
        alpha = np.clip((d - 14) / 24, 0, 1) * mask
        alpha = np.where(ndi.binary_erosion(mask, iterations=2), 1.0, alpha)
        rgb = np.clip((a - BG * (1 - alpha[..., None])) / np.maximum(alpha[..., None], 1e-3), 0, 255)
        ys, xx = np.where(mask)
        top = ys.min()
        cx = int(np.average(xx[ys < top + 170]))      # the middle of the hat and head
        x0, y0 = cx - CROP_W // 2, top - 6
        rgba = np.dstack([rgb, alpha * 255]).astype(np.uint8)
        pad = np.zeros((CROP_H, CROP_W, 4), np.uint8)
        sx0, sy0 = max(x0, 0), max(y0, 0)
        sx1, sy1 = min(x0 + CROP_W, rgba.shape[1]), min(y0 + CROP_H, rgba.shape[0])
        pad[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0] = rgba[sy0:sy1, sx0:sx1]
        out.append(Image.fromarray(pad, 'RGBA').resize((CELL_W, CELL_H), Image.LANCZOS))
    return out

for src, dst in zip(SRC, OUT):
    cells = figures(src)
    sheet = Image.new('RGBA', (CELL_W * 6, CELL_H), (0, 0, 0, 0))
    for i, c in enumerate(cells): sheet.paste(c, (i * CELL_W, 0))
    # 176 colours (the art is flat shading): the lossless file is a third of the size, which keeps assets/img inside its budget
    sheet.quantize(colors=COLOURS, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(dst, 'WEBP', lossless=True, quality=100, method=6)
    print(dst, os.path.getsize(dst), 'bytes', sheet.size)
