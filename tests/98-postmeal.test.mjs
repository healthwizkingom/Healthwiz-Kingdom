// After your meal (js/v6-postmeal.js): an optional easy-walk timer on the Nutrition page, shown within 3 hours of a logged meal, timer-only.
// Worked examples for the time maths, the card's place and wording, the timer from the clock, the conditions gate, the switch, and "nothing saved".
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';

after(closeBrowser);
const pad = n => String(n).padStart(2, '0');
const ymd = x => x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
let _id = 0;
const mealAgo = (mins, { meal = 'lunch', c = 'food' } = {}) => { const x = new Date(Date.now() - mins * 6e4);
  return { id: 'pm' + (++_id), c, v: 600, m: { name: 'Nasi lemak', por: '1 plate', qty: 1, pm: 1, meal, src: 'KOLEJ MARA KULIM' }, n: '', d: ymd(x), t: pad(x.getHours()) + ':' + pad(x.getMinutes()) }; };
const seed = (e, p = {}) => ({ ...RETURNING, p: { ...RETURNING.p, ...p }, e });
const open = async (o = {}) => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'food'); return r; };
const txt = (page, sel) => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());
// the page's clock can be moved forward, so a 10 minute walk does not need a 10 minute wait (the timer reads Date.now())
const skew = (page, ms) => page.evaluate(ms => { if (!window.__real) { window.__real = Date.now; window.__off = 0; Date.now = () => window.__real() + window.__off; } window.__off = ms; }, ms);
const SAVED = async page => { const x = await state(page); return JSON.stringify({ e: x.e, p: x.p, xp: x.xp, s: { ...x.s, pm: undefined } }); };

test('time maths: across midnight, the 3 hour edge, the future, malformed times, other categories (worked examples)', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const M = HWPostMeal, at = (y, mo, d, h, mi) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime(), now = at(2026, 11, 1, 0, 20);
    const F = (d, t, extra = {}) => ({ c: 'food', d, t, m: { meal: 'dinner', ...extra } });
    const list = [F('2026-10-31', '23:50'), F('2026-10-31', '21:20'), F('2026-10-31', '21:19'), { c: 'water', d: '2026-11-01', t: '00:10', m: {} }, F('2026-11-01', '00:30'), F('x', '10:00'), F('2026-11-01', '24:10'), F('2026-11-01', '9:5'), null, 5, { c: 'food', d: '2026-11-01', t: '00:10', m: null }];
    return { since: [M.since('2026-10-31', '23:50', now), M.since('2026-11-01', '00:20', now), M.since('2026-11-01', '00:21', now), M.since('2026-11-01', '23:59', now), M.since('nope', '10:00', now), M.since('2026-11-01', '7:05', at(2026, 11, 1, 7, 6))],
      stamp: [M.stamp('2026-11-01', '00:20') === now, M.stamp('2026-11-01', '00:20:59') === now, M.stamp('2026-02-30', '10:00') !== null, M.stamp('2026-11-01', '12:60'), M.stamp(null, null)],
      recent: M.recent(list, now), edge: [M.recent([F('2026-10-31', '21:20')], now), M.recent([F('2026-10-31', '21:19')], now)], none: [M.recent([], now), M.recent(null, now), M.recent([{ c: 'water', d: '2026-11-01', t: '00:10', m: {} }], now)],
      clock: [M.clock(600000), M.clock(59400), M.clock(9999), M.clock(-5), M.clock(NaN), M.clock(5400000)], k: [M.WIN_MIN, M.PRESETS] }; });
  assert.deepEqual(r.since, [30, 0, null, null, null, 1]);            // 23:50 → 00:20 is 30 min across midnight; a time after "now" is not "since"; 7:05 → 7:06 is 1
  assert.deepEqual(r.stamp.slice(0, 2), [true, true]);                // seconds are ignored
  assert.equal(r.stamp[3], null); assert.equal(r.stamp[4], null);     // 12:60 and null are malformed
  assert.deepEqual([r.recent.mins, r.recent.meal], [30, 'dinner']);   // the latest valid one (23:50), not the 21:20 one; the 00:30 one is in the future
  assert.deepEqual([r.edge[0] && r.edge[0].mins, r.edge[1]], [180, null]);   // exactly 180 min still shows, 181 does not
  assert.deepEqual(r.none, [null, null, null]);
  assert.deepEqual(r.clock, ['10:00', '0:59', '0:10', '0:00', '0:00', '90:00']);
  assert.deepEqual(r.k, [180, [5, 10, 15]]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the card: under the summary, only within 3 hours of a meal, neutral wording, three lengths, 10 by default', async () => {
  const { page, ctx, errors } = await open({ seed: seed([mealAgo(20)]) });
  assert.equal(await page.locator('#pm-card').count(), 1);
  const html = await page.$eval('#main', e => e.innerHTML), i = k => html.indexOf(k);
  assert.ok(i('class="nstabs"') < i('id="pm-card"') && i('id="pm-card"') < i('class="nshd"'), 'right under the calorie and water summary, before the section header');
  const t = await txt(page, '#pm-card');
  assert.match(t, /AFTER YOUR MEAL/); assert.match(t, /You logged lunch 2[0-2] min ago\./);   // the seeded time is cut to the minute, so a minute can tick over before the card is drawn
  assert.match(t, /A short easy walk or a few flights of stairs is one way to get moving after eating, if you feel like it\. There is no right amount: skip it if you feel unwell, full or tired\./);
  assert.match(t, /Stop if you feel dizzy, faint or unwell\./); assert.match(t, /Nothing here is saved, scored or counted, and it is not advice\./);
  assert.deepEqual(await page.$$eval('#pm-card [data-a="pmmins"]', b => b.map(x => [x.textContent.trim(), x.getAttribute('aria-pressed')])), [['5 MIN', 'false'], ['10 MIN', 'true'], ['15 MIN', 'false']]);
  assert.match(await txt(page, '[data-a="pmstart"]'), /START AN EASY WALK TIMER · 10 MIN/);
  await page.click('[data-a="pmmins"][data-m="15"]'); assert.match(await txt(page, '[data-a="pmstart"]'), /· 15 MIN/);
  assert.equal(await page.getAttribute('[data-a="pmmins"][data-m="15"]', 'aria-pressed'), 'true');
  const none = await open({ seed: seed([]) }), old = await open({ seed: seed([mealAgo(240)]) }), water = await open({ seed: seed([mealAgo(10, { c: 'water' })]) });
  for (const r of [none, old, water]) { assert.equal(await r.page.locator('#pm-card').count(), 0); assert.deepEqual(r.errors, []); await r.ctx.close(); }
  assert.deepEqual(errors, []); await ctx.close();
});

test('the timer comes from the clock: start, remaining time, finishing by itself, ending early; nothing is saved', async () => {
  const { page, ctx, errors } = await open({ seed: seed([mealAgo(20)]) });
  const before = await SAVED(page);
  await skew(page, 0); await page.click('[data-a="pmstart"]');
  assert.equal(await page.evaluate(() => HWPostMeal.state), 'run');
  assert.match(await txt(page, '#pm-clock'), /^(10:00|9:5\d)$/);
  assert.match(await txt(page, '#pm-card'), /An easy walk, at a pace where you could still talk/); assert.equal(await page.locator('[data-a="pmhide"]').count(), 0, 'no distractions while walking');
  await skew(page, 4 * 6e4); await page.waitForFunction(() => /^5:[0-5]\d$/.test(document.getElementById('pm-clock').textContent), null, { timeout: 4000 });
  await skew(page, 10 * 6e4 + 1000); await page.waitForFunction(() => HWPostMeal.state === 'done', null, { timeout: 4000 });
  assert.match(await txt(page, '#pm-card'), /Moved for 10:00 after your lunch\. Nothing was saved or counted\./);
  await page.click('[data-a="pmagain"]'); assert.match(await txt(page, '#pm-card'), /You logged lunch/);
  await page.click('[data-a="pmmins"][data-m="5"]'); await skew(page, 0); await page.click('[data-a="pmstart"]');
  await skew(page, 95000); await page.click('[data-a="pmstop"]');
  assert.match(await txt(page, '#pm-card'), /Moved for 1:3\d after your lunch/);      // 95 s of skew plus the second or two really elapsed
  assert.equal(await SAVED(page), before, 'entries, profile, settings and XP are untouched');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the timer keeps running if you look at another page and come back', async () => {
  const { page, ctx, errors } = await open({ seed: seed([mealAgo(20)]) });
  await skew(page, 0); await page.click('[data-a="pmstart"]'); await go(page, 'home'); await skew(page, 3 * 6e4); await go(page, 'food');
  assert.match(await txt(page, '#pm-clock'), /^[67]:\d\d$/, 'still counting down, about 7 minutes left');
  assert.deepEqual(errors, []); await ctx.close();
});

test('hidden when the conditions say stairs wait for a doctor; other conditions leave it; HIDE THIS CARD is a switch with a way back', async () => {
  const gated = await open({ seed: seed([mealAgo(20)], { conds: ['heart'] }) });
  assert.equal(await gated.page.evaluate(() => HWCond.stairsHidden()), true); assert.equal(await gated.page.locator('#pm-card').count(), 0);
  assert.deepEqual(gated.errors, []); await gated.ctx.close();
  const mild = await open({ seed: seed([mealAgo(20)], { conds: ['asthma'] }) });
  assert.equal(await mild.page.locator('#pm-card .pmhide').count(), 1, 'a condition without the doctor rule leaves the card'); await mild.ctx.close();
  const { page, ctx, errors } = await open({ seed: seed([mealAgo(20)]) });
  await page.click('[data-a="pmhide"]');
  assert.equal(await page.evaluate(() => st.s.pm), 1); assert.match(await txt(page, '#pm-card'), /The after-meal card is hidden/);
  assert.equal(await page.locator('[data-a="pmstart"]').count(), 0);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz')).s.pm), 1, 'the switch is saved');
  // a saved hidden setting is honoured on a fresh page (seeded that way: a page.reload() would race the helper's own seeding flag)
  const fresh = await open({ seed: { ...seed([mealAgo(20)]), s: { ...RETURNING.s, pm: 1 } } });
  assert.match(await txt(fresh.page, '#pm-card'), /The after-meal card is hidden/); assert.equal(await fresh.page.locator('[data-a="pmstart"]').count(), 0);
  assert.deepEqual(fresh.errors, []); await fresh.ctx.close();
  await page.click('summary:has-text("hidden")'); await page.click('[data-a="pmshow"]');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz')).s.pm), undefined, 'turned back on: the setting is gone from storage');
  assert.equal(await page.evaluate(() => 'pm' in st.s), false); assert.equal(await page.locator('[data-a="pmstart"]').count(), 1);
  assert.deepEqual(errors, []); await ctx.close();
});

test('wording and layout: no calorie, glucose or benefit talk in any state, no emoji, fits a phone', async () => {
  const { page, ctx, errors } = await open({ seed: seed([mealAgo(20)]), viewport: { width: 360, height: 780 } });
  const BAD = /glucose|sugar|insulin|GLUT4|burn|calorie|kcal|benefit|digest|earn|weight|diabet|metabol|health(y)? (boost|benefit)/i;
  const seen = [await txt(page, '#pm-card')];
  await skew(page, 0); await page.click('[data-a="pmstart"]'); seen.push(await txt(page, '#pm-card'));
  await skew(page, 95000); await page.click('[data-a="pmstop"]'); seen.push(await txt(page, '#pm-card'));
  seen.forEach(t => { assert.doesNotMatch(t, BAD, t); assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, t); });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, true, 'no sideways scroll');
  const box = await page.locator('[data-a="pmagain"]').boundingBox(); assert.ok(box.height >= 40, 'a tap-sized button');
  assert.deepEqual(errors, []); await ctx.close();
});

test('file size and registration: the module is small, loads after the Nutrition page is built, and is precached', () => {
  const f = n => fs.readFileSync(new URL('../' + n, import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(f('js/v6-postmeal.js')) < 10 * 1024, 'v6-postmeal.js is ' + Buffer.byteLength(f('js/v6-postmeal.js')));
  const html = f('index.html'); assert.ok(html.indexOf('js/v6-provisions.js') < html.indexOf('js/v6-postmeal.js')); assert.ok(f('sw.js').includes("'js/v6-postmeal.js'"));
  const src = f('js/v6-postmeal.js'); assert.doesNotMatch(src.slice(src.indexOf('/* ---------- state')), /\p{Extended_Pictographic}/u);
});
