// The Healer's What-if on the Health Score page (js/v6-whatif.js): a simulation only, on the real scoring functions.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const boot = async (seed, viewport) => { const r = await openApp({ seed, viewport }); await r.page.waitForSelector('.wl'); await go(r.page, 'score'); if (await r.page.locator('#scorelock').count()) await r.page.dispatchEvent('[data-a="orbshow"]', 'click'); return r; };   // the score and What-if show once the orb has been read
// stress 4 -> sub 66.67; sleep 7 h at age 16 (8-10 h) -> sub 75; real score = (10*66.67 + 15*75) / 25 = 71.67 -> 72
const two = { ...RETURNING, e: [entry('stress', 4, 0), entry('sleep', 7, 0, { bed: '23:00', wake: '06:00' })] };
const full = { ...RETURNING, e: [entry('stair', 40, 0, { loc: 'ST', diff: 'MODERATE', angle: 28, steps: 40, climbs: 1, dur: 5, hrB: 70, hrA: 130, kind: 'workout' }),
  entry('stress', 3, 0), entry('bmi', 22, 0, { h: 170, w: 63 }), entry('water', 1600, 0, {}), entry('sleep', 9, 0, { bed: '22:00', wake: '07:00' })] };
const setSlider = (page, k, v) => page.locator('#wif-r-' + k).fill(String(v));
const num = (page, sel) => page.$eval(sel, e => e.textContent.trim());

test('WHAT IF? button is visible on the Health Score page; the panel opens with the simulation label and the six weights', async () => {
  const { page, ctx, errors } = await boot(two);
  const b = page.locator('.wifopen');
  assert.ok(await b.isVisible());
  assert.match(await b.textContent(), /WHAT IF\?/);
  await b.click();
  assert.match(await page.textContent('#wif'), /SIMULATION — YOUR REAL HEALTH LOG IS UNCHANGED\./);
  const legends = await page.$$eval('#wif .wifg legend', l => l.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  assert.equal(legends.length, 6);
  for (const w of ['25', '25', '15', '15', '10', '10']) assert.ok(legends.some(t => t.includes('weight ' + w + ' of 100')));
  // the "why" text is the Health Score page's own text
  const why = await page.$$eval('#wif .wifwhy p', p => p.map(x => x.innerHTML));
  const real = await page.evaluate(() => HWScore.GROUP.map(g => HWScore.WHY[g[0]]));
  assert.deepEqual(why, real);
  assert.match(await page.textContent('#main'), /WHY THESE WEIGHTS[\s\S]*Nutrition 25/);
  // the label is also behind the ? button
  await page.click('#wif .hwh');
  assert.match(await page.textContent('#hwh-pop'), /SIMULATION — YOUR REAL HEALTH LOG IS UNCHANGED\./);
  assert.deepEqual(errors, []); await ctx.close();
});

test('sliders are prefilled with the real values and the untouched simulation equals the real score', async () => {
  const { page, ctx, errors } = await boot(full);
  await page.click('.wifopen');
  const c = await page.evaluate(() => HWScore.compute());
  assert.equal(await num(page, '.wifa'), String(c.score));
  assert.equal(await num(page, '#wif-score'), String(c.score));
  assert.equal(await num(page, '#wif-diff'), 'No change (0 points)');
  assert.equal(+await page.inputValue('#wif-r-sleep'), 9);
  assert.equal(+await page.inputValue('#wif-r-stress'), 3);
  assert.equal(+await page.inputValue('#wif-r-bmi'), 22);
  assert.equal(await page.evaluate(() => HWWhatIf.simulate(HWScore.compute()).score), c.score);
  assert.deepEqual(errors, []); await ctx.close();
});

test('moving a slider updates the simulated score at once, using the real sub-score functions and weights', async () => {
  const { page, ctx, errors } = await boot(two);
  await page.click('.wifopen');
  assert.equal(await num(page, '.wifa'), '72');
  await setSlider(page, 'sleep', 9); // sub 100: (10*66.67 + 15*100) / 25 = 86.67 -> 87
  assert.equal(await num(page, '#wif-v-sleep'), '9.0 h/night');
  await page.waitForFunction(() => document.getElementById('wif-score').textContent === '87');
  assert.equal(await num(page, '#wif-diff'), '+15 points in this simulation');
  await setSlider(page, 'stress', 10); // sub 0: (0 + 15*100) / 25 = 60
  await page.waitForFunction(() => document.getElementById('wif-score').textContent === '60');
  assert.match(await num(page, '#wif-diff'), /^−12 points/);
  // the maths panel states the formula with the weights used: (10×0 + 15×100) ÷ 25
  assert.match(await page.textContent('#wif-math'), /\(15×100 \+ 10×0\) ÷ 25/);
  // cross-check against the page's own functions
  const want = await page.evaluate(() => Math.round((HWScore.WT.stress * HWScore.SUBF.stress(10) + HWScore.WT.sleep * HWScore.SUBF.sleep(9)) / (HWScore.WT.stress + HWScore.WT.sleep)));
  assert.equal(want, 60);
  // contribution table: each indicator, real and simulated
  const rows = await page.$$eval('#wif-tbl tbody tr', r => r.map(x => x.textContent.replace(/\s+/g, ' ')));
  assert.equal(rows.length, 2); assert.ok(rows.some(t => /Sleep.*7(\.0)? h\/night.*9\.0 h\/night.*15/.test(t)));
  assert.deepEqual(errors, []); await ctx.close();
});

test('RESET TO MY REAL VALUES restores the real values and the real score', async () => {
  const { page, ctx, errors } = await boot(two);
  await page.click('.wifopen');
  await setSlider(page, 'sleep', 10);
  await page.waitForFunction(() => document.getElementById('wif-score').textContent !== '72');
  await page.click('.wifreset');
  assert.equal(await num(page, '#wif-score'), '72');
  assert.equal(await num(page, '#wif-diff'), 'No change (0 points)');
  assert.equal(+await page.inputValue('#wif-r-sleep'), 7);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the real health log is untouched: same save, no new entry, no XP, no badge, no extra save', async () => {
  const { page, ctx, errors } = await boot(full);
  const snap = () => page.evaluate(() => ({ ls: localStorage.getItem('healthwiz'), n: st.e.length, xp: st.xp, b: JSON.stringify(st.b), sv: SV, keys: Object.keys(localStorage).sort().join() }));
  const before = await snap();
  await page.click('.wifopen');
  for (const [k, v] of [['sleep', 4], ['stress', 9], ['bmi', 30], ['water', 3000], ['stairs', 250]]) await setSlider(page, k, v);
  await page.click('.wifreset'); await setSlider(page, 'sleep', 6);
  await page.click('[data-a="wifclose"]');
  await page.waitForTimeout(150);
  assert.deepEqual(await snap(), before);
  assert.equal(await page.locator('.v6cel, .bpop').count(), 0, 'no celebration or badge popup');
  assert.deepEqual(errors, []); await ctx.close();
});

test('incomplete data: unlogged indicators are left out until added; no data at all is handled', async () => {
  const { page, ctx, errors } = await boot(RETURNING);
  await page.click('.wifopen');
  assert.equal(await num(page, '#wif-score'), '–');
  assert.ok(await page.locator('.wifadd').count() >= 8, 'every unlogged indicator can be added');
  assert.equal(await page.locator('#wif input[type=range]').count(), 0);
  assert.match(await num(page, '#wif-diff'), /No score to simulate/);
  await page.click('.wifrow[data-k="stress"] .wifadd'); // mid-range 5.5 -> sub 50
  await page.waitForSelector('#wif-r-stress');
  assert.equal(await num(page, '#wif-score'), '50');
  assert.match(await num(page, '#wif-diff'), /real score is not available/);
  assert.match(await page.textContent('.wifrow[data-k="stress"]'), /not your data/);
  await page.click('.wifrow[data-k="stress"] .wifx'); // remove again
  assert.equal(await num(page, '#wif-score'), '–');
  // the real score is unaffected and no entry was added
  assert.equal(await page.evaluate(() => [HWScore.compute().score, st.e.length]).then(a => a.join()), ',0');
  assert.deepEqual(errors, []); await ctx.close();
});

test('adding an unlogged indicator changes the weights of the others, as the real formula does', async () => {
  const { page, ctx, errors } = await boot(two);
  await page.click('.wifopen');
  await page.click('.wifrow[data-k="bmi"] .wifadd'); // bmi mid 28 -> sub 100 - 3.1*10 = 69; weights 10+15+10 = 35
  await page.waitForSelector('#wif-r-bmi');
  const want = await page.evaluate(() => Math.round((10 * HWScore.SUBF.stress(4) + 15 * HWScore.SUBF.sleep(7) + 10 * HWScore.SUBF.bmi(28)) / 35));
  assert.equal(await num(page, '#wif-score'), String(want));
  assert.deepEqual(errors, []); await ctx.close();
});

test('works on a small phone: no sideways scroll, sliders and buttons are large enough to touch', async () => {
  for (const vp of [{ width: 320, height: 568 }, { width: 360, height: 640 }]) {
    const { page, ctx, errors } = await boot(full, vp);
    await page.click('.wifopen');
    await setSlider(page, 'sleep', 7);
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
      sl: [...document.querySelectorAll('#wif input[type=range]')].map(e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height]),
      bt: [...document.querySelectorAll('#wif .wifbtns button, #wif .wifopen')].map(e => e.getBoundingClientRect().height),
      over: [...document.querySelectorAll('#wif *')].filter(e => !e.closest('.tscroll') && e.getBoundingClientRect().right > innerWidth + 1).length }));
    assert.ok(m.sw <= m.iw, vp.width + ': no horizontal page scroll (' + m.sw + ' > ' + m.iw + ')');
    assert.equal(m.over, 0, vp.width + ': nothing outside the screen');
    assert.ok(m.sl.every(([w, h]) => w >= 100 && h >= 40), vp.width + ': sliders ' + JSON.stringify(m.sl));
    assert.ok(m.bt.every(h => h >= 44), vp.width + ': buttons ' + m.bt);
    assert.deepEqual(errors, []); await ctx.close();
  }
});

test('the simulator closes when the page is left and survives the TODAY / LAST 7 DAYS switch', async () => {
  const { page, ctx, errors } = await boot(full);
  await page.click('.wifopen');
  await setSlider(page, 'sleep', 5);
  await page.click('[data-a="scw"][data-w="week"]');
  assert.ok(await page.locator('#wif-body').isVisible());
  assert.equal(await num(page, '#wif-diff'), 'No change (0 points)', 'new window starts from its real values');
  await go(page, 'home'); await go(page, 'score');
  assert.equal(await page.locator('#wif-body').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the What-if card sits below the orb reading (REPLAY ORB READING) and above Why these weights', async () => {
  const { page, ctx, errors } = await boot(full);
  const o = await page.evaluate(() => { const m = document.querySelector('#main').innerHTML; return ['HOW YOUR SCORE ADDS UP', 'REPLAY ORB READING', 'data-a="wifopen"', 'WHY THESE WEIGHTS'].map(k => m.indexOf(k)); });
  assert.ok(o.every((v, i) => v >= 0 && (i === 0 || v > o[i - 1])), 'table → orb reading → What-if → weights: ' + o);
  assert.deepEqual(errors, []); await ctx.close();
});
