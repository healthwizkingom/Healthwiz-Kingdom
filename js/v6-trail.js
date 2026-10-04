/* v6: activity mini-game (master prompt §52–53, §68, §85, §97 step 17). Not part of the original.
   Adventure Trail (HWGames 'trail'): a top-down trail through a forest, over a river bridge, up a hill
   and a short stone stairway to a lookout, with four checkpoints on the way.
     navigation  at each fork three paths carry trail blazes (shape + colour + name, never colour alone);
                 follow today's blaze (tap a path, or ← ↑ → / 1–3). A wrong path is a friendly loop
                 back to the sign, never a penalty
     rhythm      on the stairs, tap STEP (or ↑) to climb eight steps. A lantern glows on a slow beat
                 and stepping with it shows "In step!", but any pace works and nothing is timed
   It is a game, not exercise: no speed, no score, no timer, nothing physically demanding, and it never
   logs activity. XP once a day through the framework; each first daily completion unlocks the next
   trail discovery. The trail follows the Stair Mountain state (days with activity logged, never how
   far or how hard): fallen logs and a broken rail while Ruined, then flags, hikers and flowers.
   State: st.mg.c.trail = {f: discoveries, r: trails walked} (no schema step). */
const HWTrail=(()=>{
const SPR={
  hiker:[7,13,'2,0,3,1,#3d2412;1,1,5,3,#f1c27d;2,2,1,1,#2b2418;4,2,1,1,#2b2418;1,4,5,5,var(--vc,#4a7fc6);5,4,2,4,#8a5a2b;0,5,1,3,#f1c27d;1,9,2,4,#5b3a1e;4,9,2,4,#5b3a1e'],
  sign:[8,9,'3,3,2,6,#5b3a1e;0,0,8,3,#a8693a;0,0,8,1,#c98f55;1,1,2,1,#5b3a1e;4,1,3,1,#5b3a1e'],
  bench:[12,6,'0,0,12,2,#a8693a;0,0,12,1,#c98f55;1,2,1,4,#5b3a1e;10,2,1,4,#5b3a1e;0,3,12,1,#8a5a2b'],
  flag:[6,10,'0,0,1,10,#5b3a1e;1,0,5,3,var(--fc,#e0483f);1,3,3,1,var(--fc,#e0483f)'],
  log:[12,4,'0,1,12,3,#7a4a26;0,1,12,1,#a8693a;0,1,2,3,#c98f55;1,2,1,1,#7a4a26'],
  tower:[14,22,'1,0,12,3,#a8473a;0,3,14,1,#7a2f26;2,4,10,8,#d9d0b0;5,6,4,3,#3a3a48;2,12,2,10,#8a8f99;10,12,2,10,#8a8f99;4,15,6,1,#8a8f99;4,19,6,1,#8a8f99']};
const spr=(k,x,y,w,cls,style)=>{const s=SPR[k]||HWWater.SP[k];return '<svg class="v6tsp '+(cls||'')+'" viewBox="0 0 '+s[0]+' '+s[1]+'" style="left:'+x+'%;top:'+y+'%;'+(w?'width:'+w+'%;':'')+(style||'')+'" shape-rendering="crispEdges" aria-hidden="true">'
  +s[2].split(';').map(r=>{const p=r.split(',');return '<rect x="'+p[0]+'" y="'+p[1]+'" width="'+p[2]+'" height="'+p[3]+'" fill="'+p[4]+'"/>'}).join('')+'</svg>'};

/* checkpoints (stage %), the legs between them and the trail blazes */
const CP=[[14,88],[28,60],[54,76],[70,50],[85,22]];
const CPN=['Forest Gate','Forest Clearing','Old Bridge','Hilltop','Lookout'];
const LEG=['Forest fork','Riverbank fork','Hill path fork','Stone stairs'];
const BLAZE=[{n:'yellow square',s:'■',c:'#f2c14e'},{n:'red triangle',s:'▲',c:'#e0483f'},{n:'blue circle',s:'●',c:'#5fb4ec'},{n:'white diamond',s:'◆',c:'#ffffff'}];
const DIR=[{k:'L',n:'Left',a:'←',v:[-11,-4]},{k:'U',n:'Ahead',a:'↑',v:[0,-15]},{k:'R',n:'Right',a:'→',v:[11,-4]}];
const STEPS=8,BEAT=1000;
const D=()=>HWGames.data('trail');
const finds=()=>{try{return Math.max(0,+D().f||0)}catch(e){return 0}};
function region(){try{const r=KR.find(x=>x[0]==='stair');return r?HWKingdom.level(r):0}catch(e){return 0}}
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

HWUI.css('trail',`
.v6gs.v6gtr{background:#5c9e4a repeating-conic-gradient(#62a650 0 25%,#5c9e4a 0 50%) 0 0/24px 24px}
.v6gtr .v6tland{position:absolute;inset:0;width:100%;height:100%;z-index:0}
.v6gtr .v6tsp{position:absolute;transform:translate(-50%,-100%);image-rendering:pixelated;pointer-events:none;height:auto;z-index:1}
.v6gtr .v6tsp.front{z-index:5}
.v6gtr .v6tpost{position:absolute;transform:translate(-50%,-100%);z-index:3;width:7%;height:15%;min-width:28px}
.v6gtr .v6tpost i{position:absolute;left:50%;bottom:0;width:10%;height:62%;background:#5b3a1e;transform:translateX(-50%)}
.v6gtr .v6tpost b{position:absolute;left:50%;top:0;transform:translateX(-50%);width:62%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:#2b2418;border:2px solid #a8693a;font-size:clamp(10px,2.4vw,18px);line-height:1}
.v6gtr .v6tpost.v6tno{opacity:.45}.v6gtr .v6tpost.v6tno b::after{content:'↺';position:absolute;right:-60%;top:-40%;font-size:70%;color:#fff}
.v6gtr .v6tsgn{position:absolute;transform:translate(-50%,-100%);z-index:3;background:#a8693a;border:2px solid #4a3018;padding:2px 4px;font:clamp(5px,1.1vw,8px)/1.4 var(--fh);color:#fff;white-space:nowrap;pointer-events:none}
.v6gtr .v6tsgn b{font-size:150%;vertical-align:middle}
.v6gtr .lan{z-index:2}.v6gtr.v6tbeat .lan svg rect[fill="#f2c14e"],.v6gtr.v6tbeat .lan rect[fill="#fff2a8"]{fill:#fffbe0}
.v6gtr.v6tbeat .v6tglow{opacity:1}.v6gtr .v6tglow{position:absolute;left:79%;top:33%;width:7%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(#fff6a0 0 30%,transparent 70%);opacity:.25;z-index:2;pointer-events:none;transition:opacity .15s steps(2)}
.v6gtr .v6tsp.v6thop.go{animation:v6whop .5s steps(3) 2}
.v6gctl .v6tbt{display:flex;align-items:center;gap:8px;justify-content:center;width:100%;font:8px/1.6 var(--fh)}
.v6gctl .v6tbt i{width:14px;height:14px;background:#6b5a2a;border:2px solid var(--ln)}.v6gctl .v6tbt.on i{background:#fff6a0}
.v6gctl .v6thint{font-size:12px;text-align:center;width:100%;margin:0}
.v6gctl button .bz{display:inline-block;min-width:1.2em;padding:0 3px;margin-left:4px;background:#2b2418;border:2px solid #a8693a;font-size:14px;line-height:1.2}
@media(prefers-reduced-motion:reduce){.v6gtr .v6tsp.v6thop.go,.v6gtr .v6tsp.v6wfl,.v6gtr .v6tsp.v6wsw{animation:none!important}.v6gtr .v6tglow{transition:none}}
html.hw-q-performance .v6gtr .v6tsp.v6wsw,html.hw-q-performance .v6gtr .v6tsp.v6wfl{animation:none}
`);

/* the land: forest, river with a bridge, hill, stone stairs and the lookout (viewBox 150×100 = stage 3:2) */
function land(lv){const X=x=>x*1.5,pts=CP.map(p=>X(p[0])+','+p[1]).join(' ');let g='';
  g+='<ellipse cx="'+X(68)+'" cy="58" rx="30" ry="18" fill="#6fb85a"/><ellipse cx="'+X(70)+'" cy="54" rx="20" ry="11" fill="#7ec466"/>';
  g+='<path d="M'+X(43)+' 0 C'+X(37)+' 30 '+X(46)+' 55 '+X(40)+' 100 L'+X(47)+' 100 C'+X(53)+' 55 '+X(44)+' 30 '+X(50)+' 0 Z" fill="#4f9bd6"/><path d="M'+X(45)+' 6 L'+X(46)+' 12 M'+X(44)+' 40 L'+X(45)+' 46 M'+X(45)+' 84 L'+X(44)+' 90" stroke="#dff4ff" stroke-width="1.2"/>';
  g+='<polyline points="'+pts+'" fill="none" stroke="#c9a96a" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><polyline points="'+pts+'" fill="none" stroke="#e0c690" stroke-width="2" stroke-dasharray="2 3" stroke-linejoin="round"/>';
  // the bridge where the path crosses the river (a missing plank and a broken rail while Ruined)
  const bx=X(41),by=68;g+='<g transform="rotate(-28 '+bx+' '+by+')">';for(let i=0;i<7;i++)if(!(lv===0&&i===4))g+='<rect x="'+(bx-10+i*3)+'" y="'+(by-3)+'" width="2.4" height="6" fill="#a8693a"/>';
  g+='<rect x="'+(bx-11)+'" y="'+(by-4)+'" width="'+(lv===0?10:22)+'" height="1" fill="#5b3a1e"/>'+(lv===0?'<rect x="'+(bx+3)+'" y="'+(by-4)+'" width="8" height="1" fill="#5b3a1e" transform="rotate(14 '+(bx+3)+' '+(by-4)+')"/>':'')+'<rect x="'+(bx-11)+'" y="'+(by+3)+'" width="22" height="1" fill="#5b3a1e"/></g>';
  // stone stairs from the hilltop to the lookout, one block per step (a cracked step while Ruined)
  for(let i=0;i<STEPS;i++){const t=(i+.5)/STEPS,x=X(CP[3][0]+(CP[4][0]-CP[3][0])*t),y=CP[3][1]+(CP[4][1]-CP[3][1])*t;g+='<rect x="'+(x-4.5).toFixed(1)+'" y="'+(y-1.5).toFixed(1)+'" width="9" height="3" fill="'+(lv===0&&i===5?'#7d7462':'#b9b3a2')+'" stroke="#6b6658" stroke-width=".5"/>'}
  return '<svg class="v6tland" viewBox="0 0 150 100" preserveAspectRatio="none" aria-hidden="true">'+g+'</svg>'}
function scenery(lv,n){let h='';
  const T=[[4,40],[13,30],[22,40],[6,56],[17,48],[30,38],[36,22],[11,72],[24,90]];
  h+=T.map((p,i)=>spr(lv===0&&i%3===1?'dead':'tree',p[0],p[1],7,i%2?'v6wsw':'','animation-delay:-'+i*.5+'s')).join('');
  h+=spr('bush',60,96,7)+spr('bush',96,90,6)+spr('tower',94,25,8);
  if(lv===0)h+=spr('log',20,76,7)+spr('dead',60,40,5);
  if(lv>=1)h+=[[34,66],[48,86],[64,62],[76,64]].map(p=>spr('sprout',p[0],p[1],2.4)).join('');
  if(lv>=2)h+=CP.slice(1,4).map((p,i)=>spr('flag',p[0]+4,p[1]-1,2.4,'','--fc:'+['#e0483f','#f2c14e','#5fb4ec'][i])).join('');
  if(lv>=3)h+=spr('hiker',60,88,3.2,'v6thop','--vc:#e0704a')+spr('hiker',94,36,3.2,'v6thop','--vc:#8767c8;animation-delay:-.2s');
  if(lv>=4)h+=[[80,24],[84,26],[92,25],[96,23],[33,60],[24,62]].map((p,i)=>spr('flower',p[0],p[1],2.2,'','--pc:'+['#ff9be0','#f2c14e','#ffffff'][i%3])).join('');
  if(n>=1)h+=CP.slice(0,4).map(p=>spr('sign',p[0]-5,p[1]+1,3.6)).join('');
  if(n>=2)h+=[[18,36],[62,44],[33,82]].map((p,i)=>spr('fly',p[0],p[1],2.4,'v6wfl','animation-delay:-'+i*.7+'s')).join('');
  if(n>=3)h+=spr('bench',63,56,6);
  if(n>=4)h+=[0,3,6].map(i=>{const t=(i+.5)/STEPS;return spr('lantern',CP[3][0]+(CP[4][0]-CP[3][0])*t-6,CP[3][1]+(CP[4][1]-CP[3][1])*t+1,1.8)}).join('');
  return h}

HWGames.register({id:'trail',name:'Adventure Trail',icon:'🥾',page:'stair',area:'Activity',xp:10,
  blurb:'Follow the trail blazes through the forest, over the bridge and up the stairs to the lookout.',
  note:'A game only. It does not log activity and nothing is timed. Log real stair sessions on the Stair Quest page.',
  before:['<!--stair-games-->'], // js/v6-stairs.js: after the Session Chronicle, before Running
  finds:[['🪧','Trail signposts','Carved signposts now stand at every checkpoint.'],['🦋','Meadow butterflies','Butterflies now drift over the forest and the river.'],['🪑','Hilltop bench','A bench now waits on the hill for anyone who wants a breather.'],['🏮','Stair lanterns','Little lanterns now light the stone stairs to the lookout.'],['📜','Lore: the guide\'s pace','The mountain guides say a good pace is one where you can still chat with a friend, and a rest is never a failure.']],
  progress(){const r=+D().r||0;return r?r+(r===1?' trail walked':' trails walked'):''},
  start(g){const lv=region(),n=finds(),S=g.stage;S.classList.add('v6gtr');
    const B=shuffle(BLAZE),mine=B[0];
    S.innerHTML=land(lv)+scenery(lv,n)+'<div class="v6tglow" aria-hidden="true"></div><div class="v6tmk"></div>';
    const mk=S.querySelector('.v6tmk'),hero=g.hero(CP[0][0],CP[0][1],'idle');
    let at=0,busy=false,det=0,steps=0,inStep=0,opts=[],wrong=new Set(),beat=null,lastBeat=0;
    const hop=()=>S.querySelectorAll('.v6tsp.v6thop').forEach(e=>{e.classList.remove('go');void e.getBoundingClientRect();e.classList.add('go')});
    const walk=(p,ms,fn)=>{g.pose(hero,'walk');g.move(hero,p[0],p[1],ms);g.sound('step');g.after(g.A(ms+20),()=>{g.pose(hero,'idle');fn()})};
    const lbl=(o,i)=>DIR[i].n+' path, '+o.n+' blaze'+(wrong.has(i)?', leads back here':'');
    function fork(){const p=CP[at];opts=shuffle([mine,...shuffle(B.slice(1)).slice(0,2)]);wrong=new Set();
      mk.innerHTML='<div class="v6tsgn" style="left:'+clamp(p[0],8,92)+'%;top:'+Math.min(p[1]+10,99)+'%">FOLLOW <b style="color:'+mine.c+'">'+mine.s+'</b></div>'
        +opts.map((o,i)=>{const v=DIR[i].v;return '<button type="button" class="v6gt v6tpost" data-i="'+i+'" style="left:'+clamp(p[0]+v[0],4,96)+'%;top:'+clamp(p[1]+v[1],18,98)+'%"><i></i><b style="color:'+o.c+'">'+o.s+'</b></button>'}).join('');
      mk.querySelectorAll('.v6tpost').forEach(b=>b.onclick=()=>{if(g.alive())choose(+b.dataset.i)});controls();upd()}
    function upd(){const P=[...mk.querySelectorAll('.v6tpost')];P.forEach((b,i)=>{b.setAttribute('aria-label',lbl(opts[i],i));b.classList.toggle('v6tno',wrong.has(i));b.setAttribute('aria-disabled',busy||wrong.has(i)?'true':'false')});
      g.status(at<3?'Checkpoint '+at+' / 4 · follow the '+mine.n:at===3?'Stairs '+steps+' / '+STEPS:'Lookout reached')}
    function controls(){const C=g.controls;C.innerHTML='';
      if(at<3){opts.forEach((o,i)=>{const b=g.button(DIR[i].a+' '+DIR[i].n.toUpperCase()+' <span class="bz" style="color:'+o.c+'" aria-hidden="true">'+o.s+'</span>',()=>choose(i),'g');b.setAttribute('aria-label',lbl(o,i));b.disabled=busy||wrong.has(i)});
        const p=document.createElement('p');p.className='v6thint mut';p.textContent=LEG[at]+': the sign shows today\'s blaze, the '+mine.n+' '+mine.s+'. Pick the path that carries it (← ↑ → or 1–3).';C.appendChild(p);return}
      if(at===3){const t=document.createElement('div');t.className='v6tbt';t.setAttribute('aria-hidden','true');t.innerHTML=g.reduced?'<span>STEP WHEN READY</span>':'<i></i><span>LANTERN BEAT</span>';C.appendChild(t);
        const b=g.button('▲ STEP UP ('+steps+' / '+STEPS+')',step);b.disabled=busy;
        const p=document.createElement('p');p.className='v6thint mut';p.textContent=g.reduced?'Tap STEP UP or press ↑, at any pace.':'Tap STEP UP or press ↑. Step with the lantern\'s glow if you like; any pace is fine.';C.appendChild(p)}}
    function choose(i){if(busy||at>=3||wrong.has(i)||!opts[i])return;busy=true;controls();upd();const p=CP[at],v=DIR[i].v,q=[clamp(p[0]+v[0],4,96),clamp(p[1]+v[1]+2,18,98)];
      walk(q,500,()=>{if(opts[i]===mine){g.sound('good');g.pop(q[0],q[1]-14,'This way!');
          walk(CP[at+1],900,()=>{at++;busy=false;g.pop(CP[at][0],CP[at][1]-16,CPN[at]+'!');g.burst([CP[at][0],CP[at][1]-6],{n:10,palette:'leaf',speed:1.8,up:1,life:600});if(at<3)fork();else stairs()})}
        else{det++;wrong.add(i);g.sound('soft');g.pop(q[0],q[1]-14,'A loop! Back to the sign.');walk(p,500,()=>{busy=false;controls();upd()})}})}
    function stairs(){mk.innerHTML='';busy=false;controls();upd();
      if(!g.reduced)beat=g.every(g.T(BEAT),()=>{lastBeat=performance.now();S.classList.add('v6tbeat');const t=g.controls.querySelector('.v6tbt');if(t)t.classList.add('on');
        g.after(g.T(260),()=>{S.classList.remove('v6tbeat');const t=g.controls.querySelector('.v6tbt');if(t)t.classList.remove('on')})})}
    function step(){if(busy||at!==3||steps>=STEPS)return;steps++;const per=g.T(BEAT),dt=performance.now()-lastBeat,on=!g.reduced&&lastBeat&&Math.min(dt,per-dt)<per*.25;
      if(on){inStep++;g.pop(clamp(hero.offsetLeft/S.clientWidth*100+8,8,92),CP[3][1]-14-steps*3,'In step!')}
      const t=steps/STEPS;g.pose(hero,'walk');g.move(hero,CP[3][0]+(CP[4][0]-CP[3][0])*t,CP[3][1]+(CP[4][1]-CP[3][1])*t,260);g.sound(on?'soft':'step');
      g.after(g.A(280),()=>{if(at===3&&steps<STEPS)g.pose(hero,'idle')});
      const b=g.controls.querySelector('button');if(b)b.textContent='▲ STEP UP ('+steps+' / '+STEPS+')';upd();
      if(steps>=STEPS){busy=true;if(beat)beat();S.classList.remove('v6tbeat');g.after(g.A(300),arrive)}}
    function arrive(){at=4;upd();g.controls.innerHTML='';g.pose(hero,'cel');hop();g.sound('done');g.pop(CP[4][0]-6,CP[4][1]-6,'The lookout!');g.burst([CP[4][0],CP[4][1]-8],{n:22,palette:'gold',speed:2.4,up:1,life:800});
      g.after(g.A(1100),()=>{const d=g.data();d.r=(+d.r||0)+1;
        g.finish({icon:'⛰️',title:'TRAIL COMPLETE!',result:'4 checkpoints',
          lines:['Forest, river bridge, hill and stairs: all four checkpoints reached, following the '+mine.n+' blaze.',
            det?det+(det===1?' friendly detour':' friendly detours')+' along the way. Exploring counts too.':'You followed the blaze at every fork.',
            g.reduced?'You climbed the eight stone steps at your own pace.':'Eight stone steps, '+inStep+' in step with the lantern. Any pace is a good pace.',
            'Stair Mountain: '+HWKingdom.NAMES[lv]+'. It grows with the days you log activity, never with how far or how hard you go.']})})}
    g.key(e=>{if(busy)return;const k=e.key;
      if(at<3){const i={ArrowLeft:0,ArrowUp:1,ArrowRight:2,'1':0,'2':1,'3':2}[k];if(i!=null){choose(i);return true}}
      else if(at===3&&(k==='ArrowUp'||k==='w'||k==='W')){step();return true}});
    fork();g.pop(CP[0][0]+6,CP[0][1]-18,'Follow the '+mine.s+'!')}});

return{CP,BLAZE,region,finds}})();
