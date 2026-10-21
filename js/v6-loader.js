/* v6: the loading screen (owner's request, 2026-10-21). Not part of the original.
   White, with the HealthWiz icon (a heart in a wizard hat with an ECG line across it) drawn as an empty grey outline
   that tiny pixels fill in pinkish red as the app loads: the pixels drift in like ash and settle (a disintegration
   played backwards), with a small percentage under the heart. It stays until the welcome page's background and the
   other visuals that take time are ready: the scripts, the fonts and every image on the first page. Then it fades out.
   The percentage is how much of that has loaded (pieces counted, not bytes). With reduced motion the pixels simply
   appear. Loaded right after the original modules, so it shows while the rest of the app starts. */
const HWLoader=(()=>{
const D0=document,NX=32,NY=36,C=5; // NX x NY art pixels, C screen pixels each
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
/* ---------- the icon on its grid: 0 empty, 1 heart, 2 hat, 3 hat band, 4 the ECG line (left white) ---------- */
function grid(){const G=[],ecg=[[3,23],[10,23],[12,19.5],[14.2,27.5],[16.6,16.5],[18.8,25.5],[20.6,23],[29,23]];
  const onLine=(x,y)=>{for(let i=1;i<ecg.length;i++){const [ax,ay]=ecg[i-1],[bx,by]=ecg[i],dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy))),ex=ax+t*dx-x,ey=ay+t*dy-y;if(ex*ex+ey*ey<.55)return true}return false};
  const inTri=(x,y,a,b,c)=>{const s=(p,q,r)=>(p[0]-r[0])*(q[1]-r[1])-(q[0]-r[0])*(p[1]-r[1]);const d1=s([x,y],a,b),d2=s([x,y],b,c),d3=s([x,y],c,a);return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0))};
  for(let y=0;y<NY;y++){G.push([]);for(let x=0;x<NX;x++){
    const px=x+.5,py=y+.5,h=Math.hypot(px-10.5,py-18.5)<=6.6||Math.hypot(px-21.5,py-18.5)<=6.6||inTri(px,py,[4.1,20.5],[27.9,20.5],[16,33.5]); // two lobes and a point
    let v=0;if(h)v=onLine(px,py)?4:1;
    if(py<13&&inTri(px,py,[24,1],[11.2,13],[21,13]))v=2;                   // the hat's tall cone, its tip leaning right
    if(y===10&&v===2)v=3;                                               // its band
    if(y>=11&&y<=12&&x>=10&&x<=21)v=2;                                         // its brim, between the lobes
    G[y].push(v)}}
  return G}
const COL={1:'#f0506e',2:'#b02a4f',3:'#ffb3c1',4:null};
let host=null,cv=null,pct=null,cells=[],out=[],shown=0,want=0,raf=0,t0=0,done=false,gone=false;
function build(){const G=grid();
  for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){const v=G[y][x];
    if(v&&COL[v])cells.push({x,y,c:COL[v],t:Math.min(.98,((NY-y)/NY)*.75+Math.random()*.25),a:null,ox:(Math.random()-.5)*90,oy:-20-Math.random()*70});
    // the empty icon: grey outline cells around the shape (the ECG line is part of the shape)
    if(!v&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>G[y+dy]&&G[y+dy][x+dx]))out.push([x,y])}
  cells.sort((a,b)=>a.t-b.t);
  host=D0.createElement('div');host.id='hwload';host.setAttribute('role','progressbar');host.setAttribute('aria-label','Loading HealthWiz Kingdom');host.setAttribute('aria-valuemin','0');host.setAttribute('aria-valuemax','100');
  host.innerHTML='<canvas width="'+NX*C+'" height="'+NY*C+'" aria-hidden="true"></canvas><span class="hwlp">0%</span>';
  const st=D0.createElement('style');st.textContent='#hwload{position:fixed;inset:0;z-index:5000;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;transition:opacity .45s ease}'
    +'#hwload canvas{width:min(46vw,190px);height:auto;image-rendering:pixelated}#hwload .hwlp{font:600 11px/1 system-ui,sans-serif;color:#9a9a9a;letter-spacing:.08em;font-variant-numeric:tabular-nums}'
    +'#hwload.out{opacity:0;pointer-events:none}';
  host.appendChild(st);(D0.body||D0.documentElement).appendChild(host);cv=host.querySelector('canvas');pct=host.querySelector('.hwlp')}
function draw(now){raf=0;if(gone)return;const g=cv.getContext('2d'),rm=reduced();
  shown+=(want-shown)*Math.min(1,(now-(t0||now))/1000*4);t0=now;if(want-shown<.002)shown=want;
  g.clearRect(0,0,cv.width,cv.height);g.fillStyle='#c9c9c9';out.forEach(([x,y])=>g.fillRect(x*C,y*C,C,C));
  let moving=false;
  for(const c of cells){if(c.t>shown)break;if(c.a==null)c.a=now;const k=rm?1:Math.min(1,(now-c.a)/650),e=1-Math.pow(1-k,3);if(k<1)moving=true;
    g.globalAlpha=.25+.75*e;g.fillStyle=k<.55?'#8a8a8a':c.c; // ash grey while it drifts in, its colour once it lands
    const s=k<1?Math.max(1,C*(.45+.55*e)):C;g.fillRect(c.x*C+c.ox*(1-e)+(C-s)/2,c.y*C+c.oy*(1-e)+(C-s)/2,s,s)}
  g.globalAlpha=1;const p=Math.round(shown*100);pct.textContent=p+'%';host.setAttribute('aria-valuenow',String(p));
  if(done&&shown>=.999&&!moving){finish();return}
  raf=requestAnimationFrame(draw)}
const kick=()=>{if(!raf&&!gone)raf=requestAnimationFrame(draw)};
function set(p){want=Math.max(want,Math.min(1,p));kick()}
function finish(){if(gone)return;gone=true;host.classList.add('out');setTimeout(()=>{if(host)host.remove();host=null},500)}
/* ---------- what is loading: the scripts (to the end of parsing), the fonts, then the first page's images ---------- */
function track(){let parts={dom:0,fonts:0,img:0};const upd=()=>set(parts.dom*.45+parts.fonts*.15+parts.img*.4);
  const imgs=()=>{const L=[...D0.querySelectorAll('#main img')].filter(i=>i.currentSrc||i.src);if(!L.length){parts.img=1;upd();return Promise.resolve()}
    let n=0;const one=()=>{n++;parts.img=n/L.length;upd()};
    return Promise.all(L.map(i=>i.complete?Promise.resolve(one()):new Promise(r=>{const f=()=>{one();r()};i.addEventListener('load',f,{once:true});i.addEventListener('error',f,{once:true})})))};
  const dom=()=>{parts.dom=1;upd()};
  if(D0.readyState==='loading'){let k=0;const tick=setInterval(()=>{if(parts.dom)return clearInterval(tick);parts.dom=Math.min(.9,(++k)/12);upd()},80);D0.addEventListener('DOMContentLoaded',dom,{once:true})}else dom();
  const fonts=(D0.fonts&&D0.fonts.ready?D0.fonts.ready:Promise.resolve()).then(()=>{parts.fonts=1;upd()});
  const page=new Promise(r=>D0.readyState==='complete'?r():addEventListener('load',r,{once:true})).then(imgs);
  const min=new Promise(r=>setTimeout(r,reduced()?250:900)); // long enough to see it fill, never longer than loading
  Promise.all([fonts,page,min]).then(()=>{set(1);done=true;kick()});
  setTimeout(()=>{set(1);done=true;kick()},12000)} // never stuck: whatever has not loaded by then loads behind the app
try{build();track();kick()}catch(e){console.error('[HWLoader]',e);if(host)host.remove()}
return{get done(){return gone},finish}})();
