// Campus Health Observatory prototype: wires the data, the map, the panels and the 3D preview together.
// Data files (edit by hand): data/staircases.json, data/demo-geometry.json, data/elevation-zones.geojson,
// data/campus-osm.geojson (from tools/osm_to_geojson.py).
//
// Selection flow (one path for every way of choosing a staircase: its marker, the list, a link in the details):
//   select({id}) → details panel → map highlight (marker state, ground ring, particles) → 3D preview opens or updates
//   for that record. Closing the preview keeps the selection; the × in the selection bar clears it.
import { createMap, catN } from './map.js';
import { createFx } from './fx.js';
import { nearestNamed } from './geo.js';
import { createTerrain } from './terrain.js';
import { paintSprites, px } from './pixel.js';
import { createLocator } from './locate.js';
import { applySurvey, surveyPlan } from './survey.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const CAT = { MILD: 'Mild', MODERATE: 'Moderate', VIGOROUS: 'Vigorous' };
const CATCOL = { MILD: '#7ee07c', MODERATE: '#f6c94f', VIGOROUS: '#ff7b6e' };
const phoneMQ = matchMedia('(max-width: 899px)'), phone = () => phoneMQ.matches;
const mq = matchMedia('(prefers-reduced-motion: reduce)');

const S = { stairs: [], byId: new Map(), groups: [], groupOf: new Map(), demo: null, osm: null, terrain: null, sel: null, filter: 'all', q: '',
  mode: store.get('cho-mode') === 'realistic' ? 'realistic' : 'fantasy', still: store.get('cho-still') === '1', viewer: null, viewerOpen: false };
const reduced = () => S.still || mq.matches;

/* ---------- data ---------- */
async function load() {
  const get = async u => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(u + ': HTTP ' + r.status); return r.json(); };
  const [stairs, demo, osm, zones] = await Promise.all([get('data/staircases.json'), get('data/demo-geometry.json'), get('data/campus-osm.geojson'), get('data/elevation-zones.geojson')]);
  S.stairs = stairs.staircases; S.demo = demo; S.osm = osm; S.terrain = createTerrain(zones);
  // survey values from the Word data sheet (tools/import_stair_sheet.py); optional: without the file nothing changes
  try { const r = await fetch('data/stair-survey.json', { cache: 'no-cache' }); if (r.ok) S.survey = await r.json(); } catch (e) { S.survey = null; }
  S.surveyed = applySurvey(S.stairs, S.survey);
  S.stairs.forEach(s => { s._plan = surveyPlan(s); });
  S.stairs.forEach(s => S.byId.set(s.id, s));
  // staircases that share one stored coordinate are one marker on the map
  const G = new Map();
  for (const s of S.stairs) {
    if (s.latitude == null || s.longitude == null) continue;
    const key = s.latitude.toFixed(7) + ',' + s.longitude.toFixed(7);
    if (!G.has(key)) G.set(key, { key, lat: s.latitude, lng: s.longitude, items: [] });
    G.get(key).items.push(s);
    S.groupOf.set(s.id, key);
  }
  S.groups = [...G.values()];
  // computed facts for the details panel (never stored in the records): nearest named OSM place, illustrative zone
  for (const s of S.stairs) if (s.latitude != null) { s._near = nearestNamed([s.longitude, s.latitude], osm.features); s._zone = S.terrain.zoneAt(s.longitude, s.latitude); }
}

const placed = s => s.latitude != null && s.longitude != null;
const distM = (a, b) => { const k = Math.PI / 180, R = 6371008.8; return Math.hypot((b.longitude - a.longitude) * k * R * Math.cos(a.latitude * k), (b.latitude - a.latitude) * k * R); };
const flagged = s => !!s.notes && /flagged|may be the same|Same route name/.test(s.notes);
const FILTERS = [
  ['all', 'All', () => true], ['map', 'On the map', placed], ['nol', 'No location', s => !placed(s)],
  ['part', 'Step size measured', s => !!s.measuredStep], ['flag', 'Needs checking', flagged],
];

/* ---------- list ---------- */
function renderFilters() {
  $('.filters').innerHTML = FILTERS.map(([k, label, fn]) => '<button type="button" class="fchip" data-f="' + k + '" aria-pressed="' + (S.filter === k) + '">'
    + esc(label) + ' <span class="mut">' + S.stairs.filter(fn).length + '</span></button>').join('');
}
function dot(s) { return placed(s) ? '<span class="dot c' + catN(s.appCategory) + '" aria-hidden="true">' + catN(s.appCategory) + '</span>' : '<span class="dot nol" aria-hidden="true">?</span>'; }
function renderList() {
  const fn = FILTERS.find(f => f[0] === S.filter)[2], q = S.q.trim().toLowerCase();
  const hay = s => (s.id + ' ' + s.name + ' ' + (s._near ? s._near.name : '') + ' ' + (s._zone ? s._zone.name + ' ' + s._zone.region : '')).toLowerCase();
  const L = S.stairs.filter(fn).filter(s => !q || q.split(/\s+/).every(w => hay(s).includes(w)));
  const cur = S.sel && S.sel.id;
  $('#count').textContent = L.length === S.stairs.length ? S.stairs.length + ' staircases' : 'Showing ' + L.length + ' of ' + S.stairs.length;
  $('.qx').hidden = !S.q;
  $('#list').innerHTML = L.length ? L.map(s => '<li><button type="button" class="item" data-id="' + s.id + '"' + (cur === s.id ? ' aria-current="true"' : '') + '>' + dot(s)
    + '<span class="nm">' + esc(s.name) + '</span><span class="meta"><b>' + s.id + '</b>'
    + (s.estimatedAngle != null ? '<span>θ ' + s.estimatedAngle.toFixed(2) + '° ' + (s.measuredStep ? '(from measured steps)' : '(from the stair list)') + '</span>' : '')
    + '<span>' + (!placed(s) ? 'No location recorded' : s.locationStatus === 'measured' ? 'Measured location' : 'Real location') + '</span>'
    + (s.measurementStatus === 'surveyed' ? '<span>Surveyed</span>' : '') + '</span></button></li>').join('')
    : '<li class="empty">No staircase matches. Try another word or filter.</li>';
}

/* ---------- details: three groups (location, staircase profile, data quality) ---------- */
const chip = (cls, t) => '<li class="chip ' + cls + '">' + esc(t) + '</li>';
const na = t => '<dd class="na">' + esc(t) + '</dd>';
const group = (icon, title, body) => '<section class="grp-card"><h3><span class="gi" aria-hidden="true">' + px(icon, 2) + '</span>' + title + '</h3>' + body + '</section>';
function chipsFor(s) {
  const m = s.measuredStep, ch = [];
  ch.push(!placed(s) ? chip('miss', 'No location recorded') : s.locationStatus === 'measured' ? chip('part', 'Measured location (survey)') : chip('real', 'Real location'));
  ch.push(s.surveyAngle != null ? chip('calc', 'Angle from surveyed steps') : s.estimatedAngle == null ? chip('miss', 'Angle unavailable') : m ? chip('calc', 'Angle from measured steps') : chip('est', 'Angle from the stair list'));
  ch.push(s.orientationStatus === 'measured' ? chip('part', 'Measured orientation') : s.orientationDeg != null ? chip('est', 'Estimated orientation') : chip('miss', 'Orientation not surveyed'));
  ch.push(s.measurementStatus === 'surveyed' ? chip('part', 'Surveyed') : s.survey ? chip('part', 'Partially surveyed') : s.measurementStatus === 'partially measured' ? chip('part', 'Partially measured: step size only') : chip('miss', 'Not yet surveyed'));
  if (s.survey && s.survey.label && !s.survey.recordComplete) ch.push(chip('flag', 'Survey record incomplete (who, when or tool missing)'));
  if (flagged(s)) ch.push(chip('flag', 'Needs checking'));
  return ch;
}
function details(s) {
  const m = s.measuredStep, near = s._near, z = s._zone;
  let loc = '<dl class="facts">';
  loc += '<dt>Coordinates</dt>' + (placed(s) ? '<dd class="num">' + s.latitude + ', ' + s.longitude + '<span class="src">' + (s.locationStatus === 'measured' ? 'Measured location · ' : 'Real location · ') + esc(s.locationSource) + '</span></dd>' : na('No location recorded, so it is not placed on the map.'));
  if (s.app && s.locationStatus === 'measured' && s.app.latitude != null) loc += '<dt>App estimate</dt><dd class="num">' + s.app.latitude + ', ' + s.app.longitude + '<span class="src">The original app coordinate (unverified), about ' + Math.round(distM(s.app, s)) + ' m from the measured point. No longer used on the map.</span></dd>';
  const v = s.survey;
  if (v && (v.building || v.indoorOutdoor || v.lowerLevel || v.upperLevel)) loc += '<dt>Building, levels</dt><dd>' + esc([v.building, v.indoorOutdoor].filter(Boolean).join(' · ') || '–') + (v.lowerLevel || v.upperLevel ? ' · from ' + esc(v.lowerLevel || '?') + ' to ' + esc(v.upperLevel || '?') : '') + '<span class="src">' + esc(v.label) + '</span></dd>';
  if (s.sharedLocationWith && s.sharedLocationWith.length) loc += '<dt>Same point as</dt><dd>' + s.sharedLocationWith.map(id => '<button type="button" class="lnk" data-id="' + id + '">' + id + '</button>').join(', ') + '<span class="src">These records store the identical coordinate.</span></dd>';
  if (near) loc += '<dt>Nearest OSM place</dt><dd>' + (near.inside ? 'Inside the outline of ' : 'About ' + Math.round(near.d) + ' m from ') + '<b>' + esc(near.name) + '</b><span class="src">Computed from the location and OpenStreetMap outlines. Not a survey.</span></dd>';
  if (placed(s)) loc += '<dt>Map terrain</dt><dd>' + (z ? esc(z.name) + ' (' + esc(z.region) + ')' : 'Base level') + '<span class="src">Illustrative zone from your annotated screenshot. Not a measured elevation.</span></dd>';
  loc += '<dt>Floor label</dt><dd>"' + esc(s.appFloorLabel || '–') + '"<span class="src">App data; its meaning on site is not documented.</span></dd></dl>';
  let pro = '<dl class="facts">';
  if (s.surveyAngle != null) pro += '<dt>Angle θ (survey)</dt><dd class="num">' + s.surveyAngle.toFixed(2) + '°<span class="src">Calculated: θ = arctan(riser ÷ tread) per flight from the survey sheet, mean over its steps (the F21 method).</span></dd>';
  pro += '<dt>' + (s.surveyAngle != null ? 'Angle θ (app)' : 'Angle θ') + '</dt>' + (s.estimatedAngle == null ? na('Unavailable') : '<dd class="num">' + s.estimatedAngle.toFixed(2) + '°<span class="src">' + esc(m ? 'Calculated from measured step rise and run' : 'From the stair list') + ' · ' + esc(s.angleSource) + '</span></dd>');
  pro += '<dt>Step size</dt>' + (m ? '<dd class="num">rise ' + m.rise_m.toFixed(3) + ' m · run ' + m.run_m.toFixed(3) + ' m · hypotenuse ' + m.hypotenuse_m.toFixed(3) + ' m<span class="src">Measured' + (m.method ? ': ' + esc(m.method) : '') + ' · ' + esc(m.source) + (m.reportStaircase ? ', Staircase ' + esc(m.reportStaircase) + ' (' + esc(m.reportName) + ')' : '') + '</span></dd>' : na('Measurements unavailable'));
  pro += '<dt>Orientation</dt>' + (s.orientationDeg != null ? '<dd>' + s.orientationDeg + '° from north<span class="src">Estimated orientation · ' + esc(s.orientationSource || 'source not recorded') + '</span></dd>' : na('Not yet surveyed'));
  pro += '<dt>Step count</dt>' + (s.stepCount != null ? '<dd>' + s.stepCount + (s.stepCountSource ? '<span class="src">' + esc(s.stepCountSource) + '</span>' : '') + '</dd>' : na('Measurements unavailable'));
  const FS = s.flightsSurveyed || [];
  const FL = !FS.length && s.flights && s.flights.length ? s.flights : null; // flights from the shared survey database: step counts only
  pro += '<dt>Flights, landings</dt>' + (FL ? '<dd>' + FL.length + (FL.length === 1 ? ' flight' : ' flights') + (FL.length > 1 && FL.some(f => f.steps != null) ? ' (' + FL.map(f => f.steps).join(' + ') + ' steps)' : '') + (v && v.shape ? ' · ' + esc(v.shape) : '') + '</dd>' : FS.length ? '<dd>' + FS.length + ' flight' + (FS.length > 1 ? 's' : '') + (v && v.shape ? ' · ' + esc(v.shape) + ' shape' : '') + (v && v.complete && !v.complete.flights ? ' · <b>incomplete</b>' : '') + '<span class="src">' + esc(v.label) + '</span></dd>' : na('Not yet surveyed'));
  pro += '<dt>Vertical rise</dt>' + (s.verticalRise_m != null ? '<dd class="num">' + s.verticalRise_m + ' m<span class="src">' + esc(s.verticalRiseStatus || '') + '</span></dd>' : na('Measurements unavailable')) + '</dl>';
  if (FS.length) pro += '<div class="ftab-wrap"><table class="ftab"><caption>Flights (survey sheet; blank = not measured)</caption><thead><tr><th>#</th><th>Risers</th><th>Riser cm</th><th>Tread cm</th><th>θ</th><th>Width cm</th><th>Heading</th><th>Then</th></tr></thead><tbody>'
    + FS.map(f => '<tr><td>' + (f.flight ?? '') + '</td><td>' + (f.risers ?? '') + '</td><td>' + (f.riser_cm ?? '') + '</td><td>' + (f.tread_cm ?? '') + '</td><td>' + (f.angle_deg != null ? f.angle_deg + '°' : '') + '</td><td>' + (f.width_cm ?? '') + '</td><td>' + (f.heading_deg != null ? f.heading_deg + '°' : '') + '</td><td>' + esc(f.turn || '') + '</td></tr>').join('')
    + '</tbody></table></div>';
  const ph = s.photos && s.photos[0];
  const hero = ph ? '<figure class="hero c' + catN(s.appCategory) + '"><span class="heart"><img src="' + esc(ph.src) + '" alt="Photo of ' + esc(s.name) + '" loading="lazy"></span>'
    + '<figcaption>' + esc(ph.caption || 'Photo') + '</figcaption></figure>' : '';
  let q = '<ul class="chips">' + chipsFor(s).join('') + '</ul><dl class="facts"><dt>Verification</dt><dd>' + esc(s.verification && s.verification.status || 'unverified') + '</dd>'
    + '<dt>App category</dt><dd>' + esc(CAT[s.appCategory] || 'None') + '<span class="src">The HealthWiz app\'s own label, not a measurement.</span></dd></dl>';
  if (s.notes) q += '<p class="notes">' + esc(s.notes) + '</p>';
  return '<div class="det"><button type="button" class="back" data-act="back">&lsaquo; All staircases</button>'
    + '<p class="eyebrow">' + s.id + ' · ' + esc(CAT[s.appCategory] || 'Staircase') + '</p><h2 tabindex="-1">' + esc(s.name) + '</h2>' + hero
    + '<div class="row det-act">' + (S.viewerOpen ? '' : '<button type="button" class="btn" data-act="3d">Show 3D preview</button>') + (placed(s) ? '<button type="button" class="btn sec" data-act="zoom">Show on map</button>' : '') + '</div>'
    + group('pin', 'Location', loc) + group('stairs', 'Staircase profile', pro) + group('shield', 'Data quality', q) + '</div>';
}
function groupChooser(g) {
  return '<div class="det"><button type="button" class="back" data-act="back">&lsaquo; All staircases</button><p class="eyebrow">Shared point</p><h2 tabindex="-1">' + g.items.length + ' staircases at one stored point</h2>'
    + '<p class="idl">' + g.lat + ', ' + g.lng + ' · Real location. These records store the identical coordinate; on site they are probably separate stairs. Pick one to see it and its 3D preview.</p>'
    + '<ul class="list grp">' + g.items.map(s => '<li><button type="button" class="item" data-id="' + s.id + '">' + dot(s) + '<span class="nm">' + esc(s.name) + '</span><span class="meta"><b>' + s.id + '</b><span>' + esc(s.appFloorLabel) + '</span></span></button></li>').join('') + '</ul></div>';
}

/* ---------- selection ---------- */
let MAP, FX;
function select(t, from) {
  if (!t) {
    if (from === 'map') return; // a tap on empty map keeps the selection; the × in the selection bar clears it
    S.sel = null; MAP && MAP.select(null); FX && FX.follow(null); $('#selpill').hidden = true; closeViewer(true);
    $('#det').innerHTML = '<p class="empty">Pick a staircase on the map or in the list.</p>'; tab('list'); renderList(); return;
  }
  let key, s0;
  if (t.group) {
    S.sel = { group: t.group.key }; key = t.group.key; s0 = t.group.items[0];
    $('#det').innerHTML = groupChooser(t.group);
    closeViewer(true);
    pill(t.group.items.length + ' staircases', 'at one stored point');
  } else {
    const s = S.byId.get(t.id); if (!s) return;
    S.sel = { id: s.id }; key = S.groupOf.get(s.id) || null; s0 = s;
    if (LOC && LOC.state !== 'off' && ME.follow && key) meFollow(false); // the camera goes to the staircase; "Follow me" brings it back
    pill(s.id, s.name);
    openViewer(s); // automatic: every staircase selection shows its preview
    $('#det').innerHTML = details(s);
  }
  tab('det');
  if (phone() && $('#sheet').dataset.state === 'peek') sheet('half');
  const mk = MAP && MAP.select(key);
  if (mk) setTimeout(() => MAP.flyToGroup(key), phone() ? 280 : 0); // after the sheet or preview has taken its space
  if (mk && S.mode === 'fantasy') {
    const col = CATCOL[s0.appCategory] || '#fff0a8';
    setTimeout(() => { const q = MAP.screenOf(key); if (q) FX.burst(q.x, q.y, col); }, reduced() ? 0 : 820);
    FX.follow(() => MAP.screenOf(key), col);
  } else FX && FX.follow(null);
  renderList();
  $('#pane-det').scrollTop = 0;
  if (from === 'list' || from === 'link') { const h = $('#det h2'); h && h.focus({ preventScroll: true }); }
}
function pill(id, name) { $('#sp-id').textContent = id; $('#sp-name').textContent = name; $('#selpill').hidden = false; }
function tab(which) {
  const det = which === 'det';
  $('#tab-list').setAttribute('aria-selected', !det); $('#tab-det').setAttribute('aria-selected', det);
  $('#pane-list').hidden = det; $('#pane-det').hidden = !det;
}
function sheet(state) {
  const el = $('#sheet'); el.dataset.state = state; $('.stage').dataset.sheet = state;
  $('.handle').setAttribute('aria-expanded', state !== 'peek');
  $('.handle').setAttribute('aria-label', state === 'full' ? 'Show less of the panel' : 'Show more of the panel');
}

/* ---------- 3D preview: a side panel on wide screens, the top of the details sheet on phones ---------- */
function placeViewer() {
  const v = $('#viewer'), dock = $('#vw-dock');
  if (phone()) { if (v.parentNode !== dock) dock.appendChild(v); v.classList.add('embedded'); }
  else { if (v.parentNode !== $('.stage')) $('.stage').appendChild(v); v.classList.remove('embedded'); }
}
let viewerLoading = null;
async function openViewer(s) {
  placeViewer();
  const v = $('#viewer');
  v.hidden = false; S.viewerOpen = true; $('.stage').dataset.vw = 'open';
  v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter');
  fillViewer(s);
  try {
    if (!S.viewer) {
      const msg = $('#vw-msg'); msg.dataset.loading = '1'; msg.hidden = false; msg.textContent = 'Loading the 3D model…';
      viewerLoading = viewerLoading || import('./viewer3d.js').then(mod => mod.createViewer({ host: $('#vw-canvas'), msg: $('#vw-msg'), reduced, onView: dial }));
      S.viewer = await viewerLoading;
    }
    if (!S.sel || S.sel.id !== s.id) return; // another staircase was picked while Three.js was loading
    S.viewer.show(s, S.demo, S.mode);
    fillViewer(s);
  } catch (e) {
    console.warn('[3d]', e);
    delete $('#vw-msg').dataset.loading; $('#vw-msg').hidden = false; $('#vw-msg').textContent = 'The 3D preview could not start on this device (' + (e && e.message || 'WebGL unavailable') + '). The map and details still work.';
  }
}
function fillViewer(s) {
  const m = s.measuredStep, d = S.demo, shape = S.viewer ? S.viewer.shape : d.defaultShape;
  $('#vw-title').textContent = s.name;
  $('#vw-sub').textContent = s.id + ' · ' + (CAT[s.appCategory] || '') + ' · ' + (!placed(s) ? 'no location recorded' : s.locationStatus === 'measured' ? 'measured location' : 'real location');
  $('#vw-status').innerHTML = s._plan ? chip('part', 'Built from survey measurements') + chip('ill', 'Finishes illustrative')
    : chip('ill', 'Illustrative 3D model') + (m ? chip('part', 'Step size measured (F21)') : chip('miss', 'Not yet surveyed'));
  $('.vw-stage .illus').textContent = s._plan ? 'Flights, steps and landings from the survey sheet; materials, railings and the dais are illustrative.' : 'Illustrative model — actual dimensions not surveyed.';
  $('#vw-shapes').hidden = !!s._plan; // a surveyed stair has its own shape
  $('#vw-compass-t').textContent = s.orientationDeg != null ? (s.orientationStatus === 'measured' ? 'Measured orientation: ' : 'Estimated orientation: ') + s.orientationDeg + '°' : 'Orientation not surveyed';
  $('.vw-compass').classList.toggle('known', s.orientationDeg != null);
  $('#vw-shapes').innerHTML = Object.entries(d.shapes).map(([k, o]) => '<button type="button" class="vbtn shape" data-shape="' + k + '" aria-pressed="' + (shape === k) + '">' + esc(o.label) + '</button>').join('');
  $('#vw-facts').innerHTML = (s._plan ? [
    '<b>Flights, steps, width, turns and landings:</b> from the survey sheet (' + esc(s.survey.label) + '): ' + s._plan.length + ' flight' + (s._plan.length > 1 ? 's' : '') + ', ' + s._plan.map(f => f.n).join(' + ') + ' steps.',
    '<b>Landings:</b> ' + (s._plan.slice(0, -1).every(f => f.landingLength) ? 'measured length' + (s._plan.slice(0, -1).every(f => f.landingWidth) ? ' and width.' : '; width taken as the flight width where not measured.') : 'where a landing size is not in the sheet, it is drawn as wide and deep as the flight (illustrative).'),
    s.orientationDeg != null ? '<b>Orientation:</b> ' + (s.orientationStatus === 'measured' ? 'measured' : 'estimated') + ', ' + s.orientationDeg + '° from north.' : '<b>Orientation:</b> not surveyed.',
    '<b>Not measured:</b> the materials, railings, posts and the dais. Walls, wells and surroundings are not drawn.',
  ] : [
    '<b>Shape, steps, width, landings:</b> demonstration values (' + d.stepsPerFlight + ' steps a flight, ' + d.width_m + ' m wide). Pick a shape above to compare; none is this staircase\'s surveyed form.',
    m ? '<b>Step size:</b> measured for this staircase (rise ' + m.rise_m + ' m, run ' + m.run_m + ' m, F21 report), so the slope of the steps matches its measured angle. Only the step size is real.'
      : '<b>Step size:</b> demonstration value (rise ' + d.riser_m + ' m, run ' + d.tread_m + ' m), not this staircase. The stored angle is an estimate and does not size the model.',
    s.orientationDeg != null ? '<b>Orientation:</b> estimated, ' + s.orientationDeg + '° from north.' : '<b>Orientation:</b> not surveyed. The model faces an arbitrary direction; the dial shows the direction of climb relative to your view.',
    '<b>Height and floors:</b> not inferred. The model\'s height comes only from the demonstration step count. The dais is decoration.',
  ]).map(t => '<li>' + t + '</li>').join('');
  $('[data-v="spin"]').setAttribute('aria-pressed', !!(S.viewer && S.viewer.spinning));
}
function dial(az) { const i = $('.vw-dial i'); if (i) i.style.transform = 'rotate(' + (-az) + 'deg)'; }
function closeViewer(quiet) {
  if (!S.viewerOpen && $('#viewer').hidden) return;
  $('#viewer').hidden = true; S.viewerOpen = false; $('.stage').dataset.vw = '';
  S.viewer && S.viewer.hide();
  const s = S.byId.get(S.sel && S.sel.id);
  if (s && !quiet) { $('#det').innerHTML = details(s); const b = $('#det [data-act="3d"]'); b && b.focus({ preventScroll: true }); }
}

/* ---------- you on the map: Tom stands at your GPS position (or walks a simulated demo path) ---------- */
const ME = { follow: true, first: true, last: null, far: false };
let LOC = null;
function meText() {
  const f = ME.last, st = LOC ? LOC.state : 'off';
  if (st === 'asking') return 'Finding your location…';
  if (st === 'demo') return '<b>Demo walk</b> · simulated position, not yours';
  if (st === 'gps' && ME.far && f) return '<b>You are about ' + kmFromCampus(f) + ' km from campus.</b> Tom only walks on the campus map.';
  if (st === 'gps' && f) return '<b>You</b> · GPS ±' + Math.round(f.accuracy) + ' m (device estimate)';
  return '';
}
function meUI(st, info) {
  const on = st !== 'off';
  $('[data-ctl="me"]').setAttribute('aria-pressed', st === 'gps' || st === 'demo' || st === 'asking');
  $('#mestat').hidden = !on;
  $('#mestat').dataset.st = st;
  $('#me-t').innerHTML = st === 'error' ? esc(info.message) : meText();
  $('[data-act="me-demo"]').hidden = !(st === 'error' || (st === 'gps' && ME.far));
  $('[data-act="me-follow"]').hidden = !((st === 'gps' && !ME.far) || st === 'demo') || ME.follow;
  if (!on || st === 'error') { MAP && MAP.me(null); ME.last = null; }
}
function kmFromCampus(f) {
  const [x0, y0, x1, y1] = S.osm.bounds, k = Math.PI / 180, R = 6371.0088, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return (Math.hypot((f.lng - cx) * k * R * Math.cos(cy * k), (f.lat - cy) * k * R)).toFixed(1);
}
function onFix(f) {
  ME.last = f;
  if (!MAP) return;
  ME.far = f.source === 'gps' && !MAP.near(f.lng, f.lat);
  if (ME.far) MAP.me(null);
  else { MAP.me(f, ME.first); if (ME.follow) MAP.followMe(f, ME.first); ME.first = false; }
  meUI(LOC.state);
}
function meFollow(on) {
  ME.follow = on;
  if (on && ME.last && !ME.far) MAP.followMe(ME.last, false);
  if (LOC) meUI(LOC.state);
}
/** The demo path: the longest road inside the campus outline (OpenStreetMap). */
function demoPath() {
  const k = Math.PI / 180, len = c => c.slice(1).reduce((t, b, i) => t + Math.hypot((b[0] - c[i][0]) * Math.cos(b[1] * k), b[1] - c[i][1]), 0);
  const roads = S.osm.features.filter(f => (f.properties.kind === 'road' || f.properties.kind === 'road_major') && f.geometry.type === 'LineString');
  roads.sort((a, b) => len(b.geometry.coordinates) - len(a.geometry.coordinates));
  const inside = roads.find(f => f.geometry.coordinates.every(([x, y]) => MAP.near(x, y)));
  return (inside || roads[0] || { geometry: { coordinates: [] } }).geometry.coordinates;
}
function meButton() {
  const st = LOC.state;
  if (st === 'off' || st === 'error') { ME.follow = true; ME.first = true; LOC.startGps(); }
  else if (!ME.follow && !ME.far) meFollow(true);
  else { LOC.stop(); }
}

/* ---------- modes and motion ---------- */
function setMode(m) {
  S.mode = m; store.set('cho-mode', m);
  document.documentElement.dataset.mode = m;
  document.querySelectorAll('.mode').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  document.querySelector('meta[name="theme-color"]').content = m === 'fantasy' ? '#0b1430' : '#ffffff';
  MAP && MAP.setMode(m);
  FX && FX.set(m === 'fantasy' && !reduced());
  if (S.viewerOpen && S.viewer) S.viewer.setMode(m);
}
function setStill(on) {
  S.still = on; store.set('cho-still', on ? '1' : '0');
  document.documentElement.classList.toggle('still', on);
  FX && FX.set(S.mode === 'fantasy' && !reduced());
  MAP && MAP.setReduced();
  S.viewer && S.viewer.setReduced();
}
function padding() {
  if (phone()) { const h = $('#sheet').getBoundingClientRect().height || 148; return { top: 76, bottom: Math.min(h, innerHeight * .7) + 12, left: 24, right: 72 }; }
  const w = $('#sheet').getBoundingClientRect().width || 380, vw = S.viewerOpen ? $('#viewer').getBoundingClientRect().width + 24 : 0;
  return { top: 70, bottom: 40, left: w + 36, right: Math.max(76, vw) };
}

/* ---------- chips legend in the About dialog ---------- */
const VOCAB = [
  ['real', 'Real location', 'Recorded on site by the survey team and confirmed as real.'],
  ['est', 'Angle from the stair list', 'From the app stair list; used only where steps were not measured.'],
  ['calc', 'Angle from measured steps', 'θ = arctan(rise ÷ run) from the survey measurements (stair survey, F21 report).'],
  ['part', 'Partially measured: step size only', 'Only one step\'s mean rise and run are measured.'],
  ['miss', 'Not yet surveyed', 'Nothing measured on site yet.'],
  ['miss', 'Measurements unavailable', 'The value is unknown, so nothing is shown in its place.'],
  ['miss', 'Orientation not surveyed', 'The climbing direction is unknown.'],
  ['ill', 'Illustrative 3D model', 'Demonstration geometry, not this staircase.'],
  ['part', 'Measured location (survey)', 'Phone GPS at the bottom step, from the Word stair data sheet; the accuracy is the phone\'s own estimate.'],
  ['part', 'Built from survey measurements', 'The 3D model uses the surveyed flights: risers, riser height, tread, width, turns and landings.'],
  ['flag', 'Survey record incomplete', 'Values were measured, but who, when or with which tool is missing in the sheet.'],
  ['ter', 'Illustrative terrain', 'Raised ground shows the order of heights from your annotation, not measurements.'],
  ['osm', 'OpenStreetMap', 'Buildings, paths and fields from the supplied OSM export.'],
  ['flag', 'Needs checking', 'Something in the stored data looks doubtful; see the notes.'],
];

/* ---------- start ---------- */
async function start() {
  paintSprites();
  document.documentElement.classList.toggle('still', S.still);
  $('#opt-motion').checked = S.still;
  setMode(S.mode);
  placeViewer();
  $('#ab-chips').innerHTML = VOCAB.map(([c, t, d]) => '<li><span class="chip ' + c + '">' + esc(t) + '</span><span>' + esc(d) + '</span></li>').join('');
  try { await load(); }
  catch (e) {
    console.warn(e);
    const f = location.protocol === 'file:';
    $('#maperr').hidden = false;
    $('#maperr').innerHTML = '<div><h2>The data files could not be loaded</h2><p>' + (f ? 'Browsers block data files on pages opened straight from the disk. Start a small local web server in this folder (see README.md), then open http://localhost:8000.' : esc(e.message)) + '</p></div>';
    $('#sum').textContent = 'data not loaded';
    return;
  }
  const n = S.stairs.length, p = S.stairs.filter(placed).length, sv = S.stairs.filter(s => s.measurementStatus === 'surveyed').length;
  $('#sum').textContent = n + ' staircases · ' + p + ' at real locations · ' + (n - p) + ' without a location · ' + sv + ' surveyed';
  renderFilters(); renderList();

  FX = createFx($('#fx'));
  if (!window.maplibregl) { $('#maperr').hidden = false; $('#maperr').textContent = 'The map library did not load.'; return; }
  try {
    MAP = createMap({
      container: 'map', osm: S.osm, terrain: S.terrain, groups: S.groups, padding, reduced, busy: () => S.viewerOpen,
      onSelect: (t, from) => select(t, from),
      onBearing: b => { $('.needle').style.transform = 'rotate(' + (-b) + 'deg)'; },
      onPitch: pt => $('[data-ctl="tilt"]').setAttribute('aria-pressed', pt > 5),
      onUserMove: () => { if (LOC && LOC.state !== 'off' && ME.follow) meFollow(false); },
    });
  } catch (e) {
    console.warn(e);
    $('#maperr').hidden = false; $('#maperr').textContent = 'The map needs WebGL, which this browser could not start. The staircase list still works.';
  }
  MAP && MAP.setMode(S.mode);
  FX.set(S.mode === 'fantasy' && !reduced());
  LOC = createLocator({ onFix, onState: meUI });
  window.__cho = { S, MAP, select, LOC, ME }; // for testing in the browser console
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-id]');
  if (!t) return;
  if (t.classList.contains('mode')) return setMode(t.dataset.mode);
  if (t.dataset.f) { S.filter = t.dataset.f; renderFilters(); return renderList(); }
  if (t.dataset.id) return select({ id: t.dataset.id }, t.closest('#list') ? 'list' : 'link');
  if (t.dataset.ctl && MAP) {
    const c = t.dataset.ctl, on = t.getAttribute('aria-pressed') !== 'true';
    if (c === 'me') return LOC && meButton();
    if (c === 'in') MAP.zoom(1); else if (c === 'out') MAP.zoom(-1); else if (c === 'north') MAP.north(); else if (c === 'fit') MAP.fit();
    else if (c === 'tilt') { t.setAttribute('aria-pressed', on); MAP.tilt(on); }
    else if (c === 'bld') { t.setAttribute('aria-pressed', on); MAP.buildings(on); }
    else if (c === 'terr') { t.setAttribute('aria-pressed', on); MAP.terrain(on); }
    return;
  }
  if (t.dataset.v && S.viewer) {
    const v = t.dataset.v;
    if (v === 'left') S.viewer.rotateBy(-30); else if (v === 'right') S.viewer.rotateBy(30);
    else if (v === 'in') S.viewer.zoomBy(.78); else if (v === 'out') S.viewer.zoomBy(1.28);
    else if (v === 'reset') S.viewer.reset();
    else if (v === 'spin') { S.viewer.spin(!S.viewer.spinning); t.setAttribute('aria-pressed', S.viewer.spinning); }
    return;
  }
  if (t.dataset.shape && S.viewer) { S.viewer.setShape(t.dataset.shape); const s = S.byId.get(S.sel && S.sel.id); s && fillViewer(s); return; }
  const act = t.dataset.act;
  if (act === 'back') return tab('list');
  if (act === '3d') { const s = S.byId.get(S.sel && S.sel.id); if (s) { openViewer(s); $('#det').innerHTML = details(s); } return; }
  if (act === 'zoom') { const k = S.groupOf.get(S.sel && S.sel.id); if (k && MAP) { MAP.flyToGroup(k); if (phone()) sheet('peek'); } return; }
  if (act === 'campus') { MAP && MAP.fit(); if (phone()) sheet('peek'); return; }
  if (act === 'clear') return select(null, 'pill');
  if (act === 'me-stop') return LOC && LOC.stop();
  if (act === 'me-demo') { ME.follow = true; ME.first = true; return LOC && LOC.startDemo(demoPath()); }
  if (act === 'me-follow') return meFollow(true);
  if (act === 'qclear') { $('#q').value = ''; S.q = ''; renderList(); $('#q').focus(); return; }
  if (t.id === 'tab-list') return tab('list');
  if (t.id === 'tab-det') return tab('det');
  if (t.classList.contains('handle')) { const st = $('#sheet').dataset.state; return sheet(st === 'peek' ? 'half' : st === 'half' ? 'full' : 'peek'); }
  if (t.classList.contains('vw-close')) return closeViewer();
  if (t.classList.contains('about-open')) return $('#about').showModal();
  if (t.classList.contains('legend-tog')) { const b = $('#legend-body'), open = b.hidden; b.hidden = !open; t.setAttribute('aria-expanded', open); }
});
$('#q').addEventListener('input', e => { S.q = e.target.value; renderList(); });
$('#q').addEventListener('focus', () => { if (phone() && $('#sheet').dataset.state === 'peek') sheet('half'); });
$('#opt-motion').addEventListener('change', e => setStill(e.target.checked));
mq.addEventListener && mq.addEventListener('change', () => setStill(S.still));
phoneMQ.addEventListener && phoneMQ.addEventListener('change', () => { placeViewer(); MAP && MAP.resize(); });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || $('#about').open) return;
  if (S.viewerOpen) closeViewer(); else if (phone() && $('#sheet').dataset.state !== 'peek') sheet('peek');
});
// tabs by arrow keys
$('.tabs').addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { const d = $('#tab-list').getAttribute('aria-selected') === 'true'; tab(d ? 'det' : 'list'); (d ? $('#tab-det') : $('#tab-list')).focus(); } });

start();
