// Inlines every <script src="js/..."> into one self-contained HTML file:
// dist/healthwiz-standalone.html (works offline, can be shared as a single file).
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
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const dest = path.join(root, 'dist', 'healthwiz-standalone.html');
fs.writeFileSync(dest, out);
console.log(`Inlined ${n} scripts → ${path.relative(root, dest)} (${(out.length / 1024).toFixed(0)} KB)`);
