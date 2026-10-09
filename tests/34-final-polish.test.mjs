// Final polish session: the Storm Within knight's expression (js/v6-storm.js), the ambient world and the shared finish
// (js/v6-ambient.js), the new pixel icons, the badge audit (js/v6-badges.js), the tutorial and the navigation audit.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry, daysAgo } from './helpers.mjs';

after(closeBrowser);
const appErrors = errors => errors.filter(e => !/integrity/.test(e));
const boot = async (o = {}) => { const r = await openApp(o); await r.page.waitForSelector('.wl'); return r; };
const vars = (page) => page.evaluate(() => { const q = document.querySelector('#qsc .qs'), cs = getComputedStyle(q);
  return Object.fromEntries(['sv', 'lbr', 'lid', 'mc', 'tee', 'swt', 'blu', 'brd'].map(k => [k, parseFloat(cs.getPropertyValue('--' + k))])); });
async function toMeter(page) {
  await go(page, 'stress');
  await page.click('[data-a="sqs"]'); await page.click('[data-a="sqf"][data-i="2"]'); await page.click('[data-a="sqy"]');
}
const slide = (page, r) => page.evaluate(r => { const el = document.querySelector('[data-in="sqr"]'); el.value = r; el.dispatchEvent(new Event('input', { bubbles: true })); }, r);

test('Storm Within: the knight\'s face follows the rating gradually, in words too, and the slider never rebuilds him', async () => {
  const { page, ctx, errors } = await boot();
  await toMeter(page);
  assert.equal(await page.locator('#qsc .stk .hwr.rgk').count(), 1, 'the rig knight (same art) stands in the scene');
  assert.equal(await page.locator('#qsc .stk .r-hd .sf').count(), 1, 'the face layer sits inside the head part');
  assert.equal(await page.locator('#qsc .stpo svg .sf').count(), 1, 'portrait close-up');
  await page.evaluate(() => { window.__knight = document.querySelector('#qsc .stk'); });
  const seen = [];
  for (let r = 1; r <= 10; r++) {
    await slide(page, r);
    seen.push({ r, v: await vars(page), word: (await page.textContent('#qmt .st6w b')).trim(), label: await page.getAttribute('#qsc .stk', 'aria-label') });
  }
  assert.ok(await page.evaluate(() => document.querySelector('#qsc .stk') === window.__knight), 'the same knight element is kept while sliding');
  // a full render at the top of the scale keeps the scene's structure (three creatures used to swallow the knight)
  await page.click('[data-a="sqe"]');
  assert.equal(await page.locator('#qsc .qs > .stk').count(), 1, 'knight is a direct part of the scene');
  assert.equal(await page.locator('#qsc .qcr .stk, #qsc .qcr .stpo').count(), 0);
  await page.click('[data-a="rxo"][data-id="lantern"]'); await page.click('[data-a="rxb"]');
  // five bands of words, two ratings each
  assert.deepEqual(seen.map(s => s.word), ['CALM', 'CALM', 'SLIGHTLY CONCERNED', 'SLIGHTLY CONCERNED', 'TENSE', 'TENSE', 'DISTRESSED', 'DISTRESSED', 'OVERWHELMED', 'OVERWHELMED']);
  assert.match(seen[9].label, /overwhelmed/);
  // continuous, not binary: every step changes the face, and nothing jumps by more than a step's worth
  const distinct = new Set(seen.map(s => JSON.stringify(s.v)));
  assert.equal(distinct.size, 10, 'each rating gives its own expression');
  for (let i = 1; i < 10; i++) {
    const a = seen[i - 1].v, b = seen[i].v;
    assert.ok(Math.abs(b.mc - a.mc) <= 0.75, 'mouth changes gradually');
    assert.ok(Math.abs(b.lid - a.lid) <= 0.5, 'eyelids change gradually');
    assert.ok(b.brd <= a.brd, 'breathing quickens as stress rises');
    assert.ok(b.swt >= a.swt && b.blu <= a.blu, 'sweat rises and warmth fades monotonically');
  }
  assert.ok(seen[0].v.mc > 1.5 && seen[9].v.mc < -2, 'smile at calm, frown when overwhelmed');
  assert.equal(seen[0].v.tee, 0); assert.equal(seen[9].v.tee, 1, 'gritted teeth only at the top');
  assert.ok(await page.evaluate(() => document.querySelector('#qsc .qs').classList.contains('st6hi')), 'tremble and raised shield when overwhelmed');
  // transitions are CSS: the brow animates instead of snapping
  assert.match(await page.evaluate(() => getComputedStyle(document.querySelector('#qsc .stk .sfbl')).transitionDuration), /0\.7s/);
  // the storm creatures keep clear of the portrait
  const overlap = await page.evaluate(() => { const p = document.querySelector('#qsc .stpo').getBoundingClientRect();
    return [...document.querySelectorAll('#qsc .qcr')].some(c => { const r = c.getBoundingClientRect(); return r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top; }); });
  assert.equal(overlap, false);
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('Storm Within: before a rating the knight is only a little uneasy; reduced motion still shows the expression', async () => {
  const { page, ctx, errors } = await boot({ context: { reducedMotion: 'reduce' } });
  await go(page, 'stress');
  assert.match(await page.textContent('#qsc .stpo b'), /SLIGHTLY CONCERNED/);
  await toMeter(page);
  await slide(page, 10);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#qsc .stk .sfe')).animationName), 'none', 'no blinking with reduced motion');
  assert.equal((await vars(page)).tee, 1, 'the face itself still changes');
  await page.click('[data-a="sqe"]');
  assert.equal(await page.locator('#qsc .stk').count(), 1, 'the encounter keeps the knight');
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('ambient world: one layer behind the app, themed by region, hidden on the title screen, calmer in Performance mode', async () => {
  const { page, ctx, errors } = await boot();
  assert.equal(await page.evaluate(() => document.querySelector('.amb').classList.contains('amoff')), true, 'title screen has its own scene');
  const want = { home: 'meadow', food: 'water', water: 'water', sleep: 'night', stair: 'mountain', stress: 'forest', quests: 'hall', badges: 'hall', kingdom: 'hall', set: 'meadow' };
  for (const [v, th] of Object.entries(want)) {
    await go(page, v);
    const r = await page.evaluate(() => { const a = document.querySelector('.amb'), cs = getComputedStyle(a);
      return { th: a.dataset.th, off: a.classList.contains('amoff'), z: cs.zIndex, pe: cs.pointerEvents, img: getComputedStyle(a.querySelector('.amfar')).backgroundImage.slice(0, 20) }; });
    assert.equal(r.th, th, v); assert.equal(r.off, false); assert.equal(r.z, '-1'); assert.equal(r.pe, 'none');
    assert.match(r.img, /^url\("data:image\/png/, 'painted scenery');
  }
  assert.equal(await page.locator('.amb').count(), 1, 'one layer for the whole app');
  // nothing in the layer can be clicked, and the page's own buttons still work above it
  await go(page, 'health');
  await page.click('#hub [data-v="sleep"]');
  assert.equal(await page.evaluate(() => S.v), 'sleep');
  // performance mode stops most moving parts
  const moving = () => page.evaluate(() => [...document.querySelectorAll('.amb *')].filter(e => getComputedStyle(e).display !== 'none' && getComputedStyle(e).animationName !== 'none').length);
  const before = await moving();
  await page.evaluate(() => HWMotion.set('perf', 'performance'));
  const perf = await moving();
  assert.ok(perf < before, 'fewer moving parts: ' + before + ' → ' + perf);
  await page.evaluate(() => HWMotion.set('anim', 0));
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('.amb *')].filter(e => getComputedStyle(e).animationName !== 'none').length), 0, 'Animations Off stops everything');
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('new pixel icons replace the most used interface emoji; toasts are capped; badge cards are readable', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => ({
    names: HWPixel.names,
    map: ['💓', '🫀', '🏅', '🏠', '🏋️', '🎮'].map(HWPixel.forEmoji),
  }));
  for (const n of ['workout', 'pulse', 'badge', 'home', 'flame', 'star', 'mind', 'game']) assert.ok(r.names.includes(n), n);
  assert.deepEqual(r.map, ['pulse', 'pulse', 'badge', 'home', 'workout', 'game']);
  // the nav's Home emoji is now drawn from the hand-made icon, the same on every device
  await go(page, 'home');
  const homeIcon = await page.evaluate(() => { const s = document.querySelector('nav .pxe'); return s && getComputedStyle(s).backgroundImage.slice(0, 30); });
  assert.match(homeIcon, /^url\("data:image/);
  await page.evaluate(() => { for (let i = 0; i < 9; i++) toast('toast ' + i); });
  assert.equal(await page.locator('#toasts > div').count(), 3, 'at most three toasts at once');
  assert.match(await page.textContent('#toasts'), /toast 8/, 'the newest stay');
  await page.evaluate(() => { st.b['First Sip'] = today(); save(); });
  await go(page, 'badges');
  const card = await page.evaluate(() => { const c = [...document.querySelectorAll('.bd.ok')].find(x => /First Sip/.test(x.textContent));
    const sm = [...c.querySelectorAll('small')]; return { blocks: sm.map(s => getComputedStyle(s).display), bg: getComputedStyle(c).backgroundColor }; });
  assert.ok(card.blocks.every(d => d === 'block'), 'description and date on separate lines');
  assert.doesNotMatch(card.bg, /rgba\(0, 0, 0, 0\)/, 'opaque card');
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('badges: no duplicates, distinct icons, and the new running, workout and Dream Battle badges really update', async () => {
  const runs = { ok: 1, del: [], runs: [
    { id: 'r1', start: new Date(Date.now() - 864e5).toISOString(), end: new Date(Date.now() - 864e5 + 2e6).toISOString(), dist: 6200, dur: 2000, pace: 322, route: null, up: 0 },
    { id: 'r2', start: new Date().toISOString(), end: new Date(Date.now() + 1.8e6).toISOString(), dist: 4100, dur: 1500, pace: 365, route: null, up: 0 }] };
  const seed = { ...RETURNING, e: [
    entry('stair', 120, 1, { sid: 'ST03', steps: 60, climbs: 2, kind: 'workout', src: 'manual', dur: 6, hrB: 80, hrA: 130 }),
    entry('stair', 60, 2, { sid: 'ST03', steps: 60, climbs: 1, kind: 'casual', src: 'manual' }),
    entry('sleep', 8.5, 0, { bed: '22:30', wake: '07:00', aw: 0, lat: 10, rest: 5, score: 90 }, '07:00')] };
  const { page, ctx, errors } = await boot({ seed, before: p => p.addInitScript(r => { if (!sessionStorage.getItem('runs')) { localStorage.setItem('healthwiz_runs', r); sessionStorage.setItem('runs', 1); } }, JSON.stringify(runs)) });
  const r = await page.evaluate(() => {
    const names = BG.map(b => b[1]), icons = BG.map(b => b[0]);
    const prog = n => BG.find(b => b[1] === n)[3]();
    return { names, dupNames: names.filter((n, i) => names.indexOf(n) !== i), dupIcons: icons.filter((n, i) => icons.indexOf(n) !== i),
      firstRun: prog('First Run'), road: prog('Road Runner'), trial: prog('Trial of Breath'), regular: prog('Workout Regular'), dream: prog('Dream Champion') };
  });
  assert.deepEqual(r.dupNames, []);
  assert.deepEqual(r.dupIcons, [], 'every badge has its own icon');
  assert.ok(!r.names.includes('First Drop'), 'the duplicate of First Sip is retired');
  assert.deepEqual(r.firstRun, [2, 1]);
  assert.deepEqual(r.road, [10.3, 10], 'kilometres from saved runs');
  assert.deepEqual(r.trial, [1, 1], 'workouts only, not casual climbs');
  assert.deepEqual(r.regular, [1, 10]);
  assert.deepEqual(r.dream, [1, 1], 'a good night wins the Dream Battle');
  // awarded on the next render and shown in the hall
  await go(page, 'badges');
  const st = await page.evaluate(() => st.b);
  for (const n of ['First Run', 'Road Runner', 'Trial of Breath', 'Dream Champion']) assert.ok(st[n], n + ' awarded');
  assert.ok(!st['Workout Regular']);
  // the weekly activity quest counts runs as well as stair sessions
  const wk = await page.evaluate(() => { const q = HWQuests.WEEK['w-stair'], D = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return ymd(d); });
    return { text: q.text(2), withRuns: q.count(D), stairs: D.reduce((s, d) => s + A('stair', d).length, 0) }; });
  assert.match(wk.text, /stair sessions or runs/);
  assert.equal(wk.withRuns, wk.stairs + 2);
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('tutorial: every step points at something on the current pages, and it explains the current system', async () => {
  const { page, ctx, errors } = await boot({ seed: { ...RETURNING, e: [entry('water', 250, 0), entry('sleep', 7.5, 0, { bed: '23:00', wake: '06:30', aw: 0, lat: 10, rest: 4, score: 80 })] } });
  const n = await page.evaluate(() => TS.length);
  const missing = [];
  for (let i = 0; i < n; i++) {
    const r = await page.evaluate(async i => { const s = TS[i]; go(s[0]); await new Promise(r => setTimeout(r, 80)); const t = s[1];
      if (!t) return null; const el = t[0] === '~' ? [...document.querySelectorAll('main .card,main .snap,main .wq,main .hub,main header')].find(e => e.textContent.includes(t.slice(1))) : document.querySelector(t);
      return el && el.getBoundingClientRect().width ? null : s[0] + ' ' + t; }, i);
    if (r) missing.push(r);
  }
  assert.deepEqual(missing, []);
  const text = await page.evaluate(() => TS.map(s => s[2]).join('\n'));
  assert.match(text, /Running Road/); assert.match(text, /Storm Within/); assert.match(text, /Water Quest/); assert.match(text, /Food & Water/);
  assert.doesNotMatch(text, /Pulse page|Nutrition tile|Water tile|Running tile/i, 'no retired pages');
  assert.ok(await page.evaluate(() => TS.every(s => pages[s[0]])), 'every step opens a real page');
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('navigation audit: every action exists, every route is a real page, every page fits four device sizes', async () => {
  const { page, ctx, errors } = await boot({ seed: { ...RETURNING, e: [entry('water', 250, 0), entry('stress', 6, 0, { feel: 'ok', end: 4, why: [], tech: [] })] } });
  const views = ['home', 'health', 'food', 'water', 'sleep', 'stair', 'stress', 'bmi', 'calc', 'stats', 'quests', 'badges', 'guide', 'kingdom', 'set'];
  const bad = [];
  for (const v of views) {
    await go(page, v);
    bad.push(...await page.evaluate(v => [...document.querySelectorAll('[data-a]')].flatMap(b => {
      const a = b.dataset.a; if (!acts[a]) return [v + ': no action ' + a];
      if (['go', 'kgo'].includes(a) && b.dataset.v !== 'tut' && !pages[b.dataset.v]) return [v + ': no page ' + b.dataset.v];
      return []; }), v));
  }
  assert.deepEqual(bad, []);
  for (const vp of [{ width: 360, height: 740 }, { width: 740, height: 360 }, { width: 820, height: 1180 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(vp);
    for (const v of views) {
      await go(page, v);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, v + ' overflows sideways at ' + vp.width + '×' + vp.height + ' by ' + over);
    }
  }
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('Kingdom map: every region shows its pixel icon (the label style no longer covers it); Sleep has no fall-asleep card', async () => {
  const { page, ctx, errors } = await boot({ context: { colorScheme: 'dark' } });
  for (const view of ['kingdom', 'home']) {
    await go(page, view);
    await page.waitForTimeout(100);
    const icons = await page.evaluate(() => [...document.querySelectorAll('.kn .ki')].map(k => { const e = k.querySelector('.pxe'), cs = e && getComputedStyle(e);
      return e ? { img: /^url\("data:image/.test(cs.backgroundImage), border: cs.borderTopWidth, w: e.getBoundingClientRect().width } : null; }));
    assert.equal(icons.length, 8, view);
    for (const i of icons) { assert.ok(i && i.img, view + ': icon picture drawn'); assert.equal(i.border, '0px'); assert.ok(i.w >= 16); }
  }
  await go(page, 'sleep');
  assert.doesNotMatch(await page.textContent('#main'), /TIME TO FALL ASLEEP|Keep it gentle/);
  assert.equal(await page.locator('.sstg').count(), 0);
  assert.equal(await page.locator('#sll').count(), 1, 'minutes to fall asleep is still logged with the night');
  assert.deepEqual(appErrors(errors), []);
  await ctx.close();
});

test('service worker: app files are revalidated with the server, so an update shows on the next visit (not 10 minutes later)', async () => {
  const fs = await import('node:fs');
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const body = sw.slice(sw.indexOf('function networkFirst'), sw.indexOf('async function staleWhileRevalidate'));
  assert.match(body, /fetch\(req, \{ cache: 'no-cache' \}\)/);
});
