// Talk with Luna (js/v6-luna.js): the chat in the Ask Luna panel, through the luna-chat Edge Function
// (supabase/functions/luna-chat). Signed out: no message box and nothing sent. Signed in: the session goes to luna-chat,
// replies show, crisis words bring the help numbers, errors are friendly, nothing is saved. Also: no AI key or direct
// xAI call in the app, and the function's Deno tests when Deno is installed.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { closeBrowser, go, state } from './helpers.mjs';
import { fakeSupabase, device, synced, signIn } from './cloud-fake.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const openLuna = async page => { await go(page, 'home'); await page.evaluate(() => HWLuna.open()); await page.waitForSelector('#mo .v6lp #v6lchat'); };

test('signed out: "Sign in to talk with Luna", no message box, the AI note, and nothing sent', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { cloud: null });
  const sent = []; page.on('request', r => { if (/supabase\.co|x\.ai/.test(r.url())) sent.push(r.url()); });
  await openLuna(page);
  const t = await page.textContent('#v6lchat');
  assert.match(t, /TALK WITH LUNA[\s\S]*Sign in to talk with Luna[\s\S]*SIGN IN TO TALK WITH LUNA/);
  assert.match(t, /written by an AI \(Grok by xAI\)\. She is not a doctor/);
  assert.equal(await page.locator('#v6lcin').count(), 0, 'no message box while signed out');
  await page.click('[data-a="lunasign"]');
  assert.match(await page.textContent('#mo'), /WHAT HAPPENS WHEN YOU SIGN IN/);
  assert.deepEqual(sent, []);
  assert.deepEqual(errors, []);
});

test('signed in: the message goes to luna-chat with the session, the reply shows, crisis words bring the help numbers, nothing is saved', async () => {
  const S = fakeSupabase();
  S.lunaReply = last => /die/.test(last) ? 'I am so glad you told me. Please reach out now.' : 'Hello, Tester! A sip of water is a fine spell.';
  const { page, errors } = await device(S, { viewport: { width: 1000, height: 1100 } });
  const reqs = []; page.on('request', r => { if (/functions\/v1\/luna-chat/.test(r.url()) && r.method() === 'POST') reqs.push({ h: r.headers(), b: JSON.parse(r.postData()) }); });
  await signIn(page, S); await synced(page);
  const before = JSON.stringify(await state(page));
  await openLuna(page);
  assert.equal(await page.locator('#v6lcin').count(), 1, 'the message box appears when signed in');
  await page.fill('#v6lcin', 'How much water today?');
  await page.press('#v6lcin', 'Enter');
  await page.waitForFunction(() => document.querySelectorAll('#v6lclog .v6lcm.a').length === 1);
  let t = await page.textContent('#v6lclog');
  assert.match(t, /You[\s\S]*How much water today\?[\s\S]*Luna[\s\S]*A sip of water is a fine spell\./);
  assert.equal(reqs.length, 1);
  assert.match(reqs[0].h.authorization, /^Bearer .+\..+\..+/, 'the player\'s session');
  assert.deepEqual(reqs[0].b.messages, [{ role: 'user', content: 'How much water today?' }]);
  assert.equal(await page.locator('#v6lchat .cshelp').count(), 0, 'no crisis box for an ordinary message');
  // the conversation history goes with the next message
  await page.fill('#v6lcin', 'I want to die');
  await page.click('[data-a="lunasend"]');
  await page.waitForFunction(() => document.querySelectorAll('#v6lclog .v6lcm.a').length === 2);
  assert.equal(reqs[1].b.messages.length, 3);
  assert.match(await page.textContent('#v6lchat .cshelp'), /999[\s\S]*03-7627 2929[\s\S]*15999/, 'help numbers');
  // nothing is saved: the saved data is unchanged and CLEAR CHAT empties the log
  assert.equal(JSON.stringify(await state(page)), before);
  await page.click('[data-a="lunaclear"]');
  assert.equal(await page.locator('#v6lclog .v6lcm').count(), 0);
  assert.deepEqual(errors, []);
});

test('errors are friendly and keep what the player typed: limit, server not set up, AI failure', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S);
  await signIn(page, S); await synced(page);
  await openLuna(page);
  for (const [status, body, re] of [[429, { error: 'limit', scope: 'hour', retry: 600 }, /Luna needs a short rest\. Try again in about 10 minutes\./],
    [503, { error: 'nokey' }, /not set up on the server yet/], [502, { error: 'ai' }, /could not find an answer just now/]]) {
    S.lunaStatus = status; S.lunaBody = body;
    await page.fill('#v6lcin', 'Hello Luna');
    await page.click('[data-a="lunasend"]');
    await page.waitForSelector('#v6lchat .v6lce');
    assert.match(await page.textContent('#v6lchat .v6lce'), re);
    assert.match(await page.textContent('#v6lchat .v6lce'), /Nothing you wrote was saved\./);
    assert.equal(await page.inputValue('#v6lcin'), 'Hello Luna', 'the message stays in the box');
    assert.equal(await page.locator('#v6lclog .v6lcm').count(), 0, 'a failed message is not left in the log');
  }
  // the browser's own line for each answer the fake server failed on purpose; anything else is a real error
  assert.deepEqual(errors.filter(e => !/Failed to load resource: the server responded with a status of (429|503|502)/.test(e)), []);
});

test('the phone layout: the chat fits a 360 px screen without sideways scrolling', async () => {
  const S = fakeSupabase();
  const { page, errors } = await device(S, { viewport: { width: 360, height: 760 } });
  await signIn(page, S); await synced(page);
  await openLuna(page);
  await page.fill('#v6lcin', 'Hi'); await page.click('[data-a="lunasend"]');
  await page.waitForFunction(() => document.querySelectorAll('#v6lclog .v6lcm.a').length === 1);
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, box: document.querySelector('#v6lchat').getBoundingClientRect().right, send: document.querySelector('[data-a="lunasend"]').getBoundingClientRect() }));
  assert.ok(w.doc <= 360, 'no sideways scroll: ' + w.doc);
  assert.ok(w.box <= 360, 'the chat stays on screen');
  assert.ok(w.send.height >= 44 && w.send.right <= 360, 'SEND is a full-size tap target on screen');
  // the feature rows below stay inside the panel (the row icon once took the figure's width: 100% and pushed them off)
  const rows = await page.evaluate(() => { const card = document.querySelector('#mo .v6lp').getBoundingClientRect().right;
    return [...document.querySelectorAll('#mo .v6lf')].map(f => [f.querySelector('.v6lfi').getBoundingClientRect().width, Math.round(f.querySelector('button').getBoundingClientRect().right - card)]); });
  assert.ok(rows.length > 0);
  for (const [icon, past] of rows) { assert.ok(icon <= 40, 'row icon keeps its size: ' + icon); assert.ok(past <= 0, 'GO inside the panel: ' + past); }
  assert.deepEqual(errors, []);
});

test('the function: one model constant, the key only on the server, sign-in required; no xAI key or call in the app', () => {
  const fn = read('supabase/functions/luna-chat/index.ts');
  assert.equal((fn.match(/grok-[0-9][\w.-]*/g) || []).length, 1, 'the model is named once');
  assert.match(fn, /Deno\.env\.get\('XAI_API_KEY'\)/);
  assert.match(read('supabase/config.toml'), /\[functions\.luna-chat\]\s*\nverify_jwt = true/);
  assert.doesNotMatch(fn, /console\.log\([^)]*(messages|content|reply|text|name)\b/, 'logs carry counts only');
  for (const f of ['index.html', 'sw.js', ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f)]) {
    const s = read(f);
    assert.doesNotMatch(s, /xai-[0-9A-Za-z]{20,}/, f + ': xAI key');
    assert.doesNotMatch(s, /api\.x\.ai/, f + ': direct xAI call');
  }
  assert.match(read('js/v6-luna.js'), /\/functions\/v1\/luna-chat/);
});

test('Deno unit tests of luna-chat (skipped when Deno is not installed)', t => {
  const has = spawnSync('deno', ['--version']).status === 0;
  if (!has) return t.skip('deno not installed');
  const out = execFileSync('deno', ['test', '--no-lock', '--allow-env', 'supabase/tests/luna-chat.test.ts'], { cwd: root, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.match(out, /ok \| 8 passed \| 0 failed/);
});
