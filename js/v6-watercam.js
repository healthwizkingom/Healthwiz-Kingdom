/* v6: SCAN MY DRINK, a camera estimate of the water in bottles and cups, under the ADD WATER card on the Water page. Not part of the original.
   The player taps SCAN (only then does the browser ask for the camera), frames the drinks and taps CAPTURE. The photo is cut down to
   at most 1024 px and sent to the water-scan Edge Function (supabase/functions/water-scan: Gemini vision, signed-in players only,
   the key stays on the server). Nothing is stored: the photo lives in memory for the request and is dropped. The answer is a list of
   containers, each with a volume ESTIMATE, a range and the reasoning (read from a printed size, or guessed from the shape).
   Nothing is saved until the player confirms: they can untick a container, retype its mL, or drink only part of it (slider).
   LOG then calls the page's own drink(v, meta) once per container, so XP, the well animation, totals, charts, quests and badges
   treat it exactly like a manual drink. The entry carries m = {src:'camera', est:true, conf}, shown as "camera estimate".
   It is an estimate of what is in the container read from a photo, not a measurement, and says nothing about hydration or health.
   Camera, signed out, offline, denied or failed: the card says why and the manual ADD WATER above keeps working.
   The camera stream is stopped on CAPTURE, CLOSE, leaving the page, and when the app goes to the background. */
const HWWaterCam=(()=>{
const MAXML=1500,$i=id=>document.getElementById(id);
const Z0=()=>({k:'idle',msg:'',ok:'',list:[],stream:null});
let Z=Z0(),gen=0;
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
/** mL that LOG saves for one reviewed container: its estimate x the share drunk, whole mL, 0 to 1500. */
const logMl=c=>{const m=+c.ml,t=c.take==null?1:+c.take;return Number.isFinite(m)&&Number.isFinite(t)?clamp(Math.round(m*clamp(t,0,1)),0,MAXML):0};
const signed=()=>typeof HWCloud!=='undefined'&&!!HWCloud.who();
const supported=()=>!!(navigator.mediaDevices&&typeof navigator.mediaDevices.getUserMedia==='function')&&(typeof isSecureContext==='undefined'||isSecureContext);
const total=()=>Z.list.reduce((a,c)=>a+(c.on?logMl(c):0),0);
const ERR={signin:'Sign in so Luke can look at your photo. You can still add water by hand above.',offline:'You are offline, so Luke cannot look at the photo. You can still add water by hand above.',
  limit:'That is a lot of scanning for one hour! Try again a little later, or add water by hand.',nokey:'Luke\'s photo scan is not set up on the server yet. You can still add water by hand.',
  busy:'The photo scan is busy right now. Try again in a minute, or add water by hand.',ai:'Luke\'s photo scan came back muddled. Try again, or add water by hand.',
  unknown:'Luke could not see a drink in that photo. Try again with the bottle or cup in the middle, or add water by hand.',
  denied:'Camera permission was not given, so nothing was scanned. You can allow it in your browser settings, or add water by hand.',
  nocam:'This browser cannot open the camera here (it needs a secure page and a camera). You can add water by hand.',
  cam:'The camera could not be opened. You can add water by hand.',wait:'The camera is still starting. Wait a second and tap CAPTURE again.'};

function stopCam(){const s=Z.stream;Z.stream=null;if(s&&s.getTracks)s.getTracks().forEach(t=>{try{t.stop()}catch(e){}})}
function reset(){gen++;stopCam();Z=Z0()}
function fail(code,k){stopCam();Z.k=k||'idle';Z.list=[];Z.ok='';Z.msg=ERR[code]||ERR.ai;draw()}

const help=()=>HWHelp.btn('xwatercam','How the photo estimate is worked out','<p>Luke (an AI model) looks at your photo and lists each drink container. For each one he reads the printed size if there is one (for example “500 mL”), or guesses the size from the container’s shape, then judges how full it is.</p>'
  +'<p><b>Estimate = size × how full.</b> For example, a 500 mL bottle that looks 60 % full is about 300 mL. The range shows how far off he might be.</p>'
  +'<p>It is an estimate from a picture, not a measurement. Tilted bottles, opaque cups, bad light and guessed sizes make it less exact. Fix any number before you log it. It does not say how much you should drink.</p>')
function row(c,i){const L=logMl(c);return'<div class="wcr" data-i="'+i+'">'
  +'<label class="wcn"><input type="checkbox" data-ch="wctog" data-i="'+i+'"'+(c.on?' checked':'')+' aria-label="Log '+esc(c.label)+'"> <b>'+esc(c.label)+'</b>'+(c.type?' <small class="mut">('+esc(c.type)+')</small>':'')+'</label>'
  +'<div>ESTIMATE from photo: about <b>'+Math.round(c.ml0)+' mL</b> ('+Math.round(c.lo)+' to '+Math.round(c.hi)+' mL) · '+esc(c.conf)+' confidence'+(c.capacity_ml?' · '+Math.round(c.capacity_ml)+' mL container':'')+'</div>'
  +'<small class="mut">'+esc(c.basis)+'</small>'
  +'<div class="wcc2"><label>mL in it <input type="number" min="1" max="'+MAXML+'" step="1" inputmode="numeric" data-in="wcmed" data-i="'+i+'" value="'+Math.round(c.ml)+'"></label>'
  +'<label>I drink <input type="range" min="0" max="1" step="0.05" data-in="wctake" data-i="'+i+'" value="'+c.take+'" aria-label="Share of '+esc(c.label)+' I drink"> <span class="wct">'+Math.round(c.take*100)+'%</span></label></div>'
  +'<small class="wcl">Logs: <b>'+(c.on?L:0)+' mL</b></small></div>'}
function inner(){
  const h='<h3 class="pxh">'+HWPixel.icon('camera')+' SCAN MY DRINK '+help()+'</h3>'
  const note=Z.msg?'<p class="warn" role="alert">'+esc(Z.msg)+'</p>':Z.ok?'<p role="status">'+esc(Z.ok)+'</p>':'';
  if(Z.k==='camera')return h+'<span class="pxtag">ESTIMATE</span><p>Frame your bottles or cups so you can see them and any printed size, then tap CAPTURE.</p><video id="wc-video" class="wcv" playsinline muted autoplay></video>'
    +'<div class="row"><button type="button" data-a="wcshot">CAPTURE</button><button type="button" class="g" data-a="wcclose">CLOSE</button></div>'+note;
  if(Z.k==='busy')return h+'<p role="status" class="wcb">Luke is looking at your drinks...</p>';
  if(Z.k==='review')return h+'<span class="pxtag">ESTIMATE</span><p class="mut">ESTIMATE from photo, not a measurement. Check each number, untick what you will not drink, then log it.</p>'
    +Z.list.map(row).join('')+'<p class="wctot" role="status">Total to log: <b id="wc-tot">'+total()+' mL</b></p>'
    +'<div class="row"><button type="button" data-a="wclog" id="wc-log"'+(total()>0?'':' disabled')+'>LOG</button><button type="button" class="g" data-a="wcretake">RETAKE</button><button type="button" class="g" data-a="wcclose">CANCEL</button></div>'+note;
  return h+'<p>Point your camera at your bottles or cups and Luke estimates how much water is in each, then you can log it like a manual entry.</p>'
    +'<p class="mut">The photo is sent to an AI model to make the estimate and is not stored. It is an estimate, not a measurement. Sign-in needed.</p>'
    +'<div class="row"><button type="button" data-a="wcscan">SCAN MY DRINK</button></div>'+note}
const card=()=>'<div class="pxp pxn wcard" id="wc-card">'+inner()+'</div>';
function attach(){if(Z.k!=='camera'||!Z.stream)return;const v=$i('wc-video');if(v&&v.srcObject!==Z.stream){v.srcObject=Z.stream;const p=v.play&&v.play();if(p&&p.catch)p.catch(()=>{})}}
function draw(){const e=$i('wc-card');if(e){e.outerHTML=card();attach()}}
// the review's numbers change without redrawing, so typing and dragging keep their focus
function refresh(i){const c=Z.list[i],r=document.querySelector('.wcr[data-i="'+i+'"]');if(!c||!r)return;
  const t=r.querySelector('.wct'),l=r.querySelector('.wcl b');if(t)t.textContent=Math.round(c.take*100)+'%';if(l)l.textContent=(c.on?logMl(c):0)+' mL';
  const T=$i('wc-tot'),b=$i('wc-log');if(T)T.textContent=total()+' mL';if(b)b.disabled=!(total()>0)}

async function scan(){
  if(!signed())return fail('signin');
  if(navigator.onLine===false)return fail('offline');
  if(!supported())return fail('nocam');
  const g=gen;let s;
  try{s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})}
  catch(e){if(g!==gen)return;return fail(e&&(e.name==='NotAllowedError'||e.name==='SecurityError'||e.name==='PermissionDeniedError')?'denied':'cam')}
  if(g!==gen||S.v!=='water'||!$i('wc-card')){try{s.getTracks().forEach(t=>t.stop())}catch(e){}return}   // the player left while the browser was asking
  Z.stream=s;Z.k='camera';Z.msg='';Z.ok='';draw()}
function frame(){const v=$i('wc-video');if(!v||!(v.videoWidth>0))return null;
  const k=Math.min(1,1024/Math.max(v.videoWidth,v.videoHeight)),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(v.videoWidth*k));cv.height=Math.max(1,Math.round(v.videoHeight*k));
  cv.getContext('2d').drawImage(v,0,0,cv.width,cv.height);const u=cv.toDataURL('image/jpeg',.8);return u.slice(u.indexOf(',')+1)}
async function shot(){
  const img=frame();if(!img){Z.msg=ERR.wait;draw();return}
  stopCam();Z.k='busy';Z.msg='';draw();const g=gen;let r;
  try{r=await HWCloud.api('/functions/v1/water-scan',{method:'POST',body:{image:img,mime:'image/jpeg'},ms:45000})}
  catch(e){if(g!==gen)return;const b=e.body||{};
    return fail(e.code==='net'?'offline':e.status===401||e.code==='auth'?'signin':e.status===429?'limit':b.error==='nokey'||e.code==='setup'?'nokey':b.error==='busy'?'busy':'ai')}
  if(g!==gen)return;
  const L=r&&r.result&&Array.isArray(r.result.containers)?r.result.containers:null;
  if(r&&r.unknown)return fail('unknown');
  if(!L||!L.length)return fail('ai');
  Z.list=L.slice(0,8).map(c=>({label:String(c.label||'Drink'),type:String(c.type||''),capacity_ml:c.capacity_ml==null?null:+c.capacity_ml,ml0:clamp(+c.ml||0,0,MAXML),ml:clamp(Math.round(+c.ml||0),0,MAXML),
    lo:clamp(+c.lo||0,0,MAXML),hi:clamp(+c.hi||0,0,MAXML),conf:['high','medium','low'].includes(c.conf)?c.conf:'low',basis:String(c.basis||''),on:true,take:1}));
  Z.k='review';Z.msg='';draw()}
function log(){const items=Z.list.map((c,i)=>({c,i})).filter(x=>x.c.on&&logMl(x.c)>0);if(!items.length)return;
  items.forEach(x=>drink(logMl(x.c),{src:'camera',est:true,conf:x.c.conf,i:x.i}));
  const n=items.length;reset();Z.ok='Logged '+n+(n===1?' drink':' drinks')+' from your photo estimate.';draw()}

acts.wcscan=scan;acts.wcshot=shot;acts.wclog=log;
acts.wcclose=()=>{reset();draw()};
acts.wcretake=()=>{Z.list=[];Z.k='idle';scan()};
CH.wctog=(v,el)=>{const i=+el.dataset.i,c=Z.list[i];if(c){c.on=!!el.checked;refresh(i)}};
INP.wcmed=el=>{const i=+el.dataset.i,c=Z.list[i];if(c){c.ml=clamp(Math.round(+el.value)||0,0,MAXML);refresh(i)}};
INP.wctake=el=>{const i=+el.dataset.i,c=Z.list[i];if(c){c.take=clamp(+el.value||0,0,1);refresh(i)}};
// the first number typed over the limit is clamped on leaving the box, so the player sees what will be saved
document.addEventListener('change',e=>{const el=e.target;if(el&&el.dataset&&el.dataset.in==='wcmed'){const c=Z.list[+el.dataset.i];if(c)el.value=c.ml}});

// the card sits right below ADD WATER (js/hw-02-core.js), before the stats grid; a failure here leaves the page as it was
{const p0=pages.water;pages.water=(...a)=>{const h=p0(...a);try{const i=h.indexOf('ADD WATER</h3>');if(i<0)return h;const j=h.indexOf('<div class="grid"><div class="t">',i);if(j<0)return h;
  setTimeout(attach,0);return h.slice(0,j)+card()+h.slice(j)}catch(e){console.error('[HWWaterCam] card failed:',e);return h}}}
HWEvents.on('page:viewed',e=>{if(!e||e.view!=='water')reset()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&Z.k==='camera'){reset();Z.msg='The camera was closed because the app went to the background.';draw()}});
HWEvents.on('data:reset',()=>{reset()});

HWUI.css('watercam',`
.wcard{overflow:hidden}.wcard .row{flex-wrap:wrap}
.wcv{display:block;width:100%;max-width:100%;max-height:60vh;background:#000;border:3px solid var(--ln);margin:8px 0;object-fit:cover;image-rendering:auto}
.wcr{border:2px solid var(--ln);background:var(--p2);padding:8px;margin:8px 0;min-width:0}
.wcr .wcn{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.wcc2{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:6px 0}.wcc2 label{display:flex;gap:6px;align-items:center;min-width:0}
.wcc2 input[type=number]{width:96px;max-width:100%}.wcc2 input[type=range]{flex:1;min-width:110px;max-width:100%}
.wctot{margin:8px 0}`);
return{logMl,supported,card,state:()=>({k:Z.k,n:Z.list.length})}})();
