import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const xpFrom = (page, re) => page.evaluate(r => HWEvents.recent('xp:gained').filter(e => new RegExp(r).test(e.reason)).reduce((s, e) => s + e.amount, 0), re);

test('XP allowance: water XP stops after 8 logs today; entries still saved; deleting never refunds', async () => {
  const { page, ctx, errors } = await openApp();
  await page.evaluate(() => { for (let i = 0; i < 10; i++) add('water', 100, {}, '', 0, '08:0' + i, 5, 'Water'); });
  let st = await state(page);
  assert.equal(st.e.length, 10, 'all entries saved');
  assert.equal(await xpFrom(page, '^Water$'), 40);
  await page.waitForFunction(() => /XP for water is full/.test(document.querySelector('#toasts').textContent));
  await page.evaluate(() => { const id = st.e[0].id; acts.del({ id }); add('water', 100, {}, '', 0, 0, 5, 'Water'); });
  assert.equal(await xpFrom(page, '^Water$'), 40, 'delete + re-add gives no XP');
  // backfilling an old day counts against today's allowance too
  await page.evaluate(() => add('water', 300, {}, '', '2026-01-01', '09:00', 5, 'Water'));
  assert.equal(await xpFrom(page, '^Water$'), 40);
  st = await state(page);
  assert.equal(Object.values(st.xl)[0].water, 8);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('gain(0) is silent: no toast, no event', async () => {
  const { page, ctx } = await openApp();
  await page.evaluate(() => { document.querySelector('#toasts').innerHTML = ''; gain(0, 'nothing'); });
  assert.equal(await page.evaluate(() => document.querySelector('#toasts').textContent), '');
  assert.equal(await xpFrom(page, 'nothing'), 0);
  assert.equal(await page.evaluate(() => HWEvents.recent('xp:gained').length), 0);
  await ctx.close();
});

test('exploring a region gives a one-time +5 XP', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'water'); await go(page, 'home'); await go(page, 'water');
  await page.waitForTimeout(50);
  assert.equal(await xpFrom(page, '^Explored Water Valley$'), 5);
  assert.ok((await state(page)).ex.r.water);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('kingdom: renamed states; Flourishing after two thriving weeks; never for BMI or calories', async () => {
  const e = [...range(0, 13).map(n => entry('water', 500, n)), ...range(0, 13).map(n => entry('bmi', 22, n, { h: 170, w: 64 }))];
  const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, e } });
  const L = await page.evaluate(() => Object.fromEntries(HWKingdom.all().map(x => [x.key, x.state])));
  assert.equal(L.water, 'Flourishing');
  assert.equal(L.bal, 'Thriving', 'BMI region tops out at Thriving');
  assert.equal(L.dream, 'Ruined');
  await go(page, 'kingdom');
  const t = await page.textContent('#main');
  assert.match(t, /Water Valley · Flourishing ✿/);
  assert.match(t, /Dream Realm · Ruined/);
  assert.ok(await page.$('.kn.k3.kf'), 'map node glows');
  assert.doesNotMatch(t, /Sprouting|Restored ·/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('region detail: progress, 7-day view, related quests, enter button', async () => {
  const e = range(1, 2).map(n => entry('water', 500, n));
  const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, e } });
  await go(page, 'kingdom');
  await page.click('[data-a="kreg"][aria-label="Details for Water Valley"]');
  const t = await page.textContent('#mo');
  assert.match(t, /RECOVERING/);
  assert.match(t, /2\/7 days logged this week · Developing at 3 days/);
  assert.match(t, /Water quest: Drink 500 ml/);
  assert.equal((await page.$$('#mo .v6wk span')).length, 7);
  await page.click('#mo [data-a="kgo"][data-v="water"]');
  assert.equal(await page.evaluate(() => S.v), 'water');
  assert.equal(await page.evaluate(() => $('#mo').hidden), true, 'panel closes when entering the region');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('kingdom:state event when a log restores a region', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForTimeout(30);
  await page.evaluate(() => add('pulse', 70, { st: 'Resting' }, '', 0, 0, 15, 'Pulse'));
  const ev = await page.evaluate(() => HWEvents.recent('kingdom:state'));
  assert.ok(ev.some(e => e.key === 'heart' && e.from === 'Ruined' && e.to === 'Recovering' && e.up));
  assert.deepEqual(errors, []);
  await ctx.close();
});
