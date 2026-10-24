"""Write data/stair-survey.json from the Observatory prototype's staircase records.

The records (prototypes/campus-observatory/data/staircases.json) hold the campus stair survey (shared survey database,
export of 24 Oct 2026): step counts, rise and run per step, flights, shape, who measured and when, and a photo. This
turns them into the overlay HealthWiz loads on top of its own stair list (js/v6-campus-data.js). Only measured values are
copied. Width, turns, landings, heading and GPS at the bottom step were not in the export, so the overlay says so
(complete.flights and complete.position are false) and the 3D preview stays illustrative.

    python3 tools/stair_survey_from_records.py
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'prototypes', 'campus-observatory', 'data', 'staircases.json')
OUT = os.path.join(ROOT, 'data', 'stair-survey.json')
LABEL = 'Campus stair survey (shared survey database, export of 24 Oct 2026)'


def main():
    recs = json.load(open(SRC, encoding='utf8'))['staircases']
    stairs = {}
    for r in recs:
        m, sv = r['measuredStep'], r['survey'] or {}
        if not m or not r['flights']:
            continue
        fl = [{'flight': i + 1, 'risers': f['steps'], 'riser_cm': round(m['rise_m'] * 100, 2), 'tread_cm': round(m['run_m'] * 100, 2)}
              for i, f in enumerate(r['flights'])]
        stairs[r['id']] = {
            'source': LABEL,
            'shape': sv.get('shape'),
            'survey': {'by': sv.get('by'), 'date': sv.get('date'), 'tool': sv.get('tool')},
            'stepCount': r['stepCount'],
            'verticalRise_m': r['verticalRise_m'],
            'flights': fl,
            'photos': [{'src': p['src'].replace('assets/photos/', 'data/stair-photos/'), 'caption': p['caption']} for p in r['photos']],
            'notes': r['notes'],
            'complete': {'position': False, 'flights': False, 'record': bool(sv.get('by') and sv.get('date') and sv.get('tool'))},
        }
    out = {'about': 'Made by tools/stair_survey_from_records.py from prototypes/campus-observatory/data/staircases.json. ' + LABEL + '. Do not edit by hand.',
           'source': LABEL, 'stairs': stairs, 'buildings': [], 'answers': {}, 'warnings': []}
    json.dump(out, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(len(stairs), 'staircases written to', OUT)


main()
