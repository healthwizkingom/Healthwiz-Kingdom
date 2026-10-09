// The Stairs page (js/v6-stairs.js): casual climbing (GPS + by hand), the workout (Pace & Breathe timer, heart rate
// before / after, calorie estimate) and Running in one place, all logging one kind of stair session. No Pulse page,
// no pulse entries, no demo stairway, no invented numbers.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const AT_ST20 = { latitude: 5.35202, longitude: 100.53838, accuracy: 12 };
const boot = async (o = {}) => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'stair'); return r; };
const stairs = s => s.e.filter(e => e.c === 'stair');
// how much of a canvas is not the background: a drawn trace has bright pixels
const lit = (page, id) => page.evaluate(i => { const c = document.getElementById(i), x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] > 300) n++; return n; }, id);

test('one page, three sections in order; Pulse and Running are no longer separate; no demo stairway, nothing pre-selected', async () => {
  const { page, ctx, errors } = await boot();
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return ['id="st-casual"', 'id="v6gps"', 'id="stman"', 'id="st-workout"', 'PACE &amp; BREATHE', 'id="sthrc"', 'id="stseal"', 'id="stlog"', 'id="st-run"', 'id="v6run"'].map(k => h.indexOf(k)); });
  assert.ok(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1])), 'casual → workout → running: ' + order);
  assert.match(await page.textContent('#st-casual'), /WANDERER'S STAIRS[\s\S]*CASUAL STAIR CLIMBING/);
  assert.match(await page.textContent('#st-workout'), /TRIAL OF BREATH[\s\S]*STAIR WORKOUT/);
  assert.match(await page.textContent('#st-run'), /RUNNING ROAD[\s\S]*RUNNING/);
  // no demo / placeholder stairway, no default selection
  assert.equal(await page.evaluate(() => STAIRS.some(s => s.id === 'ST01' || s.angle === 7.26)), false);
  assert.doesNotMatch(await page.textContent('#main'), /7\.26/);
  assert.equal(await page.locator('.sqlist .chip.on').count(), 0, 'no stairway is shown as chosen');
  assert.match(await page.textContent('.stloc'), /No stairway chosen yet/);
  assert.equal(await page.inputValue('#wk-loc'), '');
  // no Pulse page, no separate pulse form or history, no Measure Pulse button
  for (const sel of ['#pb', '[data-a="savepulse"]', '#ecg', '#sd', '#sn']) assert.equal(await page.locator(sel).count(), 0, sel);
  assert.doesNotMatch(await page.textContent('#main'), /MEASURE PULSE|HISTORY \(Time \| Activity \| BPM\)|No pulse entries/);
  // the map is not loaded for someone who only logs stairs
  assert.equal(await page.locator('#map [data-a="runmap"]').count(), 1, 'SHOW MAP placeholder instead of a map download');
  await go(page, 'health');
  const tiles = await page.$$eval('#hub [data-v]', b => b.map(x => x.dataset.v + ':' + x.querySelector('b').textContent));
  assert.deepEqual(tiles.map(t => t.split(':')[0]), ['food', 'sleep', 'stair', 'stress', 'bmi', 'calc', 'stats', 'score']);
  assert.ok(tiles.includes('stair:Stairs & Workout'));
  // old routes land in the right section
  await go(page, 'pulse');
  assert.equal(await page.evaluate(() => S.v), 'stair');
  assert.ok(await page.evaluate(() => Math.abs(document.getElementById('st-workout').getBoundingClientRect().top) < 40), 'Pulse opens the Workout');
  await page.evaluate(() => { window.L = { map: () => ({ on() {}, remove() {}, fitBounds() {}, setView() {} }), tileLayer: () => ({ addTo() {} }), polyline: () => ({ addTo() { return this; }, getBounds() {} }) }; });
  await go(page, 'run');
  assert.equal(await page.evaluate(() => S.v), 'stair');
  assert.ok(await page.evaluate(() => Math.abs(document.getElementById('st-run').getBoundingClientRect().top) < 40), 'Running opens its section');
  assert.equal(await page.locator('#v6run [data-a="runstart"]').count(), 1, 'running controls intact');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('casual climb by hand: needs a stairway and valid counts, saves one unified session, no pulse entry', async () => {
  const { page, ctx, errors } = await boot();
  await page.fill('#ss', '12'); await page.fill('#sc', '2');
  await page.click('[data-a="savestair"]');
  assert.equal((await state(page)).e.length, 0, 'no stairway chosen: nothing saved, nothing invented');
  await page.click('[data-a="cat"][data-c="MODERATE"]');
  await page.click('.sqlist .chip:has-text("penjana elektrik")');
  assert.match(await page.textContent('.stloc'), /penjana elektrik[\s\S]*Moderate[\s\S]*5\.35199/);
  await page.fill('#ss', '0'); await page.click('[data-a="savestair"]');
  assert.equal((await state(page)).e.length, 0, 'invalid counts rejected');
  await page.fill('#ss', '12'); await page.fill('#sc', '2');
  assert.equal(await page.textContent('#tot'), '24');
  await page.click('#stman .hwwb'); await page.fill('#stman [data-hww-in="d"]', '2026-09-30'); await page.fill('#stman [data-hww-in="t"]', '07:15');
  await page.click('[data-a="savestair"]');
  const s = await state(page), e = s.e[0];
  assert.equal(s.e.length, 1);
  assert.equal(e.c, 'stair'); assert.equal(e.v, 24); assert.equal(e.d, '2026-09-30'); assert.equal(e.t, '07:15'); assert.equal(e.n, '');
  assert.deepEqual([e.m.sid, e.m.kind, e.m.src, e.m.steps, e.m.climbs, e.m.hrB, e.m.hrA, e.m.kcal, e.m.lat], ['ST20', 'casual', 'manual', 12, 2, null, null, null, 5.3519878]);
  assert.match(await page.textContent('#stlog'), /penjana elektrik[\s\S]*CASUAL[\s\S]*BY HAND[\s\S]*24 steps \(2 × 12\)/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('GPS check-in writes the same session shape (casual, gps) and selects that stairway', async () => {
  const { page, ctx, errors } = await openApp();
  await ctx.grantPermissions(['geolocation']); await ctx.setGeolocation(AT_ST20);
  await page.waitForSelector('.wl'); await go(page, 'stair');
  await page.click('#v6gps [data-a="gpsfind"]'); await page.click('[data-a="gpsok"]');
  await page.waitForSelector('#v6gps .v6gpl');
  await page.click('[aria-label="Check in at Tangga sebelah rumah penjana elektrik ke Dewan Kenanga"]');
  await page.fill('#gps-s', '20'); await page.fill('#gps-c', '2');
  await page.click('[data-a="gpsconfirm"]');
  await page.waitForFunction(() => /Checked in at/.test(document.querySelector('#v6gps').textContent));
  const e = (await state(page)).e[0];
  assert.deepEqual([e.v, e.n, e.m.sid, e.m.kind, e.m.src, e.m.chk, e.m.hrB, e.m.hrA, e.m.kcal], [40, '', 'ST20', 'casual', 'gps', 'gps', null, null, null]);
  const norm = await page.evaluate(() => HWStairs.all()[0]);
  assert.deepEqual([norm.kind, norm.src, norm.total, norm.lat], ['casual', 'gps', 40, 5.3519878]);
  assert.equal(await page.inputValue('#wk-loc'), 'ST20', 'the workout uses the stairway checked in at');
  assert.match(await page.textContent('#stlog'), /CASUAL[\s\S]*GPS CHECK-IN/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('workout: timer, heart rate before and after (two traces), calorie estimate, one session saved, survives a refresh', async () => {
  const { page, ctx, errors } = await boot();
  // nothing entered: no numbers are made up
  assert.match(await page.textContent('#sthrc'), /BEFORE WORKOUT[\s\S]*AFTER WORKOUT/);
  assert.equal(await page.getAttribute('#st-tr-b', 'data-bpm'), '');
  assert.match(await page.getAttribute('#st-tr-a', 'aria-label'), /not entered/);
  assert.match(await page.textContent('#wk-kcal'), /Pace & Breathe timer, or type the workout time/);
  await page.selectOption('#wk-loc', 'ST24');
  await page.fill('#wk-b', '72');
  await page.click('[data-a="pace"][data-i="2"]');
  await page.click('[data-a="pstart"]');
  await page.waitForTimeout(2200);
  assert.match(await page.textContent('#wk-time'), /^0:0[1-3]$/, 'the rhythm guide times the workout');
  await page.click('[data-a="pstop"]');
  assert.equal(await page.inputValue('#wk-b'), '72', 'typed values survive the re-render');
  // the workout draft survives a reload of the tab
  await page.reload(); await page.waitForSelector('.wl'); await go(page, 'stair');
  assert.equal(await page.inputValue('#wk-b'), '72');
  assert.ok(await page.evaluate(() => HWStairs.draft.secs) >= 1, 'timer kept');
  await page.selectOption('#wk-loc', 'ST24');
  await page.click('[data-a="pace"][data-i="2"]');
  await page.fill('#wk-a', '130');
  await page.waitForTimeout(300);
  assert.equal(await page.getAttribute('#st-tr-b', 'data-bpm'), '72');
  assert.equal(await page.getAttribute('#st-tr-a', 'data-bpm'), '130');
  assert.ok(await lit(page, 'st-tr-b') > 50 && await lit(page, 'st-tr-a') > 50, 'both traces drawn');
  assert.match(await page.textContent('#st-delta'), /72[\s\S]*130[\s\S]*\+58/);
  await page.fill('#wk-s', '30'); await page.fill('#wk-c', '3'); await page.fill('#wk-d', '8');
  // RETURNING profile (onboarding done): 60 kg, 165 cm, 16 y, male. BMR = 600 + 1031.25 − 80 + 5 = 1556.25 kcal/day
  // A = 9.3 MET × 1556.25/1440 × 8 = 80.4; B (Keytel, HR 130) = (−55.0969 + 82.017 + 11.928 + 3.2272)/4.184 × 8 = 80.5
  const kc = await page.textContent('#wk-kcal');
  assert.match(kc, /ESTIMATED ENERGY USED[\s\S]*≈ 80[\s\S]*kcal[\s\S]*estimate, not a measurement[\s\S]*under-18s/);
  await page.click('[data-a="stwsave"]');
  const s = await state(page), e = stairs(s)[0];
  assert.equal(stairs(s).length, 1);
  assert.equal(s.e.filter(x => x.c === 'pulse').length, 0, 'no separate pulse entry');
  assert.deepEqual([e.v, e.m.sid, e.m.kind, e.m.src, e.m.pace, e.m.dur, e.m.hrB, e.m.hrA, e.m.hrS, e.m.kcal.m], [90, 'ST24', 'workout', 'manual', 'Vigorous', 8, 72, 130, 'manual', 'met+hr']);
  assert.ok(e.m.kcal.v >= 79 && e.m.kcal.v <= 81, JSON.stringify(e.m.kcal));
  assert.equal(await page.inputValue('#wk-b'), '', 'the form is cleared after saving');
  assert.match(await page.textContent('#stlog'), /Tangga dalam Blok A[\s\S]*WORKOUT[\s\S]*VIGOROUS[\s\S]*90 steps[\s\S]*8 min[\s\S]*≈80 kcal est\.[\s\S]*Before[\s\S]*72[\s\S]*After[\s\S]*130/);
  assert.equal(await page.locator('#sthrg svg .hb').count(), 1, 'chart: before point');
  assert.equal(await page.locator('#sthrg svg .ha').count(), 1, 'chart: after point');
  // everything that reads heart rate now reads the session
  await go(page, 'home');
  assert.match(await page.textContent('#tstat'), /Heart rate\s*130[\s\S]*after workout/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('missing data: no confirmed profile asks for it (no defaults used); invalid heart rate rejected; no wearable values invented', async () => {
  const seed = { ...RETURNING, s: { ...RETURNING.s, onb: 0 }, e: [entry('water', 250, 0)] };
  const { page, ctx, errors } = await boot({ seed });
  await page.fill('#wk-d', '10');
  const kc = await page.textContent('#wk-kcal');
  assert.match(kc, /NEEDS YOUR PROFILE[\s\S]*never guesses/);
  assert.equal(await page.inputValue('#pf-a'), '', 'the app default age is not shown as if it were yours');
  assert.equal(await page.inputValue('#pf-w'), '');
  await page.fill('#pf-a', '30'); await page.fill('#pf-h', '170');
  await page.click('[data-a="stprof"]');
  assert.equal((await state(page)).p.cfm, undefined, 'incomplete profile not saved');
  await page.selectOption('#pf-s', 'f'); await page.fill('#pf-w', '58');
  await page.click('[data-a="stprof"]');
  const p = (await state(page)).p;
  assert.deepEqual([p.age, p.sex, p.h, p.w, p.cfm], [30, 'f', 170, 58, 1]);
  // F, 58 kg, 170 cm, 30 y: BMR = 580 + 1062.5 − 150 − 161 = 1331.5; Moderate 6.8 MET × 10 min → 62.9 kcal (no heart rate: one method)
  assert.match(await page.textContent('#wk-kcal'), /≈ 63[\s\S]*kcal/);
  assert.doesNotMatch(await page.textContent('#wk-kcal'), /range|under-18s/);
  await page.selectOption('#wk-loc', 'ST03');
  await page.fill('#wk-s', '10'); await page.fill('#wk-c', '1');
  await page.fill('#wk-a', '400');
  await page.click('[data-a="stwsave"]');
  assert.equal(stairs(await state(page)).length, 0, '400 BPM rejected');
  await page.fill('#wk-a', '');
  await page.click('[data-a="stwsave"]');
  const e = stairs(await state(page))[0];
  assert.deepEqual([e.m.kind, e.m.hrB, e.m.hrA, e.m.hrS, e.m.dur, e.m.kcal.v, e.m.kcal.m], ['workout', null, null, undefined, 10, 63, 'met']);
  assert.equal(await page.locator('#stlog .stsh').count(), 0, 'no heart-rate bars for a workout without heart rate');
  assert.match(await page.textContent('#sthrg'), /No workout heart rates yet/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('estimate(): the formula, and it refuses to work without its inputs', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => {
    const P = { age: 25, sex: 'm', h: 180, w: 75 };
    return {
      easy: HWStairs.estimate({ pace: 'Easy', dur: 10 }, P),
      hr: HWStairs.estimate({ pace: 'Moderate', dur: 10, hrA: 140 }, P),
      lowhr: HWStairs.estimate({ pace: 'Moderate', dur: 10, hrA: 70 }, P),
      noP: HWStairs.estimate({ pace: 'Easy', dur: 10 }, null), noD: HWStairs.estimate({ pace: 'Easy' }, P), noPace: HWStairs.estimate({ dur: 5 }, P), MET: HWStairs.MET };
  });
  // M 75 kg 180 cm 25 y: BMR = 750 + 1125 − 125 + 5 = 1755 → 1.21875 kcal/min. Easy 4.5 MET × 10 min = 54.8
  assert.deepEqual([r.easy.v, r.easy.m, r.easy.minor], [55, 'met', false]);
  // Moderate: 6.8 × 1.21875 × 10 = 82.9; Keytel: (−55.0969 + 88.326 + 14.91 + 5.0425)/4.184 × 10 = 127.1 → mean 105
  assert.deepEqual([r.hr.v, r.hr.lo, r.hr.hi, r.hr.m], [105, 83, 127, 'met+hr']);
  assert.equal(r.lowhr.m, 'met', 'a heart rate below 90 BPM is outside the heart-rate equation, so it is not used');
  assert.deepEqual([r.noP.need, r.noD.need, r.noPace.need], ['profile', 'duration', 'pace']);
  assert.deepEqual(r.MET, { Easy: 4.5, Moderate: 6.8, Vigorous: 9.3 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('old data: stair sessions and pulse entries kept untouched; sessions read through one model; pulse history not listed', async () => {
  const old = [
    entry('stair', 24, 2, { sid: 'ST01', loc: 'Tangga Selangkah Menara Gading', diff: 'MILD', steps: 12, climbs: 2, dur: 5, pace: 'Easy', hrB: 70, hrA: 96 }),
    entry('pulse', 96, 2, { st: 'After stairs' }),
    entry('stair', 40, 1, { sid: 'ST20', loc: 'Tangga sebelah rumah penjana elektrik ke Dewan Kenanga', diff: 'MODERATE', steps: 20, climbs: 2, dur: 0, pace: 'Easy', hrB: null, hrA: null, chk: 'gps' }, '09:30'),
    entry('pulse', 64, 1, { st: 'Resting' }, '07:00')];
  old[1].n = 'from stair session'; old[1].t = old[0].t;
  const seed = { ...RETURNING, e: old, b: { 'Stair Starter': '2026-01-01' } };
  const { page, ctx, errors } = await boot({ seed });
  const before = JSON.stringify(seed.e);
  const S2 = await page.evaluate(() => HWStairs.all().map(s => [s.kind, s.src, s.hrB, s.hrA, s.loc]));
  assert.deepEqual(S2, [['workout', 'manual', 70, 96, 'Tangga Selangkah Menara Gading'], ['casual', 'gps', null, null, 'Tangga sebelah rumah penjana elektrik ke Dewan Kenanga']]);
  const txt = await page.textContent('#stlog');
  assert.match(txt, /Tangga Selangkah Menara Gading[\s\S]*WORKOUT/, 'a session logged at the removed placeholder stairway keeps its name');
  assert.doesNotMatch(await page.textContent('#main'), /After stairs|Resting/, 'old pulse entries are not listed');
  for (const v of ['home', 'stats', 'guide', 'kingdom', 'badges', 'quests', 'set']) await go(page, v);
  await go(page, 'set');
  assert.doesNotMatch(await page.textContent('#main'), /from stair session/, 'pulse entries hidden from the entry list');
  assert.equal(await page.locator('select[data-ch="fc"] option:text-is("pulse")').count(), 0);
  await page.reload(); await page.waitForSelector('.wl'); await go(page, 'stair');
  const s = await state(page);
  assert.equal(JSON.stringify(s.e), before, 'nothing in the save was rewritten or deleted (page visits and a reload)');
  // Heartstone Hall still counts the old pulse days and the workout day
  assert.equal(await page.evaluate(() => rng(7).filter(d => logd('pulse', d)).length), 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('360 px: no sideways scroll, sections stack, heart-rate cards fit', async () => {
  const { page, ctx, errors } = await boot({ viewport: { width: 360, height: 760 }, context: { isMobile: true, hasTouch: true } });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  const w = await page.evaluate(() => [...document.querySelectorAll('.sthr,.sthd,#stseal')].map(e => e.getBoundingClientRect()).map(r => r.right <= innerWidth + 1 && r.left >= -1));
  assert.ok(w.length > 4 && w.every(Boolean));
  await page.tap('[data-a="stjump"][data-t="st-workout"]');
  await page.waitForTimeout(700);
  assert.ok(await page.evaluate(() => Math.abs(document.getElementById('st-workout').getBoundingClientRect().top) < 60));
  assert.deepEqual(errors, []);
  await ctx.close();
});
