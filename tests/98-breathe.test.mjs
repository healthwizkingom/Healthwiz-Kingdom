// Paced breathing with your own pulse (js/v6-breathe.js): the lantern practice gets optional pulse before / after fields (memory only),
// a clock-based INHALE / EXHALE phase (4 s in, 6 s out), and a PACED BREATHING GUIDE button beside RECOVER NOW. No second guide.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser, go, state, dass, stairHistory } from './helpers.mjs';

after(closeBrowser);
const boot = async o => { const r = await openApp(o); await r.page.waitForSelector('.wl'); return r; };
const bootStairs = async () => { const r = await boot(); await go(r.page, 'pulse'); await stairHistory(r.page); return r; };
async function toLantern(page) { await go(page, 'stress'); await dass(page, 1); await page.click('[data-a="sqe"]'); await page.click('[data-a="rxo"][data-id="lantern"]'); }
// the page's clock can be moved forward, so a 60 s practice does not need a 60 s wait (the phase reads Date.now())
const skew = (page, ms) => page.evaluate(ms => { if (!window.__real) { window.__real = Date.now; window.__off = 0; Date.now = () => window.__real() + window.__off; } window.__off = ms; }, ms);
const txt = (page, sel) => page.textContent(sel).then(t => t.replace(/\s+/g, ' ').trim());

test('phase(): the 4 s in / 6 s out cycle is 10 s (0.1 Hz), edges, wrap, clock jumps; change() needs both numbers', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => { const B = HWBreath, p = ms => { const x = B.phase(ms); return [x.label, x.sec, x.cycle]; };
    const edges = new Set(); for (let t = 0; t < 60000; t += 100) edges.add(B.phase(t).edge);
    return { p: [0, 999, 3999, 4000, 4999, 9999, 10000, 14000, 59999, 60000, -50, NaN, 'x', null].map(p), edges: edges.size, in10: B.phase(25000), k: [B.IN_MS, B.CYCLE_MS, B.TOTAL_MS],
      c: [B.change(84, 76), B.change('84', '90'), B.change(84, ''), B.change(84, null), B.change(29, 76), B.change(84, 221), B.change(null, null)] }; });
  assert.deepEqual(r.p, [['INHALE', 0, 0], ['INHALE', 0, 0], ['INHALE', 3, 0], ['EXHALE', 0, 0], ['EXHALE', 0, 0], ['EXHALE', 5, 0], ['INHALE', 0, 1], ['EXHALE', 0, 1],
    ['EXHALE', 5, 5], ['INHALE', 0, 6], ['INHALE', 0, 0], ['INHALE', 0, 0], ['INHALE', 0, 0], ['INHALE', 0, 0]]);
  assert.equal(r.edges, 12, '60 s = 6 breaths = 12 in/out switches');
  assert.deepEqual([r.in10.label, r.in10.sec, r.in10.cycle], ['EXHALE', 1, 2]);       // 25 s: third breath, 1 s into the out-breath
  assert.deepEqual(r.k, [4000, 10000, 60000]);
  assert.deepEqual(r.c, [{ b: 84, a: 76, diff: -8 }, { b: 84, a: 90, diff: 6 }, null, null, null, null, null]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the lantern in the Stress Quest: pulse before on the start screen, phase from the clock, pulse after, your numbers, nothing saved', async () => {
  const { page, ctx, errors } = await boot({ viewport: { width: 390, height: 844 } });
  await toLantern(page);
  const t = await txt(page, '#pc-before');
  assert.match(t, /Slow paced breathing, about 6 breaths a minute, with a longer out-breath\. Some people find it calming\./);
  assert.match(t, /Stop if you feel lightheaded or dizzy\./); assert.match(t, /not saved/);
  assert.equal(await page.inputValue('#pc-b'), '', 'never pre-filled');
  await page.fill('#pc-b', '29'); assert.match(await txt(page, '#pc-sb'), /between 30 and 220/);
  await page.fill('#pc-b', '83'); assert.match(await txt(page, '#pc-sb'), /Typed in by you/);
  const eBefore = JSON.stringify((await state(page)).e);
  await skew(page, 0); await page.click('[data-a="rxs"]'); await page.waitForSelector('#bl');
  assert.equal(await txt(page, '#bl'), 'INHALE');
  await skew(page, 5000); await page.waitForFunction(() => document.getElementById('bl').textContent === 'EXHALE', null, { timeout: 4000 });
  assert.equal(await txt(page, '#bl'), 'EXHALE', '5 s in: the out-breath');
  await skew(page, 25000); await page.waitForFunction(() => /^3[3-5]s left$/.test(document.getElementById('bt').textContent), null, { timeout: 4000 });   // 25 s of skew plus the 1 to 2 s really elapsed
  assert.equal(await txt(page, '#bl'), 'EXHALE', 'about 26 s in: the out-breath of the third breath, though only a few ticks have run');
  await skew(page, 61000); await page.waitForSelector('#pc-after', { timeout: 4000 });
  assert.equal(await txt(page, '#pc-res'), 'Add both numbers to see the difference.', 'one number (the before) is kept, but no difference is shown');
  await page.fill('#pc-a', '71');
  assert.match(await txt(page, '#pc-res'), /Before 83 · after 71 · difference −12 BPM \(your numbers; typed by you\)\. A guide only, not a medical measurement\./);
  await page.click('[data-a="sqt"][data-i="2"]');
  assert.match(await txt(page, '#pc-done'), /Before 83 · after 71 · difference −12 BPM/);
  const s = await state(page); assert.equal(JSON.stringify(s.e), eBefore, 'no entry was written');
  const raw = await page.evaluate(() => Object.keys(localStorage).map(k => localStorage.getItem(k)).join('|'));
  assert.ok(!/pcb|pca|"pulse before"|difference/.test(raw), 'the pulse numbers are not stored');
  assert.deepEqual(errors, []); await ctx.close();
});

test('skipping the pulse fields never invents numbers; one number shows no difference; a new look starts empty', async () => {
  const { page, ctx, errors } = await boot();
  await toLantern(page);
  await skew(page, 0); await page.click('[data-a="rxs"]'); await page.waitForSelector('#bl'); await skew(page, 61000); await page.waitForSelector('#pc-after', { timeout: 4000 });
  assert.equal(await page.inputValue('#pc-a'), ''); assert.equal(await txt(page, '#pc-res'), '');
  await page.click('[data-a="sqt"][data-i="1"]');
  assert.equal(await page.locator('#pc-done').count(), 0, 'no numbers, no result line');
  await page.evaluate(() => { S.sq.ph = 'enc'; render(); });
  await page.click('[data-a="rxo"][data-id="lantern"]'); assert.equal(await page.inputValue('#pc-b'), '');
  assert.deepEqual(errors, []); await ctx.close();
});

test('PACED BREATHING GUIDE sits beside RECOVER NOW and opens the lantern directly, never logging a check-in', async () => {
  const { page, ctx, errors } = await bootStairs();
  assert.equal(await page.locator('#sthrc [data-a="recstart"]').count(), 1, 'Recover Now is unchanged');
  assert.equal(await page.locator('#sthrc [data-a="brstart"]').count(), 1);
  const html = await page.$eval('#main', e => e.innerHTML);
  assert.ok(html.indexOf('data-a="recstart"') < html.indexOf('data-a="brstart"') && html.indexOf('data-a="brstart"') < html.indexOf('id="rec-mount"'), 'beside Recover Now');
  const from = await page.evaluate(() => S.v);
  await page.evaluate(() => { S.sq = { ph: 'feel' }; });                      // a quest the person had open
  await page.click('#sthrc [data-a="brstart"]');
  assert.equal(await page.evaluate(() => S.v), 'stress');
  assert.match(await txt(page, 'main'), /Empower Yourself/); assert.equal(await page.locator('#pc-before').count(), 1);
  await page.fill('#pc-b', '88');
  await skew(page, 0); await page.click('[data-a="rxs"]'); await page.waitForSelector('#bl'); await skew(page, 61000); await page.waitForSelector('#pc-after', { timeout: 4000 });
  await page.fill('#pc-a', '80'); assert.match(await txt(page, '#pc-res'), /difference −8 BPM/);
  await page.click('[data-a="sqt"][data-i="2"]');
  assert.equal(await page.locator('[data-a="sqa"], [data-a="sqn"]').count(), 0, 'no "next tool" buttons without a quest'); assert.equal(await page.locator('[data-a="brback"]').count(), 1);
  await page.click('[data-a="brback"]');
  assert.equal(await page.evaluate(() => S.v), from, 'back where the person was');
  assert.deepEqual(await page.evaluate(() => S.sq), { ph: 'feel' }, 'the quest that was open is put back');
  assert.equal((await state(page)).e.filter(e => e.c === 'stress').length, 0, 'no stress check-in was logged');
  assert.deepEqual(errors, []); await ctx.close();
});

test('leaving a direct practice by the back arrow or the bottom bar restores the earlier state; the back arrow works mid-breath', async () => {
  const { page, ctx, errors } = await bootStairs();
  const from = await page.evaluate(() => S.v);
  await page.click('#sthrc [data-a="brstart"]'); await page.click('[data-a="rxs"]'); await page.waitForSelector('#bl');
  await page.click('[data-a="rxb"]');
  assert.equal(await page.evaluate(() => S.v), from); assert.deepEqual(await page.evaluate(() => S.sq), { ph: 'start' });
  await page.click('#sthrc [data-a="brstart"]'); await page.evaluate(() => go('home'));
  assert.deepEqual(await page.evaluate(() => S.sq), { ph: 'start' }, 'the bottom bar also ends it');
  assert.deepEqual(errors, []); await ctx.close();
});

test('honest wording: no nerve, HRV or treatment claim, no emoji in the new text; new file is small and registered', async () => {
  const { page, ctx, errors } = await boot();
  await toLantern(page);
  const t = await txt(page, '#pc-before');
  assert.doesNotMatch(t, /vagus|vagal|nerve|HRV|variab|treat|cure|therapy|clinical|parasympath|stress hormone/i);
  assert.doesNotMatch(t, /\p{Extended_Pictographic}/u);
  const src = fs.readFileSync(new URL('../js/v6-breathe.js', import.meta.url), 'utf8'), body = src.slice(src.indexOf('/* ---------- the user'));
  assert.doesNotMatch(body, /\p{Extended_Pictographic}/u);
  assert.ok(Buffer.byteLength(src) < 12 * 1024, 'v6-breathe.js is ' + Buffer.byteLength(src));
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.ok(html.indexOf('js/v6-dass.js') < html.indexOf('js/v6-breathe.js'), 'loads after the DASS wrapper so it wraps the final page'); assert.ok(sw.includes("'js/v6-breathe.js'"));
  assert.deepEqual(errors, []); await ctx.close();
});
