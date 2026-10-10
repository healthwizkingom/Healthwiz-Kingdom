// Accounts (§74–76, §79, §83, §91): sign-in by email (magic link + 6-digit code) and Google (PKCE), the "What happens when
// you sign in" sheet, the user_data cloud copy, two devices, and the first-sign-in choice.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeBrowser, getBrowser, go, RETURNING, state, entry } from './helpers.mjs';
import { URL0, ANON, CLOUD, tok, fakeSupabase, device, st, synced, signIn, water } from './cloud-fake.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://localhost:' + server.address().port + '/';
});
after(async () => { await closeBrowser(); await new Promise(r => server.close(r)); });

test('signed out: local-only, no network; the ACCOUNT card; project checks refuse secret keys', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { cloud: null });
  const sent = [];
  page.on('request', r => { if (/supabase\.co/.test(r.url())) sent.push(r.url()); });
  await water(page);
  await go(page, 'set');
  const txt = await page.textContent('#v6acct');
  assert.match(txt, /ACCOUNT[\s\S]*Not signed in\. Everything is saved on this device only\.[\s\S]*SIGN IN/);
  assert.doesNotMatch(txt, /Password|password/, 'no password anywhere');
  assert.equal(await page.locator('#v6acct svg.pxi-account').count(), 1, 'pixel icon, not emoji');
  const order = await page.evaluate(() => { const h = document.querySelector('#main').innerHTML; return [h.indexOf('id="v6acct"'), h.indexOf('id="v6pwa"'), h.indexOf('id="bkp"')]; });
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2], 'card sits above App & Offline and Backup');
  const check = (u, k) => page.evaluate(([u, k]) => { const r = HWCloud.checkProject(u, k); return typeof r === 'string' ? r : 'ok ' + r.u; }, [u, k]);
  assert.match(await check(URL0, tok({ role: 'service_role' })), /secret \(service_role\) key[\s\S]*must never be put in an app/);
  assert.match(await check(URL0, 'sb_secret_abc'), /secret \(service_role\) key/);
  assert.match(await check('http://evil.example.com', ANON), /must start with https/);
  assert.equal(await check(URL0 + '/', 'sb_publishable_xyz'), 'ok ' + URL0);
  const src = fs.readFileSync(path.join(root, 'js/v6-cloud.js'), 'utf8').match(/const CFG=\{url:'([^']*)',key:'([^']*)'\}/);
  assert.ok(src, 'CFG is a plain url/key pair');
  if (src[1]) assert.match(await check(src[1], src[2]), /^ok https:\/\//, 'the built-in key is a publishable key, never a secret');
  // opening the sheet and closing it sends nothing either
  await page.click('[data-a="acin"]'); await page.click('[data-a="acx"]');
  assert.equal(await page.evaluate(() => localStorage.getItem('healthwiz_cloud')), null, 'nothing stored before sign-in');
  assert.deepEqual(S.calls, []); assert.deepEqual(sent, [], 'no request is made until the user signs in');
  assert.deepEqual(errors, []);
});

test('"What happens when you sign in": every point in plain language, the parent line under 18, then email with a code', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { seed: { ...RETURNING, p: { ...RETURNING.p, age: 16 }, e: [entry('water', 500, 1)], xp: 40 } });
  await go(page, 'set');
  await page.click('[data-a="acin"]');
  const why = await page.textContent('#mo');
  for (const re of [/WHAT HAPPENS WHEN YOU SIGN IN/, /backed up to the cloud and syncs across your devices/, /join the running leaderboard \(nickname only, as before\)/,
    /talk to Medius AI in the Wizard's Counsel/, /Health data stays private to your account; nobody else \(including other students\) can see it/,
    /Without an account, everything still works on this device only/, /How to delete everything:[\s\S]*DELETE ACCOUNT & CLOUD DATA/,
    /Ask a parent or guardian if you're unsure about creating an account\./]) assert.match(why, re);
  assert.equal(await page.locator('#mo [role="dialog"] svg.pxi').count() >= 7, true, 'each point has a pixel icon');
  assert.deepEqual(S.calls, [], 'reading the sheet sends nothing');
  await page.click('[data-a="acgo"]');
  await page.waitForSelector('[data-a="acgoogle"]');                       // the project has Google switched on
  await page.fill('#acem', 'not-an-email'); await page.click('[data-a="acmail"]');
  assert.match(await page.textContent('#mo .warn'), /valid email address/);
  await page.fill('#acem', 'hero@example.com'); await page.click('[data-a="acmail"]');
  await page.waitForSelector('#accode');
  assert.match(await page.textContent('#mo'), /CHECK YOUR EMAIL[\s\S]*hero@example\.com[\s\S]*code from the email/);
  assert.equal(S.mail.length, 1); assert.equal(S.mail[0].create, true, 'new students are signed up by the same email');
  await page.fill('#accode', '000000'); await page.click('[data-a="accode"]'); // (the browser logs this refused request)
  await page.waitForSelector('#mo .warn');
  assert.match(await page.textContent('#mo .warn'), /did not work/);
  await page.fill('#accode', S.mail[0].code); await page.click('[data-a="accode"]');
  await page.waitForFunction(() => HWCloud.status().signed);
  await synced(page);
  const uid = Object.values(S.users)[0].id;
  assert.deepEqual(S.rows[uid].data, await state(page), 'the cloud holds exactly the device save');
  assert.equal(await page.evaluate(() => document.getElementById('mo').hidden), true, 'the sheet closes after signing in');
  await go(page, 'set');
  assert.match(await page.textContent('#v6acct'), /SIGNED INhero@example\.com[\s\S]*SYNCSynced at \d\d:\d\d/);
  // a change is sent once, about 10 s later (a burst of logging is one write)
  const w0 = S.writes;
  await water(page, 300); await water(page, 200);
  await page.waitForTimeout(1500);
  assert.equal(S.writes, w0, 'not sent at once');
  assert.equal((await st(page)).waiting, true, 'a sync is scheduled');
  await page.evaluate(() => HWCloud.sync('user')); await synced(page);
  assert.equal(S.writes, w0 + 1); assert.equal(S.rows[uid].data.e.length, 3);
  const raw = await page.evaluate(() => localStorage.getItem('healthwiz'));
  assert.ok(!/access_token|refresh_token|r-u1|hero@example/.test(raw), 'no session or email in the save');
  assert.ok(!(await page.evaluate(() => bkJSON())).includes('r-u1'), 'backups carry no session');
  assert.deepEqual(await page.evaluate(() => window.__ev.slice(0, 2)), ['cloud:signed-in', 'cloud:synced:up']);
  // sign out keeps all data on the device, and only this device is signed out
  await go(page, 'set');
  await page.click('[data-a="acout"]');
  assert.equal((await state(page)).e.length, 3);
  assert.equal((await st(page)).signed, false);
  assert.equal(S.logout, 'local');
  assert.deepEqual(errors.filter(e => !/status of 403/.test(e)), [], 'only the wrong code is refused');
});

test('an adult does not see the parent line', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { seed: { ...RETURNING, p: { ...RETURNING.p, age: 20 } } });
  await go(page, 'set'); await page.click('[data-a="acin"]');
  assert.doesNotMatch(await page.textContent('#mo'), /parent or guardian/);
  assert.deepEqual(errors, []);
});

test('two devices: changes travel both ways and concurrent edits merge (adds, deletes, XP from both)', async () => {
  const S = fakeSupabase();
  const a = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 2), entry('sleep', 7, 2)], xp: 100 } });
  await signIn(a.page, S); await synced(a.page);
  const b = await device(S, { seed: { ...RETURNING } }); // empty device: takes the cloud data without asking
  await signIn(b.page, S);
  await synced(b.page);
  const sb = await state(b.page), xp0 = (await state(a.page)).xp;
  assert.equal(sb.e.length, 2); assert.equal(sb.xp, xp0);
  assert.deepEqual(await b.page.evaluate(() => window.__ev), ['cloud:signed-in', 'data:imported:cloud', 'cloud:synced:down']);
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
  // a write based on an old updated_at changes nothing: it is merged and retried, never forced
  S.race = 1;
  await a.page.evaluate(() => add('water', 100, {}, 'race'));
  await a.page.evaluate(() => HWCloud.sync('user')); await synced(a.page);
  assert.ok(S.rows[uid].data.e.some(x => x.n === 'race'));
  assert.deepEqual([...a.errors, ...b.errors], []);
});

test('first sign-in with data on both sides: KEEP THIS DEVICE\'S DATA / KEEP CLOUD DATA / MERGE; MERGE uses the backup rules', async () => {
  const S = fakeSupabase();
  const a = await device(S, { seed: { ...RETURNING, e: [entry('water', 500, 1)], xp: 60, b: { 'Tower Visitor': '2026-10-01' } } });
  await signIn(a.page, S); await synced(a.page);
  const b = await device(S, { seed: { ...RETURNING, e: [entry('food', 400, 1)], xp: 25, b: { 'First Meal': '2026-10-02' }, p: { ...RETURNING.p, name: 'Bee' } } });
  await signIn(b.page, S);
  await b.page.waitForFunction(() => HWCloud.status().choose);
  await b.page.waitForSelector('#mo [data-a="acmerge"]');
  const txt = await b.page.textContent('#mo');
  const xa = (await state(a.page)).xp, xb = (await state(b.page)).xp;
  assert.match(txt, new RegExp('THIS ACCOUNT ALREADY HAS DATA[\\s\\S]*THIS DEVICE1 entry · ' + xb + ' XP[\\s\\S]*CLOUD1 entry · ' + xa + ' XP'));
  assert.match(txt, /MERGE \(RECOMMENDED\)[\s\S]*KEEP THIS DEVICE'S DATA[\s\S]*KEEP CLOUD DATA/);
  assert.equal((await state(b.page)).e[0].c, 'food', 'nothing changes before the choice');
  await b.page.evaluate(() => HWCloud.sync('auto'));
  assert.equal((await st(b.page)).choose, true, 'automatic syncs wait for the choice');
  await b.page.click('#mo [data-a="acmerge"]'); await synced(b.page);
  const sb = await state(b.page);
  assert.deepEqual(sb.e.map(x => x.c).sort(), ['food', 'water'], 'every entry from both');
  assert.equal(sb.xp, Math.max(xa, xb), 'the larger XP, never double-counted (backup merge rule)');
  assert.ok(['First Meal', 'Tower Visitor'].every(k => k in sb.b), 'badges from both sides combined: ' + Object.keys(sb.b));
  assert.equal(sb.p.name, 'Bee', 'this device\'s profile stays');
  const bk = await b.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('healthwiz_backup_cloud_')).length);
  assert.equal(bk, 1, 'the replaced cloud copy is kept on this device');
  // a third device picks KEEP CLOUD DATA: its own data is kept as a backup first
  const c = await device(S, { seed: { ...RETURNING, e: [entry('stair', 30, 1)], xp: 5 } });
  await signIn(c.page, S);
  await c.page.waitForSelector('#mo [data-a="accloud"]');
  await c.page.click('#mo [data-a="accloud"]'); await synced(c.page);
  assert.deepEqual((await state(c.page)).e.map(x => x.c).sort(), ['food', 'water']);
  const kept = await c.page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('healthwiz_backup_cloud_')).map(k => JSON.parse(localStorage.getItem(k))));
  assert.equal(kept.length, 1); assert.equal(kept[0].e[0].c, 'stair', 'the replaced device data is kept');
  // a fourth keeps its own: the cloud copy is replaced and kept on that device
  const d = await device(S, { seed: { ...RETURNING, e: [entry('sleep', 8, 1)], xp: 7 } });
  await signIn(d.page, S);
  await d.page.waitForSelector('#mo [data-a="aclocal"]');
  await d.page.click('#mo [data-a="aclocal"]'); await synced(d.page);
  const uid = Object.values(S.users)[0].id;
  assert.deepEqual(S.rows[uid].data.e.map(x => x.c), ['sleep']);
  assert.deepEqual([...a.errors, ...b.errors, ...c.errors, ...d.errors], []);
});

test('Google sign-in uses PKCE and comes back signed in (served over http)', async () => {
  const S = fakeSupabase();
  const br = await getBrowser(), ctx = await br.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.route(/fonts\.googleapis|open-meteo|unpkg/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  let authorize = null;
  await ctx.route(URL0 + '/**', async route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/auth/v1/authorize') {     // Google says yes and Supabase sends the user back with a code
      authorize = u; S.pkce = { code: 'c0de', email: 'g@example.com', verifier: null };
      return route.fulfill({ status: 302, headers: { location: u.searchParams.get('redirect_to') + '?code=c0de' } });
    }
    if (u.pathname === '/auth/v1/token' && u.searchParams.get('grant_type') === 'pkce') {
      const b = JSON.parse(route.request().postData());
      const crypto = await import('node:crypto');
      const ch = crypto.createHash('sha256').update(b.code_verifier).digest('base64url');
      S.pkce.verifier = ch === authorize.searchParams.get('code_challenge') ? b.code_verifier : 'mismatch';
    }
    return S.handle(route);
  });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(([s, c]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); localStorage.setItem('healthwiz_cloud', c); sessionStorage.setItem('seeded', '1'); } }, [JSON.stringify({ ...RETURNING, s: { ...RETURNING.s, sound: 0 } }), CLOUD]);
  await page.goto(base);
  await page.waitForSelector('.wl');
  await page.evaluate(() => go('set'));
  await page.click('[data-a="acin"]'); await page.click('[data-a="acgo"]');
  await page.click('[data-a="acgoogle"]');
  await page.waitForFunction(() => typeof HWCloud !== 'undefined' && HWCloud.status().signed, null, { timeout: 20000 });
  assert.equal(authorize.searchParams.get('provider'), 'google');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
  assert.match(authorize.searchParams.get('redirect_to'), /^http:\/\/localhost:\d+\/$/);
  assert.equal(S.pkce.verifier !== 'mismatch' && !!S.pkce.verifier, true, 'the code verifier matches the challenge');
  assert.equal(new URL(page.url()).search, '', 'the code is removed from the address bar');
  assert.equal(await page.evaluate(() => HWCloud.account().via), 'google');
  assert.deepEqual(errors, []);
  await ctx.close();
});
