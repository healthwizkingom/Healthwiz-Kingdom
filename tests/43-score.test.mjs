// The Health Score page (js/v6-score.js): one 0–100 score from five weighted indicators, fruit & veg servings,
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
  for (const t of ['Healthy eating habits', 'Stair climbing and exercise level', 'Stress management', 'Maintaining a healthy BMI', 'Improving cardiovascular fitness']) assert.match(await r.page.textContent('#main'), new RegExp(t));
  assert.deepEqual(errors, []); await r.ctx.close();
});

test('fruit & veg stepper saves per day and feeds the score', async () => {
  const { page, ctx, errors } = await boot(RETURNING);
  for (let i = 0; i < 3; i++) await page.click('[data-a="fvup"]');
  assert.equal((await state(page)).ex.fv[await page.evaluate(() => today())], 3);
  assert.equal(await page.evaluate(() => HWScore.compute().I.fv.sub), 60);
  for (let i = 0; i < 5; i++) await page.click('[data-a="fvdn"]');
  assert.equal(await page.evaluate(() => HWScore.compute().I.fv), null);
  assert.deepEqual(errors, []); await ctx.close();
});

test('no data-table export or STEM Lab in the app (those belong in the written reports)', async () => {
  const { page, ctx, errors } = await boot(full);
  assert.equal(await page.locator('[data-a="sccsv"], #v6lab').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});
