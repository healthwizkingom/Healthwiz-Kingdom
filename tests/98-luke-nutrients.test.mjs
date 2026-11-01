// Luke's search for sodium, potassium, magnesium, tryptophan and caffeine (js/v6-addfood.js, supabase/functions/food-guess).
// Players cannot know these numbers, so Luke is never made to ask for them: he searches on his own and cites the best result he found
// (and says when it is a similar food). Nothing found shows as such, never as 0 and never as a prompt to the player.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';
import { fakeSupabase, device, synced, signIn } from './cloud-fake.mjs';

after(closeBrowser);
const read = rel => fs.readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const openWizard = async page => { await go(page, 'food'); await page.click('[data-a="cf"]'); await page.waitForSelector('#awiz'); };
const ask = async (page, text) => { await page.fill('#awq', text); await page.press('#awq', 'Enter'); };
const rowOf = (card, name) => (card.match(new RegExp(name + '([^]*?)(?=Sodium|Potassium|Magnesium|Tryptophan|Caffeine|kcal =|$)')) || [])[0];
const MEAL = { name: 'Teh O and rice', portion: 'one glass, one plate', note: 'Tea and rice from a national table.', confidence: 'medium', searched: true,
  items: [{ label: 'Black tea with sugar', g: 200, kcal: 40, p: 0, c: 10, f: 0, na: 4, k: 60, mg: 4, trp: null, caf: 38, nsrc: 'MyFCD, tea brewed', nm: 'similar', src: 'MyFCD', basis: 'per 100 g x 200 g', chk: false },
    { label: 'Plain rice', g: 150, kcal: 195, p: 4, c: 42, f: 0.4, na: 2, k: 50, mg: 18, trp: 46, caf: null, nsrc: 'MyFCD', nm: 'exact', src: 'MyFCD', basis: 'per 100 g x 150 g', chk: false }],
  sources: [{ title: 'myfcd.moh.gov.my', url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc' }], suggest: '' };
const DISH = { result: { name: 'Roti Canai', portion: '80g (one serving)', note: '', confidence: 'medium', searched: true, sources: [], suggest: '', items: [
  { label: 'Roti canai', g: 80, kcal: 280, p: 6, c: 36, f: 12, na: 310, k: 95, mg: 14, trp: 62, caf: null, nsrc: 'Singapore HPB food composition table (roti prata)', nm: 'similar', src: 'HPB', basis: '', chk: false }] } };
const NONE = { result: { name: 'Roti Canai', portion: '80g (one serving)', note: '', confidence: 'low', searched: true, sources: [], suggest: '', items: [
  { label: 'Roti canai', g: 80, kcal: 280, p: 6, c: 36, f: 12, na: null, k: null, mg: null, trp: null, caf: null, nsrc: '', nm: '', src: '', basis: '', chk: false }] } };
const canteen = async (page, S, reply, dish = 'roti canai') => { S.guessReplies = [reply]; await openWizard(page); await page.fill('#awq', dish); await page.click('[data-a="awsearch"]'); await page.waitForSelector('[data-a="awpick"]'); await page.click('[data-a="awpick"] >> nth=0'); };

test('a web search: five nutrients, each part names its best result, a similar food is said to be similar, and the player is asked for nothing', async () => {
  const S = fakeSupabase(); S.guessReplies = [{ result: MEAL }];
  const { page, errors } = await device(S, { viewport: { width: 380, height: 800 } }); await signIn(page, S); await synced(page);
  await openWizard(page); await ask(page, 'teh o and nasi putih'); await page.waitForSelector('#awcard');
  assert.deepEqual(S.guess, [{ food: 'teh o and nasi putih' }], 'one search, with only the words the player typed');
  const card = (await page.textContent('#awcard')).replace(/\s+/g, ' ');
  assert.match(card, /Sodium6 mg/); assert.match(card, /Potassium110 mg/); assert.match(card, /Magnesium22 mg/);          // 4 + 2, 60 + 50, 4 + 18
  assert.match(card, /Tryptophan46 mg/); assert.match(card, /Caffeine38 mg/);                                            // only the rice has tryptophan, only the tea has caffeine
  assert.match(card, /Black tea with sugar[\s\S]*Nutrients: MyFCD, tea brewed \(a similar food: the closest match\)/); assert.match(card, /Plain rice[\s\S]*Nutrients: MyFCD(?! \()/);
  // nobody is asked for these numbers: the wizard holds no field, button or question about them
  const ui = await page.$eval('#awiz', w => ({ fields: [...w.querySelectorAll('input,select,textarea')].map(f => [f.id, f.name, f.placeholder, f.getAttribute('aria-label'), f.closest('label') && f.closest('label').textContent].join(' ')), text: w.textContent }));
  assert.ok(!ui.fields.some(f => /sodium|potassium|magnesium|tryptophan|caffeine|\bna\b|\bmg\b/i.test(f)), 'no input for them: ' + ui.fields.join(' | '));
  assert.doesNotMatch(ui.text, /do you know|enter the (sodium|mg)|type the (sodium|mg)|how much (sodium|magnesium)/i);
  assert.equal((await state(page)).e.length, 0, 'nothing saved yet');
  await page.click('[data-a="awlog"]');
  const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.m.na, e.m.k, e.m.mg, e.m.trp, e.m.caf], [6, 110, 22, 46, 38]);
  assert.deepEqual(errors, []);
});

test('a canteen dish: Luke starts the search himself when it is picked, cites the best result, and says it is a similar food', async () => {
  const S = fakeSupabase(); const { page, errors } = await device(S, { viewport: { width: 380, height: 800 } }); await signIn(page, S); await synced(page);
  await canteen(page, S, DISH);
  await page.waitForFunction(() => /Sodium310mg/.test(document.getElementById('awcard').textContent.replace(/\s+/g, '')), null, { timeout: 8000 });
  assert.ok(S.guess.some(g => /^Roti Canai, 80g \(one serving\)$/.test(g.food)), 'the lookup is his own request for the picked dish: ' + JSON.stringify(S.guess));
  const card = (await page.textContent('#awcard')).replace(/\s+/g, ' ');
  for (const [n, v] of [['Sodium', 310], ['Potassium', 95], ['Magnesium', 14], ['Tryptophan', 62]]) assert.ok(card.replace(/ /g, '').includes(n + v + 'mg'), n + ' ' + v + ' mg in: ' + card);
  assert.doesNotMatch(card, /Caffeine/, 'no caffeine row for a food with no caffeine value');
  assert.match(card, /Nutrients: AI estimate by Google Gemini from web search\. Best result used: Singapore HPB food composition table \(roti prata\) \(for a similar food: the closest match Luke found\)\./);
  const ui = await page.$eval('#awiz', w => [...w.querySelectorAll('input,select,textarea')].map(f => f.id + f.placeholder).join(' '));
  assert.ok(!/sodium|potassium|magnesium|tryptophan|caffeine/i.test(ui));
  await page.click('[data-a="awsave"]');
  const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.m.na, e.m.k, e.m.mg, e.m.trp, e.m.caf, e.m.mnm, e.m.mnsrc], [310, 95, 14, 62, null, 'similar', 'Singapore HPB food composition table (roti prata)']);
  assert.deepEqual(errors, []);
});

test('nothing found says so plainly, never 0 and never a question to the player; signed out says Luke searches when signed in and makes no request', async () => {
  const S = fakeSupabase(); const { page, errors } = await device(S, { viewport: { width: 380, height: 800 } }); await signIn(page, S); await synced(page);
  await canteen(page, S, NONE);
  await page.waitForFunction(() => /Luke found no source/.test(document.getElementById('awcard').textContent), null, { timeout: 8000 });
  const t = (await page.textContent('#awcard')).replace(/\s+/g, ' ');
  for (const n of ['Sodium', 'Potassium', 'Magnesium', 'Tryptophan']) assert.match(t, new RegExp(n + 'Luke found no source for this'));
  assert.doesNotMatch(t, /Caffeine|0 mg|no verified source found|do you know|please enter/i);
  await page.click('[data-a="awsave"]'); const e = (await state(page)).e.at(-1);
  assert.deepEqual([e.m.na, e.m.k, e.m.mg, e.m.trp, e.m.caf], [null, null, null, null, null], 'saved as missing, not 0');
  assert.deepEqual(errors, []);
  // signed out
  const out = await openApp({ seed: RETURNING });
  await openWizard(out.page); await out.page.fill('#awq', 'roti canai'); await out.page.press('#awq', 'Enter'); await out.page.waitForSelector('[data-a="awpick"]'); await out.page.click('[data-a="awpick"] >> nth=0');
  const o = (await out.page.textContent('#awcard')).replace(/\s+/g, ' ');
  for (const n of ['Sodium', 'Potassium', 'Magnesium', 'Tryptophan']) assert.match(o, new RegExp(n + 'Luke looks this up when you are signed in and online'));
  assert.doesNotMatch(o, /no verified source found|Caffeine/);
  assert.deepEqual(out.errors, []); await out.ctx.close();
});

test('the server asks Gemini to search all five nutrients itself and the app has no field for them (source checks)', () => {
  const fn = read('supabase/functions/food-guess/index.ts'), app = read('js/v6-addfood.js');
  assert.match(fn, /The player cannot know these numbers, so never ask for them: search for them yourself/); assert.match(fn, /the closest similar food/);
  assert.match(fn, /"tryptophan_mg":null,"caffeine_mg":null,"nutrient_source":"\.\.\.","nutrient_match":"exact\|similar"/); assert.match(fn, /no citation, no number/);
  assert.doesNotMatch(fn + app, /USDA|FoodData|food-search|FDC_API_KEY|foodparts/i, 'the project rule: no USDA in the Wizard or its function');
  assert.doesNotMatch(app, /id="aw(na|k|mg|trp|caf)"|data-in="aw(na|mg|trp|caf)"|placeholder="(sodium|magnesium|mg)/i);
  assert.ok(Buffer.byteLength(app) < 64 * 1024, 'js/v6-addfood.js is ' + Buffer.byteLength(app));
});
