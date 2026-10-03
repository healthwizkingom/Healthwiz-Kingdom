import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING } from './helpers.mjs';

after(closeBrowser);

const listen = page => page.evaluate(() => { window.__ev = []; HWEvents.on('*', e => window.__ev.push(e)); });
const events = (page, type) => page.evaluate(t => window.__ev.filter(e => !t || e.type === t), type);
const types = async page => (await events(page)).map(e => e.type);

test('bus: on / once / off / wildcard, and a failing listener cannot break others or the app', async () => {
  const { page, ctx } = await openApp();
  const r = await page.evaluate(() => {
    const got = [];
    const u = HWEvents.on('t:a', e => got.push('a:' + e.n));
    HWEvents.once('t:a', () => got.push('once'));
    HWEvents.on('*', e => { if (e.type.startsWith('t:')) got.push('*' + e.type); });
    HWEvents.on('t:a', () => { throw new Error('boom'); });
    HWEvents.on('t:a', () => got.push('after-throw'));
    HWEvents.emit('t:a', { n: 1 });
    u();
    HWEvents.emit('t:a', { n: 2 });
    const ev = HWEvents.recent('t:a').at(-1);
    return { got, hasTime: typeof ev.at === 'string' && ev.n === 2 };
  });
  assert.deepEqual(r.got, ['a:1', 'once', 'after-throw', '*t:a', 'after-throw', '*t:a']);
  assert.ok(r.hasTime);
  await go(page, 'water');                       // app still works
  assert.ok(await page.$('[data-a="wa"]'));
  await ctx.close();
});

test('boot: app:ready once; data:migrated for old saves', async () => {
  const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, sv: undefined } });
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => ({ ready: HWEvents.recent('app:ready'), mig: HWEvents.recent('data:migrated') }));
  assert.equal(r.ready.length, 1);
  assert.equal(r.ready[0].schema, await page.evaluate(() => HWSchema.V));
  assert.deepEqual([r.mig[0].from, r.mig[0].to], [1, await page.evaluate(() => HWSchema.V)]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('logging water: entry:added → xp:gained (cause before effect), then badge:unlocked once', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'water');
  await listen(page);
  await page.click('[data-a="wa"][data-v="250"]');
  const t = await types(page);
  assert.deepEqual(t.slice(0, 2), ['entry:added', 'xp:gained']);
  const [added] = await events(page, 'entry:added');
  assert.equal(added.entry.c, 'water');
  assert.equal(added.entry.v, 250);
  const [xp] = await events(page, 'xp:gained');
  assert.equal(xp.amount, 5);
  await go(page, 'home');                        // render → original chkB awards "First Sip"
  await go(page, 'home');                        // re-render must not re-announce
  const badges = (await events(page, 'badge:unlocked')).map(e => e.name);
  assert.ok(badges.includes('First Sip'), badges.join());
  assert.equal(badges.filter(n => n === 'First Sip').length, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('quest:completed fires once when the original awards a daily quest; level:up on threshold', async () => {
  const { page, ctx, errors } = await openApp();
  await listen(page);
  await page.evaluate(() => { add('water', 2000, {}, '', 0, 0, 5, 'Water'); go('home'); go('home'); });
  const q = await events(page, 'quest:completed');
  assert.ok(q.length >= 1, 'a quest completed');
  assert.equal(new Set(q.map(e => e.date + ':' + e.index)).size, q.length, 'no duplicates');
  assert.ok(q.every(e => e.name && e.xp > 0));
  await page.evaluate(() => { st.xp = 145; gain(10, 'test'); });
  const lv = await events(page, 'level:up');
  assert.equal(lv.at(-1).level, 2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('edit, delete, undo, page views and energy emit their events', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'pulse');
  await page.fill('#pb', '70');
  await page.click('[data-a="savepulse"]');
  await listen(page);
  await page.click('[data-a="edit"]');
  await page.fill('#ev', '75');
  await page.click('[data-a="esave"]');
  await page.click('[data-a="del"]');
  await page.click('#toasts [data-a="undo"]');
  await go(page, 'home');
  await page.click('[data-a="ener"][data-i="4"]');
  await page.click('[data-a="ener"][data-i="5"]');
  const [ed] = await events(page, 'entry:edited');
  assert.deepEqual([ed.before.v, ed.entry.v], [70, 75]);
  assert.equal((await events(page, 'entry:deleted'))[0].entry.v, 75);
  assert.equal((await events(page, 'entry:restored'))[0].entry.v, 75);
  const pv = (await events(page, 'page:viewed')).at(-1);
  assert.deepEqual([pv.from, pv.view], ['pulse', 'home']);
  const en = await events(page, 'energy:rated');
  assert.deepEqual(en.map(e => [e.value, e.first]), [[4, true], [5, false]]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('import and reset: one bulk event each, no re-announced old badges or quests', async () => {
  const { page, ctx, errors } = await openApp();
  await listen(page);
  const backup = { app: 'HealthWiz', data: { ...RETURNING, xp: 300, b: { 'First Sip': '2026-08-01' }, qx: { '2026-08-01:0': 1 },
    e: [{ id: 'w9', c: 'water', v: 500, m: {}, n: '', d: '2026-08-01', t: '09:00' }] } };
  await go(page, 'set');
  await page.click('details summary').catch(() => {});
  await page.fill('#imptx', JSON.stringify(backup));
  await page.click('[data-a="impt"]');
  await page.click('[data-a="impm"]');
  await go(page, 'home');
  const imp = await events(page, 'data:imported');
  assert.deepEqual([imp.length, imp[0].mode, imp[0].added], [1, 'merge', 1]);
  const old = (await events(page, 'badge:unlocked')).filter(e => e.name === 'First Sip');
  assert.equal(old.length, 0, 'imported badge is not announced as new');
  assert.equal((await events(page, 'quest:completed')).filter(e => e.date === '2026-08-01').length, 0);

  await go(page, 'set');
  await page.click('[data-a="rst"]');
  await page.click('[data-a="rst"]');
  assert.equal((await events(page, 'data:reset')).length, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('bus: a listener that re-emits its own event is cut off instead of freezing the page', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => {
    let n = 0; const stop = HWEvents.on('t:loop', () => { n++; HWEvents.emit('t:loop'); });
    HWEvents.emit('t:loop'); stop();
    let ok = 0; HWEvents.on('t:after', () => ok++); HWEvents.emit('t:after');
    return { n, ok };
  });
  assert.equal(r.n, 5000);
  assert.equal(r.ok, 1, 'bus keeps working afterwards');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /event loop detected/);
  await ctx.close();
});
