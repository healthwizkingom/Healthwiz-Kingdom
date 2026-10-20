/* v6: the Campus Health Observatory (route 'campus'), a campus map of the stairways. Not part of the original.
   Master prompt Feature D. The owner chose (2026-10-13) to build it now from the locations already in the app, clearly
   marked as unverified, until verified ones are available.
   * Locations: the staircase records of js/v6-campus-data.js (STAIRS from the original v5.4.3 app, the F21 step sizes,
     and the survey overlay data/stair-survey.json). The app's coordinates have no recorded source, so those points are
     labelled "Unverified: from the original app data"; a position measured in the survey says so instead. Stairways
     that share one coordinate are one marker; stairways without coordinates are listed and selectable, never placed.
     No routes are drawn (none are recorded).
   * The map is drawn from the coordinates themselves (an equirectangular projection around their centre, so distances
     and the 100 m scale bar are real). Its look follows the owner's illustrated campus maps (daylight grounds, trees,
     a small red-roofed building at each stairway point, a gold compass): decoration only, with no roads or paths.
   * Live weather and haze (js/v6-live.js) are read for HWLive.KMK, a "Kolej MARA Kulim" point that is itself marked
     "verify on Google Maps" and lies about 2.9 km from the stairways: the page says so instead of hiding it.
   * The map moves: drag it (mouse or finger) to look around; ZOOM IN spreads the points; RECENTRE puts it back.
   * Location only on tap (owner decision, 2026-10-20): opening the Observatory asks for nothing. SHOW WHERE I AM asks
     the browser for one position; on campus it selects the nearest mapped stairway, zooms in and centres on it. It is shown on this screen only: never saved, never sent. If
     location is denied, unavailable or far away, the player picks a stairway on the map or in the list instead.
   * Campus-wide activity: HealthWiz collects no one else's location, so there is no overlay; the page says so. The
     player's own visits (first GPS check-ins st.gp.v, their stair sessions) are shown only to them.
   * START STAIR SESSION opens the Stairs page with that staircase chosen (HWCampusData.start); it never starts a session.
     HWCampus.focus(id) selects a staircase from elsewhere (FIND ON OBSERVATORY): it centres the map on it, or, with no
     coordinates, shows its details without moving the map.
   * The selection and the map view (zoom, pan) are kept for this tab in sessionStorage ('hw_obs_view'), so going back to
     the Observatory, or a refresh, restores them. Your position is never kept.
   * Markers glow (CSS); nothing moves with reduced motion or the Performance mode. Nothing is written to the save. */
const HWCampus=(()=>{
const ico=(n,s)=>HWPixel.icon(n,s||1),D0=document;
const CN={MILD:'Mild',MODERATE:'Moderate',VIGOROUS:'Vigorous'},CK={MILD:1,MODERATE:2,VIGOROUS:3};
const UNV='Unverified: from the original app data';
const dist=(a,b,c,d)=>typeof HWGps!=='undefined'?HWGps.dist(a,b,c,d):(()=>{const R=6371e3,r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);return 2*R*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y))})();
const fmtD=m=>m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(1)+' km';

/* ---------- the points: stairways that share a coordinate are one marker ---------- */
const R=()=>HWCampusData.records(),placed=s=>HWCampusData.placed(s);
function points(){const G={};R().filter(placed).forEach(s=>{const k=s.latitude.toFixed(6)+','+s.longitude.toFixed(6);(G[k]=G[k]||{lat:s.latitude,lng:s.longitude,L:[]}).L.push(s)});return Object.values(G)}
const unmapped=()=>R().filter(s=>!placed(s));
/** The projection: metres east/north of the points' centre, then into a box with a margin (percent of the map). */
function proj(P){const la=P.reduce((a,p)=>a+p.lat,0)/P.length,ln=P.reduce((a,p)=>a+p.lng,0)/P.length,kx=111320*Math.cos(la*Math.PI/180),ky=110540;
  const xy=p=>[(p.lng-ln)*kx,(p.lat-la)*ky],X=P.map(p=>xy(p)[0]),Y=P.map(p=>xy(p)[1]);
  const w=Math.max(60,Math.max(...X)-Math.min(...X)),h=Math.max(60,Math.max(...Y)-Math.min(...Y)),x0=Math.min(...X),y1=Math.max(...Y),pad=.1;
  const sc=Math.min((1-2*pad)/w,(1-2*pad)/h*1.5); // the map is 3:2; one scale for both axes keeps distances true
  const z=V.z||1,zf=v=>50+(v-50)*z; // ZOOM IN spreads the points from the map's centre (2x); the map clips the edges
  const at=p=>{const[x,y]=xy(p);return[zf(pad*100+(x-x0)*sc*100+((1-2*pad)-w*sc)*50),zf(pad*100+(y1-y)*sc*100/1.5+((1-2*pad)-h*sc/1.5)*50)]};
  return{at,c:{lat:la,lng:ln},mPerPct:1/(sc*100*z)}}

/* ---------- state: the selection (a staircase id) and the map view are kept for this tab; the position never ---------- */
const VK='hw_obs_view',V={sid:null,me:null,gps:'',err:'',note:'',z:1,px:0,py:0};
try{const o=JSON.parse(sessionStorage.getItem(VK)||'null');if(o&&typeof o==='object'){if(typeof o.sid==='string')V.sid=o.sid;if(o.z===2)V.z=2;
  ['px','py'].forEach(k=>{if(isFinite(o[k]))V[k]=Math.max(-120,Math.min(120,+o[k]))})}}catch(e){}
const persist=()=>{try{sessionStorage.setItem(VK,JSON.stringify({sid:V.sid,z:V.z,px:V.px,py:V.py}))}catch(e){}};
const selIdx=P=>{if(!V.sid)return null;const i=P.findIndex(g=>g.L.some(s=>s.id===V.sid));return i<0?null:i};
const act=id=>HWCampusData.activity(id);

function marker(g,i,pr,si){const[x,y]=pr.at(g),s=g.L[0],n=g.L.length,on=si===i,vis=g.L.some(q=>{const a=act(q.id);return a.firstCheckIn||a.sessions});
  const name=g.L.map(q=>q.name).join('; ');
  return '<button type="button" class="cmpm cmp'+CK[s.appCategory]+(on?' on':'')+(vis?' vis':'')+'" style="left:'+x.toFixed(2)+'%;top:'+y.toFixed(2)+'%" data-a="cmpsel" data-i="'+i+'" aria-pressed="'+on+'" aria-label="'+esc(name)+', '+CN[s.appCategory]+(n>1?', '+n+' stairways at one point':'')+(vis?', you have climbed here':'')+'">'+CK[s.appCategory]+(n>1?'<small class="cmpn" aria-hidden="true">×'+n+'</small>':'')+'</button>'}
/* The look follows the owner's illustrated campus maps (daylight grounds, trees, red-roofed blocks, a gold compass); it is
   decoration only: the trees are placed by a fixed pseudo-random sequence away from the markers, and one small building
   sits under each mapped stairway point. No roads or paths are drawn, because none are recorded. */
function scenery(P,pr){const pts=P.map(g=>pr.at(g)).map(([x,y])=>[x*3,y*2]);let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  let trees='';for(let k=0;k<110;k++){const x=rnd()*300,y=rnd()*200,r=3+rnd()*3;if(pts.some(([a,b])=>Math.hypot(a-x,b-y-9)<16))continue;
    trees+='<circle cx="'+x.toFixed(1)+'" cy="'+(y+1.5).toFixed(1)+'" r="'+r.toFixed(1)+'" fill="#2f5a2c"/><circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+(k%3?'#4c8a3f':'#5f9d48')+'"/><circle cx="'+(x-r/3).toFixed(1)+'" cy="'+(y-r/3).toFixed(1)+'" r="'+(r/2.6).toFixed(1)+'" fill="#86c46a"/>'}
  const blocks=pts.map(([x,y])=>{if(x<-6||x>306||y<-6||y>206)return'';return '<g transform="translate('+x.toFixed(1)+' '+(y+13).toFixed(1)+') scale(1.3)"><rect x="-8" y="-3" width="16" height="9" fill="#f3e6cf" stroke="#7a5b3c" stroke-width=".6"/>'
    +'<path d="M-10 -3L0 -10L10 -3Z" fill="#c8553d" stroke="#7a3022" stroke-width=".6"/><rect x="-5" y="0" width="3" height="3" fill="#7fb6e0"/><rect x="2" y="0" width="3" height="3" fill="#7fb6e0"/></g>'}).join('');
  return '<svg viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="cmpg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cb963"/><stop offset="1" stop-color="#4f8a45"/></linearGradient>'
    +'<pattern id="cmpgrid" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="rgba(255,255,255,.05)"/><rect x="3" y="3" width="2" height="2" fill="rgba(0,0,0,.05)"/></pattern></defs>'
    +'<rect width="300" height="200" fill="url(#cmpg)"/><rect width="300" height="200" fill="url(#cmpgrid)"/>'+trees+blocks
    +'<g transform="translate(26 172)" class="cmpcompass"><circle r="15" fill="rgba(18,15,51,.55)" stroke="#f6c94f"/><path d="M0-13L3 0L0 13L-3 0Z" fill="#f6c94f"/><path d="M-13 0L0 -3L13 0L0 3Z" fill="#fff0a8"/>'
    +'<text y="-17" text-anchor="middle" font-size="8" fill="#fff0a8" stroke="#120f33" stroke-width=".5">N</text></g>'
    +'</svg>'}
function mapView(P,pr){const bar=100/pr.mPerPct; // 100 m in percent of the map width
  const me=V.me?(()=>{const[x,y]=pr.at(V.me);return x>=-150&&x<=250&&y>=-150&&y<=250?'<span class="cmpme" style="left:'+x.toFixed(2)+'%;top:'+y.toFixed(2)+'%" role="img" aria-label="You are here (± '+Math.round(V.me.acc)+' m)"></span>':''})():'';
  return '<div class="cmpmap" role="group" aria-label="Campus stairways map. Drag to move it.">'
    +'<div class="cmppan" style="transform:translate('+V.px.toFixed(2)+'%,'+V.py.toFixed(2)+'%)">'+scenery(P,pr)
    +P.map((g,i)=>marker(g,i,pr,selIdx(P))).join('')+me+'</div>'
    +'<div class="cmpctl"><button type="button" class="g sm" data-a="cmpzoom" aria-pressed="'+(V.z>1)+'">'+(V.z>1?'ZOOM OUT':'ZOOM IN')+'</button>'
    +(V.px||V.py?'<button type="button" class="g sm" data-a="cmpcentre">RECENTRE</button>':'')+'</div>'
    +'<div class="cmpscale" aria-hidden="true"><i style="width:'+Math.min(60,bar).toFixed(2)+'%"></i><small>'+(bar>60?'≈ '+Math.round(60*pr.mPerPct)+' m':'100 m')+'</small></div>'
    +'</div><p class="cmpunv">'+UNV+'</p>'
    +'<p class="cmpleg mut"><span class="cmpk cmp1">1</span> Mild · <span class="cmpk cmp2">2</span> Moderate · <span class="cmpk cmp3">3</span> Vigorous · ×2 or ×3: stairways at one point · a ring: you have climbed there</p>'}
const where1=s=>s.locationStatus==='measured'?'Measured location (survey) · '+s.locationSource:UNV;
/** One staircase in the details: the app's values with the prototype's labels, its notes, and the player's own climbs. */
function item(s){const a=act(s.id),n=a.sessions;
  return '<li><b>'+esc(s.name)+'</b> <small class="mut">('+s.id+')</small><br>'+CN[s.appCategory]+' · '+esc(s.appFloorLabel)+' · θ '+s.estimatedAngle.toFixed(2)+'°'
    +(s.surveyAngle!=null?' · θ '+s.surveyAngle.toFixed(2)+'° from surveyed steps (calculated)':'')
    +(s.measuredStep?' · step rise '+s.measuredStep.rise_m.toFixed(3)+' m, run '+s.measuredStep.run_m.toFixed(3)+' m (F21, measured)':'')
    +'<br><small class="cmplab">'+HWCampusData.labels(s).map(l=>esc(l[1])).join(' · ')+'</small>'
    +(s.notes?'<br><small class="mut">'+esc(s.notes)+'</small>':'')
    +'<br><small>'+(n?'You saved '+n+' stair session'+(n>1?'s':'')+' here':'No stair sessions saved here yet')+(a.firstCheckIn?' · first GPS check-in '+esc(a.firstCheckIn):'')+'</small>'
    +'<br><button type="button" class="g sm" data-a="cmpstair" data-id="'+s.id+'">START STAIR SESSION</button></li>'}
function detail(P){const i=selIdx(P),s=V.sid&&HWCampusData.record(V.sid);if(!s)return '';
  const open='<div class="cmpdet" id="cmpdet" tabindex="-1" role="region" aria-label="Selected place">';
  if(i==null)return open+'<b>'+ico('stairs')+' '+esc(s.name)+'</b><p class="mut">No location recorded, so it is not placed on the map.</p><ul>'+item(s)+'</ul></div>';
  const g=P[i],d=V.me?dist(V.me.lat,V.me.lng,g.lat,g.lng):null;
  return open+'<b>'+ico('stairs')+' '+(g.L.length>1?g.L.length+' stairways at one point':esc(g.L[0].name))+'</b>'
    +'<p class="mut">'+g.lat.toFixed(7)+', '+g.lng.toFixed(7)+' · '+esc(where1(g.L[0]))+(d!=null?' · about '+fmtD(d)+' from you':'')+'</p><ul>'
    +g.L.map(item).join('')+'</ul></div>'}
function weather(){const L=typeof HWLive!=='undefined'?HWLive:null;if(!L)return'';
  const P=points(),c=proj(P).c,k=L.KMK,off=k?dist(c.lat,c.lng,k.lat,k.lon):null;
  const note='<small class="mut">Read for the "'+esc(k?k.name:'Kolej MARA Kulim')+'" point'+(off!=null?', about '+fmtD(off)+' from the stairways':'')+'. That point is not verified either.</small>';
  if(!L.enabled())return '<div class="cmpwx"><b>'+ico('cloud')+' Weather and haze</b><p class="mut">Live weather is off (Settings, Live data).</p></div>';
  const S2=L.state(),w=S2.wx&&S2.wx.st==='ok'&&S2.wx.d&&S2.wx.d.current,a=S2.aq&&S2.aq.st==='ok'&&S2.aq.d&&S2.aq.d.current;
  if(!w&&!a)return '<div class="cmpwx"><b>'+ico('cloud')+' Weather and haze</b><p class="mut">No live reading yet: offline, or still loading.</p>'+note+'</div>';
  const b=a?L.band(a.pm2_5):null;
  return '<div class="cmpwx"><b>'+ico('cloud')+' Weather and haze, live</b><p>'+(w?Math.round(w.temperature_2m)+' °C · '+esc(L.WMO[w.weather_code]||'Weather'):'')+(w&&a?' · ':'')
    +(b?'Haze '+esc(b.k.toLowerCase())+' (PM2.5 '+Math.round(a.pm2_5)+' µg/m³)':'')+'</p>'+note+'</div>'}
function list(P){const u=unmapped();
  return '<details class="cmplist"><summary>All stairways, as a list</summary>'+['MILD','MODERATE','VIGOROUS'].map(c=>'<p><b>'+CN[c]+'</b></p><ul>'
    +R().filter(s=>s.appCategory===c).map(s=>{const i=P.findIndex(g=>g.L.includes(s));
      return '<li>'+(i<0?'<button type="button" class="g sm cmplu" data-a="cmpun" data-id="'+s.id+'">'+esc(s.name)+' <small>no coordinates recorded</small></button>':'<button type="button" class="g sm cmplb" data-a="cmpsel" data-i="'+i+'">'+esc(s.name)+'</button>')+'</li>'}).join('')+'</ul>').join('')
    +(u.length?'<p class="mut">'+u.length+' stairways have no coordinates in the app data, so they are not on the map. You can still pick them here.</p>':'')+'</details>'}
function where(P){if(!V.me)return '';const near=P.map(g=>({g,d:dist(V.me.lat,V.me.lng,g.lat,g.lng)})).sort((a,b)=>a.d-b.d)[0];
  return '<p class="cmpyou">'+(near&&near.d<1500?'The nearest mapped stairway is <b>'+esc(near.g.L[0].name)+'</b>, about '+fmtD(near.d)+' away (± '+Math.round(V.me.acc)+' m).'
    :'You are about '+fmtD(near?near.d:0)+' from the campus stairways, so you are not shown on the map. Pick a stairway below instead.')+' Your position is used on this screen only: it is not saved or sent.</p>'}
function page(){const P=points(),pr=proj(P);
  return '<div class="card cmpcard" id="cmpcard"><p>The campus stairways on one map. Tap a marker, or open the list, to see a stairway and your own climbs there.</p>'
    +'<p class="warn cmpwarn" role="note"><b>Locations are not verified.</b> They come from the original app data and have no recorded source. One stairway can be off by a little or a lot; check before relying on it.</p>'
    +mapView(P,pr)+'<p class="mut cmpsv">'+esc(HWCampusData.surveyNote())+'</p>'+detail(P)
    +'<div class="row"><button type="button" data-a="cmpgps"'+(V.gps==='wait'?' disabled':'')+'>'+(V.gps==='wait'?'FINDING YOU...':'SHOW WHERE I AM')+'</button>'+(V.me?'<button type="button" class="g" data-a="cmpforget">HIDE MY POSITION</button>':'')+'</div>'
    +(V.err?'<p class="cmpe" role="alert">'+esc(V.err)+' Pick a stairway on the map or in the list instead.</p>':V.note?'<p class="mut cmpnote">'+esc(V.note)+'</p>':'')+where(P)
    +list(P)+weather()
    +'<div class="cmpwx"><b>'+ico('map')+' Campus-wide activity</b><p class="mut">Not available. HealthWiz does not collect anyone else\'s location, so there is nothing to show here. Your own visits stay on your device.</p></div></div>'}

/* ---------- actions ---------- */
const keep=()=>{persist();const y=window.scrollY;render();window.scrollTo(0,y)};
const toDet=()=>{const e=$('#cmpdet');if(e){e.focus({preventScroll:true});e.scrollIntoView({block:'nearest',behavior:HWUI.reduced()?'auto':'smooth'})}};
acts.cmpgo=()=>go('campus');
acts.cmpsel=d=>{const g=points()[+d.i];if(!g)return;V.sid=g.L[0].id;keep();toDet()};
acts.cmpun=d=>{if(!HWCampusData.record(d.id))return;V.sid=d.id;keep();toDet()};
acts.cmpstair=d=>{if(!HWCampusData.record(d.id))return;V.sid=d.id;persist();HWCampusData.start(d.id)};
acts.cmpzoom=()=>{const k=V.z>1?.5:2;V.z=V.z>1?1:2;V.px*=k;V.py*=k;clampPan();keep()};
acts.cmpcentre=()=>{V.px=V.py=0;keep()};
const clampPan=()=>{const m=60*V.z;V.px=Math.max(-m,Math.min(m,V.px));V.py=Math.max(-m,Math.min(m,V.py))};
/** Centre the map on a point (zoomed in): the pan layer moves by percent of the map's own size. */
function centreOn(g){V.z=2;V.px=V.py=0;const[x,y]=proj(points()).at(g);V.px=50-x;V.py=50-y;clampPan()}
/** Select a staircase from elsewhere: centre the map on it, or with no coordinates show it without moving the map. */
function focus(id){const s=HWCampusData.record(id);if(!s)return false;V.sid=id;const P=points(),i=selIdx(P);if(i!=null)centreOn(P[i]);persist();return true}
// dragging the map: the layer follows the pointer; a drag never counts as a tap on a marker
{let d=null,moved=0;
  D0.addEventListener('pointerdown',e=>{const m=e.target.closest&&e.target.closest('.cmpmap');if(!m||e.button>0||e.target.closest('.cmpctl'))return;const r=m.getBoundingClientRect();
    d={x:e.clientX,y:e.clientY,px:V.px,py:V.py,w:r.width,h:r.height,id:e.pointerId,m};moved=0});
  D0.addEventListener('pointermove',e=>{if(!d||e.pointerId!==d.id)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(!moved&&Math.hypot(dx,dy)<6)return;
    if(!moved){moved=1;try{d.m.setPointerCapture(e.pointerId)}catch(_){}}e.preventDefault();
    V.px=d.px+dx/d.w*100;V.py=d.py+dy/d.h*100;clampPan();const l=d.m.querySelector('.cmppan');if(l)l.style.transform='translate('+V.px.toFixed(2)+'%,'+V.py.toFixed(2)+'%)'});
  const end=e=>{if(!d||e.pointerId!==d.id)return;const was=moved;d=null;if(was){persist();setTimeout(()=>{moved=0},0);const c=$('.cmpctl');if(c&&!c.querySelector('[data-a="cmpcentre"]'))keep()}};
  D0.addEventListener('pointerup',end);D0.addEventListener('pointercancel',end);
  D0.addEventListener('click',e=>{if(moved&&e.target.closest&&e.target.closest('.cmpmap')){e.stopPropagation();e.preventDefault();moved=0}},true)}
acts.cmpforget=()=>{V.me=null;V.err='';keep()};
/** Ask for one position (SHOW WHERE I AM only; auto is no longer used: the owner chose location only on tap). On campus
    the nearest mapped stairway is selected and the map centres on it. */
function locate(auto){const g=navigator.geolocation;V.err='';V.note='';
  const fail=m=>{if(auto)V.note='I could not find you automatically ('+m.replace(/\.$/,'').toLowerCase()+'). Pick a stairway, or tap SHOW WHERE I AM.';else V.err=m;if(S.v==='campus')keep()};
  if(!window.isSecureContext)return fail('Location needs a secure (https) page.');
  if(!g)return fail('This browser cannot share a location.');
  V.gps='wait';if(!auto)keep();
  g.getCurrentPosition(p=>{V.gps='';const c=p.coords;V.me={lat:c.latitude,lng:c.longitude,acc:c.accuracy||0};
      const P=points(),near=P.map((q,i)=>({i,d:dist(V.me.lat,V.me.lng,q.lat,q.lng)})).sort((a,b)=>a.d-b.d)[0];
      if(near&&near.d<1500){V.sid=P[near.i].L[0].id;centreOn(P[near.i]);persist()}
      if(S.v==='campus')keep()},
    e=>{V.gps='';fail(e&&e.code===1?'Location permission is off for HealthWiz.':e&&e.code===3?'Finding your position took too long.':'Your position is not available right now.')},
    {enableHighAccuracy:true,timeout:20000,maximumAge:0})}
acts.cmpgps=()=>locate(0);

/* ---------- the page, and its door in the Health Hall (after the Science Laboratory's) ---------- */
pages.campus=()=>page();
PAR.campus='health';
BN.campus=['🗺','Campus Health Observatory','The campus stairways, your climbs, the air outside.','rgba(92,192,90,.20)'];
DIS.campus='Locations are unverified app data. Your position is shown on this screen only and is never saved or sent.';
const door=()=>'<div class="card cmpdoor" id="cmp-door"><h3>'+ico('map')+' CAMPUS HEALTH OBSERVATORY</h3><p>See the campus stairways on a map, find the nearest one, and check the air before you go.</p><button type="button" data-a="cmpgo">OPEN THE OBSERVATORY</button></div>';
{const p=pages.health;pages.health=function(){return p.apply(this,arguments)+door()}}
HWEvents.on('data:reset',()=>{V.sid=null;V.me=null;V.z=1;V.px=V.py=0;try{sessionStorage.removeItem(VK)}catch(e){}});
HWEvents.on('live:updated',()=>{if(S.v==='campus'){const y=window.scrollY;render();window.scrollTo(0,y)}});

HWUI.css('campus',`
.cmpmap{position:relative;width:100%;aspect-ratio:3/2;border-radius:14px;overflow:hidden;border:1px solid var(--edge,var(--ln));box-shadow:0 0 22px rgba(139,92,240,.25),inset 0 0 30px rgba(0,0,0,.25);background:#4f8a45;margin:8px 0 4px}
.cmpmap{touch-action:none;cursor:grab;user-select:none;background:#5f9d4e}.cmpmap::after{content:"";position:absolute;inset:0;border:2px solid #f6c94f;border-radius:14px;pointer-events:none;z-index:5}.cmpmap:active{cursor:grabbing}.cmppan{position:absolute;inset:0}
.cmpmap svg{position:absolute;inset:0;width:100%;height:100%}.cmpctl{position:absolute;right:8px;bottom:8px;z-index:4;display:flex;gap:6px}.cmpctl button{min-height:44px;margin:0}
.cmpm{position:absolute;width:30px;height:30px;min-height:30px;margin:-15px 0 0 -15px;padding:0;border-radius:50%;font:bold 12px/1 var(--fb,sans-serif);color:#10091f;border:3px solid #1b1745;
  background-image:none;box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 12px var(--cmpc);animation:cmpglow 2.4s steps(4) infinite alternate;z-index:1}
.cmpm.cmp1,.cmpk.cmp1{--cmpc:#5cc05a;background-color:#7ee07c}.cmpm.cmp2,.cmpk.cmp2{--cmpc:#f6c94f;background-color:#f6c94f}.cmpm.cmp3,.cmpk.cmp3{--cmpc:#ff6b5e;background-color:#ff8a7e}
.cmpm.vis{outline:3px solid #63e6dc;outline-offset:2px}.cmpm.on{z-index:2;transform:scale(1.2);box-shadow:0 0 0 3px #fff0a8,0 0 18px #fff0a8}
@keyframes cmpglow{to{box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 20px var(--cmpc)}}
.cmpme{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#4db3ff;border:3px solid #fff;box-shadow:0 0 0 6px rgba(77,179,255,.35);z-index:3}
.cmpscale{position:absolute;left:62px;bottom:10px;width:60%;color:#fff0a8;text-shadow:0 1px 0 #120f33}.cmpscale i{display:block;height:4px;border:1px solid #fff0a8;border-top:0}.cmpscale small{font-size:11px}
.cmpunv{margin:0 0 2px;font-size:12px;color:var(--mut);text-align:right}.cmpn{position:absolute;right:-8px;top:-8px;font:bold 10px/1 sans-serif;background:#fff0a8;color:#10091f;border-radius:8px;padding:2px 3px;border:1px solid #10091f}

.cmpleg{font-size:13px}.cmpk{display:inline-block;width:18px;height:18px;border-radius:50%;text-align:center;font:bold 11px/18px sans-serif;color:#10091f;vertical-align:-3px}
.cmpdet{border:1px solid var(--edge,var(--ln));border-radius:12px;padding:10px;margin:8px 0;background:var(--p2)}.cmpdet ul{list-style:none;padding:0;margin:6px 0}.cmpdet li{margin:6px 0;overflow-wrap:anywhere}
.cmpdet button,.cmpcard .row button,.cmplb{min-height:44px}.cmpe{color:var(--red);font-weight:bold}
.cmpwx{border-top:1px solid var(--edge,var(--ln));padding-top:8px;margin-top:10px}.cmpwx svg,.cmpdet b svg{vertical-align:-3px}
.cmplu small{opacity:.8}.cmplab{color:var(--mut)}
.cmplist ul{list-style:none;padding:0;margin:4px 0;display:flex;flex-wrap:wrap;gap:6px}.cmplist summary{cursor:pointer;min-height:44px;display:flex;align-items:center}
html.hw-rm .cmpm,html.hw-q-performance .cmpm{animation:none}@media(prefers-reduced-motion:reduce){.cmpm{animation:none}.cmpm.on{transform:none}}
`);
return{points,unmapped,proj,UNV,focus,get selected(){return V.sid},get state(){return{sel:selIdx(points()),sid:V.sid,me:V.me,err:V.err,note:V.note,z:V.z,px:V.px,py:V.py}}}})();
