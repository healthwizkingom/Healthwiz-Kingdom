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

export const RETURNING = { sv: 8, gp: { ok: 0, v: {} }, xl: {}, md: { last: {}, day: {}, seen: {}, ms: {}, log: [] }, mg: { xp: {}, n: {}, h: [], c: {} }, q6: { f: {}, w: {} }, ex: { p: {} }, b: {}, e: [], s: { kcal: 2200, water: 2000, sound: 0, set: 0, onb: 1, med: 0 }, p: { w: 60, h: 165, age: 16, sex: 'm', act: 1.375, days: 3, goal: 'm', name: 'Tester' }, xp: 0, claimed: {} };

/**
 * Opens the app in a fresh browser context.
 *  - default: a returning user (onboarding done, tutorial seen, sound off)
 *  - { fresh: true }: brand-new user with empty storage (onboarding + tutorial flow)
 *  - { seed }: custom saved state (tutorial marked seen)
 *  - { url }: open this address instead of the file (for features that need http, such as fetching audio)
 *  - { context }: extra browser-context options (hasTouch, isMobile, colorScheme, reducedMotion…)
 */
export async function openApp({ seed, fresh = false, viewport, before, context, url } = {}) {
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: viewport || { width: 1100, height: 900 }, acceptDownloads: true, ...context });
  // Tests run offline: stub external requests (Google Fonts stylesheet, AI endpoint).
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  // Keep at most 50 messages so a runaway page can't exhaust the test runner's memory; flag floods.
  let seen = 0;
  const keep = s => { seen++; if (errors.length < 50) errors.push(s); else if (seen === 51) errors.push('… error flood: more than 50 errors (first ones above)'); };
  page.on('pageerror', e => keep('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') keep('console: ' + m.text().slice(0, 300)); });
  const init = fresh ? null : JSON.stringify(seed || RETURNING);
  if (init) await page.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('healthwiz', s); localStorage.setItem('hwtut', '1'); sessionStorage.setItem('seeded', '1'); } }, init);
  if (before) await before(page);
  await page.goto(url || APP_URL);
  return { page, ctx, errors };
}

/** Navigate with the app's own router. */
export async function go(page, view) {
  await page.evaluate(v => go(v), view);
  await page.waitForTimeout(60);
}

export const state = page => page.evaluate(() => JSON.parse(localStorage.getItem('healthwiz') || 'null'));

/** Local YYYY-MM-DD for n days ago (same timezone as the browser under test). */
export const daysAgo = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() - n); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let _id = 0;
export const entry = (c, v, n, m = {}, t = '12:00') => ({ id: 't' + (++_id), c, v, m, n: '', d: daysAgo(n), t });

/** A long, busy history for performance and compatibility tests: `days` days of water, meals, sleep, pulse,
 *  stairs and stress (≈13 entries a day, so a year is ≈5,000 entries and a ≈590 KB save). */
export function yearOfLogs(days = 365, base = RETURNING) {
  const e = [], en = {}, xd = {}; let id = 0;
  const add = (c, v, d, t, m = {}) => e.push({ id: 'y' + (++id), c, v, m, n: '', d, t });
  for (let n = days; n >= 0; n--) {
    const d = daysAgo(n);
    for (let k = 0; k < 6; k++) add('water', 250, d, String(8 + k * 2).padStart(2, '0') + ':00');
    ['breakfast', 'lunch', 'dinner', 'snack'].forEach((meal, k) => add('food', 400 + k * 50, d, String(8 + k * 4).padStart(2, '0') + ':30', { name: 'Nasi Lemak', por: '1 plate', qty: 1, pm: 1, meal, src: 'KOLEJ MARA KULIM', u: 0 }));
    add('sleep', 7 + (n % 3) * 0.5, d, '07:00', { bed: '23:00', wake: '06:30', aw: 1, lat: 15, rest: 3, score: 75 });
    add('pulse', 70 + (n % 10), d, '09:00', { st: 'Resting' });
    if (n % 2 === 0) add('stair', 120, d, '17:00', { sid: 'ST03', loc: 'Block', diff: 'MILD', steps: 60, climbs: 2, dur: 5, pace: 'steady' });
    add('stress', 3 + (n % 4), d, '20:00', { feel: 'ok', end: 2, why: [], tech: [] });
    if (n % 7 === 0) add('bmi', 22.1, d, '08:00', { h: 165, w: 60 });
    en[d] = { v: 3, t: '21:00' }; xd[d] = 120;
  }
  return Object.assign(JSON.parse(JSON.stringify(base)), { e, en, xd, xp: 30000 });
}

/** Fill "Steps per climb" (#ss casual, #wk-s workout): the number box is behind the Custom chip until a range is chosen. */
export async function fillSteps(page, sel, value) {
  const box = page.locator(sel);
  if (!(await box.isVisible())) await page.locator(sel === '#ss' ? '#stcnt-c' : '#stcnt-w').locator('[data-a="strng"][data-r="c"]').click();
  await box.fill(String(value));
}
