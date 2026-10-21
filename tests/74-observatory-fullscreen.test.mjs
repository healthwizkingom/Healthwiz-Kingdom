// The Observatory's map in FULL SCREEN (the owner's request, 2026-10-20; tests/71 and 72 cover the rest of the map): served over http on a local server, in Chromium with software WebGL (the
// flags of prototypes/campus-observatory/qa/smoke.mjs; slow, so the checks are few and the motion is reduced).
//   * the map covers the whole window over the app and is resized to it, on a wide and a phone screen;
//   * it keeps working; DETAILS leaves full screen for the details; Escape and the button close it; kept for the tab.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RETURNING } from './helpers.mjs';

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
// the Stay Aware notice (js/v6-campus-hud.js) opens with the map each time; tests/88-observatory-stop checks it, here OK closes it
const goView = (page, v) => page.evaluate(v => { go(v); if (v === 'campus' && window.HWCampusHud) HWCampusHud.aware(false); }, v);
// loaded and settled: the first terrain tiles are generated in the browser and take seconds with software WebGL
const ready = page => page.waitForFunction(() => HWCampus.state.map === 'error' || (HWCampus.state.map === 'ready' && HWCampus.map.quietMs > 1000), null, { timeout: 80000 }).then(() => page.evaluate(() => HWCampus.state.map));
// settled: the camera has stopped (map.loaded() can stay false while generated terrain tiles refresh)
const idle = page => page.waitForFunction(() => { const m = HWCampus.map && HWCampus.map.map; return !!m && !m.isMoving(); }, null, { timeout: 20000 }).then(() => page.waitForTimeout(400));
const cam = page => page.evaluate(() => { const m = HWCampus.map.map, c = m.getCenter(); return { lng: c.lng, lat: c.lat, z: m.getZoom() }; });

// the map's buttons are in the HealthWiz menu (js/v6-campus-hud.js); the Details are a sheet inside the map, so they open in full screen too
const menu = async (page, a) => { await page.click('.hudbtn'); await page.click('#hudmenu [data-a="' + a + '"]'); };
test('FULL SCREEN: the map fills the window over the app, keeps working, DETAILS opens inside it, Escape closes it; kept for the tab', async () => {
  for (const vp of [{ width: 760, height: 640 }, { width: 380, height: 760 }]) {
    const { ctx, page, errors } = await openHttp({ viewport: vp });
    await goView(page, 'campus'); assert.equal(await ready(page), 'ready'); await idle(page);
    await menu(page, 'cmpfull'); await idle(page);
    const r = await page.evaluate(() => { const b = document.querySelector('#cmpstage').getBoundingClientRect(), c = HWCampus.map.map.getCanvas().getBoundingClientRect(), t = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { stage: [b.left, b.top, b.width, b.height], canvas: [Math.round(c.width), Math.round(c.height)], html: document.documentElement.classList.contains('cmp-fs'), onTop: !!t.closest('#cmpstage'),
        pressed: String(HWCampus.state.full), dialog: document.querySelector('#cmpstage').getAttribute('role') }; });
    assert.deepEqual(r.stage, [0, 0, vp.width, vp.height], 'the map covers the whole window');
    assert.deepEqual(r.canvas, [vp.width, vp.height], 'the map itself is resized to the window');
    assert.ok(r.html && r.onTop, 'over the app (nothing of the page in front of it)');
    assert.deepEqual([r.pressed, r.dialog], ['true', 'dialog']);
    if (vp.width < 600) { assert.deepEqual(errors, []); await ctx.close(); continue; } // the phone: covering is what differs; the rest is the same code
    // it keeps working: the controls and a selection; DETAILS leaves full screen and opens the details
    await menu(page, 'cmpzin'); await idle(page);
    await page.evaluate(() => { HWCampus.focus('ST20'); render(); }); await idle(page);
    assert.equal(await page.evaluate(() => document.querySelector('.stm.sel').dataset.key), '5.3519878,100.5383771');
    await page.click('.cmppill [data-a="hudsheetopen"]');
    assert.deepEqual(await page.evaluate(() => [HWCampus.state.full, HWCampus.state.tab, document.documentElement.classList.contains('cmp-fs'), !!document.querySelector('#cmpstage #hudsheet #cmpdet')]), [true, 'det', true, true]);
    assert.match(await page.textContent('#cmpdet'), /penjana elektrik/);
    // kept for the tab, and Escape closes it
    await goView(page, 'home');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('cmp-fs')), false, 'leaving the page leaves full screen');
    await goView(page, 'campus'); assert.equal(await ready(page), 'ready');
    assert.equal(await page.evaluate(() => HWCampus.state.full && document.documentElement.classList.contains('cmp-fs')), true);
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => [HWCampus.state.full, document.documentElement.classList.contains('cmp-fs'), document.activeElement.className]), [false, false, 'hudbtn']);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
