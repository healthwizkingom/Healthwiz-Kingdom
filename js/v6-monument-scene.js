/* v6: The Ascent Monument's scene (HWMonumentScene), drawn for js/v6-monument.js. Not part of the original.
   An endless Tower of Babel in detailed pixel art with real depth, painted by code on one canvas (no library, no WebGL,
   so it also runs from the device and in the single-file build):
   * The tower is a spiral stair that never ends: one stair stone for every 0.25 m of the player's verified ascent, winding
     round a stepped core (wide terraces for the first turns, then a slender core for ever), 8 levels a turn, with the
     core wall rising behind each stone and an arcade every turn. Its geometry is worked out from a stone's number,
     so a tower of any height costs the same: only the slice in view is generated and drawn (bounded work per frame).
   * Colour bands record the climb: sandstone, then marble, lapis and gold, crystal and starlight from the stone where
     the ascent passed each era's landmark (o.eras); a gold stone and a banner mark where each landmark was passed (o.marks).
   * Every piece is a voxel drawn with its top, left (+y) and right (+x) faces in a 2:1 isometric projection (8 x 8 sprites,
     painter's order by x + y, then height); hidden faces are skipped. Each material has three tones and a per-pixel texture.
   * Light comes from the moon at the upper left (L = (-0.35, 0.6, 1)): faces are shaded when a ray to the light meets a
     voxel, the ground shadow is the tower projected along L, ambient occlusion darkens inner corners and overhangs, and
     windows, lanterns and crystal glow.
   * The camera follows the top of the stair. Low down the tower stands on a floating island; higher up the land sinks away
     and the lower turns fade into a cloud bank. Dithered night sky, stars, moon, mountains in haze, drifting clouds.
   * Construction: stones not yet acknowledged are carried up and lock in at the top (a soft tone when Sound is on); many
     are joined into one catch-up climb with the camera rising along. The next stones always wait as glowing outlines.
     Skip, reduced motion, the Performance mode, a hidden tab or the scene off screen stop the motion; the still picture
     is the final state. Scaled by whole numbers (image-rendering: pixelated).
   The scene shows progress only: its drawn height is a symbol of the ascent, not a measurement. */
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
/* ---------- the endless tower: a spiral stair around a stepped core ----------
   One stair stone for every CELL metres of verified ascent. The stair winds round the core, rising T levels a turn; the core
   wall rises with it (T - 1 levels of headroom above each step) and carries an arcade every turn. The first turns are
   wide terraces (core radius RC), then the stair climbs a slender core for ever. Everything is worked out from the stone's
   number, so a tower of any height needs no stored geometry, and only the slice in view is ever drawn. */
const CELL=.25,T=8,RC=[5,5,4,4,3],GROUND=214,MARGIN=112;
const RINGS={};
/** The ring of cells at Chebyshev radius R (square), or the stair ring (corners cut), in order round from the front. */
function ring(R,cut){const k=R+(cut?'c':'');if(RINGS[k])return RINGS[k];const L=[];
  for(let x=-R;x<=R;x++)for(let y=-R;y<=R;y++)if(Math.max(Math.abs(x),Math.abs(y))===R&&!(cut&&Math.abs(x)===R&&Math.abs(y)===R))
    L.push({x,y,a:((Math.atan2(y,x)-Math.PI/2)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)});
  return RINGS[k]=L.sort((p,q)=>p.a-q.a)}
const REV=[];
/** Turn j of the stair: core radius, stair ring, stones per turn P, first stone n, base level. */
function rev(j){while(REV.length<=j&&REV.length<RC.length){const k=REV.length,p=REV[k-1],Rc=RC[k],S=ring(Rc+1,1);REV.push({j:k,Rc,S,P:S.length,n:p?p.n+p.P:0,base:1+k*T})}
  if(j<REV.length)return REV[j];const L=REV[REV.length-1],d=j-L.j;return{j,Rc:L.Rc,S:L.S,P:L.P,n:L.n+d*L.P,base:L.base+d*T}}
function revOf(n){rev(RC.length-1);for(const r of REV)if(n<r.n+r.P)return r;const L=REV[REV.length-1];return rev(L.j+Math.floor((n-L.n)/L.P))}
const stepZ=(r,i)=>r.base+Math.floor(i*T/r.P);
function stoneAt(n){const r=revOf(n),i=n-r.n,c=r.S[i];return{x:c.x,y:c.y,z:stepZ(r,i),r,i}}
/** The highest level drawn with n stones (the wall's top above the last stone). */
const topZ=n=>n>0?stoneAt(n-1).z+T-1:0;
/** How far the view rises (pixels) so the top of a tower of n stones stays in sight. */
const shiftFor=n=>Math.max(0,topZ(n)*4-(GROUND-40));
const turns=n=>n>0?stoneAt(n-1).r.j+1:0;

/* era: the colour band a stone belongs to, from where its height falls among o.eras (stone numbers) */
let OPT={eras:[],marks:[]};
const eraOf=n=>{let e=0;OPT.eras.forEach((t,i)=>{if(n>=t)e=i+1});return Math.min(e,4)};

/* ---------- materials for the five eras: sandstone, marble, lapis and gold, crystal, starlight ---------- */
function eraMats(e,wall,step,win,em){
  mat('w'+e,wall[0],wall[1],wall[2],stone);
  mat('s'+e,step[0],step[1],step[2],(f,u,v,w,n,c)=>{let x=c[f];if(f===0){if(u>.78||v>.78)return sh(x,.82);if(u<.18||v<.18)return sh(x,1.1);return sh(x,.97+n*.06)}
    if(v<.22)return sh(x,1.12);return v>.8?sh(x,.7):sh(x,.95+n*.08)},em);
  const arch=(lit)=>(f,u,v,w,n,c)=>{if(f===0)return stone(f,u,v,w,n,c);const inside=u>.2&&u<.8&&v>.18&&v<.95&&!(v<.38&&(u<.3||u>.7));
    if(!inside)return sh(c[f],v>.85?.75:1);if(!lit)return v<.45?rgb('#1a1030'):rgb('#2a1a40');return v<.5&&near(u,.5,.2)?rgb(win[0]):f===1?rgb(win[1]):rgb(win[2])};
  mat('wn'+e,wall[0],wall[1],wall[2],arch(1),win[1]);mat('wa'+e,wall[0],wall[1],wall[2],arch(0));
  // the lower half of a tall arch: the opening runs to the bottom of the block
  const open=(lit)=>(f,u,v,w,n,c)=>{if(f===0)return stone(f,u,v,w,n,c);if(!(u>.2&&u<.8))return sh(c[f],v>.85?.75:1);return lit?(f===1?rgb(win[1]):rgb(win[2])):rgb('#2a1a40')};
  mat('on'+e,wall[0],wall[1],wall[2],open(1));mat('oa'+e,wall[0],wall[1],wall[2],open(0))}
eraMats(0,['#d9a86c','#b9844f','#6e4a2c'],['#fff1d2','#e8c58f','#9c7246'],['#fff3c0','#ffc94a','#e89a2c']);
eraMats(1,['#ece8f3','#c4bcd8','#7f769c'],['#c9b6f2','#a58be0','#5e47a0'],['#fff3c0','#ffc94a','#e89a2c']);
eraMats(2,['#6f86e0','#4a60bd','#26357a'],['#ffe08a','#f0b43c','#9a6414'],['#fff3c0','#ffd76a','#f0a838']);
eraMats(3,['#bff3ff','#6fd2ea','#2f8fb5'],['#fff6c8','#f1d27a','#a8822e'],['#ffffff','#9ff5ff','#56d3ea'],'#7ff0ff');
eraMats(4,['#d8c8ff','#9f85f0','#5a3fae'],['#fff3c0','#e9d27a','#a08a3a'],['#ffffff','#e6d8ff','#b49cff'],'#c9b4ff');
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

/* ---------- the world in view: the island (low views only), the plinth and the tower's slice ---------- */
const key=(x,y,z)=>(x+64)*128+(y+64)+(z+64)*16384;
const B=(x,y,z,m)=>({x,y,z,m});
let ISL=null;
function islandBlocks(){if(ISL)return ISL;const L=[];
  for(let x=-12;x<=12;x++)for(let y=-12;y<=12;y++){const a=Math.atan2(y,x),d=Math.hypot(x,y),r=10.8+.55*Math.sin(a*3+.6)+.35*Math.sin(a*5),j=hash(x,y,3,1);
    if(d>r)continue;const top=(x===0&&y>=8)?'path':(x>=6&&x<=8&&y>=-5&&y<=-3&&!(x===8&&y===-5))?'water':'grass';
    L.push(B(x,y,-1,top));if(d<=r-1.1)L.push(B(x,y,-2,'dirt'));[2.2,3.6,5,6.3,7.6,8.8].forEach((k,i)=>{if(d<=r-k-j*1.4)L.push(B(x,y,-3-i,'rock'))})}
  // the plinth, its front steps, trees, lanterns and rocks
  for(let x=-7;x<=7;x++)for(let y=-7;y<=7;y++)if(!(Math.abs(x)===7&&Math.abs(y)===7))L.push(B(x,y,0,'w0'));
  for(let x=-1;x<=1;x++)L.push(B(x,8,0,'s0'));
  const tree=(x,y,h)=>{for(let z=0;z<h;z++)L.push(B(x,y,z,'wood'));
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){L.push(B(x+dx,y+dy,h,'leaf'));if(Math.abs(dx)+Math.abs(dy)<2)L.push(B(x+dx,y+dy,h+1,'leaf'))}L.push(B(x,y,h+2,'leaf'))};
  tree(-9,-2,2);tree(-4,-9,3);tree(7,-8,2);tree(-9,4,2);
  [[2,9],[-2,9],[9,2]].forEach(p=>{L.push(B(p[0],p[1],0,'dark'));L.push(B(p[0],p[1],1,'glow'))});
  L.push(B(9,-3,0,'rock'),B(-6,9,0,'rock'),B(-10,0,0,'rock'));
  return ISL=L}
/** The tower's stones and walls with levels in [zLo, zHi], for n stones laid. */
function towerBlocks(n,zLo,zHi){const L=[];if(!n)return L;const last=stoneAt(n-1),jTop=last.r.j,marks=new Set(OPT.marks);
  let j0=Math.max(0,revOf(Math.max(0,n-1)).j-Math.ceil((zHi-zLo)/T)-2);while(j0>0&&rev(j0).base>zLo)j0--;
  for(let j=j0;j<=jTop;j++){const r=rev(j);if(r.base>zHi)break;if(r.base+2*T<zLo)continue;
    for(let i=0;i<r.P;i++){const k=r.n+i;if(k>=n)break;const z=stepZ(r,i);if(z<zLo||z>zHi)continue;const c=r.S[i];
      if(marks.has(k)){L.push(B(c.x,c.y,z,'gold'));L.push(B(c.x,c.y,z+1,'banner'))}else L.push(B(c.x,c.y,z,'s'+eraOf(k)))}
    const core=ring(r.Rc);core.forEach((c,ci)=>{const ic=Math.min(r.P-1,Math.floor(c.a/(2*Math.PI)*r.P)),k=r.n+ic;if(k>=n)return;const z0=stepZ(r,ic),e=eraOf(k);
      for(let q=0;q<T;q++){const z=z0+q;if(z<zLo||z>zHi)continue;let m='w'+e;
        // an arcade every turn (Bruegel's tower): tall arches above the stair, small windows higher up, some lit
        const lit=hash(ci,j,7,1)>.55;if(q===3&&!(ci&1))m=(lit?'wn':'wa')+e;else if(q===2&&!(ci&1))m=(lit?'on':'oa')+e;else if(q===6&&ci%3===1)m=(hash(ci,j,8,1)>.5?'wn':'wa')+e;L.push(B(c.x,c.y,z,m))}})}
  // a floor inside the top turn, so the open top of the core is not hollow
  const rt=rev(jTop),fz=rt.base-1;if(fz>=zLo&&fz<=zHi)for(let x=-rt.Rc+1;x<rt.Rc;x++)for(let y=-rt.Rc+1;y<rt.Rc;y++)L.push(B(x,y,fz,'dark'));
  return L}
// the world canvas: VH + MARGIN tall, so the view can sink a little below where it was drawn without drawing again
const WW=176,WOX=88,WH=VH+MARGIN;
/** Draw the world for n stones with the view raised by S pixels → canvas (with .S, .emit). */
function world(n,S,cv){const oy=GROUND+S,zLo=Math.floor((oy-WH-40)/4),zHi=Math.ceil((oy+40)/4);
  const low=zLo<=0,T0=towerBlocks(n,Math.max(1,zLo),zHi),all=(low?islandBlocks():[]).concat(T0),occ=new Set();all.forEach(b=>occ.add(key(b.x,b.y,b.z)));
  const top=Math.max(2,zHi);
  cv=cv||document.createElement('canvas');cv.width=WW;cv.height=WH;const g=cv.getContext('2d');g.imageSmoothingEnabled=false;g.clearRect(0,0,WW,WH);
  const under=all.filter(b=>b.z<0).sort(sortB),over=all.filter(b=>b.z>=0).sort(sortB);
  under.forEach(b=>drawBlock(g,b,WOX,oy,occ,top,false));
  if(low){// the ground shadow: every voxel above the ground projected along the light onto the grass
    const sc=document.createElement('canvas');sc.width=WW;sc.height=WH;const s=sc.getContext('2d');s.fillStyle='#000';
    over.forEach(b=>{for(const h of [b.z,b.z+.5,b.z+1]){const gx=b.x-LV[0]*h,gy=b.y-LV[1]*h,sx=Math.round((gx-gy)*4),sy=Math.round((gx+gy)*2);
      s.beginPath();s.moveTo(WOX+sx,oy+sy);s.lineTo(WOX+sx+4,oy+sy+2);s.lineTo(WOX+sx,oy+sy+4);s.lineTo(WOX+sx-4,oy+sy+2);s.closePath();s.fill()}});
    const mk=document.createElement('canvas');mk.width=WW;mk.height=WH;const mg=mk.getContext('2d');
    under.filter(b=>b.z===-1).forEach(b=>{const[sx,sy]=proj(b.x,b.y,b.z);mg.drawImage(ATL,0,(MI.stone*3)*8,8,8,WOX+sx-4,oy+sy,8,8)});
    s.globalCompositeOperation='destination-in';s.drawImage(mk,0,0);g.globalAlpha=.42;g.drawImage(sc,0,0);g.globalAlpha=1}
  over.forEach(b=>drawBlock(g,b,WOX,oy,occ,top,true));
  cv.emit=over.filter(b=>M[b.m].em&&b.m!=='gold').map(b=>{const[sx,sy]=proj(b.x,b.y,b.z);return{x:WOX+sx,y:oy+sy+4,c:M[b.m].em,r:/^s/.test(b.m)?5:6,ph:hash(b.x,b.y,b.z,9)*6.28}});
  cv.S=S;cv.n=n;cv.low=low;return cv}

/* ---------- the sky, and the land below it that sinks away as the tower rises ---------- */
function sky(W,H){const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d'),im=g.createImageData(W,H),D=im.data;
  const stops=[[0,rgb('#0a0920')],[.35,rgb('#16123d')],[.62,rgb('#2b2163')],[.8,rgb('#4a2f7c')],[1,rgb('#2f5f86')]];
  const col=t=>{for(let i=1;i<stops.length;i++)if(t<=stops[i][0]){const a=stops[i-1],b=stops[i],k=(t-a[0])/(b[0]-a[0]);return[a[1],b[1],k]}return[stops[4][1],stops[4][1],0]};
  for(let y=0;y<H;y++){const[a,b,k]=col(y/H);for(let x=0;x<W;x++){const c=k>bay(x,y)?b:a,i=(y*W+x)*4;D[i]=c[0];D[i+1]=c[1];D[i+2]=c[2];D[i+3]=255}}
  for(let i=0;i<W*H/170;i++){const x=hash(i,1,2,3)*W|0,y=(hash(i,4,5,6)**1.6)*H*.85|0,j=(y*W+x)*4,b=hash(i,7,8,9);D[j]=D[j+1]=D[j+2]=b>.85?255:170+b*70}
  g.putImageData(im,0,0);
  const mx=Math.round(W*.16),my=30;for(let y=-8;y<=8;y++)for(let x=-8;x<=8;x++){const d=Math.hypot(x,y);if(d>7.6)continue;
    const c=d>6.4?'#e8d9a8':(hash(x,y,1,1)>.86||(Math.hypot(x+2,y+1)<1.6))?'#e2d2a0':x+y<-3?'#fffaf0':'#fff2c8';g.fillStyle=c;g.fillRect(mx+x,my+y,1,1)}
  g.globalCompositeOperation='lighter';g.drawImage(glow([90,80,60],16),mx-16,my-16);g.globalCompositeOperation='source-over';
  return cv}
function land(W,H){const cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
  const range=(base,amp,seed,c,haze)=>{for(let x=0;x<W;x++){const h=Math.round(base-amp*(.55*Math.abs(Math.sin(x*.021+seed))+.3*Math.abs(Math.sin(x*.057+seed*2))+.15*hash(x>>2,seed|0,1,1)));
      for(let y=h;y<H;y++){g.fillStyle=haze&&((y-h)<3)&&bay(x,y)>.5?css(mix(c,rgb('#6a5aa8'),.4)):css(c);g.fillRect(x,y,1,1)}}};
  range(VH*.66,46,1.3,rgb('#2a2459'),1);range(VH*.76,34,4.1,rgb('#1b173f'),0);
  for(let x=0;x<W;x++){const top=Math.round(VH*.84+3*Math.sin(x*.09)+2*Math.sin(x*.23+1));
    for(let y=top;y<H;y++){const d=y-top,c=d<2?'#a497d8':d<5&&bay(x,y)>.45?'#8578c0':d<9&&bay(x,y)>.7?'#7466b0':'#5e5299';g.fillStyle=c;g.fillRect(x,y,1,1)}}
  return cv}
// the cloud bank the tower rises out of once the island is far below
function bank(W){const cv=document.createElement('canvas');cv.width=W;cv.height=64;const g=cv.getContext('2d');
  for(let x=0;x<W;x++){const top=Math.round(22+4*Math.sin(x*.07)+3*Math.sin(x*.19+2)+2*Math.sin(x*.41));
    for(let y=top-14;y<64;y++){const d=y-top;if(d<0){if(bay(x,y)<(14+d)/14*.55){g.fillStyle='rgba(133,120,192,.55)';g.fillRect(x,y,1,1)}continue}
      g.fillStyle=d<2?'#b3a8e4':d<6&&bay(x,y)>.4?'#9488cf':d<12&&bay(x,y)>.65?'#8274bc':'#6c5fa8';g.fillRect(x,y,1,1)}}
  return cv}
function cloud(seed){const cv=document.createElement('canvas');cv.width=40;cv.height=12;const g=cv.getContext('2d');
  for(let y=0;y<12;y++)for(let x=0;x<40;x++){const d=Math.hypot((x-20)/20,(y-7)/5)+.25*Math.sin(x*.5+seed)*.5;if(d>1)continue;if((1-d)*1.4<bay(x,y))continue;g.fillStyle=y<6?'#8b7fc4':'#5d528f';g.fillRect(x,y,1,1)}return cv}

/* ---------- the running scene ---------- */
const reduced=()=>typeof HWUI!=='undefined'?HWUI.reduced():false;
const perf=()=>document.documentElement.classList.contains('hw-q-performance');
let cur=null;
/** Put the scene in `host`. o = {from, to (stones), eras, marks (stone numbers), aura (0 | 1 | 2), t0, onDone(skipped)}. */
function mount(host,o){stop();atlas();OPT={eras:o.eras||[],marks:o.marks||[]};
  const cv=document.createElement('canvas');let g=null;try{g=cv.getContext('2d')}catch(e){}
  if(!g){host.classList.add('mnfail');if(o.onDone)o.onDone(true);return null}
  cv.className='mncv';cv.setAttribute('aria-hidden','true');host.prepend(cv);
  const W=Math.max(140,Math.floor((host.clientWidth||320)/SC)),H=VH;cv.width=W;cv.height=H;cv.style.width=W*SC+'px';cv.style.height=H*SC+'px';g.imageSmoothingEnabled=false;
  const SKY=sky(W,H),LAND=land(W,H+40),BANK=bank(W),CL=[cloud(1),cloud(2.4),cloud(4)],ox=Math.floor(W/2)-WOX;
  const n0=Math.max(0,Math.min(o.from,o.to)),n1=o.to,still=reduced()||n1===n0;
  // the build: the last 36 new stones are carried up one by one; any before them are laid in one catch-up climb
  const NEW=n1-n0,solo=Math.min(NEW,36),wave=NEW-solo,dt=solo?Math.max(.09,Math.min(.4,3.2/solo)):0,T0=.7,TW=wave?Math.min(4.5,1.2+Math.log10(wave+1)*.9):0,TEND=T0+TW+solo*dt+1.1;
  const s={host,to:n1,cv,g,W,H,t0:o.t0||performance.now(),placed:still?n1:n0,raf:0,vis:true,flash:[],last:0};
  s.S=shiftFor(s.placed);s.world=world(s.placed,s.S);
  const redraw=(S)=>{s.world=world(s.placed,S,s.world)};
  const finish=skipped=>{if(s.finished)return;s.finished=true;s.done=true;s.placed=n1;s.S=shiftFor(n1);redraw(s.S);s.flash=[];if(o.onDone)o.onDone(!!skipped);draw(performance.now())};
  const tone=()=>{const t=performance.now();if(t-(s.tn||0)<140)return;s.tn=t;try{if(st.s.sound&&typeof tn==='function')tn(660+Math.random()*60,.09,'sine',.018)}catch(e){}};
  const at=(b,S)=>{const[sx,sy]=proj(b.x,b.y,b.z);return[ox+WOX+sx-4,GROUND+S+sy]};
  function draw(now){const t=(now-s.t0)/1000,moving=!s.done&&!still;g.clearRect(0,0,W,H);
    // the camera follows the top of the stair (whole pixels); a small rise on arrival
    const want=shiftFor(s.placed);if(!moving)s.S=want;else s.S=Math.round(s.S+(want-s.S)*.22);
    const bob=moving?Math.round(14*Math.max(0,1-t/1.2)**2):0,S=s.S-bob;
    if(S>s.world.S||s.world.S-S>MARGIN-8||s.world.n!==s.placed&&now-(s.wr||0)>110){s.wr=now;redraw(Math.max(S,Math.min(want,S+MARGIN-8)))}
    g.drawImage(SKY,0,0);
    const sink=Math.min(H+40,Math.round(S*.35));if(sink<H+40)g.drawImage(LAND,0,sink);
    CL.forEach((c,i)=>{const x=Math.round(((t*(1.2+i*.5)+i*97)%(W+40))-40),y=24+i*22+Math.round(Math.min(S*.08,30)*(i+1)/3);g.drawImage(c,x,y)});
    const dy=S-s.world.S;g.drawImage(s.world,ox,dy);
    g.globalCompositeOperation='lighter';
    (s.world.emit||[]).forEach(e=>{const y=e.y+dy;if(y<-10||y>H+10)return;g.globalAlpha=!moving&&!still&&!perf()?.75+.25*Math.sin(t*1.7+e.ph):.85;g.drawImage(glow(e.c,e.r),ox+e.x-e.r,y-e.r)});
    g.globalAlpha=1;
    const tz=topZ(s.placed),[tx,ty]=proj(0,0,tz+1),bx=ox+WOX+tx,by=GROUND+S+ty;
    if(o.aura&&s.placed){for(let y=0;y<by;y++){const a=(y/Math.max(1,by))*(.35+.15*Math.sin(t*2+y*.1))*(o.aura>1?1.4:1);if(a>bay(bx,y)){g.fillStyle='rgba(127,240,255,.55)';g.fillRect(bx-1,y,3,1)}}
      g.drawImage(glow([90,220,240],14),bx-14,by-14)}
    if(!still&&!perf()&&s.world.low){g.fillStyle='#fff3a0';for(let i=0;i<10;i++){const a=t*.4+i*1.9,x=ox+WOX+Math.round(Math.cos(a+i)*(38+i*4)),y=GROUND+S-6-Math.round(Math.abs(Math.sin(a*1.3+i))*14+i);if(Math.sin(t*3+i*2)>-.2)g.fillRect(x,y,1,1)}}
    g.globalCompositeOperation='source-over';
    // the stair goes on: the next stones wait as glowing outlines at the top
    if(s.placed&&!perf()){for(let k=0;k<3;k++){const b=stoneAt(s.placed+k),[X,Y]=at(b,S);if(Math.sin(t*4-k)>-.2||still)g.drawImage(OVL,88,0,8,8,X,Y,8,8)}}
    if(moving){let lock=false;
      // 1. the catch-up climb: older new stones are laid in order, a few at a time, each with a spark
      if(wave&&s.placed<n0+wave&&t>=T0){const k=Math.min(1,(t-T0)/TW),want2=n0+Math.ceil(wave*(1-(1-k)**2));
        if(want2>s.placed&&(now-(s.wv||0)>90||k>=1)){s.flash.push({b:stoneAt(want2-1),t});s.placed=want2;s.wv=now;lock=true}}
      // 2. the last stones one by one: a marker where each will go; it rises from the land below and locks in
      const sx0=Math.floor(W/2)-4,sy0=s.world.low?GROUND+S+30:H+6;
      for(let i=Math.max(s.placed,n0+wave);i<n1;i++){const ts=T0+TW+(i-n0-wave)*dt,p=(t-ts)/.75;
        if(p>=1){if(i===s.placed){s.placed=i+1;lock=true;s.flash.push({b:stoneAt(i),t});tone()}continue}
        if(p<-.5)break;const b=stoneAt(i),[X,Y]=at(b,S);
        if(Math.sin(t*12)>-.3)g.drawImage(OVL,88,0,8,8,X,Y,8,8);
        if(p<0)continue;const e=1-(1-p)**3,lift=Math.sin(p*Math.PI)*22,x=Math.round(sx0+(X-sx0)*e),y=Math.round(sy0+(Y-sy0)*e-lift);
        const m=MI[b.m||('s'+eraOf(i))];g.drawImage(glow([255,214,120],7),x-3,y-3);for(let f=0;f<3;f++)g.drawImage(ATL,0,(m*3+f)*8,8,8,x,y,8,8)}
      if(lock&&now-(s.wr||0)>110){s.wr=now;redraw(Math.max(S,Math.min(shiftFor(s.placed),S+MARGIN-8)))}
      s.flash=s.flash.filter(f=>t-f.t<.18);s.flash.forEach(f=>{const[X,Y]=at(f.b,S);g.drawImage(OVL,80,0,8,8,X,Y,8,8)});
      if(t>=TEND)finish(false)}
    // above the clouds: the lower turns fade into a cloud bank
    if(!s.world.low||S>60){const a=Math.min(1,(S-40)/80);if(a>0){g.globalAlpha=a;g.drawImage(BANK,0,H-58);g.globalAlpha=1}}
  }
  function loop(now){if(!cv.isConnected){stop();return}s.raf=requestAnimationFrame(loop);if(!s.vis||document.hidden)return;
    if(now-s.last<33)return;s.last=now;draw(now);if(s.done&&(reduced()||perf()))cancelAnimationFrame(s.raf)}
  try{s.io=new IntersectionObserver(E=>{s.vis=E.some(e=>e.isIntersecting)});s.io.observe(cv)}catch(e){}
  s.skip=()=>finish(true);s.stop=()=>{cancelAnimationFrame(s.raf);if(s.io)s.io.disconnect()};
  if(still){s.finished=s.done=true;draw(performance.now());if(o.onDone)o.onDone(false);if(!reduced()&&!perf())s.raf=requestAnimationFrame(loop)}
  else s.raf=requestAnimationFrame(loop);
  cur=s;return s}
function stop(){if(cur){cur.stop();cur=null}}
return{mount,stop,CELL,stone:stoneAt,topZ,turns,skipNow:()=>{if(cur&&!cur.done)cur.skip()},get running(){return!!(cur&&!cur.done)}}})();
