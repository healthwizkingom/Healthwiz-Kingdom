// The fantasy map's wayfinding, landmarks, journal, layers, feedback and sigils (owner's request, 2026-10-20):
//   * landmarks only for MAPPED places (every one names its OSM feature; the unnamed ones say what they are and the nearest
//     named building); the Blender gate stands at the mapped gate, the rest of the wayfinding is labelled decoration;
//   * staircase sigils count saved stair sessions only, at most two a day, and give no XP;
//   * without the map the journal says the landmarks need it;
//   * over http: 17 landmark markers; opening one is a first discovery once (device-only record, nothing in the save);
//     the journal counts discoveries and explored areas; the Layers panel hides markers, labels, contours, effects and is
//     kept on the device; a saved session lights a sigil, sparks and a pulse along a path in Fantasy; the compass follows
//     the bearing and the rotate buttons turn the map.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openApp, closeBrowser, go, state, RETURNING, entry, daysAgo, fillSteps } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const osm = json('data/campus-osm.geojson');

test('landmarks are mapped places only: each names its OSM feature; unnamed ones say what they are; the props data says what is decoration', async () => {
  const { landmarksOf } = await import(pathToFileURL(path.join(root, 'observatory/landmarks.js')).href);
  const L = landmarksOf(osm), ids = new Set(osm.features.map(f => f.properties.osm));
  assert.equal(L.length, 17);
  assert.equal(new Set(L.map(l => l.id)).size, L.length, 'unique ids');
  for (const l of L) {
    assert.ok(l.osm.length && l.osm.every(o => ids.has(o)), l.id + ' is an OSM feature');
    if (!l.named) assert.match(l.name, /^(College gate|(Square|Playing field|Tennis court|Water tower) near [A-Z])/, l.name);
  }
  assert.deepEqual([...new Set(L.map(l => l.kind))].sort(), ['building', 'entrance', 'gathering', 'sport', 'utility']);
  assert.equal(L.find(l => l.kind === 'entrance').osm[0], 'node/8095311178', 'the gate is the mapped gate');
  assert.equal(L.find(l => l.name === 'Bangunan Akademik').osm.length, 5, 'one landmark for the five parts of the academic block');
  const P = json('data/campus-props.json');
  assert.match(P.wayfinding.gate, /node\/8095311178/);
  assert.match(P.wayfinding.decoration, /decoration[\s\S]*None of these is mapped/);
  assert.match(P.wayfinding.fantasyReference, /reference only[\s\S]*original design/);
});

after(closeBrowser);
test('sigils: saved stair sessions only, at most two a day, no XP; the journal needs the map', async () => {
  const st = (n, sid, t) => entry('stair', 20, n, { sid, loc: 'x', steps: 20, climbs: 1 }, t);
  const e = [st(0, 'ST20', '08:00'), st(0, 'ST20', '09:00'), st(0, 'ST20', '10:00'), st(1, 'ST19', '08:00'), st(2, 'ST14', '08:00')];
  const { page, errors } = await openApp({ seed: { ...RETURNING, e } });
  await go(page, 'campus'); await page.waitForSelector('#cmpsigs');
  assert.deepEqual(await page.evaluate(() => HWCampusMagic.counts()), { s: 4, d: 3, all: 5 }, 'three on one day count as two');
  const sig = id => page.$eval('#cmpsigs [data-sig="' + id + '"]', e => [e.classList.contains('on'), e.textContent]);
  assert.deepEqual((await sig('first'))[0], true);
  assert.match((await sig('five'))[1], /4 of 5/);
  assert.deepEqual((await sig('way'))[0], true, '3 different staircases');
  assert.match(await page.textContent('#cmpsigs'), /viewing or tapping the map never counts[\s\S]*At most two sessions a day count[\s\S]*Sigils give no XP/);
  const xp0 = (await state(page)).xp;
  await page.reload(); await page.waitForSelector('.wl'); await go(page, 'campus');
  assert.equal((await state(page)).xp, xp0, 'showing sigils gives no XP');
  assert.match(await page.textContent('#cmpjournal'), /landmarks appear with the map/);
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

test('with the map: landmarks and discovery, the journal, the layers, a saved session\'s feedback, the compass and rotation', async () => {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 760 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  await page.route('**/observatory/models3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_BUILDINGS })); // the 3D models have their own tests
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify({ ...RETURNING, s: { ...RETURNING.s, live: 0 } }));
  await page.goto(base); await page.waitForSelector('.wl');
  await page.evaluate(() => go('campus'));
  await page.waitForFunction(() => HWCampus.state.map === 'ready', null, { timeout: 80000 });
  assert.equal(await page.locator('.lmk').count(), 17, 'one marker per mapped landmark');
  // open the Surau from its marker: a first discovery, recorded on this device only
  const save0 = await page.evaluate(() => localStorage.getItem('healthwiz'));
  await page.evaluate(() => document.querySelector('.lmk[data-lmk="b-surau"]').click());
  assert.match(await page.textContent('#cmplmk'), /New landmark discovered[\s\S]*Surau[\s\S]*Building · mapped in OpenStreetMap \(way\/454535315\)[\s\S]*Nearest staircases[\s\S]*not a climb/);
  assert.ok(await page.evaluate(() => document.querySelector('.lmk[data-lmk="b-surau"]').classList.contains('found')));
  assert.deepEqual(Object.keys(await page.evaluate(() => JSON.parse(localStorage.getItem('hw_obs_found')))), ['b-surau']);
  assert.equal(await page.evaluate(() => localStorage.getItem('healthwiz')), save0, 'nothing in the save');
  await page.click('[data-a="cmplmkx"]');
  await page.evaluate(() => document.querySelector('.lmk[data-lmk="b-surau"]').click());
  assert.doesNotMatch(await page.textContent('#cmplmk'), /New landmark discovered/, 'only the first time');
  assert.match(await page.textContent('#cmpjournal'), /Landmarks discovered: 1 of 17 · Areas explored: 1 of 4/);
  // the layers: kept on the device; markers (the selected one stays), labels, contours, effects
  await page.click('[data-a="cmplmkx"]');
  await page.evaluate(() => acts.cmppick({ id: 'ST20' })); // (its Details take the focus, below the map)
  await page.waitForFunction(() => !HWCampus.map.map.isMoving(), null, { timeout: 30000 }); // the camera flies there first
  await page.evaluate(() => document.getElementById('cmpstage').scrollIntoView());
  await page.click('#cmplayb');
  for (const k of ['stairs', 'labels', 'contours', 'effects', 'landmarks']) await page.click('[data-a="cmplayt"][data-k="' + k + '"]');
  const r = await page.evaluate(() => ({ shown: [...document.querySelectorAll('.stm')].filter(e => !e.hidden).map(e => e.dataset.key), labels: [...document.querySelectorAll('.blab')].every(e => e.hidden),
    contours: HWCampus.map.map.getLayoutProperty('zone-contour', 'visibility'), fx: HWCampus.map.fx.running, lmk: [...document.querySelectorAll('.lmk')].every(e => e.hidden), stored: JSON.parse(localStorage.getItem('hw_obs_layers')) }));
  assert.deepEqual(r.shown, ['5.3519878,100.5383771'], 'only the selected staircase');
  assert.deepEqual([r.labels, r.contours, r.fx, r.lmk], [true, 'none', false, true]);
  assert.deepEqual(r.stored, { stairs: false, landmarks: false, labels: false, contours: false, paths: true, effects: false });
  for (const k of ['stairs', 'labels', 'contours', 'effects', 'landmarks']) await page.click('[data-a="cmplayt"][data-k="' + k + '"]');
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.stm')].filter(e => !e.hidden).length > 5));
  // a saved session for ST20 (Fantasy, effects on): its sigil lights, sparks and a pulse of light along a nearby path
  await page.click('#cmplayb');
  await fillSteps(page, '#ss', '12'); await page.fill('#sc', '2'); await page.click('#cmplog [data-a="savestair"]');
  await page.waitForFunction(() => document.querySelector('.stm[data-key="5.3519878,100.5383771"]').classList.contains('just'), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => HWCampus.map.map.getLayoutProperty('pulse', 'visibility')), 'visible', 'the pulse runs');
  await page.waitForFunction(() => HWCampus.map.map.getLayoutProperty('pulse', 'visibility') === 'none', null, { timeout: 5000 }); // and stops
  // the compass needle follows the bearing; the rotate buttons turn the map
  await page.click('.cmpctls [data-a="cmprotr"]');
  await page.waitForFunction(() => !HWCampus.map.map.isMoving() && HWCampus.map.map.getBearing() > 1, null, { timeout: 5000 });
  const cmp = await page.evaluate(() => [HWCampus.map.map.getBearing(), document.getElementById('cmpcomp').style.getPropertyValue('--b')]);
  assert.ok(Math.abs(cmp[0] - 30) < 1, 'turned 30° right: ' + cmp[0]);
  assert.equal(parseFloat(cmp[1]), -cmp[0], 'the needle points north');
  assert.deepEqual(errors, []);
  await ctx.close();
});
