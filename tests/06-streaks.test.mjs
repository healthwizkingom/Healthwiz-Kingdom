import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const seedDays = days => ({ ...RETURNING, e: days.map(n => entry('water', 250, n)) });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const S = page => page.evaluate(() => ({ c: HWStreaks.current(), g: HWStreaks.gentle() }));

test('current streak counts back from today, or from yesterday while today is still open', async () => {
  for (const [days, want] of [[[0, 1, 2], 3], [[1, 2, 3], 3], [[0, 1, 3, 4], 2], [[2, 3], 0]]) {
    const { page, ctx } = await openApp({ seed: seedDays(days) });
    assert.equal((await S(page)).c, want, 'days ' + days);
    await ctx.close();
  }
});

test('gentle streak: one rest day per week keeps it going; two missed days in a row end it', async () => {
  let o = await openApp({ seed: seedDays(range(0, 20).filter(n => n !== 3 && n !== 10)) });
  let g = (await S(o.page)).g;
  assert.deepEqual([g.days, g.rests], [19, 2]);
  await o.ctx.close();
  o = await openApp({ seed: seedDays(range(0, 20).filter(n => n !== 3 && n !== 4)) });
  g = (await S(o.page)).g;
  assert.equal(g.days, 3);
  await o.ctx.close();
});

test('quest board shows the consistency card with gentle wording and a week view', async () => {
  const { page, ctx, errors } = await openApp({ seed: seedDays([0, 1, 2]) });
  await go(page, 'quests');
  const t = await page.textContent('#v6streak');
  assert.match(t, /Current streak3/);
  assert.match(t, /Rest days are part of the journey/);
  assert.doesNotMatch(t, /fail|broke|lost your|missed/i);
  assert.equal((await page.$$('#v6streak .v6wk span')).length, 7);
  assert.match(await page.textContent('#main'), /best streak/, 'original streak card kept');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('achievements: comeback, feature discovery and focus quest badges via the original badge system', async () => {
  const { page, ctx, errors } = await openApp({ seed: seedDays([9, 10, 4]) });
  await go(page, 'home');
  let st = await state(page);
  assert.ok(st.b['Returning Hero'], 'comeback after a 5-day break');
  for (const v of ['stats', 'guide', 'kingdom', 'badges', 'calc', 'health']) await go(page, v);
  await go(page, 'home');
  st = await state(page);
  assert.equal(Object.keys(st.ex.p).length, 6);
  assert.ok(st.b['Curious Scholar']);
  await page.evaluate(() => { const d = today(); st.q6.f[d] = { id: 'energy', t: 0, why: '', done: d }; save(); });
  await go(page, 'home');
  assert.ok((await state(page)).b['Focus Finder']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no badge rewards body size, weight or eating less', async () => {
  const { page, ctx } = await openApp();
  const names = await page.evaluate(() => BG.map(b => b[1] + ' — ' + b[2]));
  for (const n of names) assert.doesNotMatch(n, /\b(weight|thin|thinner|slim|lose|losing|fat|calorie deficit|under ?eat|skip(ped)? meals?|lower bmi)\b/i, n);
  await ctx.close();
});
