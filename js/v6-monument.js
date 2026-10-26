/* v6: The Ascent Monument (route 'monument', door on Statistics right under the Health Time Machine). Not part of the original.
   Every staircase the player climbs adds stones to a fantasy tower (the scene: js/v6-monument-scene.js), and beside it the
   climbing is compared, honestly, with real landmarks.

   WHERE THE NUMBERS COME FROM (read-only: nothing here changes a saved session)
   * The saved stair sessions, read through HWStairs.all() (js/v6-stairs.js), so edits and deletions show at once and no
     second record of the climbing is kept. A session counts when its total steps (e.v = steps per climb x climbs) is > 0.
   * The rise of one step of that staircase (m.sid; old entries without one are matched by an unambiguous name):
       1. measured: the Group 14 F21 report's step rise (HWStairs.STUDY: ST14, ST19, ST20), else
       2. surveyed: the riser heights of the campus survey sheet (HWCampusData records, data/stair-survey.json), averaged
          over the flights by their number of risers; a riser outside 12 to 21 cm is flagged for re-measurement.
     No rise known → the session's steps still count, its ascent does not, and the page says so. Nothing is invented.
   * Vertical ascent of a session h = total steps x rise per step (so a partial or repeated climb counts exactly the
     steps logged); the total H = sum of h. Repeated climbs are added vertically: H is not one continuous climb.
   * Estimated mechanical work against gravity W = m g H (g = 9.81 m/s2) only with the user's confirmed weight
     (HWStairs.profile()); never presented as calories burned.
   THE MONUMENT  Six fixed stages (STAGES) unlock at published heights; within a stage the stones are laid in proportion
   to the progress, so the tower's look is symbolic and its drawn height is not a measurement. The last acknowledged
   ascent is kept in st.s.mon {m, n, d} (an optional key, like st.s.orb): only stones above it are animated, once.
   THE COMPARISON  LANDMARKS are configurable data, each height checked against its source on 2026-10-26 (CTBUH Skyscraper
   Center, official sites, NASA); R = H / height. The to-scale view uses one linear scale and one baseline; the ladder
   is logarithmic and labelled so. Mountains are heights above sea level; the ISS is an orbit. */
const HWMonument=(()=>{
const ico=(n,s)=>HWPixel.icon(n,s||1),G=9.81;
const fm=(v,d)=>v==null||!isFinite(v)?'—':(+v).toLocaleString('en',{minimumFractionDigits:0,maximumFractionDigits:d==null?(Math.abs(v)>=1000?0:Math.abs(v)>=100?1:2):d});
const mtr=(v,d)=>fm(v,d)+' m';
const two=n=>String(n).padStart(2,'0'),D0=d=>new Date(d+'T12:00:00'),addD=(d,n)=>{const x=D0(d);x.setDate(x.getDate()+n);return ymd(x)};
const monday=d=>addD(d,-((D0(d).getDay()+6)%7)),MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const nice=d=>{const x=D0(d);return x.getDate()+' '+MN[x.getMonth()]+' '+x.getFullYear()};

/* ---------- the monument's stages: thresholds in metres of verified ascent ---------- */
const STAGES=[
 {n:'Foundation',m:0,d:'a stone plinth, the front steps and four lanterns'},
 {n:'First Ascent',m:10,d:'the hall: an arched door, glowing windows, buttresses and a cornice'},
 {n:'Rising Keep',m:50,d:'the keep with corner turrets and a walkway'},
 {n:'High Citadel',m:150,d:'balconies with golden rails and flying buttresses'},
 {n:'Grand Monument',m:451.9,d:'the upper chamber, banners and four turrets',why:'one Petronas Twin Tower'},
 {n:'Skyward Spire',m:828,d:'tiers of roof, a golden ring and the crystal finial',why:'one Burj Khalifa'},
 {n:'Celestial Crown',m:4095.2,d:'a beam of light from the crystal',why:'Mount Kinabalu'}];
/** H (m) → {placed stones, stage index, fraction of the stage, aura}. */
function build(H){const C=HWMonumentScene.counts();let placed=0,i=0,frac=1;
  for(;i<C.length;i++){const a=STAGES[i].m,b=STAGES[i+1].m;if(H>=b){placed+=C[i];continue}frac=Math.max(0,(H-a)/(b-a));placed+=Math.floor(C[i]*frac);break}
  return{placed,stage:i,frac:i>=C.length?1:frac,aura:H>=8848.86?2:H>=4095.2?1:0,total:C.reduce((a,b)=>a+b,0)}}

/* ---------- landmarks (configurable; heights checked 2026-10-26) ----------
   h metres · k silhouette · w width as a share of its height (drawing only) · why: what the number is · src: [title, by, url, checked]
   · fact: a verified extra · kind: 'illus' (an illustrative size, not a real building) | 'asl' (above sea level) | 'orbit' */
const CT='CTBUH Skyscraper Center';
const LANDMARKS=[
 {id:'house',n:'A two-storey house',h:6,k:'house',w:1.3,kind:'illus',why:'An illustrative size, not a measured building: two storeys at 3 m each. 3 m a storey is HealthWiz\'s round figure for one floor (homes are often a little lower, offices a little higher).'},
 {id:'block',n:'A 10-storey building',h:30,k:'block',w:.42,kind:'illus',why:'An illustrative size: ten storeys at HealthWiz\'s round 3 m a storey.'},
 {id:'liberty',n:'Statue of Liberty',p:'New York, USA',h:92.99,k:'statue',w:.3,why:'Ground to the tip of the torch: 305 ft 1 in (92.99 m), pedestal and foundation included.',
  src:['Statue of Liberty: Statue Statistics','U.S. National Park Service','https://www.nps.gov/stli/learn/historyculture/statue-statistics.htm','Opened 2026-10-26: ground to tip of torch 305 ft 1 in, 92.99 m.'],
  fact:'The copper statue itself is only about half of that: the rest is its pedestal and foundation.'},
 {id:'eiffel',n:'Eiffel Tower',p:'Paris, France',h:330,k:'eiffel',w:.38,why:'330 m since 15 March 2022, when a 6 m digital radio antenna was added (324 m before).',
  src:['The Eiffel Tower grows again: 330 meters high','Société d\'Exploitation de la Tour Eiffel (official site)','https://www.toureiffel.paris/en/news/events/eiffel-tower-grows-330-meters-tall','Official site, read through its search listing on 2026-10-26 (the page itself refused automated reading).'],
  fact:'Visitors may climb 674 of its steps, from the ground to the second floor (327, then 347).'},
 {id:'kltower',n:'Menara Kuala Lumpur (KL Tower)',p:'Kuala Lumpur',h:420.4,k:'kltower',w:.2,why:'Architectural height (completed 1996).',
  src:['Menara Kuala Lumpur',CT,'https://www.skyscrapercenter.com/building/menara-kuala-lumpur/9390','Opened 2026-10-26: 420.4 m; observatory 276 m.'],fact:'Its observatory is at 276 m.'},
 {id:'petronas',n:'Petronas Twin Towers (KLCC)',p:'Kuala Lumpur',h:451.9,k:'petronas',w:.36,why:'Architectural height of each tower, to the top of the spire; antennae are not counted (completed 1998, 88 floors).',
  src:['Petronas Twin Tower 1',CT,'https://www.skyscrapercenter.com/building/petronas-twin-tower-1/149','Opened 2026-10-26: 451.9 m, 88 floors, completed 1998.'],
  fact:'The double-deck skybridge joins the towers at the 41st and 42nd floors, 170 m above the ground (Guinness World Records: the highest sky bridge).',
  src2:['Highest sky bridge','Guinness World Records','https://www.guinnessworldrecords.com/world-records/113245-highest-sky-bridge','Opened 2026-10-26: 170 m, 41st and 42nd floors.']},
 {id:'merdeka',n:'Merdeka 118',p:'Kuala Lumpur',h:678.9,k:'merdeka',w:.16,why:'Architectural height (completed 2023; 680.5 m to the tip).',
  src:['Merdeka 118',CT,'https://www.skyscrapercenter.com/building/merdeka-118/10115','Opened 2026-10-26: 678.9 m, 118 floors, global height rank 2.'],fact:'The tallest building in Malaysia and the second tallest in the world.'},
 {id:'burj',n:'Burj Khalifa',p:'Dubai, UAE',h:828,k:'burj',w:.14,why:'Architectural height (completed 2010; 829.8 m to the tip).',
  src:['Burj Khalifa',CT,'https://www.skyscrapercenter.com/building/burj-khalifa/3','Opened 2026-10-26: 828 m, 163 floors above ground.'],fact:'163 floors above the ground: the tallest building in the world.'},
 {id:'penang',n:'Penang Hill (Western Hill)',p:'Penang',h:833,k:'hill',w:2.4,kind:'asl',why:'Height of the summit above sea level, not from where a walk starts.',
  src:['Penang Hill: attractions','Penang Hill (official site)','https://penanghill.gov.my/index.php/en/attractions','Opened 2026-10-26: Western Hill 833 m above sea level; Flagstaff Hill 735 m.'],fact:'Its other summit, Flagstaff Hill, is 735 m.'},
 {id:'kinabalu',n:'Mount Kinabalu',p:'Sabah',h:4095.2,k:'peak',w:1.6,kind:'asl',why:'Height of the summit above sea level.',
  src:['Kinabalu Park','Sabah Parks','https://www.sabahparks.org.my/kinabalu-park','Opened 2026-10-26: 4,095.2 m.'],fact:'UNESCO describes it as the highest mountain between the Himalayas and New Guinea.'},
 {id:'everest',n:'Mount Everest',p:'Nepal and China',h:8848.86,k:'peak',w:1.6,kind:'asl',why:'Height above sea level from the joint Nepal and China survey, announced on 8 December 2020.',
  src:['Everest 2.0: revised height revealed, 8,848.86 m','The Himalayan Times','https://thehimalayantimes.com/nepal/everest-2-0-worlds-tallest-peaks-revised-height-revealed-stands-at-8848-86m/','News report of the official announcement, read 2026-10-26.'],fact:'The 2020 survey put it 86 cm above the long-used 8,848 m.'},
 {id:'iss',n:'International Space Station (orbit)',h:400000,k:'iss',w:.6,kind:'orbit',why:'NASA gives an average altitude of about 400 km (250 miles); it drifts between roughly 370 and 460 km as the orbit decays and is boosted.',
  src:['International Space Station','NASA','https://www.nasa.gov/reference/international-space-station/','Read 2026-10-26: orbit 370 to 460 km; NASA learning pages give an average of about 400 km.'],fact:'It goes round the Earth about every 90 minutes.'}];

/* ---------- the rise of one step of a staircase ---------- */
const CHECK=[12,21]; // cm: a riser outside this is unusual (same range as tools/import_survey_table.py)
function riseOf(sid){if(!sid)return null;const f=(typeof HWStairs!=='undefined'?HWStairs.STUDY:[]).find(x=>x.id===sid);
  if(f)return{m:f.rise,how:'measured',src:'Group 14 F21 report, Table 2 (measured step rise)'};
  const r=typeof HWCampusData!=='undefined'?HWCampusData.record(sid):null,F=r&&r.flightsSurveyed;
  if(F&&F.length&&F.every(x=>x.riser_cm>0)){const w=F.reduce((a,x)=>a+(x.risers||1),0),cm=F.reduce((a,x)=>a+x.riser_cm*(x.risers||1),0)/w;
    return{m:cm/100,how:'surveyed',src:'Campus stair survey sheet (data/stair-survey.json)',check:F.some(x=>x.riser_cm<CHECK[0]||x.riser_cm>CHECK[1])}}
  return null}
function byName(loc){const L=STAIRS.filter(q=>q.name===loc);return L.length===1?L[0].id:null}
const survey=()=>typeof HWCampusData!=='undefined'?HWCampusData.survey.status:'local';

/* ---------- everything the page shows, from the saved sessions ---------- */
function data(){const t=today(),raw=(typeof HWStairs!=='undefined'?HWStairs.all():[]).filter(s=>s.total>0)
    .sort((a,b)=>(a.d+(a.t||'')).localeCompare(b.d+(b.t||''))||String(a.id).localeCompare(String(b.id)));
  let H=0,steps=0,climbs=0,cum=0;const un={n:0,steps:0},days={},risers=[];
  const L=raw.map(s=>{const sid=s.sid||byName(s.loc),q=riseOf(sid),h=q?s.total*q.m:null;steps+=s.total;climbs+=s.climbs>0?s.climbs:0;
    if(h!=null){H+=h;cum+=h;days[s.d]=(days[s.d]||0)+h;risers.push([q.m,s.total])}else{un.n++;un.steps+=s.total}
    return Object.assign({},s,{sid,q,h,cum:h!=null?cum:null})});
  const sum=R=>L.filter(s=>s.h!=null&&R.includes(s.d)).reduce((a,s)=>a+s.h,0);
  const wk=Array.from({length:8},(_,i)=>{const m=addD(monday(t),-7*(7-i)),R=Array.from({length:7},(_,j)=>addD(m,j));return{m,v:sum(R),n:L.filter(s=>R.includes(s.d)).length}});
  const best=L.filter(s=>s.h!=null).sort((a,b)=>b.h-a.h)[0]||null,bd=Object.keys(days).sort((a,b)=>days[b]-days[a])[0]||null;
  // the staircase climbed most often (with a known rise): one climb of it, for "climbs to go"
  const cnt={};L.forEach(s=>{if(s.h!=null&&s.sid)cnt[s.sid]=(cnt[s.sid]||0)+1});const fav=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a])[0]||null;
  let one=null;if(fav){const s=L.filter(x=>x.sid===fav).pop(),per=s.steps>0?s.steps:s.climbs>0?s.total/s.climbs:s.total;one={sid:fav,loc:s.loc,n:cnt[fav],steps:per,m:per*s.q.m}}
  const rAvg=risers.length?risers.reduce((a,x)=>a+x[0]*x[1],0)/risers.reduce((a,x)=>a+x[1],0):null;
  const P=typeof HWStairs!=='undefined'?HWStairs.profile():null;
  return{L,H,steps,climbs,n:L.length,known:L.length-un.n,un,today:sum([t]),d7:sum(rng(7)),d30:sum(rng(30)),pace:sum(rng(28))/4,wk,best,bd,bdv:bd?days[bd]:0,one,rAvg,
    first:L.length?L[0].d:null,P,W:P?P.w*G*H:null,flagged:L.filter(s=>s.q&&s.q.check).length,sv:survey()}}

/* ---------- the acknowledged state (st.s.mon) and the running animation ---------- */
const ack=()=>{const m=st.s&&st.s.mon;return m&&typeof m==='object'&&isFinite(m.m)?m:null};
const r2=v=>Math.round(v*100)/100;
function acknowledge(D){const a=ack();if(a&&a.m===r2(D.H)&&a.n===D.n)return;if(!a&&!D.n)return;st.s.mon={m:r2(D.H),n:D.n,d:today()};save()}
let RUN=null,lastNew=null; // RUN: {from, to, t0} of the animation in progress, so a redraw of the page continues it

/* ---------- pieces ---------- */
const help=(k,t,h)=>HWHelp.btn('mn-'+k,t,h);
const srcLi=s=>s?'<li><a href="'+esc(s[2])+'" target="_blank" rel="noopener noreferrer">'+esc(s[0])+'</a><br><small>'+esc(s[1])+'</small><br><small class="mut">'+esc(s[3])+'</small></li>':'';
function lmWhy(L){return help('lm-'+L.id,L.n+': why '+mtr(L.h)+'?','<p>'+esc(L.why)+'</p>'+(L.src?'<p><b>Source</b></p><ul>'+srcLi(L.src)+srcLi(L.src2)+'</ul>':'<p class="mut">No source: this size is HealthWiz\'s illustration.</p>')
  +'<p class="mut">Comparing: your climbs added together vertically, '+(L.kind==='asl'?'against a height above sea level.':'against the landmark\'s height.')+' You have not climbed the landmark itself.</p>')}
function explainAscent(D){const S=D.L.filter(s=>s.h!=null).slice(-3);
  return HWExplain.btn('mn-ascent','Total vertical ascent',{what:'How high all your logged stair climbs reach when they are added together, one on top of the other.',
    inputs:[{n:'Stair sessions with a known step rise',v:D.known,o:'you'},{n:'Steps in them',v:D.L.filter(s=>s.h!=null).reduce((a,s)=>a+s.total,0),o:'you'},{n:'Sessions whose staircase has no known rise',v:D.un.n,o:D.un.n?'missing':'calc'}],
    formula:'h = steps logged × rise of one step of that staircase\nH = h₁ + h₂ + … + hₙ',vars:[['h','vertical rise of one session','m'],['H','total vertical ascent','m']],
    steps:S.map(s=>esc(s.loc)+': '+s.total+' steps × '+fm(s.q.m*100,2)+' cm = '+mtr(s.h,2)).concat(D.known>3?['… and '+(D.known-3)+' earlier sessions']:[]),result:mtr(D.H,2),
    app:'The rise of a step is the Group 14 F21 report\'s measurement for its three staircases, otherwise the campus survey sheet\'s riser height (averaged over the flights). Steps on a staircase without a known rise are counted as steps but not as height: no rise is guessed.',
    limits:['Repeated climbs are added vertically: this is not one continuous climb, and walking down is not subtracted.','Riser heights were measured by hand with a tape; small errors add up over many steps.','Only climbs you logged are counted.']})}
function explainWork(D){if(!D.P)return'';const W=D.W;
  return HWExplain.btn('mn-work','Estimated mechanical work against gravity',{what:'The idealised work done lifting your body through your total vertical ascent. It is not the energy your body used, and not calories burned.',
    inputs:[{n:'Body mass',v:D.P.w,u:'kg',o:'you'},{n:'g',v:9.81,u:'m/s²',o:'default'},{n:'Total vertical ascent H',v:r2(D.H),u:'m',o:'calc'}],formula:'W = m × g × H',vars:[['m','body mass','kg'],['g','acceleration due to gravity','m/s²'],['H','total vertical ascent','m']],
    steps:[fm(D.P.w,1)+' kg × 9.81 m/s² × '+mtr(D.H,2)+' = '+fm(W,0)+' J = '+fm(W/1000,1)+' kJ'],result:fm(W/1000,1)+' kJ',
    limits:['Muscles turn only part of the energy they use into work, so the body spends several times more.','Descents, pauses, carrying a bag and changes in weight are not counted.','Not a calorie estimate and not a health measurement.']})}

/* ---------- the door on Statistics (under the Health Time Machine) ---------- */
function doorArt(){return '<svg class="mndart" viewBox="0 0 48 56" width="96" height="112" aria-hidden="true" shape-rendering="crispEdges">'
  +'<rect width="48" height="56" fill="#16123d"/><rect y="34" width="48" height="22" fill="#2b2163"/><path d="M0 40h6v-3h6v2h5v-4h7v3h6v-2h8v3h10v17H0z" fill="#1b173f"/>'
  +'<rect x="9" y="4" width="2" height="1" fill="#fff"/><rect x="38" y="9" width="1" height="1" fill="#fff"/><rect x="31" y="3" width="1" height="1" fill="#cfc8ff"/><rect x="5" y="16" width="1" height="1" fill="#cfc8ff"/>'
  // the measuring rod (gold ticks)
  +'<rect x="40" y="12" width="1" height="36" fill="#9a6414"/>'+[12,18,24,30,36,42,47].map((y,i)=>'<rect x="'+(i%2?41:41)+'" y="'+y+'" width="'+(i%2?2:3)+'" height="1" fill="#f6c94f"/>').join('')
  // the island
  +'<path d="M6 48h30v2h-3v2h-6v2h-8v-2h-6v-2H6z" fill="#40334f"/><path d="M6 46h30v2H6z" fill="#3d8a4c"/><path d="M8 45h26v1H8z" fill="#5bbf62"/>'
  // the tower: front face lit, side face shaded, top faces light; ledges project
  +'<path d="M12 44V36h10v8z" fill="#a69dc2"/><path d="M22 44V36h8v8z" fill="#665e8a"/><path d="M10 35h22v2H10z" fill="#b2a7d1"/><path d="M22 36h10v1H22z" fill="#4c4372"/>'
  +'<path d="M14 35V22h8v13z" fill="#a69dc2"/><path d="M22 35V22h6v13z" fill="#665e8a"/><path d="M12 21h18v2H12z" fill="#b2a7d1"/><path d="M22 22h8v1h-8z" fill="#4c4372"/>'
  +'<path d="M15 20v-6h7v6z" fill="#a69dc2"/><path d="M22 20v-6h5v6z" fill="#665e8a"/><path d="M14 13l7-5 7 5z" fill="#8a6cf0"/><path d="M21 8l7 5h-7z" fill="#3a2a7e"/>'
  +'<rect x="20" y="5" width="2" height="3" fill="#f6c94f"/><rect x="20" y="3" width="2" height="2" fill="#7ff0ff"/>'
  +'<rect x="16" y="26" width="2" height="3" fill="#ffc94a"/><rect x="16" y="16" width="2" height="2" fill="#ffc94a"/><rect x="24" y="27" width="2" height="3" fill="#e89a2c"/><rect x="14" y="39" width="3" height="5" fill="#2a1838"/><rect x="15" y="40" width="1" height="2" fill="#ffcf6a"/>'
  +'<path d="M12 44h14l6 2H12z" fill="#000" opacity=".35"/></svg>'}
function door(){let stat='';
  try{const D=data();stat=D.n?'<p class="mndstat"><b>'+mtr(D.H,1)+'</b> climbed'+(D.un.n?' <small>(+'+fm(D.un.steps,0)+' steps without a known rise)</small>':'')+' · '+esc(STAGES[build(D.H).stage].n)+'</p>'
    :'<p class="mndstat mut">No climbs logged yet: your first one lays the first stone.</p>'}catch(e){}
  return '<div class="card mndoor" id="mn-door">'+doorArt()+'<div class="mndtx"><h3>'+ico('tower')+' THE ASCENT MONUMENT</h3><p class="mntag">Every climb builds your legacy.</p>'
    +'<p>Every staircase you conquer adds to your monument. Watch your accumulated ascent become something extraordinary.</p>'+stat
    +'<button type="button" data-a="mngo">ENTER MY MONUMENT</button></div></div>'}

/* ---------- the to-scale view and the ladder (SVG) ---------- */
const SIL={house:[[0,0],[0,.62],[.5,1],[1,.62],[1,0]],block:[[0,0],[0,1],[1,1],[1,0]],
 statue:[[.05,0],[.05,.3],[.2,.3],[.2,.47],[.36,.47],[.36,.78],[.3,.84],[.4,.92],[.5,.9],[.54,.86],[.52,.66],[.62,.78],[.64,1],[.72,1],[.7,.74],[.58,.5],[.64,.47],[.8,.47],[.8,.3],[.95,.3],[.95,0]],
 eiffel:[[0,0],[.16,.24],[.3,.42],[.41,.7],[.46,.93],[.5,1],[.54,.93],[.59,.7],[.7,.42],[.84,.24],[1,0],[.72,0],[.5,.17],[.28,0]],
 kltower:[[.38,0],[.43,.62],[.2,.65],[.2,.72],[.4,.77],[.47,.8],[.49,1],[.51,1],[.53,.8],[.6,.77],[.8,.72],[.8,.65],[.57,.62],[.62,0]],
 petronas:[[0,0],[0,.72],[.05,.8],[.09,.86],[.14,.9],[.19,1],[.21,1],[.26,.9],[.31,.86],[.35,.8],[.4,.72],[.4,.39],[.6,.39],[.6,.72],[.65,.8],[.69,.86],[.74,.9],[.79,1],[.81,1],[.86,.9],[.91,.86],[.95,.8],[1,.72],[1,0],[.6,0],[.6,.36],[.4,.36],[.4,0]],
 merdeka:[[.15,0],[.12,.5],[.24,.68],[.36,.8],[.46,.9],[.5,1],[.53,.88],[.62,.74],[.8,.56],[.86,0]],
 burj:[[.08,0],[.14,.22],[.24,.22],[.28,.42],[.35,.42],[.38,.62],[.44,.62],[.46,.8],[.49,.8],[.5,1],[.51,.8],[.54,.8],[.56,.62],[.62,.62],[.65,.42],[.72,.42],[.76,.22],[.86,.22],[.92,0]],
 hill:[[0,0],[.22,.45],[.32,.5],[.5,1],[.62,.8],[.72,.84],[1,0]],peak:[[0,0],[.2,.5],[.3,.45],[.47,.92],[.5,1],[.55,.9],[.66,.7],[.75,.74],[1,0]],
 iss:[[0,.9],[0,1],[.38,1],[.38,.97],[.62,.97],[.62,1],[1,1],[1,.9],[.62,.9],[.62,.93],[.38,.93],[.38,.9]]};
const poly=(k,x,yb,w,h)=>(SIL[k]||SIL.block).map(p=>(x+p[0]*w).toFixed(1)+','+(yb-p[1]*h).toFixed(1)).join(' ');
function scaleView(D,L){const Wd=320,Hd=230,yb=200,top=24,max=Math.max(D.H,L.h),k=(yb-top)/max,hy=D.H*k,lh=L.h*k,lw=Math.max(6,Math.min(150,L.w*lh));
  const lx=150,yu=yb-hy;
  return '<svg class="mnsv" viewBox="0 0 '+Wd+' '+Hd+'" role="img" aria-label="To scale: your ascent '+esc(mtr(D.H,1))+' beside '+esc(L.n)+' '+esc(mtr(L.h))+'">'
    +'<line x1="8" x2="'+(Wd-8)+'" y1="'+yb+'" y2="'+yb+'" class="mnbase"/>'
    +(D.H>0?'<line x1="52" x2="'+(lx+lw+8)+'" y1="'+yu.toFixed(1)+'" y2="'+yu.toFixed(1)+'" class="mnreach"/>':'')
    +'<rect x="30" y="'+(yb-Math.max(hy,D.H>0?1:0)).toFixed(1)+'" width="22" height="'+Math.max(hy,D.H>0?1:0).toFixed(1)+'" class="mnyou"/>'
    +'<polygon points="'+poly(L.k,lx,yb,lw,lh)+'" class="mnlm mnlm-'+L.k+'"/>'
    +'<text x="41" y="'+(yb+16)+'" text-anchor="middle">You</text><text x="'+(lx+lw/2).toFixed(1)+'" y="'+(yb+16)+'" text-anchor="middle">'+esc(L.n.length>26?L.n.split(' (')[0]:L.n)+'</text>'
    +'<text x="56" y="'+Math.max(14,yu-4).toFixed(1)+'" class="mnv">'+esc(mtr(D.H,1))+'</text>'
    +'<text x="'+Math.min(Wd-4,lx+lw+6).toFixed(1)+'" y="'+Math.max(14,yb-lh+12).toFixed(1)+'" class="mnv"'+(lx+lw+60>Wd?' text-anchor="end"':'')+'>'+esc(mtr(L.h))+'</text>'
    +(D.H>0&&hy<2?'<text x="30" y="'+(yb-6)+'" class="mnsm">too small to see at this scale</text>':'')+'</svg>'}
function ladder(D){const Hd=440,y=h=>Hd-24-(Math.log10(Math.max(1,h))/6)*(Hd-48),R=LANDMARKS.map(L=>({L,y:y(L.h)})).sort((a,b)=>b.y-a.y);
  // make every label at least 15 px below the one above it
  let prev=Infinity;R.forEach(r=>{r.ly=Math.min(r.y,prev-15);prev=r.ly});
  const ticks=[1,10,100,1000,1e4,1e5,1e6].map(h=>'<line x1="64" x2="76" y1="'+y(h)+'" y2="'+y(h)+'" class="mntick"/><text x="58" y="'+(y(h)+4)+'" text-anchor="end">'+(h>=1000?fm(h/1000,0)+' km':h+' m')+'</text>').join('');
  return '<svg class="mnlad" viewBox="0 0 320 '+Hd+'" role="img" aria-label="Logarithmic ladder of heights from 1 metre to 1,000 kilometres with your ascent marked">'
    +'<line x1="70" x2="70" y1="'+y(1e6)+'" y2="'+y(1)+'" class="mnaxis"/>'+ticks
    +R.map(r=>'<line x1="70" x2="96" y1="'+r.y.toFixed(1)+'" y2="'+r.ly.toFixed(1)+'" class="mnlead"/><circle cx="70" cy="'+r.y.toFixed(1)+'" r="3" class="mndot'+(D.H>=r.L.h?' got':'')+'"/><text x="100" y="'+(r.ly+4).toFixed(1)+'">'+esc(r.L.n.split(' (')[0])+' · '+esc(r.L.h>=1e5?fm(r.L.h/1000,0)+' km':mtr(r.L.h))+'</text>').join('')
    +(D.H>=1?'<path d="M70 '+y(D.H).toFixed(1)+'l-10 -6v12z" class="mnme"/><text x="8" y="'+(y(D.H)-8).toFixed(1)+'" class="mnv">You</text>':'')+'</svg>'}

/* ---------- comparison rows ---------- */
const the=L=>L.kind==='illus'?L.n.replace(/^A /,'a '):/^(Mount|Merdeka|Menara|Penang)/.test(L.n)?L.n:'the '+L.n;
function rows(D){return '<ul class="mnrows">'+LANDMARKS.map(L=>{const R=D.H/L.h,left=L.h-D.H,pct=Math.min(1,R);
  const togo=left>0&&D.one&&D.one.m>0?Math.ceil(left/D.one.m):null,wks=left>0&&D.pace>0?left/D.pace:null;
  const when=wks==null?'':wks>104?'about '+fm(wks/52,0)+' years':wks>=1?'about '+fm(wks,0)+' week'+(Math.round(wks)===1?'':'s'):'less than a week';
  return '<li class="mnrow'+(R>=1?' got':'')+'"><div class="mnrh"><b>'+esc(L.n)+'</b> <span class="mnh">'+esc(L.h>=1e5?'≈ '+fm(L.h/1000,0)+' km':mtr(L.h))+'</span>'
    +(L.kind==='illus'?' <span class="pxtag">ILLUSTRATIVE</span>':L.kind==='asl'?' <span class="pxtag">ABOVE SEA LEVEL</span>':L.kind==='orbit'?' <span class="pxtag">ORBIT</span>':'')+' '+lmWhy(L)+'</div>'
    +'<div class="mnratio"><b>'+(R>=1?(R>=100?fm(R,0):fm(R,1))+' ×':fm(R*100,R<.01?2:0)+' %')+'</b> '+(R>=1?'the height of '+esc(the(L))+(R>=2?', stacked':''):'of its height')+'</div>'
    +'<div class="mnbar" role="img" aria-label="'+esc(fm(Math.min(R,1)*100,0))+' percent of '+esc(L.n)+', linear scale"><i style="width:'+(pct*100).toFixed(2)+'%"></i></div>'
    +(left>0?'<small class="mut">'+esc(mtr(left,left<100?1:0))+' to go'+(togo?' · ≈ '+fm(togo,0)+' more climb'+(togo>1?'s':'')+' of '+esc(D.one.loc):'')+(when?' · '+when+' at your last-4-weeks pace':'')+'</small>':'<small class="mnok">'+ico('success')+' Passed</small>')
    +(L.fact?'<small class="mnfact">'+ico('star')+' '+esc(L.fact)+'</small>':'')+'</li>'}).join('')+'</ul>'}

/* ---------- fun with the numbers (each one labelled for what it is) ---------- */
function funCard(D){const out=[],h=D.H;
  // the standard atmosphere (NASA Glenn Research Center's Earth atmosphere model, troposphere, valid to 11,000 m)
  if(h>0){const T=15.04-.00649*Math.min(h,11000),p=101.29*Math.pow((T+273.1)/288.08,5.256),p0=101.29*Math.pow((15.04+273.1)/288.08,5.256);
    out.push(['cloud','Summit air','If all your climbing were one climb up from the sea, the air at the top would be about <b>'+fm(15.04-T,1)+' °C cooler</b> and its pressure <b>'+fm(p/p0*100,1)+' %</b> of sea level.'+(h>11000?' (The model stops at 11 km, so this is the value there.)':''),
      help('air','Summit air','<p>A standard-atmosphere model of the lower atmosphere (the troposphere, up to 11 km), from NASA Glenn Research Center: T = 15.04 − 0.00649 h (°C) and p = 101.29 × [(T + 273.1) / 288.08]^5.256 (kPa), with h in metres.</p><p>With h = '+esc(mtr(h,1))+': T = '+fm(T,2)+' °C and p = '+fm(p,2)+' kPa, against '+fm(p0,2)+' kPa at sea level.</p><p class="mut">A model of an average day, not today\'s weather. Your climbs were not one climb, and Kulim is not at sea level.</p><ul>'+srcLi(['Earth Atmosphere Model, metric units','NASA Glenn Research Center','https://www.grc.nasa.gov/www/k-12/airplane/atmosmet.html','Opened 2026-10-26: troposphere equations as above.'])+'</ul>')])}
  if(D.W!=null&&h>0)out.push(['energy','Work against gravity','About <b>'+fm(D.W/1000,1)+' kJ</b> of idealised work lifting your body, the same as lifting a 1,000 kg car <b>'+mtr(D.P.w*h/1000,1)+'</b> straight up.',explainWork(D)]);
  else if(h>0)out.push(['energy','Work against gravity','Confirm your weight in the profile to see the idealised work of lifting your body through '+esc(mtr(h,1))+'.','']);
  if(D.steps>0)out.push(['stairs','In Eiffel Tower stairs','Your '+fm(D.steps,0)+' steps equal the 674 steps from the ground to the Eiffel Tower\'s second floor <b>'+fm(D.steps/674,1)+' times</b> (a step count, not a height).',lmWhy(LANDMARKS[3])]);
  if(D.rAvg)out.push(['tower','The Burj Khalifa in your steps','With your staircases\' average step of '+fm(D.rAvg*100,1)+' cm, its 828 m would take about <b>'+fm(828/D.rAvg,0)+' steps</b>. You have done '+fm(D.H/828*100,1)+' % of them.','']);
  if(h>0)out.push(['home','Floors','About <b>'+fm(h/3,0)+' floors</b> of a building, at HealthWiz\'s round 3 m a floor.','']);
  if(D.first&&D.n){const days=Math.max(1,Math.round((D0(today())-D0(D.first))/864e5)+1);out.push(['alarm','Since your first climb',days+' day'+(days>1?'s':'')+' since '+esc(nice(D.first))+': on average <b>'+mtr(h/days,2)+' a day</b>.',''])}
  if(!out.length)return'';
  return '<div class="card mnfun"><h3>'+ico('star')+' BEYOND THE NUMBERS</h3><ul class="mnfl">'+out.map(o=>'<li>'+ico(o[0],2)+'<div><b>'+o[1]+'</b> '+o[3]+'<p>'+o[2]+'</p></div></li>').join('')+'</ul></div>'}

/* ---------- over time ---------- */
function bars(D){const mx=Math.max(...D.wk.map(w=>w.v),0),Wd=320,Hd=120,bw=30,gap=(Wd-16-bw*8)/7;
  if(!mx)return '<p class="mut">No climbs with a known rise in the last 8 weeks.</p>';
  const lab=w=>{const x=D0(w.m);return x.getDate()+' '+MN[x.getMonth()]};
  return '<svg class="mnbars" viewBox="0 0 '+Wd+' '+(Hd+30)+'" role="img" aria-label="Vertical ascent per week, last 8 weeks, highest '+esc(mtr(mx,1))+'">'
    +'<line x1="8" x2="'+(Wd-8)+'" y1="'+Hd+'" y2="'+Hd+'" class="mnbase"/>'
    +D.wk.map((w,i)=>{const h=w.v/mx*(Hd-20),x=8+i*(bw+gap);return '<g><title>Week of '+esc(lab(w))+': '+esc(mtr(w.v,1))+' ('+w.n+' session'+(w.n===1?'':'s')+')</title>'
      +(w.v>0?'<rect x="'+x.toFixed(1)+'" y="'+(Hd-h).toFixed(1)+'" width="'+bw+'" height="'+h.toFixed(1)+'" rx="2" class="mnb'+(i===7?' now':'')+'"/>':'<rect x="'+x.toFixed(1)+'" y="'+(Hd-2)+'" width="'+bw+'" height="2" class="mnb0"/>')
      +((w.v===mx&&w.v>0)||i===7?'<text x="'+(x+bw/2).toFixed(1)+'" y="'+(Hd-h-4).toFixed(1)+'" text-anchor="middle" class="mnv">'+esc(fm(w.v,w.v<10?1:0))+'</text>':'')
      +(i%2||i===7?'':'<text x="'+(x+bw/2).toFixed(1)+'" y="'+(Hd+16)+'" text-anchor="middle">'+esc(lab(w))+'</text>')+(i===7?'<text x="'+(x+bw/2).toFixed(1)+'" y="'+(Hd+16)+'" text-anchor="middle" class="mnv">This week</text>':'')+'</g>'}).join('')+'</svg>'
    +'<table class="mnsr"><caption>Vertical ascent per week (metres)</caption><tr><th>Week of</th><th>Ascent</th><th>Sessions</th></tr>'+D.wk.map(w=>'<tr><td>'+esc(lab(w))+'</td><td>'+esc(mtr(w.v,1))+'</td><td>'+w.n+'</td></tr>').join('')+'</table>'}
function timeCard(D){const tiles=[['Today',D.today],['Last 7 days',D.d7],['Last 30 days',D.d30]];
  return '<div class="card mntime"><h3>'+ico('chart')+' YOUR ASCENT OVER TIME</h3><div class="mntiles">'+tiles.map(t=>'<div class="t"><small>'+t[0]+'</small><b>'+esc(mtr(t[1],1))+'</b></div>').join('')+'</div>'
    +'<p class="mnlbl">Per week, Monday to Sunday</p>'+bars(D)
    +(D.best?'<p>'+ico('achievement')+' <b>Highest single session:</b> '+esc(mtr(D.best.h,1))+' at '+esc(D.best.loc)+' on '+esc(nice(D.best.d))+' ('+D.best.total+' steps).</p>':'')
    +(D.bd?'<p>'+ico('flame')+' <b>Highest day:</b> '+esc(mtr(D.bdv,1))+' on '+esc(nice(D.bd))+'.</p>':'')+'</div>'}

/* ---------- the construction ledger and the data note ---------- */
function ledger(D){const L=D.L.slice(-15).reverse();if(!L.length)return'';
  return '<div class="card mnled"><details><summary><h3>'+ico('scroll')+' CONSTRUCTION LEDGER</h3><small class="mut">The last '+L.length+' of '+D.n+' sessions that built the monument</small></summary>'
    +'<div class="mntw"><table><thead><tr><th scope="col">Date</th><th scope="col">Staircase</th><th scope="col">Steps</th><th scope="col">Rise</th><th scope="col">Total after</th></tr></thead><tbody>'
    +L.map(s=>'<tr><td>'+esc(nice(s.d))+'</td><td>'+esc(s.loc)+(s.sid?' <small class="mut">'+esc(s.sid)+'</small>':'')+'</td><td>'+s.total+'</td><td>'
      +(s.h!=null?esc(mtr(s.h,2))+' <span class="pxtag">'+(s.q.how==='measured'?'MEASURED':'SURVEYED')+'</span>'+(s.q.check?' <span class="pxtag">CHECK</span>':''):'<span class="mut">rise not known</span>')+'</td><td>'+(s.cum!=null?esc(mtr(s.cum,1)):'')+'</td></tr>').join('')
    +'</tbody></table></div></details></div>'}
function note(D){const sv=D.sv;
  return '<div class="card mnnote"><h3>'+ico('scroll')+' WHERE THESE NUMBERS COME FROM</h3>'
    +'<p>Your saved stair sessions only. Each session\'s rise is its steps × the rise of one step of that staircase: <b>measured</b> for the three staircases of the Group 14 F21 report, <b>surveyed</b> (the campus survey sheet) for the others.</p>'
    +(D.un.n?'<p>'+ico('warning')+' '+D.un.n+' session'+(D.un.n>1?'s':'')+' ('+fm(D.un.steps,0)+' steps) '+(D.un.n>1?'are':'is')+' on a staircase without a known step rise, so '+(D.un.n>1?'they add':'it adds')+' steps but no height.</p>':'')
    +(sv==='local'?'<p class="mut">The survey sheet cannot be read when the app is opened from this device, so only the three measured staircases give a height here. Open the app from its website for the rest.</p>'
      :sv==='error'?'<p class="mut">The survey sheet could not be loaded just now, so only the three measured staircases give a height. It will be tried again next time.</p>':sv==='loading'?'<p class="mut">Loading the survey sheet…</p>':'')
    +(D.flagged?'<p class="mut">'+D.flagged+' session'+(D.flagged>1?'s use':' uses')+' a riser the survey marked as unusual (CHECK in the ledger); it is used as measured until it is re-measured.</p>':'')
    +'<p class="mut">The monument is a picture of your progress: its stages unlock at '+STAGES.slice(1).map(s=>esc(mtr(s.m,1))+(s.why?' ('+s.why+')':'')).join(', ')+'. Its drawn height is not a measurement.</p></div>'}

/* ---------- the page ---------- */
const sel=()=>S.mnl||null;
function nextLm(D){return LANDMARKS.find(L=>L.h>D.H)||LANDMARKS[LANDMARKS.length-1]}
function cmpCard(D){const L=LANDMARKS.find(x=>x.id===sel())||nextLm(D);
  return '<div class="card mncmp" id="mncmp"><h3>'+ico('chart')+' HEIGHT EQUIVALENTS '+help('cmp','How the comparison works','<p>Your vertical ascent H is set beside a landmark\'s height L: R = H ÷ L tells how many landmark heights your climbs add up to.</p><p>Repeated climbs are added vertically. You have not climbed the landmark itself.</p><p>The picture with the landmark is to scale: one linear scale, one baseline. The ladder below uses a logarithmic scale, where each step up is ten times higher, so it can hold a house and the Space Station at once.</p><p>The bars are linear from 0 to the landmark\'s height.</p>')+'</h3>'
    +'<p class="mnhero"><b>'+esc(mtr(D.H,D.H<100?1:0))+'</b> <span>climbed, added together'+(D.H>0?' · ≈ '+fm(D.H/3,0)+' floors':'')+'</span></p>'
    +'<div class="mnchips" role="group" aria-label="Compare with">'+LANDMARKS.map(x=>'<button type="button" class="chip'+(x===L?' on':'')+'" data-a="mnlm" data-id="'+x.id+'" aria-pressed="'+(x===L)+'">'+esc(x.n.split(' (')[0].replace(/^A /,''))+'</button>').join('')+'</div>'
    +'<div class="mnscale" id="mnscale"><p class="mnlbl">To scale</p>'+scaleView(D,L)+'</div>'
    +rows(D)
    +'<details class="mnladw"><summary>The height ladder <small class="mut">(logarithmic scale)</small></summary><p class="mut">Each step up the ladder is ten times higher than the one below it.</p>'+ladder(D)+'</details></div>'}
function sceneCard(D,B){const st0=STAGES[B.stage],nx=STAGES[B.stage+1],nl=nextLm(D);
  const stTxt=B.stage>=6?'Celestial Crown'+(B.aura>1?' (higher than Mount Everest)':''):st0.n+' · '+fm(B.frac*100,0)+' % built';
  return '<div class="card mnmain"><div class="mnstage" id="mnstage"><div class="mnhud"><span class="mnchip">'+ico('tower')+' '+esc(stTxt)+'</span></div>'
    +'<button type="button" class="g sm mnskip" data-a="mnskip" hidden>SKIP ANIMATION</button><p class="mnnew" id="mnnew" aria-live="polite"></p></div>'
    +'<div class="mnside"><p class="mnalt">'+(D.n?'Your monument: the '+esc(st0.n)+' stage'+(B.stage<6?', '+fm(B.frac*100,0)+' % built ('+esc(st0.d)+')':', complete, with '+esc(st0.d))+'. '+B.placed+' of '+B.total+' stones laid.'
      :'An empty island with a stone circle, waiting for your first climb.')+' <small class="mut">A picture of progress: its height is not your ascent.</small></p>'
    +'<div class="mnstats">'
    +'<div class="t mnbig"><small>Total vertical ascent '+explainAscent(D)+'</small><b>'+esc(mtr(D.H,D.H<100?2:1))+'</b>'+(D.un.n?'<small class="mut">+ '+fm(D.un.steps,0)+' steps with no known rise</small>':'')+'</div>'
    +'<div class="t"><small>Steps climbed</small><b>'+fm(D.steps,0)+'</b></div>'
    +'<div class="t"><small>Climbs completed</small><b>'+fm(D.climbs||D.n,0)+'</b><small class="mut">in '+D.n+' session'+(D.n===1?'':'s')+'</small></div>'
    +'<div class="t"><small>Current stage</small><b class="mnw">'+esc(B.stage>=6?'Celestial Crown':st0.n)+'</b></div>'
    +'<div class="t"><small>Next milestone</small><b class="mnw">'+(D.H<nl.h?esc(nl.n.split(' (')[0]):'All passed')+'</b><small class="mut">'+(D.H<nl.h?esc(mtr(nl.h-D.H,1))+' to go':'')+(nx&&B.stage<6?' · next stage at '+esc(mtr(nx.m,1)):'')+'</small></div></div>'
    +(D.n?'':'<p>Climb a staircase on campus and log it in the Observatory: its steps become your first stones.</p><button type="button" data-a="mnlog">LOG A CLIMB IN THE OBSERVATORY</button>')
    +(D.n?'<button type="button" class="g sm" data-a="mnreplay">REPLAY THE CONSTRUCTION</button>':'')+'</div></div>'}
function page(){const D=data(),B=build(D.H);
  return '<p class="mntag mnlead">Every climb builds your legacy.</p>'+sceneCard(D,B)+cmpCard(D)+(D.n?funCard(D)+timeCard(D)+ledger(D):'')+note(D)}

/* ---------- mounting the scene after each render ---------- */
let svT=0; // when the page first waited for the survey sheet
function mountScene(){const host=document.getElementById('mnstage');if(!host||host.querySelector('canvas'))return;
  // over http the survey sheet arrives just after the first draw: wait for it (at most 10 s), so the stones match its heights
  if(survey()==='loading'){if(!svT)svT=Date.now();if(Date.now()-svT<10000)return}
  const D=data(),B=build(D.H),a=ack();let from=a?build(Math.min(a.m,D.H)).placed:0;
  if(RUN&&RUN.to===B.placed)from=RUN.from;else if(from<B.placed)RUN={from,to:B.placed,t0:performance.now(),dm:D.H-(a?a.m:0)};else RUN=null;
  const skip=host.querySelector('.mnskip'),msg=document.getElementById('mnnew'),grow=B.placed-from;
  const done=()=>{if(skip)skip.hidden=true;acknowledge(D);if(RUN&&grow>0){lastNew={n:grow,m:RUN.dm}}RUN=null;
    if(msg&&lastNew)msg.textContent='+'+lastNew.n+' stone'+(lastNew.n>1?'s':'')+' laid'+(lastNew.m>0?': '+mtr(lastNew.m,1)+' climbed since your last visit':'')+'.'};
  if(skip)skip.hidden=!(grow>0&&!HWUI.reduced());
  const s=HWMonumentScene.mount(host,{from,to:B.placed,aura:B.aura,t0:RUN?RUN.t0:0,onDone:done});
  if(!s&&host.classList.contains('mnfail'))host.insertAdjacentHTML('beforeend','<p class="mnfb">The monument picture could not be drawn on this device. All your numbers are below.</p>')}
// the survey sheet arrives after the first render (over http): redraw this page or the door once it has
function whenSurvey(){if(survey()!=='loading')return;let n=0;const t=setInterval(()=>{if(survey()!=='loading'||++n>41){clearInterval(t);
  if(S.v==='monument'&&!HWMonumentScene.running){const y=window.scrollY;render();window.scrollTo(0,y)}
  else if(S.v==='stats'){const d=document.getElementById('mn-door');if(d)d.outerHTML=door()}}},250)}
{const r=render;render=function(){const x=r.apply(this,arguments);if(S.v==='monument'||S.v==='stats')try{if(S.v==='monument')mountScene();whenSurvey()}catch(e){console.error('[HWMonument]',e)}return x}}
HWEvents.on('page:viewed',e=>{if(e&&e.view!=='monument')HWMonumentScene.stop()});
// a new width (rotation, a resized window) redraws the picture at its new size once the construction is over
{let w=0,tm=0;addEventListener('resize',()=>{clearTimeout(tm);tm=setTimeout(()=>{const h=document.getElementById('mnstage');if(S.v!=='monument'||!h||HWMonumentScene.running||h.clientWidth===w)return;w=h.clientWidth;
  HWMonumentScene.stop();const c=h.querySelector('canvas');if(c)c.remove();mountScene()},250)})}

/* ---------- actions ---------- */
acts.mngo=()=>go('monument');
acts.mnlog=()=>go('campus');
acts.mnskip=()=>HWMonumentScene.skipNow();
acts.mnreplay=()=>{const D=data(),B=build(D.H);RUN={from:0,to:B.placed,t0:performance.now(),dm:0};lastNew=null;HWMonumentScene.stop();
  const h=document.getElementById('mnstage');if(h){const c=h.querySelector('canvas');if(c)c.remove()}
  const skip=h&&h.querySelector('.mnskip');if(skip)skip.hidden=HWUI.reduced();
  HWMonumentScene.mount(h,{from:0,to:B.placed,aura:B.aura,t0:RUN.t0,onDone:()=>{if(skip)skip.hidden=true;RUN=null}})};
acts.mnlm=d=>{S.mnl=d.id;const D=data(),c=document.getElementById('mncmp');if(!c)return;const L=LANDMARKS.find(x=>x.id===d.id);
  c.querySelectorAll('.mnchips .chip').forEach(b=>{const on=b.dataset.id===d.id;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
  const v=document.getElementById('mnscale');if(v&&L)v.innerHTML='<p class="mnlbl">To scale</p>'+scaleView(D,L)};

/* ---------- the page and its door on Statistics, right under the Health Time Machine's ---------- */
pages.monument=()=>page();
PAR.monument='health';
BN.monument=['🏰','The Ascent Monument','Every climb builds your legacy.','rgba(246,201,79,.18)'];
DIS.monument='The monument is a picture of progress made from your logged stair climbs; its drawn height is not a measurement. The ascent adds repeated climbs together and is not one continuous climb. Landmark heights are from the sources shown. Work against gravity is an idealised physics estimate, not calories burned.';
{const p=pages.stats;pages.stats=function(){const h=p.apply(this,arguments),k='id="tm-door"',i=h.indexOf(k);
  if(i<0)return door()+h;const e=h.indexOf('</button></div>',i);return e<0?door()+h:h.slice(0,e+15)+door()+h.slice(e+15)}}

return{data,build,STAGES,LANDMARKS,riseOf,door,acknowledge,get ack(){return ack()}}})();
