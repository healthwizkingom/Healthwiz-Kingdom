// Step 25 (master prompt §77, §93, §96): end-to-end journeys and integrity checks.
// Broken references, a new player's first day with zero console errors, an old v5.4.3 save on every page,
// the shared parts of all five mini-games, and the JavaScript level the code needs (browser support).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, state, yearOfLogs } from './helpers.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const PAGES = ['home', 'health', 'food', 'water', 'sleep', 'pulse', 'stair', 'stress', 'bmi', 'calc', 'stats', 'quests', 'guide', 'badges', 'kingdom', 'set'];
const SCRIPTS = [...read('index.html').matchAll(/<script src="(js\/[\w.-]+\.js)"><\/script>/g)].map(m => m[1]);
const snag = page => page.evaluate(() => /HIT A SNAG/.test(document.querySelector('#main').textContent));
// every data-a has a handler, every go target is a page, every data-ch has a handler; images that failed to load
const refs = where => page => page.evaluate(async where => {
  const bad = [];
  document.querySelectorAll('[data-a]').forEach(e => { const a = e.dataset.a;
    if (typeof acts[a] !== 'function') bad.push(where + ': no handler for data-a="' + a + '"');
    else if ((a === 'go' || a === 'kgo') && e.dataset.v && e.dataset.v !== 'tut' && typeof pages[e.dataset.v] !== 'function') bad.push(where + ': go to missing page "' + e.dataset.v + '"'); });
  document.querySelectorAll('[data-ch]').forEach(e => { if (typeof CH[e.dataset.ch] !== 'function') bad.push(where + ': no handler for data-ch="' + e.dataset.ch + '"'); });
  await Promise.all([...document.querySelectorAll('img')].map(i => i.decode().catch(() => bad.push(where + ': image did not load ' + String(i.getAttribute('src')).slice(0, 60)))));
  return { bad, svg: [...document.querySelectorAll('image')].map(i => i.getAttribute('href')) };
}, where);

test('no broken references: handlers, page links, images and asset paths on every page and dialog', async () => {
  const { page, ctx, errors } = await openApp({ seed: yearOfLogs(20) });
  await page.waitForSelector('.wl');
  const bad = [], svg = new Set();
  const run = async where => { const r = await refs(where)(page); bad.push(...r.bad); r.svg.forEach(h => svg.add(h)); };
  await run('welcome');
  for (const v of PAGES) { await go(page, v); await run(v); }
  await go(page, 'onb');
  for (let i = 0; i <= 7; i++) { await page.evaluate(i => { S.ob.d = { name: 'Aina', age: 19, sex: 'f', h: 160, w: 52, act: 1.375 }; S.ob.i = i; render(); }, i); await run('onboarding step ' + i); }
  await go(page, 'pulse'); await page.click('[data-a="edit"]'); await run('edit dialog'); await page.keyboard.press('Escape');
  await go(page, 'kingdom'); await page.click('[data-a="kreg"]'); await run('region panel'); await page.keyboard.press('Escape');
  for (const id of await page.evaluate(() => HWGames.games.map(g => g.id))) {
    await page.evaluate(id => HWGames.open(id), id); await page.waitForSelector('.v6g'); await run('game ' + id);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.v6g'));
  }
  assert.deepEqual(bad, []);
  for (const h of svg) if (!/^(data:|#)/.test(h)) assert.ok(fs.existsSync(path.join(root, h)), 'SVG image missing: ' + h);
  // every asset path written in the code or the stylesheet exists
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', ...SCRIPTS]) for (const m of read(f).matchAll(/assets\/[\w/.-]+\.\w+/g)) assert.ok(fs.existsSync(path.join(root, m[0])), `${f} refers to missing ${m[0]}`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a new adventurer’s first day on a phone, end to end, with zero console errors, and it all survives a reload', async () => {
  const { page, ctx, errors } = await openApp({ fresh: true, viewport: { width: 390, height: 844 }, context: { hasTouch: true, isMobile: true } });
  await page.waitForSelector('.wl');
  await page.tap('.wl .ct button');
  await page.waitForFunction(() => S.v === 'onb', null, { timeout: 3000 });
  const answer = async v => { await page.fill('#obi', v); await page.press('#obi', 'Enter'); };
  // a new badge shows its reveal card ("tap to continue"); like a player, tap it away whenever it is in the way
  await page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async o => { await o.tap({ force: true }); });
  await answer('Aina'); await answer('19');
  await page.tap('[data-a="obsex"][data-v="f"]');
  await answer('160'); await answer('52');
  await page.tap('[data-a="obact"]');
  await page.tap('[data-a="obf"]');
  await page.tap('[data-a="obgo"]');
  await page.waitForFunction(() => S.v === 'home');
  await page.waitForSelector('.tsk', { timeout: 3000 });
  await page.tap('.tsk');                                   // skip the tutorial
  await go(page, 'water'); await page.tap('[data-a="wa"][data-v="250"]');
  await go(page, 'food'); await page.fill('#q', 'roti canai'); await page.tap('#fl .it'); await page.tap('[data-a="addfood"]');
  await go(page, 'sleep'); await page.fill('#slb', '23:00'); await page.fill('#slw', '07:00'); await page.tap('[data-a="slsave"]');
  await go(page, 'pulse'); await page.fill('#pb', '72'); await page.tap('[data-a="savepulse"]');
  await go(page, 'stair'); await page.fill('#ss', '12'); await page.fill('#sc', '2'); await page.tap('[data-a="savestair"]');
  await go(page, 'bmi'); await page.fill('#bh', '160'); await page.fill('#bw', '52'); await page.tap('[data-a="savebmi"]');
  await go(page, 'home'); await page.tap('[data-a="ener"][data-i="4"]');
  await go(page, 'pulse'); await page.tap('[data-a="edit"]'); await page.fill('#ev', '74'); await page.tap('[data-a="esave"]');
  await page.tap('[data-a="del"]'); await page.tap('#toasts [data-a="undo"]');
  for (const v of PAGES) { await go(page, v); assert.equal(await snag(page), false, v); }
  await go(page, 'kingdom');
  for (const id of await page.evaluate(() => HWGames.games.map(g => g.id))) {
    await page.tap(`#v6ghub [data-a="game"][data-g="${id}"]`); await page.waitForSelector('.v6g[role="dialog"]');
    await page.tap('.v6gx'); await page.waitForFunction(() => !document.querySelector('.v6g'));
  }
 
  await go(page, 'set');
  await page.tap('[data-a="theme"]'); await page.tap('[data-a="snd"]'); await page.tap('[data-a="mopt"][data-k="perf"][data-v="performance"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.tap('[data-a="expj"]')]);
  assert.match(dl.suggestedFilename(), /\.json$/);
  const before = await state(page);
  await page.reload();
  await page.waitForSelector('.wl');
  const after = await page.evaluate(() => st);
  assert.deepEqual([...new Set(after.e.map(e => e.c))].sort(), ['bmi', 'food', 'pulse', 'sleep', 'stair', 'water']);
  assert.equal(after.e.length, before.e.length);
  assert.ok(after.e.some(e => e.c === 'pulse' && e.v === 74), 'edit kept');
  assert.deepEqual([after.p.name, after.s.onb, after.s.theme, after.s.perf], ['Aina', 1, 'dark', 'performance']);
  assert.ok(after.xp > 0 && Object.keys(after.en).length === 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('an old v5.4.3 save (no version, old badge names, 120 days) upgrades and every page works', async () => {
  const v1 = yearOfLogs(120);
  for (const k of ['sv', 'q6', 'ex', 'xl', 'md', 'mg', 'gp']) delete v1[k];
  Object.assign(v1, { b: { 'Shrine Visitor': '2025-06-01', 'First Sip': '2025-05-01' }, s: { kcal: 2200, water: 2000, sound: 0, set: 0, onb: 1 }, xp: 2500 });
  const { page, ctx, errors } = await openApp({ seed: v1 });
  await page.waitForSelector('.wl');
  for (const v of PAGES) { await go(page, v); assert.equal(await snag(page), false, v); }
  const s = await state(page);
  assert.equal(s.sv, await page.evaluate(() => HWSchema.V));
  assert.equal(s.e.length, v1.e.length, 'every entry kept');
  assert.ok(s.xp >= 2500, 'XP kept');
  assert.equal(s.b['Tower Visitor'], '2025-06-01', 'renamed badge keeps its date');
  assert.equal(s.b['Shrine Visitor'], undefined);
  assert.ok(await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('healthwiz_backup_pre-v'))), 'pre-upgrade copy kept');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('every mini-game on a phone: opens by tap and keyboard, fits, leaves by ✕ and Escape, restarts, leaves nothing running', async () => {
  const instrument = p => p.addInitScript(() => {
    window.__ints = new Set(); const _si = setInterval, _ci = clearInterval;
    window.setInterval = function () { const i = _si.apply(this, arguments); window.__ints.add(i); return i; };
    window.clearInterval = function (i) { window.__ints.delete(i); return _ci.apply(this, arguments); };
    window.__raf = 0; const _raf = requestAnimationFrame; window.requestAnimationFrame = function (f) { return _raf.call(this, t => { window.__raf++; f(t); }); };
  });
  const { page, ctx, errors } = await openApp({ viewport: { width: 360, height: 800 }, context: { hasTouch: true, isMobile: true }, before: instrument });
  await page.waitForSelector('.wl');
  await go(page, 'home');
  await page.waitForTimeout(2500);                          // past the start-up frame probe
  const games = await page.evaluate(() => HWGames.games.map(g => ({ id: g.id, page: g.page })));
  assert.deepEqual(games.map(g => g.id).sort(), ['food', 'grove', 'night', 'trail', 'water']);
  for (const g of games) {
    await go(page, g.page);
    const btn = (await page.$(`#v6gl-${g.id} [data-a="game"]`)) ? `#v6gl-${g.id} [data-a="game"]` : null;
    assert.ok(btn, g.id + ': launch card on its region page (' + g.page + ')');
    const ints = await page.evaluate(() => window.__ints.size), n0 = await page.evaluate(() => HWEvents.recent('game:cancelled').length);
    for (const how of ['tap + ✕', 'keyboard + Escape', 'restart + ✕']) {
      if (how.startsWith('keyboard')) { await page.focus(btn); await page.keyboard.press('Enter'); } else await page.tap(btn);
      await page.waitForSelector('.v6g[role="dialog"]');
      const fit = await page.evaluate(() => { const d = document.querySelector('.v6g').getBoundingClientRect(), x = document.querySelector('.v6gx').getBoundingClientRect();
        return { inside: d.left >= -1 && d.right <= innerWidth + 1 && d.top >= -1 && d.bottom <= innerHeight + 1, close: x.width >= 40 && x.height >= 40 && x.right <= innerWidth && x.top >= 0, live: !!document.querySelector('.v6gst[aria-live]'), over: document.documentElement.scrollWidth - innerWidth };
      });
      assert.deepEqual(fit, { inside: true, close: true, live: true, over: 0 }, `${g.id} (${how}) fits a 360 px phone`);
      if (how.endsWith('Escape')) await page.keyboard.press('Escape'); else await page.tap('.v6gx');
      await page.waitForFunction(() => !document.querySelector('.v6g'));
      assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.g), g.id, `${g.id}: focus back on the launch button after ${how}`);
    }
    assert.equal(await page.evaluate(() => HWEvents.recent('game:cancelled').length) - n0, 3, g.id + ': three cancels recorded');
    await page.waitForTimeout(300);
    const f0 = await page.evaluate(() => window.__raf);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__raf) - f0, 0, g.id + ': no frame loop after leaving');
    assert.equal(await page.evaluate(() => window.__ints.size), ints, g.id + ': no timer left after leaving');
  }
  // reduced motion: every game still opens and closes cleanly
  await page.evaluate(() => { st.s.rm = 1; save(); HWMotion.apply(); });
  for (const g of games) {
    await page.evaluate(id => HWGames.open(id), g.id); await page.waitForSelector('.v6g[role="dialog"]');
    assert.equal(await page.evaluate(() => /HIT A SNAG|snag/i.test(document.querySelector('.v6g').textContent)), false, g.id + ' under reduced motion');
    await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('.v6g'));
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('browser support: the code is plain ES2018 and avoids newer APIs (Safari 12+, Chrome 64+, Firefox 78+, Samsung Internet 9+)', () => {
  const req = createRequire(import.meta.url);
  let acorn; try { acorn = req('acorn'); } catch { acorn = req('/opt/node-tools/node_modules/acorn'); }
  // newer than the targets above: would break older iPhones/iPads and Samsung Internet
  const NEWER = [/\.at\(-?\d/, /structuredClone\(/, /Object\.hasOwn\(/, /\.findLast(Index)?\(/, /\.(toSorted|toReversed|toSpliced)\(/, /\.replaceAll\(/, /:has\(/, /@container\b/, /\?\?=|\|\|=|&&=/];
  for (const f of [...SCRIPTS, 'sw.js']) {
    const code = read(f);
    assert.doesNotThrow(() => acorn.parse(code, { ecmaVersion: 2018, sourceType: 'script' }), f + ' needs syntax newer than ES2018');
    for (const re of NEWER) assert.doesNotMatch(code, re, f + ' uses ' + re);
  }
});
