// The Campus map's HUD (owner's request, 2026-10-21, after two Pokemon GO screen recordings: the mechanics and the look),
// js/v6-campus-hud.js, and the other changes of that request:
//   * the Stay Aware notice opens with the map each time (a snake, HealthWiz Kingdom), OK closes it;
//   * every map button, the search and the Legend sit in one HealthWiz button at the bottom middle: its menu has the
//     search on top and the buttons as round icons under their names; a button in it does its job with the menu closed;
//   * Details are a sheet inside the map with Stairs and Workout tabs: a fifth of the map high, its handle takes it to
//     half; its content scrolls inside it; its x closes it and keeps the pick; nothing below the map but the list;
//   * NEAREST STAIRS: a wave out of the avatar, then the nearest staircases with CHECK IN (the GPS check-in, compact);
//     a demo walk's position is simulated: no check-in;
//   * the avatar shows by itself (the browser's location permission granted here);
//   * a switch (terrain) or a redraw of the same page keeps the page still: no entrance fade, no map resize;
//   * the clouds over the land beyond the campus; the KM KULIM sign in both campus models;
//   * the loading screen: the heart filled in pixel by pixel with a percentage, gone once the first page has loaded.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, RETURNING } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function until(page, fn, ms) { const t = Date.now(); for (;;) { if (await page.evaluate(fn)) return; if (Date.now() - t > ms) throw new Error('timed out: ' + fn); await new Promise(r => setTimeout(r, 300)); } }
const glbNodes = f => { const b = fs.readFileSync(path.join(root, f)); return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))).nodes; };

after(closeBrowser);
test('the loading screen: the heart fills with a percentage, then goes; it is precached and loads after the original modules', async () => {
  const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.ok(idx.indexOf('js/v6-loader.js') > idx.indexOf('js/hw-06-v5-3-health-module.js') && idx.indexOf('js/v6-loader.js') < idx.indexOf('js/v6-events.js'));
  assert.match(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), /'js\/v6-loader\.js'/);
  const { page, errors } = await openApp({ before: p => p.addInitScript(() => { window.__seen = []; new MutationObserver(() => { const e = document.querySelector('#hwload .hwlp'); if (e && window.__seen.at(-1) !== e.textContent) window.__seen.push(e.textContent); }).observe(document, { subtree: true, childList: true, characterData: true }); }) });
  await until(page, () => HWLoader.done && !document.getElementById('hwload'), 15000);
  const seen = await page.evaluate(() => window.__seen);
  assert.equal(seen.at(-1), '100%', 'it ends at 100%: ' + seen.join(' '));
  assert.ok(seen.map(s => parseInt(s, 10)).every((v, i, a) => i === 0 || v >= a[i - 1]), 'the percentage only goes up');
  assert.ok(await page.locator('.wl').count(), 'the welcome page is under it');
  assert.deepEqual(errors, []);
});

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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: AT, ...o });
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

test('Stay Aware, the HealthWiz menu, the Details sheet with its tabs, and the avatar by itself', async () => {
  const { ctx, page, errors } = await mapPage();
  // the notice, each time the map opens
  assert.match(await page.textContent('#hudaware'), /Stay Aware of Your Surroundings[\s\S]*Do not enter dangerous areas while playing HealthWiz Kingdom\./);
  assert.equal(await page.locator('#hudaware svg.hudsign').count(), 1);
  await page.click('[data-a="hudaware"]');
  assert.equal(await page.locator('#hudaware').count(), 0);
  // the avatar stands at the position without a tap (the permission is granted in this test)
  await until(page, () => HWCampus.me.st === 'gps' && !!HWCampus.me.last, 20000);
  assert.equal(await page.evaluate(() => HWCampus.me.choose), false, 'no avatar question first');
  // no map buttons down the side and no legend in the corner: one HealthWiz button
  assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('#cmpstage .cmpctls, #cmpstage .cmpctl, #cmpstage > .cmpfind, #cmpstage > details.cmpleg').length, document.querySelectorAll('#cmpstage .hudbtn').length]), [0, 1]);
  const hb = await page.evaluate(() => { const b = document.querySelector('.hudbtn').getBoundingClientRect(), s = document.getElementById('cmpstage').getBoundingClientRect(); return [Math.abs((b.left + b.right) / 2 - (s.left + s.right) / 2) < 2, s.bottom - b.bottom < 30]; });
  assert.deepEqual(hb, [true, true], 'at the bottom middle of the map');
  await page.click('.hudbtn');
  const m = await page.evaluate(() => ({ find: !!document.querySelector('#hudmenu #cmpfind'), names: [...document.querySelectorAll('#hudmenu .hudl')].map(e => e.textContent) }));
  assert.ok(m.find, 'the search is in the menu');
  for (const n of ['Me', 'Details', 'Full screen', 'Zoom in', 'Zoom out', 'North', 'Turn left', 'Turn right', '3D', 'Terrain', 'Buildings', 'Sky', 'Layers', 'Campus', 'Legend']) assert.ok(m.names.includes(n), n);
  // a button in it does its job with the menu closed
  const z = await page.evaluate(() => HWCampus.map.map.getZoom());
  await page.click('#hudmenu [data-a="cmpzin"]');
  await until(page, () => !document.getElementById('hudmenu'), 3000);
  await until(page, () => !HWCampus.map.map.isMoving(), 10000);
  assert.ok(await page.evaluate(z => HWCampus.map.map.getZoom() > z + .5, z));
  // the Legend from the menu
  await page.click('.hudbtn'); await page.click('#hudmenu [data-a="hudlegopen"]');
  assert.match(await page.textContent('#hudleg'), /Mild[\s\S]*Clouds: the land beyond the campus/);
  await page.click('#hudleg [data-a="hudleg"]');
  // the search in the menu: picking a match closes the menu and opens the staircase
  await page.click('.hudbtn'); await page.fill('#cmpfind', 'ST14');
  await page.click('#cmpfindres [data-a="cmppick"][data-id="ST14"]');
  await until(page, () => !document.getElementById('hudmenu') && HWCampus.selected === 'ST14', 5000);
  if (await page.locator('#cmpstop').count()) { await page.evaluate(() => acts.cmpstopx()); await until(page, () => !document.getElementById('cmpstop'), 5000); }
  // Details: the sheet inside the map, a fifth of it high; nothing below the map but the list
  const sh = await page.evaluate(() => { const s = document.getElementById('hudsheet'), st = document.getElementById('cmpstage'); return { inMap: st.contains(s), size: s.dataset.size, h: s.getBoundingClientRect().height / st.getBoundingClientRect().height, below: !!document.querySelector('#cmppane #cmpdet'), list: !!document.querySelector('#cmppane #cmplist'), log: !!s.querySelector('#cmplog'), scroll: getComputedStyle(s.querySelector('.hudbody')).overflowY }; });
  assert.deepEqual([sh.inMap, sh.size, sh.below, sh.list, sh.log, sh.scroll], [true, 'peek', false, true, true, 'auto']);
  assert.ok(sh.h > .15 && sh.h < .36, 'about a fifth of the map: ' + sh.h);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.hudbtn, .hudwavebtn')].every(b => b.getBoundingClientRect().bottom <= document.getElementById('hudsheet').getBoundingClientRect().top + 1)), 'the HealthWiz button and NEAREST STAIRS ride above the sheet');
  await page.click('.hudgrab');
  await until(page, () => document.getElementById('hudsheet').dataset.size === 'half', 3000);
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => { const r = document.getElementById('hudsheet').getBoundingClientRect().height / document.getElementById('cmpstage').getBoundingClientRect().height; return r > .45 && r < .56; }), 'half the map');
  // the tabs: Stairs (the climb forms), Workout (the heart-rate workout)
  assert.match(await page.textContent('#hudbody'), /LOG A CLIMB HERE[\s\S]*Steps per climb/);
  await page.click('[data-a="hudtab"][data-t="workout"]');
  assert.deepEqual(await page.evaluate(() => [document.querySelector('[data-t="workout"]').getAttribute('aria-selected'), !!document.querySelector('#hudbody #wk-b'), !!document.querySelector('#hudbody #stman')]), ['true', true, false]);
  assert.equal(await page.evaluate(() => document.getElementById('hudsheet').dataset.size), 'half', 'the size is kept');
  // its x closes it; the staircase stays picked; the selection bar's Details opens it again
  await page.click('#hudsheet [data-a="hudsheetx"]');
  assert.deepEqual(await page.evaluate(() => [!!document.getElementById('hudsheet'), HWCampus.selected]), [false, 'ST14']);
  await page.click('.cmppill [data-a="hudsheetopen"]');
  assert.equal(await page.locator('#hudsheet').count(), 1);
  // leaving and coming back: the notice again
  await page.evaluate(() => go('health')); await page.evaluate(() => go('campus'));
  assert.equal(await page.locator('#hudaware').count(), 1, 'each time the map opens');
  assert.deepEqual(errors(), []);
  await ctx.close();
});

test('NEAREST STAIRS: a wave, then the nearest staircases with CHECK IN; a switch keeps the page still; the clouds', async () => {
  const { ctx, page, errors } = await mapPage();
  await page.evaluate(() => HWCampusHud.aware(false));
  await until(page, () => HWCampus.me.st === 'gps' && !!HWCampus.me.last, 20000);
  await page.click('.hudwavebtn');
  assert.equal(await page.locator('#cmpstage .hudwave i').count(), 3, 'the wave out of the avatar');
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
  await page.click('.hudwavebtn'); await page.waitForTimeout(1500);
  const d = await page.textContent('#hudsheet #v6gps');
  assert.match(d, /Demo walk: the position is simulated, so there is no check-in\./);
  assert.equal(await page.locator('#v6gps [data-a="gpspick"]').count(), 0);
  // the terrain switch: the map changes, the page is not redrawn, the map not resized
  await page.click('#hudsheet [data-a="hudsheetx"]'); // close the details first
  await page.click('.hudbtn');
  await page.evaluate(() => { window.__r = 0; HWCampus.map.map.on('resize', () => window.__r++); document.getElementById('cmpcard').dataset.mark = '1'; });
  await page.click('#hudmenu [data-a="cmpterr"]');
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(() => [HWCampus.state.terr, document.getElementById('cmpcard').dataset.mark, window.__r]), [false, '1', 0]);
  // a redraw of the same page: no entrance fade, no resize
  await page.evaluate(() => render());
  assert.deepEqual(await page.evaluate(() => [document.querySelector('#main>.pg').classList.contains('pgstay'), getComputedStyle(document.querySelector('#main>.pg')).animationName, window.__r]), [true, 'none', 0]);
  await page.evaluate(() => go('health'));
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#main>.pg')).animationName), 'pgin', 'a new page still fades in');
  await page.evaluate(() => go('campus')); await until(page, () => HWCampus.state.map === 'ready', 80000);
  // the clouds: everything outside the campus outline, with a soft edge
  const c = await page.evaluate(() => { const m = HWCampus.map.map, f = m.getSource('fog')._data.features; return [m.getLayer('fog').type, m.getLayoutProperty('fog', 'visibility') !== 'none', f[0].geometry.coordinates.length, m.getLayer('fog-edge').type]; });
  assert.deepEqual(c, ['fill', true, 2, 'line'], 'a frame with the campus cut out');
  assert.deepEqual(errors(), []);
  await ctx.close();
});

test('the KM KULIM sign is in both campus models, in front of the large academic block; the Fantasy roofs follow the design sheets', () => {
  for (const f of ['assets/models/campus-realistic.glb', 'assets/models/campus-fantasy.glb']) {
    const N = glbNodes(f), s = N.find(n => n.name === 'sign_kmk'), b = N.find(n => n.extras && n.extras.osm === 'way/454535317');
    assert.ok(s && b, f);
    assert.equal(s.extras.type, 'sign');
    const dx = s.extras.lng - b.extras.lng, dy = s.extras.lat - b.extras.lat;
    assert.ok(dx < -0.0003 && dx > -0.0006 && dy > 0 && dy < 0.0002, 'west of the block, a little north of its middle: ' + [dx, dy]);
  }
  const src = fs.readFileSync(path.join(root, 'tools/blender_campus.py'), 'utf8');
  assert.match(src, /FAN_TEAL, FAN_TERRA, FAN_SLATE/);
  assert.match(src, /SELANGKAH KE MENARA GADING/);
});
