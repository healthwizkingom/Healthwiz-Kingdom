// The Kingdom map redrawn as a living pixel-art map (js/v6-map.js): same regions, buttons and rules.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, go, closeBrowser, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);

test('the map: painted pixel layers, the same 8 region buttons, CSS-only life, a time-of-day tint, no frame loop', async () => {
  const { page, errors } = await openApp({ seed: { ...RETURNING, e: [0, 1, 2].map(n => entry('water', 500, n)) }, before: p => p.clock.install({ time: new Date('2026-10-06T22:30:00') }) });
  await go(page, 'kingdom');
  await page.clock.runFor(300);
  const m = await page.evaluate(() => {
    const km = document.querySelector('#kmap .km.v6map'), cv = [...km.querySelectorAll('canvas.v6mc')];
    return { canvases: cv.length, size: [cv[0].width, cv[0].height], px: getComputedStyle(cv[0]).imageRendering,
      kn: [...km.querySelectorAll('.kn')].map(b => [b.dataset.v, b.getAttribute('aria-label').split(':')[0]]),
      sky: km.querySelector('.v6mz').dataset.sky, anims: km.getAnimations({ subtree: true }).filter(a => a.effect.getTiming().iterations === Infinity).length,
      props: km.querySelectorAll('.v6prop').length, fog: km.querySelector('.v6fog') !== null };
  });
  assert.equal(m.canvases, 4); assert.deepEqual(m.size, [200, 224]); assert.match(m.px, /pixelated|crisp-edges/);
  assert.deepEqual(m.kn, [['sleep', 'Dream Realm'], ['stair', 'Stair Mountain'], ['calc', 'Energy Forge'], ['stress', 'Mind Forest'], ['pulse', 'Heartstone Hall'], ['water', 'Water Valley'], ['food', 'Nutrition Village'], ['bmi', 'Balance Tower']]);
  assert.equal(m.sky, 'night', '22:30 is night');
  assert.ok(m.anims >= 8, 'swaying trees, glints, clouds, smoke, birds, fog, storm: ' + m.anims);
  assert.equal(m.props, 8); assert.ok(m.fog, 'the world layer (villagers, fog value) is still there');
  // the land is really painted (an opaque pixel in the middle of the map)
  assert.ok(await page.evaluate(() => { const c = document.querySelector('#kmap canvas.v6mbase'); return c.getContext('2d').getImageData(100, 112, 1, 1).data[3] === 255; }));
  // idle (after the one-off badge celebration): no requestAnimationFrame loop
  await page.clock.runFor(3000);
  await page.evaluate(() => { window.__n = 0; const r = requestAnimationFrame; window.requestAnimationFrame = f => { window.__n++; return r(f); }; });
  await page.clock.runFor(1500);
  assert.equal(await page.evaluate(() => window.__n), 0);
  assert.deepEqual(errors, []);
});

test('tap a region: the map zooms and pans to it, outlines it, opens its card; closing zooms back out', async () => {
  const { page, errors } = await openApp();
  await go(page, 'kingdom');
  await page.click('#kmap .kn[data-v="water"]');
  assert.match(await page.getAttribute('#kmap .v6mz', 'style'), /scale\(2\.1\)/);
  assert.equal(await page.evaluate(() => document.querySelector('#kmap .v6mol').classList.contains('on')), true, 'outlined');
  await page.waitForSelector('#mo:not([hidden]) [aria-label="Region details"]');
  assert.match(await page.textContent('#mo'), /Water Valley/);
  await page.click('#mo [data-a="mclose"]');
  assert.doesNotMatch(await page.getAttribute('#kmap .v6mz', 'style') || '', /scale/);
  assert.equal(await page.evaluate(() => HWMap.zoomed), false);
  // ENTER goes to the region's page
  await page.click('#kmap .kn[data-v="food"]');
  await page.click('#mo [data-a="kgo"][data-v="food"]');
  assert.equal(await page.evaluate(() => S.v), 'food');
  // reduced motion: the card at once, no zoom
  const r = await openApp({ context: { reducedMotion: 'reduce' } });
  await go(r.page, 'home');
  await r.page.click('#hmd-kmini > summary');   // the Kingdom map is a one-line row on Home until opened
  await r.page.click('#kmini .kn[data-v="sleep"]');
  assert.ok(await r.page.isVisible('#mo [aria-label="Region details"]'));
  assert.doesNotMatch(await r.page.getAttribute('#kmini .v6mz', 'style') || '', /scale/);
  assert.deepEqual([...errors, ...r.errors], []);
});

test('a region restored since the map was last shown bursts into colour; ruined regions stay grey under fog', async () => {
  const { page, errors } = await openApp();
  await go(page, 'kingdom');
  const ruined = await page.evaluate(() => { HWMap.paint(); const c = document.querySelector('#kmap canvas.v6mbase').getContext('2d'), d = c.getImageData(160, 150, 6, 6).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); return s / (d.length / 4); });
  assert.ok(ruined < 40, 'Water Valley is desaturated while ruined: ' + ruined);
  await page.evaluate(() => add('water', 500, {}, '', 0, 0, 0, 'Water'));
  await go(page, 'kingdom');
  await page.waitForTimeout(50);
  assert.ok(await page.$('#kmap .v6mgrey'), 'the grey copy fades away');
  assert.equal(await page.locator('#kmap .v6msw u').count(), 14, 'a sweep of sparkles');
  const colour = await page.evaluate(() => { const d = document.querySelector('#kmap canvas.v6mbase').getContext('2d').getImageData(160, 150, 6, 6).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); return s / (d.length / 4); });
  assert.ok(colour > ruined + 20, 'in colour once restored: ' + colour);
  await page.waitForTimeout(2400);
  assert.equal(await page.$('#kmap .v6mgrey'), null, 'the burst cleans up');
  assert.deepEqual(errors, []);
});
