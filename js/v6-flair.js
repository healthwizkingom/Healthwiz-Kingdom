/* v6: visual flair, one colour world per region of the kingdom (the owner's request, 2026-10-27: "add more visual designs or
   effects, these all still look bland"). Not part of the original. Loaded after js/v6-modern.js, so its rules come last.
   CSS and one tiny hook only: no page, calculation or saved value changes.
   * Every page gets a region colour, --rg, set on <html> after each render (html[data-view]): Water tide blue, Food ember,
     Sleep dusk violet, Stress rose, Stairs and Exercise jade, Body gold, Statistics cyan, and so on. Health Hall tiles carry
     their own region colour too (they already have data-v).
   * What the colour does, and only this: a faint aurora behind the page, a coloured banner with a pattern that belongs to the
     region (waves, embers, stars, steps…) and a painted scene where the app already has one (Dream Quest: the bedroom, Stress:
     Medius's study, the Monument, the Orb), a glowing top edge and corner light on cards, glass-like progress bars, and Health
     Hall tiles that glow in their region's colour and pop in one after another when the hall opens (the one orchestrated moment).
   * Everything is a theme token underneath (surfaces, ink and edges follow Default, Match system and Custom colour); only the
     region accent is fixed. Text colours are untouched, so contrast is unchanged. The animation is a one-off entrance and a
     banner sheen; both stop with reduced motion and in the Performance mode. */
const HWFlair=(()=>{
const RG={home:'#8b7bff',health:'#8b7bff',water:'#2aa6d8',food:'#f0a03c',sleep:'#8b7bff',stress:'#e0607e',stair:'#3fbf8f',exercise:'#3fbf8f',
  run:'#3fbf8f',campus:'#3fbf8f',pulse:'#e8534a',body:'#f2c14e',stats:'#5ad0e6',score:'#f2c14e',time:'#5ad0e6',lab:'#a78bfa',monument:'#f2c14e',
  kingdom:'#8fd36a',quests:'#f2a33a',set:'#7d93ad',bmi:'#f2c14e',calc:'#f2c14e'};
const pat=(w,h,body)=>"url(\"data:image/svg+xml,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='"+w+"' height='"+h+"'>"+body+"</svg>")+"\")";
const W='fill="none" stroke="white" stroke-opacity=".28" stroke-width="2"',F='fill="white" fill-opacity=".30"';
const PATS={
  water:pat(44,14,'<path d="M0 8Q11 1 22 8T44 8" '+W+'/>'),
  food:pat(30,30,'<path d="M8 14l3 3-3 3-3-3z" '+F+'/><path d="M22 4l2 2-2 2-2-2z" '+F+'/><path d="M20 24l2 2-2 2-2-2z" '+F+'/>'),
  sleep:pat(60,40,'<circle cx="8" cy="9" r="1.6" '+F+'/><circle cx="34" cy="22" r="1.2" '+F+'/><circle cx="50" cy="6" r="1.8" '+F+'/><path d="M22 34l1.6 3.4 3.4 1.6-3.4 1.6L22 44l-1.6-3.4L17 39l3.4-1.6z" '+F+'/>'),
  stress:pat(36,36,'<circle cx="9" cy="9" r="5" '+W+'/><circle cx="27" cy="25" r="7" '+W+'/>'),
  stair:pat(36,24,'<path d="M0 22h9v-7h9V8h9V1h9" '+W+'/>'),
  body:pat(40,28,'<path d="M20 4v20M10 8h20" '+W+'/>'),
  stats:pat(40,24,'<path d="M4 20V12M14 20V6M24 20V10M34 20V3" '+W+'/>'),
  lab:pat(34,34,'<circle cx="8" cy="26" r="3" '+W+'/><circle cx="24" cy="10" r="2" '+W+'/><circle cx="27" cy="29" r="1.4" '+F+'/>'),
  time:pat(40,40,'<circle cx="20" cy="20" r="13" '+W+'/><path d="M20 12v8l5 3" '+W+'/>'),
  monument:pat(36,26,'<path d="M0 24h12v-8h12V8h12" '+W+'/>')};
PATS.exercise=PATS.stair;PATS.run=PATS.stair;PATS.campus=PATS.stair;PATS.pulse=PATS.stats;PATS.score=PATS.body;PATS.bmi=PATS.body;PATS.calc=PATS.body;
// painted scenes the app already ships (no new images): drawn faintly behind the banner on the right
const SCENE={sleep:'assets/img/bedroom.webp',stress:'assets/img/study.jpg',monument:'assets/img/monument-card.webp',score:'assets/img/orb-scene.webp',lab:'assets/img/lab-scene.webp'};
// Health Hall tile colours (data-v of each tile)
const TILE={food:'#f0a03c',sleep:'#8b7bff',stair:'#3fbf8f',exercise:'#e8734a',stress:'#e0607e',body:'#f2c14e',stats:'#5ad0e6',score:'#f2c14e',water:'#2aa6d8',pulse:'#e8534a',run:'#3fbf8f'};

HWUI.css('flair',`
/* the region colour of the page; set by the hook below */
html{--rg:#8b7bff;--rg-soft:color-mix(in srgb,var(--rg) 16%,transparent);--rg-mid:color-mix(in srgb,var(--rg) 34%,transparent)}
/* a faint aurora behind everything on the page */
html #main{position:relative}
html #main::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:radial-gradient(520px 300px at 88% -4%,var(--rg-mid),transparent 70%),radial-gradient(420px 320px at -8% 62%,var(--rg-soft),transparent 72%)}

/* page title: the region colour runs through it */
html h2{background:linear-gradient(90deg,var(--ink) 30%,color-mix(in srgb,var(--rg) 55%,var(--ink)));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;text-shadow:none!important;width:fit-content;max-width:100%}
html h2 img,html h2 svg,html h2 canvas{-webkit-text-fill-color:initial}

/* cards: a glowing top edge in the region colour, and light in the corner */
html #main .card,html #main .pxp{position:relative;background-image:radial-gradient(260px 130px at 100% 0,var(--rg-soft),transparent 70%),linear-gradient(180deg,var(--hi,rgba(255,255,255,.05)),rgba(255,255,255,0) 72px)}
html #main .card::before{display:block;content:"";position:absolute;left:14px;right:14px;top:-1px;height:3px;border-radius:0 0 3px 3px;background:linear-gradient(90deg,var(--rg),color-mix(in srgb,var(--rg) 0%,transparent) 85%);opacity:.95;pointer-events:none}
html #main .card>h3:first-child svg,html #main .card>h3:first-child img,html #main .card>h3:first-child canvas{filter:drop-shadow(0 0 6px var(--rg))}

/* banner under the app header: coloured, patterned, with the region's picture where there is one */
html .hwcr{position:relative;overflow:hidden;border-radius:var(--r-card);padding:10px 12px;border:1px solid color-mix(in srgb,var(--rg) 45%,var(--edge,var(--ln)));
  background:linear-gradient(105deg,color-mix(in srgb,var(--rg) 34%,var(--pn)),var(--pn) 78%);box-shadow:0 8px 24px rgba(0,0,0,.22),0 0 22px var(--rg-soft)}
html .hwcr::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:var(--rgp,none);background-size:auto;opacity:.55;-webkit-mask-image:linear-gradient(90deg,transparent 20%,#000);mask-image:linear-gradient(90deg,transparent 20%,#000)}
html .hwcr::after{content:"";position:absolute;top:0;bottom:0;left:-40%;width:35%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.22),transparent);transform:skewX(-18deg);animation:hwsheen 1.4s ease-out .25s 1 both}
@keyframes hwsheen{from{left:-40%}to{left:130%}}
html .hwcr>*{position:relative;z-index:1}
html .hwct>span:first-child{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:color-mix(in srgb,var(--rg) 26%,var(--p2));box-shadow:0 0 16px var(--rg-mid),inset 0 1px 0 rgba(255,255,255,.25)}
html .hwct b{font:700 18px/1.25 var(--fn);letter-spacing:0;text-transform:none}
html .hwct .hwtg{display:inline-block;margin-top:3px;font:700 11px/1.4 var(--fn);letter-spacing:.06em;padding:1px 8px;border-radius:999px;background:color-mix(in srgb,var(--rg) 28%,transparent);color:var(--ink)}
${Object.entries(SCENE).map(([k,u])=>'html[data-view="'+k+'"] .hwcr{background-image:linear-gradient(90deg,color-mix(in srgb,var(--rg) 20%,var(--pn)) 12%,color-mix(in srgb,var(--rg) 12%,transparent) 70%),url('+u+');background-size:auto,cover;background-position:0 0,center}').join('\n')}

/* progress bars: glass tubes with a lit fill */
html .bar{height:12px;border-radius:999px;background:var(--p2);border:1px solid var(--edge,var(--ln));overflow:hidden;box-shadow:inset 0 2px 4px rgba(0,0,0,.25)}
html .bar>i{display:block;height:100%;border-radius:999px;background:linear-gradient(180deg,color-mix(in srgb,var(--c,var(--rg)) 55%,#fff) 0,var(--c,var(--rg)) 45%,color-mix(in srgb,var(--c,var(--rg)) 70%,#000) 100%);box-shadow:0 0 12px color-mix(in srgb,var(--c,var(--rg)) 70%,transparent)}

/* stat tiles: a coloured edge and a bigger number */
html #main .t{position:relative;overflow:hidden;padding-left:16px}
html #main .t::before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:0 4px 4px 0;background:var(--rg);box-shadow:0 0 10px var(--rg-mid)}

/* primary buttons: lit from above, a soft coloured shadow, a press */
html button:not(.g):not(.chip):not(.sm):not([data-a="go"].hb){box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -3px 0 rgba(0,0,0,.18),0 8px 18px color-mix(in srgb,var(--gold) 32%,transparent);transition:transform .12s ease,box-shadow .12s ease}
html button:not(.g):not(.chip):not(.sm):active{transform:translateY(2px);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 3px 8px color-mix(in srgb,var(--gold) 25%,transparent)}
html .chip.on{box-shadow:0 0 0 2px var(--gold),0 6px 16px color-mix(in srgb,var(--gold) 38%,transparent)}

/* the bottom menu: the current tab glows */
html nav button[aria-current],html nav button.on,html nav button[aria-selected="true"]{box-shadow:0 0 0 2px var(--gold),0 0 18px color-mix(in srgb,var(--gold) 55%,transparent)}

/* Health Hall: each tile is its region, lit from the top, and the hall opens with the tiles popping in one after another */
html #hub.hub .hb{--tc:#8b7bff;position:relative;overflow:hidden;
  background:radial-gradient(150px 110px at 50% -6%,color-mix(in srgb,var(--tc) 42%,transparent),transparent 72%),linear-gradient(165deg,var(--pn),var(--p2));
  border:1px solid color-mix(in srgb,var(--tc) 60%,var(--edge,var(--ln)));
  box-shadow:0 10px 24px rgba(0,0,0,.28),0 0 20px color-mix(in srgb,var(--tc) 26%,transparent),inset 0 1px 0 rgba(255,255,255,.14);
  transition:transform .18s cubic-bezier(.34,1.56,.64,1),box-shadow .18s ease;animation:hwpop .5s cubic-bezier(.34,1.56,.64,1) both}
html #hub.hub .hb::after{content:"";position:absolute;left:12%;right:12%;bottom:0;height:3px;border-radius:3px 3px 0 0;background:var(--tc);box-shadow:0 0 12px var(--tc)}
html #hub.hub .hb .bi{filter:drop-shadow(0 6px 10px color-mix(in srgb,var(--tc) 55%,transparent))}
html #hub.hub .hb:active{transform:scale(.96)}
html #hub.hub .hb:nth-child(2){animation-delay:.06s}html #hub.hub .hb:nth-child(3){animation-delay:.12s}html #hub.hub .hb:nth-child(4){animation-delay:.18s}
html #hub.hub .hb:nth-child(5){animation-delay:.24s}html #hub.hub .hb:nth-child(6){animation-delay:.30s}html #hub.hub .hb:nth-child(7){animation-delay:.36s}html #hub.hub .hb:nth-child(8){animation-delay:.42s}
@keyframes hwpop{from{opacity:0;transform:translateY(14px) scale(.92)}to{opacity:1;transform:none}}
${Object.entries(TILE).map(([k,c])=>'html #hub.hub .hb[data-v="'+k+'"]{--tc:'+c+'}').join('')}
@media(hover:hover){html #hub.hub .hb:hover{transform:translateY(-4px)}}

/* nothing moves with reduced motion or in the Performance mode */
html.hw-rm .hwcr::after,html.hw-q-performance .hwcr::after,html.hw-rm #hub.hub .hb,html.hw-q-performance #hub.hub .hb{animation:none!important}
@media(prefers-reduced-motion:reduce){html .hwcr::after,html #hub.hub .hb{animation:none!important}}
html.hw-q-performance #main::before{display:none}
${Object.entries(PATS).map(([k,u])=>'html[data-view="'+k+'"]{--rgp:'+u+'}').join('\n')}
`);


/* ---------- scene headers: a small illustrated landscape behind each page's title (SVG drawn here, no image files) ---------- */
const rnd=i=>{const x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x)};
const mx=(p,c)=>'color-mix(in srgb,var(--rg) '+p+'%,'+c+')';
const stars=(n,h)=>Array.from({length:n},(_,i)=>'<circle class="fxs" cx="'+(rnd(i)*390).toFixed(0)+'" cy="'+(rnd(i+50)*h).toFixed(0)+'" r="'+(.6+rnd(i+9)*1.3).toFixed(1)+'" style="animation-delay:'+(rnd(i+3)*3).toFixed(1)+'s"/>').join('');
const hills=()=>'<path d="M0 112C60 90 110 100 170 108S300 92 390 104V150H0Z" style="fill:'+mx(34,'#0b0a1f')+'"/><path d="M0 132C70 114 140 128 210 122S330 114 390 128V150H0Z" style="fill:'+mx(18,'#07061a')+'"/>';
const cloud=(x,y,sc,d)=>'<g class="fxc" style="animation-duration:'+d+'s" transform="translate('+x+' '+y+') scale('+sc+')"><ellipse cx="0" cy="0" rx="22" ry="7"/><ellipse cx="-10" cy="-5" rx="11" ry="8"/><ellipse cx="8" cy="-7" rx="13" ry="9"/></g>';
const wave=(y,amp,op,dur,c)=>'<path class="fxw" style="animation-duration:'+dur+'s;fill:'+c+';opacity:'+op+'" d="M0 '+y+('q32.5 -'+amp+' 65 0t65 0').repeat(1)+'t65 0t65 0t65 0t65 0t65 0t65 0t65 0V150H0Z"/>';
const castle=(x,k)=>'<g transform="translate('+x+' '+(112-70*k)+') scale('+k+')" style="fill:#0a0820"><rect x="6" y="26" width="64" height="56"/><rect x="-6" y="10" width="20" height="72"/><rect x="62" y="10" width="20" height="72"/><path d="M-9 10l13-20 13 20zM59 10l13-20 13 20z"/><path d="M26 26l12-26 12 26z"/><rect x="33" y="56" width="10" height="26" style="fill:var(--gold)"/><rect x="2" y="30" width="5" height="9" style="fill:#ffe9a0"/><rect x="69" y="30" width="5" height="9" style="fill:#ffe9a0"/><rect x="34" y="34" width="5" height="9" style="fill:#ffe9a0"/></g>';
const moon=(x,y,r)=>'<circle cx="'+x+'" cy="'+y+'" r="'+(r*2.4)+'" style="fill:rgba(255,244,200,.12)"/><circle cx="'+x+'" cy="'+y+'" r="'+r+'" style="fill:#fff3c4"/><circle cx="'+(x+r*.5)+'" cy="'+(y-r*.25)+'" r="'+(r*.88)+'" style="fill:'+mx(52,'#0d0b26')+'"/>';
const sun=(x,y,r,c)=>'<circle cx="'+x+'" cy="'+y+'" r="'+(r*2.2)+'" style="fill:'+c+';opacity:.18"/><circle cx="'+x+'" cy="'+y+'" r="'+r+'" style="fill:'+c+'"/>';
const tree=(x,h)=>'<path d="M'+x+' 128l-'+(h*.3)+' 0 '+(h*.3)+' -'+h+' '+(h*.3)+' '+h+'z" style="fill:#0a0820"/><path d="M'+x+' 128l-'+(h*.22)+' -'+(h*.5)+' '+(h*.22)+' -'+(h*.9)+' '+(h*.22)+' '+(h*.9)+'z" style="fill:#0a0820;opacity:.0"/>';
const fire=(n)=>Array.from({length:n},(_,i)=>'<circle class="fxs fxf" cx="'+(20+rnd(i+70)*350).toFixed(0)+'" cy="'+(60+rnd(i+80)*60).toFixed(0)+'" r="1.8" style="animation-delay:'+(rnd(i+5)*3).toFixed(1)+'s"/>').join('');
const bars=(c)=>[34,58,44,78,62,92,70].map((h,i)=>'<rect x="'+(210+i*22)+'" y="'+(122-h)+'" width="14" height="'+h+'" rx="2" style="fill:'+c+';opacity:'+(.55+i*.06)+'"/>').join('');
const stairs=()=>'<path d="M170 128l60-26 40-30 50-26 70-18V150H170Z" style="fill:'+mx(24,'#07061a')+'"/><path d="M196 124h16v-10h16v-10h16v-10h16V84h16V74h16V64h16V54h16" fill="none" style="stroke:var(--gold);stroke-width:3;stroke-linejoin:round"/><path d="M308 54V30l18 7-18 7" style="fill:#e0483f;stroke:#fff3c4;stroke-width:1.5"/>';
const tower=()=>'<g style="fill:#0a0820"><rect x="262" y="40" width="40" height="88"/><rect x="254" y="30" width="56" height="12"/><rect x="266" y="14" width="32" height="18"/><path d="M262 14l20-14 20 14z"/><rect x="278" y="56" width="8" height="14" style="fill:#ffe9a0"/><rect x="278" y="86" width="8" height="14" style="fill:#ffe9a0"/></g>';
const flasks=()=>'<g style="fill:'+mx(60,'#fff')+';opacity:.85"><path d="M240 128v-26l-14-22h42l-14 22v26z"/></g><g style="fill:var(--gold);opacity:.9"><path d="M312 128v-18l-10-16h30l-10 16v18z"/></g><circle class="fxs fxf" cx="254" cy="66" r="3"/><circle class="fxs fxf" cx="262" cy="52" r="2" style="animation-delay:.8s"/><circle class="fxs fxf" cx="318" cy="82" r="2.4" style="animation-delay:1.6s"/>';
const gold=(x,y)=>'<g transform="translate('+x+' '+y+')" style="stroke:var(--gold);stroke-width:2.5;fill:none"><path d="M0 -26V8M-26 -14H26M-26 -14l-8 18h16zM26 -14l-8 18h16zM-14 12h28"/></g>';
const clock=()=>'<circle cx="300" cy="62" r="34" style="fill:none;stroke:'+mx(70,'#fff')+';stroke-width:3;opacity:.7"/><path d="M300 62V40M300 62l16 10" style="stroke:#fff3c4;stroke-width:3;stroke-linecap:round;fill:none"/>';
const SC={
  water:()=>sun(300,76,16,'#ffe08a')+wave(96,10,.55,9,mx(60,'#0b0a1f'))+wave(112,12,.8,6.5,mx(44,'#07061a'))+wave(128,9,1,5,mx(26,'#050414')),
  food:()=>sun(310,70,18,'#ffb24a')+hills()+'<path class="fxsm" d="M96 100c-6-10 6-14 0-24s6-12 4-22" style="stroke:#fff;stroke-opacity:.5;stroke-width:3;fill:none;stroke-linecap:round"/><rect x="82" y="102" width="30" height="26" style="fill:#0a0820"/><path d="M78 102l19-14 19 14z" style="fill:#0a0820"/>',
  sleep:()=>stars(34,80)+moon(306,56,20)+'<g style="fill:rgba(255,255,255,.14)">'+cloud(90,70,1.1,38)+cloud(220,44,.8,52)+'</g>'+hills(),
  stress:()=>stars(14,60)+tree(40,56)+tree(76,74)+tree(300,70)+tree(338,52)+tree(372,64)+'<path d="M0 108c80-10 140 12 220 4s120-10 170-2V150H0Z" style="fill:rgba(255,255,255,.10)"/>'+fire(9)+hills(),
  stair:()=>stars(16,60)+sun(60,52,12,'#ffe08a')+stairs(),
  stats:()=>stars(18,60)+hills()+bars(mx(80,'#fff')),
  body:()=>stars(18,60)+gold(300,66)+hills(),
  lab:()=>stars(20,70)+hills()+flasks(),
  time:()=>stars(24,70)+clock()+hills(),
  monument:()=>stars(26,70)+tower()+hills(),
  kingdom:()=>stars(30,66)+moon(236,30,9)+hills()+castle(292,1.05),
  quests:()=>stars(26,66)+sun(250,52,12,'#ffb24a')+hills()+castle(300,.8),
  pulse:()=>stars(16,60)+hills()+'<path d="M0 100h120l12-30 14 56 12-40 10 14h210" fill="none" style="stroke:#ff8f87;stroke-width:3;stroke-linejoin:round;stroke-linecap:round"/>'};
SC.exercise=SC.stair;SC.run=SC.stair;SC.campus=SC.stair;SC.score=SC.body;SC.health=SC.kingdom;SC.home=SC.kingdom;SC.bmi=SC.body;SC.calc=SC.body;
HWUI.css('flair-scene',`
.fxhero{position:relative;overflow:hidden;margin:6px 0 16px;padding:20px 16px 58px;border-radius:var(--r-card);min-height:150px;isolation:isolate;
  border:1px solid color-mix(in srgb,var(--rg) 55%,var(--edge,var(--ln)));
  background:linear-gradient(180deg,${mx(54,'#0d0b26')},${mx(24,'#0d0b26')} 82%);box-shadow:0 14px 34px rgba(0,0,0,.35),0 0 26px var(--rg-soft)}
.fxhero>svg{position:absolute;inset:0;width:100%;height:100%;z-index:-1}
.fxhero::after{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,rgba(8,6,28,.62),rgba(8,6,28,0) 68%)}
.fxhero>h2{margin:0 0 4px;background:none;-webkit-text-fill-color:#fff;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.7)!important}
.fxhero>p{margin:0;max-width:78%;color:#efeaff;text-shadow:0 1px 8px rgba(0,0,0,.7);font-size:14px}
.fxs{fill:#fff;animation:fxtw 3.2s ease-in-out infinite alternate}.fxf{fill:#fff3a8;animation-duration:4.4s}
@keyframes fxtw{from{opacity:.15}to{opacity:1}}
.fxw{animation:fxwv linear infinite}@keyframes fxwv{from{transform:translateX(0)}to{transform:translateX(-130px)}}
.fxc{fill:inherit;animation:fxcd linear infinite alternate}@keyframes fxcd{from{translate:-24px 0}to{translate:24px 0}}
.fxsm{animation:fxsm 3.6s ease-in-out infinite}@keyframes fxsm{0%,100%{transform:translateY(0);opacity:.2}50%{transform:translateY(-8px);opacity:.6}}
html.hw-rm .fxs,html.hw-rm .fxw,html.hw-rm .fxc,html.hw-rm .fxsm,html.hw-q-performance .fxs,html.hw-q-performance .fxw,html.hw-q-performance .fxc,html.hw-q-performance .fxsm{animation:none!important}
@media(prefers-reduced-motion:reduce){.fxs,.fxw,.fxc,.fxsm{animation:none!important}}
`);
/** moves the page title (and the line under it) into a scene header */
function hero(){const m=document.getElementById('main');if(!m)return;const mk=SC[S.v];if(!mk)return;
  const h=m.querySelector('h2');if(!h||h.closest('.card,.fxhero'))return;const nx=h.nextElementSibling,p=nx&&nx.tagName==='P'?nx:null;
  const d=document.createElement('div');d.className='fxhero';d.innerHTML='<svg viewBox="0 0 390 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">'+mk()+'</svg>';
  h.before(d);d.appendChild(h);if(p)d.appendChild(p)}

// the hook: remember which page this is, and its colour
{const r=render;render=function(){const x=r.apply(this,arguments);
  try{const e=document.documentElement,v=S.v||'home';e.dataset.view=v;e.style.setProperty('--rg',RG[v]||'#8b7bff');hero()}catch(err){console.error('[HWFlair]',err)}return x}}
return{RG,TILE}})();
