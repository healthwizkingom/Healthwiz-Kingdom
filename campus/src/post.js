// One full-screen pass does everything after the scene: transition against scene B, light shafts, bloom add, exposure,
// ACES tone mapping, sRGB, grade, vignette, grain. (Software GL pays per full-screen pass, so there is exactly one.)
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FS = `
varying vec2 vUv;
uniform sampler2D tA, tB, bA1, bA2, bA3, bB1, bB2, bB3, uNoise;
uniform int uMode; uniform float uMix, uAspect, uTime, uAmt;
uniform vec2 uCenter, uDir, uSun; uniform vec3 uGlow, uTint;
uniform float uBloomA, uBloomB, uExpA, uExpB, uShaft, uThresh;
uniform float uVig, uGrain, uCA, uSat, uContrast, uFade, uFrame;
uniform vec3 uLift, uGain, uGamma, uFadeCol;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float nz(vec2 p){ return texture2D(uNoise, p).g; }
vec3 bloomOf(sampler2D b1, sampler2D b2, sampler2D b3, vec2 uv){ return texture2D(b1, uv).rgb * 0.5 + texture2D(b2, uv).rgb * 0.8 + texture2D(b3, uv).rgb; }
vec3 blurT(sampler2D t, vec2 uv, vec2 dir, float amt){
  vec3 s = vec3(0.); float w = 0.; float j = hsh(uv * 917.0 + uTime) - 0.5; // per-pixel jitter turns banding into fine noise
  for (int i = 0; i < 20; i++) { float f = (float(i) + j) / 19.0 * 2.0 - 1.0; float k = 1.0 - abs(f) * 0.7; s += texture2D(t, uv + dir * f * amt).rgb * k; w += k; }
  return s / w;
}
const mat3 ACESIn = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
const mat3 ACESOut = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
vec3 RRT(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c, float e){ c *= e / 0.6; c = ACESIn * c; c = RRT(c); c = ACESOut * c; return clamp(c, 0.0, 1.0); }
vec3 srgb(vec3 v){ return mix(pow(v, vec3(0.41666)) * 1.055 - 0.055, v * 12.92, step(v, vec3(0.0031308))); }
void main(){
  vec2 uv = vUv;
  vec3 a, b = vec3(0.0), extra = vec3(0.0); float m = 0.0; vec3 bl;
  vec2 cc = uv - 0.5; float r2 = dot(cc * vec2(uAspect, 1.0), cc * vec2(uAspect, 1.0));
  if (uMode == 0) { a = texture2D(tA, uv).rgb; }
  else if (uMode == 1) { // portal: a ring grows from uCenter and reveals B
    vec2 p = (uv - uCenter) * vec2(uAspect, 1.0);
    float maxD = length(vec2(max(uCenter.x, 1.0 - uCenter.x) * uAspect, max(uCenter.y, 1.0 - uCenter.y))) + 0.1;
    float edge = uMix * maxD * 1.08;
    float wob = (nz(p * 0.5 + uTime * 0.03) - 0.5) * 0.07 * sin(uMix * 3.14159);
    float d = length(p) + wob;
    m = smoothstep(edge + 0.012, edge - 0.012, d);
    float ring = exp(-abs(d - edge) * 22.0) * sin(clamp(uMix, 0.0, 1.0) * 3.14159) * 2.2;
    vec2 refr = normalize(p + 1e-4) * ring * 0.012;
    a = texture2D(tA, uv + refr).rgb; b = texture2D(tB, uv - refr * 0.5).rgb; extra = uGlow * ring * 0.7;
  } else if (uMode == 2) { // sweep: a bright band travels across the frame along uDir
    float s = dot(uv - 0.5, uDir) * 0.8 + 0.5;
    float edge = mix(-0.15, 1.15, uMix);
    float n = (nz(uv * vec2(0.4, 1.2) + uTime * 0.05) - 0.5) * 0.06;
    m = smoothstep(edge + 0.02, edge - 0.02, s + n);
    float band = exp(-abs(s - edge) * 16.0) * sin(clamp(uMix, 0.0, 1.0) * 3.14159) * 2.5;
    a = texture2D(tA, uv).rgb; b = texture2D(tB, uv).rgb; extra = uGlow * band * 0.35;
  } else if (uMode == 3) { // flash: a white-hot dissolve
    a = texture2D(tA, uv).rgb; b = texture2D(tB, uv).rgb; m = smoothstep(0.2, 0.8, uMix);
    extra = uGlow * pow(sin(clamp(uMix, 0.0, 1.0) * 3.14159), 2.2) * 0.7;
  } else if (uMode == 4) { // whip: directional blur while a quick pan swaps A for B
    float amt = uAmt * sin(clamp(uMix, 0.0, 1.0) * 3.14159);
    a = blurT(tA, uv + uDir * uMix * 0.25, uDir, amt); b = blurT(tB, uv - uDir * (1.0 - uMix) * 0.25, uDir, amt); m = smoothstep(0.12, 0.88, uMix);
  } else { // 5: veil - a slow dissolve through drifting mist
    a = texture2D(tA, uv).rgb; b = texture2D(tB, uv).rgb;
    float n = nz(uv * 1.2 + uTime * 0.01) * 0.5 + nz(uv * 3.0 - uTime * 0.013) * 0.5;
    m = smoothstep(n - 0.15, n + 0.15, uMix * 1.3 - 0.15); extra = uGlow * sin(clamp(uMix, 0.0, 1.0) * 3.14159) * 0.15;
  }
  vec3 col = mix(a, b, m);
  bl = bloomOf(bA1, bA2, bA3, uv) * uBloomA;
  if (uMode > 0) bl = mix(bl, bloomOf(bB1, bB2, bB3, uv) * uBloomB, m);
  col += bl * 0.55 + extra;
  if (uShaft > 0.001) { // light shafts: smear the brightest parts of the frame toward the sun
    vec2 d = uSun - uv; float L = length(d); vec2 sv = d / 22.0 * 0.9; vec2 p = uv; float acc = 0.0, w = 1.0;
    for (int i = 0; i < 22; i++) { p += sv; float l = dot(texture2D(tA, p).rgb, vec3(0.3, 0.59, 0.11)); acc += smoothstep(uThresh, uThresh + 1.8, l) * w; w *= 0.93; }
    col += uTint * acc * (1.0 / 22.0) * uShaft * exp(-L * 1.6) * 2.4 * (1.0 - m);
  }
  // exposure + ACES + sRGB
  col = srgb(aces(col, mix(uExpA, uExpB, m)));
  // chromatic fringe, grade
  col = pow(max(col, 0.0), uGamma); col = col * uGain + uLift;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, uSat);
  col = (col - 0.5) * uContrast + 0.5;
  col *= 1.0 - uVig * smoothstep(0.12, 0.62, r2 * 1.55);
  float g = hsh(uv * 1000.0 + fract(uFrame * 0.137) * 91.7) - 0.5; col += g * uGrain * (0.7 + 0.6 * (1.0 - l));
  col += (hsh(uv * 713.0 + uTime) - 0.5) / 255.0;
  col = mix(col, uFadeCol, uFade);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

export function createUber(noise) {
  const U = {
    tA: { value: null }, tB: { value: null }, bA1: { value: null }, bA2: { value: null }, bA3: { value: null }, bB1: { value: null }, bB2: { value: null }, bB3: { value: null }, uNoise: { value: noise },
    uMode: { value: 0 }, uMix: { value: 0 }, uAspect: { value: 16 / 9 }, uTime: { value: 0 }, uAmt: { value: 0.05 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uDir: { value: new THREE.Vector2(1, 0) }, uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uGlow: { value: new THREE.Color(1, 0.8, 0.5) }, uTint: { value: new THREE.Color(1, 0.85, 0.6) }, uBloomA: { value: 0.5 }, uBloomB: { value: 0.5 }, uExpA: { value: 1 }, uExpB: { value: 1 }, uShaft: { value: 0 }, uThresh: { value: 1.2 },
    uVig: { value: 0.3 }, uGrain: { value: 0.03 }, uCA: { value: 0 }, uSat: { value: 1.05 }, uContrast: { value: 1.04 }, uFade: { value: 0 }, uFrame: { value: 0 },
    uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uFadeCol: { value: new THREE.Color(0, 0, 0) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, depthTest: false, depthWrite: false });
  const quad = new FullScreenQuad(mat);
  return { U, mat, draw(renderer) { renderer.setRenderTarget(null); quad.render(renderer); } };
}
