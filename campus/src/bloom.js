// A light bloom for software GL: prefilter at 1/4 resolution, blur a 3-level mip chain, add back in one full-res pass.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const mat = (fs, uniforms) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });

const PRE = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh, uKnee;
vec3 prefilter(vec3 c){ float br = max(c.r, max(c.g, c.b)); float soft = clamp(br - uThresh + uKnee, 0.0, 2.0 * uKnee); soft = soft * soft / (4.0 * uKnee + 1e-5); float k = max(soft, br - uThresh) / max(br, 1e-5); return c * k; }
void main(){ vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb; gl_FragColor = vec4(prefilter(min(c * 0.25, vec3(24.0))), 1.0); }`;
const DOWN = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel;
void main(){ vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, -1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel * vec2(1.0, 1.0)).rgb; gl_FragColor = vec4(c * 0.25, 1.0); }`;
const BLUR = `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uDir;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270270; c += (texture2D(tSrc, vUv + uDir * 1.3846153846).rgb + texture2D(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162; c += (texture2D(tSrc, vUv + uDir * 3.2307692308).rgb + texture2D(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703; gl_FragColor = vec4(c, 1.0); }`;
const COMP = `varying vec2 vUv; uniform sampler2D tSrc, tB1, tB2, tB3; uniform float uStrength;
void main(){ vec3 c = texture2D(tSrc, vUv).rgb; vec3 b = texture2D(tB1, vUv).rgb * 0.5 + texture2D(tB2, vUv).rgb * 0.8 + texture2D(tB3, vUv).rgb * 1.0; gl_FragColor = vec4(c + b * uStrength * 0.55, 1.0); }`;

export class FastBloom {
  constructor(w, h) {
    this.strength = 0.5; this.threshold = 1.0; this.knee = 0.6; this.fsQuad = new FullScreenQuad(null);
    const opt = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.lv = [4, 8, 16].map((d) => ({ d, a: new THREE.WebGLRenderTarget(Math.ceil(w / d), Math.ceil(h / d), opt), b: new THREE.WebGLRenderTarget(Math.ceil(w / d), Math.ceil(h / d), opt) }));
    this.mPre = mat(PRE, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 1 }, uKnee: { value: 0.6 } });
    this.mDown = mat(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mBlur = mat(BLUR, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
        this.size = [w, h];
  }
  setSize(w, h) { this.size = [w, h]; for (const l of this.lv) { l.a.setSize(Math.ceil(w / l.d), Math.ceil(h / l.d)); l.b.setSize(Math.ceil(w / l.d), Math.ceil(h / l.d)); } }
  pass(r, mat, target) { this.fsQuad.material = mat; r.setRenderTarget(target); this.fsQuad.render(r); }
  /** Blur the bright parts of `tex` into three mip levels; returns their textures [1/4, 1/8, 1/16]. */
  run(renderer, tex, threshold = 0.9) {
    const [w, h] = this.size, L = this.lv;
    this.mPre.uniforms.tSrc.value = tex; this.mPre.uniforms.uTexel.value.set(1 / w, 1 / h); this.mPre.uniforms.uThresh.value = threshold; this.mPre.uniforms.uKnee.value = this.knee;
    this.pass(renderer, this.mPre, L[0].a);
    for (let i = 0; i < 3; i++) {
      const l = L[i];
      if (i > 0) { this.mDown.uniforms.tSrc.value = L[i - 1].a.texture; this.mDown.uniforms.uTexel.value.set(1 / (w / L[i - 1].d), 1 / (h / L[i - 1].d)); this.pass(renderer, this.mDown, l.a); }
      const tx = 1 / (w / l.d), ty = 1 / (h / l.d);
      this.mBlur.uniforms.tSrc.value = l.a.texture; this.mBlur.uniforms.uDir.value.set(tx, 0); this.pass(renderer, this.mBlur, l.b);
      this.mBlur.uniforms.tSrc.value = l.b.texture; this.mBlur.uniforms.uDir.value.set(0, ty); this.pass(renderer, this.mBlur, l.a);
    }
    return [L[0].a.texture, L[1].a.texture, L[2].a.texture];
  }
  dispose() { for (const l of this.lv) { l.a.dispose(); l.b.dispose(); } }
}
