// Cloud sync (§74–76, §79, §83, §88): offline queue and status, cloud data validation, reset, DELETE ACCOUNT & CLOUD DATA,
// merge rules, the email link, sessions, and the Wizard's Counsel chat never leaving the page.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';
import { URL0, tok, fakeSupabase, device, st, synced, signIn, water } from './cloud-fake.mjs';

after(closeBrowser);

test('offline: "Offline: will sync later", then synced when back; errors say what happened and that data is safe', async () => {
  const S = fakeSupabase();
  const { page, ctx, errors } = await device(S);
  await signIn(page, S); await synced(page);
  const uid = Object.values(S.users)[0].id;
  await ctx.setOffline(true);
  await water(page, 200);
  await go(page, 'set');
  assert.match(await page.textContent('#v6acct'), /SYNCOffline: will sync later/);
  assert.equal((await st(page)).pending, true);
  await ctx.setOffline(false);
  await synced(page);
  assert.equal(S.rows[uid].data.e.length, 1);
  await go(page, 'set');
  assert.match(await page.textContent('#v6acct'), /SYNCSynced at \d\d:\d\d/);
  // the cloud is unreachable while the device thinks it is online
  S.down = true;
  await water(page, 100);
  await page.click('[data-a="acsync"]');
  await page.waitForFunction(() => HWCloud.status().phase === 'error');
  assert.match(await page.textContent('#v6acct'), /Could not reach the cloud\. Your logs are saved on this device[\s\S]*Nothing on this device was lost/);
  assert.equal((await state(page)).e.length, 2);
  S.down = false;
  await page.click('[data-a="acsync"]'); await synced(page);
  assert.equal(S.rows[uid].data.e.length, 2);
  assert.deepEqual(errors.filter(e => !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(e)), []);
});

test('cloud data is validated: newer versions and damaged saves are refused without touching anything', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 1)] } });
  await signIn(page, S); await synced(page);
  const uid = Object.values(S.users)[0].id;
  S.rows[uid].data = { ...S.rows[uid].data, sv: 99, e: [] }; S.rows[uid].updated_at = '2026-10-05T11:00:00+00:00';
  await page.evaluate(() => HWCloud.sync('user'));
  await go(page, 'set');
  assert.match(await page.textContent('#v6acct'), /newer version of HealthWiz[\s\S]*Nothing was changed on this device or in the cloud/);
  assert.equal((await state(page)).e.length, 1); assert.equal(S.rows[uid].updated_at, '2026-10-05T11:00:00+00:00');
  S.rows[uid].data = 'garbage';
  await page.evaluate(() => HWCloud.sync('user'));
  assert.match(await page.textContent('#v6acct'), /could not be read, so nothing was changed/);
  assert.equal((await state(page)).e.length, 1);
  // an older cloud save is migrated before merging
  S.rows[uid].data = { e: [{ id: 'old1', c: 'sleep', v: 8, m: {}, n: '', d: '2026-01-01', t: '22:00' }], b: { 'Shrine Visitor': '2026-01-01' }, xp: 5 }; S.rows[uid].updated_at = '2026-10-05T11:00:01+00:00';
  await page.evaluate(() => HWCloud.sync('user'));
  await synced(page);
  const s = await state(page);
  assert.ok(s.e.some(x => x.id === 'old1')); assert.ok(s.b['Tower Visitor']);
  assert.equal(S.rows[uid].data.sv, s.sv);
  assert.deepEqual(errors, []);
});

test('reset signs this device out and keeps the cloud; DELETE ACCOUNT & CLOUD DATA takes two taps and removes everything', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 1)] } });
  await signIn(page, S); await synced(page);
  const uid = Object.values(S.users)[0].id;
  await go(page, 'set');
  await page.click('[data-a="rst"]'); await page.click('[data-a="rst"]');
  assert.equal((await st(page)).signed, false);
  assert.equal(S.rows[uid].data.e.length, 1, 'cloud untouched by a device reset');
  await page.evaluate(() => { st.s.onb = 1; save(); });
  await signIn(page, S); await synced(page);
  assert.equal((await state(page)).e.length, 1, 'signing in again brings the kingdom back');
  await go(page, 'set');
  const del = await page.textContent('#v6acct [data-a="acdel"]');
  assert.match(del, /DELETE ACCOUNT & CLOUD DATA/);
  await page.click('[data-a="acdel"]');
  assert.ok(S.rows[uid], 'first tap only arms');
  assert.match(await page.textContent('#v6acct'), /TAP AGAIN TO DELETE EVERYTHING/);
  await page.click('[data-a="acdel"]');
  await page.waitForFunction(() => !HWCloud.status().signed);
  assert.deepEqual(S.users, {}, 'the account is gone'); assert.equal(S.rows[uid], undefined, 'and its cloud data');
  assert.ok(S.calls.includes('POST /rest/v1/rpc/hw_delete_account'));
  assert.equal((await state(page)).e.length, 1, 'this device keeps its data');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz_cloud')).ses), null, 'no session left behind');
  assert.deepEqual(errors, []);
});

test('the Wizard\'s Counsel chat is never synced or stored', async () => {
  const S = fakeSupabase();
  S.aiReply = '[mood:calm] I hear thee.';
  const { page, errors } = await device(S);
  await signIn(page, S); await synced(page);
  await go(page, 'stress');
  await page.click('[data-a="csgo"]'); await page.click('[data-a="csskip"]');
  await page.fill('#csin', 'SECRET-WORDS my exam went badly');
  await page.click('[data-a="cssend"]');
  await page.waitForFunction(() => S.cs && !S.cs.busy && S.cs.m.some(x => x.r === 'a' && /hear thee/.test(x.t)));
  await page.evaluate(() => HWCloud.sync('user')); await synced(page);
  const uid = Object.values(S.users)[0].id;
  assert.doesNotMatch(JSON.stringify(S.rows[uid].data), /SECRET-WORDS|hear thee/, 'not in the cloud copy');
  const ls = await page.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).join('\n'));
  assert.doesNotMatch(ls, /SECRET-WORDS|hear thee/, 'not in any storage on the device');
  assert.match(S.ask[0].messages.at(-1).content, /SECRET-WORDS/, 'only sent to Medius for his reply');
  assert.deepEqual(errors, []);
});

test('merge rules, the email link, expired sessions and a 360 px layout', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { viewport: { width: 360, height: 800 } });
  const m = await page.evaluate(() => {
    const E = (id, v, n) => ({ id, c: 'water', v, m: {}, n: n || '', d: '2026-10-01', t: '08:00' });
    const B = { ...DEF(), e: [E('a', 1), E('b', 2), E('c', 3), E('d', 4)], xp: 100, xd: { '2026-10-01': 10 }, s: { ...DEF().s, water: 2000 } };
    const L = { ...B, e: [E('a', 1), E('b', 20), E('c', 3), E('l', 9)], xp: 130, xd: { '2026-10-01': 40 }, s: { ...B.s, water: 2500 } }; // edit b, delete d, add l
    const R = { ...B, e: [E('b', 2), E('c', 30), E('d', 44), E('r', 8)], xp: 110, xd: { '2026-10-01': 20 }, s: { ...B.s, kcal: 1900 } }; // delete a, edit c, edit d, add r
    const M = HWCloud.merge(B, L, R), both = HWCloud.mergeBoth(L, R);
    return { e: M.e.map(x => x.id + x.v).sort(), xp: M.xp, xd: M.xd['2026-10-01'], water: M.s.water, kcal: M.s.kcal,
      both: { e: both.e.map(x => x.id + x.v).sort(), xp: both.xp, water: both.s.water } };
  });
  assert.deepEqual(m, { e: ['b20', 'c30', 'd44', 'l9', 'r8'], xp: 140, xd: 50, water: 2500, kcal: 1900,
    both: { e: ['a1', 'b20', 'c3', 'd44', 'l9', 'r8'], xp: 130, water: 2500 } },
  'sync: deletes and edits carried across, counters add; first sign-in MERGE: backup rules (every id once, this device wins, larger XP)');
  // the magic link opened on this device comes back with the session in the address hash
  S.users['hero@example.com'] = { id: 'u9-0000', email: 'hero@example.com' };
  const at = tok({ sub: 'u9-0000', email: 'hero@example.com', role: 'authenticated', exp: 9e9 });
  await page.evaluate(at => { location.hash = 'access_token=' + at + '&refresh_token=r-u9-0000&expires_in=3600&token_type=bearer&type=magiclink'; location.reload(); }, at);
  await page.waitForSelector('.wl');
  await synced(page);
  assert.equal(await page.evaluate(() => location.hash), '', 'tokens are removed from the address bar');
  assert.equal(await page.evaluate(() => HWCloud.account().email), 'hero@example.com');
  // an expired access token is refreshed; a dead refresh token signs out without touching data
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('healthwiz_cloud')); c.ses.exp = 0; localStorage.setItem('healthwiz_cloud', JSON.stringify(c)); });
  await page.reload(); await page.waitForSelector('.wl'); await synced(page);
  assert.ok(S.calls.includes('POST /auth/v1/token'));
  delete S.users['hero@example.com']; S.users['x@y.z'] = { id: 'other', email: 'x@y.z' };
  await page.evaluate(() => { const c = JSON.parse(localStorage.getItem('healthwiz_cloud')); c.ses.exp = 0; localStorage.setItem('healthwiz_cloud', JSON.stringify(c)); });
  await page.reload(); await page.waitForSelector('.wl');
  await page.waitForFunction(() => !HWCloud.status().signed);
  await go(page, 'set');
  assert.match(await page.textContent('#v6acct'), /SIGN IN/);
  await page.click('[data-a="acin"]');
  const over = await page.evaluate(() => { const c = document.querySelector('#mo .card').getBoundingClientRect(); return document.documentElement.scrollWidth > innerWidth || c.right > innerWidth || c.left < 0; });
  assert.equal(over, false, 'no horizontal overflow at 360 px');
  assert.deepEqual(errors.filter(e => !/status of 400/.test(e)), [], 'only the refused refresh request is logged by the browser');
});
