// The ground: the app's illustrative terrain (data/elevation-zones.geojson via observatory/terrain.js) as one mesh that reaches
// well past the campus, so every tree and building stands on something. Painted from the OSM export, for the video only.
import { ROOT } from './common.js';
import * as THREE from 'three';
import { createTerrain } from '../../observatory/terrain.js';
import { toLocal, toLngLat, mulberry, fbm2, clamp } from './common.js';
import { noiseTex } from './noise.js';

export const EXTENT = 1400; // the painted texture covers EXTENT x EXTENT metres around the origin
export let heightAt = () => 0; // (x, z) local metres -> terrain height (m)

export async function loadTerrain() {
  const zones = await (await fetch(`${ROOT}data/elevation-zones.geojson`)).json();
  const t = createTerrain(zones);
  heightAt = (x, z) => { const [lng, lat] = toLngLat(x, z); return t.heightAt(lng, lat); };
  return heightAt;
}

/** One ground tile: an n x n grid over [x0, x0+size] x [z0, z0+size] with a short skirt so tiles of different detail never show cracks. */
function tileGeometry(x0, z0, size, n, H, farBlend) {
  const step = size / n, vx = n + 1, ring = [];
  const pos = [], uv = [], idx = [];
  const put = (x, z, drop = 0) => {
    const far = clamp((Math.hypot(x, z) - 420) / 500);
    const y = H(x, z) + far * (fbm2(x * 0.004 + 3, z * 0.004 + 7, 3) - 0.35) * 55 * farBlend - drop;
    pos.push(x, y, z); uv.push(x / EXTENT + 0.5, z / EXTENT + 0.5); return pos.length / 3 - 1;
  };
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) put(x0 + i * step, z0 + j * step);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * vx + i, b = a + 1, c = a + vx, d = c + 1; idx.push(a, c, b, b, c, d); }
  const edge = (get) => { const e = []; for (let k = 0; k <= n; k++) e.push(get(k)); for (let k = 0; k < n; k++) { const a = e[k], b = e[k + 1]; const x1 = pos[a * 3], z1 = pos[a * 3 + 2], x2 = pos[b * 3], z2 = pos[b * 3 + 2]; const sa = put(x1, z1, 5), sb = put(x2, z2, 5); idx.push(a, sa, b, b, sa, sb); } };
  edge((k) => k); edge((k) => n * vx + k); edge((k) => k * vx); edge((k) => k * vx + n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  // skirt normals would shade dark: point them up
  const nn = g.attributes.normal; for (let i = vx * vx; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
  return g;
}

/** The ground as culled tiles: 160 m tiles at 5 m over the inner 1280 m, 640 m tiles at 20 m beyond (2560 m each way). */
export function groundTiles(H, mat) {
  const group = new THREE.Group();
  const add = (x0, z0, size, n, farBlend) => { const m = new THREE.Mesh(tileGeometry(x0, z0, size, n, H, farBlend), mat); m.receiveShadow = true; group.add(m); };
  for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) add(i * 160, j * 160, 160, 32, 0.0);
  for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) { if (i >= -1 && i < 1 && j >= -1 && j < 1) continue; add(i * 640, j * 640, 640, 32, 1.0); }
  return group;
}

const px = (x, S) => (x / EXTENT + 0.5) * S, pz = (z, S) => (z / EXTENT + 0.5) * S;
function ringLocal(ring) { return ring.map(([lng, lat]) => { const p = toLocal(lng, lat); return [p.x, p.z]; }); }

function pathPoly(ctx, pts, S) { ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x, S), pz(z, S)) : ctx.moveTo(px(x, S), pz(z, S)))); ctx.closePath(); }
function pathLine(ctx, pts, S) { ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(px(x, S), pz(z, S)) : ctx.moveTo(px(x, S), pz(z, S)))); }

/** principal direction of a polygon (radians), to align mowing stripes with a pitch */
function mainAngle(P) {
  let best = 0, bestA = 1e18;
  for (let a = 0; a < Math.PI; a += Math.PI / 36) {
    const c = Math.cos(a), s = Math.sin(a); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, z] of P) { const u = x * c + z * s, v = -x * s + z * c; x0 = Math.min(x0, u); x1 = Math.max(x1, u); y0 = Math.min(y0, v); y1 = Math.max(y1, v); }
    const A = (x1 - x0) * (y1 - y0); if (A < bestA) { bestA = A; best = (x1 - x0) > (y1 - y0) ? a : a + Math.PI / 2; }
  }
  return best;
}

export function paintGround(osm, look) {
  const S = 4096, fan = look === 'fantasy';
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const cv = mk(), ev = mk(), ctx = cv.getContext('2d'), ectx = ev.getContext('2d');
  const rnd = mulberry(fan ? 77 : 41);
  const m = (v) => (v / EXTENT) * S; // metres -> px
  const COL = fan
    ? { out: '#1f4a5a', lawn: '#37796f', pitch1: '#41907f', pitch2: '#2f7468', plaza: '#4a6e96', path: '#7488a8', blobs: ['#3f8f78', '#2a6270', '#37867f', '#5876b0', '#4a9a68'] }
    : { out: '#5a7230', lawn: '#7c9a3c', pitch1: '#8aa842', pitch2: '#789433', plaza: '#d2cbb7', path: '#c4beac', blobs: ['#6e9034', '#8aa84a', '#60802a', '#9bb258', '#857f45', '#6a9040'] };
  ctx.fillStyle = COL.out; ctx.fillRect(0, 0, S, S);
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, S, S);
  const blobs = (n, rmin, rmax, alpha, area) => {
    for (let i = 0; i < n; i++) {
      const x = rnd() * S, y = rnd() * S, r = m(rmin + rnd() * (rmax - rmin));
      const g = ctx.createRadialGradient(x, y, 0, x, y, r); const c = COL.blobs[(rnd() * COL.blobs.length) | 0];
      g.addColorStop(0, c + 'ff'); g.addColorStop(1, c + '00'); ctx.globalAlpha = alpha * (0.4 + rnd() * 0.6); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  blobs(9000, 6, 38, 0.5); // plantation / scrub mottling all over (outside the campus mostly)

  const feats = osm.features;
  const campus = feats.find((f) => f.properties.kind === 'campus');
  if (campus) {
    const P = ringLocal(campus.geometry.coordinates[0]);
    ctx.save(); pathPoly(ctx, P, S); ctx.fillStyle = COL.lawn; ctx.fill(); ctx.clip();
    blobs(5200, 3, 20, 0.45); // lawn mottling, clipped to the campus
    ctx.restore();
    // a soft darker rim just outside the fence line
    ctx.save(); pathPoly(ctx, P, S); ctx.lineWidth = m(5); ctx.strokeStyle = fan ? 'rgba(10,25,35,.55)' : 'rgba(40,60,20,.35)'; ctx.stroke(); ctx.restore();
    if (fan) { ectx.save(); pathPoly(ectx, P, S); ectx.lineWidth = m(1.1); ectx.strokeStyle = 'rgb(40,120,150)'; ectx.shadowColor = 'rgb(60,200,230)'; ectx.shadowBlur = m(2); ectx.stroke(); ectx.restore(); }
  }
  // soft contact shadows: a dark halo around every building footprint (ambient occlusion painted into the ground, for the video only)
  for (const f of feats) {
    if (f.geometry.type !== 'Polygon' || !['building', 'water_tower'].includes(f.properties.kind)) continue;
    const P = ringLocal(f.geometry.coordinates[0]);
    ctx.save(); ctx.shadowColor = fan ? 'rgba(4,10,30,0.75)' : 'rgba(25,35,10,0.6)'; ctx.shadowBlur = m(9); ctx.shadowOffsetX = S * 2; ctx.translate(-S * 2, 0);
    pathPoly(ctx, P, S); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
  }
  for (const f of feats) {
    const k = f.properties.kind, g = f.geometry;
    if (g.type === 'Polygon' && (k === 'sport')) {
      const P = ringLocal(g.coordinates[0]), a = mainAngle(P);
      ctx.save(); pathPoly(ctx, P, S); ctx.clip(); ctx.fillStyle = COL.pitch2; ctx.fillRect(0, 0, S, S);
      const c = Math.cos(a), s = Math.sin(a);
      let cx = 0, cz = 0; P.forEach(([x, z]) => { cx += x; cz += z; }); cx /= P.length; cz /= P.length;
      ctx.translate(px(cx, S), pz(cz, S)); ctx.rotate(a); ctx.fillStyle = COL.pitch1;
      for (let i = -40; i < 40; i += 2) ctx.fillRect(-m(120), m(i * 4), m(240), m(4)); // 4 m mowing stripes
      ctx.restore();
      if (fan) { ectx.save(); pathPoly(ectx, P, S); ectx.lineWidth = m(0.9); ectx.strokeStyle = 'rgb(60,170,140)'; ectx.shadowColor = 'rgb(90,255,200)'; ectx.shadowBlur = m(1.6); ectx.stroke(); ectx.restore(); }
    } else if (g.type === 'Polygon' && k === 'square') {
      const P = ringLocal(g.coordinates[0]);
      ctx.save(); pathPoly(ctx, P, S); ctx.fillStyle = COL.plaza; ctx.fill(); ctx.clip(); ctx.strokeStyle = fan ? 'rgba(120,170,230,.25)' : 'rgba(90,85,70,.28)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < S; i += m(2)) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }
      ctx.restore();
      if (fan) { ectx.save(); pathPoly(ectx, P, S); ectx.lineWidth = m(0.8); ectx.strokeStyle = 'rgb(110,150,255)'; ectx.shadowColor = 'rgb(130,170,255)'; ectx.shadowBlur = m(2); ectx.stroke(); ectx.restore(); }
    }
  }
  // paths: covered walkways and service roads get a paved strip under the props' asphalt (the strip shows at the edges)
  for (const f of feats) {
    const k = f.properties.kind, g = f.geometry;
    if (g.type !== 'LineString') continue;
    const P = g.coordinates.map(([lng, lat]) => { const p = toLocal(lng, lat); return [p.x, p.z]; });
    const w = k === 'footway_covered' ? 2.8 : k === 'road_major' ? 12 : k === 'road' ? 8.5 : 2.4;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = m(w); ctx.strokeStyle = k.startsWith('road') ? (fan ? '#2a3150' : '#8d8b88') : COL.path; pathLine(ctx, P, S); ctx.stroke(); ctx.restore();
    if (fan) { ectx.save(); ectx.lineCap = 'round'; ectx.lineJoin = 'round'; ectx.lineWidth = m(w * 0.22); ectx.strokeStyle = k.startsWith('road') ? 'rgb(70,60,170)' : 'rgb(40,150,190)'; ectx.shadowColor = ectx.strokeStyle; ectx.shadowBlur = m(1.5); pathLine(ectx, P, S); ectx.stroke(); ectx.restore(); }
  }
  if (fan) { // bioluminescent flowers and spores scattered on open ground
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * S, y = rnd() * S, c = ['rgb(60,230,200)', 'rgb(255,120,210)', 'rgb(255,220,120)', 'rgb(120,160,255)'][(rnd() * 4) | 0], r = 1.2 + rnd() * 2.6;
      const g = ectx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ectx.fillStyle = g; ectx.globalAlpha = 0.35 + rnd() * 0.5; ectx.beginPath(); ectx.arc(x, y, r * 3, 0, 6.2832); ectx.fill();
    }
    ectx.globalAlpha = 1;
  }
  const mkTex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 2; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  return { map: mkTex(cv, true), emissive: fan ? mkTex(ev, true) : null };
}

/** Ground material (Lambert: cheap): the painted map + baked-noise grain, a wetness uniform (rain) and, in Fantasy, a glowing map. */
export function groundMaterial(tex, look) {
  const fan = look === 'fantasy';
  const mat = new THREE.MeshLambertMaterial({ map: tex.map, emissive: fan ? 0xffffff : 0x000000, emissiveMap: tex.emissive || null, emissiveIntensity: fan ? 1.2 : 0 });
  const U = { uWet: { value: 0 }, uTime: { value: 0 }, uNoise: { value: noiseTex() } };
  mat.userData.U = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP; uniform float uWet; uniform float uTime; uniform sampler2D uNoise;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
{ vec4 n1 = texture2D(uNoise, vWP.xz*0.0035), n2 = texture2D(uNoise, vWP.xz*0.021), n3 = texture2D(uNoise, vWP.xz*0.17);
  float d = n1.r*0.38 + n2.g*0.34 + n3.b*0.28; diffuseColor.rgb *= 0.66 + 0.68*d; diffuseColor.rgb *= 1.0 - uWet*0.4; }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float fl = texture2D(uNoise, vWP.xz*0.011 + vec2(uTime*0.004, 0.0)).g; totalEmissiveRadiance *= 0.55 + 0.9*fl + 0.25*sin(uTime*1.3 + vWP.x*0.05); }`);
  };
  return mat;
}
