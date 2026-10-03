/* v6: sleep mini-game (master prompt §56–57, §68, §84–85, §97 step 19). Not part of the original.
   Night Watch (HWGames 'night'): a quiet night over the village: moon, stars, drifting clouds, rooftops,
   lanterns and fireflies. The hero keeps watch from the hill.
     observe   a star chart shows one constellation (its shape, name and a short description). Three star
               groups shine in the sky: find the one that matches (tap it, or press 1–3). A wrong group
               just dims so the sky narrows down; nothing is timed and there is no score
     memory    the atlas remembers every constellation you chart; charts favour ones not seen yet
     explore   each charted constellation draws its lines, reveals its name and lights a village lantern
   Three constellations make one watch. Its stars are a game, not a sleep measurement, and it never logs
   sleep. XP once a day through the framework; each first daily completion unlocks the next night
   discovery. The sky follows the Dream Realm state (nights with sleep logged, never the hours or the
   score): heavy clouds and dark windows while Ruined, then a clearer sky, lit windows and fireflies.
   State: st.mg.c.night = {f: discoveries, w: watches, n: [constellations charted]} (no schema step). */
const HWNight=(()=>{
const SPR={
  house:[16,14,'0,5,16,1,#1a1d2e;1,0,14,6,#3a2f4a;2,6,12,8,#2b2638;4,8,3,3,var(--wc,#1a1d2e);9,8,3,3,var(--wc2,#1a1d2e);7,11,2,3,#1a1d2e'],
  owl:[7,9,'1,0,5,8,#6b5a48;0,1,1,2,#6b5a48;6,1,1,2,#6b5a48;1,2,2,2,#fff6d0;4,2,2,2,#fff6d0;2,3,1,1,#2b2418;4,3,1,1,#2b2418;3,4,1,1,#f2c14e;2,5,3,3,#a8907a'],
  scope:[10,10,'5,0,4,2,#c9a97a;3,2,4,2,#c9a97a;2,3,2,1,#8a6a4a;4,4,1,5,#5b3a1e;2,9,6,1,#5b3a1e;3,6,1,3,#5b3a1e;6,6,1,3,#5b3a1e'],
  sheep:[10,7,'1,1,7,4,#f2f0e8;0,2,9,2,#f2f0e8;7,0,3,3,#3a3a48;8,1,1,1,#fff6d0;2,5,1,2,#3a3a48;6,5,1,2,#3a3a48'],
  lamp:[5,14,'2,3,1,11,#1a1d2e;0,0,5,1,#1a1d2e;1,1,3,3,var(--lc,#3a3550);0,4,5,1,#1a1d2e']};
const spr=(k,x,y,w,cls,style)=>{const s=SPR[k]||HWWater.SP[k];return '<svg class="v6nsp '+(cls||'')+'" viewBox="0 0 '+s[0]+' '+s[1]+'" style="left:'+x+'%;top:'+y+'%;'+(w?'width:'+w+'%;':'')+(style||'')+'" shape-rendering="crispEdges" aria-hidden="true">'
  +s[2].split(';').map(r=>{const p=r.split(',');return '<rect x="'+p[0]+'" y="'+p[1]+'" width="'+p[2]+'" height="'+p[3]+'" fill="'+p[4]+'"/>'}).join('')+'</svg>'};

/* original constellations: stars in a 10×10 box, lines between them, and a plain description
   (so the shapes can be matched by ear as well as by eye) */
const SKY=[
  {n:'The Lantern',d:'a box of four stars under a pointed top',p:[[3,4],[7,4],[7,9],[3,9],[5,1]],e:[[0,1],[1,2],[2,3],[3,0],[0,4],[4,1]],l:'Village children say it lights the way home for late travellers.'},
  {n:'The Sleeping Fox',d:'a long low curve with a tail flicking down',p:[[1,6],[3,5],[5,5],[7,6],[9,4],[8,9]],e:[[0,1],[1,2],[2,3],[3,4],[3,5]],l:'It curls up in the autumn sky and only wakes at dawn.'},
  {n:'The Kettle',d:'a wide pot with a spout and a lid',p:[[2,4],[7,4],[8,9],[1,9],[9,2],[4,2]],e:[[0,1],[1,2],[2,3],[3,0],[1,4],[0,5],[5,1]],l:'The night keepers say it is always just about to boil.'},
  {n:'The Owl\'s Eyes',d:'two small triangles side by side',p:[[1,5],[3,3],[4,6],[6,3],[8,5],[7,7]],e:[[0,1],[1,2],[2,0],[3,4],[4,5],[5,3]],l:'Two watchful triangles that keep an eye on the forest.'},
  {n:'The Little Boat',d:'a flat hull with one tall mast',p:[[1,7],[9,7],[7,9],[3,9],[5,1],[5,7]],e:[[0,1],[1,2],[2,3],[3,0],[4,5]],l:'Fisherfolk once steered home by its mast.'},
  {n:'The Crown of Leaves',d:'a zigzag of seven stars',p:[[1,7],[2,3],[4,6],[5,2],[6,6],[8,3],[9,7]],e:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]],l:'Worn by the forest in spring, they say.'},
  {n:'The Old Bridge',d:'a gentle arch of six stars',p:[[0,9],[1,5],[3,3],[7,3],[9,5],[10,9]],e:[[0,1],[1,2],[2,3],[3,4],[4,5]],l:'It joins two halves of the sky, like the bridge over Stair Mountain\'s river.'}];
const ROUNDS=3,SLOT=[[19,5],[50,2],[81,6]];
const D=()=>HWGames.data('night');
const atlas=()=>{const n=D().n;return Array.isArray(n)?n.filter(x=>SKY.some(s=>s.n===x)):[]};
const finds=()=>{try{return Math.max(0,+D().f||0)}catch(e){return 0}};
function region(){try{const r=KR.find(x=>x[0]==='dream');return r?HWKingdom.level(r):0}catch(e){return 0}}
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
/* the watch's three constellations: ones not charted yet first */
function plan(){const A=new Set(atlas());return shuffle(SKY).sort((a,b)=>(A.has(a.n)?1:0)-(A.has(b.n)?1:0)).slice(0,ROUNDS)}
function stars(c,lines){return '<svg viewBox="-1 -1 12 12" aria-hidden="true">'+c.e.map(e=>{const a=c.p[e[0]],b=c.p[e[1]];return '<line x1="'+a[0]+'" y1="'+a[1]+'" x2="'+b[0]+'" y2="'+b[1]+'"'+(lines?'':' class="v6nln"')+'/>'}).join('')
  +c.p.map((p,i)=>'<rect class="v6nst" x="'+(p[0]-.35)+'" y="'+(p[1]-.35)+'" width=".7" height=".7" style="animation-delay:-'+(i*.6)+'s"/>').join('')+'</svg>'}

HWUI.css('night',`
.v6gs.v6gn{background:linear-gradient(#0f1430,#1d2550 55%,#2a2f5a 72%)}
.v6gn .v6nsp{position:absolute;transform:translate(-50%,-100%);image-rendering:pixelated;pointer-events:none;height:auto;z-index:3}
.v6gn .v6wsp{z-index:2}
.v6gn .v6nmoon{position:absolute;left:30%;top:43%;width:6%;aspect-ratio:1;background:#fff6d0;box-shadow:0 0 0 3px #e8dca8;z-index:1}
.v6gn .v6nmoon::after{content:'';position:absolute;left:22%;top:26%;width:24%;height:24%;background:#e8dca8}
.v6gn .v6nbg{position:absolute;width:2px;height:2px;background:#fff;opacity:.6;z-index:0;animation:v6ntw 3s steps(3) infinite}
@keyframes v6ntw{50%{opacity:.15}}
.v6gn .v6nhill{position:absolute;left:-5%;right:-5%;top:68%;bottom:0;background:#1f3a34;border-radius:50% 50% 0 0/22% 22% 0 0;z-index:1}
.v6gn .v6nhill.v6nb{left:30%;top:74%;background:#1a302c}
.v6gn .v6wsp.v6ncl{z-index:4;opacity:.85}
.v6gn button.v6gt.v6nslot{width:24%;aspect-ratio:1;transform:translateX(-50%);z-index:3;border-radius:6px}
.v6gn .v6nslot svg{width:100%;height:100%;display:block;overflow:visible}
.v6gn .v6nslot .v6nst,.v6gctl .v6nchart .v6nst{fill:#fffbe0}.v6gn .v6nslot .v6nst{animation:v6ntw 3.6s steps(3) infinite}
.v6gn .v6nslot line,.v6gctl .v6nchart line{stroke:#9fd0ff;stroke-width:.22;stroke-linecap:round}
.v6gn .v6nslot line.v6nln{opacity:0}.v6gn .v6nslot.v6nok line.v6nln{opacity:1;stroke-dasharray:12;stroke-dashoffset:12;animation:v6ndraw .9s steps(6) forwards}
@keyframes v6ndraw{to{stroke-dashoffset:0}}
.v6gn .v6nslot:hover,.v6gn .v6nslot:focus-visible{background:rgba(159,208,255,.12)}
.v6gn .v6nslot.v6nno{opacity:.25;cursor:default}.v6gn .v6nslot.v6nok .v6nst{fill:#fff6a0}
.v6gn .v6nslot .v6nnm{position:absolute;left:50%;bottom:-6%;transform:translateX(-50%);font:clamp(5px,1.1vw,8px)/1.4 var(--fh);color:#fff6d0;white-space:nowrap;background:rgba(15,20,48,.8);padding:1px 4px}
.v6gn .v6nslot .v6nnum{position:absolute;left:4%;top:2%;font:clamp(5px,1.1vw,8px)/1 var(--fh);color:#9fb0d8}
.v6gn .v6nlamp.v6non{--lc:#f2c14e}.v6gn .v6nlamp.v6non+.v6nlg{opacity:1}
.v6gn .v6nlg{position:absolute;width:5%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(rgba(255,214,106,.55),transparent 70%);opacity:0;z-index:2;pointer-events:none;transition:opacity .4s steps(3)}
.v6gn .v6wff{z-index:4}
.v6gctl .v6nchart{display:flex;gap:10px;align-items:center;width:min(460px,100%);background:#141a33;color:#e8ecff;border:3px solid var(--ln);padding:8px}
.v6gctl .v6nchart svg{flex:0 0 auto;width:72px;height:72px}
.v6gctl .v6nchart b{font:8px/1.6 var(--fh);color:#fff6d0}.v6gctl .v6nchart small{display:block;font-size:12px;line-height:1.5;color:#c8d0f0}
.v6gctl .v6nhint{font-size:12px;text-align:center;width:100%;margin:0}
@media(prefers-reduced-motion:reduce){.v6gn .v6nbg,.v6gn .v6nslot .v6nst,.v6gn .v6nslot.v6nok line.v6nln{animation:none!important}.v6gn .v6nslot.v6nok line.v6nln{stroke-dashoffset:0}.v6gn .v6nlg{transition:none}}
html.hw-q-performance .v6gn .v6nbg:nth-child(2n){animation:none}
`);

const LAMP=[[30,84],[46,88],[62,86],[78,90]];
function scene(lv,n,M){let h='<div class="v6nmoon" aria-hidden="true"></div>';
  const nb=M.deco(28);for(let i=0;i<nb;i++)h+='<i class="v6nbg" style="left:'+(i*37%97+1)+'%;top:'+(i*23%60+1)+'%;animation-delay:-'+(i%7*.4)+'s" aria-hidden="true"></i>';
  h+='<div class="v6nhill" aria-hidden="true"></div><div class="v6nhill v6nb" aria-hidden="true"></div>';
  const cl=[[12,56,14],[88,58,16],[56,54,12]].slice(0,Math.max(0,3-lv));
  h+=cl.map((c,i)=>spr('cloud',c[0],c[1],c[2],'v6ncl v6wcl','--d:'+(60+i*20)+'s;animation-delay:-'+i*9+'s')).join('');
  const win=['#f2c14e','#ffd76a'];
  h+=[[36,80,12],[56,78,13],[74,82,11],[90,80,10]].map((p,i)=>spr('house',p[0],p[1],p[2],'','--wc:'+(i<lv?win[0]:'#1a1d2e')+';--wc2:'+(i+1<lv?win[1]:'#1a1d2e'))).join('');
  h+=LAMP.map((p,i)=>spr('lamp',p[0],p[1],1.6,'v6nlamp'+(lv>=4&&i===3?' v6non':''))+'<i class="v6nlg" style="left:'+p[0]+'%;top:'+(p[1]-11)+'%"></i>').join('');
  if(lv>=1)h+=spr('tree',20,78,6)+spr('tree',96,74,5);
  if(lv>=3)for(let i=0;i<M.deco(4);i++)h+='<i class="v6wff" style="left:'+(24+i*19)+'%;top:'+(70+i*7%12)+'%;animation-delay:-'+i*.8+'s" aria-hidden="true"></i>';
  if(lv>=4)h+=[[22,96],[52,97],[84,98]].map(p=>spr('flower',p[0],p[1],2,'','--pc:#ffffff')).join('');
  if(n>=1)h+=spr('owl',56,66,2.6);
  if(n>=2)h+=spr('scope',18,92,4);
  if(n>=3)h+=[[8,98],[26,99],[14,99]].map(p=>spr('flower',p[0],p[1],2,'','--pc:#e8ecff')).join('');
  if(n>=4)h+=spr('sheep',40,98,5)+spr('sheep',68,99,4.4);
  return h}

HWGames.register({id:'night',name:'Night Watch',icon:'🌙',page:'sleep',area:'Recovery',xp:10,
  blurb:'Keep a quiet watch over the village and find three constellations from the star chart.',
  note:'A game only. Its stars are not a sleep measurement and it does not log sleep. Near bedtime, a short, quiet play and a dim screen are kindest.',
  before:['<div class="card"><h3>📜 SLEEP HISTORY</h3>'],
  finds:[['🦉','Night owl','A night owl now keeps watch from the village rooftops.'],['🔭','Star telescope','A little brass telescope now stands on the hill.'],['🌼','Moon garden','Pale flowers that open at night now grow along the path.'],['🐑','Woolly sheep','Two sleepy sheep now doze in the field below the village.'],['📜','Lore: the night keepers','The night keepers never chase the stars. They say the sky is easiest to read when you are calm, and the best watch ends in bed.']],
  progress(){const a=atlas().length;return a?a+' / '+SKY.length+' constellations charted':''},
  start(g){const lv=region(),n=finds(),S=g.stage;S.classList.add('v6gn');
    S.innerHTML=scene(lv,n,g)+'<div class="v6nsky"></div>';
    const sky=S.querySelector('.v6nsky'),hero=g.hero(10,88,'calm');
    const P=plan(),got=[],seen=new Set(atlas());let r=0,busy=false,order=[],no=new Set(),looks=0;
    function round(){const c=P[r];order=shuffle([c,...shuffle(SKY.filter(x=>x!==c)).slice(0,2)]);no=new Set();
      sky.innerHTML=order.map((x,i)=>'<button type="button" class="v6gt v6nslot" data-i="'+i+'" style="left:'+SLOT[i][0]+'%;top:'+SLOT[i][1]+'%"><span class="v6nnum" aria-hidden="true">'+(i+1)+'</span>'+stars(x)+'</button>').join('');
      sky.querySelectorAll('.v6nslot').forEach(b=>b.onclick=()=>{if(g.alive())pick(+b.dataset.i)});
      const C=g.controls;C.innerHTML='<div class="v6nchart" role="img" aria-label="Star chart: '+esc(c.n)+', '+esc(c.d)+'">'+stars(c,1)+'<div><b>STAR CHART · '+(r+1)+' / '+ROUNDS+'</b><br><b>'+esc(c.n.toUpperCase())+'</b><small>'+esc(c.d)+'</small></div></div>';
      const p=document.createElement('p');p.className='v6nhint mut';p.textContent='Find this shape among the three star groups in the sky: tap it or press 1–3. Take your time.';C.appendChild(p);upd()}
    function upd(){sky.querySelectorAll('.v6nslot').forEach((b,i)=>{const x=order[i],ok=b.classList.contains('v6nok');b.setAttribute('aria-label','Star group '+(i+1)+': '+x.d+(ok?', '+x.n:no.has(i)?', not this one':''));b.setAttribute('aria-disabled',busy||no.has(i)?'true':'false')});
      g.status(r<ROUNDS?'Constellation '+(r+1)+' / '+ROUNDS+' · find '+P[r].n:'Watch complete')}
    function pick(i){const c=P[r],x=order[i],b=sky.querySelector('.v6nslot[data-i="'+i+'"]');if(busy||!x||no.has(i))return;
      if(x!==c){looks++;no.add(i);b.classList.add('v6nno');g.sound('soft');g.pop(SLOT[i][0],SLOT[i][1]+30,'Not this one. Look again.');upd();return}
      busy=true;b.classList.add('v6nok');b.insertAdjacentHTML('beforeend','<span class="v6nnm" aria-hidden="true">'+esc(c.n)+'</span>');sky.querySelectorAll('.v6nslot').forEach(o=>{if(o!==b)o.classList.add('v6nno')});
      got.push(c);g.sound('good');g.burst(b,{n:12,palette:'magic',speed:1.6,up:1,life:700});
      const L=S.querySelectorAll('.v6nlamp')[r];if(L)L.classList.add('v6non');g.pose(hero,'cel');g.after(g.A(700),()=>g.pose(hero,'calm'));
      g.pop(SLOT[i][0],SLOT[i][1]+34,seen.has(c.n)?'An old friend!':'New in the atlas!');upd();
      g.after(g.A(1500),()=>{r++;busy=false;if(r<ROUNDS)round();else done()})}
    function done(){upd();g.controls.innerHTML='';const L=S.querySelectorAll('.v6nlamp');if(L[3])L[3].classList.add('v6non');g.pose(hero,'cel');g.sound('done');
      g.after(g.A(900),()=>{const d=g.data(),nw=got.filter(c=>!seen.has(c.n)),A=atlas().concat(nw.map(c=>c.n));d.n=A;d.w=(+d.w||0)+1;
        g.finish({icon:'✨',title:'A PEACEFUL WATCH',result:got.length+' constellations',palette:'magic',
          lines:['Charted tonight: '+got.map(c=>c.n).join(', ')+'.',got[got.length-1].n+': '+got[got.length-1].l,
            A.length>=SKY.length?'Your star atlas is complete: all '+SKY.length+' constellations. The sky is still lovely to watch.':'Star atlas: '+A.length+' of '+SKY.length+' constellations'+(nw.length?' ('+nw.length+' new tonight).':'.'),
            'Dream Realm: '+HWKingdom.NAMES[lv]+'. It grows with the nights you log sleep, never with the hours or the score.']})})}
    g.key(e=>{if(busy||r>=ROUNDS)return;if(/^[1-3]$/.test(e.key)){pick(+e.key-1);return true}});
    round()}});

return{SKY,plan,atlas,region,finds}})();
