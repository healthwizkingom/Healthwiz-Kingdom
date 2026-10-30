// Renders atlas.html -> healthwiz-feature-atlas.pdf (2 pages) + preview-atlas.png. Usage: node render-atlas.mjs [outDir]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'url'; import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url)); const out = process.argv[2] || here;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1056, height: 816 }, deviceScaleFactor: 2 });
await p.goto('file://' + path.join(here, 'atlas.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
console.log(await p.evaluate(() => { const sheets=[...document.querySelectorAll('.sheet')]; return sheets.map(sh=>{const c=sh.querySelector('.cols'); const f=sh.querySelector('.foot').getBoundingClientRect().top;
  const last = Math.max(...[...c.querySelectorAll('section')].map(s => s.getBoundingClientRect().bottom)); const right = Math.max(...[...c.querySelectorAll('section')].map(s => s.getBoundingClientRect().right));
  return { lastBottom: Math.round(last), footTop: Math.round(f), rightmost: Math.round(right), hOverflow: c.scrollWidth - c.clientWidth }}); }));
await p.pdf({ path: path.join(out, 'healthwiz-feature-atlas.pdf'), width: '11in', height: '8.5in', printBackground: true, preferCSSPageSize: true });
const sh=await p.$$('.sheet'); await sh[0].screenshot({ path: path.join(out, 'preview-atlas-1.png') }); await sh[1].screenshot({ path: path.join(out, 'preview-atlas-2.png') }); await b.close();
