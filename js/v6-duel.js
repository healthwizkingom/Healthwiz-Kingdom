/* v6: Module 9, the Dueling Arena: race a replay of your own earlier climb. Not part of the original.
   Where: the Quests page (route 'quests'), directly below the Hall of Heroes leaderboard (js/v6-board.js; owner's request, 2026-10-29).
   A live race runs beside Stair Sense in the Observatory, because Stair Sense only times climbs there (it pauses when its page is left,
   js/v6-gravity.js).

   Data, read only (nothing is copied or rewritten):
     records   the saved 'stair' entries (st.e, value = total steps; m.sid the staircase; m.dur minutes; m.gv the Stair Sense record
               {gid, secs, h, rise, riseSrc, mass}). A record takes part only with a staircase from STAIRS, a whole step count and a
               time of 10 s to 24 h. Time: m.gv.secs (Stair Sense timer, 1 s) or m.dur × 60 (workout time: the timer keeps whole
               half-minutes, so these are compared to 30 s). Malformed entries are skipped and counted, never fatal.
     compatible  same staircase AND the same total steps, and earlier in the log than the climb it is compared with. Direction and
               completion are not stored: every saved stair entry is an upward climb by the app's own wording ("steps climbed, up
               only") and only finished climbs are saved (Stair Sense saves from its review; a cancelled climb is never saved).
     Echo      "previous": the latest compatible earlier climb. "best": the fastest compatible earlier climb.
   Result: faster / slower / tie (equal within the coarser record's resolution). A personal best is shown only when the climb is
   faster, beyond that resolution, than every compatible earlier climb. No XP: the app gives no reward for speed on stairs (Stair
   Sense: "This is not a race: slower is fine"; the Hall of Heroes: "no XP for rank"). The climb itself already earned its normal
   stair-log XP when it was saved, under the daily cap of js/v6-xp.js, so replays, reloads and re-opening the result change nothing.

   Physics (math.*, pure; docs/CALCULATIONS.md):
     h  vertical gain (m), one function, gain(), first that applies: the h saved with a Stair Sense climb (its steps × the step height
        used then); the F21 report's measured step rise × steps; the survey's measured vertical rise ÷ its counted steps × steps; the
        step height estimated from the stairway's angle (js/v6-gravity.js) × steps; else unavailable. Never a stair's total height
        multiplied by steps.
     W = m × 9.80665 × h  (J)  estimated mechanical work against gravity, not energy used or calories. m: the body mass saved with that
        climb, else your current weight record or confirmed profile weight (kg, as stored; the app keeps no other unit). No mass: no W.
     P = W ÷ t (W)  estimated average mechanical power over the whole timed climb, rests included. Not metabolic, not measured.
     h ÷ t (m/s)  vertical ascent rate. Path speed along the steps = steps × measured step hypotenuse ÷ t, only for the three F21
        staircases whose rise and run were measured; otherwise not shown (0.169 m is ST20's measured RISE, not a distance walked).
   Replay: a time-based visual reconstruction (each racer's progress = replay time ÷ its own duration); the records hold no
   step-by-step timing, so it does not show real cadence. Driven by requestAnimationFrame with performance.now(), never frame counts;
   stopped when the page changes or the tab is hidden; reduced motion shows the end at once.
   Saved: nothing in the save. The armed challenge {echo, sid, total} is kept for this tab only (sessionStorage 'hw_duel'). */
const HWDuel=(()=>{
const G0=9.80665,D=document,$i=i=>D.getElementById(i),K='hw_duel';
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const fin=x=>typeof x==='number'&&isFinite(x);
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const f=(x,d)=>(+x).toLocaleString('en',{minimumFractionDigits:d,maximumFractionDigits:d});
const clk=s=>{s=Math.max(0,Math.round(s));const h=Math.floor(s/3600),m=Math.floor(s%3600/60),c=String(s%60).padStart(2,'0');return h?h+':'+String(m).padStart(2,'0')+':'+c:m+':'+c};
const ico=n=>HWPixel.icon(n,1);
const reduced=()=>typeof HWUI!=='undefined'?HWUI.reduced():false;

/* =====================================================================================================================
   THE MATH (pure)
   ===================================================================================================================== */
const math={
  work:(kg,h)=>fin(kg)&&kg>=20&&kg<=300&&fin(h)&&h>0?kg*G0*h:null,              // W = m g h (J)
  power:(W,t)=>fin(W)&&fin(t)&&t>0?W/t:null,                                      // P = W / t (W)
  rate:(h,t)=>fin(h)&&h>0&&fin(t)&&t>0?h/t:null,                                  // vertical ascent rate (m/s)
  path:(n,hyp,t)=>Number.isInteger(n)&&n>0&&fin(hyp)&&hyp>0&&fin(t)&&t>0?n*hyp/t:null, // speed along the steps (m/s)
  progress:(t,T)=>fin(t)&&fin(T)&&T>0?clamp(t/T,0,1):0,
  /** 'faster' | 'slower' | 'tie' for a against b, equal within tol seconds; null when either time is not valid */
  verdict(a,b,tol){if(!fin(a)||!fin(b)||a<=0||b<=0)return null;tol=fin(tol)&&tol>=0?tol:1;const d=a-b;return Math.abs(d)<tol?'tie':d<0?'faster':'slower'},
  /** Vertical gain for n steps. o = {n, gvH, gvSrc, f21Rise, survey:{rise_m, steps}, angleRise} → {h, kind, how} | {h:null, why} */
  gain(o){o=o||{};const n=o.n;
    if(!(Number.isInteger(n)&&n>=1&&n<=100000))return{h:null,why:'the step count is missing or not valid'};
    if(fin(o.gvH)&&o.gvH>0&&o.gvH<=300)return{h:o.gvH,kind:o.gvSrc==='study'?'calc':o.gvSrc==='typed'?'you':'est',
      how:'saved with the climb: '+(o.gvSrc==='study'?'measured step rise':o.gvSrc==='angle'?'step rise estimated from the angle':o.gvSrc==='typed'?'the step height you typed':'step height')+' × steps'};
    if(fin(o.f21Rise)&&o.f21Rise>=.05&&o.f21Rise<=.3)return{h:n*o.f21Rise,kind:'calc',how:n+' steps × '+f(o.f21Rise*100,1)+' cm measured step rise (Group 14 F21 report)'};
    const s=o.survey;if(s&&fin(s.rise_m)&&s.rise_m>0&&Number.isInteger(s.steps)&&s.steps>0){const r=s.rise_m/s.steps;
      if(r>=.05&&r<=.3)return{h:n*r,kind:'calc',how:n+' steps × '+f(r*100,1)+' cm (survey: '+s.rise_m+' m over '+s.steps+' counted steps)'}}
    if(fin(o.angleRise)&&o.angleRise>=.05&&o.angleRise<=.3)return{h:n*o.angleRise,kind:'est',how:n+' steps × '+f(o.angleRise*100,1)+' cm step rise estimated from the stairway’s angle'};
    return{h:null,why:'no step height is known for this staircase'}}};

/* =====================================================================================================================
   RECORDS FROM THE SAVE (read at the moment)
   ===================================================================================================================== */
const stairOf=id=>typeof STAIRS!=='undefined'?STAIRS.find(s=>s.id===id)||null:null;
const okDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d);
/** One saved entry → a duel record, or null. i = its place in the log (the tie-break for the order of climbs). */
function rec(e,i){try{
  if(!isO(e)||e.c!=='stair')return null;const m=isO(e.m)?e.m:{},gv=isO(m.gv)?m.gv:null;
  const total=+e.v;if(!(Number.isInteger(total)&&total>=1&&total<=100000))return{bad:'steps'};
  if(!okDate(e.d))return{bad:'date'};
  const sid=typeof m.sid==='string'&&stairOf(m.sid)?m.sid:null;
  let secs=null,res=null,tsrc='';
  if(gv&&fin(+gv.secs)&&+gv.secs>=10&&+gv.secs<=86400){secs=Math.round(+gv.secs);res=1;tsrc='Stair Sense timer'}
  else if(fin(+m.dur)&&+m.dur>0){const s=Math.round(+m.dur*60);if(s>=10&&s<=86400){secs=s;res=30;tsrc='workout time'}}
  return{id:String(e.id),i,d:e.d,t:typeof e.t==='string'&&/^\d{2}:\d{2}/.test(e.t)?e.t.slice(0,5):'',sid,total,secs,res,tsrc,
    gvH:gv&&fin(+gv.h)?+gv.h:null,gvSrc:gv&&typeof gv.riseSrc==='string'?gv.riseSrc:null,gvMass:gv&&fin(+gv.mass)&&+gv.mass>=20&&+gv.mass<=300?+gv.mass:null}}
  catch(err){return{bad:'unreadable'}}}
/** {all: timed records with a staircase, in log order, bad: entries that could not be read, untimed: stair entries without a time} */
function history(){let E=[];try{E=typeof LC==='function'?LC('stair'):[]}catch(e){E=(typeof st!=='undefined'&&Array.isArray(st.e)?st.e:[]).filter(x=>isO(x)&&x.c==='stair')}if(!Array.isArray(E))E=[]; // LC throws on a damaged log: read it directly
  const out={all:[],bad:0,untimed:0};E.forEach((e,i)=>{const r=rec(e,i);if(!r)return;if(r.bad){out.bad++;return}if(!r.sid||r.secs==null){out.untimed++;return}out.all.push(r)});
  out.all.sort((a,b)=>(a.d+a.t).localeCompare(b.d+b.t)||a.i-b.i);out.all.forEach((r,k)=>r.k=k);return out}
const group=(H,sid,total)=>H.all.filter(r=>r.sid===sid&&r.total===total);
/** The Echo for climb c: the latest ('prev') or fastest ('best') compatible earlier climb. */
function echoFor(H,c,mode){const L=group(H,c.sid,c.total).filter(r=>r.k<c.k);if(!L.length)return null;
  return mode==='best'?L.reduce((a,b)=>b.secs<a.secs?b:a):L[L.length-1]}
function isBest(H,c){const L=group(H,c.sid,c.total).filter(r=>r.k<c.k);if(!L.length)return false;
  return L.every(r=>math.verdict(c.secs,r.secs,Math.max(c.res,r.res))==='faster')}
/** Vertical gain, work, power and rates for a record. */
function metrics(r){
  const q=typeof HWCampusData!=='undefined'?HWCampusData.record(r.sid):null,ms=q&&q.measuredStep;
  let ang=null;try{if(typeof HWGravity!=='undefined'&&HWGravity.riseKind(r.sid)==='angle')ang=HWGravity.verifiedRise(r.sid)}catch(e){}
  const g=math.gain({n:r.total,gvH:r.gvH,gvSrc:r.gvSrc,f21Rise:ms?ms.rise_m:null,survey:q&&q.verticalRise_m!=null&&q.stepCount?{rise_m:q.verticalRise_m,steps:q.stepCount}:null,angleRise:ang});
  let mi=null;if(r.gvMass)mi={kg:r.gvMass,src:'the body mass saved with this climb'};
  else{try{const x=typeof HWGravity!=='undefined'?HWGravity.massInfo():null;if(x&&fin(+x.kg))mi={kg:+x.kg,src:x.src}}catch(e){}}
  const W=g.h!=null&&mi?math.work(mi.kg,g.h):null;
  return{g,mi,W,P:math.power(W,r.secs),v:math.rate(g.h,r.secs),path:ms?math.path(r.total,ms.hypotenuse_m,r.secs):null,hyp:ms?ms.hypotenuse_m:null}}

/* =====================================================================================================================
   STATE (memory; the armed challenge for this tab in sessionStorage)
   ===================================================================================================================== */
const A={sid:'',total:0,cid:'',mode:'prev',rp:null,raf:0,lraf:0,result:null};
let ARM=(()=>{try{const o=JSON.parse(sessionStorage.getItem(K)||'null');return isO(o)&&typeof o.echo==='string'&&typeof o.sid==='string'&&Number.isInteger(o.total)?o:null}catch(e){return null}})();
const keepArm=()=>{try{ARM?sessionStorage.setItem(K,JSON.stringify(ARM)):sessionStorage.removeItem(K)}catch(e){}};
/** Make the selection valid for the history (staircase, climb length, your climb, comparison). */
function settle(H){
  const sids=[...new Set(H.all.map(r=>r.sid))];
  if(A.sid&&!stairOf(A.sid))A.sid='';
  if(!A.sid&&H.all.length)A.sid=H.all[H.all.length-1].sid;
  const mine=H.all.filter(r=>r.sid===A.sid),tots=[...new Set(mine.map(r=>r.total))];
  if(!tots.includes(A.total))A.total=mine.length?mine[mine.length-1].total:0;
  const G=group(H,A.sid,A.total);
  if(!G.some(r=>r.id===A.cid))A.cid=G.length?G[G.length-1].id:'';
  if(A.mode!=='prev'&&A.mode!=='best')A.mode='prev';
  return{sids,tots,G}}

/* =====================================================================================================================
   THE ARENA CARD (Quests page)
   ===================================================================================================================== */
function help(){
  const cite=typeof HWSources!=='undefined'?'<b class="hwx-h">SOURCES</b><ul class="hwx-src">'+['nistg'].map(HWSources.cite).join('')+'</ul>':'';
  return HWHelp.btn('duel','The Dueling Arena: what is compared',
    '<p><b>Your own climbs only.</b> Two saved climbs on the same staircase with the same number of steps. The Echo is your previous one, or your fastest earlier one. Nothing is shared and no other player is shown.</p>'
    +'<p><b>Time.</b> From the Stair Sense timer (to the second) or the workout time (kept in half-minutes, so those are compared to 30 s). Equal within that is a tie.</p>'
    +'<p><b>The replay</b> moves each racer by its own total time. Your records hold no step-by-step times, so it is a time-based picture, not your real pace on each step.</p>'
    +'<p><b>Vertical gain h</b> (m): the height saved with a Stair Sense climb; else steps × the measured step rise (F21 report or survey); else steps × a step rise estimated from the stairway’s angle; else unavailable.</p>'
    +'<p><b>Estimated mechanical work against gravity</b> W = m × 9.80665 m/s² × h (J), with your body mass m (kg). It is the ideal work to lift your body that height, not the energy your body uses and not calories.</p>'
    +'<p><b>Estimated average mechanical power</b> P = W ÷ t (W), over the whole time, rests included. Not measured, not metabolic power.</p>'
    +'<p><b>Vertical ascent rate</b> = h ÷ t (m/s). <b>Speed along the steps</b> = steps × measured step length (hypotenuse) ÷ t, only for the three F21 staircases with a measured rise and run.</p>'
    +'<p><b>No XP for winning.</b> Climbing faster is not healthier, and the stairs are no place to rush: use the handrail and a pace that is comfortable. Each climb already earned its normal stair XP when you saved it. A motivational comparison, not a health assessment.</p>'
    +cite,{label:'What is being compared?'})}
const stairName=id=>{const q=stairOf(id);return q?q.name+' ('+id+')':id};
const opt=(v,t,on,dis)=>'<option value="'+esc(v)+'"'+(on?' selected':'')+(dis?' disabled':'')+'>'+esc(t)+'</option>';
const when=r=>r.d+(r.t?' '+r.t:'');
function setup(H,S){
  const counts={};H.all.forEach(r=>counts[r.sid]=(counts[r.sid]||0)+1);
  const K={MILD:1,MODERATE:2,VIGOROUS:3},E=STAIRS.slice().sort((a,b)=>(K[a.cat]||9)-(K[b.cat]||9)||a.angle-b.angle),withT=E.filter(s=>counts[s.id]),rest=E.filter(s=>!counts[s.id]); // easiest first, as in the Observatory list
  const mine=H.all.filter(r=>r.sid===A.sid);
  return '<div class="duelset" role="group" aria-label="Choose the duel">'
    +'<label>Staircase<select data-ch="duelsid">'+(A.sid?'':opt('','Choose a staircase…',1))
      +'<optgroup label="With timed climbs">'+withT.map(s=>opt(s.id,s.name+' · '+s.id+' · '+counts[s.id]+' timed',A.sid===s.id)).join('')+'</optgroup>'
      +'<optgroup label="No timed climbs yet">'+rest.map(s=>opt(s.id,s.name+' · '+s.id,A.sid===s.id)).join('')+'</optgroup></select></label>'
    +(S.tots.length>1?'<label>Climb length<select data-ch="dueltot">'+S.tots.map(n=>opt(n,n+' steps · '+mine.filter(r=>r.total===n).length+' timed',A.total===n)).join('')+'</select></label>':'')
    +(S.G.length>1?'<label>Your climb<select data-ch="duelcid">'+S.G.slice().reverse().map(r=>opt(r.id,when(r)+' · '+clk(r.secs)+(r.k===S.G[0].k?' (first)':''),A.cid===r.id,r.k===S.G[0].k)).join('')+'</select></label>'
      +'<label>Compare with<select data-ch="duelmode">'+opt('prev','Previous climb here',A.mode==='prev')+opt('best','Personal best here',A.mode==='best')+'</select></label>':'')
    +'</div>'}
const avatar=k=>'<span class="duelav '+k+'" aria-hidden="true"><i></i></span>';
const NS=12,TORCH=[1,4,7,10];                                                                   // steps drawn on each lane (decoration, not the real count)
/* The lane is a staircase of NS rune steps rising left to right. The racer moves with two transforms: translateX(p × 100 %) on a
   rail as wide as the run, translateY(−p × 100 %) on a box as tall as the rise, so it stays on the stairs and inside the lane at
   0 and 100 %. The lit steps are the same staircase shape with a scaleX(p) glow inside it. */
function lane(k,name,sub,p,secs,shown,pre){pre=pre||'duel';
  return '<div class="duellane '+k+'"><p class="duelname"><b>'+esc(name)+'</b> <small>'+esc(sub)+'</small><span class="duelcrown" aria-hidden="true">LEAD</span></p>'
    +'<div class="dueltrack" id="'+pre+'-'+k+'" role="progressbar" aria-label="'+esc(name)+' progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(p*100)+'" aria-valuetext="'+Math.round(p*100)+'% · '+clk(shown)+' of '+clk(secs)+'">'
    +'<canvas class="duelcv" data-k="base-'+k+'" aria-hidden="true"></canvas>'
    +'<span class="duelstair" aria-hidden="true"><i class="duelstone"></i><i class="duelsteps"></i></span>'
    +'<span class="duelrev" aria-hidden="true" style="transform:translateX('+(-(1-p)*100).toFixed(2)+'%)"><span class="duelhold" style="transform:translateX('+((1-p)*100).toFixed(2)+'%)"><canvas class="duelcv lit" data-k="lit-'+k+'"></canvas></span></span>'
    +TORCH.map(i=>'<i class="dueltorch'+(p>=i/NS?' on':'')+'" data-i="'+i+'" aria-hidden="true" style="left:calc(6px + (100% - 50px) * '+((i+.5)/NS).toFixed(4)+');top:calc('+((1-(i+1)/NS*.58)*100).toFixed(2)+'% - 19px)"><b></b></i>').join('')
    +'<i class="duelfill" aria-hidden="true" style="transform:scaleX('+p.toFixed(4)+')"></i>'
    +'<i class="duelgate'+(p>=1?' open':'')+'" aria-hidden="true"><b></b></i>'
    +'<div class="duelrail"><div class="duelmv" style="transform:translateX('+(p*100).toFixed(2)+'%)"><div class="duelup" style="transform:translateY('+(-p*100).toFixed(2)+'%)"><i class="dueltrail" aria-hidden="true"></i>'+avatar(k)+'</div></div></div></div>'
    +'<p class="dueltime num" aria-hidden="true"><b id="'+pre+'-'+k+'-t">'+clk(shown)+'</b> / '+clk(secs)+'</p></div>'}
const scene=()=>'<span class="duelsky" aria-hidden="true"><canvas class="duelcv" data-k="sky"></canvas><i class="duelstars"></i><i class="duelstars b"></i><i class="duelcloud"></i></span>'
  +'<span class="duelcount" aria-hidden="true"></span><span class="duelgap" aria-hidden="true"></span>';
function track(c,e,p){p=p||{c:1,e:1,tc:c.secs,te:e.secs};
  return '<div class="dueltrk" id="duel-track" aria-label="Your climb compared with your Echo">'+scene()
    +lane('you','You — Champion',when(c),p.c,c.secs,p.tc)+lane('echo','Historical Echo',(A.mode==='best'?'Personal best · ':'')+when(e),p.e,e.secs,p.te)+'</div>'}
const val=(x,u,d)=>x==null?'<span class="duelna">—</span>':'<b>'+f(x,d)+'</b> '+u;
function table(c,e){const mc=metrics(c),me=metrics(e),hyp=mc.hyp!=null;
  const row=(n,a,b,note)=>'<tr><th scope="row">'+n+(note?'<small>'+note+'</small>':'')+'</th><td>'+a+'</td><td>'+b+'</td></tr>';
  const why=m=>m.g.h==null?'needs a step height':!m.mi?'needs your body mass':'';
  const missing=[mc,me].map(why).filter(Boolean);
  return '<div class="tscroll"><table class="tbl dueltab"><caption>The two climbs <span class="pxtag">ESTIMATES MARKED</span></caption><thead><tr><th scope="col"></th><th scope="col">You</th><th scope="col">Echo</th></tr></thead><tbody>'
    +row('Date',esc(when(c)),esc(when(e)))
    +row('Time',val(c.secs/60,'min',2)+' <small>'+esc(clk(c.secs))+'</small>',val(e.secs/60,'min',2)+' <small>'+esc(clk(e.secs))+'</small>','measured: '+esc(c.tsrc===e.tsrc?c.tsrc:c.tsrc+' / '+e.tsrc))
    +row('Steps',val(c.total,'',0),val(e.total,'',0),'counted or typed by you')
    +row('Vertical gain',val(mc.g.h,'m',2),val(me.g.h,'m',2),mc.g.h!=null?esc(mc.g.how):'not available: '+esc(mc.g.why))
    +row('Vertical ascent rate',val(mc.v,'m/s',3),val(me.v,'m/s',3),'h ÷ t')
    +(hyp?row('Speed along the steps',val(mc.path,'m/s',2),val(me.path,'m/s',2),'steps × '+f(mc.hyp,3)+' m measured step length ÷ t'):'')
    +row('Estimated mechanical work against gravity',val(mc.W,'J',0),val(me.W,'J',0),mc.mi?'W = m g h, m = '+f(mc.mi.kg,1)+' kg ('+esc(mc.mi.src)+')':'W = m g h')
    +row('Estimated average mechanical power',val(mc.P,'W',1),val(me.P,'W',1),'P = W ÷ t')
    +'</tbody></table></div>'
    +(missing.length?'<p class="mut duelsm" role="note">Work and power show “—” because this '+([...new Set(missing)].join(' and '))+'. '+(!mc.mi?'Add your weight on the BMI page or confirm your profile.':'')+'</p>':'')
    +(hyp?'':'<p class="mut duelsm">Speed along the steps is not shown: only the three F21 staircases have a measured step length.</p>')}
const MED={faster:'A new record! Your latest ascent was faster than your Echo. Well climbed, and keep a hand on the rail.',
  slower:'The Echo was faster this time, but your climb still counts. Every completed climb builds your own history.',
  tie:'A perfect match. You equalled your Echo.',
  first:'Your first record is sealed. Return after another ascent to challenge your Echo.'};
function result(c,e,H){
  const v=math.verdict(c.secs,e.secs,Math.max(c.res,e.res)),pb=v==='faster'&&isBest(H,c),d=Math.abs(c.secs-e.secs);
  A.result={v,pb,id:c.id+'>'+e.id};
  const head=v==='faster'?(pb?'PERSONAL BEST':'FASTER THAN YOUR ECHO'):v==='slower'?'THE ECHO WAS FASTER':'A TIE';
  return '<div class="duelres '+v+(pb?' pb':'')+'" id="duel-res" role="status" aria-live="polite"><p class="duelrh"><b>'+head+'</b>'+(pb?' <span class="pxtag">PB</span>':'')+'</p>'
    +'<p>'+(v==='tie'?'Both took '+clk(c.secs)+' (equal within '+Math.max(c.res,e.res)+' s).':'You: '+clk(c.secs)+' · Echo: '+clk(e.secs)+' · '+(v==='faster'?'faster':'slower')+' by '+clk(d)+'.')+'</p>'
    +'<p class="duelmed"><span aria-hidden="true">'+ico('wizard')+'</span><span><b>Medius:</b> '+esc(MED[v])+(pb?' It is your fastest on this climb so far.':'')+'</span></p>'
    +'<span class="duelrunes" aria-hidden="true">'+'<u></u>'.repeat(8)+'</span></div>'}
function liveNote(){const L=typeof HWGravity!=='undefined'&&HWGravity.live;if(!L||(L.ph!=='running'&&L.ph!=='paused'&&L.ph!=='review'))return '';
  return '<p class="duellive" role="status"><b>Stair Sense is '+(L.ph==='review'?'waiting for you to check and save a climb':L.ph==='running'?'timing a climb':'paused')+'</b>'+(L.sid?' at '+esc(stairName(L.sid)):'')
    +'. Live racing happens beside Stair Sense in the Observatory'+(L.ph==='paused'?'; it paused when you left that page':'')+'. <button type="button" class="g sm" data-a="duelgo">OPEN STAIR SENSE</button></p>'}
function body(){
  const H=history();
  const bad=H.bad?'<p class="mut duelsm" role="note">'+H.bad+' saved stair entr'+(H.bad===1?'y':'ies')+' could not be read and '+(H.bad===1?'is':'are')+' left out. Nothing was changed.</p>':'';
  if(!H.all.length)return liveNote()+'<div class="duelempty">'+avatar('you')+'<div><p><b>No timed climbs yet.</b> Your first timed climb on a staircase becomes your baseline: the Echo you race next time.</p>'
    +'<p class="mut duelsm">Time a climb with Stair Sense (or the workout timer) in the Observatory and save it.'+(H.untimed?' Your '+H.untimed+' climb'+(H.untimed===1?' has':'s have')+' no time recorded, so '+(H.untimed===1?'it cannot':'they cannot')+' be raced.':'')+'</p>'
    +'<button type="button" data-a="duelgo">OPEN THE OBSERVATORY</button></div></div>'+bad;
  const S=settle(H);
  let main='';
  if(!A.sid)main='<p class="mut">Choose a staircase to see its climbs.</p>';
  else if(!S.G.length)main='<p class="mut">No timed climbs on '+esc(stairName(A.sid))+' yet. Your first one becomes the baseline.</p>'+armBtn(null);
  else if(S.G.length===1){const r=S.G[0];main='<div class="duelresult first"><p><b>Baseline sealed:</b> '+esc(when(r))+' · '+r.total+' steps · '+clk(r.secs)+' ('+esc(r.tsrc)+').</p>'
    +'<p class="duelmed"><span aria-hidden="true">'+ico('wizard')+'</span><span><b>Medius:</b> '+esc(MED.first)+'</span></p></div>'+armBtn(r)}
  else{const c=S.G.find(r=>r.id===A.cid),e=echoFor(H,c,A.mode);
    if(!e)main='<p class="mut">This is your first '+c.total+'-step climb here, so there is no earlier Echo for it. Pick a later climb.</p>';
    else main='<p class="duelwhat"><b>Compared:</b> your climb of '+esc(when(c))+' against '+(A.mode==='best'?'your fastest earlier climb':'your previous climb')+' here, '+c.total+' steps each on '+esc(stairName(c.sid))+'. Time only decides; the replay is a time-based picture.</p>'
      +track(c,e,A.rp&&A.rp.id===c.id+'>'+e.id?A.rp.p:null)
      +'<div class="row duelbtns"><button type="button" data-a="duelplay">'+(A.rp&&A.rp.on?'REPLAYING…':'REPLAY THE DUEL')+'</button>'+armBtn(S.G[S.G.length-1],1)+'</div>'
      +'<p class="mut duelsm" id="duel-spd">'+speedTxt(c,e)+'</p>'
      +result(c,e,H)+table(c,e)}
  return liveNote()+setup(H,S)+main+bad}
const speedOf=(c,e)=>Math.max(1,Math.ceil(Math.max(c.secs,e.secs)/8));
const speedTxt=(c,e)=>'Replay at ×'+speedOf(c,e)+' speed (the longer climb plays in about 8 seconds).';
function armBtn(r,inRow){if(!r)return '';const on=ARM&&ARM.echo===r.id;
  const b='<button type="button" class="g" data-a="duelarm" data-id="'+esc(r.id)+'" aria-pressed="'+(on?'true':'false')+'">'+(on?'ECHO READY IN STAIR SENSE':'RACE THIS ECHO LIVE')+'</button>';
  return inRow?b:'<div class="row duelbtns">'+b+'</div>'}
function card(){return '<section class="card duel" id="dueling-arena" aria-labelledby="duel-t"><h3 id="duel-t">'+ico('stairs')+' THE DUELING ARENA '+help()+'</h3>'
  +'<p class="mut duelintro">Race a replay of your own earlier climb, your Shadow Echo. Your records only; nothing is shared.</p><div id="duel-b">'+body()+'</div></section>'}
function repaint(){stopReplay();const b=$i('duel-b');if(b)b.innerHTML=body();paintSoon()}

/* ---------- the replay ---------- */
function stopReplay(){cancelAnimationFrame(A.raf);A.raf=0;if(A.rp)A.rp.on=0}
/** Move one racer: fill, rail, rise, time label; aria every 10 % and at the end (not every frame). pre: 'duel' (replay) or 'duell' (live). */
function place(k,p,shown,secs,pre){const t=$i((pre||'duel')+'-'+k);if(!t)return;
  const fl=t.querySelector('.duelfill'),mv=t.querySelector('.duelmv'),up=t.querySelector('.duelup'),tx=$i((pre||'duel')+'-'+k+'-t');
  if(fl)fl.style.transform='scaleX('+p.toFixed(4)+')';if(mv)mv.style.transform='translateX('+(p*100).toFixed(2)+'%)';if(up)up.style.transform='translateY('+(-p*100).toFixed(2)+'%)';
  const rv=t.querySelector('.duelrev'),hd=rv&&rv.firstChild;if(rv){rv.style.transform='translateX('+(-(1-p)*100).toFixed(2)+'%)';hd.style.transform='translateX('+((1-p)*100).toFixed(2)+'%)'}
  t.querySelectorAll('.dueltorch').forEach(e=>{const on=p>=+e.dataset.i/NS;if(e.classList.contains('on')!==on)e.classList.toggle('on',on)});
  if(tx)tx.textContent=clk(shown);
  const g=t.querySelector('.duelgate');if(g&&p>=1&&!g.classList.contains('open'))g.classList.add('open');
  const pc=Math.round(p*100);if(+t.getAttribute('aria-valuenow')!==pc&&(pc%10===0||p>=1)){t.setAttribute('aria-valuenow',pc);t.setAttribute('aria-valuetext',pc+'% · '+clk(shown)+' of '+clk(secs))}}
/** Running pose, the leader's crown and the gap readout (class changes only when something changes). */
function race(box,pc,pe,tc,te,run){if(!box)return;const Y=box.querySelector('.duellane.you'),E=box.querySelector('.duellane.echo');
  const lead=pc>pe+.005?Y:pe>pc+.005?E:null;[Y,E].forEach((l,i)=>{if(!l)return;l.classList.toggle('lead',l===lead);l.classList.toggle('run',!!run&&(i?pe:pc)<1)});
  const gp=box.querySelector('.duelgap');if(gp){const s=!run||!lead?'':(lead===Y?'You lead':'Echo leads')+' by '+Math.round(Math.abs(pc-pe)*100)+' %';if(gp.textContent!==s)gp.textContent=s}}
const COUNT=['3','2','1','CLIMB!'],PRE=1.6;

/* ---------- the painted arena (original pixel art drawn in code, 1 art pixel = 2 CSS px) ----------
   Painted once per size (after a redraw and on resize), never per frame: the sky, each lane's rampart and stairs, and each lane's
   lit copy of the stairs that the climb uncovers. The stair geometry is the lane's: NS steps from 6 px to 44 px from the right,
   rising 58 % of the lane, so the racers stand on the painted steps. */
const rng=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const hex=(h,j)=>{const n=parseInt(h.slice(1),16),c=[n>>16,n>>8&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(v+(j||0)))));return'rgb('+c.join(',')+')'};
const RUNES=[[2,5,7,2,2],[5,5,2,5,5],[7,4,6,4,7],[2,7,2,2,7],[6,5,6,5,6],[7,1,2,4,7],[5,7,5,5,5],[2,5,5,5,2]];  // 3 × 5 glyphs, one bit per pixel
const PAL={
  you:{wall:'#2a2552',mort:'#1c1840',stone:'#575089',cap:'#8d85bd',capHi:'#c3bdea',moss:['#4f8a4a','#72b35f'],mtn:['#221d48','#2d2759'],flag:['#b33a3a','#f2c14e'],
       lit:{stone:'#e0a83a',mort:'#93620f',cap:'#ffe08a',capHi:'#fffbe0',rune:'#fffbe6',glow:'rgba(255,211,77,.55)'}},
  echo:{wall:'#272049',mort:'#1a1538',stone:'#4f4680',cap:'#8178b5',capHi:'#bdb2ea',moss:['#4a7c6a','#62a08a'],mtn:['#1f1a44','#2a2356'],flag:['#5b3fb0','#d6c4ff'],
       lit:{stone:'#8f6fe0',mort:'#4b3399',cap:'#d6c4ff',capHi:'#ffffff',rune:'#ffffff',glow:'rgba(201,182,255,.6)'}}};
function geo(cw,ch){const x0=3,x1=cw-22,sw=(x1-x0)/NS,top=i=>Math.round(ch*(1-(i+1)/NS*.58));return{x0,x1,sw,top,xs:i=>Math.round(x0+i*sw)}}
function bricks(g,x,y,w,h,P,R,lit){                                   // a block of masonry: offset courses, per-stone tone, mortar, a lit top edge
  const S=lit?P.lit:P;for(let yy=y;yy<y+h;yy+=4){const off=((yy>>2)&1)*4;for(let xx=x-((x+off)%8);xx<x+w;xx+=8){
    const a=Math.max(x,xx),b=Math.min(x+w,xx+8);if(b<=a)continue;const j=(R()-.5)*26;
    g.fillStyle=hex(S.stone,j);g.fillRect(a,yy,b-a,Math.min(4,y+h-yy));
    g.fillStyle=hex(S.stone,j+22);g.fillRect(a,yy,b-a,1);
    g.fillStyle=S.mort;g.fillRect(a,yy+3,b-a,1);if(xx>=x)g.fillRect(xx,yy,1,4)}}}
function stairs(g,cw,ch,P,R,lit){const G=geo(cw,ch),S=lit?P.lit:P;
  for(let i=0;i<=NS;i++){const xa=i<NS?G.xs(i):G.x1,xb=i<NS?G.xs(i+1):cw,y=G.top(Math.min(i,NS-1));
    bricks(g,xa,y,xb-xa,ch-y,P,R,lit);
    g.fillStyle=S.cap;g.fillRect(xa,y,xb-xa,2);g.fillStyle=S.capHi;g.fillRect(xa,y,xb-xa,1);           // the tread's nosing
    g.fillStyle=lit?'rgba(0,0,0,.18)':'#1d1940';g.fillRect(xa,y+2,xb-xa,1);                             // its shadow
    g.fillStyle=S.capHi;g.globalAlpha=.55;g.fillRect(xa,y,1,ch-y);g.globalAlpha=1;                       // moonlit riser edge
    if(i<NS&&xb-xa>=6&&ch-y>=10){const rn=RUNES[i%RUNES.length],rx=xa+Math.round((xb-xa)/2)-1,ry=y+4;   // a carved rune on each step
      for(let r=0;r<5;r++)for(let c=0;c<3;c++)if(rn[r]>>(2-c)&1){
        if(lit){g.fillStyle=S.glow;g.fillRect(rx+c-1,ry+r-1,3,3)}
        g.fillStyle=lit?S.rune:'#221d47';g.fillRect(rx+c,ry+r,1,1);if(!lit){g.fillStyle='#6d65a0';g.fillRect(rx+c+1,ry+r+1,1,1)}}}
    if(!lit&&i<NS)for(let m=0;m<3;m++)if(R()<.45){const mx=xa+1+Math.floor(R()*(xb-xa-2));g.fillStyle=P.moss[m&1];g.fillRect(mx,y-1,1+(R()<.5),1);if(R()<.4)g.fillRect(mx,y-2,1,1)}}}
function paintLane(cv,k,lit){
  const W=cv.parentElement.clientWidth+(lit?50:0),H=cv.parentElement.clientHeight;if(!W||!H)return false;   // the lit copy sits in the reveal, 50 px narrower than the lane
  const full=Math.round(W/2),ch=Math.round(H/2);cv.width=full;cv.height=ch;const g=cv.getContext('2d');if(!g)return false;g.imageSmoothingEnabled=false;
  const P=PAL[k],R=rng(k==='you'?11:23);g.clearRect(0,0,full,ch);
  if(lit){stairs(g,full,ch,P,R,1);return true}
  const G=geo(full,ch);
  for(let L=0;L<2;L++){const base=ch*(L?.62:.56),amp=ch*(L?.18:.3),r2=rng(5+L*7);g.fillStyle=P.mtn[L];   // two mountain ranges
    let y=base-amp*r2();for(let x=0;x<full;x++){y+=(r2()-.5)*(L?1.6:2.4);y=Math.max(base-amp,Math.min(base,y));g.fillRect(x,Math.round(y),1,ch)}}
  const wy=Math.round(ch*.5);g.fillStyle=P.wall;g.fillRect(0,wy,full,ch-wy);                               // the rampart behind the stairs
  for(let x=0;x<full;x+=12){g.fillRect(x,wy-4,6,4);g.fillStyle=P.mort;g.fillRect(x,wy-4,6,1);g.fillStyle=P.wall}
  for(let yy=wy+2;yy<ch;yy+=5){g.fillStyle=P.mort;g.fillRect(0,yy,full,1)}
  for(let x=18;x<G.x1-20;x+=46){g.fillStyle='#120f2a';g.fillRect(x,wy+4,3,6);g.fillStyle='#ffb84d';g.fillRect(x+1,wy+5,1,4);g.fillStyle='rgba(255,184,77,.25)';g.fillRect(x-1,wy+3,5,8)}  // lit arrow slits
  stairs(g,full,ch,P,R,0);
  TORCH.forEach(i=>{const cx=Math.round(G.x0+(i+.5)*G.sw),ty=G.top(i)-8;g.fillStyle='#2b2b33';g.fillRect(cx,ty+2,1,5);g.fillStyle='#6a5430';g.fillRect(cx-1,ty,3,2);g.fillStyle='#3a2c18';g.fillRect(cx-1,ty+2,3,1)}); // iron brackets
  const gx=full-3-15,gt=G.top(NS-1);g.fillStyle='#3c3566';g.fillRect(gx-3,0,3,gt);g.fillRect(full-3,0,3,gt);g.fillRect(gx-3,0,21,2);  // the gate's arch and pillars
  g.fillStyle='#6f67a3';g.fillRect(gx-3,0,1,gt);g.fillRect(full-3,0,1,gt);
  const fx=G.x1-8;g.fillStyle=P.flag[1];g.fillRect(fx,wy-4,1,2);g.fillStyle=P.flag[0];g.fillRect(fx-2,wy-2,5,9);g.fillRect(fx-2,wy+7,2,2);g.fillRect(fx+1,wy+7,2,2); // banner
  g.fillStyle=P.flag[1];g.fillRect(fx-2,wy-2,5,1);g.fillRect(fx,wy+1,1,3);
  if(k==='echo'){for(let y=ch-6;y<ch;y++){g.fillStyle='rgba(169,140,255,'+(.05*(y-ch+7))+')';g.fillRect(0,y,full,1)}}   // the Echo's mist
  return true}
function paintSky(cv){const W=cv.parentElement.clientWidth,H=cv.parentElement.clientHeight;if(!W||!H)return false;
  const cw=Math.round(W/2),ch=Math.round(H/2);cv.width=cw;cv.height=ch;const g=cv.getContext('2d');if(!g)return false;g.imageSmoothingEnabled=false;
  const gr=g.createLinearGradient(0,0,0,ch);gr.addColorStop(0,'#0b1030');gr.addColorStop(.45,'#1c1a4a');gr.addColorStop(.8,'#3a2a5e');gr.addColorStop(1,'#5a3a52');g.fillStyle=gr;g.fillRect(0,0,cw,ch);
  const R=rng(42);for(let n=0;n<cw*ch/90;n++){const x=Math.floor(R()*cw),y=Math.floor(R()*ch*.8),c=['#ffffff','#cfd6ff','#ffe9a8'][n%3];g.globalAlpha=.35+R()*.65;g.fillStyle=c;g.fillRect(x,y,1,1);
    if(R()<.05){g.globalAlpha=.5;g.fillRect(x-1,y,3,1);g.fillRect(x,y-1,1,3)}}g.globalAlpha=1;
  const mx=Math.round(cw*.86),my=Math.max(8,Math.round(ch*.09)+6),mr=8;                              // the moon: halo, disc, shade, craters
  for(let r=mr+6;r>mr;r--){g.fillStyle='rgba(246,231,168,'+(.05)+')';g.beginPath();g.arc(mx,my,r,0,7);g.fill()}
  for(let y=-mr;y<=mr;y++)for(let x=-mr;x<=mr;x++)if(x*x+y*y<=mr*mr){g.fillStyle=x+y>5?'#d6bd6a':x+y<-6?'#fffbe6':'#f2dc93';g.fillRect(mx+x,my+y,1,1)}
  [[-3,-2,2],[2,3,1],[3,-3,1],[-1,4,1]].forEach(([x,y,r])=>{g.fillStyle='#cdb164';g.fillRect(mx+x,my+y,r+1,r+1)});
  for(let c=0;c<3;c++){const cy=Math.round(ch*(.12+c*.1)),cx=Math.round(R()*cw);g.fillStyle='rgba(255,255,255,.06)';g.fillRect(cx,cy,40+R()*40,2);g.fillRect(cx+8,cy-1,24,1)}
  return true}
let paintT=0;
/** Paint every arena canvas whose size changed (or that is new). */
function paint(){clearTimeout(paintT);paintT=0;
  D.querySelectorAll('.dueltrk canvas.duelcv').forEach(cv=>{const p=cv.parentElement,sz=p.clientWidth+'x'+p.clientHeight+(cv.isConnected?'':'-');if(cv.dataset.sz===sz)return;
    let ok=false;try{const k=cv.dataset.k;ok=k==='sky'?paintSky(cv):paintLane(cv,k.slice(k.indexOf('-')+1),k.indexOf('lit')===0)}catch(e){ok=false}
    if(ok){cv.dataset.sz=sz;const tr=cv.closest('.dueltrack');if(tr)tr.classList.add('painted')}})}
const paintSoon=()=>{if(!paintT)paintT=setTimeout(paint,30)};
addEventListener('resize',paintSoon);                                    // seconds of countdown before the replay starts
acts.duelplay=()=>{
  const H=history();settle(H);const c=H.all.find(r=>r.id===A.cid),e=c&&echoFor(H,c,A.mode);if(!c||!e)return;
  stopReplay();const id=c.id+'>'+e.id,sp=speedOf(c,e),res=$i('duel-res'),box=$i('duel-track');if(res)res.classList.remove('won');
  A.rp={id,on:1,p:{c:0,e:0,tc:0,te:0}};
  const cd=box&&box.querySelector('.duelcount');
  const fin1=()=>{A.raf=0;A.rp.on=0;A.rp.p={c:1,e:1,tc:c.secs,te:e.secs};place('you',1,c.secs,c.secs);place('echo',1,e.secs,e.secs);race($i('duel-track'),1,1,c.secs,e.secs,0);
    const k=$i('duel-track');if(k){k.classList.remove('racing');const cc=k.querySelector('.duelcount');if(cc){cc.textContent='';cc.className='duelcount'}}
    const r=$i('duel-res');if(r&&A.result&&A.result.v==='faster')r.classList.add('won');
    const b=D.querySelector('[data-a="duelplay"]');if(b)b.textContent='REPLAY THE DUEL'};
  if(reduced()){fin1();return}
  ['you','echo'].forEach(k=>{place(k,0,0,k==='you'?c.secs:e.secs);const g=$i('duel-'+k);g&&g.querySelector('.duelgate').classList.remove('open')});
  if(box)box.classList.add('racing');
  const b=D.querySelector('[data-a="duelplay"]');if(b)b.textContent='REPLAYING…';
  const t0=performance.now();let ci=-1;
  const step=now=>{
    if(!$i('duel-track')||D.hidden||!A.rp||A.rp.id!==id){stopReplay();const k=$i('duel-track');if(k)k.classList.remove('racing');return}
    const s=(now-t0)/1000;
    if(s<PRE){const n=Math.min(3,Math.floor(s/PRE*4));if(n!==ci&&cd){ci=n;cd.textContent=COUNT[n];cd.className='duelcount go'+n}A.raf=requestAnimationFrame(step);return}
    if(cd&&ci!==4){ci=4;cd.textContent='';cd.className='duelcount'}
    const t=(s-PRE)*sp,pc=math.progress(t,c.secs),pe=math.progress(t,e.secs);
    A.rp.p={c:pc,e:pe,tc:Math.min(t,c.secs),te:Math.min(t,e.secs)};place('you',pc,A.rp.p.tc,c.secs);place('echo',pe,A.rp.p.te,e.secs);race(box,pc,pe,0,0,1);
    if(pc>=1&&pe>=1){fin1();return}A.raf=requestAnimationFrame(step)};
  A.raf=requestAnimationFrame(step)};
CH.duelsid=v=>{A.sid=stairOf(v)?v:'';A.total=0;A.cid='';repaint()};
CH.dueltot=v=>{A.total=+v||0;A.cid='';repaint()};
CH.duelcid=v=>{A.cid=String(v);repaint()};
CH.duelmode=v=>{A.mode=v==='best'?'best':'prev';repaint()};
acts.duelarm=d=>{const H=history(),r=H.all.find(x=>x.id===d.id);if(!r)return;
  if(ARM&&ARM.echo===r.id){ARM=null;keepArm();repaint();toast('The Echo is no longer waiting in Stair Sense.');return}
  ARM={echo:r.id,sid:r.sid,total:r.total,secs:r.secs,done:''};keepArm();
  if(typeof HWCampusData!=='undefined'&&HWCampusData.start(r.sid))setTimeout(()=>{const g=$i('duel-live')||$i('gvtrial');if(g)g.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'})},120);
  else repaint()};
acts.duelgo=()=>{const L=typeof HWGravity!=='undefined'&&HWGravity.live,id=L&&L.sid||A.sid;
  if(id&&typeof HWCampusData!=='undefined'&&HWCampusData.start(id))return;go('campus')};
acts.duelun=()=>{ARM=null;keepArm();stopLive();const n=$i('duel-live');if(n)n.remove()};
acts.duelsee=()=>{if(ARM&&ARM.done){const H=history(),r=H.all.find(x=>x.id===ARM.done);if(r){A.sid=r.sid;A.total=r.total;A.cid=r.id}}go('quests');
  setTimeout(()=>{const n=$i('dueling-arena');if(n)n.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'})},80)};

/* =====================================================================================================================
   THE LIVE DUEL (beside Stair Sense in the Observatory's Details)
   ===================================================================================================================== */
function stopLive(){cancelAnimationFrame(A.lraf);A.lraf=0}
function liveStrip(id){
  if(!ARM||ARM.sid!==id)return '';const H=history(),e=H.all.find(r=>r.id===ARM.echo);
  if(!e)return '<div class="card duel duellv" id="duel-live"><p class="mut">The armed Echo is no longer in your log. <button type="button" class="g sm" data-a="duelun">DISMISS</button></p></div>';
  const L=typeof HWGravity!=='undefined'?HWGravity.live:null,ph=L?L.ph:'idle';
  let st='',p={c:0,e:0,tc:0,te:0};
  if(ARM.done){const c=H.all.find(r=>r.id===ARM.done);
    if(c&&c.total===e.total&&c.sid===e.sid){const v=math.verdict(c.secs,e.secs,Math.max(c.res,e.res));p={c:1,e:1,tc:c.secs,te:e.secs};
      st='<b>'+(v==='faster'?'Faster than your Echo!':v==='slower'?'The Echo was faster this time.':'A tie with your Echo.')+'</b> You '+clk(c.secs)+' · Echo '+clk(e.secs)+'. <button type="button" class="g sm" data-a="duelsee">SEE THE DUEL</button>'}
    else st='<b>Saved.</b> This climb ('+(c?c.total:'?')+' steps) is not the same length as the Echo ('+e.total+' steps), so no winner is declared.'}
  else if(ph==='running'||ph==='paused'){const t=L.ms/1000;
    p={c:L.steps!=null?math.progress(L.steps,e.total):0,e:math.progress(t,e.secs),tc:t,te:Math.min(t,e.secs)};
    st=ph==='paused'?'Paused: both racers wait.':L.steps==null?'Timer only: your progress is not measured, so your knight waits at the start. The Echo moves with the time.':'Your knight moves with the steps Stair Sense counts (an estimate).'}
  else if(ph==='review')st='Climb finished. Check the numbers and save it in Stair Sense above; the result appears after saving.';
  else st='Ready. Press START CLIMB above: the Echo starts with your timer. Climb at a comfortable pace and use the handrail.';
  return '<div class="card duel duellv" id="duel-live" aria-labelledby="duel-lt"><h3 id="duel-lt">'+ico('stairs')+' DUELING ARENA · LIVE</h3>'
    +'<p class="mut duelsm">Echo: '+esc(when(e))+' · '+e.total+' steps · '+clk(e.secs)+'. Time-based replay of its total time.</p>'
    +'<div class="dueltrk" id="duel-track-l">'+scene()+lane('you','You — Champion','live',p.c,ARM.done?p.tc:e.secs,p.tc,'duell')
      +lane('echo','Historical Echo',when(e),p.e,e.secs,p.te,'duell')+'</div>'
    +'<p class="duelsm" id="duel-lst" role="status">'+st+'</p><button type="button" class="g sm" data-a="duelun">STOP RACING THIS ECHO</button></div>'}
/** Run the live lanes while Stair Sense times a climb; stop when it pauses, the strip goes, or the tab is hidden. */
function syncLive(){stopLive();const L=typeof HWGravity!=='undefined'?HWGravity.live:null;if(!ARM||ARM.done||!L||L.ph!=='running'||!$i('duel-live'))return;
  const H=history(),e=H.all.find(r=>r.id===ARM.echo);if(!e)return;let last=-1;
  const step=now=>{const G=HWGravity.live;if(!$i('duel-live')||D.hidden||G.ph!=='running'){stopLive();return}
    if(reduced()&&now-last<1000){A.lraf=requestAnimationFrame(step);return}last=now;
    const t=G.ms/1000,pc=G.steps!=null?math.progress(G.steps,e.total):0,pe=math.progress(t,e.secs);
    place('you',pc,t,e.secs,'duell');place('echo',pe,Math.min(t,e.secs),e.secs,'duell');race($i('duel-track-l'),pc,pe,0,0,G.steps!=null||pe<1?1:0);
    A.lraf=requestAnimationFrame(step)};
  A.lraf=requestAnimationFrame(step)}
const relive=()=>{const n=$i('duel-live'),sid=HWStairs.pick;if(!n||!ARM)return;n.outerHTML=liveStrip(ARM.sid===sid?sid:ARM.sid);paintSoon();syncLive()};
['gvstart','gvpause','gvresume','gvfinish','gvcancel','gvnew'].forEach(k=>{const o=acts[k];if(typeof o!=='function')return;
  acts[k]=function(){const r=o.apply(this,arguments);Promise.resolve(r).then(()=>setTimeout(relive,0));return r}});
// after the Stairs forms and Stair Sense (js/v6-gravity.js wraps logPanel first), only for the armed staircase
{const p=HWStairs.logPanel;HWStairs.logPanel=function(id){const h=p.apply(this,arguments);if(!ARM||ARM.sid!==id)return h;setTimeout(syncLive,0);paintSoon();return h+liveStrip(id)}}
HWEvents.on('entry:added',ev=>{const e=ev.entry;if(!ARM||ARM.done||!e||e.c!=='stair'||!isO(e.m)||e.m.sid!==ARM.sid||!isO(e.m.gv))return;
  ARM.done=String(e.id);keepArm();A.sid=ARM.sid;A.total=+e.v;A.cid=String(e.id);A.mode='prev';setTimeout(relive,0)});
HWEvents.on('page:viewed',e=>{if(e.view!=='quests')stopReplay();if(e.view!=='campus')stopLive()});
D.addEventListener('visibilitychange',()=>{if(D.hidden){stopReplay();stopLive()}else syncLive()});
HWEvents.on('data:reset',()=>{ARM=null;keepArm();A.sid='';A.cid=''});

// the Quests page: directly below the Hall of Heroes (js/v6-board.js appends it last; this script loads after it)
{const p=pages.quests;pages.quests=function(){paintSoon();return p.apply(this,arguments)+card()}}

HWUI.css('duel',`
.duel h3{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.duel{background:linear-gradient(180deg,color-mix(in srgb,var(--vio) 10%,var(--pn)),var(--pn) 40%);position:relative}
.duelintro{margin:0 0 8px;font-size:14px}
.duelset{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:6px 0 10px}.duelset label{display:block;font-size:14px}
.duelset select{width:100%;min-height:44px;box-sizing:border-box;font:15px var(--fn,system-ui,sans-serif)}
.duelwhat{font-size:14px;margin:6px 0}.duelsm{font-size:13px;margin:6px 0}
.dueltrk{position:relative;display:grid;gap:12px;margin:10px 0;padding:12px 10px 10px;border:3px solid var(--ln);border-radius:12px;overflow:hidden;isolation:isolate;
  background:linear-gradient(180deg,#0b1030 0%,#1c1a4a 45%,#3a2a5e 78%,#5a3a52 100%);color:#f3ecd6;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--gold) 45%,transparent),inset 0 -30px 40px -20px #000a}
.dueltrk .duelname small{color:#c8c2e8}
/* the sky: moon, two star fields, a drifting cloud, the castle on its hill */
.duelsky{position:absolute;inset:0;z-index:-1;pointer-events:none}
.duelstars{position:absolute;left:0;top:0;width:2px;height:2px;background:#fff;
  box-shadow:14px 8px #fff,60px 22px #cfd6ff,110px 6px #fff,170px 30px #fff,230px 12px #ffe9a8,300px 26px #fff,360px 8px #cfd6ff,420px 34px #fff,480px 14px #fff,540px 28px #ffe9a8,610px 10px #fff,680px 32px #cfd6ff,740px 6px #fff,800px 24px #fff;
  animation:dueltw 3.2s steps(2) infinite}
.duelstars.b{left:30px;top:16px;animation-delay:-1.6s;opacity:.7}
@keyframes dueltw{50%{opacity:.25}}
.duelcloud{position:absolute;left:-30%;top:22px;width:120px;height:14px;border-radius:8px;background:#ffffff14;box-shadow:40px -7px 0 -2px #ffffff12,80px 2px 0 -3px #ffffff10;animation:duelcl 38s linear infinite}
@keyframes duelcl{to{transform:translateX(140vw)}}
/* each lane: a rune staircase climbing to a crystal gate */
.duellane{position:relative;min-width:0}.duelname{margin:0 0 4px;font-size:14px;display:flex;gap:6px;flex-wrap:wrap;align-items:baseline}
.duelcrown{margin-left:auto;font:700 11px/1 var(--fn,system-ui,sans-serif);letter-spacing:.08em;padding:3px 6px 3px 18px;border:2px solid #f2c14e;color:#ffe08a;background:#2b1f0899;position:relative;opacity:0;transform:translateY(4px) scale(.8);transition:opacity .25s,transform .25s}
.duelcrown:before{content:"";position:absolute;left:4px;top:3px;width:10px;height:7px;background:#f2c14e;clip-path:polygon(0 100%,0 20%,25% 60%,50% 0,75% 60%,100% 20%,100% 100%)}
.duellane.lead .duelcrown{opacity:1;transform:none}
.dueltrack{--th:104px;position:relative;height:var(--th);border:3px solid #0a0718;border-radius:8px;overflow:hidden;background:linear-gradient(180deg,#ffffff0a,#00000033)}
.duelstair{position:absolute;inset:0 44px 0 6px;clip-path:polygon(${(()=>{const N=12,P=['0% 100%'];for(let i=0;i<N;i++){const y=(100-(i+1)/N*58).toFixed(2);P.push((i/N*100).toFixed(2)+'% '+y+'%',((i+1)/N*100).toFixed(2)+'% '+y+'%')}P.push('100% 100%');return P.join(',')})()})}
.duelstone{position:absolute;inset:0;background:repeating-linear-gradient(0deg,#4b4470 0 7px,#3d3760 7px 8px),#443d68}
.duelsteps{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(100%/12 - 3px),#ffffff26 calc(100%/12 - 3px) calc(100%/12))}
.duelcv{position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;pointer-events:none}
.dueltrack.painted .duelstair{display:none}
.duelrev{position:absolute;left:6px;right:44px;top:0;bottom:0;overflow:hidden;will-change:transform}.duelhold{position:absolute;inset:0;will-change:transform}
.duelhold .duelcv{left:-6px;width:calc(100% + 50px)}
.duelfill{position:absolute;left:6px;right:44px;bottom:0;height:3px;transform-origin:0 50%;background:linear-gradient(90deg,#c88a1c,#fff3b0);box-shadow:0 0 6px #f2c14e}
.echo .duelfill{background:linear-gradient(90deg,#5b3fb0,#e6d8ff);box-shadow:0 0 6px #a98cff}
.dueltorch{position:absolute;width:8px;height:12px;margin-left:-4px;pointer-events:none}
.dueltorch b{position:absolute;left:2px;bottom:0;width:4px;height:4px;background:#7a2c10;box-shadow:0 0 3px #ff5a1f66;transition:height .3s,background .3s}
.dueltorch.on b{height:9px;background:linear-gradient(0deg,#ff5a1f,#ffb03b 55%,#fff3b0);clip-path:polygon(50% 0,100% 55%,80% 100%,20% 100%,0 55%);box-shadow:none;transform-origin:50% 100%;animation:duelfl .45s steps(3) infinite alternate}
.dueltorch.on:before{content:"";position:absolute;left:-10px;top:-8px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle,#ffb84d55,transparent 70%)}
.echo .dueltorch.on b{background:linear-gradient(0deg,#6a3fe0,#a98cff 55%,#f4eeff)}.echo .dueltorch.on:before{background:radial-gradient(circle,#a98cff55,transparent 70%)}
@keyframes duelfl{0%{transform:scale(1,1)}50%{transform:scale(.85,1.12) translateX(1px)}100%{transform:scale(1.08,.92)}}
.duelst{position:absolute;left:0;bottom:0;width:6px;height:40%;background:#0a0718}
.duelgate{position:absolute;right:6px;top:4px;width:30px;height:36px;border-radius:50% 50% 4px 4px;border:3px solid #9fe8ff;background:radial-gradient(ellipse at 50% 60%,#e9fbff,#62c8ff 45%,#2a3c9a 80%);
  box-shadow:0 0 10px #62c8ffaa,inset 0 0 8px #fff;animation:duelgt 2.4s ease-in-out infinite alternate}
.echo .duelgate{border-color:#d6c4ff;background:radial-gradient(ellipse at 50% 60%,#f4eeff,#a98cff 45%,#3a2580 80%);box-shadow:0 0 10px #a98cffaa,inset 0 0 8px #fff}
.duelgate b{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px;border-radius:50%;border:2px solid #fff;opacity:0}
.duelgate.open b{animation:duelburst .9s ease-out 1}
.duelgate.open{filter:brightness(1.35)}
@keyframes duelgt{to{box-shadow:0 0 18px #62c8ffdd,inset 0 0 12px #fff}}
@keyframes duelburst{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(7)}}
.duelrail{position:absolute;left:6px;right:84px;top:0;bottom:0}.duelmv{position:absolute;inset:0;will-change:transform}
.duelup{position:absolute;left:0;bottom:calc(var(--th)*.58/12);width:38px;height:calc(var(--th)*.58*11/12);will-change:transform}
.duelup .duelav{bottom:auto;top:calc(100% - 40px)}
.duelav{position:absolute;left:0;bottom:0;width:38px;height:40px;display:block}
.duelav:before{content:"";position:absolute;left:10px;top:4px;width:18px;height:16px;background:#c9ced8;border:2px solid #2b2418;box-shadow:0 18px 0 -2px #b33a3a}
.duelav i{position:absolute;inset:0;background:url(assets/img/kn.webp) center bottom/contain no-repeat;image-rendering:pixelated;transform-origin:50% 100%}
.duelav.echo i,.duelav.echo:before{filter:grayscale(1) brightness(.6) sepia(1) hue-rotate(215deg) saturate(3.5);opacity:.75}
.duelav.echo{filter:drop-shadow(0 0 5px #a98cff) drop-shadow(-9px 0 0 #a98cff40) drop-shadow(-18px 0 0 #a98cff22)}
.duelav.you{filter:drop-shadow(0 0 4px #f2c14e88)}
.dueltrail{position:absolute;right:26px;top:calc(100% - 26px);width:0;height:10px;border-radius:6px;opacity:0;background:linear-gradient(90deg,transparent,#f2c14e);transition:opacity .2s,width .2s}
.echo .dueltrail{background:linear-gradient(90deg,transparent,#a98cff)}
.duellane.run .dueltrail{opacity:.85;width:46px}
.duellane.run .duelav i{animation:duelbob .32s steps(2) infinite}
@keyframes duelbob{50%{transform:translateY(-3px) rotate(-3deg)}}
.duelcount{position:absolute;left:50%;top:50%;z-index:3;transform:translate(-50%,-50%);font:24px/1 var(--fh);color:#fff3b0;text-shadow:3px 3px 0 #2b1f08,0 0 16px #f2c14e;pointer-events:none}
.duelcount.go0,.duelcount.go1,.duelcount.go2,.duelcount.go3{animation:duelcd .4s ease-out 1}
.duelcount.go3{color:#9fe8ff;text-shadow:3px 3px 0 #0a1840,0 0 16px #62c8ff}
@keyframes duelcd{0%{transform:translate(-50%,-50%) scale(2.2);opacity:0}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
.duelgap{position:absolute;left:50%;top:6px;transform:translateX(-50%);white-space:nowrap;z-index:2;font:700 12px var(--fn,system-ui,sans-serif);color:#ffe08a;text-shadow:1px 1px 0 #000}
.dueltrk.racing .duelname small{opacity:.6}
.dueltime{margin:2px 0 0;font-size:13px;text-align:right;font-variant-numeric:tabular-nums;color:#f3ecd6}
.duelbtns{gap:8px;margin:8px 0}.duelbtns button{flex:1 1 180px;min-height:48px}
.duelres{position:relative;margin:10px 0;padding:10px;border:3px solid var(--ln);border-radius:10px;background:var(--p2);overflow:hidden}
.duelres.faster{border-color:var(--gold)}.duelres.pb{box-shadow:0 0 0 3px color-mix(in srgb,var(--gold) 60%,transparent)}
.duelres p{margin:0 0 6px}.duelrh{font-size:16px}.duelmed{display:flex;gap:8px;align-items:flex-start;font-size:14px}
.duelrunes{position:absolute;inset:0;pointer-events:none}.duelrunes u{position:absolute;bottom:-12px;width:8px;height:8px;background:var(--gold);opacity:0;transform:rotate(45deg)}
.duelres.won{animation:duelgold 1.2s ease-out 1}.duelres.won .duelrunes u{animation:duelrune 1.4s ease-out 1 forwards}
${[8,20,32,44,56,68,80,92].map((x,i)=>'.duelrunes u:nth-child('+(i+1)+'){left:'+x+'%;animation-delay:'+(i%4*.08)+'s}').join('')}
@keyframes duelgold{0%{background:color-mix(in srgb,var(--gold) 45%,var(--p2))}100%{background:var(--p2)}}
@keyframes duelrune{0%{opacity:0;transform:translateY(0) rotate(45deg)}30%{opacity:1}100%{opacity:0;transform:translateY(-70px) rotate(225deg)}}
.duelempty{display:flex;gap:12px;align-items:flex-start}.duelempty .duelav{position:relative;flex:0 0 auto}.duelempty p{margin:0 0 6px}
.duelresult.first{padding:10px;border:3px dashed var(--ln);border-radius:10px;margin:8px 0}
.duellive{padding:6px 8px;border:3px solid var(--blue);background:var(--p2);font-size:13px}
.dueltab{width:100%;min-width:0;table-layout:fixed}.dueltab caption{text-align:left;padding-bottom:4px}.dueltab th[scope=row]{text-align:left;font-weight:600;white-space:normal;overflow-wrap:anywhere;width:46%}.dueltab td{overflow-wrap:anywhere}.dueltab th small{display:block;font-weight:400;font-size:12px;color:var(--mut)}
.dueltab td{font-variant-numeric:tabular-nums}.duelna{color:var(--mut)}
.duellv{margin-top:10px}
@media(max-width:420px){.dueltrack{--th:100px}.duelmoon{width:22px;height:22px}.duelcastle{width:110px;height:52px}.duelcount{font-size:16px}}
.duelres.pb:before{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,#fff3b066 48%,transparent 66%);transform:translateX(-100%);animation:duelshine 2.8s ease-in-out infinite;pointer-events:none}
@keyframes duelshine{60%,100%{transform:translateX(100%)}}
.duelres.pb .duelrh b{background:linear-gradient(90deg,#f2c14e,#fff3b0,#f2c14e);-webkit-background-clip:text;background-clip:text;color:transparent}
@media(prefers-reduced-motion:reduce){.duelres.won,.duelres.won .duelrunes u,.duelstars,.duelcloud,.duelgate,.duelgate.open b,.duellane.run .duelav i,.duelcount,.duelres.pb:before,.dueltorch.on b{animation:none!important}.duelcrown,.dueltrail{transition:none}}
.hw-rm .duelres.won,.hw-rm .duelres.won .duelrunes u,.hw-rm .duelstars,.hw-rm .duelcloud,.hw-rm .duelgate,.hw-rm .duelgate.open b,.hw-rm .duellane.run .duelav i,.hw-rm .duelcount,.hw-rm .duelres.pb:before,.hw-still .duelres.won,.hw-still .duelres.won .duelrunes u,.hw-still .duelstars,.hw-still .duelcloud,.hw-still .duelgate,.hw-still .duelgate.open b,.hw-still .duellane.run .duelav i,.hw-still .duelcount,.hw-still .duelres.pb:before{animation:none!important}
.hw-rm .dueltorch.on b,.hw-still .dueltorch.on b{animation:none!important}
.hw-hidden .duelstars,.hw-hidden .duelcloud,.hw-hidden .duelgate,.hw-hidden .dueltorch b{animation-play-state:paused}
`);
return{math,history,echoFor,isBest,metrics,card,repaint,get armed(){return ARM?Object.assign({},ARM):null},get state(){return{sid:A.sid,total:A.total,cid:A.cid,mode:A.mode,replaying:!!(A.rp&&A.rp.on),raf:A.raf,lraf:A.lraf,result:A.result}}}})();
