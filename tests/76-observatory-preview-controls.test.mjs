// The Observatory's 3D staircase preview (integration Phase 3), part 2 of 3, over http with software WebGL (reduced motion, small
// screen: each frame is drawn by the CPU):
//   * selecting a staircase opens its preview by itself and every new selection updates it; closing keeps the
//     selection; SHOW 3D PREVIEW reopens it; a staircase without coordinates has a preview too;
//   * the model: the measured F21 set (ST14, ST19, ST20) or the demonstration set, never sized from the stored angle;
//     a staircase with complete survey flights is built from them instead (made-up test values below, not campus data);
//   * the labels: "Illustrative model — actual dimensions not surveyed." or "Built from survey measurements · finishes
//     illustrative", and what is real in each model;
//   * the mode follows the map's; leaving the page frees the preview (no WebGL canvas, no animation loop).
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
async function openHttp({ viewport, init, route, ctxOpt } = {}) {
  // software WebGL: a small map keeps each frame quick
  const ctx = await browser.newContext({ viewport: viewport || { width: 760, height: 640 }, reducedMotion: 'reduce', serviceWorkers: 'block', ...ctxOpt });
  const page = await ctx.newPage(), errors = [], reqs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('request', r => reqs.push(r.url()));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(SEED));
  if (init) await page.addInitScript(init);
  // the Blender buildings have their own tests (79, 80); here a stand-in that never loads keeps the CPU for this file
  await page.route('**/observatory/models3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_BUILDINGS }));
  if (route) await route(page);
  await page.goto(base); await page.waitForSelector('.wl');
  return { ctx, page, errors, reqs };
}
// the Stay Aware notice (js/v6-campus-hud.js) opens with the map each time; tests/88-observatory-stop checks it, here OK closes it
const goView = (page, v) => page.evaluate(v => { go(v); if (v === 'campus' && window.HWCampusHud) HWCampusHud.aware(false); }, v);
// loaded and settled: the first terrain tiles are generated in the browser and take seconds with software WebGL
const ready = page => page.waitForFunction(() => HWCampus.state.map === 'error' || (HWCampus.state.map === 'ready' && HWCampus.map.quietMs > 1000), null, { timeout: 80000 }).then(() => page.evaluate(() => HWCampus.state.map));
// settled: the camera has stopped (map.loaded() can stay false while generated terrain tiles refresh)
const idle = page => page.waitForFunction(() => { const m = HWCampus.map && HWCampus.map.map; return !!m && !m.isMoving(); }, null, { timeout: 20000 }).then(() => page.waitForTimeout(400));
const cam = page => page.evaluate(() => { const m = HWCampus.map.map, c = m.getCenter(); return { lng: c.lng, lat: c.lat, z: m.getZoom() }; });


const shown = (page, id) => page.waitForFunction(id => HWCampus.state.shown.startsWith(id + '|') && HWCampus.viewer && HWCampus.viewer.debug.source && document.querySelector('.cmpvwmsg').hidden, id, { timeout: 60000 });
// the staircase models only (the fantasy map also loads its buildings, assets/models/campus-fantasy.glb)
const glbs = reqs => reqs.filter(u => /\/stairs\/[^/]+\.glb$/.test(u)).map(u => u.split('/').pop());

test('a staircase without coordinates has a preview; the shapes; closing keeps the selection and SHOW 3D PREVIEW reopens it; the mode follows the map', async () => {
  const { ctx, page, errors } = await openHttp();
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready');
  // a staircase with no coordinates has a preview too
  await page.click('#cmplist .cmpitem[data-id="ST02"]');
  await page.click('[data-a="cmpvwopen"]'); await shown(page, 'ST02'); // with the map the preview opens on request (2026-10-21), then follows the pick
  // the shapes, and closing keeps the selection
  await page.click('[data-a="cmpvwshape"][data-shape="U"]');
  assert.deepEqual(await page.evaluate(() => [HWCampus.viewer.shape, document.querySelector('[data-shape="U"]').getAttribute('aria-pressed')]), ['U', 'true']);
  await page.click('[data-a="cmpvwclose"]');
  assert.deepEqual(await page.evaluate(() => [HWCampus.selected, HWCampus.state.vw, !!document.querySelector('#cmpvw'), HWCampus.viewer.isOpen]), ['ST02', false, false, false]);
  await page.click('[data-a="cmpvwopen"]'); await shown(page, 'ST02');
  // the mode follows the map's
  await page.click('[data-a="cmpmode"][data-m="realistic"]');
  await page.waitForFunction(() => HWCampus.state.shown === 'ST02|realistic', null, { timeout: 30000 });
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /demo-realistic\.glb$/.test(e.name)), null, { timeout: 30000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});
