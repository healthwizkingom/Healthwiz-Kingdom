/* v6: the Arcana upgrades (the "Master Architecture Blueprint", 2026-10-29). Not part of the original.
   Eight small features, each placed on the page that already holds its data (the blueprint named separate .html pages; HealthWiz is
   one page with routes, so each module goes where its route is):

     1 Elemental Thermometer + Hydration Potion   Home            water progress as a potion; opt-in weather (Open-Meteo, KMK's fixed point)
     2 Guild War of Joules                        Training Hall   this week's work against gravity (J) and estimated energy (kJ) per block
     3 Enchanted Tower, Spectral Pacer, Cadence   Observatory     (a staircase's Details) CSS 3D stair, a ghost at a target power, mic cadence
     4 Oracle's Crystal Ball                      Home            a readiness index from sleep, the DASS-21 total and 1-minute heart-rate recovery
     5 Metabolic Forge + Luna's Breathalyzer      Alchemy, Observatory   the kJ-per-litre-of-O2 factor chosen from the last meal; a loudness cue
     6 Gravity Anomaly                            Observatory     g from latitude and altitude; what a spring scale would read
     7 Royal Surveyors                            Science Laboratory   re-measure a flagged staircase: riser ÷ tread → angle
     8 Caloric Ledger                             Alchemy         a balance beam: food energy against the work of the chosen climb

   Honesty rules (AGENTS.md, docs/DISCLAIMERS.md): every number says whether it is measured, calculated or estimated, and none is a
   diagnosis. Where the blueprint asked for a claim no source supports (a fixed "15 % harder" heart, cortisol, "anaerobic" from loudness,
   a lighter mass at altitude) the feature keeps the mechanic and says what it really shows. The formulas themselves (HWArcana.math) are
   pure and tested in tests/93-arcana.test.mjs.

   Saved (optional st.s keys, like st.s.orb, so no schema step): st.s.wx = 1 once the player allows the weather lookup; st.s.gw = {blk, on}
   the player's guild and whether they share its totals; st.s.srv = {ST..: {r, t, a, d}} their own re-measurements (the survey data is never
   edited). Everything else lives in this file's memory. Microphone and weather run only after a tap, never in the background. */
const HWArcana=(()=>{
const G0=9.80665,KJ=4.184,D=document,$i=i=>D.getElementById(i),ico=n=>HWPixel.icon(n,1);
const clamp=(v,a,b)=>v<a?a:v>b?b:v,fx=(x,d)=>(+x).toLocaleString('en',{minimumFractionDigits:d,maximumFractionDigits:d});
const fv=x=>(+x).toLocaleString('en',{maximumFractionDigits:2});
const S6=()=>st.s||(st.s={});

/* =====================================================================================================================
   THE MATH (pure; every input explicit so tests can check worked examples)
   ===================================================================================================================== */
const math={
  /* 1 */ potionPct:(ml,target)=>target>0?clamp(ml/target*100,0,100):0,
          heatStress:w=>!!w&&+w.temp>32&&+w.rh>70,                                   // the blueprint's rule: over 32 °C AND over 70 % humidity
          heatAdjust:(kcal,w)=>math.heatStress(w)?kcal*1.05:kcal,                       // its ASSUMED +5 %; labelled as an assumption where shown
          drySpell:(hrMax,ml,target)=>+hrMax>120&&target>0&&ml<target*.5,
  /* 2 */ workJ:(steps,kg,rise)=>steps*kg*G0*rise,                                     // W = n m g r
          kJ:kcal=>kcal*KJ,
          guilds(rows){const by={};rows.forEach(r=>{if(!r||!r.blk)return;const g=by[r.blk]||(by[r.blk]={blk:r.blk,n:0,W:0,E:0});g.n+=r.n||1;g.W+=+r.W||0;g.E+=+r.E||0});
            const L=Object.values(by).sort((a,b)=>b.W-a.W||a.blk.localeCompare(b.blk));if(L.length&&L[0].W>0)L[0].top=1;return L},
  /* 3 */ towerTilt:angle=>90-angle,                                                   // rotateX for a flight drawn flat, then raised to the stair's angle
          pacerRate:(P,kg,rise)=>P>0&&kg>0&&rise>0?P/(kg*G0*rise):null,                 // steps per second at power P: P = n m g r / t
          rms(buf){let s=0;for(let i=0;i<buf.length;i++)s+=buf[i]*buf[i];return buf.length?Math.sqrt(s/buf.length):0},
          cadence(peaks){if(!peaks||peaks.length<3)return null;const g=[];for(let i=1;i<peaks.length;i++){const d=peaks[i]-peaks[i-1];if(d>=150&&d<=2000)g.push(d)}
            if(g.length<2)return null;const f=1000/(g.reduce((a,b)=>a+b,0)/g.length);return{f,w:2*Math.PI*f}},
  /* 4 */ readiness(sleepH,dassT,drop){const sleep=Math.min(sleepH/8*100,100),stress=100-dassT/63*100,rec=Math.min(drop/40*100,100);
            return{sleep,stress,rec,score:sleep*.4+stress*.3+clamp(rec,0,100)*.3}},
  /* 5 */ RER:{mixed:[20.1,'mixed diet (RER about 0.82)'],'high-carb':[21.1,'mostly carbohydrate (RER 1.0)'],'low-carb':[19.6,'mostly fat (RER 0.7)'],
            fasting:[19.6,'no meal logged for 12 hours, so fat (RER 0.7) is assumed']},
          forge:(lmin,min,factor)=>lmin*min*factor,                                   // kJ = VO2 (L/min) × minutes × kJ per litre of O2
          mealKind(foods,now){const t=e=>new Date(e.d+'T'+(e.t||'12:00')).getTime(),L=foods.filter(e=>t(e)<=now).sort((a,b)=>t(a)-t(b)),e=L.pop();
            if(!e)return{k:'mixed',why:'no meal logged, so the mixed-diet value is used'};if(now-t(e)>12*36e5)return{k:'fasting',e};
            const m=typeof emac==='function'?emac(e):null;if(!m)return{k:'mixed',e,why:'the meal has no macronutrient data'};
            const kc=m.p*4+m.c*4+m.f*9;if(kc<=0)return{k:'mixed',e};const c=m.c*4/kc;return{k:c>=.6?'high-carb':c<=.25?'low-carb':'mixed',e,c}},
  /* 6 */ gravity(latDeg,alt){const p=latDeg*Math.PI/180;return 9.780327*(1+.0053024*Math.sin(p)**2-.0000058*Math.sin(2*p)**2)-3.086e-6*alt},
          scaleRead:(kg,gCal,gHere)=>kg*gHere/gCal,                                   // a spring scale calibrated where g = gCal, read where g = gHere
  /* 7 */ angleOf:(r,t)=>r>0&&t>0?Math.atan(r/t)*180/Math.PI:null,
          survey(r,t,db){const a=math.angleOf(r,t);return a==null?null:{a,diff:Math.abs(a-db),ok:Math.abs(a-db)<=2}},
  /* 8 */ tilt:(work,food)=>food>0?Math.min(45,work/food*45):0};

/* =====================================================================================================================
   DATA FROM THE SAVE (read at the moment, never copied)
   ===================================================================================================================== */
let SC={k:'',v:[]};                                                                    // the stair sessions, rebuilt only after a save
const sessions=()=>{if(typeof HWStairs==='undefined')return[];const k=SV+':'+st.e.length;if(SC.k!==k)SC={k,v:HWStairs.all()};return SC.v};
const lastWorkout=d=>sessions().filter(s=>s.kind==='workout'&&(!d||s.d===d)).sort((a,b)=>(a.d+(a.t||'')).localeCompare(b.d+(b.t||''))).pop()||null;
const hrMaxOf=s=>s?Math.max(+s.hrHi||0,+s.hrA||0)||null:null;
const massInfo=()=>typeof HWGravity!=='undefined'?HWGravity.massInfo():null;
const riseOf=id=>{try{return id?HWGravity.verifiedRise(id):null}catch(e){return null}};
const ST20=()=>riseOf('ST20')||.169;
const mon=()=>{const x=new Date();x.setHours(12,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x)};
const say=(type,e)=>{try{if(typeof HWMedius!=='undefined')HWMedius.say(type,e)}catch(err){}};
const oops=m=>{try{toast('<b>'+ico('scroll')+' The spell fizzled.</b> '+esc(m))}catch(e){}};
if(typeof HWMedius!=='undefined'&&HWMedius.rules){
  HWMedius.rules['arc-dry']={p:72,cd:6*36e5,line:()=>'Dry spell! You climbed hard today and drank under half your water goal. When you are low on fluids your heart has to work harder to move blood. Brew an Alchemist’s Potion: two glasses of water.'};
  HWMedius.rules['arc-oracle']={p:60,cd:6*36e5,line:()=>'The Oracle sees short sleep, a stormy check-in or a slow heart-rate recovery. A vigorous climb can wait: the Oracle suggests a mild path (below 26°) today.'}}

/* =====================================================================================================================
   1. ELEMENTAL THERMOMETER + HYDRATION POTION (Home)
   ===================================================================================================================== */
const KMK={lat:5.36,lng:100.56},WX_URL='https://api.open-meteo.com/v1/forecast?latitude='+KMK.lat+'&longitude='+KMK.lng+'&current=temperature_2m,relative_humidity_2m';
let WX={st:'off',w:null,at:0,err:''};
async function weather(force){
  if(WX.st==='busy'||(!force&&WX.w&&Date.now()-WX.at<30*6e4))return WX;
  if(navigator.onLine===false){WX={st:'err',w:WX.w,at:WX.at,err:'You are offline, so the sky cannot be read.'};return WX}
  WX.st='busy';{const n=$i('arc-elem');if(n)n.outerHTML=elemCard()}
  try{const ac=typeof AbortController!=='undefined'?new AbortController():null,tm=setTimeout(()=>ac&&ac.abort(),8000);
    const r=await fetch(WX_URL,{cache:'no-store',signal:ac&&ac.signal});clearTimeout(tm);
    if(!r.ok)throw new Error('HTTP '+r.status);const j=await r.json(),c=j&&j.current;
    if(!c||!isFinite(+c.temperature_2m)||!isFinite(+c.relative_humidity_2m))throw new Error('no reading in the reply');
    WX={open:WX.open,st:'ok',w:{temp:+c.temperature_2m,rh:+c.relative_humidity_2m,time:String(c.time||'')},at:Date.now(),err:''}}
  catch(e){WX={open:WX.open,st:'err',w:null,at:0,err:'The weather service did not answer ('+(e&&e.name==='AbortError'?'timed out':String(e&&e.message||e))+').'};oops('The weather could not be read. Try again later.')}
  const n=$i('arc-elem');if(n)n.outerHTML=elemCard();return WX}
function potion(){
  const d=today(),w=wt(d),t=+st.s.water||0,p=math.potionPct(w,t),full=p>=100;
  return '<div class="arc-pot'+(full?' full':'')+'"><div class="arc-potw"><div class="potion-bottle" role="progressbar" aria-label="Water today" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(p)
    +'" aria-valuetext="'+w+' of '+t+' mL, '+Math.round(p)+' percent"><i class="cork"></i><div class="liquid-fill" style="height:'+p.toFixed(1)+'%"><i class="wave"></i><b class="bub"></b><b class="bub"></b><b class="bub"></b><b class="bub"></b></div><i class="shine"></i></div>'+(full?'<span class="arc-spark" aria-hidden="true">'+'<i></i>'.repeat(8)+'</span>':'')+'</div>'
    +'<div><b class="num">'+w.toLocaleString('en')+'</b> <small>of '+t.toLocaleString('en')+' mL</small><span class="arc-st">'+(full?stt('good')+' Potion brewed':p>=50?stt('watch')+' Half full':stt('caution')+' Under half')+'</span>'
    +'<small class="mut">Logged water toward your own goal (calculated).</small></div></div>'}
function elemCard(){
  const burn=typeof HWScore!=='undefined'?Math.round(HWScore.burnOf(today())):0,w=WX.w,hot=math.heatStress(w);
  let wx;
  if(!S6().wx)wx='<p class="mut">Read the sky over Kolej MARA Kulim (5.36° N, 100.56° E) from Open-Meteo? It sends only the college’s fixed position, never yours.</p><button type="button" class="g" data-a="arcwx">READ THE SKY</button>';
  else if(WX.st==='busy')wx='<p class="mut" role="status">Reading the sky…</p>';
  else if(!w)wx='<p class="mut" role="status">'+esc(WX.err||'No weather reading yet.')+'</p><button type="button" class="g" data-a="arcwx">TRY AGAIN</button>';
  else wx='<div class="arc-thermo'+(hot?' hot':'')+'">'+(hot?'<span class="arc-sun" aria-hidden="true"></span>':'')+'<div class="therm" aria-hidden="true"><i style="height:'+clamp((w.temp-15)/25*100,4,100).toFixed(0)+'%"></i></div><div><b class="num">'+fx(w.temp,1)+' °C</b> · <b class="num">'+Math.round(w.rh)+' %</b> <small>humidity</small>'
    +'<small class="mut">Measured by Open-Meteo’s model for the campus area'+(w.time?', '+esc(w.time.replace('T',' ')):'')+'.</small>'
    +(hot?'<p class="arc-warn" role="note">'+stt('caution')+' The sun is fierce! Your body uses extra energy to cool down.</p>':'<p>'+stt('good')+' Not in the hot and humid band (over 32 °C and over 70 %).</p>')
    +(burn>0?'<p>Estimated burn today: <b class="num">'+burn+' kcal</b>'+(hot?' → <b class="num">'+Math.round(math.heatAdjust(burn,w))+' kcal</b> with HealthWiz’s assumed +5 % for heat (an illustration, not measured).':'.')+'</p>':hot?'<p class="mut">No calorie-burn estimate today, so the assumed +5 % for heat has nothing to adjust.</p>':'')+'</div></div>';
  const sum=w?'Elemental thermometer: '+fx(w.temp,1)+' °C, '+Math.round(w.rh)+' %'+(hot?' (fierce sun)':''):'Elemental thermometer';
  return '<div class="arc-elem" id="arc-elem"><h4>Hydration potion</h4>'+potion()+'<details class="arc-more"'+(WX.open?' open':'')+'><summary>'+sum+'</summary>'+wx+'</details></div>'}
acts.arcwx=()=>{S6().wx=1;WX.open=1;save();weather(true)};
function dryCheck(){const s=lastWorkout(today()),t=+st.s.water||0;if(s&&math.drySpell(hrMaxOf(s),wt(today()),t))say('arc-dry')}

/* =====================================================================================================================
   4. THE ORACLE'S CRYSTAL BALL (Home)
   ===================================================================================================================== */
function oracleIn(){
  const d0=ymd(new Date(Date.now()-2*864e5)),d14=ymd(new Date(Date.now()-14*864e5));
  const sl=LC('sleep').filter(e=>e.d>=d0&&+e.v>0).pop(),ds=LC('stress').filter(e=>e.d>=d14&&e.m&&e.m.dass&&isFinite(+e.m.dass.t)).pop();
  const wk=sessions().filter(s=>s.kind==='workout'&&s.hrA&&s.hrR1&&s.d>=d14).pop();
  return{sleep:sl?+sl.v:null,dass:ds?+ds.m.dass.t:null,drop:wk?wk.hrA-wk.hrR1:null}}
function oracle(){
  const I=oracleIn(),miss=[];if(I.sleep==null)miss.push('last night’s sleep (Sleep page)');if(I.dass==null)miss.push('a DASS-21 check-in in the last 14 days (Stress Quest)');
  if(I.drop==null)miss.push('a stair workout with the pulse "after" and "1 minute after"');
  let body;
  if(miss.length)body='<p class="arc-sc mut">The crystal is cloudy.</p><details class="arc-more"><summary>What clears it</summary><p class="mut">'+miss.map(esc).join('; ')+'.</p></details>';
  else{const R=math.readiness(I.sleep,I.dass,I.drop),sc=Math.round(R.score),k=sc>=70?'good':sc>=50?'watch':'caution';
    body='<p class="arc-sc"><b class="num big">'+sc+'</b> <small>/ 100 readiness index</small> '+stt(k)+'</p>'
      +(sc<50?'<p class="arc-warn" role="note">The Oracle suggests a mild path (below 26°) today.</p>':'')
      +'<details class="arc-more"><summary>How the Oracle reads you</summary>'+(sc<50?'<p>Medius: “Your sleep, stress check-in and heart-rate recovery are all pulling the crystal down. A vigorous climb can wait.”</p>':'')+'<ul class="arc-orl"><li>Sleep '+fx(I.sleep,1)+' h → '+Math.round(R.sleep)+' × 0.4</li><li>DASS-21 total '+I.dass+' / 63 → '+Math.round(R.stress)+' × 0.3</li><li>1-minute recovery '+I.drop+' BPM → '+Math.round(clamp(R.rec,0,100))+' × 0.3</li></ul>'
      +'<small class="mut">Calculated from your own logs with the blueprint’s weights (40 / 30 / 30). It is a game index, not a medical measure of readiness.</small></details>';
    if(sc<50)setTimeout(()=>say('arc-oracle'),0)}
  return '<div class="arc-orc" id="arc-oracle"><h4>Oracle’s crystal ball</h4><div class="arc-orbw'+(miss.length?' dim':'')+'">'+RING+'<canvas class="arc-ball" id="arc-ball" width="48" height="48" role="img" aria-label="'
    +(miss.length?'A cloudy crystal ball: not enough data':'A crystal ball glowing with the readiness index')+'"></canvas></div>'+body+'</div>'}
const RING='<svg class="arc-ring" viewBox="0 0 120 120" aria-hidden="true"><defs><path id="arc-rp" d="M60 60m-50 0a50 50 0 1 1 100 0a50 50 0 1 1-100 0"/></defs><circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4"/><text><textPath href="#arc-rp">✦ ☽ ✧ △ ◇ ✶ ☉ ✦ ▽ ✧ ☾ ◇ ✶ △ ✦ ☽ ✧ ▽ ◇ ✶</textPath></text></svg>';
let ballRaf=0;const REVEAL=2200;   // the nebula swirls for 2.2 s when Home opens, then holds (the app runs no frame loop while idle); the rune ring and glow stay CSS
/* The crystal: 48 × 48 pixels drawn per frame (a swirling nebula inside a glass sphere), shown at 2.5× with image-rendering: pixelated.
   Its colour follows the index band (teal ≥ 70, gold 50–69, rose < 50; grey without data). Still under reduced motion and Performance. */
function ball(){
  cancelAnimationFrame(ballRaf);const c=$i('arc-ball');if(!c||!c.getContext)return;const x=c.getContext('2d');if(!x)return;
  const I=oracleIn(),ok=I.sleep!=null&&I.dass!=null&&I.drop!=null,sc=ok?math.readiness(I.sleep,I.dass,I.drop).score:0;
  const col=!ok?[140,140,165]:sc>=70?[79,224,200]:sc>=50?[255,216,107]:[255,122,138],vio=[120,80,220],deep=[22,14,52];
  const lowq=D.documentElement.classList.contains('hw-q-performance'),still=(HWUI.reduced&&HWUI.reduced())||lowq;
  const im=x.createImageData(48,48),d=im.data,R=19,CX=24,CY=22,mix=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
  const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const put=(px,py,c3,al)=>{const o=(py*48+px)*4;d[o]=c3[0];d[o+1]=c3[1];d[o+2]=c3[2];d[o+3]=al};
  const draw=t=>{if(!c.isConnected)return;d.fill(0);const T=t/1000;
    for(let py=0;py<48;py++)for(let px=0;px<48;px++){const dx=px-CX,dy=py-CY,r=Math.sqrt(dx*dx+dy*dy);
      if(r<=R){const a=Math.atan2(dy,dx),sw=a+r*.18-T*(ok?.9:.3);
        let v=Math.sin(sw*3)*.5+Math.sin(px*.31+T*1.3)*.25+Math.sin(py*.27-T*1.1+dx*.1)*.25;v=(v+1)/2;
        const q=Math.floor(v*4+(BAY[(py&3)*4+(px&3)]/16-.5)*.9),lv=Math.max(0,Math.min(3,q));
        let c3=[deep,mix(deep,vio,.8),mix(vio,col,.7),mix(col,[255,255,255],.35)][lv];
        const edge=r/R;if(edge>.86)c3=mix(c3,[200,190,255],.55);                                   // glass rim
        if((px-17)**2+(py-14)**2<6)c3=[255,255,255];                                           // highlight
        if(ok&&((px*7+py*13+Math.floor(T*3))%97===0))c3=[255,255,255];                         // drifting motes
        put(px,py,c3,255)}
      else if(r<=R+1.6)put(px,py,mix(col,[255,255,255],.2),Math.round(140*(ok?1:.5)))}             // glow ring
    for(let px=13;px<35;px++){put(px,42,[217,180,90],255);put(px,43,[140,100,40],255)}               // gilded stand
    for(let px=16;px<32;px++)for(let py=44;py<47;py++)put(px,py,py===44?[90,60,140]:[58,42,90],255);
    for(let py=40;py<42;py++)for(let px=19;px<29;px++)put(px,py,[217,180,90],255);
    x.putImageData(im,0,0);if(!still&&t-t0<REVEAL)ballRaf=requestAnimationFrame(draw)};
  const t0=performance.now();draw(t0)}

/* Home: ONE card. Medius's notices (HWInsights, js/v6-insights.js: the #insh list keeps its id and rows) sit in a strip above the two
   columns, and the potion and the crystal ball line up under one heading row, with their "more" panels on the same line at the bottom. */
{const p=pages.home;pages.home=function(){const h=p.apply(this,arguments);if(!st.e.length)return h;   // a new player's Home stays short: the table appears with the first log
  const t=document.createElement('template');t.innerHTML=h;const n=t.content.querySelector('#insh');let mn='';
  if(n){mn='<div class="arc-mn" id="insh">'+n.innerHTML.replace('<h3>','<h4>').replace('</h3>','</h4>')+'</div>';n.remove()}
  const c='<div class="card arc-home" id="arc-home"><h3>'+ico('wizard')+' THE ORACLE’S TABLE</h3>'+mn+'<div class="arc-hg">'+elemCard()+oracle()+'</div></div>',k='<div class="card hmq" id="hmq">',h2=t.innerHTML,i=h2.indexOf(k);
  return i<0?h2+c:h2.slice(0,i)+c+h2.slice(i)}}

/* =====================================================================================================================
   2. THE GUILD WAR OF JOULES (Training Hall)
   ===================================================================================================================== */
const BLOCKS=['Blok A','Blok B','Blok C','Blok E','Blok Aisyah','Blok FAZ','Other / day student'];
function myWeek(){
  const m=mon(),t=today(),mi=massInfo(),L=sessions().filter(s=>s.d>=m&&s.d<=t&&s.total>0);
  let steps=0,W=0,est=0;L.forEach(s=>{const r=riseOf(s.sid);if(!r)est++;steps+=s.total;if(mi)W+=math.workJ(s.total,mi.kg,r||ST20())});
  let kcal=0;const days=[];for(let d=new Date(m+'T12:00');ymd(d)<=t;d.setDate(d.getDate()+1))days.push(ymd(d));
  if(typeof HWScore!=='undefined')days.forEach(d=>{kcal+=HWScore.burnOf(d)||0});
  return{wk:m,steps,n:L.length,W:mi?W:null,E:math.kJ(kcal),kcal,est,mass:mi}}
let GW={rows:null,st:'idle',err:''};
const gw=()=>{const g=S6().gw;return g&&typeof g==='object'?g:{blk:'',on:0}};
async function guildSync(){
  const c=typeof HWCloud!=='undefined'?HWCloud:null,G=gw();if(!c||!c.who()||!G.on||!G.blk)return;
  GW.st='busy';
  try{const me=myWeek();
    if(me.W!=null)await c.api('/rest/v1/rpc/hw_guild_publish',{method:'POST',body:{p_block:G.blk,p_wk:me.wk,p_work_j:Math.round(me.W),p_energy_kj:Math.round(me.E)}});
    const r=await c.api('/rest/v1/rpc/hw_guild_totals',{method:'POST',body:{p_wk:me.wk}});
    GW={rows:Array.isArray(r)?r.map(x=>({blk:String(x.block),n:+x.members||0,W:+x.work_j||0,E:+x.energy_kj||0})):[],st:'ok',err:''}}
  catch(e){GW={rows:null,st:'err',err:'The guild ledger could not be reached.'};oops('The guild ledger could not be reached. Your own row is still shown.')}
  const n=$i('guild-war-tab');if(n)n.outerHTML=guild()}
function guild(){
  const G=gw(),me=myWeek(),c=typeof HWCloud!=='undefined'&&HWCloud.who();
  const mine=me.W==null?null:{blk:G.blk||'Your guild',n:1,W:me.W,E:me.E};
  const rows=GW.rows&&G.on?math.guilds(GW.rows):mine?math.guilds([mine]):[];
  const tb=rows.length?'<div class="arc-tw"><table class="leaderboard"><caption class="mut">This week (from '+esc(me.wk)+'). '+(GW.rows&&G.on?'Totals per block; a block shows once at least 3 players share it.':'Your own row; join to see every block’s totals.')+'</caption>'
    +'<thead><tr><th scope="col">Guild (Block)</th><th scope="col">Total Work (J)</th><th scope="col">Total Energy (kJ)</th></tr></thead><tbody>'
    +rows.map(r=>'<tr'+(r.top?' class="guild-banner-top"':'')+' style="--p:'+(rows[0].W>0?(r.W/rows[0].W*100).toFixed(1):0)+'%"><th scope="row">'+(r.top?'<span class="arc-crown" aria-hidden="true"></span>':'')+esc(r.blk)+(r.top?' <span class="pxtag">TOP</span>':'')+(r.n>1?' <small class="mut">'+r.n+' players</small>':'')+'</th><td>'+Math.round(r.W).toLocaleString('en')+'</td><td>'+Math.round(r.E).toLocaleString('en')+'</td></tr>').join('')+'</tbody></table></div>'
    :'<p class="mut">'+(me.mass?'No stair climbs logged this week yet.':'Add your weight (BMI page or profile) so the work of your climbs can be calculated.')+'</p>';
  return '<div class="card arc-gw" id="guild-war-tab"><h3>'+ico('stairs')+' THE GUILD WAR OF JOULES</h3>'
    +'<p>Not steps: physics. Work against gravity W = steps × mass × 9.80665 m/s² × step rise; energy = estimated kcal burned × 4.184.</p>'
    +'<label>Your guild<select data-ch="arcblk" aria-label="Your guild (block)"><option value="">Choose your block…</option>'+BLOCKS.map(b=>'<option'+(G.blk===b?' selected':'')+'>'+esc(b)+'</option>').join('')+'</select></label>'
    +tb
    +'<small class="mut">You: '+me.steps+' steps in '+me.n+(me.n===1?' session':' sessions')+(me.mass?', '+esc(me.mass.src)+' ('+me.mass.kg+' kg)':'')+'. Step rise: the stairway’s measured or angle-estimated rise'+(me.est?'; '+me.est+' session(s) without one use ST20’s measured '+fx(ST20()*100,1)+' cm':'')+'. Energy uses the Stairs, Running and Training estimates. Work is calculated; energy is estimated.</small>'
    +(c?'<div class="row arc-row"><button type="button" class="'+(G.on?'g':'')+'" data-a="arcgw" '+(G.blk?'':'disabled ')+'aria-pressed="'+(G.on?'true':'false')+'">'+(G.on?'STOP SHARING':'SHARE MY GUILD TOTALS')+'</button>'+(G.on?'<button type="button" class="g" data-a="arcgwr">REFRESH</button>':'')+'</div>'
      +'<small class="mut">Sharing sends only your block and this week’s two totals. Nobody sees a name, and a block with fewer than 3 players stays hidden.'+(GW.st==='busy'?' Updating…':GW.err?' '+esc(GW.err):'')+'</small>'
      :'<small class="mut">Sign in (Settings → Account) to compare blocks. Without it the ledger is your own.</small>')+'</div>'}
CH.arcblk=v=>{const G=gw();G.blk=BLOCKS.includes(v)?v:'';if(!G.blk)G.on=0;S6().gw=G;save();GW.rows=null;const n=$i('guild-war-tab');if(n)n.outerHTML=guild()};
acts.arcgw=()=>{const G=gw();G.on=G.on?0:1;S6().gw=G;save();GW.rows=null;const n=$i('guild-war-tab');if(n)n.outerHTML=guild();if(G.on)guildSync()};
acts.arcgwr=()=>guildSync();
{const p=pages.exercise;if(p)pages.exercise=function(){return p.apply(this,arguments)+guild()}}

/* =====================================================================================================================
   3 + 5 + 6. THE STAIR CHAMBER (a staircase's Details in the Observatory)
   ===================================================================================================================== */
const Z={sid:null,path:null,P:'',pace:{on:0},mic:null,peaks:[],cad:null,breath:null,match:0,cam:null,sight:null,xr:null,you:0};
function stopMic(){const m=Z.mic;Z.mic=null;if(!m)return;cancelAnimationFrame(m.raf);clearTimeout(m.tm);try{m.stream.getTracks().forEach(t=>t.stop())}catch(e){}try{m.ctx.close()}catch(e){}}
async function openMic(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('This browser has no microphone access.');
  const stream=await navigator.mediaDevices.getUserMedia({audio:true}),AC=window.AudioContext||window.webkitAudioContext;
  if(!AC){stream.getTracks().forEach(t=>t.stop());throw new Error('This browser has no Web Audio.')}
  const ctx=new AC(),an=ctx.createAnalyser();an.fftSize=2048;ctx.createMediaStreamSource(stream).connect(an);return{stream,ctx,an,buf:new Float32Array(an.fftSize),raf:0,tm:0}}
async function echo(){
  if(Z.mic){stopMic();paint();return}
  try{const m=await openMic();m.kind='echo';Z.mic=m;Z.peaks=[];Z.cad=null;let up=0;
    const loop=()=>{if(Z.mic!==m)return;m.an.getFloatTimeDomainData(m.buf);const r=math.rms(m.buf),t=performance.now();
      if(r>.1&&!up&&(!Z.peaks.length||t-Z.peaks[Z.peaks.length-1]>=150)){up=1;Z.peaks.push(t);if(Z.peaks.length>9)Z.peaks.shift();ripple();if(Z.pace.on)Z.you++;Z.cad=math.cadence(Z.peaks);out()}else if(r<.05)up=0;
      m.raf=requestAnimationFrame(loop)};loop();paint()}
  catch(e){stopMic();oops(e&&e.name==='NotAllowedError'?'The microphone was not allowed.':String(e&&e.message||'The microphone could not start.'));paint()}}
async function breathe(){
  if(Z.mic)stopMic();
  try{const m=await openMic();m.kind='breath';Z.mic=m;const L=[];paint();
    const loop=()=>{if(Z.mic!==m)return;m.an.getFloatTimeDomainData(m.buf);L.push(math.rms(m.buf));m.raf=requestAnimationFrame(loop)};loop();
    m.tm=setTimeout(()=>{const s=L.slice().sort((a,b)=>b-a),top=s.slice(0,Math.max(1,Math.floor(s.length/2))),r=top.reduce((a,b)=>a+b,0)/top.length;
      stopMic();Z.breath={rms:r,loud:r>.3,at:Date.now()};paint();const f=$i('arc-forge');if(f)f.outerHTML=forge()},5000)}
  catch(e){stopMic();oops(e&&e.name==='NotAllowedError'?'The microphone was not allowed.':String(e&&e.message||'The microphone could not start.'));paint()}}
const breathOn=()=>Z.breath&&Date.now()-Z.breath.at<10*6e4?Z.breath:null;
function ripple(){const b=$i('arc-echo');if(!b||D.documentElement.dataset.motion!=='full')return;const r=D.createElement('i');r.className='arc-rip';b.appendChild(r);setTimeout(()=>r.remove(),1300)}
function out(){const o=$i('arc-cad');if(!o)return;const c=Z.cad,gr=pacer();
  o.textContent=c?'Frequency: '+fx(c.f,2)+' Hz | Angular: '+fx(c.w,2)+' rad/s':Z.mic&&Z.mic.kind==='echo'?'Listening… climb, and each footstep louder than the threshold is counted.':'Not listening.';
  const m=!!(c&&gr&&Math.abs(c.f-gr)/gr<=.1);if(m!==!!Z.match){Z.match=m;const t=$i('arc-tower');if(t)t.classList.toggle('arc-rune',m)}}
function pacer(){const mi=massInfo(),r=(Z.path&&Z.path.flights[0]&&Z.path.flights[0].riser)||riseOf(Z.sid);return r&&mi?math.pacerRate(+Z.P,mi.kg,r):null}
const allSteps=q=>Array.isArray(q.steps)?q.steps.reduce((a,b)=>a+(+b||0),0):0;                 // every flight (js/v6-stairs-data.js)
const counted=q=>allSteps(q)>0;
const stepsOf=q=>counted(q)?allSteps(q):12;                      // the ghost climbs every counted step of the stairway (12 drawn as a picture if never counted)

/* ---------- the tower: one pixel canvas (120 × 150, scaled with image-rendering: pixelated) ----------
   The flight is drawn in profile at the stairway's real angle (rise ÷ run = tan θ), one rune on each riser. With the pacer on, a
   requestAnimationFrame loop moves the ghost up at the target rate (steps/s), lights each rune as it passes, and leaves a trail; at the
   top it starts again from step 1. With the Scrying Glass on, the canvas is transparent over the rear camera and only neon lines,
   runes and the ghost are drawn. The loop runs only while the pacer runs (reduced motion: one step at a time, no trail). */
const TW=120,TH=150,GHOST=['..aaa..','.aaaaa.','aabaaba','aaaaaaa','aaaaaaa','aaaaaaa','a.a.a.a'];
const TV={trail:[],sp:[],raf:0,iv:0,t0:0,last:-1};
/* The stairway's shape for the ghost: per flight {n, riser, tread, turn}. Source, in order: the Group 14 measured step (F21 stairs, the
   report stays the source of truth), the campus survey's per-flight riser and tread when in the usual range (riser 8–25 cm, tread
   20–45 cm), else the angle estimate (riser = HWGravity's, tread = riser ÷ tan θ). Step counts per flight come from the survey counts. */
function stairPath(q){
  if(!q)return null;const counts=Array.isArray(q.steps)&&q.steps.length?q.steps.map(x=>+x||0):[stepsOf(q)],kind=HWGravity.riseKind(q.id),r0=riseOf(q.id);
  const study=kind==='study'?HWStairs.STUDY.find(x=>x.id===q.id):null,turns=i=>i<counts.length-1?'not surveyed':null;
  if(study)return{src:'measured (Group 14)',flights:counts.map((n,i)=>({n,riser:study.rise,tread:study.run,turn:turns(i)}))};
  let plan=null;try{const rec=typeof HWCampusData!=='undefined'?HWCampusData.record(q.id):null;plan=rec?(HWCampusData.surveyPlan(rec)||HWCampusData.stepPlan(rec)):null}catch(e){}
  if(plan&&plan.length&&plan.every(f=>f.n>0&&f.riser>=.08&&f.riser<=.25&&f.tread>=.2&&f.tread<=.45))
    return{src:'surveyed per flight',flights:plan.map(f=>({n:f.n,riser:f.riser,tread:f.tread,turn:f.turn,land:f.landingLength}))};
  if(!r0)return null;
  return{src:'estimated from the angle',flights:counts.map((n,i)=>({n,riser:r0,tread:r0/Math.tan(q.angle*Math.PI/180),turn:turns(i)}))}}
const SS=()=>HWStairSight;
function steps3(F){const L=SS().layout(F),out=[];F.forEach((f,fi)=>{for(let i=0;i<f.n;i++)out.push({fi,i,d:L[fi].d0+i*f.tread,h:L[fi].h0+(i+1)*f.riser,t:f.tread,r:f.riser})});return{L,S:out}}
function towerFrame(c,q,g){
  const x=c.getContext('2d');if(!x)return;const path=Z.path||{flights:[{n:stepsOf(q),riser:.17,tread:.17/Math.tan(q.angle*Math.PI/180)}]},F=path.flights,GEO=steps3(F),ST=GEO.S,n=ST.length;
  const ar=!!Z.cam,sync=!!Z.match,lit=g?g.k:-1,T=performance.now()/1000;
  const neon=sync?'#ffd86b':ar?'#5ff6ff':'#7ff3ff',dim=ar?'rgba(190,140,255,.95)':'#6a55b8';
  x.clearRect(0,0,TW,TH);
  if(!ar){const gr=x.createLinearGradient(0,0,0,TH);gr.addColorStop(0,'#070b24');gr.addColorStop(1,'#241a5e');x.fillStyle=gr;x.fillRect(0,0,TW,TH);
    for(let i=0;i<28;i++){const sx=(i*37)%TW,sy=(i*53)%(TH-50),tw=(Math.sin(T*2+i)+1)/2;x.fillStyle='rgba(255,255,255,'+(.25+.6*tw).toFixed(2)+')';x.fillRect(sx,sy,1,1)}
    x.fillStyle='#fff6c8';x.fillRect(96,10,8,8);x.fillStyle='#241a5e';x.fillRect(99,9,7,7)}                          // a crescent moon
  else{const v=x.createRadialGradient(TW/2,TH/2,TH*.3,TW/2,TH/2,TH*.75);v.addColorStop(0,'rgba(10,6,30,0)');v.addColorStop(1,'rgba(10,6,30,.55)');x.fillStyle=v;x.fillRect(0,0,TW,TH)}
  const r=Math.round,px=(X,Y,w,h,c3)=>{x.fillStyle=c3;x.fillRect(r(X),r(Y),Math.max(1,r(w)),Math.max(1,r(h)))};
  const still=HWUI.reduced&&HWUI.reduced(),moving=!!(g&&Z.pace.on),trail=(gx,gy,ps)=>{if(!moving||still)return;TV.trail.push([gx,gy,ps]);if(TV.trail.length>16)TV.trail.shift();
    if(Math.random()<.5)TV.sp.push([gx-3*ps+Math.random()*6*ps,gy,1]);TV.sp=TV.sp.filter(p=>(p[1]-=.6,p[2]-=.03)>0);
    TV.trail.forEach((p,k)=>{x.fillStyle='rgba(127,243,255,'+(k/TV.trail.length*.55).toFixed(2)+')';x.fillRect(r(p[0]-p[2]),r(p[1]),Math.max(2,r(p[2]*2)),2)});
    TV.sp.forEach(p=>{x.fillStyle='rgba(255,255,255,'+p[2].toFixed(2)+')';x.fillRect(r(p[0]),r(p[1]),1,1)})};
  const ghost=(cx,by,ps)=>{const w=7*ps,h=7*ps,gx=cx-w/2,gy=by-h;                                                  // centred on cx, feet at by
    x.fillStyle='rgba(127,243,255,.22)';x.fillRect(r(gx)-2*ps,r(gy)-2*ps,w+4*ps,h+4*ps);x.fillStyle='rgba(127,243,255,.3)';x.fillRect(r(gx)-ps,r(gy)-ps,w+2*ps,h+2*ps);
    GHOST.forEach((row,yy)=>[...row].forEach((ch,xx)=>{if(ch!=='.')px(gx+xx*ps,gy+yy*ps,ps,ps,ch==='b'?'#1b1340':'#e9fbff')}))};
  const rune=(X,Y,on,z)=>{z=z||2;if(on){x.fillStyle=sync?'rgba(255,216,107,.35)':'rgba(95,246,255,.35)';x.fillRect(r(X)-z,r(Y)-z,z*3,z*3)}px(X,Y,z,z,on?'#ffffff':dim);if(on&&z>1){px(X-1,Y+.5,1,1,neon);px(X+2,Y+.5,1,1,neon)}};   // z: 1 px on a long stairway, so 55 runes still fit
  const you=Z.pace.on&&Z.you>0?(Z.you-1)%n:-1,pl=g?g.pl:null,lift=pl&&!pl.landing?Math.sin(Math.min(1,(pl.u||0)/.55)*Math.PI):0;
  const mark=(X,Y)=>{px(X-1,Y-2,3,1,'#ffd86b');px(X-2,Y-1,5,1,'#ffd86b');px(X-1,Y,3,1,'#ffd86b')};
  if(ar&&Z.sight&&Z.sight.st.locked&&Z.sight.st.edges.length>1){
    /* Stair Sight locked on: the ghost climbs the step edges seen in the camera picture (js/v6-stairsight.js), bottom first, one edge per
       step at that step's pace; on screen it loops over the edges in view, as the next steps come into view while you climb. */
    const sx=TW/SS().DW,sy=TH/SS().DH,E=Z.sight.st.edges.map(e=>({y:e.y*sy,x0:e.x0*sx,x1:e.x1*sx,fill:e.fill})),m=E.length;
    const kk=pl?(pl.landing?lit:pl.k):-1,u=pl&&!pl.landing?pl.u:1,j=kk<0?-1:kk%m,w0=E[0].x1-E[0].x0;
    E.forEach(e=>{x.fillStyle=sync?'rgba(255,216,107,.25)':'rgba(95,246,255,.22)';x.fillRect(r(e.x0),r(e.y)-1,r(e.x1-e.x0),3);px(e.x0,e.y,e.x1-e.x0,1,e.fill?dim:neon)});
    for(let i=0;i<m-1;i++){const a1=E[i],b1=E[i+1];for(let t=0;t<=1;t+=.25){px(a1.x0+(b1.x0-a1.x0)*t,a1.y+(b1.y-a1.y)*t,1,1,dim);px(a1.x1+(b1.x1-a1.x1)*t-1,a1.y+(b1.y-a1.y)*t,1,1,dim)}}
    E.forEach((e,i)=>{const z=(e.x1-e.x0)>w0*.45?2:1;rune(e.x0-1,e.y-1,i<=j,z);rune(e.x1-1,e.y-1,i<=j,z)});
    if(you>=0){const e=E[you%m];mark((e.x0+e.x1)/2,e.y-3)}
    const A=j<0?{y:E[0].y+(E[0].y-(E[1]?E[1].y:E[0].y-8)),x0:E[0].x0,x1:E[0].x1}:E[j],B=j<0?E[0]:E[Math.min(j+1,m-1)],e2=SS().ease(u),mid=e=>(e.x0+e.x1)/2;
    const wd=(A.x1-A.x0)+((B.x1-B.x0)-(A.x1-A.x0))*e2,gx=mid(A)+(mid(B)-mid(A))*e2,ps=Math.max(1,Math.round(3*wd/w0)),by=A.y+(B.y-A.y)*SS().ease(u/.55)-lift*2*ps;
    trail(gx,by-2*ps,ps);ghost(gx,by,ps);return}
  const last=ST[n-1],Dt=last.d+last.t;
  if(ar){
    /* the climber's view: the flight recedes UP the screen; depth follows the real distance d (unfolded), so a landing shows as a wider gap
       and a deeper tread as a wider spacing. y = top + (foot − top) ÷ (1 + 0.25 d ÷ mean tread). */
    const tm=ST.reduce((a,s2)=>a+s2.t,0)/n,cx=TW/2,top=12,foot=TH-8,w0=50,k=d=>1/(1+.25*Math.max(0,d+tm)/tm),Y=d=>top+(foot-top)*k(d),HW=d=>w0*k(d);
    px(cx-HW(-tm),Y(-tm),HW(-tm)*2,1,neon);
    ST.forEach(s2=>{const y=Y(s2.d),hw=HW(s2.d);px(cx-hw,y,hw*2,1,neon)});
    GEO.L.forEach((o,fi)=>{if(fi<F.length-1){const f=F[fi],d1=o.d0+f.n*f.tread,d2=d1+o.land;for(let t=0;t<=1;t+=.1){px(cx-HW(d1+(d2-d1)*t),Y(d1+(d2-d1)*t),1,1,dim);px(cx+HW(d1+(d2-d1)*t)-1,Y(d1+(d2-d1)*t),1,1,dim)}px(cx-HW(d2),Y(d2),HW(d2)*2,1,dim)}});
    for(let i=0;i<n-1;i++){const A=ST[i],B=ST[i+1];if(B.fi!==A.fi)continue;for(let t=0;t<=1;t+=.5){const d=A.d+(B.d-A.d)*t;px(cx-HW(d),Y(d),1,1,dim);px(cx+HW(d)-1,Y(d),1,1,dim)}}
    ST.forEach((s2,i)=>{const y=Y(s2.d)-1,hw=HW(s2.d),z=k(s2.d)>.35?2:1;rune(cx-hw-1,y,i<=lit,z);rune(cx+hw-1,y,i<=lit,z)});
    if(you>=0)mark(cx,Y(ST[you].d)-3);
    const gd=pl?pl.d:-tm,ps=Math.max(1,Math.round(3*k(gd))),by=Y(gd+tm*.5)-lift*2*ps;
    trail(cx,by-2*ps,ps);ghost(cx,by,ps);return}
  // side view, true proportions, flights unfolded into one line (a turn is drawn straight on)
  const Ht=SS().layout(F).reduce((a,o,fi)=>Math.max(a,o.h0+F[fi].n*F[fi].riser),0),L0=10,B0=TH-12,sc=Math.min((TW-22)/(Dt+.4),(TH-40)/Ht),X=d=>L0+(d+.2)*sc,Yh=h=>B0-h*sc;
  ST.forEach((s2,i)=>{px(X(s2.d),Yh(s2.h),s2.t*sc+1,B0-Yh(s2.h),i%2?'#3b3466':'#443c75');px(X(s2.d),Yh(s2.h),s2.t*sc+1,1,'#d9b45a')});
  GEO.L.forEach((o,fi)=>{if(fi<F.length-1){const f=F[fi],d1=o.d0+f.n*f.tread,h=o.h0+f.n*f.riser;px(X(d1),Yh(h),o.land*sc+1,B0-Yh(h),'#2f2a5a');px(X(d1),Yh(h),o.land*sc+1,1,'#8f7ad8')}});
  px(L0-2,B0,TW-L0,2,'#1a1440');
  const rz=ST[0].t*sc>=4?2:1;ST.forEach((s2,i)=>rune(X(s2.d)+(rz>1?1:0),Yh(s2.h-s2.r/2)-(rz>1?1:0),i<=lit,rz));
  if(you>=0){const s2=ST[you];mark(X(s2.d)+s2.t*sc/2,Yh(s2.h)-4)}
  const gx=pl?X(pl.d):X(-.1),by=pl?Yh(pl.h)-1:B0-1,ps=Math.max(1,Math.min(2,Math.round(ST[0].t*sc/3)+1));
  trail(gx,by-3*ps,ps);ghost(gx,by,ps)}
function towerStop(){cancelAnimationFrame(TV.raf);clearInterval(TV.iv);TV.raf=TV.iv=0}
/* Stair Sight: about 8 frames a second while the camera is open */
function sense(t){const S=Z.sight;if(!S||t-S.at<125)return;S.at=t;const g=S.smp.read($i('camera-feed'),TW/TH);S.st=g?S.trk.push(g):S.trk.state;scryTag()}
function scryTag(){const e=$i('arc-scry-tag'),S=Z.sight;if(!e)return;const on=!!(S&&S.st.locked),t=!S?'SCRYING GLASS':on?'STAIRS SEEN · '+S.st.edges.length+' STEP EDGES':'LOOKING FOR STEPS…';
  if(e.textContent!==t){e.textContent=t;e.classList.toggle('seen',on);const l=$i('arc-seen');if(l)l.textContent=on?'Stair Sight sees '+S.st.edges.length+' step edges; the ghost climbs them.':S?'Stair Sight is looking for steps. Stand at the foot and point the camera up the stairs.':''}}
function pace(){towerStop();const c=$i('arc-canvas'),q=STAIRS.find(s=>s.id===Z.sid);if(!c||!q)return;Z.path=Z.path||stairPath(q);
  const path=Z.path,mi=massInfo(),P=+Z.P,live=!!(Z.pace.on&&pacer()&&path&&mi);
  if(!live){TV.trail=[];TV.sp=[]}
  if(!live&&!Z.cam){towerFrame(c,q,null);return}
  const still=HWUI.reduced&&HWUI.reduced(),lb=$i('arc-pst'),T=live?SS().timeline(path.flights,P,mi.kg):null,L=live?SS().layout(path.flights):null;
  const ends=[];if(path){let a2=0;path.flights.forEach(f=>{a2+=f.n;ends.push(a2-1)})}const n=ends.length?ends[ends.length-1]+1:0,nf=path?path.flights.length:1;
  const step=t=>{if(!c.isConnected||(!Z.pace.on&&!Z.cam)){towerStop();return false}sense(t);
    if(!live){towerFrame(c,q,null);return true}
    const p=SS().at(T,(t-TV.t0)/1000);if(still&&p)p.u=1;const pl=SS().place(path.flights,L,p),k=pl.landing?ends[pl.fi]:pl.k,key=pl.landing?'L'+pl.fi:k;
    if(k<TV.last)TV.trail=[];
    if(key!==TV.key){TV.key=key;TV.last=k;if(lb)lb.textContent=pl.landing?'Ghost on the landing after flight '+(pl.fi+1)+' of '+nf:'Ghost on step '+(k+1)+' of '+n+(nf>1?' (flight '+(pl.fi+1)+' of '+nf+')':'')}
    towerFrame(c,q,{pl,k});return true};
  TV.t0=performance.now();TV.last=-1;TV.key=null;
  if(still){step(TV.t0);TV.iv=setInterval(()=>step(performance.now()),150)}
  else{const tick=t=>{if(step(t))TV.raf=requestAnimationFrame(tick)};TV.raf=requestAnimationFrame(tick)}}

/* ---------- the Scrying Glass: the rear camera behind the tower ---------- */
function attachCam(){const v=$i('camera-feed');if(!v)return;if(Z.cam){v.srcObject=Z.cam.stream;v.style.display='block';const p=v.play();if(p&&p.catch)p.catch(()=>{})}else{v.srcObject=null;v.style.display='none'}}
function stopCam(){const c=Z.cam;Z.cam=null;Z.sight=null;if(c)try{c.stream.getTracks().forEach(t=>t.stop())}catch(e){}const v=$i('camera-feed');if(v){v.srcObject=null;v.style.display='none'}}
async function scry(){
  if(Z.cam)return;
  try{if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error('This browser cannot open the camera.');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
    if(!$i('stair-sense-modal')){stream.getTracks().forEach(t=>t.stop());return}                                       // left while asking
    Z.cam={stream};Z.sight=typeof HWStairSight!=='undefined'?{smp:HWStairSight.sampler(),trk:HWStairSight.tracker(),at:0,st:{locked:false,edges:[]}}:null;if(pacer())Z.pace.on=1;paint()}
  catch(e){stopCam();oops(e&&e.name==='NotAllowedError'?'The camera was not allowed, so the tower stays in its night sky.':String(e&&e.message||'The camera could not start.')+' The tower stays in its night sky.');paint()}}
function halt(){Z.pace.on=0;Z.you=0;stopCam();paint()}

/* ---------- 3D Stair Sight (WebXR, Android Chrome with ARCore): observatory/xrstairs.js ----------
   Offered only when navigator.xr says 'immersive-ar' is supported (secure page). The session is requested inside the tap with hit-test
   (required) and depth-sensing and dom-overlay (optional); the module is loaded after. A panel over the AR view (dom-overlay) shows the
   search, the measured rise, tread and angle (an AR estimate) and the ghost's step, with RESCAN and HALT. Ending, leaving the page or
   hiding the app ends the session. Without support, the 2D Scrying Glass stays. */
const XR={sup:null};
function xrCheck(){if(XR.sup!==null)return;XR.sup=false;try{if(window.isSecureContext&&navigator.xr&&navigator.xr.isSessionSupported)
  navigator.xr.isSessionSupported('immersive-ar').then(ok=>{XR.sup=!!ok;if(ok){const b=$i('start-xr-btn');if(b)b.hidden=false}}).catch(()=>{})}catch(e){}}
function xrUI(){let u=$i('arc-xr-ui');if(!u){u=D.createElement('div');u.id='arc-xr-ui';u.className='arc-xr-ui';u.hidden=true;
    u.innerHTML='<p id="arc-xr-st" role="status" aria-live="polite"></p><p id="arc-xr-m" class="arc-xr-m"></p><div class="arc-xr-b"><button type="button" class="g" data-a="arcxrscan">RESCAN</button><button type="button" data-a="arcxrend">HALT</button></div>';
    D.body.appendChild(u)}return u}
function xrState(S){const st=$i('arc-xr-st'),m=$i('arc-xr-m'),q=STAIRS.find(x=>x.id===Z.sid),n=q?stepsOf(q):0;
  if(S.phase==='ended'){Z.xr=null;const u=$i('arc-xr-ui');if(u)u.hidden=true;paint();return}
  if(st)st.textContent=S.phase==='locked'?'Stairs found. The ghost '+(pacer()?'climbs all '+n+' steps at '+fx(+Z.P,0)+' W'+(S.landing?': on the landing after flight '+S.flight:S.step>0?': step '+S.step+' of '+n:''):'waits at the foot (no target power was typed)')+'.':S.why;
  if(m)m.textContent=S.phase==='locked'?'AR estimate: rise ≈ '+fx(S.riser*100,1)+' cm, tread ≈ '+fx(S.tread*100,1)+' cm, angle ≈ '+fx(S.angle,1)+'°'+(q?' (survey: '+q.angle.toFixed(2)+'°)':'')+'.':(S.depth?'Using the phone\u2019s depth sensing and surface hits.':'Using surface hits (this phone gives no depth map).')}
/* observatory/xrstairs.js is a module that sets window.HWXRStairs; loaded like the campus map's modules (a module script tag, no import()) */
function loadXRStairs(){if(window.HWXRStairs)return Promise.resolve(window.HWXRStairs);
  return new Promise((ok,no)=>{const s=D.createElement('script');s.type='module';s.src='observatory/xrstairs.js';
    s.onload=()=>window.HWXRStairs?ok(window.HWXRStairs):no(new Error('no HWXRStairs'));s.onerror=()=>no(new Error('load failed'));D.head.appendChild(s)})}
async function xr(){
  if(Z.xr||!navigator.xr)return;stopCam();const q=STAIRS.find(x=>x.id===Z.sid);if(!q)return;const ui=xrUI();
  let session;
  try{session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['local-floor','hit-test'],optionalFeatures:['dom-overlay','depth-sensing'],domOverlay:{root:ui},
      depthSensing:{usagePreference:['cpu-optimized'],dataFormatPreference:['luminance-alpha','float32']}})}
  catch(e){oops('3D Scrying could not start on this phone ('+(e&&e.name||'error')+'). The 2D Scrying Glass still works.');return}
  try{const mod=await loadXRStairs();ui.hidden=false;
    const mi=massInfo(),path=Z.path||stairPath(q);const ctl=await mod.start(session,{n:stepsOf(q),flights:path?path.flights.map(f=>({n:f.n,turn:f.turn,land:f.land})):null,P:pacer()?+Z.P:0,m:mi?mi.kg:0,analyse:HWStairSight.profile3d,onState:xrState});Z.xr={ctl,session}}
  catch(e){try{session.end()}catch(x){}ui.hidden=true;oops('3D Scrying could not load ('+String(e&&e.message||e).slice(0,80)+'). The 2D Scrying Glass still works.')}}
acts.arcxr=()=>xr();acts.arcxrend=()=>{if(Z.xr)Z.xr.ctl.stop()};acts.arcxrscan=()=>{if(Z.xr)Z.xr.ctl.rescan()};

/* the pace in words: one step takes m g r ÷ P seconds; the whole climb adds the steps of every flight and the landings */
function climbTxt(){const mi=massInfo(),P=+Z.P,path=Z.path;if(!path)return['–','the shape of this stairway is not known'];if(!mi)return['–','needs your weight'];if(!(P>0))return['–','type a target power'];
  const T=SS().timeline(path.flights,P,mi.kg),F=path.flights,t1=mi.kg*9.80665*F[0].riser/P,nl=F.length-1;
  return[fx(T.total,1)+' s','one step: m g r ÷ P = '+fx(mi.kg,1)+' × 9.80665 × '+fx(F[0].riser,3)+' ÷ '+fx(P,0)+' = '+fx(t1,2)+' s'+(nl?'; '+nl+(nl>1?' landings':' landing')+', each 2 step-times (assumed)':'')]}
function shapeTxt(p){const F=p.flights,same=F.every(f=>Math.abs(f.riser-F[0].riser)<1e-6&&Math.abs(f.tread-F[0].tread)<1e-6);
  return same?fx(F[0].riser*100,1)+' × '+fx(F[0].tread*100,1)+' cm':F.map(f=>f.n+' × '+fx(f.riser*100,1)+'/'+fx(f.tread*100,1)).join(', ')+' cm'}
function chamber(id){
  const q=STAIRS.find(s=>s.id===id);if(!q)return'';if(Z.sid!==id){stopMic();stopCam();Z.sid=id;Z.path=null;Z.pace.on=0;Z.cad=null;Z.peaks=[];Z.match=0;Z.P='';Z.you=0}
  Z.path=stairPath(q);const n=stepsOf(q),r=riseOf(id),mi=massInfo(),rate=pacer(),on=!!Z.pace.on,cam=!!Z.cam,lis=!!(Z.mic&&Z.mic.kind==='echo');
  const best=sessions().map(s=>{const e=st.e.find(x=>x.id===s.id),g=e&&e.m&&e.m.gv;return g&&+g.P>0?+g.P:0}).reduce((a,b)=>Math.max(a,b),0);
  const row=(k,v,note)=>'<div class="arc-bk"><dt>'+k+'</dt><dd>'+v+(note?'<small>'+note+'</small>':'')+'</dd></div>';
  return '<section class="arc-ch" id="stair-sense-modal" aria-labelledby="arc-ch-t"><h3 id="arc-ch-t">'+ico('stairs')+' THE ENCHANTED TOWER · '+esc(q.id)+'</h3>'
    +'<div class="arc-tg2"><div class="arc-stage'+(cam?' ar':'')+(Z.match?' arc-rune':'')+(on?' live':'')+'" id="arc-tower" role="img" aria-label="'+esc(q.id)+' in profile at '+q.angle.toFixed(2)+' degrees, '+n+' steps'+(on?', the spectral pacer climbing':'')+(cam?', over the camera view':'')+'">'
    +'<video id="camera-feed" autoplay playsinline muted style="display:none;"></video><canvas id="arc-canvas" width="'+TW+'" height="'+TH+'"></canvas>'
    +(cam?'<span class="arc-scry-tag" id="arc-scry-tag" aria-hidden="true">'+(Z.sight?'LOOKING FOR STEPS…':'SCRYING GLASS')+'</span>':'')+'</div>'
    +'<div class="arc-book"><h4>Spellbook</h4><dl>'
    +'<div class="arc-bk"><dt><label for="arc-p">Target power</label></dt><dd><input type="number" min="10" max="1500" step="1" inputmode="numeric" data-in="arcp" id="arc-p" value="'+esc(Z.P)+'" placeholder="'+(best?'best '+Math.round(best):'e.g. 120')+'" aria-describedby="arc-p-u"> <span id="arc-p-u">W</span></dd></div>'
    +row('Rate','<b id="arc-rate">'+(rate?fx(rate,2)+' steps/s':'–')+'</b>',mi?'P ÷ (m g r), with '+esc(mi.src):'needs your weight: log it on the BMI page or in your profile')
    +'<div class="arc-bk"><dt>Whole climb</dt><dd><b id="arc-climb">'+climbTxt()[0]+'</b><small id="arc-climb-n">'+climbTxt()[1]+'</small></dd></div>'
    +row('Steps',Z.path?shapeTxt(Z.path):(r?fx(r*100,1)+' cm':'–'),Z.path?esc(Z.path.src):'not known for this stairway')
    +row('Angle',q.angle.toFixed(2)+'°',(counted(q)?n+' steps counted'+(q.steps.length>1?' in '+q.steps.length+' flights ('+q.steps.join(' + ')+')':''):'steps not counted yet: '+n+' drawn as a picture only'))
    +'</dl><div class="arc-btns"><button type="button" class="btn-primary" id="start-ar-btn" data-a="arcar" '+(cam?'disabled':'')+'>'+(cam?'SCRYING…':'CAST SCRYING GLASS (AR)')+'</button>'
    +'<button type="button" class="btn-primary arc-xr-btn" id="start-xr-btn" data-a="arcxr"'+(XR.sup?'':' hidden')+'>CAST 3D SCRYING (WebXR)</button>'
    +'<button type="button" class="btn-secondary g sm" id="stop-btn" data-a="'+(on||cam?'archalt':'arcpace')+'" '+(on||cam||rate?'':'disabled ')+'>'+(on||cam?'HALT PACER':'SUMMON PACER')+'</button></div>'
    +(cam?'<small class="mut" id="arc-seen" aria-live="polite">'+(Z.sight?'Stair Sight is looking for steps. Stand at the foot and point the camera up the stairs.':'')+'</small>':'')
    +'<small class="mut arc-sight-note">Stair Sight finds the edges of steps in the camera picture (a simple 2D estimate, on this device only). It can miss steps in dim light and mistake stripes or shelves for stairs; without a lock the ghost climbs the drawn stairs.</small>'
    +'<small class="mut" id="arc-pst" aria-live="polite">'+(rate?'':'Type a target power to summon the ghost.')+'</small></div></div>'
    +'<h4>'+ico('energy')+' CADENCE ECHO</h4><p class="mut">The microphone hears footsteps: each rise in loudness (RMS over 0.1) is one step, shown as a gold mark on the tower. f = 1 ÷ the mean time between steps; ω = 2πf. Nothing is recorded or sent.</p>'
    +'<div class="row arc-row"><button type="button" class="'+(lis?'arc-listen':'')+'" data-a="arcecho" aria-pressed="'+(lis?'true':'false')+'">'+(lis?'LISTENING · TAP TO STOP':'LISTEN FOR FOOTSTEPS')+'</button></div>'
    +'<div class="arc-echo'+(lis?' on':'')+'" id="arc-echo" aria-hidden="true"><b></b></div><p class="num arc-cad" id="arc-cad" aria-live="polite"></p><small class="mut">When your step frequency is within 10 % of the ghost’s, the runes turn gold (and the words above say so).</small>'
    +'<h4>'+ico('heart')+' LUNA’S WIND SPELL (TALK TEST)</h4><p class="mut">After the climb, breathe near the phone for 5 seconds.</p>'
    +'<div class="row arc-row"><button type="button" id="luna-breathalyzer" data-a="arcbreath" '+(Z.mic&&Z.mic.kind==='breath'?'disabled':'')+'>'+(Z.mic&&Z.mic.kind==='breath'?'LISTENING FOR 5 SECONDS…':'CAST THE WIND SPELL')+'</button></div>'+(Z.mic&&Z.mic.kind==='breath'?'<div class="arc-wind" aria-hidden="true">'+'<i></i>'.repeat(7)+'</div>':'')+breathTxt()
    +gravityCard(q)+'</section>'}
function breathTxt(){const b=breathOn();if(!b)return'';
  return '<p class="arc-warn" role="status">'+(b.loud?stt('watch')+' Luna’s Wind Spell hears heavy breathing (loudness '+fx(b.rms,2)+'). The Metabolic Forge now uses the RER 1.0 value for the next 10 minutes.':stt('good')+' Calm breathing (loudness '+fx(b.rms,2)+'). The forge keeps the value from your meal.')+'</p>'
    +'<small class="mut">Loudness is a rough cue, not a gas measurement: the microphone cannot see which fuel your muscles use. Hard breathing does go with harder efforts.</small>'}
function paint(){xrCheck();const s=$i('stair-sense-modal');if(s&&Z.sid){const f=D.activeElement&&D.activeElement.id;s.outerHTML=chamber(Z.sid);attachCam();out();pace();if(f){const e=$i(f);if(e&&!e.disabled)e.focus()}}}
INP.arcp=el=>{Z.P=el.value;const r=pacer();if(Z.pace.on&&!r)Z.pace.on=0;const t=$i('arc-rate');if(t)t.textContent=r?fx(r,2)+' steps/s':'–';
  const C=climbTxt(),c1=$i('arc-climb'),c2=$i('arc-climb-n');if(c1)c1.textContent=C[0];if(c2)c2.textContent=C[1];
  const b=$i('stop-btn');if(b&&!Z.pace.on&&!Z.cam)b.disabled=!r;const l=$i('arc-pst');if(l&&!Z.pace.on)l.textContent=r?'Ready: summon the pacer or cast the Scrying Glass.':'Type a target power to summon the ghost.';pace()};
acts.arcpace=()=>{if(!pacer())return;Z.pace.on=1;Z.you=0;paint()};
acts.archalt=()=>halt();acts.arcar=()=>scry();
acts.arcecho=()=>echo();acts.arcbreath=()=>breathe();

/* 6. gravity at the campus */
const ALT=50;
function gravityCard(q){
  const mi=massInfo(),h=(()=>{const r=riseOf(q.id),n=allSteps(q);return r&&n?r*n:null})();
  const g0=math.gravity(KMK.lat,0),gB=math.gravity(KMK.lat,ALT),gT=math.gravity(KMK.lat,ALT+(h||0));
  const sea=mi?mi.kg:null,top=mi?math.scaleRead(mi.kg,g0,gT):null;
  return '<h4>'+ico('balance')+' THE GRAVITY ANOMALY</h4>'
    +'<figure class="arc-grav"><svg viewBox="0 0 220 120" role="img" aria-label="Earth’s pull at the foot and at the top of the stair; the top arrow is shorter. Not to scale."><defs><radialGradient id="arc-eg" cx="50%" cy="100%" r="90%"><stop offset="0" stop-color="#4fe0c8"/><stop offset=".6" stop-color="#2a4fb0"/><stop offset="1" stop-color="#14204f"/></radialGradient><marker id="arc-ah" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8Z" fill="#ffd86b"/></marker></defs>'
    +'<g class="arc-field">'+[30,70,110,150,190].map(x=>'<line x1="'+x+'" y1="0" x2="'+x+'" y2="96"/>').join('')+'</g>'
    +'<path d="M-20 120 Q110 70 240 120 Z" fill="url(#arc-eg)"/><path class="arc-gst" d="M70 96 h12 v-8 h12 v-8 h12 v-8 h12 v-8 h12 v-8 h12 v-8" fill="none"/>'
    +'<circle cx="70" cy="86" r="5" class="arc-fig"/><line x1="70" y1="70" x2="70" y2="92" marker-end="url(#arc-ah)" class="arc-g"/>'
    +'<circle cx="142" cy="38" r="5" class="arc-fig"/><line x1="142" y1="24" x2="142" y2="43" marker-end="url(#arc-ah)" class="arc-g"/>'
    +'<text x="6" y="66">foot: g '+fx(gB,6)+'</text><text x="96" y="16">top: g '+fx(gT,6)+'</text></svg><figcaption class="mut">Arrow lengths exaggerated: the real difference is a few millionths.</figcaption></figure>'
    +'<p>g = 9.780327 (1 + 0.0053024 sin²φ − 0.0000058 sin² 2φ) − 3.086×10⁻⁶ h, at φ = 5.36°:</p>'
    +'<ul class="arc-orl num"><li>sea level: '+fx(g0,6)+' m/s²</li><li>campus (about '+ALT+' m, assumed): '+fx(gB,6)+' m/s²</li>'+(h?'<li>top of '+esc(q.id)+' (+'+fx(h,2)+' m): '+fx(gT,6)+' m/s²</li>':'')+'</ul>'
    +(mi?'<p class="arc-cmp num" title="Gravity is slightly weaker up here!"><span>Scale reading at sea level: <b>'+fx(sea,3)+' kg</b></span><span>Same scale at the stair top: <b>'+fx(top,3)+' kg</b></span></p>'
      +'<small class="mut">Gravity is slightly weaker up here! Your mass does not change; a spring scale set at sea level reads '+fx((1-gT/g0)*1e6,1)+' parts per million less, because it measures your weight m g. ('+esc(mi.src)+'.)</small>'
      :'<small class="mut">Add your weight to see what a scale would read.</small>')}
if(typeof HWStairs!=='undefined'){const p=HWStairs.logPanel;HWStairs.logPanel=function(id){if(id)setTimeout(xrCheck,0);const h=p.apply(this,arguments);try{return id?h+chamber(id):h}catch(e){console.warn('[HWArcana]',e);return h}}}
HWEvents.on('page:viewed',e=>{if(e.view!=='campus'){stopMic();stopCam();towerStop();Z.pace.on=0;if(Z.xr)Z.xr.ctl.stop()}});
HWEvents.on('stairs:closed',()=>{stopCam();towerStop();Z.pace.on=0});
D.addEventListener('visibilitychange',()=>{if(D.hidden){stopMic();if(Z.cam){stopCam();Z.pace.on=0;paint()}}});

/* =====================================================================================================================
   5. THE METABOLIC FORGE + 8. THE CALORIC LEDGER (Alchemy)
   ===================================================================================================================== */
function forge(){
  const s=sessions().filter(x=>x.kind==='workout'&&x.hrB&&x.hrA&&x.dur>0).pop(),V=s?HWStairs.projectVO2({hrB:s.hrB,hrA:s.hrA,dur:s.dur}):null;
  const mk=math.mealKind(st.e.filter(e=>e.c==='food'),Date.now()),b=breathOn(),k=b&&b.loud?'high-carb':mk.k,fct=math.RER[k];
  let body;
  if(!V||V.kj==null)body='<p class="mut">The forge needs a stair workout with the pulse before and after, its duration, and your weight (Stairs page).</p>';
  else{const E=math.forge(V.lmin,V.dur,fct[0]),E0=math.forge(V.lmin,V.dur,20.1);
    body='<p>Latest workout ('+esc(s.d)+', '+fx(V.dur,1)+' min): VO₂ ≈ '+fx(V.lmin,2)+' L/min (our project’s Uth-ratio estimate).</p>'
      +'<p>Fuel: <b>'+esc(fct[1])+'</b>'+(b&&b.loud?' — Luna’s Wind Spell detected heavy breathing; energy calculation adjusted.':mk.e?' (from '+esc((mk.e.m&&mk.e.m.name)||'your last meal')+(mk.c!=null?', '+Math.round(mk.c*100)+' % of its energy from carbohydrate':'')+')':'')+'.</p>'
      +'<p class="num">E = '+fx(V.lmin,2)+' L/min × '+fx(V.dur,1)+' min × '+fx(fct[0],1)+' kJ/L = <b>'+Math.round(E).toLocaleString('en')+' kJ</b> ('+Math.round(E/KJ)+' kcal)'
      +(fct[0]!==20.1?' <small class="mut">mixed-diet value: '+Math.round(E0)+' kJ</small>':'')+'</p>'}
  const fl='<div class="arc-flame f-'+k+'" aria-hidden="true">'+'<i></i>'.repeat(7)+'<b class="arc-anvil"></b>'+'<s></s>'.repeat(5)+'</div>';
  return '<div class="card arc-forge" id="arc-forge"><h3>'+ico('energy')+' THE METABOLIC FORGE</h3><div class="arc-fg">'+fl+'<div><p class="mut">Each litre of oxygen releases more energy when the body runs on carbohydrate (21.1 kJ, RER 1.0) than on fat (19.6 kJ, RER 0.7); a mixed diet is about 20.1 kJ.</p>'
    +body+'</div></div><small class="mut">Estimated: the fuel mix is assumed from your last logged meal (carbohydrate ≥ 60 % of its energy = high-carb, ≤ 25 % = low-carb), not measured. The difference is a few percent.</small></div>'}
function ledger(){
  let f=null,c=null;try{f=HWAlchemy.food();c=HWAlchemy.climb()}catch(e){}
  const fk=f&&f.ok?f.kJ:null,wk=c&&c.W!=null?c.W/1000:null;
  if(fk==null||wk==null)return '<div class="arc-led" id="arc-led"><p class="mut">Choose a food and a climb above to load the balance.</p></div>';
  const t=math.tilt(wk,fk),still=HWUI.reduced&&HWUI.reduced();
  return '<div class="arc-led" id="arc-led"><div class="arc-scale'+(still?' still':'')+'" role="img" aria-label="Balance: food '+Math.round(fk)+' kJ on the left, work '+fx(wk,1)+' kJ on the right; the beam rises '+fx(45-t,1)+' degrees on the work side">'
    +'<div class="scale-beam" style="--a:-'+(45-t).toFixed(1)+'deg"><div class="scale-pan" id="pan-food"><span class="arc-coins" aria-hidden="true">'+'<i></i>'.repeat(6)+'</span><b>'+Math.round(fk).toLocaleString('en')+' kJ</b><small>food</small></div><div class="scale-pan" id="pan-work"><span class="arc-feather" aria-hidden="true"></span><b>'+fx(wk,wk<10?2:1)+' kJ</b><small>work</small></div></div><i class="arc-post"></i></div>'
    +'<p class="num">tilt = (work ÷ food) × 45° = ('+fx(wk,2)+' ÷ '+fx(fk,0)+') × 45° = <b>'+fx(t,2)+'°</b> from the food side (45° would be level).</p>'
    +'<p>Behold the law of conservation of energy (and Hess’s law: the energy a food releases is the same whichever path the body takes). The chemical energy in a food is far larger than the mechanical work of a climb, because muscles are only about 20 to 25 % efficient and the body uses energy all day.</p>'
    +'<small class="mut">Not a trade: no number of stairs cancels a meal.</small></div>'}
const relLedger=()=>{const n=$i('arc-led');if(n)n.outerHTML=ledger()};
{const p=pages.alchemy;if(p)pages.alchemy=function(){const h=p.apply(this,arguments),k='<div id="al-sc">',i=h.indexOf(k);
  const L='<h4>'+ico('balance')+' THE CALORIC LEDGER</h4>'+ledger();return(i<0?h+L:h.slice(0,i)+L+h.slice(i))+forge()}}
{const f=INP.al;if(f)INP.al=function(){const r=f.apply(this,arguments);relLedger();return r}}
['alpm','alscale'].forEach(k=>{const f=acts[k];if(f)acts[k]=function(){const r=f.apply(this,arguments);relLedger();return r}});

/* =====================================================================================================================
   7. THE ROYAL SURVEYORS (Science Laboratory)
   ===================================================================================================================== */
const FLAGGED=['ST22','ST31','ST05'];          // the blueprint's list of staircases whose database angle needs a second survey
const SZ={sid:FLAGGED[0],r:'',t:''};
const srv=()=>{const o=S6().srv;return o&&typeof o==='object'?o:{}};
function survey(){
  const q=STAIRS.find(s=>s.id===SZ.sid),r=+SZ.r,t=+SZ.t,R=q&&SZ.r!==''&&SZ.t!==''?math.survey(r,t,q.angle):null,mine=srv()[SZ.sid];
  return '<div class="card arc-srv" id="royal-surveyors"><h3>'+ico('map')+' THE ROYAL SURVEYORS</h3>'
    +'<p>These staircases are flagged as doubtful: their database angle needs a second, independent measurement. Measure one step’s <b>riser</b> (height) and <b>tread</b> (depth) with a tape, then compare: θ = atan(riser ÷ tread).</p>'
    +'<label>Staircase<select data-ch="arcsid">'+FLAGGED.map(id=>{const s=STAIRS.find(x=>x.id===id);return s?'<option value="'+id+'"'+(id===SZ.sid?' selected':'')+'>'+id+' · '+esc(s.name)+' · '+s.angle.toFixed(2)+'°</option>':''}).join('')+'</select></label>'
    +'<div class="row"><label>Riser (cm)<input type="number" min="5" max="40" step="0.1" inputmode="decimal" data-in="arcsv" data-f="r" value="'+esc(SZ.r)+'"></label><label>Tread (cm)<input type="number" min="10" max="60" step="0.1" inputmode="decimal" data-in="arcsv" data-f="t" value="'+esc(SZ.t)+'"></label></div>'
    +'<div id="arc-svr" aria-live="polite">'+survRes(q,R)+'</div>'
    +(mine?'<small class="mut">Your saved survey of '+esc(SZ.sid)+' ('+esc(mine.d)+'): '+fx(mine.r,1)+' cm ÷ '+fx(mine.t,1)+' cm = '+fx(mine.a,2)+'°.</small>':'')
    +'<small class="mut">Your measurement is kept as yours; the database angle is not changed by it. A disagreement over 2° is worth reporting to the survey team.</small></div>'}
function tri(r,t,a){const k=Math.min(150/t,80/r),W=t*k,H=r*k,x0=30,y0=100,ar=Math.min(28,W*.5),A=Math.atan(r/t);
  return '<svg class="arc-tri" viewBox="0 0 200 120" role="img" aria-label="Step triangle: riser '+fv(r)+' cm, tread '+fv(t)+' cm, angle '+fx(a,2)+' degrees">'
    +'<path class="arc-tp" d="M'+x0+' '+y0+' h'+W.toFixed(1)+' v-'+H.toFixed(1)+' Z"/>'
    +'<path class="arc-ta" d="M'+(x0+ar)+' '+y0+' A'+ar+' '+ar+' 0 0 0 '+(x0+ar*Math.cos(A)).toFixed(1)+' '+(y0-ar*Math.sin(A)).toFixed(1)+'"/>'
    +'<text x="'+(x0+W/2)+'" y="'+(y0+14)+'" text-anchor="middle">tread '+fv(t)+'</text><text x="'+(x0+W-4)+'" y="'+(y0-H/2)+'" text-anchor="end">riser '+fv(r)+'</text>'
    +'<text class="arc-tav" x="'+(x0+ar+6)+'" y="'+(y0-5)+'">'+fx(a,1)+'°</text></svg>'}
function survRes(q,R){if(!q)return'';if(!R)return tri(17.95,31.8,math.angleOf(17.95,31.8)).replace('class="arc-tri"','class="arc-tri ghost"')+'<p class="mut">Type both measurements.</p>';
  return tri(+SZ.r,+SZ.t,R.a).replace('class="arc-tri"','class="arc-tri '+(R.ok?'ok':'off')+'"')+'<p class="num">atan('+fv(SZ.r)+' ÷ '+fv(SZ.t)+') = <b>'+fx(R.a,2)+'°</b>; database '+q.angle.toFixed(2)+'°; difference '+fx(R.diff,2)+'° '+(R.ok?stt('good')+' within 2°':stt('caution')+' over 2°')+'</p>'
    +'<button type="button" data-a="arcsvsave">'+(R.ok?'RECORD MY SURVEY (TRUTH-SEEKER)':'RECORD MY SURVEY')+'</button>'}
INP.arcsv=el=>{SZ[el.dataset.f]=el.value;const q=STAIRS.find(s=>s.id===SZ.sid),o=$i('arc-svr');if(o)o.innerHTML=survRes(q,q&&SZ.r!==''&&SZ.t!==''?math.survey(+SZ.r,+SZ.t,q.angle):null)};
CH.arcsid=v=>{if(FLAGGED.includes(v)){SZ.sid=v;SZ.r=SZ.t=''}const n=$i('royal-surveyors');if(n)n.outerHTML=survey()};
acts.arcsvsave=()=>{const q=STAIRS.find(s=>s.id===SZ.sid),R=q?math.survey(+SZ.r,+SZ.t,q.angle):null;if(!R)return;
  const o=srv();o[SZ.sid]={r:+SZ.r,t:+SZ.t,a:Math.round(R.a*100)/100,d:today(),ok:R.ok?1:0};S6().srv=o;save();
  toast(R.ok?'<b>Survey recorded.</b> It agrees with the database within 2°.':'<b>Survey recorded.</b> It disagrees by over 2°: worth a second look.');
  const n=$i('royal-surveyors');if(n)n.outerHTML=survey();if(typeof render==='function'&&R.ok)setTimeout(()=>{try{chkB()}catch(e){}},0)};
const truth=()=>Object.values(srv()).some(x=>x&&x.ok)?1:0;
BG.push(['\u{1F4D0}','Truth-Seeker','Re-survey a flagged staircase and agree with its angle within 2°',()=>[truth(),1]]);
if(typeof HWLab!=='undefined')HWLab.section('surv',{name:'Royal Surveyors',icon:'map',render:survey});

/* ---------- life cycle ---------- */
HWEvents.on('page:viewed',e=>{
  if(e.view==='home'){requestAnimationFrame(ball);dryCheck();if(S6().wx&&WX.st!=='busy'&&(!WX.w||Date.now()-WX.at>30*6e4))weather()}
  if(e.view==='exercise'&&gw().on&&!GW.rows&&GW.st!=='busy')guildSync()});
HWEvents.on('entry:added',e=>{const c=e&&e.entry&&e.entry.c;if(c==='water'||c==='stair')setTimeout(dryCheck,0)});

return{math,weather,myWeek,oracleIn,FLAGGED,BLOCKS,get wx(){return WX},get z(){return Z},stopMic,stopCam,_set:o=>{if(o.wx)WX=o.wx;if('rows'in o)GW.rows=o.rows}}})();
