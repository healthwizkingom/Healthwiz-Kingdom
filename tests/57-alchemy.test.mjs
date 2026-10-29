// The Alchemist's Energy Workshop (js/v6-alchemy.js): food energy, work against gravity and estimated body energy use, side by side. Nothing saved.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const boot = async (seed = RETURNING, viewport) => { const r = await openApp({ seed, viewport }); await r.page.waitForSelector('.wl'); await go(r.page, 'alchemy'); return r; };
const idx = (page, name, noKcal) => page.evaluate(([n, nk]) => F.findIndex(f => f[0] === n && (!nk || f[2] == null)), [name, noKcal]);
const pick = async (page, name, noKcal) => page.selectOption('#al-fi', String(await idx(page, name, noKcal)));
const txt = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const snap = page => page.evaluate(() => ({ ls: localStorage.getItem('healthwiz'), sv: SV, n: st.e.length, keys: Object.keys(localStorage).sort().join() }));

test('reachable from Nutrition and from Stair Sense; opens cleanly with the exploring-only label', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  await go(page, 'food');
  await page.click('[data-a="alopen"]');
  assert.equal(await page.evaluate(() => S.v), 'alchemy');
  assert.match(await txt(page, '#main'), /EXPLORING ONLY — NOTHING HERE IS SAVED OR CHANGES YOUR LOGS\./);
  await go(page, 'stair');
  await page.click('.gvalc');
  assert.equal(await page.evaluate(() => S.v), 'alchemy');
  assert.deepEqual(errors, []); await ctx.close();
});

test('kcal to kJ: 1 kcal = 4.184 kJ, with the portion scaled from the stated portion', async () => {
  const { page, ctx, errors } = await boot();
  await pick(page, 'Roti Canai');
  assert.match(await txt(page, '#al-fres'), /stated portion 80g/);
  assert.match(await txt(page, '#al-fres'), /280 kcal = 1,172 kJ/);   // 280 x 4.184 = 1171.52
  assert.ok(Math.abs(await page.evaluate(() => HWAlchemy.food().kJ) - 1171.52) < 1e-9);
  await page.click('[data-a="alpm"][data-v="1.5"]');                 // 420 kcal = 1757.28 kJ
  assert.match(await txt(page, '#al-fres'), /420 kcal = 1,757 kJ/);
  assert.match(await txt(page, '#al-fres'), /1\.5 = your portion/);
  assert.match(await txt(page, '#al-fres'), /Kolej MARA Kulim menu data/);
  await page.click('[data-a="alsrc"][data-v="manual"]');
  await page.fill('#al-kcin', '100');                                 // 418.4 kJ
  assert.match(await txt(page, '#al-fres'), /100 kcal = 418 kJ/);
  assert.match(await txt(page, '#al-fres'), /typed by you/);
  assert.match(await txt(page, '#main'), /1 kcal = 4\.184 kJ/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('missing nutrition data and unknown portions are stated, never filled in', async () => {
  const { page, ctx, errors } = await boot();
  assert.match(await txt(page, '#al-fres'), /Choose a food/);
  await pick(page, 'Kurma', true);                                           // the menu lists no energy for "3 biji"
  assert.match(await txt(page, '#al-fres'), /does not list the energy/);
  assert.equal(await page.evaluate(() => HWAlchemy.food().ok), 0);
  assert.match(await txt(page, '#al-crs, #al-cr'), /unavailable/);
  await page.fill('#al-kcin', '60');
  assert.match(await txt(page, '#al-fres'), /60 kcal = 251 kJ/);       // 60 x 4.184 = 251.04
  assert.match(await txt(page, '#al-fres'), /typed by you \(the menu does not list its energy\)/);
  await page.click('[data-a="alsrc"][data-v="manual"]');
  await page.fill('#al-kcin', '250');
  assert.match(await txt(page, '#al-fres'), /portion not stated/);
  assert.match(await txt(page, '#al-pm'), /No portion is stated.*cannot be scaled/);
  assert.equal(await page.locator('#al-pm .chip').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('work against gravity uses the Stair Sense physics with the stairway\'s counted steps × climbs and the logged weight; an unmeasured staircase is unavailable until a height is typed', async () => {
  const { page, ctx, errors } = await boot();
  assert.equal(await page.locator('#al-n, #al-m').count(), 0, 'no typed step count, no typed body mass');
  await page.selectOption('#al-sid', 'ST20');
  assert.match(await txt(page, '#al-stp'), /Steps: 28 counted × 1 climb = 28/);
  // h = 28 x 0.169 = 4.73 m, W = 60 x 9.80665 x 4.732 = 2784 J = 2.78 kJ = 0.67 kcal
  let r = await txt(page, '#al-cres');
  assert.match(r, /4\.73 m/); assert.match(r, /2,784 J/); assert.match(r, /2\.78 kJ/); assert.match(r, /0\.67 kcal/);
  assert.match(r, /measured in the Group 14 study/); assert.match(r, /60\.0 kg, your profile weight/);
  // the body-energy illustration is a labelled assumption: W / 0.25 and W / 0.20 -> 2.66-3.33 kcal
  const c = await txt(page, '#al-cr');
  assert.match(c, /20–25%/); assert.match(c, /2\.66–3\.33 kcal/); assert.match(c, /assumptions, not measurements of you/);
  await page.fill('#al-cl', '2');                                    // 56 steps: 9.46 m, 5,569 J
  assert.match(await txt(page, '#al-stp'), /28 counted × 2 climbs = 56/);
  assert.match(await txt(page, '#al-cres'), /9\.46 m/); assert.match(await txt(page, '#al-cres'), /5,569 J/);
  await page.selectOption('#al-sid', 'ST03');                       // 55 counted steps; no measured rise: 30.53 cm x tan 19.6 = 10.9 cm, an estimate
  assert.equal(await page.inputValue('#al-r'), '');
  assert.match(await txt(page, '#al-cres'), /10\.9 cm, estimated from the stairway.s angle/);
  assert.match(await txt(page, '#al-cres'), /11\.96 m/);             // 110 x 0.10878
  await page.selectOption('#al-sid', 'ST32');                       // 65.5 degrees would give 67 cm: not guessed
  assert.match(await txt(page, '#al-cres'), /work against gravity is unavailable.*height of one step.*very steep/);
  assert.match(await txt(page, '#al-cr'), /unavailable/);
  await page.fill('#al-r', '17');
  assert.match(await txt(page, '#al-cres'), /6\.80 m/);                // 20 counted x 2 climbs x 0.17
  assert.match(await txt(page, '#al-cres'), /typed by you/);
  await page.fill('#al-cl', '0');
  assert.match(await txt(page, '#al-cres'), /unavailable.*number of climbs/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('a recorded climb fills in the stairway, steps, and its own saved estimate and mass; the three energies stay labelled apart', async () => {
  const seed = { ...RETURNING, e: [entry('stair', 40, 1, { sid: 'ST19', loc: 'Block Aisyah stairs', steps: 40, climbs: 1, dur: 5, kind: 'workout', pace: 'Moderate', kcal: { v: 32, lo: 28, hi: 36, m: 'met' },
    gv: { gid: 'x', rise: 0.157, mass: 72, n: 40 } })] };
  const { page, ctx, errors } = await boot(seed);
  const id = await page.evaluate(() => st.e[0].id);
  await page.selectOption('#al-rec', id);
  assert.equal(await page.inputValue('#al-sid'), 'ST19'); assert.match(await txt(page, '#al-stp'), /Steps: 40 from the climb you recorded/);
  const r = await txt(page, '#al-cres');
  assert.match(r, /72\.0 kg, saved with that Stair Sense record/);           // W = 72 x 9.80665 x 6.28 = 4434 J
  assert.match(r, /4,434 J/);
  assert.match(r, /Saved estimate for that session: about 32 kcal \(28–36\) = 134 kJ/);
  const cr = await txt(page, '#al-cr');
  assert.match(cr, /FOOD ENERGY[\s\S]*WORK AGAINST GRAVITY[\s\S]*ESTIMATED BODY ENERGY USE/);
  assert.match(cr, /saved: 32 kcal/);
  // the scale is optional, to one scale, and the tiny bar stays visible
  await pick(page, 'Roti Canai');
  assert.equal(await page.locator('.alscale').count(), 0);
  await page.click('[data-a="alscale"]');
  const w = await page.$$eval('.alsb i', i => i.map(x => parseFloat(x.style.width)));
  assert.equal(w.length, 3); assert.equal(w[0], 100); assert.ok(w[1] > 0 && w[1] < 5, 'work bar is small but shown: ' + w[1]);
  assert.match(await txt(page, '.alscale'), /different kinds of energy, not an exchange rate/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('neutral wording: no earning, burning off, guilt or compensating; no goal is set', async () => {
  const { page, ctx, errors } = await boot();
  await pick(page, 'Nasi Goreng Kampung'); await page.selectOption('#al-sid', 'ST20'); await page.fill('#al-cl', '2'); await page.click('[data-a="alscale"]');
  const t = await txt(page, '#main');
  assert.doesNotMatch(t, /burn|\bearn|guilt|deserve|cheat|compensat|offset|punish|treat yourself|calories? out|how many stairs/i);
  assert.match(t, /not a goal or a plan/); assert.match(t, /optional/i);
  assert.match(t, /not interchangeable/); assert.match(t, /Mechanical work against gravity/); assert.match(t, /Metabolic energy use/);
  await page.click('#main .hwh');
  const h = await txt(page, '#hwh-pop');
  assert.match(h, /not something to earn or make up for/); assert.match(h, /no number of stairs/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('exploring leaves every record unchanged', async () => {
  const seed = { ...RETURNING, e: [entry('stair', 40, 1, { sid: 'ST19', loc: 'x', steps: 40, climbs: 1 }), entry('food', 280, 0, { name: 'Roti Canai', por: '80g', qty: 1, pm: 1, meal: 'breakfast' })] };
  const { page, ctx, errors } = await boot(seed);
  const before = await snap(page);
  await pick(page, 'Roti Canai'); await page.click('[data-a="alpm"][data-v="2"]');
  await page.selectOption('#al-sid', 'ST20'); await page.fill('#al-cl', '3'); await page.click('[data-a="alscale"]');
  await page.click('[data-a="alsrc"][data-v="manual"]'); await page.fill('#al-kcin', '999');
  await go(page, 'home'); await go(page, 'alchemy');
  assert.equal(await page.inputValue('#al-cl'), '1', 'leaving the page clears the exploring state');
  assert.deepEqual(await snap(page), before);
  assert.deepEqual(errors, []); await ctx.close();
});

test('small phone screens: two cards stack, no sideways scroll, controls 44 px', async () => {
  for (const vp of [{ width: 320, height: 568 }, { width: 360, height: 640 }]) {
    const { page, ctx, errors } = await boot(RETURNING, vp);
    await pick(page, 'Nasi Beriyani'); await page.selectOption('#al-sid', 'ST19'); await page.fill('#al-cl', '5'); await page.click('[data-a="alscale"]');
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
      over: [...document.querySelectorAll('#main *')].filter(e => !e.closest('.tscroll') && e.getBoundingClientRect().width && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName).slice(0, 5),
      small: [...document.querySelectorAll('#al-food button:not(.hwh), #al-food select, #al-food input, #al-climb select, #al-climb input, .alshow, .alscale button')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43).map(e => e.id || e.dataset.a),
      stacked: document.querySelector('#al-climb').getBoundingClientRect().top >= document.querySelector('#al-food').getBoundingClientRect().bottom - 1 }));
    assert.ok(m.sw <= m.iw, vp.width + ' sideways scroll');
    assert.deepEqual(m.over, []); assert.deepEqual(m.small, []); assert.ok(m.stacked, 'cards stack on a phone');
    assert.deepEqual(errors, []); await ctx.close();
  }
});
