/* v6: Pulse Wave Lab, a camera pulse estimate (photoplethysmography, PPG). Not part of the original.
   Shown in the Heartstone Hall · Heart Rate card on the Stairs page, before the smartwatch panel (js/v6-stairs.js).
   * The user covers the back camera (and flash) with a fingertip for about 20 s. Each heartbeat changes the blood volume in
     the fingertip, so the red light reaching the camera dips once per beat. We average the red channel of the centre of every
     frame, filter 0.7–3.5 Hz (42–210 BPM), count the peaks and read BPM = 60 ÷ median RR interval.
   * Pure functions (resample, detrend, bandpass, findPeaks, analyze) are exported so tests can feed synthetic signals.
   * The result is a CAMERA ESTIMATE held in memory only. "USE AS BEFORE / AFTER / 1 MIN AFTER" (acts.ppguse in js/v6-stairs.js)
     puts it in the workout field like a Bluetooth reading; nothing is saved until the user presses LOG BPM or SEAL THE WORKOUT.
   * Video never leaves the phone and nothing is recorded: frames are drawn to a 40×30 canvas, one average number is kept per
     frame, and the series lives in memory for the measurement only. Every camera track is stopped (flash off) on finish, cancel,
     page change, errors, a hidden page and after 35 s.
   * Never a diagnosis: the spread of the beat intervals is used only to decide whether the signal was clean enough to read.
   Where the camera is missing or the page is not a secure context, there is no button, only the 15 s × 4 hint. */
const HWPPG=(()=>{
const D=document,N=navigator;
const FS=30,F_LO=.7,F_HI=3.5,MIN_RR=60/210,MAX_RR=1.5,GAP=.35,SEG_MIN=3,TRIM=.5; // Hz, s
const GOOD_MS=20e3,MAX_MS=35e3,MIN_BEATS=12,MIN_RATIO=.8,MAX_IQR=.15,MIN_REPEAT=.5,NO_REPEAT=.35,LIVE_BEATS=6;
const ico=(n,o)=>HWPixel.icon(n,o||1);
const supported=()=>!!(N.mediaDevices&&typeof N.mediaDevices.getUserMedia==='function')&&(typeof isSecureContext==='undefined'||isSecureContext);

/* ---------- pure signal processing (tests call these) ---------- */
const sorted=a=>a.slice().sort((x,y)=>x-y);
const pct=(s,p)=>{if(!s.length)return 0;const i=(s.length-1)*p,l=Math.floor(i),h=Math.ceil(i);return s[l]+(s[h]-s[l])*(i-l)};
const median=a=>pct(sorted(a),.5);
/** Samples [{t (s), v}] with uneven timestamps → values on a uniform grid (linear interpolation). */
function resample(S,fs){fs=fs||FS;const n=S.length;if(n<2)return{t0:n?S[0].t:0,fs,y:[]};
  const t0=S[0].t,M=Math.floor((S[n-1].t-t0)*fs)+1,y=new Array(M);let j=0;
  for(let i=0;i<M;i++){const t=t0+i/fs;while(j<n-2&&S[j+1].t<t)j++;const a=S[j],b=S[j+1],u=b.t>a.t?(t-a.t)/(b.t-a.t):0;y[i]=a.v+(b.v-a.v)*Math.min(1,Math.max(0,u))}
  return{t0,fs,y}}
/** Drift removal: subtract a moving average of about 1 s (centred, shorter at the ends). */
function detrend(y,fs){fs=fs||FS;const n=y.length,h=Math.floor(fs/2),cs=new Array(n+1);cs[0]=0;for(let i=0;i<n;i++)cs[i+1]=cs[i]+y[i];
  return y.map((v,i)=>{const lo=Math.max(0,i-h),hi=Math.min(n-1,i+h);return v-(cs[hi+1]-cs[lo])/(hi-lo+1)})}
// 2nd-order Butterworth biquads (RBJ cookbook, Q = 1/√2)
function biquad(type,f0,fs){const w=2*Math.PI*f0/fs,c=Math.cos(w),a=Math.sin(w)*Math.SQRT1_2,a0=1+a,k=type==='hp'?1:-1;
  return{b:[(1+k*c)/2/a0,-k*(1+k*c)/a0,(1+k*c)/2/a0],a:[-2*c/a0,(1-a)/a0]}}
function run(x,f){const y=new Array(x.length);let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){const v=f.b[0]*x[i]+f.b[1]*x1+f.b[2]*x2-f.a[0]*y1-f.a[1]*y2;y[i]=v;x2=x1;x1=x[i];y2=y1;y1=v}return y}
// forward then backward (no phase shift), with the ends extended by a mirrored copy so the filter does not ring at the edges
function zero(x,f){const n=x.length,P=Math.min(n-1,45);if(n<4)return x.slice();const e=[];
  for(let i=P;i>=1;i--)e.push(2*x[0]-x[i]);for(let i=0;i<n;i++)e.push(x[i]);for(let i=1;i<=P;i++)e.push(2*x[n-1]-x[n-1-i]);
  const a=run(e,f).reverse(),b=run(a,f).reverse();return b.slice(P,P+n)}
/** Band-pass 0.7–3.5 Hz: a high-pass and a low-pass biquad, each run forward and backward. */
function bandpass(y,fs){fs=fs||FS;return zero(zero(y,biquad('hp',F_LO,fs)),biquad('lp',F_HI,fs))}
/** Peaks of y (index, refined position, height): above 35% of the 95th-percentile height, at least 60/210 s apart. */
function findPeaks(y,fs,o){fs=fs||FS;o=o||{};const n=y.length,minD=Math.ceil((o.minGap||MIN_RR)*fs),amp=pct(sorted(y),.95),thr=(o.frac||.35)*amp,P=[];
  if(!(amp>0))return P;
  for(let i=1;i<n-1;i++){if(!(y[i]>=y[i-1]&&y[i]>y[i+1]&&y[i]>thr))continue;const L=P[P.length-1];
    if(L&&i-L.i<minD){if(y[i]>L.h){L.i=i;L.h=y[i]}continue}P.push({i,h:y[i]})}
  P.forEach(p=>{const a=y[p.i-1],b=y[p.i],c=y[p.i+1],d=a-2*b+c;p.x=p.i+(d<0?Math.max(-.5,Math.min(.5,.5*(a-c)/d)):0)});return P}
/** How well the wave repeats one beat later: the best normalised autocorrelation of y for lags within ±20% of T seconds (about 1 for a clean pulse, near 0 for noise). */
function repeat(y,fs,T){const n=y.length,m=y.reduce((a,v)=>a+v,0)/n,z=y.map(v=>v-m),e=z.reduce((a,v)=>a+v*v,0);if(!(e>0))return 0;let best=-1;
  for(let L=Math.max(2,Math.floor(.8*T*fs));L<=Math.ceil(1.2*T*fs)&&L<n-fs/2;L++){let s=0;for(let i=0;i+L<n;i++)s+=z[i]*z[i+L];best=Math.max(best,s/e*n/(n-L))}return best}
/** Loudness (RMS) of each 1 s window of y, hopping half a second. A finger that slips or a hand that moves makes some windows several times louder than the quiet ones. */
function loud(y,fs){const o=[],w=Math.round(fs),h=Math.round(fs/2);for(let i=0;i+w<=y.length;i+=h){let s=0;for(let k=i;k<i+w;k++)s+=y[k]*y[k];o.push(Math.sqrt(s/w))}return o}
/** Split samples [{t (s), v}] where the camera stopped delivering (finger lifted, dropped frames). */
function segments(P){const S=[];let c=[];P.forEach((p,i)=>{if(i&&p.t-P[i-1].t>GAP){S.push(c);c=[]}c.push(p)});if(c.length)S.push(c);return S}
/** One continuous segment → filtered, inverted (more blood = darker = up) wave and its peaks, with the filter's ends trimmed. */
function wave(seg){const r=resample(seg),tr=Math.round(TRIM*FS);if(r.y.length<2*tr+FS)return null;
  const y=bandpass(detrend(r.y,FS),FS).map(v=>-v).slice(tr,r.y.length-tr),t0=r.t0+tr/FS;return{t0,fs:FS,y,pk:findPeaks(y,FS)}}
/** Everything the page needs from the samples [{t (ms), v (red level)}]:
    {ok, bpm (whole BPM, only when quality is 'good'), raw (the unchecked estimate, for the live view only), beats, rr[] (s),
     quality: 'good'|'weak'|'none', why: ''|'short'|'few'|'moved'|'uneven', secs, q (0–1), ratio, iqr, per (repeat score), wave, peaks (s), fit} */
function analyze(S){const o={ok:false,bpm:null,raw:null,beats:0,rr:[],quality:'none',why:'short',secs:0,q:0,ratio:0,iqr:null,per:0,mv:0,wave:null,peaks:[],fit:null};
  if(!S||S.length<20)return o;
  const P=S.map(s=>({t:s.t/1000,v:+s.v})).filter(p=>isFinite(p.t)&&isFinite(p.v)),segs=segments(P).filter(s=>s.length>1&&s[s.length-1].t-s[0].t>=SEG_MIN);
  o.secs=segs.reduce((a,s)=>a+s[s.length-1].t-s[0].t,0);if(!segs.length)return o;
  const cand=[];let id=0,last=null,longest=null,L=[];
  segs.forEach(s=>{const w=wave(s);if(!w)return;last=w;if(!longest||w.y.length>longest.y.length)longest=w;const ids=w.pk.map(p=>({id:id++,t:w.t0+p.x/FS}));w.ids=ids;L=L.concat(loud(w.y,FS));
    for(let i=1;i<ids.length;i++)cand.push({rr:ids[i].t-ids[i-1].t,a:ids[i-1].id,b:ids[i].id})});
  if(!last)return o;
  // quiet reference = the 25th percentile of the 1 s loudness values, so a lot of motion cannot hide itself
  const lm=pct(sorted(L),.25),mv=L.length&&lm>0?L.filter(v=>v>2.5*lm).length/L.length:0,moved=mv>.07;o.mv=mv;
  const inR=cand.filter(c=>c.rr>=MIN_RR&&c.rr<=MAX_RR);
  o.wave={t0:last.t0,fs:FS,y:last.y};o.peaks=last.ids.map(p=>p.t);
  if(!inR.length){if(moved)o.quality='weak';o.why=moved?'moved':'few';return o}
  const m1=median(inR.map(c=>c.rr)),acc=inR.filter(c=>Math.abs(c.rr-m1)<=.25*m1);
  if(!acc.length){if(moved)o.quality='weak';o.why=moved?'moved':'uneven';return o}
  const rr=acc.map(c=>c.rr),med=median(rr),ids=new Set();acc.forEach(c=>{ids.add(c.a);ids.add(c.b)});
  const sr=sorted(rr),iqr=(pct(sr,.75)-pct(sr,.25))/med,ratio=acc.length/cand.length;
  const per=repeat(longest.y,FS,med);Object.assign(o,{raw:60/med,beats:ids.size,rr,ratio,iqr,per,q:Math.max(0,Math.min(1,ratio*Math.min(1,ids.size/MIN_BEATS)*Math.min(1,per/.5)))});
  const f=1/med,win=last.y.slice(-Math.round(4*FS)),A=Math.SQRT2*Math.sqrt(win.reduce((a,v)=>a+v*v,0)/Math.max(1,win.length));
  o.fit={f,A,tp:o.peaks.length?o.peaks[0]:last.t0};
  if(!moved&&ids.size>=MIN_BEATS&&ratio>=MIN_RATIO&&iqr<=MAX_IQR&&per>=MIN_REPEAT){o.ok=true;o.quality='good';o.why='';o.bpm=Math.round(60/med);return o}
  if(moved&&acc.length>=3){o.quality='weak';o.why='moved';return o}
  if(acc.length>=5&&ratio>=.5&&per>=NO_REPEAT){o.quality='weak';o.why=ids.size<MIN_BEATS&&ratio>=MIN_RATIO&&iqr<=MAX_IQR&&per>=MIN_REPEAT?'few':'uneven';return o}
  o.why=moved?'moved':o.secs<8?'short':'few';return o}

/* ---------- the measurement ---------- */
// state: 'idle' | 'ask' (waiting for the camera permission) | 'run' | 'done'
let phase='idle',R=null,msg='',denied=false,sheet=false,gen=0;
// target: the workout field a measurement started from a camera button beside it (b, a, r) fills, and logs for b / a, when it finishes
let pend=null,target=null;const TL={b:'BEFORE',a:'AFTER',r:'1 MIN AFTER'};
let stream=null,vid=null,cvs=null,cx=null,tick=0,raf=0,vfc=0,torch=false,sam=[],goodMs=0,lastT=0,t0=0,frames=0,seen=0,finger=false,lastCT=-1,live=null,dark=0,live_s=-1;
const clearRun=()=>{sam=[];goodMs=0;lastT=0;frames=0;seen=0;finger=false;live=null;lastCT=-1;dark=0;live_s=-1};
function stopCam(){clearInterval(tick);tick=0;if(raf)cancelAnimationFrame(raf);raf=0;
  try{if(vfc&&vid&&vid.cancelVideoFrameCallback)vid.cancelVideoFrameCallback(vfc)}catch(e){}vfc=0;
  const s=stream;stream=null;
  if(s)s.getTracks().forEach(t=>{try{if(torch)t.applyConstraints({advanced:[{torch:false}]}).catch(()=>{})}catch(e){}try{t.stop()}catch(e){}});
  if(vid){try{vid.pause()}catch(e){}vid.srcObject=null;if(vid.parentNode)vid.parentNode.removeChild(vid)}
  vid=null;cvs=null;cx=null;torch=false}
function cancel(m){gen++;target=null;const was=phase==='run'||phase==='ask';stopCam();if(was){phase='idle';msg=m||''}paint()}
function fail(m){gen++;target=null;stopCam();phase='idle';msg=m;paint()}

async function start(){if(!supported()||phase==='ask'||phase==='run')return;closeSheet();stopCam();clearRun();R=null;msg='';target=pend;phase='ask';paint();const g=++gen;let s;
  try{s=await N.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:160},height:{ideal:120},frameRate:{ideal:30}},audio:false})}
  catch(e){if(g!==gen)return;const nm=e&&e.name;
    if(nm==='NotAllowedError'||nm==='SecurityError'||nm==='PermissionDeniedError'){denied=true;fail('Camera permission was not given. You can still count your pulse by hand.')}
    else fail('The camera could not be started'+(nm==='NotFoundError'||nm==='OverconstrainedError'?' (no camera found)':nm==='NotReadableError'?' (another app may be using it)':'')+'. You can still count your pulse by hand.');return}
  if(g!==gen){s.getTracks().forEach(t=>t.stop());return}
  stream=s;const tr=s.getVideoTracks()[0];
  try{const c=tr&&tr.getCapabilities&&tr.getCapabilities();if(c&&c.torch){await tr.applyConstraints({advanced:[{torch:true}]});torch=true}}catch(e){torch=false}
  if(g!==gen){stopCam();return}
  vid=D.createElement('video');vid.muted=true;vid.playsInline=true;vid.setAttribute('playsinline','');vid.setAttribute('aria-hidden','true');
  vid.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';vid.srcObject=s;D.body.appendChild(vid);
  cvs=D.createElement('canvas');cvs.width=40;cvs.height=30;cx=cvs.getContext('2d',{willReadFrequently:true});
  try{await vid.play()}catch(e){}
  if(g!==gen)return;
  phase='run';t0=lastT=performance.now();paint();
  const next=()=>{if(g!==gen||phase!=='run'||!vid)return;if(vid.requestVideoFrameCallback)vfc=vid.requestVideoFrameCallback(()=>onFrame(g,next));else raf=requestAnimationFrame(()=>onFrame(g,next))};
  next();tick=setInterval(()=>{if(g!==gen)return;onTick(g)},HWUI.reduced()?1000:150)}
function onFrame(g,next){if(g!==gen||phase!=='run'||!vid||!cx)return;const now=performance.now();
  if(vid.videoWidth&&(vid.requestVideoFrameCallback||vid.currentTime!==lastCT)){lastCT=vid.currentTime;
    try{cx.drawImage(vid,0,0,40,30);const d=cx.getImageData(10,8,20,14).data;let r=0,gg=0,b=0;const n=d.length/4;
      for(let i=0;i<d.length;i+=4){r+=d[i];gg+=d[i+1];b+=d[i+2]}r/=n;gg/=n;b/=n;frames++;
      const dt=Math.min(200,now-lastT);finger=r>=60&&r>1.4*gg&&r>1.3*b;
      if(finger){sam.push({t:now,v:r});goodMs+=dt;seen++}else if(r<60)dark++}catch(e){}}
  lastT=now;next()}
function finish(){gen++;const a=analyze(sam),secs=Math.round(goodMs/1000);stopCam();phase='done';
  if(a.ok&&a.bpm>=30&&a.bpm<=220){const w=a.wave,n=Math.round(6*FS),y=w.y.slice(-n);
    R={bpm:a.bpm,beats:a.beats,secs,f:a.fit.f,A:a.fit.A,tp:a.fit.tp,w:{t0:w.t0+(w.y.length-y.length)/FS,fs:FS,y},peaks:a.peaks.slice(),quality:'good'};msg=''}
  else{R=null;msg=whyText(a.why,seen<frames*.5)}
  const t=R?target:null;if(R)target=null;paint();if(t&&typeof acts.ppgauto==='function')acts.ppgauto({k:t})}
function whyText(w,nofinger){
  if(nofinger&&dark>frames*.3)return'It was too dark to read your pulse. Cover the camera and flash fully, or find brighter room light.';
  if(nofinger)return'Your finger was not covering the camera for much of the time. Cover the camera and flash with your fingertip.';
  return w==='moved'?'The signal jumped around, so you probably moved. Rest your hand on a table and keep still.'
    :w==='uneven'?'The signal was too uneven to count reliably. Press a little more lightly, keep still and try again.'
    :w==='short'?'There was not enough clear signal yet. Keep your fingertip on the camera and flash for the full time.'
    :'Not enough clear beats were found. Cover the camera and flash fully, keep still and try again.'}
function onTick(g){if(g!==gen||phase!=='run')return;const now=performance.now();
  if(now-t0>=MAX_MS||goodMs>=GOOD_MS){finish();return}
  if(!frames&&now-t0>6e3){fail('The camera is not sending pictures. You can still count your pulse by hand.');return}
  if(Math.floor((now-t0)/1000)!==live_s||!live){live=analyze(sam);live_s=Math.floor((now-t0)/1000)}
  upd()}

/* ---------- panel ---------- */
const $=i=>D.getElementById(i);
function helpReg(){HWHelp.reg('ppg','Pulse Wave Lab',
  '<p>Each heartbeat pushes a little blood into your fingertip. More blood absorbs more red light, so the red light reaching the camera dips once per beat. That is called photoplethysmography.</p>'
  +'<p>We average the red channel of every frame, remove slow drift, keep only 0.7–3.5 Hz (42–210 beats a minute) and count the peaks.</p>'
  +'<p><b>f</b> (Hz) = 1 ÷ T · <b>T</b> (s) is the time between two beats · <b>ω</b> (rad/s) = 2πf. The thin line is a sine wave with the same f fitted to your wave.</p>'
  +'<p class="mut">It is an estimate, not a medical measurement, and it says nothing about your heart rhythm. It is less reliable right after exercise, if you move, or in poor light. If it looks wrong, count for 15 s and multiply by 4. Video never leaves your phone and nothing is recorded.</p>','ppg')}
function panel(){helpReg();Promise.resolve().then(draw);
  let h='<div class="ppg" id="hwppg">';
  if(!supported())return h+'<p class="mut">Your browser can\'t use the camera here; count your pulse for 15 s and multiply by 4.</p></div>';
  if(phase==='ask')h+='<div class="ppgrow"><b>'+ico('camera')+' CAMERA PULSE</b></div>'+tgtNote()+'<p role="status">Waiting for the camera… If asked, allow it so the app can read the colour of your fingertip.</p><div class="row"><button class="g" data-a="ppgcancel">CANCEL</button></div>';
  else if(phase==='run')h+=runView();
  else if(phase==='done'&&R)h+=resultView();
  else{h+='<div class="ppgrow">'+(denied?'':'<button class="ppgbtn" data-a="ppgopen" data-k="'+(msg&&phase==='done'&&target?target:'')+'">'+ico('camera')+' '+(msg&&phase==='done'?'MEASURE AGAIN':'MEASURE WITH CAMERA')+'</button>')+HWHelp.btn('ppg')+'</div>';
    if(msg)h+=(target?tgtNote():'')+'<p class="ppgmsg" role="status">'+esc(msg)+'</p>'+(denied?'<small class="mut">To try again, allow the camera for this site in your browser settings and reload the page.</small>':'')}
  return h+'</div>'}
function runView(){const left=Math.max(0,Math.ceil((GOOD_MS-goodMs)/1000));
  return '<div class="ppgrow"><b>'+ico('camera')+' CAMERA PULSE</b>'+HWHelp.btn('ppg')+'</div>'
    +tgtNote()+'<canvas class="ppgc" id="ppg-live" role="img" aria-label="Your pulse wave, live"></canvas>'
    +'<p class="ppgmsg" id="ppg-st" role="status">'+stText()+'</p>'
    +'<div class="ppgline"><b class="num ppgbpm" id="ppg-bpm" aria-live="off">'+liveBpm()+'</b> <span>BPM</span><span class="ppgleft" id="ppg-left">'+left+' s left</span></div>'
    +'<div class="ppgq" aria-hidden="true"><i id="ppg-q" style="width:'+Math.round((live?live.q:0)*100)+'%"></i></div><small class="mut">Signal strength</small>'
    +'<div class="row"><button class="g" data-a="ppgcancel">CANCEL</button></div>'}
const tgtNote=()=>target?'<p class="ppgtgt" role="status">'+(target==='r'?'When it is ready, it is filled in as <b>1 MIN AFTER</b> (saved with the workout).':'When it is ready, it is filled in and logged as <b>'+TL[target]+'</b>.')+'</p>':'';
const liveBpm=()=>live&&live.raw&&live.beats>=LIVE_BEATS&&live.per>=NO_REPEAT?String(Math.round(live.raw)):'--';
const stText=()=>(!frames?'Starting the camera…':!finger?'<b>Cover the camera and flash with your fingertip.</b> The countdown waits for you.'
  :liveBpm()==='--'?'Finding your pulse… hold still.':'Hold still. Reading your pulse…')+(torch?'':' <span class="mut">No flash: use good room light.</span>');
function upd(){const st=$('ppg-st');if(!st){return}
  const t=stText();if(st.innerHTML!==t)st.innerHTML=t;const b=$('ppg-bpm');if(b){const v=liveBpm();if(b.textContent!==v)b.textContent=v}
  const l=$('ppg-left');if(l){const v=Math.max(0,Math.ceil((GOOD_MS-goodMs)/1000))+' s left';if(l.textContent!==v)l.textContent=v}
  const q=$('ppg-q');if(q)q.style.width=Math.round((live?live.q:0)*100)+'%';drawLive()}
function resultView(){const S=HWStairs,m=S.pulseSHM(R.bpm);
  return '<div class="ppgrow"><b>'+ico('camera')+' CAMERA PULSE</b>'+HWHelp.btn('ppg')+'</div>'
    +'<div class="ppgres"><span class="pxtag">CAMERA ESTIMATE</span><div class="ppgline"><b class="num ppgbpm" id="ppg-res">'+R.bpm+'</b> <span>BPM</span></div>'
    +'<p id="ppg-shm">'+esc(S.shmTxt(m))+'</p>'
    +'<canvas class="ppgc ppgfit" id="ppg-fit" role="img" aria-label="The last seconds of your pulse wave with a fitted sine wave, f = '+m.f.toFixed(2)+' Hz, T = '+m.T.toFixed(2)+' s"></canvas>'
    +'<small class="mut">Solid line: your measured wave. Dashed line: fitted sine, f = '+m.f.toFixed(2)+' Hz. T = '+m.T.toFixed(2)+' s is the time between two beats.</small>'
    +'<p class="ppgbased">Based on '+R.beats+' beats over '+R.secs+' s.</p>'
    +'<div class="row ppgbtns">'+[['b','BEFORE'],['a','AFTER'],['r','1 MIN AFTER']].map(x=>'<button data-a="ppguse" data-k="'+x[0]+'">'+ico('camera')+' USE AS '+x[1]+'</button>').join('')+'<button class="g" data-a="ppgopen">MEASURE AGAIN</button></div>'
    +'<small class="mut">Camera readings are usually close at rest but less reliable right after exercise or if you move. If it looks wrong, count for 15 s and multiply by 4.</small></div>'}
function paint(){const el=$('hwppg');if(!el)return;const a=D.activeElement,f=a&&el.contains(a)&&a.dataset?a.dataset.a+(a.dataset.k||''):null;
  el.outerHTML=panel();if(f){const n=$('hwppg'),b=n&&[...n.querySelectorAll('button')].find(x=>x.dataset.a+(x.dataset.k||'')===f&&!x.disabled);if(b)b.focus()}}

/* ---------- drawing ---------- */
function setup(c){const dpr=Math.min(2,window.devicePixelRatio||1),W=c.clientWidth||300,H=c.clientHeight||120;
  if(c.width!==Math.round(W*dpr)||c.height!==Math.round(H*dpr)){c.width=Math.round(W*dpr);c.height=Math.round(H*dpr)}
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.fillStyle='#1f0708';x.fillRect(0,0,W,H);
  for(let g=0;g<=W;g+=12){x.fillStyle='rgba(255,107,94,'+(g%60?'.10)':'.26)');x.fillRect(g,0,1,H)}for(let g=0;g<=H;g+=12){x.fillStyle='rgba(255,107,94,'+(g%60?'.10)':'.26)');x.fillRect(0,g,W,1)}
  return{x,W,H}}
function drawLive(){const c=$('ppg-live');if(!c)return;const{x,W,H}=setup(c);if(!live||!live.wave)return;
  const w=live.wave,n=Math.min(w.y.length,Math.round(6*FS)),y=w.y.slice(-n),tS=w.t0+(w.y.length-n)/FS,span=6,mx=Math.max(1e-6,...y.map(Math.abs)),X=t=>(t-(tS+n/FS-span))/span*W,Y=v=>H/2-v/mx*H*.42;
  x.lineWidth=2;x.strokeStyle='#ff6b5e';x.beginPath();y.forEach((v,i)=>{const px=X(tS+i/FS);i?x.lineTo(px,Y(v)):x.moveTo(px,Y(v))});x.stroke();
  x.fillStyle='#fffbea';live.peaks.forEach(t=>{if(t>=tS&&t<=tS+n/FS)x.fillRect(Math.round(X(t))-3,Math.round(Y(y[Math.min(n-1,Math.max(0,Math.round((t-tS)*FS)))]))-3,6,6)})}
function drawFit(){const c=$('ppg-fit');if(!c||!R)return;const{x,W,H}=setup(c),w=R.w,n=Math.min(w.y.length,Math.round(4*FS)),y=w.y.slice(-n),tS=w.t0+(w.y.length-n)/FS,span=n/FS,
  mx=Math.max(1e-6,...y.map(Math.abs)),X=t=>(t-tS)/span*W,Y=v=>H*.58-v/mx*H*.3;
  x.lineWidth=2;x.strokeStyle='#ff6b5e';x.beginPath();y.forEach((v,i)=>{const px=X(tS+i/FS);i?x.lineTo(px,Y(v)):x.moveTo(px,Y(v))});x.stroke();
  x.setLineDash([4,3]);x.strokeStyle='#f2c14e';x.lineWidth=1.5;x.beginPath();for(let i=0;i<=n;i++){const t=tS+i/FS,v=R.A*Math.cos(2*Math.PI*R.f*(t-R.tp));i?x.lineTo(X(t),Y(v)):x.moveTo(X(t),Y(v))}x.stroke();x.setLineDash([]);
  const pk=R.peaks.filter(t=>t>=tS&&t<=tS+span);x.fillStyle='#fffbea';x.font='bold 11px system-ui,sans-serif';
  if(pk.length>=2){const a=pk[pk.length-2],b=pk[pk.length-1],ya=12;x.fillRect(Math.round(X(a)),ya,Math.max(1,Math.round(X(b)-X(a))),2);x.fillRect(Math.round(X(a)),ya-4,2,10);x.fillRect(Math.round(X(b))-2,ya-4,2,10);
    const m=HWStairs.pulseSHM(R.bpm),lab='T = '+m.T.toFixed(2)+' s',mid=(X(a)+X(b))/2;x.fillText(lab,Math.max(2,Math.min(W-x.measureText(lab).width-2,mid-x.measureText(lab).width/2)),ya+16)}}
function draw(){drawLive();drawFit()}

/* ---------- the sheet before the camera starts ---------- */
function openSheet(){const m=$('mo');if(!m)return;
  m.innerHTML='<div class="card ppgsheet" role="dialog" aria-modal="true" aria-label="Measure your pulse with the camera"><h3>'+ico('camera')+' PULSE WAVE LAB</h3>'
    +'<ul><li>Cover the <b>back camera and the flash</b> lightly with your fingertip. Do not press hard.</li>'
    +'<li>Keep your hand and the phone still. For a resting reading, sit and rest for a few minutes first.</li>'
    +'<li>It takes about 20 seconds. The app draws your pulse wave and works out your BPM.</li></ul>'
    +(pend?'<p class="ppgtgt">When the reading is good, it is filled in'+(pend==='r'?' as <b>1 MIN AFTER</b>':' and logged as <b>'+TL[pend]+'</b>')+' for you.</p>':'')
    +'<p><b>It is an estimate</b>, not a medical measurement. <b>Video never leaves your phone and nothing is recorded.</b> Nothing is saved unless you press LOG BPM or SEAL THE WORKOUT afterwards.</p>'
    +'<div class="row"><button data-a="ppgstart" id="ppg-go">START</button><button class="g" data-a="mclose">CANCEL</button></div></div>';
  m.hidden=false;sheet=true;const b=$('ppg-go');if(b)b.focus()}
function closeSheet(){if(!sheet)return;sheet=false;const m=$('mo');if(m&&m.querySelector('.ppgsheet'))m.hidden=true}

// from the camera button beside a BPM field (data-k = b | a | r): bring the CAMERA PULSE card into view and open its sheet
acts.ppgopen=d=>{if(phase==='ask'||phase==='run')return;R=null;msg='';pend=d&&TL[d.k]?d.k:null;if(pend){target=null;const el=$('hwppg');if(el)el.scrollIntoView({block:'start'})}openSheet()};
acts.ppgstart=()=>start();
acts.ppgcancel=()=>cancel();
HWEvents.on('page:viewed',()=>{closeSheet();gen++;stopCam();phase='idle';R=null;msg=''});
HWEvents.on('data:reset',()=>{gen++;stopCam();phase='idle';R=null;msg='';denied=false});
D.addEventListener('visibilitychange',()=>{if(D.hidden&&(phase==='run'||phase==='ask'))cancel('The measurement stopped because the page was hidden. Start again when you are ready.')});
addEventListener('pagehide',()=>{gen++;stopCam()});

HWUI.css('ppg',`
.ppg{margin:0 0 12px;padding:10px;border:var(--px-bw-c) solid var(--ln);background:var(--p2);box-shadow:var(--px-sh-c)}
.ppgrow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between}.ppgrow>b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fl)}
.ppgrow .ppgbtn{flex:1 1 auto}.ppg button{min-height:44px}.ppg .hwh{min-height:0}
.ppgbtn{display:flex;align-items:center;justify-content:center;gap:8px}
.ppgmsg{margin:8px 0}.ppgtgt{margin:6px 0;font-size:14px}.ppgc{width:100%;height:120px;display:block;border:3px solid var(--ln);image-rendering:pixelated;margin:8px 0}.ppgfit{height:110px}
.ppgline{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin:4px 0}.ppgbpm{font:700 var(--px-f3)/1.2 var(--fn)}.ppgleft{margin-left:auto;font-size:14px}
.ppgq{height:10px;border:2px solid var(--ln);background:var(--pn);margin:6px 0 2px}.ppgq i{display:block;height:100%;background:var(--grn)}
.ppgres{display:block}.ppgres p{margin:6px 0;overflow-wrap:anywhere}.ppgbased{font-weight:600}
.ppgbtns{margin:8px 0}.ppgbtns button{flex:1 1 120px;display:flex;align-items:center;justify-content:center;gap:6px}
.ppgsheet ul{margin:4px 0 10px;padding-left:18px}.ppgsheet li{margin:4px 0}.ppgsheet h3{display:flex;align-items:center;gap:8px}.ppgsheet .row button{flex:1 1 120px}
`);
return{supported,resample,detrend,bandpass,findPeaks,analyze,panel,paint,
  result:()=>R?{bpm:R.bpm,beats:R.beats,secs:R.secs}:null,get state(){return phase},get torch(){return torch},cancel}})();
