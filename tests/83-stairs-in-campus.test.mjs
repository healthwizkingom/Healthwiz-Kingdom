// Stairs is a section of the Campus page (js/v6-campus-stairs.js), no longer a page of its own. The Health Hall card keeps its
// name, icon and place and opens the Campus page at the Stairs section, open; the Campus door shows it collapsed. The old routes
// ('stair', 'pulse') and the address #stairs land there. Every Stairs feature (tests/33-stairs works through the same routes),
// saved data, the consumers of the data and the Campus features keep working; the phone layout fits.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry, fillSteps, APP_URL } from './helpers.mjs';

after(closeBrowser);
const top = (page, sel) => page.$eval(sel, e => Math.round(e.getBoundingClientRect().top));
const dupIds = page => page.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id).filter((id, i, a) => a.indexOf(id) !== i));
const stairs = s => s.e.filter(e => e.c === 'stair');

test('the Health Hall card keeps its name, icon and place; it opens the Campus page at the open Stairs section', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'health');
  const tiles = await page.$$eval('#hub [data-v]', b => b.map(x => [x.dataset.v, x.querySelector('b').textContent]));
  assert.deepEqual(tiles.map(t => t[0]), ['food', 'sleep', 'stair', 'exercise', 'stress', 'body', 'stats', 'score'], 'same cards in the same order');
  assert.match(tiles.find(t => t[0] === 'stair')[1], /^Stairs/, 'still the Stairs card');
  assert.equal(await page.locator('#hub [data-v="stair"] .bi .pxe, #hub [data-v="stair"] .bi svg').count() > 0, true, 'its icon');
  await page.click('#hub [data-v="stair"]');
  assert.equal(await page.evaluate(() => S.v), 'campus');
  assert.equal(await page.textContent('main .bn b'), 'Campus Health Observatory');
  assert.equal(await page.textContent('#stsec-t b'), 'Stairs', 'the section is titled Stairs');
  assert.equal(await page.getAttribute('#stsec-btn', 'aria-expanded'), 'true', 'open');
  assert.ok(Math.abs(await top(page, '#stairs')) < 20, 'scrolled to the section');
  assert.equal(await page.locator('#stman, #v6gps, .sttabs').count(), 3, 'casual half: GPS check-in, hand log, the two halves');
  assert.equal(await page.locator('#cmpcard').count(), 1, 'the Observatory is on the same page');
  assert.deepEqual(await dupIds(page), [], 'no id is used twice on the merged page');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the Campus door shows the section collapsed (nothing rendered, 44 px header); the header opens and closes it; closing leaves like the old page', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'health');
  await page.evaluate(() => { window.__ev = []; ['stairs:opened', 'stairs:closed'].forEach(t => HWEvents.on(t, () => window.__ev.push(t))); });
  await page.click('[data-a="cmpgo"]');
  assert.equal(await page.getAttribute('#stsec-btn', 'aria-expanded'), 'false');
  assert.equal(await page.isHidden('#stsec-body'), true);
  assert.equal(await page.locator('#stman, #stlog, #sthrc').count(), 0, 'collapsed: none of the Stairs cards are drawn');
  assert.ok((await page.$eval('#stsec-btn', e => e.getBoundingClientRect().height)) >= 44, 'tap target');
  assert.match(await page.textContent('#stsec-btn'), /Stairs[\s\S]*0 steps today · 0 sessions in 7 days/);
  assert.ok(await page.locator('#cmpcard .cmpstage, #cmpcard #cmpnomap').count() > 0, 'the Observatory stays the top of the page');
  await page.click('#stsec-btn');
  assert.equal(await page.getAttribute('#stsec-btn', 'aria-expanded'), 'true');
  assert.equal(await page.locator('#stman').count(), 1);
  // the workout timer runs; collapsing stops the guide and keeps the time so far
  await page.click('#stt-workout'); await page.click('[data-a="pstart"]'); await page.waitForTimeout(1300);
  assert.equal(await page.evaluate(() => S.pb.on), 1);
  await page.click('#stsec-btn');
  assert.deepEqual(await page.evaluate(() => [S.pb.on, HWStairs.draft.secs >= 1, !!document.getElementById('wk-time')]), [0, true, false], 'guide stopped, time kept, card gone');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'stsec-btn', 'focus stays on the header');
  assert.deepEqual(await page.evaluate(() => window.__ev), ['stairs:opened', 'stairs:closed']);
  // a visit through the card, then away and back by the door: collapsed again
  await go(page, 'stair'); assert.equal(await page.evaluate(() => HWCampusStairs.open), true);
  await go(page, 'health'); await page.click('[data-a="cmpgo"]');
  assert.equal(await page.evaluate(() => HWCampusStairs.open), false, 'collapsed unless arriving from the Stairs card');
  assert.deepEqual(errors, []); await ctx.close();
});

test('old routes land on the Stairs section: stair, pulse (heart-rate card), and the address #stairs', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl');
  await go(page, 'pulse');
  assert.deepEqual(await page.evaluate(() => [S.v, HWCampusStairs.open]), ['campus', true]);
  assert.equal(await page.getAttribute('#stt-workout', 'aria-current'), 'page', 'Heartstone Hall opens the workout & heart-rate half');
  assert.ok(Math.abs(await top(page, '#sthrc')) < 40, 'scrolled to the heart-rate card');
  await go(page, 'stair');
  assert.equal(await page.getAttribute('#stt-casual', 'aria-current'), 'page', 'the Stairs route opens the casual half');
  await go(page, 'home');
  await page.evaluate(() => { location.hash = 'stairs'; });
  await page.waitForFunction(() => S.v === 'campus');
  assert.equal(await page.evaluate(() => HWCampusStairs.open), true, '#stairs opens the section');
  assert.ok(Math.abs(await top(page, '#stairs')) < 20);
  await go(page, 'home');
  assert.equal(await page.evaluate(() => location.hash), '', 'the address is cleaned when leaving');
  assert.deepEqual(errors, []); await ctx.close();
  // a saved link or bookmark ending in #stairs
  const b = await openApp({ url: APP_URL + '#stairs' });
  await b.page.waitForFunction(() => typeof S !== 'undefined' && S.v === 'campus');
  assert.equal(await b.page.evaluate(() => HWCampusStairs.open), true, 'opening the app at #stairs lands on the open section');
  assert.deepEqual(b.errors, []); await b.ctx.close();
});

test('every Stairs feature works inside Campus: casual climb, workout with heart rate and calories, LOG BPM, chart, chronicle edit/delete, Stair Sense, plan, study', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'stair');
  for (const sel of ['#v6gps', '#stman', '#ststudy', '#gvtrial', '#plcard', '#stlog', '.ststats', '.stgoal']) assert.equal(await page.locator(sel).count() > 0, true, sel + ' on the casual half');
  // casual climb by hand
  await page.click('[data-a="cat"][data-c="MODERATE"]'); await page.click('.sqlist .chip:has-text("penjana elektrik")');
  await fillSteps(page, '#ss', '12'); await page.fill('#sc', '2'); await page.click('[data-a="savestair"]');
  let s = await state(page), e = stairs(s)[0];
  assert.deepEqual([e.v, e.m.sid, e.m.kind, e.m.src, e.m.steps, e.m.climbs], [24, 'ST20', 'casual', 'manual', 12, 2]);
  assert.equal(await page.evaluate(() => S.v), 'campus', 'still on the same page after saving');
  assert.match(await page.textContent('#stsec-btn'), /24 steps today · 1 session in 7 days/);
  // workout half: heart rate before / after, LOG BPM, calories behind ?, seal
  await page.click('#stt-workout');
  for (const sel of ['#wk-loc', '#sthrc', '#stseal', '#sthrg', '#wk-kcal', '[data-a="pstart"]', '#st-tr-b', '#st-tr-a']) assert.equal(await page.locator(sel).count(), 1, sel);
  await page.selectOption('#wk-loc', 'ST24'); await page.click('[data-a="pace"][data-i="2"]');
  await page.fill('#wk-b', '72'); await page.click('[data-a="hrlog"][data-k="b"]');
  await page.fill('#wk-a', '130'); await fillSteps(page, '#wk-s', '30'); await page.fill('#wk-c', '3'); await page.fill('#wk-d', '8');
  await page.click('[data-a="stwsave"]');
  s = await state(page); e = stairs(s)[1];
  assert.deepEqual([e.v, e.m.kind, e.m.hrB, e.m.hrA, e.m.dur, e.m.kcal.m], [90, 'workout', 72, 130, 8, 'met+hr']);
  assert.equal(s.e.filter(x => x.c === 'pulse').length, 1, 'the logged BPM, linked to the sealed workout');
  // the consumers read the same entries
  assert.deepEqual(await page.evaluate(() => [sp(today()), hr(today()), rest(today())]), [114, 130, 72]);
  await go(page, 'home');
  assert.match(await page.textContent('#tstat'), /Heart rate\s*130[\s\S]*after workout/);
  await go(page, 'stair'); await page.click('#stlog [data-a="edit"] >> nth=0');
  assert.equal(await page.locator('[data-a="esave"]').count(), 1, 'edit opens from the chronicle');
  await page.keyboard.press('Escape');
  const n0 = stairs(await state(page)).length; await page.click('#stlog [data-a="del"] >> nth=0');
  assert.equal(stairs(await state(page)).length, n0 - 1, 'delete works from the chronicle');
  assert.deepEqual(errors, []); await ctx.close();
});

test('saved data carries over: old stair sessions and pulse entries are read and left untouched; no storage key is added or renamed', async () => {
  const old = [entry('stair', 24, 2, { sid: 'ST01', loc: 'Tangga Selangkah Menara Gading', diff: 'MILD', steps: 12, climbs: 2, dur: 5, pace: 'Easy', hrB: 70, hrA: 96 }),
    entry('stair', 40, 1, { sid: 'ST20', loc: 'Tangga sebelah rumah penjana elektrik ke Dewan Kenanga', diff: 'MODERATE', steps: 20, climbs: 2, dur: 0, pace: 'Easy', hrB: null, hrA: null, chk: 'gps' }, '09:30'),
    entry('pulse', 64, 1, { st: 'Resting' }, '07:00')];
  const seed = { ...RETURNING, e: old, b: { 'Stair Starter': '2026-01-01' } };
  const { page, ctx, errors } = await openApp({ seed });
  await page.waitForSelector('.wl');
  const keys0 = await page.evaluate(() => Object.keys(localStorage).sort());
  await go(page, 'stair');
  const txt = await page.textContent('#stlog');
  assert.match(txt, /Tangga Selangkah Menara Gading[\s\S]*WORKOUT/); assert.match(txt, /penjana elektrik[\s\S]*CASUAL[\s\S]*GPS CHECK-IN/);
  await go(page, 'pulse'); await go(page, 'health'); await page.click('[data-a="cmpgo"]'); await page.click('#stsec-btn');
  await page.reload(); await page.waitForSelector('.wl'); await go(page, 'stair');
  assert.equal(JSON.stringify((await state(page)).e), JSON.stringify(old), 'nothing in the save was rewritten');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), keys0, 'the same localStorage keys');
  assert.deepEqual(errors, []); await ctx.close();
});

test('Campus features keep working beside it: list, search, details, START STAIR SESSION opens the section, FIND / RETURN scroll to the Observatory', async () => {
  const { page, ctx, errors } = await openApp({ seed: RETURNING });
  await page.waitForSelector('.wl'); await go(page, 'health'); await page.click('[data-a="cmpgo"]');
  assert.equal(await page.locator('#cmplist .cmpitem').count(), 32);
  await page.fill('#cmpq', 'kenanga'); assert.match(await page.textContent('#cmpcount'), /Showing 3 of 32/);
  await page.click('#cmplist .cmpitem[data-id="ST20"]');
  assert.match(await page.textContent('#cmpdet'), /rise 0\.169 m/);
  await page.click('#cmpdet [data-a="cmpstair"]');
  assert.deepEqual(await page.evaluate(() => [S.v, HWStairs.pick, HWCampusStairs.open, HWCampusData.trip.sid]), ['campus', 'ST20', true, 'ST20']);
  assert.ok(Math.abs(await top(page, '#stairs')) < 20, 'scrolled to the section');
  assert.equal(await page.locator('#cmpbar [data-a="cmpfind"]').count(), 1);
  await fillSteps(page, '#ss', '12'); await page.fill('#sc', '2'); await page.click('[data-a="savestair"]');
  assert.equal(await page.locator('#cmpbar [data-a="cmpback"]').count(), 1, 'RETURN is offered once the session is saved');
  await page.click('#cmpbar [data-a="cmpback"]');
  assert.ok(Math.abs(await top(page, '#cmpcard')) < 20, 'back at the top of the Observatory');
  assert.deepEqual(await page.evaluate(() => [HWCampus.selected, HWCampusData.trip]), ['ST20', null]);
  assert.match(await page.textContent('#cmpdet'), /You saved 1 stair session here/);
  assert.equal(await page.locator('#cmpbar [data-a="cmpback"]').count(), 0, 'the trip is over');
  assert.equal(await page.locator('#cmpbar [data-a="cmpfind"]').count(), 1);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the footer notice of the merged page includes the Stairs safety text; Evidence Vault links come back to the section', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'stair');
  await page.locator('#main p.dis .hwh').click();
  const t = await page.textContent('#hwh-pop');
  assert.match(t, /Locations are unverified[\s\S]*General exercise pacing aid, not medical treatment[\s\S]*dizziness, chest pain/);
  await page.keyboard.press('Escape');
  await page.click('#stt-workout'); await page.fill('#wk-a', '130'); await page.fill('#wk-r', '98');
  await page.click('#st-rec .hwh'); await page.click('#hwh-pop .hwev a');
  assert.equal(await page.evaluate(() => S.v), 'lab');
  await page.click('.vbackto');
  assert.deepEqual(await page.evaluate(() => [S.v, HWCampusStairs.open]), ['campus', true], 'BACK TO STAIRS reopens the section');
  assert.deepEqual(errors, []); await ctx.close();
});

test('phone 360 px: collapsed and open fit, the header and the main buttons are full-size tap targets', async () => {
  const { page, ctx, errors } = await openApp({ viewport: { width: 360, height: 760 }, context: { isMobile: true, hasTouch: true } });
  await page.waitForSelector('.wl'); await go(page, 'health'); await page.tap('[data-a="cmpgo"]');
  const fit = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.equal(await fit(), 0, 'collapsed fits');
  await page.tap('#stsec-btn');
  assert.equal(await fit(), 0, 'open fits');
  const small = await page.$$eval('#stsec-btn, #stairs .nst, #stairs .stsave, #stairs .stchip', b => b.filter(x => x.offsetParent && x.getBoundingClientRect().height < 44).length);
  assert.equal(small, 0);
  await page.tap('#stt-workout'); assert.equal(await fit(), 0, 'workout half fits');
  assert.deepEqual(errors, []); await ctx.close();
});
