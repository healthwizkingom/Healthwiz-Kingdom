/* v6: Hydrate & Cool, an estimated fluid deficit under the workout card. Not part of the original.
   Feature 5 of the owner's catalog, in its honest form (docs/FEATURE_CONSULTS.md). The catalog tied sweat to "dehydration shock risk".
   A calculation cannot show dehydration or heat illness, so this gives ONE labelled estimate, "estimated fluid deficit", and nothing else:
   no alert, no "drink now", no risk wording.
   Energy in: the project's own energy estimate (js/v6-stairs.js projectVO2: VO₂ from the two pulses, × minutes × 20.1 kJ/L). No second energy
   calculation is made here. It needs a confirmed profile weight, a resting pulse, an after-workout pulse and a workout time.
   The sum (four labelled assumptions, none of them measured on this person):
     heat to lose  Q = energy × (1 − η)           η = 0.20  share of the energy that becomes movement (the rest is heat)
     sweat needed  S = Q ÷ (α × Lv)               α = 0.80  share of sweat that evaporates (the rest drips off and cools nothing)
                                                  Lv = 2426 kJ/kg  latent heat of PURE water at about 31.6 °C (NIST, source id 'nistwater')
   Also assumed: ALL the heat leaves as sweat (convection, radiation and breath are ignored), and 1 g of sweat is 1 mL.
   Real sweat has dissolved salts, so its Lv can differ slightly. η and α are HealthWiz's own round figures; no source gives them here.
   The skin-temperature wording is NOT used: only "the value at about 31.6 °C" (no source is held for a typical skin temperature).
   Shown, never saved or scored: memory only. Stop if dizzy, faint or unwell. Not medical advice.
   deficit() is pure so the tests can check worked examples. */
const HWHydrate=(()=>{
const ETA=.20,ALPHA=.80,LV=2426,$i=i=>document.getElementById(i);
const isN=x=>typeof x==='number'&&isFinite(x);
/** kj = energy in kJ (> 0) → {kj, q (kJ of heat), kg, ml (unrounded), show (text)}, or null when kj is not a positive number. */
function deficit(kj){if(!isN(kj)||!(kj>0))return null;const q=kj*(1-ETA),kg=q/(ALPHA*LV),ml=kg*1000,r1=Math.round(ml*10)/10;
  return{kj,q,kg,ml,show:r1>=10?String(Math.round(ml)):r1.toFixed(1)}}
const f1=x=>(+x).toLocaleString('en',{maximumFractionDigits:1});
const f2=x=>(+x).toLocaleString('en',{maximumFractionDigits:2});
const SAFE='Stop if you feel dizzy, faint or unwell.';
/** what the card can say for the current workout draft: {k:'none'} (nothing entered), {k:'need', miss:[…]} or {k:'ok', r, v} */
function status(){
  if(typeof HWStairs==='undefined'||!HWStairs.projectNow)return{k:'none'};
  const d=HWStairs.draft,P=HWStairs.profile(),b=+d.hrB>0,a=+d.hrA>0;
  if(!b&&!a)return{k:'none'};
  const miss=[];if(!P)miss.push('your confirmed profile (age, sex, height and weight)');if(!b)miss.push('your pulse before');if(!a)miss.push('your pulse after');
  const v=P&&b&&a?HWStairs.projectNow():null;
  if(v&&!v.valid)return{k:'need',miss:['an after pulse that is not lower than the pulse before']};
  if(v&&v.kj==null)miss.push('the workout time (use the Pace & Breathe timer, or type it)');
  if(miss.length||!v)return{k:'need',miss};
  return{k:'ok',v,r:deficit(v.kj)}}
const why=(v,r)=>HWExplain.btn('xhydrate','How the estimated fluid deficit is worked out',{ev:'hydrate',what:'An estimate of how much sweat the heat from your workout would need, if all of it left by sweating.',
  inputs:[{n:'Energy used (the project’s method)',v:Math.round(v.kj),u:'kJ',o:'calc',d:0},{n:'Share that becomes heat (1 − η, η = 0.20)',v:.8,u:'',o:'default',d:1},{n:'Share of sweat that evaporates (α)',v:.8,u:'',o:'default',d:1},{n:'Latent heat of pure water (Lv, NIST, at about 31.6 °C)',v:LV,u:'kJ/kg',o:'calc',d:0}],
  formula:'heat Q = energy × (1 − η)\nsweat S = Q ÷ (α × Lv)',
  steps:['Heat: '+Math.round(v.kj)+' × (1 − 0.20) = '+f1(r.q)+' kJ','Sweat: '+f1(r.q)+' ÷ (0.80 × 2426) = '+(Math.round(r.kg*10000)/10000)+' kg','1 g of sweat taken as 1 mL → about '+r.show+' mL'],
  result:'about '+r.show+' mL (estimated fluid deficit)',src:['nistwater'],
  app:'A rough estimate of the sweat your workout energy would call for. It does not say you are dehydrated, how much to drink, or whether you are at risk of heat illness.',
  limits:['η = 0.20 and α = 0.80 are HealthWiz’s own round figures; no source in the app gives them.','It assumes all the heat leaves as sweat; air, radiation and breathing also carry heat, so the real figure is likely lower.','Lv is for pure water; real sweat has salts, so its value can differ slightly.','The energy is itself an estimate from a classroom method; this figure inherits its error.','Not a medical measurement. '+SAFE]})
function body(){const s=status();
  if(s.k==='need')return'<p role="status"><b>Estimated fluid deficit: unavailable.</b> Add '+s.miss.join(', ')+'.</p>';
  const {v,r}=s;
  return'<p role="status"><b>Estimated fluid deficit: about '+r.show+' mL</b> '+why(v,r)+'<br>From the project’s energy estimate of '+Math.round(v.kj)+' kJ: '+f1(r.q)+' kJ of heat to lose, at 2426 kJ per kg of water evaporated.</p>'
    +'<ul class="hyl"><li>Assumed: <b>20 %</b> of the energy becomes movement, the rest heat (η = 0.20).</li><li>Assumed: <b>80 %</b> of sweat evaporates; the rest drips off (α = 0.80).</li><li>Assumed: all the heat leaves as sweat, and 1 g of sweat is 1 mL.</li><li>Latent heat is for pure water (NIST, about 31.6 °C); real sweat has salts and can differ slightly.</li></ul>'
    +'<p class="mut">An estimate of sweat the energy calls for, not a measured loss. It does not say you are dehydrated or at risk.</p>'}
function card(){const s=status();if(s.k==='none')return'';return'<div class="card stcard hydc" id="hyd-card"><h3>HYDRATE &amp; COOL</h3><span class="pxtag gvtag">ESTIMATE</span>'+body()+'<small class="mut hyds">'+SAFE+' Not saved, scored, or a medical measurement.</small></div>'}
function paint(){const c=$i('hyd-card'),h=card();
  if(c){if(h)c.outerHTML=h;else c.remove();return}
  if(!h)return;const a=$i('drift-card')||$i('sthrc');if(a)a.insertAdjacentHTML('afterend',h)}   // typing a pulse does not redraw the page, so the card is added here
// the card follows the numbers typed above it (the inputs are handled by the page first; this runs after)
['input','change','click'].forEach(t=>document.addEventListener(t,()=>setTimeout(paint,0),true));
HWEvents.on('data:reset',()=>setTimeout(paint,0));
{const p=HWStairs.logPanel;HWStairs.logPanel=function(){const h=p.apply(this,arguments);if(typeof h!=='string'||!h.includes('id="sthrc"'))return h;const c=card();return c?h+c:h}}
HWUI.css('hydrate','.hydc h3{margin-bottom:4px}.hydc p{margin:8px 0}.hydc .hyds{display:block;margin-top:8px}.hyl{margin:8px 0;padding-left:20px;font-size:13px}.hyl li{margin:4px 0}');
return{deficit,status,card,ETA,ALPHA,LV}})();
