import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);

const ymd = d => d.toISOString().slice(0, 10);
const daysAgo = n => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - n); return ymd(new Date(d.getTime() - d.getTimezoneOffset() * 60000)); };

test('home: header, profile, tiles, quests, map, hub, trends, badges all render', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'home');
  for (const sel of ['header', '.pcw', '.attr', '.ts', '#quests .aq', '#encheck', '.km .kn', '.hub .hb', '#htrend', '#cx', '#badges .bd']) {
    assert.ok(await page.$(sel), 'missing ' + sel);
  }
  assert.equal((await page.$$('#quests .aq')).length, 6);
  assert.equal((await page.$$('.km .kn')).length, 9);
  assert.equal((await page.$$('.km .kn.k0')).length, 7, 'six regions + dream camp locked on a fresh start');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('home: energy rating and quest claim award XP once', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'home');
  await page.click('[data-a="ener"][data-i="4"]');
  let st = await state(page);
  assert.equal(Object.values(st.en)[0].v, 4);
  const xp0 = st.xp;
  await page.click('[data-a="qclaim"][data-k="energy"]');
  st = await state(page);
  assert.equal(st.xp, xp0 + 5);
  assert.equal(await page.$('[data-a="qclaim"][data-k="energy"]'), null, 'cannot claim twice');
  assert.ok(await page.$('#quests .aq.dn'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('home: map node navigates and unlocks after logging', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'home');
  await page.click('.kn[data-v="water"]');
  assert.ok(await page.$('#wq'), 'water page opened');
  await page.evaluate(() => window.HW.acts.wa({ v: '200' }));
  await go(page, 'home');
  assert.ok(await page.$('.kn.k1[data-v="water"]'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('badges: unlock popup shows, awards XP, records badge, closes on tap', async () => {
  const { page, ctx, errors } = await openApp({ popups: true });
  await go(page, 'water');
  await page.evaluate(() => window.HW.acts.wa({ v: '200' }));
  await go(page, 'home');
  await page.waitForSelector('.bpop');
  assert.match(await page.textContent('.bpop'), /First Steps/);
  const st = await state(page);
  assert.ok(st.b['First Steps']);
  await page.click('.bpop');
  await page.waitForSelector('.bpop', { state: 'detached' });
  assert.ok(await page.$('#badges .bd.ok'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('health connections appear with enough seeded history', async () => {
  const e = [], en = {};
  for (let i = 0; i < 12; i++) {
    const d = daysAgo(i), long = i % 2 === 0;
    e.push({ id: 's' + i, c: 'sleep', v: long ? 9 : 6, m: { bed: '23:00', wake: '07:00', score: 70 }, n: '', d, t: '08:00' });
    en[d] = { v: long ? 4 : 2, t: '09:00' };
  }
  const { page, ctx, errors } = await openApp({ seed: { e, en, s: { kcal: 2200, water: 2000, sound: 0, set: 0 }, p: { w: 60, h: 165, age: 16, sex: 'm', act: 1.375, days: 3, goal: 'm' }, xp: 0, claimed: {}, b: {} } });
  await go(page, 'home');
  const cx = await page.textContent('#cx');
  assert.match(cx, /SLEEP & ENERGY/);
  assert.match(cx, /higher/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
