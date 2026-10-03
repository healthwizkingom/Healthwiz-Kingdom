import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getBrowser, closeBrowser } from './helpers.mjs';

after(closeBrowser);
const here = path.dirname(fileURLToPath(import.meta.url));

test('standalone single-file build boots and logs water', async () => {
  const b = await getBrowser();
  const ctx = await b.newContext();
  await ctx.route(/^https?:/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.HW_NO_POPUPS = 1; });
  await page.goto(pathToFileURL(path.join(here, '..', 'dist', 'healthwiz-standalone.html')).href);
  await page.waitForSelector('.wl');
  assert.equal(await page.$('script[src]'), null, 'no external scripts');
  await page.click('.ct button');
  await page.click('#nav [data-v="water"]');
  await page.click('[data-a="wa"][data-v="250"]');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz')));
  assert.equal(st.e[0].v, 250);
  assert.deepEqual(errors, []);
  await ctx.close();
});
