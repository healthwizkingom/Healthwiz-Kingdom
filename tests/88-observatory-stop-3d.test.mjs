// Split from 88-observatory-stop.test.mjs so each file stays inside the 90 s per-file limit (software WebGL is slow). 
// The staircase stop (owner's request, 2026-10-21, after a Pokestop), and the Details right below the map:
//   * the heart: one Blender sprite sheet (tools/art/make_heart_sprite.py), lossless, 16 frames of 40 x 40 px, white and grey
//     (the map tints it with the difficulty colour; the greys are checked in the browser below), precached;
//   * the Campus page: nothing between the map and the Details; the Details card starts with the stair illustration and
//     has the logging forms and the rest below it, in the same card; ALL STAIRCASES is at the end;
//   * over http: every staircase is a heart spinning on a post in its difficulty colour; tapping one zooms the stop's disc
//     out of it: the name, ID and difficulty, and an empty photo frame (no photo has been taken, none is made up); the
//     Details pop up below the map; closing shrinks the disc away and keeps the selection; on a phone every map button,
//     full screen included, is on screen; with reduced motion the hearts stand still;
//   * the stops as solid 3D models (owner's request, 2026-10-21: "not see through to building, but solid model like
//     pokestop"): the Blender stop (assets/models/heart-stop.glb) in a 3D layer sharing the map's depth buffer, one per
//     marker, coloured by difficulty, standing where the marker (the tap target) stands; the markers' drawn hearts hidden;
//     the selected heart spins (never with reduced motion); a slight glow in the difficulty colour (a halo and a pool of
//     light, depth-tested like the stop); if the model cannot load, the drawn hearts stay.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, RETURNING, dismissAware } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function until(page, fn, ms) { const t = Date.now(); for (;;) { if (await page.evaluate(fn)) return; if (Date.now() - t > ms) throw new Error('timed out: ' + fn); await new Promise(r => setTimeout(r, 300)); } }

after(closeBrowser);
/* ---------- over http, with the map ---------- */
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch { return createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'))('playwright'); } })();
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', geojson: 'application/geo+json', css: 'text/css', webp: 'image/webp', png: 'image/png', woff2: 'font/woff2', webmanifest: 'application/manifest+json', mp3: 'audio/mpeg', glb: 'model/gltf-binary' };
let server, base, browser;
before(async () => {
  server = http.createServer((q, res) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, path.normalize(p));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
});
after(async () => { if (browser) await browser.close(); await new Promise(r => server.close(r)); });
const STUB_BUILDINGS = 'export function createModelLayer() { return { id: "models", type: "custom", renderingMode: "3d", onAdd() {}, render() {}, onRemove() {}, replace() {}, light() {}, get ready() { return false; } }; }';
const STUB_VIEWER = 'export function createViewer() { return { show() { return Promise.resolve(); }, hide() {}, destroy() {}, setMode() {}, setShape() {}, spin() {}, rotateBy() {}, zoomBy() {}, reset() {}, get shape() { return "straight-landing"; }, get spinning() { return false; }, get isOpen() { return true; }, get debug() { return { source: "stub" }; } }; }';

test('the solid 3D stops: one per marker, in the difficulty colour, on the marker\'s ground, depth-tested; the drawn hearts hidden; the selected one spins', async () => {
  const glb = fs.readFileSync(path.join(root, 'assets/models/heart-stop.glb'));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  const j = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
  assert.deepEqual(j.nodes.map(n => n.name).sort(), ['body', 'tint', 'white'], 'the owner\'s Pokestop heart (2026-10-23): the prism that morphs into the disc, the tinted inner circle and rim, the white heart and orbit');
  assert.ok(j.accessors.filter(x => x.type === 'SCALAR' && x.componentType >= 5123).reduce((t, x) => t + x.count, 0) / 3 < 2000, 'light: under 2,000 triangles in all');
  assert.ok(glb.length < 120000, 'small: ' + glb.length);
  const ctx = await browser.newContext({ viewport: { width: 800, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  await page.route('**/observatory/models3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_BUILDINGS }));
  await page.route('**/observatory/viewer3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_VIEWER }));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify({ ...RETURNING, s: { ...RETURNING.s, live: 0 } }));
  await page.goto(base); await page.waitForSelector('.wl');
  await page.evaluate(() => go('campus')); await dismissAware(page); // OK on the Stay Aware notice
  await until(page, () => HWCampus.state.map === 'ready' && HWCampus.map.stops && HWCampus.map.stops.ready, 80000);
  const r = await page.evaluate(() => { const C = HWCampus.map, d = C.stops.debug, map = C.map, c = map.getContainer();
    const hex = x => '#' + x.getHexString();
    const one = d.list.find(s => s.g.visible) || d.list[0];
    return { n: d.list.length, keys: d.list.every(s => !!document.querySelector('.stm[data-key="' + s.key + '"]')), st3d: c.classList.contains('st3d'),
      hidden: getComputedStyle(document.querySelector('.stm .hstop')).visibility, layer: map.getLayer('stops3d') && map.getLayer('stops3d').type,
      mode: C.stops.renderingMode, colours: [1, 2, 3].map(k => hex(d.mats[k].color)), depth: Object.values(d.mats).every(m => m.depthTest && m.depthWrite && !m.transparent),
      glow: [d.glow, d.pool].map(G => [1, 2, 3].map(k => G[k] && hex(G[k].color) === hex(d.mats[k].color) && G[k].depthTest && !G[k].depthWrite && G[k].opacity > 0).every(Boolean)),
      emissive: [1, 2, 3].every(k => d.mats[k].emissive.getHex() !== 0),
      cats: d.list.map(s => s.cat).every(k => [1, 2, 3].includes(k)), dx: Math.abs(one.g.position.y - (map.queryTerrainElevation([one.lng, one.lat]) || 0)) };
  });
  assert.equal(r.n, 25); assert.ok(r.keys, 'one per marker'); assert.ok(r.st3d); assert.equal(r.hidden, 'hidden', 'the drawn hearts are hidden');
  assert.equal(r.layer, 'custom'); assert.equal(r.mode, '3d', 'shares the depth buffer with the buildings');
  assert.deepEqual(r.colours, ['#7ee07c', '#f6c94f', '#ff7b6e'], 'Mild, Moderate, Vigorous');
  assert.ok(r.depth, 'solid and depth-tested: a building in front hides it'); assert.ok(r.cats);
  assert.deepEqual(r.glow, [true, true], 'a halo and a pool of light in the difficulty colour, hidden by buildings in front too'); assert.ok(r.emissive, 'the hearts light themselves a little');
  assert.ok(r.dx < .01, 'on the ground the marker stands on');
  // selected: the same fixed size on screen (owner's request, 2026-10-23); with reduced motion not spinning; with motion allowed it spins
  await page.evaluate(() => document.querySelector('.stm[data-id="ST20"]').click());
  await page.waitForSelector('#cmpstop');
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => { const L = HWCampus.map.stops.debug.list.filter(s => s.g.visible), k = HWCampus.map.stops.debug.list.find(s => s.key === HWCampus.map.map.getContainer().querySelector('.stm.sel').dataset.key);
    return !!k && L.every(s => Math.abs(s.g.scale.x - k.g.scale.x) < 1e-9); }), 'the selected stop is not enlarged');
  assert.equal(await page.evaluate(() => HWCampus.map.stops.spinning), false, 'reduced motion: still');
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.evaluate(() => HWCampus.map.setReduced());
  assert.equal(await page.evaluate(() => HWCampus.map.stops.spinning), true, 'the selected heart spins');
  // the animation is played by the vertex shader, one instance per stop: a start offset and a switch for each, the selected one always playing
  assert.deepEqual(await page.evaluate(() => { const d = HWCampus.map.stops.debug, g = d.built.white.geometry.attributes, k = d.list.findIndex(s => s.key === document.querySelector('.stm.sel').dataset.key);
    return [Object.keys(g).includes('aPart') && Object.keys(g).includes('aPhase') && Object.keys(g).includes('aAnim'), g.aAnim.array[k], new Set(Array.from(g.aPhase.array).map(v => v.toFixed(3))).size > 5]; }), [true, 1, true], 'per-stop start offsets; the selected stop plays');
  await page.evaluate(() => acts.cmpstopx()); await until(page, () => !document.getElementById('cmpstop'), 5000);
  assert.deepEqual(errors, []);
  await ctx.close();
});
