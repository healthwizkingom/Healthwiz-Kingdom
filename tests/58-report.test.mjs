// The weekly report, "The Wizard's Health Chronicle" (js/v6-report.js): built on request from the real log, printable, no game values.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry, daysAgo } from './helpers.mjs';

after(closeBrowser);
// Mondays, as days-ago from today: this week's Monday, last week's, the one before
const K = (new Date().getDay() + 6) % 7, LAST = K + 7, PRIOR = K + 14;
const day = (mondayAgo, i) => mondayAgo - i; // Monday = i 0
const sleep = (n, v) => entry('sleep', v, n, { bed: '23:00', wake: '06:00' });
const wk = (n, steps, dur, hrB, hrA, hrR1) => entry('stair', steps, n, { sid: 'ST19', loc: 'Block Aisyah stairs', diff: 'MODERATE', angle: 27.23, steps, climbs: 1, dur, hrB, hrA, hrR1, kind: dur ? 'workout' : 'casual' });
const lastWeek = [sleep(day(LAST, 0), 7), sleep(day(LAST, 1), 7.5), sleep(day(LAST, 2), 6.5), sleep(day(LAST, 3), 8), sleep(day(LAST, 4), 9),
  entry('water', 1500, day(LAST, 0)), entry('water', 2000, day(LAST, 1)), entry('water', 2500, day(LAST, 2)), entry('water', 1000, day(LAST, 4)),
  wk(day(LAST, 0), 40, 5, 70, 120, 100), wk(day(LAST, 2), 60, 0, null, null, null),
  entry('stress', 4, day(LAST, 0)), entry('stress', 5, day(LAST, 1)), entry('stress', 3, day(LAST, 3))];
const priorWeek = [sleep(day(PRIOR, 0), 6), sleep(day(PRIOR, 1), 6.5), sleep(day(PRIOR, 2), 7), entry('water', 1000, day(PRIOR, 0)), entry('water', 1200, day(PRIOR, 1)), entry('water', 900, day(PRIOR, 2)),
  entry('stress', 7, day(PRIOR, 0)), entry('stress', 6, day(PRIOR, 1)), entry('stress', 8, day(PRIOR, 2))];
const seed = (...e) => ({ ...RETURNING, xp: 9000, b: { 'First Drop': '2026-01-01' }, e: e.flat() });
const FULL = seed(lastWeek, priorWeek);
const boot = async (s = FULL, viewport) => { const r = await openApp({ seed: s, viewport }); await r.page.waitForSelector('.wl'); await go(r.page, 'stats'); return r; };
const open = async page => { await page.click('[data-a="rptopen"]'); await page.waitForSelector('#rpt-sheet'); };
const text = page => page.$eval('#rpt-sheet', e => e.innerText.replace(/\s+/g, ' ').trim());
const snap = page => page.evaluate(() => ({ ls: localStorage.getItem('healthwiz'), sv: SV, keys: Object.keys(localStorage).sort().join() }));

test('GENERATE WEEKLY REPORT is on the Statistics page; nothing is built or sent until it is pressed', async () => {
  const { page, ctx, errors } = await boot();
  const reqs = []; page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) reqs.push(r.url()); });
  assert.match(await page.textContent('[data-a="rptopen"]'), /GENERATE WEEKLY REPORT/);
  assert.equal(await page.locator('#hwrep').count(), 0);
  const before = await snap(page);
  await open(page);
  assert.equal(await page.locator('#hwrep[role="dialog"]').count(), 1);
  assert.equal(await page.evaluate(() => document.querySelector('.app').hasAttribute('inert')), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#hwrep').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.a), 'rptopen', 'focus returns to the button');
  assert.equal(await page.evaluate(() => document.querySelector('.app').hasAttribute('inert')), false);
  assert.deepEqual(await snap(page), before, 'the log is unchanged');
  assert.deepEqual(reqs, [], 'nothing uploaded or fetched');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the default week is the last complete Monday-Sunday week; values are the logged values', async () => {
  const { page, ctx, errors } = await boot();
  await open(page);
  const w = await page.evaluate(() => { const W = HWReport.week(HWReport.defaultStart()); return { start: W.start, end: W.end, dow: new Date(W.start + 'T12:00:00').getDay(), done: W.done, c: { sl: W.cur.sleep.map(x => x[1]), wa: W.cur.water.map(x => x[1]), sIn: W.cur.sleepIn, wHit: W.cur.waterHit, sess: W.cur.sess.length, steps: W.cur.steps, min: W.cur.timedMin, rest: W.cur.rest, rec: W.cur.rec } }; });
  assert.equal(w.dow, 1, 'starts on a Monday'); assert.equal(w.start, await page.evaluate(n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); }, LAST));
  assert.ok(w.done);
  assert.deepEqual(w.c.sl, [7, 7.5, 6.5, 8, 9]); assert.deepEqual(w.c.wa, [1500, 2000, 2500, 1000]);
  assert.equal(w.c.sIn, 2); assert.equal(w.c.wHit, 2); assert.equal(w.c.sess, 2); assert.equal(w.c.steps, 100); assert.equal(w.c.min, 5);
  assert.deepEqual(w.c.rest, [70]); assert.deepEqual(w.c.rec, [20]);
  const t = await text(page);
  assert.match(t, /Week of \d+ \w+ [–-] \d+ \w+ \d{4} \(Monday–Sunday\)/);
  assert.match(t, /Complete week · 7 of 7 days covered/);
  assert.match(t, /Nights logged 5 of 7/); assert.match(t, /Average 7\.6 h/); assert.match(t, /Within 8–10 h 2 of 5 nights/);
  assert.match(t, /Days logged 4 of 7/); assert.match(t, /Average on logged days 1,750 mL/); assert.match(t, /Days at or above target 2 of 4/);
  assert.match(t, /Stair sessions 2 on 2 days/); assert.match(t, /Stair steps 100/); assert.match(t, /1 of 2 sessions had a time/);
  assert.match(t, /Resting heart rate 70 BPM/); assert.match(t, /Recovery \(pulse drop in 1 min\) 20 BPM/);
  assert.match(t, /Stress \(self-rated\) 4 \/ 10/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Health Score is the Health Score page\'s own number, with the change from the week before when both weeks are comparable', async () => {
  const { page, ctx, errors } = await boot();
  await open(page);
  const x = await page.evaluate(() => { const W = HWReport.week(HWReport.defaultStart()), off = n => W.days.map(d => { const t = new Date(d + 'T12:00:00'); t.setDate(t.getDate() - n); return ymd(t); });
    return { cur: HWScore.computeFor(W.days, W.end).score, prev: HWScore.computeFor(off(7), off(7)[6]).score, shown: W.cmp }; });
  assert.ok(x.cur > 0 && x.prev > 0);
  assert.deepEqual(x.shown, { d: x.cur - x.prev, a: x.prev, b: x.cur });
  const t = await text(page);
  assert.match(t, new RegExp('Health Score ' + x.cur + ' / 100', 'i'));
  const d = x.cur - x.prev, sign = d > 0 ? '\\+' + d : d < 0 ? '−' + -d : '0';
  assert.match(t, new RegExp('Change from the week before: ' + sign + ' points? \\(' + x.prev + ' → ' + x.cur + '\\)'));
  assert.match(t, /not a medical diagnosis or a validated clinical risk score/);
  assert.match(t, /areas without logs are left out, not counted as zero/);
  // the same weighted formula as the page: the week's score equals the score the Health Score page gives for those logged days
  assert.equal(await page.evaluate(() => { const W = HWReport.week(HWReport.defaultStart()); return HWScore.combine(HWScore.indicators(W.cur.el, { asOf: W.end })).score === W.cur.score; }), true);
  assert.deepEqual(errors, []); await ctx.close();
});

test('comparison is withheld, with the reason, for a week still going and for a thin previous week', async () => {
  const { page, ctx, errors } = await boot(seed(lastWeek, entry('water', 1500, 0))); // nothing before last week; one log today
  await open(page);
  assert.match(await text(page), /Week-to-week change not shown: the week before has fewer than 3 days of logs/);
  assert.equal(await page.locator('#rpt-sheet').getByText('Change from the week before:').count(), 0);
  await page.click('[data-a="rptnext"]'); // this week, still going
  const t = await text(page);
  assert.match(t, /(Week in progress|Last day of the week)/); assert.match(t, /this week is not finished yet/);
  assert.match(t, new RegExp(`${K + 1} of 7 days covered`));
  assert.deepEqual(errors, []); await ctx.close();
});

test('observations (2-3) and suggestions (up to 3) come from the records, are kept apart, and are not diagnoses', async () => {
  const { page, ctx, errors } = await boot();
  await open(page);
  const o = await page.$$eval('#rpt-sheet .rpts', s => s.map(x => [x.querySelector('h3').textContent.trim(), [...x.querySelectorAll('li')].map(l => l.textContent.replace(/\s+/g, ' ').trim())]));
  const obs = o.find(s => /^Observations/.test(s[0])), sug = o.find(s => /^Suggestions/.test(s[0]));
  assert.ok(obs[1].length >= 2 && obs[1].length <= 3, 'observations: ' + obs[1].length);
  assert.ok(obs[1].every(l => /\d/.test(l)), 'each observation carries numbers from the log');
  assert.ok(obs[1].some(l => /Average sleep was 7\.6 h over 5 logged nights; 2 of them were inside the 8–10 h range/.test(l)));
  assert.ok(sug[1].length >= 1 && sug[1].length <= 3);
  assert.ok(sug[1].every(l => /Because: /.test(l)));
  assert.match(sug[0], /not medical advice/);
  const t = await text(page);
  assert.doesNotMatch(t, /diagnosed with|you have (a |an )?(disorder|disease|condition)|risk of|at risk/i);
  assert.match(t, /Personal wellness summary, not a medical document/);
  assert.match(t, /Private health information\. Printed or shared copies/);
  assert.match(t, /did not upload or send this report/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('game values are not in the report: no XP, levels, badges, quests, streaks or rankings', async () => {
  const { page, ctx, errors } = await boot();
  await open(page);
  assert.doesNotMatch(await text(page), /\bXP\b|\blevel\b|badge|quest|streak|leaderboard|rank|kingdom|9000/i);
  assert.deepEqual(errors, []); await ctx.close();
});

test('empty weeks say so and invent nothing', async () => {
  const { page, ctx, errors } = await boot(RETURNING);
  await open(page);
  let t = await text(page);
  assert.match(t, /Nothing was logged in this week/);
  assert.match(t, /Not available: no Health Score area was logged this week/);
  assert.match(t, /No sleep logged this week/); assert.match(t, /No water logged this week/); assert.match(t, /No heart rate logged this week/);
  assert.doesNotMatch(t, /NaN|undefined|Infinity|null/);
  assert.equal(await page.locator('#rpt-sheet').getByText('Observations').count(), 0);
  await page.click('[data-a="rptprev"]'); t = await text(page);
  assert.match(t, /Nothing was logged in this week/); assert.match(t, /Complete week · 7 of 7 days covered/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('incomplete or odd records do not break the report', async () => {
  const odd = [entry('sleep', 0, day(LAST, 0), {}), entry('stair', 0, day(LAST, 1), {}), entry('water', 0, day(LAST, 2)), entry('food', 0, day(LAST, 3), { name: 'x' }),
    entry('pulse', 70, day(LAST, 4), {}), entry('stair', 30, day(LAST, 5), { steps: 30, climbs: 1, hrA: 130 }), entry('stress', 5, day(LAST, 6), {}), entry('sleep', 7, day(LAST, 6), {})];
  const { page, ctx, errors } = await boot(seed(odd));
  await open(page);
  const t = await text(page);
  assert.doesNotMatch(t, /NaN|undefined|Infinity|null/);
  assert.match(t, /No water logged this week/);            // a 0 mL entry is not a measurement
  assert.match(t, /Not logged on/);
  assert.match(t, /Stair sessions 2 on 2 days/);
  assert.match(t, /No 1-minute recovery reading/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('week selection: previous and next week, a date picker, no weeks after this one', async () => {
  const { page, ctx, errors } = await boot();
  await open(page);
  const head = () => page.$eval('.rptw', e => e.textContent);
  const h0 = await head();
  await page.click('[data-a="rptprev"]'); const h1 = await head(); assert.notEqual(h1, h0);
  assert.match(await text(page), /Sleep Nights logged 3 of 7/i, 'the week before has 3 sleep nights');
  await page.click('[data-a="rptnext"]'); assert.equal(await head(), h0);
  await page.click('[data-a="rptnext"]'); // now the current week
  assert.equal(await page.locator('[data-a="rptnext"]').isDisabled(), true);
  assert.equal(await page.inputValue('#rpt-date'), await page.evaluate(() => HWReport.monday(today())));
  const mid = await page.evaluate(n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); }, PRIOR - 2); // a Wednesday two weeks back
  await page.fill('#rpt-date', mid);
  assert.match(await text(page), /Nights logged 3 of 7/);
  assert.equal(await page.inputValue('#rpt-date'), await page.evaluate(n => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d); }, PRIOR));
  assert.deepEqual(errors, []); await ctx.close();
});

test('print stylesheet: only the report, white page, dark text, no controls; saves as a short PDF', async () => {
  const { page, ctx, errors } = await boot();
  await open(page);
  await page.emulateMedia({ media: 'print' });
  const m = await page.evaluate(() => { const cs = (s, p) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : null; };
    return { app: cs('.app', 'display'), toasts: cs('#toasts', 'display'), rep: cs('#hwrep', 'display'), pos: cs('#hwrep', 'position'), bar: cs('.rptbar', 'display'), bg: cs('body', 'backgroundColor'), repbg: cs('#hwrep', 'backgroundColor'), ink: cs('#rpt-sheet', 'color'),
      shadow: cs('#rpt-sheet', 'boxShadow'), border: cs('#rpt-sheet', 'borderTopWidth'), vis: [...document.body.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id || e.tagName),
      foot: document.querySelector('.rptf').offsetParent !== null }; });
  assert.equal(m.app, 'none'); assert.equal(m.rep, 'block'); assert.equal(m.pos, 'static'); assert.equal(m.bar, 'none');
  assert.equal(m.bg, 'rgb(255, 255, 255)'); assert.equal(m.repbg, 'rgb(255, 255, 255)'); assert.equal(m.ink, 'rgb(0, 0, 0)');
  assert.equal(m.shadow, 'none'); assert.equal(m.border, '0px');
  assert.ok(m.vis.every(v => v === 'hwrep' || v === 'SCRIPT' || v === 'STYLE'), 'only the report is visible: ' + m.vis);
  assert.ok(m.foot, 'the not-a-medical-document note prints');
  const pdf = await page.pdf({ format: 'A4', printBackground: false });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  assert.ok(pages >= 1 && pages <= 2, 'a normal week fits in one or two A4 pages, got ' + pages);
  // font sizes stay readable in print (10.5pt body, nothing under 9pt)
  const small = await page.evaluate(() => [...document.querySelectorAll('#rpt-sheet *')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 11.9).length);
  assert.equal(small, 0, 'no printed text under 9pt');
  await page.emulateMedia({ media: 'screen' });
  assert.deepEqual(errors, []); await ctx.close();
});

test('phone screens: the report fits, one column, controls reachable', async () => {
  for (const vp of [{ width: 320, height: 568 }, { width: 360, height: 640 }]) {
    const { page, ctx, errors } = await boot(FULL, vp);
    await open(page);
    const m = await page.evaluate(() => { const o = document.getElementById('hwrep');
      return { sw: o.scrollWidth, cw: o.clientWidth, cols: getComputedStyle(document.querySelector('.rptg')).gridTemplateColumns.split(' ').length,
        small: [...document.querySelectorAll('#hwrep .rptbar button, #hwrep .rptbar input')].filter(e => e.getBoundingClientRect().height < 43).map(e => e.dataset.a || e.id),
        wide: [...document.querySelectorAll('#rpt-sheet *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('table')).length }; });
    assert.ok(m.sw <= m.cw, vp.width + ' report scrolls sideways'); assert.equal(m.cols, 1); assert.deepEqual(m.small, []); assert.equal(m.wide, 0);
    await page.click('[data-a="rptclose"]');
    assert.equal(await page.locator('#hwrep').count(), 0);
    assert.deepEqual(errors, []); await ctx.close();
  }
});
