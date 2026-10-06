/* v6: online leaderboard, the Hall of Heroes (master prompt §78–80, §36, §59–60, §88, §91, §97 step 23). Not part of the original.
   Optional and opt-in. Needs the cloud save (js/v6-cloud.js) and supabase/migrations/20261004000000_hw_leaderboard.sql.
   * Ranks game progression only (§78): XP this week (the default, so new players have a fair start), total XP, quests,
     badges, kingdom restored, discoveries and the gentle streak (rest days allowed, §36). Nothing else is sent: never
     BMI, weight, calories, entries or any health value (§59–60). XP and badges are read by the server from the
     player's own cloud save; the rest is a handful of counts, clamped by the server.
   * Privacy (§79): nobody is on the board until they join with a hero name of their choice (a suggested fantasy name,
     never the profile name). HIDE MY NAME keeps the rank but shows "Hidden adventurer" to everyone else. LEAVE removes
     the entry from the server. Only signed-in players can see the board; it shows no e-mail, id, time or place.
   * No prizes, no XP for rank, no pressure: it is a friendly comparison of game progress (§80).
   * Updates: after each cloud sync (at most every 2 minutes), on JOIN, and on REFRESH. Offline, the card says so.
   Local state: `healthwiz_board` = {uid, on, name, hidden, at} (this device; never in the save or backups).
   Events: board:joined · board:left · board:updated {hidden}. */
const HWBoard=(()=>{
const D=document,K='healthwiz_board',THROTTLE=120e3,FRESH=60e3;
const TABS=[['week','THIS WEEK','XP this week'],['xp','ALL-TIME XP','XP'],['quests','QUESTS','quests done'],['badges','BADGES','badges'],
  ['kingdom','KINGDOM','% restored'],['explore','EXPLORER','discoveries'],['streak','GENTLE STREAK','days (rest days allowed)']];
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
let B=(()=>{try{const o=JSON.parse(localStorage.getItem(K)||'{}');return isObj(o)?o:{}}catch(e){return{}}})();
const keep=()=>{try{localStorage.setItem(K,JSON.stringify(B))}catch(e){}};
const cloud=()=>typeof HWCloud!=='undefined'?HWCloud:null;
const me=()=>{const c=cloud();return c&&c.who()};
const online=()=>navigator.onLine!==false;
let tab='week',rows={},phase='idle',err='',arm=0,note='',checking=null;

/* ---------- what is shared (game progress only) ---------- */
const mon=()=>{const x=new Date();x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x)};
function weekXP(){const m=mon(),t=today();return Object.entries(st.xd||{}).reduce((s,[d,v])=>d>=m&&d<=t&&+v>0?s+ +v:s,0)}
function stats(){const q6=st.q6||{},n=x=>Math.max(0,Math.floor(+x||0));
  const quests=Object.keys(st.qx||{}).length+Object.values(q6.f||{}).filter(x=>x&&x.done).length
    +Object.values(q6.w||{}).reduce((s,w)=>s+Object.keys((w&&w.done)||{}).length,0);
  let kingdom=0;try{const A=HWKingdom.all();kingdom=Math.round(A.reduce((s,x)=>s+x.lv,0)/A.reduce((s,x)=>s+(x.canFlourish?4:3),0)*100)}catch(e){}
  const ex=st.ex||{},games=Object.values((st.mg||{}).c||{}).reduce((s,c)=>s+n(c&&c.f),0);
  const explore=Object.keys(ex.r||{}).length+Object.keys(ex.p||{}).length+Object.keys((st.gp||{}).v||{}).length+games;
  let streak=0;try{streak=HWStreaks.gentle().days}catch(e){}
  return{week_xp:n(weekXP()),wk:mon(),quests:n(quests),kingdom:Math.min(100,n(kingdom)),explore:n(explore),streak:n(streak)}}
const NAME=/^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u;
function checkName(s){s=String(s||'').replace(/\s+/g,' ').trim();
  if(s.length<3||s.length>20)return[null,'Your hero name needs 3 to 20 characters.'];
  if(!NAME.test(s))return[null,'Use letters, numbers, spaces and . _ \' - only (start with a letter or number).'];
  return[s]}
const A1=['Brave','Swift','Gentle','Bright','Steady','Merry','Wise','Bold','Calm','Lucky','Sunny','Clever'],A2=['Otter','Falcon','Lantern','Willow','Badger','Comet','Heron','Fox','Acorn','Pebble','Robin','Maple'];
const suggest=()=>A1[Math.floor(Math.random()*A1.length)]+' '+A2[Math.floor(Math.random()*A2.length)]+' '+(10+Math.floor(Math.random()*90));

/* ---------- server ---------- */
const rpc=(fn,body)=>cloud().api('/rest/v1/rpc/'+fn,{method:'POST',body});
function why(e){return e.code==='net'?'Could not reach the cloud.':e.code==='setup'?'The leaderboard is not set up in the cloud project yet (run supabase/migrations/20261004000000_hw_leaderboard.sql).'
  :/cloud save first/.test(e.message)?'Your cloud save has not synced yet. Use SYNC NOW in Settings → Account, then try again.':e.code==='auth'?e.message:String(e.message||'Something went wrong.')}
function mine(){const u=me();if(B.uid!==u){B={uid:u};rows={};keep()}return B}
/** Asks the server once per session whether this account has joined (it may have joined on another device). */
function check(){const u=me();if(!u||!online())return Promise.resolve();if(mine().on!=null&&B.chk)return Promise.resolve();
  return checking=checking||cloud().api('/rest/v1/hw_board?select=name,hidden&user_id=eq.'+encodeURIComponent(u)).then(r=>{const o=Array.isArray(r)&&r[0];
    B.on=!!o;B.chk=1;if(o){B.name=o.name;B.hidden=!!o.hidden}keep()}).catch(e=>{if(e.code==='setup'){B.on=false;B.chk=1;err=why(e)}}).finally(()=>{checking=null;paint()})}
async function publish(force){if(!me()||!mine().on||!online())return false;if(!force&&Date.now()-(B.at||0)<THROTTLE)return false;
  B.at=Date.now();keep();await rpc('hw_board_publish',{p_name:B.name,p_hidden:!!B.hidden,p_stats:stats()});rows={};return true}
async function load(t,force){if(!me()||!B.on||!online())return;const c=rows[t];if(c&&!force&&Date.now()-c.at<FRESH)return;
  phase='load';paint();
  try{const r=await rpc('hw_board_top',{p_board:t,p_week:t==='week'?mon():null,p_limit:20});rows[t]={at:Date.now(),r:Array.isArray(r)?r:[]};phase='idle';err=''}
  catch(e){phase='error';err=why(e)}paint()}

/* ---------- card (Quest Board) ---------- */
HWUI.css('board',`
#v6lb .v6tabs{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}#v6lb .v6tabs button{flex:1 1 auto;font-size:8px;padding:8px 6px;min-height:36px}
#v6lb .v6tabs button[aria-pressed="true"]{background:var(--gold);color:#1d1730;box-shadow:inset 0 -3px 0 rgba(0,0,0,.25)}
#v6lb ol{list-style:none;margin:6px 0;padding:0}#v6lb li{display:flex;gap:8px;align-items:center;border:3px solid var(--ln);background:var(--p2);padding:6px 8px;margin:4px 0}
#v6lb li .rk{font:9px/1 var(--fh);min-width:34px}#v6lb li .nm{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#v6lb li .vl{font:9px/1.4 var(--fh);text-align:right}
#v6lb li.me{outline:3px solid var(--gold);outline-offset:-6px;background:var(--pn)}#v6lb li.gap{border:0;background:none;justify-content:center;padding:0}
#v6lb li small{display:block;color:var(--mut);font-size:11px}#v6lb .row button{flex:1 1 140px}#v6lb details{margin-top:8px}#v6lb .warn,#v6lbs .warn{margin:8px 0}
`);
const lvName=x=>{let n=LV[0][0];LV.forEach(l=>{if(x>=l[1])n=l[0]});return n};
const medal=r=>r===1?'🥇':r===2?'🥈':r===3?'🥉':'#'+r;
function list(){const c=rows[tab],T=TABS.find(x=>x[0]===tab);
  if(!c)return'<p class="mut" role="status">'+(phase==='load'?'⏳ Opening the Hall of Heroes…':'')+'</p>';
  const R=c.r;
  if(!R.length)return'<p class="mut">No heroes on this board yet'+(tab==='week'?' this week':'')+'. Your progress counts as soon as you play.</p>';
  let last=0;const li=x=>{const gap=last&&+x.rank>last+1&&x.me?'<li class="gap" aria-hidden="true">⋯</li>':'';last=+x.rank;
    const nm=x.name==null?'🕶️ Hidden adventurer':esc(x.name);
    return gap+'<li class="'+(x.me?'me':'')+'"><span class="rk">'+medal(+x.rank)+'</span><span class="nm">'+nm+(x.me?' <b>(YOU)</b>':'')+'<small>'+esc(lvName(+x.xp||0))+'</small></span><span class="vl">'+(+x.value||0).toLocaleString()+'<small>'+T[2]+'</small></span></li>'};
  const mineRow=R.find(x=>x.me);
  return'<ol aria-label="'+T[1]+' leaderboard">'+R.map(li).join('')+'</ol>'+(mineRow?'<p class="mut" role="status">Your place: <b>'+medal(+mineRow.rank)+'</b>'+(B.hidden?' · your name is hidden from others':'')+'</p>':'')
    +(R.every(x=>!(+x.value>0))?'<p class="mut">Nobody has any yet'+(tab==='week'?' this week':'')+'. Every log and quest counts.</p>':'')}
function card(){const c=cloud(),s=c?c.status():{},u=me();let h='<div class="card" id="v6lb"><h3>🏆 HALL OF HEROES</h3>';
  if(!s.configured||!u){h+='<p class="mut">An optional leaderboard of game progress: XP, quests, badges, kingdom and discoveries. It never shows health data. Sign in (Settings → Account) to join.</p>'
    +'<button class="g" data-a="go" data-v="set" style="width:100%">OPEN CLOUD SAVE SETTINGS</button>'}
  else if(mine().on==null){h+='<p class="mut" role="status">'+(online()?'⏳ Checking the Hall of Heroes…':'📴 Offline. The Hall of Heroes opens when you are back online.')+'</p>'}
  else if(!B.on){const nm=B.draft||(B.draft=suggest());
    h+='<p>Compare your <b>game progress</b> with other HealthWiz players. Joining is optional, and you can hide your name or leave any time.</p>'
      +'<p class="mut">Shared: hero name, XP, quests, badges, kingdom restored, discoveries and gentle streak. <b>Never</b> shared: BMI, weight, calories, sleep, pulse, stress, logs, your e-mail or your location.</p>'
      +'<label>Hero name (not your real name)<input id="lbname" maxlength="20" autocomplete="off" spellcheck="false" value="'+esc(nm)+'"></label>'
      +'<div class="row"><button data-a="lbjoin"'+(online()?'':' disabled')+'>JOIN THE HALL OF HEROES</button></div>'}
  else{h+='<div class="v6tabs" role="group" aria-label="Choose a leaderboard">'+TABS.map(t=>'<button class="sm'+(t[0]===tab?'':' g')+'" data-a="lbtab" data-v="'+t[0]+'" aria-pressed="'+(t[0]===tab)+'">'+t[1]+'</button>').join('')+'</div>'
      +(online()?list():'<p class="mut">📴 Offline. The board updates when you are back online; your progress is saved on this device.</p>')
      +'<div class="row"><button class="g" data-a="lbref"'+(phase==='load'||!online()?' disabled':'')+'>🔄 REFRESH</button></div>'
      +'<details><summary>Name & privacy</summary>'
      +'<label>Hero name<input id="lbname" maxlength="20" autocomplete="off" spellcheck="false" value="'+esc(B.name||'')+'"></label>'
      +'<div class="row"><button class="g" data-a="lbsave">SAVE NAME</button><button class="g" data-a="lbhide">'+(B.hidden?'SHOW MY NAME':'HIDE MY NAME')+'</button><button class="g" data-a="lbleave">'+(arm?'TAP AGAIN TO LEAVE':'LEAVE THE BOARD')+'</button></div>'
      +'<small class="mut">Hidden: you keep your place, others see "Hidden adventurer". Leaving removes your entry from the server; your progress stays yours.</small></details>'}
  if(err&&u)h+='<div class="warn" role="alert">⚠️ '+esc(err)+' Nothing on this device was changed.</div>';
  if(note)h+='<div class="warn">'+note+'</div>';
  return h+'<span class="gtag">🎮 GAME PROGRESS ONLY · NO HEALTH DATA · NO PRIZES</span></div>'}
/* Settings: a short privacy summary under ACCOUNT (§79) */
function setCard(){const u=me();if(!u)return'';mine();
  return'<div class="card" id="v6lbs"><h3>🏆 LEADERBOARD PRIVACY</h3><p class="mut">'+(B.on==null?'Checking…':B.on?'You are on the Hall of Heroes as <b>'+(B.hidden?'Hidden adventurer':esc(B.name||''))+'</b>. Only game progress is shared.':'You are not on the leaderboard. Nothing about you is shown to other players.')+'</p>'
    +(B.on?'<div class="row"><button class="g" data-a="lbhide">'+(B.hidden?'SHOW MY NAME':'HIDE MY NAME')+'</button><button class="g" data-a="lbleave">'+(arm?'TAP AGAIN TO LEAVE':'LEAVE THE BOARD')+'</button></div>':'')
    +'<button class="g" data-a="go" data-v="quests" style="width:100%;margin-top:6px">OPEN THE HALL OF HEROES</button></div>'}
function paint(){[['v6lb',card],['v6lbs',setCard]].forEach(([id,f])=>{const el=D.getElementById(id);if(!el)return;
  const inp=D.getElementById('lbname'),v=inp&&el.contains(inp)?inp.value:null,a=D.activeElement,foc=a&&el.contains(a)?(a.id?'#'+a.id:a.dataset.a?'[data-a="'+a.dataset.a+'"]'+(a.dataset.v?'[data-v="'+a.dataset.v+'"]':''):null):null,open=!!el.querySelector('details[open]');
  const h=f();if(!h){el.remove();return}el.outerHTML=h;const n=D.getElementById(id);if(!n)return;
  if(v!=null){const x=n.querySelector('#lbname');if(x)x.value=v}if(open){const d=n.querySelector('details');if(d)d.open=true}
  if(foc){const x=n.querySelector(foc);if(x)x.focus()}})}
{const p=pages.quests;pages.quests=(...a)=>p(...a)+card()}
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k='<div class="card" id="v6acct">',i=h.indexOf(k);if(i<0)return h;const e=h.indexOf('<div class="card" id="',i+k.length);return e<0?h+setCard():h.slice(0,e)+setCard()+h.slice(e)}}

/* ---------- actions ---------- */
const say=(m,ok)=>{note=ok?'':m;paint();if(ok)toast(m)};
const name=()=>((D.getElementById('lbname')||{}).value||'');
acts.lbtab=d=>{tab=d.v;note='';paint();load(tab)};
acts.lbref=()=>{note='';publish(true).catch(()=>{}).finally(()=>load(tab,true))};
acts.lbjoin=async()=>{const[n,bad]=checkName(name());if(bad)return say('⚠️ '+esc(bad));if(!online())return say('📴 You are offline. Join when you are back online.');
  const c=cloud();note='';err='';phase='load';paint();
  try{await c.sync('user');if(c.status().choose)throw Object.assign(new Error('Finish the choice in Settings → Account first.'),{code:'choose'});
    B.name=n;B.hidden=false;B.on=true;B.draft=null;keep();await publish(true);phase='idle';HWEvents.emit('board:joined',{});
    toast('🏆 Welcome to the Hall of Heroes, '+esc(n)+'!');await load(tab,true)}
  catch(e){B.on=false;keep();phase='idle';say('⚠️ '+esc(why(e))+' You have not joined; nothing was shared.')}};
acts.lbsave=async()=>{const[n,bad]=checkName(name());if(bad)return say('⚠️ '+esc(bad));const old=B.name;B.name=n;keep();
  try{await publish(true);say('🏆 Hero name saved.',1);load(tab,true)}catch(e){B.name=old;keep();say('⚠️ '+esc(why(e))+' Your name was not changed.')}};
acts.lbhide=async()=>{B.hidden=!B.hidden;keep();
  try{await publish(true);HWEvents.emit('board:updated',{hidden:B.hidden});say(B.hidden?'🕶️ Your name is now hidden from other players.':'🏆 Your hero name is shown again.',1);load(tab,true)}
  catch(e){B.hidden=!B.hidden;keep();say('⚠️ '+esc(why(e))+' Your privacy setting was not changed.')}};
acts.lbleave=async()=>{if(!arm){arm=1;return paint()}arm=0;const u=me();if(!u)return;
  try{await cloud().api('/rest/v1/hw_board?user_id=eq.'+encodeURIComponent(u),{method:'DELETE'});B.on=false;B.at=0;rows={};keep();HWEvents.emit('board:left',{});
    say('Left the Hall of Heroes. Your entry was removed from the server; your progress stays on this device.',1)}
  catch(e){say('⚠️ '+esc(why(e))+' You are still on the board.')}};
D.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='lbname'){e.preventDefault();(B.on?acts.lbsave:acts.lbjoin)()}});

/* ---------- triggers ---------- */
HWEvents.on('page:viewed',e=>{arm=0;note='';if(e.view==='quests'||e.view==='set'){err='';check().then(()=>{if(e.view==='quests')load(tab)})}});
HWEvents.on('cloud:synced',()=>{publish(false).then(ok=>{if(ok&&D.getElementById('v6lb'))load(tab,true)}).catch(e=>{if(e.code==='setup'){err=why(e);paint()}})});
HWEvents.on('cloud:signed-in',()=>{B={uid:me()};rows={};err='';keep();check()});
HWEvents.on('cloud:signed-out',()=>{B={};rows={};err='';arm=0;try{localStorage.removeItem(K)}catch(e){}paint()});
addEventListener('online',()=>paint());addEventListener('offline',()=>paint());

return{card,stats,checkName,status:()=>({on:B.on==null?null:!!B.on,name:B.name||null,hidden:!!B.hidden,tab,phase,error:err})}})();
