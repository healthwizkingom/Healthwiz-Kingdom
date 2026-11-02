// SCAN MY DRINK (js/v6-watercam.js): a camera estimate of the water in bottles and cups, logged through drink() like a manual entry.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, state } from './helpers.mjs';
import { fakeSupabase, device, synced, signIn } from './cloud-fake.mjs';

after(closeBrowser);
const boot = async o => { const r = await openApp(o); await r.page.waitForSelector('.wl'); await go(r.page, 'water'); return r; };
const waters = page => state(page).then(s => s.e.filter(e => e.c === 'water'));

test('drink(v, meta) stores the meta; a manual drink still stores {}', async () => {
  const { page, ctx, errors } = await boot();
  const before = await page.evaluate(() => wt());
  await page.evaluate(() => { drink(250, { src: 'camera', est: true, conf: 'medium' }); drink(100); });
  const w = await waters(page);
  assert.deepEqual(w.at(-2).m, { src: 'camera', est: true, conf: 'medium' });   // stored as given
  assert.deepEqual(w.at(-1).m, {});
  assert.equal(await page.evaluate(() => wt()), before + 350);
  assert.deepEqual(errors, []); await ctx.close();
});

test('a camera entry is tagged "camera estimate" in the Water history', async () => {
  const { page, ctx, errors } = await boot();
  await page.evaluate(() => { drink(250, { src: 'camera', est: true, conf: 'high' }); });
  await go(page, 'water');
  const html = await page.evaluate(() => document.querySelector('#main').innerHTML);
  assert.match(html, /camera estimate/);
  assert.deepEqual(errors, []); await ctx.close();
});

// ---- the camera: a canvas stream stands in for the phone camera; stops are counted ----
const CAM = () => {
  window.__cam = { opens: 0, stops: 0, err: null };
  if (window.__nocam) return;
  navigator.mediaDevices.getUserMedia = async () => {
    window.__cam.opens++;
    if (window.__cam.err) { const e = new Error('x'); e.name = window.__cam.err; throw e; }
    const c = document.createElement('canvas'); c.width = 320; c.height = 240;
    const g = c.getContext('2d'); g.fillStyle = '#4a7'; g.fillRect(0, 0, 320, 240);
    setInterval(() => { g.fillStyle = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); g.fillRect(0, 0, 40, 40); }, 100);
    const s = c.captureStream(10); s.getTracks().forEach(t => { const st = t.stop.bind(t); t.stop = () => { window.__cam.stops++; st(); }; }); return s;
  };
};
const TWO = { result: { containers: [
  { label: 'Water bottle', type: 'bottle', capacity_ml: 500, fill: 0.6, ml: 300, lo: 250, hi: 350, conf: 'high', basis: 'label says 500 mL, about 60% full' },
  { label: 'Glass', type: 'glass', capacity_ml: 250, fill: 1, ml: 250, lo: 200, hi: 250, conf: 'medium', basis: 'standard 250 mL glass, full' }], note: 'Two drinks.' } };
const cam = async (o = {}) => {
  const S = fakeSupabase(); if (o.replies) S.scanReplies = o.replies;
  const r = await device(S, { viewport: o.viewport, context: o.context });
  await r.page.evaluate(CAM);
  if (o.nocam) await r.page.evaluate(() => { navigator.mediaDevices.getUserMedia = undefined; });
  if (o.in !== false) { await signIn(r.page, S); await synced(r.page); }
  await go(r.page, 'water');
  return { S, ...r };
};
const shoot = async page => { await page.click('[data-a="wcscan"]'); await page.waitForSelector('#wc-video'); await page.waitForFunction(() => document.getElementById('wc-video').videoWidth > 0); await page.click('[data-a="wcshot"]'); };
const card = page => page.textContent('#wc-card').then(t => t.replace(/\s+/g, ' ').trim());

test('logMl: take x ml, rounded, clamped to 0..1500', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => [HWWaterCam.logMl({ ml: 500, take: .6 }), HWWaterCam.logMl({ ml: 1600, take: 1 }), HWWaterCam.logMl({ ml: 300, take: 0 }), HWWaterCam.logMl({ ml: 301.4, take: 1 }), HWWaterCam.logMl({ ml: -5, take: 1 }), HWWaterCam.logMl({ ml: 'x', take: 1 })]);
  assert.deepEqual(r, [300, 1500, 0, 301, 0, 0]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the card sits below ADD WATER, says the photo is not stored, and labels itself an estimate', async () => {
  const { page, ctx, errors } = await cam();
  const order = await page.evaluate(() => { const m = document.getElementById('main').innerHTML; return [m.indexOf('ADD WATER</h3>'), m.indexOf('id="wc-card"'), m.indexOf('class="grid"')]; });
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2], 'ADD WATER, then the scan card, then the stats grid: ' + order);
  const c = await card(page);
  assert.match(c, /SCAN MY DRINK/); assert.match(c, /not stored/i); assert.match(c, /estimate/i);
  assert.equal(await page.evaluate(() => window.__cam.opens), 0, 'the camera is not opened until the player taps SCAN');
  assert.deepEqual(errors, []); await ctx.close();
});

test('signed out: SCAN says to sign in and the manual ADD WATER still works', async () => {
  const { page, ctx, errors } = await cam({ in: false });
  await page.click('[data-a="wcscan"]');
  assert.match(await card(page), /Sign in/);
  assert.equal(await page.evaluate(() => window.__cam.opens), 0);
  const w0 = await page.evaluate(() => wt()); await page.click('[data-a="wa"][data-v="250"]');
  assert.equal(await page.evaluate(() => wt()), w0 + 250);
  assert.deepEqual(errors, []); await ctx.close();
});

test('permission denied: a plain message, no stream left open, ADD WATER works', async () => {
  const { page, ctx, errors } = await cam();
  await page.evaluate(() => { window.__cam.err = 'NotAllowedError'; });
  await page.click('[data-a="wcscan"]'); await page.waitForFunction(() => /permission/i.test(document.getElementById('wc-card').textContent));
  assert.equal(await page.locator('#wc-video').count(), 0);
  assert.equal(await page.locator('[data-a="wcscan"]').count(), 1, 'the player can try again');
  await page.click('[data-a="wa"][data-v="100"]');
  assert.equal(await page.evaluate(() => wt()) % 100, 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('no camera API at all: a message, nothing breaks', async () => {
  const { page, ctx, errors } = await cam({ nocam: true });
  await page.click('[data-a="wcscan"]');
  assert.match(await card(page), /cannot open the camera|no camera/i);
  assert.deepEqual(errors, []); await ctx.close();
});

test('leaving the Water page, or hiding the app, stops the camera', async () => {
  const { page, ctx, errors } = await cam();
  await page.click('[data-a="wcscan"]'); await page.waitForSelector('#wc-video');
  await go(page, 'food');
  assert.equal(await page.evaluate(() => window.__cam.stops), 1, 'one track stopped on leaving');
  await go(page, 'water'); assert.equal(await page.locator('#wc-video').count(), 0, 'back to the idle card');
  await page.click('[data-a="wcscan"]'); await page.waitForSelector('#wc-video');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  assert.equal(await page.evaluate(() => window.__cam.stops), 2);
  assert.match(await card(page), /background|closed/i);
  assert.deepEqual(errors, []); await ctx.close();
});

test('CLOSE stops the camera and sends nothing', async () => {
  const { S, page, ctx, errors } = await cam();
  await page.click('[data-a="wcscan"]'); await page.waitForSelector('#wc-video'); await page.click('[data-a="wcclose"]');
  assert.equal(await page.evaluate(() => window.__cam.stops), 1); assert.deepEqual(S.scan, []);
  assert.deepEqual(errors, []); await ctx.close();
});

test('review: each container with ESTIMATE from photo, range, basis; the request has the photo, only after CAPTURE', async () => {
  const { S, page, ctx, errors } = await cam({ replies: [TWO] });
  await page.click('[data-a="wcscan"]'); await page.waitForSelector('#wc-video');
  assert.deepEqual(S.scan, [], 'no request before CAPTURE');
  await page.waitForFunction(() => document.getElementById('wc-video').videoWidth > 0); await page.click('[data-a="wcshot"]');
  await page.waitForSelector('.wcr');
  assert.equal(S.scan.length, 1); assert.equal(S.scan[0].mime, 'image/jpeg'); assert.ok(S.scan[0].image > 500, 'a real photo went up');
  assert.equal(await page.evaluate(() => window.__cam.stops), 1, 'the camera is off while Luke looks');
  const c = await card(page);
  assert.match(c, /ESTIMATE from photo/); assert.match(c, /Water bottle/); assert.match(c, /about 300 mL \(250 to 350 mL\)/);
  assert.match(c, /label says 500 mL, about 60% full/); assert.match(c, /Glass[\s\S]*about 250 mL \(200 to 250 mL\)/);
  assert.match(c, /Total to log: 550 mL/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('LOG adds one camera entry per ticked container and the well fills like a manual drink', async () => {
  const { page, ctx, errors } = await cam({ replies: [TWO] });
  const w0 = await page.evaluate(() => wt());
  await shoot(page); await page.waitForSelector('.wcr'); await page.click('[data-a="wclog"]');
  const w = (await waters(page)).slice(-2);
  assert.deepEqual(w.map(e => [e.v, e.m]), [[300, { src: 'camera', est: true, conf: 'high', i: 1 }], [250, { src: 'camera', est: true, conf: 'medium', i: 2 }]]);
  assert.equal(await page.evaluate(() => wt()), w0 + 550);
  await page.waitForSelector('#wqch.walk, #wqch.atw, #wqch.carry, #wqch.cel', { timeout: 8000 });
  assert.match(await card(page), /Logged 2 drinks/); assert.equal(await page.locator('.wcr').count(), 0);
  await go(page, 'water'); assert.match(await page.evaluate(() => document.getElementById('main').innerHTML), /camera estimate/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('two containers with the same mL both log, also when the entry is back-dated', async () => {
  const same = { result: { containers: [0, 1].map(i => ({ label: 'Cup ' + i, type: 'cup', capacity_ml: 250, fill: 1, ml: 250, lo: 230, hi: 250, conf: 'medium', basis: 'standard cup, full' })), note: '' } };
  const { page, ctx, errors } = await cam({ replies: [same, same] });
  const w0 = await page.evaluate(() => wt());
  await shoot(page); await page.waitForSelector('.wcr'); await page.click('[data-a="wclog"]');
  assert.equal(await page.evaluate(() => wt()), w0 + 500);
  await page.waitForFunction(() => !document.querySelector('.wcr'));
  // back-dated: the double-tap guard in HWWhen.stamp must not drop the second equal drink
  await page.evaluate(() => { const d = new Date(Date.now() - 864e5), p = n => String(n).padStart(2, '0'); HWWhen.setFor && 0; window.__y = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); });
  const n0 = (await waters(page)).length;
  await page.evaluate(() => { drink(250, { src: 'camera', est: true, i: 1 }); drink(250, { src: 'camera', est: true, i: 2 }); });
  assert.equal((await waters(page)).length, n0 + 2);
  assert.deepEqual(errors, []); await ctx.close();
});

test('untick one: only the other logs; slider 0.5 logs half; an edited mL is clamped to 1500; nothing ticked disables LOG', async () => {
  const { page, ctx, errors } = await cam({ replies: [TWO] });
  await shoot(page); await page.waitForSelector('.wcr');
  await page.uncheck('.wcr[data-i="0"] [data-ch="wctog"]');
  assert.match(await card(page), /Total to log: 250 mL/);
  await page.$eval('.wcr[data-i="1"] [data-in="wctake"]', el => { el.value = '0.5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.match(await card(page), /Total to log: 125 mL/);
  await page.fill('.wcr[data-i="1"] [data-in="wcmed"]', '4000');
  assert.match(await card(page), /Total to log: 750 mL/, 'clamped to 1500, half of it');
  await page.uncheck('.wcr[data-i="1"] [data-ch="wctog"]');
  assert.equal(await page.locator('[data-a="wclog"]').isDisabled(), true);
  const n0 = (await waters(page)).length; await page.click('[data-a="wclog"]', { force: true }).catch(() => {});
  assert.equal((await waters(page)).length, n0, 'nothing saved');
  await page.check('.wcr[data-i="1"] [data-ch="wctog"]'); await page.click('[data-a="wclog"]');
  assert.equal((await waters(page)).at(-1).v, 750);
  assert.deepEqual(errors, []); await ctx.close();
});

test('errors: unknown, 401, 429, 502 each give a plain message and keep manual logging', async () => {
  for (const [setup, re] of [[S => { S.scanReplies = [{ unknown: true }]; }, /could not see a drink/i], [S => { S.scanStatus = 401; S.scanBody = { error: 'signin' }; }, /Sign in/], [S => { S.scanStatus = 429; S.scanBody = { error: 'limit', retry: 60 }; }, /lot of scanning|try again/i], [S => { S.scanStatus = 502; S.scanBody = { error: 'ai' }; }, /muddled/i]]) {
    const { S, page, ctx, errors } = await cam(); setup(S);
    await shoot(page); await page.waitForFunction(() => !document.querySelector('.wcb'));
    assert.match(await card(page), re); assert.equal(await page.locator('[data-a="wcscan"]').count(), 1);
    assert.equal(await page.locator('[data-a="wa"][data-v="250"]').count(), 1, 'manual ADD WATER still there');
    assert.deepEqual(errors.filter(e => !/40[19]|429|502|Failed to load resource/.test(e)), []); await ctx.close();
  }
});

test('RETAKE reopens the camera; after logging no photo data stays in the page state or storage', async () => {
  const { S, page, ctx, errors } = await cam({ replies: [TWO, TWO] });
  await shoot(page); await page.waitForSelector('.wcr'); await page.click('[data-a="wcretake"]'); await page.waitForSelector('#wc-video');
  await page.waitForFunction(() => document.getElementById('wc-video').videoWidth > 0); await page.click('[data-a="wcshot"]'); await page.waitForSelector('.wcr'); await page.click('[data-a="wclog"]');
  assert.equal(S.scan.length, 2);
  const leak = await page.evaluate(() => JSON.stringify(localStorage).includes('/9j/') || JSON.stringify(HWWaterCam.state()).length > 300);
  assert.equal(leak, false);
  assert.deepEqual(errors, []); await ctx.close();
});

test('phone width: the camera and the review fit 375 px without sideways scroll', async () => {
  const { page, ctx, errors } = await cam({ replies: [TWO], viewport: { width: 375, height: 740 }, context: { isMobile: true, hasTouch: true } });
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  assert.ok(await fits(), 'idle');
  await page.click('[data-a="wcscan"]'); await page.waitForSelector('#wc-video'); assert.ok(await fits(), 'camera');
  await page.waitForFunction(() => document.getElementById('wc-video').videoWidth > 0); await page.click('[data-a="wcshot"]'); await page.waitForSelector('.wcr'); assert.ok(await fits(), 'review');
  assert.deepEqual(errors, []); await ctx.close();
});
