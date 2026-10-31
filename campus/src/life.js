// Life on the campus: people on the covered walkways, cars on the service roads, birds. Every motion is a periodic function of
// time whose period divides LOOP, so the film loops without anything jumping.
import * as THREE from 'three';
import { toLocal, mulberry, clamp } from './common.js';
import { LOOP } from './timeline.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function lines(osm, kinds) {
  const out = [];
  for (const f of osm.features) {
    if (f.geometry.type !== 'LineString' || !kinds.includes(f.properties.kind)) continue;
    const P = f.geometry.coordinates.map(([lng, lat]) => { const p = toLocal(lng, lat); return [p.x, p.z]; });
    const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    if (cum[cum.length - 1] > 12) out.push({ P, cum, L: cum[cum.length - 1] });
  }
  return out;
}
function at(line, s) {
  const { P, cum } = line; s = ((s % line.L) + line.L) % line.L; let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const u = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u, Math.atan2(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])];
}

export function installLife(world, osm, H) {
  const rnd = mulberry(world.fan ? 303 : 202), fan = world.fan;
  // ---- people
  const walk = lines(osm, ['footway_covered']), roads = lines(osm, ['road', 'road_major']);
  const NP = 150, torsoG = new THREE.CapsuleGeometry(0.17, 0.42, 3, 6), legG = new THREE.CapsuleGeometry(0.075, 0.6, 2, 5), armG = new THREE.CapsuleGeometry(0.055, 0.5, 2, 5), headG = new THREE.SphereGeometry(0.125, 8, 6);
  const clothM = new THREE.MeshLambertMaterial({ color: 0xffffff }), legM = new THREE.MeshLambertMaterial({ color: 0xffffff }), skinM = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const torso = new THREE.InstancedMesh(torsoG, clothM, NP), legs = new THREE.InstancedMesh(legG, legM, NP * 2), arms = new THREE.InstancedMesh(armG, skinM, NP * 2), head = new THREE.InstancedMesh(headG, skinM, NP);
  const palette = fan ? [0xff7ac8, 0x7affd8, 0xffd36a, 0x9a8aff, 0xff9a6a] : [0xffffff, 0x2a3a6a, 0xe0e0e0, 0x1a5a3a, 0xb04a4a, 0xf0d060, 0x333333], skins = [0xe0b48a, 0xc68e63, 0x9a6a45, 0xf0c8a0], c = new THREE.Color();
  const P = [];
  const totalL = walk.reduce((a, l) => a + l.L, 0);
  for (let i = 0; i < NP; i++) {
    let r = rnd() * totalL, li = 0; while (li < walk.length - 1 && r > walk[li].L) { r -= walk[li].L; li++; }
    const l = walk[li], k = Math.max(1, Math.round((1.1 + rnd() * 0.5) * LOOP / l.L)) * (rnd() < 0.5 ? 1 : -1);
    P.push({ l, s0: rnd() * l.L, k, off: (rnd() - 0.5) * 1.6, ph: rnd() * 6.283, h: 0.93 + rnd() * 0.14 });
    const top = palette[Math.floor(rnd() * palette.length)], skin = skins[Math.floor(rnd() * skins.length)];
    torso.setColorAt(i, c.setHex(top)); legs.setColorAt(i * 2, c.setHex(fan ? 0x4a4aa0 : 0x2a2a38)); legs.setColorAt(i * 2 + 1, c); arms.setColorAt(i * 2, c.setHex(skin)); arms.setColorAt(i * 2 + 1, c); head.setColorAt(i, c);
  }
  for (const m of [torso, legs, arms, head]) { m.instanceColor.needsUpdate = true; m.frustumCulled = false; m.castShadow = true; } // pedestrians removed (owner's request): built but not added
  // ---- cars
  const NC = 14, carG = new THREE.BoxGeometry(1.9, 1.35, 4.3), carM = new THREE.MeshLambertMaterial({ color: 0xffffff }), cars = new THREE.InstancedMesh(carG, carM, NC);
  const lightG = new THREE.BoxGeometry(1.5, 0.18, 0.12), lightM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), lights = new THREE.InstancedMesh(lightG, lightM, NC * 2);
  const CP = [], carCols = fan ? [0xff5aa8, 0x58e0ff, 0xffd24a, 0xa88aff] : [0xc02020, 0x2a4fa0, 0xe8e8e8, 0x303030, 0xd0d0d0, 0x2a7a4a];
  for (let i = 0; i < NC; i++) { const l = roads[Math.floor(rnd() * roads.length)], k = 1 + Math.floor(rnd() * 2); CP.push({ l, ph: rnd(), k }); cars.setColorAt(i, c.setHex(carCols[i % carCols.length])); }
  cars.instanceColor.needsUpdate = true; cars.frustumCulled = lights.frustumCulled = false; // cars removed (owner: the box cars looked like green blocks): built but not added
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  // ---- palm rows along the campus roads (the reference drone video is lined with them)
  {
    const trunkG = new THREE.CylinderGeometry(0.16, 0.26, 1, 7).translate(0, 0.5, 0), fr = [];
    for (let k = 0; k < 9; k++) { const g = new THREE.ConeGeometry(0.34, 3.4, 4).translate(0, 1.7, 0).rotateZ(Math.PI / 2 + 0.7).rotateY((k / 9) * Math.PI * 2); g.scale(1, 0.35, 1); fr.push(g.translate(0, 0, 0)); }
    const frondG = mergeGeometries(fr), palms = [], pr = mulberry(world.fan ? 515 : 414), road = lines(osm, ['road']);
    for (const l of road) for (let d = 6; d < l.L - 4; d += 9 + pr() * 4) { const [x, z, a] = at(l, d), side = pr() < 0.5 ? -1 : 1, off = 5.2 + pr() * 0.8, px = x + Math.cos(a) * off * side, pz = z - Math.sin(a) * off * side; if (Math.hypot(px + 74, pz + 54) > 20 && Math.hypot(px + 156, pz + 98) > 16 && Math.abs(px) < 250 && Math.abs(pz) < 340 && !(window.clearance && window.clearance(px, pz) > -1e8)) palms.push({ x: px, z: pz, h: 5.5 + pr() * 3.5, r: pr() * 6.28 }); }
    const tm = new THREE.MeshLambertMaterial({ color: fan ? 0x6a5aa0 : 0x7a6a4e }), fm = new THREE.MeshLambertMaterial({ color: fan ? 0x40ffc8 : 0x3f7a2a, side: THREE.DoubleSide, emissive: fan ? 0x105040 : 0x000000 });
    const tI = new THREE.InstancedMesh(trunkG, tm, palms.length), fI = new THREE.InstancedMesh(frondG, fm, palms.length), mm = new THREE.Matrix4(), qq = new THREE.Quaternion();
    palms.forEach((p, i) => { const y = H(p.x, p.z); mm.compose(new THREE.Vector3(p.x, y, p.z), qq.setFromAxisAngle(Y, p.r), new THREE.Vector3(1, p.h, 1)); tI.setMatrixAt(i, mm); mm.compose(new THREE.Vector3(p.x, y + p.h, p.z), qq, new THREE.Vector3(1.2, 1.2, 1.2)); fI.setMatrixAt(i, mm); });
    tI.castShadow = fI.castShadow = true; tI.frustumCulled = fI.frustumCulled = false; world.scene.add(tI, fI);
  }
  // ---- birds (a loose flock circling the campus at dawn and dusk)
  const NB = 26, birdG = new THREE.ConeGeometry(0.28, 1.1, 3).rotateX(Math.PI / 2), birds = new THREE.InstancedMesh(birdG, new THREE.MeshBasicMaterial({ color: fan ? 0xffe0ff : 0x222222 }), NB);
  const BP = Array.from({ length: NB }, () => ({ r: 120 + rnd() * 160, ph: rnd() * 6.283, y: 70 + rnd() * 60, w: rnd() })); birds.frustumCulled = false; world.scene.add(birds);
  world.updaters.push((A, F) => {
    const t = F.t, lp = (t % LOOP) / LOOP;
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < NP; i++) {
      const p = P[i], [x, z, a] = at(p.l, p.s0 + p.k * p.l.L * lp), nx = Math.cos(a) * p.off, nz = -Math.sin(a) * p.off, px = x + nx, pz = z + nz, y = H(px, pz), sw = Math.sin(t * 5.5 * (p.k > 0 ? 1 : 1) + p.ph) * 0.5, hh = p.h, bob = Math.abs(Math.sin(t * 5.5 + p.ph)) * 0.03;
      const yaw = p.k > 0 ? a : a + Math.PI; qa.setFromAxisAngle(Y, yaw);
      const at3 = (ox, oy, oz) => { v.set(ox, oy, oz).applyQuaternion(qa); return v.set(px + v.x, y + v.y + bob, pz + v.z); };
      m4.compose(at3(0, 1.05 * hh, 0), qa, sc.set(1, hh, 1)); torso.setMatrixAt(i, m4);
      m4.compose(at3(0, 1.55 * hh, 0), qa, sc.set(1, 1, 1)); head.setMatrixAt(i, m4);
      for (let sd = 0; sd < 2; sd++) {
        const s = sd ? 1 : -1; qb.setFromAxisAngle(X, sw * s * 0.9).premultiply(qa);
        v.set(0, -0.3 * hh, 0).applyQuaternion(qb); const lx = px + new THREE.Vector3(s * 0.1, 0, 0).applyQuaternion(qa).x + v.x, lz = pz + new THREE.Vector3(s * 0.1, 0, 0).applyQuaternion(qa).z + v.z;
        m4.compose(new THREE.Vector3(lx, y + 0.72 * hh + v.y + bob, lz), qb, sc.set(1, hh, 1)); legs.setMatrixAt(i * 2 + sd, m4);
        qb.setFromAxisAngle(X, -sw * s * 0.8).premultiply(qa); v.set(0, -0.22, 0).applyQuaternion(qb);
        const sh = new THREE.Vector3(s * 0.25, 0, 0).applyQuaternion(qa); m4.compose(new THREE.Vector3(px + sh.x + v.x, y + 1.3 * hh + v.y + bob, pz + sh.z + v.z), qb, sc.set(1, 1, 1)); arms.setMatrixAt(i * 2 + sd, m4);
      }
    }
    torso.instanceMatrix.needsUpdate = legs.instanceMatrix.needsUpdate = arms.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true; sc.set(1, 1, 1);
    const lampOn = A.lamps;
    for (let i = 0; i < NC; i++) {
      const p = CP[i], u = ((p.ph + p.k * lp) % 1), tri = u < 0.5 ? u * 2 : 2 - u * 2, dir = u < 0.5 ? 1 : -1, [x, z, a0] = at({ ...p.l, L: p.l.L * 0.999 }, tri * p.l.L * 0.98), a = dir > 0 ? a0 : a0 + Math.PI, y = H(x, z) + 0.75;
      m4.compose(v.set(x, y + 0.2, z), q.setFromAxisAngle(Y, a), sc); cars.setMatrixAt(i, m4);
      const fw = new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), sd = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
      m4.compose(v.set(x + fw.x * 2.2, y + 0.1, z + fw.z * 2.2), q, new THREE.Vector3(lampOn * 1.0 + 0.001, 1, 1)); lights.setMatrixAt(i * 2, m4);
      m4.compose(v.set(x - fw.x * 2.2, y + 0.1, z - fw.z * 2.2), q, new THREE.Vector3(lampOn * 0.7 + 0.001, 1, 1)); lights.setMatrixAt(i * 2 + 1, m4);
    }
    cars.instanceMatrix.needsUpdate = lights.instanceMatrix.needsUpdate = true; lightM.color.setRGB(2.4, 2.0, 1.2);
    const dawnDusk = clamp(1 - Math.abs(A.day - 0.5) * 2.4) * (1 - A.cloud * 0.5) * (F.W.rain > 0.1 ? 0 : 1);
    birds.visible = dawnDusk > 0.15 || fan;
    for (let i = 0; i < NB; i++) { const b = BP[i], a = b.ph + lp * 6.283 * (1 + Math.floor(b.w * 2)) * (b.w > 0.5 ? 1 : -1); const x = Math.cos(a) * b.r, z = Math.sin(a) * b.r; m4.compose(v.set(x, H(x, z) + b.y + Math.sin(a * 3) * 4, z), q.setFromAxisAngle(Y, -a + (b.w > 0.5 ? 0 : Math.PI)), sc.set(1 + 0.45 * Math.sin(t * 9 + i), 1, 1)); birds.setMatrixAt(i, m4); }
    birds.instanceMatrix.needsUpdate = true; sc.set(1, 1, 1);
  });
}
