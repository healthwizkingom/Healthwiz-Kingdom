// Live weather and haze for Kolej MARA Kulim (js/v6-live.js, sky in js/v6-title.js). Open-Meteo is stubbed here:
// tests never reach the real network.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getBrowser, closeBrowser, APP_URL, RETURNING, go, state } from './helpers.mjs';

after(closeBrowser);
const wxBody = (code, o = {}) => ({ current: { time: '2026-10-05T14:00', temperature_2m: 31.4, relative_humidity_2m: 78, apparent_temperature: 36.2, is_day: 1, precipitation: 1, weather_code: code, cloud_cover: 90, wind_speed_10m: 8, ...o } });
const aqBody = pm => ({ current: { time: '2026-10-05T14:00', pm2_5: pm, pm10: pm * 1.3, us_aqi: 80 } });

/** Opens the app with Open-Meteo answered by `wx` / `aq` (objects, or 'fail' to abort). Counts the requests. */
async function open({ wx = wxBody(61), aq = aqBody(10), seed = RETURNING, cache, context } = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, ...context });
  const calls = { wx: 0, aq: 0, urls: [] };
  await ctx.route(/^https?:/, r => {
    const u = r.request().url();
    const ans = (k, body) => { calls[k]++; calls.urls.push(u); return body === 'fail' ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); };
    if (/air-quality-api\.open-meteo\.com/.test(u)) return ans('aq', aq);
    if (/api\.open-meteo\.com/.test(u)) return ans('wx', wx);
    return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|integrity/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.addInitScript(([s, c]) => { if (!localStorage.getItem('healthwiz')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); if (c) localStorage.setItem('healthwiz_cache', c); } }, [JSON.stringify(seed), cache ? JSON.stringify(cache) : null]);
  await page.goto(APP_URL);
  await page.waitForSelector('.wl');
  await page.waitForFunction(() => !/Checking/.test(document.querySelector('#v6wxt')?.textContent || ''));
  return { page, ctx, calls, errors };
}

test('WMO codes map to the requested skies', async () => {
  const { page, ctx, errors } = await open();
  const m = await page.evaluate(() => [0, 1, 2, 3, 45, 48, 51, 57, 61, 80, 63, 65, 81, 82, 95, 99].map(c => [c, HWLive.skyOf(c, true)]).concat([[0, HWLive.skyOf(0, false)]]));
  assert.deepEqual(m, [[0, 'sunny'], [1, 'sunny'], [2, 'cloudy'], [3, 'cloudy'], [45, 'mist'], [48, 'mist'], [51, 'rain'], [57, 'rain'], [61, 'rain'], [80, 'rain'], [63, 'heavy'], [65, 'heavy'], [81, 'heavy'], [82, 'downpour'], [95, 'storm'], [99, 'storm'], [0, 'night']]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('title screen and Home: live sky, chip, heat tip; one request per source, Kulim coordinates', async () => {
  const { page, ctx, calls, errors } = await open({ wx: wxBody(95) });
  assert.equal(await page.getAttribute('.wl', 'data-sky'), 'storm');
  assert.equal(await page.locator('.v6wx.storm .v6fl').count(), 1, 'lightning flash layer');
  const chip = await page.textContent('#v6wxt');
  assert.match(chip, /Kulim now · 31 °C \(feels 36 °C\) · Thunderstorm · 78% humidity/);
  assert.match(chip, /Feels 36 °C/, 'heat tip at feels-like ≥ 35 °C');
  assert.equal(calls.wx, 1); assert.equal(calls.aq, 1);
  for (const u of calls.urls) { assert.match(u, /latitude=5\.365/); assert.match(u, /longitude=100\.56/); assert.match(u, /timezone=Asia\/Kuala_Lumpur/); }
  await go(page, 'home');
  assert.match(await page.textContent('#v6wxh'), /Kulim now · 31 °C/);
  assert.match(await page.textContent('#v6wxh'), /Feels 36 °C/);
  // flash timing: at most 3 flashes a second
  const fl = await page.evaluate(() => { for (const sh of document.styleSheets) { let L; try { L = sh.cssRules; } catch { continue; } for (const r of L) if (r.name === 'v6fl') return [...r.cssRules].map(k => k.keyText); } });
  assert.ok(fl && fl.length, 'flash keyframes exist');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no heat tip below 35 °C feels-like; clear night shows the night sky', async () => {
  const { page, ctx, errors } = await open({ wx: wxBody(0, { is_day: 0, apparent_temperature: 29 }) });
  assert.equal(await page.getAttribute('.wl', 'data-sky'), 'night');
  assert.doesNotMatch(await page.textContent('#v6wxt'), /Feels/);
  assert.match(await page.textContent('#v6wxt'), /Clear sky/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reduced motion: no lightning flash is drawn', async () => {
  const { page, ctx, errors } = await open({ wx: wxBody(95), context: { reducedMotion: 'reduce' } });
  assert.equal(await page.getAttribute('.wl', 'data-sky'), 'storm');
  assert.equal(await page.locator('.v6fl').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('haze: five PM2.5 levels with advice; card on Home, banner on Stairs, hazy kingdom sky from level 3', async () => {
  const { page, ctx, errors } = await open({ aq: aqBody(72) });
  const bands = await page.evaluate(() => [5, 15, 15.1, 35, 40, 55, 100, 150, 151].map(v => HWLive.band(v).n));
  assert.deepEqual(bands, [1, 1, 2, 2, 3, 3, 4, 4, 5]);
  await go(page, 'home');
  const card = await page.textContent('#v6haze');
  assert.match(card, /JEREBU CHECK/); assert.match(card, /UNHEALTHY/); assert.match(card, /PM2\.5 72 µg\/m³/);
  assert.match(card, /Avoid vigorous outdoor exercise; use indoor stairs or rest\./);
  assert.match(card, /modelled estimate/); assert.match(card, /at 14:00/); assert.match(card, /Open-Meteo/);
  assert.equal(await page.getAttribute('#v6haze a', 'href'), 'https://apims.doe.gov.my');
  assert.ok(await page.evaluate(() => document.body.classList.contains('hw-haze')), 'hazy kingdom sky');
  await go(page, 'stair');
  assert.equal(await page.locator('.v6hzb').count(), 1);
  assert.match(await page.textContent('.v6hzb'), /UNHEALTHY · PM2\.5 72/);
  await go(page, 'run');
  assert.equal(await page.locator('.v6hzb').count(), 1, 'the running route shows it too');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('good air: no haze on the kingdom sky', async () => {
  const { page, ctx } = await open({ aq: aqBody(8) });
  await go(page, 'home');
  assert.match(await page.textContent('#v6haze'), /GOOD/);
  assert.match(await page.textContent('#v6haze'), /Great for jogging and stairs outdoors\./);
  assert.equal(await page.evaluate(() => document.body.classList.contains('hw-haze')), false);
  await ctx.close();
});

test('offline / failing API: default scene, "Weather unavailable", nothing breaks, save untouched', async () => {
  const { page, ctx, errors } = await open({ wx: 'fail', aq: 'fail' });
  assert.equal(await page.getAttribute('.wl', 'data-sky'), 'plain', 'the plain scene: no made-up weather while live data is on');
  assert.equal(await page.locator('.v6wx i, .v6fl').count(), 0, 'no rain drawn');
  assert.doesNotMatch(await page.textContent('[data-wx]'), /RAIN|CLOUDS|MIST|CLEAR/);
  assert.match(await page.textContent('#v6wxt'), /Weather unavailable/);
  await go(page, 'home');
  assert.match(await page.textContent('#v6wxh'), /Weather unavailable/);
  assert.match(await page.textContent('#v6haze'), /unavailable/);
  await go(page, 'stair');
  assert.match(await page.textContent('.v6hzb'), /unavailable/);
  assert.deepEqual((await state(page)).s, RETURNING.s, 'no new field is written just by visiting');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('cache: fresh copies are reused, a failed refresh falls back to the last good copy marked "as of"', async () => {
  const now = Date.now();
  const fresh = { wx: { t: now - 5 * 60e3, d: wxBody(3) }, aq: { t: now - 5 * 60e3, d: aqBody(20) } };
  let r = await open({ cache: fresh });
  assert.equal(r.calls.wx + r.calls.aq, 0, 'no request while the cache is fresh');
  assert.equal(await r.page.getAttribute('.wl', 'data-sky'), 'cloudy');
  await r.ctx.close();
  const old = { wx: { t: now - 60 * 60e3, d: wxBody(3) }, aq: { t: now - 60 * 60e3, d: aqBody(20) } };
  r = await open({ cache: old, wx: 'fail', aq: 'fail' });
  assert.equal(r.calls.wx, 1);
  assert.equal(await r.page.getAttribute('.wl', 'data-sky'), 'cloudy', 'last good copy');
  assert.match(await r.page.textContent('#v6wxt'), /as of/);
  assert.deepEqual(r.errors, []);
  await r.ctx.close();
});

test('Settings → LIVE DATA: toggle off hides everything and sends nothing; REFRESH re-fetches; old saves load', async () => {
  const { page, ctx, calls, errors } = await open();
  await go(page, 'set');
  assert.match(await page.textContent('#v6live'), /LIVE DATA/);
  assert.match(await page.textContent('#v6live'), /Updated/);
  const before = calls.wx;
  await page.click('[data-a="liveref"]');
  await page.waitForFunction(() => !document.querySelector('[data-a="liveref"][disabled]'));
  assert.equal(calls.wx, before + 1, 'REFRESH skips the fresh cache');
  await page.click('[data-a="livetog"]');
  assert.equal((await state(page)).s.live, 0);
  assert.match(await page.textContent('#v6live'), /LIVE DATA: OFF/);
  await go(page, 'home');
  assert.equal(await page.locator('#v6wxh, #v6haze').count(), 0);
  await go(page, 'stair');
  assert.equal(await page.locator('.v6hzb').count(), 0);
  const n = calls.wx + calls.aq;
  // (no page reload here: the test browser can lose file:// storage on a quick reload)
  await page.evaluate(() => { refreshLive(true); document.dispatchEvent(new Event('visibilitychange')); dispatchEvent(new Event('online')); });
  await go(page, 'welcome'); await page.waitForTimeout(300);
  assert.equal(calls.wx + calls.aq, n, 'no request while off');
  assert.equal(await page.textContent('#v6wxt'), '');
  assert.equal(await page.getAttribute('.wl', 'data-sky'), await page.evaluate(() => HWTitle.weather()), 'Live Data off: the day\'s own weather');
  assert.equal(await page.evaluate(() => typeof localStorage.getItem('healthwiz_cache')), 'string', 'cache is its own key');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('title screen with a live chip: Start stays on screen and clear of the title, portrait and landscape', async () => {
  const { page, ctx, errors } = await open({ wx: wxBody(95) });
  for (const [w, h] of [[390, 844], [360, 640], [844, 390], [568, 320]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const b = await page.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(), t = r('.wl .tt'), c = r('.wl .ct'); return { onScreen: c.bottom <= innerHeight && c.right <= innerWidth, clear: t.bottom <= c.top, wide: document.documentElement.scrollWidth <= innerWidth }; });
    assert.deepEqual(b, { onScreen: true, clear: true, wide: true }, `at ${w}×${h}`);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});
