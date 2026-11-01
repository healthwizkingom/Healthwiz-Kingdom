// Minerals in your food (js/v6-micro.js): a 7-day card on the Nutrition page. It draws only values saved on logged foods
// (m.na, m.k, m.mg), counts only foods that had a value (a minimum), shows no value as a gap and never as 0, and cites no target.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const food = (n, m = {}, t = '12:00') => entry('food', 500, n, { name: 'Test dish', por: '1 plate', qty: 1, pm: 1, meal: 'lunch', src: 'KOLEJ MARA KULIM', ...m }, t);
const seedMixed = () => ({ ...RETURNING, e: [
  food(0, { na: 1200, k: 600, mg: 80, mnsrc: 'Source A' }, '08:00'), food(0, { na: 300, k: null, mg: null }, '12:00'), food(0, {}, '19:00'),   // today: 2 of 3 have sodium
  food(1, { na: 800, k: null, mg: 40 }),                                                                                                   // yesterday: no potassium
  food(2, {}),                                                                                                                              // foods, but no values
] });
const open = async o => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'food'); return r; };
const titles = (page, k) => page.$$eval('#mn-' + k + ' .ch > div', b => b.map(x => x.title));

test('day(): sums only foods that have a value, null when none, never 0 for a missing value', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => {
    const f = m => ({ m }), L = [f({ na: 1200 }), f({ na: 300.4 }), f({}), f({ na: null }), f({ na: -5 }), f({ na: '90' }), { m: null }, null];
    return [HWMicro.day('2026-01-01', 'na', L), HWMicro.day('2026-01-01', 'k', L), HWMicro.day('2026-01-01', 'na', []), HWMicro.val(f({ na: 0 }), 'na')];
  });
  assert.deepEqual(r[0], { d: '2026-01-01', total: 1500, n: 2, of: 8 });   // 1200 + 300.4 rounded; null, '', negative, text and missing are not counted
  assert.equal(r[1].total, null); assert.equal(r[1].n, 0);                 // no potassium anywhere: a gap, not 0
  assert.deepEqual(r[2], { d: '2026-01-01', total: null, n: 0, of: 0 });   // no foods: a gap
  assert.equal(r[3], 0, 'a real 0 mg is kept');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the card sits on the Nutrition page: bars hold the sum of foods with a value, gaps are blank, the table shows coverage', async () => {
  const { page, ctx, errors } = await open({ seed: seedMixed() });
  assert.equal(await page.locator('#mn-card').count(), 1);
  assert.match(await page.textContent('#mn-card h3'), /MINERALS IN YOUR FOOD · LAST 7 DAYS/);
  const na = await titles(page, 'na'), k = await titles(page, 'k'), mg = await titles(page, 'mg');
  assert.equal(na.length, 7);
  assert.match(na[6], /: 1500 mg$/);                      // 1200 + 300; the third food had no value and adds nothing
  assert.match(na[5], /: 800 mg$/);
  assert.match(na[4], /: - mg$/, 'a day of foods without values is a gap, not 0');
  assert.match(k[6], /: 600 mg$/); assert.match(k[5], /: - mg$/, 'no potassium yesterday: a gap');
  assert.match(mg[6], /: 80 mg$/); assert.match(mg[5], /: 40 mg$/);
  const t = await page.$$eval('.mnt tr', r => r.map(x => [...x.children].map(c => c.textContent.trim()).join('|')));
  assert.match(t[1], /\|1,500\|600\|80\|2 of 3$/, t[1]);       // newest first: sodium 1,500 / potassium 600 / magnesium 80; most foods with a value 2 of 3
  assert.match(t[2], /\|800\|–\|40\|1 of 1$/, t[2]);
  assert.match(t[3], /\|–\|–\|–\|0 of 1$/, t[3]);              // foods logged, none had a value
  assert.match(t[4], /\|–\|–\|–\|none logged$/, t[4]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('honest wording: estimates, a minimum, no target line, no invented nutrients, no emoji', async () => {
  const { page, ctx, errors } = await open({ seed: seedMixed() });
  const c = await page.textContent('#mn-card');
  assert.match(c, /estimates from web sources, not measurements/);
  assert.match(c, /minimum, not your whole day/);
  assert.match(c, /There is no target line/);
  assert.equal(await page.locator('#mn-card .tg').count(), 0, 'no target line is drawn');
  assert.doesNotMatch(c, /calcium|vitamin|K2|recommended|deficien|diagnos/i);
  assert.doesNotMatch(c, /\p{Extended_Pictographic}/u);
  assert.match(c, /not a medical device/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('no mineral value anywhere: an explanation of how to get values, no empty chart, nothing invented', async () => {
  const { page, ctx, errors } = await open({ seed: { ...RETURNING, e: [food(0), food(1, { na: null, k: null, mg: null })] } });
  assert.equal(await page.locator('#mn-card .mnempty').count(), 1);
  assert.match(await page.textContent('#mn-card .mnempty'), /NO MINERAL VALUES YET[\s\S]*Add More Food[\s\S]*never zero/);
  assert.equal(await page.locator('#mn-card .ch').count(), 0);
  assert.equal(await page.locator('#mn-card table').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('reads only: the saved data is unchanged; fits a phone; keyboard can open the table', async () => {
  const { page, ctx, errors } = await open({ seed: seedMixed(), viewport: { width: 390, height: 800 } });
  const before = JSON.stringify(await state(page));
  await page.click('#mn-card .mntab summary');
  assert.equal(await page.isVisible('.mnt'), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, true, 'no sideways scroll on a phone');
  assert.equal(JSON.stringify(await state(page)), before, 'viewing the card writes nothing');
  assert.deepEqual(errors, []); await ctx.close();
});
