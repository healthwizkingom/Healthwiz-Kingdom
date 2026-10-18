// Stage 2 foundations (master prompt: universal "?" explanation, source records): js/v6-sources.js and the calculations wired to it.
// Every worked example below is checked by hand in the comments, with units.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, RETURNING } from './helpers.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADULT = { ...RETURNING, p: { ...RETURNING.p, w: 70, h: 172, age: 30, sex: 'm', act: 1.55, cfm: 1 } };
const open = async (page, key) => { await page.click(`.hwh[data-hwh="${key}"]`); await page.waitForSelector('#hwh-pop:not([hidden])'); return (await page.textContent('#hwh-pop')).replace(/\s+/g, ' '); };

test('source records: complete, direct https links, no Wikipedia, and every cited id exists', async () => {
  const { page, ctx, errors } = await openApp();
  const all = await page.evaluate(() => HWSources.all());
  assert.ok(all.length >= 20, 'records: ' + all.length);
  for (const r of all) {
    for (const k of ['t', 'by', 'in', 'd', 'k', 's', 'c']) assert.ok(r[k], r.id + ' has ' + k);
    if (r.k === 'project') assert.equal(r.u, '', r.id + ': the team report is not online, so no link is made up');
    else assert.match(r.u, /^https:\/\//, r.id + ' link');
    assert.doesNotMatch(r.u + r.t + r.in, /wikipedia/i, r.id);
    assert.ok(['method', 'reference', 'guideline', 'constant', 'data', 'project'].includes(r.k), r.id + ' kind');
  }
  // ids cited anywhere in the code: src:[…] in explanations and […].map(HWSources.cite) lists
  const ids = new Set(all.map(r => r.id)), used = new Set();
  for (const f of fs.readdirSync(path.join(root, 'js'))) {
    const t = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    for (const m of t.matchAll(/src:\[([^\]]*)\]|\[([^\]]*)\]\.map\(HWSources\.cite\)/g)) for (const id of (m[1] || m[2]).match(/'([a-z0-9]+)'/g) || []) used.add(id.slice(1, -1));
  }
  assert.ok(used.size >= 15, 'cited ids: ' + [...used]);
  for (const id of used) assert.ok(ids.has(id), 'cited but not a record: ' + id);
  assert.deepEqual(errors, []); await ctx.close();
});

test('BMI "?": typed inputs, the formula the page runs, the worked example and the same result as the page', async () => {
  const { page, ctx, errors } = await openApp({ seed: ADULT });
  await go(page, 'body');
  const shown = (await page.textContent('#bout .big')).trim().split(/\s/)[0];
  const t = await open(page, 'xbmi');
  // 172 cm = 1.72 m; 1.72² = 2.9584 m²; 70 ÷ 2.9584 = 23.661 → 23.7 kg/m²
  assert.equal(shown, '23.7');
  assert.match(t, /Height 172 cm ENTERED BY YOU[\s\S]*Weight 70 kg ENTERED BY YOU/);
  assert.match(t, /BMI = weight ÷ \(height in metres\)²/);
  assert.match(t, /172 ÷ 100 = 1\.72 m[\s\S]*1\.72 × 1\.72 = 2\.9584 m²[\s\S]*70 ÷ 2\.9584 = 23\.661[\s\S]*Result: 23\.7 kg\/m²/);
  assert.match(t, /Adult BMI Categories[\s\S]*Appropriate body-mass index for Asian populations/);
  assert.match(t, /CDC uses 20 and older/, 'the app\'s own choice is told apart from the source');
  const links = await page.$$eval('#hwh-pop .hwsrc a', a => a.map(x => [x.href, x.target, x.rel]));
  assert.ok(links.length === 2 && links.every(l => /^https:/.test(l[0]) && l[1] === '_blank' && /noopener/.test(l[2])), JSON.stringify(links));
  assert.deepEqual(errors, []); await ctx.close();
});

test('daily energy, macronutrient and water "?": Mifflin-St Jeor step by step, results equal the page', async () => {
  const { page, ctx, errors } = await openApp({ seed: ADULT });
  await go(page, 'body');
  const e = await open(page, 'xenergy');
  // BMR = 10 × 70 + 6.25 × 172 − 5 × 30 + 5 = 700 + 1075 − 150 + 5 = 1630 kcal/day; TDEE = 1630 × 1.55 = 2526.5 → 2530 kcal/day
  assert.match(e, /BMR: 10 × 70 \+ 6\.25 × 172 − 5 × 30 \+ 5 = 1,630 kcal a day[\s\S]*TDEE: 1,630 × 1\.55 \(Moderately active\) = 2,526\.5[\s\S]*maintain = TDEE[\s\S]*Result: 2530 kcal a day/);
  assert.match(e, /A new predictive equation for resting energy expenditure/);
  assert.match(e, /activity factors[\s\S]*no verified source[\s\S]*FAO\/WHO\/UNU/);
  assert.match(await page.textContent('#eout'), /2530/);
  await page.keyboard.press('Escape');
  const m = await open(page, 'xmacro');
  // protein = min(0.8 × 70 = 56, 0.35 × 2530 ÷ 4 = 221.4) = 56 g; fat = 2530 × 0.30 ÷ 9 = 84.3 → 84 g; carbs = (2530 − 224 − 756) ÷ 4 = 387.5 → 388 g
  assert.match(m, /0\.8 × 70 = 56 g[\s\S]*→ 56 g[\s\S]*2530 × 0\.30 ÷ 9 = 84\.3 → 84 g[\s\S]*= 387\.5 → 388 g/);
  assert.match(m, /still to be checked/, 'the unverified table values are said to be unverified');
  await page.keyboard.press('Escape');
  const w = await open(page, 'xwater');
  // 70 × 35 + 0 = 2450 mL (moderately active: no extra), within 1500–3500
  assert.match(w, /70 × 35 \+ 0 = 2,450 mL[\s\S]*Result: 2450 mL a day[\s\S]*no single verified source/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('stair workout "?": both methods worked out with the typed numbers; the estimate matches', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'pulse');
  await page.fill('#wk-b', '72'); await page.click('[data-a="pace"][data-i="2"]'); await page.fill('#wk-a', '130'); await page.fill('#wk-d', '8');
  await page.waitForTimeout(300);
  await page.click('#wk-kcal .hwh'); await page.waitForSelector('#hwh-pop:not([hidden])');
  const t = (await page.textContent('#hwh-pop')).replace(/\s+/g, ' ');
  // RETURNING: 60 kg, 165 cm, 16 y, male. BMR = 600 + 1031.25 − 80 + 5 = 1556.25 kcal/day
  // A = 9.3 × 1556.25 ÷ 1440 × 8 = 80.41 kcal; B = (−55.0969 + 0.6309 × 130 + 0.1988 × 60 + 0.2017 × 16) = 42.075 kJ/min ÷ 4.184 × 8 = 80.45 kcal; mean 80.43 → 80
  assert.match(t, /BMR \(Mifflin-St Jeor\): 10 × 60 \+ 6\.25 × 165 − 5 × 16 \+ 5 = 1,556\.3 kcal a day/);
  assert.match(t, /A · MET method: 9\.3 MET \(Vigorous pace\)[\s\S]*= 80\.4 kcal/);
  assert.match(t, /B · heart-rate method: −55\.0969 \+ 0\.6309 × 130 \+ 0\.1988 × 60 \+ 0\.2017 × 16 = 42\.08 kJ\/min; ÷ 4\.184 × 8 min = 80\.4 kcal/);
  assert.match(t, /≈ 80[\s\S]*Estimate = mean of A and B = 80 kcal/);
  assert.match(t, /2024 Adult Compendium: Walking[\s\S]*Prediction of energy expenditure from heart rate/);
  // our project's method: VO₂ = 15.3 × 130 ÷ 72 = 27.625 mL/kg/min; × 60 ÷ 1000 = 1.6575 → 1.657 L/min; × 8 × 20.1 = 266.5 kJ; ÷ 4.184 = 63.7 kcal
  assert.match(t, /VO₂ = 15\.3 × 130 ÷ 72 = 27\.63 mL\/kg\/min[\s\S]*1\.657 L\/min[\s\S]*266\.5 kJ[\s\S]*63\.7 kcal/);
  assert.match(t, /well-trained men with a true maximal heart rate/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('run "?": 2024 Compendium points either side of the speed, kcal = MET × kg × h', async () => {
  const run = { id: 'r1', start: new Date(Date.now() - 3600e3).toISOString(), end: new Date(Date.now() - 1800e3).toISOString(), dist: 5000, dur: 1800, pace: 360, route: [], up: 0 };
  const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, p: { ...RETURNING.p, w: 60, cfm: 1 } }, before: p => p.addInitScript(r => localStorage.setItem('healthwiz_runs', JSON.stringify({ ok: 1, runs: [r], del: [] })), run) });
  await go(page, 'exercise');
  const t = await open(page, 'xrun-r1');
  // 5 km in 0.5 h = 10 km/h, between 9.7 km/h (9.3, 12050) and 10.8 km/h (10.5, 12060): 9.3 + 1.2 × 0.3 ÷ 1.1 = 9.63 MET; 9.63 × 60 × 0.5 = 288.8 → shown with MET rounded to 9.6: 288
  assert.match(t, /5 km ÷ 0\.5 h = 10 km\/h \(running table\)/);
  assert.match(t, /Between 9\.7 km\/h = 9\.3 MET \(code 12050\) and 10\.8 km\/h = 10\.5 MET \(code 12060\)[\s\S]*= 9\.6 MET/);
  assert.match(t, /kcal = 9\.6 × 60 kg × 0\.5 h = 288, rounded[\s\S]*Result: 288 kcal/);
  assert.match(t, /Distance 5 km MEASURED BY A DEVICE/);
  assert.doesNotMatch(await page.textContent('#main'), /±\s?\d+–?\d*%/, 'no error margin without a source');
  assert.deepEqual(errors, []); await ctx.close();
});
