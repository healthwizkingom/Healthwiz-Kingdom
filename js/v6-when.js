/* v6: "Log for…": one shared control to log something that happened earlier (yesterday, or any earlier date and time).
   Not part of the original. The original add() already takes a date and a time, entries are stored with `d` (local
   YYYY-MM-DD) and `t` (local HH:MM), and every total, chart, score, streak and quest reads entries by that date, so a
   backdated entry lands on the right day with nothing else to change. This file only adds the way to choose the date.

   The normal flow is untouched: the control shows one small "Log for…" button; nobody has to open it. Choosing a date
   switches the button to "LOGGING FOR: Yesterday · 21:30" with USE NOW beside it, so it is always visible when an
   entry will not be saved for right now. The choice is shared by the controls on a page (Nutrition and Water count as
   one page), stays while you log several entries, and resets when you go to another page.

     HWWhen.html({id, time, cats, label, hint})   // the control; time:false = date only (sleep, energy, BMI)
     HWWhen.stamp({time, fb, sig})                // → {d, t, back} for the entry about to be saved, or null (already told the user why)
     HWWhen.saved(w, what)                        // after saving: a toast naming the date when it was not "now"
     HWWhen.custom() · date() · reset()

   Rules (all local time, no UTC conversion, so nothing shifts across midnight or a time-zone change):
   · never in the future: the date input has max=today, and a date or time after "now" is refused when it is chosen and again when
     saving (the page may have stayed open past midnight);
   · date-only entries (sleep, energy, BMI) keep the real time when logged for today; for another date they get a fixed time
     (sleep: the wake-up time) so the day is unambiguous;
   · a repeated identical save within 2.5 s of a backdated one is ignored (a double tap);
   · the day's own entries are listed in the panel, with the existing edit and delete buttons, so a past entry can be corrected;
   · live measurements are never backdated: GPS check-ins, GPS runs and heart rates read from a device keep their own time. */
const HWWhen=(()=>{
const MO=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const GRP={food:'prov',water:'prov'};              // pages that share one choice
const X={d:null,t:null,tm:0,open:'',grp:null,msg:''}; // d null = now; tm = the time was set by hand
const E=s=>typeof esc==='function'?esc(s):String(s);
const at=(ds,n)=>{const p=ds.split('-');return ymd(new Date(+p[0],+p[1]-1,+p[2]+n,12))};   // noon: safe across daylight-saving changes
const validD=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||'')&&at(s,0)===s;
const validT=s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s||'');
const future=(d,t)=>d>today()||(d===today()&&t>nowT());
const isNow=()=>X.d==null;
const custom=()=>X.d!=null;
const date=()=>X.d==null?today():X.d;
const time=()=>X.d==null||!X.tm||!validT(X.t)?nowT():X.t;   // until the time is chosen by hand it follows the clock
function lab(d,t,withT){const T=today();let s;if(d===T)s='Today';else if(d===at(T,-1))s='Yesterday';
  else{const p=d.split('-'),w=new Date(+p[0],+p[1]-1,+p[2],12);s=WD[w.getDay()]+' '+(+p[2])+' '+MO[+p[1]-1]+(+p[0]!==+T.slice(0,4)?' '+p[0]:'')}
  return s+(withT&&t?' · '+t:'')}
function reset(g){X.d=X.t=null;X.tm=0;X.open='';X.msg='';if(g!==undefined)X.grp=g}
const grpOf=v=>GRP[v]||v;

/* ---------- markup ---------- */
function html(o){o=o||{};const wt=o.time!==false,id=o.id||'x',cats=o.cats||[],c=custom(),op=X.open===id,T=today(),Y=at(T,-1);
  const g=grpOf(typeof S!=='undefined'?S.v:'');if(X.grp==null)X.grp=g;
  let h='<div class="hww'+(c?' on':'')+'" data-hwid="'+E(id)+'" data-time="'+(wt?1:0)+'" data-cats="'+E(cats.join(','))+'" data-label="'+E(o.label||'')+'" data-hint="'+E(o.hint||'')+'">'
    +'<div class="hwwr"><button type="button" class="chip hwwb'+(c?' on':'')+'" data-hww="tog" aria-expanded="'+op+'" aria-controls="hww-p-'+E(id)+'">📅 '
    +(c?'LOGGING FOR: '+E(lab(X.d,time(),wt)):E(o.label||'Log for…'))+'</button>'+(c?'<button type="button" class="g sm" data-hww="now">USE NOW</button>':'')+'</div>';
  if(op){h+='<div class="hwwp" id="hww-p-'+E(id)+'" role="group" aria-label="When did this happen?">'
    +'<div class="row"><button type="button" class="chip'+(!c?' on':'')+'" data-hww="today" aria-pressed="'+!c+'">Today (now)</button>'
    +'<button type="button" class="chip'+(X.d===Y?' on':'')+'" data-hww="yest" aria-pressed="'+(X.d===Y)+'">Yesterday</button></div>'
    +'<div class="row"><label>Date<input type="date" data-hww-in="d" max="'+T+'" value="'+date()+'"></label>'
    +(wt?'<label>Time<input type="time" data-hww-in="t" value="'+time()+'"></label>':'')+'</div>'
    +'<p class="hwwn" role="status" aria-live="polite">'+E(X.msg)+'</p>'
    +(o.hint?'<p class="hwwh">'+E(o.hint)+'</p>':'');
    if(c&&cats.length){const rows=[].concat.apply([],cats.map(k=>A(k,X.d))).sort((a,b)=>a.t.localeCompare(b.t));
      h+='<div class="hwwe"><b>Already logged on '+E(lab(X.d))+'</b>'+(rows.length?rows.map(e=>row(e)).join(''):'<p class="mut">Nothing logged on this day yet.</p>')+'</div>'}
    h+='<button type="button" class="g sm" data-hww="close">DONE</button></div>'}
  return h+'</div>'}

function paint(){const a=document.activeElement,k=a&&a.closest&&a.closest('.hww')?(a.dataset.hww?'[data-hww="'+a.dataset.hww+'"]':a.dataset.hwwIn?'[data-hww-in="'+a.dataset.hwwIn+'"]':''):'',
  id=k&&a.closest('.hww').dataset.hwid;
  const en=document.getElementById('encheck');if(en&&typeof enCard==='function')en.outerHTML=enCard(today());   // its heading and chips follow the chosen day
  document.querySelectorAll('.hww').forEach(el=>{el.outerHTML=html({id:el.dataset.hwid,time:el.dataset.time==='1',cats:(el.dataset.cats||'').split(',').filter(Boolean),label:el.dataset.label,hint:el.dataset.hint})});
  if(k){const n=document.querySelector('.hww[data-hwid="'+id+'"] '+k);if(n)try{n.focus({preventScroll:true})}catch(e){n.focus()}}
  document.dispatchEvent(new Event('hww:change'))}

/* ---------- choosing ---------- */
function setDate(v){X.msg='';
  if(!validD(v)){X.d=null;X.tm=0;X.t=null;return}
  if(v>today()){X.msg='That date is in the future. Only today and earlier dates can be logged.';v=today()}
  if(v===today()&&!X.tm){X.d=null;X.t=null;return}
  X.d=v;
  if(X.d===today()&&X.tm&&X.t>nowT()){X.t=nowT();X.msg='That time has not happened yet, so it was set to now.'}}
function setTime(v){X.msg='';if(!validT(v))return;
  if(date()===today()&&v>nowT()){v=nowT();X.msg='That time has not happened yet, so it was set to now.'}
  X.t=v;X.tm=1;if(X.d==null)X.d=today()}
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-hww]');if(!b||!b.closest('.hww'))return;e.preventDefault();e.stopPropagation();
  const k=b.dataset.hww;
  const cid=b.closest('.hww').dataset.hwid;
  if(k==='tog')X.open=X.open===cid?'':cid;
  else if(k==='close')X.open='';
  else if(k==='now')reset();
  else if(k==='today'){X.d=X.t=null;X.tm=0;X.msg=''}
  else if(k==='yest'){X.msg='';X.d=at(today(),-1)}
  paint()},true);
document.addEventListener('change',e=>{const i=e.target.dataset&&e.target.dataset.hwwIn;if(!i||!e.target.closest('.hww'))return;
  if(i==='d')setDate(e.target.value);else if(i==='t')setTime(e.target.value);paint()});

/* ---------- saving ---------- */
let last={s:'',at:0};
/** The date and time to save an entry under. null (with a message) when the choice is not allowed. */
function stamp(o){o=o||{};const wt=o.time!==false;
  if(isNow())return{d:today(),t:nowT(),back:false,wt};
  const d=X.d,t=wt?time():(o.fb&&validT(o.fb)?o.fb:'12:00');
  if(!validD(d)||future(d,wt?t:'00:00')){X.msg='That moment has not happened yet. Choose a time that has already passed.';toast('📅 That date or time is in the future. Choose one that has already passed.');X.open=X.open||'x';paint();return null}
  if(o.sig){const n=Date.now(),dup=last.s===o.sig+'|'+d+'|'+t&&n-last.at<2500;last={s:o.sig+'|'+d+'|'+t,at:n};if(dup){toast('Already saved. That looks like a double tap.');return null}}
  return{d,t,back:true,wt}}
function saved(w,what){if(!w||!w.back)return;toast('📅 '+(what||'Saved')+' for '+lab(w.d,w.t,w.wt)+(w.d===today()?'.':'. Today\'s totals are unchanged.'))}

/* ---------- a page change starts from "now" again ---------- */
{const g0=go;go=function(v){const g=grpOf(v);if(g!==X.grp)reset(g);return g0.apply(this,arguments)}}
if(typeof HWEvents!=='undefined')HWEvents.on('data:reset',()=>reset());

HWUI.css('when',`
.hww{margin:8px 0}.hwwr{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.hwwb{min-height:40px;padding:6px 12px;font:13px/1.3 var(--fb);text-align:left}
.hwwb:not(.on){background:var(--pn);color:#1b5a91;border:2px dashed #1b5a91;box-shadow:none}
.hwwb.on{font-weight:bold}
:root[data-theme="dark"] .hwwb:not(.on){color:#9fd0ff;border-color:#9fd0ff}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .hwwb:not(.on){color:#9fd0ff;border-color:#9fd0ff}}
.hwwp{margin-top:8px;padding:10px;background:var(--p2);border:3px solid var(--ln)}
.hwwp .row{margin:0 0 8px}.hwwp label{flex:1 1 130px;min-width:0}.hwwp input{min-width:0}
.hwwn{min-height:1.3em;margin:0 0 6px;font-size:12px;color:var(--red)}.hwwh{margin:0 0 8px;font-size:12px;color:var(--mut)}
.hwwe{margin:0 0 8px}.hwwe>b{display:block;font:9px/1.6 var(--fh);margin-bottom:4px}
`);
return{html,stamp,saved,custom,date,time,reset,label:lab,future}})();
