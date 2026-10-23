// NEAREST STAIRS on the Campus map (js/v6-campus-hud.js, owner's request 2026-10-21): a wave out of the avatar, then the
// nearest staircases with CHECK IN (the GPS check-in of js/v6-gps.js, compact; a saved casual GPS session); a demo walk's
// position is simulated, so no check-in; a switch (terrain) or a redraw of the same page keeps the page still (no
// entrance fade, no map resize). The rest of the HUD: tests/89-observatory-hud.
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
async function until(page, fn, ms) { const t = Date.now(); for (;;) { if (await page.evaluate(fn)) return; if (Date.now() - t > ms) throw new Error('timed out: ' + fn); await new Promise(r => setTimeout(r, 300)); } }

/* ---------- over http, with the map ---------- */
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch { return createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'))('playwright'); } })();
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', geojson: 'application/geo+json', css: 'text/css', webp: 'image/webp', png: 'image/png', woff2: 'font/woff2', webmanifest: 'application/manifest+json', glb: 'model/gltf-binary' };
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
// a made-up test position beside ST14 on campus (a real phone gives its own); never stored
const AT = { latitude: 5.35154, longitude: 100.53803, accuracy: 10 };

async function mapPage(o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce', // software WebGL: a still map keeps each frame quick
    permissions: ['geolocation'], geolocation: AT, ...o });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  await page.route('**/observatory/models3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_BUILDINGS }));
  await page.route('**/observatory/viewer3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_VIEWER }));
  await page.route('**/assets/models/heart-stop.glb', r => r.fulfill({ status: 404, body: 'not found' }));
  await page.route('**/assets/models/avatars/*.glb', r => r.fulfill({ status: 404, body: 'not found' }));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify({ ...RETURNING, s: { ...RETURNING.s, live: 0 } }));
  await page.goto(base); await page.waitForSelector('.wl'); await until(page, () => HWLoader.done, 15000);
  await page.evaluate(() => go('campus'));
  await until(page, () => HWCampus.state.map === 'ready', 80000);
  return { ctx, page, errors: () => errors.filter(e => !/\.glb|404/.test(e)) };
}

test('NEAREST STAIRS: a wave, then the nearest staircases with CHECK IN; a switch keeps the page still', async () => {
  const { ctx, page, errors } = await mapPage();
  await page.evaluate(() => HWCampusHud.aware(false));
  assert.equal(await page.locator('.cmpmist').count(), 0, 'no layer over the map beyond the campus (owner, 2026-10-22)');
  await until(page, () => HWCampus.me.st === 'gps' && !!HWCampus.me.last, 20000);
  await page.emulateMedia({ reducedMotion: 'no-preference' }); // the wave is motion: with reduced motion it is not drawn
  await page.click('.hudwavebtn');
  assert.equal(await page.locator('#cmpstage .hudwave i').count(), 3, 'the wave out of the avatar');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await until(page, () => !!document.querySelector('#hudsheet #v6gps'), 5000);
  const t = await page.textContent('#hudsheet #v6gps');
  assert.match(t, /Position accurate to ±10 m[\s\S]*YOU ARE HERE/);
  assert.doesNotMatch(t, /GPS CHECK-IN|Standing at a stairway/, 'no long text');
  assert.equal(await page.evaluate(() => document.getElementById('hudsheet').dataset.size), 'half');
  assert.ok(await page.evaluate(() => !!HWCampus.selected), 'the nearest staircase is picked');
  // CHECK IN: the check-in form, then a saved casual GPS session
  const n0 = await page.evaluate(() => st.e.filter(e => e.c === 'stair').length);
  await page.click('#v6gps [data-a="gpspick"]');
  await page.fill('#gps-s', '12'); await page.fill('#gps-c', '2');
  await page.click('[data-a="gpsconfirm"]');
  await until(page, () => /Checked in at/.test((document.getElementById('v6gps') || {}).textContent || ''), 5000);
  const last = await page.evaluate(() => st.e.filter(e => e.c === 'stair').at(-1));
  assert.equal(await page.evaluate(() => st.e.filter(e => e.c === 'stair').length), n0 + 1);
  assert.deepEqual([last.v, last.m.src, last.m.kind], [24, 'gps', 'casual']);
  // a demo walk: simulated, so no check-in
  await page.evaluate(() => acts.cmpmedemo());
  await until(page, () => HWCampus.me.st === 'demo' && !!HWCampus.me.last, 10000);
  await page.evaluate(() => acts.hudwave()); await page.waitForTimeout(800); // NEAREST STAIRS again (tapped above)
  const d = await page.textContent('#hudsheet #v6gps');
  assert.match(d, /Demo walk: the position is simulated, so there is no check-in\./);
  assert.equal(await page.locator('#v6gps [data-a="gpspick"]').count(), 0);
  await page.evaluate(() => acts.cmpmestop()); // the demo walk's camera keeps moving; stop it
  // the terrain switch: the map changes, the page is not redrawn, the map not resized
  await page.click('#hudsheet [data-a="hudsheetx"]'); // close the details first
  await page.click('.hudbtn');
  await page.evaluate(() => { window.__r = 0; HWCampus.map.map.on('resize', () => window.__r++); document.getElementById('cmpcard').dataset.mark = '1'; });
  await page.click('#hudmenu [data-a="cmpterr"]');
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(() => [HWCampus.state.terr, document.getElementById('cmpcard').dataset.mark, window.__r]), [true, '1', 0]); // off by default (owner, 2026-10-23): the switch turns it on
  // a redraw of the same page: no entrance fade, no resize
  await page.evaluate(() => render());
  assert.deepEqual(await page.evaluate(() => [document.querySelector('#main>.pg').classList.contains('pgstay'), getComputedStyle(document.querySelector('#main>.pg')).animationName, window.__r]), [true, 'none', 0]);
  await page.evaluate(() => go('health'));
  assert.equal(await page.evaluate(() => document.querySelector('#main>.pg').classList.contains('pgstay')), false, 'a new page still fades in (unless motion is reduced)');
  assert.deepEqual(errors(), []);
  await ctx.close();
});

