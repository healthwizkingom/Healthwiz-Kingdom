// The Health Orb (js/v6-orb.js): Medius reads the Health Score recommendations out of an orb, then ranked quest cards appear.
// The cards are made only from HWScore.compute() (the score's own indicators); the scene never changes a number.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const wk = (hrB, hrA, diff, n = 0) => entry('stair', 40, n, { loc: 'ST', diff, angle: 28, steps: 40, climbs: 1, dur: 5, hrB, hrA, kind: 'workout' });
const full = { ...RETURNING, e: [wk(70, 130, 'MODERATE'), entry('stress', 3, 0), entry('bmi', 22, 0, { h: 170, w: 63 }), entry('water', 500, 0, {}),
  entry('sleep', 6, 0, { bed: '00:30', wake: '06:30' }), entry('pulse', 74, 0, { st: 'Resting' })] };
const boot = async (seed, opts = {}) => { const r = await openApp({ seed, ...opts }); await r.page.waitForSelector('.wl'); await go(r.page, 'score'); return r; };
// The seeded history unlocks badges, and the app's own banners then cover the page for a few seconds; Playwright would wait for
// them to go before every click, so these tests send the click straight to the button.
const tap = (page, sel) => page.dispatchEvent(sel, 'click');
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('before the reading: the orb scene, the score and its table stay visible, no quest cards yet', async () => {
  const { page, ctx, errors } = await boot(full);
  assert.equal(await page.locator('#v6orbc').count(), 1);
  assert.equal(await page.locator('.v6oc').count(), 0);
  assert.match(await page.textContent('#main'), /HOW YOUR SCORE ADDS UP/);
  assert.equal(await page.locator('[data-a="orbgo"]').isEnabled(), true);
  assert.equal(await page.locator('[data-a="orbshow"]').count(), 1);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the sequence plays once, a second click cannot restart it, and it ends in the quest cards by itself', async () => {
  const { page, ctx, errors } = await boot(full);
  const before = await page.evaluate(() => HWScore.compute().score);
  await tap(page, '[data-a="orbgo"]');
  await page.evaluate(() => acts.orbgo()); // a stray second start
  assert.equal(await page.evaluate(() => HWOrb.phase), 'play');
  assert.equal(await page.locator('#v6orbc').count(), 1, 'one scene, not two');
  assert.equal(await page.locator('[data-a="orbgo"]').count(), 0, 'no start button while it plays');
  assert.equal(await page.locator('[data-a="orbskip"]').count(), 1);
  const msgs = await page.evaluate(() => new Promise(res => { const m = new Set(), t = setInterval(() => { const e = document.getElementById('v6orbs'); if (e) m.add(e.textContent); if (!document.getElementById('v6orbc')) { clearInterval(t); res([...m]); } }, 100); }));
  assert.ok(msgs.length >= 3, 'the status line follows the stages: ' + msgs.join(' | '));
  await page.waitForSelector('.v6oc', { timeout: 12000 });
  assert.equal(await page.locator('#v6orbc').count(), 0);
  assert.equal(await page.evaluate(() => HWOrb.phase), 'done');
  assert.equal(await page.evaluate(() => HWScore.compute().score), before, 'the orb never changes the score');
  assert.equal((await state(page)).s.orb, 1);
  assert.deepEqual(errors, []); await ctx.close();
});

test('SKIP and Esc reveal the quests at once; reopening shows them without replaying; REPLAY plays again', async () => {
  const { page, ctx, errors } = await boot(full);
  await tap(page, '[data-a="orbgo"]'); await page.waitForTimeout(300);
  await tap(page, '[data-a="orbskip"]');
  assert.ok(await page.locator('.v6oc').count() >= 7);
  await go(page, 'home'); await go(page, 'score');
  assert.ok(await page.locator('.v6oc').count() >= 7, 'shown directly the second time');
  assert.equal(await page.locator('#v6orbc').count(), 0);
  await tap(page, '[data-a="orbre"]'); await page.waitForTimeout(300);
  assert.equal(await page.locator('#v6orbc').count(), 1);
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('.v6oc').count() >= 7, 'Esc skips');
  assert.deepEqual(errors, []); await ctx.close();
  // the saved choice survives a reload
  const r = await boot({ ...full, s: { ...full.s, orb: 1 } });
  assert.ok(await r.page.locator('.v6oc').count() >= 7);
  assert.deepEqual(r.errors, []); await r.ctx.close();
});

test('cards come from the logged data: ranked by need, one Start Here, real numbers, unlogged areas say what to log', async () => {
  const { page, ctx, errors } = await boot(full);
  await tap(page, '[data-a="orbshow"]');
  const c = await page.evaluate(() => { const I = HWScore.compute().I; return { sleep: I.sleep.val, sub: I.sleep.sub }; });
  assert.equal(c.sleep, 6);
  assert.equal(await page.locator('.v6otag.t-start').count(), 1, 'exactly one Start Here');
  assert.ok(await page.locator('.v6oc.main .v6otag.t-start').count() === 1, 'the Start Here quest is the large main card');
  // water (500 of 2000 mL, sub-score 25) is the lowest: it must come first
  assert.equal(await page.locator('.v6oc.main').getAttribute('data-area'), 'water');
  const txt = await page.textContent('#main');
  assert.match(txt, /500 of your 2000 mL goal/);
  assert.match(txt, /You average 6 h a night\. For your age, 8–10 h is recommended/);
  assert.match(txt, /Why it matters/); assert.match(txt, /What to do next/);
  assert.match(await page.textContent('.v6oc[data-area="nutrition"]'), /Log what you eat/, 'nothing logged for eating: it says what to log');
  assert.equal(await page.locator('.v6oc[data-area="nutrition"] .v6otag.t-info').count(), 1);
  assert.ok(await page.locator('.v6oc .v6oef').count() >= 7, 'every card has an effort label');
  assert.ok(await page.locator('.v6oc [role="progressbar"]').count() >= 3, 'progress bars where a goal exists');
  assert.ok(await page.locator('.v6oc[data-area="water"] [data-a="go"][data-v="water"]').count() === 1, 'connected to the tracker');
  assert.equal(await page.locator('.v6oc[data-area="water"] details').count(), 1, 'expandable detail');
  assert.deepEqual(errors, []); await ctx.close();
});

test('week window: the cards follow TODAY / LAST 7 DAYS like the score does', async () => {
  const seed = { ...RETURNING, e: [entry('sleep', 9, 0, { bed: '22:00', wake: '07:00' }), entry('sleep', 5, 3, { bed: '01:00', wake: '06:00' })] };
  const { page, ctx, errors } = await boot(seed);
  await tap(page, '[data-a="orbshow"]');
  assert.match(await page.textContent('.v6oc[data-area="sleep"]'), /You average 9 h/);
  await tap(page, '[data-a="scw"][data-w="week"]');
  assert.match(await page.textContent('.v6oc[data-area="sleep"]'), /You average 7 h/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('no data: an explaining empty state, no invented cards, no scene error', async () => {
  const { page, ctx, errors } = await boot(RETURNING);
  assert.match(await page.textContent('#main'), /No data yet for this period/);
  assert.match(await page.textContent('#main'), /THE ORB IS DARK/);
  assert.equal(await page.locator('.v6oc').count(), 0);
  assert.ok(await page.locator('.v6oe [data-a="go"]').count() >= 5);
  assert.deepEqual(errors, []); await ctx.close();
});

test('reduced motion: no animation, the button shows the quests straight away', async () => {
  const { page, ctx, errors } = await boot(full, { context: { reducedMotion: 'reduce' } });
  await tap(page, '[data-a="orbgo"]');
  assert.ok(await page.locator('.v6oc').count() >= 7);
  assert.equal(await page.locator('#v6orbc').count(), 0);
  assert.equal(await page.locator('.v6oc.fresh').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('phone width: no sideways scroll in the scene, the playing scene or the quest cards; buttons are tappable', async () => {
  const { page, ctx, errors } = await boot(full, { viewport: { width: 360, height: 740 }, context: { hasTouch: true, isMobile: true } });
  assert.ok(await overflow(page) <= 0, 'scene card');
  await tap(page, '[data-a="orbgo"]'); await page.waitForTimeout(800);
  assert.ok(await overflow(page) <= 0, 'playing');
  await tap(page, '[data-a="orbskip"]');
  assert.ok(await overflow(page) <= 0, 'cards');
  for (const b of await page.$$('.v6oc button, .v6oh button')) assert.ok((await b.boundingBox()).height >= 40, 'tap target');
  assert.deepEqual(errors, []); await ctx.close();
});

test('if the cards cannot be built, the plain recommendation list is shown instead', async () => {
  const { page, ctx, errors } = await boot(full);
  const html = await page.evaluate(() => { const C = HWScore.compute(), I = { ...C.I }; Object.defineProperty(I, 'fv', { get() { throw new Error('broken'); } });
    return HWOrb.section({ ...C, I }, '<div id="plain">plain list</div>'); });
  assert.match(html, /plain list/); assert.match(html, /could not be read just now/);
  assert.deepEqual(errors, []); await ctx.close();
});
