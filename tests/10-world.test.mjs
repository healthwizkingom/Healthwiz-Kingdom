import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('every region shows props for its state; fog thick when all regions are ruined', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'kingdom');
  const lv = await page.$$eval('#kmap .v6prop', els => els.map(e => e.dataset.lv));
  assert.deepEqual(lv, Array(8).fill('0'));
  const fog = +(await page.getAttribute('#kmap .v6fog', 'opacity'));
  assert.ok(fog > 0.3, 'fog ' + fog);
  assert.equal(await page.$('#kmap .v6prop .zwk'), null, 'no villagers in ruined regions');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('thriving and flourishing regions grow cottages, flags and villagers; the fog lifts', async () => {
  const e = [...range(0, 13).map(n => entry('water', 500, n)), ...range(0, 4).map(n => entry('food', 300, n, { name: 'Nasi', meal: 'lunch' }))];
  const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, e } });
  await go(page, 'kingdom');
  const byKey = await page.evaluate(() => { const L = {}; document.querySelectorAll('#kmap .v6prop').forEach((g, i) => { L[KR[i][0]] = +g.dataset.lv; }); return L; });
  assert.equal(byKey.water, 4);
  assert.equal(byKey.food, 3);
  assert.equal(await page.locator('#kmap .v6prop[data-lv="4"] .zwk').count(), 2, 'two villagers when flourishing');
  assert.equal(await page.locator('#kmap .v6prop[data-lv="3"] .zwk').count(), 1);
  const fog = +(await page.getAttribute('#kmap .v6fog', 'opacity'));
  assert.ok(fog < 0.25, 'fog lifted to ' + fog);
  await go(page, 'home');
  assert.ok(await page.$('#kmini .v6world'), 'home mini-map shows the same world');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the kingdom chronicle records region changes (kindly when a region goes quiet)', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForTimeout(30);
  await page.evaluate(() => add('pulse', 70, { st: 'Resting' }, '', 0, 0, 15, 'Pulse'));
  await go(page, 'kingdom');
  assert.match(await page.textContent('#v6chron'), /Heartstone Hall became Recovering/);
  await page.evaluate(() => acts.del({ id: st.e[0].id }));
  const ch = (await state(page)).ex.ch.map(x => x.t);
  assert.ok(ch.some(t => /grew quieter.*It will recover when you return/.test(t)), ch.join(' | '));
  assert.deepEqual(errors, []);
  await ctx.close();
});
