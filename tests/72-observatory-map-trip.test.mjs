// The Observatory's map, part 2 (integration Phase 2; part 1 is tests/71-observatory-map, split to keep each file
// within the 90 s test budget): served over http on a local server, in Chromium with software WebGL (the
// flags of prototypes/campus-observatory/qa/smoke.mjs; slow, so the checks are few and the motion is reduced).
//   * the search on the map filters the markers; a staircase picked there is logged in its Details and the camera stays;
//     a staircase with no coordinates leaves the camera alone;
//   Leaving the page: tests/78-observatory-map-leave.
//   Full screen: tests/74-observatory-fullscreen.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RETURNING, fillSteps } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch { return createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'))('playwright'); } })();
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', geojson: 'application/geo+json', css: 'text/css', webp: 'image/webp', png: 'image/png', woff2: 'font/woff2', webmanifest: 'application/manifest+json', mp3: 'audio/mpeg' };
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

const SEED = { ...RETURNING, s: { ...RETURNING.s, live: 0 } };
const STUB_BUILDINGS = 'export function createModelLayer() { return { id: "models", type: "custom", renderingMode: "3d", onAdd() {}, render() {}, onRemove() {}, replace() {}, get ready() { return false; } }; }';
const STUB = 'export function createViewer() { return { show() { return Promise.resolve(); }, hide() {}, destroy() {}, setMode() {}, setShape() {}, spin() {}, rotateBy() {}, zoomBy() {}, reset() {}, '
  + 'get shape() { return "straight-landing"; }, get spinning() { return false; }, get isOpen() { return true; }, get debug() { return { source: "stub" }; } }; }';
async function openHttp({ viewport, init, route, ctxOpt } = {}) {
  // software WebGL: a small map keeps each frame quick
  const ctx = await browser.newContext({ viewport: viewport || { width: 760, height: 640 }, reducedMotion: 'reduce', serviceWorkers: 'block', ...ctxOpt });
  const page = await ctx.newPage(), errors = [], reqs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('request', r => reqs.push(r.url()));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(SEED));
  if (init) await page.addInitScript(init);
  // the 3D preview has its own tests (75–77); here a do-nothing stand-in keeps the CPU (software WebGL) for the map
  await page.route('**/observatory/viewer3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB }));
  // the Blender buildings have their own tests (79, 80); here a stand-in that never loads keeps the CPU for this file
  await page.route('**/observatory/models3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_BUILDINGS }));
  if (route) await route(page);
  await page.goto(base); await page.waitForSelector('.wl');
  return { ctx, page, errors, reqs };
}
const goView = (page, v) => page.evaluate(v => go(v), v);
// loaded and settled: the first terrain tiles are generated in the browser and take seconds with software WebGL
const ready = page => page.waitForFunction(() => HWCampus.state.map === 'error' || (HWCampus.state.map === 'ready' && HWCampus.map.quietMs > 1000), null, { timeout: 80000 }).then(() => page.evaluate(() => HWCampus.state.map));
// settled: the camera has stopped (map.loaded() can stay false while generated terrain tiles refresh)
const idle = page => page.waitForFunction(() => { const m = HWCampus.map && HWCampus.map.map; return !!m && !m.isMoving(); }, null, { timeout: 20000 }).then(() => page.waitForTimeout(400));
const cam = page => page.evaluate(() => { const m = HWCampus.map.map, c = m.getCenter(); return { lng: c.lng, lat: c.lat, z: m.getZoom() }; });

test('with the map: the search on the map keeps only matching markers; a pick logs in Details and the camera stays; a staircase with no coordinates leaves the camera alone', async () => {
  const { ctx, page, errors } = await openHttp();
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready'); await idle(page);
  const shownMk = () => page.evaluate(() => [...document.querySelectorAll('.stm')].filter(e => !e.hidden).length);
  const all = await shownMk();
  // the search on the map: only the markers that match stay; the matches are offered under the box
  await page.fill('#cmpfind', 'penjana');
  await page.waitForFunction(n => [...document.querySelectorAll('.stm')].filter(e => !e.hidden).length < n, all);
  assert.ok(await shownMk() >= 1, 'the matching marker stays');
  await page.click('#cmpfindres [data-a="cmppick"][data-id="ST20"]'); await idle(page);
  assert.equal(await page.evaluate(() => document.querySelector('.stm.sel').dataset.key), '5.3519878,100.5383771');
  // a pick from the search opens the staircase's stop over the map (tests/88); closing it gives the map back, still picked
  await page.waitForSelector('#cmpstop');
  await page.evaluate(() => acts.cmpstopx());
  await page.waitForFunction(() => !document.getElementById('cmpstop'), null, { timeout: 5000 });
  await page.click('[data-a="cmpzin"]'); await idle(page);
  const c0 = await cam(page);
  // log in Details: the map stays as it was
  assert.deepEqual(await page.evaluate(() => [S.v, HWStairs.pick, !!HWCampus.map]), ['campus', 'ST20', true]);
  await fillSteps(page, '#ss', '10'); await page.fill('#sc', '1'); await page.click('#cmplog [data-a="savestair"]'); await idle(page);
  const c1 = await cam(page);
  assert.ok(Math.abs(c1.lng - c0.lng) < 1e-5 && Math.abs(c1.lat - c0.lat) < 1e-5 && Math.abs(c1.z - c0.z) < .01, 'saving keeps the map view');
  assert.equal(await page.evaluate(() => document.querySelector('.stm.sel').dataset.key), '5.3519878,100.5383771');
  assert.match(await page.textContent('#cmpdet'), /You saved 1 stair session here/);
  // ST02 (no coordinates) from the search: its details, the camera unchanged, nothing highlighted
  await page.fill('#cmpfind', 'ST02');
  await page.click('#cmpfindres [data-a="cmppick"][data-id="ST02"]'); await idle(page);
  const c2 = await cam(page);
  assert.ok(Math.abs(c2.lng - c1.lng) < 1e-5 && Math.abs(c2.z - c1.z) < .01, 'the map does not move');
  assert.equal(await page.locator('.stm.sel').count(), 0);
  assert.match(await page.textContent('#cmpdet'), /No location recorded, so it is not placed on the map\./);
  assert.deepEqual(errors, []);
  await ctx.close();
});
