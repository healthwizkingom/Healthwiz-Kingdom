// The staircase stop (owner's request, 2026-10-21, after a Pokestop), and the Details right below the map:
//   * the heart: one Blender sprite sheet (tools/art/make_heart_sprite.py), lossless, 16 frames of 40 x 40 px, white and grey
//     (the map tints it with the difficulty colour; the greys are checked in the browser below), precached;
//   * the Campus page: nothing between the map and the Details; the Details card starts with the stair illustration and
//     has the logging forms and the rest below it, in the same card; ALL STAIRCASES is at the end;
//   * over http: every staircase is a heart spinning on a post in its difficulty colour; tapping one zooms the stop's disc
//     out of it: the name, ID and difficulty, and an empty photo frame (no photo has been taken, none is made up); the
//     Details pop up below the map; closing shrinks the disc away and keeps the selection; on a phone every map button,
//     full screen included, is on screen; with reduced motion the hearts stand still;
//   * the stops as solid 3D models (owner's request, 2026-10-21: "not see through to building, but solid model like
//     pokestop"): the Blender stop (assets/models/heart-stop.glb) in a 3D layer sharing the map's depth buffer, one per
//     marker, coloured by difficulty, standing where the marker (the tap target) stands; the markers' drawn hearts hidden;
//     the selected heart spins (never with reduced motion); a slight glow in the difficulty colour (a halo and a pool of
//     light, depth-tested like the stop); if the model cannot load, the drawn hearts stay.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, RETURNING } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
async function until(page, fn, ms) { const t = Date.now(); for (;;) { if (await page.evaluate(fn)) return; if (Date.now() - t > ms) throw new Error('timed out: ' + fn); await new Promise(r => setTimeout(r, 300)); } }

test('the heart sheet: lossless WebP, 16 frames of 40 x 40, small, tinted in CSS, precached', async () => {
  const f = path.join(root, 'assets/img/heart-spin.webp'), b = fs.readFileSync(f);
  assert.equal(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 16), 'RIFFWEBPVP8L', 'lossless');
  const bits = b.readUInt32LE(21); // VP8L: 14 bits width − 1, 14 bits height − 1
  assert.deepEqual([(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1], [640, 40]);
  assert.ok(b.length < 4096, 'small: ' + b.length + ' bytes');
  assert.match(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), /'assets\/img\/heart-spin\.webp'/);
  assert.match(fs.readFileSync(path.join(root, 'observatory/observatory.css'), 'utf8'), /heart-spin\.webp[\s\S]*background-blend-mode:multiply[\s\S]*steps\(16\)/, 'tinted, 16 steps');
});

after(closeBrowser);
test('the Details sit right below the map: the illustration first, then the forms and the rest, in one card', async () => {
  const { page, errors } = await openApp();
  await go(page, 'campus'); await page.waitForSelector('#cmpcard');
  await page.click('#cmplist .cmpitem[data-id="ST14"]'); // (nothing picked yet: the list is below the map) await page.waitForSelector('#cmplog');
  const r = await page.evaluate(() => {
    const w = document.querySelector('.cmpwrap'), d = document.getElementById('cmpdet'), at = s => { const e = d.querySelector(s); return e ? [...d.querySelectorAll('*')].indexOf(e) : -1; };
    return { kids: [...w.children].map(e => e.id || e.className), inPane: d.parentElement.id, order: ['.cmph', '#cmpvw, .cmpvwna', '#cmplog', '.cmpmine', '.cmpgrp', '[data-a="cmptab"][data-t="list"]'].map(at) };
  });
  assert.deepEqual(r.kids, ['cmpstage', 'cmppanel'], 'the map, then the panel: nothing in between (no tabs)');
  assert.equal(r.inPane, 'cmppane');
  assert.ok(r.order.every((x, i) => x >= 0 && (i === 0 || x > r.order[i - 1])), 'name, illustration, log, my climbs, details, ALL STAIRCASES: ' + r.order);
  await page.click('#cmpdet [data-a="cmptab"][data-t="list"]');
  assert.match(await page.textContent('#cmppane'), /All staircases[\s\S]*BACK TO ST14 DETAILS/);
  await page.click('[data-a="cmptab"][data-t="det"]');
  assert.equal(await page.locator('#cmpdet #cmplog').count(), 1);
  assert.deepEqual(errors, []);
});

/* ---------- over http, with the map ---------- */
const req = createRequire(import.meta.url);
const { chromium } = (() => { try { return req('playwright'); } catch { return createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'))('playwright'); } })();
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', geojson: 'application/geo+json', css: 'text/css', webp: 'image/webp', png: 'image/png', woff2: 'font/woff2', webmanifest: 'application/manifest+json', mp3: 'audio/mpeg', glb: 'model/gltf-binary' };
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

test('with the map, on a phone: spinning hearts; a tap zooms the stop\'s disc out (name, empty photo frame); Details below; close keeps the pick; every button on screen', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  await page.route('**/observatory/models3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_BUILDINGS })); // the 3D models have their own tests
  await page.route('**/observatory/viewer3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_VIEWER }));
  await page.route('**/assets/models/heart-stop.glb', r => r.fulfill({ status: 404, body: 'not found' })); // the fallback; the 3D stops: below
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify({ ...RETURNING, s: { ...RETURNING.s, live: 0 } }));
  await page.goto(base); await page.waitForSelector('.wl');
  await page.evaluate(() => go('campus'));
  await until(page, () => HWCampus.state.map === 'ready', 80000);
  // the hearts: one per stored point, in the difficulty colour, spinning (16 steps), the difficulty number on the post
  // (the 3D stops cannot load in this test: the drawn hearts stay)
  const h = await page.evaluate(() => { const e = document.querySelector('.stm.c3[data-id] .hrt'), cs = getComputedStyle(e);
    return { n: document.querySelectorAll('.stm .hrt').length, anim: cs.animationName, img: /heart-spin\.webp/.test(cs.backgroundImage), mc: getComputedStyle(e.closest('.stm')).getPropertyValue('--mc').trim(), num: e.closest('.stm').querySelector('.hcat').textContent, vis: getComputedStyle(e.closest('.hstop')).visibility, st3d: HWCampus.map.map.getContainer().classList.contains('st3d') }; });
  assert.deepEqual([h.n, h.anim, h.img, h.num, h.vis, h.st3d], [25, 'hspin', true, '3', 'visible', false]);
  assert.ok(h.mc, 'tinted by the Vigorous colour');
  const grey = await page.evaluate(() => new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let ok = true, n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { n++; if (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2]) ok = false; } res([ok, n > 2000]); }; im.src = 'assets/img/heart-spin.webp'; }));
  assert.deepEqual(grey, [true, true], 'the sheet is white and grey only (the colour comes from the CSS tint)');
  // every map button on screen on a phone, full screen included
  const off = await page.evaluate(() => { const st = document.getElementById('cmpstage').getBoundingClientRect(); return [...document.querySelectorAll('.cmpctls .cmpctl')].filter(b => { const r = b.getBoundingClientRect(); return !(r.top >= st.top && r.bottom <= st.bottom && r.left >= st.left && r.right <= st.right); }).map(b => b.dataset.a); });
  assert.deepEqual(off, [], 'all map buttons inside the map');
  assert.equal(await page.locator('.cmpctls [data-a="cmpfull"]').count(), 1);
  // tap ST20's heart: the stop opens with its disc zooming out, the Details below the map
  await page.evaluate(() => document.querySelector('.stm[data-id="ST20"]').click());
  await page.waitForSelector('#cmpstop');
  const t = await page.textContent('#cmpstop');
  assert.match(t, /Tangga sebelah rumah penjana elektrik[\s\S]*ST20 · Moderate \(app category\) · estimated location[\s\S]*No photo yet[\s\S]*LOG A CLIMB HERE/);
  assert.equal(await page.locator('#cmpstop img').count(), 0, 'no photo is made up');
  assert.deepEqual(await page.evaluate(() => [document.getElementById('cmpstop').classList.contains('enter'), getComputedStyle(document.querySelector('#cmpstop .cmpdisc')).animationName]), [true, 'stopin']);
  assert.deepEqual(await page.evaluate(() => [HWCampus.selected, !!document.querySelector('#cmppane > #cmpdet #cmplog')]), ['ST20', true], 'the Details below the map');
  const vis = await page.evaluate(() => { const r = document.querySelector('#cmpstop [data-a="cmpstoplog"]').getBoundingClientRect(), n = document.getElementById('nav').getBoundingClientRect(); return r.top >= 0 && r.bottom <= n.top; });
  assert.ok(vis, 'the whole stop is on screen, above the bottom bar');
  // close: the disc shrinks back; the staircase stays picked
  await page.evaluate(() => acts.cmpstopx());
  assert.ok(await page.evaluate(() => document.getElementById('cmpstop').classList.contains('out')));
  await until(page, () => !document.getElementById('cmpstop'), 5000);
  assert.equal(await page.evaluate(() => HWCampus.selected), 'ST20');
  // LOG A CLIMB HERE closes the stop and goes to the forms
  await page.evaluate(() => document.querySelector('.stm[data-id="ST20"]').click());
  await page.waitForSelector('#cmpstop');
  await page.evaluate(() => acts.cmpstoplog());
  await until(page, () => !document.getElementById('cmpstop'), 5000);
  // reduced motion: the hearts stand still
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.stm .hrt')).animationName), 'none');
  assert.deepEqual(errors.filter(e => !/heart-stop\.glb|404/.test(e)), []);
  await ctx.close();
});

test('the solid 3D stops: one per marker, in the difficulty colour, on the marker\'s ground, depth-tested; the drawn hearts hidden; the selected one spins', async () => {
  const glb = fs.readFileSync(path.join(root, 'assets/models/heart-stop.glb'));
  assert.equal(glb.toString('ascii', 0, 4), 'glTF');
  const j = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
  assert.deepEqual(j.nodes.map(n => n.name).sort(), ['heart', 'post']);
  assert.ok(glb.length < 120000, 'small: ' + glb.length);
  const ctx = await browser.newContext({ viewport: { width: 800, height: 800 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  await page.route('**/observatory/models3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_BUILDINGS }));
  await page.route('**/observatory/viewer3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_VIEWER }));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify({ ...RETURNING, s: { ...RETURNING.s, live: 0 } }));
  await page.goto(base); await page.waitForSelector('.wl');
  await page.evaluate(() => go('campus'));
  await until(page, () => HWCampus.state.map === 'ready' && HWCampus.map.stops && HWCampus.map.stops.ready, 80000);
  const r = await page.evaluate(() => { const C = HWCampus.map, d = C.stops.debug, map = C.map, c = map.getContainer();
    const hex = x => '#' + x.getHexString();
    const one = d.list.find(s => s.g.visible) || d.list[0];
    return { n: d.list.length, keys: d.list.every(s => !!document.querySelector('.stm[data-key="' + s.key + '"]')), st3d: c.classList.contains('st3d'),
      hidden: getComputedStyle(document.querySelector('.stm .hstop')).visibility, layer: map.getLayer('stops3d') && map.getLayer('stops3d').type,
      mode: C.stops.renderingMode, colours: [1, 2, 3].map(k => hex(d.mats[k].color)), depth: Object.values(d.mats).every(m => m.depthTest && m.depthWrite && !m.transparent),
      glow: [d.glow, d.pool].map(G => [1, 2, 3].map(k => G[k] && hex(G[k].color) === hex(d.mats[k].color) && G[k].depthTest && !G[k].depthWrite && G[k].opacity > 0).every(Boolean)),
      emissive: [1, 2, 3].every(k => d.mats[k].emissive.getHex() !== 0),
      cats: d.list.map(s => s.cat).every(k => [1, 2, 3].includes(k)), dx: Math.abs(one.g.position.y - (map.queryTerrainElevation([one.lng, one.lat]) || 0)) };
  });
  assert.equal(r.n, 25); assert.ok(r.keys, 'one per marker'); assert.ok(r.st3d); assert.equal(r.hidden, 'hidden', 'the drawn hearts are hidden');
  assert.equal(r.layer, 'custom'); assert.equal(r.mode, '3d', 'shares the depth buffer with the buildings');
  assert.deepEqual(r.colours, ['#7ee07c', '#f6c94f', '#ff7b6e'], 'Mild, Moderate, Vigorous');
  assert.ok(r.depth, 'solid and depth-tested: a building in front hides it'); assert.ok(r.cats);
  assert.deepEqual(r.glow, [true, true], 'a halo and a pool of light in the difficulty colour, hidden by buildings in front too'); assert.ok(r.emissive, 'the hearts light themselves a little');
  assert.ok(r.dx < .01, 'on the ground the marker stands on');
  // selected: larger, and with reduced motion not spinning; with motion allowed it spins
  await page.evaluate(() => document.querySelector('.stm[data-id="ST20"]').click());
  await page.waitForSelector('#cmpstop');
  assert.equal(await page.evaluate(() => HWCampus.map.stops.spinning), false, 'reduced motion: still');
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.evaluate(() => HWCampus.map.setReduced());
  assert.equal(await page.evaluate(() => HWCampus.map.stops.spinning), true, 'the selected heart spins');
  await page.evaluate(() => acts.cmpstopx()); await until(page, () => !document.getElementById('cmpstop'), 5000);
  assert.deepEqual(errors, []);
  await ctx.close();
});
