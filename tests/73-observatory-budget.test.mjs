// The Observatory's downloads (integration plan, "Asset budget"): the vendored libraries (vendor/) and the 3D models
// (assets/models/) are outside the assets/img/ budget of tests/24-performance and have their own, set at the committed
// size plus 10 %. They load only on the campus page and are cached by the service worker on first use, so they are
// never in the install-time precache or in index.html.
//   Phase 2 (2026-10-20): vendor/maplibre-gl = MapLibre GL JS 4.7.1 (maplibre-gl.js 803,086 + maplibre-gl.css 65,534 +
//   LICENSE.txt 5,984 = 874,604 bytes).
//   Phase 3 (2026-10-20): vendor/three = Three.js r169 and the preview's add-ons (896,543 bytes, from
//   tools/vendor-three.mjs); vendor/ is 1,771,147 bytes → budget 1,948,262. assets/models/stairs = the prototype's
//   Blender staircases (8 sets × style + pedestals, 5,537,184 bytes).
//   Phase 4 (2026-10-20): + assets/models/campus-fantasy.glb, the prototype's Blender buildings (1,696,300 bytes):
//   assets/models/ was 7,233,484 bytes.
//   Phase 5 (2026-10-20): + assets/models/avatars/ (tom.glb 1,141,324, schoolboy.glb 1,058,460, schoolgirl.glb 1,195,696 and
//   CREDITS.md): assets/models/ is 10,630,767 bytes → budget 11,693,844.
//   Drone-video look (2026-10-20): campus-fantasy.glb rebuilt by tools/blender_campus.py (1,876,044 bytes) and
//   + campus-realistic.glb (860,160 bytes): assets/models/ is 11,670,671 bytes, inside the unchanged budget.
//   Ground details (owner's request, 2026-10-20: goal posts, car parks, street lights, drains, roads, modelled in Blender):
//   + campus-props-realistic.glb and campus-props-fantasy.glb (tools/blender_campus_props.py, 239,324 bytes each):
//   assets/models/ is 12,149,319 bytes → budget 13,364,250 (+ 10 %).
//   Owner's request, 2026-10-23 (the owner's model packs): the Fantasy buildings as medieval houses and a castle
//   (campus-fantasy.glb 3,020,208 bytes, tools/blender_campus.py with tools/blender_medieval_kit.py), the trees as 3D oaks
//   (+ campus-trees.glb 188,096, tools/blender_campus_trees.py) and the stop from the owner's drawing (heart-stop.glb
//   42,616): assets/models/ was 12,984,099 bytes, inside the then budget.
//   Owner's request, 2026-10-23 (grey houses back to the blue-roofed generated buildings, castle and red-roofed houses kept):
//   campus-fantasy.glb is 3,020,208 bytes (the generated buildings again, 2.3 MB, plus the castle and three houses):
//   assets/models/ is 13,688,027 bytes → budget 15,056,830 (+ 10 %).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET = { vendor: 1948262, 'assets/models': 15056831 };
const files = dir => { const d = path.join(root, dir); if (!fs.existsSync(d)) return []; return fs.readdirSync(d, { recursive: true }).map(f => path.join(dir, f)).filter(f => fs.statSync(path.join(root, f)).isFile()); };
const size = dir => files(dir).reduce((t, f) => t + fs.statSync(path.join(root, f)).size, 0);

test('vendor/ and assets/models/ stay within their budgets (committed size + 10 %)', () => {
  for (const [dir, max] of Object.entries(BUDGET)) assert.ok(size(dir) <= max, dir + ' is ' + size(dir).toLocaleString('en') + ' bytes; budget ' + max.toLocaleString('en'));
});

test('none of them is precached at install or loaded by index.html: they come only with the campus page', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), pre = sw.slice(sw.indexOf('const PRECACHE = ['), sw.indexOf('];', sw.indexOf('const PRECACHE')));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const dir of [...Object.keys(BUDGET), 'observatory']) {
    assert.ok(!pre.includes(dir + '/'), dir + '/ is not in the install-time precache');
    assert.ok(!html.includes(dir + '/'), dir + '/ is not referenced by index.html');
  }
  assert.ok(files('vendor').some(f => /maplibre-gl[\\/]LICENSE\.txt$/.test(f)), 'the MapLibre licence ships with it');
  assert.ok(files('vendor').some(f => /three[\\/]LICENSE$/.test(f)), 'the Three.js licence ships with it');
  assert.ok(fs.existsSync(path.join(root, 'assets/models/avatars/CREDITS.md')) && /suzuart[\s\S]*CC BY 4\.0[\s\S]*suzuart/.test(fs.readFileSync(path.join(root, 'assets/models/avatars/CREDITS.md'), 'utf8')), 'the CC BY avatars carry their credits');
  assert.ok(!files('vendor/three').some(f => /\.js$/.test(f) && /from\s*['"]three['"]/.test(fs.readFileSync(path.join(root, f), 'utf8'))), 'no bare "three" import (there is no import map)');
});
