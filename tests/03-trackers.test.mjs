import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);

test('pulse: 15 s count converts to BPM; direct BPM; validation; resting warning', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'pulse');
  await page.fill('#pbc', '18');
  await page.click('[data-a="psave"]');
  let st = await state(page);
  assert.equal(st.e[0].v, 72);
  assert.equal(st.e[0].m.st, 'Resting');
  assert.equal(st.e[0].m.src, 'timer');

  await page.fill('#pbpm', '300');
  await page.click('[data-a="pst"][data-s="After stairs"]');
  assert.equal(await page.inputValue('#pbpm'), '300', 'chip tap keeps typed value');
  await page.click('[data-a="psave"]');
  assert.equal((await state(page)).e.length, 1, 'out-of-range BPM rejected');

  await page.click('[data-a="pst"][data-s="Resting"]');
  await page.fill('#pbpm', '110');
  await page.click('[data-a="psave"]');
  st = await state(page);
  assert.equal(st.e.length, 2);
  assert.ok(await page.$('#main .warn'), 'resting >100 shows non-diagnostic note');

  // timer starts and cancels cleanly; leaving the page stops it
  await page.click('[data-a="ptm"]');
  assert.match(await page.textContent('#ptc'), /1[45] s/);
  await go(page, 'home');
  assert.equal(await page.evaluate(() => window.HW.S.pt), null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('stairs: session saves steps×climbs; pacing beat counts and fills climbs', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'stair');
  await page.selectOption('#sloc', '1');
  await page.fill('#sst', '14');
  await page.fill('#scl', '3');
  await page.click('[data-a="ssave"]');
  let st = await state(page);
  assert.equal(st.e[0].v, 42);
  assert.deepEqual(st.e[0].m, { loc: 'School / college block', climbs: 3, steps: 14 });

  await page.click('[data-a="spc"][data-i="2"]'); // brisk 100/min = 600 ms
  await page.click('[data-a="sbeat"]');
  await page.waitForFunction(() => window.HW.S.pb.k >= 3, null, { timeout: 5000 });
  await page.click('[data-a="sbeat"]');
  assert.equal(await page.evaluate(() => window.HW.S.pb.on), 0);
  assert.equal(await page.inputValue('#scl'), '1');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('stress: check-in with feeling, forest weather changes, calm game records after-level', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'stress');
  await page.fill('#slv', '8');
  await page.dispatchEvent('#slv', 'input');
  assert.equal(await page.textContent('#slvc'), 'HIGH');
  assert.ok(await page.$('#qcsc .qd'), 'rain in a stormy forest');
  await page.click('[data-a="sfeel"][data-f="Worried"]');
  await page.click('[data-a="ssv"]');
  let st = await state(page);
  assert.equal(st.e[0].c, 'stress');
  assert.equal(st.e[0].v, 8);
  assert.equal(st.e[0].m.feel, 'Worried');

  await page.click('[data-a="sact"][data-g="w"]');
  for (let i = 0; i < 6; i++) await page.click(`[data-a="wisp"][data-i="${i}"]`, { force: true });
  await page.fill('#send', '5');
  await page.dispatchEvent('#send', 'input');
  await page.click('[data-a="sdone"]');
  st = await state(page);
  assert.equal(st.e[0].m.end, 5);
  assert.equal(st.e[0].m.act, 'w');
  assert.match(await page.textContent('#main'), /Worried → 5\/10/);

  await page.click('[data-a="sact"][data-g="b"]');
  for (let i = 0; i < 3; i++) await page.click('[data-a="brth"]');
  assert.match(await page.textContent('#calm'), /QUIET/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('wizard counsel: offline reflection, crisis help box, cleared on leave', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'stress');
  await page.fill('#csx', 'I am so worried about my exam tomorrow');
  await page.click('[data-a="csend"]');
  const log = await page.textContent('#cslog');
  assert.match(log, /YOU/);
  assert.match(log, /Exams and schoolwork/);
  assert.equal(await page.$('.cshelp'), null);

  await page.fill('#csx', 'sometimes I want to die');
  await page.click('[data-a="csend"]');
  assert.match(await page.textContent('.cshelp'), /03-7627 2929/);
  assert.match(await page.textContent('.cshelp'), /999/);

  await go(page, 'home');
  await go(page, 'stress');
  assert.equal(await page.$('.cshelp'), null);
  assert.equal((await page.$$('#cslog .csm.u')).length, 0, 'chat not persisted');
  assert.equal(JSON.stringify(await state(page) || {}).includes('exam'), false, 'chat never written to storage');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('bmi: profile saves, BMI entry recorded, under-18 note vs adult category', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'bmi');
  await page.fill('#bw', '70');
  await page.fill('#bh', '175');
  await page.fill('#ba', '16');
  await page.click('[data-a="bsave"]');
  let st = await state(page);
  assert.equal(st.p.w, 70);
  assert.equal(st.e[0].c, 'bmi');
  assert.equal(st.e[0].v, 22.9);
  assert.match(await page.textContent('#main'), /BMI-for-age/);
  await page.fill('#ba', '30');
  await page.click('[data-a="bsave"]');
  assert.match(await page.textContent('#main'), /Healthy weight range/);
  await page.fill('#bw', '5');
  await page.click('[data-a="bsave"]');
  assert.equal((await state(page)).p.w, 70, 'invalid weight rejected');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('goal forge: Mifflin-St Jeor targets, no deficit under 18, applies targets and unlocks shrine', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'calc');
  await page.fill('#gw', '70'); await page.fill('#gh', '175'); await page.fill('#ga', '30');
  await page.selectOption('#gs', 'm'); await page.selectOption('#gact', '1.55');
  await page.click('[data-a="ggoal"][data-g="l"]');
  await page.click('[data-a="gcalc"]');
  // BMR = 10*70 + 6.25*175 - 5*30 + 5 = 1648.75 → 1649; TDEE = 1649*1.55 = 2556; target = 2156 → 2150
  const txt = await page.textContent('#main');
  assert.match(txt, /BMR1649/);
  assert.match(txt, /Daily burn2556/);
  assert.match(txt, /Calorie target2150/);
  await page.click('[data-a="guse"]');
  let st = await state(page);
  assert.equal(st.s.kcal, 2150);
  assert.equal(st.s.water, 2450);
  assert.equal(st.s.set, 1);

  await page.fill('#ga', '15');
  await page.click('[data-a="gcalc"]');
  assert.match(await page.textContent('#main'), /never suggests a calorie deficit/);
  await go(page, 'home');
  assert.ok(await page.$('.kn.k1[data-v="bmi"]'), 'Balance Shrine unlocked by setting targets');
  assert.deepEqual(errors, []);
  await ctx.close();
});
