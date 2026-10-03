/* v6: installable app + offline support (master prompt §73–74, §87, §97 step 21). Not part of the original.
   index.html stays byte-identical to the original, so the manifest and icon links are added from here.
   * Install (§73): manifest.webmanifest (standalone display, theme/background colours for the splash screen, icons in
     assets/icons/ drawn by tools/make-icons.mjs). Settings → APP & OFFLINE offers INSTALL when the browser allows it,
     and the Add to Home Screen steps on iPhone/iPad.
   * Offline (§74): sw.js keeps a copy of the whole app (network first, so online visits stay current). Logging, quests,
     XP, statistics, mini-games, the Kingdom, Medius's own lines and achievements already run in the browser with
     localStorage, so they all work offline. Only the Wizard's Counsel AI chat needs internet (it already has an offline
     message). Cloud sync (js/v6-cloud.js) keeps unsynced changes and sends them when the device is back online.
   * Offline status (§87): a small OFFLINE badge while the device has no connection, saying logs are still saved.
   Only on the multi-file site served over https (or http://localhost). Opened from a file, or as the single-file
   standalone build, it adds nothing and loads nothing, since those already run without internet.
   Events: network:changed {online} · app:offline-ready {first} · app:installed {} (docs/EVENTS.md). */
const HWPwa=(()=>{
const D=document,N=navigator;
const external=!!D.querySelector('script[src$="js/v6-pwa.js"]'); // false in the standalone build (scripts inlined)
const served=/^https?:$/.test(location.protocol);
const secure=location.protocol==='https:'||/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const swOk=external&&served&&secure&&'serviceWorker' in N;
const mq=q=>{try{return matchMedia(q).matches}catch(e){return false}};
const standalone=()=>mq('(display-mode: standalone)')||mq('(display-mode: fullscreen)')||N.standalone===true;
const ios=()=>/iPad|iPhone|iPod/.test(N.userAgent||'')||(N.platform==='MacIntel'&&N.maxTouchPoints>1);
const online=()=>N.onLine!==false;

let sw=swOk?'starting':'off',deferred=null,kept=null,installed=false;

/* head links (manifest, icons) */
if(external&&served){const link=(rel,href,extra)=>{if(D.querySelector('link[rel="'+rel+'"]'))return;const l=D.createElement('link');l.rel=rel;l.href=href;Object.assign(l,extra||{});D.head.appendChild(l)};
  link('manifest','manifest.webmanifest');link('icon','assets/icons/icon-32.png',{type:'image/png'});link('apple-touch-icon','assets/icons/apple-touch-icon.png')}

HWUI.css('pwa',`
#v6net{position:fixed;left:10px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:65;background:var(--pn);color:var(--ink);border:3px solid var(--ln);box-shadow:3px 3px 0 var(--ln);padding:4px 10px;font:7px/1.8 var(--fh);white-space:nowrap;max-width:calc(100vw - 24px);overflow:hidden;text-overflow:ellipsis;pointer-events:none}
#v6net span{font:12px/1.4 var(--fb);margin-left:6px}
#v6pwa .v6pl{display:flex;gap:8px;align-items:baseline;margin:6px 0}#v6pwa .v6pl>.v6pk{flex:0 0 auto;font:7px/1.8 var(--fh);min-width:84px}
#v6pwa ol{margin:6px 0;padding-left:20px}#v6pwa li{margin:3px 0}
@media(max-width:760px){#v6net{bottom:calc(84px + env(safe-area-inset-bottom,0px))}#v6net span{display:none}}
`);

/* offline badge */
function badge(){let b=D.getElementById('v6net');if(online()){if(b)b.remove();return}
  if(!b){b=D.createElement('div');b.id='v6net';b.setAttribute('role','status');D.body.appendChild(b)}
  b.setAttribute('aria-label','Offline. Your logs are still saved on this device.');b.innerHTML='📴 OFFLINE<span aria-hidden="true">Your logs are still saved on this device.</span>'}
function net(){badge();paint();HWEvents.emit('network:changed',{online:online()});
  if(online())toast('📶 Back online.');else try{HWMedius.say('offline')}catch(e){}}
addEventListener('online',net);addEventListener('offline',net);
try{HWMedius.rules.offline={p:50,cd:1800e3,line:()=>'The roads beyond the walls are closed, yet the kingdom stands. Thy logs are kept safe right here.'}}catch(e){}

/* service worker */
function register(){
  let first=false; // no registration yet = the offline copy is being saved for the first time (a hard reload is not)
  N.serviceWorker.getRegistration().then(r=>{first=!r;return N.serviceWorker.register('sw.js')}).then(()=>N.serviceWorker.ready).then(()=>{sw='ready';paint();HWEvents.emit('app:offline-ready',{first});
    if(first)toast('📦 HealthWiz is saved on this device. It now opens without internet too.')})
  .catch(e=>{sw='error';paint();console.warn('[HealthWiz] offline copy not available:',e&&e.message)})}
if(swOk){if(D.readyState==='complete')register();else addEventListener('load',register,{once:true})}

/* install */
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;paint()});
addEventListener('appinstalled',()=>{installed=true;deferred=null;paint();HWEvents.emit('app:installed',{});toast('🏰 HealthWiz is installed. Find it with your other apps.');keep(true)});
acts.pwainst=()=>{if(!deferred)return;const p=deferred;deferred=null;p.prompt();(p.userChoice||Promise.resolve({})).then(r=>{if(r.outcome!=='accepted')toast('Not installed. You can install any time from Settings.');paint()}).catch(()=>paint())};

/* keep data: ask the browser not to clear this site's storage when space runs low */
function keep(quiet){const s=N.storage;if(!s||!s.persist)return;s.persist().then(ok=>{kept=ok;paint();if(!quiet)toast(ok?'🛡️ The browser will keep HealthWiz data unless you clear it yourself.':'The browser decides this by itself for now. Keep downloading backups to be safe.')}).catch(()=>{})}
acts.pwakeep=()=>keep(false);
try{N.storage.persisted().then(v=>{kept=v;paint()}).catch(()=>{})}catch(e){}

/* settings card */
const row=(k,v)=>'<div class="v6pl"><span class="v6pk">'+k+'</span><span>'+v+'</span></div>';
function card(){
  const app=standalone()||installed;
  const off=!external?'This is the single-file copy of HealthWiz. It already works without internet; to install it as an app, open the website version.'
    :!served?'Opened from a file on this device, so it already works without internet. To install it as an app, open the website version.'
    :!secure?'Offline copy needs a secure (https) address.'
    :!('serviceWorker' in N)?'This browser cannot keep an offline copy. Your logs are still saved on this device.'
    :sw==='ready'?'✅ Ready. HealthWiz opens and works without internet on this device.'
    :sw==='error'?'⚠️ The offline copy could not be saved this time. Everything still works online, and your logs are safe. It will try again on your next visit.'
    :'⏳ Saving a copy for offline use…';
  let inst='';
  if(app)inst='✅ Running as an installed app.';
  else if(deferred)inst='<button data-a="pwainst">📲 INSTALL HEALTHWIZ</button>';
  else if(ios()&&served&&external)inst='On iPhone or iPad, in Safari:<ol><li>Tap the Share button (square with an arrow).</li><li>Choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>.</li></ol>';
  else if(served&&external)inst='Use your browser menu: <b>Install app</b> or <b>Add to Home Screen</b>. If you see neither, HealthWiz may already be installed.';
  else inst='Available on the website version.';
  return '<div class="card" id="v6pwa"><h3>📲 APP &amp; OFFLINE</h3>'
    +row('CONNECTION',online()?'📶 Online':'📴 Offline. Logging, quests, XP, statistics, mini-games and the Kingdom all keep working.')
    +row('OFFLINE',off)+row('INSTALL',inst)
    +(N.storage&&N.storage.persist?row('STORAGE',kept?'🛡️ Protected: the browser will not clear HealthWiz data to free space.':'The browser may clear site data when space runs low. <button class="sm g" data-a="pwakeep">KEEP MY DATA</button>'):'')
    +'<small class="mut">Your data stays in this browser, installed or not. The Wizard\'s Counsel AI chat needs internet. Downloading a backup is still the safest way to move to a new device.</small></div>'}
function paint(){const el=D.getElementById('v6pwa');if(el)el.outerHTML=card()}
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k='<div class="card" id="bkp">';return h.indexOf(k)>=0?h.replace(k,card()+k):h+card()}}

HWEvents.on('app:ready',badge);
return{card,status:()=>({sw,online:online(),standalone:standalone(),installable:!!deferred,kept,external,served,secure})}})();
