// Smart water reminder (master prompt §72): starts again after a reload, quiet hours, and no nagging right after a
// drink or once the day's goal is reached (js/v6-water.js).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { RETURNING, closeBrowser, daysAgo, entry, go, openApp, state } from './helpers.mjs';

after(closeBrowser);
const at = (h, m = 0) => { const t = new Date(); t.setHours(h, m, 0, 0); return t; };
const seed = (e = [], s = {}) => ({ ...RETURNING, e, s: { ...RETURNING.s, wrem: 60, ...s } });
const well = page => page.locator('#toasts', { hasText: 'THE WELL NEEDS YOU' }).count();

test('a saved reminder runs after a reload, without tapping SAVE REMINDER again', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed(), before: p => p.clock.install({ time: at(10) }) });
  await page.waitForSelector('.wl');
  await page.clock.runFor(60 * 60000 + 1000); // the toast clears itself after 3.2 s
  assert.equal(await well(page), 1, 'reminder shown after one interval');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('quiet hours, a recent drink and a reached goal keep the reminder silent', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed(), before: p => p.clock.install({ time: at(23) }) });
  await page.waitForSelector('.wl');
  await page.clock.runFor(60 * 60000 + 1000);
  assert.equal(await well(page), 0, 'silent at night (default quiet hours 22–07)');
  const due = (h, m, e, s = {}) => page.evaluate(([e, s, t]) => { st.e = e; Object.assign(st.s, s); const D = Date;
    // judge as if it were time t (the reminder reads the wall clock)
    window.Date = class extends D { constructor(...a) { super(...(a.length ? a : [t])); } static now() { return t; } };
    try { return HWWater.remindDue(60); } finally { window.Date = D; } }, [e, s, at(h, m).getTime()]);
  const today = daysAgo(0);
  assert.equal(await due(10, 0, []), true, 'no water yet today: remind');
  assert.equal(await due(10, 0, [{ ...entry('water', 250, 0, {}, '09:30'), d: today }]), false, 'drank 30 min ago: skip');
  assert.equal(await due(11, 0, [{ ...entry('water', 250, 0, {}, '09:30'), d: today }]), true, '90 min since the last drink: remind');
  assert.equal(await due(15, 0, [{ ...entry('water', 2000, 0, {}, '09:00'), d: today }]), false, 'goal reached: skip');
  assert.equal(await due(6, 30, []), false, 'still quiet hours in the early morning');
  assert.equal(await due(23, 30, [], { qh: [0, 0] }), true, 'quiet hours can be turned off');
  assert.equal(await due(22, 30, [], { qh: [23, 8] }), true, 'custom quiet hours');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('quiet hours are chosen on the Water page and saved with the reminder', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed() });
  await page.waitForSelector('.wl');
  await go(page, 'water');
  assert.equal(await page.locator('#wqh').inputValue(), '22,7', 'default shown');
  assert.match(await page.textContent('#v6wqh'), /quiet hours.*goal is reached/);
  await page.selectOption('#wqh', '23,8');
  await page.click('[data-a="wrems"]');
  const s = (await state(page)).s;
  assert.deepEqual(s.qh, [23, 8]);
  assert.equal(s.wrem, 60, 'interval kept');
  await go(page, 'water');
  assert.equal(await page.locator('#wqh').inputValue(), '23,8', 'choice shown again');
  assert.deepEqual(errors, []);
  await ctx.close();
});
