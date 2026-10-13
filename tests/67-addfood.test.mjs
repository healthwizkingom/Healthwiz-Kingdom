// Add More Food (js/v6-addfood.js): the Wannabe Wizard's guided search above the original custom form. The canteen menu
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

test('signed out: the wizard searches the canteen menu; a dish\'s own portion × 2; saved only on CONFIRM AND LOG', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await openWizard(page);
  assert.deepEqual(await fig(page), ['front', 'happy']);
  assert.match(await page.textContent('#awiz'), /THE WANNABE WIZARD\s*What did you eat\?[\s\S]*Signed out: the canteen menu is searched/);
  assert.equal(await page.locator('#cn').count(), 1, 'the original form is still there, below');
  const dish = await page.evaluate(() => F.find(f => f[2] && /roti canai/i.test(f[0])));
  await page.fill('#awq', 'roti canai'); await page.press('#awq', 'Enter');
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
  await page.fill('#awq', 'nasi'); await page.click('[data-a="awsearch"]');
  await page.waitForSelector('[data-a="awpick"]');
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, anim: getComputedStyle(document.querySelector('.awfig')).animationName,
    h: [...document.querySelectorAll('#awiz button')].filter(b => b.offsetParent).map(b => Math.round(b.getBoundingClientRect().height)),
    img: (i => i.complete && i.naturalWidth)(document.querySelector('.awroom')) }));
  assert.ok(r.doc <= 360, 'no sideways scroll: ' + r.doc);
  assert.equal(r.anim, 'none');
  for (const h of r.h) assert.ok(h >= 44, 'button height ' + h);
  assert.equal(r.img, 336, 'his room from the owner\'s scene');
  assert.deepEqual(errors, []);
});

test('Deno unit tests of food-search (skipped when Deno is not installed)', async t => {
  const { spawnSync, execFileSync } = await import('node:child_process');
  if (spawnSync('deno', ['--version']).status !== 0) return t.skip('deno not installed');
  const out = execFileSync('deno', ['test', '--no-lock', '--allow-env', 'supabase/tests/food-search.test.ts'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.match(out, /ok \| 6 passed \| 0 failed/);
});
