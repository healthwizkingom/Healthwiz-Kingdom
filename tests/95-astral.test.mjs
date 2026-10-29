// Module 10, the Astral Navigator (js/v6-astral.js): the solar position against independent references, the edge cases, the
// sunlight assessment levels, the Navigator's Compass in a staircase's Details, the sun compass beside the HealthWiz button on the
// live map, and (same request) the map's loading screen staying inside the map square and the staircase list's order and labels.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, RETURNING } from './helpers.mjs';
import { sun } from '../observatory/sky.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const dAz = (a, b) => ((a - b + 540) % 360) - 180;

// NREL Solar Position Algorithm (Reda & Andreas), computed with pvlib 0.16.1 solarposition.spa_python on 2026-10-29.
// el: geometric elevation, app: apparent elevation (SPA's own refraction), az: azimuth from north, clockwise. Degrees.
const SPA = [
  { n: 'Kulim 12:00 MYT (not solar noon)', lat: 5.365, lng: 100.56, t: '2026-10-29T04:00:00Z', el: 65.7809, app: 65.7884, az: 141.0528 },
  { n: 'Kulim 12:59 MYT', lat: 5.365, lng: 100.56, t: '2026-10-29T04:59:00Z', el: 71.1742, app: 71.18, az: 178.1214 },
  { n: 'Kulim morning', lat: 5.365, lng: 100.56, t: '2026-10-29T01:00:00Z', el: 27.1974, app: 27.2299, az: 108.0514 },
  { n: 'Kulim afternoon', lat: 5.365, lng: 100.56, t: '2026-10-29T08:30:00Z', el: 34.9217, app: 34.9457, az: 249.4205 },
  { n: 'Kulim just after sunrise', lat: 5.365, lng: 100.56, t: '2026-10-28T23:15:00Z', el: 2.024, app: 2.3035, az: 103.6349 },
  { n: 'Kulim just after sunset', lat: 5.365, lng: 100.56, t: '2026-10-29T11:05:00Z', el: -2.1095, app: -2.1095, az: 256.5997 },
  { n: 'Kulim night', lat: 5.365, lng: 100.56, t: '2026-10-29T15:00:00Z', el: -58.9777, app: -58.9777, az: 252.4407 },
  { n: 'Kulim June solstice', lat: 5.365, lng: 100.56, t: '2026-06-21T05:00:00Z', el: 71.3248, app: 71.3305, az: 14.104 },
  { n: 'Kulim December solstice', lat: 5.365, lng: 100.56, t: '2026-12-21T05:00:00Z', el: 60.9449, app: 60.9542, az: 172.579 },
  { n: 'Kulim March equinox', lat: 5.365, lng: 100.56, t: '2026-03-20T05:00:00Z', el: 81.611, app: 81.6134, az: 131.0075 },
  { n: 'Boulder, July (UTC−6)', lat: 40.0, lng: -105.27, t: '2026-07-04T18:00:00Z', el: 67.9257, app: 67.9325, az: 136.197 },
  { n: 'London, January', lat: 51.5, lng: -0.12, t: '2026-01-15T12:00:00Z', el: 17.3968, app: 17.4494, az: 177.5864 },
  { n: 'Sydney, January (south)', lat: -33.87, lng: 151.21, t: '2026-01-10T02:00:00Z', el: 78.0911, app: 78.0946, az: 2.8077 },
  { n: 'Tromsø, midnight sun', lat: 69.65, lng: 18.96, t: '2026-06-21T22:00:00Z', el: 3.4531, app: 3.6611, az: 349.4251 },
  { n: 'Quito, 2027', lat: -0.18, lng: -78.47, t: '2027-02-11T17:00:00Z', el: 74.5884, app: 74.5931, az: 153.4912 },
];
const solarAll = (page, cases) => page.evaluate(C => C.map(c => HWAstral.solar({ latitude: c.lat, longitude: c.lng, date: new Date(c.t) })), cases);

after(closeBrowser);

test('solar position: within 0.02° (height) and 0.04° (bearing) of NREL SPA at 15 times and places', async () => {
  const { page, ctx, errors } = await openApp();
  const R = await solarAll(page, SPA);
  SPA.forEach((c, i) => {
    assert.equal(R[i].ok, true, c.n);
    near(R[i].elevation, c.el, 0.02, c.n + ' elevation');
    near(dAz(R[i].azimuth, c.az), 0, 0.04, c.n + ' azimuth');
    if (c.el > 1) near(R[i].apparent, c.app, 0.02, c.n + ' apparent (above 1°, where refraction models agree)');
  });
  // the clock is not solar time: at 12:00 Malaysia time the Sun is still in the south-east at Kulim
  assert.ok(R[0].azimuth < 150, 'at 12:00 MYT the azimuth is ' + R[0].azimuth);
  assert.deepEqual(errors, []); await ctx.close();
});

test('solar position agrees with the map\'s own 3D sunlight (observatory/sky.js) to within 0.05°', async () => {
  const { page, ctx, errors } = await openApp();
  const R = await solarAll(page, SPA);
  SPA.forEach((c, i) => { const s = sun(new Date(c.t), c.lat, c.lng); near(s.alt, R[i].elevation, 0.05, c.n + ' alt'); near(dAz(s.az, R[i].azimuth), 0, 0.05, c.n + ' az'); });
  assert.deepEqual(errors, []); await ctx.close();
});

test('solar noon, time zones and dates: Kulim\'s solar noon moves between 13:01 and 13:32 Malaysia time over the year', async () => {
  const { page, ctx, errors } = await openApp({ context: { timezoneId: 'Europe/London' } });
  const r = await page.evaluate(() => { let lo = 1e9, hi = -1e9; for (let d = 0; d < 365; d++) { const s = HWAstral.solar({ latitude: 5.3524, longitude: 100.5383, date: new Date(Date.UTC(2026, 0, 1 + d, 5)) }); lo = Math.min(lo, s.solarNoonUTC); hi = Math.max(hi, s.solarNoonUTC); }
    const t = new Date('2026-10-29T04:30:00Z'), a = HWAstral.solar({ latitude: 5.3524, longitude: 100.5383, date: t }), b = HWAstral.solar({ latitude: 5.3524, longitude: 100.5383, date: new Date(t.getTime()) });
    const west = HWAstral.solar({ latitude: 5.3524, longitude: 99.5383, date: t });
    return { lo: lo + 480, hi: hi + 480, same: a.elevation === b.elevation && a.azimuth === b.azimuth, westNoon: west.solarNoonUTC - a.solarNoonUTC,
      dec: [HWAstral.solar({ latitude: 0, longitude: 0, date: new Date('2026-06-21T12:00:00Z') }).declination, HWAstral.solar({ latitude: 0, longitude: 0, date: new Date('2026-12-21T12:00:00Z') }).declination] }; });
  assert.equal(Math.floor(r.lo / 60) + ':' + String(Math.floor(r.lo % 60)).padStart(2, '0'), '13:01');
  assert.equal(Math.floor(r.hi / 60) + ':' + String(Math.floor(r.hi % 60)).padStart(2, '0'), '13:32');
  assert.equal(r.same, true, 'the device time zone (London here) does not change the result: the instant is used');
  near(r.westNoon, 4, 1e-6, '1° further west: solar noon 4 minutes later');
  near(r.dec[0], 23.44, 0.02, 'June solstice declination'); near(r.dec[1], -23.44, 0.02, 'December solstice declination');
  assert.deepEqual(errors, []); await ctx.close();
});

test('invalid input and numerical edges: a status, never NaN', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => { const A = HWAstral, d = new Date('2026-10-29T04:00:00Z');
    const bad = [A.solar({ latitude: 91, longitude: 100, date: d }), A.solar({ latitude: 5, longitude: 'x', date: d }), A.solar({ latitude: 5, longitude: 181, date: d }),
      A.solar({ latitude: 5, longitude: 100, date: new Date('nope') }), A.solar({ latitude: 5, longitude: 100, date: new Date('1700-01-01') }), A.solar(null)];
    const pole = A.solar({ latitude: 90, longitude: 0, date: new Date('2026-06-21T12:00:00Z') }), spole = A.solar({ latitude: -90, longitude: 0, date: d });
    let over = null; for (let m = 0; m < 1440 && !over; m++) { const s = A.solar({ latitude: 23.0, longitude: 0, date: new Date(Date.UTC(2026, 5, 21, 0, m)) }); if (s.elevation > 89.3) over = s; } // near the subsolar point
    const sweep = []; for (let h = 0; h < 48; h++) { const s = A.solar({ latitude: 5.36, longitude: 100.54, date: new Date(Date.UTC(2026, 9, 29, 0, h * 30)) }); sweep.push([s.elevation, s.apparent, s.azimuth]); }
    return { bad: bad.map(b => [b.ok, b.status, b.elevation, !!b.reason]), pole: [pole.ok, pole.azimuth, Number.isFinite(pole.elevation)], spole: [spole.ok, spole.azimuth],
      over: over && [Number.isFinite(over.elevation), over.azimuth === null || Number.isFinite(over.azimuth)], ref: [-1, -0.575, 0, 5, 85, 89.9, 90].map(A.refraction),
      sweep: sweep.every(x => x.every(Number.isFinite)) }; });
  r.bad.forEach(b => assert.deepEqual(b, [false, 'invalid', null, true]));
  assert.deepEqual(r.pole, [true, 180, true], 'at the north pole the Sun is due south'); assert.deepEqual(r.spole, [true, 0]);
  assert.deepEqual(r.over, [true, true], 'near the zenith: no NaN');
  assert.ok(r.ref.every(Number.isFinite)); assert.equal(r.ref[5], 0); assert.equal(r.ref[6], 0); assert.ok(r.ref[2] > 0.4 && r.ref[2] < 0.6, 'about half a degree at the horizon');
  assert.equal(r.sweep, true, 'a whole day every 30 minutes: all finite');
  assert.deepEqual(errors, []); await ctx.close();
});

test('geometry helpers: bearing, relative angle, shadow length (level plane), compass points', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => { const A = HWAstral; return {
    b: [A.bearing(5, 100, 5.001, 100), A.bearing(5, 100, 5, 100.001), A.bearing(5, 100, 4.999, 100), A.bearing(5, 100, 5, 99.999), A.bearing(5, 100, 5, 100)],
    rel: [A.relative(10, 350), A.relative(350, 10), A.relative(180, 0), A.relative(90, 'x')],
    sh: [A.shadowLength(2, 45), A.shadowLength(2, 90), A.shadowLength(2, 0.5), A.shadowLength(-1, 45), A.shadowLength(2, 30)],
    pt: [A.point(0), A.point(157.5), A.point(359), A.point(null)], d: A.distance(5, 100, 5.001, 100) }; });
  near(r.b[0], 0, 1e-6, 'north'); near(r.b[1], 90, 1e-3, 'east'); near(r.b[2], 180, 1e-6, 'south'); near(r.b[3], 270, 1e-3, 'west'); assert.equal(r.b[4], null);
  assert.deepEqual(r.rel.slice(0, 3), [20, -20, 180]); assert.equal(r.rel[3], null);
  near(r.sh[0], 2, 1e-12, '45°'); near(r.sh[1], 0, 1e-12, 'overhead'); assert.equal(r.sh[2], null, 'too low'); assert.equal(r.sh[3], null); near(r.sh[4], 2 * Math.sqrt(3), 1e-12, '30°');
  assert.deepEqual(r.pt, ['N', 'SSE', 'N', null]); near(r.d, 111.2, 0.2, '0.001° of latitude');
  assert.deepEqual(errors, []); await ctx.close();
});

test('sunlight assessment: the strongest level the data supports, and no shade claim from a heading', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => { const A = HWAstral, d = new Date('2026-10-29T04:00:00Z'), day = A.solar({ latitude: 5.352, longitude: 100.538, date: d }), night = A.solar({ latitude: 5.352, longitude: 100.538, date: new Date('2026-10-29T15:00:00Z') });
    const real = HWCampusData.record('ST20'), withH = Object.assign({}, real, { orientationDeg: 90, orientationSource: 'test heading' });
    const indoor = Object.assign({}, real, { survey: { indoorOutdoor: 'Indoor' } }), outdoor = Object.assign({}, withH, { survey: { indoorOutdoor: 'outdoor' } });
    const ends = (acc, top) => Object.assign({}, real, { survey: { bottom: { lat: 5.35, lng: 100.53, accuracy_m: acc }, top } });
    return { all: STAIRS.map(s => A.assess(HWCampusData.record(s.id), day).level), real: A.assess(real, day), night: A.assess(real, night), indoor: A.assess(indoor, day),
      h: A.assess(withH, day), out: A.assess(outdoor, day), bad: A.assess(real, A.solar({ latitude: 99, longitude: 0, date: d })),
      far: A.headingOf(ends(2, { lat: 5.3503, lng: 100.53, accuracy_m: 2 })), short: A.headingOf(ends(5, { lat: 5.35004, lng: 100.53, accuracy_m: 5 })), noacc: A.headingOf(ends(null, { lat: 5.3503, lng: 100.53 })) }; });
  assert.ok(r.all.every(l => l === 1), 'today the data supports level 1 for every staircase (no heading, no indoor/outdoor)');
  assert.equal(r.real.kind, 'noheading'); assert.equal(r.real.title, 'Orientation unavailable');
  assert.equal(r.night.kind, 'night'); assert.equal(r.indoor.kind, 'indoor'); assert.equal(r.indoor.title, 'Indoor shade not assessed');
  assert.equal(r.h.level, 2); assert.match(r.h.title, /on your right|ahead|behind|on your left/); assert.match(r.h.text, /does not say whether this staircase is indoors or outdoors/);
  assert.match(r.out.text, /does not tell you whether the steps are in sun or shade/); assert.doesNotMatch(r.out.title + r.out.text, /\bin (the )?shad(e|ow)\b(?! is)/i);
  assert.equal(r.bad.level, 0);
  near(r.far.deg, 0, 1e-6, 'bottom→top bearing used: 33 m apart, ±2 m each'); assert.equal(r.short, null, '4 m apart with ±5 m GPS: too uncertain'); assert.equal(r.noacc, null, 'no GPS accuracy: not used');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the Navigator\'s Compass in a staircase\'s Details: real inputs, conventions, qualified wording, a timer that stops', async () => {
  const { page, ctx, errors } = await openApp({ before: p => p.clock.install({ time: new Date('2026-10-29T04:30:00Z') }), context: { timezoneId: 'Asia/Kuala_Lumpur' } });
  await page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async o => { await o.click({ force: true }); });
  await page.evaluate(() => HWCampusData.start('ST14')); await page.waitForSelector('#astral');
  const r = await page.evaluate(() => { const n = document.getElementById('astral'), s = HWAstral.solar({ latitude: HWCampusData.record('ST14').latitude, longitude: HWCampusData.record('ST14').longitude, date: new Date() });
    return { txt: n.textContent.replace(/\s+/g, ' '), az: +n.querySelector('.astneedle').dataset.az, rot: n.querySelector('.astneedle').style.transform, want: s.azimuth, inDet: !!n.closest('#cmpdet'), pos: getComputedStyle(n).position,
      label: n.querySelector('.astdial').getAttribute('aria-label'), help: !!n.querySelector('.hwh, [data-a="help"]'), timer: HWAstral.timer }; });
  near(r.az, r.want, 0.01, 'needle at the computed azimuth'); assert.equal(r.rot, 'rotate(' + r.want.toFixed(2) + 'deg)', 'CSS rotate clockwise from north (up)');
  assert.equal(r.inDet, true); assert.equal(r.pos, 'static', 'in the flow of the Details, not over the map');
  assert.match(r.txt, /Sun bearing \(azimuth\)\s?15\d\.\d°/); assert.match(r.txt, /Sun height \(elevation\)/); assert.match(r.txt, /geometric/); assert.match(r.txt, /Sun above horizon/);
  assert.match(r.txt, /29 Oct 2026, 12:30 \(your device clock, UTC\+08:00, Asia\/Kuala_Lumpur\)/); assert.match(r.txt, /ST14’s stored location \(5\.35\d\d°, 100\.53\d\d°\)/);
  assert.match(r.txt, /Orientation unavailable/); assert.match(r.txt, /LEVEL 1 OF 4/); assert.match(r.txt, /does not measure shade, air temperature, humidity or UV/);
  assert.doesNotMatch(r.txt, /\b(safe|dangerous|danger|heart rate)\b/i, 'no safety verdicts, no heart-rate prediction');
  assert.match(r.label, /^Compass: the Sun is at 15\d degrees/); assert.equal(r.help, true); assert.ok(r.timer > 0, 'refreshing while on screen');
  await page.click('#astral > summary'); assert.equal(await page.$eval('#astral', e => e.open), false);
  await go(page, 'home'); assert.equal(await page.evaluate(() => HWAstral.timer), 0, 'the timer stops when the page is left');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('hw_astral')).open), 0, 'collapsed state kept as a device preference');
  assert.deepEqual(errors, []); await ctx.close();
});

test('night, reduced motion and a phone: no glow, no sideways scroll; an unplaced staircase uses the approximate campus point', async () => {
  const { page, ctx, errors } = await openApp({ viewport: { width: 360, height: 760 }, before: p => p.clock.install({ time: new Date('2026-10-29T15:00:00Z') }), context: { reducedMotion: 'reduce' } });
  await page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async o => { await o.click({ force: true }); });
  await page.evaluate(() => HWCampusData.start('ST20')); await page.waitForSelector('#astral');
  const r = await page.evaluate(() => ({ night: document.querySelector('.astdial').classList.contains('night'), glow: document.querySelector('.astdial').classList.contains('glow'),
    tr: getComputedStyle(document.querySelector('.astneedle')).transitionDuration, txt: document.getElementById('astral').textContent, w: document.documentElement.scrollWidth }));
  assert.equal(r.night, true); assert.equal(r.glow, false); assert.ok(parseFloat(r.tr) <= 0.01, 'needle transition ' + r.tr); assert.match(r.txt, /Sun below horizon/); assert.match(r.txt, /No direct sunlight now/); assert.ok(r.w <= 360, 'width ' + r.w);
  // ST02 has no coordinate when the survey is not loaded (file://): the college's approximate point is used, and labelled
  await page.evaluate(() => HWCampusData.start('ST02')); await page.waitForSelector('#astral');
  assert.match(await page.$eval('#astral', e => e.textContent), /approximate point for Kolej MARA Kulim[\s\S]*Approximate location/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the staircase list: easiest first (Mild, Moderate, Vigorous, then by angle), each row its ST code and angle only', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'campus'); await page.click('[data-a="cmptab"][data-t="list"]').catch(() => {});
  const L = await page.$$eval('#cmplist .cmpitem', b => b.map(x => ({ id: x.dataset.id, meta: x.querySelector('.cmpmeta').textContent })));
  const cat = await page.evaluate(() => Object.fromEntries(STAIRS.map(s => [s.id, [{ MILD: 1, MODERATE: 2, VIGOROUS: 3 }[s.cat], s.angle]])));
  assert.equal(L.length, 36);
  for (let i = 1; i < L.length; i++) { const a = cat[L[i - 1].id], b = cat[L[i].id]; assert.ok(a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]), L[i - 1].id + ' before ' + L[i].id); }
  assert.ok(L.findIndex(x => x.id === 'ST36') < L.findIndex(x => x.id === 'ST13'), 'ST36 (Mild, added later) sits with the Mild stairs');
  assert.ok(L.every(x => /^ST\d\dθ \d+\.\d\d°(Not on the map)?$/.test(x.meta)), L.map(x => x.meta).join(' | '));
  assert.ok(L.every(x => !/real|Measured location/i.test(x.meta)));
  assert.deepEqual(errors, []); await ctx.close();
});

/* ---------- the live map (http + software WebGL), as tests/89 opens it ---------- */
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', geojson: 'application/geo+json', css: 'text/css', webp: 'image/webp', png: 'image/png', woff2: 'font/woff2', webmanifest: 'application/manifest+json', glb: 'model/gltf-binary' };
let server, base, browser;
before(async () => {
  server = http.createServer((q, res) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, path.normalize(p));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port + '/';
  const req = createRequire(import.meta.url); let pw; try { pw = req('playwright'); } catch { pw = createRequire(path.join(execSync('npm root -g').toString().trim(), 'noop.js'))('playwright'); }
  browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
});
after(async () => { if (browser) await browser.close(); await new Promise(r => server.close(r)); });
const STUB_BUILDINGS = 'export function createModelLayer() { return { id: "models", type: "custom", renderingMode: "3d", onAdd() {}, render() {}, onRemove() {}, replace() {}, light() {}, get ready() { return false; } }; }';
async function mapPage(o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'reduce', timezoneId: 'Asia/Kuala_Lumpur',
    permissions: ['geolocation'], geolocation: { latitude: 5.35154, longitude: 100.53803, accuracy: 10 }, ...o });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.clock.install({ time: new Date('2026-10-29T02:30:00Z') });
  await page.route('**/observatory/models3d.js', r => r.fulfill({ contentType: 'text/javascript', body: STUB_BUILDINGS }));
  await page.route('**/assets/models/**/*.glb', r => r.fulfill({ status: 404, body: 'not found' }));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.fulfill({ status: 200, body: '' }));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify({ ...RETURNING, s: { ...RETURNING.s, live: 0 } }));
  await page.goto(base); await page.waitForFunction(() => typeof HWLoader !== 'undefined' && HWLoader.done, null, { timeout: 30000 });
  await page.evaluate(() => go('campus'));
  return { ctx, page, errors };
}
const covering = page => page.evaluate(() => { const a = document.getElementById('asthud'), r = a.getBoundingClientRect(), hit = new Set();
  for (let x = r.left + 1; x < r.right; x += 3) for (let y = r.top + 1; y < r.bottom; y += 3) for (const e of document.elementsFromPoint(x, y)) {
    if (a.contains(e) || e.contains(a) || e.closest('.maplibregl-canvas-container') || e.closest('.maplibregl-marker')) continue;
    if (!/^(cmpslot|cmpmap|maplibregl-map)/.test(e.className) && !/^cmp(sky|fog|rain|tint)/.test(e.className)) hit.add(e.tagName + '.' + e.className); }
  return [...hit]; });

test('map: the loading screen stays inside the map square, under the bottom tabs', async () => {
  const { ctx, page, errors } = await mapPage();
  await page.waitForSelector('.hwload.inbox', { timeout: 30000 });
  const r = await page.evaluate(() => { HWCampusHud.aware(false); const st0 = document.getElementById('cmpstage').getBoundingClientRect(); window.scrollBy(0, st0.top - (innerHeight - 260)); const st = document.getElementById('cmpstage'), l = document.querySelector('.hwload.inbox'), nav = document.querySelector('nav');
    const s = st.getBoundingClientRect(), b = l.getBoundingClientRect(), n = nav.getBoundingClientRect(), x = n.left + n.width / 2, y = n.top + n.height / 2;
    return { b: [b.top, b.bottom, b.left, b.right].map(Math.round), s: [s.top, s.bottom, s.left, s.right].map(Math.round), inside: b.top >= s.top - 1 && b.bottom <= s.bottom + 1 && b.left >= s.left - 1 && b.right <= s.right + 1, iso: getComputedStyle(st).isolation, under: s.bottom > n.top,
      top: document.elementFromPoint(x, y).closest('nav') !== null, at: (e => e.tagName + '.' + e.className + ' < ' + [...(function*(n){while(n){yield n.tagName+'#'+n.id+'.'+String(n.className).slice(0,20)+'['+getComputedStyle(n).zIndex+'/'+getComputedStyle(n).position+']';n=n.parentElement}})(e)].join(' < '))(document.elementFromPoint(x, y)), nav: [...(function*(n){while(n){yield n.tagName+'#'+n.id+'['+getComputedStyle(n).zIndex+'/'+getComputedStyle(n).position+'/'+getComputedStyle(n).transform+']';n=n.parentElement}})(nav)].join(' < ') }; });
  assert.equal(r.inside, true, JSON.stringify(r)); assert.equal(r.iso, 'isolate');
  assert.equal(r.under, true, 'precondition: the map runs under the bottom tabs');
  assert.equal(r.top, true, 'the bottom tabs stay on top of the loading screen ' + JSON.stringify(r));
  assert.deepEqual(errors, []); await ctx.close();
});

test('map: the sun compass sits beside the HealthWiz button, overlaps nothing, and turns with the map', async () => {
  const { ctx, page, errors } = await mapPage();
  await page.waitForFunction(() => HWCampus.state.map === 'ready' && !document.querySelector('.hwload.inbox'), null, { timeout: 120000 });
  await page.evaluate(() => HWCampusHud.aware(false));
  for (const w of [360, 390, 412, 768, 1100]) {
    await page.setViewportSize({ width: w, height: 800 }); await page.waitForTimeout(400);
    assert.deepEqual(await covering(page), [], 'nothing under the compass at ' + w + ' px');
    const g = await page.evaluate(() => { const a = document.getElementById('asthud').getBoundingClientRect(), b = document.querySelector('.hudbtn').getBoundingClientRect(), s = document.getElementById('cmpstage').getBoundingClientRect();
      return { a: [a.left, a.right, a.top, a.bottom].map(Math.round), s: [s.left, s.right, s.top, s.bottom].map(Math.round), inStage: a.left >= s.left && a.right <= s.right && a.bottom <= s.bottom, nearBtn: Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 140 }; });
    assert.equal(g.inStage, true, 'inside the map at ' + w + ' ' + JSON.stringify(g)); assert.equal(g.nearBtn, true, 'beside the HealthWiz button at ' + w + ' ' + JSON.stringify(g));
  }
  const want = await page.evaluate(() => { const s = HWCampusData.record('ST14'), k = HWLive.KMK; return HWAstral.solar({ latitude: k.lat, longitude: k.lon, date: new Date() }).azimuth; });
  near(+await page.$eval('#asthud .astneedle', e => e.dataset.az), want, 0.5, 'the campus point while nothing is picked (the clock runs: about 0.25° a minute)');
  await page.evaluate(() => HWCampus.map.map.setBearing(90)); await page.waitForTimeout(200);
  assert.equal(await page.$eval('#asthud', e => e.style.getPropertyValue('--b')), '-90deg', 'north on the dial follows north on the map');
  await page.click('#asthud');
  const pop = await page.$eval('#asthudp', e => e.textContent.replace(/\s+/g, ' '));
  assert.match(pop, /NAVIGATOR’S COMPASS/); assert.match(pop, /Bearing/); assert.match(pop, /Height/); assert.match(pop, /its N is the map’s north/); assert.match(pop, /Pick a staircase/);
  assert.equal(await page.$eval('#asthud', e => e.getAttribute('aria-expanded')), 'true');
  await page.keyboard.press('Escape'); assert.equal(await page.$('#asthudp'), null);
  await page.evaluate(() => HWCampus.focus('ST14')); await page.waitForTimeout(600);
  await page.click('#asthud'); await page.click('[data-a="astfull"]'); await page.waitForSelector('#astral[open]');
  assert.deepEqual(errors.filter(e => !/\.glb|404/.test(e)), []); await ctx.close();
});
