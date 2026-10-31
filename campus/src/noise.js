// Baked, tileable noise (one texture tap instead of dozens of sin() calls per pixel: software GL pays dearly for those).
import * as THREE from 'three';
import { mulberry } from './common.js';

function periodicNoise(N, period, rnd) {
  const g = new Float32Array(period * period); for (let i = 0; i < g.length; i++) g[i] = rnd();
  const out = new Float32Array(N * N), sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = (x / N) * period, fy = (y / N) * period, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period, a = g[y0 * period + x0], b = g[y0 * period + x1], c = g[y1 * period + x0], d = g[y1 * period + x1];
    out[y * N + x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
  return out;
}

/** RGBA8: R = broad fbm, G = mid fbm, B = fine fbm, A = soft cloud-shaped fbm. Tiles seamlessly. */
export function makeNoiseTexture(N = 256) {
  const data = new Uint8Array(N * N * 4), rnd = mulberry(20261029);
  const fbm = (p0, oct) => { const acc = new Float32Array(N * N); let a = 0.5, tot = 0; for (let o = 0; o < oct; o++) { const n = periodicNoise(N, p0 * 2 ** o, rnd); for (let i = 0; i < acc.length; i++) acc[i] += n[i] * a; tot += a; a *= 0.5; } for (let i = 0; i < acc.length; i++) acc[i] /= tot; return acc; };
  const R = fbm(4, 5), G = fbm(8, 4), B = fbm(16, 3), A = fbm(5, 6);
  const norm = (arr) => { let lo = 1, hi = 0; for (const v of arr) { if (v < lo) lo = v; if (v > hi) hi = v; } return (v) => (v - lo) / (hi - lo); };
  const nR = norm(R), nG = norm(G), nB = norm(B), nA = norm(A);
  for (let i = 0; i < N * N; i++) { data[i * 4] = nR(R[i]) * 255; data[i * 4 + 1] = nG(G[i]) * 255; data[i * 4 + 2] = nB(B[i]) * 255; data[i * 4 + 3] = nA(A[i]) * 255; }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; t.colorSpace = THREE.NoColorSpace;
  return t;
}

/** Equirectangular star field: x = azimuth, y = elevation; R = brightness, G = hue. */
export function makeStarTexture() {
  const W = 2048, Hh = 1024, c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d'), rnd = mulberry(4242);
  g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
  for (let i = 0; i < 3600; i++) {
    const x = rnd() * W, y = Hh * 0.5 + rnd() * Hh * 0.5, mag = Math.pow(rnd(), 3.2), r = 0.55 + mag * 1.1, hue = rnd(); // y: upper half = above the horizon
    const v = Math.round(110 + 145 * mag);
    g.fillStyle = `rgb(${v},${Math.round(hue * 255)},0)`; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.wrapS = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.NoColorSpace; return t;
}
let NOISE = null, STARS = null;
export const noiseTex = () => NOISE || (NOISE = makeNoiseTexture());
export const starTex = () => STARS || (STARS = makeStarTexture());
