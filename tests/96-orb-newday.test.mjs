// A new day with nothing logged must not read 100: BMI is the latest log whatever the day, so it alone never makes a day's score.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const bmiOnly = { ...RETURNING, e: [entry('bmi', 22, 3, { h: 170, w: 63 })] };

test('BMI alone gives no score today, and the Hall tile and the Health Score page say so', async () => {
  const { page, ctx, errors } = await openApp({ seed: bmiOnly });
  await page.waitForSelector('.wl');
  assert.equal(await page.evaluate(() => HWScore.compute().score), null);
  await go(page, 'health');
  assert.match(await page.textContent('#hub [data-v="score"]'), /log to see your score/);
  await go(page, 'score');
  assert.match(await page.textContent('#main'), /No data yet for this period/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('one real log today brings the score back, with BMI counted beside it', async () => {
  const { page, ctx, errors } = await openApp({ seed: bmiOnly });
  await page.waitForSelector('.wl');
  const s = await page.evaluate(() => { st.e.push({ id: 'z', c: 'stress', v: 4, m: {}, n: '', d: today(), t: '10:00' }); IXc = null; return HWScore.compute().score; });
  assert.equal(s, Math.round((10 * 100 / 100 + 10 * ((10 - 4) / 9)) / 20 * 100)); // BMI 100 and stress 67, weights 10 + 10
  assert.deepEqual(errors, []); await ctx.close();
});
