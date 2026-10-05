/* v6: live weather (cuaca) and haze (jerebu) for Kolej MARA Kulim. Not part of the original.
   Sources (free, no key, no account): Open-Meteo forecast (current conditions, cached 15 min) and Open-Meteo Air
   Quality (PM2.5 / PM10 / US AQI, cached 30 min). Only the college's fixed location is sent; never any health data.
   The haze value is a MODELLED estimate (CAMS), labelled so, with a link to the official APIMS reading.

   Shown on: the title screen (live sky + chip, js/v6-title.js), Home (weather chip + 🌫️ JEREBU CHECK), the Stairs
   page (hazeBanner(), also meant for any later running page) and Settings → 🌐 LIVE DATA (on/off, last update,
   REFRESH). At haze level ≥3 the kingdom's sky turns hazy: the ambient layer and the title scene only, never a card.

   Network rules: every request has an 8 s timeout and a try/catch; good answers go to localStorage `healthwiz_cache`
   (separate from the `healthwiz` save, so backups and the save schema are untouched). If a request fails, the last
   good answer is used for up to 6 hours, marked "as of"; after that, or with nothing cached, the app says
   "unavailable" and keeps the default scene. Offline never breaks anything.

   Saved setting: st.s.live (0 = off). Missing means on, so existing saves need no migration.
   refreshLive() runs at start, every 30 min while the app is visible, on coming back online and from REFRESH.
   Event: live:updated {weather, air, level} (docs/EVENTS.md). */
const KMK={name:'Kolej MARA Kulim',lat:5.3650,lon:100.5600}; // verify on Google Maps

/** GET a JSON document with a timeout (AbortController). Rejects on network error, timeout, HTTP error or bad JSON. */
function fetchJSON(url,{timeout=8000}={}){
  const ac=typeof AbortController!=='undefined'?new AbortController():null;
  const t=setTimeout(()=>{try{ac&&ac.abort()}catch(e){}},timeout);
  return fetch(url,{signal:ac?ac.signal:undefined,cache:'no-store'})
    .then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})
    .finally(()=>clearTimeout(t))}

/* small cache in its own localStorage key: {key: {t: ms, d: data}} */
const CACHE_KEY='healthwiz_cache';
function cacheAll(){try{const o=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch(e){return{}}}
/** The cached data for `key` if younger than maxAgeMin minutes, else null. */
function cacheGet(key,maxAgeMin){const x=cacheAll()[key];if(!x||typeof x.t!=='number'||x.d==null)return null;return Date.now()-x.t<=maxAgeMin*60e3?x.d:null}
function cacheSet(key,data){try{const o=cacheAll();o[key]={t:Date.now(),d:data};localStorage.setItem(CACHE_KEY,JSON.stringify(o))}catch(e){}}

const HWLive=(()=>{
const STALE_MIN=360,EVERY=30*60e3;
const q=(k,v)=>k+'='+v;
const URL_WX='https://api.open-meteo.com/v1/forecast?'+[q('latitude',KMK.lat),q('longitude',KMK.lon),q('current','temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m'),q('timezone','Asia/Kuala_Lumpur')].join('&');
const URL_AQ='https://air-quality-api.open-meteo.com/v1/air-quality?'+[q('latitude',KMK.lat),q('longitude',KMK.lon),q('current','pm2_5,pm10,us_aqi'),q('timezone','Asia/Kuala_Lumpur')].join('&');
const SRC={wx:{key:'wx',url:URL_WX,max:15},aq:{key:'aq',url:URL_AQ,max:30}};
const fin=v=>typeof v==='number'&&isFinite(v);
const okWx=d=>!!(d&&d.current&&fin(d.current.temperature_2m)&&fin(d.current.weather_code));
const okAq=d=>!!(d&&d.current&&fin(d.current.pm2_5));
const OK={wx:okWx,aq:okAq};

const on=()=>!(st&&st.s&&st.s.live===0);
// per source: {d: data, at: when fetched (ms), stale: from the fallback cache, st: 'ok'|'loading'|'off'|'none'}
const R={wx:{st:'none'},aq:{st:'none'}};
let busy=null,lastRun=0,timer=0;
// one timer, armed only while the tab is visible and live data is on (no interval runs in the background)
function arm(){clearTimeout(timer);timer=0;if(on()&&!document.hidden)timer=setTimeout(()=>refreshLive(),EVERY)}

function fromCache(k){const all=cacheAll()[SRC[k].key];if(all&&OK[k](all.d)){const age=Date.now()-all.t;
  if(age<=SRC[k].max*60e3)return{d:all.d,at:all.t,stale:false,st:'ok'};if(age<=STALE_MIN*60e3)return{d:all.d,at:all.t,stale:true,st:'ok'}}return null}
// the cached state is shown at once (no flash of "unavailable" on every start)
function prime(){const net=typeof navigator==='undefined'||navigator.onLine!==false;for(const k of ['wx','aq']){const c=fromCache(k);R[k]=c||{st:net?'loading':'none'}}}

function one(k,force){const s=SRC[k],c=fromCache(k);if(c&&!c.stale&&!force){R[k]=c;return Promise.resolve()}
  if(typeof navigator!=='undefined'&&navigator.onLine===false){R[k]=c||{st:'none'};return Promise.resolve()}
  if(!c&&R[k].st!=='ok')R[k]={st:'loading'};
  return fetchJSON(s.url,{timeout:8000}).then(d=>{if(!OK[k](d))throw new Error('unexpected answer');cacheSet(s.key,d);R[k]={d,at:Date.now(),stale:false,st:'ok'}})
    .catch(e=>{R[k]=fromCache(k)||{st:'none'};console.warn('[HealthWiz] live '+k+' unavailable:',e&&e.message)})}

/** Fetch weather and air quality (each from its cache when fresh enough). force=true skips the fresh cache. */
function refreshLive(force){if(!on()){clearTimeout(timer);R.wx={st:'off'};R.aq={st:'off'};paint();return Promise.resolve()}
  if(busy)return busy;lastRun=Date.now();
  busy=Promise.all([one('wx',force),one('aq',force)]).then(()=>{busy=null;arm();paint();try{HWEvents.emit('live:updated',{weather:R.wx.st==='ok',air:R.aq.st==='ok',level:level()})}catch(e){}})
    .catch(e=>{busy=null;arm();paint();console.warn('[HealthWiz] live data:',e&&e.message)});
  paint();return busy}

/* ---------- weather ---------- */
const WMO={0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Freezing fog',51:'Light drizzle',53:'Drizzle',55:'Heavy drizzle',
  56:'Freezing drizzle',57:'Freezing drizzle',61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',71:'Light snow',73:'Snow',75:'Heavy snow',
  77:'Snow grains',80:'Light showers',81:'Showers',82:'Downpour',85:'Snow showers',86:'Snow showers',95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with hail'};
const ICON={sunny:'☀️',night:'🌙',cloudy:'☁️',mist:'🌫️',rain:'🌦️',heavy:'🌧️',downpour:'🌧️',storm:'⛈️'};
/** WMO weather_code (+ day/night) → title-scene sky. */
function skyOf(code,day){code=+code;
  if(code<=1)return day?'sunny':'night';if(code<=3)return 'cloudy';if(code===45||code===48)return 'mist';
  if((code>=51&&code<=57)||code===61||code===80||code===66)return 'rain';if((code>=63&&code<=65)||code===81||code===67)return 'heavy';
  if(code===82)return 'downpour';if(code>=95&&code<=99)return 'storm';return 'cloudy'}
const wx=()=>R.wx.st==='ok'?R.wx.d.current:null;
function sky(){const c=on()&&wx();return c?skyOf(c.weather_code,c.is_day!==0):null}
const t0=v=>Math.round(+v);
const hm=ms=>{try{return new Date(ms).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}catch(e){return''}};
const obs=s=>{const m=/T(\d\d:\d\d)/.exec(String(s||''));return m?m[1]:''}; // the reading's own time, Malaysia time
function chipText(){const c=wx();if(!c)return '';
  return 'Kulim now · '+t0(c.temperature_2m)+' °C'+(fin(c.apparent_temperature)?' (feels '+t0(c.apparent_temperature)+' °C)':'')+' · '+(WMO[c.weather_code]||'Weather code '+t0(c.weather_code))
    +(fin(c.relative_humidity_2m)?' · '+t0(c.relative_humidity_2m)+'% humidity':'')}
const hot=()=>{const c=wx();return !!c&&fin(c.apparent_temperature)&&c.apparent_temperature>=35};
const heatTip=()=>hot()?'🥵 Feels '+t0(wx().apparent_temperature)+' °C: drink water before and after moving, rest in the shade, and keep hard exercise for the cooler morning or evening.':'';
function chip(){if(!on())return '';const s=R.wx.st;
  if(s==='ok')return '<span class="v6wxc">'+ICON[sky()]+' '+esc(chipText())+(R.wx.stale?' <i>· as of '+esc(hm(R.wx.at))+'</i>':'')+'</span>';
  if(s==='loading')return '<span class="v6wxc v6wxu">⏳ Checking Kulim weather…</span>';
  return '<span class="v6wxc v6wxu">🌦️ Weather unavailable</span>'}
function titleChip(){if(!on())return '';const t=heatTip();
  return '<div class="v6wxt">'+chip().replace(/<\/?span[^>]*>/g,'')+(t?'<small>'+esc(t)+'</small>':'')+'</div>'}
function homeWeather(){if(!on())return '';const t=heatTip();
  return '<div class="card v6wxh" id="v6wxh"><div class="v6wxl">'+chip()+'</div>'+(t?'<p class="v6heat">'+esc(t)+'</p>':'')+'</div>'}

/* ---------- haze (jerebu) ---------- */
// PM2.5 µg/m³, upper bound inclusive
const LV=[
  {n:1,max:15,k:'GOOD',i:'🟢',c:'#3f9f4a',a:'Great for jogging and stairs outdoors.'},
  {n:2,max:35,k:'MODERATE',i:'🟡',c:'#d6a51c',a:'OK; people with asthma or heart/lung conditions take it easier.'},
  {n:3,max:55,k:'SENSITIVE',i:'🟠',c:'#e8812a',a:'Lighter or shorter outdoor exercise; sensitive people move indoors.'},
  {n:4,max:150,k:'UNHEALTHY',i:'🔴',c:'#d9453d',a:'Avoid vigorous outdoor exercise; use indoor stairs or rest.'},
  {n:5,max:Infinity,k:'HAZARDOUS',i:'🟣',c:'#8a3b9a',a:'Stay indoors; follow school/MOH advice.'}];
const band=pm=>LV.find(l=>pm<=l.max);
const aq=()=>on()&&R.aq.st==='ok'?R.aq.d.current:null;
/** 1–5, or 0 when there is no reading. */
function level(){const a=aq();return a?band(a.pm2_5).n:0}
const hazy=()=>level()>=3;
const num=(v,d)=>fin(v)?(+v).toFixed(d):'–';
const OFFICIAL='<a href="https://apims.doe.gov.my" target="_blank" rel="noopener">official reading: APIMS ↗</a>';
function src(){const a=aq();return 'at '+esc(obs(a.time)||hm(R.aq.at))+' · Open-Meteo Air Quality · <b>modelled estimate</b>, not an official reading'+(R.aq.stale?' · fetched '+esc(hm(R.aq.at)):'')+' · '+OFFICIAL}
function hazeCard(){if(!on())return '';const a=aq();
  if(!a)return '<div class="card v6aq" id="v6haze"><h3>🌫️ JEREBU CHECK</h3><p class="mut">'+(R.aq.st==='loading'?'⏳ Checking the haze level for Kulim…':'Haze reading unavailable right now.')+'</p><small class="mut">Before hard outdoor exercise, check the '+OFFICIAL+'.</small></div>';
  const L=band(a.pm2_5);
  return '<div class="card v6aq" id="v6haze" style="--aq:'+L.c+'"><h3>🌫️ JEREBU CHECK</h3>'
    +'<div class="v6aqh"><b class="v6aqk">'+L.i+' '+L.k+' <span>· LEVEL '+L.n+'/5</span></b><span class="v6aqv">PM2.5 <b>'+num(a.pm2_5,0)+'</b> µg/m³</span></div>'
    +'<p class="v6aqa">🏃 '+esc(L.a)+'</p>'
    +'<small class="mut">PM10 '+num(a.pm10,0)+' µg/m³'+(fin(a.us_aqi)?' · US AQI '+num(a.us_aqi,0):'')+' · '+src()+'</small></div>'}
/** A compact haze banner for exercise pages (Stairs; any running page). Empty when live data is off. */
function hazeBanner(){if(!on())return '';const a=aq();
  if(!a)return '<div class="v6hzb v6hzu" role="note"><b>🌫️ JEREBU</b> <span>'+(R.aq.st==='loading'?'Checking the haze level…':'Haze reading unavailable. Check the '+OFFICIAL+' before hard outdoor exercise.')+'</span></div>';
  const L=band(a.pm2_5);
  return '<div class="v6hzb" role="note" style="--aq:'+L.c+'"><b>🌫️ JEREBU · '+L.i+' '+L.k+' · PM2.5 '+num(a.pm2_5,0)+' µg/m³</b><span>'+esc(L.a)+'</span><small>'+src()+'</small></div>'}

/* ---------- settings ---------- */
function stamp(k){const r=R[k];if(r.st==='off')return 'Off';if(r.st==='loading')return '⏳ Updating…';if(r.st!=='ok')return '⚠️ Unavailable';
  return '✅ Updated '+esc(hm(r.at))+(r.stale?' (last good copy; could not refresh)':'')}
function card(){const o=on();
  return '<div class="card" id="v6live"><h3>🌐 LIVE DATA</h3><p class="mut">Weather and haze for '+esc(KMK.name)+' from Open-Meteo (free, no account). Only the college\'s location is sent, never your health data. Turn it off to stay fully offline.</p>'
    +'<div class="v6pl"><span class="v6pk">WEATHER</span><span>'+stamp('wx')+'</span></div><div class="v6pl"><span class="v6pk">HAZE</span><span>'+stamp('aq')+'</span></div>'
    +'<div class="row"><button data-a="livetog" aria-pressed="'+o+'">LIVE DATA: '+(o?'ON':'OFF')+'</button>'+(o?'<button class="g" data-a="liveref"'+(busy?' disabled':'')+'>'+(busy?'⏳ REFRESHING…':'↻ REFRESH')+'</button>':'')+'</div></div>'}
acts.livetog=()=>{st.s.live=on()?0:1;save();if(on())refreshLive();else{R.wx={st:'off'};R.aq={st:'off'};paint()}render()};
acts.liveref=()=>{refreshLive(true).then(()=>toast(R.wx.st==='ok'||R.aq.st==='ok'?'🌐 Live data updated.':'🌐 Live data unavailable right now. Showing what is saved.'))};

/* ---------- painting ---------- */
const swap=(sel,html)=>document.querySelectorAll(sel).forEach(el=>{if(html)el.outerHTML=html;else el.remove()});
function paint(){try{document.body.classList.toggle('hw-haze',hazy());
  if(typeof S==='undefined')return;
  if(S.v==='welcome'){if(typeof HWTitle!=='undefined')HWTitle.restyle();return}
  swap('#v6wxh',homeWeather());swap('#v6haze',hazeCard());swap('.v6hzb',hazeBanner());swap('#v6live',card())}catch(e){console.warn('[HealthWiz] live paint:',e&&e.message)}}

HWUI.css('live',`
.v6wxh{padding:10px 12px}
.v6wxl{font:13px/1.5 var(--fb)}.v6wxc i{font-style:normal;color:var(--mut)}.v6wxu{color:var(--mut)}
.v6heat{margin:8px 0 0;padding:6px 8px;border:2px dashed #e8812a;font-size:13px}
.v6aq{border-left:10px solid var(--aq,var(--ln))}
.v6aqh{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline}
.v6aqk{font:9px/1.8 var(--fh)}.v6aqk span{color:var(--mut)}
.v6aqv{font-size:14px}.v6aqv b{font-size:20px}
.v6aqa{margin:8px 0}
.v6aq a,.v6hzb a{color:inherit;text-decoration:underline;display:inline-block;padding:4px 0}
.v6hzb{display:flex;flex-direction:column;gap:4px;margin:0 0 14px;padding:8px 10px;background:var(--pn);border:3px solid var(--ln);border-left:10px solid var(--aq,var(--mut));box-shadow:3px 3px 0 var(--ln);font-size:13px}
.v6hzb b{font:8px/1.8 var(--fh)}.v6hzb small{color:var(--mut)}
#v6live .v6pl{display:flex;gap:8px;align-items:baseline;margin:6px 0}#v6live .v6pk{flex:0 0 auto;font:7px/1.8 var(--fh);min-width:84px}
#v6live button{min-height:44px}
/* game layer only: a hazy kingdom sky behind the cards (the cards themselves are opaque and unchanged) */
body.hw-haze .amb .amsky{inset:0;background:linear-gradient(rgba(196,170,120,.42),rgba(186,170,140,.18))}
body.hw-haze .amb .amfar{opacity:.3}body.hw-haze .amb .amcl{opacity:.35}`);

/* ---------- surfaces ---------- */
{const p=pages.home;pages.home=(...a)=>{const h=p(...a),i=h.indexOf('<div class="hbar">'),j=i<0?-1:h.indexOf('</button></div>',i);const c=homeWeather()+hazeCard();
  return j<0?c+h:h.slice(0,j+15)+c+h.slice(j+15)}}
{const p=pages.stair;pages.stair=(...a)=>{const h=p(...a),k='<h2>🧗 STAIR QUEST</h2>';return h.indexOf(k)===0?k+hazeBanner()+h.slice(k.length):hazeBanner()+h}}
// above APP & OFFLINE (which sits just above Backup & Restore)
{const p=pages.set;pages.set=(...a)=>{const h=p(...a),k=['<div class="card" id="v6pwa">','<div class="card" id="bkp">'].find(x=>h.indexOf(x)>=0);return k?h.replace(k,card()+k):h+card()}}

/* ---------- schedule: start, every 30 min while visible, back online ---------- */
prime();
const due=()=>Date.now()-lastRun>=EVERY;
HWEvents.on('app:ready',()=>{paint();refreshLive()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(timer);timer=0}else if(on()&&!busy){if(due())refreshLive();else arm()}});
addEventListener('online',()=>{if(on())refreshLive()});

return{refresh:refreshLive,enabled:on,sky,skyOf,level,hazy,band,hazeBanner,titleChip,chipText,heatTip,state:()=>JSON.parse(JSON.stringify(R)),LV,WMO}})();
const refreshLive=HWLive.refresh,hazeBanner=HWLive.hazeBanner;
