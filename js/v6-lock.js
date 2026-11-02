/* v6: Privacy Lock (not part of the original). The health log lives on this device in plain storage, so anyone who picks
   up an unlocked phone or laptop can read it. This is an optional screen lock: a 4-8 digit PIN that covers the whole app
   at start, after the app has been away for the chosen time, and on LOCK NOW.
   * It is a SCREEN LOCK, not encryption: it keeps casual onlookers out of the app, it does not protect the stored data from
     someone who can read this browser's storage. The Settings card says so.
   * The PIN is never stored. Only a salted PBKDF2-SHA256 hash (WebCrypto, 150,000 rounds) is kept, under the device-only key
     'hw_lock' (not in backups, not in the cloud save, not in the app's own data).
   * Wrong PINs are slowed down: five misses, then a wait that doubles (30 s, 60 s, ... up to 15 min). The wait survives a
     refresh. A forgotten PIN is handled honestly: ERASE THIS DEVICE'S DATA (two taps) removes the lock together with the
     local data; a signed-in account's cloud save is untouched.
   * Needs WebCrypto (https, localhost or a file); where it is missing the card says so and nothing is locked.
   * Off by default. Nothing is written until a PIN is set. */
const HWLock=(()=>{
const K='hw_lock',MIN=4,MAX=8,ITER=150000,FREE=5,BASE=30,CAP=900,D0=document;
const AUTO=[[0,'Immediately'],[1,'After 1 min'],[5,'After 5 min'],[15,'After 15 min'],[-1,'Only at start']];
const ok=()=>!!(window.crypto&&crypto.subtle&&crypto.getRandomValues);
const read=()=>{try{const v=JSON.parse(localStorage.getItem(K)||'null');return v&&v.v===1&&typeof v.h==='string'&&typeof v.s==='string'?v:null}catch(e){return null}};
const write=o=>{try{localStorage.setItem(K,JSON.stringify(o));return true}catch(e){return false}};
const hex=b=>Array.from(new Uint8Array(b),x=>('0'+x.toString(16)).slice(-2)).join('');
const unhex=h=>Uint8Array.from((h.match(/../g)||[]),x=>parseInt(x,16));
async function derive(pin,salt,iter){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:iter},k,256))}
const same=(a,b)=>{if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}; // no early exit
const valid=p=>typeof p==='string'&&new RegExp('^\\d{'+MIN+','+MAX+'}$').test(p);
const on=()=>!!read();
let locked=false,hiddenAt=0,msg='',erase=0,tick=0;

/* ---------- the PIN ---------- */
async function setPin(pin,mins){if(!ok())return 'This browser cannot do the secure hashing the lock needs.';if(!valid(pin))return 'Use '+MIN+' to '+MAX+' digits.';
  const salt=crypto.getRandomValues(new Uint8Array(16));let h;try{h=await derive(pin,salt,ITER)}catch(e){return 'Could not set the lock.'}
  return write({v:1,s:hex(salt),h:hex(h),i:ITER,a:mins==null?1:mins,f:0,u:0})?'':'No room to save the lock on this device.'}
async function check(pin){const r=read();if(!r||!valid(pin))return false;try{return same(await derive(pin,unhex(r.s),r.i||ITER),unhex(r.h))}catch(e){return false}}
const wait=()=>{const r=read();return r&&r.u>Date.now()?Math.ceil((r.u-Date.now())/1000):0};
function miss(){const r=read();if(!r)return;r.f=(r.f||0)+1;if(r.f>=FREE)r.u=Date.now()+Math.min(CAP,BASE*Math.pow(2,r.f-FREE))*1000;write(r)}
function good(){const r=read();if(!r)return;r.f=0;r.u=0;write(r)}
function off(){try{localStorage.removeItem(K)}catch(e){}unlock(true);msg=''}

/* ---------- the cover ---------- */
HWUI.css('lock',`
#hwlock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:var(--bg);overflow:auto}
#hwlock .card{width:min(360px,100%);margin:0;text-align:center}
#hwlock input{width:100%;min-height:48px;margin:10px 0;text-align:center;font:600 22px/1.2 var(--fl);letter-spacing:.4em;background:var(--pn);color:var(--ink);border:3px solid var(--ln);padding:6px}
#hwlock .lkm{min-height:1.6em;font-size:14px;color:var(--red)}
#hwlock button{width:100%;margin-top:8px}
#v6lock .lkf{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
#v6lock input{min-height:44px;width:9em;font:600 18px/1.2 var(--fl);letter-spacing:.3em;text-align:center;background:var(--pn);color:var(--ink);border:3px solid var(--ln);padding:4px}
body.hw-locked{overflow:hidden}`);
const inertOthers=v=>Array.from(D0.body.children).forEach(e=>{if(e.id==='hwlock')return;if(v){e.setAttribute('inert','');e.setAttribute('aria-hidden','true')}else{e.removeAttribute('inert');e.removeAttribute('aria-hidden')}});
function cover(){let c=D0.getElementById('hwlock');const w=wait();
  const html='<div class="card" role="dialog" aria-modal="true" aria-labelledby="lkh"><h2 id="lkh">HEALTHWIZ IS LOCKED</h2><p class="mut">Enter your PIN to open your kingdom.</p>'
   +'<form id="lkf" autocomplete="off"><label class="mut" for="lkp">PIN</label><input id="lkp" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="'+MAX+'" autocomplete="off"'+(w?' disabled':'')+'>'
   +'<div class="lkm" role="alert" aria-live="assertive" id="lkm">'+esc(w?'Too many tries. Wait '+w+' s.':msg)+'</div><button type="submit"'+(w?' disabled':'')+'>UNLOCK</button></form>'
   +'<button type="button" class="g" id="lkx">'+(erase?'TAP AGAIN: ERASE DATA ON THIS DEVICE':'FORGOT PIN?')+'</button>'
   +(erase?'<p class="mut"><small>This removes the lock and everything saved on this device. A signed-in account\'s cloud save is not touched.</small></p>':'')+'</div>';
  if(!c){c=D0.createElement('div');c.id='hwlock';D0.body.appendChild(c)}c.innerHTML=html;
  c.querySelector('#lkf').addEventListener('submit',async e=>{e.preventDefault();const i=c.querySelector('#lkp'),p=i.value;i.value='';if(wait())return;
    if(await check(p)){good();msg='';erase=0;unlock()}else{miss();msg=wait()?'':'That PIN is not right.';cover()}});
  c.querySelector('#lkx').addEventListener('click',()=>{if(!erase){erase=1;cover();return}try{localStorage.clear()}catch(e){}try{sessionStorage.clear()}catch(e){}location.reload()});
  const i=c.querySelector('#lkp');if(i&&!i.disabled)setTimeout(()=>i.focus({preventScroll:true}),0);
  clearTimeout(tick);if(w)tick=setTimeout(cover,1000)}
function lock(){if(!on()||locked||!D0.body)return;locked=true;erase=0;msg='';D0.body.classList.add('hw-locked');inertOthers(true);cover()}
function unlock(force){if(!locked&&!force)return;locked=false;clearTimeout(tick);D0.body.classList.remove('hw-locked');inertOthers(false);const c=D0.getElementById('hwlock');if(c)c.remove()}

/* ---------- when it locks ---------- */
D0.addEventListener('visibilitychange',()=>{const r=read();if(!r)return;
  if(D0.hidden){hiddenAt=Date.now();if(r.a===0)lock()}
  else if(hiddenAt&&r.a>=0&&Date.now()-hiddenAt>=r.a*60000)lock()});
addEventListener('storage',e=>{if(e.key===K&&!e.newValue&&locked)unlock(true)});
if(on())lock(); // before anything is drawn: the cover is up while the app starts

/* ---------- Settings card ---------- */
const val=id=>{const e=D0.getElementById(id);return e?e.value:''};
function card(){const r=read();
  const intro='<p class="mut">Covers the app with a PIN. <b>This is a screen lock, not encryption:</b> it keeps casual onlookers out; it does not protect your data from someone who can read this browser\'s storage. Your PIN is never saved, only a salted hash, and it stays on this device (not in backups or the cloud).</p>';
  if(!ok())return '<div class="card" id="v6lock"><h3>PRIVACY LOCK</h3>'+intro+'<p class="mut">This browser cannot do the secure hashing the lock needs (open the app over https).</p></div>';
  if(!r)return '<div class="card" id="v6lock"><h3>PRIVACY LOCK</h3>'+intro+'<div class="lkf"><input id="lkn1" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="'+MAX+'" autocomplete="off" aria-label="New PIN, '+MIN+' to '+MAX+' digits" placeholder="PIN"><input id="lkn2" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="'+MAX+'" autocomplete="off" aria-label="Repeat the PIN" placeholder="AGAIN"></div>'
    +'<div class="row"><button data-a="lkset">TURN LOCK ON</button></div><p class="mut" id="lkmsg" role="status">'+esc(msg||MIN+' to '+MAX+' digits. If you forget it, the only way back in is to erase this device\'s data.')+'</p></div>';
  const a=AUTO.find(x=>x[0]===r.a)||AUTO[1];
  return '<div class="card" id="v6lock"><h3>PRIVACY LOCK</h3>'+intro+'<div class="v6pl"><span class="v6pk">STATUS</span><span>On</span></div>'
    +'<div class="row"><button data-a="lklock">LOCK NOW</button><button class="g" data-a="lkauto">LOCK: '+esc(a[1].toUpperCase())+'</button></div>'
    +'<div class="lkf"><input id="lko" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="'+MAX+'" autocomplete="off" aria-label="Current PIN" placeholder="PIN"><button class="g" data-a="lkoff">TURN LOCK OFF</button></div><p class="mut" id="lkmsg" role="status">'+esc(msg)+'</p></div>'}
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k=['<div class="card" id="v6live">','<div class="card" id="v6pwa">','<div class="card" id="bkp">'].find(x=>h.indexOf(x)>=0);return k?h.replace(k,card()+k):h+card()}}
const say=t=>{msg=t;const e=D0.getElementById('lkmsg');if(e)e.textContent=t};
acts.lkset=async()=>{const a=val('lkn1'),b=val('lkn2');if(a!==b){say('The two PINs do not match.');return}const e=await setPin(a,1);if(e){say(e);return}msg='';render();toast('Privacy lock is on.')};
acts.lklock=()=>lock();
acts.lkauto=()=>{const r=read();if(!r)return;const i=AUTO.findIndex(x=>x[0]===r.a);r.a=AUTO[(i+1)%AUTO.length][0];write(r);render()};
acts.lkoff=async()=>{if(!await check(val('lko'))){miss();say(wait()?'Too many tries. Wait '+wait()+' s.':'That PIN is not right.');return}good();off();render();toast('Privacy lock is off.')};

return{on,lock,locked:()=>locked,supported:ok,MIN,MAX,state:()=>{const r=read();return r?{on:true,auto:r.a,fails:r.f||0,wait:wait()}:{on:false}}}})();
