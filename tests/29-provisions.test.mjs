// Visual redesign, session 2 (docs/ARCHITECTURE_AUDIT.md §31): Nutrition and Water as one page, the Provisions Hall.
// One Health Hall tile; the 'food' and 'water' routes are the page's two halves; the original logging, the Well of Life
// animation, saved data and every old link keep working.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const meal = (v, n, m = 'breakfast', t = '08:00') => entry('food', v, n, { name: 'Roti Canai', por: '1 piece', qty: 1, pm: 1, meal: m, src: 'KOLEJ MARA KULIM', u: 0 }, t);
const withLogs = (extra = {}) => ({ ...RETURNING, ...extra, e: [meal(560, 0), entry('water', 750, 0, {}, '09:00'), entry('water', 500, 1), meal(400, 2, 'lunch', '13:00')] });
const txt = (page, sel) => page.textContent(sel);
const tabsTop = page => page.evaluate(() => Math.round(document.querySelector('.nstabs').getBoundingClientRect().top));
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
// a new badge shows its reveal card; tap it away whenever it is in the way, as a player would
const popups = page => page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async o => { await o.click({ force: true }); });

test('one Food & Water tile opens Nutrition & Hydration: banner, title, both system cards with today, BACK', async () => {
  const { page, ctx, errors } = await openApp({ seed: withLogs() });
  await popups(page);
  await go(page, 'health');
  const tiles = await page.$$eval('#hub .hb', b => b.map(x => x.dataset.v));
  assert.deepEqual(tiles.filter(v => v === 'food' || v === 'water'), ['food'], 'one tile for both');
  assert.match(await txt(page, '#hub [data-v="food"]'), /Food & Water[\s\S]*Provisions Hall[\s\S]*Food 560 \/ 2,200 kcal[\s\S]*Water 750 \/ 2,000 mL[\s\S]*Tap to pick a food or add 250 mL/);
  await page.click('#hub [data-v="food"]');
  assert.equal(await page.evaluate(() => S.v), 'food');
  assert.equal(await txt(page, 'main h2'), 'NUTRITION & HYDRATION');
  assert.equal(await txt(page, 'main .bn b'), 'Provisions Hall');
  assert.equal(await page.locator('main .bn svg.pxi').count(), 2, 'banner shows both systems');
  assert.equal(await page.getAttribute('#nst-food', 'aria-current'), 'page');
  assert.equal(await page.getAttribute('#nst-water', 'aria-current'), null);
  assert.match(await txt(page, '#nst-food'), /Nutrition\s*560 \/ 2200 kcal\s*1 meal logged today/);
  assert.match(await txt(page, '#nst-water'), /Hydration\s*750 \/ 2000 mL\s*1250 mL to go/);
  assert.match(await txt(page, '.nshd'), /NUTRITION & CALORIES\s*\??\s*Nutrition Village\s*(RUINED|RECOVERING|DEVELOPING|THRIVING|FLOURISHING)/);
  for (const id of ['fcal', 'fmac', 'fpick', 'flog', 'fwk']) assert.equal(await page.locator('#' + id).count(), 1, id);
  assert.equal(await page.locator('#wq').count(), 0, 'one half at a time');
  assert.match(await txt(page, 'main .dis'), /KOLEJ MARA KULIM[\s\S]*Needs vary by person/, 'one footnote for both');
  await page.click('main .back');
  assert.equal(await page.evaluate(() => S.v), 'health');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('switching halves by card, GO TO button and keyboard: the cards stay put, focus follows, only the content below animates', async () => {
  const { page, ctx, errors } = await openApp({ seed: withLogs() });
  await popups(page);
  await go(page, 'food');
  // a tap, measured in one go: the page-enter slide (8 px) is stopped first, since an XP or badge redraw restarts it
  const [y0, y1] = await page.evaluate(() => { document.querySelector('#main .pg').style.animation = 'none';
    const y = () => document.querySelector('.nstabs').getBoundingClientRect().top, a = y(); document.querySelector('#nst-water').click(); return [a, y()]; });
  assert.equal(await page.evaluate(() => S.v), 'water');
  assert.equal(await page.locator('#wq').count(), 1, 'the Well of Life is here');
  assert.equal(await page.locator('#fpick').count(), 0);
  assert.equal(await page.getAttribute('#nst-water', 'aria-current'), 'page');
  assert.ok(Math.abs(y1 - y0) <= 1, `system cards stay put: ${y0} → ${y1}`);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'nst-water', 'focus on the chosen card');
  const anim = await page.evaluate(() => ({ pg: getComputedStyle(document.querySelector('#main .pg')).animationName, below: getComputedStyle(document.querySelector('.nshd')).animationName }));
  assert.deepEqual(anim, { pg: 'none', below: 'trw' }, 'the page stays, the water section wipes in as the water page did');
  // from the bottom of a long half, GO TO brings the cards back into view
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.click('.nsgo');
  assert.equal(await page.evaluate(() => S.v), 'food');
  const top = await tabsTop(page);
  assert.ok(top >= 0 && top <= 80, 'cards back in view: ' + top);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'nst-food');
  await page.focus('#nst-water');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => S.v), 'water', 'keyboard switch');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'nst-water');
  await page.click('#nst-water');                                  // the open half: nothing happens
  assert.equal(await page.evaluate(() => S.v), 'water');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('nutrition logging on the merged page: search, pick, servings, add; meters, log and Market Kitchen card', async () => {
  const { page, ctx, errors } = await openApp();
  await popups(page);
  await go(page, 'food');
  await page.fill('#q', 'roti canai');
  await page.click('#fl .it');
  await page.click('[data-a="qp"]');
  await page.click('[data-a="addfood"]');
  const e = (await state(page)).e.filter(x => x.c === 'food');
  assert.equal(e.length, 1);
  assert.equal(e[0].m.name, 'Roti Canai');
  assert.equal(e[0].v, 560, 'two servings of 280 kcal');
  assert.match(await txt(page, '#nst-food'), /560 \/ 2200 kcal\s*1 meal logged today/);
  assert.match(await txt(page, '#fcal'), /Calories consumed\s*560/);
  assert.match(await txt(page, '#flog'), /Roti Canai/);
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return [h.indexOf('id="flog"'), h.indexOf('id="fwk"'), h.indexOf('v6gl-food')]; });
  assert.ok(order[0] < order[1] && order[2] < 0, 'the food log comes before the 7-day log; the Market Kitchen card is gone');
  assert.equal(await page.evaluate(() => S.v), 'food');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('water logging on the merged page: the Well of Life plays, both meters update, graph, reminder, Well Garden card', async () => {
  const { page, ctx, errors } = await openApp();
  await popups(page);
  await go(page, 'water');
  await page.click('[data-a="wa"][data-v="250"]');
  assert.equal((await state(page)).e.filter(x => x.c === 'water')[0].v, 250);
  await page.waitForSelector('#wqch.walk', { timeout: 3000 });     // the hero walks to the spring: the well animation, not the fallback
  await page.waitForSelector('.fl2', { timeout: 8000 });
  await page.waitForFunction(() => /250 \/ 2000 mL/.test(document.querySelector('#nst-water').textContent), null, { timeout: 12000 });
  assert.match(await txt(page, '#main'), /250 \/ 2000 mL[\s\S]*1750 mL to go/);
  await page.click('[data-a="wgr"][data-g="m"]');
  assert.equal(await page.evaluate(() => S.wg), 'm');
  await page.selectOption('#wre', '60');
  await page.click('[data-a="wrems"]');
  assert.equal((await state(page)).s.wrem, 60);
  assert.equal(await page.inputValue('#wre'), '60');
  assert.equal(await page.locator('#v6gl-water').count(), 0, 'the Well Garden card is gone');
  assert.equal(await page.locator('#wq .v6wqr').count(), 1, 'living well scenery still drawn');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('saved data shows unchanged on both halves, survives a reload, and nothing else in storage changes', async () => {
  const seed = withLogs({ s: { ...RETURNING.s, kcal: 1800, water: 2500, wrem: 120 } });
  const other = { healthwiz_runs: JSON.stringify({ ok: 0, runs: [], del: [] }), another_app: 'keep me' };
  const { page, ctx, errors } = await openApp({ seed, before: p => p.addInitScript(x => { if (!sessionStorage.getItem('x')) { for (const k in x) localStorage.setItem(k, x[k]); sessionStorage.setItem('x', '1'); } }, other) });
  await popups(page);
  for (let round = 0; round < 2; round++) {
    await go(page, 'food');
    assert.match(await txt(page, '#nst-food'), /560 \/ 1800 kcal/);
    assert.match(await txt(page, '#flog'), /Roti Canai/);
    await page.click('#nst-water');
    assert.match(await txt(page, '#nst-water'), /750 \/ 2500 mL/);
    assert.equal(await page.inputValue('#wre'), '120');
    const s = await state(page);
    assert.deepEqual(s.e, seed.e, 'entries exactly as saved');
    assert.deepEqual([s.s.kcal, s.s.water, s.s.wrem], [1800, 2500, 120]);
    for (const k in other) assert.equal(await page.evaluate(k => localStorage.getItem(k), k), other[k], k);
    await page.reload();
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('old Nutrition/Water routes and links never break: go(), Home, kingdom map, region panel, quests, tutorial', async () => {
  const { page, ctx, errors } = await openApp({ seed: withLogs() });
  await popups(page);
  for (const v of ['food', 'water']) {
    await page.evaluate(v => go(v), v);
    assert.equal(await page.evaluate(() => S.v), v);
    assert.equal(await page.evaluate(() => /HIT A SNAG/.test(document.querySelector('#main').textContent)), false);
    assert.equal(await txt(page, 'main h2'), 'NUTRITION & HYDRATION');
  }
  // every link on every page that points at food or water lands on the matching half
  const links = new Set();
  for (const v of ['home', 'health', 'quests', 'kingdom', 'guide', 'stats', 'badges', 'set', 'food', 'water']) {
    await go(page, v);
    for (const d of await page.$$eval('[data-a="go"],[data-a="kgo"]', b => b.map(x => x.dataset.v))) if (d === 'food' || d === 'water') links.add(v + '→' + d);
  }
  assert.ok(links.has('home→water') && links.has('home→food') && links.has('kingdom→water') && links.has('kingdom→food'), [...links].join());
  await go(page, 'home');
  await page.click('#tstat [data-v="water"]');
  assert.equal(await page.evaluate(() => S.v), 'water');
  await go(page, 'kingdom');
  await page.click('#kmap .kn[data-v="food"]');                // the map zooms to the region and opens its card
  await page.click('#mo [data-a="kgo"][data-v="food"]');
  assert.equal(await page.evaluate(() => S.v), 'food');
  await go(page, 'kingdom');
  await page.click('[data-a="kreg"][aria-label="Details for Water Valley"]');
  await page.click('#mo [data-a="kgo"][data-v="water"]');
  assert.equal(await page.evaluate(() => S.v), 'water');
  assert.equal(await page.locator('#mo:not([hidden])').count(), 0, 'panel closed');
  // the tutorial: its Health Hall line names one tile, and every Nutrition and Water step finds its spot on the right half
  await go(page, 'home');
  await page.evaluate(() => TUT.start());
  const seen = [];
  for (let k = 0; k < 80; k++) {
    await page.waitForTimeout(140);
    const s = await page.evaluate(() => { const r = document.getElementById('tut'); return r && { n: r.querySelector('small').textContent.split(' ·')[0], v: S.v, spot: r.querySelector('.tsp').style.display }; });
    if (!s) break;
    if (!seen.length || seen[seen.length - 1].n !== s.n) seen.push(s); else continue;
    for (let c = 0; c < 3; c++) { await page.evaluate(() => document.getElementById('tut') && document.getElementById('tut').click()); const n = await page.evaluate(() => { const r = document.getElementById('tut'); return r ? r.querySelector('small').textContent.split(' ·')[0] : null; }); if (n !== s.n) break; }
  }
  const fw = seen.filter(s => s.v === 'food' || s.v === 'water');
  assert.deepEqual(fw.map(s => s.v), ['food', 'water'], 'one Nutrition then one Water step (short tour)');
  assert.ok(fw.every(s => s.spot === 'block'), 'each step found its spot: ' + fw.map(s => s.spot).join());
  const lines = await page.evaluate(() => TS.filter(s => s[0] === 'health' || s[0] === 'food' || s[0] === 'water').map(s => s[2]));
  assert.match(lines[0], /Food & Water, Sleep/, 'Health Hall line names one Food & Water tile');
  assert.match(lines.find(l => /foods/.test(l)), /several foods[\s\S]*LOG SELECTED/);
  assert.match(lines.find(l => /Well of Life/.test(l)), /Water Quest/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('phones to desktop: both halves fit with no sideways scrolling; cards side by side on wide screens, stacked on phones', async () => {
  for (const [w, h] of [[360, 800], [390, 844], [768, 1024], [1100, 900], [1920, 1080]]) {
    const { page, ctx, errors } = await openApp({ seed: withLogs(), viewport: { width: w, height: h } });
    for (const v of ['food', 'water']) {
      await go(page, v);
      assert.ok(await overflow(page) <= 1, `${w}px ${v} overflows by ${await overflow(page)}px`);
      const L = await page.evaluate(() => { const r = s => document.querySelector(s) && document.querySelector(s).getBoundingClientRect();
        const a = r('#nst-food'), b = r('#nst-water'), c = r('#fcal'), m = r('#fmac');
        return { tabsRow: Math.abs(a.top - b.top) < 2 && a.right <= b.left, inside: a.left >= 0 && b.right <= innerWidth, side: c && m ? Math.abs(c.top - m.top) < 2 : null }; });
      assert.ok(L.tabsRow && L.inside, `${w}px ${v}: both system cards in one row on screen`);
      if (v === 'food') assert.equal(L.side, w >= 1100, `${w}px: calories and macros ${w >= 1100 ? 'side by side' : 'stacked'}`);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
