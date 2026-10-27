/* HealthWiz Kingdom service worker (master prompt §73–74, §97 step 21). Registered by js/v6-pwa.js,
   only when the site is served over https (or http://localhost), never from a file or the standalone build.

   Strategy: NETWORK FIRST for the app's own files, so an online visit always gets the latest version (there is no
   build step that could stamp a version here). Every good response refreshes the offline copy. When the network
   fails, or takes longer than WAIT ms, the cached copy is used. Install pre-caches the whole app shell, so the app
   opens offline even if some pages were never visited.
   Fonts: Press Start 2P and Pixelify Sans are bundled in assets/fonts/ and pre-cached with the app, so nothing is fetched from Google Fonts.
   Everything else (the Wizard's Counsel AI request to the medius-chat Edge Function, the Supabase account and cloud sync, other sites) goes straight to the network and is never cached.
   Saved health data is in localStorage and never passes through here.

   Keep PRECACHE in sync with index.html and assets/: tests/20-pwa.test.mjs fails when a file is missing. */
const CACHE = 'hwk-shell-v5', WAIT = 4000;
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest',
  'js/hw-01-menu-data.js', 'js/v6-schema.js', 'js/hw-02-core.js', 'js/hw-03-part.js', 'js/hw-04-part.js',
  'js/hw-05-v5-4-module.js', 'js/hw-06-v5-3-health-module.js', 'js/v6-stairs-data.js', 'js/v6-loader.js', 'js/v6-events.js', 'js/v6-ui.js', 'js/v6-pixel.js',
  'js/v6-emoji.js', 'js/v6-sources.js', 'js/v6-calcx.js', 'js/v6-f21.js', 'js/v6-provisions.js', 'js/v6-ppg.js', 'js/v6-hr.js', 'js/v6-hrlog.js', 'js/v6-stairs.js', 'js/v6-stairs-css.js', 'js/v6-conditions.js', 'js/v6-motion.js', 'js/v6-particles.js', 'js/v6-insights.js', 'js/v6-quests.js',
  'js/v6-streaks.js', 'js/v6-xp.js', 'js/v6-kingdom.js', 'js/v6-luna.js', 'js/v6-medius.js', 'js/v6-music.js', 'js/v6-charts.js', 'js/v6-world.js',
  'js/v6-title.js', 'js/v6-games.js', 'js/v6-water.js', 'js/v6-rig.js', 'js/v6-waterquest.js', 'js/v6-dream.js', 'js/v6-storm.js', 'js/v6-ambient.js', 'js/v6-grove.js', 'js/v6-relief.js', 'js/v6-dass.js', 
  'js/v6-gps.js', 'js/v6-pwa.js',
  'js/v6-cloud.js', 'js/v6-account.js', 'js/v6-counsel.js', 'js/v6-board.js', 'js/v6-running.js', 'js/v6-runboard.js', 'js/v6-badges.js', 'js/v6-looks.js', 'js/v6-live.js', 'js/v6-alarm.js', 'js/v6-sheep.js', 'js/v6-map.js', 'js/v6-score.js', 'js/v6-whatif.js', 'js/v6-gravity.js', 'js/v6-alchemy.js', 'js/v6-report.js', 'js/v6-lab.js', 'js/v6-trial.js', 'js/v6-vault.js', 'js/v6-uncert.js', 'js/v6-plan.js', 'js/v6-time.js', 'js/v6-campus-data.js', 'js/v6-campus.js', 'js/v6-campus-css.js', 'js/v6-campus-magic.js', 'js/v6-campus-stop.js', 'js/v6-campus-hud.js', 'js/v6-campus-stairs.js', 'js/v6-monument-scene.js', 'js/v6-monument-css.js', 'js/v6-monument.js', 'js/v6-addfood.js', 'js/v6-arcane.js', 'js/v6-modern.js', 'js/v6-flair.js', 'js/v6-orb.js', 'js/v6-foodsel.js', 'js/v6-expbar.js', 'js/v6-help.js', 'js/v6-when.js', 'js/v6-buttons.js', 'js/v6-body.js', 'js/v6-exercise.js', 'js/v6-log.js', 'js/v6-hall.js', 'js/v6-safety.js', 'js/hw-07-boot.js',
  'assets/img/avatar-kg.webp', 'assets/img/avatar-kgf.webp', 'assets/img/avatar-kn.webp', 'assets/img/avatar-knf.webp',
  'assets/img/avatar-sk.webp', 'assets/img/avatar-wz.webp', 'assets/img/avatar-wzf.webp', 'assets/img/bedimg.jpg', 'assets/img/bedroom.webp', 'assets/img/sleeper-react.webp',
  'assets/img/kn.webp', 'assets/img/knight-kbd.webp', 'assets/img/knight-kcp.webp', 'assets/img/knight-khr.webp',
  'assets/img/orb-scene.webp', 'assets/img/luna-faces.webp', 'assets/img/luna-poses.webp', 'assets/img/luna-lab.webp', 'assets/img/luna-props.webp', 'assets/img/luna-room.webp', 'assets/img/luke-poses.webp', 'assets/img/luke-faces.webp', 'assets/img/luke-props.webp', 'assets/img/luke-room.webp', 'assets/img/lab-scene.webp', 'assets/img/orc.webp', 'assets/img/study.jpg', 'assets/img/wiz.webp', 'assets/img/heart-spin.webp', 'assets/img/monument-card.webp', 'assets/img/medius-reactions.webp',
  'assets/img/exercise/moves.webp', 'assets/img/exercise/muscles.webp',
  'assets/stairs/ST01.webp', 'assets/stairs/ST02.webp', 'assets/stairs/ST03.webp', 'assets/stairs/ST04.webp', 'assets/stairs/ST05.webp', 'assets/stairs/ST06.webp', 'assets/stairs/ST07.webp', 'assets/stairs/ST09.webp', 'assets/stairs/ST10.webp', 'assets/stairs/ST11.webp', 'assets/stairs/ST12.webp', 'assets/stairs/ST13.webp', 'assets/stairs/ST14.webp', 'assets/stairs/ST15.webp', 'assets/stairs/ST17.webp', 'assets/stairs/ST18.webp', 'assets/stairs/ST19.webp', 'assets/stairs/ST21.webp', 'assets/stairs/ST22.webp', 'assets/stairs/ST23.webp', 'assets/stairs/ST24.webp', 'assets/stairs/ST26.webp', 'assets/stairs/ST27.webp', 'assets/stairs/ST28.webp', 'assets/stairs/ST29.webp', 'assets/stairs/ST30.webp', 'assets/stairs/ST33.webp', 'assets/stairs/ST34.webp', 'assets/stairs/ST35.webp', 'assets/stairs/ST36.webp',
  'assets/fonts/PressStart2P-Latin.woff2', 'assets/fonts/PixelifySans-Latin.woff2',
  'assets/fonts/OFL-PressStart2P.txt', 'assets/fonts/OFL-PixelifySans.txt',
  'assets/audio/home-theme.mp3',
  'assets/icons/icon-32.png', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png', 'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  // cache: 'reload' skips the HTTP cache, so the offline copy is the current deploy
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('hwk-') && k !== CACHE).map(k => caches.delete(k))))
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
  // anything else: the browser handles it, never cached
});

async function fromCache(req) {
  const c = await caches.open(CACHE);
  return (await c.match(req, { ignoreSearch: req.mode === 'navigate' })) || (req.mode === 'navigate' ? (await c.match('index.html')) || c.match('./') : undefined);
}

function networkFirst(req, e) {
  // 'no-cache': always ask the server (a cheap 304 when nothing changed). GitHub Pages sends max-age=600, so a plain
  // fetch could take the browser's HTTP cache and keep showing the previous version for up to 10 minutes after an update.
  const net = fetch(req, { cache: 'no-cache' }).then(res => {
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

function offlinePage(req) {
  if (req.mode !== 'navigate') return Response.error();
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HealthWiz Kingdom (offline)</title>'
    + '<body style="font:16px system-ui;background:#14204f;color:#fff4c2;padding:24px;max-width:520px;margin:auto">'
    + '<h1 style="font-size:20px">You are offline</h1><p>HealthWiz has not finished saving its offline copy on this device yet, so it cannot open without internet this time.</p>'
    + '<p>Your saved logs are safe: they are stored in this browser and nothing was lost.</p><p>Connect to the internet once and open HealthWiz again. After that it also works offline.</p>'
    + '<button onclick="location.reload()" style="font:inherit;padding:10px 16px">Try again</button></body>',
  { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
