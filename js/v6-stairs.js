/* v6 (stairs refactor): one Stairs page for stair climbing, workouts, heart rate and running. Not part of the original.
   The old Pulse page and the separate Running page are retired from the navigation. Their routes still work and open
   the matching section here ('pulse' → the Workout, 'run' → Running), so every old link, map node, quest and saved
   reference lands somewhere sensible.

   Sections (in page order)
     1. CASUAL CLIMBING (no heading, one help line) · GPS check-in (js/v6-gps.js) and logging a climb by hand.
     2. TRIAL OF BREATH · stair workout: Pace & Breathe (the original rhythm guide, now also the workout timer),
        heart rate BEFORE and AFTER (typed in by the user, drawn as two traces), stairs, time and a calorie ESTIMATE.
     3. RUNNING ROAD · the GPS run tracker (js/v6-running.js), unchanged apart from where it is shown.
   Below the workout: the heart-rate chart of recent workouts and the Session Chronicle, one list for every session.

   One data model. Every session, however it was logged, is a normal 'stair' entry in st.e (value = total steps):
     m = {sid, loc, diff, floor, angle, lat, lng,      the stairway (STAIRS); lat/lng only when the stairway has them
          steps, climbs,                               steps per climb × number of climbs
          kind: 'casual' | 'workout', src: 'gps' | 'manual'  (chk:'gps' kept for older readers)
          pace, dur (min, 0 = not recorded),           workouts: pace chosen, minutes from the timer or typed
          hrB, hrA (BPM | null), hrS: 'manual' | 'device' | 'mixed',  heart rate before / after: typed in, or a steady
                                                       average from a Bluetooth heart-rate device (js/v6-hr.js)
          hrLo, hrAv, hrHi (BPM | null),               optional: lowest / average / highest during the climb (recorded
                                                       from the device while the timer runs, or typed in)
          hrPct (number | null),                       peak (highest of hrHi / hrA) as % of 220 − age at save time (rough)
          hrDev: {b, a, c} (only when a device was used): which numbers came from the device; such entries also
                                                       carry src: 'device' and show a pixel watch icon
          kcal: {v, lo, hi, m} | null}                 calorie estimate at save time (method m, see estimate())
   Older entries are read through session(), which infers kind and src from the fields they have, so nothing is
   rewritten in storage. No pulse entries are created any more; old 'pulse' entries stay in the save (and backups)
   untouched but are no longer listed. Heart rate shown anywhere now comes from stair sessions only.

   Never fabricated: a heart rate is only shown when the user typed it in or chose USE AS BEFORE / AFTER on a reading; the calorie estimate appears only when the
   profile (age, sex, height, weight) has been confirmed by the user and a workout time exists. */
const HWStairs=(()=>{
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const num=v=>v==null||v===''||!isFinite(+v)?null:+v;
const okHR=v=>{v=num(v);return v!=null&&v>=30&&v<=220?Math.round(v):null};
const hasHR=typeof HWHR!=='undefined';
// 2024 Adult Compendium of Physical Activities: 17133 stair climbing slow pace 4.5, 17131 general 6.8, 17134 fast pace 9.3
const MET={Easy:4.5,Moderate:6.8,Vigorous:9.3};
const PN=()=>PACES.map(p=>p[1]);
const DK='hw_wk_draft'; // the workout being prepared: this tab only (sessionStorage), cleared on save

/* ---------- the unified session ---------- */
/** Any stair entry, old or new → one shape. */
function session(e){const m=isO(e&&e.m)?e.m:{},dur=num(m.dur)>0?+m.dur:0,hrB=okHR(m.hrB),hrA=okHR(m.hrA);
  const kind=m.kind==='workout'||m.kind==='casual'?m.kind:(hrB||hrA||dur?'workout':'casual');
  return{id:e.id,d:e.d,t:e.t,kind,src:m.src==='gps'||m.chk==='gps'?'gps':'manual',sid:m.sid||null,loc:m.loc||'Stairway',diff:m.diff||null,
    floor:m.floor||'',lat:num(m.lat),lng:num(m.lng),steps:+m.steps||0,climbs:+m.climbs||0,total:+e.v||0,dur,
    pace:PN().includes(m.pace)?m.pace:null,hrB,hrA,kcal:isO(m.kcal)&&+m.kcal.v>0?m.kcal:null,
    hrLo:okHR(m.hrLo),hrAv:okHR(m.hrAv),hrHi:okHR(m.hrHi),hrPct:num(m.hrPct),dev:isO(m.hrDev)?m.hrDev:m.src==='device'?{b:1,a:1}:null}}
const all=()=>LC('stair').map(session);
/** The record for a new session: the stairway, the counts, and only the fields that were really given. */
function record(q,o){return{sid:q.id,loc:q.name,diff:q.cat,floor:q.floor,angle:q.angle,lat:q.lat,lng:q.lng,steps:o.steps,climbs:o.climbs,
  kind:o.kind,src:o.src,chk:o.src==='gps'?'gps':undefined,pace:o.pace||null,dur:o.dur||0,hrB:o.hrB||null,hrA:o.hrA||null,
  hrS:o.hrS||(o.hrB||o.hrA?'manual':undefined),kcal:o.kcal||null,
  hrLo:o.hrLo||undefined,hrAv:o.hrAv||undefined,hrHi:o.hrHi||undefined,hrPct:o.hrPct||undefined,hrDev:o.hrDev||undefined}}

/* ---------- profile + calorie estimate ---------- */
/** The user's confirmed body data, or null. Confirmed = sealed in onboarding or saved on this page; app defaults never count. */
function profile(){const p=st.p||{},ok=!!(st.s.onb||p.cfm),a=+p.age,w=+p.w,h=+p.h;
  return ok&&a>=10&&a<=100&&w>=20&&w<=300&&h>=100&&h<=230&&(p.sex==='m'||p.sex==='f')?{age:a,w,h,sex:p.sex}:null}
/** Estimated kcal for a stair workout.
    A: MET (stair climbing at the chosen pace) × the user's resting energy per minute (Mifflin-St Jeor BMR ÷ 1440) × minutes.
    B (only with an after-workout heart rate of 90–180 BPM): Keytel et al. 2005, J Sports Sci 23:289, kJ/min from heart
    rate, weight, age and sex, ÷ 4.184. The estimate is the mean of the methods used; lo–hi is their spread.
    → {v, lo, hi, m:'met'|'met+hr', minor} or {need:'profile'|'duration'|'pace'}. */
function estimate(o,P){P=P===undefined?profile():P;if(!P)return{need:'profile'};if(!(+o.dur>0))return{need:'duration'};const met=MET[o.pace];if(!met)return{need:'pace'};
  const bmr=10*P.w+6.25*P.h-5*P.age+(P.sex==='m'?5:-161),a=met*bmr/1440*o.dur,hr=okHR(o.hrA);let b=null;
  if(hr&&hr>=90&&hr<=180){const kj=P.sex==='m'?-55.0969+.6309*hr+.1988*P.w+.2017*P.age:-20.4022+.4472*hr-.1263*P.w+.074*P.age;if(kj>0)b=kj/4.184*o.dur}
  const v=b==null?[a]:[a,b];return{v:Math.round(avg(v)),lo:Math.round(Math.min(...v)),hi:Math.round(Math.max(...v)),m:b==null?'met':'met+hr',minor:P.age<18}}

/* ---------- page state (memory; the workout draft also survives a refresh of this tab) ---------- */
let pick=null; // id of the stairway the user chose (or checked in at); nothing is pre-selected
const C={steps:'',climbs:'',d:'',t:''};
// hrBd/hrAd: that number came from the device; cLo/cAv/cHi: climb heart rate (cSet: typed in, cDev: recorded, cl: running tally)
const W0=()=>({hrB:'',hrA:'',steps:'',climbs:'',dur:'',durSet:0,ms:0,since:null,hrBd:0,hrAd:0,cLo:'',cAv:'',cHi:'',cSet:0,cDev:0,cl:null});
let W=(()=>{try{const o=JSON.parse(sessionStorage.getItem(DK)||'null');return isO(o)?Object.assign(W0(),o,{since:null}):W0()}catch(e){return W0()}})();
const keepW=()=>{try{sessionStorage.setItem(DK,JSON.stringify(W))}catch(e){}};
const stair=()=>STAIRS.find(s=>s.id===pick)||null;
const secsW=()=>(W.ms+(W.since?Date.now()-W.since:0))/1000;
const mins=s=>Math.round(s/30)/2; // whole half-minutes
const two=n=>(n<10?'0':'')+n,clock=s=>{s=Math.floor(s);return Math.floor(s/60)+':'+two(s%60)};
const durW=()=>W.durSet?num(W.dur):(secsW()>=30?mins(secsW()):null);
const ico=(n,s)=>HWPixel.icon(n,s||1);
const btn=(a,t,cls,x)=>'<button class="'+(cls||'')+'" data-a="'+a+'"'+(x||'')+'>'+t+'</button>';
const CATN={MILD:'Mild',MODERATE:'Moderate',VIGOROUS:'Vigorous'};
// intensity band from a stairway's stored angle θ (degrees): mild < 26°, moderate 26–31.2°, vigorous > 31.2°
const BAND_RANGE={MILD:'< 26°',MODERATE:'26–31.2°',VIGOROUS:'> 31.2°'};
const bandOf=a=>a<26?'MILD':a<=31.2?'MODERATE':'VIGOROUS';
const deg=a=>(+a).toFixed(2)+'°';
const GOAL=100; // steps a day: this app's default personal goal, not a health measurement or guideline

/* ---------- pieces ---------- */
function hud(){const d=today(),R=rng(7),L=all(),wk=L.filter(s=>R.includes(s.d)),n=sp(d),last=L.filter(s=>s.kind==='workout'&&(s.hrB||s.hrA)).pop();
  const t=(ic,v,u,l)=>'<div class="ststat"><span class="stsv">'+ico(ic)+'<b>'+v+'</b> <small>'+u+'</small></span><span class="stsl">'+l+'</span></div>';
  return '<div class="ststats" role="group" aria-label="Stair activity summary">'
    +t('stairs',n,'steps','Today')+t('quest',wk.length,'sessions','Last 7 days')+t('energy',wk.filter(s=>s.kind==='workout').length,'workouts','Last 7 days')
    +t('heart',last?(last.hrB||'–')+' → '+(last.hrA||'–'):'–','BPM','Last workout: before → after')+'</div>'
    +'<div class="stgoal"><small>Personal goal: '+Math.min(n,GOAL)+' of '+GOAL+' steps today. Source: default set by this app. It is not a health measurement or a recommendation.</small>'+bar(n/GOAL*100,'var(--grn)')+'</div>'
    +'<div class="stjump" role="navigation" aria-label="Sections of this page">'+[['st-workout','energy','Workout and heart rate'],['st-run','running','Run tracker']].map(x=>btn('stjump',ico(x[1])+' '+x[2],'g sm',' data-t="'+x[0]+'"')).join('')+'</div>'}
const head=(id,icon,name,plain,line)=>'<div class="sthd" id="'+id+'">'+ico(icon,2)+'<div><b>'+name+'</b><span class="pxtag">'+plain+'</span><small>'+line+'</small></div></div>';

function picker(){const q=stair();
  return '<div class="row stcats">'+CATS.map(c=>btn('cat',CATN[c[1]]+'<br><small>'+BAND_RANGE[c[1]]+' · '+stairsOf(c[1]).length+' stairways</small>','chip'+(S.cat===c[1]?' on':''),' data-c="'+c[1]+'"')).join('')+'</div>'
    +'<div class="sqlist">'+stairsOf(S.cat).map(s=>'<button class="chip '+(q===s?'on':'')+'" data-a="loc" data-i="'+STAIRS.indexOf(s)+'"'+(q===s?' aria-pressed="true"':'')+'><span class="sqn">'+esc(s.name)+'</span><span class="sqf">'+esc(s.floor)+' · θ '+deg(s.angle)+' · '+CATN[bandOf(s.angle)]+'</span></button>').join('')+'</div>'
    +'<p class="stnote mut">'+STAIRS.length+' stairways at Kolej MARA Kulim: '+CATS.map(c=>CATN[c[1]]+' '+stairsOf(c[1]).length).join(' + ')+'. Bands by angle: '+CATS.map(c=>CATN[c[1]]+' '+BAND_RANGE[c[1]]).join(', ')+'. θ = tan⁻¹(rise ÷ run), estimated from the stairway\'s stored data. It is an estimate, not a measurement.</p>'
    +'<p class="stloc">'+ico('map')+' '+(q?'<b>'+esc(q.name)+'</b> · '+CATN[bandOf(q.angle)]+' · θ '+deg(q.angle)+' · '+(hasXY(q)?q.lat.toFixed(5)+', '+q.lng.toFixed(5):'no map coordinates'):'<span class="mut">No stairway chosen yet. Tap one above, or check in by GPS.</span>')+'</p>'}
function casual(){const tot=(+C.steps||0)*(+C.climbs||0);
  return '<div class="card stcard" id="stman"><h3>'+ico('scroll')+' LOG A CLIMB BY HAND</h3>'+picker()
    +'<div class="row"><label>Steps per climb<input id="ss" data-in="stc" type="number" min="1" max="1000" inputmode="numeric" value="'+esc(C.steps)+'"></label><label>Number of climbs<input id="sc" data-in="stc" type="number" min="1" max="500" inputmode="numeric" value="'+esc(C.climbs)+'"></label></div>'
    +'<p>Total: <b class="big" id="tot">'+tot+'</b> steps</p>'
    +HWWhen.html({id:'stair',cats:['stair']})
    +btn('savestair','SAVE CLIMB','stsave')+'</div>'}

// heart-rate trace for one moment of the workout
function trace(k,v){const B=k==='b',L=B?'BEFORE WORKOUT':'AFTER WORKOUT';
  return '<div class="sthr '+(B?'b':'a')+'"><div class="sthrh">'+ico('heart')+'<b>'+L+'</b></div>'
    +'<canvas class="sttr" id="st-tr-'+k+'" data-bpm="'+(v||'')+'" data-k="'+k+'" role="img" aria-label="'+L+' heart rate: '+(v?v+' BPM, typed in by you':'not entered')+'"></canvas>'
    +'<label>'+(B?'Before you start':'Right after you stop')+' (BPM)<input id="wk-'+k+'" data-in="stw" type="number" min="30" max="220" inputmode="numeric" value="'+esc(B?W.hrB:W.hrA)+'"></label>'
    +'<small class="mut" id="st-hs-'+k+'">'+hsTxt(k,v)+'</small>'+(B?'<small class="strest" id="st-rest" role="status">'+restTxt(v)+'</small>':'')+'</div>'}
const devK=k=>!!(k==='b'?W.hrBd:W.hrAd);
const hsTxt=(k,v)=>v?(devK(k)?ico('watch',{label:'From your watch'})+' Steady average from your heart-rate device.':'Counted and typed in by you.'):'Not entered. Count beats for 15 s at wrist or neck and multiply by 4.';
// the before-workout number is taken at rest: outside 50–100 BPM gets a plain, non-diagnostic note
const restTxt=v=>v&&(v<50||v>100)?ico('warning')+' Outside the usual resting range; see a doctor if you feel unwell or it persists.':'';
const ageOf=()=>{const p=st.p||{},a=+p.age;return(st.s.onb||p.cfm)&&a>=10&&a<=100?Math.round(a):null};
/** Peak heart rate (highest of climb max and after) as % of 220 − age, or null. A rough estimate only. */
function peak(hi,a,age){const pk=Math.max(okHR(hi)||0,okHR(a)||0);age=age===undefined?ageOf():age;return pk&&age?{pk,max:220-age,pct:Math.round(pk/(220-age)*100)}:pk?{pk}:null}
function peakTxt(){const p=peak(W.cHi,W.hrA);if(!p)return'<span class="mut">Add the highest heart rate during the climb (or the after-workout number) to compare it with an estimated maximum.</span>';
  if(!p.max)return'Peak <b>'+p.pk+'</b> BPM. <span class="mut">Add your age in the profile below to compare it with an estimated maximum.</span>';
  return'Peak <b>'+p.pk+'</b> BPM ≈ <b>'+p.pct+'%</b> of 220 − age ('+p.max+' BPM). <span class="mut">A rough estimate: for many people the real maximum is 10–20 BPM above or below this formula.</span>'}
const cNote=()=>W.cDev&&W.cl?ico('watch',{label:'From your watch'})+' Recorded by your heart-rate device while the timer ran ('+W.cl.n+' readings).':W.cSet?'Typed in by you.':'Optional. Type them in, or connect a device: it records them while the workout timer runs.';
function climbHR(){const f=(id,l,v)=>'<label>'+l+'<input id="'+id+'" data-in="stw" type="number" min="30" max="220" inputmode="numeric" value="'+esc(v)+'"></label>';
  return '<div class="stclimb" id="st-climb"><b>'+ico('heart')+' DURING THE CLIMB <span class="pxtag">OPTIONAL</span></b>'
    +'<div class="row">'+f('wk-lo','Lowest (BPM)',W.cLo)+f('wk-av','Average',W.cAv)+f('wk-hi','Highest',W.cHi)+'</div>'
    +'<small class="mut" id="st-cn">'+cNote()+'</small><p id="st-peak">'+peakTxt()+'</p></div>'}
function delta(){const b=okHR(W.hrB),a=okHR(W.hrA);return b&&a?'Your heart rate went from <b>'+b+'</b> to <b>'+a+'</b> BPM ('+(a-b>=0?'+':'')+(a-b)+').':'Enter both numbers to compare before and after.'}

function kcalBox(){const P=profile(),e=estimate({pace:PACES[S.pb.pace][1],dur:durW(),hrA:W.hrA},P);
  if(e.need==='profile')return '<div class="stkc need"><b>'+ico('warning')+' CALORIE ESTIMATE NEEDS YOUR PROFILE</b><p class="mut">Age, sex, height and weight are needed. HealthWiz never guesses them.</p>'
    +'<div class="row"><label>Age<input id="pf-a" type="number" min="10" max="100" inputmode="numeric" value="'+(st.p.cfm||st.s.onb?esc(st.p.age):'')+'"></label><label>Sex<select id="pf-s"><option value="">choose</option><option value="m"'+((st.p.cfm||st.s.onb)&&st.p.sex==='m'?' selected':'')+'>Male</option><option value="f"'+((st.p.cfm||st.s.onb)&&st.p.sex==='f'?' selected':'')+'>Female</option></select></label></div>'
    +'<div class="row"><label>Height (cm)<input id="pf-h" type="number" min="100" max="230" inputmode="decimal" value="'+(st.p.cfm||st.s.onb?esc(st.p.h):'')+'"></label><label>Weight (kg)<input id="pf-w" type="number" min="20" max="300" inputmode="decimal" value="'+(st.p.cfm||st.s.onb?esc(st.p.w):'')+'"></label></div>'
    +btn('stprof','SAVE PROFILE','sm')+'</div>';
  if(e.need==='duration')return '<div class="stkc need"><b>'+ico('energy')+' CALORIE ESTIMATE</b><p class="mut">Use the Pace & Breathe timer, or type the workout time, to see an estimate.</p></div>';
  return '<div class="stkc"><b>'+ico('energy')+' ESTIMATED ENERGY USED</b><p><b class="big">≈ '+e.v+'</b> kcal'+(e.lo!==e.hi?' <span class="mut">(range '+e.lo+'–'+e.hi+')</span>':'')+'</p>'
    +'<small class="mut">An estimate, not a measurement. From '+(e.m==='met+hr'?'stair-climbing intensity at your pace and your after-workout heart rate':'stair-climbing intensity at your pace (add an after-workout heart rate of 90–180 BPM for a second method)')
    +', with your age, sex, height and weight. Real values can differ a lot'+(e.minor?'; these formulas come from adult studies, so for under-18s it is only a rough guide':'')+'.</small></div>'}

function workout(){const P=PACES[S.pb.pace],q=stair(),run=!!S.pb.on,ds=durW();
  let cl=climber().replace(/<small>[\s\S]*<\/small>$/,'');
  return '<div class="card stcard"><h2>PACE & BREATHE</h2>'
    +'<label>Stairway<select id="wk-loc" data-ch="stloc"><option value="">Choose a stairway</option>'+CATS.map(c=>'<optgroup label="'+CATN[c[1]]+'">'+stairsOf(c[1]).map(s=>'<option value="'+s.id+'"'+(q===s?' selected':'')+'>'+esc(s.name)+' ('+s.angle.toFixed(1)+'°)</option>').join('')+'</optgroup>').join('')+'</select></label>'
    +'<p>Choose your pace</p><div class="row">'+PACES.map((p,i)=>btn('pace',p[1],'chip'+(S.pb.pace===i?' on':''),' data-i="'+i+'"')).join('')+'</div>PACE'+bar(P[4],'var(--grn)')
    +cl+'<small>'+(q?esc(q.name)+' ('+CATN[q.cat]+'): ':'')+'your hero takes one step per breath count at the '+P[1]+' pace.</small>'
    +'<div id="bz" style="text-align:center">'+(run?bz():'<p class="mut">Press start for the rhythm guide. It also times your workout.</p>')+'</div>'
    +'<div class="sttimer"><small>WORKOUT TIME</small><b class="num" id="wk-time" role="timer">'+clock(secsW())+'</b></div>'
    +'<div class="row" style="margin-top:10px">'+(run?btn('slow','SLOW DOWN','g')+'<button data-a="pstop" style="background:var(--red);color:#fff">STOP ACTIVITY</button>':btn('pstart',W.ms?'RESUME':'START'))+'</div>'
    +'<div class="warn">Stop right away if you feel dizzy, faint, have chest pain or severe breathlessness, and seek medical attention. You never have to keep this pace.</div></div>'
    +'<div class="card stcard" id="sthrc"><h3>'+ico('heart')+' HEART RATE · THIS WORKOUT '+HWHelp.btn('hrpic')+'</h3><p class="mut">Count your pulse before you start and again right after you stop, or read it from a heart-rate device. Only numbers you type in or choose to use are saved.</p>'
    +(hasHR?HWHR.panel():'')
    +'<div class="sthrs">'+trace('b',okHR(W.hrB))+trace('a',okHR(W.hrA))+'</div><p id="st-delta">'+delta()+'</p>'+climbHR()+'</div>'
    +'<div class="card stcard" id="stseal"><h3>'+ico('achievement')+' SEAL THE WORKOUT</h3>'+HWWhen.html({id:'wk',cats:['stair'],hint:'Heart rates read from a device are saved at the time they were taken, so a workout using them is saved for today.'})
    +'<div class="row"><label>Steps per climb<input id="wk-s" data-in="stw" type="number" min="1" max="1000" inputmode="numeric" value="'+esc(W.steps)+'"></label><label>Number of climbs<input id="wk-c" data-in="stw" type="number" min="1" max="500" inputmode="numeric" value="'+esc(W.climbs)+'"></label></div>'
    +'<label>Workout time (min)<input id="wk-d" data-in="stw" type="number" min="0.5" max="300" step="0.5" inputmode="decimal" placeholder="minutes" value="'+(ds!=null?ds:'')+'"></label><small class="mut" id="wk-dn">'+(W.durSet?'Typed in by you.':ds!=null?'From the Pace & Breathe timer.':'')+'</small>'
    +'<div id="wk-kcal">'+kcalBox()+'</div><div class="row stbtns">'+btn('stwsave','SAVE WORKOUT')+btn('stwreset','CLEAR','g')+'</div></div>'}

// heart rate of recent workouts: one column per workout, before (circle) and after (square) joined by a line
function chart(){const L=all().filter(s=>s.kind==='workout'&&(s.hrB||s.hrA)).slice(-10);
  if(!L.length)return '<div class="card" id="sthrg"><h3>'+ico('chart')+' HEART RATE · RECENT WORKOUTS</h3><p class="mut">No workout heart rates yet. Enter them above when you save a workout.</p></div>';
  const V=L.flatMap(s=>[s.hrB,s.hrA]).filter(Boolean),lo=Math.max(30,Math.floor((Math.min(...V)-10)/10)*10),hi=Math.min(220,Math.ceil((Math.max(...V)+10)/10)*10),
    Wd=320,H=150,l=34,r=8,t=10,b=22,x=i=>l+(i+.5)*(Wd-l-r)/L.length,y=v=>t+(hi-v)/(hi-lo)*(H-t-b),ticks=[lo,Math.round((lo+hi)/20)*10,hi];
  let g='<svg viewBox="0 0 '+Wd+' '+H+'" class="sthrsvg" role="img" aria-label="Heart rate before and after your last '+L.length+' workouts">'
    +ticks.map(v=>'<line x1="'+l+'" x2="'+(Wd-r)+'" y1="'+y(v)+'" y2="'+y(v)+'" class="gl"/><text x="'+(l-4)+'" y="'+(y(v)+3)+'" text-anchor="end">'+v+'</text>').join('');
  L.forEach((s,i)=>{const X=x(i),tip=s.d+' '+s.t+' · before '+(s.hrB||'–')+' · after '+(s.hrA||'–')+' BPM';
    g+='<g class="pt" tabindex="0"><title>'+esc(tip)+'</title><rect x="'+(X-12)+'" y="'+t+'" width="24" height="'+(H-t-b)+'" fill="transparent"/>'
      +(s.hrB&&s.hrA?'<line x1="'+X+'" x2="'+X+'" y1="'+y(s.hrB)+'" y2="'+y(s.hrA)+'" class="jn"/>':'')
      +(s.hrB?'<circle cx="'+X+'" cy="'+y(s.hrB)+'" r="4.5" class="hb"/>':'')+(s.hrA?'<rect x="'+(X-4.5)+'" y="'+(y(s.hrA)-4.5)+'" width="9" height="9" class="ha"/>':'')
      +'<text x="'+X+'" y="'+(H-6)+'" text-anchor="middle">'+esc(String(s.d).slice(8))+'</text></g>'});
  g+='</svg>';
  return '<div class="card" id="sthrg"><h3>'+ico('chart')+' HEART RATE · RECENT WORKOUTS</h3><div class="stleg"><span><i class="hb"></i>Before</span><span><i class="ha"></i>After</span><small class="mut">BPM · day of month below</small></div>'+g
    +'<details><summary>Show as a table</summary><table class="sttab"><tr><th>Date</th><th>Before</th><th>After</th></tr>'+L.slice().reverse().map(s=>'<tr><td>'+esc(s.d+' '+s.t)+'</td><td>'+(s.hrB||'–')+'</td><td>'+(s.hrA||'–')+'</td></tr>').join('')+'</table></details></div>'}

function sessCard(s){const w=s.kind==='workout',mx=Math.max(s.hrB||0,s.hrA||0,1);
  return '<div class="stses '+(w?'w':'c')+'"><div class="stsi">'+ico(w?'energy':'stairs',2)+'</div><div class="stsb"><b>'+esc(s.loc)+'</b>'
    +'<small>'+esc(s.d)+' · '+esc(s.t)+'</small><div class="ststags"><span class="pxtag">'+(w?'WORKOUT':'CASUAL')+'</span><span class="pxtag">'+(s.src==='gps'?'GPS CHECK-IN':'BY HAND')+'</span>'+(s.pace?'<span class="pxtag">'+s.pace.toUpperCase()+'</span>':'')+(s.dev?'<span class="pxtag">'+ico('watch',{label:'Heart rate from a smartwatch'})+'WATCH</span>':'')+'</div>'
    +'<p><b>'+s.total+'</b> steps'+(s.climbs&&s.climbs*s.steps===s.total?' ('+s.climbs+' × '+s.steps+')':'')+(s.dur?' · '+s.dur+' min':'')+(s.kcal?' · ≈'+s.kcal.v+' kcal est.':'')+'</p>'
    +(s.hrB||s.hrA?'<div class="stsh"><span>Before</span>'+bar((s.hrB||0)/mx*100,'var(--blue)')+'<b>'+(s.hrB||'–')+(s.dev&&s.dev.b&&s.hrB?ico('watch',{label:'from your watch'}):'')+'</b><span>After</span>'+bar((s.hrA||0)/mx*100,'var(--red)')+'<b>'+(s.hrA||'–')+(s.dev&&s.dev.a&&s.hrA?ico('watch',{label:'from your watch'}):'')+'</b></div>':'')
    +(s.hrHi||s.hrAv||s.hrLo?'<p class="mut">Climb: '+(s.hrLo||'–')+' / '+(s.hrAv||'–')+' / '+(s.hrHi||'–')+' BPM <small>(low / avg / high)</small>'+(s.dev&&s.dev.c?' '+ico('watch',{label:'recorded by your watch'}):'')+(s.hrPct?' · peak ≈'+Math.round(s.hrPct)+'% of est. max <small>(rough)</small>':'')+'</p>':'')
    +'</div><div class="stsa"><button class="sm g" aria-label="Edit" data-a="edit" data-id="'+esc(s.id)+'">✏️</button><button class="sm g" aria-label="Delete" data-a="del" data-id="'+esc(s.id)+'">🗑️</button></div></div>'}
function chronicle(){const L=all().slice(-10).reverse();
  return '<div class="card" id="stlog"><h3>'+ico('scroll')+' SESSION CHRONICLE</h3><p class="mut">Every stair session in one place: GPS check-ins, climbs logged by hand and workouts.</p>'
    +(L.length?L.map(sessCard).join(''):'<p class="mut">No sessions yet.</p>')+'</div>'}

pages.stair=()=>{const g=typeof HWGps!=='undefined'?HWGps.card():'',r=typeof HWRun!=='undefined'?HWRun.section():'';
  Promise.resolve().then(watch);
  return hud()+'<p id="st-casual" class="stnote">Check in by GPS at a campus stairway, or log a climb by hand. Climb at any time.</p>'
    +(g?'<div class="card" id="v6gps">'+g+'</div>':'')+casual()
    +head('st-workout','energy','TRIAL OF BREATH','STAIR WORKOUT','A timed, paced stair workout with your heart rate before and after, and an energy estimate.')
    +workout()+chart()+chronicle()+'<!--stair-games-->'
    +head('st-run','running','RUNNING ROAD','RUNNING','Track a run by GPS: distance, time and pace.')+r+(typeof HWRunBoard!=='undefined'?HWRunBoard.section():'')};
// the old Pulse page now opens the Workout section (see go below); this keeps a direct call safe
pages.pulse=()=>pages.stair();

/* ---------- heart-rate traces (canvas). Same wave shape as the original pulse page: faster BPM, closer beats ---------- */
const gs=(d,m,w,a)=>a*Math.exp(-(d-m)*(d-m)/(2*w*w));
const sig=(t,RR)=>{if(!RR)return 0;const q=Math.sqrt(RR),k0=Math.round(t/RR);let y=.014*Math.sin(t*1.6);for(let k=k0-2;k<=k0+2;k++){const d=t-k*RR;y+=gs(d,-.17,.024,.13)+gs(d,-.03,.009,-.11)+gs(d,0,.011,1)+gs(d,.031,.011,-.24)+gs(d,.1+.16*q,.034+.016*q,.3*Math.min(1,.55+.45*q))}return y};
const COL={b:['#06121f','#4db3ff','rgba(77,179,255,'],a:['#1f0708','#ff6b5e','rgba(255,107,94,']};
// battery: a trace only animates while it has a BPM and is on screen; otherwise it is drawn once, still
let raf=0,IOc=null;const t0=performance.now(),vis=new WeakSet(),hasIO=typeof IntersectionObserver!=='undefined';
function frame(now){raf=0;const cs=[...document.querySelectorAll('canvas.sttr')];if(!cs.length)return;
  const red=HWUI.reduced();let live=0;cs.forEach(c=>{const still=red||!+c.dataset.bpm||(hasIO&&!vis.has(c));if(!still)live=1;const x=c.getContext('2d');if(!x)return;const bpm=+c.dataset.bpm||0,RR=bpm?60/bpm:0,P=COL[c.dataset.k]||COL.b,
    dpr=Math.min(3,window.devicePixelRatio||1),W=c.clientWidth||300,H=c.clientHeight||120;
    if(c.width!==Math.round(W*dpr)||c.height!==Math.round(H*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr)}
    x.setTransform(dpr,0,0,dpr,0,0);x.fillStyle=P[0];x.fillRect(0,0,W,H);
    for(let g=0;g<=W;g+=12){x.fillStyle=P[2]+(g%60?'.10)':'.26)');x.fillRect(g,0,1,H)}for(let g=0;g<=H;g+=12){x.fillStyle=P[2]+(g%60?'.10)':'.26)');x.fillRect(0,g,W,1)}
    const SPD=90,T=still?W/SPD:(now-t0)/1000,cyc=W/SPD,n=Math.floor(T/cyc),cx=still?W:(T-n*cyc)*SPD,yy=t=>H*.66-sig(t,RR)*H*.5;
    x.lineWidth=2;x.strokeStyle=P[1];x.beginPath();for(let p=0;p<=cx;p+=1){const y=yy(n*cyc+p/SPD);p?x.lineTo(p,y):x.moveTo(p,y)}x.stroke();
    if(!still&&cx+24<W){x.beginPath();for(let p=cx+24;p<=W;p+=1){const y=yy((n-1)*cyc+p/SPD);p===cx+24?x.moveTo(p,y):x.lineTo(p,y)}x.stroke()}
    x.fillStyle='#fffbea';x.font='bold 12px ui-monospace,Menlo,Consolas,monospace';x.fillText(bpm?bpm+' BPM':'NOT ENTERED',8,16)});
  if(live)raf=requestAnimationFrame(frame)}
function draw(){if(!raf)raf=requestAnimationFrame(frame)}
function watch(){if(hasIO){if(IOc)IOc.disconnect();IOc=new IntersectionObserver(es=>{es.forEach(e=>e.isIntersecting?vis.add(e.target):vis.delete(e.target));draw()});
  document.querySelectorAll('canvas.sttr').forEach(c=>IOc.observe(c))}draw()}

/* ---------- live updates without a full render (keeps focus and typed values) ---------- */
const $id=i=>document.getElementById(i);
function liveKcal(){const k=$id('wk-kcal');if(k&&!k.contains(document.activeElement))k.innerHTML=kcalBox()}
INP.stc=()=>{C.steps=$id('ss').value;C.climbs=$id('sc').value;$id('tot').textContent=(+C.steps||0)*(+C.climbs||0)};
INP.stw=el=>{const v=k=>{const e=$id(k);return e?e.value:''},id=el&&el.id;W.hrB=v('wk-b');W.hrA=v('wk-a');W.steps=v('wk-s');W.climbs=v('wk-c');
  if(id==='wk-b')W.hrBd=0;if(id==='wk-a')W.hrAd=0; // typed over a device reading: it is the user's number now
  if($id('wk-lo')){W.cLo=v('wk-lo');W.cAv=v('wk-av');W.cHi=v('wk-hi')}
  if(id==='wk-lo'||id==='wk-av'||id==='wk-hi'){W.cSet=W.cLo+W.cAv+W.cHi!==''?1:0;W.cDev=0;const n=$id('st-cn');if(n)n.innerHTML=cNote()}
  if(el&&el.id==='wk-d'){W.dur=v('wk-d');W.durSet=W.dur!==''?1:0;const n=$id('wk-dn');if(n)n.textContent=W.durSet?'Typed in by you.':'From the Pace & Breathe timer.'}
  keepW();['b','a'].forEach(k=>{const c=$id('st-tr-'+k),h=okHR(k==='b'?W.hrB:W.hrA),s=$id('st-hs-'+k);if(c){c.dataset.bpm=h||'';c.setAttribute('aria-label',(k==='b'?'BEFORE':'AFTER')+' WORKOUT heart rate: '+(h?h+' BPM, typed in by you':'not entered'))}
    if(s)s.innerHTML=hsTxt(k,h)});
  const r=$id('st-rest');if(r)r.innerHTML=restTxt(okHR(W.hrB));const pk=$id('st-peak');if(pk)pk.innerHTML=peakTxt();
  const d=$id('st-delta');if(d)d.innerHTML=delta();liveKcal();draw()};
/* ---------- heart-rate device (js/v6-hr.js): use a steady reading; record the climb while the timer runs ---------- */
acts.hruse=d=>{if(!hasHR)return;const s=HWHR.stable(),k=d.k==='a'?'a':'b';
  if(!s.ok||s.v>220){toast('Wait for a steady reading (10–15 s, holding still)');return}
  const e=$id('wk-'+k);if(e)e.value=s.v;if(k==='b'){W.hrB=String(s.v);W.hrBd=1}else{W.hrA=String(s.v);W.hrAd=1}
  INP.stw(null);toast('Watch reading used: '+s.v+' BPM '+(k==='b'?'before':'after')+' the workout')};
let kept=0;
if(hasHR)HWHR.on(v=>{if(!W.since||v>220)return;const c=W.cl||(W.cl={lo:v,hi:v,sum:0,n:0});c.lo=Math.min(c.lo,v);c.hi=Math.max(c.hi,v);c.sum+=v;c.n++;
  if(!W.cSet){W.cLo=String(c.lo);W.cAv=String(Math.round(c.sum/c.n));W.cHi=String(c.hi);W.cDev=1;
    [['wk-lo',W.cLo],['wk-av',W.cAv],['wk-hi',W.cHi]].forEach(([i,x])=>{const f=$id(i);if(f&&document.activeElement!==f)f.value=x});
    const n=$id('st-cn');if(n)n.innerHTML=cNote();const pk=$id('st-peak');if(pk)pk.innerHTML=peakTxt()}
  if(Date.now()-kept>5000){kept=Date.now();keepW()}});
CH.stloc=v=>{const i=STAIRS.findIndex(s=>s.id===v);if(i<0){pick=null;return}pick=v;S.loc=i;S.cat=STAIRS[i].cat;render()};

/* ---------- workout timer: the Pace & Breathe rhythm guide is the clock ---------- */
let TT=0;
function tick(){clearInterval(TT);TT=0;if(!W.since)return;TT=setInterval(()=>{if(!W.since||S.v!=='stair'){clearInterval(TT);TT=0;return}
  const t=$id('wk-time');if(t)t.textContent=clock(secsW());
  if(!W.durSet){const d=$id('wk-d'),m=durW();if(d&&document.activeElement!==d&&m!=null&&d.value!==String(m)){d.value=m;const n=$id('wk-dn');if(n)n.textContent='From the Pace & Breathe timer.';liveKcal()}}},1000)}
function pause(){if(W.since){W.ms+=Date.now()-W.since;W.since=null;keepW()}clearInterval(TT);TT=0}
{const s0=acts.pstart,p0=acts.pstop;
  acts.pstart=(...a)=>{if(!W.since)W.since=Date.now();keepW();s0(...a);tick()};
  acts.pstop=(...a)=>{pause();p0(...a)}}

/* ---------- saving: both ways of logging feed the same entries ---------- */
const need=sel=>{const q=stair();if(!q){toast('Choose a stairway first (or check in by GPS)');const l=document.querySelector(sel);if(l){l.scrollIntoView({block:'center'});if(l.focus)l.focus({preventScroll:true})}}return q};
const counts=(s,c)=>Number.isInteger(s)&&s>=1&&s<=1000&&Number.isInteger(c)&&c>=1&&c<=500;
acts.savestair=()=>{INP.stc();const s=+C.steps,c=+C.climbs;
  if(!counts(s,c)){toast('Enter steps per climb (1–1000) and number of climbs (1–500)');return}
  const q=need('#stman .sqlist');if(!q)return;const w=HWWhen.stamp({sig:'k'+q.id+s+'x'+c});if(!w)return;
  add('stair',s*c,record(q,{kind:'casual',src:'manual',steps:s,climbs:c}),'',w.d,w.t,25,'Stair session');HWWhen.saved(w,'Climb');
  C.steps=C.climbs=C.d=C.t='';render()};
acts.stwsave=()=>{INP.stw();pause();const s=+W.steps,c=+W.climbs,b=W.hrB===''?null:okHR(W.hrB),a=W.hrA===''?null:okHR(W.hrA),dur=durW();
  if(!counts(s,c)){toast('Enter steps per climb (1–1000) and number of climbs (1–500)');return}
  if((W.hrB!==''&&!b)||(W.hrA!==''&&!a)){toast('Heart rates should be 30 to 220 BPM');return}
  if(dur!=null&&!(dur>0&&dur<=300)){toast('Workout time should be 0.5 to 300 minutes');return}
  const cv=x=>x===''?null:okHR(x),lo=cv(W.cLo),av=cv(W.cAv),hi=cv(W.cHi);
  if((W.cLo!==''&&!lo)||(W.cAv!==''&&!av)||(W.cHi!==''&&!hi)){toast('Climb heart rates should be 30 to 220 BPM');return}
  if((lo&&av&&lo>av)||(av&&hi&&av>hi)||(lo&&hi&&lo>hi)){toast('Climb heart rate: lowest ≤ average ≤ highest');return}
  const q=need('#wk-loc');if(!q)return;const pace=PACES[S.pb.pace][1],e=estimate({pace,dur,hrA:a});
  const dv={};if(W.hrBd&&b)dv.b=1;if(W.hrAd&&a)dv.a=1;if(W.cDev&&(lo||av||hi))dv.c=1;const nd=Object.keys(dv).length,ng=(b?1:0)+(a?1:0)+(lo||av||hi?1:0),pk=peak(hi,a);
  if(nd&&HWWhen.custom()){toast('📅 This workout uses heart rates read from your device just now, so it can only be saved for now. Choose USE NOW, or clear the device readings.');return}
  const w=HWWhen.stamp({sig:'w'+q.id+s+'x'+c+'/'+dur});if(!w)return;
  add('stair',s*c,record(q,{kind:'workout',src:nd?'device':'manual',steps:s,climbs:c,pace,dur:dur||0,hrB:b,hrA:a,kcal:e.v?{v:e.v,lo:e.lo,hi:e.hi,m:e.m}:null,
    hrS:nd?(nd===ng?'device':'mixed'):undefined,hrLo:lo,hrAv:av,hrHi:hi,hrPct:pk&&pk.pct||null,hrDev:nd?dv:null}),'',w.d,w.t,25,'Workout saved');HWWhen.saved(w,'Workout');
  clearInterval(S.tm);S.pb.on=0;W=W0();try{sessionStorage.removeItem(DK)}catch(x){}render()};
acts.stwreset=()=>{pause();clearInterval(S.tm);S.pb.on=0;W=W0();try{sessionStorage.removeItem(DK)}catch(e){}render();toast('Workout cleared. Nothing was saved.')};
acts.stprof=()=>{const v=i=>{const e=$id(i);return e?e.value:''},a=+v('pf-a'),sx=v('pf-s'),h=+v('pf-h'),w=+v('pf-w');
  if(!(a>=10&&a<=100&&h>=100&&h<=230&&w>=20&&w<=300&&(sx==='m'||sx==='f'))){toast('Enter age 10–100, sex, height 100–230 cm and weight 20–300 kg');return}
  Object.assign(st.p,{age:Math.round(a),sex:sx,h,w,cfm:1});try{computeGoals(0)}catch(e){}save();const k=$id('wk-kcal');if(k)k.innerHTML=kcalBox();toast('Profile saved')};
{const l0=acts.loc;acts.loc=d=>{const q=STAIRS[+d.i];if(q)pick=q.id;l0(d)}}
acts.stjump=d=>{if(d.t==='st-run'&&typeof HWRun!=='undefined')HWRun.showMap();const el=$id(d.t);if(el)el.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'})};
HWEvents.on('activity:checkin',e=>{pick=e.sid});

/* ---------- routes: Pulse and Running open their section on this page ---------- */
const TO={pulse:'st-workout',run:'st-run'};
{const g0=go;go=function(v){const t=TO[v];if(!t)return g0.apply(this,arguments);if(v==='run'&&typeof HWRun!=='undefined')HWRun.wantMap();const r=g0.call(this,'stair');
  const el=$id(t);if(el)el.scrollIntoView({block:'start'});return r}}
// any navigation stops the rhythm guide (go() clears it), so the workout clock pauses too; a refresh keeps the time so far
HWEvents.on('page:viewed',e=>{pause();if(e.view!=='stair'&&IOc){IOc.disconnect();IOc=null}});addEventListener('pagehide',pause);
HWEvents.on('data:reset',()=>{pick=null;W=W0();try{sessionStorage.removeItem(DK)}catch(e){}});

// Health Hall: one Stairs tile (the Pulse tile is gone; Running's tile is removed by js/v6-running.js)
{const i=HUB.findIndex(h=>h[0]==='pulse');if(i>=0)HUB.splice(i,1);
  const j=HUB.findIndex(h=>h[0]==='stair');if(j>=0)HUB[j]=['stair','🧗','Stairs & Workout','Stair Mountain',d=>sp(d)+' steps today']}
DIS.stair=DIS.pulse='General exercise pacing aid, not medical treatment. Heart rates are the numbers you counted and entered, or steady readings from your own heart-rate device that you chose to use; the trace is a picture, not an ECG, and nothing here is a diagnosis. Calorie numbers are estimates. Stop and get medical help for dizziness, chest pain, faintness or severe breathlessness.';

HWUI.css('stairs',`
.sthud{margin:0 0 8px}.sthud .pxst{flex:1 1 130px}
.ststats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 10px}
.ststat{padding:8px 10px;background:var(--pn);border:var(--px-bw-c) solid var(--ln);display:flex;flex-direction:column;gap:2px}
.stsv{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.stsv b{font-size:22px;line-height:1.2}.stsv small,.stsl{font-size:13px;color:var(--mut)}
.stgoal{margin:0 0 12px}.stgoal small{font-size:13px;color:var(--mut)}.stnote{font-size:13px;margin:8px 0}
.stjump{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}.stjump button{flex:1 1 120px;min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px}
.sthd{display:flex;align-items:center;gap:12px;margin:22px 0 12px;padding:10px 12px;background:var(--pn);border:var(--px-bw) solid var(--ln);box-shadow:var(--px-bevel),var(--px-sh);scroll-margin-top:12px}
.sthd>div{min-width:0;display:flex;flex-direction:column;gap:4px;align-items:flex-start}.sthd b{font:var(--px-f2)/1.3 var(--fh);overflow-wrap:anywhere}.sthd small{font-size:13px}
.stcard h3,#sthrg h3,#stlog h3{display:flex;align-items:center;gap:8px}
.stcats button{flex:1 1 90px}.stloc{display:flex;align-items:center;gap:6px;flex-wrap:wrap;overflow-wrap:anywhere}
.stsave{width:100%;margin-top:8px}.stbtns button{flex:1 1 100px;justify-content:center}.stbtns button:first-child{flex-grow:3}
.sttimer{display:flex;align-items:baseline;justify-content:center;gap:10px;margin-top:8px}.sttimer small{font:var(--px-f1)/1.6 var(--fh)}.sttimer b{font:var(--px-f2)/1.3 var(--fh)}
.sthrs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}
.sthr{padding:8px;border:var(--px-bw-c) solid var(--ln);box-shadow:var(--px-sh-c);background:var(--p2)}.sthr.b{border-top-color:var(--blue);border-top-width:6px}.sthr.a{border-top-color:var(--red);border-top-width:6px}
.sthrh{display:flex;align-items:center;gap:6px;margin-bottom:6px}.sthrh b{font:var(--px-f1)/1.6 var(--fh)}
.sttr{width:100%;height:120px;display:block;border:3px solid var(--ln);image-rendering:pixelated}
.stkc{margin:10px 0;padding:10px;border:var(--px-bw-c) dashed var(--ln);background:var(--p2)}.stkc>b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fh)}.stkc p{margin:6px 0}
.sthrsvg{width:100%;max-width:560px;height:auto;display:block;shape-rendering:crispEdges}.sthrsvg text{font:9px var(--fb);fill:var(--mut)}
.sthrsvg .gl{stroke:var(--mut);stroke-opacity:.35;stroke-width:1}.sthrsvg .jn{stroke:var(--ink);stroke-opacity:.5;stroke-width:2}
.sthrsvg .hb{fill:var(--blue);stroke:var(--pn);stroke-width:2;shape-rendering:auto}.sthrsvg .ha{fill:var(--red);stroke:var(--pn);stroke-width:2}
.sthrsvg .pt:hover .jn,.sthrsvg .pt:focus .jn{stroke-opacity:1}.sthrsvg .pt:focus{outline:none}.sthrsvg .pt:focus rect[fill=transparent]{stroke:var(--gold);stroke-width:2}
.stleg{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:6px;font-size:13px}.stleg span{display:flex;align-items:center;gap:6px}
.stleg i{display:inline-block;width:10px;height:10px;border:2px solid var(--ln)}.stleg i.hb{background:var(--blue);border-radius:50%}.stleg i.ha{background:var(--red)}
.sttab{width:100%;border-collapse:collapse;font-size:13px}.sttab th,.sttab td{text-align:left;padding:3px 6px;border-bottom:1px dashed var(--mut)}
.stses{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:2px dashed var(--p2);animation:pgin .3s steps(4)}.stses:first-of-type{border-top:0}
.stsi{flex:0 0 auto;padding:4px;background:var(--p2);border:var(--px-bw-s) solid var(--ln)}.stses.w .stsi{background:var(--pn);box-shadow:0 0 0 2px var(--red)}
.stsb{flex:1 1 auto;min-width:0}.stsb>b{display:block;overflow-wrap:anywhere}.stsb>small{color:var(--mut)}.stsb p{margin:4px 0}
.ststags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.stsh{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center;font-size:12px;max-width:340px}.stsh .bar{margin:0}
.stsa{display:flex;flex-direction:column;gap:6px;flex:0 0 auto}
.strest{display:flex;gap:6px;align-items:flex-start;margin-top:4px;font-size:13px}.strest:empty{display:none}
.stclimb{margin:10px 0;padding:8px;border:var(--px-bw-c) dashed var(--ln);background:var(--p2)}.stclimb>b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fh)}
.stclimb .row label{flex:1 1 90px}.stclimb p{margin:6px 0;font-size:14px}.stclimb small{display:flex;gap:6px;align-items:center}.stsh b{display:inline-flex;align-items:center;gap:2px}
@media(prefers-reduced-motion:reduce){.stses{animation:none}}html.hw-rm .stses,html.hw-still .stses{animation:none}
`);
return{session,all,estimate,profile,peak,MET,get pick(){return pick},get draft(){return Object.assign({},W,{secs:secsW()})}}})();
