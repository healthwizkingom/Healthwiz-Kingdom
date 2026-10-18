// Science Laboratory + Evidence Vault links: every calculation "?" that has an Evidence Vault entry links to that exact entry
// (#vault=<calculation id>), the entry opens, is marked and focused, the way back works, and unsaved input survives the trip.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, RETURNING } from './helpers.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADULT = { ...RETURNING, p: { ...RETURNING.p, w: 70, h: 172, age: 30, sex: 'm', act: 1.55, cfm: 1 } };
const pop = async page => (await page.textContent('#hwh-pop')).replace(/\s+/g, ' ');
const openHelp = async (page, key) => { await page.click(`.hwh[data-hwh="${key}"]`); await page.waitForSelector('#hwh-pop:not([hidden])'); };

test('every evidence id named in the code is a real Vault calculation (so a link can never lead nowhere)', async () => {
  const { page, ctx, errors } = await openApp();
  const have = await page.evaluate(() => HWVault.CALCS.map(c => c.id));
  const used = new Set();
  for (const f of fs.readdirSync(path.join(root, 'js'))) {
    const t = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    for (const m of t.matchAll(/\bev:\s*(?:'([a-z0-9]+)'|\[([^\]]*)\])/g)) for (const id of m[1] ? [m[1]] : m[2].match(/'([a-z0-9]+)'/g).map(x => x.slice(1, -1))) used.add(id);
  }
  for (const m of fs.readFileSync(path.join(root, 'js/v6-help.js'), 'utf8').matchAll(/,'([a-z]+)'\);\n/g)) if (have.includes(m[1])) used.add(m[1]);
  if (/,'ppg'\)\}/.test(fs.readFileSync(path.join(root, 'js/v6-ppg.js'), 'utf8'))) used.add('ppg');
  for (const id of ['bmi', 'energy', 'macro', 'water', 'peak', 'run', 'stairkcal', 'project', 'score', 'fv', 'gravity', 'sleep', 'nutrients', 'ppg', 'recovery']) assert.ok(used.has(id), id + ' is linked from its "?"');
  for (const id of used) assert.ok(have.includes(id), 'not a Vault calculation: ' + id);
  assert.deepEqual(errors, []); await ctx.close();
});

test('BMI "?" links to its own Vault entry; the entry is open, marked and focused; the way back returns to Body', async () => {
  const { page, ctx, errors } = await openApp({ seed: ADULT });
  await go(page, 'body');
  await openHelp(page, 'xbmi');
  const link = page.locator('#hwh-pop .hwev a');
  assert.equal(await link.count(), 1);
  assert.match(await link.getAttribute('aria-label'), /Evidence Vault: Body mass index/);
  assert.equal(await link.getAttribute('href'), '#vault=bmi');
  await link.focus(); await page.keyboard.press('Enter');
  await page.waitForSelector('#vc-bmi[open]');
  assert.deepEqual(await page.evaluate(() => [S.v, HWLab.Z().tab, location.hash]), ['lab', 'vault', '#vault=bmi']);
  assert.match(await page.innerText('#vc-bmi'), /OPENED FROM THE \? BUTTON[\s\S]*BMI = weight \(kg\) ÷ height \(m\)²[\s\S]*SOURCES/);
  assert.equal(await page.evaluate(() => document.activeElement.closest('#vc-bmi') !== null), true, 'focus is on the entry');
  assert.equal(await page.locator('.vtarget').count(), 1);
  await page.waitForTimeout(900);
  const top = await page.evaluate(() => document.getElementById('vc-bmi').getBoundingClientRect().top);
  assert.ok(top >= 0 && top < 400, 'the entry is in view: ' + top);
  // normal browsing still works: search filters, and a calculation can be opened beside it
  await page.fill('#vq', 'water');
  assert.ok(await page.$('#vc-water'), 'search lists the matching calculation');
  await page.fill('#vq', '');
  await page.click('[data-a="vbackto"]');
  assert.equal(await page.evaluate(() => S.v), 'body');
  assert.equal(await page.evaluate(() => location.hash), '', 'the link is cleared once the user leaves the Laboratory');
  assert.deepEqual(errors, []); await ctx.close();
});

test('Stairs workout: the "?" offers the VO₂ (project method) and the energy entries; unsaved pulse numbers survive the trip', async () => {
  const { page, ctx, errors } = await openApp({ seed: ADULT });
  await go(page, 'pulse');
  await page.fill('#wk-b', '70'); await page.fill('#wk-a', '105');
  await openHelp(page, 'stkcal');
  const links = await page.$$eval('#hwh-pop .hwev a', a => a.map(x => [x.getAttribute('href'), x.textContent]));
  assert.deepEqual(links.map(l => l[0]), ['#vault=stairkcal', '#vault=project']);
  assert.match(links[1][1], /Our project's VO₂ and energy/);
  await page.click('#hwh-pop .hwev a[href="#vault=project"]');
  await page.waitForSelector('#vc-project[open]');
  assert.match(await page.innerText('#vc-project'), /VO₂ = 15\.3 × pulse after ÷ pulse before/);
  await page.click('[data-a="vbackto"]');
  assert.equal(await page.evaluate(() => S.v), 'stair');
  assert.deepEqual(await page.evaluate(() => [HWStairs.draft.hrB, HWStairs.draft.hrA]), ['70', '105'], 'unsaved input kept');
  assert.deepEqual(errors, []); await ctx.close();
});

test('a calculation with no Vault entry says so instead of linking elsewhere', async () => {
  const { page, ctx, errors } = await openApp({ seed: ADULT });
  await go(page, 'food');
  await page.evaluate(() => document.querySelector('#main').insertAdjacentHTML('beforeend', HWHelp.btn('zz', 'A test note', '<p>x</p>', { ev: 'none' })));
  await openHelp(page, 'zz');
  assert.match(await pop(page), /Evidence entry not yet available/);
  assert.equal(await page.locator('#hwh-pop .hwev a').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('direct load and refresh of #vault=<id> open the entry; an unknown id shows a message and the normal Vault', async () => {
  const { page, ctx, errors } = await openApp({ seed: ADULT });
  await page.goto(page.url().split('#')[0] + '#vault=water');
  await page.reload();
  await page.waitForSelector('#vc-water[open]');
  assert.equal(await page.evaluate(() => [S.v, HWLab.Z().tab]).then(x => x.join()), 'lab,vault');
  await page.evaluate(() => { location.hash = '#vault=nope'; });
  await page.waitForSelector('#vwarn');
  assert.match(await page.innerText('#vwarn'), /was not found/);
  assert.ok(await page.$('.vbk'), 'the shelves are still there');
  assert.equal(await page.locator('.vtarget').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Laboratory page: plain-language intro, what / why / next for every tab, no horizontal overflow on a phone', async () => {
  const { page, ctx, errors } = await openApp({ seed: ADULT, viewport: { width: 360, height: 740 } });
  await go(page, 'lab');
  assert.match(await page.innerText('.labintro'), /not medical advice/);
  for (const k of ['exp', 'trial', 'vault', 'unc']) {
    await page.click(`[data-a="labtab"][data-k="${k}"]`);
    assert.match(await page.innerText('.labinfo'), /What it is[\s\S]*Why it matters[\s\S]*Do this first/, k);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow on ' + k);
  }
  assert.deepEqual(errors, []); await ctx.close();
});

test('sources added for the calculations that had none: real https records, linked from their "?", and the sleep ranges credit the right body', async () => {
  const { page, ctx, errors } = await openApp({ seed: ADULT });
  const r = await page.evaluate(() => ({ ids: HWSources.ids(), nsf: HWSources.get('nsf'), aasm: HWSources.get('aasm'), calc: Object.fromEntries(HWVault.CALCS.map(c => [c.id, c.src])) }));
  for (const id of ['allen', 'cole', 'hall', 'faopal', 'nsf', 'myfcd']) assert.ok(r.ids.includes(id), id);
  assert.deepEqual(r.calc.ppg, ['allen']); assert.deepEqual(r.calc.recovery, ['cole']); assert.deepEqual(r.calc.nutrients, ['fao77', 'myfcd']);
  assert.ok(r.calc.sleep.includes('nsf') && r.calc.energy.includes('faopal'));
  assert.match(r.aasm.s, /7 or more hours/); assert.match(r.nsf.s, /7–9 hours/);
  await go(page, 'sleep');
  await openHelp(page, 'sleeprange');
  assert.match(await pop(page), /National Sleep Foundation/);
  assert.doesNotMatch(await pop(page), /CDC/);
  assert.equal(await page.getAttribute('#hwh-pop .hwev a', 'href'), '#vault=sleep');
  assert.deepEqual(errors, []); await ctx.close();
});
