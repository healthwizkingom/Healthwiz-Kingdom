/* v6: smartwatch / chest-strap heart rate over Web Bluetooth. Not part of the original.
   Shown in the Workout's HEART RATE card on the Stairs page (js/v6-stairs.js; the old Pulse route opens that card).
   * Standard Bluetooth Heart Rate Service 0x180D, Heart Rate Measurement characteristic 0x2A37 (notifications).
     Flags byte bit 0: 0 = the value is uint8 at byte 1, 1 = uint16 little-endian at bytes 1–2 (parse()).
     Battery Service 0x180F / Battery Level 0x2A19 is read (and followed) when the device has it.
   * Readings below 30 or above 230 BPM are discarded. "Use this reading" offers the average of the last 15 s, once
     there are at least 10 s of readings that vary by no more than 15 BPM (stable()).
   * Auto-reconnect after a dropped link (back-off 1, 2, 4, 8, 16, 30 s), and on the next visit when the browser still
     remembers the device (navigator.bluetooth.getDevices, Chrome). DISCONNECT stops that until CONNECT is used again.
   * Where Web Bluetooth is missing (iPhone/iPad browsers, Firefox, http pages) the connect button is hidden and manual
     entry stays as it always was. Manual entry is always available.
   * Never a diagnosis: this module shows numbers only. Local state: `healthwiz_hr` = {id, name, auto} (this browser). */
const HWHR=(()=>{
const K='healthwiz_hr',LO=30,HI=230,WIN=15e3,MINW=10e3,SPREAD=15,STALE=5e3;
const N=navigator,D=document;
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
let P=(()=>{try{const o=JSON.parse(localStorage.getItem(K)||'{}');return isO(o)?o:{}}catch(e){return{}}})();
const keep=()=>{try{localStorage.setItem(K,JSON.stringify(P))}catch(e){}};
const supported=()=>!!(N.bluetooth&&typeof N.bluetooth.requestDevice==='function')&&(typeof isSecureContext==='undefined'||isSecureContext);

/* ---------- pure helpers (tests call these) ---------- */
/** Heart Rate Measurement (0x2A37) → BPM, or null when the value is outside 30–230. Accepts a DataView. */
function parse(dv){try{if(!dv||dv.byteLength<2)return null;const f=dv.getUint8(0),v=f&1?(dv.byteLength>=3?dv.getUint16(1,true):NaN):dv.getUint8(1);
  return v>=LO&&v<=HI?v:null}catch(e){return null}}
/** The stable average of the last 15 s of samples [{t, v}] at time `now`:
 *  {ok:1, v, secs} or {ok:0, why:'none'|'stale'|'settling'|'changing', secs, left}. */
function stableOf(S,now){const L=S.filter(s=>now-s.t<=WIN);if(!L.length)return{ok:0,why:'none',secs:0};
  if(now-L[L.length-1].t>STALE)return{ok:0,why:'stale',secs:0};
  const span=L[L.length-1].t-L[0].t,secs=Math.round(span/1000),vs=L.map(s=>s.v),lo=Math.min(...vs),hi=Math.max(...vs);
  if(span<MINW)return{ok:0,why:'settling',secs,left:Math.ceil((MINW-span)/1000)};
  if(hi-lo>SPREAD)return{ok:0,why:'changing',secs,lo,hi};
  return{ok:1,v:Math.round(vs.reduce((a,b)=>a+b,0)/vs.length),secs}}

/* ---------- connection ---------- */
// state: 'off' | 'pick' (chooser open) | 'connecting' | 'on' | 'lost' (reconnecting)
let dev=null,chr=null,bat=null,state='off',bpm=null,batt=null,err='',tries=0,RT=0,S=[];
const subs=new Set();
const wait=(p,ms)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(Object.assign(new Error('timeout'),{name:'TimeoutError'})),ms))]);
function onVal(e){const v=parse(e.target&&e.target.value);if(v==null)return;const t=Date.now();bpm=v;S.push({t,v});
  while(S.length&&t-S[0].t>WIN+5e3)S.shift();subs.forEach(f=>{try{f(v,t)}catch(x){}});live()}
function onBatt(e){try{batt=e.target.value.getUint8(0);live()}catch(x){}}
async function link(){if(!dev||!dev.gatt)throw new Error('no device');clearTimeout(RT);state=state==='lost'?'lost':'connecting';paint();
  const srv=await wait(dev.gatt.connect(),15e3),svc=await srv.getPrimaryService('heart_rate');
  chr=await svc.getCharacteristic('heart_rate_measurement');chr.addEventListener('characteristicvaluechanged',onVal);await chr.startNotifications();
  state='on';tries=0;err='';paint();
  try{const bs=await srv.getPrimaryService('battery_service');bat=await bs.getCharacteristic('battery_level');
    batt=(await bat.readValue()).getUint8(0);try{bat.addEventListener('characteristicvaluechanged',onBatt);await bat.startNotifications()}catch(x){}live()}
  catch(x){batt=null}} // no battery service: nothing to show
function onDrop(){chr=null;bat=null;bpm=null;S=[];if(state==='off')return;state='lost';paint();again()}
function again(){clearTimeout(RT);if(!P.auto||!dev){state='off';paint();return}
  if(tries>=6){state='off';err='Lost the connection to '+(dev.name||'your device')+'. Check that it is on and nearby, then tap CONNECT.';paint();return}
  const ms=Math.min(30,Math.pow(2,tries))*1000;tries++;
  RT=setTimeout(()=>{if(state!=='lost')return;link().catch(()=>{if(state==='lost')again()})},ms)}
function use(d){if(dev&&dev!==d)dev.removeEventListener('gattserverdisconnected',onDrop);dev=d;dev.addEventListener('gattserverdisconnected',onDrop)}
async function connect(){if(!supported())return;err='';clearTimeout(RT);state='pick';paint();let d;
  try{d=await N.bluetooth.requestDevice({filters:[{services:['heart_rate']}],optionalServices:['battery_service']})}
  catch(e){state='off';err=e&&e.name==='NotFoundError'?'':e&&e.name==='SecurityError'?'The browser blocked Bluetooth on this page.':'Could not open the device list ('+String(e&&e.message||e).slice(0,80)+').';paint();return}
  use(d);P={id:d.id,name:String(d.name||'').slice(0,40),auto:1};keep();
  try{await link();toast('Connected to '+esc(P.name||'your heart-rate device'))}
  catch(e){state='off';P.auto=0;keep();try{d.gatt.disconnect()}catch(x){}err='Could not connect to '+(P.name||'the device')+'. It may not share heart rate with web pages: see "Will my watch work?".';paint()}}
function disconnect(){P.auto=0;keep();clearTimeout(RT);state='off';err='';const d=dev;bpm=null;batt=null;S=[];chr=null;
  try{if(d&&d.gatt&&d.gatt.connected)d.gatt.disconnect()}catch(e){}paint()}
// a later visit: reconnect without the chooser when the browser still lists the device (Chrome's getDevices)
let tried=0;
function restore(){if(tried||!supported()||!P.auto||!P.id||dev||typeof N.bluetooth.getDevices!=='function')return;tried=1;
  N.bluetooth.getDevices().then(L=>{const d=(L||[]).find(x=>x.id===P.id);if(!d||dev)return;use(d);state='lost';tries=0;paint();
    link().catch(()=>{if(state==='lost')again()})}).catch(()=>{})}

/* ---------- panel ---------- */
const ico=(n,o)=>HWPixel.icon(n,o||1);
function stable(){return stableOf(S,Date.now())}
function avgLine(s){if(state!=='on')return state==='lost'?'Reconnecting… the last reading is not used.':'';
  if(s.ok)return'Steady average of the last '+s.secs+' s: <b>'+s.v+' BPM</b>';
  return s.why==='settling'?'Hold still: a steady reading is ready in about '+s.left+' s.':s.why==='changing'?'Your heart rate is changing ('+s.lo+'–'+s.hi+' BPM). Stay still for a few seconds.'
    :s.why==='stale'?'No new reading for a few seconds. Is the strap or watch snug?':'Waiting for the first reading… (wet a chest strap\'s contacts)'}
function panel(){let h='<div class="hrdev" id="hwhr"><div class="hrdh"><b>'+ico('watch',{label:'Smartwatch'})+' SMARTWATCH HEART RATE</b>'
  +'<button class="sm g" data-a="hrhelp">WILL MY WATCH WORK?</button></div>';
  if(!supported())return h+'<p class="mut">This browser cannot connect to heart-rate devices. That needs Chrome or Edge on Android or a computer (not iPhone or iPad). Count your pulse and type it below; it works just as well.</p></div>';
  if(state==='off'||state==='pick')h+='<p class="mut">Connect a Bluetooth chest strap or a watch that broadcasts heart rate, or type the numbers below by hand.</p>'
    +'<button data-a="hrcon" class="hrcon"'+(state==='pick'?' disabled':'')+'>'+ico('watch')+' '+(state==='pick'?'CHOOSE YOUR DEVICE…':'CONNECT HEART-RATE DEVICE')+'</button>';
  else{const s=stable(),cls=state==='on'?'ok':'lost',lbl=state==='on'?'CONNECTED':state==='lost'?'RECONNECTING…':'CONNECTING…';
    h+='<div class="hrlive"><span class="hrht" id="hwhr-ht" style="--beat:'+(bpm?(60/bpm).toFixed(2):'1')+'s" data-on="'+(bpm&&state==='on'?1:0)+'">'+ico('heart',{s:3,label:'Live heart rate'})+'</span>'
      +'<div><b class="num hrbpm" id="hwhr-bpm" aria-live="off">'+(bpm&&state==='on'?bpm:'--')+'</b> <span>BPM</span>'
      +'<div class="hrst"><span class="hrchip '+cls+'" role="status">'+lbl+'</span> <small>'+esc(P.name||'Heart-rate device')+'</small>'
      +'<small id="hwhr-bt"'+(batt==null?' hidden':'')+'>'+ico('battery',{label:'Battery'})+' <span>'+(batt==null?'':batt+'%')+'</span></small></div></div></div>'
      +'<p class="hravg" id="hwhr-avg" role="status">'+avgLine(s)+'</p>'
      +'<div class="row hrbtns">'+['b','a'].map(k=>'<button data-a="hruse" data-k="'+k+'"'+(s.ok&&s.v<=220?'':' disabled')+'>'+ico('watch')+' USE AS '+(k==='b'?'BEFORE':'AFTER')+'</button>').join('')
      +'<button class="g" data-a="hroff">DISCONNECT</button></div>'
      +'<small class="mut">While the workout timer runs, readings are kept as the climb\'s lowest, average and highest heart rate.</small>'}
  if(err)h+='<div class="warn" role="alert">'+esc(err)+'</div>';
  return h+'</div>'}
function paint(){const el=D.getElementById('hwhr');if(!el)return;const a=D.activeElement,f=a&&el.contains(a)&&a.dataset?a.dataset.a+(a.dataset.k||''):null;
  el.outerHTML=panel();if(f){const n=D.getElementById('hwhr');const b=n&&[...n.querySelectorAll('button')].find(x=>x.dataset.a+(x.dataset.k||'')===f&&!x.disabled);if(b)b.focus()}}
// per reading: patch text and button states only (keeps focus, no layout jump)
function live(){const el=D.getElementById('hwhr');if(!el||state!=='on')return;const s=stable(),$=i=>D.getElementById(i);
  const b=$('hwhr-bpm');if(b)b.textContent=bpm||'--';const ht=$('hwhr-ht');if(ht){ht.style.setProperty('--beat',(bpm?60/bpm:1).toFixed(2)+'s');ht.dataset.on=bpm?1:0}
  const av=$('hwhr-avg'),t=avgLine(s);if(av&&av.innerHTML!==t)av.innerHTML=t;
  const bt=$('hwhr-bt');if(bt&&batt!=null){bt.hidden=false;bt.lastElementChild.textContent=batt+'%'}
  el.querySelectorAll('button[data-a="hruse"]').forEach(x=>{x.disabled=!(s.ok&&s.v<=220)})}

/* ---------- "Will my watch work?" ---------- */
function help(){const m=D.getElementById('mo');if(!m)return;
  m.innerHTML='<div class="card hrhelp" role="dialog" aria-modal="true" aria-label="Will my watch work?"><h3>'+ico('watch')+' WILL MY WATCH WORK?</h3>'
    +'<p><b>Your browser</b></p><ul><li>Works in <b>Chrome</b> or <b>Edge</b> on <b>Android</b> phones and on computers (Windows, Mac, Chromebook, Linux), with Bluetooth on.</li>'
    +'<li>Does <b>not</b> work in Safari or any browser on <b>iPhone or iPad</b> (Apple does not allow Bluetooth for web pages), or in Firefox.</li></ul>'
    +'<p><b>Your device</b></p><ul><li><b>Works:</b> Bluetooth chest straps such as Polar H9/H10, Garmin HRM-Dual/HRM-Pro and Wahoo TICKR; Polar and Coros watches with heart-rate sharing on.</li>'
    +'<li><b>Garmin watches:</b> turn on <b>Broadcast Heart Rate</b> (in the watch\'s heart-rate settings) before you tap CONNECT.</li>'
    +'<li><b>Usually not:</b> Apple Watch, most Samsung Galaxy Watch and most Fitbit models do not broadcast heart rate to web pages. Use manual entry: count beats for 15 s and multiply by 4.</li></ul>'
    +'<p class="mut">Only the heart-rate number (and battery level) is read. It stays on this device and is never shared or put on any leaderboard. A wellness reading, not a medical device.</p>'
    +'<button data-a="mclose" style="width:100%">CLOSE</button></div>';
  m.hidden=false}

acts.hrcon=()=>connect();
acts.hroff=()=>{disconnect();toast('Heart-rate device disconnected')};
acts.hrhelp=()=>help();
HWEvents.on('page:viewed',e=>{if(e.view==='stair'||e.view==='pulse')restore()});
HWEvents.on('data:reset',()=>{disconnect();P={};try{localStorage.removeItem(K)}catch(e){}});

HWUI.css('hr',`
.hrdev{margin:0 0 12px;padding:10px;border:var(--px-bw-c) solid var(--ln);background:var(--p2);box-shadow:var(--px-sh-c)}
.hrdh{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin-bottom:6px}.hrdh>b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fh)}
.hrdev button{min-height:44px}.hrcon{width:100%;display:flex;align-items:center;justify-content:center;gap:8px}
.hrlive{display:flex;align-items:center;gap:12px}.hrht{flex:0 0 64px;width:64px;height:64px;display:flex;align-items:center;justify-content:center}
.hrht[data-on="1"] .pxi{animation:hrbeat var(--beat,1s) infinite}
@keyframes hrbeat{0%{transform:scale(1)}12%{transform:scale(1.3333)}28%{transform:scale(1)}}
.hrht .pxi{animation-timing-function:steps(1,end)}
@media(prefers-reduced-motion:reduce){.hrht .pxi{animation:none!important}}html.hw-rm .hrht .pxi,html.hw-still .hrht .pxi{animation:none!important}
.hrbpm{font:var(--px-f3)/1.2 var(--fh)}.hrst{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin-top:4px}.hrst small{display:inline-flex;align-items:center;gap:4px}
.hrchip{display:inline-block;border:2px solid var(--ln);padding:2px 6px;font:7px/1.6 var(--fh)}.hrchip.ok{background:var(--grn);color:#fff}.hrchip.lost{background:var(--gold);color:#2b2418}
.hravg{margin:8px 0;min-height:1.4em}.hrbtns button{flex:1 1 120px;display:flex;align-items:center;justify-content:center;gap:6px}.hrbtns button:disabled{opacity:.45;cursor:not-allowed}
.hrhelp ul{margin:4px 0 10px;padding-left:18px}.hrhelp li{margin:4px 0}.hrhelp h3{display:flex;align-items:center;gap:8px}
.hrdev .warn{margin:8px 0 0}.hrtag{display:inline-flex;align-items:center;gap:4px}
`);
return{supported,parse,stableOf,stable,panel,help,on:f=>{subs.add(f);return()=>subs.delete(f)},
  get state(){return state},get bpm(){return state==='on'?bpm:null},get battery(){return batt},get device(){return P.name||null}}})();
