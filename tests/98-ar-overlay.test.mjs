// The 3D Stair Sight overlay (js/v6-arcana.js xrUI + js/v6-arcana-css.js). While a WebXR session runs, the browser makes the DOM-overlay root
// fill the whole screen. It used to be a bottom bar with an 82 %-opaque dark background, so when it filled the screen it covered the camera:
// the phone showed black with only the text at the top (a 2 px cyan line at the very top was its border). Now the root is see-through and lets
// touches pass, and only the bar inside it at the foot is solid.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, RETURNING } from './helpers.mjs';

after(closeBrowser);
const SEED = { ...RETURNING, p: { ...RETURNING.p, w: 60 } };
const xrPhone = p => p.addInitScript(() => { Object.defineProperty(navigator, 'xr', { configurable: true, value: { isSessionSupported: async m => m === 'immersive-ar', requestSession: async () => { throw Object.assign(new Error('no'), { name: 'NotSupportedError' }); } } }); });

test('full-screen overlay root: see-through, lets touches pass, and the control bar sits solid at the foot with both buttons reachable', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED, before: xrPhone, viewport: { width: 390, height: 844 } }); await page.waitForSelector('.wl');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'arc-test'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.getElementById('main').appendChild(d); });
  await page.waitForFunction(() => { const b = document.getElementById('start-xr-btn'); return b && !b.hidden; });
  await page.click('#start-xr-btn'); await page.waitForFunction(() => /3D Scrying could not start/.test(document.body.textContent));   // this creates #arc-xr-ui
  // what the browser does to the DOM-overlay root during the session: a full-screen element (the UA style is !important)
  await page.addStyleTag({ content: '#arc-xr-ui{position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;margin:0!important}' });
  await page.evaluate(() => { document.getElementById('arc-xr-ui').hidden = false; document.body.style.background = '#ff00ff'; });
  const r = await page.evaluate(() => { const u = document.getElementById('arc-xr-ui'), cs = getComputedStyle(u), bar = u.querySelector('.arc-xr-bar'), bb = bar.getBoundingClientRect(), ub = u.getBoundingClientRect();
    const btn = [...u.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(), hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); return { t: b.textContent.trim(), act: b.dataset.a, reach: hit === b }; });
    const mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2), top = document.elementFromPoint(innerWidth / 2, 5);
    return { bg: cs.backgroundColor, border: cs.borderTopWidth, pe: cs.pointerEvents, barPe: getComputedStyle(bar).pointerEvents, barBg: getComputedStyle(bar).backgroundColor, fills: [ub.width, ub.height, innerWidth, innerHeight],
      barBottom: Math.round(bb.bottom), vh: innerHeight, barShare: bb.height / innerHeight, btn, midInOverlay: u.contains(mid), topInOverlay: u.contains(top), ids: ['arc-xr-st', 'arc-xr-m'].map(i => !!document.getElementById(i)) }; });
  assert.deepEqual(r.fills, [390, 844, 390, 844], 'the root fills the screen, as it does in a session');
  assert.equal(r.bg, 'rgba(0, 0, 0, 0)', 'no tint over the camera view'); assert.equal(r.border, '0px', 'no cyan line across the top of the screen');
  assert.equal(r.pe, 'none', 'touches outside the bar pass through'); assert.equal(r.barPe, 'auto');
  assert.equal(r.midInOverlay, false, 'the middle of the screen is not covered'); assert.equal(r.topInOverlay, false, 'nor the top');
  assert.ok(r.barBottom >= r.vh - 1 && r.barShare < .35, 'a bar at the foot, under a third of the screen: ' + r.barShare.toFixed(2));
  assert.match(r.barBg, /^rgba\(8, 6, 30, 0\.82\)$/, 'the bar itself keeps its readable dark background');
  assert.deepEqual(r.btn.map(b => [b.t, b.act, b.reach]), [['RESCAN', 'arcxrscan', true], ['HALT', 'arcxrend', true]]);
  assert.deepEqual(r.ids, [true, true], 'the status lines are still where the scanner writes them');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the overlay stays hidden outside a session, and its status text still lands in the bar', async () => {
  const { page, ctx, errors } = await openApp({ seed: SEED, before: xrPhone }); await page.waitForSelector('.wl');
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'arc-test'; d.innerHTML = HWStairs.logPanel('ST20', 'workout'); document.getElementById('main').appendChild(d); });
  await page.waitForFunction(() => { const b = document.getElementById('start-xr-btn'); return b && !b.hidden; });
  await page.click('#start-xr-btn'); await page.waitForFunction(() => /3D Scrying could not start/.test(document.body.textContent));
  assert.equal(await page.evaluate(() => { const u = document.getElementById('arc-xr-ui'); return [u.hidden, getComputedStyle(u).display]; }).then(x => x.join()), 'true,none');
  await page.evaluate(() => { document.getElementById('arc-xr-st').textContent = 'Searching for the stairs'; });
  assert.equal(await page.evaluate(() => document.querySelector('#arc-xr-ui .arc-xr-bar #arc-xr-st').textContent), 'Searching for the stairs');
  assert.deepEqual(errors, []); await ctx.close();
});
