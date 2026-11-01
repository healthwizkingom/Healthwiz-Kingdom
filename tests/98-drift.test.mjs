// Cardiac drift index (js/v6-drift.js): the second half's average pulse against the first, for a long unbroken guided-pace workout with a
// heart-rate device. Descriptive only. Worked examples for the rules, then the recorder with a fake strap, the weather context, and wording.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go, state } from './helpers.mjs';

after(closeBrowser);
// a fake heart-rate strap (as tests/38): window.__send(bpm) notifies a reading; window.__dt shifts Date.now so seconds can pass at once
const fakeBT = p => p.addInitScript(() => {
  const n = Date.now; window.__dt = 0; Date.now = () => n() + window.__dt;
  const chr = new EventTarget(); chr.startNotifications = async () => chr;
  const bat = new EventTarget(); bat.readValue = async () => new DataView(new Uint8Array([77]).buffer); bat.startNotifications = async () => bat;
  const server = { getPrimaryService: async s => ({ getCharacteristic: async () => s === 'heart_rate' ? chr : bat }) };
  const dev = new EventTarget(); dev.id = 'dev1'; dev.name = 'Polar H10 TEST';
  dev.gatt = { connected: false, connect: async () => { dev.gatt.connected = true; return server; }, disconnect() { dev.gatt.connected = false; dev.dispatchEvent(new Event('gattserverdisconnected')); } };
  Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: async () => dev, getDevices: async () => [dev] } });
  window.__send = bpm => { const b = new Uint8Array([0, bpm]); chr.value = new DataView(b.buffer); chr.dispatchEvent(new Event('characteristicvaluechanged')); };
});
const noBT = p => p.addInitScript(() => { Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: undefined }); });
async function boot({ bt = fakeBT, route } = {}) {
  const r = await openApp({ before: bt, viewport: { width: 390, height: 844 } });
  if (route) await r.page.route(/api\.open-meteo\.com/, route);
  await r.page.waitForSelector('.wl'); await go(r.page, 'pulse');
  if (bt === fakeBT) { await r.page.click('[data-a="hrcon"]'); await r.page.waitForSelector('#hwhr .hrchip.ok'); }
  return r;
}
/** a run on the page's clock: start the guide, one reading a second for `secs` seconds (pulse from f(second)), then stop it */
const run = (page, secs, f = '142', { stop = true, mid } = {}) => page.evaluate(([secs, f, stop, mid]) => { const g = new Function('i', 'return ' + f);
  acts.pstart(); if (mid) mid(); for (let i = 0; i < secs; i++) { window.__dt += 1000; window.__send(g(i)); } if (stop) acts.pstop(); }, [secs, f, stop, null]);
const card = page => page.textContent('#drift-card').then(t => t.replace(/\s+/g, ' ').trim());

test('analyze(): worked example, negative and zero drift, warm-up left out, the 8:00 edge (worked examples)', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const D = HWDrift, S = 1e6, ser = (a, b, step, f) => { const o = []; for (let t = a; t <= b; t += step) o.push({ t: S + t * 1000, v: f(t) }); return o; }, T = (x, secs) => D.analyze(x, S, S + secs * 1000);
    const two = ser(1, 600, 1, t => t < 360 ? 142 : 151), warm = ser(0, 600, 1, t => t < 120 ? 200 : t < 360 ? 142 : 151);
    const a = T(two, 600), b = T(ser(1, 600, 1, t => t < 360 ? 151 : 142), 600), c = T(ser(1, 600, 1, () => 140), 600), w = T(warm, 600);
    const e479 = T(ser(1, 479, 1, () => 140), 479), e480 = T(ser(1, 480, 1, () => 140), 480);
    return { a: [a.ok, a.pct, a.m1, a.m2, a.n1, a.n2, a.halfS, a.durS], b: [b.ok, b.pct], c: [c.ok, c.pct], w: [w.ok, w.pct, w.m1], e479: e479.why, e480: [e480.ok, e480.n1, e480.n2], short: T(two, 120).why }; });
  assert.deepEqual(r.a, [true, 6.3, 142, 151, 240, 241, 240, 600]);          // (151 − 142) ÷ 142 × 100 = 6.338 → 6.3; halves of 4:00 after the 2:00 warm-up
  assert.deepEqual(r.b, [true, -6]);                                          // (142 − 151) ÷ 151 = −5.96 → −6.0: a fall is shown as it is
  assert.deepEqual(r.c, [true, 0]);
  assert.deepEqual(r.w, [true, 6.3, 142], 'the 200 BPM readings in the first 2:00 are not counted');
  assert.match(r.e479, /The workout ran 7:59\. The index needs an unbroken guided-pace workout of at least 8:00\./);
  assert.deepEqual(r.e480, [true, 180, 181]);                                  // exactly 8:00 qualifies
  assert.match(r.short, /ran 2:00/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('analyze(): 90 readings and a 15 s gap in each half, out-of-range readings dropped, bad input ignored', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const D = HWDrift, S = 1e6, T = x => D.analyze(x, S, S + 480e3), ok = t => (a, b) => { const o = []; for (let s = a; s <= b; s += t) o.push({ t: S + s * 1000, v: 140 }); return o; };
    // 480 s: warm-up to 120 s, halves [120, 300) and [300, 480]
    const every2 = ok(2)(120, 480), every2minus = every2.filter((x, i) => i !== 10);       // 90 per half exactly, then one fewer
    const hole = (g0, n) => ok(1)(121, 480).filter(x => { const s = (x.t - S) / 1000; return !(s >= g0 && s < g0 + n); });
    const first = x => T(x).why || 'ok';
    return { e90: first(every2), e89: first(every2minus), g15: first(hole(200, 14)), g16: first(hole(200, 15)), g2nd: first(hole(400, 20)),
      oor: first(ok(1)(121, 480).map(x => ((x.t - S) / 1000) < 300 ? { ...x, v: 29 } : x)), hi: first(ok(1)(121, 480).map(x => ({ ...x, v: 221 }))),
      junk: first([null, 5, {}, { t: 'x', v: 140 }, { t: S + 200e3, v: NaN }, ...ok(1)(121, 480)]), unsorted: first(ok(1)(121, 480).reverse()), none: T([]).why, nul: T(null).why }; });
  assert.equal(r.e90, 'ok'); assert.match(r.e89, /The (first|second) half has 89 pulse readings\. It needs at least 90\./);
  assert.equal(r.g15, 'ok', 'a gap of exactly 15 s is allowed');
  assert.match(r.g16, /There is a gap of 16 s in the first half of the readings \(the limit is 15 s\)\./);
  assert.match(r.g2nd, /gap of 21 s in the second half/);
  assert.match(r.oor, /The first half has 0 pulse readings/, '29 BPM is dropped, so it counts as missing');
  assert.match(r.hi, /The first half has 0 pulse readings/);
  assert.equal(r.junk, 'ok', 'malformed items are ignored, not repaired'); assert.equal(r.unsorted, 'ok');
  assert.match(r.none, /first half has 0/); assert.match(r.nul, /first half has 0/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('weatherAround(): only a successful lookup from within an hour of the workout, never a guess', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const D = HWDrift, end = 5e6, H = 3600e3, W = (st, at, temp = 31.2) => ({ st, at, w: { temp, rh: 70, time: '' } });
    return { ok: D.weatherAround(W('ok', end), end), before: D.weatherAround(W('ok', end - H), end), after: D.weatherAround(W('ok', end + H), end),
      oldB: D.weatherAround(W('ok', end - H - 1), end), oldA: D.weatherAround(W('ok', end + H + 1), end), err: D.weatherAround({ st: 'err', w: null, at: 0 }, end), busy: D.weatherAround(W('busy', end), end),
      off: D.weatherAround({ st: 'off', w: null }, end), noTemp: D.weatherAround({ st: 'ok', at: end, w: { temp: 'x' } }, end), nul: [D.weatherAround(null, end), D.weatherAround(W('ok', end), null)] }; });
  assert.deepEqual(r.ok, { temp: 31.2, at: 5e6 }); assert.equal(r.before.temp, 31.2); assert.equal(r.after.temp, 31.2);     // exactly one hour either side still counts
  assert.deepEqual([r.oldB, r.oldA, r.err, r.busy, r.off, r.noTemp], [null, null, null, null, null, null]); assert.deepEqual(r.nul, [null, null]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('with a strap: a steady 10 minute guided run gives the index; the card says what it is and what it is not', async () => {
  const { page, ctx, errors } = await boot();
  const before = await state(page);
  assert.match(await card(page), /CARDIAC DRIFT INDEX[\s\S]*DESCRIPTIVE ONLY[\s\S]*Campus staircases are short, so this is only for a long guided-pace workout\./);
  await run(page, 600, 'i < 359 ? 142 : 151');
  const c = await card(page);
  assert.match(c, /Cardiac drift index: \+6\.3 %/); assert.match(c, /Average pulse 142\.0 BPM in the first half and 151\.0 BPM in the second, at a constant guided pace\./);
  assert.match(c, /Workout 10:00; the first 2:00 left out as warm-up; halves of 4:00 \(240 and 241 readings\)\./);
  assert.match(c, /Many things can change a pulse over a long steady effort; this number does not say why\./);
  assert.match(c, /HealthWiz’s own rules decide when it is shown .* They are not a medical standard\./); assert.match(c, /Stop if you feel dizzy, faint or unwell\./);
  await page.click('#drift-card .hwh'); const pop = await page.textContent('#hwh-pop');
  assert.match(pop, /\(151\.0 − 142\.0\) ÷ 142\.0 × 100 = \+6\.3 %/); assert.match(pop, /No source has been checked for this index/); assert.match(pop, /not a measured cadence/);
  await page.keyboard.press('Escape');
  const after = await state(page); assert.deepEqual({ e: after.e, p: after.p, xp: after.xp }, { e: before.e, p: before.p, xp: before.xp }, 'nothing is saved or scored');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the run is voided, with the reason, when the pace changes or restarts, or when it is too short; readings outside a run are not kept', async () => {
  const { page, ctx, errors } = await boot();
  await page.evaluate(() => { window.__dt += 1000; window.__send(150); });
  assert.equal(await page.evaluate(() => HWDrift.run.buf.length), 0, 'no timer, nothing buffered'); assert.equal(await page.evaluate(() => HWDrift.state), 'idle');
  // a pace change in the middle (the guide restarts)
  await page.evaluate(() => { acts.pstart(); for (let i = 0; i < 300; i++) { window.__dt += 1000; window.__send(140); } acts.pace({ i: 2 }); for (let i = 0; i < 300; i++) { window.__dt += 1000; window.__send(150); } acts.pstop(); });
  assert.match(await card(page), /Cardiac drift index: unavailable\. The pace guide was restarted or its pace changed, so the pace was not constant\./);
  await page.evaluate(() => { acts.pstart(); for (let i = 0; i < 700; i++) { window.__dt += 1000; window.__send(i < 360 ? 142 : 151); } acts.pstart(); acts.pstop(); });
  assert.match(await card(page), /unavailable\. The pace guide was restarted/, 'a plain restart also voids it');
  await run(page, 100);
  assert.match(await card(page), /unavailable\. The workout ran 1:40\. The index needs an unbroken guided-pace workout of at least 8:00\./);
  await run(page, 600, 'i < 360 ? 140 : 225');          // 225 passes the strap's parser (up to 230) but is above the 220 this index accepts, so it is dropped
  assert.match(await card(page), /unavailable\. The second half has 1 pulse reading\. It needs at least 90\./);   // the 360th reading sits on the midpoint, so it is the one valid reading in the second half
  await run(page, 600, 'i < 300 ? 140 : 225');   // cut earlier: the hole at the end of the first half is reported first
  assert.match(await card(page), /unavailable\. There is a gap of 60 s in the first half of the readings \(the limit is 15 s\)\./);
  assert.deepEqual(errors, []); await ctx.close();
});

test('weather is optional context: shown only when it exists and is near the workout; the card never starts a lookup itself', async () => {
  let calls = 0;
  const { page, ctx, errors } = await boot({ route: r => { calls++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ current: { time: '2026-11-01T14:00', temperature_2m: 32, relative_humidity_2m: 70 } }) }); } });
  await run(page, 600, 'i < 359 ? 142 : 151');
  assert.equal(calls, 0, 'no lookup unless the person taps'); assert.match(await card(page), /Cardiac drift index: \+6\.3 %[\s\S]*No temperature shown\.[\s\S]*READ THE SKY \(OPTIONAL\)[\s\S]*never yours, and only when you tap\./);
  assert.doesNotMatch(await card(page), /°C/);
  await page.evaluate(() => { HWArcana._set({ wx: { st: 'ok', w: { temp: 31.2, rh: 70, time: '' }, at: Date.now() - 2 * 3600e3 } }); render(); });
  assert.doesNotMatch(await card(page), /°C/, 'a reading from two hours away is not shown');
  await page.evaluate(() => { HWArcana._set({ wx: { st: 'err', w: null, at: 0, err: 'offline' } }); render(); }); assert.doesNotMatch(await card(page), /°C/); assert.equal(calls, 0);
  await page.evaluate(() => { HWArcana._set({ wx: { st: 'ok', w: { temp: 31.2, rh: 70, time: '' }, at: Date.now() - 600e3 } }); render(); });
  assert.match(await card(page), /Campus air temperature about then: 31\.2 °C \(Open-Meteo’s model for the campus area, outdoors; not measured at your staircase\)/);
  assert.match(await card(page), /Cardiac drift index: \+6\.3 %/, 'the index is the same with or without a temperature');
  await page.evaluate(() => { HWArcana._set({ wx: { st: 'off', w: null, at: 0 } }); render(); });
  await page.click('[data-a="drwx"]'); await page.waitForFunction(() => /32\.0 °C/.test(document.getElementById('drift-card').textContent), null, { timeout: 12000 });
  assert.equal(calls, 1, 'one lookup, after the tap'); assert.equal(await page.evaluate(() => st.s.wx), 1, 'the existing opt-in');
  assert.deepEqual(errors, []); await ctx.close();
});

test('no strap support: the card says so and no run is recorded', async () => {
  const { page, ctx, errors } = await boot({ bt: noBT });
  assert.match(await card(page), /needs a Bluetooth heart-rate device, and this browser cannot connect one/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('wording: no alert, detection, risk or fluid talk in any state; no emoji; fits a phone', async () => {
  const { page, ctx, errors } = await boot();
  const BAD = /plasma|dehydrat|hydrat|shock|illness|stroke|detected|alert|risk|danger|warning|diagnos|fluid|vascular|overheat|exhaust|threshold|too high|abnormal/i;
  const seen = [await card(page)];
  await run(page, 600, 'i < 359 ? 142 : 151'); seen.push(await card(page));
  await run(page, 100); seen.push(await card(page));
  seen.forEach(t => { assert.doesNotMatch(t, BAD, t); assert.doesNotMatch(t, /\p{Extended_Pictographic}/u, t); });
  assert.equal(await page.locator('#drift-card [role="alert"]').count(), 0, 'nothing is announced as an alert');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, true);
  assert.deepEqual(errors, []); await ctx.close();
});

test('architecture: a small new file, the stairs and arcana files are untouched, registered after the heart-rate and stairs modules', () => {
  const f = n => fs.readFileSync(new URL('../' + n, import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(f('js/v6-drift.js')) < 16 * 1024, 'v6-drift.js is ' + Buffer.byteLength(f('js/v6-drift.js')));
  assert.ok(!f('js/v6-stairs.js').includes('HWDrift') && !f('js/v6-arcana.js').includes('HWDrift'));
  const html = f('index.html'), i = n => html.indexOf('js/' + n); assert.ok(i('v6-hr.js') < i('v6-drift.js') && i('v6-stairs.js') < i('v6-drift.js') && i('v6-spire.js') < i('v6-drift.js'));
  assert.ok(f('sw.js').includes("'js/v6-drift.js'"));
  const src = f('js/v6-drift.js'); assert.doesNotMatch(src.slice(src.indexOf('/* ---------- pure')), /\p{Extended_Pictographic}/u);
});
