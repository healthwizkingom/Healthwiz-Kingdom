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

return{DW,DH,rows,edges,chain,sampler,tracker}})();
