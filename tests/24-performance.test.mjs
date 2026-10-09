// Step 24 (master prompt §92): performance budgets and the optimisations that meet them.
// Budgets are generous (a few times the measured values on a desktop CPU) so they catch regressions, not noise.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openApp, closeBrowser, go, state, RETURNING, yearOfLogs, fillSteps } from './helpers.mjs';

after(closeBrowser);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['home', 'health', 'food', 'water', 'sleep', 'pulse', 'stair', 'stress', 'bmi', 'calc', 'stats', 'quests', 'guide', 'badges', 'kingdom', 'set'];
// counts writes of the main save, and timers/frames, from the first line of the page
const instrument = p => p.addInitScript(() => {
  window.__w = 0; const si = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k) { if (k === 'healthwiz') window.__w++; return si.apply(this, arguments); };
  window.__ints = new Set(); const _si = setInterval, _ci = clearInterval;
  window.setInterval = function () { const i = _si.apply(this, arguments); window.__ints.add(i); return i; };
  window.clearInterval = function (i) { window.__ints.delete(i); return _ci.apply(this, arguments); };
  window.__raf = 0; const _raf = requestAnimationFrame;
  window.requestAnimationFrame = function (f) { return _raf.call(this, t => { window.__raf++; f(t); }); };
});
const settle = (page, ms = 300) => page.waitForTimeout(ms);

test('a year of logs (≈5,000 entries): every page draws in a few milliseconds; navigating writes nothing', async () => {
  const { page, ctx, errors } = await openApp({ seed: yearOfLogs(365), before: instrument });
  await page.waitForSelector('.wl');
  for (const v of PAGES) await go(page, v);        // first visits: badges, discovery XP…
  await settle(page, 1500);
  const r = await page.evaluate(async P => {
    const w0 = window.__w, out = {};
    for (const v of P) { const t = []; for (let i = 0; i < 5; i++) { go(v === 'home' ? 'health' : 'home'); const a = performance.now(); go(v); t.push(performance.now() - a); } out[v] = t.sort((a, b) => a - b)[2]; }
    await new Promise(r => setTimeout(r, 50));
    return { ms: out, writes: window.__w - w0 };
  }, PAGES);
  const total = Object.values(r.ms).reduce((a, b) => a + b, 0);
  for (const [v, ms] of Object.entries(r.ms)) assert.ok(ms < 60, `${v} took ${ms.toFixed(1)} ms (budget 60; 2–11 ms measured, 51–145 ms before step 24)`);
  assert.ok(total < 300, 'all pages together: ' + total.toFixed(0) + ' ms (≈60 measured, ≈1,300 before step 24)');
  assert.equal(r.writes, 0, 'plain navigation does not rewrite the save');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the entry index answers exactly like a full scan, returns copies, and never goes stale', async () => {
  const { page, ctx, errors } = await openApp({ seed: yearOfLogs(40) });
  await page.waitForSelector('.wl');
  const bad = await page.evaluate(() => {
    const out = [], ids = a => JSON.stringify(a.map(x => x.id)), eq = (a, b, m) => { if (a !== b) out.push(m); };
    const cats = ['water', 'food', 'sleep', 'pulse', 'stair', 'stress', 'bmi', 'nope'];
    const days = [...new Set(st.e.map(x => x.d))].concat(['1999-01-01', undefined, '']);
    for (const c of cats) {
      for (const d of days) eq(ids(A(c, d)), ids(st.e.filter(x => x.c === c && x.d === (d || today()))), 'A ' + c + ' ' + d);
      eq(ids(LC(c)), ids([...st.e].sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t)).filter(x => x.c === c)), 'LC ' + c);
      eq(cnt(c), st.e.filter(x => x.c === c).length, 'cnt ' + c);
      eq(tot(c), st.e.filter(x => x.c === c).reduce((a, x) => a + (+x.v || 0), 0), 'tot ' + c);
    }
    eq(ids(ALL()), ids([...st.e].sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t))), 'ALL');
    eq(JSON.stringify(dys()), JSON.stringify([...new Set(st.e.map(x => x.d))].sort()), 'dys');
    // copies: changing a result changes nothing for the next caller
    const a = A('water'); a.length = 0; eq(A('water').length > 0, true, 'A returns a copy');
    const al = ALL(); al.reverse(); eq(ALL()[0].d <= ALL()[1].d, true, 'ALL returns a copy');
    const ds = dys(); ds.push('x'); eq(dys().includes('x'), false, 'dys returns a copy');
    // in the same synchronous run: a push, an in-place edit + save(), a splice, a whole new state
    const n0 = A('water').length; st.e.push({ id: 'z1', c: 'water', v: 1, m: {}, n: '', d: today(), t: '10:00' });
    eq(A('water').length, n0 + 1, 'push seen');
    const x = st.e.find(e => e.c === 'pulse'); x.d = '2001-02-03'; save();
    eq(A('pulse', '2001-02-03').includes(x), true, 'edit + save seen');
    st.e.splice(st.e.indexOf(x), 1); eq(A('pulse', '2001-02-03').length, 0, 'splice seen');
    const keep = st; st = Object.assign({}, st, { e: [] }); eq(A('water').length + cnt('food') + dys().length, 0, 'new state seen'); st = keep;
    return out;
  });
  assert.deepEqual(bad, []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('one action, one write: logging water stores entry and XP together, and survives a reload', async () => {
  const { page, ctx, errors } = await openApp({ before: instrument });
  await page.waitForSelector('.wl');
  await go(page, 'water');
  await settle(page, 1500);                        // first-visit discovery XP is its own, earlier write
  await page.evaluate(() => { window.__w = 0; });
  await page.click('[data-a="wa"][data-v="250"]');
  await settle(page);
  assert.equal(await page.evaluate(() => window.__w), 1, 'add() and gain() each call save(); storage is written once');
  const s = await state(page);
  assert.equal(s.e.filter(e => e.c === 'water').length, 1);
  assert.equal(s.xp, await page.evaluate(() => st.xp), 'stored XP includes the award');
  await page.reload();
  await page.waitForSelector('.wl');
  assert.equal(await page.evaluate(() => st.e.filter(e => e.c === 'water').length), 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('storage full: superseded upgrade copies are freed first; if that is not enough the user is told', async () => {
  const { page, ctx, errors } = await openApp();
  await page.waitForSelector('.wl');
  await go(page, 'stair');
  await page.click('.sqlist .chip >> nth=0');
  const log = async n => { await fillSteps(page, '#ss', String(n)); await page.fill('#sc', '1'); await page.click('[data-a="savestair"]'); };
  // A: "full" until the pre-upgrade copy is gone → freed, retried, saved, no warning
  await page.evaluate(() => {
    localStorage.setItem('healthwiz_backup_pre-v8_1', 'old copy'); localStorage.setItem('healthwiz_backup_cloud_2', 'keep me');
    const si = Storage.prototype.setItem; window.__si = si;
    Storage.prototype.setItem = function (k) { if (k === 'healthwiz' && Object.keys(localStorage).some(x => x.startsWith('healthwiz_backup_pre-v'))) throw new DOMException('full', 'QuotaExceededError'); return si.apply(this, arguments); };
  });
  await log(71);
  await settle(page);
  assert.equal((await state(page)).e.length, 1, 'saved after freeing space');
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('healthwiz_backup_')).sort()), ['healthwiz_backup_cloud_2'], 'only the superseded upgrade copy was removed');
  assert.doesNotMatch(await page.textContent('#toasts'), /could not be saved/);
  // B: storage refuses every write → told once (what happened, what is safe, what to do), app keeps working
  await page.evaluate(() => { const si = window.__si; Storage.prototype.setItem = function (k) { if (k === 'healthwiz') throw new DOMException('full', 'QuotaExceededError'); return si.apply(this, arguments); }; });
  await log(72);
  await settle(page);
  assert.match(await page.textContent('#toasts'), /could not be saved on this device.*stay in this tab.*Download a backup/);
  await log(73);
  await settle(page);
  assert.equal(await page.evaluate(() => HWEvents.recent('storage:failed').length), 1, 'not repeated on every tap');
  assert.equal(await page.evaluate(() => st.e.length), 3, 'entries stay in the open tab');
  assert.equal((await state(page)).e.length, 1, 'storage still holds the last good save');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('battery: looping scenery pauses while scrolled out of view; idle pages run no frame loop', async () => {
  const { page, ctx, errors } = await openApp({ seed: yearOfLogs(14), viewport: { width: 390, height: 844 }, before: instrument });
  await page.waitForSelector('.wl');
  await go(page, 'home');
  await settle(page, 400);
  const loops = () => page.evaluate(() => { const el = document.querySelector('#kmini'), a = el.getAnimations({ subtree: true }).filter(x => x.effect.getTiming().iterations === Infinity);
    return { off: el.classList.contains('hw-off'), n: a.length, running: a.filter(x => x.playState === 'running').length }; });
  let r = await loops();
  assert.ok(r.n > 10, 'the kingdom map has looping scenery: ' + r.n);
  assert.deepEqual([r.off, r.running], [true, 0], 'below the fold: paused');
  await page.evaluate(() => document.querySelector('#kmini').scrollIntoView());
  await settle(page, 400);
  r = await loops();
  assert.deepEqual([r.off, r.running], [false, r.n], 'scrolled into view: running again');
  await go(page, 'water');
  await page.evaluate(() => document.querySelector('#wq').scrollIntoView());   // the add-water form is now first, so the well scene is below the fold until scrolled to
  await settle(page, 400);
  assert.equal(await page.evaluate(() => document.querySelector('#wq').classList.contains('hw-off')), false, 'a scene in view keeps moving');
  for (const v of ['home', 'welcome']) {
    await go(page, v);
    await settle(page, 2500);                      // after the one-off badge burst and Auto mode's start-up frame probe
    const f0 = await page.evaluate(() => window.__raf);
    await settle(page, 1500);
    assert.equal(await page.evaluate(() => window.__raf) - f0, 0, v + ': no requestAnimationFrame loop while idle');
  }
  assert.ok(await page.evaluate(() => window.__ints.size) <= 1, 'only the 30 s cloud check interval is alive');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('no leaks: 60 navigations leave listeners, DOM nodes and timers flat', async () => {
  const { page, ctx, errors } = await openApp({ seed: yearOfLogs(30), before: instrument });
  await page.waitForSelector('.wl');
  for (const v of PAGES) await go(page, v);
  await go(page, 'home');
  await settle(page, 1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable'); await cdp.send('HeapProfiler.enable');
  const metrics = async () => { await cdp.send('HeapProfiler.collectGarbage'); const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value])); return { listeners: m.JSEventListeners, nodes: m.Nodes, heap: m.JSHeapUsedSize, ints: await page.evaluate(() => window.__ints.size) }; };
  const a = await metrics();
  await page.evaluate(async P => { for (let i = 0; i < 60; i++) { go(P[i % P.length]); await new Promise(r => setTimeout(r, 5)); } go('home'); }, PAGES);
  await settle(page, 600);
  const b = await metrics();
  assert.ok(b.listeners <= a.listeners + 2, `listeners ${a.listeners} → ${b.listeners}`);
  assert.ok(b.nodes <= a.nodes * 1.3 + 200, `DOM nodes ${a.nodes} → ${b.nodes}`);
  assert.ok(b.heap <= a.heap * 1.5 + 2e6, `heap ${a.heap} → ${b.heap}`);
  assert.equal(b.ints, a.ints, 'no interval left running');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('assets stay lean: the art is lossless WebP, no image over 100 KB, all images ≤ 500 KB together', () => {
  const dir = path.join(root, 'assets', 'img'), files = fs.readdirSync(dir);
  assert.deepEqual(files.filter(f => f.endsWith('.png')), [], 'PNG art was re-encoded as lossless WebP');
  for (const n of ['wiz', 'kn', 'knight-kbd', 'knight-kcp', 'knight-khr', 'orc']) {
    const b = fs.readFileSync(path.join(dir, n + '.webp'));
    assert.equal(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 16), 'RIFFWEBPVP8L', n + '.webp is lossless (VP8L)');
  }
  let total = 0;
  for (const f of files) { const s = fs.statSync(path.join(dir, f)).size; total += s; assert.ok(s <= 100 * 1024, f + ' is ' + s + ' bytes'); }
  assert.ok(total <= 500 * 1024, 'images total ' + total + ' bytes');
});
