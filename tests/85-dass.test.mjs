// The Stress Quest's DASS-21 check-in (js/v6-dass.js, owner's request 2026-10-20):
//   * BEGIN THE QUEST asks the 21 DASS-21 statements one at a time on the DASS scale 0–3 ("over the past week"), with BACK;
//   * scores: each scale = sum of its 7 answers × 2 (0–42); storm level = 1 + round(9 × total ÷ 63). Worked by hand:
//       all answers 1 → each scale 7 × 2 = 14; total 21; level 1 + round(3) = 4
//       all answers 3 → each scale 21 × 2 = 42; total 63; level 1 + 9 = 10
//       answers 0 except the 7 Stress statements at 2 → Stress 14 × 2 = 28, Depression 0, Anxiety 0; total 14; level 1 + round(2) = 3,
//       and the Stress creatures (Rusher, Perfectionist) come first
//   * no severity labels are shown, the help numbers are, and it says it is not a diagnosis;
//   * the calming activities (js/v6-relief.js) follow unchanged, and the saved check-in keeps the answers in m.dass;
//   * the Evidence Vault has the DASS calculation and its three sources.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);
const begin = async () => { const r = await openApp(); await go(r.page, 'stress'); await r.page.click('[data-a="sqs"]'); return r; };
const answer = async (page, vals) => { for (const v of vals) await page.click('[data-a="dsa"][data-v="' + v + '"]'); };
const sq = page => page.evaluate(() => ({ ph: S.sq.ph, r: S.sq.r, dass: S.sq.dass, all: S.sq.all }));

test('21 statements on the DASS scale, one at a time, with BACK; scores and storm level match the hand-worked examples', async () => {
  const { page, errors } = await begin();
  assert.match(await page.textContent('.dscard'), /Statement 1 of 21[\s\S]*over the past week[\s\S]*I found it hard to wind down/);
  assert.equal(await page.$$eval('[data-a="dsa"]', b => b.length), 4, 'the four DASS answers');
  assert.match(await page.textContent('.dsopts'), /Did not apply to me at all[\s\S]*Applied to me very much, or most of the time/);
  await answer(page, [2]);
  assert.match(await page.textContent('.dsstep'), /Statement 2 of 21/);
  await page.click('[data-a="dsb"]');
  assert.match(await page.textContent('.dsstep'), /Statement 1 of 21/, 'BACK returns to the previous statement');
  assert.equal(await page.getAttribute('[data-a="dsa"][data-v="2"]', 'aria-pressed'), 'true', 'and keeps its answer');
  await answer(page, Array(21).fill(1));
  let r = await sq(page);
  assert.deepEqual([r.ph, r.dass.d, r.dass.a, r.dass.s, r.dass.t, r.r], ['res', 14, 14, 14, 21, 4]);
  const txt = await page.textContent('.dscard');
  assert.match(txt, /Depression\s*14\s*of 42[\s\S]*Anxiety\s*14\s*of 42[\s\S]*Stress\s*14\s*of 42/);
  assert.match(txt, /not a diagnosis/);
  assert.doesNotMatch(txt, /\b(Normal|Mild|Moderate|Severe|Extremely severe)\b/, 'no severity labels');
  assert.match(txt, /999[\s\S]*03-7627 2929[\s\S]*15999/, 'the help numbers are shown with the result');
  assert.match(await page.textContent('.qmn'), /4\/10/, 'the storm follows the total');
  assert.deepEqual(errors, []);
});

test('the extremes and a stress-only pattern; the highest scale picks the first creatures', async () => {
  let { page } = await begin();
  await answer(page, Array(21).fill(3));
  let r = await sq(page);
  assert.deepEqual([r.dass.d, r.dass.a, r.dass.s, r.dass.t, r.r], [42, 42, 42, 63, 10]);
  ({ page } = await begin());
  const STRESS = [0, 5, 7, 10, 11, 13, 17]; // the Stress statements (0-based) in the DASS-21 order
  await answer(page, Array.from({ length: 21 }, (_, i) => STRESS.includes(i) ? 2 : 0));
  r = await sq(page);
  assert.deepEqual([r.dass.d, r.dass.a, r.dass.s, r.dass.t, r.r], [0, 0, 28, 14, 3]);
  assert.deepEqual(r.all.slice(0, 2), ['rusher', 'perfectionist']);
});

test('the calming activities follow, and the saved check-in keeps the DASS answers; nothing is saved before FINISH', async () => {
  const { page, errors } = await begin();
  await answer(page, Array(21).fill(1));
  assert.equal((await state(page)).e.filter(e => e.c === 'stress').length, 0, 'nothing saved yet');
  await page.click('[data-a="sqe"]');
  assert.equal(await page.evaluate(() => S.sq.ph), 'enc');
  assert.ok(await page.$('.rxcards, [data-a="rxo"], .rxcard'), 'the activity collection (js/v6-relief.js)');
  await page.click('[data-a="sqfin"]');
  const e = (await state(page)).e.filter(x => x.c === 'stress').pop();
  assert.equal(e.v, 4, 'the value is the storm level, as the quest saved before (1–10)');
  assert.match(e.m.feel, /DASS-21: Depression 14, Anxiety 14, Stress 14/);
  assert.deepEqual([e.m.dass.d, e.m.dass.a, e.m.dass.s, e.m.dass.t, e.m.dass.i.length], [14, 14, 14, 21, 21]);
  assert.deepEqual(errors, []);
});

test('the Evidence Vault has the DASS calculation and its three sources', async () => {
  const { page } = await openApp();
  const v = await page.evaluate(() => { const c = HWVault.CALCS.find(x => x.id === 'dass'); return { c, ok: c ? c.src.map(id => !!HWSources.get(id)) : [] }; });
  assert.ok(v.c, 'a dass calculation card');
  assert.deepEqual(v.c.src, ['dassfaq', 'lovibond95', 'henry05']);
  assert.ok(v.ok.every(Boolean), 'every source exists');
});
