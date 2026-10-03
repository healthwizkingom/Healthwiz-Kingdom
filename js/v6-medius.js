/* v6: Medius reacts to what happens (master prompt §39–41, §97 step 9). Not part of the original.
   Medius already guides onboarding, the tutorial and the Wizard's Counsel AI chat — those are
   untouched. This adds short, event-driven speech bubbles: level-ups, badges, quests, new
   insights, kingdom changes, first logs, gentle-streak milestones, comebacks and a daily greeting.
   §40 personality: friendly, concise, playful, observant — never guilt, shame or diagnosis.
   §41 restraint: priorities, per-type cooldowns, a minimum gap, a daily limit, no repeated line
   on the same day, silence on the title screen / onboarding / tutorial.
   Modes (Settings): 2 Chatty · 1 Calm (default: important moments only) · 0 Off.
   State: st.md = {last:{type:ms}, day:{date:n}, seen:{key:date}, ms:{milestone:date}, log:[{t,at}]} (schema v6). */
const HWMedius=(()=>{
const md=()=>{const o=st.md&&typeof st.md==='object'?st.md:(st.md={});['last','day','seen','ms'].forEach(k=>{if(!o[k]||typeof o[k]!=='object')o[k]={}});if(!Array.isArray(o.log))o.log=[];return o};
const mode=()=>st.s.med==null?1:+st.s.med;
const GAP=8000,DAILY=12,CALM=50; // ms between bubbles · bubbles per day · minimum priority in Calm mode
const name=()=>(st.p&&st.p.name||'').trim()||'traveller';
const pick=a=>a[Math.floor(Math.random()*a.length)];
const REGION={water:'Water Valley',food:'Nutrition Village',sleep:'the Dream Realm',pulse:'Heartstone Hall',stair:'Stair Mountain',stress:'the Mind Forest',bmi:'Balance Tower'};
// type → {p: priority, cd: cooldown ms, line(payload) → text | null}
const R={
'level':{p:95,cd:0,line:e=>'By my beard, '+name()+'! Level '+e.level+' — thou art now a '+e.name+'!'},
'quests-all':{p:85,cd:0,line:()=>pick(['All five daily quests done! The kingdom sings thy name today.','Every daily quest complete. Even the castle cat is impressed.'])},
'quest-big':{p:75,cd:60e3,line:e=>(e.kind==='weekly'?'A weekly quest fulfilled: ':'Thy focus quest is done: ')+e.name+'. Well wrought!'},
'comeback':{p:80,cd:0,line:e=>'Welcome back, '+name()+'! '+e.gap+' days have passed, and nothing was lost. Shall we begin with a sip of water?'},
'milestone':{p:72,cd:0,line:e=>pick(['A gentle streak of '+e.days+' days! Steady as the old oak.',e.days+' days of care in a row — rest days and all. Splendid.'])},
'badge':{p:70,cd:90e3,line:e=>'A new badge for thy collection: '+e.name+' '+(e.icon||'')+'.'},
'kingdom':{p:65,cd:120e3,line:e=>e.to==='Flourishing'?e.name+' is flourishing! Flowers everywhere — I may need new robes.':e.name+' is now '+e.to.toLowerCase()+'. I can see it from my tower!'},
'insight':{p:60,cd:600e3,line:e=>'I noticed something in thy scrolls: '+e.insight.title.toLowerCase()+'. '+e.insight.action},
'first':{p:55,cd:0,line:e=>pick(['Thy first deed in '+REGION[e.c]+'! The region stirs awake.','Ah, '+REGION[e.c]+' remembers thee now. A fine beginning.'])},
'restored':{p:50,cd:0,line:()=>'Thy scrolls are restored from the backup. Every page accounted for.'},
'quest-daily':{p:40,cd:600e3,line:e=>'Quest done: '+e.name+'. On to the next adventure!'},
'greet':{p:30,cd:0,line:()=>{const h=new Date().getHours();return h<5?'Still awake, '+name()+'? The stars and I keep thee company. Rest soon.':h<12?'Good morning, '+name()+'! A fresh page in thy adventure.':h<18?'Good afternoon, '+name()+'. How fares the quest?':'Good evening, '+name()+'. A fine time to note the day\'s deeds.'}},
'log':{p:15,cd:1200e3,line:e=>pick(({water:['Splash! The well grows deeper.','Hydration noted. The Water Valley ripples with joy.'],food:['A meal recorded. The village cooks nod approvingly.','Noted in the great food ledger.'],sleep:['Rest logged. Even wizards need their sleep.','The Dream Realm thanks thee for the report.'],stair:['Up the mountain! Mind thy pace.','Step by step, the summit nears.'],stress:['Thank thee for checking in with thyself.','The Mind Forest listens. Well done for pausing.'],pulse:['The Heartstone glows in rhythm.','Pulse noted. Steady as a drum.'],bmi:['Noted at Balance Tower.']})[e.c]||['Noted!'])}};

let showing=null,pending=null,lastShown=0;
const quiet=()=>S.v==='welcome'||S.v==='onb'||!!document.getElementById('tut')||!!document.querySelector('.v6g');
function say(type,e){const r=R[type];if(!r||!mode())return false;if(pending&&pending.type===type)return false;if(mode()===1&&r.p<CALM)return false;
  const M=md(),now=Date.now(),d=today();if(r.cd&&M.last[type]&&now-M.last[type]<r.cd)return false;if((M.day[d]||0)>=DAILY&&r.p<90)return false;
  let text;try{text=r.line(e||{})}catch(err){return false}if(!text)return false;const key=type+':'+text;if(M.seen[key]===d)return false;
  const item={type,text,p:r.p,key};if(showing||quiet()||now-lastShown<GAP&&r.p<70){if(!pending||item.p>pending.p)pending=item;schedule();return true}
  show(item);return true}
let tm=null;function schedule(){clearTimeout(tm);tm=setTimeout(()=>{if(!pending)return;if(showing||quiet()){schedule();return}const it=pending;pending=null;show(it)},Math.max(1200,GAP-(Date.now()-lastShown)))}
HWUI.css('medius',`.v6md{position:fixed;right:10px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:66;display:flex;align-items:flex-end;gap:6px;max-width:min(340px,calc(100vw - 20px));cursor:pointer;animation:v6in .3s steps(3)}
.v6md img{width:56px;height:auto;image-rendering:pixelated;flex:0 0 auto;filter:drop-shadow(0 0 6px rgba(255,226,122,.5))}
.v6md p{margin:0;background:var(--pn);color:var(--ink);border:3px solid var(--ln);box-shadow:3px 3px 0 var(--ln);padding:8px 10px;font-size:13px;line-height:1.45}.v6md p b{display:block;font:7px/1.6 var(--fh);color:var(--vio)}
.v6md.out{opacity:0;transition:opacity .3s}@media(max-width:760px){.v6md{bottom:calc(84px + env(safe-area-inset-bottom,0px))}}@media(prefers-reduced-motion:reduce){.v6md{animation:none}}`);
function show(it){const M=md(),d=today();M.last[it.type]=Date.now();M.day[d]=(M.day[d]||0)+1;M.seen[it.key]=d;M.log.push({t:it.text,at:new Date().toISOString(),type:it.type});if(M.log.length>20)M.log.shift();
  Object.keys(M.day).forEach(k=>{if(k<rng(7)[0])delete M.day[k]});Object.keys(M.seen).forEach(k=>{if(M.seen[k]<rng(7)[0])delete M.seen[k]});save();
  const el=document.createElement('div');el.className='v6md';el.id='v6md';el.setAttribute('role','status');el.innerHTML='<img src="'+WIZ+'" alt=""><p><b>MEDIUS</b>'+esc(it.text)+'</p>';
  showing=el;lastShown=Date.now();let gone=0;const close=()=>{if(gone)return;gone=1;el.classList.add('out');setTimeout(()=>{el.remove();if(showing===el)showing=null;if(pending)schedule()},300)};el.onclick=close;setTimeout(close,6500);document.body.appendChild(el);
  HWEvents.emit('medius:said',{kind:it.type,text:it.text})}

/* event wiring */
const E=HWEvents.on;
E('level:up',e=>say('level',e));
E('quests:all-completed',()=>say('quests-all'));
E('quest:completed',e=>say(e.kind==='daily'?'quest-daily':'quest-big',e));
E('badge:unlocked',e=>setTimeout(()=>say('badge',e),4600)); // after the original badge popup
E('kingdom:state',e=>{if(e.up)say('kingdom',e)});
E('insight:new',e=>{if(e.insight.tone==='notice'||e.insight.tone==='good')say('insight',e)});
E('data:imported',e=>say(e.mode==='cloud'?'cloud':'restored'));
E('entry:added',e=>{const c=e.entry.c;if(st.e.filter(x=>x.c===c).length===1)say('first',{c});else say('log',{c});
  try{const g=HWStreaks.gentle().days,M=md();[3,7,14,30,60,100].forEach(n=>{if(g===n&&!M.ms[n]){M.ms[n]=today();save();say('milestone',{days:n})}})}catch(err){}});
E('app:ready',()=>{const ds=dys(),last=ds[ds.length-1],gap=last?Math.round((new Date(today()+'T12:00:00')-new Date(last+'T12:00:00'))/864e5):0,M=md();
  if(gap>=3)say('comeback',{gap});else if(M.last.greet==null||new Date(M.last.greet).toDateString()!==new Date().toDateString())say('greet')});
E('page:viewed',()=>{if(pending)schedule()});

/* settings: frequency control · guide: recent words */
acts.medm=d=>{st.s.med=+d.m;save();render();if(+d.m)toast('Medius: '+['','calm — only important moments','chatty — happy to comment'][+d.m])};
const setCard=()=>'<div class="card" id="v6medset"><h3>🧙 MEDIUS COMPANION</h3><div class="row">'+[[2,'Chatty'],[1,'Calm'],[0,'Off']].map(m=>'<button class="chip'+(mode()===m[0]?' on':'')+'" data-a="medm" data-m="'+m[0]+'" aria-pressed="'+(mode()===m[0])+'">'+m[1]+'</button>').join('')+'</div><small class="mut">Calm shows only important moments (level-ups, quests, milestones). Medius never scolds.</small></div>';
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k='<h2>⚙️ SETTINGS</h2>';return h.indexOf(k)>=0?h.replace(k,k+setCard()):h+setCard()}}
{const p=pages.guide;pages.guide=(...a)=>{const h=p(...a),L=md().log.slice(-5).reverse();return L.length?h+'<div class="card" id="v6medlog"><h3>📜 MEDIUS\'S RECENT WORDS</h3>'+L.map(x=>'<p>“'+esc(x.t)+'” <small class="mut">'+esc(x.at.slice(5,16).replace('T',' '))+'</small></p>').join('')+'</div>':h}}
/* §42 the Wizard's Counsel AI: replies come from supabase/functions/medius-chat (Gemini; the key stays on the server,
   the persona and safety rules are set there). Signed-in players only, with a daily allowance. Messages are never stored.
   ask() throws an Error with .code: signin · offline · limit · busy · nokey · blocked · ai, and askError() words it (§88). */
async function ask(msgs){const no=c=>Object.assign(new Error(c),{code:c});
  if(typeof HWCloud==='undefined'||!HWCloud.who())throw no('signin');
  if(navigator.onLine===false)throw no('offline');
  let d;try{d=await HWCloud.api('/functions/v1/medius-chat',{method:'POST',body:{name:name(),messages:msgs.map(m=>({role:m.role,content:m.content}))}})}
  catch(e){const k=String(e&&e.message);throw no(/^(limit|busy|nokey|blocked|signin)$/.test(k)?k:k==='setup'||(e&&e.code==='setup')?'nokey':e&&e.code==='net'?'offline':e&&e.code==='auth'?'signin':'ai')}
  const t=String(d&&d.reply||'').trim();if(!t)throw no('ai');return t}
const ASKERR={signin:'Medius\'s spellbook (the AI) opens for adventurers signed in to Cloud Save. Sign in under Settings → Cloud Save, then speak again.',
  offline:'You are offline, so Medius cannot reach his spellbook. Try again when you are back online.',
  limit:'Medius has listened to many words today: your daily allowance of messages is used up. He will be back tomorrow.',
  busy:'Many adventurers are speaking with Medius right now and his free spellbook needs a short rest. Please try again in a few minutes.',
  nokey:'Medius\'s spellbook is not set up on the server yet (the AI key is missing), so he cannot answer here.',
  blocked:'Medius could not answer that one. If you are having a hard time, tap “Need help now?” to reach a real person.',
  ai:'The candle flickers… Medius could not get an answer just now. Try again in a moment.'};
const askError=e=>'🕯️ '+(ASKERR[e&&e.code]||ASKERR.ai)+' Nothing you wrote was saved. Meanwhile: a few slow breaths, write your thoughts down, and if you need someone now, tap “Need help now?”.';
return{say,mode,rules:R,history:()=>md().log.slice(),ask,askError}})();
