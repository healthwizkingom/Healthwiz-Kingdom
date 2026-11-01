// Nightly Alchemical Sync (js/v6-nightsync.js): a descriptive table for the latest night. Worked examples for the pure parts, then the card on
// the Sleep page: the caffeine range, unknown items (never zero), "at least", no totals over unknowns, and wording with no cause claim.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const txt = (page, sel) => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());
const seed = foods => ({ ...RETURNING, e: [entry('sleep', 8, 0, { bed: '23:00', wake: '07:00', aw: 0, lat: 12, rest: 3, score: 80 }, '07:00'), ...foods] });
const TEH = entry('food', 40, 1, { name: 'Teh O', caf: 40, mg: 5, trp: 3 }, '16:00');
const RICE = entry('food', 280, 1, { name: 'Nasi Putih' }, '19:30');
const boot = async s => { const r = await openApp({ seed: s }); await r.page.waitForSelector('.wl'); await go(r.page, 'sleep'); return r; };

test('residual(), bedStamp(), gather(): worked examples and bad input (worked examples)', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const N = HWNightSync, R = N.residual(40, 7), z = N.residual(40, 0), big = N.residual(40, 100), d = ms => ms && new Date(ms).toISOString().slice(0, 16);
    const at = (a, b) => { const x = N.bedStamp(a, b); return x && [new Date(x).getFullYear(), new Date(x).getMonth() + 1, new Date(x).getDate(), new Date(x).getHours(), new Date(x).getMinutes()]; };
    const day = new Date(2026, 2, 9, 12, 0).getTime(), bed = new Date(2026, 2, 9, 23, 0).getTime();
    const G = N.gather([{ c: 'food', d: '2026-03-09', t: '16:00', m: { name: 'Teh O', caf: 40, mg: 5 } }, { c: 'food', d: '2026-03-09', t: '23:30', m: { name: 'late', caf: 10 } }, { c: 'food', d: '2026-03-08', t: '22:00', m: { name: 'old', caf: 10 } },
      { c: 'food', d: '2026-03-08', t: '23:30', m: { name: 'inside', caf: 'x', mg: -3 } }, { c: 'water', d: '2026-03-09', t: '16:00', m: {} }, null, { c: 'food', d: 'bad', t: '16:00', m: {} }], bed);
    return { R: [R.lo, R.hi], z: [z.lo, z.hi], big: [big.lo < 1e-9, big.hi], bad: [N.residual(-1, 3), N.residual(NaN, 3), N.residual(40, -1), N.residual('40', 3), N.residual(null, 3)],
      eve: at('2026-03-10', '23:00'), mor: at('2026-03-10', '01:30'), e18: at('2026-03-10', '18:00'), e1759: at('2026-03-10', '17:59'), nap: [at('2026-03-10', '14:00'), at('2026-03-10', '06:00'), at('2026-03-10', '12:00')], junk: [at('x', '23:00'), at('2026-03-10', '25:00'), at('2026-03-10', ''), at('2026-03-10', null)],
      G: G.map(x => [x.name, x.mg, x.caf]), consts: [N.H_LO, N.H_HI, N.WIN_H] }; });
  assert.equal(r.R[0].toFixed(1), '6.6');                 // 40 × 0.5^(7 ÷ 2.7) = 40 × 0.1659
  assert.equal(r.R[1].toFixed(1), '24.5');                // 40 × 0.5^(7 ÷ 9.9) = 40 × 0.6126
  assert.deepEqual(r.z, [40, 40]); assert.deepEqual(r.big[0], true);
  assert.deepEqual(r.bad, [null, null, null, null, null]);
  assert.deepEqual(r.eve, [2026, 3, 9, 23, 0], 'bed at 23:00 on a morning entry is the evening before');
  assert.deepEqual(r.mor, [2026, 3, 10, 1, 30], 'bed at 01:30 is that morning');
  assert.deepEqual(r.e18, [2026, 3, 9, 18, 0]); assert.equal(r.e1759, null);
  assert.deepEqual(r.nap, [null, null, null], 'a daytime bed is not a night');
  assert.deepEqual(r.junk, [null, null, null, null]);
  assert.deepEqual(r.G, [['inside', null, null], ['Teh O', 5, 40]], 'only food in the 24 h before bed; bad amounts become unknown; a later or older meal is left out');
  assert.deepEqual(r.consts, [2.7, 9.9, 24]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('card: the range for a known caffeine amount, "at least" with unknown items, per-row "not looked up", and no total over unknowns', async () => {
  const { page, ctx, errors } = await boot(seed([TEH, RICE]));
  const c = await txt(page, '#nsync-card');
  assert.match(c, /Bed 23:00 · fell asleep after about 12 min/);
  assert.match(c, /Caffeine left at bedtime: at least 6\.6 to 24\.5 mg/);              // Teh O 40 mg, 7 h before bed
  assert.match(c, /From 1 logged item with a caffeine amount saved by Luke: Teh O 40 mg at 16:00/);
  assert.match(c, /2\.7 h and 9\.9 h/);
  const rows = await page.$$eval('#nsync-card .nsl li', rs => rs.map(r => r.innerText.replace(/\s+/g, ' ').trim()));
  assert.deepEqual(rows[0], '16:00 · Teh O Caffeine: 40 mg · Magnesium: 5 mg · Tryptophan: 3 mg');
  assert.deepEqual(rows[1], '19:30 · Nasi Putih Caffeine: not looked up · Magnesium: not looked up · Tryptophan: not looked up');
  assert.match(c, /unavailable for 1 of 2 logged items/); assert.match(c, /unknown, not zero, so no total is shown/);
  assert.match(c, /Last item logged: Nasi Putih at 19:30, 3\.5 h before bed/);
  assert.match(c, /4 to 5 hours \(range 2 to 9\)\. The project owner supplied it and it has not yet been checked in the book/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('card: all known drops "at least"; none known says unknown; no meals says so; sits above the Trance card with a worked "?" and Vault link', async () => {
  let r = await boot(seed([TEH]));
  assert.match(await txt(r.page, '#nsync-card'), /Caffeine left at bedtime: 6\.6 to 24\.5 mg/);
  assert.doesNotMatch(await txt(r.page, '#nsync-card'), /at least/); assert.doesNotMatch(await txt(r.page, '#nsync-card'), /unavailable for/);
  const order = await r.page.$eval('#main', m => [m.innerHTML.indexOf('id="nsync-card"'), m.innerHTML.indexOf('id="v6trc"')]); assert.ok(order[0] > 0 && order[1] > order[0], 'above the Trance card');
  await r.page.click('#nsync-card .hwh'); const pop = await txt(r.page, '#hwh-pop');
  assert.match(pop, /How the caffeine left at bedtime is worked out/); assert.match(pop, /40 × 0\.5\^\(7 ÷ 2\.7\) = 6\.6 mg/); assert.match(pop, /40 × 0\.5\^\(7 ÷ 9\.9\) = 24\.5 mg/);
  assert.match(pop, /ten healthy men/); assert.match(pop, /supplied by the project owner/);
  assert.equal(await r.page.getAttribute('#hwh-pop .hwev a', 'href'), '#vault=nightsync'); assert.deepEqual(r.errors, []); await r.ctx.close();
  r = await boot(seed([RICE]));
  let c = await txt(r.page, '#nsync-card');
  assert.match(c, /Caffeine left at bedtime: unknown\. No caffeine amount was saved for any of the 1 item logged/); assert.doesNotMatch(c, / mg left|6\.6/);
  assert.deepEqual(r.errors, []); await r.ctx.close();
  r = await boot(seed([]));
  c = await txt(r.page, '#nsync-card');
  assert.match(c, /unknown\. No caffeine amount was saved for any meal/); assert.match(c, /No meals were logged in the 24 hours before bed/);
  assert.deepEqual(r.errors, []); await r.ctx.close();
});

test('card: no night, no card; a daytime nap is skipped; wording has no score, advice or cause; the Vault source is blanchard83 and iom2001; files and USDA', async () => {
  let r = await boot({ ...RETURNING, e: [entry('sleep', 1, 0, { bed: '14:00', wake: '15:00' }, '15:00'), TEH] });
  assert.equal(await r.page.locator('#nsync-card').count(), 0, 'a nap is not a night');
  await r.ctx.close();
  r = await boot({ ...RETURNING, e: [TEH] }); assert.equal(await r.page.locator('#nsync-card').count(), 0, 'no sleep entry, no card'); await r.ctx.close();
  r = await boot(seed([TEH, RICE])); const c = await txt(r.page, '#nsync-card');
  assert.match(c, /DESCRIPTIVE ONLY/); assert.match(c, /Descriptive, not evidence of cause/);
  assert.doesNotMatch(c, /synergy|you should|avoid|cause[sd]? your|because of|ruin|disturb|improve|insomnia|treat/i);
  assert.doesNotMatch(c, /\d+\s*(\/|out of)\s*100|\bscore\b[^.]*\d/i, 'no score or rating number');
  const v = await r.page.evaluate(() => { const x = HWVault.CALCS.find(e => e.id === 'nightsync'); return x && { src: x.src, name: x.name }; });
  assert.deepEqual(v, { src: ['blanchard83', 'iom2001'], name: 'Caffeine left at bedtime (range)' });
  const before = await r.page.evaluate(() => JSON.stringify(st.e)); await go(r.page, 'sleep'); assert.equal(await r.page.evaluate(() => JSON.stringify(st.e)), before, 'nothing is written');
  const js = fs.readFileSync('js/v6-nightsync.js', 'utf8'); assert.ok(js.length < 64 * 1024); assert.doesNotMatch(js, /USDA/i);
  assert.ok(fs.readFileSync('sw.js', 'utf8').includes("'js/v6-nightsync.js'")); assert.ok(fs.readFileSync('index.html', 'utf8').includes('js/v6-nightsync.js'));
  assert.deepEqual(r.errors, []); await r.ctx.close();
});
