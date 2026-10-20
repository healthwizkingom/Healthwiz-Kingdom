#!/usr/bin/env python3
"""Convert the OpenStreetMap export (data/source/kmk-map.osm) into data/campus-osm.geojson.

Standard library only. Run from the project folder:

    python3 tools/osm_to_geojson.py

Every feature keeps its OSM id and the tags the map uses, and gets a `kind` the map styles by. Nothing is added that
is not in the OSM file: there are no heights, levels or staircases in it (see DATA_NOTES.md).
OSM data (c) OpenStreetMap contributors, ODbL 1.0: https://www.openstreetmap.org/copyright
"""
import json
import os
import sys
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'source', 'kmk-map.osm')
OUT = os.path.join(ROOT, 'data', 'campus-osm.geojson')
KEEP = ('name', 'building', 'highway', 'covered', 'layer', 'surface', 'leisure', 'sport', 'amenity', 'man_made',
        'waterway', 'place', 'landuse', 'access', 'shelter_type', 'lanes', 'oneway')


def kind(t, closed):
    """The map's own category for a feature, from its OSM tags only."""
    if t.get('amenity') == 'college':
        return 'campus'
    if t.get('building') == 'roof' and t.get('covered') == 'yes':
        return 'covered_walkway'
    if t.get('building') == 'roof':
        return 'roof'
    if 'building' in t:
        return 'building'
    if t.get('leisure') in ('pitch', 'stadium'):
        return 'sport'
    if t.get('waterway'):
        return 'water'
    if t.get('man_made') == 'water_tower':
        return 'water_tower'
    if t.get('place') == 'square':
        return 'square'
    if t.get('landuse') == 'residential':
        return 'residential'
    h = t.get('highway')
    if h == 'footway':
        return 'footway_covered' if t.get('covered') == 'yes' else 'footway'
    if h in ('secondary', 'primary', 'trunk'):
        return 'road_major'
    if h in ('residential', 'service', 'unclassified', 'tertiary'):
        return 'road'
    return None


def main():
    root = ET.parse(SRC).getroot()
    nodes = {n.get('id'): (float(n.get('lon')), float(n.get('lat'))) for n in root.findall('node')}
    tags = lambda e: {x.get('k'): x.get('v') for x in e.findall('tag')}
    ways = {w.get('id'): w for w in root.findall('way')}
    coords = lambda w: [nodes[nd.get('ref')] for nd in w.findall('nd') if nd.get('ref') in nodes]
    feats, skipped = [], {}

    def add(geom, t, osm_type, osm_id):
        k = kind(t, True)
        if not k:
            key = ','.join(sorted(t)) or '(untagged)'
            skipped[key] = skipped.get(key, 0) + 1
            return
        props = {'kind': k, 'osm': osm_type + '/' + osm_id}
        props.update({x: t[x] for x in KEEP if x in t})
        feats.append({'type': 'Feature', 'properties': props, 'geometry': geom})

    for w in root.findall('way'):
        t = tags(w)
        if not t:
            continue  # member of a multipolygon relation, used below
        c = coords(w)
        if len(c) < 2:
            continue
        closed = c[0] == c[-1] and len(c) >= 4
        area = closed and ('building' in t or 'leisure' in t or 'amenity' in t or 'place' in t
                           or 'landuse' in t or 'man_made' in t)
        add({'type': 'Polygon', 'coordinates': [c]} if area else {'type': 'LineString', 'coordinates': c},
            t, 'way', w.get('id'))

    for r in root.findall('relation'):
        t = tags(r)
        if t.get('type') != 'multipolygon':
            continue
        outer = [coords(ways[m.get('ref')]) for m in r.findall('member') if m.get('role') == 'outer' and m.get('ref') in ways]
        inner = [coords(ways[m.get('ref')]) for m in r.findall('member') if m.get('role') == 'inner' and m.get('ref') in ways]
        if len(outer) == 1:
            add({'type': 'Polygon', 'coordinates': outer + inner}, t, 'relation', r.get('id'))

    pois = []
    for n in root.findall('node'):
        t = tags(n)
        if t.get('name') or t.get('highway') == 'bus_stop' or t.get('barrier') == 'gate':
            pois.append({'type': 'Feature', 'properties': dict(t, kind='poi', osm='node/' + n.get('id')),
                         'geometry': {'type': 'Point', 'coordinates': list(nodes[n.get('id')])}})

    b = root.find('bounds')
    out = {
        'type': 'FeatureCollection',
        'attribution': '(c) OpenStreetMap contributors, ODbL 1.0',
        'source': 'OpenStreetMap export supplied by the owner (data/source/kmk-map.osm), generator ' + root.get('generator', ''),
        'bounds': [float(b.get('minlon')), float(b.get('minlat')), float(b.get('maxlon')), float(b.get('maxlat'))],
        'features': feats + pois,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    counts = {}
    for x in out['features']:
        counts[x['properties']['kind']] = counts.get(x['properties']['kind'], 0) + 1
    print('wrote', os.path.relpath(OUT, ROOT), len(out['features']), 'features')
    for k in sorted(counts):
        print('  %-16s %d' % (k, counts[k]))
    if skipped:
        print('  not drawn (tags):', skipped)


if __name__ == '__main__':
    sys.exit(main())
