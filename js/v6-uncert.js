/* v6: the Uncertainty Engine (master prompt Feature E), a section of the Science Laboratory (js/v6-lab.js). Not part of the original.
   How sure are the estimates? Only what can be justified is shown: no confidence interval, error margin, percentage or
   significance is ever made up. Each panel keeps the original value visible and shows how the result moves when an
   assumption or input changes; a "spread" is the range across those choices, never a confidence interval.
     1 Our project's energy estimate: the energy per litre of oxygen (RER 0.7–1.0, the report's own interpolation of McArdle's
       19.6 and 21.1 kJ/L), which pulse counts as the peak (3-minute average or first 30 seconds, report Tables 9 and 11) and
       which resting pulse is used (each student's three measured resting values, Table 10). Group 14 data, or your workout.
     2 Stair workout energy: how much the pace you choose and the method (MET or heart rate) change the estimate.
     3 Resting energy (BMR): how much each input moves it (the equation's own coefficients), and why no ± range is shown. */
const HWUncert=(()=>{
const Z={k:'proj',p:1,i:2,rer:.8,pmax:'avg',rest:'same',pace:'Moderate',dur:10,hr:'',dw:0,dh:0,da:0};
const ico=(n,s)=>HWPixel.icon(n,s||1);
const r1=x=>Math.round(x*10)/10,fmt=(x,d)=>(+x.toFixed(d==null?1:d)).toLocaleString('en',{maximumFractionDigits:d==null?1:d});
/** Energy per litre of O₂ at an RER, by the report's linear interpolation: 19.6 + (RER − 0.7) ÷ 0.3 × 1.5 kJ/L. */
const kjL=rer=>19.6+(rer-.7)/.3*1.5;
const card=(k,title,icon,body)=>'<div class="card unc" id="unc-'+k+'"><h3>'+ico(icon)+' '+title+'</h3>'+body+'</div>';
const chips=(a,v,list)=>'<div class="row" role="group">'+list.map(o=>'<button type="button" class="chip'+(String(v)===String(o[0])?' on':'')+'" aria-pressed="'+(String(v)===String(o[0]))+'" data-a="ucset" data-f="'+a+'" data-v="'+o[0]+'">'+esc(o[1])+'</button>').join('')+'</div>';
const cmp=(lab,o,n,u)=>'<div class="uccmp"><div class="t">Original<b>'+o+'<small> '+u+'</small></b><small>report / app settings</small></div><div class="t">With your choices<b>'+n+'<small> '+u+'</small></b><small>'+lab+'</small></div></div>';

/* 1. our project's energy estimate */
function proj(){const P=HWF21.P,p=Math.min(5,Math.max(0,Z.p)),i=Z.i,x=P[p],rest=Z.rest==='same'?x.rest[i]:Z.rest==='low'?Math.min(...x.rest):Math.max(...x.rest),
  max=Z.pmax==='first'?HWF21.interval(p,i,0):HWF21.pr(p,i),e=kjL(Z.rer),ratio=max/rest,lmin=15.3*ratio*x.w/1000,kj=lmin*3*e,o=HWF21.vo2(p,i);
  // the spread: every combination of the three choices (2 peaks × 3 resting values × RER 0.7 or 1.0)
  const all=[];['avg','first'].forEach(m=>{const mx=m==='first'?HWF21.interval(p,i,0):HWF21.pr(p,i);x.rest.forEach(r=>[.7,1].forEach(q=>{if(mx/r>=1)all.push(15.3*mx/r*x.w/1000*3*kjL(q))}))});
  const val=ratio>=1;
  return card('proj','OUR PROJECT\'S ENERGY ESTIMATE: HOW SURE?','flask','<p>The Group 14 method gives energy in 3 minutes = 15.3 × pulse after ÷ resting pulse × kg ÷ 1000 × 3 × energy per litre of O₂. Three assumptions are not measured. Change them and watch the result.</p>'
    +'<p><span class="pxtag">REAL DATA: GROUP 14 STUDY</span></p><p><b>Student and climb</b></p>'+chips('p',p,P.map((s,k)=>[k,s.id]))+chips('i',i,[[0,'Mild (B)'],[1,'Moderate (C)'],[2,'Vigorous (A)']])
    +'<p><b>Energy per litre of oxygen</b> (depends on the fuel burned, the RER, which was not measured)</p><label class="ucr">RER '+Z.rer.toFixed(2)+' → '+fmt(e,2)+' kJ/L<input type="range" min="0.7" max="1" step="0.05" value="'+Z.rer+'" data-in="ucrer" aria-label="Respiratory exchange ratio"></label>'
    +'<p><b>Which pulse counts as the peak?</b></p>'+chips('pmax',Z.pmax,[['avg','3-minute average (report Table 9)'],['first','First 30 seconds × 2 (Table 11)']])
    +'<p><b>Which resting pulse?</b> This student\'s were '+x.rest.join(', ')+' BPM before the three climbs.</p>'+chips('rest',Z.rest,[['same','The one before this climb'],['low','Lowest ('+Math.min(...x.rest)+')'],['high','Highest ('+Math.max(...x.rest)+')']])
    +(val?cmp('RER '+Z.rer.toFixed(2)+', '+(Z.pmax==='first'?'first 30 s':'3-min average')+', rest '+rest,o.valid?fmt(o.kj):'not valid',fmt(kj),'kJ'):'<div class="warn">With these choices the pulse after ('+fmt(max)+') is below the resting pulse ('+rest+'): the method is not valid, so no energy is shown.</div>')
    +(all.length?'<p class="ucsp"><b>Spread across all these choices:</b> '+fmt(Math.min(...all))+' to '+fmt(Math.max(...all))+' kJ ('+all.length+' valid combinations). This is how much the unmeasured assumptions matter; it is not a confidence interval.</p>':'')
    +'<small class="mut">Worked out: ratio '+fmt(ratio,2)+' → VO₂ '+fmt(15.3*ratio)+' mL/kg/min × '+x.w+' kg ÷ 1000 = '+fmt(lmin,2)+' L/min × 3 min × '+fmt(e,2)+' kJ/L.</small>')}

/* 2. stair workout energy: pace and method */
function stairs(){const P=HWStairs.profile();
  if(!P)return card('stairs','STAIR WORKOUT ENERGY: PACE AND METHOD','stairs','<p>This needs your age, sex, height and weight. HealthWiz never guesses them.</p><button type="button" class="g sm" data-a="go" data-v="body">ADD YOUR PROFILE</button>');
  const hr=+Z.hr,pace=['Easy','Moderate','Vigorous'].map(k=>[k,HWStairs.estimate({pace:k,dur:Z.dur},P)]),cur=HWStairs.estimate({pace:Z.pace,dur:Z.dur,hrA:hr>=90&&hr<=180?hr:null},P);
  return card('stairs','STAIR WORKOUT ENERGY: PACE AND METHOD','stairs','<p>The estimate depends on the pace you choose (its MET value) and, with an after-workout heart rate, on a second method. Here you can see how much each matters.</p>'
    +'<label class="ucr">Workout time: '+Z.dur+' min<input type="range" min="1" max="30" step="1" value="'+Z.dur+'" data-in="ucdur" aria-label="Workout time in minutes"></label>'
    +'<div class="grid">'+pace.map(x=>'<div class="t'+(x[0]===Z.pace?' on':'')+'">'+x[0]+' pace<b>'+x[1].v+'<small> kcal</small></b><small>MET '+HWStairs.MET[x[0]]+'</small></div>').join('')+'</div>'
    +'<p><b>Your pace</b></p>'+chips('pace',Z.pace,[['Easy','Easy'],['Moderate','Moderate'],['Vigorous','Vigorous']])
    +'<label class="ucr">After-workout heart rate (optional, 90–180 BPM)<input type="number" inputmode="numeric" min="90" max="180" value="'+esc(Z.hr)+'" data-in="uchr"></label>'
    +(cur.m==='met+hr'?'<p class="ucsp">The two methods give <b>'+cur.lo+'</b> and <b>'+cur.hi+'</b> kcal; HealthWiz shows their mean, <b>'+cur.v+'</b>. The gap shows how much the method matters; it is not an error margin.</p>':'<p class="mut">Add a heart rate to compare the second method.</p>')
    +'<small class="mut">Your profile: '+P.age+' y, '+P.w+' kg, '+P.h+' cm. The pace values are the Compendium\'s slow, general and fast stair climbing.</small>')}

/* 3. BMR: what moves it */
function bmr(){const P=HWStairs.profile();
  if(!P)return card('bmr','RESTING ENERGY (BMR): WHAT MOVES IT','balance','<p>This needs your age, sex, height and weight.</p><button type="button" class="g sm" data-a="go" data-v="body">ADD YOUR PROFILE</button>');
  const f=(w,h,a)=>10*w+6.25*h-5*a+(P.sex==='m'?5:-161),o=f(P.w,P.h,P.age),n=f(P.w+Z.dw,P.h+Z.dh,P.age+Z.da);
  const st=(k,lab,v,u)=>'<div class="ucst"><span>'+lab+': <b>'+(v>0?'+':'')+v+' '+u+'</b></span><button type="button" class="g sm" data-a="ucstep" data-f="'+k+'" data-v="-1" aria-label="Less '+lab+'">−</button><button type="button" class="g sm" data-a="ucstep" data-f="'+k+'" data-v="1" aria-label="More '+lab+'">+</button></div>';
  return card('bmr','RESTING ENERGY (BMR): WHAT MOVES IT','balance','<p>Mifflin-St Jeor: BMR = 10 × kg + 6.25 × cm − 5 × age '+(P.sex==='m'?'+ 5':'− 161')+'. Each kilogram changes it by 10 kcal, each centimetre by 6.25, each year by −5.</p>'
    +st('dw','Weight',Z.dw,'kg')+st('dh','Height',Z.dh,'cm')+st('da','Age',Z.da,'years')+cmp('your changes',fmt(o,0),fmt(n,0),'kcal/day')
    +'<p class="ucsp"><b>Why no ± range?</b> The study behind the equation reports how well it fits a group (R² = 0.71) but not how far it can be off for one person, so HealthWiz shows no error margin. A scale or tape that is 1 kg or 1 cm off moves BMR by 10 or 6 kcal, as above.</p>'
    +'<small class="mut">Source: Mifflin et al., 1990 (see the Evidence Vault).</small>')}

function renderU(){return '<div class="uctabs">'+chips('k',Z.k,[['proj','Our project\'s energy'],['stairs','Stair workout energy'],['bmr','Resting energy']])+'</div>'+(Z.k==='stairs'?stairs():Z.k==='bmr'?bmr():proj())}
HWLab.section('unc',{name:'Uncertainty',icon:'chart',render:renderU});
const NUMF={p:1,i:1,rer:1,dur:1};
acts.ucset=d=>{const f=d.f;if(!(f in Z))return;Z[f]=NUMF[f]?+d.v:d.v;render()};
acts.ucstep=d=>{if(!['dw','dh','da'].includes(d.f))return;Z[d.f]=Math.max(-20,Math.min(20,Z[d.f]+(+d.v)));render()};
document.addEventListener('change',e=>{const t=e.target,k=t&&t.dataset&&t.dataset.in;if(!k)return;
  if(k==='ucrer'){Z.rer=Math.min(1,Math.max(.7,Math.round(+t.value*20)/20));render()}else if(k==='ucdur'){Z.dur=Math.min(30,Math.max(1,Math.round(+t.value)));render()}else if(k==='uchr'){Z.hr=t.value.replace(/[^\d]/g,'').slice(0,3);render()}});
HWUI.css('unc',`
.unc .ucr{display:block;margin:6px 0 10px}.unc input[type=range]{width:100%;min-height:44px;border:0;background:none;box-shadow:none;padding:0;accent-color:var(--vio)}.unc input[type=number]{width:100%;min-height:44px;box-sizing:border-box}
.uccmp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0}.ucsp{margin:8px 0;padding:6px 8px;border:2px dashed var(--ln)}
.ucst{display:flex;gap:6px;align-items:center;min-height:44px}.ucst span{flex:1 1 auto}.ucst button{min-width:44px;min-height:44px}
.unc .t.on{outline:3px solid var(--gold);outline-offset:-3px}.uctabs .chip{min-height:44px}.unc .chip{text-transform:none;letter-spacing:0;font:12px/1.3 var(--fb);min-height:40px}
`);
return{kjL,Z:()=>Z}})();
