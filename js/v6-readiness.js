/* v6: Readiness Index, adjustments from your own history. Not part of the original.
   The Oracle on Home (js/v6-arcana.js, math.readiness) already scores sleep 40 %, DASS-21 30 %, 1-minute heart-rate drop 30 %. This file
   leaves that formula untouched and adds up to three SMALL, CAPPED adjustments when their data exist. With none of them logged
   the Oracle's score and wording are exactly as before (apply() returns null).

   The three adjustments (HealthWiz's own choices: no published formula or source gives these weights, and the card says so)
     Resting pulse    pulse typed before a workout (rest(d), newest within 3 days) against YOUR average of the 14 days before it
                      (at least 3 earlier days): −1 point per BPM above your average, at most −10. Below your average: no change.
     Deep-sleep est.  share of last night's tracked time the phone estimated as Abyssal Slumber (js/v6-trance.js, letter 'A') against YOUR
                      average of up to 30 earlier Sleep Now nights (at least 5): 1 point per 2 percentage points, from −5 to +5.
                      A phone-motion estimate, never measured deep sleep or an N3 stage.
     Yesterday's work work against gravity saved on Stair Sense climbs (m.gv.W, J) against YOUR average of the days with climbs in the
                      14 days before (at least 3): more than 1.5 times that average = −5, otherwise no change.
   Total range −20 to +5, then the score is held between 0 and 100. Each used input shows its numbers and its points; an input that is
   missing is left out (never filled in). The pacing line (Light / Moderate / Full) reuses the Oracle's own bands (under 50, 50 to 69, 70+).
   Not a medical measure, not advice; the index is a game value (docs/DISCLAIMERS.md). Pure functions first so the tests check worked
   examples; the readers only read the save. */
const HWReadiness=(()=>{
const CAP={rhr:10,deep:5,work:5},clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const N=(x,d)=>(+x).toLocaleString('en',{maximumFractionDigits:d||0});
/* ---------- pure ---------- */
/** v = resting pulse now, base = your average (BPM): 0 to −10 (one point per BPM above), null when either is missing. */
const rhrAdj=(v,base)=>v==null||base==null?null:0-clamp(Math.round(v-base),0,CAP.rhr);
/** share, avg = Abyssal Slumber % of tracked time, last night and your average: one point per 2 points, −5 to +5. */
const deepAdj=(share,avg)=>share==null||avg==null?null:clamp(Math.round((share-avg)/2),-CAP.deep,CAP.deep);
/** y = yesterday's work (J), avg = your average over days with climbs: −5 when y is more than 1.5 × avg, else 0. null without both. */
const workAdj=(y,avg)=>!(y>0)||!(avg>0)?null:y>1.5*avg?-CAP.work:0;
const band=s=>s>=70?'Full pace':s>=50?'Moderate pace':'Light pace';
/** base = the Oracle's score (0–100); I = {rhr:{v,base,n}, deep:{share,avg,n}, work:{y,avg,n}} (any may be null). null when no input is usable. */
function apply(base,I){I=I||{};const rows=[];
  const a1=I.rhr?rhrAdj(I.rhr.v,I.rhr.base):null,a2=I.deep?deepAdj(I.deep.share,I.deep.avg):null,a3=I.work?workAdj(I.work.y,I.work.avg):null;
  if(a1!=null)rows.push({k:'rhr',adj:a1,t:'Resting pulse '+N(I.rhr.v)+' BPM against your average of '+N(I.rhr.base,1)+' BPM ('+I.rhr.n+' earlier days)'});
  if(a2!=null)rows.push({k:'deep',adj:a2,t:'Abyssal Slumber estimate '+N(I.deep.share,1)+' % against your average of '+N(I.deep.avg,1)+' % ('+I.deep.n+' earlier nights), a phone-motion estimate'});
  if(a3!=null)rows.push({k:'work',adj:a3,t:'Yesterday’s climbing work '+N(I.work.y)+' J against your average of '+N(I.work.avg)+' J ('+I.work.n+' earlier days with climbs)'});
  if(!rows.length)return null;
  const total=rows.reduce((s,r)=>s+r.adj,0),score=clamp(base+total,0,100);
  return{score,total,rows,pace:band(Math.round(score))}}
/* ---------- readers (the save is only read) ---------- */
const day=n=>ymd(new Date(Date.now()-n*864e5)),avgOf=a=>a.reduce((s,x)=>s+x,0)/a.length;
function rhrIn(){for(let n=0;n<3;n++){const v=rest(day(n));if(v!=null){const b=[];for(let k=n+1;k<=n+14;k++){const r=rest(day(k));if(r!=null)b.push(r)}
  return b.length>=3?{v,base:avgOf(b),n:b.length}:null}}return null}
function deepIn(){if(typeof HWTrance==='undefined')return null;const d0=day(2);
  const L=LC('sleep').filter(x=>x.m&&x.m.tr&&x.m.tr.v===1&&typeof x.m.tr.e==='string').map(x=>({d:x.d,p:HWTrance.pct(x.m.tr.e,+x.m.tr.o)})).filter(x=>x.p);
  const last=L.length?L[L.length-1]:null;if(!last||last.d<d0)return null;
  const h=L.slice(0,-1).slice(-30).map(x=>x.p.A);return h.length>=5?{share:last.p.A,avg:avgOf(h),n:h.length}:null}
function workOn(d){return LC('stair').filter(e=>e.d===d).reduce((s,e)=>{const w=e.m&&e.m.gv?+e.m.gv.W:0;return s+(isFinite(w)&&w>0?w:0)},0)}
function workIn(){const y=workOn(day(1));if(!(y>0))return null;const h=[];for(let k=2;k<=15;k++){const w=workOn(day(k));if(w>0)h.push(w)}
  return h.length>=3?{y,avg:avgOf(h),n:h.length}:null}
/** Adjust the Oracle's score from the save. html = the rows for the "How the Oracle reads you" panel; null when no input applies. */
function adjust(base){const X=apply(base,{rhr:rhrIn(),deep:deepIn(),work:workIn()});if(!X)return null;
  X.html='<p><b>Your own history adjusts the index</b> (HealthWiz’s choice of small capped steps, not a published formula):</p><ul class="arc-orl">'
    +X.rows.map(r=>'<li>'+esc(r.t)+' → <b>'+(r.adj>0?'+':r.adj<0?'−':'')+Math.abs(r.adj)+'</b></li>').join('')+'</ul>'
    +'<p>Pacing suggestion: <b>'+X.pace+'</b>. Total adjustment '+(X.total>0?'+':X.total<0?'−':'')+Math.abs(X.total)+' (range −20 to +5). A game index from your own logs, not a medical measure or advice.</p>';
  return X}
return{apply,adjust,rhrAdj,deepAdj,workAdj,band,CAP}})();
