// HealthWiz Kingdom (integration Phase 5): the prototype's js/avatar.js, for any of the avatars in assets/models/avatars/
// (Tom, and the two characters made by tools/blender_avatar.py; all 1.8 m tall with 'idle' and 'walk' clips), with imports
// from vendor/three and onRemove freeing the loop, the listener and the scene.
//
// The map avatar: Tom (assets/models/tom.glb, made by tools/blender_tom.py from the supplied character model), drawn on
// the MapLibre map through a Three.js custom layer, standing where the position source (js/locate.js) says you are.
// He walks toward each new position, turns to face the way he is going, and stands idle when you stop. He is drawn
// larger than life (about 90 pixels tall at any zoom, like a game avatar) so he can be seen; his size marks nothing.
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';

const TARGET_PX = 112, HEIGHT_M = 1.8; // on-screen height of the avatar; the model's own height (blender_tom.py)
const R = 6371008.8, D = Math.PI / 180;

/** opts: {ML, url, heightAt(lng, lat), terrainOn(), reduced(), mode(), onReady(), onError(e)} → a MapLibre custom layer. */
export function createAvatarLayer(opts) {
  let renderer, scene, camera, map, root = null, mixer = null, idle = null, walk = null, ring = null, shadow = null, key, rim;
  let pos = null, goal = null, heading = 0, headingGoal = 0, speed = 0, visible = false, raf = 0, last = 0, lastPaint = 0;

  function frame(t) { // advance the walk toward the goal; repaint the map about 30 times a second while he is shown
    raf = 0;
    if (!visible || !root) return;
    const dt = Math.max(.001, Math.min(.25, (t - (last || t - 16)) / 1000)); last = t;
    if (pos && goal) {
      const kx = R * D * Math.cos(pos.lat * D), dx = (goal.lng - pos.lng) * kx, dy = (goal.lat - pos.lat) * R * D, d = Math.hypot(dx, dy);
      if (opts.reduced() || d > 400) { pos = { ...goal }; speed = 0; }
      else if (d > .05) {
        // close the gap at walking pace, faster when far behind (GPS fixes arrive every second or so and can jump)
        const v = Math.min(d, Math.max(1.4, d * 1.2) * dt);
        pos = { lng: pos.lng + dx / d * v / kx, lat: pos.lat + dy / d * v / (R * D) };
        speed += ((v / dt) - speed) * Math.min(1, dt * 6);
        if (d > .6) headingGoal = Math.atan2(dx, dy) / D;
      } else speed += (0 - speed) * Math.min(1, dt * 5);
    }
    const dh = ((headingGoal - heading + 540) % 360) - 180; heading += dh * Math.min(1, dt * 7);
    if (mixer) {
      const w = opts.reduced() ? 0 : Math.max(0, Math.min(1, (speed - .15) / .5));
      walk.setEffectiveWeight(w); idle.setEffectiveWeight(1 - w);
      walk.setEffectiveTimeScale(Math.max(.75, Math.min(1.8, speed / 1.35)));
      mixer.update(opts.reduced() ? 0 : dt);
    }
    if (ring) { ring.rotation.z += dt * .6; ring.material.opacity = .55 + .25 * Math.sin(t / 400); }
    // each repaint redraws the whole map: about 30 a second while he walks, 12 while he stands (a slow breathing idle)
    const moving = speed > .15 || (pos && goal && (pos.lng !== goal.lng || pos.lat !== goal.lat));
    if (t - lastPaint > (moving ? 32 : 80)) { lastPaint = t; map && map.triggerRepaint(); }
    raf = requestAnimationFrame(frame);
  }
  const run = () => { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } };
  const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run(); };
  document.addEventListener('visibilitychange', vis);

  function styleFor(m) { // fantasy: moonlight and a gold rune ring at his feet; realistic: daylight and a soft shadow only
    const F = m === 'fantasy';
    key.color.set(F ? 0xe6ecff : 0xfff3e0); key.intensity = F ? 3.2 : 2.8;
    rim.color.set(F ? 0x8ff7ea : 0xffffff); rim.intensity = F ? 1.6 : .6;
    scene.userData.hemi.color.set(F ? 0xb9c6ff : 0xffffff); scene.userData.hemi.groundColor.set(F ? 0x1a2350 : 0x8a8478); scene.userData.hemi.intensity = F ? 2.4 : 1.4; // he stays readable at night: the scene around him is dark
    if (ring) ring.visible = F;
  }

  return {
    id: 'avatar', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      map = m;
      camera = new THREE.Camera(); scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false; renderer.setPixelRatio(1);
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
      const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.3); scene.userData.hemi = hemi;
      key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-1.2, 2.2, -.8); // from the north-west, like the buildings' moonlight
      rim = new THREE.DirectionalLight(0x8ff7ea, 1.2); rim.position.set(1.4, 1.2, 1.5);
      scene.add(hemi, key, rim);
      new GLTFLoader().load(opts.url, gltf => { try { setup(gltf); } catch (e) { root = null; opts.onError && opts.onError(e); } }, undefined, e => opts.onError && opts.onError(e));
      function setup(gltf) {
        const clip = n => gltf.animations.find(a => a.name.startsWith(n));
        if (!clip('idle') || !clip('walk')) throw new Error('the avatar model has no idle and walk clips');
        const group = new THREE.Group();
        const body = gltf.scene;
        body.traverse(o => {
          if (o.isMesh) { o.frustumCulled = false; [].concat(o.material).forEach(mt => { mt.metalness = 0; mt.roughness = Math.max(.7, mt.roughness); }); }
        });
        group.add(body);
        // a soft round shadow under him, and in fantasy a slowly turning gold ring
        const c = document.createElement('canvas'); c.width = c.height = 64;
        const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2; shadow.position.y = .01; shadow.frustumCulled = false; group.add(shadow);
        ring = new THREE.Mesh(new THREE.RingGeometry(.55, .62, 48, 1), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = .02; ring.frustumCulled = false; group.add(ring);
        scene.add(group); root = group;
        mixer = new THREE.AnimationMixer(body);
        idle = mixer.clipAction(clip('idle')); walk = mixer.clipAction(clip('walk'));
        idle.play(); walk.play(); walk.setEffectiveWeight(0);
        styleFor(opts.mode());
        opts.onReady && opts.onReady();
        run();
      }
    },
    render(gl, matrix) {
      if (!root || !visible || !pos) return;
      const z = map.getZoom(), mpp = 40075016.686 * Math.cos(pos.lat * D) / (512 * Math.pow(2, z));
      const k = Math.max(1, TARGET_PX * mpp / HEIGHT_M); // never smaller than life size
      const alt = opts.terrainOn() ? opts.heightAt(pos.lng, pos.lat) : 0;
      const mc = opts.ML.MercatorCoordinate.fromLngLat([pos.lng, pos.lat], alt), s = mc.meterInMercatorCoordinateUnits() * k;
      // glTF is y-up (x east, z south); the map is z-up mercator (y south). The model faces +z: turn it to the heading.
      const model = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)).multiply(new THREE.Matrix4().makeRotationY(Math.PI - heading * D));
      camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(model);
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.clearDepth(); // always drawn over the buildings, like a game avatar: he must never vanish behind a roof
      renderer.render(scene, camera);
    },
    onRemove() {
      visible = false; cancelAnimationFrame(raf); raf = 0; document.removeEventListener('visibilitychange', vis);
      if (mixer) mixer.stopAllAction();
      if (scene) scene.traverse(o => { if (o.geometry) o.geometry.dispose(); [].concat(o.material || []).forEach(mt => { if (mt.map) mt.map.dispose(); mt.dispose(); }); });
      renderer && renderer.dispose(); root = null; // the WebGL context is the map's
    },
    /** Move the avatar toward a new position. The first position, or one far away, is jumped to. */
    moveTo(lng, lat, jump) { goal = { lng, lat }; if (!pos || jump) { pos = { ...goal }; speed = 0; } run(); },
    show(on) { visible = on; if (on) run(); map && map.triggerRepaint(); },
    setMode(m) { if (root) styleFor(m); map && map.triggerRepaint(); },
    get ready() { return !!root; },
    get state() { return { pos, goal, heading, speed, visible, walking: !!walk && walk.getEffectiveWeight() > .5 }; }, // for testing
  };
}
