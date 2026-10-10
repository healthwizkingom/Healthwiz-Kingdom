/* v6 (exercise page): the Wizard's Training Hall, opened from the EXERCISE tile in the Health Hall. Not part of the original.
   One page, one screen per step (S.xs.step):
     goal  Medius asks why you are training: Hypertrophy, Calisthenics, Strength, Endurance or Custom (reps, sets, rest).
           Calisthenics offers bodyweight moves only. The RUNNING ROAD (GPS run tracker, js/v6-running.js, and the Runners'
           Board, js/v6-runboard.js) is shown below, here and on the next screen; the old 'run' route opens it.
     map   MUSCLE & MOVE, one screen (Muscle and Learn were merged): the knight's muscle map (front and back). Tap a muscle:
           it lights up in mana-teal with the muscles that work with it, and its moves are listed. Choosing a move shows
           its tutorial right below: a looping 4-frame pixel animation (a still first frame with reduced motion), three
           cues, the reps for the chosen goal and a stop rule. The same choice is offered as a list for keyboard and screen readers.
     run   the session: set counter, reps done, a rest countdown, FINISH, and "I feel dizzy" / "Chest pain", which stop the
           session at once and show help. Nothing is logged for a stopped session.
     done  the finish card: minutes, sets and reps (what you did), then a calorie, VO2 and kJ ESTIMATE, then the game reward.
   Art: assets/img/exercise/moves.webp (one row per move, 4 frames of 96 px) and muscles.webp (the map and one mask per muscle),
   made by tools/art/make_exercise.py, which also writes the MAP-DATA block below (which muscle is under each map pixel).
   Moves added after the art was drawn (push-ups, pull-up, chin-up, pike push-up, sit-up) have no sprite row yet (sprite: null):
   the tutorial shows a pixel icon and says so. The same goes for Abdominals, which has no mask on the map (NOMASK): it is
   chosen from the muscle list and lights nothing. Both need the Blender pipeline (tools/art/) to be drawn properly.

   One saved entry per finished session, a normal entry in st.e:
     {c:'exercise', v: minutes, m:{goal, ex, name, mus, sets, reps:[per set], rt:'6–8', rest, fail, dur, met, code,
       kcal:{v, lo, hi} | null, vo2, kj | null}}
   The goal settings (and the user's own numbers for Calisthenics and Custom) are kept in st.s.xg (settings are merged with
   their defaults on load, so no schema step is needed). Health numbers and game rewards stay apart: the calorie, VO2 and kJ lines
   are estimates from MET values; the XP and the glow are a game reward and say so.

   Calories: kcal = MET × confirmed weight (kg) × hours, as in js/v6-running.js; HWRun.weight() only, never a guess.
   MET, 2024 Adult Compendium of Physical Activities (conditioning exercise):
     02050  6.0  resistance (free weights), power lifting or body building, vigorous effort  → Hypertrophy, Strength, Custom ≤ 8 reps
     02054  3.5  resistance training, multiple exercises, 8–15 reps at varied resistance       → Endurance, Custom > 8 reps
     02022  3.8  calisthenics (push-ups, pull-ups, lunges), moderate effort                    → Calisthenics
   VO2 ≈ MET × 3.5 mL/kg/min (1 MET = 3.5 mL O2 per kg per minute); energy ≈ VO2 (L/min) × minutes × 20.1 kJ per L of O2. */
const HWEx=(()=>{
/*MAP-DATA*/const MAPW=64,MAPH=96,MAPRLE={front:'1436.2a4.2a56.2a4.2a55.3a4.3a54.3a4.3a53.4a4.3a53.4a4.3a54.3a4n4a53.3a4n2a57.a4na58.a4na58.f3nef52.2f2.2f2e2ne3f2.2f44.f9e2n9ef41.f10e2o10e41.f3e15o4e42.h4e12o4eh42.3h5e5p5e3he42.f4h12p4hf42.5h12pf4h42.3h2fhe8peh2f3h41.4hf.e10pe.f4h40.4h2.12p2.4h40.i2h3.12p2.p2hi39.jl21.2lj38.j2l19.3lj36.2j3l20.3lj35.2j2l22.2l2j35.3l21.4l35.3l23.4l34.3l24.3l33.3l25.4l34.l26.l43.4q5.5q50.4q.q3.5q50.14q50.6q.7q49.7q2.6q49.7q2.7q48.7q2.7q48.6q3.7q48.6q4.6q48.6q4.6q48.6q4.6q48.5q5.6q48.5q6.5q47.6q6.5q48.5q6.5q494.s63.s63.s1129.',back:'1436.a6.a119.a8.a54.a8.a53.a9.a53.2a8.a54.11a53.9a57.6a58.6a58.6a52.2f2.fg6a2f2.2f44.f7g6b7gf41.f8g6b8g41.f8g6b8g42.m2g3c2g6b2g2c3gm42.3m3c2g6bg3c4m42.3m5c2d2bdcg4c2m43.3m5c6d5c3m41.i4m4c6d3c.c3m41.4m.fmg8dgm.4m41.4m.f2c8d2c2.3mi40.3m3.2c8d2c2.4m39.2kmc3.c9d2c3.2mkj38.2kl4.c10dc3.l3k36.4kl4.2c9dc4.l3k35.3kl22.3kj34.3kl21.2l3k33.4k23.l3k33.3kl24.l3k31.4k25.l4k32.kl26.lk43.12r51.13r51.6rq7r49.q6r.q6r49.q6r2.6r50.6r2.6r49.6r3.6rq48.6r3.6r49.6r4.5r49.6r4.6r48.6r4.6r48.5r5.6r48.5r6.5r47.6r6.5r48.4r7.5r175.5s8.5s46.5s8.5s46.5s8.5s46.5s8.5s45.6s8.5s45.5s9.5s45.5s10.4s45.5s10.4s1111.'};/*/MAP-DATA*/
const ico=(n,s)=>HWPixel.icon(n,s||1);
const btn=(a,t,cls,x)=>'<button type="button" class="'+(cls||'')+'" data-a="'+a+'"'+(x||'')+'>'+t+'</button>';
const MET_ML=3.5,KJ_PER_L=20.1;
const SHEET={moves:'assets/img/exercise/moves.webp',map:'assets/img/exercise/muscles.webp'};

/* ---------- goals ---------- */
const GOALS={
  hyp:{n:'Hypertrophy',rt:'6–8',lo:6,sets:2,rest:120,fail:1,met:6.0,code:'02050',why:'Build muscle size'},
  cal:{n:'Calisthenics',user:1,rest:60,met:3.8,code:'02022',why:'Bodyweight only, your own reps'},
  str:{n:'Strength',rt:'2–4',lo:2,sets:2,rest:180,fail:1,met:6.0,code:'02050',why:'Lift heavier'},
  end:{n:'Endurance',rt:'12+',lo:12,sets:4,rest:45,met:3.5,code:'02054',why:'Last longer'},
  cus:{n:'Custom',user:1,own:1,met:null,why:'Set your own reps, sets and rest'}};
const GK=['hyp','cal','str','end','cus'];
const clampI=(v,a,b,d)=>{v=Math.round(+v);return isFinite(v)&&v>=a&&v<=b?v:d};
function prefs(){const s=st.s.xg&&typeof st.s.xg==='object'?st.s.xg:{},c=s.c&&typeof s.c==='object'?s.c:{},k=s.k&&typeof s.k==='object'?s.k:{};
  return{g:GK.indexOf(s.g)>=0?s.g:null,c:{reps:clampI(c.reps,1,50,10),sets:clampI(c.sets,1,10,3),rest:clampI(c.rest,15,300,90)},k:{reps:clampI(k.reps,1,50,10),sets:clampI(k.sets,1,10,3)}}}
function keep(p){st.s.xg={g:p.g,c:p.c,k:p.k};save()}
/** Doctor-note gate (js/v6-conditions.js): for some conditions, sets to failure wait for a doctor's OK. */
const gated=()=>typeof HWCond!=='undefined'&&HWCond.stairsHidden();
/** The chosen goal as numbers: {k, n, rt, lo, sets, rest, fail, met, code}. */
function plan(k,p){p=p||prefs();k=k||p.g||'hyp';const G=GOALS[k];
  if(k==='cal')return{k,n:G.n,rt:String(p.k.reps),lo:p.k.reps,sets:p.k.sets,rest:G.rest,fail:0,met:G.met,code:G.code};
  if(k==='cus'){const hi=p.c.reps<=8;return{k,n:G.n,rt:String(p.c.reps),lo:p.c.reps,sets:p.c.sets,rest:p.c.rest,fail:0,met:hi?6.0:3.5,code:hi?'02050':'02054'}}
  return{k,n:G.n,rt:G.rt,lo:G.lo,sets:G.sets,rest:G.rest,fail:G.fail&&!gated()?1:0,met:G.met,code:G.code,gate:G.fail&&gated()}}
const restTxt=s=>s>=60?(s%60?Math.floor(s/60)+' min '+(s%60)+' s':s/60+' min'):s+' s';

/* ---------- muscles and moves ---------- */
// [id, name, view, move ids, muscles that work with it]
const MUS=[
  ['traps','Traps','back',['shrug'],['upperback']],
  ['upperback','Upper back','back',['row_sup'],['lats','reardelt','biceps']],
  ['lats','Lats','back',['row_neu','pullup','chin'],['upperback','biceps','reardelt']],
  ['erectors','Erector spinae','back',['back_raise'],['hamstrings']],
  ['frontdelt','Front delt','front',['press','front_raise','pike'],['sidedelt','triceps','upperchest']],
  ['sidedelt','Side delt','front',['lat_raise'],['frontdelt','traps']],
  ['reardelt','Rear delt','back',['rear_fly'],['upperback','traps']],
  ['biceps','Biceps','front',['curl','chin'],['brachialis','brachioradialis','forearmflex']],
  ['brachialis','Brachialis','front',['hammer'],['brachioradialis','biceps']],
  ['brachioradialis','Brachioradialis','front',['hammer'],['brachialis','biceps']],
  ['forearmext','Forearm extensors','back',['wrist_ext'],['brachioradialis']],
  ['forearmflex','Forearm flexors','front',['wrist_curl'],[]],
  ['triceps','Triceps','back',['pushdown','oh_ext','skull','dips','pushup'],['frontdelt']],
  ['upperchest','Upper chest','front',['incline','decline'],['frontdelt','triceps','midchest']],
  ['midchest','Mid chest','front',['flat','pushup'],['upperchest','lowerchest','frontdelt','triceps']],
  ['lowerchest','Lower chest','front',['dips','inclinepu'],['midchest','triceps']],
  ['quads','Quads','front',['squat','leg_ext'],['erectors']],
  ['hamstrings','Hamstrings','back',['leg_curl'],['calves']],
  ['calves','Calves','back',['calf'],[]],
  ['abs','Abdominals','front',['situp'],[]]]; // the last muscle has no mask on the map (NOMASK)
const MI=id=>MUS.findIndex(m=>m[0]===id);
const NOMASK={abs:1}; // muscles with no mask in muscles.webp: chosen from the list, nothing lights on the map
const PAIR={brachialis:'brachioradialis',brachioradialis:'brachialis'}; // lit together, both at full strength
// id: [name, sprite row (null = not drawn yet), cue lines, bodyweight: 1 = needs no weights, so Calisthenics offers it]
const MOVES={
  shrug:['Dumbbell shrug',0,['Stand tall, dumbbells at your sides.','Lift your shoulders straight up to your ears.','Pause, then lower slowly. Do not roll the shoulders.']],
  row_sup:['Dumbbell row, palms forward',1,['Hinge at the hips, back flat, knees soft.','Palms face forward. Pull the elbows back past your ribs.','Squeeze the shoulder blades, then lower with control.']],
  row_neu:['Dumbbell row, palms in',2,['Hinge at the hips, back flat, knees soft.','Palms face each other. Pull the elbows close along your sides.','Lead with the elbows, then lower slowly.']],
  back_raise:['Back raise',3,['Hips on the pad, heels locked, arms crossed.','Lower your chest slowly toward the floor.','Raise until your body is a straight line. Do not arch past it.'],1],
  press:['Shoulder press',4,['Dumbbells at shoulder height, elbows under the wrists.','Press straight up until the arms are long.','Lower back to the shoulders. Keep your ribs down.']],
  front_raise:['Front raise',5,['Stand tall, dumbbells in front of your thighs.','Raise the arms forward to shoulder height.','Lower slowly. No swinging.']],
  lat_raise:['Lateral raise',6,['Stand tall, slight bend in the elbows.','Raise the arms out to the sides to shoulder height.','Lead with the elbows, lower slowly.']],
  rear_fly:['Dumbbell rear delt fly',7,['Hinge forward, back flat, dumbbells hanging.','Open the arms out wide, slight bend in the elbows.','Squeeze at the top, lower slowly.']],
  curl:['Bicep curl',8,['Elbows pinned to your sides, palms forward.','Curl the dumbbells up to your shoulders.','Lower all the way down slowly.']],
  hammer:['Hammer curl',9,['Palms face each other, elbows at your sides.','Curl up with the thumbs on top.','Lower all the way down slowly.']],
  wrist_ext:['Dumbbell wrist extension',10,['Sit, forearms on your thighs, palms down.','Lift the back of the hand up, only the wrist moves.','Lower slowly. Use a light weight.']],
  wrist_curl:['Dumbbell wrist curl',11,['Sit, forearms on your thighs, palms up.','Curl the hand up, only the wrist moves.','Lower slowly. Use a light weight.']],
  pushdown:['Triceps pushdown',12,['Elbows pinned to your sides at the cable.','Push down until the arms are straight.','Let the hands rise back to chest height slowly.']],
  oh_ext:['Overhead dumbbell extension',13,['Arms up, elbows pointing to the ceiling.','Lower the dumbbell behind your head.','Straighten the arms. Keep the elbows in.']],
  skull:['Skullcrusher',14,['Lie on the bench, arms straight up.','Bend only the elbows, lowering toward your forehead.','Straighten back up. Upper arms stay still.']],
  incline:['Incline dumbbell press',15,['Bench at about 30 degrees, feet flat.','Press the dumbbells up over the upper chest.','Lower until the elbows are just below the bench.']],
  flat:['Flat dumbbell press',16,['Lie flat, feet on the floor, shoulder blades back.','Press the dumbbells up over the chest.','Lower slowly, elbows at about 45 degrees.']],
  dips:['Dips',17,['Arms straight on the bars, lean slightly forward.','Lower until the upper arms are level with the bars.','Press back up. Stop higher if the shoulders hurt.'],1],
  squat:['Squat',18,['Feet shoulder-width, chest up.','Sit back and down until the thighs are about level.','Drive up through the whole foot. Knees follow the toes.'],1],
  leg_ext:['Leg extension',19,['Sit tall, pad on the front of the ankles.','Straighten the knees until the legs are long.','Lower slowly. No kicking.']],
  leg_curl:['Leg curl',20,['Lie face down, pad behind the ankles.','Curl the heels toward your hips.','Lower slowly. Hips stay on the bench.']],
  calf:['Calf raise',21,['Balls of the feet on a step, hold on for balance.','Rise up onto your toes as high as you can.','Lower the heels slowly below the step.'],1],
  // bodyweight moves added after the art was drawn: no sprite row yet (null), so the tutorial shows an icon and says the animation is not drawn
  pushup:['Push-up',null,['Hands under the shoulders, body in one straight line.','Lower your chest to just above the floor, elbows at about 45 degrees.','Press back up until the arms are straight. Do not let the hips sag.'],1],
  inclinepu:['Incline push-up',null,['Hands on a sturdy bench or rail, body in one straight line.','Lower your chest toward the edge, elbows at about 45 degrees.','Press back up. The higher the hands, the easier it is.'],1],
  decline:['Decline push-up',null,['Feet on a sturdy bench, hands on the floor under the shoulders.','Lower your chest toward the floor, body in one straight line.','Press back up. Do not let the hips sag or the lower back arch.'],1],
  pike:['Pike push-up',null,['Hips high in an upside-down V, hands shoulder-width, head between the arms.','Bend the elbows and lower the top of your head toward the floor.','Press back up through the shoulders. Keep the legs as straight as you can.'],1],
  pullup:['Pull-up',null,['Hang from a bar with an overhand grip, a little wider than the shoulders.','Pull your chest toward the bar, elbows down and back.','Lower all the way down slowly. No swinging or kicking.'],1],
  chin:['Chin-up',null,['Hang from a bar with an underhand grip, shoulder-width.','Pull until your chin is over the bar, elbows close to your sides.','Lower all the way down slowly. No swinging or kicking.'],1],
  situp:['Sit-up',null,['Lie on your back, knees bent, feet flat, arms crossed on your chest.','Curl your upper body up toward your knees, breathing out.','Lower back down with control. Do not pull on your neck.'],1]};
// Medius: one line per step (archaic voice, as elsewhere in the kingdom)
const SAY={
  goal:'Why are you training today?',
  map:'Touch a muscle, and I shall light it with mana. Its companions glow with it.',
  tut:['Slow and steady, young knight. Form is thy true strength.','Every clean rep is a spell well cast.','Breathe out as thou liftest. The magic follows the breath.'],
  run:'Rest between sets is part of the spell. I shall count it for thee.',
  done:'Well trained! Rest, drink water, and come back stronger.',
  stop:'Stop now. Thy safety matters more than any quest.'};

/* ---------- the map: which muscle is under each pixel ---------- */
const GRID={};
function grid(v){if(GRID[v])return GRID[v];const s=MAPRLE[v]||'',g=new Int8Array(MAPW*MAPH).fill(-1);let i=0,n='';
  for(const ch of s){if(ch>='0'&&ch<='9'){n+=ch;continue}const k=n?+n:1,val=ch==='.'?-1:ch.charCodeAt(0)-97;g.fill(val,i,i+k);i+=k;n=''}
  return GRID[v]=g}
/** Muscle index at map pixel (x, y), or the nearest one within 3 px; -1 for none. */
function hit(v,x,y){const g=grid(v);let best=-1,bd=99;
  for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=MAPW||Y>=MAPH)continue;const m=g[Y*MAPW+X],d=dx*dx+dy*dy;if(m>=0&&d<bd){bd=d;best=m}}
  return best}

/* ---------- page state (memory) ---------- */
const X0=()=>({step:'goal',mus:null,ex:null,set:0,reps:[],t0:0,restEnd:0,stop:null,saved:null,say:0});
const X=()=>(S.xs=S.xs||X0());
const minsOf=ms=>Math.round(ms/6000)/10; // tenths of a minute, never rounded up to look longer
const two=n=>(n<10?'0':'')+n,clock=s=>Math.floor(s/60)+':'+two(s%60);

/* ---------- estimates (shown, saved with the entry, never a measurement) ---------- */
function weight(){return typeof HWRun!=='undefined'?HWRun.weight():null}
/** → {kcal:{v,lo,hi}|null, vo2 (mL/kg/min), lmin|null, kj|null, need:'weight'|'duration'|null} */
function estimate(met,min,w){w=w===undefined?weight():w;const vo2=met*MET_ML,o={kcal:null,vo2,lmin:null,kj:null,need:null};
  if(!(min>0)){o.need='duration';return o}if(!w){o.need='weight';return o}
  const v=met*w*min/60;o.kcal={v:Math.round(v),lo:Math.round(v*.75),hi:Math.round(v*1.25)};o.lmin=vo2*w/1000;o.kj=Math.round(o.lmin*min*KJ_PER_L);return o}
const sum=L=>L.reduce((a,b)=>a+(+b||0),0);
/** Today's training for the tile and the Health Score: minutes and estimated kcal from saved sessions. */
function day(d){const L=A('exercise',d||today());return{n:L.length,min:Math.round(sum(L.map(e=>e.v))*10)/10,kcal:sum(L.map(e=>((e.m||{}).kcal||{}).v))}}

/* ---------- pieces ---------- */
const STEPS=[['goal','Goal','scroll'],['map','Muscle & move','workout'],['run','Train','energy'],['done','Reward','star']];
function runes(step){const i=STEPS.findIndex(s=>s[0]===step);
  return '<ol class="xrun" aria-label="Step '+(i+1)+' of '+STEPS.length+'">'+STEPS.map((s,j)=>'<li class="'+(j<i?'dn':j===i?'on':'')+'"'+(j===i?' aria-current="step"':'')+'>'+ico(s[2])+'<span>'+s[1]+'</span></li>').join('')+'</ol>'}
function medius(t){return '<div class="xmed" role="note"><img class="av" src="assets/img/wiz.webp" alt="" width="44" height="44"><p><b>MEDIUS</b>'+t+'</p></div>'}
const head=(icon,t)=>'<h3 class="pxh">'+ico(icon)+' '+t+'</h3>';
function stopRule(P){return P.fail?'Sets to failure: stop when one more clean rep is not possible. Stop at once for sharp pain, dizziness or chest pain.'
  :P.gate?'Stop 2–3 reps before failure: your profile lists a condition where sets to failure wait for a doctor\'s OK. Stop at once for sharp pain, dizziness or chest pain.'
  :'Stop 2 reps before your form breaks. Stop at once for sharp pain, dizziness or chest pain.'}
/** Moves for a muscle under the chosen goal: Calisthenics keeps only the bodyweight ones. */
const movesOf=(i,k)=>MUS[i][3].filter(id=>k!=='cal'||MOVES[id][3]===1);
const bodyweight=id=>!!MOVES[id]&&MOVES[id][3]===1;
const repsLine=P=>P.sets+' sets × '+P.rt+' reps'+(P.fail?' to failure':'')+' · rest '+restTxt(P.rest);

/** RUNNING ROAD: the GPS run tracker and the Runners' Board (they moved here from the Stairs page). */
function running(){if(typeof HWRun==='undefined')return '';
  return '<div class="xrunsec" id="xrun-s"><h3 class="pxh xrh" id="xrun-h">'+ico('running')+' RUNNING ROAD</h3><p class="xsm mut">Track a run by GPS: distance, time and pace.</p>'
    +HWRun.section()+(typeof HWRunBoard!=='undefined'?HWRunBoard.section():'')+'</div>'}
function goalScreen(){const p=prefs(),sel=p.g;
  const card=k=>{const G=GOALS[k],P=plan(k,p),on=sel===k;
    return '<button type="button" class="xgo'+(on?' on':'')+'" data-a="xgoal" data-k="'+k+'" aria-pressed="'+(on?'true':'false')+'"><b>'+G.n+'</b><small>'+G.why+'</small>'
      +'<span class="xgn"><i><b>'+P.rt+'</b> reps</i><i><b>'+P.sets+'</b> sets</i><i><b>'+restTxt(P.rest)+'</b> rest</i></span>'
      +(G.fail?'<em class="pxtag">'+(P.gate?'2–3 SHORT OF FAILURE':'TO FAILURE')+'</em>':'')+'</button>'};
  const num=(id,l,v,a,b,u)=>'<label class="xnum">'+l+'<span><input id="'+id+'" type="number" inputmode="numeric" min="'+a+'" max="'+b+'" value="'+v+'"> <small>'+u+'</small></span></label>';
  const own=sel==='cus'?'<div class="xown">'+num('xc-reps','Reps',p.c.reps,1,50,'per set')+num('xc-sets','Sets',p.c.sets,1,10,'sets')+num('xc-rest','Rest',p.c.rest,15,300,'seconds')+'</div>'
    :sel==='cal'?'<div class="xown">'+num('xk-reps','Reps',p.k.reps,1,50,'per set')+num('xk-sets','Sets',p.k.sets,1,10,'sets')+'</div><p class="mut xsm">Bodyweight only: do each move without dumbbells, or pick a bodyweight version you know.</p>':'';
  return runes('goal')+medius(SAY.goal)+'<div class="pxp pxn pxdk xpan">'+head('scroll','CHOOSE THY GOAL')+'<div class="xgos" role="group" aria-label="Training goal">'+GK.map(card).join('')+'</div>'+own
    +(gated()?'<p class="xsm cqnote">Your profile lists a condition where stairs wait for a doctor. Sets to failure wait too: Hypertrophy and Strength stop 2–3 reps short.</p>':'')
    +btn('xnext',sel?'CHOOSE A MUSCLE ▶':'PICK A GOAL FIRST','xpri',sel?'':' disabled')+'</div>'}

function fig(v,sel){const s=sel>=0?MUS[sel]:null,lit=s?[sel].concat(PAIR[s[0]]?[MI(PAIR[s[0]])]:[]):[],syn=s?s[4].map(MI).filter(i=>i>=0&&lit.indexOf(i)<0):[];
  const col=v==='front'?0:1,mk=i=>!NOMASK[MUS[i][0]],layer=(i,c)=>mk(i)?'<i class="xmm '+c+'" style="--c:'+col+';--r:'+(i+1)+'"></i>':'';
  return '<div class="xmfig" data-view="'+v+'" role="img" aria-label="Knight, '+v+' view'+(s&&mk(sel)?', '+s[1]+' lit':'')+'"><i class="xmm base" style="--c:'+col+';--r:0"></i>'
    +syn.map(i=>layer(i,'syn')).join('')+lit.map(i=>layer(i,'lit')).join('')+'<span class="xmv">'+v.toUpperCase()+'</span></div>'}
/** The move's animation: its sprite row, or (for moves not drawn yet) a pixel icon and a plain note. */
function sprite(id,big){const M=MOVES[id];
  if(M[1]==null)return '<div class="xspr xnone'+(big?' big':'')+'" role="img" aria-label="'+M[0]+': animation not drawn yet">'+ico('workout',3)+'<small>Animation not drawn yet. Follow the cues.</small></div>';
  return '<div class="xspr'+(HWUI.reduced()?' still':'')+(big?' big':'')+'" role="img" aria-label="'+M[0]+', '+(HWUI.reduced()?'first frame':'looping animation')+'" style="--r:'+M[1]+'"></div>'}
/** The tutorial for the chosen move, shown under the muscle's move list on the same screen. */
function learn(P){const x=X(),M=MOVES[x.ex];
  return '<div class="xlearn" id="xlearn"><h4 class="xlh">'+ico('wizard')+' '+M[0].toUpperCase()+'</h4>'
    +'<div class="xtut">'+sprite(x.ex,1)+'<div><ol class="xcue">'+M[2].map(c=>'<li>'+c+'</li>').join('')+'</ol>'
    +'<p class="xreps"><b>'+P.rt+'</b> reps <span>× '+P.sets+' sets'+(P.fail?' to failure':'')+'</span></p><p class="xsm">Rest '+restTxt(P.rest)+' between sets.</p></div></div>'
    +'<p class="warn xstop" role="note"><b>Stop rule:</b> '+stopRule(P)+'</p></div>'}
function mapScreen(){const x=X(),sel=x.mus?MI(x.mus):-1,P=plan(),s=sel>=0?MUS[sel]:null,list=s?movesOf(sel,P.k):[];
  if(x.ex&&list.indexOf(x.ex)<0)x.ex=list[0]||null; // a goal change can remove the chosen move (Calisthenics: bodyweight only)
  const chips=v=>MUS.map((m,i)=>m[2]!==v?'':'<button type="button" class="chip'+(i===sel?' on':'')+(movesOf(i,P.k).length?'':' xdim')+'" data-a="xmus" data-m="'+m[0]+'" aria-pressed="'+(i===sel?'true':'false')+'">'+m[1]+'</button>').join('');
  const moves=list.map(id=>'<button type="button" class="xex'+(x.ex===id?' on':'')+'" data-a="xex" data-e="'+id+'" aria-pressed="'+(x.ex===id?'true':'false')+'">'+ico('workout')+' '+MOVES[id][0]+'</button>').join('');
  const syn=s&&s[4].length?'<p class="xsm mut">Works with: '+s[4].map(id=>MUS[MI(id)][1]).join(', ')+(PAIR[s[0]]?' (lit together with '+MUS[MI(PAIR[s[0]])][1]+')':'')+'</p>':'';
  const note=s?(NOMASK[s[0]]?'<p class="xsm mut">'+s[1]+' are not drawn on the knight yet, so nothing lights up. The moves below still work.</p>':''):'';
  const none=s&&!list.length?'<p class="xsm cqnote">No bodyweight move for '+s[1]+' yet. Pick another muscle, or change the goal.</p>':'';
  return runes('map')+medius(x.ex?SAY.tut[x.say%SAY.tut.length]:SAY.map)+'<div class="pxp pxn pxdk xpan">'+head('workout','PICK A MUSCLE, THEN A MOVE')
    +'<p class="xsm">Goal: <b>'+P.n+'</b> · '+repsLine(P)+' '+btn('xback','CHANGE','g sm',' data-to="goal"')+'</p>'
    +'<div class="xmerge"><div class="xmap">'+fig('front',sel)+fig('back',sel)+'</div>'
    +'<div class="xside"><div class="xsel" aria-live="polite">'+(s?'<b class="xmn">'+s[1]+'</b>'+syn+note+none+'<div class="xexs">'+moves+'</div>':'<p class="mut">No muscle chosen yet. Tap one on the knight, or pick from the list.</p>')+'</div>'
    +(x.ex?learn(P):'')+'</div></div>'
    +'<details class="xlist"'+(x.list?' open':'')+'><summary>Muscle list</summary><div class="xchips"><b>FRONT</b>'+chips('front')+'</div><div class="xchips"><b>BACK</b>'+chips('back')+'</div></details>'
    +btn('xstart',x.ex?'START SESSION ▶':'PICK A MOVE FIRST','xpri',x.ex?'':' disabled')+'</div>'}

function runScreen(){const x=X(),P=plan(),M=MOVES[x.ex],done=x.reps.length,last=done>=P.sets,rest=x.restEnd>Date.now()?Math.ceil((x.restEnd-Date.now())/1000):0;
  const sets='<div class="xsets" aria-label="'+done+' of '+P.sets+' sets done">'+Array.from({length:P.sets},(_,i)=>'<i class="'+(i<done?'dn':i===done?'on':'')+'">'+(i<done?x.reps[i]:'')+'</i>').join('')+'</div>';
  const body=rest?'<div class="xrest" role="timer" aria-live="off"><small>REST</small><b id="xrest">'+clock(rest)+'</b>'+bar(rest/P.rest*100,'var(--xm)')+'</div>'+btn('xskip','SKIP REST ▶','xpri')
    :last?'<p class="xreps"><b>All '+P.sets+' sets done.</b></p>'+btn('xfin','FINISH SESSION ▶','xpri')
    :'<label class="xnum">Reps done in set '+(done+1)+'<span><input id="xrep" type="number" inputmode="numeric" min="0" max="100" value="'+P.lo+'"> <small>reps (target '+P.rt+')</small></span></label>'+btn('xset','SET '+(done+1)+' DONE ▶','xpri');
  return runes('run')+medius(SAY.run)+'<div class="pxp pxn pxdk xpan">'+head('energy','SESSION · '+M[0].toUpperCase())
    +'<div class="xhud"><span class="pxst">'+ico('quest')+'<b>'+Math.min(done+1,P.sets)+'/'+P.sets+'</b>SET</span><span class="pxst">'+ico('energy')+'<b>'+P.rt+'</b>REPS</span><span class="pxst">'+ico('alarm')+'<b id="xel">'+clock(Math.floor((Date.now()-x.t0)/1000))+'</b>TIME</span></div>'
    +sets+body+'<div class="row xrow">'+(last?'':btn('xfin','FINISH NOW','g'))+'</div>'
    +'<div class="xsafe"><b>Feel unwell?</b>'+btn('xhelp','I FEEL DIZZY','g xbad',' data-k="dizzy"')+btn('xhelp','CHEST PAIN','g xbad',' data-k="chest"')+'</div></div>'}

function helpScreen(){const x=X(),chest=x.stop==='chest';
  return medius(SAY.stop)+'<div class="pxp pxn xhelp" role="alert">'+head('warning',chest?'CHEST PAIN: STOP NOW':'DIZZY: STOP NOW')
    +'<p><b>The session has stopped. Nothing was logged.</b></p><ul>'
    +(chest?'<li>Stop exercising and sit down. Do not carry on.</li><li>Tell an adult, a teacher or the warden now.</li><li>Call <a href="tel:999"><b>999</b></a> (Malaysia) or your local emergency number if the pain is heavy or tight, spreads to the arm, jaw or back, or comes with shortness of breath, sweating or feeling faint.</li>'
      :'<li>Stop and put the weights down safely.</li><li>Sit or lie down, with your legs raised if you can. Breathe slowly.</li><li>Sip water once you feel steady. Tell someone nearby.</li><li>Call <a href="tel:999"><b>999</b></a> (Malaysia) or get help at once if you faint, have chest pain, or it does not pass within a few minutes.</li>')
    +'</ul><p class="xsm">HealthWiz is not a medical service and cannot check on you. Do not train again today, and talk to a doctor before your next session.</p>'
    +btn('go','BACK TO THE HEALTH HALL','xpri',' data-v="health"')+'</div>'}

function doneScreen(){const x=X(),e=st.e.find(q=>q.id===x.saved),m=e?e.m:null;if(!m)return mapScreen();
  const P=GOALS[m.goal]||{n:'Training'},est=estimate(m.met,m.dur),reps=sum(m.reps);
  const kcal=m.kcal?'<b>≈ '+m.kcal.v+' kcal</b> <small>(about '+m.kcal.lo+'–'+m.kcal.hi+', ±25%)</small>'
    :est.need==='weight'?'<b>Needs your weight.</b> <small>HealthWiz never guesses it. Add it on the Body &amp; Energy page.</small>':'<small>Too short to estimate.</small>';
  return runes('done')+medius(SAY.done)+'<div class="pxp pxn pxdk xpan xdone" id="xdone">'+head('star','TRAINING COMPLETE')
    +'<p class="xsm">'+esc(m.name)+' · '+P.n+'</p>'
    +'<div class="xhud"><span class="pxst">'+ico('alarm')+'<b>'+m.dur+'</b>MIN</span><span class="pxst">'+ico('quest')+'<b>'+m.reps.length+'</b>SETS</span><span class="pxst">'+ico('energy')+'<b>'+reps+'</b>REPS</span></div>'
    +'<div class="xest"><h4>'+ico('chart')+' ESTIMATES <span class="pxtag">EST</span></h4>'
    +'<p>Calories burned: '+kcal+'</p>'
    +'<p>VO₂: <b>≈ '+est.vo2.toFixed(1)+' mL/kg/min</b>'+(est.lmin?' <small>('+est.lmin.toFixed(2)+' L/min)</small>':'')+'</p>'
    +(m.kj!=null?'<p>Energy: <b>≈ '+m.kj+' kJ</b> <small>(VO₂ × minutes × 20.1 kJ per litre of O₂)</small></p>':'')
    +'<p class="xsm mut">From MET '+m.met.toFixed(1)+' (Compendium code '+m.code+') × your weight × time. Estimates vary by ±20–30% from person to person; they are not measurements.</p></div>'
    +'<div class="xrew"><span class="pxtag">GAME REWARD</span> '+ico('star')+' <b>+'+(m.xp||0)+' XP</b> <small>'+(m.xp?'XP is a game reward, not a health measurement.':'XP for training is full for today. The session still counts in your stats.')+'</small></div>'
    +'<div class="row xrow">'+btn('xagain','TRAIN AGAIN','g')+btn('go','BACK TO THE HEALTH HALL','xpri',' data-v="health"')+'</div></div>'}

/* ---------- the page ---------- */
const H2='<h2 class="xh2">'+ico('workout')+' THE WIZARD\'S TRAINING HALL</h2>';
pages.exercise=()=>{const x=X();
  if(x.stop)return H2+helpScreen();
  if(x.step==='run'&&x.restEnd>Date.now())tick(1);
  const run=x.step==='run'&&x.ex,done=x.step==='done';
  return H2+'<div class="xwrap">'+(x.step==='map'?mapScreen():run?runScreen():done?doneScreen():goalScreen())+'</div>'+(run||done?'':running())};
function tick(start){if(start){clearInterval(S.tm);S.tm=setInterval(()=>tick(),1000);return}
  const x=X(),left=Math.ceil((x.restEnd-Date.now())/1000),el=document.getElementById('xrest'),t=document.getElementById('xel');
  if(S.v!=='exercise'||x.step!=='run'){clearInterval(S.tm);return}
  if(t)t.textContent=clock(Math.floor((Date.now()-x.t0)/1000));
  if(left<=0){clearInterval(S.tm);x.restEnd=0;sfx(880,.12);render();return}
  if(el){el.textContent=clock(left);const b=el.parentNode.querySelector('.bar i,.bar>div');if(b)b.style.width=Math.max(0,left/plan().rest*100)+'%'}}
const to=step=>{const x=X();x.step=step;render();window.scrollTo(0,0)};

acts.xgoal=d=>{const p=prefs();p.g=d.k;keep(p);render()};
function readOwn(){const p=prefs(),v=id=>{const el=document.getElementById(id);return el?el.value:null};
  if(p.g==='cus')p.c={reps:clampI(v('xc-reps'),1,50,p.c.reps),sets:clampI(v('xc-sets'),1,10,p.c.sets),rest:clampI(v('xc-rest'),15,300,p.c.rest)};
  if(p.g==='cal')p.k={reps:clampI(v('xk-reps'),1,50,p.k.reps),sets:clampI(v('xk-sets'),1,10,p.k.sets)};
  keep(p)}
acts.xnext=()=>{if(!prefs().g)return;readOwn();to('map')};
acts.xback=d=>to(d.to==='map'?'map':'goal');
function pick(id,at){const x=X();if(MI(id)<0)return;x.mus=id;x.ex=movesOf(MI(id),plan().k)[0]||null;x.say++;render();{const e=document.querySelector('.xsel');if(e&&e.getBoundingClientRect().bottom>innerHeight)e.scrollIntoView({block:'nearest',behavior:HWUI.reduced()?'auto':'smooth'})}
  if(typeof HWFX!=='undefined'&&at)HWFX.burst(at[0],at[1],{n:16,colors:['#3ee6d0','#aafff0','#1aa596','#fff8c0'],speed:2,gravity:.02,life:700,up:1})}
acts.xmus=(d,el)=>{const r=el.getBoundingClientRect();pick(d.m,[r.left+r.width/2,r.top+r.height/2])};
acts.xex=d=>{const x=X();if(!bodyweight(d.e)&&plan().k==='cal')return;x.ex=d.e;x.say++;render()};
acts.xstart=()=>{const x=X();if(!x.ex)return;x.reps=[];x.restEnd=0;x.t0=Date.now();x.stop=null;x.saved=null;to('run')};
acts.xset=()=>{const x=X(),P=plan(),el=document.getElementById('xrep'),n=clampI(el?el.value:P.lo,0,100,P.lo);x.reps.push(n);
  if(x.reps.length<P.sets){x.restEnd=Date.now()+P.rest*1000;tick(1)}render()};
acts.xskip=()=>{X().restEnd=0;clearInterval(S.tm);render()};
acts.xhelp=d=>{const x=X();clearInterval(S.tm);x.stop=d.k==='chest'?'chest':'dizzy';x.step='goal';x.reps=[];x.restEnd=0;render();window.scrollTo(0,0)};
acts.xagain=()=>{const x=X();x.step='map';x.saved=null;render();window.scrollTo(0,0)};
acts.xfin=()=>{const x=X(),P=plan();clearInterval(S.tm);x.restEnd=0;
  if(!x.reps.length){toast('Log at least one set first, or go back.');return}
  const dur=minsOf(Date.now()-x.t0),est=estimate(P.met,dur),xp=HWXP.remaining('exercise')>0?25:0,M=MOVES[x.ex];
  const m={goal:P.k,ex:x.ex,name:M[0],mus:x.mus,sets:x.reps.length,reps:x.reps.slice(),rt:P.rt,rest:P.rest,fail:P.fail,dur,met:P.met,code:P.code,
    kcal:est.kcal,vo2:Math.round(est.vo2*10)/10,kj:est.kj,xp};
  add('exercise',dur,m,'',today(),undefined,xp,'Training complete!');x.saved=st.e[st.e.length-1].id;x.step='done';render();window.scrollTo(0,0);
  if(xp&&typeof HWFX!=='undefined'){const b=document.getElementById('xdone'),r=b?b.getBoundingClientRect():{left:innerWidth/2,top:200,width:0};
    HWFX.burst(r.left+r.width/2,r.top+40,{n:40,colors:['#3ee6d0','#f2c14e','#fff8c0','#aafff0'],speed:3.5,up:1})}};
// the muscle list stays open across re-renders (toggle does not bubble, so listen while capturing)
document.addEventListener('toggle',e=>{if(e.target.classList&&e.target.classList.contains('xlist'))X().list=e.target.open},true);
// taps on the knight: the pixel under the finger picks the muscle
document.addEventListener('click',e=>{const f=e.target.closest&&e.target.closest('.xmfig');if(!f||S.v!=='exercise')return;
  const r=f.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)/r.width*MAPW),y=Math.floor((e.clientY-r.top)/r.height*MAPH),i=hit(f.dataset.view,x,y);
  if(i>=0)pick(MUS[i][0],[e.clientX,e.clientY])});

/* ---------- wire-up ---------- */
BN.exercise=['workout','Training Hall','Medius trains knights here. Pick a goal, then a muscle and a move.','rgba(62,230,208,.25)'];
DIS.exercise='A general exercise aid, not medical advice. Calories, VO₂ and kJ are estimates from MET values (2024 Compendium of Physical Activities) and your body weight. Stop and get help for chest pain, dizziness or faintness. XP and glows are game rewards, not health measurements.'+(typeof DIS.run==='string'?' Running: '+DIS.run:'');
{const h=HUB.find(x=>x[0]==='exercise');if(h)h[1]=ico('workout',2)}
// the old Running route opens the Running Road on this page (an unfinished session is not abandoned)
{const g0=go;go=function(v){if(v!=='run')return g0.apply(this,arguments);if(typeof HWRun!=='undefined')HWRun.wantMap();
  const x=X();if(x.step==='run'&&!x.stop)toast('Finish or stop your training session to see the Running Road.');else{x.stop=null;if(x.step!=='map')x.step='goal'}
  const r=g0.call(this,'exercise'),el=document.getElementById('xrun-h');if(el)el.scrollIntoView({block:'start'});return r}}

HWUI.css('exercise',`
.tr-exercise{--xm:#0f7f73;--xm2:#3ee6d0}
:root[data-theme="dark"] .tr-exercise{--xm:#3ee6d0}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .tr-exercise{--xm:#3ee6d0}}
.xwrap .pxdk{--xm:#3ee6d0}
.xwrap{display:flex;flex-direction:column;gap:12px}
.xh2{display:flex;align-items:center;gap:8px}
.xpan{padding:12px}.xpan>.pxh{margin:0 0 10px}
.xrun{display:flex;gap:4px;margin:0;padding:0;list-style:none}.xrun li{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 2px;border:2px solid var(--ln);background:var(--p2);opacity:.6;font:8px/1.4 var(--fh);text-transform:uppercase}
.xrun li.dn{opacity:.9}.xrun li.on{opacity:1;background:var(--px-hud,#1c2340);color:var(--xm2);box-shadow:inset 0 -3px 0 var(--xm2)}
.xmed{display:flex;gap:10px;align-items:flex-start}.xmed .av{width:44px;height:44px;flex:0 0 44px;object-fit:cover;object-position:top;border:3px solid var(--ln);background:var(--p2);image-rendering:auto}
.xmed p{margin:0;flex:1;position:relative;padding:8px 10px;background:var(--pn);border:3px solid var(--ln);box-shadow:var(--px-sh-c,3px 3px 0 var(--ln));font-size:14px;line-height:1.45}
.xmed p b{display:block;font:8px/1.6 var(--fh);color:var(--vio)}
.xgos{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:10px}
.xgo{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:44px;padding:10px;text-align:left;background:var(--p2);color:var(--ink);border:3px solid var(--ln);box-shadow:3px 3px 0 var(--ln);font:inherit;cursor:pointer}
.xgo>b{font:10px/1.6 var(--fh)}.xgo small{font-size:12px;color:var(--mut)}.xgo .pxtag{font-style:normal}
.xgo.on{border-color:var(--xm2);box-shadow:3px 3px 0 var(--ln),0 0 0 2px var(--xm2);background:rgba(62,230,208,.12)}
.xgn{display:flex;gap:8px;flex-wrap:wrap}.xgn i{font-style:normal;font-size:12px}.xgn i b{font:12px var(--fh);color:var(--gold)}
.xown{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 10px}.xnum{display:flex;flex-direction:column;gap:4px;font-size:13px}.xnum span{display:flex;align-items:center;gap:6px}.xnum input{width:90px;min-height:44px}
.xsm{font-size:13px;margin:6px 0}
.xpri{width:100%;min-height:48px;margin-top:10px}.xpri[disabled]{opacity:.55;cursor:not-allowed}
.xrow{gap:8px;flex-wrap:wrap}.xrow>button{flex:1 1 140px;min-height:48px}.xrow .xpri{margin-top:0}
.xmap{display:flex;justify-content:center;gap:12px;margin:8px 0}
.xmfig{--s:3;position:relative;width:calc(64px*var(--s));height:calc(96px*var(--s));cursor:pointer;background:rgba(0,0,0,.18);border:2px solid var(--px-hud-ln,var(--ln))}
.xmm{position:absolute;inset:0;background:url(assets/img/exercise/muscles.webp) no-repeat;image-rendering:pixelated;background-size:calc(128px*var(--s)) calc(1920px*var(--s));
  background-position:calc(var(--c)*-64px*var(--s)) calc(var(--r)*-96px*var(--s));pointer-events:none}
.xmm.syn{opacity:.45}.xmm.lit{animation:xpulse 1.2s steps(3) infinite alternate}
@keyframes xpulse{from{opacity:.75}to{opacity:1}}
.xmv{position:absolute;left:4px;bottom:4px;font:8px var(--fh);color:var(--px-hud-mut,var(--mut))}
.xsel{min-height:60px}.xmn{display:block;font:12px/1.6 var(--fh);color:var(--xm)}
.xexs{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.xex{display:flex;align-items:center;gap:8px;min-height:44px;padding:6px 10px;text-align:left;background:var(--p2);color:var(--ink);border:3px solid var(--ln);font:14px var(--fb);cursor:pointer}
.xex.on{border-color:var(--xm2);background:rgba(62,230,208,.14)}
.xlist summary{min-height:44px;cursor:pointer;font:9px var(--fh)}.xchips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.xchips>b{width:100%;font:8px var(--fh);color:var(--mut)}
.xchips .chip{min-height:44px}.xchips .chip.on{border-color:var(--xm2);box-shadow:0 0 0 2px var(--xm2)}
.xtut{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}.xtut>div:not(.xspr){flex:1 1 180px}
.xspr{--s:2;flex:0 0 auto;width:calc(96px*var(--s));height:calc(96px*var(--s));background:rgba(0,0,0,.2) url(assets/img/exercise/moves.webp) no-repeat;image-rendering:pixelated;
  background-size:calc(384px*var(--s)) calc(2112px*var(--s));background-position:0 calc(var(--r)*-96px*var(--s));border:2px solid var(--px-hud-ln,var(--ln));animation:xspr 1.6s steps(4) infinite}
.xspr.big{--s:3}
.xspr.xnone{background:rgba(0,0,0,.2);animation:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:8px;text-align:center}.xspr.xnone small{font-size:12px;line-height:1.4;color:var(--mut)}
@keyframes xspr{to{background-position:calc(-384px*var(--s)) calc(var(--r)*-96px*var(--s))}}
.xspr.still,html.hw-rm .xspr{animation:none}
.xcue{margin:0 0 8px;padding-left:20px;font-size:14px;line-height:1.5}.xcue li{margin:2px 0}
.xreps{margin:6px 0}.xreps b{font:16px var(--fh);color:var(--gold)}.xreps span{font-size:14px}
.xstop{margin:10px 0}
.xhud{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 10px}.xhud .pxst{flex:1 1 90px;display:flex;align-items:center;gap:6px;padding:6px 8px;border:2px solid var(--ln);background:rgba(0,0,0,.15);font:8px var(--fh)}
.xhud .pxst b{font:16px var(--fh);color:var(--gold)}
.xsets{display:flex;gap:6px;margin:0 0 10px}.xsets i{flex:1;height:28px;display:flex;align-items:center;justify-content:center;border:3px solid var(--ln);background:var(--p2);font:9px var(--fh);font-style:normal}
.xsets i.dn{background:var(--xm2);color:#10302c}.xsets i.on{border-color:var(--xm2)}
.xrest{text-align:center}.xrest small{font:8px var(--fh)}.xrest b{display:block;font:32px/1.3 var(--fh);color:var(--xm)}
.xsafe{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px;padding-top:10px;border-top:2px dashed var(--ln)}.xsafe>b{width:100%;font-size:13px}
.xsafe .xbad{flex:1 1 130px;min-height:44px;color:var(--red)}
.xhelp ul{padding-left:20px;line-height:1.5}.xhelp a{display:inline-flex;min-height:44px;align-items:center}
.xest{margin:10px 0;padding:10px;border:2px dashed var(--ln)}.xest h4{display:flex;align-items:center;gap:6px;margin:0 0 6px;font:9px var(--fh)}.xest p{margin:4px 0;font-size:14px}
.xrew{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px;border:2px solid var(--gold);margin:10px 0}.xrew small{flex:1 1 100%}
.xdone{animation:xglow 1.6s steps(4) 2}
@keyframes xglow{0%,100%{box-shadow:var(--px-sh,4px 4px 0 var(--ln))}50%{box-shadow:var(--px-sh,4px 4px 0 var(--ln)),0 0 0 4px var(--xm2),0 0 24px 4px rgba(62,230,208,.6)}}
html.hw-rm .xdone,html.hw-rm .xmm.lit{animation:none}
@media(prefers-reduced-motion:reduce){.xspr,.xdone,.xmm.lit{animation:none}}
@media(max-width:520px){.xmfig{--s:2}.xspr.big{--s:2}.xmap{gap:8px}}
.xmerge{display:flex;flex-direction:column;gap:12px}.xside{min-width:0;display:flex;flex-direction:column;gap:12px}
@media(min-width:760px){.xmerge{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start}.xmerge .xmap{margin:0}}
.xlearn{padding:10px;border:2px dashed var(--xm2);background:rgba(62,230,208,.06)}.xlh{display:flex;align-items:center;gap:6px;margin:0 0 8px;font:9px/1.6 var(--fh);color:var(--xm)}
.xchips .chip.xdim{opacity:.55}
.xrunsec{margin-top:18px}.xrh{display:flex;align-items:center;gap:8px;margin:0 0 6px}
@media(max-width:420px){.xmfig{--s:1.7}}
`);
return{GOALS,MUS,MOVES,plan,estimate,day,hit,grid,prefs,SHEET}})();
