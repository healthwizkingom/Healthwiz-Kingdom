/* v6: the Campus Health Observatory's staircase records, and the links between it and the Stairs page. Not part of the
   original. Integration Phase 1 (docs/OBSERVATORY_INTEGRATION_PROMPT.md).
   * One copy of the staircases: the records are built when needed from STAIRS (js/hw-02-core.js, the original v5.4.3
     data), HWStairs.STUDY (js/v6-stairs.js, the Group 14 F21 report, Table 2: ST14, ST19, ST20) and the survey overlay
     data/stair-survey.json (made from the Word sheet by tools/import_stair_sheet.py). The record fields and labels
     follow the prototype (prototypes/campus-observatory/data/staircases.json and js/survey.js). Nothing is written
     back into STAIRS. Statuses, shared coordinates, notes and "Needs checking" are worked out here, not stored.
   * The survey file is fetched only over http(s). Opened from the device (file://, the single-file build) it is
     skipped without a request or an error, and the page says the survey was not loaded.
   * Activity per staircase is read from the saved stair sessions by m.sid (read-only; no schema change).
   * Logging happens in the Observatory's Details (owner's request, 2026-10-20), so the old trip (Start Stair Session →
     the Stairs page → Return to Observatory, kept in sessionStorage 'hw_obs_ctx') is gone; start(id) now selects the
     staircase and opens its Details. A leftover 'hw_obs_ctx' from an older version is removed. No health data is put
     in a URL. */
const HWCampusData=(()=>{
const APP='HealthWiz app data (STAIRS list from the original v5.4.3 app); source and method not recorded';
const REAL='Real location, recorded on site by the survey team (coordinate kept in the stair list, js/hw-02-core.js)';
const F21='Group 14 F21 Full Written Report (v4), Table 2';
const STEEP=45; // degrees: a stored angle above this is unusually steep for a staircase, so it is flagged for re-measurement
const CK='hw_obs_ctx',SURVEY='data/stair-survey.json';
const deg=r=>r*180/Math.PI;

/* ---------- the records ---------- */
const key=q=>q.lat.toFixed(7)+','+q.lng.toFixed(7);
function base(){const S2=typeof HWStairs!=='undefined'?HWStairs.STUDY:[],G={},N={};
  STAIRS.forEach(q=>{if(hasXY(q))(G[key(q)]=G[key(q)]||[]).push(q.id);(N[q.name]=N[q.name]||[]).push(q.id)});
  return STAIRS.map(q=>{const xy=hasXY(q),m=S2.find(x=>x.id===q.id)||null,sh=xy?G[key(q)].filter(i=>i!==q.id):[],same=N[q.name].filter(i=>i!==q.id),notes=[];
    if(!xy)notes.push('No coordinates recorded: listed, not placed on the map.');
    if(sh.length)notes.push('Shares one stored coordinate with '+sh.join(', ')+'.');
    if(same.length)notes.push('Same name as '+same.join(', ')+' in the app data: may be the same staircase.');
    if(q.angle>STEEP)notes.push('Stored angle is unusually steep for a staircase: flagged for re-measurement.');
    if(m){notes.push('Staircase '+m.k+' ('+m.n+') in the Group 14 F21 report: step rise and run measured. The report ranks it '+m.rank+' among its three stairs.');
      if(Math.abs(m.th-q.angle)>.005)notes.push('The F21 angle ('+m.th.toFixed(2)+'°) differs from the app angle ('+q.angle.toFixed(2)+'°): check against the report.')}
    return{id:q.id,name:q.name,appFloorLabel:q.floor,appCategory:q.cat,
      latitude:xy?q.lat:null,longitude:xy?q.lng:null,locationSource:xy?REAL:null,locationStatus:xy?'real':'missing',
      estimatedAngle:q.angle,angleSource:m?F21+': θ = arctan(rise ÷ run) from measured steps':APP,angleStatus:m?'calculated from measured step rise and run':'estimated',
      orientationDeg:null,orientationSource:null,stepCount:null,floorCount:null,verticalRise_m:null,
      measuredStep:m?{rise_m:m.rise,run_m:m.run,hypotenuse_m:m.hyp,source:F21,reportStaircase:m.k,reportName:m.n,reportRank:m.rank}:null,
      measurementStatus:m?'partially measured':'not surveyed',geometryStatus:'not surveyed',sharedLocationWith:sh,
      survey:null,photos:[],verification:{status:'unverified',by:null,date:null},needsChecking:!!(same.length||q.angle>STEEP),notes:notes.join(' ')}})}

/** The survey laid over the records, by the prototype's rules (js/survey.js): the measured bottom position replaces the
    estimate, θ = arctan(riser ÷ tread) per flight (calculated), step count and rise only from complete flights. */
function applySurvey(R,sv){if(!sv||!sv.stairs||typeof sv.stairs!=='object')return 0;let n=0;
  R.forEach(s=>{const v=sv.stairs[s.id];if(!v||typeof v!=='object')return;n++;
    s.app={latitude:s.latitude,longitude:s.longitude,locationStatus:s.locationStatus,estimatedAngle:s.estimatedAngle,angleStatus:s.angleStatus,orientationDeg:s.orientationDeg};
    const rec=v.survey||{},by=[rec.by,rec.date,rec.tool].filter(Boolean).join(', '),cp=v.complete||{};
    s.survey=Object.assign({},v,{label:(typeof v.source==='string'&&v.source?v.source:'Survey sheet')+(by?' ('+by+')':''),recordComplete:!!cp.record});
    if(v.bottom&&isFinite(v.bottom.lat)&&isFinite(v.bottom.lng)){s.latitude=+v.bottom.lat;s.longitude=+v.bottom.lng;s.locationStatus='measured';
      s.locationSource=s.survey.label+', phone GPS at the bottom step'+(v.bottom.accuracy_m!=null?', ±'+v.bottom.accuracy_m+' m':', accuracy not recorded');s.locationAccuracy_m=v.bottom.accuracy_m}
    const F=Array.isArray(v.flights)?v.flights.map(f=>Object.assign({},f)):[];
    if(F[0]&&F[0].heading_deg!=null){s.orientationDeg=F[0].heading_deg;s.orientationSource=s.survey.label+', heading of flight 1 (measured)';s.orientationStatus='measured'}
    const all=k=>F.length&&F.every(f=>f[k]!=null);
    if(all('risers')&&cp.flights){s.stepCount=F.reduce((t,f)=>t+f.risers,0);s.stepCountSource=s.survey.label+' (counted)'}
    if(all('totalRise_cm')&&cp.flights){s.verticalRise_m=+(F.reduce((t,f)=>t+f.totalRise_cm,0)/100).toFixed(2);s.verticalRiseStatus='measured'}
    else if(all('risers')&&all('riser_cm')&&cp.flights){s.verticalRise_m=+(F.reduce((t,f)=>t+f.risers*f.riser_cm,0)/100).toFixed(2);s.verticalRiseStatus='calculated (risers × riser height)'}
    const fa=F.filter(f=>f.riser_cm&&f.tread_cm);
    if(fa.length){fa.forEach(f=>{f.angle_deg=+deg(Math.atan(f.riser_cm/f.tread_cm)).toFixed(2)});const w=fa.reduce((t,f)=>t+(f.risers||1),0);
      s.surveyAngle=+(fa.reduce((t,f)=>t+f.angle_deg*(f.risers||1),0)/w).toFixed(2)}
    s.flightsSurveyed=F;
    // values from the shared survey database (data/stair-survey.json, tools/stair_survey_from_records.py): totals and photos
    if(Array.isArray(v.photos))s.photos=v.photos.filter(p=>p&&typeof p.src==='string').map(p=>({src:p.src,caption:p.caption||'Photo'}));
    if(s.stepCount==null&&v.stepCount!=null){s.stepCount=v.stepCount;s.stepCountSource=(v.source||s.survey.label)+' (counted)'}
    if(s.verticalRise_m==null&&v.verticalRise_m!=null){s.verticalRise_m=v.verticalRise_m;s.verticalRiseStatus='measured total · '+(v.source||s.survey.label)}
    if(v.notes)s.notes=(s.notes?s.notes+' ':'')+v.notes;
    if(cp.flights)s.geometryStatus='surveyed';
    s.measurementStatus=cp.flights&&cp.position?'surveyed':'partially measured'});
  return n}
/** The 3D plan of a fully surveyed staircase (metres, one entry per flight), or null when anything is missing. */
function surveyPlan(s){const v=s&&s.survey;if(!v||!v.complete||!v.complete.flights)return null;
  return v.flights.map((f,i,A)=>({n:f.risers,riser:f.riser_cm/100,tread:f.tread_cm/100,width:f.width_cm/100,turn:i<A.length-1?f.turn:null,
    landingLength:f.landing&&f.landing.length_cm?f.landing.length_cm/100:null,landingWidth:f.landing&&f.landing.width_cm?f.landing.width_cm/100:null}))}

/* ---------- the survey file: http(s) only ---------- */
let SV=null,SVst='idle',SVn=0,R=null; // SVst: idle | loading | ok | error | local (opened from the device: not fetched)
function load(){if(SVst!=='idle')return;const web=/^https?:$/.test(location.protocol);if(!web||typeof fetch!=='function'){SVst='local';return}
  SVst='loading';
  const done=()=>{R=null;records();if(S.v==='campus'){const y=window.scrollY;render();window.scrollTo(0,y)}}; // the Observatory shows the survey state
  fetch(SURVEY,{cache:'no-cache'}).then(r=>r.ok?r.json():Promise.reject(new Error('HTTP '+r.status))).then(j=>{SV=j&&typeof j==='object'?j:null;SVst='ok';done()})
    .catch(()=>{SV=null;SVst='error';done()})}
/** Every staircase record, in STAIRS order (built once, rebuilt when the survey arrives). Read them; do not change them. */
function records(){load();if(!R){R=base();SVn=applySurvey(R,SV)}return R}
const record=id=>records().find(s=>s.id===id)||null;
const placed=s=>!!s&&s.latitude!=null&&s.longitude!=null;
function surveyNote(){const n=(records(),SVn);
  return SVst==='ok'?(n?'Survey data: '+n+' staircase'+(n>1?'s':'')+' from the survey sheet ('+SURVEY+').':'Survey data: none imported yet.')
    :SVst==='local'?'Survey data: not loaded (the app was opened from this device, so the survey file cannot be read). The app\'s own values are shown.'
    :SVst==='error'?'Survey data: the survey file could not be loaded. The app\'s own values are shown.':'Survey data: loading.'}
/** The prototype's labels for a record: [kind, text]; kind is est | calc | part | miss | flag. */
function labels(s){const L=[],m=s.measuredStep;
  L.push(!placed(s)?['miss','No location recorded']:s.locationStatus==='measured'?['part','Measured location (survey)']:['real','Real location']);
  L.push(s.surveyAngle!=null?['calc','Angle from surveyed steps']:s.estimatedAngle==null?['miss','Angle unavailable']:m?['calc','Angle from measured steps']:['est','Estimated angle']);
  L.push(s.orientationStatus==='measured'?['part','Measured orientation']:s.orientationDeg!=null?['est','Estimated orientation']:['miss','Orientation not surveyed']);
  L.push(s.measurementStatus==='surveyed'?['part','Surveyed']:s.survey?['part','Partially surveyed']:s.measurementStatus==='partially measured'?['part','Partially measured: step size only']:['miss','Not yet surveyed']);
  if(s.survey&&!s.survey.recordComplete)L.push(['flag','Survey record incomplete']);
  if(s.needsChecking)L.push(['flag','Needs checking']);
  return L}

/* ---------- activity from the saved sessions (read-only) ---------- */
function activity(id){const L=(typeof HWStairs!=='undefined'?HWStairs.all():[]).filter(s=>s.sid===id),d=L.map(s=>s.d).sort();
  return{sessions:L.length,steps:L.reduce((t,s)=>t+s.total,0),last:d.length?d[d.length-1]:null,firstCheckIn:st.gp&&st.gp.v&&st.gp.v[id]||null}}

/* ---------- picking a staircase to log ---------- */
try{sessionStorage.removeItem(CK)}catch(e){} // the old trip's context (versions before 2026-10-20)
/** Select the staircase in the Observatory and open its Details, where the logging forms are. Nothing is started or saved. */
function start(id){if(typeof HWStairs==='undefined'||!HWStairs.choose(id))return false;if(typeof HWCampus!=='undefined')HWCampus.focus(id);go('stair');return true}

return{records,record,placed,labels,activity,surveyNote,applySurvey,surveyPlan,start,load,STEEP,
  get survey(){return{status:SVst,stairs:SVn}}}})();
