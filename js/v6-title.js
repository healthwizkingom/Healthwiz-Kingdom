/* v6: title screen upgrades (master prompt §5, §9–15, §97 step 12). Not part of the original.
   The original layered title scene (sky, ridges, floating castle, waterfall, village with
   chimney smoke, river, dark tower, bats, fireflies) is untouched. Added on top:
     §14 time of day   morning / afternoon / evening / night light over the scene (local clock)
     §15 weather       sunny / cloudy / light rain / mist, one per calendar day (visual only). When live weather for
                       Kolej MARA Kulim is on and available (js/v6-live.js), the sky follows it instead: clear day or
                       night (moon and stars), clouds, mist, light rain, rain, downpour or a storm with lightning.
                       restyle() repaints the sky in place when new data arrives, without replaying the intro.
     §13 returning     progress ribbon (level, regions restored, gentle streak) + a lantern for
                       every restored region along the riverbank
     §9  tap the castle, dark tower, village or waterfall for a short reaction
     §10 a Settings button next to the original Start/Continue button
     §5  gentle pointer parallax          §12 short entry transition
   §5/§12 are skipped under reduced motion; all animation follows the original reduced-motion rule.
   Visual quality (js/v6-motion.js): High adds birds and butterflies; Performance uses less rain and no parallax. */
const HWTitle=(()=>{
const reduced=()=>HWUI.reduced();
const phase=(h=new Date().getHours())=>h>=5&&h<11?'morning':h>=11&&h<17?'afternoon':h>=17&&h<20?'evening':'night';
const PH={morning:'Morning',afternoon:'Afternoon',evening:'Evening',night:'Night'};
function weather(d=today()){let x=0;for(const c of d)x=(x*31+c.charCodeAt(0))>>>0;x=(x^(x>>>7))%10;return x<5?'sunny':x<7?'cloudy':x<9?'rain':'mist'}
const WN={sunny:'clear skies',night:'moon and stars',cloudy:'drifting clouds',rain:'light rain',heavy:'rain',downpour:'downpour',storm:'thunderstorm',mist:'mist over the valley'};
// live weather (js/v6-live.js) when it is on and available; otherwise the day's own weather
const live=()=>typeof HWLive!=='undefined'?HWLive:null;
function sky(){try{const L=live(),s=L&&L.sky();if(s&&WN[s])return s}catch(e){}return weather()}
const RAIN={rain:40,heavy:70,downpour:110,storm:80};
// the weather layer over the scene: rain streaks, a lightning flash (never under reduced motion), haze tint
function layer(wx){const perf=HWMotion.level()==='performance',n=RAIN[wx]?Math.round(RAIN[wx]*(perf?.35:1)):0;
  const rain=Array.from({length:n},(_,k)=>'<i style="left:'+(k*(104/n)%100).toFixed(1)+'%;animation-delay:-'+(k*.07%0.9).toFixed(2)+'s;animation-duration:'+(.7+k%5*.08).toFixed(2)+'s"></i>').join('');
  let hz=false;try{hz=!!(live()&&live().hazy())}catch(e){}
  return '<div class="v6wx '+wx+'">'+(wx==='night'?stars():'')+rain+(wx==='storm'&&!reduced()?'<b class="v6fl"></b>':'')+'</div>'+(hz?'<div class="v6hz"></div>':'')}
function stars(){return '<b class="v6moon"></b>'+Array.from({length:14},(_,k)=>'<u style="left:'+((k*37+9)%94+2)+'%;top:'+((k*23+5)%30+2)+'%;animation-delay:-'+(k*.4).toFixed(1)+'s"></u>').join('')}
function caption(ph,wx){return PH[ph].toUpperCase()+' IN THE KINGDOM · '+WN[wx].toUpperCase()}
// the sun is the original's; wrapping it lets clouds, rain and night hide it (opacity only)
const SUN0='<circle cx="196" cy="88" r="34" fill="url(#zg2)" class="zpl"/>',SUN1='<circle cx="196" cy="88" r="6" fill="#fffbe0"/>';
function wrapSun(h){const a=h.indexOf(SUN0),b=a<0?-1:h.indexOf(SUN1,a);return b<0?h:h.slice(0,a)+'<g class="v6sun">'+h.slice(a,b+SUN1.length)+'</g>'+h.slice(b+SUN1.length)}
HWUI.css('title',`
.v6tod,.v6wx{position:absolute;inset:0;pointer-events:none}
.v6tod.morning{background:linear-gradient(#ffd6a8,transparent 60%);mix-blend-mode:soft-light;opacity:.55}
.v6tod.afternoon{background:linear-gradient(#bfe6ff,transparent 70%);mix-blend-mode:soft-light;opacity:.5}
.v6tod.evening{background:linear-gradient(#ff8a5c,#7a3b6a 70%);mix-blend-mode:soft-light;opacity:.5}
.v6tod.night{background:#0b1030;mix-blend-mode:multiply;opacity:.35}
.v6wx.cloudy{background:linear-gradient(rgba(120,130,160,.35),transparent 55%)}
.v6mist{animation:v6mist 18s ease-in-out infinite alternate}
@keyframes v6mist{to{transform:translateX(4px)}}
.v6wx i{position:absolute;top:-10%;width:1px;height:14px;background:rgba(200,225,255,.7);animation:v6rain .9s linear infinite}
@keyframes v6rain{to{transform:translate(-18px,115vh)}}
.wl .v6sun{transition:opacity 1.2s}
.wl[data-sky=cloudy] .v6sun,.wl[data-sky=mist] .v6sun{opacity:.35}
.wl[data-sky=night] .v6sun,.wl[data-sky=rain] .v6sun,.wl[data-sky=heavy] .v6sun,.wl[data-sky=downpour] .v6sun,.wl[data-sky=storm] .v6sun{opacity:0}
.v6wx.heavy,.v6wx.downpour,.v6wx.storm{background:linear-gradient(rgba(40,48,70,.42),rgba(40,48,70,.12) 70%)}
.v6wx.downpour,.v6wx.storm{background:linear-gradient(rgba(24,28,46,.58),rgba(24,28,46,.2) 70%)}
.v6wx.heavy i,.v6wx.storm i{height:18px}.v6wx.downpour i{height:24px;width:2px;opacity:.85}
.v6wx .v6fl{position:absolute;inset:0;background:#eef0ff;opacity:0;animation:v6fl 5s linear infinite}
/* two quick flashes 150 ms apart every 5 s: never more than 3 a second */
@keyframes v6fl{0%,89%,100%{opacity:0}90%{opacity:.5}91.5%{opacity:0}93%{opacity:.35}94.5%{opacity:0}}
.wl[data-sky=storm] .zl{animation-duration:5s!important}
/* the original moon (scene y −150) is on screen only when the screen is taller than about 4:3; elsewhere draw one */
.v6wx .v6moon{display:none}@media(min-aspect-ratio:3/4){.v6wx .v6moon{display:block}}
.v6wx .v6moon{position:absolute;top:7%;right:12%;width:22px;height:22px;border-radius:50%;background:#f6edcf;box-shadow:inset -7px -3px 0 #d9cfae,0 0 18px 5px rgba(246,237,207,.3)}
.v6wx u{position:absolute;width:2px;height:2px;background:#fffbea;animation:v6tw 2.6s steps(3) infinite alternate}
@keyframes v6tw{from{opacity:.2}to{opacity:.95}}
.v6hz{position:absolute;inset:0;pointer-events:none;background:linear-gradient(rgba(200,176,128,.5),rgba(186,170,140,.28) 60%,rgba(186,170,140,.16))}
.v6wxt{display:inline-block;max-width:min(92vw,520px);margin-top:8px;padding:5px 10px;font:12px/1.5 var(--fb);color:#fff;background:rgba(20,32,79,.72);border:2px solid rgba(255,255,255,.55);text-shadow:1px 1px 0 #000}
.v6wxt small{display:block;color:#ffe9a8}
.v6rib{display:inline-block;margin-top:12px;padding:5px 10px;font:8px/1.8 var(--fh);color:#fff;background:rgba(20,32,79,.72);border:2px solid #f2c14e;text-shadow:1px 1px 0 #000}
.wl .ct{gap:10px;flex-wrap:wrap}.wl .ct .v6set{font-size:10px;padding:10px 12px}
.v6hot{pointer-events:all;cursor:pointer}.v6pop{position:absolute;z-index:9;pointer-events:none;font:9px/1.6 var(--fh);color:#fff;background:rgba(20,32,79,.85);border:2px solid #f2c14e;padding:4px 8px;white-space:nowrap;transform:translate(-50%,-120%);animation:v6pop 1.8s steps(12) forwards}
@keyframes v6pop{0%{opacity:0;margin-top:6px}15%{opacity:1;margin-top:0}80%{opacity:1}100%{opacity:0;margin-top:-10px}}
.wl.v6px .zsv{transform:scale(1.03) translate(calc(var(--px,0)*-6px),calc(var(--py,0)*-4px));transition:transform .4s ease-out}
.wl.v6px .tt{transform:translate(calc(var(--px,0)*3px),calc(var(--py,0)*2px));transition:transform .4s ease-out}
.wl.v6go .bg{animation:v6zoom .45s ease-in forwards}.wl.v6go .tt,.wl.v6go .ct,.wl.v6go .ft{animation:v6fade .3s ease-in forwards}
@keyframes v6zoom{to{transform:scale(1.15);filter:brightness(1.6);opacity:0}}@keyframes v6fade{to{opacity:0}}
@media(prefers-reduced-motion:reduce){.v6wx,.v6wx i,.v6pop,.v6mist{animation:none!important}.v6wx i,.v6wx .v6fl{display:none}.v6wx u{opacity:.7}.wl.v6px .zsv,.wl.v6px .tt{transform:none}}
/* step 25 (§77, §94): a phone in landscape is shorter than the scene's 540 px minimum, which pushed the Start button
   below the screen. Short landscape screens use their own height, and the title text is capped by height too. */
@media(orientation:landscape) and (max-height:539px){.wl{min-height:0}.wl .tt h1{font-size:clamp(20px,min(6.4vw,9vh),52px)}
.wl .tt p{font-size:clamp(9px,min(2.2vw,3.4vh),14px);margin-top:min(14px,2.5vh)}.wl .tt p.by{font-size:clamp(10px,min(2.8vw,4.2vh),18px);margin-top:min(18px,3vh)}}`);

const REACT={castle:['🏰 The castle bells ring for you!','🏰 A guard waves from the ramparts.'],tower:['⚡ The dark tower rumbles… restored regions keep it at bay.','⚡ Its red eye flickers, then dims.'],
  village:['🏘️ Villagers wave hello!','🏘️ Someone is baking bread. It smells wonderful.'],falls:['💧 The waterfall sparkles.','💧 Cool spray drifts across the meadow.']};
const HOT=[['castle',150,8,70,34],['tower',8,0,58,76],['falls',140,38,20,62],['village',0,100,124,44]];
function lanterns(n){return Array.from({length:n},(_,i)=>{const x=14+i*12,y=104-(i%2)*3;return '<g class="v6lan"><rect x="'+x+'" y="'+(y-6)+'" width=".6" height="6" fill="#3a2a1a"/><rect x="'+(x-1)+'" y="'+(y-8)+'" width="2.6" height="2.6" fill="#ffd76a" class="zpl"/><circle cx="'+(x+.3)+'" cy="'+(y-6.7)+'" r="3.2" fill="#ffcf6a" opacity=".22"/></g>'}).join('')}
// High quality only (§66): a small flock of birds crossing the sky and two butterflies by the meadow.
// Reuses the original drift (zd), wing-flap (zw) and firefly-float (zff) animations.
function ambient(){const bird='<path d="M0,0 l1.6,1.2 l1.6,-1.2" stroke="#2b2418" stroke-width=".5" fill="none"/>';
  const flock=[[22,0,0],[25,4,1.6],[24,7,-1.4]].map(([y,dx,dy])=>'<g transform="translate('+dx+' '+(y+dy)+')"><g class="zw">'+bird+'</g></g>').join('');
  const fly=(x,y,c,d)=>'<g class="zff" style="--x:7px;--y:4px;--d:'+d+'s"><g class="zw"><rect x="'+x+'" y="'+y+'" width="1.4" height="1.2" fill="'+c+'"/><rect x="'+(x+1.6)+'" y="'+y+'" width="1.4" height="1.2" fill="'+c+'"/></g></g>';
  return '<g class="v6amb"><g class="zd" style="--d:46s;animation-delay:-20s">'+flock+'</g>'+fly(96,124,'#ff9be0',9)+fly(150,128,'#ffe27a',12)+'</g>'}
// Mist lies in the valley below the knight: drawn in scene units so its top edge stays at the knight's
// boots (y 109.2 of the 240×160 scene) at every screen size, and never covers him.
const MIST_TOP=109.2;
function mist(){return '<g class="v6mistg"><defs><linearGradient id="v6mg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e6ecff" stop-opacity="0"/><stop offset=".18" stop-color="#e6ecff" stop-opacity=".45"/><stop offset="1" stop-color="#e6ecff" stop-opacity=".22"/></linearGradient></defs>'
  +'<rect class="v6mist" x="-700" y="'+MIST_TOP+'" width="1640" height="'+(160-MIST_TOP+40)+'" fill="url(#v6mg)" pointer-events="none"/></g>'}
function restored(){try{return KR.filter(r=>klv(r[3])>0).length}catch(e){return 0}}
function ribbon(){if(!(st.e.length||st.xp))return '';const L=lvl();let g=0;try{g=HWStreaks.gentle().days}catch(e){}
  return '<div class="v6rib">⭐ LV '+(L.i+1)+' · '+L.n.toUpperCase()+' · 🏰 '+restored()+'/8 RESTORED'+(g>=2?' · 🌿 '+g+'-DAY STREAK':'')+'</div>'}
{const p=pages.welcome;pages.welcome=(...a)=>{let h=wrapSun(p(...a));const ph=phase(),wx=sky();
  const hot=HOT.map(([k,x,y,w,hh])=>'<rect class="v6hot" data-a="tspot" data-k="'+k+'" x="'+x+'" y="'+y+'" width="'+w+'" height="'+hh+'" fill="transparent"/>').join('');
  const i=h.indexOf('</svg>');if(i>0)h=h.slice(0,i)+lanterns(restored())+(HWMotion.level()==='high'?ambient():'')+(wx==='mist'?mist():'')+hot+h.slice(i);
  h=h.replace('<div class="wl">','<div class="wl" data-sky="'+wx+'">');
  h=h.replace('</svg></div>','</svg><div class="v6tod '+ph+'"></div>'+layer(wx)+'</div>');
  let chip='';try{chip=live()?live().titleChip():''}catch(e){}
  h=h.replace('<p class="by t2">BY GROUP 14</p>','<p class="by t2">BY GROUP 14</p><div class="t2" data-tod="'+ph+'" data-wx="'+wx+'" style="margin-top:6px;font:8px var(--fh);color:#fff;text-shadow:1px 1px 0 #000">'+caption(ph,wx)+'</div><div id="v6wxt">'+chip+'</div>'+ribbon());
  h=h.replace('</button></div><div class="ft">','</button><button class="g v6set" data-a="go" data-v="set" aria-label="Settings">⚙️ SETTINGS</button></div><div class="ft">');
  return h}}

/* live weather arrived or changed: repaint the sky, caption and chip in place (no intro replay) */
function restyle(){const w=document.querySelector('.wl');if(!w)return;const wx=sky(),ph=phase();
  w.dataset.sky=wx;w.querySelectorAll('.v6wx,.v6hz').forEach(e=>e.remove());const t=w.querySelector('.v6tod');if(t)t.insertAdjacentHTML('afterend',layer(wx));
  const sv=w.querySelector('.zsv');if(sv){sv.querySelectorAll('.v6mistg').forEach(e=>e.remove());if(wx==='mist')sv.insertAdjacentHTML('beforeend',mist())}
  const c=w.querySelector('[data-wx]');if(c){c.dataset.wx=wx;c.dataset.tod=ph;c.textContent=caption(ph,wx)}
  const ch=w.querySelector('#v6wxt');if(ch)try{ch.innerHTML=live()?live().titleChip():''}catch(e){}}

/* tap reactions */
acts.tspot=(d,t,e)=>{const r=REACT[d.k];if(!r)return;const w=document.querySelector('.wl');if(!w)return;const b=w.getBoundingClientRect(),el=document.createElement('div');el.className='v6pop';el.textContent=r[Math.floor(Math.random()*r.length)];
  const x=e&&e.clientX!=null?e.clientX:b.left+b.width/2,y=e&&e.clientY!=null?e.clientY:b.top+b.height/2;el.style.left=Math.min(b.width-90,Math.max(90,x-b.left))+'px';el.style.top=(y-b.top)+'px';w.appendChild(el);setTimeout(()=>el.remove(),1900);
  if(typeof sfx==='function')sfx({castle:784,tower:196,village:523,falls:659}[d.k],.12);HWEvents.emit('title:interact',{k:d.k})};

/* parallax (pointer only, gentle) */
// If reduced motion is switched on mid-session, any parallax already applied is dropped.
const still=()=>{const w=document.querySelector('.wl.v6px');if(w)w.classList.remove('v6px')};
try{matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',q=>{if(q.matches)still()})}catch(e){}
HWEvents.on('motion:changed',e=>{if(e.reduced||e.level==='performance')still()});
let raf=0;document.addEventListener('pointermove',e=>{if(S.v!=='welcome')return;if(reduced()||HWMotion.level()==='performance')return still();if(raf)return;raf=requestAnimationFrame(()=>{raf=0;if(reduced())return still();const w=document.querySelector('.wl');if(!w)return;w.classList.add('v6px');w.style.setProperty('--px',((e.clientX/innerWidth)-.5).toFixed(3));w.style.setProperty('--py',((e.clientY/innerHeight)-.5).toFixed(3))})});

/* short transition when entering from the title screen */
{const g=acts.go;acts.go=function(d,t,e){if(S.v==='welcome'&&d&&d.v!=='set'&&!reduced()){const w=document.querySelector('.wl');if(w&&!w.classList.contains('v6go')){w.classList.add('v6go');if(typeof sfx==='function')[392,523,659].forEach((f,i)=>setTimeout(()=>sfx(f,.08),i*90));setTimeout(()=>g.call(this,d,t,e),420);return}}return g.apply(this,arguments)}}
return{phase,weather,sky,restyle,restored,MIST_TOP}})();
