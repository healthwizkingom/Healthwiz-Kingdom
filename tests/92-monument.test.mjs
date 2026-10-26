// The Ascent Monument (js/v6-monument.js, js/v6-monument-scene.js): the door right under the Health Time Machine's on
// Statistics, the ascent worked out from the saved stair sessions (F21 measured rise, then the survey sheet over http; no rise
// = steps but no height), stages, the acknowledged state st.s.mon (only new stones animate, skip, reduced motion, deletions),
// landmark ratios, the empty state, the phone layout, and nothing written to the sessions.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, state, RETURNING, daysAgo } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { html: 'text/html', js: 'text/javascript', json: 'application/json', css: 'text/css', webp: 'image/webp', woff2: 'font/woff2', png: 'image/png', webmanifest: 'application/manifest+json', glb: 'model/gltf-binary', geojson: 'application/json', mp3: 'audio/mpeg', svg: 'image/svg+xml' };
let server, base;
before(async () => {
  server = http.createServer((q, res) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, path.normalize(p));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port + '/index.html';
});
after(async () => { await closeBrowser(); await new Promise(r => server.close(r)); });

const S = (id, sid, loc, steps, climbs, n, t = '08:00') => ({ id, c: 'stair', v: steps * climbs, n: '', d: daysAgo(n), t, m: { sid, loc, steps, climbs, kind: 'casual', src: 'manual' } });
// ST20 (F21: 0.169 m a step) 28 x 6 = 168 steps → 28.392 m; ST14 (F21: 0.149 m) 13 x 2 = 26 → 3.874 m;
// ST04 (survey: 15.5 cm) 35 x 4 = 140 → 21.7 m over http only; an old entry on an unknown staircase: 60 steps, no height
const SESS = [S('a', 'ST20', 'Generator stairs', 28, 6, 3), S('b', 'ST14', 'Block Kenanga stairs', 13, 2, 2), S('c', 'ST04', 'Tangga', 35, 4, 1),
  { id: 'old', c: 'stair', v: 60, n: '', d: daysAgo(9), t: '09:00', m: { loc: 'Somewhere else' } }];
// the badges these climbs earn are already earned, so no badge popup covers the page
const SEED = { ...RETURNING, b: { 'Stair Starter': daysAgo(3), 'Three-Day Flame': daysAgo(1), 'Returning Hero': daysAgo(1), 'Summit Seeker': daysAgo(1) }, e: SESS };
// seeded climbs earn badges: their popups would cover the page, so they are tapped away first
const popups = async page => { for (let i = 0; i < 12 && await page.evaluate(() => !!document.querySelector('.bpop')); i++) { await page.click('.bpop').catch(() => {}); await page.waitForTimeout(150); } };
const enter = async page => { await go(page, 'stats'); await popups(page); await page.click('[data-a="mngo"]'); await page.waitForSelector('#mnstage canvas'); };
const skipShown = page => page.evaluate(() => !document.querySelector('.mnskip').hidden);

test('the door sits right under the Health Time Machine; ENTER MY MONUMENT opens the page under the Health Hall', async () => {
  const { page, errors } = await openApp({ seed: SEED });
  await go(page, 'stats'); await popups(page);
  assert.equal(await page.evaluate(() => document.getElementById('mn-door').previousElementSibling.id), 'tm-door');
  const t = await page.textContent('#mn-door');
  assert.match(t, /THE ASCENT MONUMENT[\s\S]*Every climb builds your legacy\.[\s\S]*Every staircase you conquer adds to your monument\. Watch your accumulated ascent become something extraordinary\./);
  assert.match(t, /32\.3 m climbed/);
  await page.click('[data-a="mngo"]');
  assert.equal(await page.evaluate(() => [S.v, PAR[S.v]].join()), 'monument,health');
  assert.deepEqual(errors, []);
});

test('ascent = steps x the rise of one step: F21 measured from the device; no rise = steps but no height; nothing invented', async () => {
  const { page, errors } = await openApp({ seed: SEED });
  const before = JSON.stringify((await state(page)).e);
  await enter(page);
  const D = await page.evaluate(() => { const d = HWMonument.data(); return { H: d.H, steps: d.steps, un: d.un, n: d.n, known: d.known, sv: d.sv, stage: HWMonument.build(d.H).stage }; });
  assert.ok(Math.abs(D.H - (168 * .169 + 26 * .149)) < 1e-9, 'H = 28.392 + 3.874 m');
  assert.deepEqual([D.steps, D.n, D.known, D.un.n, D.un.steps, D.sv, D.stage], [168 + 26 + 140 + 60, 4, 2, 2, 200, 'local', 1]);
  const t = await page.textContent('#main');
  assert.match(t, /Total vertical ascent[\s\S]*32\.27 m/);
  assert.match(t, /2 sessions \(200 steps\) are on a staircase without a known step rise/);
  assert.match(t, /survey sheet cannot be read when the app is opened from this device/);
  assert.equal(JSON.stringify((await state(page)).e), before, 'the sessions are only read');
  assert.deepEqual(errors, []);
});

test('over http the survey sheet gives the other staircases their rise (ST04: 15.5 cm a step)', async () => {
  const { page, errors } = await openApp({ seed: SEED, url: base });
  await enter(page);
  await page.waitForFunction(() => HWMonument.data().sv === 'ok', null, { timeout: 10000 });
  const H = await page.evaluate(() => HWMonument.data().H);
  assert.ok(Math.abs(H - (28.392 + 3.874 + 140 * .155)) < 1e-6, 'H ' + H);
  await page.waitForFunction(() => /53\.97 m/.test(document.querySelector('.mnstats').textContent), null, { timeout: 10000 });
  assert.equal(await page.evaluate(() => HWMonument.riseOf('ST04').how), 'surveyed');
  assert.equal(await page.evaluate(() => HWMonument.riseOf('ST20').how), 'measured');
  assert.deepEqual(errors, []);
});

test('only new stones animate, once: first visit, a new climb, SKIP, then nothing replays; a deletion lowers it quietly', async () => {
  const { page, errors } = await openApp({ seed: SEED });
  await enter(page);
  assert.equal(await skipShown(page), true, 'the first visit builds the history');
  await page.waitForFunction(() => !HWMonumentScene.running, null, { timeout: 15000 });
  let a = (await state(page)).s.mon;
  assert.deepEqual([a.m, a.n], [32.27, 4]);
  await go(page, 'home'); await enter(page);
  assert.equal(await skipShown(page), false, 'acknowledged: nothing replays');
  // a new climb: ST20 again, 28 x 4 = 112 steps → 18.928 m
  await page.evaluate(() => { add('stair', 112, { sid: 'ST20', loc: 'Generator stairs', steps: 28, climbs: 4, kind: 'casual', src: 'manual' }, '', null, null, 0); });
  await go(page, 'home'); await enter(page);
  assert.equal(await skipShown(page), true);
  await popups(page);
  await page.click('[data-a="mnskip"]');
  assert.equal(await page.evaluate(() => HWMonumentScene.running), false);
  assert.match(await page.textContent('#mnnew'), /stones? laid: 18\.9 m climbed since your last visit/);
  a = (await state(page)).s.mon;
  assert.deepEqual([a.m, a.n], [51.19, 5]);
  assert.equal(await page.evaluate(() => HWMonument.build(HWMonument.data().H).stage), 2, 'Rising Keep from 50 m');
  // delete it: lower, acknowledged without an animation
  await page.evaluate(() => { const e = st.e.find(x => x.c === 'stair' && x.v === 112); acts.del({ id: e.id }); });
  await go(page, 'home'); await enter(page);
  assert.equal(await skipShown(page), false);
  a = (await state(page)).s.mon;
  assert.deepEqual([a.m, a.n], [32.27, 4]);
  assert.deepEqual(errors, []);
});

test('reduced motion: no animation and no skip button; the final picture and every number are shown', async () => {
  const { page, errors } = await openApp({ seed: SEED, context: { reducedMotion: 'reduce' } });
  await enter(page);
  assert.equal(await skipShown(page), false);
  assert.equal(await page.evaluate(() => HWMonumentScene.running), false);
  assert.equal((await state(page)).s.mon.m, 32.27);
  assert.match(await page.textContent('.mnalt'), /First Ascent stage/);
  assert.deepEqual(errors, []);
});

test('landmarks: R = H / height with its source; the to-scale view follows the chosen landmark', async () => {
  const { page, errors } = await openApp({ seed: SEED });
  await enter(page);
  const L = await page.evaluate(() => HWMonument.LANDMARKS.map(l => [l.id, l.h, !!l.src || l.kind === 'illus']));
  assert.deepEqual(L.find(x => x[0] === 'petronas'), ['petronas', 451.9, true]);
  assert.deepEqual(L.find(x => x[0] === 'burj'), ['burj', 828, true]);
  assert.deepEqual(L.find(x => x[0] === 'eiffel'), ['eiffel', 330, true]);
  assert.ok(L.every(x => x[2]), 'every real landmark has a source');
  const rows = await page.locator('.mnrow').allTextContents();
  const pet = rows.find(r => r.includes('Petronas'));
  assert.match(pet, /7 % of its height/, '32.266 / 451.9 = 7.1 %');
  assert.match(rows.find(r => r.includes('two-storey')), /5\.4 × the height of a two-storey house/, '32.266 / 6');
  await popups(page);
  await page.click('[data-a="mnlm"][data-id="burj"]');
  assert.match(await page.getAttribute('#mnscale svg', 'aria-label'), /Burj Khalifa 828 m/);
  assert.match(await page.textContent('.mnladw'), /logarithmic scale/);
  assert.deepEqual(errors, []);
});

test('an empty history: the island waits for the first stone, a way to log a climb, nothing saved', async () => {
  const { page, errors } = await openApp({ seed: { ...RETURNING, e: [] } });
  await go(page, 'stats');
  assert.match(await page.textContent('#mn-door'), /No climbs logged yet/);
  await page.click('[data-a="mngo"]');
  await page.waitForSelector('#mnstage canvas');
  assert.match(await page.textContent('#main'), /0 m[\s\S]*LOG A CLIMB IN THE OBSERVATORY/);
  assert.equal((await state(page)).s.mon, undefined);
  assert.deepEqual(errors, []);
});

test('phone (360 px): no sideways scroll, the canvas fits and is scaled by a whole number', async () => {
  const { page, errors } = await openApp({ seed: SEED, viewport: { width: 360, height: 780 } });
  await enter(page);
  const r = await page.evaluate(() => { const c = document.querySelector('#mnstage canvas'), b = c.getBoundingClientRect();
    return { over: document.documentElement.scrollWidth - innerWidth, fit: b.right <= innerWidth && b.left >= 0, scale: b.width / c.width }; });
  assert.equal(r.over, 0); assert.ok(r.fit); assert.equal(r.scale, 2);
  assert.deepEqual(errors, []);
});
