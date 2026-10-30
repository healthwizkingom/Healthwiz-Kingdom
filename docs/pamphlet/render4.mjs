// Renders pamphlet4.html -> healthwiz-pamphlet-4panel-A4.pdf (2 pages, A4 landscape, 4 panels per side = 3 folds) + previews.
// Usage: node render4.mjs [outDir]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'url'; import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url)); const out = process.argv[2] || here;
const url = 'file://' + path.join(here, 'pamphlet4.html');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 3 });
await p.goto(url); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
console.table(await p.evaluate(() => [...document.querySelectorAll('.panel')].map((el, i) => { const top = el.getBoundingClientRect().top; let bottom = 0;
  el.querySelectorAll('*').forEach(c => { if (getComputedStyle(c).position === 'absolute' && !c.closest('.hd')) return; bottom = Math.max(bottom, c.getBoundingClientRect().bottom - top); });
  return { panel: i + 1, content: Math.round(bottom), limit: Math.round(el.clientHeight - 14), overflow: Math.round(bottom - (el.clientHeight - 14)) }; })));
await p.pdf({ path: path.join(out, 'healthwiz-pamphlet-4panel-A4.pdf'), width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
for (const g of [false, true]) { await p.goto(url + (g ? '?guides' : '')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  const s = await p.$$('.sheet'); await s[0].screenshot({ path: path.join(out, `preview4-outside${g ? '-folds' : ''}.png`) }); await s[1].screenshot({ path: path.join(out, `preview4-inside${g ? '-folds' : ''}.png`) }); }
await b.close();
