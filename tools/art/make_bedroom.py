#!/usr/bin/env python3
"""HealthWiz Kingdom: the sleeper's bedroom for the Counting Sheep dream (js/v6-sheep.js).

Redraws assets/img/bedimg.jpg (the original bedroom picture) as pixel art on a 192 x 190 grid: the same face, beanie,
hair, shirt, pillow, quilt and room, area-averaged onto the grid and reduced to a palette of 56 colours. The scene in
js/v6-sheep.js animates it in layers on top of this one picture (breathing shoulder and quilt, the head, the fingers,
the face), so the picture itself stays a single still frame.

Writes assets/img/bedroom.webp (lossless). Needs Python 3 with Pillow:   python3 tools/art/make_bedroom.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(ROOT, 'assets', 'img', 'bedimg.jpg')
OUT = os.path.join(ROOT, 'assets', 'img', 'bedroom.webp')
W, H, COLOURS = 192, 190, 56

im = Image.open(SRC).convert('RGB').resize((W, H), Image.BOX)
art = im.quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
art.save(OUT, 'WEBP', lossless=True, quality=100, method=6)
print('wrote', os.path.relpath(OUT, ROOT), W, 'x', H, os.path.getsize(OUT), 'bytes')
