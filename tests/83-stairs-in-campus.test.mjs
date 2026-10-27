// Stairs logging lives in the Campus Health Observatory (owner's request, 2026-10-20). The Health Hall card keeps its
// name, icon and place and opens the Campus page at the top, with the Observatory's Details showing the logging forms
// (LOG A CLIMB HERE: GPS check-in, a climb by hand, the workout with heart rate) for the staircase picked on the map or in
// the list; there is no stairway list to scroll in the forms. The Stairs section under the Observatory
// (js/v6-campus-stairs.js) is collapsed and keeps the history (summary, chart, measured stairways, Session Chronicle).
// The old routes ('stair', 'pulse') and the address #stairs land at the top too. Saved data and its consumers carry over;
// the phone layout fits. Opened from the file, the page has no map, so the list picks the staircase (tests/71 covers the map).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING, entry, fillSteps, APP_URL, stairHistory } from './helpers.mjs';

after(closeBrowser);
const dupIds = page => page.evaluate(() => [...document.querySelectorAll('[id]')].map(e => e.id).filter((id, i, a) => a.indexOf(id) !== i));
const stairs = s => s.e.filter(e => e.c === 'stair');
/** Pick a staircase in the list (the page opened from the file has no map). */
const listPick = async (page, id) => { if (await page.locator('[data-a="cmptab"][data-t="list"]').count()) await page.click('[data-a="cmptab"][data-t="list"]'); await page.click('#cmplist .cmpitem[data-id="' + id + '"]'); await page.waitForSelector('#cmplog'); };

test('the Health Hall card keeps its name, icon and place; it opens the Campus page at the top with the logging forms in Details', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'health');
  const tiles = await page.$$eval('#hub [data-v]', b => b.map(x => [x.dataset.v, x.querySelector('b').textContent]));
  assert.deepEqual(tiles.map(t => t[0]), ['food', 'sleep', 'stair', 'exercise', 'stress', 'body', 'stats', 'score'], 'same cards in the same order');
  assert.match(tiles.find(t => t[0] === 'stair')[1], /^Stairs/, 'still the Stairs card');
  assert.equal(await page.locator('#hub [data-v="stair"] .bi .pxe, #hub [data-v="stair"] .bi svg').count() > 0, true, 'its icon');
  await page.evaluate(() => scrollTo(0, 400));
  await page.click('#hub [data-v="stair"]');
  assert.equal(await page.evaluate(() => S.v), 'campus');
  assert.equal(await page.evaluate(() => scrollY), 0, 'the page opens at the top');
  assert.equal(await page.textContent('main .bn b'), 'Campus Health Observatory');
  assert.equal(await page.locator('#cmppane > #cmpdet').count(), 1, 'Details are open, right below the map');
  assert.equal(await page.locator('#cmpdet #cmplog #v6gps, #cmpdet #cmplog #stman, #cmpdet #cmplog .sttabs').count(), 3, 'GPS check-in, the hand log and the two halves, in Details');
  assert.match(await page.textContent('#cmplog .stloc'), /No staircase picked yet/, 'nothing is pre-selected');
  assert.equal(await page.locator('#cmplog .sqlist .chip, #cmplog select#wk-loc').count(), 0, 'no stairway list to scroll and no dropdown');
  assert.equal(await page.getAttribute('#stsec-btn', 'aria-expanded'), 'false', 'the Stairs section (history) stays collapsed');
  assert.deepEqual(await dupIds(page), [], 'no id is used twice on the page');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the Stairs section keeps the history: collapsed (nothing rendered, 44 px header), the header opens and closes it; the forms are not in it', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'health');
  await page.evaluate(() => { window.__ev = []; ['stairs:opened', 'stairs:closed'].forEach(t => HWEvents.on(t, () => window.__ev.push(t))); });
  await page.click('[data-a="cmpgo"]');
  assert.equal(await page.getAttribute('#stsec-btn', 'aria-expanded'), 'false');
  assert.equal(await page.isHidden('#stsec-body'), true);
  assert.equal(await page.locator('#stairs #stlog, #stairs #ststudy').count(), 0, 'collapsed: nothing drawn');
  assert.ok((await page.$eval('#stsec-btn', e => e.getBoundingClientRect().height)) >= 44, 'tap target');
  assert.match(await page.textContent('#stsec-btn'), /Stairs[\s\S]*0 steps today · 0 sessions in 7 days/);
  await page.click('#stsec-btn');
  assert.equal(await page.getAttribute('#stsec-btn', 'aria-expanded'), 'true');
  for (const sel of ['#stlog', '#ststudy', '.ststats', '.stgoal', '#st-where']) assert.equal(await page.locator('#stairs ' + sel).count() > 0, true, sel + ' in the history');
  assert.equal(await page.locator('#stairs #stman, #stairs #v6gps, #stairs .sttabs').count(), 0, 'the logging forms are in the Observatory, not here');
  assert.match(await page.textContent('#st-where'), /pick a staircase on the map above[\s\S]*Details/i);
  await page.click('#stsec-btn');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'stsec-btn', 'focus stays on the header');
  assert.deepEqual(await page.evaluate(() => window.__ev), ['stairs:opened', 'stairs:closed']);
  assert.deepEqual(errors, []); await ctx.close();
});

test('old routes land at the top with the forms: stair (casual half), pulse (workout & heart-rate half), and the address #stairs', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl');
  await go(page, 'pulse');
  assert.deepEqual(await page.evaluate(() => [S.v, scrollY, HWCampus.state.tab]), ['campus', 0, 'det']);
  assert.equal(await page.getAttribute('#stt-workout', 'aria-current'), 'page', 'Heartstone Hall opens the workout & heart-rate half');
  assert.equal(await page.locator('#cmplog #sthrc').count(), 1, 'the heart-rate card (LOG BPM works without a staircase)');
  await go(page, 'stair');
  assert.equal(await page.getAttribute('#stt-casual', 'aria-current'), 'page', 'the Stairs route opens the casual half');
  await go(page, 'home');
  await page.evaluate(() => { location.hash = 'stairs'; });
  await page.waitForFunction(() => S.v === 'campus');
  assert.deepEqual(await page.evaluate(() => [scrollY, HWCampus.state.tab]), [0, 'det'], '#stairs opens the top with Details');
  await go(page, 'home');
  assert.equal(await page.evaluate(() => location.hash), '', 'the address is cleaned when leaving');
  assert.deepEqual(errors, []); await ctx.close();
  const b = await openApp({ url: APP_URL + '#stairs' });
  await b.page.waitForFunction(() => typeof S !== 'undefined' && S.v === 'campus');
  assert.equal(await b.page.evaluate(() => HWCampus.state.tab), 'det', 'opening the app at #stairs lands on the Details');
  assert.deepEqual(b.errors, []); await b.ctx.close();
});

test('logging in Details: a casual climb and a workout with heart rate for the picked staircase; LOG BPM; the history edits and deletes', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'stair');
  // nothing picked: saving asks for a staircase
  await fillSteps(page, '#ss', '12'); await page.fill('#sc', '2'); await page.click('[data-a="savestair"]');
  assert.equal(stairs(await state(page)).length, 0, 'not saved without a staircase');
  // pick ST20 in the list: its Details show the forms for it
  await listPick(page, 'ST20');
  assert.match(await page.textContent('#cmplog .stloc'), /penjana elektrik/);
  await fillSteps(page, '#ss', '12'); await page.fill('#sc', '2'); await page.click('[data-a="savestair"]');
  let s = await state(page), e = stairs(s)[0];
  assert.deepEqual([e.v, e.m.sid, e.m.kind, e.m.src, e.m.steps, e.m.climbs], [24, 'ST20', 'casual', 'manual', 12, 2]);
  assert.equal(await page.evaluate(() => [S.v, HWCampus.selected].join()), 'campus,ST20', 'still on the staircase after saving');
  assert.match(await page.textContent('#cmpdet'), /You saved 1 stair session here/);
  // the workout half for another staircase
  await listPick(page, 'ST24');
  await page.click('#stt-workout');
  for (const sel of ['#wk-loc', '#sthrc', '#stseal', '#wk-kcal', '[data-a="pstart"]', '#st-tr-b', '#st-tr-a']) assert.equal(await page.locator('#cmplog ' + sel).count(), 1, sel);
  await page.click('[data-a="pace"][data-i="2"]');
  await page.fill('#wk-b', '72'); await page.click('[data-a="hrlog"][data-k="b"]');
  await page.fill('#wk-a', '130'); await fillSteps(page, '#wk-s', '30'); await page.fill('#wk-c', '3'); await page.fill('#wk-d', '8');
  await page.click('[data-a="stwsave"]');
  s = await state(page); e = stairs(s)[1];
  assert.deepEqual([e.v, e.m.sid, e.m.kind, e.m.hrB, e.m.hrA, e.m.dur, e.m.kcal.m], [90, 'ST24', 'workout', 72, 130, 8, 'met+hr']);
  assert.equal(s.e.filter(x => x.c === 'pulse').length, 1, 'the logged BPM, linked to the sealed workout');
  assert.deepEqual(await page.evaluate(() => [sp(today()), hr(today()), rest(today())]), [114, 130, 72], 'the consumers read the same entries');
  await go(page, 'home');
  assert.match(await page.textContent('#tstat'), /Heart rate\s*130[\s\S]*after workout/);
  // the history: edit and delete from the chronicle
  await go(page, 'stair'); await stairHistory(page);
  await page.click('#stlog [data-a="edit"] >> nth=0');
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
  await go(page, 'stair'); await stairHistory(page);
  const txt = await page.textContent('#stlog');
  assert.match(txt, /Tangga Selangkah Menara Gading[\s\S]*WORKOUT/); assert.match(txt, /penjana elektrik[\s\S]*CASUAL[\s\S]*GPS CHECK-IN/);
  await go(page, 'pulse'); await go(page, 'health'); await page.click('[data-a="cmpgo"]'); await listPick(page, 'ST02');
  await page.reload(); await page.waitForSelector('.wl'); await go(page, 'stair');
  assert.equal(JSON.stringify((await state(page)).e), JSON.stringify(old), 'nothing in the save was rewritten');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), keys0, 'the same localStorage keys');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the list, its filters and details work beside the forms; a staircase without coordinates can be logged too', async () => {
  const { page, ctx, errors } = await openApp({ seed: RETURNING });
  await page.waitForSelector('.wl'); await go(page, 'health'); await page.click('[data-a="cmpgo"]');
  assert.equal(await page.locator('#cmplist .cmpitem').count(), 36);
  await page.fill('#cmpq', 'ST02');
  const nol = await page.$$eval('#cmplist .cmpitem', b => b.map(x => x.dataset.id));
  assert.deepEqual(nol, ['ST02'], 'a staircase with no coordinates (file://: no survey positions)');
  await page.click('#cmplist .cmpitem[data-id="' + nol[0] + '"]');
  assert.match(await page.textContent('#cmplog .stloc'), /no map coordinates/);
  await fillSteps(page, '#ss', '10'); await page.fill('#sc', '1'); await page.click('[data-a="savestair"]');
  assert.equal(stairs(await state(page)).pop().m.sid, nol[0]);
  await page.click('[data-a="cmptab"][data-t="list"]'); await page.fill('#cmpq', ''); await page.click('[data-a="cmpfilt"][data-f="all"]'); await listPick(page, 'ST20');
  assert.match(await page.textContent('#cmpdet'), /rise 0\.169 m/, 'the staircase facts stay in Details, below the forms');
  assert.ok(await page.$eval('#cmplog', e => e.compareDocumentPosition(document.querySelector('#cmpdet .cmpgrp')) & Node.DOCUMENT_POSITION_FOLLOWING), 'forms first');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the footer notice of the page includes the Stairs safety text; Evidence Vault links come back to the forms', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl'); await go(page, 'stair');
  await page.locator('#main p.dis .hwh').click();
  const t = await page.textContent('#hwh-pop');
  assert.match(t, /Raised ground and building heights on the map are illustrative[\s\S]*General exercise pacing aid, not medical treatment[\s\S]*dizziness, chest pain/);
  await page.keyboard.press('Escape');
  await page.click('#stt-workout'); await page.fill('#wk-a', '130'); await page.fill('#wk-r', '98');
  await page.click('#st-rec .hwh'); await page.click('#hwh-pop .hwev a');
  assert.equal(await page.evaluate(() => S.v), 'lab');
  await page.click('.vbackto');
  assert.deepEqual(await page.evaluate(() => [S.v, HWCampus.state.tab, !!document.querySelector('#cmplog .sttabs')]), ['campus', 'det', true], 'BACK returns to the forms');
  assert.deepEqual(errors, []); await ctx.close();
});

test('phone 360 px: the Details with the forms and the open history fit; the main buttons are full-size tap targets', async () => {
  const { page, ctx, errors } = await openApp({ viewport: { width: 360, height: 760 }, context: { isMobile: true, hasTouch: true } });
  await page.waitForSelector('.wl'); await go(page, 'stair');
  const fit = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  assert.equal(await fit(), 0, 'the forms fit');
  await page.tap('#stsec-btn');
  assert.equal(await fit(), 0, 'the open history fits');
  const small = await page.$$eval('#stsec-btn, #cmplog .nst, #cmplog .stsave, #cmplog .stchip', b => b.filter(x => x.offsetParent && x.getBoundingClientRect().height < 44).length);
  assert.equal(small, 0);
  await page.tap('#stt-workout'); assert.equal(await fit(), 0, 'the workout half fits');
  assert.deepEqual(errors, []); await ctx.close();
});
