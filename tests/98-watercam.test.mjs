// SCAN MY DRINK (js/v6-watercam.js): a camera estimate of the water in bottles and cups, logged through drink() like a manual entry.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);
const boot = async o => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'water'); return r; };
const waters = page => state(page).then(s => s.e.filter(e => e.c === 'water'));

test('drink(v, meta) stores the meta; a manual drink still stores {}', async () => {
  const { page, ctx, errors } = await boot();
  const before = await page.evaluate(() => wt());
  await page.evaluate(() => { drink(250, { src: 'camera', est: true, conf: 'medium' }); drink(100); });
  const w = await waters(page);
  assert.deepEqual(w.at(-2).m, { src: 'camera', est: true, conf: 'medium' });
  assert.deepEqual(w.at(-1).m, {});
  assert.equal(await page.evaluate(() => wt()), before + 350);
  assert.deepEqual(errors, []); await ctx.close();
});

test('a camera entry is tagged "camera estimate" in the Water history', async () => {
  const { page, ctx, errors } = await boot();
  await page.evaluate(() => { drink(250, { src: 'camera', est: true, conf: 'high' }); });
  await go(page, 'water');
  const html = await page.evaluate(() => document.querySelector('#main').innerHTML);
  assert.match(html, /camera estimate/);
  assert.deepEqual(errors, []); await ctx.close();
});
