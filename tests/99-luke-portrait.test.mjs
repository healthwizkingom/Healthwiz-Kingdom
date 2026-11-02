// Regression: AI Luke's small portrait (.awface) is a 44 px box with a 2 px border; its sprite sheet (12 faces) was sized in
// fixed pixels for 44 px, so the 40 px window cropped the right and bottom of every face and drifted on later expressions.
// The sheet must be sized from the box, so exactly one whole face shows at every screen size.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go } from './helpers.mjs';

after(closeBrowser);

for (const [w, h] of [[360, 760], [768, 1024], [1024, 768]]) {
  test(`AI Luke's portrait shows one whole face, ${w} x ${h}`, async () => {
    const { page, ctx, errors } = await openApp({ viewport: { width: w, height: h }, context: { isMobile: true, hasTouch: true } });
    await go(page, 'food');
    await page.evaluate(() => { S.cf = 1; render(); });
    await page.waitForSelector('.awface');
    const r = await page.evaluate(() => {
      const e = document.querySelector('.awface'), c = getComputedStyle(e), b = e.getBoundingClientRect();
      const inner = b.width - 2 * parseFloat(c.borderLeftWidth), innerH = b.height - 2 * parseFloat(c.borderTopWidth);
      const [bw, bh] = c.backgroundSize.split(' ').map(parseFloat);
      const sizePx = c.backgroundSize.split(' ').map((v, i) => v.endsWith('%') ? parseFloat(v) / 100 * (i ? innerH : inner) : parseFloat(v));
      return { inner, innerH, sheetW: sizePx[0], sheetH: sizePx[1], n: window.HWLuke ? 12 : 12 };
    });
    assert.equal(Math.round(r.sheetH), Math.round(r.innerH), 'the sheet is as tall as the window: no bottom cut');
    assert.equal(Math.round(r.sheetW), Math.round(12 * r.inner), 'twelve faces, each exactly as wide as the window: no side cut');
    assert.deepEqual(errors, []); await ctx.close();
  });
}
