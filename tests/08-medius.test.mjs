import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const withMed = (m, extra = {}) => ({ ...RETURNING, s: { ...RETURNING.s, med: m }, ...extra });
const bubble = page => page.$eval('#v6md', e => e.textContent).catch(() => null);
const said = page => page.evaluate(() => HWEvents.recent('medius:said').map(e => e.kind));

test('quiet on the title screen; the daily greeting appears once the user enters', async () => {
  const { page, ctx, errors } = await openApp({ seed: withMed(2, { e: [entry('water', 250, 1)] }) });
  await page.waitForTimeout(300);
  assert.equal(await page.$('#v6md'), null, 'nothing over the title screen');
  await go(page, 'home');
  await page.waitForSelector('#v6md', { timeout: 4000 });
  assert.match(await bubble(page), /^MEDIUSGood (morning|afternoon|evening)|Still awake/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('greeting only once per day', async () => {
  const { page, ctx } = await openApp({ seed: withMed(2, { e: [entry('water', 250, 0)], md: { last: { greet: Date.now() }, day: {}, seen: {}, ms: {}, log: [] } }) });
  await go(page, 'home');
  await page.waitForTimeout(1500);
  assert.ok(!(await said(page)).includes('greet'));
  await ctx.close();
});

test('comeback after a gap: warm, no guilt', async () => {
  const { page, ctx, errors } = await openApp({ seed: withMed(1, { e: [entry('water', 250, 6)] }) });
  await go(page, 'home');
  await page.waitForSelector('#v6md', { timeout: 4000 });
  const t = await bubble(page);
  assert.match(t, /Welcome back.*6 days.*nothing was lost/);
  assert.doesNotMatch(t, /should have|missed|lazy|fail/i);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('level-up line; per-type cooldown; global gap queues lower priority', async () => {
  const { page, ctx, errors } = await openApp({ seed: withMed(2, { e: [entry('water', 250, 0)], md: { last: { greet: Date.now() }, day: {}, seen: {}, ms: {}, log: [] } }) });
  await go(page, 'home');
  await page.evaluate(() => { st.xp = 145; gain(10, 'test'); });
  await page.waitForSelector('#v6md');
  assert.match(await bubble(page), /Level 2 — thou art now a Trail Walker/);
  await page.evaluate(() => { add('water', 100, {}, '', 0, 0, 5, 'W'); add('water', 100, {}, '', 0, 0, 5, 'W'); });
  await page.waitForTimeout(200);
  const logs = await page.evaluate(() => HWMedius.history().filter(x => x.type === 'log').length + (HWEvents.recent('medius:said').length));
  assert.ok(logs >= 1);
  const accepted = await page.evaluate(() => [HWMedius.say('log', { c: 'water' }), HWMedius.say('log', { c: 'water' })]);
  assert.equal(accepted[1], false, 'cooldown blocks a second regular comment');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Calm mode skips small comments but keeps firsts; Off mode says nothing', async () => {
  let o = await openApp({ seed: withMed(1, { md: { last: { greet: Date.now() }, day: {}, seen: {}, ms: {}, log: [] } }) });
  await go(o.page, 'home');
  const r = await o.page.evaluate(() => [HWMedius.say('log', { c: 'water' }), HWMedius.say('first', { c: 'water' })]);
  assert.deepEqual(r, [false, true]);
  await o.ctx.close();
  o = await openApp({ seed: withMed(0) });
  await go(o.page, 'home');
  await o.page.evaluate(() => { st.xp = 145; gain(10, 'x'); add('pulse', 70, { st: 'Resting' }, '', 0, 0, 15, 'p'); });
  await o.page.waitForTimeout(500);
  assert.equal(await o.page.$('#v6md'), null);
  assert.deepEqual(await said(o.page), []);
  await o.ctx.close();
});

test('held back while the tutorial overlay is open', async () => {
  const { page, ctx } = await openApp({ seed: withMed(2, { md: { last: { greet: Date.now() }, day: {}, seen: {}, ms: {}, log: [] } }) });
  await go(page, 'home');
  await page.evaluate(() => { const t = document.createElement('div'); t.id = 'tut'; document.body.appendChild(t); HWMedius.say('first', { c: 'stair' }); });
  await page.waitForTimeout(300);
  assert.equal(await page.$('#v6md'), null);
  await page.evaluate(() => document.getElementById('tut').remove());
  await page.waitForSelector('#v6md', { timeout: 10000 });
  assert.match(await bubble(page), /Stair Mountain/);
  await ctx.close();
});

test('new insight and kingdom change reach Medius; settings toggle and recent words on the guide', async () => {
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const { page, ctx, errors } = await openApp({ seed: withMed(2, { e: range(1, 6).map(n => entry('stress', 8, n)), md: { last: { greet: Date.now() }, day: {}, seen: {}, ms: {}, log: [] } }) });
  await go(page, 'home');
  await page.evaluate(() => add('water', 250, {}, '', 0, 0, 5, 'W'));      // triggers insight + region change
  await page.waitForTimeout(9500);
  const types = await said(page);
  assert.ok(types.some(t => t === 'insight' || t === 'first' || t === 'kingdom'), types.join());
  await go(page, 'guide');
  assert.ok(await page.$('#v6medlog'));
  await go(page, 'set');
  await page.click('[data-a="medm"][data-m="0"]');
  assert.equal((await state(page)).s.med, 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every Medius line stays kind: no guilt, shame or diagnosis', async () => {
  const { page, ctx } = await openApp();
  const lines = await page.evaluate(() => {
    const ins = { title: 'Water lower than last week', action: 'Pair a glass with meals.' }, out = [];
    const samples = { level: { level: 3, name: 'Health Explorer' }, 'quests-all': {}, 'quest-big': { kind: 'focus', name: 'Calm breath' }, comeback: { gap: 9 }, milestone: { days: 7 }, badge: { name: 'First Sip', icon: '🥤' }, kingdom: { name: 'Water Valley', to: 'Thriving' }, insight: { insight: ins }, first: { c: 'water' }, restored: {}, 'quest-daily': { name: 'Water quest' }, greet: {} };
    for (const [k, p] of Object.entries(samples)) for (let i = 0; i < 6; i++) out.push(HWMedius.rules[k].line(p));
    for (const c of ['water', 'food', 'sleep', 'stair', 'stress', 'pulse', 'bmi']) for (let i = 0; i < 6; i++) out.push(HWMedius.rules.log.line({ c }));
    return [...new Set(out)];
  });
  assert.ok(lines.length >= 20, lines.length);
  for (const l of lines) assert.doesNotMatch(l, /lazy|disappoint|should have|you failed|shame|diagnos|disorder|bad job|not enough/i, l);
  await ctx.close();
});
