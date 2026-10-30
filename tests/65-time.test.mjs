// Health Time Machine (js/v6-time.js): an interactive timeline of saved records only. Day / week / month, EARLIER /
// LATER / the slider / RETURN TO TODAY, markers and cells open a detail card with the record's source, a missing day is
// "not logged" (never 0), COMPARE with the period before, runs from the device's run log, nothing written, phone layout.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';

after(closeBrowser);
const two = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
const ago = n => { const d = new Date(); d.setHours(12); d.setDate(d.getDate() - n); return ymd(d); };
const E = (id, c, v, d, t, m = {}) => ({ id, c, v, m, n: '', d, t });
// today: water and a GPS stair session; 1 day ago: food; 9 days ago: sleep; 40 days ago: the first record
const SEED = { ...RETURNING, en: { [ago(0)]: { v: 4, t: '07:30' } }, e: [
  E('w1', 'water', 250, ago(0), '08:15'), E('w2', 'water', 500, ago(0), '13:40'),
  E('s1', 'stair', 120, ago(0), '10:05', { sid: 'ST03', loc: 'Tangga A', steps: 20, climbs: 6, src: 'gps', kind: 'casual' }),
  E('f1', 'food', 450, ago(1), '12:30', { name: 'Nasi lemak' }),
  E('z1', 'sleep', 7.5, ago(9), '06:30', { bed: '23:00', wake: '06:30' }),
  E('old', 'water', 300, ago(40), '09:00')] };
const RUN = () => JSON.stringify({ ok: 1, del: [], runs: [{ id: 'r-1', start: new Date(Date.now() - 3600e3).toISOString(), end: new Date().toISOString(), dist: 2500, dur: 900, pace: 360, route: null, up: 0 }] });
const open = async (o = {}) => {
  const r = await openApp({ seed: SEED, ...o, before: async p => { await p.addInitScript(x => { if (!sessionStorage.getItem('rn')) { localStorage.setItem('healthwiz_runs', x); sessionStorage.setItem('rn', 1); } }, RUN()); } });
  await go(r.page, 'stats');
  await r.page.click('[data-a="tmgo0"]');
  await r.page.waitForSelector('#tmcard');
  return r;
};

test('the door on Statistics opens the Time Machine under the Health Hall; the week shows only saved lanes; missing is not 0', async () => {
  const { page, errors } = await open();
  const before = JSON.stringify(await state(page));
  assert.equal(await page.evaluate(() => [S.v, PAR[S.v]].join()), 'time,health');
  const t = await page.textContent('#tmcard');
  assert.match(t, /Only what you saved/);
  const lanes = await page.locator('#tmview .tmrow:not(.tmhead) .tmln').allTextContents(), wk0 = await page.evaluate(() => HWTime.period('w', 0)[0]);
  // heart rate: none here (the GPS stair session has no BPM), so it is not a lane
  assert.deepEqual(lanes.map(s => s.trim()), ['Water', 'Food', 'Energy', 'Stairs', 'Runs'].filter(n => n !== 'Food' || ago(1) >= wk0), 'saved lanes only (food if yesterday is in this week)');
  assert.match(t, /Not logged in this period: .*Stress/);
  // the Water row: today is a button, a day without water is an empty cell, never "0"
  const row = page.locator('#tmview .tmrow', { hasText: 'Water' });
  const cells = await row.locator('.tmc').evaluateAll(cs => cs.map(c => c.tagName + (c.classList.contains('tm0') ? ':empty' : '')));
  assert.ok(cells.includes('BUTTON') && cells.includes('SPAN:empty'));
  assert.doesNotMatch(await row.textContent(), /\b0 ml\b/);
  assert.equal(JSON.stringify(await state(page)), before, 'nothing is written');
  assert.deepEqual(errors, []);
});

test('a cell opens the records with their times and sources (entered by you, GPS check-in, GPS run); OPEN goes to the feature', async () => {
  const { page, errors } = await open();
  await page.click('#tmview button[data-k="water"][data-d="' + ago(0) + '"]');
  let d = await page.textContent('.tmdet');
  assert.match(d, /Water ·[\s\S]*750 ml[\s\S]*08:15 250 ml entered by you[\s\S]*13:40 500 ml entered by you/);
  await page.click('#tmview button[data-k="stair"][data-d="' + ago(0) + '"]');
  assert.match(await page.textContent('.tmdet'), /Tangga A · 120 steps GPS check-in/);
  await page.click('#tmview button[data-k="run"][data-d="' + ago(0) + '"]');
  assert.match(await page.textContent('.tmdet'), /2\.5 km in 15 min GPS run/);
  await page.click('[data-a="tmclose"]');
  assert.equal(await page.locator('.tmdet').count(), 0);
  // OPEN goes to the feature
  await page.click('#tmview button[data-k="water"][data-d="' + ago(0) + '"]');
  await page.click('[data-a="tmgo"]');
  assert.equal(await page.evaluate(() => S.v), 'food');
  assert.deepEqual(errors, []);
});

test('day view places records at their time; EARLIER, LATER, the slider and RETURN TO TODAY move through time', async () => {
  const { page, errors } = await open();
  await page.click('[data-a="tmv"][data-v="d"]');
  const m = await page.locator('#tmview .tmk[data-k="water"]').evaluateAll(b => b.map(x => x.style.left));
  assert.deepEqual(m, [(8 * 60 + 15) / 1440 * 100, (13 * 60 + 40) / 1440 * 100].map(x => x.toFixed(2) + '%'));
  assert.equal(await page.isDisabled('[data-a="tmtoday"]'), true);
  await page.click('[data-a="tmstep"][data-v="1"]');
  assert.match(await page.textContent('#tmview'), /Food/);
  assert.equal(await page.isDisabled('[data-a="tmtoday"]'), false);
  // the slider reaches back to the first saved day (40 days ago), and nothing before it
  assert.equal(await page.getAttribute('#tmscrub', 'max'), '40');
  await page.fill('#tmscrub', '0');
  assert.match(await page.textContent('#tmview'), /Water/);
  assert.equal(await page.isDisabled('[data-a="tmstep"][data-v="1"]'), true, 'no EARLIER before the first record');
  await page.fill('#tmscrub', '31'); // 9 days ago: sleep
  assert.match(await page.textContent('#tmview'), /Sleep/);
  await page.dispatchEvent('#tmscrub', 'change');
  await page.click('[data-a="tmtoday"]');
  assert.equal(await page.evaluate(() => S.tm.off), 0);
  // an empty day says so
  await page.click('[data-a="tmstep"][data-v="1"]'); await page.click('[data-a="tmstep"][data-v="1"]');
  assert.match(await page.textContent('#tmview'), /Nothing was saved on/);
  assert.deepEqual(errors, []);
});

test('COMPARE shows days logged and averages on logged days, "not logged" where empty, and says it does not show cause', async () => {
  const { page, errors } = await open();
  await page.click('[data-a="tmv"][data-v="m"]');
  await page.click('[data-a="tmcmp"]');
  const t = await page.textContent('.tmcmp');
  assert.match(t, /Average on the days something was logged/);
  assert.match(t, /Water[\s\S]*days? logged/);
  assert.match(await page.textContent('#tmview'), /A difference between two periods does not show what caused it\./);
  assert.match(t, /not logged/);
  assert.deepEqual(errors, []);
});

test('phone: no sideways page scroll (the month grid scrolls inside), large controls; no pop-in under reduced motion', async () => {
  const { page, errors } = await open({ viewport: { width: 360, height: 760 }, context: { reducedMotion: 'reduce', isMobile: true, hasTouch: true } });
  await page.click('[data-a="tmv"][data-v="m"]');
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, card: document.querySelector('#tmcard').getBoundingClientRect().right,
    anim: getComputedStyle(document.querySelector('#tmview .tmk')).animationName,
    ctl: [...document.querySelectorAll('#tmcard .tmviews button, #tmcard .tmnav button, #tmcard .row button')].map(b => Math.round(b.getBoundingClientRect().height)),
    cell: (b => [Math.round(b.width), Math.round(b.height)])(document.querySelector('#tmview button.tmk').getBoundingClientRect()) }));
  assert.ok(r.doc <= 360, 'no sideways scroll: ' + r.doc);
  assert.ok(r.card <= 360);
  assert.equal(r.anim, 'none');
  for (const h of r.ctl) assert.ok(h >= 44, 'control height ' + h);
  assert.ok(r.cell[0] >= 24 && r.cell[1] >= 24, 'cells are at least 24 px: ' + r.cell);
  assert.deepEqual(errors, []);
});

test('rewind: a not-logged cell opens the page set to that day; the water is saved under that day, not today', async () => {
  const { page, ctx, errors } = await open();
  await page.click('[data-a="tmv"][data-v="m"]');
  const y = ago(2);   // two days ago: nothing saved on it, in the current month or the one before
  const cell = page.locator('.tmadd[data-k="water"][data-d="' + y + '"]');
  if (!(await cell.count())) await page.click('[data-a="tmstep"][data-v="1"]');
  await cell.first().click();
  assert.match(await page.textContent('#main'), /LOGGING FOR: /, 'the Log for control shows the chosen day');
  assert.equal(await page.evaluate(() => HWWhen.date()), y);
  await page.click('[data-a="wa"][data-v="250"]');
  const s = await state(page);
  assert.ok(s.e.some(e => e.c === 'water' && e.d === y && +e.v === 250), 'saved under the chosen day');
  assert.equal(s.e.filter(e => e.c === 'water' && e.d === ago(0)).length, 2, 'today is unchanged');
  await page.click('[data-hww="now"]');
  assert.equal(await page.evaluate(() => HWWhen.custom()), false, 'USE NOW goes back to today');
  assert.deepEqual(errors, []); await ctx.close();
});

test('rewind: a date in the week header opens that day with a LOG panel; live-measured lanes are not offered; the future is not tappable', async () => {
  const { page, ctx, errors } = await open();
  const y = ago(3);
  await page.click('[data-a="tmv"][data-v="d"]'); await page.click('[data-a="tmstep"][data-v="1"]');
  await page.click('[data-a="tmv"][data-v="w"]');
  const hd = page.locator('.tmdy[data-d="' + y + '"]');
  if (await hd.count()) { await hd.click(); assert.match(await page.textContent('#tmlbl'), /\d/); }
  else await page.click('[data-a="tmv"][data-v="d"]');
  const keys = await page.$$eval('.tmlogp [data-k]', b => b.map(x => x.dataset.k));
  assert.deepEqual(keys.sort(), ['bmi', 'food', 'sleep', 'stair', 'water']);
  await page.click('.tmlogp [data-k="sleep"]');
  assert.equal(await page.evaluate(() => HWWhen.custom()), true);
  assert.equal(await page.evaluate(() => { HWWhen.setFor('2999-01-01', 'food'); return HWWhen.date() <= today(); }), true, 'a future day is refused');
  assert.deepEqual(errors, []); await ctx.close();
});
