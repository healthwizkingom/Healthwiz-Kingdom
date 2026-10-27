/* v6: Luna, the apprentice witch, HealthWiz's friendly companion. Not part of the original.
   Luna speaks the event bubbles that Medius used to (js/v6-medius.js keeps the rules, cooldowns and limits). Medius
   stays the Wizard King: the tutorial, the Traveller's Registry, the Wizard's Counsel and the Health Orb are his.
   * Art (owner's request, 2026-10-23: her look is now the owner's 3D model "Spirit Blossom Kindred" by Retronous, CC BY 4.0,
     credited in Meet Luna; her name stays Luna): rendered in Blender in each of the gestures she had on the owner's earlier
     design sheets (tools/art/blender_luna_kindred.py, packed by tools/art/make_luna_kindred.py into the same files, sizes
     and orders as below; the raised-arm gestures keep the model's own pose with their expression), as pixel art drawn at
     whole-number scales:
       assets/img/luna-faces.webp  the twelve expression portraits, 64 x 64 each (tools/art/make_luna_faces.py), the heads of
                                   the sheets' expression figures: cheerful, curious, focused, thoughtful, surprised,
                                   encouraging, apologetic, laughing, shocked, sad, annoyed, neutral
       assets/img/luna-poses.webp  all twenty-one full-body figures, 80 x 120 frames, transparent (tools/art/make_luna_poses.py):
                                   idle (neutral), happy, laugh, excited, curious, think, focused, surprised, shocked, sad,
                                   apologetic, annoyed, cast, walk (reading), point, wave, rest, and the design views
                                   front, side, back, three (three-quarter)
       assets/img/luna-lab.webp    the Science Laboratory's larger Luna: idle, point, cast, walk, curious, wave, 160 x 240 frames
                                   (twice the size, cut from the same sheets by the same tool); drawn at 84 % of the scene's height
       assets/img/luna-props.webp  her things, five 48 x 48 tiles (tools/art/make_luna_props.py): staff, satchel, spirit cat
                                   sitting, spirit cat curled up, potion flasks
     The four views and her things appear in Meet Luna (Settings), which steps through all twenty-one poses.
     Where: the full figure in the bubble (full size) and in the Science Laboratory; the portrait for the moment's
     expression in the compact bubble, Ask Luna and Talk with Luna; the middle of a portrait (44 x 44) on the header button.
   * Motion is CSS only, from the sheet's own drawings: each moment picks a pose (POSEOF: a greeting waves, good news is
     "happy", a tip points, an insight thinks, a badge casts, an apology is "confused"); a bubble walks in with the walking
     pose and then changes to it; the Laboratory cycles idle, pointing, casting, reading, curious and waving; a slow 2-pixel float and
     twinkling sparkles, a sparkle burst for big moments ("cast"). In Talk with Luna her portrait follows the chat:
     curious while waiting for you, thoughtful while the reply is on its way, cheerful with a reply, apologetic on an
     error. Nothing moves with reduced motion or in the Performance mode (the pose itself still shows); no timers.
   * Ask Luna (HWLuna.open): a panel with no AI. It finds features (names and the trackers' own header text from
     js/v6-hall.js) and opens the "?" explanations already on the page (js/v6-help.js), pointing at each one. It never
     reads or changes saved entries and sends nothing anywhere.
   * Talk with Luna (in the same panel) takes place in her room (assets/img/luna-room.webp), where her full figure waves
     while waiting, reads her spellbook while a reply is on its way, cheers with a reply and looks apologetic on an error.
     It works like this: signed-in players chat with Luna through the luna-chat Edge Function
     (supabase/functions/luna-chat: Google Gemini, the same key and model as Medius, with her persona and safety rules on the server; the key never reaches
     the app). Only the conversation typed here is sent, never saved entries. It lives in memory for this visit and
     is not saved or synced. Signed out, the panel says "Sign in to talk with Luna". The crisis numbers show when the
     player writes crisis words or the reply carries the help flag (the same rule as the Wizard's Counsel).
   * Preferences (Settings): help style st.s.lst ('q' Quick · 'g' Guided, default · 'e' Explore), size st.s.lsz
     (0 full · 1 compact portrait) and how often she talks (st.s.med, unchanged: 2 Chatty · 1 Calm · 0 Off).
     Missing keys mean the defaults, so older saves need no migration. RESET puts all three back. */
const HWLuna=(()=>{
const NAMES=['cheerful','curious','focused','thoughtful','surprised','encouraging','apologetic','laughing','shocked','sad','annoyed','neutral'];   // luna-faces.webp, in this order
const FACES='assets/img/luna-faces.webp',POSE_IMG='assets/img/luna-poses.webp',LAB_IMG='assets/img/luna-lab.webp',ROOM='assets/img/luna-room.webp',PROPS_IMG='assets/img/luna-props.webp',FS=64,PW=80,PH=120,LW=160,LH=240;
const LABP=['idle','point','cast','walk','curious','wave'];   // the Laboratory's larger sheet (luna-lab.webp, 120 x 180 frames), in this order
const POSES=['idle','happy','laugh','excited','curious','think','focused','surprised','shocked','sad','apologetic','annoyed','cast','walk','point','wave','rest','front','side','back','three'];   // every figure on the design sheets, in luna-poses.webp
const TURN=['front','side','back','three'];   // the design views: shown only in Meet Luna (Settings)
const POSENAME={idle:'Neutral',happy:'Happy',laugh:'Laughing',excited:'Excited',curious:'Curious',think:'Thinking',focused:'Focused',surprised:'Surprised',shocked:'Shocked',sad:'Sad',apologetic:'Apologetic',annoyed:'Annoyed',cast:'Casting a spell',walk:'Walking and reading',point:'Pointing',wave:'Waving',rest:'Resting',front:'Front view',side:'Side view',back:'Back view',three:'Three-quarter view'};
// her things, from the props sheet (luna-props.webp: five 48 x 48 tiles, in this order)
const PROPS=[['staff','Wooden staff'],['satchel','Leather satchel'],['cat','Spirit cat, sitting'],['curled','Spirit cat, curled up'],['flasks','Potion flasks']];
// moment → pose: a greeting waves, good news is happy, a first step is curious, a thought is thinking, an insight points at the chart,
// a badge is a spell (cast), a milestone is excited, an apology is apologetic, a sleep log is a rest, focus holds the staff;
// laughing, shocked, sad and annoyed are there for her moods
const POSEOF={idle:'idle',greet:'wave',cheerful:'happy',curious:'curious',focused:'focused',thoughtful:'think',surprised:'surprised',encouraging:'excited',apologetic:'apologetic',laughing:'laugh',shocked:'shocked',sad:'sad',annoyed:'annoyed',neutral:'idle',badge:'cast',insight:'point',rest:'rest'};
const poseOf=(p,expr)=>POSES.includes(p)?p:POSEOF[expr]||'idle';
const at=p=>(POSES.indexOf(p)/(POSES.length-1)*100).toFixed(4)+'%'; // the frame's background-position (the same at every scale)
const FACEOF={idle:'neutral',greet:'cheerful',badge:'surprised',insight:'thoughtful',rest:'neutral'}; // moments without their own portrait use the nearest one
const faceOf=e=>{const n=FACEOF[e]||e;return NAMES.includes(n)?n:'neutral'};
/** A 64 x 64 portrait (whole-number scale s, default 1) with the expression's face from the reference sheet. */
function portrait(expr,s){s=s||1;const n=faceOf(expr),i=NAMES.indexOf(n),w=FS*s;
  return '<span class="v6lpf" role="img" aria-label="Luna, '+n+'" style="width:'+w+'px;height:'+w+'px;background-size:'+(w*NAMES.length)+'px '+w+'px;background-position:'+(-i*w)+'px 0" data-face="'+n+'"></span>'}
/** A portrait scaled to the 44 x 44 header button: the whole head (the old crop cut her head halfway), drawn smooth. */
function mini(expr){const n=faceOf(expr),i=NAMES.indexOf(n);
  return '<span class="v6lmini" aria-hidden="true" style="background-position:'+(-i*40)+'px 0" data-face="'+n+'"></span>'}
/** Her upper body (head to waist) from the full-figure sheet, cropped and enlarged, drawn smooth: the Ask Luna picture. */
function bust(expr){const p=poseOf(null,expr);
  return '<span class="v6lbust" role="img" aria-label="Luna" data-pose="'+p+'" style="background-position:'+at(p)+' 0"></span>'}
/** Her full figure (80 x 120 at scale s) in a pose from the design sheet (o.pose, else the pose for o.expr), with sparkles.
    o.cast adds a sparkle burst; o.enter walks her in first (the walking pose, then the chosen one); o.cycle is the
    Laboratory's slow loop of idle, pointing, casting, reading, curious and waving. */
function full(o){o=o||{};const s=o.scale||1,p=poseOf(o.pose,o.expr);
  if(o.sheet==='lab'){const q=LABP.includes(p)?p:'idle',x=(LABP.indexOf(q)/(LABP.length-1)*100).toFixed(4)+'%';   // the larger Laboratory figure (1.5 times the size)
    return '<span class="v6lfull lab'+(o.cycle?' cycle':'')+'" aria-hidden="true" data-pose="'+q+'" style="width:'+LW*s+'px;height:'+LH*s+'px">'
      +'<span class="v6laura" aria-hidden="true"></span><span class="v6lrune" aria-hidden="true"></span>'
      +'<span class="v6lfi" style="background-size:'+LABP.length*100+'% 100%;background-position:'+x+' 0"></span>'
      +'<i class="v6ls s1"></i><i class="v6ls s2"></i><i class="v6ls s3"></i><i class="v6ls s4"></i><i class="v6ls s5"></i></span>'}
  return '<span class="v6lfull'+(o.cast?' cast':'')+(o.enter?' enter':'')+(o.cycle?' cycle':'')+'" aria-hidden="true" data-pose="'+p+'" style="width:'+PW*s+'px;height:'+PH*s+'px">'
    +'<span class="v6laura" aria-hidden="true"></span>'
    +'<span class="v6lfi" style="background-size:'+PW*s*POSES.length+'px '+PH*s+'px;background-position:'+at(p)+' 0;--px:'+at(p)+'"></span>'
    +'<i class="v6ls s1"></i><i class="v6ls s2"></i><i class="v6ls s3"></i><i class="v6ls s4"></i><i class="v6ls s5"></i></span>'}
/** Changes a mounted figure's pose (el: the .v6lfull element). */
function pose(el,p){if(!el||!POSES.includes(p))return;el.dataset.pose=p;const i=el.querySelector('.v6lfi');if(i){i.style.backgroundPosition=at(p)+' 0';i.style.setProperty('--px',at(p))}}
/** Puts Luna in `host`: o.kind 'full' (default), 'face' (portrait) or 'mini'; o.expr picks the portrait. Returns the element. */
function mount(host,o){o=o||{};const k=o.kind||(o.compact==='face'?'mini':o.compact?'face':'full');
  host.insertAdjacentHTML('beforeend',k==='mini'?mini(o.expr):k==='face'?portrait(o.expr,o.scale):full(o));return host.lastElementChild}

/* ---------- preferences ---------- */
const style=()=>['q','g','e'].includes(st.s.lst)?st.s.lst:'g';
const compact=()=>+st.s.lsz===1;

/* ---------- Meet Luna (Settings): the design sheet's figures one at a time, front, side and back views included ---------- */
const MEET={i:0},PROPS_N=PROPS.length;
const meetCap=p=>'<b>'+POSENAME[p]+'</b> <span class="mut">'+(POSES.indexOf(p)+1)+' of '+POSES.length+'</span>';
function meet(){const p=POSES[MEET.i];
  return '<div class="v6lmeet" id="v6lmeet"><div class="v6lmst">'+full({pose:p,scale:2})+'</div><p class="v6lmcap" aria-live="polite">'+meetCap(p)+'</p>'
    +'<div class="row"><button type="button" class="sm" data-a="lunameet" data-d="-1" aria-label="Previous pose">PREV</button><button type="button" class="sm" data-a="lunameet" data-d="1" aria-label="Next pose">NEXT</button></div>'
    +'<p class="mut v6lcred"><small>Luna\'s look: "Spirit Blossom Kindred" (sketchfab.com/3d-models/spirit-blossom-kindred-85187f9f246f4702b7c137dcc6c0fc12) by Retronous, CC BY 4.0, rendered as pixel art.</small></p>'
    +'<p class="mut v6lpt2">Her things</p><ul class="v6lprops">'+PROPS.map((q,i)=>'<li><span class="v6lprop" role="img" aria-label="'+q[1]+'" data-prop="'+q[0]+'" style="background-position:'+(-i*96)+'px 0"></span><small>'+q[1]+'</small></li>').join('')+'</ul></div>'}
acts.lunameet=d=>{MEET.i=(MEET.i+(+d.d)+POSES.length)%POSES.length;const m=$('#v6lmeet');if(!m)return;const p=POSES[MEET.i];pose(m.querySelector('.v6lfull'),p);m.querySelector('.v6lmcap').innerHTML=meetCap(p)};

/* ---------- Ask Luna ---------- */
// Features she can find: [route, icon, name, search words, what it is, how to start]. Trackers with a shared header
// (js/v6-hall.js) use that header's text instead of the last two.
const FEAT=[
['water','water','Water log','water drink hydration glass ml thirsty'],
['food','food','Food log','food meal eat calories kcal nutrition breakfast lunch dinner snack menu'],
['sleep','sleep','Sleep log','sleep bed wake rest alarm dream tired'],
['stair','stairs','Stairs & workout','stairs steps climb workout gps stair sense gravity plan schedule week rest'],
['pulse','pulse','Heart rate','heart rate pulse bpm camera watch strap recovery','Your heart-rate logs: before and after activity.','Count by hand, use the camera or connect a heart-rate strap, then LOG BPM.'],
['stress','stress','Stress check-in','stress mood calm breathe relax worried counsel medius chat grove'],
['body','balance','Body & Energy','bmi weight height energy target macros protein forge'],
['score','achievement','Health Score','score what-if simulator orb recommendations','One 0 to 100 score built from five areas of what you logged.','Open it to see each area and try the What-if simulator.'],
['exercise','workout','Training Hall','exercise training muscle moves calisthenics gym','Pick a goal, then a muscle and a move with its tutorial.','Choose a goal first; Running Road is further down.'],
['run','running','Running Road','run running jog gps pace distance','A GPS run tracker: distance, moving time and pace.','Tap START before you set off; it needs location permission.'],
['lab','flask','Science Laboratory','lab laboratory experiment science evidence vault trial uncertainty sources research test question','Test your own questions with your logs, the Evidence Trial, the Evidence Vault of sources, and how sure each estimate is.','Pick a question: HealthWiz uses what you already log.'],
['campus','map','Campus Health Observatory','campus map observatory stairways nearest location gps weather haze air','The campus stairways on a map (unverified locations), the nearest one to you, and the air outside.','Tap a marker, or SHOW WHERE I AM.'],
['time','alarm','Health Time Machine','time machine timeline history past day week month compare scrub','Everything you saved on one timeline: slide back through days, weeks and months.','Pick Day, Week or Month, then slide or tap EARLIER.'],
['stats','chart','Statistics','stats statistics charts trends history report weekly chronicle','Charts of everything you logged, by day, week or month.','Pick a range; the weekly report is at the top.'],
['alchemy','scroll','Alchemist\'s Workshop','alchemy energy food work physics joules','Food energy compared with the work of climbing stairs (a simulation).','Pick a food and a climb to compare.'],
['guide','scroll','HealthWiz guide','guide insights tips patterns notice','Patterns from your own logs, and Luna\'s recent words.','Log for a few days; insights appear as patterns show up.'],
['quests','quest','Quest Board','quests daily weekly xp level rewards','Today\'s quests, weekly quests and your level.','Each logged habit moves a quest forward.'],
['badges','badge','Badge Hall','badges achievements medals collection','Every badge, earned or still to find.','Badges come from logging and games.'],
['kingdom','map','Kingdom map','kingdom map regions world','The eight regions and how each is doing.','Tap a region to see what restores it.'],
['set','gear','Settings','settings backup restore theme music account sign in cloud export delete luna medius','Backup, themes, sound, account and Luna.','Backup and restore are near the top.']];
const H_=()=>typeof HWHall!=='undefined'&&HWHall.heads||{};
const featText=f=>{const h=H_()[f[0]];return h?{what:h.what,how:h.enter,why:h.why,tag:h.kind==='est'?'ESTIMATES':'ENTERED BY YOU'}:{what:f[4],how:f[5]}};
function find(q){q=String(q||'').toLowerCase().trim();if(!q)return FEAT.slice(0,8);const w=q.split(/\s+/);
  return FEAT.map(f=>{const hay=(f[2]+' '+f[3]).toLowerCase();return{f,n:w.filter(x=>hay.includes(x)).length}}).filter(x=>x.n).sort((a,b)=>b.n-a.n).map(x=>x.f)}
const helps=()=>[...document.querySelectorAll('#main .hwh')].filter(b=>b.offsetParent!==null);
const helpName=b=>(b.getAttribute('aria-label')||'').replace(/^About:?\s*/,'')||'Explanation';
function results(q){const s=style(),L=find(q);if(!L.length)return '<p class="mut">No page matches that yet. Try a word such as water, sleep or stairs.</p>';
  return L.map(f=>{const t=featText(f);return '<div class="v6lf"><span class="v6lfi">'+HWPixel.icon(f[1],2)+'</span><div><b>'+esc(f[2])+(t.tag&&s==='e'?' <span class="pxtag">'+t.tag+'</span>':'')+'</b>'+
    (s!=='q'&&t.what?'<small>'+esc(t.what)+'</small>':'')+(s!=='q'&&t.how?'<small><i>Start:</i> '+esc(t.how)+'</small>':'')+(s==='e'&&t.why?'<small><i>Why:</i> '+esc(t.why)+'</small>':'')+
    '</div><button class="g sm" data-a="lunago" data-v="'+f[0]+'" aria-label="Open '+esc(f[2])+'">GO</button></div>'}).join('')}
function sheet(q){const s=style(),H2=helps(),n=(BN[S.v]||[])[1]||'this page';
  return '<div class="card v6lp" role="dialog" aria-modal="true" aria-labelledby="v6lpt"><div class="v6lph"><span class="v6lpic"></span><div><h3 id="v6lpt">ASK LUNA</h3>'+
  '<small>I find pages and open the explanations already in HealthWiz. I don\'t read or change your entries, and I\'m not a doctor.</small></div></div>'+
  '<div id="v6lchat">'+chat()+'</div>'+
  '<div class="row" role="group" aria-label="How much help">'+[['q','Quick'],['g','Guided'],['e','Explore']].map(m=>'<button class="chip'+(s===m[0]?' on':'')+'" data-a="lunast" data-m="'+m[0]+'" aria-pressed="'+(s===m[0])+'">'+m[1]+'</button>').join('')+'</div>'+
  '<label for="v6lq"><b>Find a feature</b></label><input id="v6lq" type="search" autocomplete="off" value="'+esc(q||'')+'" aria-describedby="v6lqx v6lres"><small class="mut" id="v6lqx">Example: water, sleep, heart rate</small>'+
  '<div id="v6lres" aria-live="polite">'+results(q)+'</div>'+
  '<h4>Explanations on '+esc(n)+'</h4>'+(H2.length?'<div class="v6lh">'+H2.map((b,i)=>'<button class="chip" data-a="lunahelp" data-i="'+i+'">? '+esc(helpName(b))+'</button>').join('')+'</div>':
    '<p class="mut">This page has no "?" explanations. Calculations such as calories, Health Score and BMI have one beside them.</p>')+
  (s!=='q'?'<div class="row"><button class="g sm" data-a="lunatour">SHOW ME AROUND</button></div><small class="mut">The tour is narrated by Medius, the Wizard King.</small>':'')+
  '<div class="row"><button data-a="mclose">CLOSE</button></div></div>'}
/* ---------- Talk with Luna (AI through the luna-chat Edge Function) ---------- */
const CL=()=>typeof HWCloud!=='undefined'?HWCloud:null;
const CH={m:[],busy:0,err:'',help:0};   // this visit only: never saved or synced
const crisisWords=t=>typeof CRISIS!=='undefined'&&CRISIS.test(t);
const signed=()=>{const c=CL();return!!(c&&c.who())};
const lerr=(code,x)=>Object.assign(new Error(code),{code},x||{});
async function talk(msgs){const c=CL();
  if(!c||!c.who())throw lerr('signin');
  if(navigator.onLine===false)throw lerr('offline');
  const name=((st.p&&st.p.name)||'').trim().slice(0,20)||'traveller';
  let d;try{d=await c.api('/functions/v1/luna-chat',{method:'POST',body:{name,messages:msgs.map(m=>({role:m.role,content:m.content}))},ms:30000})}
  catch(e){const b=e.body||{};
    throw e.code==='net'?lerr('offline'):e.status===429&&b.error==='limit'?lerr('limit',{scope:b.scope,retry:+b.retry||0}):e.status===401||e.code==='auth'?lerr('signin')
      :b.error==='busy'?lerr('busy'):b.error==='nokey'||b.error==='setup'||e.code==='setup'?lerr('nokey'):lerr('ai')}
  const text=String((d&&d.reply)||'').trim();if(!text)throw lerr('ai');
  return{text,help:!!(d&&d.help)}}
const mn=s=>Math.max(1,Math.round(s/60));
function talkError(e){const k=e&&e.code;
  if(k==='limit')return e.scope==='day'?'Luna has chatted a lot today and is resting her wand. Try again in about '+(e.retry>5400?Math.max(1,Math.round(e.retry/3600))+' hours':mn(e.retry)+' minutes')+'.'
    :'Luna needs a short rest. Try again in about '+mn(e.retry||600)+' minute'+(mn(e.retry||600)===1?'':'s')+'.';
  return{signin:'Sign in to talk with Luna.',offline:'You are offline, so Luna cannot reach her spellbook. Try again when you are back online.',
    busy:'Many adventurers are talking with Luna right now. Please try again in a few minutes.',
    nokey:'Luna\'s spellbook is not set up on the server yet, so she cannot answer here.'}[k]||'Luna could not find an answer just now. Try again in a moment.'}
// Talk with Luna happens in her room (assets/img/luna-room.webp, from the owner's scene, tools/art/make_luke.py):
// her full figure stands in it, and her pose and face follow the chat
const MOODPOSE={curious:'wave',thoughtful:'think',cheerful:'happy',apologetic:'apologetic'};   // waits and waves; thinks while a reply is on its way
function room(mood){return '<div class="v6lroom" data-face="'+mood+'"><img src="'+ROOM+'" alt="" width="336" height="189" class="v6lrbg">'+full({pose:MOODPOSE[mood]||'idle'})+'</div>'}
function helpBox(){return typeof HWCounsel!=='undefined'?HWCounsel.help(true):''}
function chat(){
  const note='<small class="mut v6lcn">Luna\'s replies are written by an AI (Google Gemini). She is not a doctor and can be wrong. What you type here is sent to Google to write her reply; HealthWiz does not save it.</small>';
  if(!signed())return '<h4>TALK WITH LUNA</h4>'+room('curious')+'<div class="v6lco">'+HWPixel.icon('lock',1)+'<div><b>Sign in to talk with Luna</b><p>An account lets Luna chat with you. Finding features below works without one.</p>'
    +'<button data-a="lunasign">SIGN IN TO TALK WITH LUNA</button></div></div>'+note;
  const log=CH.m.length?CH.m.map(m=>'<div class="v6lcm '+(m.role==='user'?'u':'a')+'"><b>'+(m.role==='user'?'You':'Luna')+'</b><span>'+esc(m.content)+'</span></div>').join('')
    :'<p class="mut">Say hello, or ask about a habit, a feature or your day.</p>';
  const last=CH.m[CH.m.length-1],mood=CH.busy?'thoughtful':CH.err?'apologetic':last&&last.role==='assistant'?'cheerful':'curious';
  return '<h4>TALK WITH LUNA</h4>'+room(mood)+'<div class="v6lchd">'+portrait(mood)+note+'</div><div class="v6lclog" id="v6lclog" role="log" aria-live="polite" aria-label="Conversation with Luna">'+log+
    (CH.busy?'<p class="mut v6lcb">Luna is thinking...</p>':'')+'</div>'+
    (CH.err?'<p class="v6lce" role="alert">'+esc(CH.err)+' Nothing you wrote was saved.</p>':'')+
    (CH.help?helpBox():'')+
    '<div class="v6lcf"><label for="v6lcin" class="cssr">Message to Luna</label><input id="v6lcin" type="text" maxlength="1500" autocomplete="off" placeholder="Message Luna"'+(CH.busy?' disabled':'')+'>'+
    '<button data-a="lunasend"'+(CH.busy?' disabled':'')+'>SEND</button></div>'+
    (CH.m.length?'<button class="g sm" data-a="lunaclear">CLEAR CHAT</button>':'')}
function paintChat(focus){const el=$('#mo #v6lchat');if(!el)return;const i=el.querySelector('#v6lcin'),v=i?i.value:'';el.innerHTML=chat();
  const j=el.querySelector('#v6lcin');if(j){j.value=v;j.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();acts.lunasend()}};if(focus)j.focus()}
  const lg=el.querySelector('#v6lclog');if(lg)lg.scrollTop=lg.scrollHeight}
acts.lunasend=async()=>{const i=$('#mo #v6lcin');const t=i?i.value.trim():'';if(!t||CH.busy)return;
  CH.m.push({role:'user',content:t.slice(0,1500)});CH.err='';if(crisisWords(t))CH.help=1;CH.busy=1;i.value='';paintChat();
  try{const r=await talk(CH.m.slice(-30));CH.m.push({role:'assistant',content:r.text});if(r.help)CH.help=1}
  catch(e){CH.m.pop();CH.err=talkError(e);if(i)i.value=t}
  CH.busy=0;paintChat(1);const j=$('#mo #v6lcin');if(j&&CH.err&&!j.value)j.value=t};
acts.lunaclear=()=>{CH.m=[];CH.err='';CH.help=0;paintChat(1)};
acts.lunasign=()=>{close();if(typeof HWAccount!=='undefined')HWAccount.open(()=>open())};
HWEvents.on('cloud:signed-in',()=>paintChat());
HWEvents.on('cloud:signed-out',()=>{CH.m=[];CH.err='';CH.help=0;paintChat()});
let opened=0;
function open(q){const m=$('#mo');if(!m||!m.hidden&&!m.querySelector('.v6lp'))return; // never over another open dialog
  m.innerHTML=sheet(q);m.hidden=false;opened=1;m.querySelector('.v6lpic').innerHTML=bust('cheerful');
  const i=m.querySelector('#v6lq');if(i){i.oninput=()=>{const r=m.querySelector('#v6lres');if(r)r.innerHTML=results(i.value);const x=m.querySelector('#v6lqx');if(x)x.hidden=!!i.value};if(q)i.dispatchEvent(new Event('input'))}
  paintChat();
  HWEvents.emit('luna:opened',{view:S.v})}
function close(){const m=$('#mo');if(m&&m.querySelector('.v6lp')){m.hidden=true;m.innerHTML=''}}
acts.luna=()=>open();
acts.lunast=d=>{st.s.lst=d.m;save();const q=($('#v6lq')||{}).value||'';if($('#mo .v6lp')){open(q);const b=$('#mo [data-a="lunast"][data-m="'+d.m+'"]');if(b)b.focus()}else render()};
acts.lunago=d=>{close();go(d.v)};
acts.lunatour=()=>{close();go('tut')};
// Points at a "?" on the page: scrolls to it, marks it, then opens its explanation.
acts.lunahelp=d=>{const b=helps()[+d.i];close();if(!b)return;b.scrollIntoView({block:'center',behavior:HWUI.reduced()?'auto':'smooth'});b.classList.add('v6lpt');
  setTimeout(()=>b.classList.remove('v6lpt'),2600);setTimeout(()=>{if(b.isConnected&&typeof HWHelp!=='undefined')HWHelp.open(b)},style()==='q'?0:450)};
acts.lunasz=d=>{st.s.lsz=+d.m;save();render();toast('Luna: '+(+d.m?'compact portrait':'full size'))};
acts.lunarst=()=>{delete st.s.lst;delete st.s.lsz;st.s.med=1;save();render();toast('Luna\'s preferences are back to the defaults.')};

/* ---------- a button that opens Ask Luna: the Home bar, and the header of every other page ---------- */
const btn=()=>'<button type="button" class="g v6lb" data-a="luna" aria-label="Ask Luna for help" title="Ask Luna"></button>';
function launcher(){if(S.v==='welcome'||S.v==='onb')return;const m=$('#main');if(!m||m.querySelector('.v6lb'))return;
  const hb=m.querySelector('.hbar>button'),hd=m.querySelector('header');let b=null;
  if(hb){hb.insertAdjacentHTML('beforebegin',btn());b=hb.previousElementSibling}else if(hd){hd.insertAdjacentHTML('beforeend',btn());b=hd.lastElementChild}
  if(b)mount(b,{kind:'mini',expr:'cheerful'})}
{const r=render;render=function(){const x=r.apply(this,arguments);try{launcher()}catch(e){}return x}}

HWUI.css('luna',`
.v6lpf,.v6lmini{display:block;background-image:url(${FACES});background-repeat:no-repeat;image-rendering:pixelated;image-rendering:crisp-edges}
.v6lmini{width:40px;height:40px;border-radius:50%;background-size:${40*NAMES.length}px 40px;image-rendering:auto;transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
.v6lfull{position:relative;display:inline-block;line-height:0;transform-origin:bottom center;animation:animeLunaIdle 3.8s ease-in-out infinite}
@keyframes animeLunaIdle{
  0%{transform:translateY(0) scale(1,1) rotate(0deg)}
  32%{transform:translateY(-3.5px) scale(1.02,1.028) rotate(0.6deg)}
  68%{transform:translateY(-1.2px) scale(0.992,1.012) rotate(-0.5deg)}
  100%{transform:translateY(0) scale(1,1) rotate(0deg)}
}
.v6lfull .v6lfi{display:block;width:100%;height:100%;background-image:url(${POSE_IMG});background-repeat:no-repeat;image-rendering:pixelated;image-rendering:crisp-edges;
  filter:drop-shadow(0 0 8px rgba(168,85,247,.65)) drop-shadow(0 0 2px rgba(56,189,248,.55));transition:filter .3s ease}   /* the palette stays the artist's: only a glow is added */
.v6lfull.enter .v6lfi{animation:v6lwalk .9s steps(1) both}
@keyframes v6lwalk{0%{background-position:${at('walk')} 0;transform:translateX(18px)}33%{background-position:${at('walk')} 0;transform:translateX(9px)}66%{background-position:${at('walk')} 0;transform:translateX(0)}100%{background-position:var(--px) 0}}
.v6lfull.cycle .v6lfi{animation:v6lcyc 16s steps(1) infinite}
@keyframes v6lcyc{
  0%,43%{background-position:${at('idle')} 0}
  44%{transform:scale(0.97,0.96) translateY(2px)}
  45.01%,58%{background-position:${at('cast')} 0;transform:scale(1.02,1.03) translateY(-2px)}
  59%{transform:scale(0.97,0.96) translateY(2px)}
  60.01%,73%{background-position:${at('point')} 0;transform:scale(1.02,1.03) translateY(-2px)}
  74%{transform:scale(0.97,0.96) translateY(2px)}
  75.01%,88%{background-position:${at('curious')} 0;transform:scale(1.02,1.03) translateY(-2px)}
  89%{transform:scale(0.97,0.96) translateY(2px)}
  90.01%,100%{background-position:${at('idle')} 0}
}
.v6lfull.lab .v6lfi{background-image:url(${LAB_IMG})}
.v6lfull.lab.cycle .v6lfi{animation:v6lcycl 16s steps(1) infinite}
@keyframes v6lcycl{
  0%,31%{background-position:0% 0}
  32%{transform:scale(0.97,0.96) translateY(2px)}
  33%,45%{background-position:20% 0;transform:scale(1.02,1.03) translateY(-2px)}
  46%{transform:scale(0.97,0.96) translateY(2px)}
  47%,59%{background-position:40% 0;transform:scale(1.02,1.03) translateY(-2px)}
  60%{transform:scale(0.97,0.96) translateY(2px)}
  61%,73%{background-position:60% 0;transform:scale(1.02,1.03) translateY(-2px)}
  74%{transform:scale(0.97,0.96) translateY(2px)}
  75%,87%{background-position:80% 0;transform:scale(1.02,1.03) translateY(-2px)}
  88%{transform:scale(0.97,0.96) translateY(2px)}
  89%,99%{background-position:100% 0;transform:scale(1.02,1.03) translateY(-2px)}
  100%{background-position:0% 0}
}
/* Anime magical witch halo */
.v6laura{position:absolute;left:50%;top:22%;width:120px;height:120px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(168,85,247,.45) 0%,rgba(56,189,248,.2) 48%,transparent 70%);mix-blend-mode:screen;pointer-events:none;animation:animeAuraPulse 4.5s ease-in-out infinite alternate}
@keyframes animeAuraPulse{0%{opacity:.5;transform:translate(-50%,-50%) scale(.92) rotate(0deg)}100%{opacity:.95;transform:translate(-50%,-50%) scale(1.16) rotate(180deg)}}
/* Rotating alchemical magic circle on the floor */
.v6lrune{position:absolute;left:50%;bottom:-2px;width:96px;height:22px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(ellipse at 50% 50%,rgba(56,189,248,.5) 0%,rgba(168,85,247,.3) 50%,transparent 75%);border:1px dashed rgba(246,201,79,.75);box-shadow:0 0 14px 2px rgba(56,189,248,.45);pointer-events:none;animation:animeRuneSpin 10s linear infinite}
@keyframes animeRuneSpin{0%{transform:translateX(-50%) rotate(0deg)}100%{transform:translateX(-50%) rotate(360deg)}}
/* Detailed 4-point anime star glints */
.v6ls{position:absolute;width:8px;height:8px;background:#fff;clip-path:polygon(50% 0%,63% 37%,100% 50%,63% 63%,50% 100%,37% 63%,0% 50%,37% 37%);box-shadow:0 0 8px #ffe066,0 0 4px #fff;opacity:0;z-index:3;animation:animeStarGlint 2.8s ease-in-out infinite}
.v6ls.s1{left:10%;top:8%;animation-delay:0s;transform:scale(1.1)}
.v6ls.s2{left:4%;top:22%;animation-delay:.9s;background:#c4fff7;box-shadow:0 0 8px #63e6dc;transform:scale(.9)}
.v6ls.s3{left:32%;top:4%;animation-delay:1.7s;transform:scale(1.2)}
.v6ls.s4{right:8%;top:32%;animation-delay:2.3s;background:#ffd76a;transform:scale(1)}
.v6ls.s5{right:18%;top:12%;animation-delay:1.2s;background:#e0c8ff;box-shadow:0 0 8px #a855f7;transform:scale(.85)}
@keyframes animeStarGlint{0%,100%{opacity:0;transform:scale(.3) rotate(0deg)}50%{opacity:1;transform:scale(1.3) rotate(90deg)}}
.v6lfull.cast .v6ls{animation:v6lcast .5s steps(2) 6 alternate}
@keyframes v6lcast{to{opacity:1;transform:scale(2)}}
html.hw-rm .v6lfull,html.hw-rm .v6lfull .v6lfi,html.hw-rm .v6ls,html.hw-rm .v6laura,html.hw-rm .v6lrune,html.hw-rm .v6lb,html.hw-q-performance .v6lfull,html.hw-q-performance .v6lfull .v6lfi,html.hw-q-performance .v6laura,html.hw-q-performance .v6lrune,html.hw-q-performance .v6lb{animation:none!important}html.hw-rm .v6ls{opacity:0}html.hw-q-performance .v6ls,html.hw-q-performance .v6laura,html.hw-q-performance .v6lrune{display:none}
@media(prefers-reduced-motion:reduce){.v6lfull,.v6ls,.v6laura,.v6lrune,.v6lfull .v6lfi,.v6lb{animation:none!important}.v6ls{opacity:0}}
/* Anime avatar header button with golden magic circle */
.v6lb{display:inline-grid;place-items:center;width:44px;height:44px;min-height:44px;padding:0;margin-left:auto;flex:0 0 auto;border-radius:50%!important;border:2px solid var(--gold)!important;color:#f6edcf!important;background:radial-gradient(circle,#3d2c6a 0%,#150c28 100%),#150c28!important;box-shadow:0 0 0 1px rgba(0,0,0,.5),0 0 14px rgba(246,201,79,.55),inset 0 1px 0 rgba(255,255,255,.4)!important;overflow:hidden;transition:transform .25s cubic-bezier(.34,1.56,.64,1),box-shadow .25s ease;animation:animeAvatarPulse 4s ease-in-out infinite alternate}
@keyframes animeAvatarPulse{0%{box-shadow:0 0 0 1px rgba(0,0,0,.5),0 0 10px rgba(246,201,79,.4)}100%{box-shadow:0 0 0 1px rgba(0,0,0,.5),0 0 18px rgba(246,201,79,.75),0 0 8px rgba(168,85,247,.5)}}
.v6lb:hover{transform:scale(1.1) translateY(-2px);box-shadow:0 0 0 2px var(--gold),0 0 24px rgba(246,201,79,.85),inset 0 1px 0 #fff!important}
.v6lb:hover .v6lmini{transform:scale(1.1) rotate(3deg)}
.v6lb:active{transform:scale(.95) translateY(1px)}
header .v6lb{margin-right:56px;align-self:flex-start}.hbar .v6lb{grid-area:a;margin:0 56px 0 0}.hbar>button[data-v=quests]{white-space:nowrap}
.hbar small{min-width:0;overflow-wrap:anywhere} /* a long name wraps instead of widening the page */
.v6lp{width:min(460px,100%)}.v6lph{display:flex;gap:10px;align-items:center;margin-bottom:8px}.v6lph h3{margin:0 0 4px}
.v6lpic{flex:0 0 auto;border:2px solid var(--edge,var(--ln));border-radius:16px;overflow:hidden;background:var(--p2);line-height:0}
.v6lbust{display:block;width:120px;height:112px;background:url(${POSE_IMG}) no-repeat;background-size:${POSES.length*100}% auto;background-position-y:0;image-rendering:auto}
.v6lp input{width:100%;margin:4px 0 2px}.v6lp h4{font:12px/1.6 var(--fl);margin:12px 0 6px}
.v6lf{display:flex;gap:8px;align-items:center;border-top:2px solid var(--ln);padding:8px 0}.v6lf>div{flex:1 1 auto;min-width:0}
.v6lf b{display:block}.v6lf small{display:block;color:var(--mut);margin-top:2px}.v6lfi{flex:0 0 auto;line-height:0}
.v6lh{display:flex;flex-wrap:wrap;gap:6px}
.v6lroom{position:relative;line-height:0;border-radius:14px;overflow:hidden;border:1px solid var(--edge,var(--ln));margin:4px 0 8px;box-shadow:0 0 18px rgba(196,166,255,.35)}
.v6lrbg{display:block;width:100%;height:auto;image-rendering:pixelated;image-rendering:crisp-edges}
.v6lroom .v6lfull{position:absolute;left:50%;bottom:4%;transform:translateX(-50%) scale(1);transform-origin:bottom center;animation:none}
@media(min-width:400px){.v6lroom .v6lfull{transform:translateX(-50%) scale(1.25)}}
.v6lprops{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;list-style:none;padding:0;margin:0 0 4px}.v6lprops li{display:flex;flex-direction:column;align-items:center;gap:2px}.v6lprop{display:block;width:96px;height:96px;background:url(${PROPS_IMG}) 0 0/${48*PROPS_N*2}px 96px no-repeat;image-rendering:pixelated;image-rendering:crisp-edges}.v6lprops small{font-size:12px;color:var(--mut)}.v6lpt2{margin:10px 0 4px}
.v6lmeet{margin:6px 0 10px;text-align:center}.v6lmst{display:flex;justify-content:center;padding:10px 8px 4px;border:2px solid var(--ln);border-radius:10px;background:var(--p2)}.v6lmcap{margin:6px 0}.v6lmeet .row{justify-content:center}
.v6lcn{display:block;margin:0 0 6px}.v6lchd{display:flex;gap:10px;align-items:flex-start}.v6lchd .v6lpf{flex:0 0 auto;border:2px solid var(--ln);border-radius:10px;background-color:var(--p2)}.v6lchd .v6lcn{flex:1 1 auto;min-width:0}.v6lclog{max-height:240px;overflow-y:auto;border:2px solid var(--ln);background:var(--bg);padding:8px;margin:6px 0}
.v6lcm{margin:0 0 8px}.v6lcm b{font:12px/1.6 var(--fl);display:block}.v6lcm span{display:block;white-space:pre-wrap;overflow-wrap:anywhere}
.v6lcm.a span{color:var(--ink)}.v6lcm.u{text-align:right}.v6lce{color:var(--red);font-weight:bold}
.v6lcf{display:flex;gap:6px;align-items:stretch;margin:6px 0}.v6lcf input{flex:1 1 auto;min-width:0;margin:0}.v6lcf button{flex:0 0 auto}
.v6lco{display:flex;gap:10px;align-items:flex-start;border:3px dashed var(--ln);background:var(--p2);padding:10px;margin:6px 0}.v6lco>svg{flex:0 0 auto}
.v6lco b{font:12px/1.6 var(--fl);display:block}.v6lco p{margin:4px 0 8px;font-size:14px}.v6lco button{width:100%}
.hwh.v6lpt{outline:4px solid var(--gold);outline-offset:3px;animation:v6lpt .5s steps(2) infinite alternate}@keyframes v6lpt{to{outline-color:var(--vio)}}
@media(prefers-reduced-motion:reduce){.hwh.v6lpt{animation:none}}
`);
return{mount,portrait,mini,bust,full,pose,meet,open,close,style,compact,find,talk,talkError,get chat(){return CH},expressions:NAMES,poses:POSES,turnaround:TURN,props:PROPS.map(q=>q[0]),POSEOF,POSE_IMG,FACES,PROPS_IMG}})();
