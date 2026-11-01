// Menu magnesium, tryptophan and caffeine estimates (js/v6-menu-nutrients.js, data/menu_micronutrient_dataset.*, tools/build_menu_nutrients.py).
// Values come from the USDA SR Legacy tables for the few menu rows that are ONE food; everything else is unavailable, never 0.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);
const root = new URL('../', import.meta.url), read = rel => fs.readFileSync(new URL(rel, root), 'utf8');
const DATASET = JSON.parse(read('data/menu_micronutrient_dataset.json'));
const LABEL = 'Nutritional estimate derived from food composition tables; not chemical assay.';
const NUTS = ['magnesiumMg', 'tryptophanMg', 'caffeineMg'];
const boot = async () => { const r = await openApp(); await r.page.waitForSelector('.wl'); return r; };
function parseCSV(t) { const rows = []; let row = [], cell = '', q = false; for (let i = 0; i < t.length; i++) { const c = t[i];
  if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
  else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; } else cell += c; }
  if (cell || row.length) { row.push(cell); rows.push(row); } return rows; }

test('every mapped menu row has plausible, positive values, the label, a USDA record, and nothing is 0 or invented', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => { const H = HWMenuNutrients, rows = H.exportRows(), est = rows.filter(x => x.isEstimated), una = rows.filter(x => !x.isEstimated);
    return { total: rows.length, est: est.length, una: una.length, menu: MENU.foods.length, estRows: est, unaKeys: [...new Set(una.flatMap(x => Object.keys(x)))].sort(), reasons: [...new Set(una.map(x => x.reason))] }; });
  assert.deepEqual([r.total, r.menu, r.est, r.una], [152, 152, 23, 129]);
  for (const x of r.estRows) {
    assert.equal(x.estimateLabel, LABEL, x.name); assert.equal(x.sourceRef, 'USDA_FDC_SR_Legacy_2018-04'); assert.ok(['direct', 'close'].includes(x.match), x.name + ' match');
    assert.ok(Number.isInteger(x.fdcId) && x.fdcDescription, x.name + ' has its USDA record'); assert.ok(x.servingGrams > 0 && x.servingGrams <= 600, x.name + ' grams');
    assert.ok(NUTS.some(n => n in x), x.name + ' has at least one value');
    for (const n of NUTS) if (n in x) { assert.equal(typeof x[n], 'number'); assert.ok(Number.isFinite(x[n]) && x[n] > 0, x.name + ' ' + n + ' is positive, never a false 0: ' + x[n]); }
    assert.ok(!('magnesiumMg' in x) || x.magnesiumMg <= 200, x.name + ' Mg plausible'); assert.ok(!('tryptophanMg' in x) || x.tryptophanMg <= 500, x.name + ' Trp plausible'); assert.ok(!('caffeineMg' in x) || x.caffeineMg <= 150, x.name + ' caffeine plausible');
    // the menu's own calories agree with the USDA food within a plausible band (Teh O differs only because the canteen tea is sweetened)
    if (x.menuKcalOverUsdaKcal != null && x.name !== 'Teh O') assert.ok(x.menuKcalOverUsdaKcal >= .6 && x.menuKcalOverUsdaKcal <= 1.6, x.name + ' kcal ratio ' + x.menuKcalOverUsdaKcal);
    assert.ok(x.basis && ['magnesium', 'tryptophan', 'caffeine'].every(k => typeof x.basis[k] === 'string'), x.name + ' says how every value is backed');
  }
  assert.ok(!r.unaKeys.some(k => NUTS.includes(k) || k === 'estimateLabel' || k === 'fdcId'), 'an unavailable row carries no nutrient values and no label: ' + r.unaKeys);
  assert.deepEqual(r.reasons.length >= 2, true); assert.ok(r.reasons.every(s => /no estimate|so no/i.test(s)), 'each says there is no estimate');
  assert.deepEqual(errors, []); await ctx.close();
});

test('worked examples: per-serving = per 100 g × grams ÷ 100, and a missing USDA value stays missing', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => { const L = (n, p) => HWMenuNutrients.lookup(n, p); return { egg: L('Telur Rebus', '1/2 Biji x 30g'), rice: L('Nasi Putih', '200g'), teh: L('Teh O', '200ml'), milk250: L('Susu Penuh Krim UHT', '250ml'), milk200: L('Susu Penuh Krim UHT', '1 kotak / 200ml'),
    choco: L('Minuman Susu Bercoklat', '200ml'), raisin: L('Kismis', '10g'), bread: L('Roti Putih', '2 keping x 30g'), water: L('Air Kosong', '250ml'), honey: L('Madu', '10g'), soy2: [L('Air Soya', '1 kotak / 250ml'), L('Air Soya', '1 Kotak / 250ml')].map(x => x && x.magnesiumMg) }; });
  // hard-boiled egg (USDA 173424): 10 mg Mg and 153 mg Trp per 100 g, caffeine only an assumed zero → 30 g serving
  assert.deepEqual([r.egg.servingGrams, r.egg.magnesiumMg, r.egg.tryptophanMg, 'caffeineMg' in r.egg], [30, 3, 45.9, false]);
  assert.deepEqual([r.rice.magnesiumMg, r.rice.tryptophanMg, 'caffeineMg' in r.rice], [24, 62, false]);          // 12 mg and 31 mg per 100 g, 200 g
  assert.deepEqual([r.teh.caffeineMg, r.teh.magnesiumMg, 'tryptophanMg' in r.teh], [40, 6, false]);               // 20 mg caffeine and 3 mg Mg per 100 g; a tryptophan of 0 had no measurement, so it is absent
  assert.deepEqual([r.milk200.magnesiumMg, r.milk200.tryptophanMg, r.milk250.magnesiumMg, r.milk250.tryptophanMg], [20, 80, 25, 100]);
  assert.deepEqual([r.choco.caffeineMg, r.choco.magnesiumMg], [2, 26]);
  assert.deepEqual([r.raisin.magnesiumMg, 'tryptophanMg' in r.raisin], [3.6, false]);                              // the record has no tryptophan: absent, not 0
  assert.deepEqual([r.bread.magnesiumMg, 'tryptophanMg' in r.bread, 'caffeineMg' in r.bread], [13.8, false, false]);
  assert.deepEqual([r.water.magnesiumMg, 'caffeineMg' in r.water], [2.5, false]); assert.equal(r.honey.magnesiumMg, .2);
  assert.deepEqual(r.soy2, [62.5, 62.5], 'both soy-milk rows are mapped');
  assert.deepEqual(errors, []); await ctx.close();
});

test('mixed dishes, drinks of unknown recipe and rows without grams return undefined, never 0; Kopi, Teh Tarik and Milo are not on the menu', async () => {
  const { page, ctx, errors } = await boot();
  const r = await page.evaluate(() => { const L = (n, p) => HWMenuNutrients.lookup(n, p), rows = HWMenuNutrients.exportRows(), by = n => rows.filter(x => x.name === n);
    return { dishes: ['Nasi Lemak|200g', 'Ayam Goreng|125g', 'Roti Canai|80g', 'Nasi Goreng Kampung|210g', 'Ikan Kembung Goreng|100g', 'Minuman Bermalta|200ml', 'Air Sirap|250ml', 'Kurma|3 biji', 'Nonexistent|1g'].map(k => { const [n, p] = k.split('|'); return [k, L(n, p)]; }),
      notOnMenu: ['Kopi', 'Kopi O', 'Teh Tarik', 'Milo'].map(n => [n, MENU.foods.some(f => f[0].toLowerCase() === n.toLowerCase()), HWMenuNutrients.lookup(n, '200ml')]),
      kurma3: by('Kurma').map(x => [x.portion, x.status, !!(x.reason && /gives no weight/.test(x.reason))]), nulls: HWMenuNutrients.lookup(null, undefined), anyMalt: rows.filter(x => /bermalta/i.test(x.name)).map(x => x.status) }; });
  for (const [k, v] of r.dishes) assert.equal(v, undefined, k + ' has no estimate');
  assert.deepEqual(r.notOnMenu, [['Kopi', false, undefined], ['Kopi O', false, undefined], ['Teh Tarik', false, undefined], ['Milo', false, undefined]]);
  assert.deepEqual(r.kurma3, [['30g', 'estimated', false], ['3 biji', 'unavailable', true]]);   // the same food: mapped with a weight, unavailable without one
  assert.equal(r.nulls, undefined); assert.deepEqual(r.anyMalt, ['unavailable', 'unavailable']);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the export: the page builds exactly the committed dataset, the JSON and CSV are clean, and the download helpers work', async () => {
  const { page, ctx, errors } = await boot();
  const out = await page.evaluate(() => ({ obj: JSON.parse(HWMenuNutrients.toJSON()), csv: HWMenuNutrients.toCSV(), typeJ: typeof exportMenuNutrientsJSON, typeC: typeof exportMenuNutrientsCSV }));
  assert.deepEqual(out.obj.items, DATASET.items, 'the in-app export equals data/menu_micronutrient_dataset.json');
  assert.deepEqual(out.obj.meta.counts, { menuRows: 152, estimated: 23, unavailable: 129 }); assert.deepEqual(out.obj.meta.source.nutrientIds, { magnesium: 1090, tryptophan: 1210, caffeine: 1057 });
  assert.equal(out.obj.meta.label, LABEL); assert.match(out.obj.meta.policy, /never 0/); assert.match(out.obj.meta.source.portal, /^https:\/\/fdc\.nal\.usda\.gov\//);
  const text = JSON.stringify(out.obj); assert.ok(!/NaN|undefined|Infinity/.test(text), 'no NaN or undefined in the JSON');
  // the CSV, in the page and on disk
  assert.equal(out.csv, read('data/menu_micronutrient_dataset.csv'), 'the in-app CSV is byte-for-byte the committed file');
  for (const csv of [out.csv, read('data/menu_micronutrient_dataset.csv')]) {
    const rows = parseCSV(csv).filter(r => r.length > 1); assert.equal(rows.length, 153, 'a header and 152 rows'); const h = rows[0];
    assert.deepEqual(h.slice(0, 6), ['menuIndex', 'id', 'name', 'portion', 'energyKcal', 'status']);
    for (const row of rows.slice(1)) { assert.equal(row.length, h.length, 'every row has every column'); for (const n of NUTS) { const v = row[h.indexOf(n)]; assert.ok(v === '' || (Number.isFinite(+v) && +v > 0), n + ' is blank or positive: ' + v); } assert.ok(!row.some(c => /NaN|undefined/.test(c))); }
    assert.equal(rows.filter(r => r[h.indexOf('isEstimated')] === 'true').length, 23);
  }
  assert.equal(out.typeJ, 'function'); assert.equal(out.typeC, 'function');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportMenuNutrientsJSON())]);
  assert.equal(dl.suggestedFilename(), 'menu_micronutrient_dataset.json'); const saved = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  assert.deepEqual(saved.items, DATASET.items);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportMenuNutrientsCSV())]); assert.equal(dl2.suggestedFilename(), 'menu_micronutrient_dataset.csv');
  assert.deepEqual(errors, []); await ctx.close();
});

test('provenance lives in the data files and the build tool; the app\'s own source and Vault lists stay free of USDA (the project rule, tests/67); the other sources are recorded with what was checked', async () => {
  const { page, ctx, errors } = await boot();
  assert.equal(DATASET.meta.source.ref, 'USDA_FDC_SR_Legacy_2018-04'); assert.match(DATASET.meta.source.file, /FoodData_Central_sr_legacy_food_csv_2018-04\.zip$/);
  for (const x of DATASET.items.filter(i => i.isEstimated)) { assert.ok(x.fdcId && x.fdcDescription && x.per100g && x.basis, x.name); assert.ok(!Object.values(x.per100g).some(v => v === 0), x.name + ': no per-100 g zero'); }
  for (const f of ['js/v6-sources.js', 'js/v6-vault.js', 'js/v6-addfood.js', 'sw.js', 'index.html', 'supabase/functions/food-guess/index.ts']) assert.doesNotMatch(read(f), /USDA|FoodData|food-search|FDC_API_KEY|foodparts/i, f + ' names no USDA');
  const S = await page.evaluate(() => ({ ids: HWSources.all().map(r => r.id), rec: Object.fromEntries(['nistwater', 'blanchard83', 'iom2001'].map(id => [id, HWSources.all().find(r => r.id === id) || null])) }));
  assert.ok(!S.ids.includes('usdasr') && !S.ids.includes('fdc'), 'no food-composition record in the app\'s source list');
  for (const [id, r] of Object.entries(S.rec)) { assert.ok(r, id + ' is a source record'); assert.match(r.u, /^https:\/\//); for (const k of ['t', 'by', 'in', 'd', 'k', 's', 'c']) assert.ok(r[k], id + ' has ' + k); }
  assert.match(S.rec.nistwater.s, /2429\.8 kJ\/kg at 30 °C[\s\S]*2422\.7 at 33 °C/); assert.match(S.rec.nistwater.c, /subtracted the liquid enthalpy from the vapour enthalpy myself/); assert.match(S.rec.nistwater.x, /PURE water/);
  assert.match(S.rec.iom2001.c, /SUPPLIED BY THE PROJECT OWNER and have not been read in the book/, 'the unverified sentence is labelled as such'); assert.match(S.rec.iom2001.x, /Show the spread, not one number/);
  assert.match(S.rec.blanchard83.s, /2\.7 to 9\.9 h/);
  assert.equal(await page.evaluate(() => HWVault.has('menumicro')), false, 'no Vault entry names the food-composition source');
  assert.deepEqual(errors, []); await ctx.close();
});

test('the original menu file is untouched, the module is small, registered, and regenerates from the map', () => {
  const menu = read('js/hw-01-menu-data.js'); assert.ok(!/magnesiumMg|tryptophanMg|caffeineMg/.test(menu), 'js/hw-01-menu-data.js (an original, size-limited file) was not edited');
  assert.ok(Buffer.byteLength(menu) < 64 * 1024); const mod = read('js/v6-menu-nutrients.js'); assert.ok(Buffer.byteLength(mod) < 24 * 1024, 'v6-menu-nutrients.js is ' + Buffer.byteLength(mod));
  assert.ok(/\/\*DATA-START\*\/[\s\S]*\/\*DATA-END\*\//.test(mod), 'the generated data block is marked');
  const html = read('index.html'); assert.ok(html.indexOf('js/hw-01-menu-data.js') < html.indexOf('js/v6-menu-nutrients.js')); assert.ok(read('sw.js').includes("'js/v6-menu-nutrients.js'"));
  const map = JSON.parse(read('tools/menu_nutrient_map.json')).items; assert.equal(map.length, 23); assert.equal(new Set(map.map(m => m.idx)).size, 23, 'each menu row is mapped once');
  assert.ok(map.every(m => ['direct', 'close'].includes(m.match) && Number.isInteger(m.fdc)));
  assert.ok(fs.statSync(new URL('data/menu_micronutrient_dataset.json', root)).size < 128 * 1024); assert.ok(/USDA_FDC_SR_Legacy/.test(read('tools/build_menu_nutrients.py')));
});
