/* v6: The Ascent Monument's scene (HWMonumentScene), drawn for js/v6-monument.js. Not part of the original.
   A small isometric world in detailed pixel art with real depth, painted by code on one canvas (no library, no WebGL,
   so it also runs from the device and in the single-file build):
   * Every piece of the tower is a voxel: a cube drawn with its top, left (+y) and right (+x) faces, in a fixed 2:1
     isometric projection (8 x 8 pixel sprites, painter's order by x + y, then height). Faces hidden by a neighbour are
     not drawn. Each material has three hand-tuned tones (top, lit side, shaded side) and a texture worked out per pixel:
     mortar joints in running bond, edge highlights, arched glowing windows, roof tiles, grass fringes.
   * Light comes from the moon at the upper left (L = (-0.35, 0.6, 1)). Cast shadows are real: the ground shadow is the
     tower's own voxels projected along L onto the island, and a face is shaded when a ray towards the light meets a
     voxel. Ambient occlusion darkens inner corners and the faces under overhangs. Windows, lanterns and crystals glow.
   * Atmosphere: a dithered (4 x 4 Bayer) night sky, stars, two mountain ranges in fading haze, slow clouds, the moon,
     fireflies; the island floats, so the world has a ground plane and an underside.
   * The tower is a fixed design of six stages (STAGES in js/v6-monument.js); a stage's blocks are laid in a fixed
     order, so the drawing stays coherent at every amount of progress and never grows past ~1,100 voxels.
   * Construction: blocks not yet acknowledged appear as glowing markers, rise from the rune circle, travel to their
     place and lock in with a small flash (and a soft tone when the app's sound is on). Many new blocks are joined into a
     short catch-up wave. Skip, reduced motion, the Performance mode, a hidden tab or a scene scrolled off screen all
     stop the motion; the still picture is always the final state. Scaled by whole numbers (image-rendering: pixelated).
   The scene shows progress only: its drawn height is not a measurement. */
const HWMonumentScene=(()=>{
const VH=264,SC=2; // internal height in pixels, whole-number scale on screen

/* ---------- colour helpers ---------- */
const rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const sh=(c,k)=>c.map(v=>Math.max(0,Math.min(255,Math.round(v*k))));
const css=c=>'rgb('+c[0]+','+c[1]+','+c[2]+')';
const hash=(a,b,c,d)=>{let n=Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^Math.imul(c|0,1274126177)^Math.imul((d|0)+7,1103515245);
  n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296};
const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5].map(v=>(v+.5)/16);
const bay=(x,y)=>BAYER[(y&3)*4+(x&3)];

/* ---------- the voxel sprite: which face each of the 8 x 8 pixels belongs to, and where on the face it is ---------- */
const PX=[];// {f: 0 top | 1 left (+y) | 2 right (+x), u, v}
for(let py=0;py<8;py++)for(let px=0;px<8;px++){const cx=px+.5,cy=py+.5;let p=null;
  if(Math.abs(cx-4)/4+Math.abs(cy-2)/2<=1)p={f:0,u:((cx-4)/4+cy/2)/2,v:(cy/2-(cx-4)/4)/2};
  else if(cx<4&&cy>=2+cx/2&&cy<=6+cx/2)p={f:1,u:cx/4,v:(cy-2-cx/2)/4};
  else if(cx>=4&&cy>=4-(cx-4)/2&&cy<=8-(cx-4)/2)p={f:2,u:(cx-4)/4,v:(cy-4+(cx-4)/2)/4};
  if(p){p.x=px;p.y=py;PX.push(p)}}

/* ---------- materials: three tones (top, lit side, shaded side) and a texture ----------
   tex(face, u, v, variant, n) → colour; n is a per-pixel noise in [0, 1). em: glow colour (emissive). */
const M={};
const mat=(k,t,l,r,tex,em)=>{M[k]={k,c:[rgb(t),rgb(l),rgb(r)],tex,em:em?rgb(em):null}};
const near=(a,b,d)=>Math.abs(a-b)<d;
// stone: running-bond mortar on the sides, light back edges on the top
const stone=(f,u,v,w,n,c)=>{let x=c[f];
  if(f===0){if(u<.17||v<.17)x=sh(x,1.12);else if(u>.86||v>.86)x=sh(x,.9);return sh(x,.97+n*.07)}
  if(v>.8)return sh(x,.72);if(v<.2)x=sh(x,1.08);
  if((w&1)&&near(u,.375,.1))return sh(x,.76);if(!(w&1)&&near(u,.875,.1))return sh(x,.76);
  return sh(x,.95+n*.09)};
mat('stone','#d6d0e6','#a69dc2','#665e8a',stone);
mat('trim','#b2a7d1','#8479ab','#4c4372',stone);
mat('dark','#7d7398','#5c5379','#3a3352',stone);
mat('gold','#ffe08a','#f0b43c','#9a6414',(f,u,v,w,n,c)=>{const x=c[f];if(f===0)return u<.2||v<.2?rgb('#fff4c4'):x;return v<.25?sh(x,1.15):v>.8?sh(x,.78):x},'#f6c94f');
mat('win','#d6d0e6','#a69dc2','#665e8a',(f,u,v,w,n,c)=>{if(f===0)return stone(f,u,v,w,n,c);
  const inside=u>.2&&u<.8&&v>.22&&v<.92&&!(v<.42&&(u<.3||u>.7));
  if(!inside)return sh(c[f],v>.85?.75:1);return v<.5&&near(u,.5,.2)?rgb('#fff3c0'):f===1?rgb('#ffc94a'):rgb('#e89a2c')},'#ffc24a');
mat('door','#d6d0e6','#a69dc2','#665e8a',(f,u,v,w,n,c)=>{if(f===0)return stone(f,u,v,w,n,c);
  const inside=u>.12&&u<.88&&v>.15&&!(v<.35&&(u<.25||u>.75));
  if(!inside)return u<.12||u>.88?rgb('#f0b43c'):c[f];return near(u,.5,.12)&&v>.45?rgb('#ffcf6a'):rgb('#2a1838')},'#ffcf6a');
mat('roof','#8a6cf0','#6447c4','#3a2a7e',(f,u,v,w,n,c)=>{const x=c[f];if(f===0)return sh(x,u<.2||v<.2?1.15:1);
  const row=Math.floor(v*4);return (row&1)?sh(x,.82):(near(u,(row&2)?.25:.75,.12)?sh(x,.7):sh(x,1.05))});
mat('crystal','#c9fbff','#5fd8ef','#2b8fb8',(f,u,v,w,n,c)=>{const x=c[f];return (f===0&&near(u,.4,.15)&&near(v,.4,.15))||(f===1&&v<.25&&u<.4)?rgb('#ffffff'):sh(x,.95+n*.1)},'#7ff0ff');
mat('banner','#e45b6a','#c23a4c','#7d1e30',(f,u,v,w,n,c)=>{const x=c[f];if(f===0)return x;if(v>.78)return f===1?rgb('#f6c94f'):rgb('#a8741a');return near(u,.5,.13)&&v>.3&&v<.6?sh(x,1.25):x});
mat('glow','#fff3c0','#ffcf6a','#d18a2a',(f,u,v,w,n,c)=>c[f],'#ffd76a');
mat('grass','#5bbf62','#7b5136','#4f3122',(f,u,v,w,n,c)=>{if(f===0){const g=c[0];return n<.12?sh(g,1.18):n>.9?sh(g,.82):(w&1)&&n>.7?rgb('#7fd36a'):g}
  if(v<.28-(n*.12))return f===1?rgb('#4aa352'):rgb('#2f7a3c');return n>.88?sh(c[f],1.2):sh(c[f],.94+n*.08)});
mat('path','#c9b89a','#7b5136','#4f3122',(f,u,v,w,n,c)=>{if(f===0)return u<.12||v<.12?sh(c[0],.8):sh(c[0],.95+n*.1);return sh(c[f],.94+n*.08)});
mat('dirt','#8a5a3c','#7b5136','#4f3122',(f,u,v,w,n,c)=>n>.9?rgb('#a4744c'):n<.06?sh(c[f],.7):sh(c[f],.94+n*.08));
mat('rock','#5a4a6e','#40334f','#241c33',(f,u,v,w,n,c)=>n>.85?sh(c[f],1.18):sh(c[f],.92+n*.1));
mat('wood','#9a6a44','#7a4e30','#4d301d',(f,u,v,w,n,c)=>f>0&&near(u,(w&1)?.3:.7,.1)?sh(c[f],.78):c[f]);
mat('leaf','#55b860','#3c9150','#245e38',(f,u,v,w,n,c)=>{const x=c[f];return n>.82?sh(x,1.22):n<.18?sh(x,.8):x});
mat('water','#63c7f0','#3c8fd0','#245a96',(f,u,v,w,n,c)=>f===0&&n>.9?rgb('#e8fbff'):f===0&&n>.6?rgb('#7fd6f6'):c[f]);
const MK=Object.keys(M),MI=Object.fromEntries(MK.map((k,i)=>[k,i]));

/* ---------- sprite atlas: one 8 x 8 tile per material x face x variant; overlays for shadow and occlusion ---------- */
let ATL=null,OVL=null;
function atlas(){if(ATL)return;ATL=document.createElement('canvas');ATL.width=32;ATL.height=MK.length*24;const g=ATL.getContext('2d'),im=g.createImageData(32,ATL.height),D=im.data;
  MK.forEach((k,mi)=>{const m=M[k];for(let w=0;w<4;w++)PX.forEach(p=>{const n=hash(p.x,p.y,w,mi),c=m.tex(p.f,p.u,p.v,w,n,m.c),X=w*8+p.x,Y=(mi*3+p.f)*8+p.y,i=(Y*32+X)*4;
    D[i]=c[0];D[i+1]=c[1];D[i+2]=c[2];D[i+3]=255})});
  g.putImageData(im,0,0);
  // overlays, one 8 x 8 tile each: 0-2 cast shadow on top/left/right; 3 AO top-back-left; 4 AO top-back-right; 5 AO left top;
  // 6 AO right top; 7 AO left inner edge; 8 AO right inner edge; 9 contact shade (both sides, bottom); 10 white flash; 11 marker outline
  OVL=document.createElement('canvas');OVL.width=96;OVL.height=8;const o=OVL.getContext('2d'),oi=o.createImageData(96,8),O=oi.data;
  const put=(t,x,y,c,a)=>{const i=(y*96+t*8+x)*4;O[i]=c[0];O[i+1]=c[1];O[i+2]=c[2];O[i+3]=a};
  const SH=[16,10,40],K=[8,4,20];
  PX.forEach(p=>{
    put(p.f,p.x,p.y,SH,p.f===0?96:p.f===1?84:60);
    if(p.f===0&&p.u<.3)put(3,p.x,p.y,K,70);if(p.f===0&&p.v<.3)put(4,p.x,p.y,K,70);
    if(p.f===1&&p.v<.32)put(5,p.x,p.y,K,80);if(p.f===2&&p.v<.32)put(6,p.x,p.y,K,80);
    if(p.f===1&&p.u<.28)put(7,p.x,p.y,K,70);if(p.f===2&&p.u>.72)put(8,p.x,p.y,K,70);
    if(p.f>0&&p.v>.72)put(9,p.x,p.y,K,60);
    put(10,p.x,p.y,[255,250,220],210)});
  // the marker: the block's outline only
  const edge=new Set(PX.map(p=>p.x+','+p.y)),on=(x,y)=>edge.has(x+','+y);
  PX.forEach(p=>{if(!on(p.x-1,p.y)||!on(p.x+1,p.y)||!on(p.x,p.y-1)||!on(p.x,p.y+1))put(11,p.x,p.y,[255,224,138],255)});
  o.putImageData(oi,0,0)}
// a soft dithered glow, drawn with 'lighter'
const GL={};
function glow(c,r){const key=c.join()+r;if(GL[key])return GL[key];const s=r*2+1,cv=document.createElement('canvas');cv.width=cv.height=s;const g=cv.getContext('2d'),im=g.createImageData(s,s),D=im.data;
  for(let y=0;y<s;y++)for(let x=0;x<s;x++){const d=Math.hypot(x-r,y-r)/r;if(d>1)continue;const a=(1-d)*(1-d);if(a<bay(x,y)*.9)continue;const i=(y*s+x)*4;D[i]=c[0];D[i+1]=c[1];D[i+2]=c[2];D[i+3]=Math.round(40+150*a)}
  g.putImageData(im,0,0);return GL[key]=cv}

/* ---------- the world: island, decoration and the tower (bounded, fixed order) ---------- */
const key=(x,y,z)=>((x+64)*128+(y+64))*128+(z+16);
const B=(x,y,z,m)=>({x,y,z,m});
function islandBlocks(){const L=[];
  for(let x=-10;x<=10;x++)for(let y=-10;y<=10;y++){const a=Math.atan2(y,x),d=Math.hypot(x,y),r=9.3+.55*Math.sin(a*3+.6)+.35*Math.sin(a*5),j=hash(x,y,3,1);
    if(d>r)continue;const top=(x===0&&y>=6)||(y===5&&Math.abs(x)<=1)?'path':(x>=4&&x<=6&&y>=-3&&y<=-1&&!(x===6&&y===-3))?'water':'grass';
    L.push(B(x,y,-1,top));if(d<=r-1.1)L.push(B(x,y,-2,'dirt'));[2.2,3.6,5,6.3,7.6].forEach((k,i)=>{if(d<=r-k-j*1.4)L.push(B(x,y,-3-i,'rock'))})}
  return L}
function decoBlocks(){const L=[],tree=(x,y,h)=>{for(let z=0;z<h;z++)L.push(B(x,y,z,'wood'));
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){L.push(B(x+dx,y+dy,h,'leaf'));if(Math.abs(dx)+Math.abs(dy)<2)L.push(B(x+dx,y+dy,h+1,'leaf'))}L.push(B(x,y,h+2,'leaf'))};
  tree(-7,-2,2);tree(-3,-8,3);tree(5,-7,2);tree(-7,3,2);
  [[2,7],[-2,7],[7,2]].forEach(p=>{L.push(B(p[0],p[1],0,'dark'));L.push(B(p[0],p[1],1,'glow'))}); // lanterns along the path
  L.push(B(7,-4,0,'rock'),B(-5,7,0,'rock'),B(-8,0,0,'rock'));
  return L}
/** The tower, stage by stage; each stage bottom-up, ring by ring from the front. */
const STAGE_NAMES=['Foundation','First Ascent','Rising Keep','High Citadel','Grand Monument','Skyward Spire'];
let TOWER=null;
function tower(){if(TOWER)return TOWER;const S=[[],[],[],[],[],[]],add=(s,x,y,z,m)=>S[s].push(B(x,y,z,m));
  const ring=(s,r,z,m,f)=>{for(let x=-r;x<=r;x++)for(let y=-r;y<=r;y++)if(Math.max(Math.abs(x),Math.abs(y))===r){const mm=f?f(x,y,z):m;if(mm)add(s,x,y,z,mm)}};
  const slab=(s,r,z,m)=>{for(let x=-r;x<=r;x++)for(let y=-r;y<=r;y++)add(s,x,y,z,m)};
  // 0 Foundation: two plinths, the front steps and four lantern posts
  slab(0,4,0,'trim');slab(0,3,1,'stone');for(let x=-1;x<=1;x++){add(0,x,5,0,'stone');add(0,x,4,1,'stone')}
  [[4,4],[4,-4],[-4,4],[-4,-4]].forEach(p=>{add(0,p[0],p[1],1,'dark');add(0,p[0],p[1],2,'glow')});
  // 1 First Ascent: the hall (7 x 7), an arched door, windows, buttresses, the cornice and its floor
  for(let z=2;z<=6;z++)ring(1,3,z,null,(x,y)=>{
    if(y===3&&Math.abs(x)<=1&&z<=3)return null;if(y===3&&Math.abs(x)<=1&&z===4)return'trim';
    if(x===3&&z===4&&!(y&1))return'win';if(y===3&&z===5&&Math.abs(x)===2)return'win';
    return Math.abs(x)===3&&Math.abs(y)===3?'trim':'stone'});
  add(1,0,2,2,'door');add(1,0,2,3,'door');add(1,-1,2,2,'trim');add(1,1,2,2,'trim');add(1,-1,2,3,'trim');add(1,1,2,3,'trim');
  [[4,-2],[4,2],[-2,4],[2,4],[-4,-2],[-4,2],[-2,-4],[2,-4]].forEach(p=>{for(let z=1;z<=4;z++)add(1,p[0],p[1],z,z===4?'trim':'stone')});
  ring(1,4,7,'trim');slab(1,3,7,'stone');
  // 2 Rising Keep: the keep (5 x 5) with quoins and windows, a projecting walkway, corner turrets, its cornice
  for(let z=8;z<=17;z++){ring(2,2,z,null,(x,y)=>{if(x===2&&y===0&&(z===10||z===13||z===16))return'win';if(y===2&&x===0&&(z===11||z===14))return'win';
      if(x===-2&&y===0&&z===12)return'win';return Math.abs(x)===2&&Math.abs(y)===2?'trim':'stone'});
    if(z<=11)[[4,4],[4,-4],[-4,4],[-4,-4]].forEach(p=>add(2,p[0],p[1],z,z===11?'roof':z===10?'win':'stone'));
    if(z===12)ring(2,3,12,'trim')}
  ring(2,3,18,'trim');slab(2,2,18,'stone');
  // 3 High Citadel: the keep rises, balconies with golden rails, flying buttresses, the upper cornice
  for(let z=19;z<=26;z++){ring(3,2,z,null,(x,y)=>{if(x===2&&Math.abs(y)===1&&(z===20||z===24))return'win';if(y===2&&x===0&&(z===21||z===25))return'win';
      return Math.abs(x)===2&&Math.abs(y)===2?'trim':'stone'});
    if(z<=20)[[3,3],[3,-3],[-3,3],[-3,-3]].forEach(p=>add(3,p[0],p[1],z,'stone'));
    if(z===22){for(let i=-1;i<=1;i++){add(3,3,i,22,'trim');add(3,i,3,22,'trim')}}
    if(z===23){for(let i=-1;i<=1;i++){add(3,4,i,23,'gold');add(3,i,4,23,'gold')}}}
  ring(3,3,27,'trim');slab(3,2,27,'stone');
  // 4 Grand Monument: the upper chamber with tall windows, banners, crenellations and four turrets
  for(let z=24;z<=26;z++){add(4,3,-2,z,'banner');add(4,3,2,z,'banner');add(4,-2,3,z,'banner');add(4,2,3,z,'banner')}
  for(let z=28;z<=31;z++){ring(4,2,z,null,(x,y)=>{if((x===2&&y===0||y===2&&x===0)&&(z===29||z===30))return'win';return Math.abs(x)===2&&Math.abs(y)===2?'gold':'stone'});
    [[3,3],[3,-3],[-3,3],[-3,-3]].forEach(p=>add(4,p[0],p[1],z,z===30?'win':'trim'))}
  ring(4,3,32,null,(x,y)=>Math.abs(x)===3&&Math.abs(y)===3?'roof':((x+y)&1)?null:'trim');slab(4,2,32,'stone');
  // 5 Skyward Spire: tiers of roof, a golden ring, the crystal finial
  slab(5,2,33,'roof');for(let z=34;z<=37;z++)slab(5,1,z,z===36?'gold':'roof');
  for(let z=38;z<=43;z++)add(5,0,0,z,z===40?'gold':'roof');add(5,0,0,44,'crystal');add(5,0,0,45,'crystal');add(5,1,0,43,'banner');add(5,2,0,43,'banner');
  const order=(a,b)=>a.z-b.z||Math.atan2(b.x,b.y)-Math.atan2(a.x,a.y); // bottom-up; within a layer, round from the front
  TOWER=S.map(L=>L.sort(order));return TOWER}
const counts=()=>tower().map(L=>L.length);
const FLAT=()=>[].concat(...tower());

/* ---------- drawing ---------- */
const proj=(x,y,z)=>[(x-y)*4,(x+y)*2-z*4]; // top vertex of the block's top face, relative to the origin
const LV=[-.35,.6,1];
function shadowed(occ,px,py,pz,top){for(let t=.35;t<top-pz+1;t+=.35){if(occ.has(key(Math.floor(px+LV[0]*t),Math.floor(py+LV[1]*t),Math.floor(pz+t))))return true}return false}
function drawBlock(g,b,ox,oy,occ,top,light){const m=MI[b.m],w=hash(b.x,b.y,b.z,0)*4|0,[sx,sy]=proj(b.x,b.y,b.z),X=ox+sx-4,Y=oy+sy;
  const has=(x,y,z)=>occ.has(key(x,y,z));
  const T=!has(b.x,b.y,b.z+1),L=!has(b.x,b.y+1,b.z),R=!has(b.x+1,b.y,b.z);if(!T&&!L&&!R)return;
  const face=(f,on)=>{if(on)g.drawImage(ATL,w*8,(m*3+f)*8,8,8,X,Y,8,8)};
  const ov=t=>g.drawImage(OVL,t*8,0,8,8,X,Y,8,8);
  face(0,T);face(1,L);face(2,R);
  if(!light)return;
  if(T&&b.z>=0&&shadowed(occ,b.x+.5,b.y+.5,b.z+1.02,top))ov(0);
  if(L&&b.z>=0&&shadowed(occ,b.x+.5,b.y+1.02,b.z+.5,top))ov(1);
  if(T&&(has(b.x-1,b.y,b.z+1)))ov(3);if(T&&has(b.x,b.y-1,b.z+1))ov(4);
  if(L&&has(b.x,b.y+1,b.z+1))ov(5);if(R&&has(b.x+1,b.y,b.z+1))ov(6);
  if(L&&has(b.x-1,b.y+1,b.z))ov(7);if(R&&has(b.x+1,b.y-1,b.z))ov(8);
  if(b.z===0&&(L||R))ov(9)}
const sortB=(a,b)=>(a.x+a.y)-(b.x+b.y)||a.z-b.z;
// cache sizes: the world canvas holds everything from the island's underside to above the spire
const WW=176,WH=264,WOX=88,WOY=214;
let ISL=null,DECO=null,ISLOCC=null;
function islandCanvas(){if(ISL)return ISL;atlas();const I=islandBlocks().sort(sortB);ISLOCC=new Set(I.map(b=>key(b.x,b.y,b.z)));DECO=decoBlocks();
  ISL=document.createElement('canvas');ISL.width=WW;ISL.height=WH;const g=ISL.getContext('2d');I.forEach(b=>drawBlock(g,b,WOX,WOY,ISLOCC,0,false));
  // the island's top surface as a mask, so the cast shadow stays on the ground
  ISL.mask=document.createElement('canvas');ISL.mask.width=WW;ISL.mask.height=WH;const mg=ISL.mask.getContext('2d');
  I.filter(b=>b.z===-1).forEach(b=>{const[sx,sy]=proj(b.x,b.y,b.z);mg.drawImage(ATL,0,(MI.stone*3)*8,8,8,WOX+sx-4,WOY+sy,8,8)});
  return ISL}
/** The world with the first `n` tower blocks in place → a canvas (WW x WH). */
function world(n,cv){islandCanvas();const T=FLAT().slice(0,n),all=DECO.concat(T),occ=new Set(ISLOCC);all.forEach(b=>occ.add(key(b.x,b.y,b.z)));
  const top=all.reduce((a,b)=>Math.max(a,b.z),1);
  cv=cv||document.createElement('canvas');cv.width=WW;cv.height=WH;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,WW,WH);g.drawImage(ISL,0,0);
  // the ground shadow: every voxel projected along the light onto the island
  const sc=document.createElement('canvas');sc.width=WW;sc.height=WH;const s=sc.getContext('2d');s.fillStyle='#000';
  all.forEach(b=>{for(const h of [b.z,b.z+.5,b.z+1]){const gx=b.x-LV[0]*h,gy=b.y-LV[1]*h,sx=Math.round((gx-gy)*4),sy=Math.round((gx+gy)*2);
    s.beginPath();s.moveTo(WOX+sx,WOY+sy);s.lineTo(WOX+sx+4,WOY+sy+2);s.lineTo(WOX+sx,WOY+sy+4);s.lineTo(WOX+sx-4,WOY+sy+2);s.closePath();s.fill()}});
  s.globalCompositeOperation='destination-in';s.drawImage(ISL.mask,0,0);
  g.globalAlpha=.42;g.drawImage(sc,0,0);g.globalAlpha=1;
  all.sort(sortB).forEach(b=>drawBlock(g,b,WOX,WOY,occ,top,true));
  cv.emit=all.filter(b=>M[b.m].em).map(b=>{const[sx,sy]=proj(b.x,b.y,b.z);return{x:WOX+sx,y:WOY+sy+4,c:M[b.m].em,r:b.m==='crystal'?9:b.m==='gold'?0:6,ph:hash(b.x,b.y,b.z,9)*6.28}}).filter(e=>e.r);
  cv.top=top;return cv}

/* ---------- the sky (cached per size) ---------- */
function sky(W,H){const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d'),im=g.createImageData(W,H),D=im.data;
  const stops=[[0,rgb('#0a0920')],[.35,rgb('#16123d')],[.62,rgb('#2b2163')],[.8,rgb('#4a2f7c')],[1,rgb('#2f5f86')]];
  const col=t=>{for(let i=1;i<stops.length;i++)if(t<=stops[i][0]){const a=stops[i-1],b=stops[i],k=(t-a[0])/(b[0]-a[0]);return[a[1],b[1],k]}return[stops[4][1],stops[4][1],0]};
  for(let y=0;y<H;y++){const[a,b,k]=col(y/H);for(let x=0;x<W;x++){const c=k>bay(x,y)?b:a,i=(y*W+x)*4;D[i]=c[0];D[i+1]=c[1];D[i+2]=c[2];D[i+3]=255}}
  // stars: fixed, brighter near the top
  for(let i=0;i<W*H/170;i++){const x=hash(i,1,2,3)*W|0,y=(hash(i,4,5,6)**1.6)*H*.7|0,j=(y*W+x)*4,b=hash(i,7,8,9);D[j]=D[j+1]=D[j+2]=b>.85?255:170+b*70}
  g.putImageData(im,0,0);
  // the moon, upper left (the light source)
  const mx=Math.round(W*.16),my=30;for(let y=-8;y<=8;y++)for(let x=-8;x<=8;x++){const d=Math.hypot(x,y);if(d>7.6)continue;
    const c=d>6.4?'#e8d9a8':(hash(x,y,1,1)>.86||(Math.hypot(x+2,y+1)<1.6))?'#e2d2a0':x+y<-3?'#fffaf0':'#fff2c8';g.fillStyle=c;g.fillRect(mx+x,my+y,1,1)}
  g.globalCompositeOperation='lighter';g.drawImage(glow([90,80,60],16),mx-16,my-16);g.globalCompositeOperation='source-over';
  // two mountain ranges, the far one hazier
  const range=(base,amp,seed,c,haze)=>{for(let x=0;x<W;x++){const h=Math.round(base-amp*(.55*Math.abs(Math.sin(x*.021+seed))+.3*Math.abs(Math.sin(x*.057+seed*2))+.15*hash(x>>2,seed|0,1,1)));
      for(let y=h;y<H;y++){g.fillStyle=haze&&((y-h)<3)&&bay(x,y)>.5?css(mix(c,rgb('#6a5aa8'),.4)):css(c);g.fillRect(x,y,1,1)}}};
  range(H*.66,46,1.3,rgb('#2a2459'),1);range(H*.76,34,4.1,rgb('#1b173f'),0);
  // a sea of cloud below the floating island, lit from above
  for(let x=0;x<W;x++){const top=Math.round(H*.84+3*Math.sin(x*.09)+2*Math.sin(x*.23+1));
    for(let y=top;y<H;y++){const d=y-top,c=d<2?'#a497d8':d<5&&bay(x,y)>.45?'#8578c0':d<9&&bay(x,y)>.7?'#7466b0':'#5e5299';g.fillStyle=c;g.fillRect(x,y,1,1)}}
  return cv}
function cloud(seed){const cv=document.createElement('canvas');cv.width=40;cv.height=12;const g=cv.getContext('2d');
  for(let y=0;y<12;y++)for(let x=0;x<40;x++){const d=Math.hypot((x-20)/20,(y-7)/5)+.25*Math.sin(x*.5+seed)*.5;if(d>1)continue;if((1-d)*1.4<bay(x,y))continue;g.fillStyle=y<6?'#8b7fc4':'#5d528f';g.fillRect(x,y,1,1)}return cv}

/* ---------- the running scene ---------- */
const reduced=()=>typeof HWUI!=='undefined'?HWUI.reduced():false;
const perf=()=>document.documentElement.classList.contains('hw-q-performance');
let cur=null;
/** Put the scene in `host`. o = {from, to (block counts), aura (0 | 1 | 2), onDone(skipped)}. Returns {skip, stop}. */
function mount(host,o){if(cur&&cur.host===host&&cur.to===o.to)return cur;stop();atlas();
  const cv=document.createElement('canvas');let g=null;try{g=cv.getContext('2d')}catch(e){}
  if(!g){host.classList.add('mnfail');if(o.onDone)o.onDone(true);return null}
  cv.className='mncv';cv.setAttribute('aria-hidden','true');host.prepend(cv);
  const W=Math.max(140,Math.floor((host.clientWidth||320)/SC)),H=VH;cv.width=W;cv.height=H;cv.style.width=W*SC+'px';cv.style.height=H*SC+'px';g.imageSmoothingEnabled=false;
  const SKY=sky(W,H+24),CL=[cloud(1),cloud(2.4),cloud(4)],ox=Math.floor(W/2)-WOX,oy=H-50-WOY;
  const n0=Math.max(0,Math.min(o.from,o.to)),n1=o.to,F=FLAT(),still=reduced()||n1===n0;
  // the build plan: the last 48 new blocks fly in one by one; any before them rise together in one catch-up wave
  const NEW=n1-n0,solo=Math.min(NEW,48),wave=NEW-solo,dt=solo?Math.max(.09,Math.min(.4,3.6/solo)):0,T0=.9,TW=wave?1.4:0,TEND=T0+TW+solo*dt+1.1;
  const s={host,to:n1,cv,g,W,H,t0:o.t0||performance.now(),placed:still?n1:n0,world:null,done:still,raf:0,vis:true,flash:[],dust:[],last:0};
  s.world=world(s.placed);
  const spawn=[-4,6,0];
  const finish=skipped=>{if(s.finished)return;s.finished=true;s.done=true;if(s.placed!==n1){s.placed=n1;s.world=world(n1,s.world)}s.flash=[];if(o.onDone)o.onDone(!!skipped);draw(performance.now())};
  const tone=()=>{const n=performance.now();if(n-(s.tn||0)<140)return;s.tn=n;try{if(st.s.sound&&typeof tn==='function')tn(660+Math.random()*60,.09,'sine',.018)}catch(e){}};
  function blockAt(i,t){// where block i is at time t (seconds): null = still waiting, 1 = in place
    const j=i-n0-wave,ts=T0+TW+j*dt,k=(t-ts)/.75;return k>=1?1:k<-.5?null:{k}}
  function draw(now){const t=(now-s.t0)/1000;g.clearRect(0,0,W,H);
    // camera: arrives from slightly below and settles (whole pixels); none when still
    const cam=s.done||still?0:Math.round(18*Math.max(0,1-t/1.3)**2);
    g.drawImage(SKY,0,-Math.round(12+cam*.3));
    CL.forEach((c,i)=>{const x=Math.round(((t*(1.2+i*.5)+i*97)%(W+40))-40),y=24+i*22;g.drawImage(c,x,y)});
    g.drawImage(s.world,ox,oy+cam);
    // glow from windows, lanterns and crystals
    g.globalCompositeOperation='lighter';
    (s.world.emit||[]).forEach(e=>{const a=s.done&&!still&&!perf()?.75+.25*Math.sin(t*1.7+e.ph):.85;g.globalAlpha=a;g.drawImage(glow(e.c,e.r),ox+e.x-e.r,oy+cam+e.y-e.r)});
    g.globalAlpha=1;
    if(o.aura){const[sx,sy]=proj(0,0,46),bx=ox+WOX+sx,by=oy+cam+WOY+sy;for(let y=0;y<by;y++){const a=(y/by)*(.35+.15*Math.sin(t*2+y*.1))*(o.aura>1?1.4:1);if(a>bay(bx,y)){g.fillStyle='rgba(127,240,255,.55)';g.fillRect(bx-1,y,3,1)}}
      g.drawImage(glow([90,220,240],14),bx-14,by-14)}
    // fireflies (not in the reduced or performance modes)
    if(!still&&!perf()){g.fillStyle='#fff3a0';for(let i=0;i<10;i++){const a=t*.4+i*1.9,x=ox+WOX+Math.round(Math.cos(a+i)*(30+i*4)),y=oy+cam+WOY-6-Math.round(Math.abs(Math.sin(a*1.3+i))*14+i);if(Math.sin(t*3+i*2)>-.2)g.fillRect(x,y,1,1)}}
    g.globalCompositeOperation='source-over';
    if(!s.done){// the rune circle the stones rise from
      const[rx,ry]=proj(spawn[0]+.5,spawn[1]+.5,0),cx=ox+WOX+rx,cy=oy+cam+WOY+ry;g.fillStyle='#ffe08a';
      for(let a=0;a<6.28;a+=.22){const x=Math.round(cx+Math.cos(a+t)*7),y=Math.round(cy+Math.sin(a+t)*3.5);if(bay(x,y)<.8)g.fillRect(x,y,1,1)}
      let lock=false;
      // 1. the catch-up wave: older new stones are laid lowest first, a few at a time, each with a spark
      if(wave&&s.placed<n0+wave&&t>=T0){const k=Math.min(1,(t-T0)/TW),want=n0+Math.ceil(wave*(1-(1-k)**2));
        if(want>s.placed&&(now-(s.wv||0)>90||k>=1)){s.flash.push({b:F[want-1],t});s.placed=want;s.wv=now;lock=true}}
      // 2. the last stones one by one: a marker glows where each will go, then it rises from the circle and locks in
      for(let i=Math.max(s.placed,n0+wave);i<n1;i++){const b=F[i],p=blockAt(i,t);
        if(p===1){if(i===s.placed){s.placed=i+1;lock=true;s.flash.push({b,t});tone()}continue}
        if(!p)break;const[tx,ty]=proj(b.x,b.y,b.z),X=ox+WOX+tx-4,Y=oy+cam+WOY+ty;
        if(Math.sin(t*12)>-.3)g.drawImage(OVL,88,0,8,8,X,Y,8,8);
        if(p.k<0)continue;const e=1-(1-p.k)**3,lift=Math.sin(p.k*Math.PI)*26,x=Math.round(cx-4+(X-cx+4)*e),y=Math.round(cy-8+(Y-cy+8)*e-lift);
        const m=MI[b.m];g.drawImage(glow([255,214,120],7),x-3,y-3);for(let f=0;f<3;f++)g.drawImage(ATL,0,(m*3+f)*8,8,8,x,y,8,8)}
      if(lock)s.world=world(s.placed,s.world);
      // lock flashes and dust
      s.flash=s.flash.filter(f=>t-f.t<.18);s.flash.forEach(f=>{const[tx,ty]=proj(f.b.x,f.b.y,f.b.z);g.drawImage(OVL,80,0,8,8,ox+WOX+tx-4,oy+cam+WOY+ty,8,8)});
      if(t>=TEND)finish(false)}
  }
  function loop(now){if(!cv.isConnected){stop();return}s.raf=requestAnimationFrame(loop);if(!s.vis||document.hidden)return;
    if(now-s.last<33)return;s.last=now;draw(now);if(s.done&&(reduced()||perf()))cancelAnimationFrame(s.raf)}
  try{s.io=new IntersectionObserver(E=>{s.vis=E.some(e=>e.isIntersecting)});s.io.observe(cv)}catch(e){}
  s.skip=()=>finish(true);s.stop=()=>{cancelAnimationFrame(s.raf);if(s.io)s.io.disconnect()};
  if(still){s.finished=true;draw(performance.now());if(o.onDone)o.onDone(false);if(!reduced()&&!perf())s.raf=requestAnimationFrame(loop)}
  else s.raf=requestAnimationFrame(loop);
  cur=s;return s}
function stop(){if(cur){cur.stop();cur=null}}
return{mount,stop,counts,STAGE_NAMES,skipNow:()=>{if(cur&&!cur.done)cur.skip()},get running(){return!!(cur&&!cur.done)}}})();
