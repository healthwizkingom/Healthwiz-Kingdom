/* v6: the Counting Sheep dream on the Sleep page, as one living pixel-art scene. Not part of the original.
   The original drew the bedroom picture (assets/img/bedimg.jpg) with a CSS dream bubble and a sheep image sliding over a
   CSS fence. This keeps the game exactly (endless counting, a sheep every 2.3 s that is counted as it clears the fence,
   Medius leaping every 8–12 jumps, DRIFT OFF, the once-a-day +10 XP for 3+ sheep, the Sleep page's lullaby) and redraws
   the scene on one small canvas (192 × 190 pixels, scaled up with image-rendering: pixelated):
   * the sleeper: assets/img/bedroom.webp, the same bedroom, face, beanie, hair, shirt, pillow and quilt redrawn as pixel
     art (tools/art/make_bedroom.py). Parts of it move as layers cut from that picture: the shoulder and quilt rise and
     fall with each breath (4.6 s), the head settles now and then, a finger twitches on the pillow. The eyes stay
     closed. When Medius leaps, the sleeper reacts in their sleep for 1.5 s: brows up, eyes squeezed, a small "o" mouth
     (assets/img/sleeper-react.webp, made from the same pixels) and a pixel "!" above the head.
   * pixel Zs drift up from the head along a gentle wave, growing and fading, one after another; the bedside lamp's
     warm glow flickers softly.
   * the dream cloud, joined to the head by small bubbles, holds a moonlit meadow: twinkling stars, a moon, distant
     hills and nearer hills that sway at different depths (parallax), swaying grass, wisps of cloud and a wooden fence.
     Fluffy sheep in three sizes (shaded wool, 6-frame run, a crouch, a stretch and a squash on landing with a dust
     puff) leap the fence; Medius leaps with his robe and beard fluttering and a trail of sparkles. The counter pops
     when a jumper clears the fence.
   Sprites are drawn once by code at start (no extra image files). The scene animates only while it is on screen and
   the tab is visible; reduced motion (device or in-app) and Animations Off show a still frame. A FULL SCREEN button
   fills the screen with the dream (Fullscreen API, or a fixed layer where that is not available). While the wake-up
   alarm rings (body.v6wake, js/v6-alarm.js) the dream pops and morning light comes in. */
const HWSheep=(()=>{
const D=document,W=192,H=190,SRC='assets/img/bedroom.webp',REACT='assets/img/sleeper-react.webp',TAU=Math.PI*2;
const still=()=>HWUI.reduced()||D.documentElement.classList.contains('hw-still');
const mk=(w,h)=>{const c=D.createElement('canvas');c.width=w;c.height=h;return c};
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],dz=(x,y)=>(BAY[(y&3)*4+(x&3)]+.5)/16; // 4×4 ordered dither
const hex=s=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
const clamp=(v,a,b)=>v<a?a:v>b?b:v,md=(a,n)=>((a%n)+n)%n;
// deterministic noise so a still frame always looks the same
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s)};

/* ---------- where things are in the bedroom picture (pixels of the 192 × 190 art) ---------- */
const HEAD=[[32,62],[44,57],[60,54],[80,55],[96,60],[106,66],[112,76],[112,92],[104,98],[98,106],[92,118],[86,128],[80,132],[68,134],[56,128],[46,124],[34,120],[26,108],[28,92],[30,76]];
const SHOULDER=[[100,110],[116,108],[132,114],[142,124],[146,136],[138,146],[120,152],[104,156],[96,148],[92,136],[94,122]];
const QUILT=[[112,150],[124,140],[140,134],[160,129],[176,127],[192,126],[192,190],[104,190],[100,176],[104,162]];
const FINGERS=[[20,128],[34,126],[40,130],[40,142],[30,144],[20,140]];
// the dream window: a rounded box (superellipse) inside the cloud, and the bubbles that lead to it from the head
const WX=147,WY=42,WA=35,WB=29,WN=2.6,DX=WX-WA,DY=WY-WB,DW=WA*2,DH=WB*2;
const BUBS=[[95,73,1.5],[101,66,2.4]];
const inWin0=(x,y)=>Math.pow(Math.abs((x-WX)/WA),WN)+Math.pow(Math.abs((y-WY)/WB),WN)<=1;
let WIN=null;const inWin=(x,y)=>{if(!WIN){WIN=new Uint8Array(W*H);for(let j=DY-1;j<=DY+DH+1;j++)for(let i=DX-1;i<=DX+DW+1;i++)if(i>=0&&j>=0&&i<W&&j<H)WIN[j*W+i]=inWin0(i+.5,j+.5)?1:0}
  x=Math.floor(x);y=Math.floor(y);return x>=0&&y>=0&&x<W&&y<H&&WIN[y*W+x]===1};
function inPoly(P,x,y){let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c}return c}
const box=P=>{const xs=P.map(p=>p[0]),ys=P.map(p=>p[1]),x=Math.floor(Math.min(...xs)),y=Math.floor(Math.min(...ys));return[x,y,Math.ceil(Math.max(...xs))-x+1,Math.ceil(Math.max(...ys))-y+1]};

/* ---------- a tiny rasteriser: shapes → pixels, shaded, with a 1-pixel ink outline ---------- */
// px: a w×h grid of colour strings (or null). Shapes are tested in order, later on top.
function grid(w,h){return{w,h,p:new Array(w*h).fill(null),z:new Float32Array(w*h).fill(-1),id:new Int16Array(w*h).fill(-1)}}
function toCanvas(G,ink){const c=mk(G.w,G.h),x=c.getContext('2d'),im=x.createImageData(G.w,G.h),d=im.data,at=(i,j)=>i>=0&&j>=0&&i<G.w&&j<G.h&&G.p[j*G.w+i];
  for(let j=0;j<G.h;j++)for(let i=0;i<G.w;i++){let col=G.p[j*G.w+i];if(!col&&ink&&(at(i-1,j)||at(i+1,j)||at(i,j-1)||at(i,j+1)))col=ink;if(!col)continue;
    const k=(j*G.w+i)*4,v=hex(col);d[k]=v[0];d[k+1]=v[1];d[k+2]=v[2];d[k+3]=255}
  x.putImageData(im,0,0);return c}
// wool / cloud: overlapping spheres lit from the moon (upper right), quantised to a palette with dither; where two
// puffs meet, a darker curl line. pal = dark … light.
const LIT=(()=>{const l=[.5,-.62,.6],m=Math.hypot(...l);return l.map(v=>v/m)})();
function puffs(G,list,pal,o){o=o||{};const n=pal.length,R=o.box||[0,0,G.w,G.h];
  for(let j=R[1];j<R[3];j++)for(let i=R[0];i<R[2];i++){let best=-1,bz=-1,bn=null;
    for(let q=0;q<list.length;q++){const[cx,cy,r]=list[q],dx=(i+.5-cx)/r,dy=(j+.5-cy)/r,dd=dx*dx+dy*dy;if(dd>1)continue;const z=Math.sqrt(1-dd);
      if(z+(q*.002)>bz){bz=z+q*.002;best=q;bn=[dx,dy,z]}}
    if(best<0)continue;const k=j*G.w+i;let v=(o.amb||.28)+(1-(o.amb||.28))*Math.max(0,bn[0]*LIT[0]+bn[1]*LIT[1]+bn[2]*LIT[2]);
    if(o.under&&bn[1]>.55)v*=.82;
    G.p[k]='?';G.z[k]=v;G.id[k]=best}
  for(let j=R[1];j<R[3];j++)for(let i=R[0];i<R[2];i++){const k=j*G.w+i;if(G.p[k]!=='?')continue;let v=G.z[k];
    const nb=(a,b)=>a>=0&&b>=0&&a<G.w&&b<G.h?G.id[b*G.w+a]:-2;
    if(nb(i+1,j)>=0&&nb(i+1,j)!==G.id[k]&&G.z[k]<G.z[k+1])v-=.18;else if(nb(i,j+1)>=0&&nb(i,j+1)!==G.id[k]&&G.z[k]<G.z[k+G.w])v-=.18;
    if(o.rim&&(nb(i+1,j)===-1||nb(i,j-1)===-1)&&(nb(i+1,j)===-1||nb(i+1,j-1)===-1))v+=.22; // moonlit rim
    G.p[k]=pal[clamp(Math.floor(v*(n-.01)+dz(i,j)-.5),0,n-1)]}}
// a filled shape with a light rim on the moon side and a shade on the other: fill(G,test,[dark,mid,light])
function fill(G,test,c3,lx,ly){lx=lx==null?1:lx;ly=ly==null?-1:ly;
  for(let j=0;j<G.h;j++)for(let i=0;i<G.w;i++){if(!test(i+.5,j+.5))continue;const lit=!test(i+.5+lx,j+.5+ly),sh=!test(i+.5-lx,j+.5-ly);
    G.p[j*G.w+i]=lit&&!sh?c3[2]:sh&&!lit?c3[0]:c3[1]}}
const ell=(cx,cy,rx,ry)=>(x,y)=>((x-cx)/rx)**2+((y-cy)/ry)**2<=1;
const pol=P=>(x,y)=>inPoly(P,x,y);
function line(G,x0,y0,x1,y1,c){x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let e=dx+dy;
  for(;;){if(x0>=0&&y0>=0&&x0<G.w&&y0<G.h)G.p[y0*G.w+x0]=c;if(x0===x1&&y0===y1)break;const e2=2*e;if(e2>=dy){e+=dy;x0+=sx}if(e2<=dx){e+=dx;y0+=sy}}}
const dot=(G,x,y,c)=>{x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<G.w&&y<G.h)G.p[y*G.w+x]=c};

/* ---------- sprites ---------- */
const INK='#221b33',WOOL=['#4e4a6c','#7c78a0','#aaa7c8','#d6d4ea','#f4f3fb','#ffffff'],FACE=['#2c2438','#463a58','#6a5c80'];
const SIZES=[.8,1,1.22];
// pose: run0..5 | crouch | rise | apex | fall | land | graze | stand
function sheep(sz,pose){const w=Math.ceil(22*sz)+2,h=Math.ceil(17*sz)+2,G=grid(w,h),s=sz,base=h-2;
  let sx=1,sy=1,bob=0,legs;const f=/^run/.test(pose)?+pose.slice(3):0,ph=f/6*TAU;
  if(pose==='crouch'||pose==='land'){sx=1.12;sy=.8}else if(pose==='rise'||pose==='fall'){sx=.92;sy=1.12}
  if(/^run/.test(pose))bob=[0,1,1,0,1,1][f];
  const LG=3.2*s;// leg length
  const by=base-LG-4.2*s*sy-bob+(pose==='crouch'||pose==='land'?1:0); // body centre y
  const bx=w/2-1.5*s;
  // body: wool puffs (an oval of spheres)
  const P=[[-4.4,.8,3],[-1.8,-1.3,3.5],[1.6,-1.4,3.5],[4,.4,3],[-2.6,2,3.1],[.8,2.2,3.2],[3.2,1.8,2.6]].map(([x,y,r])=>[bx+x*s*sx,by+y*s*sy,r*s*Math.sqrt(sx*sy)]);
  // legs (dark), drawn first so the wool covers the hips
  const hipY=by+2.6*s*sy,foot=base,L=[];
  if(/^run/.test(pose)||pose==='stand'||pose==='graze'){const sw=pose==='stand'||pose==='graze'?0:1;
    [[-3.4,ph+Math.PI],[-1.8,ph+Math.PI*1.25],[2.6,ph],[4,ph+Math.PI*.25]].forEach(([lx,a])=>{const fx=sw?Math.round(1.6*s*Math.sin(a)):0,up=sw&&Math.cos(a)>.3?1:0;L.push([bx+lx*s,hipY,bx+lx*s+fx,foot-up])})}
  else if(pose==='crouch'||pose==='land'){[[-4,-1.4],[-2.2,-.6],[2.6,.6],[4.4,1.4]].forEach(([lx,o])=>L.push([bx+lx*s*sx,hipY,bx+(lx+o)*s*sx,foot]))}
  else if(pose==='rise'){[[-3.6,-3.6,1],[-2,-3.2,1.6],[2.8,2.2,-1.4],[4.2,3,-1]].forEach(([lx,o,d])=>L.push([bx+lx*s,hipY,bx+(lx+o)*s,hipY+(LG-1+d*.3)*1]))}
  else if(pose==='apex'){[[-3,-1.6],[-1.6,-1],[2.4,1],[3.8,1.6]].forEach(([lx,o])=>L.push([bx+lx*s,hipY,bx+(lx+o)*s,hipY+LG*.55]))}
  else if(pose==='fall'){[[-3.4,-2.4],[-2,-1.8],[2.8,2.6],[4.2,3.4]].forEach(([lx,o])=>L.push([bx+lx*s,hipY,bx+(lx+o)*s,hipY+LG]))}
  L.forEach(([x0,y0,x1,y1])=>{line(G,x0,y0,x1,y1,FACE[1]);if(s>1.1)line(G,x0+1,y0,x1+1,y1,FACE[0]);dot(G,x1,y1,FACE[0])});
  const Wg=grid(w,h);puffs(Wg,P,WOOL,{rim:1,under:1});Wg.p.forEach((c,k)=>{if(c)G.p[k]=c});
  // head: dark face with an ear and an eye, a wool tuft on top; lowered when grazing
  const gz=pose==='graze',hx=bx+(gz?7:7.4)*s*sx,hy=by+(gz?3.2:-.4)*s*sy-(pose==='rise'?1:0)+(pose==='fall'?1:0);
  fill(G,ell(hx-1.7*s,hy-.5*s,1.4*s,.75*s),[FACE[0],FACE[1],FACE[1]]); // ear, laid back
  fill(G,ell(hx,hy,2.4*s,2*s),FACE);fill(G,ell(hx+1.4*s,hy+.8*s,1.5*s,1.1*s),[FACE[1],FACE[2],'#8a7aa0']); // head and muzzle
  dot(G,hx+.3*s,hy-.7*s,'#f4f1ff');if(s>1.1)dot(G,hx+.3*s+1,hy-.7*s,'#1b1626');dot(G,hx+2.4*s,hy+.6*s,FACE[0]);
  const T=grid(w,h);puffs(T,[[hx-1.2*s,hy-1.8*s,1.4*s]],WOOL,{rim:1});T.p.forEach((c,k)=>{if(c)G.p[k]=c});
  return toCanvas(G,INK)}

// Medius in the dream: pointed hat (tip blown back), white beard, blue robe with gold trim, arms out; f = flutter frame
const MR=['#1a2560','#2f4aa0','#5677d6'],MH=['#1c2a6a','#33509f','#5a7ad8'],GOLD='#f2c14e',SKIN=['#c08a6a','#efc6a0','#fde0c4'],BEARD=['#a9aec4','#e6e8f2','#ffffff'];
function wizard(f,air){const G=grid(20,26),fl=[0,1,0,-1][f%4],t=air?1:0;
  // robe: hem flutters, flares in the air
  const hem=[[14+t*2+fl,22],[12,23+(f%2)],[9.5,22.4],[7,23-(f%2)],[4.5-t*2-fl,22]];
  fill(G,pol([[7.4,11.5],[12.6,11.5],...hem]),MR);
  for(let i=0;i<20;i++){for(let j=25;j>10;j--){const k=j*20+i;if(G.p[k]&&MR.includes(G.p[k])){G.p[k]=GOLD;break}}} // trim along the hem
  // arms: out and up in the air, swinging when running
  const ar=air?[[8,13,3.6,9.6+fl*.5],[12,13,17,9+fl*.5]]:[[8,13,5.6,17+fl],[12,13,15,15.8-fl]];
  ar.forEach(([x0,y0,x1,y1])=>{line(G,x0,y0,x1,y1,MR[1]);line(G,x0,y0+1,x1,y1+1,MR[0]);dot(G,x1,y1,SKIN[1]);dot(G,x1,y1+1,SKIN[0])});
  // boots below the hem when running
  if(!air){dot(G,8+fl,24,'#5a3a2a');dot(G,11-fl,24,'#5a3a2a')}
  // face, beard (tip blown back in the air), hat
  fill(G,ell(10.6,9.2,2.7,2.4),SKIN);dot(G,11.9,8.6,'#1b1626');dot(G,13,9.6,SKIN[0]);
  const bt=air?-1.6-fl*.6:fl*.4;
  fill(G,pol([[7.8,10.6],[13.2,10.8],[12.4,14.4],[10.4+bt,18.6+(air?0:fl*.3)],[8.6,14.8]]),BEARD);
  fill(G,pol([[9.8,10.4],[13.4,10.2],[12.8,11.4],[10.2,11.6]]),[BEARD[1],BEARD[2],BEARD[2]]); // moustache
  fill(G,ell(10.2,6.4,4.6,1.2),[MH[0],MH[0],MH[1]]); // brim
  const tip=air?[2+fl*.5,.8]:[4,.2+fl*.3];
  fill(G,pol([[6.6,6.2],[13.4,6.2],[11.6,3],[8.4,1.4],tip]),MH);
  dot(G,10,4.4,GOLD);dot(G,10.9,3.8,GOLD);dot(G,10.4,5.2,GOLD); // the crescent moon on his hat
  return toCanvas(G,INK)}

// the cloud around the dream window, and the thought bubbles: soft lavender puffs lit from the moon
const CLOUD=['#5c5890','#8a87bd','#b9b6de','#dddcf3','#f6f6ff'];
function cloud(){const G=grid(W,H),L=[];
  for(let a=0;a<TAU-.01;a+=TAU/15){const c=Math.cos(a),s=Math.sin(a),r=1+.06*Math.sin(a*3),
    x=WX+Math.sign(c)*WA*Math.pow(Math.abs(c),2/WN)*r,y=WY+Math.sign(s)*WB*Math.pow(Math.abs(s),2/WN)*r;L.push([x,y,6.8+2.2*hash(a*7)])}
  BUBS.forEach(b=>L.push(b));
  const R=[88,0,W,92];puffs(G,L,CLOUD,{rim:1,amb:.36,box:R});
  for(let j=R[1];j<R[3];j++)for(let i=R[0];i<R[2];i++){const k=j*W+i;if(inWin(i+.5,j+.5))G.p[k]=null;else if(G.p[k]&&inWin(i+.5-1,j+.5)+inWin(i+.5+1,j+.5)+inWin(i+.5,j+.5-1)+inWin(i+.5,j+.5+1))G.p[k]='#3b3770'}
  return toCanvas(G,'#241f45')}

// paint a w×h canvas pixel by pixel through ImageData: fn(i,j) → '#rrggbb' or null
const RGBC={};
function paint(w,h,fn,c,R){c=c||mk(w,h);R=R||[0,0,w,h];const x=c.getContext('2d'),im=x.getImageData(0,0,w,h),d=im.data;
  for(let j=R[1];j<R[3];j++)for(let i=R[0];i<R[2];i++){const col=fn(i,j);if(!col)continue;const v=RGBC[col]||(RGBC[col]=hex(col)),k=(j*w+i)*4;d[k]=v[0];d[k+1]=v[1];d[k+2]=v[2];d[k+3]=255}
  x.putImageData(im,0,0);return c}
// pixel letters: Z (3 sizes) and "!"
function zed(n){const G=grid(n+2,n+2);for(let i=0;i<n;i++){dot(G,1+i,1,'#eef2ff');dot(G,1+i,n,'#c9d2f2');dot(G,n-i,1+i,'#eef2ff')}return toCanvas(G,'#2a2448')}
function bang(){const G=grid(5,11);for(let j=1;j<7;j++){dot(G,1,j,'#ffe9a8');dot(G,2,j,'#f2c14e');dot(G,3,j,j<6?'#c98a1e':'#f2c14e')}
  [[1,8],[2,8],[3,8],[1,9],[2,9],[3,9]].forEach(([x,y])=>dot(G,x,y,y===8?'#f2c14e':'#c98a1e'));return toCanvas(G,'#1b1626')}

/* ---------- the meadow inside the dream (window-local coordinates, DW × DH) ---------- */
const GY=46,FX=36; // ground line (where hooves are), fence centre
const hillF=x=>27+3*Math.sin(x/9.5+1)+2*Math.sin(x/4.3),hillN=x=>36+2.2*Math.sin(x/7+2)+1.2*Math.sin(x/3.1);
function sky(){const B=['#0e1230','#151a3e','#1d2350','#262b62','#312f70','#3d377a','#4b3f82'],c=paint(DW,DH,(i,j)=>B[clamp(Math.round(j/(GY+2)*(B.length-1)+dz(i,j)-.5),0,B.length-1)]),x=c.getContext('2d');
  // the moon with a dithered halo, craters and a lit edge
  const mx=54,my=11;for(let j=-9;j<=9;j++)for(let i=-9;i<=9;i++){const d=Math.hypot(i,j);if(d>5.4&&d<9&&dz(i+40,j+40)<(9-d)/6){x.fillStyle='#6a63a8';x.fillRect(mx+i,my+j,1,1)}}
  for(let j=-5;j<=5;j++)for(let i=-5;i<=5;i++){const d=Math.hypot(i+.0,j+.0);if(d>5.2)continue;x.fillStyle=d>4.4&&i<0?'#cfc6a0':i+j>3?'#fffbe6':'#f4ecc8';x.fillRect(mx+i,my+j,1,1)}
  [[-2,-1,'#ddd3ac'],[-1,-1,'#ddd3ac'],[1,2,'#ddd3ac'],[-2,2,'#e6dcb6'],[2,-2,'#e6dcb6']].forEach(([i,j,c])=>{x.fillStyle=c;x.fillRect(mx+i,my+j,1,1)});
  return c}
// a strip wider than the window so it can sway (parallax)
function hills(f,cols,rim,trees){const T=(trees||[]).map(n=>[n,Math.round(f(n-4))]);
  return paint(DW+8,DH,(i,j)=>{const top=Math.round(f(i-4));
    for(const[tx,ty]of T){const dy=j-(ty-9),half=Math.floor(dy/2.4);if(dy>=0&&j<ty+1&&Math.abs(i-tx)<=half)return Math.abs(i-tx)===half&&i>tx?rim:'#142a34'} // pines
    if(j<top)return null;return j===top?rim:cols[clamp(Math.floor((j-top)/3+dz(i,j)-.5),0,cols.length-1)]})}
function meadow(){const G=['#1f4a3c','#245640','#2b6446','#33704c'],c=paint(DW+8,DH,(i,j)=>{const top=GY-5+Math.round(1.2*Math.sin((i-4)/11));if(j<top)return null;
    const v=(j-top)/(DH-top)*3.2+dz(i,j)-.5+(hash(i*3.1+j*7.7)>.93?1:0);return j===top?'#4f8a5a':G[clamp(Math.round(3-v),0,3)]}),x=c.getContext('2d');
  // pale moon flowers and lighter grass patches
  for(let n=0;n<14;n++){const i=Math.floor(hash(n*5.3)*(DW+8)),j=GY-2+Math.floor(hash(n*9.1)*(DH-GY));x.fillStyle=n%3?'#5f9a64':'#e9e4ff';x.fillRect(i,j,1,1)}
  return c}
function fence(){const G=grid(26,18),wood=['#5e3620','#8a5530','#b8834e'],X=n=>n+13-FX;
  [[FX-8,3],[FX,2],[FX+8,3]].forEach(([px,top])=>{fill(G,pol([[X(px)-1.4,top+1.2],[X(px),top-.4],[X(px)+1.4,top+1.2],[X(px)+1.4,16],[X(px)-1.4,16]]),wood)});
  [6,10].forEach(ry=>{fill(G,(x,y)=>x>=1&&x<=25&&y>=ry&&y<ry+2.2,wood);for(let i=2;i<25;i+=5)dot(G,i,ry+1,'#734526')});// rails with grain
  [[X(FX-8),7],[X(FX),7],[X(FX+8),7],[X(FX-8),11],[X(FX),11],[X(FX+8),11]].forEach(([x,y])=>dot(G,x,y,'#d9c7a0')); // nail heads
  return toCanvas(G,'#21140e')}

/* ---------- state ---------- */
let room=null,ok=false,cv=null,cx=null,raf=0,vis=true,IO=null,dream=null,dx=null;
const J=[];let reactAt=-1e9,lastWake=0,popAt=-1e9,mounted=null;
// built in a few short steps (one per task) so opening the Sleep page never stalls; the room shows at once
const STEPS=[O=>{const mask=P=>{const[bx,by,bw,bh]=box(P);return paint(W,H,(i,j)=>inPoly(P,i+.5,j+.5)?'#ffffff':null,null,[bx,by,Math.min(W,bx+bw),Math.min(H,by+bh)])};
    O.masks={s:mask(SHOULDER),q:mask(QUILT),h:mask(HEAD),f:mask(FINGERS)};O.glow=glow();O.z=[zed(4),zed(5),zed(7)];O.bang=bang()},
  O=>{O.cloud=cloud()},
  O=>{O.sky=sky();O.far=hills(hillF,['#36407a','#2f386c','#2a3160'],'#6270b0');O.near=hills(hillN,['#22465a','#1e3e50','#1a3646'],'#4c8c80',[10,15,52,58,63]);
    O.meadow=meadow();O.fence=fence();O.sheep=SIZES.map(s=>new Proxy({},{get:(o,p)=>o[p]||(o[p]=sheep(s,p))}))},
  O=>{O.wiz={run:[0,1,2,3].map(f=>wizard(f,0)),air:[0,1,2,3].map(f=>wizard(f,1))};O.done=1}];
let S0=null,busy=0;
function build(all){S0=S0||{n:0,ms:0};if(S0.done||busy)return S0;
  const step=()=>{const t0=performance.now();STEPS[S0.n++](S0);S0.ms+=Math.round(performance.now()-t0);L=null};
  if(all){while(!S0.done)step();return S0}
  busy=1;const go=()=>{step();if(S0.done){busy=0;kick()}else{if(S0.n===1)kick();setTimeout(go,16)}};setTimeout(go,0);return S0}
// the lamp's warm light: a dithered fall-off, drawn with additive blending at a flickering strength
const GL=['#140c04','#28180a','#40260e','#5c3814','#7a4c1c'];
function glow(){return paint(W,H,(i,j)=>{const v=1-Math.hypot((i-4)/1.15,(j-38)*.95)/78;if(v<=0)return null;return GL[clamp(Math.floor(v*v*5.2+dz(i,j)-.5),0,4)]})}
// layers cut from the picture
function cut(m){const c=mk(W,H),x=c.getContext('2d');x.drawImage(room,0,0);x.globalCompositeOperation='destination-in';x.drawImage(m,0,0);return c}
let L=null;
function layers(){if(L||!ok||!S0||!S0.masks)return L;const m=S0.masks;L={s:cut(m.s),q:cut(m.q),h:cut(m.h),f:cut(m.f)};return L}
function load(){if(room)return;face.im=new Image();face.im.src=REACT;room=new Image();room.onload=()=>{ok=true;L=null;kick()};room.onerror=()=>{room=null};room.src=SRC}

/* ---------- drawing ---------- */
const BREATH=4.6;
// anchored stretch: the layer's top edge rises by dy, its bottom stays put
function lift(x,l,P,dy){if(!dy){x.drawImage(l,0,0);return}const[bx,by,w0,h0]=box(P),bw=Math.min(w0,W-bx),bh=Math.min(h0,H-by);x.drawImage(l,bx,by,bw,bh,bx,by-dy,bw,bh+dy)}
function headShift(t){const c=t%17;return c>9&&c<13.5?1:0}
function twitch(t){const c=t%9.3,k=Math.floor(t/9.3);if(hash(k)<.35)return 0;return(c>4&&c<4.12)||(c>4.3&&c<4.4)?1:0}
// the surprised face (assets/img/sleeper-react.webp, tools/art/make_sleeper_react.py): made from the picture's own
// pixels (brows lifted, lids stretched, eyes squeezed, a small "o" mouth), so its shading matches the art
function face(x,k){if(k&&face.im&&face.im.complete&&face.im.naturalWidth)x.drawImage(face.im,42,84)}
function zs(x,t){const n=3,LIFE=4.6;for(let q=0;q<n;q++){const p=((t/LIFE)+q/n)%1,x0=62,y0=50;
  const px=Math.round(x0-26*p+4*Math.sin(p*TAU*1.3+q)),py=Math.round(y0-40*p),s=p<.3?0:p<.62?1:2;
  const a=p<.08?p/.08:p>.78?(1-p)/.22:1;x.globalAlpha=Math.round(a*4)/4;if(x.globalAlpha>0)x.drawImage(S0.z[s],px,py);x.globalAlpha=1}}
function sway(t){return Math.sin(t/24*TAU)} // the dream's slow camera sway (parallax)
function jumper(x,j,t,cam){// one sheep or Medius, positioned by the time since it was spawned
  const tt=(t*1000-j.b)/1000,v=j.v,xx=FX+v*(tt-1.15),R=13*(j.wz?1.15:SIZES[j.s]),T0=1.15-R/v,T1=1.15+R/v,h=j.wz?18:12*SIZES[j.s];
  let pose,y=0;
  if(tt>=T0&&tt<=T1){const q=(tt-T0)/(T1-T0);y=-h*4*q*(1-q);pose=q<.36?'rise':q<.64?'apex':'fall'}
  else if(tt<T0&&tt>T0-.08)pose='crouch';else if(tt>T1&&tt<T1+.1)pose='land';else pose='run'+md(Math.floor(tt*12),6);
  if(j.wz){const sp=S0.wiz[tt>=T0&&tt<=T1?'air':'run'][md(Math.floor(tt*10),4)];
    // sparkles trail behind him while he is in the air
    if(tt>=T0-.05&&tt<=T1+.4)for(let k=1;k<=5;k++){const tb=tt-k*.07;if(tb<T0||tb>T1)continue;const q=(tb-T0)/(T1-T0),sx=Math.round(FX+v*(tb-1.15)-6+cam),sy=Math.round(GY-10-h*4*q*(1-q)+((k*7)%5)-2);
      const on=((Math.floor(t*12)+k)%3)!==0;x.fillStyle=k<3?'#fffbe6':'#f2c14e';x.fillRect(sx,sy,1,1);if(on&&k<4){x.fillStyle='#f2c14e';x.fillRect(sx-1,sy,1,1);x.fillRect(sx+1,sy,1,1);x.fillRect(sx,sy-1,1,1);x.fillRect(sx,sy+1,1,1)}}
    x.drawImage(sp,Math.round(xx-10+cam),Math.round(GY-24+y))}
  else{const sp=S0.sheep[j.s][pose];x.drawImage(sp,Math.round(xx-sp.width/2+cam),Math.round(GY-sp.height+2+y))}
  // dust puff on landing
  const dl=tt-T1;if(dl>0&&dl<.45){const lx=FX+v*(T1-1.15)+cam;x.fillStyle=dl<.2?'#cfc8e6':'#9d97bf';
    for(let k=0;k<5;k++){const a=Math.PI*(.1+.8*k/4),r=2+dl*14,px=Math.round(lx+Math.cos(a)*r*(k%2?1:-1)*.9),py=Math.round(GY-.5-Math.sin(a)*r*.35);if(hash(k+dl*20|0)>dl*1.6)x.fillRect(px,py,dl<.15?2:1,1)}}}
function meadowScene(x,t,s){// the whole dream into the window-local canvas
  const cam=Math.round(s*1.4);
  x.drawImage(S0.sky,0,0);
  // twinkling stars (a fixed sky; some brighter ones are 3-pixel crosses)
  for(let n=0;n<22;n++){const i=Math.floor(hash(n*3.7)*DW),j=Math.floor(hash(n*8.3)*(GY-16));if(Math.hypot(i-54,j-11)<9)continue;
    const tw=(Math.sin(t*(1.3+hash(n)*2)+n*1.7)+1)/2,b=n%5===0;x.fillStyle=tw>.75?'#ffffff':tw>.35?'#b9c2f0':'#6c70b0';x.fillRect(i,j,1,1);
    if(b&&tw>.6){x.fillStyle='#8f97d8';x.fillRect(i-1,j,1,1);x.fillRect(i+1,j,1,1);x.fillRect(i,j-1,1,1);x.fillRect(i,j+1,1,1)}}
  // wisps of cloud drifting across the sky
  [[8,.9,14],[26,.6,10]].forEach(([y,v,l],q)=>{const px=Math.round(((t*v*2+q*40)%(DW+l))-l);x.fillStyle='#3f3c80';x.fillRect(px,y,l,1);x.fillRect(px+3,y-1,l-6,1);x.fillStyle='#57529a';x.fillRect(px+2,y-1,l-9,1)});
  x.drawImage(S0.far,-4+Math.round(s*.5),0);x.drawImage(S0.near,-4+Math.round(s*.9),0);x.drawImage(S0.meadow,-4+cam,0);
  // grass behind the fence sways
  for(let n=0;n<26;n++){const i=Math.floor(n*2.9+hash(n)*2)+cam,j=GY-4+Math.floor(hash(n*4.1)*3),w=Math.round(Math.sin(t*1.6+i*.35));x.fillStyle=n%3?'#3f7d50':'#5a9a5e';x.fillRect(i,j-1,1,2);x.fillRect(i+w,j-2,1,1)}
  // the fence and its shadow
  x.fillStyle='rgba(10,20,30,.35)';x.fillRect(FX-12+cam,GY,24,1);x.fillRect(FX-10+cam,GY+1,21,1);
  x.drawImage(S0.fence,FX-13+cam,GY-16);
  return cam}
function frontGrass(x,t,cam){for(let n=0;n<16;n++){const i=Math.floor(n*4.6+hash(n*2.2)*3)+cam,j=DH-2-Math.floor(hash(n*6.6)*6),w=Math.round(Math.sin(t*1.9+i*.4+1));
  x.fillStyle=n%2?'#2f6a46':'#4a8a56';x.fillRect(i,j-2,1,3);x.fillRect(i+w,j-3,1,1);if(n%4===0){x.fillRect(i+1,j-1,1,2);x.fillRect(i+1+w,j-2,1,1)}}}
function draw(t){if(!cx||!ok)return;const x=cx;build();const lay=layers();if(!lay){x.drawImage(room,0,0);return}
  const wake=D.body.classList.contains('v6wake'),g=typeof S!=='undefined'&&S.shp,k=t*1000-reactAt<1500?1:0;
  if(wake&&!lastWake){lastWake=1;popAt=t*1000}else if(!wake)lastWake=0;
  x.imageSmoothingEnabled=false;x.globalCompositeOperation='source-over';x.globalAlpha=1;
  x.drawImage(room,0,0);
  // breathing: shoulder up to 2 px, quilt 1 px (a moment later), eased in and out
  const br=u=>(1-Math.cos(u/BREATH*TAU))/2,b=br(t),bq=br(t-.35);
  lift(x,lay.s,SHOULDER,Math.round(b*2));lift(x,lay.q,QUILT,Math.round(bq));
  const o=k?0:headShift(t);if(o)x.drawImage(lay.h,o,0);
  if(twitch(t))x.drawImage(lay.f,0,-1);
  face(x,k);
  // the lamp's glow flickers (a few steps a second)
  const fk=Math.floor(t*8),fl=.5+.25*Math.sin(fk*1.7)+.25*hash(fk);x.globalCompositeOperation='lighter';x.globalAlpha=(wake?.6:.75)+.25*fl;x.drawImage(S0.glow,0,0);x.globalCompositeOperation='source-over';x.globalAlpha=1;
  if(!wake){if(S0.done){
    // the dream: render the meadow, cut it to the window, put the cloud around it
    const s=sway(t);dx.clearRect(0,0,DW,DH);const cam=meadowScene(dx,t,s);
    for(let i=J.length-1;i>=0;i--)if(t*1000-J[i].b>3200)J.splice(i,1);
    J.forEach(j=>jumper(dx,j,t,cam));
    if(!J.length&&(!g||g.done)){const gr=Math.floor(t/2.2)%3!==0;const sp=S0.sheep[1][gr?'graze':'stand'];dx.drawImage(sp,14+cam,GY-sp.height+2)}
    frontGrass(dx,t,cam);
    dx.globalCompositeOperation='destination-in';dx.drawImage(WM,0,0);dx.globalCompositeOperation='source-over';
    const by=Math.round(Math.sin(t*1.2)*.6);x.drawImage(dream,DX,DY+by);x.drawImage(S0.cloud,0,by)}
    zs(x,t)}
  else{const pa=t*1000-popAt;if(pa<450&&S0.cloud){// the dream pops
      const r=1-pa/450;x.globalAlpha=Math.round(r*4)/4;x.drawImage(S0.cloud,WX*(1-r),WY*(1-r),W*r,H*r);x.globalAlpha=1;
      x.fillStyle='#f6f6ff';for(let n=0;n<10;n++){const a=n/10*TAU,d=10+pa/9;x.fillRect(Math.round(WX+Math.cos(a)*d*1.2),Math.round(WY+Math.sin(a)*d),2,2)}}
    x.fillStyle='rgba(255,214,120,.24)';x.fillRect(0,0,W,H)}
  if(k||wake)x.drawImage(S0.bang,84+(k?Math.round(Math.sin(t*30)):0),38)}
let WM=null;
function winMask(){const c=mk(DW,DH),x=c.getContext('2d'),im=x.createImageData(DW,DH);for(let j=0;j<DH;j++)for(let i=0;i<DW;i++)if(inWin(DX+i+.5,DY+j+.5))im.data[(j*DW+i)*4+3]=255;x.putImageData(im,0,0);return c}

/* ---------- the loop: only while on screen, visible and moving ---------- */
const live=()=>cv&&cv.isConnected&&vis&&!D.hidden&&!still();
function frame(now){raf=0;if(!cv||!cv.isConnected)return;draw(now/1000);if(live())raf=requestAnimationFrame(frame)}
function kick(){if(!cv||!ok)return;if(live()){if(!raf)raf=requestAnimationFrame(frame)}else{if(raf){cancelAnimationFrame(raf);raf=0}draw(stillT())}}
// a still frame: a calm breath, a jumper (if any) frozen over the fence
function stillT(){const n=performance.now();const j=J[J.length-1];if(j)return(j.b+1150)/1000;return n/1000}
function mount(){const c=D.querySelector('canvas.v6shc');if(c===cv)return;if(cv&&IO)IO.unobserve(cv);cv=c;if(!c){if(raf)cancelAnimationFrame(raf);raf=0;return}
  load();cx=c.getContext('2d');if(!dream){dream=mk(DW,DH);dx=dream.getContext('2d');WM=winMask()}vis=true;if(IO)IO.observe(c);
  if(ok){build();kick()}}
if(typeof IntersectionObserver==='function')IO=new IntersectionObserver(es=>es.forEach(e=>{if(e.target===cv){vis=e.isIntersecting;kick()}}));
D.addEventListener('visibilitychange',kick);
HWEvents.on('motion:changed',kick);
{const m=D.querySelector('#main');if(m&&typeof MutationObserver==='function')new MutationObserver(mount).observe(m,{childList:true,subtree:true})}
// the alarm's wake class changes the scene
if(typeof MutationObserver==='function')new MutationObserver(kick).observe(D.body,{attributes:true,attributeFilter:['class']});

/* ---------- the game: the original rules, the jumpers now drawn in the dream ---------- */
function add(wz){const sz=wz?1:Math.floor(Math.random()*3);J.push({b:performance.now(),wz:!!wz,s:sz,v:wz?38:[34,38,42][Math.floor(Math.random()*3)]});if(J.length>4)J.shift();kick()}
function react(){reactAt=performance.now();kick();if(still())setTimeout(kick,1600)}
const ico=(n,s,l)=>HWPixel.icon(n,l?{s:s||1,label:l}:s||1);
const scene=run=>'<div class="v6sh" id="'+(run?'shs':'shs0')+'"><canvas class="v6shc" width="'+W+'" height="'+H+'" role="img" aria-label="'
  +(run?'Dream: a hero sleeps in a cosy bedroom and dreams of sheep leaping a fence in a moonlit meadow':'A hero sleeps in a cosy bedroom, dreaming of a moonlit meadow')+'"></canvas>'
  +'<button class="v6shfs" data-a="shfs" aria-label="'+(full()?'Leave full screen':'Full screen dream')+'" title="'+(full()?'Leave full screen':'Full screen')+'">'+ico('expand')+'</button></div>';
sheepCard=function(){const g=S.shp,dn=(st.shd||{})[today()];let h;
  if(!g)h=scene(0)+'<p class="mut">Count sheep leaping over the fence for as long as you like. Keep an eye out for an unexpected jumper. Press DRIFT OFF when you are ready to rest.</p><button data-a="shst" class="v6shb">'+ico('sheep')+' START COUNTING SHEEP</button>'+(dn?'<small class="mut">Today\'s dream reward claimed ✓</small>':'');
  else if(g.done)h=scene(0)+'<p class="qcd">'+ico('sleep')+' SWEET DREAMS</p><p>You counted <b class="num">'+g.n+'</b> sheep'+(g.wz?' and spotted Medius leaping '+g.wz+'×':'')+'.'+(g.xp?' (+10 XP)':'')+'</p><button data-a="shst" class="v6shb">COUNT AGAIN</button>';
  else h=scene(1)+'<div class="ah v6shah"><b class="big" id="shn" aria-live="polite">'+g.n+'<small> sheep</small></b><small>'+ico('sleep')+' endless dream · <span id="sht">'+fmtT(g.t)+'</span></small></div><button data-a="shend" class="v6shb">DRIFT OFF '+ico('sleep')+'</button>';
  return '<div class="v6shw" id="v6shw">'+h+'</div>'};
shSpawn=function(){const g=S.shp,el=$('#shs');if(!g||g.done||!el){shStop();return}g.k++;const wz=g.k>=g.nx;if(wz){g.nx=g.k+rnd(8,12)}
  add(wz);
  setTimeout(()=>{if(S.shp!==g||g.done)return;g.n++;if(wz)g.wz++;const c=$('#shn');if(c){c.innerHTML=g.n+'<small> sheep</small>';c.classList.remove('v6shpop');void c.offsetWidth;c.classList.add('v6shpop')}
    if(st.s.sound)tn(wz?784:[523,587,659][g.n%3],.5,'sine',.035);if(wz){react();toast(ico('wizard')+' Was that… Medius?')}},1150)};
// the card header without its emoji
{const p=pages.sleep;pages.sleep=(...a)=>p(...a).replace('<h3>🐑 DREAM QUEST: COUNTING SHEEP</h3>','<h3>'+ico('sheep')+' DREAM QUEST: COUNTING SHEEP</h3>')}
// starting brings the whole scene, the counter and DRIFT OFF into view
{const a=acts.shst;acts.shst=(...x)=>{J.length=0;const r=a(...x);const w=D.getElementById('v6shw');if(w){const b=w.getBoundingClientRect(),n=D.querySelector('nav'),nb=n&&getComputedStyle(n).position==='fixed'?n.getBoundingClientRect():null,
    vb=nb&&nb.top>innerHeight/2?nb.top:innerHeight;if(b.top<0||b.bottom>vb)scrollBy({top:b.height>vb-16||b.top<0?b.top-8:b.bottom-vb+8,behavior:still()?'auto':'smooth'})}return r}}

/* ---------- full screen ---------- */
const fsEl=()=>D.fullscreenElement||D.webkitFullscreenElement||null;
function full(){return !!(fsEl()&&fsEl().id==='v6shw')||D.body.classList.contains('v6shfull')}
function paintFs(){const b=D.querySelector('.v6shfs');if(b){const f=full();b.setAttribute('aria-label',f?'Leave full screen':'Full screen dream');b.title=f?'Leave full screen':'Full screen'}kick()}
function leave(){D.body.classList.remove('v6shfull');const f=fsEl();if(f&&f.id==='v6shw'){try{(D.exitFullscreen||D.webkitExitFullscreen).call(D)}catch(e){}}paintFs()}
acts.shfs=()=>{if(full())return leave();const w=D.getElementById('v6shw');if(!w)return;const rq=w.requestFullscreen||w.webkitRequestFullscreen;
  const css=()=>{D.body.classList.add('v6shfull');paintFs()};
  if(rq){try{const p=rq.call(w);if(p&&p.then)p.then(paintFs,css);else paintFs()}catch(e){css()}}else css()};
D.addEventListener('fullscreenchange',paintFs);D.addEventListener('webkitfullscreenchange',paintFs);
D.addEventListener('keydown',e=>{if(e.key==='Escape'&&D.body.classList.contains('v6shfull'))leave()});
HWEvents.on('page:viewed',e=>{if(e&&e.view!=='sleep')leave()});

HWUI.css('sheep',`
.v6shw{scroll-margin:12px 0 84px}
.v6sh{position:relative;width:100%;max-width:calc((100vh - 210px) * 192 / 190);max-width:calc((100dvh - 210px) * 192 / 190);aspect-ratio:192/190;margin:0 auto 8px;border:4px solid var(--ln);background:#1a1520;overflow:hidden}
.v6shc{position:absolute;inset:0;width:100%;height:100%;display:block;image-rendering:pixelated;image-rendering:crisp-edges}
.v6shfs{position:absolute;right:6px;bottom:6px;z-index:2;min-width:40px;min-height:40px;padding:6px;display:flex;align-items:center;justify-content:center;background:rgba(20,16,40,.72);border:2px solid #f6edcf;box-shadow:none}
.v6shb{width:100%;display:flex;align-items:center;justify-content:center;gap:6px}
.v6shah small{display:inline-flex;align-items:center;gap:4px}
#shn{display:inline-block}#shn.v6shpop{animation:v6shpop .36s steps(4)}
@keyframes v6shpop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}
@media(max-width:760px){.v6sh{width:calc(100% + 24px);max-width:none;margin:0 -12px 8px;border-left:0;border-right:0}}
.v6shw:fullscreen,body.v6shfull .v6shw{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:12px 16px;background:#0d0b1a;color:#f6edcf}
.v6shw:fullscreen .v6sh,body.v6shfull .v6shw .v6sh{width:min(100%,calc((100vh - 140px) * 192 / 190));width:min(100%,calc((100dvh - 140px) * 192 / 190));max-width:none;margin:0 auto}
.v6shw:fullscreen>:not(.v6sh),body.v6shfull .v6shw>:not(.v6sh){width:min(100%,420px)}
body.v6shfull .v6shw{position:fixed;inset:0;z-index:85}
body.v6shfull{overflow:hidden}
@media(prefers-reduced-motion:reduce){#shn.v6shpop{animation:none}}
`);
return{add,react,mount,draw:t=>draw(t),get reacting(){return performance.now()-reactAt<1500},get jumpers(){return J.length},get ready(){return ok&&!!S0&&!!S0.done},get live(){return !!raf},get buildMs(){return S0&&S0.ms},full,leave}})();
