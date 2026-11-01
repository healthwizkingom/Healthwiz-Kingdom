#!/usr/bin/env python3
"""Build the menu micronutrient dataset from the USDA FoodData Central SR Legacy tables.

  python3 tools/build_menu_nutrients.py --usda /path/to/FoodData_Central_sr_legacy_food_csv_2018-04

Download (public domain, CC0):  https://fdc.nal.usda.gov/download-datasets.html  ->  SR Legacy (CSV, April 2018)
  https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip

Reads tools/menu_nutrient_map.json (which menu item is which USDA food) and js/hw-01-menu-data.js (the 152 menu rows), takes EVERY nutrient value
from the USDA tables (nothing typed by hand), and writes:
  data/menu_micronutrient_dataset.json   all 152 rows: the mapped ones with values, the rest marked unavailable with the reason
  data/menu_micronutrient_dataset.csv    the same, flat
  the DATA block of js/v6-menu-nutrients.js (between the DATA-START / DATA-END markers)

Rules (docs/FEATURE_CONSULTS.md, AGENTS.md): a nutrient with no USDA value stays missing (never 0). A USDA value of 0 counts only if it was
MEASURED (the record has data points); a 0 with none is an assumed zero ("insignificant amount or not naturally occurring", code Z / BFZN, or a
table value rounded to 0) and is left missing too, so no false zero reaches a graph.
Per-serving = per-100-g value x serving grams / 100, one decimal. Tryptophan is converted from g to mg. ml is treated as g (density 1).
"""
import argparse, csv, json, math, re, sys, os

NUT = {'1090': 'magnesium', '1210': 'tryptophan', '1057': 'caffeine', '1008': 'energy'}
LABEL = 'Nutritional estimate derived from food composition tables; not chemical assay.'
SRC_REF = 'USDA_FDC_SR_Legacy_2018-04'
REASONS = ['default', 'drink', 'nograms']
UNAVAILABLE = {
    'default': 'No single USDA SR Legacy food corresponds to this item (a mixed dish, or a food whose recipe or edible portion is not known), so no estimate is given.',
    'drink': 'A sweet or malted drink whose recipe is not known, so no estimate is given.',
    'nograms': 'The menu gives no weight for this portion, so no per-serving estimate is possible.',
}

def parse_grams(portion):
    p = portion.lower().replace(',', '.')
    m = re.search(r'(\d+(?:\.\d+)?)\s*[a-z]+\s*x\s*(\d+(?:\.\d+)?)\s*g\b', p)          # "2 keping x 30g", "1 potong x 40g"
    if m: return float(m.group(1)) * float(m.group(2)), 'count x grams'
    m = re.search(r'(\d+(?:\.\d+)?)\s*g\b', p)
    if m: return float(m.group(1)), 'grams'
    m = re.search(r'(\d+(?:\.\d+)?)\s*ml\b', p)
    if m: return float(m.group(1)), 'ml treated as g'
    return None, None

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--usda', required=True); ap.add_argument('--root', default=os.path.join(os.path.dirname(__file__), '..'))
    ap.add_argument('--date', default='2026-11-01'); a = ap.parse_args(); R = os.path.abspath(a.root); D = a.usda.rstrip('/') + '/'
    menu_js = open(os.path.join(R, 'js/hw-01-menu-data.js'), encoding='utf-8').read()
    menu = json.JSONDecoder().raw_decode(menu_js[menu_js.index('const MENU=') + len('const MENU='):])[0]['foods']
    mp = {i['idx']: i for i in json.load(open(os.path.join(R, 'tools/menu_nutrient_map.json'), encoding='utf-8'))['items']}
    foods = {r['fdc_id']: r['description'] for r in csv.DictReader(open(D + 'food.csv', encoding='utf-8'))}
    der = {r['id']: r['code'] for r in csv.DictReader(open(D + 'food_nutrient_derivation.csv', encoding='utf-8'))}
    want = {str(i['fdc']) for i in mp.values()}; rec = {f: {} for f in want}
    for r in csv.DictReader(open(D + 'food_nutrient.csv', encoding='utf-8')):
        if r['fdc_id'] in want and r['nutrient_id'] in NUT:
            rec[r['fdc_id']][NUT[r['nutrient_id']]] = dict(amount=float(r['amount']), n=int(r['data_points'] or 0), code=der.get(r['derivation_id'], ''))
    items = []; codes_by_idx = {}
    for idx, (name, portion, kcal) in enumerate(menu):
        g, gbasis = parse_grams(portion); row = dict(menuIndex=idx, id='kmk-%03d' % idx, name=name, portion=portion, energyKcal=kcal)
        m = mp.get(idx)
        if m and m.get('grams'): g, gbasis = float(m['grams']), 'stated in the map: ' + m['gramsNote']
        if not m or not g:
            code = 'nograms' if (m is None and g is None) else 'drink' if re.match(r'(air |minuman )', name.lower()) else 'default'
            row.update(status='unavailable', isEstimated=False, reason=UNAVAILABLE[code]); codes_by_idx[idx] = REASONS.index(code); items.append(row); continue
        f = str(m['fdc']); r = rec[f]; per100 = {}; basis = {}
        for k in ('magnesium', 'tryptophan', 'caffeine'):
            x = r.get(k)
            if x is None: basis[k] = 'no value in the USDA record'; continue
            if x['amount'] == 0 and x['n'] == 0: basis[k] = 'USDA value 0 has no measurements behind it (%s): left unavailable' % ('assumed zero, code ' + x['code'] if x['code'] else 'a table value rounded to 0'); continue
            v = x['amount'] * 1000 if k == 'tryptophan' else x['amount']; per100[k] = round(v, 3)
            basis[k] = ('analytical, n=%d' % x['n'] if x['n'] > 0 else 'table value') + (', USDA code ' + x['code'] if x['code'] else '')
        e100 = r.get('energy', {}).get('amount'); ratio = round(kcal / (e100 * g / 100), 2) if (kcal and e100) else None
        s = lambda k: math.floor(per100[k] * g / 100 * 10 + 0.5 + 1e-9) / 10 if k in per100 else None      # the same arithmetic as js/v6-menu-nutrients.js
        row.update(status='estimated', isEstimated=True, estimateLabel=LABEL, servingGrams=g, servingBasis=gbasis, match=m['match'], note=m.get('note', ''),
                   magnesiumMg=s('magnesium'), tryptophanMg=s('tryptophan'), caffeineMg=s('caffeine'), sourceRef=SRC_REF, fdcId=m['fdc'], fdcDescription=foods[f],
                   per100g={k: per100.get(k) for k in ('magnesium', 'tryptophan', 'caffeine')}, basis=basis, usdaKcalPer100g=e100, menuKcalOverUsdaKcal=ratio)
        for k in ('magnesiumMg', 'tryptophanMg', 'caffeineMg'):
            if row[k] is None: del row[k]
        items.append(row)
    meta = dict(title='Kolej MARA Kulim canteen menu: estimated magnesium, tryptophan and caffeine per serving', generated=a.date, label=LABEL, units=dict(magnesiumMg='mg per serving', tryptophanMg='mg per serving', caffeineMg='mg per serving', per100g='mg per 100 g edible portion'),
        source=dict(ref=SRC_REF, name='USDA FoodData Central, SR Legacy (April 2018), public domain (CC0)', portal='https://fdc.nal.usda.gov/download-datasets.html', file='https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip', nutrientIds=dict(magnesium=1090, tryptophan=1210, caffeine=1057)),
        policy='Only items that correspond to one USDA food are mapped. A nutrient with no USDA value, or only an assumed zero, is omitted, never 0. ml is treated as g. The menu has no Kopi, Teh Tarik or Milo, and no "Lukes" menu (Luke looks foods up live on the web).',
        counts=dict(menuRows=len(items), estimated=sum(i['isEstimated'] for i in items), unavailable=sum(not i['isEstimated'] for i in items)))
    json.dump(dict(meta=meta, items=items), open(os.path.join(R, 'data/menu_micronutrient_dataset.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    cols = ['menuIndex', 'id', 'name', 'portion', 'energyKcal', 'status', 'isEstimated', 'servingGrams', 'servingBasis', 'match', 'magnesiumMg', 'tryptophanMg', 'caffeineMg', 'sourceRef', 'fdcId', 'fdcDescription', 'menuKcalOverUsdaKcal', 'estimateLabel', 'reason', 'note']
    with open(os.path.join(R, 'data/menu_micronutrient_dataset.csv'), 'w', encoding='utf-8', newline='') as fh:
        w = csv.writer(fh); w.writerow(cols)
        def cell(v):                      # the same text as the in-app export (true / false, 3 not 3.0)
            if v is None: return ''
            if isinstance(v, bool): return 'true' if v else 'false'
            if isinstance(v, float) and v.is_integer(): return str(int(v))
            return v
        for i in items: w.writerow([cell(i.get(c)) for c in cols])
    comp = [dict(i=r['menuIndex'], n=r['name'], p=r['portion'], g=r['servingGrams'], gb=r['servingBasis'], m=r['match'], f=r['fdcId'], d=r['fdcDescription'], h=[r['per100g']['magnesium'], r['per100g']['tryptophan'], r['per100g']['caffeine']],
                 b=[r['basis'][k] for k in ('magnesium', 'tryptophan', 'caffeine')], k=r['usdaKcalPer100g'], q=r['menuKcalOverUsdaKcal'], x=r['note']) for r in items if r['isEstimated']]
    js_path = os.path.join(R, 'js/v6-menu-nutrients.js'); js = open(js_path, encoding='utf-8').read()
    codes = ''.join(str(codes_by_idx[i['menuIndex']]) if not i['isEstimated'] else '-' for i in items)
    block = '/*DATA-START*/\nconst GENERATED=' + json.dumps(a.date) + ',REASONS=' + json.dumps([UNAVAILABLE[c] for c in REASONS], ensure_ascii=False) + ',UNAV=' + json.dumps(codes) + ';\nconst ROWS=' + json.dumps(comp, ensure_ascii=False, separators=(',', ':')) + ';\n/*DATA-END*/'
    js = re.sub(r'/\*DATA-START\*/.*?/\*DATA-END\*/', lambda _: block, js, flags=re.S); open(js_path, 'w', encoding='utf-8').write(js)
    print('rows %d, estimated %d, unavailable %d' % (len(items), meta['counts']['estimated'], meta['counts']['unavailable']))
    print('menu kcal / USDA kcal for each mapped row (a big gap means the mapping is doubtful):')
    for r in items:
        if r['isEstimated']: print('  %3d %-34s %5.0f g  x%-5s Mg=%-5s Trp=%-6s Caf=%-5s  %s' % (r['menuIndex'], r['name'][:34], r['servingGrams'], r['menuKcalOverUsdaKcal'], r.get('magnesiumMg'), r.get('tryptophanMg'), r.get('caffeineMg'), r['fdcDescription'][:46]))
if __name__ == '__main__': main()
