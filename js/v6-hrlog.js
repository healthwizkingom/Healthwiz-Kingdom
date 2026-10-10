/* v6 (heart-rate log): the newest counted heart rate. Not part of the original.
   Heart rate is counted from two places: BPM logged in Heartstone Hall ('pulse' entries with m.when 'before' | 'after',
   js/v6-stairs.js) and workouts that carry a before / after heart rate. hrv / hrS / hrL in js/hw-02-core.js count them
   (a log that a sealed workout used has m.sess and is skipped, so nothing is counted twice); this adds hrLast() for the
   hub tile, the kingdom panel and the Stairs page. Never invents a number: no logs and no workouts give null. */
/** The newest counted heart rate: {b, a, r1, d, t, s:'workout'|'log'} (BPM or null) from a workout, or from the latest day of logged BPM; null when there is none. */
function hrLast(){const C=[];
  LC('stair').filter(e=>e.m&&(+e.m.hrB||+e.m.hrA)).forEach(e=>C.push({d:e.d,t:e.t||'00:00',b:+e.m.hrB||null,a:+e.m.hrA||null,r1:+e.m.hrR1||null,s:'workout'}));
  const days={};LC('pulse').filter(e=>e.m&&(e.m.when==='before'||e.m.when==='after')&&!e.m.sess&&+e.v>=30&&+e.v<=220).forEach(e=>{const o=days[e.d]||(days[e.d]={d:e.d,t:'00:00',b:null,a:null,r1:null,s:'log'});if(e.t>=o.t)o.t=e.t;o[e.m.when==='before'?'b':'a']=+e.v});
  Object.keys(days).forEach(k=>C.push(days[k]));
  C.sort((x,y)=>(x.d+x.t<y.d+y.t?-1:x.d+x.t>y.d+y.t?1:0));return C.length?C[C.length-1]:null}
