// GPS running tracker (js/v6-running.js). No real GPS: a fake navigator.geolocation streams fixes, a tiny fake Leaflet
// records what the map is asked to draw, and Playwright's clock makes distance, time and pace exact.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';
import { fakeSupabase, URL0, ANON, CLOUD, synced, signIn } from './cloud-fake.mjs';

after(closeBrowser);
const T0 = new Date('2026-10-04T07:10:00');
const STEP = 0.0001;                      // 0.0001° of latitude ≈ 11.12 m
const STEP_M = 6371e3 * Math.PI / 180 * STEP;

// navigator.geolocation stand-in: the test pushes fixes with __gps.send(); deny: every watch fails with PERMISSION_DENIED
function fakeGps(deny) {
  const w = {}; let n = 0;
  window.__gps = { opts: null, cleared: 0, watching: () => Object.keys(w).length,
    send(lat, lng, acc = 5) { Object.values(w).forEach(x => x.ok({ coords: { latitude: lat, longitude: lng, accuracy: acc }, timestamp: Date.now() })); } };
  const geo = { watchPosition(ok, no, o) { window.__gps.opts = o; const id = ++n; w[id] = { ok, no }; if (deny) Promise.resolve().then(() => no({ code: 1, message: 'denied' })); return id; },
    clearWatch(id) { if (w[id]) { delete w[id]; window.__gps.cleared++; } }, getCurrentPosition() {} };
  Object.defineProperty(navigator, 'geolocation', { configurable: true, get: () => geo });
}
// just enough of the Leaflet API for the module, logging every call
function fakeLeaflet() {
  const log = window.__map = { maps: 0, removed: 0, tiles: [], lines: [], views: [] };
  const layer = o => Object.assign(o, { addTo() { return o; } });
  window.L = {
    map(el) { log.maps++; el.dataset.fake = '1'; const m = { on() { return m; }, setView(c, z) { log.views.push(['view', c, z]); return m; }, fitBounds(b) { log.views.push(['fit', b.length]); return m; },
      panTo(c) { log.views.push(['pan', c]); return m; }, removeLayer() { return m; }, remove() { log.removed++; } }; return m; },
    tileLayer(url, o) { log.tiles.push([url, o.attribution]); return layer({}); },
    polyline(lls, o) { const p = layer({ lls, o, setLatLngs(x) { p.lls = x; return p; }, getBounds() { return p.lls; } }); log.lines.push(p); return p; },
    circleMarker(ll) { const c = layer({ ll, setLatLng(x) { c.ll = x; return c; } }); log.dot = c; return c; },
  };
}
const seedRuns = o => page => page.addInitScript(s => { if (!sessionStorage.getItem('runs')) { localStorage.setItem('healthwiz_runs', s); sessionStorage.setItem('runs', '1'); } }, JSON.stringify(o));

async function boot({ deny = false, leaflet = true, seed, viewport, extra } = {}) {
  const r = await openApp({ seed, viewport, before: async page => {
    await page.addInitScript(fakeGps, deny);
    if (leaflet) await page.addInitScript(fakeLeaflet);
    if (extra) await extra(page);
    await page.clock.install({ time: new Date(T0.getTime() - 60e3) });
  } });
  await r.page.waitForSelector('.wl');
  await r.page.clock.pauseAt(T0);         // from here on, time moves only when the test says so
  return r;
}
const send = (page, lat, lng, acc) => page.evaluate(([a, b, c]) => window.__gps.send(a, b, c), [lat, lng, acc]);
const txt = (page, sel) => page.textContent(sel);
const metrics = async page => [await txt(page, '#v6rd'), await txt(page, '#v6rt'), await txt(page, '#v6rp')];
const ff = (page, ms) => page.clock.fastForward(ms);
const run = page => page.evaluate(() => HWRun.run);

test('pure maths: Haversine distance, GPS fix filter, pace and time formats', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => {
    const f = (lat, lng, acc, t) => ({ lat, lng, acc, t });
    const last = f(5.35, 100.5385, 5, 0);
    return {
      deg: HWRun.dist(0, 0, 1, 0), lng: HWRun.dist(0, 0, 0, 1), st: HWRun.dist(5.3519878, 100.5383771, 5.3525206, 100.5386027), zero: HWRun.dist(5.35, 100.53, 5.35, 100.53),
      weak: HWRun.judge(last, f(5.3501, 100.5385, 80, 4000)).k, first: HWRun.judge(null, f(5.35, 100.5385, 5, 0)).k,
      still: HWRun.judge(last, f(5.35003, 100.5385, 5, 4000)).k,                 // ≈ 3 m: GPS noise while standing
      noisy: HWRun.judge(last, f(5.35007, 100.5385, 30, 4000)).k,               // ≈ 8 m but ±30 m accuracy
      jump: HWRun.judge(last, f(5.355, 100.5385, 5, 10000)).k,                  // ≈ 556 m in 10 s
      same: HWRun.judge(last, f(5.3501, 100.5385, 5, 0)).k,                     // no time passed
      ok: HWRun.judge(last, f(5.3501, 100.5385, 5, 4000)),
      pace: [HWRun.pace(5000, 1500), HWRun.pace(5, 100), HWRun.pace(1000, 0)],
      fp: [HWRun.fmtPace(300), HWRun.fmtPace(359.6), HWRun.fmtPace(null), HWRun.fmtPace(7000)],
      clock: [HWRun.clock(0), HWRun.clock(59), HWRun.clock(600), HWRun.clock(3725), HWRun.clock(-5)],
    };
  });
  assert.ok(Math.abs(r.deg - 111195) < 1, '1° of latitude ≈ 111.195 km: ' + r.deg);
  assert.ok(Math.abs(r.lng - 111195) < 1, '1° of longitude on the equator: ' + r.lng);
  assert.ok(r.st > 55 && r.st < 75, 'two campus stairways ≈ 64 m: ' + r.st);
  assert.equal(r.zero, 0);
  assert.deepEqual([r.weak, r.first, r.still, r.noisy, r.jump, r.same], ['weak', 'first', 'still', 'still', 'jump', 'jump']);
  assert.equal(r.ok.k, 'ok'); assert.ok(Math.abs(r.ok.d - STEP_M * 1) < 0.01);
  assert.deepEqual(r.pace, [300, null, null]);
  assert.deepEqual(r.fp, ['5:00', '6:00', '--:--', '--:--']);
  assert.deepEqual(r.clock, ['0:00', '0:59', '10:00', '1:02:05', '0:00']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Stairs page → Running section: explain, start, live metrics, noise filtered, pause, resume, leave and return, finish saves locally', async () => {
  const { page, ctx, errors } = await boot();
  await go(page, 'health');
  const tiles = await page.$$eval('#hub .hb', b => b.map(x => x.dataset.v));
  assert.deepEqual(tiles, ['food', 'sleep', 'stair', 'stress', 'body', 'stats', 'score'], 'no Pulse or Running tile: both live on the Stairs page');
  await page.click('#hub [data-v="stair"]');
  assert.equal(await page.locator('#map [data-a="runmap"]').count(), 1, 'no map download until Running is wanted');
  await page.click('[data-a="stjump"][data-t="st-run"]');
  assert.equal(await page.evaluate(() => S.v), 'stair');
  assert.match(await txt(page, '#main'), /BACK TO HEALTH[\s\S]*RUNNING ROAD[\s\S]*DISTANCE[\s\S]*TIME[\s\S]*AVG PACE/);
  assert.match(await txt(page, '#nav .on'), /Health/);
  assert.deepEqual(await metrics(page), ['0.00', '0:00', '--:--']);
  assert.deepEqual([await page.isEnabled('[data-a="runstart"]'), await page.isDisabled('[data-a="runpause"]'), await page.isDisabled('[data-a="runfinish"]')], [true, true, true]);
  await page.waitForSelector('#map[data-fake]');
  const map0 = await page.evaluate(() => window.__map);
  assert.equal(map0.maps, 1);
  assert.match(map0.tiles[0][0], /^https:\/\/tile\.openstreetmap\.org\//); assert.match(map0.tiles[0][1], /OpenStreetMap/);

  // first START explains why location is needed; nothing is watched before ALLOW
  await page.click('[data-a="runstart"]');
  assert.match(await txt(page, '#v6run'), /WHY LOCATION\?[\s\S]*while a run is recording/);
  assert.equal(await page.evaluate(() => window.__gps.opts), null);
  await page.click('[data-a="runok"]');
  assert.deepEqual(await page.evaluate(() => [window.__gps.watching(), window.__gps.opts]), [1, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }]);
  assert.equal(await page.evaluate(() => HWRun.state), 'running');
  assert.match(await txt(page, '#v6run'), /RECORDING[\s\S]*GPS: SEARCHING/);
  assert.deepEqual([await page.isDisabled('[data-a="runstart"]'), await page.isEnabled('[data-a="runpause"]'), await page.isEnabled('[data-a="runfinish"]')], [true, true, true]);

  // run north: 10 steps of ≈ 11.12 m, one every 4 s (≈ 6:00 /km), with GPS noise in between
  const lat0 = 5.35, lng0 = 100.5385;
  await send(page, lat0, lng0);
  assert.match(await txt(page, '#v6rg'), /GPS ±5 M/);
  for (let k = 1; k <= 10; k++) {
    await ff(page, 4000);
    await send(page, lat0 + k * STEP, lng0);
    if (k === 3) { await send(page, 5.36, 100.55, 80); assert.match(await txt(page, '#v6rg'), /WEAK ±80 M · NOT COUNTED/); }
    if (k === 5) await send(page, lat0 + 100 * STEP, lng0);           // a 1 km jump at the same instant
    if (k === 7) await send(page, lat0 + k * STEP + 0.00001, lng0);   // ≈ 1 m of standing-still jitter
  }
  let r = await run(page);
  assert.ok(Math.abs(r.dist - 10 * STEP_M) < 0.05, 'only the 10 real steps count: ' + r.dist);
  assert.deepEqual(r.segs, [11]);
  assert.deepEqual(await metrics(page), ['0.11', '0:40', '6:00']);
  let line = await page.evaluate(() => window.__map.lines.at(-1).lls);
  assert.equal(line.length, 1); assert.equal(line[0].length, 11);
  assert.deepEqual(line[0][10], [+(lat0 + 10 * STEP).toFixed(6), lng0], 'the route line follows the fixes');
  assert.deepEqual(await page.evaluate(() => window.__map.dot.ll), line[0][10], 'current position marker');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz_run_live')));
  assert.ok(saved && saved.segs[0].length >= 3, 'the run in progress is kept in case the page is closed');

  // pause: time and distance stop, even while moving
  await page.click('[data-a="runpause"]');
  assert.equal(await page.evaluate(() => HWRun.state), 'paused');
  assert.match(await txt(page, '#v6run'), /PAUSED[\s\S]*RESUME/);
  await ff(page, 60e3);
  await send(page, lat0 + 15 * STEP, lng0);
  assert.deepEqual(await metrics(page), ['0.11', '0:40', '6:00']);
  // resume somewhere else: a new segment, the gap is not counted
  await page.click('[data-a="runpause"]');
  await send(page, 5.351, 100.5395);
  for (let k = 1; k <= 2; k++) { await ff(page, 4000); await send(page, 5.351 + k * STEP, 100.5395); }
  r = await run(page);
  assert.ok(Math.abs(r.dist - 12 * STEP_M) < 0.05, r.dist);
  assert.deepEqual(r.segs, [11, 3]);
  assert.deepEqual(await metrics(page), ['0.13', '0:48', '6:00']);
  assert.equal((await page.evaluate(() => window.__map.lines.at(-1).lls)).length, 2, 'two line segments');

  // leaving the page keeps recording; coming back redraws the map
  await go(page, 'health');
  assert.match(await txt(page, '#toasts'), /still recording/);
  assert.match(await txt(page, '#hub [data-v="stair"]'), /run recording · 0\.13 km/);
  assert.equal(await page.evaluate(() => window.__gps.watching()), 1);
  await go(page, 'run');
  await page.waitForFunction(() => window.__map.maps === 2);
  assert.equal(await page.evaluate(() => window.__map.removed), 1, 'the old map was removed');
  assert.equal((await page.evaluate(() => window.__map.lines.at(-1).lls)).length, 2);

  // finish: watch stopped, run saved on this device, nothing added to the health log
  await page.click('[data-a="runfinish"]');
  assert.deepEqual(await page.evaluate(() => [window.__gps.watching(), HWRun.state, localStorage.getItem('healthwiz_run_live')]), [0, 'done', null]);
  assert.match(await txt(page, '#v6run'), /RUN SAVED/);
  assert.match(await txt(page, '#toasts'), /Run saved: 0\.13 km in 0:48/);
  const runs = await page.evaluate(() => HWRun.runs());
  assert.equal(runs.length, 1);
  const x = runs[0];
  assert.match(x.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepEqual([x.dist, x.dur, x.pace, x.up, x.start, x.end], [133, 48, 361, 0, T0.toISOString(), new Date(T0.getTime() + 108e3).toISOString()]);
  assert.deepEqual(x.route.map(s => s.length), [11, 3]);
  assert.deepEqual(x.route[0][0], [lat0, lng0, 0]); assert.deepEqual(x.route[1][2], [5.3512, 100.5395, 108]);
  assert.equal((await state(page)).e.length, 0, 'the health log is untouched');
  assert.match(await txt(page, '#v6runs'), /Last 7 days: 0\.13 km in 1 run[\s\S]*0\.13 km · 0:48[\s\S]*6:01 \/km · 📱 on this device/);
  // delete needs two taps
  await page.click('[data-a="rundel"]');
  assert.equal((await page.evaluate(() => HWRun.runs())).length, 1);
  await page.click('[data-a="rundel"]');
  assert.deepEqual(await page.evaluate(() => [HWRun.runs().length, JSON.parse(localStorage.getItem('healthwiz_runs')).runs.length]), [0, 0]);
  assert.match(await txt(page, '#v6runs'), /No runs yet/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a run interrupted by a reload comes back paused and can be finished', async () => {
  const start = T0.getTime() - 600e3, at = start + 30e3;
  const live = { id: '11111111-1111-4111-8111-111111111111', start, segs: [[[5.35, 100.5385, 0], [5.3502, 100.5385, 15], [5.35045, 100.5385, 30]]], dist: 50, moving: 0, since: start, paused: 0, last: null, at };
  const { page, ctx, errors } = await boot({ extra: page => page.addInitScript(s => { if (!sessionStorage.getItem('live')) { localStorage.setItem('healthwiz_run_live', s); sessionStorage.setItem('live', '1'); } }, JSON.stringify(live)) });
  await go(page, 'health');
  assert.match(await txt(page, '#hub [data-v="stair"]'), /run paused · 0\.05 km/);
  await go(page, 'run');
  assert.equal(await page.evaluate(() => HWRun.state), 'paused');
  assert.match(await txt(page, '#v6run'), /PAUSED[\s\S]*interrupted/);
  assert.deepEqual(await metrics(page), ['0.05', '0:30', '10:00']);
  assert.equal(await page.evaluate(() => window.__gps.watching()), 0, 'no GPS until RESUME');
  await page.click('[data-a="runfinish"]');
  const x = (await page.evaluate(() => HWRun.runs()))[0];
  assert.deepEqual([x.id, x.dist, x.dur, x.pace, x.end], [live.id, 50, 30, 600, new Date(at).toISOString()]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('permission denied, weak-only GPS and TURN OFF LOCATION save nothing and explain why', async () => {
  let r = await boot({ deny: true, extra: seedRuns({ ok: 1, runs: [], del: [] }) });
  await go(r.page, 'run');
  await r.page.click('[data-a="runstart"]');
  await r.page.waitForSelector('#v6run [role="alert"]');
  assert.match(await txt(r.page, '#v6run'), /Location permission is off/);
  assert.deepEqual(await r.page.evaluate(() => [HWRun.state, HWRun.runs().length, window.__gps.watching(), localStorage.getItem('healthwiz_run_live')]), ['idle', 0, 0, null]);
  assert.deepEqual(r.errors, []);
  await r.ctx.close();

  r = await boot({ extra: seedRuns({ ok: 1, runs: [], del: [] }) });
  const { page } = r;
  await go(page, 'run');
  await page.click('[data-a="runstart"]');
  assert.equal(await page.evaluate(() => HWRun.state), 'running', 'already allowed: no second explanation');
  for (let k = 0; k < 5; k++) { await send(page, 5.35 + k * STEP, 100.5385, 60); await ff(page, 4000); }
  assert.equal((await run(page)).dist, 0);
  await page.click('[data-a="runfinish"]');
  assert.match(await txt(page, '#v6run'), /Nothing to save[\s\S]*Less than 10 m/);
  assert.equal((await page.evaluate(() => HWRun.runs())).length, 0);
  await page.click('[data-a="runoff"]');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz_runs')).ok), 0);
  await page.click('[data-a="runstart"]');
  assert.match(await txt(page, '#v6run'), /WHY LOCATION\?/);
  await page.click('[data-a="runno"]');
  assert.equal(await page.evaluate(() => HWRun.state), 'idle');
  assert.deepEqual(r.errors, []);
  await r.ctx.close();
});

test('offline, no Leaflet: the route is drawn as a trace and tracking still works; fits 360 px', async () => {
  const { page, ctx, errors } = await boot({ leaflet: false, viewport: { width: 360, height: 800 }, extra: seedRuns({ ok: 1, runs: [], del: [] }) });
  await ctx.setOffline(true);
  const req = [];
  page.on('request', q => { if (/unpkg|openstreetmap/.test(q.url())) req.push(q.url()); });
  await go(page, 'run');
  await page.waitForFunction(() => /Map unavailable/.test(document.querySelector('#map').textContent));
  await page.click('[data-a="runstart"]');
  await send(page, 5.35, 100.5385);
  for (let k = 1; k <= 4; k++) { await ff(page, 4000); await send(page, 5.35 + k * STEP, 100.5385 + k * STEP); }
  assert.ok((await run(page)).dist > 60);
  assert.equal(await page.locator('#map svg polyline').count(), 1);
  assert.equal((await page.getAttribute('#map svg polyline', 'points')).split(' ').length, 5);
  assert.match(await txt(page, '#map'), /Your route is still recorded/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll at 360 px');
  assert.deepEqual(req, [], 'nothing fetched while offline');
  await page.click('[data-a="runfinish"]');
  assert.equal((await page.evaluate(() => HWRun.runs())).length, 1);
  assert.equal(await page.locator('#map svg polyline').count(), 1, 'the finished route stays on the page');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// hw_runs with the rules of supabase/migrations/20261005000000_hw_runs.sql: own rows only, the id is the primary key
function withRuns(S) {
  S.runs = {}; S.noRuns = false;
  const base = S.handle;
  S.handle = async route => {
    const req = route.request(), u = new URL(req.url()), m = req.method();
    if (u.pathname !== '/rest/v1/hw_runs') return base(route);
    S.calls.push(m + ' ' + u.pathname);
    if (S.down) return route.abort('internetdisconnected');
    const send = (status, body) => route.fulfill({ status, contentType: 'application/json', body: body === undefined ? '' : JSON.stringify(body) });
    if (S.noRuns) return send(404, { code: 'PGRST205', message: "Could not find the table 'public.hw_runs' in the schema cache" });
    if (req.headers().apikey !== ANON) return send(401, { message: 'bad apikey' });
    const auth = (req.headers().authorization || '').replace('Bearer ', ''), sub = auth.split('.').length === 3 ? JSON.parse(Buffer.from(auth.split('.')[1], 'base64url')).sub : null;
    if (!sub || !Object.values(S.users).some(x => x.id === sub)) return send(401, { message: 'JWT invalid' });
    if (m === 'POST') {
      const b = JSON.parse(req.postData());
      if (b.user_id && b.user_id !== sub) return send(403, { code: '42501', message: 'row-level security' });
      if (S.runs[b.id]) return send(409, { code: '23505', message: 'duplicate key value violates unique constraint "hw_runs_pkey"' });
      const int = (v, hi) => Number.isInteger(v) && v >= 0 && v <= hi;
      if (!int(b.distance_m, 1e6) || !int(b.duration_s, 604800) || !(b.pace_s_per_km === null || b.pace_s_per_km > 0) || !Array.isArray(b.route) || !(Date.parse(b.finished_at) >= Date.parse(b.started_at)))
        return send(400, { code: '23514', message: 'violates check constraint' });
      S.runs[b.id] = { ...b, user_id: sub, prefer: req.headers().prefer };
      return send(201);
    }
    const id = (u.searchParams.get('id') || '').replace('eq.', '');
    if (m === 'DELETE') { if (S.runs[id] && S.runs[id].user_id === sub) delete S.runs[id]; return send(204); }
    if (m === 'GET') return send(200, Object.values(S.runs).filter(r => r.user_id === sub));
    return send(405, {});
  };
  return S;
}

test('cloud: nothing is sent while signed out; signed in, runs upload to hw_runs, wait offline, never duplicate, delete, missing table explained', async () => {
  const S = withRuns(fakeSupabase());
  const { page, ctx, errors } = await boot({ extra: async page => {
    await page.route(URL0 + '/**', S.handle);
    await page.addInitScript(c => { if (!sessionStorage.getItem('cl')) { localStorage.setItem('healthwiz_cloud', c); sessionStorage.setItem('cl', '1'); } }, CLOUD);
    await seedRuns({ ok: 1, runs: [], del: [] })(page);
  } });
  const doRun = async (steps = 3) => {
    await go(page, 'run');
    await page.click('[data-a="runstart"]');
    await send(page, 5.35, 100.5385);
    for (let k = 1; k <= steps; k++) { await ff(page, 4000); await send(page, 5.35 + k * STEP, 100.5385); }
    await page.click('[data-a="runfinish"]');
  };
  await page.clock.resume();               // the cloud save runs on timers
  await doRun();
  assert.match(await txt(page, '#v6runs'), /on this device[\s\S]*Sign in \(Settings → Account\) to back them up/);
  assert.equal(S.calls.filter(c => /hw_runs/.test(c)).length, 0, 'signed out: no run leaves the device');

  await signIn(page, S);
  await synced(page);
  await page.waitForFunction(() => HWRun.runs().every(r => r.up));
  const rows = Object.values(S.runs);
  assert.equal(rows.length, 1);
  const local0 = (await page.evaluate(() => HWRun.runs()))[0];
  const row = rows[0], uid = Object.values(S.users)[0].id;
  assert.deepEqual([row.id, row.user_id, row.distance_m, row.duration_s, row.pace_s_per_km, row.started_at, row.finished_at], [local0.id, uid, 33, local0.dur, local0.pace, local0.start, local0.end]);
  assert.ok(local0.dur >= 12 && local0.dur <= 13 && local0.pace > 350, 'time runs here, so ≈ 12 s: ' + local0.dur);
  assert.deepEqual(row.route.map(s => s.length), [4]);
  assert.equal(row.prefer, 'return=minimal');
  assert.equal(local0.route, null, 'in the cloud: only the summary stays on this device');
  await go(page, 'run');
  assert.match(await txt(page, '#v6runs'), /☁️ in your cloud[\s\S]*backed up to your private cloud save/);

  // offline: the run waits; back online it is sent once, even if an earlier attempt already reached the server
  S.down = true;
  await doRun(2);
  await page.waitForFunction(() => /Could not reach the cloud\. 1 run will be sent/.test(document.querySelector('#v6runs').textContent));
  const waiting = (await page.evaluate(() => HWRun.runs())).find(r => !r.up);
  S.runs[waiting.id] = { id: waiting.id, user_id: uid };   // the upload landed but the answer was lost
  S.down = false;
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.waitForFunction(() => HWRun.runs().every(r => r.up));
  assert.equal(Object.keys(S.runs).length, 2, 'no duplicate (409 = already there)');

  // delete removes it from the cloud too
  const first = local0.id;
  await page.click(`[data-a="rundel"][data-id="${first}"]`);
  await page.click(`[data-a="rundel"][data-id="${first}"]`);
  await page.waitForFunction(id => !HWRun.runs().some(r => r.id === id), first);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('healthwiz_runs')).del.length === 0);
  assert.deepEqual(Object.keys(S.runs), [waiting.id]);

  // the project has no hw_runs table yet: explained, kept on this device
  S.noRuns = true;
  await doRun(2);
  await page.waitForFunction(() => /not set up for runs yet/.test(document.querySelector('#v6runs').textContent));
  assert.equal((await page.evaluate(() => HWRun.runs())).filter(r => !r.up).length, 1);
  assert.deepEqual(errors.filter(e => !/Failed to load resource/.test(e)), []);
  await ctx.close();
});
