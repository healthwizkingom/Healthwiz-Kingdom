// The Group 14 F21 study data (js/v6-f21.js): only raw counts are stored; every table the report publishes is recomputed here and
// compared with the printed values (report of 2026-10-10: Tables 3, 7, 8, 9, 11 and the statements in Sections 4.2–4.4).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go } from './helpers.mjs';

after(closeBrowser);
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;
// printed in the report, participants in Table 7 order (P1–P6), intensities mild / moderate / vigorous
const T7 = { // average pulse beat, PR (BPM), f (Hz), T (s), ω (rad/s)
  P1: [[280.0, 93.3, 1.56, 0.64, 9.77], [290.0, 96.7, 1.61, 0.62, 10.12], [297.7, 99.2, 1.65, 0.60, 10.39]],
  P2: [[245.3, 81.8, 1.36, 0.73, 8.56], [315.0, 105.0, 1.75, 0.57, 11.00], [337.3, 112.4, 1.87, 0.53, 11.78]],
  P3: [[203.3, 67.8, 1.13, 0.89, 7.10], [226.0, 75.3, 1.26, 0.80, 7.89], [247.0, 82.3, 1.37, 0.73, 8.62]],
  P4: [[184.0, 61.3, 1.02, 0.98, 6.42], [199.3, 66.4, 1.11, 0.90, 6.96], [221.0, 73.7, 1.23, 0.81, 7.71]],
  P5: [[269.0, 89.7, 1.49, 0.67, 9.39], [288.7, 96.2, 1.60, 0.62, 10.08], [306.7, 102.2, 1.70, 0.59, 10.70]],
  P6: [[187.0, 62.3, 1.04, 0.96, 6.53], [202.0, 67.3, 1.12, 0.89, 7.05], [223.7, 74.6, 1.24, 0.80, 7.81]] };
const T9 = { // PRrest, ratio, VO₂ (mL/kg/min), VO₂ (L/min), kJ, kcal, valid
  P1: [[71, 1.31, 20.1, 0.81, 48.9, 11.7, 1], [74, 1.31, 20.0, 0.81, 48.6, 11.6, 1], [73, 1.36, 20.8, 0.84, 50.5, 12.1, 1]],
  P2: [[75, 1.09, 16.7, 1.05, 63.6, 15.2, 1], [70, 1.50, 22.9, 1.45, 87.5, 20.9, 1], [77, 1.46, 22.3, 1.41, 85.1, 20.4, 1]],
  P3: [[79, 0.86, 13.1, 1.04, 62.5, 14.9, 0], [84, 0.90, 13.7, 1.08, 65.4, 15.6, 0], [72, 1.14, 17.5, 1.38, 83.3, 19.9, 1]],
  P4: [[72, 0.85, 13.0, 0.76, 45.6, 10.9, 0], [78, 0.85, 13.0, 0.76, 45.6, 10.9, 0], [71, 1.04, 15.9, 0.92, 55.5, 13.3, 1]],
  P5: [[72, 1.25, 19.1, 1.43, 86.2, 20.6, 1], [79, 1.22, 18.6, 1.40, 84.3, 20.1, 1], [74, 1.38, 21.1, 1.59, 95.6, 22.8, 1]],
  P6: [[70, 0.89, 13.6, 0.71, 42.7, 10.2, 0], [72, 0.94, 14.3, 0.74, 44.9, 10.7, 0], [71, 1.05, 16.1, 0.84, 50.4, 12.0, 1]] };
const T8 = { P1: [6.3, 120.0, 93.3, -26.7], P2: [37.5, 127.3, 105.3, -22.0], P3: [21.5, 78.7, 84.0, 5.3], P4: [20.1, 82.7, 65.3, -17.3], P5: [14.0, 123.3, 79.3, -44.0], P6: [19.6, 84.0, 66.0, -18.0] };
const T11 = { // PRmax = first 30 s × 2, ratio, VO₂, kJ
  P1: [[112.0, 1.58, 24.1, 58.7], [108.0, 1.46, 22.3, 54.3], [120.0, 1.64, 25.2, 61.1]], P2: [[96.7, 1.29, 19.7, 75.2], [114.0, 1.63, 24.9, 95.0], [127.3, 1.65, 25.3, 96.4]],
  P3: [[65.3, 0.83, 12.7, 60.3], [72.0, 0.86, 13.1, 62.5], [78.7, 1.09, 16.7, 79.6]], P4: [[68.0, 0.94, 14.5, 50.5], [75.3, 0.97, 14.8, 51.7], [82.7, 1.16, 17.8, 62.3]],
  P5: [[98.7, 1.37, 21.0, 94.8], [107.3, 1.36, 20.8, 94.0], [123.3, 1.67, 25.5, 115.3]], P6: [[70.0, 1.00, 15.3, 48.0], [76.7, 1.06, 16.3, 51.1], [84.0, 1.18, 18.1, 56.8]] };
const BMI = [16.6, 22.1, 27.7, 20.5, 25.1, 19.3];

test('the raw counts reproduce Tables 3, 7, 8, 9 and 11 of the report', async () => {
  const { page, ctx, errors } = await openApp();
  const D = await page.evaluate(() => HWF21.P.map((x, p) => ({ id: x.id, bmi: HWF21.bmi(p), rows: [0, 1, 2].map(i => {
    const s = HWF21.shm(p, i), v = HWF21.vo2(p, i), f = HWF21.vo2(p, i, 'first');
    return { tot: HWF21.totals(p, i), avg: HWF21.avgBeat(p, i), pr: HWF21.pr(p, i), f: s.f, T: s.T, w: s.w, v, first: f, i1: HWF21.interval(p, i, 0), i6: HWF21.interval(p, i, 5) }; }) })));
  assert.equal(D.length, 6);
  D.forEach((x, p) => {
    assert.equal(r1(x.bmi), BMI[p], x.id + ' BMI');
    x.rows.forEach((r, i) => {
      const t7 = T7[x.id][i], t9 = T9[x.id][i], t11 = T11[x.id][i], k = x.id + ' ' + ['mild', 'moderate', 'vigorous'][i];
      assert.equal(r.tot.length, 3, k + ': three trials');
      assert.deepEqual([r1(r.avg), r1(r.pr), r2(r.f), r2(r.T), r2(r.w)], t7, k + ' Table 7');
      assert.deepEqual([r.v.rest, r2(r.v.ratio), r2(r.v.lmin), r1(r.v.kj), r1(r.v.kcal), r.v.valid ? 1 : 0], [t9[0], t9[1], t9[3], t9[4], t9[5], t9[6]], k + ' Table 9');
      // VO₂ (mL/kg/min): the one printed value that differs is P2 moderate, 15.3 × 105 ÷ 70 = 22.95 exactly, printed 22.9
      if (k === 'P2 moderate') { assert.equal(+(15.3 * 1.5).toFixed(2), 22.95); assert.ok(Math.abs(r.v.ml - t9[2]) <= 0.051, k); } else assert.equal(r1(r.v.ml), t9[2], k + ' VO₂');
      assert.deepEqual([r1(r.first.max), r2(r.first.ratio), r1(r.first.ml), r1(r.first.kj)], t11, k + ' Table 11');
    });
    const t8 = T8[x.id], m = x.rows[0].pr, v = x.rows[2];
    assert.deepEqual([r1((v.pr / m - 1) * 100), r1(v.i1), r1(v.i6), r1(v.i6 - v.i1)], t8, x.id + ' Table 8');
  });
  assert.deepEqual(errors, []); await ctx.close();
});

test('the report\'s statements, checked from the data (and the one that does not hold for everyone)', async () => {
  const { page, ctx, errors } = await openApp();
  const f = await page.evaluate(() => HWF21.facts());
  assert.equal(f.prRisesAll, true, '4.2: pulse rate rose from mild to moderate to vigorous for every participant');
  assert.deepEqual([r1(f.riseMin), r1(f.riseMax)], [6.3, 37.5], '4.2: rise ranged from 6.3% to 37.5%');
  assert.deepEqual([f.invalid, f.n], [6, 18], '4.4: 6 of 18 results have PRmax ÷ PRrest below 1');
  assert.equal(f.recovFell, 5, '4.2: the pulse fell during recovery in five of six');
  assert.equal(Math.max(...f.restSpread), 12, '4.7: resting pulse varied by up to 12 BPM within one person');
  // 4.4 says "the vigorous climb gave the highest energy release for every participant"; Table 9 shows it for 5 of 6 (P2: moderate 87.5 kJ > vigorous 85.1 kJ)
  assert.equal(f.vigorousTop, 5); assert.equal(f.kjTop[1], 'Moderate');
  assert.deepEqual(errors, []); await ctx.close();
});

test('Stairs: the project method says "not valid" when the pulse after is below the pulse before (report 4.4)', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'pulse');
  await page.fill('#wk-b', '84'); await page.fill('#wk-a', '72'); await page.fill('#wk-d', '3');
  await page.waitForTimeout(300);
  await page.click('#wk-kcal .hwh'); await page.waitForSelector('#hwh-pop:not([hidden])');
  const t = (await page.textContent('#hwh-pop')).replace(/\s+/g, ' ');
  assert.match(t, /OUR PROJECT'S METHOD NOT VALID[\s\S]*pulse after \(72 BPM\) is lower than the pulse before \(84 BPM\)[\s\S]*6 of 18 results/);
  assert.doesNotMatch(t, /VO₂ ≈/, 'no VO₂ number is shown for an invalid ratio');
  await page.keyboard.press('Escape');
  await page.fill('#wk-a', '130'); await page.waitForTimeout(300);
  await page.click('#wk-kcal .hwh'); await page.waitForFunction(() => { const p = document.getElementById('hwh-pop'); return p && !p.hidden && /VO₂ ≈/.test(p.textContent); });
  const u = (await page.textContent('#hwh-pop')).replace(/\s+/g, ' ');
  // 15.3 × 130 ÷ 84 = 23.68 → 23.7 mL/kg/min; the team report is cited (no link) and the panel says it is an estimated VO₂max
  assert.match(u, /VO₂ ≈ 23\.7 mL\/kg\/min[\s\S]*HealthWiz Kingdom: Group 14 F21 Full Written Report OUR PROJECT[\s\S]*estimated VO₂max, not the oxygen you used/);
  assert.deepEqual(errors, []); await ctx.close();
});
