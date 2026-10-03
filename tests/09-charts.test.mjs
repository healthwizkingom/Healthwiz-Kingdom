import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const seeded = () => ({ ...RETURNING, e: [...range(1, 13).map(n => entry('water', 1000 + n * 50, n)), ...range(1, 6).map(n => entry('sleep', 7, n, { bed: '23:00', wake: '06:00' }))] });

test('charts announce a summary and can be read by tapping a bar', async () => {
  const { page, ctx, errors } = await openApp({ seed: seeded(), viewport: { width: 412, height: 915 } });
  await go(page, 'water');
  const ch = page.locator('.v6ch').first();
  const label = await ch.getAttribute('aria-label');
  assert.match(label, /water chart, 7 days: 6 with data, average [\d,.]+ mL, peak 1,?300 mL/);
  assert.equal(await ch.getAttribute('role'), 'img');
  const bars = ch.locator(':scope > div');
  await bars.nth(5).dispatchEvent('pointerdown');
  const out = await page.locator('.v6cr').first().textContent();
  assert.match(out, /: 1,?050 mL$/);
  assert.equal(await bars.nth(5).getAttribute('class'), 'sel');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('keyboard: focus a chart and read values with the arrow keys', async () => {
  const { page, ctx, errors } = await openApp({ seed: seeded() });
  await go(page, 'water');
  const ch = page.locator('.v6ch').first();
  await ch.focus();
  await page.keyboard.press('ArrowLeft');            // starts at the last bar (today)
  assert.match(await page.locator('.v6cr').first().textContent(), /nothing logged/);
  await page.keyboard.press('ArrowLeft');
  assert.match(await page.locator('.v6cr').first().textContent(), /1,?050 mL/);
  await page.keyboard.press('Home');                 // first bar = 6 days ago
  assert.match(await page.locator('.v6cr').first().textContent(), /1,?300 mL/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('long charts get sparse date labels; empty charts explain what to do', async () => {
  const { page, ctx, errors } = await openApp({ seed: seeded() });
  await go(page, 'stats');
  await page.click('[data-a="rg"][data-r="m"]');
  assert.ok((await page.$$('.v6sl span')).length >= 3, 'first/middle/last labels on 30-day charts');
  const empty = await page.$$eval('.v6ce', els => els.map(e => e.textContent));
  assert.ok(empty.some(t => /NO STAIR STEPS YET.*Log stair steps/.test(t)), empty.join(' | '));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('statistics: this week vs last week, completed days only, neutral wording; day/week/month still work', async () => {
  const { page, ctx, errors } = await openApp({ seed: seeded() });
  await go(page, 'stats');
  const t = await page.textContent('#v6cmp');
  assert.match(t, /💧 Water[\d,.]+ mL▼ lower[\d,.]+ mL/);
  assert.equal(await page.evaluate(() => { const t = document.querySelector('#v6cmp table'); return t.scrollWidth <= t.parentNode.clientWidth + 1; }), true, 'comparison fits without sideways scroll');   // later days logged more → last 7 lower than the week before
  assert.doesNotMatch(t, /better|worse|good|bad/i);
  for (const r of ['d', 'w', 'm']) { await page.click(`[data-a="rg"][data-r="${r}"]`); assert.ok(await page.$('#v6cmp')); }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every page with charts still renders without errors', async () => {
  const { page, ctx, errors } = await openApp({ seed: seeded() });
  for (const v of ['home', 'food', 'water', 'sleep', 'stats', 'quests', 'guide']) {
    await go(page, v);
    assert.equal(await page.$('.card.warn h3'), null, v);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});
