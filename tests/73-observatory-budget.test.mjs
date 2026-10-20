// The Observatory's downloads (integration plan, "Asset budget"): the vendored libraries (vendor/) and the 3D models
// (assets/models/) are outside the assets/img/ budget of tests/24-performance and have their own, set at the committed
// size plus 10 %. They load only on the campus page and are cached by the service worker on first use, so they are
// never in the install-time precache or in index.html.
//   Phase 2 (2026-10-20): vendor/ = MapLibre GL JS 4.7.1 (maplibre-gl.js 803,086 + maplibre-gl.css 65,534 +
//   LICENSE.txt 5,984 = 874,604 bytes) → budget 962,064. assets/models/ does not exist yet (the models come with the
//   3D preview and the fantasy buildings) → budget 0; raise it when they are committed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUDGET = { vendor: 962064, 'assets/models': 0 };
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
});
