/* v6: worked explanations ("?") for the Stairs page's calculations, kept out of js/v6-stairs.js (64 KB file cap). Not part of
   the original. Pure functions: js/v6-stairs.js passes in its numbers and the panels use HWExplain (js/v6-sources.js), so the
   formulas shown are the ones js/v6-stairs.js runs (estimate(), projectVO2(), peak()); tests/60-explain.test.mjs checks the sums. */
const HWCalcX=(()=>{
/** Stair workout energy (js/v6-stairs.js estimate()): the same sums with the user's numbers. hr is the checked after-workout
    heart rate or null, met the pace's MET. */
function stairKcal(e,P,pace,dur,hr,met){const N=HWExplain.num,m=P.sex==='m',bmr=10*P.w+6.25*P.h-5*P.age+(m?5:-161),a=met*bmr/1440*dur,useB=e.m==='met+hr',
  kj=useB?(m?-55.0969+.6309*hr+.1988*P.w+.2017*P.age:-20.4022+.4472*hr-.1263*P.w+.074*P.age):null,steps=[
  'BMR (Mifflin-St Jeor): 10 × '+N(P.w,1)+' + 6.25 × '+N(P.h,1)+' − 5 × '+P.age+(m?' + 5':' − 161')+' = '+N(bmr,1)+' kcal a day',
  'A · MET method: '+met+' MET ('+esc(pace)+' pace) × '+N(bmr,1)+' ÷ 1440 × '+N(dur,1)+' min = '+N(a,1)+' kcal'];
  if(useB)steps.push('B · heart-rate method: '+(m?'−55.0969 + 0.6309 × '+hr+' + 0.1988 × '+N(P.w,1)+' + 0.2017 × '+P.age:'−20.4022 + 0.4472 × '+hr+' − 0.1263 × '+N(P.w,1)+' + 0.074 × '+P.age)+' = '+N(kj,2)+' kJ/min; ÷ 4.184 × '+N(dur,1)+' min = '+N(kj/4.184*dur,1)+' kcal',
    'Estimate = mean of A and B = '+e.v+' kcal'+(e.lo!==e.hi?'; range = '+e.lo+'–'+e.hi+' kcal':''));
  else steps.push('Estimate = A, rounded = '+e.v+' kcal');
  return HWExplain.html({inputs:[{n:'Pace',v:esc(pace),o:'you'},{n:'Workout time',v:dur,u:'min',o:'you',d:1},{n:'After-workout heart rate',v:hr,u:'BPM',o:hr?'you':'missing',d:0},{n:'Age',v:P.age,u:'years',o:'you',d:0},{n:'Weight',v:P.w,u:'kg',o:'you',d:1},{n:'Height',v:P.h,u:'cm',o:'you',d:1},{n:'Sex',v:m?'male':'female',o:'you'}],
    formula:'A: kcal = MET × (BMR ÷ 1440) × minutes\nB: kJ/min = (Keytel, by sex) from HR, weight and age; kcal = kJ ÷ 4.184 × minutes\n   (B only with an after-workout heart rate of 90–180 BPM)\nestimate = mean of the methods used (with two, the spread is shown)',
    vars:[['MET','stair climbing: slow 4.5, general 6.8, fast 9.3',''],['BMR ÷ 1440','resting energy per minute','kcal/min'],['HR','heart rate just after the workout','BPM']],
    steps,src:['compwalk','mifflin','keytel','nistcal'],
    app:'HealthWiz scales the MET by your own resting energy (BMR ÷ 1440) instead of the standard 1 kcal per kg per hour, and averages the two methods when both can run. Easy, Moderate and Vigorous pace are matched to the Compendium\'s slow, general and fast stair climbing.',
    limits:['Neither method measures energy; both predict it for groups of adults.','The heart rate after a short climb is not the steady-state exercise heart rate the Keytel model was built on.','Not saved as a measurement and never scored.']})}
/** Our project's VO₂ method (js/v6-stairs.js projectVO2()): b, a = pulse before and after, w = weight (kg). */
function project(v,b,a,w){const N=HWExplain.num,P={w};
  const steps=['VO₂ = 15.3 × '+a+' ÷ '+b+' = '+N(v.ml,2)+' mL/kg/min','In litres a minute: '+N(v.ml,2)+' × '+N(P.w,1)+' ÷ 1000 = '+N(v.lmin,3)+' L/min'];
  if(v.kj!=null)steps.push('Energy: '+N(v.lmin,3)+' × '+N(v.dur,1)+' min × 20.1 = '+N(v.kj,1)+' kJ','In kcal: '+N(v.kj,1)+' ÷ 4.184 = '+N(v.kcal,1)+' kcal');
  return HWExplain.html({inputs:[{n:'Pulse before (rest)',v:b,u:'BPM',o:'you',d:0},{n:'Pulse after',v:a,u:'BPM',o:'you',d:0},{n:'Weight',v:P.w,u:'kg',o:'you',d:1},{n:'Workout time',v:v.dur||null,u:'min',o:v.dur?'you':'missing',d:1}],
    formula:'VO₂ (mL/kg/min) = 15.3 × pulse after ÷ pulse before\nVO₂ (L/min) = VO₂ × weight ÷ 1000'+(v.kj!=null?'\nenergy = VO₂ (L/min) × minutes × 20.1 kJ per litre of O₂\nkcal = energy in kJ ÷ 4.184':''),
    steps,src:v.kj!=null?['f21','uth','mcardle','weir','nistcal']:['f21','uth'], // only the sources the shown steps use
    app:'This is Group 14\'s classroom method (report, Section 3.1). It assumes the pulse just after climbing equals the maximum pulse, so the result is an estimated VO₂max, not the oxygen you used during the climb. 20.1 kJ per litre is the report\'s interpolation for a mixed diet (RER 0.8) between McArdle\'s 19.6 kJ/L (RER 0.7) and 21.1 kJ/L (RER 1.0); RER was not measured.',
    limits:['Uth\'s factor was found in well-trained men with a true maximal heart rate; an after-exercise pulse is lower, and the result is not your VO₂max or your real oxygen use.','Shown for learning only: never saved, never in the Health Score.']})}
/** Peak heart rate as a share of 220 − age (js/v6-stairs.js peak()); dev = the peak came from a heart-rate device. */
function peak(p,dev){const age=p&&p.max?220-p.max:null;
  return HWExplain.btn('xpeak','How the peak heart rate is compared',{what:'Your highest heart rate in this workout, as a share of an estimated maximum heart rate for your age.',
    inputs:[{n:'Peak heart rate (highest of the climb and just after)',v:p.pk,u:'BPM',o:dev?'device':'you',d:0},{n:'Age',v:age,u:'years',o:'you',d:0}],
    formula:'estimated maximum = 220 − age\nshare = peak ÷ estimated maximum × 100, rounded',
    steps:['Estimated maximum: 220 − '+age+' = '+p.max+' BPM','Share: '+p.pk+' ÷ '+p.max+' × 100 = '+HWExplain.num(p.pk/p.max*100,1)+' % → '+p.pct+' %',
      'For comparison, Tanaka et al.: 208 − 0.7 × '+age+' = '+HWExplain.num(208-.7*age,1)+' BPM'],
    result:p.pct+' %',src:['tanaka'],
    app:'HealthWiz keeps 220 − age because it is the rule taught in class, and shows Tanaka\'s formula beside it so the difference is visible.',
    limits:['Neither formula measures your own maximum heart rate.','The share does not say whether a workout was safe or too hard. Stop if you feel unwell.']})}
/** The project method cannot be used when the pulse after is below the pulse before: VO₂ would be under 15.3 and "cannot be a
    maximum and should not be interpreted" (Group 14 report, Section 4.4). short = one line for a session card. */
function invalid(b,a,short){const t='Our project\'s method is not valid here: the pulse after ('+a+' BPM) is lower than the pulse before ('+b+' BPM), so after ÷ before is below 1.';
  return short?'<p class="mut">'+t+'</p>':'<div class="stkc stproj"><b>OUR PROJECT\'S METHOD <span class="pxtag">NOT VALID</span></b><p>'+t+'</p>'
    +'<small class="mut">Our report found the same in 6 of 18 results and did not use them. Count your pulse in the first 15–30 seconds after climbing, when it is closest to its peak (report, Section 4.8).</small></div>'}
return{stairKcal,project,peak,invalid}})();
