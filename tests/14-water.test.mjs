import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const days = n => Array.from({ length: n }, (_, i) => entry('water', 500, i + 1));
const seed = (n, f, extra = {}) => ({ ...RETURNING, e: days(n), mg: { ...RETURNING.mg, c: f ? { water: { f } } : {} }, ...extra });
const boot = async (s, o = {}) => { const r = await openApp({ seed: s, ...o }); await r.page.waitForSelector('.wl'); await go(r.page, 'water'); return r; };
const play = async page => { await page.evaluate(() => { HWGames.timeScale = 0.05; HWGames.open('water'); }); };

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

test('Well Garden: launch card, keyboard play, bloom, XP once, discovery, no water logged', async () => {
  const { page, ctx, errors } = await boot(seed(2, 0));
  assert.match(await page.textContent('#v6gl-water'), /Well Garden[\s\S]*\+10 XP once a day/);
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return h.indexOf('v6gl-water') < h.indexOf('WORLD PROGRESSION'); });
  assert.ok(order, 'launch card before World Progression');
  const s0 = await state(page);
  await play(page);
  assert.equal(await page.locator('.v6gw .pt').count(), 5);
  assert.match(await page.textContent('.v6gst'), /Watered 0 \/ 5/);
  for (const k of ['1', '2', '3', '4', '5', '5']) await page.keyboard.press(k);
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /GARDEN BLOOMS[\s\S]*5 bucket trips[\s\S]*Well frog[\s\S]*\+10 XP/);
  let s = await state(page);
  assert.equal(s.xp - s0.xp, 10);
  assert.equal(s.e.length, s0.e.length, 'the game never logs water');
  assert.equal(s.mg.c.water.b, 1);
  assert.equal(s.mg.c.water.f, 1);
  await page.click('[data-g-again]');
  await page.waitForSelector('.v6gw .pt');
  assert.equal(await page.locator('.v6gw .v6wsp').filter({ has: page.locator('rect[fill="#4cae4c"]') }).count(), 1, 'frog in the garden');
  for (let i = 0; i < 8; i++) await page.click('.v6gctl button');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /5 bucket trips[\s\S]*already earned/);
  s = await state(page);
  assert.equal(s.xp - s0.xp, 10, 'replays give no XP');
  assert.equal(s.mg.c.water.b, 2);
  assert.equal(s.mg.c.water.f, 1, 'one discovery a day');
  await page.click('.v6gdone [data-gx]');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.match(await page.textContent('#v6gl-water'), /played 2× · 2 gardens bloomed/);
  assert.equal(await page.locator('.v6wqd svg rect[fill="#4cae4c"]').count() > 0, true, 'frog by the page well');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('patches are labelled buttons that report their state', async () => {
  const { page, ctx, errors } = await boot(seed(0, 0));
  await play(page);
  assert.equal(await page.getAttribute('.pt[data-i="0"]', 'aria-label'), 'Garden patch 1, dry');
  await page.click('.pt[data-i="0"]');
  await page.waitForFunction(() => document.querySelector('.pt[data-i="0"]').getAttribute('aria-label') === 'Garden patch 1, in bloom', null, { timeout: 10000 });
  assert.match(await page.textContent('.v6gst'), /Watered 1 \/ 5/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.equal((await state(page)).mg.n.water, undefined, 'leaving early is not a play');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reduced motion and a 360 px phone: the game still completes and fits', async () => {
  const { page, ctx, errors } = await boot(seed(22, 4, { s: { ...RETURNING.s, rm: 1 } }), { viewport: { width: 360, height: 800 } });
  await play(page);
  const [sw, cw] = await page.evaluate(() => [document.querySelector('.v6gbody').scrollWidth, document.querySelector('.v6gbody').clientWidth]);
  assert.ok(sw <= cw, sw + ' > ' + cw);
  await page.click('.v6gctl button'); await page.click('.v6gctl button'); await page.click('.v6gctl button'); await page.click('.v6gctl button'); await page.click('.v6gctl button');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /Village Restored/);
  assert.equal(await page.evaluate(() => HWFX.live), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});
