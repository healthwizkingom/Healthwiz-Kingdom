import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);
const PAGES = ['home', 'health', 'quests', 'kingdom', 'set', 'food', 'water', 'sleep', 'pulse', 'stair', 'stress', 'bmi', 'calc', 'stats', 'guide', 'badges'];

test('new user: welcome → onboarding (Medius registry) instead of home', async () => {
  const { page, ctx, errors } = await openApp({ fresh: true });
  await page.waitForSelector('.wl');
  await page.click('.wl .ct button');
  await page.waitForFunction(() => S.v !== 'welcome', null, { timeout: 3000 });   // short entry transition
  assert.equal(await page.evaluate(() => S.v), 'onb');
  assert.match(await page.textContent('#main'), /MEDIUS/i);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('returning user: home opens directly (no onboarding)', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'home');
  assert.equal(await page.evaluate(() => S.v), 'home');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('returning user: every page renders with no error card and no console errors', async () => {
  const { page, ctx, errors } = await openApp();
  for (const v of PAGES) {
    await go(page, v);
    assert.equal(await page.locator('.card.warn h3').count(), 0, v + ' shows the safety error card');
    assert.ok((await page.$eval('#main', e => e.innerHTML.length)) > 200, v + ' is empty');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('water: quick add logs the entry and plays the well animation', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'water');
  await page.click('[data-a="wa"][data-v="250"]');
  assert.equal((await state(page)).e.filter(e => e.c === 'water')[0].v, 250);
  await page.waitForSelector('.fl2', { timeout: 8000 });
  await page.waitForFunction(() => /250 \/ 2000 mL/.test(document.querySelector('#main').textContent), null, { timeout: 12000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('food: search, pick, servings, add to log', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'food');
  await page.fill('#q', 'roti canai');
  await page.click('#fl .it');
  await page.click('[data-a="qp"]');
  await page.click('[data-a="addfood"]');
  const e = (await state(page)).e.find(x => x.c === 'food');
  assert.equal(e.m.name, 'Roti Canai');
  assert.equal(e.v, 560);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('sleep, pulse, stairs and BMI save with the original validation', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'sleep');
  await page.fill('#slb', '23:00');
  await page.fill('#slw', '07:00');
  await page.click('[data-a="slsave"]');
  await go(page, 'pulse');
  await page.fill('#pb', '300');
  await page.click('[data-a="savepulse"]');
  await page.fill('#pb', '72');
  await page.click('[data-a="savepulse"]');
  await go(page, 'stair');
  await page.fill('#ss', '12');
  await page.fill('#sc', '2');
  await page.click('[data-a="savestair"]');
  await go(page, 'bmi');
  await page.fill('#bh', '170');
  await page.fill('#bw', '65');
  await page.click('[data-a="savebmi"]');
  const st = await state(page);
  const by = c => st.e.filter(x => x.c === c);
  assert.equal(by('sleep')[0].v, 8);
  assert.equal(by('pulse').length, 1, '300 BPM rejected');
  assert.equal(by('pulse')[0].v, 72);
  assert.equal(by('stair')[0].v, 24);
  assert.equal(by('bmi')[0].v, 22.5);
  assert.ok(st.xp > 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('entries: edit, delete and undo', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'pulse');
  await page.fill('#pb', '70');
  await page.click('[data-a="savepulse"]');
  await page.click('[data-a="edit"]');
  await page.fill('#ev', '75');
  await page.click('[data-a="esave"]');
  assert.equal((await state(page)).e[0].v, 75);
  await page.click('[data-a="del"]');
  assert.equal((await state(page)).e.length, 0);
  await page.click('#toasts [data-a="undo"]');
  assert.equal((await state(page)).e.length, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('backup round trip: download, erase (two taps), restore from file', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'pulse');
  await page.fill('#pb', '70');
  await page.click('[data-a="savepulse"]');
  await go(page, 'set');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-a="expj"]')]);
  const file = path.join(os.tmpdir(), 'hw-' + Date.now() + '.json');
  await dl.saveAs(file);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).data.e.length, 1);
  await page.click('[data-a="rst"]');
  assert.equal((await state(page)).e.length, 1, 'first tap only arms the reset');
  await page.click('[data-a="rst"]');
  assert.equal((await state(page)).e.length, 0);
  await go(page, 'set');
  await page.setInputFiles('input[type=file]', file);
  await page.waitForSelector('#impo [data-a="impm"]');
  await page.click('[data-a="impm"]');
  assert.equal((await state(page)).e.length, 1);
  fs.unlinkSync(file);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('safety net: a page that throws shows an error card, data untouched', async () => {
  const { page, ctx } = await openApp();
  await page.evaluate(() => { st.p = null; });   // corrupt state in memory only
  await go(page, 'bmi');
  assert.ok(await page.$('.card.warn h3'));
  assert.match(await page.textContent('#main'), /saved data is untouched/);
  await ctx.close();
});

for (const [w, h] of [[360, 800], [412, 915], [1280, 800]]) {
  test(`layout ${w}×${h}: no horizontal scroll on any page`, async () => {
    const { page, ctx, errors } = await openApp({ viewport: { width: w, height: h } });
    for (const v of PAGES) {
      await go(page, v);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 1, `${v} overflows by ${over}px at ${w}px`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}
