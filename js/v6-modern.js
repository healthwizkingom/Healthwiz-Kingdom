/* v6: the modern type and layout pass (the owner's request, 2026-10-27: "some of the UI designs are too bland … change the fonts,
   size and colour to something more solid, modern and easy to read … some buttons, cards and text are arranged awkwardly").
   Not part of the original. Loaded last among the look files (after js/v6-arcane.js), so its rules come last; selectors start with
   `html` so they also beat styles injected later at the same weight. CSS only: no page, calculation or saved value is changed.
   * Fonts are chosen by situation, not forced to one face (docs/PIXEL_STYLE.md, "October 2026 pass"):
       - the pixel faces stay where the game speaks: the title screen, the HEALTHWIZ wordmark (Press Start 2P) and page titles
         (Pixelify Sans, now 24 px, bold, lower case allowed, so they read);
       - the system sans carries everything people read or tap in earnest: card headings, buttons, tabs, chips, labels, tags,
         and every health number (as before).
     This is done by pointing the label token --fl at the sans: every rule that used the label voice follows.
   * Buttons that sit in a row share the row's width evenly and centre their icon and text; range sliders get a visible track.
   * Health Hall tiles show the picture, the section name and the blue value only (the section's nickname and the "Tap to…"
     line stay in the page for screen readers, hidden visually).
   * Colour: every text colour here is a theme token, so it follows Default, Match system and Custom colour. */
HWUI.css('modern',`
html{--fl:var(--fn);--fd:'Pixelify Sans',var(--fn);--r-card:18px;--r-ctl:12px}
html body{font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
html h2{font:700 24px/1.25 var(--fd);letter-spacing:.2px;text-transform:none;margin:18px 0 12px;text-align:left}
html h3{font:700 14px/1.35 var(--fn);letter-spacing:.07em;text-transform:uppercase}
html button,html .chip,html summary{font-family:var(--fn);font-weight:650;letter-spacing:.02em}
html small,html .mut{line-height:1.45}html .mut{font-size:14px}html small{font-size:13px}
html .card{padding:14px;margin-bottom:16px}
@media(max-width:380px){html .card{padding:12px}}
html .card>h3:first-child{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin:0 0 12px;padding-bottom:10px;overflow-wrap:anywhere}
html .card p{margin:0 0 10px}html .card p:last-child{margin-bottom:0}

/* bottom tabs: sans, centred, same size */
html nav button{font:650 12px/1.2 var(--fn);letter-spacing:.01em;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center}

/* rows of buttons: even widths, centred content, no orphans stuck to the left */
html .row{display:flex;flex-wrap:wrap;gap:8px;align-items:stretch}
html .row>button:not(.chip),html .card>button,html #main>button{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-align:center;min-height:46px}
html .row>button:not(.chip){flex:1 1 140px}
html .row>.chip{flex:1 1 auto}
/* rows of equal choices sit in equal columns: the seven weekdays, the five restfulness faces */
html .row.v6ald{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}html .row.v6ald>.chip{padding:8px 0;min-width:0;font-size:12px}
html .row.v6rest{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
html .row>[data-a="slrest"]{padding:8px 2px;min-width:0;font-size:12px;line-height:1.25;white-space:normal;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
html .card>button:only-of-type{width:100%}
html .row>label{flex:1 1 140px;min-width:0}
html .card>.row:last-child{margin-bottom:0}

/* sliders: a real track and a big thumb (the music-volume slider showed only its thumb) */
html input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:32px;background:transparent;margin:8px 0;padding:0;border:0;box-shadow:none;accent-color:var(--gold)}
html input[type=range]::-webkit-slider-runnable-track{height:10px;border-radius:5px;background:var(--p2);border:2px solid var(--edge,var(--ln))}
html input[type=range]::-moz-range-track{height:10px;border-radius:5px;background:var(--p2);border:2px solid var(--edge,var(--ln))}
html input[type=range]::-moz-range-progress{height:10px;border-radius:5px;background:var(--gold)}
html input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;margin-top:-10px;border-radius:50%;background:var(--gold);border:3px solid var(--edge,var(--ln));box-shadow:0 2px 6px var(--shade,rgba(0,0,0,.35))}
html input[type=range]::-moz-range-thumb{width:24px;height:24px;border-radius:50%;background:var(--gold);border:3px solid var(--edge,var(--ln))}
html input[type=range]:focus-visible{outline:3px solid var(--accent,var(--blue));outline-offset:2px;border-radius:8px}

/* Health Hall tiles: emoji, name, blue value */
html #hub.hub{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
html #hub.hub .hb{min-height:140px;padding:16px 10px;gap:6px;border-radius:20px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
html #hub.hub .hb .bi{font-size:38px;line-height:1}
html #hub.hub .hb b{font:700 16px/1.25 var(--fn);margin:6px 0 0;letter-spacing:0;text-transform:none}
html #hub.hub .hb em{font:700 15px/1.35 var(--fn);color:#1b6aa8;margin:4px 0 0}
html[data-theme="dark"] #hub.hub .hb em{color:#8fd0ff}
@media(prefers-color-scheme:dark){html:not([data-theme="light"]) #hub.hub .hb em{color:#8fd0ff}}
html #hub.hub .hb small,html #hub.hub .hb .hwa{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
html #hub.hub .hb{position:relative}

/* Body & Energy: section headers and the BMI result */
html .sthd{display:flex;align-items:center;gap:12px;margin:22px 0 10px;padding:12px 14px;border-radius:var(--r-card);border:1px solid var(--edge,var(--ln));background:var(--pn)}
html .sthd>div{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0}
html .sthd b{font:700 18px/1.25 var(--fn);letter-spacing:0;text-transform:none}
html .sthd .pxtag{font:700 11px/1.4 var(--fn);letter-spacing:.08em;border-radius:999px;padding:1px 8px}
html .sthd small{color:var(--mut);font-size:13px}
html #bout{display:flex;flex-direction:column;gap:8px;margin:12px 0;padding:16px;border-radius:var(--r-card);background:var(--p2);text-align:center;align-items:center}
html #bout .big{font:700 52px/1 var(--fn);display:flex;align-items:center;justify-content:center;gap:8px}
html #bout .sc{width:100%;display:flex;height:12px;border-radius:6px;overflow:hidden;position:relative;margin:10px 0 2px}
html #avt{display:flex;flex-direction:column;align-items:center}
html .mac4{display:grid;grid-template-columns:1fr 1fr;gap:10px}

/* Health Time Machine: a segmented control, a centred date, a visible empty state */
html .tmviews{display:flex;gap:0;padding:4px;border-radius:999px;background:var(--p2);border:1px solid var(--edge,var(--ln));flex-wrap:nowrap}
html .tmviews .chip{flex:1 1 0;border-radius:999px;border:0;background:transparent;min-height:42px;box-shadow:none}
html .tmviews .chip.on{background:var(--gold);color:#1d1730}
html .tmnav{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin:12px 0}
html .tmnav b{text-align:center;font:700 16px/1.3 var(--fn)}
html .tmnav button{min-width:84px}
html .tmempty{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:22px 12px;border:2px dashed var(--edge,var(--ln));border-radius:var(--r-card);margin-top:12px;color:var(--mut)}
html .tmempty b{color:var(--ink);font:700 16px/1.3 var(--fn)}
html .tmsum{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 4px}
html .tmsum span{flex:1 1 90px;text-align:center;padding:8px 6px;border-radius:12px;background:var(--p2);font-size:13px}
html .tmsum span b{display:block;font:700 22px/1.2 var(--fn)}

/* Science Laboratory: four plain-language tool cards, then what / why / first step, readable on every theme */
html .labtabs{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}
html .labtool{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:12px;min-height:0;border-radius:var(--r-card);flex-wrap:nowrap;justify-content:flex-start}
html .labtool .labti{flex:0 0 auto;display:grid;place-items:center;width:40px;height:40px;border-radius:12px;background:var(--p2)}
html .labtool .labtt{display:flex;flex-direction:column;gap:2px;min-width:0}
html .labtool .labtn{font:700 11px/1.2 var(--fn);letter-spacing:.04em;color:var(--mut)}
html .labtool b{font:700 15px/1.25 var(--fn)}html .labtool .labtd{font:400 12.5px/1.4 var(--fn);color:var(--mut);letter-spacing:0}
html .labtool.on{background:var(--gold);color:#1d1730;border-color:var(--gold)}html .labtool.on .labtn,html .labtool.on .labtd{color:#3a2c0a}
@media(max-width:380px){html .labtabs{grid-template-columns:1fr}}
html .labinfo{display:grid;gap:10px;margin:0 0 14px;padding:14px;border-radius:var(--r-card);background:var(--pn);border:1px solid var(--edge,var(--ln))}
html .labinfo dt{font:700 12px/1.3 var(--fn);letter-spacing:.04em;color:var(--mut);margin:0 0 2px}
html .labinfo dd{margin:0;font:400 15px/1.5 var(--fn);color:var(--ink)}
html .labintro{padding:14px}html .labintro p{font-size:14px}
html .labq{min-height:64px;text-align:left;justify-content:flex-start;gap:12px}html .labq small{display:block;color:#3a2c0a;font-weight:400;font-size:13px;letter-spacing:0}

/* Ask Luna, Luna's header button and Luke are drawn smooth, never as chunky pixels (the speech bubble keeps her pixel figure) */
html .v6lp .v6lpf,html .v6lmini,html .v6lbust,html .awfig,html .awface,html .awmfig{image-rendering:auto}
`);
