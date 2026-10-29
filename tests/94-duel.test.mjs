// Module 9, the Dueling Arena (js/v6-duel.js): worked examples for the math, then the Arena below the Hall of Heroes on the Quests page
// (history, compatibility, results, replay, malformed data, reduced motion, phones) and the live race beside Stair Sense.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry, state } from './helpers.mjs';

after(closeBrowser);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const txt = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const G = 9.80665;
// a Stair Sense record as js/v6-gravity.js saves it (m.gv), 28 steps of ST20's measured 16.9 cm rise
const gv = (secs, o = {}) => Object.assign({ gid: 'g' + secs + Math.random(), method: 'manual', sensor: null, n: 28, rise: 0.169, riseSrc: 'study', mass: 60, massSrc: 'record', secs, h: 4.732, W: null, P: null }, o);
const climb = (n, days, secs, o = {}, t = '08:00') => entry('stair', n, days, Object.assign({ sid: 'ST20', loc: 'ST20', steps: n, climbs: 1, kind: 'workout', src: 'manual', dur: Math.round(secs / 60 * 100) / 100, gv: gv(secs, { n }) }, o), t);
const seed = (E, p) => { const s = JSON.parse(JSON.stringify(RETURNING)); s.e = E; if (p) Object.assign(s.p, p); return s; };
const arena = async page => { await go(page, 'quests'); await page.waitForSelector('#dueling-arena'); };
// a new badge shows its reveal card ("tap to continue"): like a player, tap it away whenever it is in the way (as tests/26 does)
const tapBadges = page => page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async o => { await o.click({ force: true }); });
const dismissPops = page => page.evaluate(() => document.querySelectorAll('.bpop').forEach(e => e.remove()));

test('math: W = m g h, P = W ÷ t, ascent rate, path speed, progress clamps, verdict with resolution', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => { const m = HWDuel.math; return {
    W: m.work(60, 4.732), Wbad: [m.work(0, 4.7), m.work(500, 4.7), m.work('60', 4.7), m.work(60, 0), m.work(60, null)],
    P: m.power(2784.4, 90), Pbad: [m.power(null, 90), m.power(100, 0), m.power(100, -5)],
    v: m.rate(4.732, 90), vbad: m.rate(4.732, 0), path: m.path(28, 0.354, 90), pbad: m.path(28.5, 0.354, 90),
    prog: [m.progress(-5, 90), m.progress(0, 90), m.progress(45, 90), m.progress(90, 90), m.progress(200, 90), m.progress(10, 0)],
    ver: [m.verdict(90, 100, 1), m.verdict(100, 90, 1), m.verdict(90.4, 90, 1), m.verdict(90, 110, 30), m.verdict(0, 90, 1), m.verdict(90, null, 1)] }; });
  near(r.W, 60 * G * 4.732, 1e-9, 'W = 60 kg × 9.80665 × 4.732 m');         // 2784.3 J
  assert.deepEqual(r.Wbad, [null, null, null, null, null], 'no mass, an impossible mass or no height: no work');
  near(r.P, 2784.4 / 90, 1e-9, 'P = W ÷ t'); assert.deepEqual(r.Pbad, [null, null, null]);
  near(r.v, 4.732 / 90, 1e-12, 'h ÷ t'); assert.equal(r.vbad, null);
  near(r.path, 28 * 0.354 / 90, 1e-12, 'steps × hypotenuse ÷ t'); assert.equal(r.pbad, null);
  assert.deepEqual(r.prog, [0, 0, 0.5, 1, 1, 0], 'clamped to [0, 1]; zero duration never divides');
  assert.deepEqual(r.ver, ['faster', 'slower', 'tie', 'tie', null, null], '20 s apart is a tie at 30 s resolution');
  assert.deepEqual(errors, []); await ctx.close();
});

test('math: one vertical-gain function with documented priority, never total height × steps', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => { const g = HWDuel.math.gain; return [
    g({ n: 28, gvH: 4.732, gvSrc: 'study', f21Rise: 0.2 }),                 // 1. the h saved with the climb
    g({ n: 28, f21Rise: 0.169, survey: { rise_m: 5, steps: 25 }, angleRise: 0.15 }), // 2. F21 measured rise
    g({ n: 10, survey: { rise_m: 3.2, steps: 20 }, angleRise: 0.15 }),       // 3. survey rise ÷ counted steps
    g({ n: 10, angleRise: 0.15 }),                                           // 4. angle estimate
    g({ n: 10 }), g({ n: 0, f21Rise: 0.169 }), g({ n: 10, survey: { rise_m: 30, steps: 20 } }) ]; });
  near(r[0].h, 4.732, 1e-12, 'saved h'); assert.equal(r[0].kind, 'calc');
  near(r[1].h, 28 * 0.169, 1e-12, 'F21'); assert.match(r[1].how, /measured step rise/);
  near(r[2].h, 10 * 0.16, 1e-12, 'survey 3.2 m / 20 steps × 10'); assert.match(r[2].how, /survey/);
  near(r[3].h, 1.5, 1e-12, 'angle'); assert.equal(r[3].kind, 'est');
  assert.equal(r[4].h, null); assert.match(r[4].why, /no step height/);
  assert.equal(r[5].h, null, 'no steps'); assert.equal(r[6].h, null, '1.5 m per step is not a stair: rejected, not used');
  assert.deepEqual(errors, []); await ctx.close();
});

test('placement: the Arena is directly below the Hall of Heroes on the Quests page, which is unchanged', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed([]) });
  await arena(page);
  assert.equal(await page.evaluate(() => document.getElementById('v6lb').nextElementSibling.id), 'dueling-arena');
  assert.match(await page.$eval('#v6lb h3', e => e.textContent), /HALL OF HEROES/);
  await go(page, 'exercise'); assert.equal(await page.$('#dueling-arena'), null, 'not in the Training Hall');
  assert.ok(await page.$('#guild-war-tab'), 'the Training Hall keeps its leaderboards');
  await arena(page);
  assert.equal(await page.$$eval('[id]', L => { const s = new Set(); return L.filter(e => s.has(e.id) || !s.add(e.id)).length; }), 0, 'no duplicate ids');
  assert.deepEqual(errors, []); await ctx.close();
});

test('no history: a deliberate first-use state, no rival and no time', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed([entry('stair', 28, 1, { sid: 'ST20', steps: 28, climbs: 1, kind: 'casual' })]) });
  await arena(page);
  const t = await txt(page, '#dueling-arena');
  assert.match(t, /No timed climbs yet/); assert.match(t, /baseline/); assert.match(t, /has no time recorded/);
  assert.equal(await page.$('#duel-track'), null, 'no fake Echo');
  assert.equal(await page.$('[data-a="duelgo"]') != null, true);
  assert.deepEqual(errors, []); await ctx.close();
});

test('one timed climb: the baseline is sealed, no race is declared', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed([climb(28, 2, 100)]) });
  await arena(page);
  const t = await txt(page, '#dueling-arena');
  assert.match(t, /Baseline sealed/); assert.match(t, /1:40/); assert.match(t, /Your first record is sealed/);
  assert.equal(await page.$('#duel-res'), null); assert.equal(await page.$('#duel-track'), null);
  assert.deepEqual(errors, []); await ctx.close();
});

test('several climbs: previous and personal best, faster / slower / tie, and the personal best only when it is real', async () => {
  // log order: 120 s, 100 s, 110 s, 90 s, 90.4 s (all ST20, 28 steps); a 13-step climb and a climb on ST14 never join in
  const E = [climb(28, 9, 120), climb(28, 7, 100), climb(28, 5, 110), climb(28, 3, 90), climb(28, 1, 90.4), climb(13, 2, 30, { gv: gv(30, { n: 13, h: 2.2 }) }),
    climb(28, 2, 60, { sid: 'ST14' })];
  const ids = E.map(e => e.id);
  const { page, ctx, errors } = await openApp({ seed: seed(E) });
  await arena(page);
  const res = async (cid, mode) => { await page.selectOption('[data-ch="dueltot"]', '28').catch(() => {});
    await page.selectOption('[data-ch="duelcid"]', cid); await page.selectOption('[data-ch="duelmode"]', mode);
    return page.evaluate(() => Object.assign({ txt: document.getElementById('duel-res').textContent }, HWDuel.state.result)); };
  assert.equal(await page.evaluate(() => HWDuel.state.sid), 'ST20');
  let r = await res(ids[4], 'prev');                    // 90.4 vs 90 (Stair Sense, 1 s): a tie
  assert.equal(r.v, 'tie'); assert.equal(r.pb, false); assert.match(r.txt, /A TIE/);
  r = await res(ids[2], 'prev');                        // 110 vs previous 100: slower, kindly worded
  assert.equal(r.v, 'slower'); assert.match(r.txt, /Echo was faster this time, but your climb still counts/);
  r = await res(ids[2], 'best');                        // best before it is 100 as well
  assert.equal(r.v, 'slower'); assert.equal(r.id, ids[2] + '>' + ids[1]);
  r = await res(ids[3], 'prev');                        // 90 vs 110: faster and faster than every earlier one: a personal best
  assert.equal(r.v, 'faster'); assert.equal(r.pb, true); assert.match(r.txt, /PERSONAL BEST/);
  r = await res(ids[1], 'prev');                        // 100 vs 120: faster, and the fastest so far
  assert.equal(r.pb, true);
  // the 13-step climb is a different climb length; ST14 is another staircase
  const opts = await page.$$eval('[data-ch="duelcid"] option', o => o.map(x => x.value));
  assert.ok(!opts.includes(ids[5]) && !opts.includes(ids[6]), 'only same staircase, same steps');
  assert.equal(await page.$eval('[data-ch="duelcid"] option[value="' + ids[0] + '"]', o => o.disabled), true, 'the first climb has no Echo');
  await page.selectOption('[data-ch="dueltot"]', '13');
  assert.match(await txt(page, '#duel-b'), /Baseline sealed/);
  await page.selectOption('[data-ch="duelsid"]', 'ST14');
  assert.match(await txt(page, '#duel-b'), /Baseline sealed/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the table: real inputs and units, estimates labelled, path speed only for measured step lengths', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed([climb(28, 3, 120), climb(28, 1, 90)]) });
  await arena(page);
  const t = await txt(page, '.dueltab');
  assert.match(t, /4\.73 m/); assert.match(t, /2,784 J/);                          // 60 × 9.80665 × 4.732
  assert.match(t, /30\.9 W/); assert.match(t, /23\.2 W/);                          // 2784.4 / 90, / 120
  assert.match(t, /0\.053 m\/s/);                                                  // 4.732 / 90
  assert.match(t, /0\.11 m\/s/); assert.match(t, /0\.354 m measured step length/);   // 28 × 0.354 / 90
  assert.match(t, /Estimated mechanical work against gravity/); assert.match(t, /Estimated average mechanical power/);
  assert.doesNotMatch(t, /calorie|kcal|metabolic power/i);
  assert.deepEqual(errors, []); await ctx.close();
});

test('missing mass and missing step height show "—" with the reason; a workout time compares to 30 s', async () => {
  // no confirmed profile (height out of range) and no weight record; climbs logged with the workout timer only
  const E = [entry('stair', 20, 3, { sid: 'ST31', steps: 20, climbs: 1, kind: 'workout', dur: 1.5 }), entry('stair', 20, 1, { sid: 'ST31', steps: 20, climbs: 1, kind: 'workout', dur: 1 })];
  const { page, ctx, errors } = await openApp({ seed: seed(E, { h: 50 }) });
  await arena(page);
  assert.equal(await page.evaluate(() => HWStairs.profile()), null, 'precondition: no usable body mass');
  const t = await txt(page, '#duel-b');
  assert.match(t, /no step height is known/); assert.match(t, /needs a step height/);
  assert.equal((await page.$$eval('.dueltab .duelna', L => L.length)) >= 6, true, 'gain, rate, work, power are "—" for both');
  assert.match(t, /workout time/); assert.match(t, /faster by 0:30/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('invalid durations, untimed and malformed entries are left out and never crash the page', async () => {
  const E = [climb(28, 4, 100), climb(28, 3, 5),                                 // 5 s: not a valid time
    entry('stair', 28, 2, { sid: 'ST20', steps: 28, climbs: 1, kind: 'workout', dur: 0 }),   // no time
    entry('stair', 28, 2, { sid: 'NOPE', steps: 28, climbs: 1, kind: 'workout', dur: 2 }),   // unknown staircase
    entry('stair', 28, 2, { sid: 'ST20', gv: 'broken', dur: 'x' }),
    climb(28, 1, 95)];
  const { page, ctx, errors } = await openApp({ seed: seed(E) });
  await arena(page);
  const H = await page.evaluate(() => { const h = HWDuel.history(); return { n: h.all.length, untimed: h.untimed, bad: h.bad }; });
  assert.equal(H.n, 2, 'only the 100 s and 95 s climbs'); assert.equal(H.untimed, 4);
  // a damaged entry in the log itself (the save's own repair may already have fixed some): the Arena still renders
  await page.evaluate(() => { st.e.push({ id: 'zz', c: 'stair', v: 'abc', m: null, d: 'not-a-date' }, null); HWDuel.repaint(); });
  assert.match(await txt(page, '#duel-b'), /could not be read and (is|are) left out/);
  assert.equal(await page.$('#duel-res') != null, true);
  await page.evaluate(() => { st.e = st.e.filter(e => e && e.id !== 'zz'); });
  assert.deepEqual(errors, []); await ctx.close();
});

test('replay: requestAnimationFrame from the clock, starts at exactly 0 and ends at exactly 100 % inside the track', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed([climb(28, 3, 16), climb(28, 1, 12)]) });
  await arena(page);
  await page.click('[data-a="duelplay"]');
  const first = await page.evaluate(() => [document.querySelector('#duel-you .duelmv').style.transform, HWDuel.state.replaying]);
  assert.equal(first[1], true);
  assert.match(first[0], /translateX\((0|0\.\d+)%\)/);
  await page.waitForFunction(() => /^(3|2|1)$/.test(document.querySelector('#duel-track .duelcount').textContent), null, { timeout: 2000 });   // a countdown first
  assert.match(await page.$eval('#duel-you .duelmv', e => e.style.transform), /^translateX\(0(\.00)?%\)$/, 'no move during the countdown');
  await page.waitForFunction(() => !HWDuel.state.replaying, null, { timeout: 15000 });  // 1.6 s countdown, then 16 s at ×2 speed = 8 s
  const end = await page.evaluate(() => ['you', 'echo'].map(k => { const t = document.getElementById('duel-' + k), a = t.querySelector('.duelav').getBoundingClientRect(), r = t.getBoundingClientRect();
    return { tf: t.querySelector('.duelmv').style.transform, now: t.getAttribute('aria-valuenow'), inside: a.left >= r.left - 0.5 && a.right <= r.right + 0.5 }; }));
  for (const e of end) { assert.match(e.tf, /^translateX\(100(\.00)?%\)$/); assert.equal(e.now, '100'); assert.ok(e.inside, 'the avatar stays inside the track'); }
  assert.equal(await page.evaluate(() => HWDuel.state.raf), 0, 'no frame left running');
  assert.match(await page.$eval('#duel-res', e => e.className), /won/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('replay stops when the page is left; reduced motion shows the end at once', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed([climb(28, 3, 400), climb(28, 1, 390)]) });
  await arena(page);
  await page.click('[data-a="duelplay"]');
  assert.equal(await page.evaluate(() => HWDuel.state.replaying), true);
  await go(page, 'home');
  assert.deepEqual(await page.evaluate(() => [HWDuel.state.replaying, HWDuel.state.raf]), [false, 0]);
  await ctx.close();
  const o = await openApp({ seed: seed([climb(28, 3, 400), climb(28, 1, 390)]), context: { reducedMotion: 'reduce' } });
  await arena(o.page);
  await o.page.click('[data-a="duelplay"]');
  const rm = await o.page.evaluate(() => [HWDuel.state.replaying, HWDuel.state.raf, document.querySelector('#duel-echo .duelmv').style.transform, document.querySelector('#duel-track .duelcount').textContent]);
  assert.deepEqual(rm.slice(0, 2), [false, 0]); assert.match(rm[2], /^translateX\(100(\.00)?%\)$/); assert.equal(rm[3], '', 'no countdown');
  assert.equal(await o.page.$eval('#duel-track .duelstars', e => getComputedStyle(e).animationName), 'none', 'the sky is still');
  assert.equal(await o.page.$eval('#duel-res', e => getComputedStyle(e).animationName), 'none');
  assert.deepEqual([...errors, ...o.errors], []); await o.ctx.close();
});

test('no XP from the Arena: opening, replaying, switching tabs and reloading change nothing', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed([climb(28, 3, 120), climb(28, 1, 90)]) });
  await tapBadges(page);
  await arena(page); await page.waitForTimeout(1500);                 // badges the seeded climbs earn at start are awarded first
  const xp0 = (await state(page)).xp;
  await page.click('[data-a="duelplay"]'); await page.waitForFunction(() => !HWDuel.state.replaying, null, { timeout: 15000 });
  await page.selectOption('[data-ch="duelmode"]', 'best'); await go(page, 'home'); await arena(page);
  await page.reload(); await page.waitForFunction(() => typeof HWDuel !== 'undefined'); await arena(page);
  const s = await state(page);
  assert.equal(s.xp, xp0); assert.equal(s.e.length, 2, 'no record written or copied');
  assert.equal(JSON.stringify(s).includes('duel'), false, 'nothing of the Arena in the save');
  assert.deepEqual(errors, []); await ctx.close();
});

test('keyboard and screen readers: real controls, labelled lanes, the result in a status region; phones do not scroll sideways', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed([climb(28, 3, 120), climb(28, 1, 90)]), viewport: { width: 360, height: 760 } });
  await arena(page);
  const a = await page.evaluate(() => ({
    lanes: [...document.querySelectorAll('#duel-track [role=progressbar]')].map(e => e.getAttribute('aria-label') + '|' + e.getAttribute('aria-valuetext')),
    status: document.getElementById('duel-res').getAttribute('role'), ctl: [...document.querySelectorAll('#dueling-arena select, #dueling-arena button')].every(e => e.tabIndex >= 0),
    wide: document.documentElement.scrollWidth, hasHelp: !!document.querySelector('#dueling-arena .hwh, #dueling-arena [data-a="help"]') }));
  assert.deepEqual(a.lanes, ['You — Champion progress|100% · 1:30 of 1:30', 'Historical Echo progress|100% · 2:00 of 2:00']);
  assert.equal(a.status, 'status'); assert.equal(a.ctl, true); assert.ok(a.wide <= 360, 'no sideways scroll: ' + a.wide);
  await page.focus('[data-a="duelplay"]'); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => HWDuel.state.replaying), true, 'Enter starts the replay');
  assert.deepEqual(errors, []); await ctx.close();
});

test('live: arm an Echo, race beside Stair Sense, stop with the page, and see the result after saving', async () => {
  const E = [climb(28, 3, 60), climb(28, 1, 50)];
  const { page, ctx, errors } = await openApp({ seed: seed(E) });
  await tapBadges(page);
  await arena(page);
  await page.click('[data-a="duelarm"]');                       // the Echo: the latest climb (50 s)
  await page.waitForFunction(() => S.v === 'campus' && document.getElementById('duel-live'), null, { timeout: 10000 });
  await dismissPops(page);
  assert.deepEqual(await page.evaluate(() => HWDuel.armed && [HWDuel.armed.sid, HWDuel.armed.total, HWDuel.armed.secs]), ['ST20', 28, 50]);
  assert.match(await txt(page, '#duel-live'), /Ready\. Press START CLIMB/);
  assert.equal(await page.evaluate(() => document.getElementById('gvtrial').compareDocumentPosition(document.getElementById('duel-live')) & 4), 4, 'right after Stair Sense');
  await page.evaluate(() => acts.gvstart());
  await page.waitForFunction(() => HWGravity.live.ph === 'running' && HWDuel.state.lraf > 0, null, { timeout: 5000 });
  await page.waitForTimeout(1200);
  const mid = await page.evaluate(() => ({ e: +document.getElementById('duell-echo').querySelector('.duelfill').style.transform.match(/[\d.]+/)[0], ms: HWGravity.live.ms }));
  near(mid.e, mid.ms / 1000 / 50, 0.02, 'the Echo moves with Stair Sense\'s own timer');
  // leaving the Observatory pauses Stair Sense (its rule) and stops the live lanes
  await go(page, 'home');
  assert.deepEqual(await page.evaluate(() => [HWGravity.live.ph, HWDuel.state.lraf]), ['paused', 0]);
  // the Arena in the Training Hall says a climb is in progress, and does not race it there
  await arena(page);
  assert.match(await txt(page, '#dueling-arena'), /Stair Sense is paused/);
  // back, finish, save 28 steps in 0.75 min (45 s): faster than the 50 s Echo
  await page.evaluate(() => HWCampusData.start('ST20')); await page.waitForSelector('#duel-live');
  await page.evaluate(() => acts.gvresume()); await page.evaluate(() => acts.gvfinish());
  assert.match(await txt(page, '#duel-live'), /Climb finished/);
  await page.fill('#gv-n', '28'); await page.fill('#gv-m', '0.75');
  const xp0 = (await state(page)).xp;
  await page.click('[data-a="gvsave"]');
  if (await page.$('[data-a="gvsave"]')) await page.click('[data-a="gvsave"]');   // same steps here today: it asks once
  await page.waitForFunction(() => HWDuel.armed && HWDuel.armed.done, null, { timeout: 5000 });
  await dismissPops(page);
  await page.waitForSelector('#duel-live [data-a="duelsee"]');
  assert.match(await txt(page, '#duel-live'), /Faster than your Echo! You 0:45 · Echo 0:50/);
  const gained = (await state(page)).xp - xp0;
  await page.click('[data-a="duelsee"]');
  await page.waitForSelector('#duel-res');
  assert.match(await txt(page, '#duel-res'), /FASTER THAN YOUR ECHO|PERSONAL BEST/);
  await page.reload(); await page.waitForFunction(() => typeof HWDuel !== 'undefined'); await arena(page);
  assert.equal((await state(page)).xp - xp0, gained, 'viewing the result again adds nothing; only the save\'s normal stair XP and badges');
  assert.deepEqual(errors, []); await ctx.close();
});
