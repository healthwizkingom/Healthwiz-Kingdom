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

// a staircase seen from its foot, drawn in perspective: light treads and dark risers, each step narrower and shorter than the one below
const STAIRS_JS = `window.__stairs = (c, steps) => { const x = c.getContext('2d'), W = c.width, H = c.height; x.fillStyle = '#6b6b6b'; x.fillRect(0, 0, W, H);
  let y = H, h = H * .16, w = W * .9; for (let i = 0; i < steps; i++) { const t = h * .55, l = (W - w) / 2;
    x.fillStyle = '#d8d8d8'; x.fillRect(l, y - t, w, t); x.fillStyle = '#3a3a3a'; x.fillRect(l, y - h, w, h - t); y -= h; h *= .84; w *= .9; } };`;

test('Stair Sight (pure): a stack of step edges locks after 3 frames; a flat picture or one line never does', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  await page.addScriptTag({ content: STAIRS_JS });
  const r = await page.evaluate(() => {
    const grey = paint => { const c = document.createElement('canvas'); c.width = HWStairSight.DW; c.height = HWStairSight.DH; paint(c); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, g = new Float32Array(c.width * c.height); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = .3 * d[j] + .59 * d[j + 1] + .11 * d[j + 2]; return g; };
    const run = (g, n) => { const t = HWStairSight.tracker(); const out = []; for (let i = 0; i < n; i++) out.push(t.push(g).locked); return { locks: out, edges: t.state.edges }; };
    const stairs = run(grey(c => window.__stairs(c, 9)), 4);
    const flat = run(grey(c => { const x = c.getContext('2d'); x.fillStyle = '#777'; x.fillRect(0, 0, c.width, c.height); }), 8);
    const line = run(grey(c => { const x = c.getContext('2d'); x.fillStyle = '#777'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#ddd'; x.fillRect(0, 40, c.width, 40); }), 8);
    return { stairs: { locks: stairs.locks, n: stairs.edges.length, down: stairs.edges.every((e, i, a) => !i || e.y < a[i - 1].y) }, flat: flat.locks.some(Boolean), line: line.locks.some(Boolean) };
  });
  assert.deepEqual(r.stairs.locks, [false, false, true, true], 'locks on the third good frame');
  assert.ok(r.stairs.n >= 4, 'at least 4 step edges: ' + r.stairs.n); assert.ok(r.stairs.down, 'edges listed bottom first');
  assert.equal(r.flat, false); assert.equal(r.line, false);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Scrying Glass + Stair Sight: pointed at stairs it locks and the ghost climbs the edges it sees; pointed at a wall it keeps looking', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  await page.addScriptTag({ content: STAIRS_JS });
  await page.evaluate(() => {
    window.__scene = 'stairs';
    navigator.mediaDevices.getUserMedia = async () => { const c = document.createElement('canvas'); c.width = 240; c.height = 300;
      const draw = () => { if (window.__scene === 'stairs') window.__stairs(c, 9); else { const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 240, 300); } };
      draw(); setInterval(draw, 100); return c.captureStream(15); };
    const d = document.createElement('div'); d.id = 'arc-test'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.getElementById('main').appendChild(d); });
  await page.click('#start-ar-btn');
  assert.match(await page.textContent('#arc-scry-tag'), /LOOKING FOR STEPS/);
  await page.waitForFunction(() => /STAIRS SEEN · \d+ STEP EDGES/.test(document.getElementById('arc-scry-tag').textContent), null, { timeout: 15000 });
  assert.match(await txt(page, '#arc-seen'), /Stair Sight sees \d+ step edges; the ghost climbs them/);
  assert.ok(await page.evaluate(() => HWArcana.z.sight.st.edges.length) >= 4);
  // the wall: after 6 frames without stairs it lets go and looks again
  await page.evaluate(() => { window.__scene = 'wall'; });
  await page.waitForFunction(() => /LOOKING FOR STEPS/.test(document.getElementById('arc-scry-tag').textContent), null, { timeout: 15000 });
  await page.click('#stop-btn');
  assert.equal(await page.evaluate(() => HWArcana.z.sight), null, 'halting the glass stops Stair Sight');
  assert.deepEqual(errors, []); await ctx.close();
});

test('3D Stair Sight (pure): flat treads a riser apart give the rise, tread and angle; a flat floor or a ramp is not stairs', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - .5;
    const stairs = []; for (let d = .3; d < 3.2; d += .04) { const k = Math.max(0, Math.floor((d - 1) / .3) + 1); stairs.push({ d, h: k * .17 + rnd() * .012 }); }
    for (let k = 1; k < 6; k++) for (let h = 0; h < .17; h += .03) stairs.push({ d: 1 + (k - 1) * .3 + rnd() * .01, h: (k - 1) * .17 + h });   // the risers
    const flat = []; for (let d = .3; d < 3; d += .04) flat.push({ d, h: rnd() * .01 });
    const ramp = []; for (let d = .3; d < 3; d += .04) ramp.push({ d, h: d * .4 });
    const f = HWStairSight.profile3d; return { s: f(stairs), flat: f(flat).ok, ramp: f(ramp).ok, few: f(stairs.slice(0, 5)).ok };
  });
  assert.equal(r.s.ok, true);
  assert.ok(Math.abs(r.s.riser - .17) < .01, 'riser ' + r.s.riser); assert.ok(Math.abs(r.s.tread - .30) < .02, 'tread ' + r.s.tread);
  assert.ok(Math.abs(r.s.angle - Math.atan(.17 / .30) * 180 / Math.PI) < 2.5, 'angle ' + r.s.angle);   // 29.5°
  assert.ok(Math.abs(r.s.base - 1) < .05, 'the first riser at 1 m: ' + r.s.base);
  assert.deepEqual([r.flat, r.ramp, r.few], [false, false, false]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('3D Scrying (WebXR): offered only when immersive AR is supported; asks for hit-test and optional depth; a refusal leaves the 2D glass', async () => {
  // without WebXR: no button
  let { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  await page.evaluate(() => { delete Navigator.prototype.xr; Object.defineProperty(navigator, 'xr', { value: undefined, configurable: true });
    const d = document.createElement('div'); d.id = 'arc-test'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.getElementById('main').appendChild(d); });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('#start-xr-btn').isHidden(), true);
  await ctx.close();
  // with a phone that supports it (here a stand-in that refuses the session)
  ({ page, ctx, errors } = await openApp({ seed: SEED, before: p => p.addInitScript(() => {
    window.__xrAsk = null;
    Object.defineProperty(navigator, 'xr', { configurable: true, value: { isSessionSupported: async m => m === 'immersive-ar',
      requestSession: async (m, o) => { window.__xrAsk = { m, req: o.requiredFeatures, opt: o.optionalFeatures, root: o.domOverlay && o.domOverlay.root && o.domOverlay.root.id, depth: o.depthSensing && o.depthSensing.usagePreference }; throw Object.assign(new Error('no'), { name: 'NotSupportedError' }); } } });
  }) }));
  await page.waitForSelector('.wl');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'arc-test'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.getElementById('main').appendChild(d); });
  await page.waitForFunction(() => { const b = document.getElementById('start-xr-btn'); return b && !b.hidden; });
  await page.click('#start-xr-btn');
  await page.waitForFunction(() => /3D Scrying could not start on this phone \(NotSupportedError\)/.test(document.body.textContent));
  assert.deepEqual(await page.evaluate(() => window.__xrAsk), { m: 'immersive-ar', req: ['local-floor', 'hit-test'], opt: ['dom-overlay', 'depth-sensing'], root: 'arc-xr-ui', depth: ['cpu-optimized'] });
  assert.deepEqual(await page.evaluate(() => [HWArcana.z.xr, document.getElementById('arc-xr-ui').hidden, !!document.getElementById('start-ar-btn')]), [null, true, true]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('pace along the real shape: each step takes m g r ÷ P; the ghost lifts over the riser, then crosses the tread; landings are flat', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => {
    const S = HWStairSight, F = [{ n: 10, riser: .1795, tread: .318, turn: 'reverse' }, { n: 10, riser: .1795, tread: .318 }];
    const T = S.timeline(F, 100, 60), L = S.layout(F), d = T.segs[0].dur, at = t => S.place(F, L, S.at(T, t));
    const mixed = S.timeline([{ n: 2, riser: .15, tread: .3 }, { n: 2, riser: .2, tread: .3 }], 120, 50);
    return { d, total: T.total, n: T.n, segs: T.segs.length,
      start: at(0), lift: at(d * .3), stepEnd: at(d * .999), land: at(T.segs[10].t0 + T.segs[10].dur / 2), next: at(T.segs[11].t0 + .001), loop: at(T.total + d * .5).k,
      mixed: mixed.segs.filter(g => g.type === 'step').map(g => +g.dur.toFixed(4)) };
  });
  // 60 kg x 9.80665 m/s² x 0.1795 m ÷ 100 W = 1.0562 s a step; 20 steps + one landing (2 step-times) = 23.24 s
  assert.ok(Math.abs(r.d - 60 * 9.80665 * .1795 / 100) < 1e-9); assert.ok(Math.abs(r.total - 22 * r.d) < 1e-9);
  assert.deepEqual([r.n, r.segs], [20, 21]);
  assert.ok(r.start.h === 0 && Math.abs(r.start.d + .159) < 1e-9, 'starts on the floor, half a tread before the first riser');
  assert.ok(r.lift.h > .09 && r.lift.d < 0, 'early in the step it has risen most of the riser but not yet crossed the nosing');
  assert.ok(Math.abs(r.stepEnd.h - .1795) < 1e-3 && Math.abs(r.stepEnd.d - .159) < 1e-3, 'ends on the middle of the first tread');
  assert.ok(r.land.landing && Math.abs(r.land.h - 1.795) < 1e-9, 'the landing is flat at the top of flight 1 (10 x 17.95 cm)');
  assert.equal(r.next.k, 10, 'then step 11 starts flight 2'); assert.equal(r.loop, 0, 'at the top it starts again');
  // a taller riser takes longer at the same power: 50 x 9.80665 x 0.15 ÷ 120 = 0.6129 s, x 0.20 = 0.8172 s
  assert.deepEqual(r.mixed, [.6129, .6129, .8172, .8172]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the Spellbook gives the whole climb in seconds from the step time m g r ÷ P', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED }); await page.waitForSelector('.wl');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'arc-test'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.getElementById('main').appendChild(d); });
  assert.match(await txt(page, '#arc-climb-n'), /type a target power/);
  await page.fill('#arc-p', '100');
  // ST20: 28 steps of the Group 14 measured rise; one step 60 x 9.80665 x rise ÷ 100
  const want = await page.evaluate(() => { const r = HWGravity.verifiedRise('ST20'); return [(28 * 60 * 9.80665 * r / 100).toFixed(1) + ' s', (60 * 9.80665 * r / 100).toFixed(2) + ' s']; });
  assert.equal(await txt(page, '#arc-climb'), want[0]);
  assert.match(await txt(page, '#arc-climb-n'), new RegExp('= ' + want[1].replace('.', '\\.') + '$'));
  assert.match(await txt(page, '.arc-book'), /measured \(Group 14\)/);
  assert.deepEqual(errors, []); await ctx.close();
});
