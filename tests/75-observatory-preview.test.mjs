// The Observatory's 3D staircase preview (integration Phase 3), part 1 of 3 (split to keep each file within the 90 s test budget; 76 and 77 follow), over http with software WebGL (reduced motion, small
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
import { RETURNING, fillSteps, dismissAware } from './helpers.mjs';

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
// the Stay Aware notice (js/v6-campus-hud.js) opens with the map each time; tests/89-observatory-hud checks it, here OK closes it
const goView = async (page, v) => { await page.evaluate(v => go(v), v); if (v === 'campus') await dismissAware(page); };
// loaded and settled: the first terrain tiles are generated in the browser and take seconds with software WebGL
const ready = page => page.waitForFunction(() => HWCampus.state.map === 'error' || (HWCampus.state.map === 'ready' && HWCampus.map.quietMs > 1000), null, { timeout: 80000 }).then(() => page.evaluate(() => HWCampus.state.map));
// settled: the camera has stopped (map.loaded() can stay false while generated terrain tiles refresh)
const idle = page => page.waitForFunction(() => { const m = HWCampus.map && HWCampus.map.map; return !!m && !m.isMoving(); }, null, { timeout: 20000 }).then(() => page.waitForTimeout(400));
const cam = page => page.evaluate(() => { const m = HWCampus.map.map, c = m.getCenter(); return { lng: c.lng, lat: c.lat, z: m.getZoom() }; });


const shown = (page, id) => page.waitForFunction(id => HWCampus.state.shown.startsWith(id + '|') && HWCampus.viewer && HWCampus.viewer.debug.source && document.querySelector('.cmpvwmsg').hidden, id, { timeout: 60000 });
// the staircase models only (the fantasy map also loads its buildings, assets/models/campus-fantasy.glb)
const glbs = reqs => reqs.filter(u => /\/stairs\/[^/]+\.glb$/.test(u)).map(u => u.split('/').pop());

test('selection opens and updates the preview; the F21 set or the demonstration set, with their labels; leaving frees it', async () => {
  const { ctx, page, errors, reqs } = await openHttp({ init: () => { window.__raf = 0; const r = requestAnimationFrame; window.requestAnimationFrame = function (f) { return r.call(this, t => { window.__raf++; f(t); }); }; } });
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready');
  assert.deepEqual(glbs(reqs), [], 'no staircase model before a staircase is picked');
  // ST20: the measured F21 step size, as the Blender set made for it
  await page.click('#cmplist .cmpitem[data-id="ST20"]'); await shown(page, 'ST20');
  assert.equal(await page.evaluate(() => HWCampus.viewer.debug.source), 'blender');
  assert.ok(glbs(reqs).includes('ST20-fantasy.glb') && glbs(reqs).includes('pedestals.glb'), glbs(reqs).join());
  let t = await page.textContent('#cmpvw');
  assert.match(t, /3D staircase preview[\s\S]*Illustrative 3D model[\s\S]*Step size measured \(F21\)[\s\S]*Illustrative model — actual dimensions not surveyed\./);
  assert.match(t, /Step size: measured for this staircase \(rise 0\.169 m, run 0\.311 m, F21 report\)/);
  // ST03: the demonstration set; the stored angle (19.6°) sizes nothing
  await page.click('[data-a="cmptab"][data-t="list"]'); await page.click('#cmplist .cmpitem[data-id="ST03"]'); await shown(page, 'ST03');
  assert.ok(glbs(reqs).includes('demo-fantasy.glb') && !glbs(reqs).some(f => f.startsWith('ST03')), glbs(reqs).join());
  t = await page.textContent('#cmpvw');
  assert.match(t, /Illustrative 3D model[\s\S]*Not yet surveyed/);
  assert.match(t, /Step size: demonstration value \(rise 0\.16 m, run 0\.3 m\), not this staircase\. The stored angle is an estimate and does not size the model\./);
  // leaving frees it
  await goView(page, 'health');
  assert.deepEqual(await page.evaluate(() => [HWCampus.viewer, document.querySelectorAll('canvas').length]), [null, 0]);
  const f0 = await page.evaluate(() => window.__raf); await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.__raf) - f0, 0, 'no animation loop after leaving');
  assert.deepEqual(errors, []);
  await ctx.close();
});

