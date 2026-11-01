/* v6: Spire of Trials, a GPS-verified Stair Sense climb with a personal board for each staircase. Not part of the original.
   Feature 7 of the owner's catalog (plan and decisions: docs/FEATURE_CONSULTS.md and the session notes; one board per staircase, one
   GPS check at the start). A card under Stair Sense in the Observatory's Details.

   WHY NOT TWO GPS LINES: a staircase is a few metres long and GPS is good to 5–25 m, so a fix at the foot and one at the top look the
   same. GPS can only say "you are at staircase X". So GPS gates the START, and the climb is timed and counted by Stair Sense
   (js/v6-gravity.js): its timer (running seconds only) and the phone's step counter.
   Flow: CHECK I AM HERE (one reading, getCurrentPosition, never watchPosition, in memory only) → START TRIAL (a second, separate tap, so the
   motion-sensor permission on iPhones is asked inside a tap) → climb → FINISH and SAVE in Stair Sense.
   GPS gate: accuracy ±25 m or better, and the distance to the staircase within the existing check-in radius (35 m + the accuracy, js/v6-gps.js).
   Weaker readings are refused with the reason, so an indoor refusal does not look like a broken feature. The reading is never saved: only the
   reported accuracy is kept, in m.sp = {v:1, acc}.
   A saved climb is RANKED only when all of these hold (checked in eligible()); otherwise it is a normal climb with the reason shown:
     the trial was started from this card for this climb and staircase · never paused (a pause also happens when the tab is hidden) ·
     the confirmed steps equal the staircase's full surveyed total · the phone sensor counted steps and its count is within 20 % of the
     confirmed number · the time is at least 0.3 s per step.
   Boards are DERIVED from the stair entries that carry m.sp, so there is no new storage key, no schema step, and backup / restore / the
   user's own cloud copy carry them. They are PERSONAL (this device's own history), not a ranking against other people. Per staircase:
   personal best, the last trial against your earlier best, the best five. Overview: your best vertical speed (rise ÷ time) on each
   staircase, where the step height is known; a height taken from the angle or typed is marked as an estimate.
   Not a race, not a prize, no XP. Local times can be faked by the person who owns the device; the checks only keep out garbage.
   Pure functions come first so the tests check worked examples. */
const HWSpire=(()=>{
const ACC_MAX=25,TOL=.2,MIN_SPS=.3,FRESH=5*6e4,TOP=5,D=document,$i=i=>D.getElementById(i);
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x),fin=x=>typeof x==='number'&&isFinite(x);
const f1=(x,d)=>(+x).toLocaleString('en',{maximumFractionDigits:d==null?1:d});
const mmss=s=>{s=Math.round(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

/* ---------- pure ---------- */
/** The surveyed steps of a full climb (all flights added), or null when the flights are not known. */
const totalSteps=q=>{const a=q&&q.steps;return Array.isArray(a)&&a.length&&a.every(x=>Number.isInteger(x)&&x>0)?a.reduce((s,x)=>s+x,0):null};
/** Can a trial be run at this staircase at all? {ok, n (steps of a full climb)} or {ok:false, why}. */
function stairOk(q){
  if(!q)return{ok:false,why:'Pick a staircase on the map first.'};
  if(q.lat==null||q.lng==null)return{ok:false,why:'This stairway has no GPS point yet, so a trial cannot check that you are there.'};
  const n=totalSteps(q);if(!n)return{ok:false,why:'Its steps have not been surveyed, so a full climb cannot be told from part of one.'};
  return{ok:true,n}}
const radiusOf=acc=>typeof HWGps!=='undefined'?HWGps.radius(acc):35+Math.min(Math.max(+acc||0,0),65);
/** The GPS gate. acc = the reported accuracy (m), d = metres from the reading to the staircase. */
function gate(acc,d){
  if(!fin(acc)||acc<0)return{ok:false,why:'The GPS reading came without an accuracy, so it cannot be used.'};
  if(acc>ACC_MAX)return{ok:false,why:'GPS signal too weak (±'+Math.round(acc)+' m). Trial mode needs outdoor line-of-sight with an accuracy of '+ACC_MAX+' m or better. Indoors this is common: log the climb as a normal Stair Sense climb instead.'};
  if(!fin(d)||d<0)return{ok:false,why:'The distance to the staircase could not be worked out.'};
  const R=radiusOf(acc);
  if(d>R)return{ok:false,why:'You seem to be about '+Math.max(10,Math.round(d/10)*10)+' m from this staircase. Stand at it (within about '+Math.round(R)+' m) and check again.'};
  return{ok:true}}
/** gv = the saved climb's m.gv, q = its staircase, T = the armed trial {sid, gid, paused}. {ok} or {ok:false, why}. */
function eligible(gv,q,T){
  if(!T||!gv||gv.gid!==T.gid)return{ok:false,why:'it was not started from the Spire card'};
  if(T.paused)return{ok:false,why:'the climb was paused (or the screen was hidden), so the time is not one unbroken climb'};
  if(!q||q.id!==T.sid)return{ok:false,why:'the staircase was changed after the location check'};
  const N=totalSteps(q);if(!N||gv.n!==N)return{ok:false,why:'the steps ('+gv.n+') are not the full climb of this staircase ('+(N||'unknown')+')'};
  if(!fin(gv.sensor))return{ok:false,why:'the phone sensor was not counting steps'};
  if(Math.abs(gv.sensor-gv.n)>TOL*gv.n)return{ok:false,why:'the sensor counted '+gv.sensor+' steps, more than 20 % away from the '+gv.n+' you confirmed'};
  if(!fin(gv.secs)||gv.secs<10||gv.secs<MIN_SPS*gv.n)return{ok:false,why:'that time is too fast for '+gv.n+' steps (under '+MIN_SPS+' s a step)'};
  return{ok:true}}
/** Ranked trials among stair entries, normalised: [{sid, secs, n, h, src, d, t, acc}]. Anything malformed is skipped, never repaired. */
function trials(list){return(list||[]).filter(e=>e&&e.c==='stair'&&isO(e.m)&&isO(e.m.sp)&&e.m.sp.v===1&&isO(e.m.gv)&&typeof e.m.sid==='string'&&fin(+e.m.gv.secs)&&+e.m.gv.secs>0)
  .map(e=>({sid:e.m.sid,secs:+e.m.gv.secs,n:+e.m.gv.n||null,h:fin(+e.m.gv.h)&&+e.m.gv.h>0?+e.m.gv.h:null,src:e.m.gv.riseSrc||null,d:String(e.d||''),t:String(e.t||''),acc:fin(+e.m.sp.acc)?+e.m.sp.acc:null}))}
const byTime=(a,b)=>a.secs-b.secs||(a.d+a.t).localeCompare(b.d+b.t);
const speed=x=>x.h&&x.secs>0?x.h/x.secs:null;
/** One staircase's board: {all (newest first), best (fastest first, TOP), pb, last, vs (last − best of the earlier ones, s; null with no earlier)}. */
function board(T,sid){const L=T.filter(x=>x.sid===sid);if(!L.length)return null;
  const all=L.slice().sort((a,b)=>(b.d+b.t).localeCompare(a.d+a.t)),last=all[0],earlier=all.slice(1).sort(byTime);
  return{all,best:L.slice().sort(byTime).slice(0,TOP),pb:L.slice().sort(byTime)[0],last,vs:earlier.length?last.secs-earlier[0].secs:null,n:L.length}}
/** Your best vertical speed (rise ÷ time) on each staircase that has one, fastest first: [{sid, v, secs, est}]. */
function overview(T){const by={};T.forEach(x=>{const v=speed(x);if(v==null)return;const o=by[x.sid];if(!o||v>o.v)by[x.sid]={sid:x.sid,v,secs:x.secs,est:x.src!=='study'}});
  return Object.values(by).sort((a,b)=>b.v-a.v||a.sid.localeCompare(b.sid))}

/* ---------- state (memory only) ---------- */
let S={k:'idle'},gen=0;      // k: idle · explain · locating · refused · ok · armed
const stair=()=>STAIRS.find(s=>s.id===HWStairs.pick)||null;
const trialsNow=()=>trials(LC('stair'));
/** Called by Stair Sense when it saves a climb (js/v6-gravity.js gvsave): the m.sp marker for a ranked trial, else null. */
function mark(gv,q){
  if(S.k!=='armed'||!gv||gv.gid!==S.gid)return null;
  const r=eligible(gv,q,S),prev=q?board(trialsNow(),q.id):null,acc=Math.round(S.acc||0);
  S={k:'idle',last:{ok:r.ok,why:r.why||'',secs:gv.secs,name:q?q.name:'',pb:r.ok&&(!prev||gv.secs<prev.pb.secs)}};
  return r.ok?{v:1,acc}:null}

/* ---------- the card ---------- */
const esc2=x=>esc(String(x));
function boardHtml(q){
  const T=trialsNow(),b=q?board(T,q.id):null;
  if(!q)return'';
  if(!b)return'<p class="mut spb">No ranked trials at '+esc2(q.name)+' yet.</p>';
  const ds=b.vs==null?'':b.vs===0?' (the same as your earlier best)':' ('+mmss(Math.abs(b.vs))+(b.vs<0?' faster':' slower')+' than your earlier best)';
  return'<div class="spb"><h4>YOUR BOARD · '+esc2(q.name)+'</h4><p>Personal best <b>'+mmss(b.pb.secs)+'</b> ('+esc2(b.pb.d)+'). Last trial '+mmss(b.last.secs)+ds+'. '+b.n+' trial'+(b.n===1?'':'s')+'.</p>'
    +'<ol class="spl">'+b.best.map(x=>'<li><b>'+mmss(x.secs)+'</b> · '+esc2(x.d)+(speed(x)!=null?' · '+f1(speed(x),2)+' m/s'+(x.src!=='study'?' (est.)':''):'')+'</li>').join('')+'</ol></div>'}
function overviewHtml(){
  const O=overview(trialsNow());if(!O.length)return'';
  return'<details class="spo"><summary>All staircases: your best vertical speed</summary><ol class="spl">'+O.slice(0,12).map(o=>{const q=STAIRS.find(s=>s.id===o.sid);
    return'<li><b>'+f1(o.v,2)+' m/s</b>'+(o.est?' (est.)':'')+' · '+esc2(q?q.name:o.sid)+' · '+mmss(o.secs)+'</li>'}).join('')+'</ol>'
    +'<small class="mut">Vertical speed = height climbed ÷ time. (est.) means the step height came from the staircase’s angle or was typed, not measured.</small></details>'}
function stateHtml(q,ok){
  if(S.k==='armed'&&HWGravity.gid!==S.gid)S={k:'idle',last:S.last};          // the climb was discarded or a new one began
  if(S.k==='ok'&&(!q||q.id!==S.sid||Date.now()-S.at>FRESH))S={k:'idle',last:S.last};
  const chk='<button type="button" class="g" data-a="spcheck">CHECK I AM HERE</button>';
  if(S.k==='explain')return'<p>Trial mode reads your location <b>once</b>, only to check that you are at this staircase. The reading is never saved or sent; only its accuracy is kept with the trial.</p><div class="gvbtns"><button type="button" data-a="spallow">ALLOW ONE READING</button><button type="button" class="g" data-a="spcancel">NOT NOW</button></div>';
  if(S.k==='locating')return'<p role="status">Reading your location once…</p><button type="button" class="g sm" data-a="spcancel">CANCEL</button>';
  if(S.k==='refused')return'<p class="warn" role="alert">'+esc2(S.msg)+'</p>'+chk;
  if(S.k==='ok')return'<p role="status"><b>Location checked:</b> you are at '+esc2(q.name)+' (accuracy ±'+S.acc+' m). Valid for 5 minutes.</p>'
    +'<button type="button" class="gvgo" data-a="spstart"'+(HWGravity.state==='idle'?'':' disabled')+'>START TRIAL</button>'+(HWGravity.state==='idle'?'':'<p class="mut">Finish or discard the current Stair Sense climb first.</p>');
  if(S.k==='armed')return'<p role="status"><b>Trial running.</b> Climb all '+S.n+' steps without pausing, then press FINISH in Stair Sense above and save.'+(S.paused?' <b>You paused, so this climb will not be ranked.</b>':'')+'</p>';
  return ok.ok?'<p class="mut">A full climb here is '+ok.n+' steps. Stand at the foot of the staircase, then check.</p>'+chk:'<p class="mut" role="status">'+esc2(ok.why)+'</p>'}
function lastHtml(){const l=S.last;if(!l)return'';
  return l.ok?'<p class="spres" role="status"><b>Ranked trial saved: '+mmss(l.secs)+'</b> at '+esc2(l.name)+(l.pb?' · a new personal best':'')+'.</p>'
    :'<p class="spres" role="status"><b>Saved as a normal Stair Sense climb, not ranked:</b> '+esc2(l.why)+'.</p>'}
function card(){
  const q=stair(),ok=stairOk(q);
  return'<div class="card stcard sp" id="sptrial"><h3>'+HWPixel.icon('stairs',1)+' SPIRE OF TRIALS</h3><span class="pxtag gvtag">PERSONAL BOARD · THIS DEVICE</span>'
    +'<p class="mut">A trial is a Stair Sense climb at a staircase you are really standing at. Your times and board stay on this device; it is not a ranking against other people, and not a race.</p>'
    +(q?'<p class="gvloc"><span>Staircase</span> <b>'+esc2(q.name)+'</b> · '+esc2(q.id)+'</p>':'')+stateHtml(q,ok)+lastHtml()+boardHtml(q)+overviewHtml()
    +'<p class="gvsafe mut">Hold the handrail and climb at a comfortable pace. Slower is fine. Stop if you feel dizzy or unwell.</p></div>'}
const paint=()=>{const c=$i('sptrial');if(c)c.outerHTML=card()};

/* ---------- actions ---------- */
const ERR={1:'Location permission is off. Allow it in the browser’s site settings, or log the climb as a normal Stair Sense climb.',
  2:'Your device could not work out where you are (no GPS fix). Try outdoors.',3:'No GPS reading arrived in time. Weak signal indoors is common: try outdoors.'};
function locate(q){
  const G=typeof navigator!=='undefined'&&navigator.geolocation,fail=m=>{S={k:'refused',msg:m,last:S.last};paint()};
  if(!G)return fail('This browser cannot share a location, so a trial cannot be checked. Log the climb as a normal Stair Sense climb.');
  if(typeof isSecureContext!=='undefined'&&!isSecureContext)return fail('Browsers only share location on https:// pages. Open HealthWiz from its https address.');
  const my=++gen;S={k:'locating',last:null};paint();
  try{G.getCurrentPosition(p=>{if(my!==gen)return;const c=p.coords,lat=+c.latitude,lng=+c.longitude,acc=+c.accuracy;
      if(![lat,lng].every(isFinite)||Math.abs(lat)>90||Math.abs(lng)>180)return fail('The GPS reading did not look valid. Try again.');
      const g=gate(acc,HWGps.dist(lat,lng,q.lat,q.lng));
      if(!g.ok)return fail(g.why);
      S={k:'ok',sid:q.id,acc:Math.round(acc),at:Date.now()};paint()},          // the position itself is dropped here: only the accuracy lives on
    e=>{if(my!==gen)return;fail(ERR[e&&e.code]||ERR[2])},{enableHighAccuracy:true,timeout:20000,maximumAge:0})}
  catch(e){fail('The browser refused the location request ('+(e&&e.message)+').')}}
acts.spcheck=()=>{const q=stair(),ok=stairOk(q);if(!ok.ok){toast(ok.why);return}
  if(!(isO(st.gp)&&st.gp.ok)){S={k:'explain',last:null};paint();return}
  locate(q)};
acts.spallow=()=>{if(!isO(st.gp))st.gp={ok:0,v:{}};if(!isO(st.gp.v))st.gp.v={};st.gp.ok=1;save();const q=stair();if(q&&stairOk(q).ok)locate(q);else{S={k:'idle'};paint()}};
acts.spcancel=()=>{gen++;S={k:'idle'};paint()};
acts.spstart=()=>{const q=stair();
  if(S.k!=='ok'||!q||q.id!==S.sid||Date.now()-S.at>FRESH){S={k:'idle'};paint();toast('The location check is out of date. Check again.');return}
  if(HWGravity.state!=='idle'){toast('Finish or discard the current Stair Sense climb first.');return}
  const acc=S.acc,n=totalSteps(q);acts.gvci({id:q.id});
  Promise.resolve(acts.gvstart()).then(()=>{          // gvstart asks for the motion sensor first, inside this tap
    if(HWGravity.state==='running'){S={k:'armed',sid:q.id,acc,n,gid:HWGravity.gid,paused:0};paint()}
    else{S={k:'idle'};paint();toast('Stair Sense could not start, so no trial was begun.')}})};
{const p=acts.gvpause;acts.gvpause=function(){if(S.k==='armed'&&HWGravity.state==='running')S.paused=1;return p.apply(this,arguments)}}
HWEvents.on('data:reset',()=>{gen++;S={k:'idle'}});HWEvents.on('data:imported',()=>{gen++;S={k:'idle'}});
HWEvents.on('page:viewed',e=>{if(e.view!=='campus'&&S.k==='locating'){gen++;S={k:'idle'}}});

// under Stair Sense in the Observatory's Details (the wrapper order: forms, Stair Sense, then this card)
{const p=HWStairs.logPanel;HWStairs.logPanel=function(){return p.apply(this,arguments)+card()}}
HWUI.css('spire','.sp h4{margin:10px 0 4px}.sp .spl{margin:4px 0;padding-left:20px}.sp .spl li{margin:3px 0}.sp .spres{border:3px solid var(--blue);background:var(--p2);padding:6px 8px;margin:8px 0}.sp .warn{margin:8px 0}.sp .spo{margin-top:8px}.sp .spo summary{cursor:pointer;min-height:44px}');
return{ACC_MAX,TOL,MIN_SPS,FRESH,totalSteps,stairOk,gate,eligible,trials,board,overview,mark,mmss,card,get state(){return S.k}}})();
