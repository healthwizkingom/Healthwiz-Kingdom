/* v6: Stress Quest activity collection. Not part of the original.
   Replaces the "What would help you handle this?" list (five choices, two of them unhelpful) in the Stress Quest.
   After the stress meter, the encounter shows a scrollable collection of illustrated activity cards instead. Nothing is
   chosen "for" the user: tap any card to open it, read what it is, press START, and the card's way back is always there.
     Shake It Off      the knight leads a short loosening-up routine (new, 40 s)
     Empower Yourself  the original breathing exercise, guided by a lantern that glows with the breath
     Arrow Focus       follow the centre rune's direction (new, 12 rounds, no time limit)
     Reaction Focus    wait for the spell light, then tap (new, 5 rounds, no score)
     Calming Sounds    forest, rain on the castle, a quiet kingdom, an enchanted night (new, WebAudio, no files)
     Ground Yourself / Write It Away / Tiny Steps    the original grounding, writing and small-steps tools, unchanged
   The weather scene, the stress meter, the mood recording and the original tools are the original code: this file only
   rewrites the encounter's option list and adds the new activity screen (phase 'rx'). Every activity ends in the original
   "How do you feel now?" step, and the answer is kept as the user's own report (st.e tech list, as before). It no longer
   moves the stress rating, so finishing an activity never changes the recorded mood or the weather.
   Cards are CSS + inline SVG (the knight is the existing kn.webp); a missing image just hides itself.
   State: S.sq.rx = {id, run, sc} while an activity is open (not saved). Tech keys logged: breathe, ground, write, steps
   (as before) and shake, arrow, react, sound. */
const HWRelief=(()=>{
const LIST=[
 {id:'shake',n:'Shake It Off',tag:'Movement',time:'1 min',t:'shake',c:['#ffd98a','#e8873c'],
  d:'Loosen your hands, shoulders and legs beside the knight to shake off built-up tension.',
  note:'Move only in ways that feel comfortable, and skip anything that hurts.'},
 {id:'lantern',n:'Empower Yourself',tag:'Breathing',time:'1 min',t:'breathe',std:1,c:['#26305f','#6a52a8'],
  d:'Breathe with a magical lantern that glows brighter as you breathe in and softens as you breathe out.'},
 {id:'arrow',n:'Arrow Focus',tag:'Focus',time:'1 min',t:'arrow',c:['#1f4e5a','#3f8a80'],
  d:'Follow the centre rune and tap the way it points to gather a scattered mind.',
  note:'There is no timer and no score to beat. Go at your own pace.'},
 {id:'react',n:'Reaction Focus',tag:'Focus',time:'1 min',t:'react',c:['#2c1f5a','#8a44aa'],
  d:'Wait for the spell light to appear, then tap it, a gentle way to bring your attention to this moment.',
  note:'It is not a test. Tap early and the light simply waits for you again.'},
 {id:'sound',n:'Calming Sounds',tag:'Sound',time:'Your pace',t:'sound',c:['#14402f','#5a9a62'],
  d:'Drift into a whispering forest, a quiet kingdom or rain on the castle roof with soft, endless soundscapes.'},
 {id:'ground',n:'Ground Yourself',tag:'Grounding',time:'2 min',t:'ground',std:1,c:['#34406e','#7aa0c8'],
  d:'Notice five things you can see, hear, feel, smell and taste to come back to the world around you.'},
 {id:'write',n:'Write It Away',tag:'Writing',time:'2 min',t:'write',std:1,c:['#7a5a2e','#e6c98a'],
  d:'Write down what is on your mind, then release it to the wind. Your words are not saved.'},
 {id:'steps',n:'Tiny Steps',tag:'Planning',time:'2 min',t:'steps',std:1,c:['#3b5f9a','#a4d4ea'],
  d:'Turn a heavy worry into up to three tiny steps, smallest first.'}];
const BY={};LIST.forEach(a=>BY[a.id]=a);
const SCAPES=[['forest','Whispering Forest','Leaves, wind and distant birds'],['kingdom','Peaceful Kingdom','Soft harp over a quiet realm'],['rain','Rain on the Castle','Steady rain and a low rumble'],['night','Enchanted Night','Crickets and a moonlit hush']];
const SCN={};SCAPES.forEach(s=>SCN[s[0]]=s);
Object.assign(TN,{shake:'🤸 Shake It Off',arrow:'🎯 Arrow Focus',react:'✨ Reaction Focus',sound:'🎧 Calming Sounds'});

/* ---------- art: inline SVG on a themed gradient (no files, nothing to fail) ---------- */
const star=(x,y,s,o)=>'<path transform="translate('+x+' '+y+') scale('+s+')" d="M0 -7L2 -2L7 0L2 2L0 7L-2 2L-7 0L-2 -2Z" fill="#fff4c0" opacity="'+(o||.9)+'"/>';
const dots=(l,col)=>l.map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(p[2]||1.4)+'" fill="'+(col||'#fff')+'" opacity=".75"/>').join('');
const arr=(x,y,dir,w,col)=>'<g transform="translate('+x+' '+y+') scale('+dir*w+' '+w+')"><path d="M14 0H-14M-4 -10L-14 0L-4 10" fill="none" stroke="'+col+'" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>';
const ART={
 shake:()=>'<circle cx="252" cy="40" r="22" fill="#fff4c0" opacity=".9"/><path d="M0 160V118Q70 92 130 112T260 104T320 112V160Z" fill="#5fa84f"/><path d="M0 160V134Q90 112 170 130T320 124V160Z" fill="#43914a"/>'+dots([[40,30],[70,52],[120,26],[200,20]],'#fff'),
 lantern:id=>'<defs><radialGradient id="rg'+id+'"><stop offset="0" stop-color="#ffe9a0" stop-opacity=".95"/><stop offset=".45" stop-color="#ffc25a" stop-opacity=".4"/><stop offset="1" stop-color="#ffc25a" stop-opacity="0"/></radialGradient><linearGradient id="lg'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset="1" stop-color="#f2a93a"/></linearGradient></defs>'
  +dots([[30,24],[70,52],[104,18],[240,28],[282,58],[210,12],[52,90],[290,100]])+'<circle class="rxpulse" cx="160" cy="84" r="66" fill="url(#rg'+id+')"/>'
  +'<path d="M0 160V138Q80 120 160 134T320 128V160Z" fill="#1d2448"/><path d="M148 36a12 12 0 0 1 24 0" fill="none" stroke="#3a2b1c" stroke-width="3.5"/><path d="M146 44h28l5 9h-38z" fill="#3a2b1c"/><rect x="141" y="53" width="38" height="54" rx="9" fill="url(#lg'+id+')" stroke="#3a2b1c" stroke-width="3.5"/><path d="M160 62c9 10 9 20 0 30c-9-10-9-20 0-30z" fill="#fff8d6" opacity=".9"/><rect x="138" y="107" width="44" height="9" rx="3.5" fill="#3a2b1c"/>',
 arrow:()=>[44,96,224,276].map((x,i)=>'<rect x="'+(x-21)+'" y="60" width="42" height="42" rx="11" fill="#fff" opacity=".15" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>'+arr(x,81,-1,.8,'#d7fff2')).join('')
  +'<rect x="128" y="50" width="64" height="62" rx="14" fill="#fff" opacity=".22" stroke="#f2c14e" stroke-width="3"/>'+arr(160,81,1,1.25,'#fff6c8')+star(30,28,.9,.7)+star(292,38,.7,.6)+star(250,128,.6,.5),
 react:id=>'<defs><radialGradient id="ro'+id+'"><stop offset="0" stop-color="#fff6c8"/><stop offset=".35" stop-color="#ffb347"/><stop offset=".75" stop-color="#e8622c" stop-opacity=".55"/><stop offset="1" stop-color="#e8622c" stop-opacity="0"/></radialGradient></defs><circle class="rxpulse" cx="160" cy="82" r="68" fill="url(#ro'+id+')"/><circle cx="160" cy="82" r="22" fill="#fff6c8" opacity=".95"/>'+star(60,40,1,.9)+star(268,50,1.2,.9)+star(98,118,.7,.7)+star(240,122,.8,.7)+star(206,26,.6,.6),
 sound:()=>'<circle cx="238" cy="38" r="18" fill="#f6f0c8" opacity=".92"/><path d="M200 0L170 160H230Z" fill="#fff" opacity=".07"/><path d="M250 0L226 160H290Z" fill="#fff" opacity=".06"/>'
  +'<g fill="#0e3a2a" opacity=".85"><path d="M10 160L34 66L58 160Z"/><path d="M52 160L78 84L104 160Z"/><path d="M228 160L258 70L288 160Z"/><path d="M276 160L300 92L324 160Z"/></g><g fill="#0a2c20"><path d="M-6 160L26 88L58 160Z"/><path d="M84 160L112 100L140 160Z"/><path d="M178 160L210 96L242 160Z"/></g><path d="M0 160V142Q90 130 160 144T320 140V160Z" fill="#07201a"/>'
  +'<path d="M152 140l8-22l8 22z" fill="#9fe3f0"/><path d="M160 118l-3 22h6z" fill="#e8ffff" opacity=".8"/>'+dots([[70,30,1.2],[130,50,1.2],[290,70,1.2]],'#fff6b0'),
 ground:()=>[[52,'#7cc6f0'],[106,'#a8e08a'],[160,'#f2c14e'],[214,'#ffb3dc'],[268,'#c9b0f0']].map((c,i)=>'<path d="M'+c[0]+' '+(112-i%2*10)+'l-16 -26l16 -30l16 30z" fill="'+c[1]+'" stroke="#fff" stroke-opacity=".6" stroke-width="2"/><path d="M'+c[0]+' '+(56+i%2*10)+'l-4 54" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>').join('')+'<path d="M0 160V126Q80 112 160 124T320 120V160Z" fill="#26305a"/>'+star(30,34,.8,.6)+star(290,30,.8,.6),
 write:()=>'<rect x="104" y="30" width="112" height="92" rx="9" fill="#f6e6b4" stroke="#8a6a3a" stroke-width="3"/><g stroke="#a98a56" stroke-width="3" stroke-linecap="round"><path d="M122 56H198"/><path d="M122 74H190"/><path d="M122 92H178"/></g><path d="M236 28L206 84l8 5l30 -58z" fill="#fff" stroke="#6a4a2a" stroke-width="2"/><path d="M206 84l-7 14l15 -9z" fill="#6a4a2a"/>'
  +'<g fill="#7fc46a" opacity=".85"><path d="M40 90q14 -16 30 -6q-12 16 -30 6z"/><path d="M262 116q14 -14 28 -4q-10 14 -28 4z"/></g>'+dots([[60,40],[280,66],[250,20]]),
 steps:()=>'<g fill="#a7b4c8" stroke="#506080" stroke-width="2"><rect x="40" y="116" width="62" height="30" rx="4"/><rect x="100" y="98" width="62" height="48" rx="4"/><rect x="160" y="80" width="62" height="66" rx="4"/><rect x="220" y="62" width="62" height="84" rx="4"/></g><path d="M262 62V26" stroke="#5a3a1e" stroke-width="3"/><path d="M262 26l26 9l-26 9z" fill="#e0483f"/><path d="M0 160V148Q80 140 160 148T320 146V160Z" fill="#4e8a4a"/>'+dots([[60,30],[150,22],[110,52]])};
const KNIMG=()=>'<img class="rxk" alt="" src="'+(typeof KN==='string'?KN:'')+'" onerror="this.style.display=\'none\'">';
const SPARK='<i class="rxp" style="--x:18%;--y:62%;--d:0s"></i><i class="rxp" style="--x:78%;--y:38%;--d:1.6s"></i><i class="rxp" style="--x:52%;--y:78%;--d:3.1s"></i>';
function art(a){const f=ART[a.id]||ART.shake;
  return '<svg viewBox="0 0 320 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">'+f(a.id)+'</svg>'+(a.id==='shake'?KNIMG():'')+SPARK}
const cv=a=>'--c1:'+a.c[0]+';--c2:'+a.c[1];

/* ---------- the collection ---------- */
function gallery(){
  return '<section class="rxg" aria-labelledby="rxh"><h3 id="rxh" class="rxh">WAYS TO EASE THE STORM</h3><p class="rxs">Tap any card to open it. Nothing here is required, so take whatever feels right.</p><div class="rxl">'
   +LIST.map((a,i)=>'<button type="button" class="rxc" data-a="rxo" data-id="'+a.id+'" style="'+cv(a)+';--i:'+i+'" aria-label="'+a.n+'. '+a.tag+'. '+a.d.replace(/"/g,'&quot;')+'">'
     +'<span class="rxa">'+art(a)+'<span class="rxtag">'+a.tag+'</span><span class="rxtime">'+a.time+'</span></span>'
     +'<span class="rxt"><b>'+a.n+'</b><small>'+a.d+'</small></span></button>').join('')
   +'</div><small class="mut rxfoot">You don’t fight it. You choose how to respond.</small></section>'}

/* ---------- activity screen: title, one sentence, illustration, START ---------- */
const head=a=>'<div class="rxbar"><button type="button" class="rxback" data-a="rxb" aria-label="Back to all activities">←</button><span class="rxchip">'+a.tag+' · '+a.time+'</span></div>';
const titles=a=>'<h3 class="rxdt">'+a.n+'</h3><p class="rxds">'+a.d+'</p>';
const stage=(a,inner,cls)=>'<div class="rxstage '+(cls||'')+'" style="'+cv(a)+'">'+inner+'</div>';
const soundOff=()=>st.s.sound?'':'<div class="rxnote" role="note">Sound is turned off in Settings. <button type="button" class="g sm" data-a="rxsnd">TURN SOUND ON</button></div>';
const scapeChips=cur=>'<div class="rxsc" role="group" aria-label="Soundscape">'+SCAPES.map(s=>'<button type="button" class="rxscb'+(s[0]===cur?' on':'')+'" data-a="rxsc" data-s="'+s[0]+'" aria-pressed="'+(s[0]===cur)+'"><b>'+s[1]+'</b><small>'+s[2]+'</small></button>').join('')+'</div>';
function detail(q){const a=BY[q.rx.id];
  return '<div class="rxd">'+head(a)+titles(a)+stage(a,art(a),'rxbig')+(a.id==='sound'?scapeChips(q.rx.sc||'forest')+soundOff():'')+(a.note?'<p class="rxnt">'+a.note+'</p>':'')
   +'<button type="button" class="rxstart" data-a="rxs">START</button></div>'}

const arrowTile=(dir,cls)=>'<span class="rxtl '+(cls||'')+'">'+'<svg viewBox="-18 -14 36 28" aria-hidden="true"><g transform="scale('+(-dir)+' 1)"><path d="M14 0H-14M-4 -10L-14 0L-4 10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g></svg></span>';
function runHtml(q){const a=BY[q.rx.id];let b='';
  if(a.id==='shake')b=stage(a,'<div class="rxsh s0" id="rxsh">'+KNIMG()+'</div>'+SPARK,'rxrun')+'<p class="rxcue" id="rxcue" aria-live="polite">Get ready…</p><p class="rxtm" id="rxtm"></p><div class="row"><button type="button" class="g" data-a="rxdone">I’M DONE</button></div>';
  else if(a.id==='arrow')b=stage(a,'<div class="rxar" id="rxar" aria-live="polite"></div>','rxrun rxcmp')+'<p class="rxcue" id="rxcue">Tap the way the centre rune points.</p><p class="rxtm" id="rxtm"></p><div class="rxdirs" id="rxdirs"><button type="button" class="rxdir" data-a="rxdir" data-d="-1" aria-label="Left">'+arrowTile(-1)+'</button><button type="button" class="rxdir" data-a="rxdir" data-d="1" aria-label="Right">'+arrowTile(1)+'</button></div><div class="row"><button type="button" class="g sm" data-a="rxdone">I’M DONE</button></div>';
  else if(a.id==='react')b=stage(a,'<button type="button" class="rxorb" id="rxorb" data-a="rxtap" aria-label="Spell light"><i></i></button>','rxrun')+'<p class="rxcue" id="rxcue" aria-live="polite">Wait for the spell light…</p><p class="rxtm" id="rxtm"></p><div class="row"><button type="button" class="g sm" data-a="rxdone">I’M DONE</button></div>';
  else if(a.id==='sound'){const s=q.rx.sc||'forest';b=stage(a,art(a)+'<div class="rxwave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>','rxrun rxcmp')+'<p class="rxcue" id="rxcue" aria-live="polite">'+SCN[s][1]+'</p><p class="rxtm" id="rxtm">0:00</p>'+scapeChips(s)+soundOff()+'<div class="row"><button type="button" class="rxstart" data-a="rxdone">I FEEL READY</button></div>'}
  return '<div class="rxd">'+head(a)+'<h3 class="rxdt">'+a.n+'</h3>'+b+'</div>'}

/* ---------- runtime for the new activities ---------- */
let RX=null;
const sec=n=>Math.floor(n/60)+':'+('0'+(n%60)).slice(-2);
const rnd=(a,b)=>a+Math.random()*(b-a);
const live=()=>RX&&S.v==='stress'&&S.sq&&S.sq.ph==='rx'&&S.sq.rx&&S.sq.rx.run;
function later(fn,ms){const t=setTimeout(()=>{if(RX)RX.timers=RX.timers.filter(x=>x!==t);if(live())fn()},ms);if(RX)RX.timers.push(t);return t}
function stop(){sqk();if(RX){RX.timers.forEach(clearTimeout);RX.timers=[]}SND.stop();document.removeEventListener('keydown',onKey);RX=null}
function onKey(e){if(!live()||S.sq.rx.id!=='arrow')return;if(e.key==='ArrowLeft'){e.preventDefault();acts.rxdir({d:-1})}else if(e.key==='ArrowRight'){e.preventDefault();acts.rxdir({d:1})}}
function finish(){stop();S.sq.ph='rate';render();window.scrollTo(0,0)}
const toCard=()=>{const r=document.querySelector('.rxd,.rxlg')||document.querySelector('.card');if(r)window.scrollTo(0,Math.max(0,r.getBoundingClientRect().top+window.scrollY-84))};
const cue=t=>{const e=$('#rxcue');if(e)e.textContent=t};
const tm=t=>{const e=$('#rxtm');if(e)e.textContent=t};

const MOVES=[['Shake out your hands, loose and light.'],['Roll your shoulders slowly, back and down.'],['Loosen your legs, one at a time.'],['Now shake it all out, then let it go.'],['Stand still. Notice how your body feels.']];
function runShake(){RX={timers:[]};let s=0;const el=$('#rxsh');
  const tick=()=>{if(!live()||!$('#rxsh')){stop();return}const i=Math.floor(s/8);if(i>=MOVES.length){finish();return}
    if(s%8===0){el.className='rxsh s'+i;cue(MOVES[i][0]);sfx(440+i*60,.08)}tm((40-s)+' s');s++};
  tick();S.qt=setInterval(tick,1000)}

function runArrow(){RX={timers:[],n:0,ok:0,dir:1,lock:0};document.addEventListener('keydown',onKey);arrowNext()}
function arrowNext(){if(!live())return;const R=RX;if(R.n>=12){arrowEnd();return}R.dir=Math.random()<.5?-1:1;R.lock=0;
  const fl=Math.random()<.5?R.dir:-R.dir,f=x=>arrowTile(x,'');
  const ar=$('#rxar');if(!ar)return;ar.innerHTML=f(fl)+f(fl)+arrowTile(R.dir,'mid')+f(fl)+f(fl);tm('Round '+(R.n+1)+' of 12')}
acts.rxdir=d=>{if(!live()||S.sq.rx.id!=='arrow'||!RX||RX.lock||RX.n>=12)return;const R=RX,ok=+d.d===R.dir;R.lock=1;R.n++;if(ok)R.ok++;
  const m=document.querySelector('#rxar .mid');if(m)m.classList.add(ok?'ok':'no');sfx(ok?660:260,.07);later(arrowNext,ok?380:560)};
function arrowEnd(){const R=RX;$('#rxar').innerHTML='<p class="rxres"><b>'+R.ok+' of 12</b> in step</p>';cue('Well done for taking the time. There is no score to beat.');tm('');
  const d=$('#rxdirs');if(d)d.innerHTML='<button type="button" class="rxstart" data-a="rxdone">CONTINUE</button>'}

function runReact(){RX={timers:[],n:0,res:[],lit:0,t0:0};reactWait()}
function reactWait(){if(!live())return;const R=RX,o=$('#rxorb');if(!o)return;R.lit=0;R.busy=0;o.classList.remove('on');tm('Round '+(R.n+1)+' of 5');cue('Wait for the spell light…');
  R.tw=later(()=>{const o2=$('#rxorb');if(!o2)return;R.lit=1;R.t0=performance.now();o2.classList.add('on');cue('Now! Tap the light.')},rnd(1300,3600))}
acts.rxtap=()=>{if(!live()||S.sq.rx.id!=='react'||!RX||RX.busy)return;const R=RX,o=$('#rxorb');if(!o)return;R.busy=1;
  if(!R.lit){clearTimeout(R.tw);R.timers=R.timers.filter(x=>x!==R.tw);cue('A little early. Breathe, and wait for the light.');later(reactWait,1200);return}
  R.lit=0;const ms=Math.round(performance.now()-R.t0);R.res.push(ms);R.n++;o.classList.remove('on');sfx(784,.08);cue(ms+' ms');
  if(R.n>=5){const avg=Math.round(R.res.reduce((a,b)=>a+b,0)/R.res.length);later(()=>{cue('Average '+avg+' ms. No score to beat, just a moment of focus.');tm('');const r=document.querySelector('.rxd .row');if(r)r.innerHTML='<button type="button" class="rxstart" data-a="rxdone">CONTINUE</button>'},900)}
  else later(reactWait,1000)};

function runSound(){RX={timers:[],s:0};if(!st.s.sound){return}SND.start(S.sq.rx.sc||'forest');
  const tick=()=>{if(!live()||!$('#rxtm')){stop();return}RX.s++;tm(sec(RX.s))};S.qt=setInterval(tick,1000)}
acts.rxsc=d=>{const q=S.sq;if(!q||q.ph!=='rx'||!SCN[d.s])return;q.rx.sc=d.s;
  if(q.rx.run){SND.start(d.s);cue(SCN[d.s][1]);document.querySelectorAll('.rxscb').forEach(b=>{const on=b.dataset.s===d.s;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)})}else render()};
acts.rxsnd=()=>{st.s.sound=true;save();const q=S.sq;render();if(q&&q.ph==='rx'&&q.rx.run)runSound()};

/* ---------- soundscapes: noise, filters and a few notes, made on the spot (no audio files) ---------- */
const SND=(()=>{let m=null,nodes=[],timers=[],musOff=0,bufs={};
  const ctx=()=>{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();return ac};
  function buf(c,k){if(bufs[k])return bufs[k];const n=c.sampleRate*3,b=c.createBuffer(1,n,c.sampleRate),d=b.getChannelData(0);let l=0;
    for(let i=0;i<n;i++){const w=Math.random()*2-1;if(k==='brown'){l=(l+.02*w)/1.02;d[i]=l*3.5}else d[i]=w*.6}return bufs[k]=b}
  const keep=n=>(nodes.push(n),n);
  function noise(c,out,k,type,f,q,g,lfo,depth){const s=keep(c.createBufferSource());s.buffer=buf(c,k);s.loop=true;const fl=c.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const gn=c.createGain();gn.gain.value=g;
    s.connect(fl);fl.connect(gn);gn.connect(out);s.start();if(lfo){const o=keep(c.createOscillator()),og=c.createGain();o.frequency.value=lfo;og.gain.value=g*depth;o.connect(og);og.connect(gn.gain);o.start()}return gn}
  function pad(c,out,f,g){const o=keep(c.createOscillator()),gn=c.createGain();o.type='sine';o.frequency.value=f;gn.gain.value=g;o.connect(gn);gn.connect(out);o.start();return o}
  function note(c,out,f,t,g,dur,type){const o=c.createOscillator(),gn=c.createGain();o.type=type||'triangle';o.frequency.value=f;gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(g,t+.02);gn.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(gn);gn.connect(out);o.start(t);o.stop(t+dur+.1)}
  function chirp(c,out,f,t,g){const o=c.createOscillator(),gn=c.createGain();o.type='sine';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.35,t+.09);o.frequency.exponentialRampToValueAtTime(f*.9,t+.16);gn.gain.setValueAtTime(0,t);gn.gain.linearRampToValueAtTime(g,t+.02);gn.gain.exponentialRampToValueAtTime(.0001,t+.18);o.connect(gn);gn.connect(out);o.start(t);o.stop(t+.22)}
  const every=(fn,a,b)=>{const go=()=>{timers.push(setTimeout(()=>{if(!m)return;try{fn()}catch(e){}go()},rnd(a,b)*1000))};go()};
  const SC={
    forest(c,o){noise(c,o,'brown','bandpass',520,.7,.38,.07,.6);noise(c,o,'white','bandpass',3200,1.2,.05,.13,.8);pad(c,o,110,.03);
      every(()=>{const t=c.currentTime,f=rnd(2300,3800),n=1+Math.floor(Math.random()*3);for(let i=0;i<n;i++)chirp(c,o,f*(1+i*.06),t+i*.24,.05)},2.5,7)},
    kingdom(c,o){const d=c.createDelay(1),fb=c.createGain(),wet=c.createGain();d.delayTime.value=.42;fb.gain.value=.38;wet.gain.value=.5;d.connect(fb);fb.connect(d);d.connect(wet);wet.connect(o);
      noise(c,o,'brown','bandpass',380,.6,.22,.05,.6);pad(c,o,98,.04);pad(c,o,147,.018);const P=[392,440,523.25,587.33,659.25,784];
      every(()=>{const t=c.currentTime,f=P[Math.floor(Math.random()*P.length)],g=c.createGain();g.gain.value=.12;g.connect(o);g.connect(d);note(c,g,f,t,1,2.6,'triangle')},1.4,3.6)},
    rain(c,o){noise(c,o,'white','highpass',900,.5,.2,.2,.25);noise(c,o,'white','lowpass',6500,.4,.14,0,0);noise(c,o,'brown','lowpass',180,.5,.5,.04,.5);pad(c,o,98,.025)},
    night(c,o){noise(c,o,'brown','bandpass',420,.6,.18,.05,.7);pad(c,o,130.8,.03);
      const mk=(f,r)=>{const s=keep(c.createOscillator()),a=c.createGain(),l=keep(c.createOscillator()),lg=c.createGain(),h=keep(c.createOscillator()),hg=c.createGain();s.type='sine';s.frequency.value=f;a.gain.value=0;l.frequency.value=r;lg.gain.value=.02;h.frequency.value=.17+Math.random()*.1;hg.gain.value=.012;
        s.connect(a);l.connect(lg);lg.connect(a.gain);h.connect(hg);hg.connect(a.gain);a.connect(o);s.start();l.start();h.start()};
      mk(4300,14);mk(4620,17);mk(3900,12)}};
  function start(k){stop(true);try{const c=ctx();m=c.createGain();m.gain.value=0;m.connect(c.destination);
      if(MT&&typeof acts.mus==='function'){acts.mus();musOff=1}
      (SC[k]||SC.forest)(c,m);m.gain.linearRampToValueAtTime(Math.min(1.1,.34*MV()),c.currentTime+2.5)}catch(e){console.warn('[HWRelief] sound unavailable:',e&&e.message)}}
  function stop(keepMus){timers.forEach(clearTimeout);timers=[];const g=m;m=null;
    if(g){try{const c=ac,t=c.currentTime;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+.35);const ns=nodes;nodes=[];setTimeout(()=>{ns.forEach(n=>{try{n.stop()}catch(e){}});try{g.disconnect()}catch(e){}},500)}catch(e){}}
    else nodes=[];
    if(!keepMus&&musOff){musOff=0;if(!MT&&typeof acts.mus==='function'){try{acts.mus()}catch(e){}}}}
  return{start,stop,get on(){return !!m}}})();

/* ---------- wiring into the original quest ---------- */
acts.rxo=(d,t,e)=>{const q=S.sq;if(!q||q.ph!=='enc'||!BY[d.id])return;q.rx={id:d.id,y:window.scrollY};q.tech=BY[d.id].t;q.ph='rx';render();toCard();
  if(typeof HWFX!=='undefined'&&e&&e.clientX!=null)try{HWFX.burst(e.clientX,e.clientY,{n:9,palette:'magic',speed:2,gravity:.03,life:650})}catch(x){}};
acts.rxb=()=>{const q=S.sq;if(!q||(q.ph!=='rx'&&q.ph!=='game'))return;const y=q.rx?q.rx.y:0;stop();q.rx=null;q.g=null;q.ph='enc';render();window.scrollTo(0,y||0)};
acts.rxs=()=>{const q=S.sq;if(!q||q.ph!=='rx'||q.rx.run)return;const a=BY[q.rx.id];q.tech=a.t;
  if(a.std){q.g={t:a.t,s:0,c:0,sec:0};q.ph='game';sqk();render();if(a.t==='breathe')S.qt=setInterval(sqTick,1000);toCard();return}
  q.rx.run=1;render();toCard();({shake:runShake,arrow:runArrow,react:runReact,sound:runSound})[a.id]()};
acts.rxdone=()=>{const q=S.sq;if(!q||q.ph!=='rx'||!q.rx.run)return;finish()};
// the original "How do you feel now?" answer: recorded as the user's own report; it no longer moves the stress rating
acts.sqt=d=>{const q=S.sq,i=+d.i;q.tries.push({t:q.tech,fb:i});q.last=i;q.ph='done';gain(5,'Practice');sfx(i>1?784:300,.2);render()};
{const g0=go;go=function(){stop();const q=S.sq;if(q&&q.ph==='rx'){q.ph='enc';q.rx=null}return g0.apply(this,arguments)}}

const LANTERN='<div class="qgb rxlg"><div class="orb rxglow"></div><svg viewBox="0 0 80 120" aria-hidden="true" focusable="false"><path d="M28 18a12 12 0 0 1 24 0" fill="none" stroke="#3a2b1c" stroke-width="3.5"/><path d="M26 26h28l5 9H21z" fill="#3a2b1c"/><rect x="21" y="35" width="38" height="56" rx="9" fill="#ffe7a0" fill-opacity=".55" stroke="#3a2b1c" stroke-width="3.5"/><path d="M40 46c9 10 9 22 0 32c-9-10-9-22 0-32z" fill="#fff8d6"/><rect x="18" y="91" width="44" height="9" rx="3.5" fill="#3a2b1c"/></svg></div>';
const base=pages.stress;
pages.stress=function(){const q=S.sq;if(q&&q.ph==='fx')q.ph='enc';
  if(q&&q.ph==='rx'&&q.rx)return '<h2>🧠 STRESS QUEST</h2><div class="card">'+(q.rx.run?runHtml(q):detail(q))+'</div><div class="card"><h3>CHECK-INS</h3>'+list('stress')+'</div>';
  let h=base.apply(this,arguments);if(!q)return h;
  if(q.ph==='enc')h=h.replace(/<p><b>What would help you handle this\?<\/b><\/p>[\s\S]*?You don’t fight it\. You choose how to respond\.<\/small>/,()=>gallery());
  else if(q.ph==='game'){h=h.replace('<div class="card">','<div class="card"><button type="button" class="g sm rxback2" data-a="rxb">← ALL ACTIVITIES</button>');
    if(q.g&&q.g.t==='breathe')h=h.replace('<div class="qgb"><div class="orb"></div></div>',()=>LANTERN).replace('Breathe in as the orb grows, out as it shrinks.','Breathe in as the lantern glows brighter, out as it softens.')}
  else if(q.ph==='done')h=h.replace('The clouds thin a little. ','Glad that helped a little. ').replace('data-a="sqa">TRY ANOTHER TOOL','data-a="sqa">BACK TO ACTIVITIES');
  else if(q.ph==='end')h=h.replace(/<div class="big">(?:CALMER SKIES|THE STORM EASES|STILL STORMY)<\/div><p>Stress: (\d+)\/10 → \d+\/10 <small class="mut">\(game visual\)<\/small><\/p>/,(m,a)=>'<div class="big">CHECK-IN COMPLETE</div><p>Stress: '+a+'/10 <small class="mut">(as you recorded it)</small></p>');
  return h};

HWUI.css('relief',`
.rxg{margin:8px 0 4px}.rxh{font:11px/1.6 var(--fh);margin:0 0 6px}.rxs{margin:0 0 14px;font-size:14px;color:var(--mut)}.rxfoot{display:block;margin-top:14px;text-align:center}
.rxl{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:16px}
button.rxc{display:flex;flex-direction:column;align-items:stretch;padding:0;min-height:0;text-align:left;font:inherit;background:var(--pn);color:var(--ink);border:2px solid rgba(43,36,24,.45);border-radius:20px;overflow:hidden;box-shadow:0 8px 18px rgba(20,14,40,.22),0 0 0 1px rgba(242,193,78,.22);transition:transform .28s ease,box-shadow .28s ease;animation:rxin .55s ease both;animation-delay:calc(var(--i,0)*55ms)}
button.rxc:hover{transform:translateY(-3px);box-shadow:0 12px 24px rgba(20,14,40,.3),0 0 0 2px rgba(242,193,78,.55),0 0 22px rgba(242,193,78,.25)}
button.rxc:active{transform:translateY(0) scale(.99)}button.rxc:focus-visible,.rxd button:focus-visible{outline:3px solid var(--vio);outline-offset:3px}
@keyframes rxin{from{opacity:0;transform:translateY(10px)}}
.rxa{position:relative;display:block;aspect-ratio:2/1;min-height:118px;overflow:hidden;background:linear-gradient(180deg,var(--c1),var(--c2))}
.rxa svg,.rxstage>svg{position:absolute;inset:0;width:100%;height:100%}.rxa:after{content:"";position:absolute;inset:0;background:linear-gradient(to top,rgba(10,8,24,.38),transparent 48%),radial-gradient(120% 80% at 50% 0,rgba(255,244,200,.22),transparent 60%);pointer-events:none}
.rxk{position:absolute;left:50%;bottom:4%;height:78%;width:auto;transform:translateX(-50%);filter:drop-shadow(0 4px 6px rgba(0,0,0,.35));z-index:1}
.rxtag,.rxtime{position:absolute;bottom:10px;z-index:2;font:8px/1.4 var(--fh);padding:5px 9px;border-radius:999px;background:rgba(255,248,224,.94);color:#2b2418}.rxtag{left:12px}.rxtime{right:12px;background:rgba(20,16,40,.6);color:#fff6d0}
.rxt{display:block;padding:12px 14px 15px}.rxt b{display:block;font:12px/1.5 var(--fh);margin-bottom:6px}.rxt small{display:block;font:14px/1.5 var(--fb);color:var(--mut)}
.rxp{position:absolute;left:var(--x);top:var(--y);width:5px;height:5px;border-radius:50%;background:#fff4c0;box-shadow:0 0 8px 2px rgba(255,236,160,.8);opacity:0;animation:rxfl 5s ease-in-out infinite;animation-delay:var(--d);z-index:2}
@keyframes rxfl{0%{opacity:0;transform:translateY(8px)}30%,60%{opacity:.9}100%{opacity:0;transform:translateY(-16px)}}
.rxpulse{transform-origin:50% 50%;transform-box:fill-box;animation:rxpl 5s ease-in-out infinite}@keyframes rxpl{50%{transform:scale(1.07);opacity:.82}}
.rxd{display:flex;flex-direction:column;gap:12px}.rxbar{display:flex;align-items:center;justify-content:space-between;gap:10px}
button.rxback,.rxback2{border-radius:999px}button.rxback{width:46px;height:46px;min-height:46px;padding:0;font:20px/1 var(--fb);background:var(--p2);color:var(--ink);border:2px solid rgba(43,36,24,.45);box-shadow:none}
.rxback2{margin-bottom:10px}.rxchip{font:8px/1.4 var(--fh);padding:7px 12px;border-radius:999px;background:var(--p2);color:var(--ink)}
.rxdt{font:15px/1.5 var(--fh);text-align:center;margin:6px 0 0}.rxds{text-align:center;font-size:16px;line-height:1.5;color:var(--mut);max-width:36ch;margin:0 auto}.rxnt{text-align:center;font-size:13px;color:var(--mut);margin:0}
.rxstage{position:relative;display:grid;place-items:center;overflow:hidden;min-height:230px;border-radius:24px;background:linear-gradient(180deg,var(--c1),var(--c2));border:2px solid rgba(43,36,24,.4);box-shadow:inset 0 0 70px rgba(255,236,170,.2),0 10px 22px rgba(20,14,40,.25)}
.rxstage.rxbig{min-height:min(34vh,260px)}.rxstage.rxrun{min-height:min(34vh,240px)}.rxstage.rxcmp{min-height:150px}
.rxd>button.rxstart{position:sticky;bottom:16px;z-index:5}@media(max-width:760px){.rxd>button.rxstart{bottom:calc(92px + env(safe-area-inset-bottom,0px))}}
button.rxstart{width:100%;min-height:58px;border-radius:999px;font:12px/1.4 var(--fh);background:linear-gradient(180deg,#ffe58f,#f2c14e);color:#2b2418;border:2px solid rgba(43,36,24,.6);box-shadow:0 8px 16px rgba(20,14,40,.28),inset 0 -3px 0 rgba(0,0,0,.12);transition:transform .2s ease,box-shadow .2s ease}
button.rxstart:hover{box-shadow:0 10px 22px rgba(242,193,78,.45),inset 0 -3px 0 rgba(0,0,0,.12)}button.rxstart:active{transform:scale(.985)}
.rxcue{text-align:center;font-size:17px;line-height:1.5;margin:2px 0 0;min-height:1.5em}.rxtm{text-align:center;font:10px/1.5 var(--fh);color:var(--mut);margin:0;min-height:1.5em}
.rxsh{position:relative;z-index:1;width:100%;height:100%;min-height:230px;display:grid;place-items:end center}.rxsh .rxk{position:relative;left:auto;bottom:auto;transform:none;height:200px;transform-origin:50% 92%}
.rxsh.s0 .rxk{animation:rxj .14s linear infinite}.rxsh.s1 .rxk{animation:rxr 2.4s ease-in-out infinite}.rxsh.s2 .rxk{animation:rxl .9s ease-in-out infinite}.rxsh.s3 .rxk{animation:rxj2 .17s linear infinite}.rxsh.s4 .rxk{animation:rxb 4s ease-in-out infinite}
@keyframes rxj{50%{transform:translateX(3px) rotate(1.2deg)}0%,100%{transform:translateX(-3px) rotate(-1.2deg)}}@keyframes rxj2{50%{transform:translate(5px,-4px) rotate(2.2deg)}0%,100%{transform:translate(-5px,0) rotate(-2.2deg)}}
@keyframes rxr{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg) translateY(-6px)}}@keyframes rxl{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-14px) rotate(2deg)}}@keyframes rxb{50%{transform:scale(1.035)}}
.rxar{display:flex;gap:8px;justify-content:center;align-items:center;padding:12px}.rxtl{display:grid;place-items:center;width:clamp(42px,14vw,58px);height:clamp(42px,14vw,58px);border-radius:14px;background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.4);color:#e8fff6;transition:box-shadow .25s,background .25s}
.rxtl svg{width:70%;height:70%}.rxtl.mid{width:clamp(52px,17vw,70px);height:clamp(52px,17vw,70px);border-color:#f2c14e;color:#fff6c8;box-shadow:0 0 22px rgba(242,193,78,.55)}.rxtl.mid.ok{background:rgba(120,220,140,.5);box-shadow:0 0 26px rgba(120,220,140,.8)}.rxtl.mid.no{background:rgba(240,150,120,.4);box-shadow:0 0 22px rgba(240,150,120,.6)}
.rxres{text-align:center;color:#fff6d0;font-size:18px;margin:0;padding:24px}.rxres b{font:16px/1.5 var(--fh)}
.rxdirs{display:grid;grid-template-columns:1fr 1fr;gap:12px}button.rxdir{min-height:76px;border-radius:22px;background:var(--pn);color:#1f4e5a;border:2px solid rgba(43,36,24,.45);box-shadow:0 6px 14px rgba(20,14,40,.22);padding:0}button.rxdir .rxtl{background:none;border:0;width:56px;height:56px;color:inherit;margin:auto}
button.rxorb{width:min(62vw,200px);height:min(62vw,200px);min-height:0;border-radius:50%;padding:0;border:0;box-shadow:none;background:radial-gradient(circle,rgba(255,200,120,.12),rgba(255,200,120,0) 70%);position:relative}
button.rxorb i{position:absolute;inset:22%;border-radius:50%;background:radial-gradient(circle at 40% 35%,#6a4a8a,#2c1f5a);box-shadow:0 0 14px rgba(180,150,255,.25);transition:background .15s,box-shadow .15s}
button.rxorb.on i{background:radial-gradient(circle at 40% 35%,#fff6c8,#ffb347 55%,#e8622c);box-shadow:0 0 50px 18px rgba(255,190,90,.7)}
.rxsc{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:8px}button.rxscb{display:block;min-height:0;padding:10px 12px;text-align:left;font:inherit;border-radius:16px;background:var(--p2);color:var(--ink);border:2px solid transparent;box-shadow:none}
button.rxscb b{display:block;font:9px/1.5 var(--fh);margin-bottom:3px}button.rxscb small{font:12px/1.4 var(--fb)}button.rxscb.on{background:var(--pn);border-color:var(--gold);box-shadow:0 0 14px rgba(242,193,78,.4)}
.rxnote{text-align:center;font-size:13px;border:2px dashed var(--gold);border-radius:14px;padding:8px}
.rxwave{position:absolute;left:0;right:0;bottom:14px;z-index:2;display:flex;gap:6px;justify-content:center;align-items:flex-end;height:28px}.rxwave i{width:6px;border-radius:3px;background:rgba(255,246,208,.8);animation:rxw 2.4s ease-in-out infinite}
.rxwave i:nth-child(1){height:10px}.rxwave i:nth-child(2){height:22px;animation-delay:-.5s}.rxwave i:nth-child(3){height:14px;animation-delay:-1s}.rxwave i:nth-child(4){height:24px;animation-delay:-1.5s}.rxwave i:nth-child(5){height:12px;animation-delay:-2s}@keyframes rxw{50%{transform:scaleY(.4)}}
.rxlg{position:relative;overflow:hidden;border-width:2px;border-radius:20px;background:radial-gradient(circle at 50% 45%,#3b3a7a,#1c2248)}.rxlg svg{position:relative;height:170px;width:auto;z-index:1}.rxglow{position:absolute;left:50%;top:50%;margin:-75px 0 0 -75px;clip-path:none;border-radius:50%;width:150px;height:150px;background:radial-gradient(circle,rgba(255,236,150,.95),rgba(255,190,90,.5) 55%,rgba(255,190,90,0))}
@media(prefers-reduced-motion:reduce){button.rxc,.rxp,.rxpulse,.rxwave i,.rxsh .rxk{animation:none!important}.rxp{display:none}.rxglow{animation:none;transform:scale(.7)}button.rxc{transition:none}}
`);
return{list:LIST,stop,sounds:SND}})();
