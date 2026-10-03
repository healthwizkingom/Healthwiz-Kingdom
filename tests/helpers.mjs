// Shared Playwright helpers. Uses a local `playwright` install if present,
// otherwise the globally installed one (preinstalled in the cloud container).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { execSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP_URL = pathToFileURL(path.join(here, '..', 'index.html')).href;

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  try { return req('playwright'); } catch {}
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(path.join(globalRoot, 'noop.js'))('playwright');
}
const { chromium } = loadPlaywright();

let browser;
export async function getBrowser() {
  browser ??= await chromium.launch();
  return browser;
}
export async function closeBrowser() {
  if (browser) await browser.close();
  browser = undefined;
}

/** Fresh page with empty storage. `seed` (optional) is written to localStorage before load. */
export async function openApp({ seed, viewport, popups = false } = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: viewport || { width: 1100, height: 900 } });
  // Tests run offline: stub the only external resource (Google Fonts stylesheet).
  await ctx.route(/^https?:/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  // Badge popups cover the screen; tests opt in explicitly with { popups: true }.
  if (!popups) await page.addInitScript(() => { window.HW_NO_POPUPS = 1; });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (seed) await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(seed));
  await page.goto(APP_URL);
  return { page, ctx, errors };
}

/** Navigate inside the app via its own router. */
export async function go(page, view) {
  await page.evaluate(v => window.HW.go(v), view);
  await page.waitForTimeout(50);
}

export const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz') || 'null'));
