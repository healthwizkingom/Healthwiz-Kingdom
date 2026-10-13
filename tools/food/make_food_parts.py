"""Builds js/v6-foodparts.js: the USDA FoodData Central foods the Wannabe Wizard builds his estimates from.

Every value is copied from the official FoodData Central CSV downloads (public domain, CC0), never typed by hand:
  FNDDS 2021-2023  https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_csv_2024-10-31.zip
  SR Legacy        https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
Usage: python3 tools/food/make_food_parts.py DIR   (DIR holds the two unzipped folders)
Per part: energy (208, kcal), protein (203), carbohydrate by difference (205), fat (204) per 100 g, and one household
measure with its gram weight from the same food's food_portion table, chosen by the pattern below.
"""
import csv, glob, json, os, re, sys

D = sys.argv[1] if len(sys.argv) > 1 else '.'
# key: (FDC ID, pattern for the household measure to use; 'Quantity not specified' is FNDDS's default amount)
PARTS = {
  # bases
  'rice': (2708408, r'^1 cup, cooked'), 'ricecoco': (2709032, r'^1 cup$'), 'ricefried': (2708952, r'^1 cup$'),
  'riceoil': (2708404, r'^1 cup, cooked'), 'ricebrown': (2708414, r'^1 cup, cooked'), 'riceglut': (2708422, r'^1 cup, cooked'),
  'noodle': (2708352, r'^1 cup, cooked'), 'ricenoodle': (2708356, r'^1 cup, cooked'), 'pasta': (2708357, r'^1 cup, cooked'),
  'broth': (2707133, r'^1 cup$'), 'coconutmilk': (2707568, r'^1 fl oz'), 'oil': (172370, r'^1 tablespoon'),
  'paratha': (2707715, r'^1 paratha'), 'chapati': (171844, r'^1 piece'), 'bread': (2707598, r'^1 medium or regular slice'),
  'burger': (2706920, r'^1 hamburger'), 'cheeseburger': (2706888, r'^1 cheeseburger'), 'pizza': (2708616, r'^1 piece, medium pizza'),
  'fries': (2709456, r'^1 cup$'), 'nugget': (2706093, r'^1 nugget'), 'hotdog': (2706166, r'^1 regular'),
  'chickensoup': (2707133, r'^1 cup$'), 'vegsoup': (2710111, r'^1 cup$'), 'beefsoup': (2707127, r'^1 cup$'),
  # drinks (per fl oz, so a glass is a count of fl oz)
  'tea': (2710488, r'^1 fl oz'), 'coffee': (2710375, r'^1 fl oz'), 'milk': (171265, r'^1 fl oz'), 'chocmilk': (2705467, r'^1 fl oz'),
  'soda': (2710536, r'^1 fl oz \(NFS\)'), 'oj': (169100, r'^1 fl oz'), 'water': (2710707, r'^1 cup$'),
  'condensed': (2705402, r'^1 fl oz'), 'sugar': (2710258, r'^1 teaspoon'),
  # meat, fish, egg, soy
  'chickenfried': (2705996, r'^1 leg quarter'), 'chickenwing': (2706057, r'^1 wing'), 'chickengrill': (2705942, r'^1 piece'),
  'chickencurry': (2706437, r'^1 cup$'), 'beefcurry': (2706388, r'^1 cup$'), 'fishfried': (2706227, r'^1 small/regular fillet'),
  'fishbaked': (2706225, r'^1 small/regular fillet'), 'prawnfried': (2706364, r'^1 prawn'), 'prawn': (2706363, r'^1 prawn'),
  'squidfried': (2706334, r'^1 item'), 'anchovy': (2706232, r'^1 anchovy'), 'eggfried': (2707158, r'^1 egg'),
  'eggboiled': (2707154, r'^1 egg'), 'omelette': (2707200, r'^1 egg'), 'duckegg': (2707176, r'^1 egg'),
  'tofufried': (172451, r'^1 piece'), 'tempeh': (174272, r'^1 cup'), 'sausage': (2706190, r'^1 piece'),
  'peanuts': (2707516, r'^1 oz, NFS'),
  # vegetables, crackers, fruit
  'cucumber': (2709784, r'^1 cup$'), 'greens': (2709789, r'^1 cup$'), 'stirveg': (2710036, r'^1 cup$'),
  'sprouts': (2709871, r'^1 cup$'), 'keropok': (2708246, r'^1 chip'), 'apple': (2709215, r'^1 medium'),
  'banana': (2709224, r'^1 banana'), 'orange': (2709171, r'^1 fruit'), 'guava': (2709238, r'^1 fruit'), 'papaya': (2709246, r'^1 slice/chunk'),
  'doughnut': (2708062, r'^1 doughnut'), 'icecream': (2705629, r'^1 scoop'),
  # sauces and extras
  'curry': (2710178, r'^1 tablespoon'), 'dal': (2707427, r'^1 cup$'), 'peanutsauce': (2707546, r'^1 tablespoon'),
  'soy': (2707442, r'^1 tablespoon'), 'chilisauce': (2709735, r'^1 tablespoon'), 'ketchup': (2709733, r'^1 tablespoon'),
  'mayo': (2710204, r'^1 tablespoon'), 'fishsauce': (2706457, r'^1 tablespoon'), 'coconut': (2707500, r'^1 cup$'),
  'meatsauce': (2706470, r'^1 cup$'), 'butter': (2710154, r'^1 pat'), 'cheese': (2705709, r'^1 slice'),
}
NUM = {'208': 'k', '203': 'p', '205': 'c', '204': 'f', '1008': 'k', '1003': 'p', '1005': 'c', '1004': 'f'}

def load(sub, typ):
    root = glob.glob(os.path.join(D, sub, '*'))[0]
    F = {r['fdc_id']: r['description'] for r in csv.DictReader(open(os.path.join(root, 'food.csv'), encoding='utf-8'))}
    N = {}
    for r in csv.DictReader(open(os.path.join(root, 'food_nutrient.csv'), encoding='utf-8')):
        k = NUM.get(r['nutrient_id'])
        if k: N.setdefault(r['fdc_id'], {})[k] = float(r['amount'])
    P = {}
    for r in csv.DictReader(open(os.path.join(root, 'food_portion.csv'), encoding='utf-8')):
        lab = r['portion_description'] or ' '.join(x for x in (r['amount'].rstrip('0').rstrip('.'), r['modifier']) if x)
        P.setdefault(r['fdc_id'], []).append((lab.strip(), float(r['gram_weight'])))
    return {i: (typ, F[i], N.get(i, {}), P.get(i, [])) for i in F}

DB = {**load('sr', 'SR Legacy'), **load('fn', 'Survey (FNDDS)')}
out = {}
for key, (fid, pat) in PARTS.items():
    typ, name, n, por = DB[str(fid)]
    assert all(x in n for x in 'kpcf'), (key, fid, n)
    m = [p for p in por if re.search(pat, p[0])]
    assert m, (key, fid, por)
    out[key] = [fid, typ, name, n['k'], n['p'], n['c'], n['f'], m[0][0], m[0][1]]
    print(f'{key:13} {fid:8} {name[:60]:60} {n["k"]:6} kcal/100 g | {m[0][0]} = {m[0][1]} g')
js = ('/* Generated by tools/food/make_food_parts.py from the USDA FoodData Central CSV downloads (FNDDS 2021-2023 and\n'
      '   SR Legacy, public domain). Do not edit by hand: rerun the tool. Per part: [FDC ID, data type, USDA name, kcal, protein g,\n'
      '   carbohydrate g, fat g per 100 g, household measure, its grams]. */\n'
      'const HWFoodParts=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(os.path.dirname(__file__), '..', '..', 'js', 'v6-foodparts.js'), 'w', encoding='utf-8').write(js)
print(len(out), 'parts')
