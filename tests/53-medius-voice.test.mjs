// Medius's voice is the recorded lines only (tools/audio/cut_medius_voice.py): every registry question has a recording that
// matches its text, it plays once per question, the voice switch mutes it, and there is no browser (synthetic) speech anywhere.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { openApp, closeBrowser, go, RETURNING } from './helpers.mjs';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
// the app is opened from http here: browsers do not let a page fetch files when it is opened from disk
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const URL_ = 'http://127.0.0.1:' + srv.address().port + '/index.html';
after(async () => { srv.close(); await closeBrowser(); });

const hashOf = t => { let x = 5381; for (const c of t) x = ((x << 5) + x + c.charCodeAt(0)) >>> 0; return x.toString(36); };
const NAME = { d: { name: 'Aina', age: 19, sex: 'f', h: 160, w: 52, act: 1.55 } };
// the registry's places in the flow: six questions, the conditions question (6.5), the read-back, the plan, the account offer
const STEPS = [0, 1, 2, 3, 4, 5, 6.5, 6, 7, 8];
const spy = page => page.evaluate(() => { window.__aud = []; const A = window.Audio; window.Audio = function (s) { window.__aud.push(s); return new A(s); }; });
const step = (page, i) => page.evaluate(([i, o]) => { S.ob.d = o.d; S.ob.i = i; render(); return document.getElementById('obt').dataset.v; }, [i, NAME]);

test('every registry question has a recording that matches its text, and no stale ones are left', async () => {
  const { page, ctx, errors } = await openApp({ seed: RETURNING, url: URL_ });
  await go(page, 'onb');
  const want = new Set();
  for (const i of STEPS) {
    const v = await step(page, i);
    assert.ok(v, 'step ' + i + ' carries its template');
    const f = 'assets/audio/ob-' + hashOf(v) + '.mp3';
    assert.ok(fs.existsSync(path.join(root, f)), 'step ' + i + ' has no recording ' + f + ': run tools/audio/cut_medius_voice.py after editing a registry line');
    want.add(path.basename(f));
  }
  assert.equal(want.size, STEPS.length);
  assert.deepEqual(fs.readdirSync(path.join(root, 'assets/audio')).filter(f => /^ob-/.test(f)).sort(), [...want].sort(), 'no stale recordings');
  assert.deepEqual(errors.filter(e => !/AudioContext|autoplay|play\(\)/i.test(e)), []);
  await ctx.close();
});

test('a registry question plays its recording once; the next question plays the next; voice off is silent', async () => {
  const { page, ctx } = await openApp({ seed: RETURNING, url: URL_ });
  await spy(page);
  await go(page, 'onb');
  const v0 = await page.evaluate(() => document.getElementById('obt').dataset.v);
  await page.waitForTimeout(150);
  await page.evaluate(() => render()); await page.evaluate(() => render());          // the same question drawn again (a chip tap, an error)
  assert.deepEqual(await page.evaluate(() => window.__aud), ['assets/audio/ob-' + hashOf(v0) + '.mp3']);
  const v1 = await step(page, 1);
  assert.deepEqual(await page.evaluate(() => window.__aud.slice(1)), ['assets/audio/ob-' + hashOf(v1) + '.mp3']);
  await page.evaluate(() => { st.s.medv = 0; });
  await step(page, 2);
  assert.equal(await page.evaluate(() => window.__aud.length), 2, 'voice off plays nothing');
  await ctx.close();
});

test('no browser speech: bubbles and the tutorial never call speechSynthesis; settings offer only the on/off switch', async () => {
  for (const f of fs.readdirSync(path.join(root, 'js'))) assert.ok(!/speechSynthesis|SpeechSynthesisUtterance/.test(fs.readFileSync(path.join(root, 'js', f), 'utf8')), f + ' uses browser speech');
  const { page, ctx } = await openApp({ seed: RETURNING, url: URL_ });
  await go(page, 'home');
  await spy(page);
  await page.evaluate(() => { st.s.med = 2; window.__sp = 0; if (window.speechSynthesis) speechSynthesis.speak = () => { window.__sp++; }; HWMedius.say('level', { level: 3, name: 'Squire' }); });
  await page.waitForSelector('#v6md');
  assert.equal(await page.evaluate(() => window.__aud.length), 0, 'a speech bubble is silent');
  await page.evaluate(() => TUT.start());
  await page.waitForSelector('#tut');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__sp), 0);
  assert.equal(await page.evaluate(() => window.__aud.length), 1, 'the tutorial plays its recording');
  await page.tap('.tsk').catch(() => page.click('.tsk'));
  await go(page, 'set');
  assert.ok(await page.$('#v6medset [data-a="medv"]'), 'voice on/off is still there');
  assert.equal(await page.locator('#v6medset [data-a="medvn"]').count(), 0, 'the device-voice picker is gone');
  await ctx.close();
});
