import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const days = n => Array.from({ length: n }, (_, i) => entry('water', 500, i + 1));
const seed = (n, f, extra = {}) => ({ ...RETURNING, e: days(n), mg: { ...RETURNING.mg, c: f ? { water: { f } } : {} }, ...extra });
const boot = async (s, o = {}) => { const r = await openApp({ seed: s, ...o }); await r.page.waitForSelector('.wl'); await go(r.page, 'water'); return r; };

test('well scene follows the original well stage; the original scene is untouched', async () => {
  for (const [n, lv] of [[0, 0], [5, 2], [22, 5]]) {
    const { page, ctx, errors } = await boot(seed(n, 0));
    assert.equal(await page.getAttribute('.wq .v6wqd', 'data-stage'), String(lv), n + ' tracking days');
    for (const sel of ['#wqch', '#wqwtr', '#wqpr', '.wqd i', '.wqp']) assert.equal(await page.locator('#wq ' + sel).count(), 1, sel);
    assert.equal(await page.locator('.v6wqd svg').count() > 2, true);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('discoveries from the game appear on the Water page scene', async () => {
  const { page, ctx, errors } = await boot(seed(0, 4));
  const n = await page.evaluate(() => document.querySelectorAll('.v6wqd svg').length);
  await ctx.close();
  const r = await boot(seed(0, 0));
  const n0 = await r.page.evaluate(() => document.querySelectorAll('.v6wqd svg').length);
  assert.equal(n - n0, 5, 'frog, planter, two butterflies, lantern');
  assert.deepEqual([...errors, ...r.errors], []);
  await r.ctx.close();
});

test('logging water still runs the original flow and adds ripples and a reaction at the pour', async () => {
  const { page, ctx, errors } = await boot(seed(3, 0));
  const before = (await state(page)).e.length;
  await page.click('[data-a="wa"][data-v="250"]');
  await page.waitForSelector('.v6wqr circle.v6wrip', { timeout: 6000 });
  assert.equal(await page.evaluate(() => document.querySelector('.v6wqd').classList.contains('go')), true);
  const s = await state(page);
  assert.equal(s.e.length, before + 1);
  assert.equal(s.e.at(-1).v, 250);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reduced motion: no ripples or particles', async () => {
  const { page, ctx, errors } = await boot(seed(3, 0, { s: { ...RETURNING.s, rm: 1 } }));
  await page.click('[data-a="wa"][data-v="100"]');
  await page.waitForTimeout(3600);
  assert.equal(await page.locator('.v6wrip').count(), 0);
  assert.equal(await page.evaluate(() => HWFX.live), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The Well Garden mini-game was removed. Discoveries it saved earlier still show on the well scene (test above).
test('the Water page has no Well Garden launch card any more', async () => {
  const { page, ctx, errors } = await boot(seed(2, 0));
  assert.equal(await page.locator('#v6gl-water').count(), 0);
  assert.equal(await page.evaluate(() => HWGames.games.some(g => g.id === 'water')), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});
