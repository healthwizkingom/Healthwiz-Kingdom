/* v6: the Wizard's Counsel talks to Medius AI through the medius-chat Edge Function, and Medius reacts in his study.
   Not part of the original. Uses the counsel in js/hw-05-v5-4-module.js (counsel, csAsk, csPaint) and js/v6-cloud.js.
   * AI: POST /functions/v1/medius-chat with the player's session (Authorization: Bearer). The Gemini key, the model
     and Medius's persona live on the server (supabase/functions/medius-chat). Signed out, the study and the breathing
     bubble still work, and the chat says "Sign in to talk with Medius". Nothing written here is stored or synced.
   * Moods: every reply starts with a hidden tag such as [mood:concerned] (calm, smile, concerned, thinking,
     encourage, gesture, chuckle). It is removed before display; an unknown or missing tag means calm. When the player
     wrote crisis words, or the reply came back with the help flag, only calm or concerned are used.
   * Crisis help numbers are always on the card, for everyone (help()).
   * Reactions: pixel overlays drawn in the study's own style (assets/img/medius-reactions.webp, made by
     tools/art/make_medius_reactions.py) on a canvas over the picture, plus the picture itself redrawn inside his head
     outline a few pixels up or down:
       idle: slow breathing and a blink now and then · listening: a small nod while the player types ·
       thinking: eyes raised in thought, while the reply is on its way ·
       replies: warm smile, concerned brows, a raised-brow "here is a thought" with a small nod, encouraging nods, a small
       chuckle, while the reply is typed out, then back to idle. His hands stay as painted.
     Pose changes are scheduled with timers (no frame loop), only while the study is on screen and the tab visible.
     Reduced motion: the expression is shown as one still frame, with no nods or typing effect. */
const HWCounsel=(()=>{
const D=document,C=()=>typeof HWCloud!=='undefined'?HWCloud:null;
const MOODS=['calm','smile','concerned','thinking','encourage','gesture','chuckle'];
const reduced=()=>typeof HWMotion!=='undefined'?HWMotion.reduced():HWUI.reduced();
const ico=(n,o)=>HWPixel.icon(n,o||1);

/* ---------- the reply: mood tag ---------- */
/** "[mood:smile] Well met!" → {mood:'smile', text:'Well met!'}. Unknown or missing → calm. Any stray tag is removed. */
function parse(t){t=String(t==null?'':t);const m=/^\s*\[\s*mood\s*:\s*([a-z]+)\s*\]\s*/i.exec(t),k=m&&m[1].toLowerCase();
  const text=(m?t.slice(m[0].length):t).replace(/\[\s*mood\s*:[^\]]*\]\s*/gi,'').trim();
  return{mood:MOODS.includes(k)?k:'calm',text}}
/** In a crisis only calm or concerned. */
const safe=(mood,crisis)=>crisis&&mood!=='calm'&&mood!=='concerned'?'concerned':mood;

/* ---------- the request ---------- */
const no=(code,x)=>Object.assign(new Error(code),{code},x||{});
async function ask(msgs,crisis){const c=C();
  if(!c||!c.who())throw no('signin');
  if(navigator.onLine===false)throw no('offline');
  const name=((st.p&&st.p.name)||'').trim().slice(0,20)||'traveller';
  let d;try{d=await c.api('/functions/v1/medius-chat',{method:'POST',body:{name,messages:msgs.map(m=>({role:m.role,content:m.content}))},ms:30000})}
  catch(e){const b=e.body||{};
    throw e.code==='net'?no('offline'):e.status===429&&b.error==='limit'?no('limit',{scope:b.scope,retry:+b.retry||0}):e.status===401||e.code==='auth'?no('signin')
      :b.error==='busy'?no('busy'):b.error==='nokey'||b.error==='setup'||e.code==='setup'?no('nokey'):no('ai')}
  const p=parse(d&&d.reply);if(!p.text)throw no('ai');
  const help=!!(d&&d.help),last=msgs.length?msgs[msgs.length-1].content:'';
  return{text:p.text,mood:safe(p.mood,crisis||help||CRISIS.test(last)),help}}
const mins=s=>Math.max(1,Math.round(s/60)),hrs=s=>Math.max(1,Math.round(s/3600));
function askError(e){const k=e&&e.code;let m;
  if(k==='limit')m=e.scope==='day'?'Medius has listened to many words today and needs his rest. He will be ready again in about '+(e.retry>5400?hrs(e.retry)+' hours':mins(e.retry)+' minutes')+'.'
    :'Medius has listened to many words this hour and needs a little rest. He will be ready again in about '+mins(e.retry||600)+' minute'+(mins(e.retry||600)===1?'':'s')+'.';
  else m={signin:'Sign in to talk with Medius. The breathing bubble works without an account.',
    offline:'You are offline, so Medius cannot reach his spellbook. Try again when you are back online.',
    busy:'Many adventurers are talking with Medius right now. Please try again in a few minutes.',
    nokey:'Medius\'s spellbook is not set up on the server yet, so he cannot answer here.'}[k]||'The candle flickers… Medius could not find an answer just now. Try again in a moment.';
  return m+' Nothing you wrote was saved. If you need someone now, the numbers below are there for you.'}

/* ---------- always-visible help, and the signed-out chat ---------- */
const can=()=>{const c=C();return!!(c&&c.who())};
function help(on){return '<div class="cshelp'+(on?' on':'')+'" id="cshelp" tabindex="-1"><b>'+ico('help')+' If you might be in danger or thinking of harming yourself, please reach out now:</b>'
  +'<ul><li>Emergency: <a href="tel:999"><b>999</b></a> (Malaysia) or your local emergency number</li><li>Befrienders KL (24 h emotional support): <a href="tel:+60376272929"><b>03-7627 2929</b></a></li>'
  +'<li>Talian Kasih: <a href="tel:15999"><b>15999</b></a></li><li>Your campus counselling unit, or a trusted friend or family member</li></ul></div>'}
function signedOut(){return '<div class="csout">'+ico('lock')+'<div><b>Sign in to talk with Medius</b><p>An account lets Medius AI answer you. Nothing you write is saved, and the breathing bubble works without one.</p>'
  +'<button data-a="cssign">'+ico('account')+' SIGN IN TO TALK WITH MEDIUS</button></div></div>'}
acts.cssign=()=>{if(typeof HWAccount!=='undefined')HWAccount.open(()=>{if(S.cs)csPaint()})};
HWEvents.on('cloud:signed-in',()=>{if(S.cs&&S.cs.ph==='chat')csPaint()});
HWEvents.on('cloud:signed-out',()=>{if(S.cs&&S.cs.ph==='chat')csPaint()});

/* ---------- the study's overlay ---------- */
// patch → [sheet x, sheet y, w, h, study x, study y] (tools/art/make_medius_reactions.py prints these)
const SHEET={"eyes:closed":[0,0,41,7,459,150],"eyes:happy":[42,0,41,7,459,150],"eyes:soft":[84,0,41,6,459,150],"eyes:up":[126,0,41,6,459,150],"eyes:wide":[168,0,41,6,459,150],"brows:up":[210,0,26,4,466,139],"brows:lift":[0,8,42,2,458,140],"mouth:smile":[43,8,26,5,467,179],"mouth:frown":[70,8,26,4,467,180],"mouth:open":[97,8,21,5,470,179]};
// his head (hat, face, hair, beard) in study.jpg pixels: redrawn a few pixels up (breathing) or down (a nod)
const HEAD=[[402,150],[402,128],[406,120],[410,112],[410,104],[414,97],[418,92],[424,86],[432,80],[440,76],[448,73],[458,73],[462,77],[466,80],[470,85],[474,90],[478,96],[482,101],[488,109],[494,116],[500,122],[506,126],[512,130],[518,133],[524,136],[530,139],[536,143],[539,146],[530,149],[520,149],[518,160],[518,190],[516,200],[512,212],[508,230],[500,248],[490,262],[480,266],[468,262],[458,250],[448,236],[440,222],[432,214],[424,206],[414,196],[408,180],[404,164]];
const BX=396,BY=64,BW=152,BH=212,FX=396,FY=64,FW=212,FH=274; // head box (with room to move) and the whole figure box
let sheet=null;
function img(){if(!sheet){sheet=new Image();sheet.src='assets/img/medius-reactions.webp';sheet.onload=()=>draw(1)}return sheet}
// binary masks of the head outline joined with its copy moved by dy, as canvases (built once per dy)
const MASK={};
function mask(dy){if(MASK[dy])return MASK[dy];const w=BW,h=BH,on=new Uint8Array(w*h),P=HEAD.map(p=>[p[0]-BX,p[1]-BY]);
  for(const off of [0,dy])for(let y=0;y<h;y++){const yc=y+.5-off,xs=[];
    for(let i=0,j=P.length-1;i<P.length;j=i++){const[a,b]=P[i],[c,d]=P[j];if((b>yc)!==(d>yc))xs.push(a+(yc-b)*(c-a)/(d-b))}
    xs.sort((p,q)=>p-q);for(let k=0;k+1<xs.length;k+=2)for(let x=Math.max(0,Math.ceil(xs[k]-.5));x<Math.min(w,Math.ceil(xs[k+1]-.5));x++)on[y*w+x]=1}
  const cv=D.createElement('canvas');cv.width=w;cv.height=h;const x=cv.getContext('2d');x.fillStyle='#000';
  for(let y=0;y<h;y++){let s=-1;for(let i=0;i<=w;i++){const v=i<w&&on[y*w+i];if(v&&s<0)s=i;else if(!v&&s>=0){x.fillRect(s,y,i-s,1);s=-1}}}
  return MASK[dy]=cv}
let work=null;
/** Draws one pose on the overlay canvas: {dy, eyes, brows, mouth}. */
function paint(cv,p){const x=cv.getContext('2d'),pic=cv.parentNode&&cv.parentNode.querySelector('img');x.imageSmoothingEnabled=false;
  x.clearRect(FX,FY,FW,FH);if(!p)return;
  const dy=p.dy|0;
  if(dy&&pic&&pic.complete&&pic.naturalWidth){work=work||D.createElement('canvas');work.width=BW;work.height=BH;const w=work.getContext('2d');w.imageSmoothingEnabled=false;
    w.clearRect(0,0,BW,BH);w.drawImage(pic,BX,BY-dy,BW,BH,0,0,BW,BH);w.globalCompositeOperation='destination-in';w.drawImage(mask(dy),0,0);w.globalCompositeOperation='source-over';
    x.drawImage(work,BX,BY)}
  const s=img();if(!s.complete||!s.naturalWidth)return;
  const put=(k,oy)=>{const r=SHEET[k];if(r)x.drawImage(s,r[0],r[1],r[2],r[3],r[4],r[5]+(oy||0),r[2],r[3])};
  if(p.eyes)put('eyes:'+p.eyes,dy);if(p.brows)put('brows:'+p.brows,dy);if(p.mouth)put('mouth:'+p.mouth,dy)}

/* ---------- what he does, and when ---------- */
// each mood: a still face, and its motion while the reply is typed (t = ms since the reply began)
const FACE={calm:{},smile:{eyes:'happy',mouth:'smile'},concerned:{eyes:'soft',brows:'up',mouth:'frown'},thinking:{eyes:'up',brows:'lift'},
  encourage:{eyes:'happy',mouth:'smile'},gesture:{brows:'lift',mouth:'smile'},chuckle:{eyes:'happy',mouth:'open'}};
function moodPose(m,t){const f=Object.assign({},FACE[m]||{});
  if(m==='encourage')f.dy=(t>200&&t<480)||(t>900&&t<1180)?4:0;                      // two encouraging nods
  else if(m==='chuckle'){const k=Math.floor(t/170);if(t<1400){f.dy=k%2?-2:0;f.mouth=k%2?'open':'smile'}else f.mouth='smile'}
  else if(m==='gesture')f.dy=t>250&&t<560?2:0;                                        // a small nod with the thought
  else if(m==='calm')f.eyes=t>300&&t<460?'closed':null;                               // one slow, thoughtful blink
  return f}
const M={el:null,mode:'idle',m:'calm',t0:0,until:0,typed:0,blinkAt:0,blinkTo:0,timer:0,last:'',vis:true};
function now(){return performance.now()}
function pose(){const t=now();
  if(M.mode==='think')return{eyes:'up',brows:'lift'}
  if(M.mode==='mood'){if(t<M.until)return moodPose(M.m,t-M.t0);
    if(t<M.until+500){const f=FACE[M.m]||{};return{eyes:f.eyes==='happy'?'happy':null,mouth:f.mouth==='open'?'smile':f.mouth}} // easing back
    M.mode='idle'}
  const p={};
  if(t-M.typed<1300){const k=(t-M.typed)%1600;if(k<260)p.dy=4}                        // listening: a small nod while typing
  else{const k=t%4600;if(k>1600&&k<3200)p.dy=-2}                                      // breathing: the head rises a little
  if(t>=M.blinkAt&&t<M.blinkTo)p.eyes='closed';
  if(t>=M.blinkTo){M.blinkAt=t+2600+Math.random()*3600;M.blinkTo=M.blinkAt+150}
  return p}
function draw(force){const cv=M.el;if(!cv||!cv.isConnected){M.el=null;return}
  if(reduced()){const f=M.mode==='mood'&&now()<M.until?Object.assign({},FACE[M.m]):M.mode==='think'?{eyes:'up',brows:'lift'}:null;
    const k=JSON.stringify(f);if(k!==M.last||force){M.last=k;paint(cv,f)}return}
  const p=pose(),k=JSON.stringify(p);if(k!==M.last||force){M.last=k;paint(cv,p)}}
function tick(){clearTimeout(M.timer);M.timer=0;if(!M.el||!M.el.isConnected){M.el=null;return}
  draw();if(!M.vis||D.hidden)return;
  M.timer=setTimeout(tick,reduced()?400:M.mode==='idle'&&now()-M.typed>1300?120:60)}
const IO=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>es.forEach(e=>{M.vis=e.isIntersecting;if(M.vis)tick();else{clearTimeout(M.timer);M.timer=0}})):null;
function bind(){const cv=D.querySelector('#cnsc canvas.cnmd');if(!cv||cv===M.el)return;M.el=cv;M.last='';if(IO){IO.disconnect();IO.observe(cv)}draw(1);tick()}
D.addEventListener('visibilitychange',()=>{if(!D.hidden)tick()});
{const m=D.querySelector('#main');if(m&&typeof MutationObserver==='function')new MutationObserver(()=>{if(D.getElementById('cnsc'))bind();else if(M.el&&!M.el.isConnected){clearTimeout(M.timer);M.el=null}}).observe(m,{childList:true,subtree:true})}
D.addEventListener('input',e=>{if(e.target&&e.target.id==='csin'){M.typed=now();if(!M.timer)tick()}});
/** Play a reply's mood for `ms` (while it is typed out, plus a short hold), then ease back to idle. */
function react(m,ms){M.mode='mood';M.m=MOODS.includes(m)?m:'calm';M.t0=now();M.until=M.t0+Math.max(1500,ms|0);tick()}
function think(on){if(on){M.mode='think';M.t0=now()}else if(M.mode==='think')M.mode='idle';tick()}

/* ---------- the scene and the reply as it appears ---------- */
{const o=counselScene;counselScene=function(){return o.apply(this,arguments).replace(/(<img [^>]*>)/,'$1<canvas class="cnmd" width="960" height="524" aria-hidden="true"></canvas>')}}
// the card's candle and help emoji become hand-drawn pixel icons (the log's "thinking" line is inside counsel() too)
{const o=counsel;counsel=function(){return o.apply(this,arguments).replace(/\u{1F56F}\uFE0F?/gu,ico('candle')).replace(/\u{1F198}\uFE0F?/gu,ico('help'))}}
function typeOut(){const el=D.querySelector('#cslog .csm.a.fresh .cst'),c=S.cs;if(!el||!c)return;const msg=c.m.filter(x=>x.fresh).pop();if(!msg)return;
  c.m.forEach(x=>{x.fresh=0});const text=msg.t;
  if(reduced()){react(msg.mood,3200);return}
  const sr=D.createElement('span');sr.className='cssr';sr.textContent=text;el.parentNode.appendChild(sr);el.setAttribute('aria-hidden','true');el.style.whiteSpace='pre-wrap';
  const cps=Math.max(45,text.length/4.5),dur=text.length/cps*1000;react(msg.mood,dur+1400);
  const t0=now();el.textContent='';
  (function step(){if(!el.isConnected){return}const n=Math.min(text.length,Math.ceil((now()-t0)/1000*cps));el.textContent=text.slice(0,n);
    const lg=D.getElementById('cslog');if(lg)lg.scrollTop=lg.scrollHeight;
    if(n<text.length)setTimeout(step,40);else{el.removeAttribute('aria-hidden');sr.remove()}})()}
{const o=csPaint;csPaint=function(){const r=o.apply(this,arguments);const c=S.cs;if(c){think(!!c.busy);if(!c.busy)typeOut()}return r}}
HWUI.css('counsel',`
.cns2 canvas.cnmd{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:pixelated;pointer-events:none}
.cshelp ul{margin:6px 0;padding-left:20px}.cshelp li{margin:2px 0}.cshelp a{color:inherit}.cshelp b svg{vertical-align:-3px;margin-right:4px}
.cshelp.on{border-color:var(--red);box-shadow:0 0 0 3px rgba(217,69,61,.35)}
.csout{display:flex;gap:10px;align-items:flex-start;border:3px dashed var(--ln);background:var(--p2);padding:10px;margin:8px 0}.csout>svg{flex:0 0 auto}
.csout b{font:8px/1.6 var(--fh);display:block}.csout p{margin:4px 0 8px;font-size:14px}.csout button{width:100%;display:flex;align-items:center;justify-content:center;gap:8px}
#counsel .csgem{display:block;margin-top:4px}#counsel h3 svg,#counsel button svg{vertical-align:-3px}
.cssr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
`);
return{ask,askError,parse,safe,can,help,signedOut,react,think,MOODS,get state(){return{mode:M.mode,mood:M.m,pose:M.last}}}})();
