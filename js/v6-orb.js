/* v6: the Health Orb. Medius reads the Health Score page's recommendations out of a glowing orb. Not part of the original.
   Nothing here calculates health numbers. Every figure comes from HWScore.compute() (js/v6-score.js: the same indicators, goals
   and thresholds that make the score), so the cards always match the logged data. A card is only made from an indicator that
   has data; an area with no data becomes a "Log to unlock" card that says what to log. No score, goal or threshold is changed.

   THE SCENE   the artwork is assets/img/orb-scene.webp (the wizard at his glowing orb in the library), shown on one canvas
               (288 × 432 pixels, scaled with image-rendering: pixelated). Everything that moves is pixel light drawn by code on top:
     0.0–1.0 s  the staff crystal glows and sparks, candle flames flicker, dust of light drifts up from the orb
     1.0–4.0 s  mana gathering: pixel particles spiral in from the shelves, candles, ceiling, floor and the staff; a rune
                circle turns on the table; threads of mana run from both hands to the orb; the room slowly draws in
     4.0–5.6 s  charging: the orb brightens, pulses, shifts blue → violet → gold; rings, runes and sparks, denser stream
     5.6–6.4 s  burst: flash, expanding energy ring, glowing fragments, a little shake
     6.4–7.6 s  the particles rise and the scene fades into the quest cards, which unfurl one after another
   Particles are capped by HWMotion (Performance mode ≈ 25 %); the loop only runs while the scene is on the page and ends
   when it is not. Reduced motion (device or in-app) or Animations Off: no animation at all, the button reveals the cards.
   SKIP (or Esc) reveals them at once. After the first reading the cards are shown directly (st.s.orb = 1, an optional key like
   the Motion settings, so no schema step); REPLAY ORB READING plays the scene again. */
const HWOrb=(()=>{
const D=document,W=288,H=432,TAU=Math.PI*2,K0=W/843,OX=193,OY=296,OR=58;   // the picture (843 × 1264) is drawn at 288 × 432; positions below are in those pixels
const TB=5.6,TO=6.4,TE=7.6,TG=4;                       // burst, transition out, end, gather→charge
const r1=x=>Math.round(x*10)/10,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};
const mk=(w,h)=>{const c=D.createElement('canvas');c.width=w;c.height=h;return c};
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],dz=(x,y)=>(BAY[(y&3)*4+(x&3)]+.5)/16;
const PAL=['#7ff3ff','#4fe0c8','#b48cff','#ffd86b','#ffffff'];

/* =====================================================================================================================
   RECOMMENDATION CARDS  (data → plain-language cards; same areas and thresholds as recs() in js/v6-score.js)
   ===================================================================================================================== */
const AREA={nutrition:['food','Nutrition','#ffd86b'],water:['water','Hydration','#7ff3ff'],activity:['stairs','Activity','#4fe0c8'],
  sleep:['sleep','Sleep','#b48cff'],stress:['stress','Stress','#ff9ec7'],bmi:['balance','BMI','#a8c4ff'],heart:['heart','Heart rate','#ff7a8a']};
const GO={nutrition:['food','Open Nutrition'],water:['water','Open Water'],activity:['stair','Open Stairs'],sleep:['sleep','Open Sleep'],
  stress:['stress','Open Mind Forest'],bmi:['bmi','Open BMI'],heart:['stair','Open Stairs']};
const LBL={fv:'Fruit & veg',water:'Water',kcal:'Calorie intake',macro:'Macronutrients',stairs:'Stairs',burn:'Calories burned',hr:'Resting heart rate',sleep:'Sleep',bmi:'BMI',stress:'Stress'};
const ROWS={nutrition:['fv','kcal','macro'],water:['water'],activity:['stairs','burn'],sleep:['sleep'],stress:['stress'],bmi:['bmi'],heart:['hr']};
const EFFORT={Easy:1,Moderate:2,Gradual:3};

function cards(I){
  const K=HWScore.K,age=+st.p.age||16,SRg=SR(age),out=[],plural=(n,w)=>n+' '+w+(n===1?'':'s');
  const add=(id,o)=>{const a=AREA[id];out.push(Object.assign({id,ic:a[0],area:a[1],ac:a[2],miss:false,todo:[],rows:[],prog:[],note:'',go:GO[id],urgency:100,effort:'Easy'},o))};
  const rows=id=>ROWS[id].map(k=>[LBL[k],I[k]?I[k].txt:'not logged yet']);
  const low=(...k)=>Math.min(...k.map(x=>I[x]).filter(Boolean).map(x=>x.sub));
  const miss=(id,title,why,todo,effort)=>add(id,{miss:true,title,why,todo,effort:effort||'Easy'});

  /* nutrition: fruit & veg, calories, macronutrients (the focus is the one furthest from its goal) */
  if(!I.fv&&!I.kcal&&!I.macro)miss('nutrition','Log what you eat','No meals are logged for this period, so the orb cannot read your eating yet.',['Log a meal in Nutrition.','Pick fruit stalls and vegetable dishes so they count as portions.']);
  else{
    const c=[['fv',I.fv],['kcal',I.kcal],['macro',I.macro]].filter(x=>x[1]).sort((a,b)=>a[1].sub-b[1].sub)[0][0];
    const o={urgency:low('fv','kcal','macro'),rows:rows('nutrition')};
    if(c==='fv'){const v=I.fv.val,n=Math.ceil(K.FV_GOAL-v);
      Object.assign(o,v<K.FV_GOAL?{title:'Add more fruit and vegetables',why:'You logged about '+r1(v)+' of '+K.FV_GOAL+' portions a day. One portion is about 80 g.',
        todo:['Add '+plural(n,'more portion')+' a day.','Have fruit with breakfast.','Add a vegetable side at lunch and dinner.']}
        :{title:'Keep your fruit and veg going',why:'You reached '+K.FV_GOAL+' portions of fruit and vegetables a day.',todo:['Keep a mix of colours on your plate.']},
        {prog:[{txt:r1(v)+' of '+K.FV_GOAL+' portions a day',pct:v/K.FV_GOAL*100}]})}
    else if(c==='kcal'){const v=I.kcal.val,g=+st.s.kcal,r=v/g,pr={txt:Math.round(v)+' of '+g+' kcal a day',pct:r*100};
      Object.assign(o,r<.9?{title:'Eat enough for your day',why:'Your logged meals average '+Math.round(v)+' kcal. Your goal is '+g+' kcal.',todo:['Eat regular meals, including breakfast.','This gives you energy for study and exercise.']}
        :r>1.1?{title:'Ease back on calories',why:'Your logged meals average '+Math.round(v)+' kcal. That is above your '+g+' kcal goal.',todo:['Choose smaller portions of fried and sweet foods.','Drink water instead of sweet drinks.']}
        :{title:'Your calories are on target',why:'Your logged meals average '+Math.round(v)+' of your '+g+' kcal goal.',todo:['Keep eating regular meals.']},{prog:[pr]})}
    else{const m=I.macro,bad=K.macroOff(m.val).filter(x=>x.off>=1);
      Object.assign(o,bad.length?{title:'Balance protein, carbs and fat',why:bad.map(x=>x.n+' is '+Math.round(x.v)+'% of your energy (healthy range '+x.lo+'–'+x.hi+'%).').join(' '),
        todo:[bad.some(x=>x.k==='F'&&x.v>x.hi)?'Pick grilled, steamed or soup dishes more often than fried or santan dishes.':bad.some(x=>x.k==='P'&&x.v<x.lo)?'Add eggs, fish, chicken, tauhu, tempe or dhal to your meals.':'Fill half your plate with vegetables, a quarter with rice or noodles and a quarter with protein.'],effort:'Moderate'}
        :{title:'Protein, carbs and fat look balanced',why:'All three are inside their healthy ranges.',todo:['Keep a mix of foods on your plate.']})}
    o.note='Menu nutrient values are estimates. Meal advice is general, not a diet plan.';
    add('nutrition',o)}

  /* hydration */
  if(!I.water)miss('water','Log your water','No water is logged for this period, so hydration is not counted yet.',['Log each glass or bottle in Water.']);
  else{const v=I.water.val,g=+st.s.water,n=Math.ceil((g-v)/250);
    add('water',Object.assign({urgency:I.water.sub,rows:rows('water'),prog:[{txt:Math.round(v)+' of '+g+' mL a day',pct:v/g*100}],note:'Needs vary by person, climate and activity. More than your target is not better.'},
      v<g?{title:'Drink a little more water',why:'You logged '+Math.round(v)+' of your '+g+' mL goal a day.',todo:['About '+n+' more glass'+(n===1?'':'es')+' (250 mL) would reach your goal.','Sip some water with each meal.']}
        :{title:'Your water is on target',why:'You logged '+Math.round(v)+' mL a day. Your goal is '+g+' mL.',todo:['Keep sipping through the day.']}))}

  /* activity: stairs and calories burned */
  if(!I.stairs&&!I.burn)miss('activity','Start with an easy stair climb','No stair climbs or runs are logged for this period.',['Pick a MILD stairway (below 26°).','Climb for about 10 minutes at a comfortable pace.','Log it in Stairs.'],'Moderate');
  else{const last=K.lastWorkout(),lv=last?last.diff:null,lvn=(K.CLASSN[lv]||'current').toLowerCase(),o={urgency:low('stairs','burn'),rows:rows('activity'),effort:'Moderate',note:'Stop and rest if you feel dizzy, faint or have chest pain.',prog:[]};
    if(I.stairs)o.prog.push({txt:Math.round(I.stairs.val)+' of '+K.STAIR_GOAL+' effort-steps a day',pct:I.stairs.val/K.STAIR_GOAL*100});
    if(I.burn)o.prog.push({txt:Math.round(I.burn.val)+' of '+K.BURN_GOAL+' kcal burned a day',pct:I.burn.val/K.BURN_GOAL*100});
    if(I.burn)o.note+=' Calories burned are estimates (stairs + runs). About '+K.BURN_GOAL+' a day (1,000 a week) is a common health target.';
    if(!I.stairs)Object.assign(o,{title:'Add an easy stair climb',why:'No stair climbs are logged for this period.',todo:['Pick a MILD stairway (below 26°).','Climb for about 10 minutes at a comfortable pace.']});
    else if(I.stairs.sub<60)Object.assign(o,{title:'Add one more climb a day',why:'Your stair effort is '+Math.round(I.stairs.val)+' of '+K.STAIR_GOAL+' effort-steps a day.',
      todo:['Do one more climb a day'+(lv==='MILD'||!lv?' on a mild stairway (below 26°).':', staying at your '+lvn+' level.')]});
    else if(lv==='MILD')Object.assign(o,{title:'Ready for a step up?',why:'Your stair effort is on target at a mild level.',todo:['When mild climbs feel easy, try a MODERATE stairway (26°–31.2°) for part of the session.']});
    else if(lv==='MODERATE')Object.assign(o,{title:'Keep your stair effort steady',why:'Your stair effort is on target at a moderate level.',todo:['Keep it up.','Try a vigorous stairway (above 31.2°) only if you recover comfortably.']});
    else Object.assign(o,{title:'Keep your stair effort balanced',why:'Your stair effort is on target.',todo:['Mix vigorous days with mild or moderate days so your body can recover.']});
    add('activity',o)}

  /* sleep */
  if(!I.sleep)miss('sleep','Log your sleep','No nights are logged for this period, so sleep is not counted yet.',['Log last night in the Dream Realm.'],'Easy');
  else{const v=I.sleep.val,lo=SRg[0],hi=SRg[1],o={urgency:I.sleep.sub,rows:rows('sleep'),prog:[{txt:r1(v)+' h a night (goal '+lo+'–'+hi+' h)',pct:v/lo*100}],effort:'Moderate',
      note:'Sleep goals follow AASM/CDC age recommendations. The Dream Battle and Sleep Score are game views of your logged sleep.'};
    if(v<lo)Object.assign(o,{title:'Sleep a little longer',why:'You average '+r1(v)+' h a night. For your age, '+lo+'–'+hi+' h is recommended.',todo:['Keep a fixed bedtime.','Put your phone away 30 minutes before sleep.']});
    else if(v>hi)Object.assign(o,{title:'Keep your wake-up time steady',why:'You average '+r1(v)+' h a night. That is more than the recommended '+lo+'–'+hi+' h.',todo:['Wake up at the same time each day.','Add some daytime activity if you still feel tired.']});
    else Object.assign(o,{title:'Your sleep is in range',why:'You average '+r1(v)+' h a night. The recommended range is '+lo+'–'+hi+' h.',todo:['Keep your regular bedtime.'],effort:'Easy'});
    add('sleep',o)}

  /* stress */
  if(!I.stress)miss('stress','Do a stress check-in','No stress check-in is logged for this period.',['Do a check-in in the Mind Forest.']);
  else{const v=I.stress.val,o={urgency:I.stress.sub,rows:rows('stress'),note:'A self check-in, not a diagnosis. In an emergency call 999; Befrienders KL 03-7627 2929.'};
    if(v>=7)Object.assign(o,{title:'Take a breather',why:'Your stress rating is '+I.stress.txt+'. That is high.',todo:['Try the Calming Grove breathing.','Take a short walk.','Talk to a friend, a lecturer or the college counsellor.']});
    else if(v>=4)Object.assign(o,{title:'Plan short breaks',why:'Your stress rating is '+I.stress.txt+'. That is moderate.',todo:['Plan short breaks between study blocks.','Keep a regular bedtime.']});
    else Object.assign(o,{title:'Your stress is low',why:'Your stress rating is '+I.stress.txt+'.',todo:['Keep the habits that help: sleep, movement and time with friends.']});
    add('stress',o)}

  /* BMI */
  if(!I.bmi)miss('bmi','Add your height and weight','BMI is not in your score yet.',['Enter your height and weight in the BMI tool.']);
  else{const v=I.bmi.val,o={urgency:I.bmi.sub,rows:rows('bmi'),effort:'Gradual',note:'BMI is a screening number only. It ignores muscle and body shape.'+(age<19?' Under 19, BMI is read against age and sex charts, so treat this as a guide only.':'')};
    if(v<18.5)Object.assign(o,{title:'Support a steady, healthy weight',why:'Your BMI is '+v.toFixed(1)+'. That is below the 18.5–24.9 healthy range.',todo:['Eat regular meals with enough energy and protein.','A doctor or dietitian can give personal advice.']});
    else if(v<25)Object.assign(o,{title:'Your BMI is in the healthy range',why:'Your BMI is '+v.toFixed(1)+'. The healthy range is 18.5–24.9.',todo:['Keep regular meals and daily movement.','Get enough sleep.']});
    else Object.assign(o,{title:'Make gradual, steady changes',why:'Your BMI is '+v.toFixed(1)+'. That is above the 18.5–24.9 range.',todo:['Add more stairs and walking.','Eat more vegetables and fewer sugary drinks.','A doctor or dietitian can give personal advice.']});
    add('bmi',o)}

  /* heart */
  if(!I.hr)miss('heart','Record your resting pulse','Heart rate is not in your score yet.',['Count your pulse at rest before a stair workout and log it.'],'Easy');
  else{const v=I.hr.val,last=K.lastWorkout(),o={urgency:I.hr.sub,rows:rows('heart'),effort:'Gradual',note:'Caffeine, sleep and worry all change your pulse. Chest pain, fainting or a worrying pulse: speak to a healthcare professional.'};
    if(last)o.rows.push(['Last workout',last.hb+' → '+last.ha+' BPM'+(last.pct!=null?' ('+Math.round(last.pct)+'% of your heart-rate reserve; maximum ≈ 220 − age)':'')]);
    if(v<=80)Object.assign(o,{title:'Keep your heart fit',why:'Your resting heart rate is '+Math.round(v)+' BPM. The typical range is 60–100.',todo:['Keep up regular stair climbing.']});
    else if(v<=100)Object.assign(o,{title:'Help your pulse settle',why:'Your resting heart rate is '+Math.round(v)+' BPM. That is in the typical 60–100 range, on the higher side.',todo:['Climb stairs regularly.','Sleep well and go easy on caffeine.','Changes can take weeks.']});
    else Object.assign(o,{title:'Re-check your resting pulse',why:'Your resting heart rate is '+Math.round(v)+' BPM. That is above 100.',todo:['Sit quietly for 5 minutes, then count again.','If it stays high, speak to a health professional.']});
    add('heart',o)}
  return out}

// most urgent first (lowest sub-score); areas without data last. Priority labels follow the order.
function rank(list){
  const have=list.filter(c=>!c.miss).sort((a,b)=>a.urgency-b.urgency),miss=list.filter(c=>c.miss);let n=0;
  have.forEach((c,i)=>{c.tag=c.urgency<80&&n<3?(n++?['next','NEXT STEP']:['start','START HERE']):['keep','KEEP GOING']});
  miss.forEach(c=>c.tag=['info','LOG TO UNLOCK']);
  return{main:have[0]||null,more:have.slice(1),miss}}

const EFF=e=>'<span class="v6oef" title="Effort: '+e+'"><span class="v6opp" aria-hidden="true">'+[1,2,3].map(i=>'<i'+(i<=EFFORT[e]?' class="on"':'')+'></i>').join('')+'</span>'+e+'</span>';
const prog=p=>'<div class="v6opg"><div class="v6opt">'+esc(p.txt)+'</div><div class="v6opb" role="progressbar" aria-label="'+esc(p.txt)+'" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(clamp(p.pct,0,100))+'"><i style="width:'+clamp(p.pct,0,100)+'%"></i></div></div>';
function card(c,i,o){
  const main=o&&o.main,li=c.todo.map(t=>'<li>'+esc(t)+'</li>').join('');
  return '<article class="v6oc'+(main?' main':'')+(c.miss?' miss':'')+(fresh?' fresh':'')+'" style="--ac:'+c.ac+';--i:'+i+'" data-area="'+c.id+'">'
  +'<div class="v6oct"><span class="v6oi">'+HWPixel.icon(c.ic,{s:main?3:2})+'</span><div class="v6ocm"><span class="v6otag t-'+c.tag[0]+'">'+c.tag[1]+'</span><span class="v6oar">'+esc(c.area)+'</span></div>'+EFF(c.effort)+'</div>'
  +'<h4 class="v6ot">'+esc(c.title)+'</h4>'
  +'<p class="v6oy"><b>Why it matters</b>'+esc(c.why)+'</p>'
  +'<div class="v6ow"><b>What to do next</b><ul>'+li+'</ul></div>'
  +c.prog.map(prog).join('')
  +(c.rows.length||c.note?'<details class="v6od"><summary>More detail</summary>'+(c.rows.length?'<dl>'+c.rows.map(r=>'<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>').join('')+'</dl>':'')+(c.note?'<p class="v6on">'+esc(c.note)+'</p>':'')+'</details>':'')
  +'<button type="button" class="v6ogo'+(main?'':' g')+'" data-a="go" data-v="'+c.go[0]+'">'+c.go[1].toUpperCase()+' →</button></article>'}

/* =====================================================================================================================
   SECTION  (what the Health Score page shows in place of the plain list)
   ===================================================================================================================== */
let phase=(typeof st!=='undefined'&&st&&st.s&&st.s.orb)?'done':'idle',fresh=false;
const scene=(title,msg,btns)=>'<div class="card v6os" id="v6orb"><h3>'+HWPixel.icon('wizard')+' '+title+'</h3>'
  +'<div class="v6ocv"><canvas id="v6orbc" width="'+W+'" height="'+H+'" role="img" aria-label="Pixel art: the wizard Medius beside a glowing mana orb in his library"></canvas></div>'
  +'<p class="v6osm" id="v6orbs" role="status" aria-live="polite">'+msg+'</p><div class="v6obt">'+btns+'</div></div>';
function section(C,plain){
  if(C.score==null)return empty();
  let R;try{R=rank(cards(C.I))}catch(e){return plain+'<div class="card"><small class="mut">The orb could not be read just now. The advice above is the same, in plain form.</small></div>'}
  boot();
  if(phase==='play')return scene('MEDIUS READS THE ORB','Medius is reading your logged habits…','<button type="button" class="g" data-a="orbskip">SKIP ANIMATION</button>');
  if(phase==='idle')return scene('THE HEALTH ORB','Medius can read your logged habits in the orb and reveal your next steps. Your score and its table are above. This reading adds plain advice for each area.',
    '<button type="button" data-a="orbgo">READ MY HEALTH ORB</button><button type="button" class="g" data-a="orbshow">SHOW RECOMMENDATIONS</button>');
  const when=HWScore.K.win()==='day'?'today':'the last 7 days',f=fresh;let i=0;
  const html='<section class="v6o'+(f?' fresh':'')+'" id="v6o" aria-labelledby="v6oh"><div class="v6oh"><h3 id="v6oh" tabindex="-1">'+HWPixel.icon('scroll')+' YOUR HEALTH QUESTS</h3>'
    +'<button type="button" class="g" data-a="orbre">'+HWPixel.icon('sheep')+' REPLAY ORB READING</button></div>'
    +'<p class="v6osub">Read from what you logged '+when+'. The orb reads your score and its numbers above. Start with the first quest.</p>'
    +(R.main?card(R.main,i++,{main:1}):'')
    +(R.more.length?'<h4 class="v6osec">MORE QUESTS</h4><div class="v6og">'+R.more.map(c=>card(c,i++)).join('')+'</div>':'')
    +(R.miss.length?'<h4 class="v6osec">LOG TO UNLOCK</h4><p class="v6osub">These areas are not in your score yet. The orb cannot read what is not logged, so nothing is guessed.</p><div class="v6og">'+R.miss.map(c=>card(c,i++)).join('')+'</div>':'')
    +'<small class="v6ofoot">General wellness guidance based only on your logged entries. It does not promise any health result and is not medical advice. Concerning symptoms belong with a healthcare professional.</small></section>';
  fresh=false;return html}
function empty(){
  return '<section class="v6o"><div class="card v6os v6oe"><h3>'+HWPixel.icon('wizard')+' THE ORB IS DARK</h3>'
   +'<p>Medius needs something you logged before he can read your recommendations. Nothing is made up. Log any of these and the orb lights up:</p>'
   +'<div class="v6obt">'+[['food','Meals'],['water','Water'],['stair','Stairs'],['sleep','Sleep'],['stress','Stress'],['bmi','BMI']].map(x=>'<button type="button" class="g" data-a="go" data-v="'+x[0]+'">'+x[1].toUpperCase()+'</button>').join('')+'</div></div></section>'}

/* =====================================================================================================================
   SCENE
   ===================================================================================================================== */
let IMG=null,imgOK=false;
function loadImg(){if(IMG)return;IMG=new Image();IMG.onload=()=>{imgOK=true};IMG.src='assets/img/orb-scene.webp'}
// places in the picture (converted from its own pixels): the staff crystal, the two hands, candle flames, the orb's stand
const CRYS=[254,77],HANDS=[[239,202],[113,205]],FLAME=[[10,137],[34,153],[8,284],[31,316]];

let raf=0,T=0,last=0,lost=0,cv=null,g=null,sim=null,seed=1;
const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const dens=()=>HWMotion.count(100)/100;
const charge=()=>{if(phase!=='play')return .3;if(T<1)return .08*T/1+.1*0;if(T<TG)return .1+.4*(T-1)/3;if(T<TB)return .5+.5*Math.pow((T-TG)/(TB-TG),1.3);return T<TO?1:lerp(1,.75,clamp((T-TO)/(TE-TO),0,1))};
const RUNES=['..#..,.###.,..#..,.#.#.,#...#','#...#,.#.#.,..#..,.#.#.,#...#','#####,..#..,.###.,..#..,#####','.#.#.,#####,.#.#.,#####,.#.#.','..#..,.#.#.,#...#,.#.#.,..#..','##.##,#.#.#,..#..,#.#.#,##.##'].map(s=>s.split(',').map(r=>[...r].map(c=>c==='#')));
const rune=(x,y,i,col,a)=>{g.globalAlpha=a;g.fillStyle=col;RUNES[i%6].forEach((r,yy)=>r.forEach((on,xx)=>{if(on)g.fillRect(Math.round(x)-5+xx*2,Math.round(y)-5+yy*2,2,2)}));g.globalAlpha=1};
const px=(x,y,s,col,a)=>{g.globalAlpha=a;g.fillStyle=col;g.fillRect(Math.round(x),Math.round(y),s,s)};

function spawn(){   // a mana mote from somewhere in the room, spiralling in to the orb
  const r=rnd();let x,y;
  if(r<.28){const e=rnd();if(e<.4){x=rnd()*W;y=-2}else if(e<.7){x=-2;y=rnd()*H*.7}else{x=W+2;y=rnd()*H*.7}}
  else if(r<.5){x=rnd()*W;y=rnd()*H*.26}                     // the bookshelves
  else if(r<.66){const f=FLAME[Math.floor(rnd()*FLAME.length)];x=f[0];y=f[1]}
  else if(r<.8){x=CRYS[0];y=CRYS[1]}                           // the staff crystal
  else if(r<.9){x=20+rnd()*60;y=H*.8+rnd()*H*.15}            // the open book
  else{x=W*(.6+rnd()*.4);y=H*.84+rnd()*H*.14}                // the potions
  sim.P.push({k:0,sx:x,sy:y,t0:T,dur:1.3+rnd()*1.1,dir:rnd()<.5?-1:1,sw:.8+rnd()*.9,col:PAL[Math.floor(rnd()*4)],s:rnd()<.55?3:2})}
function spawnUp(){const a=rnd()*TAU,r=rnd()*OR*.8;sim.P.push({k:1,sx:OX+Math.cos(a)*r,sy:OY+Math.sin(a)*r,tx:W*.5+(rnd()-.5)*70,ty:-8,t0:T,dur:.8+rnd()*.5,dir:rnd()<.5?-1:1,amp:30+rnd()*50,col:PAL[Math.floor(rnd()*5)],s:rnd()<.5?3:2})}
function posOf(p,u){
  if(p.k===0){const e=Math.pow(u,1.6),vx=p.sx-OX,vy=p.sy-OY,r=Math.hypot(vx,vy)*(1-e),a=Math.atan2(vy,vx)+p.dir*p.sw*e*TAU*.7;return[OX+Math.cos(a)*r,OY+Math.sin(a)*r*.9]}
  const e=u*u*(3-2*u),dx=p.tx-p.sx,dy=p.ty-p.sy,L=Math.hypot(dx,dy)||1,o=Math.sin(Math.PI*u)*p.amp*p.dir;return[p.sx+dx*e-dy/L*o,p.sy+dy*e+dx/L*o]}
function frags(){
  for(let i=0;i<Math.max(14,Math.round(90*dens()));i++){const a=rnd()*TAU,v=40+rnd()*90;sim.F.push({x:OX,y:OY,vx:Math.cos(a)*v*1.5,vy:Math.sin(a)*v*1.5-15,life:.7+rnd()*.7,age:0,s:rnd()<.2?5:rnd()<.5?3:2,col:PAL[Math.floor(rnd()*5)]})}}
function step(dt){
  const d=dens(),cap=HWMotion.cap();
  if(T>=1&&T<TB){const rate=(T<TG?22+(T-1)/3*40:62+(T-TG)/(TB-TG)*80)*d;sim.acc+=rate*dt;while(sim.acc>=1){sim.acc--;if(sim.P.length<cap)spawn()}}
  if(T>=TB&&!sim.burst){sim.burst=1;frags();sim.R.push({t0:T,mx:260,dur:.85,w:4,col:'#fff1a8'},{t0:T+.12,mx:190,dur:.7,w:2,col:'#7ff3ff'});sim.fl=T;sim.pulse=1;[784,988,1175].forEach((f,i)=>setTimeout(()=>sfx(f,.12),i*90))}
  if(T>=TO&&T<TE-.3){sim.up+=110*d*dt;while(sim.up>=1){sim.up--;if(sim.P.length<cap+60)spawnUp()}}
  if(T>=TB&&T<TO){sim.rt+=dt;if(sim.rt>.16){sim.rt=0;sim.R.push({t0:T,mx:OR+50,dur:.6,w:2,col:'#ffd86b'})}}
  else if(T>1&&T<TB){sim.rt+=dt;const every=.55-.3*charge();if(sim.rt>every){sim.rt=0;sim.R.push({t0:T,mx:OR+64,dur:.9,w:2,col:charge()>.7?'#ffd86b':'#7ff3ff',in:T<TG})}}
  sim.P=sim.P.filter(p=>{const u=(T-p.t0)/p.dur;if(u>=1){if(p.k===0)sim.pulse=Math.min(1,sim.pulse+.05);return false}return true});
  sim.F=sim.F.filter(f=>{f.age+=dt;f.vy+=50*dt;f.vx*=1-1.2*dt;f.x+=f.vx*dt;f.y+=f.vy*dt;return f.age<f.life});
  sim.R=sim.R.filter(r=>T-r.t0<r.dur);sim.pulse=Math.max(0,sim.pulse-dt*2.5);
  const sf=!sim.s1&&T>=1?(sim.s1=1,[392,523]):!sim.s2&&T>=TG?(sim.s2=1,[587,698,880]):null;if(sf)sf.forEach((f,i)=>setTimeout(()=>sfx(f,.1),i*110))}
const MSG=[[TG,'Mana gathers from the room…'],[TB,'The orb is charging…'],[TO,'The orb bursts with light!'],[TE,'Your quests appear…']];
function say(){const m=T<1?'Medius studies your logged habits…':(MSG.find(x=>T<x[0])||MSG[3])[1],el=D.getElementById('v6orbs');if(el&&sim.msg!==m){sim.msg=m;el.textContent=m}}

function ring(cx,cy,r,col,a,w){if(r<1||a<=0)return;const n=Math.max(12,Math.round(r*TAU*.9));g.globalAlpha=a;g.fillStyle=col;for(let i=0;i<n;i++){const t=i/n*TAU;g.fillRect(Math.round(cx+Math.cos(t)*r),Math.round(cy+Math.sin(t)*r),w,w)}g.globalAlpha=1}
/* the orb in the picture is brightened from outside: a swirl of light inside its disc and a halo around it, both on a 2 × 2
   pixel grid, added over the artwork. The stronger the charge, the whiter and more golden it gets. */
const OS=64,OB=mk(OS*2,OS*2),obx=OB.getContext('2d'),obi=obx.createImageData(OS*2,OS*2);
const S0=[[30,90,190],[60,150,230],[120,200,250],[190,240,255]],S1=[[90,50,190],[150,100,240],[200,150,255],[240,215,255]],S2=[[200,150,56],[255,200,90],[255,232,150],[255,255,230]];
function drawOrb(ch,pulse){
  const d=obi.data,mix=(a,b,t)=>a.map((c,i)=>c.map((v,k)=>lerp(v,b[i][k],t))),ramp=ch<.5?mix(S0,S1,ch*2):mix(S1,S2,(ch-.5)*2),R=OR*(1+.05*pulse)/2,halo=(26+ch*30)/2,C=OS-.5,gain=.18+ch*.75;
  for(let y=0;y<OS*2;y++)for(let x=0;x<OS*2;x++){const dx=x-C,dy=y-C,r=Math.hypot(dx,dy),i=(y*OS*2+x)*4;let a=0,c=ramp[2];
    if(r<=R){const an=Math.atan2(dy,dx),sw=Math.sin(an*3+r*.18-T*(1.5+ch*4))+Math.sin(an*2-r*.25+T*(1+ch*2.5)),v=clamp((sw+2)/4*.6+(1-r/R)*.5,0,.999);c=ramp[Math.floor(v*4)];a=Math.floor((.25+v*.75)*gain*4)/4;if(r>R-1)a*=.5}
    else if(r<R+halo){const t=1-(r-R)/halo;a=Math.floor(t*t*(.25+.6*ch+.25*pulse)*5)/5*.9}
    d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=a*255}
  obx.putImageData(obi,0,0);g.imageSmoothingEnabled=false;g.drawImage(OB,OX-OS*2,OY-OS*2,OS*4,OS*4)}
function drawScene(){
  const pl=phase==='play',ch=charge(),pulse=pl?sim.pulse:.35+.35*Math.sin(T*2.2)*.5,still=HWUI.reduced();
  let sx=0,sy=0;if(pl&&T>TB&&T<TB+.35){sx=Math.round((hash(T*60)-.5)*5);sy=Math.round((hash(T*61)-.5)*3)}
  const zm=pl?1+.06*clamp(T/TB,0,1)*(T<TO?1:clamp(1-(T-TO)/.8,0,1)):1;   // the room slowly draws in toward the orb
  g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);
  g.setTransform(zm,0,0,zm,OX*(1-zm)+sx,OY*(1-zm)+sy);
  if(imgOK)g.drawImage(IMG,0,0,W,H);else{g.fillStyle='#14183f';g.fillRect(0,0,W,H)}
  // candle flames flicker, the staff crystal glows and throws sparks
  g.globalCompositeOperation='lighter';
  FLAME.forEach((f,i)=>{const h=hash(Math.floor(T*9)+i*7);px(f[0]-4,f[1]-5,8,'#ff9a3c',.1+.1*h)});
  const gl=.5+.35*Math.sin(T*3)+(pl?ch*.4:0);px(CRYS[0]-6,CRYS[1]-6,12,'#7ff3ff',.18*gl);px(CRYS[0]-2,CRYS[1]-2,4,'#ffffff',.35*gl);
  if(!still)for(let i=0;i<6;i++){const u=(T*.5+i/6)%1;px(CRYS[0]+Math.sin(T*1.7+i*2)*14+(i-3)*3,CRYS[1]-10-u*70,i%3?2:3,i%2?'#ffd86b':'#7ff3ff',(1-u)*.9)}
  g.globalCompositeOperation='source-over';
  // rune circle turning on the table, runes drifting round the orb (behind it, then in front)
  const gather=pl&&T>=1&&T<TO?clamp((T-1)/1.2,0,1):pl?0:.25;
  for(let i=0;i<36;i++){const t=T*.7+i/36*TAU;px(OX+Math.cos(t)*104,OY+OR+14+Math.sin(t)*17,i%5?2:3,i%5?'#4fe0c8':'#ffd86b',gather*(.3+.5*(i%5?0:1)))}
  const nr=pl?Math.round(clamp((ch-.1)*9,0,6)):2,orbit=i=>{const t=T*.8*(1+ch)+i/nr*TAU;return[t,Math.sin(t)]};
  for(let i=0;i<nr;i++){const[t,s2]=orbit(i);if(s2<=0)rune(OX+Math.cos(t)*88,OY+s2*30-8,i,i%2?'#ffd86b':'#7ff3ff',.3+.3*ch)}
  g.globalCompositeOperation='lighter';drawOrb(ch,pulse);g.globalCompositeOperation='source-over';
  for(let i=0;i<nr;i++){const[t,s2]=orbit(i);if(s2>0)rune(OX+Math.cos(t)*88,OY+s2*30-8,i,i%2?'#ffd86b':'#7ff3ff',.55+.4*ch)}
  g.globalCompositeOperation='lighter';
  if(pl){
    // both hands glow, and threads of mana run from them to the orb
    if(T>1&&T<TB){HANDS.forEach((h,k)=>{px(h[0]-8,h[1]-8,16,'#7ff3ff',.12+.2*ch);for(let i=0;i<8;i++){const u=(T*1.2+i/8+k*.5)%1;px(lerp(h[0],OX+(k?-30:30),u),lerp(h[1],OY-10,u)-Math.sin(Math.PI*u)*26,2,i%2?'#7ff3ff':'#b48cff',.85*Math.sin(Math.PI*u))}})}
    sim.R.forEach(r=>{const u=(T-r.t0)/r.dur;if(u<0)return;const rad=r.in?lerp(r.mx,OR,u):lerp(OR,r.mx,1-Math.pow(1-u,2));ring(OX,OY,rad,r.col,(r.in?u:1-u)*.9,r.w)});
    sim.P.forEach(p=>{const u=(T-p.t0)/p.dur;if(u<0)return;for(let k=2;k>=0;k--){const uu=u-k*.045;if(uu<0)continue;const q=posOf(p,uu);px(q[0],q[1],k?2:p.s,p.col,(k?.35/k:1)*Math.min(1,u*4)*(p.k?1-u*.4:.4+.6*u))}});
    sim.F.forEach(f=>{const a=1-f.age/f.life;px(f.x,f.y,f.s,f.col,a);if(f.s>2)px(f.x-f.vx*.03,f.y-f.vy*.03,2,f.col,a*.5)});
    g.globalCompositeOperation='source-over';const fa=sim.burst?clamp(1-(T-sim.fl)/.4,0,1):0;if(fa>0){g.globalAlpha=fa*.85;g.fillStyle='#fff8e0';g.fillRect(-20,-20,W+40,H+40);g.globalAlpha=1}
  }else{for(let i=0;i<12;i++){const u=(T*.18+i/12)%1,a=i*2.4;px(OX+Math.cos(a+T*.3)*(20+u*80),OY-u*90+Math.sin(a)*20,2,i%2?'#7ff3ff':'#b48cff',(1-u)*.5)}}
  g.globalCompositeOperation='source-over';g.globalAlpha=1;g.setTransform(1,0,0,1,0,0)}

function frame(now){
  raf=0;const el=D.getElementById('v6orbc');
  if(!el){if(!lost)lost=now;if(now-lost>700){stop(true);return}raf=requestAnimationFrame(frame);return}
  lost=0;if(el!==cv){cv=el;g=el.getContext('2d');g.imageSmoothingEnabled=false}
  const idle=phase==='idle';
  if(idle&&last&&now-last<66){raf=requestAnimationFrame(frame);return}
  const dt=Math.min(.1,last?(now-last)/1000:.016);last=now;T+=dt;
  if(phase==='play'){step(dt);say()}
  const b=el.getBoundingClientRect();
  if(!(idle&&(D.hidden||b.bottom<0||b.top>innerHeight)))drawScene();
  if(phase==='play'){const v=clamp((T-(TE-.7))/.7,0,1),w=el.parentNode;if(w)w.style.opacity=1-v*v;if(T>=TE){finish(false);return}}
  raf=requestAnimationFrame(frame)}
function stop(abort){if(raf)cancelAnimationFrame(raf);raf=0;lost=0;last=0;if(abort&&phase==='play'){phase='idle';sim=null}}
// called after every render of the page: finds the canvas and starts, or paints one frame
function boot(){requestAnimationFrame(()=>{
  const el=D.getElementById('v6orbc');if(!el||phase==='done')return;
  loadImg();cv=el;g=el.getContext('2d');g.imageSmoothingEnabled=false;
  if(phase==='idle'&&HWUI.reduced()){drawScene();if(!imgOK)IMG.addEventListener('load',()=>{if(D.getElementById('v6orbc')===el)drawScene()});return}
  if(!raf){last=0;raf=requestAnimationFrame(frame)}})}
function finish(instant){
  stop(false);phase='done';sim=null;fresh=!instant&&!HWUI.reduced();st.s.orb=1;save();render();
  setTimeout(()=>{const h=D.getElementById('v6oh');if(h){h.focus({preventScroll:true});h.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'})}},30)}
acts.orbgo=()=>{if(phase==='play')return;
  if(HWUI.reduced()){finish(true);return}
  phase='play';T=0;seed=20261009;sim={P:[],F:[],R:[],acc:0,up:0,rt:0,pulse:0,burst:0,fl:0,msg:'',s1:0,s2:0};render();
  setTimeout(()=>{const e=D.getElementById('v6orb');if(e)e.scrollIntoView({block:'center',behavior:'smooth'})},30)};
acts.orbskip=()=>{if(phase==='play')finish(true)};
acts.orbshow=()=>{if(phase!=='done')finish(true)};
acts.orbre=()=>{if(phase==='done'){phase='idle';fresh=false;render();acts.orbgo()}};
D.addEventListener('keydown',e=>{if(e.key==='Escape'&&phase==='play'&&!e.defaultPrevented)finish(true)});

HWUI.css('orb',`
.v6os{background:linear-gradient(180deg,#0e1330,#171236);color:#f3ecd8;border-color:#06090d}
.v6os h3{color:#ffd86b;display:flex;align-items:center;gap:8px;line-height:1.7}
.v6ocv{width:100%;max-width:min(100%,420px);margin:8px auto;border:4px solid #06090d;box-shadow:0 0 0 2px #3a2f70,0 0 18px rgba(127,243,255,.18);background:#0b0e28;line-height:0;transition:opacity .2s}
.v6ocv canvas{display:block;width:100%;height:auto;aspect-ratio:${W}/${H};image-rendering:pixelated;image-rendering:crisp-edges;image-rendering:pixelated}
.v6osm{font-size:15px;line-height:1.5;margin:8px 0;min-height:2.6em;color:#f3ecd8}
.v6obt{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}.v6obt button{flex:1 1 200px}
.v6oe p{font-size:15px;line-height:1.5;color:#f3ecd8}
.v6o{--bg1:#0e1330;--tx:#f3ecd8;--mu:#b9c3d6;margin:0 0 14px}
.v6oh{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;margin:4px 0}
.v6oh h3{display:flex;align-items:center;gap:8px;font-size:12px;line-height:1.7;margin:0;outline-offset:4px}
.v6osub{font-size:14px;line-height:1.5;margin:6px 0 12px;opacity:.9}
.v6osec{font:10px/1.7 var(--fh);margin:22px 0 8px;padding-left:10px;border-left:6px solid #4fe0c8;color:var(--ink);letter-spacing:.04em}
.v6og{display:grid;gap:14px;grid-template-columns:1fr}
@media(min-width:760px){.v6og{grid-template-columns:1fr 1fr}}
.v6oc{position:relative;background:linear-gradient(165deg,#161c45 0%,#10112f 60%,#1a1240 100%);color:#f3ecd8;border:4px solid #06090d;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--ac) 45%,transparent),inset 0 4px 0 var(--ac),5px 5px 0 #06090d,0 0 22px color-mix(in srgb,var(--ac) 16%,transparent);padding:14px 14px 14px;display:flex;flex-direction:column;gap:10px;min-width:0;overflow:hidden}
.v6oc:before{content:"";position:absolute;right:-26px;top:-26px;width:90px;height:90px;background:radial-gradient(circle,color-mix(in srgb,var(--ac) 30%,transparent),transparent 65%);pointer-events:none}
.v6oc.main{padding:18px 16px 16px;gap:12px}.v6oc.main .v6ot{font-size:14px}
.v6oc.miss{opacity:.96;border-style:dashed}
.v6oct{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.v6oi{display:flex;align-items:center;justify-content:center;padding:4px;background:#0a0c24;border:3px solid var(--ac);box-shadow:0 0 10px color-mix(in srgb,var(--ac) 40%,transparent)}
.v6ocm{display:flex;flex-direction:column;gap:4px;flex:1 1 90px;min-width:0}
.v6otag{align-self:flex-start;font:9px/1.5 var(--fh);padding:3px 6px;border:2px solid #06090d;color:#10112f;background:#9aa6c4}
.t-start{background:#ffd86b;box-shadow:0 0 8px rgba(255,216,107,.6)}.t-next{background:#7ff3ff}.t-keep{background:#4fe0c8}.t-info{background:#c9b8ff}
.v6oar{font:9px/1.5 var(--fh);color:var(--ac);text-transform:uppercase}
.v6oef{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#f3ecd8;white-space:nowrap}
.v6opp{display:inline-flex;gap:2px}.v6opp i{width:7px;height:7px;background:#2a2f5e;border:1px solid #06090d}.v6opp i.on{background:var(--ac)}
.v6ot{font:12px/1.7 var(--fh);color:#fff;margin:0;overflow-wrap:anywhere}
.v6oy,.v6ow{font-size:15px;line-height:1.5;margin:0;color:#f3ecd8}
.v6oy b,.v6ow b{display:block;font:9px/1.7 var(--fh);color:var(--ac);margin-bottom:3px;text-transform:uppercase}
.v6ow ul{margin:0;padding:0;list-style:none}.v6ow li{position:relative;padding:3px 0 3px 18px}
.v6ow li:before{content:"";position:absolute;left:2px;top:.75em;width:7px;height:7px;background:var(--ac);box-shadow:0 0 6px var(--ac)}
.v6ow{background:rgba(255,255,255,.05);border-left:4px solid var(--ac);padding:8px 10px}
.v6opg{display:flex;flex-direction:column;gap:4px}.v6opt{font-size:13px;color:#b9c3d6}
.v6opb{height:12px;background:#080a20;border:2px solid #06090d;box-shadow:inset 0 0 0 1px #2a2f5e}.v6opb i{display:block;height:100%;background:var(--ac);box-shadow:0 0 8px var(--ac);transition:width .6s}
.v6od summary{cursor:pointer;font-size:14px;font-weight:700;color:var(--ac);padding:8px 0;min-height:44px;display:flex;align-items:center}
.v6od dl{margin:0 0 6px}.v6od dl div{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 10px;padding:4px 0;border-bottom:1px dashed #3a3f78;font-size:14px}.v6od dt{color:#b9c3d6}.v6od dd{margin:0;font-weight:700;text-align:right}
.v6on{font-size:13px;line-height:1.5;color:#b9c3d6;margin:6px 0 0}
.v6ogo{align-self:flex-start;margin-top:2px}
.v6oc button.g{background:#1f2658;color:#f3ecd8;border-color:#7f8bc2}
.v6o :focus-visible,.v6os :focus-visible{outline:3px solid #8fc7ff;outline-offset:2px}
.v6ofoot{display:block;margin-top:16px;font-size:13px;line-height:1.5;color:var(--mut)}
.v6oc.fresh{animation:v6ounf .8s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--i)*150ms)}
.v6oc.fresh:after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%);transform:translateX(-120%);animation:v6osw 1s ease-out both;animation-delay:calc(var(--i)*150ms + .3s);pointer-events:none}
@keyframes v6ounf{from{opacity:0;transform:translateY(22px) scale(.94);filter:brightness(2)}to{opacity:1;transform:none;filter:none}}
@keyframes v6osw{to{transform:translateX(120%)}}
@media(prefers-reduced-motion:reduce){.v6oc.fresh,.v6oc.fresh:after{animation:none!important}.v6opb i{transition:none}}
`);
return{section,cards,rank,get phase(){return phase}}})();
