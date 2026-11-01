/* v6: Nightly Alchemical Sync, a descriptive evening-and-night list on the Sleep page. Not part of the original.
   Feature 6 of the owner's catalog, in its honest form (docs/FEATURE_CONSULTS.md). The catalog asked for a "nutritional synergy score" and
   implied that evening nutrients change sleep. Nothing here supports that, so this is a TABLE of what was logged and what the phone saw,
   with no score, no ranking, no advice and no cause words. "Descriptive, not evidence of cause."
   Night: the latest sleep entry whose bedtime falls between 18:00 and 06:00 (a daytime nap is skipped). Its bedtime is the evening before
   when the time is 12:00 or later, else that morning. Food window: the 24 hours before bed.
   Caffeine: ONLY the `caf` (mg) saved on a food entry by Luke's lookup (js/v6-addfood.js). A food entry with no `caf` is NOT zero: it is
   "unknown", counted and named as such, and the amount left is then labelled "at least". The static menu's own table values are never used here.
   Left at bedtime: for each known amount, mg × 0.5^(hours ÷ half-life), at the two ends of the spread Blanchard and Sawers 1983 reported
   between healthy men (2.7 h and 9.9 h, source id 'blanchard83'), so the result is a RANGE, never one number. The simple model (one
   dose, whole amount absorbed, steady first-order elimination) is stated on the card. People differ: smoking, pregnancy, medicines, genes.
   The textbook "4 to 5 h typical, 2 to 9 h range" (Institute of Medicine 2001, 'iom2001') was supplied by the project owner and has not
   been read in the book, so it is shown as a marked context line only.
   Magnesium and tryptophan per meal: the amounts Luke saved (`mg`, `trp`), each row "not looked up" when missing. No total is ever shown.
   Sleep: bed time, minutes to fall asleep (when recorded; a 0 means "not recorded"), and, for a Sleep Now night, the Abyssal Slumber time
   (the game's phone-movement estimate, not a sleep-stage measurement). Shown only, never saved or scored: no state, no schema step.
   residual(), bedStamp() and gather() are pure so the tests can check worked examples. */
const HWNightSync=(()=>{
const H_LO=2.7,H_HI=9.9,WIN_H=24,MAXROWS=10,isN=x=>typeof x==='number'&&isFinite(x);
const two=n=>(n<10?'0':'')+n,hhmm=ms=>{const d=new Date(ms);return two(d.getHours())+':'+two(d.getMinutes())};
const f1=x=>(+x).toLocaleString('en',{maximumFractionDigits:1});
/** (date 'YYYY-MM-DD', time 'H:MM') → ms, or null when malformed. */
function stamp(d,t){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d==null?'':d)),h=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(t==null?'':t));
  if(!m||!h||+h[1]>23||+h[2]>59)return null;const x=new Date(+m[1],+m[2]-1,+m[3],+h[1],+h[2],0,0).getTime();return isFinite(x)?x:null}
/** The sleep entry's wake-day date and bed time 'HH:MM' → when bed was (ms): the evening before for 12:00 or later, else that morning. null when not a night bed (18:00–06:00) or malformed. */
function bedStamp(d,bed){const m=/^(\d{1,2}):(\d{2})$/.exec(String(bed==null?'':bed));if(!m)return null;const h=+m[1];if(h>23||+m[2]>59||!(h>=18||h<6))return null;
  const w=stamp(d,'0:00');if(w==null)return null;const dt=new Date(w);if(h>=12)dt.setDate(dt.getDate()-1);dt.setHours(h,+m[2],0,0);return dt.getTime()}
/** mg (number ≥ 0), hrs (≥ 0) → {lo, hi} mg left after that time at the 2.7 h and 9.9 h half-lives; null for bad input. */
function residual(mg,hrs){if(!isN(mg)||!isN(hrs)||mg<0||hrs<0)return null;return{lo:mg*Math.pow(.5,hrs/H_LO),hi:mg*Math.pow(.5,hrs/H_HI)}}
/** Food entries in the 24 h before `bedMs`, oldest first: [{ms, name, mg (Mg), trp, caf, ...}] with null for any amount not saved. */
function gather(list,bedMs){const out=[];(list||[]).forEach(e=>{if(!e||e.c!=='food'||!e.m||typeof e.m!=='object')return;const ms=stamp(e.d,e.t);
  if(ms==null||ms>=bedMs||bedMs-ms>WIN_H*36e5)return;const n=k=>isN(e.m[k])&&e.m[k]>=0?e.m[k]:null;
  out.push({ms,name:typeof e.m.name==='string'&&e.m.name?e.m.name:'Food',mg:n('mg'),trp:n('trp'),caf:n('caf')})});return out.sort((a,b)=>a.ms-b.ms)}
/** The whole night: {bed, items, known (with caf), unknown (count), lo, hi (mg left, from the known only), last} or null with no usable sleep entry. */
function night(list){const s=(list||[]).filter(e=>e&&e.c==='sleep'&&e.m&&typeof e.m==='object').map(e=>({e,b:bedStamp(e.d,e.m.bed)})).filter(x=>x.b!=null).sort((a,b)=>b.b-a.b)[0];
  if(!s)return null;const items=gather(list,s.b),known=items.filter(i=>i.caf!=null).map(i=>Object.assign({hrs:(s.b-i.ms)/36e5},i));let lo=0,hi=0;
  known.forEach(k=>{const r=residual(k.caf,k.hrs);lo+=r.lo;hi+=r.hi});
  return{entry:s.e,bed:s.b,items,known,unknown:items.length-known.length,lo,hi,last:items.length?items[items.length-1]:null}}
const mgTxt=v=>v==null?'not looked up':f1(v)+' mg';
function sleepLine(e,bed){const m=e.m,lat=isN(+m.lat)&&+m.lat>0?Math.round(+m.lat):null;let a='';
  try{if(m.tr&&typeof m.tr.e==='string'&&typeof HWTrance!=='undefined'){const p=HWTrance.pct(m.tr.e,Math.max(0,+m.tr.o||0));if(p)a=' Abyssal Slumber about '+Math.round(p.A*p.n*HWTrance.K.EP/100)+' min (the game’s estimate from phone movement, not a sleep-stage measurement).'}}catch(x){}
  return'Bed '+hhmm(bed)+' · '+(lat==null?'time to fall asleep not recorded':'fell asleep after about '+lat+' min')+'.'+a}
function why(n){const k=n.known[n.known.length-1],r=residual(k.caf,k.hrs);
  return HWExplain.btn('xnsync','How the caffeine left at bedtime is worked out',{ev:'nightsync',what:'For each drink or food with a caffeine amount saved by Luke, how much would be left at bedtime if the body cleared it at the slowest and fastest half-lives seen between healthy men.',
  inputs:[{n:'Caffeine saved for “'+k.name+'”',v:k.caf,u:'mg',o:'food',d:0},{n:'Hours from then to bed',v:Math.round(k.hrs*10)/10,u:'h',o:'calc',d:1},{n:'Half-life, fast end',v:H_LO,u:'h',o:'default',d:1},{n:'Half-life, slow end',v:H_HI,u:'h',o:'default',d:1}],
  formula:'left = mg × 0.5 ^ (hours ÷ half-life), at 2.7 h and at 9.9 h',steps:[f1(k.caf)+' × 0.5^('+f1(k.hrs)+' ÷ 2.7) = '+f1(r.lo)+' mg',f1(k.caf)+' × 0.5^('+f1(k.hrs)+' ÷ 9.9) = '+f1(r.hi)+' mg','Items added together, each worked the same way'],
  result:f1(n.lo)+' to '+f1(n.hi)+' mg'+(n.unknown?' (at least: some items have no caffeine amount)':''),src:['blanchard83','iom2001'],
  app:'A range of the caffeine that might still be in the body at bedtime, from the amounts Luke saved. It is not a prediction for you and says nothing about how you slept.',
  limits:['2.7 to 9.9 h is the spread between ten healthy men in one 1983 study; yours can fall outside it.','It assumes one dose, fully absorbed, cleared at a steady rate.','Smoking, pregnancy, medicines and genes change the half-life.','The 4 to 5 h textbook figure was supplied by the project owner and has not been read in the book.','Food with no caffeine amount saved is unknown, not zero, so the range is “at least”.']})}
function card(){const n=night(typeof st!=='undefined'?st.e:[]);if(!n)return'';
  const c=n.known.length?'<p role="status"><b>Caffeine left at bedtime: '+(n.unknown?'at least ':'')+f1(n.lo)+' to '+f1(n.hi)+' mg</b> '+why(n)+'<br>From '+n.known.length+' logged item'+(n.known.length===1?'':'s')+' with a caffeine amount saved by Luke: '
      +n.known.map(k=>esc(k.name)+' '+f1(k.caf)+' mg at '+hhmm(k.ms)).join(', ')+'. The range comes from half-lives of 2.7 h and 9.9 h, the spread seen between ten healthy men; people differ, and this is a simple model, not a prediction for you.</p>'
    :'<p role="status"><b>Caffeine left at bedtime: unknown.</b> No caffeine amount was saved for '+(n.items.length?'any of the '+n.items.length+' item'+(n.items.length===1?'':'s')+' logged':'any meal')+' in the 24 hours before bed.</p>';
  const rows=n.items.slice(-MAXROWS);
  const t=n.items.length?'<ul class="nsl" aria-label="Items logged in the 24 hours before bed">'+rows.map(r=>'<li><b>'+hhmm(r.ms)+' · '+esc(r.name)+'</b><br>Caffeine: '+mgTxt(r.caf)+' · Magnesium: '+mgTxt(r.mg)+' · Tryptophan: '+mgTxt(r.trp)+'</li>').join('')+'</ul>'
      +(n.items.length>rows.length?'<small class="mut">Showing the last '+rows.length+' of '+n.items.length+' items.</small>':''):'<p class="mut">No meals were logged in the 24 hours before bed.</p>';
  const miss=n.items.filter(i=>i.caf==null||i.mg==null||i.trp==null).length;
  return'<div class="card nsc" id="nsync-card"><h3>NIGHTLY ALCHEMICAL SYNC</h3><span class="pxtag gvtag">DESCRIPTIVE ONLY</span>'
    +'<p>'+sleepLine(n.entry,n.bed)+'</p>'
    +(n.last?'<p>Last item logged: <b>'+esc(n.last.name)+'</b> at '+hhmm(n.last.ms)+', '+f1((n.bed-n.last.ms)/36e5)+' h before bed.</p>':'')
    +c+t
    +(miss?'<p class="mut">Caffeine, magnesium or tryptophan is <b>unavailable for '+miss+' of '+n.items.length+' logged item'+(n.items.length===1?'':'s')+'</b>: Luke has not looked them up. “Not looked up” means unknown, not zero, so no total is shown.</p>':'')
    +'<p class="mut">A textbook figure often quoted for the caffeine half-life is 4 to 5 hours (range 2 to 9). The project owner supplied it and it has not yet been checked in the book.</p>'
    +'<small class="mut">Descriptive, not evidence of cause: this table does not say that food or caffeine changed your sleep. Not saved or scored, and not a medical measurement.</small></div>'}
{const p=pages.sleep;pages.sleep=(...a)=>{const h=p(...a),c=card(),k='<div class="card" id="v6trc">';if(!c||typeof h!=='string')return h;const i=h.indexOf(k);return i<0?h+c:h.slice(0,i)+c+h.slice(i)}}
HWUI.css('nsync','.nsc h3{margin-bottom:4px}.nsc p{margin:8px 0}.nsl{list-style:none;margin:8px 0;padding:0}.nsl li{border:2px solid var(--ln);padding:6px 8px;margin:6px 0;font-size:13px;overflow-wrap:anywhere}');
return{stamp,bedStamp,residual,gather,night,card,H_LO,H_HI,WIN_H}})();
