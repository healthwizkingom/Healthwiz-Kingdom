// Stage 3: the Science Laboratory (js/v6-lab.js, v6-trial.js, v6-vault.js, v6-uncert.js): reachable from the Health Hall, the
// experiment flow on the user's own entries and on the Group 14 sample, the Evidence Trial, the Evidence Vault and the
// Uncertainty Engine. Expected numbers are worked out by hand in the comments.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const wk = (sid, b, a, n) => entry('stair', 90, n, { kind: 'workout', sid, hrB: b, hrA: a, pace: 'Moderate', dur: 5, src: 'manual', hrS: 'manual' });
// mild ST05 (21.8°): rises 20, 24, 22 → mean 22 BPM; vigorous ST27 (34.02°): 40, 44, 42 → mean 42; moderate ST14: one workout, 30
const SIX = [wk('ST05', 70, 90, 1), wk('ST05', 70, 94, 2), wk('ST05', 70, 92, 3), wk('ST27', 70, 110, 4), wk('ST27', 70, 114, 5), wk('ST27', 70, 112, 6), wk('ST14', 70, 100, 7)];
const SEED = { ...RETURNING, p: { ...RETURNING.p, cfm: 1 }, e: SIX };
const txt = async (page, sel) => (await page.innerText(sel)).replace(/\s+/g, ' ');

test('reachable: a doorway at the end of the Health Hall, its own banner, back to Health, and in Ask Luna', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED });
  await go(page, 'health');
  await page.click('#lab-door [data-a="labgo"]');
  assert.equal(await page.evaluate(() => S.v), 'lab');
  assert.match(await txt(page, '#main'), /Science Laboratory[\s\S]*Experiment[\s\S]*Evidence Trial[\s\S]*Evidence Vault[\s\S]*Uncertainty/);
  assert.equal(await page.getAttribute('[data-a="labtab"][data-k="exp"]', 'aria-selected'), 'true');
  assert.equal(await page.$eval('#labsc .labbg', i => i.complete && i.naturalWidth), 640, 'the laboratory scene: Luna\'s study from the owner\'s painted room');
  assert.ok(await page.$('#labluna .v6lfull.lab.cycle .v6lfi'), 'Luna from the owner\'s sheet is in the laboratory, cycling her poses');
  // she is the larger sheet (120 x 180, cut from the reference sheet), and fills most of the scene's height
  const big = await page.evaluate(() => { const f = document.querySelector('#labluna .v6lfull').getBoundingClientRect(), s = document.querySelector('#labsc').getBoundingClientRect(), i = document.querySelector('#labluna .v6lfi');
    return { f: f.height, s: s.height, w: f.width, img: getComputedStyle(i).backgroundImage, size: getComputedStyle(i).backgroundSize }; });
  assert.match(big.img, /luna-lab\.webp/);
  assert.ok(big.f >= 180 && big.f >= 0.6 * big.s, 'Luna is large: ' + big.f + ' of the scene\'s ' + big.s + ' px');
  const nav = await page.evaluate(() => [...document.querySelectorAll('#nav button')].map(b => b.dataset.v));
  assert.deepEqual(nav, ['home', 'health', 'quests', 'kingdom', 'set'], 'navigation order unchanged');
  await page.evaluate(() => HWLuna.open('laboratory'));
  assert.match(await txt(page, '#v6lres'), /Science Laboratory/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('experiment on my own workouts: prediction, plan, results with every observation, a report that never claims proof; saved and reopened', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED });
  await go(page, 'lab');
  await page.click('[data-a="labt"][data-t="stairs"]');
  assert.ok(await page.$eval('[data-a="labnext"]', b => b.disabled), 'a prediction comes first');
  await page.click('[data-a="labpred"][data-p="up"]');
  await page.click('[data-a="labnext"]');
  const plan = await txt(page, '.labsec');
  assert.match(plan, /Changes \(independent variable\)[\s\S]*Measured \(dependent variable\)[\s\S]*Keep these the same[\s\S]*Optional and at your own pace[\s\S]*stop at once/);
  await page.uncheck('[data-in="labctrl"][data-i="0"]');
  await page.click('[data-a="labnext"]');
  const res = await txt(page, '.labsec');
  assert.match(res, /Mild 22 BPM n = 3 · 20 to 24[\s\S]*Moderate 30 BPM n = 1[\s\S]*Vigorous 42 BPM n = 3 · 40 to 44/);
  // vigorous − mild = 42 − 22 = 20 BPM, in the predicted direction
  assert.match(res, /"Vigorous" is 20 BPM higher than in "Mild"\. Your observations lean towards your prediction\. This is not proof: 7 observations from one person/);
  await page.click('.labtbl summary');
  assert.match(await txt(page, '.labtbl'), /Every observation \(7\)[\s\S]*ENTERED BY YOU/);
  assert.doesNotMatch(res, /proven|proves|significan/i);
  await page.click('[data-a="labnext"]');
  const rep = await txt(page, '#labrep');
  assert.match(rep, /QUESTION[\s\S]*PREDICTION Steeper stairs give a bigger rise[\s\S]*METHOD[\s\S]*OBSERVATIONS 7 observations[\s\S]*RESULTS[\s\S]*LIMITATIONS Not kept the same: Same pace each time[\s\S]*CONCLUSION/);
  await page.click('[data-a="labsave"]');
  const s = await state(page), ex = Object.values(s.lab.ex);
  assert.equal(ex.length, 1);
  assert.deepEqual([ex[0].t, ex[0].pred, ex[0].ctrl], ['stairs', 'up', [0, 1, 1, 1]]);
  assert.deepEqual(s.e, SIX, 'entries are read, never changed');
  await page.click('[data-a="labnew"]');
  await page.click('[data-a="labopen"]');
  assert.match(await txt(page, '.labsec'), /OBSERVATIONS AND RESULTS[\s\S]*Vigorous 42 BPM/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('too few observations: "not enough evidence yet"; the Group 14 sample is labelled as other students\' data', async () => {
  const { page, ctx, errors } = await openApp({ seed: { ...SEED, e: SIX.slice(0, 2) } });
  await go(page, 'lab');
  await page.click('[data-a="labt"][data-t="stairs"]'); await page.click('[data-a="labpred"][data-p="up"]');
  await page.click('[data-a="labnext"]'); await page.click('[data-a="labnext"]');
  assert.match(await txt(page, '.labverdict'), /Not enough evidence yet\. Mild: 2 · Moderate: 0 · Vigorous: 0\. HealthWiz compares groups only when each has at least 3 observations \(a rule of thumb, not a statistical test\)/);
  await page.click('[data-a="labsample"][data-v="1"]');
  const t = await txt(page, '.labsec');
  assert.match(t, /SAMPLE Group 14 study: 6 students, 3 climbs each[\s\S]*not yours/);
  assert.match(t, /n = 6[\s\S]*n = 6[\s\S]*n = 6/);
  assert.match(t, /This is not proof: 18 observations from six other students/);
  await page.click('.labtbl summary');
  assert.match(await txt(page, '.labtbl'), /SAMPLE: GROUP 14 \(MEASURED\)/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Evidence Trial: one question at a time, hint, wrong answers cost nothing, the data after answering, XP once for reasoning', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED });
  await go(page, 'lab'); await page.click('[data-a="labtab"][data-k="trial"]');
  assert.match(await txt(page, '.trial'), /Question 1 of 7 REAL DATA: GROUP 14 STUDY/);
  await page.click('[data-a="trhint"]');
  assert.match(await txt(page, '.trhint'), /Compare each student/);
  const xp0 = (await state(page)).xp;
  await page.click('[data-a="trpick"][data-k="1"]');
  assert.match(await txt(page, '.trfb'), /Not quite/);
  assert.equal((await state(page)).xp, xp0, 'a wrong answer costs nothing');
  await page.click('[data-a="trretry"]');
  await page.click('[data-a="trpick"][data-k="0"]');
  assert.match(await txt(page, '.trial'), /Well reasoned[\s\S]*Table 7[\s\S]*THE DATA[\s\S]*P1/);
  const s = await state(page);
  assert.equal(s.xp, xp0 + 5); assert.equal(s.lab.tr.steep.ok, 1);
  await page.click('[data-a="trgo"][data-i="0"]').catch(() => {});
  // the report-checking question: the right answer is worked out from Table 9 (5 of 6)
  await page.evaluate(() => { HWTrial.Z().i = 5; render(); });
  assert.match(await txt(page, '#trq'), /vigorous climb gave the highest energy release for every student/);
  await page.click('[data-a="trpick"][data-k="1"]');
  assert.match(await txt(page, '.trfb'), /Well reasoned[\s\S]*P2 moderate/);
  // your own data: 3 mild and 3 vigorous workouts are enough to compare, and the averages lean that way
  await page.evaluate(() => { HWTrial.Z().i = 6; HWTrial.Z().pick = null; render(); });
  assert.match(await txt(page, '.trial'), /YOUR DATA/);
  await page.click('[data-a="trpick"][data-k="1"]');
  assert.match(await txt(page, '.trfb'), /Well reasoned/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Evidence Vault: every source on a shelf, every cited id a real record; a book opens the four-step chain and leads to the page and back', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED });
  await go(page, 'lab'); await page.click('[data-a="labtab"][data-k="vault"]');
  const r = await page.evaluate(() => ({ ids: HWSources.ids(), books: [...document.querySelectorAll('.vbk')].map(b => b.dataset.id), cited: [...new Set(HWVault.CALCS.flatMap(c => c.src))] }));
  assert.deepEqual([...r.books].sort(), [...r.ids].sort(), 'every source is on a shelf');
  for (const id of r.cited) assert.ok(r.ids.includes(id), id);
  await page.click('.vbk[data-id="mifflin"]');
  const t = await txt(page, '#vch');
  assert.match(t, /1 THE SOURCE[\s\S]*A new predictive equation[\s\S]*2 WHAT THE SOURCE SUPPORTS[\s\S]*3 HOW HEALTHWIZ USES IT HEALTHWIZ'S OWN WORK[\s\S]*Daily energy goal[\s\S]*Stair workout energy[\s\S]*4 HOW IT WAS CHECKED[\s\S]*PubMed 2305711/);
  await page.fill('#vq', 'oxygen');
  assert.ok(await page.$('.vbk[data-id="weir"]') && !(await page.$('.vbk[data-id="cdcbmi"]')), 'search filters the shelves');
  await page.fill('#vq', '');
  await page.click('.vbk[data-id="cdcbmi"]');
  await page.click('#vch [data-a="vgo"][data-v="body"]');
  assert.equal(await page.evaluate(() => S.v), 'body');
  await page.click('.vret');
  assert.deepEqual(await page.evaluate(() => [S.v, HWLab.Z().tab]), ['lab', 'vault']);
  assert.ok(await page.$('#vch'), 'the open book is kept');
  assert.deepEqual(errors, []); await ctx.close();
});

test('Uncertainty Engine: original kept, assumptions move the result, the spread is not called a confidence interval; BMR sensitivity', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED });
  await go(page, 'lab'); await page.click('[data-a="labtab"][data-k="unc"]');
  // default P2 vigorous: report Table 9 = 85.1 kJ; RER 1.0 → 21.1 kJ/L: 1.41209 × 3 × 21.1 = 89.4 kJ
  let t = await txt(page, '#unc-proj');
  assert.match(t, /Original 85\.1 kJ[\s\S]*With your choices 85\.1 kJ/);
  assert.match(t, /it is not a confidence interval/);
  await page.$eval('[data-in="ucrer"]', i => { i.value = '1'; i.dispatchEvent(new Event('change', { bubbles: true })); });
  t = await txt(page, '#unc-proj');
  assert.match(t, /RER 1\.00 → 21\.1 kJ\/L[\s\S]*Original 85\.1 kJ[\s\S]*With your choices 89\.4 kJ/);
  // P3 mild: 67.8 after, 79 rest → not valid, no number
  await page.click('[data-a="ucset"][data-f="p"][data-v="2"]'); await page.click('[data-a="ucset"][data-f="i"][data-v="0"]');
  assert.match(await txt(page, '#unc-proj'), /method is not valid, so no energy is shown/);
  await page.click('[data-a="ucset"][data-f="k"][data-v="bmr"]');
  const b0 = await txt(page, '#unc-bmr');
  await page.click('[data-a="ucstep"][data-f="dw"][data-v="1"]');
  const b1 = await txt(page, '#unc-bmr');
  const val = s => s.match(/With your choices ([\d,]+) kcal/)[1].replace(/,/g, '');
  assert.equal(+val(b1) - +val(b0), 10, '+1 kg → +10 kcal');
  assert.match(b1, /Why no ± range\?/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('phone 360 px: every section fits without sideways scrolling; reduced motion keeps the scene still', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED, viewport: { width: 360, height: 760 }, context: { isMobile: true, hasTouch: true, reducedMotion: 'reduce' } });
  await go(page, 'lab');
  for (const k of ['exp', 'trial', 'vault', 'unc']) {
    await page.click(`[data-a="labtab"][data-k="${k}"]`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), k + ' fits');
  }
  const anim = await page.evaluate(() => [...document.querySelectorAll('#labsc .labglow, #labsc .v6lfull')].map(e => getComputedStyle(e).animationName));
  assert.ok(anim.length === 2 && anim.every(a => a === 'none'), 'nothing moves with reduced motion: ' + anim);
  assert.deepEqual(errors, []); await ctx.close();
});
