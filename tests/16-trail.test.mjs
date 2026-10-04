import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const climbs = n => Array.from({ length: n }, (_, i) => entry('stair', 120, i, { steps: 20, climbs: 6 }));
const seed = (n, f, extra = {}) => ({ ...RETURNING, e: climbs(n), mg: { ...RETURNING.mg, c: f ? { trail: { f } } : {} }, ...extra });
const boot = async (s, o = {}) => { const r = await openApp({ seed: s, ...o }); await r.page.waitForSelector('.wl'); await go(r.page, 'stair'); return r; };
const play = page => page.evaluate(() => { HWGames.timeScale = 0.05; HWGames.open('trail'); });
// waits until the hero stands at a fork (or the stairs) and nothing is moving
const ready = page => page.waitForFunction(() => { const s = document.querySelector('.v6gst'); return s && (/Stairs/.test(s.textContent) || document.querySelector('.v6tpost[aria-disabled="false"]')); }, null, { timeout: 15000 });
// index (0–2) of the path carrying today's blaze, read from the labelled controls
const right = page => page.evaluate(() => { const b = /follow the (.+)$/.exec(document.querySelector('.v6gst').textContent)[1]; return [...document.querySelectorAll('.v6gctl button')].findIndex(x => x.getAttribute('aria-label').includes(b + ' blaze')); });
async function walk(page, detour = false) {
  for (let leg = 0; leg < 3; leg++) {
    await ready(page);
    const i = await right(page);
    if (detour && leg === 0) { await page.keyboard.press(String(((i + 1) % 3) + 1)); await ready(page); }
    await page.keyboard.press(['ArrowLeft', 'ArrowUp', 'ArrowRight'][i]);
  }
  await page.waitForFunction(() => /Stairs 0 \/ 8/.test(document.querySelector('.v6gst').textContent), null, { timeout: 15000 });
  for (let k = 0; k < 8; k++) await page.keyboard.press('ArrowUp');
}

test('Adventure Trail: launch card, forks, a friendly detour, stairs, XP once, discovery, no activity logged', async () => {
  const { page, ctx, errors } = await boot(seed(3, 0));
  assert.match(await page.textContent('#v6gl-trail'), /Adventure Trail[\s\S]*\+10 XP once a day/);
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return h.indexOf('id="stlog"') < h.indexOf('v6gl-trail') && h.indexOf('v6gl-trail') < h.indexOf('id="st-run"'); });
  assert.ok(order, 'launch card after the Session Chronicle, before Running')
  const s0 = await state(page);
  await play(page);
  assert.match(await page.textContent('.v6gst'), /Checkpoint 0 \/ 4 · follow the (yellow square|red triangle|blue circle|white diamond)/);
  assert.equal(await page.locator('.v6gtr .v6tpost').count(), 3);
  const labels = await page.$$eval('.v6gctl button', b => b.map(x => x.getAttribute('aria-label')));
  assert.equal(labels.length, 3);
  labels.forEach((l, i) => assert.match(l, new RegExp('^' + ['Left', 'Ahead', 'Right'][i] + ' path, .+ blaze$')));
  // a wrong path loops back and is marked; the right one moves on
  await ready(page);
  const i = await right(page), w = (i + 1) % 3;
  await page.keyboard.press(String(w + 1));
  await ready(page);
  assert.match(await page.getAttribute('.v6tpost[data-i="' + w + '"]', 'aria-label'), /leads back here$/);
  assert.equal(await page.isDisabled('.v6gctl button >> nth=' + w), true);
  assert.match(await page.textContent('.v6gst'), /Checkpoint 0 \/ 4/, 'a detour is not progress, and not a penalty');
  await page.keyboard.press(['ArrowLeft', 'ArrowUp', 'ArrowRight'][i]);
  await page.waitForFunction(() => /Checkpoint 1 \/ 4/.test(document.querySelector('.v6gst').textContent), null, { timeout: 15000 });
  for (let leg = 1; leg < 3; leg++) { await ready(page); await page.keyboard.press(String((await right(page)) + 1)); }
  await page.waitForFunction(() => /Stairs 0 \/ 8/.test(document.querySelector('.v6gst').textContent), null, { timeout: 15000 });
  assert.match(await page.textContent('.v6gctl'), /STEP UP \(0 \/ 8\)[\s\S]*any pace is fine/);
  for (let k = 0; k < 7; k++) await page.click('.v6gctl button');
  assert.match(await page.textContent('.v6gst'), /Stairs 7 \/ 8/);
  await page.keyboard.press('ArrowUp');
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /TRAIL COMPLETE[\s\S]*all four checkpoints[\s\S]*1 friendly detour[\s\S]*Eight stone steps, \d in step[\s\S]*Stair Mountain: Developing[\s\S]*never with how far or how hard[\s\S]*Trail signposts[\s\S]*\+10 XP/);
  let s = await state(page);
  assert.equal(s.xp - s0.xp, 10);
  assert.equal(s.e.length, s0.e.length, 'the game never logs activity');
  assert.equal(s.mg.c.trail.r, 1);
  assert.equal(s.mg.c.trail.f, 1);
  await page.click('[data-g-again]');
  await page.waitForSelector('.v6gtr .v6tpost');
  assert.equal(await page.locator('.v6gtr .v6tsp').filter({ has: page.locator('rect[fill="#c98f55"][width="8"]') }).count(), 4, 'signposts at the checkpoints');
  await walk(page);
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /followed the blaze at every fork[\s\S]*already earned/);
  s = await state(page);
  assert.equal(s.xp - s0.xp, 10, 'replays give no XP');
  assert.equal(s.mg.c.trail.r, 2);
  assert.equal(s.mg.c.trail.f, 1, 'one discovery a day');
  await page.click('.v6gdone [data-gx]');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.match(await page.textContent('#v6gl-trail'), /played 2× · 2 trails walked/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the trail follows the Stair Mountain state: broken bridge and fallen log when Ruined, hikers later', async () => {
  for (const [n, ruined, hikers] of [[0, 1, 0], [5, 0, 2]]) {
    const { page, ctx, errors } = await boot(seed(n, 0));
    await play(page);
    const r = await page.evaluate(() => ({
      planks: document.querySelectorAll('.v6gtr .v6tland rect[width="2.4"]').length,
      log: [...document.querySelectorAll('.v6gtr .v6tsp')].filter(e => e.getAttribute('viewBox') === '0 0 12 4').length,
      hikers: [...document.querySelectorAll('.v6gtr .v6tsp')].filter(e => e.style.getPropertyValue('--vc')).length,
    }));
    assert.equal(r.planks, ruined ? 6 : 7, n + ' days: bridge planks');
    assert.equal(r.log, ruined, 'fallen log');
    assert.equal(r.hikers, hikers, 'hikers');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('.v6g'));
    assert.equal((await state(page)).mg.n.trail, undefined, 'leaving early is not a play');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('reduced motion and a 360 px phone: the trail completes and fits, no beat, no particles', async () => {
  const { page, ctx, errors } = await boot(seed(5, 4, { s: { ...RETURNING.s, rm: 1 } }), { viewport: { width: 360, height: 800 } });
  await play(page);
  const fits = () => page.evaluate(() => { const b = document.querySelector('.v6gbody'); return b.scrollWidth <= b.clientWidth; });
  assert.ok(await fits());
  await walk(page, true);
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /at your own pace[\s\S]*Stair Mountain: Thriving/);
  assert.doesNotMatch(await page.textContent('.v6gdone'), /in step/);
  assert.equal(await page.evaluate(() => HWFX.live), 0);
  assert.ok(await fits());
  assert.deepEqual(errors, []);
  await ctx.close();
});
