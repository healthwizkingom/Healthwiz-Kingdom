// Add More Food (js/v6-addfood.js): the Wannabe Wizard's search above the original custom form. Signed in he searches the
// web (Gemini with Google Search, through food-guess) for the food, portion and changes typed, and shows the parts, each
// part's named source and arithmetic, a check of calories against macros, the total and the web pages he used. Signed out
// (or when the search fails) he can only look at the canteen menu. No USDA anywhere. Nothing is saved before LOG IT /
// CONFIRM AND LOG; the original one-click custom save still works; errors; his poses and faces; the phone layout.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';
import { fakeSupabase, device, synced, signIn } from './cloud-fake.mjs';

after(closeBrowser);
const openWizard = async page => { await go(page, 'food'); await page.click('[data-a="cf"]'); await page.waitForSelector('#awiz'); };
const fig = page => page.$eval('#awiz', w => [w.querySelector('.awfig').dataset.pose, w.querySelector('.awface').dataset.face]);
const RESULT = { name: 'Nasi lemak', portion: 'one big plate, extra fried chicken, no sambal', note: 'Coconut rice from MyFCD; one extra piece of fried chicken; sambal left out.', confidence: 'medium', searched: true,
  items: [{ label: 'Coconut rice', g: 250, kcal: 450, p: 8, c: 70, f: 15, src: 'MyFCD', basis: 'per 100 g: 180 kcal, x 250 g', chk: false },
    { label: 'Fried chicken (extra)', g: 120, kcal: 330, p: 25, c: 8, f: 22, src: 'KFC Malaysia nutrition guide', basis: 'label: 330 kcal per piece', chk: false }],
  sources: [{ title: 'myfcd.moh.gov.my', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc' }], suggest: '<div class="chip">nasi lemak calories</div>' };

test('signed in, he searches the web: food, portion and changes in one box; the parts, the total, his sources; − and +; logged only on LOG IT (phone layout)', async () => {
  const S = fakeSupabase(); S.guessReplies = [{ result: RESULT }];
  const { page, errors } = await device(S, { viewport: { width: 360, height: 800 }, context: { isMobile: true, hasTouch: true } });
  await signIn(page, S); await synced(page);
  await openWizard(page);
  assert.deepEqual(await fig(page), ['front', 'happy']);
  assert.match(await page.textContent('#awiz'), /Tell me what you ate, how much, and anything extra or left out[\s\S]*He searches the web with Google Gemini for real nutrition data/);
  assert.equal(await page.locator('#cn').count(), 1, 'the original form is still there, below');
  await page.fill('#awq', 'nasi lemak, big plate, extra fried chicken, no sambal'); await page.press('#awq', 'Enter');
  await page.waitForSelector('#awcard');
  assert.deepEqual(S.guess, [{ food: 'nasi lemak, big plate, extra fried chicken, no sambal' }], 'one search with the words as typed');
  assert.deepEqual(await fig(page), ['front', 'surprised']);
  // 450 + 330 = 780 kcal; protein 8 + 25 = 33 g; carbohydrate 70 + 8 = 78 g; fat 15 + 22 = 37 g
  const card = await page.textContent('#awcard');
  assert.match(card, /Nasi lemak · one big plate, extra fried chicken, no sambalabout 780 kcalProtein33 gCarbohydrate78 gFat37 g/);
  assert.match(card, /Coconut rice250 g450 kcal[\s\S]*Fried chicken \(extra\)120 g330 kcal/);
  assert.match(card, /Source: MyFCD\. per 100 g: 180 kcal, x 250 g/);
  assert.match(card, /Source: KFC Malaysia nutrition guide\. label: 330 kcal per piece/);
  assert.match(card, /AI estimate by Google Gemini from web sources, not a measurement\. How sure: medium\./);
  assert.match(card, /Where he found itmyfcd\.moh\.gov\.my/);
  assert.deepEqual(await page.$eval('.awsrcs a', a => [a.href, a.target, a.rel]), [RESULT.sources[0].url, '_blank', 'noopener noreferrer']);
  assert.deepEqual(await page.$eval('.awsugg', f => [f.getAttribute('sandbox'), f.getAttribute('srcdoc')]), ['allow-popups allow-popups-to-escape-sandbox', RESULT.suggest]);
  assert.match(await page.textContent('.awsay'), /Found it! About 780 kcal\. Check my sources below!/);
  // half the extra chicken: 330 × 0.5 = 165; total 615
  await page.click('[data-a="awadj"][data-i="1"][data-d="-1"]');
  assert.match(await page.textContent('#awcard'), /about 615 kcal[\s\S]*Fried chicken \(extra\)60 g \(0\.5 × what I found\)165 kcal/);
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, h: [...document.querySelectorAll('#awiz button')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height)) }));
  assert.ok(r.doc <= 360, 'no sideways scroll: ' + r.doc);
  for (const h of r.h) assert.ok(h >= 44, 'button height ' + h);
  assert.equal((await state(page)).e.length, 0, 'nothing saved yet');
  await page.click('[data-a="awlog"]');
  const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.v, e.m.name, e.m.por, e.m.db, e.m.how, e.m.custom, e.m.p, e.m.c, e.m.f, e.m.g], [615, 'Nasi lemak', RESULT.portion, 'est', 'web', 1, 20.5, 74, 26, 310]);
  assert.deepEqual(e.m.parts, [['Coconut rice', 250, 450, 'MyFCD'], ['Fried chicken (extra)', 60, 165, 'KFC Malaysia nutrition guide']]);
  assert.deepEqual(e.m.refs, [RESULT.sources[0].url]);
  assert.deepEqual(await fig(page), ['cast', 'excited']);
  assert.match(await page.textContent('#flog'), /Nasi lemak[\s\S]*Wizard's estimate[\s\S]*EST/, 'the log says it is an estimate');
  assert.doesNotMatch(await page.textContent('#flog'), /YOURS|kcal by you/);
  assert.deepEqual(errors, []);
});

test('references: a part without a source says so, a part whose calories do not match its macros is flagged, and an unsourced answer is not "sure"', async () => {
  const S = fakeSupabase(); S.guessReplies = [{ result: { ...RESULT, confidence: 'low', sources: [], items: [
    { label: 'Mystery gravy', g: 100, kcal: 900, p: 2, c: 8, f: 5, src: '', basis: '', chk: true }, { label: 'Rice', g: 200, kcal: 260, p: 5, c: 57, f: 0.6, src: 'MyFCD', basis: 'x', chk: false }] } }];
  const { page, errors } = await device(S, { viewport: { width: 360, height: 800 }, context: { isMobile: true, hasTouch: true } });
  await signIn(page, S); await synced(page);
  await openWizard(page);
  await page.fill('#awq', 'mystery'); await page.press('#awq', 'Enter');
  await page.waitForSelector('#awcard');
  const card = await page.textContent('#awcard');
  assert.match(card, /Mystery gravy[\s\S]*No source found: his own estimate/);
  assert.match(card, /Check this one: its calories do not match its protein, carbohydrate and fat \(4 × P \+ 4 × C \+ 9 × F = 85 kcal\)\./);
  assert.match(card, /How sure: low\. 1 part has no source and is his own estimate\./);
  assert.match(card, /No web sources came back for this one\./);
  assert.equal((card.match(/Check this one/g) || []).length, 1, 'only the part that does not add up');
  assert.deepEqual(errors, []);
});

test('no web search on the server: he says so and offers the canteen menu; not a food → confused; an answer without web sources says so', async () => {
  const S = fakeSupabase(); S.guessStatus = 503; S.guessBody = { error: 'nokey' };
  const { page, errors } = await device(S);
  await signIn(page, S); await synced(page);
  await openWizard(page);
  await page.fill('#awq', 'roti canai'); await page.click('[data-a="awgo"]');
  await page.waitForSelector('[data-a="awpick"]');
  assert.match(await page.textContent('#awiz'), /My web search is not set up on the server yet\. I can still look at the canteen menu\.[\s\S]*Roti Canai/);
  S.guessStatus = 200; S.guessReplies = [{ unknown: true }, { result: { ...RESULT, searched: false, sources: [], suggest: '' } }];
  await page.fill('#awq', 'my homework'); await page.click('[data-a="awgo"]');
  await page.waitForFunction(() => !HWAddFood.state.busy && HWAddFood.state.unknown);
  assert.deepEqual(await fig(page), ['side', 'confused']);
  assert.match(await page.textContent('.awsay'), /that does not sound like a food or a drink/);
  await page.fill('#awq', 'nasi lemak'); await page.click('[data-a="awgo"]');
  await page.waitForSelector('#awcard');
  assert.match(await page.textContent('#awcard'), /AI estimate by Google Gemini from its own knowledge \(the web search was not available\)[\s\S]*No web sources came back for this one\./);
  assert.equal(await page.locator('.awsugg').count(), 0);
  assert.deepEqual(errors.filter(e => !/status of 503/.test(e)), []);
});

test('signed out, he can only look at the canteen menu: a dish\'s own portion × 2; saved only on CONFIRM AND LOG', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await openWizard(page);
  assert.match(await page.textContent('#awiz'), /Signed out: he can only look at the Kolej MARA Kulim canteen menu\. Sign in so he can search the web for any food\./);
  assert.equal(await page.locator('#cn').count(), 1, 'the original form is still there, below');
  const dish = await page.evaluate(() => F.find(f => f[2] && /roti canai/i.test(f[0])));
  await page.fill('#awq', 'roti canai'); await page.press('#awq', 'Enter');
  await page.waitForSelector('[data-a="awpick"]');
  assert.match(await page.textContent('#awiz'), /Sign in so I can search the web for any food\. Here is the canteen menu\./);
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

test('phone: no sideways scroll, large controls; he stands still under reduced motion', async () => {
  const { page, errors } = await openApp({ seed: RETURNING, viewport: { width: 360, height: 760 }, context: { reducedMotion: 'reduce', isMobile: true, hasTouch: true } });
  await openWizard(page);
  const m = () => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, h: [...document.querySelectorAll('#awiz button')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height)) }));
  // he fills most of the scene's height
  await page.waitForFunction(() => document.querySelector('.awroom').complete);
  const big = await page.evaluate(() => { const f = document.querySelector('.awfig').getBoundingClientRect(), s = document.querySelector('.awscene').getBoundingClientRect(); return [f.height, s.height]; });
  assert.ok(big[0] >= 0.9 * big[1] && big[0] >= 180, 'the Wizard is large: ' + big.join(' / '));
  await page.fill('#awq', 'nasi'); await page.click('[data-a="awgo"]');
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

test('Deno unit tests of food-guess (skipped when Deno is not installed)', async t => {
  const { spawnSync, execFileSync } = await import('node:child_process');
  if (spawnSync('deno', ['--version']).status !== 0) return t.skip('deno not installed');
  const g = execFileSync('deno', ['test', '--no-lock', '--allow-env', 'supabase/tests/food-guess.test.ts'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.match(g, /ok \| 8 passed \| 0 failed/);
});

test('no USDA anywhere: not in the Wizard, its server function, its instructions, or the app\'s sources', async () => {
  const fs = await import('node:fs');
  const root = new URL('../', import.meta.url);
  for (const f of ['js/v6-addfood.js', 'supabase/functions/food-guess/index.ts', 'js/v6-sources.js', 'js/v6-vault.js', 'sw.js', 'index.html'])
    assert.doesNotMatch(fs.readFileSync(new URL(f, root), 'utf8'), /USDA|FoodData|food-search|FDC_API_KEY|foodparts/i, f);
  assert.equal(fs.existsSync(new URL('supabase/functions/food-search', root)), false);
});
