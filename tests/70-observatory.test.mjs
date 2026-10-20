// Observatory integration, Phase 1 (docs/OBSERVATORY_INTEGRATION_PROMPT.md): one set of staircase records built from
// STAIRS + HWStairs.STUDY + the survey overlay (js/v6-campus-data.js), and the two-way links with the Stairs page.
//   * round trip: select on the Observatory → START STAIR SESSION (chooses, never saves) → save on the Stairs page →
//     RETURN TO OBSERVATORY restores the staircase and the map view; refresh, the browser's back and a second tap create
//     no second session; existing records and history are unchanged;
//   * RETURN only after a session for that staircase was really saved and still exists;
//   * a staircase without coordinates: listed, selectable, never placed; FIND ON OBSERVATORY does not move the map;
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

test('round trip: select → START STAIR SESSION (nothing saved) → save → RETURN restores staircase and view; refresh, back and taps add nothing', async () => {
  const { page, errors } = await openObs();
  // filter, search and select ST20 from the list
  await page.click('[data-a="cmpfilt"][data-f="part"]');
  await page.fill('#cmpq', 'kenanga');
  await page.click('#cmplist .cmpitem[data-id="ST20"]');
  const v0 = await view(page);
  assert.deepEqual(v0, { sid: 'ST20', grp: null, tab: 'det', f: 'part', q: 'kenanga', mode: 'fantasy' });
  // START STAIR SESSION: chosen on the Stairs page, no session started or saved, no RETURN yet
  await page.click('#cmpdet [data-a="cmpstair"][data-id="ST20"]');
  assert.deepEqual(await page.evaluate(() => [S.v, HWStairs.pick, STAIRS[S.loc].id, S.pb.on]), ['campus', 'ST20', 'ST20', 0]); // the Stairs section of the Campus page
  assert.match(await page.textContent('.sqlist .chip.on'), /penjana elektrik/);
  assert.equal(stairs(await state(page)).length, 2, 'START saves nothing');
  assert.equal(await page.locator('[data-a="cmpback"]').count(), 0, 'no RETURN before a session is saved');
  assert.equal(await page.locator('[data-a="cmpfind"]').count(), 1);
  assert.equal((await page.evaluate(() => HWCampusData.trip)).sid, 'ST20');
  // save one casual climb: RETURN appears; a second tap on SAVE adds nothing (the form was cleared)
  await logClimb(page);
  await page.click('[data-a="savestair"]');
  let s = await state(page);
  assert.equal(stairs(s).length, 3, 'one new session');
  const saved = stairs(s).at(-1);
  assert.deepEqual([saved.m.sid, saved.m.kind, saved.v], ['ST20', 'casual', 24]);
  assert.match(await page.textContent('#cmpbar'), /Session saved for Tangga sebelah rumah penjana elektrik/);
  // refresh: the title screen as before; nothing is saved again; the trip (this tab only) still offers RETURN
  await page.waitForTimeout(3000); // a person refreshes seconds later; Chromium writes sessionStorage shortly after a change
  await page.reload(); await page.waitForSelector('.wl');
  assert.equal(stairs(await state(page)).length, 3, 'a refresh creates no session');
  await go(page, 'stair');
  assert.equal(await page.evaluate(() => HWStairs.pick), null, 'a refresh forgets the choice, as before');
  assert.equal(await page.locator('[data-a="cmpback"]').count(), 1);
  // the browser's back and forward (the app adds no history entries of its own, so the test makes one with a hash):
  // nothing is saved again
  const len = await page.evaluate(() => history.length);
  await page.evaluate(() => { location.hash = 'back-test'; });
  assert.equal(await page.evaluate(() => history.length), len + 1);
  await page.goBack(); await page.goForward(); await page.goBack();
  assert.equal(stairs(await state(page)).length, 3, 'back and forward create no session');
  assert.equal(await page.locator('[data-a="cmpback"]').count(), 1, 'still offered once');
  // RETURN: the Observatory with the same staircase and the same map view
  await page.click('[data-a="cmpback"]');
  assert.equal(await page.evaluate(() => S.v), 'campus');
  assert.deepEqual(await view(page), v0, 'staircase, tab, filter and search restored');
  assert.match(await page.textContent('#cmpdet'), /penjana elektrik[\s\S]*You saved 2 stair sessions here \(last \d{4}-\d\d-\d\d\) · first GPS check-in 2026-10-01/);
  assert.equal(await page.evaluate(() => HWCampusData.trip), null, 'the trip ends at the Observatory');
  // the app's own BACK, then the Stairs page: no RETURN any more, nothing saved
  await page.click('.back[data-a="go"]');
  assert.equal(await page.evaluate(() => S.v), 'health');
  await go(page, 'stair');
  assert.equal(await page.locator('[data-a="cmpback"]').count(), 0);
  s = await state(page);
  assert.equal(stairs(s).length, 3);
  // existing records and history are unchanged
  for (const h of HISTORY) assert.deepEqual(s.e.find(e => e.id === h.id), h, 'unchanged: ' + h.id);
  assert.deepEqual(s.gp, SEED.gp);
  assert.deepEqual(errors, []);
});

test('RETURN only for a genuinely saved session of the trip\'s staircase: not without a save, not for another staircase, not after a delete, not from a plain visit', async () => {
  const { page, errors } = await openObs();
  // a plain visit to the Stairs page (no trip) and a save: no RETURN
  await go(page, 'stair');
  await page.click('[data-a="cat"][data-c="MODERATE"]'); await page.click('.sqlist .chip:has-text("penjana elektrik")');
  await logClimb(page);
  assert.equal(stairs(await state(page)).length, 3);
  assert.equal(await page.locator('[data-a="cmpback"]').count(), 0, 'not started from the Observatory');
  // a trip to ST20, but the session is saved for another staircase: no RETURN
  await go(page, 'campus');
  assert.equal(await page.evaluate(() => HWCampusData.start('ST20')), true);
  await page.click('.sqlist .chip:has-text("Blok Aisyah")');
  await logClimb(page);
  assert.equal(stairs(await state(page)).at(-1).m.sid, 'ST19');
  assert.equal(await page.locator('[data-a="cmpback"]').count(), 0, 'another staircase');
  // back to ST20 and saved: RETURN; the session deleted again: no RETURN
  await page.click('.sqlist .chip:has-text("penjana elektrik")');
  await logClimb(page);
  assert.equal(await page.locator('[data-a="cmpback"]').count(), 1);
  await page.evaluate(() => { const id = HWCampusData.trip.saved; st.e = st.e.filter(e => e.id !== id); save(); render(); });
  assert.equal(await page.locator('[data-a="cmpback"]').count(), 0, 'a deleted session is not a saved one');
  assert.deepEqual(errors, []);
});

test('a staircase without coordinates: selectable from the list, never placed; START and FIND open it without a marker', async () => {
  const { page, errors } = await openObs();
  await page.click('#cmplist .cmpitem[data-id="ST02"]');
  assert.deepEqual(await view(page), { sid: 'ST02', grp: null, tab: 'det', f: 'all', q: '', mode: 'fantasy' });
  assert.equal(await page.evaluate(() => HWCampus.points().some(g => g.items.some(s => s.id === 'ST02'))), false, 'never a map point');
  assert.match(await page.textContent('#cmpdet'), /Tangga Selangkah Menara Gading[\s\S]*No location recorded, so it is not placed on the map\.[\s\S]*No location recorded[\s\S]*Estimated angle/);
  await page.click('#cmpdet [data-a="cmpstair"][data-id="ST02"]');
  assert.deepEqual(await page.evaluate(() => [S.v, HWStairs.pick]), ['campus', 'ST02']);
  assert.match(await page.textContent('.stloc'), /Tangga Selangkah Menara Gading[\s\S]*no map coordinates/);
  // FIND ON OBSERVATORY: its details (tests/71-observatory-map checks the map does not move)
  await go(page, 'stair'); await page.evaluate(() => { HWStairs.choose('ST02'); render(); });
  await page.click('[data-a="cmpfind"]');
  assert.deepEqual(await page.evaluate(() => [S.v, HWCampus.selected, HWCampus.state.tab]), ['campus', 'ST02', 'det']);
  assert.match(await page.textContent('#cmpdet'), /No location recorded, so it is not placed on the map\./);
  assert.equal(stairs(await state(page)).length, 2, 'nothing written');
  assert.deepEqual(errors, []);
});

test('FIND ON OBSERVATORY selects a mapped staircase and opens its details; the phone layout fits 360 px', async () => {
  const { page, errors } = await openApp({ seed: SEED, viewport: { width: 360, height: 760 }, context: { isMobile: true, hasTouch: true } });
  await go(page, 'stair');
  await page.evaluate(() => { HWStairs.choose('ST14'); render(); });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'Stairs page: no sideways scroll');
  const b = await page.$eval('[data-a="cmpfind"]', e => { const r = e.getBoundingClientRect(); return { h: r.height, right: r.right }; });
  assert.ok(b.h >= 44 && b.right <= 360, 'the link is a full-size tap target on screen');
  await page.click('[data-a="cmpfind"]');
  assert.deepEqual(await page.evaluate(() => [S.v, HWCampus.selected, HWCampus.state.tab]), ['campus', 'ST14', 'det']);
  assert.match(await page.textContent('#cmpdet'), /Kenanga/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 360);
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
