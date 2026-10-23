// HealthWiz Kingdom: the staircase stops as solid 3D models on the map (owner's request, 2026-10-21: "not see through to
// building, but solid model like pokestop"). Not part of the prototype.
//
// The model (assets/models/heart-stop.glb, tools/art/make_pokestop_glb.py) is the owner's Pokestop heart (prototypes/pokestop-heart,
// 2026-10-23), its final pose: a disc with an inner circle and a rim, a white heart on it, a thin white rim and a dashed white
// orbit with a bead. Two meshes: "tint" (the disc, inner circle and rim, in shades of white by vertex colour) and "white" (the
// heart, thin rim and orbit). The tint is multiplied by the staircase's difficulty colour (Mild, Moderate, Vigorous: the app's
// category), the white stays white. Drawn through a Three.js custom layer that shares the map's WebGL context and depth buffer,
// so a building in front of a stop hides it, as the Blender buildings (./models3d.js) and the map's own blocks do. Every stop
// has one fixed size on screen (76 px tall at the map's centre, the selected one too) and stands on the terrain.
// Light by construction (owner: "make sure it doesn't become laggy"): about 600 triangles a stop, and every stop is an instance
// of the same two meshes (three tinted ones, one per difficulty, and one white), so the whole set is about ten draw calls
// however many stops there are; hidden stops are scaled to nothing. The prototype's 10 s morph and orbit animation is not
// used: it is about 12,000 triangles and 27 parts a stop.
// The HTML markers stay as the tap targets, labels and selection rings (./map.js hides their drawn heart when this is
// ready); a marker that is hidden (search, Layers panel, a cluster) hides its stop.
// The glow: a soft halo around the disc (always turned to the viewer) and a pool of light on the ground under it, both in the
// difficulty colour; they are depth-tested too, so a building in front hides them with the stop.
// Motion: the stops turn about their upright axis whenever the map draws; while a staircase is selected its stop spins,
// redrawing the map about 12 times a second (and never with reduced motion, still mode or Performance mode, when the stops
// stand still facing the viewer).
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';

const PX = 76; // the stop's height on screen (px), the same for every stop
const DISC_Y = .66; // the disc's centre, as a fraction of the model's height (tools/art/make_pokestop_glb.py)

/** opts: {ML, url, colours: {1,2,3: css colour}, heightAt(lng, lat), terrainOn(), shown(key), motion(), night(), onReady(), onError(e)} */
export function createStopLayer(opts) {
  let glowTex = null, glowM = {}, poolM = {};
  let renderer, scene, camera, map = null, tintGeo = null, whiteGeo = null, mats = {}, whiteM = null, list = [], sel = null, loaded = false, spin = null, hemi, key;
  let built = null; // the instanced meshes: {tint: {1,2,3}, white, halo: {1,2,3}, pool: {1,2,3}}
  const t0 = performance.now();
  function build() {
    if (built) { for (const g of [built.tint, built.halo, built.pool]) Object.values(g).forEach(m => scene.remove(m)); scene.remove(built.white); }
    const n = { 1: 0, 2: 0, 3: 0 };
    list.forEach((s, gi) => { s.cat = n[s.cat] != null ? s.cat : 2; s.i = n[s.cat]++; s.gi = gi; s.g = new THREE.Object3D(); s.phase = (s.lng * 9173 + s.lat * 7919) % (2 * Math.PI); });
    const inst = (geo, mat, count, order) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count)); m.count = count; m.frustumCulled = false; m.renderOrder = order || 0; scene.add(m); return m; };
    built = { tint: {}, halo: {}, pool: {}, white: inst(whiteGeo, whiteM, list.length) };
    for (const c of [1, 2, 3]) {
      built.tint[c] = inst(tintGeo, mats[c], n[c]);
      built.halo[c] = inst(QUAD, glowM[c], n[c], 2);
      built.pool[c] = inst(QUAD, poolM[c], n[c], 1);
    }
    place();
  }
  // the stops are placed in metres east, up and south of their middle (glTF axes), and one matrix takes that to the map's
  // mercator units: placing them in mercator units directly lost metres to 32-bit rounding on the GPU
  function place() { // on the terrain (0 when it is off)
    const on = opts.terrainOn(), n = list.length || 1, k = Math.PI / 180, R0 = 6371008.8;
    const lng0 = list.reduce((t, s) => t + s.lng, 0) / n, lat0 = list.reduce((t, s) => t + s.lat, 0) / n, kx = k * R0 * Math.cos(lat0 * k), ky = k * R0;
    const mc = opts.ML.MercatorCoordinate.fromLngLat([lng0, lat0], 0), u = mc.meterInMercatorCoordinateUnits();
    model.makeTranslation(mc.x, mc.y, mc.z).multiply(new THREE.Matrix4().makeScale(u, -u, u)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    for (const s of list) s.g.position.set((s.lng - lng0) * kx, on ? opts.heightAt(s.lng, s.lat) : 0, -(s.lat - lat0) * ky);
  }
  // the ground the map draws, where the markers (the tap targets) stand: its terrain tiles can sit a few metres off the
  // terrain function (8 m in places), so each drawn frame asks the map, and the function only stands in until tiles load
  const ground = s => { const h = opts.terrainOn() && map.queryTerrainElevation ? map.queryTerrainElevation([s.lng, s.lat]) : null; return h == null ? (opts.terrainOn() ? opts.heightAt(s.lng, s.lat) : 0) : h; };
  // a soft round light: white in the middle, fading out; the materials tint it
  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.35, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }
  const glowMat = (c, o) => new THREE.MeshBasicMaterial({ map: glowTex, color: opts.colours[c], transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  function tint(night) {
    for (const [c, m] of Object.entries(mats)) m.emissive.set(opts.colours[c]).multiplyScalar(night ? .6 : .38);
    if (whiteM) whiteM.emissive.set(0xffffff).multiplyScalar(night ? .3 : .12);
    for (const m of Object.values(glowM)) m.opacity = night ? .6 : .7;
    for (const m of Object.values(poolM)) m.opacity = night ? .6 : .55;
    if (hemi) hemi.intensity = night ? 1.6 : 2.2;
    if (key) key.intensity = night ? 1.6 : 2.6;
  }
  function loop() { // the selected stop spins: a redraw about 12 times a second, only while one is selected and motion is allowed
    const want = !!sel && opts.motion() && loaded;
    if (want && !spin) spin = setInterval(() => map && map.triggerRepaint(), 83);
    else if (!want && spin) { clearInterval(spin); spin = null; }
  }
  const model = new THREE.Matrix4(), QUAD = new THREE.PlaneGeometry(1, 1), EYE = new THREE.Vector3(), O = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), L = new THREE.Matrix4(), Q = new THREE.Quaternion();
  const M = new THREE.Matrix4(), P = new THREE.Vector3(), S = new THREE.Vector3(), QY = new THREE.Quaternion(), QF = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  return {
    id: 'stops3d', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      map = m;
      camera = new THREE.Camera(); scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false; renderer.setPixelRatio(1);
      hemi = new THREE.HemisphereLight(0xffffff, 0x50586e, 2.2); scene.add(hemi);
      key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-.4, .8, .45); scene.add(key); // from the south-west, above (glTF: y up, z south)
      new GLTFLoader().load(opts.url, gltf => {
        const tm = gltf.scene.getObjectByName('tint'), wm = gltf.scene.getObjectByName('white');
        if (!tm || !tm.isMesh || !wm || !wm.isMesh) { opts.onError && opts.onError(new Error('heart-stop.glb has no tint or white mesh')); return; }
        tintGeo = tm.geometry; whiteGeo = wm.geometry;
        glowTex = glowTexture();
        const std = col => new THREE.MeshStandardMaterial({ color: col, vertexColors: true, roughness: .45, metalness: 0 });
        whiteM = std(0xffffff);
        for (const c of [1, 2, 3]) { mats[c] = std(opts.colours[c]); glowM[c] = glowMat(c, .7); poolM[c] = glowMat(c, .55); }
        tint(opts.night()); loaded = true; if (list.length) build(); loop();
        m.triggerRepaint();
        opts.onReady && opts.onReady();
      }, undefined, e => opts.onError && opts.onError(e));
    },
    render(gl, matrix) {
      if (!loaded || !list.length || !built) return;
      camera.projectionMatrix.fromArray(matrix).multiply(model);
      const z = map.getZoom(), lat = map.getCenter().lat, mpp = 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, z));
      const t = (performance.now() - t0) / 1000, mov = opts.motion(), face = -map.getBearing() * Math.PI / 180;
      // the halos face the camera: from the target, the camera is up by the pitch and back against the bearing
      const b = map.getBearing() * Math.PI / 180, p = map.getPitch() * Math.PI / 180;
      EYE.set(-Math.sin(b) * Math.sin(p), Math.cos(p), Math.cos(b) * Math.sin(p)); Q.setFromRotationMatrix(L.lookAt(EYE, O, UP));
      const sc = PX * mpp; // metres: one fixed size on screen
      for (const s of list) {
        const vis = opts.shown(s.key); s.g.visible = vis;
        if (vis) { s.g.scale.setScalar(sc); s.g.position.y = ground(s); }
        const ang = mov ? s.phase + t * (s.key === sel ? 4.2 : .7) : face; // still: the stop faces the viewer
        QY.setFromAxisAngle(UP, ang);
        const k = vis ? sc : 0, gp = s.g.position;
        S.setScalar(k); M.compose(gp, QY, S);
        built.tint[s.cat].setMatrixAt(s.i, M); built.white.setMatrixAt(s.gi, M);
        P.set(gp.x, gp.y + DISC_Y * k, gp.z); S.setScalar(k * 1.25); M.compose(P, Q, S); built.halo[s.cat].setMatrixAt(s.i, M);
        P.set(gp.x, gp.y + .02 * k, gp.z); S.setScalar(k * 1.1); M.compose(P, QF, S); built.pool[s.cat].setMatrixAt(s.i, M);
      }
      for (const g of [built.tint, built.halo, built.pool]) Object.values(g).forEach(m => { m.instanceMatrix.needsUpdate = true; });
      built.white.instanceMatrix.needsUpdate = true;
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(scene, camera);
    },
    onRemove() {
      clearInterval(spin); spin = null;
      if (tintGeo) tintGeo.dispose(); if (whiteGeo) whiteGeo.dispose();
      if (built) { for (const g of [built.tint, built.halo, built.pool]) Object.values(g).forEach(m => m.dispose()); built.white.dispose(); }
      [whiteM, ...Object.values(mats), ...Object.values(glowM), ...Object.values(poolM)].forEach(mt => mt && mt.dispose());
      QUAD.dispose(); if (glowTex) glowTex.dispose();
      renderer && renderer.dispose(); loaded = false; map = null; built = null;
    },
    /** The stops: [{key, lng, lat, cat: 1|2|3}]. */
    set(stops) { list = stops.map(s => ({ ...s })); if (loaded) build(); map && map.triggerRepaint(); },
    select(k) { sel = k || null; loop(); map && map.triggerRepaint(); },
    /** The terrain was switched, the motion setting or the look changed. */
    replace() { if (loaded && built) place(); loop(); map && map.triggerRepaint(); },
    night(on) { if (loaded) tint(on); map && map.triggerRepaint(); },
    repaint() { map && map.triggerRepaint(); },
    get ready() { return loaded; },
    get spinning() { return !!spin; },
    get debug() { return { scene, list, mats, glow: glowM, pool: poolM, built, renderer, model, THREE }; },
  };
}
