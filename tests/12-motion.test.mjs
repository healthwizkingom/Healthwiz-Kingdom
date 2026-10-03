import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state } from './helpers.mjs';

after(closeBrowser);
const withS = s => ({ seed: { ...RETURNING, s: { ...RETURNING.s, ...s } } });
const anims = page => page.evaluate(() => document.getAnimations().length);
const title = async page => { await page.waitForSelector('.wl'); await page.waitForTimeout(250); };

test('default is Auto → Balanced: the original title scene, unchanged', async () => {
  const { page, ctx, errors } = await openApp();
  await title(page);
  assert.deepEqual(await page.evaluate(() => [HWMotion.choice(), HWMotion.level(), document.documentElement.dataset.quality, document.documentElement.dataset.motion]), ['auto', 'balanced', 'balanced', 'full']);
  assert.ok(await anims(page) > 400, 'full original scene animates');
  assert.equal(await page.locator('.v6amb').count(), 0, 'no High-only extras');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Performance calms the busiest loops; High adds ambient life', async () => {
  const counts = {};
  for (const perf of ['high', 'balanced', 'performance']) {
    const { page, ctx, errors } = await openApp(withS({ perf }));
    await title(page);
    counts[perf] = await anims(page);
    assert.equal(await page.locator('.v6amb').count(), perf === 'high' ? 1 : 0, perf);
    assert.deepEqual(errors, []);
    if (perf === 'performance') {
      await page.mouse.move(50, 50); await page.mouse.move(400, 300); await page.waitForTimeout(100);
      assert.equal(await page.locator('.wl.v6px').count(), 0, 'no parallax in Performance');
      assert.ok(await page.$('.zsv .zd'), 'scene still drawn');
    }
    await ctx.close();
  }
  assert.ok(counts.performance < counts.balanced / 2, JSON.stringify(counts));
  assert.ok(counts.high > counts.balanced, JSON.stringify(counts));
});

test('Auto picks Performance on a weak device', async () => {
  const { page, ctx } = await openApp({ before: p => p.addInitScript(() => Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })) });
  await title(page);
  assert.deepEqual(await page.evaluate(() => [HWMotion.choice(), HWMotion.level()]), ['auto', 'performance']);
  await ctx.close();
});

test('in-app Reduce motion matches the original reduced-motion look, and can be turned back', async () => {
  const { page, ctx, errors } = await openApp(withS({ rm: 1 }));
  await title(page);
  assert.equal(await anims(page), 0, 'no animation');
  assert.deepEqual(await page.evaluate(() => [HWUI.reduced(), document.documentElement.classList.contains('hw-rm'), HWFX.burst(100, 100, { n: 30 })]), [true, true, 0]);
  await page.mouse.move(50, 50); await page.mouse.move(400, 300); await page.waitForTimeout(100);
  assert.equal(await page.locator('.wl.v6px').count(), 0, 'no parallax');
  await page.evaluate(() => HWMotion.set('rm', 0));
  await page.waitForTimeout(100);
  assert.ok(await anims(page) > 400, 'animation back');
  const ev = await page.evaluate(() => { const e = HWEvents.recent('motion:changed').at(-1); return [e.reduced, e.enabled, e.level]; });
  assert.deepEqual(ev, [false, true, 'balanced']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('device reduced-motion is still honoured with the in-app setting on "Follow device"', async () => {
  const { page, ctx } = await openApp({ before: p => p.emulateMedia({ reducedMotion: 'reduce' }) });
  await title(page);
  assert.equal(await anims(page), 0);
  assert.equal(await page.evaluate(() => HWMotion.count(10)), 0);
  await ctx.close();
});

test('Animations off: everything still, celebrations keep their text but lose sparkles', async () => {
  const { page, ctx, errors } = await openApp(withS({ anim: 0 }));
  await title(page);
  assert.equal(await anims(page), 0);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.motion), 'off');
  await go(page, 'home');
  await page.evaluate(() => HWUI.celebrate({ title: 'TEST', sub: 'still', xp: 5 }));
  await page.waitForSelector('.v6cel');
  assert.equal(await page.locator('.v6cel u').count(), 0);
  assert.match(await page.textContent('.v6cel'), /TEST/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('settings card: choices are saved, invalid saved values fall back to Auto', async () => {
  const { page, ctx, errors } = await openApp(withS({ perf: 'ultra' }));
  await title(page);
  assert.equal(await page.evaluate(() => HWMotion.choice()), 'auto');
  await go(page, 'set');
  assert.match(await page.textContent('#v6motion'), /ANIMATION & PERFORMANCE[\s\S]*Now: Balanced \(picked for this device\)/);
  await page.click('#v6motion [data-k="perf"][data-v="performance"]');
  await page.click('#v6motion [data-k="rm"][data-v="1"]');
  await page.click('#v6motion [data-k="anim"][data-v="0"]');
  const s = (await state(page)).s;
  assert.deepEqual([s.perf, s.rm, s.anim], ['performance', 1, 0]);
  assert.equal(await page.getAttribute('#v6motion [data-k="perf"][data-v="performance"]', 'aria-pressed'), 'true');
  assert.match(await page.textContent('#v6motion'), /Now: Still/);
  assert.equal(await page.evaluate(() => document.documentElement.className.match(/hw-q-\w+/)[0]), 'hw-q-performance');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('particles: level-up bursts on one canvas that is removed when done; scaled by quality', async () => {
  const { page, ctx, errors } = await openApp(withS({ perf: 'high' }));
  await title(page);
  await go(page, 'home');
  await page.evaluate(() => gain(150, 'test'));
  assert.ok(await page.evaluate(() => HWFX.live) > 0, 'burst on level-up');
  assert.equal(await page.locator('canvas.v6fx').count(), 1);
  await page.waitForFunction(() => !HWFX.running, null, { timeout: 4000 });
  assert.equal(await page.locator('canvas.v6fx').count(), 0, 'loop stops and canvas leaves');
  const n = await page.evaluate(() => { const r = {}; for (const q of ['high', 'balanced', 'performance']) { HWMotion.set('perf', q); HWFX.clear(); r[q] = HWFX.burst(10, 10, { n: 40 }); } HWFX.clear(); return r; });
  assert.deepEqual(n, { high: 40, balanced: 24, performance: 10 });
  const cap = await page.evaluate(() => { HWMotion.set('perf', 'performance'); HWFX.clear(); for (let i = 0; i < 20; i++) HWFX.burst(10, 10, { n: 40 }); const c = HWFX.live; HWFX.clear(); return c; });
  assert.equal(cap, 50, 'capped per mode');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Performance thins the original water confetti; Balanced keeps all of it', async () => {
  for (const [perf, all] of [['balanced', true], ['performance', false]]) {
    const { page, ctx, errors } = await openApp(withS({ perf }));
    await title(page);
    await go(page, 'home');
    await page.evaluate(() => drink(1000));
    await page.waitForSelector('.fx');
    const [n, shown] = await page.evaluate(() => { const u = [...document.querySelectorAll('.fx u')]; return [u.length, u.filter(x => getComputedStyle(x).display !== 'none').length]; });
    assert.ok(n > 10);
    if (all) assert.equal(shown, n); else assert.ok(shown <= 6, perf + ': ' + shown + '/' + n);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('animation pauses while the app is in the background', async () => {
  const { page, ctx } = await openApp();
  await title(page);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.zsv .zd')).animationPlayState), 'paused');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.zsv .zd')).animationPlayState), 'running');
  await ctx.close();
});
