// Illustrative campus terrain. data/elevation-zones.geojson outlines the raised levels (which area is higher: the owner's
// annotated screenshot; where the slopes start and end: estimated from the drone video and the staircase list) with
// ILLUSTRATIVE heights. This module turns them into a height map the map drapes everything on:
// a flat base, and for each zone a gentle rise (smooth, over slopeWidth_m metres) up to a flat top. No cliffs.
// The height map is generated in the browser as Terrarium-encoded PNG tiles behind a custom URL scheme, so no server
// or elevation service is used. Coordinates never change: only the ground under them rises.
import { toXY } from './geo.js';

const SCHEME = 'hwzones';
const smooth = t => t * t * (3 - 2 * t);

/** zonesFC: the zones GeoJSON → terrain controller. */
export function createTerrain(zonesFC) {
  const feats = zonesFC.features.filter(f => f.geometry && f.geometry.type === 'Polygon');
  // work in local metres around the first zone's first point
  const [lng0, lat0] = feats.length ? feats[0].geometry.coordinates[0][0] : [0, 0];
  const Z = feats.map(f => {
    const ring = f.geometry.coordinates[0], P = ring.map(p => toXY(p, lng0, lat0));
    const H = +f.properties.illustrativeHeight_m || 0, W = Math.max(1, +f.properties.slopeWidth_m || 8);
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    return { f, ring, P, H, W, box: [Math.min(...xs) - W, Math.min(...ys) - W, Math.max(...xs) + W, Math.max(...ys) + W] };
  });

  /** Signed distance (m) from a local point to a zone outline: negative inside. */
  function sdist(z, x, y) {
    let inside = false, d = Infinity;
    const P = z.P;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
      const dx = xi - xj, dy = yi - yj, L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((x - xj) * dx + (y - yj) * dy) / L)) : 0;
      d = Math.min(d, Math.hypot(x - xj - t * dx, y - yj - t * dy));
    }
    return inside ? -d : d;
  }
  /** Illustrative height (m) at a local point: the highest zone that reaches it. The slope runs from the outline outward. */
  function hLocal(x, y) {
    let h = 0;
    for (const z of Z) {
      if (x < z.box[0] || x > z.box[2] || y < z.box[1] || y > z.box[3]) continue;
      const d = sdist(z, x, y);
      const v = d <= 0 ? z.H : d < z.W ? z.H * smooth(1 - d / z.W) : 0;
      if (v > h) h = v;
    }
    return h;
  }
  const heightAt = (lng, lat) => hLocal(...toXY([lng, lat], lng0, lat0));
  /** The zone a point lies in (inside its outline), or null. */
  function zoneAt(lng, lat) {
    const [x, y] = toXY([lng, lat], lng0, lat0);
    let best = null;
    for (const z of Z) if (sdist(z, x, y) <= 0 && (!best || z.H > best.H)) best = z;
    return best ? best.f.properties : null;
  }

  /* ---------- the height map as Terrarium PNG tiles ---------- */
  const cache = new Map();
  let flat = null;
  const lngOf = (x, z) => x / 2 ** z * 360 - 180;
  const latOf = (y, z) => { const n = Math.PI - 2 * Math.PI * y / 2 ** z; return 180 / Math.PI * Math.atan(Math.sinh(n)); };
  function canvas(n) {
    if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(n, n);
    const c = document.createElement('canvas'); c.width = c.height = n; return c;
  }
  async function png(c) {
    const blob = c.convertToBlob ? await c.convertToBlob({ type: 'image/png' }) : await new Promise(r => c.toBlob(r, 'image/png'));
    return blob.arrayBuffer();
  }
  async function tile(z, x, y) {
    const key = z + '/' + x + '/' + y;
    if (cache.has(key)) return cache.get(key);
    const N = 256, w0 = lngOf(x, z), w1 = lngOf(x + 1, z), n0 = latOf(y, z), s0 = latOf(y + 1, z);
    // tiles that miss every zone (with its slope) are the shared flat tile
    const hit = Z.some(q => { const [a, b] = toXY([w0, n0], lng0, lat0), [c, d] = toXY([w1, s0], lng0, lat0); return !(c < q.box[0] || a > q.box[2] || b < q.box[1] || d > q.box[3]); });
    if (!hit && flat) return flat;
    const cv = canvas(N), g = cv.getContext('2d'), img = g.createImageData(N, N), D = img.data;
    for (let py = 0; py < N; py++) {
      const lat = latOf(y + (py + .5) / N, z);
      for (let px = 0; px < N; px++) {
        const lng = lngOf(x + (px + .5) / N, z);
        const h = hit ? heightAt(lng, lat) : 0, v = h + 32768, i = (py * N + px) * 4;
        D[i] = Math.floor(v / 256); D[i + 1] = Math.floor(v) % 256; D[i + 2] = Math.floor((v - Math.floor(v)) * 256); D[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const buf = await png(cv);
    if (!hit) flat = buf;
    cache.set(key, buf);
    return buf;
  }
  function register(ML) {
    ML.addProtocol(SCHEME, async params => {
      const m = /:\/\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
      if (!m) throw new Error('bad terrain tile ' + params.url);
      return { data: (await tile(+m[1], +m[2], +m[3])).slice(0) };
    });
  }

  /* ---------- draped overlays: the zone top, its edge, illustrative contour lines, and label points ---------- */
  /* ---------- illustrative contour lines, traced from the height field itself (marching squares), so terraces and the
     banks between levels get the right lines where two levels meet ---------- */
  const STEP = 2, CELL = 2.5; // contour interval and grid spacing, metres
  function contours() {
    if (!Z.length) return [];
    const bx = [Math.min(...Z.map(z => z.box[0])), Math.min(...Z.map(z => z.box[1])), Math.max(...Z.map(z => z.box[2])), Math.max(...Z.map(z => z.box[3]))];
    const nx = Math.ceil((bx[2] - bx[0]) / CELL) + 1, ny = Math.ceil((bx[3] - bx[1]) / CELL) + 1, H = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) H[j * nx + i] = hLocal(bx[0] + i * CELL, bx[1] + j * CELL);
    const top = Math.max(...Z.map(z => z.H)), out = [];
    const R0 = 6371008.8, k = Math.PI / 180, ll = ([x, y]) => [+(lng0 + x / (k * R0 * Math.cos(lat0 * k))).toFixed(7), +(lat0 + y / (k * R0)).toFixed(7)];
    for (let L = STEP; L < top; L += STEP) {
      const segs = [];
      const P = (i, j, i2, j2) => { const a = H[j * nx + i], b = H[j2 * nx + i2], t = (L - a) / (b - a); return [bx[0] + (i + (i2 - i) * t) * CELL, bx[1] + (j + (j2 - j) * t) * CELL]; };
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const c = (H[j * nx + i] >= L ? 1 : 0) | (H[j * nx + i + 1] >= L ? 2 : 0) | (H[(j + 1) * nx + i + 1] >= L ? 4 : 0) | (H[(j + 1) * nx + i] >= L ? 8 : 0);
        if (c === 0 || c === 15) continue;
        const s = P(i, j, i + 1, j), e = P(i + 1, j, i + 1, j + 1), n = P(i, j + 1, i + 1, j + 1), w = P(i, j, i, j + 1);
        const E = { 1: [[w, s]], 2: [[s, e]], 3: [[w, e]], 4: [[e, n]], 5: [[w, n], [s, e]], 6: [[s, n]], 7: [[w, n]], 8: [[n, w]], 9: [[n, s]], 10: [[s, w], [n, e]], 11: [[n, e]], 12: [[e, w]], 13: [[e, s]], 14: [[s, w]] }[c];
        segs.push(...E);
      }
      // join the cell segments into lines
      const key = p => p[0].toFixed(2) + ',' + p[1].toFixed(2), at = new Map();
      segs.forEach((sg, x) => { for (const p of sg) { const q = key(p); (at.get(q) || at.set(q, []).get(q)).push(x); } });
      const used = new Uint8Array(segs.length);
      for (let x = 0; x < segs.length; x++) {
        if (used[x]) continue; used[x] = 1;
        const line = [segs[x][0], segs[x][1]];
        for (const dir of [1, 0]) {
          for (;;) {
            const end = dir ? line[line.length - 1] : line[0], nxt = (at.get(key(end)) || []).find(y => !used[y]);
            if (nxt == null) break;
            used[nxt] = 1; const sg = segs[nxt], p = key(sg[0]) === key(end) ? sg[1] : sg[0];
            dir ? line.push(p) : line.unshift(p);
          }
        }
        if (line.length < 3) continue;
        // the level whose rise makes this line (for its colour): the zone that gives the most height at its middle point
        const m = line[line.length >> 1]; let lv = null, best = -1;
        for (const z of Z) { if (m[0] < z.box[0] || m[0] > z.box[2] || m[1] < z.box[1] || m[1] > z.box[3]) continue; const d = sdist(z, m[0], m[1]), v = d <= 0 ? z.H : d < z.W ? z.H * smooth(1 - d / z.W) : 0; if (v > best) { best = v; lv = z.f.properties.level; } }
        out.push({ type: 'Feature', properties: { zkind: 'contour', level: lv || 'middle', h: L, major: L % 10 === 0 }, geometry: { type: 'LineString', coordinates: line.map(ll) } });
      }
    }
    return out;
  }
  function overlays() {
    const F = [];
    for (const z of Z) {
      const p = z.f.properties;
      F.push({ type: 'Feature', properties: { zkind: 'top', level: p.level }, geometry: { type: 'Polygon', coordinates: [z.ring] } });
      F.push({ type: 'Feature', properties: { zkind: 'edge', level: p.level }, geometry: { type: 'LineString', coordinates: z.ring } });
    }
    return { type: 'FeatureCollection', features: F.concat(contours()) };
  }
  /** Where each zone's label goes: the middle zone above its northern edge, the highest zone off its western side. */
  function labels() {
    return Z.map(z => {
      const p = z.f.properties, r = z.ring;
      const pt = p.level === 'highest' ? r.reduce((a, b) => b[0] < a[0] ? b : a) : r.reduce((a, b) => b[1] > a[1] ? b : a);
      return { lng: pt[0], lat: pt[1], name: p.name, region: p.region, level: p.level, H: z.H, anchor: p.level === 'highest' ? 'right' : 'bottom' };
    });
  }

  return {
    url: SCHEME + '://{z}/{x}/{y}', register, heightAt, zoneAt, overlays, labels,
    zones: Z.map(z => z.f.properties),
  };
}
