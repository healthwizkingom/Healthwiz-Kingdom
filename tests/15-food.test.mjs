import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const meals = n => Array.from({ length: n }, (_, i) => entry('food', 300, i, { name: 'Nasi Putih', meal: 'lunch' }));
const seed = (n, f, extra = {}) => ({ ...RETURNING, e: meals(n), mg: { ...RETURNING.mg, c: f ? { food: { f } } : {} }, ...extra });
const boot = async (s, o = {}) => { const r = await openApp({ seed: s, ...o }); await r.page.waitForSelector('.wl'); await go(r.page, 'food'); return r; };
const play = page => page.evaluate(() => { HWGames.timeScale = 0.05; HWGames.open('food'); });
const ready = page => page.waitForFunction(() => document.querySelector('.v6gf') && !document.querySelector('.v6gf .stall[aria-disabled="true"]'), null, { timeout: 15000 });
async function fill(page, stalls = ['1', '2', '3', '4']) {
  for (const k of stalls) { await ready(page); await page.keyboard.press(k); await page.waitForSelector('.v6fch'); await page.keyboard.press('1'); }
  await ready(page);
}

test('every stall offers real menu foods of its group; choices favour foods not tried yet', async () => {
  const { page, ctx, errors } = await boot(seed(0, 0));
  const r = await page.evaluate(() => {
    const M = HWFood.menu(), o = {};
    for (const s of HWFood.STALLS) o[s.k] = { n: (M[s.k] || []).length, ok: (M[s.k] || []).every(f => s.cats.includes(fcat(f.name)) && F[f.i][0] === f.name && f.k === F[f.i][2]) };
    const all = M.fruit.map(f => f.name), keep = all[0];
    HWGames.data('food').t = all.filter(n => n !== keep);
    o.fresh = HWFood.choices('fruit')[0].name === keep;
    o.water = HWFood.choices('drink')[0].name === 'Air Kosong';
    return o;
  });
  for (const k of ['veg', 'fruit', 'grain', 'protein', 'drink']) { assert.ok(r[k].n >= 3, k); assert.ok(r[k].ok, k); }
  assert.ok(r.fresh, 'an untried food is offered first');
  assert.ok(r.water, 'water is always offered at the drinks stall');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Market Kitchen: launch card, inspect, build a plate, serve, XP once, discovery, no food logged', async () => {
  const { page, ctx, errors } = await boot(seed(3, 0));
  assert.match(await page.textContent('#v6gl-food'), /Market Kitchen[\s\S]*\+10 XP once a day/);
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return h.indexOf('v6gl-food') < h.indexOf('7-DAY NUTRITION LOG'); });
  assert.ok(order, 'launch card before the 7-day log');
  const s0 = await state(page);
  await play(page);
  assert.equal(await page.locator('.v6gf .stall').count(), 5);
  assert.match(await page.textContent('.v6gst'), /Plate 0 \/ 4/);
  assert.equal(await page.isDisabled('.v6gctl button'), true, 'cannot serve an empty plate');
  await page.keyboard.press('1');
  await page.waitForSelector('.v6fch');
  assert.equal(await page.locator('.v6fch button[data-i]').count(), 3);
  assert.match(await page.textContent('.v6fch'), /kcal · P [\d.]+ g · C [\d.]+ g · F [\d.]+ g · Fibre [\d.]+ g\s*EST/);
  await page.click('.v6fch button:has-text("BACK")');
  await fill(page);
  assert.match(await page.textContent('.v6gst'), /Plate 4 \/ 4/);
  assert.equal(await page.locator('.v6gf .plate .q:not(:empty)').count(), 4);
  assert.match(await page.getAttribute('.v6gf .plate', 'aria-label'), /^Plate: .+, .+, .+, .+$/);
  await fill(page, ['5']);
  assert.match(await page.textContent('.v6gst'), /drink ✓/);
  await page.click('.v6gctl button:has-text("SERVE")');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /BALANCED PLATE[\s\S]*about \d+ kcal[\s\S]*not lab values[\s\S]*5 foods new[\s\S]*Nutrition Village: Developing[\s\S]*Spice rack[\s\S]*\+10 XP/);
  let s = await state(page);
  assert.equal(s.xp - s0.xp, 10);
  assert.equal(s.e.length, s0.e.length, 'the game never logs food');
  assert.equal(s.mg.c.food.m, 1);
  assert.equal(s.mg.c.food.t.length, 5);
  assert.equal(s.mg.c.food.f, 1);
  await page.click('[data-g-again]');
  await page.waitForSelector('.v6gf .stall');
  assert.equal(await page.locator('.v6gf .v6fsp').filter({ has: page.locator('rect[fill="#a8693a"][width="2"]') }).count(), 1, 'spice rack in the market');
  await fill(page);
  await page.click('.v6gctl button:has-text("SERVE")');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /already earned/);
  s = await state(page);
  assert.equal(s.xp - s0.xp, 10, 'replays give no XP');
  assert.equal(s.mg.c.food.m, 2);
  assert.equal(s.mg.c.food.f, 1, 'one discovery a day');
  await page.click('.v6gdone [data-gx]');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.match(await page.textContent('#v6gl-food'), /played 2× · 2 meals served · \d+ foods tried/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('picking from a stall again swaps that part; stalls are labelled buttons', async () => {
  const { page, ctx, errors } = await boot(seed(0, 0));
  await play(page);
  assert.equal(await page.getAttribute('.stall[data-k="veg"]', 'aria-label'), 'Vegetables stall, not on the plate yet');
  assert.equal(await page.getAttribute('.stall[data-k="drink"]', 'aria-label'), 'Drinks stall, optional');
  await fill(page, ['1']);
  const first = await page.getAttribute('.stall[data-k="veg"]', 'aria-label');
  assert.match(first, /^Vegetables stall, on the plate: /);
  await page.keyboard.press('1'); await page.waitForSelector('.v6fch');
  const second = await page.evaluate(() => document.querySelector('.v6fch button[data-i="1"] b').textContent.replace(/^2\. /, ''));
  await page.click('.v6fch button[data-i="1"]');
  await ready(page);
  assert.equal(await page.getAttribute('.stall[data-k="veg"]', 'aria-label'), 'Vegetables stall, on the plate: ' + second);
  assert.match(await page.textContent('.v6gst'), /Plate 1 \/ 4/);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.equal((await state(page)).mg.n.food, undefined, 'leaving early is not a play');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the square follows the Nutrition Village state: torn awnings when Ruined, villagers later', async () => {
  for (const [n, torn, folk] of [[0, 1, 0], [5, 0, 3]]) {
    const { page, ctx, errors } = await boot(seed(n, 0));
    await play(page);
    assert.equal(await page.locator('.v6gf svg.torn').count() > 0, !!torn, n + ' days');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.v6gf .v6fsp')].filter(e => e.style.getPropertyValue('--vc')).length), folk, 'villagers');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('reduced motion and a 360 px phone: the game completes and fits, no particles', async () => {
  const { page, ctx, errors } = await boot(seed(5, 4, { s: { ...RETURNING.s, rm: 1 } }), { viewport: { width: 360, height: 800 } });
  await play(page);
  const fits = () => page.evaluate(() => { const b = document.querySelector('.v6gbody'); return b.scrollWidth <= b.clientWidth; });
  assert.ok(await fits());
  await page.click('.stall[data-k="grain"]'); await page.waitForSelector('.v6fch');
  assert.ok(await fits(), 'stall choices fit');
  await page.click('.v6fch button[data-i="0"]');
  await fill(page, ['1', '2', '4']);
  await page.click('.v6gctl button:has-text("SERVE")');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /Nutrition Village: Thriving/);
  assert.equal(await page.evaluate(() => HWFX.live), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});
