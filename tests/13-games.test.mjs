import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state } from './helpers.mjs';

after(closeBrowser);
// A minimal game, registered from the test, that uses the shared pieces.
const DEMO = () => HWGames.register({
  id: 'demo', name: 'Demo Game', icon: '🎲', page: 'water', xp: 7, blurb: 'A test game.',
  before: ['<div class="card" id="wworld">'],
  finds: [['🪑', 'Bench', 'A bench.'], ['🏮', 'Lantern', 'A lantern.']],
  start(g) {
    g.stage.innerHTML = '<button class="v6gt" id="tgt" style="left:40%;top:40%">target</button>';
    const h = g.hero(20, 70, 'idle');
    let n = 0;
    const hit = () => { n++; g.status(n + '/2'); g.move(h, 60, 70, 300); if (n >= 2) g.finish({ title: 'DEMO DONE', lines: ['two hits'] }); };
    g.stage.querySelector('#tgt').onclick = hit;
    g.key(e => { if (e.key === ' ') { hit(); return true; } });
    g.button('HIT', hit);
    g.every(50, () => { window.__ticks = (window.__ticks || 0) + 1; });
  },
});
const boot = async (seed) => { const r = await openApp(seed ? { seed } : {}); await r.page.waitForSelector('.wl'); await r.page.evaluate(DEMO); await go(r.page, 'water'); return r; };

test('schema v7 adds mini-game state to older saves', async () => {
  const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, sv: 6, mg: undefined } });
  await page.waitForSelector('.wl');
  const s = await state(page);
  assert.equal(s.sv, await page.evaluate(() => HWSchema.V));
  assert.deepEqual(s.mg, { xp: {}, n: {}, h: [], c: {} });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('hub lists the registered games; stats card has a useful empty state', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl');
  await go(page, 'kingdom');
  assert.match(await page.textContent('#v6ghub'), /Well Garden/);
  await go(page, 'stats');
  assert.match(await page.textContent('#v6gstat'), /No games played yet/);
  assert.equal(await page.locator('#v6gstat [data-a="game"][data-g="water"]').count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('launch card opens the scene; app is inert; Escape leaves and restores focus', async () => {
  const { page, ctx, errors } = await boot();
  assert.equal(await page.locator('#v6gl-demo').count(), 1, 'launch card on region page');
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return h.indexOf('v6gl-demo') < h.indexOf('WORLD PROGRESSION'); });
  assert.ok(order, 'placed before the marker');
  await page.click('[data-a="game"][data-g="demo"]');
  await page.waitForSelector('.v6g[role="dialog"]');
  assert.equal(await page.evaluate(() => document.querySelector('.app').inert), true);
  assert.equal(await page.evaluate(() => HWGames.current), 'demo');
  assert.ok(await page.evaluate(() => document.querySelector('.v6g').contains(document.activeElement)), 'focus inside');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.equal(await page.evaluate(() => document.querySelector('.app').inert), false);
  assert.ok(await page.evaluate(() => HWEvents.recent('game:cancelled').length === 1));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('completion: XP and discovery once a day, replays counted, events emitted', async () => {
  const { page, ctx, errors } = await boot();
  const xp0 = (await state(page)).xp;
  await page.evaluate(() => HWGames.open('demo'));
  await page.keyboard.press('Space'); await page.click('.v6gctl button');
  await page.waitForSelector('.v6gdone');
  assert.match(await page.textContent('.v6gdone'), /DEMO DONE[\s\S]*Bench[\s\S]*\+7 XP/);
  await page.click('[data-g-again]');
  await page.waitForSelector('#tgt');
  await page.click('#tgt'); await page.click('#tgt');
  await page.waitForSelector('.v6gdone');
  assert.match(await page.textContent('.v6gdone'), /already earned/);
  assert.doesNotMatch(await page.textContent('.v6gdone'), /Lantern/);
  const s = await state(page);
  assert.equal(s.xp - xp0, 7, 'XP once a day');
  assert.equal(s.mg.n.demo, 2);
  assert.equal(s.mg.h.length, 2);
  assert.equal(s.mg.c.demo.f, 1);
  const ev = await page.evaluate(() => HWEvents.recent('game:completed').map(e => [e.id, e.xp, e.found]));
  assert.deepEqual(ev, [['demo', 7, 'Bench'], ['demo', 0, '']]);
  await page.click('.v6gdone [data-gx]');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.match(await page.textContent('#v6gl-demo'), /Today's \+7 XP earned · played 2×/);
  await go(page, 'stats');
  assert.match(await page.textContent('#v6gstat'), /Plays this week\s*2/);
  await go(page, 'kingdom');
  assert.match(await page.textContent('#v6ghub'), /Demo Game[\s\S]*played today/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('navigation closes the game and stops its timers', async () => {
  const { page, ctx, errors } = await boot();
  await page.evaluate(() => HWGames.open('demo'));
  await page.waitForTimeout(200);
  await page.evaluate(() => go('home'));
  assert.equal(await page.locator('.v6g').count(), 0);
  const t = await page.evaluate(() => window.__ticks);
  assert.ok(t > 0);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__ticks), t, 'interval stopped');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reduced motion: no transition or particles; a broken game shows a snag card', async () => {
  const { page, ctx, errors } = await boot({ ...RETURNING, s: { ...RETURNING.s, rm: 1 } });
  await page.evaluate(() => HWGames.open('demo'));
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.v6g')).animationName), 'none');
  await page.click('#tgt'); await page.click('#tgt');
  assert.equal(await page.evaluate(() => HWFX.live), 0);
  await page.evaluate(() => { HWGames.close(); HWGames.register({ id: 'bad', name: 'Bad', icon: '💥', page: 'nope', start() { throw new Error('boom'); } }); HWGames.open('bad'); });
  assert.match(await page.textContent('.v6g'), /HIT A SNAG[\s\S]*boom[\s\S]*data is untouched/);
  await page.click('.v6g [data-gx]');
  assert.equal(await page.locator('.v6g').count(), 0);
  assert.equal(errors.filter(e => !/boom/.test(e)).length, 0, errors.join('\n'));
  await ctx.close();
});

test('fits a 360 px phone without sideways scrolling', async () => {
  const { page, ctx, errors } = await openApp({ viewport: { width: 360, height: 800 } });
  await page.waitForSelector('.wl');
  await page.evaluate(DEMO);
  await page.evaluate(() => HWGames.open('demo'));
  const [sw, cw, stageW] = await page.evaluate(() => [document.querySelector('.v6gbody').scrollWidth, document.querySelector('.v6gbody').clientWidth, document.querySelector('.v6gs').getBoundingClientRect().width]);
  assert.ok(sw <= cw, sw + ' > ' + cw);
  assert.ok(stageW >= 280, 'stage ' + stageW);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Medius stays quiet during a game and reacts after it', async () => {
  const { page, ctx, errors } = await boot({ ...RETURNING, s: { ...RETURNING.s, med: 1 } });
  await page.evaluate(() => { HWMedius.rules.game.line = () => 'Nice game!'; HWGames.open('demo'); });
  await page.click('#tgt'); await page.click('#tgt');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#v6md').count(), 0, 'no bubble over the game');
  await page.click('.v6gdone [data-gx]');
  await page.waitForSelector('#v6md', { timeout: 10000 });
  assert.match(await page.textContent('#v6md'), /Nice game!/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
