// Illustrative campus terrain. data/elevation-zones.geojson outlines two raised areas (traced from the owner's annotated
// screenshot) with ILLUSTRATIVE heights. This module turns them into a height map the map drapes everything on:
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
  function outward(z, dist) { // the outline pushed outward by dist metres (per-vertex normal offset)
    const P = z.P.slice(0, -1), n = P.length;
    let area = 0; for (let i = 0; i < n; i++) { const [a, b] = P[i], [c, d] = P[(i + 1) % n]; area += a * d - c * b; }
    const s = area > 0 ? 1 : -1; // counter-clockwise: outward is to the right of each edge
    const out = P.map((p, i) => {
      const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
      let nx = (b[1] - a[1]) * s, ny = -(b[0] - a[0]) * s; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      return [p[0] + nx * dist, p[1] + ny * dist];
    });
    out.push(out[0]);
    const R = 6371008.8, k = Math.PI / 180;
    return out.map(([x, y]) => [lng0 + x / (k * R * Math.cos(lat0 * k)), lat0 + y / (k * R)]);
  }
  /** Distance outside the outline (m) where the gentle slope reaches height h: solve H·smooth(1 − d/W) = h. */
  function distAt(z, h) {
    let lo = 0, hi = 1; // t = 1 − d/W, smooth(t) rises from 0 to 1
    for (let i = 0; i < 30; i++) { const t = (lo + hi) / 2; if (z.H * smooth(t) < h) lo = t; else hi = t; }
    return (1 - (lo + hi) / 2) * z.W;
  }
  const STEP = 3; // illustrative contour interval, metres
  function overlays() {
    const F = [];
    for (const z of Z) {
      const p = z.f.properties;
      F.push({ type: 'Feature', properties: { zkind: 'top', level: p.level }, geometry: { type: 'Polygon', coordinates: [z.ring] } });
      F.push({ type: 'Feature', properties: { zkind: 'edge', level: p.level }, geometry: { type: 'LineString', coordinates: z.ring } });
      for (let h = STEP; h < z.H; h += STEP) F.push({ type: 'Feature', properties: { zkind: 'contour', level: p.level, h }, geometry: { type: 'LineString', coordinates: outward(z, distAt(z, h)) } });
    }
    return { type: 'FeatureCollection', features: F };
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
