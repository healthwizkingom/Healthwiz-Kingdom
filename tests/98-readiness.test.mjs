// Readiness Index adjustments (js/v6-readiness.js): the Oracle's own 40/30/30 score is untouched; up to three small capped steps from
// your own history are added only when their data exist. Worked examples first, then the Oracle on Home.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const txt = (page, sel) => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());
const tr = (a, s) => ({ tr: { v: 1, e: 'A'.repeat(a) + 'S'.repeat(s), o: 0, sp: 0, s: 1, n: 2 } });   // Abyssal Slumber share = a / (a + s)
const BASE = (() => {   // the Oracle's own seed from tests/93-arcana: sleep 5 h, DASS 50, drop 125 − 115 = 10 → 25 + 6.19 + 7.5 = 38.7
  const s = JSON.parse(JSON.stringify(RETURNING));
  s.e = [entry('water', 750, 0, {}), entry('sleep', 5, 0, {}, '07:00'),
    entry('stress', 7, 1, { dass: { d: 16, a: 14, s: 20, t: 50, i: Array(21).fill(2) } }),
    entry('stair', 28, 0, { kind: 'workout', sid: 'ST20', steps: 28, climbs: 1, hrB: 80, hrA: 125, hrR1: 115, dur: 2, kcal: { v: 30, lo: 25, hi: 35, m: 'met' }, pace: 'Moderate', src: 'manual', hrS: 'manual' })];
  return s;
})();
const RICH = (() => {   // adds: resting pulse 80 against 72 (days 3, 5, 7 = 70, 72, 74); Abyssal 15 % against 10 % (5 earlier nights); yesterday 5,200 J against 2,900 J (3 days)
  const s = JSON.parse(JSON.stringify(BASE));
  const early = [6, 5, 4, 3, 2].map(n => entry('sleep', 7, n, tr(2, 18), '07:00'));
  s.e = [...early, ...s.e.filter(x => x.c !== 'sleep'), entry('sleep', 5, 0, tr(3, 17), '07:00'),
    entry('stair', 20, 3, { hrB: 70 }), entry('stair', 20, 5, { hrB: 72 }), entry('stair', 20, 7, { hrB: 74 }),
    entry('stair', 20, 1, { gv: { W: 5200 } }), ...[8, 9, 10].map(n => entry('stair', 20, n, { gv: { W: 2900 } }))];
  return s;
})();

test('pure steps: worked examples, caps, no bonus for a lower pulse, nothing invented', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => { const R = HWReadiness; return {
    rhr: [R.rhrAdj(74, 68), R.rhrAdj(90, 68), R.rhrAdj(65, 68), R.rhrAdj(null, 68), R.rhrAdj(70, null)],
    deep: [R.deepAdj(18, 15), R.deepAdj(5, 15), R.deepAdj(0, 30), R.deepAdj(40, 10), R.deepAdj(15, 15), R.deepAdj(null, 10)],
    work: [R.workAdj(5200, 2900), R.workAdj(4350, 2900), R.workAdj(4351, 2900), R.workAdj(0, 2900), R.workAdj(5000, null)],
    none: R.apply(60, {}), none2: R.apply(60, { rhr: null, deep: null, work: { y: 0, avg: 2900 } }),
    one: R.apply(60, { rhr: { v: 74, base: 68, n: 6 } }),
    all: R.apply(60, { rhr: { v: 74, base: 68, n: 6 }, deep: { share: 18, avg: 15, n: 8 }, work: { y: 5200, avg: 2900, n: 4 } }),
    hi: R.apply(98, { deep: { share: 40, avg: 10, n: 5 } }).score, lo: R.apply(5, { rhr: { v: 90, base: 60, n: 4 }, work: { y: 9000, avg: 1000, n: 3 } }).score,
    band: [R.band(70), R.band(69.4), R.band(50), R.band(49), R.band(0)], cap: R.CAP }; });
  assert.deepEqual(r.rhr, [-6, -10, 0, null, null]);                 // 74 − 68 = 6 BPM above → −6; capped at −10; a lower pulse earns nothing
  assert.deepEqual(r.deep, [2, -5, -5, 5, 0, null]);                 // 3 points above → round(1.5) = 2; −10 points → −5; capped both ways
  assert.deepEqual(r.work, [-5, 0, -5, null, null]);                 // more than 1.5 × 2,900 = 4,350 J; exactly 4,350 is not more
  assert.equal(r.none, null); assert.equal(r.none2, null);           // no usable input: the Oracle is left exactly as it is
  assert.equal(r.one.score, 54); assert.equal(r.one.total, -6); assert.equal(r.one.pace, 'Moderate pace');
  assert.equal(r.all.total, -6 + 2 - 5); assert.equal(r.all.score, 51); assert.equal(r.all.rows.length, 3);
  assert.equal(r.hi, 100); assert.equal(r.lo, 0);                    // the score stays between 0 and 100
  assert.deepEqual(r.band, ['Full pace', 'Moderate pace', 'Moderate pace', 'Light pace', 'Light pace']);
  assert.deepEqual(r.cap, { rhr: 10, deep: 5, work: 5 });
  assert.deepEqual(errors, []); await ctx.close();
});

test('Oracle with none of the new data: score and wording exactly as before', async () => {
  const { page, ctx, errors } = await openApp({ seed: BASE }); await page.waitForSelector('.wl'); await go(page, 'home');
  const o = await txt(page, '#arc-oracle');
  assert.match(o, /39 \/ 100 readiness index/); assert.match(o, /mild path \(below 26°\)/); assert.match(o, /weights \(40 \/ 30 \/ 30\)/);
  assert.doesNotMatch(o, /Your own history adjusts|Pacing suggestion|Light pace|Moderate pace|Full pace/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Oracle with all three: 38.7 − 8 + 3 − 5 = 28.7 → 29, each row shows its numbers and points, pacing line, labelled as a choice', async () => {
  const { page, ctx, errors } = await openApp({ seed: RICH }); await page.waitForSelector('.wl'); await go(page, 'home');
  const o = await txt(page, '#arc-oracle');
  assert.match(o, /29 \/ 100 readiness index/, o);
  assert.match(o, /Resting pulse 80 BPM against your average of 72 BPM \(3 earlier days\) → −8/);
  assert.match(o, /Abyssal Slumber estimate 15 % against your average of 10 % \(5 earlier nights\), a phone-motion estimate → \+3/);
  assert.match(o, /Yesterday’s climbing work 5,200 J against your average of 2,900 J \(3 earlier days with climbs\) → −5/);
  assert.match(o, /Pacing suggestion: Light pace\. Total adjustment −10 \(range −20 to \+5\)/);
  assert.match(o, /HealthWiz’s choice of small capped steps, not a published formula/);
  assert.match(o, /not a medical measure or advice/);
  assert.doesNotMatch(o, /N3|diagnos|deficien/i);
  assert.doesNotMatch(o, /\p{Extended_Pictographic}/u);
  assert.deepEqual(errors, []); await ctx.close();
});

test('reads only: drawing the Oracle changes no log entry, setting or profile (other modules may award badges on Home)', async () => {
  const { page, ctx, errors } = await openApp({ seed: RICH }); await page.waitForSelector('.wl');
  const mine = async () => { const x = await state(page); return JSON.stringify({ e: x.e, s: x.s, p: x.p }); };
  const before = await mine();
  await go(page, 'home'); await page.waitForTimeout(300);
  assert.equal(await mine(), before);
  assert.deepEqual(errors, []); await ctx.close();
});
