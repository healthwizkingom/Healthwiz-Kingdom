// Smartwatch heart rate (js/v6-hr.js + the Workout on the Stairs page) and the running leaderboard (js/v6-runboard.js).
// Bluetooth is a fake device (navigator.bluetooth stub); Supabase is a fake REST endpoint (page.route).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, go, state, closeBrowser, RETURNING } from './helpers.mjs';

after(closeBrowser);
const EMOJI = /\p{Extended_Pictographic}/u;

// a fake heart-rate strap; window.__send(bpm, u16) notifies a reading; window.__dt shifts Date.now (seconds go by)
const fakeBT = p => p.addInitScript(() => {
  const n = Date.now; window.__dt = 0; Date.now = () => n() + window.__dt;
  const chr = new EventTarget(); chr.startNotifications = async () => chr;
  const bat = new EventTarget(); bat.readValue = async () => new DataView(new Uint8Array([77]).buffer); bat.startNotifications = async () => bat;
  const server = { getPrimaryService: async s => ({ getCharacteristic: async () => s === 'heart_rate' ? chr : bat }) };
  const dev = new EventTarget(); dev.id = 'dev1'; dev.name = 'Polar H10 TEST';
  window.__connects = 0;
  dev.gatt = { connected: false, connect: async () => { window.__connects++; dev.gatt.connected = true; return server; },
    disconnect() { dev.gatt.connected = false; dev.dispatchEvent(new Event('gattserverdisconnected')); } };
  window.__drop = () => { dev.gatt.connected = false; dev.dispatchEvent(new Event('gattserverdisconnected')); };
  Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: async () => dev, getDevices: async () => [dev] } });
  window.__send = (bpm, u16) => { const b = u16 ? new Uint8Array([1, bpm & 255, bpm >> 8]) : new Uint8Array([0, bpm]); chr.value = new DataView(b.buffer); chr.dispatchEvent(new Event('characteristicvaluechanged')); };
  window.__feed = (bpm, secs) => { window.__dt += 20000; for (let i = 0; i < secs; i++) { window.__dt += 1000; window.__send(bpm + (i % 3)); } };
});

test('heart-rate parser: 8-bit and 16-bit values from the flags byte; 30–230 only; stable 10–15 s average', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => {
    const dv = a => new DataView(new Uint8Array(a).buffer), now = 100000;
    const S = (vals, step) => vals.map((v, i) => ({ t: now - (vals.length - 1 - i) * step, v }));
    return {
      u8: HWHR.parse(dv([0, 72])), u16: HWHR.parse(dv([1, 0x90, 0])), u16hi: HWHR.parse(dv([1, 0xC8, 0])), rr: HWHR.parse(dv([0x10, 88, 1, 2])),
      low: HWHR.parse(dv([0, 29])), high: HWHR.parse(dv([1, 231, 0])), short: HWHR.parse(dv([1, 80])), none: HWHR.parse(null),
      settling: HWHR.stableOf(S([70, 71, 72], 1000), now).why, ok: HWHR.stableOf(S(Array(12).fill(70).map((v, i) => v + (i % 3)), 1000), now),
      changing: HWHR.stableOf(S([60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115], 1000), now).why,
      stale: HWHR.stableOf(S(Array(12).fill(70), 1000).map(s => ({ ...s, t: s.t - 9000 })), now).why,
    };
  });
  assert.deepEqual([r.u8, r.u16, r.u16hi, r.rr, r.low, r.high, r.short, r.none], [72, 144, 200, 88, null, null, null, null]);
  assert.equal(r.settling, 'settling');
  assert.equal(r.ok.ok, 1); assert.equal(r.ok.v, 71); assert.ok(r.ok.secs >= 10);
  assert.equal(r.changing, 'changing'); assert.equal(r.stale, 'stale');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no Web Bluetooth (iPhone, Firefox): the connect button is hidden, manual entry and the help sheet remain', async () => {
  const { page, ctx, errors } = await openApp({ before: p => p.addInitScript(() => { Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: undefined }); }) });
  await go(page, 'pulse');
  assert.equal(await page.locator('[data-a="hrcon"]').count(), 0, 'no CONNECT where unsupported');
  assert.match(await page.textContent('#hwhr'), /not iPhone or iPad/);
  assert.equal(await page.locator('#wk-b').count(), 1, 'manual entry is there');
  await page.click('[data-a="hrhelp"]');
  const help = await page.textContent('#mo');
  for (const w of [/Chrome/, /Edge/, /Android/, /iPhone/, /Polar/, /Garmin/, /Wahoo/, /Coros/, /Broadcast Heart Rate/, /Apple Watch/, /Galaxy Watch/, /Fitbit/, /manual entry/]) assert.match(help, w);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#mo').isHidden(), true);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('watch: connect, live pulsing heart + battery, steady reading → USE AS BEFORE/AFTER, climb min/avg/max, saved with src device', async () => {
  const { page, ctx, errors } = await openApp({ before: fakeBT, viewport: { width: 390, height: 844 } });
  await go(page, 'pulse');
  await page.click('[data-a="hrcon"]');
  await page.waitForSelector('#hwhr .hrchip.ok');
  assert.match(await page.textContent('#hwhr'), /CONNECTED[\s\S]*Polar H10 TEST/);
  await page.evaluate(() => window.__send(300)); // discarded (above 230)
  await page.evaluate(() => window.__send(150, true)); // 16-bit
  assert.equal((await page.textContent('#hwhr-bpm')).trim(), '150');
  assert.match(await page.textContent('#hwhr-bt'), /77%/, 'battery level');
  assert.equal(await page.locator('#hwhr-ht[data-on="1"] svg[aria-label="Live heart rate"]').count(), 1, 'pixel heart');
  assert.equal(await page.locator('[data-a="hruse"][data-k="b"]').isDisabled(), true, 'not steady yet');
  await page.evaluate(() => window.__feed(70, 13));
  assert.equal(await page.locator('[data-a="hruse"][data-k="b"]').isDisabled(), false);
  await page.click('[data-a="hruse"][data-k="b"]');
  assert.equal(await page.inputValue('#wk-b'), '71');
  assert.match(await page.innerHTML('#st-hs-b'), /pxi-watch[\s\S]*heart-rate device/);
  // the climb: timer on, readings recorded as low / avg / high
  await page.evaluate(() => acts.pstart());
  await page.evaluate(() => { for (const v of [110, 140, 168, 150]) { window.__dt += 1000; window.__send(v); } });
  assert.deepEqual(await Promise.all(['#wk-lo', '#wk-av', '#wk-hi'].map(s => page.inputValue(s))), ['110', '142', '168']);
  assert.match(await page.textContent('#st-peak'), /168[\s\S]*82%[\s\S]*220 − age \(204 BPM\)[\s\S]*rough estimate/i);
  await page.evaluate(() => acts.pstop());
  await page.evaluate(() => window.__feed(120, 13));
  await page.click('[data-a="hruse"][data-k="a"]');
  await page.fill('#wk-s', '20'); await page.fill('#wk-c', '3');
  await page.selectOption('#wk-loc', { index: 1 });
  await page.click('[data-a="stwsave"]');
  const e = (await state(page)).e.filter(x => x.c === 'stair').pop();
  assert.deepEqual([e.m.src, e.m.hrS, e.m.hrB, e.m.hrA, e.m.hrLo, e.m.hrAv, e.m.hrHi, e.m.hrPct, e.m.hrDev], ['device', 'device', 71, 121, 110, 142, 168, 82, { b: 1, a: 1, c: 1 }]);
  assert.ok(await page.locator('#stlog .stses').first().locator('svg.pxi-watch').count() >= 1, 'pixel watch icon on the entry');
  assert.equal(EMOJI.test(await page.textContent('#hwhr')), false, 'no emoji in the device panel');
  // the link drops: auto-reconnect; DISCONNECT stops it
  const before = await page.evaluate(() => window.__connects);
  await page.evaluate(() => window.__drop());
  await page.waitForFunction(b => window.__connects > b && HWHR.state === 'on', before, { timeout: 5000 });
  await page.click('[data-a="hroff"]');
  assert.equal(await page.evaluate(() => HWHR.state), 'off');
  assert.equal(await page.locator('[data-a="hrcon"]').count(), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('manual entry still works and is tagged manual; typing over a watch number makes it manual; resting note, no diagnosis', async () => {
  const { page, ctx, errors } = await openApp({ before: fakeBT });
  await go(page, 'pulse');
  await page.fill('#wk-b', '45');
  assert.match(await page.textContent('#st-rest'), /^\s*Outside the usual resting range; see a doctor if you feel unwell or it persists\.$/);
  await page.fill('#wk-b', '72');
  assert.equal((await page.textContent('#st-rest')).trim(), '');
  await page.fill('#wk-b', '105');
  assert.match(await page.textContent('#st-rest'), /Outside the usual resting range/);
  await page.fill('#wk-b', '72'); await page.fill('#wk-a', '130'); await page.fill('#wk-s', '10'); await page.fill('#wk-c', '2');
  await page.selectOption('#wk-loc', { index: 1 });
  await page.click('[data-a="stwsave"]');
  const e = (await state(page)).e.filter(x => x.c === 'stair').pop();
  assert.deepEqual([e.m.src, e.m.hrS, e.m.hrDev, e.m.hrLo], ['manual', 'manual', undefined, undefined]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- running leaderboard ---------- */
const mon = () => { const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const runsSeed = () => {
  const now = Date.now(), iso = t => new Date(t).toISOString();
  const r = (id, t, dist, dur) => ({ id, start: iso(t), end: iso(t + dur * 1000), dist, dur, pace: Math.round(dur / (dist / 1000)), route: [], up: 0 });
  return JSON.stringify({ ok: 1, del: [], runs: [r('a', now - 8 * 864e5, 3000, 1200), r('w', now - 60e3, 1000, 1000), r('b', now - 30e3, 5200, 1600)] });
};
const BOARD = [
  { rank: 1, nickname: 'Swift Kancil', distance_km: 21.5, runs: 4, weeks: 1, best_5k_sec: 1400, me: false },
  { rank: 2, nickname: 'Lari <b>Laju</b>', distance_km: 12, runs: 2, weeks: 1, best_5k_sec: 1500, me: false },
  { rank: 3, nickname: 'Steady Otter', distance_km: 5.2, runs: 1, weeks: 1, best_5k_sec: 1538, me: true },
  { rank: 4, nickname: 'Comet', distance_km: 3, runs: 3, weeks: 1, best_5k_sec: null, me: false },
];
function fakeSupabase(log) {
  return async p => {
    await p.addInitScript(s => { if (!sessionStorage.getItem('runs')) { localStorage.setItem('healthwiz_runs', s); sessionStorage.setItem('runs', '1'); } }, runsSeed());
    await p.route('**/rest/v1/rpc/**', async route => {
      const fn = route.request().url().split('/rpc/')[1], body = JSON.parse(route.request().postData() || '{}'), h = route.request().headers();
      log.push({ fn, body, apikey: h.apikey, auth: h.authorization });
      if (fn === 'run_board') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body.p_device_id ? BOARD : BOARD.map(x => ({ ...x, me: false }))) });
      if (fn === 'leave_run_board') return route.fulfill({ status: 200, contentType: 'application/json', body: '1' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });
  };
}

test('runners board: opt-in explains what is shared, nickname filter, submit this week, medals for top 3, you highlighted, leave deletes', async () => {
  const log = [];
  const { page, ctx, errors } = await openApp({ before: fakeSupabase(log), viewport: { width: 390, height: 844 } });
  await go(page, 'stair'); // not 'run': that route also loads the route map
  await page.locator('#v6rb').scrollIntoViewIfNeeded();
  await page.waitForSelector('#v6rb .rbl li');
  assert.equal(log.filter(x => x.fn === 'submit_run_score').length, 0, 'nothing is sent before joining');
  assert.equal(log[0].body.p_device_id, null, 'reading the board does not send the device id before joining');
  assert.match(log[0].apikey, /^sb_publishable_/); assert.equal(log[0].auth, undefined, 'only the publishable key, no bearer');
  const txt = await page.textContent('#v6rb');
  assert.match(txt, /nickname and your weekly running totals[\s\S]*Never shared:[\s\S]*health data[\s\S]*weight[\s\S]*location/);
  assert.match(await page.innerHTML('#v6rb'), /Lari &lt;b&gt;Laju&lt;\/b&gt;/, 'names are escaped');
  // nickname filter
  for (const [n, re] of [['sh1t', /friendlier/], ['Tester', /real name/], ['ab', /3 to 16/], ['<x>', /letters, numbers/]]) {
    await page.fill('#rbnick', n); await page.click('[data-a="rbjoin"]');
    assert.match(await page.textContent('#v6rb .warn[role="alert"]'), re, n);
  }
  await page.fill('#rbnick', 'Steady Otter');
  await page.click('[data-a="rbjoin"]');
  await page.waitForFunction(() => document.querySelector('#v6rb li.me'));
  const sub = log.filter(x => x.fn === 'submit_run_score');
  assert.equal(sub.length, 1, 'one submit (the next waits a minute)');
  assert.deepEqual(sub[0].body, { p_device_id: await page.evaluate(() => HWRunBoard.state.dev), p_nickname: 'Steady Otter', p_week_start: mon(), p_distance_km: 5.2, p_runs: 1, p_moving_sec: 1600, p_best_5k_sec: 1538 });
  assert.match(sub[0].body.p_device_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(await page.textContent('#v6rb .rbyou'), /1 run is not counted/, 'the walk is not counted');
  const labels = await page.$$eval('#v6rb .rbl li .rk svg', s => s.map(x => x.getAttribute('aria-label')));
  assert.deepEqual(labels, ['1st place, gold trophy', '2nd place, silver medal', '3rd place, bronze medal']);
  assert.match(await page.textContent('#v6rb li.me'), /Steady Otter \(YOU\)/);
  assert.equal(EMOJI.test(await page.textContent('#v6rb')), false, 'no emoji');
  // tabs + consistency ranking
  await page.click('[data-a="rbsort"][data-v="runs"]');
  await page.waitForFunction(() => document.querySelectorAll('#v6rb .rbl li').length);
  assert.equal(log.at(-1).body.p_sort, 'runs');
  await page.click('[data-a="rbtab"][data-v="5k"]');
  await page.waitForFunction(() => /5K time/.test(document.querySelector('#v6rb').textContent));
  assert.equal(log.at(-1).body.p_board, '5k');
  // cache: switching back within 5 minutes makes no request
  const n = log.length;
  await page.click('[data-a="rbtab"][data-v="week"]');
  await page.click('[data-a="rbsort"][data-v="runs"]');
  assert.equal(log.length, n, 'cached for 5 minutes');
  // leave
  await page.locator('#v6rb details summary').click();
  await page.click('[data-a="rbleave"]'); await page.click('[data-a="rbleave"]');
  await page.waitForFunction(() => !HWRunBoard.state.on);
  const lv = log.find(x => x.fn === 'leave_run_board');
  assert.equal(lv.body.p_device_id, sub[0].body.p_device_id);
  assert.notEqual(await page.evaluate(() => HWRunBoard.state.dev), sub[0].body.p_device_id, 'a new random id after leaving');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('runners board offline: clear offline state, cached board kept, the app and old data unaffected', async () => {
  const log = [];
  const { page, ctx, errors } = await openApp({ before: fakeSupabase(log) });
  await go(page, 'stair'); // not 'run': that route also loads the route map
  await page.locator('#v6rb').scrollIntoViewIfNeeded();
  await page.waitForSelector('#v6rb .rbl li');
  await ctx.setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event('offline')));
  await page.click('[data-a="rbtab"][data-v="all"]');
  assert.match(await page.textContent('#v6rb'), /Offline\. The board opens when you are back online/);
  await page.click('[data-a="rbtab"][data-v="week"]');
  assert.equal(await page.locator('#v6rb .rbl li').count(), 4, 'cached board still shown offline');
  assert.equal(await page.locator('#v6rb [data-a="rbjoin"]').isDisabled(), true, 'cannot join offline');
  // the rest of the app is fine and RETURNING data intact
  for (const v of ['home', 'water', 'stair', 'sleep', 'set']) await go(page, v);
  assert.equal((await state(page)).p.name, RETURNING.p.name);
  assert.equal(await page.locator('#main .card.warn h3').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('weekly totals: Monday weeks, valid pace only, best 5K from runs ≥ 5 km', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(() => {
    const ws = '2026-09-28', R = [
      { start: '2026-09-28T07:00:00', dist: 5000, dur: 1500 },  // 5:00/km → 5K 25:00
      { start: '2026-09-30T07:00:00', dist: 10000, dur: 3300 }, // 5:30/km → 5K 27:30
      { start: '2026-10-01T07:00:00', dist: 2000, dur: 2400 },  // 20:00/km walk: not counted
      { start: '2026-10-02T07:00:00', dist: 1000, dur: 100 },   // 1:40/km: not counted
      { start: '2026-10-05T07:00:00', dist: 3000, dur: 900 },   // next week
    ].map(x => ({ ...x, start: new Date(x.start).toISOString() }));
    return { w: HWRunBoard.weekOf(R, ws), mon: HWRunBoard.monday(new Date('2026-10-04T23:00:00')), fold: HWRunBoard.fold('$h!7') };
  });
  assert.deepEqual(r.w, { ws: '2026-09-28', km: 15, runs: 2, sec: 4800, b5: 1500, skipped: 2 });
  assert.equal(r.mon, '2026-09-28', 'Sunday belongs to the week that started on Monday');
  assert.equal(r.fold, 'shit');
  assert.deepEqual(errors, []);
  await ctx.close();
});
