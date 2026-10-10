// The Wizard's Training Hall (js/v6-exercise.js): the EXERCISE tile, goal picker, muscle map, tutorial, session with rest timer
// and safety stop, finish card with estimates, XP cap, Health Score burn, doctor-note gate, reduced motion and phone fit.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const boot = async (o = {}) => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'exercise'); return r; };
const ex = s => s.e.filter(e => e.c === 'exercise');
const lit = page => page.$$eval('.xmfig .xmm.lit', l => l.map(x => +getComputedStyle(x).getPropertyValue('--r')).sort((a, b) => a - b));
/** Taps the map at the first pixel of muscle `id` (from the page's own tap map). */
async function tapMuscle(page, id) {
  const at = await page.evaluate(m => { const i = HWEx.MUS.findIndex(x => x[0] === m); for (const v of ['front', 'back']) { const g = HWEx.grid(v); let n = 0, sx = 0, sy = 0;
    g.forEach((x, k) => { if (x === i) { n++; sx += k % 64; sy += Math.floor(k / 64); } }); if (!n) continue;
    let best = null, bd = 1e9; g.forEach((x, k) => { const d = (k % 64 - sx / n) ** 2 + (Math.floor(k / 64) - sy / n) ** 2; if (x === i && d < bd) { bd = d; best = { v, x: k % 64, y: Math.floor(k / 64) }; } }); return best; } }, id);
  await page.$eval(`.xmfig[data-view="${at.v}"]`, e => e.scrollIntoView({ block: 'center' })); // clear of the fixed bottom tabs
  const b = await page.locator(`.xmfig[data-view="${at.v}"]`).boundingBox();
  await page.mouse.click(b.x + (Math.round(at.x) + .5) * b.width / 64, b.y + (Math.round(at.y) + .5) * b.height / 96);
}
async function toSession(page, goal = 'hyp', muscle = 'biceps') {
  await page.click(`[data-a="xgoal"][data-k="${goal}"]`); await page.click('[data-a="xnext"]');
  await page.locator('.xlist summary').click(); await page.click(`.xchips [data-a="xmus"][data-m="${muscle}"]`); await page.click('[data-a="xtut"]'); await page.click('[data-a="xstart"]');
}

test('EXERCISE tile sits beside Stairs, shows today\'s minutes and kcal, and opens the page without logging', async () => {
  const seed = { ...RETURNING, e: [entry('exercise', 12.5, 0, { name: 'Squat', reps: [8, 8], kcal: { v: 75, lo: 56, hi: 94 } })] };
  const { page, ctx, errors } = await openApp({ seed }); await page.waitForSelector('.wl'); await go(page, 'health');
  const tiles = await page.$$eval('#hub .hb', b => b.map(x => x.dataset.v));
  assert.equal(tiles.indexOf('exercise'), tiles.indexOf('stair') + 1, 'next to Stairs');
  const t = await page.textContent('#hub [data-v="exercise"]');
  assert.match(t, /Exercise[\s\S]*Training Hall[\s\S]*12\.5 min · ≈ 75 kcal today/);
  assert.equal(await page.locator('#hub [data-v="exercise"] .bi svg').count(), 1, 'pixel icon, no emoji');
  const n = (await state(page)).e.length;
  await page.click('#hub [data-v="exercise"]');
  assert.equal(await page.evaluate(() => S.v), 'exercise');
  assert.equal(await page.textContent('main .bn b'), 'Training Hall');
  assert.equal((await state(page)).e.length, n, 'opening logs nothing');
  assert.match(await page.textContent('.dis'), /not medical advice[\s\S]*estimates from MET values[\s\S]*chest pain, dizziness or faintness/);
  // the history row reads well
  assert.equal(await page.evaluate(() => UNIT.exercise), 'min');
  assert.match(await page.evaluate(() => desc(st.e[0])), /Training: Squat, 2 sets · 8\/8 reps/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('goal picker: five goals with reps, sets and rest; the user\'s own numbers are kept', async () => {
  const { page, ctx, errors } = await boot();
  assert.match(await page.textContent('.xmed'), /Why are you training today\?/);
  assert.equal(await page.locator('[data-a="xnext"][disabled]').count(), 1, 'nothing pre-selected');
  const g = await page.$$eval('.xgo', b => b.map(x => x.textContent.replace(/\s+/g, ' ')));
  assert.equal(g.length, 5);
  assert.match(g[0], /Hypertrophy.*6–8 reps.*2 sets.*2 min rest.*TO FAILURE/);
  assert.match(g[1], /Calisthenics.*Bodyweight/);
  assert.match(g[2], /Strength.*2–4 reps.*2 sets.*3 min rest.*TO FAILURE/);
  assert.match(g[3], /Endurance.*12\+ reps.*4 sets.*45 s rest/);
  assert.match(g[4], /Custom/);
  await page.click('[data-a="xgoal"][data-k="cus"]');
  await page.fill('#xc-reps', '9'); await page.fill('#xc-sets', '4'); await page.fill('#xc-rest', '75');
  await page.click('[data-a="xnext"]');
  assert.match(await page.textContent('.xpan'), /Custom · 4 sets × 9 reps · rest 1 min 15 s/);
  assert.deepEqual((await state(page)).s.xg, { g: 'cus', c: { reps: 9, sets: 4, rest: 75 }, k: { reps: 10, sets: 3 } });
  // kept in the save (st.s.xg, checked above) and shown again on the next visit; no reload here: the test seed is guarded by
  // sessionStorage, which a reload of a file:// page does not always keep
  await go(page, 'health'); await page.evaluate(() => { S.xs = null; }); await go(page, 'exercise');
  assert.deepEqual((await state(page)).s.xg, { g: 'cus', c: { reps: 9, sets: 4, rest: 75 }, k: { reps: 10, sets: 3 } }, 'read back from storage');
  assert.equal(await page.locator('.xgo.on[data-k="cus"]').count(), 1);
  assert.equal(await page.inputValue('#xc-reps'), '9');
  await page.fill('#xc-reps', '500'); await page.click('[data-a="xnext"]');
  assert.equal((await state(page)).s.xg.c.reps, 9, 'out-of-range numbers are not saved');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('muscle map: every muscle has pixels, a mask and exercises; a tap lights it in teal with its partners', async () => {
  const { page, ctx, errors } = await boot();
  const info = await page.evaluate(() => HWEx.MUS.map((m, i) => ({ id: m[0], px: ['front', 'back'].reduce((a, v) => a + HWEx.grid(v).filter(x => x === i).length, 0),
    moves: m[3].map(id => !!HWEx.MOVES[id]) })));
  assert.equal(info.length, 19);
  for (const m of info) { assert.ok(m.px >= 4, m.id + ' has map pixels'); assert.ok(m.moves.length && m.moves.every(Boolean), m.id + ' exercises'); }
  const rows = await page.evaluate(() => Object.values(HWEx.MOVES).map(m => m[1]).sort((a, b) => a - b));
  assert.deepEqual(rows, Array.from({ length: 22 }, (_, i) => i), 'one sprite row per move');
  await page.click('[data-a="xgoal"][data-k="hyp"]'); await page.click('[data-a="xnext"]');
  assert.equal(await page.locator('[data-a="xtut"][disabled]').count(), 1);
  await tapMuscle(page, 'lats');
  assert.equal(await page.evaluate(() => S.xs.mus), 'lats');
  assert.deepEqual(await lit(page), [3, 3], 'lats lit (one mask per view)');
  assert.ok(await page.locator('.xmm.syn').count() >= 3, 'partners glow dimmer');
  assert.match(await page.textContent('.xsel'), /Lats[\s\S]*Works with: Upper back, Biceps, Rear delt[\s\S]*Dumbbell row, palms in/);
  // brachialis and brachioradialis light together
  await page.locator('.xlist summary').click();
  await page.click('.xchips [data-a="xmus"][data-m="brachialis"]');
  assert.deepEqual(await lit(page), [9, 9, 10, 10]);
  assert.match(await page.textContent('.xsel'), /Hammer curl/);
  await page.click('.xchips [data-a="xmus"][data-m="triceps"]');
  assert.deepEqual(await page.$$eval('.xex', b => b.map(x => x.textContent.trim())), ['Triceps pushdown', 'Overhead dumbbell extension', 'Skullcrusher']);
  await page.click('[data-a="xex"][data-e="skull"]');
  assert.equal(await page.evaluate(() => S.xs.ex), 'skull');
  // the art the page uses
  for (const f of ['moves.webp', 'muscles.webp']) { const b = fs.readFileSync(path.join(root, 'assets/img/exercise', f)); assert.equal(b.toString('ascii', 8, 16), 'WEBPVP8L', f); }
  assert.equal(await page.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r(i.width + 'x' + i.height); i.onerror = () => r('missing'); i.src = 'assets/img/exercise/muscles.webp'; })), '512x7680');  // 4x detail, drawn at 128 x 1920
  assert.equal(await page.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r(i.width + 'x' + i.height); i.onerror = () => r('missing'); i.src = 'assets/img/exercise/moves.webp'; })), '1536x8448');  // 4x detail, drawn at 384 x 2112
  assert.equal(await page.$eval('.xmm.base', e => getComputedStyle(e).imageRendering), 'pixelated');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('tutorial: looping sprite, three cues, reps for the goal, stop rule; still frame with reduced motion', async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { page, ctx, errors } = await boot({ context: { reducedMotion } });
    await page.click('[data-a="xgoal"][data-k="str"]'); await page.click('[data-a="xnext"]');
    await page.locator('.xlist summary').click(); await page.click('.xchips [data-a="xmus"][data-m="quads"]'); await page.click('[data-a="xtut"]');
    assert.equal(await page.locator('.xcue li').count(), 3);
    assert.match(await page.textContent('.xpan'), /TUTORIAL · SQUAT[\s\S]*2–4 reps × 2 sets to failure[\s\S]*Rest 3 min/);
    assert.match(await page.textContent('.xstop'), /Stop rule: Sets to failure/);
    assert.match(await page.textContent('.xmed'), /MEDIUS/);
    const a = await page.$eval('.xspr', e => ({ n: getComputedStyle(e).animationName, t: getComputedStyle(e).animationTimingFunction, w: e.offsetWidth, h: e.offsetHeight }));
    if (reducedMotion === 'reduce') assert.equal(a.n, 'none', 'first frame, still');
    else { assert.equal(a.n, 'xspr'); assert.match(a.t, /steps\(4/); }
    assert.equal(a.w, a.h); assert.equal(a.w % 96, 0, 'whole-number pixel scale');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('session: sets, rest countdown, finish card with estimates, XP reward and its daily cap', async () => {
  const { page, ctx, errors } = await boot();
  await toSession(page);
  assert.match(await page.textContent('.xhud'), /1\/2SET[\s\S]*6–8REPS/);
  await page.fill('#xrep', '7'); await page.click('[data-a="xset"]');
  assert.match(await page.textContent('#xrest'), /^(2:00|1:59)$/);
  await page.waitForTimeout(1300);
  assert.match(await page.textContent('#xrest'), /^1:5\d$/, 'counts down');
  assert.ok(await page.evaluate(() => !!S.tm));
  await page.click('[data-a="xskip"]');
  await page.evaluate(() => { S.xs.t0 -= 20 * 60000; });
  await page.fill('#xrep', '6'); await page.click('[data-a="xset"]');
  assert.equal(await page.locator('#xrest').count(), 0, 'no rest after the last set');
  const xp0 = (await state(page)).xp;
  await page.click('[data-a="xfin"]');
  const s = await state(page), e = ex(s)[0];
  assert.equal(ex(s).length, 1);
  assert.equal(e.v, 20); assert.deepEqual(e.m.reps, [7, 6]);
  assert.equal(e.m.met, 6); assert.equal(e.m.code, '02050');
  assert.equal(e.m.kcal.v, 120, '6.0 MET × 60 kg × 20/60 h');
  assert.equal(e.m.vo2, 21);
  assert.equal(e.m.kj, Math.round(21 * 60 / 1000 * 20 * 20.1));
  assert.equal(s.xp - xp0, 25);
  const card = await page.textContent('#xdone');
  assert.match(card, /20MIN[\s\S]*2SETS[\s\S]*13REPS/);
  assert.match(card, /ESTIMATES[\s\S]*EST[\s\S]*≈ 120 kcal[\s\S]*±25%[\s\S]*VO₂: ≈ 21\.0 mL\/kg\/min[\s\S]*≈ 507 kJ/);
  assert.match(card, /GAME REWARD[\s\S]*\+25 XP[\s\S]*not a health measurement/);
  assert.ok(card.indexOf('MIN') < card.indexOf('kcal') && card.indexOf('kcal') < card.indexOf('XP'), 'what you did, then estimates, then the game reward');
  assert.equal(await page.$eval('#xdone', e => getComputedStyle(e).animationName), 'xglow');
  assert.equal(await page.locator('#xdone [data-a="go"][data-v="health"]').count(), 1);
  // the Health Score counts training kcal
  assert.equal(await page.evaluate(() => HWScore.burnOf(today())), 120);
  // XP cap: two rewarded sessions a day
  for (let i = 0; i < 2; i++) { await page.click('[data-a="xagain"]'); await page.click('[data-a="xtut"]'); await page.click('[data-a="xstart"]'); await page.click('[data-a="xset"]'); await page.click('[data-a="xfin"]'); }
  const s2 = await state(page);
  assert.equal(ex(s2).length, 3, 'every session is saved');
  assert.equal(s2.xp - xp0, 50, 'XP stops after two sessions');
  assert.match(await page.textContent('#xdone'), /\+0 XP[\s\S]*full for today/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('I feel dizzy / chest pain stop the session at once, show help and log nothing', async () => {
  for (const k of ['dizzy', 'chest']) {
    const { page, ctx, errors } = await boot();
    await toSession(page); await page.click('[data-a="xset"]');
    assert.ok(await page.evaluate(() => !!S.tm));
    await page.click(`[data-a="xhelp"][data-k="${k}"]`);
    const t = await page.textContent('.xhelp');
    assert.match(t, k === 'chest' ? /CHEST PAIN: STOP NOW/ : /DIZZY: STOP NOW/);
    assert.match(t, /Nothing was logged[\s\S]*999/);
    assert.equal(await page.locator('.xhelp a[href="tel:999"]').count(), 1);
    assert.equal(ex(await state(page)).length, 0);
    const xp = (await state(page)).xp;
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#xrest').count(), 0, 'timer gone');
    await page.click('.xhelp [data-a="go"]');
    assert.equal(await page.evaluate(() => S.v), 'health');
    assert.equal((await state(page)).xp, xp);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('estimates: weight from the confirmed profile only; doctor-note gate replaces sets to failure', async () => {
  const { page, ctx, errors } = await boot({ seed: { ...RETURNING, p: { ...RETURNING.p, conds: ['heart'] } } });
  const r = await page.evaluate(() => ({ none: HWEx.estimate(6, 30, null), w: HWEx.estimate(3.5, 30, 50), zero: HWEx.estimate(6, 0, 60) }));
  assert.equal(r.none.kcal, null); assert.equal(r.none.need, 'weight'); assert.equal(r.none.vo2, 21);
  assert.deepEqual(r.w.kcal, { v: 88, lo: 66, hi: 109 }); assert.equal(r.w.kj, Math.round(3.5 * 3.5 * 50 / 1000 * 30 * 20.1));
  assert.equal(r.zero.need, 'duration');
  assert.match(await page.textContent('.xgo[data-k="hyp"]'), /2–3 SHORT OF FAILURE/);
  await page.click('[data-a="xgoal"][data-k="hyp"]'); await page.click('[data-a="xnext"]');
  await page.locator('.xlist summary').click(); await page.click('.xchips [data-a="xmus"][data-m="calves"]'); await page.click('[data-a="xtut"]');
  assert.match(await page.textContent('.xstop'), /2–3 reps before failure[\s\S]*doctor/);
  assert.doesNotMatch(await page.textContent('.xreps'), /to failure/);
  const plans = await page.evaluate(() => ['cal', 'end', 'cus'].map(k => HWEx.plan(k)).map(p => [p.met, p.code]));
  assert.deepEqual(plans, [[3.8, '02022'], [3.5, '02054'], [3.5, '02054']]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('phone width: every step fits 360 px, 44 px tap targets, no emoji drawn as text', async () => {
  const { page, ctx, errors } = await boot({ viewport: { width: 360, height: 740 }, context: { hasTouch: true, isMobile: true } });
  const check = async step => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), step + ': no sideways scroll');
    const small = await page.$$eval('.xwrap button', b => b.filter(x => x.offsetParent && x.getBoundingClientRect().height < 44).map(x => x.textContent.trim()));
    assert.deepEqual(small, [], step + ': tap targets');
    assert.doesNotMatch(await page.evaluate(() => document.querySelector('.xwrap').textContent.replace(/[▶◀]/g, '')), /\p{Extended_Pictographic}/u, step + ': no emoji');
  };
  await check('goal');
  await page.tap('[data-a="xgoal"][data-k="end"]'); await page.tap('[data-a="xnext"]'); await check('map');
  await tapMuscle(page, 'quads');
  assert.equal(await page.evaluate(() => S.xs.mus), 'quads');
  await page.tap('[data-a="xtut"]'); await check('tutorial');
  await page.tap('[data-a="xstart"]'); await check('session');
  await page.tap('[data-a="xset"]'); await check('rest');
  await page.tap('[data-a="xfin"]'); await check('finish');
  assert.deepEqual(errors, []);
  await ctx.close();
});
