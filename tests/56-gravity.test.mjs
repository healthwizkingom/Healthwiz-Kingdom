// Stair Sense, the Gravity Trial (js/v6-gravity.js): step counting from the motion sensor, the physics, and the save rules.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
// DeviceMotionEvent variants, installed before the app loads
const NONE = 'delete window.DeviceMotionEvent;';
const GRANT = 'window.DeviceMotionEvent = window.DeviceMotionEvent || function () {}; DeviceMotionEvent.requestPermission = () => Promise.resolve("granted");';
const DENY = 'window.DeviceMotionEvent = window.DeviceMotionEvent || function () {}; DeviceMotionEvent.requestPermission = () => Promise.resolve("denied");';
const boot = async (seed = RETURNING, { sensor, viewport } = {}) => {
  const r = await openApp({ seed, viewport, before: sensor ? p => p.addInitScript(sensor) : undefined });
  await r.page.waitForSelector('.wl'); await go(r.page, 'stair'); return r;
};
const stairs = page => page.evaluate(() => st.e.filter(e => e.c === 'stair'));
const num = (page, sel) => page.$eval(sel, e => e.textContent.trim());
/** Walk for `ms`: one motion event every 20 ms, a 1.8 Hz swing of 3 m/s² on top of gravity (about 108 steps a minute). */
const walk = (page, ms, hz = 1.8, amp = 3) => page.evaluate(([ms, hz, amp]) => new Promise(done => {
  const t0 = performance.now(), id = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    window.dispatchEvent(Object.assign(new Event('devicemotion'), { accelerationIncludingGravity: { x: 0.2, y: 0.1, z: 9.81 + amp * Math.sin(2 * Math.PI * hz * t) } }));
    if (t * 1000 >= ms) { clearInterval(id); done(); }
  }, 20);
}), [ms, hz, amp]);

test('step counter: counts a steady 1.8 Hz walk, ignores noise and still, caps the rate', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => {
    const run = (f, secs) => { const c = HWGravity.counter(); for (let t = 0; t <= secs * 1000; t += 20) { const [x, y, z] = f(t / 1000); c.push(t, x, y, z); } return c; };
    const walk = run(s => [0.3, 0.1, 9.81 + 3 * Math.sin(2 * Math.PI * 1.8 * s)], 10);
    const tilt = run(s => [Math.sin(s) * 4, 0, 9.81 * Math.cos(Math.sin(s) * 0.4)], 10); // slow tilting of the phone, no steps
    const still = run(s => [0.05 * Math.sin(40 * s), 0, 9.81 + 0.3 * Math.sin(53 * s)], 10);
    const shake = run(s => [0, 0, 9.81 + 5 * Math.sin(2 * Math.PI * 9 * s)], 10); // very fast shaking
    return { walk: walk.steps, cad: walk.cadence, tilt: tilt.steps, still: still.steps, shake: shake.steps };
  });
  assert.ok(r.walk >= 17 && r.walk <= 19, 'about 18 steps in 10 s, got ' + r.walk);
  assert.ok(Math.abs(r.cad - 108) <= 6, 'cadence about 108/min, got ' + r.cad);
  assert.equal(r.tilt, 0); assert.equal(r.still, 0);
  assert.ok(r.shake <= 33, 'never above 200 steps/min, got ' + r.shake);
  assert.deepEqual(errors, []); await ctx.close();
});

test('physics: worked example and unavailable inputs', async () => {
  const { page, ctx, errors } = await boot();
  const p = await page.evaluate(() => ({ a: HWGravity.physics(40, 0.169, 60, 30), noRise: HWGravity.physics(40, NaN, 60, 30), noMass: HWGravity.physics(40, 0.169, NaN, 30), short: HWGravity.physics(40, 0.169, 60, 5), zero: HWGravity.physics(0, 0.169, 60, 30), g: HWGravity.G0 }));
  // h = 40 x 0.169 = 6.76 m;  W = 60 x 9.80665 x 6.76 = 3977.57 J;  P = 3977.57 / 30 = 132.59 W
  assert.ok(Math.abs(p.a.h - 6.76) < 1e-9); assert.ok(Math.abs(p.a.W - 3977.5697) < 0.01);
  assert.ok(Math.abs(p.a.P - 132.5857) < 0.01); assert.ok(Math.abs(p.a.kJ - 3.97757) < 1e-4);
  assert.equal(p.g, 9.80665);
  assert.equal(p.noRise.h, null); assert.equal(p.noRise.W, null); assert.equal(p.noRise.P, null);
  assert.ok(p.noMass.h > 0); assert.equal(p.noMass.W, null); assert.equal(p.noMass.P, null);
  assert.ok(p.short.W > 0); assert.equal(p.short.P, null, 'power needs at least 10 s');
  assert.equal(p.zero.h, null);
  assert.deepEqual(errors, []); await ctx.close();
});

test('unsupported browser: timer and manual steps work, review shows the measured step height, saving adds one record', async () => {
  const { page, ctx, errors } = await boot(RETURNING, { sensor: NONE });
  assert.ok(await page.locator('#gvtrial').isVisible());
  await page.selectOption('#gv-sid', 'ST20');
  assert.match(await page.textContent('.gvq'), /16\.9 cm.*measured/);
  const before = await stairs(page);
  await page.click('[data-a="gvstart"]');
  assert.equal(await page.evaluate(() => HWGravity.sensor), 'unsupported');
  assert.match(await page.textContent('#gv-sens'), /no motion sensor.*type them in/);
  assert.equal(await page.evaluate(() => HWGravity.listening), false);
  assert.equal(await num(page, '#gv-steps'), '–');
  await page.click('[data-a="gvfinish"]');
  assert.equal(+await page.inputValue('#gv-r'), 16.9, 'rise prefilled from the Group 14 study');
  assert.equal(+await page.inputValue('#gv-w'), 60, 'mass from the confirmed profile');
  await page.fill('#gv-n', '40'); await page.fill('#gv-m', '0.5');
  // h = 40 x 0.169 = 6.76 m, W = 60 x 9.80665 x 6.76 = 3978 J, P = 3977.57 / 30 = 132.6 W
  const res = await page.textContent('#gv-res');
  assert.match(res, /6\.76 m/); assert.match(res, /3,?978 J/); assert.match(res, /3\.98 kJ/); assert.match(res, /132\.6 W/); assert.match(res, /ESTIMATE/);
  assert.equal((await stairs(page)).length, before.length, 'nothing saved yet');
  await page.click('[data-a="gvsave"]');
  const after = await stairs(page);
  assert.equal(after.length, before.length + 1);
  const e = after.at(-1);
  assert.equal(e.v, 40); assert.equal(e.m.sid, 'ST20'); assert.equal(e.m.kind, 'workout'); assert.equal(e.m.dur, 0.5);
  assert.equal(e.m.gv.method, 'manual'); assert.equal(e.m.gv.riseSrc, 'study'); assert.equal(e.m.gv.W, 3978); assert.equal(e.m.gv.P, 132.6);
  // the entry reads like any other session on the Stairs page
  assert.equal(await page.evaluate(id => HWStairs.session(st.e.find(x => x.id === id)).total, e.id), 40);
  // no second record by tapping again, calling the action again, or reloading the page state
  await page.evaluate(() => { acts.gvsave(); acts.gvsave(); });
  assert.equal((await stairs(page)).length, before.length + 1);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the same steps at the same stairway today asks before adding a second record', async () => {
  const seed = { ...RETURNING, e: [entry('stair', 40, 0, { sid: 'ST20', loc: 'x', steps: 40, climbs: 1 })] };
  const { page, ctx, errors } = await boot(seed, { sensor: NONE });
  await page.selectOption('#gv-sid', 'ST20');
  await page.click('[data-a="gvstart"]'); await page.click('[data-a="gvfinish"]');
  await page.fill('#gv-n', '40'); await page.fill('#gv-m', '1');
  await page.click('[data-a="gvsave"]');
  assert.match(await page.textContent('#gv-body'), /already logged a session with the same steps/);
  assert.equal((await stairs(page)).length, 1);
  await page.click('[data-a="gvsave"]');
  assert.equal((await stairs(page)).length, 2);
  assert.deepEqual(errors, []); await ctx.close();
});

test('permission denied: no sensor, timer and manual entry still work, nothing listening', async () => {
  const { page, ctx, errors } = await boot(RETURNING, { sensor: DENY });
  await page.click('[data-a="gvstart"]');
  await page.waitForSelector('#gv-sens');
  assert.equal(await page.evaluate(() => [HWGravity.sensor, HWGravity.listening, HWGravity.state].join()), 'denied,false,running');
  assert.match(await page.textContent('#gv-sens'), /Motion access was not allowed/);
  await walk(page, 600); assert.equal(await num(page, '#gv-steps'), '–', 'events are ignored without permission');
  await page.click('[data-a="gvfinish"]');
  assert.equal(await page.inputValue('#gv-n'), '');
  assert.deepEqual(errors, []); await ctx.close();
});

test('sensor granted: steps and cadence appear, PAUSE and FINISH stop the sensor, RESUME restarts it, review is prefilled but editable', async () => {
  const { page, ctx, errors } = await boot(RETURNING, { sensor: GRANT });
  await page.click('[data-a="gvstart"]');
  await page.waitForSelector('#gv-steps');
  assert.equal(await page.evaluate(() => [HWGravity.sensor, HWGravity.listening].join()), 'on,true');
  await walk(page, 4000);
  const steps = +await num(page, '#gv-steps');
  assert.ok(steps >= 5 && steps <= 9, 'about 7 steps in 4 s, got ' + steps);
  assert.match(await num(page, '#gv-cad'), /^\d+$/);
  // pause: sensor off, more motion changes nothing, the clock stops
  await page.click('[data-a="gvpause"]');
  assert.equal(await page.evaluate(() => HWGravity.listening), false);
  const t1 = await num(page, '#gv-time'); await walk(page, 1500);
  assert.equal(+await num(page, '#gv-steps'), steps);
  assert.equal(await num(page, '#gv-time'), t1, 'paused time is not counted');
  await page.click('[data-a="gvresume"]');
  assert.equal(await page.evaluate(() => HWGravity.listening), true);
  await walk(page, 1200);
  assert.ok(+await num(page, '#gv-steps') > steps);
  await page.waitForTimeout(700);
  const est = +await num(page, '#gv-steps');
  await page.click('[data-a="gvfinish"]');
  assert.equal(await page.evaluate(() => HWGravity.listening), false, 'sensor processing stops when the session ends');
  assert.equal(+await page.inputValue('#gv-n'), est);
  assert.match(await page.textContent('#gv-nn'), /sensor estimated/);
  // an unmeasured staircase: height, work and power are unavailable, never guessed
  await page.selectOption('#gv-sid', 'ST03');
  assert.equal(await page.inputValue('#gv-r'), '');
  assert.match(await page.textContent('#gv-res'), /unavailable[\s\S]*unavailable[\s\S]*unavailable[\s\S]*unavailable/);
  assert.match(await page.textContent('#gv-res'), /Unavailable until you enter: height of one step/);
  await page.fill('#gv-r', '17'); await page.fill('#gv-m', '0.5');
  assert.doesNotMatch(await page.textContent('#gv-res'), /unavailable/i);
  assert.match(await page.textContent('#gv-rn'), /Typed in by you/);
  await page.click('[data-a="gvsave"]');
  const e = (await stairs(page)).at(-1);
  assert.equal(e.m.gv.riseSrc, 'typed'); assert.equal(e.m.gv.sensor, est); assert.equal(e.m.gv.method, 'sensor');
  assert.deepEqual(errors, []); await ctx.close();
});

test('no motion readings arrive: says so and keeps the timer', async () => {
  const { page, ctx, errors } = await boot(RETURNING, { sensor: GRANT });
  await page.click('[data-a="gvstart"]');
  await page.waitForFunction(() => HWGravity.sensor === 'none', null, { timeout: 8000 });
  assert.match(await page.textContent('#gv-sens'), /No motion readings/);
  assert.equal(await page.evaluate(() => HWGravity.listening), false);
  assert.deepEqual(errors, []); await ctx.close();
});

test('missing body mass: work and power are unavailable, and asked for', async () => {
  const seed = { ...RETURNING, s: { ...RETURNING.s, onb: 0 }, p: { ...RETURNING.p } };
  const { page, ctx, errors } = await boot(seed, { sensor: NONE });
  await page.selectOption('#gv-sid', 'ST19');
  await page.click('[data-a="gvstart"]'); await page.click('[data-a="gvfinish"]');
  assert.equal(await page.inputValue('#gv-w'), '');
  await page.fill('#gv-n', '30'); await page.fill('#gv-m', '1');
  const res = await page.textContent('#gv-res');
  assert.match(res, /h[\s\S]*4\.71 m/); // 30 x 0.157
  assert.match(res, /Unavailable until you enter: body mass/);
  await page.fill('#gv-w', '55');
  assert.match(await page.textContent('#gv-res'), /W = 55\.0 × 9\.80665 × 4\.71/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('weight records are used before the profile', async () => {
  const seed = { ...RETURNING, e: [entry('bmi', 24, 2, { h: 170, w: 70.5 })] };
  const { page, ctx, errors } = await boot(seed, { sensor: NONE });
  await page.click('[data-a="gvstart"]'); await page.click('[data-a="gvfinish"]');
  assert.equal(+await page.inputValue('#gv-w'), 70.5);
  assert.match(await page.textContent('#gv-wn'), /your weight record of/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('cancel needs a second tap, saves nothing and turns the sensor off', async () => {
  const { page, ctx, errors } = await boot(RETURNING, { sensor: GRANT });
  const before = await page.evaluate(() => localStorage.getItem('healthwiz'));
  await page.click('[data-a="gvstart"]'); await page.waitForSelector('#gv-steps'); await walk(page, 1500);
  await page.click('[data-a="gvcancel"]');
  assert.match(await page.textContent('.gvx'), /TAP AGAIN TO DISCARD/);
  assert.equal(await page.evaluate(() => HWGravity.state), 'running');
  await page.click('[data-a="gvcancel"]');
  assert.equal(await page.evaluate(() => [HWGravity.state, HWGravity.listening].join()), 'idle,false');
  assert.equal(await page.evaluate(() => localStorage.getItem('healthwiz')), before);
  assert.deepEqual(errors, []); await ctx.close();
});

test('leaving the page pauses a running climb and turns the sensor off', async () => {
  const { page, ctx, errors } = await boot(RETURNING, { sensor: GRANT });
  await page.click('[data-a="gvstart"]'); await page.waitForSelector('#gv-steps');
  await go(page, 'home');
  assert.equal(await page.evaluate(() => [HWGravity.state, HWGravity.listening].join()), 'paused,false');
  assert.deepEqual(errors, []); await ctx.close();
});

test('a doctor-first condition keeps START closed until it is ticked; the ? panel states the limits', async () => {
  const seed = { ...RETURNING, p: { ...RETURNING.p, conds: ['heart'] } };
  const { page, ctx, errors } = await boot(seed, { sensor: NONE });
  assert.equal(await page.locator('[data-a="gvstart"]').isDisabled(), true);
  await page.check('#gv-ack');
  assert.equal(await page.locator('[data-a="gvstart"]').isDisabled(), false);
  await page.click('#gvtrial .hwh');
  const t = await page.textContent('#hwh-pop');
  assert.match(t, /estimates/i); assert.match(t, /does not measure work or power/); assert.match(t, /not a challenge or a race/);
  assert.match(t, /Pausing, finishing, cancelling or leaving the page turns it off/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('existing sessions are untouched by saving a Stair Sense climb', async () => {
  const old = entry('stair', 30, 3, { sid: 'ST05', loc: 'old', steps: 15, climbs: 2, diff: 'MILD' });
  const { page, ctx, errors } = await boot({ ...RETURNING, e: [old] }, { sensor: NONE });
  await page.click('[data-a="gvstart"]'); await page.click('[data-a="gvfinish"]');
  await page.selectOption('#gv-sid', 'ST14'); await page.fill('#gv-n', '20'); await page.fill('#gv-m', '1');
  await page.click('[data-a="gvsave"]');
  const e = await stairs(page);
  assert.equal(e.length, 2); assert.deepEqual(e[0], old);
  assert.deepEqual(errors, []); await ctx.close();
});

test('small phone screens: idle, running and review have no sideways scroll and big enough controls', async () => {
  for (const vp of [{ width: 320, height: 568 }, { width: 360, height: 640 }]) {
    const { page, ctx, errors } = await boot(RETURNING, { sensor: GRANT, viewport: vp });
    const fit = async label => {
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth,
        over: [...document.querySelectorAll('#gvtrial *')].filter(e => !e.closest('.tscroll') && e.getBoundingClientRect().width && e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName),
        small: [...document.querySelectorAll('#gvtrial button:not(.hwh), #gvtrial select, #gvtrial input[type=number]')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44 - 1).map(e => e.dataset.a || e.id) }));
      assert.ok(m.sw <= m.iw, vp.width + ' ' + label + ': page scrolls sideways');
      assert.deepEqual(m.over, [], vp.width + ' ' + label + ': content outside the screen');
      assert.deepEqual(m.small, [], vp.width + ' ' + label + ': controls under 44 px');
    };
    await fit('idle');
    await page.selectOption('#gv-sid', 'ST20');
    await page.click('[data-a="gvstart"]'); await page.waitForSelector('#gv-steps'); await fit('running');
    await page.click('[data-a="gvfinish"]'); await page.fill('#gv-n', '40'); await page.fill('#gv-m', '0.5'); await fit('review');
    assert.deepEqual(errors, []); await ctx.close();
  }
});
