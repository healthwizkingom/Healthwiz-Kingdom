// The stair stops. For the video only: ST26 (director's house up to Blok E), ST09 (to Jab. Sains) and ST05 (behind Jab. Matematik)
// are modelled from the survey photos, each with the app's pokestop heart. A tap makes the heart open into the stair's photo disc,
// lights the steps one after another, and a student climbs; midway the student swaps between a boy and a girl in a scan-line dissolve.
import { ROOT } from './common.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toLocal, smooth, smoothstep, clamp, outBack, outCubic, inOut, lerp } from './common.js';
import { STAIR_EVENTS } from './timeline.js';

// positions are the app's own (js/hw-02-core.js stair list); rise / steps are modelled for the video
export const STAIRS = [
  { id: 'ST26', lat: 5.3520232, lng: 100.5388347, rise: 5.0, N: 28, W: 2.6, style: 'cover', cat: 3, photo: 'ST26.webp', target: 'Asrama Perempuan E' }, // up to Blok E
];
const TREAD = 0.3, CATCOL = { 1: 0x7ee07c, 2: 0xf6c94f, 3: 0xff7b6e };

function ringLocal(ring) { return ring.map(([lng, lat]) => { const p = toLocal(lng, lat); return [p.x, p.z]; }); }
function inside(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function nearestEdge(x, z, P) { let best = { d: 1e9 }; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? clamp(((x - ax) * dx + (z - az) * dz) / L) : 0, px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz); if (d < best.d) best = { d, x: px, z: pz }; } return best; }

/** Where each stair stands: outside the nearest building, facing its wall, its top at that building's floor level. */
export function planStairs(osm, baseH) {
  const blds = osm.features.filter((f) => f.geometry.type === 'Polygon' && f.properties.kind === 'building').map((f) => {
    const P = ringLocal(f.geometry.coordinates[0]); let cx = 0, cz = 0; P.forEach(([x, z]) => { cx += x; cz += z; }); cx /= P.length; cz /= P.length; return { P, cx, cz, base: baseH(cx, cz) };
  });
  return STAIRS.map((S) => {
    const o = toLocal(S.lng, S.lat); let best = null;
    const named = S.target && osm.features.find((f) => f.properties.name === S.target && f.geometry.type === 'Polygon');
    const pool = named ? blds.filter((b) => b.P === ringLocal(named.geometry.coordinates[0]) || true) : blds;
    let namedB = null;
    if (named) { const P = ringLocal(named.geometry.coordinates[0]); namedB = blds.find((b) => b.P.length === P.length && Math.abs(b.P[0][0] - P[0][0]) < 0.01 && Math.abs(b.P[0][1] - P[0][1]) < 0.01); }
    for (const b of (namedB ? [namedB] : pool)) { const e = nearestEdge(o.x, o.z, b.P), ins = inside(o.x, o.z, b.P); if (!best || e.d < best.e.d) best = { b, e, ins }; }
    let { b, e, ins } = best; let dx, dz;
    if (S.manual) { e = { x: S.manual.wall[0], z: S.manual.wall[1] }; dx = S.manual.dir[0]; dz = S.manual.dir[1]; b = blds.reduce((q, c) => (nearestEdge(e.x, e.z, c.P).d < nearestEdge(e.x, e.z, q.P).d ? c : q)); }
    else if (ins) { dx = -(e.x - b.cx); dz = -(e.z - b.cz); } else { dx = e.x - o.x; dz = e.z - o.z; }
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    // the foot stands on the real ground; the flight climbs to the building's floor, or to a landing terrace at least 2.4 m up
    let N = S.N, rise = S.rise, base, top, run, h0, h1;
    for (let pass = 0; pass < 3; pass++) {
      run = N * TREAD; top = S.inside ? [e.x + dx * run, e.z + dz * run] : [e.x - dx * 1.7, e.z - dz * 1.7]; base = [top[0] - dx * run, top[1] - dz * run];
      h0 = baseH(base[0], base[1]); h1 = Math.max(b.base, h0 + S.rise); rise = Math.min(h1 - h0, 6.5); h1 = h0 + rise; N = Math.max(12, Math.round(rise / 0.18));
    }
    run = N * TREAD; top = S.inside ? [e.x + dx * run, e.z + dz * run] : [e.x - dx * 1.7, e.z - dz * 1.7]; base = [top[0] - dx * run, top[1] - dz * run];
    return { ...S, N, rise, dir: [dx, dz], base, top, h0, h1, run, yaw: Math.atan2(dx, dz), heart: [base[0] - dx * 2.6, base[1] - dz * 2.6], wall: [e.x, e.z] };
  });
}

/** ground ramps so the terrain meets each stair exactly (H blends toward these) */
export const rampsOf = (plan) => plan.map((p) => ({ a: [p.base[0], p.base[1]], b: [p.top[0], p.top[1]], h0: p.h0 - 0.3, h1: (p.inside ? p.h0 : p.h1) - 0.3, halfW: p.W / 2 + 1.0, margin: 7 })); // the ground under a flight always sits below its treads, so it can never poke through them

/** the climber's progress at time t: k = metres walked from 3 m before the foot; z = distance along the run (negative before the foot) */
export const CLIMB_SPEED = 2.1;
export function climber(S, t) {
  const e = STAIR_EVENTS[S.id], hyp = Math.hypot(S.run, S.rise), len = 3 + hyp + 1.6, k = (t - (e.tap + 1.3)) * CLIMB_SPEED;
  if (k < 0) return { k, len, active: false, z: -3, y: S.h0 };
  const p = Math.min(k, len); let z, y;
  if (p < 3) { z = p - 3; y = S.h0; } else if (p < 3 + hyp) { const u = (p - 3) / hyp; z = u * S.run; y = S.h0 + S.rise * u; } else { z = S.run + (p - 3 - hyp); y = S.h1; }
  return { k, len, active: k <= len + 0.9, z, y };
}
/** stair-space -> world: z along the run from the foot, lat to the side, up above the stair surface */
export function stairPoint(S, z, lat, up) { const u = clamp(z / S.run), surf = z < 0 ? S.h0 : z > S.run ? S.h1 : S.h0 + S.rise * u; return [S.base[0] + S.dir[0] * z + S.dir[1] * lat, surf + up, S.base[1] + S.dir[1] * z - S.dir[0] * lat]; }

// ---------------------------------------------------------------- stair geometry (instanced boxes + a few slabs)
const BOX = new THREE.BoxGeometry(1, 1, 1), BUSH = new THREE.IcosahedronGeometry(0.62, 1);
class Parts {
  constructor(S, look) { this.S = S; this.fan = look === 'fantasy'; this.items = new Map(); this.f = new THREE.Vector3(S.dir[0], 0, S.dir[1]); this.l = new THREE.Vector3(S.dir[1], 0, -S.dir[0]); }
  hAt(z) { const u = clamp(z / this.S.run); return this.S.h0 + this.S.rise * u; } // stair surface height at distance z along the run
  world(x, y, z) { return new THREE.Vector3(this.S.base[0] + this.f.x * z + this.l.x * x, y, this.S.base[1] + this.f.z * z + this.l.z * x); }
  box(key, x, y, z, sx, sy, sz, color, pitch = 0, gl = 0) {
    if (!this.items.has(key)) this.items.set(key, []);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.S.yaw);
    if (pitch) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch));
    this.items.get(key).push({ m: new THREE.Matrix4().compose(this.world(x, y, z), q, new THREE.Vector3(sx, sy, sz)), c: new THREE.Color(color), gl });
  }
  bar(key, a, b, t, color) { // a, b = [x, y, z] in stair space
    const A = this.world(...a), B = this.world(...b), d = B.clone().sub(A), len = d.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    if (!this.items.has(key)) this.items.set(key, []);
    this.items.get(key).push({ m: new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(t, t, len)), c: new THREE.Color(color), gl: 0 });
  }
  finish(group, matFor) {
    const out = {};
    for (const [key, list] of this.items) {
      const im = new THREE.InstancedMesh(key === 'bush' ? BUSH : BOX, matFor(key), list.length); list.forEach((it, i) => { im.setMatrixAt(i, it.m); im.setColorAt(i, it.c); });
      im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.castShadow = im.receiveShadow = true; im.frustumCulled = false; group.add(im); out[key] = im;
    }
    return out;
  }
}

function buildStair(world, S) {
  const fan = world.fan, P = new Parts(S, world.look), g = new THREE.Group(), N = S.N, r = S.rise / N, W = S.W, pitch = Math.atan2(S.rise, S.run);
  const col = {
    cover: fan ? { a: 0x4a6ac0, b: 0x8aa8f0, wall: 0x354a7a, post: 0x58e0ff, rail: 0x8affd8, roof: 0x6a7ad0 } : { a: 0x3b78c0, b: 0xe6e6e2, wall: 0x8e9088, post: 0xa4442e, rail: 0xa4442e, roof: 0x9aa0a4 },
    dept: fan ? { a: 0x3a3a90, b: 0x9a88e8, wall: 0x3a3a80, post: 0x7a6aff, rail: 0xb8a8ff, roof: 0x4a4a90 } : { a: 0x1c1c1e, b: 0xd9c9aa, wall: 0xe4e0d8, post: 0x9a2c2c, rail: 0xd0d4d8, roof: 0x888888 },
    pink: fan ? { a: 0xc058a0, b: 0xff88d0, wall: 0x683a7a, post: 0xff7ac8, rail: 0xffc0e8, roof: 0x8a5ab0 } : { a: 0xe88486, b: 0xd9736f, wall: 0xb4503c, post: 0x4a4a52, rail: 0x6a6a72, roof: 0x8a8a92 },
  }[S.style];
  // steps (boxes reaching 2 m underground so no gap shows on a slope)
  for (let i = 0; i < N; i++) {
    const top = S.h0 + (i + 1) * r, bot = S.h0 - 2.2, z = i * TREAD + TREAD / 2;
    const wear = 0.86 + 0.14 * ((i * 7919) % 13) / 13; // a little weathering, step to step
    const tread = new THREE.Color(S.style === 'cover' ? col.b : S.style === 'dept' ? col.b : col.a).multiplyScalar(wear * (fan ? 1.0 : 0.88)).getHex();
    const riserC = S.style === 'cover' ? col.a : S.style === 'dept' ? col.a : new THREE.Color(col.a).multiplyScalar(0.8).getHex();
    P.box('step', 0, (top + bot) / 2, z, W, top - bot, TREAD * 1.02, tread);
    // the riser face stands just proud of the block (it used to sit inside it and vanish), darker than the tread, with a light nosing on the edge
    P.box('step', 0, top - r / 2, i * TREAD - 0.012, W * 0.995, r * 0.97, 0.02, new THREE.Color(riserC).multiplyScalar(fan ? 1.0 : 0.75).getHex());
    P.box('step', 0, top + 0.012, i * TREAD + 0.03, W * 0.995, 0.035, 0.07, fan ? 0xb8c8ff : new THREE.Color(tread).multiplyScalar(1.25).getHex());
    if (S.style === 'dept') { P.box('step', -W / 2 + 0.28, top - 0.03, z, 0.56, 0.08, TREAD * 1.03, col.a); P.box('step', W / 2 - 0.28, top - 0.03, z, 0.56, 0.08, TREAD * 1.03, col.a); }
    P.box('glow', 0, top + 0.012, z, W * 0.94, 0.02, TREAD * 0.9, 0xffffff, 0, 1);
  }
  const landTop = S.h1, runEnd = S.run;
  P.box('step', 0, landTop - 1.1, runEnd + 0.85, W + 1.2, 2.2, 1.7, fan ? 0x4a5a98 : 0xa9a8a0); // landing
  P.box('step', 0, S.h0 - 1.1, -1.5, W + 1.0, 2.2 + 0.2, 3.0, fan ? 0x4a5a98 : 0xa9a8a0); // apron at the foot
  // side walls / rails / posts per style
  const wallLen = Math.hypot(S.run, S.rise);
  const wallAt = (side, h, thick, color, off = 0, i0 = -2) => { // a stepped side wall: one upright block per step, each rooted underground, capped with coping
    const x = side * (W / 2 + off + thick / 2 + 0.02), cap = fan ? 0x8a9aff : new THREE.Color(color).multiplyScalar(1.22).getHex();
    for (let i = i0; i < N + 4; i++) {
      const z = i * TREAD + TREAD / 2, stepTop = i < 0 ? S.h0 : i >= N ? S.h1 : S.h0 + (i + 1) * r, top = stepTop + h, bot = S.h0 - 2.2;
      if (i >= N && z > S.run + 1.6) break;
      P.box('wall', x, (top + bot) / 2, z, thick, top - bot, TREAD * 1.01, new THREE.Color(color).multiplyScalar(0.94 + 0.06 * ((i * 31) % 5) / 5).getHex());
      P.box('wall', x, top + 0.04, z, thick + 0.08, 0.08, TREAD * 1.02, cap);
    }
  };
  // a sloped ceiling over the whole flight, a flat one over the landing, a back wall, and the opening carved out of the building's front
  const enclose = (hw, ceilC, backC) => {
    const zc = S.run / 2, sl = S.run / Math.cos(pitch), cw = 2 * hw + 0.1;
    P.box('wall', 0, P.hAt(zc) + S.ceil, zc, cw, 0.2, sl, ceilC, pitch);
    P.box('wall', 0, landTop + S.ceil, S.run + 0.9, cw, 0.2, 1.9, ceilC);
    P.box('lamp', 0, landTop + S.ceil / 2, S.run + 1.77, cw, S.ceil, 0.1, backC); // the lit hall beyond
    for (const x of [-1.2, 0, 1.2]) P.box('lamp', x, landTop + S.ceil - 0.12, S.run + 1.6, 0.7, 0.05, 0.14, fan ? 0xffc0f0 : 0xfff2d0);
    for (let z = 1.4; z < S.run; z += 2.2) P.box('lamp', 0, P.hAt(z) + S.ceil - 0.12, z, 0.9, 0.05, 0.14, fan ? 0xffc0f0 : 0xfff2d0);
    g.userData.carve = { hw: hw + 0.01, z0: -0.02, z1: S.run + 1.8 };
  };
  const slabWall = (side, h, thick, color) => { // one smooth wall parallel to the flight, rooted underground, with coping, plus level pieces at the foot and the landing
    const x = side * (W / 2 + thick / 2 + 0.02), L = Math.hypot(S.run, S.rise), c = (h - 2.4) / 2, zc = S.run / 2, cp = Math.cos(pitch), sp = Math.sin(pitch), cap = new THREE.Color(color).multiplyScalar(1.22).getHex();
    P.box('wall', x, P.hAt(zc) + c * cp, zc - c * sp, thick, h + 2.4, L, color, pitch);
    P.box('wall', x, P.hAt(zc) + h * cp + 0.04, zc - h * sp, thick + 0.08, 0.08, L + 0.02, cap, pitch);
    P.box('wall', x, S.h0 + (h - 2.4) / 2, -0.9, thick, h + 2.4, 1.8, color); P.box('wall', x, S.h0 + h + 0.04, -0.9, thick + 0.08, 0.08, 1.8, cap);
    P.box('wall', x, landTop + (h - 2.4) / 2, S.run + 0.85, thick, h + 2.4, 1.7, color); P.box('wall', x, landTop + h + 0.04, S.run + 0.85, thick + 0.08, 0.08, 1.7, cap);
  };
  if (S.style === 'cover') {
    slabWall(-1, 0.95, 0.4, col.wall); slabWall(1, 0.95, 0.4, col.wall);
    for (let z = 0.6; z <= S.run + 0.1; z += 2.6) for (const side of [-1, 1]) P.box('post', side * (W / 2 + 0.7), this_h(P, z) + 1.75, z, 0.14, 3.5, 0.14, col.post, 0, fan ? 2 : 0);
    for (const side of [-1, 1]) { P.bar('rail', [side * (W / 2 + 0.7), P.hAt(0) + 1.0, 0], [side * (W / 2 + 0.7), P.hAt(S.run) + 1.0, S.run], 0.07, col.rail); P.bar('rail', [side * (W / 2 + 0.7), P.hAt(0) + 0.55, 0], [side * (W / 2 + 0.7), P.hAt(S.run) + 0.55, S.run], 0.05, col.rail); P.bar('rail', [side * (W / 2 + 0.7), P.hAt(0) + 3.5, 0], [side * (W / 2 + 0.7), P.hAt(S.run) + 3.5, S.run], 0.1, col.post); }
    // steel arch ribs over each pair of posts, carrying the roof
    for (let z = 0.6; z <= S.run + 0.1; z += 2.6) { const y0 = P.hAt(z) + 3.5, apex = y0 + (W / 2 + 1.0) * 0.42; for (const side of [-1, 1]) { P.bar('post', [side * (W / 2 + 0.7), y0, z], [side * (W / 2) * 0.55, apex - 0.1, z], 0.09, col.post); P.bar('post', [side * (W / 2) * 0.55, apex - 0.1, z], [0, apex, z], 0.09, col.post); } }
    // the arched corrugated roof
    const Rr = W / 2 + 1.0, geo = new THREE.CylinderGeometry(Rr, Rr, wallLen + 1.4, 18, 1, true, Math.PI / 2, Math.PI); geo.rotateX(Math.PI / 2); geo.scale(1, 0.42, 1);
    const roof = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: col.roof, side: THREE.DoubleSide, emissive: fan ? col.roof : 0x000000, emissiveIntensity: fan ? 0.6 : 0 }));
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), S.yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch));
    roof.quaternion.copy(q); roof.position.copy(P.world(0, S.h0 + S.rise / 2 + 3.5, S.run / 2)); roof.castShadow = true; g.add(roof);
    // hedges and variegated plants along both sides
    for (let z = 0; z <= S.run; z += 1.3) for (const side of [-1, 1]) { const s = 0.7 + ((z * 7.3 + side * 3) % 1) * 0.5; P.box('bush', side * (W / 2 + 1.9 + ((z * 3.7) % 0.6)), P.hAt(z) + 0.4, z, s * 1.5, s * 1.1, s * 1.5, fan ? [0x40e8c0, 0x9a7aff, 0xff70c0][(z | 0) % 3] : (((z | 0) % 4 === 0) ? 0xb6c64a : 0x2c6a2a), 0, fan ? 1 : 0); }
  } else if (S.style === 'dept') {
    // an enclosed stairwell inside the block: red painted wall left, white brick right with a steel rail, a sloping ceiling, a lit landing hall beyond
    wallAt(-1, S.ceil, 0.3, fan ? 0x7a3a9a : 0x9c2a2a, 0, 0); wallAt(1, S.ceil, 0.3, fan ? 0x4a5ab0 : col.wall, 0, 0);
    P.bar('rail', [W / 2 - 0.05, P.hAt(0) + 0.95, 0], [W / 2 - 0.05, P.hAt(S.run) + 0.95, S.run], 0.06, col.rail);
    for (let z = 0.4; z < S.run; z += 1.4) P.bar('rail', [W / 2 - 0.05, P.hAt(z) + 0.95, z], [W / 2 + 0.2, P.hAt(z) + 0.95, z], 0.05, col.rail);
    P.box('wall', 0, landTop + 0.5, S.run + 1.45, W, 1.0, 0.06, 0x606468); // mesh railing at the landing
    enclose(0.34, fan ? 0x5a4aa0 : 0xcfc9bd, fan ? 0x9a8af0 : 0xd8c9a4);
  } else {
    // broad pink steps between low brick cheek walls, crotons on the left, opening onto the covered hall
    wallAt(-1, 1.0, 0.5, fan ? 0x9a4a8a : 0xb4503c, 0, 0); wallAt(1, 1.0, 0.5, fan ? 0x9a4a8a : 0xa8503e, 0, 0);
    wallAt(-1, S.ceil, 0.12, fan ? 0x4a3a80 : 0xcfc6b4, 0.5, 0); wallAt(1, S.ceil, 0.12, fan ? 0x4a3a80 : 0xcfc6b4, 0.5, 0); // the hall's own walls behind the cheeks
    for (let z = 0.3; z <= S.run; z += 0.9) { const s2 = 0.6 + ((z * 9.1) % 1) * 0.45; P.box('bush', -(W / 2 + 0.2), P.hAt(z) + 1.25 + s2 * 0.4, z, s2, s2 * 1.3, s2, fan ? [0xff70c0, 0x6af0d0, 0xffd870][(z | 0) % 3] : [0xd8742c, 0xc8b02c, 0x4f8a2a][(z | 0) % 3], 0, fan ? 1 : 0); }
    enclose(0.66, fan ? 0x4a3a80 : 0xb8b2a4, fan ? 0x8a6ad0 : 0xdcd0b4);
    for (const x of [-1.4, 1.4]) P.box('post', x, landTop + 0.25, S.run + 1.35, 1.0, 0.5, 0.35, fan ? 0xff70c0 : 0xb02a24); // red benches in the hall
  }
  const mats = {
    step: new THREE.MeshLambertMaterial({ color: 0xffffff }), wall: new THREE.MeshLambertMaterial({ color: 0xffffff }), bush: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: fan ? 0x103040 : 0x000000 }),
    post: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: fan ? 0xffffff : 0x000000, emissiveIntensity: fan ? 0.6 : 0 }), rail: new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: fan ? 0xffffff : 0x000000, emissiveIntensity: fan ? 0.4 : 0 }),
    lamp: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    glow: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
  };
  const out = P.finish(g, (k) => mats[k]); out.glow.renderOrder = 5; g.userData.glow = out.glow;
  world.scene.add(g); return { group: g, glow: out.glow, N, carve: g.userData.carve };
}

/** Cut the opening into the building's front for an inside stair: the facade fragments inside the stair's box are discarded (video only; the map's file is untouched). */
function carveBuildings(world, S, c, propsOnly = false) {
  const list = (world.carves ||= []);
  list.push({ o: [S.base[0], S.base[1]], d: S.dir, hw: c.hw, z0: c.z0, z1: c.z1, y0: S.h0 - 0.5, hb: S.h0 + S.ceil + 0.12, rise: S.rise, run: S.run, h1: S.h1 });
  const U = { uCA: { value: [] }, uCB: { value: [] }, uCC: { value: [] }, uN: { value: 0 } };
  const seen = (world.carveSeen ||= new Set());
  const patch = (mt) => {
    if (seen.has(mt) || !mt.isMaterial || mt.isShaderMaterial) return; seen.add(mt);
    const prev = mt.onBeforeCompile, key = mt.customProgramCacheKey;
    mt.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(mt, sh, r);
      Object.assign(sh.uniforms, world.carveU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW;').replace('#include <project_vertex>', '#include <project_vertex>\nvCW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vCW; uniform vec4 uCA[4]; uniform vec4 uCB[4]; uniform vec4 uCC[4]; uniform int uN;')
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
for (int ci = 0; ci < 4; ci++) { if (ci >= uN) break; vec2 q = vCW.xz - uCA[ci].xy; float zz = dot(q, uCA[ci].zw), ll = dot(q, vec2(uCA[ci].w, -uCA[ci].z));
  float ytop = uCC[ci].y + uCC[ci].z * clamp(zz / uCB[ci].w, 0.0, 1.0);
  if (zz > uCB[ci].y && zz < uCB[ci].z && abs(ll) < uCB[ci].x && vCW.y > uCC[ci].x && vCW.y < ytop) discard; }`);
    };
    mt.customProgramCacheKey = () => (key ? key.call(mt) : '') + 'carve'; mt.needsUpdate = true;
  };
  world.carveU = world.carveU || U;
  world.carveU.uCA.value = [0, 1, 2, 3].map((i) => (list[i] ? (k => new THREE.Vector4(k.o[0], k.o[1], k.d[0], k.d[1]))(list[i]) : new THREE.Vector4(0, 0, 0, 1)));
  world.carveU.uCB.value = [0, 1, 2, 3].map((i) => (list[i] ? (k => new THREE.Vector4(k.hw, k.z0, k.z1, k.run))(list[i]) : new THREE.Vector4(0, 0, 0, 1)));
  world.carveU.uCC.value = [0, 1, 2, 3].map((i) => (list[i] ? (k => new THREE.Vector4(k.y0, k.hb, k.rise, 0))(list[i]) : new THREE.Vector4(0, 0, 0, 1)));
  world.carveU.uN.value = list.length;
  const roots = propsOnly ? world.scene.children.filter((o) => o.children.some((k) => k.name === 'campus_props')) : world.nodes;
  for (const n of roots) n.traverse((o) => { if (o.isMesh) [].concat(o.material).forEach(patch); });
}
const this_h = (P, z) => P.hAt(z);

// ---------------------------------------------------------------- the heart, the tap, the photo disc
const HEAD_SRC = (async () => { const t = await (await fetch(`${ROOT}observatory/stops3d.js`)).text(); const a = t.indexOf('const HEAD = `') + 14; return t.slice(a, t.indexOf('`;', a)).replace(/\$\{DISC_Y\}/g, '.66'); })();

async function makeHeart(world, S) {
  const head = await HEAD_SRC, gltf = await new GLTFLoader().loadAsync(`${ROOT}assets/models/heart-stop.glb`), U = { uTime: { value: 0 } }, group = new THREE.Group(), color = CATCOL[S.cat];
  const patch = (mt) => { mt.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + head).replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n{ vec3 hwp = position; hwAnim(hwp, objectNormal); }').replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec3 hwn = normal; hwAnim(transformed, hwn); }'); }; mt.customProgramCacheKey = () => 'hw-stop'; return mt; };
  for (const n of ['body', 'tint', 'white']) {
    const m = gltf.scene.getObjectByName(n), g = m.geometry.clone(), pos = g.attributes.position, nor = g.attributes.normal, mp = g.morphAttributes.position && g.morphAttributes.position[0], mn = g.morphAttributes.normal && g.morphAttributes.normal[0];
    const dp = new Float32Array(pos.count * 3), dn = new Float32Array(pos.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); if (mp) v.add(new THREE.Vector3().fromBufferAttribute(mp, i)); v.toArray(dp, i * 3); v.fromBufferAttribute(nor, i); if (mn) v.add(new THREE.Vector3().fromBufferAttribute(mn, i)); v.normalize().toArray(dn, i * 3); }
    g.setAttribute('aDisc', new THREE.BufferAttribute(dp, 3)); g.setAttribute('aDiscN', new THREE.BufferAttribute(dn, 3)); g.setAttribute('aPart', g.getAttribute('_part')); g.deleteAttribute('_part'); g.morphAttributes = {};
    g.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(pos.count), 1)); g.setAttribute('aAnim', new THREE.BufferAttribute(new Float32Array(pos.count).fill(0), 1)); // 0 = the finished disc with its heart (no tumbling prism)
    const mat = patch(new THREE.MeshStandardMaterial({ color: n === 'white' ? 0xffffff : color, vertexColors: true, roughness: 0.45, emissive: n === 'white' ? 0xffffff : color, emissiveIntensity: n === 'white' ? 0.35 : 0.55 }));
    const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; group.add(mesh);
  }
  group.userData.U = U; const bb = new THREE.Box3().setFromObject(group); group.userData.discY = bb.min.y + (bb.max.y - bb.min.y) * 0.66; group.userData.size = bb.max.y - bb.min.y; return group;
}

function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
function ringTex() { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 10; g.shadowColor = '#fff'; g.shadowBlur = 18; g.beginPath(); g.arc(128, 128, 96, 0, 6.2832); g.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }

/** the finger: a soft touch circle with a bright core, like a thumb pressing the screen */
function fingerTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 6, 64, 64, 60); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(0.45, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(64, 64, 44, 0, 6.2832); g.stroke(); return new THREE.CanvasTexture(c); }

const DISC_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const DISC_FS = `varying vec2 vUv; uniform sampler2D uTex; uniform vec3 uRim; uniform float uA, uAspect;
void main(){ vec2 p = vUv - 0.5; float d = length(p) * 2.0; if (d > 1.0) discard;
  vec2 sc = uAspect > 1.0 ? vec2(1.0 / uAspect, 1.0) : vec2(1.0, uAspect);
  vec3 c = texture2D(uTex, 0.5 + p * sc * 0.92).rgb;
  float rim = smoothstep(0.86, 0.94, d); c = mix(c, uRim * 1.8, rim); c += uRim * 0.3 * smoothstep(0.55, 1.0, d);
  gl_FragColor = vec4(c, uA); }`;

// ---------------------------------------------------------------- characters
async function loadAvatar(url) {
  const gltf = await new GLTFLoader().loadAsync(url), model = gltf.scene, box = new THREE.Box3().setFromObject(model), h = box.max.y - box.min.y || 1;
  const sc = 1.72 / h, U = { uCut: { value: 0 }, uUp: { value: 1 }, uOn: { value: 1 } };
  model.scale.setScalar(sc); model.position.y = -box.min.y * sc;
  const wrap = new THREE.Group(); wrap.add(model);
  model.traverse((o) => {
    if (!o.isMesh) return; o.frustumCulled = false; o.castShadow = true; o.material = o.material.clone();
    const mt = o.material; mt.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;').replace('#include <project_vertex>', '#include <project_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vWY; uniform float uCut, uUp, uOn;')
        .replace('#include <alphatest_fragment>', '#include <alphatest_fragment>\nif (uOn < 0.5) discard; if (uUp > 0.5 ? vWY > uCut : vWY < uCut) discard;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.35, 1.0, 0.9) * smoothstep(0.16, 0.0, abs(vWY - uCut)) * 4.0 * uOn;');
    };
    mt.customProgramCacheKey = () => 'avatar-cut';
  });
  const mixer = new THREE.AnimationMixer(model), clip = gltf.animations.find((a) => a.name === 'walk') || gltf.animations[0]; mixer.clipAction(clip).play();
  return { wrap, U, mixer, clip, height: 1.72 };
}

export async function installStairs(world, plan, log) {
  const fan = world.fan, items = [];
  const gt = glowTex(), rt = ringTex(), ft = fingerTex();
  const boy = await loadAvatar(`${ROOT}assets/models/avatars/schoolboy.glb`), girl = await loadAvatar(`${ROOT}assets/models/avatars/schoolgirl.glb`);
  const loader = new THREE.TextureLoader();
  for (const S of plan) {
    const stair = buildStair(world, S); if (stair.carve) carveBuildings(world, S, stair.carve); else carveBuildings(world, { ...S, ceil: 4.8, h0: S.h0 - 2.5 }, { hw: S.W / 2 + 1.5, z0: -1.5, z1: S.run + 1.5 }, true); /* the app's prop mesh has a stray strand over the steps: cleared inside the footprint */ const heart = await makeHeart(world, S), color = new THREE.Color(CATCOL[S.cat]);
    const hp = new THREE.Vector3(S.heart[0], world.H(S.heart[0], S.heart[1]) + 3.1, S.heart[1]);
    const HS = 2.4 / (heart.userData.size || 1); heart.userData.HS = HS; heart.scale.setScalar(HS); heart.position.copy(hp); world.scene.add(heart);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, hp.y - world.H(S.heart[0], S.heart[1]) - 0.6, 8), new THREE.MeshLambertMaterial({ color: fan ? 0x8a9aff : 0x555a60 })); post.position.set(hp.x, (hp.y + world.H(S.heart[0], S.heart[1]) - 0.6) / 2 - 0.2, hp.z); world.scene.add(post);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })); halo.position.copy(hp); halo.scale.setScalar(5); world.scene.add(halo);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: gt, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.8 })); pool.position.set(hp.x, world.H(hp.x, hp.z) + 0.08, hp.z); world.scene.add(pool);
    const ring = new THREE.Sprite(new THREE.SpriteMaterial({ map: rt, color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })); ring.visible = false; world.scene.add(ring);
    const finger = new THREE.Sprite(new THREE.SpriteMaterial({ map: ft, color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })); finger.visible = false; world.scene.add(finger);
    const tex = await loader.loadAsync(`${ROOT}assets/stairs/` + S.photo); tex.colorSpace = THREE.SRGBColorSpace;
    const aspect = tex.image.width / tex.image.height;
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: DISC_VS, fragmentShader: DISC_FS, transparent: true, depthWrite: false, toneMapped: false, uniforms: { uTex: { value: tex }, uRim: { value: color.clone() }, uA: { value: 1 }, uAspect: { value: aspect } } })); disc.visible = false; disc.renderOrder = 30; world.scene.add(disc);
    // burst of hearts at the top
    const NB = 48, bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NB * 3), 3));
    const burst = new THREE.Points(bg, new THREE.PointsMaterial({ map: gt, color, size: 1.1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); burst.frustumCulled = false; burst.visible = false; world.scene.add(burst);
    const bv = Array.from({ length: NB }, (_, i) => { const a = (i / NB) * 6.283 * 3.1, s = 1.6 + (i % 7) * 0.5; return [Math.cos(a) * s, 3 + (i % 5) * 0.9, Math.sin(a) * s]; });
    items.push({ S, stair, heart, halo, pool, ring, finger, disc, burst, bv, hp, color, tex, post });
  }
  window.__stairItems = items; window.__avatars = { boy, girl };
  const ev = STAIR_EVENTS;
  const bw = boy.wrap, gw = girl.wrap; world.scene.add(bw, gw); bw.visible = gw.visible = false;
  const cam = new THREE.Vector3();
  world.updaters.push((A, F) => {
    const t = F.stairT ?? F.t; cam.copy(F.cam.position); bw.visible = gw.visible = false; // F.stairT: the live page drives the stair story from a tap
    for (const it of items) {
      const { S } = it, e = ev[S.id], tau = t - e.tap, lit = fan ? 1 : 0;
      it.heart.userData.U.uTime.value = t * 1.0 + (S.cat * 1.7);
      { const dpost = Math.hypot(cam.x - it.post.position.x, cam.z - it.post.position.z), k = smooth((dpost - 3.5) / 5.5) * (1 - smooth((tau - 3.5) / 1.0)); it.post.scale.set(k, 1, k); it.post.visible = k > 0.02; } // the post fades away as the camera passes it, so it never stands in the shot as a bare pole
      const lampy = 0.7 + 0.3 * A.lamps; it.halo.material.opacity = 0.55 * lampy; it.pool.material.opacity = 0.55 * lampy;
      // the heart shrinks while its disc is open and comes back after
      const open = smooth((tau - 0.25) / 0.7) * (1 - smooth((tau - 4.4) / 0.8));
      // the heart turns slowly and bobs; it shrinks into its post while the photo disc is open
      const HS = it.heart.userData.HS, hs = HS * (1 - 0.85 * open) * (1 + 0.06 * Math.exp(-Math.abs(tau) * 4) * (tau > -0.3 ? 1 : 0));
      it.heart.scale.setScalar(hs); it.heart.rotation.y = t * 0.9; it.heart.position.set(it.hp.x, it.hp.y + Math.sin(t * 1.6) * 0.12, it.hp.z);
      const dc = it.heart.position.clone(); dc.y += it.heart.userData.discY * hs; it.halo.position.copy(dc);
      const press = Math.exp(-Math.max(0, tau) * 2.5) * smooth((tau + 0.25) / 0.25);
      it.halo.scale.setScalar(4.2 * (1 - 0.5 * open) * (1 + 0.6 * press));
      // the finger: a soft touch circle drifts in from lower right and presses the heart's centre
      const fv = tau > -1.2 && tau < 0.7;
      it.finger.visible = fv;
      if (fv) {
        const u = smooth((tau + 1.2) / 1.05), off = (1 - u) * 2.4, right = new THREE.Vector3(1, 0, 0).applyQuaternion(F.cam.quaternion), upv = new THREE.Vector3(0, 1, 0).applyQuaternion(F.cam.quaternion);
        it.finger.position.copy(dc).add(cam.clone().sub(dc).setLength(1.4)).addScaledVector(right, 0.9 * off).addScaledVector(upv, -1.1 * off);
        const squash = tau > -0.05 ? 1 - 0.18 * Math.sin(clamp((tau + 0.05) / 0.3) * Math.PI) : 1;
        it.finger.scale.setScalar(1.1 * squash); it.finger.material.opacity = 0.85 * smooth((tau + 1.2) / 0.3) * (1 - smooth((tau - 0.35) / 0.3));
      }
      // ripple rings
      const rv = tau > 0 && tau < 1.5; it.ring.visible = rv; if (rv) { const u = tau / 1.5, dc2 = it.halo.position; it.ring.position.copy(dc2).add(cam.clone().sub(dc2).setLength(0.4)); it.ring.scale.setScalar(2 + 9 * outCubic(u)); it.ring.material.opacity = (1 - u) * 0.95; }
      // the photo disc
      const dv = open > 0.01; it.disc.visible = dv;
      if (dv) { const sc = 6.2 * outBack(clamp((tau - 0.25) / 0.75)) * (1 - smooth((tau - 4.4) / 0.8)); const up = it.halo.position.clone(); up.y += 1.6 * open; it.disc.position.copy(up); it.disc.scale.setScalar(Math.max(0.01, sc)); it.disc.quaternion.copy(F.cam.quaternion); it.disc.material.uniforms.uA.value = Math.min(1, open * 1.4); }
      // the lit steps: a wave climbing the stair, settling to a soft glow, then fading
      const glow = it.stair.glow, N = it.stair.N, c = new THREE.Color();
      for (let i = 0; i < N; i++) { const wave = (tau - 0.7) / 0.07 - i; const pulse = wave > 0 ? Math.exp(-wave * 0.35) : 0; const settle = clamp(wave * 0.5) * (fan ? 0.55 : 0.0) * (1 - smooth((tau - 9) / 2.5)); const f = (wave > 0 ? Math.max(pulse * 1.6, settle) : 0) * (tau > -1 ? 1 : 0); glow.setColorAt(i, c.copy(it.color).multiplyScalar(f * (fan ? 1.5 : 1.0) + (fan ? 0.4 : 0))); }
      glow.instanceColor.needsUpdate = true;
      it.burst.visible = false;
      // the climber
      if (S.id === 'ST05') continue;
      const lenPath = 3 + Math.hypot(S.run, S.rise) + 1.6, speed = 2.1, t0 = e.tap + 1.3, k = (t - t0) * speed;
      const show = k >= 0 && k <= lenPath + 0.9;
      const first = S.id === 'ST26' ? boy : girl, second = S.id === 'ST26' ? girl : boy;
      if (show) {
        const p = Math.min(k, lenPath), d = S.dir, base = [S.base[0] - d[0] * 3, S.base[1] - d[1] * 3];
        let along = p, y;
        if (p < 3) y = world.H(base[0] + d[0] * p, base[1] + d[1] * p); else { const q = Math.min(p - 3, Math.hypot(S.run, S.rise)); const u = clamp(q / Math.hypot(S.run, S.rise)); y = S.h0 + S.rise * u + 0.0; along = 3 + u * S.run; }
        if (p > 3 + Math.hypot(S.run, S.rise)) { y = S.h1; along = 3 + S.run + (p - 3 - Math.hypot(S.run, S.rise)); }
        const wx = base[0] + d[0] * along, wz = base[1] + d[1] * along;
        for (const av of [first, second]) { av.wrap.position.set(wx, y, wz); av.wrap.rotation.y = S.yaw; av.mixer.setTime(k / 1.15); }
        // scan-line dissolves share one cut plane: the entry rises from the feet, the swap sweeps A -> B, the exit vanishes from the feet up
        const ent = clamp(k / 0.7), sw = e.swap > 0 ? clamp((t - e.swap) / 1.0) : 0, ext = clamp((k - lenPath + 0.5) / 0.8), swapped = e.swap > 0 && t >= e.swap;
        const set = (av, on, up, cut) => { av.wrap.visible = on; av.U.uOn.value = on ? 1 : 0; av.U.uUp.value = up; av.U.uCut.value = cut; };
        let A = [true, 1, y + 10], B = [false, 1, y + 10];
        if (ent < 1) A = [true, 1, y + ent * 1.9];
        else if (swapped) { if (sw < 1) { A = [true, 0, y + sw * 1.9]; B = [true, 1, y + sw * 1.9]; } else { A = [false, 1, y]; B = [true, 1, y + 10]; } }
        if (ext > 0) { const cur = swapped && sw >= 1 ? B : A; cur[0] = true; cur[1] = 0; cur[2] = y + ext * 1.95; }
        set(first, ...A); set(second, ...B);
        // burst at the top
        const bt = k - lenPath + 0.4;
        if (bt > 0 && bt < 2.4) { it.burst.visible = true; const pos = it.burst.geometry.attributes.position; for (let i = 0; i < it.bv.length; i++) { const v = it.bv[i]; pos.setXYZ(i, wx + v[0] * bt * 0.6, y + 1.2 + v[1] * bt * 0.6 - 2.2 * bt * bt * 0.5, wz + v[2] * bt * 0.6); } pos.needsUpdate = true; it.burst.material.opacity = 1 - bt / 2.4; }
      }
    }
  });
  log('stairs installed:', plan.map((p) => p.id + ' base ' + p.base.map((v) => v.toFixed(0)) + ' h ' + p.h0.toFixed(1) + '->' + p.h1.toFixed(1)).join(' | '));
}
