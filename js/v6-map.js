/* v6: the Kingdom map redrawn as a detailed, living pixel-art map. Not part of the original.
   The original map (kmap in js/hw-04-part.js) drew a flat SVG backdrop under the 8 region buttons. The regions, their
   places on the map, names, buttons (.kn, with their state classes and labels), paths and restore rules (klv, and the
   Flourishing tier in js/v6-kingdom.js) are unchanged. What changes is the land under them:
   * one painting of the kingdom on a small canvas (200 × 224 pixels, 2 per map unit, scaled with
     image-rendering: pixelated), drawn once by code and kept for the session: an organic coastline with beaches and
     shallows, terrain shaded by height, the river from Stair Mountain to the lake in Water Valley and on to the sea,
     winding roads between the regions (with bridges), tree clusters (pines in the Mind Forest, violet dream trees,
     burnt trees by the Forge), fields round Nutrition Village, and a small landmark per region: the moon shrine, the
     mountain stair, the forge under its volcano, the stone circle, Heartstone Hall, the dock, the cottages, the Balance
     Tower; and the Shadow Keep on its crag in the south-east sea, its storm weaker as more regions are restored.
   * restored regions are in full colour; unrestored ones (Ruined) are desaturated under drifting fog. When a region is
     restored, the next time the map is shown it bursts into colour with a sweep of sparkles.
   * a few moving things, CSS transform/opacity only: trees swaying (two pre-drawn frames), glints on the water, cloud
     shadows drifting over the land, chimney smoke, two birds, fog wisps, the keep's storm. They pause off screen and
     in a hidden tab (js/v6-motion.js), and stop for reduced motion. A tint follows the real time of day (dawn, day,
     dusk, night with lit windows).
   * tapping a region zooms and pans the map to it, outlines it, then opens its detail card (js/v6-kingdom.js) with
     ENTER; closing the card zooms back out. The villagers, sparkles and fog value of js/v6-world.js stay in the map. */
const HWMap=(()=>{
const D=document,W=200,H=224,U=2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,mix=(a,b,t)=>a+(b-a)*t;
const h2=(x,y)=>{let n=Math.imul(x|0,374761393)+Math.imul(y|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295};
function vn(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=h2(xi,yi),b=h2(xi+1,yi),c=h2(xi,yi+1),d=h2(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
const fbm=(x,y)=>vn(x,y)*.5+vn(x*2.03+5.2,y*2.03+1.3)*.3+vn(x*4.1+9.7,y*4.1+3.1)*.2;
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],dz=(x,y)=>(BAY[(y&3)*4+(x&3)]+.5)/16;
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
const P=o=>{const r={};for(const k in o)r[k]=o[k].map(hex);return r};
const C=P({grass:['#33692f','#3f7a3a','#4f8f44','#62a552','#7cbd64'],warm:['#3d6a2c','#4c7f36','#5e9442','#74a94e','#90c062'],
  dream:['#2e2860','#3a3270','#4a4088','#5b52a0','#7068b8'],forest:['#22482a','#2a5630','#336536','#3f763e','#4f8a48'],
  forge:['#3a2a28','#4a3430','#5c4038','#704c40','#86604c'],rock:['#4a4c5a','#5f6270','#787c8c','#9498a8','#b4b8c6'],snow:['#c7d0de','#dfe6f0','#f4f8ff'],
  sand:['#b49a64','#c8b07a','#dcc48c','#ead6a0'],deep:['#1f4f86','#2a6aa8','#3480bc'],shallow:['#4a9ccc','#5fb0d8','#78c4e6'],foam:['#d8f0ff'],
  wheat:['#b8903c','#d0a84c','#e2c46a'],crop:['#4f8a34','#62a040','#7ab44e'],soil:['#6e5030','#8a6a3a'],road:['#7a5c36','#b8945c','#d2b47a'],
  lava:['#c8401e','#ff8a3b','#ffcf5a'],ink:['#1b1626']});
const RGB=k=>C[k];
// where the regions are (KR: [key, icon, name, level key, page, x, y] in map units, 100 × 112)
const REG=()=>KR.map(r=>({k:r[0],x:r[5],y:r[6]}));
const BIOME={dream:'dream',stair:'grass',forge:'forge',mind:'forest',heart:'warm',water:'grass',food:'warm',bal:'grass'};

/* ---------- the land ---------- */
const coast=(x,y)=>Math.pow(Math.abs(x-50)/55,4)+Math.pow(Math.abs(y-56)/62,4)+(fbm(x*.09,y*.09)-.5)*.5; // < 1 is land
const mount=(x,y)=>Math.max(0,1-((x-60)/22)**2-((y-8)/13)**2,1-((x-45)/12)**2-((y-13)/9)**2,1-((x-75)/11)**2-((y-9)/10)**2);
const volc=(x,y)=>Math.max(0,1-Math.hypot(x-91,y-23)/11);
const lake=(x,y)=>((x-84)/14.5)**2+((y-76)/8.5)**2+(fbm(x*.25,y*.25)-.5)*.6<1;
const RIVER=[[63,21],[64,27],[67,33],[71,40],[73,47],[75,54],[78,61],[80,68]],OUT=[[97,78],[99,80],[101,81]];
// roads follow the original paths between regions (KL), curving a little
const roadPts=(a,b,s)=>{const mx=(a.x+b.x)/2,my=(a.y+b.y)/2,dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1,cx=mx-dy/l*4*s,cy=my+dx/l*4*s,o=[];
  for(let t=0;t<=1.0001;t+=1/(l*3)){const u=1-t;o.push([u*u*a.x+2*u*t*cx+t*t*b.x,u*u*a.y+2*u*t*cy+t*t*b.y])}return o};

// which region each pixel belongs to: nearest centre with a noisy edge (worked out per map unit, then per pixel)
function owners(){const R=REG(),w=W/U,h=H/U,Q=new Uint8Array(w*h),O=new Uint8Array(W*H);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){let best=0,bd=1e9;
    for(let k=0;k<R.length;k++){const d=Math.hypot(x+.5-R[k].x,y+.5-R[k].y)+(vn((x+.5)*.11+k*7.1,(y+.5)*.11+k*3.3)-.5)*14;if(d<bd){bd=d;best=k}}Q[y*w+x]=best}
  for(let j=0;j<H;j++)for(let i=0;i<W;i++)O[j*W+i]=Q[(j>>1)*w+(i>>1)];
  return O}

/* ---------- small sprites: strings of palette letters ('.' clear) ---------- */
const SP={
cottage:['....kk......','...kRRkkkk..','..kRRRRRRRk.','.kRRrRRRRRRk','kkkkkkkkkkkk','.kwwwwwwwwk.','.kwyywwwyyk.','.kwyywddwwk.','.kwwwwddwwk.','.kkkkkkkkkk.'],
hall:['..k.......k...k..','.kRk.....kRk.kRk.','kRRRk...kRRRkRRRk','kssskkkkksssksssk','ksyskRRRRRksysksk','ksssRRRRRRRssskskk','kkkkkkkkkkkkkkkk.','.kssssshsssssssk.','.ksyssshhssssysk.','.kssskkdddkksssk.','.ksssskdddksssk..','.kkkkkkkkkkkkkk..'],
tower:['...kk...','..kVVk..','.kVVVVk.','kVVVVVVk','kkkkkkkk','.kssssk.','.ksyysk.','.kssssk.','.ksssbk.','.kssssk.','.ksyysk.','.kssssk.','.kssssk.','.ksssbk.','.kssssk.','kssddssk','kssddssk','kkkkkkkk'],
forge:['.........kk.','.........ksk','..kkkkkkkksk','.kBBBBBBBksk','kBBBBBBBBBkk','kkkkkkkkkkkk','.kssssssssk.','.ksyysoossk.','.ksyysoossk.','.kssssoossk.','.kkkkkkkkkk.'],
shrine:['...kkkkk...','..kssssk...','.kss..ssk..','.ks.ll.sk..','.ks.l..sk..','.ks.ll.sk..','.ks....sk..','kkkk..kkkk.'],
keep:['..k.........k.....k..','.kVk.......kVk...kVk.','.kek.......kek...kek.','kkekkkk.kkkkekkkkkekk','keeeeek.keeeeeeeeeeek','keeqeek.keeqeeeqeeeek','keeeeekkkeeeeeeeeeeek','keeeeeeeeeeeeeeeeeeek','keqeeeeeeeeqqeeeeqeek','keeeeeeeeeqqqqeeeeeek','keeeeeeeeeqqqqeeeeeek','kkkkkkkkkkkkkkkkkkkkk'],
boat:['...k....','..kwk...','.kwwk...','kkkkkkkk','knnnnnnk','.kkkkkk.'],
stone:['.kk.','kssk','ksSk','kkkk']};
const SPAL={k:'#1b1626',R:'#b84a3a',r:'#8a3428',w:'#e6d3a8',y:'#3a4a6a',Y:'#ffd770',d:'#5b3a1e',s:'#b0aaa0',S:'#8a8478',h:'#d9453d',V:'#8767c8',b:'#5a5450',
  B:'#5a4a48',o:'#ff8a3b',l:'#f4ecc8',e:'#2a2236',q:'#b06ad8',n:'#8a5a32'};

/* ---------- painting ---------- */
let cache=null;
function paint(levels,night){const key=levels.join('')+(night?'n':'d');if(cache&&cache.key===key)return cache;
  const t0=performance.now(),R=REG(),O=cache&&cache.O||owners(),N=W*H;
  const base=new Uint8ClampedArray(N*4),trA=new Uint8ClampedArray(N*4),trB=new Uint8ClampedArray(N*4),top=new Uint8ClampedArray(N*4),grey=new Uint8ClampedArray(N*4);
  const block=new Uint8Array(N); // 1 water, 2 road, 3 building, 4 rock
  const set=(A,i,j,c,a)=>{if(i<0||j<0||i>=W||j>=H)return;const k=(j*W+i)*4;A[k]=c[0];A[k+1]=c[1];A[k+2]=c[2];A[k+3]=a==null?255:a};
  const pick=(pal,v,i,j)=>pal[clamp(Math.floor(v*pal.length+dz(i,j)-.5),0,pal.length-1)];
  // 1. ground, sea, mountains, lake, shading
  const HG=new Float32Array(N),MT=new Float32Array(N);
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const x=i/U,y=j/U,k=j*W+i,m=mount(x,y);MT[k]=m?m*(.8+.4*fbm(x*.3,y*.3)):0;HG[k]=MT[k]+volc(x,y)*1.1+vn(x*.12+3,y*.12)*.18}
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const x=i/U,y=j/U,k=j*W+i,q=coast(x,y);let c;
    if(q>=1){const dep=clamp((q-1)*2.2,0,1);c=q<1.035?C.foam[0]:dep<.18?pick(C.shallow,1-dep/.18*.7,i,j):pick(C.deep,1-dep,i,j);block[k]=1}
    else if(lake(x,y)){const e=lake(x-1,y)&&lake(x+1,y)&&lake(x,y-1)&&lake(x,y+1);c=e?pick(C.deep,.6+fbm(x*.5,y*.5)*.5,i,j):pick(C.shallow,.5,i,j);block[k]=1}
    else{const sh=(HG[k]-HG[Math.min(N-1,k+W+1)])*7.5,tex=fbm(x*.35,y*.35),M=MT[k],V=volc(x,y),b=BIOME[R[O[k]].k];
      if(M>.82)c=pick(C.snow,.5+sh,i,j),block[k]=4;
      else if(M>.32)c=pick(C.rock,.45+sh*1.2+tex*.2,i,j),block[k]=4;
      else if(V>.3){const cr=Math.hypot(x-91,y-23);c=cr<2.2?pick(C.lava,.3+tex,i,j):cr<3.2?C.ink[0]:pick(C.forge,.25+sh*1.2+tex*.3,i,j);block[k]=4}
      else if(q>.86)c=pick(C.sand,.4+tex*.6+sh,i,j);
      else if(R[O[k]].k==='food'&&x>13&&x<46&&y>85&&y<104&&fbm(x*.2,y*.2)>.3){const row=Math.floor((y-85)/2.4)%3,fx=Math.floor((x-13)/11)%2;
        c=(i+j*0)%1||(j%5===0)?C.soil[0]:row===2?C.soil[1]:pick(fx?C.wheat:C.crop,.4+tex*.6,i,j)}
      else c=pick(C[b],.38+tex*.45+sh+(M>.1?.1:0),i,j);
      if(b==='dream'&&h2(i,j)>.993)c=hex(h2(j,i)>.5?'#c9a7ff':'#fff2a8');      // glowing dream flowers
      if((b==='grass'||b==='warm')&&h2(i,j)>.992)c=hex(['#f2c14e','#e0483f','#ff9be0','#fff'][(h2(j,i)*4)|0]);
    }
    set(base,i,j,c)}
  // 2. rivers (with sparkle-light edges) and the outflow to the sea
  const stamp=(A,x,y,r,c,b)=>{for(let j=Math.floor(y-r);j<=y+r;j++)for(let i=Math.floor(x-r);i<=x+r;i++)if((i-x)**2+(j-y)**2<=r*r){set(A,i,j,c);if(b)block[j*W+i]=b}};
  const along=(pts,f)=>{for(let n=0;n<pts.length-1;n++){const[a,b]=[pts[n],pts[n+1]],l=Math.hypot(b[0]-a[0],b[1]-a[1])*U*2;for(let s=0;s<=l;s++){const t=s/l;f((a[0]+(b[0]-a[0])*t)*U,(a[1]+(b[1]-a[1])*t)*U,n/(pts.length-1))}}};
  along(RIVER,(x,y,p)=>stamp(base,x,y,1.6+p*1.4,C.shallow[0],1));along(RIVER,(x,y,p)=>stamp(base,x-.5,y-.5,.7+p*.8,C.shallow[2],1));
  along(OUT,(x,y)=>stamp(base,x,y,2.2,C.shallow[1],1));
  // 3. roads (bridges over water), brighter where both ends are restored
  KL.forEach(([a,b],n)=>{const on=levels[a]>0&&levels[b]>0,pts=roadPts(R[a],R[b],n%2?1:-1);
    pts.forEach(([x,y])=>{const i=Math.round(x*U),j=Math.round(y*U);if(block[j*W+i]===4)return;
      if(block[j*W+i]===1){stamp(base,i,j,1.5,hex('#6a4a2a'));stamp(base,i,j,.8,hex('#a0784a'));return}
      stamp(base,i,j,1.6,C.road[0],2)});
    pts.forEach(([x,y])=>{const i=Math.round(x*U),j=Math.round(y*U);if(block[j*W+i]===2)stamp(base,i,j,.8,on?C.road[2]:C.road[1])})});
  // the mountain stair: a stepped path zig-zagging up to the summit
  [[54,26,58,21],[58,21,55,16],[55,16,60,11],[60,11,61,6]].forEach(([x0,y0,x1,y1])=>{const l=Math.hypot(x1-x0,y1-y0)*U*1.5;for(let s=0;s<=l;s++){const t=s/l,i=Math.round((x0+(x1-x0)*t)*U),j=Math.round((y0+(y1-y0)*t)*U);
    set(base,i,j,s%3?hex('#c9c0aa'):hex('#8a806a'));set(base,i+1,j,hex('#8a806a'))}});
  // 4. landmarks, drawn on the top layer (above the trees)
  const L=lv=>levels[R.findIndex(r=>r.k===lv)];
  const spr=(name,x,y,o)=>{const g=SP[name];o=o||{};for(let j=0;j<g.length;j++)for(let i=0;i<g[j].length;i++){const ch=g[j][i];if(ch==='.')continue;let col=SPAL[ch];
    if(ch==='y')col=night&&!o.dark?'#ffd770':'#3a4a6a';if(ch==='q')col=o.glow?'#d27cff':'#6a3a8a';if(ch==='o')col=o.cold?'#5c4038':'#ff8a3b';
    const X=Math.round(x)+i,Y=Math.round(y)+j;set(top,X,Y,hex(col));if(X>=0&&Y>=0&&X<W&&Y<H)block[Y*W+X]=3}};
  const flag=(x,y,c)=>{for(let j=0;j<6;j++)set(top,x,y+j,hex('#5b3a1e'));for(let j=0;j<2;j++)for(let i=1;i<4;i++)set(top,x+i,y+j,hex(c))};
  spr('shrine',48,16,{});                                     // dream: the moon shrine
  spr('forge',146,58,{cold:!L('forge')});                     // the Energy Forge
  spr('hall',116,72,{dark:!L('heart')});                      // Heartstone Hall
  spr('tower',132,178,{dark:!L('bal')});                      // the Balance Tower
  spr('cottage',80,148,{dark:!L('food')});spr('cottage',36,150,{dark:!L('food')}); // Nutrition Village
  spr('cottage',140,128,{dark:!L('water')});spr('boat',176,160,{});               // Water Valley: a cottage and a boat
  [[6,78],[12,74],[18,78],[18,86],[12,90],[6,86]].forEach(([x,y])=>spr('stone',x,y));                       // Mind Forest stone circle
  spr('keep',172,196,{glow:levels.filter(v=>v>0).length<6});  // the Shadow Keep on its crag
  [['dream','#8767c8',[64,18]],['heart','#d9453d',[134,68]],['food','#f2c14e',[100,146]],['water','#2f8fd0',[156,124]],['bal','#c7b3f0',[146,176]],['forge','#ff8a3b',[164,54]],['stair','#fff',[122,6]],['mind','#3f9f4a',[30,98]]]
    .forEach(([k,c,[x,y]])=>{if(L(k)>=3)flag(x,y,c)});
  // the crag under the keep
  for(let j=206;j<224;j++)for(let i=166;i<200;i++){const d=Math.hypot((i-183)/16,(j-216)/9)+(h2(i,j)-.5)*.15;if(d<1&&!top[(j*W+i)*4+3])set(base,i,j,pick(C.rock,.25+(184-i)*.01,i,j)),block[j*W+i]=4}
  // 5. trees, in two frames for the wind (crowns lean one pixel)
  const DENS={dream:.12,stair:.22,forge:.08,mind:.9,heart:.14,water:.18,food:.1,bal:.12};
  const trees=[];
  for(let j=4;j<H-2;j+=4)for(let i=2;i<W-2;i+=4){const x=i+Math.floor(h2(i,j*3)*4),y=j+Math.floor(h2(i*5,j)*4),k=y*W+x;if(x>=W||y>=H)continue;
    const ok=[0,-2,2].every(dx=>[0,-3].every(dy=>{const kk=(y+dy)*W+x+dx;return kk>=0&&kk<N&&!block[kk]}));
    const own=R[O[k]].k,X=x/U,Y=y/U;if(!ok||coast(X,Y)>.8||mount(X,Y)>.28||volc(X,Y)>.28)continue;
    let d=DENS[own];if(own==='stair'||own==='mind')d*=clamp(1.4-fbm(X*.2,Y*.2),0,1.2);if(own==='food'&&X>13&&X<46&&Y>85&&Y<104)d=0;
    if(h2(x*7,y*11)<d)trees.push([x,y,own])}
  trees.sort((a,b)=>a[1]-b[1]);
  const TP={dream:['#1e1846','#3a3078','#54469c','#7462bc'],forest:['#163a22','#245a30','#357a3e','#4f9a4e'],pine:['#163a22','#1f5030','#2d6a3c','#3f8448'],
    dead:['#2a1a14','#4a3024','#6a4630','#6a4630'],tree:['#1f4a26','#2f6a34','#46883e','#6aa84e']};
  const drawTree=(A,x,y,kind,lean)=>{const p=TP[kind].map(hex),o=hex('#14201a'),tr=hex('#5b3a1e');
    if(kind==='dead'){for(let j=0;j<6;j++)set(A,x,y-j,hex('#3a2418'));set(A,x-1+lean,y-4,hex('#3a2418'));set(A,x+1+lean,y-5,hex('#3a2418'));set(A,x+2+lean,y-6,hex('#3a2418'));return}
    if(kind==='pine'||kind==='forest'){set(A,x,y,tr);set(A,x,y-1,tr);for(let r=0;r<6;r++){const w=Math.floor(r/1.6)+(r>3?0:0),yy=y-2-(5-r),dx=r<3?lean:0;
        for(let i=-w-1;i<=w+1;i++)set(A,x+i+dx,yy,o);for(let i=-w;i<=w;i++)set(A,x+i+dx,yy,p[i<0?2+(r%2):i===0?2:1+(r===5?0:0)])}
      set(A,x+lean,y-8,o);set(A,x-1+lean,y-7,p[3]);return}
    set(A,x,y,tr);set(A,x,y-1,tr);for(let j=-3;j<=0;j++)for(let i=-3;i<=3;i++){const d=(i/3.2)**2+((j+1.5)/2.4)**2;if(d>1)continue;const s=d>.72?o:(i+j<-2?p[3]:i+j<0?p[2]:p[1]);set(A,x+i+(j<-1?lean:0),y-2+j-1,s)}};
  trees.forEach(([x,y,own])=>{const kind=own==='dream'?'dream':own==='forge'?'dead':own==='mind'?(h2(x,y)>.3?'pine':'forest'):own==='stair'?'pine':'tree';
    drawTree(trA,x,y,kind,0);drawTree(trB,x,y,kind,kind==='dead'?0:1)});
  // 6. unrestored regions: desaturated, with fog
  const dim=A=>{for(let k=0;k<N;k++){const lv=levels[O[k]];if(lv>0||!A[k*4+3])continue;const i=k%W,j=(k/W)|0;
      // soften the edge between a ruined region and its neighbours with a dither
      const a=k*4,g=(A[a]*.3+A[a+1]*.59+A[a+2]*.11)*.82+18;A[a]=mix(A[a],g,.75);A[a+1]=mix(A[a+1],g,.75);A[a+2]=mix(A[a+2],g+6,.75)}};
  for(let k=0;k<N*4;k++)grey[k]=base[k];
  dim(base);dim(trA);dim(trB);dim(top);
  const fog=hex('#c9cdd8');
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const k=j*W+i;if(levels[O[k]]>0)continue;const f=fbm(i*.06+11,j*.08+4);if(f>.55&&dz(i,j)<(f-.55)*2.4){const a=k*4;if(top[a+3])continue;top[a]=fog[0];top[a+1]=fog[1];top[a+2]=fog[2];top[a+3]=120}}
  const toC=A=>{const c=D.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(new ImageData(A,W,H),0,0);return c};
  cache={key,O,base:toC(base),a:toC(trA),b:toC(trB),top:toC(top),grey,trees,ms:Math.round(performance.now()-t0)};return cache}
// a region's ruined look (for the colour burst): its own pixels from the picture, desaturated
function greyOf(i){const g=cache.grey,O=cache.O,A=new Uint8ClampedArray(W*H*4);
  for(let k=0;k<W*H;k++){if(O[k]!==i)continue;const a=k*4,v=(g[a]*.3+g[a+1]*.59+g[a+2]*.11)*.82+18;A[a]=v;A[a+1]=v;A[a+2]=v+6;A[a+3]=255}
  const c=D.createElement('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(new ImageData(A,W,H),0,0);return c}

/* ---------- time of day ---------- */
function sky(){const h=new Date().getHours()+new Date().getMinutes()/60;
  if(h>=20.5||h<5.5)return{k:'night',c:'rgba(16,22,68,.42)'};if(h<7.5)return{k:'dawn',c:'rgba(255,150,110,.16)'};if(h>=18)return{k:'dusk',c:'rgba(255,120,60,.2)'};return{k:'day',c:'rgba(0,0,0,0)'}}

/* ---------- the moving bits (SVG in map units, CSS animations only) ---------- */
function life(levels,mini){const R=REG(),r=(x,y,w,h,f,ex)=>'<rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+f+'"'+(ex||'')+'/>';let g='';
  // cloud shadows drifting over the land
  g+='<g class="v6mcl"><ellipse cx="20" cy="40" rx="16" ry="7" fill="#0b1a10" opacity=".13"/><ellipse cx="62" cy="86" rx="13" ry="5.5" fill="#0b1a10" opacity=".11"/></g>';
  // glints on the lake, the river mouth and the sea
  const gl=(pts,c)=>'<g class="v6mgl '+c+'">'+pts.map(([x,y,w])=>r(x,y,w||1.5,.5,'#eaf8ff')).join('')+'</g>';
  g+=gl([[78,73],[86,79],[90,74],[4,104],[94,6],[96,96]],'a')+gl([[82,77],[88,72],[74,78,1],[8,108],[90,108],[2,4]],'b');
  // smoke from chimneys: forge (when lit), hall and village cottages (when the region is restored)
  const L=k=>levels[R.findIndex(x=>x.k===k)];
  [['forge',78.5,28.5],['food',42.5,74],['food',20.5,75],['heart',64,35.5],['water',72.5,64]].forEach(([k,x,y],n)=>{if(L(k)>0)g+='<g class="v6msm" style="--d:'+(3.2+n*.4)+'s;--l:-'+(n*.7)+'s">'+r(x,y,1.4,1.4,'#e8e4ec','')+r(x+.8,y-1.6,1.1,1.1,'#d0ccd8')+'</g>'});
  // fog wisps over ruined regions
  R.forEach((p,i)=>{if(!levels[i])g+='<ellipse class="v6mfg" style="--d:'+(14+i*1.7)+'s" cx="'+p.x+'" cy="'+(p.y+3)+'" rx="11" ry="3.2" fill="#d6dae4" opacity=".38"/>'});
  // the Shadow Keep's storm, weaker as regions are restored
  const n=levels.filter(v=>v>0).length,st=Math.max(.15,1-n/8);
  g+='<g class="v6mst" opacity="'+st.toFixed(2)+'"><ellipse cx="92" cy="94" rx="9" ry="3" fill="#3a2a52"/><ellipse cx="88" cy="92.5" rx="5" ry="2.2" fill="#4a3a66"/><path class="v6mzap" d="M93 96 l-1.4 3 h1.2 l-1 3" stroke="#e9d8ff" stroke-width=".5" fill="none"/></g>';
  // two birds
  if(!mini)g+='<g class="v6mbd" style="--d:26s"><path d="M0 0 l1.2 -.8 l1.2 .8 l1.2 -.8 l1.2 .8" stroke="#1b1626" stroke-width=".45" fill="none"/></g><g class="v6mbd" style="--d:34s;--l:-12s;--y:30px"><path d="M0 0 l1 -.7 l1 .7 l1 -.7 l1 .7" stroke="#1b1626" stroke-width=".4" fill="none"/></g>';
  return '<svg class="v6mlife" viewBox="0 0 100 112" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">'+g+'<path class="v6mol" d="" fill="none" stroke="#fff6c0" stroke-width=".8" stroke-dasharray="2 1.2"/></svg>'}

/* ---------- the map markup: wraps kmap (after js/v6-kingdom.js and js/v6-world.js) ---------- */
const pending=new Set();let seq=0;
HWEvents.on('kingdom:state',e=>{if(e&&e.up&&e.from==='Ruined'){const i=KR.findIndex(r=>r[0]===e.key);if(i>=0)pending.add(i)}});
const levelsNow=()=>KR.map(r=>typeof HWKingdom!=='undefined'?HWKingdom.level(r):klv(r[3]));
{const k=kmap;kmap=function(mini){let h=k.apply(this,arguments);const id='v6m'+(++seq),s=sky();
  // region buttons: zoom to the region and open its card (data-v keeps the page it leads to)
  h=h.replace(/data-a="go" data-v="([a-z]+)" aria-label="([^"]+)"/g,(m,v,l)=>{const i=KR.findIndex(r=>r[4]===v);return 'data-a="kzoom" data-i="'+i+'" data-v="'+v+'" aria-label="'+l+'. Look closer"'});
  const i0=h.indexOf('<svg'),i1=h.indexOf('</svg>')+6;
  const svg=h.slice(i0,i1).replace('<svg ','<svg class="v6mold" ');
  const lv=levelsNow();
  const layers='<div class="v6mz" id="'+id+'" data-sky="'+s.k+'"><canvas class="v6mc v6mbase" width="'+W+'" height="'+H+'"></canvas><canvas class="v6mc v6mta" width="'+W+'" height="'+H+'"></canvas>'
    +'<canvas class="v6mc v6mtb" width="'+W+'" height="'+H+'"></canvas><canvas class="v6mc v6mtop" width="'+W+'" height="'+H+'"></canvas>'+svg+life(lv,mini)
    +'<i class="v6mtint" style="background:'+s.c+'"></i>';
  const btns=h.slice(i1,h.lastIndexOf('</div>'));
  h=h.slice(0,i0).replace('class="km','class="km v6map')+layers+btns+'</div></div>';
  later(id,lv,mini);return h}}
function later(id,lv,mini){const go=()=>{const el=D.getElementById(id);if(!el)return;fill(el,lv)};if(typeof requestAnimationFrame==='function')requestAnimationFrame(go);setTimeout(go,0)}
function fill(el,lv){if(el.dataset.done)return;el.dataset.done=1;const c=paint(lv,el.dataset.sky==='night');
  [['.v6mbase','base'],['.v6mta','a'],['.v6mtb','b'],['.v6mtop','top']].forEach(([s,k])=>{const cv=el.querySelector(s);if(cv)cv.getContext('2d').drawImage(c[k],0,0)});
  // a region restored since the map was last shown bursts into colour
  pending.forEach(i=>{if(!lv[i])return;pending.delete(i);burst(el,i)})}
function burst(el,i){if(HWUI.reduced())return;const g=greyOf(i),cv=D.createElement('canvas');cv.width=W;cv.height=H;cv.className='v6mc v6mgrey';cv.getContext('2d').drawImage(g,0,0);
  const p=REG()[i];el.querySelector('.v6mtop').after(cv);
  const sp=D.createElement('div');sp.className='v6msw';sp.style.left=p.x+'%';sp.style.top=(p.y/112*100)+'%';
  sp.innerHTML=Array.from({length:14},(_,n)=>'<u style="--a:'+(n*360/14)+'deg;--r:'+(26+(n%3)*10)+'px;--l:'+(n*.035).toFixed(2)+'s"></u>').join('');el.appendChild(sp);
  setTimeout(()=>{cv.remove();sp.remove()},2200)}

/* ---------- tap: zoom and pan to the region, outline it, then its card ---------- */
function blob(p){let d='';for(let n=0;n<=24;n++){const a=n/24*Math.PI*2,r=12.5+(vn(Math.cos(a)*2+p.x,Math.sin(a)*2+p.y)-.5)*5;d+=(n?'L':'M')+(p.x+Math.cos(a)*r).toFixed(1)+' '+(p.y+Math.sin(a)*r*.9).toFixed(1)}return d+'Z'}
let zoomed=null;
function zoom(el,i){const p=REG()[i],km=el.closest('.km'),z=km.querySelector('.v6mz'),S=2.1;
  const tx=clamp(50-p.x*S,100-100*S,0),ty=clamp(50-p.y/112*100*S,100-100*S,0);
  z.style.transform='translate('+tx+'%,'+ty+'%) scale('+S+')';km.classList.add('v6mzoom');
  const o=km.querySelector('.v6mol');if(o){o.setAttribute('d',blob(p));o.classList.remove('on');void o.getBoundingClientRect();o.classList.add('on')}
  zoomed={km,btn:el}}
function unzoom(){if(!zoomed)return;const{km}=zoomed;zoomed=null;const z=km.querySelector('.v6mz');if(z)z.style.transform='';km.classList.remove('v6mzoom');const o=km.querySelector('.v6mol');if(o)o.classList.remove('on')}
acts.kzoom=(d,t)=>{const i=+d.i,btn=t&&t.closest?t.closest('.kn'):null;if(!(i>=0))return;
  if(!btn||HWUI.reduced()){acts.kreg({i});return}
  zoom(btn,i);setTimeout(()=>{if(zoomed&&zoomed.btn===btn)acts.kreg({i})},620)};
{const c=acts.mclose;acts.mclose=(...a)=>{const r=c?c(...a):undefined;const b=zoomed&&zoomed.btn;unzoom();if(b&&b.isConnected&&D.getElementById('mo').hidden)b.focus({preventScroll:true});return r}}
D.addEventListener('keydown',e=>{if(e.key==='Escape'&&zoomed&&D.getElementById('mo').hidden)unzoom()});
HWEvents.on('page:viewed',()=>{zoomed=null});

HWUI.css('map',`
.km.v6map{background:#2a6aa8;box-shadow:inset 0 0 0 3px rgba(255,255,255,.18)}
.v6mz{position:absolute;inset:0;transform-origin:0 0;transition:transform .6s cubic-bezier(.3,.7,.3,1)}
.v6mc{position:absolute;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges;pointer-events:none}
.km.v6map svg.v6mold>*:not(.v6world){display:none}
.km.v6map .v6world .v6prop>rect:not(.zt),.km.v6map .v6world .v6prop>circle,.km.v6map .v6fog{display:none}
.v6mlife{pointer-events:none}
.v6mtint{position:absolute;inset:0;pointer-events:none}
.v6mz[data-sky="night"] .v6mgl{opacity:.5}
.v6mtb{opacity:0;animation:v6msway 3.6s steps(1) infinite}.v6mta{animation:v6msway 3.6s steps(1) infinite reverse}
@keyframes v6msway{0%,58%{opacity:0}60%,100%{opacity:1}}
.v6mta{animation-name:v6mswaya}@keyframes v6mswaya{0%,58%{opacity:1}60%,100%{opacity:0}}
.v6mcl{animation:v6mcl 70s linear infinite}@keyframes v6mcl{from{transform:translateX(-40px)}to{transform:translateX(120px)}}
.v6mgl{animation:v6mgl 1.8s steps(1) infinite}.v6mgl.b{animation-delay:-.9s}@keyframes v6mgl{0%,49%{opacity:1}50%,100%{opacity:0}}
.v6msm{animation:v6msm var(--d,3.4s) steps(6) infinite;animation-delay:var(--l,0s)}@keyframes v6msm{from{transform:translate(0,0);opacity:.9}to{transform:translate(2px,-7px);opacity:0}}
.v6mfg{animation:v6mfg var(--d,15s) ease-in-out infinite alternate}@keyframes v6mfg{from{transform:translateX(-3px)}to{transform:translateX(3px)}}
.v6mst{animation:v6mst 9s ease-in-out infinite alternate}@keyframes v6mst{from{transform:translateX(-1.5px)}to{transform:translateX(1.5px)}}
.v6mzap{opacity:0;animation:v6mzap 5.2s steps(1) infinite}@keyframes v6mzap{0%,91%{opacity:0}92%,95%{opacity:1}96%{opacity:0}97%,98%{opacity:1}99%{opacity:0}}
.v6mbd{animation:v6mbd var(--d,26s) linear infinite;animation-delay:var(--l,0s)}@keyframes v6mbd{from{transform:translate(-10px,calc(18px + var(--y,0px)))}to{transform:translate(120px,calc(-6px + var(--y,0px)))}}
.v6mol{opacity:0}.v6mol.on{opacity:1;stroke-dashoffset:0;animation:v6mol .6s steps(6)}@keyframes v6mol{from{opacity:0}to{opacity:1}}
.v6mgrey{animation:v6mgrey 1.4s steps(7) .25s forwards}@keyframes v6mgrey{to{opacity:0}}
.v6msw{position:absolute;width:0;height:0;pointer-events:none;z-index:3}
.v6msw u{position:absolute;left:-2px;top:-2px;width:4px;height:4px;background:#fff6c0;box-shadow:0 0 0 1px #f2c14e;opacity:0;animation:v6msw 1.3s steps(8) var(--l,0s) forwards}
@keyframes v6msw{0%{opacity:1;transform:rotate(var(--a)) translateX(4px)}100%{opacity:0;transform:rotate(calc(var(--a) + 140deg)) translateX(var(--r))}}
.km.v6map .kn{z-index:2}.km.v6mzoom .kn:not(:focus) span{opacity:.92}
html.hw-q-performance .v6mbd,html.hw-q-performance .v6mgl.b,html.hw-q-performance .v6mfg{animation:none}
@media(prefers-reduced-motion:reduce){.v6mz{transition:none}.v6mta,.v6mtb,.v6mcl,.v6mgl,.v6msm,.v6mfg,.v6mst,.v6mzap,.v6mbd,.v6mol.on{animation:none!important}.v6mtb{opacity:0}.v6mta{opacity:1}.v6msm,.v6mbd{display:none}}
`);
return{paint:(l,n)=>paint(l||levelsNow(),!!n),get zoomed(){return !!zoomed},unzoom,sky,get buildMs(){return cache&&cache.ms}}})();
