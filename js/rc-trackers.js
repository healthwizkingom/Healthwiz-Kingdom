/* =====================================================================
   RECONSTRUCTED (v6) — tracker pages: Heart Temple (pulse), Stair
   Mountain, Mind Forest (stress + calm games + Wizard's Counsel),
   Balance Shrine (BMI/profile) and Goal Forge (calculator).
   Entry formats follow the original desc(): pulse m.st; stair m.loc,
   m.climbs, m.steps; stress m.feel, m.end; bmi v.
   ===================================================================== */

/* ---------- timers that must stop when leaving a page ---------- */
const TMR={};
function stopAll(){Object.keys(TMR).forEach(k=>{clearInterval(TMR[k]);clearTimeout(TMR[k]);delete TMR[k]});if(S.pb)S.pb.on=0;if(S.pt)S.pt=null}
const numIn=(id,lo,hi)=>{const el=$(id);if(!el||el.value==='')return null;const v=+el.value;return isFinite(v)&&v>=lo&&v<=hi?v:NaN};

/* ===================== HEART TEMPLE (pulse) ===================== */
const PST=['Resting','After exercise','After stairs','Other'];
function ecg(bpm){const pts=[];for(let i=0;i<4;i++){const x=i*50;pts.push(x+',30',x+10+',30',x+14+',26',x+18+',30',x+22+',30',x+24+',36',x+27+',6',x+30+',44',x+33+',30',x+40+',30',x+44+',24',x+48+',30')}
const dur=bpm?(60/bpm*4).toFixed(2):3;return '<svg viewBox="0 0 200 50" width="100%" height="80" preserveAspectRatio="none" aria-hidden="true" style="display:block;background:#14204f;border:3px solid var(--ln)"><polyline points="'+pts.join(' ')+'" fill="none" stroke="#5cc05a" stroke-width="2" class="zrv" style="animation-duration:'+dur+'s;stroke-dasharray:6 2"/></svg>'}
pages.pulse=()=>{const d=today(),L=LC('pulse'),last=L.slice(-1)[0],bpm=last?+last.v:0,R=rng(7),pst=S.pst||'Resting',pt=S.pt;
const note=last&&last.m.st==='Resting'&&(bpm>100||bpm<50)?'<div class="warn">Your last resting reading ('+bpm+' BPM) is outside the common adult resting range of 60–100 BPM. Fit, active people often rest below 60. If you feel unwell, dizzy, breathless or have chest pain, speak to a healthcare professional.</div>':'';
return '<h2>❤️ HEART TEMPLE</h2><p class="mut">Measure your pulse and keep the temple\'s heart beating.</p>'
+'<div class="card"><div class="row" style="align-items:center"><div class="'+(bpm?'bob':'')+'" style="flex:0 0 auto'+(bpm?';animation-duration:'+(60/bpm).toFixed(2)+'s':'')+'">'+HEART(7)+'</div><div><small>Last reading</small><div class="big">'+(bpm||'–')+'<small> BPM</small></div><small>'+(last?esc(last.m.st)+' · '+last.d.slice(5)+' '+last.t:'no readings yet')+'</small></div></div>'+ecg(bpm)+'<small class="mut">Heart-rate visualization only — not an ECG.</small>'+note+'</div>'
+'<div class="card"><h3>⏱️ MEASURE (15-SECOND COUNT)</h3><p class="mut">Place two fingers on your wrist or neck. Tap START, count the beats until the timer ends, then type the count.</p>'
+(pt?'<div class="big" style="text-align:center" id="ptc">'+pt.left+' s</div><p style="text-align:center">Counting… stay still.</p><button class="g" data-a="pstop" style="width:100%">CANCEL</button>':'<button data-a="ptm" style="width:100%">START 15 s TIMER</button>')
+'<label>Beats counted in 15 s<input id="pbc" type="number" min="5" max="60" inputmode="numeric" placeholder="e.g. 18"></label><small class="mut">BPM = beats × 4</small></div>'
+'<div class="card"><h3>📝 LOG A READING</h3><label>Or type BPM directly<input id="pbpm" type="number" min="30" max="220" inputmode="numeric" placeholder="e.g. 72"></label><label>When was this?</label><div class="row">'+PST.map(s=>'<button class="chip'+(pst===s?' on':'')+'" data-a="pst" data-s="'+s+'">'+s+'</button>').join('')+'</div><label>Note (optional)<input id="pnt" maxlength="140"></label><button data-a="psave" style="width:100%;margin-top:8px">SAVE READING</button></div>'
+'<div class="grid"><div class="t">❤️ Resting today<b>'+(rest(d)||'–')+'</b><small>BPM</small></div><div class="t">📈 Average today<b>'+(hr(d)||'–')+'</b><small>BPM</small></div><div class="t">🗂️ Readings<b>'+L.length+'</b><small>total</small></div></div>'
+'<div class="card" style="margin-top:14px"><h3>📊 RESTING PULSE · 7 DAYS</h3>'+chart(R.map(rest),R,'var(--red)','BPM')+'</div>'
+'<div class="card"><h3>📝 TODAY\'S READINGS</h3>'+list('pulse')+'</div>'};
acts.pst=d=>{S.pst=d.s;document.querySelectorAll('[data-a="pst"]').forEach(b=>b.classList.toggle('on',b.dataset.s===d.s))};
acts.ptm=()=>{stopAll();S.pt={left:15};render();sfx(880,.1);TMR.pt=setInterval(()=>{if(!S.pt){clearInterval(TMR.pt);return}S.pt.left--;const c=$('#ptc');if(c)c.textContent=S.pt.left+' s';if(S.pt.left<=0){clearInterval(TMR.pt);delete TMR.pt;S.pt=null;sfx(523,.25);render();toast('⏱️ Time! Type the beats you counted.');const b=$('#pbc');if(b)b.focus()}},1000)};
acts.pstop=()=>{stopAll();render()};
acts.psave=()=>{const c=numIn('#pbc',5,60),b=numIn('#pbpm',30,220);let v=null,src='manual';
if(b!=null&&!isNaN(b))v=Math.round(b);else if(c!=null&&!isNaN(c)){v=Math.round(c*4);src='timer'}
if(v==null||!(v>=30&&v<=220)){toast('Enter beats in 15 s (5–60) or a BPM between 30 and 220');return}
add('pulse',v,{st:S.pst||'Resting',src},($('#pnt').value||'').slice(0,140),0,0,10,'Pulse saved');render()};

/* ===================== STAIR MOUNTAIN ===================== */
const SLOC=['Home stairs','School / college block','Hostel','Office','Other'],SPACE=[['SLOW',60],['STEADY',80],['BRISK',100]];
function stairTower(k){const st_=k%11;return '<div class="stw" style="height:170px" aria-hidden="true">'+Array.from({length:10},(_,i)=>'<i style="left:'+(i*10)+'%;height:'+(10+i*8)+'%;--c:'+(i<st_?'#5cc05a':'#c8b8a0')+'"></i>').join('')+'<div class="clm'+(S.pb.on?' go':'')+'" id="clm" style="left:'+(Math.min(st_,9)*10)+'%;bottom:'+(Math.min(st_,10)*8+8)+'%"><img src="'+KN+'" alt="" width="48" style="image-rendering:pixelated;height:auto"></div></div>'}
pages.stair=()=>{const d=today(),s=sp(d),R=rng(7),pb=S.pb,loc=SLOC[S.loc]||SLOC[0],tot=st.e.filter(x=>x.c==='stair').reduce((a,x)=>a+(+x.v||0),0);
return '<h2>🧗 STAIR MOUNTAIN</h2><p class="mut">Climb at a comfortable pace. Every step lifts your knight higher.</p>'
+'<div class="card"><div class="row"><div><small>Steps today</small><div class="big">'+s+'</div></div><div><small>Climbs today</small><div class="big">'+cl(d)+'</div></div><div><small>All-time steps</small><div class="big">'+tot+'</div></div></div>'+bar(s,'var(--grn)')+'<small>Daily quest: 100 steps</small></div>'
+'<div class="card"><h3>🥁 PACING BEAT</h3>'+stairTower(pb.k)+'<div class="row">'+SPACE.map((p,i)=>'<button class="chip'+(pb.pace===i?' on':'')+'" data-a="spc" data-i="'+i+'">'+p[0]+' · '+p[1]+'/min</button>').join('')+'</div><p class="cnt" style="text-align:center">Steps on the beat: <b class="cur" id="sbk">'+pb.k+'</b></p><button data-a="sbeat" style="width:100%">'+(pb.on?'■ STOP BEAT':'▶ START BEAT')+'</button><small class="mut">Step once per beep. Stop any time — when you stop, the climb count below is filled in for you.</small></div>'
+'<div class="card"><h3>📝 LOG A STAIR SESSION</h3><label>Location<select id="sloc" data-ch="sloc">'+SLOC.map((l,i)=>'<option value="'+i+'"'+(i===S.loc?' selected':'')+'>'+l+'</option>').join('')+'</select></label><div class="row"><label>Steps per climb<input id="sst" type="number" min="1" max="400" value="'+(S.sst||12)+'" inputmode="numeric"></label><label>Climbs (times up)<input id="scl" type="number" min="1" max="100" value="'+(S.scl||1)+'" inputmode="numeric"></label></div><label>Note (optional)<input id="snt" maxlength="140"></label><button data-a="ssave" style="width:100%;margin-top:8px">SAVE SESSION</button></div>'
+'<div class="card"><h3>📊 STAIR STEPS · 7 DAYS</h3>'+chart(R.map(sp),R,'var(--grn)','steps',100,'quest')+'</div>'
+'<div class="card"><h3>📝 TODAY\'S SESSIONS · '+esc(loc)+'</h3>'+list('stair')+'</div>'};
acts.spc=d=>{S.pb.pace=+d.i;if(S.pb.on){stopBeat();startBeat()}document.querySelectorAll('[data-a="spc"]').forEach(b=>b.classList.toggle('on',+b.dataset.i===S.pb.pace))};
function startBeat(){S.pb.on=1;const ms=60000/SPACE[S.pb.pace][1];TMR.beat=setInterval(()=>{S.pb.k++;sfx(S.pb.k%10?440:660,.05);const k=$('#sbk');if(k)k.textContent=S.pb.k;const c=$('#clm'),st_=S.pb.k%11;if(c){c.style.left=Math.min(st_,9)*10+'%';c.style.bottom=Math.min(st_,10)*8+8+'%'}document.querySelectorAll('.stw i').forEach((b,i)=>b.style.setProperty('--c',i<st_?'#5cc05a':'#c8b8a0'))},ms)}
function stopBeat(){clearInterval(TMR.beat);delete TMR.beat;S.pb.on=0}
acts.sbeat=()=>{if(S.pb.on){stopBeat();const per=+($('#sst')||{}).value||12;if(S.pb.k>0){S.scl=Math.max(1,Math.round(S.pb.k/per));S.sst=per}render();return}S.pb.k=0;render();startBeat();const b=document.querySelector('[data-a="sbeat"]');if(b)b.textContent='■ STOP BEAT';const c=$('#clm');if(c)c.classList.add('go')};
CH.sloc=v=>{S.loc=+v};
acts.ssave=()=>{const per=numIn('#sst',1,400),n=numIn('#scl',1,100);if(!per||!n||isNaN(per)||isNaN(n)){toast('Steps per climb 1–400 and climbs 1–100');return}
S.loc=+$('#sloc').value||0;add('stair',Math.round(per*n),{loc:SLOC[S.loc],climbs:Math.round(n),steps:Math.round(per)},($('#snt').value||'').slice(0,140),0,0,15,'Stair session');S.sst=per;S.scl=1;S.pb.k=0;render()};

/* ===================== MIND FOREST (stress) ===================== */
const FEEL=['Calm','Tired','Worried','Overwhelmed','Frustrated','Sad','Restless','Excited'];
const scat=v=>v<=3?'MILD':v<=6?'MODERATE':'HIGH';
function forest(v,id){const c=scat(v),sky=c==='MILD'?'linear-gradient(#7cc4f6,#bfe6ff)':c==='MODERATE'?'linear-gradient(#8a9ab0,#c0c8d0)':'linear-gradient(#2a2f45,#4a5068)';
let h='';if(c==='MILD')h+='<div class="qsun"></div>'+[0,1].map(i=>'<div class="qb" style="top:'+(18+i*14)+'%;animation-delay:-'+i*4+'s"></div>').join('')+[0,1,2,3,4].map(i=>'<i class="qf" style="left:'+(10+i*18)+'%;bottom:'+(24+i*5%15)+'%;animation-delay:'+(i*.4)+'s"></i>').join('');
const cc=c==='MILD'?'#fff':c==='MODERATE'?'#d8dde4':'#555b70',nc=c==='MILD'?2:c==='MODERATE'?4:6;
h+=Array.from({length:nc},(_,i)=>'<div class="qc" style="--c:'+cc+';top:'+(6+i*9%30)+'%;animation-duration:'+(40+i*13)+'s;animation-delay:-'+(i*9)+'s"></div>').join('');
if(c!=='MILD')h+=Array.from({length:c==='HIGH'?6:3},(_,i)=>'<div class="qw" style="top:'+(20+i*11)+'%;animation-duration:'+(2+i*.6)+'s;animation-delay:-'+i+'s"></div>').join('');
if(c==='HIGH')h+=Array.from({length:30},(_,i)=>'<i class="qd" style="left:'+(i*3.4)+'%;animation-duration:'+(.6+i%5*.12)+'s;animation-delay:-'+(i%7*.2)+'s"></i>').join('')+'<div class="qlt"></div>';
h+=[8,24,70,86].map((x,i)=>'<div class="qtr" style="left:'+x+'%;--sp:'+(c==='HIGH'?.5:c==='MODERATE'?1.2:2.4)+'s"></div>').join('');
return '<div class="qs" id="'+(id||'')+'" style="background:'+sky+'" aria-label="Forest weather: '+c.toLowerCase()+'">'+h+'<div class="qh"><img src="'+KN+'" alt="" width="56" style="image-rendering:pixelated;height:auto"></div></div>'}
function moodBar(v){return '<div class="qmb" aria-hidden="true"><span class="qmk" style="left:'+(v*10)+'%">▼</span></div><div class="qml"><span>CALM</span><span>TENSE</span><span>STORMY</span></div>'}
pages.stress=()=>{const d=today(),lv=S.slv==null?5:S.slv,c=scat(lv),todayE=A('stress',d),lastT=todayE.slice(-1)[0],R=rng(7),g=S.cg;
return '<h2>🧠 MIND FOREST</h2><p class="mut">Check the forest weather inside you, then calm the storm.</p>'
+'<div class="card"><h3>🌦️ HOW STRESSED DO YOU FEEL RIGHT NOW?</h3>'+forest(lv,'qcsc')+'<label for="slv">Stress level: <b id="slvv">'+lv+'</b>/10</label><input id="slv" type="range" min="0" max="10" step="1" value="'+lv+'" data-in="slv" aria-valuetext="'+lv+' out of 10">'+moodBar(lv)+'<p class="qmn" id="slvc">'+c+'</p><label>What fits best?</label><div class="row">'+FEEL.map(f=>'<button class="chip'+(S.sfl===f?' on':'')+'" data-a="sfeel" data-f="'+f+'">'+f+'</button>').join('')+'</div><label>Anything on your mind? (optional, stays on this device)<input id="snote" maxlength="140"></label><button data-a="ssv" style="width:100%;margin-top:8px">SAVE CHECK-IN</button></div>'
+'<div class="card" id="calm"><h3>🌿 CALM THE STORM</h3>'+(lastT?'<p class="mut">Today\'s check-in: '+lastT.v+'/10'+(lastT.m.end!=null?' → after calming '+lastT.m.end+'/10':'')+'.</p>':'<p class="mut">Save a check-in first and the calm games will record how you feel afterwards.</p>')+calmGame(g,lastT)+'</div>'
+counselCard()
+'<div class="card"><h3>📊 STRESS · 7 DAYS</h3>'+chart(R.map(str),R,'var(--vio)','/10')+'</div>'
+'<div class="card"><h3>📝 TODAY\'S CHECK-INS</h3>'+list('stress')+'</div>'};
INP.slv=v=>{S.slv=+v;const c=scat(S.slv),e=$('#slvv');if(e)e.textContent=v;const k=$('.qmk');if(k)k.style.left=(v*10)+'%';const n=$('#slvc');if(n)n.textContent=c;const sc=$('#qcsc');if(sc&&sc.dataset.c!==c){const w=document.createElement('div');w.innerHTML=forest(S.slv,'qcsc');sc.replaceWith(w.firstChild);$('#qcsc').dataset.c=c}};
acts.sfeel=d=>{S.sfl=S.sfl===d.f?null:d.f;document.querySelectorAll('[data-a="sfeel"]').forEach(b=>b.classList.toggle('on',b.dataset.f===S.sfl))};
acts.ssv=()=>{const v=S.slv==null?5:S.slv;add('stress',v,{feel:S.sfl||'',cat:scat(v)},($('#snote').value||'').slice(0,140),0,0,10,'Mind check-in');S.sfl=null;render();if(v>=7)toast('🌧️ Stormy day. Try a calm game below — or talk to someone you trust.')};
// Calm games: b = breathing orb, w = wisp arena, g = 5-4-3-2-1 grounding
function calmGame(g,lastT){if(!g)return '<div class="grid">'+[['b','🫧','Breathing Orb','Breathe with the orb: in as it grows, out as it shrinks.'],['w','👻','Wisp Catcher','Tap the restless wisps until they settle.'],['g','🖐️','5-4-3-2-1','Name things you sense around you.']].map(x=>'<button class="it" data-a="sact" data-g="'+x[0]+'"><b>'+x[1]+' '+x[2]+'</b><span>'+x[3]+'</span></button>').join('')+'</div>';
let h='';
if(g==='b')h='<div class="qgb"><div class="orb"></div></div><p class="cnt" style="text-align:center">Breaths: '+[1,2,3].map(i=>'<b class="'+(S.cn>=i?'cur':'')+'">'+i+'</b>').join(' ')+'</p><p class="mut" style="text-align:center">In for 4 as it grows… out for 6 as it shrinks.</p><button data-a="brth" style="width:100%"'+(S.cn>=3?' disabled':'')+'>I FINISHED A BREATH</button>';
if(g==='w'){const j=lastT?Math.max(.15,1.1-lastT.v/10):.4;h='<div class="arena" style="--j:'+(.12+j*.3).toFixed(2)+'s">'+Array.from({length:6},(_,i)=>'<button class="wisp'+(S.wp&&S.wp[i]?' calm':'')+'" data-a="wisp" data-i="'+i+'" style="left:'+(8+i*15)+'%;top:'+(20+i*37%55)+'%" aria-label="Wisp '+(i+1)+'">'+(S.wp&&S.wp[i]?'🌿':'👻')+'</button>').join('')+'</div><p class="mut">Tap each wisp gently. Settled: '+(S.wp?S.wp.filter(Boolean).length:0)+'/6</p>'}
if(g==='g'){const L=[['👀',5,'things you can see'],['✋',4,'things you can touch'],['👂',3,'things you can hear'],['👃',2,'things you can smell'],['👅',1,'thing you can taste']];h='<div class="gor">'+L.map((x,i)=>'<button class="gorb'+(S.gr&&S.gr[i]?' on':'')+'" data-a="gorb" data-i="'+i+'" aria-label="'+x[1]+' '+x[2]+'">'+x[0]+'</button>').join('')+'</div>'+L.map((x,i)=>'<p style="margin:2px 0'+(S.gr&&S.gr[i]?';opacity:.5':'')+'">'+x[0]+' Name '+x[1]+' '+x[2]+'</p>').join('')}
const done=(g==='b'&&S.cn>=3)||(g==='w'&&S.wp&&S.wp.filter(Boolean).length>=6)||(g==='g'&&S.gr&&S.gr.filter(Boolean).length>=5);
if(done)h+='<p class="qcd">✨ THE FOREST GROWS QUIET</p>'+(lastT&&lastT.m.end==null?'<label>How stressed do you feel now? <b id="sendv">'+(S.send==null?Math.max(0,lastT.v-1):S.send)+'</b>/10</label><input id="send" type="range" min="0" max="10" value="'+(S.send==null?Math.max(0,lastT.v-1):S.send)+'" data-in="send"><button data-a="sdone" data-g="'+g+'" style="width:100%">RECORD HOW I FEEL NOW</button>':'<button class="g" data-a="sact" data-g="" style="width:100%">CHOOSE ANOTHER GAME</button>');
else h+='<button class="g sm" data-a="sact" data-g="" style="margin-top:8px">◀ BACK TO GAMES</button>';
return h}
acts.sact=d=>{stopAll();S.cg=d.g||null;S.cn=0;S.wp=[];S.gr=[];S.send=null;render()};
acts.brth=()=>{S.cn=(S.cn||0)+1;sfx(392+S.cn*60,.2);render()};
acts.wisp=d=>{S.wp=S.wp||[];if(S.wp[+d.i])return;S.wp[+d.i]=1;sfx(500+S.wp.filter(Boolean).length*70,.08);render()};
acts.gorb=d=>{S.gr=S.gr||[];S.gr[+d.i]=S.gr[+d.i]?0:1;sfx(600,.06);render()};
INP.send=v=>{S.send=+v;const e=$('#sendv');if(e)e.textContent=v};
acts.sdone=d=>{const e=A('stress').slice(-1)[0];if(!e)return;const end=S.send==null?Math.max(0,e.v-1):S.send;e.m.end=end;e.m.act=d.g;save();gain(5,'Calm game');S.cg=null;S.send=null;render();toast(end<e.v?'🌿 The storm eased: '+e.v+' → '+end+'/10':'Thanks for checking in. Some days stay stormy — that\'s okay.')};

/* ---------- Wizard's Counsel (listener, not therapy) ---------- */
const CRISIS=/suicid|kill (my)?self|end (my|it all)|want to die|self[- ]?harm|hurt (my)?self|cut myself|no reason to live|bunuh diri|nak mati|tak nak hidup/i;
function counselCard(){const L=S.cs||(S.cs=[{r:'a',t:'Greetings, brave knight. I am the Wizard of the Mind Forest. Tell me what weighs on you today — I will listen.'}]);
return '<div class="card" id="counsel"><h3>🧙 WIZARD\'S COUNSEL</h3><div class="cslog" id="cslog" aria-live="polite">'+L.map(m=>'<div class="csm '+m.r+'"><b>'+(m.r==='a'?'WIZARD':m.r==='u'?'YOU':'NOTE')+'</b>'+esc(m.t)+'</div>').join('')+'</div><div class="csin"><textarea id="csx" rows="2" maxlength="600" placeholder="Type what\'s on your mind…" aria-label="Message to the wizard"></textarea><button data-a="csend">SEND</button></div>'
+(S.csh?helpBox():'')+'<small class="mut">A listening companion, not a therapist or crisis service. Messages are not saved and are cleared when you leave this page'+(window.claude&&window.claude.complete?'':' · offline mode: replies are pre-written reflections')+'. <button class="sm g" data-a="csclr">CLEAR</button></small></div>'}
function helpBox(){return '<div class="cshelp"><b>You don\'t have to face this alone.</b><br>If you might act on thoughts of harming yourself, please reach out now:<br>📞 Emergency: <b>999</b><br>📞 Befrienders KL (24 h): <b>03-7627 2929</b><br>📞 Talian Kasih: <b>15999</b><br>Or tell a trusted adult, friend, teacher or counsellor today.</div>'}
const REFL=[[/exam|test|study|homework|assignment|grade|result|spm|stpm|kuiz|quiz/i,'Exams and schoolwork can feel like a mountain that keeps growing. What part of it feels heaviest right now?'],[/sleep|tired|exhaust|insomnia|penat|letih/i,'It sounds like you are running low on energy. How has your sleep been these past few nights?'],[/friend|class ?mate|bully|alone|lonely|left out|kawan/i,'Feeling apart from others can hurt a lot. Is there one person you feel a little safe talking to?'],[/family|mum|mom|dad|parent|brother|sister|home|keluarga|mak|ayah/i,'Things at home can weigh heavily. What would help you feel even slightly more at ease there?'],[/angry|mad|annoy|frustrat|marah/i,'That frustration makes sense. What happened just before you started feeling this way?'],[/worr|anxious|nervous|scared|afraid|panic|takut|risau/i,'Worry can make everything feel urgent. If you take one slow breath with me — in for 4, out for 6 — what is the worry saying?'],[/sad|cry|down|depress|sedih/i,'I\'m sorry you\'re feeling low. How long have you been feeling this way?'],[/better|good|happy|okay|fine|calm|gembira/i,'I\'m glad to hear some lightness in your words. What helped today, even a little?']];
const GEN=['I hear you. Tell me a little more — what is this like for you?','That sounds like a lot to carry. What would make the next hour slightly easier?','Thank you for sharing that with me. What do you need most right now: to vent, to plan, or to rest?','You are doing something brave by putting it into words. What else is on your mind?'];
function offlineReply(t){for(const r of REFL)if(r[0].test(t))return r[1];return GEN[(S.cs.length>>1)%GEN.length]}
acts.csend=async()=>{const x=$('#csx'),t=(x&&x.value||'').trim();if(!t)return;S.cs.push({r:'u',t:t.slice(0,600)});
if(CRISIS.test(t)){S.csh=1;S.cs.push({r:'a',t:'What you are feeling matters, and you deserve support from a real person right now. Please look at the help numbers below — reaching out is a strong thing to do. I am still here to listen.'});render();$('#counsel').scrollIntoView&&$('#counsel').scrollIntoView();return}
let rep=null;if(window.claude&&window.claude.complete){S.cs.push({r:'sys',t:'The wizard is thinking…'});render();try{rep=await window.claude.complete('You are the kind Wizard in a teen wellness game. Listen, reflect feelings, ask one gentle open question, keep it under 70 words. Never diagnose or give medical advice. If there is any risk of self-harm, urge contacting 999 or Befrienders KL 03-7627 2929.\n\nConversation:\n'+S.cs.filter(m=>m.r!=='sys').slice(-8).map(m=>(m.r==='u'?'Knight: ':'Wizard: ')+m.t).join('\n')+'\nWizard:')}catch(e){rep=null}S.cs=S.cs.filter(m=>m.r!=='sys')}
S.cs.push({r:'a',t:String(rep||offlineReply(t)).slice(0,800)});render();const l=$('#cslog');if(l)l.scrollTop=l.scrollHeight;const nx=$('#csx');if(nx)nx.focus()};
acts.csclr=()=>{S.cs=null;S.csh=0;render()};

/* ===================== BALANCE SHRINE (BMI) ===================== */
pages.bmi=()=>{const p=st.p,b=bmi(),a=+p.age||16,L=LC('bmi'),pos=clamp((b-15)/(35-15)*100,0,100);
return '<h2>⚖️ BALANCE SHRINE</h2><p class="mut">Your profile powers your goals, sleep range and BMI.</p>'
+'<div class="card"><div class="row"><div><small>BMI</small><div class="big">'+b+'</div></div><div><small>'+(a>=18?'Category':'Age')+'</small><div class="big" style="font-size:16px">'+(a>=18?bcat(b):a+' years')+'</div></div></div>'
+'<div class="sc" aria-hidden="true"><div style="width:17.5%;background:#7cc6f0"></div><div style="width:32.5%;background:#5cc05a"></div><div style="width:25%;background:#e0b040"></div><div style="width:25%;background:#d9453d"></div><u style="left:'+pos+'%">▼</u></div><div class="qml"><span>15</span><span>18.5</span><span>25</span><span>30</span><span>35</span></div>'
+(a<18?'<p class="warn">Under 18, BMI is read with age- and sex-specific growth charts (BMI-for-age percentiles), not the adult categories. Ask a doctor or school nurse to interpret it.</p>':'<small class="mut">Adult ranges: under 18.5 · 18.5–24.9 · 25–29.9 · 30 and above.</small>')+'</div>'
+'<div class="card"><h3>👤 PROFILE</h3><label>Name (optional)<input id="bnm" maxlength="24" value="'+esc(p.name||'')+'"></label><div class="row"><label>Weight (kg)<input id="bw" type="number" min="20" max="300" step="0.1" value="'+esc(p.w)+'" inputmode="decimal"></label><label>Height (cm)<input id="bh" type="number" min="100" max="230" step="0.1" value="'+esc(p.h)+'" inputmode="decimal"></label></div><div class="row"><label>Age<input id="ba" type="number" min="5" max="100" value="'+esc(p.age)+'" inputmode="numeric"></label><label>Sex<select id="bs"><option value="m"'+(p.sex==='m'?' selected':'')+'>Male</option><option value="f"'+(p.sex==='f'?' selected':'')+'>Female</option></select></label></div><button data-a="bsave" style="width:100%;margin-top:8px">SAVE PROFILE & BMI</button></div>'
+'<div class="card"><h3>📈 BMI HISTORY</h3>'+(L.length?chart(L.slice(-10).map(e=>e.v),L.slice(-10).map(e=>e.d.slice(5)),'var(--vio)','BMI')+L.slice(-10).reverse().map(e=>row(e,1)).join(''):emp('🌱 NO BMI SAVED YET','Save your profile to record your first BMI.'))+'</div>'};
acts.bsave=()=>{const w=numIn('#bw',20,300),h=numIn('#bh',100,230),a=numIn('#ba',5,100);if(!w||!h||!a||[w,h,a].some(isNaN)){toast('Check weight (20–300 kg), height (100–230 cm) and age (5–100)');return}
Object.assign(st.p,{w,h,age:Math.round(a),sex:$('#bs').value==='f'?'f':'m',name:($('#bnm').value||'').trim().slice(0,24)});save();add('bmi',bmi(),{w,h},'',0,0,10,'Profile saved');render()};

/* ===================== GOAL FORGE (calculator) ===================== */
const ACT=[[1.2,'Mostly sitting'],[1.375,'Lightly active (1–3 days/week)'],[1.55,'Moderately active (3–5 days/week)'],[1.725,'Very active (6–7 days/week)'],[1.9,'Extra active (training twice a day)']];
function goals(p){const w=+p.w,h=+p.h,a=+p.age,bmr=Math.round(10*w+6.25*h-5*a+(p.sex==='f'?-161:5)),tdee=Math.round(bmr*(+p.act||1.375)),minor=a<18;
let k=tdee+(p.goal==='l'&&!minor?-400:p.goal==='g'?300:0);k=Math.round(clamp(k,minor?1400:1200,5000)/50)*50;
const wat=Math.round(clamp(w*35,1500,3500)/50)*50;return{bmr,tdee,k,wat,minor,pr:[Math.round(k*.1/4),Math.round(k*.35/4)],cb:[Math.round(k*.45/4),Math.round(k*.65/4)],fa:[Math.round(k*.2/9),Math.round(k*.35/9)],sl:SR(a)}}
pages.calc=()=>{const p=st.p,G=goals(p);
return '<h2>🧮 GOAL FORGE</h2><p class="mut">Forge daily calorie and water targets from your profile.</p>'
+'<div class="card"><h3>⚙️ YOUR DETAILS</h3><div class="row"><label>Weight (kg)<input id="gw" type="number" min="20" max="300" step="0.1" value="'+esc(p.w)+'"></label><label>Height (cm)<input id="gh" type="number" min="100" max="230" step="0.1" value="'+esc(p.h)+'"></label></div><div class="row"><label>Age<input id="ga" type="number" min="5" max="100" value="'+esc(p.age)+'"></label><label>Sex<select id="gs"><option value="m"'+(p.sex==='m'?' selected':'')+'>Male</option><option value="f"'+(p.sex==='f'?' selected':'')+'>Female</option></select></label></div>'
+'<label>Activity<select id="gact">'+ACT.map(x=>'<option value="'+x[0]+'"'+(+p.act===x[0]?' selected':'')+'>'+x[1]+'</option>').join('')+'</select></label><label>Exercise days per week<input id="gd" type="number" min="0" max="7" value="'+esc(p.days)+'"></label>'
+'<label>Goal</label><div class="row">'+[['l','Lose a little'],['m','Maintain'],['g','Gain a little']].map(x=>'<button class="chip'+(p.goal===x[0]?' on':'')+'" data-a="ggoal" data-g="'+x[0]+'">'+x[1]+'</button>').join('')+'</div><button data-a="gcalc" style="width:100%;margin-top:10px">FORGE MY GOALS</button></div>'
+'<div class="card"><h3>✨ RESULTS</h3><div class="grid"><div class="t">🔥 BMR<b>'+G.bmr+'</b><small>kcal at rest (Mifflin-St Jeor)</small></div><div class="t">🏃 Daily burn<b>'+G.tdee+'</b><small>kcal with activity</small></div><div class="t">🎯 Calorie target<b>'+G.k+'</b><small>kcal / day</small></div><div class="t">💧 Water<b>'+G.wat+'</b><small>mL / day (≈35 mL/kg)</small></div><div class="t">🌙 Sleep<b>'+G.sl[0]+'–'+G.sl[1]+'</b><small>hours for age '+esc(p.age)+'</small></div></div>'
+(G.minor?'<p class="warn">You are under 18: HealthWiz never suggests a calorie deficit for growing bodies. For weight goals, please talk to a doctor or dietitian.</p>':'')
+'<p><b>Macro ranges (AMDR):</b> protein '+G.pr[0]+'–'+G.pr[1]+' g · carbs '+G.cb[0]+'–'+G.cb[1]+' g · fat '+G.fa[0]+'–'+G.fa[1]+' g</p><p class="mut">Current targets: '+st.s.kcal+' kcal · '+st.s.water+' mL</p><button data-a="guse" style="width:100%">USE AS MY DAILY TARGETS</button></div>'};
function readGoals(){const w=numIn('#gw',20,300),h=numIn('#gh',100,230),a=numIn('#ga',5,100),dd=numIn('#gd',0,7);if(!w||!h||!a||[w,h,a].some(isNaN)||isNaN(dd)){toast('Check weight, height and age');return false}
Object.assign(st.p,{w,h,age:Math.round(a),sex:$('#gs').value==='f'?'f':'m',act:+$('#gact').value||1.375,days:dd==null?st.p.days:Math.round(dd)});save();return true}
acts.ggoal=d=>{st.p.goal=d.g;save();document.querySelectorAll('[data-a="ggoal"]').forEach(b=>b.classList.toggle('on',b.dataset.g===d.g))}; // no re-render: keeps unsaved form values
acts.gcalc=()=>{if(readGoals()){render();toast('⚒️ Goals forged')}};
acts.guse=()=>{if(!readGoals())return;const G=goals(st.p),first=!st.s.set;st.s.kcal=G.k;st.s.water=G.wat;st.s.set=1;save();if(first)gain(10,'Goals set');else toast('Targets updated');render()};
