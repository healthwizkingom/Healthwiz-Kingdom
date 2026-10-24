/* v6: the campus map's landmarks, journal, layers, feedback and sigils (owner's request, 2026-10-20). Not part of the original.
   * Landmarks (observatory/landmarks.js): optional markers for places MAPPED in the OpenStreetMap export (the gate, the named
     buildings, the squares and the Astaka, the pitches, the water towers). Tapping one opens a card: what it is, its OSM
     id, its level on the illustrative terrain, the nearest staircases. The first time, a discovery animation plays.
   * Discovery and explored areas: a device-only record (localStorage 'hw_obs_found': {landmark id: date}), apart from the
     save and from health records. Exploring is opening a place on the map; it is never treated as a climb, and it gives no
     XP, badges or sigils. The Map journal lists what was discovered and which of the four areas (the base and the three
     raised levels of data/elevation-zones.geojson) the discoveries cover.
   * Layers (device preference 'hw_obs_layers'): staircase markers, landmarks, building labels, terrain contours, paths and
     the decorative effects can each be hidden.
   * A saved stair session (entry:added with a staircase) lights a sigil over its marker; in Fantasy, sparks and a pulse of
     light along the nearest path (observatory/map.js celebrate). Feedback for a real save only, never a loop.
   * Staircase sigils: original badges for recorded stair sessions only (HWStairs.all(), the saved entries): 1, 5, 10, 25
     and 50 sessions, and 3 and 8 different campus staircases. At most two sessions a day count, so climbing more in one
     day earns nothing; no XP, no streaks, nothing to keep up.
   * Arcane controls: the map's buttons as small instruments (a compass whose needle shows north, rotate, zoom, 2D/3D,
     layers), with familiar symbols; their look is in js/v6-campus-css.js and here. */
const HWCampusMagic=(()=>{
const FK='hw_obs_found',LK='hw_obs_layers';
const LAY=[['stairs','Staircase markers'],['landmarks','Landmarks'],['labels','Building labels'],['contours','Terrain contours'],['paths','Paths'],['effects','Decorative effects']];
const AREAS=[['base','The base (no raised level)'],['upper-cluster','Upper cluster (middle level)'],['south-terrace','Blok C terrace'],['southern-region','Southern region (highest level)']];
const ls={get(k,d){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&typeof v==='object'?v:d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const found=()=>ls.get(FK,{});
const layState=()=>{const o=ls.get(LK,{}),r={};LAY.forEach(([k])=>{r[k]=o[k]!==false});return r};
let open=null,panel=false,fresh=null;
const ctl=()=>typeof HWCampus!=='undefined'?HWCampus.map:null;
const list=()=>{const c=ctl();return c&&c.landmarks?c.landmarks:[]};
const facts=l=>{try{return window.HWObsMap&&window.HWObsMap.facts?window.HWObsMap.facts(l.lng,l.lat):null}catch(e){return null}};
const areaOf=l=>{const f=facts(l);return f&&f.zone?f.zone.id:'base'};
const dist=(a,b,c,d)=>{const R=6371008.8,k=Math.PI/180,x=(d-b)*k*Math.cos((a+c)/2*k),y=(c-a)*k;return Math.hypot(x,y)*R};
const keepY=()=>{const y=scrollY;render();scrollTo(0,y)};

/* ---------- the stage: the layers button and panel, the landmark card ---------- */
function layerBtn(b){return b('cmplay','Map layers: show or hide markers, labels, contours, paths and effects','<svg viewBox="0 0 24 24" aria-hidden="true" class="cmpsv2"><path d="m12 4 9 5-9 5-9-5Z"/><path d="m3 14 9 5 9-5"/></svg>',' id="cmplayb" aria-expanded="'+panel+'" aria-controls="cmplayp"')}
function stage(){let h='';const st=layState();
  if(panel)h+='<div class="cmplayp" id="cmplayp" role="group" aria-label="Map layers"><b>Layers</b>'+LAY.map(([k,n])=>'<button type="button" class="cmpsb" data-a="cmplayt" data-k="'+k+'" aria-pressed="'+st[k]+'">'+n+'</button>').join('')+'<small>Kept on this device.</small></div>';
  const l=open&&list().find(x=>x.id===open);
  if(l){const F=found(),f=facts(l),z=f&&f.zone,P=typeof HWCampus!=='undefined'?HWCampus.points():[];
    const near=P.map(g=>({g,d:dist(l.lat,l.lng,g.lat,g.lng)})).sort((a,b)=>a.d-b.d).slice(0,2);
    h+='<div class="cmplmk'+(fresh===l.id?' new':'')+'" id="cmplmk" role="dialog" aria-modal="false" aria-labelledby="cmplmk-t">'
      +'<button type="button" class="cmpsx" data-a="cmplmkx" aria-label="Close">×</button>'
      +(fresh===l.id?'<p class="cmplmkd" role="status">New landmark discovered</p>':'')
      +'<b id="cmplmk-t">'+esc(l.name)+'</b><small>'+esc(l.kindName)+' · mapped in OpenStreetMap ('+esc(l.osm.join(', '))+')'+(l.named?'':'; not named there, so called by what it is and the nearest named building')+'</small>'
      +'<p>'+(z?'On the '+esc(z.name)+' level ('+esc(z.region)+'), illustrative height.':'On the base level of the map.')+'</p>'
      +(near.length?'<p>Nearest staircases: '+near.map(n=>'<button type="button" class="cmplnk" data-a="cmppick" data-id="'+n.g.items[0].id+'">'+esc(n.g.items[0].name)+'</button> (about '+Math.round(n.d/5)*5+' m, real location)').join(', ')+'.</p>':'')
      +'<p class="mut">'+(F[l.id]?'Discovered on '+esc(F[l.id])+'.':'')+' Exploring the map is not a climb: it adds nothing to your health records.</p></div>'}
  return h}

/* ---------- below the map: staircase sigils and the map journal ---------- */
const SIG=[['first','First Step',1,'s'],['five','Five Ascents',5,'s'],['ten','Ten Ascents',10,'s'],['tf','Twenty-five Ascents',25,'s'],['fifty','Fifty Ascents',50,'s'],['way','Wayfarer',3,'d'],['path','Pathfinder',8,'d']];
/** Counted sessions (at most 2 a day) and the different staircases, from saved stair sessions only. */
function counts(){const L=typeof HWStairs!=='undefined'?HWStairs.all():[],per={},ids=new Set();let n=0;
  for(const s of L){per[s.d]=(per[s.d]||0)+1;if(per[s.d]<=2)n++;if(s.sid)ids.add(s.sid)}
  return{s:n,d:ids.size,all:L.length}}
function sigilSvg(i,on){const shape=['<circle cx="20" cy="20" r="17"/>','<path d="M20 3l15 8.5v17L20 37 5 28.5v-17Z"/>','<path d="M13 3h14l10 10v14L27 37H13L3 27V13Z"/>','<path d="M20 2l4.5 9.5L35 13l-7.5 7.5L30 31l-10-5-10 5 2-10.5L5 13l10.5-1.5Z"/>','<path d="M20 2 38 20 20 38 2 20Z"/>','<circle cx="20" cy="20" r="17"/><circle cx="20" cy="20" r="12"/>','<path d="M20 3l15 8.5v17L20 37 5 28.5v-17Z"/><circle cx="20" cy="20" r="9"/>'][i];
  return '<svg viewBox="0 0 40 40" class="cmpsig'+(on?' on':'')+'" aria-hidden="true" focusable="false"><g class="sg1">'+shape+'</g><path class="sg2" d="M12 27h5v-4h5v-4h5v-4h3"/></svg>'}
function sigils(){const c=counts();
  return '<div class="cmpwx cmpsigs" id="cmpsigs"><b>'+HWPixel.icon('achievement',1)+' Staircase sigils</b><ul>'+SIG.map(([id,name,need,k],i)=>{const have=k==='s'?c.s:c.d,on=have>=need;
    return '<li class="'+(on?'on':'')+'" data-sig="'+id+'">'+sigilSvg(i,on)+'<span><b>'+name+'</b><small>'+(k==='s'?need+' recorded stair session'+(need>1?'s':''):need+' different campus staircases')+' · '+(on?'earned':Math.min(have,need)+' of '+need)+'</small></span></li>'}).join('')+'</ul>'
    +'<p class="mut cmpsmall">From your saved stair sessions only: viewing or tapping the map never counts. At most two sessions a day count, so there is nothing to gain from climbing more in one day; rest days are part of training. Sigils give no XP.</p></div>'}
function journal(){const L=list(),F=found();
  if(!L.length)return '<div class="cmpwx" id="cmpjournal"><b>'+HWPixel.icon('map',1)+' Map journal</b><p class="mut">The landmarks appear with the map (open the app from its web address).</p></div>';
  const got=L.filter(l=>F[l.id]),areas=new Set(got.map(areaOf));
  return '<div class="cmpwx" id="cmpjournal"><b>'+HWPixel.icon('map',1)+' Map journal</b><p>Landmarks discovered: <b>'+got.length+'</b> of '+L.length+' · Areas explored: <b>'+areas.size+'</b> of '+AREAS.length+'</p>'
    +'<ul class="cmpareas">'+AREAS.map(([k,n])=>'<li class="'+(areas.has(k)?'on':'')+'">'+n+'</li>').join('')+'</ul>'
    +'<div class="cmplmks">'+L.map(l=>'<button type="button" class="sm cmplmkb'+(F[l.id]?' on':' g')+'" data-a="cmplmk" data-id="'+l.id+'">'+(F[l.id]?esc(l.name):'Undiscovered '+esc(l.kindName.toLowerCase()))+'</button>').join('')+'</div>'
    +'<p class="mut cmpsmall">A place is discovered when you open it on the map. That is exploring, not climbing: it adds nothing to your health records, XP, badges or sigils. Kept on this device only.</p>'
    +(got.length?'<button type="button" class="g sm" data-a="cmplmkreset">FORGET DISCOVERIES</button>':'')+'</div>'}
function below(){return sigils()+journal()}

/* ---------- actions ---------- */
acts.cmplay=()=>{panel=!panel;keepY()};
acts.cmplayt=d=>{const st=layState();if(!(d.k in st))return;st[d.k]=!st[d.k];ls.set(LK,st);const c=ctl();if(c&&c.layers)c.layers(st);keepY()};
function openLm(id,fly){const c=ctl(),l=list().find(x=>x.id===id);if(!l)return;const F=found();fresh=null;
  if(!F[id]){F[id]=today();ls.set(FK,F);fresh=id;if(c)c.discover(id);toast('New landmark discovered: '+l.name)}
  open=id;if(c){c.selectLandmark(id);if(fly)c.flyTo(l.lng,l.lat)}keepY()}
acts.cmplmk=d=>openLm(d.id,true);
acts.cmplmkx=()=>{open=null;fresh=null;const c=ctl();if(c)c.selectLandmark(null);keepY()};
acts.cmplmkreset=()=>{if(!confirm('Forget the landmarks you discovered on this device? Your health records are not touched.'))return;ls.set(FK,{});const c=ctl();if(c)c.landmarkFound([]);open=null;keepY()};
// a stair session saved for a staircase on the map: the feedback on its marker
HWEvents.on('entry:added',e=>{const x=e&&e.entry;if(!x||x.c!=='stair'||!x.m||!x.m.sid||S.v!=='campus')return;
  setTimeout(()=>{const c=ctl();if(!c||!c.ready||typeof HWCampus==='undefined')return;const g=HWCampus.points().find(p=>p.items.some(s=>s.id===x.m.sid));if(g)c.celebrate(g.key)},60)});
HWEvents.on('data:reset',()=>{open=null;fresh=null});
/** The map is ready: its compass needle follows the bearing. */
function ready(c){const m=c&&c.map;if(!m)return;const set=()=>{const n=document.getElementById('cmpcomp');if(n)n.style.setProperty('--b',(-m.getBearing())+'deg')};m.on('rotate',set);set()}
{const p=pages.campus;if(p)pages.campus=function(){const h=p.apply(this,arguments);Promise.resolve().then(()=>{const c=ctl();if(c&&c.map){const n=document.getElementById('cmpcomp');if(n)n.style.setProperty('--b',(-c.map.getBearing())+'deg')}});return h}}

HWUI.css('campusmagic',`
.cmplayp{position:absolute;right:58px;top:10px;z-index:7;display:flex;flex-wrap:wrap;gap:6px;max-width:min(300px,calc(100% - 80px));padding:8px 10px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);color:var(--ink)}
.cmplayp b{width:100%;font-size:13px}.cmplayp small{width:100%;color:var(--mut);font-size:12px}.cmplayp .cmpsb{min-height:36px}.cmplayp .cmpsb[aria-pressed="true"]{outline:2px solid var(--acc,#f2c14e)}.cmplayp .cmpsb[aria-pressed="false"]{opacity:.7;text-decoration:line-through}
.cmplmk{position:absolute;left:10px;bottom:62px;z-index:7;width:min(320px,calc(100% - 80px));padding:10px 12px;background:var(--panel);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);color:var(--ink);font-size:14px}
.cmplmk>b{display:block;font-size:16px;padding-right:28px}.cmplmk small{display:block;color:var(--mut);font-size:12px;margin:2px 0 6px}.cmplmk p{margin:6px 0}.cmplmk .cmpsx{position:absolute;right:6px;top:6px}
.cmplmkd{margin:0 0 4px!important;font:700 12px var(--fl,inherit);letter-spacing:.06em;color:#b8862a;text-transform:uppercase}
.cmpcard[data-mode="fantasy"] .cmplmk{border-color:#8f7fd8;box-shadow:0 0 0 1px rgba(242,193,78,.25),0 0 22px rgba(143,127,216,.35)}
.cmpcard[data-mode="fantasy"] .cmplmkd{color:#ffd36a;text-shadow:0 0 8px rgba(255,211,106,.7)}
.cmplmk.new{animation:cmplmkin .6s ease-out}@keyframes cmplmkin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
html.hw-rm .cmplmk.new,html.hw-still .cmplmk.new{animation:none}
.cmpsigs ul{list-style:none;margin:8px 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.cmpsigs li{display:flex;gap:8px;align-items:center;opacity:.6}.cmpsigs li.on{opacity:1}.cmpsigs li span{display:flex;flex-direction:column}.cmpsigs small{color:var(--mut);font-size:12px}
.cmpsig{flex:0 0 40px;width:40px;height:40px}.cmpsig .sg1{fill:var(--p2,#eee);stroke:var(--mut,#888);stroke-width:2}.cmpsig .sg2{fill:none;stroke:var(--mut,#888);stroke-width:2.5;stroke-linejoin:round}
.cmpsig.on .sg1{fill:#3a2a12;stroke:#ffd36a}.cmpsig.on .sg2{stroke:#ffe9a8}.cmpsig.on{filter:drop-shadow(0 0 4px rgba(255,211,106,.6))}
.cmplg.lmkl{border-radius:50% 50% 50% 2px;transform:rotate(-45deg);background:#b8862a}
.cmpareas{list-style:none;margin:6px 0;padding:0;display:flex;flex-wrap:wrap;gap:6px}.cmpareas li{font-size:12px;padding:2px 8px;border-radius:10px;border:1px dashed var(--line);color:var(--mut)}.cmpareas li.on{border-style:solid;border-color:#b8862a;color:var(--ink)}
.cmplmks{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.cmplmkb{min-height:36px;margin:0;font-size:13px;opacity:.75}.cmplmkb.on{opacity:1;border-color:#b8862a}
/* arcane controls: the map's buttons as small brass-ringed instruments (Fantasy); the same familiar symbols */
.cmpsv2{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.cmpcomp{position:relative;display:inline-grid;place-items:center;width:26px;height:26px}.cmpcomp b{position:relative;font-size:10px;line-height:1;margin-top:13px}
.cmpcomp i{position:absolute;left:50%;top:1px;width:0;height:0;margin-left:-4px;border:4px solid transparent;border-bottom:11px solid #d9453d;transform-origin:4px 12px;transform:rotate(var(--b,0deg));transition:transform .15s}
.cmpcard[data-mode="fantasy"] .cmpctls .cmpctl{border-radius:50%;background:radial-gradient(circle at 50% 35%,#2b3a7c,#121a44 70%);color:#ffe9a8;border:2px solid #c99a3c;
  box-shadow:inset 0 0 0 2px #121a44,inset 0 0 0 3px rgba(255,233,168,.35),0 0 10px rgba(143,127,216,.45)}
.cmpcard[data-mode="fantasy"] .cmpctls .cmpctl:hover{box-shadow:inset 0 0 0 2px #121a44,inset 0 0 0 3px rgba(255,233,168,.6),0 0 14px rgba(255,211,106,.6)}
.cmpcard[data-mode="fantasy"] .cmpctls .cmpctl[aria-pressed="true"],.cmpcard[data-mode="fantasy"] .cmpctls .cmpctl[aria-expanded="true"]{background:radial-gradient(circle at 50% 35%,#f2c14e,#a5741f 75%);color:#1a1430}
.cmpcard[data-mode="fantasy"] .cmpcomp i{border-bottom-color:#ffd36a;filter:drop-shadow(0 0 3px #ffd36a)}
`);
return{stage,below,layerBtn,layers:layState,foundIds:()=>Object.keys(found()),open:id=>openLm(id,false),ready,counts,get current(){return open}}})();
