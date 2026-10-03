import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);

test('welcome → start button enters the kingdom with nav', async () => {
  const { page, ctx, errors } = await openApp();
  await page.click('.ct button');
  await page.waitForSelector('#nav button');
  assert.equal(await page.$('.wl'), null);
  assert.ok((await page.$$('#nav button')).length >= 5);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('food: search, pick, adjust servings/portion, add to log with macros', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'food');
  await page.fill('#q', 'roti canai');
  // partial update keeps focus in the search box
  assert.equal(await page.evaluate(() => document.activeElement.id), 'q');
  await page.click('#fl .it');
  await page.waitForSelector('#det');
  await page.click('[data-a="qp"]');            // 2 servings
  await page.click('[data-a="pm"][data-m="0.5"]'); // half portion
  assert.match(await page.textContent('#fprev'), /280 kcal/);
  await page.click('[data-a="addfood"]');
  const st = await state(page);
  assert.equal(st.e.length, 1);
  assert.equal(st.e[0].c, 'food');
  assert.equal(st.e[0].v, 280); // 280 kcal × 2 × 0.5
  assert.equal(st.e[0].m.name, 'Roti Canai');
  assert.ok(st.e[0].m.mac.pr > 0);
  assert.ok(st.xp >= 10);
  assert.match(await page.textContent('#fmac'), /PROTEIN/);
  assert.match(await page.textContent('.tbl'), /Today/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('food: unlisted-kcal item requires user kcal; custom food saves label macros', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'food');
  await page.fill('#q', 'air laici');
  await page.click('#fl .it');
  await page.click('[data-a="addfood"]');
  assert.equal((await state(page))?.e?.length ?? 0, 0, 'no entry without kcal');
  await page.fill('#ck', '90');
  await page.click('[data-a="addfood"]');
  let st = await state(page);
  assert.equal(st.e[0].v, 90);
  assert.equal(st.e[0].m.u, 1);

  await page.click('[data-a="cf"]');
  await page.fill('#cn', 'Homemade Oats');
  await page.fill('#cc', '310');
  await page.fill('#cp', '12');
  await page.click('[data-a="savecf"]');
  st = await state(page);
  const c = st.e.find(e => e.m.custom);
  assert.equal(c.v, 310);
  assert.deepEqual(c.m.mac, { pr: 12, cb: 0, fa: 0, fb: 0 });
  assert.match(await page.textContent('#main'), /LABEL/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('water: quick add logs entry, runs well animation, re-renders total', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'water');
  await page.click('[data-a="wa"][data-v="250"]');
  const st = await state(page);
  assert.equal(st.e.filter(e => e.c === 'water').length, 1);
  assert.equal(st.e[0].v, 250);
  await page.waitForSelector('.fl2', { timeout: 8000 });         // flood FX appears
  await page.waitForFunction(() => /250 \/ 2000 mL/.test(document.querySelector('#main').textContent), null, { timeout: 12000 });
  // invalid custom amount is rejected
  await page.fill('#wc', '5000');
  await page.click('[data-a="wcu"]');
  assert.equal((await state(page)).e.length, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('sleep: auto duration, save entry with score, dream quest, checklist', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'sleep');
  await page.fill('#slb', '23:00');
  await page.fill('#slw', '07:00');
  assert.equal(await page.inputValue('#sld'), '8');
  await page.click('[data-a="slaw"][data-i="1"]');
  await page.click('[data-a="slrest"][data-i="4"]');
  await page.click('[data-a="slsave"]');
  let st = await state(page);
  const e = st.e.find(x => x.c === 'sleep');
  assert.equal(e.v, 8);
  assert.equal(e.m.aw, 1);
  assert.equal(e.m.rest, 4);
  assert.ok(e.m.score > 50 && e.m.score <= 100);
  assert.match(await page.textContent('#dbatc'), /KNIGHT|VICTORY|HARD|PRESSES/);

  await page.click('[data-a="sldq"]');
  for (let i = 0; i < 5; i++) await page.locator('.dstar:visible').first().click();
  await page.waitForTimeout(800);
  st = await state(page);
  assert.equal(st.dqn, 1);

  await page.click('.ckl[data-i="0"]');
  st = await state(page);
  assert.equal(Object.values(st.ck)[0][0], 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('entries: edit, delete and undo', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'water');
  await page.evaluate(() => { window.HW.acts.wa({ v: '300' }); });
  await page.waitForTimeout(100);
  await go(page, 'water');
  await page.click('[data-a="edit"]');
  await page.fill('#ev', '400');
  await page.click('[data-a="esave"]');
  assert.equal((await state(page)).e[0].v, 400);
  await page.click('[data-a="del"]');
  assert.equal((await state(page)).e.length, 0);
  await page.click('#toasts [data-a="undo"]');
  assert.equal((await state(page)).e.length, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every nav target renders without throwing', async () => {
  const { page, ctx, errors } = await openApp();
  for (const v of ['home', 'food', 'water', 'sleep', 'pulse', 'stair', 'stress', 'bmi', 'calc', 'stats', 'guide', 'set']) {
    await go(page, v);
    assert.equal(await page.$('.warn code'), null, v + ' rendered an error card');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});
