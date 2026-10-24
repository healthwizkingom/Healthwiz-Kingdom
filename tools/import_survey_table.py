"""Read the "Campus stair survey" Word table and the owner's latest experiment into data/stair-survey.json.

    python3 tools/import_survey_table.py path/to/Campus_Stair_Survey.docx [data/source/stair-experiment-2026-10-24.json]

Same output format as tools/import_stair_sheet.py (which reads the blank HealthWiz sheet), so the app lays it over STAIRS
unchanged (js/v6-campus-data.js). Also writes data/stair-survey-report.md. Python 3.8+, standard library only.

Rules: a blank cell stays absent; "same" in Measured by / Date / Tool means the row above (noted); a value that is not a number
is left out and reported; nothing is guessed. Riser and run are per step. The width of the stairs was not measured, so no
stair is "complete" and the 3D preview stays illustrative.
"""
import datetime, hashlib, json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from import_stair_sheet import tables, ROOT

OUT_JSON = os.path.join(ROOT, 'data', 'stair-survey.json')
OUT_REPORT = os.path.join(ROOT, 'data', 'stair-survey-report.md')
SHAPES = {'straight': ('straight', None), 'u': ('U', None), 'u turn': ('U', None), 'landing': ('other', 'recorded as "landing" (a landing part way)')}
warn = []
DROP = {'ST08', 'ST27'}  # ST08: the same stair as ST21 (kept once, as ST21); ST27: a second "Tangga Anjung Santap", removed (2026-10-24)


def renumber(sid):
    """The table keeps the old numbers; the app renumbered ST28 and up by -1 when ST27 was removed."""
    n = int(sid[2:])
    return 'ST%02d' % (n - 1) if n > 27 else sid


def w(sid, field, msg, level='check'):
    warn.append({'stair': sid, 'field': field, 'level': level, 'message': msg})


def num(v):
    if isinstance(v, (int, float)):
        return float(v)
    m = re.fullmatch(r'\s*(-?\d+(?:\.\d+)?)\s*(?:/\s*(\d+(?:\.\d+)?))?\s*', str(v or ''))
    if not m:
        return None
    return float(m.group(1)) / float(m.group(2)) if m.group(2) else float(m.group(1))


def dms(s):
    m = re.findall(r'(\d+(?:\.\d+)?)\s*[°º]\s*(?:(\d+(?:\.\d+)?)\s*[\'’′]\s*)?(?:(\d+(?:\.\d+)?)\s*["”″]\s*)?([NSEW])', s)
    out = [(float(a) + float(b or 0) / 60 + float(c or 0) / 3600) * (-1 if h in 'SW' else 1) for a, b, c, h in m]
    return out if len(out) == 2 else None


def coords(*texts):
    for t in texts:
        m = re.search(r'(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)(?!\s*°)', t or '')
        if m and 5 < float(m.group(1)) < 6:
            return float(m.group(1)), float(m.group(2))
        d = dms(t or '')
        if d:
            return d[0], d[1]
        m = re.search(r'(-?\d+\.\d+)\s*°\s*N\s*,?\s*(-?\d+\.\d+)\s*°\s*E', t or '')
        if m:
            return float(m.group(1)), float(m.group(2))
    return None


def flights(sid, steps, riser, tread, shape, note=None):
    out = []
    for i, n in enumerate(steps):
        last = i == len(steps) - 1
        f = {'flight': i + 1, 'risers': n, 'riser_cm': riser, 'tread_cm': tread, 'width_cm': None, 'totalRise_cm': None,
             'heading_deg': None, 'landing': None, 'turn': None if last else 'reverse', 'notes': note if i == 0 else None}
        for k, v, lo, hi in (('riser height', riser, 12, 21), ('tread depth', tread, 22, 40)):
            if v is not None and not (lo <= v <= hi):
                w(sid, f'flight {i + 1} {k}', f'{v:g} cm is unusual (typical {lo} to {hi}). Kept; please re-measure if it is a typo.')
        if n > 22 or n < 2:
            w(sid, f'flight {i + 1} risers', f'{n} risers is unusual (typical 2 to 22). Kept.', 'note')
        out.append(f)
    return out


def entry(sid, steps, riser, tread, shape, bottom, by, date, tool, note=None):
    fl = flights(sid, steps, riser, tread, shape, note) if steps else []
    return {'id': sid, 'building': None, 'indoorOutdoor': None, 'lowerLevel': None, 'upperLevel': None, 'shape': shape,
            'flightCount': len(fl) or None, 'bottom': {'lat': bottom[0], 'lng': bottom[1], 'accuracy_m': None} if bottom else None, 'top': None,
            'survey': {'by': by, 'date': date, 'tool': tool}, 'flights': fl,
            'complete': {'position': bool(bottom), 'flights': False, 'record': bool(by and date and tool)}}


def main(docx, extra):
    T = tables(docx)
    t = next(x for x in T if x and x[0] and x[0][0].strip() == 'Stair')
    stairs, prev = {}, ['', '', '']
    for row in t[1:]:
        row = row + [''] * (12 - len(row))
        sid = row[0].strip().upper()
        if not re.fullmatch(r'ST\d+', sid) or sid in DROP:
            continue
        sid = renumber(sid)
        by, date, tool = [c.strip() for c in row[9:12]]
        vals = []
        for i, v in enumerate((by, date, tool)):
            if v.lower() == 'same':
                v = prev[i] or ''
                if v:
                    w(sid, ('Measured by', 'Date', 'Tool')[i], f'"same" read as the row above: {v}.', 'note')
                else:
                    w(sid, ('Measured by', 'Date', 'Tool')[i], '"same" with no row above: left blank.', 'check')
            vals.append(v or None)
        prev = [v or '' for v in vals]
        by, date, tool = vals
        bottom = coords(row[2], row[1])
        shp, snote = SHAPES.get(row[8].strip().lower(), (None, None))
        if row[8].strip() and not shp:
            w(sid, 'Shape', f'"{row[8]}" not understood; left out.', 'error')
        nf, steps = num(row[3]), [num(x) for x in re.split(r'[,;]', row[4]) if x.strip()]
        if None in steps or not steps:
            w(sid, 'Steps per flight', f'"{row[4]}" is not a list of numbers; stair left without flights.', 'error'); steps = []
        steps = [int(x) for x in steps]
        if nf and steps and int(nf) != len(steps):
            w(sid, 'Flights', f'{int(nf)} flights but {len(steps)} step counts; the step counts are used.', 'check')
        riser, tread = num(row[5]), num(row[6])
        if (row[5].strip() and riser is None) or (row[6].strip() and tread is None):
            w(sid, 'Riser / Run', 'not a number; left out.', 'error')
        if steps and (riser is None or tread is None):
            w(sid, 'Riser / Run', 'missing: no angle can be calculated from the steps.', 'check')
        e = entry(sid, steps, riser, tread, shp, bottom, by, date, tool, snote)
        if bottom:
            w(sid, 'Position', f'{bottom[0]}, {bottom[1]} read from the table.', 'note')
        stairs[sid] = e
    # the owner's latest experiment replaces the table for the stairs it names
    x = json.load(open(extra, encoding='utf-8')) if extra else {'stairs': {}}
    for sid, v in x['stairs'].items():
        old = stairs.get(sid, {})
        riser, tread = num(v.get('riser_cm')), num(v.get('tread_cm'))
        if riser is None and v.get('list_angle') is not None and tread:
            riser = round(tread * math.tan(math.radians(v['list_angle'])), 2)
            w(sid, 'Riser', f'{riser} cm calculated as run {tread:g} cm x tan({v["list_angle"]}°); not measured.', 'check')
        if riser is not None:
            riser = round(riser, 4)
        tread = round(tread, 4) if tread is not None else None
        b = v.get('bottom') or (old.get('bottom') and [old['bottom']['lat'], old['bottom']['lng']])
        s = old.get('survey', {})
        stairs[sid] = entry(sid, v['steps'], riser, tread, v.get('shape'), b, s.get('by'), s.get('date'), s.get('tool'), v.get('note'))
        if not s.get('by'):
            w(sid, 'By / Date / Tool', 'Not given for the new measurements: shown as "survey record incomplete".', 'check')
    ids = sorted(stairs, key=lambda i: int(i[2:]))
    data = {'about': 'Survey values read from the Campus stair survey table and the 2026-10-24 experiment by tools/import_survey_table.py. '
                     'Riser and tread are per step. Blank = not surveyed. Regenerate by running the tool; do not edit by hand. STAIRS in js/hw-02-core.js is not changed by it.',
            'source': {'file': os.path.basename(docx), 'sha256': hashlib.sha256(open(docx, 'rb').read()).hexdigest(),
                       'experiment': os.path.basename(extra) if extra else None,
                       'importedAt': datetime.datetime.now().replace(microsecond=0).isoformat()},
            'units': {'riser_cm': 'cm per step', 'tread_cm': 'cm per step', 'accuracy_m': 'm'},
            'stairs': {i: stairs[i] for i in ids}, 'buildings': [], 'answers': {}, 'warnings': warn}
    json.dump(data, open(OUT_JSON, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    L = ['# Stair survey import report', '', f'Sheet: `{data["source"]["file"]}` + `{data["source"]["experiment"]}` · imported {data["source"]["importedAt"]}', '',
         f'{len(ids)} stairs. **error** = left out, **check** = kept but doubtful, **note** = information.', '',
         '| Stair | Level | Field | Message |', '|---|---|---|---|']
    L += [f'| {x["stair"]} | {x["level"]} | {x["field"]} | {x["message"]} |' for x in sorted(warn, key=lambda x: (int(x['stair'][2:]), x['field']))]
    open(OUT_REPORT, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print(f'{len(ids)} stairs, {len(warn)} things to check. Wrote data/stair-survey.json and data/stair-survey-report.md')
    print(json.dumps({i: [f['risers'] for f in stairs[i]['flights']] for i in ids}))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
