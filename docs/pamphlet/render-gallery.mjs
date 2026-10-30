// Renders gallery.html -> healthwiz-demo-gallery.pdf (1 page) + preview-gallery.png. Usage: node render-gallery.mjs [outDir]
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { fileURLToPath } from 'url'; import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url)); const out = process.argv[2] || here;
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1056, height: 816 }, deviceScaleFactor: 2 });
await p.goto('file://' + path.join(here, 'gallery.html')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400);
console.log(await p.evaluate(() => { const f = document.querySelector('.foot').getBoundingClientRect().top; const last = Math.max(...[...document.querySelectorAll('figure')].map(x => x.getBoundingClientRect().bottom)); return { lastFigureBottom: Math.round(last), footTop: Math.round(f) }; }));
await p.pdf({ path: path.join(out, 'healthwiz-demo-gallery.pdf'), width: '11in', height: '8.5in', printBackground: true, preferCSSPageSize: true });
await (await p.$('.sheet')).screenshot({ path: path.join(out, 'preview-gallery.png') }); await b.close();
