/* v6: the Wizard's Health Chronicle, a weekly report. Not part of the original.
   A GENERATE WEEKLY REPORT card on the Statistics page opens a report for one calendar week (Monday to Sunday) that the user can
   print or save as PDF with the browser's own print function (window.print(); a print stylesheet below, no PDF library).
   It is built only when the user asks, from what is already in the log, and goes nowhere: no upload, no share, nothing is saved.

   Sources, all existing (nothing is recalculated here except simple counts, sums and means of logged values)
     Health Score   HWScore.computeFor(days): the same ten weighted indicators as the Health Score page, over the logged days of the week
     sleep          slH(d)            last sleep entry of the day (h)         hydration   wt(d)  water logged (mL), target st.s.water
     calories       kc(d)             stress      str(d)                       heart rate  hrv(d,'hrB') resting, hrv(d,'hrA') after a workout
     recovery       stair sessions with both hrA and hrR1 (HWStairs.all(), js/v6-stairs.js): drop = hrA − hrR1
     stairs         HWStairs.all() sessions (steps, minutes), Stair Sense work m.gv.W; Training Hall minutes A('exercise',d); runs HWRun.burned(d).n
   A day with no entry is left out of an average, never counted as zero and never filled in; the report says which days are missing.
   Days after today are not part of a week that is still going.

   A week is compared with the week before only when it is finished (its Sunday is before today) and both weeks have at least
   3 days with logs and 3 of the 6 Health Score areas. Otherwise the comparison is withheld, with the reason.

   Left out on purpose: XP, levels, badges, quests, streaks, leaderboard rows and every other game number.
   Not a medical document: it says so, does not diagnose, and warns that a printed or shared copy holds private health information. */
const HWReport=(()=>{
const SC=HWScore,$i=i=>document.getElementById(i);
const MS=86400000,DN=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const parse=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
const addD=(s,n)=>{const d=parse(s);d.setDate(d.getDate()+n);return ymd(d)};
const monday=s=>{const d=parse(s),k=(d.getDay()+6)%7;return addD(s,-k)};
const dfmt=(s,o)=>parse(s).toLocaleDateString('en-GB',o||{day:'numeric',month:'short'});
const range=(a,b)=>dfmt(a)+' – '+dfmt(b,{day:'numeric',month:'short',year:'numeric'});
const f1=x=>(Math.round(x*10)/10).toLocaleString('en-GB'),f0=x=>Math.round(x).toLocaleString('en-GB');
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const sgn=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
const TRACK=['food','water','sleep','stair','pulse','stress','exercise','bmi'];
const hasLog=d=>TRACK.some(c=>{const m=IX().cd.get(c);return !!(m&&m.get(d)&&m.get(d).length)});

/* ---------- the numbers for one week (pure reads) ---------- */
function slice(days){
  const age=+st.p.age||16,SR_=SR(age),el=days.filter(d=>d<=today());
  const col=f=>el.map(d=>[d,f(d)]).filter(x=>x[1]!=null&&x[1]>0);
  const sleep=col(slH),water=col(wt),kcal=col(kc),stress=el.map(d=>[d,str(d)]).filter(x=>x[1]!=null);
  const sess=HWStairs.all().filter(s=>el.includes(s.d)),stairDays=new Set(sess.map(s=>s.d));
  const timed=sess.filter(s=>s.dur>0),exMin=el.reduce((a,d)=>a+A('exercise',d).reduce((s,e)=>s+(+e.v||0),0),0),exN=el.reduce((a,d)=>a+A('exercise',d).length,0);
  const runs=typeof HWRun!=='undefined'?el.reduce((a,d)=>{const b=HWRun.burned(d);return a+(b?b.n:0)},0):0;
  const rest=el.flatMap(d=>hrv(d,'hrB')),aft=el.flatMap(d=>hrv(d,'hrA'));
  const rec=sess.filter(s=>s.hrA&&s.hrR1).map(s=>s.hrA-s.hrR1);
  const gv=sess.map(s=>{const e=st.e.find(x=>x.id===s.id);return e&&e.m&&e.m.gv&&+e.m.gv.W>0?+e.m.gv.W:null}).filter(x=>x!=null);
  const logged=el.filter(hasLog),sc=el.length?SC.computeFor(el,el[el.length-1]):null;
  return{days,el,age,SR:SR_,sleep,water,kcal,stress,sess,stairDays:stairDays.size,steps:sess.reduce((a,s)=>a+s.total,0),timedMin:timed.reduce((a,s)=>a+s.dur,0),timedN:timed.length,
    exMin,exN,runs,rest,aft,rec,gv,logged,score:sc&&sc.score!=null?sc.score:null,covered:sc?sc.covered:0,
    sleepIn:sleep.filter(x=>x[1]>=SR_[0]&&x[1]<=SR_[1]).length,waterHit:water.filter(x=>x[1]>=st.s.water).length}}
function week(start){
  const days=Array.from({length:7},(_,i)=>addD(start,i)),cur=slice(days),prev=slice(days.map(d=>addD(d,-7)));
  const done=days[6]<today();
  let why='';
  if(!done)why='this week is not finished yet';
  else if(cur.score==null||cur.logged.length<3||cur.covered<3)why='this week has fewer than 3 days of logs or fewer than 3 of the 6 score areas';
  else if(prev.score==null||prev.logged.length<3||prev.covered<3)why='the week before has fewer than 3 days of logs or fewer than 3 of the 6 score areas';
  return{start,end:days[6],days,done,cur,prev,cmp:why?null:{d:cur.score-prev.score,a:prev.score,b:cur.score},cmpWhy:why}}
const defaultStart=()=>{const m=monday(today()),last=addD(m,-7),w=week(last);return w.cur.logged.length?last:m};

/* ---------- observations (what the records show) and suggestions (ideas, tied to the evidence) ---------- */
function observe(W){
  const c=W.cur,O=[];
  if(W.cmp)O.push([4,'Your Health Score was '+W.cmp.b+', '+(W.cmp.d===0?'the same as':Math.abs(W.cmp.d)+' point'+(Math.abs(W.cmp.d)===1?'':'s')+(W.cmp.d>0?' higher than':' lower than'))+' the week before ('+W.cmp.a+'). The score weighs the areas you logged; a different set of logged areas can move it.']);
  if(c.sleep.length>=3){const a=mean(c.sleep.map(x=>x[1]));O.push([a<c.SR[0]||a>c.SR[1]?3:1,'Average sleep was '+f1(a)+' h over '+c.sleep.length+' logged nights; '+c.sleepIn+' of them were inside the '+c.SR[0]+'–'+c.SR[1]+' h range given for your age.'])}
  if(c.water.length>=3){const a=mean(c.water.map(x=>x[1]));O.push([a<st.s.water?3:1,'Water averaged '+f0(a)+' mL on the '+c.water.length+' days it was logged, and reached your '+f0(st.s.water)+' mL target on '+c.waterHit+' of them.'])}
  if(c.sess.length)O.push([2,'You logged '+c.sess.length+' stair session'+(c.sess.length===1?'':'s')+' on '+c.stairDays+' day'+(c.stairDays===1?'':'s')+', '+f0(c.steps)+' steps in all'+(c.timedMin?', with '+f1(c.timedMin)+' minutes recorded.':'.')]);
  else if(c.el.length>=3)O.push([2,'No stair sessions were logged this week.']);
  if(c.rest.length>=2)O.push([1,'Resting heart rate (before a workout or logged at rest) averaged '+f0(mean(c.rest))+' BPM from '+c.rest.length+' readings, ranging '+Math.min(...c.rest)+'–'+Math.max(...c.rest)+' BPM.']);
  if(c.rec.length>=2)O.push([1,'Across '+c.rec.length+' workouts with a 1-minute reading, the pulse dropped by '+f0(mean(c.rec))+' BPM on average after stopping.']);
  if(c.stress.length>=3)O.push([1,'Self-rated stress averaged '+f1(mean(c.stress.map(x=>x[1])))+' / 10 over '+c.stress.length+' check-ins.']);
  return O.sort((a,b)=>b[0]-a[0]).slice(0,3).map(x=>x[1])}
function suggest(W){
  const c=W.cur,S=[],hide=typeof HWCond!=='undefined'&&HWCond.stairsHidden();
  if(c.sleep.length>=3){const a=mean(c.sleep.map(x=>x[1]));
    if(a<c.SR[0])S.push([3,'A steady bedtime and keeping your phone away for the last 30 minutes before sleep may help.','average sleep '+f1(a)+' h, below '+c.SR[0]+' h'])
    else if(a>c.SR[1])S.push([2,'If you still feel tired, a regular wake-up time and some daytime activity can help.','average sleep '+f1(a)+' h, above '+c.SR[1]+' h'])}
  if(c.water.length>=3){const a=mean(c.water.map(x=>x[1]));if(a<st.s.water){const g=Math.ceil((st.s.water-a)/250);S.push([3,'Keeping a bottle where you study makes it easier to drink; about '+g+' more glass'+(g>1?'es':'')+' (250 mL) on an average logged day would reach your target.','average '+f0(a)+' of '+f0(st.s.water)+' mL'])}}
  if(hide)S.push([2,'You told HealthWiz that stairs need a doctor’s OK first. Ask them before adding stair sessions; gentle, low-impact movement is a place to start.','your profile'])
  else if(!c.sess.length&&c.el.length>=3)S.push([2,'If you feel ready, an easy stair climb of about 10 minutes at a comfortable pace is a gentle way to add movement. Stop if you feel dizzy, faint or have chest pain.','no stair sessions logged'])
  else if(c.sess.length>=3)S.push([1,'Mixing easier and harder sessions gives your body time to recover.',c.sess.length+' sessions logged']);
  if(c.stress.length>=3&&mean(c.stress.map(x=>x[1]))>=7)S.push([3,'Short breaks, the Calming Grove breathing and talking to a friend, a lecturer or the college counsellor can help when stress is high.','average stress '+f1(mean(c.stress.map(x=>x[1])))+' / 10']);
  if(!c.rest.length)S.push([1,'Counting your pulse at rest before a stair workout lets heart-rate information appear in next week’s report.','no resting heart rate logged']);
  const thin=gaps(W).filter(g=>g.n<3).map(g=>g.name.toLowerCase());
  if(thin.length&&c.el.length>=3)S.push([0,'Logging '+thin.slice(0,3).join(', ')+' on a few more days would make the next summary more complete.','fewer than 3 days logged']);
  return S.sort((a,b)=>b[0]-a[0]).slice(0,3)}
function gaps(W){
  const c=W.cur,E=c.el.length,row=(name,L)=>{const have=new Set(L.map(x=>Array.isArray(x)?x[0]:x));return{name,n:have.size,miss:c.el.filter(d=>!have.has(d))}};
  return [row('Sleep',c.sleep),row('Water',c.water),row('Meals (calories)',c.kcal),row('Stairs / training',c.el.filter(d=>c.sess.some(s=>s.d===d)||A('exercise',d).length)),
    row('Heart rate',c.el.filter(d=>hrv(d,'hrB').length||hrv(d,'hrA').length)),row('Stress',c.stress)].map(r=>Object.assign(r,{E}))}

/* ---------- the report page ---------- */
const MOTIF='<svg class="rptm" viewBox="0 0 16 16" width="28" height="28" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 0h2v1h1v2h1v2h1v2H4V5h1V3h1V1h1zM3 8h10v1H3zm1 2h8v5H4zm3 2h2v3H7z"/></svg>';
const li=a=>a.length?'<ul>'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'';
function html(W){
  const c=W.cur,E=c.el.length,none=!c.logged.length,sec=(t,b)=>'<section class="rpts"><h3>'+t+'</h3>'+b+'</section>',nm=(st.p.name||'').trim();
  const kv=(k,v,n)=>'<div class="rptk"><span>'+k+'</span><b>'+v+'</b>'+(n?'<small>'+n+'</small>':'')+'</div>';
  const band=c.score==null?null:SC.band(c.score)[0];
  let scoreB;
  if(c.score==null)scoreB='<p class="rptna">Not available: no Health Score area was logged this week.</p>';
  else scoreB='<p class="rptbig"><b>'+c.score+'</b> / 100 <span>'+band+'</span></p><p>'+c.covered+' of 6 areas logged'+(c.covered<6?'; areas without logs are left out, not counted as zero':'')+'. Averaged over the '+c.logged.length+' day'+(c.logged.length===1?'':'s')+' with logs.</p>'
    +(W.cmp?'<p><b>Change from the week before:</b> '+sgn(W.cmp.d)+' point'+(Math.abs(W.cmp.d)===1?'':'s')+' ('+W.cmp.a+' → '+W.cmp.b+').</p>':'<p class="rptna"><b>Week-to-week change not shown:</b> '+W.cmpWhy+'.</p>')
    +'<small>The Health Score is a habit summary from your logs, not a medical diagnosis or a validated clinical risk score.</small>';
  const sl=c.sleep.length?kv('Nights logged',c.sleep.length+' of '+E)+kv('Average',f1(mean(c.sleep.map(x=>x[1])))+' h',range1(c.sleep.map(x=>x[1]),'h'))+kv('Within '+c.SR[0]+'–'+c.SR[1]+' h',c.sleepIn+' of '+c.sleep.length+' nights','range given for your age'):'<p class="rptna">No sleep logged this week.</p>';
  const wa=c.water.length?kv('Days logged',c.water.length+' of '+E)+kv('Average on logged days',f0(mean(c.water.map(x=>x[1])))+' mL','target '+f0(st.s.water)+' mL')+kv('Days at or above target',c.waterHit+' of '+c.water.length):'<p class="rptna">No water logged this week.</p>';
  const act=(c.sess.length||c.exN||c.runs)?kv('Stair sessions',c.sess.length+' on '+c.stairDays+' day'+(c.stairDays===1?'':'s'))+kv('Stair steps',f0(c.steps),'sum of logged sessions')
    +kv('Recorded time',f1(c.timedMin+c.exMin)+' min','stairs '+f1(c.timedMin)+' ('+c.timedN+' of '+c.sess.length+' sessions had a time) + training '+f1(c.exMin)+(c.exN?' in '+c.exN+' session'+(c.exN===1?'':'s'):''))
    +(c.runs?kv('Runs',c.runs):'')+(c.gv.length?kv('Stair Sense work against gravity',f1(c.gv.reduce((a,x)=>a+x,0)/1000)+' kJ','estimate from '+c.gv.length+' record'+(c.gv.length===1?'':'s')+' (W = m g h)'):''):'<p class="rptna">No stair or training activity logged this week.</p>';
  const hr=(c.rest.length||c.aft.length||c.rec.length)?(c.rest.length?kv('Resting heart rate',f0(mean(c.rest))+' BPM',c.rest.length+' reading'+(c.rest.length===1?'':'s')+', '+Math.min(...c.rest)+'–'+Math.max(...c.rest)):'')
    +(c.aft.length?kv('After a workout',f0(mean(c.aft))+' BPM',c.aft.length+' reading'+(c.aft.length===1?'':'s')):'')
    +(c.rec.length?kv('Recovery (pulse drop in 1 min)',f0(mean(c.rec))+' BPM',c.rec.length+' workout'+(c.rec.length===1?'':'s')+' with both readings'):'<p class="rptna">No 1-minute recovery reading this week.</p>'):'<p class="rptna">No heart rate logged this week.</p>';
  const oth=(c.kcal.length||c.stress.length)?(c.kcal.length?kv('Energy intake logged',f0(mean(c.kcal.map(x=>x[1])))+' kcal/day','on '+c.kcal.length+' day'+(c.kcal.length===1?'':'s')+'; the menu’s values are estimates'):'')+(c.stress.length?kv('Stress (self-rated)',f1(mean(c.stress.map(x=>x[1])))+' / 10',c.stress.length+' check-in day'+(c.stress.length===1?'':'s')):''):'<p class="rptna">No meals or stress check-ins logged this week.</p>';
  const ob=observe(W),su=suggest(W),G=gaps(W);
  const miss=G.map(g=>'<tr><td>'+g.name+'</td><td>'+g.n+' of '+g.E+'</td><td>'+(g.miss.length?g.miss.map(d=>DN[(parse(d).getDay()+6)%7]).join(', '):'–')+'</td></tr>').join('');
  return '<header class="rpth"><div class="rptmo">'+MOTIF+'</div><div><h2>The Wizard’s Health Chronicle</h2><p class="rptw"><b>Week of '+range(W.start,W.end)+'</b> (Monday–Sunday)</p>'
    +'<p class="rptsub">'+(W.done?'Complete week':E===7?'Last day of the week':'Week in progress')+' · '+E+' of 7 days covered'+(nm?' · '+esc(nm):'')+' · generated '+dfmt(today(),{day:'numeric',month:'short',year:'numeric'})+'</p></div></header>'
    +(none?'<p class="rptempty" role="status"><b>Nothing was logged in this week.</b> There are no values to summarise, and none have been invented. Pick another week, or log some activity and generate the report again.</p>':'')
    +'<div class="rptg">'+sec('Health Score',scoreB)+sec('Sleep',sl)+sec('Hydration',wa)+sec('Activity and stairs',act)+sec('Heart rate and recovery',hr)+sec('Meals and mind',oth)+'</div>'
    +(none?'':sec('Observations <small>what the records show</small>',ob.length?li(ob):'<p class="rptna">Not enough logged days for an observation (at least 3 days of a measure are needed).</p>')
    +sec('Suggestions <small>ideas based on the records, not medical advice</small>',su.length?'<ul>'+su.map(s=>'<li>'+s[1]+' <small>Because: '+s[2]+'.</small></li>').join('')+'</ul>':'<p class="rptna">No suggestion this week: the records are too thin for one.</p>'))
    +sec('Data completeness',(E?'<table class="rptt"><thead><tr><th>Measure</th><th>Days logged</th><th>Not logged on</th></tr></thead><tbody>'+miss+'</tbody></table>':'<p class="rptna">This week has not started.</p>')+'<small>Days without a log are left out of averages. They are not counted as zero.</small>')
    +'<footer class="rptf"><p><b>Personal wellness summary, not a medical document.</b> It does not diagnose anything. If you feel unwell or worried, talk to a parent, teacher or health professional.</p>'
    +'<p><b>Private health information.</b> Printed or shared copies can be seen by others; share only with people you trust. HealthWiz did not upload or send this report.</p></footer>'}
const range1=(a,u)=>a.length>1?'ranging '+f1(Math.min(...a))+'–'+f1(Math.max(...a))+' '+u:'';

/* ---------- the overlay ---------- */
let W0=null,start='',opener=null;
function bar(){const cur=monday(today());
  return '<div class="rptbar" role="toolbar" aria-label="Report controls"><div class="rptbtns">'
    +'<button type="button" class="g" data-a="rptprev">◀ PREVIOUS WEEK</button><button type="button" class="g" data-a="rptnext"'+(start>=cur?' disabled':'')+'>NEXT WEEK ▶</button>'
    +'<label class="rptdl">Week containing <input type="date" id="rpt-date" data-in="rptdate" max="'+today()+'" value="'+W0.start+'"></label></div>'
    +'<div class="rptbtns"><button type="button" data-a="rptprint">PRINT OR SAVE AS PDF</button><button type="button" class="g" data-a="rptclose">CLOSE</button></div>'
    +'<p class="rptwarn" role="note"><b>Private health information.</b> This report was made on this device only; nothing is uploaded or shared. A printed or saved copy can be seen by anyone who gets it. In the print window choose “Save as PDF” to keep a file.</p></div>'}
function paint(){const o=$i('hwrep');if(!o)return;W0=week(start);o.innerHTML=bar()+'<article class="rptsheet" id="rpt-sheet" aria-label="Weekly health report">'+html(W0)+'</article>'}
function openReport(s){
  closeReport(true);start=s||defaultStart();W0=week(start);opener=document.activeElement;
  const o=document.createElement('div');o.id='hwrep';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-label','Weekly health report');o.tabIndex=-1;
  document.body.appendChild(o);paint();document.body.classList.add('rptopen');
  const app=document.querySelector('.app');if(app)app.setAttribute('inert','');
  o.focus({preventScroll:true});o.scrollTop=0}
function closeReport(quiet){const o=$i('hwrep');if(o)o.remove();document.body.classList.remove('rptopen');
  const app=document.querySelector('.app');if(app)app.removeAttribute('inert');
  if(!quiet&&opener&&opener.isConnected)try{opener.focus({preventScroll:true})}catch(e){}opener=null}
acts.rptopen=()=>openReport();
acts.rptclose=()=>closeReport();
acts.rptprev=()=>{start=addD(start,-7);paint();const b=document.querySelector('#hwrep [data-a="rptprev"]');if(b)b.focus({preventScroll:true})};
acts.rptnext=()=>{if(start>=monday(today()))return;start=addD(start,7);paint();const b=document.querySelector('#hwrep [data-a="rptnext"]:not([disabled])')||document.querySelector('#hwrep [data-a="rptprev"]');if(b)b.focus({preventScroll:true})};
acts.rptprint=()=>{window.print()};
INP.rptdate=el=>{const v=el.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||v>today())return;start=monday(v);paint();const d=$i('rpt-date');if(d)d.focus({preventScroll:true})};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$i('hwrep')&&!(document.getElementById('hwh-pop')&&document.getElementById('hwh-pop').offsetParent)){e.preventDefault();closeReport()}});
HWEvents.on('data:reset',()=>closeReport(true));HWEvents.on('data:imported',()=>closeReport(true));

// the entry point: a card at the top of the Statistics page
{const p=pages.stats;pages.stats=function(){const h=p.apply(this,arguments),i=h.indexOf('</h2>');
  const c='<div class="card" id="rptcard"><h3>'+HWPixel.icon('scroll')+' WEEKLY REPORT</h3><p class="mut">A one-page summary of a week from your own logs, to print or save as a PDF. It is made only when you ask and is never sent anywhere.</p><button type="button" class="rptgen" data-a="rptopen">GENERATE WEEKLY REPORT</button></div>';
  return i<0?c+h:h.slice(0,i+5)+c+h.slice(i+5)}}

HWUI.css('report',`
body.rptopen{overflow:hidden}
#hwrep{position:fixed;inset:0;z-index:70;overflow:auto;background:var(--bg);color:var(--ink);padding:12px 12px calc(24px + env(safe-area-inset-bottom,0px));-webkit-overflow-scrolling:touch}
.rptgen{width:100%;min-height:48px;background:var(--gold);color:#2b2418;font-size:11px;letter-spacing:.05em}
.rptbar{max-width:860px;margin:0 auto 12px}.rptbtns{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}.rptbtns button{flex:1 1 140px;min-height:44px}
.rptdl{display:flex;align-items:center;gap:8px;flex:1 1 220px;font-size:13px}.rptdl input{flex:1 1 auto;min-height:44px;min-width:0;box-sizing:border-box}
.rptwarn{margin:0;padding:8px;border:3px solid var(--gold);background:var(--pn);font-size:13px}
.rptsheet{max-width:860px;margin:0 auto;padding:18px 18px 14px;background:#fff;color:#1b1b1b;border:3px solid #2b2418;box-shadow:4px 4px 0 var(--ln);font:14px/1.5 Georgia,'Times New Roman',serif}
.rptsheet h2{margin:0;font:700 22px/1.2 Georgia,serif;letter-spacing:.02em;color:#2d2350;overflow-wrap:anywhere}.rptsheet h3{margin:0 0 6px;font:700 13px/1.3 Georgia,serif;text-transform:uppercase;letter-spacing:.08em;color:#2d2350;border-bottom:1px solid #8a7fb0;padding-bottom:3px}.rptsheet h3 small{font-weight:400;text-transform:none;letter-spacing:0;color:#555}
.rpth{display:flex;gap:12px;align-items:center;border-bottom:3px double #2d2350;padding-bottom:10px;margin-bottom:12px}.rptmo{color:#4a3d86;flex:0 0 auto}.rptw{margin:4px 0 0;font-size:15px}.rptsub{margin:2px 0 0;font-size:12px;color:#444}
.rptg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px}@media(max-width:640px){.rptg{grid-template-columns:minmax(0,1fr)}.rptsheet{padding:14px 12px}.rptsheet h2{font-size:18px}}
.rpts{margin:0 0 12px;break-inside:avoid;page-break-inside:avoid;min-width:0}.rpts p{margin:3px 0}.rpts ul{margin:4px 0 0 18px;padding:0}.rpts li{margin:3px 0}.rpts small{color:#444;font-size:12px}
.rptbig{font-size:15px}.rptbig b{font:700 30px Georgia,serif;color:#2d2350}.rptbig span{margin-left:6px;font-size:13px}
.rptk{display:grid;grid-template-columns:1fr auto;gap:0 8px;padding:3px 0;border-bottom:1px dotted #aaa}.rptk span{overflow-wrap:anywhere}.rptk b{text-align:right}.rptk small{grid-column:1/-1}
.rptna{color:#555;font-style:italic}.rptempty{padding:8px 10px;border:1px solid #8a7fb0;background:#f4f1fb}
.rptt{width:100%;border-collapse:collapse;font-size:13px}.rptt th,.rptt td{border-bottom:1px solid #ccc;padding:3px 6px;text-align:left;vertical-align:top}.rptt th{border-bottom:1px solid #2d2350}
.rptf{margin-top:12px;padding-top:8px;border-top:1px solid #8a7fb0;font-size:12px;color:#333}.rptf p{margin:3px 0}
@page{size:A4;margin:12mm}
@media print{
 html,body{background:#fff!important;height:auto!important;overflow:visible!important}
 body>*:not(#hwrep){display:none!important}
 #hwrep{position:static!important;inset:auto!important;overflow:visible!important;background:#fff!important;padding:0!important;display:block!important}
 .rptbar{display:none!important}
 .rptsheet{max-width:none;margin:0;padding:0;border:0;box-shadow:none;background:#fff;color:#000;font-size:10.5pt;line-height:1.35}
 .rptsheet h2{font-size:17pt;color:#000}.rptsheet h3{font-size:9.5pt;color:#000;border-bottom:.5pt solid #000}.rptbig b{font-size:20pt;color:#000}.rptmo{color:#000}
 .rptg{gap:2mm 8mm}.rpts{margin:0 0 3mm}.rpts small,.rptsub{font-size:9pt;color:#222}.rptt{font-size:9.5pt}
 .rptempty{border:.5pt solid #000;background:none}.rptf{font-size:9pt;color:#000;border-top:.5pt solid #000}
 *{animation:none!important;transition:none!important;box-shadow:none!important;text-shadow:none!important}
}
`);
return{week,slice,observe,suggest,gaps,defaultStart,monday,open:openReport}})();
