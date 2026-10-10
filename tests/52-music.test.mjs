// Default music: the recorded theme plays on the title screen / Home / other pages, the original generated melodies
// still play on Sleep, Water, Stress, Counsel and the registry; the music button and volume still rule; fallback works.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { openApp, closeBrowser, go, RETURNING } from './helpers.mjs';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webmanifest': 'application/json' };
// the app is opened from http here: browsers do not let a page fetch files when it is opened from disk
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); fs.readFile(f, (e, d) => e ? (r.writeHead(404), r.end()) : (r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }), r.end(d))); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const URL_ = 'http://127.0.0.1:' + srv.address().port + '/index.html';
after(async () => { srv.close(); await closeBrowser(); });
const st = page => page.evaluate(() => ({ ...HWMusic.state(), mt: !!MT, mk: MK }));
const until = async (page, f, ms = 6000) => { const t = Date.now(); for (;;) { const s = await st(page); if (f(s)) return s; if (Date.now() - t > ms) return s; await page.waitForTimeout(100); } };

test('the theme file exists, is a modest size, and is precached', () => {
  const f = 'assets/audio/home-theme.mp3', size = fs.statSync(new URL('../' + f, import.meta.url)).size;
  assert.ok(size > 100e3 && size < 1.5e6, 'size ' + size);
  assert.match(fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8'), /assets\/audio\/home-theme\.mp3/);
});

test('recorded theme on Home; original generated track on Sleep; off with the button; volume follows the slider', async () => {
  const { page, ctx, errors } = await openApp({ seed: RETURNING, url: URL_ });
  await go(page, 'home');
  await page.click('#mus');
  let s = await until(page, x => x.playing);
  assert.ok(s.mt && s.mk === 'home' && s.loaded && s.playing, JSON.stringify(s));
  await go(page, 'sleep');
  s = await until(page, x => !x.playing);
  assert.ok(s.mk === 'sleep' && !s.playing, 'Sleep keeps its own generated melody: ' + JSON.stringify(s));
  await go(page, 'food');
  s = await until(page, x => x.playing);
  assert.ok(s.playing, 'any other page plays the recording again');
  await page.click('#mus');
  s = await until(page, x => !x.playing);
  assert.ok(!s.mt && !s.playing, 'the music button switches it off: ' + JSON.stringify(s));
  assert.deepEqual(errors.filter(e => !/AudioContext|autoplay/i.test(e)), []);
  await ctx.close();
});

test('if the recording cannot load, the original home tune plays instead', async () => {
  const { page, ctx } = await openApp({ seed: RETURNING, url: URL_ });
  await page.route('**/assets/audio/home-theme.mp3', r => r.abort());
  await go(page, 'home');
  await page.click('#mus');
  const s = await until(page, x => x.failed);
  assert.ok(s.failed && !s.playing && s.mt, JSON.stringify(s));
  await ctx.close();
});

const hashOf = t => { let x = 5381; for (const c of t) x = ((x << 5) + x + c.charCodeAt(0)) >>> 0; return x.toString(36); };

test('every tutorial line has a recording that matches its text, and the tutorial plays it', async () => {
  const { page, ctx, errors } = await openApp({ seed: RETURNING, url: URL_ });
  const lines = await page.evaluate(() => TS.map(s => s[2]));
  const missing = lines.filter(t => !fs.existsSync(path.join(root, 'assets/audio/tut-' + hashOf(t) + '.mp3')));
  assert.deepEqual(missing, [], 'run tools/audio/make_tutorial_voice.py after editing a tutorial line');
  assert.equal(fs.readdirSync(path.join(root, 'assets/audio')).filter(f => /^tut-/.test(f)).length, lines.length, 'no stale recordings');
  const got = [];
  page.on('response', r => { if (/tut-[\w]+\.mp3/.test(r.url())) got.push([r.url(), r.status()]); });
  await page.evaluate(() => TUT.start());
  await page.waitForSelector('#tut');
  await page.waitForTimeout(1200);
  assert.ok(got.some(([u, s]) => u.includes('tut-' + hashOf(lines[0]) + '.mp3') && s === 200), 'the first step fetches its recording: ' + JSON.stringify(got));
  await page.tap('.tsk').catch(() => page.click('.tsk'));
  assert.deepEqual(errors.filter(e => !/AudioContext|autoplay|play\(\)/i.test(e)), []);
  await ctx.close();
});
