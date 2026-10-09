/* v6 (usability pass, item 5): "Anything that affects your activity?" Not part of the original.
   One new question in the Traveller's Registry (after the activity question, before the read-back), a multi-select list of common
   conditions plus "none of these" and "Add another…" (free text, 40 characters, kept as typed). The answer is st.p.conds, an array of
   strings (preset ids such as 'asthma' or 'joint', or the text the user typed). It lives in the profile and so travels with the save under
   the existing cloud rules only: signed in, one row per account, row-level security. It is never sent to the Wizard's Counsel, a leaderboard
   or anywhere else, and no new storage key is added. Missing st.p.conds = never asked; [] = "none of these".

   What it changes (all of it is in RULES below; nothing is hidden in other files):
     · the order of the five daily quests on the Home and Quest Board cards ("Sorted for you: …, because you chose …");
     · the Activity quest: for some conditions the stair goal waits behind a "check with your doctor first" note and the quest becomes an
       easy low-impact movement the user confirms with a tap (st.qa[date] = 1, optional like st.qd; the stair goal still counts if they log it);
     · the focus and weekly quests: stair-based ones are not offered while stairs wait behind that note;
     · a plain note on the Stairs page: an easy pace is suggested, or "check with your doctor first".
   What it never does: diagnose, claim a rule is medical advice, hide the Stairs page, remove a quest, or change calorie or water targets.
   A condition the user typed in themselves changes nothing except the reminder to ask a doctor (HealthWiz cannot know what it means).
   Every screen that shows a condition-based change carries DISCLAIMER. */
const HWCond=(()=>{
const DISCLAIMER='HealthWiz does not diagnose conditions. Ask a doctor before changing your activity.';
const QN={water:'Water',food:'Nutrition',stair:'Activity',stress:'Mind',sleep:'Recovery'}; // QD(d)[i].v → the quest
/* RULES: id → what it does and why.
   up      quest ids moved toward the top (earlier in the list = higher)
   stairs  'doctor' = stair goals wait behind a "check with your doctor first" note · null = unchanged
   cap     the fastest pace the Stairs page suggests ('Easy' | 'Moderate'); a note, never a block
   note    the phrase used in "Sorted for you: <note>, because you chose <label>"
   why     the reason, in words a user can read
   Sources are the general public-health advice behind each design choice, not a medical recommendation for any person:
     asthma    — CDC "Asthma and physical activity" / NHS "Exercise and asthma": keep active, warm up, easy pace, stop if wheezy; drink water.
     hbp       — NHS / American Heart Association: moderate activity is encouraged; talk to a doctor before vigorous exercise.
     heart     — American Heart Association "Getting active": check with a doctor before starting or increasing exercise.
     diabetes  — American Diabetes Association: regular meals and steady activity; talk to a care team before changing either.
     joint     — Arthritis Foundation / NHS: low-impact movement (walking, swimming, cycling) is easier on knees and joints than stairs.
     back      — NHS "Back pain": gentle movement and staying active; ask a professional before stair or high-effort work.
     pregnancy — ACOG "Exercise during pregnancy": regular, comfortable activity with a doctor's guidance; drink water; avoid overheating.
     injury    — general rest-and-return advice (NHS): let a recent injury settle and ask a professional before loading it. */
const RULES={
  asthma:{label:'Asthma',up:['water','stress'],stairs:null,cap:'Easy',note:'water and breathing first',why:'Water and slow-breathing practice come first, and an easy pace is suggested.'},
  hbp:{label:'High blood pressure',up:['stress','water'],stairs:null,cap:'Moderate',note:'calm and gentle first',why:'Calm practice comes first, and a vigorous pace is not suggested.'},
  heart:{label:'Heart condition',up:['stress','sleep'],stairs:'doctor',cap:'Easy',note:'rest and calm first',why:'Stair goals wait for your doctor; rest and calm come first.'},
  diabetes:{label:'Diabetes',up:['food','water'],stairs:null,cap:null,note:'regular meals first',why:'Meals and water come first.'},
  joint:{label:'Joint or knee problems',up:['stair'],stairs:'doctor',cap:'Easy',note:'low-impact first',why:'Low-impact walks and swimming come first; stair goals wait for your doctor.'},
  back:{label:'Back pain',up:['stair'],stairs:'doctor',cap:'Easy',note:'gentle movement first',why:'Gentle movement comes first; stair goals wait for your doctor.'},
  pregnancy:{label:'Pregnancy',up:['water','sleep'],stairs:'doctor',cap:'Easy',note:'water and rest first',why:'Water and rest come first, an easy pace is suggested and stair goals wait for your doctor.'},
  injury:{label:'Recent injury',up:['sleep','stair'],stairs:'doctor',cap:'Easy',note:'rest and gentle movement first',why:'Rest comes first; stair goals wait for your doctor.'}
};
const ORDER=['asthma','hbp','heart','diabetes','joint','back','pregnancy','injury'];
const PACE_RANK={Easy:0,Moderate:1};
const conds=()=>Array.isArray(st.p&&st.p.conds)?st.p.conds:[];
const ids=()=>conds().filter(c=>RULES[c]);
const custom=()=>conds().filter(c=>!RULES[c]);
/** The current plan from the saved answer: which rules apply and what they change. */
function plan(){const R=ids().map(i=>RULES[i]),cu=custom(),hide=R.some(r=>r.stairs==='doctor'),
  caps=R.map(r=>r.cap).filter(Boolean).sort((a,b)=>PACE_RANK[a]-PACE_RANK[b]),
  score={};Object.keys(QN).forEach(q=>{score[q]=0});
  R.forEach(r=>r.up.forEach((q,k)=>{score[q]+=10-k}))
  const changed=R.filter(r=>r.up.length||r.stairs||r.cap);
  return{active:R.length>0,custom:cu,rules:R,hide,cap:caps[0]||null,score,changed,
    why:R.length?'Sorted for you: '+[...new Set(R.map(r=>r.note))].join(', ')+', because you chose '+R.map(r=>r.label.toLowerCase()).join(' and ')+'.':''}}
const stairsHidden=()=>{const c=st.p&&st.p.conds;return Array.isArray(c)&&c.length>0&&c.some(i=>RULES[i]&&RULES[i].stairs==='doctor')}; // cheap: QD() asks this for every day it draws
const blocked=area=>stairsHidden()&&(area==='stair'||area==='pulse'); // focus/weekly quests that need a stair session
const moveDone=d=>stairsHidden()&&!!(st.qa||{})[d||today()];
const stairsOpen=()=>!!(st.qa&&st.qa.show);

/* ---------- the quest board (Home and Quest Board cards) ---------- */
const orig=advq;
function row(q){const ok=q.p>=1;return '<div class="aq'+(ok?' dn':'')+'"><span class="ae">'+q.e+'</span><div class="an"><b>'+q.n+'</b><small>'+q.t+'</small>'+bar(q.p*100,ok?'var(--grn)':'var(--blue)')+'</div><span class="ax">'+(ok?'✔ +':'+')+q.x+' XP</span><button class="sm g" data-a="go" data-v="'+q.v+'" aria-label="Open '+q.n+'">▶</button></div>'}
function stairRow(q,done){const ok=q.p>=1||done;
  return '<div class="aq cqa'+(ok?' dn':'')+'"><span class="ae">'+q.e+'</span><div class="an"><b>Activity quest</b><small>An easy low-impact move today, such as a gentle walk or swimming, at a pace that feels comfortable.</small>'+bar(ok?100:0,ok?'var(--grn)':'var(--blue)')
    +'<details class="cqd"'+(stairsOpen()?' open':'')+'><summary>Stairs: check with your doctor first</summary><small>Stair goals wait until you have asked. When you are ready: '+q.t+'.</small> <button class="sm g" data-a="go" data-v="stair">OPEN STAIRS ▶</button></details></div>'
    +'<span class="ax">'+(ok?'✔ +':'+')+q.x+' XP</span>'+(ok?'':'<button class="sm" data-a="condmove" aria-label="I did an easy low-impact move today">DONE</button>')+'</div>'}
advq=function(d,full){const P=plan();if(!P.active)return orig(d,full);
  const Q=QD(d),n=Q.filter(q=>q.p>=1).length,I=Q.map((q,i)=>i).sort((a,b)=>(P.score[Q[b].v]-P.score[Q[a].v])||a-b);
  return '<div class="card" id="'+(full?'advq2':'advq')+'"><h2>ADVENTURE PROGRESS</h2><div class="ah"><span class="big">'+n+'/5 QUESTS</span><b>'+advp(d)+'% · +'+xdy(d)+' XP today</b></div>'+bar(advp(d),'var(--gold)')
    +'<p class="cqs" role="note"><b>'+P.why+'</b> <button class="sm g" data-a="condedit">CHANGE</button></p>'
    +I.map(i=>Q[i].v==='stair'&&P.hide?stairRow(Q[i],moveDone(d)):row(Q[i])).join('')
    +'<p class="mut" style="margin:8px 0 0">All five: +100 XP bonus '+(st.claimed[d]?'(claimed ✓)':'')+'</p><p class="mut cqdis">'+DISCLAIMER+'</p><span class="gtag">🎮 GAME PROGRESS · NOT A HEALTH MEASUREMENT</span></div>'};
// a returning user who was never asked: one quiet line on the Quest Board, not a nag
function ask(){return st.s.onb&&!Array.isArray(st.p.conds)?'<div class="card cqask"><h3>🎯 YOUR QUESTS, YOUR PACE</h3><p>Anything that affects your activity, such as asthma or sore knees? Tell HealthWiz and it will sort and soften your goals. Optional.</p><button data-a="condedit" style="width:100%">TELL HEALTHWIZ</button><p class="mut">'+DISCLAIMER+'</p></div>':''}
{const p=pages.quests;pages.quests=(...a)=>{const h=p(...a),i=h.indexOf('<div class="card" id="advq2">');return i<0?h:h.slice(0,i)+ask()+h.slice(i)}}
// the Activity quest counts an easy move when stairs are behind the doctor note (st.qa[date], optional like st.qd)
acts.condmove=()=>{if(!stairsHidden())return;st.qa=st.qa||{};st.qa[today()]=1;save();toast('Easy move noted. Nice and gentle.');render()};
document.addEventListener('toggle',e=>{const t=e.target;if(t&&t.classList&&t.classList.contains('cqd')){st.qa=st.qa||{};if(!!st.qa.show!==t.open){st.qa.show=t.open?1:0;save()}}},true);
{const t0=tq;tq=function(){const r=t0();return stairsHidden()&&/stair/i.test(r)?'Take an easy low-impact walk, if your doctor says it is fine.':r}}

/* ---------- the Stairs page: a note, never a block ---------- */
{const p=pages.stair;pages.stair=function(){let h=p.apply(this,arguments);const P=plan();if(!P.active&&!P.custom.length)return h;
  const names=P.rules.map(r=>r.label.toLowerCase()).concat(P.custom.map(esc)).join(' and ');
  const note='<div class="warn cqnote" role="note"><b>You chose '+names+'.</b> '+(P.hide?'Check with your doctor first, before stairs. ':'')+(P.cap?'An '+P.cap.toLowerCase()+' pace or slower is suggested. ':'')+DISCLAIMER+'</div>';
  return note+h}}

/* ---------- the question, inside the Traveller's Registry ---------- */
const CS=6.5; // the question's place in the registry flow: after activity (5), before the read-back (6); numeric so v6-looks' ring (Math.min(6,i)) still works
const CC=()=>{const o=S.ob;if(!o.cc){const c=conds();o.cc={ids:c.filter(x=>RULES[x]),cu:c.filter(x=>!RULES[x]),none:Array.isArray(st.p.conds)&&!c.length,add:false,err:''}}return o.cc};
const norm=s=>String(s).trim().replace(/\s+/g,' ').slice(0,40);
function screen(){const o=S.ob,c=CC(),nn=(o.d.name||'').trim()||'traveller',say='One last question, '+nn+'. Does anything affect what thou canst do? It only helpeth me choose gentler goals. Choose all that apply, or none.',
  chip=(a,t,on,x)=>'<button type="button" class="chip cdc'+(on?' on':'')+'" data-a="'+a+'"'+(x||'')+' aria-pressed="'+(on?'true':'false')+'">'+t+'</button>';
  const eff=c.ids.map(i=>'<li><b>'+RULES[i].label+':</b> '+RULES[i].why+'</li>').join('')+c.cu.map(t=>'<li><b>'+esc(t)+':</b> HealthWiz cannot know what this means for activity, so it changes no goal. Ask a doctor.</li>').join('');
  return '<div class="obw"><h2>📜 TRAVELLER\'S REGISTRY</h2><div class="obpr"><small>ONE MORE QUESTION</small>'+bar(100,'var(--gold)')+'</div><div class="obsay"><img src="'+WIZ+'" alt="Wizard King Medius" class="obz"><div class="tbx"><b>WIZARD KING MEDIUS</b><p id="obt" data-t="'+esc(say)+'"></p></div></div>'
    +'<div class="card" id="cdcard"><h3>Anything that affects your activity?</h3><p class="mut">Optional. Pick all that apply.</p>'
    +'<div class="cdgrid" role="group" aria-label="Conditions that affect activity">'+ORDER.map(i=>chip('cdt',RULES[i].label,c.ids.includes(i),' data-i="'+i+'"')).join('')
    +c.cu.map((t,k)=>chip('cdx',esc(t)+' ✕',true,' data-k="'+k+'" aria-label="Remove '+esc(t)+'"')).join('')
    +chip('cdn','None of these',c.none&&!c.ids.length&&!c.cu.length)+chip('cda','Add another…',c.add)+'</div>'
    +(c.add?'<div class="row cdadd"><label>Another condition<input id="cdin" maxlength="40" autocomplete="off"></label><button data-a="cdadd">ADD</button></div><small class="mut">Up to 40 characters. Kept exactly as you type it, on this device.</small>'+(c.err?'<p class="warn" role="alert">'+esc(c.err)+'</p>':''):'')
    +(eff?'<ul class="cdeff">'+eff+'</ul>':'')
    +'<p class="mut cdis">'+DISCLAIMER+'</p>'
    +'<div class="row" style="margin-top:12px"><button class="g" data-a="cdback">◀ BACK</button><button data-a="cdnext">NEXT ▶</button></div></div></div>'}
{const p=pages.onb;pages.onb=function(){const o=S.ob;if(o&&o.i===CS)return screen();let h=p.apply(this,arguments);
  if(o&&o.i===6){const c=conds(),txt=Array.isArray(st.p.conds)?(c.length?c.map(x=>RULES[x]?RULES[x].label:esc(x)).join(', '):'None of these'):(o.cc?CCtext():'Not answered');
    const k='<div class="row" style="margin-top:12px"><button class="g" data-a="obb">';const i=h.indexOf(k);
    if(i>=0)h=h.slice(0,i)+'<div class="er"><span>Activity</span><span><b>'+txt+'</b></span><button class="sm g" data-a="obe" data-i="c" aria-label="Edit conditions">✏️</button></div>'+h.slice(i)}
  return h}}
function CCtext(){const c=CC();return c.ids.length||c.cu.length?c.ids.map(x=>RULES[x].label).concat(c.cu.map(esc)).join(', '):'None of these'}
function commit(){const c=CC();st.p.conds=c.ids.concat(c.cu);save()}
function leave(){const o=S.ob,to=o&&o.cx;if(to){S.ob=null;go(to);return true}return false}
acts.cdt=d=>{const c=CC(),i=d.i;c.none=false;c.ids=c.ids.includes(i)?c.ids.filter(x=>x!==i):c.ids.concat(i);render()};
acts.cdx=d=>{const c=CC();c.cu.splice(+d.k,1);render()};
acts.cdn=()=>{const c=CC();c.ids=[];c.cu=[];c.none=true;c.add=false;render()};
acts.cda=()=>{const c=CC();c.add=!c.add;c.err='';render();const f=document.getElementById('cdin');if(f)f.focus()};
acts.cdadd=()=>{const c=CC(),f=document.getElementById('cdin'),v=norm(f?f.value:'');
  if(!v){c.err='Type a few letters first.';render();return}
  if(c.cu.length>=5){c.err='That is enough for now (5).';render();return}
  const low=v.toLowerCase(),hit=ORDER.find(i=>RULES[i].label.toLowerCase()===low||i===low);
  if(hit){if(!c.ids.includes(hit))c.ids.push(hit)}else if(!c.cu.some(x=>x.toLowerCase()===low))c.cu.push(v);
  c.none=false;c.add=false;c.err='';render()};
acts.cdnext=()=>{commit();if(!leave()){S.ob.i=6;S.ob.ret=0;sfx(520,.06);render()}};
acts.cdback=()=>{if(!leave()){S.ob.i=5;S.ob.cc=null;render()}};
// the questions flow: activity → this question → the read-back; BACK from the read-back returns here; EDIT on its row opens it
{const o=acts.obact;acts.obact=function(d){const ret=S.ob&&S.ob.ret;o.apply(this,arguments);if(!ret&&S.ob&&S.ob.i===6){S.ob.i=CS;render()}}}
{const o=acts.obb;acts.obb=function(){if(S.ob&&S.ob.i===6&&!S.ob.ret){S.ob.err='';S.ob.i=CS;render();return}return o.apply(this,arguments)}}
{const o=acts.obe;acts.obe=function(d){if(d.i==='c'){S.ob.i=CS;S.ob.ret=1;S.ob.cc=null;render();return}return o.apply(this,arguments)}}
// from the quest board: open the question alone, and return to where the user was
acts.condedit=()=>{const from=S.v;go('onb');S.ob.i=CS;S.ob.cx=from==='home'||from==='quests'?from:'quests';S.ob.cc=null;render()};
addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='cdin'){e.preventDefault();acts.cdadd()}});

HWUI.css('cond',`
.cdgrid{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.cdgrid .chip{min-height:44px;padding:8px 12px;font:14px/1.2 var(--fn);overflow-wrap:anywhere}
.cdeff{margin:8px 0;padding-left:18px;font-size:13px}.cdeff li{margin:4px 0}.cdis,.cqdis{font-size:12px;margin:6px 0 0}.cdadd{align-items:flex-end}
.cqs{margin:8px 0;font-size:13px}.cqs b{font-weight:600}.cqnote{margin:0 0 12px}.cqask p{margin:0 0 8px}
.cqd{margin-top:6px}.cqd summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:13px}
`);
return{RULES,DISCLAIMER,plan,stairsHidden,blocked,moveDone,conds}})();
