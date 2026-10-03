import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry } from './helpers.mjs';

after(closeBrowser);
const at = h => p => { const t = new Date(); t.setHours(h, 0, 0, 0); return p.clock.setFixedTime(t); };

test('time of day and daily weather are shown over the original scene', async () => {
  for (const [h, ph] of [[8, 'morning'], [14, 'afternoon'], [18, 'evening'], [23, 'night']]) {
    const { page, ctx, errors } = await openApp({ before: at(h) });
    await page.waitForSelector('.wl');
    assert.ok(await page.$('.v6tod.' + ph), ph);
    const wx = await page.getAttribute('[data-wx]', 'data-wx');
    assert.ok(['sunny', 'cloudy', 'rain', 'mist'].includes(wx));
    assert.equal(wx, await page.evaluate(() => HWTitle.weather()), 'same weather all day');
    assert.match(await page.textContent('.tt'), new RegExp(ph.toUpperCase() + ' IN THE KINGDOM'));
    assert.ok(await page.$('.zsv .zd'), 'original scene still drawn');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('weather is deterministic per date and covers all four kinds', async () => {
  const { page, ctx } = await openApp();
  const kinds = await page.evaluate(() => { const s = new Set(); for (let i = 1; i <= 60; i++) s.add(HWTitle.weather('2026-' + String(1 + (i % 12)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0'))); return [...s].sort(); });
  assert.deepEqual(kinds, ['cloudy', 'mist', 'rain', 'sunny']);
  await ctx.close();
});

test('mist stays in the valley: its top edge is at the knight\'s boots, never over the knight', async () => {
  const wxf = d => { let x = 0; for (const c of d) x = (x * 31 + c.charCodeAt(0)) >>> 0; x = (x ^ (x >>> 7)) % 10; return x < 5 ? 'sunny' : x < 7 ? 'cloudy' : x < 9 ? 'rain' : 'mist'; };
  let day; for (let i = 1; i <= 28 && !day; i++) { const d = '2026-02-' + String(i).padStart(2, '0'); if (wxf(d) === 'mist') day = d; }
  assert.ok(day, 'a mist day exists');
  for (const viewport of [{ width: 1100, height: 900 }, { width: 360, height: 800 }, { width: 1920, height: 1080 }]) {
    // reduced motion holds the knight still so his boots can be measured
    const { page, ctx, errors } = await openApp({ viewport, seed: { ...RETURNING, s: { ...RETURNING.s, rm: 1 } }, before: p => p.clock.setFixedTime(new Date(day + 'T14:00:00')) });
    await page.waitForSelector('.wl');
    assert.equal(await page.getAttribute('[data-wx]', 'data-wx'), 'mist');
    const r = await page.evaluate(() => { const k = document.querySelector('.kbd').getBoundingClientRect(); const m = document.querySelector('.v6mist').getBoundingClientRect(); return { boot: k.top + k.height * 210 / 216, top: m.top, wxBg: getComputedStyle(document.querySelector('.v6wx')).backgroundImage }; });
    assert.ok(Math.abs(r.top - r.boot) <= 2, viewport.width + ': mist top ' + r.top + ' vs boot ' + r.boot);
    assert.equal(r.wxBg, 'none', 'no full-screen mist overlay');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('returning player: progress ribbon and one lantern per restored region; new player: none', async () => {
  let o = await openApp({ fresh: true });
  await o.page.waitForSelector('.wl');
  assert.equal(await o.page.locator('.v6rib').count(), 0);
  assert.equal((await o.page.$$('.v6lan')).length, 0);
  await o.ctx.close();
  o = await openApp({ seed: { ...RETURNING, xp: 420, e: [entry('water', 250, 0), entry('pulse', 70, 1, { st: 'Resting' }), entry('sleep', 8, 0, { bed: '23:00', wake: '07:00' })] } });
  await o.page.waitForSelector('.wl');
  assert.match(await o.page.textContent('.v6rib'), /LV 3 · HEALTH EXPLORER · 🏰 3\/8 RESTORED/);
  assert.equal((await o.page.$$('.v6lan')).length, 3);
  await o.ctx.close();
});

test('tapping scene objects reacts; Settings button opens settings', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl');
  await page.locator('.v6hot[data-k="castle"]').click({ force: true });
  await page.waitForSelector('.v6pop');
  assert.match(await page.textContent('.v6pop'), /castle|guard/);
  assert.equal(await page.evaluate(() => HWEvents.recent('title:interact').at(-1).k), 'castle');
  await page.click('.v6set');
  assert.equal(await page.evaluate(() => S.v), 'set');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('entry transition plays briefly, then enters; reduced motion enters at once with no parallax', async () => {
  let o = await openApp();
  await o.page.waitForSelector('.wl');
  await o.page.click('.wl .ct button:not(.v6set)');
  assert.ok(await o.page.$('.wl.v6go'), 'transition class applied');
  await o.page.waitForFunction(() => S.v === 'home', null, { timeout: 3000 });
  await o.ctx.close();
  // Reduced motion from the first paint (set before the page loads, as for a real user).
  o = await openApp({ before: p => p.emulateMedia({ reducedMotion: 'reduce' }) });
  await o.page.waitForSelector('.wl');
  await o.page.mouse.move(50, 50); await o.page.mouse.move(400, 300);
  assert.equal(await o.page.locator('.wl.v6px').count(), 0, 'no parallax');
  await o.page.click('.wl .ct button:not(.v6set)');
  assert.equal(await o.page.evaluate(() => S.v), 'home', 'immediate');
  await o.ctx.close();
});

test('switching to reduced motion mid-session drops parallax already applied', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl');
  await page.mouse.move(50, 50); await page.mouse.move(400, 300);
  await page.waitForSelector('.wl.v6px');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.querySelector('.wl.v6px'), null, { timeout: 3000 });
  await page.mouse.move(600, 500);
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.wl.v6px').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});
