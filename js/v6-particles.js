/* v6: shared particle system (master prompt §64, §85, §97 step 13). Not part of the original.
   One full-screen canvas (pointer-events none) and one requestAnimationFrame loop that runs only
   while particles are alive, then stops, so an idle app costs nothing. Square pixel particles to
   match the art style. Counts come from HWMotion: scaled by visual quality, capped per mode, and
   zero when motion is reduced or off. The original water, flood and quest-complete effects keep
   their own CSS particles (thinned by Performance mode in js/v6-motion.js).
   Used for: level-up, badge, quest and all-quests moments, and title-scene taps. */
const HWFX=(()=>{
const P=[];let cv=null,cx=null,raf=0,lt=0,ptr=null;
const PAL={gold:['#f2c14e','#ffe27a','#fff8c0','#ffffff'],magic:['#b9a6ff','#ff9be0','#fff8c0','#8fd0ff'],water:['#8fd0ff','#5fb4ec','#ffffff'],leaf:['#5cc05a','#3f9f4a','#f2c14e']};
function canvas(){if(!cv){cv=document.createElement('canvas');cv.className='v6fx';cv.setAttribute('aria-hidden','true');
  cv.style.cssText='position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:90;image-rendering:pixelated';cx=cv.getContext('2d')}
  if(!cv.isConnected)document.body.appendChild(cv);
  const r=HWMotion.level()==='high'?Math.min(2,window.devicePixelRatio||1):1,w=Math.round(innerWidth*r),h=Math.round(innerHeight*r);
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}cx.setTransform(r,0,0,r,0,0);return cv}
/** Burst of n pixel particles at (x,y) in viewport px. o: {n, palette|colors, speed, gravity, up, size, life}. Returns how many were made. */
function burst(x,y,o={}){const room=HWMotion.cap()-P.length,n=Math.min(room,HWMotion.count(o.n||20));if(n<=0)return 0;canvas();
  const C=o.colors||PAL[o.palette||'gold'],sp=o.speed||3,g=o.gravity==null?.12:o.gravity;
  for(let i=0;i<n;i++){const a=o.up?-Math.PI/2+(Math.random()-.5)*1.4:Math.random()*Math.PI*2,v=sp*(.4+Math.random()*.8);
    P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(o.up?0:sp*.3),g,s:(o.size||3)+(Math.random()*2|0),c:C[i%C.length],t:0,l:(o.life||900)*(.7+Math.random()*.5)})}
  if(!raf){lt=0;raf=requestAnimationFrame(step)}return n}
function step(t){const dt=lt?Math.min(50,t-lt):16;lt=t;const f=dt/16.7;cx.clearRect(0,0,innerWidth,innerHeight);
  for(let i=P.length-1;i>=0;i--){const p=P[i];p.t+=dt;if(p.t>=p.l){P.splice(i,1);continue}p.vy+=p.g*f;p.vx*=.985;p.x+=p.vx*f;p.y+=p.vy*f;
    cx.globalAlpha=Math.max(0,1-p.t/p.l);cx.fillStyle=p.c;cx.fillRect(Math.round(p.x),Math.round(p.y),p.s,p.s)}
  cx.globalAlpha=1;if(P.length&&!HWMotion.reduced())raf=requestAnimationFrame(step);else{P.length=0;raf=0;cx.clearRect(0,0,innerWidth,innerHeight);cv.remove()}}
function clear(){P.length=0;if(raf)cancelAnimationFrame(raf);raf=0;if(cv){cx.clearRect(0,0,innerWidth,innerHeight);cv.remove()}}

/* moments (§85: every important action gets clear, short feedback; §3: no particle spam) */
const top=()=>[innerWidth/2,Math.min(150,innerHeight*.2)];
document.addEventListener('pointerdown',e=>{ptr=[e.clientX,e.clientY]},{passive:true,capture:true});
HWEvents.on('level:up',()=>{const[x,y]=top();burst(x,y+40,{n:70,palette:'gold',speed:4.5});setTimeout(()=>burst(x,y+40,{n:40,palette:'magic',speed:3,up:1}),250)});
HWEvents.on('badge:unlocked',()=>{const[x,y]=top();burst(x,y+60,{n:40,palette:'magic',speed:3.5})});
// the completion banner (js/v6-ui.js) sits top-centre; its icon is at its left edge
HWEvents.on('quest:completed',()=>burst(innerWidth/2-Math.min(140,innerWidth*.4),100,{n:22,palette:'gold',speed:2.5,up:1}));
HWEvents.on('quests:all-completed',()=>{const[x,y]=top();burst(x,y,{n:50,palette:'gold',speed:4})});
HWEvents.on('title:interact',e=>{const[x,y]=ptr||top();burst(x,y,{n:14,palette:e.k==='falls'?'water':e.k==='village'?'leaf':'magic',speed:2,gravity:.04,life:700})});
HWEvents.on('motion:changed',e=>{if(!e.enabled||e.reduced)clear()});
return{burst,clear,get live(){return P.length},get running(){return !!raf}}})();
