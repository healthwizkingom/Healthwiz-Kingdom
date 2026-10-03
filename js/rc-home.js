/* =====================================================================
   RECONSTRUCTED (v6) — Kingdom home: profile card, attributes, today
   tiles, daily quests, kingdom map, hub, badges + unlock popup.
   Uses the original CSS classes (.pcw .attr .ts .aq .km .kn .hub .bd .bpop).
   ===================================================================== */

/* ---------- daily quests ---------- */
// QD(d) → [{k, e, n, s, p (0..1), x (XP reward), v (page)}]; legacy `quests(d)` maps this to [name, done].
function QD(d){const ms=new Set(A('food',d).map(x=>x.m.meal)).size;return[
{k:'water',e:'💧',n:'Fill the Well',s:wt(d)+' / '+st.s.water+' mL',p:wt(d)/st.s.water,x:20,v:'water'},
{k:'meals',e:'🍽️',n:'Three Meals',s:ms+' / 3 meals logged',p:ms/3,x:15,v:'food'},
{k:'stair',e:'🧗',n:'Climb the Mountain',s:sp(d)+' / 100 stair steps',p:sp(d)/100,x:20,v:'stair'},
{k:'sleep',e:'🌙',n:'Report to Dream Camp',s:A('sleep',d).length?'last night logged':'log last night\'s sleep',p:A('sleep',d).length?1:0,x:10,v:'sleep'},
{k:'mind',e:'🧠',n:'Visit the Mind Forest',s:A('stress',d).length?'check-in done':'one stress check-in',p:A('stress',d).length?1:0,x:10,v:'stress'},
{k:'energy',e:'⚡',n:'Energy Check-in',s:enr(d)?'rated '+enr(d)+'/5':'rate today\'s energy',p:enr(d)?1:0,x:5,v:'home'}]}
const qkey=(d,k)=>d+'|'+k;
acts.qclaim=d=>{const t=today(),q=QD(t).find(x=>x.k===d.k);if(!q||q.p<1||st.claimed[qkey(t,q.k)])return;st.claimed[qkey(t,q.k)]=1;save();gain(q.x,q.n);if(QD(t).every(x=>st.claimed[qkey(t,x.k)])){setTimeout(()=>{gain(30,'All quests complete!');render()},400)}render()};
function questCard(){const t=today(),Q=QD(t),dn=Q.filter(q=>st.claimed[qkey(t,q.k)]).length;
return '<div class="card" id="quests"><div class="ah"><h3>📜 TODAY\'S QUESTS</h3><span class="big">'+dn+'/'+Q.length+'</span></div>'+Q.map(q=>{const c=st.claimed[qkey(t,q.k)],ok=q.p>=1;return '<div class="aq'+(c?' dn':'')+'"><span class="ae">'+q.e+'</span><div class="an"><b>'+q.n+'</b><small>'+q.s+'</small>'+bar(q.p*100,c?'var(--grn)':'var(--gold)')+'</div>'+(c?'<span class="ax">✓ +'+q.x+' XP</span>':ok?'<button class="sm" data-a="qclaim" data-k="'+q.k+'">CLAIM +'+q.x+'</button>':'<button class="sm g" data-a="go" data-v="'+q.v+'" aria-label="Go to '+q.n+'">GO</button>')+'</div>'}).join('')
+'<div class="tq"><b>🧙 WIZARD\'S TIP</b><p>'+TIPS[new Date().getDate()%TIPS.length]+'</p></div><small class="mut">Quests reset at midnight. Missing a day never costs hearts or XP. Finish all six for a +30 XP bonus.</small></div>'}
const TIPS=['Keep a water bottle where you can see it — visible cues make sipping easy.','A short walk after meals is a gentle way to add movement.','Stairs count! Two flights a few times a day adds up over a week.','A regular wake-up time, even on weekends, helps steady your sleep.','When stress spikes, try four slow breaths: in for 4, out for 6.','Add one vegetable to the plate you already eat — small changes stick.','Screens off 30 minutes before bed can make falling asleep easier.','Log honestly, not perfectly. Patterns matter more than single days.'];

/* ---------- character attributes (logged habits, last 7 days) ---------- */
function attrs(){const R=rng(7),f=fn=>Math.round(R.filter(fn).length/7*100),[lo,hi]=SR(+st.p.age||16);return[
['💧','HYD','Hydration',f(d=>wt(d)>=st.s.water),'days water target met'],
['🍗','NUT','Nutrition',f(d=>new Set(A('food',d).map(x=>x.m.meal)).size>=3),'days with 3+ meals logged'],
['🌙','RST','Rest',f(d=>{const h=slH(d);return h!=null&&h>=lo&&h<=hi}),'nights in your age range'],
['🧗','STA','Stamina',f(d=>A('stair',d).length>0),'days with a stair session'],
['🧠','CLM','Calm',f(d=>A('stress',d).length>0),'days with a mind check-in']]}
function profileCard(){const L=lvl(),a=attrs(),nm=st.p.name?esc(st.p.name):'Brave Knight';
return '<div class="card"><div class="pcw"><div class="pcav">'+avatar(5)+'<small>'+L.n.toUpperCase()+'</small></div><div class="pci"><h1>'+nm+'</h1><span class="pcl">Level '+(L.i+1)+' · '+st.xp+' XP</span>'+bar(L.hi?(st.xp-L.lo)/(L.hi-L.lo)*100:100,'var(--gold)')+'<small class="mut">'+(L.hi?(L.hi-st.xp)+' XP to '+LV[L.i+1][0]:'Highest rank reached')+' · Daily score '+score(today())+'/100</small></div></div>'
+'<div class="attr">'+a.map(x=>'<div title="'+x[2]+': '+x[3]+'% of the last 7 '+x[4]+'">'+x[0]+'<b>'+x[1]+'</b>'+bar(x[3],'var(--grn)')+'<small>'+x[3]+'</small></div>').join('')+'</div><span class="gtag">🎮 GAME STATS FROM YOUR LOGGED HABITS — NOT A HEALTH STATUS</span></div>'}

/* ---------- today tiles ---------- */
function todayTiles(){const d=today(),k=kc(d),w=wt(d),h=slH(d),s=sp(d),r=rest(d)||hr(d),x=str(d);
const T=(v,e,n,val,u,p,c,sub)=>'<button data-a="go" data-v="'+v+'"><span>'+e+' '+n+'</span><b>'+val+(u?'<small> '+u+'</small>':'')+'</b>'+(p!=null?bar(p,c):'')+'<small>'+sub+'</small></button>';
return '<div class="card"><h3>📅 TODAY</h3><div class="ts">'
+T('food','🍗','Calories',k,'kcal',k/st.s.kcal*100,'var(--gold)','of '+st.s.kcal+' target')
+T('water','💧','Water',w,'mL',w/st.s.water*100,'var(--blue)','of '+st.s.water+' mL')
+T('sleep','🌙','Sleep',h!=null?h:'–',h!=null?'h':'',h!=null?h/SR(+st.p.age||16)[1]*100:null,'var(--vio)',h!=null?'logged today':'not logged')
+T('stair','🧗','Stairs',s,'steps',s,'var(--grn)',cl(d)+' climbs')
+T('pulse','❤️','Pulse',r!=null?r:'–',r!=null?'BPM':'',null,'',rest(d)?'resting avg':r!=null?'avg today':'no reading')
+T('stress','🧠','Stress',x!=null?x:'–',x!=null?'/10':'',x!=null?x*10:null,'var(--vio)',x!=null?'self-rated':'no check-in')+'</div></div>'}

/* ---------- kingdom map ---------- */
// Node positions (% of map) for the six REG regions, then Dream Camp, Castle and Wizard Tower.
const KPOS=[[24,30,'water'],[70,30,'food'],[50,52,'pulse'],[80,66,'stair'],[20,64,'stress'],[50,84,'bmi']];
const KX=[['🌙','Dream Camp','sleep',[30,88]],['🏰','Royal Archives','stats',[50,14]],['🧙','Wizard Tower','guide',[84,90]]];
function kdays(c){return new Set(st.e.filter(x=>x.c===c).map(x=>x.d)).size}
function klv(on,days){return !on?0:days>=7?3:days>=3?2:1}
function kmap(mini){const nodes=[];REG.forEach((r,i)=>{const p=KPOS[i],on=r[2](),k=klv(on,kdays(p[2]));nodes.push([p[0],p[1],p[2],r[0],r[1],k,on?'':r[4]])});KX.forEach(x=>{const on=x[2]!=='sleep'||cnt('sleep')>0,k=x[2]==='sleep'?klv(on,sdays()):1;nodes.push([x[3][0],x[3][1],x[2],x[0],x[1],k,on?'':'log sleep'])});
const path='M50 14 L24 30 L50 52 L70 30 M50 52 L20 64 L30 88 M50 52 L80 66 L84 90 M50 52 L50 84';
const bg=svg(100,112,rc(0,0,100,112,'#4aa8ee')+[[6,8,88,98],[3,16,94,82],[10,4,80,106]].map(r=>rc(r[0],r[1],r[2],r[3],'#6dbb65')).join('')+rs([[3,16,94,2,'#8fd07a'],[10,4,80,2,'#8fd07a'],[14,22,22,16,'#7cc6f0'],[16,24,18,12,'#5fb4ec'],[60,58,34,4,'#a89a80'],[64,54,26,4,'#bfb29a'],[70,50,14,4,'#d6cbb5'],[8,56,24,18,'#3f8f3f'],[10,58,4,4,'#2f7a38'],[18,60,4,4,'#2f7a38'],[24,58,4,4,'#2f7a38'],[14,66,4,4,'#2f7a38'],[22,68,4,4,'#2f7a38'],[42,6,16,12,'#cfd6e4'],[42,4,3,3,'#cfd6e4'],[48,4,3,3,'#cfd6e4'],[55,4,3,3,'#cfd6e4'],[48,12,4,6,'#5b3a1e'],[40,76,20,14,'#e6d6a2'],[58,22,24,14,'#f0c070'],[60,24,6,5,'#d9453d'],[70,26,6,5,'#d9453d'],[0,0,100,1,'#2f8fd0']]))
.replace('</svg>','<path class="kway" d="'+path+'" stroke="#fbf3d6" stroke-width="1.2" stroke-dasharray="2 2" fill="none" shape-rendering="auto"/></svg>');
return '<div class="km'+(mini?' mini':'')+'">'+bg+[0,1].map(i=>'<i class="kcs" style="position:absolute;left:'+(10+i*50)+'%;top:'+(6+i*40)+'%;width:22%;height:6%;background:rgba(255,255,255,.55);--d:'+(6+i*3)+'s;--x:20px;--a:4px;--l:-'+i*2+'s"></i>').join('')
+nodes.map(n=>'<button class="kn k'+n[5]+'" data-a="go" data-v="'+n[2]+'" style="left:'+n[0]+'%;top:'+n[1]+'%" aria-label="'+n[4]+(n[6]?' (locked: '+n[6]+')':'')+'"><b class="ki">'+n[3]+'</b><span>'+n[4]+'</span><i>'+(n[5]>1?'★'.repeat(n[5]-1):n[5]===0?'🔒':'')+'</i></button>').join('')+'</div>'}
function mapCard(){const on=REG.filter(r=>r[2]()).length,next=REG.find(r=>!r[2]());
return '<div class="card"><h3>🗺️ THE KINGDOM · '+on+'/6 REGIONS RESTORED</h3>'+kmap()+'<small class="mut">'+(next?'Next: '+next[4]+' to restore '+next[1]+'. ':'Every region is restored! ')+'Stars grow with tracking days (3 and 7), never with extreme amounts.</small></div>'}

/* ---------- hub (pages not in the bottom nav) ---------- */
function hubCard(){const d=today(),b=LC('bmi').slice(-1)[0],H=[
['pulse','❤️','Heart Temple','Log your pulse and see the heart wave.',rest(d)||hr(d)?(rest(d)||hr(d))+' BPM':cnt('pulse')+' readings'],
['stair','🧗','Stair Mountain','Paced stair climbing with a beat.',sp(d)+' steps today'],
['stress','🧠','Mind Forest','Stress check-in, calm games, Wizard\'s Counsel.',str(d)!=null?str(d)+'/10 today':'no check-in yet'],
['bmi','⚖️','Balance Shrine','BMI and profile.',b?b.v+' BMI':'not saved'],
['calc','🧮','Goal Forge','Estimate calorie and water goals.',st.s.kcal+' kcal'],
['guide','🧙','Wizard Tower','Suggestions from your own logs.',guideCount()+' notes']];
return '<div class="card hub"><h3>🏰 MORE OF THE KINGDOM</h3><div class="grid">'+H.map(h=>'<button class="hb" data-a="go" data-v="'+h[0]+'"><span style="font-size:24px">'+h[1]+'</span><b>'+h[2].toUpperCase()+'</b><span class="mut" style="display:block">'+h[3]+'</span><em>'+h[4]+'</em></button>').join('')+'</div></div>'}
const guideCount=()=>typeof guideNotes==='function'?guideNotes().length:0;

/* ---------- badges ---------- */
function bstate(b){let r;try{r=b[3]()}catch(e){r=[0,1]}const c=Math.min(r[0],r[1]);return{c,t:r[1],ok:r[0]>=r[1]}}
function badgeGrid(){return '<div class="grid">'+BG.map(b=>{const s=bstate(b),got=st.b[b[1]];return '<div class="t bd'+(got?' ok':' lock')+(S.bnew&&S.bnew[b[1]]?' nw':'')+'"><span class="bi">'+(got?b[0]:'🔒')+'</span><b>'+b[1]+'</b><small>'+b[2]+'</small>'+(got?'<small>Earned '+esc(got)+'</small>':bar(s.c/s.t*100,'var(--gold)')+'<small>'+Math.round(s.c)+' / '+s.t+'</small>')+'</div>'}).join('')+'</div>'}
function badgeCard(){const n=BG.filter(b=>st.b[b[1]]).length;return '<div class="card" id="badges"><h3>🏅 BADGES · '+n+'/'+BG.length+'</h3>'+badgeGrid()+'</div>'}
const BPQ=[];
function badgeCheck(){if(S.v==='welcome')return;let nw=0;BG.forEach(b=>{if(st.b[b[1]])return;if(bstate(b).ok){st.b[b[1]]=today();S.bnew=S.bnew||{};S.bnew[b[1]]=1;BPQ.push(b);nw++}});if(nw){save();st.xp+=25*nw;st.xd=st.xd||{};st.xd[today()]=(st.xd[today()]||0)+25*nw;save();bpopNext()}}
function bpopNext(){if($('.bpop')||!BPQ.length)return;if(window.HW_NO_POPUPS){BPQ.length=0;return}const b=BPQ.shift(),o=document.createElement('div');o.className='bpop';o.dataset.a='bpclose';o.setAttribute('role','dialog');o.setAttribute('aria-label','Badge unlocked: '+b[1]);
o.innerHTML='<div class="bpr"></div><div class="bpc"><span class="bph">BADGE UNLOCKED!</span><span class="bpi">'+b[0]+'</span><b>'+esc(b[1])+'</b><p>'+esc(b[2])+'</p><em>+25 XP</em><small class="mut">tap to continue</small>'+Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return '<u style="background:'+['#f2c14e','#2f8fd0','#5cc05a','#e0483f'][i%4]+';--x:'+Math.round(Math.cos(a)*120)+'px;--y:'+Math.round(Math.sin(a)*120)+'px"></u>'}).join('')+'</div>';
document.body.appendChild(o);[523,659,784,1047,1319].forEach((f,i)=>setTimeout(()=>sfx(f,.12),i*110));o._t=setTimeout(()=>acts.bpclose(null,o),5000)}
acts.bpclose=(d,t)=>{const o=t&&t.closest?t.closest('.bpop'):$('.bpop');if(!o)return;clearTimeout(o._t);o.classList.add('out');setTimeout(()=>{o.remove();bpopNext();if(!BPQ.length)render()},260)};

/* ---------- home page ---------- */
pages.home=()=>hdr()+profileCard()+todayTiles()+questCard()+enCard()+mapCard()+hubCard()+trendCard()+cxCard(2)+badgeCard();

/* render hook (called at the end of render) */
function afterRender(v){if(v!=='welcome')badgeCheck()}
