/* v6: online running leaderboard, the RUNNERS' ROAD board. Not part of the original.
   Shown under RUNNING ROAD on the Training Hall (Exercise) page (js/v6-exercise.js). Backend: supabase/migrations/20261006000000_run_scores.sql.
   * Opt-in. Nothing is sent until the player joins with a nickname (3–16 characters, no profanity, not their profile
     name). Shared: that nickname and weekly running totals (distance, number of runs, best 5K time), nothing else:
     no health data, no route or location, no weight, no account. LEAVE deletes every row of this device.
   * Identity, signed out: device_id, a random UUID kept in this browser (`healthwiz_runboard`). No sign-in needed. Plain
     fetch to the Supabase REST API with the PUBLISHABLE (anon) key only (CFG below).
   * Identity, signed in (js/v6-cloud.js): the entry belongs to the account (user_id) instead, so it follows the player to
     every device (supabase/migrations/20261007000100_run_scores_accounts.sql). On the first sign-in, a device that had
     joined on its own hands its rows to the account (claim_run_scores); a device that had not learns whether the
     account joined elsewhere (run_me). Each device still sends the weekly totals of the runs recorded on it, and the
     board adds an account's devices together. Requests then carry the player's session. Signing out leaves the
     account's entry in place and gives this device a fresh device_id.
   * Data: the runs recorded on this device (js/v6-running.js, `healthwiz_runs`), grouped by local Monday-to-Sunday
     week. Only runs of 0.2 km or more at an average pace of 2:30–15:00 min/km count (the server checks the same).
     Best 5K = the fastest run of 5 km or more, at its average pace × 5 km. This week and last week are submitted
     whenever their totals change, at most once a minute (the server refuses more); older weeks stay on the server,
     so "All time" keeps counting after old runs leave this device.
   * Boards: This week / All time / Best 5K, top 50, the player's own row highlighted (and shown below the top 50).
     This week and All time can be ranked by distance or by consistency (runs per week; all time: active weeks):
     showing up counts as much as going far. Cached for 5 minutes (also offline, marked with its age).
   * Every request: 10 s timeout, try/catch, cached fallback, and a plain offline / not-set-up message.
   Local state: `healthwiz_runboard` = {dev, on, nick, acct (user id while linked), sent: {week: signature}, last (ms),
   cache: {key: {at, r}}}. */
const HWRunBoard=(()=>{
// ← deployers: the Supabase project URL + PUBLISHABLE (anon) key (Dashboard → Project Settings → API).
//   Never a secret / service_role key. Empty values = the leaderboard shows "not set up" and makes no request.
const CFG={url:'https://wghkbrtwrdrejmoswhza.supabase.co',key:'sb_publishable_nE2qzRG3W-fhd4EPFuELQQ_krPNAScU'};
const K='healthwiz_runboard',FRESH=5*60e3,GAP=61e3,TIMEOUT=10e3,MINKM=.2,PMIN=150,PMAX=900;
const D=document,isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const online=()=>navigator.onLine!==false;
function uuid(){const c=typeof crypto!=='undefined'?crypto:null;if(c&&typeof c.randomUUID==='function')return c.randomUUID();
  const b=new Uint8Array(16);if(c&&c.getRandomValues)c.getRandomValues(b);else for(let i=0;i<16;i++)b[i]=Math.random()*256|0;
  b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=Array.prototype.map.call(b,x=>(x<16?'0':'')+x.toString(16)).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}
let B=(()=>{try{const o=JSON.parse(localStorage.getItem(K)||'{}');return isO(o)?o:{}}catch(e){return{}}})();
if(typeof B.dev!=='string'||!/^[0-9a-f-]{36}$/i.test(B.dev))B.dev=uuid();
if(!isO(B.sent))B.sent={};if(!isO(B.cache))B.cache={};
const keep=()=>{try{localStorage.setItem(K,JSON.stringify(B))}catch(e){B.cache={};try{localStorage.setItem(K,JSON.stringify(B))}catch(x){}}};
keep();

/* ---------- nickname ---------- */
const NICK=/^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u;
// English + Malay; checked after folding leetspeak (0→o, 1→i, 3→e, 4→a, 5→s, 7→t, 8→b, @→a, $→s) and dropping non-letters
const RUDE=/(fuck|fuk|shit|bitch|cunt|dick|cock|pussy|asshole|bastard|nigg|fag|slut|whore|rape|porn|penis|vagina|boob|babi|bodoh|pukimak|puki|lancau|pantat|celaka|keparat|kimak|butoh|pepek|haramjadah|taik|burit|sundal|jalang|bangsat|sial|kote)/;
const fold=s=>s.toLowerCase().replace(/[0134578@$!|]/g,c=>({0:'o',1:'i',3:'e',4:'a',5:'s',7:'t',8:'b','@':'a',$:'s','!':'i','|':'i'}[c])).replace(/[^a-z]/g,'');
/** → [nickname] or [null, why]. */
function checkNick(s){s=String(s||'').replace(/\s+/g,' ').trim();
  if(s.length<3||s.length>16)return[null,'Your nickname needs 3 to 16 characters.'];
  if(!NICK.test(s))return[null,'Use letters, numbers, spaces and _ . - only, starting with a letter or number.'];
  if(RUDE.test(fold(s)))return[null,'Please choose a friendlier nickname.'];
  const nm=String((st.p||{}).name||'').trim().toLowerCase();
  if(nm.length>=3&&(s.toLowerCase()===nm||s.toLowerCase().includes(nm)))return[null,'That looks like your real name. Please pick a nickname instead.'];
  return[s]}
const A1=['Swift','Steady','Brave','Sunny','Lucky','Bold','Calm','Quick','Merry','Bright'],A2=['Kancil','Hornbill','Tiger','Otter','Falcon','Comet','Gecko','Heron','Fox','Rusa'];
const suggest=()=>A1[Math.random()*A1.length|0]+' '+A2[Math.random()*A2.length|0]+(10+(Math.random()*90|0));

/* ---------- weekly totals from the runs on this device ---------- */
const pad2=n=>(n<10?'0':'')+n,ymdL=d=>d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
/** Local Monday (YYYY-MM-DD) of the week that holds `d` (a Date), `back` weeks earlier. */
function monday(d,back){const x=new Date(d||Date.now());x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7)-7*(back||0));return ymdL(x)}
/** Totals for one week from a list of runs [{start, dist (m), dur (s)}]: what is submitted. */
function weekOf(runs,ws){const a=new Date(ws+'T00:00:00').getTime(),b=a+7*864e5+3600e3; // +1 h: a week that crosses a DST change elsewhere
  const L=(runs||[]).filter(r=>{const t=Date.parse(r.start);return t>=a&&t<b&&monday(new Date(t))===ws});
  const ok=L.filter(r=>+r.dist>=MINKM*1000&&+r.dur>0&&r.dur/(r.dist/1000)>=PMIN&&r.dur/(r.dist/1000)<=PMAX);
  const km=Math.round(ok.reduce((s,r)=>s+ +r.dist,0)/10)/100,sec=Math.round(ok.reduce((s,r)=>s+ +r.dur,0));
  const f=ok.filter(r=>+r.dist>=5000).map(r=>Math.round(r.dur/(r.dist/1000)*5)).filter(x=>x>=750&&x<=4500);
  return{ws,km,runs:ok.length,sec,b5:f.length?Math.min(...f):null,skipped:L.length-ok.length}}
const myRuns=()=>typeof HWRun!=='undefined'?HWRun.runs():[];
const weeks=()=>{const R=myRuns();return[monday(null,0),monday(null,1)].map(w=>weekOf(R,w))};
const sig=w=>[w.km,w.runs,w.sec,w.b5,B.nick].join('|');
const tooBig=w=>w.km>100?'more than 100 km':w.runs>50?'more than 50 runs':'';

/* ---------- server ---------- */
const fail=(code,msg,status)=>Object.assign(new Error(msg||code),{code,status});
function cfg(){const u=String(CFG.url||'').replace(/\/+$/,''),k=String(CFG.key||'');if(!u||!k)return null;
  // a secret / service_role key is refused (the same check as Cloud Save)
  if(typeof HWCloud!=='undefined'&&typeof HWCloud.checkProject(u,k)==='string')return null;return{u,k}}
const acct=()=>typeof HWCloud!=='undefined'?HWCloud.who():null;
const mine=()=>!!B.acct&&B.acct===acct(); // this device's entry is the signed-in account's
async function rpc(fn,body,signed){const c=cfg();if(!c)throw fail('setup');if(!online())throw fail('net');
  if(signed){try{return await HWCloud.api('/rest/v1/rpc/'+fn,{method:'POST',body,ms:TIMEOUT})}
    catch(e){throw fail(e.code==='net'?'net':e.code==='setup'?'setup':e.code==='rate'?'rate':e.status===400?'input':e.code==='auth'?'auth':'http',e.message,e.status)}}
  const h={apikey:c.k,'Content-Type':'application/json'};if(/^eyJ/.test(c.k))h.Authorization='Bearer '+c.k; // legacy anon JWT
  const ctl=typeof AbortController==='function'?new AbortController():null,t=setTimeout(()=>ctl&&ctl.abort(),TIMEOUT);
  let r;try{r=await fetch(c.u+'/rest/v1/rpc/'+fn,{method:'POST',headers:h,body:JSON.stringify(body),signal:ctl&&ctl.signal,cache:'no-store'})}
  catch(e){throw fail('net')}finally{clearTimeout(t)}
  const txt=await r.text().catch(()=>'');let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok){const m=String((j&&(j.message||j.msg||j.error))||('Error '+r.status)).slice(0,160);
    throw fail(r.status===429?'rate':r.status===404||(j&&/PGRST20[25]|42883|42P01/.test(j.code||''))?'setup':r.status===400?'input':'http',m,r.status)}
  return j}
const why=e=>e.code==='net'?'Could not reach the leaderboard (offline or no signal).':e.code==='setup'?'The running leaderboard is not set up yet.'
  :e.code==='rate'?'Saved too recently; trying again in a minute.':e.code==='input'?'The leaderboard did not accept this: '+e.message+'.':'The leaderboard is unavailable right now.';

/* ---------- submit (this week and last week, when they change) ---------- */
let busy=0,T=0,serr='';
function due(){return weeks().filter(w=>!tooBig(w)&&B.sent[w.ws]!==sig(w)&&(w.runs>0||B.sent[w.ws]!=null))}
function later(ms){clearTimeout(T);T=setTimeout(push,Math.max(1e3,ms))}
async function push(){clearTimeout(T);T=0;if(!B.on||busy||!online()||!cfg())return false;
  if(acct()&&!mine()){link().then(()=>{if(mine()&&B.on)later(0)});return false} // signed in: link the account first
  const L=due();if(!L.length)return false;
  const w=L[0],left=(+B.last||0)+GAP-Date.now();if(left>0){later(left);return false}
  busy=1;let ok=false;
  try{if(mine())await rpc('submit_run_score_me',{p_device_id:B.dev,p_week_start:w.ws,p_distance_km:w.km,p_runs:w.runs,p_moving_sec:w.sec,p_best_5k_sec:w.b5},1);
    else await rpc('submit_run_score',{p_device_id:B.dev,p_nickname:B.nick,p_week_start:w.ws,p_distance_km:w.km,p_runs:w.runs,p_moving_sec:w.sec,p_best_5k_sec:w.b5});
    B.sent[w.ws]=w.runs>0?sig(w):undefined;if(w.runs===0)delete B.sent[w.ws];B.last=Date.now();B.cache={};serr='';ok=true}
  catch(e){if(e.code==='rate')B.last=Date.now();serr=e.code==='rate'?'':why(e);if(e.code==='input'){B.sent[w.ws]=sig(w)}} // refused data: don't retry the same numbers
  finally{busy=0;const live=new Set(weeks().map(x=>x.ws));Object.keys(B.sent).forEach(k=>{if(!live.has(k))delete B.sent[k]});keep()}
  if(due().length&&online())later(GAP);
  if(ok)load(true);else paint();
  return ok}

/* ---------- boards ---------- */
const TABS=[['week','THIS WEEK'],['all','ALL TIME'],['5k','BEST 5K']];
let tab='week',sort='km',phase='idle',lerr='',arm=0,note='',seen=0;
const ckey=()=>tab+'|'+(tab==='5k'?'':sort)+'|'+(tab==='week'?monday(null,0):'')+'|'+(B.on?1:0)+(acct()?'|a':'');
async function load(force){const k=ckey(),c=B.cache[k];if(c&&!force&&Date.now()-c.at<FRESH){paint();return}
  if(!cfg()){lerr=why(fail('setup'));paint();return}
  if(!online()){lerr=why(fail('net'));paint();return}
  phase='load';paint();
  try{const q={p_board:tab,p_week:tab==='week'?monday(null,0):null,p_device_id:B.on&&!mine()?B.dev:null,p_sort:sort},r=acct()?await rpc('run_board',q,1):await rpc('run_board',q);
    B.cache[k]={at:Date.now(),r:Array.isArray(r)?r.slice(0,51):[]};lerr='';keep()}
  catch(e){lerr=why(e)}
  phase='idle';paint()}

const two=n=>(n<10?'0':'')+n,t5=s=>s==null?'–':Math.floor(s/60)+':'+two(s%60);
const km=v=>(+v||0).toFixed(1);
const ico=(n,o)=>HWPixel.icon(n,o||1);
const medal=r=>r===1?ico('achievement',{s:2,label:'1st place, gold trophy'}):r===2?ico('medal2',{s:2,label:'2nd place, silver medal'}):r===3?ico('medal3',{s:2,label:'3rd place, bronze medal'}):'<span class="rbn">#'+r+'</span>';
// consistency pips: one boot per run this week (up to 7), so three short runs shine like one long one
const pips=n=>{n=Math.min(7,+n||0);return n?'<span class="rbpip" aria-hidden="true">'+Array.from({length:n},()=>ico('running')).join('')+'</span>':''};
function line(x){const r=+x.rank,n=+x.runs||0,w=+x.weeks||0;
  const v=tab==='5k'?'<b>'+t5(+x.best_5k_sec)+'</b><small>5K time</small>'
    :sort==='runs'?'<b>'+(tab==='all'?w+' wk':n+' run'+(n===1?'':'s'))+'</b><small>'+(tab==='all'?n+' runs · '+km(x.distance_km)+' km':km(x.distance_km)+' km')+'</small>'
    :'<b>'+km(x.distance_km)+' km</b><small>'+n+' run'+(n===1?'':'s')+(tab==='all'?' · '+w+' wk':'')+'</small>';
  const steady=tab==='week'&&n>=3?'<span class="pxtag rbst">'+ico('star')+'STEADY</span>':tab==='all'&&w>=4?'<span class="pxtag rbst">'+ico('star')+w+' WEEKS</span>':'';
  return'<li class="'+(x.me?'me':'')+(r<=3?' top':'')+'"><span class="rk">'+medal(r)+'</span><span class="nm">'+esc(x.nickname)+(x.me?' <b>(YOU)</b>':'')
    +'<small>'+(tab==='week'?pips(n):'')+steady+'</small></span><span class="vl">'+v+'</span></li>'}
function list(){const c=B.cache[ckey()];
  if(!c)return'<p class="mut" role="status">'+(phase==='load'?'Opening the board…':lerr?'':'The board loads when you scroll here.')+'</p>';
  const R=c.r,age=Math.round((Date.now()-c.at)/60e3);
  let h=R.length?'':'<p class="mut">'+(tab==='5k'?'No 5K times yet. A run of 5 km or more sets one.':'Nobody has posted a run '+(tab==='week'?'this week':'yet')+'. Be the first!')+'</p>';
  let last=0;h+=R.length?'<ol class="rbl" aria-label="'+TABS.find(t=>t[0]===tab)[1]+' leaderboard">'+R.map(x=>{const gap=last&&+x.rank>last+1&&x.me&&R.indexOf(x)>=50?'<li class="gap" aria-hidden="true">…</li>':'';last=+x.rank;return gap+line(x)}).join('')+'</ol>':'';
  const mine=R.find(x=>x.me);if(mine)h+='<p role="status">Your place: <b>#'+mine.rank+'</b>'+(tab!=='5k'&&+mine.runs>=3&&tab==='week'?' · '+mine.runs+' runs this week. That steady rhythm is what builds fitness.':'')+'</p>';
  if(age>=1||lerr)h+='<p class="mut"><small>'+(lerr?'Showing the board from '+age+' min ago. ':'Updated '+age+' min ago.')+'</small></p>';
  return h}
function you(){const W=weeks()[0];if(!B.on)return'';const big=tooBig(W);
  return'<div class="rbyou"><b>'+ico('running')+' YOU THIS WEEK</b><p><b>'+W.runs+'</b> run'+(W.runs===1?'':'s')+' · <b>'+km(W.km)+'</b> km'+(W.b5?' · best 5K <b>'+t5(W.b5)+'</b>':'')+'</p>'
    +(W.runs?pips(W.runs)+'<p class="mut">'+(W.runs>=3?'Three or more runs this week: consistency is the real win.':'Every run counts. Short and regular beats long and rare.')+'</p>':'<p class="mut">No runs yet this week. You appear on This week after your first run.</p>')
    +(W.skipped?'<p class="mut"><small>'+W.skipped+' run'+(W.skipped===1?' is':'s are')+' not counted (shorter than 0.2 km, or an average pace outside 2:30–15:00 min/km, e.g. a walk).</small></p>':'')
    +(big?'<div class="warn">This week has '+big+', above the leaderboard\'s limit, so it is not posted.</div>':'')
    +(busy?'<p class="mut" role="status">Posting…</p>':due().length&&!online()?'<p class="mut" role="status">Offline. Your totals are posted when you are back online.</p>':due().length?'<p class="mut" role="status">Posting your totals within a minute…</p>':'')
    +(serr?'<div class="warn" role="alert">'+esc(serr)+' Your runs are safe on this device.</div>':'')+'</div>'}
function join(){const nm=B.draft||(B.draft=suggest());
  return'<div class="rbjoin"><p>Compare your running with other HealthWiz runners. Joining is optional, and you can leave any time.</p>'
    +'<p><b>What is shared:</b> your nickname and your weekly running totals (distance, number of runs, best 5K time). '
    +'<b>Never shared:</b> health data, heart rate, weight, your route or location, your name, your e-mail or account details.'
    +(acct()?' Signed in, your entry follows your account to every device.':'')+'</p>'
    +'<label>Nickname (3–16 characters; please don\'t use your real name)<input id="rbnick" maxlength="16" autocomplete="off" spellcheck="false" value="'+esc(nm)+'"></label>'
    +'<button data-a="rbjoin"'+(online()&&cfg()?'':' disabled')+'>'+ico('achievement')+' JOIN THE RUNNERS\' BOARD</button></div>'}
function card(){const c=cfg();let h='<div class="card" id="v6rb"><h3>'+ico('achievement')+' RUNNERS\' BOARD '+HWHelp.btn('runboard')+'</h3>';
  if(!c)return h+'<p class="mut">The running leaderboard is not set up on this copy of HealthWiz. Your runs still work and stay on this device.</p></div>';
  h+='<div class="v6tabs rbtabs" role="group" aria-label="Choose a board">'+TABS.map(t=>'<button class="sm'+(t[0]===tab?'':' g')+'" data-a="rbtab" data-v="'+t[0]+'" aria-pressed="'+(t[0]===tab)+'">'+t[1]+'</button>').join('')+'</div>';
  if(tab!=='5k')h+='<div class="rbsort" role="group" aria-label="Rank by"><small>RANK BY</small>'+[['km','DISTANCE'],['runs','CONSISTENCY']].map(s=>'<button class="sm'+(s[0]===sort?'':' g')+'" data-a="rbsort" data-v="'+s[0]+'" aria-pressed="'+(s[0]===sort)+'">'+s[1]+'</button>').join('')+'</div>';
  h+=(!online()&&!B.cache[ckey()]?'<p class="mut" role="status">Offline. The board opens when you are back online; your runs are saved on this device.</p>':list());
  if(lerr)h+='<div class="warn" role="status">'+esc(lerr)+'</div>';
  h+='<div class="row"><button class="g" data-a="rbref"'+(phase==='load'||!online()?' disabled':'')+'>REFRESH</button></div>';
  h+=B.on?you()+'<details class="rbpriv"><summary>Nickname & privacy</summary><label>Nickname<input id="rbnick" maxlength="16" autocomplete="off" spellcheck="false" value="'+esc(B.nick||'')+'"></label>'
      +'<div class="row"><button class="g" data-a="rbname">SAVE NICKNAME</button><button class="g" data-a="rbleave">'+(arm?'TAP AGAIN TO LEAVE':'LEAVE THE BOARD')+'</button></div>'
      +'<small class="mut">Leaving deletes your nickname and all your weekly totals from the server. Your runs stay on this device.</small></details>'
    :join();
  if(note)h+='<div class="warn" role="alert">'+note+'</div>';
  return h+'</div>'}
function paint(){const el=D.getElementById('v6rb');if(!el)return;const inp=el.querySelector('#rbnick'),v=inp?inp.value:null,a=D.activeElement,
  foc=a&&el.contains(a)?(a.id?'#'+a.id:a.dataset&&a.dataset.a?'[data-a="'+a.dataset.a+'"]'+(a.dataset.v?'[data-v="'+a.dataset.v+'"]':''):null):null,open=!!el.querySelector('details[open]');
  el.outerHTML=card();const n=D.getElementById('v6rb');if(!n)return;
  if(v!=null){const x=n.querySelector('#rbnick');if(x)x.value=v}if(open){const d=n.querySelector('details');if(d)d.open=true}
  if(foc){const x=n.querySelector(foc);if(x&&!x.disabled)x.focus()}watch()}
// load when the card scrolls into view (nothing is fetched for someone who never looks at it)
let IO=null;
function watch(){const el=D.getElementById('v6rb');if(!el||seen)return;if(IO)IO.disconnect();
  if(typeof IntersectionObserver==='undefined'){seen=1;load();return}
  IO=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){IO.disconnect();IO=null;seen=1;load()}},{rootMargin:'150px 0px'});IO.observe(el)}
function section(){seen=0;Promise.resolve().then(watch);return card()}

/* ---------- actions ---------- */
const nickIn=()=>((D.getElementById('rbnick')||{}).value||'');
acts.rbtab=d=>{tab=d.v;note='';lerr='';paint();load()};
acts.rbsort=d=>{sort=d.v;note='';lerr='';paint();load()};
acts.rbref=()=>{note='';lerr='';push().finally(()=>load(true))};
acts.rbjoin=async()=>{const[n,bad]=checkNick(nickIn());if(bad){note=esc(bad);return paint()}
  if(!online()){note='You are offline. Join when you are back online.';return paint()}
  if(acct()){try{await rpc('run_join_me',{p_nickname:n,p_device_id:B.dev},1);B.acct=acct()}
    catch(e){note=esc(why(e))+' You have not joined; nothing was shared.';return paint()}}
  B.on=1;B.nick=n;B.draft=null;B.sent={};B.cache={};note='';keep();paint();
  const W=weeks().filter(w=>w.runs&&!tooBig(w));
  if(W.length){await push();if(/not set up|did not accept/.test(serr)){B.on=0;B.sent={};keep();note=esc(serr)+' You have not joined; nothing was shared.';serr='';return paint()}}
  toast('Welcome to the Runners\' Board, '+esc(n)+'!');HWEvents.emit('runboard:joined',{});load(true)};
acts.rbname=async()=>{const[n,bad]=checkNick(nickIn());if(bad){note=esc(bad);return paint()}
  if(mine()){try{await rpc('run_join_me',{p_nickname:n},1);B.cache={}}catch(e){note=esc(why(e));return paint()}}
  B.nick=n;B.sent={};keep();note='';
  toast('Nickname saved. It updates on the board within a minute.');push()};
acts.rbleave=async()=>{if(!arm){arm=1;return paint()}arm=0;
  try{if(mine())await rpc('leave_run_board_me',{},1);else await rpc('leave_run_board',{p_device_id:B.dev});clearTimeout(T);B={dev:uuid(),on:0,sent:{},cache:{},last:0};keep();note='';HWEvents.emit('runboard:left',{});
    toast('You left the Runners\' Board. Your entry was deleted from the server; your runs stay on this device.');load(true)}
  catch(e){note=esc(why(e))+' You are still on the board; try again when you are online.';paint()}};
D.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='rbnick'){e.preventDefault();(B.on?acts.rbname:acts.rbjoin)()}});

/* ---------- accounts: hand this device's entry to the signed-in account, and back ---------- */
let linking=null;
/** Signed in and not linked yet: claim this device's rows (if it had joined) or learn whether the account has joined. */
function link(){const u=acct();if(!u||mine()||!cfg()||!online())return Promise.resolve();
  if(B.acct&&B.acct!==u)B={dev:uuid(),on:0,sent:{},cache:{},last:0}; // another account was linked here before
  return linking=linking||(async()=>{try{
      const r=B.on?await rpc('claim_run_scores',{p_device_id:B.dev,p_nickname:B.nick||null},1):await rpc('run_me',{},1),o=Array.isArray(r)?r[0]:r;
      B.acct=u;if(o&&o.joined){B.on=1;B.nick=o.nickname||B.nick}else B.on=0;B.sent={};B.cache={};keep();
      if(B.on)HWEvents.emit('runboard:linked',{});}
    catch(e){serr=e.code==='setup'?'The running leaderboard is not set up for accounts yet.':''}
    finally{linking=null;paint()}})()}
HWEvents.on('cloud:signed-in',()=>{link().then(()=>{if(B.on)push()})});
HWEvents.on('cloud:signed-out',()=>{if(!B.acct)return;clearTimeout(T);B={dev:uuid(),on:0,sent:{},cache:{},last:0};keep();paint()}); // the entry stays with the account

/* ---------- triggers: a saved or deleted run updates the board ---------- */
{const f=acts.runfinish,d=acts.rundel;acts.runfinish=(...a)=>{const r=f(...a);setTimeout(push,0);return r};acts.rundel=(...a)=>{const r=d(...a);setTimeout(push,0);return r}}
HWEvents.on('app:ready',()=>{link().then(()=>{if(B.on)push()})});
HWEvents.on('page:viewed',e=>{arm=0;note='';if(e.view==='exercise'&&B.on)push()});
addEventListener('online',()=>{link().then(()=>{if(B.on)push()});paint()});addEventListener('offline',()=>paint());
// Reset on this device: leave the board too, so no orphaned entry stays online (best effort; offline it stays until LEAVE)
HWEvents.on('data:reset',()=>{const dev=B.dev,on=B.on&&!B.acct;clearTimeout(T);if(on&&online())rpc('leave_run_board',{p_device_id:dev}).catch(()=>{});
  B={dev:on&&!online()?dev:uuid(),on:0,sent:{},cache:{},last:0};keep()});

HWUI.css('runboard',`
#v6rb h3{display:flex;align-items:center;gap:8px}
#v6rb .v6tabs{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}#v6rb .v6tabs button{flex:1 1 90px;min-height:44px}
#v6rb button[aria-pressed="true"]{background:var(--gold);color:#1d1730;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25)}
.rbsort{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:0 0 8px}.rbsort small{font:var(--px-f1)/1.6 var(--fh);margin-right:4px}.rbsort button{flex:1 1 110px;min-height:44px}
.rbl{list-style:none;margin:6px 0;padding:0}.rbl li{display:flex;gap:8px;align-items:center;border:3px solid var(--ln);background:var(--p2);padding:6px 8px;margin:4px 0;min-height:48px}
.rbl li.top{background:var(--pn)}.rbl li .rk{flex:0 0 36px;display:flex;justify-content:center}.rbn{font:var(--px-f1)/1 var(--fh)}
.rbl li .nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rbl li .nm small{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:2px}
.rbl li .vl{flex:0 0 auto;text-align:right}.rbl li .vl b{display:block;font-size:15px}.rbl li .vl small{display:block;color:var(--mut);font-size:11px}
.rbl li.me{outline:3px solid var(--gold);outline-offset:-6px}.rbl li.gap{border:0;background:none;justify-content:center;min-height:0;padding:0}
.rbpip{display:inline-flex;gap:1px}.rbst{font-size:7px}
.rbyou,.rbjoin{margin:10px 0;padding:10px;border:var(--px-bw-c) dashed var(--ln);background:var(--p2)}.rbyou>b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fh)}
.rbyou p,.rbjoin p{margin:6px 0}.rbjoin button{width:100%;min-height:48px;display:flex;align-items:center;justify-content:center;gap:8px}
#v6rb .row button{flex:1 1 130px;min-height:44px}#v6rb details{margin:8px 0}#v6rb .warn{margin:8px 0}
`);
return{section,checkNick,weekOf,monday,fold,push,load,link,get state(){return{on:!!B.on,nick:B.nick||null,dev:B.dev,acct:B.acct||null,linked:mine(),tab,sort,phase,error:lerr||serr}}}})();
