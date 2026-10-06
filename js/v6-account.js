/* v6: the optional account's screens. Not part of the original. The engine (sign-in, sync, merge) is js/v6-cloud.js.
   * Settings → ACCOUNT (#v6acct): sign-in status, the sync line ("Synced at 14:32", "Offline: will sync later"),
     SIGN IN / SIGN OUT, SYNC NOW, the first-sign-in choice, and DELETE ACCOUNT & CLOUD DATA (two taps).
   * The sign-in sheet (the shared #mo dialog), always in this order:
       1. WHAT HAPPENS WHEN YOU SIGN IN: plain language (backup and sync, the running leaderboard, Medius AI, private
          health data, nothing needed to use the app, how to delete everything); under 18 also "Ask a parent or
          guardian…" (age from the profile).
       2. CONTINUE WITH GOOGLE (shown when the project has Google switched on) or an email address.
       3. CHECK YOUR EMAIL: open the link on this device, or type the 6-digit code from the same email.
   * First sign-in with data here and in the cloud: KEEP THIS DEVICE'S DATA / KEEP CLOUD DATA / MERGE, as a dialog and
     in the ACCOUNT card until chosen.
   * Onboarding: when the Traveller's Registry is sealed, Medius offers a free account once (CREATE A FREE ACCOUNT /
     SKIP); SKIP or closing the sheet carries on into the kingdom as before.
   Icons are pixel art (HWPixel), never emoji. Nothing here talks to the network until the user asks to sign in. */
const HWAccount=(()=>{
const D=document,C=HWCloud,ico=(n,o)=>HWPixel.icon(n,o||1);
const online=()=>navigator.onLine!==false;
let A=null;           // the open sheet: {step:'why'|'how'|'mail'|'choose', email, err, busy, then}
let G=null;           // Google switched on in the project? (asked once, when the sheet first needs it)
let arm=0,note='';

/* ---------- the sheet ---------- */
const minor=()=>{const a=+((st.p||{}).age);return a>0&&a<18};
const WHY=[['cloud','Your data is backed up to the cloud and syncs across your devices.'],
  ['running','You can join the running leaderboard (nickname only, as before).'],
  ['wizard','You can talk to Medius AI in the Wizard\'s Counsel.'],
  ['lock','Health data stays private to your account; nobody else (including other students) can see it.'],
  ['device','Without an account, everything still works on this device only.'],
  ['bin','How to delete everything: Settings → Account → DELETE ACCOUNT &amp; CLOUD DATA removes your account and everything stored with it in the cloud, at once. This device keeps its own copy until you reset it.']];
function sheet(){const s=A,err=s.err?'<p class="warn" role="alert">'+s.err+'</p>':'';let h='';
  if(s.step==='why')h='<h3 id="v6ach">'+ico('account')+' WHAT HAPPENS WHEN YOU SIGN IN</h3><ul class="v6acl">'+WHY.map(x=>'<li>'+ico(x[0])+'<span>'+x[1]+'</span></li>').join('')+'</ul>'
    +(minor()?'<p class="v6acm">'+ico('warning')+'<span>Ask a parent or guardian if you\'re unsure about creating an account.</span></p>':'')
    +'<div class="row"><button data-a="acgo">CONTINUE</button><button class="g" data-a="acx">NOT NOW</button></div>';
  else if(s.step==='how')h='<h3 id="v6ach">'+ico('account')+' SIGN IN</h3><p class="mut">Free, and there is no password to remember.</p>'
    +(G?'<button class="v6acg" data-a="acgoogle"'+(s.busy?' disabled':'')+'>CONTINUE WITH GOOGLE</button><p class="v6acor"><span>or with your email</span></p>':'')
    +'<label>Email<input id="acem" type="email" autocomplete="email" inputmode="email" spellcheck="false" maxlength="200" value="'+esc(s.email||'')+'"></label>'
    +'<button data-a="acmail" style="width:100%"'+(s.busy?' disabled':'')+'>'+ico('mail')+' '+(s.busy?'SENDING…':'SEND SIGN-IN EMAIL')+'</button>'
    +'<small class="mut">We email you a sign-in link and a 6-digit code. Use either one.</small>'+err
    +'<div class="row" style="margin-top:8px"><button class="g sm" data-a="acwhy">◀ BACK</button><button class="g sm" data-a="acx">NOT NOW</button></div>';
  else if(s.step==='mail')h='<h3 id="v6ach">'+ico('mail')+' CHECK YOUR EMAIL</h3><p>We sent a sign-in link and a code to <b>'+esc(s.email)+'</b>.</p>'
    +'<p>Open the link on this device, or type the 6-digit code here:</p>'
    +'<label>Code from the email<input id="accode" inputmode="numeric" autocomplete="one-time-code" maxlength="10" spellcheck="false"></label>'
    +'<button data-a="accode" style="width:100%"'+(s.busy?' disabled':'')+'>'+(s.busy?'CHECKING…':'SIGN IN')+'</button>'+err
    +'<div class="row" style="margin-top:8px"><button class="g sm" data-a="acresend"'+(s.busy?' disabled':'')+'>SEND AGAIN</button><button class="g sm" data-a="acother">USE ANOTHER EMAIL</button><button class="g sm" data-a="acx">CLOSE</button></div>'
    +'<small class="mut">Not there? Look in spam or promotions. The link and the code work once and expire after an hour.</small>';
  else if(s.step==='choose'){const c=C.choice()||{},n=st.e.length;
    h='<h3 id="v6ach">'+ico('cloud')+' THIS ACCOUNT ALREADY HAS DATA</h3><p>Choose what to keep. Nothing changes until you choose.</p>'
    +'<div class="v6acs"><b>THIS DEVICE</b><span>'+n+' entr'+(n===1?'y':'ies')+' · '+(+st.xp||0)+' XP</span></div>'
    +'<div class="v6acs"><b>CLOUD</b><span>'+(+c.n||0)+' entr'+(+c.n===1?'y':'ies')+' · '+(+c.xp||0)+' XP'+(c.at?' · saved '+esc(when(c.at)):'')+'</span></div>'
    +'<div class="v6acb"><button data-a="acmerge">MERGE (RECOMMENDED)</button><button class="g" data-a="aclocal">KEEP THIS DEVICE\'S DATA</button><button class="g" data-a="accloud">KEEP CLOUD DATA</button></div>'
    +'<small class="mut">Merge keeps every entry from both, combines badges and keeps the larger XP; this device\'s profile and settings stay. Whichever side is replaced is first kept on this device as a backup copy.</small>'+err}
  return '<div class="card v6ac" role="dialog" aria-modal="true" aria-labelledby="v6ach">'+h+'</div>'}
function show(){const m=$('#mo');if(!A)return;const v=(D.getElementById('acem')||{}).value,c=(D.getElementById('accode')||{}).value;m.innerHTML=sheet();m.hidden=false;
  if(v!=null&&D.getElementById('acem'))D.getElementById('acem').value=v;if(c!=null&&D.getElementById('accode'))D.getElementById('accode').value=c;
  const f=m.querySelector('#accode')||m.querySelector('#acem')||m.querySelector('button');if(f)try{f.focus({preventScroll:true})}catch(e){}}
/** Opens the sign-in sheet at "What happens when you sign in". `then` runs once when it closes (signed in or not). */
function open(then){if(C.who())return C.choice()?choose():(then&&then());A={step:'why',email:(C.pending||{}).email||'',then};show()}
function close(){const t=A&&A.then;A=null;$('#mo').hidden=true;if(t)setTimeout(t,0)}
function choose(){A=Object.assign(A||{},{step:'choose',err:''});show()}
{const o=acts.mclose;acts.mclose=function(){if(A){close();return}return o.apply(this,arguments)}}
D.addEventListener('click',e=>{if(A&&e.target&&e.target.id==='mo')close()});
const when=t=>{const d=new Date(t);return isNaN(d)?'':d.toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})};
const why=e=>esc(C.authWhy(e));

acts.acin=()=>open();
acts.acgo=()=>{A.step='how';A.err='';show();
  if(G==null&&online())C.settings().then(s=>{G=!!(s&&s.external&&s.external.google);if(A&&A.step==='how'&&G)show()}).catch(()=>{G=false})};
acts.acwhy=()=>{A.step='why';A.err='';show()};
acts.acx=()=>close();
acts.acgoogle=async()=>{A.busy=1;A.err='';show();try{await C.google()}catch(e){A.busy=0;A.err=why(e);show()}};
async function mail(again){const em=again?A.email:((D.getElementById('acem')||{}).value||'').trim();A.busy=1;A.err='';show();
  try{await C.sendLink(em);A.email=em;A.step='mail';A.busy=0;show();if(again)toast('Sent again. Use the newest email.')}
  catch(e){A.busy=0;A.err=e.code==='input'?esc(e.message):why(e);show()}}
acts.acmail=()=>mail(0);acts.acresend=()=>mail(1);
acts.acother=()=>{A.step='how';A.err='';show()};
acts.accode=async()=>{const code=(D.getElementById('accode')||{}).value||'';A.busy=1;A.err='';show();
  try{const em=A.email;await C.verifyCode(em,code);toast('Signed in as '+esc(em)+'.');if(!A)return;A.busy=0;if(C.choice())choose();else close()}
  catch(e){if(!A)return;A.busy=0;A.err=e.code==='input'?esc(e.message):why(e);show()}};
D.addEventListener('keydown',e=>{const t=e.target;if(e.key!=='Enter'||!t)return;if(t.id==='acem'){e.preventDefault();acts.acmail()}else if(t.id==='accode'){e.preventDefault();acts.accode()}});
const pick=how=>()=>{C.choose(how);if(A&&A.step==='choose')close();paint()};
acts.acmerge=pick('merge');acts.aclocal=pick('local');acts.accloud=pick('cloud');
HWEvents.on('cloud:choose',()=>{if(!A&&$('#mo').hidden)choose();else if(A)choose();paint()});
HWEvents.on('cloud:signed-in',paint);

/* ---------- Settings → ACCOUNT ---------- */
HWUI.css('account',`
#v6acct h3,.v6ac h3{display:flex;align-items:center;gap:8px}
#v6acct .v6pl{display:flex;gap:8px;align-items:baseline;margin:6px 0}#v6acct .v6pl>.v6pk{flex:0 0 auto;font:7px/1.8 var(--fh);min-width:84px}
#v6acct .row button{flex:1 1 140px}#v6acct .warn{margin:8px 0}
#v6acct .v6acdel{width:100%;margin-top:10px;background:var(--p2);color:var(--ink)}#v6acct .v6acdel.on{background:var(--red);color:#fff}
#v6acct .v6acbox{border:3px solid var(--ln);padding:8px 10px;margin:8px 0;background:var(--bg)}
.v6ac .v6acl{list-style:none;margin:8px 0;padding:0;display:flex;flex-direction:column;gap:8px}.v6ac .v6acl li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:1.45}
.v6ac .v6acl li svg,.v6ac .v6acm svg{flex:0 0 auto;margin-top:1px}
.v6ac .v6acm{display:flex;gap:10px;align-items:flex-start;border:3px solid var(--gold);background:var(--p2);padding:8px;font-size:14px}
.v6ac .row button{flex:1 1 130px}.v6ac button svg{vertical-align:-3px}
.v6ac .v6acg{width:100%;margin:6px 0;background:var(--pn);color:var(--ink)}
.v6ac .v6acor{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--mut);margin:6px 0}.v6ac .v6acor:before,.v6ac .v6acor:after{content:"";flex:1;border-top:2px dashed var(--p2)}
.v6ac .v6acs{display:flex;gap:8px;align-items:baseline;justify-content:space-between;border:3px solid var(--ln);background:var(--p2);padding:8px;margin:6px 0}.v6ac .v6acs b{font:8px/1.6 var(--fh)}
.v6ac .v6acb{display:flex;flex-direction:column;gap:8px;margin:10px 0}.v6ac .v6acb button{width:100%}
.v6aco .card h3{display:flex;align-items:center;gap:8px}
`);
const row=(k,v)=>'<div class="v6pl"><span class="v6pk">'+k+'</span><span>'+v+'</span></div>';
function card(){const a=C.account(),p=C.pending;let h='<div class="card" id="v6acct"><h3>'+ico('account')+' ACCOUNT</h3>';
  if(!a){h+='<p>Not signed in. Everything is saved on this device only.</p>'
      +(p&&Date.now()-p.at<3600e3?'<div class="v6acbox">'+ico('mail')+' We sent a sign-in email to <b>'+esc(p.email)+'</b>. <button class="g sm" data-a="acpend">TYPE THE CODE</button></div>':'')
      +'<button data-a="acin" style="width:100%">SIGN IN</button>'
      +'<small class="mut">Optional and free: back up and sync your kingdom, join the running leaderboard and talk with Medius AI. You will see what happens before anything is sent.</small>'}
  else{h+=row('SIGNED IN',esc(a.email||'your account')+(a.via==='google'?' (Google)':''))
      +'<div role="status" aria-live="polite">'+row('SYNC',esc(C.line()))+'</div>';
    const c=C.choice();if(c)h+='<div class="v6acbox"><b>This account already has data in the cloud.</b><br>Choose what to keep. <button class="sm" data-a="acchoose">CHOOSE</button></div>';
    h+='<div class="row"><button data-a="acsync"'+(C.status().phase==='sync'||c?' disabled':'')+'>SYNC NOW</button><button class="g" data-a="acout">SIGN OUT</button></div>'
      +'<button class="v6acdel'+(arm?' on':'')+'" data-a="acdel">'+ico('bin')+' '+(arm?'TAP AGAIN TO DELETE EVERYTHING':'DELETE ACCOUNT &amp; CLOUD DATA')+'</button>'
      +'<small class="mut">Deletes your account and everything stored with it in the cloud: your synced data, leaderboard entries and Medius message counts. This device keeps its data. Signing out keeps everything.</small>'}
  if(note)h+='<div class="warn" role="alert">'+note+'</div>';
  return h+'<small class="mut" style="display:block;margin-top:6px">Health data goes only to your own private cloud copy, never to a leaderboard or to other people. Wizard\'s Counsel chats are never stored.</small></div>'}
function paint(){const el=D.getElementById('v6acct');if(!el)return;const f=D.activeElement&&el.contains(D.activeElement)&&D.activeElement.dataset.a;el.outerHTML=card();
  if(f){const x=D.querySelector('#v6acct [data-a="'+f+'"]');if(x&&!x.disabled)x.focus()}}
C.painter=paint;
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k='<div class="card" id="v6pwa">';const i=h.indexOf(k)>=0?h.indexOf(k):h.indexOf('<div class="card" id="bkp">');return i>=0?h.slice(0,i)+card()+h.slice(i):h+card()}}
HWEvents.on('page:viewed',()=>{arm=0;note=''});
HWEvents.on('cloud:signed-out',e=>{if(e.why==='expired')note='Your sign-in has expired. Sign in again to keep syncing; your data is safe on this device.';paint()});
['cloud:synced','cloud:error'].forEach(t=>HWEvents.on(t,paint));
acts.acpend=()=>{const p=C.pending;if(!p)return;A={step:'mail',email:p.email};show()};
acts.acchoose=()=>choose();
acts.acsync=()=>C.sync('user');
acts.acout=()=>{C.signOut('user');note='';paint();toast('Signed out. Your data stays on this device.')};
acts.acdel=async()=>{if(!arm){arm=1;return paint()}arm=0;if(!online()){note='You are offline. Nothing was deleted; try again when you are online.';return paint()}
  try{await C.deleteAccount();note='';paint();toast('Your account and its cloud data were deleted. This device still has all its data.')}
  catch(e){note=esc(e.code==='net'?'Could not reach the cloud.':e.message)+' Nothing was deleted.';paint()}};

// back from an email link or Google
HWEvents.on('app:ready',()=>{const a=C.arrived;if(!a)return;
  if(a.p)a.p.then(()=>{const b=C.arrived;if(b&&b.ok)toast('Signed in with Google.');else if(b&&b.err)toast(ico('warning')+' '+esc(b.err))});
  else if(a.ok)setTimeout(()=>toast('Signed in.'),600)});

/* ---------- onboarding: Medius offers a free account once, after the Traveller's Registry ---------- */
const OFFER="One more thing, {name}. Wouldst thou like a free account? It keepeth thy kingdom safe in the cloud, carrieth it to thine other devices, and lets thee speak with me in my study. It is thy choice: everything works on this device without one.";
{const p=pages.onb;pages.onb=(...a)=>{const o=S.ob;if(!o||o.i!==8)return p(...a);const nn=(o.d.name||'').trim()||'traveller',say=OFFER.replace('{name}',nn);
  return '<div class="obw v6aco"><h2>TRAVELLER\'S REGISTRY</h2><div class="obsay"><img src="'+WIZ+'" alt="Wizard King Medius" class="obz"><div class="tbx"><b>WIZARD KING MEDIUS</b><p id="obt" data-t="'+esc(say)+'"></p></div></div>'
    +'<div class="card"><h3>'+ico('account')+' CREATE A FREE ACCOUNT?</h3><ul class="v6acl" style="list-style:none;padding:0;margin:8px 0">'+WHY.slice(0,3).map(x=>'<li style="display:flex;gap:8px;align-items:flex-start;margin:6px 0">'+ico(x[0])+'<span>'+x[1]+'</span></li>').join('')+'</ul>'
    +'<div class="row" style="margin-top:12px"><button data-a="aconb">CREATE A FREE ACCOUNT</button><button class="g" data-a="acskip">SKIP</button></div>'
    +'<small class="mut">You can sign in later from Settings → Account.</small></div></div>'}}
let enter=null;
{const o=acts.obgo;enter=o;acts.obgo=function(){if(S.ob&&S.ob.i===7&&!C.who()&&!st.s.ao&&C.status().configured){st.s.ao=1;save();S.ob.i=8;render();return}return o.apply(this,arguments)}}
acts.acskip=()=>enter();
acts.aconb=()=>open(()=>{if(S.v==='onb')enter()});

return{open,card,choose,get sheet(){return A?A.step:null}}})();
