#!/usr/bin/env node
// Cuts the Observatory's map data down to Kolej MARA Kulim (the owner's request, 2026-10-20: "only show Kolej MARA
// Kulim, not other parts, because then it would be too laggy").
//
//   node tools/campus-clip.mjs [in] [out]
//   default in:  prototypes/campus-observatory/data/campus-osm.geojson (the full OpenStreetMap export, unchanged)
//   default out: data/campus-osm.geojson (what the app's map loads)
//
// Rules, from the OSM data only (nothing is added or moved):
//   * every line is clipped to the export's bounds (the box the owner exported around the campus); a line that leaves
//     and re-enters the box becomes several features with the same properties;
//   * a feature is kept only if part of it lies inside the campus outline (kind 'campus', amenity=college), except the
//     main road in front of the gate (kind 'road_major', clipped to the bounds) and the campus gate itself;
//   * the residential area, the neighbourhood names and the shop outside the campus are dropped.
// The bounds stay the same, so the Blender buildings keep their origin.
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const IN = process.argv[2] || path.join(root, 'prototypes/campus-observatory/data/campus-osm.geojson');
const OUT = process.argv[3] || path.join(root, 'data/campus-osm.geojson');

const src = JSON.parse(fs.readFileSync(IN, 'utf8'));
const [X0, Y0, X1, Y1] = src.bounds;
const campusF = src.features.find(f => f.properties.kind === 'campus');
if (!campusF) throw new Error('no campus outline (kind "campus") in ' + IN);
const campus = campusF.geometry.coordinates[0];

const inBox = ([x, y]) => x >= X0 && x <= X1 && y >= Y0 && y <= Y1;
const inside = ([x, y], P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const r7 = v => Math.round(v * 1e7) / 1e7;

/** Liang–Barsky: the part of segment a→b inside the bounds, or null. */
function clipSeg(a, b) {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  for (const [p, q] of [[-dx, a[0] - X0], [dx, X1 - a[0]], [-dy, a[1] - Y0], [dy, Y1 - a[1]]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [[r7(a[0] + t0 * dx), r7(a[1] + t0 * dy)], [r7(a[0] + t1 * dx), r7(a[1] + t1 * dy)]];
}
/** A line clipped to the bounds: a list of runs (each at least two points). */
function clipLine(C) {
  const runs = [];
  let cur = null;
  for (let i = 0; i < C.length - 1; i++) {
    const s = clipSeg(C[i], C[i + 1]);
    if (!s) { if (cur) { runs.push(cur); cur = null; } continue; }
    if (cur && cur[cur.length - 1][0] === s[0][0] && cur[cur.length - 1][1] === s[0][1]) cur.push(s[1]);
    else { if (cur) runs.push(cur); cur = [s[0], s[1]]; }
    if (!inBox(C[i + 1])) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  return runs.filter(r => r.length >= 2 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1] || r.length > 2));
}
/** Points of a line with the segments between them sampled every ~2 m, to test whether a road runs through the campus. */
function samples(C) {
  const out = [];
  for (let i = 0; i < C.length - 1; i++) { const [a, b] = [C[i], C[i + 1]], n = Math.max(1, Math.ceil(Math.hypot((b[0] - a[0]) * 110e3, (b[1] - a[1]) * 110e3) / 2)); for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
  return out.concat([C[C.length - 1]]);
}

const out = [], dropped = [];
for (const f of src.features) {
  const k = f.properties.kind, g = f.geometry;
  const keep = why => out.push(why);
  if (g.type === 'Point') {
    const p = g.coordinates;
    if (inside(p, campus) || (f.properties.barrier === 'gate' && inBox(p))) keep(f); else dropped.push(f.properties.osm);
  } else if (g.type === 'LineString') {
    const runs = clipLine(g.coordinates);
    const kept = runs.filter(r => k === 'road_major' || samples(r).some(p => inside(p, campus)));
    if (!kept.length) { dropped.push(f.properties.osm); continue; }
    for (const r of kept) keep({ type: 'Feature', properties: f.properties, geometry: { type: 'LineString', coordinates: r } });
  } else if (g.type === 'Polygon') {
    const ring = g.coordinates[0];
    if (k === 'campus' || (k !== 'residential' && ring.some(p => inside(p, campus)))) {
      if (!ring.every(inBox)) throw new Error(f.properties.osm + ' reaches outside the bounds; polygons are not clipped');
      keep(f);
    } else dropped.push(f.properties.osm);
  } else dropped.push(f.properties.osm);
}

const res = Object.assign({}, src, {
  source: src.source + '; cut to Kolej MARA Kulim by tools/campus-clip.mjs (lines clipped to the bounds, features outside the campus dropped)',
  features: out,
});
fs.writeFileSync(OUT, JSON.stringify(res));
console.log('kept', out.length, 'features (from', src.features.length + '); dropped', dropped.length + ':', dropped.join(' '));
console.log(OUT, fs.statSync(OUT).size, 'bytes (was', fs.statSync(IN).size + ')');
