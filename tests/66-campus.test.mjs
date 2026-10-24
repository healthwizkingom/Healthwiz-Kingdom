// Campus Health Observatory (js/v6-campus.js), opened from the file (as most tests do): the map cannot load here, so the
// page says why and the list and details carry everything, with no request for the map's files. Points come from the
// records (js/v6-campus-data.js: STAIRS + F21 + survey), all labelled estimated unless measured; shared coordinates are
// one point; staircases without coordinates are listed and selectable. Details in three groups; START STAIR SESSION
// chooses the staircase on the Stairs page; opening asks for no location (owner decision 2026-10-20), SHOW WHERE I AM
// does (granted, denied, far away) and nothing is saved; the weather point's distance is stated; no campus-wide overlay;
// the state is kept for the tab; the phone layout. The map itself is tested over http in tests/71-observatory-map.
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
const geoCount = page => page.addInitScript(() => { window.__geo = 0; const g = navigator.geolocation, o = g.getCurrentPosition.bind(g), w = g.watchPosition.bind(g);
  g.getCurrentPosition = (...a) => { window.__geo++; return o(...a); }; g.watchPosition = (...a) => { window.__geo++; return w(...a); }; });

test('the door is last in the Health Hall; from the file the page says the map needs the web address, requests nothing, and lists every staircase', async () => {
  const reqs = [];
  const { page, errors } = await open({ before: p => p.on('request', r => reqs.push(r.url())) });
  assert.equal(await page.evaluate(() => [S.v, PAR[S.v]].join()), 'campus,health');
  assert.equal(await page.evaluate(() => HWCampus.why()), 'file');
  assert.match(await page.textContent('#cmpnomap'), /The campus map needs the app to be opened from its web address \(https\)\.[\s\S]*the staircases are listed below with their details\./);
  assert.equal(await page.locator('#cmpmapslot, .cmpmap, .maplibregl-canvas').count(), 0, 'no map element');
  assert.deepEqual(reqs.filter(u => /observatory\/|vendor\/|\.geojson|stair-survey/.test(u)), [], 'no request for the map, its library or its data');
  const facts = await page.evaluate(() => ({ withXY: STAIRS.filter(hasXY).length, groups: HWCampus.points().length, unmapped: HWCampus.unmapped().map(s => s.id),
    shared: HWCampus.points().filter(g => g.items.length > 1).map(g => g.items.map(s => s.id).sort().join('+')).sort(), items: document.querySelectorAll('#cmplist .cmpitem').length,
    filters: [...document.querySelectorAll('.cmpf')].map(b => b.textContent.replace(/\s+/g, ' ').trim()) }));
  assert.equal(facts.withXY, 34);
  assert.equal(facts.groups, 31, '34 placed staircases on 31 points');
  assert.deepEqual(facts.unmapped.sort(), ['ST02', 'ST08', 'ST16', 'ST29']);
  assert.deepEqual(facts.shared, ['ST06+ST31+ST32', 'ST09+ST15'], 'staircases sharing one coordinate are one point');
  assert.equal(facts.items, 38);
  assert.deepEqual(facts.filters, ['All 38', 'On the map 34', 'No location 4', 'Step size measured 3', 'Needs checking 7']);
  const t = await page.textContent('#cmpcard');
  assert.match(t, /Locations are not verified\.[\s\S]*no recorded source/);
  assert.match(t, /Campus-wide activity[\s\S]*Not available\. HealthWiz does not collect anyone else's location/);
  assert.match(t, /4 staircases have no coordinates in the app data, so they are not on the map\. You can still pick them here\./);
  assert.match(t, /Survey data: not loaded/);
  // the door sits after the Science Laboratory's
  await go(page, 'health');
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#lab-door, #cmp-door')].map(e => e.id)), ['lab-door', 'cmp-door']);
  assert.deepEqual(errors, []);
});

test('details in three groups with the player\'s own climbs and honest labels; picking it opens its logging forms and writes nothing', async () => {
  const { page, errors } = await open();
  const id = 'ST20';
  await page.evaluate(id => { add('stair', 100, { sid: id, steps: 20, climbs: 5 }, '', today(), '08:00', 0, ''); st.gp = { ok: 1, v: { [id]: '2026-10-01' } }; save(); render(); }, id);
  await page.click('#cmplist .cmpitem[data-id="' + id + '"]');
  assert.equal(await page.locator('#cmppane > #cmpdet').count(), 1, 'its Details, right below the map');
  assert.deepEqual(await page.$$eval('#cmpdet .cmpgrp h3', a => a.map(x => x.textContent.trim())), ['Location', 'Staircase profile', 'Data quality']);
  const d = await page.textContent('#cmpdet');
  assert.match(d, /You saved 1 stair session here \(last \d{4}-\d\d-\d\d\) · first GPS check-in 2026-10-01/);
  assert.match(d, /5\.3519878, 100\.5383771Real location · HealthWiz stair list/);
  assert.match(d, /rise 0\.169 m · run 0\.311 m · hypotenuse 0\.354 m[\s\S]*Measured · Group 14 F21 Full Written Report \(v4\), Table 2, Staircase A/);
  assert.match(d, /Real location[\s\S]*Angle from measured steps[\s\S]*Orientation not surveyed[\s\S]*Partially measured: step size only/);
  assert.match(d, /Floor label"G level"App data; its meaning on site is not documented\./);
  assert.doesNotMatch(d, /Nearest OSM place|Map terrain/, 'computed map facts appear only with the map data');
  assert.equal(await page.locator('#cmpdet [data-a="cmpshow"]').count(), 0, 'no SHOW ON MAP without a map');
  assert.match(d, /3D preview: it needs what the map needs \(the web address and WebGL\), so it is not shown here\./);
  assert.equal(await page.locator('#cmpvw').count(), 0);
  // a shared coordinate links to the other records
  await page.click('[data-a="cmptab"][data-t="list"]'); await page.click('#cmplist .cmpitem[data-id="ST31"]');
  assert.match(await page.textContent('#cmpdet'), /Same point asST06, ST32[\s\S]*Needs checking/);
  await page.click('#cmpdet .cmplnk[data-id="ST06"]');
  assert.equal(await page.evaluate(() => HWCampus.selected), 'ST06');
  // picking it opens LOG A CLIMB HERE for it (logging lives in the Observatory since 2026-10-20)
  await page.click('[data-a="cmptab"][data-t="list"]'); await page.click('#cmplist .cmpitem[data-id="' + id + '"]');
  const before = (await state(page)).e.length;
  assert.equal(await page.locator('#cmpdet [data-a="cmpstair"]').count(), 0, 'no START STAIR SESSION: the forms are right here');
  assert.match(await page.textContent('#cmpdet #cmplog h3'), /LOG A CLIMB HERE/);
  assert.equal(await page.evaluate(() => [S.v, HWStairs.pick].join()), 'campus,' + id);
  assert.match(await page.textContent('#cmplog .stloc'), /penjana elektrik/);
  assert.equal((await state(page)).e.length, before, 'nothing is written');
  assert.deepEqual(errors, []);
});

test('search filters in place (focus kept), filters narrow the list, an unmapped staircase is selectable', async () => {
  const { page, errors } = await open();
  await page.focus('#cmpq'); await page.keyboard.type('kenanga');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'cmpq', 'typing keeps the focus');
  assert.deepEqual(await page.$$eval('#cmplist .cmpitem', a => a.map(b => b.dataset.id)), ['ST14', 'ST19', 'ST20']);
  assert.match(await page.textContent('#cmpcount'), /Showing 3 of 38/);
  await page.keyboard.type(' zzz');
  assert.match(await page.textContent('#cmplist'), /No staircase matches/);
  await page.fill('#cmpq', '');
  await page.click('[data-a="cmpfilt"][data-f="nol"]');
  assert.deepEqual(await page.$$eval('#cmplist .cmpitem', a => a.map(b => b.dataset.id)), ['ST02', 'ST08', 'ST16', 'ST29']);
  await page.click('#cmplist .cmpitem[data-id="ST08"]');
  const d = await page.textContent('#cmpdet');
  assert.match(d, /No location recorded, so it is not placed on the map\.[\s\S]*No location recorded[\s\S]*Needs checking/);
  assert.match(d, /Same name as ST21 in the app data: may be the same staircase\./);
  await page.click('[data-a="cmptab"][data-t="list"]'); await page.click('[data-a="cmpfilt"][data-f="all"]');
  assert.equal(await page.locator('#cmplist .cmpitem').count(), 38);
  assert.deepEqual(errors, []);
});

test('opening asks for no location; SHOW WHERE I AM: on campus the nearest staircase, far away a distance, denied a fallback; never saved or kept', async () => {
  const near = await openApp({ seed: RETURNING, before: geoCount, context: { geolocation: { latitude: 5.3512, longitude: 100.5382, accuracy: 12 }, permissions: ['geolocation'] } });
  await go(near.page, 'health'); await near.page.click('[data-a="cmpgo"]');
  await near.page.waitForSelector('#cmpcard'); await near.page.waitForTimeout(400);
  assert.equal(await near.page.evaluate(() => window.__geo), 0, 'opening the Observatory asks for no position');
  assert.equal(await near.page.locator('.cmpyou, .cmpe').count(), 0);
  await near.page.click('[data-a="cmpgps"]');
  await near.page.waitForSelector('.cmpyou');
  assert.equal(await near.page.evaluate(() => window.__geo), 1);
  assert.match(await near.page.textContent('.cmpyou'), /The nearest mapped staircase is .+, about \d+ m away \(± 12 m\)\. Your position is used on this screen only: it is not saved or sent\./);
  const r = await near.page.evaluate(() => { const me = HWCampus.state.me, P = HWCampus.points(); return { sid: HWCampus.selected, nearest: P.map(g => ({ id: g.items[0].id, d: HWGps.dist(me.lat, me.lng, g.lat, g.lng) })).sort((a, b) => a.d - b.d)[0].id }; });
  assert.equal(r.sid, r.nearest, 'the nearest staircase is selected');
  assert.ok(await near.page.locator('#cmpdet .cmph').count());
  assert.doesNotMatch(JSON.stringify(await state(near.page)), /5\.3512|100\.5382/, 'the position is not saved');
  assert.doesNotMatch(await near.page.evaluate(() => JSON.stringify(sessionStorage)), /5\.3512|100\.5382/, 'nor kept for the tab');
  await near.page.click('[data-a="cmpforget"]');
  assert.equal(await near.page.locator('.cmpyou').count(), 0);
  // far away (Kuala Lumpur)
  const far = await openApp({ seed: RETURNING, context: { geolocation: { latitude: 3.139, longitude: 101.6869, accuracy: 20 }, permissions: ['geolocation'] } });
  await go(far.page, 'health'); await far.page.click('[data-a="cmpgo"]');
  await far.page.click('[data-a="cmpgps"]');
  await far.page.waitForSelector('.cmpyou');
  assert.match(await far.page.textContent('.cmpyou'), /You are about \d+\.\d km from the campus staircases, so you are not shown on the map\./);
  // denied
  const no = await openApp({ seed: RETURNING });
  await go(no.page, 'health'); await no.page.click('[data-a="cmpgo"]');
  await no.page.click('[data-a="cmpgps"]');
  await no.page.waitForSelector('.cmpe');
  assert.match(await no.page.textContent('.cmpe'), /Location permission is off for HealthWiz\. Pick a staircase on the map or in the list instead\./);
  // leaving the page forgets the position
  await go(near.page, 'home'); await go(near.page, 'campus');
  assert.equal(await near.page.evaluate(() => HWCampus.state.me), null);
  for (const x of [near, far, no]) assert.deepEqual(x.errors, []);
});

test('weather: off says so; a live reading states it is for a separate, unverified point about 2.9 km away', async () => {
  const { page, errors } = await open();
  await page.evaluate(() => { st.s.live = 0; save(); HWLive.refresh(); render(); });
  assert.match(await page.textContent('#cmpcard'), /Live weather is off/);
  const km = await page.evaluate(() => { const P = HWCampus.points(), c = { lat: P.reduce((a, g) => a + g.lat, 0) / P.length, lng: P.reduce((a, g) => a + g.lng, 0) / P.length }, k = HWLive.KMK; return HWGps.dist(c.lat, c.lng, k.lat, k.lon) / 1000; });
  assert.ok(km > 2.5 && km < 3.3, 'the weather point is about 2.9 km from the staircases: ' + km.toFixed(2));
  assert.deepEqual(errors, []);
});

test('the selection, tab, filter and search are kept for the tab: leaving and a refresh restore them', async () => {
  const { page, errors } = await open();
  await page.click('[data-a="cmpfilt"][data-f="part"]');
  await page.click('#cmplist .cmpitem[data-id="ST19"]');
  await go(page, 'home'); await go(page, 'campus');
  assert.deepEqual(await page.evaluate(() => { const s = HWCampus.state; return [s.sid, s.tab, s.f]; }), ['ST19', 'det', 'part']);
  assert.match(await page.textContent('#cmpdet'), /Blok Aisyah/);
  // a person refreshes seconds later; Chromium writes sessionStorage to the tab's store shortly after a change
  await page.waitForTimeout(3000);
  await page.reload(); await page.waitForSelector('.wl');
  assert.notEqual(await page.evaluate(() => S.v), 'campus', 'a refresh opens the title screen, as before');
  await go(page, 'campus');
  assert.deepEqual(await page.evaluate(() => { const s = HWCampus.state; return [s.sid, s.tab, s.f]; }), ['ST19', 'det', 'part']);
  assert.doesNotMatch(await page.evaluate(() => sessionStorage.getItem('hw_obs_view')), /"me"|lat"|healthwiz/, 'no position or health data');
  assert.deepEqual(errors, []);
});

test('phone: fits 360 px, list buttons and controls are full-size tap targets', async () => {
  const { page, errors } = await open({ viewport: { width: 360, height: 760 }, context: { reducedMotion: 'reduce', isMobile: true, hasTouch: true } });
  const r = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, card: document.querySelector('#cmpcard').getBoundingClientRect().right,
    items: [...document.querySelectorAll('.cmpitem, .cmpf, .cmpback')].map(b => b.getBoundingClientRect().height) }));
  assert.ok(r.doc <= 360, 'no sideways scroll: ' + r.doc);
  assert.ok(r.card <= 360);
  assert.ok(r.items.every(h => h >= 44), 'tap targets ≥ 44 px: ' + Math.min(...r.items));
  await page.click('#cmplist .cmpitem[data-id="ST14"]');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= 360, 'details fit too');
  assert.deepEqual(errors, []);
});

test('the Stage 4 modules add actions and classes without replacing any existing ones (the original Registry\'s obgo stays its own)', async () => {
  const fs = await import('node:fs');
  const dir = new URL('../js/', import.meta.url), files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  const NEW = ['v6-plan.js', 'v6-time.js', 'v6-campus.js', 'v6-campus-data.js', 'v6-campus-stairs.js'];
  const defs = f => [...fs.readFileSync(new URL(f, dir), 'utf8').matchAll(/acts\.([A-Za-z0-9_]+)\s*=/g)].map(m => m[1]);
  const old = new Set(files.filter(f => !NEW.includes(f)).flatMap(defs));
  for (const f of NEW) for (const a of defs(f)) assert.ok(!old.has(a), f + ' replaces the existing action ' + a);
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const p of ['cmp', 'tm', 'pl']) {
    const used = [...html.matchAll(new RegExp('\\.(' + p + '[a-z0-9-]*)[{,: .]', 'g'))].map(m => m[1]);
    assert.deepEqual(used, [], 'the original styles use no ' + p + '* classes');
  }
  assert.equal(fs.existsSync(new URL('v6-observatory.js', dir)), false, 'the old 2D Observatory is gone (owner decision 1)');
});
