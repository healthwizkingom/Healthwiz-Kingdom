import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const seed = (e, extra = {}) => ({ ...RETURNING, e, ...extra });
const waterDown = () => [...range(8, 14).map(n => entry('water', 2000, n)), ...range(1, 7).map(n => entry('water', 1000, n))];

test('schema v2 → current adds quest state, keeping a pre-upgrade copy', async () => {
  const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, sv: 2, q6: undefined } });
  const st = await state(page);
  assert.equal(st.sv, await page.evaluate(() => HWSchema.V));
  assert.deepEqual(Object.keys(st.q6).sort(), ['f', 'w']);
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => /^healthwiz_backup_pre-v\d+_/.test(k))));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('adaptive focus: lower water than usual → personal goal between usual and target, fixed for the day', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed(waterDown()) });
  const f = await page.evaluate(() => { const q = HWQuests.focus(); return { id: q.id, t: q.t, why: q.why, desc: q.desc }; });
  assert.equal(f.id, 'water-goal');
  assert.equal(f.t, 1500);                       // (1000 usual + 2000 target) / 2
  assert.match(f.why, /below your usual/);
  assert.match(f.desc, /1500 mL/);
  // later data changes the insights, but today's focus quest stays the same
  await page.evaluate(() => { for (let i = 0; i < 6; i++) add('stress', 9, {}, '', 0, 0, 10, 'x'); });
  assert.equal(await page.evaluate(() => HWQuests.focus().id), 'water-goal');
  await go(page, 'quests');
  assert.match(await page.textContent('#v6q2'), /Personal water goal/);
  assert.match(await page.textContent('#advq2'), /\/5 QUESTS/, 'original daily quests intact');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('difficulty guard: water goal never exceeds the plan, never below 750 mL', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed(range(1, 10).map(n => entry('water', 3500, n))) });
  assert.equal(await page.evaluate(() => HWQuests.FOCUS['water-goal'].target()), 2000);
  await page.evaluate(() => { st.e = st.e.map(e => ({ ...e, v: 200 })); save(); });
  assert.equal(await page.evaluate(() => HWQuests.FOCUS['water-goal'].target()), 1100);
  await page.evaluate(() => { st.e = []; save(); });
  assert.equal(await page.evaluate(() => HWQuests.FOCUS['water-goal'].target()), 1000);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('completing the focus quest awards XP once, celebrates, emits quest:completed', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed(waterDown()) });
  await go(page, 'quests');
  const xp0 = await page.evaluate(() => st.xp);
  await page.evaluate(() => { add('water', 1500, {}, '', 0, 0, 5, 'Water'); });
  await page.waitForSelector('.v6cel');
  assert.match(await page.textContent('.v6cel'), /FOCUS QUEST COMPLETE/);
  await go(page, 'quests'); await go(page, 'home');
  const ev = await page.evaluate(() => HWEvents.recent('quest:completed').filter(e => e.kind === 'focus'));
  assert.equal(ev.length, 1);
  assert.equal(ev[0].id, 'water-goal');
  const st = await state(page);
  assert.ok(st.q6.f[Object.keys(st.q6.f)[0]].done);
  const focusXp = (await page.evaluate(() => HWEvents.recent('xp:gained').filter(e => /Focus quest/.test(e.reason)))).length;
  assert.equal(focusXp, 1);
  assert.ok(st.xp >= xp0 + 25);
  assert.match(await page.textContent('#v6q1'), /✔ \+25 XP/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('weekly quests: three, tilted to areas logged least last week; completion once', async () => {
  const lastWeek = await (async () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); return d; })();
  const daysBack = Math.round((new Date().setHours(12, 0, 0, 0) - lastWeek.setHours(12, 0, 0, 0)) / 864e5);
  const e = range(daysBack - 6, daysBack).flatMap(n => [entry('water', 1500, n), entry('sleep', 8, n, { bed: '22:30', wake: '06:30' })]);
  const { page, ctx, errors } = await openApp({ seed: seed(e) });
  const ids = await page.evaluate(() => HWQuests.weekly().map(w => w.id));
  assert.equal(ids.length, 3);
  assert.ok(!ids.includes('w-water') && !ids.includes('w-sleep'), 'well-logged areas are not picked: ' + ids);
  // completion: pin this week's quests so the check is deterministic, then finish 2 stair sessions
  await page.evaluate(() => { st.q6.w[HWQuests.wkey()].ids = ['w-stair', 'w-mind', 'w-energy']; save(); });
  await page.evaluate(() => { add('stair', 24, { climbs: 2 }, '', 0, 0, 15, 's'); add('stair', 24, { climbs: 2 }, '', 0, 0, 15, 's'); });
  await go(page, 'home'); await go(page, 'home');
  const w = await page.evaluate(() => HWEvents.recent('quest:completed').filter(e => e.kind === 'weekly' && e.id === 'w-stair'));
  assert.equal(w.length, 1);
  assert.match(await page.textContent('#v6q1'), /Mountain paths/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no notices: a gentle variety quest from a quiet area, with its reason', async () => {
  const { page, ctx, errors } = await openApp();
  const f = await page.evaluate(() => HWQuests.focus());
  assert.ok(f.id && f.name && f.xp > 0);
  assert.match(f.why, /quiet corner|variety/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
