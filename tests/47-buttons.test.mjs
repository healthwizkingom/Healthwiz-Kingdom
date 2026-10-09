// Button hierarchy and visibility (js/v6-buttons.js): secondary buttons have a visible edge in every theme, text on buttons is
// readable, disabled looks different from quiet, and the two jump buttons lead to their forms.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING } from './helpers.mjs';

after(closeBrowser);
const seedWith = theme => { const s = JSON.parse(JSON.stringify(RETURNING)); if (theme) s.s.theme = theme; return s; };
const ratio = (a, b) => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }, l = c => .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]), x = l(a), y = l(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) };

// every visible, enabled button: its edge or its fill must stand out from what it sits on (3:1), its text must be 4.5:1 on its fill
const audit = page => page.evaluate(() => {
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1] };
  const bgOf = el => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > .5) return c; e = e.parentElement } return [255, 255, 255, 1] };
  return [...document.querySelectorAll('button')].filter(b => b.offsetParent && b.getBoundingClientRect().width > 0 && !b.disabled && !b.closest('.kn') && !b.classList.contains('v6shfs') && !b.classList.contains('nst'))
    .map(b => { const cs = getComputedStyle(b); return { k: (b.className || b.dataset.a || 'button') + ' "' + b.textContent.trim().slice(0, 18) + '"', bd: parse(cs.borderTopColor), fill: bgOf(b), par: bgOf(b.parentElement), fg: parse(cs.color) } });
});

for (const [theme, scheme] of [['', 'light'], ['', 'dark'], ['forest', 'dark'], ['crystal', 'dark'], ['ember', 'dark'], ['frost', 'light'], ['desert', 'light']]) {
  test('buttons stand out from their background and are readable: ' + (theme || scheme + ' (device)'), async () => {
    const { page, ctx, errors } = await openApp({ seed: seedWith(theme), viewport: { width: 390, height: 780 }, context: { colorScheme: scheme } });
    await page.waitForSelector('.wl');
    const weak = [];
    for (const v of ['home', 'food', 'water', 'sleep', 'stair', 'stress', 'bmi', 'score', 'quests', 'set']) {
      await go(page, v); await page.waitForTimeout(150);
      for (const b of await audit(page)) {
        if (Math.max(ratio(b.bd, b.par), ratio(b.fill, b.par)) < 3) weak.push(v + ': edge/fill < 3:1 ' + b.k);
        if (ratio(b.fg, b.fill) < 4.5) weak.push(v + ': text < 4.5:1 ' + b.k);
      }
    }
    assert.deepEqual([...new Set(weak)], []);
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test('disabled buttons are flat with a dashed edge; the help button is blue with white text; focus ring is blue', async () => {
  const { page, ctx, errors } = await openApp({ seed: seedWith(''), viewport: { width: 390, height: 780 } });
  await page.waitForSelector('.wl'); await go(page, 'bmi');
  const r = await page.evaluate(() => {
    const d = document.createElement('button'); d.textContent = 'X'; d.disabled = true; d.className = 'g'; document.querySelector('#main .card').appendChild(d);
    const cs = getComputedStyle(d), h = getComputedStyle(document.querySelector('.hwh'));
    const out = { dis: [cs.borderTopStyle, cs.boxShadow], help: [h.backgroundColor, h.color] };
    d.remove(); return out;
  });
  assert.equal(r.dis[0], 'dashed'); assert.equal(r.dis[1], 'none');
  assert.deepEqual(r.help, ['rgb(31, 111, 176)', 'rgb(255, 255, 255)']);
  assert.ok(ratio([31, 111, 176], [255, 255, 255]) >= 4.5, 'white on the help blue');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineColor), 'rgb(31, 95, 168)');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('jump buttons lead to the log forms (sleep and meals), by tap and keyboard', async () => {
  const { page, ctx, errors } = await openApp({ seed: seedWith(''), viewport: { width: 390, height: 780 }, context: { hasTouch: true, isMobile: true } });
  await page.waitForSelector('.wl');
  await go(page, 'sleep');
  assert.match(await page.textContent('.hwjump'), /LOG LAST NIGHT'S SLEEP/);
  await page.tap('.hwjump'); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => { const r = document.querySelector('#slb').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }), true, 'bedtime field on screen');
  await go(page, 'food');
  assert.match(await page.textContent('.hwjump'), /LOG A MEAL/);
  await page.focus('.hwjump'); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
  assert.equal(await page.evaluate(() => { const r = document.querySelector('#fpick').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 }), true, 'pick-a-food card on screen');
  await go(page, 'water');
  assert.equal(await page.locator('.hwjump').count(), 0, 'only on the two long pages');
  assert.deepEqual(errors, []);
  await ctx.close();
});
