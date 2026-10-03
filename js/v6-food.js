/* v6: nutrition mini-game (master prompt §50–51, §59–60, §68, §85, §97 step 16). Not part of the original.
   Market Kitchen (HWGames 'food'): a small market square with five stalls, a kitchen pot and a table.
     select     tap a stall (or press 1–5) and choose one of three foods from the real menu (1–3)
     inspect    every choice shows its standard serving, kcal and estimated macros (EST, from the original
                estMac(): typical composition, not lab values)
     build      the hero walks to the stall, picks the food up, cooks it at the pot and serves it onto the plate
     balance    the plate follows the Malaysian Healthy Plate idea (suku-suku separuh): vegetables, fruit,
                grains and protein; a drink is optional. Picking again from a stall swaps that part
     complete   serve the plate: the cook and villagers react, the plate is presented
   There is no score, no timer, no calorie target and nothing is "bad" or off limits: the game rewards
   variety (choices lean toward foods not tried yet) and never rewards eating less. It never logs food.
   XP once a day through the framework; each first daily completion unlocks the next market discovery.
   The square follows the Nutrition Village region state (days with a meal logged, never what was eaten).
   State: st.mg.c.food = {f: discoveries, m: meals served, t: [food names tried]} (no schema step). */
const HWFood=(()=>{
const SPR={
  cook:[8,14,'2,0,4,2,#ffffff;1,1,6,1,#ffffff;2,2,4,3,#f1c27d;3,3,1,1,#2b2418;5,3,1,1,#2b2418;1,5,6,5,#ffffff;2,6,4,4,#e9e3d6;0,6,1,3,#f1c27d;7,6,1,3,#f1c27d;2,10,1,4,#3a3a48;5,10,1,4,#3a3a48'],
  folk:[7,13,'2,0,3,1,#3d2412;1,1,5,3,#f1c27d;2,2,1,1,#2b2418;4,2,1,1,#2b2418;1,4,5,5,var(--vc,#4a7fc6);0,5,1,3,#f1c27d;6,5,1,3,#f1c27d;1,9,2,4,#5b3a1e;4,9,2,4,#5b3a1e'],
  cat:[9,6,'1,2,6,3,#e08a3a;6,0,3,3,#e08a3a;6,0,1,1,#b8652a;8,0,1,1,#b8652a;7,1,1,1,#2b2418;0,1,1,2,#e08a3a;1,5,1,1,#b8652a;5,5,1,1,#b8652a;2,3,3,1,#f2b26b'],
  rack:[12,8,'0,7,12,1,#6b4a2b;0,0,1,8,#6b4a2b;11,0,1,8,#6b4a2b;0,3,12,1,#6b4a2b;1,1,2,2,#f2c14e;4,1,2,2,#e0483f;7,1,2,2,#5cc05a;9,1,2,2,#a8693a;1,4,2,3,#e0483f;4,5,2,2,#f2c14e;7,4,2,3,#d9d0b0;9,5,2,2,#3f9f4a'],
  herb:[6,7,'1,4,4,3,#a8693a;0,4,6,1,#c98f55;1,0,1,4,#3f9f4a;3,1,1,3,#5cc05a;4,0,1,4,#2f8a3a;2,2,1,1,#5cc05a'],
  pot:[14,10,'1,2,12,6,#3a3a48;0,2,14,1,#55556a;2,3,10,1,#e08a3a;0,4,1,2,#3a3a48;13,4,1,2,#3a3a48;2,8,10,2,#6b4a2b;3,9,2,1,#ff7a3b;7,9,2,1,#ffb347'],
  box:[10,6,'0,1,10,5,#8a5a2b;0,1,10,1,#a8693a;1,0,2,1,#5cc05a;4,0,2,1,#ff9be0;7,0,2,1,#f2c14e']};
const spr=(k,x,y,w,cls,style)=>{const s=SPR[k]||HWWater.SP[k];return '<svg class="v6fsp '+(cls||'')+'" viewBox="0 0 '+s[0]+' '+s[1]+'" style="left:'+x+'%;top:'+y+'%;'+(w?'width:'+w+'%;':'')+(style||'')+'" shape-rendering="crispEdges" aria-hidden="true">'
  +s[2].split(';').map(r=>{const p=r.split(',');return '<rect x="'+p[0]+'" y="'+p[1]+'" width="'+p[2]+'" height="'+p[3]+'" fill="'+p[4]+'"/>'}).join('')+'</svg>'};

/* plate parts: original dish types (fcat) → stall. Kuih, cakes, sauces and sambal have no stall; nothing is excluded for being "bad". */
const STALLS=[
  {k:'veg',n:'Vegetables',ic:'🥬',c:'#5cc05a',d:'#2f8a3a',cats:['veg','veglemak','vegplain','vegsoup'],say:['Fresh greens!','Crunchy and bright!']},
  {k:'fruit',n:'Fruit',ic:'🍎',c:'#e0483f',d:'#9c2a2a',cats:['fruit'],say:['Sweet and ripe!','A juicy pick!']},
  {k:'grain',n:'Grains',ic:'🍚',c:'#f2c14e',d:'#b8862a',cats:['rice','rice2','noodle','soupnoodle','bread','wholebread','cereal','canai','bun','pulut','pizza'],say:['Good energy!','A warm staple!']},
  {k:'protein',n:'Protein',ic:'🍗',c:'#e08a3a',d:'#9c5a22',cats:['egg','soyprot','seafood','fishfry','fishsauce','chickenfry','curry','meat','soup','dal','beans'],say:['A hearty choice!','That will keep thee going!']},
  {k:'drink',n:'Drinks',ic:'🥛',c:'#5fb4ec',d:'#2f6fa8',cats:['water','milk','soy','malt','sweet'],say:['Refreshing!','A cool cup!'],opt:1}];
const NEED=4,SX=[11,30.5,50,69.5,89];
const EMC={rice:'🍚',rice2:'🍛',noodle:'🍜',soupnoodle:'🍜',bread:'🍞',wholebread:'🍞',cereal:'🥣',canai:'🫓',bun:'🥯',pulut:'🍙',pizza:'🍕',egg:'🥚',soyprot:'🫘',seafood:'🦐',fishfry:'🐟',fishsauce:'🐟',chickenfry:'🍗',curry:'🍛',meat:'🥩',soup:'🍲',dal:'🫘',beans:'🫘',veg:'🥦',veglemak:'🥬',vegplain:'🥗',vegsoup:'🍲',water:'💧',milk:'🥛',soy:'🥛',malt:'☕',sweet:'🧃'};
const EMF=[[/^epal/,'🍎'],[/^oren/,'🍊'],[/^tembikai/,'🍉'],[/^nenas/,'🍍'],[/^pisang/,'🍌'],[/^(kurma|kismis)/,'🍇'],[/^jambu/,'🍐'],[/^betik/,'🥭']];
const emo=(n,c)=>{if(c==='fruit'){const l=n.toLowerCase(),m=EMF.find(x=>x[0].test(l));return m?m[1]:'🍎'}return EMC[c]||'🍽️'};

/* the menu, grouped once: one entry per food name (first serving listed), only foods with listed kcal */
let BY=null;
function menu(){if(BY)return BY;BY={};const seen=new Set();
  F.forEach((f,i)=>{if(f[2]==null||seen.has(f[0]))return;const c=fcat(f[0]),s=STALLS.find(x=>x.cats.includes(c));if(!s)return;seen.add(f[0]);(BY[s.k]=BY[s.k]||[]).push({i,name:f[0],serv:f[1],k:+f[2],cat:c,em:emo(f[0],c)})});return BY}
const D=()=>HWGames.data('food');
const tried=()=>{const t=D().t;return Array.isArray(t)?t:[]};
const finds=()=>{try{return Math.max(0,+D().f||0)}catch(e){return 0}};
function region(){try{const r=KR.find(x=>x[0]==='food');return r?HWKingdom.level(r):0}catch(e){return 0}}
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
/* three choices: foods not tried yet first (variety), water always offered at the drinks stall */
function choices(k){const L=menu()[k]||[],T=new Set(tried());let o=shuffle(L).sort((a,b)=>(T.has(a.name)?1:0)-(T.has(b.name)?1:0));
  if(k==='drink'){const w=L.find(x=>x.cat==='water');if(w)o=[w,...o.filter(x=>x!==w)]}return o.slice(0,3)}
const mac=f=>estMac(f.name,f.k);
const macS=m=>'P '+g1(m.p)+' g · C '+g1(m.c)+' g · F '+g1(m.f)+' g · Fibre '+g1(m.fb)+' g';

HWUI.css('food',`
.v6gs.v6gf{background:#c9b48a repeating-conic-gradient(#d2bf96 0 25%,#c9b48a 0 50%) 0 0/20px 20px}
.v6gf .v6fsp{position:absolute;transform:translate(-50%,-100%);image-rendering:pixelated;pointer-events:none;height:auto;z-index:1}
.v6gf .v6fsp.front{z-index:5}
.v6gf button.v6gt.stall{width:17.5%;height:40%;top:3%;transform:translateX(-50%);z-index:2}
.v6gf .stall svg{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated}
.v6gf .stall .em{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:clamp(14px,3.6vw,28px);line-height:1}
.v6gf .stall .lb{position:absolute;left:50%;bottom:2%;transform:translateX(-50%);font:clamp(5px,1.2vw,8px)/1.4 var(--fh);color:#fff;background:rgba(43,36,24,.82);padding:1px 4px;white-space:nowrap}
.v6gf .stall.on svg,.v6gf .stall:hover svg{filter:brightness(1.12)}.v6gf .stall.on{outline:3px dashed #fff6a0;outline-offset:1px}
.v6gf .stall.got .lb::after{content:' ✓'}.v6gf .stall[aria-disabled="true"]{cursor:default}
.v6gf .kit{position:absolute;left:4%;top:70%;width:30%;height:17%;background:#8a5a2b;border:3px solid #4a3018;box-shadow:inset 0 4px 0 #a8693a;z-index:1}
.v6gf .tbl{position:absolute;left:50%;top:66%;width:44%;height:24%;background:#a8693a;border:3px solid #4a3018;box-shadow:inset 0 4px 0 #c98f55;z-index:1}
.v6gf .pot{z-index:2}.v6gf .stm{position:absolute;left:19%;top:57%;width:8%;height:12%;z-index:3;pointer-events:none;opacity:0}
.v6gf .stm i{position:absolute;bottom:0;width:30%;aspect-ratio:1;background:#fff;opacity:.7;animation:v6fst 1s steps(5) infinite}
.v6gf .stm i:nth-child(2){left:35%;animation-delay:-.33s}.v6gf .stm i:nth-child(3){left:70%;animation-delay:-.66s}
.v6gf.cook .stm{opacity:1}.v6gf.cook .pot{animation:v6fbub .25s steps(2) infinite}
@keyframes v6fst{0%{transform:translateY(0);opacity:.8}100%{transform:translateY(-220%);opacity:0}}@keyframes v6fbub{50%{margin-top:-1px}}
.v6gf .plate{position:absolute;left:66%;top:78%;width:20%;aspect-ratio:1;transform:translate(-50%,-50%);z-index:3;transition:transform .5s steps(5)}
.v6gf .plate svg{width:100%;height:100%;display:block}
.v6gf .plate .q{position:absolute;font-size:clamp(12px,3vw,24px);line-height:1;transform:translate(-50%,-50%)}
.v6gf .plate .q:not(:empty){animation:v6fin .4s steps(4)}@keyframes v6fin{from{transform:translate(-50%,-50%) scale(.2)}}
.v6gf .plate.show{transform:translate(-50%,-62%) scale(1.3);z-index:6}
.v6gf .cup{position:absolute;left:85%;top:76%;width:6.5%;aspect-ratio:3/4;transform:translate(-50%,-50%);background:rgba(220,240,255,.55);border:3px solid #dff4ff;border-top-width:2px;z-index:3;display:flex;align-items:center;justify-content:center;font-size:clamp(10px,2.4vw,20px)}
.v6gf .v6fcar{display:none;position:absolute;right:-34%;bottom:30%;font-size:clamp(10px,2.4vw,20px);line-height:1}
.v6gf .v6gch.hold .v6fcar{display:block}
.v6gf .bnt{position:absolute;left:0;right:0;top:1%;height:3%;z-index:3;pointer-events:none;background:repeating-linear-gradient(90deg,#e0483f 0 12px,#f2c14e 12px 24px,#5cc05a 24px 36px,#5fb4ec 36px 48px);clip-path:polygon(0 0,100% 0,100% 40%,0 40%)}
.v6gf .lit{position:absolute;left:0;right:0;top:44%;z-index:1;pointer-events:none;display:flex;justify-content:space-around}
.v6gf .lit i{width:6px;height:6px;background:#ffd76a;box-shadow:0 0 6px #ffd76a}
.v6gf .torn rect.tr{fill:#3a2a1a}
.v6gf .v6fsp.v6fhop.go{animation:v6whop .5s steps(3) 2}
.v6gctl .v6fch{display:flex;flex-direction:column;gap:6px;width:100%}
.v6gctl .v6fch h4{font:8px/1.6 var(--fh);margin:0;text-align:center}
.v6gctl .v6fch button{display:flex;gap:8px;align-items:center;text-align:left;justify-content:flex-start;width:100%}
.v6gctl .v6fch button .fe{font-size:22px;line-height:1}.v6gctl .v6fch button small{display:block;font-size:11px;line-height:1.5;opacity:.85}
.v6gctl .v6fch .tag{margin-left:4px;font:7px/1.5 var(--fh);background:#ffe9a6;padding:0 3px;opacity:1}
.v6gctl .v6fhint{font-size:12px;text-align:center;width:100%;margin:0}
@media(prefers-reduced-motion:reduce){.v6gf .stm i,.v6gf.cook .pot,.v6gf .plate .q,.v6gf .v6fsp.v6fhop.go{animation:none!important}.v6gf .plate{transition:none}}
html.hw-q-performance .v6gf .stm i:nth-child(2n){display:none}
`);

/* a stall: awning in the stall colour (torn while the village is Ruined), posts, counter and crates */
function stallSvg(s,torn){let g='<rect x="1" y="4" width="2" height="16" fill="#6b4a2b"/><rect x="21" y="4" width="2" height="16" fill="#6b4a2b"/>';
  for(let i=0;i<6;i++){const c=i%2?'#fff6e0':s.c;g+='<rect'+(torn&&(i===2||i===4)?' class="tr"':'')+' x="'+i*4+'" y="0" width="4" height="5" fill="'+c+'"/><rect x="'+(i*4+1)+'" y="5" width="2" height="1" fill="'+(torn&&i===3?'none':c)+'"/>'}
  g+='<rect x="0" y="0" width="24" height="1" fill="'+s.d+'"/><rect x="0" y="14" width="24" height="7" fill="#a8693a"/><rect x="0" y="14" width="24" height="1" fill="#c98f55"/>'
    +[3,10,17].map(x=>'<rect x="'+x+'" y="11" width="5" height="3" fill="#8a5a2b"/><rect x="'+(x+1)+'" y="10" width="3" height="1" fill="'+s.c+'"/>').join('');
  return '<svg viewBox="0 0 24 21" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true"'+(torn?' class="torn"':'')+'>'+g+'</svg>'}
// the plate: four parts (vegetables + fruit = half, grains and protein a quarter each)
const QP={veg:[30,30],fruit:[30,70],grain:[70,30],protein:[70,70]};
function plateSvg(){const q=(d,k)=>'<path data-k="'+k+'" d="'+d+'" fill="#f6f2e6" stroke="#d8cfb8" stroke-width="1.5"/>';
  return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="52" r="48" fill="#2b2418" opacity=".25"/><circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#c9c2ae" stroke-width="2"/>'
    +q('M50 50 L50 10 A40 40 0 0 0 10 50 Z','veg')+q('M50 50 L10 50 A40 40 0 0 0 50 90 Z','fruit')+q('M50 50 L90 50 A40 40 0 0 0 50 10 Z','grain')+q('M50 50 L50 90 A40 40 0 0 0 90 50 Z','protein')+'</svg>'}
function square(lv,n){let h='';
  h+=spr('bush',2,72,9)+spr('bush',98,72,8);
  if(lv>=2)h+=spr('box',40,66,7)+spr('box',98,94,7);
  if(lv>=4)h+='<div class="lit" aria-hidden="true">'+'<i></i>'.repeat(HWMotion.level()==='performance'?4:8)+'</div>';
  const folk=[[38,60,'#4a7fc6'],[94,64,'#b9a6ff'],[46,98,'#e0704a']].slice(0,Math.min(3,lv));
  h+=folk.map((p,i)=>spr('folk',p[0],p[1],3.2,'v6fhop','--vc:'+p[2]+';animation-delay:-'+(i*.2)+'s')).join('');
  if(n>=1)h+=spr('rack',10,69,8,'front');
  if(n>=2)h+='<div class="bnt" aria-hidden="true"></div>';
  if(n>=3)h+=spr('cat',30,64,5,'v6fhop');
  if(n>=4)h+=spr('herb',28,73,3.4,'front');
  return h}

HWGames.register({id:'food',name:'Market Kitchen',icon:'🍲',page:'food',area:'Nutrition',xp:10,
  blurb:'Pick foods from the market stalls and build a balanced, colourful plate.',
  note:'A game only. It does not log food, and its kcal and macros are estimates. Log what you actually eat on the Nutrition page.',
  before:['<div class="card"><h3>📋 7-DAY NUTRITION LOG</h3>'],
  finds:[['🧂','Spice rack','A rack of turmeric, lemongrass and chilli now hangs in the market kitchen.'],['🎏','Market bunting','Colourful bunting now hangs across the market square.'],['🐈','Market cat','A sleepy cat now naps by the stalls and stretches when a plate is served.'],['🪴','Herb pots','Pots of pandan and curry leaves now sit on the kitchen counter.'],['📜','Lore: the shared table','The village cooks say no single dish makes a feast. It is the mix on the table, day after day, that does.']],
  progress(){const d=D(),m=+d.m||0,t=tried().length;return m?m+(m===1?' meal':' meals')+' served · '+t+' foods tried':''},
  start(g){const lv=region(),n=finds(),S=g.stage;S.classList.add('v6gf');
    S.innerHTML=square(lv,n)+'<div class="kit" aria-hidden="true"></div>'+spr('pot',19,76,10,'pot')+'<div class="stm" aria-hidden="true"><i></i><i></i><i></i></div>'+spr('cook',7,90,4.2,'v6fhop front cookn')
      +'<div class="tbl" aria-hidden="true"></div><div class="plate" role="img" aria-label="Plate, empty">'+plateSvg()+Object.keys(QP).map(k=>'<span class="q" data-k="'+k+'" style="left:'+QP[k][0]+'%;top:'+QP[k][1]+'%"></span>').join('')+'</div><div class="cup" role="img" aria-label="Cup, empty"></div>'
      +STALLS.map((s,i)=>'<button type="button" class="v6gt stall" data-k="'+s.k+'" style="left:'+SX[i]+'%"><span class="sv">'+stallSvg(s,lv===0&&(i===1||i===3))+'</span><span class="em" aria-hidden="true">'+s.ic+'</span><span class="lb" aria-hidden="true">'+(i+1)+' '+s.n.toUpperCase()+'</span></button>').join('');
    const B=[...S.querySelectorAll('.stall')],plate=S.querySelector('.plate'),cup=S.querySelector('.cup'),cook=S.querySelector('.cookn');
    const hero=g.hero(46,62,'idle');hero.insertAdjacentHTML('beforeend','<b class="v6fcar" aria-hidden="true"></b>');
    const P={};let busy=false,open=null,opts=[];
    const parts=()=>STALLS.filter(s=>!s.opt&&P[s.k]).length;
    const label=s=>s.n+' stall'+(P[s.k]?', on the plate: '+P[s.k].name:s.opt?', optional':', not on the plate yet');
    function upd(){g.status('Plate '+parts()+' / '+NEED+(P.drink?' · drink ✓':''));
      B.forEach((b,i)=>{const s=STALLS[i];b.classList.toggle('got',!!P[s.k]);b.classList.toggle('on',open===s.k);b.setAttribute('aria-label',label(s));b.setAttribute('aria-disabled',busy?'true':'false')});
      plate.setAttribute('aria-label','Plate: '+(parts()?STALLS.filter(s=>!s.opt&&P[s.k]).map(s=>P[s.k].name).join(', '):'empty'));cup.setAttribute('aria-label','Cup: '+(P.drink?P.drink.name:'empty'))}
    const hop=()=>S.querySelectorAll('.v6fhop').forEach(e=>{e.classList.remove('go');void e.getBoundingClientRect();e.classList.add('go')});
    // controls: the stall menu (inspect + choose) or the serve button
    function controls(){const C=g.controls;C.innerHTML='';
      if(open){const s=STALLS.find(x=>x.k===open);const w=document.createElement('div');w.className='v6fch';w.setAttribute('role','group');w.setAttribute('aria-label',s.n+' stall choices');
        w.innerHTML='<h4>'+s.ic+' '+esc(s.n.toUpperCase())+' STALL · PICK ONE</h4>';C.appendChild(w);
        opts.forEach((f,i)=>{const m=mac(f),b=document.createElement('button');b.type='button';b.className='g';b.dataset.i=i;
          b.innerHTML='<span class="fe" aria-hidden="true">'+f.em+'</span><span><b>'+(i+1)+'. '+esc(f.name)+'</b><small>'+esc(f.serv)+' · '+f.k+' kcal · '+macS(m)+' <span class="tag e">EST</span></small></span>';
          b.onclick=()=>{if(g.alive())pick(i)};w.appendChild(b)});
        const bk=document.createElement('button');bk.type='button';bk.className='sm g';bk.textContent='◀ BACK TO THE SQUARE';bk.onclick=()=>{if(g.alive()){open=null;controls();upd()}};w.appendChild(bk);
        try{w.querySelector('button').focus({preventScroll:true})}catch(e){}return}
      const ready=parts()>=NEED,sv=g.button(ready?'🍽️ SERVE THE MEAL':'🍽️ SERVE THE MEAL ('+parts()+' / '+NEED+')',serve);sv.disabled=!ready||busy;
      const p=document.createElement('p');p.className='v6fhint mut';p.textContent=ready?(P.drink?'Plate ready. Serve it when you like, or swap a part.':'Plate ready. Add a drink if you like, or serve it now.'):'Tap a stall or press 1–5. Fill vegetables, fruit, grains and protein; a drink is optional.';C.appendChild(p)}
    function choose(k){if(busy)return;open=k;opts=choices(k);g.sound('tap');controls();upd()}
    function pick(i){const f=opts[i],s=STALLS.find(x=>x.k===open);if(!f||!s||busy)return;open=null;busy=true;controls();upd();
      const x=SX[STALLS.indexOf(s)],swap=!!P[s.k];hero.querySelector('.v6fcar').textContent=f.em;
      g.pose(hero,'walk');g.move(hero,x,52,650);
      g.after(g.A(670),()=>{g.pose(hero,'idle hold');g.sound('tap');g.pop(x,40,'+'+f.em);
        g.after(g.A(350),()=>{g.pose(hero,'walk hold');g.move(hero,28,86,700);
          g.after(g.A(720),()=>{g.pose(hero,'idle hold');S.classList.add('cook');g.sound('soft');
            g.after(g.A(700),()=>{S.classList.remove('cook');g.pose(hero,'walk hold');g.move(hero,s.opt?78:56,92,600);
              g.after(g.A(620),()=>{g.pose(hero,'idle');P[s.k]=f;
                if(s.opt)cup.textContent=f.em;else plate.querySelector('.q[data-k="'+s.k+'"]').textContent=f.em;
                g.burst(s.opt?cup:plate,{n:10,palette:'gold',speed:1.8,up:1,life:600});g.sound('good');hop();
                g.pop(15,66,swap?'Swapped!':s.say[Math.random()*s.say.length|0]);
                busy=false;controls();upd();if(parts()>=NEED&&!swap&&!s.opt)g.pop(66,60,'Plate ready!')})})})})})}
    function serve(){if(busy||parts()<NEED)return;busy=true;controls();upd();plate.classList.add('show');g.pose(hero,'cel');g.sound('done');hop();
      g.burst(plate,{n:24,palette:'gold',speed:2.4,up:1,life:800});g.pop(15,66,'A fine plate!');
      g.after(g.A(1100),()=>{const d=g.data(),T=tried(),items=STALLS.filter(s=>P[s.k]).map(s=>P[s.k]),nw=items.filter(f=>!T.includes(f.name));
        d.m=(+d.m||0)+1;d.t=T.concat(nw.map(f=>f.name)).slice(-300);
        const t={p:0,c:0,f:0,fb:0,k:0};items.forEach(f=>{const m=mac(f);t.p+=m.p;t.c+=m.c;t.f+=m.f;t.fb+=m.fb;t.k+=f.k});
        g.finish({icon:'🍽️',title:'A BALANCED PLATE!',result:items.length+' foods',
          lines:['On the plate: '+items.map(f=>f.em+' '+f.name).join(', ')+'.','Vegetables, fruit, grains and protein: the Healthy Plate idea of half vegetables and fruit, a quarter grains and a quarter protein.',
            'Together, about '+t.k+' kcal · '+macS(t)+'. Estimates from typical dish composition, not lab values.',
            nw.length?nw.length+(nw.length===1?' food':' foods')+' new to your plates ('+d.t.length+' tried so far). Variety is a fine spell.':'All familiar favourites. Next time a stall may offer something new.',
            'Nutrition Village: '+HWKingdom.NAMES[lv]+'. It grows with the days you log meals, never with what or how much you eat.']})})}
    B.forEach((b,i)=>b.onclick=()=>{if(g.alive())choose(STALLS[i].k)});
    g.key(e=>{if(busy)return;if(open&&/^[1-3]$/.test(e.key)){pick(+e.key-1);return true}if(!open&&/^[1-5]$/.test(e.key)){choose(STALLS[+e.key-1].k);return true}});
    controls();upd();g.pop(50,50,'Pick from the stalls!')}});

return{STALLS,menu,choices,region,finds}})();
