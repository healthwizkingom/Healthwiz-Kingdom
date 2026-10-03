// Inlines every <script src="js/..."> into one self-contained HTML file:
// dist/healthwiz-standalone.html (works offline, can be shared as a single file).
// Images in assets/img/ are embedded back as data URIs, like the original single-file build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let n = 0;
const out = html.replace(/<script src="(js\/[\w.-]+\.js)"><\/script>/g, (_, src) => {
  n++;
  // "</script" inside code would end the inline block early.
  const code = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>/* ${src} */\n${code}\n</script>`;
});
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };
let imgs = 0;
const outAll = out.replace(/assets\/img\/([\w-]+)\.(webp|png|jpg)/g, (_, n, e) => {
  imgs++;
  return `data:${MIME[e]};base64,` + fs.readFileSync(path.join(root, 'assets', 'img', `${n}.${e}`)).toString('base64');
});
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const dest = path.join(root, 'dist', 'healthwiz-standalone.html');
fs.writeFileSync(dest, outAll);
console.log(`Inlined ${n} scripts + ${imgs} images → ${path.relative(root, dest)} (${(outAll.length / 1024).toFixed(0)} KB)`);
