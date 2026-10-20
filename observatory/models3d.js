// HealthWiz Kingdom (integration Phase 4): the prototype's js/models3d.js, with imports from vendor/three (relative: the
// app has no import map) and onRemove freeing the scene's geometry and materials when the map is removed.
//
// The Blender-modelled campus buildings (assets/models/campus-fantasy.glb or campus-realistic.glb, made by
// tools/blender_campus.py in the look of the owner's drone video) drawn on the MapLibre map through a Three.js custom
// layer that shares the map's WebGL context and depth buffer.
// The GLB is in local metres east/north of an origin, with one node per building at its footprint centroid; each node is
// lifted to the illustrative terrain height at that centroid (the same height function that draws the terrain).
// The ground-level details (opts.propsUrl, tools/blender_campus_props.py) load after the buildings: one mesh at the origin
// whose every vertex is lifted to the terrain under it, so the roads follow the slopes. Their street lights glow at dusk,
// at night and in heavy rain or fog (light(), from the map's sky: ./sky.js).
//
// Lighting (opts.look): 'night' for Fantasy, a moonlight key light with real-time soft shadows (buildings shade each
// other and the ground), a cool sky fill, filmic (ACES) tone mapping and bright emissive windows; 'day' for Realistic, a
// tropical midday sun from the south-west (the map's own light), a sky-blue fill and lighter shadows. The scene never moves, so the shadow map is rendered once
// and again only when the terrain changes; drawing a frame costs no extra shadow pass. The ground shadows fall on an
// invisible catcher mesh that follows the terrain, drawn over the map.
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';

const MOON_DIR = new THREE.Vector3(-0.5, 0.53, -0.68).normalize(); // from the north-west, about 32° up (glTF: x east, y up, z south),
// so with the default north-facing view the shadows fall toward the viewer
const SUN_DIR = new THREE.Vector3(-0.42, 0.82, 0.38).normalize(); // from the south-west, about 55° up: a late-morning tropical sun

/** opts: {ML, url, look: 'night'|'day', heightAt(lng, lat), terrainOn(), quality(): 'high'|'low', onReady(), onError(e)} → a MapLibre custom layer. */
export function createModelLayer(opts) {
  const day = opts.look === 'day';
  let renderer, scene, camera, root = null, model = new THREE.Matrix4(), nodes = [], map = null, moon, catcher = null, hemi = null, rim = null;
  let drapes = [], lamps = []; // the ground-level details (opts.propsUrl), each vertex on the terrain; their lamp materials
  let lng0, lat0, kx, ky;
  const toLngLat = (x, z) => [lng0 + x / kx, lat0 - z / ky];

  function place() { // terrain height under each building (0 when the terrain is off), then the ground shadow catcher
    const on = opts.terrainOn();
    for (const n of nodes) n.obj.position.y = n.y0 + (on ? opts.heightAt(n.lng, n.lat) : 0);
    for (const d of drapes) { // the props: every vertex lifted to the terrain under it (each post stays upright)
      const p = d.geo.attributes.position, b = d.base;
      for (let i = 0; i < p.count; i++) { const [lng, lat] = toLngLat(b[i * 3], b[i * 3 + 2]); p.setY(i, b[i * 3 + 1] + (on ? opts.heightAt(lng, lat) : 0)); }
      p.needsUpdate = true; d.geo.computeBoundingSphere();
    }
    if (catcher) {
      const p = catcher.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { const [lng, lat] = toLngLat(p.getX(i), p.getZ(i)); p.setY(i, (on ? opts.heightAt(lng, lat) : 0) + .3); }
      p.needsUpdate = true; catcher.geometry.computeBoundingSphere();
    }
    if (renderer) renderer.shadowMap.needsUpdate = true;
  }
  /** A grid over the buildings that only shows shadows (ShadowMaterial), following the terrain. */
  function makeCatcher(box) {
    const pad = 45, x0 = box.min.x - pad, x1 = box.max.x + pad, z0 = box.min.z - pad, z1 = box.max.z + pad;
    const step = opts.quality() === 'low' ? 4 : 2.5, nx = Math.ceil((x1 - x0) / step), nz = Math.ceil((z1 - z0) / step);
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const m = new THREE.Mesh(g, new THREE.ShadowMaterial({ color: day ? 0x1d2a16 : 0x010214, opacity: day ? .42 : .78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true; m.frustumCulled = false; m.renderOrder = -1;
    return m;
  }
  function lightRig(box) {
    const c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2 + 40;
    moon = day ? new THREE.DirectionalLight(0xfff4e2, 3.0) : new THREE.DirectionalLight(0xdfe6ff, 3.2);
    moon.position.copy(c).addScaledVector(day ? SUN_DIR : MOON_DIR, r * 2); moon.target.position.copy(c);
    moon.castShadow = true;
    const hi = opts.quality() !== 'low', max = renderer.capabilities.maxTextureSize || 4096;
    moon.shadow.mapSize.set(Math.min(hi ? 2048 : 1024, max), Math.min(hi ? 2048 : 1024, max)); // 2048 is plenty for a 450 m campus; 4096 made each frame slow on laptops
    Object.assign(moon.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 4 });
    moon.shadow.bias = -0.0004; moon.shadow.normalBias = .06; moon.shadow.radius = hi ? 3 : 2;
    moon.shadow.camera.updateProjectionMatrix();
    scene.add(moon, moon.target);
    if (day) { hemi = new THREE.HemisphereLight(0xcfe2f3, 0x6f7a3a, 1.35); scene.add(hemi); return; } // sky blue above, sunlit lawn below
    hemi = new THREE.HemisphereLight(0xb9c6ff, 0x1a2350, 1.25); scene.add(hemi);
    rim = new THREE.DirectionalLight(0xffc98a, .55); rim.position.copy(c).add(new THREE.Vector3(80, 40, 60)); rim.target.position.copy(c); scene.add(rim, rim.target); // warm town glow from the north-east
  }
  // the base intensities of the look, and the sky's changes to them (dusk, night, rain, fog: ./sky.js)
  const BASE = { key: day ? 3.0 : 3.2, hemi: day ? 1.35 : 1.25, exp: day ? 1.0 : 1.15 };
  function light(L) {
    if (!moon) return;
    moon.intensity = BASE.key * (L ? L.key : 1);
    moon.color.set(day && L && L.warm ? 0xffc79a : day ? 0xfff4e2 : 0xdfe6ff);
    if (hemi) hemi.intensity = BASE.hemi * (L ? L.hemi : 1);
    if (renderer) renderer.toneMappingExposure = BASE.exp * (L ? .75 + .25 * Math.max(L.key, .4) : 1);
    for (const mt of lamps) mt.emissiveIntensity = L ? 3.2 * L.lamps : day ? 0 : 3.2;
    if (renderer) renderer.shadowMap.needsUpdate = true;
  }
  /** The ground-level details: roads, kerbs, drains, street lights, goal posts, car parks (tools/blender_campus_props.py). */
  function loadProps() {
    new GLTFLoader().load(opts.propsUrl, gltf => {
      if (!root) return;
      const g = gltf.scene;
      g.traverse(o => {
        if (!o.isMesh) return;
        o.frustumCulled = false; o.receiveShadow = true; o.castShadow = true;
        if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals(); // the file has none (smaller)
        drapes.push({ geo: o.geometry, base: Float32Array.from(o.geometry.attributes.position.array) });
        [].concat(o.material).forEach(mt => {
          for (const k of ['map']) if (mt[k]) mt[k].magFilter = THREE.NearestFilter;
          if (/lamp_glow/.test(mt.name || '')) lamps.push(mt);
          else if (/rune_glow|crystal_glow/.test(mt.name || '')) mt.emissiveIntensity = 2.6; // the Fantasy waystones, keystone and crystals always glow
        });
      });
      scene.add(g); place(); light(opts.sky ? opts.sky() : null); map && map.triggerRepaint();
    }, undefined, e => console.warn('[models] the ground details could not load.', e && e.message));
  }
  return {
    id: 'models', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      map = m;
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.setPixelRatio(1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = day ? 1.0 : 1.15;
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
      new GLTFLoader().load(opts.url, gltf => {
        root = gltf.scene;
        const ex = root.userData || {};
        lng0 = ex.origin_lng; lat0 = ex.origin_lat;
        root.traverse(o => {
          const u = o.userData;
          if (u && u.lng != null && u.lat != null) nodes.push({ obj: o, lng: u.lng, lat: u.lat, y0: o.position.y });
          if (o.isMesh) {
            o.frustumCulled = false; // the map's matrix is not a three.js camera; MapLibre decides what is on screen
            o.castShadow = true; o.receiveShadow = true;
            [].concat(o.material).forEach(mt => {
              for (const k of ['map', 'emissiveMap']) if (mt[k]) { mt[k].magFilter = THREE.NearestFilter; mt[k].anisotropy = 4; }
              if (mt.emissiveMap) mt.emissiveIntensity = 2.6; // windows: bright enough to read as light after tone mapping
              mt.shadowSide = THREE.FrontSide;
              if (/roof|ridge|slate|terracotta|wall|plinth|band|brick|wood/.test(mt.name || '')) { mt.roughness = Math.max(mt.roughness, .93); mt.metalness = 0; } // matte stone and slate: no glare
            });
          }
        });
        const k = Math.PI / 180, R = 6371008.8;
        if (lng0 == null && nodes.length) { const n = nodes[0]; lng0 = n.lng - n.obj.position.x / (k * R * Math.cos(n.lat * k)); lat0 = n.lat + n.obj.position.z / (k * R); }
        kx = k * R * Math.cos(lat0 * k); ky = k * R;
        const mc = opts.ML.MercatorCoordinate.fromLngLat([lng0, lat0], 0), s = mc.meterInMercatorCoordinateUnits();
        // glTF is y-up (x east, z south); the map is z-up mercator (y south)
        model = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        scene.add(root);
        const box = new THREE.Box3().setFromObject(root);
        lightRig(box);
        catcher = makeCatcher(box); scene.add(catcher);
        place(); light(opts.sky ? opts.sky() : null); m.triggerRepaint();
        opts.onReady && opts.onReady();
        if (opts.propsUrl) loadProps();
      }, undefined, e => opts.onError && opts.onError(e));
    },
    render(gl, matrix) {
      if (!root) return;
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(model);
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); // the map canvas may have been resized
      renderer.render(scene, camera);
    },
    onRemove() {
      if (scene) scene.traverse(o => { if (o.geometry) o.geometry.dispose(); [].concat(o.material || []).forEach(mt => { for (const k of ['map', 'emissiveMap', 'normalMap', 'roughnessMap']) if (mt[k]) mt[k].dispose(); mt.dispose(); }); });
      if (moon && moon.shadow && moon.shadow.map) moon.shadow.map.dispose();
      renderer && renderer.dispose(); root = null; nodes = []; // the WebGL context is the map's: MapLibre releases it
    },
    replace() { if (root) { place(); map && map.triggerRepaint(); } },
    /** The sky's lights (./sky.js skyLook: key, hemi, warm, lamps); null: the look's own. */
    light(L) { light(L); map && map.triggerRepaint(); },
    get props() { return drapes.length ? { meshes: drapes.length, lamps: lamps.length, glow: lamps.length ? lamps[0].emissiveIntensity : 0 } : null; },
    get ready() { return !!root; },
    get debug() { return { renderer, scene, catcher, moon, THREE }; }, // for testing in the browser console
  };
}
