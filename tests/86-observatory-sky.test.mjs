// The campus map in more detail (owner's request, 2026-10-20):
//   * the terrain levels (data/elevation-zones.geojson): which area is higher from the owner's annotation, where the
//     slopes start and end estimated from the drone video and the staircase list, each level labelled with its evidence;
//     the contour lines are traced from the height field (every 2 m) and lie on their height;
//   * the ground details (tools/blender_campus_props.py → assets/models/campus-props-*.glb): one draped mesh, lamp
//     materials, no normals in the file, small; data/campus-props.json says where each comes from;
//   * the sky (observatory/sky.js): the sun's height from the clock (worked examples for Kulim, 20 Oct 2026), the WMO
//     weather codes and the haze level, previews, and the look (tint at night, lamps on, rain, fog veil);
//   * over http, with the map: the details load, the Sky chooser changes the layers over the map without touching the
//     markers, a marker can still be tapped through them, and reduced motion keeps the rain still.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RETURNING, dismissAware } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const mod = p => import(pathToFileURL(path.join(root, p)).href);
const LAT = 5.3505, LNG = 100.5385;

test('terrain: three estimated levels with their evidence; contours every 2 m traced from the heights, lying on them', async () => {
  const zones = json('data/elevation-zones.geojson'), { createTerrain } = await mod('observatory/terrain.js');
  assert.match(zones.about, /ESTIMATED, ILLUSTRATIVE[\s\S]*owner's annotated screenshot[\s\S]*drone video[\s\S]*STAIRS list[\s\S]*not measurements/);
  assert.deepEqual(zones.features.map(f => [f.properties.id, f.properties.level, f.properties.illustrativeHeight_m]),
    [['upper-cluster', 'middle', 12], ['south-terrace', 'middle', 10], ['southern-region', 'highest', 24]]);
  for (const f of zones.features) assert.match(f.properties.evidence, /frames? \d/, f.properties.id + ' names the video frames');
  const t = createTerrain(zones), h = (a, b) => +t.heightAt(a, b).toFixed(1);
  assert.deepEqual([h(100.5389, 5.3526), h(100.5392, 5.34955), h(100.5388927, 5.3490042), h(100.5368, 5.3509)], [12, 10, 24, 0], 'north, terrace, south top, Padang');
  const st20 = h(100.5383771, 5.3519878), st12 = h(100.5390849, 5.349364);
  assert.ok(st20 > 0 && st20 < 12, 'ST20 (stairs going up to the north) on the slope: ' + st20);
  assert.ok(st12 > 10 && st12 < 24, 'ST12 (Blok C up to Blok A/B) on the bank between terrace and top: ' + st12);
  const C = t.overlays().features.filter(f => f.properties.zkind === 'contour');
  assert.deepEqual([...new Set(C.map(f => f.properties.h))].sort((a, b) => a - b), [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
  assert.ok(C.filter(f => f.properties.major).every(f => f.properties.h % 10 === 0) && C.some(f => f.properties.major), 'every 10 m drawn thicker');
  let worst = 0;
  for (const f of C) for (const [x, y] of f.geometry.coordinates) worst = Math.max(worst, Math.abs(t.heightAt(x, y) - f.properties.h));
  assert.ok(worst < .8, 'each contour lies on its height (within the 2.5 m grid): ' + worst.toFixed(2) + ' m');
});

/** The JSON chunk of a GLB. */
function glb(p) { const b = fs.readFileSync(path.join(root, p)); assert.equal(b.toString('ascii', 0, 4), 'glTF'); return JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12))); }
test('ground details: data with its sources; one draped mesh per look, lamp light, no normals, small files', () => {
  const P = json('data/campus-props.json'), osm = json('data/campus-osm.geojson'), [X0, Y0, X1, Y1] = osm.bounds;
  assert.ok(/ikraMRahim/.test(P.about.source) && /permission/.test(P.about.source) && /estimated/.test(P.about.estimated));
  for (const k of ['roads', 'drains', 'lights', 'goals', 'tennis', 'parking']) assert.match(P.seen[k], /frames? \d/, k + ' says where it was seen');
  for (const l of P.parking) assert.ok(l.lng > X0 && l.lng < X1 && l.lat > Y0 && l.lat < Y1 && /estimated/.test(l.name), l.id);
  for (const look of ['realistic', 'fantasy']) {
    const f = 'assets/models/campus-props-' + look + '.glb', g = glb(f);
    assert.ok(fs.statSync(path.join(root, f)).size < 300 * 1024, f + ' stays small');
    const nodes = g.nodes.filter(n => n.mesh != null);
    assert.equal(nodes.length, 1, 'one mesh');
    assert.equal(nodes[0].extras.drape, 1, 'draped on the terrain by the map');
    assert.ok(g.materials.some(m => m.name === 'lamp_glow'), 'the street lights\' material');
    assert.ok(g.meshes[0].primitives.every(p => p.attributes.NORMAL == null && p.attributes.TEXCOORD_1 == null), 'normals made in the browser; one UV set');
    assert.equal(g.scenes[0].extras.props, 1);
  }
});

test('sky: the sun from the clock (Kulim, 20 Oct 2026), the weather codes and haze, previews, and the look', async () => {
  const { sun, skyState, skyLook, skyWords, PREVIEWS } = await mod('observatory/sky.js');
  // worked by hand with the NOAA low-precision formulas: solar noon about 13:08 MYT, the sun 90 − (5.35 + 10.5) ≈ 74° up;
  // sunset about 19:08 MYT; civil dusk ends when it is 6° below the horizon, about 19:30 MYT
  const at = (utc) => sun(new Date(utc), LAT, LNG);
  assert.ok(Math.abs(at('2026-10-20T05:10:00Z').alt - 74.2) < .5, 'noon height');
  assert.ok(Math.abs(at('2026-10-20T05:10:00Z').az - 180) < 10, 'noon: the sun to the south');
  const tod = utc => skyState({ now: new Date(utc), lat: LAT, lng: LNG }).tod;
  assert.deepEqual(['2026-10-19T23:05:00Z', '2026-10-20T01:00:00Z', '2026-10-20T11:05:00Z', '2026-10-20T11:40:00Z', '2026-10-20T16:00:00Z'].map(tod),
    ['dawn', 'day', 'dusk', 'night', 'night'], '07:05, 09:00, 19:05, 19:40 and 00:00 Malaysia time');
  const noon = new Date('2026-10-20T05:10:00Z'), s = o => skyState({ now: noon, lat: LAT, lng: LNG, ...o });
  assert.deepEqual([s({ wx: { weather_code: 63, cloud_cover: 90 } }).rain, s({ wx: { weather_code: 45 } }).fog, s({ wx: { weather_code: 2, precipitation: .4 } }).rain], [.7, .8, .3]);
  assert.deepEqual([3, 4, 5, 2].map(n => s({ hazeLevel: n }).haze), [.35, .6, .85, 0], 'haze from level 3 (PM2.5 above 35 µg/m³)');
  assert.equal(s({}).src, 'clock', 'no reading: the clock only');
  assert.equal(s({ wx: { weather_code: 0 } }).src, 'live');
  assert.deepEqual(PREVIEWS, ['live', 'day', 'dusk', 'night', 'rain', 'fog', 'haze']);
  assert.deepEqual(['night', 'rain', 'fog', 'haze'].map(p => { const x = s({ preview: p }); return [x.tod, x.rain, x.fog, x.haze, x.src]; }),
    [['night', 0, 0, 0, 'preview'], ['day', .75, 0, 0, 'preview'], ['day', 0, .85, 0, 'preview'], ['day', 0, 0, .6, 'preview']]);
  const L = (p, m) => skyLook(s({ preview: p }), m);
  assert.deepEqual([L('day', 'realistic').tint, L('day', 'realistic').lamps, L('night', 'realistic').tint, L('night', 'realistic').lamps], [0, 0, .46, 1], 'night darkens and lights the lamps');
  assert.ok(L('rain', 'realistic').rain > 0 && L('rain', 'realistic').tint > 0, 'rain: falling rain and a darker sky');
  assert.ok(L('fog', 'realistic').veil >= .8 && L('haze', 'realistic').veil > .4, 'fog and haze: a veil');
  assert.ok(L('night', 'realistic').key < L('day', 'realistic').key, 'the 3D sun dims at night');
  assert.equal(skyWords(s({ preview: 'rain' })), 'day, rain');
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
const SEED = { ...RETURNING, s: { ...RETURNING.s, live: 0 } }; // live data off: no network; the sky follows the clock

test('with the map: the details load on the terrain; the Sky chooser tints, fogs and rains over the map, not over the markers; reduced motion keeps the rain still', async () => {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await ctx.newPage(), errors = [], reqs = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('request', r => reqs.push(r.url()));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(SEED));
  await page.goto(base); await page.waitForSelector('.wl');
  await page.evaluate(() => go('campus')); await dismissAware(page); // OK on the Stay Aware notice
  await page.waitForFunction(() => HWCampus.state.map === 'ready', null, { timeout: 80000 });
  await page.click('[data-a="cmpmode"][data-m="realistic"]');
  await page.waitForFunction(() => HWCampus.map.models && HWCampus.map.models.props, null, { timeout: 80000 });
  assert.ok(reqs.some(u => /campus-props-realistic\.glb$/.test(u)), 'this look\'s details');
  assert.deepEqual(await page.evaluate(() => { const p = HWCampus.map.models.props; return [p.meshes > 0, p.lamps > 0]; }), [true, true]);
  // the layers sit inside the map, after its canvas and before the markers
  assert.ok(await page.evaluate(() => { const k = document.querySelector('.cmpsky'), m = document.querySelector('.stm'); return k && k.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING && getComputedStyle(k).pointerEvents === 'none'; }));
  assert.match(await page.textContent('#cmpskycap'), /^Sky: (day|dawn|dusk|night).*\(clock; no live weather\)$/, 'live data off: the clock only, said so');
  await page.click('#cmpskyb');
  assert.match(await page.textContent('#cmpskyp'), /Live[\s\S]*Clear day[\s\S]*Dusk[\s\S]*Night[\s\S]*Rain[\s\S]*Fog[\s\S]*Haze[\s\S]*A picture, not a forecast/);
  const css = () => page.evaluate(() => { const k = document.querySelector('.cmpsky'), s = getComputedStyle(k); return { tint: +s.getPropertyValue('--tint'), veil: +s.getPropertyValue('--veil'), wet: k.classList.contains('wet'), still: k.classList.contains('still'), glow: HWCampus.map.models.props.glow }; });
  await page.click('[data-a="cmpsky"][data-v="night"]');
  assert.deepEqual(await css(), { tint: .46, veil: 0, wet: false, still: true, glow: 3.2 }, 'night: darker, the street lights on');
  assert.equal(await page.textContent('#cmpskycap'), 'Sky: night (preview)');
  await page.click('[data-a="cmpsky"][data-v="day"]');
  assert.equal((await css()).glow, 0, 'by day the lamps are off');
  await page.click('[data-a="cmpsky"][data-v="rain"]');
  let c = await css();
  assert.ok(c.wet && c.still && c.tint > 0, 'rain (drawn still with reduced motion)');
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.cmpsky-rain'), '::before').animationName), 'none');
  await page.click('[data-a="cmpsky"][data-v="fog"]');
  c = await css(); assert.ok(c.veil >= .8 && !c.wet, 'fog');
  // a marker can still be tapped through the weather
  const key = await page.evaluate(() => { const r = document.querySelector('#cmpstage').getBoundingClientRect(), e = [...document.querySelectorAll('.stm')].find(x => { if (x.hidden || !x.dataset.id) return false; const b = x.getBoundingClientRect(), cx = b.x + b.width / 2, cy = b.y + b.height / 2; return cx > r.x + 120 && cx < r.right - 120 && cy > r.y + 150 && cy < r.bottom - 80 && document.elementFromPoint(cx, cy) && x.contains(document.elementFromPoint(cx, cy)); }); return e && e.dataset.id; });
  assert.ok(key, 'a marker in the middle of the map, on top');
  await page.click('.stm[data-id="' + key + '"]');
  assert.equal(await page.evaluate(() => HWCampus.selected), key, 'tapped through the weather layers');
  // the tap opens the staircase's stop over the map (tests/88); closing it gives the map back
  await page.waitForSelector('#cmpstop');
  await page.evaluate(() => acts.cmpstopx());
  await page.waitForFunction(() => !document.getElementById('cmpstop'), null, { timeout: 5000 });
  // the choice is kept for the tab; Live returns to the clock
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('hw_obs_view')).sky), 'fog');
  await page.click('[data-a="cmpsky"][data-v="live"]');
  assert.match(await page.textContent('#cmpskycap'), /\(clock; no live weather\)$/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
