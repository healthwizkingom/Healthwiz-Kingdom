"""Prepare the pamphlet's pictures from the game's own art (assets/img).
Pixel art is enlarged with nearest-neighbour so it prints crisp; nothing is redrawn or invented.
Run from the repo root:  python3 docs/pamphlet/prep_assets.py
"""
from PIL import Image
import segno, pathlib
SRC = pathlib.Path("assets/img"); OUT = pathlib.Path("docs/pamphlet/img"); OUT.mkdir(parents=True, exist_ok=True)

def up(name, k, ext="png", crop=None, out=None, q=88):
    im = Image.open(SRC / f"{name}.webp").convert("RGBA" if ext == "png" else "RGB")
    if crop: im = im.crop(crop)
    im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    dst = OUT / f"{out or name}.{ext}"
    im.save(dst, optimize=True) if ext == "png" else im.save(dst, quality=q, optimize=True)
    print(dst, im.size, dst.stat().st_size // 1024, "KB")

for n in ("logo", "wiz", "kn"): up(n, 4)
for n in ("hall-body", "hall-exercise", "hall-food", "hall-score", "hall-sleep", "hall-stair", "hall-stats", "hall-stress", "lab-scene"):
    up(n, 4, "jpg")
up("orb-scene", 2, "jpg")
up("luna-faces", 6, "png", crop=(64 * 3, 0, 64 * 4, 64), out="luna-face")          # one of Luna's 12 expressions
up("luke-hires-1", 2, "png", crop=(334, 0, 501, 192), out="luke-pose")             # one of Luke's poses

URL = "https://healthwizkingom.github.io/Healthwiz-Kingdom/"
q = segno.make(URL, error="m")
q.save(str(OUT / "qr.svg"), scale=8, dark="#0d0b26", light="#ffffff", border=2)
print("qr", q.version, URL)
