// Wake-up alarm on the Sleep page (js/v6-alarm.js) and calories burned for runs (js/v6-running.js).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, go, state, closeBrowser, RETURNING, daysAgo } from './helpers.mjs';

after(closeBrowser);
const EMOJI = /\p{Extended_Pictographic}/u;
const run = (n, dist, dur, extra = {}) => {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(7, 0, 0, 0);
  return { id: 'r' + n + '-' + dist, start: d.toISOString(), end: new Date(+d + dur * 1000).toISOString(), dist, dur, pace: Math.round(dur / (dist / 1000)), route: [], up: 0, ...extra };
};
async function withRuns(runs, seed = RETURNING) {
  return openApp({ seed, before: p => p.addInitScript(r => { if (!sessionStorage.getItem('runs')) { localStorage.setItem('healthwiz_runs', JSON.stringify({ ok: 1, runs: r, del: [] })); sessionStorage.setItem('runs', '1'); } }, runs) });
}

test('MET by speed (Compendium points, interpolated; walking under 6 km/h) and kcal = MET × kg × h', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => [HWRun.met(6), HWRun.met(8), HWRun.met(10), HWRun.met(16), HWRun.met(20), HWRun.met(5), HWRun.met(3),
    HWRun.kcalOf(5000, 1800, 60), HWRun.kcalOf(5, 60, 60), HWRun.kcalOf(1000, 0, 60), HWRun.kcalOf(5000, 1800, null)]);
  assert.deepEqual(r, [6, 8.3, 10, 14.5, 14.5, 3.7, 3.5, 300, null, null, null]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('old runs get calories from their own distance and time; stored values win; totals, goal % and Nutrition line', async () => {
  const { page, ctx, errors } = await withRuns([run(3, 3000, 1200), run(0, 5000, 1800), run(0, 2000, 900, { kcal: { v: 111, met: 8, w: 60 } })]);
  await go(page, 'stair');
  const list = await page.textContent('#v6runs');
  assert.match(list, /≈300 kcal/, 'old run without a stored value: 10 km/h → 10 MET × 60 kg × 0.5 h');
  assert.match(list, /≈111 kcal/, 'a stored value is used as is');
  assert.match(list, /Today: 7\.00 km in 2 runs · 45:00 · ≈411 kcal/);
  assert.match(list, /≈ 19% of today's calorie goal/);
  assert.match(list, /Last 7 days: 10\.00 km in 3 runs/);
  assert.match(list, /±20–30%/);
  assert.ok(await page.locator('#v6runs .pxi-flame').count() >= 3, 'pixel flame beside the calories');
  assert.match(await page.textContent('#v6run'), /CALORIES[\s\S]*kcal burned/);
  await go(page, 'food');
  assert.match(await page.textContent('#nst-food'), /\+411 kcal burned running today/);
  assert.match(await page.textContent('#nst-food'), /\/ 2200 kcal/, 'the food target is not raised');
  assert.equal((await state(page)).s.kcal, 2200);
  assert.ok(!EMOJI.test(await page.textContent('.nsburn')));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('without a confirmed weight: no guess, a prompt to complete the profile', async () => {
  const seed = JSON.parse(JSON.stringify(RETURNING)); seed.s.onb = 0; seed.s.set = 1;
  const { page, ctx, errors } = await withRuns([run(0, 5000, 1800)], seed);
  await go(page, 'stair');
  assert.match(await page.textContent('#v6run'), /needs your weight[\s\S]*never guesses/);
  assert.doesNotMatch(await page.textContent('#v6runs'), /kcal/);
  await page.click('#v6run [data-a="stjump"][data-t="wk-kcal"]');
  assert.equal(await page.locator('#pf-w').count(), 1, 'the profile form is right there');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('haze banner and heat tip sit just above the Running controls', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'stair');
  const order = await page.evaluate(() => { const b = document.querySelector('.v6hzb'), r = document.getElementById('v6run'), h = document.getElementById('st-run');
    return b && r && h ? [!!(h.compareDocumentPosition(b) & 4), !!(b.compareDocumentPosition(r) & 4)] : null; });
  assert.deepEqual(order, [true, true]);
  assert.equal(await page.locator('.v6hzb').count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('alarm card: honest note, suggestion from bedtime + sleep goal + 15 min, settings saved in st.s.alarm, phone layers', async () => {
  const { page, ctx, errors } = await openApp({ viewport: { width: 390, height: 844 } });
  await go(page, 'sleep');
  assert.equal((await state(page)).s.alarm, undefined, 'nothing written until the user changes something');
  const c = await page.textContent('#v6alm');
  assert.match(c, /cannot ring reliably[\s\S]*iPhone/);
  assert.ok(!EMOJI.test(c), 'no emoji in the alarm card');
  for (const n of ['alarm', 'sleep', 'bell']) assert.ok(await page.locator('#v6alm .pxi-' + n).count() >= 1, n + ' icon');
  await page.fill('#al-bed', '23:30');
  assert.match(await page.textContent('#al-sug'), /07:45/, '23:30 + 8 h + 15 min');
  await page.click('[data-a="alsug"]');
  let a = (await state(page)).s.alarm;
  assert.equal(a.t, '07:45'); assert.equal(a.on, 1); assert.deepEqual(a.days, [1, 2, 3, 4, 5]);
  await page.click('[data-a="alday"][data-d="6"]');
  await page.click('[data-a="alsnd"][data-s="bell"]');
  a = (await state(page)).s.alarm;
  assert.deepEqual(a.days, [1, 2, 3, 4, 5, 6]); assert.equal(a.snd, 'bell');
  assert.match(await page.textContent('.v6aln'), /Next: .* 07:45/);
  const ics = await page.evaluate(() => HWAlarm.ics());
  assert.match(ics, /BEGIN:VCALENDAR[\s\S]*DTSTART:\d{8}T074500[\s\S]*RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA[\s\S]*BEGIN:VALARM/);
  assert.equal(await page.evaluate(() => HWAlarm.intent('07:45')), 'intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=7;i.android.intent.extra.alarm.MINUTES=45;S.android.intent.extra.alarm.MESSAGE=HealthWiz%20wake-up;B.android.intent.extra.alarm.SKIP_UI=false;end');
  await page.click('details.v6alp summary');
  await page.click('[data-a="alandroid"]');
  assert.match(await page.textContent('.v6alp'), /Android phones only/, 'a fallback, not a broken link, off Android');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="alics"]')]);
  assert.equal(dl.suggestedFilename(), 'healthwiz-wake-up.ics');
  // the bedside clock opens and closes
  await page.click('#v6alm [data-a="alclock"]');
  assert.ok(await page.isVisible('#v6alc'));
  await page.click('#v6alc [data-a="alclock"]');
  assert.ok(await page.isHidden('#v6alc'));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll at 390 px');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('ringing: no sound before a tap, then snooze 5, ring again, STOP; a one-off alarm turns itself off', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'sleep');
  await page.evaluate(() => { st.s.alarm = { on: 1, t: nowT(), days: [], snd: 'chimes', fade: 1 }; save(); HWAlarm.check(); });
  assert.ok(await page.isVisible('#v6alr'));
  assert.match(await page.textContent('#v6alr'), /TAP TO START THE ALARM SOUND/);
  assert.equal(await page.evaluate(() => HWAlarm.armed), false);
  assert.ok(await page.evaluate(() => document.body.classList.contains('v6wake')), 'the dream scene wakes');
  let a = (await state(page)).s.alarm;
  assert.equal(a.on, 0, 'once: off after ringing'); assert.equal(a.fired, daysAgo(0) + ' ' + a.t);
  await page.click('[data-a="altap"]');
  assert.equal(await page.evaluate(() => HWAlarm.armed), true);
  await page.waitForSelector('#v6alr.up');
  await page.click('[data-a="alsnz"][data-m="5"]');
  assert.ok(await page.isHidden('#v6alr'));
  a = (await state(page)).s.alarm;
  assert.ok(Math.abs(a.snz - Date.now() - 5 * 60e3) < 10e3, 'snoozed 5 min');
  await page.evaluate(() => { st.s.alarm.snz = Date.now() - 1000; save(); HWAlarm.check(); });
  assert.ok(await page.isVisible('#v6alr'));
  assert.match(await page.textContent('#v6alr'), /SNOOZE OVER/);
  await page.click('[data-a="alstop"]');
  assert.ok(await page.isHidden('#v6alr'));
  assert.equal((await state(page)).s.alarm.snz, null);
  assert.equal(await page.evaluate(() => HWAlarm.next()), null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('old saves (no alarm, runs without kcal) load on every page without errors', async () => {
  const { page, ctx, errors } = await withRuns([run(1, 4000, 1500)]);
  for (const v of ['home', 'sleep', 'stair', 'food', 'water', 'stress', 'stats', 'set', 'pulse']) await go(page, v);
  const s = await state(page);
  assert.equal(s.s.alarm, undefined);
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('healthwiz_runs'))).runs[0].kcal, undefined, 'stored runs are not rewritten');
  assert.deepEqual(errors, []);
  await ctx.close();
});
