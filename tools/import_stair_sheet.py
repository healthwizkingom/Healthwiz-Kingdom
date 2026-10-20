"""Read the filled-in Word stair data sheet into data/stair-survey.json, which HealthWiz loads on top of its own stair list.

    python3 tools/import_stair_sheet.py path/to/HealthWiz_Campus_Stair_Data_Sheet.docx      (from the repository root)

The blank sheet is prototypes/campus-observatory/data/source/HealthWiz_Campus_Stair_Data_Sheet.docx; the steps are in
prototypes/campus-observatory/UPDATE_DATA.md. This is the prototype's tool (prototypes/campus-observatory/tools/), adapted
to compare against the app itself: STAIRS in js/hw-02-core.js (IDs, stored coordinates) and the F21 step sizes in
HWStairs.STUDY (js/v6-stairs.js), instead of the prototype's data/staircases.json. The output format is unchanged.

Python 3.8 or later, nothing to install (it reads the .docx with the standard library).

What it does:
  * reads Part 1 (stair register), Part 2 (flights and landings), Part 3 (buildings) and Part 4 (setup answers);
  * keeps only cells you filled in: a blank cell stays "not surveyed", it is never guessed or copied from the app data;
  * checks every number (units, ranges, campus area, risers x riser height against the measured total rise, ...) and
    lists anything doubtful in data/stair-survey-report.md, without changing your value; a value it cannot read at all
    (for example "about 15") is left out and reported;
  * writes data/stair-survey.json and data/stair-survey-report.md. It never edits js/hw-02-core.js or js/v6-stairs.js
    (the app's own, unverified records): the app lays the survey over them when the page loads (js/v6-campus-data.js).
Run it again whenever the sheet changes: the JSON and the report are rebuilt from the sheet each time.
"""
import datetime, hashlib, json, math, os, re, sys, zipfile
import xml.etree.ElementTree as ET

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT_JSON = os.path.join(ROOT, 'data', 'stair-survey.json')
OUT_REPORT = os.path.join(ROOT, 'data', 'stair-survey-report.md')
CORE_JS = os.path.join(ROOT, 'js', 'hw-02-core.js')     # STAIRS: one JSON object per line
STAIRS_JS = os.path.join(ROOT, 'js', 'v6-stairs.js')    # HWStairs.STUDY: the Group 14 F21 report's measured step sizes
# a generous box around the campus map (data/campus-osm.geojson bounds plus about 600 m)
LAT = (5.342, 5.360); LNG = (100.530, 100.546)


def app_data():
    """The app's records by ID, in the prototype's field names: latitude, longitude and (F21 stairs only) measuredStep."""
    app = {}
    for line in open(CORE_JS, encoding='utf-8'):
        line = line.strip().rstrip(',')
        if line.startswith('{"id": "ST'):
            q = json.loads(line)
            app[q['id']] = {'id': q['id'], 'name': q['name'], 'latitude': q.get('lat'), 'longitude': q.get('lng'), 'measuredStep': None}
    if not app:
        sys.exit('Could not read STAIRS from ' + os.path.relpath(CORE_JS, ROOT) + '; run this from a HealthWiz checkout.')
    src = open(STAIRS_JS, encoding='utf-8').read()
    study = src[src.index('const STUDY=['):src.index('];', src.index('const STUDY=['))]
    for m in re.finditer(r"id:'(ST\d+)',rise:([\d.]+),run:([\d.]+)", study):
        if m.group(1) in app:
            app[m.group(1)]['measuredStep'] = {'rise_m': float(m.group(2)), 'run_m': float(m.group(3))}
    return app


def tables(path):
    """Every table in the document as a list of rows, each row a list of cell texts (paragraphs joined by newlines)."""
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    out = []
    for tbl in root.iter(W + 'tbl'):
        rows = []
        for tr in tbl.findall(W + 'tr'):
            cells = []
            for tc in tr.findall(W + 'tc'):
                paras = [''.join(t.text or '' for t in p.iter(W + 't')) for p in tc.findall(W + 'p')]
                cells.append('\n'.join(paras).strip())
            rows.append(cells)
        out.append(rows)
    return out


class Sheet:
    def __init__(self):
        self.warnings = []

    def warn(self, sid, field, msg, level='check'):
        self.warnings.append({'id': sid, 'field': field, 'level': level, 'message': msg})

    def num(self, sid, field, raw, lo=None, hi=None, soft=None, integer=False, unit=''):
        """A number from a cell, or None. lo/hi: outside is rejected (left out); soft: outside is kept but reported."""
        s = (raw or '').strip()
        if not s or s in ('-', '–', '—', 'n/a', 'N/A', 'na', '?'):
            return None
        t = s.replace(' ', ' ')
        if re.fullmatch(r'-?\d+,\d+', t):
            self.warn(sid, field, f'"{s}" read as {t.replace(",", ".")} (a comma was used as the decimal point).', 'note')
            t = t.replace(',', '.')
        m = re.fullmatch(r'\s*(-?\d+(?:\.\d+)?)\s*([a-zA-Z°%]*)\s*', t)
        if not m:
            self.warn(sid, field, f'"{s}" is not a number, so it was left out. Write digits only (the unit is in the column title).', 'error')
            return None
        v = float(m.group(1))
        if m.group(2) and m.group(2).lower() not in (unit.lower(), '°', 'deg'):
            self.warn(sid, field, f'"{s}" has the unit "{m.group(2)}"; this column is in {unit or "plain numbers"}. Read as {v}; please check.', 'check')
        if integer:
            if v != int(v):
                self.warn(sid, field, f'"{s}" should be a whole number; left out.', 'error'); return None
            v = int(v)
        if (lo is not None and v < lo) or (hi is not None and v > hi):
            self.warn(sid, field, f'{v} {unit} is outside the possible range ({lo} to {hi}); left out. Check the digits.', 'error')
            return None
        if soft and not (soft[0] <= v <= soft[1]):
            self.warn(sid, field, f'{v} {unit} is unusual (typical {soft[0]} to {soft[1]}). Kept; please re-measure if it is a typo.', 'check')
        return v

    def date(self, sid, raw):
        s = (raw or '').strip()
        if not s:
            return None
        for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y', '%d/%m/%y', '%d %B %Y', '%d %b %Y'):
            try:
                return datetime.datetime.strptime(s, fmt).date().isoformat()
            except ValueError:
                pass
        self.warn(sid, 'Date', f'"{s}" is not a date I can read; kept as written. Use 2026-11-03 or 03/11/2026.', 'check')
        return s

    def text(self, raw):
        s = (raw or '').strip()
        return s or None


def col(header, *keys):
    """Index of the first header cell containing all keys (case-insensitive), or None."""
    for i, h in enumerate(header):
        hl = h.lower()
        if all(k.lower() in hl for k in keys):
            return i
    return None


SHAPES = {'straight': 'straight', 'l': 'L', 'l-shape': 'L', 'l shape': 'L', 'u': 'U', 'u-shape': 'U', 'u shape': 'U',
          'switchback': 'U', 'spiral': 'spiral', 'other': 'other'}
TURNS = {'straight': 'straight', 'none': 'straight', 'left': 'left', 'l': 'left', 'right': 'right', 'r': 'right',
         'reverse': 'reverse', 'u': 'reverse', 'u-turn': 'reverse', 'uturn': 'reverse', '180': 'reverse'}


def main(path):
    sh = Sheet()
    T = tables(path)
    app = app_data()
    reg = next((t for t in T if t and t[0] and t[0][0].lower().startswith('stair (from the app')), None)
    fl = next((t for t in T if t and len(t[0]) > 1 and t[0][0].strip() == 'ID' and t[0][1].lower().startswith('flight')), None)
    bl = next((t for t in T if t and t[0] and t[0][0].lower().startswith('building / block name') and len(t) > 1 and len(t[0]) > 6), None)
    qa = next((t for t in T if t and t[0][:2] == ['Question', 'Your answer']), None)
    if not reg or not fl:
        sys.exit('This does not look like the HealthWiz stair data sheet (Part 1 and Part 2 tables not found).')

    stairs = {}
    # ---------- Part 1: the register ----------
    h = reg[0]
    c = {k: col(h, *v) for k, v in {
        'building': ('building',), 'io': ('indoor',), 'lower': ('lower',), 'upper': ('upper',), 'shape': ('shape',),
        'nfl': ('no. of flights',), 'blat': ('bottom', 'lat'), 'blng': ('bottom', 'long'), 'bacc': ('bottom', 'acc'),
        'tlat': ('top', 'lat'), 'tlng': ('top', 'long'), 'tacc': ('top', 'acc'), 'by': ('by',), 'date': ('date',), 'tool': ('tool',)}.items()}
    get = lambda row, k: row[c[k]] if c[k] is not None and c[k] < len(row) else ''
    for row in reg[1:]:
        sid = (row[0].split('\n')[0] if row else '').strip()
        if not re.fullmatch(r'ST\d+', sid):
            continue
        if sid not in app:
            sh.warn(sid, 'ID', f'{sid} is not in the app\'s stair list (STAIRS in js/hw-02-core.js); it is kept, but the app will not show it.', 'check')
        r = {'id': sid}
        r['building'] = sh.text(get(row, 'building'))
        r['indoorOutdoor'] = sh.text(get(row, 'io'))
        r['lowerLevel'] = sh.text(get(row, 'lower')); r['upperLevel'] = sh.text(get(row, 'upper'))
        shp = sh.text(get(row, 'shape'))
        if shp:
            r['shape'] = SHAPES.get(shp.lower().strip())
            if not r['shape']:
                sh.warn(sid, 'Shape', f'"{shp}" is not one of straight, L, U, spiral, other; kept as "other".', 'check'); r['shape'] = 'other'
        else:
            r['shape'] = None
        r['flightCount'] = sh.num(sid, 'No. of flights', get(row, 'nfl'), 1, 12, integer=True)
        for end, a, b, acc in (('bottom', 'blat', 'blng', 'bacc'), ('top', 'tlat', 'tlng', 'tacc')):
            la = sh.num(sid, end + ' latitude', get(row, a), -180, 180, unit='')
            lo = sh.num(sid, end + ' longitude', get(row, b), -180, 180, unit='')
            ac = sh.num(sid, end + ' accuracy', get(row, acc), 0, 500, soft=(0, 15), unit='m')
            if la is None and lo is None:
                r[end] = None; continue
            if (la is None) != (lo is None):
                sh.warn(sid, end + ' position', 'Only one of latitude and longitude is filled; the position was left out.', 'error'); r[end] = None; continue
            if LAT[0] <= lo <= LAT[1] and LNG[0] <= la <= LNG[1]:
                sh.warn(sid, end + ' position', f'Latitude and longitude look swapped ({la}, {lo}): latitude is about 5.35, longitude about 100.54. Left out; swap them in the sheet.', 'error'); r[end] = None; continue
            if not (LAT[0] <= la <= LAT[1] and LNG[0] <= lo <= LNG[1]):
                sh.warn(sid, end + ' position', f'{la}, {lo} is outside the campus area. Latitude and longitude swapped, or a digit missing? Left out.', 'error'); r[end] = None; continue
            dec = min(len(str(la).split('.')[-1]), len(str(lo).split('.')[-1]))
            if dec < 5:
                sh.warn(sid, end + ' position', f'Only {dec} decimal places (about {round(111000 / 10 ** dec)} m); use 6 or 7.', 'check')
            a0 = app.get(sid)
            if a0 and a0.get('latitude') is not None and abs(a0['latitude'] - la) < 1e-7 and abs(a0['longitude'] - lo) < 1e-7:
                sh.warn(sid, end + ' position', 'Identical to the unverified app coordinate (grey cell). If you copied it, delete it: only phone readings taken at the stair count.', 'check')
            r[end] = {'lat': la, 'lng': lo, 'accuracy_m': ac}
            if ac is None:
                sh.warn(sid, end + ' accuracy', 'No accuracy written; the map will show the point without an accuracy circle.', 'note')
        r['survey'] = {'by': sh.text(get(row, 'by')), 'date': sh.date(sid, get(row, 'date')), 'tool': sh.text(get(row, 'tool'))}
        r['flights'] = []
        stairs[sid] = r

    # ---------- Part 2: flights and landings ----------
    h = fl[0]
    k = {key: col(h, *v) for key, v in {
        'no': ('flight no',), 'n': ('risers',), 'rh': ('riser height',), 'td': ('tread',), 'w': ('width',),
        'tr': ('total rise',), 'hd': ('heading',), 'll': ('landing length',), 'lw': ('landing width',), 'turn': ('turn',), 'notes': ('notes',)}.items()}
    g = lambda row, key: row[k[key]] if k[key] is not None and k[key] < len(row) else ''
    for row in fl[1:]:
        sid = (row[0] if row else '').strip()
        if sid not in stairs:
            continue
        vals = [g(row, x) for x in ('n', 'rh', 'td', 'w', 'tr', 'hd', 'll', 'lw', 'turn', 'notes')]
        if not any(v.strip() for v in vals):
            continue  # an empty flight row: nothing measured
        no = sh.num(sid, 'Flight no.', g(row, 'no'), 1, 30, integer=True)
        tag = f'flight {no}'
        f = {'flight': no,
             'risers': sh.num(sid, tag + ' risers', g(row, 'n'), 1, 60, soft=(2, 22), integer=True),
             'riser_cm': sh.num(sid, tag + ' riser height', g(row, 'rh'), 5, 35, soft=(12, 21), unit='cm'),
             'tread_cm': sh.num(sid, tag + ' tread depth', g(row, 'td'), 10, 80, soft=(22, 40), unit='cm'),
             'width_cm': sh.num(sid, tag + ' clear width', g(row, 'w'), 40, 1000, soft=(80, 400), unit='cm'),
             'totalRise_cm': sh.num(sid, tag + ' measured total rise', g(row, 'tr'), 10, 1500, unit='cm'),
             'heading_deg': sh.num(sid, tag + ' heading', g(row, 'hd'), 0, 360, unit='°'),
             'landing': None, 'turn': None, 'notes': sh.text(g(row, 'notes'))}
        ll = sh.num(sid, tag + ' landing length', g(row, 'll'), 30, 3000, unit='cm')
        lw = sh.num(sid, tag + ' landing width', g(row, 'lw'), 30, 3000, unit='cm')
        if ll is not None or lw is not None:
            f['landing'] = {'length_cm': ll, 'width_cm': lw}
        t = sh.text(g(row, 'turn'))
        if t:
            f['turn'] = TURNS.get(t.lower().strip())
            if not f['turn']:
                sh.warn(sid, tag + ' turn', f'"{t}" is not straight, left, right or reverse; left out.', 'error')
        if f['risers'] and f['riser_cm'] and f['totalRise_cm']:
            calc = f['risers'] * f['riser_cm']; diff = abs(calc - f['totalRise_cm']) / f['totalRise_cm']
            if diff > .05:
                sh.warn(sid, tag + ' total rise', f'{f["risers"]} risers x {f["riser_cm"]} cm = {calc:.0f} cm, but the measured total rise is {f["totalRise_cm"]:.0f} cm ({diff:.0%} apart). Recount the risers or re-measure.', 'check')
        stairs[sid]['flights'].append(f)

    # per stair: order, consistency, the F21 values, completeness
    for sid, r in stairs.items():
        r['flights'].sort(key=lambda f: f['flight'] or 0)
        nums = [f['flight'] for f in r['flights']]
        if nums and nums != list(range(1, len(nums) + 1)):
            sh.warn(sid, 'Flight no.', f'Flight numbers {nums} are not 1, 2, 3 ... in order; check for a missing or doubled row.', 'check')
        if r['flightCount'] and r['flights'] and r['flightCount'] != len(r['flights']):
            sh.warn(sid, 'No. of flights', f'Part 1 says {r["flightCount"]} flights; Part 2 has {len(r["flights"])} filled rows.', 'check')
        for f in r['flights'][:-1]:
            if not f['turn']:
                sh.warn(sid, f'flight {f["flight"]} turn', 'No "turn after flight" for a flight that is not the last; the 3D model needs it.', 'note')
        m = (app.get(sid) or {}).get('measuredStep')
        for f in r['flights']:
            if m and f['riser_cm'] and f['tread_cm']:
                dr, dt = abs(f['riser_cm'] - m['rise_m'] * 100), abs(f['tread_cm'] - m['run_m'] * 100)
                if dr > 1 or dt > 1:
                    sh.warn(sid, f'flight {f["flight"]} step size', f'Riser {f["riser_cm"]} cm / tread {f["tread_cm"]} cm differs from the F21 report ({m["rise_m"] * 100:.1f} / {m["run_m"] * 100:.1f} cm) by more than 1 cm. Both are kept; check which flight F21 measured.', 'check')
        need = ('risers', 'riser_cm', 'tread_cm', 'width_cm')
        r['complete'] = {
            'position': bool(r.get('bottom')),
            'flights': bool(r['flights']) and all(all(f[x] is not None for x in need) for f in r['flights'])
                       and all(f['turn'] for f in r['flights'][:-1]) and (not r['flightCount'] or r['flightCount'] == len(r['flights'])),
            'record': bool(r['survey']['by'] and r['survey']['date'] and r['survey']['tool']),
        }
        filled = r['complete']['position'] or r['flights'] or r['building'] or r['shape']
        if filled and not r['complete']['record']:
            sh.warn(sid, 'By / Date / Tool', 'Measurements without who, when and with what: they are kept but shown as "survey record incomplete".', 'check')

    # ---------- Part 3: buildings ----------
    buildings = []
    if bl:
        h = bl[0]
        for row in bl[1:]:
            if not any(x.strip() for x in row):
                continue
            name = sh.text(row[0]) or '(no name)'
            corners = []
            for i, hh in enumerate(h):
                if hh.lower().startswith('corner') and i < len(row) and row[i].strip():
                    m2 = re.fullmatch(r'\s*(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)\s*', row[i])
                    if m2:
                        corners.append([float(m2.group(1)), float(m2.group(2))])
                    else:
                        sh.warn(name, hh, f'"{row[i]}" is not "lat, lng"; left out.', 'error')
            levels = {}
            for i, hh in enumerate(h):
                mm = re.match(r'level (\d+)', hh.lower())
                if mm and i < len(row):
                    v = sh.num(name, hh, row[i], 0, 100, soft=(2, 30), unit='m')
                    if v is not None:
                        levels[mm.group(1)] = v
            ci = lambda *kk: col(h, *kk)
            buildings.append({'name': name,
                              'floors': sh.num(name, 'Floors', row[ci('floors')] if ci('floors') is not None else '', 1, 30, integer=True),
                              'roofHeight_m': sh.num(name, 'Roof height', row[ci('roof')] if ci('roof') is not None else '', 1, 120, soft=(3, 40), unit='m'),
                              'heightStatus': sh.text(row[ci('measured or')] if ci('measured or') is not None else ''),
                              'levelHeights_m': levels, 'corners': corners,
                              'notes': sh.text(row[ci('notes')] if ci('notes') is not None else '')})
    answers = {}
    if qa:
        for row in qa[1:]:
            if len(row) > 1 and row[1].strip():
                answers[row[0]] = row[1].strip()

    data = {
        'about': 'Survey values read from the filled-in Word stair data sheet by tools/import_stair_sheet.py. Measured or counted '
                 'on site by the person in survey.by. Blank in the sheet = absent here (not surveyed). Regenerate by running the tool '
                 'again; do not edit by hand. The app data (STAIRS in js/hw-02-core.js) is not changed.',
        'source': {'file': os.path.basename(path), 'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest(),
                   'importedAt': datetime.datetime.now().replace(microsecond=0).isoformat()},
        'units': {'riser_cm': 'cm', 'tread_cm': 'cm', 'width_cm': 'cm', 'totalRise_cm': 'cm', 'heading_deg': 'degrees from north, direction of climb',
                  'accuracy_m': 'm (the phone\'s reported accuracy)', 'roofHeight_m': 'm'},
        'stairs': {sid: r for sid, r in stairs.items() if r['flights'] or r.get('bottom') or r.get('top') or r['building'] or r['shape']
                   or any(r['survey'].values())},
        'buildings': buildings, 'answers': answers, 'warnings': sh.warnings,
    }
    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    json.dump(data, open(OUT_JSON, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    report(data, stairs, app)
    S = data['stairs']
    print(f'Read {len(S)} of {len(stairs)} stairs with survey data '
          f'({sum(1 for r in S.values() if r["complete"]["flights"])} with complete flights, '
          f'{sum(1 for r in S.values() if r["complete"]["position"])} with a measured position), '
          f'{len(buildings)} buildings, {len(sh.warnings)} things to check.')
    print('Wrote', os.path.relpath(OUT_JSON, ROOT), 'and', os.path.relpath(OUT_REPORT, ROOT))


def report(data, stairs, app):
    L = ['# Stair survey import report', '',
         f'Sheet: `{data["source"]["file"]}` · imported {data["source"]["importedAt"]}', '',
         'Blank cells stay "not surveyed" in the app. Values marked **error** were left out; **check** values were kept but look '
         'doubtful; **note** is information only. Fix the Word sheet and run the tool again.', '']
    W2 = {}
    for w in data['warnings']:
        W2.setdefault(w['id'], []).append(w)
    L += ['## Summary', '', '| Stair | Position | Flights | Survey record | Things to check |', '|---|---|---|---|---|']
    for sid in sorted(stairs, key=lambda s: int(s[2:])):
        r = data['stairs'].get(sid)
        if not r:
            L.append(f'| {sid} | – | – | – | not surveyed yet |'); continue
        c = r['complete']
        L.append(f'| {sid} | {"measured" if c["position"] else "missing"} | '
                 f'{"complete (" + str(len(r["flights"])) + ")" if c["flights"] else (str(len(r["flights"])) + " rows, incomplete" if r["flights"] else "missing")} | '
                 f'{"complete" if c["record"] else "incomplete"} | {len(W2.get(sid, []))} |')
    L += ['', '## Things to check', '']
    if not data['warnings']:
        L.append('Nothing: every filled value was read and looks plausible.')
    for sid, ws in W2.items():
        L.append(f'**{sid}**')
        for w in ws:
            L.append(f'- {w["level"]}: {w["field"]}: {w["message"]}')
        L.append('')
    L += ['', '## Still needed for a complete stair', '',
          'Position (bottom latitude and longitude), every flight\'s risers, riser height, tread depth and clear width, the turn '
          'after each flight but the last, and By, Date and Tool.', '']
    open(OUT_REPORT, 'w', encoding='utf-8').write('\n'.join(L) + '\n')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
