// The Health Score page (js/v6-score.js): one 0–100 score from ten weighted indicators in six areas, fruit & veg from the log,
// five recommendation areas and the reasons for the weights.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const wk = (hrB, hrA, dur, diff, angle, n = 0) => entry('stair', 40, n, { loc: 'ST', diff, angle, steps: 40, climbs: 1, dur, hrB, hrA, kind: 'workout' });
const boot = async seed => { const r = await openApp({ seed }); await r.page.waitForSelector('.wl'); await go(r.page, 'score'); return r; };
const full = { ...RETURNING, e: [wk(70, 130, 5, 'MODERATE', 28), wk(72, 110, 5, 'MILD', 20, 1), wk(68, 160, 5, 'VIGOROUS', 40, 2),
  entry('stress', 3, 0), entry('bmi', 22, 0, { h: 170, w: 63 }), entry('water', 2000, 0, {})] };

test('Health Hall has a Health Score tile and the page opens with no data without errors', async () => {
  const { page, ctx, errors } = await boot(RETURNING);
  assert.match(await page.textContent('#main'), /No data yet for this period/);
  await go(page, 'health');
  assert.ok((await page.$$eval('#hub [data-v]', b => b.map(x => x.dataset.v))).includes('score'));
  assert.deepEqual(errors, []); await ctx.close();
});

test('score uses the stated weights; missing indicators are left out, not zero', async () => {
  const { page, ctx, errors } = await boot(RETURNING);
  // only stress logged: score = stress sub-score alone
  const one = await page.evaluate(() => { st.e.push({ id: 'a', c: 'stress', v: 4, m: {}, n: '', d: today(), t: '10:00' }); IXc = null; return HWScore.compute().score; });
  assert.equal(one, Math.round((10 - 4) / 9 * 100));
  assert.equal(await page.evaluate(() => Object.values(HWScore.WT).reduce((a, b) => a + b, 0)), 100);
  await ctx.close();
  const r = await boot(full); const c = await r.page.evaluate(() => HWScore.compute());
  assert.equal(c.covered, 5); assert.ok(c.score > 0 && c.score <= 100);
  assert.match(await r.page.textContent('#main'), /HOW YOUR SCORE ADDS UP[\s\S]*RECOMMENDATIONS[\s\S]*WHY THESE WEIGHTS/);
  for (const t of ['Healthy eating habits', 'Stair climbing and exercise level', 'Stress management', 'Maintaining a healthy BMI', 'Improving cardiovascular fitness', 'Sleep']) assert.match(await r.page.textContent('#main'), new RegExp(t));
  assert.deepEqual(errors, []); await r.ctx.close();
});

test('fruit & veg portions come from the nutrition log (80 g a portion, dried fruit 30 g); nothing entered by hand', async () => {
  const food = (name, por, qty = 1, pm = 1) => entry('food', 50, 0, { name, por, qty, pm, meal: 'lunch', src: 'KOLEJ MARA KULIM' });
  const seed = { ...RETURNING, e: [food('Epal Merah', '130g'), food('Sayur Campur', '60g', 2), food('Kismis', '10g'), food('Nasi Putih', '150g'), food('Kurma', '3 biji')] };
  const { page, ctx, errors } = await boot(seed);
  const L = await page.evaluate(() => HWScore.fvFoods(today()));
  assert.deepEqual(L.map(x => x.name), ['Epal Merah', 'Sayur Campur', 'Kismis', 'Kurma'], 'rice is not a fruit or vegetable');
  const want = 130 / 80 + 2 * 60 / 80 + 10 / 30 + 1; // a serving with no weight counts as one portion
  assert.ok(Math.abs(L.reduce((a, x) => a + x.portions, 0) - want) < 1e-9);
  const sub = await page.evaluate(() => HWScore.compute().I.fv.sub);
  assert.ok(Math.abs(sub - want / 5 * 100) < 1e-9);
  assert.equal(await page.locator('#ffv').count(), 0, 'the card moved to Nutrition');
  await go(page, 'food');
  assert.match(await page.textContent('#ffv'), /FRUIT & VEGETABLES TODAY[\s\S]*Epal Merah[\s\S]*Sayur Campur/);
  await go(page, 'score');
  assert.equal(await page.locator('[data-a="fvup"], [data-a="fvdn"], #main [data-a="go"]:not([data-v="health"])').count(), 0, 'no buttons to log from this page');
  assert.deepEqual(errors, []); await ctx.close();
});

test('no fruit or veg logged: the indicator is left out, not zero', async () => {
  const { page, ctx, errors } = await boot(RETURNING);
  assert.equal(await page.evaluate(() => HWScore.compute().I.fv), null);
  await go(page, 'food');
  assert.match(await page.textContent('#ffv'), /0 of 5 portions[\s\S]*None logged today yet/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('no data-table export or STEM Lab in the app (those belong in the written reports)', async () => {
  const { page, ctx, errors } = await boot(full);
  assert.equal(await page.locator('[data-a="sccsv"], #v6lab').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('sleep, calorie intake, macronutrients and calories burned are scored from the logs', async () => {
  const seed = { ...RETURNING, e: [
    entry('food', 200, 0, { name: 'Nasi Putih', por: '150g', qty: 1, pm: 1, meal: 'lunch' }),
    entry('food', 300, 0, { name: 'Ayam Goreng', por: '1 ketul', qty: 1, pm: 1, meal: 'lunch' }),
    entry('sleep', 6, 0, { bed: '00:30', wake: '06:30' }),
    entry('stair', 40, 0, { loc: 'ST', diff: 'MILD', angle: 20, steps: 40, climbs: 1, dur: 10, hrB: 70, hrA: 120, kind: 'workout', kcal: { v: 120, lo: 110, hi: 130, m: 'met' } })] };
  const { page, ctx, errors } = await boot(seed);
  const I = await page.evaluate(() => HWScore.compute().I);
  assert.equal(I.sleep.sub, 50, '6 h against 8–10 h for a 16-year-old: 2 h short');
  assert.equal(I.kcal.val, 500); assert.equal(I.kcal.sub, 0, 'far below the 2200 kcal target');
  assert.ok(I.macro && I.macro.sub >= 0 && I.macro.sub <= 100);
  const sum = I.macro.val.P + I.macro.val.C + I.macro.val.F; assert.ok(Math.abs(sum - 100) < 1e-6, 'macro % add up to 100');
  assert.equal(I.burn.val, 120); assert.equal(I.burn.sub, 80, '120 of 150 kcal a day');
  assert.equal(await page.evaluate(() => HWScore.compute().covered), 4, 'nutrition, activity, heart rate, sleep');
  assert.match(await page.textContent('#main'), /Calorie intake[\s\S]*Macronutrients[\s\S]*Calories burned[\s\S]*Sleep/);
  assert.deepEqual(errors, []); await ctx.close();
});
