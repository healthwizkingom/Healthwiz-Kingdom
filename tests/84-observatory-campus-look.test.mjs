// The campus map cut to Kolej MARA Kulim and its buildings in the look of the owner's drone video (2026-10-20):
//   * data/campus-osm.geojson is the prototype's export cut by tools/campus-clip.mjs: every point inside the export's
//     bounds, every feature but the frontage road and the gate touches the campus, nothing outside it (no residential
//     area, no far reaches of the road or river), and every campus building of the export is still there, unchanged;
//   * data/campus-looks.json names only real OSM buildings, every colour is a colour, and every look has a confidence
//     and what was seen (no unlabelled appearance);
//   * assets/models/campus-realistic.glb and campus-fantasy.glb (tools/blender_campus.py) have one node per building and
//     per OSM roof (gazebos and shelters), each at its footprint's centroid, with the confidence of its look.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const osm = json('data/campus-osm.geojson'), full = json('prototypes/campus-observatory/data/campus-osm.geojson'), looks = json('data/campus-looks.json');
const pts = f => f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates.flat();
const inside = ([x, y], P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const campus = osm.features.find(f => f.properties.kind === 'campus').geometry.coordinates[0];
const footprints = g => g.features.filter(f => ['building', 'water_tower', 'roof'].includes(f.properties.kind) && f.geometry.type === 'Polygon');
const CAMPUS_BUILDINGS = footprints(full).filter(f => f.geometry.coordinates[0].some(p => inside(p, campus)));

test('the map data is cut to Kolej MARA Kulim: inside the bounds, touching the campus, every campus building kept unchanged', () => {
  const [X0, Y0, X1, Y1] = osm.bounds;
  assert.deepEqual(osm.bounds, full.bounds, 'the same bounds, so the Blender buildings keep their origin');
  for (const f of osm.features) for (const [x, y] of pts(f)) assert.ok(x >= X0 - 1e-7 && x <= X1 + 1e-7 && y >= Y0 - 1e-7 && y <= Y1 + 1e-7, f.properties.osm + ' reaches outside the bounds');
  for (const f of osm.features) {
    const k = f.properties.kind;
    if (k === 'road_major' || f.properties.barrier === 'gate') continue;
    const P = pts(f), dense = f.geometry.type !== 'LineString' ? P : P.slice(1).flatMap((b, i) => Array.from({ length: 20 }, (_, t) => [P[i][0] + (b[0] - P[i][0]) * t / 20, P[i][1] + (b[1] - P[i][1]) * t / 20]));
    assert.ok(dense.some(p => inside(p, campus)), f.properties.osm + ' (' + k + ') does not touch the campus');
  }
  assert.ok(!osm.features.some(f => f.properties.kind === 'residential'), 'no residential area');
  assert.ok(fs.statSync(path.join(root, 'data/campus-osm.geojson')).size < fs.statSync(path.join(root, 'prototypes/campus-observatory/data/campus-osm.geojson')).size * .75, 'a smaller file');
  const now = new Map(footprints(osm).map(f => [f.properties.osm, f]));
  for (const f of CAMPUS_BUILDINGS) assert.deepEqual(now.get(f.properties.osm), f, f.properties.osm + ' kept, unchanged');
});

test('the looks name real buildings, with colours, a confidence and what was seen', () => {
  const ids = new Set(osm.features.map(f => f.properties.osm));
  const colour = c => /^#[0-9a-f]{6}$/i.test(looks.palette[c] || c);
  assert.ok(/ikraMRahim/.test(looks.about.source) && /permission/.test(looks.about.source), 'the video and its permission are credited');
  for (const [k, v] of Object.entries(looks.palette)) if (k !== 'note') assert.ok(colour(v), k);
  for (const [id, b] of Object.entries(looks.buildings)) {
    assert.ok(ids.has(id), id + ' is an OSM building of the map');
    assert.ok(['high', 'medium'].includes(b.confidence), id + ' has a confidence');
    assert.ok(b.seen && /frames? \d/i.test(b.seen), id + ' says where in the video it was seen');
    for (const c of ['roof', 'wall', 'trim']) if (b[c]) assert.ok(colour(b[c]), id + ' ' + c);
    assert.ok(!b.storeys || Number.isInteger(b.storeys), id + ' storeys');
  }
  assert.equal(looks.default.confidence, 'campus-typical');
});

/** The JSON chunk of a GLB. */
function glb(p) {
  const b = fs.readFileSync(path.join(root, p));
  assert.equal(b.toString('ascii', 0, 4), 'glTF');
  return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
}
test('both looks are modelled: one node per footprint at its centroid, with the confidence of its look', () => {
  const R = 6371008.8, k = Math.PI / 180;
  for (const style of ['realistic', 'fantasy']) {
    const g = glb('assets/models/campus-' + style + '.glb'), ex = g.scenes[0].extras;
    assert.equal(ex.style, style);
    const [x0, y0, x1, y1] = osm.bounds;
    assert.deepEqual([ex.origin_lng, ex.origin_lat], [(x0 + x1) / 2, (y0 + y1) / 2], style + ': the origin is the centre of the bounds');
    const nodes = new Map(g.nodes.filter(n => n.extras && n.extras.osm).map(n => [n.extras.osm, n]));
    const want = footprints(osm);
    assert.equal(nodes.size, want.length, style + ': one node per building, water tower and roof');
    for (const f of want) {
      const n = nodes.get(f.properties.osm);
      assert.ok(n, style + ': ' + f.properties.osm + ' is modelled');
      const looked = looks.buildings[f.properties.osm];
      assert.equal(n.extras.look, looked ? looked.confidence : f.properties.kind === 'roof' ? n.extras.look : 'campus-typical', f.properties.osm + ' look');
      // the node sits at its footprint (within the footprint's own size): metres east/north of the origin, glTF y-up (z south)
      const ring = f.geometry.coordinates[0], lng = ring.reduce((a, p) => a + p[0], 0) / ring.length, lat = ring.reduce((a, p) => a + p[1], 0) / ring.length;
      const ex_ = (lng - ex.origin_lng) * k * R * Math.cos(ex.origin_lat * k), ny = (lat - ex.origin_lat) * k * R;
      assert.ok(Math.hypot(n.translation[0] - ex_, -n.translation[2] - ny) < 25, f.properties.osm + ' is placed on its footprint');
    }
  }
});
