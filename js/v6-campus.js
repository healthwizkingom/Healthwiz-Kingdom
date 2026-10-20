/* v6: the Campus Health Observatory (route 'campus', door in the Health Hall), integration Phase 2. Not part of the
   original. Replaces the 2D map of js/v6-observatory.js (deleted, owner decision 2026-10-20) with the prototype's map
   (prototypes/campus-observatory): OpenStreetMap data, Realistic and Fantasy modes, the illustrative terrain, markers
   with clustering, search, filters, the list and the details in three groups.
   * This classic script is the page: state, list, details, links, and the fallback. The map itself is an ES module
     (observatory/main.js + observatory/map.js, MapLibre GL JS 4.7.1 in vendor/), loaded with a module script tag only
     when the page opens over http(s) with WebGL. Opened from the device (file://), as the single-file build, or
     without WebGL, the page says why and the list and details work the same, with no request for anything.
   * Records: js/v6-campus-data.js (STAIRS + the F21 step sizes + data/stair-survey.json). Staircases that share a stored
     coordinate are one marker; a staircase with no coordinates is listed and selectable, never placed.
   * The map is one element kept alive across redraws: render() replaces #main, and the element is moved back into
     the page's slot after each one. Leaving the page frees it (map.remove(): WebGL, timers, markers).
   * Kept for this tab in sessionStorage 'hw_obs_view' (owner decision 4): the selected staircase, the camera, the mode,
     terrain and building switches, the open tab, the filter and the search. Refresh and Back keep the app's behaviour.
   * FULL SCREEN (the owner's request, 2026-10-20): the map fills the whole window (a fixed layer over the app, which
     also works on phones where the browser cannot make an element full screen); the selection bar keeps a DETAILS
     button that leaves full screen for the details. Escape or the same button closes it; it is kept for the tab.
   * Location only on tap (decision 2): SHOW WHERE I AM asks once; on campus the nearest placed staircase is selected.
     The position is shown on this screen only: never saved, never sent, not kept for the tab.
   * HWCampus.focus(id): select a staircase from elsewhere (FIND ON OBSERVATORY, RETURN TO OBSERVATORY): the map flies
     to it, or with no coordinates its details open without moving the map. START STAIR SESSION opens the Stairs page
     with it chosen (HWCampusData.start); it never starts a session. Nothing here writes to the save. */
const HWCampus=(()=>{
const ico=(n,s)=>HWPixel.icon(n,s||1),D0=document,$id=i=>D0.getElementById(i);
// two of the prototype's pixel sprites (js/pixel.js) for the terrain and buildings switches: one character = one pixel
const SPR={peak:['....i.....','...iii....','...i.ii...','..i...i.i.','..i....iii','.i......ii','.i.......i','iiiiiiiiii'],
  block:['...iiii...','.ii....ii.','i..iiii..i','i.i....i.i','i..iiii..i','i...ii...i','i...ii...i','i...ii...i','.ii.ii.ii.','...iiii...']};
const spr=n=>{const r=SPR[n];return '<svg viewBox="0 0 '+r[0].length+' '+r.length+'" aria-hidden="true" focusable="false" shape-rendering="crispEdges">'+r.map((row,y)=>row.split('').map((c,x)=>c==='i'?'<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="currentColor"/>':'').join('')).join('')+'</svg>'};
const CN={MILD:'Mild',MODERATE:'Moderate',VIGOROUS:'Vigorous'},CK={MILD:1,MODERATE:2,VIGOROUS:3};
const UNV='Unverified: from the original app data';
const dist=(a,b,c,d)=>HWGps.dist(a,b,c,d);
const fmtD=m=>m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(1)+' km';
const R=()=>HWCampusData.records(),rec=id=>HWCampusData.record(id),placed=s=>HWCampusData.placed(s);
const keyOf=s=>s.latitude.toFixed(7)+','+s.longitude.toFixed(7);

/* ---------- the points: staircases that share a coordinate are one marker ---------- */
function points(){const G=new Map();R().filter(placed).forEach(s=>{const k=keyOf(s);if(!G.has(k))G.set(k,{key:k,lat:s.latitude,lng:s.longitude,items:[]});G.get(k).items.push(s)});
  return Array.from(G.values())}
const unmapped=()=>R().filter(s=>!placed(s));

/* ---------- state: kept for this tab (no position, no health data) ---------- */
const VK='hw_obs_view',FILTERS=['all','map','nol','part','flag'];
const V={sid:null,grp:null,mode:'fantasy',cam:null,terr:true,bld:true,full:false,tab:'list',f:'all',q:'',me:null,gps:'',err:'',fly:false};
try{const o=JSON.parse(sessionStorage.getItem(VK)||'null');if(o&&typeof o==='object'){
  if(typeof o.sid==='string')V.sid=o.sid;if(typeof o.grp==='string')V.grp=o.grp;if(o.mode==='realistic')V.mode='realistic';
  if(o.cam&&Array.isArray(o.cam.c)&&o.cam.c.length===2&&o.cam.c.every(isFinite)&&isFinite(o.cam.z))V.cam={c:o.cam.c.map(Number),z:+o.cam.z,b:+o.cam.b||0,p:+o.cam.p||0};
  if(o.terr===false)V.terr=false;if(o.bld===false)V.bld=false;if(o.full===true)V.full=true;if(o.tab==='det')V.tab='det';if(FILTERS.indexOf(o.f)>=0)V.f=o.f;if(typeof o.q==='string')V.q=o.q.slice(0,80)}}catch(e){}
const persist=()=>{if(M.ctl&&M.ctl.ready)V.cam=M.ctl.camera();try{sessionStorage.setItem(VK,JSON.stringify({sid:V.sid,grp:V.grp,mode:V.mode,cam:V.cam,terr:V.terr,bld:V.bld,full:V.full,tab:V.tab,f:V.f,q:V.q}))}catch(e){}};
const selKey=()=>{if(V.grp)return V.grp;const s=V.sid&&rec(V.sid);return s&&placed(s)?keyOf(s):null};

/* ---------- the map: availability, loading, one element across redraws ---------- */
const M={st:'off',msg:'',host:null,ctl:null,mod:null,gen:0}; // st: off | loading | ready | error
let GL=null;
const web=()=>/^https?:$/.test(location.protocol);
function hasGL(){if(GL==null){try{const c=D0.createElement('canvas');GL=!!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){GL=false}}return GL}
/** Why the map cannot run here, or '' when it can. Checked without any request. */
function why(){if(!web())return 'file';if(typeof Promise==='undefined'||!('noModule' in D0.createElement('script')))return 'old';if(!hasGL())return 'gl';return ''}
const WHY={file:'The campus map needs the app to be opened from its web address (https). Opened from this device or as the single-file copy, it cannot load the map, so the staircases are listed below with their details.',
  old:'This browser cannot load the campus map. The staircases are listed below with their details.',
  gl:'The campus map needs WebGL, which this browser could not start. The staircases are listed below with their details.'};
function loadModule(){if(window.HWObsMap)return Promise.resolve(window.HWObsMap);if(M.mod)return M.mod;
  M.mod=new Promise((ok,no)=>{const s=D0.createElement('script');s.type='module';s.src='observatory/main.js';s.dataset.hwobs='main';
    const done=()=>{removeEventListener('hwobs:ready',done);window.HWObsMap?ok(window.HWObsMap):no(new Error('the map module did not start'))};
    addEventListener('hwobs:ready',done);s.onerror=()=>{removeEventListener('hwobs:ready',done);s.remove();M.mod=null;no(new Error('the map module could not be loaded'))};D0.head.appendChild(s)});
  return M.mod}
const pad=()=>({top:64,bottom:40,left:24,right:72});
const fsClass=()=>D0.documentElement.classList.toggle('cmp-fs',!!(V.full&&S.v==='campus'&&!why()&&M.st!=='error'));
function mount(){fsClass();const slot=$id('cmpmapslot');if(!slot||why())return;
  if(!M.host){M.host=D0.createElement('div');M.host.className='cmpmap';M.host.setAttribute('aria-label','Campus map with illustrative terrain. Drag to move, pinch or scroll to zoom, two fingers to rotate and tilt. Tab to a staircase marker and press Enter.')}
  if(M.host.parentNode!==slot)slot.appendChild(M.host);
  if(M.st==='off'){M.st='loading';M.msg='';const g=++M.gen;paintMsg();
    loadModule().then(X=>X.create({container:M.host,groups:points(),cam:V.cam,mode:V.mode,terr:V.terr,bld:V.bld,padding:pad,reduced:()=>HWUI.reduced(),
      onSelect:t=>{if(t&&t.group)pickGroup(t.group);else if(t&&t.id)pick(t.id,'map')},onCamera:c=>{V.cam=c;persist()},
      onReady:()=>{if(g!==M.gen)return;M.st='ready';paintMsg();sync();const b=$id('cmptilt');if(b)b.setAttribute('aria-pressed',String(M.ctl.map.getPitch()>5))},
      onError:m=>{if(g!==M.gen)return;fail(m)}})).then(c=>{if(g!==M.gen){c.destroy();return}M.ctl=c;if(c.ready){M.st='ready';paintMsg();sync()}})
      .catch(e=>{if(g!==M.gen)return;fail('The campus map could not be loaded ('+String(e&&e.message||e).slice(0,120)+'). The staircases are listed with their details.')})}
  else if(M.ctl){M.ctl.resize();sync()}else paintMsg()}
function fail(m){M.st='error';M.msg=m;if(M.ctl){M.ctl.destroy();M.ctl=null}if(M.host){M.host.remove();M.host=null}if(S.v==='campus')keep()}
function unmount(){M.gen++;if(M.ctl){persist();M.ctl.destroy()}M.ctl=null;if(M.host)M.host.remove();M.host=null;M.st='off';M.msg=''}
/** The loading / failure note over the map, changed in place (no redraw). */
function paintMsg(){const e=$id('cmpmsg');if(!e)return;e.hidden=M.st==='ready';e.textContent=M.st==='error'?M.msg:'Loading the campus map…'}
/** Make the map match the state: the highlighted marker, and a pending fly to the selection. */
function sync(){const c=M.ctl;if(!c||!c.ready)return;const k=selKey();c.select(k);if(V.fly&&k){V.fly=false;c.flyToGroup(k)}else if(V.fly)V.fly=false;
  if(V.me&&c.near(V.me.lng,V.me.lat))c.me(V.me)}

/* ---------- list ---------- */
const FL={all:['All',()=>true],map:['On the map',placed],nol:['No location',s=>!placed(s)],part:['Step size measured',s=>!!s.measuredStep],flag:['Needs checking',s=>!!s.needsChecking]};
let FAC=null; // computed facts (nearest named OSM place, illustrative zone) once the map data is loaded
const facts=s=>{if(!placed(s)||!window.HWObsMap||!window.HWObsMap.loaded)return null;FAC=FAC||{};const k=s.id+'@'+keyOf(s);return FAC[k]||(FAC[k]=window.HWObsMap.facts(s.longitude,s.latitude))};
const hay=s=>{const f=facts(s);return(s.id+' '+s.name+' '+s.appFloorLabel+' '+(f&&f.near?f.near.name:'')+' '+(f&&f.zone?f.zone.name+' '+f.zone.region:'')).toLowerCase()};
function shown(){const fn=FL[V.f][1],q=V.q.trim().toLowerCase();return R().filter(fn).filter(s=>!q||q.split(/\s+/).every(w=>hay(s).indexOf(w)>=0))}
const dot=s=>placed(s)?'<span class="cmpdot c'+CK[s.appCategory]+'" aria-hidden="true">'+CK[s.appCategory]+'</span>':'<span class="cmpdot nol" aria-hidden="true">?</span>';
function items(L){return L.length?L.map(s=>'<li><button type="button" class="g cmpitem" data-a="cmppick" data-id="'+s.id+'"'+(V.sid===s.id?' aria-current="true"':'')+'>'+dot(s)
    +'<span class="cmpnm">'+esc(s.name)+'</span><span class="cmpmeta"><b>'+s.id+'</b><span>θ '+s.estimatedAngle.toFixed(2)+'° '+(s.measuredStep?'(from measured steps)':'(estimated)')+'</span>'
    +'<span>'+(!placed(s)?'No location recorded':s.locationStatus==='measured'?'Measured location':'Estimated location')+'</span>'+(s.measurementStatus==='surveyed'?'<span>Surveyed</span>':'')+'</span></button></li>').join('')
  :'<li class="mut">No staircase matches. Try another word or filter.</li>'}
const countTxt=L=>L.length===R().length?R().length+' staircases':'Showing '+L.length+' of '+R().length;
function listPane(){const L=shown(),u=unmapped().length;
  return '<div class="cmpsearch"><label for="cmpq" class="cmpvh">Search staircases</label><input id="cmpq" type="search" value="'+esc(V.q)+'" placeholder="Search by name, ID or building (e.g. ST14, Kenanga)" autocomplete="off">'
    +(V.q?'<button type="button" class="cmpqx" data-a="cmpqx" aria-label="Clear the search">×</button>':'')+'</div>'
    +'<div class="cmpfilters" role="group" aria-label="Filter">'+FILTERS.map(k=>'<button type="button" class="g cmpf" data-a="cmpfilt" data-f="'+k+'" aria-pressed="'+(V.f===k)+'">'+FL[k][0]+' <span>'+R().filter(FL[k][1]).length+'</span></button>').join('')+'</div>'
    +'<p class="cmpcount" id="cmpcount" aria-live="polite">'+countTxt(L)+'</p><ul class="cmplist" id="cmplist">'+items(L)+'</ul>'
    +(u?'<p class="mut cmpsmall">'+u+' staircases have no coordinates in the app data, so they are not on the map. You can still pick them here.</p>':'')}

/* ---------- details: three groups (location, staircase profile, data quality), as in the prototype ---------- */
const chip=(c,t)=>'<li class="cmpchip '+c+'">'+esc(t)+'</li>';
const na=t=>'<dd class="cmpna">'+esc(t)+'</dd>';
const grp=(icon,title,body)=>'<section class="cmpgrp"><h3>'+ico(icon)+' '+title+'</h3>'+body+'</section>';
const n2=v=>v==null?'':esc(v);
const distM=(a,b)=>dist(a.latitude,a.longitude,b.latitude,b.longitude);
function details(s){const m=s.measuredStep,f=facts(s),v=s.survey,a=HWCampusData.activity(s.id),FS=s.flightsSurveyed||[];
  let loc='<dl class="cmpfacts"><dt>Coordinates</dt>'+(placed(s)?'<dd class="cmpnum">'+s.latitude+', '+s.longitude+'<span class="cmpsrc">'+(s.locationStatus==='measured'?'Measured location · ':'Estimated location · ')+esc(s.locationSource)+'</span></dd>':na('No location recorded, so it is not placed on the map.'));
  if(s.app&&s.locationStatus==='measured'&&s.app.latitude!=null)loc+='<dt>App estimate</dt><dd class="cmpnum">'+s.app.latitude+', '+s.app.longitude+'<span class="cmpsrc">The original app coordinate (unverified), about '+Math.round(distM(s.app,s))+' m from the measured point. No longer used on the map.</span></dd>';
  if(v&&(v.building||v.indoorOutdoor||v.lowerLevel||v.upperLevel))loc+='<dt>Building, levels</dt><dd>'+esc([v.building,v.indoorOutdoor].filter(Boolean).join(' · ')||'–')+(v.lowerLevel||v.upperLevel?' · from '+esc(v.lowerLevel||'?')+' to '+esc(v.upperLevel||'?'):'')+'<span class="cmpsrc">'+esc(v.label)+'</span></dd>';
  if(s.sharedLocationWith.length)loc+='<dt>Same point as</dt><dd>'+s.sharedLocationWith.map(id=>'<button type="button" class="cmplnk" data-a="cmppick" data-id="'+id+'">'+id+'</button>').join(', ')+'<span class="cmpsrc">These records store the identical coordinate.</span></dd>';
  if(f&&f.near)loc+='<dt>Nearest OSM place</dt><dd>'+(f.near.inside?'Inside the outline of ':'About '+Math.round(f.near.d)+' m from ')+'<b>'+esc(f.near.name)+'</b><span class="cmpsrc">Computed from the '+(s.locationStatus==='measured'?'measured':'estimated')+' location and OpenStreetMap outlines. Not a survey.</span></dd>';
  if(f)loc+='<dt>Map terrain</dt><dd>'+(f.zone?esc(f.zone.name)+' ('+esc(f.zone.region)+')':'Base level')+'<span class="cmpsrc">Illustrative zone from the owner\'s annotated screenshot. Not a measured elevation.</span></dd>';
  loc+='<dt>Floor label</dt><dd>"'+esc(s.appFloorLabel||'–')+'"<span class="cmpsrc">App data; its meaning on site is not documented.</span></dd></dl>';
  let pro='<dl class="cmpfacts">';
  if(s.surveyAngle!=null)pro+='<dt>Angle θ (survey)</dt><dd class="cmpnum">'+s.surveyAngle.toFixed(2)+'°<span class="cmpsrc">Calculated: θ = arctan(riser ÷ tread) per flight from the survey sheet, mean over its steps (the F21 method).</span></dd>';
  pro+='<dt>'+(s.surveyAngle!=null?'Angle θ (app)':'Angle θ')+'</dt><dd class="cmpnum">'+s.estimatedAngle.toFixed(2)+'°<span class="cmpsrc">'+(m?'Calculated from measured step rise and run':'Estimated')+' · '+esc(s.angleSource)+'</span></dd>';
  pro+='<dt>Step size</dt>'+(m?'<dd class="cmpnum">rise '+m.rise_m.toFixed(3)+' m · run '+m.run_m.toFixed(3)+' m · hypotenuse '+m.hypotenuse_m.toFixed(3)+' m<span class="cmpsrc">Measured · '+esc(m.source)+', Staircase '+esc(m.reportStaircase)+' ('+esc(m.reportName)+')</span></dd>':na('Measurements unavailable'));
  pro+='<dt>Orientation</dt>'+(s.orientationDeg!=null?'<dd>'+s.orientationDeg+'° from north<span class="cmpsrc">'+(s.orientationStatus==='measured'?'Measured orientation':'Estimated orientation')+' · '+esc(s.orientationSource||'source not recorded')+'</span></dd>':na('Not yet surveyed'));
  pro+='<dt>Step count</dt>'+(s.stepCount!=null?'<dd>'+s.stepCount+'<span class="cmpsrc">'+esc(s.stepCountSource||'')+'</span></dd>':na('Measurements unavailable'));
  pro+='<dt>Flights, landings</dt>'+(FS.length?'<dd>'+FS.length+' flight'+(FS.length>1?'s':'')+(v&&v.shape?' · '+esc(v.shape)+' shape':'')+(v&&v.complete&&!v.complete.flights?' · <b>incomplete</b>':'')+'<span class="cmpsrc">'+esc(v.label)+'</span></dd>':na('Not yet surveyed'));
  pro+='<dt>Vertical rise</dt>'+(s.verticalRise_m!=null?'<dd class="cmpnum">'+s.verticalRise_m+' m<span class="cmpsrc">'+esc(s.verticalRiseStatus||'')+'</span></dd>':na('Measurements unavailable'))+'</dl>';
  if(FS.length)pro+='<div class="tscroll"><table class="tbl cmpftab"><caption>Flights (survey sheet; blank = not measured)</caption><thead><tr><th>#</th><th>Risers</th><th>Riser cm</th><th>Tread cm</th><th>θ</th><th>Width cm</th><th>Heading</th><th>Then</th></tr></thead><tbody>'
    +FS.map(x=>'<tr><td>'+n2(x.flight)+'</td><td>'+n2(x.risers)+'</td><td>'+n2(x.riser_cm)+'</td><td>'+n2(x.tread_cm)+'</td><td>'+(x.angle_deg!=null?x.angle_deg+'°':'')+'</td><td>'+n2(x.width_cm)+'</td><td>'+(x.heading_deg!=null?x.heading_deg+'°':'')+'</td><td>'+n2(x.turn)+'</td></tr>').join('')+'</tbody></table></div>';
  const ch=HWCampusData.labels(s).map(l=>chip(l[0],l[1])).join('');
  let q='<ul class="cmpchips">'+ch+'</ul><dl class="cmpfacts"><dt>Verification</dt><dd>'+esc(s.verification.status)+'</dd><dt>App category</dt><dd>'+CN[s.appCategory]+'<span class="cmpsrc">The HealthWiz app\'s own label, not a measurement.</span></dd></dl>';
  if(s.notes)q+='<p class="cmpnotes">'+esc(s.notes)+'</p>';
  const mine='<p class="cmpmine">'+(a.sessions?'You saved '+a.sessions+' stair session'+(a.sessions>1?'s':'')+' here (last '+esc(a.last)+')':'No stair sessions saved here yet')+(a.firstCheckIn?' · first GPS check-in '+esc(a.firstCheckIn):'')+'</p>';
  return '<button type="button" class="cmpback" data-a="cmptab" data-t="list">‹ All staircases</button><p class="cmpeye">'+s.id+' · '+CN[s.appCategory]+'</p><h3 class="cmph" tabindex="-1">'+esc(s.name)+'</h3>'+mine
    +'<div class="row cmpact"><button type="button" data-a="cmpstair" data-id="'+s.id+'">START STAIR SESSION</button>'+(placed(s)&&M.st==='ready'?'<button type="button" class="g" data-a="cmpshow">SHOW ON MAP</button>':'')+'</div>'
    +grp('map','Location',loc)+grp('stairs','Staircase profile',pro)+grp('scroll','Data quality',q)}
function chooser(g){return '<button type="button" class="cmpback" data-a="cmptab" data-t="list">‹ All staircases</button><p class="cmpeye">Shared point</p><h3 class="cmph" tabindex="-1">'+g.items.length+' staircases at one stored point</h3>'
  +'<p class="mut cmpsmall">'+g.lat+', '+g.lng+' · '+esc(g.items[0].locationStatus==='measured'?'Measured location (survey)':'Estimated location (app data)')+'. These records store the identical coordinate; on site they are probably separate stairs. Pick one.</p>'
  +'<ul class="cmplist">'+g.items.map(s=>'<li><button type="button" class="g cmpitem" data-a="cmppick" data-id="'+s.id+'">'+dot(s)+'<span class="cmpnm">'+esc(s.name)+'</span><span class="cmpmeta"><b>'+s.id+'</b><span>'+esc(s.appFloorLabel)+'</span></span></button></li>').join('')+'</ul>'}
function detPane(){const g=V.grp&&points().find(x=>x.key===V.grp),s=!g&&V.sid&&rec(V.sid);
  return '<div class="cmpdet" id="cmpdet" tabindex="-1" role="region" aria-label="Selected staircase">'+(g?chooser(g):s?details(s):'<p class="mut">Pick a staircase on the map or in the list.</p>')+'</div>'}

/* ---------- the page ---------- */
function stage(){const w=why(),s=V.sid&&rec(V.sid),g=V.grp&&points().find(x=>x.key===V.grp),on=(k,v)=>' aria-pressed="'+!!v+'"';
  if(w)return '<div class="cmpstage cmpoff" id="cmpstage"><div class="cmpnomap" id="cmpnomap" role="note">'+ico('map')+' '+esc(WHY[w])+'</div></div>';
  if(M.st==='error')return '<div class="cmpstage cmpoff" id="cmpstage"><div class="cmpnomap" id="cmpnomap" role="alert">'+esc(M.msg)+'</div></div>';
  const pill=s||g?'<div class="cmppill" role="status" aria-live="polite"><span class="cmppd" aria-hidden="true"></span><span class="cmppt"><b>'+(g?g.items.length+' staircases':s.id)+'</b><span>'+esc(g?'at one stored point':s.name)+'</span></span>'
    +(V.full?'<button type="button" class="cmpsb" data-a="cmpdetfs">Details</button>':'')+'<button type="button" class="cmpsb" data-a="cmpfit">Campus view</button><button type="button" class="cmpsx" data-a="cmpclear" aria-label="Clear the selection">×</button></div>':'';
  const b=(a,lab,t,x)=>'<button type="button" class="cmpctl" data-a="'+a+'" aria-label="'+lab+'" title="'+lab+'"'+(x||'')+'>'+t+'</button>';
  return '<div class="cmpstage'+(V.full?' cmpfull':'')+'" id="cmpstage"'+(V.full?' role="dialog" aria-modal="true" aria-label="Campus map, full screen"':'')+'><div class="cmpslot" id="cmpmapslot"></div>'
    +'<div class="cmpmodes" role="group" aria-label="Map style"><button type="button" class="cmpmode" data-a="cmpmode" data-m="fantasy"'+on(0,V.mode==='fantasy')+'>Fantasy</button><button type="button" class="cmpmode" data-a="cmpmode" data-m="realistic"'+on(0,V.mode==='realistic')+'>Realistic</button></div>'
    +pill+'<div class="cmpctls" role="toolbar" aria-label="Map controls">'+b('cmpzin','Zoom in','+')+b('cmpzout','Zoom out','−')+b('cmpnorth','North up','N')
    +b('cmptilt','Tilted 3D view','3D',' id="cmptilt" aria-pressed="'+(M.ctl&&M.ctl.ready?M.ctl.map.getPitch()>5:!V.cam||V.cam.p>5)+'"')+b('cmpterr','Illustrative terrain',spr('peak'),on(0,V.terr))
    +b('cmpbld','Raised buildings (illustrative heights)',spr('block'),on(0,V.bld))+b('cmpfit','Whole campus view',ico('map'))
    +b('cmpfull',V.full?'Leave full screen':'Full screen map',ico('expand'),' id="cmpfullb" aria-pressed="'+V.full+'"')+'</div>'
    +'<details class="cmpleg"><summary>Legend</summary><p><span class="cmplg m1"></span>Mild <span class="cmplg m2"></span>Moderate <span class="cmplg m3"></span>Vigorous <small>(app category)</small></p>'
    +'<p><span class="cmplg est"></span>Estimated location <span class="cmplg part"></span>Step size measured (F21) or surveyed</p><p><span class="cmplg ter"></span>Raised ground: illustrative heights from the owner\'s annotated screenshot, not measured</p>'
    +'<p><span class="cmplg osm"></span>Buildings, paths, fields: OpenStreetMap. Building heights are illustrative.</p>'+(V.mode==='fantasy'?'<p><span class="cmplg deco"></span>Roofs, turrets, trees, lanterns and glows are decoration on the real OSM outlines</p>':'')+'</details>'
    +'<div class="cmpmsg" id="cmpmsg" role="status"'+(M.st==='ready'?' hidden':'')+'>'+esc(M.st==='error'?M.msg:'Loading the campus map…')+'</div></div>'}
function where(){if(!V.me)return '';const P=points(),near=P.map(g=>({g,d:dist(V.me.lat,V.me.lng,g.lat,g.lng)})).sort((a,b)=>a.d-b.d)[0];
  return '<p class="cmpyou">'+(near&&near.d<1500?'The nearest mapped staircase is <b>'+esc(near.g.items[0].name)+'</b>, about '+fmtD(near.d)+' away (± '+Math.round(V.me.acc)+' m).'
    :'You are about '+fmtD(near?near.d:0)+' from the campus staircases, so you are not shown on the map. Pick a staircase instead.')+' Your position is used on this screen only: it is not saved or sent.</p>'}
function weather(){const L=typeof HWLive!=='undefined'?HWLive:null;if(!L)return'';
  const P=points(),c={lat:P.reduce((a,g)=>a+g.lat,0)/P.length,lng:P.reduce((a,g)=>a+g.lng,0)/P.length},k=L.KMK,off=k?dist(c.lat,c.lng,k.lat,k.lon):null;
  const note='<small class="mut">Read for the "'+esc(k?k.name:'Kolej MARA Kulim')+'" point'+(off!=null?', about '+fmtD(off)+' from the staircases':'')+'. That point is not verified either.</small>';
  if(!L.enabled())return '<div class="cmpwx"><b>'+ico('cloud')+' Weather and haze</b><p class="mut">Live weather is off (Settings, Live data).</p></div>';
  const S2=L.state(),w=S2.wx&&S2.wx.st==='ok'&&S2.wx.d&&S2.wx.d.current,a=S2.aq&&S2.aq.st==='ok'&&S2.aq.d&&S2.aq.d.current;
  if(!w&&!a)return '<div class="cmpwx"><b>'+ico('cloud')+' Weather and haze</b><p class="mut">No live reading yet: offline, or still loading.</p>'+note+'</div>';
  const bd=a?L.band(a.pm2_5):null;
  return '<div class="cmpwx"><b>'+ico('cloud')+' Weather and haze, live</b><p>'+(w?Math.round(w.temperature_2m)+' °C · '+esc(L.WMO[w.weather_code]||'Weather'):'')+(w&&a?' · ':'')
    +(bd?'Haze '+esc(bd.k.toLowerCase())+' (PM2.5 '+Math.round(a.pm2_5)+' µg/m³)':'')+'</p>'+note+'</div>'}
function page(){Promise.resolve().then(mount);
  return '<div class="card cmpcard" id="cmpcard" data-mode="'+V.mode+'"><p>The campus staircases on one map. Tap a marker, or search the list, to see a staircase, how its data was gathered, and your own climbs there.</p>'
    +'<p class="warn cmpwarn" role="note"><b>Locations are not verified.</b> They come from the original app data and have no recorded source, unless a staircase says "Measured location (survey)". The raised ground is illustrative.</p>'
    +'<div class="cmpwrap">'+stage()
    +'<div class="cmppanel"><div class="cmptabs" role="tablist"><button type="button" role="tab" id="cmptab-list" data-a="cmptab" data-t="list" aria-selected="'+(V.tab==='list')+'">Staircases</button><button type="button" role="tab" id="cmptab-det" data-a="cmptab" data-t="det" aria-selected="'+(V.tab==='det')+'">Details</button></div>'
    +'<div class="cmppane" id="cmppane">'+(V.tab==='det'?detPane():listPane())+'</div></div></div>'
    +'<p class="mut cmpsv">'+esc(HWCampusData.surveyNote())+'</p>'
    +'<div class="row"><button type="button" data-a="cmpgps"'+(V.gps==='wait'?' disabled':'')+'>'+(V.gps==='wait'?'FINDING YOU...':'SHOW WHERE I AM')+'</button>'+(V.me?'<button type="button" class="g" data-a="cmpforget">HIDE MY POSITION</button>':'')+'</div>'
    +(V.err?'<p class="cmpe" role="alert">'+esc(V.err)+' Pick a staircase on the map or in the list instead.</p>':'')+where()+weather()
    +'<div class="cmpwx"><b>'+ico('map')+' Campus-wide activity</b><p class="mut">Not available. HealthWiz does not collect anyone else\'s location, so there is nothing to show here. Your own visits stay on your device.</p></div></div>'}

/* ---------- actions ---------- */
const keep=()=>{persist();const y=window.scrollY;render();window.scrollTo(0,y)};
const toDet=()=>{const e=D0.querySelector('#cmpdet .cmph');if(e)e.focus({preventScroll:true})};
/** One path for every way of choosing a staircase: a marker, the list, a link in the details, focus(). */
function pick(id,from){const s=rec(id);if(!s)return;V.sid=id;V.grp=null;V.tab='det';V.fly=placed(s)&&from!=='restore';keep();if(from!=='map')toDet()}
function pickGroup(key){if(!points().some(g=>g.key===key))return;V.grp=key;V.sid=null;V.tab='det';V.fly=false;keep();toDet()}
acts.cmpgo=()=>go('campus');
acts.cmppick=d=>pick(d.id,'list');
acts.cmptab=d=>{V.tab=d.t==='det'?'det':'list';keep()};
acts.cmpfilt=d=>{if(FILTERS.indexOf(d.f)<0)return;V.f=d.f;keep()};
acts.cmpqx=()=>{V.q='';keep();const q=$id('cmpq');if(q)q.focus()};
acts.cmpclear=()=>{V.sid=V.grp=null;V.tab='list';keep()};
acts.cmpstair=d=>{if(!rec(d.id))return;V.sid=d.id;V.grp=null;persist();HWCampusData.start(d.id)};
acts.cmpshow=()=>{const k=selKey();if(k&&M.ctl)M.ctl.flyToGroup(k)};
acts.cmpmode=d=>{V.mode=d.m==='realistic'?'realistic':'fantasy';if(M.ctl)M.ctl.setMode(V.mode);keep()};
acts.cmpzin=()=>{if(M.ctl)M.ctl.zoom(1)};acts.cmpzout=()=>{if(M.ctl)M.ctl.zoom(-1)};acts.cmpnorth=()=>{if(M.ctl)M.ctl.north()};
acts.cmpfit=()=>{if(M.ctl)M.ctl.fit()};
acts.cmptilt=()=>{if(!M.ctl)return;const on=M.ctl.map.getPitch()<=5;M.ctl.tilt(on);const b=$id('cmptilt');if(b)b.setAttribute('aria-pressed',String(on))};
acts.cmpterr=()=>{V.terr=!V.terr;if(M.ctl)M.ctl.terrain(V.terr);keep()};
acts.cmpbld=()=>{V.bld=!V.bld;if(M.ctl)M.ctl.buildings(V.bld);keep()};
acts.cmpfull=()=>{V.full=!V.full;keep();const b=$id('cmpfullb');if(b)b.focus({preventScroll:true})};
acts.cmpdetfs=()=>{V.full=false;V.tab='det';keep();const d=$id('cmpdet');if(d){d.scrollIntoView({block:'start'});toDet()}};
D0.addEventListener('keydown',e=>{if(e.key==='Escape'&&V.full&&S.v==='campus'){V.full=false;keep();const b=$id('cmpfullb');if(b)b.focus({preventScroll:true})}});
acts.cmpforget=()=>{V.me=null;V.err='';if(M.ctl)M.ctl.me(null);keep()};
// the search filters the list in place, so typing keeps the focus
D0.addEventListener('input',e=>{if(!e.target||e.target.id!=='cmpq')return;V.q=e.target.value.slice(0,80);persist();const L=shown(),l=$id('cmplist'),c=$id('cmpcount');if(l)l.innerHTML=items(L);if(c)c.textContent=countTxt(L)});
/** Ask for one position (SHOW WHERE I AM only). On campus the nearest placed staircase is selected and the map goes there. */
function locate(){const g=navigator.geolocation;V.err='';
  const fail=m=>{V.gps='';V.err=m;if(S.v==='campus')keep()};
  if(!window.isSecureContext)return fail('Location needs a secure (https) page.');
  if(!g)return fail('This browser cannot share a location.');
  V.gps='wait';keep();
  g.getCurrentPosition(p=>{V.gps='';const c=p.coords;V.me={lat:c.latitude,lng:c.longitude,acc:c.accuracy||0};
      const P=points(),near=P.map(q=>({q,d:dist(V.me.lat,V.me.lng,q.lat,q.lng)})).sort((a,b)=>a.d-b.d)[0];
      if(near&&near.d<1500){V.sid=near.q.items[0].id;V.grp=null;V.tab='det';V.fly=true}
      if(M.ctl&&M.ctl.ready){if(M.ctl.near(V.me.lng,V.me.lat))M.ctl.me({lng:V.me.lng,lat:V.me.lat,accuracy:V.me.acc});else M.ctl.me(null)}
      if(S.v==='campus')keep()},
    e=>fail(e&&e.code===1?'Location permission is off for HealthWiz.':e&&e.code===3?'Finding your position took too long.':'Your position is not available right now.'),
    {enableHighAccuracy:true,timeout:20000,maximumAge:0})}
acts.cmpgps=()=>locate();
/** Select a staircase from elsewhere (before go('campus')): the map flies to it; with no coordinates, it is not moved. */
function focus(id){const s=rec(id);if(!s)return false;V.sid=id;V.grp=null;V.tab='det';V.fly=placed(s);persist();if(M.ctl&&S.v==='campus')sync();return true}

/* ---------- the page, and its door in the Health Hall (after the Science Laboratory's) ---------- */
pages.campus=()=>page();
PAR.campus='health';
BN.campus=['🗺','Campus Health Observatory','The campus staircases, your climbs, the air outside.','rgba(92,192,90,.20)'];
DIS.campus='Locations are unverified app data unless marked measured. Raised ground and building heights are illustrative. Your position is shown on this screen only and is never saved or sent.';
const door=()=>'<div class="card cmpdoor" id="cmp-door"><h3>'+ico('map')+' CAMPUS HEALTH OBSERVATORY</h3><p>See the campus staircases on a map, how each one was measured, and check the air before you go.</p><button type="button" data-a="cmpgo">OPEN THE OBSERVATORY</button></div>';
{const p=pages.health;pages.health=function(){return p.apply(this,arguments)+door()}}
HWEvents.on('page:viewed',e=>{if(e.view!=='campus'){unmount();V.me=null;V.err='';V.gps='';fsClass()}});
HWEvents.on('data:reset',()=>{unmount();V.sid=V.grp=null;V.cam=null;V.me=null;try{sessionStorage.removeItem(VK)}catch(e){}});
HWEvents.on('live:updated',()=>{if(S.v==='campus')keep()});
addEventListener('pagehide',()=>{if(M.ctl)persist()});

/* Layout and the panel (they work without the map). The map's own pieces (markers, clusters, labels) are in
   observatory/observatory.css. The map stage takes the mode's colour tokens; the panel keeps the app's theme. */
HWUI.css('campus',`
.cmpwrap{display:grid;gap:12px;margin:10px 0}@media(min-width:900px){.cmpwrap{grid-template-columns:minmax(0,1fr) minmax(300px,380px);align-items:start}}
.cmpstage{position:relative;height:clamp(380px,62vh,620px);border-radius:14px;overflow:hidden;border:1px solid var(--edge,var(--ln));
  --panel:#ffffff;--panel2:#f4f5f2;--ink:#1d232b;--mut:#5a6470;--line:#d7dbe0;--acc:#2864d8;--acc-ink:#fff;--gold:#c99a2e;--cyan:#0f8f96;--font:var(--fn,system-ui,sans-serif);--head:var(--font);
  --shadow:0 6px 24px rgba(20,30,50,.14),0 1px 3px rgba(20,30,50,.12);--m1:#2f9a5f;--m2:#c98a0b;--m3:#cc3f35;--est:#b26b00;--part:#0f7f86;--osm:#3f6fb5;--miss:#7a828c;--ter:#8a6d3b;background:#e6e9e2;color:var(--ink)}
.cmpcard[data-mode="fantasy"] .cmpstage{--panel:rgba(14,22,54,.95);--panel2:#16224f;--ink:#eef1ff;--mut:#a9b3d9;--line:rgba(140,160,230,.26);--acc:#f2c14e;--acc-ink:#1a1430;--gold:#f2c14e;--cyan:#5fe1e6;--head:var(--fl,var(--font));
  --shadow:0 0 0 1px rgba(242,193,78,.28),0 0 30px rgba(95,225,230,.10),0 12px 40px rgba(0,0,0,.5);--m1:#7ee07c;--m2:#f6c94f;--m3:#ff7b6e;--est:#ffd27a;--part:#63e6dc;--osm:#9cc0ff;--miss:#a6aed6;--ter:#d8c3ff;background:#0c2422}
.cmpstage.cmpfull{position:fixed;inset:0;z-index:1000;height:auto;border-radius:0;border:0}html.cmp-fs,html.cmp-fs body{overflow:hidden}
.cmpfull .cmpctls{top:max(10px,env(safe-area-inset-top));right:max(10px,env(safe-area-inset-right))}.cmpfull .cmpmodes{top:max(10px,env(safe-area-inset-top));left:max(10px,env(safe-area-inset-left))}
.cmpfull .cmpleg{bottom:max(30px,env(safe-area-inset-bottom))}
.cmpstage.cmpoff{height:auto;min-height:0;background:var(--p2);color:inherit}.cmpnomap{padding:14px;font-size:15px}.cmpnomap svg{vertical-align:-3px}
.cmpslot,.cmpslot>.cmpmap,.cmpslot>.cmpmap.maplibregl-map{position:absolute;inset:0;width:100%;height:100%}.cmpmsg[hidden]{display:none}.cmpmsg{position:absolute;inset:0;display:grid;place-items:center;padding:20px;text-align:center;background:var(--panel2);color:var(--mut);z-index:4}
.cmpmodes{position:absolute;left:10px;top:10px;z-index:6;display:flex;gap:2px;padding:3px;border-radius:999px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)}
.cmpmode{border:0;margin:0;min-height:40px;padding:0 12px;border-radius:999px;background:transparent;color:var(--mut);font:600 13px var(--head);box-shadow:none}
.cmpmode[aria-pressed="true"]{background:var(--acc);color:var(--acc-ink)}
.cmpctls{position:absolute;right:10px;top:10px;z-index:6;display:flex;flex-direction:column;gap:6px}
.cmpctl{width:44px;height:44px;min-height:44px;margin:0;padding:0;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--ink);box-shadow:var(--shadow);font:700 16px var(--font);display:grid;place-items:center}
.cmpctl[aria-pressed="true"]{background:var(--acc);color:var(--acc-ink);border-color:transparent}.cmpctl svg{width:20px;height:20px}
.cmppill{position:absolute;z-index:6;left:10px;right:64px;top:62px;display:flex;align-items:center;gap:8px;max-width:max-content;padding:4px 4px 4px 12px;border-radius:999px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);color:var(--ink);font-size:14px}
.cmppd{width:10px;height:10px;border-radius:50%;background:var(--acc);flex:0 0 auto}.cmppt{min-width:0;display:flex;gap:8px;align-items:baseline;overflow:hidden}.cmppt b{flex:0 0 auto}
.cmppt span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--mut);font-size:13px}
.cmpsb{margin:0;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--panel2);color:var(--ink);font:600 13px var(--font);flex:0 0 auto;box-shadow:none}
.cmpsx{margin:0;width:36px;height:36px;min-height:36px;padding:0;border:0;border-radius:50%;background:transparent;color:var(--ink);font-size:20px;flex:0 0 auto;box-shadow:none}
.cmpleg{position:absolute;left:10px;bottom:30px;z-index:6;max-width:min(340px,calc(100% - 80px));background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);color:var(--ink);font-size:12.5px;padding:0 10px}
.cmpleg summary{cursor:pointer;min-height:40px;display:flex;align-items:center;font:600 13px var(--head)}.cmpleg p{margin:6px 0}
.cmplg{display:inline-block;width:12px;height:12px;border-radius:50%;margin:0 4px 0 6px;vertical-align:-1px}.cmplg:first-child{margin-left:0}
.cmplg.m1{background:var(--m1)}.cmplg.m2{background:var(--m2)}.cmplg.m3{background:var(--m3)}.cmplg.est{border:2px dashed var(--est)}.cmplg.part{background:var(--part)}
.cmplg.osm{border-radius:3px;background:var(--osm)}.cmplg.ter{border-radius:2px;background:linear-gradient(135deg,var(--cyan) 50%,var(--gold) 50%)}.cmplg.deco{background:radial-gradient(circle,#fff0a8,#f2c14e 45%,transparent 70%)}
.cmppanel{border:1px solid var(--edge,var(--ln));border-radius:14px;background:var(--p2);overflow:hidden;min-width:0}
@media(min-width:900px){.cmppanel{max-height:clamp(380px,62vh,620px);display:flex;flex-direction:column}.cmppane{overflow:auto;flex:1 1 auto}}
.cmptabs{display:flex;border-bottom:1px solid var(--edge,var(--ln))}.cmptabs button{flex:1;margin:0;min-height:44px;border:0;border-radius:0;background:transparent;color:var(--mut);box-shadow:none;border-bottom:3px solid transparent}
.cmptabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--gold,#f6c94f)}
.cmppane{padding:10px 12px 14px;min-width:0}
.cmpsearch{position:relative}.cmpsearch input{width:100%;min-height:44px;padding-right:44px;box-sizing:border-box}
.cmpqx{position:absolute;right:4px;top:4px;margin:0;width:36px;height:36px;min-height:36px;padding:0;border:0;background:transparent;box-shadow:none;color:var(--mut);font-size:20px}
.cmpvh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.cmpfilters{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px}.cmpf{margin:0;min-height:44px;padding:0 12px;border-radius:999px;font-size:13px}.cmpf span{opacity:.75}
.cmpf[aria-pressed="true"]{outline:2px solid var(--gold,#f6c94f);outline-offset:1px;color:var(--ink)}
.cmpcount{margin:4px 0 8px;font-size:12px;color:var(--mut)}.cmpsmall{font-size:12.5px}
.cmplist{list-style:none;margin:0;padding:0}.cmplist li+li{margin-top:6px}
@media(max-width:899px){#cmplist{max-height:55vh;overflow:auto;overscroll-behavior:contain}}
.cmpitem{width:100%;margin:0;color:var(--ink);text-align:left;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;min-height:52px;padding:8px 10px;border-radius:12px;box-shadow:none}
.cmpitem[aria-current="true"]{outline:2px solid var(--gold,#f6c94f);outline-offset:-2px}
.cmpnm{font-weight:600;font-size:14px;line-height:1.3;overflow-wrap:anywhere}.cmpmeta{grid-column:2;font-size:12px;color:var(--mut);display:flex;flex-wrap:wrap;gap:4px 8px}
.cmpdot{grid-row:span 2;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font:700 12px var(--fn,sans-serif);color:#14102e}
.cmpdot.c1{background:#7ee07c}.cmpdot.c2{background:#f6c94f}.cmpdot.c3{background:#ff8a7e}.cmpdot.nol{border:2px dashed var(--mut);color:var(--mut)}
.cmpback,.cmplnk{margin:0;min-height:40px;padding:0 4px;border:0;background:transparent;box-shadow:none;color:var(--gold,#f6c94f)}.cmplnk{text-decoration:underline;min-height:32px}
.cmpeye{margin:6px 0 0;font-size:12px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em}.cmph{margin:2px 0 6px;overflow-wrap:anywhere}.cmpmine{margin:4px 0;font-size:13px}
.cmpact{margin:6px 0 4px}.cmpact button{min-height:44px}
.cmpgrp{border:1px solid var(--edge,var(--ln));border-radius:12px;padding:10px 12px;margin-top:10px}.cmpgrp h3{margin:0 0 8px;font-size:14px}.cmpgrp h3 svg{vertical-align:-3px}
.cmpfacts{margin:0;display:grid;grid-template-columns:minmax(92px,auto) 1fr;gap:6px 10px;font-size:13.5px}.cmpfacts dt{color:var(--mut);font-weight:600}.cmpfacts dd{margin:0;overflow-wrap:anywhere;min-width:0}
.cmpsrc{display:block;font-size:12px;color:var(--mut)}.cmpna{color:var(--mut);font-style:italic}.cmpnum{font-variant-numeric:tabular-nums}
.cmpchips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;padding:0;list-style:none}
.cmpchip{font-size:12px;font-weight:700;border-radius:999px;padding:3px 9px;border:1.5px solid currentColor;line-height:1.3}
.cmpchip.est{color:#e7a93a;border-style:dashed}.cmpchip.miss{color:var(--mut);border-style:dashed}.cmpchip.part{color:#43c6bf}.cmpchip.calc{color:#43c6bf;border-style:dotted}.cmpchip.flag{color:var(--red,#ff6b5e)}
.cmpnotes{margin:10px 0 0;padding:10px;border-radius:10px;border:1px dashed var(--edge,var(--ln));font-size:13px}
.cmpwx{border-top:1px solid var(--edge,var(--ln));padding-top:8px;margin-top:10px}.cmpwx svg{vertical-align:-3px}.cmpe{color:var(--red);font-weight:bold}
.cmpsv{font-size:12.5px;margin:4px 0}
`);
return{points,unmapped,focus,why,get selected(){return V.sid},get map(){return M.ctl},
  get state(){return{sid:V.sid,grp:V.grp,mode:V.mode,full:V.full,tab:V.tab,f:V.f,q:V.q,terr:V.terr,bld:V.bld,cam:V.cam,map:M.st,msg:M.msg,me:V.me,err:V.err}}}})();
