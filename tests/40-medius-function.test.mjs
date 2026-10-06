// The medius-chat Edge Function (supabase/functions/medius-chat): the same persona as the game's system prompt, one model
// constant, signed-in only, and no AI key or direct AI call left in the app. Runs the Deno unit tests when Deno is installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const fn = read('supabase/functions/medius-chat/index.ts');

test('the persona is the Wizard\'s Counsel system prompt (CSP) + staying on topic + the mood tags; one model constant', () => {
  const csp = read('js/hw-05-v5-4-module.js').match(/const CSP=\(\)=>"([^"]+)"\+\(\(st\.p\.name\|\|''\)\.trim\(\)\.slice\(0,20\)\|\|'traveller'\)\+"([^"]+)";/);
  assert.ok(csp, 'CSP() found');
  const per = fn.match(/const persona = \(name: string\) => "([^"]+)" \+ name \+ "([^"]+)";/);
  assert.ok(per, 'persona found');
  assert.equal(per[1], csp[1], 'same opening');
  const STAY = " Stay on wellbeing and the player's day: if asked for unrelated work (homework answers, code, essays), kindly steer back.";
  assert.equal(per[2].replace(STAY, ''), csp[2], 'same text, plus one line about staying on wellbeing');
  assert.match(fn, /const MOOD_RULE = '[^']*\[mood:calm\] \[mood:smile\] \[mood:concerned\] \[mood:thinking\] \[mood:encourage\] \[mood:gesture\] \[mood:chuckle\]/);
  assert.match(fn, /never a smile or a chuckle/);
  assert.equal((fn.match(/gemini-[0-9][\w.-]*/g) || []).length, 1, 'the model is named once');
  assert.match(fn, /const MODEL = 'gemini-3\.5-flash-lite';/);
  assert.match(fn, /Deno\.env\.get\('GEMINI_API_KEY'\)/);
  assert.match(fn, /const HOUR_LIMIT = 30, DAY_LIMIT = 100;/);
  assert.match(read('supabase/config.toml'), /\[functions\.medius-chat\]\s*\nverify_jwt = true/);
  assert.doesNotMatch(fn, /console\.log\([^)]*(messages|content|reply|text|name)\b/, 'logs carry counts only');
});

test('no AI key and no direct AI call anywhere in the app', () => {
  const files = ['index.html', 'sw.js', ...fs.readdirSync(path.join(root, 'js')).map(f => 'js/' + f)];
  for (const f of files) {
    const s = read(f);
    assert.doesNotMatch(s, /AIza[0-9A-Za-z_-]{20,}/, f + ': Google API key');
    assert.doesNotMatch(s, /generativelanguage\.googleapis|api\.anthropic\.com|x-goog-api-key|x-api-key/i, f + ': direct AI call');
  }
  assert.match(read('js/hw-05-v5-4-module.js'), /HWCounsel\.ask\(msgs,c\.help\)/);
  assert.match(read('js/v6-counsel.js'), /\/functions\/v1\/medius-chat/);
});

test('Deno unit tests of the function (skipped when Deno is not installed)', t => {
  const has = spawnSync('deno', ['--version']).status === 0;
  if (!has) return t.skip('deno not installed');
  const out = execFileSync('deno', ['test', '--no-lock', '--allow-env', 'supabase/tests/medius-chat.test.ts'], { cwd: root, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  assert.match(out, /ok \| 6 passed \| 0 failed/);
});
