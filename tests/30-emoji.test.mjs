// Every emoji the app shows is drawn as pixel art (js/v6-emoji.js, docs/ARCHITECTURE_AUDIT.md §32): hand-drawn icons
// where one shows the same object, the emoji itself pixelated otherwise. The emoji text stays, invisible.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, yearOfLogs } from './helpers.mjs';

after(closeBrowser);
const PAGES = ['home', 'health', 'food', 'water', 'sleep', 'pulse', 'stair', 'stress', 'bmi', 'calc', 'stats', 'run', 'quests', 'guide', 'badges', 'kingdom', 'set'];
// the Running page's map: the test network stub serves Leaflet empty, which the browser's SRI check rejects
const appErrors = errors => errors.filter(e => !/integrity/.test(e));
// emoji still drawn as text (outside a picture, outside SVG)
const visible = page => page.evaluate(() => { const re = /(?:\p{Emoji_Presentation}|\p{Emoji}️)/u, out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) { const p = n.parentElement; if (re.test(n.nodeValue) && !p.closest('.pxe') && !p.closest('svg')) out.push(p.tagName + ': ' + n.nodeValue.trim().slice(0, 30)); }
  return out; });

test('no emoji is drawn as text on the title screen or any page; the emoji stays in the text for screen readers and search', async () => {
  const { page, ctx, errors } = await openApp({ seed: yearOfLogs(14) });
  await page.waitForSelector('.wl');
  assert.deepEqual(await visible(page), [], 'title screen');
  for (const v of PAGES) {
    await go(page, v);
    assert.deepEqual(await visible(page), [], v);
  }
  await go(page, 'health');
  const tile = await page.evaluate(() => { const b = document.querySelector('#hub [data-v="stair"] .bi'), p = b.querySelector('.pxe');
    return { text: b.textContent, bg: getComputedStyle(p).backgroundImage.slice(0, 26), hidden: getComputedStyle(p.firstElementChild).opacity, ir: getComputedStyle(p).imageRendering }; });
  assert.equal(tile.text, '🧗', 'the emoji is still the text');
  assert.equal(tile.bg, 'url("data:image/png;base64');
  assert.equal(tile.hidden, '0', 'the emoji glyph itself is invisible');
  assert.equal(tile.ir, 'pixelated');
  assert.match(await page.textContent('#nav'), /🏠Home/, 'navigation text unchanged');
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('pictures: hand-drawn icon for the same object, otherwise the emoji pixelated: 16×16, icon palette, full outline', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const read = async u => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0); return { w: i.width, h: i.height, d: x.getImageData(0, 0, i.width, i.height).data }; };
    const hand = n => { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
      HWPixel.grid(n).forEach((row, j) => { for (let i = 0; i < 16; i++) if (row[i] !== '.') { x.fillStyle = HWPixel.PAL[row[i]]; x.fillRect(i, j, 1, 1); } }); return c.toDataURL(); };
    const pal = new Set(Object.values(HWPixel.PAL).concat(['#f4a3c4', '#c4508e', '#36a89a', '#1d6b62']).map(h => h.toLowerCase()));
    const hex = (d, p) => '#' + [d[p], d[p + 1], d[p + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
    const H = { '💧': 'water', '❤️': 'heart', '🍗': 'food', '🏆': 'achievement', '⚠️': 'warning', '📊': 'chart' };
    const out = { same: Object.keys(H).map(e => HWEmoji.src(e) === hand(H[e])), auto: [], none: ['abc', '✓', '▶', '★', ''].map(HWEmoji.src) };
    for (const e of ['🧠', '🧗', '🔥', '🍎', '🦉', '🎵']) {
      const u = HWEmoji.src(e), im = await read(u); let off = 0, edge = 0, ink = 0;
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const p = (y * 16 + x) * 4; if (!im.d[p + 3]) continue; const c = hex(im.d, p);
        if (!pal.has(c)) off++; if (c === '#1b1626') ink++; if ((x === 0 || y === 0 || x === 15 || y === 15) && c !== '#1b1626') edge++; }
      out.auto.push({ e, w: im.w, h: im.h, off, edge, ink: ink > 8 });
    }
    return out; });
  assert.deepEqual(r.same, [true, true, true, true, true, true], 'same-object emoji use the hand-drawn icons');
  for (const a of r.auto) assert.deepEqual(a, { e: a.e, w: 16, h: 16, off: 0, edge: 0, ink: true }, a.e + ': 16×16, palette colours only, ink outline');
  assert.deepEqual(r.none, [null, null, null, null, null], 'text and typographic symbols are left as text');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('pictures follow the text size in even 8 px steps, at least 16 px, and keep rows from overflowing on a 360 px phone', async () => {
  const { page, ctx, errors } = await openApp({ seed: yearOfLogs(14), viewport: { width: 360, height: 800 } });
  for (const v of PAGES) {
    await go(page, v);
    // layout size (offsetWidth): an animating card may be scaled for a moment
    const bad = await page.evaluate(() => [...document.querySelectorAll('.pxe')].map(e => e.offsetWidth).filter(w => w && (w < 16 || w % 8)));
    assert.deepEqual(bad, [], v + ': picture sizes');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, v + ' overflows');
  }
  await go(page, 'health');
  const sz = await page.evaluate(() => [document.querySelector('#hub .bi .pxe').offsetWidth, document.querySelector('#nav .pxe').offsetWidth]);
  assert.ok(sz[0] >= 32 && sz[1] >= 16, 'big tile icons stay big: ' + sz);
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('emoji added later are converted as they appear: toasts, dialogs, updated text, celebrations and mini-games', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'home');
  await page.evaluate(() => toast('💧 Well done ✨'));
  await page.evaluate(() => HWUI.celebrate({ icon: '🏆', title: 'TEST', sub: 'a celebration' }));
  await page.evaluate(() => { const b = document.querySelector('#mus'); b.textContent = '🔇'; });
  await page.waitForTimeout(50);
  assert.deepEqual(await visible(page), [], 'toast, celebration and changed text');
  assert.equal(await page.textContent('#mus'), '🔇');
  await go(page, 'kingdom');
  await page.click('[data-a="kreg"]');
  assert.deepEqual(await visible(page), [], 'region dialog');
  await page.keyboard.press('Escape');
  for (const g of ['grove']) {
    await page.evaluate(g => go(HWGames.games.find(x => x.id === g).page), g);
    await page.click(`[data-a="game"][data-g="${g}"]`);
    await page.waitForSelector('.v6g[role="dialog"]');
    await page.waitForTimeout(300);
    assert.deepEqual(await visible(page), [], 'mini-game ' + g);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});
