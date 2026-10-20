// The campus map: MapLibre GL JS drawing only the supplied OpenStreetMap data (no tile server, no API key), on an
// illustrative terrain built from data/elevation-zones.geojson (js/terrain.js).
// Both modes use the same sources, the same layers, the same terrain and the same marker positions; a mode switch only
// changes paint properties, which decoration layers are shown, light, sky and CSS. Building heights are illustrative
// (OSM has none) and can be switched off; so can the terrain.
import { centroid } from './geo.js';
import { makeImage } from './textures.js';
import { makeTrees } from './deco.js';
import { makeBuildingParts } from './buildings.js';

const ML = window.maplibregl;
const ATTR = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a> (ODbL)';
const K = k => ['==', ['get', 'kind'], k];
const Z = k => ['==', ['get', 'zkind'], k];
const LINE = ['==', ['geometry-type'], 'LineString'];
const POLY = ['==', ['geometry-type'], 'Polygon'];
const LEVEL = (hi, mid) => ['match', ['get', 'level'], 'highest', hi, mid];
const HEIGHT = ['match', ['get', 'building'], 'dormitory', 13, 'college', 10, 'mosque', 7, 'house', 5, 'hut', 3, 6]; // illustrative, not OSM
export const catN = c => ({ MILD: 1, MODERATE: 2, VIGOROUS: 3 }[c] || 0);

/* ---------- the two looks: every paint property either mode sets ---------- */
const PAINT = {
  realistic: {
    bg: { 'background-color': '#e6e9e2', 'background-pattern': undefined },
    res: { 'fill-color': '#dfded8', 'fill-pattern': undefined },
    campus: { 'fill-color': '#f3f1ea', 'fill-pattern': undefined },
    'campus-edge': { 'line-color': '#b5ad99', 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-opacity': 1 },
    'campus-glow': { 'line-opacity': 0 },
    'zone-top': { 'fill-opacity': 0 },
    square: { 'fill-color': '#e8e5dc', 'fill-pattern': undefined },
    sport: { 'fill-color': '#cfe5c6', 'fill-pattern': undefined },
    'sport-edge': { 'line-color': '#9fc495', 'line-width': 1.2 },
    water: { 'line-color': '#8cc2e4' }, 'water-glow': { 'line-opacity': 0 },
    hill: { 'hillshade-shadow-color': '#6f6a5e', 'hillshade-highlight-color': '#ffffff', 'hillshade-accent-color': '#8a8475', 'hillshade-exaggeration': .55 },
    'road-case': { 'line-color': '#c6cad1' }, 'road-major-case': { 'line-color': '#d4be78' },
    road: { 'line-color': '#ffffff', 'line-pattern': undefined }, 'road-major': { 'line-color': '#fff1c2', 'line-pattern': undefined },
    'walk-glow': { 'line-opacity': 0 },
    walk: { 'line-color': '#958cab', 'line-dasharray': [2, 1.5], 'line-opacity': .9 },
    'zone-contour': { 'line-color': '#a8977a', 'line-width': .9, 'line-opacity': .75, 'line-blur': 0 },
    'zone-edge-glow': { 'line-opacity': 0 },
    'zone-edge': { 'line-color': '#8c836e', 'line-width': 1.4, 'line-opacity': .9, 'line-dasharray': [4, 2] },
    'sel-glow': { 'circle-color': '#2864d8', 'circle-opacity': .14 },
    'sel-ring': { 'circle-stroke-color': '#2864d8', 'circle-stroke-width': 2.5 },
    'me-acc': { 'fill-color': '#2864d8' }, 'me-acc-edge': { 'line-color': '#2864d8' },
    roof: { 'fill-extrusion-color': '#ddd7cc', 'fill-extrusion-opacity': .85, 'fill-extrusion-pattern': undefined },
    bld: { 'fill-extrusion-color': ['match', ['get', 'building'], 'dormitory', '#d2cfdb', 'mosque', '#cfe0d4', 'house', '#e2dacd', '#d9d0c3'],
      'fill-extrusion-opacity': .96, 'fill-extrusion-pattern': undefined },
    wt: { 'fill-extrusion-color': '#c4ccd6', 'fill-extrusion-pattern': undefined },
  },
  fantasy: {
    bg: { 'background-color': '#0c2422', 'background-pattern': 'px-forest' },
    res: { 'fill-color': '#0e2a26', 'fill-pattern': 'px-forest' },
    campus: { 'fill-color': '#24533b', 'fill-pattern': 'px-lawn' },
    'campus-edge': { 'line-color': '#f2c14e', 'line-width': 2, 'line-dasharray': undefined, 'line-opacity': .85 },
    'campus-glow': { 'line-opacity': .35 },
    'zone-top': { 'fill-opacity': .1 },
    square: { 'fill-color': '#555a80', 'fill-pattern': 'px-plaza' },
    sport: { 'fill-color': '#2c653f', 'fill-pattern': 'px-pitch' },
    'sport-edge': { 'line-color': '#cfe9d4', 'line-width': 1.6 },
    water: { 'line-color': '#4fc8f0' }, 'water-glow': { 'line-opacity': .5 },
    hill: { 'hillshade-shadow-color': '#03061a', 'hillshade-highlight-color': '#3d4f8f', 'hillshade-accent-color': '#141236', 'hillshade-exaggeration': .65 },
    'road-case': { 'line-color': '#2a2016' }, 'road-major-case': { 'line-color': '#2a2016' },
    road: { 'line-color': '#c9a46a', 'line-pattern': 'px-cobble' }, 'road-major': { 'line-color': '#d8b77d', 'line-pattern': 'px-cobble' },
    'walk-glow': { 'line-opacity': .4 },
    walk: { 'line-color': '#8ff7ea', 'line-dasharray': [0, 4, 3], 'line-opacity': 1 },
    'zone-contour': { 'line-color': LEVEL('#f2c14e', '#7fe8ee'), 'line-width': 1.1, 'line-opacity': .38, 'line-blur': .6 },
    'zone-edge-glow': { 'line-opacity': .32 },
    'zone-edge': { 'line-color': LEVEL('#f2c14e', '#7fe8ee'), 'line-width': 1.6, 'line-opacity': .8, 'line-dasharray': undefined },
    'sel-glow': { 'circle-color': '#f2c14e', 'circle-opacity': .22 },
    'sel-ring': { 'circle-stroke-color': '#ffe9a8', 'circle-stroke-width': 3 },
    'me-acc': { 'fill-color': '#5fe1e6' }, 'me-acc-edge': { 'line-color': '#8ff7ea' },
    roof: { 'fill-extrusion-color': '#6a5ac0', 'fill-extrusion-opacity': .85, 'fill-extrusion-pattern': 'px-canopy' },
    bld: { 'fill-extrusion-pattern': ['match', ['get', 'building'], 'dormitory', 'px-wall2', 'house', 'px-cottage', 'hut', 'px-wood', 'px-wall'], 'fill-extrusion-opacity': 1 },
    wt: { 'fill-extrusion-pattern': 'px-turret' },
  },
};
const FANTASY_ONLY = ['trees', 'lanterns', 'bglow'];
// made in Blender by tools/blender_buildings.py; a host that cannot serve .glb can point window.CHO_MODEL_URL at a glTF JSON copy
const MODEL_URL = (typeof window !== 'undefined' && window.CHO_MODEL_URL) || 'assets/models/campus-fantasy.glb';
const AVATAR_URL = (typeof window !== 'undefined' && window.CHO_AVATAR_URL) || 'assets/models/tom.glb'; // Tom, from tools/blender_tom.py
const TERRAIN_LAYERS = ['hill', 'zone-top', 'zone-contour', 'zone-edge-glow', 'zone-edge'];
const SKY = {
  realistic: { 'sky-color': '#cfe2f3', 'horizon-color': '#eef1ec', 'fog-color': '#e6e9e2', 'sky-horizon-blend': .6, 'horizon-fog-blend': .7, 'fog-ground-blend': .85, 'atmosphere-blend': .4 },
  fantasy: { 'sky-color': '#0b1430', 'horizon-color': '#3b3482', 'fog-color': '#0d1736', 'sky-horizon-blend': .55, 'horizon-fog-blend': .55, 'fog-ground-blend': .72, 'atmosphere-blend': .7 },
};
const LIGHT = {
  realistic: { anchor: 'map', position: [1.3, 210, 40], color: '#ffffff', intensity: .38 },
  fantasy: { anchor: 'map', position: [1.4, 215, 38], color: '#c9d4ff', intensity: .5 },
};

function style(osm, zonesFC, trees, parts, demUrl) {
  const L = (id, type, filter, paint = {}, layout = {}, source = 'osm') => ({ id, type, source, ...(filter ? { filter } : {}), paint, layout });
  const join = { 'line-join': 'round', 'line-cap': 'round' };
  const w = (a, b) => ['interpolate', ['exponential', 1.6], ['zoom'], 15, a, 19, b];
  const dem = { type: 'raster-dem', tiles: [demUrl], tileSize: 256, encoding: 'terrarium', maxzoom: 17 };
  return {
    version: 8,
    sources: {
      osm: { type: 'geojson', data: osm, attribution: ATTR },
      zones: { type: 'geojson', data: zonesFC },
      deco: { type: 'geojson', data: trees },
      bparts: { type: 'geojson', data: parts },
      sel: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      me: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      dem, demhs: { ...dem },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#e6e9e2' } },
      L('res', 'fill', ['all', K('residential'), POLY]),
      L('campus', 'fill', ['all', K('campus'), POLY]),
      L('zone-top', 'fill', Z('top'), { 'fill-color': LEVEL('#f2c14e', '#5fe1e6'), 'fill-opacity': 0 }, {}, 'zones'),
      L('square', 'fill', ['all', K('square'), POLY]),
      L('sport', 'fill', ['all', K('sport'), POLY]),
      L('sport-edge', 'line', K('sport')),
      L('water-glow', 'line', ['all', K('water'), LINE], { 'line-color': '#7fe3ff', 'line-width': 18, 'line-blur': 12, 'line-opacity': 0 }, join),
      L('water', 'line', ['all', K('water'), LINE], { 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 3.5, 19, 11] }, join),
      { id: 'hill', type: 'hillshade', source: 'demhs', paint: { 'hillshade-illumination-direction': 300 } },
      L('campus-glow', 'line', K('campus'), { 'line-color': '#f2c14e', 'line-width': 12, 'line-blur': 10, 'line-opacity': 0 }),
      L('campus-edge', 'line', K('campus')),
      L('road-case', 'line', ['all', K('road'), LINE], { 'line-width': w(4, 18) }, join),
      L('road-major-case', 'line', ['all', K('road_major'), LINE], { 'line-width': w(7, 26) }, join),
      L('road', 'line', ['all', K('road'), LINE], { 'line-width': w(2.5, 14) }, join),
      L('road-major', 'line', ['all', K('road_major'), LINE], { 'line-width': w(5, 21) }, join),
      L('walk-glow', 'line', ['all', K('footway_covered'), LINE], { 'line-color': '#63e6dc', 'line-width': 9, 'line-blur': 6, 'line-opacity': 0 }, join),
      L('walk', 'line', ['all', K('footway_covered'), LINE], { 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.2, 19, 4] }, { 'line-join': 'round' }),
      L('bglow', 'line', ['all', K('building'), POLY], { 'line-color': '#ffb84d', 'line-opacity': .2, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 4, 19, 26], 'line-blur': ['interpolate', ['linear'], ['zoom'], 15, 4, 19, 22] }, { visibility: 'none' }),
      L('zone-contour', 'line', Z('contour'), {}, join, 'zones'), // illustrative contours every 3 m on the gentle slopes
      L('zone-edge-glow', 'line', Z('edge'), { 'line-color': LEVEL('#f2c14e', '#5fe1e6'), 'line-width': 12, 'line-blur': 9, 'line-opacity': 0 }, join, 'zones'),
      L('zone-edge', 'line', Z('edge'), {}, join, 'zones'),
      L('sel-glow', 'circle', null, { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 14, 20, 90], 'circle-blur': .7, 'circle-pitch-alignment': 'map' }, {}, 'sel'),
      L('sel-ring', 'circle', null, { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 8, 20, 52], 'circle-opacity': 0, 'circle-pitch-alignment': 'map' }, {}, 'sel'),
      // the GPS accuracy circle around the avatar: the device's own estimate of how far off the fix may be
      L('me-acc', 'fill', null, { 'fill-color': '#4a8cff', 'fill-opacity': .13 }, {}, 'me'),
      L('me-acc-edge', 'line', null, { 'line-color': '#4a8cff', 'line-width': 1.5, 'line-opacity': .7 }, {}, 'me'),
      L('roof', 'fill-extrusion', ['all', K('roof'), POLY], { 'fill-extrusion-base': 2.6, 'fill-extrusion-height': 3.0 }),
      L('bld', 'fill-extrusion', ['all', K('building'), POLY], { 'fill-extrusion-height': HEIGHT, 'fill-extrusion-base': 0, 'fill-extrusion-vertical-gradient': true }),
      // fantasy: each footprint gets a plinth, gold eaves, a tiered slate hipped roof, a chimney and, on the large halls,
      // a corner turret with a spire (js/buildings.js). Decoration on the real outline, not surveyed shapes.
      L('bx', 'fill-extrusion', null, { 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'top'], 'fill-extrusion-vertical-gradient': true,
        'fill-extrusion-pattern': ['match', ['get', 'part'], 'plinth', 'px-plinth', 'eave', 'px-trim', 'turret', 'px-turret', 'chimney', 'px-chimney',
          'ridge', ['match', ['get', 'btype'], 'mosque', 'px-goldroof', 'house', 'px-roofred', 'px-slate-hi'], ['match', ['get', 'btype'], 'mosque', 'px-goldroof', 'house', 'px-roofred', 'hut', 'px-wood', 'px-slate']] },
        { visibility: 'none' }, 'bparts'),
      L('wt', 'fill-extrusion', ['all', K('water_tower'), POLY], { 'fill-extrusion-height': 12 }),
      L('trees', 'symbol', null, {}, { visibility: 'none', 'icon-image': ['get', 't'], 'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-anchor': 'bottom',
        'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport', 'icon-size': ['interpolate', ['linear'], ['zoom'], 15, ['*', ['get', 's'], .55], 17, ['*', ['get', 's'], 1], 19.5, ['*', ['get', 's'], 2.1]] }, 'deco'),
      L('lanterns', 'symbol', ['all', K('footway_covered'), LINE], {}, { visibility: 'none', 'symbol-placement': 'line', 'symbol-spacing': 90, 'icon-image': 'px-lantern',
        'icon-allow-overlap': true, 'icon-ignore-placement': true, 'icon-anchor': 'bottom', 'icon-pitch-alignment': 'viewport', 'icon-rotation-alignment': 'viewport',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 15, .45, 17, .8, 19.5, 1.5] }),
    ],
  };
}

const PIN = n => '<svg class="pinsvg" viewBox="0 0 32 42" aria-hidden="true" focusable="false"><path class="pbody" d="M16 41C16 41 3 26.5 3 15.5a13 13 0 1 1 26 0C29 26.5 16 41 16 41Z"/>'
  + '<polygon class="pgem" points="16,7.5 23,11.5 23,19.5 16,23.5 9,19.5 9,11.5"/><path class="pshine" d="M10 12.2 16 8.8 18.6 10.3 11.2 14.6Z"/>'
  + '<text x="16" y="19.6" text-anchor="middle" class="pnum">' + n + '</text></svg>';

/** Build the map. opts: {container, osm, zones, terrain, groups, onSelect, padding(), reduced(), onBearing, onPitch} → controller. */
export function createMap(opts) {
  const { osm, terrain } = opts;
  const campus = osm.features.find(f => f.properties.kind === 'campus');
  // the first view and FIT: the campus outline and every placed staircase (all 28 lie inside it today; a new one may not)
  const bb = bbox((campus ? [campus] : osm.features).concat(opts.groups.map(g => ({ geometry: { coordinates: [g.lng, g.lat] } }))));
  const [x0, y0, x1, y1] = osm.bounds;
  terrain.register(ML);
  const trees = makeTrees(osm, opts.groups.map(g => [g.lng, g.lat])), parts = makeBuildingParts(osm);
  const map = new ML.Map({
    container: opts.container, style: style(osm, terrain.overlays(), trees, parts, terrain.url), bounds: bb, fitBoundsOptions: { padding: opts.padding() },
    pitch: 58, bearing: -12, maxPitch: 75, minZoom: 14.5, maxZoom: 20.5,
    maxBounds: [[x0 - .006, y0 - .006], [x1 + .006, y1 + .006]],
    attributionControl: false, dragRotate: true, pitchWithRotate: true, touchPitch: true,
  });
  map.addControl(new ML.AttributionControl({ compact: true }), 'bottom-right');
  map.on('styleimagemissing', e => { if (!map.hasImage(e.id)) { const im = makeImage(e.id); if (im) map.addImage(e.id, im, { pixelRatio: 2 }); } });

  let mode = 'realistic', bldOn = true, terrOn = true, sel = null, timer = null, step = 0, ready = false;
  const markers = new Map(), zoneMarks = [];
  let clusters = [];

  function applyMode(m) {
    mode = m;
    const P = PAINT[m], other = PAINT[m === 'fantasy' ? 'realistic' : 'fantasy'];
    for (const id of new Set([...Object.keys(P), ...Object.keys(other)])) {
      if (!map.getLayer(id)) continue;
      for (const p of new Set([...Object.keys(P[id] || {}), ...Object.keys(other[id] || {})])) {
        try { map.setPaintProperty(id, p, P[id] ? P[id][p] : undefined); } catch (e) { /* a property this layer type does not have */ }
      }
    }
    FANTASY_ONLY.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', m === 'fantasy' ? 'visible' : 'none'));
    if (m === 'fantasy') loadModels();
    if (avatar && avatar.setMode) avatar.setMode(m);
    setHeights();
    try { map.setSky(SKY[m]); } catch (e) {}
    try { map.setLight(LIGHT[m]); } catch (e) {}
    animate();
  }
  function setHeights() {
    if (!map.getLayer('bld')) return;
    map.setPaintProperty('bld', 'fill-extrusion-height', bldOn ? HEIGHT : 0);
    map.setPaintProperty('roof', 'fill-extrusion-height', bldOn ? 3.0 : 0);
    map.setPaintProperty('roof', 'fill-extrusion-base', bldOn ? 2.6 : 0);
    map.setPaintProperty('wt', 'fill-extrusion-height', bldOn ? 12 : 0);
    buildingVisibility();
  }
  /* ---------- the Blender buildings (fantasy). Until they load, or if they cannot, the generated blocks stand in. ---------- */
  let models = null, modelsReady = false;
  function loadModels() {
    if (models) return;
    models = 'loading';
    import('./models3d.js').then(mod => {
      models = mod.createModelLayer({ ML, url: MODEL_URL, heightAt: terrain.heightAt, terrainOn: () => terrOn,
        quality: () => (window.innerWidth < 900 || (window.devicePixelRatio || 1) > 2.5) ? 'low' : 'high',
        onReady: () => { modelsReady = true; buildingVisibility(); },
        onError: e => { console.warn('[models] the 3D buildings could not load; showing the simple ones.', e && e.message); models = 'failed'; } });
      map.addLayer(models, 'trees');
      buildingVisibility();
    }).catch(e => { console.warn('[models]', e && e.message); models = 'failed'; });
  }
  /* ---------- the avatar (Tom): loaded the first time a position arrives ---------- */
  let avatar = null, mePos = null;
  function loadAvatar() {
    if (avatar) return;
    avatar = 'loading';
    import('./avatar.js').then(mod => {
      avatar = mod.createAvatarLayer({ ML, url: AVATAR_URL, heightAt: terrain.heightAt, terrainOn: () => terrOn, reduced: opts.reduced, mode: () => mode,
        onReady: () => { if (mePos) { avatar.moveTo(mePos.lng, mePos.lat); avatar.show(true); } },
        onError: e => { console.warn('[avatar] the character could not load; the accuracy circle still shows the position.', e && e.message); avatar = 'failed'; } });
      map.addLayer(avatar); // on top of everything, like a game avatar
    }).catch(e => { console.warn('[avatar]', e && e.message); avatar = 'failed'; });
  }
  function circle(lng, lat, r) { // a polygon of radius r metres
    const k = Math.PI / 180, R = 6371008.8, ring = [];
    for (let i = 0; i <= 48; i++) { const a = i / 48 * 2 * Math.PI; ring.push([lng + r * Math.sin(a) / (R * k * Math.cos(lat * k)), lat + r * Math.cos(a) / (R * k)]); }
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
  }
  function buildingVisibility() {
    const fan = mode === 'fantasy', useModels = fan && modelsReady && bldOn;
    const vis = (id, on) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    vis('models', useModels);
    vis('bld', !useModels);
    vis('wt', !useModels);
    vis('bx', fan && bldOn && !modelsReady);
  }
  function setTerrain(on) {
    terrOn = on;
    try { map.setTerrain(on ? { source: 'dem', exaggeration: 1 } : null); } catch (e) { console.warn('[terrain]', e.message); }
    TERRAIN_LAYERS.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'));
    zoneMarks.forEach(z => { z.getElement().hidden = !on; });
    if (models && models.replace) models.replace();
  }
  // fantasy: walkways flow like enchanted paths and the plateau rims breathe, unless motion is reduced
  const DASH = [[0, 4, 3], [.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, .5], [3, 4, 0], [0, .5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, .5]];
  function animate() {
    clearInterval(timer); timer = null;
    if (mode !== 'fantasy' || opts.reduced()) { if (map.getLayer('zone-edge-glow') && mode === 'fantasy') map.setPaintProperty('zone-edge-glow', 'line-opacity', .32); return; }
    timer = setInterval(() => {
      // skipped while the page is hidden or the 3D preview is open: each tick redraws the whole map, so the preview gets the GPU
      if (document.hidden || !map.getLayer('walk') || (opts.busy && opts.busy())) return;
      step = (step + 1) % DASH.length;
      map.setPaintProperty('walk', 'line-dasharray', DASH[step]);
      map.setPaintProperty('zone-edge-glow', 'line-opacity', .28 + .14 * Math.sin(step / DASH.length * Math.PI * 2));
    }, 190);
  }

  /* ---------- staircase markers: one per stored coordinate (records sharing a coordinate share a marker) ---------- */
  function addMarkers() {
    for (const g of opts.groups) {
      const s = g.items[0], el = document.createElement('button');
      el.type = 'button';
      el.className = 'stm c' + catN(s.appCategory) + ' est' + (g.items.some(x => x.measuredStep) ? ' part' : '');
      el.dataset.key = g.key;
      const name = g.items.length > 1 ? g.items.length + ' staircases at one stored point' : s.id + ' · ' + s.name;
      el.setAttribute('aria-label', (g.items.length > 1 ? g.items.map(x => x.id + ' ' + x.name).join('; ') : s.id + ' ' + s.name) + '. Estimated location.');
      el.innerHTML = '<span class="ring" aria-hidden="true"></span><span class="glow" aria-hidden="true"></span><span class="beam" aria-hidden="true"></span>'
        + PIN(g.items.length > 1 ? '' : catN(s.appCategory)) + (g.items.length > 1 ? '<span class="cnt" aria-hidden="true">×' + g.items.length + '</span>' : '')
        + '<span class="tip" aria-hidden="true">' + esc(name.length > 46 ? name.slice(0, 44) + '…' : name) + '</span>';
      el.addEventListener('click', ev => { ev.stopPropagation(); opts.onSelect(g.items.length > 1 ? { group: g } : { id: s.id }, 'map'); });
      const mk = new ML.Marker({ element: el, anchor: 'bottom', offset: [0, 6] }).setLngLat([g.lng, g.lat]).addTo(map);
      markers.set(g.key, { mk, el, g });
    }
  }
  /* ---------- screen-space clustering: markers closer than ~30 px join one bubble; the selected one never does ---------- */
  function recluster() {
    clusters.forEach(c => c.mk.remove()); clusters = [];
    const pts = [...markers.values()].map(m => ({ m, p: map.project([m.g.lng, m.g.lat]) }));
    const used = new Set();
    for (const a of pts) {
      if (used.has(a) || a.m.g.key === sel) continue;
      const mem = pts.filter(b => !used.has(b) && b.m.g.key !== sel && Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) < 30);
      if (mem.length < 2) { a.m.el.hidden = false; used.add(a); continue; }
      mem.forEach(b => { used.add(b); b.m.el.hidden = true; });
      const n = mem.reduce((t, b) => t + b.m.g.items.length, 0), lng = mem.reduce((t, b) => t + b.m.g.lng, 0) / mem.length, lat = mem.reduce((t, b) => t + b.m.g.lat, 0) / mem.length;
      const cats = new Set(mem.flatMap(b => b.m.g.items.map(s => catN(s.appCategory))));
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'clu'; el.setAttribute('aria-label', n + ' staircases close together. Zoom in to separate them.');
      el.innerHTML = '<span class="cring" aria-hidden="true">' + [...cats].sort().map(c => '<i class="c' + c + '"></i>').join('') + '</span><b>' + n + '</b>';
      el.addEventListener('click', ev => {
        ev.stopPropagation();
        const b = bbox(mem.map(x => ({ geometry: { coordinates: [x.m.g.lng, x.m.g.lat] } })));
        noPad(); map.fitBounds(b, { padding: Object.assign({}, opts.padding(), { top: opts.padding().top + 60 }), maxZoom: Math.max(map.getZoom() + 1.5, 18.6), duration: opts.reduced() ? 0 : 700 });
      });
      clusters.push({ mk: new ML.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map) });
    }
    for (const a of pts) if (a.m.g.key === sel) a.m.el.hidden = false;
  }
  /* ---------- labels: OSM building names, and the two illustrative elevation zones ---------- */
  function addLabels() {
    const best = {};
    for (const f of osm.features) {
      const p = f.properties;
      if (!p.name || f.geometry.type !== 'Polygon' || !['building', 'sport'].includes(p.kind)) continue;
      const c = centroid(f.geometry.coordinates[0]);
      if (!best[p.name] || c.area > best[p.name].area) best[p.name] = c;
    }
    for (const [name, c] of Object.entries(best)) {
      const el = document.createElement('div');
      el.className = 'blab'; el.textContent = name;
      new ML.Marker({ element: el, anchor: 'center' }).setLngLat([c.lng, c.lat]).addTo(map);
    }
    for (const z of terrain.labels()) {
      const el = document.createElement('div');
      el.className = 'zlab zl-' + z.level;
      el.innerHTML = '<span class="zico" aria-hidden="true"></span><span><b>' + esc(z.name) + '</b><small>' + esc(z.region) + ' · illustrative height</small></span>';
      zoneMarks.push(new ML.Marker({ element: el, anchor: z.anchor, offset: z.anchor === 'right' ? [-14, 0] : [0, -16] }).setLngLat([z.lng, z.lat]).addTo(map));
    }
    const lo = () => map.getContainer().classList.toggle('lo', map.getZoom() < 16.4);
    map.on('zoom', lo); lo();
  }

  map.on('load', () => {
    ready = true;
    addLabels(); addMarkers(); applyMode(mode); setTerrain(terrOn);
    // the bounds fit is computed flat; on the tilted view the campus reads better a little closer
    map.jumpTo({ zoom: map.getZoom() + .45 });
    recluster(); opts.onReady && opts.onReady();
  });
  map.on('moveend', recluster);
  map.on('dragstart', () => opts.onUserMove && opts.onUserMove());
  map.on('click', () => opts.onSelect(null, 'map'));
  map.on('rotate', () => opts.onBearing && opts.onBearing(map.getBearing()));
  map.on('pitchend', () => opts.onPitch && opts.onPitch(map.getPitch()));
  map.on('error', e => console.warn('[map]', e && e.error && e.error.message));

  const dur = () => opts.reduced() ? 0 : 750;
  // fitBounds adds its padding to the map's own (left over from the last easeTo), so clear that first
  function noPad() { map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 }); }
  return {
    map,
    get mode() { return mode; },
    setMode(m) { mode = m; if (ready) applyMode(m); }, // before 'load', the load handler applies the current mode
    setReduced() { animate(); },
    select(key) {
      for (const m of markers.values()) { m.el.classList.remove('sel'); m.el.style.zIndex = ''; }
      sel = key || null;
      const m = key && markers.get(key);
      const src = map.getSource('sel');
      if (src) src.setData({ type: 'FeatureCollection', features: m ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [m.g.lng, m.g.lat] } }] : [] });
      if (m) { m.el.classList.add('sel'); m.el.style.zIndex = 5; }
      recluster();
      return m || null;
    },
    flyToGroup(key) {
      const m = markers.get(key);
      if (!m) return;
      map.easeTo({ center: [m.g.lng, m.g.lat], zoom: Math.max(map.getZoom(), 18), padding: opts.padding(), duration: dur() });
    },
    screenOf(key) { const m = markers.get(key); return m && !m.el.hidden ? map.project([m.g.lng, m.g.lat]) : null; },
    zoom(d) { map.easeTo({ zoom: map.getZoom() + d, duration: dur() / 2 }); },
    north() { map.easeTo({ bearing: 0, duration: dur() }); },
    tilt(on) { map.easeTo({ pitch: on ? 58 : 0, duration: dur() }); },
    buildings(on) { bldOn = on; setHeights(); },
    terrain(on) { setTerrain(on); },
    fit() { noPad(); map.fitBounds(bb, { padding: opts.padding(), duration: dur(), pitch: map.getPitch(), bearing: map.getBearing() }); },
    resize() { map.resize(); },
    get models() { return models; },
    /** Show the avatar at a position (f: {lng, lat, accuracy}); null hides it. jump: appear there instead of walking. */
    me(f, jump) {
      mePos = f;
      const src = map.getSource('me');
      if (src) src.setData({ type: 'FeatureCollection', features: f && f.accuracy ? [circle(f.lng, f.lat, Math.min(f.accuracy, 250))] : [] });
      if (!f) { if (avatar && avatar.show) avatar.show(false); return; }
      loadAvatar();
      if (avatar && avatar.moveTo) { avatar.moveTo(f.lng, f.lat, jump); avatar.show(true); }
    },
    /** Keep the avatar in view: centre on it (first call zooms in close, like a game camera). */
    followMe(f, first) {
      const o = { center: [f.lng, f.lat], padding: opts.padding(), duration: opts.reduced() ? 0 : first ? 900 : 1000 };
      if (first) Object.assign(o, { zoom: Math.max(map.getZoom(), 18.4), pitch: Math.max(map.getPitch(), 55) });
      else o.easing = t => t; // steady glide between fixes
      map.easeTo(o);
    },
    /** Is a position close enough to the campus for the map to show it (inside the map's bounds)? */
    near(lng, lat) { const b = map.getMaxBounds(); return !b || b.contains([lng, lat]); },
    get avatar() { return avatar; },
  };
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
function bbox(feats) {
  let a = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = c => { if (typeof c[0] === 'number') { a = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[0]), Math.max(a[3], c[1])]; } else c.forEach(walk); };
  feats.forEach(f => walk(f.geometry.coordinates));
  return [[a[0], a[1]], [a[2], a[3]]];
}
