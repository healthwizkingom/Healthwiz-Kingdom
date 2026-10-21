// The Observatory's avatar and activity (integration Phase 5), over http with software WebGL. Positions are made-up test
// values (the device's position in a real phone), never stored:
//   * the locate button first asks which avatar to show: Tom, the anime school boy or the anime school girl, the one
//     matching the profile first (male: the boy; female: the girl; none: Tom), each with its credit (CC BY 4.0, suzuart);
//     the choice is a device preference and can be changed;
//   * on campus the chosen avatar stands at the GPS position with the accuracy circle; leaving stops the location watch;
//     no position is saved or kept for the tab (far away and the demo walk: tests/82-observatory-avatar-far);
//   * activity from the saved stair sessions only: the last 7 days and the 7 before, the staircases climbed most, a ring
//     on the markers of staircases climbed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RETURNING, entry, dismissAware } from './helpers.mjs';

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
// the Stay Aware notice (js/v6-campus-hud.js) opens with the map each time; tests/89-observatory-hud checks it, here OK closes it
const goView = async (page, v) => { await page.evaluate(v => go(v), v); if (v === 'campus') await dismissAware(page); };
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

test('the avatar shows by itself and follows the profile (male: the school boy, no chooser); on campus it stands at the GPS position; without a sex in the profile the player picks; leaving stops the watch; nothing stored', async () => {
  const { ctx, page, errors, reqs } = await openHttp({ ctxOpt: geo(AT_CAMPUS), init: watches });
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready');
  // the avatar shows by itself once the map is ready (owner's request, 2026-10-21); the browser's permission is granted in
  // this test. The test profile is male: the boy, straight away (owner's request, 2026-10-20: chosen from the profile)
  assert.equal(await page.locator('.cmpav').count(), 0, 'no chooser when the profile has a sex');
  await page.waitForFunction(() => HWCampus.me.st === 'gps' && HWCampus.map.avatar && HWCampus.map.avatar.ready && HWCampus.map.avatar.state.visible, null, { timeout: 40000 });
  assert.deepEqual(glbs(reqs), ['schoolboy.glb'], 'only that avatar is downloaded');
  assert.match(await page.textContent('.cmpmebar'), /You · GPS ±12 m \(device estimate\)/);
  assert.equal(await page.locator('.cmpmebar [data-a="cmpavopen"]').count(), 0, 'no Avatar button: it follows the profile');
  const r = await page.evaluate(() => ({ circle: HWCampus.map.map.getSource('me')._data.features.length, pos: HWCampus.map.avatar.state.pos, watch: window.__w.watch }));
  await page.click('.hudbtn'); r.pressed = await page.getAttribute('#hudmenu [data-a="cmpme"]', 'aria-pressed'); await page.click('#hudmenu [data-a="hudmenu"]');
  assert.equal(r.circle, 1, 'the accuracy circle');
  assert.ok(Math.abs(r.pos.lat - 5.3512) < 1e-6 && Math.abs(r.pos.lng - 100.5382) < 1e-6, 'the avatar stands at the position');
  assert.equal(r.pressed, 'true');
  assert.equal(r.watch, 1, 'one location watch, started without a tap');
  assert.match(await page.textContent('#cmpcard'), /The nearest mapped staircase is .+, about \d+ m away \(± 12 m\)/);
  await page.click('.hudbtn'); await page.click('#hudmenu [data-a="hudlegopen"]'); // the Legend is in the HealthWiz menu
  assert.match(await page.textContent('.cmpleg'), /Your avatar: Anime school boy \(from your profile\)\. "Rigged Anime School Boy \(Animation included\)" by suzuart \(Sketchfab\), CC BY 4\.0/);
  await page.click('#hudleg [data-a="hudleg"]'); // close the Legend
  // no sex in the profile: the player picks (credits shown), and can change it; the choice is a device preference
  await page.evaluate(() => { st.p.sex = ''; save(); render(); });
  await page.click('.cmpmebar [data-a="cmpavopen"]');
  assert.deepEqual(await page.$$eval('.cmpav [data-a="cmpavpick"]', b => b.map(x => x.dataset.v)), ['tom', 'schoolboy', 'schoolgirl']);
  assert.match(await page.textContent('.cmpav'), /Choose your avatar[\s\S]*no sex set[\s\S]*"Stylized Anime Japanese High School Girl 2" by suzuart \(Sketchfab\), CC BY 4\.0/);
  await page.click('.cmpav [data-a="cmpavpick"][data-v="tom"]');
  await page.waitForFunction(() => HWCampus.map.avatar && HWCampus.map.avatar.ready && HWCampus.map.avatar.state.visible, null, { timeout: 40000 });
  assert.deepEqual(glbs(reqs), ['schoolboy.glb', 'tom.glb']);
  const store = await page.evaluate(() => [localStorage.getItem('hw_obs_avatar'), JSON.stringify(localStorage), JSON.stringify(sessionStorage)]);
  assert.equal(store[0], 'tom');
  assert.doesNotMatch(store[1] + store[2], /5\.3512|100\.5382/, 'the position is not saved or kept for the tab');
  // leaving stops the watch and frees everything
  await goView(page, 'health');
  assert.deepEqual(await page.evaluate(() => [window.__w.clear >= 1, HWCampus.me.st, HWCampus.map, document.querySelectorAll('canvas').length]), [true, 'off', null, 0]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('activity from saved sessions only: the last 7 days and the 7 before, the most climbed, a ring on climbed staircases', async () => {
  const e = [entry('stair', 60, 1, { sid: 'ST20', steps: 20, climbs: 3 }), entry('stair', 40, 2, { sid: 'ST20', steps: 20, climbs: 2 }), entry('stair', 30, 3, { sid: 'ST14', steps: 15, climbs: 2 }),
    entry('stair', 50, 9, { sid: 'ST19', steps: 25, climbs: 2 }), entry('stair', 20, 4, { steps: 10, climbs: 2 })];
  const { ctx, page, errors } = await openHttp({ seed: { ...SEED, e } });
  await goView(page, 'campus'); assert.equal(await ready(page), 'ready');
  const t = await page.textContent('#cmpmine');
  assert.match(t, /Last 7 days: 4 sessions, 150 steps · the 7 days before: 1 session, 50 steps\./);
  assert.match(t, /Most climbed: Tangga sebelah rumah penjana elektrik ke Dewan Kenanga \(2\), .+ \(1\), .+ \(1\)\./);
  assert.match(t, /1 older session has no staircase recorded\. No new points or badges here\./);
  const vis = await page.evaluate(() => [...document.querySelectorAll('.stm.vis')].map(e => e.dataset.key).sort());
  assert.deepEqual(vis, ['5.3519878,100.5383771', '5.3524047,100.5383392', '5.3525206,100.5386027']);
  assert.match(await page.getAttribute('.stm.vis[data-key="5.3519878,100.5383771"]', 'aria-label'), /You have climbed here\./);
  await page.click('#cmpmine [data-a="cmppick"]');
  assert.equal(await page.evaluate(() => HWCampus.selected), 'ST20');
  assert.deepEqual(errors, []);
  await ctx.close();
});
