/* v6: looks: colour themes, the onboarding chamber and the Shadow Keep. Not part of the original.
   THEMES  One map of CSS-variable sets. 'light' and 'dark' are the original sets, unchanged (they still come from the
           original stylesheet; the map mirrors them for the swatches and the contrast check). Five more themes are
           injected as :root[data-skin=…] rules. Each theme sits on a base ('light' or 'dark') that goes in
           data-theme, so every existing light/dark rule (ambient dusk, games…) keeps working. Health colours
           (--red --blue --grn --vio --gold) are the same in every theme; each theme keeps text ≥ 7:1 and muted text
           ≥ 4.5:1 on --bg, --pn and --p2. Saved in st.s.theme (optional string). Missing = Arcane Night, the default
           since the magical redesign (js/v6-arcane.js); 'auto' = match the device. The original THEME button still
           toggles light/dark. Settings → Theme has the swatches.
   CHAMBER The Traveller's Registry (pages.onb) gets an arcane chamber behind it: CSS/SVG only (stone arches, two
           torches, motes, a fog band), a slowly turning gold rune circle behind Medius whose six runes light as the
           six steps are done, and a scroll for the form (its own parchment colours, so the form stays high-contrast
           in every theme). Sealing the registry ends in a light burst and a chime (the chime follows the sound
           setting through sfx). 19 animated elements, transform/opacity only, still under reduced motion.
   KEEP    The villain's fortress, drawn as crisp pixel art (SVG rects, shape-rendering crispEdges): cliff base with a
           shadow, a plinth on the ground line that every tower stands on, crooked spires, glowing windows, a toothed
           portcullis, cracks, moss, chains, tattered banners, bats and a circling storm. The title scene draws it in
           place of the old dark tower (whose right turret floated above the slope), and the Kingdom page shows it in
           the Shadow Keep card. The storm weakens as regions are restored (game layer only). */
const HWLooks=(()=>{
const THEMES={
  arcane:{name:'Arcane Night',base:'dark',v:{bg:'#0d0b26',pn:'#1b1745',p2:'#29235f',ink:'#f3efff',mut:'#bfb7ee',ln:'#05040f'}},
  light:{name:'Parchment',base:'light',v:{bg:'#efe3bd',pn:'#fbf3d6',p2:'#e6d6a2',ink:'#2b2418',mut:'#6b5d3d',ln:'#2b2418'}},
  dark:{name:'Night Keep',base:'dark',v:{bg:'#101a24',pn:'#1d3043',p2:'#2a4259',ink:'#f6edcf',mut:'#a9b8c4',ln:'#06090d'}},
  forest:{name:'Enchanted Forest',base:'dark',v:{bg:'#0e1d15',pn:'#173123',p2:'#21432f',ink:'#eef6e0',mut:'#a8c9ad',ln:'#040b07'}},
  crystal:{name:'Crystal Cavern',base:'dark',v:{bg:'#131733',pn:'#1e2450',p2:'#2a3268',ink:'#eef0ff',mut:'#b4bde9',ln:'#06081a'}},
  ember:{name:'Ember Forge',base:'dark',v:{bg:'#1c110e',pn:'#301d17',p2:'#432a20',ink:'#fbeedd',mut:'#d9b9a2',ln:'#0a0504'}},
  frost:{name:'Frost Citadel',base:'light',v:{bg:'#e2edf5',pn:'#f6fafd',p2:'#cfe0ec',ink:'#12243a',mut:'#3f566d',ln:'#12243a'}},
  desert:{name:'Desert Oasis',base:'light',v:{bg:'#f0dbb0',pn:'#fbefd3',p2:'#ecd8a8',ink:'#32200e',mut:'#664622',ln:'#32200e'}}};
/* The Settings theme card has three parts (the owner's request, 2026-10-27): DEFAULT (Arcane Night), MATCH SYSTEM on/off, and
   CUSTOM COLOUR, which holds the other themes as pickable palettes beside new colour palettes at three strengths ("opacity"
   of the colour in the surfaces) and a free colour picker. Match system works with all of them: the base follows the device
   (dark or light); a palette whose own base differs is regenerated from its seed colour for the device's base.
   Saved (optional, in st.s): theme = a THEMES key | 'p:<palette>:<strength %>' | 'custom'; match = 1 (Match system on);
   accent = '#rrggbb' and tint = 40 | 70 | 100 and cbase = 'dark' | 'light' for 'custom'. The old theme 'auto' reads as match on. */
const ORDER=['arcane','light','dark','forest','crystal','ember','frost','desert'];
const SEED={arcane:'#8b5cf0',light:'#d9a21b',dark:'#2f8fd0',forest:'#3f9f4a',crystal:'#8f9bff',ember:'#e8743b',frost:'#2f8fd0',desert:'#c8863d'};
const PAL=[['ocean','Ocean','#2a8fd6','dark'],['plum','Plum','#a64fd0','dark'],['sunset','Sunset','#e8743b','dark'],['slate','Slate','#6b7f99','dark'],
  ['rose','Rose','#d9547c','light'],['mint','Mint','#2fa37a','light'],['sky','Sky','#3b82d9','light']];
const TINTS=[100,70,40];
const hex6=x=>/^#[0-9a-f]{6}$/i.test(x||'');
const s=()=>(typeof st!=='undefined'&&st&&st.s)||{};
// no choice saved: Arcane Night, the default look since the owner's magical redesign; 'auto' (Match system) is now saved explicitly
const match=()=>!!s().match||s().theme==='auto';
const parseKey=k=>{if(THEMES[k])return{k};const m=/^p:([a-z]+):(\d+)$/.exec(k||'');if(m&&PAL.some(x=>x[0]===m[1])&&TINTS.includes(+m[2]))return{k};return k==='custom'?{k}:null};
const choice=()=>{const t=s().theme;return t&&t!=='auto'&&parseKey(t)?t:'arcane'};
const device=()=>{try{return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){return 'light'}};
/* colour maths: a theme is generated from a seed colour, a strength (0.4–1) and a base. Text stays at least 7:1 and muted text
   at least 4.5:1 on all three surfaces (checked by tests/35-looks.test.mjs for every palette). */
function hsl(h,sa,l){sa/=100;l/=100;const a=sa*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return l-a*Math.max(-1,Math.min(k-3,9-k,1))};
  return'#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}
function hue(x){const[r,g,b]=[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)/255),mx=Math.max(r,g,b),d=mx-Math.min(r,g,b);if(!d)return 0;
  const h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;return(Math.round(h*60)+360)%360}
function gen(seed,tint,base){const h=hue(seed),S=Math.round(8+46*tint);
  return base==='dark'
    ?{bg:hsl(h,S,8),pn:hsl(h,S,13),p2:hsl(h,S,20),ink:hsl(h,30,96),mut:hsl(h,Math.min(40,S+8),76),ln:hsl(h,S,4),edge:hsl(h,Math.min(60,S+10),60),glow:'hsla('+h+',80%,60%,.2)'}
    :{bg:hsl(h,S+4,92),pn:hsl(h,S+8,97),p2:hsl(h,S,85),ink:hsl(h,50,10),mut:hsl(h,30,30),ln:hsl(h,45,10),edge:hsl(h,Math.min(45,S),34),glow:'hsla('+h+',70%,45%,.14)'}}
/** a palette key → {base, v (the CSS variables), seed, tint} */
function resolve(k){if(THEMES[k])return{base:THEMES[k].base,v:THEMES[k].v,seed:SEED[k],tint:1};
  const m=/^p:([a-z]+):(\d+)$/.exec(k),p=m&&PAL.find(x=>x[0]===m[1]);
  if(p){const t=+m[2]/100;return{base:p[3],seed:p[2],tint:t,v:gen(p[2],t,p[3])}}
  const a=hex6(s().accent)?s().accent:'#8b5cf0',t=TINTS.includes(+s().tint)?s().tint/100:1,b=s().cbase==='light'?'light':'dark';
  return{base:b,seed:a,tint:t,v:gen(a,t,b)}}
let gstyle=null;
/** puts the saved choice on the page: data-theme = the base, data-skin = the palette (or 'gen' for a generated one) */
function apply(){const r=document.documentElement,k=choice();let P=resolve(k),mk=k,generated=!THEMES[k];
  if(match()&&k==='arcane'){r.dataset.theme=device();delete r.dataset.skin;return}   // Match system with the default look: the original light and dark sets, as before
  if(match()&&P.base!==device()){P={base:device(),seed:P.seed,tint:P.tint,v:gen(P.seed,P.tint,device())};generated=true}
  r.dataset.theme=P.base;
  if(generated){if(!gstyle){gstyle=document.createElement('style');gstyle.id='v6gen';document.head.appendChild(gstyle)}
    gstyle.textContent='html:root[data-skin="gen"]{'+Object.entries(P.v).map(([n,c])=>'--'+n+':'+c).join(';')+'}';r.dataset.skin='gen'}
  else if(mk===P.base)delete r.dataset.skin;else r.dataset.skin=mk}
function set(k){if(!parseKey(k))return;st.s.theme=k;apply();save()}
// contrast helpers (WCAG relative luminance) used by the swatches' tooltip and the tests
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(x=>x<=.03928?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const ratio=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return(x+.05)/(y+.05)};

HWUI.css('looks-themes',Object.entries(THEMES).filter(([k,t])=>k!==t.base).map(([k,t])=>
  'html:root[data-skin="'+k+'"]{'+Object.entries(t.v).map(([n,c])=>'--'+n+':'+c).join(';')+'}').join('\n')+`
.v6thg{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin-top:8px}
.v6sw{display:flex;flex-direction:column;align-items:stretch;gap:6px;min-height:88px;padding:6px;background:var(--p2);color:var(--ink);font-size:8px;line-height:1.5;text-align:center}
.v6sw.on{background:var(--gold);color:#2b2418}
.v6sw .pv{display:block;height:44px;border:3px solid var(--l);background:var(--b);position:relative;overflow:hidden}
.v6sw .pv i{position:absolute;left:5px;top:5px;right:5px;height:15px;background:var(--p);border:2px solid var(--l);font:normal 9px/11px var(--fb);color:var(--k);text-align:left;padding-left:3px}
.v6sw .pv u{position:absolute;bottom:4px;width:16%;height:8px;border:1px solid var(--l)}
.v6sw .pv.au{background:linear-gradient(135deg,#efe3bd 50%,#101a24 50%)}.v6sw .pv.au i{background:linear-gradient(135deg,#fbf3d6 50%,#1d3043 50%);color:#2b2418}`);
apply();
// the original THEME button still flips light/dark (from a fantasy theme: to its base's opposite); js/v6-ui.js saves it
{const o=acts.theme;acts.theme=function(){delete document.documentElement.dataset.skin;st.s.match=0;return o.apply(this,arguments)}}
const SW=k=>{const P=resolve(k),v=P.v;return'<span class="pv" style="--b:'+v.bg+';--p:'+v.pn+';--k:'+v.ink+';--l:'+(v.edge||v.ln)+'"><i>Aa</i>'+['--red','--blue','--grn','--gold'].map((x,j)=>'<u style="left:'+(6+j*22)+'%;background:var('+x+')"></u>').join('')+'</span>'};
acts.skin=d=>{set(d.v);render();const n=THEMES[d.v]?THEMES[d.v].name:d.v==='custom'?'Custom colour':d.v.split(':')[1];toast('🎨 Theme: '+n)};
acts.thmatch=()=>{st.s.match=match()?0:1;if(st.s.theme==='auto')st.s.theme='arcane';apply();save();render();toast('🎨 Match system: '+(match()?'ON':'OFF'))};
acts.thtint=d=>{if(!TINTS.includes(+d.v))return;st.s.tint=+d.v;st.s.theme='custom';apply();save();render()};
acts.thbase=d=>{st.s.cbase=d.b==='light'?'light':'dark';st.s.theme='custom';apply();save();render()};
// the colour picker applies as it moves; the card is not redrawn then (that would close the picker)
document.addEventListener('input',e=>{const el=e.target;if(!el||el.id!=='v6cc'||!hex6(el.value))return;st.s.accent=el.value;st.s.theme='custom';apply();save();clearTimeout(el._t);el._t=setTimeout(()=>{if(S.v==='set'&&document.activeElement!==el)render()},600)});
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(match()){apply();if(S.v==='set')render()}})}catch(e){}
function card(){const c=choice(),m=match(),cust=!!parseKey(s().theme)&&c!=='arcane',cc=hex6(s().accent)?s().accent:'#8b5cf0',tn=TINTS.includes(+s().tint)?+s().tint:100;
  const sw=(k,name,on)=>'<button class="v6sw'+(on?' on':'')+'" data-a="skin" data-v="'+k+'" aria-pressed="'+on+'">'+SW(k)+esc(name)+'</button>';
  return '<div class="card" id="v6theme"><h3>🎨 THEME</h3><p class="mut" style="margin:0">Tap to try a look at once. Health colours stay the same in every theme.</p>'
  +'<div class="v6thr"><button class="v6sw v6swd'+(c==='arcane'&&!cust?' on':'')+'" data-a="skin" data-v="arcane" aria-pressed="'+(c==='arcane')+'">'+SW('arcane')+'Default</button>'
  +'<button class="g v6mt" data-a="thmatch" aria-pressed="'+m+'"><b>Match system</b><span>'+(m?'ON · follows your phone\'s light or dark':'OFF')+'</span></button></div>'
  +'<h4 class="v6th4">Custom colour</h4><div class="v6cr"><label for="v6cc">Pick a colour</label><input type="color" id="v6cc" value="'+cc+'" aria-label="Custom colour">'
  +'<div class="v6tn" role="group" aria-label="Colour strength">'+TINTS.map(t=>'<button class="g sm" data-a="thtint" data-v="'+t+'" aria-pressed="'+(c==='custom'&&tn===t)+'">'+t+'%</button>').join('')+'</div>'
  +(m?'':'<div class="v6tn" role="group" aria-label="Light or dark"><button class="g sm" data-a="thbase" data-b="dark" aria-pressed="'+(c==='custom'&&s().cbase!=='light')+'">DARK</button><button class="g sm" data-a="thbase" data-b="light" aria-pressed="'+(c==='custom'&&s().cbase==='light')+'">LIGHT</button></div>')+'</div>'
  +'<h4 class="v6th4">Palettes</h4><div class="v6thg" role="group" aria-label="Palettes">'
  +ORDER.filter(k=>k!=='arcane').map(k=>sw(k,THEMES[k].name,c===k)).join('')
  +PAL.map(p=>TINTS.map(t=>sw('p:'+p[0]+':'+t,p[1]+' '+t+'%',c==='p:'+p[0]+':'+t)).join('')).join('')+'</div></div>'}
HWUI.css('looks-theme-card',`.v6thr{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0;align-items:stretch}.v6swd{min-height:96px}
.v6mt{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;min-height:96px;text-transform:none;letter-spacing:0}.v6mt b{font:600 16px/1.3 var(--fn)}.v6mt span{font:13px/1.35 var(--fn);color:var(--mut)}
.v6mt[aria-pressed="true"]{outline:3px solid var(--gold);outline-offset:-3px}
.v6th4{margin:14px 0 6px;font:700 15px/1.3 var(--fn)}.v6cr{display:flex;flex-wrap:wrap;align-items:center;gap:10px}.v6cr label{font:14px var(--fn)}
#v6cc{width:56px;height:44px;padding:2px;border:2px solid var(--edge,var(--ln));border-radius:10px;background:var(--p2);cursor:pointer}
.v6tn{display:flex;gap:6px}.v6tn button[aria-pressed="true"]{background:var(--gold);color:#1d1730}
.v6sw{border:2px solid var(--edge,var(--ln));border-radius:12px;font:600 12px/1.3 var(--fn)!important;padding:6px}.v6sw .pv{border-radius:8px}`);
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k='<div class="card" id="v6motion">';return h.indexOf(k)>=0?h.replace(k,card()+k):h+card()}}

/* ---------- the onboarding chamber ---------- */
const RUNE=['M-3,-4h6M0,-4v8M-3,4h6','M-3,4L0,-4L3,4M-2,1h4','M-3,-4v8M-3,-4L3,0L-3,4','M0,-4v8M-3,-1L0,-4L3,-1','M-3,-4L3,4M3,-4L-3,4M-3,0h6','M-3,4v-8h6v4h-6'];
function ring(lit){let g='<circle r="44" fill="none" stroke="#f2c14e" stroke-width="1.6" opacity=".7"/><circle r="38" fill="none" stroke="#f2c14e" stroke-width=".8" stroke-dasharray="3 3" opacity=".55"/><circle r="27" fill="none" stroke="#f2c14e" stroke-width=".8" opacity=".35"/>'
  +'<path d="M0,-38L33,19L-33,19Z M0,38L-33,-19L33,-19Z" fill="none" stroke="#f2c14e" stroke-width=".7" opacity=".3"/>';
  RUNE.forEach((d,i)=>{const a=i*60-90,x=(Math.cos(a*Math.PI/180)*41).toFixed(1),y=(Math.sin(a*Math.PI/180)*41).toFixed(1),on=i<lit;
    g+='<g transform="translate('+x+' '+y+')" class="obrn'+(on?' on':'')+'"><circle r="6.5" fill="'+(on?'#fff3b0':'#1a1238')+'" stroke="#f2c14e" stroke-width=".8"'+(on?'':' opacity=".85"')+'/><path d="'+d+'" stroke="'+(on?'#8a5a10':'#8f7a3c')+'" stroke-width="1.3" fill="none"/></g>'});
  return '<svg viewBox="-50 -50 100 100" aria-hidden="true">'+g+'</svg>'}
const ARCH='<svg class="cha" viewBox="0 0 120 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true" shape-rendering="crispEdges">'
  +(()=>{let g='';for(let y=0;y<200;y+=6)for(let x=(y/6)%2?-6:0;x<120;x+=12)g+='<rect x="'+x+'" y="'+y+'" width="11" height="5" fill="#1d1640" opacity=".55"/>';
  const arch=(cx,w,top)=>{const hw=w/2;let a='<rect x="'+(cx-hw-6)+'" y="'+top+'" width="'+(w+12)+'" height="'+(200-top)+'" fill="#2a2152"/>';
    for(let i=0;i<=8;i++){const t=i/8,yy=top+hw*(1-Math.sin(t*Math.PI/2)),half=hw*Math.cos((1-t)*Math.PI/2);a+='<rect x="'+(cx-half).toFixed(1)+'" y="'+yy.toFixed(1)+'" width="'+(half*2).toFixed(1)+'" height="'+(200-yy).toFixed(1)+'" fill="'+(i===8?'#0a0820':'#120e30')+'"/>'}
    for(let k=0;k<7;k++){const t=k/6*Math.PI,x=cx-Math.cos(t)*(hw+3),y=top+hw-Math.sin(t)*(hw+3);a+='<rect x="'+(x-2.5).toFixed(1)+'" y="'+(y-2.5).toFixed(1)+'" width="5" height="5" fill="#3b3070"/><rect x="'+(x-2.5).toFixed(1)+'" y="'+(y-2.5).toFixed(1)+'" width="5" height="1" fill="#5a4a9a"/>'}
    return a};
  return g+arch(16,24,112)+arch(104,24,112)+arch(60,36,96)+'<rect x="0" y="186" width="120" height="14" fill="#1a1436"/><rect x="0" y="186" width="120" height="1" fill="#4a3d84"/>'+[6,30,54,78,102].map(x=>'<rect x="'+x+'" y="187" width="1" height="13" fill="#0d0a22"/>').join('')})()+'</svg>';
let ch=null;
function chamber(){if(ch)return;ch=document.createElement('div');ch.className='v6obc';ch.setAttribute('aria-hidden','true');
  ch.innerHTML=ARCH+'<i class="chf"></i><i class="chf chf2"></i>'
    +['l','r'].map(k=>'<i class="cht cht'+k+'"><u class="chg"></u><u class="chfl"></u></i>').join('')
    +Array.from({length:10},(_,i)=>'<i class="chm" style="left:'+((i*29+7)%94+3)+'%;--d:'+(9+i%4*3)+'s;--dl:-'+(i*1.7).toFixed(1)+'s;--x:'+(i%2?14:-12)+'px"></i>').join('');
  const a=document.querySelector('.amb');document.body.insertBefore(ch,a?a.nextSibling:document.body.firstChild)}
HWUI.css('looks-onb',`
.v6obc{display:none;position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;contain:strict;background:radial-gradient(ellipse 70% 45% at 50% 30%,#3a2a8a 0,rgba(58,42,138,0) 70%),linear-gradient(#0b0a26,#1c1458 55%,#0d0a24)}
body.onbm .v6obc{display:block}body.onbm .amb{display:none}
.v6obc>*{position:absolute;display:block}
.v6obc .cha{left:0;top:0;width:100%;height:100%}
.chf{left:-20%;width:140%;bottom:8%;height:90px;background:radial-gradient(ellipse 50% 50% at 50% 50%,rgba(170,160,230,.22),rgba(170,160,230,0));animation:chfog 22s ease-in-out infinite alternate}
.chf2{bottom:22%;height:60px;opacity:.7;animation-duration:30s;animation-direction:alternate-reverse}
@keyframes chfog{from{transform:translateX(-8%)}to{transform:translateX(8%)}}
.cht{top:58%;width:10px;height:28px;background:#4a3018;box-shadow:inset -3px 0 #2b1a0c,0 -4px 0 -1px #6b6b78}
.chtl{left:max(8px,calc(50% - 330px))}.chtr{right:max(8px,calc(50% - 330px))}
.cht u{position:absolute;display:block}
.chfl{left:-6px;bottom:24px;width:22px;height:26px;background:radial-gradient(closest-side,#fff6c0 0 28%,#f2a33a 56%,rgba(232,89,12,0) 100%);transform-origin:50% 100%;animation:chfl .45s steps(3) infinite alternate}
.chg{left:-75px;bottom:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(closest-side,rgba(242,170,78,.3),rgba(242,170,78,0));animation:chgl 1.3s ease-in-out infinite alternate}
@keyframes chfl{0%{transform:scale(1,1);opacity:1}50%{transform:scale(.85,1.15);opacity:.85}100%{transform:scale(1.1,.9);opacity:1}}
@keyframes chgl{from{opacity:.55;transform:scale(.94)}to{opacity:1;transform:scale(1.05)}}
.chm{bottom:-8px;width:3px;height:3px;background:#e9d8ff;box-shadow:0 0 6px 2px rgba(190,150,255,.6);opacity:0;animation:chm var(--d) linear infinite;animation-delay:var(--dl)}
@keyframes chm{0%{transform:translate(0,0);opacity:0}15%{opacity:.9}60%{transform:translate(var(--x),-55vh);opacity:.7}100%{transform:translate(0,-95vh);opacity:0}}
body.onbm .obw>h2{color:#f6edcf;text-shadow:2px 2px 0 #0b0a26}body.onbm .obw>h2:before,body.onbm .obw>h2:after{color:#f2c14e}
body.onbm .obpr small{color:#d9d0f5}
body.onbm .obw .card,body.onbm .obsay .tbx{--pn:#f7ecc9;--p2:#e9d6a3;--bg:#fbf4dc;--ink:#2b2418;--mut:#5e5034;--ln:#2b2418;color:var(--ink)}
body.onbm .obw .card{background:radial-gradient(ellipse at 50% 50%,rgba(255,250,230,0) 55%,rgba(150,105,45,.2) 100%),repeating-linear-gradient(0deg,rgba(120,85,40,.06) 0 2px,rgba(0,0,0,0) 2px 6px),linear-gradient(90deg,#efdfb4,#f7ecc9 12%,#f7ecc9 88%,#efdfb4);border-top:9px solid #6b4423;border-bottom:9px solid #6b4423;box-shadow:inset 0 3px 0 #a8743c,inset 0 -3px 0 #a8743c,4px 4px 0 #0b0a26}
.obsay{position:relative}.obsay .obz{position:relative;z-index:1}.obsay .tbx{position:relative;z-index:1}
.v6rc{position:absolute;z-index:0;left:calc(clamp(96px,26vw,150px)*-.1);bottom:calc(clamp(96px,26vw,150px)*-.08);width:calc(clamp(96px,26vw,150px)*1.2);aspect-ratio:1;pointer-events:none}
.v6rc svg{display:block;width:100%;height:100%;animation:chrc 60s linear infinite}
.v6rc .obrn.on circle{filter:drop-shadow(0 0 3px #ffe27a)}
@keyframes chrc{to{transform:rotate(360deg)}}
.v6burst{position:fixed;left:50%;top:40%;z-index:75;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side,#fffbe6 0,#ffe27a 40%,rgba(242,193,78,0) 100%);opacity:0;animation:chb 1.4s ease-out forwards}
@keyframes chb{0%{opacity:0;transform:scale(.2)}20%{opacity:1}100%{opacity:0;transform:scale(30)}}
html.hw-q-performance .chf2,html.hw-q-performance .chm:nth-of-type(2n){display:none}
@media(prefers-reduced-motion:reduce){.v6obc *,.v6rc svg{animation:none!important}.chm,.v6burst{display:none!important}}
html.hw-still .chm,html.hw-still .v6burst{display:none!important}`);
const lit=()=>{const o=S.ob;return o?Math.min(6,o.i):0};
{const p=pages.onb;pages.onb=(...a)=>{const h=p(...a);try{chamber()}catch(e){console.error('[HWLooks]',e)}return h.replace('<div class="obsay">','<div class="obsay"><span class="v6rc" aria-hidden="true">'+ring(lit())+'</span>')}}
function burst(){if(!(typeof HWMotion!=='undefined'?HWMotion.reduced():HWUI.reduced())){const b=document.createElement('div');b.className='v6burst';b.setAttribute('aria-hidden','true');document.body.appendChild(b);setTimeout(()=>b.remove(),1500)}
  if(typeof sfx==='function')[[1568,.22],[2093,.4]].forEach((c,i)=>setTimeout(()=>sfx(c[0],c[1]),520+i*140))}
{const o=acts.obf;acts.obf=function(){const was=S.ob&&S.ob.i,r=o.apply(this,arguments);if(was!==7&&S.ob&&S.ob.i===7)burst();return r}}

/* ---------- the Shadow Keep ---------- */
const restored=()=>KR.filter(r=>klv(r[3])>0).length;
const storm=n=>Math.max(.12,1-n/KR.length);
const BAT=['kk..k.k..kk','kkkkkkkkkkk','.kkkrkrkkk.','..kk.k.kk..','...k...k...'];
const R=(x,y,w,h,f,e)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+f+'"'+(e||'')+'/>';
const SP=(m,p,x,y)=>m.map((r,j)=>{let i=0,o='';(r.match(/(.)\1*/g)||[]).forEach(t=>{if(p[t[0]])o+=R(x+i,y+j,t.length,1,p[t[0]]);i+=t.length});return o}).join('');
// stepped (crooked) spire: rows of [x,w] from the base upward, 2 units each
const spire=(rows,y0,c,hl)=>rows.map(([x,w],i)=>R(x,y0-2*(i+1),w,2,c)+R(x,y0-2*(i+1),1,2,hl)).join('');
const C={s0:'#1b1428',s1:'#2c2240',s2:'#3f3258',s3:'#56467a',m:'#150e20',k:'#08040e',r0:'#1e1626',r1:'#30263c',r2:'#4a3c58',g1:'#3c6b35',g2:'#5f9a41',iron:'#4a4458',ch1:'#9a94a8',ch2:'#5d5770',b1:'#5e1429',b2:'#8a2340',red:'#ff3b2f',vio:'#b04cff'};
// a wall block with mortar rows and light from the left
function block(x,y,w,h){let g=R(x,y,w,h,C.s1)+R(x,y,2,h,C.s2)+R(x+w-2,y,2,h,C.s0);
  for(let yy=y+3,r=0;yy<y+h;yy+=4,r++){g+=R(x,yy,w,1,C.m);for(let xx=x+(r%2?2:5);xx<x+w-1;xx+=6)g+=R(xx,yy-3,1,3,C.m)}return g}
function win(x,y,w,h,c,l){return R(x-1,y-1,w+2,h+2,c,' opacity=".25"')+R(x,y,w,h,C.k)+R(x,y+1,w,h-1,c,' class="zt" style="--d:'+(1.2+l*.37%1.4).toFixed(2)+'s;--l:'+(l*.29%1.5).toFixed(2)+'s"')}
/** The keep in local units: x 0…72, ground line (plinth bottom) y = 60, cliff to y = 87, spire tip y = -22.
    a = storm strength 0…1, anim = include moving parts. */
function keep(a,anim){let g='';
  // storm aura: glow + two rings of storm clouds circling the keep
  const cl=(n,r,s)=>Array.from({length:n},(_,i)=>{const t=i/n*Math.PI*2,x=Math.round(36+Math.cos(t)*r),y=Math.round(24+Math.sin(t)*r*.8);return R(x-s,y-1,s*2,3,'#2a1d42')+R(x-s+2,y-3,s*2-4,2,'#3d2c6a')+(i%3?'':R(x,y+2,1,3,'#c9b6ff'))}).join('');
  g+='<g class="v6aura" opacity="'+a.toFixed(2)+'"><circle cx="36" cy="24" r="46" fill="url(#v6kg)"/>'
   +'<g'+(anim?' class="zr" style="--d:'+(26+Math.round((1-a)*30))+'s"':'')+'>'+R(36-50,24-42,100,84,'#000',' opacity="0"')+cl(9,50,6)+'</g>'
   +'<g'+(anim?' class="zr v6rev" style="--d:'+(38+Math.round((1-a)*30))+'s"':'')+'>'+R(36-40,24-34,80,68,'#000',' opacity="0"')+cl(7,40,4)+'</g></g>';
  // cliff (wider at the top, light from the left) + cast shadow
  g+=R(8,86,66,2,'#000',' opacity=".4"')+R(16,88,50,1,'#000',' opacity=".25"');
  [[60,0,72],[63,1,71],[66,3,68],[69,4,67],[72,6,64],[75,7,62],[78,10,59],[81,12,56],[84,14,52]].forEach(([y,x0,x1],i)=>{g+=R(x0,y,x1-x0,3,C.r1)+R(x0,y,2,3,C.r2)+R(x1-3,y,3,3,C.r0)+(i%2?R(x0+4,y+2,x1-x0-10,1,C.r0):'')});
  g+=R(20,64,1,3,C.k)+R(21,67,1,3,C.k)+R(20,70,1,3,C.k)+R(48,66,1,4,C.k)+R(47,70,1,3,C.k)+R(33,74,1,3,C.k)+R(34,77,1,4,C.k)+R(5,63,4,1,C.g1)+R(56,70,5,1,C.g1)+R(12,72,3,1,C.g2)+R(40,81,4,1,C.g1);
  // spires and roofs (behind the bodies' tops)
  g+=R(2,16,16,2,C.s0)+spire([[3,13],[3,11],[3,9],[2,8],[2,6],[1,5],[1,3],[0,2],[0,1]],16,C.s0,C.s2);
  g+=R(54,22,16,2,C.s0)+spire([[55,13],[57,11],[58,9],[59,8],[61,6],[62,4],[64,2],[65,1]],22,C.s0,C.s2);
  g+=spire([[30,12],[31,10],[32,8],[33,7],[33,6],[34,5],[35,4],[35,3],[36,2],[37,1],[37,1]],4,C.s0,C.s2);
  g+=R(23,0,3,4,C.s0)+R(22,-2,2,2,C.s0)+R(21,-4,1,2,C.s0)+R(47,0,3,4,C.s0)+R(49,-2,2,2,C.s0)+R(51,-4,1,2,C.s0);
  // tattered flag on the keep spire
  g+=R(37,-30,1,8,C.iron)+'<g'+(anim?' class="zf"':'')+'>'+R(38,-30,6,3,C.b2)+R(38,-27,4,1,C.b1)+R(44,-30,1,2,C.b2)+R(42,-27,1,1,C.b2)+'</g>';
  // towers and keep, all standing on the plinth top (y = 56)
  g+=block(4,18,12,38)+block(56,24,12,32)+block(24,8,24,48);
  // jagged broken battlements on the keep
  [[24,3,4],[29,3,2],[34,3,4],[39,3,3],[44,4,4]].forEach(([x,w,h])=>g+=R(x,8-h,w,h,C.s1)+R(x,8-h,w,1,C.s3));
  // curtain walls with teeth, then the plinth (the foundation on the ground line)
  g+=block(16,34,8,22)+block(48,34,8,22);
  for(let x=16;x<56;x+=3){if(x>=24&&x<48)continue;const h=x%2?2:3;g+=R(x,34-h,2,h,C.s1)+R(x,34-h,2,1,C.s3)}
  g+=R(2,56,68,4,C.s2)+R(2,56,68,1,C.s3)+R(2,59,68,1,C.s0)+[8,16,24,32,40,48,56,64].map(x=>R(x,57,1,2,C.m)).join('');
  // cracks and moss
  g+=R(27,22,1,3,C.k)+R(28,25,1,3,C.k)+R(27,28,1,3,C.k)+R(13,40,1,3,C.k)+R(12,43,1,4,C.k)+R(61,44,1,3,C.k)+R(62,47,1,3,C.k)+R(45,14,1,3,C.k)+R(44,17,1,2,C.k);
  g+=R(4,54,5,2,C.g1)+R(5,53,2,1,C.g2)+R(56,54,4,2,C.g1)+R(16,55,6,1,C.g1)+R(49,55,5,1,C.g2)+R(24,54,3,2,C.g1)+R(45,54,3,2,C.g1)+R(2,55,2,1,C.g2)+R(66,55,3,1,C.g2)+R(4,18,3,1,C.g1)+R(56,24,2,1,C.g2);
  // windows: red and violet, the keep's great eye
  g+=win(9,24,2,4,C.red,1)+win(9,36,2,4,C.vio,2)+win(11,46,2,3,C.red,3)+win(61,30,2,4,C.vio,4)+win(60,42,2,4,C.red,5)+win(27,30,2,4,C.vio,6)+win(43,30,2,4,C.vio,7)+win(18,40,2,3,C.red,8)+win(52,40,2,3,C.red,9);
  g+=R(31,12,10,10,C.k)+R(32,13,8,8,C.red,' opacity=".3"')+R(33,14,6,6,C.red,anim?' class="zpl"':'')+R(35,14,2,6,C.k)+R(30,11,12,1,C.s3);
  // gate: dark arch, red glow, toothed portcullis half raised
  g+=R(32,42,8,1,C.k)+R(31,43,10,1,C.k)+R(30,44,12,12,C.k)+R(30,52,12,4,C.red,' opacity=".35"')+R(29,41,14,1,C.s3);
  for(let x=31;x<42;x+=2)g+=R(x,42,1,10,C.iron)+R(x,52,1,2,C.ch1);
  g+=R(30,45,12,1,C.iron)+R(30,49,12,1,C.iron);
  // chains from the keep to the portcullis, and a sagging chain along the left wall
  [[26,34],[27,36],[28,38],[29,40],[46,34],[45,36],[44,38],[43,40]].forEach(([x,y],i)=>g+=R(x,y,1,1,i%2?C.ch2:C.ch1)+R(x,y+1,1,1,i%2?C.ch1:C.ch2));
  [[16,37],[18,38],[20,38],[22,37]].forEach(([x,y],i)=>g+=R(x,y,2,1,i%2?C.ch1:C.ch2));
  // tattered banners on the walls
  const ban=x=>{const L=[10,12,9,11,8];return L.map((h,i)=>R(x+i,35,1,h,i?C.b1:C.b2)).join('')+R(x-1,34,7,1,C.iron)+R(x+2,39,1,2,C.vio)+R(x+1,40,3,1,C.vio)};
  g+=ban(17)+ban(49);
  // bats
  if(anim)g+=[[2,-14,6],[52,-8,8],[30,-24,7]].map(c=>'<g transform="translate('+c[0]+' '+c[1]+')"><g class="zp" style="--d:'+c[2]+'s"><g class="zw">'+SP(BAT,{k:'#0e0818',r:C.red},0,0)+'</g></g></g>').join('');
  return g}
const DEFS='<defs><radialGradient id="v6kg"><stop offset="0" stop-color="#7a2cff" stop-opacity=".5"/><stop offset=".6" stop-color="#4a1a8a" stop-opacity=".25"/><stop offset="1" stop-color="#2a1050" stop-opacity="0"/></radialGradient></defs>';
/** for the title scene: the keep placed on its slope (cliff base runs under the hills) */
function title(){const n=restored();return DEFS+'<g class="v6keep" transform="translate(14 32)">'+keep(storm(n),true)+'</g>'}
function kcard(){const n=restored(),a=storm(n),pc=Math.round(a*100);
  return '<div class="card" id="v6keep"><h3>🏯 THE SHADOW KEEP</h3><svg class="v6ksv" viewBox="-28 -38 128 130" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges" role="img" aria-label="The Shadow Keep. Its storm is at '+pc+' percent; '+n+' of '+KR.length+' regions restored.">'+DEFS
  +R(-28,-38,128,130,'#120c26')+R(-28,40,128,46,'#1a1236')+R(-28,86,128,6,'#15101e')+R(-28,86,128,1,'#2a2236')+keep(a,true)+'</svg>'
  +'<p style="margin:8px 0 4px">The storm around the keep weakens as you restore regions: <b>'+n+'/'+KR.length+'</b> restored.</p>'+bar(pc,'var(--vio)')+'<small class="mut">Storm strength '+pc+'%</small><br><span class="gtag">🎮 GAME LAYER · NOT A HEALTH MEASUREMENT</span></div>'}
HWUI.css('looks-keep',`.v6ksv{display:block;width:100%;height:clamp(180px,52vw,260px);border:3px solid var(--ln);background:#120c26}
.v6ksv *,.v6keep *{transform-box:fill-box}.v6rev{animation-direction:reverse!important}
html.hw-q-performance .v6ksv .zt,html.hw-q-performance .v6ksv .zp{animation:none!important}`);
{const p=pages.kingdom;pages.kingdom=(...a)=>{const h=p(...a),k='<div class="card" id="v6chron">',i=h.indexOf(k);return i<0?h+kcard():h.slice(0,i)+kcard()+h.slice(i)}}
return{THEMES,ORDER,PAL,TINTS,choice,match,resolve,gen,apply,set,ratio,keep,title,restored,storm,ring}})();
