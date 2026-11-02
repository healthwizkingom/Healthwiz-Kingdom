// The VO2 card under the heart-rate card on the Workout page (js/v6-stairs.js vo2Card): calculated from today's counted BPM, shows data only.
// Worked example: before 70, after 100, 60 kg → 15.3 × 100 ÷ 70 = 21.857 → 21.9 mL/kg/min; × 60 ÷ 1000 = 1.311 → 1.31 L/min.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const boot = async e => { const r = await openApp({ seed: { ...RETURNING, e } }); await r.page.waitForSelector('.wl'); await go(r.page, 'pulse'); return r; };
const hr = (v, when) => entry('pulse', v, 0, { when });

test('VO2 card appears below the heart-rate card with the calculated values', async () => {
  const { page, ctx, errors } = await boot([hr(70, 'before'), hr(100, 'after')]);
  const t = await page.textContent('#stvo2');
  assert.match(t, /VO₂/); assert.match(t, /21\.9/); assert.match(t, /1\.31/); assert.match(t, /15\.3 × 100 ÷ 70/);
  assert.equal(await page.locator('#stvo2 input, #stvo2 select').count(), 0, 'calculated, not typed');
  const [a, b] = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return ['id="sthrc"', 'id="stvo2"'].map(i => h.indexOf(i)); });
  assert.ok(a >= 0 && b > a, 'after the heart-rate card');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  assert.deepEqual(errors, []); await ctx.close();
});

test('VO2 card is absent without both numbers or when the pulse after is below the pulse before', async () => {
  for (const e of [[], [hr(70, 'before')], [hr(100, 'after')], [hr(90, 'before'), hr(80, 'after')]]) {
    const { page, ctx } = await boot(e);
    assert.equal(await page.locator('#stvo2').count(), 0);
    await ctx.close();
  }
});
