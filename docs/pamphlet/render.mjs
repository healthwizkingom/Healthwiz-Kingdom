// Renders pamphlet.html -> healthwiz-pamphlet.pdf (2 pages, Letter landscape) + preview PNGs.
// Usage (from this folder):  node render.mjs [outDir]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'url';
import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] || here;
const url = 'file://' + path.join(here, 'pamphlet.html');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1056, height: 816 }, deviceScaleFactor: 2 });
await p.goto(url); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
// fit check: every panel's content must fit inside its panel (scrollHeight > clientHeight = clipped)
const fit = await p.evaluate(() => [...document.querySelectorAll('.panel')].map(el => {
  let bottom = 0; const top = el.getBoundingClientRect().top;
  el.querySelectorAll('*').forEach(c => { if (getComputedStyle(c).position === 'absolute' && !c.closest('.hd,.scene')) return; bottom = Math.max(bottom, c.getBoundingClientRect().bottom - top); });
  return { panel: el.className.replace(/dark|panel/g, '').trim(), content: Math.round(bottom), limit: Math.round(el.clientHeight - 20), overflow: Math.round(bottom - (el.clientHeight - 20)) };
}));
console.table(fit);
await p.pdf({ path: path.join(out, 'healthwiz-pamphlet.pdf'), width: '11in', height: '8.5in', printBackground: true, preferCSSPageSize: true });
for (const [i, name] of [[0, 'outside'], [1, 'inside']]) {
  const s = (await p.$$('.sheet'))[i]; await s.screenshot({ path: path.join(out, `preview-${name}.png`) });
}
await p.goto(url + '?guides'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
for (const [i, name] of [[0, 'outside'], [1, 'inside']]) {
  const s = (await p.$$('.sheet'))[i]; await s.screenshot({ path: path.join(out, `preview-${name}-folds.png`) });
}
await b.close();
