// Visual foundation, session 1 (docs/ARCHITECTURE_AUDIT.md §30): no decorative hearts at the top of any page, the
// pixel-art standard and its icons (js/v6-pixel.js), the navigation audit, and saved data left exactly as it was.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const HEALTH = ['food', 'water', 'sleep', 'stair', 'stress', 'bmi', 'calc', 'stats']; // 'pulse' and 'run' open sections of 'stair'
const OTHER = ['health', 'quests', 'guide', 'badges', 'kingdom', 'set'];
const REQUIRED = ['heart', 'water', 'food', 'sleep', 'stairs', 'running', 'stress', 'energy', 'achievement', 'warning', 'success', 'wizard', 'monster'];
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
// a new badge shows its reveal card; tap it away whenever it is in the way, as a player would
// The test network stub serves Leaflet (Running page map) as an empty file; the browser's SRI check rejects it and the
// page draws its plain route trace instead. That message is the only one ignored.
const appErrors = errors => errors.filter(e => !/integrity/.test(e));
const popups = page => page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async o => { await o.click({ force: true }); });

test('no decorative hearts at the top of any page; the title, level bar and region banner stay', async () => {
  const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, e: [entry('pulse', 72, 0, { st: 'Resting' })] } });
  for (const v of [...HEALTH, ...OTHER]) {
    await go(page, v);
    const top = await page.evaluate(() => {
      const h = document.querySelector('main header'), b = document.querySelector('main .bn');
      return { hearts: document.querySelectorAll('main header .hrts, main header img.px:not(.av), main .bn .hs, main .bn img.px').length,
        note: /no hearts lost/.test(h.textContent), h1: h.querySelector('h1').textContent, tag: h.textContent.includes('Your Health. Your Quest.'),
        bar: !!h.querySelector('.lv .bar'), lv: /^Lv \d+ · /.test(h.querySelector('.lv b').textContent),
        title: b.querySelector('b').textContent, want: BN[S.v][1], icon: b.firstElementChild.querySelectorAll('svg.pxi').length, h2: !!document.querySelector('main h2') };
    });
    assert.equal(top.hearts, 0, v + ': no hearts in the header or banner');
    assert.equal(top.note, false, v + ': the "no hearts lost" note went with them');
    assert.equal(top.h1, 'HEALTHWIZ', v);
    assert.ok(top.tag && top.bar && top.lv && top.h2, v + ': title, tagline, level, XP bar and page heading stay');
    assert.equal(top.title, top.want, v + ': banner keeps its region name');
    assert.equal(top.icon, v === 'food' || v === 'water' ? 2 : 1, v + ': banner shows the region pixel icon (both systems on Nutrition & Hydration)');
  }
  await go(page, 'home');   // Home's hero card keeps its labelled quest hearts (n/5 quests): those carry meaning
  assert.equal(await page.locator('#pcard .hrts img.px').count(), 5);
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('heart rate lives in the stair Workout: before/after visualizations, logging, home tile, statistics', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'pulse');
  assert.equal(await page.evaluate(() => S.v), 'stair', 'the old Pulse route opens the Stairs page');
  assert.equal(await page.locator('#sthrc canvas.sttr').count(), 2, 'before and after heart rate visualizations');
  assert.doesNotMatch(await page.textContent('main'), /MEASURE PULSE/);
  await page.selectOption('#wk-loc', 'ST03');
  await page.fill('#wk-b', '68'); await page.fill('#wk-a', '112'); await page.fill('#wk-s', '10'); await page.fill('#wk-c', '2');
  await page.click('[data-a="stwsave"]');
  const s = await state(page);
  assert.equal(s.e.filter(x => x.c === 'pulse').length, 0);
  assert.deepEqual([s.e[0].m.hrB, s.e[0].m.hrA], [68, 112]);
  await go(page, 'home');
  assert.match(await page.textContent('#tstat [data-v="pulse"]'), /Heart rate[\s\S]*112/);
  await go(page, 'stats');
  assert.match(await page.textContent('main'), /Avg heart rate before workout\s*68 BPM[\s\S]*Heart rate after workout[\s\S]*avg 112 BPM/);
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('navigation audit: tabs, every Health Hall tile there and BACK again, Storm Within and Dream Battle', async () => {
  const { page, ctx, errors } = await openApp();
  await popups(page);
  await go(page, 'home');
  for (const [v, label] of [['health', 'Health'], ['quests', 'Quests'], ['kingdom', 'Kingdom'], ['set', 'Settings'], ['home', 'Home']]) {
    await page.click(`#nav [data-v="${v}"]`);
    assert.equal(await page.evaluate(() => S.v), v, label + ' tab');
    assert.equal(await page.locator('#nav button.on').getAttribute('data-v'), v);
  }
  await page.click('#nav [data-v="health"]');
  const tiles = await page.$$eval('#hub [data-a="go"]', b => b.map(x => [x.dataset.v, x.querySelector('b').textContent]));
  const names = Object.fromEntries(tiles);
  for (const [v, n] of [['food', 'Food & Water'], ['stair', 'Stairs & Workout'], ['sleep', 'Sleep'], ['stress', 'Stress']]) assert.equal(names[v], n, n + ' tile');
  assert.deepEqual([names.pulse, names.run], [undefined, undefined], 'Pulse and Running moved into the Stairs page');
  assert.equal(names.water, undefined, 'Nutrition and Water share one tile (§31)');
  for (const [v] of tiles) {
    await page.click(`#hub [data-v="${v}"]`);
    assert.equal(await page.evaluate(() => S.v), v, 'tile ' + v);
    assert.equal(await page.textContent('main .bn b'), await page.evaluate(() => BN[S.v][1]));
    await page.click('main .back');
    assert.equal(await page.evaluate(() => S.v), 'health', 'BACK from ' + v);
  }
  await go(page, 'stress');
  assert.match(await page.textContent('main'), /THE STORM WITHIN/);
  await go(page, 'sleep');
  assert.match(await page.textContent('#dbatc'), /DREAM BATTLE/);
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('pixel icons: the required set, crisp whole-pixel SVG, a full outline, accessible, emoji mapping and fallback', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => {
    const out = { names: HWPixel.names, bad: [] };
    for (const n of HWPixel.names) {
      const g = HWPixel.grid(n), d = document.createElement('div');
      if (g.length !== 16 || g.some(row => row.length !== 16)) out.bad.push(n + ': not 16×16');
      if (g.join('').split('').some(c => c !== '.' && !HWPixel.PAL[c])) out.bad.push(n + ': colour outside the palette');
      // the art keeps one free pixel at the edge, so the builder's outline is complete on every side
      const edge = g[0] + g[15] + g.map(row => row[0] + row[15]).join('');
      if (/[^.k]/.test(edge)) out.bad.push(n + ': art touches the edge');
      d.innerHTML = HWPixel.icon(n, 2);
      const s = d.firstElementChild;
      if (s.getAttribute('shape-rendering') !== 'crispEdges' || s.getAttribute('width') !== '32' || s.getAttribute('aria-hidden') !== 'true') out.bad.push(n + ': svg attributes');
    }
    const d = document.createElement('div');
    d.innerHTML = HWPixel.icon('heart', { s: 1.4, label: 'Pulse <b>' });
    out.scaled = d.firstElementChild.getAttribute('width');
    out.role = d.firstElementChild.getAttribute('role'); out.label = d.firstElementChild.getAttribute('aria-label');
    out.unknown = HWPixel.icon('nope');
    out.map = ['❤️', '💧', '🍗', '🌙', '🧗', '🏃', '🧠', '⚡', '🏆', '⚠️', '✅', '🧙', '👹', '🔥'].map(HWPixel.forEmoji);
    out.fallback = HWPixel.glyph('🔥'); out.named = /^<svg class="pxi pxi-water/.test(HWPixel.glyph('water'));
    out.canvas = /^<img class="px"/.test(spr(HWPixel.grid('heart'), HWPixel.PAL, 2));
    out.regions = Object.keys(BN).filter(k => k !== 'home').filter(k => !HWPixel.region(k) || ![].concat(HWPixel.region(k)).every(n => HWPixel.names.includes(n)));
    return out;
  });
  assert.deepEqual(REQUIRED.filter(n => !r.names.includes(n)), [], 'every required icon exists');
  assert.deepEqual(r.bad, []);
  assert.equal(r.scaled, '16', 'scales are whole numbers, so the pixel grid holds');
  assert.equal(r.role, 'img');
  assert.equal(r.label, 'Pulse <b>', 'label is escaped into an attribute');
  assert.equal(r.unknown, '');
  assert.deepEqual(r.map, ['heart', 'water', 'food', 'sleep', 'stairs', 'running', 'stress', 'energy', 'achievement', 'warning', 'success', 'wizard', 'monster', null]);
  assert.equal(r.fallback, '🔥', 'no icon: the emoji stays as it was');
  assert.ok(r.named && r.canvas);
  assert.deepEqual(r.regions, [], 'every page banner has a pixel icon');
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('saved data is left alone: every key survives boot, all pages and a reload; entries and badges unchanged', async () => {
  const seed = { ...RETURNING, xp: 420, b: { 'First Sip': '2026-09-01', 'Pulse Pathfinder': '2026-09-02' },
    e: [entry('water', 250, 2), entry('pulse', 70, 1, { st: 'Resting' }), entry('sleep', 7.5, 1, { bed: '23:00', wake: '06:30', aw: 0, lat: 10, rest: 4, score: 80 })] };
  const extra = { 'healthwiz_runs': JSON.stringify({ ok: 1, runs: [{ id: 'run1', start: '2026-09-30T07:00:00.000Z', end: '2026-09-30T07:30:00.000Z', dist: 5000, dur: 1800, pace: 360, route: null, up: 0 }], del: [] }),
    'healthwiz_board': JSON.stringify({ joined: 0 }), 'healthwiz_backup_pre-v8_1': '{"old":true}', 'another_app': 'keep me' };
  const { page, ctx, errors } = await openApp({ seed, before: p => p.addInitScript(x => { if (!sessionStorage.getItem('extra')) { for (const k in x) localStorage.setItem(k, x[k]); sessionStorage.setItem('extra', '1'); } }, extra) });
  await popups(page);
  const keys = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
  for (let round = 0; round < 2; round++) {
    for (const v of ['home', ...HEALTH, ...OTHER]) await go(page, v);
    const now = await keys();
    for (const k in extra) assert.equal(now[k], extra[k], k + ' unchanged');
    assert.equal(now.hwtut, '1');
    assert.deepEqual(Object.keys(now).filter(k => k.startsWith('healthwiz_backup_')), ['healthwiz_backup_pre-v8_1'], 'no new safety copies: nothing was migrated or repaired');
    const s = await state(page);
    assert.equal(s.sv, 8);
    assert.deepEqual(s.e, seed.e, 'entries exactly as saved');
    for (const b in seed.b) assert.equal(s.b[b], seed.b[b], b + ' keeps its date');
    assert.ok(s.xp >= seed.xp, 'XP is never lost');
    await page.reload();
  }
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('phones and desktop: header and banner fit, nothing scrolls sideways, the music button never covers the XP bar', async () => {
  for (const [w, h] of [[360, 800], [390, 844], [768, 1024], [1100, 900], [1280, 800]]) {
    const { page, ctx, errors } = await openApp({ viewport: { width: w, height: h } });
    for (const v of [...HEALTH, ...OTHER]) {
      await go(page, v);
      assert.ok(await overflow(page) <= 1, `${w}px ${v} overflows by ${await overflow(page)}px`);
      const fit = await page.evaluate(() => {
        const m = document.querySelector('#mus').getBoundingClientRect(), bar = document.querySelector('main header .bar').getBoundingClientRect(),
          bn = document.querySelector('main .bn').getBoundingClientRect(), ic = document.querySelector('main .bn svg.pxi').getBoundingClientRect();
        return { clear: m.right <= bar.left || bar.right <= m.left || m.bottom <= bar.top || bar.bottom <= m.top, inside: bn.left >= 0 && bn.right <= innerWidth, icon: ic.width };
      });
      assert.ok(fit.clear, `${w}px ${v}: the music button covers the XP bar`);
      assert.ok(fit.inside, `${w}px ${v}: banner off screen`);
      assert.equal(fit.icon, 32, 'banner icon drawn at 2× (32 px)');
    }
    assert.deepEqual(appErrors(errors), []);
    await ctx.close();
  }
});
