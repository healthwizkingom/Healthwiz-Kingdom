import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBrowser, closeBrowser, APP_URL, state, go } from './helpers.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Opens the app with an exact raw localStorage value (string), tutorial marked seen.
async function openRaw(raw) {
  const ctx = await (await getBrowser()).newContext();
  await ctx.route(/^https?:/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(r => { if (!sessionStorage.getItem('seeded')) { if (r != null) localStorage.setItem('healthwiz', r); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, raw);
  await page.goto(APP_URL);
  await page.waitForSelector('.wl');
  return { page, ctx, errors };
}
const backups = page => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('healthwiz_backup_')).sort().map(k => [k, localStorage.getItem(k)]));

// A v5.4.3 save (no `sv`) that had earned the old-named BMI badge.
const V1 = {
  b: { 'Shrine Visitor': '2026-09-01', 'First Sip': '2026-08-30', 'First Drop': '2026-08-30' }, xp: 140, claimed: {},
  e: [{ id: 'b1', c: 'bmi', v: 22.5, m: { h: 170, w: 65 }, n: '', d: '2026-09-01', t: '10:00' },
      { id: 'w1', c: 'water', v: 250, m: {}, n: '', d: '2026-08-30', t: '09:00' }],
  s: { kcal: 2200, water: 2000, sound: 0, set: 0, onb: 1 }, p: { w: 65, h: 170, age: 16, sex: 'm', act: 1.375, days: 3, goal: 'm' },
};

test('fresh install: state carries the current schema version', async () => {
  const { page, ctx, errors } = await openRaw(null);
  assert.equal(await page.evaluate(() => st.sv), await page.evaluate(() => HWSchema.V));
  assert.deepEqual(await backups(page), [], 'nothing to back up on a fresh install');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('v1 → current: badge keys renamed with their dates, no re-award, pre-upgrade copy kept', async () => {
  const raw = JSON.stringify(V1);
  const { page, ctx, errors } = await openRaw(raw);
  const st = await state(page);   // migrated data is written back immediately
  assert.equal(st.sv, await page.evaluate(() => HWSchema.V));
  assert.equal(st.b['Tower Visitor'], '2026-09-01');
  assert.equal(st.b['Shrine Visitor'], undefined);
  assert.equal(st.b['First Sip'], '2026-08-30');
  assert.equal(st.e.length, 2);
  const bk = await backups(page);
  assert.equal(bk.length, 1);
  assert.match(bk[0][0], /^healthwiz_backup_pre-v\d+_\d+$/);
  assert.equal(bk[0][1], raw, 'exact original text kept');

  await go(page, 'badges');
  const xp = await page.evaluate(() => st.xp);
  assert.equal(xp, 140, 'renamed badge is not awarded again');
  assert.match(await page.textContent('#main'), /Tower Visitor/);
  assert.match(await page.textContent('#main'), /2026-09-01/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('unreadable saved data: app starts fresh, raw text kept, user told', async () => {
  const { page, ctx, errors } = await openRaw('{"e":[{"id":1, broken');
  assert.equal(await page.evaluate(() => st.e.length), 0);
  const bk = await backups(page);
  assert.equal(bk.length, 1);
  assert.match(bk[0][0], /unreadable/);
  assert.equal(bk[0][1], '{"e":[{"id":1, broken');
  await page.waitForFunction(() => /could not be read/.test(document.querySelector('#toasts').textContent), null, { timeout: 3000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('damaged shapes are repaired without dropping valid entries', async () => {
  const bad = { ...V1, sv: 2, s: 'oops', xp: -5, en: [1, 2], e: [V1.e[0], null, { c: 'water', v: 100, d: '2026-09-02', t: '08:00' }] };
  const { page, ctx, errors } = await openRaw(JSON.stringify(bad));
  const st = await state(page);
  assert.equal(st.e.length, 2, 'the null entry is dropped, the two real ones kept');
  assert.ok(st.e[1].id, 'missing id generated');
  assert.equal(st.s.kcal, 2200);
  assert.equal(st.xp, 0);
  assert.deepEqual(st.en, {});
  assert.match((await backups(page))[0][0], /repaired/);
  await go(page, 'home');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('data from a newer app version is kept, not upgraded or overwritten', async () => {
  const newer = { ...V1, sv: 99 };
  const { page, ctx, errors } = await openRaw(JSON.stringify(newer));
  assert.equal(await page.evaluate(() => st.sv), 99);
  assert.match((await backups(page))[0][0], /newer/);
  await page.waitForFunction(() => /newer version/.test(document.querySelector('#toasts').textContent), null, { timeout: 3000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('restoring an old backup migrates it; a newer backup is refused with a clear message', async () => {
  const { page, ctx, errors } = await openRaw(JSON.stringify({ ...V1, sv: 2, b: {}, e: [] }));
  await go(page, 'set');
  await page.click('#bkp details summary').catch(() => {});
  await page.fill('#imptx', JSON.stringify({ app: 'HealthWiz', ver: '5.3', data: V1 }));
  await page.click('[data-a="impt"]');
  await page.click('[data-a="impm"]');
  let st = await state(page);
  assert.equal(st.b['Tower Visitor'], '2026-09-01');
  assert.equal(st.b['Shrine Visitor'], undefined);
  assert.equal(st.e.length, 2);

  await go(page, 'set');
  await page.click('#bkp details summary').catch(() => {});
  await page.fill('#imptx', JSON.stringify({ app: 'HealthWiz', data: { ...V1, sv: 99 } }));
  await page.click('[data-a="impt"]');
  assert.match(await page.textContent('#impo'), /newer version of HealthWiz/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('rename: no "Temple" or "Shrine" left in the app outside the migration map', () => {
  for (const f of fs.readdirSync(path.join(root, 'js'))) {
    if (f === 'v6-schema.js') continue;
    const hits = fs.readFileSync(path.join(root, 'js', f), 'utf8').match(/.{0,30}\b(Temple|Shrine)\b.{0,30}/g);
    assert.equal(hits, null, f + ': ' + hits);
  }
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /\b(Temple|Shrine)\b/);
});

test('renamed places appear in the UI', async () => {
  const { page, ctx, errors } = await openRaw(JSON.stringify({ ...V1, sv: 2 }));
  await go(page, 'kingdom');
  const t = await page.textContent('#main');
  assert.match(t, /Heartstone Hall/);
  assert.match(t, /Balance Tower/);
  await go(page, 'pulse');
  assert.match(await page.textContent('#main'), /Heartstone Hall/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
