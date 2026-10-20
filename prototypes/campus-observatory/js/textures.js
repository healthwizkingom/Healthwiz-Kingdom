// Original pixel-art textures and sprites for the fantasy map, generated in code (no image files, no game assets).
// Each texture is n×n art pixels drawn s×s screen pixels; a fixed seed makes every visit identical.
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), h.length > 7 ? parseInt(h.slice(7, 9), 16) : 255];

function grid(n) { return Array.from({ length: n }, () => new Array(n).fill(null)); }
function toImage(G, s) {
  const n = G.length, m = G[0].length, W = m * s, H = n * s, data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < m; x++) {
    const c = G[y][x]; if (!c) continue;
    const [r, g, b, a] = hex(c);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const i = ((y * s + dy) * W + x * s + dx) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a; }
  }
  return { width: W, height: H, data };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
// a soft disc of colour, wrapped so the texture tiles seamlessly
function blob(G, cx, cy, rad, fn) {
  const n = G.length;
  for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
    const d = Math.hypot(x, y); if (d > rad) continue;
    G[(cy + y + n) % n][(cx + x + n) % n] = fn(x, y, d);
  }
}

const T = {
  // night forest canopy around the campus
  'px-forest': () => { const r = rng(41), n = 32, G = grid(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) G[y][x] = pick(r, ['#0c2422', '#0e2825', '#0b201f']);
    for (let k = 0; k < 9; k++) { const cx = Math.floor(r() * n), cy = Math.floor(r() * n), R = 3 + Math.floor(r() * 3);
      blob(G, cx, cy, R, (x, y, d) => d > R - 1 ? '#081816' : (x + y < -R / 2 ? '#2a5c48' : x + y < 0 ? '#1f4a3b' : '#173b30')); }
    for (let k = 0; k < 5; k++) G[Math.floor(r() * n)][Math.floor(r() * n)] = pick(r, ['#7fd8ff', '#bfe9ff']);
    return toImage(G, 2); },
  // moonlit lawn inside the campus
  'px-lawn': () => { const r = rng(23), n = 32, G = grid(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) G[y][x] = (x + y) % 7 === 0 && r() < .5 ? '#2f6446' : pick(r, ['#24533b', '#275a3f', '#22503a', '#2a5d42', '#24533b']);
    for (let k = 0; k < 7; k++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); G[y][x] = pick(r, ['#e9d98a', '#9fd3ff', '#d6b8ff']); }
    for (let k = 0; k < 10; k++) { const x = Math.floor(r() * n), y = Math.floor(r() * (n - 1)); G[y][x] = '#3b7a55'; G[y + 1][x] = '#1c4431'; }
    return toImage(G, 2); },
  'px-pitch': () => { const r = rng(5), n = 32, G = grid(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) G[y][x] = Math.floor(y / 8) % 2 ? pick(r, ['#2f6a43', '#316e45']) : pick(r, ['#285e3b', '#2a613d']);
    return toImage(G, 2); },
  // cool moonlit paving
  'px-plaza': () => { const r = rng(7), n = 32, G = grid(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const row = Math.floor(y / 6), off = row % 2 ? 4 : 0;
      G[y][x] = (y % 6 === 5 || (x + off) % 8 === 7) ? '#262946' : y % 6 === 0 ? '#6c7096' : pick(r, ['#555a80', '#5a5f86', '#50557a']); }
    return toImage(G, 2); },
  // academy walls: pale moonlit stone in coursed blocks, two storeys of warm arched windows per tile
  'px-wall': () => wall(['#8d8fb8', '#8587b1', '#9496be', '#7f81ab'], '#5a5c86', '#4a4c75', 29),
  'px-wall2': () => wall(['#9a95b6', '#928dae', '#a19cbd', '#8b86a8'], '#64607f', '#524e6e', 31),
  'px-turret': () => wall(['#9c9fc6', '#9497bf', '#a3a6cc', '#8e91b9'], '#5f6290', '#4d507c', 37, true),
  'px-plinth': () => { const r = rng(43), n = 32, G = grid(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const off = Math.floor(y / 5) % 2 ? 4 : 0;
      G[y][x] = (y % 5 === 4 || (x + off) % 8 === 7) ? '#1c1d36' : y % 5 === 0 ? '#4a4c72' : pick(r, ['#363859', '#3a3c5e', '#323454']); }
    return toImage(G, 2); },
  // roofs: navy slate in overlapping courses with moonlit edges; a lighter ridge; gold eaves
  'px-slate': () => slate(['#4c6ab4', '#2d4382', '#26397a', '#1d2c62', '#121b44'], 3),
  'px-slate-hi': () => slate(['#7f9ee0', '#5574c4', '#4865b3', '#3a54a0', '#1d2c62'], 9),
  'px-trim': () => { const n = 16, G = grid(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) G[y][x] = y % 4 === 0 ? '#ffe39a' : y % 4 === 3 ? '#8a5a12' : (x % 4 === 0 ? '#d79c2e' : '#e8b444');
    return toImage(G, 2); },
  'px-chimney': () => { const r = rng(61), n = 16, G = grid(n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const off = Math.floor(y / 3) % 2 ? 2 : 0;
      G[y][x] = (y % 3 === 2 || (x + off) % 4 === 3) ? '#3a2220' : pick(r, ['#8a4a3a', '#7d4234', '#94523f']); }
    return toImage(G, 2); },
  'px-roofred': () => slate(['#f0a070', '#c8603e', '#b0502f', '#8a3a22', '#4a1c10'], 11),
  'px-cottage': () => wall(['#d8ccb4', '#d0c4ab', '#ddd2bb', '#c9bca2'], '#9a8b70', '#7c6d54', 47, true),
  'px-goldroof': () => slate(['#ffe08a', '#e0ad3c', '#c99232', '#9a6a1c', '#5a3a0c'], 4),
  'px-wood': () => tiles(['#c58a55', '#9a6a3c', '#7a5230', '#4a3018'], 5),
  'px-canopy': () => tiles(['#8a78d8', '#6a5ac0', '#5546a4', '#2e2566'], 6),
  // lantern-lit cobbled road (a line pattern: drawn along the road)
  'px-cobble': () => { const r = rng(13), G = Array.from({ length: 8 }, () => new Array(16).fill(null));
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) { const off = Math.floor(y / 4) % 2 ? 2 : 0;
      G[y][x] = (y % 4 === 3 || (x + off) % 4 === 3) ? '#6b5a3e' : y % 4 === 0 ? '#e2c48c' : pick(r, ['#c9a46a', '#c19c62', '#cfab72']); }
    return toImage(G, 2); },
};
function wall(stone, mortar, deep, seed, narrow) {
  const r = rng(seed), n = 32, G = grid(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const row = Math.floor(y / 3), off = row % 2 ? 3 : 0;
    G[y][x] = (y % 3 === 2 || (x + off) % 6 === 5) ? mortar : pick(r, stone); }
  // a string course between the storeys
  for (let x = 0; x < n; x++) { G[15][x] = deep; G[31][x] = deep; }
  // windows: arched, lit warm from inside, with a sill and a soft glow on the stone around
  const cols = narrow ? [13] : [5, 21];
  for (const fy of [3, 19]) for (const wx of cols) {
    for (let y = fy - 1; y < fy + 10; y++) for (let x = wx - 1; x < wx + 7; x++) if (G[y] && G[y][x] && !(y < fy + 1 && (x === wx - 1 || x === wx + 6))) G[y][x] = '#a88b6a';
    for (let y = fy; y < fy + 9; y++) for (let x = wx; x < wx + 6; x++) {
      const arch = y === fy && (x === wx || x === wx + 5);
      if (arch) continue;
      const frame = x === wx || x === wx + 5 || y === fy + 8 || (y === fy && (x === wx + 1 || x === wx + 4)) || x === wx + 2 && y > fy + 2 || y === fy + 4;
      G[y][x] = frame ? '#2a2033' : y < fy + 3 ? '#fff3c2' : (x + y) % 4 === 0 ? '#ffb24a' : '#ffd277';
    }
    for (let x = wx - 1; x < wx + 7; x++) G[fy + 9][x] = '#c9b38e';
  }
  return toImage(G, 2);
}
function slate([edge, hi, mid, lo, gap], seed) {
  const r = rng(seed), n = 32, G = grid(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const row = Math.floor(y / 4), off = row % 2 ? 2 : 0, u = (x + off) % 4;
    G[y][x] = y % 4 === 3 ? gap : u === 3 ? lo : y % 4 === 0 ? (u === 0 ? edge : hi) : (r() < .12 ? lo : mid); }
  return toImage(G, 2);
}
function tiles([hi, mid, lo, gap], seed) {
  const r = rng(seed), n = 32, G = grid(n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const row = Math.floor(y / 4), off = row % 2 ? 2 : 0;
    G[y][x] = (x + off) % 4 === 3 ? gap : y % 4 === 0 ? hi : y % 4 === 3 ? lo : (r() < .15 ? lo : mid); }
  return toImage(G, 2);
}

/* ---------- sprites (icons on the map) from character grids ---------- */
const SP = {
  'px-tree-oak': { s: 2, pal: { k: '#06120f', d: '#143a2c', g: '#1f5a3f', h: '#2f7a52', l: '#4fa36b', t: '#3b2416', T: '#5a3a22' }, rows: [
    '.....kkkk.....', '...kkhhhhkk...', '..khhllhhhhk..', '.khlllhhhgghk.', '.khllhhhgggdk.', 'khhhhhhgggggdk', 'khhhhggggggddk', 'kghhgggggdgddk',
    '.kgggggdddddk.', '..kkgddddkkk..', '....kkTtkk....', '.....kTtk.....', '.....kTtk.....', '....kkTtkk....'] },
  'px-tree-pine': { s: 2, pal: { k: '#061210', d: '#123328', g: '#1a4a3a', h: '#28684f', l: '#3f8c69', t: '#3b2416' }, rows: [
    '......kk......', '.....khlk.....', '.....khgk.....', '....khlggk....', '....khggdk....', '...khlgggdk...', '...khggggdk...', '..khllgggddk..', '..khgggggddk..',
    '.khllggggdddk.', '.khgggggggddk.', 'kkkkkkggkkkkkk', '......kt......', '......kt......'] },
  'px-tree-glow': { s: 2, pal: { k: '#0a0f24', d: '#23407a', g: '#2f5fa8', h: '#4f8fd8', l: '#9fd8ff', w: '#e9fbff', t: '#3b2416' }, rows: [
    '.....kkkk.....', '...kkhhhhkk...', '..khhlwhhhhk..', '.khlllhhhgghk.', '.khlwhhhgggdk.', 'khhhhhhgggggdk', 'khhhhggglggddk', 'kghhgggggdgddk',
    '.kgggggdddddk.', '..kkgddddkkk..', '....kkttkk....', '.....ktk......', '.....ktk......', '....kkttkk....'] },
  'px-lantern': { s: 2, pal: { k: '#14102a', g: '#c99a2e', y: '#ffe08a', w: '#fff8d6', o: '#ffb347' }, rows: [
    '..kk..', '.kggk.', 'kggggk', 'kywwyk', 'kyowyk', 'kyooyk', 'kggggk', '.kggk.', '..kk..', '..kk..', '..kk..', '.kkkk.'], glow: '#ffcf6b' },
};
function sprite(name) {
  const { s, pal, rows, glow } = SP[name], h = rows.length, w = rows[0].length, pad = glow ? 6 : 0;
  const W = (w + pad * 2) * s, H = (h + pad * 2) * s, data = new Uint8ClampedArray(W * H * 4);
  if (glow) { // a soft round halo behind the lantern (the only non-pixel shading on the map)
    const [r, g, b] = hex(glow), cx = W / 2, cy = (pad + 4.5) * s, R = (pad + 4) * s;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - cx, y - cy) / R; if (d >= 1) continue;
      const i = (y * W + x) * 4, a = Math.round(170 * (1 - d) * (1 - d)); data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a; }
  }
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || !pal[ch]) return;
    const [r, g, b] = hex(pal[ch]);
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const i = (((y + pad) * s + dy) * W + (x + pad) * s + dx) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
  }));
  return { width: W, height: H, data };
}

/** An image for a style image id, or null when it is not one of ours. */
export function makeImage(id) {
  if (T[id]) return T[id]();
  if (SP[id]) return sprite(id);
  return null;
}
