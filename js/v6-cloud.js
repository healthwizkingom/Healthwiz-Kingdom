/* v6: optional account + cloud sync with Supabase (master prompt §74–76, §79, §83, §88, §91). Not part of the original.
   Without a sign-in nothing here touches the network and HealthWiz stays local-only, exactly as before.
   The screens (Settings → ACCOUNT, the "What happens when you sign in" sheet, the sign-in steps, the onboarding offer)
   are in js/v6-account.js; this file is the engine.
   * Project: CFG below (URL + PUBLISHABLE key). A secret / service_role key is refused (§91). The publishable key is
     public by design: Row Level Security lets each account read and write only its own row.
   * Sign-in, no password (plain fetch to Supabase Auth, no library):
       - email: POST /auth/v1/otp sends one email with a magic link and a 6-digit code. The link signs in the browser it
         is opened in (the session comes back in the address hash); the code, typed here, signs in this app, which also
         works in an installed app whose links open elsewhere.
       - Google: /auth/v1/authorize with PKCE (S256); the code that comes back is exchanged for the session.
     The session lives under `healthwiz_cloud` in this browser, never in the `healthwiz` save or in backups.
   * Cloud save: one row per account in `user_data` = {user_id, data (the whole save), updated_at}
     (supabase/migrations/20261007000000_user_data.sql). updated_at is the version: the server moves it forward on every
     write, and a write only lands when it still matches (`updated_at=eq.<last seen>`), so two devices never overwrite
     each other blindly.
   * When: on app start, about 10 s after data changes (one write for a burst of logging), when the app goes to the
     background, back online, and every 5 minutes while open. Offline, changes simply wait and go later.
   * Conflicts (§76): three-way merge against the last synced copy (`healthwiz_cloud_base`). Entries merge by id
     (adds from both sides kept, deletes and edits carried over, an entry edited on one device and deleted on the
     other is kept). Counters (XP, daily XP, plays, allowance) add both sides' gains. Other settings: a change on one
     side wins; changed on both, this device wins. Lists (game history, Medius memory) are joined.
   * First sign-in with data on this device and in the cloud: the user chooses KEEP THIS DEVICE'S DATA / KEEP CLOUD
     DATA / MERGE. MERGE uses the backup restore's own rules (bkMerge in js/hw-06…: every entry from both, badges and day
     records combined, the larger XP). Whichever side is replaced is first kept on this device as a
     `healthwiz_backup_cloud_…` copy (the newest 3 are kept). Nothing is decided silently.
   * Never synced: the Wizard's Counsel chat. It lives only in the open page (S.cs), never in the save.
   * Reset on this device signs the device out and leaves the cloud untouched. A replace-restore of a backup is treated
     like a first sign-in (the user chooses again). Cloud data is checked like a backup (migrated, repaired, refused when
     from a newer version).
   Events: cloud:signed-in {via} · cloud:signed-out {why} · cloud:synced {how, at} · cloud:choose · cloud:error {code}
   (docs/EVENTS.md). A pull that changes this device's data also emits data:imported {mode:'cloud'}. */
const HWCloud=(()=>{
const CFG={url:'https://wghkbrtwrdrejmoswhza.supabase.co',key:'sb_publishable_nE2qzRG3W-fhd4EPFuELQQ_krPNAScU'}; // ← deployers: Supabase project URL + publishable key (never a secret or service_role key)
const ICO=n=>typeof HWPixel!=='undefined'?HWPixel.icon(n,1)+' ':'';
const D=document,N=navigator,K='healthwiz_cloud',KB='healthwiz_cloud_base',WAIT=10e3;
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const J=x=>JSON.stringify(x),clone=x=>x===undefined?undefined:JSON.parse(J(x));
const online=()=>N.onLine!==false;
const rd=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
let C=(()=>{try{const o=JSON.parse(rd(K)||'{}');return isObj(o)?o:{}}catch(e){return{}}})();
const keep=()=>{try{localStorage.setItem(K,J(C))}catch(e){}};
const base=()=>rd(KB);
function setBase(s){try{localStorage.setItem(KB,s)}catch(e){try{localStorage.removeItem(KB)}catch(_){}C.ts=null}} // no room: next sync merges two-way
const url=()=>String(C.url||CFG.url||'').replace(/\/+$/,''),key=()=>String(C.key||CFG.key||'');
const configured=()=>!!(url()&&key()),signed=()=>!!(C.ses&&C.ses.uid);

/* ---------- checks (§83, §91) ---------- */
function jwt(t){try{let p=String(t).split('.')[1].replace(/-/g,'+').replace(/_/g,'/');while(p.length%4)p+='=';return JSON.parse(decodeURIComponent(escape(atob(p))))}catch(e){return null}}
function checkProject(u,k){u=String(u||'').trim().replace(/\/+$/,'');k=String(k||'').trim();
  let x;try{x=new URL(u)}catch(e){return'That project URL is not valid. It looks like https://abcd1234.supabase.co'}
  if(x.protocol!=='https:'&&!/^(localhost|127\.0\.0\.1)$/.test(x.hostname))return'The project URL must start with https://';
  if(x.pathname!=='/'&&x.pathname!==''||x.search||x.hash)return'Use only the project address, like https://abcd1234.supabase.co';
  if(!k)return'Paste the project\'s publishable key.';
  if(/^sb_secret_/.test(k)||(jwt(k)||{}).role==='service_role')return'That is a secret (service_role) key. It must never be put in an app. Use the publishable (anon) key, and rotate the secret key in Supabase if it was shared.';
  if(!/^sb_publishable_/.test(k)&&(jwt(k)||{}).role!=='anon')return'That does not look like a publishable key (sb_publishable_… or the legacy anon key).';
  return{u,k}}

/* ---------- HTTP ---------- */
const fail=(code,msg,status,body)=>Object.assign(new Error(msg),{code,status,body});
async function http(path,{method='GET',body,auth=true,prefer,ms=15000}={}){
  const h={apikey:key(),'Content-Type':'application/json'};
  if(auth){await fresh();h.Authorization='Bearer '+C.ses.at}
  if(prefer)h.Prefer=prefer;
  const ctl=typeof AbortController==='function'?new AbortController():null,t=setTimeout(()=>ctl&&ctl.abort(),ms);
  let r;try{r=await fetch(url()+path,{method,headers:h,body:body==null?undefined:J(body),signal:ctl&&ctl.signal,cache:'no-store'})}
  catch(e){throw fail('net','Could not reach the cloud.')}finally{clearTimeout(t)}
  const txt=await r.text().catch(()=>'');let j=null;try{j=txt?JSON.parse(txt):null}catch(e){}
  if(!r.ok){const m=String((j&&(j.msg||j.message||j.error_description||j.error))||('Error '+r.status)).slice(0,200);
    const missing=r.status===404||(j&&/PGRST20[25]|42P01|42883/.test(j.code||''));
    throw fail(r.status===401?'auth':missing?'setup':r.status===409?'conflict':r.status===429?'rate':r.status===413||(j&&j.code==='23514')?'size':'http',m,r.status,j)}
  return j}

/* ---------- session ---------- */
function setSes(at,rt,sec,via){const p=jwt(at)||{};C.ses={at,rt,exp:Date.now()+(+sec||3600)*1000,uid:p.sub,email:p.email||'',via:via||(C.ses&&C.ses.via)||'email'};keep()}
let refreshing=null;
function fresh(){if(!signed())return Promise.reject(fail('auth','Not signed in.'));if(Date.now()<C.ses.exp-60e3)return Promise.resolve();
  return refreshing=refreshing||http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:C.ses.rt},auth:false})
    .then(j=>setSes(j.access_token,j.refresh_token,j.expires_in))
    .catch(e=>{if(e.status>=400&&e.status<500){drop();throw fail('auth','Your sign-in has expired. Please sign in again.')}throw e})
    .finally(()=>{refreshing=null})}
function drop(){C.ses=null;C.ts=null;C.choose=null;C.last=null;keep();try{localStorage.removeItem(KB)}catch(e){}}
function begin(j,via){if(!j||!j.access_token)throw fail('auth','The sign-in did not return a session. Please try again.');
  setSes(j.access_token,j.refresh_token,j.expires_in,via);C.ts=null;C.choose=null;C.em=null;C.pk=null;keep();try{localStorage.removeItem(KB)}catch(e){} // no shared history yet
  HWEvents.emit('cloud:signed-in',{via});return'in'}
/** Where Supabase sends the user back: this page, without hash or query. */
const here=()=>/^https?:$/.test(location.protocol)?location.origin+location.pathname:'';
const EMAIL=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
function authWhy(e){const m=String(e&&e.message||'');
  return e.code==='net'?'Could not reach the sign-in service. Check your connection and try again.'
    :/not authori[sz]ed/i.test(m)?'This copy of HealthWiz cannot send sign-in emails yet (its email sender is not set up). Try Google, or ask whoever runs the app to set up email sending.'
    :e.code==='rate'||/security purposes|rate limit|too many/i.test(m)?'Too many sign-in emails were asked for. Please wait a minute and try again.'
    :/expired|invalid|otp/i.test(m)?'That code did not work (it may have expired). Check the newest email, or send a new one.'
    :/provider is not enabled|unsupported provider/i.test(m)?'Google sign-in is not switched on for this copy of HealthWiz yet. Use your email instead.'
    :m||'Sign-in failed. Please try again.'}
/** Email: one message with a magic link and a 6-digit code. */
async function sendLink(email){email=String(email||'').trim();
  if(!EMAIL.test(email))throw fail('input','Enter a valid email address.');
  if(!online())throw fail('net','You are offline.');
  const b=here();
  await http('/auth/v1/otp'+(b?'?redirect_to='+encodeURIComponent(b):''),{method:'POST',body:{email,create_user:true},auth:false});
  C.em={email,at:Date.now()};keep();return'sent'}
async function verifyCode(email,code){email=String(email||'').trim();code=String(code||'').replace(/\s+/g,'');
  if(!/^\d{6,10}$/.test(code))throw fail('input','Type the code from the email (6 digits).');
  const j=await http('/auth/v1/verify',{method:'POST',body:{type:'email',email,token:code},auth:false});
  return begin(j,'email')}
/** Google: PKCE when the browser can hash (https or localhost), otherwise the older implicit flow. */
async function google(){if(!online())throw fail('net','You are offline.');const b=here();
  if(!b)throw fail('input','Google sign-in works on the website or installed app, not from a file on this device.');
  let q='?provider=google&redirect_to='+encodeURIComponent(b);
  try{const a=new Uint8Array(48);crypto.getRandomValues(a);const v=Array.from(a,x=>('0'+x.toString(16)).slice(-2)).join('');
    const h=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
    const ch=btoa(String.fromCharCode.apply(null,h)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    C.pk={v,at:Date.now()};keep();q+='&code_challenge='+ch+'&code_challenge_method=s256'}catch(e){C.pk=null;keep()}
  location.assign(url()+'/auth/v1/authorize'+q)}
async function settings(){return http('/auth/v1/settings',{auth:false,ms:8000})}
function signOut(why){const at=signed()&&C.ses.at;if(at&&online())fetch(url()+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:key(),Authorization:'Bearer '+at}}).catch(()=>{});
  drop();lastErr='';phase='idle';HWEvents.emit('cloud:signed-out',{why:why||'user'})}
async function deleteAccount(){await http('/rest/v1/rpc/hw_delete_account',{method:'POST',body:{}});C.ts=null;C.choose=null;keep();signOut('deleted')}

// Back from an email link or Google: the session (implicit flow, address hash) or a code to exchange (PKCE, query).
const tidy=()=>{try{const u=new URL(location.href);['code','error','error_code','error_description','state'].forEach(k=>u.searchParams.delete(k));u.hash='';history.replaceState(null,'',u.href.replace(/#$/,''))}catch(e){}};
let arrived=null;
{const h=(location.hash||'').slice(1),q=new URLSearchParams(location.search||''),H=new URLSearchParams(h);
  if(H.get('access_token')&&H.get('refresh_token')&&configured()){setSes(H.get('access_token'),H.get('refresh_token'),H.get('expires_in'),H.get('provider_token')?'google':'email');C.ts=null;C.choose=null;C.em=null;keep();try{localStorage.removeItem(KB)}catch(e){}
    tidy();arrived={ok:1};setTimeout(()=>HWEvents.emit('cloud:signed-in',{via:C.ses.via}),0)}
  else if(H.get('error_description')||q.get('error_description')){arrived={err:String(H.get('error_description')||q.get('error_description')).replace(/\+/g,' ')};tidy()}
  else if(q.get('code')&&C.pk&&configured()){const code=q.get('code'),v=C.pk.v;tidy();
    arrived={wait:1};arrived.p=http('/auth/v1/token?grant_type=pkce',{method:'POST',body:{auth_code:code,code_verifier:v},auth:false})
      .then(j=>{begin(j,'google');arrived={ok:1}}).catch(e=>{C.pk=null;keep();arrived={err:authWhy(e)}})}}

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
/** First sign-in MERGE: the backup restore's MERGE INTO CURRENT rules (bkMerge), this device as "current". */
function mergeBoth(local,cloud){const o=clone(local);bkMerge(o,cloud);return HWSchema.sanitize(o,DEF)[0]}

/* ---------- sync ---------- */
let busy=null,again=0,phase='idle',lastErr='',seen=-1,timer=0;
const uid=()=>encodeURIComponent(C.ses.uid);
const ids=s=>new Set(((s&&s.e)||[]).map(x=>String(x.id)));
const loses=(from,to)=>{const t=ids(to);return[...ids(from)].some(i=>!t.has(i))};
const stash=(s,why)=>{try{HWSchema.stash(typeof s==='string'?s:J(s),why)}catch(e){}};
const empty=s=>!(s.e||[]).length&&!(+s.xp>0)&&!Object.keys(s.b||{}).length;
function prep(d){if(!isObj(d)||!Array.isArray(d.e))throw fail('bad','The cloud save could not be read, so nothing was changed on this device.');
  const m=HWSchema.migrate(d);if(m.err)throw fail('newer',m.err+' Nothing was changed on this device or in the cloud.');return HWSchema.sanitize(m.data,DEF)[0]}
function apply(n){const before=st.e.length;st=n;save();HWEvents.hush(()=>render());
  HWEvents.emit('data:imported',{mode:'cloud',added:Math.max(0,st.e.length-before),total:st.e.length})}
function done(ts,s,how){C.ts=ts;C.last=new Date().toISOString();C.choose=null;keep();setBase(s);seen=SV;phase='ok';lastErr='';
  HWEvents.emit('cloud:synced',{how,at:C.last})}
const ROW='/rest/v1/user_data';
async function push(ts,s,remote){
  if(remote&&loses(remote,JSON.parse(s)))stash(remote,'cloud');
  const r=await http(ROW+'?user_id=eq.'+uid()+'&updated_at=eq.'+encodeURIComponent(ts),{method:'PATCH',body:{data:JSON.parse(s)},prefer:'return=representation'});
  return Array.isArray(r)&&r[0]?r[0].updated_at:null} // null: another device wrote first
const read=()=>http(ROW+'?select=data,updated_at&user_id=eq.'+uid()).then(r=>Array.isArray(r)&&r[0]||null);
async function run(){
  for(let i=0;i<3;i++){
    const R=await read(),Ls=J(st);
    if(!R){const r=await http(ROW,{method:'POST',body:{user_id:C.ses.uid,data:st},prefer:'return=representation'}).catch(e=>{if(e.code==='conflict')return null;throw e});
      if(r&&r[0]){done(r[0].updated_at,Ls,'up');return}continue}
    const rem=prep(R.data),Rs=J(rem),B=base();
    if(C.ts==null||B==null){ // no shared history on this device yet
      if(Ls===Rs){done(R.updated_at,Ls,'none');return}
      if(empty(st)){apply(rem);done(R.updated_at,Rs,'down');return}
      if(empty(rem)){const v=await push(R.updated_at,Ls,null);if(v){done(v,Ls,'up');return}continue}
      C.choose={ts:R.updated_at,n:rem.e.length,xp:rem.xp,at:R.updated_at};keep();phase='choose';
      HWEvents.emit('cloud:choose',{});return}
    if(R.updated_at===C.ts){if(Ls===B){phase='ok';C.last=new Date().toISOString();keep();return}
      const v=await push(R.updated_at,Ls,rem);if(v){done(v,Ls,'up');return}continue}
    // the cloud moved on since our last sync
    if(Ls===B){apply(rem);done(R.updated_at,Rs,'down');return}
    const M=merge(JSON.parse(B),st,rem),Ms=J(M);
    if(loses(st,M))stash(Ls,'cloud');
    if(Ms!==Ls)apply(M);
    if(Ms===Rs){done(R.updated_at,Ms,'down');return}
    const v=await push(R.updated_at,Ms,rem);if(v){done(v,Ms,'merge');return}}
  throw fail('busy','Another device kept saving at the same moment.')}
function sync(why){
  if(!configured()||!signed())return Promise.resolve();
  clearTimeout(timer);timer=0;
  if(!online()){phase='offline';paint();return Promise.resolve()}
  if(C.choose&&why!=='chosen')return Promise.resolve();
  if(busy){again=1;return busy}
  phase='sync';paint();
  busy=run().catch(e=>{phase='error';lastErr=e.code==='net'?'net':e.message;
      if(e.code==='auth'&&!signed()){phase='idle';lastErr=e.message;HWEvents.emit('cloud:signed-out',{why:'expired'})}
      HWEvents.emit('cloud:error',{code:e.code||'error'});if(why==='user')toast(ICO('warning')+esc(msg()))})
    .finally(()=>{busy=null;paint();if(again||(phase==='ok'&&J(st)!==base())){again=0;later(1500,1)}}); // e.g. awards made by the render after a pull
  return busy}
/** Sync after `ms` (one write for a burst of changes). */
function later(ms,force){if(!signed())return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;if(force||SV!==seen||C.ts==null){seen=SV;if(J(st)!==base()||C.ts==null)sync('auto')}},ms);paint()}

/* ---------- the user's choice on a first sign-in ---------- */
async function choose(how){const c=C.choose;if(!c||busy)return;phase='sync';paint();let gone=0;
  busy=(async()=>{const R=await read();
    if(!R){C.choose=null;keep();gone=1;return} // the cloud save was deleted meanwhile: this device's data is uploaded
    const rem=prep(R.data),Rs=J(rem),Ls=J(st);
    if(how==='cloud'){stash(Ls,'cloud');apply(rem);done(R.updated_at,Rs,'down');toast(ICO('cloud')+'Cloud data loaded. This device\'s previous data was kept as a backup copy.');return}
    const out=how==='merge'?mergeBoth(st,rem):clone(st),Os=J(out);
    stash(rem,'cloud'); // the cloud copy is replaced: keep it on this device first
    if(how==='merge'&&Os!==Ls)apply(out);
    const v=await push(R.updated_at,Os,null);if(!v)throw fail('busy','The cloud data changed meanwhile. Please choose again.');
    done(v,Os,how==='merge'?'merge':'up');toast(how==='merge'?ICO('cloud')+'Both merged and synced.':ICO('cloud')+'This device\'s data is now in the cloud. The old cloud copy was kept on this device as a backup.')})()
  .catch(e=>{phase='error';lastErr=e.code==='net'?'net':e.message;HWEvents.emit('cloud:error',{code:e.code||'error'})}).finally(()=>{busy=null;paint();if(gone)sync('chosen')})}

/* ---------- triggers ---------- */
HWEvents.on('*',e=>{if(/^(cloud|medius|page|motion|title|insight|network|live|runboard|board):/.test(e.type))return;if(e.type==='data:reset'||(e.type==='data:imported'&&e.mode==='cloud'))return;later(WAIT)});
HWEvents.on('app:ready',()=>{sync('open');if(arrived&&arrived.err)toast(ICO('warning')+esc(arrived.err))});
HWEvents.on('data:reset',()=>{if(signed()){signOut('reset');toast(ICO('cloud')+'Signed out on this device. Your cloud data was not erased.')}});
HWEvents.on('data:imported',e=>{if(e.mode==='replace'&&signed()){C.ts=null;keep();try{localStorage.removeItem(KB)}catch(_){}}});
HWEvents.on('cloud:signed-in',()=>{phase='idle';sync('user')});
addEventListener('online',()=>sync('online'));addEventListener('offline',()=>{if(signed()){phase='offline';paint()}});
D.addEventListener('visibilitychange',()=>{if(!signed())return;if(D.visibilityState==='visible'){if(!C.last||Date.now()-Date.parse(C.last)>60e3)sync('focus')}else if(J(st)!==base())sync('hide')});
setInterval(()=>{if(signed()&&D.visibilityState!=='hidden'&&(!C.last||Date.now()-Date.parse(C.last)>300e3))sync('poll')},30e3);
try{HWMedius.rules.cloud={p:40,cd:1800e3,line:()=>'A messenger rode in from thine other device. The chronicle is whole again.'}}catch(e){}

/* ---------- status for the ACCOUNT card ---------- */
const hm=t=>{const d=new Date(t);return isNaN(d)?'':String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
function msg(){return lastErr==='net'?'Could not reach the cloud. Your logs are saved on this device and will sync when the connection works.'
  :/relation|table|schema cache|function/i.test(lastErr)?'The cloud project is not set up yet (the user_data table is missing). Run the setup SQL from supabase/migrations in the Supabase project.':lastErr}
/** One line for the ACCOUNT card: "Synced at 14:32", "Offline: will sync later", … */
function line(){const dirty=signed()&&J(st)!==base();
  if(phase==='sync')return'Syncing…';
  if(C.choose)return'Waiting for your choice below.';
  if(!online())return dirty||C.ts==null?'Offline: will sync later':'Offline. Last synced at '+hm(C.last)+'.';
  if(phase==='error')return msg()+(C.last?' Last synced at '+hm(C.last)+'.':'')+' Nothing on this device was lost.';
  if(dirty&&C.ts!=null)return'Changes will sync in a moment.';
  return C.last?'Synced at '+hm(C.last):'Not synced yet.'}
let painter=()=>{};
const paint=()=>{try{painter()}catch(e){console.error('[HWCloud]',e)}};

// for js/v6-account.js, js/v6-board.js, js/v6-running.js, js/v6-runboard.js, js/v6-counsel.js: signed-in requests to the
// same project (errors carry .code like http(), and .status / .body)
const api=(path,o)=>http(path,o),who=()=>signed()?C.ses.uid:null;
return{sync,merge,mergeBoth,checkProject,api,who,sendLink,verifyCode,google,settings,signOut,deleteAccount,choose,line,authWhy,
  set painter(f){painter=f},get arrived(){return arrived},get pending(){return C.em||null},
  account:()=>signed()?{uid:C.ses.uid,email:C.ses.email||'',via:C.ses.via||'email'}:null,
  choice:()=>C.choose?Object.assign({},C.choose):null,
  status:()=>({configured:configured(),signed:signed(),phase,ts:C.ts==null?null:C.ts,last:C.last||null,choose:!!C.choose,error:lastErr,pending:signed()&&J(st)!==base(),waiting:!!timer})}})();
