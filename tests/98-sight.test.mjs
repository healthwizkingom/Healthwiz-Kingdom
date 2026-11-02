// Stair Sight, the 2D step finder (js/v6-stairsight.js), checked on REAL pictures: the app's own photo of each staircase (assets/stairs) and
// pictures that are not stairs. Before the 2026-11-01 tuning (a 64 x 80 grid) it locked on 16 of the 30 staircase photos and found only the
// lower few steps of a long flight; the upper steps are 3 or 4 rows apart on that grid and merged. This pins the better behaviour.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);
const root = new URL('../', import.meta.url);
const b64 = rel => fs.readFileSync(new URL(rel, root)).toString('base64');
const mimeOf = n => n.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
/** a picture → the tracker, exactly as the Scrying Glass feeds it (cropped 4:5, grey, DW x DH), pushed 3 times: {locks, edges} */
const SEE = `async ([data, mime]) => { const img = new Image(); img.src = 'data:' + mime + ';base64,' + data; await img.decode();
  const DW = HWStairSight.DW, DH = HWStairSight.DH, c = document.createElement('canvas'); c.width = DW; c.height = DH; const x = c.getContext('2d', { willReadFrequently: true });
  const a = DW / DH, vw = img.naturalWidth, vh = img.naturalHeight; let sx = 0, sy = 0, sw = vw, sh = vh; if (vw / vh > a) { sw = vh * a; sx = (vw - sw) / 2 } else { sh = vw / a; sy = (vh - sh) / 2 }
  x.drawImage(img, sx, sy, sw, sh, 0, 0, DW, DH); const d = x.getImageData(0, 0, DW, DH).data, g = new Float32Array(DW * DH); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = .3 * d[j] + .59 * d[j + 1] + .11 * d[j + 2];
  const t = HWStairSight.tracker(), locks = []; for (let i = 0; i < 3; i++) locks.push(t.push(g).locked); return { locks, edges: t.state.edges, DW, DH }; }`;
async function look(page, rel) { return page.evaluate(([src, data, mime]) => eval(src)([data, mime]), [`(${SEE})`, b64(rel), mimeOf(rel)]); }
const real = r => r.edges.filter(e => !e.fill);

test('the grid is fine enough to separate the upper steps of a long flight (128 x 160)', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  assert.deepEqual(await page.evaluate(() => [HWStairSight.DW, HWStairSight.DH]), [128, 160]);
  // (a step has two real transitions, tread to riser and riser to the next tread, so both count as truth)
  // a synthetic flight of 14 steps in perspective: each step is 90 % of the one below, so the top ones are only a few rows apart
  const r = await page.evaluate(() => { const DW = HWStairSight.DW, DH = HWStairSight.DH, c = document.createElement('canvas'); c.width = DW; c.height = DH; const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, DW, DH); let y = DH, h = DH * .105, w = DW * .9; const truth = []; for (let i = 0; i < 14; i++) { const t = h * .55, l = (DW - w) / 2;
      x.fillStyle = '#e0e0e0'; x.fillRect(l, y - t, w, t); x.fillStyle = '#303030'; x.fillRect(l, y - h, w, h - t); truth.push(y - t, y - h); y -= h; h *= .9; w *= .965; }
    const d = x.getImageData(0, 0, DW, DH).data, g = new Float32Array(DW * DH); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = .3 * d[j] + .59 * d[j + 1] + .11 * d[j + 2];
    const t = HWStairSight.tracker(); for (let i = 0; i < 3; i++) t.push(g); const E = t.state.edges.filter(e => !e.fill); return { n: E.length, locked: t.state.locked, ys: E.map(e => e.y), truth }; });
  assert.equal(r.locked, true);
  assert.ok(r.n >= 9, 'finds most of the 14 steps, not just the lowest few: ' + r.n);
  assert.ok(r.ys.every((y, i, a) => !i || y < a[i - 1]), 'bottom first');
  // every reported edge sits on a real step edge (within 2 grid rows), so nothing is invented
  assert.ok(r.ys.every(y => r.truth.some(t => Math.abs(t - y) <= 2.5)), 'edges sit on step transitions: ' + JSON.stringify(r));
  assert.deepEqual(errors, []); await ctx.close();
});

test('real staircase photos: clear flights lock with at least 5 step edges, bottom first, each running across most of the stair', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  for (const id of ['ST07', 'ST15', 'ST19', 'ST21', 'ST29', 'ST34']) {
    const r = await look(page, `assets/stairs/${id}.webp`), E = real(r);
    assert.deepEqual(r.locks, [false, false, true], id + ' locks on the third good frame');
    assert.ok(E.length >= 5, id + ' step edges: ' + E.length);
    assert.ok(E.every((e, i, a) => !i || e.y < a[i - 1].y), id + ' listed bottom first');
    assert.ok(E.every(e => (e.x1 - e.x0) >= (r.DW * .7) * .6 - 1), id + ' every edge spans most of the stair width');
  }
  assert.deepEqual(errors, []); await ctx.close();
});

test('across all 30 staircase photos it locks on at least 19 (it was 16), and on none of the pictures that are not stairs', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const ids = (await page.evaluate(() => STAIRS.map(s => s.id))).filter(id => fs.existsSync(new URL(`assets/stairs/${id}.webp`, root)));
  assert.equal(ids.length, 30);
  let locked = 0; for (const id of ids) { const r = await look(page, `assets/stairs/${id}.webp`); if (r.locks[2]) locked++; }
  assert.ok(locked >= 23, 'locked on ' + locked + ' of 30');
  const bad = []; for (const n of ['study.jpg', 'bedimg.jpg', 'bedroom.webp', 'lab-scene.webp', 'orb-scene.webp']) { const r = await look(page, 'assets/img/' + n); if (r.locks[2]) bad.push(n); }
  assert.deepEqual(bad, [], 'a bedroom, a study or a lab is not a staircase');
  assert.deepEqual(errors, []); await ctx.close();
});

test('ST03 (checkerboard steps, the Enchanted Tower): all 11 steps of the flight are found, not just the top four', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await look(page, 'assets/stairs/ST03.webp'), E = real(r);
  assert.equal(r.locks[2], true, 'ST03 locks');
  assert.equal(E.length, 11, 'one edge per step of the 11-step flight: ' + E.length);
  assert.ok(E.every((e, i, a) => !i || e.y < a[i - 1].y), 'bottom first');
  assert.deepEqual(errors, []); await ctx.close();
});

test('still no false lock on a flat picture, one line, or two stripes; a frame is read well inside the 8-a-second budget', async () => {
  const { page, ctx, errors } = await openApp(); await page.waitForSelector('.wl');
  const r = await page.evaluate(() => { const DW = HWStairSight.DW, DH = HWStairSight.DH, grey = paint => { const c = document.createElement('canvas'); c.width = DW; c.height = DH; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#777'; x.fillRect(0, 0, DW, DH); paint(x);
      const d = x.getImageData(0, 0, DW, DH).data, g = new Float32Array(DW * DH); for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = .3 * d[j] + .59 * d[j + 1] + .11 * d[j + 2]; return g; };
    const run = g => { const t = HWStairSight.tracker(); let any = false; for (let i = 0; i < 8; i++) any = t.push(g).locked || any; return any; };
    const stripes = k => grey(x => { x.fillStyle = '#ddd'; for (let i = 0; i < k; i++) x.fillRect(0, 30 + i * 40, DW, 14); });
    const g = stripes(14), t0 = performance.now(); for (let i = 0; i < 50; i++) { const R = HWStairSight.rows(g, DW, DH); HWStairSight.edges(R.prof, R.e, DW, DH); }
    return { flat: run(grey(() => {})), line: run(grey(x => { x.fillStyle = '#ddd'; x.fillRect(0, 80, DW, 40); })), two: run(stripes(2)), ms: (performance.now() - t0) / 50 }; });
  // (evenly spaced stripes, four or more of them, can still fool it, as its header says; the old grid was fooled by fewer)
  assert.deepEqual([r.flat, r.line, r.two], [false, false, false]);
  assert.ok(r.ms < 25, 'one frame takes ' + r.ms.toFixed(1) + ' ms (the glass reads about 8 a second)');
  assert.deepEqual(errors, []); await ctx.close();
});
