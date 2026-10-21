// Observatory integration, Phase 1 (docs/OBSERVATORY_INTEGRATION_PROMPT.md): one set of staircase records built from
// STAIRS + HWStairs.STUDY + the survey overlay (js/v6-campus-data.js), and the two-way links with the Stairs page.
//   * logging lives in the Observatory's Details (owner's request, 2026-10-20): a staircase picked there is logged in
//     place, the view stays, a refresh and a second tap create no second session; existing records and history are
//     unchanged; the old START / RETURN / FIND trip is gone;
//   * a staircase without coordinates: listed, selectable, never placed, logged in its Details;
//   * the survey file: never requested from file://; over http its values are laid over the records with the prototype's
//     labels, and STAIRS itself is never changed. The survey values below are made-up test values, not campus data.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, state, RETURNING, entry, fillSteps } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', json: 'application/json', webmanifest: 'application/manifest+json', png: 'image/png', webp: 'image/webp', css: 'text/css', woff2: 'font/woff2' };
let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, path.normalize(p));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port + '/';
});
after(async () => { await closeBrowser(); await new Promise(r => server.close(r)); });

const stairs = s => s.e.filter(e => e.c === 'stair');
// a history that must come through untouched: old stair sessions (one without m.sid), a pulse entry and a meal
const HISTORY = [entry('stair', 60, 3, { sid: 'ST20', loc: 'old name', steps: 20, climbs: 3 }), entry('stair', 40, 2, { steps: 20, climbs: 2 }),
  entry('pulse', 72, 1, { st: 'Resting' }), entry('water', 250, 1)];
const SEED = { ...RETURNING, e: HISTORY, gp: { ok: 0, v: { ST20: '2026-10-01' } } };
const openObs = async (o = {}) => { const r = await openApp({ seed: SEED, ...o }); await go(r.page, 'campus'); await r.page.waitForSelector('#cmpcard'); return r; };
// the Observatory's kept state (from the file there is no map, so no camera: tests/71-observatory-map checks that)
const view = page => page.evaluate(() => { const s = HWCampus.state; return { sid: s.sid, grp: s.grp, tab: s.tab, f: s.f, q: s.q, mode: s.mode }; });
const logClimb = async (page, steps = 12, climbs = 2) => { await fillSteps(page, '#ss', String(steps)); await page.fill('#sc', String(climbs)); await page.click('[data-a="savestair"]'); };

test('records: one set built from STAIRS + the F21 study, with computed statuses and flags; STAIRS unchanged; no survey request from file://', async () => {
  const reqs = [];
  const { page, errors } = await openApp({ seed: SEED, before: p => p.on('request', r => reqs.push(r.url())) });
  const before = await page.evaluate(() => JSON.stringify(STAIRS));
  await go(page, 'campus'); await page.waitForSelector('#cmpcard');
  const r = await page.evaluate(() => {
    const R = HWCampusData.records(), by = id => R.find(s => s.id === id);
    return { ids: R.map(s => s.id).join(), stairs: STAIRS.map(s => s.id).join(), n: R.length,
      est: R.filter(s => s.locationStatus === 'estimated').length, miss: R.filter(s => s.locationStatus === 'missing').map(s => s.id),
      step: ['ST14', 'ST19', 'ST20'].map(id => { const s = by(id), q = HWStairs.STUDY.find(x => x.id === id); return [s.measuredStep.rise_m === q.rise, s.measuredStep.run_m === q.run, s.angleStatus, s.measurementStatus, s.estimatedAngle === STAIRS.find(x => x.id === id).angle]; }),
      others: R.filter(s => s.measuredStep).length, flagged: R.filter(s => s.needsChecking).map(s => s.id).sort(),
      shared: by('ST31').sharedLocationWith, labels: HWCampusData.labels(by('ST02')).map(l => l[1]), labels20: HWCampusData.labels(by('ST20')).map(l => l[1]),
      survey: HWCampusData.survey, note: HWCampusData.surveyNote() };
  });
  assert.equal(r.ids, r.stairs, 'the same IDs, in STAIRS order');
  assert.equal(r.n, 32);
  assert.equal(r.est, 28);
  assert.deepEqual(r.miss, ['ST02', 'ST08', 'ST16', 'ST29']);
  for (const x of r.step) assert.deepEqual(x, [true, true, 'calculated from measured step rise and run', 'partially measured', true]);
  assert.equal(r.others, 3, 'only the three F21 stairs have a measured step size');
  assert.deepEqual(r.flagged, ['ST08', 'ST10', 'ST21', 'ST27', 'ST31', 'ST32', 'ST33']);
  assert.deepEqual(r.shared, ['ST06', 'ST32']);
  assert.deepEqual(r.labels, ['No location recorded', 'Estimated angle', 'Orientation not surveyed', 'Not yet surveyed']);
  assert.deepEqual(r.labels20, ['Estimated location', 'Angle from measured steps', 'Orientation not surveyed', 'Partially measured: step size only']);
  assert.equal(r.survey.status, 'local');
  assert.match(r.note, /Survey data: not loaded \(the app was opened from this device/);
  assert.match(await page.textContent('.cmpsv'), /Survey data: not loaded/);
  assert.equal(await page.evaluate(() => JSON.stringify(STAIRS)), before, 'STAIRS is never changed');
  assert.deepEqual(reqs.filter(u => /stair-survey/.test(u)), [], 'no request for the survey file from file://');
  assert.deepEqual(errors, []);
});

test('log in place: a staircase picked in the Observatory is logged in its Details; the view stays; refresh and a second tap add nothing; no trip links', async () => {
  const { page, errors } = await openObs();
  // filter, search and select ST20 from the list
  await page.click('[data-a="cmpfilt"][data-f="part"]');
  await page.fill('#cmpq', 'kenanga');
  await page.click('#cmplist .cmpitem[data-id="ST20"]');
  const v0 = await view(page);
  assert.deepEqual(v0, { sid: 'ST20', grp: null, tab: 'det', f: 'part', q: 'kenanga', mode: 'fantasy' });
  // its Details start with the logging forms, for this staircase; picking saves nothing
  assert.match(await page.textContent('#cmplog-t'), /LOG A CLIMB HERE/);
  assert.match(await page.textContent('#cmplog .stloc'), /penjana elektrik/);
  assert.deepEqual(await page.evaluate(() => [S.v, HWStairs.pick, S.pb.on]), ['campus', 'ST20', 0]);
  assert.equal(stairs(await state(page)).length, 2, 'picking saves nothing');
  assert.equal(await page.locator('[data-a="cmpstair"], [data-a="cmpback"], [data-a="cmpfind"], #cmpbar').count(), 0, 'no START / RETURN / FIND trip any more');
  // save one casual climb in Details: one session for ST20; still on the Observatory with the same view; a second tap adds nothing
  await logClimb(page);
  await page.click('[data-a="savestair"]');
  let s = await state(page);
  assert.equal(stairs(s).length, 3, 'one new session');
  const saved = stairs(s).at(-1);
  assert.deepEqual([saved.m.sid, saved.m.kind, saved.v], ['ST20', 'casual', 24]);
  assert.equal(await page.evaluate(() => S.v), 'campus');
  assert.deepEqual(await view(page), v0, 'staircase, tab, filter and search kept');
  assert.match(await page.textContent('#cmpdet'), /penjana elektrik[\s\S]*You saved 2 stair sessions here \(last \d{4}-\d\d-\d\d\) · first GPS check-in 2026-10-01/);
  // refresh: nothing is saved again (a person refreshes seconds later; Chromium writes sessionStorage, where the test's
  // seeding is marked done, shortly after a change)
  await page.waitForTimeout(3000);
  await page.reload(); await page.waitForSelector('.wl');
  assert.equal(stairs(await state(page)).length, 3, 'a refresh creates no session');
  // existing records and history are unchanged
  s = await state(page);
  for (const h of HISTORY) assert.deepEqual(s.e.find(e => e.id === h.id), h, 'unchanged: ' + h.id);
  assert.deepEqual(s.gp, SEED.gp);
  assert.deepEqual(errors, []);
});

test('picking another staircase moves the log to it; HWCampusData.start selects and opens Details without saving; an old trip key is cleared', async () => {
  const { page, errors } = await openApp({ seed: SEED, before: p => p.addInitScript(() => sessionStorage.setItem('hw_obs_ctx', JSON.stringify({ sid: 'ST20' }))) });
  assert.equal(await page.evaluate(() => sessionStorage.getItem('hw_obs_ctx')), null, 'the old trip context is removed');
  await go(page, 'campus'); await page.waitForSelector('#cmpcard');
  assert.equal(await page.evaluate(() => HWCampusData.start('ST20')), true);
  assert.deepEqual(await page.evaluate(() => [S.v, HWCampus.selected, HWCampus.state.tab, HWStairs.pick]), ['campus', 'ST20', 'det', 'ST20']);
  assert.equal(stairs(await state(page)).length, 2, 'start saves nothing');
  await page.click('#cmptab-list'); await page.click('#cmplist .cmpitem[data-id="ST19"]'); await page.waitForSelector('#cmplog');
  assert.match(await page.textContent('#cmplog .stloc'), /Blok Aisyah/);
  await logClimb(page);
  assert.equal(stairs(await state(page)).at(-1).m.sid, 'ST19', 'saved for the staircase picked now');
  assert.deepEqual(errors, []);
});

test('a staircase without coordinates: selectable from the list, never placed; logged in its Details', async () => {
  const { page, errors } = await openObs();
  await page.click('#cmplist .cmpitem[data-id="ST02"]');
  assert.deepEqual(await view(page), { sid: 'ST02', grp: null, tab: 'det', f: 'all', q: '', mode: 'fantasy' });
  assert.equal(await page.evaluate(() => HWCampus.points().some(g => g.items.some(s => s.id === 'ST02'))), false, 'never a map point');
  assert.match(await page.textContent('#cmpdet'), /Tangga Selangkah Menara Gading[\s\S]*No location recorded, so it is not placed on the map\.[\s\S]*No location recorded[\s\S]*Estimated angle/);
  assert.deepEqual(await page.evaluate(() => [S.v, HWStairs.pick]), ['campus', 'ST02']);
  assert.match(await page.textContent('#cmplog .stloc'), /Tangga Selangkah Menara Gading[\s\S]*no map coordinates/);
  await logClimb(page);
  assert.equal(stairs(await state(page)).at(-1).m.sid, 'ST02');
  assert.deepEqual(errors, []);
});

test('the phone layout fits 360 px: the log in Details, its SAVE a full-size tap target', async () => {
  const { page, errors } = await openApp({ seed: SEED, viewport: { width: 360, height: 760 }, context: { isMobile: true, hasTouch: true } });
  await go(page, 'campus'); await page.waitForSelector('#cmpcard');
  await page.click('#cmplist .cmpitem[data-id="ST14"]'); await page.waitForSelector('#cmplog');
  assert.match(await page.textContent('#cmpdet'), /Kenanga/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'no sideways scroll');
  const b = await page.$eval('#cmplog [data-a="savestair"]', e => { const r = e.getBoundingClientRect(); return { h: r.height, right: r.right }; });
  assert.ok(b.h >= 44 && b.right <= 360, 'SAVE is a full-size tap target on screen');
  assert.deepEqual(errors, []);
});

// made-up test values in the importer's output format (not campus data)
const FIXTURE = { about: 'TEST FIXTURE: made-up values', source: null, buildings: [], answers: {}, warnings: [], stairs: {
  ST20: { id: 'ST20', building: 'TEST block', indoorOutdoor: 'outdoor', lowerLevel: null, upperLevel: null, shape: null, flightCount: 1,
    bottom: { lat: 5.35195, lng: 100.53841, accuracy_m: 6 }, top: null, survey: { by: 'TEST', date: '2026-10-20', tool: 'tape' },
    flights: [{ flight: 1, risers: 10, riser_cm: 17, tread_cm: 31, width_cm: 150, totalRise_cm: null, heading_deg: 90, landing: null, turn: null, notes: null }],
    complete: { position: true, flights: true, record: true } },
  ST02: { id: 'ST02', building: null, indoorOutdoor: null, lowerLevel: null, upperLevel: null, shape: null, flightCount: null, bottom: null, top: null,
    survey: { by: null, date: null, tool: null }, flights: [{ flight: 1, risers: 8, riser_cm: 15, tread_cm: 30, width_cm: null, totalRise_cm: null, heading_deg: null, landing: null, turn: null, notes: null }],
    complete: { position: false, flights: false, record: false } } } };

test('over http: the committed (empty) survey changes nothing; a survey is laid over the records with measured / calculated labels; STAIRS unchanged', async () => {
  // the committed file: fetched, nothing imported yet, the records are the app's
  const a = await openApp({ seed: SEED, url: base });
  await a.page.waitForSelector('.wl');
  await go(a.page, 'campus'); await a.page.waitForFunction(() => HWCampusData.survey.status === 'ok');
  assert.equal(await a.page.evaluate(() => HWCampusData.survey.stairs), 0);
  assert.match(await a.page.textContent('.cmpsv'), /Survey data: none imported yet\./);
  assert.equal(await a.page.evaluate(() => HWCampusData.record('ST20').locationStatus), 'estimated');
  assert.deepEqual(a.errors, []);
  // a survey (test fixture)
  const b = await openApp({ seed: SEED, url: base, before: p => p.route('**/data/stair-survey.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) })) });
  await b.page.waitForSelector('.wl');
  const st0 = await b.page.evaluate(() => JSON.stringify(STAIRS));
  await go(b.page, 'campus'); await b.page.waitForFunction(() => HWCampusData.survey.status === 'ok');
  await b.page.waitForFunction(() => /2 staircases from the survey sheet/.test(document.querySelector('.cmpsv').textContent));
  const r = await b.page.evaluate(() => { const s = HWCampusData.record('ST20'), u = HWCampusData.record('ST02');
    return { lat: s.latitude, lng: s.longitude, ls: s.locationStatus, src: s.locationSource, app: s.app.latitude, ang: s.surveyAngle, est: s.estimatedAngle, n: s.stepCount,
      rise: s.verticalRise_m, rs: s.verticalRiseStatus, o: s.orientationDeg, ms: s.measurementStatus, gs: s.geometryStatus, plan: HWCampusData.surveyPlan(s),
      lab: HWCampusData.labels(s).map(l => l[1]), u: [u.latitude, u.locationStatus, u.surveyAngle, u.measurementStatus, HWCampusData.surveyPlan(u)], ulab: HWCampusData.labels(u).map(l => l[1]),
      marker: HWCampus.points().some(g => g.lat === 5.35195 && g.lng === 100.53841 && g.items.some(x => x.id === 'ST20')), placed: HWCampus.points().some(g => g.items.some(x => x.id === 'ST02')) }; });
  // θ = arctan(17 / 31) = 28.74°; rise = 10 × 17 cm = 1.70 m (calculated: no measured total rise)
  assert.deepEqual([r.lat, r.lng, r.ls, r.app, r.ang, r.est, r.n, r.rise, r.rs, r.o, r.ms, r.gs],
    [5.35195, 100.53841, 'measured', 5.3519878, 28.74, 28.52, 10, 1.7, 'calculated (risers × riser height)', 90, 'surveyed', 'surveyed']);
  assert.match(r.src, /^Survey sheet \(TEST, 2026-10-20, tape\), phone GPS at the bottom step, ±6 m$/);
  assert.deepEqual(r.plan, [{ n: 10, riser: 0.17, tread: 0.31, width: 1.5, turn: null, landingLength: null, landingWidth: null }]);
  assert.deepEqual(r.lab, ['Measured location (survey)', 'Angle from surveyed steps', 'Measured orientation', 'Surveyed']);
  // partial survey without a position: still not placed; θ calculated; no 3D plan; the record is flagged incomplete
  assert.deepEqual(r.u, [null, 'missing', 26.57, 'partially measured', null]);
  assert.deepEqual(r.ulab, ['No location recorded', 'Angle from surveyed steps', 'Orientation not surveyed', 'Partially surveyed', 'Survey record incomplete']);
  assert.ok(r.marker, 'the marker moved to the measured point');
  assert.equal(r.placed, false, 'a staircase with no coordinates is never placed');
  assert.equal(await b.page.evaluate(() => JSON.stringify(STAIRS)), st0, 'survey values are never written into STAIRS');
  assert.equal(await b.page.evaluate(() => STAIRS.find(s => s.id === 'ST20').lat), 5.3519878);
  assert.deepEqual(b.errors, []);
  // a survey file that cannot be read: the app's values, and the page says so
  const c = await openApp({ seed: SEED, url: base, before: p => p.route('**/data/stair-survey.json', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{not json' })) });
  await c.page.waitForSelector('.wl');
  await go(c.page, 'campus'); await c.page.waitForFunction(() => HWCampusData.survey.status === 'error');
  await go(c.page, 'campus');
  assert.match(await c.page.textContent('.cmpsv'), /Survey data: the survey file could not be loaded\. The app's own values are shown\./);
  assert.equal(await c.page.evaluate(() => HWCampusData.record('ST20').locationStatus), 'estimated');
  assert.deepEqual(c.errors, []);
});
