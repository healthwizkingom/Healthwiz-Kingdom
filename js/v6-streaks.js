/* v6: streaks and achievements (master prompt §34–36, §97 step 7). Not part of the original.
   The original streak() (best run of consecutive days) and its badges stay as they are.
   Added here:
     • current streak — consecutive logged days ending today (or yesterday: today is still open)
     • gentle streak — one rest day per Monday–Sunday week does not break it (§36: breaks allowed,
       no punishing language; a missed day is called a "rest day")
     • a week view (logged / rest / today / still to come) on the Quest Board
     • achievements for focus & weekly quests, gentle consistency, comebacks, feature discovery
       and kingdom development, pushed into the original BG list so the original chkB awards
       them with its popup and +30 XP. None reward body size, weight or eating less (§34).
   Feature discovery uses st.ex.p = {view: firstVisitDate} (schema v4). */
const HWStreaks=(()=>{
const logged=()=>new Set(dys());
const prev=d=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()-1);return ymd(x)};
const wk=d=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x)};
function current(){const L=logged();let d=today();if(!L.has(d))d=prev(d);let n=0;while(L.has(d)){n++;d=prev(d)}return n}
/** {days, rests} — walks back from today; one missed day per calendar week is a rest day, two in a row end it. */
function gentle(){const L=logged();let d=today(),n=0,rests=0,usedWeeks=new Set(),gapRun=0;if(!L.has(d))d=prev(d);
  for(let i=0;i<730;i++){if(L.has(d)){n++;gapRun=0}else{const w=wk(d);if(gapRun||usedWeeks.has(w)||!n&&!L.has(prev(d)))break;usedWeeks.add(w);rests++;gapRun=1}d=prev(d)}
  if(gapRun)rests--; // a trailing rest before the streak began does not count
  return{days:n,rests:Math.max(0,rests)}}
function week(){const L=logged(),t=today(),m=wk(t);return Array.from({length:7},(_,i)=>{const x=new Date(m+'T12:00:00');x.setDate(x.getDate()+i);const d=ymd(x);return{d,s:L.has(d)?'on':d===t?'today':d>t?'later':'rest'}})}
// a comeback = logging again after a break of 3+ days
const comebacks=()=>{const D=dys();let c=0;for(let i=1;i<D.length;i++)if((new Date(D[i]+'T12:00:00')-new Date(D[i-1]+'T12:00:00'))/864e5>=4)c++;return c};

/* ---------- feature discovery (persisted first visits) ---------- */
const ex=()=>(st.ex=st.ex&&typeof st.ex==='object'?st.ex:{p:{}},st.ex.p=st.ex.p||{},st.ex);
const FEAT=['stats','guide','kingdom','badges','calc','health'];
HWEvents.on('page:viewed',e=>{if(FEAT.indexOf(e.view)>=0&&!ex().p[e.view]){ex().p[e.view]=today();save()}});
const found=()=>FEAT.filter(v=>ex().p[v]).length;

/* ---------- achievements (into the original badge system) ---------- */
const fq=()=>Object.values((st.q6||{}).f||{}).filter(x=>x&&x.done).length;
const wq=()=>Object.values((st.q6||{}).w||{}).reduce((s,w)=>s+Object.keys((w&&w.done)||{}).length,0);
const wqAll=()=>Object.values((st.q6||{}).w||{}).filter(w=>w&&Array.isArray(w.ids)&&w.ids.length&&w.ids.every(id=>(w.done||{})[id])).length;
const thriving=()=>{try{return KR.filter(r=>klv(r[3])>=3).length}catch(e){return 0}};
BG.push(
['🎯','Focus Finder','Complete a focus quest',()=>[fq(),1]],
['🔭','Focused Adventurer','Complete 10 focus quests',()=>[fq(),10]],
['🗓️','Week Warden','Complete a weekly quest',()=>[wq(),1]],
['🏵️','Steady Seasons','Complete all three weekly quests in one week',()=>[wqAll(),1]],
['🌿','Rest Is Strength','Keep a gentle streak of 14 days (rest days allowed)',()=>[gentle().days,14]],
['🌅','Returning Hero','Come back and log after a break of 3+ days',()=>[comebacks(),1]],
['📚','Curious Scholar','Visit Statistics, the Guide, the Kingdom, Badges, the Energy Forge and the Health Hall',()=>[found(),FEAT.length]],
['🏡','Kingdom Steward','Have 4 regions Thriving in the same week',()=>[thriving(),4]]);

/* ---------- consistency card on the Quest Board (after the original STREAK card) ---------- */
HWUI.css('streaks',`.v6wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:8px 0}.v6wk span{text-align:center;border:3px solid var(--ln);padding:6px 0;font:8px/1.4 var(--fh);background:var(--p2)}.v6wk span b{display:block;font-size:14px;font-family:var(--fn,inherit)}.v6wk .on{background:var(--grn);color:#fff}.v6wk .today{outline:3px dashed var(--gold);outline-offset:-6px}.v6wk .later{opacity:.45}`);
const DL=['MON','TUE','WED','THU','FRI','SAT','SUN'],IC={on:'✔',rest:'☾',today:'•',later:''};
function card(){const g=gentle(),c=current(),W=week(),n=W.filter(x=>x.s==='on').length;
  return '<div class="card" id="v6streak"><h3>🌱 CONSISTENCY '+HWHelp.btn('streakrest')+'</h3><div class="grid"><div class="t">🔥 Current streak<b>'+c+'</b><small>days in a row</small></div><div class="t">🌿 Gentle streak<b>'+g.days+'</b><small>'+(g.rests?g.rests+' rest day'+(g.rests>1?'s':'')+' taken':'rest days allowed')+'</small></div><div class="t">📅 This week<b>'+n+'/7</b><small>days logged</small></div></div>'
  +'<div class="v6wk" role="img" aria-label="This week: '+W.map((x,i)=>DL[i]+' '+(x.s==='on'?'logged':x.s==='rest'?'rest day':x.s==='today'?'today':'upcoming')).join(', ')+'">'+W.map((x,i)=>'<span class="'+x.s+'">'+DL[i]+'<b>'+IC[x.s]+'</b></span>').join('')+'</div>'
  +'</div>'}
{const p=pages.quests;pages.quests=(...a)=>{const h=p(...a),k='<h3>🔥 STREAK</h3>',i=h.indexOf(k);if(i<0)return h+card();const e=h.indexOf('</div>',i)+6;return h.slice(0,e)+card()+h.slice(e)}}
return{current,gentle,week,comebacks,card}})();
