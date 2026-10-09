// Comfort pass: sleep log → automatic Dream Battle (once, skippable, reduced motion), the short Medius tour,
// multi-select food logging (no resets, one log action, no duplicates, totals update) and the flowing EXP bar.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, go, state, closeBrowser, RETURNING } from './helpers.mjs';

after(closeBrowser);
const PHONE = { viewport: { width: 390, height: 844 }, context: { hasTouch: true, isMobile: true } };
const sleeps = async page => (await state(page)).e.filter(e => e.c === 'sleep');

test('sleep log starts the Dream Battle by itself, once, with SKIP; the night is saved first', async () => {
  const { page, ctx, errors } = await openApp(PHONE);
  await go(page, 'sleep');
  await page.fill('#slb', '22:30'); await page.fill('#slw', '07:00');
  await page.tap('[data-a="slsave"]');
  assert.equal((await sleeps(page)).length, 1, 'saved before the battle starts');
  // a second tap right away does not log a second night
  await page.evaluate(() => acts.slsave());
  assert.equal((await sleeps(page)).length, 1, 'double submit ignored');
  // the First Dream badge pops up first; the battle waits until it is closed
  await page.waitForSelector('.bpop', { timeout: 3000 });
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#dbat.d-live').count(), 0, 'battle waits behind the badge popup');
  // badge cards now come one after another: close each as it shows, then the battle starts
  for (let k = 0; k < 14 && !(await page.locator('#dbat.d-live').count()); k++) { if (await page.locator('.bpop').count()) await page.tap('.bpop', { force: true }); await page.waitForTimeout(300); }
  await page.waitForSelector('#dbat.d-live', { timeout: 3000 });
  assert.equal(await page.locator('.db6skip').count(), 1, 'SKIP is offered while it plays');
  const box = await page.locator('.db6skip').boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, 'SKIP is a comfortable touch target');
  await page.tap('.db6skip', { force: true });
  assert.equal(await page.locator('.db6skip').count(), 0);
  assert.match(await page.getAttribute('#dbat', 'class'), /d-won|d-lost/, 'outcome shown at once');
  // a redraw of the page does not replay it
  await page.evaluate(() => render());
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#dbat.d-live').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('sleep log → battle: weak sleep loses, strong sleep wins (quality decides as designed)', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'sleep');
  await page.fill('#slb', '03:00'); await page.fill('#slw', '07:00');
  await page.click('[data-a="slsave"]');
  await page.click('.db6skip', { force: true });
  assert.match(await page.getAttribute('#dbat', 'class'), /d-lost/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('reduced motion: saving sleep shows the outcome still, no live battle and no SKIP needed', async () => {
  const { page, ctx, errors } = await openApp({ context: { reducedMotion: 'reduce' } });
  await go(page, 'sleep');
  await page.fill('#slb', '22:00'); await page.fill('#slw', '07:00');
  await page.click('[data-a="slsave"]');
  await page.waitForTimeout(800);
  assert.equal(await page.locator('#dbat.d-live').count(), 0);
  assert.equal(await page.locator('.db6skip').count(), 0);
  assert.match(await page.getAttribute('#dbat', 'class'), /d-won/);
  assert.equal((await sleeps(page)).length, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Medius tour is short, every line brief, SKIP and Escape close it', async () => {
  const { page, ctx, errors } = await openApp();
  const lines = await page.evaluate(() => TS.map(s => s[2]));
  assert.ok(lines.length <= 12, 'at most 12 stops: ' + lines.length);
  assert.ok(lines.every(l => l.length <= 120), 'each line readable in seconds');
  assert.match(lines.join(' '), /Medius/);
  await page.evaluate(() => TUT.start());
  assert.equal(await page.locator('#tut').count(), 1);
  await page.click('.tsk');
  assert.equal(await page.locator('#tut').count(), 0);
  await page.evaluate(() => TUT.start());
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#tut').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('food: several foods selected without a redraw, one LOG SELECTED, totals update, no duplicates', async () => {
  const { page, ctx, errors } = await openApp(PHONE);
  await go(page, 'food');
  await page.fill('#q', 'nasi');
  await page.focus('#q');
  const main0 = await page.evaluate(() => { window.__m = document.querySelector('#fcal'); return true; });
  const it = page.locator('#fl .it');
  await it.nth(0).tap(); await it.nth(1).tap(); await it.nth(2).tap(); await it.nth(1).tap();
  assert.ok(main0 && await page.evaluate(() => window.__m === document.querySelector('#fcal')), 'page not redrawn while choosing');
  assert.equal(await page.inputValue('#q'), 'nasi', 'search kept');
  assert.equal(await page.locator('#fl .it[aria-pressed="true"]').count(), 2);
  // switching meal keeps the selection
  await page.click('[data-a="meal"][data-m="lunch"]');
  assert.equal(await page.evaluate(() => HWFoodSel.selected.length), 2);
  assert.match(await page.textContent('#fsel'), /Logged as Lunch/);
  await page.locator('#fsel [data-a="qp"]').first().click();
  const names = await page.evaluate(() => HWFoodSel.selected.map(x => F[x.i][0]));
  await page.locator('#fsel [data-a="addfood"]').click();
  await page.evaluate(() => acts.addfood({}));          // an immediate second tap does nothing
  const food = (await state(page)).e.filter(e => e.c === 'food');
  assert.deepEqual(food.map(e => e.m.name), names);
  assert.ok(food.every(e => e.m.meal === 'lunch'));
  assert.equal(food[0].m.qty, 2);
  const k = food.reduce((a, e) => a + e.v, 0);
  assert.match(await page.textContent('#fcal'), new RegExp('Calories consumed\\s*' + k));
  assert.equal(await page.evaluate(() => HWFoodSel.selected.length), 0, 'selection cleared after logging');
  await page.waitForFunction(() => /Logged 2 foods/.test(document.getElementById('toasts').textContent), null, { timeout: 8000 });   // popups now come one at a time
  const toasts = await page.evaluate(() => [...document.querySelectorAll('#toasts > div')].map(d => d.textContent));
  assert.ok(toasts.some(t => /Logged 2 foods/.test(t)), 'one summary toast: ' + toasts);
  assert.ok(!toasts.some(t => /^\+10 XP Meal logged/.test(t)), 'no toast per food');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('food without listed kcal: nothing is logged until its kcal is entered', async () => {
  const { page, ctx, errors } = await openApp();
  await go(page, 'food');
  const i = await page.evaluate(() => F.findIndex(f => f[2] == null));
  if (i < 0) { await ctx.close(); return; }
  await page.evaluate(i => { S.q = F[i][0]; render(); }, i);
  await page.click(`#fl .it[data-i="${i}"]`);
  await page.click('#fsel [data-a="addfood"]');
  assert.equal((await state(page)).e.filter(e => e.c === 'food').length, 0);
  await page.fill('#fsel [data-in="fsck"]', '200');
  await page.click('#fsel [data-a="addfood"]');
  const f = (await state(page)).e.filter(e => e.c === 'food');
  assert.equal(f.length, 1); assert.equal(f[0].v, 200); assert.equal(f[0].m.u, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('EXP bar: modern progressbar, flows on gain, still under reduced motion', async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { page, ctx, errors } = await openApp({ seed: { ...RETURNING, xp: 100 }, context: { reducedMotion } });
    await go(page, 'water');
    const b = page.locator('main header .lv .bar');
    assert.equal(await b.getAttribute('role'), 'progressbar');
    assert.match(await b.getAttribute('class'), /xpb/);
    await page.click('[data-a="wa"][data-v="250"]');
    await page.waitForTimeout(100);
    const g = await page.locator('main header .lv .xpb-gain').count();
    assert.ok(g <= 1, 'one label at a time');
    const vis = g ? await page.locator('main header .lv .xpb-gain').isVisible() : false;
    if (reducedMotion === 'reduce') assert.equal(vis, false, 'no floating label with reduced motion');
    else assert.equal(vis, true, '+XP label rises beside the bar');
    await page.waitForTimeout(1200);
    const w = await page.evaluate(() => { const L = lvl(); return [parseFloat(document.querySelector('main header .lv .bar i').style.width), (st.xp - L.lo) / (L.hi - L.lo) * 100]; });
    assert.ok(Math.abs(w[0] - w[1]) < 0.5, 'settles on the real value ' + w);
    assert.match(await b.getAttribute('aria-valuetext'), /XP/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('security: markup in stored or imported entry fields is never injected (ids, values, times, numbers, meal keys)', async () => {
  const X = n => `"'><img src=x data-xss="${n}" onerror="window.__xss=(window.__xss||[]).concat('${n}')">`;
  const d = new Date(); const day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const e = [
    { id: 'a1' + X('id'), c: 'food', v: X('v'), m: { name: X('fname'), qty: X('qty'), pm: X('pm'), meal: X('meal'), custom: 1 }, n: X('note'), d: day, t: X('t') },
    { id: 'a2', c: 'sleep', v: 7, m: { bed: X('bed'), wake: X('wake'), aw: X('aw'), lat: X('lat'), rest: X('rest'), score: X('score') }, n: '', d: day, t: '07:00' },
    { id: 'a3', c: 'stress', v: 5, m: { feel: X('feel'), why: [X('why')], end: X('end') }, n: '', d: day, t: '08:00' },
    { id: 'a6', c: 'bmi', v: X('bmiv'), m: {}, n: '', d: day, t: '11:00' },
  ];
  const { page, ctx } = await openApp({ seed: { ...RETURNING, e, p: { ...RETURNING.p, name: X('pname') } } });
  for (const v of ['home', 'food', 'sleep', 'stress', 'bmi', 'stats', 'set']) { await go(page, v); await page.waitForTimeout(80); }
  await page.evaluate(() => acts.edit({ id: st.e[0].id }));
  // the backup-restore path
  const r = await page.evaluate(b => { const o = impParse(JSON.stringify({ e: b })); return o.o.e.map(x => [x.id, x.t, x.m.qty, x.m.meal]); }, [{ ...e[0], v: 100 }]);
  assert.ok(r.every(x => !/[<>"]/.test(x.join(''))), 'import cleaned: ' + JSON.stringify(r));
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  assert.equal(await page.locator('[data-xss]').count(), 0);
  await ctx.close();
});

test('every progress bar uses the modern style; a changed bar flows to its new value (still with reduced motion)', async () => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { page, ctx, errors } = await openApp({ context: { reducedMotion } });
    for (const v of ['home', 'food', 'quests', 'sleep']) {
      await go(page, v);
      const bad = await page.evaluate(() => [...document.querySelectorAll('#main .bar, #main .db6bar, #main .esplit')].filter(b => { const c = getComputedStyle(b), a = getComputedStyle(b, '::after');
        return parseFloat(c.borderTopWidth) > 0 || parseFloat(c.borderTopLeftRadius) < 4 || (a.content !== 'none' && a.display !== 'none' && /repeating/.test(a.backgroundImage)); }).map(b => b.className));
      assert.deepEqual(bad, [], v + ': old-style bars');
    }
    await go(page, 'food');
    const r = await page.evaluate(async () => { const q = () => document.querySelector('#fcal .bar i'), f = e => e.getBoundingClientRect().width / e.parentNode.getBoundingClientRect().width;
      add('food', 1100, { name: 'X', por: '1', qty: 1, pm: 1, meal: 'lunch', src: 'x', u: 0 }, '', 0, 0, 10, 'm'); render(); render();
      await new Promise(r => setTimeout(r, 150)); const a = f(q()); await new Promise(r => setTimeout(r, 1300)); return [a, f(q())]; });
    assert.ok(Math.abs(r[1] - 0.5) < 0.02, 'settles on the real value ' + r);
    if (reducedMotion === 'reduce') assert.ok(Math.abs(r[0] - 0.5) < 0.02, 'no flow with reduced motion ' + r);
    else assert.ok(r[0] < 0.45, 'flows in ' + r);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
