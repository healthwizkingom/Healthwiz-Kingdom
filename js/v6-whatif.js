/* v6: the Arcane Score Simulator ("WHAT IF?") on the Health Score page. Not part of the original.
   A simulation only. Nothing here is saved: no entry is added, no setting or goal changes, no XP, badge or leaderboard
   row is touched, and st / storage are never written (tests/55-whatif.test.mjs checks the save is byte-identical).
   The numbers in the panel live in this file's memory and are gone when the page is left or the panel is closed.

   The score is NOT recalculated by a second formula. The sliders feed the same pieces js/v6-score.js uses for the real score:
     HWScore.SUBF   value → sub-score (0–100), the functions indicators() itself calls
     HWScore.combine  Σ (weight × sub-score) ÷ Σ weight of the indicators that have data, with HWScore.WT (10 weights, total 100)
     HWScore.WHY    the "why these weights" text of the Why These Weights card
   The six areas are Nutrition 25 · Activity 25 · Heart rate 15 · Sleep 15 · BMI 10 · Stress 10; the ten sliders are the
   ten measured values inside them (fruit & veg, water, calories, [macronutrients], stairs, calories burned, resting heart rate, sleep, BMI, stress).

   Starting point: every slider starts at the user's real value for the window chosen on the page (TODAY or LAST 7 DAYS).
   An indicator the user has not logged has no real value, so it is OFF (left out of the score, exactly as the real score leaves it out)
   until the user adds it to the simulation with a switch; its slider then starts mid-range, which is a starting point to explore from, not data.
   Macronutrients are three linked numbers (protein, carbs, fat), so they are shown but held at the real value. */
const HWWhatIf=(()=>{
const SC=HWScore,R1=x=>Math.round(x*10)/10,fx=(x,d)=>(+x).toFixed(d);
const SPEC={
  fv:{min:0,max:10,step:.5,mid:5,f:v=>fx(v,1)+' portions/day'},
  water:{min:0,max:4000,step:50,mid:2000,f:v=>Math.round(v)+' mL/day'},
  kcal:{min:0,max:4000,step:50,mid:2000,f:v=>Math.round(v)+' kcal/day'},
  stairs:{min:0,max:300,step:5,mid:150,f:v=>Math.round(v)+' effort-steps/day'},
  burn:{min:0,max:600,step:10,mid:300,f:v=>Math.round(v)+' kcal/day'},
  hr:{min:40,max:140,step:1,mid:90,f:v=>Math.round(v)+' BPM at rest'},
  sleep:{min:0,max:14,step:.25,mid:7,f:v=>fx(v,1)+' h/night'},
  bmi:{min:12,max:45,step:.1,mid:28,f:v=>'BMI '+fx(v,1)},
  stress:{min:1,max:10,step:.5,mid:5.5,f:v=>fx(v,1)+' / 10'}};
let open=false,sim={},base='',real=null;
const ico=n=>HWPixel.icon(n,1);
const sgn=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
const ok=k=>k!=='kcal'||+st.s.kcal>0;                          // the calorie sub-score needs the user's own calorie target
const realVals=C=>{const o={};for(const k in SC.WT){const i=C.I[k];o[k]=i?(k==='macro'?'fixed':R1(i.val*100)/100):null}return o};

/* ---------- the simulated score: the real formula over the real + simulated indicators ---------- */
function simulate(C){
  const I={};
  for(const k in SC.WT){
    const r=C.I[k];
    if(k==='macro'){if(r)I.macro=r;continue}                   // held at the real value
    if(sim[k]==null)continue;                                   // not logged and not added: left out, as in the real score
    I[k]=r&&sim[k]===r.val?r:{val:sim[k],sub:SPEC[k]?SC.SUBF[k](sim[k]):0}}
  return SC.combine(I)}
const pts=(S,k)=>S.I[k]&&S.w?SC.WT[k]*S.I[k].sub/100/S.w*100:null;
function init(C){real=C;sim={};for(const k in SC.WT){if(k!=='macro'&&C.I[k])sim[k]=C.I[k].val}base=JSON.stringify(realVals(C))}

/* ---------- pieces ---------- */
// small original rune marks, drawn on a 7 x 9 grid with crisp edges (decoration only)
const RUNES=['M1 0V8M1 2L5 4L1 6','M1 0V8M1 4H5M5 0V8','M0 8L3 0L6 8M1 5H5','M1 0V8M1 1L5 3L1 5M1 4L5 8','M0 0L6 4L0 8M6 0V8'];
const rune=i=>'<svg class="wifr" viewBox="-1 -1 8 10" width="14" height="18" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><path d="'+RUNES[i%RUNES.length]+'" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
const runes=()=>'<span class="wifrs" aria-hidden="true">'+[0,1,2,3,4].map(rune).join('')+'</span>';
const LABEL='SIMULATION — YOUR REAL HEALTH LOG IS UNCHANGED.';
function help(){return HWHelp.btn('whatif','What-if simulator','<p><b>'+LABEL+'</b></p><p>The sliders only change numbers inside this panel. Nothing is saved, no log entry is added, and no achievement, XP or leaderboard changes.</p><p>The simulated score uses the same formula and the same weights as your real Health Score. A simulated score only shows how the arithmetic would change. It does not predict that your real health, or your real score, would change by that amount.</p><p>The Health Score is a habit summary, not a medical diagnosis or a validated clinical risk score.</p>',{label:'About the what-if simulator'})}
function slider(k,C){
  const sp=SPEC[k],r=C.I[k],on=sim[k]!=null,v=on?sim[k]:sp.mid;
  const mx=Math.max(sp.max,Math.ceil(v)),mn=Math.min(sp.min,Math.floor(v));
  const row='<div class="wifrow" data-k="'+k+'"><div class="wifh"><label for="wif-r-'+k+'"><b>'+SC.LBL[k]+'</b></label><span class="wifreal">Real: '+(r?esc(r.txt):'<i>not logged</i>')+'</span></div>';
  if(!ok(k))return row+'<small class="mut">Needs a calorie target. Set one in Body &amp; Energy.</small></div>';
  if(!r&&!on)return row+'<button type="button" class="g sm wifadd" data-a="wifinc" data-k="'+k+'" aria-label="Add '+esc(SC.LBL[k])+' to the simulation">ADD TO SIMULATION</button><small class="mut">Not logged, so it is left out of your real score. Adding it here changes the weights of the others.</small></div>';
  return row+'<div class="wifs"><input type="range" id="wif-r-'+k+'" data-in="wif" data-k="'+k+'" min="'+mn+'" max="'+mx+'" step="'+sp.step+'" value="'+v+'" aria-describedby="wif-v-'+k+'">'
    +'<output id="wif-v-'+k+'" class="wifv" for="wif-r-'+k+'">'+esc(sp.f(v))+'</output></div>'
    +(r?'':'<small class="mut">Starting point to explore from, not your data. <button type="button" class="wifx" data-a="wifdrop" data-k="'+k+'">REMOVE</button></small>')+'</div>'}
function groups(C){
  return SC.GROUP.map(g=>{const w=g[2].reduce((s,k)=>s+SC.WT[k],0);
    return '<fieldset class="wifg"><legend>'+esc(g[1].replace(/^\S+\s/,''))+' <span class="wifw">weight '+w+' of 100</span></legend>'
    +g[2].map(k=>k==='macro'?'<div class="wifrow" data-k="macro"><div class="wifh"><b>'+SC.LBL.macro+'</b><span class="wifreal">Real: '+(C.I.macro?esc(C.I.macro.txt):'<i>not logged</i>')+'</span></div><small class="mut">'+(C.I.macro?'Held at your real value in the simulation (three linked numbers).':'Not logged, so it is left out.')+'</small></div>':slider(k,C)).join('')
    +'<details class="wifwhy"><summary>Why this weight?</summary><p>'+SC.WHY[g[0]]+'</p></details></fieldset>'}).join('')}
function table(C,S){
  let rows='';
  for(const k in SC.WT){const a=C.I[k],b=S.I[k];if(!a&&!b)continue;
    const pa=pts(C,k),pb=pts(S,k),d=pa!=null&&pb!=null?R1(pb-pa):null;
    rows+='<tr><td>'+SC.LBL[k]+'</td><td>'+(a?esc(a.txt):'–')+'</td><td>'+(b?esc(k==='macro'||!SPEC[k]?b.txt:SPEC[k].f(b.val)):'–')+'</td><td>'+SC.WT[k]+'</td><td>'+(pa==null?'–':R1(pa))+' → '+(pb==null?'–':R1(pb))+(d?' <b>('+(d>0?'+':'−')+Math.abs(d)+')</b>':'')+'</td></tr>'}
  return '<div class="tscroll"><table class="tbl wiftbl"><thead><tr><th>INDICATOR</th><th>REAL</th><th>SIMULATED</th><th>WEIGHT</th><th>POINTS<br>real → sim</th></tr></thead><tbody>'+rows+'</tbody></table></div>'}
function math(S){
  const ks=Object.keys(SC.WT).filter(k=>S.I[k]);
  if(!ks.length)return 'No indicator has data, so there is no score to simulate.';
  const top=ks.map(k=>SC.WT[k]+'×'+Math.round(S.I[k].sub)).join(' + '),sum=ks.reduce((s,k)=>s+SC.WT[k]*S.I[k].sub,0);
  return 'Score = Σ(weight × sub-score) ÷ Σ(weights of the indicators that have data)<br>= ('+top+') ÷ '+S.w+' ≈ '+R1(sum)+' ÷ '+S.w+' = <b>'+fx(sum/S.w,1)+'</b>, rounded to <b>'+S.score+'</b>.<br><small class="mut">Sub-scores (0–100) are shown rounded here; the calculation uses them unrounded.</small>'}
function out(C,S){
  const a=C.score,b=S.score,d=a!=null&&b!=null?b-a:null;
  const dt=d==null?(b==null?'No score to simulate yet':'Your real score is not available yet, so there is no difference to show'):d===0?'No change (0 points)':sgn(d)+' point'+(Math.abs(d)===1?'':'s')+' in this simulation';
  return '<div class="wifscore"><div><small class="mut">YOUR REAL SCORE</small><b class="wifa">'+(a==null?'–':a)+'</b></div><div class="wifarrow" aria-hidden="true">→</div>'
    +'<div class="wifsim"><small>SIMULATED SCORE</small><b id="wif-score" class="wifb" data-v="'+(b==null?'':b)+'">'+(b==null?'–':b)+'</b></div>'
    +'<div class="wifdiff'+(d>0?' up':d<0?' dn':'')+'" id="wif-diff" role="status">'+esc(dt)+'</div></div>'
    +'<p class="wifnote" id="wif-note">If these numbers changed, the arithmetic of the score would change like this. It does not predict that your real health would change.</p>'}
function inner(C){
  const S=simulate(C),win=SC.K.win()==='week'?'your 7-day averages':'today’s values';
  const head='<div class="wifhd">'+runes()+'<h3>'+ico('wizard')+' ARCANE SCORE SIMULATOR '+help()+'</h3>'+runes()+'</div>';
  if(!open)return head+'<p>Slide the indicators and see how the weighted Health Score would move. Nothing you do here is saved.</p>'
    +'<button type="button" class="wifopen" data-a="wifopen" aria-expanded="false" aria-controls="wif-body">WHAT IF?</button><p class="wifsimtag" role="note">'+LABEL+'</p>';
  return head+'<p class="wifsimtag" role="note">'+LABEL+'</p>'
    +'<div id="wif-body"><p class="mut">Starting from '+win+'. Move a slider to try a different value.</p>'
    +'<div id="wif-out" aria-live="polite">'+out(C,S)+'</div>'
    +'<div class="wifbtns"><button type="button" class="wifreset" data-a="wifreset">RESET TO MY REAL VALUES</button><button type="button" class="g" data-a="wifclose">CLOSE</button></div>'
    +groups(C)
    +'<div class="wifsec"><h4>'+ico('chart')+' HOW EACH INDICATOR CONTRIBUTES</h4><div id="wif-tbl">'+table(C,S)+'</div>'
    +'<small class="mut">Points are each indicator’s share of the score (weight × sub-score ÷ total weight). Removing or adding an indicator changes the total weight, so every share moves.</small></div>'
    +'<div class="wifsec"><h4>'+ico('scroll')+' THE ARITHMETIC</h4><p id="wif-math">'+math(S)+'</p>'
    +'<small class="mut">Same formula and weights as your real Health Score. A habit summary, not a medical diagnosis or a validated clinical risk score.</small></div></div>'}

/* ---------- paint ---------- */
let rafId=0,shown=null;
function tween(el,to){
  if(!el)return;if(to==null||HWUI.reduced()||shown==null||shown===to){el.textContent=to==null?'–':to;shown=to;return}
  cancelAnimationFrame(rafId);const from=shown,t0=performance.now(),D=320;shown=to;
  const f=n=>{const p=Math.min(1,(n-t0)/D);el.textContent=Math.round(from+(to-from)*p);if(p<1)rafId=requestAnimationFrame(f)};rafId=requestAnimationFrame(f);
  el.classList.remove('pulse');void el.offsetWidth;el.classList.add('pulse')}
function repaint(){const root=document.getElementById('wif');if(!root)return;const C=SC.compute();
  if(open&&base!==JSON.stringify(realVals(C)))init(C);                   // the logs changed under an open panel: start again from the new real values
  root.classList.toggle('open',open);root.innerHTML=inner(C);const b=document.getElementById('wif-score');shown=b&&b.dataset.v!==''?+b.dataset.v:null}
// a slider moved: update the numbers in place so the slider keeps focus and the page does not jump
INP.wif=el=>{const k=el.dataset.k,sp=SPEC[k];if(!sp)return;sim[k]=+el.value;
  const C=SC.compute(),S=simulate(C),v=document.getElementById('wif-v-'+k);if(v)v.textContent=sp.f(sim[k]);
  const sc=document.getElementById('wif-score'),df=document.getElementById('wif-diff'),tb=document.getElementById('wif-tbl'),mt=document.getElementById('wif-math');
  const a=C.score,b=S.score,d=a!=null&&b!=null?b-a:null;
  tween(sc,b);if(df){df.textContent=d==null?(b==null?'No score to simulate yet':'Your real score is not available yet, so there is no difference to show'):d===0?'No change (0 points)':sgn(d)+' point'+(Math.abs(d)===1?'':'s')+' in this simulation';df.className='wifdiff'+(d>0?' up':d<0?' dn':'')}
  if(tb)tb.innerHTML=table(C,S);if(mt)mt.innerHTML=math(S)};
acts.wifopen=()=>{const C=SC.compute();init(C);open=true;repaint();const b=document.getElementById('wif-body');if(b)b.scrollIntoView({block:'nearest',behavior:HWUI.reduced()?'auto':'smooth'})};
acts.wifclose=()=>{open=false;sim={};repaint();const b=document.querySelector('#wif .wifopen');if(b)b.focus({preventScroll:true})};
acts.wifreset=()=>{const C=SC.compute();init(C);repaint();toast('Back to your real values. Nothing was saved or changed.');const b=document.querySelector('#wif .wifreset');if(b)b.focus({preventScroll:true})};
acts.wifinc=d=>{const k=d.k;if(!SPEC[k]||!ok(k))return;sim[k]=SPEC[k].mid;repaint();const s=document.getElementById('wif-r-'+k);if(s)s.focus({preventScroll:true})};
acts.wifdrop=d=>{const k=d.k;if(!SPEC[k])return;if(!SC.compute().I[k]){delete sim[k];repaint()}};

function section(C){
  if(open&&base!==JSON.stringify(realVals(C)))init(C);
  return '<div class="card wif'+(open?' open':'')+'" id="wif">'+inner(C)+'</div>'}
// leaving the page drops the simulation; coming back starts closed
HWEvents.on('page:viewed',e=>{if(e.view!=='score'&&open){open=false;sim={}}});

HWUI.css('whatif',`
.wif{background:linear-gradient(var(--pn),var(--pn)),var(--pn);position:relative}
.wif.open{outline:2px solid var(--vio);outline-offset:-8px}
.wifhd{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.wifhd h3{margin:0;flex:1 1 auto;min-width:0;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px}
.wifrs{display:inline-flex;gap:6px;color:var(--vio);opacity:.75}.wifr{display:block}
.wifopen{width:100%;min-height:48px;margin:6px 0;background:var(--vio);color:#fff;font-size:12px;letter-spacing:.06em}
.wifsimtag{margin:8px 0;padding:6px 8px;border:3px solid var(--vio);background:var(--p2);font:9px/1.7 var(--fh);overflow-wrap:anywhere}
.wifscore{display:grid;grid-template-columns:1fr auto 1fr;gap:6px 10px;align-items:center;margin:8px 0;padding:10px;border:3px solid var(--ln);background:var(--p2)}
.wifscore b{display:block;font:var(--px-f3,24px)/1.2 var(--fh)}.wifscore small{display:block;font-size:11px}.wifsim small{color:var(--vio);font-weight:700}
.wifb{color:var(--ink)}.wifb.pulse{animation:wifp .45s steps(4)}@keyframes wifp{40%{text-shadow:0 0 8px var(--vio),0 0 2px var(--gold);transform:translateY(-2px)}}
.wifarrow{font:var(--px-f2,16px) var(--fh);color:var(--mut)}
.wifdiff{grid-column:1/-1;text-align:center;font:10px/1.7 var(--fh);padding:6px;border:3px solid var(--ln);background:var(--pn)}.wifdiff.up{border-color:var(--gold)}.wifdiff.dn{border-color:var(--blue)}
.wifnote{font-size:12px;color:var(--mut);margin:4px 0 8px}
.wifbtns{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px}.wifbtns button{flex:1 1 150px;min-height:44px}.wifreset{background:var(--gold);color:#2b2418}
.wifg{border:3px solid var(--ln);margin:0 0 12px;padding:8px 10px 10px;min-width:0;background:var(--pn)}.wifg legend{font:9px/1.6 var(--fh);padding:0 6px;color:var(--vio)}.wifw{font:11px var(--fb);color:var(--mut)}
.wifrow{margin:10px 0;border-top:2px dashed var(--p2);padding-top:8px}.wifrow:first-of-type{border-top:0;padding-top:0}
.wifh{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:14px}.wifreal{color:var(--mut);font-size:13px;overflow-wrap:anywhere}
.wifs{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wifs input[type=range]{flex:1 1 140px;min-width:0;height:44px;margin:0;background:transparent;accent-color:var(--vio);touch-action:pan-y}
.wifs input[type=range]::-webkit-slider-runnable-track{height:10px;background:var(--p2);border:3px solid var(--ln)}
.wifs input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:30px;margin-top:-13px;background:var(--vio);border:3px solid var(--ln);box-shadow:2px 2px 0 var(--ln)}
.wifs input[type=range]::-moz-range-track{height:10px;background:var(--p2);border:3px solid var(--ln)}
.wifs input[type=range]::-moz-range-thumb{width:18px;height:26px;border-radius:0;background:var(--vio);border:3px solid var(--ln)}
.wifs input[type=range]:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.wifv{flex:0 1 auto;font:700 14px var(--fb);font-variant-numeric:tabular-nums;min-width:8ch;overflow-wrap:anywhere}
.wifadd{min-height:44px}.wifx{font:9px var(--fh);min-height:32px;padding:2px 8px;margin-left:6px}
.wifwhy summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:13px;color:var(--vio)}.wifwhy p{margin:4px 0;font-size:13px;overflow-wrap:anywhere}
.wifsec{margin:12px 0}.wifsec h4{margin:0 0 6px;display:flex;align-items:center;gap:6px;font:10px/1.6 var(--fh)}
.wiftbl{min-width:460px}.wiftbl th{white-space:normal}.wiftbl td{overflow-wrap:normal}.wiftbl td:nth-child(2),.wiftbl td:nth-child(3){min-width:92px}
@media(max-width:420px){.wifscore{grid-template-columns:1fr 1fr}.wifarrow{display:none}}
@media(prefers-reduced-motion:reduce){.wifb.pulse{animation:none}}
html.hw-rm .wifb.pulse{animation:none}
`);
return{section,simulate,init,LABEL,get open(){return open},get sim(){return Object.assign({},sim)}}})();
