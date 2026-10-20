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

test('lazy and complete: nothing of the map before the page opens; then OSM attribution, a scale, terrain in order, 25 markers on their coordinates, clusters', async () => {
  const { ctx, page, errors, reqs } = await openHttp();
  await goView(page, 'sleep'); await goView(page, 'health'); // (Stairs is a section of the map page now: tests/83-stairs-in-campus)
  assert.deepEqual(reqs.filter(u => /observatory\/|vendor\/|\.geojson/.test(u)), [], 'the rest of the app never loads the map');
  await goView(page, 'campus');
  assert.equal(await ready(page), 'ready');
  await idle(page);
  // the generated terrain tiles arrive after the first frame
  await page.waitForFunction(() => HWCampus.map.map.queryTerrainElevation([100.5388927, 5.3490042]) > 1, null, { timeout: 30000 });
  assert.ok(reqs.some(u => /vendor\/maplibre-gl\/maplibre-gl\.js$/.test(u)) && reqs.some(u => /observatory\/main\.js$/.test(u)));
  const r = await page.evaluate(() => {
    const m = HWCampus.map.map, c = m.getContainer().getBoundingClientRect(), q = (a, b) => +m.queryTerrainElevation([a, b]).toFixed(1);
    let worst = 0;
    for (const g of HWCampus.points()) { const e = document.querySelector('.stm[data-key="' + g.key + '"]'); if (!e || e.hidden) continue; const b = e.getBoundingClientRect(), p = m.project([g.lng, g.lat]);
      worst = Math.max(worst, Math.hypot(b.x + b.width / 2 - (c.x + p.x), b.bottom - 6 - (c.y + p.y))); }
    return { attr: document.querySelector('.maplibregl-ctrl-attrib').textContent, scale: !!document.querySelector('.maplibregl-ctrl-scale'),
      t: { hi: q(100.5388927, 5.3490042), mid: q(100.5383771, 5.3519878), base: q(100.5368, 5.3509) }, markers: document.querySelectorAll('.stm').length,
      clusters: document.querySelectorAll('.clu').length, worst, zl: [...document.querySelectorAll('.zlab')].map(z => z.textContent), est: document.querySelectorAll('.stm.est').length };
  });
  assert.match(r.attr, /© OpenStreetMap contributors/);
  assert.ok(r.scale, 'a scale bar');
  assert.ok(r.t.hi > r.t.mid && r.t.mid > r.t.base, 'terrain order: highest > middle > base ' + JSON.stringify(r.t));
  assert.deepEqual([r.t.hi, r.t.mid], [24, 12], 'the illustrative heights from data/elevation-zones.geojson');
  assert.equal(r.markers, 25, 'one marker per stored point');
  assert.equal(r.est, 25, 'all estimated locations (no survey imported)');
  assert.ok(r.clusters > 0, 'close markers cluster at campus zoom');
  assert.ok(r.worst < 1.5, 'markers on their coordinates: ' + r.worst.toFixed(2) + ' px');
  assert.deepEqual(r.zl.map(t => /illustrative height, not measured/.test(t)), [true, true]);
  // every marker is named for screen readers (MapLibre would otherwise call each one "Map marker")
  const names = await page.evaluate(() => [...document.querySelectorAll('.stm, .clu')].map(e => e.getAttribute('aria-label')));
  assert.ok(names.length && names.every(n => n && n !== 'Map marker'), names.filter(n => !n || n === 'Map marker').length + ' unnamed');
  assert.match(await page.getAttribute('.stm[data-key="5.3519878,100.5383771"]', 'aria-label'), /^ST20 Tangga sebelah rumah penjana elektrik ke Dewan Kenanga\. Estimated location\.$/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('modes share the positions; terrain and buildings switch; selection flies to the marker; a shared point opens its chooser; all kept for the tab', async () => {
  const { ctx, page, errors } = await openHttp();
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready'); await idle(page);
  const pos = () => page.evaluate(() => JSON.stringify([...HWCampus.map.map.getContainer().querySelectorAll('.stm')].map(e => e.dataset.key)) + JSON.stringify(HWCampus.points().map(g => [g.lng, g.lat])));
  const p0 = await pos();
  await page.click('[data-a="cmpmode"][data-m="realistic"]');
  assert.deepEqual(await page.evaluate(() => [HWCampus.map.mode, document.querySelector('#cmpcard').dataset.mode]), ['realistic', 'realistic']);
  assert.equal(await pos(), p0, 'a mode switch changes no positions');
  await page.click('[data-a="cmpterr"]');
  assert.deepEqual(await page.evaluate(() => [!!HWCampus.map.map.getTerrain(), HWCampus.state.terr, [...document.querySelectorAll('.zlab')].every(z => z.closest('.maplibregl-marker').hidden)]), [false, false, true]);
  await page.click('[data-a="cmpterr"]');
  assert.equal(await page.evaluate(() => !!HWCampus.map.map.getTerrain()), true);
  await page.click('[data-a="cmpbld"]');
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
  assert.match(await page.textContent('#cmpdet'), /3 staircases at one stored point[\s\S]*ST06[\s\S]*ST31[\s\S]*ST32/);
  await page.click('#cmpdet .cmpitem[data-id="ST31"]');
  assert.equal(await page.evaluate(() => HWCampus.selected), 'ST31');
  // kept for the tab: leave and come back to the same mode, switches, selection and camera
  await idle(page);
  const c0 = await cam(page);
  await goView(page, 'home');
  assert.equal(await page.evaluate(() => [HWCampus.map, document.querySelectorAll('.maplibregl-canvas').length].join()), ',0', 'leaving frees the map');
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready'); await idle(page);
  const c1 = await cam(page);
  assert.deepEqual(await page.evaluate(() => { const s = HWCampus.state; return [s.mode, s.terr, s.bld, s.sid, HWCampus.map.mode, document.querySelector('.stm.sel') && document.querySelector('.stm.sel').dataset.key]; }),
    ['realistic', true, false, 'ST31', 'realistic', '5.3515635,100.5383731']);
  assert.ok(Math.abs(c1.lng - c0.lng) < 1e-5 && Math.abs(c1.lat - c0.lat) < 1e-5 && Math.abs(c1.z - c0.z) < .01, 'the camera is restored');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no WebGL, or the map data failing: a clear message; the list and details still work; nothing breaks', async () => {
  // no WebGL: the page says so before requesting anything for the map
  const a = await openHttp({ init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...x) { return /webgl/.test(t) ? null : g.call(this, t, ...x); }; } });
  await goView(a.page, 'campus');
  assert.equal(await a.page.evaluate(() => HWCampus.why()), 'gl');
  assert.match(await a.page.textContent('#cmpnomap'), /The campus map needs WebGL, which this browser could not start\./);
  assert.deepEqual(a.reqs.filter(u => /observatory\/|vendor\//.test(u)), []);
  await a.page.click('#cmplist .cmpitem[data-id="ST14"]');
  assert.match(await a.page.textContent('#cmpdet'), /Kenanga[\s\S]*Location[\s\S]*Staircase profile[\s\S]*Data quality/);
  assert.deepEqual(a.errors, []);
  await a.ctx.close();
  // the OSM data fails: a message in place of the map, the list still works
  const b = await openHttp({ route: p => p.route('**/data/campus-osm.geojson', r => r.fulfill({ status: 503, body: 'down' })) });
  await goView(b.page, 'campus');
  assert.equal(await ready(b.page), 'error');
  assert.match(await b.page.textContent('#cmpnomap'), /The campus map could not be loaded \(data\/campus-osm\.geojson: HTTP 503\)\. The staircases are listed with their details\./);
  await b.page.click('#cmplist .cmpitem[data-id="ST19"]');
  assert.match(await b.page.textContent('#cmpdet'), /Aisyah/);
  assert.deepEqual(b.errors.filter(e => !/503/.test(e)), [], 'only the failed request is logged by the browser');
  await b.ctx.close();
});

test('phone: the map and its controls fit 380 px; controls are 44 px tap targets; the list follows the map', async () => {
  const { ctx, page, errors } = await openHttp({ viewport: { width: 380, height: 800 }, ctxOpt: { isMobile: true, hasTouch: true } });
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready'); await idle(page);
  const r = await page.evaluate(() => { const st = document.querySelector('#cmpstage').getBoundingClientRect(), pn = document.querySelector('.cmppanel').getBoundingClientRect();
    return { doc: document.documentElement.scrollWidth, st: [st.left, st.right, st.height], below: pn.top >= st.bottom - 1,
      ctl: [...document.querySelectorAll('.cmpctl, .cmpmode')].map(b => { const x = b.getBoundingClientRect(); return [x.height, x.right]; }) }; });
  assert.ok(r.doc <= 380, 'no sideways scroll: ' + r.doc);
  assert.ok(r.st[0] >= 0 && r.st[1] <= 380 && r.st[2] >= 360, 'the map is on screen and tall enough: ' + r.st);
  assert.ok(r.below, 'the list is below the map on a phone');
  assert.ok(r.ctl.every(([h, right]) => h >= 40 && right <= 380), 'controls on screen and large enough');
  assert.deepEqual(errors, []);
  await ctx.close();
});
