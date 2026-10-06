// The Counting Sheep dream on the Sleep page (js/v6-sheep.js): one pixel-art canvas scene with the original rules.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, go, state, closeBrowser } from './helpers.mjs';

after(closeBrowser);
const EMOJI = /\p{Extended_Pictographic}/u;
const ready = page => page.waitForFunction(() => HWSheep.ready);

test('the scene: a pixel canvas with a label, a full screen button, no emoji; counting, the counter pops, Medius makes the sleeper react', async () => {
  const { page, errors } = await openApp();
  await go(page, 'sleep'); await ready(page);
  await page.evaluate(() => document.querySelector('#v6shw').scrollIntoView());
  await page.waitForFunction(() => HWSheep.live);
  const c = await page.evaluate(() => {
    const cv = document.querySelector('#sheepc canvas.v6shc'), b = document.querySelector('#sheepc [data-a="shfs"]');
    return { w: cv.width, h: cv.height, role: cv.getAttribute('role'), label: cv.getAttribute('aria-label'), px: getComputedStyle(cv).imageRendering,
      fs: b.getAttribute('aria-label'), icon: !!b.querySelector('svg.pxi-expand'), text: document.querySelector('#sheepc').textContent, live: HWSheep.live };
  });
  assert.deepEqual([c.w, c.h, c.role], [192, 190, 'img']);
  assert.match(c.label, /sleeps in a cosy bedroom/);
  assert.match(c.px, /pixelated|crisp-edges/);
  assert.equal(c.fs, 'Full screen dream'); assert.ok(c.icon);
  assert.doesNotMatch(c.text, EMOJI, 'no emoji in the dream card');
  assert.ok(c.live, 'animates while on screen');
  await page.click('[data-a="shst"]');
  assert.ok(await page.isVisible('#shs canvas.v6shc'));
  await page.waitForFunction(() => S.shp.n >= 1, null, { timeout: 4000 });
  assert.match(await page.textContent('#shn'), /^\d+ sheep$/);
  assert.ok(await page.evaluate(() => document.querySelector('#shn').classList.contains('v6shpop')), 'the counter pops as a sheep clears the fence');
  assert.ok(await page.evaluate(() => HWSheep.jumpers) >= 1);
  // Medius is the next jumper
  await page.evaluate(() => { S.shp.nx = S.shp.k + 1; });
  await page.waitForFunction(() => S.shp.wz === 1, null, { timeout: 5000 });
  assert.ok(await page.evaluate(() => HWSheep.reacting), 'the sleeper reacts in their sleep');
  assert.match(await page.textContent('#toasts'), /Was that… Medius\?/);
  assert.doesNotMatch(await page.textContent('#toasts'), EMOJI);
  await page.waitForFunction(() => !HWSheep.reacting, null, { timeout: 3000 });
  assert.deepEqual(errors, []);
});

test('DRIFT OFF keeps the daily reward rule: 3+ sheep → +10 XP once a day', async () => {
  const { page, errors } = await openApp();
  await go(page, 'sleep'); await ready(page);
  await page.click('[data-a="shst"]');
  await page.evaluate(() => { S.shp.n = 3; });
  const xp0 = (await state(page)).xp;
  await page.click('[data-a="shend"]');
  assert.match(await page.textContent('#v6shw'), /SWEET DREAMS\s*You counted [3-9] sheep\. \(\+10 XP\)/);
  const s = await state(page);
  assert.ok(s.xp >= xp0 + 10); assert.equal(s.dqn, 1);
  await page.click('[data-a="shst"]'); await page.evaluate(() => { S.shp.n = 5; });
  await page.click('[data-a="shend"]');
  assert.doesNotMatch(await page.textContent('#v6shw'), /\+10 XP/, 'once a day');
  assert.equal((await state(page)).dqn, 1);
  assert.deepEqual(errors, []);
});

test('battery and motion: stops off the page and when hidden from view; reduced motion shows a still frame', async () => {
  const { page, errors } = await openApp({ viewport: { width: 1100, height: 700 } });
  await go(page, 'sleep'); await ready(page);
  await page.evaluate(() => document.querySelector('#v6shw').scrollIntoView());
  await page.waitForFunction(() => HWSheep.live);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => !HWSheep.live, null, { timeout: 3000 });
  await go(page, 'home');
  assert.equal(await page.evaluate(() => HWSheep.live), false);
  const r = await openApp({ context: { reducedMotion: 'reduce' } });
  await go(r.page, 'sleep'); await ready(r.page);
  await r.page.click('[data-a="shst"]');
  await r.page.waitForFunction(() => S.shp.n >= 1, null, { timeout: 4000 });
  assert.equal(await r.page.evaluate(() => HWSheep.live), false, 'no animation loop with reduced motion');
  assert.deepEqual([...errors, ...r.errors], []);
});

test('full screen and layout: the dream fills the width on a phone; counter and DRIFT OFF stay in view; full screen toggles', async () => {
  const { page, errors } = await openApp({ viewport: { width: 360, height: 740 } });
  await go(page, 'sleep'); await ready(page);
  await page.click('[data-a="shst"]');
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => {
    const sc = document.querySelector('.v6sh').getBoundingClientRect(), card = document.querySelector('#sheepc').getBoundingClientRect(),
      btn = document.querySelector('[data-a="shend"]').getBoundingClientRect(), nav = document.querySelector('nav').getBoundingClientRect();
    return { sw: sc.width, cw: card.width, over: document.documentElement.scrollWidth > innerWidth, btnOk: btn.bottom <= nav.top && btn.top >= 0, cnt: document.querySelector('#shn').getBoundingClientRect().top >= 0 };
  });
  assert.ok(m.sw >= m.cw - 8, 'the scene spans the card');
  assert.equal(m.over, false);
  assert.ok(m.btnOk && m.cnt, 'counter and DRIFT OFF visible without scrolling');
  await page.click('[data-a="shfs"]');
  await page.waitForFunction(() => HWSheep.full() && document.querySelector('[data-a="shfs"]').getAttribute('aria-label') === 'Leave full screen');
  const fs = await page.evaluate(() => { const b = document.querySelector('[data-a="shend"]').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0; });
  assert.ok(fs, 'DRIFT OFF is on the full screen');
  await page.click('[data-a="shfs"]');
  await page.waitForFunction(() => !HWSheep.full());
  // desktop: scene, counter and button fit the window together
  const d = await openApp({ viewport: { width: 1280, height: 720 } });
  await go(d.page, 'sleep'); await ready(d.page);
  await d.page.click('[data-a="shst"]'); await d.page.waitForTimeout(900);
  const dk = await d.page.evaluate(() => { const w = document.querySelector('#v6shw').getBoundingClientRect(), s = document.querySelector('.v6sh').getBoundingClientRect(); return { fit: w.top >= 0 && w.bottom <= innerHeight, h: s.height }; });
  assert.ok(dk.fit, 'everything visible at 1280×720');
  assert.ok(dk.h >= 480, 'the scene is large on a desktop: ' + dk.h);
  // the alarm wakes the dream
  await d.page.evaluate(() => document.body.classList.add('v6wake'));
  await d.page.waitForTimeout(100);
  assert.deepEqual([...errors, ...d.errors], []);
});
