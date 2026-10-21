// HealthWiz Kingdom: the staircase stops as solid 3D models on the map (owner's request, 2026-10-21: "not see through to
// building, but solid model like pokestop"). Not part of the prototype.
//
// One Blender model (assets/models/heart-stop.glb, tools/art/make_heart_sprite.py --glb): a silver post on a stone base
// with a gold rim, and a heart floating above it in the staircase's difficulty colour (Mild, Moderate, Vigorous: the app's
// category). Drawn through a Three.js custom layer that shares the map's WebGL context and depth buffer, so a building
// in front of a stop hides it, as the Blender buildings (./models3d.js) and the map's own blocks do. Each stop keeps a
// steady size on screen (about 76 px tall at the map's centre, like the marker it replaces) and stands on the terrain.
// The HTML markers stay as the tap targets, labels and selection rings (./map.js hides their drawn heart when this is
// ready); a marker that is hidden (search, Layers panel, a cluster) hides its stop.
// The glow (owner's request: "more prominent and noticeable with a slight glow"): the hearts light themselves a little in
// their colour, and a soft halo around each heart (always turned to the viewer) and a pool of light on the ground under
// it, both in the difficulty colour; they are depth-tested too, so a building in front hides them with the stop.
// Motion: the hearts turn whenever the map draws; while a staircase is selected its heart spins, redrawing the map about
// 12 times a second (and never with reduced motion, still mode or Performance mode, when the hearts stand still).
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';

const PX = 76, SEL = 1.3; // the stop's height on screen (px); the selected one is larger

/** opts: {ML, url, colours: {1,2,3: css colour}, heightAt(lng, lat), terrainOn(), shown(key), motion(), night(), onReady(), onError(e)} */
export function createStopLayer(opts) {
  let glowTex = null, glowM = {}, poolM = {};
  let renderer, scene, camera, map = null, post = null, heart = null, mats = {}, list = [], sel = null, loaded = false, spin = null, hemi, key;
  const t0 = performance.now();
  function build() {
    for (const s of list) { if (s.g) scene.remove(s.g); }
    for (const s of list) {
      const g = new THREE.Group();
      const p = post.clone(); g.add(p);
      const piv = new THREE.Object3D(), h = heart.clone(); h.material = mats[s.cat] || mats[2]; piv.add(h); g.add(piv);
      const halo = new THREE.Mesh(QUAD, glowM[s.cat] || glowM[2]); halo.position.y = .8; halo.scale.setScalar(1.25); halo.renderOrder = 2; g.add(halo);
      const pool = new THREE.Mesh(QUAD, poolM[s.cat] || poolM[2]); pool.rotation.x = -Math.PI / 2; pool.position.y = .02; pool.scale.setScalar(1.1); pool.renderOrder = 1; g.add(pool);
      s.g = g; s.piv = piv; s.halo = halo; s.phase = (s.lng * 9173 + s.lat * 7919) % (2 * Math.PI);
      scene.add(g);
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
    for (const m of Object.values(glowM)) m.opacity = night ? .6 : .7;
    for (const m of Object.values(poolM)) m.opacity = night ? .6 : .55;
    if (hemi) hemi.intensity = night ? 1.6 : 2.2;
    if (key) key.intensity = night ? 1.6 : 2.6;
  }
  function loop() { // the selected heart spins: a redraw about 12 times a second, only while one is selected and motion is allowed
    const want = !!sel && opts.motion() && loaded;
    if (want && !spin) spin = setInterval(() => map && map.triggerRepaint(), 83);
    else if (!want && spin) { clearInterval(spin); spin = null; }
  }
  const model = new THREE.Matrix4(), QUAD = new THREE.PlaneGeometry(1, 1), EYE = new THREE.Vector3(), O = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), L = new THREE.Matrix4(), Q = new THREE.Quaternion();
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
        gltf.scene.updateMatrixWorld(true);
        heart = gltf.scene.getObjectByName('heart'); post = gltf.scene.getObjectByName('post'); // post: one mesh per material
        gltf.scene.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
        if (!heart || !heart.isMesh || !post) { opts.onError && opts.onError(new Error('heart-stop.glb has no heart or post')); return; }
        glowTex = glowTexture();
        for (const c of [1, 2, 3]) { const mt = heart.material.clone(); mt.color.set(opts.colours[c]); mats[c] = mt; glowM[c] = glowMat(c, .7); poolM[c] = glowMat(c, .55); }
        tint(opts.night()); loaded = true; build(); loop();
        m.triggerRepaint();
        opts.onReady && opts.onReady();
      }, undefined, e => opts.onError && opts.onError(e));
    },
    render(gl, matrix) {
      if (!loaded || !list.length) return;
      camera.projectionMatrix.fromArray(matrix).multiply(model);
      const z = map.getZoom(), lat = map.getCenter().lat, mpp = 40075016.686 * Math.cos(lat * Math.PI / 180) / (512 * Math.pow(2, z));
      const t = (performance.now() - t0) / 1000, mov = opts.motion(), face = -map.getBearing() * Math.PI / 180;
      // the halos face the camera: from the target, the camera is up by the pitch and back against the bearing
      const b = map.getBearing() * Math.PI / 180, p = map.getPitch() * Math.PI / 180;
      EYE.set(-Math.sin(b) * Math.sin(p), Math.cos(p), Math.cos(b) * Math.sin(p)); Q.setFromRotationMatrix(L.lookAt(EYE, O, UP));
      for (const s of list) {
        const vis = opts.shown(s.key); s.g.visible = vis; if (!vis) continue;
        s.g.scale.setScalar(PX * mpp * (s.key === sel ? SEL : 1)); // metres: a steady size on screen
        s.g.position.y = ground(s); s.halo.quaternion.copy(Q);
        s.piv.rotation.y = mov ? s.phase + t * (s.key === sel ? 4.2 : .7) : face; // still: the heart faces the viewer
      }
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(scene, camera);
    },
    onRemove() {
      clearInterval(spin); spin = null;
      if (post) post.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(mt => mt.dispose()); } });
      if (heart) { heart.geometry.dispose(); heart.material.dispose(); }
      [...Object.values(mats), ...Object.values(glowM), ...Object.values(poolM)].forEach(mt => mt.dispose());
      QUAD.dispose(); if (glowTex) glowTex.dispose();
      renderer && renderer.dispose(); loaded = false; map = null;
    },
    /** The stops: [{key, lng, lat, cat: 1|2|3}]. */
    set(stops) { list = stops.map(s => ({ ...s })); if (loaded) build(); map && map.triggerRepaint(); },
    select(k) { sel = k || null; loop(); map && map.triggerRepaint(); },
    /** The terrain was switched, the motion setting or the look changed. */
    replace() { if (loaded) place(); loop(); map && map.triggerRepaint(); },
    night(on) { if (loaded) tint(on); map && map.triggerRepaint(); },
    repaint() { map && map.triggerRepaint(); },
    get ready() { return loaded; },
    get spinning() { return !!spin; },
    get debug() { return { scene, list, mats, glow: glowM, pool: poolM, renderer, model, THREE }; },
  };
}
