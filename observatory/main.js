// HealthWiz Kingdom: the Observatory's map module (integration Phase 2). Loaded only when the 'campus' route opens over
// http(s) with WebGL: js/v6-campus.js adds <script type="module" src="observatory/main.js">, and this file announces
// itself as window.HWObsMap. The rest of the app never loads or waits for MapLibre.
//   HWObsMap.create(opts) → Promise<controller> (see ./map.js): loads MapLibre GL JS 4.7.1 (vendor/maplibre-gl, a
//   classic script and its stylesheet), the OpenStreetMap export and the illustrative elevation zones (data/), builds
//   the terrain and the map. Every file is same-origin, so the service worker caches it on first use.
//   HWObsMap.viewer(opts) → Promise<{viewer, demo}> (integration Phase 3): loads the 3D preview (./viewer3d.js, Three.js
//   r169 in vendor/three) and the demonstration dimensions (data/demo-geometry.json) the first time a preview opens.
//   HWObsMap.facts(lng, lat) → {near, zone} once the data is loaded: the nearest named OSM place and the illustrative
//   zone, computed in the browser (not survey data).
import { createTerrain } from './terrain.js';
import { createMap, catN } from './map.js';
import { nearestNamed } from './geo.js';

const base = new URL('../', import.meta.url);
const at = p => new URL(p, base).href;
let data = null, lib = null, demoGeo = null;

function addOnce(tag, attrs) {
  const sel = tag + '[data-hwobs="' + attrs['data-hwobs'] + '"]';
  const old = document.querySelector(sel);
  if (old) return old.__p;
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  el.__p = new Promise((ok, no) => { el.onload = () => ok(); el.onerror = () => no(new Error('could not load ' + (attrs.src || attrs.href))); });
  document.head.appendChild(el);
  return el.__p;
}
/** MapLibre GL JS: a classic UMD script that defines window.maplibregl, and its stylesheet, plus this module's styles. */
function loadLib() {
  if (window.maplibregl) return Promise.resolve();
  return lib || (lib = Promise.all([
    addOnce('script', { src: at('vendor/maplibre-gl/maplibre-gl.js'), 'data-hwobs': 'ml' }),
    addOnce('link', { rel: 'stylesheet', href: at('vendor/maplibre-gl/maplibre-gl.css'), 'data-hwobs': 'mlcss' }),
    addOnce('link', { rel: 'stylesheet', href: at('observatory/observatory.css'), 'data-hwobs': 'obscss' }),
  ]).catch(e => { lib = null; throw e; }));
}
async function loadData() {
  if (data) return data;
  const get = async u => { const r = await fetch(at(u), { cache: 'no-cache' }); if (!r.ok) throw new Error(u + ': HTTP ' + r.status); return r.json(); };
  const [osm, zones] = await Promise.all([get('data/campus-osm.geojson'), get('data/elevation-zones.geojson')]);
  data = { osm, zones, terrain: createTerrain(zones) };
  return data;
}

window.HWObsMap = {
  catN,
  async create(opts) {
    await loadLib();
    const d = await loadData();
    if (!window.maplibregl) throw new Error('the map library did not load');
    return createMap(Object.assign({}, opts, { osm: d.osm, terrain: d.terrain }));
  },
  async viewer(opts) {
    const [mod, demo] = await Promise.all([import('./viewer3d.js'), demoGeo || (demoGeo = fetch(at('data/demo-geometry.json'), { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('data/demo-geometry.json: HTTP ' + r.status); return r.json(); }).catch(e => { demoGeo = null; throw e; }))]);
    return { viewer: mod.createViewer(opts), demo };
  },
  facts(lng, lat) {
    if (!data) return null;
    return { near: nearestNamed([lng, lat], data.osm.features), zone: data.terrain.zoneAt(lng, lat) };
  },
  get loaded() { return !!data; },
};
window.dispatchEvent(new Event('hwobs:ready'));
