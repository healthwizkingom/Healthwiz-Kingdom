/* v6: SLEEP NOW (the "Trance of Restoration"), a card under LOG SLEEP on the Sleep page. Not part of the original.
   The phone lies on the mattress; its motion sensor (and, if allowed, its microphone level) is read while you sleep, and in
   the morning the night is turned into a game readout and a normal Sleep log entry.

   HONEST BY DESIGN (docs/DISCLAIMERS.md): the three "depths" are ESTIMATES from how much the phone moved. A phone cannot
   see brain waves, so they are not sleep stages and nothing here is a medical measurement. The thresholds are HealthWiz's
   own, uncalibrated defaults. If the phone gives no motion data, nothing is tracked or invented.

   Names (arcane term = what the code measures):
     Astral Drift     = restless epoch: high variance of the acceleration size
     Arcane Stillness = settled epoch: low-to-moderate variance
     Abyssal Slumber  = still epoch: near-zero variance
     Echoes from the Veil = microphone level well above the room's rolling quiet level (a spike). No audio is ever recorded or
                        stored: only the level is read, and only a count of spikes is kept.
     Time to Cross the Veil = minutes from BEGIN until the first 15 min in a row of Stillness or deeper (not counted as sleep)
     Restored Mana    = min(100, hours slept ÷ the low end of your sleep goal × 100), a game value
     Interrupted Rite = under 90 min asleep: nothing is saved
     Severed Conduit  = 6 h in a row with next to no movement: the phone was probably left on a table, so counting stops there
   Rules: epochs of 5 min; at most 2 sessions and 13 h per 24 h; ending needs the seal held for 3 s; the smart wake rings in
   Astral Drift inside a 15 / 20 / 30 min window before the wake time, else at the wake time (through the alarm in v6-alarm.js).
   Saved: a normal sleep entry {bed, wake, aw, lat, rest, score} plus m.tr = {v:1, e:'DSA…' one letter per epoch (g = no data),
   o: first sleep epoch, sp: spike count, s/n: start and end in ms}. Older saves simply have no m.tr.
   A night in progress is kept in st.s.trLive so a page reload does not lose it (the gap becomes "no data"). */
const HWTrance=(()=>{
const D=document,N=navigator,TAU=Math.PI*2;
const EP=5,EPMS=EP*6e4,MINMIN=90,CAPH=13,MAXN=2,FLATEP=72,LATEP=3,SPIKE=12,MINSAMP=300,SEAL=3000;
// uncalibrated defaults (variance of |a| in (m/s²)²): see the header
const T_A=6e-4,T_S=6e-3,T_FLAT=2e-4;
const NAME={D:'Astral Drift',S:'Arcane Stillness',A:'Abyssal Slumber'};
const two=n=>(n<10?'0':'')+n,hhmm=ms=>{const d=new Date(ms);return two(d.getHours())+':'+two(d.getMinutes())};
const ico=(n,s,l)=>HWPixel.icon(n,l?{s:s||1,label:l}:s||1);
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const okE=s=>typeof s==='string'&&/^[DSAg]{0,200}$/.test(s);

/* ---------- pure engine (no browser, no clock): the tests call these ---------- */
/** One epoch's tier from the variance of the phone's acceleration size. */
const tier=v=>v<T_A?'A':v<T_S?'S':'D';
/** Minutes before the first run of `LATEP` epochs of Stillness or deeper, or null when there never is one. */
function onset(e){for(let i=0;i+LATEP<=e.length;i++){let ok=1;for(let j=0;j<LATEP;j++)if(e[i+j]!=='S'&&e[i+j]!=='A'){ok=0;break}if(ok)return i}return null}
/** Severed Conduit: index where 6 h of flat-line begins (variance values `vs` below T_FLAT in a row), or -1. */
function flat(vs){let run=0;for(let i=0;i<vs.length;i++){run=vs[i]<T_FLAT?run+1:0;if(run>=FLATEP)return i-FLATEP+1}return -1}
/** Percent of tiers D/S/A over the epochs from `o`, ignoring no-data epochs. */
function pct(e,o){const c={D:0,S:0,A:0};let n=0;for(let i=o;i<e.length;i++)if(c[e[i]]!=null){c[e[i]]++;n++}
  return n?{D:100*c.D/n,S:100*c.S/n,A:100*c.A/n,n}:null}
/** Today's type against the wizard's own average of earlier nights (needs 3): the stage furthest above it, or Balanced within ±3. */
function affinity(p,hist){if(!p||!hist||hist.length<3)return null;const m={D:0,S:0,A:0};hist.forEach(h=>{m.D+=h.D;m.S+=h.S;m.A+=h.A});
  ['D','S','A'].forEach(k=>m[k]/=hist.length);const dl={D:p.D-m.D,S:p.S-m.S,A:p.A-m.A};
  const k=['D','S','A'].reduce((a,b)=>dl[b]>dl[a]?b:a,'D');return{type:dl[k]<=3?'B':k,delta:dl,avg:m,n:hist.length}}
/** Bedtime steadiness over the last nights (minutes after noon): grade A ≤ 30 min, B ≤ 60 min, C above; null under 3 nights. */
function grade(beds){if(beds.length<3)return null;const a=beds.map(m=>m<720?m+1440:m),mu=a.reduce((x,y)=>x+y,0)/a.length,
  sd=Math.sqrt(a.reduce((x,y)=>x+(y-mu)*(y-mu),0)/a.length);return{g:sd<=30?'A':sd<=60?'B':'C',sd}}
/** The night: e = one letter per epoch, vs = variances, o.capH = hours still allowed in the last 24 h, o.goalH, o.hist. */
function resolve(e,vs,o){o=o||{};e=e.slice();let sev=false;const f=vs?flat(vs):-1;
  if(f>=0){e=e.slice(0,f+FLATEP);sev=true}
  while(e.length&&(e[e.length-1]==='D'||e[e.length-1]==='g'))e.pop(); // morning cutoff: trailing restlessness or gaps are not sleep
  const on=onset(e),cap=Math.round((o.capH==null?CAPH:o.capH)*60/EP);let asleep=on==null?[]:e.slice(on);if(asleep.length>cap)asleep=asleep.slice(0,cap);
  const mins=asleep.filter(x=>x!=='g').length*EP,valid=mins>=MINMIN,h=Math.round(mins/6)/10;
  let aw=0,inD=0;for(let i=0;i<asleep.length;i++){if(asleep[i]==='D'){inD=1}else if(inD&&(asleep[i]==='S'||asleep[i]==='A')){aw++;inD=0}}
  const p=on==null?null:pct(asleep,0),goal=o.goalH||8;
  return{e,o:on,valid,mins,h,lat:on==null?null:on*EP,aw,sev,p,mana:valid?Math.round(Math.min(100,h/goal*100)):0,aff:valid?affinity(p,o.hist):null}}

/* ---------- storage ---------- */
const live=()=>isO(st.s.trLive)?st.s.trLive:null;
const setLive=v=>{if(v)st.s.trLive=v;else delete st.s.trLive;save()};
const tr=m=>isO(m&&m.tr)&&m.tr.v===1&&okE(m.tr.e)?m.tr:null;
const mine=()=>LC('sleep').filter(x=>tr(x.m));
function limits(now){const y=mine().filter(x=>+x.m.tr.n>now-864e5),used=y.reduce((a,x)=>a+(+x.v||0),0);
  return{n:y.length,left:Math.max(0,CAPH-used),blocked:y.length>=MAXN?'Two Trances have already been logged in the last 24 hours.':CAPH-used<MINMIN/60?'The 13 hour limit for the last 24 hours is used up.':''}}
const hist=()=>mine().slice(-30).map(x=>{const t=tr(x.m),o=+t.o;return Number.isInteger(o)?pct(t.e,o):null}).filter(Boolean);
function goalH(){const g=st.g&&Array.isArray(st.g.sleep)?st.g.sleep:SR(+st.p.age||16);return+g[0]||8}

/* ---------- the live tracker ---------- */
let M=null; // {state, start, target, win, ep:[], vs:[], sp:[], cur:{...}, ...}
const Z={state:'IDLE',motion:0,mic:0,micErr:'',flat:null,down:null,last:0,perm:'',charge:null};
let TK=0,WL=null,AC=null,AN=null,MS=null,buf=null,amb=null,hold=0,HT=0,view='';
const fresh=(t0)=>({n:0,mu:0,m2:0,db:0,t0});
function sample(x,y,z,t){if(!M||M.state!=='IN_TRANCE'&&M.state!=='SEAL_BREAKING')return;
  const a=Math.sqrt(x*x+y*y+z*z);if(t-Z.last<95)return;Z.last=t;
  [M.cur,M.min].forEach(c=>{c.n++;const d=a-c.mu;c.mu+=d/c.n;c.m2+=d*(a-c.mu)})}
function onMotion(ev){const g=ev.accelerationIncludingGravity;if(!g||g.x==null)return;Z.motion=1;const t=Date.now();
  Z.flat=Math.abs(g.z)>8;Z.down=g.z<-7; // face-down reads z < 0 on Android; some iPhones report the opposite sign, so it is only a hint
  sample(g.x,g.y,g.z,t)}
function sense(ok){return new Promise(res=>{const DM=window.DeviceMotionEvent;
  if(!DM){Z.perm='This browser has no motion sensor.';return res(0)}
  const go=()=>{removeEventListener('devicemotion',onMotion);addEventListener('devicemotion',onMotion);res(1)};
  if(typeof DM.requestPermission==='function'){DM.requestPermission().then(r=>{if(r==='granted')go();else{Z.perm='Motion access was not allowed. Allow it in the browser settings for this page.';res(0)}}).catch(()=>{Z.perm='Motion access could not be requested.';res(0)})}
  else go()})}
async function listen(){if(Z.mic||!N.mediaDevices||!N.mediaDevices.getUserMedia){if(!Z.mic&&!(N.mediaDevices&&N.mediaDevices.getUserMedia))Z.micErr='This browser cannot read the microphone.';return}
  try{MS=await N.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});const Ctx=window.AudioContext||window.webkitAudioContext;AC=new Ctx();
    const src=AC.createMediaStreamSource(MS);AN=AC.createAnalyser();AN.fftSize=1024;src.connect(AN);buf=new Float32Array(AN.fftSize);Z.mic=1;Z.micErr=''}
  catch(e){Z.micErr='Microphone not allowed: the Echoes from the Veil track is skipped (optional).'}}
function level(){if(!AN)return null;AN.getFloatTimeDomainData(buf);let s=0;for(let i=0;i<buf.length;i++)s+=buf[i]*buf[i];return 20*Math.log10(Math.sqrt(s/buf.length)+1e-7)} // dB below full scale; only this number is kept
function stopSense(){removeEventListener('devicemotion',onMotion);Z.motion=0;if(MS){MS.getTracks().forEach(t=>t.stop());MS=null}if(AC){try{AC.close()}catch(e){}AC=null}AN=null;Z.mic=0}
async function lock(on){try{if(on){if(!WL&&N.wakeLock&&D.visibilityState==='visible')WL=await N.wakeLock.request('screen')}else if(WL){const l=WL;WL=null;await l.release()}}catch(e){}}
function battery(){if(N.getBattery)N.getBattery().then(b=>{Z.charge=b.charging;paint()}).catch(()=>{})}

function closeEpoch(now){const c=M.cur,v=c.n>1?c.m2/(c.n-1):0,okd=c.n>=MINSAMP;
  M.ep.push(okd?tier(v):'g');M.vs.push(okd?v:1);M.cur=fresh(M.t0+M.ep.length*EPMS);
  if(isO(live())){const l=live();l.e=M.ep.join('');l.v=M.vs.map(x=>+x.toExponential(2));l.sp=M.sp;save()}}
function tick(now){now=now||Date.now();if(!M||M.state==='RESOLVED')return;
  while(now>=M.t0+(M.ep.length+1)*EPMS&&M.ep.length<CAPH*12+12)closeEpoch(now);
  const l=level();if(l!=null){if(amb==null)amb=l;if(l>amb+SPIKE&&now-(M.lastSp||0)>10e3){M.sp++;M.lastSp=now}amb+=(l-amb)*(l>amb?.002:.02)}
  if(M.min&&now-M.min.t0>=6e4){M.drift=M.min.n>20&&M.min.m2/(M.min.n-1)>=T_S;M.min=fresh(now)}
  if(M.target&&!M.rang){const left=M.target-now;if(left<=0||(M.win&&left<=M.win*6e4&&M.drift)){M.rang=1;if(typeof HWAlarm!=='undefined')HWAlarm.ringNow()}}
  paint()}

/* ---------- start, resume, finish ---------- */
function begin(opt){const now=Date.now();let target=null;
  if(opt.wake){const [h,m]=opt.wake.split(':').map(Number),d=new Date(now);d.setHours(h,m,0,0);if(d.getTime()<=now+MINMIN*6e4/3)d.setDate(d.getDate()+1);target=d.getTime()}
  M={state:'IN_TRANCE',start:now,t0:now,target,win:target?+opt.win||0:0,ep:[],vs:[],sp:0,cur:fresh(now),min:fresh(now),drift:false,rang:0};amb=null;
  setLive({s:now,w:target,win:M.win,e:'',v:[],sp:0});Z.state='IN_TRANCE';listen();lock(true);clearInterval(TK);TK=setInterval(()=>tick(),1000);paint()}
function resume(){const l=live();if(!l||!(+l.s>0))return false;const now=Date.now();
  M={state:'IN_TRANCE',start:+l.s,t0:+l.s,target:+l.w||null,win:+l.win||0,ep:okE(l.e)?l.e.split(''):[],vs:Array.isArray(l.v)?l.v.map(Number):[],sp:+l.sp||0,cur:null,min:fresh(now),drift:false,rang:0};
  while(M.vs.length<M.ep.length)M.vs.push(1);M.cur=fresh(M.t0+M.ep.length*EPMS);
  while(now>=M.t0+(M.ep.length+1)*EPMS&&M.ep.length<CAPH*12+12){M.ep.push('g');M.vs.push(1);M.cur=fresh(M.t0+M.ep.length*EPMS)} // the gap while the page was closed
  amb=null;Z.state='IN_TRANCE';sense().then(()=>{listen();lock(true)});clearInterval(TK);TK=setInterval(()=>tick(),1000);paint();return true}
function finish(now){M.state='RESOLVED';Z.state='RESOLVED';clearInterval(TK);stopSense();lock(false);
  if(M.cur&&M.cur.n>=MINSAMP&&now-M.cur.t0>=EPMS/2){const v=M.cur.m2/(M.cur.n-1);M.ep.push(tier(v));M.vs.push(v)} // the last, part-filled epoch counts when half done
  const lim=limits(now);M.res=resolve(M.ep,M.vs,{capH:lim.left,goalH:goalH(),hist:hist()});M.end=now;M.saved=false;
  const r=M.res;if(!r.valid){M.ask=0;view='bad';setLive(null);paint();return}
  const rest=S.slrest||3,bed=hhmm(M.start),wake=hhmm(now),sc=slpScore(r.h,r.aw,r.lat||0,rest);
  add('sleep',r.h,{bed,wake,aw:r.aw,lat:r.lat||0,rest,score:sc,tr:{v:1,e:r.e.join(''),o:r.o,sp:M.sp,s:M.start,n:now}},'Sleep Now',today(),nowT(),15,'Sleep logged');
  M.saved=true;M.score=sc;setLive(null);view='res';RES.page=0;paint()}
/** The seal is pressed: under 90 min asleep asks first (Interrupted Rite). */
function seal(){if(!M)return;const e=M.ep.concat(M.cur&&M.cur.n>=MINSAMP?[tier(M.cur.m2/Math.max(1,M.cur.n-1))]:[]),r=resolve(e,null,{});
  if(!r.valid&&!M.warned){M.warned=1;view='ask';paint();return}finish(Date.now())}

/* ---------- screens ---------- */
const rm=()=>HWUI.reduced()||D.documentElement.classList.contains('hw-rm')||D.documentElement.classList.contains('hw-still');
function layer(){let el=D.getElementById('v6trt');if(!el){el=D.createElement('div');el.id='v6trt';D.body.appendChild(el)}return el}
function hide(){const el=D.getElementById('v6trt');if(el){el.hidden=true;el.innerHTML='';el.dataset.mode='';el.className='v6tro'}}
const b=(a,t,c,x)=>'<button type="button" class="'+(c||'')+'" data-a="'+a+'"'+(x||'')+'>'+t+'</button>';
const rnd=n=>{const s=Math.sin(n*91.7+13.3)*43758.5453;return s-Math.floor(s)};
/** Drifting bubble rings and twinkles behind a screen (pure CSS, decoration only). */
function fx(nb,ns){let h='<div class="v6tfx" aria-hidden="true">';
  for(let i=0;i<nb;i++)h+='<i class="v6tbub" style="--x:'+(rnd(i)*100).toFixed(1)+'%;--s:'+(14+rnd(i+9)*46).toFixed(0)+'px;--d:-'+(rnd(i+3)*12).toFixed(1)+'s;--t:'+(10+rnd(i+5)*10).toFixed(1)+'s"></i>';
  for(let i=0;i<ns;i++)h+='<b class="v6tspk" style="--x:'+(rnd(i+20)*96).toFixed(1)+'%;--y:'+(rnd(i+31)*92).toFixed(1)+'%;--d:-'+(rnd(i+7)*4).toFixed(1)+'s"></b>';
  return h+'</div>'}
function skin(el,mode,cls){el.className='v6tro '+cls;el.dataset.mode=mode;el.hidden=false}
/** Number that rolls up to its final value (shown at once with reduced motion). */
function countTo(el,to,ms,fmt){if(!el)return;fmt=fmt||(v=>Math.round(v));if(rm()){el.textContent=fmt(to);return}
  const t0=performance.now(),step=t=>{if(!el.isConnected)return;const k=Math.min(1,(t-t0)/ms),e=1-Math.pow(1-k,3);el.textContent=fmt(to*e);if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}

/* The Anchoring Rite: one step per page (accent bar, picture panel, numbered circle, bold headline, grey help text, green NEXT),
   floating over a drifting night sky. The pictures are CSS shapes plus the app's own pixel icons and art (assets/img/hall-sleep.webp). */
let RITE={page:0,wake:'',win:15,dir:''};
const PHONE=(c)=>'<span class="v6tph'+(c?' '+c:'')+'"></span>';
const ART=[
  '<div class="v6tart"><span class="v6tbat">'+ico('energy',2,'Charging')+'</span>'+PHONE('land')+'<i class="v6tcord"><u></u></i></div>',
  '<div class="v6tart"><div class="v6tbed"><b class="v6tpil"></b>'+PHONE('flat slide')+'<em>15 to 30 cm</em></div></div>',
  '<div class="v6tart"><span class="v6tflip">'+PHONE('dark')+'</span><span class="v6tmoon">'+ico('sleep',3,'Moon')+'</span></div>',
  '<div class="v6tart v6tknt"><img src="assets/img/hall-sleep.webp" alt="The hero watches the night from the castle wall"><i class="v6tspk" style="--x:12%;--y:14%"></i><i class="v6tspk" style="--x:78%;--y:10%;--d:-1s"></i><i class="v6tspk" style="--x:60%;--y:30%;--d:-2s"></i></div>'];
function rite(){const el=layer(),pg=RITE.page,sug=typeof HWAlarm!=='undefined'?HWAlarm.suggest(hhmm(Date.now()))||'07:00':'07:00';if(!RITE.wake)RITE.wake=sug;
  const H=[
    ['Tether to the ley-line','Plug the phone in before you sleep: tracking all night uses a lot of battery, and it could switch off mid-night.',
      Z.charge===true?'Charging detected.':Z.charge===false?'Not charging right now: plug it in.':'This browser cannot tell if it is charging, so check it yourself.'],
    ['Set the altar on the mattress','Lay it flat on the mattress within arm\'s reach, about 15 to 30 cm from the pillow. Not on a hard nightstand (no movement to read), and never under the pillow or blanket: it can overheat and muffle the microphone.',
      Z.motion?(Z.flat?'Motion sensor on. Lying flat: yes.':'Motion sensor on. Not lying flat yet: lay it flat.'):'Tap below so the phone can feel the bed move. Nothing is recorded.'],
    ['Lower the Arcane Veil','Put the phone screen-down. The screen goes black so a sheet or a rolled-over hand cannot tap it. The page must stay open on screen.',
      Z.down?'Face-down detected.':'Face-down not detected yet (some phones cannot tell). You can still continue.'],
    ['Set the Chime of Gentle Awakening','Pick your wake time. The chime rings during restless movement inside the window, or at the wake time. It uses the in-app alarm, which only sounds while HealthWiz stays open on screen.','']][pg];
  const last=pg===3,needMotion=pg===1&&!Z.motion;
  skin(el,'rite','v6tnight');el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','v6trh');
  el.innerHTML=fx(9,7)+'<div class="v6trcard v6tpop"><div class="v6trbar"><i></i><b id="v6trh">The Anchoring Rite</b><span class="v6trdots" aria-label="Step '+(pg+1)+' of 4">'+[0,1,2,3].map(i=>'<u class="'+(i===pg?'on':i<pg?'done':'')+'"></u>').join('')+'</span></div>'
    +'<div class="v6trpic">'+ART[pg]+'</div>'
    +'<div class="v6trbody'+(RITE.dir?' v6sl'+RITE.dir:'')+'"><span class="v6trnum" aria-hidden="true">'+(pg+1)+'</span><h3>'+H[0]+'</h3><p>'+H[1]+'</p>'
    +(H[2]?'<p class="v6trlive" role="status">'+H[2]+'</p>':'')
    +(pg===1&&!Z.motion?b('tcarm','WAKE THE RUNE STONE','v6trarm'):'')
    +(Z.perm&&pg===1?'<p class="v6trw" role="alert">'+esc(Z.perm)+'</p>':'')+(Z.micErr&&pg===1?'<p class="v6trw" role="status">'+esc(Z.micErr)+'</p>':'')
    +(last?'<div class="v6trwk"><label>Wake time<input id="v6trwk" type="time" data-in="trwk" value="'+esc(RITE.wake)+'"></label>'
      +'<label>Chime window<select id="v6trwn" data-ch="trwn">'+[[0,'Exact time only'],[15,'15 min'],[20,'20 min'],[30,'30 min']].map(x=>'<option value="'+x[0]+'"'+(+RITE.win===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></label></div>':'')
    +'</div><div class="v6trfoot">'+(last?b('tcgo','BEGIN MEDITATION','v6trnext',Z.motion?'':' disabled'):b('tcnext','NEXT','v6trnext',needMotion?' disabled':''))
    +'<div class="v6trlk">'+(pg?b('tcback','Back','v6trlink'):'')+b('trx','Cancel','v6trlink')+'</div></div></div>';RITE.dir=''}

/* The vigil: built once, then only its text changes (so the animations never restart). Dims to a dark, still clock after 45 s
   without a touch or when the phone is face-down, to save the battery and the sleeper's eyes. */
let LT=0;
function track(){const el=layer();
  if(el.dataset.mode!=='vigil'){skin(el,'vigil','v6tnight v6trk');el.removeAttribute('aria-modal');el.setAttribute('role','region');el.setAttribute('aria-label','Trance in progress');LT=Date.now();
    el.innerHTML=fx(12,9)+'<div class="v6vg"><div class="v6vtop"><span>Trance in progress</span></div><div class="v6vclk num" id="v6vclk" role="timer"></div>'
      +'<div class="v6vstage"><div class="v6vpin p1"><span>'+ico('alarm',1)+'</span><small id="v6vp1"></small></div><div class="v6vpin p2"><span>'+ico('sleep',1)+'</span><small id="v6vp2"></small></div><div class="v6vpin p3"><span>'+ico('bell',1)+'</span><small id="v6vp3"></small></div>'
      +'<div class="v6vdisc"><i class="v6vring"></i><img src="assets/img/sleeper-night.webp" alt="The hero, in star pyjamas, sleeps"></div><span class="v6vz z1">z</span><span class="v6vz z2">z</span><span class="v6vz z3">Z</span></div>'
      +'<div class="v6vlbl">Time in trance</div><div class="v6vcnt num" id="v6vcnt"></div><p class="v6vnote" id="v6vnote" role="status"></p>'
      +'<div class="v6trseal"><button type="button" class="v6trsb" data-a="trseal" aria-label="Hold this button for 3 seconds to wake up"><span class="v6trfill"></span><span class="v6vh">'+ico('sleep',2)+'</span><b>HOLD 3 SECONDS TO WAKE</b></button></div></div>'}
  vigil()}
function vigil(){const el=D.getElementById('v6trt');if(!el||el.dataset.mode!=='vigil'||!M)return;const now=Date.now(),e=now-M.start,hh=Math.floor(e/36e5),mm=Math.floor(e/6e4)%60;
  const set=(id,t)=>{const n=D.getElementById(id);if(n&&n.textContent!==t){n.textContent=t;return true}return false};
  set('v6vclk',hhmm(now));
  if(set('v6vcnt',hh+' h '+two(mm)+' min')&&!rm()){const c=D.getElementById('v6vcnt');c.classList.remove('roll');void c.offsetWidth;c.classList.add('roll')}
  set('v6vp1',M.target?'Wake '+hhmm(M.target):'No wake time');set('v6vp2','Echoes '+(M.sp||0));
  set('v6vp3',M.win&&M.target?(M.rang?'Chime rang':M.target-now<=M.win*6e4?'Chime window open':'Window '+hhmm(M.target-M.win*6e4)):M.target?'Exact time chime':'No chime');
  const ring=typeof HWAlarm!=='undefined'&&HWAlarm.ringing;
  set('v6vnote',!Z.motion?'No motion data is coming in: the night is not being tracked. Keep this page open on screen.':ring?'The chime is sounding. Use the alarm screen to stop it.':'');
  const dim=Z.down||now-LT>45e3;el.classList.toggle('v6dim',dim);el.classList.toggle('down',!!Z.down)}
function ask(){const el=layer();skin(el,'ask','v6tnight');el.setAttribute('role','alertdialog');el.setAttribute('aria-modal','true');
  el.innerHTML=fx(8,5)+'<div class="v6trcard v6trwarn v6tpop"><div class="v6trbar"><i></i><b>Interrupted Rite</b></div><div class="v6trpic v6trpicw"><div class="v6tart"><span class="v6tmoon v6wob" style="position:static">'+ico('warning',4,'Warning')+'</span></div></div>'
    +'<div class="v6trbody"><p>You have not yet slept for the minimum <b>90 minutes</b> needed for tracking. If you stop now, this Trance <b>will not be saved</b>. Are you sure you are done sleeping?</p></div>'
    +'<div class="v6trfoot v6trtwo">'+b('trno','NO','v6trghost')+b('tryes','YES','v6trnext')+'</div></div>'}
function bad(){const el=layer(),r=M.res;skin(el,'bad','v6tnight');el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  el.innerHTML=fx(8,5)+'<div class="v6trcard v6trwarn v6tpop"><div class="v6trbar"><i></i><b>Interrupted Rite</b></div><div class="v6trpic v6trpicw"><div class="v6tart"><span class="v6tmoon v6wob" style="position:static">'+ico('warning',4,'Warning')+'</span></div></div>'
    +'<div class="v6trbody"><p>'+(r.o==null?'The phone never settled into 15 minutes of stillness, so no sleep could be counted.':'Only '+r.mins+' min of sleep were counted, under the 90 minute minimum.')+' Nothing was saved and no points were given.</p>'
    +(Z.motion||M.ep.length?'':'<p class="v6trw">No motion data came from this phone. Check the browser\'s motion permission and try again.</p>')+'</div>'
    +'<div class="v6trfoot">'+b('trdone','OK','v6trnext')+'</div></div>'}

/* The Morning Readout: three cards on a sky-blue, rune-patterned backdrop (Sleep Duration, Depths of the Night, Your Trance). */
const crown=(k)=>k==='B'?'Balanced (Harmonious Resonance)':NAME[k];
const COLS={D:'#ffb020',S:'#2f8fff',A:'#8e5cff'};
let RES={page:0};
const hm2=m=>Math.floor(m/60)+' hrs '+(m%60)+' mins';
function result(){const el=layer(),r=M.res,pp=r.p,pg=RES.page,aff=r.aff,all=mine(),prev=all.slice(-2,-1)[0],cur=all.slice(-1)[0];
  const gr=grade(all.slice(-7).map(x=>tmin(x.m.bed)).filter(x=>x!=null)),dom=pp?['D','S','A'].reduce((a,c)=>pp[c]>pp[a]?c:a,'D'):null;
  skin(el,'res','v6tsky');el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','v6trh');
  const dt=new Date(M.end),days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],mons=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const head=days[dt.getDay()]+', '+mons[dt.getMonth()]+' '+dt.getDate()+', '+dt.getFullYear()+' | Trance '+all.length;
  const tag='<span class="v6trtag">GAME ESTIMATE FROM PHONE MOVEMENT, NOT A MEDICAL MEASUREMENT</span>';let body='',ttl='';
  if(pg===0){ttl='Sleep Duration';const off=(327*(1-r.mana/100)).toFixed(1),diff=prev?Math.round((r.h-(+prev.v||0))*60):null;
    let cf='';if(!rm())for(let i=0;i<14;i++){const a=i/14*Math.PI*2;cf+='<b class="v6tcf" style="--dx:'+(Math.cos(a)*(90+rnd(i)*40)).toFixed(0)+'px;--dy:'+(Math.sin(a)*(90+rnd(i+5)*40)).toFixed(0)+'px;--c:'+['#ffd45e','#6ec8ff','#ff9ad5','#9dff9d'][i%4]+'"></b>'}
    body='<div class="v6rring" style="--off:'+off+'"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="52"/><circle class="fg" cx="60" cy="60" r="52"/></svg><span class="num" id="v6rmana">'+r.mana+'</span><i class="v6rbu b1"></i><i class="v6rbu b2"></i><i class="v6rbu b3"></i>'+cf+'</div>'
      +'<div class="v6rcap">Restored Mana</div><div class="v6rbig num" id="v6rdur">'+hm2(r.mins)+'</div><div class="v6rsub">'+hhmm(M.start)+' - '+hhmm(M.end)+'</div>'
      +'<div class="v6rrib"><span class="v6rar">'+(diff==null||diff>=0?'&#9650;':'&#9660;')+'</span><span>'+(diff==null?'Your first Sleep Now night. Welcome to the Trance!':diff===0?'Same as your last Sleep Now.':'Compared to your last Sleep Now, you slept '+Math.abs(diff)+' mins '+(diff>0?'more':'less')+'!')+'</span></div>'+tag}
  else if(pg===1){ttl='Depths of the Night';
    body='<canvas id="v6trhg" width="600" height="220" role="img" aria-label="Runegraph of the night: '+['D','S','A'].map(k=>NAME[k]+' '+Math.round(pp[k])+'%').join(', ')+'"></canvas>'
      +'<div class="v6rbars">'+['D','S','A'].map((k,i)=>'<div class="v6rbar"><span><i style="background:'+COLS[k]+'"></i>'+NAME[k]+'</span><em>'+Math.round(pp[k]*(pp.n*EP)/100)+' min · '+Math.round(pp[k])+'%</em><u><s style="--w:'+Math.round(pp[k])+'%;--c:'+COLS[k]+';animation-delay:'+(.15*i)+'s"></s></u></div>').join('')+'</div>'
      +'<small class="mut">Where the night went, after the veil was crossed.</small>'+(r.sev?'<p class="v6trw" role="status">Severed Conduit: the phone barely moved for 6 hours in a row, so counting stopped there (it was probably left on a table).</p>':'')+tag}
  else{ttl='Your Trance';
    body='<div class="v6rtype"><small>Dominant state</small><b>'+(aff?crown(aff.type):dom?NAME[dom]+'*':'–')+'</b></div>'
      +'<div class="v6rgr"><div><small>Time to cross the veil</small><b class="num">'+r.lat+' min</b></div><div><small>Ritual consistency</small><b class="num">'+(gr?gr.g:'–')+'</b></div><div><small>Echoes from the Veil</small><b class="num">'+(M.sp||0)+(Z.mic?'':' (mic off)')+'</b></div><div><small>Logged as</small><b class="num">'+r.h+' h</b></div></div>'
      +'<small class="mut">'+(aff?'Type: the stage furthest above your own average of '+aff.n+' earlier nights (within ±3 points = Balanced).':'* Most time this night. Your own type needs 3 earlier Sleep Now nights to compare with.')
      +' Consistency: '+(gr?'your bedtime varied about '+Math.round(gr.sd)+' min over the last nights (A ≤ 30, B ≤ 60).':'needs 3 logged bedtimes.')+'</small>'
      +(M.saved?'<p class="v6rsv">Saved to your Sleep log (Dream Score '+M.score+'/100, the same score as a hand-logged night). Morning restfulness used: '+(S.slrest||3)+'/5; change it above for the next night.</p>':'')+tag}
  el.innerHTML=fx(10,10)+'<div class="v6mr"><div class="v6rhd" id="v6trh">'+head+'</div><div class="v6rcard v6tpop"><i class="v6rtab"></i><h3 class="v6rttl">'+ttl+'</h3><div class="v6rbody v6slR">'+body+'</div></div>'
    +'<div class="v6rft"><span class="v6trdots v6rdots" aria-label="Card '+(pg+1)+' of 3">'+[0,1,2].map(i=>'<u class="'+(i===pg?'on':i<pg?'done':'')+'"></u>').join('')+'</span>'
    +(pg<2?b('trnext','Next','v6rnext'):b('trdone','Done','v6rnext'))+(pg===2?b('trvault','Consult the Evidence Vault','v6rlink'):'')+'</div></div>';
  if(pg===0){countTo(D.getElementById('v6rmana'),r.mana,1400);countTo(D.getElementById('v6rdur'),r.mins,1400,v=>hm2(Math.round(v)))}
  if(pg===1)draw()}

/* ---------- the Celestial Arcane Runegraph (hypnogram), drawn left to right ---------- */
function draw(){const c=D.getElementById('v6trhg');if(!c||!M||!M.res)return;
  if(rm()){plot(c,1);return}const t0=performance.now(),f=t=>{if(!c.isConnected)return;const k=Math.min(1,(t-t0)/1500);plot(c,1-Math.pow(1-k,3));if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)}
function plot(c,prog){const r=M.res,e=r.e,x=c.getContext('2d'),W=c.width,H=c.height,L=64,T=14,B=44,pw=W-L-4,ph=H-T-B;
  const ROW={X:0,D:1,S:2,A:3,g:0},LAB=['Awake','Drift','Stillness','Abyssal'],COL=['#8a8fa8','#ffd45e','#6ec8ff','#b58cff'];
  x.clearRect(0,0,W,H);x.fillStyle='#0a0f33';x.fillRect(0,0,W,H);x.font='12px system-ui,sans-serif';x.textBaseline='middle';
  for(let i=0;i<4;i++){const y=T+ph*(i+.5)/4;x.strokeStyle='#2a3270';x.lineWidth=1;x.beginPath();x.moveTo(L,y);x.lineTo(W-4,y);x.stroke();x.fillStyle=COL[i];x.fillText(LAB[i],4,y)}
  const n=Math.max(1,e.length),w=pw/n,lim=Math.ceil(e.length*prog);let prev=null;x.lineWidth=3;x.lineJoin='miter';
  for(let i=0;i<lim;i++){const k=i<(r.o==null?e.length:r.o)?'X':e[i],row=ROW[k],y=T+ph*(row+.5)/4,x0=L+i*w,x1=x0+w;
    x.strokeStyle=COL[row];x.shadowColor=COL[row];x.shadowBlur=8;x.beginPath();x.moveTo(x0,prev!=null?prev:y);x.lineTo(x0,y);x.lineTo(x1,y);x.stroke();prev=y}
  x.shadowBlur=0;x.fillStyle='#9aa6e0';x.textBaseline='top';const hrs=n*EP/60,st0=M.start;
  for(let h=0;h<=hrs;h+=Math.max(1,Math.ceil(hrs/6))){const px=L+h*60/EP*w;x.fillText(hhmm(st0+h*36e5),Math.min(px,W-34),T+ph+6)}
  x.fillStyle='#7f8bd0';x.fillText('Echoes from the Veil: '+(M.sp||0)+' loud sound'+(M.sp===1?'':'s')+(Z.mic?'':' (mic was off)'),L,T+ph+24)}

function paint(){if(!M||M.state==='RESOLVED'&&!view)return;
  if(hold&&!view){const f=D.querySelector('#v6trt .v6trfill');if(f){f.style.width=Math.round(Math.min(1,(Date.now()-hold)/SEAL)*100)+'%';return}}
  if(view==='ask'){if(layer().dataset.mode!=='ask')ask();return}
  if(view==='bad'){if(layer().dataset.mode!=='bad')bad();return}
  if(view==='res'&&M.res){if(layer().dataset.mode!=='res')result();return}
  if(M.state==='IN_TRANCE'||M.state==='SEAL_BREAKING')track()}
function close(){hide();view='';M=null;Z.state='IDLE';stopSense();lock(false);clearInterval(TK);clearInterval(HT);hold=0;render()}

/* ---------- the Sleep page card ---------- */
function card(){const l=live(),now=Date.now(),lim=limits(now),last=mine().slice(-1)[0];
  return '<h3>'+ico('sleep',1,'Moon')+' SLEEP NOW '+HWHelp.btn('trancewhy','About Sleep Now','<p>Put the phone on the mattress, tap SLEEP NOW, and it reads how much it moves (and how loud the room gets) while you sleep. In the morning the night becomes a game readout and a normal Sleep log entry.</p><p><b>It is an estimate.</b> The three depths come from phone movement only, with thresholds HealthWiz chose itself; a phone cannot see brain waves, so these are not sleep stages and not a medical measurement. The microphone level is read but no sound is recorded.</p><p>A night under 90 minutes of sleep is not saved. At most 2 nights and 13 hours are counted per 24 hours.</p>'+HWSources.cite('xie2013')+HWSources.cite('fernandez2020'),{ev:'sleep'})+'</h3>'
    +'<p>The Trance of Restoration: the phone watches over the night and logs it for you. Game estimate, not a medical measurement.</p>'
    +(l?'<p class="v6trw" role="status">A Trance started at '+hhmm(+l.s)+' was still open.</p><div class="row">'+b('trresume','RESUME TRANCE','')+b('trdrop','DISCARD','g')+'</div>'
      :lim.blocked?'<p class="mut">'+esc(lim.blocked)+'</p>':'<button type="button" data-a="trnow" class="v6trnow">'+ico('sleep')+' SLEEP NOW</button>')
    +(last?'<small class="mut">Last Sleep Now: '+esc(last.d)+', '+last.v+' h.</small>':'')}
{const p=pages.sleep;pages.sleep=(...a)=>{const h=p(...a),k='+ LOG SLEEP</button></div>',c='<div class="card" id="v6trc">'+card()+'</div>';const i=h.indexOf(k);return i<0?h+c:h.slice(0,i+k.length)+c+h.slice(i+k.length)}}

acts.trnow=()=>{const lim=limits(Date.now());if(lim.blocked){toast(esc(lim.blocked));return}RITE={page:0,wake:'',win:15};Z.perm='';Z.micErr='';rite();battery();
  if(Z.motion)return;/* the sensor is armed by the button below: browsers need a tap for permission */}
acts.tcarm=async()=>{const ok=await sense();if(ok){const w=Date.now();await new Promise(r=>setTimeout(r,1500));if(!Z.motion)Z.perm='No motion data arrived. This phone or browser may not share its motion sensor with web pages.'}rite();listen().then(()=>rite())}; // the microphone prompt must not hold the screen back
acts.tcnext=()=>{if(RITE.page===1&&!Z.motion)return;RITE.page=Math.min(3,RITE.page+1);RITE.dir='R';rite()};
acts.trnext=()=>{RES.page=Math.min(2,RES.page+1);result()};
acts.tcback=()=>{RITE.page=Math.max(0,RITE.page-1);RITE.dir='L';rite()};
INP.trwk=el=>{RITE.wake=/^\d\d:\d\d$/.test(el.value)?el.value:''};
CH.trwn=v=>{RITE.win=+v};
acts.trx=()=>{hide();stopSense();Z.motion=0};
acts.tcgo=()=>{if(!Z.motion)return;begin({wake:RITE.wake,win:RITE.win})};
acts.trresume=async()=>{await sense();if(!resume()){setLive(null);render()}};
acts.trdrop=()=>{setLive(null);render()};
acts.trno=()=>{view='';M.warned=0;M.state='IN_TRANCE';hold=0;paint()};
acts.tryes=()=>{view='';finish(Date.now())};
acts.trdone=()=>close();
acts.trvault=()=>{hide();view='';M=null;Z.state='IDLE';if(typeof HWVault!=='undefined')HWVault.openCalc('trance','sleep');else render()};
// the seal: pointer or key held for 3 seconds (a tap does nothing)
function press(){if(!M||M.state==='RESOLVED')return;M.state='SEAL_BREAKING';hold=Date.now();LT=Date.now();{const e=D.getElementById('v6trt');if(e)e.classList.add('holding')}clearInterval(HT);HT=setInterval(()=>{if(!hold)return;if(Date.now()-hold>=SEAL){hold=0;clearInterval(HT);seal()}else paint()},100);paint()}
function release(){{const e=D.getElementById('v6trt');if(e)e.classList.remove('holding')}if(M&&M.state==='SEAL_BREAKING'){M.state='IN_TRANCE';}hold=0;clearInterval(HT);if(M&&view==='')paint()}
D.addEventListener('pointerdown',e=>{if(!e.target.closest)return;if(e.target.closest('#v6trt')){LT=Date.now();const l=D.getElementById('v6trt');if(l&&l.dataset.mode==='vigil'&&!Z.down)l.classList.remove('v6dim')}if(e.target.closest('.v6trsb'))press()},true);
['pointerup','pointercancel'].forEach(t=>D.addEventListener(t,()=>{if(hold)release()},true));
D.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&e.target.classList&&e.target.classList.contains('v6trsb')&&!e.repeat)press()},true);
D.addEventListener('keyup',e=>{if((e.key===' '||e.key==='Enter')&&hold)release()},true);
D.addEventListener('visibilitychange',()=>{if(D.visibilityState==='visible'&&M&&M.state!=='RESOLVED'){lock(true);tick()}});
HWEvents.on('data:reset',()=>{clearInterval(TK);clearInterval(HT);stopSense();M=null;view='';hide();});

HWUI.css('trance',`
#v6trc h3{display:flex;align-items:center;gap:8px}
.v6trnow{width:100%;min-height:56px;display:flex;align-items:center;justify-content:center;gap:8px;position:relative;overflow:hidden}
.v6trnow:after{content:"";position:absolute;top:0;bottom:0;width:40px;left:-60px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);animation:v6shine 3.6s ease-in-out infinite}
.v6trw{padding:8px;border:2px dashed var(--ln);background:var(--p2);font-size:13px}
/* ---- the sky behind every Sleep Now screen ---- */
.v6tro{position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;padding:12px;overflow:auto;color:#fff}
.v6tro[hidden]{display:none}
.v6tnight{background:linear-gradient(180deg,#071a5a 0%,#1238a8 55%,#2562d4 100%)}
.v6tsky{background:linear-gradient(180deg,#5db4ff,#3f8cf0);background-image:radial-gradient(rgba(255,255,255,.16) 11px,transparent 12px),radial-gradient(rgba(255,255,255,.1) 5px,transparent 6px),linear-gradient(180deg,#5db4ff,#3f8cf0);background-size:84px 84px,84px 84px,100% 100%;background-position:0 0,42px 42px,0 0}
.v6tfx{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.v6tbub{position:absolute;left:var(--x);bottom:-80px;width:var(--s);height:var(--s);border:2px solid rgba(255,255,255,.28);border-radius:50%;animation:v6float var(--t) linear var(--d) infinite}
.v6tspk{position:absolute;left:var(--x);top:var(--y);width:12px;height:12px;background:#fff;clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);animation:v6ttw 2.6s ease-in-out var(--d,0s) infinite}
.v6tsky .v6tbub{border-color:rgba(255,255,255,.4)}
/* ---- the white card (rite, warnings) ---- */
.v6trcard{position:relative;width:min(100%,380px);max-height:100%;overflow:auto;background:#fff;color:#3c4150;border-radius:18px;box-shadow:0 8px 0 rgba(0,0,0,.28),0 20px 50px rgba(0,10,60,.5);font-family:var(--fn)}
.v6tpop{animation:v6tpop .55s cubic-bezier(.2,1.4,.4,1) both}
.v6trbar{display:flex;align-items:center;gap:10px;padding:14px 16px;font-size:16px;font-weight:700;color:#3c4150}.v6trbar i{width:6px;height:22px;background:#2f8fff;border-radius:2px;animation:v6glow 2.4s ease-in-out infinite}.v6trbar b{flex:1}
.v6trdots{display:flex;gap:6px}.v6trdots u{width:9px;height:9px;border-radius:50%;background:#d5d9e2;transition:all .3s}.v6trdots u.on{background:#2f8fff;transform:scale(1.35);box-shadow:0 0 0 3px rgba(47,143,255,.25)}.v6trdots u.done{background:#3fd06a}
.v6trpic{background:#d8f6fb;background-image:radial-gradient(#bdeaf3 2px,transparent 2px);background-size:22px 22px;min-height:170px;display:flex;align-items:center;justify-content:center;padding:14px;overflow:hidden;animation:v6drift 8s linear infinite}
.v6tart{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;width:100%}
.v6tph{display:inline-block;border:4px solid #2b3a55;background:#2f8fff;border-radius:10px;box-shadow:4px 4px 0 rgba(43,58,85,.25)}
.v6tph.land{width:104px;height:56px;animation:v6bob 2.6s ease-in-out infinite}.v6tph.flat{width:96px;height:48px}.v6tph.dark{width:60px;height:104px;background:#0b0f1a}
.v6tph.slide{animation:v6slidein 1.1s cubic-bezier(.2,.9,.3,1) both}
.v6tbat{position:absolute;top:-6px;left:8%;background:#3f9f4a;border:3px solid #2b3a55;border-radius:6px;padding:2px 6px;display:flex;animation:v6pulse 1.3s ease-in-out infinite}
.v6tcord{position:relative;overflow:hidden;width:46px;height:5px;background:#2b3a55;border-radius:3px}.v6tcord u{position:absolute;top:0;bottom:0;width:14px;background:#ffe45e;box-shadow:0 0 8px #ffe45e;animation:v6zap 1.1s linear infinite}
.v6tbed{position:relative;width:100%;max-width:300px;height:96px;background:#f4e6c8;border:4px solid #2b3a55;border-radius:10px;display:flex;align-items:center;gap:14px;padding:0 14px}
.v6tpil{width:62px;height:62px;background:#fff;border:4px solid #2b3a55;border-radius:12px}
.v6tbed em{position:absolute;left:84px;bottom:6px;font:700 12px/1 var(--fn);font-style:normal;color:#2b3a55;animation:v6pulse 1.8s ease-in-out infinite}
.v6tflip{display:inline-flex;animation:v6flip 1.3s .3s cubic-bezier(.3,1.3,.5,1) both}
.v6tmoon{position:absolute;right:14%;top:2px;background:#fff;border:3px solid #2b3a55;border-radius:50%;padding:6px;display:flex;animation:v6bob 3s ease-in-out infinite}
.v6tart>.v6tmoon:only-child{position:static}.v6wob{animation:v6wob 1.6s ease-in-out infinite}
.v6tknt{margin:-14px;width:calc(100% + 28px)}.v6tknt img{display:block;width:100%;height:auto;image-rendering:pixelated;animation:v6kb 14s ease-in-out infinite alternate;transform-origin:30% 40%}
.v6tknt .v6tspk{background:#fff7b0;width:14px;height:14px}
.v6trbody{padding:16px 20px 6px;text-align:center}.v6trbody h3{margin:8px 0;font-size:18px;color:#3c4150;border:0;padding:0;background:none}
.v6trbody p{margin:6px 0;font-size:14px;line-height:1.45;color:#8a8f9c}.v6trbody .v6trlive{color:#2f6fbf;font-weight:600}
.v6slR{animation:v6slR .4s cubic-bezier(.2,.9,.3,1) both}.v6slL{animation:v6slL .4s cubic-bezier(.2,.9,.3,1) both}
.v6trnum{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#4a9eff;color:#fff;font:700 18px/1 var(--fn);animation:v6tpop .5s .1s cubic-bezier(.2,1.6,.4,1) both}
.v6trarm{margin:8px auto;min-height:48px;padding:0 18px;border-radius:24px;background:#2f8fff;color:#fff;border:0;border-bottom:4px solid #1e63b8;font-weight:700;animation:v6glowb 1.8s ease-in-out infinite}
.v6trwk{display:flex;gap:10px;margin-top:10px}.v6trwk label{flex:1;font-size:12px;color:#8a8f9c;text-align:left}.v6trwk input,.v6trwk select{width:100%;min-height:44px;margin-top:4px;color:#3c4150;background:#f2f4f8;border:2px solid #d5d9e2;border-radius:8px}
.v6trfoot{padding:10px 20px 16px;text-align:center}
.v6trnext{position:relative;overflow:hidden;width:100%;min-height:52px;border-radius:28px;background:#3fd06a;color:#fff;border:0;border-bottom:5px solid #1f9a47;font-size:17px;font-weight:700;text-shadow:0 1px 0 rgba(0,0,0,.2);transition:transform .08s,border-width .08s}
.v6trnext:not(:disabled){animation:v6glowg 2.2s ease-in-out infinite}
.v6trnext:not(:disabled):after{content:"";position:absolute;top:0;bottom:0;width:36px;left:-60px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-20deg);animation:v6shine 2.8s ease-in-out infinite}
.v6trnext:active{transform:translateY(3px);border-bottom-width:2px}
.v6trnext:disabled{background:#c7ccd6;border-bottom-color:#a3a9b6;color:#fff;opacity:1}
.v6trlk{display:flex;justify-content:center;gap:18px;margin-top:6px}.v6trlink{min-height:44px;background:none;border:0;color:#6b7280;text-decoration:underline;font-size:14px}
.v6trbody .v6trw{background:#fff4e5;color:#8a5a00;border-color:#f0c070;text-align:left}
.v6trpicw{background:#ffe9e6;background-image:radial-gradient(#ffd3cc 2px,transparent 2px);min-height:120px}
.v6trtwo{display:flex;gap:12px}.v6trtwo button{flex:1}.v6trghost{min-height:52px;border-radius:28px;background:#fff;color:#6b7280;border:2px solid #d5d9e2;border-bottom-width:5px;font-size:17px;font-weight:700}
/* ---- the vigil ---- */
.v6trk{z-index:8900;padding:0}
.v6vg{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly;gap:6px;width:100%;max-width:420px;min-height:100%;padding:14px 18px 20px;text-align:center}
.v6vtop{font:700 13px/1 var(--fn);letter-spacing:.18em;text-transform:uppercase;color:#cfe0ff}.v6vtop span:before,.v6vtop span:after{content:" \\2022 \\2022 \\2022 ";color:#7fa8ff;animation:v6dots 1.6s steps(3) infinite;letter-spacing:.3em}
.v6vclk{font-size:64px;font-weight:800;line-height:1;color:#fff;text-shadow:0 0 24px rgba(140,190,255,.6)}
.v6vstage{position:relative;width:100%;height:min(66vw,290px);display:flex;align-items:center;justify-content:center}
.v6vdisc{position:relative;width:min(56vw,230px);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 35%,#a9f0f5,#4fc3de 60%,#2a8fc0);border:6px solid rgba(255,255,255,.4);box-shadow:0 0 0 10px rgba(255,255,255,.08),0 0 70px rgba(120,200,255,.6);overflow:hidden;animation:v6breathe 4.6s ease-in-out infinite}
.v6vdisc img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 40%}
.v6vdisc:after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 30px rgba(0,20,80,.55)}
.v6vring{position:absolute;inset:-6px;border:3px dashed rgba(255,255,255,.55);border-radius:50%;animation:v6spin 40s linear infinite;z-index:2}
.v6vpin{position:absolute;display:flex;flex-direction:column;align-items:center;gap:6px;animation:v6bob 3.4s ease-in-out infinite}
.v6vpin span{display:flex;align-items:center;justify-content:center;width:38px;height:38px;background:#2f8fff;border:3px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,40,.4)}.v6vpin span svg{transform:rotate(45deg)}
.v6vpin small{background:rgba(5,20,80,.65);color:#fff;border-radius:10px;padding:2px 8px;font:700 11px/1.5 var(--fn);white-space:nowrap}
.v6vpin.p1{left:0;top:8%}.v6vpin.p2{right:0;top:22%;animation-delay:-1.2s}.v6vpin.p3{left:2%;bottom:0;animation-delay:-2.1s}.v6vpin.p3 span{background:#3fd06a}.v6vpin.p2 span{background:#ff7ab0}
.v6vz{position:absolute;right:20%;top:6%;font:800 22px/1 var(--fn);color:#fff;opacity:0;animation:v6z 4.2s ease-out infinite}.v6vz.z2{animation-delay:1.4s;font-size:30px}.v6vz.z3{animation-delay:2.8s;font-size:38px}
.v6vlbl{font:700 13px/1 var(--fn);letter-spacing:.12em;text-transform:uppercase;color:#cfe0ff}
.v6vcnt{font-size:40px;font-weight:800;color:#fff;text-shadow:0 0 22px rgba(255,230,120,.5)}.v6vcnt.roll{animation:v6roll .5s cubic-bezier(.2,1.4,.4,1)}
.v6vnote{min-height:18px;margin:0;font-size:13px;color:#ffd9a0}
.v6trseal{width:100%}
.v6trsb{position:relative;overflow:hidden;width:100%;min-height:68px;border-radius:40px;background:rgba(255,255,255,.14);color:#fff;border:2px solid rgba(255,255,255,.55);touch-action:none;user-select:none;display:flex;align-items:center;gap:10px;padding:0 8px;backdrop-filter:blur(2px)}
.v6trfill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,rgba(255,255,255,.2),rgba(255,235,140,.7));box-shadow:0 0 18px rgba(255,235,140,.8)}
.v6vh{position:relative;display:flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:50%;background:#fff;box-shadow:0 3px 0 rgba(0,0,0,.25)}.v6trsb b{position:relative;flex:1;font:700 15px/1.2 var(--fn);text-align:center;padding-right:44px}
.v6trk.holding .v6vdisc{box-shadow:0 0 0 14px rgba(255,235,140,.25),0 0 110px rgba(255,235,140,.9);transition:box-shadow .3s}
.v6trk.v6dim{background:#02030a}.v6trk.v6dim .v6tfx,.v6trk.v6dim .v6vz,.v6trk.v6dim .v6vpin{display:none}.v6trk.v6dim .v6vdisc{filter:brightness(.3) saturate(.5);box-shadow:none}.v6trk.v6dim .v6vdisc,.v6trk.v6dim .v6vring{animation-play-state:paused}
.v6trk.v6dim .v6vclk,.v6trk.v6dim .v6vcnt{color:#b0723a;text-shadow:none}.v6trk.v6dim .v6vtop,.v6trk.v6dim .v6vlbl{color:#6b4a2a}.v6trk.v6dim .v6trsb{background:rgba(255,255,255,.04);border-color:#3a2a20}
.v6trk.down .v6vg>*:not(.v6trseal){opacity:0}.v6trk.down .v6trseal{opacity:.25}
/* ---- the Morning Readout ---- */
.v6mr{position:relative;display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;max-width:400px;min-height:100%;justify-content:center;padding:6px 0}
.v6rhd{font:700 15px/1.3 var(--fn);color:#fff;text-align:center;border-bottom:2px solid rgba(255,255,255,.55);padding:0 8px 8px;width:100%}
.v6rcard{position:relative;width:100%;background:#fff;color:#2c3040;border-radius:28px;padding:34px 20px 20px;text-align:center;box-shadow:0 8px 0 rgba(0,40,120,.25),0 20px 40px rgba(0,30,110,.35)}
.v6rtab{position:absolute;left:50%;top:-14px;width:112px;height:22px;transform:translateX(-50%);background:#3f8cf0;border-radius:6px 6px 0 0;box-shadow:0 4px 0 #cfd6e6}
.v6rttl{margin:0 0 10px;font:700 22px/1.2 var(--fn);color:#3f8cf0;border:0;padding:0;background:none}
.v6rbody{display:flex;flex-direction:column;align-items:center;gap:8px}
.v6rring{position:relative;width:132px;height:132px;display:flex;align-items:center;justify-content:center;margin:6px 0}
.v6rring svg{position:absolute;inset:0;transform:rotate(-90deg)}.v6rring circle{fill:none;stroke-width:12}.v6rring .bg{stroke:#e6eefc}.v6rring .fg{stroke:#3f8cf0;stroke-linecap:round;stroke-dasharray:327;stroke-dashoffset:var(--off);animation:v6rf 1.4s cubic-bezier(.2,.8,.2,1) both;filter:drop-shadow(0 0 6px rgba(63,140,240,.6))}
.v6rring>span.num{position:relative;font-size:44px;font-weight:800;color:#2c3040}
.v6rbu{position:absolute;width:5px;height:16px;background:#ffd45e;border-radius:3px;animation:v6bpl 1.2s ease-in-out infinite}
.v6rbu.b1{left:2px;top:30px;transform:rotate(-62deg)}.v6rbu.b2{left:14px;top:8px;transform:rotate(-32deg);animation-delay:.2s}.v6rbu.b3{left:38px;top:-6px;transform:rotate(-6deg);animation-delay:.4s}
.v6tcf{position:absolute;left:50%;top:50%;width:9px;height:9px;background:var(--c);border-radius:2px;animation:v6cf 1.1s cubic-bezier(.1,.8,.3,1) both}
.v6rcap{font:700 13px/1 var(--fn);letter-spacing:.1em;text-transform:uppercase;color:#7b8aa8}
.v6rbig{font-size:34px;font-weight:800;color:#2c3040;line-height:1.1}.v6rsub{font:700 15px/1 var(--fn);color:#4a5068}
.v6rrib{display:flex;align-items:center;justify-content:center;gap:10px;width:calc(100% + 40px);margin:10px -20px 4px;padding:12px 18px;background:#4a9eff;color:#fff;font:700 14px/1.3 var(--fn)}.v6rar{font-size:22px;color:#ffe45e;animation:v6bob 1.6s ease-in-out infinite}
.v6trtag{display:inline-block;margin:6px 0 0;padding:3px 8px;border-radius:10px;background:#eef2ff;color:#3c4a8a;font:700 11px/1.4 var(--fn)}
.v6rcard canvas{width:100%;height:auto;display:block;border-radius:12px;border:3px solid #1c2a78}
.v6rbars{width:100%;display:flex;flex-direction:column;gap:8px;text-align:left}.v6rbar{display:grid;grid-template-columns:1fr auto;gap:2px 8px;font-size:14px;color:#3c4150}.v6rbar span{display:flex;align-items:center;gap:6px;font-weight:700}.v6rbar i{width:10px;height:10px;border-radius:50%}.v6rbar em{font-style:normal;color:#7b8aa8}
.v6rbar u{grid-column:1/3;height:12px;border-radius:6px;background:#eef2fa;overflow:hidden}.v6rbar s{display:block;height:100%;width:var(--w);background:var(--c);border-radius:6px;animation:v6grow 1s cubic-bezier(.2,.8,.2,1) both;box-shadow:0 0 8px var(--c)}
.v6rtype{width:100%;padding:16px;border-radius:18px;background:linear-gradient(135deg,#1b2f7a,#4a2fa8);color:#fff;box-shadow:0 0 0 3px #ffd45e,0 0 30px rgba(120,90,255,.5);animation:v6glow 2.6s ease-in-out infinite}
.v6rtype small{display:block;font:700 12px/1 var(--fn);letter-spacing:.1em;text-transform:uppercase;color:#bcd0ff}.v6rtype b{display:block;margin-top:6px;font:800 24px/1.15 var(--fn);color:#ffe45e}
.v6rgr{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left}.v6rgr div{background:#f2f6ff;border-radius:14px;padding:10px 12px;animation:v6tpop .5s cubic-bezier(.2,1.4,.4,1) both}.v6rgr div:nth-child(2){animation-delay:.08s}.v6rgr div:nth-child(3){animation-delay:.16s}.v6rgr div:nth-child(4){animation-delay:.24s}
.v6rgr small{display:block;font-size:12px;color:#7b8aa8}.v6rgr b{font-size:22px;font-weight:800;color:#2c3040}
.v6rcard .mut{color:#7b8aa8;font-size:12px;line-height:1.4}.v6rsv{margin:0;font-size:13px;color:#4a5068}
.v6rft{display:flex;flex-direction:column;align-items:flex-end;gap:10px;width:100%}.v6rdots{align-self:center}
.v6rnext{min-width:150px;min-height:52px;padding:0 26px;border-radius:26px;background:#4a9eff;color:#fff;border:0;border-bottom:5px solid #2a6dc4;font-size:17px;font-weight:700;animation:v6glowb 2.2s ease-in-out infinite}.v6rnext:active{transform:translateY(3px);border-bottom-width:2px}
.v6rlink{align-self:center;min-height:44px;background:none;border:0;color:#fff;text-decoration:underline;font-size:14px}
.v6mr .v6trdots u{background:rgba(255,255,255,.5)}.v6mr .v6trdots u.on{background:#fff}
.v6mr .v6trw{background:#fff4e5;color:#8a5a00;border-color:#f0c070;text-align:left}
@keyframes v6float{from{transform:translateY(0)}to{transform:translateY(-120vh)}}
@keyframes v6ttw{0%,100%{opacity:.15;transform:scale(.5)}50%{opacity:1;transform:scale(1.15) rotate(20deg)}}
@keyframes v6tpop{0%{opacity:0;transform:scale(.8) translateY(14px)}100%{opacity:1;transform:none}}
@keyframes v6glow{50%{filter:brightness(1.25)}}
@keyframes v6drift{to{background-position:44px 22px}}
@keyframes v6bob{50%{transform:translateY(-6px)}}
@keyframes v6slidein{from{transform:translateX(90px);opacity:0}to{transform:none;opacity:1}}
@keyframes v6pulse{50%{transform:scale(1.08);opacity:.85}}
@keyframes v6zap{from{left:-14px}to{left:46px}}
@keyframes v6flip{from{transform:rotateY(180deg) scale(.7);opacity:0}to{transform:none;opacity:1}}
@keyframes v6wob{50%{transform:rotate(8deg) scale(1.08)}25%{transform:rotate(-8deg)}}
@keyframes v6kb{from{transform:scale(1) translateX(0)}to{transform:scale(1.14) translateX(-4%)}}
@keyframes v6slR{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
@keyframes v6slL{from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:none}}
@keyframes v6glowg{50%{box-shadow:0 0 0 6px rgba(63,208,106,.25),0 0 22px rgba(63,208,106,.6)}}
@keyframes v6glowb{50%{box-shadow:0 0 0 6px rgba(255,255,255,.3),0 0 22px rgba(255,255,255,.7)}}
@keyframes v6shine{0%,55%{left:-60px}100%{left:130%}}
@keyframes v6dots{0%{opacity:.2}50%{opacity:1}100%{opacity:.2}}
@keyframes v6breathe{50%{transform:scale(1.035)}}
@keyframes v6spin{to{transform:rotate(360deg)}}
@keyframes v6z{0%{opacity:0;transform:translate(0,30px) scale(.6)}20%{opacity:.95}100%{opacity:0;transform:translate(40px,-110px) scale(1.2) rotate(14deg)}}
@keyframes v6roll{0%{transform:translateY(-14px);opacity:.2}100%{transform:none;opacity:1}}
@keyframes v6rf{from{stroke-dashoffset:327}}
@keyframes v6cf{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(.2) rotate(240deg);opacity:0}}
@keyframes v6bpl{50%{opacity:.25}}
@keyframes v6grow{from{width:0}}
@media(prefers-reduced-motion:reduce){.v6tro *,.v6trnow:after{animation:none!important;transition:none!important}}
html.hw-rm .v6tro *,html.hw-still .v6tro *,html.hw-rm .v6trnow:after,html.hw-still .v6trnow:after{animation:none!important;transition:none!important}
`);
HWEvents.on('app:ready',()=>{const l=live();if(l&&Date.now()-(+l.s||0)>CAPH*36e5+36e5)setLive(null)}); // a night left open for over 14 h is dropped
return{tier,onset,flat,pct,affinity,grade,resolve,limits,K:{EP,MINMIN,CAPH,MAXN,FLATEP,LATEP,T_A,T_S,T_FLAT,SEAL},
  _idle:()=>{LT=0;vigil()},_sample:sample,_begin:begin,_tick:tick,_state:()=>M,_S:Z}})();
