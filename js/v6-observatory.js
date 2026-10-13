/* v6: the Campus Health Observatory (route 'campus'), a campus map of the stairways. Not part of the original.
   Master prompt Feature D. The owner chose (2026-10-13) to build it now from the locations already in the app, clearly
   marked as unverified, until verified ones are available.
   * Locations: the stairway coordinates in STAIRS (js/hw-02-core.js, from the original v5.4.3 app). Their source is not
     recorded, so every point is labelled "Unverified: from the original app data". Stairways that share one coordinate
     are one marker; stairways without coordinates are listed, never placed. No routes are drawn (none are recorded).
   * The map is drawn from the coordinates themselves (an equirectangular projection around their centre, so distances
     and the 100 m scale bar are real). Its look follows the owner's illustrated campus maps (daylight grounds, trees,
     a small red-roofed building at each stairway point, a gold compass): decoration only, with no roads or paths.
   * Live weather and haze (js/v6-live.js) are read for HWLive.KMK, a "Kolej MARA Kulim" point that is itself marked
     "verify on Google Maps" and lies about 2.9 km from the stairways: the page says so instead of hiding it.
   * SHOW WHERE I AM asks the browser for one position. It is shown on this screen only: never saved, never sent. If
     location is denied, unavailable or far away, the player picks a stairway on the map or in the list instead.
   * Campus-wide activity: HealthWiz collects no one else's location, so there is no overlay; the page says so. The
     player's own visits (first GPS check-ins st.gp.v, their stair sessions) are shown only to them.
   * Markers glow (CSS); nothing moves with reduced motion or the Performance mode. Reads only: nothing is written. */
const HWCampus=(()=>{
const ico=(n,s)=>HWPixel.icon(n,s||1);
const CN={MILD:'Mild',MODERATE:'Moderate',VIGOROUS:'Vigorous'},CK={MILD:1,MODERATE:2,VIGOROUS:3};
const UNV='Unverified: from the original app data';
const dist=(a,b,c,d)=>typeof HWGps!=='undefined'?HWGps.dist(a,b,c,d):(()=>{const R=6371e3,r=Math.PI/180,x=Math.sin((c-a)*r/2),y=Math.sin((d-b)*r/2);return 2*R*Math.asin(Math.sqrt(x*x+Math.cos(a*r)*Math.cos(c*r)*y*y))})();
const fmtD=m=>m<1000?Math.round(m/10)*10+' m':(m/1000).toFixed(1)+' km';

/* ---------- the points: stairways that share a coordinate are one marker ---------- */
function points(){const G={};STAIRS.filter(hasXY).forEach(s=>{const k=s.lat.toFixed(6)+','+s.lng.toFixed(6);(G[k]=G[k]||{lat:s.lat,lng:s.lng,L:[]}).L.push(s)});return Object.values(G)}
const unmapped=()=>STAIRS.filter(s=>!hasXY(s));
/** The projection: metres east/north of the points' centre, then into a box with a margin (percent of the map). */
function proj(P){const la=P.reduce((a,p)=>a+p.lat,0)/P.length,ln=P.reduce((a,p)=>a+p.lng,0)/P.length,kx=111320*Math.cos(la*Math.PI/180),ky=110540;
  const xy=p=>[(p.lng-ln)*kx,(p.lat-la)*ky],X=P.map(p=>xy(p)[0]),Y=P.map(p=>xy(p)[1]);
  const w=Math.max(60,Math.max(...X)-Math.min(...X)),h=Math.max(60,Math.max(...Y)-Math.min(...Y)),x0=Math.min(...X),y1=Math.max(...Y),pad=.1;
  const sc=Math.min((1-2*pad)/w,(1-2*pad)/h*1.5); // the map is 3:2; one scale for both axes keeps distances true
  const z=V.z||1,zf=v=>50+(v-50)*z; // ZOOM IN spreads the points from the map's centre (2x); the map clips the edges
  const at=p=>{const[x,y]=xy(p);return[zf(pad*100+(x-x0)*sc*100+((1-2*pad)-w*sc)*50),zf(pad*100+(y1-y)*sc*100/1.5+((1-2*pad)-h*sc/1.5)*50)]};
  return{at,c:{lat:la,lng:ln},mPerPct:1/(sc*100*z)}}

/* ---------- state for this visit only (never saved) ---------- */
const V={sel:null,me:null,gps:'',err:'',z:1};
const sessionsAt=id=>(typeof HWStairs!=='undefined'?HWStairs.all():[]).filter(s=>s.sid===id);
const visited=id=>st.gp&&st.gp.v&&st.gp.v[id];

function marker(g,i,pr){const[x,y]=pr.at(g),s=g.L[0],n=g.L.length,on=V.sel===i,vis=g.L.some(q=>visited(q.id)||sessionsAt(q.id).length);
  const name=g.L.map(q=>q.name).join('; ');
  return '<button type="button" class="cmpm cmp'+CK[s.cat]+(on?' on':'')+(vis?' vis':'')+'" style="left:'+x.toFixed(2)+'%;top:'+y.toFixed(2)+'%" data-a="cmpsel" data-i="'+i+'" aria-pressed="'+on+'" aria-label="'+esc(name)+', '+CN[s.cat]+(n>1?', '+n+' stairways at one point':'')+(vis?', you have climbed here':'')+'">'+CK[s.cat]+(n>1?'<small class="cmpn" aria-hidden="true">×'+n+'</small>':'')+'</button>'}
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
    +'<rect x="1" y="1" width="298" height="198" fill="none" stroke="#f6c94f" stroke-width="2" rx="6"/></svg>'}
function mapView(P,pr){const bar=100/pr.mPerPct; // 100 m in percent of the map width
  const me=V.me?(()=>{const[x,y]=pr.at(V.me);return x>=-5&&x<=105&&y>=-5&&y<=105?'<span class="cmpme" style="left:'+x.toFixed(2)+'%;top:'+y.toFixed(2)+'%" role="img" aria-label="You are here (± '+Math.round(V.me.acc)+' m)"></span>':''})():'';
  return '<div class="cmpmap" role="group" aria-label="Campus stairways map">'+scenery(P,pr)
    +P.map((g,i)=>{const[x,y]=pr.at(g);return x<-2||x>102||y<-2||y>102?'':marker(g,i,pr)}).join('')+me
    +'<button type="button" class="g sm cmpz" data-a="cmpzoom" aria-pressed="'+(V.z>1)+'">'+(V.z>1?'ZOOM OUT':'ZOOM IN')+'</button>'
    +'<div class="cmpscale" aria-hidden="true"><i style="width:'+Math.min(60,bar).toFixed(2)+'%"></i><small>'+(bar>60?'≈ '+Math.round(60*pr.mPerPct)+' m':'100 m')+'</small></div>'
    +'</div><p class="cmpunv">'+UNV+'</p>'
    +'<p class="cmpleg mut"><span class="cmpk cmp1">1</span> Mild · <span class="cmpk cmp2">2</span> Moderate · <span class="cmpk cmp3">3</span> Vigorous · ×2 or ×3: stairways at one point · a ring: you have climbed there</p>'}
function detail(P){if(V.sel==null||!P[V.sel])return '';const g=P[V.sel];
  const d=V.me?dist(V.me.lat,V.me.lng,g.lat,g.lng):null;
  return '<div class="cmpdet" id="cmpdet" tabindex="-1" role="region" aria-label="Selected place"><b>'+ico('stairs')+' '+(g.L.length>1?g.L.length+' stairways at one point':esc(g.L[0].name))+'</b>'
    +'<p class="mut">'+g.lat.toFixed(7)+', '+g.lng.toFixed(7)+' · '+UNV+(d!=null?' · about '+fmtD(d)+' from you':'')+'</p><ul>'
    +g.L.map(s=>{const n=sessionsAt(s.id).length,v=visited(s.id);
      return '<li><b>'+esc(s.name)+'</b> <small class="mut">('+s.id+')</small><br>'+CN[s.cat]+' · '+esc(s.floor)+' · θ '+s.angle.toFixed(2)+'°'
        +'<br><small>'+(n?'You saved '+n+' stair session'+(n>1?'s':'')+' here':'No stair sessions saved here yet')+(v?' · first GPS check-in '+esc(v):'')+'</small>'
        +'<br><button type="button" class="g sm" data-a="cmpstair" data-id="'+s.id+'">CLIMB HERE ON THE STAIRS PAGE</button></li>'}).join('')+'</ul></div>'}
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
    +STAIRS.filter(s=>s.cat===c).map(s=>{const i=P.findIndex(g=>g.L.includes(s));
      return '<li>'+(i<0?esc(s.name)+' <small class="mut">no coordinates recorded</small>':'<button type="button" class="g sm cmplb" data-a="cmpsel" data-i="'+i+'">'+esc(s.name)+'</button>')+'</li>'}).join('')+'</ul>').join('')
    +(u.length?'<p class="mut">'+u.length+' stairways have no coordinates in the app data, so they are not on the map.</p>':'')+'</details>'}
function where(P){if(!V.me)return '';const near=P.map(g=>({g,d:dist(V.me.lat,V.me.lng,g.lat,g.lng)})).sort((a,b)=>a.d-b.d)[0];
  return '<p class="cmpyou">'+(near&&near.d<1500?'The nearest mapped stairway is <b>'+esc(near.g.L[0].name)+'</b>, about '+fmtD(near.d)+' away (± '+Math.round(V.me.acc)+' m).'
    :'You are about '+fmtD(near?near.d:0)+' from the campus stairways, so you are not shown on the map. Pick a stairway below instead.')+' Your position is used on this screen only: it is not saved or sent.</p>'}
function page(){const P=points(),pr=proj(P);
  return '<div class="card cmpcard" id="cmpcard"><p>The campus stairways on one map. Tap a marker, or open the list, to see a stairway and your own climbs there.</p>'
    +'<p class="warn cmpwarn" role="note"><b>Locations are not verified.</b> They come from the original app data and have no recorded source. One stairway can be off by a little or a lot; check before relying on it.</p>'
    +mapView(P,pr)+detail(P)
    +'<div class="row"><button type="button" data-a="cmpgps"'+(V.gps==='wait'?' disabled':'')+'>'+(V.gps==='wait'?'FINDING YOU...':'SHOW WHERE I AM')+'</button>'+(V.me?'<button type="button" class="g" data-a="cmpforget">HIDE MY POSITION</button>':'')+'</div>'
    +(V.err?'<p class="cmpe" role="alert">'+esc(V.err)+' Pick a stairway on the map or in the list instead.</p>':'')+where(P)
    +list(P)+weather()
    +'<div class="cmpwx"><b>'+ico('map')+' Campus-wide activity</b><p class="mut">Not available. HealthWiz does not collect anyone else\'s location, so there is nothing to show here. Your own visits stay on your device.</p></div></div>'}

/* ---------- actions ---------- */
const keep=()=>{const y=window.scrollY;render();window.scrollTo(0,y)};
acts.cmpgo=()=>go('campus');
acts.cmpsel=d=>{V.sel=+d.i;keep();const e=$('#cmpdet');if(e){e.focus({preventScroll:true});e.scrollIntoView({block:'nearest',behavior:HWUI.reduced()?'auto':'smooth'})}};
acts.cmpstair=d=>{const i=STAIRS.findIndex(s=>s.id===d.id);if(i>=0){S.loc=i;S.cat=STAIRS[i].cat}go('stair')};
acts.cmpzoom=()=>{V.z=V.z>1?1:2;keep()};
acts.cmpforget=()=>{V.me=null;V.err='';keep()};
acts.cmpgps=()=>{const g=navigator.geolocation;V.err='';
  if(!window.isSecureContext){V.err='Location needs a secure (https) page.';keep();return}
  if(!g){V.err='This browser cannot share a location.';keep();return}
  V.gps='wait';keep();
  g.getCurrentPosition(p=>{V.gps='';const c=p.coords;V.me={lat:c.latitude,lng:c.longitude,acc:c.accuracy||0};if(S.v==='campus')keep()},
    e=>{V.gps='';V.err=e&&e.code===1?'Location permission is off for HealthWiz.':e&&e.code===3?'Finding your position took too long.':'Your position is not available right now.';if(S.v==='campus')keep()},
    {enableHighAccuracy:true,timeout:20000,maximumAge:0})};

/* ---------- the page, and its door in the Health Hall (after the Science Laboratory's) ---------- */
pages.campus=()=>page();
PAR.campus='health';
BN.campus=['🗺','Campus Health Observatory','The campus stairways, your climbs, the air outside.','rgba(92,192,90,.20)'];
DIS.campus='Locations are unverified app data. Your position is shown on this screen only and is never saved or sent.';
const door=()=>'<div class="card cmpdoor" id="cmp-door"><h3>'+ico('map')+' CAMPUS HEALTH OBSERVATORY</h3><p>See the campus stairways on a map, find the nearest one, and check the air before you go.</p><button type="button" data-a="cmpgo">OPEN THE OBSERVATORY</button></div>';
{const p=pages.health;pages.health=function(){return p.apply(this,arguments)+door()}}
HWEvents.on('live:updated',()=>{if(S.v==='campus'){const y=window.scrollY;render();window.scrollTo(0,y)}});

HWUI.css('campus',`
.cmpmap{position:relative;width:100%;aspect-ratio:3/2;border-radius:14px;overflow:hidden;border:1px solid var(--edge,var(--ln));box-shadow:0 0 22px rgba(139,92,240,.25),inset 0 0 30px rgba(0,0,0,.25);background:#4f8a45;margin:8px 0 4px}
.cmpmap svg{position:absolute;inset:0;width:100%;height:100%}
.cmpm{position:absolute;width:30px;height:30px;min-height:30px;margin:-15px 0 0 -15px;padding:0;border-radius:50%;font:bold 12px/1 var(--fb,sans-serif);color:#10091f;border:3px solid #1b1745;
  background-image:none;box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 12px var(--cmpc);animation:cmpglow 2.4s steps(4) infinite alternate;z-index:1}
.cmpm.cmp1,.cmpk.cmp1{--cmpc:#5cc05a;background-color:#7ee07c}.cmpm.cmp2,.cmpk.cmp2{--cmpc:#f6c94f;background-color:#f6c94f}.cmpm.cmp3,.cmpk.cmp3{--cmpc:#ff6b5e;background-color:#ff8a7e}
.cmpm.vis{outline:3px solid #63e6dc;outline-offset:2px}.cmpm.on{z-index:2;transform:scale(1.2);box-shadow:0 0 0 3px #fff0a8,0 0 18px #fff0a8}
@keyframes cmpglow{to{box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 20px var(--cmpc)}}
.cmpme{position:absolute;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:#4db3ff;border:3px solid #fff;box-shadow:0 0 0 6px rgba(77,179,255,.35);z-index:3}
.cmpscale{position:absolute;left:62px;bottom:10px;width:60%;color:#fff0a8;text-shadow:0 1px 0 #120f33}.cmpscale i{display:block;height:4px;border:1px solid #fff0a8;border-top:0}.cmpscale small{font-size:11px}
.cmpunv{margin:0 0 2px;font-size:12px;color:var(--mut);text-align:right}.cmpn{position:absolute;right:-8px;top:-8px;font:bold 10px/1 sans-serif;background:#fff0a8;color:#10091f;border-radius:8px;padding:2px 3px;border:1px solid #10091f}
.cmpz{position:absolute;right:8px;bottom:8px;z-index:4;min-height:44px}
.cmpleg{font-size:13px}.cmpk{display:inline-block;width:18px;height:18px;border-radius:50%;text-align:center;font:bold 11px/18px sans-serif;color:#10091f;vertical-align:-3px}
.cmpdet{border:1px solid var(--edge,var(--ln));border-radius:12px;padding:10px;margin:8px 0;background:var(--p2)}.cmpdet ul{list-style:none;padding:0;margin:6px 0}.cmpdet li{margin:6px 0;overflow-wrap:anywhere}
.cmpdet button,.cmpcard .row button,.cmplb{min-height:44px}.cmpe{color:var(--red);font-weight:bold}
.cmpwx{border-top:1px solid var(--edge,var(--ln));padding-top:8px;margin-top:10px}.cmpwx svg,.cmpdet b svg{vertical-align:-3px}
.cmplist ul{list-style:none;padding:0;margin:4px 0;display:flex;flex-wrap:wrap;gap:6px}.cmplist summary{cursor:pointer;min-height:44px;display:flex;align-items:center}
html.hw-rm .cmpm,html.hw-q-performance .cmpm{animation:none}@media(prefers-reduced-motion:reduce){.cmpm{animation:none}.cmpm.on{transform:none}}
`);
return{points,unmapped,proj,UNV,get state(){return{sel:V.sel,me:V.me,err:V.err}}}})();
