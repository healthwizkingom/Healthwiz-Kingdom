/* v6 (usability pass, item 4): the Settings log by date. Not part of the original.
   Settings → ALL ENTRIES used to list the last 60 entries, newest first. Now the same entries are grouped by day (newest day first),
   each day a collapsible row with the date, the number of entries and the day's totals. A row of date chips (the last 14 days that
   have entries) and a "Pick a date…" field show one day only, so yesterday's water entry is one tap away (Yesterday), and an older day
   is a date pick. The category filter still applies, to whichever day is shown. Each entry keeps its time and its edit and delete
   buttons (the shared row() from the original). Nothing is stored: the chosen day, the open rows and "show more" live in S (this tab).
   Old 'pulse' entries stay in the save and are still not listed; BPM logged in Heartstone Hall (m.when) is listed (js/v6-stairs.js). */
const HWLog=(()=>{
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const CATS=['all','food','water','sleep','stair','stress','bmi'],PAGE=30;
const dOf=s=>{const p=s.split('-');return new Date(+p[0],+p[1]-1,+p[2],12)};
const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return ymd(d)};
function lab(d,short){if(d===today())return 'Today';if(d===back(1))return 'Yesterday';const w=dOf(d);return WD[w.getDay()]+' '+w.getDate()+' '+MO[w.getMonth()]+(w.getFullYear()!==new Date().getFullYear()?' '+w.getFullYear():'')}
const fmt=n=>(Math.round(n*10)/10).toLocaleString('en');
// one short line per day: totals by kind (calories and mL are sums of what you logged; stress is the average of your own ratings)
function totals(a){const s=c=>a.filter(e=>e.c===c),sm=c=>s(c).reduce((x,e)=>x+(+e.v||0),0),o=[];
  if(s('food').length)o.push(fmt(sm('food'))+' kcal');if(s('water').length)o.push(fmt(sm('water'))+' mL');if(s('stair').length)o.push(fmt(sm('stair'))+' steps');
  if(s('sleep').length)o.push(fmt(sm('sleep'))+' h sleep');if(s('stress').length)o.push('stress avg '+fmt(sm('stress')/s('stress').length)+'/10');if(s('bmi').length)o.push('BMI '+fmt(s('bmi').slice(-1)[0].v));return o.join(' · ')}
const shown=()=>ALL().filter(e=>(e.c!=='pulse'||(e.m&&(e.m.when==='before'||e.m.when==='after')))&&(S.fc==='all'||e.c===S.fc)); // old pulse entries stay unlisted; logged BPM (m.when) is listed
function groups(a){const m=new Map();a.forEach(e=>{if(!m.has(e.d))m.set(e.d,[]);m.get(e.d).push(e)});
  return [...m.keys()].sort().reverse().map(d=>({d,a:m.get(d).sort((x,y)=>y.t.localeCompare(x.t))}))}
function chips(G){const T=today(),have=new Map(G.map(g=>[g.d,g.a.length])),R=Array.from({length:14},(_,i)=>back(i)).filter(d=>have.has(d)),sel=S.ld||null;
  const chip=(d,t,on)=>'<button type="button" class="chip lgc'+(on?' on':'')+'" data-a="lgday" data-d="'+(d||'')+'" aria-pressed="'+(on?'true':'false')+'">'+t+'</button>';
  const extra=sel&&R.indexOf(sel)<0?[sel]:[];
  return '<div class="lgchips" role="group" aria-label="Show one day">'+chip('','All days',!sel)+R.concat(extra).map(d=>chip(d,lab(d)+' <small>'+(have.get(d)||0)+'</small>',d===sel)).join('')+'</div>'}
function day(g,open){const t=totals(g.a);
  return '<details class="lgd" data-d="'+g.d+'"'+(open?' open':'')+'><summary><b>'+lab(g.d)+'</b><span>'+g.a.length+(g.a.length===1?' entry':' entries')+(t?' · '+t:'')+'</span></summary>'+g.a.map(e=>row(e)).join('')+'</details>'}
function card(){S.lo=S.lo||{};const all=shown(),G=groups(all),sel=S.ld||null;
  let body;
  if(sel){const g=G.find(x=>x.d===sel);body=g?day(g,true):emp('🌱 NOTHING ON THIS DAY','No '+(S.fc==='all'?'entries':S.fc+' entries')+' on '+lab(sel)+'. Pick another day, or choose All days.')}
  else if(!G.length)body=emp('🌱 NO DEEDS RECORDED','Your chronicle fills as you log.');
  else{const n=S.lm||PAGE,list=G.slice(0,n);body=list.map(g=>day(g,S.lo[g.d]!=null?S.lo[g.d]:g.d===today())).join('')+(G.length>n?'<button class="g" data-a="lgmore" style="width:100%;margin-top:8px">SHOW OLDER DAYS ('+(G.length-n)+' more)</button>':'')}
  return '<div class="card" id="v6log"><h3>ALL ENTRIES</h3><div class="lgtools"><label>Category<select data-ch="fc">'+CATS.map(c=>'<option'+(S.fc===c?' selected':'')+'>'+c+'</option>').join('')+'</select></label>'
    +'<label>Pick a date…<input type="date" data-ch="lgpick" max="'+today()+'" value="'+(sel||'')+'" aria-label="Pick a date to show"></label></div>'+chips(G)+'<div class="lgbody">'+body+'</div></div>'}
acts.lgday=d=>{S.ld=d.d||null;render()};
acts.lgmore=()=>{S.lm=(S.lm||PAGE)+PAGE;render()};
CH.lgpick=v=>{S.ld=/^\d{4}-\d{2}-\d{2}$/.test(v)&&v<=today()?v:null;render()};
// remember which days the user opened or closed, across the re-render that follows an edit or a delete
document.addEventListener('toggle',e=>{const t=e.target;if(t&&t.classList&&t.classList.contains('lgd')&&S.lo)S.lo[t.dataset.d]=t.open},true);
HWUI.css('log',`
.lgtools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:8px}
.lgchips{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px;margin:0 -2px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.lgchips .chip{flex:0 0 auto;min-height:44px;padding:6px 12px;scroll-snap-align:start;white-space:nowrap}.lgchips small{opacity:.8}
.lgd{border-top:2px dashed var(--ln);padding:2px 0}.lgd>summary{display:flex;flex-direction:column;gap:2px;min-height:44px;justify-content:center;cursor:pointer;padding:6px 2px}
.lgd>summary b{font:10px/1.6 var(--fh)}.lgd>summary span{font-size:13px;color:var(--mut);overflow-wrap:anywhere}
.lgbody .empty{margin-top:6px}
`);
return{card,groups,totals}})();
