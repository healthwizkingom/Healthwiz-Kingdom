/* v6 (RPG upgrades): character rig for the existing knight (kn.webp) and orc (orc.webp). Not part of the original.
   The art stays exactly as drawn. Each character is ONE image cut into parts with clip paths (cut-out / puppet
   animation): the parts move on their own pivots, so a pose blends into the next instead of swapping pictures.
     knight  cape · body · front leg · back leg · shield · head · sword hand   (+ props: flask, bucket)
     orc     body · front leg · back leg · head · axe hand
   The body keeps everything that is not a part (an even-odd clip with the parts cut out), so nothing is drawn twice.
   Every pose is a CSS class on the <svg> (s-idle, s-walk, s-attack …). Poses are static transforms plus a looping or
   one-shot CSS animation, so an idle character costs no JavaScript, and reduced motion shows the pose standing still.
   The wrapper (.rgw) carries the facing (turn = a short stepped squash through the middle) and whole-body moves.

   HWRig.knight({cls,label}) / HWRig.orc(...)   markup string
   HWRig.pose(el, name)                         set a pose (restarts a one-shot pose when set again)
   HWRig.face(el, dir)                          1 = facing right (as drawn for the knight), -1 = left; animates a turn
   HWRig.paint(key, w, h, draw) / HWRig.mix(a, b, f)   pixel-art scene layers (below) and a colour mix */
const HWRig=(()=>{
let uid=0;
// polygons in image pixels; [name, points, pivot x, pivot y]
const KN_P=[
  ['cp','0,152 36,150 48,180 92,180 92,198 72,206 66,238 14,242 0,238',88,186],
  ['lb','168,196 224,190 230,272 172,274 168,240',196,198],
  ['lf','74,200 128,198 130,240 112,276 64,276 70,236',100,202],
  ['sh','196,90 262,90 262,202 196,202',200,140],
  ['hd','112,0 212,0 212,92 186,100 138,100 112,82',160,96],
  ['sw','0,0 34,0 66,100 90,112 92,166 80,178 50,178 38,140 30,118 0,36',70,148]];
const OR_P=[
  ['lb','132,104 172,98 180,171 146,171 134,140',150,106],
  ['lf','64,110 104,110 106,150 108,171 58,171 62,140',86,112],
  ['hd','74,0 122,0 122,44 104,52 80,50 74,40',100,48],
  ['ax','0,58 80,58 80,100 0,110',79,84]];
// small pixel props held by the knight: "x,y,w,h,colour;…"
const PROPS={
  fk:'0,3,10,12,#6b4a2b;1,4,8,10,#8a5a2b;2,5,3,7,#a8693a;3,0,4,3,#c9a96a;2,8,6,2,#2f8fd0;0,15,10,1,#4a3018',
  bk:'0,4,26,20,#5b3a1e;2,4,22,18,#8a5a2b;2,8,22,2,#3a3a48;2,17,22,2,#3a3a48;4,6,3,10,#a8693a;0,0,2,6,#3a3a48;24,0,2,6,#3a3a48;2,0,22,2,#3a3a48;2,4,22,3,#2f8fd0;5,4,8,1,#8fd4ff'};
const rects=s=>s.split(';').map(r=>{const p=r.split(',');return '<rect x="'+p[0]+'" y="'+p[1]+'" width="'+p[2]+'" height="'+p[3]+'" fill="'+p[4]+'"/>'}).join('');
const hole=pts=>'M'+pts.split(' ').join('L')+'Z';

function build(kind,src,w,h,parts,order,o){const id='rg'+(++uid),img=id+'i';o=o||{};
  let defs='<image id="'+img+'" href="'+src+'" xlink:href="'+src+'" width="'+w+'" height="'+h+'" preserveAspectRatio="none"/>'
    +'<clipPath id="'+id+'b"><path clip-rule="evenodd" d="M-1 -1H'+(w+1)+'V'+(h+1)+'H-1Z'+parts.map(p=>hole(p[1])).join('')+'"/></clipPath>'
    +parts.map(p=>'<clipPath id="'+id+p[0]+'"><polygon points="'+p[1]+'"/></clipPath>').join('');
  const part=n=>{if(n==='bd0')return '<use class="r-p0" href="#'+img+'" xlink:href="#'+img+'" clip-path="url(#'+id+'b)"/>';
    if(n==='fk'||n==='bk')return '<g class="r-p r-'+n+'"><g class="r-pp">'+rects(PROPS[n])+'</g></g>';
    const p=parts.find(x=>x[0]===n);
    return '<g class="r-p r-'+n+'" style="transform-origin:'+p[2]+'px '+p[3]+'px"><use href="#'+img+'" xlink:href="#'+img+'" clip-path="url(#'+id+n+')"/></g>'};
  return '<span class="rgw '+kind+'w '+(o.cls||'')+'"'+(o.label?' role="img" aria-label="'+o.label+'"':' aria-hidden="true"')+'>'
    +'<svg class="hwr '+kind+' s-'+(o.pose||'idle')+'" viewBox="0 0 '+w+' '+h+'" width="'+w+'" height="'+h+'" focusable="false"><defs>'+defs+'</defs>'
    +'<g class="r-bd" style="transform-origin:'+(w*.55)+'px '+h+'px">'+order.map(part).join('')+'</g></svg></span>'}

const knight=o=>build('rgk',KN,260,275,KN_P,['cp','lb','bd0','lf','bk','sh','hd','fk','sw'],o);
const orc=o=>build('rgo',ORC,180,171,OR_P,['lb','bd0','lf','hd','ax'],o);

const svg=el=>!el?null:el.tagName&&el.tagName.toLowerCase()==='svg'?el:el.querySelector('svg.hwr');
/** Set a pose. Setting the same one-shot pose again restarts it. */
function pose(el,name){const s=svg(el);if(!s)return;const c=s.getAttribute('class').replace(/\bs-[\w-]+/g,'').trim();
  s.setAttribute('class',c);void s.getBoundingClientRect();s.setAttribute('class',c+' s-'+name)}
const poseOf=el=>{const s=svg(el),m=s&&/\bs-([\w-]+)/.exec(s.getAttribute('class'));return m?m[1]:''};
function face(el,dir){const w=el&&(el.classList.contains('rgw')?el:el.querySelector('.rgw'));if(!w)return;w.classList.toggle('rgl',dir<0)}

/* ---------- pixel painter for scene layers ----------
   paint(key, w, h, draw) draws a small low-resolution layer (e.g. 320×180) with hard pixels only (scanline polygons and
   ellipses, no anti-aliasing), returns it as a data: URL and caches it for the session, so a scene costs one paint per
   time of day and the page shows it as an <img> scaled up with image-rendering: pixelated. */
const PC={};
function rng(s){let a=s>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function painter(x,w,h,seed){const R=rng(seed||7);
  const r=(a,b,c,d,col)=>{if(c<=0||d<=0)return;x.fillStyle=col;x.fillRect(Math.round(a),Math.round(b),Math.round(c),Math.round(d))};
  const P={w,h,rnd:R,r,
    px:(a,b,col)=>r(a,b,1,1,col),
    // filled polygon [x0,y0,x1,y1,…], sampled at pixel centres
    poly(pts,col){let y0=1e9,y1=-1e9;for(let i=1;i<pts.length;i+=2){y0=Math.min(y0,pts[i]);y1=Math.max(y1,pts[i])}
      for(let y=Math.floor(y0);y<=Math.ceil(y1);y++){const c=y+.5,xs=[];for(let i=0;i<pts.length;i+=2){const ax=pts[i],ay=pts[i+1],bx=pts[(i+2)%pts.length],by=pts[(i+3)%pts.length];
        if((ay<=c&&by>c)||(by<=c&&ay>c))xs.push(ax+(c-ay)/(by-ay)*(bx-ax))}xs.sort((a,b)=>a-b);
        for(let k=0;k+1<xs.length;k+=2){const a=Math.round(xs[k]),b=Math.round(xs[k+1]);r(a,y,b-a,1,col)}}},
    ell(cx,cy,rx,ry,col){for(let y=-ry;y<ry;y++){const t=(y+.5)/ry,k=rx*Math.sqrt(Math.max(0,1-t*t));const a=Math.round(cx-k),b=Math.round(cx+k);r(a,Math.round(cy+y),b-a,1,col)}},
    // a silhouette edge: column x is filled from f(x) down to `bottom`
    ridge(x0,x1,f,col,bottom){for(let i=Math.round(x0);i<x1;i++){const y=Math.round(f(i));r(i,y,1,(bottom==null?h:bottom)-y,col)}},
    speck(a,b,c,d,cols,n){for(let i=0;i<n;i++)r(a+R()*c,b+R()*d,1,1,cols[R()*cols.length|0])},
    // vertical banded gradient with a one-row checker dither between bands
    bands(y0,y1,cols){const n=cols.length,hgt=(y1-y0)/n;for(let i=0;i<n;i++){r(0,y0+i*hgt,w,hgt+1,cols[i]);if(i)for(let xx=(i%2);xx<w;xx+=2)r(xx,Math.round(y0+i*hgt)-1,1,1,cols[i])}}};
  return P}
function paint(key,w,h,draw,seed){if(PC[key]!=null)return PC[key];let url='';
  try{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');if(x){draw(painter(x,w,h,seed));url=c.toDataURL()}}catch(e){console.error('[HWRig] paint failed:',e)}
  return PC[key]=url}
// mix two #rrggbb colours (f = 0 → a, 1 → b)
function mix(a,b,f){const p=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)),A=p(a),B=p(b);return '#'+A.map((v,i)=>('0'+Math.round(v+(B[i]-v)*f).toString(16)).slice(-2)).join('')}

HWUI.css('rig',`
.rgw{display:block;position:relative;width:100%;transition:transform .28s steps(4);transform-origin:50% 100%}
.rgw.rgl{transform:scaleX(-1)}
.hwr{display:block;width:100%;height:auto;overflow:visible}
.hwr .r-p,.hwr .r-bd{transform-box:view-box}
.hwr .r-fk,.hwr .r-bk{opacity:0;transition:opacity .15s steps(2)}
.rgk .r-fk{transform:translate(204px,120px)}.rgk .r-fk .r-pp{transform:scale(2.2)}
.rgk .r-bk{transform:translate(196px,196px)}.rgk .r-bk .r-pp{transform:scale(2);transform-origin:13px 0;transform-box:view-box}
.rgk.s-scoop .r-fk,.rgk.s-drink .r-fk,.rgk.s-carry .r-bk,.rgk.s-cwalk .r-bk,.rgk.s-pour .r-bk{opacity:1}

/* ---- knight poses ---- */
.rgk .r-bd{animation:rgkbr 2.6s ease-in-out infinite}
.rgk .r-hd{animation:rgkhd 5.2s ease-in-out infinite}
.rgk .r-cp{animation:rgkcp 3.1s ease-in-out infinite}
.rgk .r-sw{animation:rgksw 2.6s ease-in-out infinite}
.rgk .r-sh{animation:rgksh 2.6s ease-in-out infinite}
@keyframes rgkbr{0%,100%{transform:scale(1,1)}50%{transform:scale(.996,1.018)}}
@keyframes rgkhd{0%,100%{transform:rotate(0)}30%{transform:rotate(-1.5deg)}70%{transform:rotate(1deg)}}
@keyframes rgkcp{0%,100%{transform:rotate(0) skewY(0)}50%{transform:rotate(-2.5deg) skewY(2deg)}}
@keyframes rgksw{0%,100%{transform:rotate(0)}50%{transform:rotate(2.5deg)}}
@keyframes rgksh{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}

.rgk.s-walk .r-bd,.rgk.s-cwalk .r-bd{animation:rgkbob .5s ease-in-out infinite}
.rgk.s-walk .r-lf,.rgk.s-cwalk .r-lf{animation:rgklf .5s ease-in-out infinite}
.rgk.s-walk .r-lb,.rgk.s-cwalk .r-lb{animation:rgklb .5s ease-in-out infinite}
.rgk.s-walk .r-cp,.rgk.s-cwalk .r-cp{animation:rgkcpw .5s ease-in-out infinite}
.rgk.s-walk .r-sw{animation:rgkarm .5s ease-in-out infinite}
.rgk.s-walk .r-hd,.rgk.s-cwalk .r-hd{animation:none;transform:rotate(-1deg)}
.rgk.s-cwalk .r-sw{animation:none;transform:rotate(-8deg)}.rgk.s-cwalk .r-sh{animation:rgksh .25s ease-in-out infinite}
@keyframes rgkbob{0%,50%,100%{transform:translateY(0) rotate(1.5deg)}25%,75%{transform:translateY(-6px) rotate(1.5deg)}}
@keyframes rgklf{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(12deg)}}
@keyframes rgklb{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-12deg)}}
@keyframes rgkcpw{0%,100%{transform:rotate(-5deg) skewY(3deg)}50%{transform:rotate(-9deg) skewY(5deg)}}
@keyframes rgkarm{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}

.rgk.s-kneel .r-bd,.rgk.s-scoop .r-bd,.rgk.s-drink .r-bd{animation:none;transform:translateY(16px) rotate(3deg)}
.rgk.s-kneel .r-lf,.rgk.s-scoop .r-lf,.rgk.s-drink .r-lf{animation:none;transform:rotate(-32deg) translateY(-4px)}
.rgk.s-kneel .r-lb,.rgk.s-scoop .r-lb,.rgk.s-drink .r-lb{animation:none;transform:rotate(22deg) scaleY(.86)}
.rgk.s-kneel .r-sw,.rgk.s-scoop .r-sw,.rgk.s-drink .r-sw{animation:none;transform:rotate(-100deg)}
.rgk.s-scoop .r-bd{animation:rgkdip 1s ease-in-out both}
.rgk.s-scoop .r-fk{animation:rgkfdip 1s ease-in-out both}
@keyframes rgkdip{0%{transform:translateY(16px) rotate(3deg)}50%,70%{transform:translateY(20px) rotate(13deg)}100%{transform:translateY(16px) rotate(5deg)}}
@keyframes rgkfdip{0%{transform:translate(204px,120px)}50%,70%{transform:translate(222px,178px)}100%{transform:translate(206px,128px)}}
.rgk.s-drink .r-hd{animation:none;transform:rotate(-16deg)}
.rgk.s-drink .r-fk{animation:rgkfdr 1.3s ease-in-out both}
.rgk.s-drink .r-sh{animation:none;transform:translate(-6px,-14px) rotate(-6deg)}
@keyframes rgkfdr{0%{transform:translate(206px,128px)}40%,85%{transform:translate(176px,56px) rotate(-38deg)}100%{transform:translate(184px,70px) rotate(-20deg)}}

.rgk.s-carry .r-bd{animation:rgkbr 2.6s ease-in-out infinite}.rgk.s-carry .r-sw{animation:none;transform:rotate(-8deg)}
.rgk.s-pour .r-bd{animation:none;transform:rotate(6deg)}.rgk.s-pour .r-sw{animation:none;transform:rotate(-10deg)}
.rgk.s-pour .r-bk{animation:rgkpour 1s ease-in-out both}
@keyframes rgkpour{0%{transform:translate(196px,196px)}35%,100%{transform:translate(214px,118px) rotate(62deg)}}

.rgk.s-cel .r-bd{animation:rgkjmp .6s ease-out 2 both}
.rgk.s-cel .r-sw,.rgk.s-win .r-sw{animation:none;transform:translate(10px,-24px) rotate(24deg)}
.rgk.s-cel .r-cp,.rgk.s-win .r-cp{animation:rgkcpw .4s ease-in-out infinite}
.rgk.s-cel .r-hd{animation:none;transform:rotate(-4deg)}
@keyframes rgkjmp{0%{transform:translateY(0) scale(1.04,.94)}35%{transform:translateY(-34px) scale(.97,1.05)}70%{transform:translateY(0) scale(1.05,.93)}100%{transform:translateY(0) scale(1,1)}}

/* battle */
.rgk.s-ready .r-bd{animation:rgkbr 1.6s ease-in-out infinite}.rgk.s-ready .r-sw{animation:rgkrdy 1.6s ease-in-out infinite}
@keyframes rgkrdy{0%,100%{transform:rotate(14deg)}50%{transform:rotate(18deg)}}
.rgk.s-attack .r-bd{animation:rgkatb var(--atk,.8s) ease-in-out both}
.rgk.s-attack .r-sw{animation:rgkats var(--atk,.8s) cubic-bezier(.5,0,.2,1) both}
.rgk.s-attack .r-cp{animation:rgkcpw .2s ease-in-out infinite}
.rgk.s-attack .r-lf{animation:rgkatl var(--atk,.8s) ease-in-out both}
@keyframes rgkatb{0%{transform:rotate(0)}35%{transform:rotate(-7deg) translateX(-6px)}55%{transform:rotate(9deg) translateX(10px)}75%{transform:rotate(7deg) translateX(8px)}100%{transform:rotate(0)}}
@keyframes rgkats{0%{transform:rotate(0)}38%{transform:rotate(-34deg)}58%{transform:rotate(118deg)}76%{transform:rotate(104deg)}100%{transform:rotate(14deg)}}
@keyframes rgkatl{0%,100%{transform:rotate(0)}55%,75%{transform:rotate(-16deg)}}
.rgk.s-block .r-bd{animation:none;transform:rotate(-5deg) translateX(-6px)}
.rgk.s-block .r-sh{animation:none;transform:translate(-10px,-18px) rotate(-10deg)}
.rgk.s-block .r-sw{animation:none;transform:rotate(-16deg)}
.rgk.s-hurt .r-bd{animation:rgkhur .55s ease-out both}.rgk.s-hurt .r-hd{animation:none;transform:rotate(-9deg)}.rgk.s-hurt .r-sw{animation:none;transform:rotate(-46deg)}
@keyframes rgkhur{0%{transform:rotate(0)}30%{transform:rotate(-10deg) translateX(-14px)}100%{transform:rotate(-3deg) translateX(-4px)}}
.rgk.s-tired .r-bd{animation:rgktir 3.6s ease-in-out infinite}
.rgk.s-tired .r-hd{animation:none;transform:rotate(9deg) translateY(4px)}
.rgk.s-tired .r-sw{animation:rgktsw 3.6s ease-in-out infinite}
.rgk.s-tired .r-sh{animation:none;transform:translateY(12px) rotate(8deg)}
.rgk.s-tired .r-cp{animation:none;transform:rotate(3deg)}
@keyframes rgktir{0%,100%{transform:translateY(6px) rotate(4deg) scale(1,1)}50%{transform:translateY(8px) rotate(5deg) scale(1.01,1.03)}}
@keyframes rgktsw{0%,100%{transform:rotate(-82deg)}50%{transform:rotate(-76deg)}}
.rgk.s-down .r-bd{animation:rgkdwn 3.8s ease-in-out infinite}
.rgk.s-down .r-lf{transform:rotate(-34deg) translateY(-4px)}.rgk.s-down .r-lb{transform:rotate(22deg) scaleY(.86)}
.rgk.s-down .r-hd{animation:none;transform:rotate(14deg) translateY(6px)}
.rgk.s-down .r-sw{animation:none;transform:rotate(-104deg)}
.rgk.s-down .r-sh{animation:none;transform:translateY(20px) rotate(14deg)}
.rgk.s-down .r-cp{animation:none;transform:rotate(4deg)}
@keyframes rgkdwn{0%,100%{transform:translateY(18px) rotate(6deg)}50%{transform:translateY(20px) rotate(7deg) scale(1.01,1.025)}}
.rgk.s-win .r-bd{animation:rgkwin 1.4s ease-in-out infinite}
.rgk.s-win .r-hd{animation:none;transform:rotate(-5deg)}
@keyframes rgkwin{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-3px) scale(.99,1.02)}}

/* ---- orc poses (drawn facing left) ---- */
.rgo .r-bd{animation:rgobr 2.2s ease-in-out infinite}
.rgo .r-hd{animation:rgohd 4.4s ease-in-out infinite}
.rgo .r-ax{animation:rgoax 2.2s ease-in-out infinite}
@keyframes rgobr{0%,100%{transform:scale(1,1)}50%{transform:scale(1.01,1.025)}}
@keyframes rgohd{0%,100%{transform:rotate(0)}40%{transform:rotate(2deg)}75%{transform:rotate(-2deg)}}
@keyframes rgoax{0%,100%{transform:rotate(0)}50%{transform:rotate(4deg)}}
.rgo.s-walk .r-bd{animation:rgobob .6s ease-in-out infinite}
.rgo.s-walk .r-lf{animation:rgoleg .6s ease-in-out infinite}
.rgo.s-walk .r-lb{animation:rgoleg .6s ease-in-out infinite reverse}
@keyframes rgobob{0%,50%,100%{transform:translateY(0) rotate(-2deg)}25%,75%{transform:translateY(-5px) rotate(-2deg)}}
@keyframes rgoleg{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}
.rgo.s-attack .r-bd{animation:rgoatb var(--atk,.9s) ease-in-out both}
.rgo.s-attack .r-ax{animation:rgoata var(--atk,.9s) cubic-bezier(.5,0,.2,1) both}
.rgo.s-attack .r-hd{animation:none;transform:rotate(-6deg)}
@keyframes rgoatb{0%{transform:rotate(0)}40%{transform:rotate(6deg) translateX(8px)}62%{transform:rotate(-9deg) translateX(-12px)}80%{transform:rotate(-7deg) translateX(-10px)}100%{transform:rotate(0)}}
@keyframes rgoata{0%{transform:rotate(0)}40%{transform:rotate(42deg)}62%{transform:rotate(-34deg)}80%{transform:rotate(-28deg)}100%{transform:rotate(0)}}
.rgo.s-hurt .r-bd{animation:rgohur .5s ease-out both}.rgo.s-hurt .r-hd{animation:none;transform:rotate(10deg)}.rgo.s-hurt .r-ax{animation:none;transform:rotate(18deg)}
@keyframes rgohur{0%{transform:rotate(0)}30%{transform:rotate(9deg) translateX(14px)}100%{transform:rotate(2deg) translateX(4px)}}
.rgo.s-taunt .r-hd{animation:rgotau .9s ease-in-out infinite}.rgo.s-taunt .r-ax{animation:rgotax 1.8s ease-in-out infinite}
@keyframes rgotau{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(4deg)}}
@keyframes rgotax{0%,100%{transform:rotate(10deg)}50%{transform:rotate(26deg)}}
.rgo.s-defeat .r-bd{animation:rgodef 1.3s cubic-bezier(.4,0,.6,1) both}
.rgo.s-defeat .r-ax{animation:none;transform:rotate(16deg)}
.rgo.s-defeat .r-hd{animation:none;transform:rotate(16deg)}
@keyframes rgodef{0%{transform:rotate(0)}25%{transform:rotate(-6deg) translateY(-6px)}100%{transform:rotate(78deg) translate(10px,30px)}}

@media(prefers-reduced-motion:reduce){.hwr *,.rgw{animation:none!important;transition:none!important}}
html.hw-q-performance .rgk .r-hd,html.hw-q-performance .rgk .r-sh,html.hw-q-performance .rgo .r-hd{animation:none}
`);
return{knight,orc,pose,poseOf,face,paint,mix,rng,KN_P,OR_P}})();
