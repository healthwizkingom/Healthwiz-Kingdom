/* v6: adaptive quests (master prompt §29–33, §97 step 6). Not part of the original.
   The original five daily quests (QD), their XP, the +100 "all five" bonus and the badges
   built on them are untouched. This adds, alongside them:
     • a daily FOCUS quest chosen from the user's own data (insights + gaps), fixed for the day
     • three WEEKLY quests (Monday–Sunday), tilted toward areas logged least last week
   Difficulty rules (§30): targets never exceed the user's own plan (water ≤ target), activity
   stays at one or two easy sessions, nothing rewards eating less or extra intake.
   State: st.q6 = {f:{date:{id,t,why,done}}, w:{weekKey:{ids,done:{id:date}}}} (schema v3).
   Events: 'quest:completed' {kind:'focus'|'weekly', id, name, xp}. */
const HWQuests=(()=>{
const q6=()=>(st.q6=st.q6||{f:{},w:{}},st.q6.f=st.q6.f||{},st.q6.w=st.q6.w||{},st.q6);
const r50=x=>Math.round(x/50)*50;
const breathed=d=>A('stress',d).some(e=>Array.isArray(e.m.tech)&&e.m.tech.length)||!!(st.qd||{})[d];
const ckN=d=>((st.ck||{})[d]||[]).reduce((s,x)=>s+(x?1:0),0);
const fiberFood=d=>A('food',d).some(e=>{const x=emac(e);return x&&x.fb>=3});

// Focus quest catalog: id → {area, icon, name, text(t), prog(d,t) → 0..1, xp, target()}
const FOCUS={
'water-goal':{area:'water',icon:'💧',xp:25,go:'water',name:'Personal water goal',
  // 'usual' = your most recent completed week (falls back to two weeks if sparse)
  target:()=>{let b=rng(8).slice(0,7).map(wt).filter(v=>v>0);if(b.length<3)b=rng(15).slice(0,14).map(wt).filter(v=>v>0);const T=st.s.water;if(!b.length)return Math.min(T,1000);return Math.max(750,Math.min(T,r50((avg(b)+T)/2)))},
  text:t=>'Reach '+t+' mL today — a step from your usual toward your target.',prog:(d,t)=>wt(d)/t},
'meals-3':{area:'food',icon:'🍽️',xp:20,go:'food',name:'Full plate log',text:()=>'Log 3 different meals today (any foods count).',prog:d=>new Set(A('food',d).map(x=>x.m.meal)).size/3},
'fiber':{area:'food',icon:'🌾',xp:20,go:'food',name:'Fiber find',text:()=>'Log one food with about 3 g of fiber or more (vegetables, fruit, oats, dhal…).',prog:d=>fiberFood(d)?1:0},
'wind-down':{area:'sleep',icon:'🕯️',xp:20,go:'sleep',name:'Wind-down ritual',text:()=>'Tick 3 before-bed habits on the Sleep page tonight.',prog:d=>ckN(d)/3},
'breathe':{area:'stress',icon:'🌬️',xp:20,go:'stress',name:'Calm breath',text:()=>'Finish a calming practice in the Stress Quest or visit the Wizard\'s Counsel.',prog:d=>breathed(d)?1:0},
'two-climbs':{area:'stair',icon:'🧗',xp:25,go:'stair',name:'Two easy climbs',text:()=>'Climb a stairway twice today at a comfortable pace.',prog:d=>cl(d)/2},
'energy':{area:'energy',icon:'⚡',xp:15,go:'home',name:'Energy check',text:()=>'Rate your energy on the Home page.',prog:d=>enr(d)?1:0},
'pulse':{area:'pulse',icon:'❤️',xp:15,go:'pulse',name:'Resting rhythm',text:()=>'Save a resting pulse reading.',prog:d=>A('pulse',d).some(e=>e.m.st==='Resting')?1:0}};
// insight area/id → focus quest
const FROM={'water-down':'water-goal','water-target':'water-goal','water-today':'water-goal','food-partial':'meals-3','food-fiber':'fiber','sleep-short':'wind-down','sleep-irregular':'wind-down','stress-high':'breathe','stress-up':'breathe','stair-down':'two-climbs','stair-none':'two-climbs'};
const WHY={'water-goal':'your water has been below your usual or your target','meals-3':'some meals may be missing from your log','fiber':'estimated fiber has been on the low side','wind-down':'your nights have been short or irregular','breathe':'your stress check-ins have been higher','two-climbs':'Stair Mountain has been quiet'};

function pickFocus(d){const top=(typeof HWInsights!=='undefined'?HWInsights.top(5):[]).filter(x=>x.tone==='notice'||x.area==='stair');
  for(const x of top){const id=FROM[x.id];if(id)return{id,why:'Chosen because '+WHY[id]+'.'}}
  // nothing to address → gentle variety, prefer areas not logged in the last 3 days
  const quiet=['energy','pulse','fiber','wind-down','breathe','two-climbs'].filter(id=>{const a=FOCUS[id].area;return a==='energy'?!rng(3).some(enr):!rng(3).some(x=>A(a==='fiber'?'food':a,x).length)});
  const pool=quiet.length?quiet:Object.keys(FOCUS),i=(+d.replace(/-/g,''))%pool.length;
  return{id:pool[i],why:quiet.length?'Chosen to visit a quiet corner of your kingdom.':'A little variety for today.'}}
function focus(d){d=d||today();const F=q6().f;if(!F[d]||!FOCUS[F[d].id]){const p=pickFocus(d),q=FOCUS[p.id];F[d]={id:p.id,t:q.target?q.target():0,why:p.why,done:0};save()}
  const s=F[d],q=FOCUS[s.id];return Object.assign({},q,s,{kind:'focus',key:d,date:d,p:Math.min(1,Math.max(0,q.prog(d,s.t)||0)),desc:q.text(s.t)})}

// Weekly quests (Monday-based week key)
const wkey=(dt=new Date())=>{const d=new Date(dt);d.setHours(12,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)};
const wdaysOf=k=>Array.from({length:7},(_,i)=>{const d=new Date(k+'T12:00:00');d.setDate(d.getDate()+i);return ymd(d)});
const WEEK={
'w-water':{area:'water',icon:'💧',xp:40,go:'water',name:'Steady stream',goal:5,text:g=>'Log water on '+g+' days this week.',count:D=>D.filter(d=>wt(d)>0).length},
'w-sleep':{area:'sleep',icon:'🌙',xp:40,go:'sleep',name:'Dream diary',goal:4,text:g=>'Log your sleep on '+g+' nights this week.',count:D=>D.filter(d=>A('sleep',d).length).length},
'w-stair':{area:'stair',icon:'🧗',xp:40,go:'stair',name:'Mountain paths',goal:2,text:g=>'Finish '+g+' stair sessions this week.',count:D=>D.reduce((s,d)=>s+A('stair',d).length,0)},
'w-mind':{area:'stress',icon:'🧠',xp:40,go:'stress',name:'Forest visits',goal:3,text:g=>'Do '+g+' stress check-ins this week.',count:D=>D.filter(d=>A('stress',d).length).length},
'w-meals':{area:'food',icon:'🍽️',xp:40,go:'food',name:'Village feasts',goal:3,text:g=>'Log 3 different meals on '+g+' days this week.',count:D=>D.filter(d=>new Set(A('food',d).map(x=>x.m.meal)).size>=3).length},
'w-energy':{area:'energy',icon:'⚡',xp:30,go:'home',name:'Energy journal',goal:4,text:g=>'Rate your energy on '+g+' days this week.',count:D=>D.filter(d=>enr(d)).length}};
function pickWeek(k){const prev=wdaysOf(ymd(new Date(new Date(k+'T12:00:00').getTime()-7*864e5))),score=id=>WEEK[id].count(prev)/WEEK[id].goal;
  return Object.keys(WEEK).sort((a,b)=>score(a)-score(b)||a.localeCompare(b)).slice(0,3)}
function weekly(){const k=wkey(),W=q6().w;if(!W[k]||!Array.isArray(W[k].ids)){W[k]={ids:pickWeek(k),done:{}};save()}const D=wdaysOf(k).filter(d=>d<=today());
  return W[k].ids.filter(id=>WEEK[id]).map(id=>{const q=WEEK[id],n=q.count(D);return Object.assign({},q,{kind:'weekly',key:k,id,n,p:Math.min(1,n/q.goal),desc:q.text(q.goal),done:W[k].done[id]||0})})}

// completion: award once, celebrate, announce
let checking=0;
function check(){if(checking||S.v==='welcome'||S.v==='onb')return;checking=1;let n=0;try{const f=focus();
  if(f.p>=1&&!f.done){q6().f[f.date].done=today();save();award(f);n++}
  const k=wkey();weekly().forEach(w=>{if(w.p>=1&&!w.done){q6().w[k].done[w.id]=today();save();award(w);n++}})}finally{checking=0}
  if(n&&document.getElementById('v6q1')||n&&document.getElementById('v6q2'))setTimeout(render,0)}
function award(q){gain(q.xp,(q.kind==='focus'?'Focus quest: ':'Weekly quest: ')+q.name);HWUI.celebrate({icon:q.icon,title:q.kind==='focus'?'FOCUS QUEST COMPLETE!':'WEEKLY QUEST COMPLETE!',sub:q.name,xp:q.xp});
  HWEvents.emit('quest:completed',{kind:q.kind,id:q.id,name:q.name,xp:q.xp,date:today()})}

// UI (§32): title, description, why, progress, reward, area, completion state
function row(q){const ok=q.p>=1||q.done;return '<div class="aq'+(ok?' dn':'')+'"><span class="ae">'+q.icon+'</span><div class="an"><b>'+esc(q.name)+'<span class="tagk">'+(q.kind==='focus'?'FOCUS':'WEEKLY')+'</span></b><small>'+esc(q.desc)+(q.kind==='weekly'?' ('+Math.min(q.n,q.goal)+'/'+q.goal+')':'')+'</small>'+(q.why?'<small class="why">'+esc(q.why)+'</small>':'')+bar(q.p*100,ok?'var(--grn)':'var(--gold)')+'</div><span class="ax">'+(ok?'✔ +':'+')+q.xp+' XP</span><button class="sm g" data-a="go" data-v="'+q.go+'" aria-label="Open '+esc(q.name)+'">▶</button></div>'}
function card(id){if(S.v==='welcome')return '';const f=focus(),W=weekly();return '<div class="card v6q" id="'+id+'"><h3>🎯 FOCUS & WEEKLY QUESTS</h3>'+row(f)+W.map(row).join('')+'<p class="mut" style="margin:8px 0 0;font-size:12px">The focus quest is picked from your own logs each day; weekly quests reset on Monday. All targets stay within your own plan.</p><span class="gtag">🎮 GAME QUESTS · NOT MEDICAL ADVICE</span></div>'}

// surfaces: quest board (after the original adventure card) and home (after it too)
const after=(h,id,c)=>{const i=h.indexOf('id="'+id+'"');if(i<0)return h+c;const end=h.indexOf('<span class="gtag">',i),close=end>=0?h.indexOf('</div>',end)+6:-1;return close>5?h.slice(0,close)+c+h.slice(close):h+c};
{const p=pages.quests;pages.quests=(...a)=>after(p(...a),'advq2',card('v6q2'))}
{const p=pages.home;pages.home=(...a)=>after(p(...a),'advq',card('v6q1'))}
{const _r=render;render=function(){const r=_r.apply(this,arguments);check();return r}}
['entry:added','entry:edited','entry:restored','energy:rated'].forEach(t=>HWEvents.on(t,()=>setTimeout(check,0)));
return{focus,weekly,check,FOCUS,WEEK,wkey}})();
