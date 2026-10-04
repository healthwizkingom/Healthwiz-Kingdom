// Looks (js/v6-looks.js): the THEMES map and Settings swatches, the onboarding chamber, and the Shadow Keep.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const boot = async (o = {}) => { const r = await openApp(o); await r.page.waitForSelector('.wl'); return r; };
const contrast = () => {
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim().toLowerCase();
  const L = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const [x, y] = [L(v(a)), L(v(b))].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
  return { bg: v('--bg'), red: v('--red'), grn: v('--grn'), ink: ['--bg', '--pn', '--p2'].map(b => cr('--ink', b)), mut: ['--bg', '--pn', '--p2'].map(b => cr('--mut', b)) };
};

test('themes: light and dark unchanged, every swatch applies at once, reads well, keeps health colours and survives a reload', async () => {
  const { page, ctx, errors } = await boot({ context: { colorScheme: 'light' } });
  assert.equal((await page.evaluate(contrast)).bg, '#efe3bd', 'no choice saved: follows the device as before');
  const keys = await page.evaluate(() => HWLooks.ORDER);
  assert.deepEqual(keys, ['auto', 'light', 'dark', 'forest', 'crystal', 'ember', 'frost', 'desert']);
  assert.deepEqual(await page.evaluate(() => [HWLooks.THEMES.light.v.bg, HWLooks.THEMES.dark.v.bg]), ['#efe3bd', '#101a24']);
  await go(page, 'set');
  assert.equal(await page.locator('#v6theme .v6sw').count(), 8);
  for (const k of keys.slice(1)) {
    await page.click(`#v6theme [data-a="skin"][data-v="${k}"]`);
    const c = await page.evaluate(contrast), want = await page.evaluate(k => HWLooks.THEMES[k], k);
    assert.equal(c.bg, want.v.bg, k + ' applied');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), want.base, k + ' base');
    assert.ok(c.ink.every(x => x >= 7), `${k}: text ${c.ink}`);
    // the original Parchment set is kept as it was (muted text on --p2 is 4.45:1 there); the new themes reach 4.5 on all three
    assert.ok(c.mut.slice(0, k === 'light' ? 2 : 3).every(x => x >= 4.5), `${k}: muted text ${c.mut}`);
    assert.deepEqual([c.red, c.grn], ['#d9453d', '#3f9f4a'], k + ': health colours unchanged');
    assert.equal((await state(page)).s.theme, k, k + ' saved');
    assert.equal(await page.getAttribute(`#v6theme [data-v="${k}"]`, 'aria-pressed'), 'true');
    for (const v of ['home', 'water', 'stats', 'kingdom']) await go(page, v);
    await go(page, 'set');
  }
  await page.click('#v6theme [data-v="crystal"]');
  await page.reload(); await page.waitForSelector('.wl');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.skin), 'crystal', 'still Crystal Cavern after a reload');
  await go(page, 'set');
  await page.click('[data-a="theme"]');
  assert.deepEqual([await page.evaluate(() => document.documentElement.dataset.skin), (await state(page)).s.theme], [undefined, 'light'], 'THEME button still toggles');
  await page.click('#v6theme [data-v="auto"]');
  assert.equal((await state(page)).s.theme, undefined, 'Match system clears the choice');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('onboarding chamber: runes light per step, burst and chime at the end, few animated parts, still under reduced motion', async () => {
  const { page, ctx, errors } = await boot({ fresh: true, viewport: { width: 390, height: 844 } });
  await go(page, 'onb');
  assert.ok(await page.isVisible('.v6ch'), 'chamber shown');
  const lit = () => page.locator('.v6rc .rn.on').count();
  assert.equal(await lit(), 0);
  await page.fill('#obi', 'Aina'); await page.click('[data-a="obn"]'); assert.equal(await lit(), 1);
  await page.fill('#obi', '17'); await page.click('[data-a="obn"]'); assert.equal(await lit(), 2);
  await page.click('[data-a="obsex"][data-v="f"]'); assert.equal(await lit(), 3);
  await page.fill('#obi', '160'); await page.click('[data-a="obn"]');
  await page.fill('#obi', '55'); await page.click('[data-a="obn"]');
  await page.click('[data-a="obact"]'); assert.equal(await lit(), 6, 'review: all six steps done');
  const moving = await page.evaluate(() => [...document.querySelectorAll('.v6ch, .v6ch *, .v6rc, .v6rc *')].filter(e => getComputedStyle(e).animationName !== 'none').length);
  assert.ok(moving > 0 && moving < 30, 'animated elements: ' + moving);
  // the form card keeps its own parchment colours: dark text on a light scroll in every theme
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  const ink = await page.evaluate(() => getComputedStyle(document.querySelector('.obw .card')).color);
  assert.equal(ink, 'rgb(43, 36, 24)');
  await page.evaluate(() => { st.s.sound = 1; window.__f = []; const o = sfx; window.sfx = sfx = (f, d) => { __f.push(f); }; });
  await page.click('[data-a="obf"]');
  assert.equal(await page.locator('.v6burst').count(), 1, 'light burst');
  await page.waitForTimeout(1700);
  assert.equal(await page.locator('.v6burst').count(), 0, 'burst removed');
  assert.ok((await page.evaluate(() => __f)).includes(2093), 'chime played');
  await go(page, 'home');
  assert.equal(await page.isVisible('.v6ch'), false, 'chamber only on the registry');
  assert.deepEqual(errors, []);
  await ctx.close();
  const r = await boot({ fresh: true, context: { reducedMotion: 'reduce' } });
  await go(r.page, 'onb');
  assert.equal(await r.page.evaluate(() => [...document.querySelectorAll('.v6ch *, .v6rc svg')].filter(e => getComputedStyle(e).animationName !== 'none').length), 0, 'static under reduced motion');
  assert.deepEqual(r.errors, []);
  await r.ctx.close();
});

test('Shadow Keep: anchored on its plinth, crisp pixels, on the title and Kingdom page, storm weakens as regions are restored', async () => {
  const { page, ctx, errors } = await boot();
  assert.equal(await page.locator('.wl .zsv .v6keep').count(), 1, 'title scene draws the keep');
  const anchored = sel => page.evaluate(sel => [...document.querySelectorAll(sel + ' rect')].filter(r => r.getAttribute('fill') === '#2c2240' && +r.getAttribute('height') >= 20)
    .map(r => +r.getAttribute('y') + +r.getAttribute('height')), sel);
  const bottoms = await anchored('.v6keep');
  assert.equal(bottoms.length, 5, 'two towers, the keep and two walls');
  assert.ok(bottoms.every(b => b === 56), 'every tower and wall stands on the plinth top: ' + bottoms);
  await go(page, 'kingdom');
  assert.equal(await page.getAttribute('#v6keep svg', 'shape-rendering'), 'crispEdges');
  assert.ok((await anchored('#v6keep')).every(b => b === 56));
  const ruined = +(await page.getAttribute('#v6keep .v6aura', 'opacity'));
  assert.equal(ruined, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
  const e = [entry('water', 250, 0), entry('sleep', 8, 0, { bed: '23:00', wake: '07:00' }), entry('stress', 3, 0)];
  const r = await boot({ seed: { ...RETURNING, e } });
  await go(r.page, 'kingdom');
  const n = await r.page.evaluate(() => HWLooks.restored());
  assert.ok(n >= 2, 'regions restored: ' + n);
  assert.ok(+(await r.page.getAttribute('#v6keep .v6aura', 'opacity')) < ruined, 'storm weaker');
  assert.match(await r.page.textContent('#v6keep'), new RegExp(n + '/8 restored'));
  assert.deepEqual(r.errors, []);
  await r.ctx.close();
});
