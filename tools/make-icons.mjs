// Draws the HealthWiz app icon (original pixel art: a heart wearing a wizard hat, with a sparkle)
// on a 32×32 grid and writes the PWA icons to assets/icons/. Pure Node, no dependencies:
//   node tools/make-icons.mjs
// Re-run only when the design changes; the PNGs are committed.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = 32;
const C = {
  bg: [20, 32, 79], bg2: [30, 46, 104], ln: [11, 16, 48],
  red: [216, 67, 59], hi: [255, 138, 120], sh: [150, 40, 44],
  hat: [106, 63, 181], hat2: [146, 106, 220], hatd: [72, 40, 132],
  gold: [242, 193, 78], gold2: [255, 226, 122], star: [255, 246, 200],
};
const grid = Array.from({ length: N }, () => Array(N).fill(null));
const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < N && y < N) grid[y][x] = c; };

// heart: two round lobes and a point, rows 9..29
const inHeart = (x, y) => { const px = x + 0.5, py = y + 0.5, l = Math.hypot(px - 10.5, py - 15), r = Math.hypot(px - 21.5, py - 15);
  return l <= 5.6 || r <= 5.6 || (py >= 15 && py <= 29.5 && Math.abs(px - 16) <= (29.5 - py) * 10.6 / 14.5); };
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (inHeart(x, y)) set(x, y, (x - 16) + (y - 19) > 6 ? 'sh' : 'red');
// highlight on the left lobe
[[8, 12], [9, 12], [7, 13], [8, 13], [7, 14]].forEach(([x, y]) => set(x, y, 'hi'));
// hat: a crooked cone resting in the heart's notch, with a gold band and brim
for (let y = 2; y <= 11; y++) {
  const t = (y - 2) / 9, w = Math.round(t * 3.4), cx = Math.round(17 - (1 - t) * 3);
  for (let x = cx - w; x <= cx + w; x++) set(x, y, w && x === cx - w ? 'hat2' : w && x === cx + w ? 'hatd' : 'hat');
}
for (let x = 13; x <= 20; x++) { set(x, 10, x < 15 ? 'gold2' : 'gold'); set(x, 11, 'gold'); }
for (let x = 11; x <= 22; x++) { set(x, 12, x >= 21 ? 'hatd' : 'hat'); if (x > 11 && x < 22) set(x, 13, 'sh'); }
// tip of the hat curls over, with a little gold pompom
set(13, 1, 'hat'); set(12, 1, 'hat'); set(11, 2, 'gold2');
// outline every shape pixel that touches the background
const shape = grid.map(r => r.map(c => c !== null));
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  if (shape[y][x]) continue;
  if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => shape[y + dy]?.[x + dx])) grid[y][x] = 'ln';
}
// sparkle (four-point star) top right, and a small one left
const star = (x, y, big) => { set(x, y, 'star'); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => set(x + dx, y + dy, 'gold2')); if (big) [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([dx, dy]) => set(x + dx, y + dy, 'gold')); };
star(27, 5, true); star(5, 9, false);
// background: soft vignette disc
const bgAt = (x, y) => (Math.hypot(x - 15.5, y - 16.5) < 13 ? C.bg2 : C.bg);

function png(size, scale, off) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - off) / scale), gy = Math.floor((y - off) / scale);
      const inside = gx >= 0 && gy >= 0 && gx < N && gy < N;
      const k = inside ? grid[gy][gx] : null;
      const c = k ? C[k] : inside ? bgAt(gx, gy) : C.bg;
      raw.set([...c, 255], y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const T = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(b) { let c = 0xffffffff; for (const x of b) c = T[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

const out = path.join(root, 'assets', 'icons');
fs.mkdirSync(out, { recursive: true });
// [file, canvas size, pixel scale] — art centred; maskable keeps it inside the 80% safe circle
for (const [f, size, scale] of [['icon-32.png', 32, 1], ['icon-192.png', 192, 6], ['icon-512.png', 512, 16], ['icon-maskable-512.png', 512, 11], ['apple-touch-icon.png', 180, 5]]) {
  fs.writeFileSync(path.join(out, f), png(size, scale, (size - N * scale) / 2));
  console.log('wrote assets/icons/' + f);
}
