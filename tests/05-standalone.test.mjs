import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getBrowser, closeBrowser, RETURNING } from './helpers.mjs';

after(closeBrowser);
const here = path.dirname(fileURLToPath(import.meta.url));

test('standalone single-file build: no external scripts or images, boots and logs water', async () => {
  const b = await getBrowser();
  const ctx = await b.newContext();
  const external = [];
  await ctx.route(/^https?:/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  page.on('request', r => { if (r.url().startsWith('file:') && !r.url().endsWith('.html')) external.push(r.url()); });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(RETURNING));
  await page.goto(pathToFileURL(path.join(here, '..', 'dist', 'healthwiz-standalone.html')).href);
  await page.waitForSelector('.wl');
  await page.evaluate(() => go('water'));
  await page.click('[data-a="wa"][data-v="250"]');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz')));
  assert.equal(st.e[0].v, 250);
  await page.evaluate(() => go('stress'));
  await page.waitForTimeout(300);
  assert.deepEqual(external, [], 'loads nothing besides the html file');
  assert.deepEqual(errors, []);
  await ctx.close();
});
