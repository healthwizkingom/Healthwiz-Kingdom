// Sleep Now, the "Trance of Restoration" (js/v6-trance.js): the pure engine, the Anchoring Rite, the 3-second seal, and what is saved.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, go, state, closeBrowser } from './helpers.mjs';

after(closeBrowser);
const EMOJI = /\p{Extended_Pictographic}/u;

test('engine: tiers, time to cross the veil, trimming, 6-hour flat-line, 90-minute minimum and the 13-hour cap (worked examples)', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => {
    const T = HWTrance, flatVs = n => Array(n).fill(1e-5);
    // 'DD' + 'SSS' + 10 A + 'D' + 5 S + 10 A + 'DD' (trailing restlessness is cut): sleep starts at epoch 2 (10 min), 29 epochs = 145 min = 2.4 h
    const e = ('DD' + 'SSS' + 'A'.repeat(10) + 'D' + 'S'.repeat(5) + 'A'.repeat(10) + 'DD').split('');
    const a = T.resolve(e, null, { goalH: 8 });
    const sev = T.resolve(Array(100).fill('A'), flatVs(100), { goalH: 8 });
    const capped = T.resolve(('SSS' + 'A'.repeat(50)).split(''), null, { capH: 1, goalH: 8 });
    const hist = [{ D: 20, S: 50, A: 30 }, { D: 20, S: 50, A: 30 }, { D: 20, S: 50, A: 30 }];
    return {
      tiers: [T.tier(0.0001), T.tier(0.001), T.tier(0.01)],
      none: T.onset('DSDSDS'.split('')), at2: T.onset('DDSSSA'.split('')),
      flat: [T.flat(flatVs(72)), T.flat(flatVs(71)), T.flat([1e-3, 1e-3].concat(flatVs(72)))],
      a: { o: a.o, lat: a.lat, mins: a.mins, h: a.h, aw: a.aw, valid: a.valid, mana: a.mana, len: a.e.length, p: [a.p.D, a.p.S, a.p.A].map(x => Math.round(x * 10) / 10) },
      sev: { sev: sev.sev, mins: sev.mins, h: sev.h },
      capped: { valid: capped.valid, mins: capped.mins },
      short: T.resolve('SSSAAAA'.split(''), null, { goalH: 8 }).valid,
      aff: [T.affinity({ D: 22, S: 40, A: 38 }, hist).type, T.affinity({ D: 21, S: 49, A: 30 }, hist).type, T.affinity({ D: 22, S: 40, A: 38 }, hist.slice(0, 2))],
      grade: [T.grade([1380, 1380, 1380]).g, T.grade([1380, 1440, 1500]).g, T.grade([1260, 1380, 1500]).g, T.grade([1380, 1380])],
    };
  });
  assert.deepEqual(r.tiers, ['A', 'S', 'D'], 'below 0.0006 Abyssal, below 0.006 Stillness, else Drift');
  assert.equal(r.none, null);
  assert.equal(r.at2, 2);
  assert.deepEqual(r.flat, [0, -1, 2], '72 epochs (6 h) of flat-line; 71 is not enough; the start index is reported');
  // 29 epochs × 5 min = 145 min; 145 ÷ 60 = 2.42 → 2.4 h; mana = 2.4 ÷ 8 × 100 = 30; one Drift run followed by sleep = 1 awakening;
  // 1 D, 8 S, 20 A of 29 = 3.4 %, 27.6 %, 69.0 %
  assert.deepEqual(r.a, { o: 2, lat: 10, mins: 145, h: 2.4, aw: 1, valid: true, mana: 30, len: 31, p: [3.4, 27.6, 69] });
  assert.deepEqual(r.sev, { sev: true, mins: 360, h: 6 }, 'Severed Conduit stops counting at 6 h');
  assert.deepEqual(r.capped, { valid: false, mins: 60 }, '1 h left of the 13 h allowance: under 90 min, so not valid');
  assert.equal(r.short, false, '7 epochs = 35 min is an Interrupted Rite');
  assert.deepEqual(r.aff, ['A', 'B', null], 'furthest above your average; within ±3 is Balanced; under 3 earlier nights is not compared');
  assert.deepEqual(r.grade, ['A', 'B', 'C', null], 'bedtime spread 0, 49 and 98 min; under 3 nights is not graded');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('SLEEP NOW sits right under LOG SLEEP; the rite needs real motion data, never invents it; no emoji drawn as text', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'sleep');
  const order = await page.evaluate(() => { const c = [...document.querySelectorAll('#main .card')], i = c.findIndex(x => /LOG SLEEP/.test(x.querySelector('h3')?.textContent || '') && x.querySelector('[data-a="slsave"]')); return { i, next: c[i + 1]?.id, btn: !!c[i + 1]?.querySelector('[data-a="trnow"]') }; });
  assert.ok(order.i >= 0);
  assert.equal(order.next, 'v6trc');
  assert.ok(order.btn);
  await page.click('#v6trc [data-a="trnow"]');
  await page.waitForSelector('#v6trt .v6trcard');
  assert.equal(await page.locator('[data-a="tcgo"]').count(), 0, 'BEGIN only appears on the last page');
  await page.click('[data-a="tcnext"]');
  assert.ok(await page.locator('[data-a="tcnext"]').isDisabled(), 'no motion data yet: NEXT waits');
  assert.match(await page.textContent('#v6trt'), /15 to 30 cm/);
  assert.match(await page.textContent('#v6trt'), /never under the pillow/);
  // a headless browser gives no motion data (or denies the permission): arming says so and begins nothing
  await page.click('[data-a="tcarm"]');
  await page.waitForFunction(() => /No motion data arrived|Motion access was not allowed|no motion sensor/.test(document.getElementById('v6trt').textContent), null, { timeout: 8000 });
  assert.ok(await page.locator('[data-a="tcnext"]').isDisabled());
  assert.equal(await page.evaluate(() => HWTrance._state()), null);
  assert.equal(await page.evaluate(re => new RegExp(re, 'u').test(document.getElementById('v6trt').textContent), EMOJI.source), false);
  await page.click('[data-a="trx"]');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a night: the seal needs a 3 s hold; under 90 min asks first and saves nothing; a valid night saves a Sleep entry with m.tr and offers the Vault', async () => {
  const { page, ctx, errors } = await openApp({ context: { reducedMotion: 'reduce' } });
  await go(page, 'sleep');
  await page.click('#v6trc [data-a="trnow"]');
  await page.click('[data-a="tcnext"]');
  await page.waitForSelector('[data-a="tcarm"]');
  // feed the page a motion sensor: still phone, lying flat, face down (z < 0)
  await page.evaluate(() => { if (typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission = async () => 'granted'; window.__mv = setInterval(() => window.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x: 0.01, y: 0.02, z: -9.8 } })), 100); });
  await page.click('[data-a="tcarm"]');
  await page.waitForFunction(() => HWTrance._S.motion === 1, null, { timeout: 8000 });
  await page.waitForFunction(() => !document.querySelector('[data-a="tcarm"]'), null, { timeout: 8000 });
  await page.click('[data-a="tcnext"]'); await page.click('[data-a="tcnext"]');
  assert.ok(await page.locator('[data-a="tcgo"]').isEnabled());
  await page.click('[data-a="tcgo"]');
  await page.waitForSelector('#v6trt .v6trsb');
  assert.match(await page.textContent('#v6trt'), /HOLD 3 SECONDS TO WAKE/);
  assert.equal(await page.evaluate(() => HWTrance._state().state), 'IN_TRANCE');
  const box = await page.locator('.v6trsb').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  // a short hold (1 s) does nothing
  await page.mouse.down(); await page.waitForTimeout(1000); await page.mouse.up();
  assert.equal(await page.evaluate(() => HWTrance._state().state), 'IN_TRANCE');

  // 3 s hold with almost no time asleep: Interrupted Rite asks first; YES saves nothing
  await page.mouse.down(); await page.waitForTimeout(3400); await page.mouse.up();
  await page.waitForFunction(() => /Interrupted Rite/.test(document.getElementById('v6trt').textContent));
  assert.match(await page.textContent('#v6trt'), /90 minutes/);
  await page.click('[data-a="tryes"]');
  await page.waitForFunction(() => /Nothing was saved/.test(document.getElementById('v6trt').textContent));
  assert.equal((await state(page)).e.filter(e => e.c === 'sleep' && e.m.tr).length, 0);
  await page.click('[data-a="trdone"]');

  // a valid night: 3 h in the past, 'DD' + 'SSS' + 30 A + 'S' = 36 epochs; sleep from epoch 2: 34 epochs = 170 min = 2.8 h, latency 10 min
  await page.click('#v6trc [data-a="trnow"]');
  await page.click('[data-a="tcnext"]');
  await page.click('[data-a="tcarm"]');
  await page.waitForFunction(() => !document.querySelector('[data-a="tcarm"]'));
  await page.click('[data-a="tcnext"]'); await page.click('[data-a="tcnext"]');
  await page.click('[data-a="tcgo"]');
  await page.waitForSelector('.v6trsb');
  await page.evaluate(() => { const M = HWTrance._state(), e = ('DD' + 'SSS' + 'A'.repeat(30) + 'S').split(''); M.start -= 3 * 36e5; M.t0 -= 3 * 36e5; M.ep = e; M.vs = e.map(x => x === 'D' ? 0.05 : x === 'S' ? 0.002 : 0.0001); M.cur = { n: 0, mu: 0, m2: 0, t0: M.t0 + 36 * 3e5 }; });
  const b2 = await page.locator('.v6trsb').boundingBox();
  await page.mouse.move(b2.x + b2.width / 2, b2.y + b2.height / 2);
  await page.mouse.down(); await page.waitForTimeout(3400); await page.mouse.up();
  await page.waitForSelector('.v6rcard', { timeout: 8000 });
  const goal = await page.evaluate(() => (st.g && Array.isArray(st.g.sleep) ? +st.g.sleep[0] : SR(+st.p.age || 16)[0]) || 8);
  let txt = await page.textContent('#v6trt');
  assert.match(txt, /Sleep Duration/);
  assert.match(txt, /GAME ESTIMATE FROM PHONE MOVEMENT, NOT A MEDICAL MEASUREMENT/);
  assert.match(txt, new RegExp(Math.round(Math.min(100, 2.8 / goal * 100)) + 'Restored Mana'));
  assert.match(txt, /2 hrs 50 mins/, '34 epochs x 5 min = 170 min');
  assert.match(txt, /Your first Sleep Now night/);
  const saved = (await state(page)).e.filter(e => e.c === 'sleep' && e.m.tr);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].v, 2.8);
  assert.equal(saved[0].m.lat, 10);
  assert.equal(saved[0].m.tr.v, 1);
  assert.equal(saved[0].m.tr.o, 2);
  assert.equal(saved[0].m.tr.e, 'DD' + 'SSS' + 'A'.repeat(30) + 'S');
  assert.ok(saved[0].m.score >= 0 && saved[0].m.score <= 100);
  assert.equal(await page.evaluate(() => st.s.trLive), undefined, 'the open night is cleared');
  await page.click('[data-a="trnext"]');
  await page.waitForSelector('#v6trhg');
  txt = await page.textContent('#v6trt');
  assert.match(txt, /Depths of the Night/);
  assert.match(txt, /Abyssal Slumber/);
  // the runegraph canvas has pixels drawn in its tier colours
  assert.ok(await page.evaluate(() => { const c = document.getElementById('v6trhg'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i] < 160) n++; return n > 200; }));
  await page.click('[data-a="trnext"]');
  await page.waitForSelector('.v6rtype');
  txt = await page.textContent('#v6trt');
  assert.match(txt, /Time to cross the veil10 min/);
  assert.match(txt, /Logged as2\.8 h/);
  assert.match(txt, /Dominant state/);
  // Evidence Vault: opens the Trance card and its four sources
  await page.click('[data-a="trvault"]');
  await page.waitForSelector('#vc-trance');
  assert.match(await page.textContent('#vc-trance'), /Sleep Now: movement stages/);
  for (const id of ['xie2013', 'fernandez2020', 'czeisler2007', 'peever2017']) assert.ok(await page.evaluate(i => HWSources.ids().includes(i) && HWVault.CALCS.find(c => c.id === 'trance').src.includes(i), id));
  assert.deepEqual(errors.filter(e => !/integrity/.test(e)), []);
  await ctx.close();
});

test('limits: two Trances or 13 h in 24 h hide the button; a night left open is offered for resume', async () => {
  const now = Date.now(), tr = (h, endAgo) => ({ id: 'tr' + h + endAgo, c: 'sleep', v: h, m: { bed: '23:00', wake: '07:00', aw: 0, lat: 10, rest: 3, score: 70, tr: { v: 1, e: 'SSSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', o: 0, sp: 0, s: now - endAgo - h * 36e5, n: now - endAgo } }, n: '', d: new Date().toISOString().slice(0, 10), t: '07:00' });
  const { page, ctx, errors } = await openApp();
  await page.evaluate(([a, b, c]) => { st.e.push(a, b); save(); st.s.trLive = c; save(); }, [tr(3, 3600e3), tr(3, 7200e3), { s: Date.now() - 36e5, w: null, win: 0, e: 'SSSSSS', v: [0.001, 0.001, 0.001, 0.001, 0.001, 0.001], sp: 0 }]);
  await go(page, 'sleep');
  const t = await page.textContent('#v6trc');
  assert.match(t, /RESUME TRANCE/);
  await page.evaluate(() => { delete st.s.trLive; save(); });
  await go(page, 'sleep');
  assert.match(await page.textContent('#v6trc'), /Two Trances have already been logged in the last 24 hours/);
  assert.equal(await page.locator('#v6trc [data-a="trnow"]').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the vigil: built once with the hero art, rolling clock and pins; dims after idle, wakes on a touch; face-down goes black', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'sleep');
  await page.click('#v6trc [data-a="trnow"]');
  await page.click('[data-a="tcnext"]');
  await page.evaluate(() => { if (typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission = async () => 'granted'; window.__mv = setInterval(() => window.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x: 0.01, y: 0.02, z: 9.8 } })), 100); });
  await page.click('[data-a="tcarm"]');
  await page.waitForFunction(() => !document.querySelector('[data-a="tcarm"]'));
  await page.click('[data-a="tcnext"]'); await page.click('[data-a="tcnext"]');
  await page.click('[data-a="tcgo"]');
  await page.waitForSelector('.v6vdisc img');
  assert.match(await page.getAttribute('.v6vdisc img', 'src'), /assets\/img\/sleeper-night\.webp$/, 'the owner\'s sleeper picture');
  assert.match(await page.textContent('#v6vclk'), /^\d\d:\d\d$/);
  assert.match(await page.textContent('#v6vcnt'), /^0 h 0\d min$/);
  assert.match(await page.textContent('#v6vp2'), /^Echoes 0$/);
  const keep = await page.evaluate(() => { window.__disc = document.querySelector('.v6vdisc'); return true; });
  await page.waitForTimeout(2200);
  assert.ok(await page.evaluate(() => window.__disc === document.querySelector('.v6vdisc')), 'the scene is not rebuilt every second, so its animations never restart');
  assert.equal(await page.evaluate(() => document.getElementById('v6trt').classList.contains('v6dim')), false);
  await page.evaluate(() => HWTrance._idle());
  assert.equal(await page.evaluate(() => document.getElementById('v6trt').classList.contains('v6dim')), true, 'idle: dark and still');
  await page.mouse.click(4, 4);
  assert.equal(await page.evaluate(() => document.getElementById('v6trt').classList.contains('v6dim')), false, 'a touch wakes the vigil');
  await page.evaluate(() => { clearInterval(window.__mv); window.__mv = setInterval(() => window.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x: 0, y: 0, z: -9.8 } })), 100); });
  await page.waitForFunction(() => document.getElementById('v6trt').classList.contains('down'), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => document.getElementById('v6trt').classList.contains('v6dim')), true, 'face-down: black');
  assert.deepEqual(errors, []);
  await ctx.close();
});
