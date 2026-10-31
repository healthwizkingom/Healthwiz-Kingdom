// The campus in 3D, live in the browser: a standalone page (campus/index.html) for visitors who scan a QR code.
// It reuses the film's scene modules (ground, buildings, trees, sign, stairs, sky) and drives them with a light real-time loop:
// one world drawn at a time, both looks kept loaded so the toggle only swaps scenes, a single post pass, and a quality level that
// steps down on its own when the device cannot hold the frame rate. The app and its Observatory map are untouched.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadTerrain } from './ground.js';
import { buildWorld, applyAtmosphere } from './world.js';
import { atmosphere } from './atmos.js';
import { planStairs, rampsOf, installStairs } from './stairs.js';
import { installFx } from './fx.js';
import { installLife } from './life.js';
import { installSign } from './sign.js';
import { installExtras } from './extras.js';
import { createUber } from './post.js';
import { FastBloom } from './bloom.js';
import { noiseTex } from './noise.js';
import { frameAt } from './director.js';
import { LOOP, STAIR_EVENTS } from './timeline.js';
import { ROOT } from './common.js';

const $ = (id) => document.getElementById(id);
const mobile = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
const QUALITY = [
  { pr: 0.85, ms: 0, bloom: false }, // lite
  { pr: 1.25, ms: 2, bloom: false }, // balanced
  { pr: 1.5, ms: 4, bloom: true },   // full
];
const WEATHER = [
  ['Clear', { cloud: 0.2, rain: 0, fog: 0, haze: 0.15, storm: 0, wet: 0, flash: 0 }],
  ['Cloudy', { cloud: 0.85, rain: 0, fog: 0.08, haze: 0.1, storm: 0, wet: 0.1, flash: 0 }],
  ['Rain', { cloud: 1, rain: 0.9, fog: 0.12, haze: 0, storm: 0, wet: 1, flash: 0 }],
  ['Storm', { cloud: 1, rain: 1, fog: 0.12, haze: 0, storm: 0.9, wet: 1, flash: 0 }],
  ['Mist', { cloud: 0.45, rain: 0, fog: 0.8, haze: 0.25, storm: 0, wet: 0.4, flash: 0 }],
];
const TIMES = [['Morning', 8.3], ['Noon', 12.2], ['Golden hour', 17.6], ['Dusk', 19.6], ['Night', 22.2]];

const S = { look: 'realistic', tod: { realistic: 0, fantasy: 3 }, wx: 0, quality: mobile ? 1 : 2, lite: false, tourOn: false, tourT0: 0, stair: { on: false, t0: 0 }, flyT: -1 };
const worlds = {};
let R, cam, controls, rt, bloom, uber, black, shared, size = { w: 1, h: 1 };
const fail = (msg, detail) => { $('errmsg').textContent = msg; $('errdetail').textContent = detail || ''; $('err').classList.add('show'); };
/** what this browser says about WebGL, for the error screen */
function probeGL() {
  const out = { ua: navigator.userAgent };
  for (const k of ['webgl2', 'webgl']) {
    try { const g = document.createElement('canvas').getContext(k); out[k] = g ? 'ok' : 'null'; if (g && !out.gpu) { const e = g.getExtension('WEBGL_debug_renderer_info'); out.gpu = e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : ''; } } catch (err) { out[k] = 'error: ' + err.message; }
  }
  return out;
}
const loadMsg = (msg, pct) => { $('loadmsg').textContent = msg; if (pct != null) $('bar').firstElementChild.style.width = pct + '%'; };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

// ------------------------------------------------------------------ renderer + post
function setupTargets() {
  const q = QUALITY[S.quality];
  R.setPixelRatio(Math.min(devicePixelRatio || 1, q.pr)); R.setSize(innerWidth, innerHeight);
  const b = R.getDrawingBufferSize(new THREE.Vector2()); size = { w: b.x, h: b.y };
  if (rt) rt.dispose();
  rt = new THREE.WebGLRenderTarget(size.w, size.h, { type: THREE.HalfFloatType, samples: q.ms });
  if (bloom) { for (const l of bloom.lv || []) { l.a.dispose(); l.b.dispose(); } bloom = null; }
  if (q.bloom) bloom = new FastBloom(size.w, size.h);
  cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
}

function drawFrame(A, tod, post = {}) {
  const U = uber.U, w = worlds[S.look];
  if (w.shadowDirty) { R.shadowMap.needsUpdate = true; w.shadowDirty = false; }
  R.setRenderTarget(rt); R.clear(); R.render(w.scene, cam);
  const bl = bloom ? bloom.run(R, rt.texture, post.bloomThreshold ?? 1.5) : [black, black, black];
  U.tA.value = rt.texture; U.tB.value = rt.texture; U.bA1.value = U.bB1.value = bl[0]; U.bA2.value = U.bB2.value = bl[1]; U.bA3.value = U.bB3.value = bl[2];
  U.uBloomA.value = U.uBloomB.value = bloom ? A.bloom * (post.bloom ?? 1) : 0; U.uExpA.value = U.uExpB.value = A.exposure * (post.exposure ?? 1);
  U.uMode.value = 0; U.uMix.value = 0; U.uAspect.value = size.w / size.h; U.uTime.value = performance.now() / 1000; U.uShaft.value = 0; U.uFrame.value = (U.uFrame.value + 1) % 100000;
  U.uFade.value = 0; U.uVig.value = post.vig ?? 0.28; U.uGrain.value = post.grain ?? 0.02; U.uSat.value = post.sat ?? 1.06; U.uContrast.value = post.contrast ?? 1.05;
  U.uLift.value.set(...(post.lift || [0, 0, 0])); U.uGain.value.set(...(post.gain || [1, 1, 1])); U.uGamma.value.set(...(post.gamma || [1, 1, 1]));
  uber.draw(R);
}

// ------------------------------------------------------------------ worlds
async function ensureWorld(look, label) {
  if (worlds[look]) return worlds[look];
  loadMsg(label || 'Loading the ' + look + ' campus...');
  await nextFrame();
  const w = await buildWorld(look, shared);
  worlds[look] = w;
  if (look === 'realistic') await installExtras({ realistic: w }, shared, console.log);
  else { installFx(w, w.H); installLife(w, shared.osm, w.H); await installSign(w, w.H); await installStairs(w, shared.plan, console.log); }
  return w;
}
const groundAt = (x, z) => (window.groundH ? window.groundH(x, z) : 0);

// ------------------------------------------------------------------ camera: places, floor, tour
const PLACES = [
  ['Overview', () => [[-250, 170, 235], [-20, 4, -40]]],
  ['Entrance sign', () => { const g = groundAt(-74, -54); return [[-102, g + 7, -54], [-74, g + 4, -54]]; }],
  ['Main gate', () => { const g = groundAt(-156, -98); return [[-156, g + 6, -62], [-156, g + 5, -98]]; }],
  ['Blok E stair', () => { const c = window.stairCam('ST26', 14, 6, 5, 0.5, 55); return [c.p, c.t]; }],
  ['Academic block', () => [[70, 52, 70], [-20, 10, -42]]],
];
function flyTo(pos, tgt) { S.fly = { p0: cam.position.clone(), t0: controls.target.clone(), p1: new THREE.Vector3(...pos), t1: new THREE.Vector3(...tgt), at: performance.now(), dur: 1900 }; controls.autoRotate = false; }
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function keepAbove() { // never let the roaming camera sink into the ground or a building roof
  const p = cam.position, floor = Math.max(groundAt(p.x, p.z) + 1.8, window.clearance ? window.clearance(p.x, p.z) : -1e9);
  if (p.y < floor) p.y = floor;
}

function setCameraFrom(c) {
  cam.position.set(...c.p); cam.fov = c.fov || 50; cam.up.set(0, 1, 0); cam.lookAt(c.t[0], c.t[1], c.t[2]); if (c.roll) cam.rotateZ(c.roll); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
}

async function startTour() {
  const hadFan = !!worlds.fantasy; $('bTour').disabled = true;
  $('load').classList.remove('gone'); if (!hadFan) await ensureWorld('fantasy', 'Preparing the tour...'); $('load').classList.add('gone'); $('bTour').disabled = false;
  S.tourOn = true; S.tourT0 = performance.now() / 1000; controls.enabled = false; controls.autoRotate = false;
  $('bTour').textContent = 'Stop tour'; $('bTour').classList.add('on'); $('bTour').setAttribute('aria-pressed', 'true'); $('bottom').classList.add('touring');
}
function stopTour() {
  if (!S.tourOn) return; S.tourOn = false;
  const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
  const tgt = cam.position.clone().addScaledVector(dir, 40); tgt.y = Math.max(groundAt(tgt.x, tgt.z) + 2, 1);
  controls.target.copy(tgt); controls.enabled = true; controls.update();
  $('bTour').textContent = 'Watch tour'; $('bTour').classList.remove('on'); $('bTour').setAttribute('aria-pressed', 'false');
}

// ------------------------------------------------------------------ UI
function setLook(look) {
  if (S.look === look) return;
  const go = async () => {
    if (!worlds[look]) { $('load').classList.remove('gone'); await ensureWorld(look); $('load').classList.add('gone'); }
    const f = $('fade'); f.style.background = look === 'fantasy' ? '#cbb8ff' : '#fff'; f.style.opacity = '0.9';
    setTimeout(() => { S.look = look; refreshButtons(); setTimeout(() => { f.style.opacity = '0'; }, 60); }, 220);
  };
  go().catch((e) => fail('Could not load the ' + look + ' campus: ' + (e && e.message)));
}
function refreshButtons() {
  const fan = S.look === 'fantasy';
  $('bReal').classList.toggle('on', !fan); $('bFan').classList.toggle('on', fan); $('bReal').setAttribute('aria-pressed', String(!fan)); $('bFan').setAttribute('aria-pressed', String(fan));
  $('lookname').textContent = fan ? 'Fantasy' : 'Realistic';
  $('bWx').textContent = 'Weather: ' + WEATHER[S.wx][0]; $('bTime').textContent = 'Time: ' + TIMES[S.tod[S.look]][0];
  $('bLite').classList.toggle('on', S.lite); $('bLite').setAttribute('aria-pressed', String(S.lite));
}
function hint(msg, ms = 6000) { const h = $('hint'); h.textContent = msg; h.classList.remove('off'); clearTimeout(hint.t); hint.t = setTimeout(() => h.classList.add('off'), ms); }

function wireUI() {
  $('bReal').onclick = () => { stopTour(); setLook('realistic'); };
  $('bFan').onclick = () => { stopTour(); setLook('fantasy'); };
  $('bTour').onclick = () => (S.tourOn ? stopTour() : startTour());
  $('bPlaces').onclick = () => { const o = $('places').classList.toggle('open'); $('bPlaces').setAttribute('aria-expanded', String(o)); };
  $('bWx').onclick = () => { S.wx = (S.wx + 1) % WEATHER.length; refreshButtons(); };
  $('bTime').onclick = () => { S.tod[S.look] = (S.tod[S.look] + 1) % TIMES.length; refreshButtons(); };
  $('bLite').onclick = () => { S.lite = !S.lite; S.quality = S.lite ? 0 : mobile ? 1 : 2; setupTargets(); refreshButtons(); };
  for (const [name, fn] of PLACES) {
    const b = document.createElement('button'); b.textContent = name;
    b.onclick = () => { stopTour(); const [p, t] = fn(); flyTo(p, t); $('places').classList.remove('open'); $('bPlaces').setAttribute('aria-expanded', 'false'); };
    $('places').appendChild(b);
  }
  addEventListener('resize', () => { setupTargets(); });
  // tapping the heart at the Blok E stair plays its story: the heart opens into the photo, the steps light, a student climbs
  let down = null;
  R.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  R.domElement.addEventListener('pointerup', (e) => {
    if (!down || S.tourOn || S.look === undefined) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
    if (moved > 8 || dt > 500 || !window.stairPlan) return;
    const st = window.stairPlan[0], h = new THREE.Vector3(st.heart[0], groundAt(st.heart[0], st.heart[1]) + 3.1, st.heart[1]).project(cam);
    if (h.z > 1) return; const sx = (h.x * 0.5 + 0.5) * innerWidth, sy = (-h.y * 0.5 + 0.5) * innerHeight;
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < 64 && !S.stair.on) { S.stair = { on: true, t0: performance.now() / 1000 }; hint('Watch the Blok E stair: the steps light up and a student climbs.', 7000); }
  });
  controls.addEventListener('start', () => { controls.autoRotate = false; S.fly = null; $('places').classList.remove('open'); setTimeout(() => $('hint').classList.add('off'), 1800); });
}

// ------------------------------------------------------------------ main loop
let last = performance.now(), ema = 16, slow = 0, frames = 0;
function tick(nowMs) {
  requestAnimationFrame(tick);
  if (document.hidden) { last = nowMs; return; }
  const dt = Math.min(nowMs - last, 200); last = nowMs; ema += (dt - ema) * 0.05; frames++;
  if (!S.lite && S.quality > 0 && frames > 90) { if (ema > 40) slow++; else slow = 0; if (slow > 45) { S.quality--; slow = 0; frames = 0; ema = 16; setupTargets(); } } // too slow for 25 fps: step the quality down
  const now = nowMs / 1000;
  let look = S.look, tod, W, shadow = { cx: 0, cz: 20, r: 330 }, post = {}, t = now, stairT = STAIR_EVENTS.ST26.tap - 8;

  if (S.tourOn) {
    const ft = (now - S.tourT0) % LOOP, fr = frameAt(ft, 'left');
    look = fr.trans && fr.other && fr.trans.mix > 0.5 ? fr.other : fr.look;
    tod = fr.tod; W = fr.W; shadow = fr.shadow; post = fr.post || {};
    const inGate = ft >= 11 && ft < 23; t = inGate ? 9 + (ft - 11) / 12 * 2 : ft >= 23 ? ft - 12 : ft; stairT = undefined;
    setCameraFrom(fr.cam);
    if (look !== S.look) { S.look = look; refreshButtons(); }
  } else {
    if (S.fly) { const u = Math.min(1, (performance.now() - S.fly.at) / S.fly.dur), k = ease(u); cam.position.lerpVectors(S.fly.p0, S.fly.p1, k); controls.target.lerpVectors(S.fly.t0, S.fly.t1, k); if (u >= 1) S.fly = null; }
    controls.update(); keepAbove();
    tod = TIMES[S.tod[look]][1]; W = WEATHER[S.wx][1];
    if (S.stair.on) { const e = STAIR_EVENTS.ST26, el = now - S.stair.t0; stairT = e.tap - 0.6 + el; if (el > 17) S.stair.on = false; }
  }
  const w = worlds[look], A = atmosphere(look, tod % 24, W), F = { cam, t, stairT, W, shadow };
  applyAtmosphere(w, A, F);
  const frame = { size: 1080, t, tod, W }; for (const fn of w.updaters) fn(A, F, frame);
  cam.updateMatrixWorld();
  drawFrame(A, tod, post);
}

// ------------------------------------------------------------------ boot
async function boot() {
  // try the full settings first, then plainer ones: some phones refuse a context with particular attributes
  let lastErr = null;
  for (const attrs of [{ antialias: false, powerPreference: 'high-performance', alpha: false }, { antialias: false, alpha: false }, {}]) {
    try { R = new THREE.WebGLRenderer(attrs); break; } catch (e) { lastErr = e; R = null; }
  }
  if (!R) { const g = probeGL(); console.error('[campus] no WebGL context', lastErr, g); return fail('The graphics could not start on this browser. ' + (g.webgl2 === 'ok' ? '' : 'WebGL 2 is not available here. ') + 'Try opening this page in Chrome (not inside another app), with hardware acceleration on.', 'Error: ' + (lastErr && lastErr.message) + '\nWebGL2: ' + g.webgl2 + ', WebGL: ' + g.webgl + (g.gpu ? '\nGPU: ' + g.gpu : '') + '\n' + g.ua); }
  R.toneMapping = THREE.NoToneMapping; R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.shadowMap.autoUpdate = false;
  $('view').appendChild(R.domElement);
  R.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('The graphics were reset by the device. Tap Try again.'); });
  cam = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.5, 5000);
  cam.position.set(-250, 170, 235);
  controls = new OrbitControls(cam, R.domElement);
  controls.target.set(-20, 4, -40); controls.enableDamping = true; controls.dampingFactor = 0.09; controls.minDistance = 6; controls.maxDistance = 650; controls.maxPolarAngle = 1.45; controls.autoRotate = true; controls.autoRotateSpeed = 0.35; controls.zoomSpeed = 0.9; controls.panSpeed = 0.8; controls.screenSpacePanning = false;
  controls.listenToKeyEvents(window);
  uber = createUber(noiseTex());
  black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); black.needsUpdate = true;
  setupTargets();

  loadMsg('Loading the terrain...', 8);
  const hfn = await loadTerrain();
  const [osm, stairs] = await Promise.all([fetch(ROOT + 'data/campus-osm.geojson').then((r) => r.json()), fetch(ROOT + 'data/stair-survey.json').then((r) => r.json())]);
  shared = { osm, hfn, shadowSize: mobile ? 1024 : 2048, stairPoints: Object.values(stairs.stairs).filter((s) => s.bottom && s.bottom.lng).map((s) => [s.bottom.lng, s.bottom.lat]) };
  shared.plan = planStairs(osm, hfn); shared.ramps = rampsOf(shared.plan);
  shared.stairPoints.push(...shared.plan.map((p) => [100.5384 + p.base[0] / 110700, 5.351065 - p.base[1] / 111195]));
  loadMsg('Building the campus...', 30);
  await ensureWorld('realistic', 'Building the campus...');
  loadMsg('Almost there...', 92);
  wireUI(); refreshButtons();
  requestAnimationFrame(tick);
  setTimeout(() => { $('load').classList.add('gone'); hint('Drag to look around. Pinch or scroll to zoom. Tap the heart on the stair.', 8000); }, 400);
  window.campusLive = { S, worlds, cam, controls, setLook, startTour, stopTour, flyTo };
}
boot().catch((e) => { console.error(e); fail('Something went wrong while loading.', String(e && (e.stack || e.message)).slice(0, 700)); });
