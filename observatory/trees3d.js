// HealthWiz Kingdom: the map's trees as 3D oaks (owner's request, 2026-10-23: "replace the 2D trees on campus map with
// these models that is fixed in size"), in both looks. Not part of the prototype.
//
// The three oaks of assets/models/campus-trees.glb (tools/blender_campus_trees.py, from the owner's oak pack: each mesh
// 1 unit tall, trunk base at its origin) are drawn at the decorative tree positions of ./deco.js through one Three.js
// custom layer that shares the map's WebGL context and depth buffer, so buildings hide the trees behind them.
// Every tree has the same fixed height (TREE_M, real metres, so it grows and shrinks with the zoom like the buildings);
// only its turn about its trunk and which of the three oaks it is vary. One InstancedMesh per oak and material: six
// draw calls for ~900 trees. Scenery, not data: they stand on the terrain when it is on.
import * as THREE from '../vendor/three/three.module.min.js';
import { GLTFLoader } from '../vendor/three/addons/loaders/GLTFLoader.js';

export const TREE_M = 9; // every tree's height (m): decoration, not a survey of the campus's trees

/** opts: {ML, url, points: [[lng, lat]], heightAt(lng, lat), terrainOn(), night(), onReady(), onError(e)} → a MapLibre custom layer. */
export function createTreeLayer(opts) {
  let renderer, scene, camera, map = null, meshes = [], loaded = false, hemi, key;
  const model = new THREE.Matrix4(), pts = opts.points;
  const n = pts.length || 1, lng0 = pts.reduce((t, p) => t + p[0], 0) / n, lat0 = pts.reduce((t, p) => t + p[1], 0) / n;
  const k = Math.PI / 180, R0 = 6371008.8, kx = k * R0 * Math.cos(lat0 * k), ky = k * R0;
  // a fixed pattern from the position: the same oak and turn every visit
  const pick = ([lng, lat]) => { const h = Math.abs(Math.sin(lng * 12.9898e3 + lat * 78.233e3) * 43758.5453); return { v: Math.floor((h % 1) * 3), a: (h * 7.31 % 1) * Math.PI * 2 }; };
  let heights = null; // the terrain under each tree, worked out once
  function place() {
    const on = opts.terrainOn();
    if (on && !heights) heights = pts.map(p => opts.heightAt(p[0], p[1]));
    const mc = opts.ML.MercatorCoordinate.fromLngLat([lng0, lat0], 0), u = mc.meterInMercatorCoordinateUnits();
    // metres east, up and south of the trees' middle (glTF axes) to mercator units, as ./stops3d.js does
    model.makeTranslation(mc.x, mc.y, mc.z).multiply(new THREE.Matrix4().makeScale(u, -u, u)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(TREE_M, TREE_M, TREE_M), p = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
    const count = [0, 0, 0];
    pts.forEach((pt, i) => {
      const { v, a } = pick(pt);
      p.set((pt[0] - lng0) * kx, on ? heights[i] : 0, -(pt[1] - lat0) * ky);
      m.compose(p, q.setFromAxisAngle(Y, a), s);
      for (const im of meshes) if (im.userData.v === v) im.setMatrixAt(count[v], m);
      count[v]++;
    });
    for (const im of meshes) { im.count = count[im.userData.v]; im.instanceMatrix.needsUpdate = true; }
  }
  function tint(night) {
    // night: moonlit, but bright enough to read on Fantasy's dark ground
    if (hemi) { hemi.intensity = night ? 2.2 : 2.0; hemi.color.set(night ? 0xb4c4ff : 0xffffff); }
    if (key) { key.intensity = night ? 1.8 : 2.4; key.color.set(night ? 0xd8e0ff : 0xfff4e2); }
  }
  return {
    id: 'trees3d', type: 'custom', renderingMode: '3d',
    onAdd(m, gl) {
      map = m;
      camera = new THREE.Camera(); scene = new THREE.Scene();
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false; renderer.setPixelRatio(1);
      hemi = new THREE.HemisphereLight(0xffffff, 0x3a4a2a, 2.0); scene.add(hemi);
      key = new THREE.DirectionalLight(0xfff4e2, 2.4); key.position.set(-.42, .82, .38); scene.add(key); // the map's sun, from the south-west
      tint(opts.night());
      new GLTFLoader().load(opts.url, gltf => {
        if (!map) return;
        const oaks = ['oak1', 'oak2', 'oak3'].map(nm => gltf.scene.getObjectByName(nm));
        if (oaks.some(o => !o)) { opts.onError && opts.onError(new Error('campus-trees.glb has no oak1..oak3')); return; }
        oaks.forEach((o, v) => {
          const parts = o.isMesh ? [o] : o.children.filter(c => c.isMesh);
          for (const part of parts) {
            const mt = part.material;
            if (mt.map) { mt.map.magFilter = THREE.NearestFilter; }
            // a low cut-off: the smaller mipmaps average the leaves' alpha down, and at .5 the crowns thinned out at a distance
            if (/leaves/.test(mt.name || '')) { mt.alphaTest = .2; mt.transparent = false; mt.side = THREE.DoubleSide; }
            mt.metalness = 0; mt.roughness = 1;
            const im = new THREE.InstancedMesh(part.geometry, mt, pts.length);
            im.userData.v = v; im.frustumCulled = false; meshes.push(im); scene.add(im);
          }
        });
        place(); loaded = true; m.triggerRepaint();
        opts.onReady && opts.onReady();
      }, undefined, e => opts.onError && opts.onError(e));
    },
    render(gl, matrix) {
      if (!loaded) return;
      camera.projectionMatrix.fromArray(matrix).multiply(model);
      renderer.resetState();
      renderer.setViewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.render(scene, camera);
    },
    onRemove() {
      for (const im of meshes) { im.geometry.dispose(); if (im.material.map) im.material.map.dispose(); im.material.dispose(); im.dispose(); }
      meshes = []; renderer && renderer.dispose(); loaded = false; map = null;
    },
    /** The terrain was switched on or off. */
    replace() { if (loaded) { place(); map && map.triggerRepaint(); } },
    night(on) { tint(on); map && map.triggerRepaint(); },
    get ready() { return loaded; },
    get count() { return loaded ? pts.length : 0; },
  };
}
