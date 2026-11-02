// Security hardening: the Privacy Lock (js/v6-lock.js), the link guard (js/v6-guard.js) and the Content-Security-Policy in index.html.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go } from './helpers.mjs';

after(closeBrowser);
const lockKey = page => page.evaluate(() => localStorage.getItem('hw_lock'));
async function turnOn(page, pin = '2468') {
  await go(page, 'set');
  await page.fill('#lkn1', pin); await page.fill('#lkn2', pin);
  await page.click('[data-a="lkset"]');
  await page.waitForFunction(() => HWLock.on(), null, { timeout: 15000 });
}

test('the lock is off by default: nothing stored, no cover, the Settings card offers it', async () => {
  const { page, ctx, errors } = await openApp();
  assert.equal(await lockKey(page), null);
  assert.equal(await page.locator('#hwlock').count(), 0);
  await go(page, 'set');
  assert.match(await page.locator('#v6lock').innerText(), /PRIVACY LOCK[\s\S]*screen lock, not encryption[\s\S]*TURN LOCK ON/i);
  assert.deepEqual(errors, []); await ctx.close();
});

test('setting a PIN: bad and mismatched PINs are refused; the PIN itself is never stored, only a salted PBKDF2 hash', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'set');
  await page.fill('#lkn1', '12'); await page.fill('#lkn2', '12'); await page.click('[data-a="lkset"]');
  assert.match(await page.locator('#lkmsg').innerText(), /4 to 8 digits/);
  await page.fill('#lkn1', '1234'); await page.fill('#lkn2', '4321'); await page.click('[data-a="lkset"]');
  assert.match(await page.locator('#lkmsg').innerText(), /do not match/);
  assert.equal(await lockKey(page), null, 'nothing saved after a refusal');
  await page.fill('#lkn1', '2468'); await page.fill('#lkn2', '2468'); await page.click('[data-a="lkset"]');
  await page.waitForFunction(() => HWLock.on(), null, { timeout: 15000 });
  const raw = await lockKey(page), o = JSON.parse(raw);
  assert.ok(!raw.includes('2468'), 'the PIN is not in storage');
  assert.deepEqual(Object.keys(o).sort(), ['a', 'f', 'h', 'i', 's', 'u', 'v'].sort());
  assert.equal(o.h.length, 64); assert.equal(o.s.length, 32); assert.ok(o.i >= 100000, 'many rounds');
  const all = await page.evaluate(() => Object.keys(localStorage).map(k => k === 'hw_lock' ? '' : localStorage.getItem(k)).join(''));
  assert.ok(!all.includes('2468') && !all.includes(o.h), 'not in the app data, so not in backups or the cloud save either');
  assert.deepEqual(errors, []); await ctx.close();
});

test('LOCK NOW covers the app (inert), a wrong PIN is refused, the right PIN opens it', async () => {
  const { page, ctx, errors } = await openApp();
  await turnOn(page);
  await page.click('[data-a="lklock"]');
  await page.waitForSelector('#hwlock #lkp');
  assert.equal(await page.evaluate(() => HWLock.locked()), true);
  assert.ok(await page.evaluate(() => [...document.body.children].filter(e => e.id !== 'hwlock').every(e => e.hasAttribute('inert'))), 'everything behind the cover is inert');
  assert.equal(await page.locator('#hwlock [role="dialog"]').count(), 1);
  await page.fill('#lkp', '0000'); await page.press('#lkp', 'Enter');
  await page.waitForFunction(() => /not right/.test(document.getElementById('lkm').textContent));
  assert.equal(await page.evaluate(() => HWLock.locked()), true);
  await page.fill('#lkp', '2468'); await page.press('#lkp', 'Enter');
  await page.waitForFunction(() => !HWLock.locked(), null, { timeout: 15000 });
  assert.equal(await page.locator('#hwlock').count(), 0);
  assert.ok(await page.evaluate(() => [...document.body.children].every(e => !e.hasAttribute('inert'))));
  assert.deepEqual(errors, []); await ctx.close();
});

test('it is up again after a reload, before the app is shown', async () => {
  const { page, ctx, errors } = await openApp();
  await turnOn(page);
  await page.reload();
  await page.waitForSelector('#hwlock #lkp');
  assert.equal(await page.evaluate(() => HWLock.locked()), true);
  await page.fill('#lkp', '2468'); await page.press('#lkp', 'Enter');
  await page.waitForFunction(() => !HWLock.locked(), null, { timeout: 15000 });
  assert.deepEqual(errors, []); await ctx.close();
});

test('five wrong PINs start a wait that survives a refresh', async () => {
  const { page, ctx, errors } = await openApp();
  await turnOn(page);
  await page.click('[data-a="lklock"]');
  for (let i = 0; i < 5; i++) {
    await page.waitForSelector('#hwlock #lkp:not([disabled])');
    await page.fill('#lkp', '1111'); await page.press('#lkp', 'Enter');
    await page.waitForFunction(n => HWLock.state().fails >= n, i + 1);
  }
  await page.waitForFunction(() => /Wait \d+ s/.test(document.getElementById('lkm').textContent));
  assert.equal(await page.locator('#lkp').isDisabled(), true);
  const w = await page.evaluate(() => HWLock.state().wait); assert.ok(w > 0 && w <= 30, 'about 30 s: ' + w);
  await page.reload(); await page.waitForSelector('#hwlock #lkp');
  assert.equal(await page.locator('#lkp').isDisabled(), true, 'a refresh does not reset it');
  assert.deepEqual(errors, []); await ctx.close();
});

test('turning it off needs the PIN; FORGOT PIN needs two taps and erases the lock with the local data', async () => {
  const { page, ctx, errors } = await openApp();
  await turnOn(page);
  await page.fill('#lko', '9999'); await page.click('[data-a="lkoff"]');
  await page.waitForFunction(() => /not right/.test(document.getElementById('lkmsg').textContent));
  assert.equal(await page.evaluate(() => HWLock.on()), true);
  await page.fill('#lko', '2468'); await page.click('[data-a="lkoff"]');
  await page.waitForFunction(() => !HWLock.on(), null, { timeout: 15000 });
  assert.equal(await lockKey(page), null);
  await turnOn(page, '1357');
  await page.click('[data-a="lklock"]'); await page.waitForSelector('#lkx');
  await page.click('#lkx');
  assert.match(await page.locator('#lkx').innerText(), /TAP AGAIN/);
  assert.equal(await page.evaluate(() => HWLock.on()), true, 'one tap erases nothing');
  await Promise.all([page.waitForEvent('load'), page.click('#lkx')]);
  assert.equal(await lockKey(page), null); assert.equal(await page.locator('#hwlock').count(), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the auto-lock choice cycles and is kept', async () => {
  const { page, ctx, errors } = await openApp();
  await turnOn(page);
  assert.match(await page.locator('[data-a="lkauto"]').innerText(), /AFTER 1 MIN/);
  for (const want of [/AFTER 5 MIN/, /AFTER 15 MIN/, /ONLY AT START/, /IMMEDIATELY/]) {
    await page.click('[data-a="lkauto"]'); assert.match(await page.locator('[data-a="lkauto"]').innerText(), want);
  }
  assert.equal(await page.evaluate(() => HWLock.state().auto), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the link guard: outside links get noopener noreferrer, javascript: links never run', async () => {
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(async () => {
    window.__ran = 0;
    const m = document.createElement('div');
    m.innerHTML = '<a id="g1" href="https://example.org/x" target="_blank">out</a><a id="g2" href="javascript:window.__ran=1">js</a><a id="g3" href="#top">in</a><a id="g4" href="  JaVa\nScript:window.__ran=2">js2</a><a id="g5" href="data:text/html,<b>x</b>">d</a><a id="g6" href="https://example.org/y" rel="author">keep</a>';
    document.body.appendChild(m);
    await new Promise(r => setTimeout(r, 50));
    document.getElementById('g2')?.click(); document.getElementById('g4')?.click();
    const g = id => document.getElementById(id);
    return { g1: g('g1').rel, g2: g('g2').hasAttribute('href'), g3: g('g3').getAttribute('rel'), g4: g('g4').hasAttribute('href'), g5: g('g5').hasAttribute('href'), g6: g('g6').rel, ran: window.__ran, safe: [HWGuard.safe('https://a.b'), HWGuard.safe('javascript:1'), HWGuard.safe('blob:x'), HWGuard.safe('intent://x')] };
  });
  assert.match(r.g1, /noopener/); assert.match(r.g1, /noreferrer/);
  assert.equal(r.g2, false); assert.equal(r.g4, false); assert.equal(r.g5, false);
  assert.equal(r.g3, null, 'a link inside the app is untouched');
  assert.match(r.g6, /author/); assert.match(r.g6, /noopener/, 'existing rel kept, protection added');
  assert.equal(r.ran, 0, 'no script ran');
  assert.deepEqual(r.safe, [true, false, true, true]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the new scripts load before the safety net and are cached for offline use', async () => {
  const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const f of ['js/v6-guard.js', 'js/v6-lock.js']) assert.ok(sw.includes("'" + f + "'"), f + ' is in the service worker list');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('v6-guard.js') < html.indexOf('v6-safety.js') && html.indexOf('v6-lock.js') < html.indexOf('v6-safety.js'));
});

test('Content-Security-Policy: no eval, no plugins, same-origin base and forms; a script from another site is blocked', async () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  assert.ok(csp, 'index.html carries a Content-Security-Policy');
  for (const d of ["default-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) assert.ok(csp.includes(d), d);
  assert.ok(!/unsafe-eval/.test(csp) && !/script-src[^;]*\*\s/.test(csp), 'no eval, no wildcard script source');
  assert.ok(!/default-src[^;]*https?:/.test(csp), 'default-src is same-origin only');
  const { page, ctx, errors } = await openApp();
  const r = await page.evaluate(async () => {
    const out = { evalBlocked: false, viol: null };
    const t = document.createElement('script'); t.textContent = "setTimeout(() => { try { eval('1+1'); window.__ev = 'ran'; } catch (e) { window.__ev = e.name; } }, 20)"; document.head.appendChild(t);
    await new Promise(res => setTimeout(res, 300));   // a timer, not Playwright's own evaluate, which is exempt from the page's CSP
    out.evalBlocked = window.__ev === 'EvalError';
    const seen = new Promise(res => document.addEventListener('securitypolicyviolation', e => res(e.effectiveDirective), { once: true }));
    const s = document.createElement('script'); s.src = 'https://evil.example/x.js'; document.head.appendChild(s);
    out.viol = await Promise.race([seen, new Promise(res => setTimeout(() => res('none'), 3000))]);
    return out;
  });
  assert.equal(r.evalBlocked, true, 'eval is refused');
  assert.match(r.viol, /^script-src/, 'a script from another site is refused');
  assert.ok(errors.every(e => /evil\.example[^]*Content Security Policy/.test(e)), 'only the deliberate violations were logged: ' + errors.join(' | '));
  await ctx.close();
});
