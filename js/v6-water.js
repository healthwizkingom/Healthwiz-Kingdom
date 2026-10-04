/* v6: water mini-game and well scene (master prompt §48–49, §68, §85, §97 step 15). Not part of the original.
   1. The Water page's original Well of Life scene (#wq) and its log animation (walk → fill → carry →
      pour → splash → flood) are unchanged. On top of them:
        scenery     the scene follows the original six well stages (water tracking days, never the amount
                    in one day): dry cracks → sprouts → trees and moss → fireflies → deer and a rabbit → flowers
        well        cracked stones at first, moss and vines later, a flower ring once restored
        ripples     rings spread across the well and water droplets jump when the bucket is poured
        reaction    plants and animals hop when the well is filled; discoveries from the game appear here too
        sky         two slow clouds
   2. Well Garden (HWGames 'water'): a top-down garden. Tap a dry patch and the hero walks to the well,
      fills the bucket, carries it over and pours. Water all five patches and the garden blooms.
      No timer, no score, no health data. XP once a day through the framework; each first daily
      completion unlocks the next garden discovery (frog, planter, butterflies, lantern, lore).
   Everything still is static under reduced motion; Performance mode stops the looping ambient bits. */
const HWWater=(()=>{
/* ---------- pixel sprites: "x,y,w,h,colour;…" in sprite pixels ---------- */
const SP={
  sprout:[5,5,'2,2,1,3,#3f9f4a;0,1,2,1,#5cc05a;3,0,2,1,#5cc05a;1,2,1,1,#5cc05a;3,1,1,1,#5cc05a'],
  tree:[12,16,'5,10,2,6,#5b3a1e;2,2,8,6,#2f8a3a;0,5,12,4,#2f8a3a;1,8,10,2,#2a7a34;4,0,4,2,#3f9f4a;3,3,3,2,#5cc05a;8,6,2,1,#5cc05a'],
  dead:[10,12,'4,4,2,8,#5b3a1e;1,3,3,1,#5b3a1e;6,1,1,4,#5b3a1e;7,1,2,1,#5b3a1e;0,2,1,1,#5b3a1e;3,11,4,1,#4a2f18'],
  flower:[5,6,'2,3,1,3,#3f9f4a;1,0,3,3,var(--pc,#ff9be0);0,1,5,1,var(--pc,#ff9be0);2,1,1,1,#f2c14e;3,4,2,1,#5cc05a'],
  deer:[14,12,'2,3,8,4,#a8693a;9,1,3,3,#a8693a;12,2,2,1,#2b2418;10,1,1,1,#2b2418;8,0,1,2,#6b4a2b;11,0,1,2,#6b4a2b;2,7,1,5,#7a4a26;4,7,1,5,#7a4a26;7,7,1,5,#7a4a26;9,7,1,5,#7a4a26;3,4,2,1,#f1d9b0;1,3,1,1,#f1d9b0'],
  rabbit:[7,7,'1,3,4,3,#e9e3d6;4,2,2,2,#e9e3d6;4,0,1,2,#e9e3d6;5,0,1,2,#d8cfc0;5,3,1,1,#2b2418;0,4,1,1,#ffffff;1,6,1,1,#bdb3a2;4,6,1,1,#bdb3a2'],
  frog:[7,5,'1,1,5,3,#4cae4c;0,3,7,2,#3f9f4a;1,0,2,2,#4cae4c;4,0,2,2,#4cae4c;1,0,1,1,#2b2418;5,0,1,1,#2b2418;2,3,3,1,#cfe8a0'],
  planter:[11,9,'0,4,11,5,#8a5a2b;0,4,11,1,#a8693a;1,0,2,4,#3f9f4a;4,1,2,3,#5cc05a;7,0,2,4,#2f8a3a;5,0,1,1,#e0f0c0;9,2,1,2,#5cc05a;2,6,2,1,#6b4a2b;7,6,2,1,#6b4a2b'],
  lantern:[5,14,'2,3,1,11,#3a3a48;0,0,5,1,#3a3a48;1,1,3,3,#f2c14e;1,1,3,1,#fff2a8;0,4,5,1,#3a3a48;1,13,3,1,#3a3a48'],
  fly:[5,4,'0,0,2,2,#ff9be0;3,0,2,2,#ff9be0;0,2,2,1,#f2a6e8;3,2,2,1,#f2a6e8;2,0,1,4,#2b2418'],
  cloud:[16,6,'3,1,10,4,#ffffff;5,0,6,1,#ffffff;1,3,14,3,#ffffff;0,4,16,2,#eef6ff'],
  bush:[10,6,'1,1,8,5,#2f8a3a;0,3,10,3,#2a7a34;2,0,3,2,#3f9f4a;6,0,2,1,#3f9f4a;3,2,2,1,#5cc05a']};
function spr(k,x,y,w,cls,style){const s=SP[k];return '<svg class="v6wsp '+(cls||'')+'" viewBox="0 0 '+s[0]+' '+s[1]+'" style="left:'+x+'%;top:'+y+'%;'+(w?'width:'+w+'px;':'')+(style||'')+'" shape-rendering="crispEdges" aria-hidden="true">'
  +s[2].split(';').map(r=>{const p=r.split(',');return '<rect x="'+p[0]+'" y="'+p[1]+'" width="'+p[2]+'" height="'+p[3]+'" fill="'+p[4]+'"/>'}).join('')+'</svg>'}
const fly=(x,y,d)=>'<i class="v6wff" style="left:'+x+'%;top:'+y+'%;animation-delay:-'+d+'s"></i>';
const PC=['#ff9be0','#f2c14e','#ffffff','#e0483f','#b9a6ff'];

/* the original well stage (pages.water): tracking days, never intake */
const STAGE=['Old Well','First Sprouts','Green Trees','Fireflies','Animals Return','Village Restored'];
function stage(){const wd=wdays();return wd>=21?5:wd>=14?4:wd>=9?3:wd>=5?2:wd>=2?1:0}
const finds=()=>{try{return Math.max(0,+HWGames.data('water').f||0)}catch(e){return 0}};

HWUI.css('water',`
.v6wsp{position:absolute;transform:translate(-50%,-100%);image-rendering:pixelated;pointer-events:none;overflow:visible;height:auto}
.v6wqd,.v6wqr{position:absolute;inset:0;pointer-events:none}.v6wqd{z-index:1}
.wq .wqp,.wq .wqwell,.wq .wqd{z-index:2}.wq .v6wqr{z-index:3}
.v6wqr .rim{position:absolute;right:9%;top:12%;width:46%;max-width:300px;aspect-ratio:1}
.v6wqr svg{width:100%;height:100%;display:block;overflow:visible}
.v6wcl{animation:v6wcl var(--d,70s) linear infinite}@keyframes v6wcl{from{margin-left:-8%}to{margin-left:8%}}
.v6wff{position:absolute;width:4px;height:4px;background:#fff6a0;box-shadow:0 0 4px #fff6a0;animation:v6wff 3.2s steps(8) infinite;pointer-events:none}
@keyframes v6wff{0%,100%{opacity:.2;transform:translate(0,0)}50%{opacity:1;transform:translate(6px,-5px)}}
.v6wfl{animation:v6wfl 2.4s steps(4) infinite alternate}@keyframes v6wfl{to{margin-top:-6px;margin-left:5px}}
.v6wsw{transform-origin:50% 100%;animation:v6wsw 3.6s steps(4) infinite alternate}@keyframes v6wsw{from{transform:translate(-50%,-100%) rotate(-2deg)}to{transform:translate(-50%,-100%) rotate(2deg)}}
.v6wqd.go .v6whop,.v6gw .v6whop.go{animation:v6whop .5s steps(3) 2}@keyframes v6whop{50%{margin-top:-7px}}
.v6wrip{fill:none;stroke:#dff4ff;stroke-width:3;opacity:0;transform-origin:100px 100px;animation:v6wrip 1.3s steps(9) forwards}
@keyframes v6wrip{0%{opacity:.95;transform:scale(.15)}100%{opacity:0;transform:scale(1)}}
.v6gs.v6gw{background:#5c9e4a repeating-conic-gradient(#62a650 0 25%,#5c9e4a 0 50%) 0 0/24px 24px}
.v6gw .well{position:absolute;left:20%;top:44%;width:25%;aspect-ratio:1;transform:translate(-50%,-50%);z-index:2}
.v6gw .well svg{width:100%;height:100%;display:block;overflow:visible}
.v6gw .lane{position:absolute;inset:0;width:100%;height:100%;z-index:0}
.v6gw .v6wsp{z-index:1}.v6gw .v6wsp.front{z-index:5}
.v6gw button.v6gt.pt{width:15%;aspect-ratio:1;transform:translate(-50%,-50%);z-index:3}
.v6gw .pt .soil{position:absolute;inset:8%;background:#c9a96a;border:3px solid #6b4a2b;box-shadow:inset 0 0 0 3px #b8955a;background-image:linear-gradient(115deg,transparent 47%,#9c7d48 47% 50%,transparent 50%),linear-gradient(20deg,transparent 62%,#9c7d48 62% 65%,transparent 65%)}
.v6gw .pt.wet .soil{background:#6b4a2b repeating-linear-gradient(#6b4a2b 0 6px,#5a3d22 6px 9px);box-shadow:inset 0 0 0 3px #4a3018}
.v6gw .pt .pl{position:absolute;left:50%;top:62%;width:58%;transform:translate(-50%,-50%);display:flex;justify-content:center;gap:4%}
.v6gw .pt .pl svg{width:30%;height:auto;image-rendering:pixelated}
.v6gw .pt.bloom .pl svg{width:34%}
.v6gw .pt .n{position:absolute;left:4px;top:2px;font:8px/1 var(--fh);color:#fff;text-shadow:1px 1px 0 #2b2418}
.v6gw .pt.next .soil{outline:3px dashed #fff6a0;outline-offset:2px}
@media(prefers-reduced-motion:reduce){.v6wcl,.v6wff,.v6wfl,.v6wsw,.v6wqd.go .v6whop,.v6gw .v6whop.go{animation:none!important}.v6wrip{display:none}}
html.hw-q-performance .v6wcl,html.hw-q-performance .v6wsw,html.hw-q-performance .v6wfl{animation:none!important}html.hw-q-performance .v6wff:nth-of-type(2n){display:none}
`);

/* ---------- 1. the Water page scene ---------- */
function scenery(lv,n){let h=spr('cloud',8,12,64,'v6wcl','--d:80s')+spr('cloud',36,24,44,'v6wcl','--d:110s;animation-direction:reverse');
  if(lv===0)h+=spr('dead',40,41,34)+'<svg class="v6wsp" viewBox="0 0 40 10" style="left:44%;top:94%;width:120px" aria-hidden="true"><path d="M2 6 l6 -3 l5 4 l7 -4 M24 5 l5 3 l6 -4" stroke="#6e8f4a" stroke-width="1.4" fill="none"/></svg>';
  if(lv>=1)h+=[[34,53],[40,90],[50,96],[28,94]].map(p=>spr('sprout',p[0],p[1],18,'v6whop')).join('');
  if(lv>=2)h+=spr('tree',6,42,46,'v6wsw')+spr('tree',22,41,38,'v6wsw','animation-delay:-1.4s')+spr('bush',46,43,40)+spr('bush',36,99,40);
  if(lv>=3)h+=[[30,46,0],[44,50,1.1],[12,52,2],[52,82,.6],[24,62,1.7],[38,78,2.6]].slice(0,Math.max(3,HWMotion.count(6)||0)).map(p=>fly(p[0],p[1],p[2])).join('');
  if(lv>=4)h+=spr('deer',44,58,52,'v6whop')+spr('rabbit',48,99,24,'v6whop');
  if(lv>=5)h+=[[12,99],[31,99],[40,56],[53,90],[26,52],[44,94]].map((p,i)=>spr('flower',p[0],p[1],15,'v6whop','--pc:'+PC[i%5])).join('');
  if(n>=1)h+=spr('frog',14,76,26,'v6whop');
  if(n>=2)h+=spr('planter',33,99,40);
  if(n>=3)h+=spr('fly',38,40,18,'v6wfl')+spr('fly',30,70,14,'v6wfl','animation-delay:-1.2s');
  if(n>=4)h+=spr('lantern',33,76,18);
  return '<div class="v6wqd" aria-hidden="true" data-stage="'+lv+'">'+h+'</div>'}
// stones of the well: cracked when old, moss from Green Trees, a flower ring once restored
function rim(lv){let g='';
  if(lv<=1)g+='<path d="M28 52 l12 10 l-4 9 M160 40 l-10 14 l6 6 M170 150 l-12 -6 l-4 10 M40 158 l10 -4" stroke="#5f5747" stroke-width="3" fill="none"/>';
  if(lv>=2)g+=[[30,62],[166,58],[150,170],[44,150],[100,6]].map(p=>'<rect x="'+(p[0]-8)+'" y="'+(p[1]-4)+'" width="16" height="8" fill="#4f8f3a"/><rect x="'+(p[0]-4)+'" y="'+(p[1]-8)+'" width="8" height="4" fill="#5cc05a"/>').join('');
  if(lv>=5)for(let i=0;i<12;i++){const a=i/12*6.283,x=100+Math.cos(a)*99,y=100+Math.sin(a)*99;g+='<rect x="'+(x-4).toFixed(1)+'" y="'+(y-4).toFixed(1)+'" width="8" height="8" fill="'+PC[i%5]+'"/><rect x="'+(x-1.5).toFixed(1)+'" y="'+(y-1.5).toFixed(1)+'" width="3" height="3" fill="#f2c14e"/>'}
  return '<div class="v6wqr" aria-hidden="true"><div class="rim"><svg viewBox="0 0 200 200">'+g+'<g class="rp"></g></svg></div></div>'}
{const p=pages.water;pages.water=(...a)=>{const h=p(...a),k='<div class="wqch" id="wqch">',i=h.indexOf(k);if(i<0)return h;
  try{const lv=stage();return h.slice(0,i)+scenery(lv,finds())+rim(lv)+h.slice(i)}catch(e){console.error('[HWWater] scenery failed:',e);return h}}}

function ripple(svg,n){if(!svg||HWMotion.reduced())return;for(let i=0;i<(n||3);i++){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('class','v6wrip');c.setAttribute('cx',100);c.setAttribute('cy',100);c.setAttribute('r',58);c.style.animationDelay=i*.28+'s';svg.appendChild(c);setTimeout(()=>c.remove(),1400+i*300)}}
const at=(el,o)=>{if(!el)return 0;const r=el.getBoundingClientRect();return HWFX.burst(r.left+r.width/2,r.top+r.height*(o&&o.dy||.5),o)};
// the original pour (splashAt at the well, 40% down) and bucket fill (at the spring) get ripples, droplets and a reaction
{const s=splashAt;splashAt=function(l,t){const r=s.apply(this,arguments);try{const W=$('#wq');if(W){
  if(t==='40%'){ripple(W.querySelector('.v6wqr .rp'),3);at(W.querySelector('.wqwell'),{n:18,palette:'water',speed:2.6,up:1,gravity:.14,life:800});
    const d=W.querySelector('.v6wqd');if(d){d.classList.remove('go');void d.offsetWidth;d.classList.add('go')}}
  else at(W.querySelector('.wqp'),{n:8,palette:'water',speed:1.8,up:1,life:600})}}catch(e){}return r}}

/* ---------- 2. Well Garden mini-game ---------- */
const N=5,PT=[[47,26],[73,20],[57,60],[85,56],[40,84]];
const plant=st=>st==='bloom'?[0,1,2].map(i=>spr('flower',0,0,0,'','position:static;transform:none;--pc:'+PC[(i*2)%5])).join(''):st==='sprout'?spr('sprout',0,0,0,'','position:static;transform:none')+spr('sprout',0,0,0,'','position:static;transform:none'):'';
function wellSvg(){return '<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="97" fill="#cfc4a5"/><circle cx="100" cy="100" r="92" fill="none" stroke="#a99e82" stroke-width="9" stroke-dasharray="13 7"/><circle cx="100" cy="100" r="80" fill="#7d7462"/><circle cx="100" cy="100" r="63" fill="#16222e"/><circle cx="100" cy="100" r="56" fill="#1c5e96"/><circle cx="100" cy="100" r="44" fill="#2f8fd0"/><path class="wv1" d="M60 100 q10 -8 20 0 t20 0 t20 0 t20 0" stroke="#8fd4ff" stroke-width="5" fill="none"/><g class="rp"></g></svg>'}
function garden(g,lv,n){let h='<svg class="lane" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">'+PT.map(p=>'<path d="M24 50 Q'+((24+p[0])/2)+' '+(p[1]+8)+' '+p[0]+' '+(p[1]+9)+'" stroke="#c9a96a" stroke-width="3.2" fill="none" stroke-linecap="square"/>').join('')+'</svg>';
  h+=spr('bush',4,12,54)+spr('bush',94,98,50)+spr('bush',62,99,40);
  if(lv===0)h+=spr('dead',95,30,30);
  if(lv>=1)h+=[[30,20],[66,40],[24,92],[94,78]].map(p=>spr('sprout',p[0],p[1],16)).join('');
  if(lv>=2)h+=spr('tree',6,40,50,'v6wsw')+spr('tree',95,26,46,'v6wsw','animation-delay:-2s')+spr('tree',28,104,44,'v6wsw front','animation-delay:-1s');
  if(lv>=3)h+=[[60,36,0],[88,40,1],[34,62,2],[70,82,.5],[14,74,1.6]].slice(0,Math.max(3,HWMotion.count(5)||0)).map(p=>fly(p[0],p[1],p[2])).join('');
  if(lv>=4)h+=spr('deer',66,99,50,'v6whop')+spr('rabbit',10,96,24,'v6whop');
  if(lv>=5)h+=[[34,40],[62,8],[90,90],[52,98],[16,26]].map((p,i)=>spr('flower',p[0],p[1],14,'','--pc:'+PC[i%5])).join('');
  if(n>=1)h+=spr('frog',29,36,22,'v6whop front');
  if(n>=2)h+=spr('planter',14,64,36);
  if(n>=3)h+=spr('fly',64,30,16,'v6wfl front')+spr('fly',80,72,13,'v6wfl front','animation-delay:-1s');
  if(n>=4)h+=spr('lantern',7,72,16);
  return h}
HWGames.register({id:'water',name:'Well Garden',icon:'🪣',page:'water',area:'Water',xp:10,
  blurb:'Carry water from the well to the garden patches until they bloom.',
  note:'A game only. It does not log water or count as drinking; log what you actually drink on the Water page.',
  before:['<div class="card"><h3>🌱 WORLD PROGRESSION</h3>'],
  finds:[['🐸','Well frog','A small frog now sits by the Well Garden and hops when the garden is watered.'],['🪴','Herb planter','A planter of mint and basil now stands near the well.'],['🦋','Garden butterflies','Butterflies now visit the Well Garden and the Water Valley.'],['🏮','Path lantern','A lantern now lights the path to the well at dusk.'],['📜','Lore: the shared well','The valley folk say the well was dug by many hands, one bucket at a time. No single day filled it; the steady days did.']],
  progress(){const b=+HWGames.data('water').b||0;return b?b+(b===1?' garden':' gardens')+' bloomed':''},
  start(g){const lv=stage(),n=finds(),S=g.stage;S.classList.add('v6gw');
    S.innerHTML=garden(g,lv,n)+'<div class="well">'+wellSvg()+'</div>'
      +PT.map((p,i)=>'<button type="button" class="v6gt pt" data-i="'+i+'" style="left:'+p[0]+'%;top:'+p[1]+'%" aria-label="Garden patch '+(i+1)+', dry"><i class="soil"></i><span class="pl"></span><span class="n" aria-hidden="true">'+(i+1)+'</span></button>').join('');
    const P=[...S.querySelectorAll('.pt')],well=S.querySelector('.well'),rp=S.querySelector('.well .rp'),hero=g.hero(34,58,'idle');
    const done=new Set(),took=new Set(),Q=[];let busy=false,trips=0;
    const upd=()=>{g.status('Watered '+done.size+' / '+N);const nx=P.find((b,i)=>!took.has(i));P.forEach(b=>b.classList.toggle('next',b===nx&&!busy))};
    const hop=()=>S.querySelectorAll('.v6whop').forEach(e=>{e.classList.remove('go');void e.getBoundingClientRect();e.classList.add('go')});
    function ask(i){if(took.has(i))return;took.add(i);Q.push(i);P[i].setAttribute('aria-label','Garden patch '+(i+1)+', water on the way');g.sound('tap');if(!busy)run();upd()}
    function run(){const i=Q.shift();if(i==null){busy=false;upd();return}busy=true;upd();const p=PT[i],tx=p[0]+(p[0]<60?-10:-9),ty=Math.min(96,p[1]+11);
      g.pose(hero,'walk');g.move(hero,31,50,600);
      g.after(g.A(620),()=>{g.pose(hero,'carry');g.sound('splash');ripple(rp,2);g.burst(well,{n:8,palette:'water',speed:1.6,up:1,life:600});
        g.after(g.A(450),()=>{trips++;g.pose(hero,'walk full');g.move(hero,tx,ty,700);
          g.after(g.A(720),()=>{g.pose(hero,'full');const b=P[i];b.classList.add('wet');g.burst(b,{n:14,palette:'water',speed:2.2,up:1,gravity:.16,life:700});g.sound('good');
            g.after(g.A(300),()=>{g.pose(hero,'idle');b.querySelector('.pl').innerHTML=plant('sprout');
              g.after(g.A(500),()=>{b.classList.add('bloom');b.querySelector('.pl').innerHTML=plant('bloom');b.setAttribute('aria-label','Garden patch '+(i+1)+', in bloom');done.add(i);
                g.pop(p[0],p[1]-8,'🌸 bloom!');g.burst(b,{n:10,palette:'leaf',speed:1.8,up:1,life:700});hop();
                if(done.size>=N){busy=false;upd();g.pose(hero,'cel');g.sound('done');g.after(g.A(1000),()=>{const D=g.data();D.b=(+D.b||0)+1;
                  g.finish({icon:'🌸',title:'THE GARDEN BLOOMS!',palette:'leaf',result:trips+' trips',lines:['All '+N+' patches watered in '+trips+' bucket trips.','Water Valley well: '+STAGE[lv]+'. It grows with the days you track water, not with how much you drink.']})})}
                else run()})})})})})}
    P.forEach((b,i)=>b.onclick=()=>{if(g.alive())ask(i)});
    g.key(e=>{if(/^[1-5]$/.test(e.key)){ask(+e.key-1);return true}});
    g.button('💧 WATER THE NEXT PATCH',()=>{const i=P.findIndex((b,j)=>!took.has(j));if(i>=0)ask(i)});
    g.pop(30,34,'Tap a dry patch!');upd()}});

/* §72 smart water reminder (found in the recheck): the original timer (wqRemind) only started when SAVE REMINDER was
   tapped, so it never ran again after a reload, and it fired at any hour, even right after a drink or with the goal met.
   It now starts on load, stays silent during quiet hours (st.s.qh = [fromHour, toHour], default 22–7, [0,0] = none;
   optional, no schema step) and skips a reminder when water was logged within the interval or today's goal is reached. */
const QHS=[[[22,7],'22:00–07:00'],[[23,8],'23:00–08:00'],[[21,6],'21:00–06:00'],[[0,0],'None']];
const qh=()=>{const q=st.s.qh;return Array.isArray(q)&&q.length===2&&q.every(h=>Number.isInteger(h)&&h>=0&&h<24)?q:[22,7]};
const quiet=(h=new Date().getHours())=>{const[a,b]=qh();return a===b?false:a<b?h>=a&&h<b:h>=a||h<b};
function due(m){if(quiet())return false;const d=today();if(wt(d)>=st.s.water)return false;
  const t=st.e.reduce((x,e)=>e.c==='water'&&e.d===d&&e.t>x?e.t:x,'');if(!/^\d\d:\d\d$/.test(t))return true;
  const n=new Date();return n.getHours()*60+n.getMinutes()-(+t.slice(0,2)*60+ +t.slice(3))>=m}
wqRemind=function(){clearTimeout(S.wrT);const m=st.s.wrem||0;if(!m)return;
  S.wrT=setTimeout(()=>{if(due(m))toast('💧 THE WELL NEEDS YOU! Time for a hydration check? <button class="sm" data-a="go" data-v="water">LOG WATER</button>');wqRemind()},m*60000)};
{const p=pages.water;pages.water=(...a)=>{const h=p(...a),k='<button data-a="wrems">',i=h.indexOf(k);if(i<0)return h;const q=qh().join();
  return h.slice(0,i)+'<div class="row"><label>Quiet hours<select id="wqh">'+QHS.map(o=>'<option value="'+o[0]+'"'+(o[0].join()===q?' selected':'')+'>'+o[1]+'</option>').join('')+'</select></label></div>'
    +'<p class="mut" id="v6wqh">No reminder during quiet hours, within the interval after you log water, or once today\'s goal is reached.</p>'+h.slice(i)}}
{const o=acts.wrems;acts.wrems=function(){const s=$('#wqh');if(s){const v=s.value.split(',').map(Number);if(v.length===2&&v.every(h=>Number.isInteger(h)&&h>=0&&h<24))st.s.qh=v}return o.apply(this,arguments)}}
wqRemind();

return{stage,finds,scenery,rim,SP,remindDue:due,quiet}})();
