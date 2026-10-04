// RPG upgrades, part B: the Dream Battle. Sleep → strength is continuous, the battle follows it, and the scene draws.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry, state } from './helpers.mjs';

after(closeBrowser);
const night = (h, m = {}, n = 0) => entry('sleep', h, n, { bed: '23:00', wake: '07:00', aw: 1, lat: 15, rest: 3, score: 70, ...m }, '07:00');
// the five sleep levels of the brief (a 16-year-old: goal 8–10 h)
const LEVELS = [
  ['very poor', night(4, { rest: 2, aw: 3, lat: 40 })],
  ['moderately poor', night(6)],
  ['slightly insufficient', night(7.2)],
  ['adequate', night(8.5)],
  ['very good', night(9, { rest: 5, aw: 0, lat: 10 })],
];
const boot = async (e, o = {}) => {
  const r = await openApp({ seed: { ...RETURNING, e }, ...o });
  await r.page.addLocatorHandler(r.page.locator('.bpop:not(.out)').first(), async x => { await x.click({ force: true }); });
  await r.page.waitForSelector('.wl');
  return r;
};

test('strength rises gradually across the five sleep levels; only enough sleep wins', async () => {
  const { page, ctx, errors } = await boot([]);
  const r = await page.evaluate(L => L.map(([n, e]) => { const p = HWDream.strength([e], 16), b = HWDream.plan(p.s); return { n, s: p.s, win: b.win, hp: b.hp, swings: b.rounds.length }; }), LEVELS);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].s > r[i - 1].s + 0.1, `${r[i].n} (${r[i].s}) stronger than ${r[i - 1].n} (${r[i - 1].s})`);
  assert.ok(r[0].s < 0.2 && r[4].s > 0.95, 'spans the whole range: ' + r.map(x => x.s.toFixed(2)));
  assert.deepEqual(r.map(x => x.win), [false, false, false, true, true]);
  for (let i = 1; i < 3; i++) assert.ok(r[i].hp < r[i - 1].hp, 'each better night leaves the orc weaker');
  assert.ok(r[4].swings < r[3].swings, 'very good sleep wins in fewer strikes');
  // continuous, not stepped: every quarter hour changes strength, never by a jump
  const sweep = await page.evaluate(() => { const o = []; for (let h = 3; h <= 9; h += 0.25) o.push(HWDream.strength([{ id: 'x', c: 'sleep', v: h, d: '2026-10-01', t: '07:00', m: { rest: 3, aw: 1, lat: 15 } }], 16).s); return o; });
  for (let i = 1; i < sweep.length; i++) { assert.ok(sweep[i] > sweep[i - 1], 'rises at ' + (3 + i / 4) + ' h'); assert.ok(sweep[i] - sweep[i - 1] < 0.08, 'no jump at ' + (3 + i / 4) + ' h'); }
  // quality and the nights before matter too, but less than duration
  const q = await page.evaluate(() => { const e = (m, d = '2026-10-04', v = 8.5) => ({ id: d, c: 'sleep', v, d, t: '07:00', m }); const s = l => HWDream.strength(l, 16).s;
    return { good: s([e({ rest: 5, aw: 0, lat: 5 })]), bad: s([e({ rest: 1, aw: 4, lat: 90 })]), debt: s([e({}, '2026-10-02', 4), e({}, '2026-10-03', 4), e({})]), alone: s([e({})]), adult: HWDream.strength([e({}, '2026-10-04', 7.5)], 30).s }; });
  assert.ok(q.good > q.alone && q.alone > q.bad && q.good - q.bad <= 0.3 + 1e-9, JSON.stringify(q));
  assert.ok(q.debt < q.alone, 'short nights before lower it');
  assert.ok(q.adult > 0.8, 'goal follows age (adult 7.5 h is enough)');
  assert.equal(await page.evaluate(() => HWDream.strength([], 16)), null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the battle on the Sleep page plays out for each level and ends as planned', async () => {
  for (const [name, e] of LEVELS) {
    const { page, ctx, errors } = await boot([e]);
    await page.evaluate(() => { HWDream.speed = 0.05; });
    await go(page, 'sleep');
    assert.match(await page.textContent('#dbatc'), /DREAM BATTLE/);
    const want = await page.evaluate(() => { const p = HWDream.strength(LC('sleep'), st.p.age); return { s: Math.round(p.s * 100), win: HWDream.plan(p.s).win }; });
    assert.equal(await page.textContent('#dbat .db6hud .d-kn .num'), String(want.s), name + ': strength shown');
    await page.waitForSelector('#dbat.d-won, #dbat.d-lost', { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.querySelector('#dbat').classList.contains('d-won')), want.win, name);
    const hp = +(await page.textContent('#dbat .d-or .num'));
    assert.equal(hp === 0, want.win, name + ': orc HP ' + hp);
    assert.equal(await page.locator('#dbat .hwr').count(), 2, 'rigged knight and orc');
    assert.equal(await page.locator('#dbat .db6pr svg').count(), 2, 'the princess, worried and freed');
    assert.equal(await page.locator('#dbat .db6gate.d-up').count(), want.win ? 1 : 0, name + ': gate');
    assert.match(await page.textContent('#dbatc'), /not a medical measurement/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('replay, reduced motion (outcome shown still), torches light the dungeon, nothing saved', async () => {
  const { page, ctx, errors } = await boot([LEVELS[3][1]]);
  await page.evaluate(() => { HWDream.speed = 0.05; });
  const before = JSON.stringify(await state(page));
  await go(page, 'sleep');
  await page.waitForSelector('#dbat.d-won', { timeout: 8000 });
  await page.click('[data-a="dbreplay"]');
  await page.waitForSelector('#dbat.d-live', { timeout: 3000 });
  await page.waitForSelector('#dbat.d-won', { timeout: 8000 });
  assert.equal(await page.locator('#dbat .db6tg').count(), 2, 'two torch glows');
  assert.ok(await page.evaluate(() => document.querySelector('#dbat .db6tg').getAnimations().length > 0), 'flickering');
  const after = await state(page);
  assert.deepEqual(after.e, JSON.parse(before).e, 'the battle never logs anything');
  await ctx.close();

  const r = await boot([LEVELS[1][1]], { context: { reducedMotion: 'reduce' } });
  await go(r.page, 'sleep');
  assert.equal(await r.page.locator('#dbat.d-lost').count(), 1, 'outcome drawn at once');
  await r.page.waitForTimeout(800);
  assert.equal(await r.page.locator('#dbat.d-live').count(), 0, 'no battle plays');
  assert.equal(await r.page.evaluate(() => [...document.querySelectorAll('#dbat *')].filter(e => e.getAnimations().some(a => a.playState === 'running')).length), 0, 'nothing moves');
  assert.deepEqual([...errors, ...r.errors], []);
  await r.ctx.close();
});

test('no sleep logged: invites a log; fits a phone in both orientations', async () => {
  for (const viewport of [{ width: 360, height: 740 }, { width: 740, height: 360 }]) {
    const { page, ctx, errors } = await boot(viewport.width < 500 ? [] : [LEVELS[2][1]], { viewport });
    await go(page, 'sleep');
    if (viewport.width < 500) assert.match(await page.textContent('#dbatc'), /Log last night's sleep to begin/);
    const m = await page.evaluate(() => { const b = document.querySelector('#dbat').getBoundingClientRect(); return { w: document.documentElement.scrollWidth, vw: innerWidth, h: b.height, vh: innerHeight }; });
    assert.ok(m.w <= m.vw, 'no sideways scroll ' + JSON.stringify(m));
    assert.ok(m.h <= m.vh * 0.8, 'the scene leaves room on screen ' + JSON.stringify(m));
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
