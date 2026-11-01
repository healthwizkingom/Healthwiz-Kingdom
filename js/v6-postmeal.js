/* v6: After your meal, an optional easy-walk timer, a quiet card on the Nutrition page. Not part of the original.
   Feature 12 of the owner's catalog, in its honest form (docs/FEATURE_CONSULTS.md). The catalog tied a post-meal climb to glucose uptake
   (GLUT4, insulin). The app has no glucose input and no source for any benefit claim, so this makes NO claim about glucose, digestion,
   calories or benefit. It is only a timer for an easy walk, offered once a meal has been logged.

   When: only on the Nutrition page, only when a meal was logged in the last 3 hours (the entries' own date and time, so it works across
   midnight). No notification, no pop-up, nothing in the background. It sits right under the calorie and water summary.
   What: a card with a short, neutral line, a choice of 5, 10 or 15 minutes (10 by default), a start button, and a timer whose time comes
   from the clock (a slow screen cannot stretch it). "I'M BACK" ends it early. It says how long you moved and that nothing was saved.
   Kept off the "burn it off" road on purpose (the Alchemist's Workshop never turns food into stairs either): no calorie or glucose
   words, no link to what or how much was eaten, no streak, no XP, no badge, nothing saved. Hidden when the conditions question says stairs
   wait for a doctor (js/v6-conditions.js stairsHidden), and a HIDE THIS CARD switch (st.s.pm = 1, an optional setting, no schema step) turns
   it off, with a one-line way to turn it back on. Stop if dizzy, faint or unwell. Not advice.
   since() / recent() / clock() are pure so the tests can check worked examples. */
const HWPostMeal=(()=>{
const WIN_MIN=180,PRESETS=[5,10,15],$i=i=>document.getElementById(i);
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
/* ---------- pure ---------- */
/** Local time (ms) of an entry's date 'YYYY-MM-DD' and time 'H:MM' or 'HH:MM[:SS]', or null when either is malformed. */
function stamp(d,t){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d==null?'':d)),h=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(t==null?'':t));
  if(!m||!h||+h[1]>23||+h[2]>59)return null;const x=new Date(+m[1],+m[2]-1,+m[3],+h[1],+h[2],0,0).getTime();return isFinite(x)?x:null}
/** Whole minutes from a meal's time to `now` (ms), or null when the time is malformed or in the future. */
function since(d,t,now){const s=stamp(d,t);if(s==null||!(now>=s))return null;return Math.floor((now-s)/6e4)}
/** The latest food entry logged within the last 3 hours: {ms, mins, meal (its key or '')}, or null. Other categories and bad entries are skipped. */
function recent(list,now){let best=null;
  (list||[]).forEach(e=>{if(!e||e.c!=='food'||!isO(e.m))return;const ms=stamp(e.d,e.t);if(ms==null||!(now>=ms))return;const age=(now-ms)/6e4;if(age>WIN_MIN)return;
    if(!best||ms>best.ms)best={ms,mins:Math.floor(age),meal:typeof e.m.meal==='string'?e.m.meal:''}});return best}
/** ms → m:ss, never negative. */
const clock=ms=>{const s=Math.max(0,Math.round(ms/1000))||0;return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const mealName=k=>{const m=typeof MEALS!=='undefined'?MEALS.find(x=>x[0]===k):null;return m?m[1].toLowerCase():'meal'};

/* ---------- state (memory only) ---------- */
let T={k:'idle',mins:10},tick=0;       // k: idle · run · done
const gated=()=>typeof HWCond!=='undefined'&&HWCond.stairsHidden();
const left=()=>T.mins*6e4-(Date.now()-T.t0);
function finish(ms){clearInterval(tick);tick=0;T={k:'done',mins:T.mins,meal:T.meal,ms:Math.min(ms,T.mins*6e4)};paint()}
function frame(){if(T.k!=='run'){clearInterval(tick);tick=0;return}
  const r=left();if(r<=0){try{sfx(660,.15)}catch(e){}finish(T.mins*6e4);return}
  const c=$i('pm-clock');if(c)c.textContent=clock(r)}
/* ---------- the card ---------- */
const SAFE='Stop if you feel dizzy, faint or unwell.';
function body(){
  if(T.k==='run')return'<p>An easy walk, at a pace where you could still talk. You can stop any time.</p><p class="pmbig"><b id="pm-clock" role="timer" aria-label="Time left">'+clock(left())+'</b></p>'
    +'<button type="button" data-a="pmstop">I’M BACK</button><small class="mut">'+SAFE+'</small>';
  if(T.k==='done')return'<p role="status"><b>Moved for '+clock(T.ms)+'</b> after your '+esc(T.meal)+'. Nothing was saved or counted.</p>'
    +'<div class="row"><button type="button" class="g" data-a="pmagain">AGAIN</button></div>';
  const R=recent(st.e,Date.now());
  return'<p>You logged <b>'+esc(mealName(R.meal))+'</b> '+(R.mins<1?'just now':R.mins+' min ago')+'. A short easy walk or a few flights of stairs is one way to get moving after eating, if you feel like it. There is no right amount: skip it if you feel unwell, full or tired.</p>'
    +'<div class="row" role="group" aria-label="Walk length">'+PRESETS.map(m=>'<button type="button" class="chip'+(T.mins===m?' on':'')+'" data-a="pmmins" data-m="'+m+'" aria-pressed="'+(T.mins===m?'true':'false')+'">'+m+' MIN</button>').join('')+'</div>'
    +'<button type="button" data-a="pmstart">START AN EASY WALK TIMER · '+T.mins+' MIN</button>'
    +'<small class="mut">'+SAFE+' Nothing here is saved, scored or counted, and it is not advice.</small>'}
function card(){
  if(gated())return'';
  if(isO(st.s)&&st.s.pm)return'<details class="pmoff" id="pm-card"><summary>The after-meal card is hidden</summary><button type="button" class="g sm" data-a="pmshow">SHOW IT AGAIN</button></details>';
  if(T.k==='idle'&&!recent(st.e,Date.now()))return'';
  return'<div class="card pmcard" id="pm-card"><h3>AFTER YOUR MEAL</h3>'+body()+(T.k==='run'?'':'<button type="button" class="g sm pmhide" data-a="pmhide">HIDE THIS CARD</button>')+'</div>'}
const paint=()=>{const c=$i('pm-card');if(c){const h=card();if(h)c.outerHTML=h;else c.remove()}};
/* ---------- actions ---------- */
acts.pmmins=d=>{const m=+d.m;if(T.k==='idle'&&PRESETS.includes(m)){T.mins=m;paint()}};
acts.pmstart=()=>{const R=recent(st.e,Date.now());if(T.k!=='idle')return;T={k:'run',mins:T.mins,t0:Date.now(),meal:mealName(R?R.meal:'')};clearInterval(tick);tick=setInterval(frame,500);paint()};
acts.pmstop=()=>{if(T.k==='run')finish(Date.now()-T.t0)};
acts.pmagain=()=>{T={k:'idle',mins:T.mins};paint()};
acts.pmhide=()=>{if(!isO(st.s))return;clearInterval(tick);tick=0;T={k:'idle',mins:T.mins};st.s.pm=1;save();render()};
acts.pmshow=()=>{if(isO(st.s)){delete st.s.pm;save()}render()};
HWEvents.on('data:reset',()=>{clearInterval(tick);tick=0;T={k:'idle',mins:10}});HWEvents.on('data:imported',()=>{clearInterval(tick);tick=0;T={k:'idle',mins:10}});
// right under the calorie and water summary: before the section header
{const p=pages.food;pages.food=function(){const h=p.apply(this,arguments),c=card();return c?h.replace('<div class="nshd">',()=>c+'<div class="nshd">'):h}}
HWUI.css('postmeal','.pmcard .row{margin:8px 0}.pmcard small{display:block;margin-top:8px}.pmbig{text-align:center;margin:10px 0}.pmbig b{font:24px/1.3 var(--fh)}.pmhide{margin-top:10px}.pmoff{margin:8px 0;font-size:13px}.pmoff summary{cursor:pointer;min-height:44px;display:flex;align-items:center}');
return{stamp,since,recent,clock,PRESETS,WIN_MIN,get state(){return T.k}}})();
