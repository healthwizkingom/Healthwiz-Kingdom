/* v6: the Group 14 F21 stair study, as measured. Not part of the original.
   Source: "HealthWiz Kingdom: Group 14 F21 Full Written Report" (version of 2026-10-10, supplied by the owner; HWSources 'f21').
   Only the raw measurements are stored here, copied from the report: the pulse counts of every 30-second interval (Appendix A,
   corrected values per Appendix C), the resting pulse before each climb (Table 10), height and weight (Table 3). Everything
   else is worked out below with the report's own methods (Section 3.1), so tests/61-f21.test.mjs can recompute the report's
   Tables 7, 8, 9 and 11 and show they agree.
   Participants are P1–P6 in the order of the report's Table 7 (six male students aged 18); the app shows no names.
   Intensities: 0 mild = Staircase B (Block Kenanga, ST14, 26.43°), 1 moderate = C (Block Aisyah, ST19, 27.23°),
   2 vigorous = A (Generator, ST20, 28.52°); the stair geometry itself is HWStairs.STUDY (js/v6-stairs.js, report Table 2).
   These are real measurements from a small classroom study, not clinical data: label them as such wherever they appear. */
const HWF21=(()=>{
// counts[p][intensity][trial] = six pulse counts, one per 30 s, taken after a 30 s rest (3 minutes of counting)
const COUNTS=[
  // P1
  [[[56,50,45,42,53,35],[54,52,46,40,55,33],[58,48,44,44,51,34]],[[54,62,37,43,47,47],[52,64,35,41,49,48],[56,60,39,45,45,46]],[[60,52,48,49,42,46],[58,54,46,51,40,49],[62,50,50,47,44,45]]],
  // P2
  [[[48,45,40,38,39,35],[50,44,42,37,40,35],[47,46,39,38,38,35]],[[58,62,48,50,52,48],[56,60,46,49,51,50],[57,61,47,48,53,49]],[[64,58,54,56,54,52],[62,60,52,55,53,53],[65,57,55,54,55,53]]],
  // P3
  [[[32,35,33,34,33,35],[34,36,35,34,36,35],[32,33,32,34,34,33]],[[35,36,37,38,38,39],[37,38,38,39,39,39],[36,37,38,38,38,38]],[[39,40,41,42,42,42],[40,41,42,43,43,43],[39,40,41,41,41,41]]],
  // P4
  [[[33,31,30,29,28,28],[35,33,32,31,30,27],[34,32,31,30,29,29]],[[36,34,33,31,29,28],[37,35,34,32,30,28],[40,37,36,34,32,32]],[[41,38,36,35,33,31],[40,39,38,36,35,34],[43,40,39,37,35,33]]],
  // P5
  [[[46,47,44,46,36,50],[52,49,47,45,43,39],[50,47,45,43,41,37]],[[53,52,48,46,42,48],[55,52,50,48,46,44],[53,50,48,46,44,41]],[[62,56,56,54,49,46],[63,58,52,49,46,39],[60,55,50,47,44,34]]],
  // P6
  [[[35,33,32,31,29,27],[34,32,31,30,28,26],[36,34,33,31,30,29]],[[38,35,34,32,30,29],[39,36,35,33,32,30],[38,36,35,33,32,29]],[[42,39,38,36,35,32],[43,40,39,37,36,35],[41,39,37,36,34,32]]]];
// height (m), weight (kg) from Table 3; resting pulse (BPM) before the mild, moderate and vigorous climb from Table 10
const P=[{id:'P1',h:1.56,w:40.3,rest:[71,74,73]},{id:'P2',h:1.69,w:63.2,rest:[75,70,77]},{id:'P3',h:1.69,w:79,rest:[79,84,72]},
  {id:'P4',h:1.68,w:58,rest:[72,78,71]},{id:'P5',h:1.73,w:75,rest:[72,79,74]},{id:'P6',h:1.64,w:52,rest:[70,72,71]}];
const INT=['Mild','Moderate','Vigorous'],STAIR=['B','C','A'],MIN=3,KJ_L=20.1,KCAL=4.184;
const sum=a=>a.reduce((s,x)=>s+x,0),mean=a=>sum(a)/a.length;
const totals=(p,i)=>COUNTS[p][i].map(sum);
/** Average pulse beat of the three 3-minute trials and pulse rate (BPM) = average × 60 ÷ 180 (report Section 3.1, step 9). */
const avgBeat=(p,i)=>mean(totals(p,i)),pr=(p,i)=>avgBeat(p,i)*60/180;
/** The pulse as a periodic motion: f = PR ÷ 60 (Hz), T = 1 ÷ f (s), ω = 2πf (rad/s) (step 10). */
const shm=(p,i)=>{const f=pr(p,i)/60;return{f,T:1/f,w:2*Math.PI*f}};
/** BPM in one 30-second interval k (0 = first), the mean of the three trials × 2 (Table 8). */
const interval=(p,i,k)=>mean(COUNTS[p][i].map(t=>t[k]))*2;
const bmi=p=>P[p].w/(P[p].h*P[p].h);
/** The project's VO₂ estimate (steps 11–12, Thermochemistry 2): VO₂ = 15.3 × PRmax ÷ PRrest (mL/kg/min); L/min = × kg ÷ 1000;
    energy (kJ) = L/min × 3 min × 20.1 kJ/L; kcal = kJ ÷ 4.184. pmax 'avg' uses the 3-minute average (Table 9), 'first' the first
    30-second count × 2 (Table 11). valid is false when PRmax ÷ PRrest is below 1: the report says such a value cannot be a
    maximum and should not be interpreted. */
function vo2(p,i,pmax,kjL){const max=pmax==='first'?interval(p,i,0):pr(p,i),rest=P[p].rest[i],ratio=max/rest,ml=15.3*ratio,lmin=ml*P[p].w/1000,kj=lmin*MIN*(kjL||KJ_L);
  return{max,rest,ratio,ml,lmin,kj,kcal:kj/KCAL,valid:ratio>=1}}
/** One row per participant and intensity, everything worked out (for tables, charts, the Lab and the Trial). */
function rows(){const out=[];P.forEach((x,p)=>INT.forEach((n,i)=>{const s=shm(p,i),v=vo2(p,i);
  out.push({p:x.id,pi:p,i,int:n,stair:STAIR[i],avg:avgBeat(p,i),pr:pr(p,i),f:s.f,T:s.T,w:s.w,rest:x.rest[i],ratio:v.ratio,vo2:v.ml,lmin:v.lmin,kj:v.kj,kcal:v.kcal,valid:v.valid,bmi:bmi(p),kg:x.w})}));return out}
/** Facts the report states, checked from the data (never typed in): used by the Trial and the Lab with their reason. */
function facts(){const R=rows(),by=p=>R.filter(r=>r.pi===p);
  const prRises=P.map((x,p)=>{const r=by(p);return r[0].pr<r[1].pr&&r[1].pr<r[2].pr});
  const rise=P.map((x,p)=>{const r=by(p);return(r[2].pr/r[0].pr-1)*100});
  const kjTop=P.map((x,p)=>{const r=by(p);return r.reduce((b,q)=>q.kj>b.kj?q:b).int});
  const recov=P.map((x,p)=>interval(p,2,5)-interval(p,2,0));
  return{prRisesAll:prRises.every(Boolean),riseMin:Math.min(...rise),riseMax:Math.max(...rise),rise,
    invalid:R.filter(r=>!r.valid).length,n:R.length,kjTop,vigorousTop:kjTop.filter(t=>t==='Vigorous').length,recov,recovFell:recov.filter(d=>d<0).length,
    restSpread:P.map(x=>Math.max(...x.rest)-Math.min(...x.rest))}}
return{COUNTS,P,INT,STAIR,totals,avgBeat,pr,shm,interval,bmi,vo2,rows,facts,MIN,KJ_L}})();
