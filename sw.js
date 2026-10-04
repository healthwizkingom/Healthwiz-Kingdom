/* HealthWiz Kingdom service worker (master prompt §73–74, §97 step 21). Registered by js/v6-pwa.js,
   only when the site is served over https (or http://localhost), never from a file or the standalone build.

   Strategy: NETWORK FIRST for the app's own files, so an online visit always gets the latest version (there is no
   build step that could stamp a version here). Every good response refreshes the offline copy. When the network
   fails, or takes longer than WAIT ms, the cached copy is used. Install pre-caches the whole app shell, so the app
   opens offline even if some pages were never visited.
   Google Fonts: stale-while-revalidate (the app falls back to system fonts until the font has been cached once).
   Everything else (the Wizard's Counsel AI request, the Supabase cloud save, other sites) goes straight to the network and is never cached.
   Saved health data is in localStorage and never passes through here.

   Keep PRECACHE in sync with index.html and assets/: tests/20-pwa.test.mjs fails when a file is missing. */
const CACHE = 'hwk-shell-v2', FONTS = 'hwk-fonts-v1', WAIT = 4000;
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest',
  'js/hw-01-menu-data.js', 'js/v6-schema.js', 'js/hw-02-core.js', 'js/hw-03-part.js', 'js/hw-04-part.js',
  'js/hw-05-v5-4-module.js', 'js/hw-06-v5-3-health-module.js', 'js/v6-events.js', 'js/v6-ui.js', 'js/v6-motion.js',
  'js/v6-particles.js', 'js/v6-insights.js', 'js/v6-quests.js', 'js/v6-streaks.js', 'js/v6-xp.js', 'js/v6-kingdom.js',
  'js/v6-medius.js', 'js/v6-charts.js', 'js/v6-world.js', 'js/v6-title.js', 'js/v6-games.js', 'js/v6-water.js',
  'js/v6-food.js', 'js/v6-trail.js', 'js/v6-grove.js', 'js/v6-night.js', 'js/v6-gps.js', 'js/v6-pwa.js',
  'js/v6-cloud.js', 'js/v6-board.js', 'js/v6-running.js', 'js/v6-safety.js', 'js/hw-07-boot.js',
  'assets/img/avatar-kg.webp', 'assets/img/avatar-kgf.webp', 'assets/img/avatar-kn.webp', 'assets/img/avatar-knf.webp',
  'assets/img/avatar-sk.webp', 'assets/img/avatar-wz.webp', 'assets/img/avatar-wzf.webp', 'assets/img/bedimg.jpg',
  'assets/img/kn.webp', 'assets/img/knight-kbd.webp', 'assets/img/knight-kcp.webp', 'assets/img/knight-khr.webp',
  'assets/img/orc.webp', 'assets/img/study.jpg', 'assets/img/wiz.webp',
  'assets/icons/icon-32.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png', 'assets/icons/apple-touch-icon.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  // cache: 'reload' skips the HTTP cache, so the offline copy is the current deploy
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('hwk-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
  if (e.data === 'hw:status') caches.open(CACHE).then(c => c.keys()).then(k => e.source && e.source.postMessage({ type: 'hw:status', cached: k.length, expected: PRECACHE.length }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) return e.respondWith(networkFirst(req, e));
  if (FONT_HOSTS.includes(url.hostname)) return e.respondWith(staleWhileRevalidate(req, e));
  // anything else: the browser handles it, never cached
});

async function fromCache(req) {
  const c = await caches.open(CACHE);
  return (await c.match(req, { ignoreSearch: req.mode === 'navigate' })) || (req.mode === 'navigate' ? (await c.match('index.html')) || c.match('./') : undefined);
}

function networkFirst(req, e) {
  const net = fetch(req).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then(c => c.put(req, copy))); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  return new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r) { done = true; resolve(r); } };
    const fallback = () => fromCache(req).then(r => { if (r) finish(r); return r; });
    // slow network: answer from the cache, let the fetch finish in the background to refresh it
    const t = setTimeout(fallback, WAIT);
    net.then(res => { clearTimeout(t); finish(res); })
      .catch(() => { clearTimeout(t); fallback().then(r => finish(r || offlinePage(req))); });
  });
}

async function staleWhileRevalidate(req, e) {
  const c = await caches.open(FONTS);
  const hit = await c.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') e.waitUntil(c.put(req, res.clone())); return res; });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  // no copy yet and offline: an empty stylesheet/font, so the page falls back to its system fonts quietly
  return net.catch(() => new Response('', { status: 200, headers: { 'Content-Type': req.destination === 'style' ? 'text/css' : 'application/octet-stream' } }));
}

function offlinePage(req) {
  if (req.mode !== 'navigate') return Response.error();
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HealthWiz Kingdom (offline)</title>'
    + '<body style="font:16px system-ui;background:#14204f;color:#fff4c2;padding:24px;max-width:520px;margin:auto">'
    + '<h1 style="font-size:20px">You are offline</h1><p>HealthWiz has not finished saving its offline copy on this device yet, so it cannot open without internet this time.</p>'
    + '<p>Your saved logs are safe: they are stored in this browser and nothing was lost.</p><p>Connect to the internet once and open HealthWiz again. After that it also works offline.</p>'
    + '<button onclick="location.reload()" style="font:inherit;padding:10px 16px">Try again</button></body>',
  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
