// Fantasy-mode magic over the map: slow pixel motes drifting upward, and a burst of sparks when a staircase is picked.
// Decoration only: drawn on a canvas that ignores the pointer, never on the map data. Off in realistic mode, when
// motion is reduced, or when the page is hidden.
const COLS = ['#fff0a8', '#f6c94f', '#8ff7ea', '#c9a8ff', '#ffffff'];

export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  let on = false, raf = 0, W = 0, H = 0, dpr = 1, last = 0, follow = null, fcol = '#fff0a8', fAcc = 0;
  const motes = [], sparks = [];

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const want = Math.round(Math.min(90, Math.max(30, W * H / 14000)));
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
    // around the selected waypoint: a slow ring of sparks rising from its base
    const fp = follow && follow();
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

  window.addEventListener('resize', () => { size(); });
  document.addEventListener('visibilitychange', () => { document.hidden ? (raf && cancelAnimationFrame(raf), raf = 0) : start(); });
  size();
  return {
    set(active) { on = active; if (on) { size(); start(); } else stop(); },
    /** Keep sparks around a moving screen point (fn returns {x, y} or null); null stops. */
    follow(fn, colour) { follow = fn || null; if (colour) fcol = colour; if (follow) start(); },
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
