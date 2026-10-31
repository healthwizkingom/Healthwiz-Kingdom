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
  M.saved=true;M.score=sc;setLive(null);view='res';paint()}
/** The seal is pressed: under 90 min asleep asks first (Interrupted Rite). */
function seal(){if(!M)return;const e=M.ep.concat(M.cur&&M.cur.n>=MINSAMP?[tier(M.cur.m2/Math.max(1,M.cur.n-1))]:[]),r=resolve(e,null,{});
  if(!r.valid&&!M.warned){M.warned=1;view='ask';paint();return}finish(Date.now())}

/* ---------- screens ---------- */
function layer(){let el=D.getElementById('v6trt');if(!el){el=D.createElement('div');el.id='v6trt';D.body.appendChild(el)}return el}
const b=(a,t,c,x)=>'<button type="button" class="'+(c||'')+'" data-a="'+a+'"'+(x||'')+'>'+t+'</button>';
const tick1=(on,t)=>'<li class="'+(on?'ok':'')+'"><span aria-hidden="true">'+(on?'[x]':'[ ]')+'</span> '+t+'</li>';
let RITE={page:0,wake:'',win:15};
/* The Anchoring Rite: one step per page, in the layout of a game's "Tracking Your Sleep" tutorial (accent bar, pale picture panel,
   numbered circle, bold headline, grey help text, green NEXT). The pictures are plain CSS shapes (phone, bed, pillow) plus the
   app's own pixel icons; no new image files. */
const PHONE=(c)=>'<span class="v6tph'+(c?' '+c:'')+'"></span>';
const ART=[
  '<div class="v6tart"><span class="v6tbat">'+ico('energy',2,'Charging')+'</span>'+PHONE('land')+'<i class="v6tcord"></i></div>',
  '<div class="v6tart"><div class="v6tbed"><b class="v6tpil"></b>'+PHONE('flat')+'<em>15 to 30 cm</em></div></div>',
  '<div class="v6tart">'+PHONE('dark')+'<span class="v6tmoon">'+ico('sleep',3,'Moon')+'</span></div>',
  '<div class="v6tart"><span class="v6tmoon">'+ico('sleep',5,'Moon')+'</span></div>'];
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
  el.className='v6tro';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','v6trh');
  el.innerHTML='<div class="v6trcard"><div class="v6trbar"><i></i><b id="v6trh">The Anchoring Rite</b><span>'+(pg+1)+' / 4</span></div>'
    +'<div class="v6trpic">'+ART[pg]+'</div>'
    +'<div class="v6trbody"><span class="v6trnum" aria-hidden="true">'+(pg+1)+'</span><h3>'+H[0]+'</h3><p>'+H[1]+'</p>'
    +(H[2]?'<p class="v6trlive" role="status">'+H[2]+'</p>':'')
    +(pg===1&&!Z.motion?b('tcarm','WAKE THE RUNE STONE','v6trarm'):'')
    +(Z.perm&&pg===1?'<p class="v6trw" role="alert">'+esc(Z.perm)+'</p>':'')+(Z.micErr&&pg===1?'<p class="v6trw" role="status">'+esc(Z.micErr)+'</p>':'')
    +(last?'<div class="v6trwk"><label>Wake time<input id="v6trwk" type="time" data-in="trwk" value="'+esc(RITE.wake)+'"></label>'
      +'<label>Chime window<select id="v6trwn" data-ch="trwn">'+[[0,'Exact time only'],[15,'15 min'],[20,'20 min'],[30,'30 min']].map(x=>'<option value="'+x[0]+'"'+(+RITE.win===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></label></div>':'')
    +'</div><div class="v6trfoot">'+(last?b('tcgo','BEGIN MEDITATION','v6trnext',Z.motion?'':' disabled'):b('tcnext','NEXT','v6trnext',needMotion?' disabled':''))
    +'<div class="v6trlk">'+(pg?b('tcback','Back','v6trlink'):'')+b('trx','Cancel','v6trlink')+'</div></div></div>';el.hidden=false}
function clockHtml(){return '<div class="v6trt num" role="timer">'+hhmm(Date.now())+'</div>'}
function track(){const el=layer(),el0=Date.now()-M.start,hh=Math.floor(el0/36e5),mm=Math.floor(el0/6e4)%60,ring=typeof HWAlarm!=='undefined'&&HWAlarm.ringing;
  const p=hold?Math.min(1,(Date.now()-hold)/SEAL):0;
  el.className='v6tro v6trk'+(Z.down?' down':'');el.removeAttribute('aria-modal');el.setAttribute('role','region');el.setAttribute('aria-label','Trance in progress');
  el.innerHTML='<div class="v6trkb">'+clockHtml()+'<p>Trance in progress · '+hh+' h '+two(mm)+' min</p>'
    +'<small>'+(M.target?'Wake '+hhmm(M.target)+(M.win?' · chime window '+M.win+' min':''):'No wake time set')+(M.rang?' · chime rang':'')+'</small>'
    +(Z.motion?'':'<p class="v6trw" role="alert">No motion data is coming in: the night is not being tracked. Keep this page open on screen.</p>')
    +'<div class="v6trseal"><button type="button" class="v6trsb" data-a="trseal" aria-label="Hold this button for 3 seconds to wake up"><span class="v6trfill" style="width:'+Math.round(p*100)+'%"></span><b>'+(hold?'HOLD…':'HOLD 3 SECONDS TO WAKE')+'</b></button></div>'
    +(ring?'<p>The chime is sounding. Use the alarm screen to stop it.</p>':'')+'</div>';el.hidden=false}
function ask(){const el=layer();el.className='v6tro';el.setAttribute('role','alertdialog');el.setAttribute('aria-modal','true');
  el.innerHTML='<div class="v6trcard v6trwarn"><div class="v6trbar"><i></i><b>Interrupted Rite</b></div><div class="v6trpic v6trpicw"><div class="v6tart"><span class="v6tmoon" style="position:static">'+ico('warning',4,'Warning')+'</span></div></div>'
    +'<div class="v6trbody"><p>You have not yet slept for the minimum <b>90 minutes</b> needed for tracking. If you stop now, this Trance <b>will not be saved</b>. Are you sure you are done sleeping?</p></div>'
    +'<div class="v6trfoot v6trtwo">'+b('trno','NO','v6trghost')+b('tryes','YES','v6trnext')+'</div></div>';el.hidden=false}
const crown=(k)=>k==='B'?'Balanced (Harmonious Resonance)':NAME[k];
function result(){const el=layer(),r=M.res,pp=r.p,aff=r.aff,gr=grade(mine().slice(-7).map(x=>tmin(x.m.bed)).filter(x=>x!=null)),dom=pp?['D','S','A'].reduce((a,c)=>pp[c]>pp[a]?c:a,'D'):null;
  const COLS={D:'#ffb020',S:'#2f8fff',A:'#8e5cff'};
  const row=k=>'<tr><th scope="row"><i style="background:'+COLS[k]+'"></i>'+NAME[k]+'</th><td>'+Math.round(pp[k]*(pp.n*EP)/100)+' min</td><td>'+Math.round(pp[k])+'%</td></tr>';
  el.className='v6tro';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','v6trh');
  el.innerHTML='<div class="v6trcard v6trres"><div class="v6trbar"><i></i><b id="v6trh">Morning Readout</b></div>'
    +'<div class="v6trpic v6trmana"><div><small>Restored Mana</small><strong class="num">'+r.mana+'</strong><span>/ 100</span></div><span class="v6tmoon" style="position:static">'+ico('sleep',3,'Moon')+'</span></div>'
    +'<div class="v6trbody"><span class="v6trtag">GAME ESTIMATE FROM PHONE MOVEMENT, NOT A MEDICAL MEASUREMENT</span>'
    +'<div class="v6trgrid"><div><small>Time slept</small><b>'+r.h+' h</b></div><div><small>Time to cross the veil</small><b>'+r.lat+' min</b></div>'
    +'<div><small>Dominant state</small><b>'+(aff?crown(aff.type):dom?NAME[dom]+'*':'–')+'</b></div><div><small>Ritual consistency</small><b>'+(gr?gr.g:'–')+'</b></div>'
    +'<div><small>Echoes from the Veil</small><b>'+(M.sp||0)+(Z.mic?'':' (mic off)')+'</b></div></div>'
    +'<p>'+(aff?'Type: the stage furthest above your own average of '+aff.n+' earlier nights (within ±3 points = Balanced).':'* Most time this night. Your own type needs 3 earlier Sleep Now nights to compare with.')
    +' Consistency: '+(gr?'your bedtime varied about '+Math.round(gr.sd)+' min over the last nights (A ≤ 30, B ≤ 60).':'needs 3 logged bedtimes.')+'</p>'
    +'<canvas id="v6trhg" width="600" height="220" role="img" aria-label="Runegraph of the night: '+['D','S','A'].map(k=>NAME[k]+' '+Math.round(pp[k])+'%').join(', ')+'"></canvas>'
    +'<table class="v6trtb"><caption>Where the night went (after the veil was crossed)</caption><tbody>'+['D','S','A'].map(row).join('')+'</tbody></table>'
    +(r.sev?'<p class="v6trw" role="status">Severed Conduit: the phone barely moved for 6 hours in a row, so counting stopped there (it was probably left on a table).</p>':'')
    +(M.saved?'<p>Saved to your Sleep log (Dream Score '+M.score+'/100, the same score as a hand-logged night). Morning restfulness used: '+(S.slrest||3)+'/5; change it above for the next night.</p>':'')
    +'</div><div class="v6trfoot">'+b('trdone','DONE','v6trnext')+'<div class="v6trlk">'+b('trvault','Consult the Evidence Vault','v6trlink')+'</div></div></div>';el.hidden=false;draw()}
function bad(){const el=layer(),r=M.res;el.className='v6tro';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');
  el.innerHTML='<div class="v6trcard v6trwarn"><div class="v6trbar"><i></i><b>Interrupted Rite</b></div><div class="v6trpic v6trpicw"><div class="v6tart"><span class="v6tmoon" style="position:static">'+ico('warning',4,'Warning')+'</span></div></div>'
    +'<div class="v6trbody"><p>'+(r.o==null?'The phone never settled into 15 minutes of stillness, so no sleep could be counted.':'Only '+r.mins+' min of sleep were counted, under the 90 minute minimum.')+' Nothing was saved and no points were given.</p>'
    +(Z.motion||M.ep.length?'':'<p class="v6trw">No motion data came from this phone. Check the browser\'s motion permission and try again.</p>')+'</div>'
    +'<div class="v6trfoot">'+b('trdone','OK','v6trnext')+'</div></div>';el.hidden=false}

/* ---------- the Celestial Arcane Runegraph (hypnogram) ---------- */
function draw(){const c=D.getElementById('v6trhg');if(!c||!M||!M.res)return;const r=M.res,e=r.e,x=c.getContext('2d'),W=c.width,H=c.height,L=64,T=14,B=44,pw=W-L-4,ph=H-T-B;
  const ROW={X:0,D:1,S:2,A:3,g:0},LAB=['Awake','Drift','Stillness','Abyssal'],COL=['#8a8fa8','#ffd45e','#6ec8ff','#b58cff'];
  x.fillStyle='#07070f';x.fillRect(0,0,W,H);x.font='12px system-ui,sans-serif';x.textBaseline='middle';
  for(let i=0;i<4;i++){const y=T+ph*(i+.5)/4;x.strokeStyle='#2a2a45';x.lineWidth=1;x.beginPath();x.moveTo(L,y);x.lineTo(W-4,y);x.stroke();x.fillStyle=COL[i];x.fillText(LAB[i],4,y)}
  const n=Math.max(1,e.length),w=pw/n;let prev=null;
  x.lineWidth=3;x.lineJoin='miter';
  for(let i=0;i<e.length;i++){const k=i<(r.o==null?e.length:r.o)?'X':e[i],row=ROW[k],y=T+ph*(row+.5)/4,x0=L+i*w,x1=x0+w;
    x.strokeStyle=COL[row];x.shadowColor=COL[row];x.shadowBlur=6;x.beginPath();if(prev!=null){x.moveTo(x0,prev)}else x.moveTo(x0,y);x.lineTo(x0,y);x.lineTo(x1,y);x.stroke();prev=y}
  x.shadowBlur=0;x.fillStyle='#9a9ab8';x.textBaseline='top';const hrs=n*EP/60,st0=M.start;
  for(let h=0;h<=hrs;h+=Math.max(1,Math.ceil(hrs/6))){const px=L+h*60/EP*w;x.fillText(hhmm(st0+h*36e5),Math.min(px,W-34),T+ph+6)}
  x.fillStyle='#6a6a88';x.fillText('Echoes from the Veil: '+(M.sp||0)+' loud sound'+(M.sp===1?'':'s')+(Z.mic?'':' (mic was off)')+'',L,T+ph+24)}

function paint(){if(!M||M.state==='RESOLVED'&&!view)return;
  if(hold&&!view){const f=D.querySelector('#v6trt .v6trfill');if(f){f.style.width=Math.round(Math.min(1,(Date.now()-hold)/SEAL)*100)+'%';return}}
  if(view==='ask')return ask();if(view==='bad')return bad();if(view==='res'&&M.res)return result();
  if(M.state==='IN_TRANCE'||M.state==='SEAL_BREAKING')track()}
function close(){const el=D.getElementById('v6trt');if(el){el.hidden=true;el.innerHTML=''}view='';M=null;Z.state='IDLE';stopSense();lock(false);clearInterval(TK);clearInterval(HT);hold=0;render()}

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
acts.tcnext=()=>{if(RITE.page===1&&!Z.motion)return;RITE.page=Math.min(3,RITE.page+1);rite()};
acts.tcback=()=>{RITE.page=Math.max(0,RITE.page-1);rite()};
INP.trwk=el=>{RITE.wake=/^\d\d:\d\d$/.test(el.value)?el.value:''};
CH.trwn=v=>{RITE.win=+v};
acts.trx=()=>{const el=D.getElementById('v6trt');if(el){el.hidden=true;el.innerHTML=''}stopSense();Z.motion=0};
acts.tcgo=()=>{if(!Z.motion)return;begin({wake:RITE.wake,win:RITE.win})};
acts.trresume=async()=>{await sense();if(!resume()){setLive(null);render()}};
acts.trdrop=()=>{setLive(null);render()};
acts.trno=()=>{view='';M.warned=0;M.state='IN_TRANCE';hold=0;paint()};
acts.tryes=()=>{view='';finish(Date.now())};
acts.trdone=()=>close();
acts.trvault=()=>{const el=D.getElementById('v6trt');if(el){el.hidden=true;el.innerHTML=''}view='';M=null;Z.state='IDLE';if(typeof HWVault!=='undefined')HWVault.openCalc('trance','sleep');else render()};
// the seal: pointer or key held for 3 seconds (a tap does nothing)
function press(){if(!M||M.state==='RESOLVED')return;M.state='SEAL_BREAKING';hold=Date.now();clearInterval(HT);HT=setInterval(()=>{if(!hold)return;if(Date.now()-hold>=SEAL){hold=0;clearInterval(HT);seal()}else paint()},100);paint()}
function release(){if(M&&M.state==='SEAL_BREAKING'){M.state='IN_TRANCE';}hold=0;clearInterval(HT);if(M&&view==='')paint()}
D.addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('.v6trsb'))press()},true);
['pointerup','pointercancel'].forEach(t=>D.addEventListener(t,()=>{if(hold)release()},true));
D.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&e.target.classList&&e.target.classList.contains('v6trsb')&&!e.repeat)press()},true);
D.addEventListener('keyup',e=>{if((e.key===' '||e.key==='Enter')&&hold)release()},true);
D.addEventListener('visibilitychange',()=>{if(D.visibilityState==='visible'&&M&&M.state!=='RESOLVED'){lock(true);tick()}});
HWEvents.on('data:reset',()=>{clearInterval(TK);clearInterval(HT);stopSense();M=null;view='';const el=D.getElementById('v6trt');if(el){el.hidden=true;el.innerHTML=''}});

HWUI.css('trance',`
#v6trc h3{display:flex;align-items:center;gap:8px}
.v6trnow{width:100%;min-height:56px;display:flex;align-items:center;justify-content:center;gap:8px}
.v6trw{padding:8px;border:2px dashed var(--ln);background:var(--p2);font-size:13px}
.v6tro{position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(6,9,13,.92);overflow:auto}
.v6tro[hidden]{display:none}

.v6trcard{width:min(100%,380px);max-height:100%;overflow:auto;background:#fff;color:#3c4150;border-radius:14px;box-shadow:0 6px 0 rgba(0,0,0,.35);font-family:var(--fn)}
.v6trbar{display:flex;align-items:center;gap:10px;padding:14px 16px;font-size:16px;font-weight:700;color:#3c4150}.v6trbar i{width:6px;height:22px;background:#2f8fff;border-radius:2px}.v6trbar b{flex:1}.v6trbar span{font-size:12px;color:#8a8f9c;font-weight:600}
.v6trpic{background:#d8f6fb;background-image:radial-gradient(#bdeaf3 2px,transparent 2px);background-size:22px 22px;min-height:170px;display:flex;align-items:center;justify-content:center;padding:14px}
.v6tart{position:relative;display:flex;align-items:center;justify-content:center;gap:10px;width:100%}
.v6tph{display:inline-block;border:4px solid #2b3a55;background:#2f8fff;border-radius:10px;box-shadow:4px 4px 0 rgba(43,58,85,.25)}
.v6tph.land{width:104px;height:56px}.v6tph.flat{width:96px;height:48px}.v6tph.dark{width:60px;height:104px;background:#0b0f1a}
.v6tbat{position:absolute;top:-6px;left:8%;background:#3f9f4a;border:3px solid #2b3a55;border-radius:6px;padding:2px 6px;display:flex}
.v6tcord{width:46px;height:5px;background:#2b3a55;border-radius:3px}
.v6tbed{position:relative;width:100%;max-width:300px;height:96px;background:#f4e6c8;border:4px solid #2b3a55;border-radius:10px;display:flex;align-items:center;gap:14px;padding:0 14px}
.v6tpil{width:62px;height:62px;background:#fff;border:4px solid #2b3a55;border-radius:12px}
.v6tbed em{position:absolute;left:84px;bottom:6px;font:700 12px/1 var(--fn);font-style:normal;color:#2b3a55}
.v6tart>.v6tmoon:only-child{position:static}.v6tmoon{position:absolute;right:14%;top:2px;background:#fff;border:3px solid #2b3a55;border-radius:50%;padding:6px;display:flex}
.v6trbody{padding:16px 20px 6px;text-align:center}.v6trbody h3{margin:8px 0;font-size:18px;color:#3c4150;border:0;padding:0;background:none}
.v6trbody p{margin:6px 0;font-size:14px;line-height:1.45;color:#8a8f9c}.v6trbody .v6trlive{color:#2f6fbf;font-weight:600}
.v6trnum{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:#4a9eff;color:#fff;font:700 18px/1 var(--fn)}
.v6trarm{margin:8px auto;min-height:48px;padding:0 18px;border-radius:24px;background:#2f8fff;color:#fff;border:0;border-bottom:4px solid #1e63b8;font-weight:700}
.v6trwk{display:flex;gap:10px;margin-top:10px}.v6trwk label{flex:1;font-size:12px;color:#8a8f9c;text-align:left}.v6trwk input,.v6trwk select{width:100%;min-height:44px;margin-top:4px;color:#3c4150;background:#f2f4f8;border:2px solid #d5d9e2;border-radius:8px}
.v6trfoot{padding:10px 20px 16px;text-align:center}
.v6trnext{width:100%;min-height:52px;border-radius:28px;background:#3fd06a;color:#fff;border:0;border-bottom:5px solid #1f9a47;font-size:17px;font-weight:700;text-shadow:0 1px 0 rgba(0,0,0,.2)}
.v6trnext:disabled{background:#c7ccd6;border-bottom-color:#a3a9b6;color:#fff;opacity:1}
.v6trlk{display:flex;justify-content:center;gap:18px;margin-top:6px}.v6trlink{min-height:44px;background:none;border:0;color:#6b7280;text-decoration:underline;font-size:14px}
.v6trbody .v6trw{background:#fff4e5;color:#8a5a00;border-color:#f0c070;text-align:left}

.v6trpicw{background:#ffe9e6;background-image:radial-gradient(#ffd3cc 2px,transparent 2px);min-height:120px}
.v6trtwo{display:flex;gap:12px}.v6trtwo button{flex:1}.v6trghost{min-height:52px;border-radius:28px;background:#fff;color:#6b7280;border:2px solid #d5d9e2;border-bottom-width:5px;font-size:17px;font-weight:700}
.v6trmana{justify-content:space-between;padding:18px 24px;background:#1b2f7a;background-image:radial-gradient(#2a42a0 2px,transparent 2px);color:#fff}
.v6trmana small{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#bcd0ff}.v6trmana strong{font-size:56px;color:#ffe45e;line-height:1.1}.v6trmana span:not(.v6tmoon){font-size:18px;margin-left:4px;color:#bcd0ff}
.v6trtag{display:inline-block;margin:4px 0 10px;padding:3px 8px;border-radius:10px;background:#eef2ff;color:#3c4a8a;font:700 11px/1.4 var(--fn)}
.v6trgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left}.v6trgrid div{background:#f2f4f8;border-radius:10px;padding:8px 10px}.v6trgrid small{display:block;font-size:12px;color:#8a8f9c}.v6trgrid b{font-size:17px;color:#3c4150}
.v6trres canvas{width:100%;height:auto;display:block;border-radius:10px;margin-top:10px}
.v6trres .v6trtb{color:#3c4150}.v6trres .v6trtb th,.v6trres .v6trtb td{border-bottom:1px solid #e6e9f0}.v6trtb i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}.v6trres .v6trtb caption{color:#8a8f9c}
.v6trb{width:min(100%,420px);max-height:100%;overflow:auto;display:flex;flex-direction:column;gap:10px}
.v6trs{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:12px}.v6trs li{padding-left:2px}.v6trs small{display:block;margin:4px 0}
.v6trs button,.v6trb .row button,.v6trb select,.v6trb input{min-height:44px}
.v6trg button{flex:1 1 140px;display:flex;align-items:center;justify-content:center;gap:6px}
.v6trres canvas{width:100%;height:auto;display:block;border:3px solid var(--ln);image-rendering:auto}
.v6trtb{width:100%;border-collapse:collapse;font-size:14px}.v6trtb th,.v6trtb td{text-align:left;padding:4px;border-bottom:1px solid var(--ln)}.v6trtb caption{text-align:left;font-size:12px;padding-bottom:4px}
.v6trk{background:#000;color:#6b4a2a;z-index:8900}
.v6trkb{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;max-width:360px;width:100%;opacity:.7}
.v6trt{font-size:56px;color:#b0723a}.v6trkb small,.v6trkb p{color:#8a6a50}
.v6trk.down .v6trkb{opacity:0}.v6trk.down .v6trkb .v6trseal{opacity:0}
.v6trseal{width:100%}.v6trsb{position:relative;overflow:hidden;width:100%;min-height:72px;background:#1b1626;color:#c8743a;border:3px solid #3a2a20;touch-action:none;user-select:none}
.v6trfill{position:absolute;left:0;top:0;bottom:0;background:#4a2f1a}.v6trsb b{position:relative}
`);
HWEvents.on('app:ready',()=>{const l=live();if(l&&Date.now()-(+l.s||0)>CAPH*36e5+36e5)setLive(null)}); // a night left open for over 14 h is dropped
return{tier,onset,flat,pct,affinity,grade,resolve,limits,K:{EP,MINMIN,CAPH,MAXN,FLATEP,LATEP,T_A,T_S,T_FLAT,SEAL},
  _sample:sample,_begin:begin,_tick:tick,_state:()=>M,_S:Z}})();
