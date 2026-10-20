// Decorative trees for fantasy mode. They are scenery, not data: placed by a fixed pseudo-random pattern on open ground,
// never on a building, field, square, road or walkway, and never near a staircase marker. Denser outside the campus.
import { toXY } from './geo.js';

function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

export function makeTrees(osm, points) {
  const [x0, y0, x1, y1] = osm.bounds, lng0 = (x0 + x1) / 2, lat0 = (y0 + y1) / 2;
  const L = p => toXY(p, lng0, lat0);
  const polys = [], segs = [];
  let campus = null;
  for (const f of osm.features) {
    const k = f.properties.kind, g = f.geometry;
    if (g.type === 'Polygon') {
      const P = g.coordinates[0].map(L);
      if (k === 'campus') campus = P;
      else if (['building', 'sport', 'square', 'roof', 'water_tower'].includes(k)) polys.push({ P, pad: k === 'building' || k === 'roof' ? 7 : 3 });
    } else if (g.type === 'LineString') {
      const P = g.coordinates.map(L), pad = k === 'road_major' ? 12 : k === 'water' ? 6 : k.startsWith('road') ? 8 : 5;
      for (let i = 0; i < P.length - 1; i++) segs.push({ a: P[i], b: P[i + 1], pad });
    }
  }
  const marks = points.map(L);
  const inside = ([x, y], P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const segD = ([x, y], [ax, ay], [bx, by]) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l)) : 0; return Math.hypot(x - ax - t * dx, y - ay - t * dy); };
  const nearPoly = (p, P, pad) => { if (inside(p, P)) return true; for (let i = 0; i < P.length - 1; i++) if (segD(p, P[i], P[i + 1]) < pad) return true; return false; };

  const r = rng(97), out = [], step = 9;
  const [ax, ay] = L([x0, y0]), [bx, by] = L([x1, y1]);
  for (let y = ay; y < by; y += step) for (let x = ax; x < bx; x += step) {
    const p = [x + (r() - .5) * step * .9, y + (r() - .5) * step * .9], inCampus = campus && inside(p, campus);
    if (r() > (inCampus ? .16 : .62)) continue;
    if (marks.some(m => Math.hypot(m[0] - p[0], m[1] - p[1]) < 16)) continue;
    if (segs.some(s => segD(p, s.a, s.b) < s.pad)) continue;
    if (polys.some(q => nearPoly(p, q.P, q.pad))) continue;
    const u = r(), t = inCampus ? (u < .35 ? 'px-tree-glow' : u < .7 ? 'px-tree-oak' : 'px-tree-pine') : (u < .5 ? 'px-tree-pine' : u < .94 ? 'px-tree-oak' : 'px-tree-glow');
    const R = 6371008.8, k = Math.PI / 180;
    out.push({ type: 'Feature', properties: { t, s: .85 + r() * .35 }, geometry: { type: 'Point', coordinates: [lng0 + p[0] / (k * R * Math.cos(lat0 * k)), lat0 + p[1] / (k * R)] } });
  }
  return { type: 'FeatureCollection', features: out };
}
