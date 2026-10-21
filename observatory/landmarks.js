// Landmarks on the campus map (owner's request, 2026-10-20): optional markers for the useful places that are MAPPED in the
// OpenStreetMap export (data/campus-osm.geojson), never invented ones:
//   entrance   the gate (barrier=gate)
//   building   every named building (parts with the same name, e.g. "Bangunan Akademik", are one landmark at the largest)
//   gathering  the squares (place=square) and the Astaka (leisure=stadium)
//   sport      the pitches (the Padang, the south-west field, the tennis court)
//   utility    the water towers
// Unnamed features are called by what they are and the nearest named building ("Square near Asrama Lelaki A"), and say
// so. Tapping one opens it (opts.onOpen); the page decides whether it is a first discovery (a device-only record, kept
// apart from health records: viewing a place is not climbing anything).
const R = 6371008.8, D = Math.PI / 180;
const KIND = { entrance: 'Entrance', building: 'Building', gathering: 'Gathering place', sport: 'Sports ground', utility: 'Water tower' };
export const LANDMARK_KINDS = KIND;

function centroid(ring) {
  let a = 0, x = 0, y = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j], [x1, y1] = ring[i], k = x0 * y1 - x1 * y0;
    a += k; x += (x0 + x1) * k; y += (y0 + y1) * k;
  }
  if (!a) return { lng: ring[0][0], lat: ring[0][1], area: 0 };
  return { lng: x / (3 * a), lat: y / (3 * a), area: Math.abs(a / 2) * (R * D) ** 2 * Math.cos(ring[0][1] * D) };
}
const dist = (a, b) => Math.hypot((a.lng - b.lng) * Math.cos(a.lat * D), a.lat - b.lat) * R * D;
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The landmarks of an OSM export: [{id, name, kind, kindName, lng, lat, osm: [ids], named}]. */
export function landmarksOf(osm) {
  const F = osm.features, out = [], byName = new Map();
  for (const f of F) {
    const p = f.properties;
    if (p.kind === 'building' && p.name && f.geometry.type === 'Polygon') {
      const c = centroid(f.geometry.coordinates[0]), cur = byName.get(p.name);
      if (!cur) byName.set(p.name, { c, osm: [p.osm] });
      else { cur.osm.push(p.osm); if (c.area > cur.c.area) cur.c = c; }
    }
  }
  for (const [name, v] of byName) out.push({ id: 'b-' + slug(name), name, kind: 'building', lng: v.c.lng, lat: v.c.lat, osm: v.osm, named: true });
  const named = out.slice();
  const near = c => { const n = named.slice().sort((a, b) => dist(a, c) - dist(b, c))[0]; return n ? ' near ' + n.name : ''; };
  const count = {};
  for (const f of F) {
    const p = f.properties, g = f.geometry;
    let kind = null, name = p.name || null;
    if (p.barrier === 'gate' && g.type === 'Point') { kind = 'entrance'; name = name || 'College gate'; }
    else if (p.kind === 'square' && g.type === 'Polygon') { kind = 'gathering'; }
    else if (p.kind === 'sport' && g.type === 'Polygon') kind = p.leisure === 'stadium' ? 'gathering' : 'sport';
    else if (p.kind === 'water_tower' && g.type === 'Polygon') kind = 'utility';
    if (!kind) continue;
    const c = g.type === 'Point' ? { lng: g.coordinates[0], lat: g.coordinates[1] } : centroid(g.coordinates[0]);
    const what = kind === 'entrance' ? '' : p.sport === 'tennis' ? 'Tennis court' : kind === 'sport' ? 'Playing field' : kind === 'utility' ? 'Water tower' : 'Square';
    const label = name || what + near(c);
    const id = (kind[0] + '-' + slug(label)) + (count[label] ? '-' + (++count[label]) : (count[label] = 1, ''));
    out.push({ id, name: label, kind, lng: c.lng, lat: c.lat, osm: [p.osm], named: !!p.name });
  }
  return out.map(l => ({ ...l, kindName: KIND[l.kind] }));
}

// small, familiar symbols (original drawings): a gate, a hall with a banner, a flag, a ball, a water tower
const ICON = {
  entrance: '<path d="M4 20V8l8-5 8 5v12h-4v-6a4 4 0 0 0-8 0v6Z"/>',
  building: '<path d="M3 20V9l9-6 9 6v11Z"/><path class="lk2" d="M10 20v-5h4v5"/>',
  gathering: '<path d="M6 21V3"/><path class="lk2" d="M6 4h11l-3 4 3 4H6"/>',
  sport: '<circle cx="12" cy="12" r="8"/><path class="lk2" d="m12 7 4 3-1.5 5h-5L8 10Z"/>',
  utility: '<path d="M8 3h8v7l-4 3-4-3Z"/><path class="lk2" d="M9 13 7 21M15 13l2 8M8 17h8"/>',
};

/** opts: {ML, map, list, onOpen(id), reduced()} → {list, show(on), found(set), discover(id), destroy()}. */
export function createLandmarks(opts) {
  const { ML, map, list } = opts, marks = new Map();
  for (const l of list) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'lmk k-' + l.kind; el.dataset.lmk = l.id;
    el.setAttribute('aria-label', l.name + ' (' + l.kindName + ', mapped in OpenStreetMap). Open it.');
    el.innerHTML = '<span class="lmkr" aria-hidden="true"></span><svg class="lmki" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICON[l.kind] + '</svg><span class="lmkn" aria-hidden="true">' + l.name.replace(/[<>&]/g, '') + '</span>';
    el.addEventListener('click', e => { e.stopPropagation(); opts.onOpen && opts.onOpen(l.id); });
    marks.set(l.id, new ML.Marker({ element: el, anchor: 'bottom', offset: [0, -6] }).setLngLat([l.lng, l.lat]).addTo(map));
  }
  let shown = true;
  return {
    list,
    show(on) { shown = !!on; for (const m of marks.values()) m.getElement().hidden = !shown; },
    get shown() { return shown; },
    /** Mark these ids as discovered (a gold seal instead of a faint glimmer). */
    found(ids) { const s = new Set(ids || []); for (const [id, m] of marks) m.getElement().classList.toggle('found', s.has(id)); },
    /** The discovery animation on a landmark (a rune ring opening and a light rising); still with reduced motion. */
    discover(id) {
      const m = marks.get(id); if (!m) return;
      const el = m.getElement(); el.classList.remove('disc'); void el.offsetWidth; el.classList.add('disc', 'found');
      setTimeout(() => el.classList.remove('disc'), 1800);
    },
    select(id) { for (const [k, m] of marks) m.getElement().classList.toggle('on', k === id); },
    destroy() { for (const m of marks.values()) m.remove(); marks.clear(); },
  };
}
