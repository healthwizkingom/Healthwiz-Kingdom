// Stair Prescription (js/v6-plan.js): a weekly stair plan the player chooses on the Stairs page. Not a prescription:
// the player's days, minutes and goal; pace from the goal and their own logs; health answers win; a day is done only
// when a stair session is saved; skip / edit / turn off; no XP, no penalties; the route and the phone layout.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';

after(closeBrowser);
const EMOJI = /(?:\p{Emoji_Presentation}|\p{Emoji}️)/u;
const card = page => page.textContent('#plcard');
async function make(page, { goal = 'start', days = null, min = 10 } = {}) {
  await go(page, 'stair');
  await page.click('[data-a="plnew"]');
  await page.click('[data-a="plgoal"][data-v="' + goal + '"]');
  if (days) { // replace the default Mon / Wed / Fri
    for (const d of [0, 2, 4]) await page.click('[data-a="plday"][data-v="' + d + '"]');
    for (const d of days) await page.click('[data-a="plday"][data-v="' + d + '"]');
  }
  await page.click('[data-a="plmin"][data-v="' + min + '"]');
  await page.click('[data-a="plsave"]');
  await page.waitForSelector('#plcard .pllist');
}

test('no plan yet: an optional MAKE A PLAN card on the Stairs page; making one saves only the player\'s choices', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await go(page, 'stair');
  let t = await card(page);
  assert.match(t, /MY STAIR PLAN[\s\S]*you pick the days and the minutes[\s\S]*Optional\.[\s\S]*MAKE A PLAN/);
  await page.click('#plcard .hwh[data-hwh="plnote"]'); // the disclaimer sits behind the card's "?"
  assert.match(await page.evaluate(() => document.getElementById('hwh-pop').textContent), /Not a medical prescription\./); await page.keyboard.press('Escape');
  const xp0 = (await state(page)).xp;
  await make(page, { goal: 'start', days: [1, 3], min: 15 });
  const s = await state(page);
  assert.deepEqual([s.s.pl.goal, s.s.pl.days, s.s.pl.min, s.s.pl.sid], ['start', [1, 3], 15, '']);
  assert.equal(s.xp, xp0, 'no XP for making a plan');
  assert.equal(s.e.length, 0, 'no stair session is written');
  t = await card(page);
  assert.match(t, /Start a habit · this week: 0 of 2 planned days done/);
  assert.equal(await page.locator('#plcard .plrow').count(), 7, 'Monday to Sunday');
  const rows = await page.locator('#plcard .plrow').allTextContents();
  assert.match(rows[1], /^Tue/); assert.match(rows[0], /Rest day|Mon/);
  assert.equal(rows.filter(r => /Rest day/.test(r)).length, 5, 'every other day is a rest day');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#plcard')].map(e => [...e.innerText].filter(c => /(?:\p{Emoji_Presentation})/u.test(c)).length)), [0], 'no emoji');
  assert.deepEqual(errors, []);
});

test('pace logic: Easy to start; "steady" keeps the pace really logged; "more" makes one day Moderate; the "?" explains it', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await make(page, { goal: 'more', days: [0, 1, 2, 3, 4, 5, 6] });
  let L = await page.evaluate(() => HWPlan.sessions().map(x => x.plan && x.plan.pace));
  assert.deepEqual(L.filter(p => p === 'Moderate').length, 1, 'one Moderate session');
  assert.equal(L.filter(p => p === 'Easy').length, 6);
  // "steady" with real logs: two Moderate sessions in the last 28 days → Moderate
  await page.evaluate(() => { const d = today(); st.e.push({ id: 'a1', c: 'stair', v: 100, m: { sid: STAIRS[3].id, pace: 'Moderate', steps: 20, climbs: 5 }, n: '', d: '2000-01-01', t: '08:00' },
    { id: 'a2', c: 'stair', v: 100, m: { sid: STAIRS[3].id, pace: 'Moderate', steps: 20, climbs: 5 }, n: '', d, t: '08:00' }); st.s.pl.goal = 'steady'; save(); render(); });
  L = await page.evaluate(() => HWPlan.sessions().map(x => x.plan && x.plan.pace));
  assert.deepEqual([...new Set(L)], ['Moderate'], 'only the in-window session counts, and its pace is kept');
  assert.equal(await page.evaluate(() => HWPlan.sessions()[0].plan.sid), await page.evaluate(() => STAIRS[3].id), 'the stairway they really used');
  await page.click('#plcard .hwh[data-hwh="plan-why"]');
  const w = await page.textContent('#hwh-pop');
  assert.match(w, /not a medical prescription[\s\S]*the pace you logged most in your last 28 days[\s\S]*does not decide how hard a climb is for you[\s\S]*A missed day costs nothing[\s\S]*Stop and rest/);
  assert.deepEqual(errors, []);
});

test('health answers win: a pace cap lowers every session; "ask your doctor first" plans no stair sessions', async () => {
  const { page, errors } = await openApp({ seed: { ...RETURNING, p: { ...RETURNING.p, conds: ['asthma'] } } });
  await make(page, { goal: 'more', days: [0, 2, 4] });
  assert.deepEqual([...new Set(await page.evaluate(() => HWPlan.sessions().filter(x => x.plan).map(x => x.plan.pace)))], ['Easy'], 'capped at Easy');
  await page.evaluate(() => { st.p.conds = ['heart']; save(); render(); });
  assert.equal(await page.evaluate(() => HWPlan.sessions().filter(x => x.plan).length), 0);
  assert.match(await card(page), /ask your doctor before stairs, so no stair sessions are planned/);
  assert.deepEqual(errors, []);
});

test('done only from a saved stair session; SKIP and UNSKIP; START is today only and picks the stairway and pace; no penalty', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await make(page, { goal: 'start', days: [0, 1, 2, 3, 4, 5, 6] });
  const t = await page.evaluate(() => today());
  // START today: picks the chosen stairway's pace (Easy) and stays on the Stairs page
  await page.click('[data-a="plstart"][data-d="' + t + '"]');
  assert.equal(await page.evaluate(() => [S.v, PACES[S.pb.pace][1]].join()), 'stair,Easy');
  assert.equal((await state(page)).e.length, 0, 'START writes nothing');
  // SKIP today, then UNSKIP
  await page.click('[data-a="plskip"][data-d="' + t + '"]');
  assert.match(await page.textContent('#plcard .plrow.now'), /Skipped/);
  assert.equal((await state(page)).s.pl.sk[t], 1);
  await page.click('[data-a="plskip"][data-d="' + t + '"]');
  assert.equal((await state(page)).s.pl.sk[t], undefined);
  // a real stair session today marks the day done
  await page.evaluate(() => { add('stair', 120, { sid: STAIRS[0].id, steps: 20, climbs: 6, pace: 'Easy' }, '', today(), '09:00', 0, ''); render(); });
  assert.match(await page.textContent('#plcard .plrow.now'), /Done 1 stair session saved/);
  assert.match(await card(page), /this week: 1 of 7 planned days done/);
  // future days can be skipped but not started
  const fut = await page.evaluate(() => HWPlan.week().find(d => d > today()));
  if (fut) { assert.equal(await page.locator('[data-a="plstart"][data-d="' + fut + '"]').count(), 0, 'START only today'); assert.equal(await page.locator('[data-a="plskip"][data-d="' + fut + '"]').count(), 1); }
  const past = await page.evaluate(() => HWPlan.week().find(d => d < today()));
  if (past) assert.match(await page.textContent('#plcard .plrow:not(.now)'), /Not logged, and that is okay|Done|Rest day/);
  assert.deepEqual(errors, []);
});

test('EDIT keeps the skips; TURN OFF asks first, then removes only the plan', async () => {
  const { page, errors } = await openApp({ seed: RETURNING });
  await make(page, { goal: 'start', days: [0, 1, 2, 3, 4, 5, 6] });
  const t = await page.evaluate(() => today());
  await page.click('[data-a="plskip"][data-d="' + t + '"]');
  await page.click('[data-a="pledit"]');
  await page.click('[data-a="plmin"][data-v="20"]');
  await page.click('[data-a="plsave"]');
  let s = (await state(page)).s.pl;
  assert.deepEqual([s.min, s.sk[t]], [20, 1]);
  await page.evaluate(() => { add('stair', 50, { steps: 10, climbs: 5 }, '', today(), '10:00', 0, ''); });
  await page.click('[data-a="ploff"]');
  assert.match(await card(page), /Turn off your stair plan\? Your stair sessions stay saved\./);
  await page.click('[data-a="ploffno"]');
  assert.ok((await state(page)).s.pl, 'KEEP MY PLAN keeps it');
  await page.click('[data-a="ploff"]'); await page.click('[data-a="ploffyes"]');
  s = await state(page);
  assert.equal(s.s.pl, undefined);
  assert.equal(s.e.filter(e => e.c === 'stair').length, 1, 'the stair session stays');
  assert.match(await card(page), /MAKE A PLAN/);
  assert.deepEqual(errors, []);
});

test('the route: the knight stands at today\'s checkpoint, still under reduced motion; the phone layout fits 360 px', async () => {
  const { page, errors } = await openApp({ seed: RETURNING, viewport: { width: 360, height: 760 }, context: { reducedMotion: 'reduce', isMobile: true, hasTouch: true } });
  await make(page, { goal: 'start', days: [0, 1, 2, 3, 4, 5, 6] });
  const r = await page.evaluate(() => { const i = HWPlan.week().indexOf(today()), h = document.querySelector('.plhero'), cs = getComputedStyle(h);
    return { left: h.style.left, want: (50 + i * 100) / 7, anim: cs.animationName, doc: document.documentElement.scrollWidth,
      btns: [...document.querySelectorAll('#plcard button')].filter(b => b.offsetParent).map(b => b.getBoundingClientRect()).map(b => [Math.round(b.height), Math.round(b.right)]) }; });
  assert.ok(Math.abs(parseFloat(r.left) - r.want) < 0.01, r.left + ' vs ' + r.want);
  assert.equal(r.anim, 'none', 'no walking animation with reduced motion');
  assert.ok(r.doc <= 360, 'no sideways scroll: ' + r.doc);
  for (const [h, right] of r.btns) { assert.ok(h >= 44, 'tap target ' + h); assert.ok(right <= 360, 'on screen ' + right); }
  assert.deepEqual(errors, []);
});
