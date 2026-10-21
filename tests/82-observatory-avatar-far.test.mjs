// The Observatory's avatar away from campus (integration Phase 5; split from tests/81 for the 90 s budget), over http with
// software WebGL. Positions are made-up test
// values (the device's position in a real phone), never stored:
//   * far from campus: the page says how far, no avatar is shown, and the labelled demo walk moves it along a campus road;
//   * a female profile suggests the girl first, a profile with no sex Tom first.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RETURNING, entry } from './helpers.mjs';

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
async function openHttp({ viewport, init, route, ctxOpt, seed } = {}) {
  // software WebGL: a small map keeps each frame quick
  const ctx = await browser.newContext({ viewport: viewport || { width: 760, height: 640 }, reducedMotion: 'reduce', serviceWorkers: 'block', ...ctxOpt });
  const page = await ctx.newPage(), errors = [], reqs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('request', r => reqs.push(r.url()));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(seed || SEED));
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


const AT_CAMPUS = { latitude: 5.3512, longitude: 100.5382, accuracy: 12 }, FAR = { latitude: 3.139, longitude: 101.6869, accuracy: 20 };
const geo = g => ({ geolocation: g, permissions: ['geolocation'] });
const watches = () => { window.__w = { watch: 0, clear: 0 }; const g = navigator.geolocation, w = g.watchPosition.bind(g), c = g.clearWatch.bind(g);
  g.watchPosition = (...a) => { window.__w.watch++; return w(...a); }; g.clearWatch = (...a) => { window.__w.clear++; return c(...a); }; };
const glbs = reqs => reqs.filter(u => /\/avatars\/[^/]+\.glb$/.test(u)).map(u => u.split('/').pop());

test('far from campus: how far, no avatar, a labelled demo walk; a female profile gives the girl without asking; no profile sex: the player picks, Tom first', async () => {
  const { ctx, page, errors, reqs } = await openHttp({ ctxOpt: geo(FAR), seed: { ...SEED, p: { ...SEED.p, sex: 'f' } } });
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready'); // the position is asked for by itself (2026-10-21)
  assert.equal(await page.locator('.cmpav').count(), 0, 'the profile is female: no chooser');
  await page.waitForFunction(() => HWCampus.me.st === 'gps' && HWCampus.me.far, null, { timeout: 30000 });
  assert.match(await page.textContent('.cmpmebar'), /You are about 2\d\d\.\d km from campus\. Your avatar only walks on the campus map\./);
  assert.equal(await page.evaluate(() => !!(HWCampus.map.avatar && HWCampus.map.avatar.state && HWCampus.map.avatar.state.visible)), false, 'not shown away from campus');
  await page.click('.cmpmebar [data-a="cmpmedemo"]');
  await page.waitForFunction(() => HWCampus.me.st === 'demo' && HWCampus.map.avatar && HWCampus.map.avatar.ready && HWCampus.map.avatar.state.visible, null, { timeout: 40000 });
  assert.match(await page.textContent('.cmpmebar'), /Demo walk · simulated position, not yours/);
  assert.deepEqual(glbs(reqs), ['schoolgirl.glb'], 'the girl, from the profile');
  const p0 = await page.evaluate(() => HWCampus.map.avatar.state.goal); await page.waitForTimeout(2200);
  const p1 = await page.evaluate(() => HWCampus.map.avatar.state.goal);
  assert.notDeepEqual(p0, p1, 'the demo position moves along the road');
  await page.click('.cmpmebar [data-a="cmpmestop"]');
  assert.equal(await page.evaluate(() => [HWCampus.me.st, document.querySelectorAll('.cmpmebar').length].join()), 'off,0');
  // no profile sex: Tom first
  await page.evaluate(() => { localStorage.removeItem('hw_obs_avatar'); st.p.sex = ''; save(); render(); });
  await page.click('.hudbtn'); await page.click('#hudmenu [data-a="cmpme"]'); // Me, in the HealthWiz menu
  assert.deepEqual(await page.$$eval('.cmpav [data-a="cmpavpick"]', b => b.map(x => x.dataset.v)), ['tom', 'schoolboy', 'schoolgirl']);
  assert.deepEqual(errors, []);
  await ctx.close();
});
