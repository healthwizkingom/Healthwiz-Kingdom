/* v6: Module 10, the Astral Navigator: the Navigator's Compass in a staircase's Details in the Campus Health Observatory. Not part of
   the original.
   What it does: works out where the Sun is in the sky, for the picked staircase's own stored coordinate and the device's clock, and
   says how much the app can honestly tell about sunlight on that staircase. A geometry tool: it measures no temperature, humidity,
   UV, shade or heat strain, and it never calls a staircase safe or dangerous.

   Solar position (solar()): the NOAA Global Monitoring Laboratory solar calculator method (the "NOAA_Solar_Calculations" spreadsheets,
   which NOAA says are based on Meeus, Astronomical Algorithms): Julian century from the instant, the Sun's mean longitude and anomaly,
   equation of centre, apparent longitude, obliquity, declination, equation of time, true solar time, hour angle, then elevation and
   azimuth. The time is the instant itself (Date.getTime(), which is UTC), so the device's time zone cannot shift the result; it is only
   used to show the time. Solar noon is NOT taken as 12:00: at Kulim it falls between 13:01 (early November) and 13:32 (mid-February)
   Malaysia time, because of the longitude inside UTC+8 and the equation of time. Output in degrees: elevation is geometric (no atmosphere); `apparent` adds NOAA's approximate
   refraction (their table, standard conditions). Azimuth: clockwise from true north (N 0°, E 90°, S 180°, W 270°).
   Checked in tests/95-astral.test.mjs against NREL's Solar Position Algorithm (pvlib 0.16.1 spa_python) at 15 instants and places
   (daytime, near sunrise and sunset, night, solstices, equinox, both hemispheres, midnight sun) and against observatory/sky.js.

   Sunlight on the staircase (assess()), the strongest level the data supports (docs/CALCULATIONS.md):
     Level 1  solar position only. Used when the staircase has no orientation, or is indoors. Today every staircase is here: the survey
              sheet (data/stair-survey.json) has no flight heading and no indoor/outdoor entry for any of them.
     Level 2  orientation-aware: with a heading (the survey's flight 1 heading, or the bearing between surveyed bottom and top points
              when their GPS accuracy makes it meaningful) the Sun's direction relative to the climb (ahead, behind, left, right). It
              describes direction only, never "in shade".
     Level 3/4 (shadow lengths, 3D occlusion) are not used: the app has no measured heights of the walls, roofs and trees around the
              stairs, and the 3D campus is illustrative. shadowLength() is here for a future survey, tested, and not shown.
   Location: the picked staircase's coordinate (HWCampusData); without one, the college point already in js/v6-live.js (HWLive.KMK,
   approximate). No second copy of the campus coordinates.
   Refresh: every 60 s while the compass is on screen and the tab is visible, and on REFRESH. Nothing is saved except one device
   preference (localStorage 'hw_astral', {fx, open}); no health data. Reduced motion: the needle jumps and nothing glows. */
const HWAstral=(()=>{
const R=Math.PI/180,D=document,$i=i=>D.getElementById(i),K='hw_astral';
const clamp=(v,a,b)=>v<a?a:v>b?b:v,f1=(x,d)=>(+x).toLocaleString('en',{minimumFractionDigits:d,maximumFractionDigits:d});
const fin=x=>typeof x==='number'&&isFinite(x);
const norm=a=>((a%360)+360)%360;
const acosC=x=>Math.acos(clamp(x,-1,1)),asinC=x=>Math.asin(clamp(x,-1,1));

/* =====================================================================================================================
   THE MATH (pure)
   ===================================================================================================================== */
/** NOAA refraction table (degrees to add to the geometric elevation e, in degrees). Standard conditions; real air varies. */
function refraction(e){
  if(e>85)return 0;const t=Math.tan(e*R);
  const s=e>5?58.1/t-.07/t**3+.000086/t**5:e>-.575?1735+e*(-518.2+e*(103.4+e*(-12.79+e*.711))):-20.772/t;
  return s/3600}
/** Where the Sun is. {latitude, longitude} in degrees (east positive), date a Date (an instant). →
    {ok, status:'ok'|'invalid', reason, elevation (geometric °), apparent (° with refraction), azimuth (° from true north, clockwise;
     null with the Sun exactly overhead), declination °, eqTime (minutes), hourAngle °, solarNoonUTC (minutes after 00:00 UTC), jd} */
function solar(o){
  const lat=o&&o.latitude,lng=o&&o.longitude,date=o&&o.date;
  const bad=reason=>({ok:false,status:'invalid',reason,elevation:null,apparent:null,azimuth:null});
  if(!fin(lat)||lat<-90||lat>90)return bad('latitude must be a number from −90 to 90');
  if(!fin(lng)||lng<-180||lng>180)return bad('longitude must be a number from −180 to 180');
  if(!(date instanceof Date)||!fin(date.getTime()))return bad('the date is not a valid date');
  const y=date.getUTCFullYear();if(y<1800||y>2100)return bad('the date is outside 1800–2100, where NOAA says these approximations are very good');
  const ms=date.getTime(),jd=ms/864e5+2440587.5,T=(jd-2451545)/36525;
  const L0=norm(280.46646+T*(36000.76983+T*.0003032)),M=357.52911+T*(35999.05029-.0001537*T),e=.016708634-T*(.000042037+.0000001267*T);
  const C=Math.sin(M*R)*(1.914602-T*(.004817+.000014*T))+Math.sin(2*M*R)*(.019993-.000101*T)+Math.sin(3*M*R)*.000289;
  const om=125.04-1934.136*T,lam=L0+C-.00569-.00478*Math.sin(om*R);
  const eps0=23+(26+(21.448-T*(46.815+T*(.00059-T*.001813)))/60)/60,eps=eps0+.00256*Math.cos(om*R);
  const dec=asinC(Math.sin(eps*R)*Math.sin(lam*R))/R;
  const yy=Math.tan(eps*R/2)**2;
  const eq=4*(yy*Math.sin(2*L0*R)-2*e*Math.sin(M*R)+4*e*yy*Math.sin(M*R)*Math.cos(2*L0*R)-.5*yy*yy*Math.sin(4*L0*R)-1.25*e*e*Math.sin(2*M*R))/R;
  const minUTC=(((ms%864e5)+864e5)%864e5)/6e4,tst=((minUTC+eq+4*lng)%1440+1440)%1440;
  const ha=tst/4<0?tst/4+180:tst/4-180;
  const zen=acosC(Math.sin(lat*R)*Math.sin(dec*R)+Math.cos(lat*R)*Math.cos(dec*R)*Math.cos(ha*R))/R,elev=90-zen;
  const den=Math.cos(lat*R)*Math.sin(zen*R);let az=null;
  if(Math.abs(den)>1e-9){const a=acosC((Math.sin(lat*R)*Math.cos(zen*R)-Math.sin(dec*R))/den)/R;az=ha>0?norm(a+180):norm(540-a)}
  else if(Math.abs(zen)>1e-6)az=lat>=0?180:0;                                           // at a pole: due south (north pole) or north
  return{ok:true,status:'ok',reason:'',elevation:elev,apparent:elev+refraction(elev),azimuth:az,declination:dec,eqTime:eq,hourAngle:ha,
    solarNoonUTC:((720-4*lng-eq)%1440+1440)%1440,jd}}
/** Initial great-circle bearing (° from true north, clockwise) from point 1 to point 2. */
function bearing(lat1,lng1,lat2,lng2){
  if(![lat1,lng1,lat2,lng2].every(fin))return null;if(lat1===lat2&&lng1===lng2)return null;
  const p1=lat1*R,p2=lat2*R,dl=(lng2-lng1)*R;
  return norm(Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))/R)}
/** Ground distance in metres (haversine, mean Earth radius 6 371 000 m). */
function distance(lat1,lng1,lat2,lng2){if(![lat1,lng1,lat2,lng2].every(fin))return null;
  const a=Math.sin((lat2-lat1)*R/2)**2+Math.cos(lat1*R)*Math.cos(lat2*R)*Math.sin((lng2-lng1)*R/2)**2;return 2*6371000*asinC(Math.sqrt(a))}
/** Signed angle from the stair's heading to the Sun's azimuth, in (−180, 180]: positive = the Sun is to the right (clockwise). */
function relative(az,heading){if(!fin(az)||!fin(heading))return null;let d=norm(az-heading);if(d>180)d-=360;return d}
/** Length (m) of the shadow of an obstacle h metres tall on a level plane, for a Sun elevation in degrees; null when the Sun is too
    low (below 1°, where the length runs off to infinity and refraction dominates) or the inputs are not valid. */
function shadowLength(h,elevDeg){if(!fin(h)||h<=0||!fin(elevDeg)||elevDeg<1||elevDeg>90)return null;return h/Math.tan(elevDeg*R)}
const POINTS=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const NAMES={N:'north',NNE:'north-north-east',NE:'north-east',ENE:'east-north-east',E:'east',ESE:'east-south-east',SE:'south-east',SSE:'south-south-east',
  S:'south',SSW:'south-south-west',SW:'south-west',WSW:'west-south-west',W:'west',WNW:'west-north-west',NW:'north-west',NNW:'north-north-west'};
const point=az=>fin(az)?POINTS[Math.round(norm(az)/22.5)%16]:null;
/** Above, low or below the horizon, from the apparent (refracted) elevation of the Sun's centre. */
const horizon=s=>!s||!s.ok?'unknown':s.apparent<=0?'below':s.apparent<6?'low':'above';

/** The staircase's heading for this tool: [deg, source] or null. A surveyed flight heading first; else the bearing from the surveyed
    bottom to the surveyed top, only when both have a GPS accuracy and the worst-case heading error atan((acc1 + acc2) ÷ distance) is at
    most 15°: on a short stair a few metres of GPS error swing the bearing by tens of degrees. */
function headingOf(rec){
  if(!rec)return null;
  if(fin(rec.orientationDeg)&&rec.orientationDeg>=0&&rec.orientationDeg<=360)return{deg:norm(rec.orientationDeg),src:rec.orientationSource||'survey sheet',err:null};
  const v=rec.survey,b=v&&v.bottom,t=v&&v.top;
  if(b&&t&&fin(+b.lat)&&fin(+b.lng)&&fin(+t.lat)&&fin(+t.lng)){
    const d=distance(+b.lat,+b.lng,+t.lat,+t.lng),acc=fin(b.accuracy_m)&&fin(t.accuracy_m)?b.accuracy_m+t.accuracy_m:null;
    if(d&&acc!=null){const err=Math.atan(acc/d)/R;if(err<=15)return{deg:bearing(+b.lat,+b.lng,+t.lat,+t.lng),src:'bearing from the surveyed bottom to the surveyed top ('+Math.round(d)+' m apart)',err}}}
  return null}
/** 'indoor' | 'outdoor' | null (not recorded), from the survey sheet's indoor/outdoor column. */
function placeOf(rec){const s=rec&&rec.survey&&rec.survey.indoorOutdoor;if(typeof s!=='string')return null;const k=s.toLowerCase();
  return /indoor|inside|dalam/.test(k)?'indoor':/outdoor|outside|luar|open/.test(k)?'outdoor':null}
/** What can be said about direct sun on this staircase now. → {level, kind, title, text, rel?, heading?} */
function assess(rec,sun){
  const pl=placeOf(rec),hd=headingOf(rec),hz=horizon(sun);
  if(!sun||!sun.ok)return{level:0,kind:'nosun',title:'Sun position unavailable',text:'The Sun’s position could not be worked out ('+(sun&&sun.reason||'no valid time or place')+').'};
  if(pl==='indoor')return{level:1,kind:'indoor',title:'Indoor shade not assessed',text:'The survey lists this staircase as indoors. Windows and openings are not modelled, so sunlight inside is not assessed. The Sun’s position is shown for context.'};
  if(hz==='below')return{level:1,kind:'night',title:'No direct sunlight now',text:'The Sun is below the horizon, so no stair gets direct sunlight now.'+(hd?'':' This staircase’s orientation is not surveyed.')};
  if(!hd)return{level:1,kind:'noheading',title:'Orientation unavailable',text:'This staircase’s direction is not surveyed, so the tool cannot say how the Sun falls on it. Walls, roofs and trees are not modelled either: whether it is in sun or shade is not assessed.'};
  const rel=relative(sun.azimuth,hd.deg),a=Math.abs(rel);
  const where=a<=30?'ahead of you as you climb':a>=150?'behind you as you climb':rel>0?'on your right as you climb':'on your left as you climb';
  return{level:2,kind:'heading',rel,heading:hd,title:'The Sun is '+where,
    text:'Climbing direction '+Math.round(hd.deg)+'° ('+hd.src+'); the Sun is '+Math.round(a)+'° '+(rel>=0?'clockwise':'anticlockwise')+' from it.'
      +(pl==='outdoor'?'':' The survey does not say whether this staircase is indoors or outdoors.')
      +' This describes direction only. Walls, roofs, trees and buildings are not modelled, so it does not tell you whether the steps are in sun or shade.'}}

/* =====================================================================================================================
   THE COMPASS (a group in the staircase's Details, js/v6-campus.js)
   ===================================================================================================================== */
const pref=(()=>{try{const o=JSON.parse(localStorage.getItem(K)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch(e){return{}}})();
const keep=()=>{try{localStorage.setItem(K,JSON.stringify(pref))}catch(e){}};
const fx=()=>pref.fx!==0,open=()=>pref.open!==0;
const reduced=()=>typeof HWUI!=='undefined'?HWUI.reduced():false;
let tick=0,cur=null;                                     // cur: the id of the staircase the compass is drawn for
/** The place the Sun is worked out for: the staircase's stored coordinate, or the college's approximate point. */
function where(rec){
  if(rec&&fin(rec.latitude)&&fin(rec.longitude))return{lat:rec.latitude,lng:rec.longitude,approx:false,
    txt:rec.id+'’s '+(rec.locationStatus==='measured'?'surveyed':'stored')+' location ('+f1(rec.latitude,4)+'°, '+f1(rec.longitude,4)+'°)'};
  const k=typeof HWLive!=='undefined'&&HWLive.KMK;
  if(k&&fin(k.lat)&&fin(k.lon))return{lat:k.lat,lng:k.lon,approx:true,txt:'the approximate point for '+k.name+' ('+f1(k.lat,4)+'°, '+f1(k.lon,4)+'°): this staircase has no coordinate'};
  return null}
function clockTxt(d){
  const off=-d.getTimezoneOffset(),sg=off>=0?'+':'−',hh=String(Math.floor(Math.abs(off)/60)).padStart(2,'0'),mm=String(Math.abs(off)%60).padStart(2,'0');
  let tz='';try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){}
  return d.toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' (your device clock, UTC'+sg+hh+':'+mm+(tz?', '+tz:'')+')'}
const minClock=m=>{const d=new Date(),u=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())+m*6e4;return new Date(u).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})};
function help(){
  const cite=typeof HWSources!=='undefined'?'<b class="hwx-h">SOURCES</b><ul class="hwx-src">'+['noaasol','noaaeq'].map(HWSources.cite).join('')+'</ul>':'';
  return HWHelp.btn('astral','Navigator’s Compass: how it is calculated',
    '<p><b>Inputs.</b> The picked staircase’s stored latitude and longitude (from the Observatory’s records), and the date and time from your device’s clock. Nothing is looked up online.</p>'
    +'<p><b>Method.</b> The NOAA solar calculator equations (based on Meeus, <i>Astronomical Algorithms</i>): the day as a Julian century, the Sun’s declination, the equation of time, true solar time and hour angle, then the Sun’s height (elevation) and compass bearing (azimuth). Solar noon is not assumed to be 12:00: at Kulim it falls between about 13:01 and 13:32 Malaysia time, depending on the date.</p>'
    +'<p><b>Conventions.</b> Bearing in degrees clockwise from true north (N 0°, E 90°, S 180°, W 270°). The dial has true north at the top; the map can be turned, the dial cannot. Height in degrees above the horizon: the main value is geometric (no air); refraction from NOAA’s table for standard air adds a little near the horizon.</p>'
    +'<p><b>Checks.</b> Against NREL’s Solar Position Algorithm at 15 times and places, the height agreed to within 0.02° and the bearing to within 0.04° (tests/95-astral.test.mjs); refraction near the horizon is approximate. The map’s own 3D sunlight (observatory/sky.js) points the same way to within 0.05°. Your clock being wrong moves the Sun by about 1° for every 4 minutes.</p>'
    +'<p><b>What it cannot tell you.</b> It does not measure temperature, humidity, UV, wind or shade, and it does not know your heart rate or how hot you feel. Whether the steps are in sun or shade depends on walls, roofs and trees, which are not modelled. No staircase is called safe or dangerous.</p>'
    +cite,{label:'How is this calculated?'})}
function dial(s,on){
  const az=s&&s.ok&&fin(s.azimuth)?s.azimuth:null,hz=horizon(s),hot=on&&fx()&&!reduced()&&hz==='above';
  const lab=az==null?'Compass: the Sun’s bearing is not available':'Compass: the Sun is at '+Math.round(az)+' degrees, '+NAMES[point(az)]+', '+Math.round(s.elevation)+' degrees '+(s.elevation>=0?'above':'below')+' the horizon';
  return '<div class="astdial'+(hz==='below'?' night':'')+(hot?' glow':'')+'" role="img" aria-label="'+esc(lab)+'">'
    +'<span class="astcard n">N</span><span class="astcard e">E</span><span class="astcard s">S</span><span class="astcard w">W</span>'
    +'<i class="astring" aria-hidden="true"></i>'
    +(az==null?'':'<i class="astneedle" aria-hidden="true" data-az="'+az.toFixed(2)+'" style="transform:rotate('+az.toFixed(2)+'deg)"><b class="astsun"></b></i>')
    +'<i class="asthub" aria-hidden="true"></i></div>'}
function gauge(s){const e=s&&s.ok?clamp(s.elevation,-90,90):0;
  return '<div class="astel" aria-hidden="true"><i class="astelh"></i><i class="astelr" style="transform:rotate('+(-e).toFixed(1)+'deg)"><b></b></i></div>'}
function medius(s,a){
  const hz=horizon(s);
  const line=!s||!s.ok?'My star charts need a valid time and place. Check your device’s clock.'
    :hz==='below'?'The Sun has set over the kingdom. The stars keep watch tonight.'
    :hz==='low'?'The Sun hangs low, so shadows stretch long. Mind your footing where light and shade meet.'
    :s.elevation>=60?'The Sun stands high above the kingdom. If you climb in the open, carry water and take your time.'
    :'The Sun crosses the sky at a gentle height. My compass shows where it stands; the sky does not tell me how warm it feels.';
  return '<p class="astmed"><span class="astmi" aria-hidden="true">'+HWPixel.icon('wizard',1)+'</span><span><b>Medius:</b> '+esc(line)+'</span></p>'}
function body(rec){
  const p=where(rec),now=new Date();
  if(!p)return '<p class="mut">The Sun’s position needs a location, and none is recorded for this staircase or the campus.</p>';
  const s=solar({latitude:p.lat,longitude:p.lng,date:now});
  if(!s.ok)return '<p class="warn" role="status">Sun position unavailable: '+esc(s.reason)+'.</p>';
  const a=assess(rec,s),hz=horizon(s),stt=hz==='above'?['good','Sun above horizon']:hz==='low'?['watch','Sun low on the horizon']:['watch','Sun below horizon'];
  const high=hz==='above'&&s.elevation>=60&&a.kind!=='indoor';
  return '<div class="astgrid">'+dial(s,1)
    +'<dl class="astv"><dt>Sun bearing (azimuth)</dt><dd class="num"><b id="ast-az">'+(fin(s.azimuth)?f1(s.azimuth,1)+'°':'overhead')+'</b> <small>'+(fin(s.azimuth)?esc(NAMES[point(s.azimuth)]):'')+'</small></dd>'
    +'<dt>Sun height (elevation)</dt><dd class="num astelv">'+gauge(s)+'<b id="ast-el">'+f1(s.elevation,1)+'°</b> <small>geometric; '+f1(s.apparent,1)+'° with refraction</small></dd>'
    +'<dt>Solar noon today</dt><dd class="num">'+esc(minClock(s.solarNoonUTC))+' <small>on your clock</small></dd></dl></div>'
    +'<p class="astst"><span class="stt stt-'+stt[0]+'" id="ast-hz">'+stt[1]+'</span></p>'
    +'<p class="astsrc">Calculated for '+esc(clockTxt(now))+', at '+esc(p.txt)+'.'+(p.approx?' <b>Approximate location.</b>':'')+'</p>'
    +'<div class="astx" data-level="'+a.level+'"><p><b>'+esc(a.title)+'</b> <span class="pxtag">LEVEL '+a.level+' OF 4</span></p><p class="astsmall">'+esc(a.text)+'</p></div>'
    +(high?'<p class="astheat" role="note">The Sun is high (above 60°). If this staircase is in the open, direct sun may feel hotter. This tool does not measure shade, air temperature, humidity or UV: check the current weather, and water, shade and short breaks help.</p>':'')
    +medius(s,a)
    +'<div class="row astrow"><button type="button" class="g sm" data-a="astnow">REFRESH</button><button type="button" class="g sm" data-a="astfx" aria-pressed="'+(fx()?'true':'false')+'">EFFECTS: '+(fx()?'ON':'OFF')+'</button></div>'}
/** The group for a staircase record (HWCampusData.record), placed in its Details by js/v6-campus.js. */
function panel(rec){
  cur=rec?rec.id:null;arm();
  return '<details class="cmpgrp ast" id="astral"'+(open()?' open':'')+'><summary><h3 id="ast-t">'+HWPixel.icon('map',1)+' NAVIGATOR’S COMPASS</h3><span class="pxtag">SUN POSITION</span></summary>'
    +'<div class="asthd">'+help()+'<small class="mut">Where the Sun is now, seen from this staircase. Not a weather, UV or shade measurement.</small></div>'
    +'<div id="ast-b" aria-live="off">'+body(rec)+'</div></details>'}
function repaint(){const b=$i('ast-b');if(!b&&!$i('asthud')){arm(0);return}
  if(b){const rec=cur&&typeof HWCampusData!=='undefined'?HWCampusData.record(cur):null;b.innerHTML=body(rec)}hudRedraw()}
// one timer, only while the compass is on screen and the tab can be seen
function arm(on){clearInterval(tick);tick=0;if(on===0)return;setTimeout(()=>{clearInterval(tick);tick=0;if(on$()&&!D.hidden)tick=setInterval(()=>{if(!on$()||D.hidden){clearInterval(tick);tick=0;return}repaint()},6e4)},0)}
const on$=()=>$i('astral')||$i('asthud');
/* ---------- on the map: a sun compass beside the HealthWiz button (js/v6-campus-hud.js) ----------
   A round dial that turns with the map (north on the dial = north on the map, from the map's bearing), its needle at the Sun's
   azimuth, for the picked staircase or the campus point. Tapping it opens a short readout; FULL COMPASS opens the staircase's
   Details at the Navigator's Compass, with the method and the limits. Shown only where the HUD is (the live map). */
let hudOpen=false;const bound=new WeakSet();
function hudPlace(){const id=typeof HWCampus!=='undefined'?HWCampus.selected:null,rec=id&&typeof HWCampusData!=='undefined'?HWCampusData.record(id):null;return{rec,p:where(rec)}}
function hudBtn(){const{rec,p}=hudPlace();if(!p)return '';const s=solar({latitude:p.lat,longitude:p.lng,date:new Date()});
  const az=s.ok&&fin(s.azimuth)?s.azimuth:null,hz=horizon(s);
  const lab=s.ok&&az!=null?'Sun compass: the Sun is at '+Math.round(az)+' degrees, '+NAMES[point(az)]+', '+Math.round(s.elevation)+' degrees '+(s.elevation>=0?'above':'below')+' the horizon'+(rec?', seen from '+rec.id:'')+'. Show the readout':'Sun compass: the Sun’s position is not available';
  return '<button type="button" class="asthud'+(hz==='below'?' night':'')+(hz==='above'&&fx()&&!reduced()?' glow':'')+'" id="asthud" data-a="asthud" aria-expanded="'+hudOpen+'" aria-controls="asthudp" aria-label="'+esc(lab)+'" title="Sun compass">'
    +'<span class="asthr" aria-hidden="true"><i class="astcard n">N</i>'+(az==null?'':'<i class="astneedle" data-az="'+az.toFixed(2)+'" style="transform:rotate('+az.toFixed(2)+'deg)"><b class="astsun"></b></i>')+'<i class="asthub"></i></span>'
    +(s.ok?'<span class="asthe" aria-hidden="true">'+Math.round(s.elevation)+'°</span>':'')+'</button>'}
/* The readout is the HealthWiz menu's own layout and mechanics (js/v6-campus-hud.js): a mint layer over the whole map that slides in,
   scrolls inside itself, round tiles under their names in the same grid, the round x at the bottom middle, Escape closes it and the
   focus goes back to the button. Opening either menu closes the other. */
const SVG={ref:'<svg viewBox="0 0 24 24" class="cmpsv2" aria-hidden="true"><path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19 4v4h-4"/></svg>',
  fx:'<svg viewBox="0 0 24 24" class="cmpsv2" aria-hidden="true"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></svg>',
  full:'<svg viewBox="0 0 24 24" class="cmpsv2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 6l2.5 6-2.5 6-2.5-6z"/></svg>'};
const tile=(l,v,sub)=>'<li><span class="hudl" aria-hidden="true">'+l+'</span><span class="hudi asthv" role="img" aria-label="'+esc(l+': '+v+(sub?', '+sub:''))+'">'+esc(v)+'</span>'+(sub?'<small class="asths">'+esc(sub)+'</small>':'')+'</li>';
const act=(a,l,i,x)=>'<li><span class="hudl" aria-hidden="true">'+l+'</span><button type="button" class="hudi" data-a="'+a+'" aria-label="'+esc(l)+'" title="'+esc(l)+'"'+(x||'')+'>'+i+'</button></li>';
function hudPop(still){const{rec,p}=hudPlace();if(!p)return '';const now=new Date(),s=solar({latitude:p.lat,longitude:p.lng,date:now});
  const shell=b=>'<div class="hudmenu asthm'+(still?' still':'')+'" id="asthudp" role="dialog" aria-modal="false" aria-labelledby="asthudp-t"><div class="hudscr">'+b+'</div>'
    +'<button type="button" class="hudx" data-a="asthud" aria-label="Close the sun compass">×</button></div>';
  if(!s.ok)return shell('<b id="asthudp-t" class="asthmt">NAVIGATOR’S COMPASS</b><p>Sun position unavailable: '+esc(s.reason)+'.</p>');
  const a=assess(rec,s),hz=horizon(s),az=fin(s.azimuth);
  return shell('<div class="asthmh">'+dial(s,1)+'<div><b id="asthudp-t" class="asthmt">NAVIGATOR’S COMPASS</b><p class="asthmp">Where the Sun is now'+(rec?', seen from '+esc(rec.id):'')+'. Not a weather, UV or shade measurement.</p></div></div>'
    +'<ul class="hudgrid">'+tile('Bearing',az?Math.round(s.azimuth)+'°':'up',az?NAMES[point(s.azimuth)]:'overhead')+tile('Height',Math.round(s.elevation)+'°',hz==='below'?'below the horizon':'above the horizon')
      +tile('Solar noon',minClock(s.solarNoonUTC),'on your clock')+tile('Sky',hz==='above'?'Up':hz==='low'?'Low':'Set',hz==='above'?'Sun above horizon':hz==='low'?'Sun low on the horizon':'Sun below horizon')
      +act('astnow','Refresh',SVG.ref)+act('astfx','Effects',SVG.fx,' aria-pressed="'+(fx()?'true':'false')+'"')+(rec?act('astfull','Full compass',SVG.full):'')+'</ul>'
    +'<div class="asthmc"><p><b>'+esc(a.title)+'</b> <small>level '+a.level+' of 4</small></p><p>'+esc(a.text)+'</p>'
    +(hz==='above'&&s.elevation>=60&&a.kind!=='indoor'?'<p class="asthmw">The Sun is high. In the open, direct sun may feel hotter; shade, temperature and UV are not measured here.</p>':'')
    +(rec?'':'<p>Pick a staircase on the map for its own compass and what can be said about sunlight there.</p>')
    +'<p class="asthms">'+esc(clockTxt(now))+' · '+esc(p.txt)+'. The dial turns with the map: its N is the map’s north.</p></div>')}
function hud(){setTimeout(()=>{bind();arm()},0);return hudBtn()+(hudOpen?hudPop(true):'')} // a page redraw while open: no second slide-in
/** Turn the dial with the map: --b = −bearing, set on rotate (MapLibre), once per map instance. */
function bind(){const m=typeof HWCampus!=='undefined'&&HWCampus.map&&HWCampus.map.map;const set=()=>{const n=$i('asthud');if(n&&m)n.style.setProperty('--b',(-m.getBearing())+'deg')};
  if(m&&typeof m.on==='function'&&!bound.has(m)){bound.add(m);m.on('rotate',set)}set()}
/** Redraw the button and the menu in place; still = it was open already (no second slide-in). focus: 'menu' | 'btn' | keep */
function hudRedraw(focus){const b=$i('asthud');if(!b)return;const o=$i('asthudp'),was=!!o,f=D.activeElement===b;if(o)o.remove();
  b.insertAdjacentHTML('afterend',hudOpen?hudPop(was):'');b.outerHTML=hudBtn();bind();
  const n=focus==='menu'?D.querySelector('#asthudp .hudi[data-a]'):focus==='btn'||f?$i('asthud'):null;if(n)n.focus({preventScroll:true})}
const hudMenuOpen=()=>typeof HWCampusHud!=='undefined'&&HWCampusHud.state&&HWCampusHud.state.menu;
acts.asthud=()=>{hudOpen=!hudOpen;if(hudOpen&&hudMenuOpen())acts.hudmenu();hudRedraw(hudOpen?'menu':'btn')};
{const o=acts.hudmenu;if(typeof o==='function')acts.hudmenu=function(){if(!hudMenuOpen()&&hudOpen){hudOpen=false;hudRedraw()}return o.apply(this,arguments)}}
acts.astfull=()=>{hudOpen=false;const id=typeof HWCampus!=='undefined'?HWCampus.selected:null;if(!id)return hudRedraw();pref.open=1;keep();
  if(typeof HWCampus.openSheet==='function')HWCampus.openSheet('det','half');else hudRedraw();
  setTimeout(()=>{const n=$i('astral');if(n){n.open=true;n.scrollIntoView({block:'start',behavior:reduced()?'auto':'smooth'});const s=n.querySelector('summary');if(s)s.focus({preventScroll:true})}},150)};
D.addEventListener('keydown',e=>{if(e.key==='Escape'&&hudOpen&&$i('asthudp')){e.stopPropagation();hudOpen=false;hudRedraw('btn')}},true);
if(typeof HWCampusHud!=='undefined'){const h=HWCampusHud.html;HWCampusHud.html=function(){return h.apply(this,arguments)+hud()}}
acts.astnow=()=>repaint();
acts.astfx=()=>{pref.fx=fx()?0:1;keep();repaint();const n=D.querySelector('#asthudp [data-a="astfx"]');if(n)n.focus({preventScroll:true})};
// a <details open> also fires 'toggle' when it is drawn: save only a real change, so looking writes nothing
D.addEventListener('toggle',e=>{const t=e.target;if(t&&t.id==='astral'&&t.open!==open()){pref.open=t.open?1:0;keep()}},true);
D.addEventListener('visibilitychange',()=>{if(D.hidden)arm(0);else if(on$()){repaint();arm()}});
HWEvents.on('page:viewed',e=>{if(e.view!=='campus'){arm(0);hudOpen=false}});

HWUI.css('astral',`
.ast>summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer;min-height:44px;list-style:none}.ast>summary::-webkit-details-marker{display:none}
.ast>summary h3{margin:0!important}.ast>summary:after{content:"\\25BE";margin-left:auto;font-size:14px}.ast:not([open])>summary:after{content:"\\25B8"}
.asthd{display:flex;gap:8px;align-items:flex-start;margin:4px 0 8px}.asthd small{flex:1;font-size:13px}
.astgrid{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center}
.astdial{--d:132px;position:relative;width:var(--d);height:var(--d);border-radius:50%;border:4px solid var(--ln);box-sizing:border-box;
  background:radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--blue) 18%,var(--p2)) 0 38%,var(--p2) 39% 62%,color-mix(in srgb,var(--vio) 22%,var(--p2)) 63%);
  box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--gold) 55%,transparent),3px 3px 0 var(--ln)}
.astdial.night{background:radial-gradient(circle,#1b2448 0 60%,#0f1630 61%)}.astdial.night .astcard{color:#d8def5}
.astdial.glow{box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--gold) 75%,transparent),0 0 14px color-mix(in srgb,var(--gold) 55%,transparent),3px 3px 0 var(--ln);animation:astglow 4s ease-in-out infinite alternate}
@keyframes astglow{to{box-shadow:inset 0 0 0 3px color-mix(in srgb,var(--gold) 75%,transparent),0 0 22px color-mix(in srgb,var(--gold) 70%,transparent),3px 3px 0 var(--ln)}}
.astring{position:absolute;inset:14px;border-radius:50%;border:2px dashed color-mix(in srgb,var(--ink) 35%,transparent)}
.astcard{position:absolute;font:700 13px/1 var(--fn,system-ui,sans-serif);color:var(--ink)}
.astcard.n{top:4px;left:50%;transform:translateX(-50%);color:var(--red)}.astcard.s{bottom:4px;left:50%;transform:translateX(-50%)}
.astcard.e{right:5px;top:50%;transform:translateY(-50%)}.astcard.w{left:5px;top:50%;transform:translateY(-50%)}
.astneedle{position:absolute;left:50%;bottom:50%;width:4px;height:calc(var(--d)/2 - 12px);margin-left:-2px;transform-origin:50% 100%;transition:transform .8s ease-out}
.astneedle:before{content:"";position:absolute;left:0;right:0;top:16px;bottom:0;background:repeating-linear-gradient(0deg,var(--gold) 0 4px,#b07a12 4px 6px);border:1px solid var(--ln)}
.astsun{position:absolute;left:50%;top:0;width:18px;height:18px;margin-left:-9px;background:#ffd34d;border:2px solid #8a5a00;box-shadow:0 0 0 2px #ffe89a,
  -6px 0 0 -3px #ffd34d,6px 0 0 -3px #ffd34d,0 -6px 0 -3px #ffd34d,0 6px 0 -3px #ffd34d;image-rendering:pixelated}
.astdial.night .astsun{background:#9aa3c7;border-color:#3b4466;box-shadow:none}
.asthub{position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;background:var(--vio);border:2px solid var(--ln)}
.astv{margin:0;display:grid;gap:2px}.astv dt{font-size:12px;color:var(--mut)}.astv dd{margin:0 0 6px;font-variant-numeric:tabular-nums}.astv dd b{font:700 20px var(--fn,system-ui,sans-serif)}
.astv small{font-size:12px;color:var(--mut)}
.astelv{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.astel{position:relative;width:40px;height:22px;overflow:hidden;flex:0 0 auto}.astelh{position:absolute;left:0;right:0;bottom:0;border-top:2px solid var(--ln)}
.astelr{position:absolute;left:2px;bottom:0;width:34px;height:2px;transform-origin:0 50%;background:var(--gold)}.astelr b{position:absolute;right:-4px;top:-4px;width:8px;height:8px;background:#ffd34d;border:1px solid #8a5a00}
.astst{margin:8px 0 4px}.astsrc{font-size:12px;color:var(--mut);margin:4px 0 8px}
.astx{border:2px solid var(--ln);border-radius:8px;padding:6px 8px;background:var(--p2);margin:6px 0}.astx p{margin:0 0 4px}.astsmall{font-size:13px}
.astheat{border:3px solid var(--st-watch);padding:6px 8px;font-size:13px;margin:8px 0}
.astmed{display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:8px 0}.astmi{flex:0 0 auto}
.astrow{gap:8px;margin-top:6px}.astrow button{min-height:44px}
.asthud{position:absolute;z-index:7;left:calc(75% - 44px);bottom:max(40px,calc(env(safe-area-inset-bottom) + 22px));width:54px;height:54px;min-height:0;margin:0;padding:0;border-radius:50%;
  border:2px solid #fff;background:radial-gradient(circle,#2c3f7a 0 52%,#1b2552 53% 70%,#3a2a6a 71%);box-shadow:0 3px 10px rgba(0,0,0,.35),inset 0 0 0 2px #f2c14e99;color:#fff;display:grid;place-items:center;overflow:visible}
.asthud.night{background:radial-gradient(circle,#141a38 0 60%,#0b1026 61%)}
.asthud.glow{box-shadow:0 3px 10px rgba(0,0,0,.35),inset 0 0 0 2px #f2c14ecc,0 0 14px #f2c14e88;animation:asthglow 4s ease-in-out infinite alternate}
@keyframes asthglow{to{box-shadow:0 3px 10px rgba(0,0,0,.35),inset 0 0 0 2px #f2c14e,0 0 22px #f2c14ebb}}
.asthr{position:absolute;inset:3px;border-radius:50%;transform:rotate(var(--b,0deg));transition:transform .15s}
.asthr .astcard.n{top:1px;font-size:11px;color:#ff8a80}
.asthud .astneedle{height:21px;width:4px;margin-left:-2px}.asthud .astneedle:before{top:9px}.asthud .astsun{width:12px;height:12px;margin-left:-6px;border-width:1px;box-shadow:0 0 0 1px #ffe89a,0 0 8px #ffd34d}
.asthud .asthub{width:8px;height:8px;margin:-4px 0 0 -4px}
.asthe{position:absolute;bottom:7px;left:50%;transform:translateX(-50%);font:700 10px/1 var(--fn,system-ui,sans-serif);color:#ffe08a;text-shadow:0 1px 0 #000;white-space:nowrap;pointer-events:none}
#hudsheet~.asthud{z-index:9;bottom:calc(max(140px,20%,20vh) + 24px)}#hudsheet[data-size="half"]~.asthud{bottom:calc(max(260px,50%) + 24px)}
@media(max-width:400px){.asthud:not(#x){left:auto;right:10px;width:50px;height:50px;bottom:calc(max(18px,env(safe-area-inset-bottom)) + 76px)}.asthud .astneedle{height:18px}
  #hudsheet~.asthud:not(#x){bottom:calc(max(140px,20%,20vh) + 90px)}#hudsheet[data-size="half"]~.asthud:not(#x){bottom:calc(max(260px,50%) + 90px)}}
#hudsheet[data-size="full"]~.asthud{display:none}#hudsheet.drag~.asthud{visibility:hidden}
.asthm .hudscr{gap:10px}
.asthmh{display:flex;gap:12px;align-items:center;padding:10px;border-radius:16px;background:#fff;box-shadow:0 1px 4px rgba(30,90,80,.2)}
.asthmh .astdial{--d:96px;flex:0 0 auto}.asthmt{display:block;font:800 15px var(--font,system-ui,sans-serif);letter-spacing:.06em;color:#2d5a5f}
.asthmp{margin:4px 0 0;font-size:13px;color:#4e7b7c}
.asthv{font:800 14px/1 var(--font,system-ui,sans-serif);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.asths{font-size:11px;line-height:1.2;color:#4e7b7c;text-align:center;max-width:84px}
.asthmc{padding:10px 12px;border-radius:14px;background:#f2fbf5;color:#22424a;box-shadow:0 1px 4px rgba(30,90,80,.15);font-size:13px}.asthmc p{margin:0 0 6px}
.asthmc small,.asthms{color:#4e7b7c;font-size:12px}.asthmw{border-left:4px solid #c98a0b;padding-left:8px}
#hudsheet[data-size="full"]~#asthudp{display:none}
@media(max-width:420px){.astgrid{grid-template-columns:1fr;justify-items:center}.astv{width:100%}}
@media(prefers-reduced-motion:reduce){.astneedle,.asthr{transition:none}.astdial.glow,.asthud.glow{animation:none}}
.hw-rm .astneedle,.hw-still .astneedle,.hw-rm .asthr,.hw-still .asthr{transition:none}.hw-rm .astdial.glow,.hw-still .astdial.glow,.hw-rm .asthud.glow,.hw-still .asthud.glow{animation:none}
`);
return{hud,get hudOpen(){return hudOpen},solar,refraction,bearing,distance,relative,shadowLength,point,horizon,headingOf,placeOf,assess,panel,repaint,get timer(){return tick}}})();
