/* v6: GPS activity check-in (master prompt §43–47, §79, §88, §97 step 20). Not part of the original.
   The Stairs page shows a GPS CHECK-IN card in its casual-climbing section. All mapped stairways are on the Kolej MARA Kulim campus. The stairways are the original STAIRS list (hw-02-core.js):
   every stairway with lat/lng can be found by GPS; one whose coordinates are still null is listed for manual
   logging only, and joins GPS check-in as soon as its coordinates are filled in there.
   Flow (§44): explain why location is needed → the browser asks for permission → ONE position reading
   (getCurrentPosition, never watchPosition) → nearest stairways with approximate distance → the user confirms
   a check-in while standing still → a normal stair entry is saved, so quests, XP (incl. the daily allowance),
   statistics and the Stair Mountain region update exactly as for a manual log.
   Accuracy (§45): the activation radius grows with the reported accuracy (35 m + up to 65 m); readings worse
   than ±150 m never allow a check-in; denied / unavailable / timed-out / unsupported each get a plain message
   and the manual form below always works.
   Privacy (§46, §79): the user's own position is kept in memory only for this card and never saved, logged,
   sent or shown. Location is only read when the user taps. TURN OFF forgets the permission explanation.
   Exploration (§47): the first GPS-verified check-in at each stairway is a discovery (+5 XP, once).
   State: st.gp = {ok: explained & allowed (0/1), v: {stairId: firstCheckInDate}} (schema v8).
   Event: activity:checkin {sid, name, cat, first} (docs/EVENTS.md). */
const HWGps=(()=>{
const CAMPUS='Kolej MARA Kulim',OFF=1500,BASE=35,EXTRA=65,WEAK=150,NEAR=400,SHOW=5,FRESH=10*60e3;
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const gp=()=>{if(!isO(st.gp))st.gp={ok:0,v:{}};if(!isO(st.gp.v))st.gp.v={};return st.gp};
const mapped=()=>STAIRS.filter(hasXY);
/** One source for every stairway count: total and on-map from STAIRS, discovered from st.gp. */
const counts=()=>{const n=mapped().length,found=Object.keys(gp().v).filter(k=>mapped().some(s=>s.id===k)).length;return{total:STAIRS.length,mapped:n,unmapped:STAIRS.length-n,found}};
// metres between two lat/lng points (haversine)
function dist(a,b,c,d){const R=6371e3,r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);return 2*R*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y))}
const radius=acc=>BASE+Math.min(Math.max(+acc||0,0),EXTRA);
const fmt=m=>m<1000?'about '+Math.max(10,Math.round(m/10)*10)+' m':'about '+(m/1000).toFixed(1)+' km';
/** Stairways sorted by distance from a reading {lat,lng,acc}: [{i, s, d, here}]. Pure, for the card and tests. */
function nearby(p){const R=radius(p.acc),ok=p.acc<=WEAK;
  return STAIRS.map((s,i)=>({i,s})).filter(x=>hasXY(x.s)).map(x=>Object.assign(x,{d:dist(p.lat,p.lng,x.s.lat,x.s.lng)})).map(x=>Object.assign(x,{here:ok&&x.d<=R})).sort((a,b)=>a.d-b.d)}

// card state lives in memory only: the reading is never stored
let U={k:'idle'};
const geo=()=>typeof navigator!=='undefined'&&navigator.geolocation;

HWUI.css('gps',`
#v6gps .v6gpl{border-top:2px dashed var(--p2);padding:8px 0;display:flex;gap:8px;align-items:center}#v6gps .v6gpl:first-of-type{border-top:0}
#v6gps .v6gpl div{flex:1 1 auto;min-width:0}#v6gps .v6gpl b{display:block;font-size:14px;overflow-wrap:anywhere}#v6gps .v6gpl small{display:block;color:var(--mut)}
#v6gps .v6gpl .ok{color:var(--grn);font:7px/1.6 var(--fh)}#v6gps .v6gpl button{flex:0 0 auto}
#v6gps ul{margin:6px 0;padding-left:18px}#v6gps li{margin:3px 0}
#v6gps .v6gpw{display:inline-block;width:14px;height:14px;background:var(--gold);border:2px solid var(--ln);margin-right:8px;vertical-align:-2px;animation:v6gpsp 1s steps(4) infinite}
@keyframes v6gpsp{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#v6gps .v6gpw{animation:none}}
html.hw-rm #v6gps .v6gpw,html.hw-still #v6gps .v6gpw{animation:none}
`);

const CAT={MILD:'🌿 Mild',MODERATE:'⚔️ Moderate',VIGOROUS:'🔥 Vigorous'};
const btn=(a,t,cls,extra)=>'<button class="'+(cls||'')+'" data-a="'+a+'"'+(extra||'')+'>'+t+'</button>';
const manual='<p class="mut" style="margin-top:8px">You can always log a climb by hand with the form below.</p>';
function card(){const K=counts(),n=K.mapped,un=K.unmapped,found=K.found;
  let h='<h2>📍 GPS CHECK-IN</h2>';
  if(U.k==='idle'||U.k==='done'){
    if(U.k==='done')h+='<p role="status">✅ Checked in at <b>'+esc(U.name)+'</b>. Your stair log, quests and Stair Mountain are updated.</p>';
    h+='<p>Standing at a stairway at '+CAMPUS+'? Find it by GPS and check in with one tap. '+n+' of '+K.total+' stairways are on the map'+(un?'; the other '+un+' can be logged by hand below':'')+'.</p>'
      +'<p class="mut">Stairways discovered by GPS check-in: <b>'+found+' of '+n+'</b> on the map ('+K.total+' stairways in total).</p>'+btn('gpsfind','FIND STAIRS NEAR ME')
      +(gp().ok?'<p class="mut" style="margin-top:8px">Location is read only when you tap. '+btn('gpsoff','TURN OFF LOCATION','sm g')+'</p>':'');
    return h}
  if(U.k==='explain')return h+'<h3>WHY LOCATION?</h3><ul><li>To find the stairway you are standing at, so you can check in without searching the list.</li><li>Your position is read <b>once</b>, only when you tap. There is no tracking in the background.</li><li>Your position is never saved, shared or shown to anyone. Only the stairway you check in at is logged.</li><li>Your browser will ask for permission. You can say no and still log by hand.</li></ul><div class="row">'+btn('gpsok','ALLOW LOCATION')+btn('gpsno','NOT NOW','g')+'</div>';
  if(U.k==='locating')return h+'<p role="status"><span class="v6gpw" aria-hidden="true"></span>Finding your position… stand still for a moment.</p>'+btn('gpsno','CANCEL','sm g');
  if(U.k==='error')return h+'<div class="warn" role="alert"><b>'+esc(U.title)+'</b><br>'+esc(U.msg)+'<br>Nothing was saved.</div><div class="row" style="margin-top:8px">'+btn('gpsfind','TRY AGAIN')+btn('gpsno','CLOSE','g')+'</div>'+manual;
  if(U.k==='result'){const L=U.list,weak=U.acc>WEAK,close=L.filter(x=>x.d<=NEAR).slice(0,SHOW);
    h+='<p class="mut" role="status">Position accurate to ±'+Math.round(U.acc)+' m.</p>';
    if(weak)h+='<div class="warn">The GPS signal is weak (±'+Math.round(U.acc)+' m), so check-in is paused. Indoors and between buildings this is common: step outside or wait a moment, then refresh.</div>';
    if(!L.length)h+='<p>No stairway has map coordinates yet.</p>';
    else if(L[0].d>OFF)h+='<p>You seem to be away from '+CAMPUS+'. GPS check-in only works at the campus stairways ('+fmt(L[0].d)+' away). You can still log a session by hand.</p>';
    else if(!close.length)h+='<p>No mapped stairway within '+NEAR+' m. The nearest is <b>'+esc(L[0].s.name)+'</b>, '+fmt(L[0].d)+' away.</p>';
    else h+=close.map(x=>'<div class="v6gpl"><div><b>'+esc(x.s.name)+'</b><small>'+CAT[x.s.cat]+' · θ '+x.s.angle.toFixed(2)+'° · '+esc(x.s.floor)+' · '+fmt(x.d)+' away</small>'
      +(x.here?'<span class="ok">✅ YOU ARE HERE</span>':'<small>Walk closer to check in.</small>')+'</div>'
      +(x.here?btn('gpspick','CHECK IN','sm',' data-i="'+x.i+'" aria-label="Check in at '+esc(x.s.name)+'"'):'')+'</div>').join('');
    return h+'<div class="row" style="margin-top:8px">'+btn('gpsfind','↻ REFRESH','g')+btn('gpsno','CLOSE','g')+'</div>'+manual}
  if(U.k==='confirm'){const s=STAIRS[U.i],last=LC('stair').filter(e=>e.m&&e.m.sid===s.id).pop();
    return h+'<p>Check in at <b>'+esc(s.name)+'</b> ('+CAT[s.cat]+', '+esc(s.floor)+').</p><p class="mut">Fill this in while standing still, before or after your climb. Please don\'t use your phone on the stairs.</p>'
      +'<div class="row"><label>Steps per climb<input id="gps-s" type="number" min="1" max="1000" value="'+(last&&+last.m.steps||'')+'"></label><label>Number of climbs<input id="gps-c" type="number" min="1" max="500" value="1"></label></div>'
      +'<label>Pace<select id="gps-p">'+PACES.map(p=>'<option>'+p[1]+'</option>').join('')+'</select></label>'
      +'<div class="row" style="margin-top:8px">'+btn('gpsconfirm','CONFIRM CHECK-IN')+btn('gpscancel','BACK','g')+'</div>'}
  return h}
const paint=()=>{const el=document.getElementById('v6gps');if(el)el.innerHTML=card()};

// the card is placed by the Stairs page (js/v6-stairs.js) at the top of its casual-climbing section
function cardSafe(){try{return card()}catch(e){console.error('[HWGps] card failed:',e);return ''}}

const ERR={1:['Location permission is off','Your browser is not sharing your location with HealthWiz. You can allow it in the browser\'s site settings, or log by hand below.'],
  2:['Position unavailable','Your device could not work out where you are (no GPS fix). Try again outdoors, or log by hand below.'],
  3:['That took too long','No GPS reading arrived in time. Weak signal indoors is common: try again near a window or outside.']};
function fail(t,m){U={k:'error',title:t,msg:m};paint()}
let gen=0;
function locate(){const G=geo();
  if(!G){fail('Location is not available','This browser cannot share a location. You can log by hand below.');return}
  if(typeof isSecureContext!=='undefined'&&!isSecureContext){fail('Location needs a secure page','Browsers only share location on https:// pages. Open HealthWiz from its https address, or log by hand below.');return}
  const my=++gen;U={k:'locating'};paint();
  try{G.getCurrentPosition(p=>{if(my!==gen)return;const c=p.coords,r={lat:+c.latitude,lng:+c.longitude,acc:+c.accuracy};
      if(![r.lat,r.lng].every(isFinite)||Math.abs(r.lat)>90||Math.abs(r.lng)>180){fail('Odd GPS reading','The reading did not look valid. Try again, or log by hand below.');return}
      if(!(r.acc>=0))r.acc=WEAK+1;
      U={k:'result',acc:r.acc,list:nearby(r),at:Date.now()};paint()},
    e=>{if(my!==gen)return;const m=ERR[e&&e.code]||ERR[2];fail(m[0],m[1])},
    {enableHighAccuracy:true,timeout:20000,maximumAge:0})}catch(e){fail('Location failed','The browser refused the request ('+(e&&e.message)+'). You can log by hand below.')}}

acts.gpsfind=()=>{if(!gp().ok){U={k:'explain'};paint();return}locate()};
acts.gpsok=()=>{gp().ok=1;save();locate()};
acts.gpsno=()=>{gen++;U={k:'idle'};paint()};
acts.gpsoff=()=>{gp().ok=0;save();gen++;U={k:'idle'};paint();toast('📍 Location turned off. HealthWiz will explain and ask again before using it.')};
acts.gpscancel=()=>{if(U.prev){U=U.prev;paint()}else acts.gpsno()};
acts.gpspick=d=>{if(U.k!=='result')return;const x=U.list.find(y=>y.i===+d.i);if(!x||!x.here)return;U={k:'confirm',i:x.i,prev:U};paint();const f=document.getElementById('gps-s');if(f)f.focus()};
acts.gpsconfirm=()=>{if(U.k!=='confirm')return;
  if(Date.now()-U.prev.at>FRESH){U={k:'idle'};paint();toast('That GPS reading is over 10 minutes old. Tap FIND STAIRS NEAR ME again.');return}
  const s=+$('#gps-s').value,c=+$('#gps-c').value;
  if(!(Number.isInteger(s)&&s>=1&&s<=1000&&Number.isInteger(c)&&c>=1&&c<=500)){toast('Enter steps per climb (1–1000) and number of climbs (1–500)');return}
  const i=U.i,q=STAIRS[i],G=gp(),first=!G.v[q.id];
  // the same session record as a climb logged by hand (js/v6-stairs.js), marked as a casual GPS check-in
  add('stair',s*c,{sid:q.id,loc:q.name,diff:q.cat,floor:q.floor,angle:q.angle,lat:q.lat,lng:q.lng,steps:s,climbs:c,kind:'casual',src:'gps',chk:'gps',dur:0,pace:$('#gps-p').value,hrB:null,hrA:null,kcal:null},'',today(),nowT(),25,'Stair check-in');
  if(first){G.v[q.id]=today();save();gain(5,'Discovered '+q.name);HWUI.celebrate({icon:'📍',title:'STAIRWAY DISCOVERED!',sub:q.name,xp:5})}
  HWEvents.emit('activity:checkin',{sid:q.id,name:q.name,cat:q.cat,first});
  S.loc=i;S.cat=q.cat;U={k:'done',name:q.name};render()};

// leaving a bulk change (import / reset) or the page drops any in-memory reading
HWEvents.on('data:reset',()=>{gen++;U={k:'idle'}});HWEvents.on('data:imported',()=>{gen++;U={k:'idle'}});
HWEvents.on('page:viewed',e=>{if(e.view!=='stair'){gen++;U={k:'idle'}}});

return{nearby,dist,radius,counts,WEAK,card:cardSafe,get state(){return U.k}}})();
