// Estimated effort band (js/v6-effort.js): a share of Tanaka's 208 − 0.7 × age under the workout's peak pulse. Worked examples, then the card.
// Only an effort level: no fuel, EPOC or threshold claims, nothing saved.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, stairHistory, RETURNING } from './helpers.mjs';

after(closeBrowser);
const boot = async o => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'pulse'); await stairHistory(r.page); return r; };
const ADULT = { ...RETURNING, p: { ...RETURNING.p, age: 30, cfm: 1 } };

test('band(): worked examples, edges on the rounded share, no guessing', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => { const E = HWEffort, b = (p, a) => { const x = E.band(p, a); return x && [x.max, x.pct, x.band]; }; return {
    max: [E.maxOf(16), E.maxOf(20), E.maxOf(30), E.maxOf(50), E.maxOf(9), E.maxOf(101), E.maxOf(null)],
    a: b(168, 16),                                   // 208 − 11.2 = 196.8 → 197; 168 ÷ 197 = 85.3 → 85 % vigorous
    edge: [b(118, 30), b(120, 30), b(143, 30), b(144, 30), b(178, 30), b(180, 30)],   // max 187: 63.1 / 64.2 / 76.5 / 77.0 / 95.2 / 96.3
    over: b(200, 30), none: [E.band(null, 30), E.band(168, null), E.band(168, 9), E.band(168, 101), E.band(20, 30), E.band(230, 30), E.band('x', 30)],
    names: E.BANDS.map(x => x[1]) }; });
  assert.deepEqual(r.max, [197, 194, 187, 173, null, null, null]);
  assert.deepEqual(r.a, [197, 85, 'Vigorous']);
  assert.deepEqual(r.edge, [[187, 63, 'Below moderate'], [187, 64, 'Moderate'], [187, 76, 'Moderate'], [187, 77, 'Vigorous'], [187, 95, 'Vigorous'], [187, 96, 'Near-maximal']]);
  assert.deepEqual(r.over, [187, 107, 'Near-maximal']);
  assert.deepEqual(r.none, [null, null, null, null, null, null, null]);   // a missing, out-of-range or non-numeric input gives no band
  assert.deepEqual(r.names, ['Near-maximal', 'Vigorous', 'Moderate', 'Below moderate']);
  assert.deepEqual(errors, []); await ctx.close();
});

test('card: the line appears under the peak, worked steps and a Vault link, wording stays honest', async () => {
  const { page, ctx, errors } = await boot({ seed: ADULT });
  assert.equal(await page.locator('#st-band').count(), 0, 'no peak yet: no band');
  await page.fill('#wk-hi', '168');
  const t = await page.textContent('#st-peak');
  assert.match(t, /Peak 168 BPM ≈ 88% of 220 − age \(190 BPM\)/, 'the existing comparison is unchanged');   // 220 − 30 = 190; 168 ÷ 190 = 88 %
  assert.match(await page.textContent('#st-band'), /Estimated effort: Vigorous · about 90% of an estimated maximum of 187 BPM \(208 − 0\.7 × age\)/);
  assert.match(await page.textContent('#st-band'), /not a measure of fuel, fitness or safety/);
  assert.doesNotMatch(await page.textContent('#st-band'), /under-18/, 'an adult profile has no under-18 note');
  await page.click('#st-band .hwh');
  const pop = await page.textContent('#hwh-pop');
  assert.match(pop, /208 − 0\.7 × 30 = 187 → 187 BPM/); assert.match(pop, /168 ÷ 187 × 100 = 89\.8 % → 90 %/); assert.match(pop, /90 % falls in the Vigorous band/);
  assert.match(pop, /not yet checked them against the guideline/); assert.match(pop, /apparently healthy adults/);
  assert.equal(await page.getAttribute('#hwh-pop .hwev a', 'href'), '#vault=effort');
  await page.keyboard.press('Escape');
  assert.doesNotMatch(await page.textContent('#st-band'), /fat|carb|EPOC|threshold|vagal|diagnos/i);
  assert.doesNotMatch(await page.textContent('#st-band'), /\p{Extended_Pictographic}/u);
  assert.deepEqual(errors, []); await ctx.close();
});

test('under-18 profile gets the adult-guideline note; a changing pulse moves the band; nothing is saved', async () => {
  const { page, ctx, errors } = await boot();   // RETURNING: age 16 → 197
  await page.fill('#wk-hi', '120');
  assert.match(await page.textContent('#st-band'), /Estimated effort: Below moderate · about 61% of an estimated maximum of 197 BPM/);   // 120 ÷ 197 = 60.9
  assert.match(await page.textContent('#st-band'), /for under-18s this is a rough guide only/);
  await page.fill('#wk-hi', '190');
  assert.match(await page.textContent('#st-band'), /Estimated effort: Near-maximal · about 96%/);
  await page.fill('#wk-hi', '');
  assert.equal(await page.locator('#st-band').count(), 0, 'no peak, no band');
  const s = await state(page); assert.equal((s.e || []).filter(e => e.c === 'stair').length, 0, 'viewing a band logs nothing');
  assert.deepEqual(errors, []); await ctx.close();
});
