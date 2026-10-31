// One complete campus world per look ('realistic' | 'fantasy'): ground, buildings, roads and props, trees, sky, lights and fog.
// Everything is built from the app's own files (read-only) plus extra detail that exists only for this video.
import { ROOT } from './common.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { toLocal, mulberry, clamp, lerp, smoothstep, fbm2, hash2 } from './common.js';
import { heightAt as baseHeight, groundTiles, paintGround, groundMaterial } from './ground.js';
import { atmosphere, createSky } from './atmos.js';
import { makeTrees } from '../../observatory/deco.js';
import { noiseTex } from './noise.js';

const loader = new GLTFLoader();
const cache = new Map();
export const loadGLB = (url) => { if (!cache.has(url)) cache.set(url, loader.loadAsync(url)); return cache.get(url); };

function ringLocal(ring) { return ring.map(([lng, lat]) => { const p = toLocal(lng, lat); return [p.x, p.z]; }); }
function inPoly(x, z, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; }
function distPoly(x, z, P) { let d = 1e9; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? clamp(((x - ax) * dx + (z - az) * dz) / L) : 0; d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return d; }

/** Flat pads under buildings, pitches and plazas: the ground is levelled to the height the app lifts each building to. */
export function makePads(osm, ramps = []) {
  const pads = [];
  for (const f of osm.features) {
    const k = f.properties.kind; if (f.geometry.type !== 'Polygon' || !['building', 'sport', 'square', 'water_tower'].includes(k)) continue;
    const P = ringLocal(f.geometry.coordinates[0]); let cx = 0, cz = 0; P.forEach(([x, z]) => { cx += x; cz += z; }); cx /= P.length; cz /= P.length;
    const xs = P.map((p) => p[0]), zs = P.map((p) => p[1]), M = k === 'building' ? 7 : 4;
    pads.push({ P, base: baseHeight(cx, cz), margin: M, box: [Math.min(...xs) - M, Math.min(...zs) - M, Math.max(...xs) + M, Math.max(...zs) + M], kind: k, osm: f.properties.osm });
  }
  const H = (x, z) => {
    let h = baseHeight(x, z), best = 0, tgt = h;
    for (const p of pads) {
      if (x < p.box[0] || x > p.box[2] || z < p.box[1] || z > p.box[3]) continue;
      const w = inPoly(x, z, p.P) ? 1 : 1 - smoothstep(0, p.margin, distPoly(x, z, p.P));
      if (w > best) { best = w; tgt = p.base; }
    }
    h = lerp(h, tgt, best);
    for (const r of ramps) { // the ground meets each stair: flat at the foot, rising along the flight, flat at the landing
      const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1], L2 = dx * dx + dz * dz, len = Math.sqrt(L2), t = clamp(((x - r.a[0]) * dx + (z - r.a[1]) * dz) / L2), px = r.a[0] + dx * t, pz = r.a[1] + dz * t;
      const w = 1 - smoothstep(r.halfW, r.halfW + r.margin, Math.hypot(x - px, z - pz)); if (w <= 0) continue;
      const s = t * len, u = clamp((s - 3.5) / (len - 3.5 - 1.9)); h = lerp(h, lerp(r.h0, r.h1, u), w);
    }
    return h;
  };
  return { pads, H };
}

function skirtFor(pad, H, mat) {
  const Pm = pad.P, shape = new THREE.Shape(Pm.map(([x, z]) => new THREE.Vector2(x, -z)));
  let minH = pad.base;
  for (const [x, z] of Pm) minH = Math.min(minH, H(x, z));
  const D = Math.max(0.6, pad.base - minH + 0.5);
  const g = new THREE.ExtrudeGeometry(shape, { depth: D, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(0, pad.base - D - 0.01, 0); // shape (x, N) -> world (x, ., -N) = z
  const m = new THREE.Mesh(g, mat); m.castShadow = false; m.receiveShadow = true; return m;
}

export async function buildWorld(look, shared) {
  const fan = look === 'fantasy', { osm } = shared;
  const scene = new THREE.Scene();
  const world = { look, scene, fan, nodes: [], lampMats: [], winMats: [], glowMats: [], updaters: [], extra: {}, forestCount: 0 };
  const { pads, H } = makePads(osm, shared.ramps); world.H = H; world.pads = pads;

  // ---- ground
  const tex = paintGround(osm, look), gmat = groundMaterial(tex, look);
  const ground = groundTiles(H, gmat); scene.add(ground);
  world.ground = ground; world.groundMat = gmat;

  // ---- buildings (the app's Blender models), each lifted to the terrain under it
  const gltf = await loadGLB(`${ROOT}assets/models/campus-${look}.glb`);
  const root = gltf.scene.clone(true); // clone: the realistic and fantasy files are separate, but never mutate a cached scene twice
  const skirtMat = new THREE.MeshStandardMaterial({ color: fan ? 0x2a3556 : 0x8c8a84, roughness: 0.95 });
  const byOsm = new Map(pads.map((p) => [p.osm, p]));
  root.traverse((o) => {
    const u = o.userData || {};
    if (u.lng != null && u.lat != null) {
      const p = toLocal(u.lng, u.lat), pad = byOsm.get(u.osm);
      o.position.y += pad ? pad.base : H(p.x, p.z);
      world.nodes.push(o);
      if (pad && pad.kind === 'building') scene.add(skirtFor(pad, H, skirtMat));
    }
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      [].concat(o.material).forEach((mt) => {
        for (const k of ['map', 'emissiveMap']) if (mt[k]) { mt[k].anisotropy = 2; }
        if (mt.emissiveMap) { mt.userData.baseEm = mt.emissiveIntensity; world.winMats.push(mt); }
        mt.shadowSide = THREE.FrontSide;
        if (/roof|ridge|slate|terracotta|wall|plinth|band|brick|wood/.test(mt.name || '')) { mt.roughness = Math.max(mt.roughness, 0.9); mt.metalness = 0; }
      });
    }
  });
  scene.add(root); world.root = root;

  // ---- roads, kerbs, lamps, goals, car parks (props), each vertex draped on the terrain
  const props = (await loadGLB(`${ROOT}assets/models/campus-props-${look}.glb`)).scene.clone(true);
  props.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; o.receiveShadow = true; o.castShadow = true;
    const g = o.geometry = o.geometry.clone(), pa = g.attributes.position;
    for (let i = 0; i < pa.count; i++) pa.setY(i, pa.getY(i) + H(pa.getX(i), pa.getZ(i)));
    pa.needsUpdate = true; if (!g.attributes.normal) g.computeVertexNormals(); g.computeBoundingSphere();
    [].concat(o.material).forEach((mt) => {
      if (/lamp_glow/.test(mt.name || '')) world.lampMats.push(mt);
      else if (/rune_glow|crystal_glow/.test(mt.name || '')) { mt.emissiveIntensity = 2.6; world.glowMats.push(mt); }
    });
  });
  scene.add(props);

  // ---- trees: the app's decorative positions (on open ground, never on a building or road), standing on the ground
  const stairPts = shared.stairPoints; // [[lng, lat]] so trees keep clear of the stair stops
  const tf = makeTrees(osm, stairPts).features.map((f) => { const [lng, lat] = f.geometry.coordinates, p = toLocal(lng, lat); return { x: p.x, z: p.z, s: f.properties.s, t: f.properties.t }; });
  await addTrees(world, tf, look);
  addForest(world, osm);

  // ---- sky + lights
  const sky = createSky(look); scene.add(sky); world.sky = sky;
  scene.fog = new THREE.FogExp2(0xffffff, 0.0004);
  const key = new THREE.DirectionalLight(0xffffff, 3); key.castShadow = true; key.shadow.mapSize.set(shared.shadowSize, shared.shadowSize);
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.08; key.shadow.radius = 2.5;
  scene.add(key, key.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x445522, 1); scene.add(hemi);
  world.key = key; world.hemi = hemi; world.shadow = { r: 0, cx: 0, cz: 0, dir: new THREE.Vector3(), stamp: '' };
  return world;
}

// ---------------------------------------------------------------- trees
async function addTrees(world, pts, look) {
  const fan = look === 'fantasy', rnd = mulberry(fan ? 5 : 9);
  const gltf = await loadGLB(`${ROOT}assets/models/campus-trees.glb`);
  const oaks = ['oak1', 'oak2', 'oak3'].map((n) => gltf.scene.getObjectByName(n));
  const seg = (p, ax, az, bx, bz, r) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(p.x - ax - t * dx, p.z - az - t * dz) < r; };
  const nearGate = (p) => seg(p, -208, -101, -156, -98, 13) || seg(p, -156, -98, -104, -76, 13) || seg(p, -104, -76, -88, -52, 14) || Math.hypot(p.x + 74, p.z + 54) < 17;
  pts = pts.filter((p) => !nearGate(p)); // keep the approach to the Kolej Mara Kulim sign clear of foliage
  const buckets = [[], [], []];
  for (const p of pts) buckets[Math.floor(rnd() * 3)].push(p);
  const tints = fan ? [0x5fffd0, 0xa890ff, 0xff7ac8, 0x7affb0] : [0xffffff];
  oaks.forEach((o, v) => {
    const parts = o.isMesh ? [o] : o.children.filter((c) => c.isMesh);
    for (const part of parts) {
      const mt = part.material.clone();
      if (mt.map) mt.map.magFilter = THREE.LinearFilter;
      if (/leaves/.test(mt.name || '')) { mt.alphaTest = 0.25; mt.transparent = false; mt.side = THREE.DoubleSide; if (fan) { mt.color = new THREE.Color(0x66ffe0); mt.emissive = new THREE.Color(0x2ad0b0); mt.emissiveMap = mt.map; mt.emissiveIntensity = 0.9; world.glowMats.push(mt); mt.userData.treeGlow = true; } }
      mt.metalness = 0; mt.roughness = 1;
      if (/leaves/.test(mt.name || '') && !fan) { mt.color = new THREE.Color(1.55, 1.7, 1.15); mt.emissive = new THREE.Color(0x1d3a0c); mt.emissiveMap = mt.map; mt.emissiveIntensity = 0.55; }
      const all = buckets[v], CELL = 180, cells = new Map(); all.forEach((p) => { const k = Math.floor(p.x / CELL) + ',' + Math.floor(p.z / CELL); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(p); });
      for (const list of cells.values()) {
      const im = new THREE.InstancedMesh(part.geometry, mt, list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
      list.forEach((p, i) => {
        const s = (6.5 + rnd() * 5.5) * p.s, a = rnd() * 6.283;
        m4.compose(new THREE.Vector3(p.x, world.H(p.x, p.z) - 0.15, p.z), q.setFromAxisAngle(Y, a), new THREE.Vector3(s * (0.9 + rnd() * 0.25), s, s * (0.9 + rnd() * 0.25)));
        im.setMatrixAt(i, m4);
        if (/leaves/.test(mt.name || '')) { c.setHex(tints[Math.floor(rnd() * tints.length)]); const k = 0.82 + rnd() * 0.3; c.multiplyScalar(k); im.setColorAt(i, c); }
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere();
      im.castShadow = true; im.receiveShadow = true; world.scene.add(im);
      }
    }
  });
  world.treeCount = pts.length;
}

/** Lambert crowns with a top-lit gradient and baked-noise leafy mottling, so low-poly blobs read as canopy. */
function blobMaterial() {
  const mat = new THREE.MeshLambertMaterial({}); const U = { uNoise: { value: noiseTex() } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNoise = U.uNoise;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vBH; varying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvBH = position.y; vWP = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vBH; varying vec3 vWP; uniform sampler2D uNoise;')
      .replace('#include <color_fragment>', `#include <color_fragment>
{ vec4 n = texture2D(uNoise, vWP.xz * 0.31 + vec2(vWP.y * 0.07)); float lf = texture2D(uNoise, vWP.xz * 0.95 + vWP.y * 0.13).b; diffuseColor.rgb *= (0.55 + 0.62 * smoothstep(-1.0, 1.0, vBH)) * (0.62 + 0.8 * n.g) * (0.8 + 0.4 * lf); }`);
  };
  return mat;
}

/** The wooded land around the campus: cheap lumpy crowns, thick enough to read as plantation and jungle from the air. */
function addForest(world, osm) {
  const fan = world.fan, rnd = mulberry(1234);
  const [x0, y0, x1, y1] = osm.bounds, a = toLocal(x0, y0), b = toLocal(x1, y1);
  const minX = Math.min(a.x, b.x) - 4, maxX = Math.max(a.x, b.x) + 4, minZ = Math.min(a.z, b.z) - 4, maxZ = Math.max(a.z, b.z) + 4;
  const geos = [new THREE.IcosahedronGeometry(1, 1), new THREE.OctahedronGeometry(1, 0)], mat = blobMaterial();
  const CELL = 300, cells = new Map(), pal = fan ? [0x1d8a7a, 0x2a6ac0, 0x7a3ac0, 0x1aa890, 0x3a58d0] : [0x2c5520, 0x3a6424, 0x25501a, 0x45722a, 0x335d20, 0x667428, 0x4f6a22];
  for (let i = 0; i < 70000 && world.forestCount < 9500; i++) {
    const x = (rnd() - 0.5) * 3000, z = (rnd() - 0.5) * 3000;
    if (x > minX && x < maxX && z > minZ && z < maxZ) continue;
    const d = Math.hypot(x, z), dens = 0.85 - d / 3600 + (fbm2(x * 0.01, z * 0.01, 3) - 0.5) * 0.8;
    if (rnd() > dens) continue;
    const s = (d > 900 ? 10 : 6.5) + rnd() * 6.5, h = world.H(x, z) + (d > 420 ? (fbm2(x * 0.004 + 3, z * 0.004 + 7, 3) - 0.35) * 55 * clamp((d - 420) / 500) : 0);
    const key = (d > 900 ? 1 : 0) + ':' + Math.floor(x / CELL) + ',' + Math.floor(z / CELL); if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({ x, z, h, s, r: [rnd(), rnd() * 6, rnd(), rnd(), rnd()], c: pal[Math.floor(rnd() * pal.length)] });
    world.forestCount++;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), group = new THREE.Group();
  for (const [key, list] of cells) {
    const im = new THREE.InstancedMesh(geos[key[0] === '1' ? 1 : 0], mat, list.length);
    list.forEach((t, i) => {
      m4.compose(new THREE.Vector3(t.x, t.h + t.s * 0.8, t.z), q.setFromEuler(new THREE.Euler(t.r[0], t.r[1], t.r[2])), new THREE.Vector3(t.s, t.s * (0.85 + t.r[3] * 0.5), t.s));
      im.setMatrixAt(i, m4); c.setHex(t.c).multiplyScalar(0.8 + t.r[4] * 0.4); im.setColorAt(i, c);
    });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = false; im.receiveShadow = false; group.add(im);
  }
  world.scene.add(group); world.forest = group;
}

// ---------------------------------------------------------------- per-frame state
/** A: atmosphere(look, tod, weather); F: {cam, t, shadow: {cx, cz, r}} */
export function applyAtmosphere(world, A, F) {
  const { scene, key, hemi, fan } = world;
  scene.fog.color.copy(A.fog); scene.fog.density = A.fogDensity;
  key.color.copy(A.keyCol); key.intensity = A.keyI * (1 + A.flash * 0); hemi.color.copy(A.hemiS); hemi.groundColor.copy(A.hemiG); hemi.intensity = A.hemiI;
  world.sky.update(A, F.t, F.cam.position);
  const Ug = world.groundMat.userData.U; Ug.uTime.value = F.t; Ug.uWet.value = F.W.wet;
  world.groundMat.emissiveIntensity = fan ? 0.5 + 1.2 * (1 - A.day) + 0.3 * A.cloud : 0;
  const lampI = fan ? 2.4 + 2.2 * A.lamps : 3.4 * A.lamps;
  for (const m of world.lampMats) m.emissiveIntensity = lampI;
  const win = fan ? 0.55 + 2.6 * A.lamps : 2.6 * A.lamps * (0.4 + 0.6 * (1 - A.day)) + A.cloud * 0.4 * A.lamps;
  for (const m of world.winMats) m.emissiveIntensity = (m.userData.baseEm || 1) * Math.max(0, win) / 1.0;
  for (const m of world.glowMats) { if (m.userData.treeGlow) m.emissiveIntensity = 0.35 + 1.5 * (1 - A.day) + 0.25 * Math.sin(F.t * 0.8); else m.emissiveIntensity = 1.2 + 2.4 * A.lamps; }
  // the shadow frustum: fixed per shot, snapped to the texel grid so the shadows do not shimmer
  const S = world.shadow, r = F.shadow.r, cam = key.shadow.camera;
  const sig = [r, F.shadow.cx, F.shadow.cz, A.keyDir.x.toFixed(3), A.keyDir.y.toFixed(3), A.keyDir.z.toFixed(3)].join('|');
  if (sig !== S.stamp) {
    S.stamp = sig;
    const dist = r * 3.2 + 200;
    key.position.set(F.shadow.cx, 0, F.shadow.cz).addScaledVector(A.keyDir, dist); key.target.position.set(F.shadow.cx, 0, F.shadow.cz);
    Object.assign(cam, { left: -r, right: r, top: r, bottom: -r, near: 1, far: dist * 2 + 300 }); cam.updateProjectionMatrix();
    key.updateMatrixWorld(); key.target.updateMatrixWorld();
    world.shadowDirty = true;
  }
  key.castShadow = A.keyI > 0.02;
}
