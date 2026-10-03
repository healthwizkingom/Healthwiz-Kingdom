import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const nights = n => Array.from({ length: n }, (_, i) => entry('sleep', 8, i, { bed: '22:30', wake: '06:30', score: 80 }));
const seed = (n, c, extra = {}) => ({ ...RETURNING, e: nights(n), mg: { ...RETURNING.mg, c: c ? { night: c } : {} }, ...extra });
const boot = async (s, o = {}) => { const r = await openApp({ seed: s, ...o }); await r.page.waitForSelector('.wl'); await go(r.page, 'sleep'); return r; };
const play = page => page.evaluate(() => { HWGames.timeScale = 0.05; HWGames.open('night'); });
const ready = page => page.waitForFunction(() => document.querySelector('.v6nchart') && document.querySelector('.v6nslot[aria-disabled="false"]'), null, { timeout: 15000 });
// index (0–2) of the star group matching the chart, by its description (as a screen reader would)
const match = page => page.evaluate(() => { const d = document.querySelector('.v6nchart').getAttribute('aria-label').split(', ').slice(1).join(', '); return [...document.querySelectorAll('.v6nslot')].findIndex(b => b.getAttribute('aria-label').endsWith(': ' + d)); });
async function watch(page, wrongFirst = false) {
  for (let r = 0; r < 3; r++) {
    await ready(page);
    const i = await match(page);
    if (wrongFirst && r === 0) await page.keyboard.press(String(((i + 1) % 3) + 1));
    await page.keyboard.press(String(i + 1));
    if (r < 2) await page.waitForFunction(n => new RegExp('Constellation ' + n + ' / 3').test(document.querySelector('.v6gst').textContent), r + 2, { timeout: 15000 });
  }
}

test('constellations are distinct and described; a watch favours ones not charted yet', async () => {
  const { page, ctx, errors } = await boot(seed(0));
  const r = await page.evaluate(() => {
    const S = HWNight.SKY, all = S.map(s => s.n);
    HWGames.data('night').n = all.slice(1);
    return { n: S.length, names: new Set(all).size, descs: new Set(S.map(s => s.d)).size, edges: S.every(s => s.e.every(e => s.p[e[0]] && s.p[e[1]])), first: HWNight.plan()[0].n === all[0], three: new Set(HWNight.plan().map(s => s.n)).size };
  });
  assert.deepEqual([r.names, r.descs], [r.n, r.n]);
  assert.ok(r.n >= 7 && r.edges);
  assert.ok(r.first, 'the uncharted constellation comes first');
  assert.equal(r.three, 3);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Night Watch: launch card, chart, a gentle wrong guess, lanterns, atlas, XP once, no sleep logged', async () => {
  const { page, ctx, errors } = await boot(seed(3));
  assert.match(await page.textContent('#v6gl-night'), /Night Watch[\s\S]*\+10 XP once a day/);
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return h.indexOf('v6gl-night') < h.indexOf('SLEEP HISTORY'); });
  assert.ok(order, 'launch card before the sleep history');
  const s0 = await state(page);
  await play(page);
  await ready(page);
  assert.equal(await page.locator('.v6gn .v6nslot').count(), 3);
  assert.match(await page.textContent('.v6gst'), /Constellation 1 \/ 3 · find The /);
  assert.match(await page.getAttribute('.v6nchart', 'aria-label'), /^Star chart: The .+, .+/);
  const i = await match(page), w = (i + 1) % 3;
  assert.ok(i >= 0, 'one group matches the chart');
  await page.keyboard.press(String(w + 1));
  assert.match(await page.getAttribute('.v6nslot[data-i="' + w + '"]', 'aria-label'), /not this one$/);
  assert.equal(await page.getAttribute('.v6nslot[data-i="' + w + '"]', 'aria-disabled'), 'true');
  assert.match(await page.textContent('.v6gst'), /Constellation 1 \/ 3/, 'no penalty, no timer');
  await page.click('.v6nslot[data-i="' + i + '"]');
  assert.equal(await page.locator('.v6gn .v6nlamp.v6non').count(), 1, 'a lantern lights');
  assert.match(await page.getAttribute('.v6nslot[data-i="' + i + '"]', 'aria-label'), /, The .+$/, 'its name is revealed');
  await page.waitForFunction(() => /Constellation 2 \/ 3/.test(document.querySelector('.v6gst').textContent), null, { timeout: 15000 });
  for (let r = 1; r < 3; r++) { await ready(page); await page.keyboard.press(String((await match(page)) + 1)); if (r < 2) await page.waitForFunction(() => /Constellation 3 \/ 3/.test(document.querySelector('.v6gst').textContent), null, { timeout: 15000 }); }
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /A PEACEFUL WATCH[\s\S]*Charted tonight: The [^,]+, The [^,]+, The [^.]+\.[\s\S]*Star atlas: 3 of 7 constellations \(3 new tonight\)[\s\S]*Dream Realm: Developing[\s\S]*never with the hours or the score[\s\S]*Night owl[\s\S]*\+10 XP/);
  let s = await state(page);
  assert.equal(s.xp - s0.xp, 10);
  assert.equal(s.e.length, s0.e.length, 'the game never logs sleep');
  assert.equal(s.mg.c.night.n.length, 3);
  assert.deepEqual([s.mg.c.night.w, s.mg.c.night.f], [1, 1]);
  await page.click('[data-g-again]');
  await ready(page);
  assert.equal(await page.locator('.v6gn .v6nsp').filter({ has: page.locator('rect[fill="#fff6d0"][width="2"]') }).count(), 1, 'the owl keeps watch');
  await watch(page);
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /Star atlas: 6 of 7[\s\S]*already earned/);
  s = await state(page);
  assert.equal(s.xp - s0.xp, 10, 'replays give no XP');
  assert.deepEqual([s.mg.c.night.n.length, s.mg.c.night.w, s.mg.c.night.f], [6, 2, 1]);
  await page.click('.v6gdone [data-gx]');
  await page.waitForFunction(() => !document.querySelector('.v6g'));
  assert.match(await page.textContent('#v6gl-night'), /played 2× · 6 \/ 7 constellations charted/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the sky follows the Dream Realm state: clouds and dark windows when Ruined, a clear lit village later', async () => {
  for (const [n, clouds, lit] of [[0, 3, 0], [5, 0, 5]]) {
    const { page, ctx, errors } = await boot(seed(n));
    await play(page);
    const r = await page.evaluate(() => ({
      clouds: document.querySelectorAll('.v6gn .v6ncl').length,
      lit: [...document.querySelectorAll('.v6gn .v6nsp')].reduce((a, e) => a + ['--wc', '--wc2'].filter(k => /#f2c14e|#ffd76a/.test(e.style.getPropertyValue(k))).length, 0),
    }));
    assert.deepEqual([r.clouds, r.lit], [clouds, lit], n + ' nights');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('reduced motion and a 360 px phone: the watch completes and fits, no particles; a full atlas is celebrated', async () => {
  const { page, ctx, errors } = await boot(seed(5, { f: 4, n: ['The Lantern', 'The Sleeping Fox', 'The Kettle', 'The Owl\'s Eyes', 'The Little Boat'] }, { s: { ...RETURNING.s, rm: 1 } }), { viewport: { width: 360, height: 800 } });
  await play(page);
  const fits = () => page.evaluate(() => { const b = document.querySelector('.v6gbody'); return b.scrollWidth <= b.clientWidth; });
  assert.ok(await fits());
  await watch(page, true);
  await page.waitForSelector('.v6gdone', { timeout: 20000 });
  assert.match(await page.textContent('.v6gdone'), /star atlas is complete: all 7[\s\S]*Dream Realm: Thriving[\s\S]*Lore: the night keepers/);
  assert.equal(await page.evaluate(() => HWFX.live), 0);
  assert.ok(await fits());
  assert.deepEqual(errors, []);
  await ctx.close();
});
