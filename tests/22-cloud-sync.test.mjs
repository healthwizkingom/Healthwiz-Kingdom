// Step 22 (§74–76, §79, §83, §88): cloud save — offline queue, cloud data validation, reset/delete, merge rules, sessions.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';
import { URL0, ANON, tok, fakeSupabase, device, st, synced, signUp, water } from './cloud-fake.mjs';

after(closeBrowser);

test('offline: logs wait and sync when the connection returns; errors say what happened and that data is safe', async () => {
  const S = fakeSupabase();
  const { page, ctx, errors } = await device(S);
  await signUp(page); await synced(page);
  const uid = Object.values(S.users)[0].id;
  await ctx.setOffline(true);
  await water(page, 200);
  await go(page, 'set');
  assert.match(await page.textContent('#v6cl'), /Offline\. Your logs are saved on this device and will sync when you are back online/);
  assert.equal((await st(page)).pending, true);
  await ctx.setOffline(false);
  await synced(page);
  assert.equal(S.rows[uid].data.e.length, 1);
  // the cloud is unreachable while the device thinks it is online
  S.down = true;
  await water(page, 100);
  await page.click('[data-a="clsync"]');
  await page.waitForFunction(() => HWCloud.status().phase === 'error');
  assert.match(await page.textContent('#v6cl'), /Could not reach the cloud\. Your logs are saved on this device[\s\S]*Nothing on this device was lost[\s\S]*SYNC NOW/);
  assert.equal((await state(page)).e.length, 2);
  S.down = false;
  await page.click('[data-a="clsync"]'); await synced(page);
  assert.equal(S.rows[uid].data.e.length, 2);
  assert.deepEqual(errors.filter(e => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e)), []);
});

test('cloud data is validated: newer versions and damaged saves are refused without touching anything', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 1)] } });
  await signUp(page); await synced(page);
  const uid = Object.values(S.users)[0].id;
  S.rows[uid].data = { ...S.rows[uid].data, sv: 99, e: [] }; S.rows[uid].rev = 7;
  await page.evaluate(() => HWCloud.sync('user'));
  assert.match(await page.textContent('#v6cl'), /newer version of HealthWiz[\s\S]*Nothing was changed on this device or in the cloud/);
  assert.equal((await state(page)).e.length, 1); assert.equal(S.rows[uid].rev, 7);
  S.rows[uid].data = 'garbage';
  await page.evaluate(() => HWCloud.sync('user'));
  assert.match(await page.textContent('#v6cl'), /could not be read, so nothing was changed/);
  assert.equal((await state(page)).e.length, 1);
  // an older cloud save is migrated before merging
  S.rows[uid].data = { e: [{ id: 'old1', c: 'sleep', v: 8, m: {}, n: '', d: '2026-01-01', t: '22:00' }], b: { 'Shrine Visitor': '2026-01-01' }, xp: 5 }; S.rows[uid].rev = 8;
  await page.evaluate(() => HWCloud.sync('user'));
  await synced(page);
  const s = await state(page);
  assert.ok(s.e.some(x => x.id === 'old1')); assert.ok(s.b['Tower Visitor']);
  assert.equal(S.rows[uid].data.sv, s.sv);
  assert.deepEqual(errors, []);
});

test('reset signs this device out and keeps the cloud save; delete cloud save and account need two taps', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 1)] } });
  await signUp(page); await synced(page);
  const uid = Object.values(S.users)[0].id;
  await go(page, 'set');
  await page.click('[data-a="rst"]'); await page.click('[data-a="rst"]');
  assert.equal((await st(page)).signed, false);
  assert.equal(S.rows[uid].data.e.length, 1, 'cloud save untouched by a device reset');
  await page.evaluate(() => { st.s.onb = 1; save(); });
  await signUp(page, 'hero@example.com', 'kingdom123', false); await synced(page);
  assert.equal((await state(page)).e.length, 1, 'signing in again brings the kingdom back');
  await go(page, 'set');
  await page.click('#v6cl summary');
  await page.click('[data-a="cldel"]');
  assert.ok(S.rows[uid], 'first tap only arms');
  assert.match(await page.textContent('#v6cl'), /TAP AGAIN TO DELETE CLOUD SAVE/);
  await page.click('[data-a="cldel"]');
  await page.waitForFunction(() => !HWCloud.status().signed);
  assert.equal(S.rows[uid], undefined);
  assert.equal((await state(page)).e.length, 1, 'this device keeps its data');
  await signUp(page, 'hero@example.com', 'kingdom123', false); await synced(page);
  assert.ok(S.rows[uid], 'next sign-in uploads again');
  await go(page, 'set');
  await page.click('#v6cl summary');
  await page.click('[data-a="clacct"]'); await page.click('[data-a="clacct"]');
  await page.waitForFunction(() => !HWCloud.status().signed);
  assert.deepEqual(S.users, {}); assert.equal(S.rows[uid], undefined);
  assert.equal((await state(page)).e.length, 1);
  assert.deepEqual(errors, []);
});

test('merge rules, expired sessions, email confirmation and a 360 px layout', async () => {
  const S = fakeSupabase();
  S.confirm = true;
  const { page, errors } = await device(S, { viewport: { width: 360, height: 800 } });
  const m = await page.evaluate(() => {
    const E = (id, v, n) => ({ id, c: 'water', v, m: {}, n: n || '', d: '2026-10-01', t: '08:00' });
    const B = { ...DEF(), e: [E('a', 1), E('b', 2), E('c', 3), E('d', 4)], xp: 100, xd: { '2026-10-01': 10 }, s: { ...DEF().s, water: 2000 } };
    const L = { ...B, e: [E('a', 1), E('b', 20), E('c', 3), E('l', 9)], xp: 130, xd: { '2026-10-01': 40 }, s: { ...B.s, water: 2500 } }; // edit b, delete d, add l
    const R = { ...B, e: [E('b', 2), E('c', 30), E('d', 44), E('r', 8)], xp: 110, xd: { '2026-10-01': 20 }, s: { ...B.s, kcal: 1900 } }; // delete a, edit c, edit d, add r
    const M = HWCloud.merge(B, L, R);
    return { e: M.e.map(x => x.id + x.v).sort(), xp: M.xp, xd: M.xd['2026-10-01'], water: M.s.water, kcal: M.s.kcal };
  });
  assert.deepEqual(m, { e: ['b20', 'c30', 'd44', 'l9', 'r8'], xp: 140, xd: 50, water: 2500, kcal: 1900 },
    'deletes and edits carried across; an entry edited on one side and deleted on the other is kept; counters add');
  await signUp(page);
  await page.waitForFunction(() => /Account created/.test(document.querySelector('#v6cl').textContent));
  assert.match(await page.textContent('#v6cl'), /Account created\. Open the link in the email/);
  assert.equal((await st(page)).signed, false);
  // the email link returns with the session in the hash
  const usr = Object.values(S.users)[0];
  const at = tok({ sub: usr.id, email: usr.email, role: 'authenticated' });
  await page.evaluate(([at, id]) => { location.hash = 'access_token=' + at + '&refresh_token=r-' + id + '&expires_in=3600&type=signup'; location.reload(); }, [at, usr.id]);
  await page.waitForSelector('.wl');
  await synced(page);
  assert.equal(await page.evaluate(() => location.hash), '', 'tokens are removed from the address bar');
  // an expired access token is refreshed; a dead refresh token signs out without touching data
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('healthwiz_cloud')); c.ses.exp = 0; localStorage.setItem('healthwiz_cloud', c && JSON.stringify(c)); });
  await page.reload(); await page.waitForSelector('.wl'); await synced(page);
  assert.ok(S.calls.includes('POST /auth/v1/token'));
  delete S.users[usr.email]; S.users['x@y.z'] = { ...usr, id: 'other' };
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('healthwiz_cloud')); c.ses.exp = 0; localStorage.setItem('healthwiz_cloud', JSON.stringify(c)); });
  await page.reload(); await page.waitForSelector('.wl');
  await page.waitForFunction(() => !HWCloud.status().signed);
  await go(page, 'set');
  assert.match(await page.textContent('#v6cl'), /SIGN IN/);
  const over = await page.evaluate(() => { const c = document.querySelector('#v6cl').getBoundingClientRect(); return document.documentElement.scrollWidth > innerWidth || c.right > innerWidth; });
  assert.equal(over, false, 'no horizontal overflow at 360 px');
  assert.deepEqual(errors.filter(e => !/status of 400/.test(e)), [], 'only the refused refresh request is logged by the browser');
});
