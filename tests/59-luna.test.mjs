// Luna, the apprentice witch (js/v6-luna.js): the hand-placed sprite and its expressions, the event bubbles she now speaks
// (js/v6-medius.js), Ask Luna (find a feature, open a page's "?" explanations), her preferences, and the phone layout.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go, state, RETURNING } from './helpers.mjs';

after(closeBrowser);
const quietMd = { last: { greet: Date.now() }, day: {}, seen: {}, ms: {}, log: [] };
const seed = (s = {}) => ({ ...RETURNING, md: quietMd, s: { ...RETURNING.s, med: 2, ...s } });
const PHONE = { viewport: { width: 360, height: 760 }, context: { isMobile: true, hasTouch: true } };

test('art from the owner\'s sheet only: the nine poses (80 x 120 each) and the seven portraits load; nothing else is drawn for her', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed() });
  const r = await page.evaluate(async () => {
    const load = async src => { const i = new Image(); i.src = src; await i.decode(); return [i.naturalWidth, i.naturalHeight]; };
    return { full: await load(HWLuna.POSE_IMG), faces: await load(HWLuna.FACES), exprs: HWLuna.expressions, poses: HWLuna.poses, canvas: typeof HWLuna.grid };
  });
  assert.deepEqual(r.full, [720, 120]); assert.deepEqual(r.faces, [448, 64]);
  assert.deepEqual(r.poses, ['idle', 'staff', 'walk', 'cast', 'point', 'think', 'happy', 'confused', 'wave'], 'the sheet\'s poses 1 to 9');
  assert.deepEqual(r.exprs, ['cheerful', 'curious', 'focused', 'thoughtful', 'surprised', 'encouraging', 'apologetic'], 'the seven from the reference sheet');
  assert.equal(r.canvas, 'undefined', 'the code-drawn sprite is gone: the owner asked for the Luna of their sheet');
  // only these two Luna pictures, made from the sheet by tools/art/make_luna_faces.py and make_luna_lab.py
  assert.deepEqual(fs.readdirSync(new URL('../assets/img/', import.meta.url)).filter(f => /luna/i.test(f)).sort(), ['luna-faces.webp', 'luna-poses.webp']);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Luna speaks the bubbles: her full figure, LUNA label; compact shows the portrait for the moment', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed() });
  await go(page, 'home');
  await page.evaluate(() => HWMedius.say('badge', { name: 'First Sip', icon: '' }));
  await page.waitForSelector('#v6md .v6lfull .v6lfi');
  assert.match(await page.textContent('#v6md'), /^LUNAOoh, a new badge: First Sip/);
  assert.equal(await page.locator('#v6md img[src*="wiz"]').count(), 0, 'no Medius picture in the bubble');
  const size = await page.$eval('#v6md .v6lfull', f => { const i = f.querySelector('.v6lfi'), b = i.getBoundingClientRect(); return [f.dataset.pose, Math.round(b.width), Math.round(b.height), getComputedStyle(i).imageRendering, getComputedStyle(i).backgroundSize]; });
  assert.deepEqual(size, ['cast', 80, 120, 'pixelated', '720px 120px'], 'a badge: the casting pose, at 1x');
  await page.evaluate(() => { document.getElementById('v6md').remove(); HWMedius.hush(); });
  await go(page, 'set');
  await page.click('#v6lunaset [data-a="lunasz"][data-m="1"]');
  assert.equal((await state(page)).s.lsz, 1);
  await page.evaluate(() => { const M = st.md; M.last = {}; M.seen = {}; HWMedius.say('level', { level: 4, name: 'Pathfinder' }); });
  await page.waitForSelector('#v6md.cp .v6lpf');
  // compact: the level-up face (cheerful) from the reference-sheet portraits, 64 x 64 at 1x: the first of seven
  assert.deepEqual(await page.$eval('#v6md .v6lpf', e => { const s = getComputedStyle(e); return [e.dataset.face, s.width, s.height, s.backgroundPosition, s.imageRendering]; }), ['cheerful', '64px', '64px', '0px 0px', 'pixelated']);
  assert.equal(await page.locator('#v6md .v6lfull').count(), 0, 'the portrait replaces the full figure when compact');
  assert.deepEqual(errors, []); await ctx.close();
});

test('portraits: the strip from the reference sheet loads (7 faces of 64 px), each expression picks its own face', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed() });
  const r = await page.evaluate(async () => {
    const img = new Image(); img.src = 'assets/img/luna-faces.webp'; await img.decode();
    const d = document.createElement('div'); d.innerHTML = ['cheerful', 'apologetic', 'idle', 'greet'].map(e => HWLuna.portrait(e, 2)).join(''); document.body.appendChild(d);
    return { w: img.naturalWidth, h: img.naturalHeight, faces: [...d.children].map(e => [e.dataset.face, e.style.backgroundPosition, e.style.width, e.getAttribute('aria-label')]) };
  });
  assert.deepEqual([r.w, r.h], [448, 64]);
  // at 2x a face is 128 px wide: apologetic is the 7th (index 6) → −768 px; idle uses the calm "focused" face (index 2) → −256 px
  assert.deepEqual(r.faces, [['cheerful', '0px 0px', '128px', 'Luna, cheerful'], ['apologetic', '-768px 0px', '128px', 'Luna, apologetic'], ['focused', '-256px 0px', '128px', 'Luna, focused'], ['cheerful', '0px 0px', '128px', 'Luna, cheerful']]);
  await go(page, 'home'); await page.click('.hbar .v6lb');
  assert.equal(await page.getAttribute('#mo .v6lpic .v6lpf', 'data-face'), 'cheerful', 'Ask Luna shows her portrait');
  assert.deepEqual(errors, []); await ctx.close();
});

test('tapping Luna opens Ask Luna; no bubble appears over an open dialog', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed() });
  await go(page, 'home');
  await page.evaluate(() => HWMedius.say('first', { c: 'water' }));
  await page.waitForSelector('#v6md .v6lav');
  await page.click('#v6md .v6lav');
  await page.waitForSelector('#mo:not([hidden]) .v6lp');
  assert.equal(await page.getAttribute('#mo .v6lp', 'role'), 'dialog');
  await page.evaluate(() => { const M = st.md; M.last = {}; M.seen = {}; HWMedius.say('level', { level: 5, name: 'Hero' }); });
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#v6md').count(), 0, 'held while the dialog is open');
  await page.keyboard.press('Escape');
  assert.ok(await page.$eval('#mo', m => m.hidden), 'Escape closes Ask Luna');
  await page.waitForSelector('#v6md', { timeout: 10000 });
  assert.match(await page.textContent('#v6md'), /Level 5/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('Ask Luna finds features by word, follows the help style, and GO opens the page', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed({ med: 0 }) });
  await go(page, 'home');
  await page.click('.hbar .v6lb');
  await page.fill('#v6lq', 'drink');
  assert.match(await page.textContent('#v6lres'), /Water log/);
  assert.match(await page.textContent('#v6lres'), /The amount you drank, in mL/, 'Guided shows the tracker\'s own "what to enter"');
  await page.fill('#v6lq', 'zzzz');
  assert.match(await page.textContent('#v6lres'), /No page matches/);
  await page.fill('#v6lq', 'sleep');
  await page.click('[data-a="lunast"][data-m="q"]');
  assert.equal((await state(page)).s.lst, 'q');
  assert.equal(await page.inputValue('#v6lq'), 'sleep', 'the search survives a style change');
  assert.doesNotMatch(await page.textContent('#v6lres'), /Start:/, 'Quick: names only');
  await page.click('[data-a="lunast"][data-m="e"]');
  assert.match(await page.textContent('#v6lres'), /Why:[\s\S]*ENTERED BY YOU|ENTERED BY YOU[\s\S]*Why:/, 'Explore: why it matters and where the numbers come from');
  await page.click('#v6lres [data-a="lunago"][data-v="sleep"]');
  assert.equal(await page.evaluate(() => S.v), 'sleep');
  assert.ok(await page.$eval('#mo', m => m.hidden));
  assert.ok(await page.$('main header .v6lb'), 'every page header carries the Ask Luna button');
  assert.deepEqual(errors, []); await ctx.close();
});

test('Ask Luna lists the page\'s "?" explanations and points at one, opening the same panel', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed({ med: 0 }) });
  await go(page, 'stats');
  const n = await page.evaluate(() => [...document.querySelectorAll('#main .hwh')].filter(b => b.offsetParent).length);
  assert.ok(n >= 1, 'the statistics page has explanations');
  await page.click('main header .v6lb');
  assert.equal(await page.locator('#mo [data-a="lunahelp"]').count(), n);
  const want = await page.evaluate(() => [...document.querySelectorAll('#main .hwh')].filter(b => b.offsetParent)[0].getAttribute('aria-label').replace(/^About:?\s*/, ''));
  await page.click('#mo [data-a="lunahelp"][data-i="0"]');
  await page.waitForSelector('#hwh-pop:not([hidden])');
  assert.equal(await page.textContent('#hwh-t'), want);
  assert.ok(await page.$('#main .hwh.v6lpt'), 'the "?" is marked while it opens');
  assert.deepEqual(errors, []); await ctx.close();
});

test('Settings: one Luna card (talk, size, style, reset); Medius keeps his voice switch; nothing new in the schema', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed({ lst: 'e', lsz: 1 }) });
  await go(page, 'set');
  const t = await page.textContent('#v6lunaset');
  assert.match(t, /LUNA COMPANION[\s\S]*Chatty[\s\S]*Compact[\s\S]*Explore[\s\S]*RESET/);
  assert.match(t, /nothing is sent anywhere/);
  assert.ok(await page.$('#v6medset [data-a="medv"]'));
  await page.click('#v6lunaset [data-a="lunarst"]');
  const s = (await state(page)).s;
  assert.deepEqual([s.lst, s.lsz, s.med], [undefined, undefined, 1]);
  assert.equal((await state(page)).sv, 9, 'Luna adds no schema version of her own (9 is the Science Laboratory)');
  assert.deepEqual(errors, []); await ctx.close();
});

test('reduced motion: Luna stays still; the guide labels Medius\'s older words', async () => {
  const { page, ctx, errors } = await openApp({ seed: { ...seed(), md: { ...quietMd, log: [{ t: 'An old line.', at: '2026-10-01T09:00:00.000Z', type: 'greet' }, { t: 'A new line.', at: '2026-10-02T09:00:00.000Z', type: 'log', who: 'L' }] } }, context: { reducedMotion: 'reduce' } });
  await go(page, 'home');
  await page.evaluate(() => HWMedius.say('level', { level: 2, name: 'Trail Walker' }));
  await page.waitForSelector('#v6md .v6lfull');
  const anim = await page.evaluate(() => [...document.querySelectorAll('#v6md .v6lfull, #v6md .v6ls')].map(e => getComputedStyle(e).animationName));
  assert.ok(anim.length >= 5 && anim.every(a => a === 'none'), 'no animation with reduced motion: ' + anim);
  assert.equal(await page.locator('.hbar .v6lb .v6lmini').count(), 1, 'the header button shows her face');
  await go(page, 'guide');
  const g = await page.textContent('#v6medlog');
  assert.match(g, /LUNA'S RECENT WORDS[\s\S]*A new line\.[\s\S]*An old line\.”\s*Medius ·/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('phone: the launcher keeps a 44 px tap target, the bubble and Ask Luna stay inside the screen', async () => {
  const { page, ctx, errors } = await openApp({ ...PHONE, seed: seed() });
  await go(page, 'home');
  const b = await page.$eval('.hbar .v6lb', e => { const r = e.getBoundingClientRect(); return [r.width, r.height, r.right]; });
  assert.ok(b[0] >= 44 && b[1] >= 44 && b[2] <= 360, JSON.stringify(b));
  await page.evaluate(() => HWMedius.say('comeback', { gap: 4 }));
  await page.waitForSelector('#v6md');
  await page.waitForTimeout(500); // after the bubble's slide-in
  const r = await page.$eval('#v6md', e => { const r = e.getBoundingClientRect(); return [r.left, r.right, r.bottom, document.querySelector('nav').getBoundingClientRect().top]; });
  assert.ok(r[0] >= 0 && r[1] <= 360 && r[2] <= r[3], 'bubble inside, above the menu: ' + r);
  await page.evaluate(() => { document.getElementById('v6md').remove(); HWLuna.open(); });
  const p = await page.$eval('#mo .v6lp', e => { const r = e.getBoundingClientRect(); return [r.left, r.right, document.documentElement.scrollWidth]; });
  assert.ok(p[0] >= 0 && p[1] <= 360 && p[2] <= 360, 'panel inside, no sideways scroll: ' + p);
  assert.deepEqual(errors, []); await ctx.close();
});

test('her movements come from the sheet\'s poses: every pose is used; a bubble walks in, then strikes the pose for the moment', async () => {
  const { page, ctx, errors } = await openApp({ seed: seed() });
  const m = await page.evaluate(() => ({ map: HWLuna.POSEOF, poses: HWLuna.poses, exprs: HWLuna.expressions }));
  for (const e of m.exprs) assert.ok(m.poses.includes(m.map[e]), e + ' has a pose');
  const used = new Set([...Object.values(m.map), 'walk']); // walk: every bubble's entrance
  assert.deepEqual(m.poses.filter(p => !used.has(p)), [], 'all nine poses from the sheet are used');
  await go(page, 'home');
  await page.evaluate(() => HWMedius.say('greet', {}));
  await page.waitForSelector('#v6md .v6lfull');
  const r = await page.$eval('#v6md .v6lfull', f => [f.dataset.pose, f.classList.contains('enter'), getComputedStyle(f.querySelector('.v6lfi')).animationName]);
  assert.deepEqual(r, ['wave', true, 'v6lwalk'], 'a greeting walks in and waves');
  // a mounted figure can change pose
  assert.equal(await page.evaluate(() => { const f = document.querySelector('#v6md .v6lfull'); HWLuna.pose(f, 'think'); return f.dataset.pose + ' ' + f.querySelector('.v6lfi').style.backgroundPosition; }), 'think 62.5% 0px');
  assert.deepEqual(errors, []); await ctx.close();
});
