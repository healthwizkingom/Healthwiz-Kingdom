/* v6: animation system and performance modes (master prompt §65–67, §97 step 13). Not part of the original.
   One place that decides how much the app moves. Settings (no schema step: optional keys in st.s,
   missing = default):
     st.s.anim   0 = animations off (everything still)               default on
     st.s.rm     1 = always reduce motion; otherwise follow the device  default follow device
     st.s.perf   'auto' | 'high' | 'balanced' | 'performance'         default auto
   Auto picks Performance on weak devices (≤2 CPU cores, ≤2 GB memory, data saver, or a slow
   frame probe after boot) and Balanced everywhere else.
     High         the original scene plus extra ambient life (birds, butterflies) and full particles
     Balanced     the original scene as designed; particles at 60%
     Performance  stops the busiest decorative loops (≈240 twinkling stars, swaying pines, lightning,
                  shooting stars, most fireflies), thins the original water/quest confetti, no parallax,
                  1× canvas resolution, particles at 25%
   The original only had the device's prefers-reduced-motion rules. Those rules are mirrored under
   html.hw-rm, so the in-app switch gives exactly the original reduced-motion look. All animation
   also pauses while the tab is hidden (battery). Emits `motion:changed`. */
const HWMotion=(()=>{
const LV=['high','balanced','performance'],NAME={auto:'Auto',high:'High',balanced:'Balanced',performance:'Performance'};
const mq=q=>{try{return matchMedia(q).matches}catch(e){return false}};
const s=()=>(typeof st!=='undefined'&&st&&st.s)||{};
const enabled=()=>s().anim!==0;
const device=()=>mq('(prefers-reduced-motion: reduce)');
const reduced=()=>!enabled()||s().rm===1||device();
const choice=()=>LV.includes(s().perf)?s().perf:'auto';
let probed=null;
function hint(){try{const n=navigator,c=n.connection;return (n.hardwareConcurrency&&n.hardwareConcurrency<=2)||(n.deviceMemory&&n.deviceMemory<=2)||!!(c&&c.saveData)}catch(e){return false}}
const auto=()=>probed||(hint()?'performance':'balanced');
const level=()=>choice()==='auto'?auto():choice();
const SCALE={high:1,balanced:.6,performance:.25},CAP={high:300,balanced:150,performance:50};
/** How many of `n` decorative particles to draw now (0 when motion is reduced or off). */
const count=n=>reduced()?0:Math.max(1,Math.round(n*SCALE[level()]));
const cap=()=>reduced()?0:CAP[level()];

/* mirror every prefers-reduced-motion block (original + v6) under html.hw-rm */
const seen=new WeakSet();let mirror=null;
function split(sel){const o=[];let d=0,b='';for(const ch of sel){if(ch==='('||ch==='[')d++;else if(ch===')'||ch===']')d--;if(ch===','&&!d){o.push(b);b=''}else b+=ch}o.push(b);return o.map(x=>x.trim()).filter(Boolean)}
function rulesOf(list,out){for(const r of list){if(r.media&&/prefers-reduced-motion\s*:\s*reduce/.test(r.media.mediaText||r.conditionText||'')){for(const x of r.cssRules)if(x.selectorText)out.push(split(x.selectorText).map(y=>'html.hw-rm '+y).join(',')+'{'+x.style.cssText+'}')}}}
function sync(){if(!mirror){mirror=document.createElement('style');mirror.dataset.v6='motion-rm'}
  let add=[];for(const sh of document.styleSheets){if(sh.ownerNode===mirror||seen.has(sh))continue;let L;try{L=sh.cssRules}catch(e){seen.add(sh);continue}seen.add(sh);rulesOf(L,add)}
  if(add.length)mirror.textContent+=add.join('\n')+'\n';if(!mirror.isConnected)document.head.appendChild(mirror)}
{const c=HWUI.css;HWUI.css=function(){const r=c.apply(this,arguments);sync();return r}}

HWUI.css('motion',`
html.hw-still *,html.hw-still *:before,html.hw-still *:after{animation:none!important;transition:none!important}
html.hw-still .fx u,html.hw-still .fl2 u,html.hw-still .fl2 .flf,html.hw-still .v6cel u{display:none}
html.hw-hidden *,html.hw-hidden *:before,html.hw-hidden *:after{animation-play-state:paused!important}
html.hw-q-performance .wl .zt,html.hw-q-performance .wl .zs,html.hw-q-performance .wl .zss,html.hw-q-performance .wl .zg,
html.hw-q-performance .wl .zh,html.hw-q-performance .wl .zr,html.hw-q-performance .km .zt,html.hw-q-performance .km .zwk{animation:none!important}
html.hw-q-performance .wl .zl,html.hw-q-performance .wl .zff:not(:nth-of-type(4n)),html.hw-q-performance .wl .zv:nth-of-type(2n){display:none}
html.hw-q-performance .fx u:nth-of-type(n+7),html.hw-q-performance .fx.done u:nth-of-type(n+13),html.hw-q-performance .fl2 u:nth-of-type(n+9),html.hw-q-performance .fl2 .flf:nth-of-type(n+2){display:none}
html.hw-q-performance .wl.v6px .zsv,html.hw-q-performance .wl.v6px .tt{transform:none}
#v6motion .v6mlab{font:8px/1.6 var(--fh);margin:12px 0 6px}`);

let last='';
function apply(quiet){const h=document.documentElement,L=level(),r=reduced(),off=!enabled();sync();
  h.classList.toggle('hw-rm',r);h.classList.toggle('hw-still',off);LV.forEach(x=>h.classList.toggle('hw-q-'+x,x===L));
  h.dataset.motion=off?'off':r?'reduced':'full';h.dataset.quality=L;
  const k=[L,r,off].join();if(k!==last){const was=last;last=k;if(was&&!quiet)HWEvents.emit('motion:changed',{level:L,reduced:r,enabled:!off,choice:choice()})}}
try{matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>apply())}catch(e){}
document.addEventListener('visibilitychange',()=>document.documentElement.classList.toggle('hw-hidden',document.hidden));

/* auto mode: one short frame probe after boot (only ever downgrades) */
function probe(n=45){return new Promise(res=>{if(document.hidden)return res(null);const d=[];let t0=0;
  const f=t=>{if(t0)d.push(t-t0);t0=t;if(d.length<n)requestAnimationFrame(f);else{d.sort((a,b)=>a-b);res(d[d.length>>1])}};requestAnimationFrame(f)})}
HWEvents.on('app:ready',()=>{apply(true);if(choice()!=='auto'||reduced())return;setTimeout(()=>probe().then(m=>{if(m&&m>45&&!probed){probed='performance';apply()}}),1500)});

/* settings */
function set(k,v){const S2=st.s;if(k==='perf')S2.perf=LV.includes(v)?v:'auto';else if(k==='anim')S2.anim=+v?1:0;else if(k==='rm')S2.rm=+v?1:0;save();apply()}
acts.mopt=d=>{set(d.k,d.v);render()};
const chip=(k,v,label,on)=>'<button class="chip'+(on?' on':'')+'" data-a="mopt" data-k="'+k+'" data-v="'+v+'" aria-pressed="'+on+'">'+label+'</button>';
function card(){const c=choice(),L=level(),dev=device();
  return '<div class="card" id="v6motion"><h3>✨ ANIMATION &amp; PERFORMANCE</h3>'
  +'<p class="v6mlab">ANIMATIONS</p><div class="row">'+chip('anim',1,'On',enabled())+chip('anim',0,'Off',!enabled())+'</div>'
  +'<p class="v6mlab">MOTION</p><div class="row">'+chip('rm',0,'Follow device',s().rm!==1)+chip('rm',1,'Reduce',s().rm===1)+'</div>'
  +(dev?'<small class="mut">Your device asks for reduced motion, so movement is already reduced.</small>':'')
  +'<p class="v6mlab">VISUAL QUALITY</p><div class="row">'+['auto',...LV].map(v=>chip('perf',v,NAME[v],c===v)).join('')+'</div>'
  +'<small class="mut">Now: <b>'+(enabled()?NAME[L]:'Still')+'</b>'+(c==='auto'?' (picked for this device)':'')+'. High adds extra ambient life. Performance calms the busiest background effects and particles for older phones and saves battery. Animation also pauses while the app is in the background.</small></div>'}
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k='<h2>⚙️ SETTINGS</h2>';return h.indexOf(k)>=0?h.replace(k,k+card()):h+card()}}
apply(true);
return{enabled,reduced,device,level,choice,count,cap,set,apply,probe,card}})();
