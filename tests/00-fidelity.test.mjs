// Guards "never remove an existing feature": the app may now be edited on purpose,
// but the original markup/stylesheet stay identical and no original top-level
// function, constant, page or action may disappear.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const req = createRequire(import.meta.url);
let acorn; try { acorn = req('acorn'); } catch { acorn = req('/opt/node-tools/node_modules/acorn'); }

const orig = read('legacy/HealthWiz_Kingdom_5-4-3.html');
const oOpen = orig.indexOf('<script>'), oClose = orig.lastIndexOf('</script>');
const idx = read('index.html');
const scripts = [...idx.matchAll(/<script src="(js\/[\w.-]+\.js)"><\/script>/g)].map(m => m[1]);

function inventory(code) {
  const names = new Set();
  for (const n of acorn.parse(code, { ecmaVersion: 'latest' }).body) {
    if (n.type === 'FunctionDeclaration') names.add('fn ' + n.id.name);
    if (n.type === 'VariableDeclaration') n.declarations.forEach(d => d.id.name && names.add('var ' + d.id.name));
  }
  for (const m of code.matchAll(/\b(pages|acts|INP|CH)\.(\w+)\s*=/g)) names.add(m[1] + '.' + m[2]);
  return names;
}

test('markup and stylesheet are byte-identical to the original', () => {
  assert.equal(idx.slice(0, idx.indexOf('<script src=')), orig.slice(0, oOpen).replace(/\n?$/, '\n'));
});

test('no original function, constant, page or action has been removed', () => {
  const before = inventory(orig.slice(oOpen + 8, oClose));
  const after = inventory(scripts.map(read).join('\n'));
  const missing = [...before].filter(n => !after.has(n));
  assert.deepEqual(missing, []);
  assert.ok(before.size > 300, 'inventory sanity: ' + before.size);
});

test('load order: original parts in sequence, v6 additions in their slots, files ≤ 64 KB', () => {
  const extra = scripts.filter(f => !/js\/hw-/.test(f));
  assert.ok(extra.every(f => /^js\/v6-[\w-]+\.js$/.test(f)), 'only v6 add-ons besides the original: ' + extra);
  const lastHw = scripts.findIndex(f => /hw-06/.test(f));
  assert.ok(extra.filter(f => f !== 'js/v6-schema.js').every(f => scripts.indexOf(f) > lastHw), 'add-ons load after the original modules');
  assert.equal(scripts[1], 'js/v6-schema.js', 'schema loads before core reads storage');
  assert.equal(scripts.at(-2), 'js/v6-safety.js', 'safety wraps pages just before boot');
  const hw = scripts.filter(f => /js\/hw-/.test(f));
  assert.deepEqual(hw, [...hw].sort());
  for (const f of fs.readdirSync(path.join(root, 'js'))) assert.ok(fs.statSync(path.join(root, 'js', f)).size < 64 * 1024, f);
});
