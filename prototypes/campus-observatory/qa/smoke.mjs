import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = process.argv[2] || new URL('..', import.meta.url).pathname, OUT = new URL('shots', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.geojson': 'application/geo+json', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); });
await new Promise(r => srv.listen(8769, r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [], ok = [], bad = [];
const check = (name, cond, extra = '') => (cond ? ok : bad).push(name + (extra ? ' ' + extra : ''));
async function open(vp, name) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < 900, isMobile: vp.width < 900 });
  const page = await ctx.newPage(); await page.addInitScript(() => { try { localStorage.setItem('cho-still', '1'); } catch (e) {} });
  page.on('pageerror', e => errs.push(name + ' pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(name + ' ' + m.type() + ': ' + m.text()); });
  page.on('requestfailed', q => errs.push(name + ' requestfailed: ' + q.url()));
  await page.goto('http://localhost:8769/');
  await page.waitForFunction(() => { const c = window.__cho; return c && c.MAP && document.querySelectorAll('.stm').length === 25 && c.MAP.map.getTerrain() && c.MAP.map.queryTerrainElevation([100.5388927, 5.3490042]) > 1; }, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  return { ctx, page };
}
const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') });
const pos = p => p.evaluate(() => { const m = window.__cho.MAP.map, c = m.getContainer().getBoundingClientRect(); let worst = 0, n = 0;
  for (const g of window.__cho.S.groups) { const e = document.querySelector('.stm[data-key="' + g.key + '"]'); if (e.hidden) continue; const b = e.getBoundingClientRect(), q = m.project([g.lng, g.lat]);
    // the pin's tip is the coordinate: 6 px above the element's bottom edge (marker offset), at its centre line
    worst = Math.max(worst, Math.hypot(b.x + b.width / 2 - (c.x + q.x), b.bottom - 6 - (c.y + q.y))); n++; } return { n, worst: +worst.toFixed(2) }; });
const vstate = p => p.evaluate(() => ({ open: !document.getElementById('viewer').hidden, title: document.getElementById('vw-title').textContent, canvas: !!document.querySelector('#vw-canvas canvas'),
  sel: window.__cho.S.sel && window.__cho.S.sel.id, label: document.querySelector('.illus').textContent, labelVisible: (() => { const r = document.querySelector('.illus').getBoundingClientRect(); return r.width > 0 && r.height > 0; })() }));

/* ---------- desktop ---------- */
{
  const { ctx, page: p } = await open({ width: 1366, height: 820 }, 'desk');
  const t = await p.evaluate(() => { const m = window.__cho.MAP.map, q = (a, b) => +m.queryTerrainElevation([a, b]).toFixed(1); return { hi: q(100.5388927, 5.3490042), mid: q(100.5383771, 5.3519878), base: q(100.5368, 5.3509), st03: q(100.5380308, 5.3515422) }; });
  check('terrain order: highest > middle > base', t.hi > t.mid && t.mid > t.base, JSON.stringify(t));
  check('default mode is fantasy', await p.evaluate(() => document.documentElement.dataset.mode === 'fantasy'));
  const f = await pos(p); check('fantasy markers on their coordinates (on terrain)', f.worst < 1.5, JSON.stringify(f));
  check('clusters present at campus zoom', await p.evaluate(() => document.querySelectorAll('.clu').length) > 0);
  await p.waitForFunction(() => window.__cho.MAP.map.getLayer('models') && window.__cho.MAP.map.getLayoutProperty('models', 'visibility') === 'visible', null, { timeout: 60000 }).catch(() => {});
  check('Blender buildings shown in fantasy (simple blocks hidden)', await p.evaluate(() => { const m = window.__cho.MAP.map; return m.getLayoutProperty('models', 'visibility') === 'visible' && m.getLayoutProperty('bld', 'visibility') === 'none' && m.getLayoutProperty('bx', 'visibility') === 'none'; }));
  await shot(p, 'D1-fantasy');
  // list selection opens the preview automatically
  await p.click('#list .item[data-id="ST20"]'); await p.waitForTimeout(2600);
  const loadNote = await p.evaluate(() => { const m = document.getElementById('vw-msg'); return m.hidden ? null : m.textContent; });
  // the first preview downloads Three.js and the Blender model: wait for it (up to 60 s in software WebGL)
  await p.waitForFunction(() => window.__cho.S.viewer && window.__cho.S.viewer.debug.source && document.getElementById('vw-msg').hidden, null, { timeout: 60000 }).catch(() => {});
  let v = await vstate(p); check('list → preview opens', v.open && v.canvas && v.sel === 'ST20' && /penjana/.test(v.title), JSON.stringify(v));
  check('preview uses the Blender staircase model', await p.evaluate(() => window.__cho.S.viewer.debug.source === 'blender'), 'loading note seen: ' + JSON.stringify(loadNote));
  check('illustrative label visible', v.labelVisible && /Illustrative model — actual dimensions not surveyed\./.test(v.label));
  check('details show three groups', (await p.$$eval('#det .grp-card h3', a => a.map(x => x.textContent))).join('|') === 'Location|Staircase profile|Data quality');
  check('selected marker highlighted', await p.evaluate(() => !!document.querySelector('.stm.sel') && window.__cho.MAP.map.getSource('sel')._data.features.length === 1));
  await shot(p, 'D2-select-ST20');
  // a marker tap on the map opens / updates the preview too
  const key = await p.evaluate(() => window.__cho.S.groupOf.get('ST24'));
  await p.evaluate(k => { const e = document.querySelector('.stm[data-key="' + k + '"]'); e.hidden = false; e.click(); }, key); await p.waitForTimeout(2200);
  v = await vstate(p); check('marker → preview updates to ST24', v.open && v.sel === 'ST24' && /Blok A/.test(v.title), JSON.stringify(v));
  // controls: rotate, zoom, reset
  const cam = async () => crypto.createHash('md5').update(await p.locator('#vw-canvas').screenshot()).digest('hex');
  const before = await cam(); await p.click('.vbtn[data-v="right"]'); await p.waitForTimeout(500); await p.click('.vbtn[data-v="in"]'); await p.waitForTimeout(500);
  const after = await cam(); await p.click('.vbtn[data-v="reset"]'); await p.waitForTimeout(300);
  check('rotate/zoom/reset buttons respond', before !== after);
  await p.click('.vbtn.shape[data-shape="U"]'); await p.waitForTimeout(1200); await shot(p, 'D3-preview-U');
  // close keeps the selection
  await p.click('.vw-close'); await p.waitForTimeout(300);
  v = await vstate(p); check('close keeps selection', !v.open && v.sel === 'ST24', JSON.stringify(v));
  check('map still navigable after close', await p.evaluate(() => { const m = window.__cho.MAP.map, z = m.getZoom(); m.jumpTo({ zoom: z + .5 }); return Math.abs(m.getZoom() - z - .5) < .01; }));
  // mode switch: same coordinates
  const g = await p.evaluate(() => JSON.stringify(window.__cho.S.groups.map(x => [x.lng, x.lat])));
  await p.click('.mode[data-mode="realistic"]'); await p.waitForTimeout(2000);
  check('mode switch keeps coordinates', g === await p.evaluate(() => JSON.stringify(window.__cho.S.groups.map(x => [x.lng, x.lat]))));
  const r = await pos(p); check('realistic markers on their coordinates', r.worst < 1.5, JSON.stringify(r));
  check('realistic shows plain blocks, no Blender buildings', await p.evaluate(() => { const m = window.__cho.MAP.map; return m.getLayoutProperty('models', 'visibility') === 'none' && m.getLayoutProperty('bld', 'visibility') === 'visible'; }));
  await p.click('[data-act="campus"]'); await p.waitForTimeout(1200); await shot(p, 'D4-realistic');
  await p.click('#list .item[data-id="ST14"]').catch(async () => { await p.click('[data-act="back"]'); await p.click('#list .item[data-id="ST14"]'); });
  await p.waitForTimeout(2200); v = await vstate(p); check('realistic: selection opens preview', v.open && v.sel === 'ST14'); await shot(p, 'D5-realistic-preview');
  // keyboard: Tab to a marker, Enter
  await p.click('.vw-close'); await p.click('[data-act="back"]').catch(() => {});
  const mk = await p.evaluate(() => { const e = [...document.querySelectorAll('.stm')].find(x => !x.hidden && !x.classList.contains('sel') && x.querySelector('.cnt') == null); e.focus(); return e.dataset.key; });
  await p.keyboard.press('Enter'); await p.waitForTimeout(1800);
  v = await vstate(p); check('keyboard Enter on a marker selects and opens the preview', v.open && !!v.sel, JSON.stringify(v));
  // shared-point marker: chooser, no preview until one is picked
  const sk = await p.evaluate(() => window.__cho.S.groups.find(g => g.items.length === 3).key);
  await p.evaluate(k => { const e = document.querySelector('.stm[data-key="' + k + '"]'); e.hidden = false; e.click(); }, sk); await p.waitForTimeout(800);
  check('shared point → chooser', /3 staircases at one stored point/.test(await p.textContent('#det')));
  await p.click('#det .item[data-id="ST31"]'); await p.waitForTimeout(1800); v = await vstate(p); check('chooser item → preview', v.open && v.sel === 'ST31');
  // no-location staircase: no marker, preview still opens (illustrative)
  await p.click('[data-act="back"]'); await p.click('.fchip[data-f="nol"]'); await p.click('#list .item[data-id="ST29"]'); await p.waitForTimeout(1500);
  v = await vstate(p); const d = await p.textContent('#det');
  check('no-location staircase: preview + "No location recorded"', v.open && v.sel === 'ST29' && /No location recorded/.test(d) && !(await p.evaluate(() => document.querySelector('.stm.sel'))));
  // terrain toggle
  await p.click('[data-ctl="terr"]'); await p.waitForTimeout(800);
  check('terrain off flattens', await p.evaluate(() => !window.__cho.MAP.map.getTerrain()));
  await p.click('[data-ctl="terr"]'); await p.waitForTimeout(500);
  // clear selection
  await p.click('[data-act="clear"]'); await p.waitForTimeout(300);
  check('× clears selection and preview', await p.evaluate(() => !window.__cho.S.sel && document.getElementById('viewer').hidden && document.getElementById('selpill').hidden));
  // clusters zoom in
  await p.click('.mode[data-mode="fantasy"]'); await p.click('[data-ctl="fit"]'); await p.waitForTimeout(1500);
  const z0 = await p.evaluate(() => window.__cho.MAP.map.getZoom());
  if (await p.$('.clu')) { await p.evaluate(() => document.querySelector('.clu').click()); await p.waitForTimeout(1500); check('cluster click zooms in', await p.evaluate(() => window.__cho.MAP.map.getZoom()) > z0 + .3); }
  // hover tip
  await p.click('#list .item[data-id="ST19"]').catch(() => {}); await p.waitForTimeout(2000);
  await shot(p, 'D6-fantasy-ST19');
  await ctx.close();
}
/* ---------- phone ---------- */
{
  const { ctx, page: p } = await open({ width: 390, height: 844 }, 'phone');
  await shot(p, 'P1-fantasy');
  await p.click('.handle'); await p.waitForTimeout(400);
  await p.click('#list .item[data-id="ST25"]'); await p.waitForTimeout(2800);
  const v = await vstate(p);
  check('phone: list → preview embedded in sheet', v.open && v.sel === 'ST25' && await p.evaluate(() => document.getElementById('viewer').classList.contains('embedded') && !!document.getElementById('viewer').closest('#sheet')), JSON.stringify(v));
  const vis = await p.evaluate(() => { const k = window.__cho.S.groupOf.get('ST25'), e = document.querySelector('.stm[data-key="' + k + '"]').getBoundingClientRect(), s = document.getElementById('sheet').getBoundingClientRect(); return { markerBottom: Math.round(e.bottom), sheetTop: Math.round(s.top), top: Math.round(e.top) }; });
  check('phone: selected marker visible above the sheet', vis.markerBottom < vis.sheetTop && vis.top > 56, JSON.stringify(vis));
  check('phone: no horizontal overflow', !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await shot(p, 'P2-preview');
  await p.evaluate(() => document.getElementById('pane-det').scrollTo(0, 420)); await p.waitForTimeout(300); await shot(p, 'P3-details');
  await p.click('.mode[data-mode="realistic"]'); await p.waitForTimeout(1500); await p.evaluate(() => document.getElementById('pane-det').scrollTo(0, 0)); await shot(p, 'P4-realistic');
  await ctx.close();
}
await browser.close(); srv.close();
console.log('PASS ' + ok.length + '\n  ' + ok.join('\n  '));
console.log('FAIL ' + bad.length + (bad.length ? '\n  ' + bad.join('\n  ') : ''));
console.log(errs.length ? 'CONSOLE:\n' + [...new Set(errs)].join('\n') : 'no console errors or warnings');
