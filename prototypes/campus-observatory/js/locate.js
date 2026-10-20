// Where the avatar stands: the device's own location (the browser Geolocation API, asked for only when you tap the
// locate button), or a simulated walk along a campus road for trying it away from campus.
// The position stays in this browser tab: it is not stored, not sent anywhere and forgotten when you stop or leave.
// A GPS fix is the device's estimate, with its own accuracy radius; a demo position is simulated and labelled so.

/** opts: {onFix({lng, lat, accuracy, source}), onState(state, info)} → {startGps(), startDemo(path), stop(), get state}.
 *  States: 'off', 'asking' (waiting for permission or the first fix), 'gps', 'demo', 'error' (info.code, info.message). */
export function createLocator(opts) {
  let state = 'off', watch = null, demoTimer = null;
  const set = (s, info) => { state = s; opts.onState(s, info || {}); };
  function clear() {
    if (watch != null && navigator.geolocation) navigator.geolocation.clearWatch(watch);
    watch = null; clearInterval(demoTimer); demoTimer = null;
  }
  return {
    get state() { return state; },
    startGps() {
      clear();
      if (!('geolocation' in navigator)) return set('error', { code: 'none', message: 'This browser cannot share its location.' });
      if (!window.isSecureContext) return set('error', { code: 'insecure', message: 'Location needs a secure page (https:// or localhost).' });
      set('asking');
      watch = navigator.geolocation.watchPosition(p => {
        if (state !== 'asking' && state !== 'gps') return;
        if (state === 'asking') set('gps');
        opts.onFix({ lng: p.coords.longitude, lat: p.coords.latitude, accuracy: p.coords.accuracy, source: 'gps' });
      }, e => {
        if (state === 'gps' && e.code !== 1) return; // a timeout between fixes: keep the last one and keep listening
        clear();
        const message = e.code === 1 ? 'Location permission was not given, or this page is not allowed to ask for it.'
          : e.code === 2 ? 'The device could not find its location. Try outdoors, or turn on location services.'
          : 'Finding the location took too long. Try again outdoors.';
        set('error', { code: e.code, message });
      }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 25000 });
    },
    /** A simulated walk at 1.3 m/s along path ([[lng, lat], ...]), there and back, one position a second. */
    startDemo(path) {
      clear();
      if (!path || path.length < 2) return set('error', { code: 'nopath', message: 'No campus road to walk along.' });
      const R = 6371008.8, D = Math.PI / 180;
      const seg = path.slice(1).map((b, i) => { const a = path[i], kx = R * D * Math.cos(a[1] * D); return Math.hypot((b[0] - a[0]) * kx, (b[1] - a[1]) * R * D); });
      const total = seg.reduce((t, x) => t + x, 0);
      let along = 0, dir = 1;
      const at = d => { for (let i = 0; i < seg.length; i++) { if (d <= seg[i] || i === seg.length - 1) { const f = Math.min(1, d / seg[i]), a = path[i], b = path[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; } d -= seg[i]; } };
      const tick = () => {
        const [lng, lat] = at(along);
        opts.onFix({ lng, lat, accuracy: null, source: 'demo' });
        along += 1.3 * dir; if (along > total) { along = total; dir = -1; } else if (along < 0) { along = 0; dir = 1; }
      };
      set('demo'); tick(); demoTimer = setInterval(tick, 1000);
    },
    stop() { clear(); set('off'); },
  };
}
