/* v6: the Health Time Machine (route 'time'), an interactive timeline of what was really saved. Not part of the original.
   Master prompt Feature C.
   * Day, week (Monday first) or month. The slider and EARLIER / LATER move through time, from the first day anything was
     saved up to today; RETURN TO TODAY comes back.
   * Lanes, each from saved records only: water (ml), food (kcal), sleep (h), stress check-ins (/10), energy (/5), heart rate
     (pulse logs and the before/after numbers of stair workouts, BPM), stairs (steps), workouts (min), runs (km, from the
     run log on this device) and BMI. Weather and haze are not saved as history in HealthWiz, so they are not here.
   * A day with no record in a lane shows "not logged", never 0. Day view puts each record at the time it was saved; week
     and month views show one cell per day. Tapping a marker or cell opens a compact card with the records, their time and
     where the number came from (entered by you, a GPS check-in, a device, a camera estimate, a GPS run).
   * COMPARE puts the period beside the one before it: days logged and the average on logged days, per lane, with the note
     that a difference does not show its cause.
   * Markers pop in (CSS); nothing moves with reduced motion or the Performance mode.
   * Rewind and fill in: a "not logged" cell (and the LOG panel under a day) opens the matching page already set to "logging for"
     that day (HWWhen.setFor, js/v6-when.js), so the entry is saved under that date by the normal form. Only lanes that can be
     backdated have it (BK below: water, food, sleep, stairs, BMI); heart rate, runs, workouts and the stress quest are
     measured live and stay "not logged". The Time Machine itself writes nothing. */
const HWTime=(()=>{
const ico=(n,s)=>HWPixel.icon(n,s||1);
const two=n=>String(n).padStart(2,'0'),DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const D0=d=>new Date(d+'T12:00:00'),add=(d,n)=>{const x=D0(d);x.setDate(x.getDate()+n);return ymd(x)};
const nice=d=>{const x=D0(d);return DN[x.getDay()]+' '+x.getDate()+' '+MN[x.getMonth()]};
const r1=v=>Math.round(v*10)/10;

/* ---------- where each number came from ---------- */
function src(e){const m=e&&e.m||{};
  if(m.src==='gps'||m.chk==='gps')return'GPS check-in';if(m.src==='device')return'from a device';if(m.src==='camera')return'camera estimate';return'entered by you'}
const runsOn=d=>{try{return typeof HWRun!=='undefined'?HWRun.runs().filter(r=>{const x=new Date(r.start);return!isNaN(x)&&ymd(x)===d}):[]}catch(e){return[]}};
const hhmm=s=>{const x=new Date(s);return isNaN(x)?'':two(x.getHours())+':'+two(x.getMinutes())};
const stairOn=d=>typeof HWStairs!=='undefined'?HWStairs.all().filter(s=>s.d===d):[];

/* ---------- the lanes: [key, icon, name, day summary, records] ---------- */
// day(d) → text or null (null = not logged); val(d) → number or null for COMPARE; items(d) → [{t, txt, src}]
const sumOf=(c,d)=>A(c,d).reduce((a,e)=>a+(+e.v||0),0),last=(c,d)=>{const L=A(c,d);return L.length?L[L.length-1]:null};
const LANES=[
 {k:'water',i:'water',n:'Water',u:'ml',val:d=>A('water',d).length?sumOf('water',d):null,day:v=>Math.round(v)+' ml',items:d=>A('water',d).map(e=>({t:e.t,txt:Math.round(+e.v)+' ml',src:src(e)}))},
 {k:'food',i:'food',n:'Food',u:'kcal',val:d=>A('food',d).length?sumOf('food',d):null,day:v=>Math.round(v)+' kcal',items:d=>A('food',d).map(e=>({t:e.t,txt:esc((e.m&&e.m.name)||'Food')+' · '+Math.round(+e.v)+' kcal',src:src(e)}))},
 {k:'sleep',i:'sleep',n:'Sleep',u:'h',val:d=>{const e=last('sleep',d);return e?+e.v:null},day:v=>r1(v)+' h',items:d=>A('sleep',d).map(e=>({t:e.t,txt:r1(+e.v)+' h'+(e.m&&e.m.bed&&e.m.wake?' · '+esc(e.m.bed)+' to '+esc(e.m.wake):''),src:src(e)}))},
 {k:'stress',i:'stress',n:'Stress',u:'/10',val:d=>{const e=last('stress',d);return e?+e.v:null},day:v=>v+'/10',items:d=>A('stress',d).map(e=>({t:e.t,txt:'Rated '+(+e.v)+'/10'+(e.m&&e.m.end!=null?', then '+(+e.m.end)+'/10':''),src:src(e)}))},
 {k:'energy',i:'energy',n:'Energy',u:'/5',val:d=>{const x=(st.en||{})[d];return x&&+x.v>=1?+x.v:null},day:v=>v+'/5',items:d=>{const x=(st.en||{})[d];return x&&+x.v>=1?[{t:x.t||'',txt:'Rated '+(+x.v)+'/5',src:'entered by you'}]:[]}},
 {k:'pulse',i:'pulse',n:'Heart rate',u:'BPM',val:d=>{const L=hrs(d);return L.length?Math.round(L.reduce((a,x)=>a+x.v,0)/L.length):null},day:v=>'avg '+v+' BPM',
  items:d=>hrs(d).map(x=>({t:x.t,txt:x.v+' BPM '+x.w,src:x.s}))},
 {k:'stair',i:'stairs',n:'Stairs',u:'steps',val:d=>{const L=stairOn(d);return L.length?L.reduce((a,s)=>a+s.total,0):null},day:v=>v+' steps',
  items:d=>stairOn(d).map(s=>({t:s.t,txt:esc(s.loc)+' · '+s.total+' steps'+(s.kind==='workout'?' (workout)':''),src:s.src==='gps'?'GPS check-in':'entered by you'}))},
 {k:'exercise',i:'workout',n:'Workouts',u:'min',val:d=>A('exercise',d).length?sumOf('exercise',d):null,day:v=>Math.round(v)+' min',items:d=>A('exercise',d).map(e=>({t:e.t,txt:esc((e.m&&e.m.name)||'Workout')+' · '+Math.round(+e.v)+' min',src:src(e)}))},
 {k:'run',i:'running',n:'Runs',u:'km',val:d=>{const L=runsOn(d);return L.length?r1(L.reduce((a,r)=>a+(+r.dist||0),0)/1000):null},day:v=>v+' km',
  items:d=>runsOn(d).map(r=>({t:hhmm(r.start),txt:r1((+r.dist||0)/1000)+' km in '+Math.round((+r.dur||0)/60)+' min',src:'GPS run'}))},
 {k:'bmi',i:'balance',n:'BMI',u:'',val:d=>{const e=last('bmi',d);return e?+e.v:null},day:v=>'BMI '+r1(v),items:d=>A('bmi',d).map(e=>({t:e.t,txt:'BMI '+r1(+e.v)+(e.m&&e.m.w?' · '+e.m.w+' kg':''),src:'calculated from what you entered'}))}];
// heart rate on a day: pulse logs (with when) and the numbers saved with stair workouts
function hrs(d){const L=A('pulse',d).filter(e=>e.m&&e.m.when).map(e=>({t:e.t,v:+e.v,w:e.m.when,s:src(e)}));
  stairOn(d).forEach(s=>{if(s.hrB)L.push({t:s.t,v:s.hrB,w:'before stairs',s:s.dev&&s.dev.b?'from a device':'entered by you'});if(s.hrA)L.push({t:s.t,v:s.hrA,w:'after stairs',s:s.dev&&s.dev.a?'from a device':'entered by you'})});
  return L.filter(x=>x.v>=30&&x.v<=220)}

const BK={water:'water',food:'food',sleep:'sleep',stair:'stair',bmi:'body'};   // lanes that can be logged for an earlier day → the page that logs them

/* ---------- periods ---------- */
const T=()=>S.tm||(S.tm={v:'w',off:0,sel:null,cmp:0});
function first(){let f=today();(st.e||[]).forEach(e=>{if(e.d&&e.d<f)f=e.d});Object.keys(st.en||{}).forEach(k=>{if(/^\d{4}-\d\d-\d\d$/.test(k)&&k<f)f=k});
  try{if(typeof HWRun!=='undefined')HWRun.runs().forEach(r=>{const x=new Date(r.start);if(!isNaN(x)&&ymd(x)<f)f=ymd(x)})}catch(e){}return f}
const monday=d=>add(d,-((D0(d).getDay()+6)%7));
/** The days of the period `off` steps back from today in view v ('d' | 'w' | 'm'). */
function period(v,off){const t=today();
  if(v==='d')return[add(t,-off)];
  if(v==='w'){const m=add(monday(t),-7*off);return Array.from({length:7},(_,i)=>add(m,i))}
  const x=D0(t);x.setDate(1);x.setMonth(x.getMonth()-off);const y=x.getFullYear(),mo=x.getMonth(),n=new Date(y,mo+1,0).getDate();
  return Array.from({length:n},(_,i)=>y+'-'+two(mo+1)+'-'+two(i+1))}
/** How many steps back the first saved day is (the slider's range). */
function maxOff(v){const f=first(),t=today();if(v==='d')return Math.max(0,Math.round((D0(t)-D0(f))/864e5));
  if(v==='w')return Math.max(0,Math.round((D0(monday(t))-D0(monday(f)))/(7*864e5)));const a=D0(f),b=D0(t);return Math.max(0,(b.getFullYear()-a.getFullYear())*12+b.getMonth()-a.getMonth())}
function label(v,P){if(v==='d')return nice(P[0]);if(v==='w')return nice(P[0])+' to '+nice(P[6]);const x=D0(P[0]);return['January','February','March','April','May','June','July','August','September','October','November','December'][x.getMonth()]+' '+x.getFullYear()}

/* ---------- the views ---------- */
const pct=t=>{const m=/^(\d\d?):(\d\d)/.exec(t||'');return m?((+m[1]*60+ +m[2])/1440*100).toFixed(2):null};
/** the "fill this day in" panel under a day: one button per lane that can be logged for an earlier day */
function logPanel(d){if(d>today())return'';
  return '<div class="tmlogp" role="group" aria-label="Log for '+esc(nice(d))+'"><b>LOG FOR '+esc(nice(d)).toUpperCase()+'</b><small class="mut">Opens the usual page set to this day. Heart rate, runs and workouts are measured live, so they cannot be added later.</small><div class="row">'
    +LANES.filter(L=>BK[L.k]).map(L=>'<button type="button" class="g sm" data-a="tmlog" data-d="'+d+'" data-k="'+L.k+'">'+ico(L.i)+' '+L.n.toUpperCase()+'</button>').join('')+'</div></div>'}
function dayView(d){const has=LANES.filter(L=>L.items(d).length);
  if(!has.length)return '<div class="tmempty tmnone">'+ico('alarm',3)+'<b>Nothing was saved on '+esc(nice(d))+'</b><span>Log water, food, sleep or a climb and it will appear here.</span></div>'+logPanel(d);
  return '<div class="tmaxis" aria-hidden="true"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>'
    +has.map(L=>{const I=L.items(d);let n=0;
      return '<div class="tmlane"><span class="tmln">'+ico(L.i)+' '+L.n+'</span><div class="tmtrack">'
        +I.map(x=>{const p=pct(x.t);return p==null?'':'<button type="button" class="tmk tm-'+L.k+'" style="left:'+p+'%;animation-delay:'+(n++*40)+'ms" data-a="tmsel" data-d="'+d+'" data-k="'+L.k+'" aria-label="'+L.n+' at '+esc(x.t)+': '+esc(x.txt.replace(/<[^>]+>/g,''))+'"></button>'}).join('')
        +'</div></div>'}).join('')
    +notLogged([d])+logPanel(d)}
function gridView(P){const t=today(),has=LANES.filter(L=>P.some(d=>L.val(d)!=null));
  if(!has.length)return '<div class="tmempty tmnone">'+ico('alarm',3)+'<b>Nothing was saved in this period</b><span>Slide the time bar back, or log something today and come back.</span></div>';
  const head='<div class="tmrow tmhead"><span class="tmln"></span>'+P.map(d=>d>t?'<span class="tmc">'+(P.length>7?D0(d).getDate():DN[D0(d).getDay()].slice(0,2))+'</span>':'<button type="button" class="tmc tmdy'+(d===t?' now':'')+'" data-a="tmday" data-d="'+d+'" aria-label="Open '+esc(nice(d))+'">'+(P.length>7?D0(d).getDate():DN[D0(d).getDay()].slice(0,2))+'</button>').join('')+'</div>';
  return '<div class="tmgrid tm'+(P.length>7?'m':'w')+'" style="--n:'+P.length+'">'+head+has.map(L=>'<div class="tmrow"><span class="tmln">'+ico(L.i)+' '+L.n+'</span>'
    +P.map((d,i)=>{const v=d>t?null:L.val(d);return v==null?(d<=t&&BK[L.k]?'<button type="button" class="tmc tm0 tmadd" data-a="tmlog" data-d="'+d+'" data-k="'+L.k+'" aria-label="'+L.n+', '+esc(nice(d))+': not logged. Log it for this day">+</button>':'<span class="tmc tm0" title="'+(d>t?'Not yet':'Not logged')+'"></span>')
      :'<button type="button" class="tmc tmk tm-'+L.k+'" style="animation-delay:'+i*25+'ms" data-a="tmsel" data-d="'+d+'" data-k="'+L.k+'" aria-label="'+L.n+', '+esc(nice(d))+': '+esc(L.day(v))+'"></button>'}).join('')+'</div>').join('')+'</div>'
    +notLogged(P)}
function notLogged(P){const t=today(),no=LANES.filter(L=>!P.some(d=>d<=t&&L.val(d)!=null));
  return no.length?'<p class="mut tmno">Not logged in this period: '+no.map(L=>L.n).join(', ')+'.</p>':''}
function detail(){const s=T().sel;if(!s)return'';const L=LANES.find(x=>x.k===s.k);if(!L)return'';const I=L.items(s.d).sort((a,b)=>String(a.t).localeCompare(String(b.t)));if(!I.length)return'';
  const v=L.val(s.d);
  return '<div class="tmdet" role="region" aria-label="'+L.n+' on '+esc(nice(s.d))+'"><b>'+ico(L.i)+' '+L.n+' · '+esc(nice(s.d))+'</b>'+(v!=null&&I.length>1?' <small>('+esc(L.day(v))+')</small>':'')
    +'<ul>'+I.map(x=>'<li><span class="tmt">'+esc(x.t||'')+'</span> '+x.txt+' <small class="mut">'+esc(x.src)+'</small></li>').join('')+'</ul>'
    +'<button type="button" class="g sm" data-a="tmgo" data-k="'+L.k+'">OPEN '+L.n.toUpperCase()+'</button> <button type="button" class="g sm" data-a="tmclose">CLOSE</button></div>'}
function compare(v,off){const P=period(v,off),Q=period(v,off+1),t=today();
  const st2=(L,R)=>{const V=R.filter(d=>d<=t).map(d=>L.val(d)).filter(x=>x!=null);return V.length?{n:V.length,a:V.reduce((a,b)=>a+b,0)/V.length}:null};
  const rows=LANES.map(L=>({L,a:st2(L,P),b:st2(L,Q)})).filter(x=>x.a||x.b);
  if(!rows.length)return '<p class="mut">Nothing was saved in either period.</p>';
  const cell=(L,x)=>x?esc(L.day(L.k==='sleep'||L.k==='run'||L.k==='bmi'?r1(x.a):Math.round(x.a)))+'<br><small>'+x.n+' day'+(x.n>1?'s':'')+' logged</small>':'<span class="mut">not logged</span>';
  return '<table class="tmcmp"><caption>Average on the days something was logged</caption><thead><tr><th scope="col">Lane</th><th scope="col">This '+({d:'day',w:'week',m:'month'})[v]+'</th><th scope="col">The one before</th></tr></thead><tbody>'
    +rows.map(x=>'<tr><th scope="row">'+ico(x.L.i)+' '+x.L.n+'</th><td>'+cell(x.L,x.a)+'</td><td>'+cell(x.L,x.b)+'</td></tr>').join('')+'</tbody></table>'
    +'<p class="mut">Only what was logged. A difference between two periods does not show what caused it.</p>'}
function view(){const o=T(),P=period(o.v,o.off);return(o.v==='d'?dayView(P[0]):gridView(P))+detail()+(o.cmp?compare(o.v,o.off):'')}

/** how much of the period has anything saved: days with a record, and lanes (trackers) used */
function summary(P){const t=today(),days=P.filter(d=>d<=t),on=days.filter(d=>LANES.some(L=>L.val(d)!=null)).length,lanes=LANES.filter(L=>days.some(d=>L.val(d)!=null)).length;
  return '<div class="tmsum" aria-label="Summary of this period"><span><b>'+on+'</b>of '+days.length+' day'+(days.length===1?'':'s')+' logged</span><span><b>'+lanes+'</b>of '+LANES.length+' trackers used</span></div>'}
function page(){const o=T(),mx=maxOff(o.v);if(o.off>mx)o.off=mx;const P=period(o.v,o.off);
  return '<div class="card tmcard" id="tmcard"><p class="mut">Only what you saved. Pick a period, slide back, tap a marker.</p>'
    +'<div class="row tmviews" role="group" aria-label="Period">'+[['d','Day'],['w','Week'],['m','Month']].map(x=>'<button type="button" class="chip'+(o.v===x[0]?' on':'')+'" data-a="tmv" data-v="'+x[0]+'" aria-pressed="'+(o.v===x[0])+'">'+x[1]+'</button>').join('')+'</div>'
    +'<div class="tmnav"><button type="button" class="g sm" data-a="tmstep" data-v="1"'+(o.off>=mx?' disabled':'')+'>EARLIER</button><b id="tmlbl" aria-live="polite">'+esc(label(o.v,P))+'</b><button type="button" class="g sm" data-a="tmstep" data-v="-1"'+(o.off?'':' disabled')+'>LATER</button></div>'
    +'<div class="tmscr"><input type="range" id="tmscrub" min="0" max="'+mx+'" value="'+(mx-o.off)+'" aria-label="Move through time" aria-valuetext="'+esc(label(o.v,P))+'"'+(mx?'':' disabled')+'>'
    +'<span class="tmends" aria-hidden="true"><small>First record</small><small>Today</small></span></div>'
    +'<div class="row"><button type="button" class="sm" data-a="tmtoday"'+(o.off?'':' disabled')+'>RETURN TO TODAY</button><button type="button" class="g sm" data-a="tmcmp" aria-pressed="'+(o.cmp?'true':'false')+'">'+(o.cmp?'HIDE COMPARISON':'COMPARE WITH THE ONE BEFORE')+'</button></div>'
    +summary(P)+'<div id="tmview">'+view()+'</div></div>'}

/* ---------- actions ---------- */
const keep=f=>{const y=window.scrollY;f();render();window.scrollTo(0,y)};
acts.tmgo0=()=>go('time');
acts.tmv=d=>keep(()=>{const o=T();o.v=d.v;o.off=0;o.sel=null});
acts.tmstep=d=>keep(()=>{const o=T();o.off=Math.max(0,Math.min(maxOff(o.v),o.off+(+d.v)));o.sel=null});
acts.tmtoday=()=>keep(()=>{const o=T();o.off=0;o.sel=null});
acts.tmcmp=()=>keep(()=>{const o=T();o.cmp=o.cmp?0:1});
acts.tmsel=d=>{const o=T();o.sel={d:d.d,k:d.k};const v=$('#tmview');if(v){v.innerHTML=view();const c=v.querySelector('.tmdet');if(c){c.setAttribute('tabindex','-1');c.focus({preventScroll:true});c.scrollIntoView({block:'nearest'})}}};
acts.tmclose=()=>{const o=T();o.sel=null;const v=$('#tmview');if(v)v.innerHTML=view()};
const PAGE={water:'food',food:'food',sleep:'sleep',stress:'stress',energy:'sleep',pulse:'pulse',stair:'stair',exercise:'exercise',run:'run',bmi:'body'};
acts.tmgo=d=>go(PAGE[d.k]||'health');
// rewind: open the page that logs lane k, set to "logging for" day d (the "Log for…" control shows it and USE NOW undoes it)
acts.tmlog=d=>{const pg=BK[d.k];if(!pg||!/^\d{4}-\d\d-\d\d$/.test(d.d||'')||d.d>today())return;HWWhen.setFor(d.d,pg);go(pg);
  if(d.d!==today())toast('Logging for '+HWWhen.label(d.d)+'. Tap USE NOW to log for today again.')};
acts.tmday=d=>keep(()=>{const o=T(),t=today();if(!/^\d{4}-\d\d-\d\d$/.test(d.d||'')||d.d>t)return;o.v='d';o.off=Math.max(0,Math.round((D0(t)-D0(d.d))/864e5));o.sel=null});
// the slider moves through time live; only the view and its label are redrawn, so the slider keeps focus
document.addEventListener('input',e=>{const t=e.target;if(!t||t.id!=='tmscrub')return;const o=T(),mx=maxOff(o.v);o.off=Math.max(0,mx-(+t.value||0));o.sel=null;
  const P=period(o.v,o.off),l=$('#tmlbl'),v=$('#tmview');if(l)l.textContent=label(o.v,P);t.setAttribute('aria-valuetext',label(o.v,P));if(v)v.innerHTML=view()});
document.addEventListener('change',e=>{if(e.target&&e.target.id==='tmscrub'){const y=window.scrollY;render();window.scrollTo(0,y);const s=$('#tmscrub');if(s)s.focus()}});

/* ---------- the page, and its door on the Statistics page ---------- */
pages.time=()=>page();
PAR.time='health';
BN.time=['⏰','Health Time Machine','Travel back through what you saved.','rgba(99,230,220,.20)'];
DIS.time='Only records you saved are shown. A missing day is not logged, not zero. Timing alone does not show cause.';
const door=()=>'<div class="card tmdoor" id="tm-door"><h3>'+ico('alarm')+' HEALTH TIME MACHINE</h3><p>Slide back through your days, weeks and months, and see everything you saved side by side.</p><button type="button" class="imgbtn ib-time" data-a="tmgo0">OPEN THE TIME MACHINE</button></div>';
{const p=pages.stats;pages.stats=function(){return door()+p.apply(this,arguments)}}

HWUI.css('time',`
.tmviews .chip{flex:1 1 0;min-height:44px}.tmnav{display:flex;align-items:center;gap:8px;margin:8px 0}.tmnav b{flex:1 1 auto;text-align:center;min-width:0}
.tmnav button{min-height:44px}html #tmscrub{width:100%;margin:4px 0 0;min-height:32px;-webkit-appearance:none;appearance:none;background:transparent}
#tmscrub::-webkit-slider-runnable-track{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--p2),var(--accent,var(--gold)));border:1px solid var(--edge,var(--ln))}
#tmscrub::-moz-range-track{height:8px;border-radius:4px;background:linear-gradient(90deg,var(--p2),var(--accent,var(--gold)));border:1px solid var(--edge,var(--ln))}
#tmscrub::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;margin-top:-10px;border-radius:50%;background:var(--gold);border:2px solid #2b1a05;box-shadow:0 0 10px rgba(246,201,79,.6)}
#tmscrub::-moz-range-thumb{width:26px;height:26px;border-radius:50%;background:var(--gold);border:2px solid #2b1a05}
#tmscrub:disabled{opacity:.5}.tmscr{margin:4px 0 8px}.tmends{display:flex;justify-content:space-between;color:var(--mut)}
.tmaxis{display:flex;justify-content:space-between;margin-left:96px;font-size:12px;color:var(--mut)}
.tmlane{display:flex;align-items:center;gap:6px;min-height:44px}.tmln{flex:0 0 90px;font-size:13px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.tmln svg{vertical-align:-3px}
.tmtrack{position:relative;flex:1 1 auto;height:30px;border-radius:14px;background:var(--bg);border:1px solid var(--edge,var(--ln))}
.tmtrack .tmk{position:absolute;top:50%;width:24px;height:24px;min-height:24px;margin:-12px 0 0 -12px;padding:0;border-radius:50%}
.tmk{border:2px solid #fff8;box-shadow:0 0 8px rgba(255,255,255,.35);animation:tmpop .35s steps(3) both;background-image:none}
.tm-water{background:#4db3ff}.tm-food{background:#f0a050}.tm-sleep{background:#8b7bff}.tm-stress{background:#e06aa8}.tm-energy{background:#f6c94f}
.tm-pulse{background:#ff6b5e}.tm-stair{background:#5cc05a}.tm-exercise{background:#c07a3a}.tm-run{background:#63e6dc}.tm-bmi{background:#b9b2d8}
@keyframes tmpop{from{transform:scale(0)}}
html.hw-rm .tmk,html.hw-q-performance .tmk{animation:none}@media(prefers-reduced-motion:reduce){.tmk{animation:none}}
.tmgrid{overflow-x:auto;margin:4px 0}.tmrow{display:grid;grid-template-columns:90px repeat(var(--n),minmax(0,1fr));gap:2px;align-items:center;min-height:30px}
.tmm .tmrow{min-width:calc(90px + var(--n) * 26px)}.tmc{display:block;height:24px;min-height:24px;min-width:0;padding:0;border-radius:6px;text-align:center;font-size:12px}
.tmhead .tmc{height:auto;color:var(--mut)}.tmhead .tmc.now{color:var(--gold);font-weight:bold}
.tm0{border:1px dashed var(--edge,var(--ln));opacity:.5}.tmw .tmc{height:32px;min-height:32px}
.tmdet{border:1px solid var(--edge,var(--ln));border-radius:12px;padding:10px;margin:8px 0;background:var(--p2)}.tmdet ul{margin:6px 0;padding-left:18px}.tmdet li{margin:3px 0;overflow-wrap:anywhere}
.tmt{font-variant-numeric:tabular-nums}.tmdet button{min-height:44px}
.tm0.tmadd{display:block;width:100%;padding:0;font:700 14px/22px var(--fb);color:var(--mut);background:transparent;cursor:pointer;opacity:.8;min-height:24px}
.tm0.tmadd:hover,.tm0.tmadd:focus-visible{opacity:1;border-style:solid;color:var(--gold)}.tmw .tm0.tmadd{line-height:30px}
.tmhead .tmdy{background:none;border:0;box-shadow:none;color:inherit;font:inherit;cursor:pointer;text-decoration:underline dotted}
.tmlogp{margin:10px 0;padding:10px;border:1px dashed var(--edge,var(--ln));border-radius:12px}.tmlogp b{display:block;margin-bottom:2px}.tmlogp small{display:block;margin-bottom:6px}.tmlogp button{min-height:44px}
.tmcmp{width:100%;border-collapse:collapse;margin-top:8px}.tmcmp th,.tmcmp td{border-top:1px solid var(--edge,var(--ln));padding:6px 4px;text-align:left;vertical-align:top}.tmcmp caption{text-align:left;color:var(--mut);font-size:13px}
.tmcmp th svg{vertical-align:-3px}
`);
return{LANES,period,maxOff,first,label,compare,src}})();
