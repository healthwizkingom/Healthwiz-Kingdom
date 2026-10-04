/* v6: GPS running tracker, Strava style. Not part of the original.
   Shown as the RUNNING ROAD section at the bottom of the Stairs page (js/v6-stairs.js); the old 'run' route opens it.
   Flow: why location is needed (asked once) → START RUN → navigator.geolocation.watchPosition (high accuracy) →
   every good fix adds its Haversine distance (HWGps.dist, js/v6-gps.js) and extends the route line on the map →
   PAUSE / RESUME → FINISH RUN saves the workout. Leaving the page does not stop a run: it records until FINISH.
   Metrics: distance (km), moving time (pauses excluded; worked out from timestamps, so a throttled timer loses
   nothing) and average pace (moving time ÷ distance, min/km).
   GPS filter: fixes worse than ±MAXACC m are not counted. A step shorter than the noise floor (MINSTEP m, or half the
   reported accuracy) waits for more movement, so standing still adds nothing. A step faster than MAXSPD m/s is a GPS
   jump and is dropped. After a pause the line starts a new segment and the gap is not counted.
   Map: Leaflet 1.9.4 + OpenStreetMap tiles, loaded from unpkg (pinned version + SRI) only when this page opens; a
   Leaflet already on the page is used as is. Offline or blocked, the route is drawn as a plain trace instead.
   Tracking itself never needs the internet.
   Saving: every run is kept on this device first, in `healthwiz_runs` (outside the `healthwiz` save, so the save
   schema, backups and cloud merge are unchanged). Signed in to Cloud Save (js/v6-cloud.js), each run is inserted
   into `hw_runs` (supabase/migrations/20261005000000_hw_runs.sql; Row Level Security: own rows only) with the same
   session and publishable key. The run id is made on the device, so a retried upload is never stored twice (409 =
   already there). Unsent runs retry on app open, back online, after every cloud sync and on this page. A run in the
   cloud keeps only its summary here. DELETE removes a run from this device and from the cloud.
   The run being recorded is also kept in `healthwiz_run_live`, so after a reload or a closed tab it comes back paused.
   Privacy (§46, §79): location is read only while a run is recording; the route goes nowhere except this device and
   the user's own private cloud save. Reset on this device clears the runs on this device. */
const HWRun=(()=>{
const K='healthwiz_runs',KL='healthwiz_run_live',MAXACC=35,MINSTEP=5,MAXSPD=12,MINRUN=10,KEEP=30,SHOW=10;
const LF='https://unpkg.com/leaflet@1.9.4/dist/leaflet.',SRI={js:'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',css:'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='};
const TILES='https://tile.openstreetmap.org/{z}/{x}/{y}.png',ATTR='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const HOME=[5.3515,100.5385],LINE='#e8590c'; // Kolej MARA Kulim: the map's view until the first fix
const D=document,N=navigator;
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const rd=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const online=()=>N.onLine!==false;
const geo=()=>typeof navigator!=='undefined'&&navigator.geolocation;

/* ---------- pure helpers (tests call these through HWRun) ---------- */
const dist=HWGps.dist; // metres between two lat/lng points (Haversine)
/** What to do with a fix {lat,lng,acc,t (ms)} given the last counted point: {k:'weak'|'first'|'still'|'jump'|'ok', d (m)}. */
function judge(last,f){if(!(f.acc<=MAXACC))return{k:'weak',d:0};if(!last)return{k:'first',d:0};
  const d=dist(last.lat,last.lng,f.lat,f.lng),dt=(f.t-last.t)/1000;
  if(d<Math.max(MINSTEP,f.acc/2))return{k:'still',d};
  if(!(dt>0)||d/dt>MAXSPD)return{k:'jump',d};
  return{k:'ok',d}}
const pace=(m,s)=>m>=MINRUN&&s>0?Math.round(s/(m/1000)):null; // seconds per km
const two=n=>(n<10?'0':'')+n;
function clock(s){s=Math.max(0,Math.floor(s));const h=Math.floor(s/3600),m=Math.floor(s/60)%60,x=s%60;return(h?h+':'+two(m):m)+':'+two(x)}
function fmtPace(p){if(p==null||!(p>0)||p>=6000)return'--:--';p=Math.round(p);return Math.floor(p/60)+':'+two(p%60)}
const km=m=>(Math.max(0,m)/1000).toFixed(2);
const r6=x=>Math.round(x*1e6)/1e6;
function uuid(){const c=typeof crypto!=='undefined'?crypto:null;if(c&&typeof c.randomUUID==='function')return c.randomUUID();
  const b=new Uint8Array(16);if(c&&c.getRandomValues)c.getRandomValues(b);else for(let i=0;i<16;i++)b[i]=Math.random()*256|0;
  b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=Array.prototype.map.call(b,x=>(x<16?'0':'')+x.toString(16)).join('');
  return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}

/* ---------- runs on this device ---------- */
// DB = {ok: location explained & allowed (0/1), runs: [{id, start, end (ISO), dist (m), dur (s), pace (s/km|null), route: [[[lat,lng,t (s)]…]…]|null, up: 0|1, bad?: 1}], del: [cloud ids to delete]}
let DB=(()=>{const o=rd(K);return isO(o)&&Array.isArray(o.runs)?{ok:o.ok?1:0,runs:o.runs.filter(x=>isO(x)&&typeof x.id==='string'),del:Array.isArray(o.del)?o.del.filter(x=>typeof x==='string'):[]}:{ok:0,runs:[],del:[]}})();
DB.runs.forEach(x=>{delete x.bad}); // a run the cloud refused is tried again once per app start (e.g. after the table is fixed)
const put=()=>{try{localStorage.setItem(K,JSON.stringify(DB));return true}catch(e){return false}};
// storage full: forget the oldest runs that are already safe in the cloud, one by one
function keep(){if(put())return true;for(let i=DB.runs.findIndex(x=>x.up);i>=0;i=DB.runs.findIndex(x=>x.up)){DB.runs.splice(i,1);if(put())return true}return false}
// newest KEEP runs only; runs not in the cloud yet are never dropped, but older ones keep only their summary
function trim(){let n=DB.runs.length-KEEP;for(let i=0;i<DB.runs.length&&n>0;)if(DB.runs[i].up){DB.runs.splice(i,1);n--}else i++;
  const L=DB.runs.filter(x=>!x.up);L.slice(0,Math.max(0,L.length-KEEP)).forEach(x=>{x.route=[]})}

/* ---------- the run being recorded ---------- */
// R = {id, start (ms), segs: [[[lat,lng,t]…]…], dist (m), moving (ms), since (ms while running, null when paused), paused (ms), last: counted fix | null, rec: 1 after a reload}
let R=null,U={k:'idle'},W=null,sig=null,arm='',lastLive=0,ch=''; // ch: the GPS chip as last drawn
function live(){try{if(R)localStorage.setItem(KL,JSON.stringify(Object.assign({},R,{at:Date.now()})));else localStorage.removeItem(KL)}catch(e){}lastLive=Date.now()}
{const o=rd(KL);if(isO(o)&&typeof o.id==='string'&&Array.isArray(o.segs)&&+o.start>0){
  const at=+o.at||Date.now(),since=+o.since||0;
  R={id:o.id,start:+o.start,segs:o.segs.filter(Array.isArray),dist:+o.dist||0,moving:(+o.moving||0)+(since?Math.max(0,at-since):0),since:null,paused:since?at:+o.paused||at,last:null,rec:1};
  if(!R.segs.length)R.segs=[[]]}}
const secs=()=>R?(R.moving+(R.since!=null?Date.now()-R.since:0))/1000:0;
const recorded=()=>!!R&&R.segs.some(s=>s.length);

function onFix(p){if(!R)return;const c=(p&&p.coords)||{},f={lat:+c.latitude,lng:+c.longitude,acc:+c.accuracy,t:Date.now()};
  if(!isFinite(f.lat)||!isFinite(f.lng)||Math.abs(f.lat)>90||Math.abs(f.lng)>180)return;
  if(!(f.acc>=0))f.acc=MAXACC+1;
  sig={acc:f.acc,lost:0};
  if(R.since!=null){const j=judge(R.last,f);
    if(j.k==='ok'||j.k==='first'){R.segs[R.segs.length-1].push([r6(f.lat),r6(f.lng),Math.round((f.t-R.start)/1000)]);R.dist+=j.d;R.last=f;redraw();if(Date.now()-lastLive>5000)live()}}
  show()}
const ERR={1:['Location permission is off','Your browser is not sharing your location with HealthWiz, so a run cannot be measured. You can allow it in the browser\'s site settings.'],
  2:['Position unavailable','Your device could not work out where you are (no GPS fix). Try again outdoors, with a clear view of the sky.'],
  3:['That took too long','No GPS reading arrived in time. Step outside, away from tall buildings, and try again.']};
function onErr(e){const c=e&&e.code;
  if(c===1){unwatch();sig=null;if(recorded())pauseRun();else drop();U={k:'idle',err:ERR[1]};paint();return}
  sig={acc:null,lost:1};show()} // timeouts while running: the watch keeps trying
function watch(){if(W!=null)return true;const G=geo();
  if(!G){U={k:'idle',err:['Location is not available','This browser cannot share a location, so it cannot measure a run.']};return false}
  if(typeof isSecureContext!=='undefined'&&!isSecureContext){U={k:'idle',err:['Location needs a secure page','Browsers only share location on https:// pages. Open HealthWiz from its https address.']};return false}
  try{W=G.watchPosition(onFix,onErr,{enableHighAccuracy:true,maximumAge:0,timeout:20000});return true}
  catch(e){U={k:'idle',err:['Location failed','The browser refused the request ('+(e&&e.message)+').']};return false}}
function unwatch(){if(W!=null){try{geo().clearWatch(W)}catch(e){}W=null}}
// keep the screen on while running: phones stop GPS for web pages when the screen locks (Wake Lock API, where supported)
let WL=null;
function wake(on){const w=N.wakeLock;if(on){if(WL||!w||D.visibilityState==='hidden')return;w.request('screen').then(l=>{WL=l;l.addEventListener('release',()=>{if(WL===l)WL=null})}).catch(()=>{})}
  else if(WL){const l=WL;WL=null;l.release().catch(()=>{})}}

function start(){if(R)return;U={k:'idle'};R={id:uuid(),start:Date.now(),segs:[[]],dist:0,moving:0,since:Date.now(),paused:0,last:null};sig=null;
  if(!watch()){R=null;paint();return}wake(1);live();paint();want=1;lazy();redraw()}
function pauseRun(){if(!R||R.since==null)return;const t=Date.now();R.moving+=t-R.since;R.since=null;R.paused=t;wake(0);live()}
function resume(){if(!R||R.since!=null)return;U={k:'idle'};if(!watch()){paint();return}
  if(R.segs[R.segs.length-1].length)R.segs.push([]);R.last=null;R.since=Date.now();delete R.rec;wake(1);live()}
function drop(){R=null;unwatch();wake(0);sig=null;live()}
function finish(){if(!R)return;pauseRun();const r=R;drop();arm='';const m=Math.round(r.dist),dur=Math.round(r.moving/1000);
  if(m<MINRUN){U={k:'idle',err:['Nothing to save','Less than '+MINRUN+' m was recorded, so this run was not saved. Wait for a good GPS signal (outdoors, away from tall buildings) before you start.']};paint();redraw();return}
  const run={id:r.id,start:new Date(r.start).toISOString(),end:new Date(r.paused||Date.now()).toISOString(),dist:m,dur,pace:pace(m,dur),route:r.segs.filter(s=>s.length),up:0};
  DB.runs.push(run);trim();const ok=keep();
  U={k:'done',run:Object.assign({},run)}; // the summary keeps its route in memory, even after the upload drops it here
  paint();paintRuns();redraw();
  toast(ok?'🏁 Run saved: '+km(m)+' km in '+clock(dur)+'.':'⚠️ This device is out of storage space, so the run could not be kept here.'+(cloud()?' It will still be sent to your cloud save.':''));
  sync()}

/* ---------- cloud (hw_runs) ---------- */
const cloud=()=>typeof HWCloud!=='undefined'&&!!HWCloud.who();
let busy=null,cerr='';
const row=r=>({id:r.id,started_at:r.start,finished_at:r.end,distance_m:r.dist,duration_s:r.dur,pace_s_per_km:r.pace,route:r.route||[]});
function sync(){if(busy)return busy;
  if(!cloud()||!online()||!(DB.del.length||DB.runs.some(x=>!x.up&&!x.bad)))return Promise.resolve();
  let ok=0;
  busy=(async()=>{
    while(DB.del.length){await HWCloud.api('/rest/v1/hw_runs?id=eq.'+encodeURIComponent(DB.del[0]),{method:'DELETE'});DB.del.shift();keep()}
    for(const r of DB.runs.slice()){if(r.up||r.bad)continue;
      try{await HWCloud.api('/rest/v1/hw_runs',{method:'POST',body:row(r),prefer:'return=minimal'})}
      catch(e){if(e.code==='size'||e.status===400||e.status===413||e.status===422){r.bad=1;keep();continue} // refused by the database: keep it here, don't block the others
        if(e.code!=='conflict')throw e} // 409: this id is already in the cloud
      r.up=1;r.route=null;keep()}
    ok=1;cerr=''})()
  .catch(e=>{cerr=e.code==='net'?'net':e.code==='setup'?'setup':e.code==='auth'?'auth':String(e.message||'error')})
  .then(()=>{busy=null;paintRuns();if(ok&&(DB.del.length||DB.runs.some(x=>!x.up&&!x.bad)))setTimeout(sync,0)}); // changed while sending
  return busy}

/* ---------- map ---------- */
const M={el:null,map:null,line:null,dot:null,st:'load',follow:1};
let Lp=null;
function leaflet(){if(typeof L!=='undefined'&&L&&typeof L.map==='function')return Promise.resolve(L);
  if(!online())return Promise.reject(new Error('offline'));
  return Lp=Lp||new Promise((ok,no)=>{
    if(!D.querySelector('link[data-v6run]')){const c=D.createElement('link');c.rel='stylesheet';c.href=LF+'css';c.integrity=SRI.css;c.crossOrigin='anonymous';c.dataset.v6run='1';D.head.appendChild(c)}
    const s=D.createElement('script'),t=setTimeout(()=>no(new Error('timeout')),15000);
    s.src=LF+'js';s.integrity=SRI.js;s.crossOrigin='anonymous';s.async=true;
    s.onload=()=>{clearTimeout(t);if(typeof L!=='undefined'&&L&&typeof L.map==='function')ok(L);else no(new Error('no Leaflet'))};
    s.onerror=()=>{clearTimeout(t);no(new Error('blocked'))};D.head.appendChild(s)}).catch(e=>{Lp=null;throw e})}
const shown=()=>(R?R.segs:U.k==='done'&&U.run.route?U.run.route:[]).filter(s=>s.length);
const lls=()=>shown().map(s=>s.map(p=>[p[0],p[1]]));
function lastPt(){const S2=shown(),s=S2[S2.length-1];return s?s[s.length-1]:null}
function mount(){const el=D.getElementById('map');if(!el||el===M.el)return;unmount();M.el=el;M.st='load';M.follow=1;trace();
  leaflet().then(Lf=>{if(M.el!==el||!el.isConnected)return;el.innerHTML='';
      const m=M.map=Lf.map(el,{zoomControl:true});Lf.tileLayer(TILES,{maxZoom:19,attribution:ATTR}).addTo(m);
      M.line=Lf.polyline(lls(),{color:LINE,weight:5,opacity:.9}).addTo(m);
      m.on('dragstart',()=>{M.follow=0});fit()})
    .catch(()=>{if(M.el===el){M.st='off';trace()}})}
function unmount(){if(M.map){try{M.map.remove()}catch(e){}}M.map=M.line=M.dot=M.el=null}
function fit(){const m=M.map;if(!m)return;const p=lastPt(),n=shown().reduce((a,s)=>a+s.length,0);
  if(n>1&&!(R&&R.since!=null&&M.follow))m.fitBounds(M.line.getBounds(),{padding:[24,24],maxZoom:17});else if(p)m.setView([p[0],p[1]],17);else m.setView(HOME,15)}
function redraw(){if(!M.el)return;if(!M.map){trace();return}
  M.line.setLatLngs(lls());const p=lastPt();
  if(p&&R){const ll=[p[0],p[1]];if(M.dot)M.dot.setLatLng(ll);else M.dot=L.circleMarker(ll,{radius:7,color:'#2b2418',weight:3,fillColor:'#f2c14e',fillOpacity:1}).addTo(M.map);if(M.follow)M.map.panTo(ll)}
  else if(M.dot){try{M.map.removeLayer(M.dot)}catch(e){}M.dot=null}
  if(!R)fit()}
// without Leaflet (offline / blocked / still loading): the route as a simple trace, north up
function trace(){if(!M.el||M.map)return;const S2=shown(),P=[].concat.apply([],S2);let h='<div class="v6rmt">';
  if(P.length){let a=90,b=-90,c=180,d=-180;P.forEach(p=>{a=Math.min(a,p[0]);b=Math.max(b,p[0]);c=Math.min(c,p[1]);d=Math.max(d,p[1])});
    const k=Math.cos((a+b)/2*Math.PI/180),w=Math.max((d-c)*k,1e-6),hh=Math.max(b-a,1e-6),s=100/Math.max(w,hh),ox=(100-w*s)/2,oy=(100-hh*s)/2;
    const xy=p=>((p[1]-c)*k*s+ox).toFixed(2)+','+((b-p[0])*s+oy).toFixed(2),e=xy(P[P.length-1]).split(',');
    h+='<svg viewBox="-6 -6 112 112" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Route trace, '+km(R?R.dist:U.run.dist)+' km">'+S2.map(q=>'<polyline points="'+q.map(xy).join(' ')+'"/>').join('')+'<circle cx="'+e[0]+'" cy="'+e[1]+'" r="2.6"/></svg>'}
  h+='<small>'+(M.st==='load'?'Loading the map…':'Map unavailable (offline or blocked). '+(P.length?'Your route is still recorded.':'Runs are still recorded without it.'))+'</small></div>';
  M.el.innerHTML=h}

/* ---------- Run page ---------- */
HWUI.css('run',`
#v6run .v6rh{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;min-height:24px}
#v6run .v6rg{display:inline-block;border:2px solid var(--ln);padding:2px 6px;font:7px/1.6 var(--fh);background:var(--p2)}
#v6run .v6rg.ok{background:var(--grn);color:#fff}#v6run .v6rg.weak{background:var(--gold);color:#2b2418}#v6run .v6rg.lost{background:var(--red);color:#fff}
#v6run .v6rr{display:inline-block;width:10px;height:10px;background:var(--red);border:2px solid var(--ln);margin-right:6px;vertical-align:-1px;animation:v6rrp 1s steps(2) infinite}
@keyframes v6rrp{50%{opacity:.25}}@media(prefers-reduced-motion:reduce){#v6run .v6rr{animation:none}}html.hw-rm #v6run .v6rr,html.hw-still #v6run .v6rr{animation:none}
#v6run .v6rs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}
#v6run .v6rs>div{background:var(--p2);border:3px solid var(--ln);padding:8px 4px;text-align:center;min-width:0}
#v6run .v6rs small{display:block;font:7px/1.6 var(--fh)}#v6run .v6rs b{display:block;font-size:clamp(18px,6vw,28px);line-height:1.2;overflow-wrap:anywhere}#v6run .v6rs em{font-style:normal;font-size:11px;color:var(--mut)}
#v6run .row button{flex:1 1 110px;justify-content:center;text-align:center}#v6run button:disabled{opacity:.45;cursor:not-allowed}
#v6run ul{margin:6px 0;padding-left:18px}#v6run li{margin:3px 0}
.v6rmc .v6rmh{justify-content:space-between;margin-bottom:8px}.v6rmc .v6rmh h3{margin:0}
#map{height:300px;border:3px solid var(--ln);background:var(--p2);position:relative;z-index:0;isolation:isolate;overflow:hidden}
@media(max-width:420px){#map{height:240px}}
#map .v6rmt{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px;text-align:center}
#map .v6rmt svg{flex:1 1 auto;width:100%;min-height:0}#map .v6rmt polyline{fill:none;stroke:${LINE};stroke-width:3;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
#map .v6rmt circle{fill:var(--gold);stroke:var(--ln);stroke-width:1}
#v6runs .v6rl{border-top:2px dashed var(--p2);padding:8px 0;display:flex;gap:8px;align-items:center}#v6runs .v6rl:first-of-type{border-top:0}
#v6runs .v6rl div{flex:1 1 auto;min-width:0}#v6runs .v6rl b{display:block;font-size:14px}#v6runs .v6rl small{display:block;color:var(--mut)}#v6runs .v6rl button{flex:0 0 auto}
`);
const btn=(a,t,cls,extra)=>'<button class="'+(cls||'')+'" data-a="'+a+'"'+(extra||'')+'>'+t+'</button>';
function chip(){if(!R||W==null)return'';if(!sig)return'<span class="v6rg" id="v6rg">GPS: SEARCHING…</span>';
  if(sig.lost)return'<span class="v6rg lost" id="v6rg">GPS SIGNAL LOST</span>';
  return sig.acc<=MAXACC?'<span class="v6rg ok" id="v6rg">GPS ±'+Math.round(sig.acc)+' M</span>':'<span class="v6rg weak" id="v6rg">GPS WEAK ±'+Math.round(sig.acc)+' M · NOT COUNTED</span>'}
function card(){
  if(U.k==='explain')return '<h3>WHY LOCATION?</h3><ul><li>To measure your run, HealthWiz follows your GPS position <b>while a run is recording</b>, and only then.</li>'
    +'<li>Your route is saved on this device. If you are signed in to Cloud Save, it is also saved to your private cloud, where only your account can read it. It is never shared or shown to anyone else.</li>'
    +'<li>Keep HealthWiz open on screen while you run: phones pause GPS for web pages when the screen locks.</li><li>Your browser will ask for permission. You can say no.</li></ul>'
    +'<div class="row">'+btn('runok','ALLOW LOCATION')+btn('runno','NOT NOW','g')+'</div>';
  const done=!R&&U.k==='done'?U.run:null,m=R?R.dist:done?done.dist:0,s=R?secs():done?done.dur:0,run=!!R&&R.since!=null;
  let h='<div class="v6rh"><span role="status">'
    +(run?'<b><span class="v6rr" aria-hidden="true"></span>RECORDING</b>':R?'<b>⏸ PAUSED</b>':done?'<b>🏁 RUN SAVED</b>':'<span class="mut">Ready when you are. Start outdoors, with a clear view of the sky.</span>')+'</span>'+(ch=chip())+'</div>';
  if(R&&R.rec)h+='<p class="mut">This run was interrupted (the page was closed or reloaded). RESUME to keep going, or FINISH RUN to save it.</p>';
  h+='<div class="v6rs"><div><small>DISTANCE</small><b class="num" id="v6rd">'+km(m)+'</b><em>km</em></div><div><small>TIME</small><b class="num" id="v6rt" role="timer">'+clock(s)+'</b><em>moving</em></div><div><small>AVG PACE</small><b class="num" id="v6rp">'+fmtPace(pace(m,s))+'</b><em>min/km</em></div></div>';
  if(U.err)h+='<div class="warn" role="alert"><b>'+esc(U.err[0])+'</b><br>'+esc(U.err[1])+'</div>';
  h+='<div class="row">'+btn('runstart','▶ START RUN','',R?' disabled':'')+btn('runpause',R&&!run?'▶ RESUME':'⏸ PAUSE','g',R?'':' disabled')+btn('runfinish','🏁 FINISH RUN','',R?'':' disabled')+'</div>';
  if(R&&!run)h+='<p style="margin-top:8px">'+btn('rundiscard',arm==='live'?'TAP AGAIN TO DISCARD THIS RUN':'DISCARD RUN','sm g')+'</p>';
  if(!R&&DB.ok)h+='<p class="mut" style="margin-top:8px">Location is read only while a run is recording. '+btn('runoff','TURN OFF LOCATION','sm g')+'</p>';
  return h}
function cloudLine(){const wait=DB.runs.filter(x=>!x.up&&!x.bad).length;
  if(typeof HWCloud==='undefined'||!HWCloud.status().configured)return'Runs are saved on this device.';
  if(!cloud())return'Runs are saved on this device. Sign in to Cloud Save to back them up privately. '+btn('go','OPEN SETTINGS','sm g',' data-v="set"');
  if(busy)return'⏳ Sending runs to your cloud save…';
  if(cerr==='net'||(!online()&&wait))return'📴 Could not reach the cloud. '+wait+' run'+(wait===1?'':'s')+' will be sent when the connection works.';
  if(cerr==='setup')return'⚠️ The cloud project is not set up for runs yet (the hw_runs table is missing). Run supabase/migrations/20261005000000_hw_runs.sql in the Supabase project. Your runs are safe on this device.';
  if(cerr==='auth')return'⚠️ Your cloud sign-in has expired. Sign in again in Settings → Cloud Save to send your runs.';
  if(cerr)return'⚠️ '+esc(cerr)+' Your runs are safe on this device.';
  return wait?'⏳ '+wait+' run'+(wait===1?'':'s')+' waiting to be sent.':'☁️ Your runs are backed up to your private cloud save.'}
const when=r=>{const d=new Date(r.start);return isNaN(d)?'':d.toLocaleDateString([],{weekday:'short',day:'numeric',month:'short'})+', '+two(d.getHours())+':'+two(d.getMinutes())};
function runs(){const L=DB.runs.slice().reverse(),wk=Date.now()-7*864e5,W7=L.filter(r=>Date.parse(r.start)>=wk);
  let h='<h3>📜 RECENT RUNS</h3>';
  if(!L.length)h+='<p class="mut">No runs yet. Your finished runs appear here.</p>';
  else h+='<p class="mut">Last 7 days: <b>'+km(W7.reduce((a,r)=>a+(+r.dist||0),0))+' km</b> in '+W7.length+' run'+(W7.length===1?'':'s')+'.</p>'
    +L.slice(0,SHOW).map(r=>'<div class="v6rl"><div><b>'+km(r.dist)+' km · '+clock(r.dur)+'</b><small>'+esc(when(r))+' · '+fmtPace(r.pace)+' /km · '+(r.up?'☁️ in your cloud':r.bad?'⚠️ not accepted by the cloud':'📱 on this device')+'</small></div>'
      +btn('rundel',arm===r.id?'TAP AGAIN':'DELETE','sm g',' data-id="'+esc(r.id)+'" aria-label="'+(arm===r.id?'Tap again to delete':'Delete')+' the run of '+esc(when(r))+'"')+'</div>').join('');
  return h+'<p class="mut" role="status" style="margin-top:8px">'+cloudLine()+'</p>'}
// the Running section of the Stairs page (js/v6-stairs.js); the old 'run' route opens that section
const ON='stair',here=()=>S.v===ON;
// the map (and Leaflet + tiles from the internet) loads only when wanted: arriving at Running, a run started or
// recorded, or SHOW MAP; then once the map is on screen. Someone only logging stairs never loads it.
let IO=null,want=0;
function lazy(){if(IO){IO.disconnect();IO=null}const el=D.getElementById('map');if(!el||el===M.el)return;
  if(!want&&!R){el.innerHTML='<div class="v6rmt"><small>The route map loads when you start a run.</small>'+btn('runmap','🗺️ SHOW MAP','sm g')+'</div>';return}
  if(typeof IntersectionObserver==='undefined'){mount();return}
  IO=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){IO.disconnect();IO=null;mount()}},{rootMargin:'200px 0px'});IO.observe(el)}
function section(){Promise.resolve().then(lazy);
  return '<div class="card" id="v6run">'+card()+'</div>'
    +'<div class="card v6rmc"><div class="row v6rmh"><h3>🗺️ ROUTE</h3>'+btn('runcentre','⌖ CENTRE','sm g',' aria-label="Centre the map on the route"')+'</div><div id="map" role="region" aria-label="Route map"></div></div>'
    +'<div class="card" id="v6runs">'+runs()+'</div>'}
pages.run=()=>pages.stair();
let T=0;function tick(on){clearInterval(T);T=0;if(on&&R&&R.since!=null)T=setInterval(()=>{if(!here()||!R||R.since==null){tick(0);return}show()},1000)}
function paint(){const el=D.getElementById('v6run');if(el)el.innerHTML=card();tick(here())}
function paintRuns(){const el=D.getElementById('v6runs');if(el)el.innerHTML=runs()}
// live numbers: patch the text only, so the map and the buttons are left alone
function show(){if(!here()||!R)return;const s=secs(),set=(i,t)=>{const e=D.getElementById(i);if(e&&e.textContent!==t)e.textContent=t};
  set('v6rd',km(R.dist));set('v6rt',clock(s));set('v6rp',fmtPace(pace(R.dist,s)));
  const c=chip(),g=D.getElementById('v6rg');if(c!==ch&&g&&c){g.outerHTML=c;ch=c}}

// no Health Hall tile of its own any more: Running lives at the bottom of the Stairs page. Its tile shows a run in
// progress (so a recording run is never hidden), and its footnote gains this line.
{const h=HUB.find(x=>x[0]==='stair');if(h){const f=h[4];h[4]=d=>R?(R.since!=null?'🔴 run recording · ':'⏸ run paused · ')+km(R.dist)+' km':f(d)}}
PAR.run='health';
BN.run=['🏃','Running Road','The road calls. Lace up, adventurer.','rgba(232,89,12,.3)'];
DIS.run='General exercise tracker, not medical advice. GPS distance and pace are estimates and can drift near tall buildings and trees. Watch the road, not the screen, and stop if you feel dizzy, faint or have chest pain.';
DIS.stair=(DIS.stair||'')+' Running: '+DIS.run;

acts.runstart=()=>{arm='';if(R)return;if(!DB.ok){U={k:'explain'};paint();return}start()};
acts.runok=()=>{DB.ok=1;keep();start()};
acts.runno=()=>{U={k:'idle'};paint()};
acts.runoff=()=>{if(R)return;DB.ok=0;keep();paint();toast('📍 Location turned off for runs. HealthWiz will explain and ask again before using it.')};
acts.runpause=()=>{arm='';if(!R)return;if(R.since!=null)pauseRun();else resume();paint();redraw()};
acts.runfinish=()=>finish();
acts.rundiscard=()=>{if(!R||R.since!=null)return;if(arm!=='live'){arm='live';paint();return}arm='';drop();U={k:'idle'};paint();redraw();toast('Run discarded. Nothing was saved.')};
acts.rundel=d=>{const id=d.id,i=DB.runs.findIndex(r=>r.id===id);if(i<0)return;if(arm!==id){arm=id;paintRuns();return}arm='';
  const r=DB.runs.splice(i,1)[0];if(r.up||busy)DB.del.push(id);keep();if(U.k==='done'&&U.run.id===id){U={k:'idle'};paint();redraw()}
  paintRuns();toast('🗑️ Run deleted'+(r.up?' from this device; it is removed from your cloud save as soon as it can be reached.':'.'));sync()};
acts.runcentre=()=>{M.follow=1;if(M.map)fit()};
acts.runmap=()=>{want=1;lazy()};
function showMap(){want=1;lazy()}

// triggers: uploads ride on the cloud save's own rhythm; leaving the page keeps a run recording
HWEvents.on('app:ready',()=>sync());HWEvents.on('cloud:synced',()=>sync());addEventListener('online',()=>sync());
HWEvents.on('page:viewed',e=>{if(e.view===ON){tick(1);sync();return}tick(0);if(IO){IO.disconnect();IO=null}unmount();arm='';
  if(R&&R.since!=null&&e.from===ON)toast('🏃 Your run is still recording. Health → Stairs & Workout → Running to see it or finish it.')});
D.addEventListener('visibilitychange',()=>{if(D.visibilityState==='visible'){if(R&&R.since!=null)wake(1)}else if(R)live()});
addEventListener('pagehide',()=>{if(R)live()});
HWEvents.on('data:reset',()=>{drop();DB={ok:0,runs:[],del:[]};try{localStorage.removeItem(K)}catch(e){}U={k:'idle'};arm=''});

return{dist,judge,pace,clock,fmtPace,sync,section,showMap,wantMap(){want=1},MAXACC,MINSTEP,MAXSPD,
  get state(){return R?(R.since!=null?'running':'paused'):U.k},get run(){return R?{dist:R.dist,secs:secs(),segs:R.segs.map(s=>s.length)}:null},runs:()=>JSON.parse(JSON.stringify(DB.runs))}})();
