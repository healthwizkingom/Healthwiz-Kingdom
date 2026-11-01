// Heart-Rate Response Index (js/v6-effort.js response / responseHtml): peak ÷ pulse before, a plain ratio. Worked examples for the maths and
// every unavailable case, then the workout card: the line, its "?" panel and Vault link, and wording that makes no vascular or fitness claim.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, stairHistory, RETURNING } from './helpers.mjs';

after(closeBrowser);
const boot = async o => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'pulse'); await stairHistory(r.page); return r; };
const ADULT = { ...RETURNING, p: { ...RETURNING.p, age: 30, cfm: 1 } };
const NOAGE = { ...RETURNING, s: { ...RETURNING.s, onb: 0 }, p: { ...RETURNING.p, cfm: 0 } };
const txt = (page, sel) => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());

test('response(): the ratio, its rounding, and every unavailable case (worked examples)', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const R = HWEffort.response, v = x => x && (x.ok ? [x.ratio, Math.round(x.exact * 1000) / 1000] : [false, x.why]);
    return { main: v(R(168, 72)), two: v(R(150, 75)), one: v(R(72, 72)), edge: v(R(90, 40)), text: v(R('168', '72')), lo: v(R(71, 72)),
      noB: v(R(168, null)), noP: v(R(null, 72)), none: [R(null, null), R('', ''), R(undefined, undefined)], oor: [v(R(29, 72)), v(R(168, 221)), v(R(168, 'abc')), v(R(NaN, 72))],
      rng: [v(R(30, 30)), v(R(220, 30))], tipo: R(168, 72) && typeof R(168, 72).ratio }; });
  assert.deepEqual(r.main, [2.3, 2.333]);                 // 168 ÷ 72 = 2.333 → 2.3
  assert.deepEqual(r.two, [2, 2]); assert.deepEqual(r.one, [1, 1]);
  assert.deepEqual(r.edge, [2.3, 2.25]);                  // 90 ÷ 40 = 2.25 rounds half up to 2.3
  assert.deepEqual(r.text, [2.3, 2.333], 'numeric text works like a number');
  assert.deepEqual(r.lo, [false, 'The peak (71 BPM) is lower than the pulse before (72 BPM), so check the numbers.']);
  assert.deepEqual(r.noB, [false, 'Add your pulse before.']);
  assert.deepEqual(r.noP, [false, 'Add the highest pulse during the climb, or the pulse right after.']);
  assert.deepEqual(r.none, [null, null, null], 'nothing entered: no line at all');
  assert.deepEqual(r.oor[0], [false, 'Add the highest pulse during the climb, or the pulse right after.']);   // 29 is out of range, so it counts as missing
  assert.deepEqual(r.oor[1], [false, 'Add your pulse before.']); assert.deepEqual(r.oor[2], [false, 'Add your pulse before.']); assert.deepEqual(r.oor[3], [false, 'Add the highest pulse during the climb, or the pulse right after.']);
  assert.deepEqual(r.rng, [[1, 1], [7.3, 7.333]]);        // the range limits are allowed
  assert.equal(r.tipo, 'number');
  assert.deepEqual(errors, []); await ctx.close();
});

test('card: the ratio shows under the peak, updates as numbers change, and has its worked "?" with a Vault link', async () => {
  const { page, ctx, errors } = await boot({ seed: ADULT });
  assert.equal(await page.locator('#st-hri').count(), 0, 'nothing entered, no line');
  await page.fill('#wk-b', '72'); await page.fill('#wk-hi', '168');
  assert.match(await txt(page, '#st-hri'), /Heart-rate response: 2\.3 × your pulse before \(peak 168 ÷ before 72\)/);
  assert.match(await txt(page, '#st-hri'), /A plain ratio of two pulse numbers\. It does not measure vascular tone, arterial compliance or elasticity, and it is not a medical measurement\./);
  assert.match(await txt(page, '#st-band'), /Estimated effort: Vigorous/, 'the effort band is still there beside it');
  const order = await page.$eval('#st-peak', e => [e.innerHTML.indexOf('id="st-band"'), e.innerHTML.indexOf('id="st-hri"')]); assert.ok(order[0] > 0 && order[1] > order[0], 'under the effort band');
  await page.fill('#wk-b', '60'); assert.match(await txt(page, '#st-hri'), /2\.8 × your pulse before \(peak 168 ÷ before 60\)/);
  await page.fill('#wk-b', '72'); await page.click('#st-hri .hwh');
  const pop = await txt(page, '#hwh-pop');
  assert.match(pop, /How the heart-rate response is worked out/); assert.match(pop, /168 ÷ 72 = 2\.33 → 2\.3 ×/); assert.match(pop, /response = peak ÷ pulse before/);
  assert.match(pop, /Uth et al\. is context only/); assert.match(pop, /ratio alone/); assert.match(pop, /does not measure vascular tone, arterial compliance or elasticity/);
  assert.match(pop, /No range is called good or low/); assert.match(pop, /only a resting pulse if you took it at rest/);
  assert.equal(await page.getAttribute('#hwh-pop .hwev a', 'href'), '#vault=hri');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []); await ctx.close();
});

test('card: the after pulse counts as the peak when no climb pulse was entered; the larger of the two is used', async () => {
  const { page, ctx, errors } = await boot({ seed: ADULT });
  await page.fill('#wk-b', '65'); await page.fill('#wk-a', '130');
  assert.match(await txt(page, '#st-hri'), /Heart-rate response: 2\.0 × .*\(peak 130 ÷ before 65\)/);
  await page.fill('#wk-hi', '156'); assert.match(await txt(page, '#st-hri'), /2\.4 × .*\(peak 156 ÷ before 65\)/);   // 156 > 130
  await page.fill('#wk-hi', '100'); assert.match(await txt(page, '#st-hri'), /2\.0 × .*\(peak 130 ÷ before 65\)/);   // 130 > 100
  assert.deepEqual(errors, []); await ctx.close();
});

test('unavailable, never estimated: a missing number, a peak below the pulse before, no fallback to another day', async () => {
  const seed = { ...ADULT, e: [{ id: 'rest1', c: 'stair', v: 20, m: { hrB: 60, kind: 'workout', steps: 20, climbs: 1 }, n: '', d: new Date(Date.now() - 864e5).toISOString().slice(0, 10), t: '10:00' }] };
  const { page, ctx, errors } = await boot({ seed });
  await page.fill('#wk-hi', '150');
  assert.match(await txt(page, '#st-hri'), /Heart-rate response: unavailable\. Add your pulse before\./, 'a pulse before from another day is not used');
  assert.equal(await page.locator('#st-hri .hwh').count(), 0, 'no worked panel for a number that was not worked out');
  await page.fill('#wk-hi', ''); await page.fill('#wk-b', '72');
  assert.match(await txt(page, '#st-hri'), /unavailable\. Add the highest pulse during the climb, or the pulse right after\./);
  await page.fill('#wk-hi', '60'); assert.match(await txt(page, '#st-hri'), /unavailable\. The peak \(60 BPM\) is lower than the pulse before \(72 BPM\), so check the numbers\./);
  await page.fill('#wk-b', '25'); await page.fill('#wk-hi', '150');
  assert.match(await txt(page, '#st-hri'), /unavailable\. Add your pulse before\./, 'an out-of-range number counts as missing');
  assert.deepEqual(errors, []); await ctx.close();
});

test('it shows without an age (the effort band needs one, this does not)', async () => {
  const { page, ctx, errors } = await boot({ seed: NOAGE });
  await page.fill('#wk-b', '70'); await page.fill('#wk-hi', '140');
  assert.match(await txt(page, '#st-peak'), /Add your age in the profile below/); assert.equal(await page.locator('#st-band').count(), 0);
  assert.match(await txt(page, '#st-hri'), /Heart-rate response: 2\.0 × your pulse before \(peak 140 ÷ before 70\)/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('wording and storage: no VO₂, fitness or range talk on the line; nothing is saved by showing it', async () => {
  const { page, ctx, errors } = await boot({ seed: ADULT });
  const mine = async () => { const x = await state(page); return JSON.stringify({ e: x.e, s: x.s, p: x.p, xp: x.xp }); };
  const before = await mine();
  await page.fill('#wk-b', '72'); await page.fill('#wk-hi', '168');
  const t = await txt(page, '#st-hri'), main = t.replace(/It does not measure vascular tone, arterial compliance or elasticity, and it is not a medical measurement\./, '');
  assert.doesNotMatch(main, /vascular|arterial|elastic|complian|VO|fitness|healthy|good|poor|low|high|normal|score|rank/i, main);
  assert.doesNotMatch(t, /\p{Extended_Pictographic}/u);
  assert.equal(await mine(), before, 'entries, settings, profile and XP are untouched');
  assert.ok(!/hri|response index/i.test(await page.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).join('|'))), 'nothing about it is stored');
  assert.deepEqual(errors, []); await ctx.close();
});
