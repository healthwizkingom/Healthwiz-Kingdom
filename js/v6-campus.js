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
   * The 3D preview (integration Phase 3): selecting a staircase (marker, list or link) opens or updates its preview at
     the top of the details; closing it keeps the selection. observatory/viewer3d.js (Three.js r169, vendor/three) shows
     the prototype's Blender models (assets/models/stairs: the demonstration shapes, with the measured F21 step size for
     ST14, ST19 and ST20) or, for a staircase with complete survey flights, a model built from those flights. It is never
     sized from an estimated angle. Labels: "Illustrative model — actual dimensions not surveyed." or "Built from survey
     measurements · finishes illustrative". It needs what the map needs (http(s), WebGL), and is freed with the page.
   * Fantasy look (integration Phase 4): the Blender buildings with moonlit real-time shadows, the generated pixel
     textures, glowing paths and lanterns, particles and selection sparks (observatory/), and gold-cornered panels here.
     All decoration: none moves a marker or changes a number, nothing animates when motion is reduced, and Realistic
     shows plain blocks. The art is original (drawn in code or modelled in Blender for HealthWiz).
   * Location only on tap (decision 2). With the map (integration Phase 5): the locate button (or SHOW WHERE I AM) first
     shows the avatar that matches the profile (st.p.sex: the anime school boy or girl; owner's request, 2026-10-20). Only
     without a sex in the profile does it ask which avatar to show: Tom, the boy or the girl. That choice is a device preference
     (localStorage 'hw_obs_avatar', no health data) and can be changed at any time. The avatar then stands at the device's
     GPS position and walks as it moves (observatory/locate.js, watchPosition), with the device's accuracy circle; away
     from campus the page says how far; DEMO WALK moves it along a campus road and says the position is simulated.
     Without the map, SHOW WHERE I AM asks once and names the nearest staircase. The position is used on this screen only:
     never saved, never sent, not kept for the tab, forgotten when the page closes.
   * Activity (Phase 5): only what the saved stair sessions support (HWCampusData.activity, by m.sid): sessions and steps
     in the last 7 days and the 7 before, the staircases climbed most, a ring on the markers of staircases climbed. No new
     XP, badges or store.
   * HWCampus.focus(id): select a staircase from elsewhere (Stair Sense, a GPS check-in, the old routes): the map flies
     to it, or with no coordinates its details open without moving the map.
   * Logging lives here (owner's request, 2026-10-20): a staircase's Details start with LOG A CLIMB HERE, the Stairs
     forms of js/v6-stairs.js (HWStairs.logPanel): GPS check-in, a climb by hand, and the workout with heart rate, for that
     staircase. With nothing picked, Details offer the GPS check-in, which picks the nearest staircase itself. Staircases
     are found on the map: tap a marker, or type in the search on the map, which shows only the matching markers and
     offers them as buttons. The Stairs section below keeps the history (js/v6-campus-stairs.js).
   * Layout: the map spans the page's width (the side navigation stays beside it); Staircases and Details are below it. */
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
const V={sid:null,grp:null,mode:'fantasy',cam:null,terr:true,bld:true,full:false,vw:false,tab:'list',f:'all',q:'',me:null,gps:'',err:'',fly:false,sky:'live',skyo:false};
try{const o=JSON.parse(sessionStorage.getItem(VK)||'null');if(o&&typeof o==='object'){
  if(typeof o.sid==='string')V.sid=o.sid;if(typeof o.grp==='string')V.grp=o.grp;if(o.mode==='realistic')V.mode='realistic';
  if(o.cam&&Array.isArray(o.cam.c)&&o.cam.c.length===2&&o.cam.c.every(isFinite)&&isFinite(o.cam.z))V.cam={c:o.cam.c.map(Number),z:+o.cam.z,b:+o.cam.b||0,p:+o.cam.p||0};
  if(o.terr===false)V.terr=false;if(o.bld===false)V.bld=false;if(o.full===true)V.full=true;if(o.vw===false)V.vw=false;if(o.tab==='det')V.tab='det';if(FILTERS.indexOf(o.f)>=0)V.f=o.f;if(typeof o.q==='string')V.q=o.q.slice(0,80);if(['day','dusk','night','rain','fog','haze'].includes(o.sky))V.sky=o.sky}}catch(e){}
const persist=()=>{if(M.ctl&&M.ctl.ready&&!ME.used)V.cam=M.ctl.camera();try{sessionStorage.setItem(VK,JSON.stringify({sid:V.sid,grp:V.grp,mode:V.mode,cam:V.cam,terr:V.terr,bld:V.bld,full:V.full,vw:V.vw,tab:V.tab,f:V.f,q:V.q,sky:V.sky}))}catch(e){}};
const selKey=()=>{if(V.grp)return V.grp;const s=V.sid&&rec(V.sid);return s&&placed(s)?keyOf(s):null};

// with the map, Details are the sheet inside it (js/v6-campus-hud.js); its tab is the Stairs forms' half (js/v6-stairs.js)
const onMap=()=>!why()&&M.st!=='error';
const half=()=>typeof HWStairs!=='undefined'&&HWStairs.half==='workout'?'workout':'stairs';
function openSheet(tab,size){if(tab&&typeof HWStairs!=='undefined')HWStairs.arrive(tab==='workout'?'pulse':'stair');V.tab='det';if(size)HWCampusHud.setSize(size);keep();if(size)HWCampusHud.setSize(size)}
function closeSheet(){V.tab='list';keep();const b=D0.querySelector('.hudbtn');if(b)b.focus({preventScroll:true})}
/** Where the player is for NEAREST STAIRS: the avatar's live position (or the demo walk's, marked simulated), with its point on the stage. */
function here(){const f=ME.last;if(!f||!M.ctl||!M.ctl.ready||!(ME.st==='gps'||ME.st==='demo'))return null;let x=null,y=null;
  try{const q=M.ctl.map.project([f.lng,f.lat]),m=M.ctl.map.getContainer().getBoundingClientRect(),r=$id('cmpstage').getBoundingClientRect();x=m.left-r.left+q.x;y=m.top-r.top+q.y}catch(e){}
  return{lat:f.lat,lng:f.lng,acc:f.accuracy||0,sim:ME.st==='demo',x:ME.far?null:x,y:ME.far?null:y}}
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
      onSelect:t=>{if(t&&t.group)pickGroup(t.group);else if(t&&t.id)pick(t.id,'map')},onCamera:c=>{if(!ME.used)V.cam=c;persist()},
      visited:id=>HWCampusData.activity(id).sessions>0,
      onLandmark:id=>{if(typeof HWCampusMagic!=='undefined')HWCampusMagic.open(id)},found:()=>typeof HWCampusMagic!=='undefined'?HWCampusMagic.foundIds():[],layers:typeof HWCampusMagic!=='undefined'?HWCampusMagic.layers():undefined,onUserMove:()=>{if(meOn()&&ME.follow){ME.follow=false;if(S.v==='campus')keep()}},
      onReady:()=>{if(g!==M.gen)return;M.st='ready';paintMsg();sync();autoMe();if(typeof HWCampusMagic!=='undefined')HWCampusMagic.ready(M.ctl);const b=$id('cmptilt');if(b)b.setAttribute('aria-pressed',String(M.ctl.map.getPitch()>5))},
      onError:m=>{if(g!==M.gen)return;fail(m)}})).then(c=>{if(g!==M.gen){c.destroy();return}M.ctl=c;if(c.ready){M.st='ready';paintMsg();sync()}})
      .catch(e=>{if(g!==M.gen)return;fail('The campus map could not be loaded ('+String(e&&e.message||e).slice(0,120)+'). The staircases are listed with their details.')})}
  // only a new size needs MapLibre's resize (it redraws the whole 3D scene); a redraw of the page alone does not
  else if(M.ctl){const w=M.host.clientWidth,h=M.host.clientHeight;if(w!==M.w||h!==M.h){M.w=w;M.h=h;M.ctl.resize()}sync()}else paintMsg()}
// the avatar shows by itself once the map is ready (owner's request, 2026-10-21): the browser still asks for location the
// first time (that cannot be skipped); without a sex in the profile the suggested avatar stands in until one is picked
function autoMe(){if(ME.auto||meOn())return;ME.auto=true;if(!navigator.geolocation||!window.isSecureContext)return;
  const go=()=>{if(S.v==='campus'&&M.ctl&&M.ctl.ready&&!meOn())meStart(false,true)};
  try{navigator.permissions.query({name:'geolocation'}).then(p=>{if(p.state!=='denied')go()},go)}catch(e){go()}}
function fail(m){M.st='error';M.skyk=null;M.msg=m;HWCampusHud.aware(false);if(M.ctl){M.ctl.destroy();M.ctl=null}if(M.host){M.host.remove();M.host=null}if(S.v==='campus')keep()}
function unmount(){M.gen++;M.skyk=null;clearInterval(M.skyT);M.skyT=0;if(M.ctl){persist();M.ctl.destroy()}M.ctl=null;if(M.host)M.host.remove();M.host=null;M.st='off';M.msg=''}
/** The loading / failure note over the map, changed in place (no redraw). */
function paintMsg(){const e=$id('cmpmsg');if(!e)return;e.hidden=M.st==='ready';e.textContent=M.st==='error'?M.msg:'Loading the campus map…'}
/** Make the map match the state: the highlighted marker, and a pending fly to the selection. */
function sync(){const c=M.ctl;if(!c||!c.ready)return;skyApply();const k=selKey();c.select(k);filterMap();if(V.fly&&k){V.fly=false;c.flyToGroup(k)}else if(V.fly)V.fly=false;
  if(ME.last&&!ME.far)c.me(ME.last,true,avUrl())}

/* ---------- the avatar and the live position (Phase 5) ---------- */
const AVK='hw_obs_avatar';
const AV={tom:{n:'Tom',f:'tom.glb',c:'The model "Tom" supplied by the project owner; reduced and given a walk for HealthWiz.'},
  schoolboy:{n:'Anime school boy',f:'schoolboy.glb',c:'"Rigged Anime School Boy (Animation included)" by suzuart (Sketchfab), CC BY 4.0. Changed for HealthWiz: reduced, new skeleton, idle and walk.',u:'https://sketchfab.com/3d-models/rigged-anime-school-boy-animation-included-288cb16deac54a3c95697a4e2290b499'},
  schoolgirl:{n:'Anime school girl',f:'schoolgirl.glb',c:'"Stylized Anime Japanese High School Girl 2" by suzuart (Sketchfab), CC BY 4.0. Changed for HealthWiz: converted, reduced, new skeleton, idle and walk.',u:'https://skfb.ly/pMoto'}};
const avOrder=()=>['tom','schoolboy','schoolgirl'];
const avGet=()=>{try{const v=localStorage.getItem(AVK);return AV[v]?v:null}catch(e){return null}};
const avSet=v=>{try{localStorage.setItem(AVK,v)}catch(e){}};
// the avatar follows the profile's sex (owner's request, 2026-10-20); only without one does the player pick (and can change it)
const avSex=()=>{const x=st.p&&st.p.sex;return x==='m'?'schoolboy':x==='f'?'schoolgirl':null};
const avNow=()=>avSex()||avGet()||'tom';
const avUrl=()=>'assets/models/avatars/'+AV[avNow()].f;
// memory only. used: the position was shown during this visit, so the camera (which followed it) is not saved for the tab;
// the view from before is kept instead, until the page closes
const ME={st:'off',last:null,far:false,follow:true,first:true,msg:'',km:null,loc:null,choose:false,gen:0,used:false};
const meOn=()=>ME.st==='gps'||ME.st==='demo'||ME.st==='asking';
function meStop(quiet){if(ME.loc)ME.loc.stop();ME.loc=null;ME.gen++;ME.st='off';ME.last=null;ME.far=false;ME.msg='';ME.km=null;if(M.ctl)M.ctl.me(null);if(!quiet&&S.v==='campus')keep()}
function meStart(demo,auto){if(!M.ctl||!M.ctl.ready)return;if(!auto&&!avSex()&&!avGet()){ME.choose=true;keep();return}
  const g=++ME.gen;ME.follow=true;ME.first=true;ME.msg='';
  window.HWObsMap.locator({onFix:f=>{if(g!==ME.gen||!M.ctl)return;onFix(f)},onState:(st2,info)=>{if(g!==ME.gen)return;ME.st=st2;ME.msg=st2==='error'?info.message:'';if(st2==='error'||st2==='off'){ME.last=null;if(M.ctl)M.ctl.me(null)}if(S.v==='campus')keep()}})
    .then(l=>{if(g!==ME.gen){l.stop();return}ME.loc=l;if(demo)l.startDemo(window.HWObsMap.demoPath((x,y)=>M.ctl.near(x,y)));else l.startGps()})
    .catch(e=>{ME.st='error';ME.msg='Location could not start ('+String(e&&e.message||e).slice(0,80)+').';keep()})}
// the first fix: the view from before is kept for the tab (the camera then follows the avatar)
function onFix(f){const c=M.ctl,was=ME.st;if(!ME.used){persist();ME.used=true}ME.last={lng:f.lng,lat:f.lat,accuracy:f.accuracy,source:f.source};
  ME.far=f.source==='gps'&&!c.near(f.lng,f.lat);ME.km=window.HWObsMap.kmFromCampus(f.lng,f.lat);
  const first=ME.first;if(ME.far)c.me(null);else{c.me(ME.last,ME.first,avUrl());if(ME.follow)c.followMe(ME.last,ME.first);ME.first=false}
  // later fixes change the status bar in place; the first (or a change between far and near) redraws the page once
  const t=$id('cmpmet'),near=!!$id('cmpnear');if(t&&!first&&near===(!ME.far&&f.source==='gps'))t.innerHTML=meText();else if(S.v==='campus')keep()}
function meText(){const f=ME.last;
  if(ME.st==='asking')return 'Finding your location…';
  if(ME.st==='error')return esc(ME.msg);
  if(ME.st==='demo')return '<b>Demo walk</b> · simulated position, not yours';
  if(ME.st==='gps'&&ME.far&&f)return '<b>You are about '+(ME.km!=null?ME.km.toFixed(1):'?')+' km from campus.</b> Your avatar only walks on the campus map.';
  if(ME.st==='gps'&&f)return '<b>You</b> · GPS ±'+Math.round(f.accuracy||0)+' m (device estimate)';
  return ''}
function meBar(){if(!meOn()&&ME.st!=='error')return '';
  return '<div class="cmpmebar" role="status" aria-live="polite" data-st="'+ME.st+'"><span class="cmpmed" aria-hidden="true"></span><span class="cmpmet" id="cmpmet">'+meText()+'</span>'
    +(ME.st==='error'||(ME.st==='gps'&&ME.far)?'<button type="button" class="cmpsb" data-a="cmpmedemo">Demo walk</button>':'')
    +(((ME.st==='gps'&&!ME.far)||ME.st==='demo')&&!ME.follow?'<button type="button" class="cmpsb" data-a="cmpmefollow">Follow me</button>':'')
    +(avSex()?'':'<button type="button" class="cmpsb" data-a="cmpavopen">Avatar</button>')+'<button type="button" class="cmpsx" data-a="cmpmestop" aria-label="Stop showing my position">×</button></div>'}
function chooser3(){if(!ME.choose||avSex())return '';const cur=avGet(),o=avOrder();
  return '<div class="cmpav" role="dialog" aria-modal="false" aria-labelledby="cmpav-t"><b id="cmpav-t">Choose your avatar</b><p class="cmpsmall">It stands where your phone says you are. '
    +'Your profile has no sex set, so pick any (with one, the avatar follows it). You can change it later.</p><ul>'
    +o.map((k,i)=>'<li><button type="button" class="g cmpavb" data-a="cmpavpick" data-v="'+k+'" aria-pressed="'+(cur===k)+'"><b>'+AV[k].n+'</b>'+(i===0&&!cur?' <small>(suggested)</small>':'')+'</button><small class="cmpcred">'+esc(AV[k].c)+(AV[k].u?' <a href="'+AV[k].u+'" target="_blank" rel="noopener">Source</a>':'')+'</small></li>').join('')
    +'</ul><button type="button" class="cmpsb" data-a="cmpavclose">Not now</button></div>'}
acts.cmpme=()=>{if(!M.ctl||!M.ctl.ready)return locate();if(!meOn()){meStart(false);return}if(!ME.follow&&!ME.far&&ME.last){ME.follow=true;M.ctl.followMe(ME.last,false);keep();return}meStop()};
acts.cmpmestop=()=>meStop();
acts.cmpmedemo=()=>{if(ME.loc)ME.loc.stop();ME.gen++;ME.loc=null;meStart(true)};
acts.cmpmefollow=()=>{ME.follow=true;if(ME.last&&M.ctl)M.ctl.followMe(ME.last,false);keep()};
acts.cmpavopen=()=>{if(avSex())return;ME.choose=true;keep()};
acts.cmpavclose=()=>{ME.choose=false;keep()};
acts.cmpavpick=d=>{if(!AV[d.v]||avSex())return;avSet(d.v);ME.choose=false;if(meOn()){if(ME.last&&!ME.far&&M.ctl)M.ctl.me(ME.last,true,avUrl());keep()}else meStart(ME.st==='demo')};

/* ---------- the 3D preview: one element across redraws, like the map ---------- */
const P3={st:'off',err:'',host:null,ctl:null,demo:null,shown:'',gen:0}; // st: off | loading | ready | error
const vrec=s=>Object.assign({},s,{_plan:HWCampusData.surveyPlan(s)}); // a copy: the shared records are never changed
function mount3d(){const slot=$id('cmpvwslot'),s=V.sid&&rec(V.sid);
  if(!slot||!s){if(P3.ctl&&P3.shown){P3.ctl.hide();P3.shown=''}return}
  if(!P3.host){P3.host=D0.createElement('div');P3.host.className='cmpvwhost';P3.host.innerHTML='<div class="cmpvwcv"></div><div class="cmpvwmsg" data-loading="1">Loading the 3D model…</div>'}
  if(P3.host.parentNode!==slot)slot.appendChild(P3.host);
  const msg=P3.host.querySelector('.cmpvwmsg');
  if(P3.st==='off'){P3.st='loading';const g=++P3.gen;
    loadModule().then(X=>X.viewer({host:P3.host.querySelector('.cmpvwcv'),msg,reduced:()=>HWUI.reduced(),onView:null})).then(r=>{if(g!==P3.gen){r.viewer.destroy();return}
      P3.ctl=r.viewer;P3.demo=r.demo;P3.st='ready';mount3d()})
      .catch(e=>{if(g!==P3.gen)return;P3.st='error';msg.hidden=false;delete msg.dataset.loading;
        msg.textContent='The 3D preview could not start on this device ('+String(e&&e.message||'WebGL unavailable').slice(0,120)+'). The map and details still work.'});return}
  if(P3.st!=='ready')return;
  const k=s.id+'|'+V.mode,was=P3.shown;
  if(was===k)return;
  if(was&&was.split('|')[0]===s.id){P3.ctl.setMode(V.mode);P3.shown=k;return}
  P3.shown=k;P3.ctl.show(vrec(s),P3.demo,V.mode).then(()=>{if(S.v==='campus')paintShapes()})}
function unmount3d(){P3.gen++;if(P3.ctl)P3.ctl.destroy();P3.ctl=null;if(P3.host)P3.host.remove();P3.host=null;P3.st='off';P3.shown='';P3.err=''}
/** The shape buttons follow the viewer (changed in place). */
function paintShapes(){const w=$id('cmpvwshapes');if(!w||!P3.ctl)return;w.querySelectorAll('[data-shape]').forEach(b=>b.setAttribute('aria-pressed',String(P3.ctl.shape===b.dataset.shape)));
  const sp=$id('cmpvwspin');if(sp)sp.setAttribute('aria-pressed',String(!!P3.ctl.spinning))}
const SHAPES=[['straight','Straight'],['straight-landing','Straight with landing'],['L','L-turn'],['U','U-turn (switchback)']];
/** The preview section at the top of a staircase's details. */
function preview(s){const plan=HWCampusData.surveyPlan(s),m=s.measuredStep;
  if(why())return '<p class="mut cmpsmall cmpvwna">3D preview: it needs what the map needs (the web address and WebGL), so it is not shown here.</p>';
  if(!V.vw)return '<div class="row cmpact"><button type="button" class="g" data-a="cmpvwopen">SHOW 3D PREVIEW</button></div>';
  const ch=plan?chip('part','Built from survey measurements')+chip('ill','Finishes illustrative'):chip('ill','Illustrative 3D model')+(m?chip('part','Step size measured (F21)'):chip('miss','Not yet surveyed'));
  const d=P3.demo||{stepsPerFlight:9,width_m:1.4,riser_m:.16,tread_m:.3};
  const facts=plan?['<b>Flights, steps, width, turns and landings:</b> from the survey sheet ('+esc(s.survey.label)+'): '+plan.length+' flight'+(plan.length>1?'s':'')+', '+plan.map(f=>f.n).join(' + ')+' steps.',
      '<b>Landings:</b> '+(plan.slice(0,-1).every(f=>f.landingLength)?'measured length'+(plan.slice(0,-1).every(f=>f.landingWidth)?' and width.':'; width taken as the flight width where not measured.'):'where a landing size is not in the sheet, it is drawn as wide and deep as the flight (illustrative).'),
      s.orientationDeg!=null?'<b>Orientation:</b> '+(s.orientationStatus==='measured'?'measured':'estimated')+', '+s.orientationDeg+'° from north.':'<b>Orientation:</b> not surveyed.',
      '<b>Not measured:</b> the materials, railings, posts and the dais. Walls and surroundings are not drawn.']
    :['<b>Shape, steps, width, landings:</b> demonstration values ('+d.stepsPerFlight+' steps a flight, '+d.width_m+' m wide). Pick a shape to compare; none is this staircase\'s surveyed form.',
      m?'<b>Step size:</b> measured for this staircase (rise '+m.rise_m+' m, run '+m.run_m+' m, F21 report), so the slope of the steps matches its measured angle. Only the step size is real.'
        :'<b>Step size:</b> demonstration value (rise '+d.riser_m+' m, run '+d.tread_m+' m), not this staircase. The stored angle is an estimate and does not size the model.',
      s.orientationDeg!=null?'<b>Orientation:</b> estimated, '+s.orientationDeg+'° from north.':'<b>Orientation:</b> not surveyed. The model faces an arbitrary direction.',
      '<b>Height and floors:</b> not inferred. The model\'s height comes only from the demonstration step count. The dais is decoration.'];
  const vb=(v,lab,t,x)=>'<button type="button" class="g cmpvb" data-a="cmpvwc" data-v="'+v+'" aria-label="'+lab+'"'+(x||'')+'>'+t+'</button>';
  return '<section class="cmpvw" id="cmpvw" aria-labelledby="cmpvw-t"><div class="cmpvwh"><div><p class="cmpeye">3D staircase preview</p><b id="cmpvw-t">'+esc(s.name)+'</b></div>'
    +'<button type="button" class="g cmpvwx" data-a="cmpvwclose" aria-label="Close the 3D preview (the staircase stays selected)">×</button></div><ul class="cmpchips">'+ch+'</ul>'
    +'<div class="cmpvws"><div class="cmpvwslot" id="cmpvwslot"></div><p class="cmpillus" role="note">'+(plan?'Built from survey measurements · finishes illustrative':'Illustrative model — actual dimensions not surveyed.')+'</p></div>'
    +'<div class="cmpvwc" role="toolbar" aria-label="3D view controls">'+vb('left','Turn left','⟲')+vb('right','Turn right','⟳')+vb('in','Zoom in','+')+vb('out','Zoom out','−')+vb('reset','Reset the view','Reset')
    +vb('spin','Spin','Spin',' id="cmpvwspin" aria-pressed="'+!!(P3.ctl&&P3.ctl.spinning)+'"')+'</div>'
    +(plan?'':'<div class="cmpvwshapes" id="cmpvwshapes" role="group" aria-label="Demonstration shape">'+SHAPES.map(([k,l])=>'<button type="button" class="g cmpvb" data-a="cmpvwshape" data-shape="'+k+'" aria-pressed="'+((P3.ctl&&P3.ctl.shape||'straight-landing')===k)+'">'+l+'</button>').join('')+'</div>')
    +'<details class="cmpvwmore"><summary>What is real in this model?</summary><ul>'+facts.map(t=>'<li>'+t+'</li>').join('')+'</ul></details></section>'}

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
  // the search sits on the map; without the map (opened from the file, no WebGL, or the map failed) it stays here
  const box=why()||M.st==='error'?'<div class="cmpsearch"><label for="cmpq" class="cmpvh">Search staircases</label><input id="cmpq" type="search" value="'+esc(V.q)+'" placeholder="Search by name, ID or building (e.g. ST14, Kenanga)" autocomplete="off">'
    +(V.q?'<button type="button" class="cmpqx" data-a="cmpqx" aria-label="Clear the search">×</button>':'')+'</div>'
    :'<p class="mut cmpsmall">'+ico('map')+' To find one quickly, open the HealthWiz button on the map and search: only the matching staircases stay on it.</p>';
  const cur=V.sid&&rec(V.sid);
  return '<h3 class="cmplh">'+ico('stairs')+' All staircases</h3>'+(cur?'<div class="row cmpact"><button type="button" class="g" data-a="cmptab" data-t="det">BACK TO '+esc(cur.id)+' DETAILS</button></div>':'')+box
    +'<div class="cmpfilters" role="group" aria-label="Filter">'+FILTERS.map(k=>'<button type="button" class="g cmpf" data-a="cmpfilt" data-f="'+k+'" aria-pressed="'+(V.f===k)+'">'+FL[k][0]+' <span>'+R().filter(FL[k][1]).length+'</span></button>').join('')+'</div>'
    +'<p class="cmpcount" id="cmpcount" aria-live="polite">'+countTxt(L)+'</p><ul class="cmplist" id="cmplist">'+items(L)+'</ul>'
    +(u?'<p class="mut cmpsmall">'+u+' staircases have no coordinates in the app data, so they are not on the map. You can still pick them here.</p>':'')}

/* ---------- details: three groups (location, staircase profile, data quality), as in the prototype ---------- */
const chip=(c,t)=>'<li class="cmpchip '+c+'">'+esc(t)+'</li>';
const na=t=>'<dd class="cmpna">'+esc(t)+'</dd>';
const grp=(icon,title,body)=>'<section class="cmpgrp"><h3>'+ico(icon)+' '+title+'</h3>'+body+'</section>';
const n2=v=>v==null?'':esc(v);
const distM=(a,b)=>dist(a.latitude,a.longitude,b.latitude,b.longitude);
function details(s,tab){if(tab==='workout')return '<p class="cmpeye">'+s.id+' · '+CN[s.appCategory]+'</p><h3 class="cmph" tabindex="-1">'+esc(s.name)+'</h3>'+logBox(s,tab);
  const m=s.measuredStep,f=facts(s),v=s.survey,a=HWCampusData.activity(s.id),FS=s.flightsSurveyed||[];
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
  return '<p class="cmpeye">'+s.id+' · '+CN[s.appCategory]+'</p><h3 class="cmph" tabindex="-1">'+esc(s.name)+'</h3>'
    +(tab?logBox(s,tab)+preview(s):preview(s)+logBox(s))+mine+(placed(s)&&M.st==='ready'?'<div class="row cmpact"><button type="button" class="g" data-a="cmpshow">SHOW ON MAP</button></div>':'')
    +grp('map','Location',loc)+grp('stairs','Staircase profile',pro)+grp('scroll','Data quality',q)
    +'<div class="row cmpact"><button type="button" class="g cmpback" data-a="cmptab" data-t="list">ALL STAIRCASES</button></div>'}
function chooser(g){return '<button type="button" class="cmpback" data-a="cmptab" data-t="list">‹ All staircases</button><p class="cmpeye">Shared point</p><h3 class="cmph" tabindex="-1">'+g.items.length+' staircases at one stored point</h3>'
  +'<p class="mut cmpsmall">'+g.lat+', '+g.lng+' · '+esc(g.items[0].locationStatus==='measured'?'Measured location (survey)':'Estimated location (app data)')+'. These records store the identical coordinate; on site they are probably separate stairs. Pick one.</p>'
  +'<ul class="cmplist">'+g.items.map(s=>'<li><button type="button" class="g cmpitem" data-a="cmppick" data-id="'+s.id+'">'+dot(s)+'<span class="cmpnm">'+esc(s.name)+'</span><span class="cmpmeta"><b>'+s.id+'</b><span>'+esc(s.appFloorLabel)+'</span></span></button></li>').join('')+'</ul>'}
/** LOG A CLIMB HERE: the Stairs forms (js/v6-stairs.js) for this staircase. */
function logBox(s,tab){if(typeof HWStairs==='undefined')return '';const o=tab&&(tab==='workout'?'workout':'casual');
  return '<section class="cmplog" id="cmplog" aria-labelledby="cmplog-t"><h3 id="cmplog-t">'+ico(o==='workout'?'energy':'stairs')+(o==='workout'?' LOG A WORKOUT HERE':' LOG A CLIMB HERE')+'</h3>'+HWStairs.logPanel(s.id,o)+'</section>'}
function detPane(tab){const g=V.grp&&points().find(x=>x.key===V.grp),s=!g&&V.sid&&rec(V.sid);
  // in the map's Details sheet (js/v6-campus-hud.js) its tab picks the forms: Stairs (a climb) or Workout (heart rate)
  if(tab&&!g&&!s)return '<div class="cmpdet" id="cmpdet" tabindex="-1" role="region" aria-label="Log without a staircase"><p class="mut cmpsmall">No staircase picked: tap a heart on the map, or NEAREST STAIRS.'+(tab==='workout'?' Heart rate can be logged without one.':'')+'</p>'
    +(typeof HWStairs!=='undefined'?'<section class="cmplog" id="cmplog">'+HWStairs.logPanel(null,tab==='workout'?'workout':'casual')+'</section>':'')+'</div>';
  const none='<p class="mut">Pick a staircase on the map (tap its heart, or search on the map) to log a climb or a workout there, or check in by GPS below. Heart rate can be logged without one.</p><div class="row cmpact"><button type="button" class="g cmpback" data-a="cmptab" data-t="list">ALL STAIRCASES</button></div>'
    +(typeof HWStairs!=='undefined'?'<section class="cmplog" id="cmplog" aria-labelledby="cmplog-t"><h3 id="cmplog-t">'+ico('stairs')+' LOG A CLIMB</h3>'+HWStairs.logPanel(null)+'</section>':'');
  return '<div class="cmpdet'+(V.pop?' pop':'')+'" id="cmpdet" tabindex="-1" role="region" aria-label="Selected staircase">'+(g?chooser(g):s?details(s,tab):none)+'</div>'}

/* ---------- the sky (observatory/sky.js): live weather and haze (js/v6-live.js) and the clock; or a preview ---------- */
const SKYN={live:'Live',day:'Clear day',dusk:'Dusk',night:'Night',rain:'Rain',fog:'Fog',haze:'Haze'};
function skyPanel(){if(!V.skyo)return '';
  return '<div class="cmpskyp" id="cmpskyp" role="group" aria-label="Sky on the map"><b>Sky</b>'+Object.keys(SKYN).map(k=>'<button type="button" class="cmpsb" data-a="cmpsky" data-v="'+k+'" aria-pressed="'+(V.sky===k)+'">'+SKYN[k]+'</button>').join('')
    +'<small>Live: the Kulim weather and the modelled haze (Settings, Live data) with the time from your clock. The others are previews. A picture, not a forecast.</small></div>'}
function skyApply(){const c=M.ctl,X=window.HWObsMap;if(!c||!c.ready||!X||!X.sky||!c.sky)return;
  const L=typeof HWLive!=='undefined'&&HWLive.enabled()?HWLive:null,R0=L?L.state():null,wx=R0&&R0.wx&&R0.wx.st==='ok'&&R0.wx.d?R0.wx.d.current:null;
  const P=points(),lat=P.length?P.reduce((a,g)=>a+g.lat,0)/P.length:5.3505,lng=P.length?P.reduce((a,g)=>a+g.lng,0)/P.length:100.5385;
  const st2=X.sky.state({now:new Date(),lat,lng,wx,hazeLevel:L?L.level():0,preview:V.sky}),k=JSON.stringify([st2.tod,st2.rain,st2.fog,st2.haze,st2.cloud,Math.round(st2.az/5),Math.round(st2.alt/3),c.mode]);
  if(k!==M.skyk){M.skyk=k;c.sky(st2)} // only when the picture changes: each change redraws the map once
  if(!M.skyT)M.skyT=setInterval(()=>{if(!document.hidden)skyApply()},5*60e3); // the time of day moves on: one quiet check every 5 min, only while the map is open
  const t=$id('cmpskycap');if(t)t.textContent='Sky: '+X.sky.words(st2)+(V.sky==='live'?(st2.src==='live'?' (live)':' (clock; no live weather)'):' (preview)')}
acts.cmpskyb=()=>{V.skyo=!V.skyo;keep()};
acts.cmpsky=d=>{if(!SKYN[d.v])return;V.sky=d.v;persist();keep();skyApply()};
HWEvents.on('live:updated',()=>{if(S.v==='campus')skyApply()});

/* ---------- the page ---------- */
/** The map's buttons, in the HealthWiz menu (js/v6-campus-hud.js): [action, name, label, icon, attributes]. */
function ctls(){const on=v=>' aria-pressed="'+!!v+'"';
  return [['cmpme','Me','Show me on the map (uses your location)','<span class="cmploc" aria-hidden="true"></span>',on(meOn())],['hudsheetopen','Details','Open the details',ico('scroll'),''],
    ['cmpfull',V.full?'Exit full':'Full screen',V.full?'Leave full screen':'Full screen map',ico('expand'),' id="cmpfullb"'+on(V.full)],['cmpzin','Zoom in','Zoom in','+',''],['cmpzout','Zoom out','Zoom out','−',''],
    ['cmpnorth','North','North up (the needle points north)','<span class="cmpcomp" id="cmpcomp" aria-hidden="true"><i></i><b>N</b></span>',''],
    ['cmprotl','Turn left','Rotate left','<svg viewBox="0 0 24 24" aria-hidden="true" class="cmpsv2"><path d="M9 5H4v5"/><path d="M4.5 9.5A8 8 0 1 1 6 17"/></svg>',''],
    ['cmprotr','Turn right','Rotate right','<svg viewBox="0 0 24 24" aria-hidden="true" class="cmpsv2"><path d="M15 5h5v5"/><path d="M19.5 9.5A8 8 0 1 0 18 17"/></svg>',''],
    ['cmptilt','3D','Tilted 3D view','3D',' id="cmptilt"'+on(M.ctl&&M.ctl.ready?M.ctl.map.getPitch()>5:!V.cam||V.cam.p>5)],['cmpterr','Terrain','Illustrative terrain',spr('peak'),on(V.terr)],
    ['cmpbld','Buildings','Raised buildings (illustrative heights)',spr('block'),on(V.bld)],['cmpskyb','Sky','Sky and weather on the map',ico('cloud'),' id="cmpskyb" aria-expanded="'+V.skyo+'"'],
    ['cmplay','Layers','Map layers: show or hide markers, labels, contours, paths and effects','<svg viewBox="0 0 24 24" aria-hidden="true" class="cmpsv2"><path d="m12 4 9 5-9 5-9-5Z"/><path d="m3 14 9 5 9-5"/></svg>',' id="cmplayb"'],
    ['cmpfit','Campus','Whole campus view',ico('map'),''],['hudlegopen','Legend','Legend: what the map shows',ico('help'),'']]}
function legend(){return '<p><span class="cmplg m1"></span>Mild <span class="cmplg m2"></span>Moderate <span class="cmplg m3"></span>Vigorous <small>(app category)</small></p>'
    +'<p><span class="cmplg est"></span>Estimated location <span class="cmplg part"></span>Step size measured (F21) or surveyed</p><p><span class="cmplg ter"></span>Raised ground and contour lines (every 2 m): which area is higher is from the owner\'s annotated screenshot; where the slopes start and end is estimated from the drone video and the staircase list. Heights are illustrative, not measured</p><p><span class="cmplg osm"></span>Roads with kerbs and drains, street lights, goal posts, the tennis net and car parks: modelled in Blender in the look of the drone video, on the OpenStreetMap roads and fields. Car park places are estimated; parked cars are decoration</p><p><span class="cmplg sky"></span>Sky: the live Kulim weather and modelled haze (Settings, Live data) and the time from your clock; a picture, not a forecast</p>'
    +'<p><span class="cmplg osm"></span>Buildings, paths, fields: OpenStreetMap. Building heights are illustrative.</p>'+'<p><span class="cmplg lmkl"></span>Landmark: a place mapped in OpenStreetMap (gold once you have opened it). Exploring is not climbing</p>'+(V.mode==='fantasy'?'<p><span class="cmplg deco"></span>Roofs, turrets, banners, timber framing, trees, lanterns, signposts, notice boards, rune waystones and glows are decoration on the real OSM outlines; the gatehouse stands at the mapped gate</p>':'')
    +'<p><span class="cmplg vis"></span>A ring: you have saved a stair session there</p><p><span class="cmplg osm"></span>Clouds: the land beyond the campus, not mapped here. The KM KULIM sign: its place is estimated from the owner\'s screenshot; drawn larger than life</p>'
    +(meOn()?'<p>Your avatar: '+AV[avNow()].n+(avSex()?' (from your profile)':'')+'. '+esc(AV[avNow()].c)+' It is drawn larger than life so it can be seen; its size and pace mark nothing.</p>':'')}
function stage(){const w=why(),s=V.sid&&rec(V.sid),g=V.grp&&points().find(x=>x.key===V.grp),on=(k,v)=>' aria-pressed="'+!!v+'"';
  if(w)return '<div class="cmpstage cmpoff" id="cmpstage"><div class="cmpnomap" id="cmpnomap" role="note">'+ico('map')+' '+esc(WHY[w])+'</div></div>';
  if(M.st==='error')return '<div class="cmpstage cmpoff" id="cmpstage"><div class="cmpnomap" id="cmpnomap" role="alert">'+esc(M.msg)+'</div></div>';
  const pill=s||g?'<div class="cmppill" role="status" aria-live="polite"><span class="cmppd" aria-hidden="true"></span><span class="cmppt"><b>'+(g?g.items.length+' staircases':s.id)+'</b><span>'+esc(g?'at one stored point':s.name)+'</span></span>'
    +'<button type="button" class="cmpsb" data-a="hudsheetopen">Details</button>'+'<button type="button" class="cmpsb" data-a="cmpfit">Campus view</button><button type="button" class="cmpsx" data-a="cmpclear" aria-label="Clear the selection">×</button></div>':'';
  return '<div class="cmpstage'+(V.full?' cmpfull':'')+'" id="cmpstage"'+(V.full?' role="dialog" aria-modal="true" aria-label="Campus map, full screen"':'')+'><div class="cmpslot" id="cmpmapslot"></div>'
    +'<div class="cmpmodes" role="group" aria-label="Map style"><button type="button" class="cmpmode" data-a="cmpmode" data-m="fantasy"'+on(0,V.mode==='fantasy')+'>Fantasy</button><button type="button" class="cmpmode" data-a="cmpmode" data-m="realistic"'+on(0,V.mode==='realistic')+'>Realistic</button></div>'
    +pill+meBar()+chooser3()+HWCampusHud.html({items:ctls(),find:finder(),legend:legend(),sheet:V.tab==='det'?HWCampusHud.sheet(half(),detPane(half())):''})
    +skyPanel()+(typeof HWCampusMagic!=='undefined'?HWCampusMagic.stage():'')+'<p class="cmpskycap" id="cmpskycap" role="status"></p>'
    +(typeof HWCampusStop!=='undefined'?HWCampusStop.html():'')+'<div class="cmpmsg" id="cmpmsg" role="status"'+(M.st==='ready'?' hidden':'')+'>'+esc(M.st==='error'?M.msg:'Loading the campus map…')+'</div></div>'}
/** The search on the map: type a name, ID or building; only the matching markers stay on the map, and the matches are
    offered as buttons under the box (no list to scroll). */
const FINDN=6;
function finds(){const q=V.q.trim();return q?shown().slice(0,FINDN):[]}
function findRes(){const q=V.q.trim(),L=q?shown():[];if(!q)return '';
  return L.length?L.slice(0,FINDN).map(s=>'<li><button type="button" class="cmpfr" data-a="cmppick" data-from="find" data-id="'+s.id+'">'+dot(s)+'<span><b>'+esc(s.name)+'</b><small>'+s.id+(placed(s)?'':' · no location on the map')+'</small></span></button></li>').join('')
    +(L.length>FINDN?'<li class="cmpfmore">'+(L.length-FINDN)+' more: type more of the name</li>':'')
    :'<li class="cmpfmore">No staircase matches.</li>'}
function finder(){return '<div class="cmpfind" role="search"><label for="cmpfind" class="cmpvh">Find a staircase on the map</label>'
  +'<input id="cmpfind" type="search" value="'+esc(V.q)+'" placeholder="Find a staircase: name, ID, building" autocomplete="off" aria-controls="cmpfindres">'
  +(V.q?'<button type="button" class="cmpqx" data-a="cmpqx" aria-label="Clear the search">×</button>':'')
  +'<ul class="cmpfres" id="cmpfindres" aria-live="polite">'+findRes()+'</ul></div>'}
/** The map shows only the markers the search matches. */
function filterMap(){if(!M.ctl||!M.ctl.ready||!M.ctl.only)return;const q=V.q.trim();if(!q){M.ctl.only(null);return}
  const ids=new Set(shown().filter(placed).map(s=>s.id));M.ctl.only(points().filter(g=>g.items.some(s=>ids.has(s.id))).map(g=>g.key))}
const nearTxt=(lat,lng,acc)=>{const n=points().map(g=>({g,d:dist(lat,lng,g.lat,g.lng)})).sort((a,b)=>a.d-b.d)[0];
  return n?'<p class="cmpyou" id="cmpnear">The nearest mapped staircase is <b>'+esc(n.g.items[0].name)+'</b>, about '+fmtD(n.d)+' away'+(acc?' (± '+Math.round(acc)+' m)':'')+'. Your position is used on this screen only: it is not saved or sent.</p>':''};
/** The player's own stair activity, from saved sessions only (no new XP, badges or store). */
function mine(){const L=typeof HWStairs!=='undefined'?HWStairs.all():[];if(!L.length)return '<div class="cmpwx"><b>'+ico('stairs')+' Your climbs on campus</b><p class="mut">No stair sessions saved yet. Pick a staircase on the map, then log a climb in its Details.</p></div>';
  const d=new Date(),ymd=x=>x.getFullYear()+'-'+('0'+(x.getMonth()+1)).slice(-2)+'-'+('0'+x.getDate()).slice(-2),back=n=>{const x=new Date(d);x.setDate(x.getDate()-n);return ymd(x)};
  const t=today(),a7=back(6),b7=back(13),wk=L.filter(s=>s.d>=a7&&s.d<=t),pw=L.filter(s=>s.d>=b7&&s.d<a7),steps=A=>A.reduce((x,s)=>x+s.total,0);
  const C={};L.forEach(s=>{if(s.sid&&rec(s.sid))C[s.sid]=(C[s.sid]||0)+1});const top=Object.keys(C).sort((x,y)=>C[y]-C[x]||(x<y?-1:1)).slice(0,3),none=L.filter(s=>!s.sid||!rec(s.sid)).length;
  return '<div class="cmpwx" id="cmpmine"><b>'+ico('stairs')+' Your climbs on campus</b><p>Last 7 days: <b>'+wk.length+'</b> session'+(wk.length===1?'':'s')+', <b>'+steps(wk)+'</b> steps · the 7 days before: '+pw.length+' session'+(pw.length===1?'':'s')+', '+steps(pw)+' steps.</p>'
    +(top.length?'<p>Most climbed: '+top.map(id=>'<button type="button" class="cmplnk" data-a="cmppick" data-id="'+id+'">'+esc(rec(id).name)+'</button> ('+C[id]+')').join(', ')+'.</p>':'')
    +'<p class="mut cmpsmall">From your saved stair sessions on this device'+(none?'; '+none+' older session'+(none===1?' has':'s have')+' no staircase recorded':'')+'. No new points or badges here.</p></div>'}
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
function page(){Promise.resolve().then(()=>{mount();mount3d()});
  return '<div class="card cmpcard" id="cmpcard" data-mode="'+V.mode+'"><p>The campus staircases on one map. Tap a marker, or search on the map, to pick a staircase: its Details are where you log a climb or a workout, see how its data was gathered, and your own climbs there.</p>'
    +'<p class="warn cmpwarn" role="note"><b>Locations are not verified.</b> They come from the original app data and have no recorded source, unless a staircase says "Measured location (survey)". The raised ground is illustrative.</p>'
    +'<div class="cmpwrap">'+stage()
    // right below the map: the picked staircase's Details (one card: the illustration, then everything to log and read),
    // or the list of staircases; nothing in between (owner's request, 2026-10-21)
    +'<div class="cmppanel"><div class="cmppane" id="cmppane">'+(V.tab==='det'&&!onMap()?detPane():listPane())+'</div></div></div>'
    +'<p class="mut cmpsv">'+esc(HWCampusData.surveyNote())+'</p>'
    +(M.st==='ready'?'<div class="row"><button type="button" data-a="cmpme">'+(meOn()?'STOP SHOWING WHERE I AM':'SHOW WHERE I AM')+'</button></div>'
      :'<div class="row"><button type="button" data-a="cmpgps"'+(V.gps==='wait'?' disabled':'')+'>'+(V.gps==='wait'?'FINDING YOU...':'SHOW WHERE I AM')+'</button>'+(V.me?'<button type="button" class="g" data-a="cmpforget">HIDE MY POSITION</button>':'')+'</div>')
    +(ME.last&&!ME.far&&ME.st==='gps'?nearTxt(ME.last.lat,ME.last.lng,ME.last.accuracy):'')+mine()+(typeof HWCampusMagic!=='undefined'?HWCampusMagic.below():'')
    +(V.err?'<p class="cmpe" role="alert">'+esc(V.err)+' Pick a staircase on the map or in the list instead.</p>':'')+where()+weather()
    +'<div class="cmpwx"><b>'+ico('map')+' Campus-wide activity</b><p class="mut">Not available. HealthWiz does not collect anyone else\'s location, so there is nothing to show here. Your own visits stay on your device.</p></div></div>'
    +(typeof HWCampusStairs!=='undefined'?HWCampusStairs.html():'')}

/* ---------- actions ---------- */
const keep=()=>{persist();const y=window.scrollY;render();window.scrollTo(0,y)};
const toDet=()=>{const e=D0.querySelector('#cmpdet .cmph');if(e)e.focus({preventScroll:true})};
/** One path for every way of choosing a staircase: a marker, the list, a link in the details, focus(). */
function pick(id,from){const s=rec(id);if(!s)return;const fresh=V.sid!==id;V.sid=id;V.grp=null;V.tab='det';if(!onMap())V.vw=true;V.fly=placed(s)&&from!=='restore';V.pop=fresh;if(from==='find')V.q='';if(fresh&&onMap())HWCampusHud.setSize('peek');if(typeof HWStairs!=='undefined')HWStairs.choose(id);
  // a heart tapped on the map, or picked in the search on the map: the stop's disc zooms out of it (js/v6-campus-stop.js)
  const stop=(from==='map'||from==='find')&&placed(s)&&M.st==='ready'&&typeof HWCampusStop!=='undefined';keep();V.pop=false;if(stop)HWCampusStop.open(id);else if(from!=='map'){if(onMap()){const e=$id('cmpstage');if(e)e.scrollIntoView({block:'nearest'})}toDet()}}
// a GPS check-in (js/v6-gps.js) found the staircase the player is at: it becomes the selection, its Details open
HWEvents.on('activity:checkin',e=>{if(!e||!rec(e.sid))return;V.sid=e.sid;V.grp=null;V.tab='det';V.fly=placed(rec(e.sid));persist();if(S.v==='campus')setTimeout(()=>{if(S.v==='campus')keep()},0)});
function pickGroup(key){if(!points().some(g=>g.key===key))return;V.grp=key;V.sid=null;V.tab='det';V.fly=false;keep();toDet()}
acts.cmpgo=()=>go('campus');
acts.cmppick=d=>pick(d.id,d.from==='find'?'find':'list');
acts.cmptab=d=>{V.tab=d.t==='det'?'det':'list';keep();if(V.tab==='list'&&onMap()){const e=$id('cmppane');if(e)e.scrollIntoView({block:'start'})}};
acts.hudsheetopen=()=>openSheet(null,'half');
acts.cmpfilt=d=>{if(FILTERS.indexOf(d.f)<0)return;V.f=d.f;keep()};
acts.cmpqx=()=>{V.q='';keep();const q=$id('cmpq');if(q)q.focus()};
acts.cmpclear=()=>{V.sid=V.grp=null;V.tab='list';keep()};
acts.cmpstair=d=>{if(!rec(d.id))return;pick(d.id,'list');const l=$id('cmplog');if(l)l.scrollIntoView({block:'start'})};
acts.cmpshow=()=>{const k=selKey();if(k&&M.ctl)M.ctl.flyToGroup(k)};
acts.cmpmode=d=>{V.mode=d.m==='realistic'?'realistic':'fantasy';if(M.ctl)M.ctl.setMode(V.mode);persist();const c=$id('cmpcard');if(!c||!onMap())return keep();c.dataset.mode=V.mode;D0.querySelectorAll('.cmpmode').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.m===V.mode)));mount3d();if(HWCampusHud.state.leg)keep()};
acts.cmprotl=()=>{if(M.ctl)M.ctl.map.easeTo({bearing:M.ctl.map.getBearing()-30,duration:HWUI.reduced()?0:400})};acts.cmprotr=()=>{if(M.ctl)M.ctl.map.easeTo({bearing:M.ctl.map.getBearing()+30,duration:HWUI.reduced()?0:400})};
acts.cmpzin=()=>{if(M.ctl)M.ctl.zoom(1)};acts.cmpzout=()=>{if(M.ctl)M.ctl.zoom(-1)};acts.cmpnorth=()=>{if(M.ctl)M.ctl.north()};
acts.cmpfit=()=>{if(M.ctl)M.ctl.fit()};
acts.cmptilt=()=>{if(!M.ctl)return;const on=M.ctl.map.getPitch()<=5;M.ctl.tilt(on);const b=$id('cmptilt');if(b)b.setAttribute('aria-pressed',String(on))};
// the switches change the map in place: no page redraw (it made each switch look like a reload and lag)
const press=(a,v)=>{const b=D0.querySelector('[data-a="'+a+'"]');if(b)b.setAttribute('aria-pressed',String(v))};
acts.cmpterr=()=>{V.terr=!V.terr;persist();if(M.ctl)M.ctl.terrain(V.terr);else keep();press('cmpterr',V.terr)};
acts.cmpbld=()=>{V.bld=!V.bld;persist();if(M.ctl)M.ctl.buildings(V.bld);else keep();press('cmpbld',V.bld)};
acts.cmpfull=()=>{V.full=!V.full;keep();const b=$id('cmpfullb')||D0.querySelector('.hudbtn');if(b)b.focus({preventScroll:true})};
acts.cmpdetfs=()=>{V.full=false;V.tab='det';keep();const d=$id('cmpdet');if(d){d.scrollIntoView({block:'start'});toDet()}};
D0.addEventListener('keydown',e=>{if(e.key==='Escape'&&!V.full&&S.v==='campus'&&V.vw&&$id('cmpvw')&&!D0.querySelector('dialog[open], .hwh-pop:not([hidden])')){acts.cmpvwclose();return}
  if(e.key==='Escape'&&V.full&&S.v==='campus'&&!HWCampusHud.state.menu&&!HWCampusHud.state.aware&&!HWCampusHud.state.leg){V.full=false;keep();const b=$id('cmpfullb')||D0.querySelector('.hudbtn');if(b)b.focus({preventScroll:true})}});
acts.cmpvwopen=()=>{V.vw=true;keep()};
acts.cmpvwclose=()=>{V.vw=false;if(P3.ctl&&P3.shown){P3.ctl.hide();P3.shown=''}keep();const b=D0.querySelector('[data-a="cmpvwopen"]');if(b)b.focus({preventScroll:true})};
acts.cmpvwc=d=>{const c=P3.ctl;if(!c)return;const v=d.v;if(v==='left')c.rotateBy(-30);else if(v==='right')c.rotateBy(30);else if(v==='in')c.zoomBy(.78);else if(v==='out')c.zoomBy(1.28);
  else if(v==='reset')c.reset();else if(v==='spin')c.spin(!c.spinning);paintShapes()};
acts.cmpvwshape=d=>{if(P3.ctl&&SHAPES.some(x=>x[0]===d.shape)){P3.ctl.setShape(d.shape);paintShapes()}};
acts.cmpforget=()=>{V.me=null;V.err='';if(M.ctl)M.ctl.me(null);keep()};
// the search filters the list in place, so typing keeps the focus
D0.addEventListener('input',e=>{if(!e.target||(e.target.id!=='cmpq'&&e.target.id!=='cmpfind'))return;V.q=e.target.value.slice(0,80);persist();const L=shown(),l=$id('cmplist'),c=$id('cmpcount'),r=$id('cmpfindres');
  if(l)l.innerHTML=items(L);if(c)c.textContent=countTxt(L);if(r)r.innerHTML=findRes();filterMap()});
// Enter in the search on the map picks the first match
D0.addEventListener('keydown',e=>{if(e.key!=='Enter'||!e.target||e.target.id!=='cmpfind')return;const f=finds()[0];if(f){e.preventDefault();V.q='';persist();pick(f.id,'find')}});
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
/** Select a staircase and bring the Observatory (the top of the page) into view. */
function show(id){if(V.sid===id&&rec(id)){V.grp=null;V.tab='det'}else if(!focus(id))return false; // already selected: the camera stays where it is
  persist();render();const e=$id('cmpcard');if(e)e.scrollIntoView({block:'start'});return true}
/** Select a staircase from elsewhere (before go('campus')): the map flies to it; with no coordinates, it is not moved. */
function focus(id){const s=rec(id);if(!s)return false;V.sid=id;V.grp=null;V.tab='det';if(!onMap())V.vw=true;V.fly=placed(s);if(typeof HWStairs!=='undefined')HWStairs.choose(id);persist();if(M.ctl&&S.v==='campus')sync();return true}
/** Open the Details tab (the Stairs card and its routes): the logging forms of the selection, or the GPS check-in. */
function openLog(){V.grp=null;V.tab='det';V.full=false;if(V.sid&&typeof HWStairs!=='undefined')HWStairs.choose(V.sid);persist()}

/* ---------- the page, and its door in the Health Hall (after the Science Laboratory's) ---------- */
pages.campus=()=>page();
PAR.campus='health';
BN.campus=['🗺','Campus Health Observatory','The campus staircases, your climbs, the air outside.','rgba(92,192,90,.20)'];
DIS.campus='Locations are unverified app data unless marked measured. Raised ground and building heights are illustrative. Your position is shown on this screen only and is never saved or sent. '+DIS.stair; // the Stairs section: its pacing and heart-rate notice
const door=()=>'<div class="card cmpdoor" id="cmp-door"><h3>'+ico('map')+' CAMPUS HEALTH OBSERVATORY</h3><p>See the campus staircases on a map, how each one was measured, and check the air before you go.</p><button type="button" data-a="cmpgo">OPEN THE OBSERVATORY</button></div>';
{const p=pages.health;pages.health=function(){return p.apply(this,arguments)+door()}}
HWEvents.on('page:viewed',e=>{if(e.view!=='campus'){meStop(true);ME.choose=false;ME.auto=false;unmount();ME.used=false;unmount3d();V.me=null;V.err='';V.gps='';fsClass()}});
HWEvents.on('data:reset',()=>{meStop(true);unmount();unmount3d();V.sid=V.grp=null;V.cam=null;V.me=null;try{sessionStorage.removeItem(VK)}catch(e){}});
HWEvents.on('live:updated',()=>{if(S.v==='campus')keep()});
addEventListener('pagehide',()=>{if(M.ctl)persist()});

/* Layout and the panel (they work without the map). The map's own pieces (markers, clusters, labels) are in
   observatory/observatory.css. The map stage takes the mode's colour tokens; the panel keeps the app's theme. */
// the styles are in v6-campus-css.js (kept apart so each file stays under the 64 KB limit of tests/00-fidelity)
return{points,unmapped,focus,show,openLog,why,openSheet,closeSheet,here,redraw:()=>keep(),get selected(){return V.sid},get map(){return M.ctl},get viewer(){return P3.ctl},
  get me(){return{st:ME.st,far:ME.far,follow:ME.follow,choose:ME.choose,avatar:avGet(),last:ME.last}},
  get state(){return{sid:V.sid,grp:V.grp,mode:V.mode,full:V.full,vw:V.vw,v3:P3.st,shown:P3.shown,tab:V.tab,f:V.f,q:V.q,terr:V.terr,bld:V.bld,cam:V.cam,map:M.st,msg:M.msg,me:V.me,err:V.err}}}})();
