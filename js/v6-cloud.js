/* v6: cloud save with Supabase (master prompt §74–76, §79, §83, §88, §91, §97 step 22). Not part of the original.
   Optional. Without a project and a sign-in, nothing here touches the network and HealthWiz stays local-only.
   * Setup: run supabase/migrations/*.sql once in the Supabase project, then put the project URL and its PUBLISHABLE
     (anon) key in CFG below, or paste them in Settings → CLOUD SAVE. A secret / service_role key is refused (§91).
     The publishable key is meant to be public: Row Level Security lets each account read and write only its own row.
   * Auth (§75): email + password through Supabase Auth (plain fetch, no library). The session lives in this browser
     under `healthwiz_cloud`, never in the `healthwiz` save or in backups.
   * Cloud save: one row per account in `hw_saves` = {rev, sv, data (the whole save), device, updated_at}.
     The server bumps `rev` on every write; a write only lands when its `rev` still matches (`rev=eq.n`), so two
     devices can never overwrite each other blindly.
   * Offline (§74): logs are saved locally first, always. While offline or signed out the difference to the last
     synced copy simply waits; it is sent on the next sync (back online, app opened, every few minutes, SYNC NOW).
   * Conflicts (§76): three-way merge against the last synced copy (`healthwiz_cloud_base`). Entries merge by id
     (adds from both sides kept, deletes and edits carried over, an entry edited on one device and deleted on the
     other is kept). Counters (XP, daily XP, plays, allowance) add both sides' gains. Other settings: a change on one
     side wins; changed on both, this device wins. Lists (game history, Medius memory) are joined.
   * First sign-in on a device that already has data, while the account also has a cloud save: the user chooses
     MERGE BOTH / USE CLOUD SAVE / KEEP THIS DEVICE. Nothing is decided silently.
   * No silent loss (§76): whenever a sync would drop entries from this device or from the cloud, the replaced copy is
     first kept on this device as a `healthwiz_backup_cloud_…` key (the newest 3 backups are kept).
   * Reset on this device signs the device out and leaves the cloud save untouched. A replace-restore of a backup is
     treated like a first sign-in (the user chooses again).
   * Cloud data is checked like a backup: migrated from older versions, repaired, refused when from a newer version.
   Events: cloud:signed-in · cloud:signed-out · cloud:synced {how, rev} · cloud:choose · cloud:error {code}
   (docs/EVENTS.md). A pull that changes this device's data also emits data:imported {mode:'cloud'}. */
const HWCloud=(()=>{
const CFG={url:'https://wghkbrtwrdrejmoswhza.supabase.co',key:'sb_publishable_nE2qzRG3W-fhd4EPFuELQQ_krPNAScU'}; // ← deployers: Supabase project URL + publishable key (never a secret or service_role key)
const D=document,N=navigator,K='healthwiz_cloud',KB='healthwiz_cloud_base';
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const J=x=>JSON.stringify(x),clone=x=>x===undefined?undefined:JSON.parse(J(x));
const online=()=>N.onLine!==false;
const rd=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
let C=(()=>{try{const o=JSON.parse(rd(K)||'{}');return isObj(o)?o:{}}catch(e){return{}}})();
const keep=()=>{try{localStorage.setItem(K,J(C))}catch(e){}};
const base=()=>rd(KB);
function setBase(s){try{localStorage.setItem(KB,s)}catch(e){try{localStorage.removeItem(KB)}catch(_){}C.rev=null}} // no room: next sync merges two-way
const url=()=>String(C.url||CFG.url||'').replace(/\/+$/,''),key=()=>String(C.key||CFG.key||'');
const configured=()=>!!(url()&&key()),signed=()=>!!(C.ses&&C.ses.uid);

/* ---------- checks (§83, §91) ---------- */
function jwt(t){try{let p=String(t).split('.')[1].replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';return JSON.parse(decodeURIComponent(escape(atob(p))))}catch(e){return null}}
function checkProject(u,k){u=String(u||'').trim().replace(/\/+$/,'');k=String(k||'').trim();
  let x;try{x=new URL(u)}catch(e){return'That project URL is not valid. It looks like https://abcd1234.supabase.co'}
  if(x.protocol!=='https:'&&!/^(localhost|127\.0\.0\.1)$/.test(x.hostname))return'The project URL must start with https://';
  if(x.pathname!=='/'&&x.pathname!==''||x.search||x.hash)return'Use only the project address, like https://abcd1234.supabase.co';
  if(!k)return'Paste the project\'s publishable key.';
  if(/^sb_secret_/.test(k)||(jwt(k)||{}).role==='service_role')return'⛔ That is a secret (service_role) key. It must never be put in an app. Use the publishable (anon) key, and rotate the secret key in Supabase if it was shared.';
  if(!/^sb_publishable_/.test(k)&&(jwt(k)||{}).role!=='anon')return'That does not look like a publishable key (sb_publishable_… or the legacy anon key).';
  return{u,k}}

/* ---------- HTTP ---------- */
const fail=(code,msg,status)=>Object.assign(new Error(msg),{code,status});
async function http(path,{method='GET',body,auth=true,prefer}={}){
  const h={apikey:key(),'Content-Type':'application/json'};
  if(auth){await fresh();h.Authorization='Bearer '+C.ses.at}
  if(prefer)h.Prefer=prefer;
  const ctl=typeof AbortController==='function'?new AbortController():null,t=setTimeout(()=>ctl&&ctl.abort(),15000);
  let r;try{r=await fetch(url()+path,{method,headers:h,body:body==null?undefined:J(body),signal:ctl&&ctl.signal,cache:'no-store'})}
  catch(e){throw fail('net','Could not reach the cloud.')}finally{clearTimeout(t)}
  const txt=await r.text().catch(()=>'');let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok){const m=String((j&&(j.msg||j.message||j.error_description||j.error))||('Error '+r.status)).slice(0,200);
    const missing=r.status===404||(j&&/PGRST20[25]|42P01|42883/.test(j.code||''));
    throw fail(r.status===401?'auth':missing?'setup':r.status===409?'conflict':r.status===413||(j&&j.code==='23514')?'size':'http',m,r.status)}
  return j}

/* ---------- auth ---------- */
function setSes(at,rt,sec){const p=jwt(at)||{};C.ses={at,rt,exp:Date.now()+(+sec||3600)*1000,uid:p.sub,email:p.email||''};keep()}
let refreshing=null;
function fresh(){if(!signed())return Promise.reject(fail('auth','Not signed in.'));if(Date.now()<C.ses.exp-60e3)return Promise.resolve();
  return refreshing=refreshing||http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:C.ses.rt},auth:false})
    .then(j=>setSes(j.access_token,j.refresh_token,j.expires_in))
    .catch(e=>{if(e.status>=400&&e.status<500){drop();throw fail('auth','Your sign-in has expired. Please sign in again.')}throw e})
    .finally(()=>{refreshing=null})}
function drop(){C.ses=null;C.rev=null;C.choose=null;keep();try{localStorage.removeItem(KB)}catch(e){}}
async function signIn(email,pw,create){
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))throw fail('input','Enter a valid email address.');
  if(String(pw).length<8)throw fail('input','The password needs at least 8 characters.');
  const back=/^https?:$/.test(location.protocol)?location.href.split('#')[0]:'';
  const j=create?await http('/auth/v1/signup'+(back?'?redirect_to='+encodeURIComponent(back):''),{method:'POST',body:{email,password:pw},auth:false})
    :await http('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password:pw},auth:false}).catch(e=>{throw e.status===400?fail('input','Email or password is not right. If you just created the account, confirm it from your email first.'):e});
  if(!j||!j.access_token)return'confirm';
  setSes(j.access_token,j.refresh_token,j.expires_in);C.rev=null;C.choose=null;keep();try{localStorage.removeItem(KB)}catch(e){} // no shared history yet
  HWEvents.emit('cloud:signed-in',{});return'in'}
function signOut(why){const at=signed()&&C.ses.at;if(at&&online())fetch(url()+'/auth/v1/logout',{method:'POST',headers:{apikey:key(),Authorization:'Bearer '+at}}).catch(()=>{});
  drop();lastErr='';HWEvents.emit('cloud:signed-out',{why:why||'user'})}
// email confirmation link: Supabase sends the user back here with the session in the address hash
{const h=location.hash||'';if(/access_token=/.test(h)&&/refresh_token=/.test(h)&&configured()){const q=new URLSearchParams(h.slice(1));
  setSes(q.get('access_token'),q.get('refresh_token'),q.get('expires_in'));C.rev=null;keep();try{localStorage.removeItem(KB)}catch(e){}
  try{history.replaceState(null,'',location.href.split('#')[0])}catch(e){}setTimeout(()=>toast('☁️ Email confirmed. You are signed in to your cloud save.'),900)}
 else if(/error_description=/.test(h)){const q=new URLSearchParams(h.slice(1));setTimeout(()=>toast('⚠️ '+esc(q.get('error_description')||'Sign-in link failed.')),900);try{history.replaceState(null,'',location.href.split('#')[0])}catch(e){}}}

/* ---------- merge (§76) ---------- */
const ADD=/^(xp|xd\.[^.]+|mg\.n\.[^.]+|xl\.[^.]+\.[^.]+)$/,num=x=>typeof x==='number'&&isFinite(x);
const eq=(a,b)=>J(a)===J(b);
function entries(b,l,r){const m=a=>new Map((Array.isArray(a)?a:[]).filter(isObj).map(x=>[String(x.id),x]));
  const B=m(b),L=m(l),R=m(r),out=[];
  for(const[id,x]of L){const y=R.get(id),z=B.get(id);
    if(y)out.push(eq(x,z)?y:x);          // edited on the other device only → theirs; otherwise ours
    else if(!z||!eq(x,z))out.push(x)}     // new here, or edited here while deleted there → keep
  for(const[id,y]of R)if(!L.has(id)){const z=B.get(id);if(!z||!eq(y,z))out.push(y)}
  return out}
/** Three-way merge of whole saves. `b` = last synced copy (undefined: no shared history, so counters take the max). */
function merge(b,l,r){const two=b===undefined;
  const m=(b,l,r,p)=>{if(eq(l,r))return clone(l);if(!two&&eq(l,b))return clone(r);if(!two&&eq(r,b))return clone(l);
    if(l===undefined)return two?clone(r):undefined;if(r===undefined)return clone(l);
    if(p==='e')return entries(b,l,r);
    if(ADD.test(p)&&num(l)&&num(r))return two?Math.max(l,r):Math.max(0,l+r-(num(b)?b:0));
    if(isObj(l)&&isObj(r)){const o={};new Set([...Object.keys(l),...Object.keys(r)]).forEach(k=>{const v=m(isObj(b)?b[k]:undefined,l[k],r[k],p?p+'.'+k:k);if(v!==undefined)o[k]=v});return o}
    if(Array.isArray(l)&&Array.isArray(r)){const s=new Set(l.map(J));return clone(l.concat(r.filter(x=>!s.has(J(x)))))}
    return clone(l)};
  return HWSchema.sanitize(m(b,l,r,''),DEF)[0]}

/* ---------- sync ---------- */
let busy=null,again=0,phase='idle',lastErr='',seen=-1,timer=0;
const uid=()=>encodeURIComponent(C.ses.uid);
function device(){const u=N.userAgent||'';return(/iPad/.test(u)||(N.platform==='MacIntel'&&N.maxTouchPoints>1)?'iPad':/iPhone/.test(u)?'iPhone':/Android/.test(u)?(/Mobile/.test(u)?'Android phone':'Android tablet'):/Windows/.test(u)?'Windows':/Mac OS/.test(u)?'Mac':/CrOS/.test(u)?'Chromebook':/Linux/.test(u)?'Linux':'Browser')}
const ids=s=>new Set(((s&&s.e)||[]).map(x=>String(x.id)));
const loses=(from,to)=>{const t=ids(to);return[...ids(from)].some(i=>!t.has(i))};
const stash=(s,why)=>{try{HWSchema.stash(typeof s==='string'?s:J(s),why)}catch(e){}};
const empty=s=>!(s.e||[]).length&&!(+s.xp>0)&&!Object.keys(s.b||{}).length;
function prep(d){if(!isObj(d)||!Array.isArray(d.e))throw fail('bad','The cloud save could not be read, so nothing was changed on this device.');
  const m=HWSchema.migrate(d);if(m.err)throw fail('newer',m.err+' Nothing was changed on this device or in the cloud.');return HWSchema.sanitize(m.data,DEF)[0]}
function apply(n){const before=st.e.length;st=n;save();HWEvents.hush(()=>render());
  HWEvents.emit('data:imported',{mode:'cloud',added:Math.max(0,st.e.length-before),total:st.e.length})}
function done(rev,s,how){C.rev=rev;C.last=new Date().toISOString();C.choose=null;keep();setBase(s);seen=SV;phase='ok';lastErr='';
  HWEvents.emit('cloud:synced',{how,rev})}
async function push(rev,s,remote){
  if(remote&&loses(remote,JSON.parse(s)))stash(remote,'cloud');
  const r=await http('/rest/v1/hw_saves?user_id=eq.'+uid()+'&rev=eq.'+rev,{method:'PATCH',body:{sv:HWSchema.V,data:JSON.parse(s),device:device()},prefer:'return=representation'});
  return Array.isArray(r)&&r[0]?r[0].rev:null} // null: another device wrote first
async function run(){
  for(let i=0;i<3;i++){
    const rows=await http('/rest/v1/hw_saves?select=rev,sv,data,device,updated_at&user_id=eq.'+uid());
    const R=Array.isArray(rows)&&rows[0],Ls=J(st);
    if(!R){const r=await http('/rest/v1/hw_saves',{method:'POST',body:{user_id:C.ses.uid,sv:HWSchema.V,data:st,device:device()},prefer:'return=representation'}).catch(e=>{if(e.code==='conflict')return null;throw e});
      if(r&&r[0]){done(r[0].rev,Ls,'up');return}continue}
    const rem=prep(R.data),Rs=J(rem),B=base();
    if(C.rev==null||B==null){ // no shared history on this device yet
      if(Ls===Rs){done(R.rev,Ls,'none');return}
      if(empty(st)){apply(rem);done(R.rev,Rs,'down');return}
      C.choose={rev:R.rev,n:rem.e.length,xp:rem.xp,at:R.updated_at,dev:R.device||''};keep();phase='choose';
      HWEvents.emit('cloud:choose',{});return}
    if(R.rev===C.rev){if(Ls===B){phase='ok';C.last=new Date().toISOString();keep();return}
      const v=await push(R.rev,Ls,rem);if(v){done(v,Ls,'up');return}continue}
    // the cloud moved on since our last sync
    if(Ls===B){apply(rem);done(R.rev,Rs,'down');return}
    const M=merge(JSON.parse(B),st,rem),Ms=J(M);
    if(loses(st,M))stash(Ls,'cloud');
    if(Ms!==Ls)apply(M);
    if(Ms===Rs){done(R.rev,Ms,'down');return}
    const v=await push(R.rev,Ms,rem);if(v){done(v,Ms,'merge');return}}
  throw fail('busy','Another device kept saving at the same moment.')}
function sync(why){
  if(!configured()||!signed())return Promise.resolve();
  if(!online()){phase='offline';paint();return Promise.resolve()}
  if(C.choose&&why!=='chosen')return Promise.resolve();
  if(busy){again=1;return busy}
  phase='sync';paint();
  busy=run().catch(e=>{phase='error';lastErr=e.code==='net'?'net':e.message;
      if(e.code==='auth'&&!signed()){phase='idle';lastErr=e.message;HWEvents.emit('cloud:signed-out',{why:'expired'})}
      HWEvents.emit('cloud:error',{code:e.code||'error'});if(why==='user')toast('⚠️ '+esc(msg()))})
    .finally(()=>{busy=null;paint();if(again||(phase==='ok'&&J(st)!==base())){again=0;later(1500,1)}}); // e.g. awards made by the render after a pull
  return busy}
function later(ms,force){if(!signed())return;clearTimeout(timer);timer=setTimeout(()=>{if(force||SV!==seen||C.rev==null){seen=SV;if(J(st)!==base()||C.rev==null)sync('auto')}},ms)}

/* ---------- the user's choice on a first sign-in ---------- */
async function choose(how){const c=C.choose;if(!c||busy)return;phase='sync';paint();let gone=0;
  busy=(async()=>{const rows=await http('/rest/v1/hw_saves?select=rev,data&user_id=eq.'+uid()),R=rows&&rows[0];
    if(!R){C.choose=null;keep();gone=1;return} // the cloud save was deleted meanwhile: this device's data is uploaded
    const rem=prep(R.data),Rs=J(rem),Ls=J(st);
    if(how==='cloud'){stash(Ls,'cloud');apply(rem);done(R.rev,Rs,'down');toast('☁️ Cloud save loaded. This device\'s previous data was kept as a backup copy.');return}
    const out=how==='merge'?merge(undefined,st,rem):clone(st),Os=J(out);
    if(how==='merge'&&Os!==Ls)apply(out);
    const v=await push(R.rev,Os,rem);if(!v)throw fail('busy','The cloud save changed meanwhile. Please choose again.');
    done(v,Os,how==='merge'?'merge':'up');toast(how==='merge'?'☁️ Both saves merged and synced.':'☁️ This device\'s data is now the cloud save. The old cloud copy was kept on this device as a backup.')})()
  .catch(e=>{phase='error';lastErr=e.code==='net'?'net':e.message;HWEvents.emit('cloud:error',{code:e.code||'error'})}).finally(()=>{busy=null;paint();if(gone)sync('chosen')})}

/* ---------- triggers ---------- */
HWEvents.on('*',e=>{if(/^(cloud|medius|page|motion|title|insight|network):/.test(e.type))return;if(e.type==='data:reset'||(e.type==='data:imported'&&e.mode==='cloud'))return;later(4000)});
HWEvents.on('app:ready',()=>sync('open'));
HWEvents.on('data:reset',()=>{if(signed()){signOut('reset');toast('☁️ Signed out of cloud save on this device. Your cloud save was not erased.')}});
HWEvents.on('data:imported',e=>{if(e.mode==='replace'&&signed()){C.rev=null;keep();try{localStorage.removeItem(KB)}catch(_){}}});
addEventListener('online',()=>sync('online'));addEventListener('offline',()=>{if(signed()){phase='offline';paint()}});
D.addEventListener('visibilitychange',()=>{if(!signed())return;if(D.visibilityState==='visible'){if(!C.last||Date.now()-Date.parse(C.last)>60e3)sync('focus')}else if(J(st)!==base())sync('hide')});
setInterval(()=>{if(signed()&&D.visibilityState!=='hidden'){if(!C.last||Date.now()-Date.parse(C.last)>300e3)sync('poll');else later(0)}},30e3);
try{HWMedius.rules.cloud={p:40,cd:1800e3,line:()=>'A messenger rode in from thine other device. The chronicle is whole again.'}}catch(e){}

/* ---------- Settings → CLOUD SAVE (§79, §87–88) ---------- */
HWUI.css('cloud',`
#v6cl .v6pl{display:flex;gap:8px;align-items:baseline;margin:6px 0}#v6cl .v6pl>.v6pk{flex:0 0 auto;font:7px/1.8 var(--fh);min-width:84px}
#v6cl .v6clc{border:3px solid var(--ln);padding:8px 10px;margin:8px 0;background:var(--bg)}
#v6cl .row button{flex:1 1 140px}#v6cl details{margin-top:8px}#v6cl .warn{margin:8px 0}
`);
const row=(k,v)=>'<div class="v6pl"><span class="v6pk">'+k+'</span><span>'+v+'</span></div>';
function ago(t){const s=(Date.now()-Date.parse(t))/1000;if(!(s>=0))return'';return s<60?'just now':s<3600?Math.round(s/60)+' min ago':s<86400?Math.round(s/3600)+' h ago':new Date(t).toLocaleDateString()}
function msg(){return lastErr==='net'?'Could not reach the cloud. Your logs are saved on this device and will sync when the connection works.'
  :/relation|table|schema cache|function/i.test(lastErr)?'The cloud project is not set up yet (the hw_saves table is missing). Run the setup SQL from supabase/migrations in the Supabase project.':lastErr}
let arm='',note='';
function status(){const dirty=signed()&&J(st)!==base();
  if(phase==='sync')return'⏳ Syncing…';
  if(!online())return'📴 Offline. Your logs are saved on this device'+(dirty?' and will sync when you are back online.':'.');
  if(phase==='error')return'⚠️ '+esc(msg())+(C.last?' Last synced '+ago(C.last)+'.':'')+' Nothing on this device was lost. Use SYNC NOW to try again.';
  if(dirty&&C.rev!=null)return'⏳ Changes waiting to sync.';
  return C.last?'✅ Synced '+ago(C.last)+'.':'Not synced yet.'}
function card(){
  let h='<div class="card" id="v6cl"><h3>☁️ CLOUD SAVE</h3>';
  if(!configured()){
    h+='<p class="mut">Optional. Sign in to keep your kingdom safe in the cloud and use it on more than one device. Without it, everything stays in this browser.</p>'
      +'<details><summary>Connect a Supabase project</summary><p class="mut">Run the setup SQL in <b>supabase/migrations/</b> once in your Supabase project, then paste its address and <b>publishable</b> key (Project Settings → API). Never paste a secret or service_role key.</p>'
      +'<label>Project URL<input id="clurl" type="url" placeholder="https://abcd1234.supabase.co" autocomplete="off" spellcheck="false"></label>'
      +'<label>Publishable key<input id="clkey" placeholder="sb_publishable_…" autocomplete="off" spellcheck="false"></label>'
      +'<button data-a="clproj" style="width:100%">CONNECT PROJECT</button></details>';
  }else if(!signed()){
    h+='<p class="mut">Sign in to back up your kingdom and keep it in step across devices. Your save is private: only your account can read it.</p>'
      +'<label>Email<input id="clem" type="email" autocomplete="email" inputmode="email" spellcheck="false"></label>'
      +'<label>Password<input id="clpw" type="password" autocomplete="current-password" minlength="8"></label>'
      +'<div class="row"><button data-a="clin">SIGN IN</button><button class="g" data-a="clup">CREATE ACCOUNT</button></div>'
      +(C.url&&!CFG.url?'<small class="mut">Project: '+esc(url().replace(/^https:\/\//,''))+' · <button class="sm g" data-a="clforget">CHANGE</button></small>':'');
  }else{
    h+=row('ACCOUNT',esc(C.ses.email||'Signed in'))+'<div role="status" aria-live="polite">'+row('STATUS',status())+'</div>';
    if(C.choose){const c=C.choose;h+='<div class="v6clc"><b>This account already has a cloud save.</b>'
      +row('CLOUD',c.n+' entr'+(c.n===1?'y':'ies')+' · '+(+c.xp||0)+' XP'+(c.at?' · saved '+ago(c.at):'')+(c.dev?' from '+esc(c.dev):''))
      +row('THIS DEVICE',st.e.length+' entr'+(st.e.length===1?'y':'ies')+' · '+(+st.xp||0)+' XP')
      +'<div class="row"><button data-a="clmerge">MERGE BOTH (RECOMMENDED)</button><button class="g" data-a="clcloud">USE CLOUD SAVE</button><button class="g" data-a="cllocal">KEEP THIS DEVICE</button></div>'
      +'<small class="mut">Merge keeps every entry from both. If you pick one side, the other side\'s data is kept on this device as a backup copy.</small></div>'}
    h+='<div class="row"><button data-a="clsync"'+(phase==='sync'||C.choose?' disabled':'')+'>🔄 SYNC NOW</button><button class="g" data-a="clout">SIGN OUT</button></div>'
      +'<details><summary>Manage cloud data</summary><p class="mut">Signing out keeps your data on this device and in the cloud. Deleting removes only the cloud copy; this device keeps its data.</p>'
      +'<div class="row"><button class="g" data-a="cldel">'+(arm==='del'?'TAP AGAIN TO DELETE CLOUD SAVE':'DELETE CLOUD SAVE')+'</button><button class="g" data-a="clacct">'+(arm==='acct'?'TAP AGAIN TO DELETE ACCOUNT':'DELETE ACCOUNT')+'</button></div></details>';
  }
  if(note)h+='<div class="warn">'+note+'</div>';
  return h+'<small class="mut">Health data is sent only to your own private cloud save, never to a leaderboard or other people.</small></div>'}
function paint(){const el=D.getElementById('v6cl');if(!el)return;const v={};['clem','clpw','clurl','clkey'].forEach(i=>{const x=D.getElementById(i);if(x)v[i]=x.value});
  const f=D.activeElement&&D.activeElement.id,open=!!el.querySelector('details[open]');el.outerHTML=card();
  Object.keys(v).forEach(i=>{const x=D.getElementById(i);if(x)x.value=v[i]});const n=D.getElementById('v6cl');if(open&&n){const d=n.querySelector('details');if(d)d.open=true}if(f){const x=D.getElementById(f);if(x)x.focus()}}
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k='<div class="card" id="v6pwa">';const i=h.indexOf(k)>=0?h.indexOf(k):h.indexOf('<div class="card" id="bkp">');return i>=0?h.slice(0,i)+card()+h.slice(i):h+card()}}
HWEvents.on('page:viewed',()=>{arm='';note=''});
const val=i=>((D.getElementById(i)||{}).value||'').trim();
const say=(m,ok)=>{note=ok?'':m;paint();if(ok)toast(m)};
acts.clproj=()=>{const r=checkProject(val('clurl'),val('clkey'));if(typeof r==='string')return say(esc(r));C.url=r.u;C.key=r.k;keep();say('☁️ Project connected. Now sign in or create an account.',1)};
acts.clforget=()=>{if(signed())return;C.url='';C.key='';keep();note='';paint()};
async function auth(create){if(!online())return say('You are offline. Sign in when you have a connection; your logs are safe on this device.');
  const em=val('clem'),pw=(D.getElementById('clpw')||{}).value||'';note='';phase='sync';paint();
  try{const r=await signIn(em,pw,create);phase='idle';
    if(r==='confirm')say('📧 Account created. Open the link in the email we sent to '+esc(em)+', then sign in here.');
    else{note='';paint();toast('☁️ Signed in.');sync('user')}}
  catch(e){phase='idle';say('⚠️ '+esc(e.code==='net'?'Could not reach the cloud. Check your connection and try again.':e.message)+' Nothing on this device was changed.')}}
acts.clin=()=>auth(false);acts.clup=()=>auth(true);
acts.clout=()=>{signOut('user');note='';paint();toast('Signed out. Your data stays on this device.')};
acts.clsync=()=>sync('user');
acts.clmerge=()=>choose('merge');acts.clcloud=()=>choose('cloud');acts.cllocal=()=>choose('local');
acts.cldel=async()=>{if(arm!=='del'){arm='del';return paint()}arm='';
  try{const rows=await http('/rest/v1/hw_saves?select=data&user_id=eq.'+uid());if(rows&&rows[0])stash(rows[0].data,'cloud');
    await http('/rest/v1/hw_saves?user_id=eq.'+uid(),{method:'DELETE'});C.rev=null;C.last=null;C.choose=null;keep();try{localStorage.removeItem(KB)}catch(e){}
    signOut('deleted');say('🗑️ Cloud save deleted and signed out. This device still has all its data.',1)}
  catch(e){say('⚠️ '+esc(e.code==='net'?'Could not reach the cloud.':e.message)+' Nothing was deleted.')}};
acts.clacct=async()=>{if(arm!=='acct'){arm='acct';return paint()}arm='';
  try{await http('/rest/v1/rpc/hw_delete_account',{method:'POST',body:{}});signOut('deleted');say('🗑️ Account and cloud save deleted. This device still has all its data.',1)}
  catch(e){say('⚠️ '+esc(e.code==='net'?'Could not reach the cloud.':e.message)+' Nothing was deleted.')}};
D.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='clpw'){e.preventDefault();acts.clin()}});
HWEvents.on('cloud:choose',()=>{paint();if(S.v!=='set')toast('☁️ This account already has a cloud save. Choose how to combine it in Settings → Cloud Save.')});

// for js/v6-board.js: signed-in requests to the same project (errors carry .code like http())
const api=(path,o)=>http(path,o),who=()=>signed()?C.ses.uid:null;
return{card,sync,merge,checkProject,api,who,status:()=>({configured:configured(),signed:signed(),phase,rev:C.rev==null?null:C.rev,last:C.last||null,choose:!!C.choose,error:lastErr,pending:signed()&&J(st)!==base()})}})();
