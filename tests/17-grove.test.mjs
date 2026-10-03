import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const checkins = n => Array.from({ length: n }, (_, i) => entry('stress', 4, i));
const seed = (n, f, extra = {}) => ({ ...RETURNING, e: checkins(n), mg: { ...RETURNING.mg, c: f ? { grove: { f } } : {} }, ...extra });
const boot = async (s, o = {}) => { const r = await openApp({ seed: s, ...o }); await r.page.waitForSelector('.wl'); await go(r.page, 'stress'); return r; };
const play = page => page.evaluate(() => { HWGames.timeScale = 0.05; HWGames.open('grove'); });
const pick = (page, t) => page.click('.v6opick button:has-text("' + t + '")');
const begin = page => page.click('.v6gctl button:has-text("BEGIN")');

test('Calming Grove: launch card, choose pace and length, breathe, lilies bloom, XP once, no check-in logged', async () => {
  const { page, ctx, errors } = await boot(seed(3, 0));
  assert.match(await page.textContent('#v6gl-grove'), /Calming Grove[\s\S]*\+10 XP once a day/);
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return h.indexOf('v6gl-grove') < h.indexOf('<h3>CHECK-INS'); });
  assert.ok(order, 'launch card before the check-ins');
  const s0 = await state(page);
  await play(page);
  await page.evaluate(() => { HWGames.timeScale = 0.2; });
  assert.match(await page.textContent('.v6gst'), /Choose a pace/);
  assert.equal(await page.getAttribute('.v6opick button >> nth=0', 'aria-pressed'), 'true', 'gentle pace by default');
  assert.equal(await page.getAttribute('.v6opick button:has-text("5 breaths")', 'aria-pressed'), 'true', '5 breaths by default');
  await pick(page, 'Even'); await pick(page, '3 breaths');
  assert.equal(await page.getAttribute('.v6opick button:has-text("Even")', 'aria-pressed'), 'true');
  await begin(page);
  assert.match(await page.textContent('.v6gst'), /Breath 1 \/ 3 · Breathe in/);
  assert.match(await page.textContent('.v6gctl .v6ophase'), /BREATHE IN · [1-4]/);
  assert.match(await page.getAttribute('.v6oorb', 'style'), /scale\(1\.6\)/, 'the light grows on the in-breath');
  await page.waitForFunction(() => /Breathe out/.test(document.querySelector('.v6gst').textContent), null, { timeout: 5000 });
  assert.match(await page.getAttribute('.v6oorb', 'style'), /scale\(0\.75\)/, 'and shrinks on the out-breath');
  await page.waitForFunction(() => /Breath 2 \/ 3/.test(document.querySelector('.v6gst').textContent), null, { timeout: 5000 });
  assert.equal(await page.locator('.v6go .v6olily').count(), 1, 'a lily opens for each breath');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /A QUIET MOMENT[\s\S]*3 slow breaths by the pond \(even pace: in 4, out 4\)[\s\S]*Mind Forest: Developing[\s\S]*never with how stressed[\s\S]*Water lilies[\s\S]*\+10 XP/);
  let s = await state(page);
  assert.equal(s.xp - s0.xp, 10);
  assert.equal(s.e.length, s0.e.length, 'the game never logs a check-in');
  assert.deepEqual([s.mg.c.grove.b, s.mg.c.grove.s, s.mg.c.grove.f], [3, 1, 1]);
  // replay, ending early after one breath: still counts, no second XP
  await page.click('[data-g-again]');
  await page.waitForSelector('.v6opick');
  assert.equal(await page.locator('.v6go .v6osp').filter({ has: page.locator('rect[fill="#ffd6ee"]') }).count(), 2, 'lilies discovered');
  await begin(page);
  await page.waitForFunction(() => /Breath 2 \/ 5/.test(document.querySelector('.v6gst').textContent), null, { timeout: 5000 });
  await page.click('.v6gctl button:has-text("END HERE")');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /1 slow breath by[\s\S]*already earned/);
  s = await state(page);
  assert.equal(s.xp - s0.xp, 10, 'replays give no XP');
  assert.deepEqual([s.mg.c.grove.b, s.mg.c.grove.s, s.mg.c.grove.f], [4, 2, 1]);
  await page.click('.v6gdone [data-gx]');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.match(await page.textContent('#v6gl-grove'), /played 2× · 4 calm breaths/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('pause holds the breath; ending before a full breath gives a kind card and no XP', async () => {
  const { page, ctx, errors } = await boot(seed(0, 0));
  const s0 = await state(page);
  await play(page);
  await page.evaluate(() => { HWGames.timeScale = 0.2; });
  await begin(page);
  await page.click('.v6gctl button:has-text("PAUSE")');
  assert.match(await page.textContent('.v6gst'), /Paused/);
  const t = await page.textContent('.v6gctl .v6ophase');
  await page.waitForTimeout(1500);
  assert.equal(await page.textContent('.v6gctl .v6ophase'), t, 'nothing moves while paused');
  await page.click('.v6gctl button:has-text("RESUME")');
  assert.match(await page.textContent('.v6gst'), /Breath 1 \/ 5/);
  await page.click('.v6gctl button:has-text("END HERE")');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /THE GROVE WILL WAIT[\s\S]*that is fine/);
  const s = await state(page);
  assert.equal(s.xp, s0.xp);
  assert.equal(s.mg.h.at(-1).ok, 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the grove follows the Mind Forest state: murky pond and heavy mist when Ruined, a deer later', async () => {
  for (const [n, murky, deer, mist] of [[0, true, 0, '0.55'], [5, false, 1, '0.1']]) {
    const { page, ctx, errors } = await boot(seed(n, 0));
    await play(page);
    const r = await page.evaluate(() => ({
      murky: document.querySelector('.v6go').classList.contains('v6omurky'),
      deer: [...document.querySelectorAll('.v6go .v6osp')].filter(e => e.getAttribute('viewBox') === '0 0 14 12').length,
      mist: document.querySelector('.v6omist').style.getPropertyValue('--m').trim(),
    }));
    assert.deepEqual([r.murky, r.deer, r.mist], [murky, deer, mist], n + ' days');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('reduced motion and a 360 px phone: still light with a countdown, completes, no particles', async () => {
  const { page, ctx, errors } = await boot(seed(5, 4, { s: { ...RETURNING.s, rm: 1 } }), { viewport: { width: 360, height: 800 } });
  await play(page);
  const fits = () => page.evaluate(() => { const b = document.querySelector('.v6gbody'); return b.scrollWidth <= b.clientWidth; });
  assert.ok(await fits());
  assert.equal(await page.locator('.v6go .v6omote').count(), 0, 'no drifting motes');
  await pick(page, '3 breaths');
  await begin(page);
  assert.match(await page.getAttribute('.v6oorb', 'style'), /transition-duration: 0s/);
  assert.match(await page.textContent('.v6oorb'), /^[1-4]$/, 'countdown in the light');
  assert.ok(await fits());
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /3 slow breaths[\s\S]*Mind Forest: Thriving/);
  assert.equal(await page.evaluate(() => HWFX.live), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});
