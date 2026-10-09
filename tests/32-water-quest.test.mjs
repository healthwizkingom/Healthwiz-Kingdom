// RPG upgrades, part A: the Water Quest scene and the knight's hydration sequence.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser, go, RETURNING, entry, state } from './helpers.mjs';

after(closeBrowser);
const seed = (n = 3) => ({ ...RETURNING, e: Array.from({ length: n }, (_, i) => entry('water', 500, i + 1)) });
const boot = async (o = {}) => {
  const r = await openApp({ seed: seed(), ...o });
  await r.page.addLocatorHandler(r.page.locator('.bpop:not(.out)').first(), async x => { await x.click({ force: true }); });
  await r.page.waitForSelector('.wl');
  await go(r.page, 'water');
  return r;
};

test('layered scene: painted far / mid / foreground layers, water life, the rigged knight, lighting by time of day', async () => {
  const { page, ctx, errors } = await boot();
  assert.equal(await page.locator('#wq.wq6 img.wq6l').count(), 3, 'three painted layers');
  for (const sel of ['.wq6fall', '.wq6foam', '.wqp .wq6sh', '.wq6fish', '.wq6mist', '.v6wqd', '.wqwell #wqwtr', '.v6wqr .rp', '.wqd i', '#wqch .hwr', '.wq6rf .hwr', '.wq6lt', '.wq6mo'])
    assert.ok(await page.locator('#wq ' + sel).count() >= 1, sel);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('#wq img.wq6l')].every(i => i.src.startsWith('data:image/png') && i.naturalWidth === 320)), 'pixel layers at 320×180');
  assert.ok(await page.evaluate(() => document.querySelector('#wq .wq6fall i').getAnimations().length > 0), 'the waterfall moves');
  for (const ph of ['morning', 'afternoon', 'evening', 'night']) {
    await page.evaluate(p => { HWTitle.phase = () => p; render(); }, ph);
    assert.equal(await page.evaluate(() => [...document.querySelector('#wq').classList].find(c => c.startsWith('ph-'))), 'ph-' + ph);
  }
  const srcs = await page.evaluate(() => { const o = {}; ['morning', 'night'].forEach(p => { HWTitle.phase = () => p; render(); o[p] = document.querySelector('#wq img.wq6l').src; }); return o; });
  assert.notEqual(srcs.morning, srcs.night, 'different sky by time of day');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('logging water: the knight walks, kneels, drinks, carries, pours, celebrates; the well and gauge rise; saved once', async () => {
  const { page, ctx, errors } = await boot();
  await page.evaluate(() => { HWWaterQuest.speed = 0.4; });
  await page.waitForFunction(() => !document.querySelector('.bpop') && HWPop.idle(), null, { timeout: 20000 });   // badge cards come one at a time; start from a clear screen
  const n0 = (await state(page)).e.length;
  const seen = page.evaluate(() => new Promise(res => { const S = new Set(), t0 = Date.now();
    const f = () => { const r = document.querySelector('#wqch svg.hwr'); if (r) { const m = /s-([\w-]+)/.exec(r.getAttribute('class')); if (m) S.add(m[1]); }
      const c = document.querySelector('#wqch'); if (c) ['walk', 'atw', 'carry', 'cel'].forEach(k => c.classList.contains(k) && S.add('c:' + k));
      if (Date.now() - t0 < 4500) setTimeout(f, 30); else res([...S]); }; f(); }));
  await page.click('[data-a="wa"][data-v="250"]');
  const states = await seen;
  for (const s of ['walk', 'kneel', 'scoop', 'drink', 'carry', 'cwalk', 'pour', 'cel', 'c:walk', 'c:atw', 'c:carry', 'c:cel']) assert.ok(states.includes(s), s + ' in ' + states);
  await page.waitForSelector('.fl2', { timeout: 6000 });
  const s = await state(page);
  assert.equal(s.e.length, n0 + 1);
  assert.equal(s.e.at(-1).v, 250);
  await page.waitForFunction(() => /13%/.test(document.querySelector('#wq .wq6hud').textContent), null, { timeout: 8000 });
  await page.reload();
  await page.waitForSelector('.wl');
  await go(page, 'water');
  assert.match(await page.textContent('#wq .wq6hud'), /13%/, '250 of 2000 mL after a reload');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('a second log during the sequence updates the meters without restarting; the target banner waits for the end', async () => {
  const { page, ctx, errors } = await openApp({ seed: { ...seed(), s: { ...RETURNING.s, water: 600 } } });
  await page.addLocatorHandler(page.locator('.bpop:not(.out)').first(), async x => { await x.click({ force: true }); });
  await page.waitForSelector('.wl');
  await go(page, 'water');
  await page.click('[data-a="wa"][data-v="500"]');
  await page.waitForTimeout(300);
  await page.click('[data-a="wa"][data-v="250"]');
  assert.equal(await page.evaluate(() => HWWaterQuest.busy), true);
  await page.waitForTimeout(4600);
  assert.equal(await page.locator('.fx.done').count(), 0, 'no "quest complete" over the pour');
  await page.waitForSelector('.fx.done', { timeout: 6000 });
  assert.equal(await page.evaluate(() => A('water', today()).length), 2, 'both logs saved');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('fits mobile portrait, mobile landscape, tablet and desktop; leaving mid-sequence stops it cleanly', async () => {
  for (const viewport of [{ width: 360, height: 740 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 568, height: 320 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
    const { page, ctx, errors } = await boot({ viewport });
    const m = await page.evaluate(() => { const w = document.querySelector('#wq').getBoundingClientRect(), k = document.querySelector('#wqch').getBoundingClientRect(), wl = document.querySelector('#wq .wqwell').getBoundingClientRect();
      return { sw: document.documentElement.scrollWidth, vw: innerWidth, vh: innerHeight, w: w.toJSON(), k: k.toJSON(), wl: wl.toJSON() }; });
    const tag = viewport.width + '×' + viewport.height;
    assert.ok(m.sw <= m.vw, tag + ': no sideways scroll');
    assert.ok(m.w.height <= m.vh * 0.8 && m.w.height >= 180, tag + ': scene height ' + m.w.height);
    for (const [n, b] of [['knight', m.k], ['well', m.wl]]) assert.ok(b.left >= m.w.left - 1 && b.right <= m.w.right + 1 && b.top >= m.w.top - 1 && b.bottom <= m.w.bottom + 1, tag + ': ' + n + ' inside the scene');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  const { page, ctx, errors } = await boot();
  await page.click('[data-a="wa"][data-v="100"]');
  await page.waitForSelector('#wqch.walk', { timeout: 3000 });
  await go(page, 'home');
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => HWWaterQuest.busy), false, 'sequence ended when the scene left');
  await page.waitForTimeout(7000);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reduced motion: the scene is still and logging still works', async () => {
  const { page, ctx, errors } = await boot({ context: { reducedMotion: 'reduce' } });
  assert.equal(await page.evaluate(() => [...document.querySelectorAll('#wq *')].filter(e => e.getAnimations().some(a => a.playState === 'running' && a.effect.getTiming().iterations === Infinity)).length), 0);
  await page.click('[data-a="wa"][data-v="100"]');
  await page.waitForSelector('.fl2', { timeout: 9000 });
  assert.equal((await state(page)).e.at(-1).v, 100);
  assert.deepEqual(errors, []);
  await ctx.close();
});
