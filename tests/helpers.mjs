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

export const RETURNING = { b: {}, e: [], s: { kcal: 2200, water: 2000, sound: 0, set: 0, onb: 1 }, p: { w: 60, h: 165, age: 16, sex: 'm', act: 1.375, days: 3, goal: 'm', name: 'Tester' }, xp: 0, claimed: {} };

/**
 * Opens the app in a fresh browser context.
 *  - default: a returning user (onboarding done, tutorial seen, sound off)
 *  - { fresh: true }: brand-new user with empty storage (onboarding + tutorial flow)
 *  - { seed }: custom saved state (tutorial marked seen)
 */
export async function openApp({ seed, fresh = false, viewport } = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: viewport || { width: 1100, height: 900 }, acceptDownloads: true });
  // Tests run offline: stub external requests (Google Fonts stylesheet, AI endpoint).
  await ctx.route(/^https?:/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const init = fresh ? null : JSON.stringify(seed || RETURNING);
  if (init) await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, init);
  await page.goto(APP_URL);
  return { page, ctx, errors };
}

/** Navigate with the app's own router. */
export async function go(page, view) {
  await page.evaluate(v => go(v), view);
  await page.waitForTimeout(60);
}

export const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz') || 'null'));
