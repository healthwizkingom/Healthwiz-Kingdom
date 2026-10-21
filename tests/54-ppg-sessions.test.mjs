// Split from 54-ppg.test.mjs so each file stays inside the 90 s per-file limit (software WebGL is slow). 
// Pulse Wave Lab (js/v6-ppg.js + the Heartstone Hall card on the Stairs page): the camera pulse estimate.
// Pure signal processing is fed synthetic signals; the UI runs against a fake camera (canvas.captureStream whose red level
// pulses at 1.2 Hz), so no real camera is needed in CI.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, go, state, closeBrowser, fillSteps, pickStair, stairHistory } from './helpers.mjs';

after(closeBrowser);
const EMOJI = /\p{Extended_Pictographic}/u;

// a fake back camera: a canvas whose red level pulses at `hz`; every stream handed out is kept in window.__streams
const fakeCam = (hz = 1.2) => p => p.addInitScript(h => {
  window.__streams = []; window.__asked = 0;
  const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d');
  const t0 = performance.now();
  const paint = () => { const t = (performance.now() - t0) / 1000; x.fillStyle = `rgb(${Math.round(190 + 2 * t % 20 + 10 * Math.sin(2 * Math.PI * h * t))},40,30)`; x.fillRect(0, 0, 64, 48); };
  paint(); setInterval(paint, 33);
  const stream = () => { const s = c.captureStream(30); window.__streams.push(s); return s; };
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
    getUserMedia: async () => { window.__asked++; if (window.__gum === 'deny') throw new DOMException('no', 'NotAllowedError'); return stream(); } } });
}, hz);
const ended = page => page.evaluate(() => window.__streams.length > 0 && window.__streams.every(s => s.getTracks().every(t => t.readyState === 'ended')));

/* ---------- pure signal processing ---------- */
const synth = (page, o) => page.evaluate(o => {
  let s = o.seed || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, g = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const S = [], N = Math.round((o.secs || 20) * 30);
  for (let i = 0; i < N; i++) {
    const t = i / 30 + (rnd() - .5) * .008; // 30 fps with jittered timestamps
    let v = 180 + 2 * Math.sin(2 * Math.PI * .05 * t) + .3 * t + (o.sine === false ? 0 : (o.amp || 3) * Math.sin(2 * Math.PI * o.f * t)) + g() * (o.noise == null ? .8 : o.noise);
    if (o.spikes) for (const c of o.spikes) v += 25 * Math.exp(-(((t - c - .3) / .25) ** 2)); // a slipping finger or a moving hand: big, slow swings
    if (o.gaps && o.gaps.some(c => t >= c && t < c + 1.2)) continue; // frames that never arrived
    S.push({ t: t * 1000, v });
  }
  const r = HWPPG.analyze(S);
  return { ok: r.ok, bpm: r.bpm, quality: r.quality, why: r.why, beats: r.beats, ratio: r.ratio, rr: r.rr.length };
}, o);

/* ---------- the page ---------- */
test('camera numbers mixed with typed or watch numbers seal as mixed; old entries without hrCam read as before', async () => {
  const { page, ctx, errors } = await openApp({ before: fakeCam(1.2) });
  await go(page, 'pulse');
  // no camera needed: a draft that carries the camera flag for BEFORE (as USE AS BEFORE leaves it) is what saving reads
  await page.fill('#wk-b', '70'); await page.fill('#wk-a', '120');
  await page.evaluate(() => { const d = HWStairs.draft; sessionStorage.setItem('hw_wk_draft', JSON.stringify(Object.assign({}, d, { hrBc: { n: 14, s: 20 } }))); });
  await page.reload();
  await go(page, 'pulse');
  assert.match(await page.innerHTML('#st-hs-b'), /pxi-camera/, 'the draft keeps the camera flag through a refresh');
  await fillSteps(page, '#wk-s', '10'); await page.fill('#wk-c', '2');
  await pickStair(page);
  await page.click('[data-a="stwsave"]');
  const e = (await state(page)).e.filter(x => x.c === 'stair').pop();
  assert.deepEqual([e.m.hrS, e.m.hrCam], ['mixed', { b: 1 }]);
  const old = await page.evaluate(() => HWStairs.session({ id: 'o1', d: '2026-01-01', t: '08:00', v: 60, m: { kind: 'workout', hrB: 70, hrA: 120, hrS: 'manual' } }));
  assert.equal(old.cam, null); assert.deepEqual([old.hrB, old.hrA], [70, 120]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('cancel, leaving the page and a hidden page stop every track; permission denied and no camera are plain messages', async () => {
  const { page, ctx, errors } = await openApp({ before: fakeCam(1.2), viewport: { width: 390, height: 844 } });
  await go(page, 'pulse');
  const begin = async () => { await page.click('#hwppg [data-a="ppgopen"]'); await page.click('[data-a="ppgstart"]'); await page.waitForFunction(() => HWPPG.state === 'run'); await page.waitForTimeout(500); };
  await begin();
  await page.click('[data-a="ppgcancel"]');
  assert.equal(await ended(page), true, 'cancel stops the tracks');
  assert.equal(await page.evaluate(() => HWPPG.state), 'idle');
  assert.equal(await page.locator('#hwppg [data-a="ppgopen"]').count(), 1);
  await page.evaluate(() => { window.__streams.length = 0; });
  await begin();
  await go(page, 'home');
  assert.equal(await ended(page), true, 'leaving the page stops the tracks');
  assert.equal(await page.evaluate(() => HWPPG.state), 'idle');
  await page.evaluate(() => { window.__streams.length = 0; });
  await go(page, 'pulse'); await begin();
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await ended(page), true, 'a hidden page stops the tracks');
  assert.match(await page.textContent('#hwppg'), /page was hidden/);
  await page.evaluate(() => { delete document.hidden; });
  // denied: one plain message, no repeated prompt
  await page.evaluate(() => { window.__gum = 'deny'; window.__asked = 0; });
  await page.click('#hwppg [data-a="ppgopen"]'); await page.click('[data-a="ppgstart"]');
  await page.waitForFunction(() => /Camera permission was not given/.test(document.getElementById('hwppg').textContent));
  assert.match(await page.textContent('#hwppg'), /Camera permission was not given\. You can still count your pulse by hand\./);
  assert.equal(await page.locator('#hwppg [data-a="ppgopen"]').count(), 0, 'no repeated prompts');
  assert.equal(await page.evaluate(() => window.__asked), 1);
  assert.equal(await page.locator('#wk-b').count(), 1, 'manual entry stays');
  assert.deepEqual(errors, []);
  await ctx.close();
  // unsupported: no button, one plain line
  const u = await openApp({ before: p => p.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined }); }) });
  await go(u.page, 'pulse');
  assert.equal(await u.page.locator('#hwppg [data-a="ppgopen"]').count(), 0);
  assert.match(await u.page.textContent('#hwppg'), /Your browser can't use the camera here; count your pulse for 15 s and multiply by 4/);
  assert.equal(await u.page.locator('#wk-b').count(), 1);
  assert.deepEqual(u.errors, []);
  await u.ctx.close();
});

test('the Heartstone Hall card at 390 × 844 keeps the BEFORE field close to where it was; the help sheet explains the method', async () => {
  const { page, ctx, errors } = await openApp({ before: fakeCam(1.2), viewport: { width: 390, height: 844 } });
  await go(page, 'pulse');
  const h = await page.$eval('#hwppg', e => e.getBoundingClientRect().height);
  assert.ok(h <= 90, 'the collapsed camera panel is one button row (' + h + ' px)');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  await page.click('#hwppg .hwh');
  const t = await page.textContent('#hwh-pop');
  for (const w of [/photoplethysmography/, /blood/i, /0\.7–3\.5 Hz/, /f.*= 1 ÷ T/, /2πf/, /not a medical measurement/, /count for 15 s and multiply by 4/]) assert.match(t, w);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a camera button beside every BPM option: it brings CAMERA PULSE into view, and a good reading fills the field and logs BEFORE / AFTER by itself', async () => {
  const { page, ctx, errors } = await openApp({ before: fakeCam(1.2), viewport: { width: 390, height: 844 } });
  await go(page, 'pulse');
  for (const [k, where] of [['b', '.sthr.b'], ['a', '.sthr.a'], ['r', '.sthr.a']])
    assert.equal(await page.locator(where + ' [data-a="ppgopen"][data-k="' + k + '"]').count(), 1, 'camera button for ' + k);
  assert.ok(await page.evaluate(() => { const l = document.querySelector('.sthr.b [data-a="hrlog"]').getBoundingClientRect(), c = document.querySelector('.sthr.b [data-a="ppgopen"]').getBoundingClientRect(); return Math.abs(l.top - c.top) < 4 && c.left > l.right - 2; }), 'the camera button sits beside LOG BEFORE BPM');
  assert.equal(EMOJI.test(await page.textContent('.sthr.b .stlogr')), false);
  // AFTER: measured from its own button
  await page.click('.sthr.a [data-a="ppgopen"][data-k="a"]');
  assert.match(await page.textContent('#mo'), /filled in and logged as AFTER/);
  await page.waitForFunction(() => { const t = document.getElementById('hwppg').getBoundingClientRect().top; return t >= -2 && t < 300; }, null, { timeout: 5000 }); // the screen is taken to CAMERA PULSE
  await page.click('[data-a="ppgstart"]');
  assert.match(await page.textContent('#hwppg'), /filled in and logged as AFTER/);
  await page.waitForSelector('#ppg-res', { timeout: 40000 });
  const bpm = +(await page.textContent('#ppg-res'));
  assert.equal(await page.inputValue('#wk-a'), String(bpm), 'AFTER is filled in');
  let p = (await state(page)).e.filter(x => x.c === 'pulse');
  assert.equal(p.length, 1, 'logged without pressing LOG');
  assert.deepEqual([p[0].v, p[0].m.when, p[0].m.src, p[0].m.ppg.q], [bpm, 'after', 'camera', 'good']);
  assert.equal(await page.evaluate(() => hrLast().a), bpm);
  assert.equal(await page.locator('#st-logs svg.pxi-camera').count(), 1);
  // 1 MIN AFTER: filled in, saved only with the workout
  await page.click('.sthr.a [data-a="ppgopen"][data-k="r"]');
  await page.click('[data-a="ppgstart"]');
  await page.waitForFunction(() => HWPPG.state === 'done' && document.getElementById('wk-r').value !== '', null, { timeout: 40000 });
  p = (await state(page)).e.filter(x => x.c === 'pulse');
  assert.equal(p.length, 1, '1 minute after is not a logged BPM');
  assert.match(await page.innerHTML('#st-hs-r'), /pxi-camera/);
  assert.equal(await page.evaluate(() => !!HWStairs.draft.hrR1c), true);
  // the plain button does not log by itself
  await page.click('#hwppg [data-a="ppgopen"]');
  assert.doesNotMatch(await page.textContent('#mo'), /logged as/);
  assert.deepEqual(errors, []);
  await ctx.close();
});
