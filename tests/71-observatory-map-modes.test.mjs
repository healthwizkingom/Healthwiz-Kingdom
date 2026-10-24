// Split from 71-observatory-map.test.mjs so each file stays inside the 90 s per-file limit (software WebGL is slow). 
// The Observatory's map (integration Phase 2): served over http on a local server, in Chromium with software WebGL (the
// flags of prototypes/campus-observatory/qa/smoke.mjs; slow, so the checks are few and the motion is reduced).
//   * lazy: nothing of the map (module, MapLibre, data) is requested before the campus page opens;
//   * the map: OSM attribution and a scale, the illustrative terrain in the right order (highest > middle > base),
//     25 markers on their coordinates, clusters, the zone labels saying "illustrative";
//   * both modes use the same positions; the terrain and the buildings switch off and on; selecting from the list
//     flies to the marker; a shared point opens the chooser; mode, switches, selection and camera are kept for the tab;
//   * no WebGL, or map data that fails to load: a clear message, and the list and details still work.
//   * the phone layout.
//   Part 2 (tests/72-observatory-map-trip): the round trip with the camera, freeing the map; full screen: tests/74.
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
// the Stay Aware notice (js/v6-campus-hud.js) opens with the map each time; tests/89-observatory-hud checks it, here OK closes it
const goView = async (page, v) => { await page.evaluate(v => go(v), v); if (v === 'campus') await dismissAware(page); };
// loaded and settled: the first terrain tiles are generated in the browser and take seconds with software WebGL
const ready = page => page.waitForFunction(() => HWCampus.state.map === 'error' || (HWCampus.state.map === 'ready' && HWCampus.map.quietMs > 1000), null, { timeout: 80000 }).then(() => page.evaluate(() => HWCampus.state.map));
// settled: the camera has stopped (map.loaded() can stay false while generated terrain tiles refresh)
// the map's buttons are in the HealthWiz menu (js/v6-campus-hud.js): open it, press one (the menu closes)
const menu = async (page, a) => { await page.click('.hudbtn'); await page.click('#hudmenu [data-a="' + a + '"]'); };
const idle = page => page.waitForFunction(() => { const m = HWCampus.map && HWCampus.map.map; return !!m && !m.isMoving(); }, null, { timeout: 20000 }).then(() => page.waitForTimeout(400));
const cam = page => page.evaluate(() => { const m = HWCampus.map.map, c = m.getCenter(); return { lng: c.lng, lat: c.lat, z: m.getZoom() }; });

test('modes share the positions; terrain and buildings switch; selection flies to the marker; a shared point opens its chooser; all kept for the tab', async () => {
  const { ctx, page, errors } = await openHttp();
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready'); await idle(page);
  const pos = () => page.evaluate(() => JSON.stringify([...HWCampus.map.map.getContainer().querySelectorAll('.stm')].map(e => e.dataset.key)) + JSON.stringify(HWCampus.points().map(g => [g.lng, g.lat])));
  const p0 = await pos();
  await page.click('[data-a="cmpmode"][data-m="realistic"]');
  assert.deepEqual(await page.evaluate(() => [HWCampus.map.mode, document.querySelector('#cmpcard').dataset.mode]), ['realistic', 'realistic']);
  assert.equal(await pos(), p0, 'a mode switch changes no positions');
  // the terrain starts off (owner's request, 2026-10-23): flat, its labels hidden; on raises it; off flattens it again
  const off = () => page.evaluate(() => [HWCampus.map.map.getTerrain().exaggeration < .01, HWCampus.state.terr, [...document.querySelectorAll('.zlab')].every(z => z.closest('.maplibregl-marker').hidden)]);
  assert.deepEqual(await off(), [true, false, true], 'off by default');
  await menu(page, 'cmpterr');
  assert.equal(await page.evaluate(() => HWCampus.map.map.getTerrain().exaggeration), 1);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.zlab')].every(z => !z.closest('.maplibregl-marker').hidden && getComputedStyle(z).display !== 'none')), 'on: the elevation labels show');
  await menu(page, 'cmpterr');
  assert.deepEqual(await off(), [true, false, true], 'off: flattened (kept, so switching back is quick)');
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.zlab')].every(z => getComputedStyle(z).display === 'none')), 'off: the elevation labels are not drawn');
  await menu(page, 'cmpbld');
  assert.equal(await page.evaluate(() => HWCampus.map.map.getPaintProperty('bld', 'fill-extrusion-height')), 0);
  // the list flies to the marker and highlights it
  await page.click('#cmplist .cmpitem[data-id="ST24"]'); await idle(page);
  const r = await page.evaluate(() => { const m = HWCampus.map.map, c = m.getCenter(), s = HWCampusData.record('ST24'), sel = document.querySelector('.stm.sel');
    return { key: sel && sel.dataset.key, z: m.getZoom(), d: HWGps.dist(c.lat, c.lng, s.latitude, s.longitude), pill: document.querySelector('.cmppill').textContent }; });
  assert.equal(r.key, '5.3490042,100.5388927');
  assert.ok(r.z >= 17.9 && r.d < 40, 'centred and close: zoom ' + r.z.toFixed(2) + ', ' + Math.round(r.d) + ' m off');
  assert.match(r.pill, /ST24Tangga dalam Blok A/);
  // a marker tap on a shared point opens the chooser
  await page.evaluate(() => { const e = document.querySelector('.stm[data-key="5.3515635,100.5383731"]'); e.hidden = false; e.click(); });
  assert.match(await page.textContent('#cmpdet'), /3 staircases at one stored point[\s\S]*ST06[\s\S]*ST30[\s\S]*ST31/);
  await page.click('#cmpdet .cmpitem[data-id="ST30"]');
  assert.equal(await page.evaluate(() => HWCampus.selected), 'ST30');
  // kept for the tab: leave and come back to the same mode, switches (the terrain on: not the default), selection and camera
  await menu(page, 'cmpterr');
  await idle(page);
  const c0 = await cam(page);
  await goView(page, 'home');
  assert.equal(await page.evaluate(() => [HWCampus.map, document.querySelectorAll('.maplibregl-canvas').length].join()), ',0', 'leaving frees the map');
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready'); await idle(page);
  const c1 = await cam(page);
  assert.deepEqual(await page.evaluate(() => { const s = HWCampus.state; return [s.mode, s.terr, s.bld, s.sid, HWCampus.map.mode, document.querySelector('.stm.sel') && document.querySelector('.stm.sel').dataset.key]; }),
    ['realistic', true, false, 'ST30', 'realistic', '5.3515635,100.5383731']);
  assert.ok(Math.abs(c1.lng - c0.lng) < 1e-5 && Math.abs(c1.lat - c0.lat) < 1e-5 && Math.abs(c1.z - c0.z) < .01, 'the camera is restored');
  assert.deepEqual(errors, []);
  await ctx.close();
});
