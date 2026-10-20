// HealthWiz Kingdom (integration Phase 4): the prototype's js/fx.js, with a ResizeObserver (the map's box changes with full
// screen and the layout, not only with the window) and destroy() for when the Observatory page closes.
//
// Fantasy-mode magic over the map: slow pixel motes drifting upward (fewer when zoomed out), and around the selected
// staircase a ring of rising sparks, a few fireflies and glowing leaves (owner's request, 2026-10-20: concentrate the effects
// around the selected place); a burst of sparks when a staircase is picked or a session is saved.
// Decoration only: drawn on a canvas that ignores the pointer, never on the map data. Off in realistic mode, when
// motion is reduced, or when the page is hidden.
const COLS = ['#fff0a8', '#f6c94f', '#8ff7ea', '#c9a8ff', '#ffffff'];

export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  let on = false, raf = 0, W = 0, H = 0, dpr = 1, last = 0, follow = null, fcol = '#fff0a8', fAcc = 0, zk = 1;
  const motes = [], sparks = [], flies = [], leaves = [];

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const want = Math.round(Math.min(90, Math.max(30, W * H / 14000)) * zk);
    while (motes.length < want) motes.push(mote(true));
    motes.length = want;
  }
  function mote(anywhere) {
    return { x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10, v: 6 + Math.random() * 14, s: Math.random() < .25 ? 3 : 2,
      c: COLS[Math.floor(Math.random() * COLS.length)], ph: Math.random() * 6.28, a: .35 + Math.random() * .5 };
  }
  function frame(t) {
    raf = 0;
    if (!on) return;
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const m of motes) {
      m.y -= m.v * dt; m.ph += dt * 1.6;
      if (m.y < -10) Object.assign(m, mote(false));
      const tw = .55 + .45 * Math.sin(m.ph);
      ctx.globalAlpha = m.a * tw; ctx.fillStyle = m.c;
      ctx.fillRect(Math.round(m.x + Math.sin(m.ph * .7) * 6), Math.round(m.y), m.s, m.s);
    }
    // around the selected waypoint: a slow ring of sparks rising from its base, fireflies wandering and leaves drifting
    const fp = follow && follow();
    if (fp) {
      while (flies.length < 7) flies.push({ a: Math.random() * 6.28, r: 26 + Math.random() * 40, w: (Math.random() < .5 ? -1 : 1) * (.4 + Math.random() * .5), ph: Math.random() * 6.28, h: Math.random() * 30 });
      for (const f of flies) {
        f.a += f.w * dt; f.ph += dt * 3;
        const x = fp.x + Math.cos(f.a) * f.r, y = fp.y - 18 - f.h + Math.sin(f.a) * f.r * .35, g = .5 + .5 * Math.sin(f.ph);
        ctx.globalAlpha = .18 * g; ctx.fillStyle = '#d9ff8a'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
        ctx.globalAlpha = .6 + .4 * g; ctx.fillStyle = '#f4ffb0'; ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
      }
      if (leaves.length < 4 && Math.random() < dt * 1.5) leaves.push({ x: fp.x + (Math.random() - .5) * 90, y: fp.y - 70 - Math.random() * 30, vx: 6 + Math.random() * 8, vy: 10 + Math.random() * 8, ph: Math.random() * 6.28, life: 3 + Math.random() * 2, c: Math.random() < .5 ? '#9cf0a0' : '#ffd36a' });
    } else { flies.length = 0; }
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i]; l.life -= dt; if (l.life <= 0) { leaves.splice(i, 1); continue; }
      l.ph += dt * 2.4; l.x += (l.vx + Math.sin(l.ph) * 14) * dt; l.y += l.vy * dt;
      ctx.globalAlpha = Math.min(1, l.life) * .85; ctx.fillStyle = l.c;
      const k = Math.sin(l.ph) > 0; ctx.fillRect(Math.round(l.x), Math.round(l.y), k ? 3 : 2, k ? 2 : 3);
    }
    if (fp) {
      fAcc += dt;
      while (fAcc > .07) { fAcc -= .07; const a = Math.random() * Math.PI * 2, r = 14 + Math.random() * 10;
        sparks.push({ x: fp.x + Math.cos(a) * r, y: fp.y + Math.sin(a) * r * .4, vx: -Math.sin(a) * 18, vy: -22 - Math.random() * 26, g: -10, life: .7 + Math.random() * .6, s: Math.random() < .3 ? 3 : 2, c: Math.random() < .55 ? fcol : COLS[Math.floor(Math.random() * COLS.length)] }); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= dt; if (p.life <= 0) { sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g != null ? p.g : 60) * dt;
      ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && on && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; ctx.clearRect(0, 0, canvas.width, canvas.height); }

  const ro = new ResizeObserver(() => size()); ro.observe(canvas);
  const vis = () => { document.hidden ? (raf && cancelAnimationFrame(raf), raf = 0) : start(); };
  document.addEventListener('visibilitychange', vis);
  size();
  return {
    set(active) { on = active; if (on) { size(); start(); } else stop(); },
    /** Keep sparks around a moving screen point (fn returns {x, y} or null); null stops. */
    follow(fn, colour) { follow = fn || null; if (colour) fcol = colour; if (follow) start(); },
    destroy() { on = false; stop(); ro.disconnect(); document.removeEventListener('visibilitychange', vis); motes.length = 0; sparks.length = 0; flies.length = 0; leaves.length = 0; follow = null; },
    /** The map's zoom: a quarter of the motes at the campus view (15.5), all of them from zoom 18 in. */
    zoom(z) { zk = Math.max(.25, Math.min(1, (z - 15.5) / 2.5 * .75 + .25)); if (W) size(); },
    get motes() { return motes.length; },
    get running() { return !!raf; },
    burst(x, y, colour) {
      if (!on) return;
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 110;
        sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: .5 + Math.random() * .5, s: Math.random() < .3 ? 4 : 2,
          c: Math.random() < .5 ? colour : COLS[Math.floor(Math.random() * COLS.length)] });
      }
      start();
    },
  };
}
