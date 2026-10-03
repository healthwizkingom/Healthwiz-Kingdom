// Step 22 (§74–76, §79, §83, §91): Supabase cloud save — setup checks, sign-up, two devices, the first-sign-in choice.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { closeBrowser, go, RETURNING, state, entry } from './helpers.mjs';
import { URL0, ANON, tok, fakeSupabase, device, st, synced, signUp, water } from './cloud-fake.mjs';

after(closeBrowser);

test('built-in project, signed out: local-only, no network; project checks refuse secret keys', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { cloud: null });
  const sent = [];
  page.on('request', r => { if (/supabase\.co/.test(r.url())) sent.push(r.url()); });
  await water(page);
  await go(page, 'set');
  const txt = await page.textContent('#v6cl');
  assert.match(txt, /CLOUD SAVE[\s\S]*Sign in to back up your kingdom[\s\S]*Email[\s\S]*Password[\s\S]*SIGN IN[\s\S]*CREATE ACCOUNT/);
  assert.doesNotMatch(txt, /Connect a Supabase project|CHANGE/, 'the built-in project needs no setup by users');
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return [h.indexOf('id="v6cl"'), h.indexOf('id="v6pwa"'), h.indexOf('id="bkp"')]; });
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2], 'card sits above App & Offline and Backup');
  const check = (u, k) => page.evaluate(([u, k]) => { const r = HWCloud.checkProject(u, k); return typeof r === 'string' ? r : 'ok ' + r.u; }, [u, k]);
  assert.match(await check(URL0, tok({ role: 'service_role' })), /secret \(service_role\) key[\s\S]*must never be put in an app/);
  assert.match(await check(URL0, 'sb_secret_abc'), /secret \(service_role\) key/);
  assert.match(await check('http://evil.example.com', ANON), /must start with https/);
  assert.match(await check(URL0 + '/rest/v1', ANON), /Use only the project address/);
  assert.match(await check(URL0, 'hello'), /does not look like a publishable key/);
  assert.equal(await check(URL0 + '/', 'sb_publishable_xyz'), 'ok ' + URL0);
  const src = (await import('node:fs')).readFileSync(new URL('../js/v6-cloud.js', import.meta.url), 'utf8').match(/const CFG=\{url:'([^']*)',key:'([^']*)'\}/);
  assert.ok(src, 'CFG is a plain url/key pair');
  if (src[1]) assert.match(await check(src[1], src[2]), /^ok https:\/\//, 'the built-in key is a publishable key, never a secret');
  assert.equal(await page.evaluate(() => localStorage.getItem('healthwiz_cloud')), null, 'nothing stored before sign-in');
  assert.deepEqual(S.calls, []); assert.deepEqual(sent, [], 'no request is made until the user signs in');
  assert.deepEqual(errors, []);
});

test('sign up, first upload, every change synced; the session never enters the save or backups', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 1)], xp: 40 } });
  await signUp(page, 'bad', 'kingdom123');
  assert.match(await page.textContent('#v6cl'), /valid email address[\s\S]*Nothing on this device was changed/);
  await signUp(page, 'hero@example.com', 'short');
  assert.match(await page.textContent('#v6cl'), /at least 8 characters/);
  await signUp(page);
  await synced(page);
  const uid = Object.values(S.users)[0].id;
  assert.equal(S.rows[uid].rev, 1);
  assert.deepEqual(S.rows[uid].data, await state(page), 'the cloud holds exactly the device save');
  assert.match(await page.textContent('#v6cl'), /hero@example\.com[\s\S]*Synced just now/);
  await water(page, 300);
  await page.waitForFunction(() => HWCloud.status().rev === 2, null, { timeout: 15000 });
  assert.equal(S.rows[uid].data.e.length, 2);
  assert.equal(S.rows[uid].device.length > 0, true);
  const raw = await page.evaluate(() => localStorage.getItem('healthwiz'));
  assert.ok(!/access_token|refresh_token|r-u1|hero@example/.test(raw), 'no session or email in the save');
  assert.ok(!(await page.evaluate(() => bkJSON())).includes('r-u1'), 'backups carry no session');
  assert.deepEqual(await page.evaluate(() => window.__ev), ['cloud:signed-in', 'cloud:synced:up', 'cloud:synced:up']);
  // sign out keeps all data on the device
  await go(page, 'set');
  await page.click('[data-a="clout"]');
  assert.equal((await state(page)).e.length, 2);
  assert.equal((await st(page)).signed, false);
  assert.ok(S.calls.includes('POST /auth/v1/logout'));
  assert.deepEqual(errors, []);
});

test('two devices: changes travel both ways and concurrent edits merge (adds, deletes, XP from both)', async () => {
  const S = fakeSupabase();
  const a = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 2), entry('sleep', 7, 2)], xp: 100 } });
  await signUp(a.page); await synced(a.page);
  const b = await device(S, { seed: { ...RETURNING } }); // empty device: takes the cloud save without asking
  await signUp(b.page, 'hero@example.com', 'kingdom123', false);
  await synced(b.page);
  const sb = await state(b.page), xp0 = (await state(a.page)).xp;
  assert.equal(sb.e.length, 2); assert.equal(sb.xp, xp0);
  assert.deepEqual(await b.page.evaluate(() => window.__ev), ['cloud:signed-in', 'data:imported:cloud', 'cloud:synced:down']);
  // both devices change data before either syncs again
  const xpA = (await state(a.page)).xp, xpB = (await state(b.page)).xp;
  await a.page.evaluate(() => { gain(30, 'test'); add('water', 250, {}, 'from A', undefined, undefined, 0); });
  await b.page.evaluate(() => { const s = st.e.find(x => x.c === 'sleep'); st.e = st.e.filter(x => x !== s); gain(20, 'test'); add('pulse', 72, { st: 'Resting' }, 'from B', undefined, undefined, 0); });
  const dA = (await state(a.page)).xp - xpA, dB = (await state(b.page)).xp - xpB;
  await a.page.evaluate(() => HWCloud.sync('user')); await synced(a.page);
  await b.page.evaluate(() => HWCloud.sync('user')); await synced(b.page);
  await a.page.evaluate(() => HWCloud.sync('user')); await synced(a.page);
  const ea = (await state(a.page)).e.map(x => x.n || x.c).sort(), eb = (await state(b.page)).e.map(x => x.n || x.c).sort();
  assert.deepEqual(ea, ['from A', 'from B', 'water'], 'A: both adds kept, B\'s delete carried over');
  assert.deepEqual(eb, ea, 'both devices agree');
  const uid = Object.values(S.users)[0].id, xpEnd = (await state(a.page)).xp;
  assert.ok(dA >= 30 && dB >= 20);
  assert.equal(xpEnd, xp0 + dA + dB, 'XP gained on both devices adds up');
  assert.equal((await state(b.page)).xp, xpEnd); assert.equal(S.rows[uid].data.xp, xpEnd);
  const kept = await b.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('healthwiz_backup_cloud_')).map(k => JSON.parse(localStorage.getItem(k))));
  assert.equal(kept.length, 1, 'B removed an entry from the cloud, so the previous cloud copy is kept on B');
  assert.ok(kept[0].e.some(x => x.c === 'sleep'));
  // a write that loses the race is merged and retried, not forced
  S.race = 1;
  await a.page.evaluate(() => add('water', 100, {}, 'race'));
  await a.page.evaluate(() => HWCloud.sync('user')); await synced(a.page);
  assert.ok(S.rows[uid].data.e.some(x => x.n === 'race'));
  assert.deepEqual([...a.errors, ...b.errors], []);
});

test('first sign-in with data on both sides: the user chooses, and the replaced side is kept as a backup', async () => {
  const S = fakeSupabase();
  const a = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 1)], xp: 60 } });
  await signUp(a.page); await synced(a.page);
  const b = await device(S, { seed: { ...RETURNING, e: [entry('food', 400, 1)], xp: 25 } });
  await signUp(b.page, 'hero@example.com', 'kingdom123', false);
  await b.page.waitForFunction(() => HWCloud.status().choose);
  const txt = await b.page.textContent('#v6cl');
  const xa = (await state(a.page)).xp, xb = (await state(b.page)).xp;
  assert.match(txt, new RegExp('already has a cloud save[\\s\\S]*CLOUD1 entry · ' + xa + ' XP · saved just now[\\s\\S]*THIS DEVICE1 entry · ' + xb + ' XP'));
  assert.match(txt, /MERGE BOTH[\s\S]*USE CLOUD SAVE[\s\S]*KEEP THIS DEVICE/);
  assert.equal((await state(b.page)).e[0].c, 'food', 'nothing changes before the choice');
  await b.page.evaluate(() => HWCloud.sync('auto'));
  assert.equal((await st(b.page)).choose, true, 'automatic syncs wait for the choice');
  await b.page.click('[data-a="clmerge"]'); await synced(b.page);
  const sb = await state(b.page);
  assert.deepEqual(sb.e.map(x => x.c).sort(), ['food', 'water']);
  assert.ok(sb.xp >= Math.max(xa, xb) && sb.xp < xa + xb, 'no shared history: XP takes the larger side, never double-counted');
  // a third device picks USE CLOUD SAVE: its own data is stashed first
  const c = await device(S, { seed: { ...RETURNING, e: [entry('stair', 30, 1)], xp: 5 } });
  await signUp(c.page, 'hero@example.com', 'kingdom123', false);
  await c.page.waitForFunction(() => HWCloud.status().choose);
  await c.page.click('[data-a="clcloud"]'); await synced(c.page);
  assert.deepEqual((await state(c.page)).e.map(x => x.c).sort(), ['food', 'water']);
  const bk = await c.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('healthwiz_backup_cloud_')).map(k => JSON.parse(localStorage.getItem(k))));
  assert.equal(bk.length, 1); assert.equal(bk[0].e[0].c, 'stair', 'the replaced device data is kept');
  assert.deepEqual([...a.errors, ...b.errors, ...c.errors], []);
});
