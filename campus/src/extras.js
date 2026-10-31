import { installFx } from './fx.js';
import { installLife } from './life.js';
import { installStairs } from './stairs.js';
import { installSign } from './sign.js';
export async function installExtras(worlds, shared, log) {
  for (const w of Object.values(worlds)) { installFx(w, w.H); installLife(w, shared.osm, w.H); await installSign(w, w.H); await installStairs(w, shared.plan, log); }
  window.groundH = worlds.realistic.H; window.stairPlan = shared.plan;
  // a soft 'keep the camera above the roofs' field: building top (wall + roof) inside a footprint, fading to nothing 3 m outside it
  const w = worlds.realistic, wallM = {}; w.nodes.forEach((n) => { wallM[n.userData.osm] = n.userData.wall_m || 8; });
  const blds = w.pads.filter((p) => p.kind === 'building' || p.kind === 'water_tower').map((p) => ({ P: p.P, box: p.box, top: p.base + (wallM[p.osm] || 8) + 6.5 }));
  const inside = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const dist = (x, z, P) => { let d = 1e9; for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0; d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return d; };
  window.clearance = (x, z) => { let y = -1e9; for (const b of blds) { if (x < b.box[0] || x > b.box[2] || z < b.box[1] || z > b.box[3]) continue; const d = inside(x, z, b.P) ? 0 : dist(x, z, b.P); const k = 1 - Math.min(1, Math.max(0, d / 4)); if (k > 0) y = Math.max(y, b.top * k + (1 - k) * -1e9 * 0 + (k < 1 ? (window.groundH(x, z) + (b.top - window.groundH(x, z)) * k - b.top * k) : 0)); } return y; };
}

// debug/director helper: a camera relative to a stair: back = metres before the foot, side = lateral, up = above the foot, at = fraction of the flight to look at
window.stairCam = (id, back, side, up, at = 0.5, fov = 55) => {
  const S = window.stairPlan.find((p) => p.id === id), d = S.dir, l = [d[1], -d[0]], H = window.groundH;
  const px = S.base[0] - d[0] * back + l[0] * side, pz = S.base[1] - d[1] * back + l[1] * side;
  const tx = S.base[0] + d[0] * S.run * at, tz = S.base[1] + d[1] * S.run * at;
  return { p: [px, Math.max(H(px, pz), S.h0) + up, pz], t: [tx, S.h0 + S.rise * at + 1.2, tz], fov };
};
