// Small geometry helpers on longitude/latitude, in local metres (an equirectangular projection around a point is
// accurate to well under a metre over a campus of about 600 m).
const R = 6371008.8, RAD = Math.PI / 180;

/** Local metres east/north of (lng0, lat0). */
export function toXY([lng, lat], lng0, lat0) {
  return [(lng - lng0) * RAD * R * Math.cos(lat0 * RAD), (lat - lat0) * RAD * R];
}

/** Area-weighted centroid of a closed ring [[lng, lat], …] → {lng, lat, area (m²)}. */
export function centroid(ring) {
  const [lng0, lat0] = ring[0], P = ring.map(p => toXY(p, lng0, lat0));
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const [x1, y1] = P[i], [x2, y2] = P[i + 1], k = x1 * y2 - x2 * y1;
    a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k;
  }
  if (Math.abs(a) < 1e-9) return { lng: lng0, lat: lat0, area: 0 };
  a /= 2; cx /= 6 * a; cy /= 6 * a;
  return { lng: lng0 + cx / (RAD * R * Math.cos(lat0 * RAD)), lat: lat0 + cy / (RAD * R), area: Math.abs(a) };
}

function inRing([x, y], P) {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function segDist([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L)) : 0;
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy);
}

/** Distance (m) from a point to a polygon outline; 0 when the point is inside it. */
export function distToPolygon(pt, rings) {
  const P = rings[0].map(p => toXY(p, pt[0], pt[1]));
  if (inRing([0, 0], P) && !rings.slice(1).some(h => inRing([0, 0], h.map(p => toXY(p, pt[0], pt[1]))))) return 0;
  let d = Infinity;
  for (const ring of rings) {
    const Q = ring.map(p => toXY(p, pt[0], pt[1]));
    for (let i = 0; i < Q.length - 1; i++) d = Math.min(d, segDist([0, 0], Q[i], Q[i + 1]));
  }
  return d;
}

/** The nearest NAMED OSM building or sports area to a point: {name, d (m), inside}. A computed fact, not a survey. */
export function nearestNamed(pt, feats) {
  let best = null;
  for (const f of feats) {
    const p = f.properties;
    if (!p.name || f.geometry.type !== 'Polygon' || !['building', 'sport'].includes(p.kind)) continue;
    const d = distToPolygon(pt, f.geometry.coordinates);
    if (!best || d < best.d) best = { name: p.name, d, inside: d === 0, osm: p.osm };
  }
  return best;
}
