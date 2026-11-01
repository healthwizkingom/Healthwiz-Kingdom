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
   band() is pure so the tests can check worked examples. Not a diagnosis; nothing says a workout was safe or too hard. */
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
return{band,maxOf,html,BANDS}})();
