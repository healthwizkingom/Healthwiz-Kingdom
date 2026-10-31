// Atmosphere: time-of-day palettes (realistic and fantasy), weather modifiers, and the sky dome shader.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, RAD } from './common.js';
import { noiseTex, starTex } from './noise.js';

const C = (hex) => new THREE.Color(hex); // sRGB hex -> linear
// time of day (hours) keyframes; 0 and 24 are identical so the loop closes
// zen, hor, grd: sky zenith / horizon / below-horizon haze; sun, sunI: key light colour & strength; moon, moonI: night key;
// hs, hg, hI: hemisphere sky / ground / strength; exp: tone-map exposure; star: star visibility; fog: fog colour
const REAL = [
  [0.0, { zen: '#030716', hor: '#0b1738', grd: '#070d20', sun: '#ffd0a0', sunI: 0.0, moon: '#a9bdff', moonI: 0.62, hs: '#34498c', hg: '#0b1226', hI: 0.62, exp: 1.2, star: 1.0, bloom: 0.55 }],
  [4.9, { zen: '#030716', hor: '#0e1a3e', grd: '#070d20', sun: '#ffd0a0', sunI: 0.0, moon: '#a9bdff', moonI: 0.6, hs: '#34498c', hg: '#0b1226', hI: 0.6, exp: 1.2, star: 0.95, bloom: 0.55 }],
  [5.7, { zen: '#1a2a6c', hor: '#8a6fa4', grd: '#2e2c52', sun: '#ffb0a0', sunI: 0.45, moon: '#a9bdff', moonI: 0.5, hs: '#5a73b8', hg: '#2a2a40', hI: 0.75, exp: 1.2, star: 0.3, bloom: 0.6 }],
  [6.35, { zen: '#3f70c4', hor: '#ffa56e', grd: '#a08070', sun: '#ffa868', sunI: 1.6, moon: '#a9bdff', moonI: 0.3, hs: '#9ab6ea', hg: '#6c5c3c', hI: 0.95, exp: 1.12, star: 0.0, bloom: 0.7 }],
  [7.5, { zen: '#4a8ae2', hor: '#ffd6a2', grd: '#b9b59c', sun: '#ffddb0', sunI: 2.9, moon: '#a9bdff', moonI: 0.2, hs: '#bfd9ff', hg: '#7a8a3a', hI: 1.15, exp: 1.05, star: 0, bloom: 0.5 }],
  [10.0, { zen: '#3a82e8', hor: '#cfe4f8', grd: '#c8d4d8', sun: '#fff2de', sunI: 3.5, moon: '#a9bdff', moonI: 0.2, hs: '#cfe4ff', hg: '#7a8f3a', hI: 1.3, exp: 1.0, star: 0, bloom: 0.4 }],
  [13.0, { zen: '#2f78e2', hor: '#bcdcf6', grd: '#c4d2d8', sun: '#fffaf0', sunI: 3.8, moon: '#a9bdff', moonI: 0.2, hs: '#d2e6ff', hg: '#7b9040', hI: 1.35, exp: 0.98, star: 0, bloom: 0.38 }],
  [16.2, { zen: '#3f82dc', hor: '#ffe2b0', grd: '#c8c0a0', sun: '#ffd8a0', sunI: 3.1, moon: '#a9bdff', moonI: 0.2, hs: '#c8dcff', hg: '#847c3a', hI: 1.15, exp: 1.02, star: 0, bloom: 0.5 }],
  [17.8, { zen: '#3a58aa', hor: '#ff8c58', grd: '#a07060', sun: '#ff9055', sunI: 1.8, moon: '#a9bdff', moonI: 0.3, hs: '#9aa0d2', hg: '#5a4a3a', hI: 0.88, exp: 1.1, star: 0, bloom: 0.7 }],
  [18.7, { zen: '#232e70', hor: '#d4607a', grd: '#5a4064', sun: '#ff7a70', sunI: 0.55, moon: '#a9bdff', moonI: 0.45, hs: '#52589c', hg: '#2a2a3a', hI: 0.72, exp: 1.18, star: 0.15, bloom: 0.75 }],
  [19.6, { zen: '#0e1648', hor: '#4e3a84', grd: '#20203e', sun: '#9ab0ff', sunI: 0.0, moon: '#a9bdff', moonI: 0.58, hs: '#3a4a8c', hg: '#141830', hI: 0.62, exp: 1.2, star: 0.7, bloom: 0.6 }],
  [21.0, { zen: '#030716', hor: '#0b1738', grd: '#070d20', sun: '#ffd0a0', sunI: 0.0, moon: '#a9bdff', moonI: 0.62, hs: '#34498c', hg: '#0b1226', hI: 0.62, exp: 1.2, star: 1.0, bloom: 0.55 }],
  [24.0, { zen: '#030716', hor: '#0b1738', grd: '#070d20', sun: '#ffd0a0', sunI: 0.0, moon: '#a9bdff', moonI: 0.62, hs: '#34498c', hg: '#0b1226', hI: 0.62, exp: 1.2, star: 1.0, bloom: 0.55 }],
];
// fantasy: a storybook dream of the same hours: pink-gold days, violet dusks, deep teal-blue glowing nights
const FANT = [
  [0.0, { zen: '#04062a', hor: '#1a2a96', grd: '#0a1048', sun: '#ffd8b0', sunI: 0.0, moon: '#b8c8ff', moonI: 0.85, hs: '#4a5cc8', hg: '#10163a', hI: 0.9, exp: 1.25, star: 1.0, bloom: 0.9 }],
  [4.9, { zen: '#05082e', hor: '#1c2c9c', grd: '#0a1048', sun: '#ffd8b0', sunI: 0.0, moon: '#b8c8ff', moonI: 0.85, hs: '#4a5cc8', hg: '#10163a', hI: 0.9, exp: 1.25, star: 1.0, bloom: 0.9 }],
  [5.7, { zen: '#2a2a90', hor: '#d070b8', grd: '#3a2a70', sun: '#ffa0d0', sunI: 0.6, moon: '#b8c8ff', moonI: 0.7, hs: '#7a78d8', hg: '#30285a', hI: 1.0, exp: 1.2, star: 0.4, bloom: 0.95 }],
  [6.35, { zen: '#4a6cf0', hor: '#ffa6c8', grd: '#c090b0', sun: '#ffb090', sunI: 1.8, moon: '#b8c8ff', moonI: 0.4, hs: '#b0a8f0', hg: '#6a5a8a', hI: 1.1, exp: 1.12, star: 0, bloom: 1.0 }],
  [7.5, { zen: '#4c80ff', hor: '#ffd2e8', grd: '#c0c0e0', sun: '#ffe0c0', sunI: 3.0, moon: '#b8c8ff', moonI: 0.3, hs: '#c0d0ff', hg: '#6a9a70', hI: 1.3, exp: 1.05, star: 0, bloom: 0.8 }],
  [10.0, { zen: '#3a78ff', hor: '#d8e8ff', grd: '#c8d8f0', sun: '#fff0d8', sunI: 3.4, moon: '#b8c8ff', moonI: 0.3, hs: '#d0e0ff', hg: '#5aa08a', hI: 1.4, exp: 1.0, star: 0, bloom: 0.7 }],
  [13.0, { zen: '#2a6cff', hor: '#c8e0ff', grd: '#c0d8f0', sun: '#fff8ec', sunI: 3.7, moon: '#b8c8ff', moonI: 0.3, hs: '#d8e8ff', hg: '#58a890', hI: 1.45, exp: 0.98, star: 0, bloom: 0.65 }],
  [16.2, { zen: '#4278f0', hor: '#ffd0c0', grd: '#d8b8c8', sun: '#ffd0a0', sunI: 3.1, moon: '#b8c8ff', moonI: 0.3, hs: '#d0d8ff', hg: '#7a8a8a', hI: 1.3, exp: 1.02, star: 0, bloom: 0.85 }],
  [17.8, { zen: '#4a3ab0', hor: '#ff7ab0', grd: '#a06090', sun: '#ff9070', sunI: 1.9, moon: '#b8c8ff', moonI: 0.4, hs: '#a898e8', hg: '#5a3a6a', hI: 1.0, exp: 1.1, star: 0.1, bloom: 1.0 }],
  [18.7, { zen: '#2a1c8a', hor: '#e0509a', grd: '#5a2e78', sun: '#ff70a8', sunI: 0.7, moon: '#b8c8ff', moonI: 0.6, hs: '#6a5ac0', hg: '#2a1c48', hI: 0.9, exp: 1.2, star: 0.35, bloom: 1.05 }],
  [19.6, { zen: '#0c1060', hor: '#5a3aa8', grd: '#201a58', sun: '#a0a8ff', sunI: 0.0, moon: '#b8c8ff', moonI: 0.8, hs: '#4a56c4', hg: '#161a48', hI: 0.9, exp: 1.25, star: 0.85, bloom: 0.95 }],
  [21.0, { zen: '#04062a', hor: '#1a2a96', grd: '#0a1048', sun: '#ffd8b0', sunI: 0.0, moon: '#b8c8ff', moonI: 0.85, hs: '#4a5cc8', hg: '#10163a', hI: 0.9, exp: 1.25, star: 1.0, bloom: 0.9 }],
  [24.0, { zen: '#04062a', hor: '#1a2a96', grd: '#0a1048', sun: '#ffd8b0', sunI: 0.0, moon: '#b8c8ff', moonI: 0.85, hs: '#4a5cc8', hg: '#10163a', hI: 0.9, exp: 1.25, star: 1.0, bloom: 0.9 }],
];

const CC = new Map();
const col = (h) => { let c = CC.get(h); if (!c) { c = C(h); CC.set(h, c); } return c; };
const COLORS = ['zen', 'hor', 'grd', 'sun', 'moon', 'hs', 'hg'];

function samplePalette(tab, tod) {
  tod = ((tod % 24) + 24) % 24;
  let i = 0; while (i < tab.length - 2 && tod > tab[i + 1][0]) i++;
  const [t0, a] = tab[i], [t1, b] = tab[i + 1], u = smoothstep(t0, t1, tod);
  const o = {};
  for (const k of COLORS) o[k] = col(a[k]).clone().lerp(col(b[k]), u);
  for (const k of ['sunI', 'moonI', 'hI', 'exp', 'star', 'bloom']) o[k] = lerp(a[k], b[k], u);
  return o;
}

/** direction toward the sun for a time of day (hours), glTF axes (x east, y up, z south) */
export function bodyDir(h, maxAlt = 72) {
  const a = Math.PI * (h - 6) / 12; // 0 at sunrise (east), pi at sunset (west)
  const alt = maxAlt * RAD * Math.sin(a);
  const v = new THREE.Vector3(Math.cos(a) * Math.cos(Math.abs(alt) * 0.35 + 0.2), Math.sin(alt) * 1.0, 0.34 * Math.sin(a) + 0.02);
  return v.normalize();
}
export const sunDirAt = (tod) => { const v = bodyDir(tod, 70); return v; };
export const moonDirAt = (tod) => { const v = bodyDir(tod - 12 + 0.8, 58); v.x *= -1; if (v.y < 0.12) v.y = 0.12 + 0.2 * (0.12 - v.y); return v.normalize(); };

const W0 = { cloud: 0, rain: 0, fog: 0, haze: 0, storm: 0, wet: 0, flash: 0 };

/** Everything the lights, sky and fog need for (look, tod, weather). */
export function atmosphere(look, tod, W = W0) {
  const fan = look === 'fantasy', P = samplePalette(fan ? FANT : REAL, tod);
  const sd = sunDirAt(tod), md = moonDirAt(tod);
  const ws = smoothstep(-0.12, 0.05, sd.y); // sun -> moon hand-over around the horizon
  const day = clamp(sd.y * 4, 0, 1);
  const grey = new THREE.Color(fan ? '#6a7098' : '#7d868f');
  const cl = clamp(W.cloud), rn = clamp(W.rain), fg = clamp(W.fog), hz = clamp(W.haze), st = clamp(W.storm);
  const lum = (c) => c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
  const over = (c, k, dark = 1) => { const g = grey.clone().multiplyScalar(Math.max(0.05, lum(c) * 1.2 + 0.02) * dark); return c.clone().lerp(g, k); };
  let zen = over(P.zen, cl * 0.75 + rn * 0.15, 1 - rn * 0.35 - st * 0.4), hor = over(P.hor, cl * 0.6 + rn * 0.2, 1 - rn * 0.25 - st * 0.35), grd = over(P.grd, cl * 0.5, 1 - rn * 0.3);
  const fogC = hor.clone().lerp(new THREE.Color(fan ? '#7a86c0' : '#c9d0d4').multiplyScalar(Math.max(0.12, day * 0.9 + 0.1)), 0.6);
  zen.lerp(fogC.clone().multiplyScalar(0.92), fg * 0.85); hor.lerp(fogC, fg); grd.lerp(fogC, fg);
  const hazeC = new THREE.Color(fan ? '#ffc890' : '#f2c88a').multiplyScalar(Math.max(0.15, day));
  hor.lerp(hazeC, hz * 0.55); zen.lerp(hazeC.clone().multiplyScalar(0.7), hz * 0.25);
  // key light
  const sunI = P.sunI * (1 - cl * 0.82 - fg * 0.55 - rn * 0.1) * (1 - hz * 0.22), moonI = P.moonI * (1 - cl * 0.45 - fg * 0.3);
  const keyI = lerp(moonI, sunI, ws), keyDir = md.clone().lerp(sd, ws).normalize(), keyCol = P.moon.clone().lerp(P.sun, ws);
  if (hz > 0) keyCol.lerp(new THREE.Color('#ffc884'), hz * 0.5 * ws);
  const hemiI = P.hI * (1 + cl * 0.3 + fg * 0.35) * (1 - rn * 0.12) * (1 - st * 0.2);
  const hemiS = P.hs.clone().lerp(fogC, fg * 0.6 + cl * 0.2), hemiG = P.hg.clone().lerp(fogC.clone().multiplyScalar(0.5), fg * 0.4);
  const fogDensity = (fan ? 0.00042 : 0.00036) + fg * (0.0042 + 0.0012 * (1 - day)) + hz * 0.0014 + rn * 0.0009 + st * 0.0006;
  const lamps = clamp(1 - day * 1.6 + rn * 0.5 * (1 - day) + fg * 0.5 + (fan ? 0.35 : 0), 0, 1) * (fan ? 1 : 1);
  return {
    zen, hor, grd, fog: fogC, fogDensity, sunDir: sd, moonDir: md, keyDir, keyCol, keyI, hemiS, hemiG, hemiI,
    exposure: P.exp * (1 + rn * 0.04), star: P.star * (1 - cl) * (1 - fg), bloom: P.bloom * (1 + fg * 0.25 + hz * 0.3 + st * 0.1), day, lamps, sunHeight: sd.y, sunCol: P.sun, moonCol: P.moon,
    cloud: cl, storm: st, flash: W.flash || 0, ws,
    aurora: fan ? clamp(1 - day * 1.4) * (1 - cl * 0.7) * (1 - fg) : 0,
    haze: hz,
  };
}

// ---------------------------------------------------------------- the sky dome
const VERT = `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.99999; }`;
const FRAG = `
varying vec3 vDir;
uniform vec3 uZen, uHor, uGrd, uSunDir, uSunCol, uMoonDir, uMoonCol, uCloudLit, uCloudDark, uHill;
uniform float uTime, uStar, uCloud, uStorm, uFlash, uAurora, uFan, uFog, uHaze;
uniform sampler2D uNoise, uStars;
float cdens(vec2 p, float cov){ float n = texture2D(uNoise, p).a * 0.72 + texture2D(uNoise, p * 3.3 + 0.37).a * 0.28; return smoothstep(1.0 - cov*0.8 - 0.2, 1.04 - cov*0.35, n + cov*0.08); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uZen, pow(clamp(h, 0., 1.), 0.42));
  col = mix(col, uGrd, smoothstep(0.02, -0.18, h));
  float sd = max(dot(d, uSunDir), 0.0);
  float sunUp = smoothstep(-0.12, 0.06, uSunDir.y);
  vec3 glow = uSunCol * (pow(sd, 900.) * 30. + pow(sd, 60.) * 0.9 + pow(sd, 8.) * 0.22 + pow(sd,2.)*0.05) * sunUp;
  col += glow * (1.0 - uCloud * 0.7) * (1.0 - uFog * 0.7);
  float md = max(dot(d, uMoonDir), 0.0);
  float moonUp = smoothstep(-0.05, 0.1, uMoonDir.y) * (1.0 - sunUp);
  float disc = smoothstep(0.99935 - uFan*0.0004, 0.9995 - uFan*0.0004, md);
  col += uMoonCol * (disc * 3.0 + pow(md, 90.) * 0.5 + pow(md, 14.) * 0.08 + pow(md,3.)*0.015) * moonUp * (1.0 - uCloud*0.6);
  float az = atan(d.x, d.z);
  if (uStar > 0.01 && h > 0.0) {
    vec2 sp = vec2(az * 0.15915 + 0.5, 0.5 + asin(clamp(d.y, 0., 1.)) * 0.31831);
    vec4 s = texture2D(uStars, sp);
    vec3 sc = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.82, 0.65), s.g);
    if (uFan > 0.5) sc = mix(sc, vec3(0.9, 0.7, 1.0), step(0.5, s.g));
    float tw = 0.65 + 0.35 * sin(uTime * (1.2 + s.g * 3.0) + s.g * 40.0);
    col += sc * s.r * tw * uStar * smoothstep(0.0, 0.2, h) * 0.85;
  }
  if (uAurora > 0.01) {
    float band = smoothstep(0.12, 0.35, h) * smoothstep(0.85, 0.4, h);
    vec2 q = vec2(az * 0.3183 * 2.0 + uTime * 0.004, h * 0.8);
    float c1 = texture2D(uNoise, vec2(az * 0.1592 * 3.0 + uTime * 0.006, 0.31)).g;
    float c2 = texture2D(uNoise, vec2(az * 0.1592 * 14.0 + uTime * 0.02, h * 1.6 - uTime * 0.01)).b;
    float curtain = pow(smoothstep(0.35, 0.9, c1), 1.6) * (0.4 + 0.9 * c2);
    vec3 ac = mix(vec3(0.15, 1.0, 0.65), vec3(0.75, 0.25, 1.0), smoothstep(0.25, 0.7, h + 0.2 * (c1 - 0.5)));
    col += ac * curtain * band * uAurora * 0.7;
  }
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float rd = texture2D(uNoise, vec2(az * 0.15915 * (2.0 + fi), fi * 0.27 + 0.06)).g;
    float ridge = (0.006 + 0.042 * rd) * (1.0 - fi * 0.2) - 0.006 * fi;
    float m = smoothstep(ridge + 0.002, ridge - 0.002, h) * step(-0.02, h);
    vec3 hc = mix(uHill, uHor, 0.55 + fi * 0.14 + uFog * 0.35 + uHaze * 0.15);
    col = mix(col, hc, m * (0.92 - fi * 0.1));
  }
  float cov = clamp(uCloud, 0., 1.);
  if (h > 0.015 && cov > 0.02) {
    vec2 uv = d.xz / (h * 0.9 + 0.12) * 0.16 + vec2(uTime * 0.0012, uTime * 0.0006);
    float dn = cdens(uv, cov);
    vec2 sh = normalize(uSunDir.xz + 0.0001) * 0.018;
    float dn2 = cdens(uv + sh, cov);
    float lit = clamp(0.55 + (dn - dn2) * 5.0, 0., 1.);
    vec3 cc = mix(uCloudDark, uCloudLit, lit);
    cc += uSunCol * pow(sd, 6.) * 0.5 * (1.0 - uStorm) * sunUp;
    float fade = smoothstep(0.015, 0.2, h);
    col = mix(col, cc, dn * fade * (0.55 + 0.45 * cov));
    if (uFlash > 0.0) col += vec3(0.75, 0.85, 1.0) * uFlash * (0.4 + 0.9 * dn) * smoothstep(0.0, 0.4, h);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSky(look) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false,
    uniforms: {
      uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGrd: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() },
      uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonCol: { value: new THREE.Color() }, uCloudLit: { value: new THREE.Color() }, uCloudDark: { value: new THREE.Color() },
      uTime: { value: 0 }, uStar: { value: 0 }, uCloud: { value: 0 }, uStorm: { value: 0 }, uFlash: { value: 0 }, uAurora: { value: 0 }, uFan: { value: look === 'fantasy' ? 1 : 0 },       uNoise: { value: noiseTex() }, uStars: { value: starTex() }, uFog: { value: 0 }, uHaze: { value: 0 }, uHill: { value: new THREE.Color(look === 'fantasy' ? '#1c2a6a' : '#3c5a4a') },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 32), mat);
  mesh.frustumCulled = false; mesh.renderOrder = 100;
  mesh.update = (A, t, camPos) => {
    const u = mat.uniforms;
    u.uZen.value.copy(A.zen); u.uHor.value.copy(A.hor); u.uGrd.value.copy(A.grd); u.uSunDir.value.copy(A.sunDir); u.uSunCol.value.copy(A.sunCol); u.uMoonDir.value.copy(A.moonDir); u.uMoonCol.value.copy(A.moonCol);
    u.uTime.value = t; u.uStar.value = A.star; u.uCloud.value = A.cloud; u.uStorm.value = A.storm; u.uFlash.value = A.flash; u.uAurora.value = A.aurora; u.uFog.value = clamp((A.fogDensity - 0.0004) / 0.004); u.uHaze.value = A.haze;
    const day = A.day;
    u.uCloudLit.value.copy(A.hor).lerp(A.sunCol, 0.4).multiplyScalar(0.5 + 0.7 * day + 0.2);
    u.uCloudDark.value.copy(A.zen).lerp(A.grd, 0.5).multiplyScalar(0.55 * (0.3 + day) * (1 - A.storm * 0.5) + 0.04);
    u.uHill.value.copy(look === 'fantasy' ? new THREE.Color('#2a2a8a') : new THREE.Color('#3e5c48')).multiplyScalar(0.25 + 0.75 * day * (1 - A.cloud * 0.4) + 0.05);
    mesh.position.copy(camPos);
  };
  return mesh;
}
