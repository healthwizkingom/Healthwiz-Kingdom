// Health Hall card pictures (js/v6-art.js), image buttons, Luke's tutorials (js/v6-luke.js) and the game logo in the header.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const seed = { ...RETURNING, s: { ...RETURNING.s, water: 2100 }, e: [entry('water', 1050, 0), entry('food', 400, 0, { name: 'Nasi lemak' })] };

test('every Health Hall card has its picture and still opens its tracker', async () => {
  const { page, ctx, errors } = await openApp({ seed });
  await page.waitForSelector('.wl'); await go(page, 'health');
  for (const k of ['food', 'sleep', 'stair', 'exercise', 'stress', 'body', 'stats', 'score']) {
    const bg = await page.$eval('#hub [data-v="' + k + '"]', b => getComputedStyle(b).backgroundImage);
    assert.ok(bg.includes('url('), k + ' has a picture');
  }
  await page.click('#hub [data-v="food"]');
  assert.equal(await page.evaluate(() => S.v), 'food', 'the tile still opens its tracker');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the five image buttons keep their action and their words', async () => {
  const { page, ctx, errors } = await openApp({ seed });
  await page.waitForSelector('.wl');
  const want = [['home', '[data-a="go"][data-v="quests"].imgbtn', /OPEN THE QUEST BOARD/], ['stats', '[data-a="tmgo0"].imgbtn', /OPEN THE TIME MACHINE/], ['stats', '[data-a="mngo"].imgbtn', /ENTER MY MONUMENT/],
    ['quests', '[data-a="labgo"].imgbtn', /ENTER THE LABORATORY/], ['quests', '[data-a="cmpgo"].imgbtn', /OPEN THE OBSERVATORY/]];
  const seen = [];
  for (const v of ['home', 'stats', 'kingdom', 'health', 'quests', 'lab', 'campus']) {
    await go(page, v);
    for (const [, sel, re] of want) { const b = page.locator('#main ' + sel); if (await b.count()) { assert.match(await b.first().textContent(), re); seen.push(sel); assert.ok((await b.first().boundingBox()).height >= 44, 'a button is at least 44 px tall'); } }
  }
  for (const [, sel] of want) assert.ok(seen.includes(sel), sel + ' was found on some page');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the header shows the game logo, and the words stay for screen readers', async () => {
  const { page, ctx, errors } = await openApp({ seed });
  await page.waitForSelector('.wl'); await go(page, 'home');
  assert.equal(await page.locator('.hbar h1 img[src*="logo"]').count(), 1);
  assert.equal((await page.textContent('.hbar h1')).trim(), 'HEALTHWIZ');
  assert.deepEqual(errors, []); await ctx.close();
});

test('Luke: a "?" button on every Health Hall section opens his tutorial; tap goes on, Esc leaves', async () => {
  const { page, ctx, errors } = await openApp({ seed, viewport: { width: 390, height: 844 } });
  await page.waitForSelector('.wl');
  for (const v of ['food', 'water', 'sleep', 'stair', 'exercise', 'stress', 'body', 'stats', 'score']) {
    await go(page, v);
    const b = page.locator('#main .lkq[data-t="' + v + '"]'); assert.equal(await b.count(), 1, v + ' has Luke\'s button');
    const r = await b.boundingBox(); assert.ok(r.width >= 40 && r.height >= 40, v + ' button is at least 40 px');
    await b.click(); await page.waitForSelector('#tut.lktut');
    assert.match(await page.textContent('#tut .tbx b'), /LUKE/);
    const n = await page.evaluate(k => HWLuke.topics.includes(k), v); assert.ok(n);
    await page.click('#tut'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#tut').count(), 0, v + ': Esc leaves the tutorial');
  }
  assert.deepEqual(errors, []); await ctx.close();
});

test('Luke\'s Statistics tutorial covers the Time Machine, the Ascent Monument, the weekly PDF and the Arena duel', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../js/v6-luke.js', import.meta.url), 'utf8');
  const stats = src.slice(src.indexOf('stats:['), src.indexOf('score:['));
  for (const re of [/Time Machine/, /Ascent Monument/, /PDF/, /Dueling Arena/]) assert.match(stats, re);
  assert.doesNotMatch(src, /\b(thou|thee|thy|hath|doth|wilt)\b/i, 'plain words, not Shakespearean');
});
