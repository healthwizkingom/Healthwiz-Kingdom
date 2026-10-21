// The Observatory's fantasy look (integration Phase 4), over http with software WebGL:
//   * Fantasy: the Blender buildings (assets/models/campus-fantasy.glb) load and replace the generated roofs; Realistic loads
//     its own daylight Blender buildings (assets/models/campus-realistic.glb, owner's request 2026-10-20: both looks follow
//     the drone video) in place of the plain blocks, and only one look's model is kept; the buildings switch hides them;
//     markers keep their coordinates;
//   * particles and selection sparks run only in Fantasy (reduced motion: tests/80-observatory-still);
//   * leaving the page frees all of it: no canvas, no animation loop.
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


const visible = (page, id) => page.evaluate(id => { const m = HWCampus.map.map; return m.getLayer(id) ? m.getLayoutProperty(id, 'visibility') !== 'none' : null; }, id);

test('Fantasy and Realistic: the Blender buildings of each look replace the stand-ins; particles only in Fantasy, sparks on a selection; leaving frees it all', async () => {
  const { ctx, page, errors } = await openHttp({ ctxOpt: { reducedMotion: 'no-preference' },
    init: () => { window.__raf = 0; const r = requestAnimationFrame; window.requestAnimationFrame = function (f) { return r.call(this, t => { window.__raf++; f(t); }); }; } });
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready');
  await page.waitForFunction(() => HWCampus.map.modelsReady, null, { timeout: 60000 });
  assert.deepEqual([await visible(page, 'models'), await visible(page, 'bx'), await visible(page, 'bld')], [true, false, false], 'the Blender buildings, not the generated ones');
  assert.equal(await page.evaluate(() => HWCampus.map.fx.running), true, 'particles in Fantasy');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.stm, .clu')].filter(e => !e.hidden).map(e => getComputedStyle(e).opacity).filter(o => o !== '1')), [],
    'every staircase marker and cluster stays fully visible over the terrain and the buildings (the data before the decoration)');
  // a selection: sparks follow the selected waypoint
  await page.click('#cmplist .cmpitem[data-id="ST24"]');
  await page.waitForFunction(() => document.querySelector('.stm.sel'), null, { timeout: 20000 });
  const lit = await page.evaluate(() => new Promise(r => setTimeout(() => { const c = document.querySelector('.cmpfx'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; r(n); }, 1500)));
  assert.ok(lit > 0, 'sparks and motes are drawn');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.cmpfx')).pointerEvents), 'none', 'decoration never takes a tap');
  // Realistic: its own Blender buildings in daylight (the fantasy model is freed), no particles
  await page.click('[data-a="cmpmode"][data-m="realistic"]');
  assert.equal(await page.evaluate(() => HWCampus.map.fx.running), false);
  await page.waitForFunction(() => HWCampus.map.modelsLook === 'realistic', null, { timeout: 60000 });
  assert.deepEqual([await visible(page, 'models'), await visible(page, 'bx'), await visible(page, 'bld'), await visible(page, 'roof')], [true, false, false, false],
    'the daylight Blender buildings (with the gazebos), not the plain blocks');
  // one model layer (ids are unique): the fantasy one was removed (and freed) before the realistic one was added
  assert.equal(await page.evaluate(() => !!HWCampus.map.map.getLayer('models') && HWCampus.map.models.ready), true, 'one model layer, the realistic one, ready');
  // the buildings switch hides the Blender buildings too
  await page.click('[data-a="cmpmode"][data-m="fantasy"]');
  await page.waitForFunction(() => HWCampus.map.modelsLook === 'fantasy', null, { timeout: 60000 });
  assert.equal(await visible(page, 'models'), true);
  await page.click('[data-a="cmpbld"]');
  assert.deepEqual([await visible(page, 'models'), await visible(page, 'bx')], [false, false]);
  // leaving frees it all
  await goView(page, 'health');
  assert.deepEqual(await page.evaluate(() => [HWCampus.map, document.querySelectorAll('canvas').length]), [null, 0]);
  const f0 = await page.evaluate(() => window.__raf); await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.__raf) - f0, 0, 'no animation loop after leaving');
  assert.deepEqual(errors, []);
  await ctx.close();
});
