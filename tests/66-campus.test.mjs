// Campus Health Observatory (js/v6-observatory.js): the stairways on a map from the app's own coordinates, all marked
// unverified; shared coordinates are one marker; unmapped stairways are listed, not placed; a marker opens the stairway
// with the player's own climbs; it locates you on opening and centres on the nearest stairway; the map can be dragged;
// SHOW WHERE I AM (granted, denied, far away) is never saved; the weather point's distance
// is stated; no campus-wide overlay; nothing is written; the phone layout.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';

after(closeBrowser);
const open = async (o = {}) => {
  const r = await openApp({ seed: RETURNING, ...o });
  await go(r.page, 'health');
  await r.page.click('[data-a="cmpgo"]');
  await r.page.waitForSelector('#cmpcard');
  return r;
};

test('the door is last in the Health Hall; every point comes from STAIRS, shared coordinates are one marker, all unverified', async () => {
  const { page, errors } = await open();
  assert.equal(await page.evaluate(() => [S.v, PAR[S.v]].join()), 'campus,health');
  const facts = await page.evaluate(() => ({ withXY: STAIRS.filter(hasXY).length, groups: HWCampus.points().length, unmapped: HWCampus.unmapped().map(s => s.id),
    shared: HWCampus.points().filter(g => g.L.length > 1).map(g => g.L.map(s => s.id).sort().join('+')).sort(), markers: document.querySelectorAll('.cmpm').length }));
  assert.equal(facts.markers, facts.groups);
  assert.deepEqual(facts.unmapped.sort(), ['ST02', 'ST08', 'ST16', 'ST29']);
  assert.deepEqual(facts.shared, ['ST06+ST31+ST32', 'ST09+ST15'], 'stairways sharing one coordinate are one marker');
  assert.equal(facts.withXY, 28);
  const t = await page.textContent('#cmpcard');
  assert.match(t, /Locations are not verified\.[\s\S]*no recorded source/);
  assert.match(t, /Unverified: from the original app data/);
  assert.match(t, /Campus-wide activity[\s\S]*Not available\. HealthWiz does not collect anyone else's location/);
  assert.match(t, /4 stairways have no coordinates in the app data, so they are not on the map\./);
  // the door sits after the Science Laboratory's
  await go(page, 'health');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#lab-door, #cmp-door')].map(e => e.id)), ['lab-door', 'cmp-door']);
  assert.deepEqual(errors, []);
});

test('a marker (or the list) opens the stairway with the player\'s own climbs; CLIMB HERE picks it on the Stairs page', async () => {
  const { page, errors } = await open();
  const id = 'ST20';
  await page.evaluate(id => { add('stair', 100, { sid: id, steps: 20, climbs: 5 }, '', today(), '08:00', 0, ''); st.gp = { ok: 1, v: { [id]: '2026-10-01' } }; save(); render(); }, id);
  const i = await page.evaluate(id => HWCampus.points().findIndex(g => g.L.some(s => s.id === id)), id);
  assert.match(await page.getAttribute('.cmpm[data-i="' + i + '"]', 'aria-label'), /you have climbed here/);
  await page.click('.cmpm[data-i="' + i + '"]');
  const d = await page.textContent('#cmpdet');
  assert.match(d, /You saved 1 stair session here · first GPS check-in 2026-10-01/);
  assert.match(d, /Unverified: from the original app data/);
  // the list reaches the same place, and lists the unmapped ones without a button
  await page.click('.cmplist summary');
  assert.ok(await page.locator('.cmplist .cmplb').count() >= 28);
  assert.match(await page.textContent('.cmplist'), /no coordinates recorded/);
  const before = (await state(page)).e.length;
  await page.click('#cmpdet [data-a="cmpstair"][data-id="' + id + '"]');
  assert.equal(await page.evaluate(() => [S.v, STAIRS[S.loc].id].join()), 'stair,' + id);
  assert.equal((await state(page)).e.length, before, 'nothing is written');
  assert.deepEqual(errors, []);
});

test('SHOW WHERE I AM: on campus a "you" dot and the nearest stairway; far away a distance; denied falls back to picking; never saved', async () => {
  // near ST20 (the Group 14 study stairway)
  const near = await openApp({ seed: RETURNING, context: { geolocation: { latitude: 5.3512, longitude: 100.5382, accuracy: 12 }, permissions: ['geolocation'] } });
  await go(near.page, 'health'); await near.page.click('[data-a="cmpgo"]');
  await near.page.click('[data-a="cmpgps"]');
  await near.page.waitForSelector('.cmpme');
  assert.match(await near.page.textContent('.cmpyou'), /The nearest mapped stairway is .+, about \d+ m away \(± 12 m\)\. Your position is used on this screen only: it is not saved or sent\./);
  assert.doesNotMatch(JSON.stringify(await state(near.page)), /5\.3512|100\.5382/, 'the position is not saved');
  await near.page.click('[data-a="cmpforget"]');
  assert.equal(await near.page.locator('.cmpme').count(), 0);
  // far away (Kuala Lumpur)
  const far = await openApp({ seed: RETURNING, context: { geolocation: { latitude: 3.139, longitude: 101.6869, accuracy: 20 }, permissions: ['geolocation'] } });
  await go(far.page, 'health'); await far.page.click('[data-a="cmpgo"]');
  await far.page.click('[data-a="cmpgps"]');
  await far.page.waitForSelector('.cmpyou');
  assert.match(await far.page.textContent('.cmpyou'), /You are about \d+\.\d km from the campus stairways, so you are not shown on the map\./);
  assert.equal(await far.page.locator('.cmpme').count(), 0);
  // denied
  const no = await openApp({ seed: RETURNING });
  await go(no.page, 'health'); await no.page.click('[data-a="cmpgo"]');
  await no.page.click('[data-a="cmpgps"]');
  await no.page.waitForSelector('.cmpe');
  assert.match(await no.page.textContent('.cmpe'), /Location permission is off for HealthWiz\. Pick a stairway on the map or in the list instead\./);
  for (const r of [near, far, no]) assert.deepEqual(r.errors, []);
});

test('opening it finds you by itself: on campus the nearest stairway is selected and the map centres on it, zoomed in; location off is a quiet note', async () => {
  const near = await openApp({ seed: RETURNING, context: { geolocation: { latitude: 5.3512, longitude: 100.5382, accuracy: 12 }, permissions: ['geolocation'] } });
  await go(near.page, 'health'); await near.page.click('[data-a="cmpgo"]');
  await near.page.waitForSelector('.cmpme');
  const r = await near.page.evaluate(() => {
    const st = HWCampus.state, P = HWCampus.points(), me = st.me;
    const nearest = P.map((g, i) => ({ i, d: HWGps.dist(me.lat, me.lng, g.lat, g.lng) })).sort((a, b) => a.d - b.d)[0].i;
    const m = document.querySelector('.cmpm[data-i="' + st.sel + '"]').getBoundingClientRect(), map = document.querySelector('.cmpmap').getBoundingClientRect();
    return { sel: st.sel, nearest, z: st.z, dx: (m.x + m.width / 2 - map.x) / map.width, dy: (m.y + m.height / 2 - map.y) / map.height, det: !!document.querySelector('#cmpdet') };
  });
  assert.equal(r.sel, r.nearest, 'the nearest stairway is selected');
  assert.equal(r.z, 2);
  assert.ok(Math.abs(r.dx - 0.5) < 0.03 && Math.abs(r.dy - 0.5) < 0.03, 'centred on it: ' + r.dx.toFixed(3) + ', ' + r.dy.toFixed(3));
  assert.ok(r.det, 'its details are open');
  assert.match(await near.page.textContent('.cmpyou'), /Your position is used on this screen only: it is not saved or sent\./);
  assert.doesNotMatch(JSON.stringify(await state(near.page)), /5\.3512|100\.5382/);
  // no permission: a quiet note, not an alert
  const off = await openApp({ seed: RETURNING });
  await go(off.page, 'health'); await off.page.click('[data-a="cmpgo"]');
  await off.page.waitForSelector('.cmpnote');
  assert.match(await off.page.textContent('.cmpnote'), /I could not find you automatically \(location permission is off for healthwiz\)\. Pick a stairway, or tap SHOW WHERE I AM\./);
  assert.equal(await off.page.locator('.cmpe').count(), 0);
  for (const x of [near, off]) assert.deepEqual(x.errors, []);
});

test('the map moves: dragging pans every marker together, a drag does not select a marker, RECENTRE puts it back', async () => {
  const { page, errors } = await open({ viewport: { width: 800, height: 900 } });
  const pos = () => page.evaluate(() => [...document.querySelectorAll('.cmpm')].slice(0, 3).map(e => { const b = e.getBoundingClientRect(); return [b.x, b.y]; }));
  const before = await pos(), map = await page.$eval('.cmpmap', m => { const b = m.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  const m0 = await page.$eval('.cmpm', e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  // start the drag on a marker: it must not count as a tap
  await page.mouse.move(m0.x, m0.y); await page.mouse.down(); await page.mouse.move(m0.x - 60, m0.y + 40, { steps: 6 }); await page.mouse.up();
  const after = await pos();
  for (let i = 0; i < before.length; i++) { assert.ok(Math.abs(after[i][0] - before[i][0] + 60) < 2 && Math.abs(after[i][1] - before[i][1] - 40) < 2, 'marker ' + i + ' moved with the map'); }
  assert.equal(await page.evaluate(() => HWCampus.state.sel), null, 'a drag is not a tap');
  assert.ok(map.w > 0);
  await page.click('[data-a="cmpcentre"]');
  assert.deepEqual(await page.evaluate(() => [HWCampus.state.px, HWCampus.state.py]), [0, 0]);
  assert.deepEqual(await pos(), before);
  // a tap still selects
  await page.click('.cmpm >> nth=0');
  assert.notEqual(await page.evaluate(() => HWCampus.state.sel), null);
  assert.deepEqual(errors, []);
});

test('weather: off says so; a live reading states it is for a separate, unverified point about 2.9 km away', async () => {
  const { page, errors } = await open();
  await page.evaluate(() => { st.s.live = 0; save(); HWLive.refresh(); render(); });
  assert.match(await page.textContent('#cmpcard'), /Live weather is off/);
  const km = await page.evaluate(() => { const c = HWCampus.proj(HWCampus.points()).c, k = HWLive.KMK; return HWGps.dist(c.lat, c.lng, k.lat, k.lon) / 1000; });
  assert.ok(km > 2.5 && km < 3.3, 'the weather point is about 2.9 km from the stairways: ' + km.toFixed(2));
  assert.deepEqual(errors, []);
});

test('phone: the map fits 360 px, markers are at least 24 px, no glow under reduced motion', async () => {
  const { page, errors } = await open({ viewport: { width: 360, height: 760 }, context: { reducedMotion: 'reduce', isMobile: true, hasTouch: true } });
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, map: document.querySelector('.cmpmap').getBoundingClientRect().right,
    m: [...document.querySelectorAll('.cmpm')].map(b => b.getBoundingClientRect()).map(b => Math.min(b.width, b.height)), anim: getComputedStyle(document.querySelector('.cmpm')).animationName }));
  assert.ok(r.doc <= 360, 'no sideways scroll: ' + r.doc);
  assert.ok(r.map <= 360);
  assert.ok(r.m.every(x => x >= 24), 'markers ≥ 24 px');
  assert.equal(r.anim, 'none');
  // ZOOM IN spreads the crowded centre twice as far apart (and the scale bar follows)
  const gap = () => page.evaluate(() => { const b = [...document.querySelectorAll('.cmpm')].slice(0, 2).map(e => e.getBoundingClientRect()); return Math.hypot(b[0].x - b[1].x, b[0].y - b[1].y); });
  const ids = () => page.evaluate(() => [...document.querySelectorAll('.cmpm')].slice(0, 2).map(e => e.dataset.i).join());
  const g1 = await gap(), i1 = await ids();
  await page.click('[data-a="cmpzoom"]');
  assert.equal(await page.getAttribute('[data-a="cmpzoom"]', 'aria-pressed'), 'true');
  if (await ids() === i1) assert.ok(Math.abs(await gap() - 2 * g1) < 3, 'twice as far apart');
  await page.click('[data-a="cmpzoom"]');
  assert.equal(await page.getAttribute('[data-a="cmpzoom"]', 'aria-pressed'), 'false');
  assert.deepEqual(errors, []);
});

test('the Stage 4 modules add actions and classes without replacing any existing ones (the original Registry\'s obgo stays its own)', async () => {
  const fs = await import('node:fs');
  const dir = new URL('../js/', import.meta.url), files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  const NEW = ['v6-plan.js', 'v6-time.js', 'v6-observatory.js'];
  const defs = f => [...fs.readFileSync(new URL(f, dir), 'utf8').matchAll(/acts\.([A-Za-z0-9_]+)\s*=/g)].map(m => m[1]);
  const old = new Set(files.filter(f => !NEW.includes(f)).flatMap(defs));
  for (const f of NEW) for (const a of defs(f)) assert.ok(!old.has(a), f + ' replaces the existing action ' + a);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const p of ['cmp', 'tm', 'pl']) {
    const used = [...html.matchAll(new RegExp('\\.(' + p + '[a-z0-9-]*)[{,: .]', 'g'))].map(m => m[1]);
    assert.deepEqual(used, [], 'the original styles use no ' + p + '* classes');
  }
});
