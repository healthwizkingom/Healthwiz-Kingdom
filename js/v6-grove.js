/* v6: stress mini-game (master prompt §54–55, §68, §84–85, §97 step 18). Not part of the original.
   The original Stress Quest (The Storm Within self-check-in, its tools and breathing orb) is unchanged.
   Calming Grove (HWGames 'grove'): a quiet forest pond at dusk with trees, a moon and its reflection,
   fireflies and slow drifting motes. The hero sits by the water.
     breathe   a soft light over the pond grows while you breathe in and shrinks while you breathe out,
               with a gentle countdown. Two calm paces (in 4 · out 6, or in 4 · out 4) and three lengths
               (3, 5 or 8 breaths). Pause and end any time
     respond   each finished breath opens a water lily, wakes a firefly and sends a ripple across the pond
   No score, no streak, nothing to win or lose: ending early still counts. It is a calm moment, not a
   treatment, and it never logs a stress check-in. XP once a day through the framework; each first daily
   completion unlocks the next grove discovery. The grove follows the Mind Forest state (days with a
   check-in, never how stressed you said you were): heavy mist and bare trees while Ruined, then reeds,
   fireflies, a deer and flowers.
   State: st.mg.c.grove = {f: discoveries, b: breaths, s: sessions} (no schema step). */
const HWGrove=(()=>{
const SPR={
  pad:[9,4,'1,0,7,4,#3f9f4a;0,1,9,2,#3f9f4a;4,0,1,2,#2a6a3a;2,1,2,1,#5cc05a'],
  lily:[9,6,'1,2,7,4,#3f9f4a;0,3,9,2,#3f9f4a;3,0,3,3,#ffd6ee;2,1,1,2,#ffb3dc;6,1,1,2,#ffb3dc;4,1,1,1,#f2c14e'],
  reed:[5,12,'1,3,1,9,#3f7a3a;3,0,1,12,#4a8a40;1,0,1,4,#7a4a26;3,0,1,1,#7a4a26;0,8,2,1,#4a8a40'],
  owl:[7,9,'1,0,5,8,#8a6a4a;0,1,1,2,#8a6a4a;6,1,1,2,#8a6a4a;1,2,2,2,#fff6d0;4,2,2,2,#fff6d0;2,3,1,1,#2b2418;4,3,1,1,#2b2418;3,4,1,1,#f2c14e;2,5,3,3,#c9a97a;1,8,5,1,#5b3a1e'],
  chime:[7,13,'0,0,7,1,#5b3a1e;1,1,1,5,#d9d0b0;3,1,1,7,#d9d0b0;5,1,1,4,#d9d0b0;1,6,1,2,#9fe3f0;3,8,1,3,#9fe3f0;5,5,1,2,#9fe3f0;2,11,3,2,#c98f55'],
  stone:[8,4,'1,0,6,4,#8a8f99;0,1,8,2,#8a8f99;2,0,3,1,#a8adb6']};
const spr=(k,x,y,w,cls,style)=>{const s=SPR[k]||HWWater.SP[k];return '<svg class="v6osp '+(cls||'')+'" viewBox="0 0 '+s[0]+' '+s[1]+'" style="left:'+x+'%;top:'+y+'%;'+(w?'width:'+w+'%;':'')+(style||'')+'" shape-rendering="crispEdges" aria-hidden="true">'
  +s[2].split(';').map(r=>{const p=r.split(',');return '<rect x="'+p[0]+'" y="'+p[1]+'" width="'+p[2]+'" height="'+p[3]+'" fill="'+p[4]+'"/>'}).join('')+'</svg>'};

const PACE=[{k:'gentle',n:'Gentle',in:4,out:6},{k:'even',n:'Even',in:4,out:4}],LEN=[3,5,8];
const LILY=[[36,80],[64,82],[42,90],[58,90],[30,86],[70,86],[40,71],[60,71]];
const D=()=>HWGames.data('grove');
const finds=()=>{try{return Math.max(0,+D().f||0)}catch(e){return 0}};
function region(){try{const r=KR.find(x=>x[0]==='mind');return r?HWKingdom.level(r):0}catch(e){return 0}}

HWUI.css('grove',`
.v6gs.v6go{background:linear-gradient(#26304f 0 34%,#2f4a4a 34% 46%,#2f6a44 46%)}
.v6go .v6osp{position:absolute;transform:translate(-50%,-100%);image-rendering:pixelated;pointer-events:none;height:auto;z-index:2}
.v6go .v6osp.front{z-index:5}.v6go .v6wsp{z-index:1}
.v6go .v6omoon{position:absolute;left:80%;top:8%;width:7%;aspect-ratio:1;background:#fff6d0;box-shadow:0 0 0 3px #f2e6b0;z-index:1}
.v6go .v6omoon::after{content:'';position:absolute;left:58%;top:20%;width:24%;aspect-ratio:1;background:#e8dca8}
.v6go .v6opond{position:absolute;left:50%;top:79%;width:56%;height:28%;transform:translate(-50%,-50%);border-radius:50%;background:#2f5f86;border:4px solid #24485e;box-shadow:inset 0 6px 0 #3a6f98;z-index:1;overflow:hidden}
.v6go.v6omurky .v6opond{background:#3f5a4e;box-shadow:inset 0 6px 0 #4a6a5a}
.v6go .v6opond .v6orf{position:absolute;left:62%;top:22%;width:9%;height:16%;background:#fff6d0;opacity:.55}
.v6go .v6opond .v6orf::after{content:'';position:absolute;left:-40%;top:110%;width:180%;height:30%;background:#fff6d0;opacity:.6}
.v6go .v6orip{position:absolute;left:50%;top:50%;width:30%;aspect-ratio:2;border:2px solid #dff4ff;border-radius:50%;transform:translate(-50%,-50%) scale(.2);opacity:0;pointer-events:none}
.v6go .v6orip.go{animation:v6orip 1.6s steps(10) forwards}@keyframes v6orip{0%{opacity:.9;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.6)}}
.v6go .v6oorb{position:absolute;left:50%;top:71%;width:13%;aspect-ratio:1;margin:-6.5% 0 0 -6.5%;border-radius:50%;z-index:4;pointer-events:none;
  background:radial-gradient(circle,#fffbe0 0 22%,#cfe8ff 38%,rgba(159,227,240,.35) 62%,transparent 72%);transform:scale(.75);transition:transform 4s ease-in-out;display:flex;align-items:center;justify-content:center}
.v6go .v6oorb b{font:clamp(8px,1.8vw,14px)/1 var(--fh);color:#26304f}
.v6go .v6omist{position:absolute;inset:30% 0 0 0;background:linear-gradient(transparent,rgba(200,210,220,var(--m,.1)) 40%,rgba(200,210,220,var(--m,.1)));z-index:3;pointer-events:none}
.v6go .v6omote{position:absolute;width:3px;height:3px;background:#fff6d0;opacity:.7;z-index:3;pointer-events:none;animation:v6omote var(--d,12s) linear infinite}
@keyframes v6omote{0%{transform:translate(0,0);opacity:0}20%{opacity:.7}100%{transform:translate(var(--x,20px),-60px);opacity:0}}
.v6go .v6wff{z-index:4}.v6go .v6wff.v6onew{animation-delay:0s}
.v6go .v6osp.v6olily{animation:v6oin .6s steps(4)}@keyframes v6oin{from{transform:translate(-50%,-100%) scale(.2)}}
.v6gctl .v6opick{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;width:100%}
.v6gctl .v6opick span{font:7px/1.6 var(--fh);width:100%;text-align:center}
.v6gctl .v6opick button[aria-pressed="true"]{background:var(--gold);color:#2b2418}
.v6gctl .v6ophase{font:9px/1.6 var(--fh);text-align:center;width:100%;margin:0}
.v6gctl .v6ohint{font-size:12px;text-align:center;width:100%;margin:0}
@media(prefers-reduced-motion:reduce){.v6go .v6oorb{transition:none!important}.v6go .v6orip.go,.v6go .v6omote,.v6go .v6osp.v6olily{animation:none!important}.v6go .v6omote,.v6go .v6orip{display:none}}
html.hw-q-performance .v6go .v6omote:nth-child(2n){display:none}
`);

function scene(lv,n,M){let h='<div class="v6omoon" aria-hidden="true"></div>';
  const T=[[6,48],[16,44],[28,47],[72,46],[84,44],[95,48]];
  h+=T.map((p,i)=>spr(lv===0&&i%2?'dead':'tree',p[0],p[1],9,i%3?'':'v6wsw','animation-delay:-'+i*.6+'s')).join('');
  h+=spr('bush',10,62,8)+spr('bush',90,64,8);
  h+='<div class="v6opond" aria-hidden="true"><i class="v6orf"></i></div>';
  if(lv>=1)h+=[[22,70],[78,70],[26,92],[74,94]].map(p=>spr('sprout',p[0],p[1],2.4)).join('');
  if(lv>=2)h+=spr('reed',25,80,2.6)+spr('reed',75,82,2.6)+spr('reed',70,90,2.2);
  if(lv>=3)h+=spr('deer',88,74,7,'front');
  if(lv>=4)h+=[[14,74],[86,82],[20,96],[82,98],[30,66]].map((p,i)=>spr('flower',p[0],p[1],2.2,'','--pc:'+['#ff9be0','#b9a6ff','#ffffff'][i%3])).join('');
  const ff=lv<1?0:M.deco(lv*2);
  for(let i=0;i<ff;i++)h+='<i class="v6wff" style="left:'+(12+i*37%76)+'%;top:'+(40+i*13%26)+'%;animation-delay:-'+(i*.7)+'s" aria-hidden="true"></i>';
  if(!M.reduced)for(let i=0;i<M.deco(6);i++)h+='<i class="v6omote" style="left:'+(10+i*17%80)+'%;top:'+(60+i*11%30)+'%;--d:'+(10+i%4*3)+'s;--x:'+(i%2?18:-18)+'px;animation-delay:-'+(i*1.7)+'s" aria-hidden="true"></i>';
  h+=[[34,75],[66,76]].map(p=>spr('pad',p[0],p[1],3.6)).join('');
  if(n>=1)h+=[[27,81],[74,80]].map(p=>spr('lily',p[0],p[1],3.4)).join('');
  if(n>=2)h+=spr('owl',16,30,3.4);
  if(n>=3)h+=spr('chime',84,30,2.8,'v6wsw');
  if(n>=4)h+=[[80,92],[74,96],[68,99]].map(p=>spr('stone',p[0],p[1],3.4)).join('');
  h+='<div class="v6omist" aria-hidden="true" style="--m:'+[.55,.35,.2,.1,.05][lv]+'"></div>';
  return h}

HWGames.register({id:'grove',name:'Calming Grove',icon:'🌿',page:'stress',area:'Mind',xp:10,
  blurb:'Sit by a quiet pond and follow a soft light as it grows and shrinks with your breath.',
  note:'A calm moment, not a treatment. It does not log a stress check-in, and you can stop any time. If you often feel overwhelmed, talk to someone you trust or a qualified professional.',
  before:['<div class="card"><h3>CHECK-INS</h3>'],
  finds:[['🪷','Water lilies','Pink water lilies now float on the grove pond.'],['🦉','Grove owl','A quiet owl now watches over the grove from its branch.'],['🎐','Wind chime','A little wind chime now hangs in the trees and moves with the breeze.'],['🪨','Stepping stones','Smooth stepping stones now lead down to the water.'],['📜','Lore: the still pond','The grove keepers say a muddy pond clears not by stirring it, but by letting it rest a while.']],
  progress(){const d=D(),b=+d.b||0;return b?b+(b===1?' calm breath':' calm breaths'):''},
  start(g){const lv=region(),n=finds(),S=g.stage;S.classList.add('v6go');if(lv===0)S.classList.add('v6omurky');
    S.innerHTML=scene(lv,n,g)+'<div class="v6oorb" aria-hidden="true"><b></b></div>';
    const orb=S.querySelector('.v6oorb'),num=orb.querySelector('b'),pond=S.querySelector('.v6opond');
    const hero=g.hero(15,86,'calm');
    let pace=PACE[0],len=LEN[1],done=0,ph=null,left=0,full=0,paused=false,stop=null,lilies=0;
    function setup(){const C=g.controls;C.innerHTML='';
      const grp=(t,L,cur,lab,fn)=>{const w=document.createElement('div');w.className='v6opick';w.setAttribute('role','group');w.setAttribute('aria-label',t);w.innerHTML='<span aria-hidden="true">'+t.toUpperCase()+'</span>';
        L.forEach(x=>{const b=document.createElement('button');b.type='button';b.className='sm g';b.innerHTML=lab(x);b.setAttribute('aria-pressed',x===cur?'true':'false');b.onclick=()=>{if(g.alive()){fn(x);setup()}};w.appendChild(b)});C.appendChild(w)};
      grp('Pace',PACE,pace,x=>x.n+' · in '+x.in+', out '+x.out,x=>{pace=x});
      grp('Length',LEN,len,x=>x+' breaths',x=>{len=x});
      g.button('🌿 BEGIN',begin);
      const p=document.createElement('p');p.className='v6ohint mut';p.textContent='Breathe in as the light grows, out as it shrinks. Comfortable and slow; there is nothing to get right.';C.appendChild(p);
      g.status('Choose a pace')}
    function playing(){const C=g.controls;C.innerHTML='';
      const p=document.createElement('p');p.className='v6ophase';p.setAttribute('aria-hidden','true');C.appendChild(p);
      g.button(paused?'▶ RESUME':'⏸ PAUSE',()=>{paused?resume():pause()},'g');g.button('✓ END HERE',end,'g');
      const h=document.createElement('p');h.className='v6ohint mut';h.textContent='Stop whenever you like. Ending early still counts.';C.appendChild(h);show()}
    const secs=()=>Math.max(1,Math.ceil(left/g.T(1000)));
    function show(){const t=ph==='in'?'Breathe in':'Breathe out',P=g.controls.querySelector('.v6ophase');
      if(P)P.textContent=paused?'PAUSED · breath '+(done+1)+' of '+len:t.toUpperCase()+' · '+secs();num.textContent=paused?'II':secs();
      g.status(paused?'Paused':'Breath '+(done+1)+' / '+len+' · '+t)}
    function phase(k){ph=k;full=left=g.T((k==='in'?pace.in:pace.out)*1000);orb.style.transitionDuration=g.reduced?'0s':left/1000+'s';orb.style.transform='scale('+(k==='in'?1.6:.75)+')';show();if(k==='in')g.sound('soft')}
    function begin(){done=0;paused=false;playing();phase('in');stop=g.every(g.T(200),dt=>{if(paused)return;const s0=secs();left-=dt;
      if(left<=0){if(ph==='in')phase('out');else breathDone()}else if(secs()!==s0)show()})}
    function breathDone(){done++;bloom();
      if(done>=len){if(stop)stop();end();return}phase('in')}
    function bloom(){const r=document.createElement('i');r.className='v6orip';pond.appendChild(r);void r.offsetWidth;r.classList.add('go');g.after(1700,()=>r.remove());
      if(lilies<LILY.length){const p=LILY[lilies++];S.insertAdjacentHTML('beforeend',spr('lily',p[0],p[1],3.2,'v6olily'))}
      if(!g.reduced&&HWMotion.count(1)){const f=document.createElement('i');f.className='v6wff new';f.setAttribute('aria-hidden','true');f.style.left=(30+Math.random()*40)+'%';f.style.top=(50+Math.random()*20)+'%';S.appendChild(f)}
      g.pop(50,62,'🪷')}
    function pause(){if(paused||!ph)return;paused=true;const m=getComputedStyle(orb).transform;orb.style.transitionDuration='0s';orb.style.transform=m==='none'?'':m;playing()}
    function resume(){if(!paused)return;paused=false;orb.style.transitionDuration=g.reduced?'0s':left/1000+'s';orb.style.transform='scale('+(ph==='in'?1.6:.75)+')';playing()}
    function end(){if(stop)stop();stop=null;g.controls.innerHTML='';orb.style.transitionDuration=g.reduced?'0s':'1.2s';orb.style.transform='scale(.9)';num.textContent='';
      const d=g.data();d.b=(+d.b||0)+done;d.s=(+d.s||0)+1;g.pose(hero,'idle');
      if(done)g.burst(orb,{n:14,palette:'magic',speed:1.4,up:1,life:900});
      g.after(g.A(900),()=>g.finish({icon:'🪷',title:done?'A QUIET MOMENT':'THE GROVE WILL WAIT',result:done+' breaths',ok:done>0,palette:'magic',
        lines:done?[done+(done===1?' slow breath':' slow breaths')+' by the pond ('+pace.n.toLowerCase()+' pace: in '+pace.in+', out '+pace.out+').',
          'However you feel now is okay. If you would like to note it, the Stress Quest page has a check-in.',
          'Mind Forest: '+HWKingdom.NAMES[lv]+'. It grows with the days you check in, never with how stressed you say you are.']
          :['No breaths this time, and that is fine. The pond will be here whenever you want it.']}))}
    setup()}});

return{PACE,LEN,region,finds}})();
