/* v6 (usability pass, item 3): BMI and the calorie page as one page, "Body & Energy". Not part of the original.
   Before: BMI (pages.bmi, js/hw-03-part.js) and the Energy Forge (pages.calc) were two tiles that asked for the same height and weight.
   Now: one page, one Health Hall tile, three sections in this order
     (a) BMI: height + weight, the WHO category, the healthy weight range (adults)
     (b) DAILY ENERGY: BMR, TDEE and the goal, with the "why" text (and the under-18 note)
     (c) MACRONUTRIENTS and the other goals (water, sleep) that come from the same estimate
   Routes: 'bmi' and 'calc' still work. They open this page ('body') at their own section (same approach as TO in
   js/v6-stairs.js), so every old link, map node (Balance Tower / Energy Forge), badge, score button and test lands on the right place.
   The two kingdom places and their restoration rules are unchanged; only the page behind them is one.

   Data: nothing new is stored. Saving a BMI still writes a 'bmi' entry {h, w}; SAVE PROFILE & UPDATE ALL GOALS still writes st.p and
   st.s through computeGoals(1). Typing only previews: st.p and st.g are put back after every preview (the old Energy Forge changed them
   while typing). Never guessed: if the profile was not confirmed (onboarding or a saved profile), the fields start empty and no
   number is shown from app defaults. A BMI category needs the user's age, and under 18 no adult category is shown at all. */
const HWBody=(()=>{
const ico=n=>HWPixel.icon(n,1);
const num=v=>v===''||v==null||!isFinite(+v)?null:+v;
const known=()=>!!(st.s.onb||st.p.cfm);               // body data the user confirmed; app defaults never count
const $i=i=>document.getElementById(i);
const r10=n=>Math.round(n/10)*10;
const sec=(id,icon,name,tag,line)=>'<div class="sthd" id="'+id+'">'+HWPixel.icon(icon,2)+'<div><b>'+name+'</b><span class="pxtag">'+tag+'</span><small>'+line+'</small></div></div>';

/* ---------- reading the fields ---------- */
function read(){const v=i=>{const e=$i(i);return e?e.value:''},h=num(v('bh')),w=num(v('bw')),a=num(v('ka')),sx=v('ks'),ac=num(v('kv')),dy=num(v('kd'));
  return{h:h>=100&&h<=230?h:null,w:w>=20&&w<=300?w:null,a:a>=10&&a<=100?Math.round(a):null,sx:sx==='m'||sx==='f'?sx:null,ac:ac>0?ac:null,dy:dy>=0&&dy<=7?dy:null}}
const full=r=>!!(r.h&&r.w&&r.a&&r.sx&&r.ac);
// run fn(g) with the typed profile in place, then put st.p and st.g back: typing never changes saved data
function preview(r,fn){const p=st.p,keys=['h','w','age','sex','act'],bk={},g0=st.g;keys.forEach(k=>{bk[k]=p[k]});
  Object.assign(p,{h:r.h,w:r.w,age:r.a,sex:r.sx,act:r.ac});
  try{const g=computeGoals(0);return fn(g)}finally{keys.forEach(k=>{p[k]=bk[k]});st.g=g0}}

/* ---------- (a) BMI ---------- */
function bmiOut(r){const el=$i('bout'),av=$i('avt');if(!el)return;
  if(!r.h||!r.w){el.innerHTML='<p class="mut">Enter your height (100–230 cm) and weight (20–300 kg) to see your BMI.</p>';if(av)av.innerHTML='';return}
  const b=+(r.w/Math.pow(r.h/100,2)).toFixed(1),m=Math.min(100,Math.max(0,(b-15)/25*100)),age=r.a,adult=age!=null&&age>=18,
    cat=age==null?'<span class="mut">Enter your age in the energy section below to see the category.</span>':adult?'<b>WHO adult category:</b> '+bcat(b):'Under 18: adult BMI categories do not apply. Doctors use BMI-for-age percentiles for you.',
    wr=adult?'<p>Healthy weight range for your height: <b>'+Math.round(18.5*Math.pow(r.h/100,2))+'–'+Math.round(24.9*Math.pow(r.h/100,2))+' kg</b> <span class="mut">(BMI 18.5–24.9). Slow, steady change is safest; there is no deadline.</span></p>':'';
  el.innerHTML='<div class="big">'+b+' '+bmiWhy(r,b)+'</div><p>'+cat+'</p>'+(adult?'<div class="sc"><div style="width:14%;background:#6aa0d0"></div><div style="width:26%;background:#5cc05a"></div><div style="width:20%;background:#e0b040"></div><div style="width:40%;background:#d08040"></div><u style="left:'+m+'%">▼</u></div><small>Under 18.5 · 18.5–24.9 · 25–29.9 · 30+ (adult ranges)</small><br><small>Asian cut-offs (WHO): 23+ increased risk, 27.5+ high risk.</small>':'')+wr
    +'<p class="mut">BMI is an adult screening number worked out from what you typed. It is not a diagnosis and does not describe every aspect of health.</p>';
  if(av){const f=r.sx==='f';av.innerHTML=avatar(7,b,f)+'<p><b>'+avName(b,f)+'</b>'+HWHelp.btn('bmigame')+'</p>'}}

// the "?" beside the BMI: the exact sum this page ran, with the typed numbers (js/v6-sources.js)
function bmiWhy(r,b){const m=r.h/100,m2=m*m,N=HWExplain.num;
  return HWExplain.btn('xbmi','How your BMI is worked out',{ev:'bmi',what:'Body mass index compares weight with height. It is a quick screening number for adults, not a measure of body fat or health.',
    inputs:[{n:'Height',v:r.h,u:'cm',o:'you',d:1},{n:'Weight',v:r.w,u:'kg',o:'you',d:1}],
    formula:'BMI = weight ÷ (height in metres)²',vars:[['weight','body mass','kg'],['height','height ÷ 100','m']],
    steps:['Height in metres: '+N(r.h,1)+' ÷ 100 = '+N(m,3)+' m','Squared: '+N(m,3)+' × '+N(m,3)+' = '+N(m2,4)+' m²','BMI: '+N(r.w,1)+' ÷ '+N(m2,4)+' = '+N(r.w/m2,3)+', rounded to one decimal'],
    result:b+' kg/m²',src:['cdcbmi','asianbmi'],
    app:'HealthWiz shows the adult category from age 18 (CDC uses 20 and older) and no adult category under 18. The healthy weight range is 18.5 × height² to 24.9 × height². The Asian action points (23 and 27.5) are shown as extra information only; the category uses the international cut-offs.',
    limits:['BMI cannot tell muscle from fat, or where fat is stored.','It does not diagnose any condition. Under 18, doctors use BMI-for-age percentiles instead.','The result is only as accurate as the height and weight you typed.']})}

/* the "?" beside the daily energy goal, the macronutrients and the water goal: computeGoals() (js/hw-05) and mref() (js/hw-06),
   step by step with the typed profile. g is the preview's goals, so the numbers match the page. */
const ACTN=()=>typeof ACT!=='undefined'?ACT:[];
function energyWhy(r,g){const N=HWExplain.num,m=r.sx==='m',an=(ACTN().find(x=>x[1]===+r.ac)||['your activity level'])[0],fl=Math.max(g.bmr,m?1500:1200),
  steps=['BMR: 10 × '+N(r.w,1)+' + 6.25 × '+N(r.h,1)+' − 5 × '+r.a+(m?' + 5':' − 161')+' = '+N(g.bmr,1)+' kcal a day',
    'TDEE: '+N(g.bmr,1)+' × '+r.ac+' ('+an+') = '+N(g.tdee,1)+' kcal a day'];
  if(g.minor)steps.push('Under 18: the goal stays at maintenance = TDEE');
  else if(g.mode==='s')steps.push('BMI '+g.b+' is under 18.5: surplus = the smaller of '+N(g.tdee,1)+' + 300 and '+N(g.tdee,1)+' × 1.15 = '+N(g.sur,1));
  else if(g.mode==='d')steps.push('BMI '+g.b+' is 25 or more: deficit = the largest of '+N(g.tdee,1)+' − 400, the floor '+N(fl,1)+' (BMR or '+(m?1500:1200)+', whichever is higher) and '+N(g.tdee,1)+' × 0.8 = '+N(g.def,1));
  else steps.push('BMI '+g.b+' is 18.5 to under 25: maintain = TDEE');
  steps.push('Rounded to the nearest 10 kcal = '+g.kcal+' kcal');
  return HWExplain.btn('xenergy','How your daily energy goal is worked out',{ev:'energy',what:'An estimate of the energy you use in a day, and the goal HealthWiz suggests from it. It is a starting point, not a prescription.',
    inputs:[{n:'Weight',v:r.w,u:'kg',o:'you',d:1},{n:'Height',v:r.h,u:'cm',o:'you',d:1},{n:'Age',v:r.a,u:'years',o:'you',d:0},{n:'Sex',v:m?'male':'female',o:'you'},{n:'Activity factor ('+an+')',v:r.ac,o:'you'},{n:'BMI',v:g.b,u:'kg/m²',o:'calc'}],
    formula:'BMR  = 10 × W + 6.25 × H − 5 × A + 5 (male) or − 161 (female)\nTDEE = BMR × activity factor\ngoal = TDEE, or a surplus or deficit chosen from BMI, rounded to 10',
    vars:[['W','weight','kg'],['H','height','cm'],['A','age','years'],['BMR','energy used at rest','kcal/day'],['TDEE','total daily energy expenditure','kcal/day']],
    steps,result:g.kcal+' kcal a day',src:['mifflin','cdcbmi','faopal','hall'],
    app:'The activity factor is a physical activity level (PAL) from the FAO/WHO/UNU report: sedentary or light 1.40–1.69, active or moderately active 1.70–1.99, vigorous 2.00–2.40. HealthWiz uses the middle of each range (1.55, 1.85, 2.2); the report gives ranges, not one value, and the middle is HealthWiz\'s choice. The surplus (+300 kcal, at most +15%) and deficit (−400 kcal, at most −20%, never below BMR or 1,500 / 1,200 kcal) are HealthWiz\'s own cautious rules, not values from a study.',
    limits:['Mifflin-St Jeor predicts resting energy for groups of adults; one person can differ by a few hundred kcal.','It was derived in adults aged 19–78, so under 19 it is a rough guide only.','The activity factor is a broad guess about your whole day.','FAO defines PAL against its own basal rate equations; HealthWiz multiplies it by the Mifflin-St Jeor resting rate, so the result is an estimate.']})}
function macroWhy(r,g,R){const N=HWExplain.num,K=g.kcal,kid=r.a<19,cap=(kid?.30:.35)*K/4;
  return HWExplain.btn('xmacro','How your macronutrient goals are worked out',{ev:'macro',what:'Grams of protein, carbohydrate, fat and fiber that fit your daily energy goal.',
    inputs:[{n:'Daily energy goal',v:K,u:'kcal',o:'calc',d:0},{n:'Weight',v:r.w,u:'kg',o:'you',d:1},{n:'Age',v:r.a,u:'years',o:'you',d:0}],
    formula:'protein = min(p × W, '+(kid?'0.30':'0.35')+' × kcal ÷ 4)\nfat     = kcal × 0.30 ÷ 9\ncarbs   = (kcal − protein × 4 − fat × 9) ÷ 4\nfiber   = kcal × 14 ÷ 1000',
    vars:[['p','protein per kg for your age (and goal)','g/kg'],['W','weight','kg'],['4, 4, 9','kcal per gram of protein, carbohydrate, fat','kcal/g']],
    steps:['Protein: the smaller of '+N(g.pk,2)+' × '+N(r.w,1)+' = '+N(g.pk*r.w,1)+' g and '+(kid?'0.30':'0.35')+' × '+K+' ÷ 4 = '+N(cap,1)+' g → '+R.pg+' g','Fat: '+K+' × 0.30 ÷ 9 = '+N(K*.3/9,1)+' → '+R.fg+' g',
      'Carbohydrate: ('+K+' − '+R.pg+' × 4 − '+R.fg+' × 9) ÷ 4 = '+N((K-R.pg*4-R.fg*9)/4,1)+' → '+R.cg+' g','Fiber: '+K+' × 14 ÷ 1000 = '+N(K*14/1000,1)+' → '+R.fb+' g'],
    src:['iomdri','whodiet'],
    app:'Protein per kg: 0.95 (under 14), 0.85 (14–18), 0.8 (adults), raised to 1.1 when the goal is a deficit (HealthWiz\'s own choice). Fat is set at 30% of energy, and protein is capped at 35% of energy from 19 and 30% under 19. Carbohydrate takes the energy that is left.',
    limits:['These are population reference values, not your personal needs.','The IOM table values are still to be checked against the report (see the source note).']})}
function waterWhy(r,g){const N=HWExplain.num,add=r.ac>=2?500:r.ac>=1.7?300:0,raw=r.w*35+add;
  return HWExplain.btn('xwater','How your water goal is worked out',{ev:'water',what:'How much to drink in a day, as a simple guide.',
    inputs:[{n:'Weight',v:r.w,u:'kg',o:'you',d:1},{n:'Activity factor',v:r.ac,o:'you'}],
    formula:'water = W × 35 + extra (300 mL when PAL is 1.7 or more, 500 mL when it is 2.0 or more)\nrounded to 50 mL, kept between 1,500 and 3,500 mL',
    vars:[['W','weight','kg'],['35','mL per kg (HealthWiz rule)','mL/kg']],
    steps:[N(r.w,1)+' × 35 + '+add+' = '+N(raw,0)+' mL','Rounded to 50 mL and kept within 1,500–3,500 = '+g.water+' mL'],result:g.water+' mL a day',src:['efsawater'],
    app:'35 mL per kg is HealthWiz\'s rule of thumb; no single verified source gives it. For comparison, EFSA\'s adequate intake is 2.0 L (women) or 2.5 L (men) of total water a day, which includes the water in food.',
    limits:['Needs rise in hot weather, with exercise and in illness.','With kidney or heart conditions, follow your doctor\'s advice instead.']})}

/* ---------- (b) daily energy and (c) macronutrients ---------- */
function energyOut(r){const el=$i('eout');if(!el)return;
  if(!full(r)){const miss=[['h','height'],['w','weight'],['a','age'],['sx','sex'],['ac','activity level']].filter(x=>!r[x[0]]).map(x=>x[1]);
    el.innerHTML='<p class="mut">Needs your '+miss.join(', ')+'. HealthWiz does not guess these. Fill them in to see your estimate.</p>';return}
  el.innerHTML=preview(r,g=>{const why={u18:'You are under 18 and still growing, so HealthWiz keeps your goal at maintenance. Adult BMI categories do not apply; a doctor can check your BMI-for-age.',under:'Your BMI ('+g.b+') is below 18.5, so a gentle surplus is recommended.',healthy:'Your BMI ('+g.b+') is in the healthy range, so maintaining is recommended.',over:'Your BMI ('+g.b+') is in the overweight range, so a moderate deficit is recommended.',obese:'Your BMI ('+g.b+') is in the obesity range, so a moderate deficit is recommended. A doctor can support you safely.'}[g.cat],
    on=st.s.kcal===g.kcal&&st.s.water===g.water;
    return '<div class="grid"><div class="t">BMR<b>'+r10(g.bmr)+'<small> kcal</small></b><small>estimate: energy at rest</small></div><div class="t">TDEE<b>'+r10(g.tdee)+'<small> kcal</small></b><small>estimate: BMR × activity</small></div></div>'
    +'<h3 style="margin-top:14px">DAILY ENERGY GOAL '+energyWhy(r,g)+'</h3>'+[['m','Maintain',g.tdee],['s','Surplus (≈ +300)',g.sur],['d','Deficit (≈ −400)',g.def]].map(x=>'<div class="kopt'+(x[0]===g.mode?' on':'')+'"><span>'+x[1]+(x[0]===g.mode?' <span class="tag m">RECOMMENDED</span>':'')+'</span><b class="num">'+(g.minor&&x[0]!=='m'?'not suggested under 18':r10(x[2])+' kcal/day')+'</b></div>').join('')
    +'<p>'+why+'</p>'
    +(g.minor?'<div class="warn">Under 18: you are still growing, so this adult formula may not fit. Please ask a doctor or dietitian before changing how much you eat.</div>':'')
    +'<p class="mut">These are estimates (Mifflin-St Jeor), not medical prescriptions.</p>'
    +(on?'<p class="mut">✓ These goals are active across the Health Hall.</p>':'<div class="warn">Not saved yet. Press the button below to update every goal.</div>')
    +'<button data-a="usecal" style="width:100%">SAVE PROFILE & UPDATE ALL GOALS</button>'})}
function macroOut(r){const el=$i('mout');if(!el)return;
  if(!full(r)){el.innerHTML='<p class="mut">Macronutrient goals appear once the energy estimate above has your age, sex, height, weight and activity level.</p>';return}
  el.innerHTML=preview(r,g=>{const K=st.s.kcal;st.s.kcal=g.kcal;let R;try{R=mref()}finally{st.s.kcal=K}
    return '<div class="mac4">'+[['PROTEIN',R.pg,4],['CARBS',R.cg,4],['FAT',R.fg,9],['FIBER',R.fb,0]].map(x=>'<div class="mx"><span>'+x[0]+'</span><b>'+x[1]+'<small> g</small></b><em>'+(x[2]?Math.round(x[1]*x[2]/g.kcal*100)+'% of kcal':'per day')+'</em></div>').join('')+'</div>'
    +'<small class="mut">Estimates from the usual shares of energy for each nutrient (AMDR), not lab values.</small> '+macroWhy(r,g,R)
    +'<h3 style="margin-top:12px">OTHER GOALS</h3><div class="grid"><div class="t">💧 Water '+waterWhy(r,g)+'<b>'+g.water+'<small> mL</small></b></div><div class="t">🌙 Sleep<b>'+g.sleep[0]+'–'+g.sleep[1]+'<small> h</small></b></div></div>'})}
INP.be=()=>{const r=read();bmiOut(r);energyOut(r);macroOut(r)};

/* ---------- the page ---------- */
pages.body=()=>{const p=st.p,k=known(),val=x=>k?' value="'+esc(x)+'"':'',sel=(a,b)=>k&&a===b?' selected':'';
  const acts_=ACT.some(a=>a[1]===+p.act)?ACT:ACT.concat([['Custom',+p.act]]);
  return '<h2>⚖️ BODY & ENERGY</h2>'
  +sec('be-bmi','balance','1 · BMI','SCREENING NUMBER','Height and weight in, BMI and your category out.')
  +'<div class="card" id="be-bmic"><div class="row"><label>Height (cm)<input id="bh" data-in="be" type="number" min="100" max="230" inputmode="decimal"'+val(p.h)+'></label><label>Weight (kg)<input id="bw" data-in="be" type="number" min="20" max="300" inputmode="decimal"'+val(p.w)+'></label></div>'
  +(k?'':'<small class="mut">These start empty because HealthWiz does not guess your body data.</small>')
  +'<div id="bout"></div><div id="avt" style="text-align:center;margin:10px 0"></div>'
  +HWWhen.html({id:'bmi',time:false,cats:['bmi'],label:'Measured on…',hint:'Saving for an earlier date does not change the height and weight in your profile.'})+'<button data-a="savebmi">SAVE BMI</button></div>'
  +'<div class="card"><h3>'+ico('scroll')+' BMI HISTORY</h3>'+list('bmi').replace('Nothing logged today yet.','Nothing saved today.')+'</div>'
  +sec('be-energy','energy','2 · DAILY ENERGY','ESTIMATE','How many calories your body uses in a day, and a goal to match.')
  +'<div class="card" id="be-enc"><p class="mut">Your goals are calculated from your profile. Height and weight come from the BMI section above. Change anything, then save to update calories, macros, water and sleep goals.</p>'
  +'<div class="row"><label>Age<input id="ka" data-in="be" type="number" min="10" max="100" inputmode="numeric"'+val(p.age)+'></label><label>Sex<select data-in="be" id="ks">'+(k?'':'<option value="">choose</option>')+'<option value="m"'+sel(p.sex,'m')+'>Male</option><option value="f"'+sel(p.sex,'f')+'>Female</option></select></label></div>'
  +'<div class="row"><label>Activity level<select data-in="be" id="kv">'+(k?'':'<option value="">choose</option>')+acts_.map(a=>'<option value="'+a[1]+'"'+(k&&+p.act===a[1]?' selected':'')+'>'+a[0]+'</option>').join('')+'</select></label><label>Active days / week<select data-in="be" id="kd">'+[0,1,2,3,4,5,6,7].map(i=>'<option'+(p.days===i?' selected':'')+'>'+i+'</option>').join('')+'</select></label></div>'
  +'<div id="eout"></div></div>'
  +sec('be-macro','food','3 · MACRONUTRIENTS','ESTIMATE','Protein, carbs, fat and fiber that fit your energy goal.')
  +'<div class="card" id="be-mac"><div id="mout"></div></div>'};

/* ---------- saving ---------- */
acts.usecal=()=>{const r=read();if(!full(r)){toast('Fill in height, weight, age, sex and activity first');return}
  const f=!st.s.set;Object.assign(st.p,{h:r.h,w:r.w,age:r.a,sex:r.sx,act:r.ac,cfm:1});if(r.dy!=null)st.p.days=r.dy;
  computeGoals(1);if(f)gain(10,'Goals forged');toast('✨ All goals updated: '+st.s.kcal+' kcal · '+st.s.water+' mL');render()};
acts.savebmi=()=>{const r=read();if(!r.h||!r.w)return toast('Check height and weight');
  const bd=HWWhen.stamp({time:false,sig:'b'+r.h+'/'+r.w});if(!bd)return;
  if(!bd.back){st.p.h=r.h;st.p.w=r.w;if(r.sx)st.p.sex=r.sx;if(r.a)st.p.age=r.a;if(r.a&&r.sx)st.p.cfm=1;if(known())computeGoals(1)} // goals only from confirmed body data
  add('bmi',+(r.w/Math.pow(r.h/100,2)).toFixed(1),{h:r.h,w:r.w},'',bd.d,bd.t,10,'BMI saved');HWWhen.saved(bd,'BMI');render()};

/* ---------- routes, tile, banner, page keys ---------- */
const TO={bmi:'be-bmi',calc:'be-energy'};
{const g0=go;go=function(v){const t=TO[v];if(!t)return g0.apply(this,arguments);const r=g0.call(this,'body');
  const el=$i(t);if(el&&t!=='be-bmi')el.scrollIntoView({block:'start'});return r}}
{const i=HUB.findIndex(h=>h[0]==='bmi');if(i>=0)HUB.splice(i,1,['body','⚖️','Body & Energy','Balance Tower · Energy Forge',()=>'']);
  const j=HUB.findIndex(h=>h[0]==='calc');if(j>=0)HUB.splice(j,1)}
PAR.body='health';
BN.body=['⚖️','Body & Energy','Balance Tower and Energy Forge, one hall.','rgba(135,103,200,.3)'];
DIS.body=DIS.bmi+' '+DIS.calc;
return{read,full}})();
