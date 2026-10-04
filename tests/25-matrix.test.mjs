// Step 25 (master prompt §77, §81–82, §93–95): the device and input matrix, part 1.
// Every page at the seven §82 screen sizes, rotation and both themes. Part 2 (touch, keyboard, long text, safe areas,
// window resizing) is tests/25-matrix-input.test.mjs: split so each file stays well inside the runner's 90 s limit.
// Chromium only here; docs/TESTING.md lists the checks to repeat on real Safari/Firefox/Samsung.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, yearOfLogs } from './helpers.mjs';

after(closeBrowser);
const PAGES = ['home', 'health', 'food', 'water', 'sleep', 'pulse', 'stair', 'stress', 'bmi', 'calc', 'stats', 'quests', 'guide', 'badges', 'kingdom', 'set'];
const LONG = 'W'.repeat(20);                                   // widest name the registry accepts (20 characters)
const busy = () => { const s = yearOfLogs(30); s.p.name = LONG; return s; };
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const snag = page => page.evaluate(() => /HIT A SNAG/.test(document.querySelector('#main').textContent));
const SIZES = [['phone S', 360, 800], ['phone M', 390, 844], ['phone L', 412, 915], ['tablet portrait', 768, 1024], ['tablet landscape', 1024, 768], ['desktop', 1280, 800], ['desktop XL', 1920, 1080]];
for (const [name, w, h] of SIZES) {
  test(`${name} ${w}×${h}: every page fits, navigation suits the screen, nothing hides behind it`, async () => {
    const { page, ctx, errors } = await openApp({ seed: busy(), viewport: { width: w, height: h } });
    await page.waitForSelector('.wl');
    const start = await page.evaluate(() => [...document.querySelectorAll('.wl .ct button')].map(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }));
    assert.ok(start.length >= 2 && start.every(Boolean), 'title buttons fully on screen');
    assert.ok(await overflow(page) <= 1, 'title screen overflows');
    for (const v of PAGES) {
      await go(page, v);
      assert.ok(await overflow(page) <= 1, `${v} overflows by ${await overflow(page)}px`);
      assert.equal(await snag(page), false, v + ' shows the error card');
    }
    const nav = await page.evaluate(() => { const n = document.querySelector('#nav'), b = n.getBoundingClientRect(), m = document.querySelector('#main').getBoundingClientRect(), a = document.querySelector('.app').getBoundingClientRect();
      return { pos: getComputedStyle(n).position, top: b.top, bottom: b.bottom, right: b.right, mainLeft: m.left, appLeft: a.left, appW: a.width,
        tabs: [...n.querySelectorAll('button')].map(x => { const r = x.getBoundingClientRect(); return { in: r.left >= -1 && r.right <= innerWidth + 1, h: r.height }; }) }; });
    assert.equal(nav.tabs.length, 5);
    assert.ok(nav.tabs.every(t => t.in && t.h >= 40), 'all five tabs visible and at least 40 px tall');
    if (w < 760) {
      assert.equal(nav.pos, 'fixed', 'phones: bottom navigation');
      assert.ok(Math.abs(nav.bottom - h) <= 1, 'pinned to the bottom edge');
      // the end of every page clears the bottom bar (§94 bottom navigation)
      for (const v of ['home', 'set', 'stats']) {
        await go(page, v);
        const gap = await page.evaluate(() => { scrollTo(0, document.documentElement.scrollHeight); const els = [...document.querySelectorAll('#main button, #main input, #main select')].filter(e => e.offsetParent); const last = els[els.length - 1].getBoundingClientRect(); return document.querySelector('#nav').getBoundingClientRect().top - last.bottom; });
        assert.ok(gap >= 0, `${v}: the last control is ${-gap}px under the navigation bar`);
      }
    } else {
      assert.equal(nav.pos, 'sticky', 'wider screens: side navigation');
      assert.ok(nav.right <= nav.mainLeft + 1, 'navigation sits beside the page, not over it');
    }
    if (w >= 1920) assert.ok(nav.appW <= 1180 && Math.abs(nav.appLeft - (w - nav.appW) / 2) <= 2, 'large screens: centred column, not a stretched phone layout');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test('rotation and an open keyboard: title, pages and the edit dialog adapt; SAVE stays reachable', async () => {
  const { page, ctx, errors } = await openApp({ seed: busy(), viewport: { width: 390, height: 844 }, context: { hasTouch: true, isMobile: true } });
  await page.waitForSelector('.wl');
  for (const [w, h] of [[844, 390], [568, 320], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const b = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), t = r('.wl .tt'), c = r('.wl .ct'); return { onScreen: c.bottom <= innerHeight && c.right <= innerWidth, clear: t.bottom <= c.top }; });
    assert.deepEqual(b, { onScreen: true, clear: true }, `start button on screen, title clear of it, at ${w}×${h}`);
    assert.ok(await overflow(page) <= 1);
  }
  await go(page, 'pulse');
  await page.tap('[data-a="edit"]');
  await page.waitForSelector('#mo:not([hidden])');
  for (const [w, h] of [[844, 390], [640, 300], [390, 500], [390, 844]]) {   // landscape, landscape + keyboard, portrait + keyboard
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(100);
    assert.ok(await overflow(page) <= 1, `${w}×${h} overflows`);
    const ok = await page.evaluate(() => { const mo = document.querySelector('#mo'); mo.scrollTop = mo.scrollHeight; const s = mo.querySelector('[data-a="esave"]').getBoundingClientRect(); mo.scrollTop = 0; const t = mo.querySelector('h3').getBoundingClientRect(); return { save: s.top >= 0 && s.bottom <= innerHeight, title: t.top >= 0 }; });
    assert.deepEqual(ok, { save: true, title: true }, `edit dialog at ${w}×${h}`);
  }
  await page.fill('#ev', '77');
  await page.tap('[data-a="esave"]');
  assert.ok((await state(page)).e.some(e => e.c === 'pulse' && e.v === 77));
  assert.deepEqual(errors, []);
  await ctx.close();
});

const contrast = () => { const v = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const [x, y] = [L(v(a)), L(v(b))].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  return { bg: v('--bg'), ink: ['--bg', '--pn', '--p2'].map(b => cr('--ink', b)), mut: ['--bg', '--pn'].map(b => cr('--mut', b)) }; };

test('themes: follows the device until chosen, the choice survives a reload, every page works and reads well in both', async () => {
  for (const scheme of ['light', 'dark']) {
    const { page, ctx, errors } = await openApp({ context: { colorScheme: scheme } });
    await page.waitForSelector('.wl');
    assert.equal((await page.evaluate(contrast)).bg, scheme === 'dark' ? '#101a24' : '#efe3bd', 'device scheme followed: ' + scheme);
    await ctx.close();
    assert.deepEqual(errors, []);
  }
  const { page, ctx, errors } = await openApp({ seed: busy(), context: { colorScheme: 'light' } });
  await page.waitForSelector('.wl');
  await go(page, 'set');
  await page.click('[data-a="theme"]');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
  assert.equal((await state(page)).s.theme, 'dark', 'choice saved');
  await page.reload();
  await page.waitForSelector('.wl');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'still dark after a reload');
  for (const theme of ['dark', 'light']) {
    await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
    for (const v of PAGES) { await go(page, v); assert.equal(await snag(page), false, `${v} in ${theme}`); }
    const c = await page.evaluate(contrast);
    assert.ok(c.ink.every(x => x >= 7), `${theme}: body text contrast ${c.ink} (AAA 7:1)`);
    assert.ok(c.mut.every(x => x >= 4.5), `${theme}: muted text contrast ${c.mut} (AA 4.5:1)`);
  }
  await go(page, 'set');
  await page.click('[data-a="theme"]');
  assert.equal((await state(page)).s.theme, 'dark', 'the button still toggles');
  assert.deepEqual(errors, []);
  await ctx.close();
});
