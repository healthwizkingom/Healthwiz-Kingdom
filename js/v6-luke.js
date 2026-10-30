/* v6: Luke's tutorials (owner's request, 2026-10-30). Not part of the original.
   Every Health Hall section has a small round button with Luke's face and a red "?" at the top right. It opens a walk-through in the same
   format as Medius's tour (js/hw-04-part.js: a spotlight on one part of the page, a speech box with a typewriter line, tap or Enter to go
   on, SKIP or Esc to leave), but it stays on the page you are on and Luke does the talking. Medius keeps the app-wide tour and the
   Wizard's Counsel; Luke is the Wannabe Wizard: clumsy and unsure of himself, yet what he says is right.
   Luke's faces are assets/img/luke-ask.webp (the owner's expression sheet, seven faces of 80 × 80, made by tools/art/make_hall_art.py).
   Nothing is saved, no health number is shown or changed, and nothing here gives advice beyond what each page already says. */
const HWLuke=(()=>{
const FACE={happy:0,confused:1,nervous:2,determined:3,surprised:4,tired:5,excited:6};
/* topic → [page title, steps]; a step is [face, spotlight selector ('~text' finds a card by its words; '' none), what Luke says] */
const T={
food:['Food',[
  ['nervous','',"Oh! H-hi, I'm Luke. I almost tripped on the stairs on my way here, sorry. This is Food. It's simpler than it looks, I promise."],
  ['determined','#fpick',"Tap every food you ate, as many as you like, then press LOG SELECTED one time. I used to log them one by one and lose count. Don't do that."],
  ['confused','~ADD MORE FOOD',"Can't find your food? Use ADD MORE FOOD. The calories and nutrients come from the menu list, so they're estimates, not lab results. I check the portion size twice anyway."],
  ['happy','',"A messy day is not a failed day. A meal you forget to log never lowers your score. And if you forgot yesterday, the Time Machine in Statistics lets you fill it in."]]],
water:['Water',[
  ['happy','',"Water! My favourite, because it's the one thing I can't mess up. Mostly."],
  ['excited','#wq',"This is the Well of Life. Every drink you log fills it. It's a picture of your own entries, so it can't tell you how hydrated you really are."],
  ['determined','~ADD WATER',"Tap +250 mL for one glass, or type an exact amount. Forgot one earlier? 'Log for…' saves it under an earlier day. Everyone needs a different amount, so your goal is only a guide."]]],
sleep:['Sleep',[
  ['tired','',"Sleep. I'm not very good at it. That's why the sleepy face is in the corner. Let me show you how it works."],
  ['determined','~LOG SLEEP',"Enter the time you went to bed and the time you woke up, and the hours work themselves out. A night that crosses midnight counts for the morning you woke."],
  ['excited','#dbatc',"Your sleep powers the Dream Battle: more rest, stronger knight. It's a game, not a medical check."],
  ['confused','',"Forgot last night? Use 'Woke up on…' to file it under the right day, or open the Time Machine in Statistics and tap the empty day."]]],
stair:['Stairs',[
  ['nervous','',"Stairs! I fall up them more than I climb them. Still, I know this page really well."],
  ['determined','#st-casual',"Check in by GPS when you're at a staircase on campus, or enter your steps and climbs by hand. Both count the same."],
  ['surprised','~SEAL THE WORKOUT',"For a workout, add your pulse before and after. A heart rate read from a device keeps its own time. Never push through dizziness or pain. Stop and rest, okay?"],
  ['excited','',"Every climb adds stones to your Ascent Monument in Statistics. Timed climbs can be raced against your own best in the Dueling Arena, which is under the Hall of Heroes on the Quest Board."]]],
exercise:['Training Hall',[
  ['happy','',"The Training Hall! The knight does all the hard parts. I just watch and take notes."],
  ['determined','.xwrap',"Pick a goal, then a muscle, then a move. The tutorial under it shows how the move goes. It only logs when you press finish, so stopping halfway costs nothing."],
  ['nervous','',"Calories shown for a workout are estimates from the move and your time, not measurements. Warm up first, go gently, and stop if something hurts."]]],
stress:['Stress',[
  ['nervous','',"The Mind Forest. I get nervous a lot, so I'm kind of an expert. Sadly."],
  ['determined','main .card:not([hidden])',"Pick the face that fits how you feel right now. It sets a starting number out of ten. Then pick something that helps, and rate again afterwards."],
  ['happy','',"Once a week there's a longer check-in, the DASS-21. It's a check-in, not a diagnosis. If things feel heavy, please talk to someone you trust. That's the wise part, I promise."]]],
body:['Body & Energy',[
  ['happy','',"Body & Energy! Nobody gets graded here, don't worry."],
  ['determined','#bh',"Enter your height, weight, age and how active you are. HealthWiz works out your BMI and a daily calorie goal. Both are estimates."],
  ['confused','',"BMI is only a screening number. It can't see muscle or growth, and it isn't a diagnosis. Saving it for an earlier date doesn't change your profile."]]],
stats:['Statistics',[
  ['surprised','',"Statistics! So many charts. I once read them upside down. Let me show you the good parts."],
  ['excited','#tm-door',"The Time Machine. Slide back through days, weeks and months. A day is empty? Tap its cell, or open the day and press a LOG button, and the usual page opens set to that day. Heart rate, runs and workouts are measured live, so they can't be added later."],
  ['determined','#mn-door',"The Ascent Monument. Every metre you climb adds stones to it, and it's built only from climbs you logged. Open it to watch your tower grow."],
  ['nervous','#rptcard',"WEEKLY REPORT makes a one-page summary of a week. Press PRINT OR SAVE AS PDF. It stays on this device, but a printed copy holds private health information, so keep it to yourself."],
  ['happy','',"Timed a climb? Race your own best time in the Dueling Arena, under the Hall of Heroes on the Quest Board. The rival is only your own echo, so it can't be unfair."]]],
lab:['Science Laboratory',[
  ['nervous','',"The Science Laboratory! I wear goggles in here. They don't help, but I feel official."],
  ['determined','',"Be Your Own Experiment: ask a question, make a prediction, plan how you'll measure it, then your own saved logs become the observations. Nothing is copied or changed."],
  ['surprised','',"With fewer than 3 observations in a group it says 'not enough evidence yet'. That's honest, not a failure. And a result never proves anything. A few days from one person can't."],
  ['excited','',"The Evidence Trial, the Evidence Vault and the Uncertainty Engine are on this page too. They show where facts come from and how sure each estimate is. Any climbing is optional: stop for dizziness, chest pain or faintness."]]],
duel:['Dueling Arena',[
  ['excited','',"The Dueling Arena! You race a replay of your own earlier climb, your Shadow Echo. Only you, never anyone else."],
  ['determined','#dueling-arena',"Choose a staircase. Two saved climbs on the same stairs with the same number of steps can be compared. The Echo is your previous climb, or your fastest one."],
  ['nervous','',"Times come from the Stair Sense timer, or from the workout time, which is only kept in half-minutes. Equal within that counts as a tie. There's no XP for speed: slower is fine."],
  ['happy','',"The live race runs beside Stair Sense in the Observatory. It's just you against you. I lose to my own echo all the time."]]],
time:['Time Machine',[
  ['surprised','',"The Time Machine! It shows only what you really saved. No guessing."],
  ['determined','#tmcard',"Pick Day, Week or Month, then slide back or use EARLIER and LATER. A day with nothing saved says 'not logged', never zero."],
  ['excited','',"Missed a day? Tap its empty cell, or open the day and press a LOG button. The usual page opens already set to that day, and USE NOW takes you back to today."],
  ['nervous','',"Heart rate, runs and workouts are measured live, so they can't be added later. COMPARE puts this period beside the one before, but it can't tell you why they differ."]]],
monument:['Ascent Monument',[
  ['excited','',"The Ascent Monument! Every metre you climb adds stones to a tower. It's built only from climbs you logged."],
  ['happy','',"A climb with no known rise is counted on its own line, because I won't make up a height. Log your climbs in the Observatory or Stairs and watch it grow."]]],
score:['Health Score',[
  ['nervous','',"The Health Score! One number made from lots of habits. Don't panic over it. I certainly don't."],
  ['determined','~HOW YOUR SCORE ADDS UP',"Each area you logged counts by its weight. An area you didn't log is left out, not counted as zero. Your BMI alone never makes a score: you need at least one real log from the day."],
  ['excited','',"Press the Health Orb and Medius reads your advice out of it. SHOW RECOMMENDATIONS skips the show. It's a habit score, not a medical result."]]]
};
let root,sp,tx,pg,fc,cn,i=0,ty=0,full='',topic='',opener=null;
const face=n=>'background-position:'+(FACE[n]*100/6)+'% 0';
const find=t=>!t?null:t[0]==='~'?[...document.querySelectorAll('main .card,main .snap,main .wq,main .hub,main header,main .pxp')].find(e=>e.textContent.toUpperCase().includes(t.slice(1).toUpperCase())):document.querySelector(t);
function place(){if(!root)return;const s=T[topic][1][i],el=find(s[1]);let r=null;if(el){el.scrollIntoView({block:'center'});r=el.getBoundingClientRect()}
  if(r&&r.width&&r.height){sp.style.cssText='display:block;left:'+(r.left-6)+'px;top:'+(r.top-6)+'px;width:'+(r.width+12)+'px;height:'+(r.height+12)+'px'}else sp.style.display='none';
  root.style.background=r&&r.width?'':'rgba(8,12,30,.6)';cn.className='twc '+(r&&r.top>innerHeight-r.bottom?'top':'bot')+(r&&r.left+r.width/2<innerWidth*.3?' rt':'')}
function show(){const L=T[topic][1],s=L[i];fc.style.cssText=face(s[0]);setTimeout(place,60);clearInterval(ty);full=s[2];
  if(typeof HWMotion!=='undefined'&&HWMotion.reduced())tx.textContent=full;else{let n=0;tx.textContent='';ty=setInterval(()=>{if(!root){clearInterval(ty);return}n+=2;tx.textContent=full.slice(0,n);if(n>=full.length)clearInterval(ty)},16)}
  pg.textContent=(i+1)+' / '+L.length+' · tap anywhere ▶'}
function end(){clearInterval(ty);if(root)root.remove();root=null;removeEventListener('resize',place);removeEventListener('keydown',key);if(opener&&document.contains(opener))opener.focus({preventScroll:true});opener=null}
function next(){if(tx.textContent.length<full.length){clearInterval(ty);tx.textContent=full;return}if(++i>=T[topic][1].length){end();return}show()}
function key(e){if(e.key==='Escape')end();else if(/^(Enter| |ArrowRight)$/.test(e.key)){e.preventDefault();next()}}
function start(k){if(root||!T[k])return;topic=k;i=0;opener=document.activeElement;root=document.createElement('div');root.id='tut';root.className='lktut';root.setAttribute('role','dialog');root.setAttribute('aria-label',"Luke's tutorial: "+T[k][0]);
  root.innerHTML='<div class="tsp"></div><button class="tsk" type="button">SKIP TUTORIAL ✕</button><div class="twc bot"><div class="twz lkz"><span class="lkface" role="img" aria-label="Luke, the Wannabe Wizard"></span><i></i></div><div class="tbx"><b>LUKE, THE WANNABE WIZARD</b><p></p><small></small></div></div>';
  document.body.appendChild(root);sp=root.querySelector('.tsp');tx=root.querySelector('p');pg=root.querySelector('small');cn=root.querySelector('.twc');fc=root.querySelector('.lkface');
  root.onclick=next;root.querySelector('.tsk').onclick=e=>{e.stopPropagation();end()};addEventListener('resize',place);addEventListener('keydown',key);show()}
acts.lkq=d=>start(d.t);

/* ---------- the button, at the top right of each section ---------- */
const TOPIC={lab:'lab',time:'time',monument:'monument',food:'food',water:'water',sleep:'sleep',exercise:'exercise',stress:'stress',body:'body',stats:'stats',score:'score'};
const btn=k=>'<button type="button" class="lkq" data-a="lkq" data-t="'+k+'" aria-label="Ask Luke about '+esc(T[k][0])+'"><span class="lkface" aria-hidden="true" style="'+face('confused')+'"></span><i aria-hidden="true">?</i></button>';
function wrap(k){const p=pages[k];if(!p)return;pages[k]=function(){const h=p.apply(this,arguments);
  if(k==='stress'&&S.sq&&S.sq.ph&&S.sq.ph!=='start')return h;   // inside a stress quest the header stays out of the way
  const m=/<button type="button" class="g sm hwq"[^>]*>\?<\/button>/.exec(h);
  // Luke's button sits above the page's own "?" in the same 44 px column, so the row keeps its height and the title keeps its width
  return m&&h.indexOf('id="hwcr"')>=0?h.replace(m[0],'<span class="lkcol">'+btn(TOPIC[k])+m[0]+'</span>'):'<div class="lkrow">'+btn(TOPIC[k])+'</div>'+h}}
Object.keys(TOPIC).forEach(wrap);
// the Dueling Arena is a card on the Quest Board: Luke's button sits at the top of the card
{const p=pages.quests;if(p)pages.quests=function(){const h=p.apply(this,arguments),k='<p class="mut duelintro">';return h.indexOf(k)>=0?h.replace(k,'<div class="lkrow">'+btn('duel')+'</div>'+k):h}}   // Stairs is a section of the Campus page: its button sits in that section's header (js/v6-campus-stairs.js)

HWUI.css('luke',`
.lkface{display:block;width:100%;aspect-ratio:1;background:url(assets/img/luke-ask.webp) 0 0/700% 100% no-repeat;image-rendering:pixelated}
.lkz{flex:0 0 clamp(80px,18vw,130px)}.lkz .lkface{border:4px solid var(--ln);background-color:#f3eefb;box-shadow:0 0 14px rgba(255,226,122,.5)}
.lkq{position:relative;flex:0 0 auto;width:44px;height:44px;min-width:44px;min-height:44px;margin:0;padding:0;border:3px solid var(--ln);border-radius:50%;background:#f3eefb;overflow:visible;box-shadow:2px 2px 0 var(--ln)}
.lkq .lkface{border-radius:50%;overflow:hidden}
.lkq i{position:absolute;right:-8px;top:-8px;width:22px;height:22px;display:grid;place-items:center;border:2px solid #fff;border-radius:50%;background:#d8262f;color:#fff;font:700 14px/1 var(--fb);font-style:normal;box-shadow:0 1px 3px rgba(0,0,0,.5)}
.lkq:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
.lkrow{display:flex;justify-content:flex-end;margin:0 0 6px;padding-right:8px}
.lkcol{display:flex;flex-direction:column;gap:0;flex:0 0 auto;margin:-12px 0}.lkcol .lkq,.lkcol .hwq{margin:0}.lkcol .lkq{width:40px;height:40px;min-width:40px;min-height:40px;align-self:center}
.lktut .tbx b{color:var(--vio)}
@media(max-width:480px){.lkz{flex-basis:72px}}
`);
return{topics:Object.keys(T),start,find,btn}})();
