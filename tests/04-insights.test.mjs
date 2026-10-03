import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry, daysAgo } from './helpers.mjs';

after(closeBrowser);
const seed = e => ({ ...RETURNING, e });
const ins = page => page.evaluate(() => HWInsights.list().map(x => ({ id: x.id, area: x.area, tone: x.tone, text: x.text + ' ' + x.action + ' ' + x.basis })));
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('no data: no Medius card, original guide still works', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'home');
  assert.equal(await page.$('#insh'), null);
  await go(page, 'guide');
  assert.equal(await page.$('#insg'), null);
  assert.match(await page.textContent('#main'), /Start Logging/);   // original insights() card
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('personal baseline: water this week vs last week, shown on home and guide with its basis', async () => {
  const e = [...range(8, 14).map(n => entry('water', 2000, n)), ...range(1, 7).map(n => entry('water', 1000, n))];
  const { page, ctx, errors } = await openApp({ seed: seed(e) });
  const L = await ins(page);
  const w = L.find(x => x.area === 'water');
  assert.equal(w.id, 'water-down');
  assert.match(w.text, /about 1000 mL a day this week, compared with about 2000 mL/);
  assert.match(w.text, /based on 7 \+ 7 logged days/);
  await go(page, 'home');
  assert.match(await page.textContent('#insh'), /Water lower than last week/);
  await go(page, 'guide');
  assert.match(await page.textContent('#insg'), /Water lower than last week/);
  assert.match(await page.textContent('#main'), /Observation/);       // original cards kept below
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('priority: a gap gets a no-guilt welcome first; one insight per area; home shows two', async () => {
  const e = [...range(5, 11).map(n => entry('water', 900, n)), ...range(5, 11).map(n => entry('stress', 8, n)), ...range(5, 11).map(n => entry('sleep', 6, n, { bed: '01:00', wake: '07:00' }))];
  const { page, ctx, errors } = await openApp({ seed: seed(e) });
  const top = await page.evaluate(() => HWInsights.top(5).map(x => x.id));
  assert.equal(top[0], 'gap');
  const areas = await page.evaluate(() => HWInsights.top(5).map(x => x.area));
  assert.equal(new Set(areas).size, areas.length, 'one per area');
  await go(page, 'home');
  assert.equal((await page.$$('#insh .aq')).length, 2);
  assert.match(await page.textContent('#insh'), /Nothing was lost/);
  assert.doesNotMatch(await page.textContent('#insh'), /should|failed|bad/i);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('sleep below the age range and high stress are noticed; wording stays observational', async () => {
  const e = [...range(1, 6).map(n => entry('sleep', 6, n, { bed: '00:30', wake: '06:30' })), ...range(1, 5).map(n => entry('stress', 8, n))];
  const { page, ctx, errors } = await openApp({ seed: seed(e) });
  const L = await ins(page);
  assert.ok(L.find(x => x.id === 'sleep-short' && /8–10 h/.test(x.text)));
  assert.ok(L.find(x => x.id === 'stress-high'));
  for (const x of L) assert.doesNotMatch(x.text, /diagnos|disorder|you have (an?|the) /i);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('"less water than usual today" only after 15:00, never in the morning', async () => {
  const e = range(1, 8).map(n => entry('water', 2000, n));
  for (const [hour, expect] of [[18, true], [9, false]]) {
    const t = new Date(); t.setHours(hour, 0, 0, 0);
    const { page, ctx, errors } = await openApp({ seed: seed(e), before: p => p.clock.setFixedTime(t) });
    const has = (await ins(page)).some(x => x.id === 'water-today');
    assert.equal(has, expect, 'at ' + hour + ':00');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('events: insight:new when logging changes the top list, not on boot; no duplicate announcements', async () => {
  const e = range(1, 7).map(n => entry('stress', 3, n));
  const { page, ctx, errors } = await openApp({ seed: seed(e) });
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => HWEvents.recent('insight:new').length), 0, 'nothing announced at boot');
  await page.evaluate(() => { for (let i = 0; i < 3; i++) add('stress', 9, {}, '', today(), '10:0' + i, 10, 'x'); });
  // today is excluded from completed-day windows, so seed the week as high stress via edit of history
  await page.evaluate(() => { st.e.filter(x => x.c === 'stress' && x.d !== today()).forEach(x => x.v = 9); save(); add('water', 250, {}, '', 0, 0, 5, 'w'); });
  const news = await page.evaluate(() => HWEvents.recent('insight:new').map(e => e.insight.id));
  assert.ok(news.includes('stress-high'), news.join());
  assert.equal(news.filter(x => x === 'stress-high').length, 1);
  const order = await page.evaluate(() => HWEvents.recent().slice(-6).map(e => e.type));
  assert.ok(order.indexOf('xp:gained') < order.lastIndexOf('insights:updated'), 'direct effects before reactions: ' + order);
  assert.deepEqual(errors, []);
  await ctx.close();
});
