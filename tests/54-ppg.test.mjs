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

test('processing: a 1.2 Hz sine with noise and drift at 30 fps reads 72 BPM, quality good; 0.9 and 2.5 Hz read 54 and 150', async () => {
  const { page, ctx, errors } = await openApp();
  for (const [f, want] of [[1.2, 72], [.9, 54], [2.5, 150]]) {
    for (const seed of [3, 11]) {
      const r = await synth(page, { f, seed });
      assert.equal(r.quality, 'good', f + ' Hz: ' + JSON.stringify(r));
      assert.ok(r.ok && Math.abs(r.bpm - want) <= 2, f + ' Hz → ' + r.bpm + ' BPM, want ' + want);
      assert.ok(r.beats >= 12);
    }
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('processing: flat noise has no BPM and quality none; motion spikes with lost frames are weak or none, never a number', async () => {
  const { page, ctx, errors } = await openApp();
  for (const seed of [1, 2, 3]) {
    const r = await synth(page, { f: 1.2, sine: false, noise: .5, seed });
    assert.equal(r.quality, 'none', JSON.stringify(r)); assert.equal(r.bpm, null); assert.equal(r.ok, false);
  }
  const w = await synth(page, { f: 1.2, spikes: [2, 5.5, 8, 11.5, 14, 17], gaps: [3.5], seed: 5 });
  assert.equal(w.quality, 'weak', JSON.stringify(w)); assert.equal(w.bpm, null); assert.ok(w.why);
  const short = await synth(page, { f: 1.2, secs: 4 });
  assert.equal(short.bpm, null); assert.notEqual(short.quality, 'good');
  const none = await page.evaluate(() => HWPPG.analyze([]));
  assert.equal(none.bpm, null); assert.equal(none.quality, 'none');
  assert.deepEqual(errors, []);
  await ctx.close();
});

/* ---------- the page ---------- */
test('fake camera: sheet → START → countdown → 72 BPM CAMERA ESTIMATE with the page\'s own f, T, ω; USE AS BEFORE → LOG → counted; camera flag cleared by typing; sealed with hrCam; tracks stopped', async () => {
  const { page, ctx, errors } = await openApp({ before: fakeCam(1.2), viewport: { width: 390, height: 844 } });
  await go(page, 'pulse');
  // collapsed: one button row, camera panel before the Bluetooth panel
  assert.equal(await page.locator('#hwppg [data-a="ppgopen"]').count(), 1);
  assert.match(await page.textContent('#hwppg'), /MEASURE WITH CAMERA/);
  assert.ok(await page.evaluate(() => document.getElementById('hwppg').compareDocumentPosition(document.getElementById('hwhr')) & Node.DOCUMENT_POSITION_FOLLOWING), 'camera panel comes before the Bluetooth panel');
  assert.equal(await page.evaluate(() => window.__asked), 0, 'the camera is not asked for until START');
  await page.click('#hwppg [data-a="ppgopen"]');
  const sheet = await page.textContent('#mo');
  for (const w of [/back camera and the flash/, /estimate/i, /never leaves your phone/, /nothing is recorded/]) assert.match(sheet, w);
  assert.equal(await page.evaluate(() => window.__asked), 0);
  await page.click('[data-a="ppgstart"]');
  await page.waitForSelector('#ppg-live');
  assert.equal(await page.evaluate(() => window.__asked), 1);
  await page.waitForFunction(() => /s left/.test(document.getElementById('ppg-left').textContent) && HWPPG.state === 'run');
  const left0 = parseInt(await page.textContent('#ppg-left'), 10);
  await page.waitForTimeout(3000);
  assert.ok(parseInt(await page.textContent('#ppg-left'), 10) < left0, 'the countdown runs while the finger covers the lens');
  assert.match(await page.textContent('#ppg-st'), /Finding your pulse|Reading your pulse/);
  assert.match(await page.textContent('#ppg-st'), /No flash: use good room light/, 'a stream without a torch says so');
  await page.waitForSelector('#ppg-res', { timeout: 40000 });
  assert.equal(await ended(page), true, 'all tracks stopped when the measurement finishes');
  const bpm = +(await page.textContent('#ppg-res'));
  assert.ok(Math.abs(bpm - 72) <= 2, 'camera pulse 1.2 Hz → ' + bpm);
  const res = await page.textContent('#hwppg');
  assert.match(res, /CAMERA ESTIMATE/); assert.match(res, /Based on \d+ beats over \d+ s\./);
  assert.match(res, /Camera readings are usually close at rest but less reliable right after exercise or if you move\. If it looks wrong, count for 15 s and multiply by 4\./);
  assert.match(res, /fitted sine, f = /);
  assert.doesNotMatch(res, /arrhythm|irregular heart|\bAF\b|atrial/i);
  assert.equal(EMOJI.test(res), false, 'no emoji in the camera panel');
  const same = await page.evaluate(b => ({ shown: document.getElementById('ppg-shm').textContent, want: HWStairs.shmTxt(HWStairs.pulseSHM(b)) }), bpm);
  assert.equal(same.shown, same.want, 'f, T and ω are the page\'s own pulseSHM / shmTxt');
  assert.equal(await page.locator('#ppg-fit').count(), 1);
  assert.ok(await page.evaluate(() => { const c = document.getElementById('ppg-fit'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] > 150) n++; return n > 20; }), 'the fitted sine is drawn');
  // nothing was saved by measuring
  assert.equal((await state(page)).e.filter(x => x.c === 'pulse').length, 0);
  // USE AS BEFORE fills the field and marks the source; still not saved
  await page.click('[data-a="ppguse"][data-k="b"]');
  assert.equal(await page.inputValue('#wk-b'), String(bpm));
  assert.match(await page.innerHTML('#st-hs-b'), /pxi-camera[\s\S]*Camera estimate from your fingertip \(\d+ beats\)\./);
  assert.match(await page.getAttribute('#st-tr-b', 'aria-label'), /from the camera estimate/);
  assert.equal((await state(page)).e.filter(x => x.c === 'pulse').length, 0);
  // a camera number can only be logged for now
  await page.click('#sthrc [data-hww="tog"]'); await page.click('#sthrc [data-hww="yest"]');
  await page.click('[data-a="hrlog"][data-k="b"]');
  await page.waitForFunction(() => /measured with the camera just now/.test(document.getElementById('toasts').textContent));
  assert.equal((await state(page)).e.filter(x => x.c === 'pulse').length, 0, 'refused for a custom date');
  await page.click('#sthrc [data-hww="now"]');
  await page.click('[data-a="hrlog"][data-k="b"]');
  const p = (await state(page)).e.filter(x => x.c === 'pulse');
  assert.equal(p.length, 1);
  assert.deepEqual([p[0].v, p[0].m.when, p[0].m.src, p[0].m.ppg.q], [bpm, 'before', 'camera', 'good']);
  assert.ok(p[0].m.ppg.beats >= 12 && p[0].m.ppg.secs >= 10);
  assert.equal(await page.evaluate(() => hrLast().b), bpm, 'counted by hrLast');
  assert.match(await page.textContent('#st-counted'), new RegExp('Before: ' + bpm));
  assert.equal(await page.locator('#st-logs svg.pxi-camera').count(), 1, 'camera icon in LOGGED TODAY');
  // the result is still there after the page re-rendered; typing over the field clears the camera flag
  assert.equal(await page.locator('#ppg-res').count(), 1);
  await page.fill('#wk-b', '80');
  assert.equal(await page.evaluate(() => HWStairs.draft.hrBc), 0);
  assert.match(await page.textContent('#st-hs-b'), /Counted and typed in by you/);
  assert.match(await page.getAttribute('#st-tr-b', 'aria-label'), /typed in by you/);
  // all three numbers from the camera, then SEAL THE WORKOUT
  for (const k of ['b', 'a', 'r']) await page.click('[data-a="ppguse"][data-k="' + k + '"]');
  assert.deepEqual(await page.evaluate(() => [HWStairs.draft.hrB, HWStairs.draft.hrA, HWStairs.draft.hrR1]), [String(bpm), String(bpm), String(bpm)]);
  assert.match(await page.innerHTML('#st-hs-r'), /pxi-camera/);
  await fillSteps(page, '#wk-s', '20'); await page.fill('#wk-c', '3');
  await pickStair(page);
  await page.click('#stseal [data-hww="tog"]'); await page.click('#stseal [data-hww="yest"]');
  await page.click('[data-a="stwsave"]');
  await page.waitForFunction(() => /camera pulse estimates taken just now/.test(document.getElementById('toasts').textContent));
  assert.equal((await state(page)).e.filter(x => x.c === 'stair').length, 0, 'refused for a custom date');
  await page.click('#stseal [data-hww="now"]');
  await page.click('[data-a="stwsave"]');
  const e = (await state(page)).e.filter(x => x.c === 'stair').pop();
  assert.deepEqual([e.m.hrB, e.m.hrA, e.m.hrR1, e.m.hrS, e.m.hrCam, e.m.hrDev, e.m.src], [bpm, bpm, bpm, 'camera', { b: 1, a: 1, r: 1 }, undefined, 'manual']);
  const sess = await page.evaluate(id => HWStairs.session(st.e.find(x => x.id === id)), e.id);
  assert.deepEqual(sess.cam, { b: 1, a: 1, r: 1 });
  await stairHistory(page); // the saved sessions are in the Stairs section's history
  assert.ok(await page.locator('#stlog .stses').first().locator('svg.pxi-camera').count() >= 2, 'camera icon on the saved session');
  assert.deepEqual(errors, []);
  await ctx.close();
});
