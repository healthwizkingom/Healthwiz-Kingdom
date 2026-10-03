// Step 21 (§73–74): manifest, icons, service worker, offline use, install prompt and the offline badge.
// Service workers need http(s), so the "served" tests start a small static server on localhost.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBrowser, closeBrowser, openApp, go, RETURNING } from './helpers.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', webmanifest: 'application/manifest+json', png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', css: 'text/css' };
let server, base;
before(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const f = path.join(root, path.normalize(p));
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://localhost:' + server.address().port + '/';
});
after(async () => { await closeBrowser(); await new Promise(r => server.close(r)); });

const precache = () => { const s = read('sw.js'); return JSON.parse('[' + s.slice(s.indexOf('const PRECACHE = [') + 18, s.indexOf('];', s.indexOf('const PRECACHE'))).replace(/'/g, '"').replace(/,\s*$/, '') + ']'); };
const pngSize = f => { const b = fs.readFileSync(path.join(root, f)); assert.equal(b.toString('hex', 0, 8), '89504e470d0a1a0a', f + ' is a PNG'); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };

test('the service worker pre-caches every app file, and every listed file exists', () => {
  const list = precache();
  const scripts = [...read('index.html').matchAll(/<script src="(js\/[\w.-]+\.js)"><\/script>/g)].map(m => m[1]);
  const assets = ['img', 'icons'].flatMap(d => fs.readdirSync(path.join(root, 'assets', d)).map(f => 'assets/' + d + '/' + f));
  for (const f of [...scripts, ...assets, 'index.html', 'manifest.webmanifest', './']) assert.ok(list.includes(f), 'sw.js PRECACHE is missing ' + f);
  for (const f of list) if (f !== './') assert.ok(fs.existsSync(path.join(root, f)), 'PRECACHE lists a missing file: ' + f);
  assert.equal(new Set(list).size, list.length, 'no duplicates');
  assert.deepEqual(scripts.filter(f => list.indexOf(f) < 0), []);
});

test('manifest: standalone, colours, scope and icons that exist at their stated sizes', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
  assert.ok(m.name && m.short_name.length <= 12);
  for (const i of m.icons) assert.equal(pngSize(i.src), i.sizes, i.src);
  assert.ok(m.icons.some(i => i.purpose === 'maskable'), 'a maskable icon');
  assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'));
  assert.equal(pngSize('assets/icons/apple-touch-icon.png'), '180x180');
});

test('opened from a file: no manifest, no service worker, settings explain it already works offline', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl');
  assert.equal(await page.locator('link[rel="manifest"]').count(), 0);
  const st = await page.evaluate(() => HWPwa.status());
  assert.equal(st.sw, 'off');
  await go(page, 'set');
  const t = await page.textContent('#v6pwa');
  assert.match(t, /APP & OFFLINE/);
  assert.match(t, /Opened from a file/);
  // the card sits just above Backup & Restore
  assert.ok(await page.evaluate(() => document.getElementById('v6pwa').nextElementSibling.id === 'bkp'));
  assert.deepEqual(errors, []);
  await ctx.close();
});

async function served(viewport) {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: viewport || { width: 1100, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(s => { if (!localStorage.getItem('healthwiz')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); } }, JSON.stringify(RETURNING));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(base);
  await page.waitForSelector('.wl');
  return { page, ctx, errors };
}

test('served over http://localhost: installable links, offline copy, works with the network off', async () => {
  const { page, ctx, errors } = await served();
  assert.equal(await page.getAttribute('link[rel="manifest"]', 'href'), 'manifest.webmanifest');
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').count(), 1);
  await page.waitForFunction(() => HWPwa.status().sw === 'ready', null, { timeout: 15000 });
  assert.equal(await page.evaluate(() => HWEvents.recent('app:offline-ready').at(-1).first), true);
  const cached = await page.evaluate(async () => (await (await caches.open('hwk-shell-v1')).keys()).length);
  assert.ok(cached >= 50, 'whole shell cached: ' + cached);
  await page.reload();
  await page.waitForSelector('.wl');
  assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller), 'page is controlled after reload');
  await page.waitForFunction(() => HWPwa.status().sw === 'ready');
  assert.equal(await page.evaluate(() => HWEvents.recent('app:offline-ready').at(-1).first), false, 'only the first save is announced');

  // offline: the event, the badge, Medius's rule, settings
  await page.evaluate(() => { window.__net = []; HWEvents.on('network:changed', e => __net.push(e.online)); });
  await ctx.setOffline(true);
  await page.waitForSelector('#v6net');
  assert.match(await page.textContent('#v6net'), /OFFLINE/);
  assert.deepEqual(await page.evaluate(() => __net), [false]);
  assert.ok(await page.evaluate(() => !!HWMedius.rules.offline));

  // a full reload with no network still opens the app, and logging still saves
  await page.reload();
  await page.waitForSelector('.wl');
  assert.match(await page.textContent('#v6net'), /OFFLINE/);
  await page.evaluate(() => go('water'));
  await page.click('[data-a="wa"][data-v="250"]');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz')));
  assert.equal(st.e.at(-1).v, 250);
  await page.evaluate(() => go('set'));
  assert.match(await page.textContent('#v6pwa'), /Offline\. Logging/);
  assert.match(await page.textContent('#v6pwa'), /Ready\. HealthWiz opens/);
  // a page that was never fetched before is still served from the pre-cache
  const img = await page.evaluate(() => fetch('assets/img/orc.png').then(r => r.status));
  assert.equal(img, 200);

  await ctx.setOffline(false);
  await page.waitForSelector('#v6net', { state: 'detached' });
  assert.deepEqual(errors.filter(e => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e)), []);
  await ctx.close();
});

test('install button appears with the browser prompt, and the prompt is used once', async () => {
  const { page, ctx, errors } = await served();
  await page.evaluate(() => go('set'));
  assert.doesNotMatch(await page.textContent('#v6pwa'), /INSTALL HEALTHWIZ/);
  await page.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); window.__asked = 0; e.prompt = () => { __asked++; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); dispatchEvent(e); });
  await page.click('[data-a="pwainst"]');
  assert.equal(await page.evaluate(() => __asked), 1);
  assert.equal(await page.locator('[data-a="pwainst"]').count(), 0, 'one-shot prompt');
  const fired = await page.evaluate(() => { let n = 0; HWEvents.on('app:installed', () => n++); dispatchEvent(new Event('appinstalled')); return n; });
  assert.equal(fired, 1);
  assert.match(await page.textContent('#v6pwa'), /Running as an installed app/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('offline badge fits a 360 px screen', async () => {
  const { page, ctx } = await served({ width: 360, height: 800 });
  await ctx.setOffline(true);
  await page.waitForSelector('#v6net');
  const r = await page.evaluate(() => { const b = document.getElementById('v6net').getBoundingClientRect(); return { l: b.left, r: b.right, w: document.documentElement.scrollWidth }; });
  assert.ok(r.l >= 0 && r.r <= 360 && r.w <= 360, JSON.stringify(r));
  await ctx.setOffline(false);
  await ctx.close();
});
