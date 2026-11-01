// Hydrate & Cool (js/v6-hydrate.js): an estimated fluid deficit from the project's energy estimate. Worked examples for the sum, then the
// workout card (unavailable states, the worked figure, live updates, the "?" panel and Vault link), then wording and storage.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go, state, pickStair, stairHistory } from './helpers.mjs';

after(closeBrowser);
const boot = async o => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'pulse'); await stairHistory(r.page); return r; };
const txt = (page, sel) => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());
const settle = page => page.waitForTimeout(60);

test('deficit(): worked examples and every invalid input (worked examples)', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const D = HWHydrate.deficit, o = k => D(k) && { q: D(k).q, kg: D(k).kg, show: D(k).show };
    return { c: [HWHydrate.ETA, HWHydrate.ALPHA, HWHydrate.LV], a: o(100), b: o(266.5), small: o(5), edge: [D(24.3).show, D(24.2).show, D(24.0).show, D(1e-6).show], bad: [D(0), D(-5), D(NaN), D(null), D(undefined), D('100'), D(Infinity)] }; });
  assert.deepEqual(r.c, [0.2, 0.8, 2426]);
  assert.equal(r.a.q.toFixed(3), '80.000');                         // 100 × (1 − 0.2) = 80 kJ of heat
  assert.equal((r.a.kg * 1000).toFixed(2), '41.22'); assert.equal(r.a.show, '41');   // 80 ÷ (0.8 × 2426) = 0.04122 kg = 41.2 mL
  assert.equal(r.b.show, '110');                                    // 266.5 × 0.8 = 213.2; ÷ 1940.8 = 0.10985 kg = 109.9 mL
  assert.equal(r.small.show, '2.1');                                // 5 kJ → 4 kJ → 2.06 mL, one decimal under 10 mL
  assert.deepEqual(r.edge, ['10', '10', '9.9', '0.0']);             // 24.3 → 10.01 mL; 24.2 → 9.97, which rounds to 10 so is shown whole; 24.0 → 9.89
  assert.deepEqual(r.bad, [null, null, null, null, null, null, null]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('card: nothing before a pulse is entered; unavailable states say what to add; the worked figure appears and follows the numbers', async () => {
  const { page, ctx, errors } = await boot();
  assert.equal(await page.locator('#hyd-card').count(), 0, 'no card before any pulse');
  await pickStair(page, 'ST24'); await page.click('[data-a="pace"][data-i="2"]');
  await page.fill('#wk-b', '72'); await settle(page);
  assert.match(await txt(page, '#hyd-card'), /Estimated fluid deficit: unavailable\. Add your pulse after\./);
  await page.fill('#wk-a', '130'); await settle(page);
  assert.match(await txt(page, '#hyd-card'), /unavailable\. Add the workout time/);
  await page.fill('#wk-d', '8'); await settle(page);
  const c = await txt(page, '#hyd-card');
  // energy 266.5 kJ (tests/33); heat 213.2 kJ; 213.2 ÷ (0.8 × 2426) = 0.1099 kg
  assert.match(c, /Estimated fluid deficit: about 110 mL/); assert.match(c, /project’s energy estimate of 267 kJ: 213\.2 kJ of heat/);
  assert.match(c, /ESTIMATE/);
  await page.fill('#wk-d', '16'); await settle(page);
  assert.match(await txt(page, '#hyd-card'), /about 220 mL/, 'twice the time, twice the energy, twice the estimate');   // 533.05 × 0.8 ÷ 1940.8 = 0.2197 kg
  await page.fill('#wk-a', '60'); await settle(page);
  assert.match(await txt(page, '#hyd-card'), /unavailable\. Add an after pulse that is not lower than the pulse before/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('card: the four assumptions are on it, the "?" panel works the sum, and no dehydration, illness or drinking words appear', async () => {
  const { page, ctx, errors } = await boot();
  await pickStair(page, 'ST24'); await page.click('[data-a="pace"][data-i="2"]');
  await page.fill('#wk-b', '72'); await page.fill('#wk-a', '130'); await page.fill('#wk-d', '8'); await settle(page);
  const c = await txt(page, '#hyd-card');
  assert.match(c, /20 %.*movement.*η = 0\.20/); assert.match(c, /80 %.*sweat evaporates.*α = 0\.80/); assert.match(c, /all the heat leaves as sweat, and 1 g of sweat is 1 mL/);
  assert.match(c, /pure water \(NIST, about 31\.6 °C\); real sweat has salts/);
  assert.doesNotMatch(c, /dehydrated\b(?! or)|drink now|you should drink|heat stroke|heat exhaustion|danger|risk of heat|skin temperature|shock/i);
  assert.match(c, /does not say you are dehydrated or at risk/);
  await page.click('#hyd-card .hwh');
  const pop = await txt(page, '#hwh-pop');
  assert.match(pop, /How the estimated fluid deficit is worked out/);
  assert.match(pop, /Heat: 267 × \(1 − 0\.20\) = 213\.2 kJ/); assert.match(pop, /Sweat: 213\.2 ÷ \(0\.80 × 2426\) = 0\.1099 kg/); assert.match(pop, /about 110 mL/);
  assert.match(pop, /real figure is likely lower/); assert.match(pop, /no source in the app gives them/);
  assert.equal(await page.getAttribute('#hwh-pop .hwev a', 'href'), '#vault=hydrate');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []); await ctx.close();
});

test('nothing is saved, and the sources are honest: the Vault entry names NIST only, no USDA, size and registration checks', async () => {
  const { page, ctx, errors } = await boot();
  await pickStair(page, 'ST24'); await page.click('[data-a="pace"][data-i="2"]');
  const before = JSON.stringify((await state(page)).e);
  await page.fill('#wk-b', '72'); await page.fill('#wk-a', '130'); await page.fill('#wk-d', '8'); await settle(page);
  assert.equal(JSON.stringify((await state(page)).e), before, 'the card never writes an entry');
  assert.doesNotMatch(await page.evaluate(() => localStorage.getItem(Object.keys(localStorage).find(k => /hw|health/i.test(k)) || '') || ''), /fluid deficit|hydrate/i);
  const v = await page.evaluate(() => { const c = HWVault.CALCS.find(e => e.id === 'hydrate'); return c && { src: c.src, name: c.name }; });
  assert.deepEqual(v, { src: ['nistwater'], name: 'Estimated fluid deficit' });
  const js = fs.readFileSync('js/v6-hydrate.js', 'utf8');
  assert.ok(js.length < 64 * 1024); assert.doesNotMatch(js, /USDA/i);
  assert.ok(fs.readFileSync('sw.js', 'utf8').includes("'js/v6-hydrate.js'")); assert.ok(fs.readFileSync('index.html', 'utf8').includes('js/v6-hydrate.js'));
  assert.ok(fs.statSync('js/v6-stairs.js').size < 64 * 1024);
  assert.deepEqual(errors, []); await ctx.close();
});
