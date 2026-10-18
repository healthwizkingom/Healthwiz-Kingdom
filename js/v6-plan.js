/* v6: Stair Prescription, a flexible weekly stair plan on the Stairs page. Not part of the original. Master prompt
   Feature B: an activity planner, not a medical prescription.
   * The player chooses everything: a goal (start a habit · keep steady · climb a bit more), the days, the minutes per
     session and, if they like, one stairway. Every other day is a rest day. Nothing is inferred about their fitness.
   * The plan's logic, shown under "?" (why()):
       - pace: Easy for "start a habit"; "keep steady" keeps the pace the player logged most in their own last 28 days
         (Easy if none); "climb a bit more" makes one session a week Moderate and the rest Easy;
       - the Health Conditions answer (js/v6-conditions.js) always wins: a pace cap lowers every session to that cap or
         below, and "ask your doctor first" means no stair sessions are planned at all;
       - the stairway: the player's choice, else the one they logged most in the last 28 days, else none (any stairway).
         The stairway's angle is shown for interest only: it does not decide how hard a climb is for one person.
   * The week (Monday to Sunday) is drawn as a route with one checkpoint per day; the knight walks to today's checkpoint
     (CSS only, still with reduced motion or the Performance mode). Each day shows what is really saved: a stair session
     logged that day marks it done. A missed day is just "not logged": no penalty, no XP lost, no streak.
   * START (today only) picks that stairway and pace on the Stairs page; SKIP marks a planned day as skipped (and back);
     EDIT changes the plan; TURN OFF removes it. Nothing here writes a stair session.
   * Saved: st.s.pl = {goal, days:[0-6, Monday = 0], min, sid, sk:{'YYYY-MM-DD':1}, at}. Missing means no plan. Settings
     keys need no migration (js/v6-schema.js keeps unknown st.s keys). Skips older than 8 weeks are dropped. */
const HWPlan=(()=>{
const ico=(n,s)=>HWPixel.icon(n,s||1);
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],DAYL=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const GOALS={start:['Start a habit','Short, easy sessions on the days you pick.'],steady:['Keep steady','The same kind of sessions you already do.'],
  more:['Climb a bit more','One Moderate session a week, the rest Easy.']};
const MINS=[5,10,15,20],PACE=['Easy','Moderate','Vigorous'];

/* ---------- saved plan ---------- */
const get=()=>{const p=st.s&&st.s.pl;return p&&typeof p==='object'&&Array.isArray(p.days)&&GOALS[p.goal]?p:null};
function clean(p){const days=[...new Set((p.days||[]).map(Number).filter(d=>d>=0&&d<7))].sort();
  const sk={};const old=ymd(new Date(Date.now()-56*864e5));Object.keys(p.sk||{}).forEach(k=>{if(/^\d{4}-\d\d-\d\d$/.test(k)&&k>=old)sk[k]=1});
  return{goal:GOALS[p.goal]?p.goal:'start',days,min:MINS.includes(+p.min)?+p.min:10,sid:STAIRS.some(s=>s.id===p.sid)?p.sid:'',sk,at:p.at||new Date().toISOString()}}

/* ---------- dates: this week, Monday first ---------- */
const dayIdx=d=>(new Date(d+'T12:00:00').getDay()+6)%7;
function week(){const t=today(),i=dayIdx(t),base=new Date(t+'T12:00:00');
  return DAYS.map((_,k)=>{const x=new Date(base);x.setDate(base.getDate()+k-i);return ymd(x)})}

/* ---------- what the player really did (last 28 days) ---------- */
function recent(){const from=ymd(new Date(Date.now()-27*864e5)),L=(typeof HWStairs!=='undefined'?HWStairs.all():[]).filter(s=>s.d>=from);
  const top=(f)=>{const c={};L.forEach(s=>{const k=f(s);if(k)c[k]=(c[k]||0)+1});const k=Object.keys(c).sort((a,b)=>c[b]-c[a])[0];return k||null};
  return{n:L.length,pace:top(s=>s.pace),sid:top(s=>s.sid&&STAIRS.some(q=>q.id===s.sid)?s.sid:null)}}
const doneOn=d=>(typeof HWStairs!=='undefined'?HWStairs.all():[]).filter(s=>s.d===d);

/* ---------- the plan for each day ---------- */
function cond(){try{return typeof HWCond!=='undefined'?HWCond.plan():null}catch(e){return null}}
function capPace(p,c){if(!c||!c.cap)return p;return PACE.indexOf(p)>PACE.indexOf(c.cap)?c.cap:p}
/** The sessions of this week: [{d, day, plan:null|{pace,min,sid}, done:[sessions], skip}] */
function sessions(p){p=p||get();if(!p)return[];const c=cond(),hide=!!(c&&c.hide),R=recent(),W=week();
  const base=p.goal==='steady'&&R.pace?R.pace:'Easy',sid=p.sid||R.sid||'',mod=p.goal==='more'?p.days[Math.floor(p.days.length/2)]:-1;
  return W.map((d,k)=>{const on=!hide&&p.days.includes(k);
    return{d,day:k,plan:on?{pace:capPace(k===mod?'Moderate':base,c),min:p.min,sid}:null,done:doneOn(d),skip:!!p.sk[d]}})}
const stairName=id=>{const s=STAIRS.find(q=>q.id===id);return s?s.name:''};

/* ---------- the "?" explanation ---------- */
function why(p){const c=cond(),R=recent();
  return '<p>This is a <b>plan you choose</b>, not a medical prescription. HealthWiz does not judge your fitness or promise results.</p>'
    +'<p><b>How each session is set:</b></p><ul>'
    +'<li><b>Days and minutes:</b> exactly the ones you picked ('+p.days.map(i=>DAYS[i]).join(', ')+'; '+p.min+' min). Every other day is a rest day.</li>'
    +'<li><b>Pace:</b> '+(p.goal==='start'?'Easy on every day, to start a habit.':p.goal==='steady'?(R.pace?'"'+esc(R.pace)+'", the pace you logged most in your last 28 days.':'Easy, because no pace was logged in your last 28 days.')
      :'one Moderate session in the middle of your days, the rest Easy.')+'</li>'
    +(c&&c.hide?'<li><b>Your health answers:</b> they say to ask your doctor before stairs, so no stair sessions are planned.</li>':c&&c.cap?'<li><b>Your health answers:</b> no session is faster than '+esc(c.cap)+'.</li>':'')
    +'<li><b>Stairway:</b> '+(p.sid?'the one you chose.':R.sid?'the one you logged most in your last 28 days.':'any stairway; you have not logged one in the last 28 days.')+' Its angle does not decide how hard a climb is for you: your pace, the time and how you feel matter more.</li>'
    +'<li><b>Done:</b> a day counts as done only when a stair session is saved on that day. A missed day costs nothing.</li></ul>'
    +'<p><b>Stop and rest</b> if you feel dizzy, faint, short of breath beyond normal, or have chest pain, and tell someone nearby. '+(typeof HWCond!=='undefined'?esc(HWCond.DISCLAIMER):'')+'</p>'}

/* ---------- the card ---------- */
let edit=null,off=0; // the draft while choosing: {goal, days, min, sid}; off: TURN OFF asked once, waiting for YES
function setup(){const e=edit,R=recent();
  const chip=(a,v,t,on,x)=>'<button type="button" class="chip'+(on?' on':'')+'" data-a="'+a+'" data-v="'+v+'" aria-pressed="'+(on?'true':'false')+'"'+(x||'')+'>'+t+'</button>';
  return '<div class="plset"><p><b>1. Your goal</b></p><div class="row pl3" role="group" aria-label="Goal">'+Object.keys(GOALS).map(k=>chip('plgoal',k,GOALS[k][0],e.goal===k)).join('')+'</div>'
    +'<small class="mut">'+esc(GOALS[e.goal][1])+'</small>'
    +'<p><b>2. Your days</b> <small class="mut">(the rest are rest days)</small></p><div class="pldays" role="group" aria-label="Days">'+DAYS.map((t,i)=>chip('plday',i,t,e.days.includes(i),' aria-label="'+DAYL[i]+'"')).join('')+'</div>'
    +(e.days.length>5?'<small class="mut">Tip: keeping at least one or two rest days helps you recover.</small>':'')
    +'<p><b>3. Minutes per session</b></p><div class="row pl4" role="group" aria-label="Minutes">'+MINS.map(m=>chip('plmin',m,m+' min',e.min===m)).join('')+'</div>'
    +'<p><label for="plsid"><b>4. Stairway</b> <small class="mut">(optional)</small></label></p><select id="plsid"><option value="">'+(R.sid?'My usual: '+esc(stairName(R.sid)):'Any stairway')+'</option>'
    +STAIRS.map(s=>'<option value="'+s.id+'"'+(e.sid===s.id?' selected':'')+'>'+esc(s.name)+' ('+esc(s.floor)+')</option>').join('')+'</select>'
    +'<div class="row"><button type="button" data-a="plsave"'+(e.days.length?'':' disabled')+'>SAVE MY PLAN</button>'+(get()?'<button type="button" class="g" data-a="plcancel">CANCEL</button>':'')+'</div>'
    +(e.days.length?'':'<small class="mut">Pick at least one day.</small>')+'</div>'}
const pos=k=>((50+k*100)/7).toFixed(2)+'%'; // checkpoint k (0 = Monday) along the route
function route(L){const t=today(),i=L.findIndex(x=>x.d===t);
  return '<div class="plroute" aria-hidden="true"><svg viewBox="0 0 700 60" preserveAspectRatio="none"><path d="M50 40 C120 10,170 10,250 40 S380 70,450 40 S580 10,650 40" class="plpath"/></svg>'
    +L.map((x,k)=>'<i class="plcp'+(x.done.length?' ok':x.plan?(x.skip?' sk':' on'):'')+'" style="left:'+pos(k)+'"></i>').join('')
    +'<span class="plhero" style="left:'+pos(i)+'">'+avatar(2)+'</span></div>'}
function dayRow(x){const t=today(),past=x.d<t,isT=x.d===t,p=x.plan;let state,acts='';
  if(x.done.length)state='<b class="plok">'+ico('success')+' Done</b> <small>'+x.done.length+' stair session'+(x.done.length>1?'s':'')+' saved</small>';
  else if(!p)state='<span class="mut">Rest day</span>';
  else if(x.skip)state='<span class="mut">Skipped</span>';
  else if(past)state='<span class="mut">Not logged, and that is okay</span>';
  else state='<b>'+p.min+' min · '+esc(p.pace)+' pace</b>'+(p.sid?'<small> · '+esc(stairName(p.sid))+'</small>':'');
  if(p&&!x.done.length&&!past){acts=(x.skip||!isT?'':'<button type="button" class="sm" data-a="plstart" data-d="'+x.d+'">START</button>')
    +'<button type="button" class="sm g" data-a="plskip" data-d="'+x.d+'" aria-pressed="'+(x.skip?'true':'false')+'">'+(x.skip?'UNSKIP':'SKIP')+'</button>'}
  return '<li class="plrow'+(isT?' now':'')+'"><span class="pld">'+DAYS[x.day]+(isT?' <small>today</small>':'')+'</span><span class="pls">'+state+'</span><span class="pla">'+acts+'</span></li>'}
function card(){const p=get();
  if(!p&&!edit)return '<div class="card plcard" id="plcard"><h3>'+ico('map')+' MY STAIR PLAN</h3><p>Plan a gentle week of stair sessions: you pick the days and the minutes, and rest days stay rest days.</p>'
    +'<p class="mut">Optional. '+HWHelp.btn('plnote','About the stair plan','<p>Not a medical prescription.</p>')+'</p><button type="button" data-a="plnew">MAKE A PLAN</button></div>';
  if(edit)return '<div class="card plcard" id="plcard"><h3>'+ico('map')+' MY STAIR PLAN</h3>'+setup()+'</div>';
  const L=sessions(p),c=cond(),n=L.filter(x=>x.plan).length,d=L.filter(x=>x.plan&&x.done.length).length;
  HWHelp.reg('plan-why','How your stair plan is made',why(p));
  return '<div class="card plcard" id="plcard"><h3>'+ico('map')+' MY STAIR PLAN'+HWHelp.btn('plan-why')+'</h3>'
    +'<p class="mut">'+esc(GOALS[p.goal][0])+' · this week: '+d+' of '+n+' planned day'+(n===1?'':'s')+' done</p>'
    +(c&&c.hide?'<p class="warn" role="note">Your health answers say to ask your doctor before stairs, so no stair sessions are planned. '+esc(HWCond.DISCLAIMER)+'</p>':'')
    +route(L)+'<ul class="pllist">'+L.map(dayRow).join('')+'</ul>'
    +(off?'<div class="warn ploffq" role="alert"><p><b>Turn off your stair plan?</b> Your stair sessions stay saved.</p><div class="row"><button type="button" class="sm" data-a="ploffyes">YES, TURN OFF</button><button type="button" class="g sm" data-a="ploffno">KEEP MY PLAN</button></div></div>'
      :'<div class="row"><button type="button" class="g sm" data-a="pledit">EDIT PLAN</button><button type="button" class="g sm" data-a="ploff">TURN OFF</button></div>')
    +'<small class="mut">Stop and rest if you feel unwell. A missed day costs nothing.</small></div>'}

/* ---------- actions ---------- */
const draft=p=>({goal:p?p.goal:'start',days:p?p.days.slice():[0,2,4],min:p?p.min:10,sid:p?p.sid:''});
const keepSid=()=>{const s=$('#plsid');if(s&&edit)edit.sid=s.value};
const redraw=()=>{const y=window.scrollY;render();window.scrollTo(0,y)};
acts.plnew=()=>{edit=draft(null);redraw()};
acts.pledit=()=>{edit=draft(get());redraw()};
acts.plcancel=()=>{edit=null;redraw()};
acts.plgoal=d=>{keepSid();edit.goal=d.v;redraw()};
acts.plday=d=>{keepSid();const i=+d.v,k=edit.days.indexOf(i);k<0?edit.days.push(i):edit.days.splice(k,1);redraw()};
acts.plmin=d=>{keepSid();edit.min=+d.v;redraw()};
acts.plsave=()=>{keepSid();if(!edit.days.length)return;const o=get();st.s.pl=clean(Object.assign({sk:o?o.sk:{}},edit,{at:o?o.at:null}));edit=null;save();
  HWEvents.emit('plan:saved',{days:st.s.pl.days.length});toast('Your stair plan is saved. Rest days stay rest days.');redraw()};
acts.ploff=()=>{off=1;redraw();const b=$('[data-a="ploffno"]');if(b)b.focus()};
acts.ploffno=()=>{off=0;redraw()};
acts.ploffyes=()=>{off=0;delete st.s.pl;edit=null;save();toast('Stair plan turned off. Your stair sessions stay saved.');redraw()};
acts.plskip=d=>{const p=get();if(!p||!/^\d{4}-\d\d-\d\d$/.test(d.d))return;p.sk[d.d]?delete p.sk[d.d]:(p.sk[d.d]=1);save();redraw()};
acts.plstart=d=>{const p=get();if(!p||d.d!==today())return;const x=sessions(p).find(y=>y.d===d.d),sid=x&&x.plan&&x.plan.sid,i=STAIRS.findIndex(s=>s.id===sid);
  if(i>=0){S.loc=i;S.cat=STAIRS[i].cat}const pi=PACES.findIndex(q=>x&&x.plan&&q[1]===x.plan.pace);if(pi>=0)S.pb.pace=pi;
  render();const t=document.getElementById('st-casual')||document.querySelector('.sqlist');if(t)t.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'});
  toast('Go at your own pace. Stop if you feel unwell.')};

/* ---------- on the Stairs page: a saved plan (or one being made) right below its two halves; the small "make a plan"
   card just above the session chronicle, so it never pushes the check-in and logging form down ---------- */
{const p=pages.stair;pages.stair=function(){const h=p.apply(this,arguments),c=card();
  if(!get()&&!edit){const k=h.indexOf('<div class="card" id="stlog">');return k<0?h+c:h.slice(0,k)+c+h.slice(k)}
  const t=h.indexOf('class="sttabs"');if(t<0)return c+h;
  const a=[h.indexOf('<p id="st-casual"',t),h.indexOf('<div class="card"',t)].filter(i=>i>0),j=a.length?Math.min(...a):-1;
  return j<0?h+c:h.slice(0,j)+c+h.slice(j)}}

HWUI.css('plan',`
.plcard h3 .hwh{margin-left:6px}.plset p{margin:10px 0 6px}.plset select{width:100%}
.pldays{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.pldays .chip{min-width:0;padding-left:0;padding-right:0;min-height:44px}
.pl3 .chip,.pl4 .chip{flex:1 1 0;min-width:0;min-height:44px}
.plroute{position:relative;height:64px;margin:6px 0 2px}.plroute svg{position:absolute;inset:6px 0 0;width:100%;height:56px}
.plpath{fill:none;stroke:var(--edge,var(--ln));stroke-width:3;stroke-dasharray:6 6}
.plcp{position:absolute;top:34px;width:14px;height:14px;margin-left:-7px;border-radius:50%;border:2px solid var(--ln);background:var(--p2)}
.plcp.on{background:var(--gold)}.plcp.ok{background:#5cc05a}.plcp.sk{background:var(--p2);border-style:dashed}
.plhero{position:absolute;top:-4px;margin-left:-14px;line-height:0;transition:left .9s steps(6);animation:plbob .6s steps(2) infinite alternate}
@keyframes plbob{to{transform:translateY(-2px)}}
html.hw-rm .plhero,html.hw-q-performance .plhero{animation:none;transition:none}
@media(prefers-reduced-motion:reduce){.plhero{animation:none;transition:none}}
.pllist{list-style:none;margin:6px 0;padding:0}.plrow{display:flex;gap:8px;align-items:center;border-top:1px solid var(--edge,var(--ln));padding:6px 0;min-height:44px}
.plrow.now{background:rgba(246,201,79,.08)}.pld{flex:0 0 58px;font-weight:bold}.pld small{display:block;font-weight:normal;color:var(--mut)}
.pls{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}.pla{flex:0 0 auto;display:flex;gap:4px}.pla button{min-height:44px}
.plok svg{vertical-align:-3px}
`);
return{get,sessions,week,recent,why,clean,DAYS,GOALS}})();
