import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('app boots with no page errors and shows the welcome screen', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl', { timeout: 3000 });
  assert.match(await page.textContent('.tt h1'), /HEALTHWIZ/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
