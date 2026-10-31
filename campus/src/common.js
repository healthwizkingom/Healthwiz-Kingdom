// Shared helpers: the campus's local coordinate frame (glTF axes: x east, y up, z south), seeded noise, easing.
export const RAD = Math.PI / 180, R_EARTH = 6371008.8;
export const ORIGIN = { lng: 100.5384, lat: 5.351065 }; // the GLB's origin = centre of the OSM export's bounds
export const KX = RAD * R_EARTH * Math.cos(ORIGIN.lat * RAD), KY = RAD * R_EARTH;
export const toLocal = (lng, lat) => ({ x: (lng - ORIGIN.lng) * KX, z: -(lat - ORIGIN.lat) * KY });
export const toLngLat = (x, z) => [ORIGIN.lng + x / KX, ORIGIN.lat - z / KY];

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const unlerp = (a, b, v) => (v - a) / (b - a);
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const smoothstep = (a, b, v) => smooth((v - a) / (b - a));
export const mix = lerp;
export const inOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const outCubic = (t) => 1 - Math.pow(1 - t, 3);
export const inCubic = (t) => t * t * t;
export const outBack = (t, s = 1.70158) => { t -= 1; return t * t * ((s + 1) * t + s) + 1; };
export const pulse = (t, a, b, ramp = 0.3) => smoothstep(a, a + ramp, t) * (1 - smoothstep(b - ramp, b, t));

// deterministic hashing / noise (the same on every frame and every worker)
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };
export const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return s - Math.floor(s); };
export function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
export function fbm2(x, y, oct = 4) { let s = 0, a = 0.5; for (let i = 0; i < oct; i++) { s += a * noise2(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.3; a *= 0.5; } return s; }
export const noise1 = (x) => { const xi = Math.floor(x), xf = x - xi; const u = xf * xf * (3 - 2 * xf); return lerp(hash1(xi), hash1(xi + 1), u) * 2 - 1; };

export function hexToRGB(h) { const c = typeof h === 'number' ? h : parseInt(h.replace('#', ''), 16); return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255]; }
export function mixColor(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

/** Piecewise-linear / smooth keyframe lookup: keys = [[t, value-or-array], ...] sorted by t; returns interpolated value (arrays supported). */
export function keyframes(keys, t, easeFn = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t >= t0 && t <= t1) {
      const u = easeFn((t - t0) / (t1 - t0));
      return Array.isArray(v0) ? v0.map((x, j) => lerp(x, v1[j], u)) : lerp(v0, v1, u);
    }
  }
  return last[1];
}

/** the repository root, whichever sub-path the site is served from (GitHub Pages serves it under /Healthwiz-Kingdom/) */
export const ROOT = new URL('../../', import.meta.url).href;
