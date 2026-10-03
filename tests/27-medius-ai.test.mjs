// Medius's AI counsel (master prompt §39–42): the Wizard's Counsel asks supabase/functions/medius-chat (Gemini, key on
// the server) for signed-in players only. Runs against the fake Supabase in tests/cloud-fake.mjs.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeBrowser, go, openApp } from './helpers.mjs';
import { fakeSupabase, device, signUp, synced } from './cloud-fake.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const open = async page => { await go(page, 'stress'); await page.click('[data-a="csgo"]'); await page.click('[data-a="csskip"]'); await page.waitForSelector('#csin'); };
const say = async (page, text) => { const n = await page.locator('#cslog > *').count(); await page.fill('#csin', text); await page.click('[data-a="cssend"]'); await page.waitForFunction(n => document.querySelectorAll('#cslog > *').length >= n + 2 && !document.querySelector('#csin').disabled, n, { timeout: 10000 }); return page.textContent('#cslog'); };

test('signed out: no request is made, Medius explains how to open his spellbook, nothing is saved', async () => {
  const S = fakeSupabase();
  const { page, ctx, errors } = await device(S, { cloud: null });
  await open(page);
  assert.match(await page.textContent('#counsel'), /sent to Google's Gemini AI only to write his reply/, 'privacy note');
  const log = await say(page, 'I feel stressed about exams');
  assert.match(log, /signed in to Cloud Save.*Settings → Cloud Save.*Nothing you wrote was saved/s);
  assert.deepEqual(S.calls.filter(c => /medius/.test(c)), [], 'no AI request while signed out');
  assert.doesNotMatch(await page.evaluate(() => localStorage.getItem('healthwiz')), /stressed about exams/, 'chat never saved');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('signed in: replies come from the function with the conversation and name, never a key or persona from the app', async () => {
  const S = fakeSupabase();
  const { page, ctx, errors } = await device(S, { seed: undefined });
  await page.evaluate(() => { st.p.name = 'Aina'; save(); });
  await signUp(page); await synced(page);
  await open(page);
  let log = await say(page, 'Exams are coming');
  assert.match(log, /Medius hears thee, Aina: Exams are coming/);
  log = await say(page, 'And I am tired');
  assert.match(log, /Medius hears thee, Aina: And I am tired/);
  const sent = S.aiSent[S.aiSent.length - 1].body;
  assert.deepEqual(Object.keys(sent).sort(), ['messages', 'name'], 'only the name and the messages are sent');
  assert.deepEqual(sent.messages.map(m => m.role), ['user', 'assistant', 'user'], 'the conversation, starting with the player');
  assert.doesNotMatch(JSON.stringify(sent), /You are Wizard King Medius/, 'the persona lives on the server');
  const code = fs.readdirSync(path.join(root, 'js')).map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');
  assert.doesNotMatch(code, /AIza[0-9A-Za-z_-]{20,}|api\.anthropic\.com|generativelanguage\.googleapis/, 'no AI key or direct AI call in the app');
  assert.doesNotMatch(await page.evaluate(() => localStorage.getItem('healthwiz') + localStorage.getItem('healthwiz_cloud')), /Exams are coming/, 'chat never saved');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('daily allowance, free quota, missing key or setup, blocked and offline each say what happened', async () => {
  const S = fakeSupabase();
  const { page, ctx, errors } = await device(S);
  await signUp(page); await synced(page);
  await open(page);
  const cases = [['busy', /free spellbook needs a short rest/], ['nokey', /not set up on the server yet/], ['setup', /not set up on the server yet/], ['blocked', /could not answer that one.*Need help now/s]];
  for (const [mode, re] of cases) { S.ai = mode; assert.match(await say(page, 'hello ' + mode), re, mode); }
  S.ai = 'ok'; S.aiDaily = Object.values(S.aiUsed)[0];               // the next message is over the allowance
  assert.match(await say(page, 'one more'), /daily allowance of messages is used up/);
  S.down = true;
  assert.match(await say(page, 'anyone there?'), /could not get an answer|offline/);
  assert.equal(await page.locator('#cslog').evaluate(e => /Nothing you wrote was saved/.test(e.textContent)), true);
  assert.deepEqual(errors.filter(e => !/Failed to load resource/.test(e)), []);
  await ctx.close();
});

test('the Edge Function and its SQL are in the repository, keep the key server-side and only serve signed-in players', () => {
  const fn = fs.readFileSync(path.join(root, 'supabase/functions/medius-chat/index.ts'), 'utf8');
  const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261005000000_hw_medius.sql'), 'utf8');
  assert.match(fn, /Deno\.env\.get\(k\)/, 'key read from the function secrets');
  assert.match(fn, /\/auth\/v1\/user/, 'checks the player');
  assert.match(fn, /hw_medius_take/, 'daily allowance');
  assert.doesNotMatch(fn, /console\.(log|info)\(/, 'nothing is logged');
  assert.match(sql, /security definer/); assert.match(sql, /revoke all on function public\.hw_medius_take\(\) from public, anon/);
});
