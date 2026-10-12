/* v6: the Healer's What-if ("WHAT IF?") on the Health Score page: a calm, restorative way to try a gentle change. Not part of the original.
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
const LABEL='SIMULATION — YOUR REAL HEALTH LOG IS UNCHANGED.';
function help(){return HWHelp.btn('whatif','What-if simulator','<p><b>'+LABEL+'</b></p><p>The sliders only change numbers inside this panel. Nothing is saved, no log entry is added, and no achievement, XP or leaderboard changes.</p><p>The simulated score uses the same formula and the same weights as your real Health Score. A simulated score only shows how the arithmetic would change. It does not predict that your real health, or your real score, would change by that amount.</p><p>The Health Score is a habit summary, not a medical diagnosis or a validated clinical risk score.</p>',{label:'About the what-if simulator'})}
function slider(k,C){
  const sp=SPEC[k],r=C.I[k],on=sim[k]!=null,v=on?sim[k]:sp.mid;
  const mx=Math.max(sp.max,Math.ceil(v)),mn=Math.min(sp.min,Math.floor(v));
  const row='<div class="wifrow" data-k="'+k+'"><div class="wifh"><label for="wif-r-'+k+'"><b>'+SC.LBL[k]+'</b></label><span class="wifreal">Real: '+(r?esc(r.txt):'<i>not logged</i>')+'</span></div>';
  if(!ok(k))return row+'<small class="mut">Needs a calorie target. Set one in Body &amp; Energy.</small></div>';
  if(!r&&!on)return row+'<button type="button" class="g sm wifadd" data-a="wifinc" data-k="'+k+'" aria-label="Add '+esc(SC.LBL[k])+' to the simulation">ADD TO SIMULATION</button><small class="mut">Not logged, so it is left out of your real score. Adding it here changes the weights of the others.</small></div>';
  return row+'<div class="wifs"><input type="range" id="wif-r-'+k+'" data-in="wif" data-k="'+k+'" min="'+mn+'" max="'+mx+'" step="'+sp.step+'" value="'+v+'" style="--f:'+((v-mn)/((mx-mn)||1)*100).toFixed(1)+'%" aria-describedby="wif-v-'+k+'">'
    +'<output id="wif-v-'+k+'" class="wifv" for="wif-r-'+k+'">'+esc(sp.f(v))+'</output></div>'
    +(r?'':'<small class="mut">Starting point to explore from, not your data. <button type="button" class="wifx" data-a="wifdrop" data-k="'+k+'">REMOVE</button></small>')+'</div>'}
const AC={nutrition:'#5cc05a',activity:'#ff9b3d',hr:'#ff6b5e',sleep:'#9d7bff',bmi:'#4db3ff',stress:'#46d1c5'};   // each area has its own light
const AI={nutrition:'food',activity:'stairs',hr:'heart',sleep:'sleep',bmi:'balance',stress:'mind'};   // a pixel icon for each area
function groups(C){
  return SC.GROUP.map(g=>{const w=g[2].reduce((s,k)=>s+SC.WT[k],0);
    return '<fieldset class="wifg" style="--a:'+(AC[g[0]]||'#f2c14e')+'"><legend><span class="wifmed">'+HWPixel.icon(AI[g[0]]||'heart',1)+'</span> '+esc(g[1].replace(/^\S+\s/,''))+' <span class="wifw">weight '+w+' of 100</span></legend>'
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
// the score block is drawn like the head of the Health Score card (big band-coloured number, / 100, band name, areas logged, bar), twice:
// the real score, and the simulated one with a dashed frame and a SIMULATION tag so the two cannot be confused
const diffTxt=(a,b)=>{const d=a!=null&&b!=null?b-a:null;return d==null?(b==null?'No score to simulate yet':'Your real score is not available yet, so there is no difference to show'):d===0?'No change (0 points)':sgn(d)+' point'+(Math.abs(d)===1?'':'s')+' in this simulation'};
const blk=(s,cov)=>{const bd=s==null?null:SC.band(s);
  return {num:s==null?'\u2013':s,col:bd?bd[1]:'#8a93b5',band:bd?bd[0]:'No data',cov:cov+' of '+SC.GROUP.length+' areas logged',fill:s==null?0:Math.max(0,Math.min(100,s))}};
// each score is a glass orb filled to its level, in its band's colour (the numbers are the same as the Health Score card's)
function out(C,S){
  const R=blk(C.score,C.covered),M=blk(S.score,S.covered),d=C.score!=null&&S.score!=null?S.score-C.score:null;
  const orb=(cls,tag,x,ids)=>'<div class="wiford '+cls+'" style="--c:'+x.col+'"'+(ids?' id="wif-orb"':'')+'><span class="pxtag">'+tag+'</span>'
    +'<div class="wifwrap">'+(ids?'<i class="wifring" aria-hidden="true"></i>':'')+'<div class="wifglass"><div class="wifin"><i class="wiffill"'+(ids?' id="wif-fill"':'')+' style="height:'+x.fill+'%"></i>'
    +'<b class="v6scn '+(ids?'wifb':'wifa')+'"'+(ids?' id="wif-score" data-v="'+(S.score==null?'':S.score)+'"':'')+'>'+x.num+'</b></div></div></div>'
    +'<div class="wiflab"><b'+(ids?' id="wif-band"':'')+' style="color:'+x.col+'">'+x.band+'</b> <span class="v6scd">/ 100</span><small'+(ids?' id="wif-cov"':'')+'>'+x.cov+'</small></div></div>';
  return '<div class="wifscore">'+orb('real','YOUR REAL SCORE',R,0)+'<span class="wifarrow" aria-hidden="true">'+HWPixel.icon('star',2)+'</span>'+orb('sim','SIMULATION',M,1)
    +'<div class="wifdiff'+(d>0?' up':d<0?' dn':'')+'" id="wif-diff" role="status">'+esc(diffTxt(C.score,S.score))+'</div></div>'
    +'<p class="wifnote" id="wif-note">If these numbers changed, the arithmetic of the score would change like this. It does not predict that your real health would change.</p>'}
const MOTES=[[8,22,0],[22,70,1],[38,14,2],[55,60,0],[70,28,1],[84,66,2],[92,18,0],[46,84,1]];
// the healer mage: a pixel sprite inside a slowly turning rune frame, under a night sky of twinkling motes
function hero(){
  return '<div class="wifhero"><div class="wifsky" aria-hidden="true">'+MOTES.map(m=>'<i class="wifmote m'+m[2]+'" style="left:'+m[0]+'%;top:'+m[1]+'%"></i>').join('')+'</div>'
    +'<div class="wifmage" aria-hidden="true"><i class="wifring"></i><span class="wifsp">'+HWPixel.icon('wizard',4)+'</span><span class="wifheart">'+HWPixel.icon('heart',2)+'</span></div>'
    +'<div class="wiftx"><h3>THE HEALER MAGE\u2019S WHAT-IF '+help()+'</h3><p>'+(open?'Try one gentle change at a time and watch the light of your score respond.':'The healer mage weighs your habits and shows how the score would respond to a gentle change.')+'</p></div></div>'}
function inner(C){
  const S=simulate(C),win=SC.K.win()==='week'?'your 7-day averages':'today\u2019s values';
  if(!open)return hero()+'<div class="wifbody"><p class="mut">Nothing you do here is saved. It is a way to see how the weighted Health Score would respond.</p>'
    +'<button type="button" class="wifopen" data-a="wifopen" aria-expanded="false" aria-controls="wif-body">'+HWPixel.icon('star',1)+' WHAT IF? '+HWPixel.icon('star',1)+'</button><p class="wifsimtag pxtag" role="note">'+LABEL+'</p></div>';
  return hero()+'<div class="wifbody"><p class="wifsimtag pxtag" role="note">'+LABEL+'</p>'
    +'<div id="wif-body"><p class="mut">Starting from '+win+'.</p>'
    +'<div id="wif-out" aria-live="polite">'+out(C,S)+'</div>'
    +'<div class="wifbtns"><button type="button" class="wifreset" data-a="wifreset">RESET TO MY REAL VALUES</button><button type="button" class="g" data-a="wifclose">CLOSE</button></div>'
    +groups(C)
    +'<div class="wifsec"><h4>'+ico('chart')+' HOW EACH INDICATOR CONTRIBUTES</h4><div id="wif-tbl">'+table(C,S)+'</div>'
    +'<small class="mut">Points are each indicator\u2019s share of the score (weight \u00d7 sub-score \u00f7 total weight). Removing or adding an indicator changes the total weight, so every share moves.</small></div>'
    +'<div class="wifsec"><h4>'+ico('scroll')+' THE ARITHMETIC</h4><p id="wif-math">'+math(S)+'</p>'
    +'<small class="mut">Same formula and weights as your real Health Score. A habit summary, not a medical diagnosis or a validated clinical risk score.</small></div></div></div>'}

/* ---------- paint ---------- */
let rafId=0,shown=null,lastD=null;
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
  const M=blk(S.score,S.covered),d=C.score!=null&&S.score!=null?S.score-C.score:null;
  tween(sc,S.score);
  const bn=document.getElementById('wif-band'),cv=document.getElementById('wif-cov'),fl=document.getElementById('wif-fill'),ob=document.getElementById('wif-orb');
  if(bn){bn.textContent=M.band;bn.style.color=M.col}if(cv)cv.textContent=M.cov;if(fl)fl.style.height=M.fill+'%';
  if(ob){ob.style.setProperty('--c',M.col);if(d!=null&&d!==lastD&&!HWUI.reduced()){ob.classList.remove('flash');void ob.offsetWidth;ob.classList.add('flash')}lastD=d}
  el.style.setProperty('--f',((+el.value-+el.min)/((+el.max-+el.min)||1)*100).toFixed(1)+'%');
  if(df){df.textContent=diffTxt(C.score,S.score);df.className='wifdiff'+(d>0?' up':d<0?' dn':'')}
  if(tb)tb.innerHTML=table(C,S);if(mt)mt.innerHTML=math(S)};
acts.wifopen=()=>{const C=SC.compute();init(C);open=true;repaint();const b=document.getElementById('wif-body');if(b)b.scrollIntoView({block:'nearest',behavior:HWUI.reduced()?'auto':'smooth'})};
acts.wifclose=()=>{open=false;sim={};repaint();const b=document.querySelector('#wif .wifopen');if(b)b.focus({preventScroll:true})};
acts.wifreset=()=>{const C=SC.compute();init(C);repaint();toast('Back to your real values. Nothing was saved or changed.');const b=document.querySelector('#wif .wifreset');if(b)b.focus({preventScroll:true})};
acts.wifinc=d=>{const k=d.k;if(!SPEC[k]||!ok(k))return;sim[k]=SPEC[k].mid;repaint();const s=document.getElementById('wif-r-'+k);if(s)s.focus({preventScroll:true})};
acts.wifdrop=d=>{const k=d.k;if(!SPEC[k])return;if(!SC.compute().I[k]){delete sim[k];repaint()}};

function section(C){
  if(open&&base!==JSON.stringify(realVals(C)))init(C);
  return '<div class="card pxdk wif'+(open?' open':'')+'" id="wif">'+inner(C)+'</div>'}
// leaving the page drops the simulation; coming back starts closed
HWEvents.on('page:viewed',e=>{if(e.view!=='score'&&open){open=false;sim={}}});

const HEARTURI='data:image/svg+xml,'+encodeURIComponent(HWPixel.icon('heart',2).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));   // the slider thumb is the pixel heart icon
HWUI.css('whatif',`
/* the card is a night-blue HUD (.pxdk re-points the theme tokens), so everything inside follows it */
.wif.pxdk{background:#0b1236;border-color:#06090d;color:#f6edcf;padding:0;overflow:hidden}
.wif button{background:#f2c14e;color:#2b2418}.wif .hwh{color:#2b2418!important}.wif .hwh:not(.hwhl):before{background:#f2c14e!important;border-color:#fff6c0!important}.wif button.g{background:#22306b;color:#f6edcf;border-color:#06090d}
.wifhero{position:relative;display:flex;align-items:center;gap:14px;padding:14px 12px;background:#14204f;border-bottom:4px solid #06090d;overflow:hidden}
.wifhero:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#0b1236 0 34%,#122a52 34% 52%,#17406a 52% 66%,#1d5a78 66% 78%,#14204f 78%);opacity:.9}
.wifsky{position:absolute;inset:0;pointer-events:none}.wifmote{position:absolute;width:4px;height:4px;background:#fff6c0;box-shadow:0 0 6px #fff6c0}.wifmote.m1{background:#8fe9c8;box-shadow:0 0 6px #8fe9c8}.wifmote.m2{background:#c9b3ff;box-shadow:0 0 6px #c9b3ff}
.wifmage{position:relative;flex:0 0 96px;height:96px;display:grid;place-items:center}
.wifmage .wifring{position:absolute;inset:0;border:0}
.wifring:before,.wifring:after{content:'';position:absolute;inset:0;border:3px dashed var(--c,#8fe9c8)}.wifring:after{transform:rotate(45deg) scale(.72)}
.wifsp{position:relative;display:block;filter:drop-shadow(0 0 8px #8fe9c8)}.wifsp svg{display:block}
.wifheart{position:absolute;right:-2px;bottom:4px}.wifheart svg{display:block;filter:drop-shadow(0 0 5px #ff6b5e)}
.wiftx{position:relative;min-width:0;flex:1 1 auto}.wiftx h3{margin:0 0 6px;font-size:11px;line-height:1.7;color:#fff6c0;text-shadow:2px 2px 0 #06090d;display:flex;flex-wrap:wrap;align-items:center;gap:6px}.wiftx p{margin:0;font-size:13px;color:#d6def0}
.wifbody{padding:12px}
.wifbody .mut,.wif .mut{color:#b9c3d6}
.wifopen{width:100%;min-height:52px;margin:8px 0;display:flex;align-items:center;justify-content:center;gap:10px;font-size:13px;letter-spacing:.08em;box-shadow:3px 3px 0 #06090d,0 0 14px rgba(242,193,78,.55)}
.wifsimtag{display:block;margin:6px 0 8px;padding:4px 6px;line-height:1.7;overflow-wrap:anywhere;white-space:normal;background:#22306b;color:#f6edcf;border-color:#8fe9c8}
.wifscore{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1.25fr);gap:6px 6px;align-items:center;margin:10px 0}
.wiford{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:0;text-align:center}.wiford .pxtag{background:#22306b;color:#f6edcf}.wiford.sim .pxtag{background:#f2c14e;color:#2b2418}
.wifwrap{position:relative;display:grid;place-items:center;padding:14px}
.wifglass{--s:84px;position:relative;width:var(--s);height:var(--s);background:#06090d;padding:4px;box-sizing:border-box;clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)}
.wiford.sim .wifglass{--s:112px;filter:drop-shadow(0 0 9px var(--c))}
.wifin{position:relative;width:100%;height:100%;background:#0b1236;overflow:hidden;clip-path:polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%);display:grid;place-items:center}
.wiffill{position:absolute;left:0;right:0;bottom:0;background:var(--c);transition:height .35s steps(7)}
.wiffill:before{content:'';position:absolute;left:0;right:0;top:-6px;height:6px;background:repeating-linear-gradient(90deg,var(--c) 0 6px,transparent 6px 12px)}
.wiffill:after{content:'';position:absolute;inset:0;background:repeating-linear-gradient(180deg,rgba(255,255,255,.18) 0 4px,transparent 4px 12px)}
.wiford.real .wiffill{opacity:.55}
.wifin .v6scn{position:relative;z-index:1;font-size:26px;color:#fff;text-shadow:2px 2px 0 #06090d,-1px -1px 0 #06090d}.wiford.sim .v6scn{font-size:36px}
.wiford .wifring{position:absolute;inset:0}.wiford .wifring:before,.wiford .wifring:after{border-color:var(--c);opacity:.7}
.wiflab{font-size:12px;line-height:1.4}.wiflab b{font:9px/1.6 var(--fh)}.wiflab .v6scd{opacity:.7}.wiflab small{display:block;color:#b9c3d6;font-size:11px}
.wifarrow svg{display:block;filter:drop-shadow(0 0 5px #f2c14e)}
.wiford.flash .wifglass{animation:wifflash .5s steps(5)}@keyframes wifflash{30%{filter:drop-shadow(0 0 22px var(--c)) brightness(1.4)}}
.wifdiff{grid-column:1/-1;text-align:center;font:9px/1.7 var(--fh);padding:7px;border:3px solid #06090d;background:#22306b;color:#f6edcf}.wifdiff.up{border-color:#5cc05a;color:#c8f5c4}.wifdiff.dn{border-color:#4db3ff;color:#cfe8ff}
.wifnote{font-size:12px;color:#b9c3d6;margin:4px 0 8px}
.wifbtns{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px}.wifbtns button{flex:1 1 150px;min-height:44px}
.wifg{border:3px solid var(--a);margin:0 0 14px;padding:8px 10px 10px;min-width:0;background:#0e1840;box-shadow:0 0 7px var(--a)}
.wifg legend{font:8px/1.6 var(--fh);padding:0 6px;display:inline-flex;align-items:center;gap:6px;color:#fff6c0}.wifw{font:11px var(--fb);color:#b9c3d6}
.wifmed{display:inline-grid;place-items:center;width:26px;height:26px;background:#06090d;border:2px solid var(--a)}.wifmed svg{display:block}
.wifrow{margin:10px 0;border-top:2px dashed #22306b;padding-top:8px}.wifrow:first-of-type{border-top:0;padding-top:0}
.wifh{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:14px}.wifreal{color:#b9c3d6;font-size:13px;overflow-wrap:anywhere}
.wifs{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.wifs input[type=range]{flex:1 1 140px;min-width:0;height:44px;margin:0;background:transparent;touch-action:pan-y;-webkit-appearance:none;appearance:none}
.wifs input[type=range]::-webkit-slider-runnable-track{height:10px;background:linear-gradient(90deg,var(--a) var(--f,50%),#050a22 var(--f,50%));border:3px solid #06090d}
.wifs input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;margin-top:-9px;background:url("${HEARTURI}") center/28px 28px no-repeat;border:0;filter:drop-shadow(0 0 5px #ff6b5e)}
.wifs input[type=range]::-moz-range-track{height:10px;background:linear-gradient(90deg,var(--a) var(--f,50%),#050a22 var(--f,50%));border:3px solid #06090d}
.wifs input[type=range]::-moz-range-thumb{width:28px;height:28px;border:0;border-radius:0;background:url("${HEARTURI}") center/28px 28px no-repeat}
.wifs input[type=range]:focus-visible{outline:3px solid #8fe9c8;outline-offset:2px}
.wifv{flex:0 1 auto;font:700 14px var(--fb);font-variant-numeric:tabular-nums;min-width:8ch;overflow-wrap:anywhere;color:var(--a)}
.wifadd{min-height:44px}.wifx{font:9px var(--fh);min-height:32px;padding:2px 8px;margin-left:6px}
.wifwhy summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:13px;color:#8fe9c8}.wifwhy p{margin:4px 0;font-size:13px;overflow-wrap:anywhere;color:#d6def0}
.wifsec{margin:14px 0;padding:8px 10px;background:#0e1840;border:3px solid #06090d}.wifsec h4{margin:0 0 6px;display:flex;align-items:center;gap:6px;font:9px/1.6 var(--fh);color:#fff6c0}
.wiftbl{min-width:460px}.wiftbl th{white-space:normal}.wiftbl td{overflow-wrap:normal}.wiftbl td:nth-child(2),.wiftbl td:nth-child(3){min-width:92px}
@media(max-width:420px){.wifhero{gap:8px}.wifmage{flex-basis:80px;height:80px}.wifmage .wifsp svg{width:48px;height:48px}.wifscore{grid-template-columns:minmax(0,1fr) minmax(0,1.2fr)}.wifarrow{display:none}.wiford.sim .wifglass{--s:104px}.wifglass{--s:76px}}
@media(prefers-reduced-motion:no-preference){
 html:not(.hw-rm) .wifmote{animation:wiftw 2.4s steps(2) infinite}html:not(.hw-rm) .wifmote.m1{animation-delay:.8s}html:not(.hw-rm) .wifmote.m2{animation-delay:1.6s}
 @keyframes wiftw{50%{opacity:.25;transform:scale(.6)}}
 html:not(.hw-rm) .wifring{animation:wifspin 36s steps(72) infinite}@keyframes wifspin{to{transform:rotate(360deg)}}
 html:not(.hw-rm) .wifsp{animation:wifbob 3s steps(3) infinite}@keyframes wifbob{50%{transform:translateY(-3px)}}
}
`);
return{section,simulate,init,LABEL,get open(){return open},get sim(){return Object.assign({},sim)}}})();
