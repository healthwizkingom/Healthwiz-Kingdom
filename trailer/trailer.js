/* HealthWiz Kingdom booth trailer: the 30-second looping timeline.
   TrailerDirector runs one requestAnimationFrame loop, fires the cues below by timestamp, and moves the camera
   (#trailer-viewport) with CSS transforms. Every cue only toggles classes (.scene-active, .animate-in, .animate-out,
   .is-*) on elements that already exist in index.html; reset() strips them all at the loop, so nothing piles up. */
(function () {
  'use strict';
  const DURATION = 30, W = 1920, H = 1080;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const stage = $('#stage'), viewport = $('#trailer-viewport');
  const STATE = /^(scene-active|animate-in|animate-out|is-[\w-]+)$/;

  class TrailerDirector {
    constructor(cues, scenes) {
      this.cues = cues.slice().sort((a, b) => a.t - b.t);
      this.scenes = scenes;            // [{n, t}] scene start times, for seeking
      this.timers = new Set();         // every setTimeout / setInterval id, cleared at each loop
      this.tweens = [];                // value animations driven by the main loop (no extra rAF)
      this.raf = 0; this.t0 = 0; this.prev = -Infinity; this.paused = false; this.pausedAt = 0; this.lastFrame = 0;
      this.tick = this.tick.bind(this);
    }
    start(at) { this.seek(at || 0); this.raf = requestAnimationFrame(this.tick); }
    now() { return this.paused ? this.pausedAt : (performance.now() - this.t0) / 1000; }
    tick(frame) {
      this.raf = requestAnimationFrame(this.tick);
      // a hidden tab stops rAF; coming back after a long gap restarts the loop instead of firing a burst of cues
      if (this.lastFrame && frame - this.lastFrame > 800 && !this.paused) { this.lastFrame = frame; return this.seek(0); }
      this.lastFrame = frame;
      if (this.paused) return;
      const t = this.now();
      if (t >= DURATION) return this.seek(0);
      for (const c of this.cues) if (c.t > this.prev && c.t <= t) c.fn(this);
      this.prev = t;
      this.tweens = this.tweens.filter(w => { const p = Math.min(1, (t - w.from) / w.dur); w.fn(w.ease(p)); return p < 1; });
      if (timecode && !timecode.hidden) timecode.textContent = '0:' + String(Math.floor(t)).padStart(2, '0') + '.' + Math.floor(t * 10 % 10);
    }
    /* timers and tweens owned by the director, so a loop or a seek can cancel them all */
    after(ms, fn) { const id = setTimeout(() => { this.timers.delete(id); fn(); }, ms); this.timers.add(id); return id; }
    every(ms, fn) { const id = setInterval(fn, ms); this.timers.add(id); return id; }
    clear(id) { clearTimeout(id); clearInterval(id); this.timers.delete(id); }
    tween(dur, fn, ease) { this.tweens.push({ from: this.now(), dur, fn, ease: ease || (p => 1 - Math.pow(1 - p, 3)) }); }
    reset() {
      for (const id of this.timers) { clearTimeout(id); clearInterval(id); }
      this.timers.clear(); this.tweens = [];
      $$('*', stage).forEach(el => {
        const drop = Array.from(el.classList).filter(c => STATE.test(c));
        if (drop.length) el.classList.remove(...drop);
      });
      stage.classList.remove('is-heartbeat');
      $$('.dialogue').forEach(d => { d.textContent = ''; });
      $('.score-num').textContent = '0';
      camera(960, 540, 1, 0);
      void stage.offsetWidth;          // reflow: restarts every CSS animation the next cue adds
    }
    /* jump to time t: reset, then replay the cues of the scene that contains t (earlier scenes are hidden anyway) */
    seek(t) {
      this.reset();
      const from = this.scenes.filter(s => s.t <= t).pop().t;
      this.t0 = performance.now() - t * 1000; this.prev = from - 1e-6;
      if (this.paused) this.pausedAt = t;
      for (const c of this.cues) if (c.t >= from && c.t <= t) c.fn(this);
      this.prev = t;
    }
    togglePause() {
      if (this.paused) { this.paused = false; this.t0 = performance.now() - this.pausedAt * 1000; stage.style.animationPlayState = ''; $$('*', stage).forEach(e => { e.style.animationPlayState = ''; }); }
      else { this.pausedAt = this.now(); this.paused = true; $$('*', stage).forEach(e => { e.style.animationPlayState = 'paused'; }); }
    }
  }

  /* ---------- the camera: frame the stage point (x, y) at zoom s ---------- */
  function camera(x, y, s, dur, ease) {
    const tx = (W / 2 - x) * s, ty = (H / 2 - y) * s;
    if (!dur) {
      viewport.classList.add('cut');
      viewport.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
      void viewport.offsetWidth; viewport.classList.remove('cut');
      return;
    }
    viewport.style.transition = `transform ${dur}s ${ease || 'ease-in-out'}`;
    viewport.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
  }

  /* ---------- small helpers for cues ---------- */
  const add = (sel, cls) => $$(sel).forEach(el => el.classList.add(cls || 'animate-in'));
  const del = (sel, cls) => $$(sel).forEach(el => el.classList.remove(cls));
  const scene = n => {
    $$('.scene').forEach(s => s.classList.toggle('scene-active', s.dataset.scene === String(n)));
  };
  const fx = (sel, d, ms) => { const el = $(sel); el.classList.remove('animate-in'); void el.offsetWidth; el.classList.add('animate-in'); d.after(ms || 1200, () => el.classList.remove('animate-in')); };
  function typewrite(d, el, cps) {
    const text = el.dataset.type; let i = 0;
    el.classList.add('is-typing');
    const id = d.every(1000 / cps, () => {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { d.clear(id); d.after(600, () => el.classList.remove('is-typing')); }
    });
  }

  /* ---------- the 30-second timeline ---------- */
  const cues = [
    // [0:00-0:04] SCENE 1: The Awakening. Orb drops, shatters, the camera pulls back and pans across the map, then dives into a pin.
    { t: 0.00, fn: d => { scene(1); camera(960, 540, 2.2, 0); add('#asset-health-orb'); } },
    { t: 0.85, fn: d => { add('#asset-health-orb', 'is-shatter'); add('.shards', 'is-shatter'); fx('.fx-flash', d, 700); add('#asset-campus-map'); camera(1000, 540, 1, 1.5, 'cubic-bezier(.2,.8,.2,1)'); } },
    { t: 1.10, fn: () => add('.pin') },
    { t: 1.40, fn: () => add('#scene-awakening .title-card') },
    { t: 2.30, fn: () => camera(1360, 540, 1, 1.0) },               // pan right
    { t: 2.70, fn: () => add('#pin-hero', 'is-glow') },
    { t: 3.20, fn: () => camera(1500, 440, 5, 0.75, 'cubic-bezier(.6,0,.9,.4)') },   // magical glide into the pin
    { t: 3.70, fn: d => fx('.fx-rune', d, 800) },

    // [0:04-0:08] SCENE 2: The Council of Guides. Three scrolls unfurl, dialogue types out together, Luna's green wind wipes.
    { t: 4.00, fn: () => { scene(2); camera(960, 560, 1.12, 0); add('.scroll'); } },
    { t: 4.05, fn: () => camera(960, 540, 1, 3.6, 'ease-out') },
    { t: 4.30, fn: () => add('#scene-council .title-card') },
    { t: 4.90, fn: d => $$('.dialogue').forEach(el => typewrite(d, el, 26)) },
    { t: 7.40, fn: d => fx('.fx-wind', d, 1100) },

    // [0:08-0:13] SCENE 3: The Ascent. Stair Details slides in, the ghost pacer climbs, the Workout chart draws; heartbeat into a splash.
    { t: 8.00, fn: () => { scene(3); camera(960, 600, 1.12, 0); add('#asset-staircase'); } },
    { t: 8.05, fn: () => camera(960, 470, 1.12, 4.6, 'linear') },    // slow tilt upward with the pacer
    { t: 8.20, fn: () => add('#scene-ascent .title-card') },
    { t: 8.40, fn: () => add('#asset-stair-panel') },
    { t: 8.80, fn: () => { add('#asset-ghost-pacer'); add('#asset-pace-breath'); } },
    { t: 9.40, fn: () => add('#asset-workout-panel') },
    { t: 12.10, fn: d => { stage.classList.add('is-heartbeat'); d.after(820, () => stage.classList.remove('is-heartbeat')); } },
    { t: 12.50, fn: d => fx('.fx-splash', d, 1000) },

    // [0:13-0:17] SCENE 4: The Elixir & The Feast. Water fills, the menu scrolls, kcal/kJ float off; a sword slash.
    { t: 13.00, fn: () => { scene(4); camera(780, 560, 1.25, 0); add('.vial'); } },
    { t: 13.20, fn: () => camera(1150, 560, 1.25, 3.0) },          // horizontal pan, well to menu
    { t: 13.30, fn: () => add('#asset-food-menu') },
    { t: 13.50, fn: () => add('#scene-feast .title-card') },
    { t: 16.45, fn: d => fx('.fx-slash', d, 600) },
    { t: 16.70, fn: d => fx('.fx-flash', d, 700) },

    // [0:17-0:23] SCENE 5: The Duel. Charge, jump, strike; the Ogre bursts into XP coins and runes that swirl into a golden galaxy.
    { t: 17.00, fn: () => { scene(5); camera(960, 560, 1.1, 0); } },
    { t: 17.20, fn: () => add('#scene-duel .title-card') },
    { t: 17.60, fn: () => add('#asset-knight', 'is-charge') },
    { t: 18.30, fn: () => add('#asset-knight', 'is-jump') },
    { t: 18.85, fn: () => { add('.impact'); add('#asset-ogre', 'is-hit'); camera(1380, 520, 1.35, 0.25, 'ease-out'); } },
    { t: 19.40, fn: () => { add('#asset-ogre', 'is-explode'); add('.loot', 'is-burst'); add('.bt-xp'); camera(960, 540, 1, 0.9, 'ease-out'); } },
    { t: 19.90, fn: () => add('.bt-work') },
    { t: 20.10, fn: () => { del('#asset-knight', 'is-jump'); add('#asset-knight', 'is-return'); } },
    { t: 20.50, fn: () => add('.bt-win') },
    { t: 21.80, fn: () => { add('.loot', 'is-swirl'); camera(960, 540, 1.6, 1.2, 'ease-in'); } },
    { t: 22.40, fn: d => fx('.fx-gold', d, 1100) },

    // [0:23-0:27] SCENE 6: The Final Score. Zoom out of the galaxy to the gauge; 0 to 87; Medius nods; embers rise.
    { t: 23.00, fn: () => { scene(6); camera(960, 540, 3, 0); } },
    { t: 23.05, fn: () => camera(960, 540, 1, 2, 'cubic-bezier(.2,.8,.2,1)') },
    { t: 23.30, fn: () => add('#asset-health-score') },
    { t: 23.50, fn: () => add('.embers') },
    { t: 23.60, fn: d => {
        add('#asset-health-score', 'is-fill');
        const num = $('.score-num');
        d.tween(2.2, p => { num.textContent = String(Math.round(p * SCORE)); }, p => 1 - Math.pow(1 - p, 4));
      } },
    { t: 24.60, fn: () => add('#asset-medius-nod') },
    { t: 25.80, fn: () => { add('#asset-health-score', 'is-done'); add('#asset-medius-nod', 'is-nod'); } },

    // [0:27-0:30] SCENE 7: The Loop. Fade to black, logo, tagline; the logo glows into the orb, which leaves the top of the
    // frame, so the orb dropping in at 0:00 closes the loop.
    { t: 27.00, fn: () => add('.fx-black') },
    { t: 27.80, fn: () => { scene(7); del('.embers', 'animate-in'); camera(960, 540, 1, 0); add('.fx-black', 'is-cut'); del('.fx-black', 'animate-in'); } },
    { t: 27.85, fn: () => { del('.fx-black', 'is-cut'); add('#asset-logo'); add('.tagline'); } },
    { t: 29.00, fn: () => add('#asset-logo', 'is-glow') },
    { t: 29.30, fn: () => { add('.tagline', 'animate-out'); add('#asset-logo', 'is-morph'); add('.outro-orb'); } },
    { t: 29.70, fn: () => add('.outro-orb', 'is-rise') },
  ];
  const SCORE = 87;   // demo profile value shown in the gauge; labelled "Demo profile" on screen
  const SCENES = [0, 4, 8, 13, 17, 23, 27].map((t, i) => ({ n: i + 1, t }));

  /* ---------- particles, built once (never per loop) ---------- */
  function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  (function build() {
    const r = seeded(7), loot = $('.loot'), galaxy = $('.galaxy'), embers = $('.embers');
    for (let k = 0; k < 40; k++) {
      const i = document.createElement('i'), a = r() * Math.PI * 2, dist = 160 + r() * 420;
      i.className = k % 4 ? 'coin' : 'rune';
      i.style.cssText = `--k:${k};--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist * 0.75 - 80}px`;
      loot.appendChild(i);
    }
    const glyphs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', 'XP'];
    for (let k = 0; k < 70; k++) {
      const i = document.createElement('i');
      i.textContent = glyphs[k % glyphs.length];
      i.style.cssText = `--a:${r() * 360}deg;--r:${120 + r() * 820}px;animation-duration:${4 + r() * 6}s`;
      galaxy.appendChild(i);
    }
    for (let k = 0; k < 44; k++) {
      const i = document.createElement('i'), s = 4 + Math.round(r() * 3) * 2;
      i.style.cssText = `--x:${r() * 1920}px;--s:${s}px;--t:${4 + r() * 4}s;--d:${-r() * 6}s;--w:${(r() - 0.5) * 240}px`;
      embers.appendChild(i);
    }
  })();

  /* ---------- fit the 1920 x 1080 stage to any screen (letterboxed) ---------- */
  function fit() { stage.style.scale = String(Math.min(innerWidth / W, innerHeight / H)); }
  addEventListener('resize', fit); fit();

  const timecode = $('#timecode'), params = new URLSearchParams(location.search);
  if (params.has('debug')) timecode.hidden = false;
  const director = new TrailerDirector(cues, SCENES);
  window.trailerDirector = director;

  /* ---------- booth controls ---------- */
  const music = $('#music');
  function toggleMusic() { if (music.paused) music.play().catch(() => {}); else music.pause(); }
  addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); director.togglePause(); }
    else if (e.key === 'f' || e.key === 'F') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
    else if (e.key === 'm' || e.key === 'M') toggleMusic();
    else if (e.key === 'r' || e.key === 'R') director.seek(0);
    else if (/^[1-7]$/.test(e.key)) director.seek(SCENES[+e.key - 1].t);
  });
  let hide = 0;
  addEventListener('mousemove', () => { document.body.classList.add('show-cursor'); clearTimeout(hide); hide = setTimeout(() => document.body.classList.remove('show-cursor'), 2000); });
  if (params.get('music') === '1') addEventListener('pointerdown', () => { if (music.paused) music.play().catch(() => {}); }, { once: true });

  const startAt = Math.max(0, Math.min(DURATION - 0.01, parseFloat(params.get('t')) || 0));
  const go = () => director.start(startAt);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
})();
