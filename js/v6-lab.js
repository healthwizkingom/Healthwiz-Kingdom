/* v6: the Science Laboratory (master prompt Stage 3). Not part of the original.
   One page, route 'lab' (back to the Health Hall), with four sections: Be Your Own Experiment (here), the Evidence Trial
   (js/v6-trial.js), the Evidence Vault (js/v6-vault.js) and the Uncertainty Engine (js/v6-uncert.js); each registers
   itself with HWLab.section(). Doorways: a card at the end of the Health Hall and Luna's Ask Luna list.

   Be Your Own Experiment: question → prediction → plan (variables, controls, how to measure) → observations and results →
   report. Observations are the user's own saved entries, read at the moment (never copied or changed); a template may
   also be tried with the Group 14 study data (js/v6-f21.js), always labelled as someone else's measured data.
   Results are group counts and means only. With fewer than 3 observations in a compared group the conclusion is "not
   enough evidence yet" (HealthWiz's rule of thumb, said on screen); otherwise it says whether the observations lean
   towards or against the prediction, and always that this is not proof. No significance test is run: one person's few
   observations cannot support one honestly, so none is shown.
   Saved: st.lab.ex = {id:{id,t,pred,ctrl,iv,dv,at}} (schema v9); the report is rebuilt from the entries each time.
   Any climbing is optional: the plan says to go at a comfortable pace, rest or stop at any time, and stop for dizziness,
   chest pain, faintness or severe breathlessness. */
const HWLab=(()=>{
const SEC=[];
/** A section of the page: k key, name tab label, icon HWPixel icon, render() → HTML. */
function section(k,o){const i=SEC.findIndex(s=>s.k===k);if(i>=0)SEC[i]=Object.assign({k},o);else SEC.push(Object.assign({k},o))}
const L=()=>{const o=st.lab&&typeof st.lab==='object'?st.lab:(st.lab={ex:{},tr:{}});['ex','tr'].forEach(k=>{if(!o[k]||typeof o[k]!=='object')o[k]={}});return o};
const Z0=()=>({tab:'exp',step:0,t:null,pred:null,ctrl:null,iv:'sleep',dv:'stress',sample:0,from:null});
let Z=Z0();
const ico=(n,s)=>HWPixel.icon(n,s||1);
const r1=x=>Math.round(x*10)/10,fmt=x=>(r1(x)).toLocaleString('en');
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;

/* ---------- observations from the user's own entries ---------- */
const stair=id=>typeof STAIRS!=='undefined'?STAIRS.find(s=>s.id===id)||null:null;
const band=a=>HWStairs.bandOf?HWStairs.bandOf(a):(a<26?'MILD':a<=31.2?'MODERATE':'VIGOROUS');
const workouts=()=>LC('stair').filter(e=>e.m&&e.m.kind==='workout');
const hrOrigin=m=>m.hrS&&m.hrS!=='manual'?'device':'you';
const AGE=()=>+st.p.age||16;
const sleepMin=()=>SR(AGE())[0];
// IV / DV choices for a custom investigation: per day, from what the user logged
const SERIES={
  sleep:{n:'Sleep the night before',u:'h',day:d=>{const s=LC('sleep').filter(e=>e.d===d);return s.length?+s[s.length-1].v:null}},
  water:{n:'Water that day',u:'mL',day:d=>{const v=wt(d);return v>0?v:null}},
  steps:{n:'Stair steps that day',u:'steps',day:d=>{const v=sp(d);return v>0?v:null}},
  stress:{n:'Stress check-in that day (storm level)',u:'/10',day:d=>{const s=LC('stress').filter(e=>e.d===d);return s.length?+s[0].v:null}},
  energy:{n:'Energy rating that day',u:'/5',day:d=>st.en&&st.en[d]?+st.en[d].v:null}};
const IVS=['sleep','water','steps'],DVS=['stress','energy'];

/* The investigations. obs() → {rows:[{id, g (group), y, d, o (origin), note}], groups:[names, low → high], miss, unit} */
const TPL={
stairs:{q:'Does a steeper stairway raise my pulse more?',icon:'stairs',
  iv:'Stairway steepness: the intensity band of the stairway (mild under 26°, moderate 26–31.2°, vigorous over 31.2°)',
  dv:'Pulse rise: pulse after the climb − pulse before (BPM)',
  how:['Before: rest 5 minutes, then count your pulse for 60 seconds.','Climb for the same time at the same comfortable pace.','After: count your pulse straight away (the first 15–30 seconds are closest to the peak).','Log it on the Stairs page (Workout & heart rate), choosing the stairway you climbed.'],
  ctrl:['Same pace each time','Same climbing time','Rested 5 minutes before the "before" pulse','"After" pulse counted straight away'],
  preds:[['up','Steeper stairs give a bigger rise'],['none','No difference'],['down','Steeper stairs give a smaller rise']],
  conf:['your pace and the number of steps','how rested you were, caffeine and sleep','the time of day and the heat','miscounting the pulse (the Group 14 report found counting errors too)'],
  active:1,sample:1,
  obs(sample){if(sample)return f21();const rows=[];let miss=0;
    workouts().forEach(e=>{const m=e.m,s=stair(m.sid),b=+m.hrB,a=+m.hrA;if(!s||!(b>0)||!(a>0)){miss++;return}
      rows.push({id:e.id,g:band(s.angle),y:a-b,d:e.d,o:hrOrigin(m),note:s.name+' ('+s.angle+'°): '+b+' → '+a+' BPM'})});
    return{rows,groups:['MILD','MODERATE','VIGOROUS'],miss,missWhy:'workouts without a pulse before and after, or without a listed stairway',unit:'BPM'}}},
recovery:{q:'Does my pulse recover faster over the weeks?',icon:'pulse',
  iv:'Time: my earlier workouts compared with my later ones',dv:'1-minute drop: pulse just after − pulse 1 minute later (BPM)',
  how:['After a climb, count your pulse straight away, then again 1 minute later.','Type both on the Stairs page (the "1 minute after" field).','Keep the climb similar each time.'],
  ctrl:['Similar climb each time','Same counting method','Counted exactly 1 minute later'],
  preds:[['up','The drop gets bigger (faster recovery)'],['none','No change'],['down','The drop gets smaller']],
  conf:['how hard each climb was','heat, sleep and caffeine','timing the 1 minute by hand'],active:1,
  obs(){const L2=workouts().filter(e=>+e.m.hrA>0&&+e.m.hrR1>0).sort((a,b)=>(a.d+(a.t||'')).localeCompare(b.d+(b.t||''))),h=Math.floor(L2.length/2);
    const rows=L2.map((e,i)=>({id:e.id,g:i<h?'EARLIER':'LATER',y:+e.m.hrA-+e.m.hrR1,d:e.d,o:hrOrigin(e.m),note:e.m.hrA+' → '+e.m.hrR1+' BPM after 1 minute'}));
    return{rows,groups:['EARLIER','LATER'],miss:workouts().length-L2.length,missWhy:'workouts without both the "after" and the "1 minute after" pulse',unit:'BPM'}}},
sleep:{q:'Am I less stressed after a longer sleep?',icon:'sleep',
  iv:'Sleep the night before: under your recommended minimum compared with at or above it',dv:'Stress check-in that day: the storm level from the DASS-21 answers (1 calm – 10 stormy)',
  how:['Log your sleep each morning.','Do the stress check-in once a day, at about the same time.'],
  ctrl:['Stress checked at about the same time of day','Sleep logged every morning','Unusual days noted (exams, illness)'],
  preds:[['down','Longer sleep, lower stress'],['none','No difference'],['up','Longer sleep, higher stress']],
  conf:['exams, deadlines and other events','illness and caffeine','a self-rating can drift from day to day'],
  obs(){const lo=sleepMin(),rows=[];let miss=0;LC('sleep').forEach(e=>{const y=SERIES.stress.day(e.d);if(y==null){miss++;return}
    rows.push({id:e.id,g:+e.v<lo?'SHORT':'ENOUGH',y,d:e.d,o:'you',note:fmt(+e.v)+' h sleep, stress '+y+'/10'})});
    return{rows,groups:['SHORT','ENOUGH'],miss,missWhy:'nights without a stress check-in that day',unit:'/10',glab:{SHORT:'Under '+lo+' h',ENOUGH:lo+' h or more'}}}},
custom:{q:null,icon:'chart',custom:1,
  how:['Keep logging both things on the same days.','The more days, the clearer the picture.'],ctrl:['Logged at about the same time each day','Unusual days noted'],
  preds:[['up','Higher goes with higher'],['none','No difference'],['down','Higher goes with lower']],
  conf:['many other things change from day to day','one day is paired with the same day only'],
  obs(){const I=SERIES[Z.iv],D=SERIES[Z.dv],pairs=[];dys().forEach(d=>{const x=I.day(d),y=D.day(d);if(x!=null&&y!=null)pairs.push({d,x,y})});
    const xs=pairs.map(p=>p.x).sort((a,b)=>a-b),med=xs.length?xs[Math.floor(xs.length/2)]:0;
    return{rows:pairs.map(p=>({id:p.d,g:p.x<med?'LOWER':'HIGHER',y:p.y,d:p.d,o:'you',note:I.n+': '+fmt(p.x)+' '+I.u})),groups:['LOWER','HIGHER'],miss:0,unit:D.u,
      glab:{LOWER:'Lower half (under '+fmt(med)+' '+I.u+')',HIGHER:'Upper half ('+fmt(med)+' '+I.u+' or more)'}}}}};
const qOf=t=>t==='custom'?(SERIES[Z.iv].n+' and '+SERIES[Z.dv].n.toLowerCase()+': do they go together?'):TPL[t].q;
// the Group 14 sample: pulse after (3-minute average) − resting pulse before each climb, by the report's ranking of the stairs
function f21(){const G=['MILD','MODERATE','VIGOROUS'],N=['Staircase B, 26.43°','Staircase C, 27.23°','Staircase A, 28.52°'];
  return{rows:HWF21.rows().map(r=>({id:r.p+r.i,g:G[r.i],y:r.pr-r.rest,d:r.p,o:'sample',note:r.p+', '+N[r.i]+': '+fmt(r.rest)+' → '+fmt(r.pr)+' BPM'})),
    groups:G,miss:0,unit:'BPM',sampleNote:'Group 14 study: 6 students, 3 climbs each, ranked by the report (all three stairways are in the app\'s moderate band).'}}

/* ---------- results and the conclusion rule ---------- */
const MIN_N=3;
function results(t){const T=TPL[t],O=T.obs(Z.sample&&T.sample),gl=g=>(O.glab&&O.glab[g])||g[0]+g.slice(1).toLowerCase();
  const G=O.groups.map(g=>{const ys=O.rows.filter(r=>r.g===g).map(r=>r.y);return{g,name:gl(g),n:ys.length,mean:ys.length?mean(ys):null,min:ys.length?Math.min(...ys):null,max:ys.length?Math.max(...ys):null}});
  const has=G.filter(x=>x.n),lo=has[0],hi=has[has.length-1],N=O.rows.length;
  let verdict='insufficient',diff=null;
  if(has.length>=2&&lo.n>=MIN_N&&hi.n>=MIN_N){diff=hi.mean-lo.mean;const s=diff>0?'up':diff<0?'down':'none';verdict=Z.pred==='none'?'none':s===Z.pred?'towards':'against'}
  return{O,G,lo,hi,N,diff,verdict,gl}}
function conclusion(R,t){const u=R.O.unit,n=R.N;
  if(R.verdict==='insufficient')return 'Not enough evidence yet. '+(R.G.map(x=>x.name+': '+x.n).join(' · '))+'. HealthWiz compares groups only when each has at least '+MIN_N+' observations (a rule of thumb, not a statistical test).';
  const d=fmt(Math.abs(R.diff))+' '+u,dir=R.diff>0?'higher':R.diff<0?'lower':'the same';
  const what='The average in "'+R.hi.name+'" is '+(R.diff===0?'the same as':d+' '+dir+' than')+' in "'+R.lo.name+'".';
  const lean=R.verdict==='towards'?'Your observations lean towards your prediction.':R.verdict==='against'?'Your observations do not support your prediction.':'You predicted no difference: with '+n+' observations HealthWiz cannot tell whether a difference this size is real or chance, so it cannot confirm "no difference".';
  return what+' '+lean+' This is not proof: '+n+' observation'+(n===1?'':'s')+(R.O.rows.some(r=>r.o==='sample')?' from six other students':' from one person')+', and '+TPL[t].conf.slice(0,2).join(' or ')+' could explain it too.'}

/* ---------- a small group-bar chart (one measure, so no legend; the value is written on every bar, each bar can be focused
   or tapped to read it aloud, and the numbers are also in the table below). Shared with the Evidence Trial. ---------- */
function bars(vals,labels,unit,what){const ok=vals.filter(v=>v!=null),mx=Math.max(1,...ok.map(Math.abs));
  return '<div class="lbars" role="group" aria-label="'+esc(what||'Chart')+'">'+vals.map((v,i)=>{const t=labels[i]+': '+(v==null?'no data':fmt(v)+' '+unit);
    return '<div class="lbar" tabindex="0" role="img" aria-label="'+esc(t)+'" title="'+esc(t)+'"><span class="lbv">'+(v==null?'—':fmt(v))+'</span><span class="lbt"><i style="height:'+(v==null?0:Math.max(2,Math.round(Math.abs(v)/mx*100)))+'%"></i></span><span class="lbl">'+esc(labels[i])+'</span></div>'}).join('')+'</div>'}

/* ---------- the page ---------- */
/* plain-language names and one-line descriptions for each tool (the original names stay as the small label) */
const PLAIN={exp:['Test a guess','Ask a question and check it with your own logs.'],
  trial:['Spot weak evidence','A short quiz: is this data enough to believe?'],
  vault:['Where numbers come from','The formula and sources behind each number.'],
  unc:['How sure are we?','Change one assumption and watch the estimate move.']};
const tabs=()=>'<div class="labtabs" role="tablist" aria-label="Laboratory sections">'+SEC.map(s=>{const p=PLAIN[s.k]||[s.name,''],on=Z.tab===s.k;
  return '<button type="button" role="tab" class="chip labtool'+(on?' on':'')+'" aria-selected="'+on+'" data-a="labtab" data-k="'+s.k+'"><span class="labti">'+ico(s.icon,2)+'</span><span class="labtt"><small class="labtn">'+s.name+'</small><b>'+p[0]+'</b><span class="labtd">'+p[1]+'</span></span></button>'}).join('')+'</div>';
/* what each section is, why it matters and what to do first (plain language); the Vault's and the Uncertainty Engine's texts live here too so the page reads the same everywhere */
const INFO={
  exp:{what:'A guided mini-experiment: question, prediction, plan, results and a short report, using entries you already log.',why:'It shows the difference between a guess and evidence, and why a few days of data can only hint at an answer.',next:'Pick a question below. There is nothing extra to type.'},
  trial:{what:'Short reasoning questions built from the Group 14 study and, if you have logged stair workouts, from your own data.',why:'It practises spotting when data is too thin, too mixed or too small to support a conclusion.',next:'Answer the first question. A wrong answer costs nothing and you can try again.'},
  vault:{what:'The sources and calculations behind the numbers in HealthWiz: the formula the app runs, where it comes from and what it cannot tell you.',why:'So you can check where an estimate comes from instead of trusting it blindly.',next:'Search, open a calculation, or press the ? beside any result to land on its entry.'},
  unc:{what:'Shows how an estimate moves when an assumption or an input changes. Your original value always stays visible.',why:'One number looks exact, but it depends on assumptions. This shows how much.',next:'Pick an estimate, then change one choice at a time.'}};
const GLOSS=[['Observation','one saved entry used as evidence, such as one workout or one night of sleep.'],['Prediction','your guess about what you will find. A guess you can test.'],['Independent variable','the thing that changes (for example, stair steepness).'],['Dependent variable','the thing you measure to see the effect (for example, pulse rise in BPM).'],['Control','something you keep the same so it does not blur the result.'],['Mean','the average: the total divided by the number of observations.'],['n','how many observations are in a group.'],['Estimate','a number worked out from a formula and assumptions, not measured directly.']];
const intro=()=>'<div class="card labintro"><p><b>Real data, real methods.</b> Test your own questions, practise judging evidence, and see where every number comes from. Results describe patterns in your entries, not diagnoses.'+HWHelp.btn('labnote','About the Laboratory','<p>They are not diagnoses and not medical advice.</p>')+'</p>'
  +'<details class="labgl"><summary>Words and labels used here</summary><dl class="labdl">'+GLOSS.map(g=>'<dt>'+g[0]+'</dt><dd>'+g[1]+'</dd>').join('')+'</dl>'
  +'<p class="lableg"><span class="pxtag">ENTERED BY YOU</span> <span class="pxtag">MEASURED BY A DEVICE</span> <span class="pxtag">WORKED OUT</span> <span class="pxtag">ESTIMATE</span> <span class="pxtag">SAMPLE</span> Each number says which of these it is. Anything written by an AI is labelled as such where it appears.</p></details></div>';
const info=k=>{const i=INFO[k];return i?'<dl class="labinfo"><div><dt>What it is</dt><dd>'+i.what+'</dd></div><div><dt>Why it matters</dt><dd>'+i.why+'</dd></div><div><dt>Do this first</dt><dd>'+i.next+'</dd></div></dl>':''};
function page(){const s=SEC.find(x=>x.k===Z.tab)||SEC[0];
  return '<div class="labhd" id="labsc"><img class="labbg" src="assets/img/lab-scene.webp" alt="Luna\'s cosy study" width="640" height="358"><span class="labglow" aria-hidden="true"></span>'
    +'<span class="labmotes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="labluna" id="labluna" data-a="labluna" role="button" tabindex="0" title="Luna, the apprentice witch" aria-label="Luna, the apprentice witch: tap for a tip"></span>'
    +'<p class="labcap"><b>THE SCIENCE LABORATORY</b>Real data and real methods.</p></div>'+tabs()+info(s?s.k:'')+intro()
    +'<div class="labsec" role="tabpanel" aria-label="'+esc(s?s.name:'')+'">'+(s?s.render():'')+'</div>'}

/* ---------- Be Your Own Experiment ---------- */
const STEPS=['Question','Prediction','Plan','Results','Report'];
const stepBar=()=>'<ol class="labsteps" aria-label="Steps">'+STEPS.map((n,i)=>'<li class="'+(i===Z.step?'on':i<Z.step?'done':'')+'"'+(i===Z.step?' aria-current="step"':'')+'>'+(i+1)+'. '+n+'</li>').join('')+'</ol>';
const nav=(next,label)=>'<div class="row labnav">'+(Z.step?'<button type="button" class="g" data-a="labback">◀ BACK</button>':'')+(next?'<button type="button" data-a="labnext"'+(next===2?' disabled':'')+'>'+(label||'NEXT ▶')+'</button>':'')+'</div>';
const safety=()=>'<div class="warn labsafe">'+ico('warning')+' <b>Optional and at your own pace.</b> Climb only if you feel well. Rest or stop whenever you like, and stop at once if you feel dizzy, faint, very breathless or have chest pain.</div>';
function expPick(){const ex=Object.values(L().ex).sort((a,b)=>(b.at||'').localeCompare(a.at||''));
  return '<div class="card"><h3>'+ico('flask')+' BE YOUR OWN EXPERIMENT</h3><p>Pick a question. HealthWiz uses what you already log, so there is nothing extra to type.</p>'
    +'<div class="labpick">'+['stairs','recovery','sleep','custom'].map(t=>'<button type="button" class="labq" data-a="labt" data-t="'+t+'">'+ico(TPL[t].icon,2)+'<span><b>'+(t==='custom'?'My own question':esc(TPL[t].q))+'</b><small>'+(t==='custom'?'Choose two things you log and see if they go together.':TPL[t].active?'Uses your stair workouts.':'Uses your sleep and stress check-ins.')+'</small></span></button>').join('')+'</div></div>'
    +(ex.length?'<div class="card"><h3>'+ico('scroll')+' YOUR INVESTIGATIONS</h3>'+ex.map(x=>'<div class="labsv"><span><b>'+esc(x.t==='custom'?(SERIES[x.iv]||{}).n+' & '+(SERIES[x.dv]||{}).n:(TPL[x.t]||{}).q||'')+'</b><small>Saved '+esc(x.at||'')+'</small></span><button type="button" class="sm" data-a="labopen" data-id="'+esc(x.id)+'">OPEN</button><button type="button" class="g sm" data-a="labdel" data-id="'+esc(x.id)+'" aria-label="Delete this investigation">✕</button></div>').join('')+'</div>':'')}
function expPred(){const T=TPL[Z.t];
  return '<div class="card"><h3>'+ico(T.icon)+' '+esc(qOf(Z.t))+'</h3>'+(T.custom?'<p><b>Compare</b></p><div class="row" role="group" aria-label="First thing">'+IVS.map(k=>'<button type="button" class="chip'+(Z.iv===k?' on':'')+'" aria-pressed="'+(Z.iv===k)+'" data-a="labiv" data-k="'+k+'">'+SERIES[k].n+'</button>').join('')+'</div>'
      +'<p><b>with</b></p><div class="row" role="group" aria-label="Second thing">'+DVS.map(k=>'<button type="button" class="chip'+(Z.dv===k?' on':'')+'" aria-pressed="'+(Z.dv===k)+'" data-a="labdv" data-k="'+k+'">'+SERIES[k].n+'</button>').join('')+'</div>':'')
    +'<p><b>What do you think will happen?</b> A prediction is a guess you can test. Any answer is fine.</p>'
    +'<div class="labpreds" role="radiogroup" aria-label="Your prediction">'+T.preds.map(p=>'<button type="button" role="radio" class="chip'+(Z.pred===p[0]?' on':'')+'" aria-checked="'+(Z.pred===p[0])+'" data-a="labpred" data-p="'+p[0]+'">'+esc(T.custom&&p[0]!=='none'?p[1].replace('Higher goes with',SERIES[Z.iv].n+' higher goes with').replace(/higher$|lower$/,m=>m+' '+SERIES[Z.dv].n.toLowerCase()):p[1])+'</button>').join('')+'</div>'
    +nav(Z.pred?1:2)+'</div>'}
function expPlan(){const T=TPL[Z.t],ctrl=Z.ctrl||(Z.ctrl=T.ctrl.map(()=>1));
  return '<div class="card"><h3>'+ico('scroll')+' YOUR PLAN</h3><dl class="labdl"><dt>Changes (independent variable)</dt><dd>'+esc(T.custom?SERIES[Z.iv].n+' (per day, split at its middle value)':T.iv)+'</dd>'
    +'<dt>Measured (dependent variable)</dt><dd>'+esc(T.custom?SERIES[Z.dv].n:T.dv)+'</dd></dl>'
    +'<p><b>Keep these the same</b> (controls). Untick any you could not keep; the report will say so.</p>'
    +T.ctrl.map((c,i)=>'<label class="labck"><input type="checkbox" data-in="labctrl" data-i="'+i+'"'+(ctrl[i]?' checked':'')+'> '+esc(c)+'</label>').join('')
    +'<p><b>How to measure</b></p><ol class="labhow">'+T.how.map(h=>'<li>'+esc(h)+'</li>').join('')+'</ol>'+(T.active?safety():'')
    +'<div class="row">'+(T.active?'<button type="button" class="g sm" data-a="go" data-v="pulse">LOG A WORKOUT</button>':Z.t==='sleep'?'<button type="button" class="g sm" data-a="go" data-v="sleep">LOG SLEEP</button><button type="button" class="g sm" data-a="go" data-v="stress">STRESS CHECK-IN</button>':'')+'</div>'
    +nav(1,'SEE RESULTS ▶')+'</div>'}
function table(R){if(!R.O.rows.length)return '';const u=R.O.unit,lab={you:'ENTERED BY YOU',device:'MEASURED BY A DEVICE',sample:'SAMPLE: GROUP 14 (MEASURED)'};
  return '<details class="labtbl"><summary>Every observation ('+R.O.rows.length+')</summary><div class="tscroll"><table class="tbl"><thead><tr><th>Group</th><th>Value ('+esc(u)+')</th><th>Details</th><th>Source</th></tr></thead><tbody>'
    +R.O.rows.map(r=>'<tr><td>'+esc(R.gl(r.g))+'</td><td>'+fmt(r.y)+'</td><td>'+esc(r.note)+(r.o!=='sample'?' · '+esc(r.d):'')+'</td><td><span class="pxtag">'+lab[r.o]+'</span></td></tr>').join('')+'</tbody></table></div></details>'}
function expResults(){const T=TPL[Z.t],R=results(Z.t),u=R.O.unit,has=R.G.some(x=>x.n);
  const chartH=has?bars(R.G.map(x=>x.mean==null?null:r1(x.mean)),R.G.map(x=>x.name),u,'Average in each group, '+u):'';
  return '<div class="card"><h3>'+ico('chart')+' OBSERVATIONS AND RESULTS</h3>'
    +(T.sample?'<div class="row" role="group" aria-label="Whose data"><button type="button" class="chip'+(!Z.sample?' on':'')+'" aria-pressed="'+!Z.sample+'" data-a="labsample" data-v="0">My data</button><button type="button" class="chip'+(Z.sample?' on':'')+'" aria-pressed="'+!!Z.sample+'" data-a="labsample" data-v="1">Group 14 sample</button></div>':'')
    +(R.O.sampleNote?'<p class="labsamp"><span class="pxtag">SAMPLE</span> '+esc(R.O.sampleNote)+' These are other students\' measurements, not yours.</p>':'')
    +(has?'<p class="mut">Average '+esc((T.custom?SERIES[Z.dv].n:T.dv).split(':')[0].toLowerCase())+' in each group ('+esc(u)+').</p>'+chartH:'<p><b>No observations yet.</b> Follow the plan, log a few times, and come back: your results appear here.</p>')
    +'<div class="grid labg">'+R.G.map(x=>'<div class="t">'+esc(x.name)+'<b>'+(x.n?fmt(x.mean):'—')+'<small> '+esc(u)+'</small></b><small>n = '+x.n+(x.n?' · '+fmt(x.min)+' to '+fmt(x.max):'')+'</small></div>').join('')+'</div>'
    +(R.O.miss?'<p class="mut">Left out: '+R.O.miss+' '+esc(R.O.missWhy||'entries without both values')+'. Nothing is filled in for them.</p>':'')
    +table(R)+'<div class="labverdict"><b>What this shows</b><p>'+esc(conclusion(R,Z.t))+'</p></div>'+nav(1,'WRITE MY REPORT ▶')+'</div>'}
function report(t){const T=TPL[t],R=results(t),pred=(T.preds.find(p=>p[0]===Z.pred)||['',''])[1],ctrl=Z.ctrl||T.ctrl.map(()=>1),kept=T.ctrl.filter((c,i)=>ctrl[i]),lost=T.ctrl.filter((c,i)=>!ctrl[i]);
  return[['Question',qOf(t)],['Prediction',pred],
    ['Method','Changed: '+(T.custom?SERIES[Z.iv].n:T.iv)+'. Measured: '+(T.custom?SERIES[Z.dv].n:T.dv)+'. Kept the same: '+(kept.join('; ')||'none ticked')+'. Data: '+(Z.sample&&T.sample?'the Group 14 study (measured by other students)':'my own HealthWiz entries')+'.'],
    ['Observations',R.N+' observation'+(R.N===1?'':'s')+': '+R.G.map(x=>x.name+' '+x.n).join(', ')+(R.O.miss?'; '+R.O.miss+' left out ('+(R.O.missWhy||'missing values')+')':'')+'.'],
    ['Results',R.G.filter(x=>x.n).map(x=>x.name+': average '+fmt(x.mean)+' '+R.O.unit+' (n = '+x.n+')').join('; ')||'No observations yet.'],
    ['Limitations',(lost.length?'Not kept the same: '+lost.join('; ')+'. ':'')+'Other things that could matter: '+T.conf.join('; ')+'. Small numbers of observations; a link in time does not show cause.'],
    ['Conclusion',conclusion(R,t)]]}
function expReport(){const P=report(Z.t);
  return '<div class="card labrep" id="labrep"><h3>'+ico('scroll')+' MY INVESTIGATION REPORT</h3>'+P.map(p=>'<h4>'+p[0].toUpperCase()+'</h4><p>'+esc(p[1])+'</p>').join('')
    +'<div class="row"><button type="button" data-a="labsave">SAVE INVESTIGATION</button><button type="button" class="g" data-a="labcopy">COPY REPORT</button><button type="button" class="g" data-a="labnew">START A NEW ONE</button></div>'
    +'<small class="mut">Saving keeps your question, prediction and controls; the results are worked out again from your entries each time you open it.</small>'+nav(0)+'</div>'}
function expRender(){return stepBar()+[expPick,expPred,expPlan,expResults,expReport][Z.step]()}
section('exp',{name:'Experiment',icon:'flask',render:expRender});

/* ---------- actions ---------- */
const re=()=>{render();const p=document.querySelector('.labsec');if(p&&p.scrollIntoView&&Z.step)p.scrollIntoView({block:'start'})};
acts.labtab=d=>{if(SEC.some(s=>s.k===d.k)){Z.tab=d.k;render();const b=document.querySelector('[data-a="labtab"][data-k="'+d.k+'"]');if(b)b.focus()}};
acts.labt=d=>{if(!TPL[d.t])return;Object.assign(Z,{t:d.t,step:1,pred:null,ctrl:null,sample:0});re()};
acts.labpred=d=>{Z.pred=d.p;render()};
acts.labiv=d=>{if(SERIES[d.k]){Z.iv=d.k;render()}};acts.labdv=d=>{if(SERIES[d.k]){Z.dv=d.k;render()}};
acts.labnext=()=>{if(Z.step===1&&!Z.pred)return;if(Z.step<4){Z.step++;re()}};
acts.labback=()=>{if(Z.step>0){Z.step--;if(!Z.step)Z.t=null;re()}};
acts.labsample=d=>{Z.sample=+d.v?1:0;render()};
acts.labnew=()=>{Object.assign(Z,{step:0,t:null,pred:null,ctrl:null,sample:0});re()};
acts.labsave=()=>{const id=Z.from||'x'+Date.now().toString(36);L().ex[id]={id,t:Z.t,pred:Z.pred,ctrl:(Z.ctrl||[]).slice(),iv:Z.iv,dv:Z.dv,at:today()};Z.from=id;save();toast('Investigation saved');HWEvents.emit('lab:saved',{id,t:Z.t})};
acts.labopen=d=>{const x=L().ex[d.id];if(!x||!TPL[x.t])return;Object.assign(Z,{tab:'exp',t:x.t,pred:x.pred,ctrl:Array.isArray(x.ctrl)?x.ctrl.slice():null,iv:SERIES[x.iv]?x.iv:'sleep',dv:SERIES[x.dv]?x.dv:'stress',step:3,sample:0,from:x.id});re()};
acts.labdel=d=>{const E=L().ex;if(!E[d.id])return;if(Z.del!==d.id){Z.del=d.id;toast('Tap ✕ again to delete this investigation');return}delete E[d.id];Z.del=null;save();render();toast('Investigation deleted')};
acts.labcopy=()=>{const t=report(Z.t).map(p=>p[0]+': '+p[1]).join('\n\n');const ok=()=>toast('Report copied');
  try{if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,()=>toast('Copy is not available here: select the report text instead'));else toast('Copy is not available here: select the report text instead')}catch(e){toast('Copy is not available here: select the report text instead')}};
document.addEventListener('change',e=>{const t=e.target;if(t&&t.dataset&&t.dataset.in==='labctrl'&&Z.ctrl){Z.ctrl[+t.dataset.i]=t.checked?1:0}});
acts.labgo=()=>go('lab');

/* ---------- the laboratory scene: Luna's cosy study, the owner's painted room (assets/img/lab-scene.webp, tools/art/make_luna_lab.py)
   with Luna in front; the lanterns', candle's and fireplace's glow and a few motes are CSS (opacity and transform only), still with reduced motion ---------- */
function startScene(){const lu=document.getElementById('labluna');if(lu&&!lu.firstChild)HWLuna.mount(lu,{kind:'full',cycle:1,sheet:'lab'})}
acts.labluna=()=>{
  if(typeof sfx==='function')sfx(880,.12);
  const lu=document.getElementById('labluna');
  if(lu){lu.classList.add('v6lhop');setTimeout(()=>lu.classList.remove('v6lhop'),500)}
  // Encouragement only: no claim about data. What is measured, estimated or unverified is said on each section itself.
  const tips=['"Science and magic work best together!"','"Every number here says where it came from."','"Keep up the great habits, adventurer!"','"Check the method before you trust the result."'];
  toast(tips[Math.floor(Math.random()*tips.length)]);
};
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.id==='labluna'){e.preventDefault();acts.labluna()}});

/* ---------- registration: route, banner, doorways ---------- */
pages.lab=()=>page();
PAR.lab='health';
BN.lab=['🧪','Science Laboratory','Ask a question. Test it with your own data.','rgba(139,92,240,.24)'];
DIS.lab='The Laboratory uses your own entries and, where shown, the Group 14 study data. Results describe patterns, never causes, diagnoses or medical advice. HealthWiz is a wellness tracker, not a medical device.';
{const r=render;render=function(){const x=r.apply(this,arguments);if(S.v==='lab')try{startScene()}catch(e){}return x}}
const door=()=>'<div class="card labdoor" id="lab-door"><h3>'+ico('flask')+' SCIENCE LABORATORY</h3><p>Test your own questions with your logs, try the Evidence Trial, open the Evidence Vault, and see how sure each estimate is.</p><button type="button" data-a="labgo">ENTER THE LABORATORY</button></div>';
{const p=pages.health;pages.health=function(){return p.apply(this,arguments)+door()}}
HWEvents.on('data:reset',()=>{Z=Z0()});HWEvents.on('data:imported',()=>{Z.from=null});

HWUI.css('lab',`
.labhd{position:relative;margin:0 0 14px;border-radius:14px;overflow:hidden;line-height:0;background:#141033;
  box-shadow:0 0 0 2px rgba(196,166,255,.6),inset 0 0 24px rgba(99,230,220,.22),0 0 32px rgba(139,92,240,.5),0 14px 36px rgba(10,6,40,.6);transition:box-shadow .3s ease}
.labhd:hover{box-shadow:0 0 0 2px rgba(246,201,79,.75),inset 0 0 28px rgba(99,230,220,.3),0 0 38px rgba(139,92,240,.65),0 16px 40px rgba(10,6,40,.7)}
.labbg{display:block;width:100%;height:auto;aspect-ratio:640/358;image-rendering:auto;transform-origin:center center;
  animation:labSceneHd 12s ease-in-out infinite alternate}   /* the HD painting, not pixel art: drawn smoothed */
@keyframes labSceneHd{0%{transform:scale(1)}100%{transform:scale(1.03)}}
.labhd:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,16,51,0) 45%,rgba(20,16,51,.85) 100%);pointer-events:none}
.labglow{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;
  background:radial-gradient(circle at 36% 26%,rgba(255,196,96,.55),rgba(255,160,60,.22) 8%,transparent 16%),
    radial-gradient(circle at 65% 21%,rgba(255,196,96,.55),rgba(255,160,60,.22) 8%,transparent 16%),
    radial-gradient(circle at 87% 71%,rgba(255,140,50,.5),rgba(255,110,40,.2) 10%,transparent 20%),
    radial-gradient(circle at 10% 66%,rgba(255,214,128,.5),rgba(255,180,80,.18) 6%,transparent 13%);
  animation:labglow 3.2s ease-in-out infinite alternate}   /* two lanterns, the fireplace and the desk candle */
@keyframes labglow{0%{opacity:.5}45%{opacity:.95}100%{opacity:.65}}
.labmotes i{position:absolute;bottom:10%;width:3px;height:3px;border-radius:50%;background:#c4fff7;box-shadow:0 0 10px 2px rgba(99,230,220,.9);opacity:0;animation:labmote 5s cubic-bezier(.25,.46,.45,.94) infinite}
.labmotes i:nth-child(1){left:12%;animation-duration:5.5s}
.labmotes i:nth-child(2){left:26%;animation-delay:.8s;animation-duration:6.2s;background:#fff0a8;box-shadow:0 0 10px 2px rgba(246,201,79,.9)}
.labmotes i:nth-child(3){left:42%;animation-delay:1.6s;animation-duration:4.8s}
.labmotes i:nth-child(4){left:56%;animation-delay:2.4s;animation-duration:5.8s;background:#efe8ff;box-shadow:0 0 10px 2px rgba(139,92,240,.9)}
.labmotes i:nth-child(5){left:20%;animation-delay:3.2s;animation-duration:6.5s}
.labmotes i:nth-child(6){left:50%;animation-delay:4s;animation-duration:5.2s;background:#fff0a8}
.labmotes i:nth-child(7){left:34%;animation-delay:.4s;animation-duration:5s;width:2px;height:2px}
.labmotes i:nth-child(8){left:64%;animation-delay:1.2s;animation-duration:6s;background:#8ff0ff}
.labmotes i:nth-child(9){left:16%;animation-delay:2.8s;animation-duration:5.4s}
.labmotes i:nth-child(10){left:48%;animation-delay:3.6s;animation-duration:4.6s;background:#efe8ff}
.labmotes i:nth-child(11){left:72%;animation-delay:2.1s;animation-duration:6.8s}
.labmotes i:nth-child(12){left:30%;animation-delay:4.4s;animation-duration:5.7s;background:#c4fff7}
@keyframes labmote{0%{opacity:0;transform:translateY(0) scale(.6)}15%{opacity:1;transform:translateY(-20px) scale(1.1)}85%{opacity:.85}100%{opacity:0;transform:translateY(-155px) scale(.4)}}
.labluna{position:absolute;right:2%;bottom:1%;height:84%;aspect-ratio:2/3;z-index:2;line-height:0;cursor:pointer;transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
.labluna:hover{transform:scale(1.05) translateY(-3px)}
.labluna:hover .v6lfi{filter:contrast(1.12) saturate(1.3) brightness(1.06) drop-shadow(0 0 16px rgba(168,85,247,.9)) drop-shadow(0 0 6px rgba(246,201,79,.7))}
.labluna.v6lhop{animation:animeJoyHop .45s cubic-bezier(.34,1.56,.64,1)}
@keyframes animeJoyHop{0%,100%{transform:scale(1) translateY(0)}50%{transform:scale(1.08) translateY(-14px)}}
.labluna .v6lfull{display:block;width:100%!important;height:100%!important}
.labcap{position:absolute;left:12px;bottom:10px;z-index:2;margin:0;max-width:60%;font:13px/1.45 var(--fb);color:#efe8ff;text-shadow:0 1px 2px #0a0628}
.labcap b{display:block;font:12px/1.8 var(--fl);color:#fff0a8;letter-spacing:.5px;text-shadow:0 0 8px rgba(246,201,79,.7)}
@media(prefers-reduced-motion:reduce){.labbg,.labglow,.labmotes i{animation:none!important}.labmotes{display:none}}html.hw-q-performance .labmotes{display:none}
html.hw-rm .labbg,html.hw-rm .labglow,html.hw-q-performance .labbg,html.hw-q-performance .labglow{animation:none!important}
.labluna:focus-visible{outline:2px solid var(--gold,#f6c94f);outline-offset:2px;border-radius:8px}
.labtabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}.labtabs .chip{min-height:44px;display:inline-flex;align-items:center;gap:6px}
.labsteps{display:flex;flex-wrap:wrap;gap:4px 10px;list-style:none;padding:0;margin:0 0 10px;font:12px/1.8 var(--fl);color:var(--mut)}.labsteps .on{color:var(--ink);text-decoration:underline}.labsteps .done{color:var(--grn)}
.labpick{display:grid;gap:8px}.labq{display:flex;gap:10px;align-items:center;text-align:left;min-height:56px;width:100%;padding:8px 10px}
.labq span{min-width:0}.labq b{display:block;font:13px/1.4 var(--fb);font-weight:700;text-transform:none;letter-spacing:0}.labq small{display:block;font:12px/1.4 var(--fb);text-transform:none;letter-spacing:0;color:var(--mut)}
.labpreds{display:grid;gap:6px;margin:8px 0}.labpreds .chip{min-height:44px;text-align:left;text-transform:none;font:13px/1.4 var(--fb)}
.labdl dt{font:12px/1.6 var(--fl);color:var(--vio);margin-top:8px}.labdl dd{margin:2px 0 0}
.labck{display:flex;gap:8px;align-items:center;min-height:44px}.labck input{width:22px;height:22px;flex:0 0 auto}
.labhow{margin:4px 0 8px;padding-left:20px}.labhow li{margin:4px 0}.labsafe{margin:8px 0}.labnav{margin-top:12px}.labnav button{min-height:44px}
.labg{margin:10px 0}.labsamp{font-size:13px}.labverdict{margin:12px 0 0;padding:8px 10px;border:3px solid var(--ln);background:var(--p2)}.labverdict p{margin:4px 0 0}
.labtbl{margin:10px 0}.labtbl summary{cursor:pointer;min-height:44px;display:flex;align-items:center}
.labrep h4{font:12px/1.6 var(--fl);color:var(--vio);margin:12px 0 2px}.labrep p{margin:0}.labrep .row{margin-top:12px}
.labsv{display:flex;gap:8px;align-items:center;border-top:2px solid var(--ln);padding:8px 0}.labsv span{flex:1 1 auto;min-width:0}.labsv b,.labsv small{display:block}.labsv small{color:var(--mut)}
.labdoor button{width:100%;min-height:44px}
.labintro{padding:10px 12px}.labintro p{margin:0 0 4px;font-size:14px;line-height:1.45}.labgl summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:700}.labgl summary:focus-visible,.labtabs .chip:focus-visible{outline:3px solid var(--gold,#f6c94f);outline-offset:2px}
.labgl dt{font:12px/1.6 var(--fl);color:var(--vio);margin-top:8px}.labgl dd{margin:2px 0 0}.lableg{margin-top:10px!important;font-size:13px}
.labinfo{display:grid;gap:6px;margin:0 0 12px;padding:10px 12px;border:3px solid var(--ln);background:var(--p2)}
.labinfo>div{display:grid;grid-template-columns:7.5em 1fr;gap:4px 10px}.labinfo dt{font:12px/1.8 var(--fl);color:var(--vio)}.labinfo dd{margin:0}
.labtabs .chip{transition:transform .12s ease,box-shadow .12s ease}.labtabs .chip:active{transform:translate(1px,1px)}
@media(max-width:480px){.labinfo>div{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){.labtabs .chip{transition:none}}
.lbars{display:flex;gap:8px;align-items:stretch;height:150px;margin:8px 0;padding:4px 0 0;border-bottom:3px solid var(--ln)}
.lbar{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:stretch;text-align:center;outline-offset:2px}
.lbv{font:700 13px var(--fb)}.lbt{flex:1 1 auto;display:flex;align-items:flex-end;justify-content:center}.lbt i{display:block;width:70%;max-width:56px;background:var(--vio);border:3px solid var(--ln);border-bottom:0;box-shadow:inset -4px 0 0 rgba(0,0,0,.18)}
.lbl{font-size:12px;line-height:1.25;margin-top:4px;overflow-wrap:anywhere;color:var(--ink)}.lbar:focus-visible{outline:3px solid var(--gold)}
@media(max-width:420px){.labcap{font-size:12px;max-width:58%}.labcap b{font-size:12px}}
`);
return{section,L,Z:()=>Z,TPL,SERIES,results,conclusion,report,f21,MIN_N,bars}})();
