/* v6: Stair Sight, the step finder behind the Scrying Glass (js/v6-arcana.js). Not part of the original.
   A simple 2D picture analysis, not 3D understanding: the camera frame is shrunk to 64 × 80 grey pixels (cropped like the stage, 4 : 5) and
   each row is scored for HORIZONTAL edges (|∂I/∂y| minus 0.7 |∂I/∂x|, so walls, rails and people's legs count little) in the middle 70 %.
   The nosing of a step is a long horizontal edge, so a stairway seen from below shows as a stack of strong rows whose gaps stay even or
   shrink upward (perspective). The tracker smooths the row scores over time and only LOCKS after 3 good frames in a row; 6 bad frames
   unlock it. Locked, it returns the step edges bottom first, each with its left and right ends, in the 64 × 80 grid.
   What it cannot do: tell a stair from a ladder, a striped wall or a bookshelf; see steps in the dark, in glare, or at a steep sideways
   view. So the result is always called "seen", never measured, and nothing from it is saved. Frames are read only while the Scrying Glass
   is open, about 8 a second, and never leave the device. */
const HWStairSight=(()=>{
const DW=64,DH=80;

/** Row scores of one grey frame (Float32Array DW × DH, 0–255). Pure. → {prof, e} (e: the per-pixel horizontal-edge strength). */
function rows(g,w,h){
  const prof=new Float32Array(h),e=new Float32Array(w*h),xa=Math.floor(w*.15),xb=Math.ceil(w*.85);
  for(let y=1;y<h-1;y++){let s=0;
    for(let x=Math.max(1,xa);x<Math.min(w-1,xb);x++){const i=y*w+x,gy=Math.abs(g[i+w]-g[i-w]),gx=Math.abs(g[i+1]-g[i-1]),v=Math.max(0,gy-.7*gx);e[i]=v;s+=v}
    prof[y]=s/(xb-xa)}
  return{prof,e}}

/** Step edges from a (smoothed) row profile. Pure. → {ok, edges:[{y,x0,x1,s}] bottom first, why} */
function edges(prof,e,w,h){
  const ys=[];let m=0,n=0;for(let y=2;y<h-2;y++){m+=prof[y];n++}m/=n;let v=0;for(let y=2;y<h-2;y++)v+=(prof[y]-m)**2;const sd=Math.sqrt(v/n);
  const th=Math.max(6,m+.6*sd);
  for(let y=2;y<h-2;y++){const p=prof[y];if(p<th)continue;let top=true;for(let d=-2;d<=2;d++)if(d&&prof[y+d]>p){top=false;break}if(top)ys.push(y)}
  const keep=[];ys.forEach(y=>{const l=keep[keep.length-1];if(l!=null&&y-l<3){if(prof[y]>prof[l])keep[keep.length-1]=y}else keep.push(y)});
  const xa=Math.floor(w*.15),xb=Math.ceil(w*.85),out=[];
  keep.forEach(y=>{let mx=0;for(let x=xa;x<xb;x++)mx=Math.max(mx,e[y*w+x],e[(y-1)*w+x]||0,e[(y+1)*w+x]||0);
    const c=x=>Math.max(e[y*w+x],e[(y-1)*w+x]||0,e[(y+1)*w+x]||0)>.35*mx;let x0=-1,x1=-1;for(let x=xa;x<xb;x++)if(c(x)){if(x0<0)x0=x;x1=x}
    if(x0>=0&&x1-x0>=(xb-xa)*.3)out.push({y,x0,x1:x1+1,s:prof[y]})});
  out.sort((a,b)=>b.y-a.y);                                                                   // bottom (nearest) first
  const ch=chain(out);
  if(ch.filter(e=>!e.fill).length<4)return{ok:false,edges:ch,why:'no stack of 4 or more step edges'};
  return{ok:true,edges:ch,why:''}}

/** The longest run of edges that looks like steps seen from below: each gap 0.45–1.35 × the one before (equal, or shrinking with
    distance). A gap of about twice the expected one (1.6–2.5 ×) is taken as one missed step and filled in halfway. Pure. */
function chain(L){
  let best=[];
  for(let i=0;i<L.length-1;i++)for(let j=i+1;j<L.length;j++){
    let run=[L[i],L[j]],gap=L[i].y-L[j].y,k=j;if(gap<2)continue;
    if(!fits(L[i],L[j]))continue;
    for(let m=k+1;m<L.length;m++){const gg=run[run.length-1].y-L[m].y,r=gg/gap;
      if(!fits(run[run.length-1],L[m])){if(r<.45)continue;break}
      if(r>=.45&&r<=1.35){run.push(L[m]);gap=gg}
      else if(r>=1.6&&r<=2.5){const p=run[run.length-1],q=L[m];run.push({y:(p.y+q.y)/2,x0:(p.x0+q.x0)/2,x1:(p.x1+q.x1)/2,s:0,fill:1},q);gap=gg/2}
      else if(r<.45)continue;                                                                      // a stray edge between two steps: skip it
      else break}
    const real=run.filter(e=>!e.fill).length,fill=run.length-real;if(fill*3<=real&&real>best.filter(e=>!e.fill).length)best=run}
  return best}
/** The next step up overlaps the one below it side to side (at least 60 % of the narrower) and is no more than 15 % wider. */
function fits(lo,hi){const ov=Math.min(lo.x1,hi.x1)-Math.max(lo.x0,hi.x0),wl=lo.x1-lo.x0,wh=hi.x1-hi.x0;return ov>=.6*Math.min(wl,wh)&&wh<=wl*1.15+1}

/* ---------- 3D: steps from depth (the WebXR mode, observatory/xrstairs.js) ----------
   Input: points {d, h} in metres, d = horizontal distance forward from the phone, h = height (any zero). Sorted by d, they are grouped
   into flat PLATEAUS (heights within 3 cm, at least 8 cm long); neighbouring plateaus at the same height merge. A stairway is a run of plateaus each 8–25 cm
   above the one before and starting within 12 cm of its end (a riser is nearly vertical; a ramp is not). Locked when there are at least 3 plateaus (floor + 2 treads). → {ok, riser, tread, angle, base, plateaus}
   riser = median height step; tread = median forward distance between the fronts of the middle plateaus (the floor and the last one
   seen may be cut off); base = the d of the first riser; angle = atan(riser ÷ tread). All in metres and degrees: an AR estimate. */
function profile3d(pts){
  const P=pts.filter(p=>p&&isFinite(p.d)&&isFinite(p.h)&&p.d>.15&&p.d<8).sort((a,b)=>a.d-b.d);if(P.length<8)return{ok:false,why:'too few depth points'};
  const med=a=>{const b=a.slice().sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
  let G=[];P.forEach(p=>{const g=G[G.length-1];if(g&&Math.abs(p.h-g.hm)<.03){g.pts.push(p);g.hm=med(g.pts.map(q=>q.h));g.d1=p.d}else G.push({pts:[p],hm:p.h,d0:p.d,d1:p.d})});
  G=G.filter(g=>g.pts.length>=2||g.d1-g.d0>=.05);
  const M=[];G.forEach(g=>{const l=M[M.length-1];if(l&&Math.abs(l.hm-g.hm)<.03){l.pts.push(...g.pts);l.hm=med(l.pts.map(q=>q.h));l.d1=g.d1}else M.push(g)});
  const F=M.filter(g=>g.d1-g.d0>=.08);                                                         // a tread is flat for at least 8 cm (a ramp is not)
  let best=[];
  for(let i=0;i<F.length;i++){const run=[F[i]];for(let j=i+1;j<F.length;j++){const l=run[run.length-1],dh=F[j].hm-l.hm;
      if(dh>=.08&&dh<=.25&&F[j].d0-l.d1<=.12)run.push(F[j]);else if(dh<.08&&dh>-.03)continue;else break}
    if(run.length>best.length)best=run}
  if(best.length<3)return{ok:false,why:'no stack of 3 levels a step apart',plateaus:best.length};
  const rises=best.slice(1).map((g,i)=>g.hm-best[i].hm),fronts=best.map(g=>g.d0),runs=fronts.slice(2).map((f,i)=>f-fronts[i+1]);
  const riser=med(rises),tread=runs.length?runs.reduce((a,b)=>a+b,0)/runs.length:best[1].d1-best[1].d0;
  if(!(tread>=.18&&tread<=.5))return{ok:false,why:'tread out of range ('+tread.toFixed(2)+' m)'};
  return{ok:true,riser,tread,angle:Math.atan(riser/tread)*180/Math.PI,base:best[1].d0,floor:best[0].hm,plateaus:best.length,why:''}}

/* ---------- the ghost's pace along the real shape (2D views, the Scrying Glass and the 3D mode) ----------
   flights: [{n, riser, tread, turn}] in metres (one entry per flight, bottom first). At a constant power P (W), lifting a mass m (kg) up one
   riser r takes t = m g r ÷ P seconds (W = m g h, P = W ÷ t), so a taller step takes longer. Between flights a LANDING takes 2 step-times of
   the flight below and is LAND metres long when the survey gives no length (both assumptions, said on screen).
   place() gives the ghost's point on the unfolded profile: d forward and h up from the foot of the first riser. Within one step the body
   lifts over the riser during the first 55 % of the step (eased) while it moves forward the whole step, so the path follows each riser and
   tread rather than a straight slope. */
const LAND=1.2,G0=9.80665;
const ease=u=>u<=0?0:u>=1?1:u*u*(3-2*u);
function timeline(flights,P,m){
  const segs=[];let t=0,k=0;if(!(P>0&&m>0))return{segs,total:0,n:flights.reduce((a,f)=>a+f.n,0)};
  flights.forEach((f,fi)=>{const dur=m*G0*f.riser/P;for(let i=0;i<f.n;i++){segs.push({type:'step',k,fi,i,t0:t,dur});t+=dur;k++}
    if(fi<flights.length-1){const d=2*dur;segs.push({type:'landing',fi,t0:t,dur:d});t+=d}});
  return{segs,total:t,n:k}}
/** Where on the timeline time t (s) falls, looping at the top. → {seg, u (0–1 within it)} */
function at(T,t){if(!T.total)return null;const x=((t%T.total)+T.total)%T.total;let lo=0,hi=T.segs.length-1;
  while(lo<hi){const mid=(lo+hi+1)>>1;if(T.segs[mid].t0<=x)lo=mid;else hi=mid-1}const g=T.segs[lo];return{seg:g,u:Math.min(1,(x-g.t0)/g.dur)}}
/** Start of each flight on the unfolded profile (d0, h0) and its landing length. */
function layout(flights){let d=0,h=0;return flights.map((f,i)=>{const o={d0:d,h0:h,land:f.land>0?f.land:LAND};d+=f.n*f.tread+(i<flights.length-1?o.land:0);h+=f.n*f.riser;return o})}
function place(flights,L,p){
  if(!p)return{d:-.3,h:0,fi:0,k:-1,landing:false};
  const g=p.seg,f=flights[g.fi],o=L[g.fi];
  if(g.type==='landing'){const e=ease(p.u);return{d:o.d0+f.n*f.tread-f.tread/2+e*(o.land+f.tread/2),h:o.h0+f.n*f.riser,fi:g.fi,k:-1,landing:true,lu:e}}
  return{d:o.d0+(g.i-.5+ease(p.u))*f.tread,h:o.h0+(g.i+ease(p.u/.55))*f.riser,fi:g.fi,k:g.k,i:g.i,landing:false,u:p.u}}

/** Reads a video into the grid, cropped like a 4 : 5 stage (object-fit: cover). → Float32Array or null (not ready, or not readable). */
function sampler(){
  const c=document.createElement('canvas');c.width=DW;c.height=DH;const x=c.getContext('2d',{willReadFrequently:true}),g=new Float32Array(DW*DH);
  return{read(v,aspect){if(!x||!v||v.readyState<2||!v.videoWidth)return null;const vw=v.videoWidth,vh=v.videoHeight;let sx=0,sy=0,sw=vw,sh=vh;
      if(vw/vh>aspect){sw=vh*aspect;sx=(vw-sw)/2}else{sh=vw/aspect;sy=(vh-sh)/2}
      try{x.drawImage(v,sx,sy,sw,sh,0,0,DW,DH);const d=x.getImageData(0,0,DW,DH).data;for(let i=0,j=0;i<g.length;i++,j+=4)g[i]=.3*d[j]+.59*d[j+1]+.11*d[j+2];return g}
      catch(e){return null}}}}

/** Smooths frames over time and decides when stairs are seen. push(grey) → {locked, edges, why} */
function tracker(){
  let P=null,good=0,bad=0,locked=false,last=[],why='looking';
  return{push(g){const R=rows(g,DW,DH);if(!P)P=Float32Array.from(R.prof);else for(let i=0;i<DH;i++)P[i]=P[i]*.6+R.prof[i]*.4;
      const E=edges(P,R.e,DW,DH);why=E.why;
      if(E.ok){good++;bad=0;last=E.edges;if(good>=3)locked=true}else{bad++;good=0;if(bad>=6){locked=false;last=[]}}
      return this.state},
    get state(){return{locked,edges:locked?last:[],why}}}}

return{DW,DH,rows,edges,chain,sampler,tracker,profile3d,timeline,at,layout,place,ease,LAND}})();
