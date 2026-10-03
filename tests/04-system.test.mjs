import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);

async function logSome(page) {
  await page.evaluate(() => {
    const H = window.HW;
    H.acts.wa({ v: '500' });
  });
  await page.waitForTimeout(50);
  await go(page, 'pulse');
  await page.fill('#pbpm', '70');
  await page.click('[data-a="psave"]');
}

test('stats: totals, range toggle, category filter, history rows', async () => {
  const { page, ctx, errors } = await openApp();
  await logSome(page);
  await go(page, 'stats');
  assert.match(await page.textContent('#main'), /Entries2/);
  assert.match(await page.textContent('#main'), /Current streak1/);
  await page.click('[data-a="srg"][data-g="m"]');
  assert.equal(await page.evaluate(() => window.HW.S.rg), 'm');
  await page.click('[data-a="sfc"][data-c="pulse"]');
  const rows = await page.$$eval('#main .er', els => els.map(e => e.textContent));
  assert.equal(rows.length, 1);
  assert.match(rows[0], /70 BPM/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('guide: placeholder when empty, observations from logs', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'guide');
  assert.match(await page.textContent('#main'), /NOT ENOUGH LOGS YET/);
  await logSome(page);
  await go(page, 'guide');
  assert.match(await page.textContent('#main'), /TRY A STAIR SESSION/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('settings: targets validate and save; theme and sound toggle', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'set');
  await page.fill('#tk', '100');
  await page.click('[data-a="tsave"]');
  assert.equal((await state(page))?.s?.kcal ?? 2200, 2200);
  await page.fill('#tk', '1900');
  await page.fill('#tw', '2300');
  await page.click('[data-a="tsave"]');
  let st = await state(page);
  assert.equal(st.s.kcal, 1900);
  assert.equal(st.s.water, 2300);
  await page.click('[data-a="theme"][data-t="dark"]');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  await page.click('[data-a="theme"][data-t="auto"]');
  assert.equal(await page.getAttribute('html', 'data-theme'), null);
  await page.click('[data-a="snd"][data-v="0"]');
  assert.equal((await state(page)).s.sound, 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('backup round trip: download JSON, erase, restore from file', async () => {
  const { page, ctx, errors } = await openApp();
  await logSome(page);
  await go(page, 'set');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="expj"]')]);
  const file = path.join(os.tmpdir(), 'hw-backup-' + Date.now() + '.json');
  await dl.saveAs(file);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(json.app, 'HealthWiz');
  assert.equal(json.data.e.length, 2);

  await page.click('[data-a="reset"]');
  await page.click('[data-a="reset"]');
  assert.ok(await page.$('.wl'), 'back on title screen after erase');
  assert.equal((await state(page)).e.length, 0);

  await go(page, 'set');
  await page.setInputFiles('input[type=file]', file);
  await page.waitForSelector('#impo [data-a="impm"]');
  assert.match(await page.textContent('#impo'), /2 entries/);
  await page.click('[data-a="impm"]');
  assert.equal((await state(page)).e.length, 2);

  // paste path with bad JSON shows an error, not a crash
  await page.click('details summary');
  await page.fill('#imptx', '{nope');
  await page.click('[data-a="impt"]');
  assert.match(await page.textContent('#impo'), /not valid JSON/);
  fs.unlinkSync(file);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('mobile layout: bottom nav fits, no horizontal scroll on every page', async () => {
  const { page, ctx, errors } = await openApp({ viewport: { width: 360, height: 740 } });
  for (const v of ['home', 'food', 'water', 'sleep', 'pulse', 'stair', 'stress', 'bmi', 'calc', 'stats', 'guide', 'set']) {
    await go(page, v);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(over <= 1, `${v} overflows horizontally by ${over}px`);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});
