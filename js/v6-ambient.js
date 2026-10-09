/* v6 (final polish): the living world behind every page, and a shared finish for buttons, cards and bars.
   Not part of the original.

   AMBIENT LAYER. One fixed layer behind the app (pointer-events: none, below every card), themed by the region the
   page belongs to:
     meadow   Home, Health Hall, BMI, Calories, Statistics, Settings      rolling hills, a far castle, clouds, motes
     water    Nutrition & Hydration                                       hills and a lake with moving light on it
     night    Sleep                                                       night hills, a moon, twinkling stars, fireflies
     mountain Stairs (also the old Pulse and Running routes)              peaks with snow, a stair path, mist
     forest   Stress                                                      pine forest, falling leaves
     hall     Quests, Badges, Guide, Kingdom                              a castle wall and two flickering torches
   The scenery is painted once per theme as small pixel-art strips (HWRig.paint, cached for the session) and shown
   scaled up; two strips per theme (far and near) give depth, and where the browser supports scroll-driven animation
   they move at different speeds as the page scrolls (parallax with no JavaScript). What moves is a handful of CSS
   elements (clouds, motes, shimmer, leaves, torches) animated with transform and opacity only.
   Restraint: the layer is faint and sits behind opaque cards, so it never competes with health information; text that
   sits directly on the page background (header, footnote) gets a backing. Hidden on the title screen and onboarding,
   which have their own scenes. Performance mode keeps the scenery but stops most moving parts; reduced motion and
   Animations Off stop all of it; a hidden tab pauses it (js/v6-motion.js). Changing page swaps one class.

   FINISH. Shared, theme-aware polish on the original components (both themes, no layout change): a light bevel and a
   hover / pressed / disabled state on buttons, a sheen on cards and a rule under card headings, gem-like progress
   bars, a clearer current tab, and clickable tiles that lift on hover. Badge cards put the date on its own line and stay
   opaque, and at most three toasts show at once. */
const HWAmbient=(()=>{
const THEME={home:'meadow',health:'meadow',bmi:'meadow',calc:'meadow',body:'meadow',stats:'meadow',set:'meadow',
  food:'water',water:'water',sleep:'night',stair:'mountain',pulse:'mountain',run:'mountain',stress:'forest',
  quests:'hall',badges:'hall',guide:'hall',kingdom:'hall'};
const W=320;
const TAU=Math.PI*2,wave=(x,k,a,ph)=>a*Math.sin(x/W*TAU*k+(ph||0)); // whole cycles over the strip, so it tiles

// far / near strips per theme (transparent sky; colours for the light theme, darkened by CSS in the dark theme)
const ART={
  meadow:[P=>{P.ridge(0,W,x=>34+wave(x,2,7)+wave(x,5,3,1),'#a9cdb0',90);P.ridge(0,W,x=>48+wave(x,3,6,2)+wave(x,7,2),'#8fbf98',90);
      // far castle
      P.r(246,30,22,24,'#9cb0a6');P.r(242,22,6,32,'#9cb0a6');P.r(266,22,6,32,'#9cb0a6');P.r(253,14,8,16,'#9cb0a6');
      [242,246,266,270,253,257].forEach(x=>P.r(x,x>=253&&x<=257?12:20,2,2,'#9cb0a6'));P.r(256,8,1,6,'#7d8f86');P.r(257,8,4,3,'#d9453d')},
    P=>{P.ridge(0,W,x=>26+wave(x,3,6)+wave(x,8,2,1),'#74b86c',60);P.ridge(0,W,x=>40+wave(x,4,4,3),'#5a9f57',60);
      for(let i=0;i<9;i++){const x=(i*37+11)%W,y=30+wave(x,3,6)+wave(x,8,2,1);P.poly([x,y-14,x+6,y,x-6,y],'#3f8a46');P.r(x-1,y,2,3,'#6b4a2b')}
      P.speck(0,44,W,16,['#8fd16a','#4f9a4f'],120)}],
  water:[P=>{P.ridge(0,W,x=>30+wave(x,2,8,1)+wave(x,6,3),'#a6c9c0',90);P.ridge(0,W,x=>44+wave(x,3,5),'#8cbfa5',90)},
    P=>{P.ridge(0,W,x=>18+wave(x,4,3),'#6db866',60);P.bands(26,60,['#8fd0f2','#76c0ea','#5fb0e2','#4f9fd6']);
      for(let i=0;i<24;i++){const x=(i*53+7)%W,y=30+(i*7)%26;P.r(x,y,6+(i%3)*3,1,'#d7f1ff')}
      for(let i=0;i<10;i++){const x=(i*31+5)%W;P.r(x,22,1,6,'#3f8a46');P.r(x+2,20,1,8,'#4f9a4f')}}],
  night:[P=>{P.ridge(0,W,x=>32+wave(x,2,8,2)+wave(x,5,3),'#3b4a6e',90);P.ridge(0,W,x=>46+wave(x,3,5,1),'#2f3d5e',90)},
    P=>{P.ridge(0,W,x=>28+wave(x,3,5)+wave(x,7,2,2),'#25324f',60);
      for(let i=0;i<8;i++){const x=(i*43+19)%W,y=30+wave(x,3,5)+wave(x,7,2,2);P.poly([x,y-12,x+5,y,x-5,y],'#1b2640')}
      // a lit cottage window
      P.r(150,24,14,10,'#1b2640');P.poly([148,24,157,17,166,24],'#1b2640');P.r(155,27,3,3,'#f2c14e')}],
  mountain:[P=>{const pk=[[0,60],[30,22],[58,48],[92,10],[128,46],[160,26],[196,52],[232,14],[270,44],[300,24],[320,60]];
      const pts=[0,90];pk.forEach(p=>pts.push(p[0],p[1]));pts.push(320,90);P.poly(pts,'#a2afc4');
      pk.forEach(([x,y])=>{if(y<40)P.poly([x,y,x+7,y+9,x+2,y+7,x-2,y+10,x-7,y+9],'#f4f7fb')})},
    P=>{P.ridge(0,W,x=>30+wave(x,2,8)+wave(x,6,3,1),'#8f9a86',60);P.ridge(0,W,x=>42+wave(x,3,5,2),'#76826c',60);
      // a stone stair path up the slope
      for(let i=0;i<9;i++){const x=120+i*8,y=52-i*3;P.r(x,y,9,3,'#c9c0aa');P.r(x,y+3,9,1,'#8a806a')}}],
  forest:[P=>{for(let i=0;i<22;i++){const x=(i*29+3)%W,h=30+(i*13)%22;P.poly([x,60-h,x+9,64,x-9,64],'#87b394');P.r(x-9,62,18,28,'#87b394')}},
    P=>{P.ridge(0,W,x=>40+wave(x,3,3),'#3f7a4a',60);
      for(let i=0;i<16;i++){const x=(i*41+13)%W,h=26+(i*11)%14;P.poly([x,48-h,x+8,40,x-8,40],'#2f6a3c');P.poly([x,44-h+10,x+10,48,x-10,48],'#2f6a3c');P.r(x-1,48,3,4,'#5b3a1e')}}],
  hall:[P=>{P.r(0,20,W,70,'#b3a891');for(let y=20;y<90;y+=8)for(let x=((y/8)%2)*10;x<W;x+=20){P.r(x,y,19,1,'#9a8f78');P.r(x,y,1,8,'#9a8f78')}
      [60,160,260].forEach(x=>{P.r(x-16,36,32,54,'#7f7562');P.ell(x,36,16,12,'#7f7562');P.r(x-12,40,24,50,'#5a5244');P.ell(x,40,12,9,'#5a5244')});
      for(let x=0;x<W;x+=16)P.r(x,14,10,8,'#b3a891')},
    P=>{P.r(0,44,W,16,'#8a7f68');for(let x=0;x<W;x+=24)P.r(x,44,1,16,'#6f6553');P.r(0,44,W,2,'#a39880');
      [60,160,260].forEach(x=>{P.r(x-8,30,16,14,'#7a2a26');P.r(x-6,32,12,10,'#a8423a');P.r(x-1,34,2,6,'#f2c14e')})}]};

const url=(th,i)=>typeof HWRig!=='undefined'?HWRig.paint('amb-'+th+i,W,i?60:90,ART[th][i],th.length*7+i):'';
let el=null,cur='';
function build(){el=document.createElement('div');el.className='amb';el.setAttribute('aria-hidden','true');
  el.innerHTML='<div class="amsky"></div><i class="amsun"></i><div class="amfar"></div><div class="amnear"></div>'
    +[0,1,2].map(i=>'<i class="amcl amcl'+i+'"></i>').join('')
    +[0,1,2,3,4,5,6,7].map(i=>'<i class="ammo" style="left:'+((i*13+5)%92+3)+'%;--d:'+(14+i%4*4)+'s;--dl:-'+(i*2.3).toFixed(1)+'s"></i>').join('')
    +[0,1,2,3,4,5,6,7,8].map(i=>'<i class="amst" style="left:'+((i*23+7)%96)+'%;top:'+(4+(i*17)%30)+'%;--dl:-'+(i*.7).toFixed(1)+'s"></i>').join('')
    +[0,1,2,3].map(i=>'<i class="amsh" style="left:'+(8+i*24)+'%;bottom:'+(3+(i%2)*4)+'vh;--dl:-'+i+'s"></i>').join('')
    +[0,1,2,3,4].map(i=>'<i class="amlf" style="left:'+(10+i*19)+'%;--d:'+(11+i*2)+'s;--dl:-'+(i*3)+'s"></i>').join('')
    +'<i class="amto amtl"><u></u></i><i class="amto amtr"><u></u></i>';
  document.body.insertBefore(el,document.body.firstChild)}
function theme(v){const th=THEME[v]||'';if(!el)build();
  el.classList.toggle('amoff',!th);if(!th||th===cur)return;cur=th;el.dataset.th=th;
  el.querySelector('.amfar').style.backgroundImage='url('+url(th,0)+')';el.querySelector('.amnear').style.backgroundImage='url('+url(th,1)+')'}
{const _r=render;render=function(){const r=_r.apply(this,arguments);try{theme(S.v)}catch(e){console.error('[HWAmbient]',e)}return r}}

HWUI.css('ambient',`
.amb{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;contain:strict}
.amb.amoff{display:none}
.amb>*{position:absolute;display:block}
.amsky{inset:0 0 40% 0;background:linear-gradient(rgba(124,196,246,.26),rgba(124,196,246,0))}
.amfar,.amnear{left:0;right:0;bottom:0;background-repeat:repeat-x;background-position:50% 100%;image-rendering:pixelated}
.amfar{height:clamp(90px,30vh,300px);background-size:auto 100%;opacity:.5}
.amnear{height:clamp(56px,18vh,190px);background-size:auto 100%;opacity:.55}
@media(max-width:760px){.amfar,.amnear{bottom:calc(64px + env(safe-area-inset-bottom,0px))}}
.amcl{top:8%;left:0;width:12px;height:12px;background:rgba(255,255,255,.75);box-shadow:12px 0 rgba(255,255,255,.75),24px 0 rgba(255,255,255,.75),36px 0 rgba(255,255,255,.75),12px -12px rgba(255,255,255,.75),24px -12px rgba(255,255,255,.75);animation:amdr 110s linear infinite;will-change:transform}
.amcl1{top:18%;animation-duration:150s;animation-delay:-70s;transform:scale(.7)}.amcl2{top:4%;animation-duration:190s;animation-delay:-20s;opacity:.7}
@keyframes amdr{from{transform:translateX(-80px)}to{transform:translateX(calc(100vw + 40px))}}
.ammo{bottom:-10px;width:3px;height:3px;background:#ffe9a8;box-shadow:0 0 6px 2px rgba(242,193,78,.55);opacity:0;animation:ammo var(--d,16s) linear infinite;animation-delay:var(--dl,0s)}
@keyframes ammo{0%{transform:translate(0,0);opacity:0}15%{opacity:.8}50%{transform:translate(18px,-45vh)}85%{opacity:.6}100%{transform:translate(-6px,-90vh);opacity:0}}
.amst,.amsh,.amlf,.amto,.amsun{display:none}
/* night */
.amb[data-th=night] .amsky{background:linear-gradient(rgba(20,32,79,.32),rgba(20,32,79,0))}
.amb[data-th=night] .amst{display:block;width:3px;height:3px;background:#fffbea;animation:amtw 3.2s steps(3) infinite alternate;animation-delay:var(--dl)}
@keyframes amtw{from{opacity:.15}to{opacity:.9}}
.amb[data-th=night] .amsun{display:block;top:9%;right:9%;width:28px;height:28px;background:#f6edcf;box-shadow:inset -8px -4px 0 #d9cfae,0 0 24px 6px rgba(246,237,207,.35);opacity:.8}
.amb[data-th=night] .amcl{opacity:.25}
.amb[data-th=night] .ammo{background:#d8ff8a;box-shadow:0 0 6px 2px rgba(180,255,120,.45)}
/* water: light moving on the lake */
.amb[data-th=water] .amsh{display:block;width:22px;height:2px;background:rgba(255,255,255,.7);animation:amsh 4s ease-in-out infinite alternate;animation-delay:var(--dl)}
@media(max-width:760px){.amb[data-th=water] .amsh{margin-bottom:64px}}
@keyframes amsh{from{transform:translateX(-10px) scaleX(.6);opacity:.2}to{transform:translateX(14px) scaleX(1.2);opacity:.8}}
/* mountain: drifting mist */
.amb[data-th=mountain] .amcl{background:rgba(255,255,255,.55);box-shadow:12px 0 rgba(255,255,255,.55),24px 0 rgba(255,255,255,.55),36px 0 rgba(255,255,255,.55),48px 0 rgba(255,255,255,.55),60px 0 rgba(255,255,255,.55)}
.amb[data-th=mountain] .amcl1{top:46%}
/* forest: falling leaves */
.amb[data-th=forest] .amlf{display:block;top:-12px;width:6px;height:4px;background:#5a9f57;box-shadow:2px 2px 0 #3f7a4a;animation:amlf var(--d,12s) linear infinite;animation-delay:var(--dl)}
@keyframes amlf{0%{transform:translate(0,0) rotate(0)}25%{transform:translate(24px,25vh) rotate(90deg)}50%{transform:translate(-8px,50vh) rotate(180deg)}75%{transform:translate(20px,75vh) rotate(270deg)}100%{transform:translate(0,105vh) rotate(360deg)}}
.amb[data-th=forest] .amsky{background:linear-gradient(rgba(120,170,130,.22),rgba(120,170,130,0))}
/* hall: torches */
.amb[data-th=hall] .amsky{background:linear-gradient(rgba(90,82,68,.18),rgba(90,82,68,0))}
.amb[data-th=hall] .amcl{display:none}
.amb[data-th=hall] .amto{display:block;bottom:clamp(120px,34vh,330px);width:8px;height:22px;background:#6b4a2b;box-shadow:inset -3px 0 #4a3018}
.amtl{left:max(10px,calc(50% - 620px))}.amtr{right:max(10px,calc(50% - 620px))}
.amto u{position:absolute;left:-6px;bottom:20px;width:20px;height:22px;background:radial-gradient(closest-side,#fff3b0 0 30%,#f2a33a 55%,rgba(232,89,12,0) 100%);transform-origin:50% 100%;animation:amfl .5s steps(3) infinite alternate}
.amto:after{content:"";position:absolute;left:-60px;bottom:-30px;width:128px;height:128px;border-radius:50%;background:radial-gradient(closest-side,rgba(242,193,78,.32),rgba(242,193,78,0));animation:amgl 1.7s ease-in-out infinite alternate}
@keyframes amfl{0%{transform:scale(1,1)}50%{transform:scale(.88,1.12)}100%{transform:scale(1.08,.92)}}
@keyframes amgl{from{opacity:.65;transform:scale(.95)}to{opacity:1;transform:scale(1.05)}}
/* dark theme: the same world at dusk */
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .amfar{filter:brightness(.42) saturate(.8)}:root:not([data-theme="light"]) .amnear{filter:brightness(.36) saturate(.8)}:root:not([data-theme="light"]) .amsky{opacity:.45}:root:not([data-theme="light"]) .amcl{opacity:.18}}
:root[data-theme="dark"] .amfar{filter:brightness(.42) saturate(.8)}:root[data-theme="dark"] .amnear{filter:brightness(.36) saturate(.8)}:root[data-theme="dark"] .amsky{opacity:.45}:root[data-theme="dark"] .amcl{opacity:.18}
/* parallax while scrolling, where the browser can drive animation from scroll (no JavaScript) */
@supports (animation-timeline:scroll()){.amfar{animation:ampx linear both;animation-timeline:scroll(root)}.amnear{animation:ampx2 linear both;animation-timeline:scroll(root)}}
@keyframes ampx{to{transform:translateY(5vh)}}@keyframes ampx2{to{transform:translateY(10vh)}}
/* text that sits on the page background stays readable over the scenery */
main header{position:relative}
.dis{background:var(--bg);box-shadow:0 0 0 8px var(--bg);position:relative}
/* performance mode keeps the scenery but stops most moving parts */
html.hw-q-performance .ammo:nth-child(n+6),html.hw-q-performance .amcl1,html.hw-q-performance .amcl2,html.hw-q-performance .amlf:nth-of-type(n+3),html.hw-q-performance .amst:nth-of-type(2n){display:none!important}
html.hw-q-performance .amto:after{animation:none}
@media(prefers-reduced-motion:reduce){.amb *{animation:none!important}.ammo,.amlf{display:none!important}}

/* ---------- finish: shared polish on the original components ---------- */
button{box-shadow:inset -3px -3px 0 rgba(0,0,0,.25),inset 3px 3px 0 rgba(255,255,255,.28),3px 3px 0 var(--ln);transition:filter .12s steps(2)}
button:hover:not(:disabled){filter:brightness(1.07)}
button:active:not(:disabled){box-shadow:inset 3px 3px 0 rgba(0,0,0,.22),1px 1px 0 var(--ln)}
button:disabled,button[aria-disabled="true"]{cursor:not-allowed;filter:grayscale(.55);opacity:.7}
.card{background-image:linear-gradient(rgba(255,255,255,.16),rgba(255,255,255,0) 48px)}
.card>h3:first-child{padding-bottom:6px;box-shadow:0 2px 0 var(--p2);margin-bottom:10px}
.bar i{box-shadow:inset 0 3px 0 rgba(255,255,255,.32),inset 0 -3px 0 rgba(0,0,0,.18)}
nav button.on{box-shadow:inset -3px -3px 0 rgba(0,0,0,.25),inset 3px 3px 0 rgba(255,255,255,.45),3px 3px 0 var(--ln),0 0 0 2px var(--gold)}
@media(hover:hover){.t[data-a],.t[data-go],.it:not(:disabled){transition:transform .12s steps(2)}.t[data-a]:hover,.t[data-go]:hover{transform:translateY(-2px)}}
@media(prefers-reduced-motion:reduce){button,.t[data-a],.t[data-go]{transition:none}}
/* badge cards: the description and the date on their own lines; surfaces stay opaque over the scenery */
.bd small{display:block}
.bd.ok{background:linear-gradient(var(--p2),rgba(242,193,78,.28)),var(--bg)}
.bd.lock{opacity:1;background:var(--p2)}.bd.lock>*{opacity:.75}
`);
// At most three toasts at once: a burst (a day's quests completing together after a sync or a backlog of logs) no
// longer covers the screen; the newest stay.
{const _t=toast;toast=function(){const r=_t.apply(this,arguments),T=document.getElementById('toasts');while(T&&T.children.length>3)T.firstElementChild.remove();return r}}
return{theme,THEME,get current(){return cur}}})();
