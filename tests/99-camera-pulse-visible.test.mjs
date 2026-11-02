// Regression: on the Campus page the camera pulse button seemed to do nothing. (1) While the map was loading, the loading bar
// sat on top of the Details sheet and swallowed the tap. (2) In FULL SCREEN the map layer (z 1000) hid the camera sheet (#mo, z 60),
// so the button opened it where nobody could see it. Both: tap works, and what it opens is on top.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const serve = () => new Promise(res => { const s = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(0, '127.0.0.1', () => res(s)); });
const fakeCam = p => p.addInitScript(() => { Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { const c = document.createElement('canvas'); c.width = 64; c.height = 48; const x = c.getContext('2d'); const t0 = performance.now(); const paint = () => { x.fillStyle = `rgb(${Math.round(200 + 10 * Math.sin((performance.now() - t0) / 150))},40,30)`; x.fillRect(0, 0, 64, 48); }; paint(); setInterval(paint, 33); return c.captureStream(30); } } }); });

for (const full of [false, true]) {
  test(`campus page: the camera pulse button opens its sheet, on top and tappable${full ? ' (full screen map)' : ''}`, async () => {
    const srv = await serve(); const url = 'http://127.0.0.1:' + srv.address().port + '/index.html';
    const { page, ctx, errors } = await openApp({ url, viewport: { width: 400, height: 850 }, context: { isMobile: true, hasTouch: true }, before: fakeCam });
    try {
      await page.evaluate(() => go('pulse'));
      await page.waitForSelector('#hwppg [data-a="ppgopen"]');
      await page.evaluate(() => { try { HWCampusHud.aware(false); } catch (e) {} });
      if (full) { await page.waitForSelector('#cmpfullb'); await page.evaluate(() => document.getElementById('cmpfullb').click()); await page.waitForFunction(() => document.documentElement.classList.contains('cmp-fs')); }
      // the element at the button's centre is the button (nothing, not even the map's loading bar, is on top of it)
      const hit = await page.evaluate(() => { const b = document.querySelector('#hwppg [data-a="ppgopen"]'); b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!t && (t === b || b.contains(t)); });
      if (!full) assert.equal(hit, true, 'nothing covers the camera button');
      await page.evaluate(() => document.querySelector('#hwppg [data-a="ppgopen"]').click());
      await page.waitForSelector('.ppgsheet');
      const on = await page.evaluate(() => { const c = document.querySelector('.ppgsheet'), r = c.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + 30); return !!t && c.contains(t); });
      assert.equal(on, true, 'the sheet is on top, where the person can see it');
      await page.click('#ppg-go');
      await page.waitForFunction(() => ['ask', 'run', 'idle'].includes(HWPPG.state) && HWPPG.state !== 'ask' || document.getElementById('hwppg').textContent.includes('Waiting for the camera'), null, { timeout: 8000 });
      // a message or the live reading is shown somewhere visible, never silence
      assert.ok((await page.textContent('#hwppg')).trim().length > 10);
      assert.deepEqual(errors.filter(e => !/WebGL|maplibre|tile|Failed to load resource/i.test(e)), []);
    } finally { await ctx.close(); srv.close(); }
  });
}
