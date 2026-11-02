// Regression: the Traveller's Registry card is a parchment scroll with dark ink. A later stylesheet (js/v6-flair.js,
// `html #main .card`) once overrode the parchment, leaving dark text on the dark chamber (unreadable read-back, 2026-11).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);
const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

for (const scheme of ['light', 'dark']) {
  test(`registry steps and read-back keep the parchment behind the text, ${scheme} theme, phone width`, async () => {
    const { page, ctx, errors } = await openApp({ fresh: true, viewport: { width: 390, height: 844 }, context: { isMobile: true, hasTouch: true, colorScheme: scheme } });
    for (const i of [0, 2, 5, 6, 7]) {
      await page.evaluate(i => { S.v = 'onb'; S.ob = { i, d: { name: 'Aina', age: 19, sex: 'f', h: 165, w: 58, act: 1.2 }, err: '' }; render(); }, i);
      await page.waitForSelector('.obw .card');
      const r = await page.evaluate(() => {
        const c = document.querySelector('.obw .card'), cs = getComputedStyle(c);
        const ink = [...c.querySelectorAll('h3, span, label, b, small')].map(e => getComputedStyle(e).color);
        return { img: cs.backgroundImage, col: cs.color, ink };
      });
      assert.match(r.img, /repeating-linear-gradient/, `step ${i}: the parchment is drawn (not overridden)`);
      for (const c of [r.col, ...r.ink]) assert.ok(ratio(c, 'rgb(247, 236, 201)') >= 4.5, `step ${i}: ${c} reads on the parchment (${ratio(c, 'rgb(247, 236, 201)').toFixed(1)}:1)`);
    }
    assert.deepEqual(errors, []); await ctx.close();
  });
}
