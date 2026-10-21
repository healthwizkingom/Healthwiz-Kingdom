/* v6: the Campus Health Observatory's styles (js/v6-campus.js), split from it to keep each file under 64 KB. Not part of the original.
   Layout and the panel (they work without the map); the map's own pieces (markers, clusters, labels) are in
   observatory/observatory.css. The map stage takes the mode's colour tokens; the panel keeps the app's theme. */
HWUI.css('campus',`
.cmpwrap{display:grid;gap:12px;margin:10px 0}/* one column on every screen: the map across the page's width, Staircases and Details below it */
.cmpstage{position:relative;height:clamp(380px,62vh,620px);border-radius:14px;overflow:hidden;border:1px solid var(--edge,var(--ln));
  --panel:#ffffff;--panel2:#f4f5f2;--ink:#1d232b;--mut:#5a6470;--line:#d7dbe0;--acc:#2864d8;--acc-ink:#fff;--gold:#c99a2e;--cyan:#0f8f96;--font:var(--fn,system-ui,sans-serif);--head:var(--font);
  --shadow:0 6px 24px rgba(20,30,50,.14),0 1px 3px rgba(20,30,50,.12);--m1:#2f9a5f;--m2:#c98a0b;--m3:#cc3f35;--est:#b26b00;--part:#0f7f86;--osm:#3f6fb5;--miss:#7a828c;--ter:#8a6d3b;background:#e6e9e2;color:var(--ink)}
.cmpcard[data-mode="fantasy"] .cmpstage{--panel:rgba(14,22,54,.95);--panel2:#16224f;--ink:#eef1ff;--mut:#a9b3d9;--line:rgba(140,160,230,.26);--acc:#f2c14e;--acc-ink:#1a1430;--gold:#f2c14e;--cyan:#5fe1e6;--head:var(--fl,var(--font));
  --shadow:0 0 0 1px rgba(242,193,78,.28),0 0 30px rgba(95,225,230,.10),0 12px 40px rgba(0,0,0,.5);--m1:#7ee07c;--m2:#f6c94f;--m3:#ff7b6e;--est:#ffd27a;--part:#63e6dc;--osm:#9cc0ff;--miss:#a6aed6;--ter:#d8c3ff;background:#0c2422}
.cmpstage.cmpfull{position:fixed;inset:0;z-index:1000;height:auto;border-radius:0;border:0}html.cmp-fs,html.cmp-fs body{overflow:hidden}
.cmpfull .cmpctls{top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right))}.cmpfull .cmpmodes{top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left))}
.cmpfull .cmpleg{bottom:max(30px,env(safe-area-inset-bottom))}
.cmpstage.cmpoff{height:auto;min-height:0;background:var(--p2);color:inherit}.cmpnomap{padding:14px;font-size:15px}.cmpnomap svg{vertical-align:-3px}
.cmpslot,.cmpslot>.cmpmap,.cmpslot>.cmpmap.maplibregl-map{position:absolute;inset:0;width:100%;height:100%}.cmpmsg[hidden]{display:none}.cmpmsg{position:absolute;inset:0;display:grid;place-items:center;padding:20px;text-align:center;background:var(--panel2);color:var(--mut);z-index:4}
.cmpmodes{position:absolute;left:10px;top:10px;z-index:6;display:flex;gap:2px;padding:3px;border-radius:999px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)}
.cmpmode{border:0;margin:0;min-height:40px;padding:0 12px;border-radius:999px;background:transparent;color:var(--mut);font:600 13px var(--head);box-shadow:none}
.cmpmode[aria-pressed="true"]{background:var(--acc);color:var(--acc-ink)}
.cmpctls{position:absolute;right:10px;top:10px;z-index:6;display:flex;flex-direction:column;gap:6px}
.cmpctl{width:44px;height:44px;min-height:44px;margin:0;padding:0;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--ink);box-shadow:var(--shadow);font:700 16px var(--font);display:grid;place-items:center}
.cmpctl[aria-pressed="true"]{background:var(--acc);color:var(--acc-ink);border-color:transparent}.cmpctl svg{width:20px;height:20px}
.cmppill{position:absolute;z-index:6;left:10px;right:64px;top:62px;display:flex;align-items:center;gap:8px;max-width:max-content;padding:4px 4px 4px 12px;border-radius:999px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);color:var(--ink);font-size:14px}
.cmppd{width:10px;height:10px;border-radius:50%;background:var(--acc);flex:0 0 auto}.cmppt{min-width:0;display:flex;gap:8px;align-items:baseline;overflow:hidden}.cmppt b{flex:0 0 auto}
.cmppt span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mut);font-size:13px}
.cmpsb{margin:0;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);font:600 13px var(--font);flex:0 0 auto;box-shadow:none}
.cmpsx{margin:0;width:36px;height:36px;min-height:36px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--ink);font-size:20px;flex:0 0 auto;box-shadow:none}
.cmpleg{position:absolute;left:10px;bottom:30px;z-index:6;max-width:min(340px,calc(100% - 80px));background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);color:var(--ink);font-size:12.5px;padding:0 10px}
.cmpleg summary{cursor:pointer;min-height:40px;display:flex;align-items:center;font:600 13px var(--head)}.cmpleg p{margin:6px 0}
.cmplg{display:inline-block;width:12px;height:12px;border-radius:50%;margin:0 4px 0 6px;vertical-align:-1px}.cmplg:first-child{margin-left:0}
.cmplg.m1{background:var(--m1)}.cmplg.m2{background:var(--m2)}.cmplg.m3{background:var(--m3)}.cmplg.est{border:2px dashed var(--est)}.cmplg.part{background:var(--part)}
.cmplg.osm{border-radius:3px;background:var(--osm)}.cmplg.ter{border-radius:2px;background:linear-gradient(135deg,var(--cyan) 50%,var(--gold) 50%)}.cmplg.deco{background:radial-gradient(circle,#fff0a8,#f2c14e 45%,transparent 70%)}
.cmppanel{border:1px solid var(--edge,var(--ln));border-radius:14px;background:var(--p2);overflow:hidden;min-width:0}
@media(min-width:900px){.cmpstage:not(.cmpfull):not(.cmpoff){height:clamp(440px,68vh,720px)}}
.cmpfind{position:absolute;z-index:7;left:10px;top:58px;width:min(360px,calc(100% - 74px))}
.cmpfind input{width:100%;box-sizing:border-box;min-height:44px;margin:0;padding:0 44px 0 12px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--ink);box-shadow:var(--shadow);font:15px var(--font)}
.cmpfind .cmpqx{color:var(--mut)}.cmpfres{list-style:none;margin:4px 0 0;padding:0;max-height:min(300px,45vh);overflow:auto;border-radius:12px}.cmpfres:empty{display:none}
.cmpfres{background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)}.cmpfres li+li{border-top:1px solid var(--line)}
.cmpfr{width:100%;margin:0;min-height:48px;padding:6px 10px;display:flex;align-items:center;gap:10px;text-align:left;border:0;border-radius:0;background:transparent;color:var(--ink);box-shadow:none;font:14px var(--font)}
.cmpfr span{display:flex;flex-direction:column;min-width:0}.cmpfr b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cmpfr small{color:var(--mut)}.cmpfr .cmpdot{grid-row:auto;flex:0 0 auto}
.cmpfmore{padding:8px 12px;font-size:13px;color:var(--mut)}
.cmpstage .cmppill,.cmpstage .cmpav{top:110px}
.cmplog{border:2px solid var(--gold,#f6c94f);border-radius:12px;padding:10px 12px;margin:8px 0 10px}.cmplog>h3{margin:0 0 8px;font-size:14px}.cmplog>h3 svg{vertical-align:-3px}
.cmplog .card{margin-left:0;margin-right:0}
@media(max-width:599px){/* phones: the forms keep their width inside Details (no card-in-card padding) */
.cmppane{padding:8px 6px 12px}.cmplog{padding:8px 4px;border-width:2px 0;border-radius:0}.cmplog .card{padding-left:4px;padding-right:4px;border-left:0;border-right:0;box-shadow:none}}
.cmptabs{display:flex;border-bottom:1px solid var(--edge,var(--ln))}.cmptabs button{flex:1;margin:0;min-height:44px;border:0;border-radius:0;background:transparent;color:var(--mut);box-shadow:none;border-bottom:3px solid transparent}
.cmptabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--gold,#f6c94f)}
.cmppane{padding:10px 12px 14px;min-width:0}
.cmpsearch{position:relative}.cmpsearch input{width:100%;min-height:44px;padding-right:44px;box-sizing:border-box}
.cmpqx{position:absolute;right:4px;top:4px;margin:0;width:36px;height:36px;min-height:36px;padding:0;border:0;background:transparent;box-shadow:none;color:var(--mut);font-size:20px}
.cmpvh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cmpfilters{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px}.cmpf{margin:0;min-height:44px;padding:0 12px;border-radius:999px;font-size:13px}.cmpf span{opacity:.75}
.cmpf[aria-pressed="true"]{outline:2px solid var(--gold,#f6c94f);outline-offset:1px;color:var(--ink)}
.cmpcount{margin:4px 0 8px;font-size:12px;color:var(--mut)}.cmpsmall{font-size:12.5px}
.cmplist{list-style:none;margin:0;padding:0}.cmplist li+li{margin-top:6px}
@media(max-width:899px){#cmplist{max-height:55vh;overflow:auto;overscroll-behavior:contain}}
.cmpitem{width:100%;margin:0;color:var(--ink);text-align:left;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;min-height:52px;padding:8px 10px;border-radius:12px;box-shadow:none}
.cmpitem[aria-current="true"]{outline:2px solid var(--gold,#f6c94f);outline-offset:-2px}
.cmpnm{font-weight:600;font-size:14px;line-height:1.3;overflow-wrap:anywhere}.cmpmeta{grid-column:2;font-size:12px;color:var(--mut);display:flex;flex-wrap:wrap;gap:4px 8px}
.cmpdot{grid-row:span 2;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:700 12px var(--fn,sans-serif);color:#14102e}
.cmpdot.c1{background:#7ee07c}.cmpdot.c2{background:#f6c94f}.cmpdot.c3{background:#ff8a7e}.cmpdot.nol{border:2px dashed var(--mut);color:var(--mut)}
.cmpback,.cmplnk{margin:0;min-height:40px;padding:0 4px;border:0;background:transparent;box-shadow:none;color:var(--gold,#f6c94f)}.cmplnk{text-decoration:underline;min-height:32px}
.cmpeye{margin:6px 0 0;font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}.cmph{margin:2px 0 6px;overflow-wrap:anywhere}.cmpmine{margin:4px 0;font-size:13px}
.cmpact{margin:6px 0 4px}.cmpact button{min-height:44px}
.cmpgrp{border:1px solid var(--edge,var(--ln));border-radius:12px;padding:10px 12px;margin-top:10px}.cmpgrp h3{margin:0 0 8px;font-size:14px}.cmpgrp h3 svg{vertical-align:-3px}
.cmpfacts{margin:0;display:grid;grid-template-columns:minmax(92px,auto) 1fr;gap:6px 10px;font-size:13.5px}.cmpfacts dt{color:var(--mut);font-weight:600}.cmpfacts dd{margin:0;overflow-wrap:anywhere;min-width:0}
.cmpsrc{display:block;font-size:12px;color:var(--mut)}.cmpna{color:var(--mut);font-style:italic}.cmpnum{font-variant-numeric:tabular-nums}
.cmpchips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;padding:0;list-style:none}
.cmpchip{font-size:12px;font-weight:700;border-radius:999px;padding:3px 9px;border:1.5px solid currentColor;line-height:1.3}
.cmpchip.est{color:#e7a93a;border-style:dashed}.cmpchip.miss{color:var(--mut);border-style:dashed}.cmpchip.part{color:#43c6bf}.cmpchip.calc{color:#43c6bf;border-style:dotted}.cmpchip.flag{color:var(--red,#ff6b5e)}
.cmpnotes{margin:10px 0 0;padding:10px;border-radius:10px;border:1px dashed var(--edge,var(--ln));font-size:13px}
.cmpwx{border-top:1px solid var(--edge,var(--ln));padding-top:8px;margin-top:10px}.cmpwx svg{vertical-align:-3px}.cmpe{color:var(--red);font-weight:bold}
.cmpsv{font-size:12.5px;margin:4px 0}
.cmpvw{border:1px solid var(--edge,var(--ln));border-radius:12px;padding:10px;margin:8px 0}.cmpvwh{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.cmpvwx{margin:0;width:44px;height:44px;min-height:44px;padding:0;font-size:20px;flex:0 0 auto}
.cmpvws{position:relative;height:min(300px,42vh);min-height:220px;border-radius:10px;overflow:hidden;background:#0d1430;margin:6px 0}
.cmpvwslot,.cmpvwhost,.cmpvwcv{position:absolute;inset:0}.cmpvwcv{touch-action:none}.cmpvwcv canvas{display:block;width:100%!important;height:100%!important}
.cmpvwmsg{position:absolute;inset:0;display:grid;place-items:center;padding:16px;text-align:center;background:rgba(13,20,48,.92);color:#d8deff}.cmpvwmsg[hidden]{display:none}
.cmpillus{position:absolute;left:8px;right:8px;bottom:8px;margin:0;padding:6px 10px;border-radius:9px;font-size:12.5px;font-weight:700;text-align:center;border:1.5px dashed #c9b6ff;color:#e6dcff;background:rgba(13,20,48,.82);pointer-events:none}
.cmpvwc,.cmpvwshapes{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.cmpvb{margin:0;min-width:44px;min-height:44px;padding:0 10px;font-size:14px}.cmpvb[aria-pressed="true"]{outline:2px solid var(--gold,#f6c94f);outline-offset:1px}
.cmpvwmore{margin-top:8px;font-size:13px}.cmpvwmore summary{cursor:pointer;min-height:40px;display:flex;align-items:center;font-weight:600}.cmpvwmore ul{margin:4px 0;padding-left:18px}
.cmpchip.ill{color:#c9b6ff;border-style:dashed}
.cmploc{display:block;width:20px;height:20px;border-radius:50%;border:2.5px solid currentColor;position:relative}.cmploc::after{content:"";position:absolute;inset:4px;border-radius:50%;background:currentColor}
.cmpmebar{position:absolute;z-index:7;left:10px;right:64px;bottom:84px;display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:max-content;padding:4px 4px 4px 12px;border-radius:16px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);color:var(--ink);font-size:13px}
.cmpmed{width:12px;height:12px;border-radius:50%;background:#2864d8;flex:0 0 auto}.cmpmebar[data-st="demo"] .cmpmed{background:var(--gold)}.cmpmebar[data-st="error"] .cmpmed{background:#c9483c}.cmpmet{min-width:0;color:var(--mut)}.cmpmet b{color:var(--ink)}
.cmpav{position:absolute;z-index:8;left:10px;right:64px;top:62px;max-width:420px;max-height:calc(100% - 80px);overflow:auto;padding:10px 12px;border-radius:14px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);color:var(--ink)}
.cmpav ul{list-style:none;margin:6px 0;padding:0}.cmpav li{margin:6px 0}.cmpavb{width:100%;margin:0;min-height:44px;text-align:left;color:var(--ink)}.cmpavb[aria-pressed="true"]{outline:2px solid var(--gold,#f6c94f)}.cmpcred{display:block;color:var(--mut);font-size:12px;margin-top:2px}.cmpav a{color:var(--acc)}
.cmplg.vis{border:2px solid #63e6dc}
/* fantasy (integration Phase 4): the panels take the prototype's small gold corner brackets and a moonlit edge; the text,
   numbers and labels keep the app's readable sans and contrast, so the health information stays ahead of the decoration */
.cmpcard[data-mode="fantasy"] .cmppanel,.cmpcard[data-mode="fantasy"] .cmpvw{position:relative;border-color:rgba(242,193,78,.45);box-shadow:0 0 0 1px rgba(242,193,78,.12),0 0 22px rgba(95,225,230,.10)}
.cmpcard[data-mode="fantasy"] .cmppanel::before,.cmpcard[data-mode="fantasy"] .cmpvw::before{content:"";position:absolute;inset:5px;pointer-events:none;z-index:1;opacity:.75;
  background:linear-gradient(#f2c14e,#f2c14e) left top/12px 2px no-repeat,linear-gradient(#f2c14e,#f2c14e) left top/2px 12px no-repeat,linear-gradient(#f2c14e,#f2c14e) right top/12px 2px no-repeat,linear-gradient(#f2c14e,#f2c14e) right top/2px 12px no-repeat,
  linear-gradient(#f2c14e,#f2c14e) left bottom/12px 2px no-repeat,linear-gradient(#f2c14e,#f2c14e) left bottom/2px 12px no-repeat,linear-gradient(#f2c14e,#f2c14e) right bottom/12px 2px no-repeat,linear-gradient(#f2c14e,#f2c14e) right bottom/2px 12px no-repeat}
.cmpcard[data-mode="fantasy"] .cmpgrp h3,.cmpcard[data-mode="fantasy"] .cmpeye{color:var(--gold,#f6c94f)}
/* the sky on the map (observatory/sky.js): a tint, a fog or haze veil and the rain, over the map canvas and under the markers;
   plain CSS, so the map never redraws for them (the rain moves on the compositor; still with reduced motion) */
.cmpsky,.cmpsky i{position:absolute;inset:0;pointer-events:none}.cmpsky{overflow:hidden}
.cmpsky-tint{background:var(--tintc,#000);opacity:var(--tint,0);transition:opacity .8s,background-color .8s}
.cmpsky-veil{background:linear-gradient(to bottom,var(--veilc,#fff) 0%,var(--veilc,#fff) 22%,color-mix(in srgb,var(--veilc,#fff) 45%,transparent) 100%);opacity:calc(var(--veil,0) * .8);transition:opacity .8s}
.cmpsky-rain{display:none;opacity:calc(.25 + var(--rain,0) * .6)}.cmpsky.wet .cmpsky-rain{display:block}
.cmpsky-rain::before{content:"";position:absolute;left:-10%;right:-10%;top:-100%;height:200%;will-change:transform;animation:cmprain .55s linear infinite;
  background:repeating-linear-gradient(104deg,rgba(214,226,255,.55) 0 1px,transparent 1px 11px),repeating-linear-gradient(98deg,rgba(214,226,255,.35) 0 1px,transparent 1px 17px)}
.cmpsky.still .cmpsky-rain::before{animation:none;top:-50%}
@keyframes cmprain{to{transform:translate3d(-24px,50%,0)}}
.cmpskyp{position:absolute;right:58px;top:10px;z-index:7;display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:min(330px,calc(100% - 80px));padding:8px 10px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);color:var(--ink)}
.cmpskyp b{width:100%;font-size:13px}.cmpskyp .cmpsb{min-height:36px}.cmpskyp .cmpsb[aria-pressed="true"]{outline:2px solid var(--acc,#f2c14e)}.cmpskyp small{width:100%;color:var(--mut);font-size:12px}
.cmpskycap{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);z-index:5;margin:0;padding:2px 8px;border-radius:8px;background:var(--panel);color:var(--ink);font-size:12px;white-space:nowrap;max-width:calc(100% - 200px);overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.cmpskycap:empty{display:none}
.cmplg.sky{border-radius:3px;background:linear-gradient(180deg,#5a6aa6,#f39a6b)}
`);
