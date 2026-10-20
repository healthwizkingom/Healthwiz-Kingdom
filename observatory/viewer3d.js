// HealthWiz Kingdom: the Observatory's 3D staircase preview (integration Phase 3), the prototype's js/viewer3d.js
// (prototypes/campus-observatory) with: imports from vendor/three (relative paths: the app has no import map), model
// paths relative to this file, and destroy(), which frees the renderer, its WebGL context, the animation loop, the
// observer and the listener when the Observatory page closes. Loaded only when a preview first opens (main.js).
//
// Illustrative 3D staircase preview (Three.js). It tests how the Observatory could show one staircase: straight flights,
// landings, L and U turns, steps and railings, on a display pedestal, with orbit, zoom and reset.
// The models are made in Blender (tools/blender_stairs.py → assets/models/stairs/<set>-<style>.glb and pedestals.glb):
// <set> is 'demo' or the ID of a staircase whose step rise and run were measured. If a model cannot load, the same
// staircase is built here in code instead. Rendering: soft shadows, filmic tone mapping, environment reflections, bloom.
// Its shape, number of steps, width and landings come from data/demo-geometry.json (demonstration values). The only real
// numbers it may use are a measured step rise and run (the three F21 staircases) and, when a record has one, an
// orientation. It never sizes a staircase from its stored angle.
import * as THREE from '../vendor/three/three.module.min.js';
import { OrbitControls } from '../vendor/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from '../vendor/three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';

// where the Blender models are; a host that cannot serve .glb can point these at glTF JSON copies
const STAIRS_BASE = new URL('../assets/models/stairs/', import.meta.url).href;
const STAIRS_EXT = '.glb';
const gltfCache = new Map();
function loadGLTF(url) {
  if (!gltfCache.has(url)) gltfCache.set(url, new Promise((ok, no) => new GLTFLoader().load(url, ok, undefined, no)));
  return gltfCache.get(url);
}
/** Mark a clone's meshes as sharing the cached model's geometry and materials (never disposed here). */
const crystalMats = new Map();
function crystal(base, col) { // one recoloured copy per crystal material and colour, kept for reuse
  const k = base.uuid + col;
  if (!crystalMats.has(k)) { const m = base.clone(); m.color.setHex(col); m.emissive.setHex(col); crystalMats.set(k, m); }
  return crystalMats.get(k);
}
function shared(o) { o.traverse(x => { x.userData.shared = true; if (x.isMesh) { x.castShadow = true; x.receiveShadow = true; } }); return o; }

const SUN_DIR = new THREE.Vector3(-.75, 1.15, .45).normalize(); // front left and high: shadows fall to the right of the default view
const CATCOL = { MILD: 0x7ee07c, MODERATE: 0xf6c94f, VIGOROUS: 0xff7b6e };

/* ---------- pixel textures for fantasy mode (NearestFilter keeps the pixels crisp) ---------- */
function canvasTex(n, draw) {
  const c = document.createElement('canvas'); c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const TEX = {};
function tex(name) {
  if (TEX[name]) return TEX[name];
  const r = rng(name.length * 97 + 13), pick = a => a[Math.floor(r() * a.length)];
  let t;
  if (name === 'stone') t = canvasTex(16, (g, n) => { // dressed blocks, 8×4 art pixels, offset rows
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const row = Math.floor(y / 4), off = row % 2 ? 4 : 0, edge = y % 4 === 3 || (x + off) % 8 === 7;
      g.fillStyle = edge ? '#2c2f5a' : y % 4 === 0 ? pick(['#b9bde6', '#b2b6e0']) : pick(['#9095c8', '#8a8fc2', '#969bce', '#8489bc']);
      g.fillRect(x, y, 1, 1);
    }
  });
  if (name === 'pedestal') t = canvasTex(16, (g, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const row = Math.floor(y / 4), off = row % 2 ? 2 : 0, edge = y % 4 === 3 || (x + off) % 4 === 3;
      g.fillStyle = edge ? '#1b1d3d' : pick(['#3c4072', '#383c6b', '#41457a']); g.fillRect(x, y, 1, 1); }
  });
  if (name === 'concrete') t = canvasTex(64, (g, n) => {
    g.fillStyle = '#c9c6bf'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 700; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.07)'; g.fillRect(r() * n, r() * n, 1, 1); }
  });
  if (name === 'rune') t = canvasTex(64, (g, n) => { // an original magic circle, drawn in pixels
    g.clearRect(0, 0, n, n); g.fillStyle = '#8ff7ea';
    const ring = (rad, gap) => { for (let a = 0; a < 360; a += 3) { if (gap && a % 30 < 9) continue; const x = n / 2 + Math.cos(a * Math.PI / 180) * rad, y = n / 2 + Math.sin(a * Math.PI / 180) * rad; g.fillRect(Math.round(x), Math.round(y), 1, 1); } };
    ring(30, false); ring(26, true); ring(14, false);
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; for (let s = 14; s < 26; s++) g.fillRect(Math.round(n / 2 + Math.cos(a) * s), Math.round(n / 2 + Math.sin(a) * s), 1, 1); }
  });
  if (name !== 'concrete') { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return (TEX[name] = t);
}

/** A box whose texture repeats once per `unit` metres on every face (BoxGeometry face order: ±x, ±y, ±z). */
function box(w, h, d, unit) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (unit) {
    const uv = g.attributes.uv, S = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * S[f][0] / unit, uv.getY(i) * S[f][1] / unit); }
  }
  return g;
}
function rod(a, b, r, mat) { // a cylinder from point a to point b
  const v = new THREE.Vector3().subVectors(b, a), len = v.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
  m.position.copy(a).addScaledVector(v, .5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
  m.castShadow = true;
  return m;
}
const ease = t => 1 - Math.pow(1 - t, 3);

export function createViewer({ host, msg, reduced, onView }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  const envTex = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), .04).texture; // soft studio reflections
  renderer.domElement.setAttribute('aria-label', 'Illustrative 3D staircase model. Drag to rotate, pinch or scroll to zoom.');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); msg.hidden = false; msg.textContent = 'The 3D view was paused by the browser. Close and open it again.'; });

  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(36, 1, .05, 200);
  scene.environment = envTex;
  // bloom: glowing runes, crystals and gold catch a soft halo (strong in fantasy, faint in realistic)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .5, .45, .82);
  composer.addPass(bloom); composer.addPass(new OutputPass());
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.minDistance = 2; controls.maxDistance = 30; controls.maxPolarAngle = Math.PI * .495;
  let rec = null, demo = null, mode = 'realistic', shape = null, model = null, stand = null, raf = 0, open = false, spinning = false, motes = null;
  let home = null, intro = null, tween = null, lastAz = null, source = null, sun = null;

  const ro = new ResizeObserver(() => { size(); if (home && !intro && !tween) fit(false); run(); }); ro.observe(host);
  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return false;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 500 ? 1.5 : 2)); composer.setSize(w, h);
    return true;
  }

  /* ---------- geometry: flights and landings in local metres; y up, the first flight climbs toward -z ---------- */
  /** The Blender model for this record, shape and mode: [stair, pedestal] nodes, or nulls when it cannot load. */
  function blenderParts() {
    const set = rec.measuredStep ? rec.id : 'demo', style = mode === 'fantasy' ? 'fantasy' : 'realistic';
    return Promise.all([loadGLTF(STAIRS_BASE + set + '-' + style + STAIRS_EXT), loadGLTF(STAIRS_BASE + 'pedestals' + STAIRS_EXT)])
      .then(([a, b]) => [a.scene.getObjectByName('stair__' + set + '__' + shape + '__' + style), b.scene.getObjectByName('pedestal__' + style)])
      .catch(e => { console.warn('[3d] Blender model unavailable, building it in code:', e && e.message); return [null, null]; });
  }
  function buildBlender(node, ped) {
    if (model) { scene.remove(model); dispose(model); }
    model = new THREE.Group(); motes = null;
    const F = mode === 'fantasy', col = CATCOL[rec.appCategory] || 0xfff0a8;
    const struct = shared(node.clone(true));
    struct.position.set(0, 0, 0); struct.rotation.set(0, 0, 0); struct.scale.set(1, 1, 1);
    // the crystals on the newel posts take the staircase's category colour
    struct.traverse(o => { if (o.isMesh && o.material && /crystal/.test(o.material.name)) o.material = crystal(o.material, col); });
    model.add(struct); model.userData.struct = struct;
    if (rec.orientationDeg != null) model.rotation.y = -rec.orientationDeg * Math.PI / 180; // north is -z in the scene
    const b0 = new THREE.Box3().setFromObject(struct), size = b0.getSize(new THREE.Vector3());
    if (F) fantasyExtras(size, col);
    scene.add(model);
    pedestal(Math.max(size.x, size.z) * .62 + .5, ped);
  }
  function fantasyExtras(size, col) { // rising motes and two coloured lights around the staircase
    [[-.9, .9], [.9, .5]].forEach(([fx, fy], k) => { const L = new THREE.PointLight(k ? 0x8ff7ea : col, 3, 7, 1.6); L.position.set(fx, size.y * fy + .6, 0); model.add(L); });
    const N = 140, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * (size.x + 3); pos[i * 3 + 1] = Math.random() * (size.y + 2); pos[i * 3 + 2] = (Math.random() - .5) * (size.z + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff0a8, size: .05, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
    motes.userData.top = size.y + 2; model.add(motes);
  }
  /** The demonstration plan for the chosen shape: the illustrative staircase (the measured F21 step size where there is one). */
  function demoPlan() {
    const m = rec.measuredStep, sh = demo.shapes[shape];
    const f = () => ({ n: demo.stepsPerFlight, riser: m ? m.rise_m : demo.riser_m, tread: m ? m.run_m : demo.tread_m, width: demo.width_m, turn: null, landingLength: demo.landingDepth_m, landingWidth: null });
    const P = [f()];
    if (sh.flights > 1) { P[0].turn = sh.turn; P.push(f()); }
    return P;
  }
  /** A staircase built in code from a plan: one entry per flight {n, riser, tread, width (m), turn after it, landing size}.
   *  Used for a surveyed staircase (its plan comes from the survey sheet), and as the fallback for the illustrative ones. */
  function buildProcedural(plan) {
    if (model) { scene.remove(model); dispose(model); }
    model = new THREE.Group(); motes = null;
    const F = mode === 'fantasy', RH = demo.railHeight_m, gap = demo.gapBetweenFlights_m;
    const col = CATCOL[rec.appCategory] || 0xfff0a8;
    const M = F ? {
      step: new THREE.MeshStandardMaterial({ map: tex('stone'), roughness: .95 }),
      nose: new THREE.MeshBasicMaterial({ color: 0x8ff7ea }),
      post: new THREE.MeshStandardMaterial({ color: 0x5e3d20, roughness: .8 }),
      rail: new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: .7, roughness: .3, emissive: 0x3a2a00 }),
      gem: new THREE.MeshBasicMaterial({ color: col }),
    } : {
      step: new THREE.MeshStandardMaterial({ map: tex('concrete'), roughness: .92 }),
      nose: new THREE.MeshStandardMaterial({ color: 0x7d7f80, roughness: .7 }),
      post: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: .7, roughness: .35 }),
      rail: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: .7, roughness: .35 }),
    };
    const struct = new THREE.Group();
    const up = new THREE.Vector3(0, 1, 0);
    const side = d => new THREE.Vector3().crossVectors(up, d).normalize(); // left of the climbing direction
    const posts = [];
    const solid = (cx, cz, w, d, h, rotY) => { // masonry block from the ground up to h
      const b = new THREE.Mesh(box(w, h, d, F ? .5 : 1), M.step);
      b.position.set(cx, h / 2, cz); b.rotation.y = rotY; b.castShadow = b.receiveShadow = true; struct.add(b); return b;
    };
    function flight(P, d, y0, f) {
      const rotY = Math.atan2(d.x, d.z), L = side(d), { n, riser, tread, width: W } = f;
      for (let i = 0; i < n; i++) {
        const top = y0 + (i + 1) * riser, c = P.clone().addScaledVector(d, (i + .5) * tread);
        solid(c.x, c.z, W, tread, top, rotY);
        const nose = new THREE.Mesh(new THREE.BoxGeometry(W * .96, .012, .035), M.nose); // the step edge: anti-slip strip, or a glowing rune line
        nose.position.copy(P).addScaledVector(d, i * tread + .02); nose.position.y = top + .006; nose.rotation.y = rotY; struct.add(nose);
      }
      for (const s of [1, -1]) { // railings on both sides: posts every few steps, a sloped rail between their tops
        const pts = [];
        for (let i = 0; i < n; i += demo.postEverySteps) pts.push(i);
        if (pts[pts.length - 1] !== n - 1) pts.push(n - 1);
        const tops = pts.map(i => {
          const base = P.clone().addScaledVector(d, (i + .5) * tread).addScaledVector(L, s * (W / 2 - .06));
          base.y = y0 + (i + 1) * riser;
          const top = base.clone(); top.y += RH;
          struct.add(rod(base, top, .022, M.post)); posts.push(top);
          return top;
        });
        for (let k = 0; k < tops.length - 1; k++) struct.add(rod(tops[k], tops[k + 1], .025, M.rail));
      }
      return { end: P.clone().addScaledVector(d, n * tread), y: y0 + n * riser };
    }
    function landingRail(a, b, y) { // a straight rail along a landing edge
      const A = a.clone(), B = b.clone(); A.y = B.y = y;
      const At = A.clone(), Bt = B.clone(); At.y += RH; Bt.y += RH;
      struct.add(rod(A, At, .022, M.post), rod(B, Bt, .022, M.post), rod(At, Bt, .025, M.rail)); posts.push(At, Bt);
    }
    // the flights one after another; each landing is drawn at the top of its flight, then the next flight starts from it
    let P = new THREE.Vector3(0, 0, 0), d = new THREE.Vector3(0, 0, -1), y = 0;
    plan.forEach((f, i) => {
      const r = flight(P, d, y, f), E = r.end, W = f.width, L = side(d), inset = W / 2 - .06, rotY = Math.atan2(d.x, d.z);
      y = r.y;
      if (i === plan.length - 1) return;
      const next = plan[i + 1], turn = f.turn || 'straight';
      if (turn === 'straight') {
        const LD = f.landingLength || W, c = E.clone().addScaledVector(d, LD / 2);
        solid(c.x, c.z, W, LD, y, rotY);
        for (const s of [1, -1]) landingRail(E.clone().addScaledVector(L, s * inset), E.clone().addScaledVector(d, LD).addScaledVector(L, s * inset), y);
        P = E.clone().addScaledVector(d, LD);
      } else if (turn === 'left' || turn === 'right') {
        const s = turn === 'left' ? 1 : -1, LD = f.landingLength || next.width, c = E.clone().addScaledVector(d, LD / 2);
        solid(c.x, c.z, W, LD, y, rotY);
        const far = E.clone().addScaledVector(d, LD - .06);
        landingRail(far.clone().addScaledVector(L, inset), far.clone().addScaledVector(L, -inset), y);
        landingRail(E.clone().addScaledVector(L, -s * inset), far.clone().addScaledVector(L, -s * inset), y);
        P = c.clone().addScaledVector(L, s * W / 2); d = L.clone().multiplyScalar(s);
      } else { // reverse: a U-turn on a landing as wide as both flights and the gap between them
        const LD = f.landingLength || W, span = f.landingWidth || (W + gap + next.width), off = span - next.width / 2 - W / 2;
        const c = E.clone().addScaledVector(d, LD / 2).addScaledVector(L, (span - W) / 2);
        solid(c.x, c.z, span, LD, y, rotY);
        const far = E.clone().addScaledVector(d, LD - .06);
        landingRail(far.clone().addScaledVector(L, -inset), far.clone().addScaledVector(L, span - W / 2 - .06), y);
        P = E.clone().addScaledVector(L, off); d = d.clone().negate();
      }
    });
    // centre the staircase over the pedestal; the orientation turn (only for a record that has one) is about that centre
    const b0 = new THREE.Box3().setFromObject(struct), c0 = b0.getCenter(new THREE.Vector3());
    struct.position.set(-c0.x, 0, -c0.z);
    model.add(struct); model.userData.struct = struct;
    if (rec.orientationDeg != null) model.rotation.y = -rec.orientationDeg * Math.PI / 180; // north is -z in the scene
    const size = b0.getSize(new THREE.Vector3());

    // fantasy: floating crystals on some posts, rising motes, two coloured lights
    if (F) {
      posts.forEach((p, i) => {
        if (i % 3) return;
        const g = new THREE.Mesh(new THREE.OctahedronGeometry(.07), M.gem);
        g.position.set(p.x - c0.x, p.y + .14, p.z - c0.z); g.userData.bob = i; model.add(g);
      });
      [[-.9, .9], [.9, .5]].forEach(([fx, fy], k) => { const L = new THREE.PointLight(k ? 0x8ff7ea : col, 3, 7, 1.6); L.position.set(fx, size.y * fy + .6, 0); model.add(L); });
      const N = 140, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * (size.x + 3); pos[i * 3 + 1] = Math.random() * (size.y + 2); pos[i * 3 + 2] = (Math.random() - .5) * (size.z + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff0a8, size: .05, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false }));
      motes.userData.top = size.y + 2; model.add(motes);
    }
    scene.add(model);
    pedestal(Math.max(size.x, size.z) * .62 + .5);
  }

  /* ---------- the display pedestal: a floating stone dais (fantasy) or a clean plinth (realistic) ---------- */
  function pedestal(R, ped) {
    if (stand) { scene.remove(stand); dispose(stand); }
    stand = new THREE.Group();
    if (ped) { // the Blender pedestal (radius 1), scaled to the staircase; extras added here
      const p = shared(ped.clone(true)); p.position.set(0, 0, 0); p.scale.set(R, 1, R); stand.add(p);
      if (mode === 'fantasy') {
        const halo = new THREE.Mesh(new THREE.CircleGeometry(R * 1.5, 40), new THREE.MeshBasicMaterial({ color: 0x5fe1e6, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.rotation.x = -Math.PI / 2; halo.position.y = -2.2; stand.add(halo);
        for (let k = 0; k < 4; k++) {
          const s = new THREE.Mesh(new THREE.OctahedronGeometry(.12), new THREE.MeshBasicMaterial({ color: k % 2 ? 0x8ff7ea : 0xf2c14e }));
          s.userData.orbit = { r: R * 1.18, a: k * Math.PI / 2, y: -.55 }; stand.add(s);
        }
        const glow = new THREE.PointLight(0x5fe1e6, 4, R * 3, 1.5); glow.position.y = -1.4; stand.add(glow);
      } else {
        const sh = new THREE.Mesh(new THREE.CircleGeometry(R * 1.25, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .07, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2; sh.position.y = -.239; stand.add(sh);
      }
    } else if (mode === 'fantasy') {
      const t = tex('pedestal').clone(); t.needsUpdate = true; t.repeat.set(R * 2, 1);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.04, .36, 8), new THREE.MeshStandardMaterial({ map: t, roughness: .9 }));
      top.position.y = -.18; top.receiveShadow = true; stand.add(top);
      const under = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.02, R * .3, 1.3, 8), new THREE.MeshStandardMaterial({ color: 0x2a2d58, roughness: 1 }));
      under.position.y = -1.01; stand.add(under);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.01, .045, 6, 8), new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: .8, roughness: .3, emissive: 0x3a2a00 }));
      rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 8; stand.add(rim);
      const rune = new THREE.Mesh(new THREE.PlaneGeometry(R * 1.9, R * 1.9), new THREE.MeshBasicMaterial({ map: tex('rune'), transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
      rune.rotation.x = -Math.PI / 2; rune.position.y = .004; rune.userData.spin = 1; stand.add(rune);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(R * 1.5, 40), new THREE.MeshBasicMaterial({ color: 0x5fe1e6, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.rotation.x = -Math.PI / 2; halo.position.y = -2.2; stand.add(halo);
      for (let k = 0; k < 4; k++) { // four small shards orbiting the dais
        const s = new THREE.Mesh(new THREE.OctahedronGeometry(.12), new THREE.MeshBasicMaterial({ color: k % 2 ? 0x8ff7ea : 0xf2c14e }));
        s.userData.orbit = { r: R * 1.18, a: k * Math.PI / 2, y: -.55 }; stand.add(s);
      }
      const glow = new THREE.PointLight(0x5fe1e6, 4, R * 3, 1.5); glow.position.y = -1.4; stand.add(glow);
    } else {
      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R, R, .24, 64), new THREE.MeshStandardMaterial({ color: 0xe9e8e3, roughness: .95 }));
      plinth.position.y = -.12; plinth.receiveShadow = true; stand.add(plinth);
      const edge = new THREE.Mesh(new THREE.TorusGeometry(R, .015, 6, 64), new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: .6 }));
      edge.rotation.x = Math.PI / 2; stand.add(edge);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(R * 1.25, 48), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .07, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.239; stand.add(shadow);
    }
    if (rec.orientationDeg != null) { // a north pointer on the rim, only for a record with an orientation
      const a = new THREE.Mesh(new THREE.ConeGeometry(.14, .4, 3), new THREE.MeshBasicMaterial({ color: 0xcc3f35 }));
      a.rotation.x = -Math.PI / 2; a.position.set(0, .03, -R - .25); stand.add(a);
    }
    scene.add(stand);
  }

  function lights() {
    scene.children.filter(o => o.userData.light).forEach(o => scene.remove(o));
    const F = mode === 'fantasy';
    // key light from the front left, so its soft shadows fall across the dais toward the right where the camera sees them
    const hemi = new THREE.HemisphereLight(F ? 0xb4a8ff : 0xdfe8f5, F ? 0x1a2350 : 0x8a8478, F ? .95 : .55);
    sun = new THREE.DirectionalLight(F ? 0xdfe6ff : 0xfff1dc, F ? 2.6 : 3.4);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0003; sun.shadow.normalBias = .02; sun.shadow.radius = 4;
    const fill = new THREE.DirectionalLight(F ? 0x8ff7ea : 0xbcd2ff, F ? .35 : .5); fill.position.set(8, 4, 6); // cool bounce from the camera side
    hemi.userData.light = sun.userData.light = sun.target.userData.light = fill.userData.light = true;
    scene.add(hemi, sun, sun.target, fill);
    scene.background = new THREE.Color(F ? 0x0d1430 : 0xd9dee4);
    scene.environmentIntensity = F ? .35 : .45;
    renderer.toneMappingExposure = F ? 1.05 : .95;
    bloom.strength = F ? .62 : .12; bloom.threshold = F ? .86 : .9; bloom.radius = F ? .5 : .3;
    scene.fog = new THREE.Fog(F ? 0x0d1430 : 0xf1f2ee, 18, 48);
  }

  /** Frame the staircase and pedestal so they fill the view: a three-quarter view at a distance from the bounding sphere. */
  function fit(animate) {
    model.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(model.userData.struct).union(new THREE.Box3().setFromObject(stand.children[0]));
    const sphere = box3.getBoundingSphere(new THREE.Sphere());
    const v = camera.fov * Math.PI / 180, h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect), f = Math.min(v, h);
    const dist = sphere.radius / Math.sin(f / 2) * .84; // a box fills less of the view than its bounding sphere
    const dir = new THREE.Vector3(1, .78, 1.05).normalize();
    const target = sphere.center.clone(); target.y = Math.max(.3, sphere.center.y * .9);
    home = { p: target.clone().addScaledVector(dir, dist), t: target };
    if (sun) { // the shadow camera just covers the staircase and its dais, for the sharpest shadow map
      const r = sphere.radius * 1.15;
      sun.target.position.copy(sphere.center); sun.position.copy(sphere.center).addScaledVector(SUN_DIR, r * 3);
      Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: .1, far: r * 6 }); sun.shadow.camera.updateProjectionMatrix();
    }
    if (animate && !reduced()) { intro = { t0: performance.now(), p0: target.clone().addScaledVector(dir, dist * 1.45), dur: 700 }; model.scale.setScalar(.85); }
    else { intro = null; model.scale.setScalar(1); camera.position.copy(home.p); }
    controls.target.copy(home.t); controls.update();
  }

  function dispose(o) {
    o.traverse(x => {
      if (x.userData.shared) return; // part of a cached Blender model
      if (x.geometry) x.geometry.dispose();
      if (x.material) [].concat(x.material).forEach(mt => { if (mt.map && !Object.values(TEX).includes(mt.map)) mt.map.dispose(); mt.dispose(); });
    });
  }

  let t0 = 0, quiet = 0;
  controls.addEventListener('change', () => run());
  function loop(t) {
    raf = 0;
    if (!open) return;
    const dt = Math.min(.05, (t - (t0 || t)) / 1000); t0 = t;
    const still = reduced();
    if (intro) { // entrance: the model grows into place while the camera glides in
      const k = Math.min(1, (t - intro.t0) / intro.dur), e = ease(k);
      camera.position.lerpVectors(intro.p0, home.p, e); model.scale.setScalar(.85 + .15 * e);
      if (k >= 1) intro = null;
    }
    if (tween) { // a button turn or zoom, eased
      const k = Math.min(1, (t - tween.t0) / 300), e = ease(k), off = tween.from.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), tween.ang * e).multiplyScalar(1 + (tween.scale - 1) * e);
      camera.position.copy(controls.target).add(off);
      if (k >= 1) tween = null;
    }
    controls.autoRotate = spinning && !still; controls.autoRotateSpeed = 1.2;
    if (!still && model) {
      if (motes) { const p = motes.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * .35; if (y > motes.userData.top) y = 0; p.setY(i, y); } p.needsUpdate = true; }
      model.children.forEach(o => { if (o.userData.bob != null) { o.rotation.y += dt * 1.5; o.position.y += Math.sin(t / 500 + o.userData.bob) * .0008; } });
      stand && stand.children.forEach(o => {
        if (o.userData.spin) o.rotation.z += dt * .15;
        if (o.userData.orbit) { const q = o.userData.orbit; q.a += dt * .5; o.position.set(Math.cos(q.a) * q.r, q.y + Math.sin(t / 700 + q.a) * .08, Math.sin(q.a) * q.r); o.rotation.y += dt * 2; }
      });
    }
    const moved = controls.update();
    composer.render();
    // reduced motion: nothing moves by itself, so draw only while something changes and then stop (battery, and the
    // main thread on slow devices); a camera change, a button, a new model or a resize starts the loop again
    if (still && !intro && !tween && !moved) { if (++quiet > 8) { raf = 0; return; } } else quiet = 0;
    if (onView) { const az = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()); if (lastAz == null || Math.abs(az - lastAz) > .5) { lastAz = az; onView(az); } }
    raf = requestAnimationFrame(loop);
  }
  const run = () => { quiet = 0; if (!raf && open) { t0 = 0; raf = requestAnimationFrame(loop); } };
  const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run(); };
  document.addEventListener('visibilitychange', vis);
  let gone = false;
  let token = 0;
  function rebuild(animate) {
    const my = ++token;
    lights();
    return (rec._plan ? Promise.resolve([null, null]) : blenderParts()).then(([node, ped]) => { // a surveyed stair is built from its own flights
      if (my !== token || !rec) return; // a newer selection, shape or mode took over while loading
      if (rec._plan) buildProcedural(rec._plan); else if (node) buildBlender(node, ped); else buildProcedural(demoPlan());
      source = rec._plan ? 'survey' : node ? 'blender' : 'code';
      size(); fit(animate); run();
    });
  }

  return {
    get shape() { return shape; },
    get spinning() { return spinning; },
    /** Show a staircase record. Called on every selection: the model, label and framing follow the new record. */
    show(r, d, m) {
      rec = r; demo = d; mode = m; shape = shape || d.defaultShape; open = true;
      if (!msg.dataset.loading) msg.hidden = true; // the loading note stays until the first model is in place
      run();
      return rebuild(true).then(() => { if (msg.dataset.loading) { delete msg.dataset.loading; msg.hidden = true; } }, e => {
        console.warn('[3d]', e); delete msg.dataset.loading; msg.hidden = false;
        msg.textContent = 'The 3D model could not be built on this device. The map and details still work.';
      });
    },
    setMode(m) { if (!rec) return; mode = m; rebuild(false); },
    setShape(s) { if (!rec || !demo.shapes[s]) return; shape = s; rebuild(true); },
    setReduced() { if (reduced()) spinning = false; },
    spin(on) { spinning = on && !reduced(); run(); },
    rotateBy(deg) { tween = { t0: performance.now(), from: camera.position.clone().sub(controls.target), ang: deg * Math.PI / 180, scale: 1 }; if (reduced()) tween.t0 -= 1000; run(); },
    zoomBy(f) {
      const off = camera.position.clone().sub(controls.target), L = off.length(), to = Math.min(controls.maxDistance, Math.max(controls.minDistance, L * f));
      tween = { t0: performance.now(), from: off, ang: 0, scale: to / L }; if (reduced()) tween.t0 -= 1000; run();
    },
    reset() { if (!home) return; tween = null; intro = null; camera.position.copy(home.p); controls.target.copy(home.t); controls.update(); run(); },
    hide() { open = false; cancelAnimationFrame(raf); raf = 0; },
    /** Free everything (the page closed): the loop, the observer, the listener, the scene, the renderer and its context. */
    destroy() {
      if (gone) return; gone = true; open = false; token++; cancelAnimationFrame(raf); raf = 0;
      ro.disconnect(); document.removeEventListener('visibilitychange', vis); controls.dispose();
      if (model) { scene.remove(model); dispose(model); model = null; }
      if (stand) { scene.remove(stand); dispose(stand); stand = null; }
      envTex.dispose(); composer.dispose && composer.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
    get isOpen() { return open; },
    get debug() { return { source, scene, renderer, model, stand, THREE }; }, // for testing in the browser console
  };
}
