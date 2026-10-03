// Step 25 (master prompt §77, §81–82, §93–95): the device and input matrix.
// Every page at the seven §82 screen sizes, rotation, both themes, touch, keyboard, long text, safe areas and
// window resizing. Chromium only here; docs/TESTING.md lists the checks to repeat on real Safari/Firefox/Samsung.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, state, daysAgo, RETURNING, yearOfLogs } from './helpers.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
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

test('touch: tabs, logging, edit and delete by tap; touch scrolling; every control is at least 24×24 px', async () => {
  const seed = busy();
  const { page, ctx, errors } = await openApp({ seed, viewport: { width: 390, height: 844 }, context: { hasTouch: true, isMobile: true, deviceScaleFactor: 3 } });
  await page.waitForSelector('.wl');
  await page.tap('.wl .ct button');
  await page.waitForFunction(() => S.v === 'home');
  for (const v of ['health', 'quests', 'kingdom', 'set', 'home']) {
    await page.tap(`#nav [data-v="${v}"]`);
    assert.equal(await page.evaluate(() => S.v), v, 'tap on tab ' + v);
  }
  // finger swipes (raw touch events): up scrolls the page, sideways never scrolls it horizontally
  const cdp = await ctx.newCDPSession(page);
  const swipe = async (x0, y0, x1, y1) => { const T = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await T('touchStart', x0, y0); for (let k = 1; k <= 20; k++) await T('touchMove', x0 + (x1 - x0) * k / 20, y0 + (y1 - y0) * k / 20); await T('touchEnd'); await page.waitForTimeout(300); };
  await swipe(200, 650, 200, 250);
  await swipe(320, 400, 40, 400);
  const sc = await page.evaluate(() => [scrollX, scrollY]);
  assert.equal(sc[0], 0, 'no sideways scroll');
  assert.ok(sc[1] > 100, 'scrolled down by touch: ' + sc[1]);
  await go(page, 'water');
  const n0 = (await state(page)).e.filter(e => e.c === 'water').length;
  await page.tap('[data-a="wa"][data-v="250"]');
  assert.equal((await state(page)).e.filter(e => e.c === 'water').length, n0 + 1, 'water logged by tap');
  await go(page, 'pulse');
  const p0 = (await state(page)).e.filter(e => e.c === 'pulse').length;
  await page.tap('[data-a="edit"]');
  await page.tap('#mo [data-a="mclose"]');
  assert.equal(await page.evaluate(() => document.querySelector('#mo').hidden), true, 'CANCEL closes the dialog');
  await page.tap('[data-a="del"]');
  assert.equal((await state(page)).e.filter(e => e.c === 'pulse').length, p0 - 1, 'deleted by tap');
  await page.tap('#toasts [data-a="undo"]');
  assert.equal((await state(page)).e.filter(e => e.c === 'pulse').length, p0, 'undo by tap');
  for (const v of [...PAGES, 'welcome']) {
    await go(page, v);
    const small = await page.evaluate(() => [...document.querySelectorAll('#main button, #main input, #main select, #main a[href], #nav button')].filter(e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden')
      .map(e => { const r = e.getBoundingClientRect(); return [(e.dataset.a || e.id || e.tagName) + ' ' + (e.textContent || '').trim().slice(0, 12), Math.round(r.width), Math.round(r.height)]; }).filter(x => x[1] < 24 || x[2] < 24));
    assert.deepEqual(small, [], v + ': controls smaller than 24×24 px (WCAG 2.5.8)');
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('keyboard: Tab reaches the navigation with a visible focus ring; dialogs trap focus, close on Escape and return focus', async () => {
  const { page, ctx, errors } = await openApp({ seed: busy() });
  await page.waitForSelector('.wl');
  await go(page, 'home');
  let ring = null;
  for (let i = 0; i < 4 && !ring; i++) {
    await page.keyboard.press('Tab');
    ring = await page.evaluate(() => { const a = document.activeElement; if (!a || !a.closest('#nav')) return null; const s = getComputedStyle(a); return { style: s.outlineStyle, w: parseFloat(s.outlineWidth), v: a.dataset.v }; });
  }
  assert.ok(ring, 'Tab reaches the navigation first');
  assert.ok(ring.style !== 'none' && ring.w >= 2, 'focus ring is visible: ' + JSON.stringify(ring));
  await page.focus('#nav [data-v="quests"]');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => S.v), 'quests', 'Enter activates a tab');
  // edit dialog
  await go(page, 'pulse');
  const id = await page.getAttribute('[data-a="edit"]', 'data-id');
  await page.focus('[data-a="edit"]');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement && document.activeElement.id === 'ev');
  assert.deepEqual(await page.evaluate(() => { const c = document.querySelector('#mo .card'); return [c.getAttribute('role'), c.getAttribute('aria-modal'), c.getAttribute('aria-label')]; }), ['dialog', 'true', 'EDIT ENTRY']);
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.querySelector('#mo').contains(document.activeElement)), 'Tab stays inside the dialog'); }
  await page.focus('#ev');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a), 'mclose', 'Shift+Tab wraps to the last button');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#mo').hidden);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a + ':' + document.activeElement.dataset.id), 'edit:' + id, 'focus back on the EDIT button');
  // region details panel
  await go(page, 'kingdom');
  const ri = await page.getAttribute('[data-a="kreg"]', 'data-i');
  await page.focus('[data-a="kreg"]');
  await page.keyboard.press('Enter');
  await page.waitForSelector('#mo:not([hidden]) [aria-label="Region details"]');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#mo').hidden);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.a + ':' + document.activeElement.dataset.i), 'kreg:' + ri, 'focus back on the region button');
  await page.keyboard.press('Escape');                     // nothing open: harmless
  assert.equal(await page.evaluate(() => S.v), 'kingdom');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('long text: a 20-character name, a very long custom food and note fit on a 360 px phone', async () => {
  const seed = busy();
  const food = 'Nasi' + 'Kerabu'.repeat(12) + 'Special', note = 'Felt' + 'great'.repeat(40);
  seed.e.push({ id: 'long1', c: 'food', v: 450, m: { name: food, por: '1 extra large family-style bowl with sides', qty: 1, pm: 1, meal: 'lunch', src: 'Custom', custom: 1 }, n: note, d: daysAgo(0), t: '12:30' });
  seed.e.push({ id: 'long2', c: 'pulse', v: 72, m: { st: 'Resting' }, n: note, d: daysAgo(0), t: '09:30' });
  const { page, ctx, errors } = await openApp({ seed, viewport: { width: 360, height: 800 } });
  await page.waitForSelector('.wl');
  for (const v of ['home', 'health', 'food', 'pulse', 'stats', 'quests', 'kingdom', 'set', 'badges', 'guide']) {
    await go(page, v);
    assert.ok(await overflow(page) <= 1, `${v} overflows by ${await overflow(page)}px with long text`);
  }
  await go(page, 'food');
  assert.match(await page.textContent('#main'), /NasiKerabu/, 'the long name is shown, not dropped');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('safe areas and installed mode: viewport-fit=cover, notch/home-bar insets, standalone metas', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<meta name="viewport" content="[^"]*viewport-fit=cover/);
  assert.match(html, /padding-top:env\(safe-area-inset-top/);
  assert.match(html, /padding-bottom:env\(safe-area-inset-bottom/);
  assert.match(html, /nav\{position:fixed;bottom:0[^}]*env\(safe-area-inset-bottom/, 'bottom navigation clears the home bar');
  assert.match(html, /apple-mobile-web-app-capable/);
});

test('window resizing on desktop: the layout switches between side and bottom navigation and back, charts refit', async () => {
  const { page, ctx, errors } = await openApp({ seed: busy(), viewport: { width: 1280, height: 800 } });
  await page.waitForSelector('.wl');
  await go(page, 'stats');
  for (const [w, pos] of [[700, 'fixed'], [1280, 'sticky'], [900, 'sticky'], [480, 'fixed']]) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#nav')).position), pos, 'nav at ' + w);
    assert.ok(await overflow(page) <= 1, 'no overflow at ' + w);
    const wide = await page.evaluate(() => [...document.querySelectorAll('#main .v6ch, #main .ch, #main svg')].filter(e => e.offsetParent).some(e => e.getBoundingClientRect().right > innerWidth + 1));
    assert.equal(wide, false, 'charts fit at ' + w);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});
