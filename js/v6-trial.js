/* v6: the Evidence Trial (master prompt Feature F), a section of the Science Laboratory (js/v6-lab.js). Not part of the original.
   Short reasoning questions, one at a time, built from real data: the Group 14 study (js/v6-f21.js, labelled as such) and,
   when the user has logged stair workouts, their own data. The right answer is never typed in: it is worked out from the
   data when the question is shown (HWF21.facts(), HWLab.results()), so a question cannot drift from what the data say.
   An optional hint, immediate feedback with the reason, then the data behind it (a chart and the numbers). Wrong answers
   cost nothing and can be tried again. Reasoning is rewarded, never health outcomes: the first correct answer to each
   question gives 5 XP once (st.lab.tr[id] = {ok:1, at}); recognising "not enough evidence" counts as reasoning too. */
const HWTrial=(()=>{
const Z={i:0,pick:null,hint:0};
const ico=(n,s)=>HWPixel.icon(n,s||1);
const r1=x=>Math.round(x*10)/10,fmt=x=>r1(x).toLocaleString('en');
const SAMPLE='<span class="pxtag">REAL DATA: GROUP 14 STUDY</span>',MINE='<span class="pxtag">YOUR DATA</span>';
// each question: id, tag, q (text), choices [{t, ok}], why (shown after any answer), hint, data() → HTML
function questions(){const F=HWF21.facts(),R=HWF21.rows(),by=i=>R.filter(r=>r.i===i),avgPR=[0,1,2].map(i=>by(i).reduce((s,r)=>s+r.pr,0)/6);
  const topA=HWF21.P.every((x,p)=>{const r=R.filter(q=>q.pi===p);return r[2].pr>r[0].pr&&r[2].pr>r[1].pr});
  const bmiMax=R.filter(r=>r.i===0).reduce((b,r)=>r.bmi>b.bmi?r:b),riseMax=F.rise.indexOf(Math.max(...F.rise)),bmiP=HWF21.P[bmiMax.pi].id,riseP=HWF21.P[riseMax].id;
  const bad=R.find(r=>!r.valid);
  const Q=[
  {id:'steep',tag:SAMPLE,q:'In the Group 14 study, which staircase gave the highest pulse rate after climbing, for every one of the six students?',
    choices:[{t:'Staircase A (Generator, 28.52°), the steepest',ok:topA},{t:'Staircase B (Block Kenanga, 26.43°), the least steep',ok:false},{t:'It was a different staircase for each student',ok:!topA}],
    hint:'Compare each student\'s three pulse rates (mild, moderate, vigorous).',
    why:topA?'For all six students the vigorous climb on Staircase A gave the highest pulse rate (report, Table 7), which matches the ranking by angle.':'The highest pulse rate was not always on the same staircase.',
    data:()=>HWLab.bars(avgPR.map(r1),['B 26.43°','C 27.23°','A 28.52°'],'BPM','Average pulse rate after each staircase')+tbl(['Student','Mild (B)','Moderate (C)','Vigorous (A)'],HWF21.P.map((x,p)=>[x.id].concat(R.filter(q=>q.pi===p).map(q=>fmt(q.pr))))),
    note:'Bars: the average of the six students. Table: each student, in BPM.'},
  {id:'bmi',tag:SAMPLE,q:'Did the student with the highest BMI have the biggest rise in pulse rate from the mild to the vigorous climb?',
    choices:[{t:'Yes: the highest BMI had the biggest rise',ok:bmiP===riseP},{t:'No: in this group of six, BMI did not predict the rise',ok:bmiP!==riseP},{t:'BMI and pulse cannot be compared at all',ok:false}],
    hint:'Find the student with the highest BMI, then the student with the biggest rise.',
    why:bmiP!==riseP?'The highest BMI was '+bmiP+' ('+fmt(bmiMax.bmi)+'), but the biggest rise was '+riseP+' ('+fmt(F.rise[riseMax])+'%). With only six students this says nothing about BMI in general (report, Section 4.2).':'Here the same student had both.',
    data:()=>HWLab.bars(F.rise.map(r1),HWF21.P.map((x,p)=>x.id+' · BMI '+fmt(HWF21.bmi(p))),'%','Rise in pulse rate, mild to vigorous')+tbl(['Student','BMI (kg/m²)','Rise, mild → vigorous'],HWF21.P.map((x,p)=>[x.id,fmt(HWF21.bmi(p)),fmt(F.rise[p])+'%'])),
    note:'Rise in pulse rate from the mild to the vigorous climb, %.'},
  {id:'valid',tag:SAMPLE,q:bad.p+'\'s pulse after the '+bad.int.toLowerCase()+' climb averaged '+fmt(bad.pr)+' BPM, but the resting pulse before it was '+bad.rest+' BPM. The formula gives VO₂ = '+fmt(bad.vo2)+' mL/kg/min. What should be done with this number?',
    choices:[{t:'Use it: it is simply a low VO₂',ok:false},{t:'Do not interpret it: the pulse after is below the resting pulse, so it cannot be a maximum',ok:true},{t:'Round it up to 15.3',ok:false}],
    hint:'The formula assumes the pulse after climbing is the highest pulse. Is it higher than at rest?',
    why:'pulse after ÷ resting pulse = '+fmt(bad.pr)+' ÷ '+bad.rest+' = '+(Math.round(bad.ratio*100)/100)+', below 1. The report marks '+F.invalid+' of its '+F.n+' results like this and does not interpret them (Section 4.4).',
    data:()=>tbl(['Result','Pulse after ÷ rest','VO₂ (mL/kg/min)','Usable?'],R.map(r=>[r.p+' '+r.int.toLowerCase(),(Math.round(r.ratio*100)/100).toFixed(2),fmt(r.vo2),r.valid?'yes':'no: below 1'])),
    note:'All 18 results of the study.'},
  {id:'cause',tag:SAMPLE,q:'Steeper stairs went with higher pulse rates in the study. Does this prove that the steepness caused the higher pulse?',
    choices:[{t:'Yes, it is proven',ok:false},{t:'It supports the idea, but pace and the number of steps were not controlled, so they could explain part of it',ok:true},{t:'No, steepness has no effect at all',ok:false}],
    hint:'What else changed between the climbs, apart from the staircase?',
    why:'The report lists uncontrolled pace and step count, a small angle range (2.09°) and six participants as limitations (Section 4.7). A pattern that fits a prediction supports it; it does not prove it.',
    data:()=>'<p>Angles: 26.43°, 27.23°, 28.52° (a range of 2.09°). Six male students aged 18; one session each.</p>'},
  {id:'next',tag:SAMPLE,q:'Many pulses counted after climbing were lower than expected. Which change would bring the measured pulse closest to the true peak?',
    choices:[{t:'Count the pulse in the first 15–30 seconds straight after climbing',ok:true},{t:'Count for longer, over 5 minutes',ok:false},{t:'Rest for a minute before counting',ok:false}],
    hint:'Compare the first 30-second count with the 3-minute average.',
    why:'The pulse falls during recovery, so counting straight away is nearest the peak. The report recommends it (Section 4.8); using the first 30 seconds made '+(18-HWF21.P.reduce((n,x,p)=>n+[0,1,2].filter(i=>HWF21.vo2(p,i,'first').ratio<1).length,0))+' of 18 results usable instead of '+(F.n-F.invalid)+'.',
    data:()=>HWLab.bars(HWF21.P.map((x,p)=>r1(HWF21.interval(p,2,0))),HWF21.P.map(x=>x.id),'BPM','First 30 seconds after the vigorous climb')+tbl(['Student','First 30 s','3-minute average'],HWF21.P.map((x,p)=>[x.id,fmt(HWF21.interval(p,2,0)),fmt(HWF21.pr(p,2))])),
    note:'After the vigorous climb, BPM.'},
  {id:'claim',tag:SAMPLE,q:'The report says the vigorous climb gave the highest energy release for every student. Checking its own Table 9, is that right?',
    choices:[{t:'Yes, for all six',ok:F.vigorousTop===6},{t:'For '+F.vigorousTop+' of the six: for one student the moderate climb was higher',ok:F.vigorousTop===5},{t:'For none of them',ok:F.vigorousTop===0}],
    hint:'For each student, find the largest of the three energy values.',
    why:'Highest energy by student: '+HWF21.P.map((x,p)=>x.id+' '+F.kjTop[p].toLowerCase()).join(', ')+'. Checking a claim against the data is good science, even in your own report.',
    data:()=>tbl(['Student','Mild (kJ)','Moderate (kJ)','Vigorous (kJ)'],HWF21.P.map((x,p)=>[x.id].concat(R.filter(q=>q.pi===p).map(q=>fmt(q.kj))))),
    note:'Estimated energy in 3 minutes (report, Table 9).'}];
  const mine=HWLab.TPL.stairs.obs(0);
  if(mine.rows.length){const z=HWLab.Z(),keep={pred:z.pred,sample:z.sample};z.pred='up';z.sample=0;const R2=HWLab.results('stairs');z.pred=keep.pred;z.sample=keep.sample;
    const ins=R2.verdict==='insufficient',lean=!ins&&R2.diff>0;
    Q.push({id:'mine',tag:MINE,q:'From your own logged workouts, can you already say that steeper stairs raise your pulse more?',
      choices:[{t:'Not yet: too few workouts in each group to compare',ok:ins},{t:'The averages lean that way, but it is not proof',ok:!ins&&lean},{t:'The averages do not lean that way',ok:!ins&&!lean}],
      hint:'Count your workouts in each intensity band.',
      why:ins?'HealthWiz compares groups only with at least '+HWLab.MIN_N+' workouts in each. Recognising that there is not enough evidence yet is the right call.':'Your band averages: '+R2.G.filter(g=>g.n).map(g=>g.name+' '+fmt(g.mean)+' BPM (n = '+g.n+')').join(', ')+'.',
      data:()=>tbl(['Band','Workouts','Average rise (BPM)'],R2.G.map(g=>[g.name,String(g.n),g.n?fmt(g.mean):'—'])),note:'Pulse after − pulse before, from your Stairs page.'})}
  return Q}
function tbl(h,rows){return '<div class="tscroll"><table class="tbl"><thead><tr>'+h.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
function renderT(){const Q=questions(),T=HWLab.L().tr,i=Math.min(Z.i,Q.length-1),q=Q[i],done=Q.filter(x=>T[x.id]&&T[x.id].ok).length,ans=Z.pick!=null,ok=ans&&q.choices[Z.pick].ok;
  return '<div class="card trial"><h3>'+ico('quest')+' THE EVIDENCE TRIAL</h3><p class="mut">One question at a time. Wrong answers cost nothing: think, try again, look at the data. '+done+' of '+Q.length+' reasoned out.</p>'
    +'<p class="trn">Question '+(i+1)+' of '+Q.length+' '+q.tag+'</p><p class="trq" id="trq">'+esc(q.q)+'</p>'
    +'<div class="trc" role="radiogroup" aria-labelledby="trq">'+q.choices.map((c,k)=>'<button type="button" role="radio" class="chip'+(Z.pick===k?(c.ok?' ok':' no'):'')+'" aria-checked="'+(Z.pick===k)+'" data-a="trpick" data-k="'+k+'">'+esc(c.t)+'</button>').join('')+'</div>'
    +(!ans?(Z.hint?'<p class="trhint">'+ico('help')+' '+esc(q.hint)+'</p>':'<button type="button" class="g sm" data-a="trhint">SHOW A HINT</button>'):'')
    +(ans?'<div class="trfb '+(ok?'ok':'no')+'" role="status"><b>'+(ok?'Well reasoned.':'Not quite. Have another look.')+'</b><p>'+esc(q.why)+'</p></div>'
      +'<div class="trdata"><b>THE DATA</b>'+(q.note?'<p class="mut">'+esc(q.note)+'</p>':'')+q.data()+'</div>':'')
    +'<div class="row trnav">'+(i?'<button type="button" class="g" data-a="trgo" data-i="'+(i-1)+'">◀ PREVIOUS</button>':'')+(ans&&!ok?'<button type="button" class="g" data-a="trretry">TRY AGAIN</button>':'')+(i<Q.length-1?'<button type="button"'+(ans?'':' class="g"')+' data-a="trgo" data-i="'+(i+1)+'">NEXT QUESTION ▶</button>':'')+'</div>'
    +(Q.some(x=>x.id==='mine')?'':'<small class="mut">Log a stair workout with your pulse before and after to unlock a question about your own data.</small>')+'</div>'}
HWLab.section('trial',{name:'Evidence Trial',icon:'quest',render:renderT});
acts.trpick=d=>{const Q=questions(),q=Q[Math.min(Z.i,Q.length-1)],k=+d.k;if(!q||!q.choices[k])return;Z.pick=k;
  const T=HWLab.L().tr;if(q.choices[k].ok&&!(T[q.id]&&T[q.id].ok)){T[q.id]={ok:1,at:today()};save();if(typeof gain==='function')gain(5,'Evidence Trial: well reasoned');HWEvents.emit('trial:reasoned',{id:q.id})}
  render();const f=document.querySelector('.trfb');if(f&&f.scrollIntoView)f.scrollIntoView({block:'nearest'})};
acts.trhint=()=>{Z.hint=1;render()};
acts.trretry=()=>{Z.pick=null;render();const c=document.querySelector('[data-a="trpick"]');if(c)c.focus()};
acts.trgo=d=>{Z.i=Math.max(0,+d.i||0);Z.pick=null;Z.hint=0;render();const q=document.getElementById('trq');if(q&&q.scrollIntoView)q.scrollIntoView({block:'center'})};
HWUI.css('trial',`
.trn{font:8px/1.6 var(--fh);color:var(--vio);margin:8px 0 4px}.trq{font-weight:700;margin:0 0 8px}
.trc{display:grid;gap:6px}.trc .chip{min-height:48px;text-align:left;text-transform:none;letter-spacing:0;font:13px/1.4 var(--fb)}
.trc .chip.ok{background:var(--grn);color:#fff}.trc .chip.no{outline:3px dashed var(--red);outline-offset:-3px}
.trhint{margin:8px 0;padding:6px 8px;border:2px dashed var(--ln)}.trfb{margin:10px 0;padding:8px 10px;border:3px solid var(--ln);background:var(--p2)}.trfb.ok{border-color:var(--grn)}
.trfb p{margin:4px 0 0}.trdata{margin:10px 0}.trdata>b{font:8px/1.6 var(--fh);color:var(--vio)}.trnav{margin-top:10px}.trnav button{min-height:44px}
`);
return{questions,Z:()=>Z}})();
