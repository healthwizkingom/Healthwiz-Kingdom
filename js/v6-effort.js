/* v6: Estimated effort band, a line under the workout's peak heart rate. Not part of the original.
   Feature 2 of the owner's catalog, in its honest form (docs/FEATURE_CONSULTS.md). The catalog asked for ventilatory thresholds, the
   carbohydrate-to-fat crossover and EPOC. None of those can be measured from a pulse and a cadence (they need breathing-gas data), so
   they are NOT built and nothing here says which fuel the body is using. This only names an effort level from the pulse.

   How: estimated maximum = 208 − 0.7 × age (Tanaka et al., source id 'tanaka'); share = peak ÷ maximum × 100, rounded; the band is
   read from the rounded share:
        under 64 %  Below moderate        64 to 76 %  Moderate        77 to 95 %  Vigorous        96 % and over  Near-maximal
   The cut-offs are the ones published intensity tables attribute to the ACSM guideline (Garber et al. 2011, id 'acsm'). HealthWiz has NOT
   yet checked them against the guideline's own table, and the light end of the scale differs between sources (very light / light begin
   at 57 % in some, 50 % in others), so everything under 64 % is one band here. The Vault entry says the same.
   The peak is the highest of the climb's top pulse and the pulse right after stopping, as the existing comparison already uses
   (js/v6-stairs.js peak()). The line is shown, never saved, never scored, no XP. Needs the age from the confirmed profile; without it no
   band is shown. For under-18s a note says the guideline is for adults, so the band is a rough guide only.
   band() is pure so the tests can check worked examples. Not a diagnosis; nothing says a workout was safe or too hard.

   HEART-RATE RESPONSE INDEX (Feature 9, same card, same peak): response = peak ÷ pulse before, shown to one decimal as "2.3 ×". A plain ratio of
   two pulse numbers, nothing more: no bands, no good or bad, no VO₂, and no claim about vascular tone, arterial compliance or elasticity
   (a pulse alone cannot show any of those; docs/FEATURE_CONSULTS.md). Resting = THIS workout's own "pulse before" only: when it or the peak
   is missing, out of range, or the peak is below the pulse before, the index is "unavailable" and says what to add. Nothing is ever
   substituted from another day or estimated. Uth et al. (id 'uth') is context only: the project's VO₂ estimate uses a related ratio (pulse
   after ÷ pulse before) with a factor of 15.3 (js/v6-stairs.js projectVO2); this is the ratio alone. Shown, never saved or scored.
   response() is pure for the tests. */
const HWEffort=(()=>{
const BANDS=[[96,'Near-maximal'],[77,'Vigorous'],[64,'Moderate'],[0,'Below moderate']];
/** Tanaka's estimated maximum (BPM, rounded) for an age of 10 to 100, else null. */
const maxOf=age=>{age=+age;return Number.isFinite(age)&&age>=10&&age<=100?Math.round(208-.7*age):null};
/** pk = peak pulse (BPM, 30–220), age = years. {pk, age, max, pct, band} or null when either is missing or out of range. */
function band(pk,age){pk=+pk;const max=maxOf(age);if(!(pk>=30&&pk<=220)||!max)return null;pk=Math.round(pk);
  const pct=Math.round(pk/max*100);return{pk,age:Math.round(+age),max,pct,band:BANDS.find(b=>pct>=b[0])[1]}}
const f1=x=>(+x).toLocaleString('en',{maximumFractionDigits:1});
function why(r,dev){return HWExplain.btn('xband','How the effort band is worked out',{ev:'effort',what:'Your highest heart rate in this workout as a share of an age-based estimated maximum, and the effort level that share falls in.',
  inputs:[{n:'Peak heart rate (highest of the climb and just after)',v:r.pk,u:'BPM',o:dev?'device':'you',d:0},{n:'Age',v:r.age,u:'years',o:'you',d:0}],
  formula:'estimated maximum = 208 − 0.7 × age (Tanaka)\nshare = peak ÷ estimated maximum × 100, rounded\nbands, on the rounded share: under 64 % below moderate · 64–76 % moderate · 77–95 % vigorous · 96 % and over near-maximal',
  steps:['Estimated maximum: 208 − 0.7 × '+r.age+' = '+f1(208-.7*r.age)+' → '+r.max+' BPM','Share: '+r.pk+' ÷ '+r.max+' × 100 = '+f1(r.pk/r.max*100)+' % → '+r.pct+' %',r.pct+' % falls in the '+r.band+' band'],
  result:r.band+' ('+r.pct+' %)',src:['tanaka'],
  app:'An estimated effort level from your pulse, shown under the 220 − age comparison. It says nothing about which fuel your body is using, how fit you are, or whether the workout was safe.',
  limits:['The maximum is an age-based average; your own can be higher or lower.','The cut-offs come from published tables that attribute them to the ACSM guideline; HealthWiz has not yet checked them against the guideline itself, and the lighter bands differ between sources, so everything under 64 % is one band.','The ACSM guideline is written for apparently healthy adults.','Not a diagnosis. Stop if you feel unwell.']})}
/** The line for the workout card; '' when no band can be given. dev = the peak came from a heart-rate device. */
function html(pk,age,dev){const r=band(pk,age);if(!r)return'';
  return '<br><span id="st-band"><b>Estimated effort: '+r.band+'</b> · about <b>'+r.pct+'%</b> of an estimated maximum of '+r.max+' BPM (208 − 0.7 × age) '+why(r,dev)
    +'<br><small class="mut">An estimate of effort from your pulse, not a measure of fuel, fitness or safety.'+(r.pct>100?' It is above the estimate, which is only an average.':'')
    +(r.age<18?' The guideline behind the bands is for adults, so for under-18s this is a rough guide only.':'')+'</small></span>'}
/** pk = peak pulse, b = pulse before (BPM, 30–220, numbers or numeric text). null when neither is entered; {ok:false, why} when the index cannot be given;
    {ok:true, pk, b, ratio (one decimal), exact} otherwise. Never fills a missing number in. */
const okH=v=>{v=typeof v==='string'&&v.trim()===''?NaN:+v;return Number.isFinite(v)&&v>=30&&v<=220?Math.round(v):null};
function response(pk,b){const p=okH(pk),r=okH(b);
  if(p==null&&r==null)return null;
  if(p==null||r==null)return{ok:false,pk:p,b:r,why:'Add '+(r==null?'your pulse before':'the highest pulse during the climb, or the pulse right after')+'.'};
  if(p<r)return{ok:false,pk:p,b:r,why:'The peak ('+p+' BPM) is lower than the pulse before ('+r+' BPM), so check the numbers.'};
  return{ok:true,pk:p,b:r,ratio:Math.round(p/r*10)/10,exact:p/r}}
function whyHri(r,devPk,devB){return HWExplain.btn('xhri','How the heart-rate response is worked out',{ev:'hri',what:'Your highest pulse in this workout divided by the pulse you took before it: how many times your resting-style pulse it reached.',
  inputs:[{n:'Peak heart rate (highest of the climb and just after)',v:r.pk,u:'BPM',o:devPk?'device':'you',d:0},{n:'Pulse before the workout',v:r.b,u:'BPM',o:devB?'device':'you',d:0}],
  formula:'response = peak ÷ pulse before, shown to one decimal',steps:['Response: '+r.pk+' ÷ '+r.b+' = '+(Math.round(r.exact*100)/100)+' → '+r.ratio.toFixed(1)+' ×'],result:r.ratio.toFixed(1)+' ×',src:['uth'],
  app:'A plain ratio of two pulse numbers, with no bands, no labels and no VO₂, vascular or fitness claim. Uth et al. is context only: the project\u2019s VO₂ estimate uses a related ratio (pulse after ÷ pulse before) with a factor of 15.3; this index is the ratio alone.',
  limits:['The pulse before is only a resting pulse if you took it at rest.','It does not measure vascular tone, arterial compliance or elasticity, and a pulse alone cannot show those.','No range is called good or low: nothing here says what a ratio should be.','Not a diagnosis. Stop if you feel unwell.']})}
/** The line under the peak and effort band: '' when neither number is entered, "unavailable" with what to add, or the ratio with its "?". */
function responseHtml(pk,b,devPk,devB){const r=response(pk,b);if(!r)return'';
  if(!r.ok)return'<br><span id="st-hri"><b>Heart-rate response: unavailable.</b> <span class="mut">'+r.why+'</span></span>';
  return'<br><span id="st-hri"><b>Heart-rate response: '+r.ratio.toFixed(1)+' ×</b> your pulse before (peak '+r.pk+' ÷ before '+r.b+') '+whyHri(r,devPk,devB)
    +'<br><small class="mut">A plain ratio of two pulse numbers. It does not measure vascular tone, arterial compliance or elasticity, and it is not a medical measurement.</small></span>'}
return{band,maxOf,html,BANDS,response,responseHtml}})();
