import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, state } from './helpers.mjs';

after(closeBrowser);
// a few metres from "Tangga sebelah rumah penjana elektrik ke Dewan Kenanga" (ST20: 5.3519878, 100.5383771)
const AT_ST20 = { latitude: 5.35202, longitude: 100.53838, accuracy: 12 };
async function boot({ pos, grant = true, seed, viewport } = {}) {
  const r = await openApp({ seed, viewport });
  if (grant) await r.ctx.grantPermissions(['geolocation']);
  if (pos) await r.ctx.setGeolocation(pos);
  await r.page.waitForSelector('.wl');
  await go(r.page, 'stair');
  await r.page.evaluate(() => { window.__ev = []; HWEvents.on('activity:checkin', e => window.__ev.push(e)); });
  return r;
}
const find = page => page.click('#v6gps [data-a="gpsfind"]');

test('GPS check-in: explanation first, one reading, nearby list, confirm logs a stair session, discovery once, position never saved', async () => {
  const { page, ctx, errors } = await boot({ pos: AT_ST20 });
  assert.match(await page.textContent('#v6gps'), /GPS CHECK-IN[\s\S]*at Kolej MARA Kulim\?[\s\S]*28 of 32 stairways are on the map; the other 4 can be logged by hand[\s\S]*discovered by GPS check-in: 0 of 28 on the map \(32 stairways in total\)/);
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return h.indexOf('id="stman"') < h.indexOf('v6gps'); });
  assert.ok(order, 'the manual form comes first (input above the fold); the GPS card follows it');
  await find(page);
  assert.match(await page.textContent('#v6gps'), /WHY LOCATION\?[\s\S]*read once[\s\S]*never saved, shared or shown/);
  assert.equal((await state(page)).gp.ok, 0, 'nothing is allowed before the user agrees');
  await page.click('[data-a="gpsok"]');
  await page.waitForSelector('#v6gps .v6gpl');
  const txt = await page.textContent('#v6gps');
  assert.match(txt, /accurate to ±12 m/);
  assert.match(txt, /Tangga sebelah rumah penjana elektrik ke Dewan Kenanga[\s\S]*about \d+ m away[\s\S]*YOU ARE HERE/);
  assert.ok(await page.locator('#v6gps .v6gpl').count() <= 5, 'at most five stairways listed');
  const s0 = await state(page);
  assert.equal(s0.gp.ok, 1);
  await page.click('[aria-label="Check in at Tangga sebelah rumah penjana elektrik ke Dewan Kenanga"]');
  assert.match(await page.textContent('#v6gps'), /standing still[\s\S]*don't use your phone on the stairs/);
  await page.fill('#gps-s', '0');
  await page.click('[data-a="gpsconfirm"]');
  assert.equal((await state(page)).e.length, 0, 'invalid input is not saved');
  await page.fill('#gps-s', '20');
  await page.fill('#gps-c', '2');
  await page.click('[data-a="gpsconfirm"]');
  await page.waitForFunction(() => /Checked in at/.test(document.querySelector('#v6gps').textContent));
  let s = await state(page);
  assert.equal(s.e.length, 1);
  const e = s.e[0];
  assert.equal(e.c, 'stair'); assert.equal(e.v, 40); assert.equal(e.m.sid, 'ST20'); assert.equal(e.m.chk, 'gps'); assert.equal(e.m.climbs, 2);
  assert.equal(e.m.kind, 'casual'); assert.equal(e.m.src, 'gps'); assert.equal(e.n, '', 'no notes');
  const xp = () => page.evaluate(() => HWEvents.recent('xp:gained').map(x => [x.amount, x.reason]).filter(x => /check-in|Discovered/.test(x[1])));
  assert.deepEqual(await xp(), [[25, 'Stair check-in'], [5, 'Discovered Tangga sebelah rumah penjana elektrik ke Dewan Kenanga']], '25 for the session + 5 for the discovery');
  assert.ok(s.gp.v.ST20);
  assert.match(await page.textContent('#v6gps'), /discovered by GPS check-in: 1 of 28 on the map/);
  assert.match(await page.textContent('.sqlist .chip.on'), /penjana elektrik/, 'the manual form now points at that stairway');
  const raw = await page.evaluate(() => localStorage.getItem('healthwiz'));
  assert.ok(!raw.includes('5.35202') && !raw.includes('100.53838'), 'the user position is never stored');
  // a second check-in at the same stairway: logged, no second discovery
  await find(page);
  await page.waitForSelector('#v6gps .v6gpl');
  await page.click('[aria-label="Check in at Tangga sebelah rumah penjana elektrik ke Dewan Kenanga"]');
  assert.equal(await page.inputValue('#gps-s'), '20', 'steps per climb remembered from the last visit');
  await page.click('[data-a="gpsconfirm"]');
  await page.waitForFunction(() => /Checked in at/.test(document.querySelector('#v6gps').textContent));
  s = await state(page);
  assert.equal(s.e.length, 2);
  assert.deepEqual((await xp()).slice(2), [[25, 'Stair check-in']], 'no second discovery');
  assert.deepEqual(await page.evaluate(() => window.__ev.map(x => [x.sid, x.first])), [['ST20', true], ['ST20', false]]);
  // turning location off forgets the agreement
  await page.click('[data-a="gpsoff"]');
  assert.equal((await state(page)).gp.ok, 0);
  await find(page);
  assert.match(await page.textContent('#v6gps'), /WHY LOCATION\?/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('weak signal pauses check-in; far away shows the nearest; denied permission explains and saves nothing', async () => {
  const seed = { ...RETURNING, gp: { ok: 1, v: {} } };
  let r = await boot({ seed, pos: { ...AT_ST20, accuracy: 300 } });
  await find(r.page);
  await r.page.waitForSelector('#v6gps .v6gpl');
  assert.match(await r.page.textContent('#v6gps'), /signal is weak \(±300 m\), so check-in is paused/);
  assert.equal(await r.page.locator('#v6gps [data-a="gpspick"]').count(), 0);
  await r.ctx.setGeolocation({ latitude: 3.139, longitude: 101.6869, accuracy: 10 });
  await r.page.click('#v6gps [data-a="gpsfind"]');
  await r.page.waitForFunction(() => /away from Kolej MARA Kulim/.test(document.querySelector('#v6gps').textContent));
  assert.match(await r.page.textContent('#v6gps'), /only works at the campus stairways \(about \d+\.\d km away\)/);
  // on campus but not near a stairway (≈ 600 m south of the stairs)
  await r.ctx.setGeolocation({ latitude: 5.3437, longitude: 100.5388, accuracy: 10 });
  await r.page.click('#v6gps [data-a="gpsfind"]');
  await r.page.waitForFunction(() => /No mapped stairway within 400 m/.test(document.querySelector('#v6gps').textContent));
  assert.match(await r.page.textContent('#v6gps'), /The nearest is .+, about \d+ m away/);
  assert.deepEqual(r.errors, []);
  await r.ctx.close();

  r = await boot({ seed, grant: false, pos: AT_ST20 });
  await find(r.page);
  await r.page.waitForSelector('#v6gps [role="alert"]', { timeout: 30000 });
  assert.match(await r.page.textContent('#v6gps'), /permission is off[\s\S]*Nothing was saved[\s\S]*log a climb by hand/);
  assert.equal((await state(r.page)).e.length, 0);
  assert.deepEqual(r.errors, []);
  await r.ctx.close();
});

test('stairways without coordinates are never GPS targets; distance and radius math; v7 data gains gp; fits 360 px', async () => {
  const seed = { ...RETURNING, sv: 7 };
  delete seed.gp;
  const { page, ctx, errors } = await boot({ seed, pos: AT_ST20, viewport: { width: 360, height: 800 } });
  const r = await page.evaluate(() => {
    const L = HWGps.nearby({ lat: 5.3512, lng: 100.5385, acc: 5 });
    return { n: L.length, ids: L.map(x => x.s.id), sorted: L.every((x, i) => !i || L[i - 1].d <= x.d),
      d: Math.round(HWGps.dist(5.3519878, 100.5383771, 5.3525206, 100.5386027)), r: [HWGps.radius(0), HWGps.radius(30), HWGps.radius(500)] };
  });
  assert.equal(r.n, 28);
  for (const id of ['ST02', 'ST08', 'ST16', 'ST29']) assert.ok(!r.ids.includes(id), id + ' has no coordinates');
  assert.ok(r.sorted);
  assert.ok(r.d > 55 && r.d < 75, 'ST20 → ST19 is about 64 m: ' + r.d);
  assert.deepEqual(r.r, [35, 65, 100]);
  const s = await state(page);
  assert.equal(s.sv, 8); assert.deepEqual(s.gp, { ok: 0, v: {} });
  await find(page);
  await page.click('[data-a="gpsok"]');
  await page.waitForSelector('#v6gps .v6gpl');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal scroll at 360 px');
  assert.deepEqual(errors, []);
  await ctx.close();
});
