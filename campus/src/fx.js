// Weather and atmosphere particles, all pure functions of time (uTime) so every frame is reproducible.
import * as THREE from 'three';
import { mulberry } from './common.js';

const BOX = 90; // particles live in a box this wide around the camera

function rain(world) {
  const N = 9000, rnd = mulberry(11), pos = new Float32Array(N * 6), seed = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { const x = rnd(), y = rnd(), z = rnd(), k = rnd(); for (let v = 0; v < 2; v++) { pos.set([x, y, z], i * 6 + v * 3); seed[i * 2 + v] = v + k * 10; } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const fan = world.fan;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 0 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(fan ? 0x9fd8ff : 0xcfd9e6) }, uWind: { value: new THREE.Vector2(6, 2) } },
    vertexShader: `attribute float aSeed; uniform float uTime, uAmt; uniform vec3 uCam; uniform vec2 uWind; varying float vA;
      void main(){ float k = floor(aSeed / 10.0) * 0.0 + fract(aSeed * 0.1); float end = step(0.5, mod(aSeed, 10.0));
        vec3 p = position; float speed = 38.0 + 12.0 * fract(position.x * 7.1);
        float fall = uTime * speed + position.y * ${BOX}.0;
        vec3 w = vec3((position.x - 0.5) * ${BOX}.0, 0.0, (position.z - 0.5) * ${BOX}.0);
        w.y = ${BOX}.0 - mod(fall, ${BOX}.0 * 1.0);
        w.xz += uWind * (w.y / ${BOX}.0) * -1.0; w.xz += uWind * (-0.5);
        vec3 wp = uCam + w + vec3(0.0, -10.0, 0.0);
        wp.y += end * 1.5; wp.xz += end * uWind * 0.04;
        vA = step(fract(position.x * 53.7 + position.z * 17.3), uAmt) * (0.25 + 0.5 * fract(position.z * 31.0));
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol * 1.6, vA * 0.55); }`,
  });
  const l = new THREE.LineSegments(g, m); l.frustumCulled = false; l.renderOrder = 50; l.visible = false; world.scene.add(l);
  return l;
}

function motes(world, N, size, color, speed) {
  const rnd = mulberry(world.fan ? 71 : 17), pos = new Float32Array(N * 3), seed = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos.set([rnd(), rnd(), rnd()], i * 3); seed.set([rnd(), rnd(), rnd()], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uAmt: { value: 1 }, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color(color) }, uSize: { value: size }, uSpeed: { value: speed }, uScale: { value: 1000 } },
    vertexShader: `attribute vec3 aSeed; uniform float uTime, uAmt, uSize, uSpeed, uScale; uniform vec3 uCam; varying float vA;
      void main(){ vec3 o = (position - 0.5) * ${BOX}.0 * 1.6; float t = uTime * uSpeed;
        o += vec3(sin(t * 0.6 + aSeed.x * 40.0) * 3.0, sin(t * 0.45 + aSeed.y * 30.0) * 2.0 + t * 0.5 * (aSeed.z - 0.3), cos(t * 0.5 + aSeed.z * 50.0) * 3.0);
        vec3 c = uCam; vec3 wp = c + mod(o - c + ${BOX * 0.8}.0, ${BOX * 1.6}.0) - ${BOX * 0.8}.0;
        wp.y = c.y - 14.0 + mod(o.y + ${BOX * 0.8}.0 + 14.0, 50.0);
        vec4 mv = viewMatrix * vec4(wp, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uSize * uScale / max(1.0, -mv.z) * (0.6 + aSeed.x);
        vA = step(aSeed.y, uAmt) * (0.5 + 0.5 * sin(uTime * (1.5 + aSeed.z * 3.0) + aSeed.x * 60.0)); }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a *= a; gl_FragColor = vec4(uCol * 1.4, a * vA); }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 40; p.visible = false; world.scene.add(p); return p;
}

/** Floating lanterns (fantasy): a few hundred glowing paper lanterns rising over the campus, each at a fixed place on its own path. */
function lanterns(world, H) {
  const N = 140, rnd = mulberry(909), geo = new THREE.SphereGeometry(0.5, 10, 8), mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const im = new THREE.InstancedMesh(geo, mat, N), base = []; const col = new THREE.Color();
  for (let i = 0; i < N; i++) { base.push({ x: (rnd() - 0.5) * 420, z: (rnd() - 0.5) * 560, y: 12 + rnd() * 40, ph: rnd() * 100, sp: 1.2 + rnd() * 1.4, s: 0.7 + rnd() * 0.9 }); col.setHSL(0.05 + rnd() * 0.12, 1, 0.55); im.setColorAt(i, col.multiplyScalar(2.4)); }
  im.instanceColor.needsUpdate = true; im.frustumCulled = false; im.visible = false; world.scene.add(im);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  im.updateT = (t) => { for (let i = 0; i < N; i++) { const b = base[i], rise = ((t * b.sp * 0.8 + b.ph) % 60); m4.compose(new THREE.Vector3(b.x + Math.sin(t * 0.3 + b.ph) * 4, H(b.x, b.z) + b.y + rise, b.z + Math.cos(t * 0.27 + b.ph) * 4), q, new THREE.Vector3(b.s, b.s * 1.25, b.s)); im.setMatrixAt(i, m4); } im.instanceMatrix.needsUpdate = true; };
  return im;
}

export function installFx(world, H) {
  const R = rain(world), dust = motes(world, 1400, 0.11, world.fan ? 0xffe9a8 : 0xffe2b0, 0.5);
  const fly = world.fan ? motes(world, 900, 0.3, 0x8affd8, 1.0) : null, lan = world.fan ? lanterns(world, H) : null;
  world.updaters.push((A, F, frame) => {
    const W = F.W, t = F.t, size = frame.size || 1080, scale = size * 0.9;
    R.visible = W.rain > 0.02; R.material.uniforms.uTime.value = t; R.material.uniforms.uAmt.value = Math.min(1, W.rain * 1.1); R.material.uniforms.uCam.value.copy(F.cam.position); R.material.uniforms.uWind.value.set(5 + W.storm * 9, 2);
    R.material.uniforms.uCol.value.setHex(world.fan ? 0x9fd8ff : 0xcfd9e6).multiplyScalar(0.25 + A.day * 0.9 + 0.5 * A.lamps);
    const hz = Math.max(W.haze, world.fan ? 0.55 : 0);
    dust.visible = hz > 0.02; dust.material.uniforms.uTime.value = t; dust.material.uniforms.uAmt.value = Math.min(1, hz); dust.material.uniforms.uCam.value.copy(F.cam.position); dust.material.uniforms.uScale.value = scale; dust.material.uniforms.uCol.value.setHex(world.fan ? (A.day > 0.5 ? 0xffd9a0 : 0xa0b0ff) : 0xffd9a0);
    if (fly) { const on = world.fan ? Math.min(1, (1 - A.day * 0.8) * (1 - W.rain * 0.5) + 0.25) : 0; fly.visible = on > 0.02; fly.material.uniforms.uTime.value = t; fly.material.uniforms.uAmt.value = on; fly.material.uniforms.uCam.value.copy(F.cam.position); fly.material.uniforms.uScale.value = scale; }
    if (lan) { lan.visible = A.day < 0.7; if (lan.visible) lan.updateT(t); }
    // lightning: a flash on the hemisphere light and a brighter key for a few frames
    world.hemi.intensity += W.flash * 1.8; world.key.intensity += W.flash * 1.2;
  });
}
