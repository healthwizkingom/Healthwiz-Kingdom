// Usability pass (js/v6-hall.js, js/v6-stairs.js counters, js/v6-body.js): the Health Hall tap flow, step-range chips,
// Body & Energy. More items are added below by later commits.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';

after(closeBrowser);
const M = { viewport: { width: 390, height: 844 }, context: { hasTouch: true, isMobile: true } };
const noScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

test('every tracker page shows the same 3-line header; tiles show today and the one input; Next step names the first gap', async () => {
  const { page, ctx, errors } = await openApp(M);
  for (const v of ['food', 'water', 'sleep', 'stair', 'body']) {
    await go(page, v);
    assert.equal(await page.locator('#hwh3').count(), 1, v + ' header');
    assert.deepEqual(await page.$$eval('#hwh3 .hwhr b', b => b.map(x => x.textContent)), ['WHAT THIS IS', 'WHAT TO ENTER', 'WHY IT MATTERS'], v);
    assert.ok(await noScroll(page), v + ' no horizontal scroll');
  }
  await go(page, 'health');
  assert.match(await page.textContent('#hwnext'), /Water:.*250 mL/, 'nothing logged: water first');
  assert.match(await page.textContent('#hub [data-v="food"]'), /Water 0 \/ 2,000 mL[\s\S]*Tap to pick a food or add 250 mL/);
  assert.match(await page.textContent('#hub [data-v="body"]'), /Tap to enter height \+ weight/);
  await go(page, 'water'); await page.tap('[data-a="wa"][data-v="250"]'); await page.waitForTimeout(300);
  await go(page, 'health');
  assert.match(await page.textContent('#hwnext'), /Food:/, 'water done, food is next');
  assert.deepEqual(errors, []); await ctx.close();
});

test('an example line sits under an empty input, links to it and hides once there is a value', async () => {
  const { page, ctx, errors } = await openApp(M);
  await go(page, 'water');
  assert.equal(await page.getAttribute('#wc', 'placeholder'), null, 'old placeholder removed');
  assert.match(await page.textContent('#hwe-wc'), /Example: 330/);
  assert.equal(await page.getAttribute('#wc', 'aria-describedby'), 'hwe-wc');
  await page.fill('#wc', '300'); assert.equal(await page.isHidden('#hwe-wc'), true);
  await page.fill('#wc', ''); assert.equal(await page.isVisible('#hwe-wc'), true);
  assert.deepEqual(errors, []); await ctx.close();
});

test('stairs: two taps fill a climb with a range midpoint and a count; 44px chips; total reads steps × climbs; saved shape unchanged', async () => {
  const { page, ctx, errors } = await openApp(M);
  await go(page, 'stair');
  await page.tap('#stman .sqlist .chip >> nth=0');
  assert.equal(await page.isHidden('#ss'), true, 'number box waits behind the chips');
  await page.tap('#stman [data-a="strng"][data-r="1"]');      // 6–10 → 8
  await page.tap('#stman [data-a="stcl"][data-n="3"]');
  assert.equal(await page.inputValue('#ss'), '8');
  assert.equal(await page.inputValue('#sc'), '3');
  assert.match(await page.textContent('#tot'), /8 steps × 3 climbs = 24 steps/);
  const small = await page.$$eval('#stcnt-c .chip', b => b.filter(x => x.offsetHeight < 44 || x.offsetWidth < 44).length);
  assert.equal(small, 0, 'every chip is at least 44 px');
  await page.fill('#ss', '9'); assert.match(await page.textContent('#tot'), /9 steps × 3 climbs = 27 steps/, 'the default can be changed');
  await page.tap('#stman [data-a="savestair"]'); await page.waitForTimeout(300);
  const e = (await state(page)).e.filter(x => x.c === 'stair')[0];
  assert.equal(e.v, 27); assert.equal(e.m.steps, 9); assert.equal(e.m.climbs, 3);
  await page.tap('#stman [data-a="strng"][data-r="c"]'); await page.fill('#ss', '1001'); await page.tap('#stman [data-a="stcl"][data-n="2"]');
  await page.tap('#stman [data-a="savestair"]'); await page.waitForTimeout(200);
  assert.equal((await state(page)).e.filter(x => x.c === 'stair').length, 1, 'steps above 1000 are still refused');
  assert.ok(await noScroll(page));
  assert.deepEqual(errors, []); await ctx.close();
});

test('Body & Energy: one page; bmi and calc routes open it at their section; unconfirmed profile starts empty; typing never changes the saved profile', async () => {
  const { page, ctx, errors } = await openApp(M);
  await go(page, 'bmi');
  assert.equal(await page.evaluate(() => S.v), 'body');
  assert.deepEqual(await page.$$eval('.sthd', h => h.map(x => x.id)), ['be-bmi', 'be-energy', 'be-macro']);
  await go(page, 'calc');
  assert.ok(await page.evaluate(() => document.getElementById('be-energy').getBoundingClientRect().top < 200), 'calc scrolls to the energy section');
  assert.equal(await page.locator('#hub').count(), 0);
  await go(page, 'health');
  assert.deepEqual(await page.$$eval('#hub [data-v]', b => b.map(x => x.dataset.v).filter(v => v === 'body' || v === 'bmi' || v === 'calc')), ['body'], 'one tile');
  await go(page, 'body');
  await page.fill('#bh', '180'); await page.fill('#bw', '90');
  assert.match(await page.textContent('#bout'), /27\.8/);
  const p0 = await page.evaluate(() => JSON.stringify(st.p));
  assert.equal(p0.includes('"h":180'), false, 'typing does not change the profile');
  assert.match(await page.textContent('#eout'), /BMR[\s\S]*TDEE[\s\S]*Not saved yet/);
  assert.match(await page.textContent('#bout'), /not a diagnosis/);
  assert.ok(await noScroll(page));
  const fresh = await openApp({ ...M, seed: { ...RETURNING, s: { ...RETURNING.s, onb: 0 } } });
  await go(fresh.page, 'body');
  assert.equal(await fresh.page.inputValue('#bh'), '', 'no guessed height');
  assert.match(await fresh.page.textContent('#eout'), /does not guess/);
  assert.deepEqual(errors.concat(fresh.errors), []); await ctx.close(); await fresh.ctx.close();
});
