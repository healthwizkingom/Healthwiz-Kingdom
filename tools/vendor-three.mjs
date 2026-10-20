// Copies the pinned Three.js r169 (and the add-ons the Observatory's 3D preview uses) from the prototype into vendor/three/,
// rewriting each add-on's bare `from 'three'` import to a relative path. The app uses no import map (tests/00-fidelity:
// nothing may change before the first <script src=>), so a bare specifier could not be resolved in the browser.
//   node tools/vendor-three.mjs        (from the repository root; run again after updating the prototype's copy)
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'prototypes/campus-observatory/vendor/three', DST = 'vendor/three';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
let n = 0, r = 0;
for (const f of walk(SRC)) {
  const rel = path.relative(SRC, f), out = path.join(DST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  let s = fs.readFileSync(f);
  if (f.endsWith('.js') && !f.endsWith('three.module.min.js')) {
    const to = path.relative(path.dirname(rel), 'three.module.min.js').split(path.sep).join('/');
    const t = s.toString('utf8'), u = t.replace(/from\s*(['"])three\1/g, (_, q) => 'from ' + q + (to.startsWith('.') ? to : './' + to) + q);
    if (u !== t) r++;
    s = Buffer.from(u, 'utf8');
  }
  fs.writeFileSync(out, s); n++;
}
console.log('Copied ' + n + ' files to ' + DST + ' (' + r + ' imports of "three" made relative).');
