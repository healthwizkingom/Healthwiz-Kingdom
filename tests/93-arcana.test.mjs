// The Arcana upgrades (js/v6-arcana.js): worked examples for the math, then each module on its page.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry, state } from './helpers.mjs';

after(closeBrowser);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const txt = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
const math = page => page.evaluate(() => {
  const m = HWArcana.math;
  return {
    pot: [m.potionPct(750, 2500), m.potionPct(3000, 2500), m.potionPct(500, 0)],
    heat: [m.heatStress({ temp: 33, rh: 75 }), m.heatStress({ temp: 33, rh: 70 }), m.heatStress({ temp: 32, rh: 90 }), m.heatAdjust(400, { temp: 34, rh: 80 }), m.heatAdjust(400, { temp: 30, rh: 80 })],
    dry: [m.drySpell(125, 750, 2500), m.drySpell(120, 750, 2500), m.drySpell(125, 1250, 2500)],
    ready: m.readiness(6.5, 45, 22), readyCap: m.readiness(10, 0, 50).score,
    g0: m.gravity(5.36, 0), g50: m.gravity(5.36, 50), read: m.scaleRead(63.2, m.gravity(5.36, 0), m.gravity(5.36, 50)),
    work: m.workJ(28, 63.2, 0.169), kj: m.kJ(100), tilt: m.tilt(12.6, 418.4), tower: m.towerTilt(28.52),
    pacer: m.pacerRate(100, 63.2, 0.169), cad: m.cadence([0, 500, 1000, 1500]), rms: m.rms(new Float32Array([0.5, -0.5, 0.5, -0.5])),
    surv: m.survey(17.95, 31.8, 29.44), surv2: m.survey(15, 31.8, 29.44), rer: [m.RER.mixed[0], m.RER['high-carb'][0], m.RER['low-carb'][0]],
    forge: m.forge(1.2, 5, 21.1),
    guilds: m.guilds([{ blk: 'Blok A', W: 100, E: 5 }, { blk: 'Blok B', W: 300, E: 1 }, { blk: 'Blok A', W: 250, E: 5 }]),
  };
});

test('math, Module 1: potion fill, the hot-and-humid rule, the dry-spell rule', async () => {
  const { page, ctx, errors } = await openApp(); const r = await math(page);
  assert.deepEqual(r.pot, [30, 100, 0]);                       // 750 / 2500 = 30 %; capped at 100; no target = 0
  assert.deepEqual(r.heat.slice(0, 3), [true, false, false]);  // > 32 °C AND > 70 % only
  near(r.heat[3], 420, 1e-9, '400 kcal x 1.05'); assert.equal(r.heat[4], 400);
  assert.deepEqual(r.dry, [true, false, false]);               // hrMax > 120 and water < 50 % of the target
  assert.deepEqual(errors, []); await ctx.close();
});

test('math, Module 4: readiness = 0.4 sleep + 0.3 stress + 0.3 recovery (blueprint example)', async () => {
  const { page, ctx, errors } = await openApp(); const { ready, readyCap } = await math(page);
  near(ready.sleep, 81.25, 1e-9, '6.5 / 8 x 100');
  near(ready.stress, 100 - 45 / 63 * 100, 1e-9, 'DASS 45 of 63');   // 28.571…
  near(ready.rec, 55, 1e-9, '22 / 40 x 100');
  near(ready.score, 81.25 * 0.4 + 28.5714286 * 0.3 + 55 * 0.3, 1e-6, 'weighted');   // 57.5714…
  near(readyCap, 100, 1e-9, 'sleep and recovery capped at 100');
  assert.deepEqual(errors, []); await ctx.close();
});

test('math, Module 6: gravity at KMK and the spring-scale reading', async () => {
  const { page, ctx, errors } = await openApp(); const r = await math(page);
  near(r.g0, 9.780778, 2e-6, 'g at 5.36 deg, sea level');
  near(r.g0 - r.g50, 3.086e-6 * 50, 1e-12, 'free-air correction over 50 m');
  assert.equal(r.read.toFixed(3), '63.199');                    // 63.2 kg read 1.58e-5 lighter
  assert.deepEqual(errors, []); await ctx.close();
});

test('math, the other modules: work, kJ, tilt, tower, pacer, cadence, survey, RER, guild totals', async () => {
  const { page, ctx, errors } = await openApp(); const r = await math(page);
  near(r.work, 28 * 63.2 * 9.80665 * 0.169, 1e-9, 'W = n m g r');  // 2932.8 J
  near(r.kj, 418.4, 1e-9, '100 kcal'); near(r.tilt, 12.6 / 418.4 * 45, 1e-12, 'tilt');
  near(r.tower, 61.48, 1e-9, 'rotateX for ST20');
  near(r.pacer, 100 / (63.2 * 9.80665 * 0.169), 1e-12, 'steps per second');
  near(r.cad.f, 2, 1e-12, '500 ms gaps'); near(r.cad.w, 4 * Math.PI, 1e-12, 'omega'); near(r.rms, 0.5, 1e-7, 'rms');
  assert.equal(r.surv.ok, true); near(r.surv.a, 29.44, 0.01, 'ST22 from its survey'); assert.equal(r.surv2.ok, false);
  assert.deepEqual(r.rer, [20.1, 21.1, 19.6]); near(r.forge, 126.6, 1e-9, '1.2 x 5 x 21.1');
  assert.deepEqual(r.guilds.map(g => [g.blk, g.W, g.n, !!g.top]), [['Blok A', 350, 2, true], ['Blok B', 300, 1, false]]);
  assert.deepEqual(errors, []); await ctx.close();
});

const SEED = (() => {
  const s = JSON.parse(JSON.stringify(RETURNING));
  s.e = [
    entry('water', 750, 0, {}),
    entry('sleep', 5, 0, {}, '07:00'),
    entry('stress', 7, 1, { dass: { d: 16, a: 14, s: 20, t: 50, i: Array(21).fill(2) } }),
    entry('stair', 28, 0, { kind: 'workout', sid: 'ST20', steps: 28, climbs: 1, hrB: 80, hrA: 125, hrR1: 115, dur: 2, kcal: { v: 30, lo: 25, hi: 35, m: 'met' }, pace: 'Moderate', src: 'manual', hrS: 'manual' }),
  ];
  return s;
})();

test('Home: the potion shows logged water against the goal, the oracle explains its index, the weather waits for a tap', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  let calls = 0;
  await page.route(/api\.open-meteo\.com/, r => { calls++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { time: '2026-10-29T14:00', temperature_2m: 33.4, relative_humidity_2m: 74 } }) }); });
  await go(page, 'home');
  const bar = page.locator('.potion-bottle');
  assert.equal(await bar.getAttribute('aria-valuenow'), '38');              // 750 / 2000
  assert.equal(await page.$eval('.liquid-fill', e => e.style.height), '37.5%');
  assert.match(await txt(page, '#arc-oracle'), /\/ 100 readiness index/);
  // 5 h → 62.5; DASS 50 → 20.6; recovery 10 → 25: 25 + 6.19 + 7.5 = 38.7 → 39, below 50 → the mild-path line
  assert.match(await txt(page, '#arc-oracle'), /39 \/ 100/);
  assert.match(await txt(page, '#arc-oracle'), /mild path \(below 26°\)/);
  assert.match(await txt(page, '#arc-oracle'), /not a medical measure/);
  assert.equal(calls, 0, 'no weather request before the tap');
  await page.click('#arc-elem summary'); await page.click('[data-a="arcwx"]');
  await page.waitForFunction(() => HWArcana.wx.st === 'ok');
  assert.equal(calls, 1);
  const el = await txt(page, '#arc-elem');
  assert.match(el, /33\.4 °C · 74 %/); assert.match(el, /The sun is fierce!/); assert.match(el, /Estimated burn today: 30 kcal → 32 kcal with HealthWiz’s assumed \+5 %/);
  assert.equal((await state(page)).s.wx, 1);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Home: a failed weather call degrades to a message and a retry, never a broken page', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  await page.route(/api\.open-meteo\.com/, r => r.fulfill({ status: 503, body: 'down' }));
  await go(page, 'home'); await page.click('#arc-elem summary'); await page.click('[data-a="arcwx"]');
  await page.waitForFunction(() => HWArcana.wx.st === 'err');
  assert.match(await txt(page, '#arc-elem'), /did not answer \(HTTP 503\)/);
  assert.equal(await page.locator('#arc-elem [data-a="arcwx"]').count(), 1);
  assert.ok(await page.locator('#hmq').count(), 'the rest of Home is still there');
  assert.deepEqual(errors.filter(e => !/503/.test(e)), []); await ctx.close();
});

test('Training Hall: the Guild War table ranks work in joules, with the player\'s own row offline', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  await go(page, 'exercise');
  assert.equal(await page.locator('#guild-war-tab table.leaderboard').count(), 1);
  await page.selectOption('#guild-war-tab select', 'Blok A');
  const row = await txt(page, '#guild-war-tab tbody tr');
  // 28 steps x 60 kg x 9.80665 x the ST20 rise (study) → whole joules
  const W = await page.evaluate(() => Math.round(28 * 60 * 9.80665 * HWGravity.verifiedRise('ST20')).toLocaleString('en'));
  assert.match(row, new RegExp('Blok A.*' + W.replace(/,/g, ',')));
  assert.equal(await page.locator('.guild-banner-top').count(), 1);
  assert.equal((await state(page)).s.gw.blk, 'Blok A');
  assert.equal(await page.$eval('.leaderboard', e => getComputedStyle(e).fontVariantNumeric), 'tabular-nums');
  assert.deepEqual(errors, []); await ctx.close();
});

test('Observatory Details: the tower and spellbook, the gravity card reads a scale, the mic fails gracefully', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED, context: { permissions: [] } }); await page.waitForSelector('.wl');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'arc-test'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.getElementById('main').appendChild(d); });
  assert.equal(await page.locator('#arc-tower canvas#arc-canvas').count(), 1);
  assert.equal(await page.$eval('#camera-feed', v => [v.autoplay, v.playsInline, v.style.display].join()), 'true,true,none');
  assert.match(await txt(page, '.arc-book'), /Angle28\.52°/);
  assert.doesNotMatch(await txt(page, '.arc-book'), /Body mass/);
  assert.match(await txt(page, '.arc-book'), /with your profile weight/);
  assert.equal(await page.$eval('.arc-bk dd', e => getComputedStyle(e).fontVariantNumeric), 'tabular-nums');
  assert.match(await txt(page, '#stair-sense-modal'), /Scale reading at sea level: 60\.000 kg/);
  assert.match(await txt(page, '#stair-sense-modal'), /Same scale at the stair top: 59\.999 kg/);
  assert.match(await txt(page, '#stair-sense-modal'), /Your mass does not change/);
  assert.equal(await page.locator('#stop-btn').isDisabled(), true, 'no power, no pacer');
  await page.fill('#arc-p', '100');
  const rate = await page.evaluate(() => 100 / (60 * 9.80665 * HWGravity.verifiedRise('ST20')));
  assert.equal(await txt(page, '#arc-rate'), rate.toFixed(2) + ' steps/s');
  await page.click('#stop-btn');                                         // SUMMON PACER
  await page.waitForFunction(() => /Ghost on step [1-9]/.test(document.getElementById('arc-pst').textContent));
  assert.equal(await page.textContent('#stop-btn'), 'HALT PACER');
  assert.match(await txt(page, '#arc-pst'), /of 28$/, 'ST20: its 28 counted steps');
  await page.click('#stop-btn');
  assert.equal(await page.evaluate(() => HWArcana.z.pace.on), 0);
  // a stairway of five flights: the ghost climbs all 55 counted steps, not one flight
  await page.evaluate(() => { document.getElementById('arc-test').innerHTML = HWStairs.logPanel('ST03', 'workout'); });
  assert.match(await txt(page, '.arc-book'), /55 steps counted in 5 flights \(11 \+ 11 \+ 11 \+ 11 \+ 11\)/);
  await page.fill('#arc-p', '100'); await page.click('#stop-btn');
  await page.waitForFunction(() => /Ghost on step \d+ of 55/.test(document.getElementById('arc-pst').textContent));
  await page.click('#stop-btn');
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' })); });
  await page.click('[data-a="arcecho"]');
  await page.waitForFunction(() => /microphone was not allowed/.test(document.body.textContent));
  assert.equal(await page.evaluate(() => HWArcana.z.mic), null);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Scrying Glass: the rear camera shows behind a transparent tower; HALT and leaving stop every track; a refusal keeps the night sky', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  await page.evaluate(() => {
    window.__asked = null;
    navigator.mediaDevices.getUserMedia = async c => { window.__asked = c; const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; cv.getContext('2d').fillRect(0, 0, 64, 64); window.__stream = cv.captureStream(5); return window.__stream; };
    const d = document.createElement('div'); d.id = 'arc-test'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.getElementById('main').appendChild(d); });
  await page.fill('#arc-p', '100');
  await page.click('#start-ar-btn');
  await page.waitForFunction(() => document.getElementById('arc-tower').classList.contains('ar'));
  assert.deepEqual(await page.evaluate(() => window.__asked), { video: { facingMode: 'environment' }, audio: false });
  const v = await page.$eval('#camera-feed', v => ({ shown: v.style.display, src: !!v.srcObject, fit: getComputedStyle(v).objectFit, z: getComputedStyle(v).zIndex, bg: getComputedStyle(v.parentElement).backgroundColor }));
  assert.deepEqual(v, { shown: 'block', src: true, fit: 'cover', z: '-1', bg: 'rgba(0, 0, 0, 0)' });
  assert.equal(await page.evaluate(() => HWArcana.z.pace.on), 1, 'casting also summons the pacer');
  await page.click('#stop-btn');                                         // HALT PACER
  assert.deepEqual(await page.evaluate(() => [window.__stream.getTracks().every(t => t.readyState === 'ended'), HWArcana.z.cam, document.getElementById('camera-feed').style.display]), [true, null, 'none']);
  // casting again, then leaving the page, also releases the camera
  await page.click('#start-ar-btn'); await page.waitForFunction(() => !!HWArcana.z.cam);
  await go(page, 'home');
  assert.deepEqual(await page.evaluate(() => [window.__stream.getTracks().every(t => t.readyState === 'ended'), HWArcana.z.cam]), [true, null]);
  // a refused camera: a message, and the tower keeps its own sky
  await go(page, 'campus').catch(() => {});
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
    const d = document.createElement('div'); d.id = 'arc-test2'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.body.appendChild(d); });
  await page.click('#arc-test2 #start-ar-btn');
  await page.waitForFunction(() => /camera was not allowed/.test(document.body.textContent));
  assert.equal(await page.evaluate(() => document.querySelector('#arc-test2 #arc-tower').classList.contains('ar')), false);
  assert.deepEqual(errors.filter(e => !/tile|leaflet|maplibre|integrity|Failed to load/i.test(e)), []); await ctx.close();
});

test('Science Laboratory: a re-survey within 2° earns Truth-Seeker and leaves the database angle alone', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  await go(page, 'lab'); await page.click('[data-a="labtab"][data-k="surv"]');
  await page.fill('#royal-surveyors [data-f="r"]', '17.95'); await page.fill('#royal-surveyors [data-f="t"]', '31.8');
  assert.match(await txt(page, '#arc-svr'), /= 29\.44°.*within 2°/);
  await page.click('[data-a="arcsvsave"]');
  await page.waitForFunction(() => !!st.b['Truth-Seeker']);
  const s = await state(page);
  assert.equal(s.s.srv.ST22.ok, 1);
  assert.equal(await page.evaluate(() => STAIRS.find(q => q.id === 'ST22').angle), 29.44);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Alchemy: the balance beam tilts by (work ÷ food) × 45° and the forge names its fuel assumption', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  await go(page, 'alchemy');
  assert.match(await txt(page, '#arc-led'), /Choose a food and a climb/);
  await page.click('[data-a="alsrc"][data-v="manual"]'); await page.fill('#al-kcin', '100');
  await page.selectOption('#al-sid', 'ST20'); await page.fill('#al-cl', '4');
  const t = await page.evaluate(() => { const w = HWAlchemy.climb().W / 1000; return HWArcana.math.tilt(w, 418.4); });
  assert.match(await txt(page, '#arc-led'), new RegExp('= ' + t.toFixed(2).replace('.', '\\.') + '°'));
  assert.equal(await page.locator('#pan-food').count(), 1);
  assert.match(await txt(page, '#arc-forge'), /VO₂ ≈/);
  assert.match(await txt(page, '#arc-forge'), /assumed from your last logged meal/);
  assert.deepEqual(errors, []); await ctx.close();
});
