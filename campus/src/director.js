// The director: frameAt(t, side) is a pure function of the film clock. Both screens run the same clock, so they stay in sync;
// 'left' starts in the Realistic look and 'right' in Fantasy, and the two exchange looks through a portal at 45 s and back at 90 s.
import * as THREE from 'three';
import { clamp, lerp, smooth, smoothstep, inOut, inOutCubic, outCubic, noise1, mulberry } from './common.js';
import { LOOP, todAt, weatherAt, STAIR_EVENTS } from './timeline.js';
import { climber, stairPoint, CLIMB_SPEED } from './stairs.js';
import { SIGN, GATEP } from './sign.js';

const V = (a) => new THREE.Vector3(...a);
const H = (x, z) => window.groundH(x, z);
const P = (x, z, agl) => [x, H(x, z) + agl, z];            // a point agl metres above the ground
const stairOf = (id) => window.stairPlan.find((s) => s.id === id);
const ease = { linear: (u) => u, inOut, inOutCubic, out: outCubic, in: (u) => u * u };

// a camera move along splines: pos / look are lists of [x, z, agl]; evaluated by u in 0..1 (clamped)
const cache = new Map();
function pathShot(key, def) {
  if (!cache.has(key)) cache.set(key, { pos: new THREE.CatmullRomCurve3(def.pos.map((p) => V(P(...p))), false, 'centripetal'), look: new THREE.CatmullRomCurve3(def.look.map((p) => V(P(...p))), false, 'centripetal') });
  return cache.get(key);
}
function pathCam(key, def, t) {
  const pi = def.padIn ?? 1.4, po = def.padOut ?? 1.4, c = pathShot(key, def), u = clamp((t - def.t0 + pi) / (def.t1 - def.t0 + pi + po)), w = (ease[def.ease || 'inOut'])(u), p = c.pos.getPoint(w), l = c.look.getPoint(w);
  const fov = lerp(def.fov[0], def.fov[1], smooth(u)), tt = t * (def.shakeF || 1.3);
  const sh = def.shake || 0;
  const roll = (def.roll || 0) * noise1(t * 0.6 + 3) + (def.bank ? def.bank * (c.pos.getTangent(w).x * 0.0 + noise1(t * 0.35)) : 0);
  p.x += noise1(tt) * sh; p.y += noise1(tt + 11) * sh * 0.7; p.z += noise1(tt + 23) * sh;
  const q = p.toArray(), floor = Math.max(window.clearance(q[0], q[2]) + 3.5, H(q[0], q[2]) + 2.2); if (q[1] < floor) q[1] = floor;
  return { p: q, t: l.toArray(), fov, roll: roll * Math.PI / 180 + noise1(tt + 31) * sh * 0.004 };
}

// ---------------------------------------------------------------- the shots (t0..t1 seconds, x east, z south, agl metres)
const SHOTS = {
  // 1 - dawn: a high, slow, calm reveal of the whole campus
  dawn: { t0: 0, t1: 11, padIn: 0, pos: [[-310, 270, 128], [-290, 220, 112], [-240, 140, 94], [-190, 70, 78]], look: [[-20, -20, 10], [-20, -20, 8], [-10, -30, 6], [10, -40, 6]], fov: [52, 46], ease: 'inOut', shake: 0.05, roll: 0.6 },
  // 2 - skim the arterial road east to west, low and fast
  skim: { t0: 11, t1: 24, pos: [[215, -62, 34], [140, -69, 27], [60, -72, 22], [-30, -75, 21], [-95, -64, 27], [-130, -30, 30]], look: [[150, -70, 18], [70, -71, 16], [-10, -72, 15], [-90, -66, 17], [-150, -35, 20], [-165, 10, 20]], fov: [64, 70], ease: 'linear', shake: 0.18, bank: 6 },
  // 4 - orbit the academic block, high and wide
  orbit: { t0: 38, t1: 50, pos: [[-215, -190, 120], [-110, -230, 112], [40, -215, 108], [160, -140, 98], [210, -20, 92]], look: [[-20, -42, 14], [-20, -42, 14], [-20, -42, 14], [-20, -42, 14], [-20, -42, 14]], fov: [48, 52], ease: 'inOut', shake: 0.08, roll: 0.8 },
  // 5 - the storm run: low and fast over the padang, then through the campus
  storm: { t0: 50, t1: 62, pos: [[-205, 80, 30], [-140, 60, 22], [-60, 66, 21], [10, 80, 25], [52, 135, 24], [72, 195, 30]], look: [[-120, 70, 16], [-45, 68, 15], [30, 75, 18], [60, 120, 18], [74, 190, 20], [80, 250, 25]], fov: [68, 72], ease: 'linear', shake: 0.34, shakeF: 2.1, bank: 9 },
  // 6 - dusk ring: a low, slow arc round the central blocks, descending towards where the glide begins
  dusk: { t0: 62, t1: 76, pos: [[120, -130, 55], [60, -150, 44], [-20, -160, 36], [-100, -135, 33], [-155, -75, 34]], look: [[-20, -45, 10], [-20, -45, 10], [-20, -45, 10], [-20, -45, 10], [-20, -45, 10]], fov: [54, 48], ease: 'inOut', shake: 0.1, roll: 0.8 },
  // 7 - the fog glide at sunset: slow, low, quiet
  glide: { t0: 76, t1: 87, pos: [[-215, 40, 24], [-150, 38, 19], [-80, 32, 17], [-10, 30, 16], [60, 12, 17]], look: [[-100, 40, 12], [-40, 30, 12], [20, 20, 12], [80, 10, 12], [140, 0, 14]], fov: [50, 46], ease: 'inOut', shake: 0.05, roll: 0.5 },
  // 8 - the night ascent: from the hostel courtyard up to the first frame, closing the loop
  rise: { t0: 87, t1: 96, padOut: 0, pos: [[150, -78, 16], [100, -30, 44], [-30, 90, 92], [-230, 215, 124], [-310, 270, 128]], look: [[90, -75, 12], [30, -45, 14], [-20, -20, 10], [-20, -20, 10], [-20, -20, 10]], fov: [58, 52], ease: 'inOut', shake: 0.06, roll: 0.5 },
};

// ---------------------------------------------------------------- stair shots
const lerp3 = (a, b, u) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
const toV = (a) => new THREE.Vector3(...a);

/** Descend onto a stair, catch the tap on its heart, follow the climber, swing round for the swap, then lift away. */
function stairShot(S, t, win, liftTo) {
  const e = STAIR_EVENTS[S.id], cl = climber(S, t), hp = [S.heart[0], H(S.heart[0], S.heart[1]) + 3.1, S.heart[1]];
  const poseApproach = (tt) => { // from high behind to a low three-quarter view of the heart
    const u = smooth((tt - win[0]) / (e.tap - 0.6 - win[0]));
    const a = stairPoint(S, -22, 8, 24), b = stairPoint(S, -8.5, 3.4, 3.6), g = lerp3(a, b, u);
    return { p: g, l: lerp3([S.base[0] - S.dir[0] * 6, S.h0 + 4, S.base[1] - S.dir[1] * 6], hp, smooth(u * 1.4)) };
  };
  const poseTap = (tt) => { const u = smooth((tt - (e.tap - 0.6)) / 2.2); return { p: lerp3(stairPoint(S, -8.5, 3.4, 3.6), stairPoint(S, -6.2, 2.4, 2.6), u), l: lerp3(hp, [hp[0] + S.dir[0] * 1.5, hp[1] + 1.2, hp[2] + S.dir[1] * 1.5], u) }; };
  const av = (tt) => climber(S, tt);
  const poseChase = (tt) => { // behind and above the climber, looking up the flight
    const c = av(tt), z = c.z, back = 5.2, lat = 0.6 * Math.sin(tt * 0.35);
    const [cz, cl] = outer(z - back, lat);
    return { p: stairPoint(S, cz, cl, S.inside ? 4.2 : 2.5), l: stairPoint(S, z + 1.8, 0, 1.2) };
  };
  const outer = (z, lat = 0) => (S.inside ? [Math.min(z, -4.2), lat + (lat >= 0 ? 1.3 : -1.3)] : [z, lat]); // an inside stair is seen through its opening: the camera never goes behind the facade
  const swapT = e.swap, sw0 = Math.max(swapT - 1.6, e.tap + 2.2 + 0.8), sw1 = swapT + 2.4;
  const orbitAt = (c, ang, R, upH) => { // camera on a circle round the climber, in stair-space so it always clears the steps and the wall
    const dz = -Math.cos(ang) * R, lat = Math.sin(ang) * R * (S.inside ? 0.45 : 1), zc = Math.min(c.z + dz, S.run + 0.9), [oz, ol] = outer(zc, lat);
    return stairPoint(S, oz, ol, upH + (S.inside ? 2.0 : 0));
  };
  const poseFace = (tt) => { // behind -> beside -> in front of the climber across the swap
    const c = av(tt), u = smooth((tt - sw0) / (sw1 - sw0)), ang = u * Math.PI * 0.62, R = lerp(5.2, 4.4, Math.sin(u * Math.PI));
    return { p: orbitAt(c, ang, R, 1.9 + 0.5 * Math.sin(u * Math.PI)), l: stairPoint(S, c.z, 0, 1.0) };
  };
  const lenP = 3 + Math.hypot(S.run, S.rise) + 1.6, tEnd = e.tap + 1.3 + lenP / CLIMB_SPEED;
  const poseLift = (tt) => { // swing out to the open side of the stair and rise, keeping the climber framed
    const u = smooth((tt - (tEnd - 0.8)) / 4.6), ang = liftTo ? 0.5 * Math.PI * smooth(clamp((u - 0.3) / 0.7)) : lerp(0.0, 0.5 * Math.PI, u), R = lerp(5.2, 16, u), up = liftTo ? lerp(2.5, 18, smooth(clamp(u * 3.2))) : lerp(2.5, 16, smooth((u - 0.3) / 0.7));
    const c = av(Math.min(tt, tEnd)), centre = stairPoint(S, c.z, 0, 0.95), look = liftTo ? lerp3(centre, liftTo.l, smooth(u * 1.5 - 0.5)) : centre;
    return { p: orbitAt(c, ang, R, up), l: look };
  };
  const poseChaseEnd = () => { const tt = e.tap + 1.3 + (3 + Math.hypot(S.run, S.rise) + 1.6) / CLIMB_SPEED - 0.6, c = poseFace(Math.min(tt, sw1)); return c; };
  // sequence with smooth hand-overs
  // phases are blended by weights that never overlap, so the camera is continuous everywhere:
  //   approach -> tap view -> chase (blend) ; chase <-> face (round the swap) ; everything -> lift-off (blend)
  const mix = (a, b, u) => ({ p: lerp3(a.p, b.p, u), l: lerp3(a.l, b.l, u) });
  const tChase0 = e.tap + 2.2, tLift = tEnd - 0.8;
  const tapPose = t < e.tap - 0.6 ? poseApproach(t) : poseTap(Math.min(t, e.tap + 1.6));
  const chaseOrTap = t < tChase0 - 0.6 ? tapPose : t < tChase0 + 0.8 ? mix(poseTap(e.tap + 1.6), poseChase(t), smooth((t - (tChase0 - 0.6)) / 1.4)) : poseChase(t);
  const wFace = smooth((t - sw0) / 1.2) * (1 - smooth((t - sw1) / 1.5));
  let pose = wFace > 0 ? mix(chaseOrTap, poseFace(Math.min(Math.max(t, sw0), sw1)), wFace) : chaseOrTap;
  const wLift = smooth((t - tLift) / 1.4);
  if (wLift > 0) pose = mix(pose, poseLift(t), wLift);
  return { p: pose.p, t: pose.l, fov: lerp(58, 62, smooth((t - tLift) / 3)), roll: noise1(t * 0.5) * 0.004 };
}
function poseApproachTap() { return null; }

// ---------------------------------------------------------------- transitions (centre time, half width)
const T = {
  flash2: [24, 0.85], sweep3: [38, 0.9], portal1: [46, 1.3], flash5: [50, 0.8], whip6: [62, 0.7], veil7: [76, 1.3], sweep8: [87, 1.0], portal2: [92, 1.3],
};
const shotAt = (t) => (t < 11 ? 'dawn' : t < 24 ? 'skim' : t < 38 ? 'st26' : t < 50 ? 'orbit' : t < 62 ? 'storm' : t < 76 ? 'dusk' : t < 87 ? 'glide' : 'rise');
function camOf(shot, t) {
  switch (shot) {
    case 'st26': return stairShot(stairOf('ST26'), t, [24, 38]);
    default: return pathCam(shot, SHOTS[shot], t);
  }
}
const shadowOf = (shot) => (shot === 'st26' ? { cx: stairOf('ST26').base[0], cz: stairOf('ST26').base[1], r: 62 } : shot === 'dawn' || shot === 'rise' || shot === 'orbit' ? { cx: 0, cz: 0, r: 430 } : { cx: 0, cz: 20, r: 330 });

const SHOT_ORDER = ['dawn', 'skim', 'st26', 'orbit', 'storm', 'dusk', 'glide', 'rise'];
const BOUNDS = [11, 24, 36, 49, 61, 72, 85, 96];
const trProfile = (key) => {
  switch (key) {
    case 'whip1': return { mode: 4, glow: [1, 0.9, 0.7], dir: [1, 0.12], amt: 0.04 };
    case 'flash2': return { mode: 3, glow: [1, 0.85, 0.55] };
    case 'sweep3': return { mode: 2, glow: [1, 0.7, 0.45], dir: [1, 0.25] };
    case 'flash5': return { mode: 3, glow: [0.65, 0.75, 1] };
    case 'whip6': return { mode: 4, glow: [0.8, 0.85, 1], dir: [-1, 0.18], amt: 0.045 };
    case 'veil7': return { mode: 5, glow: [0.7, 0.8, 1] };
    case 'sweep8': return { mode: 2, glow: [1, 0.6, 0.9], dir: [1, -0.2] };
    default: return { mode: 1, glow: [0.6, 0.9, 1] };
  }
};

const BASE = { left: 'realistic', right: 'fantasy' }, OTHER = { realistic: 'fantasy', fantasy: 'realistic' };
function lookOf(side, t) { const sw = t >= T.portal1[0] + T.portal1[1] && t < T.portal2[0] - T.portal2[1]; const swapped = t >= T.portal1[0] && t < T.portal2[0]; return swapped ? OTHER[BASE[side]] : BASE[side]; }

const GATE = [11, 23]; // the inserted Kolej Mara Kulim sign scene (film seconds); shots after it keep their original timing, shifted by 12 s
function gateCam(t) {
  const sx = SIGN.x, sz = SIGN.z, u = clamp((t - GATE[0]) / (GATE[1] - GATE[0])), e = inOutCubic;
  const R = (dx, dz, a) => [sx + dx, sz + dz, a], gx = GATEP.x, gz = GATEP.z;
  // fly in along the entrance road, through the arch, round the lawn and into the front of the KM KULIM sign, then rise over it
  const pos = new THREE.CatmullRomCurve3([[gx - 52, gz - 3, 8], [gx - 27, gz - 2, 5], [gx - 10, gz, 3.4], [gx + 6, gz + 1, 3.4], [gx + 28, gz + 17, 6.5], [gx + 52, gz + 36, 8], R(-17, 7, 5), R(-12, 1, 4.6), R(-9, -4, 8), R(2, -10, 22), R(40, -8, 40)].map(([x, z, a]) => V(P(x, z, a))), false, 'centripetal');
  const look = new THREE.CatmullRomCurve3([[gx, gz, 7.2], [gx, gz, 7.2], [gx, gz, 7.2], [gx + 10, gz + 4, 5.5], [gx + 40, gz + 22, 5], R(0, 4, 4.4), R(0, 0, 4.2), R(0, 0, 4.2), R(0, 0, 4.6), R(40, 0, 10), R(90, 0, 12)].map(([x, z, a]) => V(P(x, z, a))), false, 'centripetal');
  const w = e(u), p = pos.getPoint(w), l = look.getPoint(w), sh = 0.06;
  p.x += noise1(t * 1.2) * sh; p.y += noise1(t * 1.2 + 9) * sh;
  const q = p.toArray(); q[1] = Math.max(q[1], H(q[0], q[2]) + 2.4);
  return { p: q, t: l.toArray(), fov: lerp(50, 56, smooth(u)), roll: noise1(t * 0.5) * 0.004 };
}

/** the film frame at film time t (wraps past LOOP so the overlap frames continue the opening) */
export function frameAt(tIn, side) {
  const t0 = tIn >= LOOP ? tIn - LOOP : tIn;                 // the choreography wraps past LOOP (overlap frames keep the world moving)
  const inGate = t0 >= GATE[0] && t0 < GATE[1];
  const tw = inGate ? 9 + (t0 - GATE[0]) / (GATE[1] - GATE[0]) * 2 : t0 >= GATE[1] ? t0 - 12 : t0; // film clock the world uses
  const W = weatherAt(tw), tod = todAt(tw);
  const shot = inGate ? 'gate' : shotAt(tw), cam = inGate ? gateCam(t0) : camOf(shot, tw), look = lookOf(side, tw);
  const gateShadow = { cx: -150, cz: -85, r: 90 };
  let frame = { look, tod: tod % 24, W, cam, shadow: inGate ? gateShadow : shadowOf(shot), post: grade(look, tw, W), size: 1080 };
  const blend = (c, hw, mode, camA, shA, camB, shB, key) => { // both screens blend together; both cameras keep flying
    const a = c - hw, b = c + hw; if (t0 < a || t0 > b) return false; const mix = smoothstep(a, b, t0); if (mix >= 0.999) return false;
    const prof = trProfile(key); frame.cam = camA; frame.shadow = shA; frame.shadowB = shB; frame.other = look; frame.trans = { mode: prof.mode, mix, glow: prof.glow, dir: prof.dir, amt: prof.amt, camB }; return true;
  };
  // dawn -> sign scene, sign scene -> the road skim
  if (blend(GATE[0], 0.7, 4, camOf('dawn', t0), shadowOf('dawn'), gateCam(t0), gateShadow, 'whip1')) return frame;
  if (blend(GATE[1], 0.85, 3, gateCam(t0), gateShadow, camOf('skim', 11 + (t0 - GATE[1])), shadowOf('skim'), 'flash2')) return frame;
  if (inGate) return frame;
  for (const [key, [c, hw]] of Object.entries(T)) {
    const isPortal = key.startsWith('portal'), ci = c + 12, a = ci - hw, b = ci + hw;
    if (t0 < a || t0 > b) continue;
    const mix = smoothstep(a, b, t0), prof = trProfile(key);
    if (mix >= 0.999) break;
    if (isPortal) {
      const from = key === 'portal1' ? BASE[side] : OTHER[BASE[side]], to = key === 'portal1' ? OTHER[BASE[side]] : BASE[side];
      frame.look = from; frame.other = to; frame.trans = { mode: 1, mix, glow: prof.glow, c: side === 'left' ? [1.0, 0.5] : [0.0, 0.5] };
    } else {
      const curShot = shotAt(Math.max(0, c - hw - 0.01)), nextShot = shotAt(Math.min(LOOP, c + hw + 0.01));
      frame.cam = camOf(curShot, tw); frame.shadow = shadowOf(curShot); frame.shadowB = shadowOf(nextShot);
      frame.other = look; frame.trans = { mode: prof.mode, mix, glow: prof.glow, dir: prof.dir, amt: prof.amt, camB: camOf(nextShot, tw) };
    }
    break;
  }
  return frame;
}

function grade(look, t, W) {
  const fan = look === 'fantasy', storm = W.storm, dusk = smoothstep(70, 78, t) * (1 - smoothstep(86, 92, t));
  const base = fan ? { sat: 1.18, contrast: 1.07, vig: 0.34, grain: 0.03, lift: [0.01, 0.0, 0.025], gain: [1.0, 0.97, 1.06], gamma: [1, 1, 1] }
    : { sat: 1.1, contrast: 1.06, vig: 0.3, grain: 0.028, lift: [0.0, 0.0, 0.006], gain: [1.03, 1.0, 0.95], gamma: [1, 1, 1] };
  base.sat -= storm * 0.18; base.contrast += storm * 0.04; base.vig += storm * 0.06;
  return { ...base, bloom: 1 + (fan ? 0.2 : 0), shafts: 0.22, exposure: 1 };
}
