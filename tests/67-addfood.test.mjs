// Add More Food (js/v6-addfood.js): the Wannabe Wizard's calorie guesser (type any food; he asks about the portion, sides
// and sauces, then guesses kcal and macros part by part: his book offline, Gemini through food-guess when signed in) and
// the search above the original custom form. The canteen menu
// (offline, signed out) and USDA FoodData Central (signed in, through food-search); food-specific measures with gram
// weights from the database; values update with the amount and show the method and the source; nothing saved before
// CONFIRM AND LOG; the original one-click custom save still works; errors; his poses and faces; the phone layout.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';
import { fakeSupabase, device, synced, signIn } from './cloud-fake.mjs';

after(closeBrowser);
const RICE = { id: 2512381, name: 'Rice, white, cooked, no added fat', type: 'Survey (FNDDS)', brand: '', unit: 'g', per100: { kcal: 130, p: 2.7, c: 28.2, f: 0.3 } };
const RICE_D = { ...RICE, portions: [{ label: '1 cup', g: 158 }, { label: '1 serving', g: 100 }], serving: null };
const PLAIN = { id: 1, name: 'Durian, raw', type: 'SR Legacy', brand: '', unit: 'g', per100: { kcal: 147, p: 1.5, c: 27.1, f: 5.3 } };
const openWizard = async page => { await go(page, 'food'); await page.click('[data-a="cf"]'); await page.waitForSelector('#awiz'); };
const fig = page => page.$eval('#awiz', w => [w.querySelector('.awfig').dataset.pose, w.querySelector('.awface').dataset.face]);
const q = page => page.evaluate(() => HWAddFood.state.cur);
const opt = async (page, label) => { const i = (await q(page)).opts.findIndex(o => o[0] === label); assert.ok(i >= 0, 'option ' + label); await page.click('[data-a="awopt"][data-i="' + i + '"]'); };
const tog = async (page, label) => { const i = (await q(page)).opts.findIndex(o => o[0] === label); assert.ok(i >= 0, 'option ' + label); await page.click('[data-a="awtog"][data-i="' + i + '"]'); };
const RICE_USDA = { k: 129, p: 2.67, c: 27.99, f: 0.28 }; // FDC 2708408 per 100 g, from js/v6-foodparts.js

test('signed out, his book: nasi lemak → how much rice, the usual sides ticked for checking, sauces; a worked guess; − and +; logged only on CLOSE ENOUGH', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await openWizard(page);
  assert.deepEqual(await fig(page), ['front', 'happy']);
  assert.match(await page.textContent('#awiz'), /What did you eat\? Tell me anything[\s\S]*Signed out: he uses his book \(USDA FoodData Central and the canteen menu\)/);
  assert.equal(await page.locator('#cn').count(), 1, 'the original form is still there, below');
  await page.fill('#awq', 'Nasi Lemak'); await page.press('#awq', 'Enter');
  // he knows nasi lemak is coconut rice, so he asks how much
  let c = await q(page);
  assert.equal(c.q, 'How much rice was there?');
  assert.match(await page.textContent('.awqn'), /QUESTION 1 · Nasi Lemak[\s\S]*One cup of coconut rice is about 200 g \(USDA\)\. A Kolej MARA Kulim canteen plate of plain rice is 200 g\./);
  assert.deepEqual(await fig(page), ['three', 'determined']);
  await opt(page, 'One cup');
  c = await q(page);
  assert.deepEqual(c.pre.sort(), ['anchovy', 'cucumber', 'eggboiled', 'peanuts'], 'the usual sides are ticked for checking');
  assert.match(await page.textContent('.awqn'), /I ticked what usually comes with it\. Untick what you did not have\./);
  for (const l of ['Ikan bilis', 'Peanuts', 'Cucumber']) await tog(page, l);
  await page.click('[data-a="awdone"]');
  assert.deepEqual((await q(page)).pre, ['sambal']);
  await tog(page, 'Sambal');
  assert.equal(await page.textContent('[data-a="awdone"]'), 'NONE OF THESE');
  await page.click('[data-a="awdone"]');
  // coconut rice 200 g: 267 × 200 ÷ 100 = 534 kcal; boiled egg 50 g: 143 × 50 ÷ 100 = 71.5 kcal; total 605.5 → 606
  assert.equal(await page.evaluate(() => HWAddFood.state.step), 'guess');
  assert.deepEqual(await fig(page), ['front', 'surprised']);
  let card = await page.textContent('#awcard');
  assert.match(card, /MY GUESS · Nasi Lemakabout 606 kcalProtein13\.3 gCarbohydrate53\.6 gFat39\.4 g/);
  assert.match(card, /Coconut rice1 × 1 cup \(200 g each\) = 200 g534 kcal[\s\S]*USDA FoodData Central, Survey \(FNDDS\), FDC ID 2709032: Rice, cooked with coconut milk/);
  assert.match(card, /Boiled egg1 × 1 egg \(50 g each\) = 50 g72 kcal[\s\S]*FDC ID 2707154/);
  assert.match(card, /This is an estimate, not a measurement: the total is the sum of the parts\. USDA part = value per 100 g × grams ÷ 100\./);
  assert.match(await page.textContent('.awsay'), /My guess: about 606 kcal! Am I close\?/);
  // one more half egg: 75 g → 107.25 kcal; total 641.25 → 641. Protein 7.14 + 12.4 × 0.75 = 16.4 g; carbohydrate 53.1 + 0.96 × 0.75 = 53.8 g; fat 34.46 + 9.96 × 0.75 = 41.9 g
  await page.click('[data-a="awadj"][data-i="1"][data-d="1"]');
  assert.match(await page.textContent('#awcard'), /about 641 kcal[\s\S]*Boiled egg1½ × 1 egg \(50 g each\) = 75 g107 kcal/);
  assert.equal((await state(page)).e.length, 0, 'nothing saved yet');
  await page.click('[data-a="awlog"]');
  const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.c, e.v, e.m.name, e.m.db, e.m.custom, e.m.src, e.m.p, e.m.c, e.m.f, e.m.g], ['food', 641, 'Nasi Lemak', 'est', 1, 'Wannabe Wizard estimate', 16.4, 53.8, 41.9, 275]);
  assert.deepEqual(e.m.parts, [['Coconut rice', 200, 534, 'usda'], ['Boiled egg', 75, 107, 'usda']]);
  assert.deepEqual(await fig(page), ['cast', 'excited']);
  assert.match(await page.textContent('#flog'), /Nasi Lemak[\s\S]*Wizard's estimate[\s\S]*EST/, 'the log says it is an estimate');
  assert.doesNotMatch(await page.textContent('#flog'), /YOURS|kcal by you/);
  assert.deepEqual(errors, []);
});

test('his book: an unknown name → what kind of food; a drink with what went in it; NOT SURE takes his default; UNDO; something else → the search', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await openWizard(page);
  await page.fill('#awq', 'my grandma\'s special'); await page.click('[data-a="awgo"]');
  assert.equal((await q(page)).q, 'What kind of food was it?');
  await opt(page, 'A drink');
  assert.equal((await q(page)).q, 'What kind of drink?');
  await page.click('[data-a="awunsure"]');                       // his default: tea
  assert.equal((await q(page)).q, 'How big was it?');
  await page.click('[data-a="awundo"]');
  assert.equal((await q(page)).q, 'What kind of drink?');
  await opt(page, 'Tea'); await opt(page, 'A cup (about 240 ml)');
  assert.equal((await q(page)).q, 'What went in it? Tap all that apply.');
  await tog(page, 'Condensed milk'); await page.click('[data-a="awdone"]');
  // tea 8 fl oz = 240 g: 1 × 240 ÷ 100 = 2.4 kcal; condensed milk ½ fl oz = 19 g: 321 × 19 ÷ 100 = 61 kcal; total 63
  assert.match(await page.textContent('#awcard'), /about 63 kcal[\s\S]*Tea8 × 1 fl oz \(30 g each\) = 240 g2 kcal[\s\S]*Condensed milk½ × 1 fl oz \(38 g each\) = 19 g61 kcal/);
  // something else: not in his book
  await page.click('[data-a="awrestart"]');
  await page.fill('#awq', 'zzz'); await page.click('[data-a="awgo"]');
  await opt(page, 'Something else');
  assert.match(await page.textContent('#awiz'), /That one is not in my book\. Search for it below, sign in so I can use my crystal ball, or type it yourself/);
  assert.deepEqual(await fig(page), ['side', 'confused']);
  assert.deepEqual(errors, []);
});

test('signed in, the crystal ball: Gemini asks, the answers go back, the guess lists parts; a USDA-matched part uses USDA values for the AI\'s weight; others are labelled AI estimates', async () => {
  const S = fakeSupabase();
  S.guessReplies = [
    { ask: { q: 'How much blue rice was on your plate?', options: ['Half a plate', 'One canteen plate', 'A big plate'], multi: false } },
    { ask: { q: 'Which toppings came with it?', options: ['Fried fish', 'Salted egg', 'Keropok', 'Solok lada'], multi: true } },
    { guess: { name: 'Nasi kerabu', note: 'One canteen plate with fried fish and solok lada.', items: [
      { label: 'Blue rice', part: 'rice', g: 200, kcal: 260, p: 5, c: 57, f: 0.6 },
      { label: 'Solok lada', part: '', g: 60, kcal: 130, p: 6, c: 5, f: 9 }] } }];
  const { page, errors } = await device(S, { viewport: { width: 1000, height: 1100 } });
  await signIn(page, S); await synced(page);
  await openWizard(page);
  assert.match(await page.textContent('#awiz'), /He asks a few questions with his crystal ball \(Google Gemini\)/);
  await page.fill('#awq', 'nasi kerabu'); await page.click('[data-a="awgo"]');
  await page.waitForSelector('[data-a="awopt"]');
  assert.equal(S.guess[0].food, 'nasi kerabu');
  assert.deepEqual(S.guess[0].answers, []);
  assert.deepEqual(S.guess[0].ref.find(r => r[0] === 'rice'), ['rice', 'Rice, white, cooked, no added fat']);
  assert.match(await page.textContent('.awsay'), /How much blue rice was on your plate\?/);
  await page.click('[data-a="awopt"][data-i="1"]');
  await page.waitForSelector('[data-a="awtog"]');
  assert.deepEqual(S.guess[1].answers, [{ q: 'How much blue rice was on your plate?', a: 'One canteen plate' }]);
  await page.click('[data-a="awtog"][data-i="0"]'); await page.click('[data-a="awtog"][data-i="3"]'); await page.click('[data-a="awdone"]');
  await page.waitForSelector('#awcard');
  assert.deepEqual(S.guess[2].answers[1], { q: 'Which toppings came with it?', a: 'Fried fish, Solok lada' });
  // rice: USDA 129 kcal per 100 g × 200 g = 258 (not the AI's 260); solok lada: the AI's 130; total 388
  const card = await page.textContent('#awcard');
  assert.match(card, /about 388 kcalProtein11\.3 gCarbohydrate61 gFat9\.6 g/);
  assert.match(card, /Blue rice[\s\S]*258 kcal[\s\S]*FDC ID 2708408[\s\S]*Weight: AI estimate; values for that weight from USDA/);
  assert.match(card, /Solok lada60 g130 kcal[\s\S]*AI estimate \(Google Gemini\): not from a food database, not measured/);
  assert.match(card, /Parts marked "AI estimate" come from Google Gemini and can be wrong\.[\s\S]*His assumption: One canteen plate with fried fish and solok lada\./);
  await page.click('[data-a="awlog"]');
  const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.v, e.m.db, e.m.how, e.m.parts], [388, 'est', 'ai', [['Blue rice', 200, 258, 'usda+ai'], ['Solok lada', 60, 130, 'ai']]]);
  assert.deepEqual(errors, []);
});

test('the crystal ball unavailable → he says so and uses his book; not a food → confused', async () => {
  const S = fakeSupabase(); S.guessStatus = 503; S.guessBody = { error: 'nokey' };
  const { page, errors } = await device(S);
  await signIn(page, S); await synced(page);
  await openWizard(page);
  await page.fill('#awq', 'roti canai'); await page.click('[data-a="awgo"]');
  await page.waitForSelector('[data-a="awopt"]');
  assert.match(await page.textContent('#awiz'), /My crystal ball is not set up on the server yet\. I will use my book instead\./);
  assert.equal((await q(page)).q, 'How many pieces?');
  S.guessStatus = 200; S.guessReplies = [{ unknown: true }];
  await page.click('[data-a="awrestart"]');
  await page.fill('#awq', 'my homework'); await page.click('[data-a="awgo"]');
  await page.waitForFunction(() => !HWAddFood.state.busy && HWAddFood.state.step === 'ask');
  assert.deepEqual(await fig(page), ['side', 'confused']);
  assert.match(await page.textContent('.awsay'), /that does not sound like a food or a drink/);
  assert.deepEqual(errors.filter(e => !/status of 503/.test(e)), []);
});

test('every book part is a USDA food or a canteen dish with values; every family ends in a guess', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  const r = await page.evaluate(() => {
    const A = HWAddFood, bad = [];
    for (const [k, t] of Object.entries(A.T)) { const v = A.partVal(t[1], t[2]); if (!v || !(v.kcal >= 0) || v.p == null) bad.push(k); }
    return { bad, parts: Object.keys(HWFoodParts).length };
  });
  assert.deepEqual(r.bad, []);
  assert.ok(r.parts >= 70);
  assert.deepEqual(errors, []);
});

test('SEARCH THE BOOKS INSTEAD: the canteen menu; a dish\'s own portion × 2; saved only on CONFIRM AND LOG', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await openWizard(page);
  assert.equal(await page.locator('#cn').count(), 1, 'the original form is still there, below');
  const dish = await page.evaluate(() => F.find(f => f[2] && /roti canai/i.test(f[0])));
  await page.fill('#awq', 'roti canai'); await page.click('[data-a="awsearch"]');
  await page.waitForSelector('[data-a="awpick"]');
  assert.match(await page.textContent('.awlist'), new RegExp('Kolej MARA Kulim canteen menu \\(2022\\) · ' + dish[1].replace(/[()]/g, '.') + ' · ' + dish[2] + ' kcal'));
  await page.click('[data-a="awpick"] >> nth=0');
  await page.click('[data-a="awn"][data-v="2"]');
  const card = await page.textContent('#awcard');
  assert.match(card, new RegExp('Energy' + 2 * dish[2] + ' kcal'));
  assert.match(card, /HealthWiz estimates from the dish type/);
  assert.equal((await state(page)).e.length, 0, 'nothing saved yet');
  await page.click('[data-a="awsave"]');
  const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.c, e.v, e.m.qty, e.m.src, e.m.por], ['food', 2 * dish[2], 2, 'KOLEJ MARA KULIM', dish[1]]);
  assert.deepEqual(await fig(page), ['cast', 'excited'], 'he casts the reveal');
  assert.deepEqual(errors, []);
});

test('the original custom form still saves in one click (name and kcal only)', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await openWizard(page);
  await page.fill('#cn', 'Teh tarik'); await page.fill('#cc', '120'); await page.click('[data-a="savecf"]');
  const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.m.name, e.v, e.m.custom], ['Teh tarik', 120, 1]);
  assert.deepEqual(errors, []);
});

test('signed in: USDA FoodData Central matches; household measures with grams; the values follow the amount; the entry records the source', async () => {
  const S = fakeSupabase(); S.foods = [RICE, PLAIN]; S.foodDetail = RICE_D;
  const { page, errors } = await device(S, { viewport: { width: 1000, height: 1100 } });
  await signIn(page, S); await synced(page);
  await openWizard(page);
  await page.fill('#awq', 'rice'); await page.click('[data-a="awsearch"]');
  await page.waitForSelector('[data-a="awpick"][data-k="d0"]');
  assert.match(await page.textContent('.awlist'), /Rice, white, cooked, no added fat\s*USDA FoodData Central · Survey \(FNDDS\) · 130 kcal per 100 g/);
  assert.deepEqual(S.food[0], { q: 'rice' });
  await page.click('[data-a="awpick"][data-k="d0"]');
  await page.waitForSelector('[data-a="awpor"]');
  assert.deepEqual(S.food[1], { id: 2512381 });
  assert.deepEqual(await page.locator('[data-a="awpor"]').allTextContents(), ['1 cup158 g', '1 serving100 g']);
  // 1½ cups = 237 g → 130 × 237 ÷ 100 = 308 kcal
  await page.click('[data-a="awn"][data-v="1.5"]');
  let c = await page.textContent('#awcard');
  assert.match(c, /1½ × 1 cup \(158 g each\)/);
  assert.match(c, /Energy308 kcalProtein6\.4 gCarbohydrate66\.8 gFat0\.7 g/);
  assert.match(c, /Energy: 130 × 237 ÷ 100 = 308 kcal\./);
  assert.match(c, /Source: USDA FoodData Central, Survey \(FNDDS\), FDC ID 2512381\. Public domain \(CC0\)\. Survey portion weights are typical amounts/);
  await page.fill('#awname', 'Nasi putih');
  await page.click('[data-a="awsave"]');
  const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.v, e.m.name, e.m.db, e.m.fdc, e.m.fdt, e.m.g, e.m.p, e.m.c, e.m.f, e.m.src], [308, 'Nasi putih', 'fdc', 2512381, 'Survey (FNDDS)', 237, 6.4, 66.8, 0.7, 'USDA FoodData Central']);
  assert.match(await page.textContent('#flog'), /Nasi putih[\s\S]*USDA FoodData Central/, 'the log names the source, not "Custom Food"');
  assert.deepEqual(errors, []);
});

test('no household measure: grams are asked for, and CONFIRM waits for a valid amount; errors are friendly', async () => {
  const S = fakeSupabase(); S.foods = [PLAIN]; S.foodDetail = { ...PLAIN, portions: [], serving: null };
  const { page, errors } = await device(S);
  await signIn(page, S); await synced(page);
  await openWizard(page);
  await page.fill('#awq', 'durian'); await page.click('[data-a="awsearch"]');
  await page.click('[data-a="awpick"][data-k="d0"]');
  await page.waitForSelector('#awg');
  assert.equal(await page.isDisabled('[data-a="awsave"]'), true);
  await page.fill('#awg', '200');
  assert.match(await page.textContent('#awcard'), /Energy294 kcal/);
  assert.equal(await page.isDisabled('[data-a="awsave"]'), false);
  // nothing found anywhere: he is nervous
  S.foods = [];
  await page.click('[data-a="awback"]'); await page.fill('#awq', 'zzzz'); await page.click('[data-a="awsearch"]');
  await page.waitForFunction(() => !HWAddFood.state.busy);
  assert.deepEqual(await fig(page), ['back', 'nervous']);
  assert.match(await page.textContent('#awiz'), /could not find that one/);
  // the server not set up: the menu still works and he says so
  S.foodStatus = 503; S.foodBody = { error: 'nokey' };
  await page.fill('#awq', 'nasi'); await page.click('[data-a="awsearch"]');
  await page.waitForFunction(() => !HWAddFood.state.busy);
  assert.match(await page.textContent('#awiz'), /The food archive is not set up on the server yet/);
  assert.deepEqual(errors.filter(e => !/status of 503/.test(e)), []);
});

test('phone: no sideways scroll, large controls; he stands still under reduced motion', async () => {
  const { page, errors } = await openApp({ seed: RETURNING, viewport: { width: 360, height: 760 }, context: { reducedMotion: 'reduce', isMobile: true, hasTouch: true } });
  await openWizard(page);
  const m = () => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, h: [...document.querySelectorAll('#awiz button')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height)) }));
  await page.fill('#awq', 'nasi lemak'); await page.click('[data-a="awgo"]');
  for (const step of ['amount', 'sides', 'sauces', 'guess']) {
    const r = await m();
    assert.ok(r.doc <= 360, step + ': no sideways scroll: ' + r.doc);
    for (const h of r.h) assert.ok(h >= 44, step + ': button height ' + h);
    if (step === 'amount') await page.click('[data-a="awopt"] >> nth=1'); else if (step !== 'guess') await page.click('[data-a="awdone"]');
  }
  // he fills most of the scene's height
  const big = await page.evaluate(() => { const f = document.querySelector('.awfig').getBoundingClientRect(), s = document.querySelector('.awscene').getBoundingClientRect(); return [f.height, s.height]; });
  assert.ok(big[0] >= 0.9 * big[1] && big[0] >= 180, 'the Wizard is large: ' + big.join(' / '));
  await page.click('[data-a="awrestart"]');
  await page.fill('#awq', 'nasi'); await page.click('[data-a="awsearch"]');
  await page.waitForSelector('[data-a="awpick"]');
  await page.waitForFunction(() => document.querySelector('.awroom').complete);
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, anim: getComputedStyle(document.querySelector('.awfig')).animationName,
    h: [...document.querySelectorAll('#awiz button')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height)),
    img: (i => i.complete && i.naturalWidth)(document.querySelector('.awroom')) }));
  assert.ok(r.doc <= 360, 'no sideways scroll: ' + r.doc);
  assert.equal(r.anim, 'none');
  for (const h of r.h) assert.ok(h >= 44, 'button height ' + h);
  assert.equal(r.img, 336, 'his room from the owner\'s scene');
  assert.deepEqual(errors, []);
});

test('Deno unit tests of food-search and food-guess (skipped when Deno is not installed)', async t => {
  const { spawnSync, execFileSync } = await import('node:child_process');
  if (spawnSync('deno', ['--version']).status !== 0) return t.skip('deno not installed');
  const out = execFileSync('deno', ['test', '--no-lock', '--allow-env', 'supabase/tests/food-search.test.ts'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.match(out, /ok \| 6 passed \| 0 failed/);
  const g = execFileSync('deno', ['test', '--no-lock', '--allow-env', 'supabase/tests/food-guess.test.ts'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.match(g, /ok \| 6 passed \| 0 failed/);
});
