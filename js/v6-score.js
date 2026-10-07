/* v6: the Health Score page (Health Hall → Health Score). Not part of the original.
   Written for the Integrated STEM "Health Dashboard" brief: five indicators combined into ONE score with a stated weighting,
   and recommendations in five areas.
   Everything is computed from what the user logged; nothing is invented. An indicator with no data is left out and the
   other weights are scaled up, so a missing log never lowers the score.

   Score (0–100) = Σ weight × sub-score ÷ Σ weight of the indicators that have data.
     Nutrition 25 (fruit & veg 10, water 5, calories 5, macronutrients 5) · Activity 25 (stairs 15, kcal burned 10)
     · Heart rate 15 · Sleep 15 · BMI 10 · Stress 10
   kcal burned = stair-workout estimates (js/v6-stairs.js) + runs (HWRun.burned, js/v6-running.js); target 150 kcal/day
   (≈ 1,000 kcal a week, ACSM). Macronutrients: % of energy against the AMDR ranges in mref() (js/hw-06).
   Fruit & veg portions come from the nutrition log: foods whose menu category (fcat() in js/hw-06) is fruit or a vegetable
   dish count as portions of 80 g (the WHO portion behind ≥400 g a day; dried fruit 30 g), from the serving size × servings ×
   portion size. A serving with no weight counts as one portion. Nothing is entered on this page: it is all from the log. */
const HWScore=(()=>{
const WT={fv:10,water:5,kcal:5,macro:5,stairs:15,burn:10,hr:15,sleep:15,bmi:10,stress:10};
const GROUP=[['nutrition','🍎 Nutrition',['fv','water','kcal','macro']],['activity','🧗 Activity',['stairs','burn']],['hr','❤️ Heart rate',['hr']],['sleep','🌙 Sleep',['sleep']],['bmi','⚖️ BMI',['bmi']],['stress','🧠 Stress',['stress']]];
const FV_GOAL=5,STAIR_GOAL=100,BURN_GOAL=150,FACT={MILD:1,MODERATE:1.5,VIGOROUS:2},CLASSN={MILD:'Mild',MODERATE:'Moderate',VIGOROUS:'Vigorous'};
let W='day';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),r1=x=>Math.round(x*10)/10;
const FVC={fruit:'fruit',veg:'veg',veglemak:'veg',vegplain:'veg',vegsoup:'veg'},DRIED=/^(kismis|kurma)/i;
// [{name, kind, portions}] for the fruit and vegetable foods logged on day d
function fvFoods(d){return A('food',d).map(e=>{const m=e.m||{},k=FVC[fcat(m.name)];if(!k)return null;
  const g=/(\d+(?:\.\d+)?)\s*g\b/i.exec(m.por||''),n=(+m.qty||1)*(+m.pm||1);
  return{name:m.name,kind:k,portions:g?n*+g[1]/(DRIED.test(m.name)?30:80):n}}).filter(Boolean)}
const fvLogged=d=>fvFoods(d).reduce((s,x)=>s+x.portions,0);
const fvOf=fvLogged;
const days=()=>W==='day'?[today()]:rng(7);
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;

/* ---------- sub-scores, each 0–100 ---------- */
const hrSub=b=>b<=80?100:b<=100?100-(b-80)*2.5:Math.max(0,50-(b-100)*2);
const bmiSub=b=>b>=18.5&&b<25?100:b<18.5?Math.max(0,100-(18.5-b)*15):Math.max(0,100-(b-24.9)*10);
const stressSub=s=>clamp((10-s)/9*100,0,100);
const eqSteps=e=>(+e.v||0)*(FACT[(e.m||{}).diff]||1);
const kcalSub=r=>{const d=Math.abs(r-1);return d<=.1?100:clamp(100-(d-.1)*250,0,100)};          // within ±10% of target = 100
const sleepSub=(h,R)=>h>=R[0]&&h<=R[1]?100:h<R[0]?clamp(100-(R[0]-h)*25,0,100):clamp(100-(h-R[1])*15,0,100);
// % of energy from protein, carbs and fat, and how far outside the healthy ranges they are (points off per % point)
function macroPct(d){const t=dmac(d),E=4*t.p+4*t.c+9*t.f;return t.n&&E>0?{P:400*t.p/E,C:400*t.c/E,F:900*t.f/E}:null}
const MKEY=[['P','Protein'],['C','Carbs'],['F','Fat']];
const macroOff=x=>{const R=mref();return MKEY.map(([k,n])=>({k,n,v:x[k],lo:R[k][0],hi:R[k][1],off:Math.max(0,R[k][0]-x[k],x[k]-R[k][1])}))};
const macroSub=x=>clamp(100-macroOff(x).reduce((s,m)=>s+m.off,0)*5,0,100);
const burnOf=d=>{const s=A('stair',d).reduce((a,e)=>a+(+((e.m||{}).kcal||{}).v||0),0),b=typeof HWRun!=='undefined'?HWRun.burned(d):null;return s+(b?b.v:0)};

function indicators(){
  const D0=days(),I={};
  const fv=D0.map(fvOf).filter(v=>v>0),wtr=D0.map(wt).filter(v=>v>0);
  I.fv=fv.length?{val:mean(fv),txt:r1(mean(fv))+' portions/day',sub:clamp(mean(fv)/FV_GOAL*100,0,100)}:null;
  I.water=wtr.length?{val:mean(wtr),txt:Math.round(mean(wtr))+' mL/day',sub:clamp(mean(wtr)/st.s.water*100,0,100)}:null;
  const eq=D0.map(d=>A('stair',d).reduce((s,e)=>s+eqSteps(e),0)),any=D0.some(d=>A('stair',d).length);
  I.stairs=any?{val:mean(eq),txt:Math.round(mean(eq))+' effort-steps/day',sub:clamp(mean(eq)/STAIR_GOAL*100,0,100)}:null;
  const hrs=D0.map(rest).filter(v=>v);
  I.hr=hrs.length?{val:mean(hrs),txt:Math.round(mean(hrs))+' BPM at rest',sub:hrSub(mean(hrs))}:null;
  const kc0=D0.map(kc).filter(v=>v>0);
  I.kcal=kc0.length&&+st.s.kcal>0?{val:mean(kc0),txt:Math.round(mean(kc0))+' of '+st.s.kcal+' kcal/day',sub:kcalSub(mean(kc0)/st.s.kcal)}:null;
  const mp=D0.map(macroPct).filter(Boolean);
  if(mp.length){const x={P:mean(mp.map(m=>m.P)),C:mean(mp.map(m=>m.C)),F:mean(mp.map(m=>m.F))};I.macro={val:x,txt:'P '+Math.round(x.P)+'% · C '+Math.round(x.C)+'% · F '+Math.round(x.F)+'% of energy',sub:macroSub(x)}}else I.macro=null;
  const bn=D0.map(burnOf);
  I.burn=bn.some(v=>v>0)?{val:mean(bn),txt:Math.round(mean(bn))+' kcal/day (stairs + runs)',sub:clamp(mean(bn)/BURN_GOAL*100,0,100)}:null;
  const sl=D0.map(slH).filter(v=>v>0),SRg=SR(+st.p.age||16);
  I.sleep=sl.length?{val:mean(sl),txt:r1(mean(sl))+' h/night',sub:sleepSub(mean(sl),SRg)}:null;
  const b=LC('bmi').pop();I.bmi=b&&+b.v>0?{val:+b.v,txt:'BMI '+(+b.v).toFixed(1),sub:bmiSub(+b.v)}:null;
  const ss=D0.map(str).filter(v=>v!=null);
  I.stress=ss.length?{val:mean(ss),txt:r1(mean(ss))+' / 10',sub:stressSub(mean(ss))}:null;
  return I}
function compute(){
  const I=indicators();let w=0,p=0,n=0;
  for(const k in WT)if(I[k]){w+=WT[k];p+=WT[k]*I[k].sub/100}
  GROUP.forEach(g=>{if(g[2].some(k=>I[k]))n++});
  return{I,score:w?Math.round(p/w*100):null,covered:n,w}}
const band=s=>s>=80?['Excellent','var(--grn)']:s>=60?['Good','var(--gold)']:s>=40?['Fair','#e0a030']:['Needs attention','var(--red)'];

// the latest stair workout with a heart rate before and after (for the exercise-level and heart advice)
function lastWorkout(){const e=LC('stair').filter(x=>x.m&&+x.m.hrB>=30&&+x.m.hrA>=30).pop();if(!e)return null;
  const hb=+e.m.hrB,ha=+e.m.hrA,mx=220-(+st.p.age||16);return{diff:e.m.diff||'',hb,ha,pct:mx>hb&&ha>hb?clamp((ha-hb)/(mx-hb),0,1)*100:null}}

/* ---------- recommendations (five areas) ---------- */
function recs(I,sc){
  const R=[],age=+st.p.age||16,wtr=I.water,fv=I.fv;
  // 1 eating
  let e=[];
  if(!fv)e.push('No fruit or vegetables in your nutrition log yet. Log them in Food & Water (fruit stalls and vegetable dishes) to include them in your score.');
  else if(fv.val<FV_GOAL)e.push('You are at '+r1(fv.val)+' of '+FV_GOAL+' portions (80 g each). Add '+Math.ceil(FV_GOAL-fv.val)+' more: fruit with breakfast, a vegetable side at lunch and dinner.');
  else e.push('You reached '+FV_GOAL+' portions of fruit and vegetables. Keep the variety of colours going.');
  if(!wtr)e.push('Log water to include hydration.');
  else if(wtr.val<st.s.water){const g=Math.ceil((st.s.water-wtr.val)/250);e.push('Water is '+Math.round(wtr.val)+' of '+st.s.water+' mL. About '+g+' more glass'+(g>1?'es':'')+' (250 mL) would reach your target.')}
  const K=I.kcal;
  if(K){const r=K.val/st.s.kcal;if(r<.9)e.push('Calories average '+Math.round(K.val)+' of your '+st.s.kcal+' kcal target. Eat regular meals, including breakfast, so you have energy for study and exercise.');
    else if(r>1.1)e.push('Calories average '+Math.round(K.val)+', above your '+st.s.kcal+' kcal target. Choose smaller portions of fried and sweet foods, and drink water instead of sweet drinks.');
    else e.push('Calories are on target ('+Math.round(K.val)+' of '+st.s.kcal+' kcal).')}
  if(I.macro){const o=macroOff(I.macro.val).filter(m=>m.off>=1);e.push(o.length?o.map(m=>m.n+' is '+Math.round(m.v)+'% of your energy (healthy '+m.lo+'–'+m.hi+'%)').join('; ')+'. '+(o.some(m=>m.k==='F'&&m.v>m.hi)?'Pick grilled, steamed or soup dishes more often than fried or santan dishes.':o.some(m=>m.k==='P'&&m.v<m.lo)?'Add eggs, fish, chicken, tauhu, tempe or dhal to your meals.':'Balance your plate: half vegetables, a quarter rice or noodles, a quarter protein.'):'Protein, carbs and fat are all within healthy ranges.')}
  R.push(['🍎','Healthy eating habits',e]);
  // 2 stairs / intensity
  const last=lastWorkout(),lv=last?last.diff:null;let s=[];
  if(!I.stairs)s.push('No stair activity logged for this period. Start with a MILD stairway (below 26°) for about 10 minutes at a comfortable pace.');
  else if(I.stairs.sub<60)s.push('Stair effort is '+Math.round(I.stairs.val)+' of '+STAIR_GOAL+' effort-steps. Add one more climb a day'+(lv==='MILD'||!lv?' on a mild stairway (below 26°).':', staying at your current '+(CLASSN[lv]||'level').toLowerCase()+' level.'));
  else if(lv==='MILD')s.push('Your stair effort is on target. When mild climbs feel easy, try a MODERATE stairway (26°–31.2°) for part of the session.');
  else if(lv==='MODERATE')s.push('Your stair effort is on target at moderate intensity. Keep it up; add a vigorous stairway (above 31.2°) only if you recover comfortably.');
  else s.push('Your stair effort is on target. Mix vigorous days with mild or moderate days so your body can recover.');
  if(I.burn)s.push('Exercise burned about '+Math.round(I.burn.val)+' kcal a day (estimated, stairs + runs); about '+BURN_GOAL+' a day (1,000 a week) is a good health target.');
  s.push('Stop and rest if you feel dizzy, faint or have chest pain.');R.push(['🧗','Stair climbing and exercise level',s]);
  // 3 stress
  const st1=I.stress;let t=[];
  if(!st1)t.push('Do a stress check-in in the Mind Forest so this part of the score can be calculated.');
  else if(st1.val>=7)t.push('Stress is high ('+st1.txt+'). Try the Calming Grove breathing, a short walk, and talk to a friend, a lecturer or the college counsellor.');
  else if(st1.val>=4)t.push('Stress is moderate ('+st1.txt+'). Plan short breaks between study blocks and keep a regular bedtime.');
  else t.push('Stress is low ('+st1.txt+'). Keep the habits that help: sleep, movement and time with friends.');
  R.push(['🧠','Stress management',t]);
  // 4 BMI
  const b=I.bmi;let m=[];
  if(!b)m.push('Enter your height and weight in the BMI tool to include BMI.');
  else if(b.val<18.5)m.push('BMI '+b.val.toFixed(1)+' is below the 18.5–24.9 healthy range. Regular meals with enough energy and protein help; a doctor or dietitian can give personal advice.');
  else if(b.val<25)m.push('BMI '+b.val.toFixed(1)+' is in the healthy range (18.5–24.9). Maintain it with regular meals, daily movement and enough sleep.');
  else m.push('BMI '+b.val.toFixed(1)+' is above the 18.5–24.9 range. Gradual changes work best: more stairs and walking, more vegetables, fewer sugary drinks. A doctor or dietitian can give personal advice.');
  if(age<19)m.push('Under 19, BMI is read against age and sex charts, so treat this as a guide only.');
  R.push(['⚖️','Maintaining a healthy BMI',m]);
  // 5 cardio
  const h=I.hr;let c=[];
  if(!h)c.push('Record a heart rate before a stair workout (count your pulse at rest) to include cardiovascular fitness.');
  else if(h.val<=80)c.push('Resting heart rate '+Math.round(h.val)+' BPM is within the typical 60–100 range and on the lower, fitter side. Regular stair climbing helps keep it there.');
  else if(h.val<=100)c.push('Resting heart rate '+Math.round(h.val)+' BPM is within the typical 60–100 range but on the higher side. Regular stair climbing, sleep and less caffeine can lower it over weeks.');
  else c.push('Resting heart rate '+Math.round(h.val)+' BPM is above 100. Re-check it after sitting quietly for 5 minutes; if it stays high, speak to a health professional.');
  if(last)c.push('Last workout: '+last.hb+' → '+last.ha+' BPM'+(last.pct!=null?' ('+Math.round(last.pct)+'% of your heart-rate reserve, with maximum ≈ 220 − age)':'')+'.');
  R.push(['❤️','Improving cardiovascular fitness',c]);
  // 6 sleep
  const sl=I.sleep,SRg=SR(age);let z=[];
  if(!sl)z.push('Log your sleep in the Dream Realm to include it in your score.');
  else if(sl.val<SRg[0])z.push('You average '+r1(sl.val)+' h of sleep; '+SRg[0]+'–'+SRg[1]+' h is recommended for your age. Keep a fixed bedtime and put your phone away 30 minutes before sleep.');
  else if(sl.val>SRg[1])z.push('You average '+r1(sl.val)+' h, more than the '+SRg[0]+'–'+SRg[1]+' h recommended. If you still feel tired, a regular wake-up time and daytime activity can help.');
  else z.push('You average '+r1(sl.val)+' h of sleep, within the recommended '+SRg[0]+'–'+SRg[1]+' h. Good sleep helps memory, mood and appetite control.');
  R.push(['🌙','Sleep',z]);
  return R}

/* ---------- pieces ---------- */
const btn=(a,t,c,x)=>'<button class="'+(c||'')+'" data-a="'+a+'"'+(x||'')+'>'+t+'</button>';
const LBL={fv:'Fruit & veg',water:'Water',kcal:'Calorie intake',macro:'Macronutrients',stairs:'Stairs',burn:'Calories burned',hr:'Resting heart rate',sleep:'Sleep',bmi:'BMI',stress:'Stress'};
function head(C){
  const s=C.score,b=s==null?null:band(s);
  return '<div class="card"><div class="row" style="gap:6px">'+btn('scw','TODAY','chip'+(W==='day'?' on':''),' data-w="day"')+btn('scw','LAST 7 DAYS','chip'+(W==='week'?' on':''),' data-w="week"')+'</div>'
  +(s==null?'<p class="mut">No data yet for this period. Log something and your Health Score appears here.</p>'
  :'<div class="v6sc"><b class="v6scn" style="color:'+b[1]+'">'+s+'</b><span class="v6scd">/ 100</span><div><b>'+b[0]+'</b><small class="mut">'+C.covered+' of '+GROUP.length+' areas logged'+(C.covered<GROUP.length?' · missing ones are left out, not counted as zero':'')+'</small></div></div>'+bar(s,b[1]))
  +'<small class="mut">A habit score from what you logged, not a diagnosis.</small></div>'}
function fvCard(){
  const d=today(),L=fvFoods(d),t=fvOf(d);
  return '<div class="card"><h3>🥦 FRUIT &amp; VEGETABLES TODAY</h3><p><b class="big">'+r1(t)+'</b> of '+FV_GOAL+' portions <small class="mut">(1 portion = 80 g; dried fruit 30 g)</small></p>'+bar(t/FV_GOAL*100,'var(--grn)')
  +(L.length?'<ul class="v6fvl">'+L.map(f=>'<li>'+(f.kind==='fruit'?'🍎 ':'🥬 ')+esc(f.name)+' <span class="mut">'+r1(f.portions)+' portion'+(r1(f.portions)===1?'':'s')+'</span></li>').join('')+'</ul>'
    :'<p class="mut">No fruit or vegetables in today\'s nutrition log yet.</p>')
  +'<small class="mut">Counted automatically from the fruit and vegetable dishes in your nutrition log.</small></div>'}
function table(C){
  let rows='';
  for(const k in WT){const i=C.I[k];
    rows+='<tr><td>'+LBL[k]+'</td><td>'+(i?esc(i.txt):'<span class="mut">not logged</span>')+'</td><td>'+(i?Math.round(i.sub):'–')+'</td><td>'+WT[k]+'</td><td>'+(i&&C.w?r1(WT[k]*i.sub/100/C.w*100):'–')+'</td></tr>'}
  return '<div class="card"><h3>📋 HOW YOUR SCORE ADDS UP</h3><div class="tscroll"><table class="tbl"><thead><tr><th>INDICATOR</th><th>YOUR VALUE</th><th>SUB-SCORE /100</th><th>WEIGHT</th><th>POINTS</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
  +'<small class="mut">Score = Σ (weight × sub-score) ÷ Σ weight of the indicators with data. Points are each indicator\'s share of the final score.</small></div>'}
function recCard(C){
  return C.score==null?'':'<div class="card"><h3>💡 RECOMMENDATIONS</h3>'+recs(C.I,C.score).map(r=>'<p><b>'+r[0]+' '+r[1]+'</b><br>'+r[2].map(esc).join(' ')+'</p>').join('')+'<small class="mut">General wellness guidance, not medical advice.</small></div>'}
function whyCard(){
  return '<div class="card"><h3>🔬 WHY THESE WEIGHTS</h3><p>Nutrition 25 · Activity 25 · Heart rate 15 · Sleep 15 · BMI 10 · Stress 10 (total 100).</p>'
  +'<ul class="v6why"><li><b>Nutrition 25</b>: diet is a major daily lever for health. Fruit &amp; veg 10 (WHO: ≥400 g a day), water 5 (your target ≈ 35 mL per kg), calories 5 (your target from the Calorie Forge, Mifflin-St Jeor) and macronutrients 5 (% of energy within the AMDR ranges, IOM).</li>'
  +'<li><b>Activity 25</b>: physical activity has the strongest evidence for lowering cardiovascular risk (WHO, 2020). Stairs 15, the activity this project measures directly; calories burned 10, from stair workouts and runs (ACSM: about 1,000 kcal a week).</li>'
  +'<li><b>Heart rate 15</b>: resting heart rate is a quick, objective fitness marker (typical 60–100 BPM, AHA), but caffeine, sleep and anxiety affect it.</li>'
  +'<li><b>Sleep 15</b>: 8–10 h for teens and 7–9 h for adults (AASM); short sleep is linked to stress, overeating and poorer learning.</li>'
  +'<li><b>BMI 10</b>: a screening tool only (WHO 18.5–24.9); it ignores muscle and body shape.</li>'
  +'<li><b>Stress 10</b>: linked to sleep, eating and wellbeing, but self-rated (perceived stress, Cohen et al., 1983), so its weight is limited.</li></ul>'
  +'<small class="mut">These weights are the team\'s reasoned judgement from the sources above, not a validated clinical formula. Edit WT in js/v6-score.js to change them.</small></div>'}

pages.score=()=>{
  const C=compute();
  return '<h2>🏆 HEALTH SCORE</h2><p class="mut">Your logged habits, weighed into one score, with advice for each area.</p>'+head(C)+fvCard()+table(C)+recCard(C)+whyCard()
   +'<div class="card"><small class="mut">Supports UN Sustainable Development Goal 3: Good Health and Well-being. HealthWiz is a wellness tracker, not a medical device.</small></div>'};

acts.scw=d=>{W=d.w==='week'?'week':'day';render()};

PAR.score='health';
BN.score=['🏆','Health Score','Every habit, weighed into one number.','rgba(242,193,78,.3)'];
DIS.score='A habit score from the numbers you logged, not a diagnosis. Weights are a team judgement from public guidance. Not a medical device.';
HUB.push(['score','🏆','Health Score','Hall of Balance',()=>{const c=compute();return c.score==null?'log to see your score':c.score+' / 100 today'}]);
HWUI.css('score',`
.v6sc{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:10px 0 6px}.v6scn{font:var(--px-f3,28px)/1 var(--fh);font-size:44px}.v6scd{opacity:.7}
.v6sc div{display:flex;flex-direction:column;margin-left:8px}.v6fv{align-items:center;gap:12px}.v6why{margin:6px 0 8px 18px}.v6why li{margin:4px 0}.v6fvl{margin:6px 0 8px 18px}.v6fvl li{margin:2px 0}
`);
return{compute,fvFoods,WT}})();
