// Fantasy building treatment, generated from each OpenStreetMap footprint (fantasy mode only).
// MapLibre can only extrude flat-topped prisms, so a pitched (hipped) roof is built as a stack of tiers, each one the
// footprint shrunk inward a little and raised a little: a stepped, pixel-art roof that follows the real outline.
// Every part stays inside the footprint (eaves and plinth reach 0.35 m outside it). The parts are decoration:
// wall and roof heights, turrets and chimneys are not measurements and do not show real structures.
import { toXY } from './geo.js';

export const WALL = { dormitory: 13, college: 10, mosque: 7, house: 5, hut: 3, tower: 12 }; // illustrative wall heights (m), same as the map's
const wallH = b => WALL[b] || 6;
const STEP_IN = .75, STEP_UP = .62, MAX_TIERS = 12; // each roof tier: 0.75 m in, 0.62 m up (about 40°)
const R = 6371008.8, RAD = Math.PI / 180;

const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length]; a += x1 * y2 - x2 * y1; } return a / 2; };
function clean(P) { // open ring, no duplicate or nearly collinear points
  const Q = P.slice(0, P[0][0] === P[P.length - 1][0] && P[0][1] === P[P.length - 1][1] ? -1 : undefined);
  const out = [];
  for (let i = 0; i < Q.length; i++) {
    const a = Q[(i - 1 + Q.length) % Q.length], b = Q[i], c = Q[(i + 1) % Q.length];
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < .3 || Math.abs(cr) < .02) continue;
    out.push(b);
  }
  return out.length >= 3 ? out : Q;
}
/** Shift every edge of an open ring to its left by d (miter joins). Outer rings counter-clockwise shrink; holes clockwise grow. */
function offset(P, d) {
  const n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n];
    const e1 = [b[0] - a[0], b[1] - a[1]], e2 = [c[0] - b[0], c[1] - b[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    const n1 = [-e1[1] / l1, e1[0] / l1], n2 = [-e2[1] / l2, e2[0] / l2]; // left normals
    const k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    let m = [(n1[0] + n2[0]) / Math.max(k, .25), (n1[1] + n2[1]) / Math.max(k, .25)]; // miter, capped at sharp corners
    out.push([b[0] + m[0] * d, b[1] + m[1] * d]);
  }
  return out;
}
function segX(p1, p2, p3, p4) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d, u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6;
}
function simple(P) {
  const n = P.length;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return false; }
  return true;
}
const inside = ([x, y], P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

/** osm GeoJSON → FeatureCollection of building parts: {part, base, top, btype}. */
export function makeBuildingParts(osm) {
  const F = [];
  for (const f of osm.features) {
    const p = f.properties;
    if (!(p.kind === 'building' || p.kind === 'water_tower') || f.geometry.type !== 'Polygon') continue;
    const rings = f.geometry.coordinates, [lng0, lat0] = rings[0][0];
    const k = RAD * R * Math.cos(lat0 * RAD);
    const back = P => { const r = P.map(([x, y]) => [lng0 + x / k, lat0 + y / (RAD * R)]); r.push(r[0]); return r; };
    // local metres; outer ring counter-clockwise, holes clockwise
    let rs = rings.map(r => clean(r.map(q => toXY(q, lng0, lat0))));
    rs = rs.map((P, i) => (i === 0) === (area(P) > 0) ? P : P.slice().reverse());
    const btype = p.kind === 'water_tower' ? 'tower' : p.building, H = wallH(btype), A = Math.abs(area(rs[0])) - rs.slice(1).reduce((s, h) => s + Math.abs(area(h)), 0);
    const add = (part, ringsXY, base, top) => F.push({ type: 'Feature', properties: { part, base: +base.toFixed(2), top: +top.toFixed(2), btype }, geometry: { type: 'Polygon', coordinates: ringsXY.map(back) } });
    const grow = d => rs.map(P => offset(P, -d)); // outward: plinth and eaves

    if (btype !== 'tower') add('plinth', grow(.25), 0, 1.0);
    add('eave', grow(.35), H, H + .4);
    // the roof: tiers until the shrunken outline stops being a valid polygon
    let top = H + .4, tiers = 0, last = rs;
    const up = btype === 'tower' ? 1.1 : STEP_UP, inStep = btype === 'tower' ? .45 : STEP_IN;
    for (let t = 1; t <= MAX_TIERS; t++) {
      const cand = rs.map(P => offset(P, inStep * t));
      const ok = cand.every((P, i) => (i === 0 ? area(P) > 2.5 : area(P) < 0) && simple(P)) && cand.slice(1).every(h => h.every(q => inside(q, cand[0])))
        && cand[0].every(q => inside(q, rs[0]));
      if (!ok) break;
      add(t === 1 ? 'roof1' : 'roof', last === rs ? rs : last, top, top + up);
      top += up; last = cand; tiers = t;
    }
    add('ridge', last, top, top + STEP_UP * .7); // the top tier, in lighter slate
    const roofTop = top + STEP_UP * .7;

    if (btype === 'hut' || btype === 'tower' || A < 40) continue;
    // a chimney rising through the roof, 2.5 m in from the first corner that has room
    const P = rs[0];
    for (let i = 0; i < P.length; i++) {
      const c = offset(P, 2.6)[i];
      if (!inside(c, P)) continue;
      const s = .55, sq = [[c[0] - s, c[1] - s], [c[0] + s, c[1] - s], [c[0] + s, c[1] + s], [c[0] - s, c[1] + s]];
      add('chimney', [sq], H, Math.max(H + 2.4, roofTop - 1.2) + 1.3);
      break;
    }
    // the large halls only: one corner turret with a spire (two on the very largest), inside the footprint at convex corners
    if (A < 700 || btype === 'mosque' || btype === 'house') continue;
    const convex = P.map((b, i) => { const a = P[(i - 1 + P.length) % P.length], c = P[(i + 1) % P.length]; return { i, b, cr: (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) }; }).filter(v => v.cr > 0);
    if (convex.length < 2) continue;
    let pair = null, best = 0;
    for (const a of convex) for (const b of convex) { const d = Math.hypot(a.b[0] - b.b[0], a.b[1] - b.b[1]); if (d > best) { best = d; pair = [a, b]; } }
    const inner = offset(P, 1.9);
    for (const v of A > 1500 ? pair : pair.slice(0, 1)) {
      const c = inner[v.i];
      if (!inside(c, P)) continue;
      const oct = r => Array.from({ length: 8 }, (_, j) => [c[0] + r * Math.cos(j * Math.PI / 4 + Math.PI / 8), c[1] + r * Math.sin(j * Math.PI / 4 + Math.PI / 8)]);
      const tTop = roofTop + 2.2;
      add('turret', [oct(1.75)], 0, tTop);
      add('eave', [oct(2.0)], tTop, tTop + .35);
      let z = tTop + .35;
      for (let j = 0; j < 6; j++) { add(j === 5 ? 'ridge' : 'roof', [oct(1.75 * (1 - j / 6))], z, z + .75); z += .75; } // a pointed spire
    }
  }
  return { type: 'FeatureCollection', features: F };
}

/* ---------- covered walkways (both looks) ---------- */
// Every OSM footway tagged covered=yes is drawn as the drone video shows it (frames 1-7, 13, 23, 36-37): a red metal roof
// about 3 m wide at 2.5-2.8 m, on white posts every 4 m along both edges. The line is real; the width, height and post
// spacing are illustrative. Returns {roofs, posts} as GeoJSON for fill-extrusion layers.
export const WALK = { w: 3.0, base: 2.5, top: 2.8, post: .22, every: 4 };
export function makeWalkways(osm) {
  const roofs = [], posts = [];
  const lng0 = (osm.bounds[0] + osm.bounds[2]) / 2, lat0 = (osm.bounds[1] + osm.bounds[3]) / 2;
  const kx = RAD * R * Math.cos(lat0 * RAD), ky = RAD * R;
  const ll = ([x, y]) => [lng0 + x / kx, lat0 + y / ky];
  const quad = (a, ux, uy, l, hw, t0 = 0) => [[a[0] - ux * t0 - uy * hw, a[1] - uy * t0 + ux * hw], [a[0] + ux * (l + t0) - uy * hw, a[1] + uy * (l + t0) + ux * hw],
    [a[0] + ux * (l + t0) + uy * hw, a[1] + uy * (l + t0) - ux * hw], [a[0] - ux * t0 + uy * hw, a[1] - uy * t0 - ux * hw]];
  for (const f of osm.features) {
    if (f.properties.kind !== 'footway_covered' || f.geometry.type !== 'LineString') continue;
    const P = f.geometry.coordinates.map(p => toXY(p, lng0, lat0));
    let carry = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l < .2) continue;
      const ux = (b[0] - a[0]) / l, uy = (b[1] - a[1]) / l;
      // the roof: one slab per segment, lengthened by half a width at each end so the corners close
      const q = quad(a, ux, uy, l, WALK.w / 2, WALK.w / 2).map(ll);
      roofs.push({ type: 'Feature', properties: { osm: f.properties.osm }, geometry: { type: 'Polygon', coordinates: [[...q, q[0]]] } });
      let t = carry; // posts keep their 4 m spacing round the bends
      for (; t <= l; t += WALK.every) {
        for (const s of [-1, 1]) {
          const c = [a[0] + ux * t - uy * s * (WALK.w / 2 - .2), a[1] + uy * t + ux * s * (WALK.w / 2 - .2)];
          const p = quad([c[0] - ux * WALK.post / 2, c[1] - uy * WALK.post / 2], ux, uy, WALK.post, WALK.post / 2).map(ll);
          posts.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...p, p[0]]] } });
        }
      }
      carry = t - l;
    }
  }
  return { roofs: { type: 'FeatureCollection', features: roofs }, posts: { type: 'FeatureCollection', features: posts } };
}
