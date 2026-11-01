// Recover Now (js/v6-recover.js): a guided 2-minute rest on the Stairs workout card. It only times the "1 minute after" pulse and
// copies a number the user typed into the existing field (m.hrR1). It never invents a pulse and saves nothing when skipped.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, stairHistory } from './helpers.mjs';

after(closeBrowser);
const boot = async () => { const r = await openApp(); await r.page.waitForSelector('.wl'); await go(r.page, 'pulse'); await stairHistory(r.page); return r; };
// move the page's clock forward without waiting: the timer reads Date.now(), so a test never sleeps for a minute
const skew = (page, ms) => page.evaluate(ms => { if (!window.__real) { window.__real = Date.now; window.__off = 0; Date.now = () => window.__real() + window.__off; } window.__off = ms; }, ms);
const stairs = s => s.e.filter(e => e.c === 'stair');

test('drop(): worked examples, range check, no guessing (a minus r, 30–220 BPM)', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => [
    HWRecover.drop(142, 118), HWRecover.drop('130', '98'), HWRecover.drop(100, 120),
    HWRecover.drop(130, ''), HWRecover.drop(130, null), HWRecover.drop(20, 100), HWRecover.drop(130, 250),
    HWRecover.clock(120), HWRecover.clock(59.2), HWRecover.clock(0.1), HWRecover.clock(-5), HWRecover.WIN, HWRecover.MARK]);
  assert.deepEqual(r[0], { a: 142, r: 118, drop: 24 });          // 142 − 118 = 24 BPM
  assert.deepEqual(r[1], { a: 130, r: 98, drop: 32 });           // numbers typed as text still work
  assert.deepEqual(r[2], { a: 100, r: 120, drop: -20 });         // a rise is reported as it is, not hidden
  assert.deepEqual(r.slice(3, 7), [null, null, null, null]);     // missing or out of range → no result
  assert.deepEqual(r.slice(7, 11), ['2:00', '1:00', '0:01', '0:00']);   // counts down, rounds up, never negative
  assert.deepEqual(r.slice(11), [120, 60]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the button sits under the "1 minute after" field; the label says heart-rate drop, not vagal tone', async () => {
  const { page, ctx, errors } = await boot();
  assert.equal(await page.locator('#sthrc [data-a="recstart"]').count(), 1);
  assert.equal(await page.locator('#rec-box').count(), 0, 'no panel until it is pressed');
  const html = await page.$eval('#main', e => e.innerHTML);
  assert.ok(html.indexOf('id="wk-r"') < html.indexOf('data-a="recstart"'), 'after the field it fills');
  await page.click('[data-a="recstart"]');
  assert.doesNotMatch(await page.textContent('#rec-box'), /vagal/i);
  assert.match(await page.textContent('#rec-box'), /not a medical measurement/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('2:00 countdown, pulse asked at 1:00, USE THIS copies the typed number into the 1-minute field and the drop shows', async () => {
  const { page, ctx, errors } = await boot();
  await page.fill('#wk-a', '130');
  await skew(page, 0); await page.click('[data-a="recstart"]');
  assert.equal(await page.textContent('#rec-clock'), '2:00');
  assert.equal(await page.isHidden('#rec-in'), true, 'no pulse is asked for before 1:00');
  await skew(page, 30000); await page.waitForTimeout(400);
  assert.equal(await page.textContent('#rec-clock'), '1:30');
  assert.equal(await page.isHidden('#rec-in'), true);
  await skew(page, 61000); await page.waitForTimeout(400);
  assert.equal(await page.isVisible('#rec-in'), true, 'asked at 1:00');
  assert.match(await page.textContent('#rec-msg'), /One minute/);
  await page.fill('#rec-r', '250'); await page.click('[data-a="recuse"]');
  assert.equal(await page.inputValue('#wk-r'), '', 'out of range: nothing copied');
  assert.equal(await page.locator('#rec-box').count(), 1, 'the panel stays so it can be corrected');
  await page.fill('#rec-r', '100'); await page.click('[data-a="recuse"]');
  assert.equal(await page.inputValue('#wk-r'), '100');
  assert.equal(await page.locator('#rec-box').count(), 0, 'panel closed after use');
  assert.match(await page.textContent('#st-rec'), /fell by 30 BPM in one minute \(from 130 to 100\)/);
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('hw_wk_draft')).hrR1), '100', 'kept with the draft like a typed number');
  assert.deepEqual(errors, []); await ctx.close();
});

test('2:00 ends with a calm message; STOP and a redraw save nothing and invent nothing', async () => {
  const { page, ctx, errors } = await boot();
  await skew(page, 0); await page.click('[data-a="recstart"]');
  await skew(page, 121000); await page.waitForTimeout(400);
  assert.equal(await page.textContent('#rec-clock'), '0:00');
  assert.match(await page.textContent('#rec-msg'), /Two minutes done/);
  await page.click('[data-a="recstop"]');
  assert.equal(await page.locator('#rec-box').count(), 0);
  assert.equal(await page.inputValue('#wk-r'), '', 'skipped: the field stays empty');
  assert.equal(stairs(await state(page)).length, 0, 'nothing logged');
  // starting again works, and a card that is redrawn ends the timer instead of leaving it running
  await skew(page, 0); await page.click('[data-a="recstart"]');
  await go(page, 'home'); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.getElementById('rec-box')), null);
  assert.equal(stairs(await state(page)).length, 0);
  assert.deepEqual(errors, []); await ctx.close();
});
