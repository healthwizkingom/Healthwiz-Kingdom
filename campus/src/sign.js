// The "KM KULIM" entrance sign at the real gate (OSM barrier=gate), rebuilt from the owner's photo: tall white block letters (the M
// in red) standing on a tan wall that carries "SELANGKAH KE MENARA GADING" in blue and the two round emblems, an orange stripe
// beneath and a hedge of white flowers in front. Enhanced for the video: lit letters with a travelling shine. Fantasy: glowing runic.
import { ROOT } from './common.js';
import * as THREE from 'three';

export const GATEP = { x: -156, z: -98 }; // the app's entrance (OSM barrier=gate)
export const SIGN = { x: -74, z: -54, w: 15, yaw: -Math.PI / 2 }; // the app's own sign spot (tools/blender_campus.py sign()): the lawn west of the academic block, facing the road (west)

// block letters as bars in a 1 x 1.35 cell: [x0, y0, x1, y1] vertical/horizontal strokes, or ['d', x0, y0, x1, y1] diagonals
const GLYPH = {
  K: [[0, 0, 0.26, 1.35], ['d', 0.26, 0.62, 0.95, 1.35], ['d', 0.38, 0.55, 0.98, 0]],
  M: [[0, 0, 0.24, 1.35], [0.76, 0, 1, 1.35], ['d', 0.12, 1.35, 0.5, 0.3], ['d', 0.88, 1.35, 0.5, 0.3]],
  U: [[0, 0.22, 0.26, 1.35], [0.74, 0.22, 1, 1.35], [0, 0, 1, 0.26]],
  L: [[0, 0, 0.26, 1.35], [0, 0, 0.95, 0.26]],
  I: [[0.32, 0, 0.68, 1.35]],
};

function wallTexture(fan, imgs) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 260; const g = c.getContext('2d');
  g.fillStyle = fan ? '#241a5a' : '#a58a56'; g.fillRect(0, 0, 2048, 260);
  for (let i = 0; i < 2200; i++) { g.fillStyle = `rgba(${fan ? '80,80,200' : '70,50,20'},${Math.random() * 0.08})`; g.fillRect(Math.random() * 2048, Math.random() * 260, 30 + Math.random() * 60, 2 + Math.random() * 3); }
  g.fillStyle = fan ? '#9affff' : '#2a2ad0'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 118px "Inter","Arial",sans-serif'; if (fan) { g.shadowColor = '#7affd8'; g.shadowBlur = 18; }
  g.fillText('SELANGKAH KE MENARA GADING', 1024, 135); g.shadowBlur = 0;
  const emblem = (cx, img) => { g.save(); g.translate(cx, 130); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 118, 0, 6.2832); g.fill(); g.clip();
    const k = Math.min(228 / img.width, 228 / img.height); g.drawImage(img, -img.width * k / 2, -img.height * k / 2, img.width * k, img.height * k); g.restore();
    g.lineWidth = 8; g.strokeStyle = fan ? '#7affd8' : '#ffffff'; g.beginPath(); g.arc(cx, 130, 118, 0, 6.2832); g.stroke(); };
  emblem(130, imgs.mara); emblem(1918, imgs.crest);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

const loadImg = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
export async function installSign(world, H) {
  const imgs = { crest: await loadImg(`${ROOT}campus/assets/km-kulim-crest.jpg`), mara: await loadImg(`${ROOT}campus/assets/mara-logo.png`) };
  const node = world.root.getObjectByName('sign_kmk'); // the app's plain sign: hidden here and replaced by this enhanced one in the same place
  if (node) { node.visible = false; SIGN.x = node.position.x; SIGN.z = node.position.z; }
  const fan = world.fan, { x, z, w, yaw } = SIGN, y0 = H(x, z), g = new THREE.Group(); g.position.set(x, y0, z); g.rotation.y = yaw; g.scale.setScalar(0.66); // 1.6x life like the app's, a touch larger than its plinth
  const wallH = 1.9, tex = wallTexture(fan, imgs), wallM = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: fan ? 0.8 : 0.12, roughness: 0.85 });
  const side = new THREE.MeshLambertMaterial({ color: fan ? 0x2a2070 : 0x9c8250 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.7), [side, side, side, side, wallM, side]); wall.position.set(0, 0.55 + wallH / 2, 0); wall.castShadow = wall.receiveShadow = true; g.add(wall);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.34, 0.8), new THREE.MeshLambertMaterial({ color: fan ? 0xff70c0 : 0xe8502a, emissive: fan ? 0x601040 : 0x000000 })); stripe.position.set(0, 0.55 + 0.17, 0.02); g.add(stripe);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.55, 1.1), new THREE.MeshLambertMaterial({ color: fan ? 0x30306a : 0xb8b2a4 })); plinth.position.set(0, 0.275, 0); plinth.receiveShadow = true; g.add(plinth);
  // the letters: K, M (red), then K U L I M, each stroke a box (diagonals rotated), standing on top of the wall
  const LET = [['K', 0], ['M', 1], ['K', 0], ['U', 0], ['L', 0], ['I', 0], ['M', 0]], hL = 3.5, k = hL / 1.35, widths = { K: 1, M: 1.15, U: 1, L: 0.95, I: 0.68 };
  const gap = [0.55, 1.5, 0.35, 0.3, 0.3, 0.3, 0], total = LET.reduce((s, [l], i) => s + widths[l] * k + gap[i] * k, 0);
  const whiteM = new THREE.MeshStandardMaterial({ color: fan ? 0x9affff : 0xf4f4f2, emissive: fan ? 0x40ffe0 : 0xffffff, emissiveIntensity: fan ? 0.8 : 0.1, roughness: 0.45 }), redM = new THREE.MeshStandardMaterial({ color: fan ? 0xff70d0 : 0xc4202c, emissive: fan ? 0xff40c0 : 0x400000, emissiveIntensity: fan ? 0.9 : 0.15, roughness: 0.45 });
  let cx = -total / 2; const letters = new THREE.Group(); letters.position.set(0, 0.55 + wallH + 0.0, 0);
  LET.forEach(([l, red], i) => {
    const m = red ? redM : whiteM, wL = widths[l] * k;
    for (const b of GLYPH[l]) {
      let bx0, by0, bx1, by1, ang = 0, len, thick = 0.26 * k;
      if (b[0] === 'd') { [bx0, by0, bx1, by1] = b.slice(1); const dx = (bx1 - bx0) * k, dy = (by1 - by0) * k; len = Math.hypot(dx, dy); ang = Math.atan2(dy, dx); const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, thick * 0.95, 0.55), m); mesh.position.set(cx + (bx0 + bx1) / 2 * k, (by0 + by1) / 2 * k, 0); mesh.rotation.z = ang; mesh.castShadow = true; letters.add(mesh); }
      else { [bx0, by0, bx1, by1] = b; const mesh = new THREE.Mesh(new THREE.BoxGeometry((bx1 - bx0) * k, (by1 - by0) * k, 0.55), m); mesh.position.set(cx + (bx0 + bx1) / 2 * k, (by0 + by1) / 2 * k, 0); mesh.castShadow = true; letters.add(mesh); }
    }
    cx += wL + gap[i] * k;
  });
  g.add(letters);
  // the hedge in front, with white flowers
  const hedge = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.6, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: fan ? 0x103040 : 0x000000 }), 90), fl = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 5, 4), new THREE.MeshBasicMaterial({ color: fan ? 0xffe0ff : 0xffffff, toneMapped: false }), 260), m4 = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 90; i++) { const px = -w / 2 - 0.4 + (i / 89) * (w + 0.8), pz = 1.7 + (i % 2) * 0.35; m4.compose(new THREE.Vector3(px, 0.55, pz), new THREE.Quaternion(), new THREE.Vector3(1.3, 1.05 + 0.12 * (i % 3), 1.2)); hedge.setMatrixAt(i, m4); hedge.setColorAt(i, c.setHex(fan ? [0x2ad0b0, 0x7a5af0, 0x40e8a0][i % 3] : [0x2c6a2a, 0x3a7a30, 0x24602a][i % 3])); }
  for (let i = 0; i < 260; i++) { const px = -w / 2 + ((i * 0.6180339) % 1) * w, pz = 1.9 + ((i * 0.41) % 1) * 0.9; m4.compose(new THREE.Vector3(px, 0.8 + ((i * 0.3) % 1) * 0.6, pz), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); fl.setMatrixAt(i, m4); }
  hedge.castShadow = true; g.add(hedge, fl); world.scene.add(g);
  const shine = new THREE.Mesh(new THREE.PlaneGeometry(total + 2, hL + 0.8), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uP: { value: 0 }, uC: { value: new THREE.Color(fan ? 0x9affff : 0xfff0c0) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uP; uniform vec3 uC; void main(){ float d = abs(vUv.x + vUv.y * 0.3 - uP); float a = exp(-d * d * 220.0) * 0.28; gl_FragColor = vec4(uC * a * 2.0, a); }' }));
  shine.position.set(0, 0.55 + wallH + hL / 2, 0.45); g.add(shine);
  const light = new THREE.PointLight(fan ? 0x9a8aff : 0xffe2b0, 0, 30); light.position.set(0, 4, 5); g.add(light);
  world.updaters.push((A, F) => { shine.material.uniforms.uP.value = -0.3 + 1.6 * ((F.t * 0.22) % 1); wallM.emissiveIntensity = (fan ? 0.8 : 0.12) + 0.5 * (1 - A.day); whiteM.emissiveIntensity = (fan ? 0.8 : 0.08) + 0.7 * (1 - A.day); light.intensity = 40 * (1 - A.day) + 4; });
  world.signPos = [x, y0, z];
  installGate(world, H, imgs);
}

/** The entrance: an arch over the road at the gate, its board reading KOLEJ MARA KULIM between the two emblems. */
function installGate(world, H, imgs) {
  const fan = world.fan, g = new THREE.Group(), gy = H(GATEP.x, GATEP.z); g.position.set(GATEP.x, gy, GATEP.z); g.rotation.y = -Math.PI / 2;
  const c = document.createElement('canvas'); c.width = 2048; c.height = 420; const k = c.getContext('2d');
  const gr = k.createLinearGradient(0, 0, 0, 420); gr.addColorStop(0, fan ? '#2a1a6a' : '#b8202e'); gr.addColorStop(1, fan ? '#15103a' : '#7c141f'); k.fillStyle = gr; k.fillRect(0, 0, 2048, 420);
  k.strokeStyle = fan ? '#7affd8' : '#f2c14e'; k.lineWidth = 12; k.strokeRect(16, 16, 2016, 388);
  const emb = (cx, img) => { k.save(); k.translate(cx, 210); k.fillStyle = '#fff'; k.beginPath(); k.arc(0, 0, 160, 0, 6.2832); k.fill(); k.clip(); const f = Math.min(310 / img.width, 310 / img.height); k.drawImage(img, -img.width * f / 2, -img.height * f / 2, img.width * f, img.height * f); k.restore(); k.lineWidth = 8; k.strokeStyle = fan ? '#7affd8' : '#f2c14e'; k.beginPath(); k.arc(cx, 210, 160, 0, 6.2832); k.stroke(); };
  emb(200, imgs.mara); emb(1848, imgs.crest);
  k.fillStyle = '#fff'; k.textAlign = 'center'; k.textBaseline = 'middle'; k.shadowColor = fan ? '#7affd8' : '#ffffff'; k.shadowBlur = fan ? 22 : 8; k.font = '800 148px "Inter","Arial Black",sans-serif'; k.fillText('KOLEJ MARA KULIM', 1024, 220);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const stone = new THREE.MeshLambertMaterial({ color: fan ? 0x3a3a80 : 0xb9b2a4 }), accent = new THREE.MeshLambertMaterial({ color: fan ? 0x7affd8 : 0xc4202c, emissive: fan ? 0x105040 : 0x000000 });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8.2, 1.4), stone); p.position.set(sx * 7.6, 4.1, 0); p.castShadow = true; g.add(p); const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.9), accent); cap.position.set(sx * 7.6, 8.4, 0); g.add(cap); const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 2.0), stone); base.position.set(sx * 7.6, 0.4, 0); g.add(base); }
  const bm = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: fan ? 0.9 : 0.15, roughness: 0.6 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(14.6, 2.6, 0.5), [stone, stone, stone, stone, bm, stone]); board.position.set(0, 7.3, 0); board.castShadow = true; g.add(board);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.45, 0.9), accent); beam.position.set(0, 8.75, 0); g.add(beam);
  world.scene.add(g);
  world.updaters.push((A) => { bm.emissiveIntensity = (fan ? 0.9 : 0.15) + 0.6 * (1 - A.day); });
}
