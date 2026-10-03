// Guards "preserve the original": the split files + extracted images must reassemble
// into exactly the code of legacy/HealthWiz_Kingdom_5-4-3.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const MIME = { webp: 'webp', png: 'png', jpg: 'jpeg' };
const inline = s => s.replace(/assets\/img\/([\w-]+)\.(webp|png|jpg)/g, (_, n, e) =>
  `data:image/${MIME[e]};base64,` + fs.readFileSync(path.join(root, 'assets/img', `${n}.${e}`)).toString('base64'));
const squash = s => s.replace(/\n+/g, '\n').trim();

const orig = read('legacy/HealthWiz_Kingdom_5-4-3.html');
const oOpen = orig.indexOf('<script>'), oClose = orig.lastIndexOf('</script>');

test('markup and stylesheet are byte-identical to the original', () => {
  const idx = read('index.html');
  assert.equal(idx.slice(0, idx.indexOf('<script src=')), orig.slice(0, oOpen).replace(/\n?$/, '\n'));
});

test('original script is reproduced exactly by js/hw-*.js + assets/img', () => {
  const idx = read('index.html');
  const files = [...idx.matchAll(/<script src="(js\/hw-[\w.-]+\.js)"><\/script>/g)].map(m => m[1]);
  assert.ok(files.length >= 5);
  const joined = files.map(f => read(f).split('\n').slice(1).join('\n')).join('\n');
  assert.equal(squash(inline(joined)), squash(orig.slice(oOpen + 8, oClose)));
});

test('only js/v6-safety.js is added, and no generated file exceeds 64 KB', () => {
  const idx = read('index.html');
  const extra = [...idx.matchAll(/<script src="(js\/[\w.-]+\.js)"><\/script>/g)].map(m => m[1]).filter(f => !/js\/hw-/.test(f));
  assert.deepEqual(extra, ['js/v6-safety.js']);
  for (const f of fs.readdirSync(path.join(root, 'js'))) assert.ok(fs.statSync(path.join(root, 'js', f)).size < 64 * 1024, f + ' too large');
});
