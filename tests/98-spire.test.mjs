// Spire of Trials (js/v6-spire.js): a GPS-verified Stair Sense climb with a personal board per staircase. Worked examples for the rules,
// the GPS gate (25 m), a full ranked trial with a faked motion sensor, the cases that are saved but not ranked, privacy, and the m.sp
// marker surviving the backup / merge / reload pipelines.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go, state, RETURNING, entry, pickStair } from './helpers.mjs';

after(closeBrowser);
const ST19 = { lat: 5.3525206, lng: 100.5386027 };                       // 9 steps, rise 0.157 m (Group 14 survey)
const near = (acc, dLat = 0.00002, dLng = 0.00002) => ({ latitude: ST19.lat + dLat, longitude: ST19.lng + dLng, accuracy: acc });
const GRANT = 'window.DeviceMotionEvent = window.DeviceMotionEvent || function () {}; DeviceMotionEvent.requestPermission = () => Promise.resolve("granted");';
const SEED = { ...RETURNING, gp: { ok: 1, v: {} } };
async function boot({ geo, seed = SEED } = {}) {
  const r = await openApp({ seed, before: p => p.addInitScript(GRANT) });
  await r.ctx.grantPermissions(['geolocation']); if (geo) await r.ctx.setGeolocation(geo);
  await r.page.waitForSelector('.wl'); await go(r.page, 'stair'); await pickStair(r.page, 'ST19'); await r.page.waitForSelector('#sptrial');
  return r;
}
// the page's clock can be moved forward, so a 12 s climb does not need a 12 s wait (the timer reads Date.now())
const skew = (page, ms) => page.evaluate(ms => { if (!window.__real) { window.__real = Date.now; window.__off = 0; Date.now = () => window.__real() + window.__off; } window.__off = ms; }, ms);
/** Walk (one motion event every 20 ms, a swing on top of gravity) until Stair Sense has counted `n` steps, at most 9 s. */
const walkTo = (page, n, hz = 2.6) => page.evaluate(([n, hz]) => new Promise(done => {
  const t0 = performance.now(), id = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    window.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x: 0.2, y: 0.1, z: 9.81 + 3 * Math.sin(2 * Math.PI * hz * t) } }));
    if (HWGravity.live.steps >= n || t > 9) { clearInterval(id); done(HWGravity.live.steps); }
  }, 20);
}), [n, hz]);
const stairs = s => s.e.filter(e => e.c === 'stair');
const card = page => page.evaluate(() => HWSpire.card().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));

test('rules: surveyed steps, staircase eligibility, the 25 m gate and its radius (worked examples)', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const S = HWSpire, q = id => STAIRS.find(s => s.id === id);
    return { n19: S.totalSteps(q('ST19')), none: [S.totalSteps(null), S.totalSteps({ steps: [] }), S.totalSteps({ steps: [3, 0] }), S.totalSteps({ steps: [3, 2.5] })],
      ok19: S.stairOk(q('ST19')), noXY: S.stairOk({ lat: null, lng: 100, steps: [5] }), noSteps: S.stairOk({ lat: 5, lng: 100 }), noStair: S.stairOk(null),
      gate: [S.gate(25, 0), S.gate(25.1, 0), S.gate(12, 47), S.gate(12, 48), S.gate(10, 45), S.gate(10, 46), S.gate(NaN, 0), S.gate(-1, 0), S.gate(10, NaN)].map(x => x.ok),
      weak: S.gate(40, 0).why, far: S.gate(10, 1000).why, k: [S.ACC_MAX, S.TOL, S.MIN_SPS],
      eligibleCount: STAIRS.filter(s => s.lat != null && s.lng != null && S.totalSteps(s)).length }; });
  assert.equal(r.n19, 9);
  assert.deepEqual(r.none, [null, null, null, null]);
  assert.deepEqual([r.ok19.ok, r.ok19.n], [true, 9]);
  assert.match(r.noXY.why, /no GPS point yet/); assert.match(r.noSteps.why, /steps have not been surveyed/); assert.match(r.noStair.why, /Pick a staircase/);
  // accuracy 25 m is allowed, 25.1 m is not; the radius is 35 m + the accuracy (12 m → 47 m; 10 m → 45 m)
  assert.deepEqual(r.gate, [true, false, true, false, true, false, false, false, false]);
  assert.match(r.weak, /GPS signal too weak \(±40 m\)\. Trial mode needs outdoor line-of-sight with an accuracy of 25 m or better/);
  assert.match(r.far, /about 1000 m from this staircase/);
  assert.deepEqual(r.k, [25, 0.2, 0.3]);
  assert.ok(r.eligibleCount >= 30, 'most staircases can host a trial: ' + r.eligibleCount);
  assert.deepEqual(errors, []); await ctx.close();
});

test('rules: a climb is ranked only when every condition holds, each failure says why', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const S = HWSpire, q = id => STAIRS.find(s => s.id === id), big = STAIRS.find(s => S.totalSteps(s) >= 50), N = S.totalSteps(big);
    const T = { sid: big.id, gid: 'g1', paused: 0 }, gv = o => Object.assign({ gid: 'g1', n: N, sensor: N, secs: 60 }, o), ok = (g, t = T, s = big) => S.eligible(g, s, t);
    return { N, base: ok(gv()).ok, noTrial: S.eligible(gv(), big, null).why, gid: ok(gv({ gid: 'x' })).why, paused: ok(gv(), { ...T, paused: 1 }).why, other: ok(gv(), T, q(big.id === 'ST19' ? 'ST20' : 'ST19')).why,
      part: ok(gv({ n: N - 1, sensor: N - 1 })).why, nosensor: ok(gv({ sensor: null })).why,
      edge: [ok(gv({ sensor: Math.round(N * 1.2) })).ok, ok(gv({ sensor: Math.round(N * 1.2) + 2 })).ok, ok(gv({ sensor: Math.round(N * 0.8) })).ok, ok(gv({ sensor: Math.round(N * 0.8) - 2 })).ok],
      fast: [ok(gv({ secs: Math.ceil(N * 0.3) })).ok, ok(gv({ secs: Math.ceil(N * 0.3) - 1 })).ok, ok(gv({ secs: 9 })).ok] }; });
  assert.ok(r.N >= 50); assert.equal(r.base, true);
  assert.match(r.noTrial, /not started from the Spire card/); assert.match(r.gid, /not started from the Spire card/);
  assert.match(r.paused, /paused \(or the screen was hidden\)/); assert.match(r.other, /staircase was changed after the location check/);
  assert.match(r.part, new RegExp('not the full climb of this staircase \\(' + r.N + '\\)')); assert.match(r.nosensor, /sensor was not counting steps/);
  assert.deepEqual(r.edge, [true, false, true, false]);                // within 20 % of the confirmed steps, not beyond
  assert.deepEqual(r.fast, [true, false, false]);                      // at least 0.3 s a step, and never under 10 s
  assert.deepEqual(errors, []); await ctx.close();
});

test('boards: personal best, last against earlier best, best five, vertical speed, malformed entries skipped', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const S = HWSpire, E = (sid, secs, d, o = {}) => ({ c: 'stair', d, t: '10:00', m: { sid, sp: { v: 1, acc: 12 }, gv: { secs, h: 1.413, n: 9, riseSrc: 'study', ...o } } });
    const list = [E('ST19', 40, '2026-10-01'), E('ST19', 35, '2026-10-02'), E('ST19', 38, '2026-10-03'), E('ST19', 50, '2026-10-04'), E('ST19', 45, '2026-10-05'), E('ST19', 41, '2026-10-06'), E('ST19', 37, '2026-10-07'),
      E('ST20', 30, '2026-10-02', { h: 2.2, riseSrc: 'angle' }), E('ST21', 20, '2026-10-02', { h: null }),
      { c: 'stair', d: '2026-10-08', t: '10:00', m: { sid: 'ST19', sp: { v: 2 }, gv: { secs: 5 } } }, { c: 'stair', d: '2026-10-08', t: '10:00', m: { sid: 'ST19', sp: { v: 1 } } },
      E('ST19', 0, '2026-10-08'), E('ST19', -3, '2026-10-08'), { c: 'stair', d: 'x', m: { sid: 7, sp: { v: 1 }, gv: { secs: 9 } } }, { c: 'water', m: { sid: 'ST19', sp: { v: 1 }, gv: { secs: 9 } } }, null, 5, {}];
    const T = S.trials(list), b = S.board(T, 'ST19'), o = S.overview(T);
    return { n: T.length, pb: b.pb.secs, last: [b.last.d, b.last.secs, b.vs], best: b.best.map(x => x.secs), count: b.n, none: S.board(T, 'ST99'),
      ov: o.map(x => [x.sid, Math.round(x.v * 1000) / 1000, x.est]), t: [S.mmss(35), S.mmss(59.6), S.mmss(60), S.mmss(125)] }; });
  assert.equal(r.n, 9);                                              // 7 + ST20 + ST21; the eight malformed or foreign entries are skipped
  assert.equal(r.pb, 35); assert.equal(r.count, 7);
  assert.deepEqual(r.last, ['2026-10-07', 37, 2]);                   // last 37 s; earlier best 35 s → 2 s slower
  assert.deepEqual(r.best, [35, 37, 38, 40, 41]);                    // the best five, fastest first
  assert.equal(r.none, null);
  // vertical speed = h ÷ t: ST19 best 1.413 ÷ 35 = 0.040 (measured); ST20 2.2 ÷ 30 = 0.073 (from the angle: est.); ST21 has no height: left out
  assert.deepEqual(r.ov, [['ST20', 0.073, true], ['ST19', 0.04, false]]);
  assert.deepEqual(r.t, ['0:35', '1:00', '1:00', '2:05']);
  assert.deepEqual(errors, []); await ctx.close();
});

test('card: seeded trials show the personal best, the list and the overview; no trial yet says so', async () => {
  const mk = (n, secs, ex = {}) => entry('stair', 9, n, { sid: 'ST19', loc: 'Tangga', steps: 9, climbs: 1, kind: 'workout', dur: secs / 60, sp: { v: 1, acc: 12 }, gv: { gid: 'g' + n, secs, h: 1.413, n: 9, sensor: 9, riseSrc: 'study', ...ex } });
  const { page, ctx, errors } = await boot({ seed: { ...SEED, e: [mk(1, 44), mk(2, 38)] } });
  const c = await card(page);
  assert.match(c, /PERSONAL BOARD · THIS DEVICE/); assert.match(c, /not a ranking against other people, and not a race/);
  assert.match(c, /Personal best 0:38/); assert.match(c, /Last trial 0:44 \(0:06 slower than your earlier best\)/);   // the 44 s trial is the newer one (1 day ago); the 38 s one (2 days ago) is the best
  assert.match(c, /0:38 · .* · 0\.04 m\/s/); assert.match(c, /All staircases: your best vertical speed/);
  const b = await boot(); assert.match(await card(b.page), /No ranked trials at .* yet/);
  assert.match(await card(b.page), /A full climb here is 9 steps/);
  assert.deepEqual(errors, []); assert.deepEqual(b.errors, []); await ctx.close(); await b.ctx.close();
});

test('GPS gate in the page: location is explained first, one reading, weak or distant readings are refused with the reason, 25 m passes', async () => {
  const { page, ctx, errors } = await boot({ geo: near(12), seed: RETURNING });          // RETURNING: location not yet explained
  await page.evaluate(() => { window.__g = 0; const o = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation); navigator.geolocation.getCurrentPosition = (...a) => { window.__g++; return o(...a); }; });
  await page.click('[data-a="spcheck"]');
  assert.match(await card(page), /reads your location once[\s\S]*never saved or sent/);
  assert.equal(await page.evaluate(() => window.__g), 0, 'nothing is read before the explanation is accepted');
  assert.equal((await state(page)).gp.ok, 0);
  await page.click('[data-a="spallow"]'); await page.waitForFunction(() => HWSpire.state === 'ok');
  assert.equal(await page.evaluate(() => window.__g), 1, 'exactly one reading');
  assert.equal((await state(page)).gp.ok, 1);
  assert.match(await card(page), /Location checked: you are at .* \(accuracy ±12 m\)\. Valid for 5 minutes/);
  // weak signal (indoors): refused, with the outdoor hint, and the reading is not kept
  await ctx.setGeolocation(near(40)); await page.evaluate(() => acts.spcancel()); await page.click('[data-a="spcheck"]');
  await page.waitForFunction(() => HWSpire.state === 'refused');
  assert.match(await card(page), /GPS signal too weak \(±40 m\)\. Trial mode needs outdoor line-of-sight with an accuracy of 25 m or better/);
  assert.equal(await page.locator('[data-a="spstart"]').count(), 0, 'no START TRIAL after a refusal');
  // good accuracy but far from the staircase
  await ctx.setGeolocation(near(10, 0.009, 0)); await page.click('[data-a="spcheck"]'); await page.waitForFunction(() => HWSpire.state === 'refused');
  assert.match(await card(page), /about \d+ m from this staircase\. Stand at it/);
  // exactly 25 m passes, 25.5 m does not
  await ctx.setGeolocation(near(25)); await page.click('[data-a="spcheck"]'); await page.waitForFunction(() => HWSpire.state === 'ok');
  await ctx.setGeolocation(near(25.5)); await page.evaluate(() => acts.spcancel()); await page.click('[data-a="spcheck"]'); await page.waitForFunction(() => HWSpire.state === 'refused');
  assert.deepEqual(errors, []); await ctx.close();
});

test('privacy and expiry: no coordinates are saved by a check; an old check cannot start a trial', async () => {
  const g = near(12, 0.000033, 0.000041);
  const { page, ctx, errors } = await boot({ geo: g });
  const mine = async () => { const x = await state(page); return JSON.stringify({ e: x.e, s: x.s, p: x.p, gp: x.gp }); };
  const before = await mine();
  await skew(page, 0); await page.click('[data-a="spcheck"]'); await page.waitForFunction(() => HWSpire.state === 'ok');
  assert.equal(await mine(), before, 'a location check writes nothing');
  const raw = await page.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).join('|'));
  assert.ok(!raw.includes(String(g.latitude)) && !raw.includes(String(g.longitude)), 'the reading is not stored anywhere');
  await skew(page, 5 * 6e4 + 1000); await page.click('[data-a="spstart"]');
  assert.equal(await page.evaluate(() => HWSpire.state), 'idle', 'a check older than 5 minutes cannot start a trial');
  assert.equal(await page.evaluate(() => HWGravity.state), 'idle', 'Stair Sense did not start');
  assert.deepEqual(errors, []); await ctx.close();
});

test('a full trial is ranked: m.sp is saved with the climb, never the position; the board shows it; it survives a reload', async () => {
  const { page, ctx, errors } = await boot({ geo: near(12) });
  await page.click('[data-a="spcheck"]'); await page.waitForFunction(() => HWSpire.state === 'ok');
  await skew(page, 0); await page.click('[data-a="spstart"]'); await page.waitForFunction(() => HWSpire.state === 'armed');
  assert.match(await card(page), /Trial running\. Climb all 9 steps without pausing/);
  assert.equal(await walkTo(page, 9), 9);
  await skew(page, 15000);
  await page.click('[data-a="gvfinish"]'); await page.fill('#gv-n', '9'); await page.click('[data-a="gvsave"]');
  const e = stairs(await state(page)).pop();
  assert.deepEqual(e.m.sp, { v: 1, acc: 12 });
  assert.equal(e.m.sid, 'ST19'); assert.equal(e.m.gv.n, 9); assert.ok(e.m.gv.secs >= 12 && e.m.gv.secs <= 22, 'timed by Stair Sense: ' + e.m.gv.secs);
  assert.ok(Math.abs(e.m.gv.h - 1.413) < 1e-6, 'h = 9 × 0.157 m');
  const g = near(12); assert.ok(!JSON.stringify(e).includes(String(g.latitude)) && !JSON.stringify(e).includes(String(g.longitude)), 'the user\u2019s reading is not in the entry (only the staircase\u2019s own map point is)');
  const c = await card(page);
  assert.match(c, /Ranked trial saved: 0:\d\d at .* · a new personal best/); assert.match(c, /Personal best 0:\d\d/);
  assert.equal(await page.evaluate(() => HWSpire.state), 'idle');
  await page.waitForTimeout(1500); await page.reload(); await page.waitForSelector('.wl');
  assert.equal(await page.evaluate(() => HWSpire.trials(st.e).length), 1, 'the trial is still on the board after a reload');
  assert.deepEqual(errors, []); await ctx.close();
});

test('saved but not ranked, with the reason: paused, and a partial climb', async () => {
  const { page, ctx, errors } = await boot({ geo: near(12) });
  // paused once
  await page.click('[data-a="spcheck"]'); await page.waitForFunction(() => HWSpire.state === 'ok');
  await skew(page, 0); await page.click('[data-a="spstart"]'); await page.waitForFunction(() => HWSpire.state === 'armed');
  await walkTo(page, 9); await page.click('[data-a="gvpause"]');
  assert.match(await card(page), /You paused, so this climb will not be ranked/);
  await page.click('[data-a="gvresume"]'); await skew(page, 15000);
  await page.click('[data-a="gvfinish"]'); await page.fill('#gv-n', '9'); await page.click('[data-a="gvsave"]');
  let s = stairs(await state(page)); assert.equal(s.length, 1, 'the climb itself is still saved');
  assert.equal('sp' in s[0].m, false, 'no ranking marker');
  assert.match(await card(page), /Saved as a normal Stair Sense climb, not ranked: the climb was paused/);
  // a partial climb: 5 of 9 steps
  await page.evaluate(() => acts.gvnew()); await page.click('[data-a="spcheck"]'); await page.waitForFunction(() => HWSpire.state === 'ok');
  await skew(page, 0); await page.click('[data-a="spstart"]'); await page.waitForFunction(() => HWSpire.state === 'armed');
  await walkTo(page, 5); await skew(page, 15000);
  await page.click('[data-a="gvfinish"]'); await page.fill('#gv-n', '5'); await page.click('[data-a="gvsave"]');
  s = stairs(await state(page)); assert.equal(s.length, 2); assert.equal('sp' in s[1].m, false);
  assert.match(await card(page), /not ranked: the steps \(5\) are not the full climb of this staircase \(9\)/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('an ordinary Stair Sense climb is untouched: no marker, no board entry', async () => {
  const { page, ctx, errors } = await boot({ geo: near(12) });
  await page.click('[data-a="gvstart"]'); await walkTo(page, 9); await skew(page, 15000);
  await page.click('[data-a="gvfinish"]'); await page.fill('#gv-n', '9'); await page.click('[data-a="gvsave"]');
  const e = stairs(await state(page)).pop(); assert.equal('sp' in e.m, false); assert.equal(typeof e.m.gv.secs, 'number');
  assert.equal(await page.evaluate(() => HWSpire.trials(st.e).length), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('m.sp survives the backup import, the cloud/merge path and a save: round trip with { v: 1, acc: 22 }', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => {
    const e = { id: 'rt1', c: 'stair', v: 9, m: { sid: 'ST19', kind: 'workout', steps: 9, climbs: 1, gv: { gid: 'g', secs: 20, n: 9, h: 1.413, riseSrc: 'study' }, sp: { v: 1, acc: 22 } }, n: '', d: '2026-10-30', t: '09:00' };
    const base = JSON.parse(JSON.stringify(st)); base.e.push(e);
    const wire = JSON.parse(JSON.stringify(base));                       // what a backup file carries
    const mg = HWSchema.migrate(wire), san = HWSchema.sanitize(mg.data, DEF)[0], viaImport = san.e.find(x => x.id === 'rt1');
    const tgt = JSON.parse(JSON.stringify(st)), added = bkMerge(tgt, wire), viaMerge = tgt.e.find(x => x.id === 'rt1');
    st.e.push(JSON.parse(JSON.stringify(e))); save();                    // the write to storage follows a moment later
    return { viaImport: viaImport && viaImport.m.sp, viaMerge: viaMerge && viaMerge.m.sp, added, board: HWSpire.board(HWSpire.trials(st.e), 'ST19').pb.secs }; });
  await page.waitForTimeout(800);
  r.viaSave = await page.evaluate(() => { const x = JSON.parse(localStorage.getItem('healthwiz')).e.find(y => y.id === 'rt1'); return x && x.m.sp; });
  assert.deepEqual(r.viaImport, { v: 1, acc: 22 });
  assert.equal(r.added, 1); assert.deepEqual(r.viaMerge, { v: 1, acc: 22 });
  assert.deepEqual(r.viaSave, { v: 1, acc: 22 }); assert.equal(r.board, 20);
  assert.deepEqual(errors, []); await ctx.close();
});

test('file size: the module stays well under the 64 KB limit, and the registrations are in place', () => {
  const size = f => fs.statSync(new URL('../' + f, import.meta.url)).size;
  assert.ok(size('js/v6-spire.js') < 20 * 1024, 'v6-spire.js is ' + size('js/v6-spire.js'));
  assert.ok(size('js/v6-gravity.js') < 32 * 1024, 'the gravity hook stays small');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(html.indexOf('js/v6-gravity.js') < html.indexOf('js/v6-spire.js'), 'loads after Stair Sense'); assert.ok(sw.includes("'js/v6-spire.js'"));
});
