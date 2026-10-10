// Phone-width fit (411 px): the help "?" keeps a 44 px tap area but is drawn smaller, the week-vs-week table and the 7-day
// chart labels fit their cards, and the Water Quest header carries no kingdom-state tag.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, yearOfLogs } from './helpers.mjs';

after(closeBrowser);
const M = { viewport: { width: 411, height: 900 }, context: { isMobile: true, hasTouch: true } };
const boot = async () => { const r = await openApp({ ...M, seed: yearOfLogs(20) }); await r.page.waitForSelector('.wl'); return r; };

test('help ? button: 44 px tap area, smaller drawn button', async () => {
  const { page, ctx, errors } = await boot();
  await go(page, 'stats');
  const b = await page.evaluate(() => { const e = document.querySelector('#main .hwh:not(.hwhl)'), r = e.getBoundingClientRect(), p = getComputedStyle(e, '::before'); return { w: r.width, h: r.height, vw: parseFloat(p.width), vh: parseFloat(p.height), bg: getComputedStyle(e).backgroundColor }; });
  assert.ok(b.w >= 43.5 && b.h >= 43.5, 'tap area ' + b.w + 'x' + b.h);
  assert.ok(b.vw <= 30 && b.vh <= 30 && b.vw >= 22, 'drawn button ' + b.vw + 'x' + b.vh);
  assert.equal(b.bg, 'rgba(0, 0, 0, 0)', 'the 44 px box itself is not painted');
  assert.deepEqual(errors, []); await ctx.close();
});

test('week vs week table fits its card and the 7-day chart labels do not touch', async () => {
  const { page, ctx, errors } = await boot();
  await go(page, 'stats');
  const t = await page.evaluate(() => { const c = document.querySelector('#v6cmp'), cr = c.getBoundingClientRect(), s = c.querySelector('.tscroll');
    return { scroll: s.scrollWidth - s.clientWidth, out: [...c.querySelectorAll('th,td')].filter(e => e.getBoundingClientRect().right > cr.right - 4).length, th: [...c.querySelectorAll('th')].map(e => e.scrollWidth - e.clientWidth) }; });
  assert.deepEqual([t.scroll, t.out], [0, 0], JSON.stringify(t));
  assert.ok(t.th.every(x => x <= 0), 'no header text spills out of its cell: ' + t.th);
  const g = await page.evaluate(() => [...document.querySelectorAll('.chl')].map(r => { const s = [...r.children].map(x => { const q = document.createRange(); q.selectNodeContents(x); return [q.getBoundingClientRect(), x.getBoundingClientRect()]; }); return s.every(([txt, box]) => txt.width <= box.width - 2); }));
  assert.ok(g.length >= 2 && g.every(Boolean), 'each day label has room in its column: ' + g);
  assert.match(await page.textContent('.chl'), /^Su\s*Mo\s*Tu\s*We\s*Th\s*Fr\s*Sa$/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Water Quest header has no kingdom-state tag; Nutrition keeps its own', async () => {
  const { page, ctx, errors } = await boot();
  await go(page, 'water');
  const w = await page.textContent('.nshd');
  assert.match(w, /WATER QUEST[\s\S]*Water Valley/);
  assert.doesNotMatch(w, /RUINED|RECOVERING|DEVELOPING|THRIVING|FLOURISHING/);
  assert.equal(await page.locator('.nshd .pxtag').count(), 0);
  await go(page, 'food');
  assert.match(await page.textContent('.nshd'), /NUTRITION & CALORIES[\s\S]*Nutrition Village\s*(RUINED|RECOVERING|DEVELOPING|THRIVING|FLOURISHING)/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('wake-up alarm notice: the ? button does not cover the text', async () => {
  const { page, ctx, errors } = await boot();
  await go(page, 'sleep');
  const o = await page.evaluate(() => { const b = document.querySelector('.v6alw .hwh'), q = getComputedStyle(b, '::before'), r = b.getBoundingClientRect(), x = parseFloat(q.width);
    const vis = { l: r.left + (r.width - x) / 2, r: r.left + (r.width + x) / 2, t: r.top + (r.height - x) / 2, b: r.top + (r.height + x) / 2 };
    const rg = document.createRange(), sp = b.parentElement, hit = []; const w = document.createTreeWalker(sp, NodeFilter.SHOW_TEXT); let n;
    while (n = w.nextNode()) { if (b.contains(n)) continue; rg.selectNodeContents(n); for (const c of rg.getClientRects()) if (c.width && c.left < vis.r && c.right > vis.l && c.top < vis.b - 3 && c.bottom > vis.t + 3) hit.push(n.textContent.slice(0, 20)); }
    return { hit, x }; });
  assert.ok(Number.isFinite(o.x), 'the drawn button exists');
  assert.deepEqual(o.hit, [], 'text under the button');
  assert.deepEqual(errors, []); await ctx.close();
});
