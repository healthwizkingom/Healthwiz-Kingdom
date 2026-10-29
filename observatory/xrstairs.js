// HealthWiz Kingdom: 3D Stair Sight, the WebXR mode of the Scrying Glass (js/v6-arcana.js). Loaded only when a player starts it.
// The session is requested by js/v6-arcana.js (inside the tap, so the browser allows it) and handed to start(). This module:
//   * renders with Three.js r169 (vendor/three) into the AR view, reference space 'local-floor';
//   * gathers 3D points up the middle of the view each frame: from WebXR hit tests on 13 rays (pitched 60° down to 0°) and, when the
//     phone has ARCore depth ('depth-sensing', cpu-optimized), from 24 depth samples down the centre column;
//   * keeps the last ~1.5 s of points and, every 8 frames, turns them into a profile (d = forward distance, h = height) for
//     HWStairSight.profile3d (js/v6-stairsight.js): flat treads at rising heights → riser, tread, angle, where the first riser is;
//   * locks after 3 agreeing results (riser within 3 cm) and builds the WHOLE stairway in 3D from them: n steps (the stairway's
//     counted steps), each with a glowing nosing 1 m wide (the width is not measured), a rune at each end, and the pixel ghost climbing
//     at the pace of the target power (each step m g r ÷ P, landings 2 step-times), flight by flight with its landings and U-turns.
//     Steps beyond what the camera saw are extrapolated from the measured riser and tread.
// Nothing is saved or sent. What is shown is an AR estimate: drift, glare, dark or shiny steps and people in the way all affect it.
import * as THREE from '../vendor/three/three.module.min.js';

const GHOST = ['..aaa..', '.aaaaa.', 'aabaaba', 'aaaaaaa', 'aaaaaaa', 'aaaaaaa', 'a.a.a.a'];
const NEON = 0x5ff6ff, DIM = 0xa98cff, GOLD = 0xffd86b;

function ghostTexture() {
  const c = document.createElement('canvas'); c.width = 7; c.height = 7; const x = c.getContext('2d');
  GHOST.forEach((row, y) => [...row].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = ch === 'b' ? '#1b1340' : '#e9fbff'; x.fillRect(i, y, 1, 1); } }));
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

/** start(session, {n, flights, P, m, analyse, onState}) → {stop, rescan}. flights: the stairway's flights [{n, turn, land}] (counts and turns; riser and tread are measured here); P: target power (W), m: mass (kg): each step takes m g r ÷ P (0: the ghost waits); analyse: HWStairSight.profile3d;
    onState({phase:'searching'|'locked'|'ended', why, riser, tread, angle, depth, step}) for the page's text. */
export async function start(session, o) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor');
  renderer.domElement.style.display = 'none'; document.body.appendChild(renderer.domElement);
  await renderer.xr.setSession(session);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, .01, 50);
  scene.add(new THREE.AmbientLight(0xffffff, 1));

  const viewer = await session.requestReferenceSpace('viewer');
  const sources = [];
  for (let a = -60; a <= 0; a += 5) {
    const r = a * Math.PI / 180;
    try { sources.push(await session.requestHitTestSource({ space: viewer, offsetRay: new XRRay({ x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: Math.sin(r), z: -Math.cos(r), w: 0 }) })); } catch (e) { /* this ray is not supported */ }
  }
  const depth = session.depthUsage === 'cpu-optimized';

  // a reticle at the nearest surface while searching
  const reticle = new THREE.Mesh(new THREE.RingGeometry(.06, .08, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: NEON, transparent: true, opacity: .9 }));
  reticle.visible = false; scene.add(reticle);

  const glow = glowTexture(), stairs = new THREE.Group(); scene.add(stairs);
  const ghost = new THREE.Sprite(new THREE.SpriteMaterial({ map: ghostTexture(), transparent: true, depthTest: false }));
  ghost.scale.set(.22, .22, 1); ghost.visible = false; scene.add(ghost);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: NEON, transparent: true, opacity: .55, depthTest: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(2, 2, 1); ghost.add(halo);                                      // relative to the ghost: twice its size
  const trailPos = [], trail = []; for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: NEON, transparent: true, opacity: 0, depthTest: false, blending: THREE.AdditiveBlending })); s.scale.set(.08, .08, 1); scene.add(s); trail.push(s); }

  let pts = [], frameN = 0, lockN = 0, prev = null, model = null, fwdLock = null, t0 = 0, lastStep = -1;
  const S = { phase: 'searching', why: 'Point the phone up the stairs from the bottom and move it slowly.', depth };
  const tell = () => { try { o.onState && o.onState(Object.assign({}, S)); } catch (e) {} };
  tell();

  const up = new THREE.Vector3(0, 1, 0);
  /* The stairway in the world, flight by flight, at the MEASURED riser and tread: a straight flight continues forward after its landing;
     after a 'reverse' turn (a U-stair) the next flight starts beside the end of the last one, 1.1 m to the right, and climbs back (the side
     is not surveyed). Landings without a surveyed length are 1.2 m deep (assumed). */
  function build(res, camPos, fwd) {
    stairs.clear();
    const SS = window.HWStairSight, right = new THREE.Vector3().crossVectors(fwd, up).normalize(), W = .5, LANE = 1.1;
    const flights = (o.flights && o.flights.length ? o.flights : [{ n: Math.max(1, o.n | 0) }]).map(f => ({ n: f.n, turn: f.turn, land: f.land, riser: res.riser, tread: res.tread }));
    const L = SS.layout(flights), frames = [], runes = [], lines = [];
    let O = camPos.clone().setY(res.floor).addScaledVector(fwd, res.base), D = fwd.clone(), k = 0;
    flights.forEach((f, fi) => {
      frames.push({ O: O.clone(), D: D.clone() });
      for (let i = 0; i < f.n; i++, k++) {
        const nose = O.clone().addScaledVector(D, i * f.tread).addScaledVector(up, (i + 1) * f.riser), foot = O.clone().addScaledVector(D, i * f.tread).addScaledVector(up, i * f.riser);
        const Rg = new THREE.Vector3().crossVectors(D, up).normalize(), Lp = nose.clone().addScaledVector(Rg, -W), Rp = nose.clone().addScaledVector(Rg, W);
        lines.push(Lp, Rp, Lp, foot.clone().addScaledVector(Rg, -W), Rp, foot.clone().addScaledVector(Rg, W));
        [Lp, Rp].forEach(p => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: DIM, transparent: true, depthTest: false, blending: THREE.AdditiveBlending })); sp.position.copy(p); sp.scale.set(.07, .07, 1); stairs.add(sp); runes.push({ s: sp, k }); });
      }
      const E = O.clone().addScaledVector(D, f.n * f.tread).addScaledVector(up, f.n * f.riser), land = L[fi].land;
      frames[fi].E = E;
      if (fi < flights.length - 1) {
        const Rg = new THREE.Vector3().crossVectors(D, up).normalize();
        if (f.turn === 'reverse') {
          const depth = Math.min(land, 1.2), c = [E.clone().addScaledVector(Rg, -W), E.clone().addScaledVector(D, depth).addScaledVector(Rg, -W), E.clone().addScaledVector(D, depth).addScaledVector(Rg, LANE + W), E.clone().addScaledVector(Rg, LANE + W)];
          lines.push(c[0], c[1], c[1], c[2], c[2], c[3]); frames[fi].land = { type: 'U', depth, lane: LANE, Rg };
          O = E.clone().addScaledVector(Rg, LANE); D = D.clone().negate();
        } else {
          const a1 = E.clone().addScaledVector(Rg, -W), b1 = E.clone().addScaledVector(Rg, W), a2 = a1.clone().addScaledVector(D, land), b2 = b1.clone().addScaledVector(D, land);
          lines.push(a1, a2, b1, b2, a2, b2); frames[fi].land = { type: 'straight', depth: land };
          O = E.clone().addScaledVector(D, land);
        }
      }
    });
    stairs.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: NEON, transparent: true, opacity: .95 })));
    const T = o.P > 0 && o.m > 0 ? SS.timeline(flights, o.P, o.m) : null;
    model = { flights, L, frames, runes, T, n: k }; ghost.visible = true; t0 = performance.now(); lastStep = -1; trailPos.length = 0;
  }
  // the ghost's world point from its place on the unfolded profile (HWStairSight.place)
  function worldOf(pl) {
    const F = model.frames, f = model.flights[pl.fi], fr = F[pl.fi], o0 = model.L[pl.fi];
    if (!pl.landing) return fr.O.clone().addScaledVector(fr.D, pl.d - o0.d0).addScaledVector(up, pl.h - o0.h0);
    const e = pl.lu, E = fr.E, ld = fr.land;
    if (ld.type === 'straight') return E.clone().addScaledVector(fr.D, -f.tread / 2 + e * (ld.depth + f.tread / 2));
    const p1 = E.clone().addScaledVector(fr.D, -f.tread / 2), p2 = E.clone().addScaledVector(fr.D, ld.depth / 2), p3 = p2.clone().addScaledVector(ld.Rg, ld.lane), p4 = E.clone().addScaledVector(ld.Rg, ld.lane).addScaledVector(fr.D, f.tread / 2);
    const P4 = [p1, p2, p3, p4], seg = Math.min(2, Math.floor(e * 3)), u = e * 3 - seg; return P4[seg].clone().lerp(P4[seg + 1], u);
  }

  function sample(frame, ref, pose) {
    const cam = pose.transform.position, camPos = new THREE.Vector3(cam.x, cam.y, cam.z);
    const q = pose.transform.orientation, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).setY(0);
    if (fwd.lengthSq() < 1e-4) return; fwd.normalize();
    const add = p => { pts.push({ x: p.x, y: p.y, z: p.z, f: frameN }); };
    let nearest = null;
    sources.forEach(src => { const r = frame.getHitTestResults(src)[0]; if (r) { const p = r.getPose(ref).transform.position; add(p); if (!nearest) nearest = p; } });
    if (nearest) { reticle.visible = !model; reticle.position.set(nearest.x, nearest.y, nearest.z); } else reticle.visible = false;
    if (depth) for (const view of pose.views) {
      let di = null; try { di = frame.getDepthInformation(view); } catch (e) {}
      if (!di) continue;
      const inv = new THREE.Matrix4().fromArray(view.projectionMatrix).invert(), M = new THREE.Matrix4().fromArray(view.transform.matrix);
      for (let i = 0; i < 24; i++) {
        const v = .05 + i * .9 / 23, m = di.getDepthInMeters(.5, v); if (!(m > .2 && m < 6)) continue;
        const near = new THREE.Vector4(0, 1 - v * 2, -1, 1).applyMatrix4(inv); near.divideScalar(near.w);
        const dir = new THREE.Vector3(near.x, near.y, near.z); const p = dir.multiplyScalar(m / -dir.z).applyMatrix4(M); add(p);
      }
      break;
    }
    pts = pts.filter(p => frameN - p.f < 90);                                       // about 1.5 s at 60 frames a second
    if (model || frameN % 8) return;
    const F = fwdLock || fwd, right = new THREE.Vector3().crossVectors(F, up);
    const prof = pts.map(p => { const d = new THREE.Vector3(p.x, p.y, p.z).sub(camPos); return Math.abs(d.dot(right)) < .6 ? { d: d.dot(F), h: p.y } : null; }).filter(Boolean);
    const res = o.analyse(prof);
    if (res.ok && (!prev || Math.abs(res.riser - prev.riser) < .03)) { lockN++; prev = res; fwdLock = fwdLock || fwd.clone(); }
    else { lockN = 0; prev = res.ok ? res : null; if (!res.ok) fwdLock = null; }
    S.why = res.ok ? 'Steps found, checking…' : (prof.length < 8 ? 'Point the phone up the stairs from the bottom and move it slowly.' : 'Looking for steps: ' + res.why + '.');
    if (lockN >= 3) { build(res, camPos, F); Object.assign(S, { phase: 'locked', why: '', riser: res.riser, tread: res.tread, angle: res.angle }); reticle.visible = false; }
    tell();
  }

  renderer.setAnimationLoop((time, frame) => {
    if (!frame) return; frameN++;
    const ref = renderer.xr.getReferenceSpace(), pose = frame.getViewerPose(ref);
    if (pose) sample(frame, ref, pose);
    if (model) {
      // the ghost's pace: each step takes m g r ÷ P (HWStairSight.timeline), each landing 2 step-times; with no power it waits at the foot
      const SS = window.HWStairSight, p = model.T ? SS.at(model.T, (performance.now() - t0) / 1000) : null, pl = SS.place(model.flights, model.L, p);
      const pos = p ? worldOf(pl) : model.frames[0].O.clone().addScaledVector(model.frames[0].D, -model.flights[0].tread / 2);
      ghost.position.copy(pos).addScaledVector(up, .16 + (p && !pl.landing ? Math.sin(Math.min(1, pl.u / .55) * Math.PI) * .05 : 0));
      const k = !p ? -1 : pl.landing ? model.flights.slice(0, pl.fi + 1).reduce((a, f) => a + f.n, 0) - 1 : pl.k;
      if (p) { trailPos.unshift(ghost.position.clone()); if (trailPos.length > trail.length) trailPos.pop(); }
      trail.forEach((t, i) => { const q = trailPos[i]; t.material.opacity = q ? .5 * (1 - i / trail.length) : 0; if (q) t.position.copy(q); });
      model.runes.forEach(r => r.s.material.color.setHex(r.k <= k ? (o.gold ? GOLD : NEON) : DIM));
      const key = !p ? 'w' : pl.landing ? 'L' + pl.fi : k;
      if (key !== lastStep) { lastStep = key; S.step = k + 1; S.landing = !!(p && pl.landing); S.flight = pl.fi + 1; tell(); }
    }
    renderer.render(scene, camera);
  });

  let ended = false;
  const end = () => {
    if (ended) return; ended = true;
    renderer.setAnimationLoop(null); sources.forEach(s => { try { s.cancel(); } catch (e) {} });
    renderer.dispose(); renderer.domElement.remove(); S.phase = 'ended'; tell();
  };
  session.addEventListener('end', end);
  return {
    stop() { if (!ended) session.end().catch(() => end()); },
    rescan() { model = null; stairs.clear(); ghost.visible = false; lockN = 0; prev = null; fwdLock = null; pts = []; Object.assign(S, { phase: 'searching', why: 'Point the phone up the stairs from the bottom and move it slowly.' }); tell(); },
  };
}
window.HWXRStairs = { start };
window.dispatchEvent(new Event('hwxr:ready'));
