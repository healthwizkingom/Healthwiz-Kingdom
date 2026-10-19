/* v6: the companion reacts to what happens (master prompt §39–41, §97 step 9). Not part of the original.
   Since the Luna update the bubbles are spoken by Luna, the apprentice witch (js/v6-luna.js draws her and her
   expressions); HWMedius keeps its name so the add-ons that register lines (games, cloud, offline) are unchanged.
   Medius still guides onboarding, the tutorial and the Wizard's Counsel AI chat — those are
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
'level':{p:95,cd:0,line:e=>'Level '+e.level+', '+name()+'! You are now a '+e.name+'. My staff is sparkling!'},
'quests-all':{p:85,cd:0,line:()=>pick(['All five daily quests done! That one goes in my spellbook.','Every daily quest complete. Even my familiar is doing a happy spin.'])},
'quest-big':{p:75,cd:60e3,line:e=>(e.kind==='weekly'?'Weekly quest complete: ':'Focus quest done: ')+e.name+'. Nicely done!'},
'comeback':{p:80,cd:0,line:e=>'Welcome back, '+name()+'! '+e.gap+' days have passed, and nothing was lost. Want to start with a glass of water?'},
'milestone':{p:72,cd:0,line:e=>pick(['A gentle streak of '+e.days+' days! Rest days count too.',e.days+' days of looking after yourself in a row. Lovely!'])},
'badge':{p:70,cd:90e3,line:e=>'Ooh, a new badge: '+e.name+' '+(e.icon||'')+'!'},
'kingdom':{p:65,cd:120e3,line:e=>e.to==='Flourishing'?e.name+' is flourishing! Flowers everywhere, look!':e.name+' is now '+e.to.toLowerCase()+'. I can see it changing from here!'},
'insight':{p:60,cd:600e3,line:e=>'I spotted something in your logs: '+e.insight.title.toLowerCase()+'. '+e.insight.action},
'first':{p:55,cd:0,line:e=>pick(['Your first entry in '+REGION[e.c]+'! The region is waking up.',REGION[e.c][0].toUpperCase()+REGION[e.c].slice(1)+' remembers you now. Great start!'])},
'restored':{p:50,cd:0,line:()=>'Your backup is restored. Every entry is back in place.'},
'quest-daily':{p:40,cd:600e3,line:e=>'Quest done: '+e.name+'. On to the next one!'},
'greet':{p:30,cd:0,line:()=>{const h=new Date().getHours();return h<5?'Still awake, '+name()+'? The stars and I will keep you company. Rest soon.':h<12?'Good morning, '+name()+'! A fresh page for today.':h<18?'Good afternoon, '+name()+'. How is your day going?':'Good evening, '+name()+'. A nice time to note down the day.'}},
'log':{p:15,cd:1200e3,line:e=>pick(({water:['Splash! Water logged.','Noted! The Water Valley ripples.'],food:['Meal logged. Thanks for noting it!','Added to your food log.'],sleep:['Rest logged. Even witches need their sleep.','The Dream Realm thanks you for the report.'],stair:['Up the mountain! Go at your own pace.','Step by step, the summit gets closer.'],stress:['Thanks for checking in with yourself.','The Mind Forest is listening. Good on you for pausing.'],pulse:['Heart rate logged. Thank you!','Pulse noted in Heartstone Hall.'],bmi:['Noted at Balance Tower.']})[e.c]||['Noted!'])}};
// Luna's face for each kind of bubble (js/v6-luna.js); `cast` makes her staff sparkle
const FACE={level:['cheerful',1],'quests-all':['cheerful',1],'quest-big':['encouraging'],comeback:['greet'],milestone:['encouraging',1],badge:['badge',1],
  kingdom:['cheerful'],insight:['insight'],first:['curious'],restored:['focused'],cloud:['focused'],'quest-daily':['encouraging'],greet:['greet'],log:['idle'],game:['cheerful'],offline:['apologetic']};

let showing=null,pending=null,lastShown=0;
const quiet=()=>S.v==='welcome'||S.v==='onb'||!!document.getElementById('tut')||!!document.querySelector('.v6g')||!(document.getElementById('mo')||{hidden:true}).hidden; // never over an open dialog
function say(type,e){const r=R[type];if(!r||!mode())return false;if(pending&&pending.type===type)return false;if(mode()===1&&r.p<CALM)return false;
  const M=md(),now=Date.now(),d=today();if(r.cd&&M.last[type]&&now-M.last[type]<r.cd)return false;if((M.day[d]||0)>=DAILY&&r.p<90)return false;
  let text;try{text=r.line(e||{})}catch(err){return false}if(!text)return false;const key=type+':'+text;if(M.seen[key]===d)return false;
  const item={type,text,p:r.p,key,c:e&&e.c};if(showing||quiet()||now-lastShown<GAP&&r.p<70){if(!pending||item.p>pending.p)pending=item;schedule();return true}
  show(item);return true}
let tm=null;function schedule(){clearTimeout(tm);tm=setTimeout(()=>{if(!pending)return;if(showing||quiet()){schedule();return}const it=pending;pending=null;show(it)},Math.max(1200,GAP-(Date.now()-lastShown)))}
HWUI.css('medius',`.v6md{position:fixed;right:10px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:66;display:flex;align-items:flex-end;gap:6px;max-width:min(340px,calc(100vw - 20px));cursor:pointer;animation:v6in .3s steps(3)}
.v6md .v6lav{flex:0 0 auto;padding:0;min-height:0;border:0;background:none;box-shadow:none;line-height:0;filter:drop-shadow(0 0 5px rgba(196,166,255,.55))}
.v6md.cp p{font-size:12px}.v6md .v6lav.pf{border:3px solid var(--ln);box-shadow:3px 3px 0 var(--ln);filter:none;background:var(--p2)}.v6md.cp{max-width:min(300px,calc(100vw - 20px))}
.v6md p{margin:0;background:var(--pn);color:var(--ink);border:3px solid var(--ln);box-shadow:3px 3px 0 var(--ln);padding:8px 10px;font-size:13px;line-height:1.45}.v6md p b{display:block;font:12px/1.6 var(--fl);color:var(--vio)}
.v6md.out{opacity:0;transition:opacity .3s}@media(max-width:760px){.v6md{bottom:calc(84px + env(safe-area-inset-bottom,0px))}}@media(prefers-reduced-motion:reduce){.v6md{animation:none}}`);
function show(it){const M=md(),d=today();M.last[it.type]=Date.now();M.day[d]=(M.day[d]||0)+1;M.seen[it.key]=d;M.log.push({t:it.text,at:new Date().toISOString(),type:it.type,who:'L'});if(M.log.length>20)M.log.shift();
  Object.keys(M.day).forEach(k=>{if(k<rng(7)[0])delete M.day[k]});Object.keys(M.seen).forEach(k=>{if(M.seen[k]<rng(7)[0])delete M.seen[k]});save();
  const el=document.createElement('div');el.className='v6md';el.id='v6md';el.setAttribute('role','status');const f=it.type==='log'&&it.c==='sleep'?['rest']:FACE[it.type]||['idle'],cp=HWLuna.compact();if(cp)el.classList.add('cp');
  el.innerHTML='<button type="button" class="v6lav" aria-label="Ask Luna for help"></button><p><b>LUNA</b>'+esc(it.text)+'</p>';if(cp){el.firstChild.innerHTML=HWLuna.portrait(f[0]);el.firstChild.classList.add('pf')}else HWLuna.mount(el.firstChild,{expr:f[0],cast:f[1],enter:1}); // compact: her portrait from the reference sheet
  showing=el;lastShown=Date.now();let gone=0;const close=()=>{if(gone)return;gone=1;el.classList.add('out');setTimeout(()=>{el.remove();if(showing===el)showing=null;if(pending)schedule()},300)};el.onclick=e=>{hush();close();if(e.target.closest('.v6lav'))HWLuna.open()};setTimeout(close,6500);document.body.appendChild(el);
  HWEvents.emit('medius:said',{kind:it.type,text:it.text})}

/* voice: the recorded lines only (assets/audio/tut-<hash>.mp3 for the tutorial, ob-<hash>.mp3 for the Traveller's Registry,
   cut by tools/audio/cut_medius_voice.py). There is no browser or synthetic speech: the speech bubbles above stay silent, and a
   line without a recording is simply not spoken. Settings: st.s.medv (1 on, default · 0 off). */
const vOn=()=>st.s.medv==null||+st.s.medv===1,canPlay=()=>typeof Audio!=='undefined';
let rec=null,vTok=0,recKind='',obLast=null;
function hush(){vTok++;recKind='';if(rec){try{rec.onended=rec.onerror=null;rec.pause()}catch(e){}rec=null}}
// name of a line's recording: a hash of its text, the same as tools/audio/cut_medius_voice.py, so an edited line never plays a stale file
const hashOf=t=>{let x=5381;for(const c of t)x=((x<<5)+x+c.charCodeAt(0))>>>0;return x.toString(36)};
/** Plays the recording of a line. `tmpl` is the line's text before {name} is filled in; `pre` is 'tut' (tutorial, default) or 'ob'
    (registry). Silent when voice is off, the line has no recording, or the browser blocks playback. */
function speak(text,tmpl,pre){if(!vOn()||!text||!tmpl||!canPlay())return;hush();
  const a=new Audio('assets/audio/'+(pre||'tut')+'-'+hashOf(tmpl)+'.mp3');rec=a;recKind=pre||'tut';
  const gone=()=>{if(rec===a)hush()};a.onerror=gone;try{const p=a.play();if(p&&p.catch)p.catch(gone)}catch(e){gone()}}
/** The registry's question on screen (#obt carries its text in data-t and its template in data-v). Re-renders of the same
    question (a chip tap, a validation message) do not restart the recording. */
function speakRegistry(){const p=document.getElementById('obt');if(!p||!p.dataset.v)return;const k=p.dataset.v;if(obLast&&obLast.o===S.ob&&obLast.k===k)return;obLast={o:S.ob,k};speak(p.dataset.t,p.dataset.v,'ob')}

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
E('page:viewed',()=>{if(recKind==='ob'&&S.v!=='onb')hush();if(pending)schedule()});

/* settings: Luna's card (how often, size, help style, reset) and Medius's voice · guide: recent words */
acts.medv=d=>{st.s.medv=+d.m;save();render();if(!+d.m)hush();toast('Medius voice: '+(+d.m?'on':'off'))};
acts.medm=d=>{st.s.med=+d.m;save();render();if(+d.m)toast('Luna: '+['','calm — only important moments','chatty — happy to comment'][+d.m])};
const chips=(L,on,a)=>L.map(m=>'<button class="chip'+(on===m[0]?' on':'')+'" data-a="'+a+'" data-m="'+m[0]+'" aria-pressed="'+(on===m[0])+'">'+m[1]+'</button>').join('');
const lunaCard=()=>'<div class="card" id="v6lunaset"><h3>✨ LUNA COMPANION</h3>'+
  '<p class="mut">How often Luna talks</p><div class="row">'+chips([[2,'Chatty'],[1,'Calm'],[0,'Off']],mode(),'medm')+'</div>'+
  '<p class="mut">Size</p><div class="row">'+chips([[0,'Full'],[1,'Compact']],HWLuna.compact()?1:0,'lunasz')+'</div>'+
  '<p class="mut">Help style in Ask Luna</p><div class="row">'+chips([['q','Quick'],['g','Guided'],['e','Explore']],HWLuna.style(),'lunast')+'</div>'+
  '<p class="mut">Meet Luna: every pose from her design sheet</p>'+HWLuna.meet()+
  '<div class="row"><button class="sm" data-a="luna">ASK LUNA</button><button class="g sm" data-a="lunarst">RESET LUNA\'S PREFERENCES</button></div>'+
  '<small class="mut">Calm shows only important moments (level-ups, quests, milestones). Luna never scolds. She remembers only these three choices, saved with your other settings (and in your cloud save if you sign in); nothing is sent anywhere.</small></div>';
const setCard=()=>lunaCard()+'<div class="card" id="v6medset"><h3>🧙 MEDIUS\'S VOICE</h3><div class="row">'+(canPlay()?chips([[1,'Voice on'],[0,'Voice off']],vOn()?1:0,'medv'):'<small class="mut">Voice is not available in this browser.</small>')+'</div>'+'<small class="mut">Medius, the Wizard King, narrates the tutorial and the Traveller\'s Registry.</small></div>';
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k='<h2>⚙️ SETTINGS</h2>';return h.indexOf(k)>=0?h.replace(k,k+setCard()):h+setCard()}}
// entries from before Luna (no `who`) were Medius's words
{const p=pages.guide;pages.guide=(...a)=>{const h=p(...a),L=md().log.slice(-5).reverse();return L.length?h+'<div class="card" id="v6medlog"><h3>📜 LUNA\'S RECENT WORDS</h3>'+L.map(x=>'<p>“'+esc(x.t)+'” <small class="mut">'+(x.who?'':'Medius · ')+esc(x.at.slice(5,16).replace('T',' '))+'</small></p>').join('')+'</div>':h}}
return{say,speak,speakRegistry,hush,mode,rules:R,history:()=>md().log.slice()}})();
