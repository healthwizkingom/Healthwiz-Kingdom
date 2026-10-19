/* v6: the magical, modern look (the owner's redesign request: "more visually magical, and a modern UI, not bland"). Not part of
   the original. Loaded after every other add-on (just before js/v6-safety.js) so its rules come last; selectors start with
   `html` so they also beat styles injected later at the same weight.
   * Arcane Night (js/v6-looks.js THEMES.arcane) is the default theme: deep midnight indigo, violet and teal light, gold
     accents, after the owner's concept sheet. The other themes stay selectable and get the same modern shapes.
   * Shapes for every theme: soft rounded panels with a thin glowing edge and depth, gold gradient primary buttons, glass
     secondary buttons and chips, rounded inputs with a violet focus glow, pill tags, a glowing bottom menu, rounded
     dialogs and "?" panels. Pixel art stays pixel art: the pixel font, the pixel icons, the characters and the scenes
     are untouched.
   * Every gradient sits on a solid background-color with the theme colour, so text contrast is measured against a real
     colour (tests/47-buttons.test.mjs) and the look degrades to that colour where gradients are not drawn.
   * Motion: only the starfield twinkle (opacity, slow); none with reduced motion or in the Performance mode.
   Per-theme tokens: --edge (a panel or control edge that stays ≥ 3:1 on the surfaces), --glow (accent light), --shade
   (depth), --hi (top highlight), --accent (focus and active light). */
HWUI.css('arcane',`
:root{--edge:var(--ln);--glow:rgba(246,201,79,.16);--shade:rgba(43,36,24,.16);--hi:rgba(255,255,255,.45);--accent:#8b5cf0;--r-card:16px;--r-ctl:12px}
html[data-theme="dark"]{--edge:#7d93ad;--glow:rgba(120,170,255,.16);--shade:rgba(0,0,0,.45);--hi:rgba(255,255,255,.07)}
html[data-skin="arcane"]{--edge:#8a7be0;--glow:rgba(139,92,240,.32);--shade:rgba(5,3,20,.6);--hi:rgba(196,166,255,.10);--accent:#63e6dc}
html[data-skin="forest"]{--edge:#6aa882;--glow:rgba(92,192,90,.18)}html[data-skin="crystal"]{--edge:#8794e0;--glow:rgba(143,160,255,.22)}
html[data-skin="ember"]{--edge:#c98f6a;--glow:rgba(240,140,70,.18)}

/* the night sky behind Arcane Night: two soft lights and a sparse starfield (the ambient scenery stays on top) */
html[data-skin="arcane"] body{background:
  radial-gradient(900px 420px at 50% -8%,rgba(139,92,240,.38),transparent 62%),
  radial-gradient(700px 380px at 105% 105%,rgba(42,168,172,.22),transparent 62%),
  radial-gradient(1.5px 1.5px at 20px 30px,#efe8ff 50%,transparent 51%),radial-gradient(1px 1px at 120px 80px,#c4fff7 50%,transparent 51%),
  radial-gradient(1.5px 1.5px at 190px 150px,#fff0a8 50%,transparent 51%),radial-gradient(1px 1px at 60px 190px,#efe8ff 50%,transparent 51%),
  var(--bg);background-size:auto,auto,230px 230px,230px 230px,230px 230px,230px 230px,auto;background-attachment:fixed}

/* panels */
html .card,html .pxp{border:1px solid var(--edge);border-radius:var(--r-card);background-color:var(--pn);
  background-image:linear-gradient(180deg,var(--hi),rgba(255,255,255,0) 72px);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 26px var(--shade),0 0 22px var(--glow)}
html .card:before,html .card:after{display:none}
/* the main health panels use the stepped pixel frame (.pxp.pxn), in the theme's visible edge colour */
html .pxp.pxn{border:0;border-radius:0;margin:var(--px-bw) calc(2 * var(--px-bw)) calc(14px + 2 * var(--px-bw)) var(--px-bw);box-shadow:var(--px-bevel),0 calc(-1 * var(--px-bw)) 0 var(--edge),0 var(--px-bw) 0 var(--edge),calc(-1 * var(--px-bw)) 0 0 var(--edge),var(--px-bw) 0 0 var(--edge),calc(2 * var(--px-bw)) var(--px-bw) 0 var(--edge),var(--px-bw) calc(2 * var(--px-bw)) 0 var(--edge)}
html .card>h3:first-child{box-shadow:none;border-bottom:1px solid var(--edge);padding-bottom:8px;color:var(--ink)}
html[data-skin="arcane"] .card>h3:first-child,html[data-skin="arcane"] .pxh{color:#fff0a8;text-shadow:0 0 10px rgba(246,201,79,.45)}
html h2{letter-spacing:.5px}html[data-skin="arcane"] h2{color:#f3efff;text-shadow:0 0 12px rgba(139,92,240,.7)}
html .t{border:1px solid var(--edge);border-radius:14px;background-color:var(--p2);background-image:linear-gradient(160deg,var(--hi),rgba(255,255,255,0) 60%);box-shadow:0 4px 14px var(--shade)}
html .warn{border-radius:12px;border-width:2px}
html .pxtag,html .tag{border-radius:999px;padding-left:8px;padding-right:8px}

/* controls */
html button{border:1px solid rgba(43,26,5,.55);border-radius:var(--r-ctl);background-color:var(--gold);color:#2b1a05;
  background-image:linear-gradient(180deg,rgba(255,250,220,.55),rgba(255,255,255,0) 55%,rgba(150,90,10,.18));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.55),0 4px 14px rgba(246,201,79,.28),0 2px 0 rgba(0,0,0,.22)}
html button:active{transform:translateY(1px)}
html button.g,html button.chip{border:1px solid var(--edge);background-color:var(--p2);color:var(--ink);
  background-image:linear-gradient(180deg,var(--hi),rgba(255,255,255,0));box-shadow:0 3px 10px var(--shade)}
html button.chip.on{border-color:rgba(43,26,5,.55);background-color:var(--gold);color:#2b1a05;
  background-image:linear-gradient(180deg,rgba(255,250,220,.55),rgba(255,255,255,0) 60%);box-shadow:0 0 0 2px rgba(246,201,79,.35),0 4px 14px rgba(246,201,79,.3)}
html button:disabled,html button[aria-disabled="true"],html button.g:disabled,html button.chip:disabled{border-style:dashed;background-image:none;box-shadow:none}
html button:focus-visible,html input:focus-visible,html select:focus-visible,html textarea:focus-visible,html summary:focus-visible,html a:focus-visible{outline:3px solid var(--accent);outline-offset:2px;box-shadow:0 0 0 6px rgba(139,92,240,.25)}
html input,html select,html textarea{border:1px solid var(--edge);border-radius:10px;background-color:var(--bg);box-shadow:inset 0 2px 6px var(--shade)}
html:root[data-skin="arcane"] :focus-visible{outline-color:#63e6dc} /* Arcane Night's teal ring, over the dark themes' light blue */
html input[type=range]{box-shadow:none;border:0;background:none;accent-color:var(--accent)}
html input[type=checkbox],html input[type=radio]{accent-color:var(--accent);box-shadow:none}

/* the menu: a glass bar with a glowing active tab */
html nav button{border-radius:12px;background-color:var(--pn);background-image:linear-gradient(180deg,var(--hi),rgba(255,255,255,0));border:1px solid var(--edge);color:var(--ink);box-shadow:0 2px 8px var(--shade)}
html nav button.on{background-color:var(--gold);color:#2b1a05;background-image:linear-gradient(180deg,rgba(255,250,220,.6),rgba(255,255,255,0) 60%);box-shadow:0 0 14px rgba(246,201,79,.55)}
@media(max-width:760px){html nav{border-top:1px solid var(--edge);box-shadow:0 -8px 24px var(--shade);background-color:var(--pn)}}

/* overlays: dialogs, "?" panels, Luna's bubble, toasts */
html #mo>.card,html .hwhp{border-radius:18px;border:1px solid var(--edge);box-shadow:0 0 0 1px rgba(255,255,255,.06),0 18px 50px rgba(0,0,0,.45),0 0 34px var(--glow)}
html .v6md p{border-radius:14px;border:1px solid var(--edge);box-shadow:0 8px 22px var(--shade),0 0 18px var(--glow)}
html .v6md .v6lav.pf{border-radius:14px;border:1px solid var(--edge);box-shadow:0 0 16px var(--glow);overflow:hidden}

/* page banners, section heads, the "?" button, toasts and celebrations */
html .bn{border:1px solid var(--edge);border-radius:var(--r-card);background-color:var(--pn);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 22px var(--shade),0 0 22px var(--glow)}
html .sthd,html .nshd{border:1px solid var(--edge);border-radius:14px;background-image:linear-gradient(180deg,var(--hi),rgba(255,255,255,0));box-shadow:0 6px 18px var(--shade)}
html .hwh:not(.hwhl):before,html #main .hwh:not(.hwhl):before{border-radius:50%;border:1px solid #efe8ff;background-color:#7c4ddc;background-image:radial-gradient(circle at 35% 30%,rgba(255,255,255,.45),rgba(255,255,255,0) 55%);box-shadow:0 0 10px rgba(139,92,240,.65)}
html .hwh.hwhl{border-radius:999px}
html #toasts div{border-radius:12px;border:1px solid var(--gold);box-shadow:0 8px 24px rgba(0,0,0,.4),0 0 16px rgba(246,201,79,.35)}
html .v6cel,html .bpop{border-radius:18px;border-width:1px;box-shadow:0 12px 32px rgba(0,0,0,.45),0 0 0 2px rgba(246,201,79,.55),0 0 26px rgba(246,201,79,.35)}

html[data-skin="arcane"] .bn{background-image:linear-gradient(100deg,rgba(139,92,240,.32),rgba(42,168,172,.14) 70%,rgba(246,201,79,.08))}
html .hwh{flex:0 0 auto}
html .ststat{border:1px solid var(--edge);border-radius:14px;background-image:linear-gradient(160deg,var(--hi),rgba(255,255,255,0) 60%);box-shadow:0 4px 14px var(--shade)}
html .nst{border:1px solid var(--edge);border-radius:16px;box-shadow:0 6px 18px var(--shade)}html .nst.on{border-color:var(--gold);box-shadow:0 0 0 2px rgba(246,201,79,.35),0 0 20px rgba(246,201,79,.3)}
html .v6ce{border-radius:14px;border:1px dashed var(--edge)}

/* charts and bars pick up the glow */
html .lbt i{border-radius:8px 8px 0 0;border:1px solid var(--edge);border-bottom:0;background:linear-gradient(180deg,#c4a6ff,#8b5cf0);box-shadow:0 0 14px rgba(139,92,240,.45)}
html .vbk{border-radius:10px 4px 4px 10px;border:1px solid rgba(0,0,0,.4);box-shadow:inset 6px 0 0 rgba(0,0,0,.22),0 6px 14px var(--shade)}
html .vch{border-radius:16px;border:1px solid var(--edge);box-shadow:0 0 26px var(--glow)}
html .vno{border-radius:50%;border:1px solid rgba(43,26,5,.55);box-shadow:0 0 10px rgba(246,201,79,.5)}

/* Modern title screen portal & responsive positioning */
html .wl .ct{position:absolute;left:0;right:0;bottom:clamp(16px,6vh,48px);display:flex;justify-content:center;align-items:center;gap:12px;z-index:50;padding:0 16px}
html .wl .ct button[data-a="go"]{font-size:16px;padding:14px 26px;border-radius:12px;background:linear-gradient(180deg,#ffe27a 0%,#f2c14e 65%,#c88f1e 100%);color:#2b1805;border:2px solid #2b1805;box-shadow:0 0 0 2px rgba(242,193,78,.6),0 8px 26px rgba(0,0,0,.65),inset 0 2px 0 rgba(255,255,255,.6);text-shadow:0 1px 0 rgba(255,255,255,.5);letter-spacing:.5px;transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,background-color .2s,border-color .2s}
html .wl .ct button[data-a="go"]:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 0 0 3px rgba(242,193,78,.85),0 12px 30px rgba(242,193,78,.45),inset 0 2px 0 #fff}
html .wl .ct button[data-a="go"]:active{transform:translateY(2px) scale(0.98)}
html .wl .ct .v6set{font-size:12px;padding:13px 18px;border-radius:12px;background:rgba(20,32,60,0.85);backdrop-filter:blur(8px);border:2px solid rgba(242,193,78,0.45);color:#f6edcf;box-shadow:0 4px 16px rgba(0,0,0,0.4);transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease,border-color .2s ease}
html .wl .ct .v6set:hover{background:rgba(30,48,85,0.95);border-color:#f2c14e;transform:translateY(-2px)}
html .v6wxt{border-radius:12px;background:rgba(14,23,48,0.82);backdrop-filter:blur(8px);border:1.5px solid rgba(242,193,78,0.4);box-shadow:0 6px 20px rgba(0,0,0,0.35)}
html .v6rib{border-radius:12px;background:rgba(14,23,48,0.82);backdrop-filter:blur(8px);border:1.5px solid rgba(242,193,78,0.6);box-shadow:0 6px 20px rgba(0,0,0,0.35),0 0 14px rgba(242,193,78,0.2)}

/* Modern Header HUD & Navigation */
html header{background:var(--pn);border:1px solid var(--edge);border-radius:var(--r-card);padding:12px 16px;margin-bottom:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 24px var(--shade),0 0 20px var(--glow)}
html .bar{border-radius:8px;overflow:hidden;box-shadow:inset 0 0 0 1px var(--edge),inset 0 2px 4px rgba(0,0,0,0.25)}   /* an inset edge, not a border: bars stay borderless */
html .bar i{border-radius:6px;box-shadow:0 0 10px var(--c)}
html nav{gap:8px}
html nav button{font-size:12px;padding:12px 10px;transition:transform .2s ease,box-shadow .2s ease,background-color .2s ease,border-color .2s ease}
html nav button:hover:not(.on){transform:translateX(3px);border-color:var(--gold)}
@media(max-width:760px){
  html nav{backdrop-filter:blur(12px);background:rgba(20,32,58,0.94);border-top:1.5px solid var(--edge);padding:8px 6px calc(8px + env(safe-area-inset-bottom,0px))}
  html nav button{flex:1 1 0;min-width:58px;padding:8px 4px}
}

/* Modern Status & Hub Cards */
html #tstat .ts{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
html #tstat .ts button{border-radius:14px;border:1px solid var(--edge);background-color:var(--pn);background-image:linear-gradient(160deg,var(--hi),rgba(255,255,255,0) 60%);box-shadow:0 4px 14px var(--shade),0 0 12px var(--glow);padding:12px 10px;text-align:left;transition:transform .15s ease,box-shadow .15s ease}
html #tstat .ts button:hover{transform:translateY(-2px);box-shadow:0 8px 20px var(--shade),0 0 18px var(--glow)}
html .hub .hb{border-radius:14px;border:1px solid var(--edge);background-color:var(--pn);background-image:linear-gradient(160deg,var(--hi),rgba(255,255,255,0) 65%);box-shadow:0 6px 18px var(--shade),0 0 14px var(--glow);padding:14px 12px;transition:transform .2s ease,box-shadow .2s ease}
html .hub .hb:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:0 10px 24px var(--shade),0 0 22px var(--glow)}
html .aq{border-radius:12px;border:1px solid var(--edge);background-color:var(--p2);background-image:linear-gradient(160deg,var(--hi),rgba(255,255,255,0) 60%);box-shadow:0 3px 10px var(--shade);padding:10px 12px;margin-bottom:8px;transition:transform .15s ease}
html .aq:hover{transform:translateY(-1px)}

/* Music float button */
html #mus{border-radius:50%;width:44px;height:44px;min-height:44px;padding:0;display:grid;place-items:center;background:rgba(20,32,60,0.88);backdrop-filter:blur(8px);border:1.5px solid var(--gold);box-shadow:0 6px 18px rgba(0,0,0,0.4),0 0 14px rgba(242,193,78,0.3);transition:transform .2s ease,box-shadow .2s ease}
html #mus:hover{transform:scale(1.08);box-shadow:0 8px 22px rgba(0,0,0,0.45),0 0 20px rgba(242,193,78,0.5)}

@media(prefers-reduced-motion:reduce){html button:active{transform:none}}
`);
