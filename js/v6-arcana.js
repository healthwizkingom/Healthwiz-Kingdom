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
const sessions=()=>typeof HWStairs!=='undefined'?HWStairs.all():[];
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
    WX={st:'ok',w:{temp:+c.temperature_2m,rh:+c.relative_humidity_2m,time:String(c.time||'')},at:Date.now(),err:''}}
  catch(e){WX={st:'err',w:null,at:0,err:'The weather service did not answer ('+(e&&e.name==='AbortError'?'timed out':String(e&&e.message||e))+').'};oops('The weather could not be read. Try again later.')}
  const n=$i('arc-elem');if(n)n.outerHTML=elemCard();return WX}
function potion(){
  const d=today(),w=wt(d),t=+st.s.water||0,p=math.potionPct(w,t),full=p>=100;
  return '<div class="arc-pot'+(full?' full':'')+'"><div class="potion-bottle" role="progressbar" aria-label="Water today" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(p)
    +'" aria-valuetext="'+w+' of '+t+' mL, '+Math.round(p)+' percent"><i class="cork"></i><div class="liquid-fill" style="height:'+p.toFixed(1)+'%"></div></div>'
    +'<div><b class="num">'+w.toLocaleString('en')+'</b> <small>of '+t.toLocaleString('en')+' mL</small><span class="arc-st">'+(full?stt('good')+' Potion brewed':p>=50?stt('watch')+' Half full':stt('caution')+' Under half')+'</span>'
    +'<small class="mut">Logged water toward your own goal (calculated).</small></div></div>'}
function elemCard(){
  const burn=typeof HWScore!=='undefined'?Math.round(HWScore.burnOf(today())):0,w=WX.w,hot=math.heatStress(w);
  let wx;
  if(!S6().wx)wx='<p class="mut">Read the sky over Kolej MARA Kulim (5.36° N, 100.56° E) from Open-Meteo? It sends only the college’s fixed position, never yours.</p><button type="button" class="g" data-a="arcwx">READ THE SKY</button>';
  else if(WX.st==='busy')wx='<p class="mut" role="status">Reading the sky…</p>';
  else if(!w)wx='<p class="mut" role="status">'+esc(WX.err||'No weather reading yet.')+'</p><button type="button" class="g" data-a="arcwx">TRY AGAIN</button>';
  else wx='<div class="arc-thermo'+(hot?' hot':'')+'"><div class="therm" aria-hidden="true"><i style="height:'+clamp((w.temp-15)/25*100,4,100).toFixed(0)+'%"></i></div><div><b class="num">'+fx(w.temp,1)+' °C</b> · <b class="num">'+Math.round(w.rh)+' %</b> <small>humidity</small>'
    +'<small class="mut">Measured by Open-Meteo’s model for the campus area'+(w.time?', '+esc(w.time.replace('T',' ')):'')+'.</small>'
    +(hot?'<p class="arc-warn" role="note">'+stt('caution')+' The sun is fierce! Your body uses extra energy to cool down.</p>':'<p>'+stt('good')+' Not in the hot and humid band (over 32 °C and over 70 %).</p>')
    +(burn>0?'<p>Estimated burn today: <b class="num">'+burn+' kcal</b>'+(hot?' → <b class="num">'+Math.round(math.heatAdjust(burn,w))+' kcal</b> with HealthWiz’s assumed +5 % for heat (an illustration, not measured).':'.')+'</p>':hot?'<p class="mut">No calorie-burn estimate today, so the assumed +5 % for heat has nothing to adjust.</p>':'')+'</div></div>';
  return '<div class="card arc-elem" id="arc-elem"><h3>'+ico('water')+' ELEMENTAL THERMOMETER</h3><div class="arc-elg">'+potion()+'<div>'+wx+'</div></div></div>'}
acts.arcwx=()=>{S6().wx=1;save();weather(true)};
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
  if(miss.length)body='<p class="mut">The crystal stays cloudy until it has: '+miss.map(esc).join('; ')+'.</p>';
  else{const R=math.readiness(I.sleep,I.dass,I.drop),sc=Math.round(R.score),k=sc>=70?'good':sc>=50?'watch':'caution';
    body='<p><b class="num big">'+sc+'</b> <small>/ 100 readiness index</small> '+stt(k)+'</p>'
      +'<ul class="arc-orl"><li>Sleep '+fx(I.sleep,1)+' h → '+Math.round(R.sleep)+' × 0.4</li><li>DASS-21 total '+I.dass+' / 63 → '+Math.round(R.stress)+' × 0.3</li><li>1-minute recovery '+I.drop+' BPM → '+Math.round(clamp(R.rec,0,100))+' × 0.3</li></ul>'
      +(sc<50?'<p class="arc-warn" role="note">Medius: “Your sleep, stress check-in and heart-rate recovery are all pulling the crystal down. A vigorous climb can wait. The Oracle suggests a mild path (below 26°) today.”</p>':'')
      +'<small class="mut">Calculated from your own logs with the blueprint’s weights (40 / 30 / 30). It is a game index, not a medical measure of readiness.</small>';
    if(sc<50)setTimeout(()=>say('arc-oracle'),0)}
  return '<div class="card arc-orc" id="arc-oracle"><h3>'+ico('chart')+' THE ORACLE’S CRYSTAL BALL</h3><div class="arc-org"><canvas class="arc-ball" id="arc-ball" width="96" height="96" role="img" aria-label="'
    +(miss.length?'A cloudy crystal ball: not enough data':'A crystal ball glowing with the readiness index')+'"></canvas><div>'+body+'</div></div></div>'}
let ballRaf=0;
function ball(){
  cancelAnimationFrame(ballRaf);const c=$i('arc-ball');if(!c||!c.getContext)return;const x=c.getContext('2d');if(!x)return;
  const I=oracleIn(),ok=I.sleep!=null&&I.dass!=null&&I.drop!=null,sc=ok?math.readiness(I.sleep,I.dass,I.drop).score:0;
  const col=!ok?[150,150,170]:sc>=70?[79,224,200]:sc>=50?[255,216,107]:[255,122,138],still=HWUI.reduced&&HWUI.reduced();
  const draw=t=>{if(!c.isConnected)return;x.clearRect(0,0,96,96);const pu=still?0:Math.sin(t/700)*.08;
    const g=x.createRadialGradient(40,38,4,48,48,44);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.35,'rgba('+col+','+(0.85+pu)+')');g.addColorStop(1,'rgba(20,16,48,.9)');
    x.fillStyle=g;x.beginPath();x.arc(48,46,38,0,Math.PI*2);x.fill();
    if(ok&&!still)for(let i=0;i<6;i++){const a=t/900+i*1.05,r=18+8*Math.sin(t/500+i);x.fillStyle='rgba(255,255,255,.7)';x.fillRect(Math.round(48+Math.cos(a)*r),Math.round(46+Math.sin(a)*r),2,2)}
    x.fillStyle='#3a2a5a';x.fillRect(26,84,44,8);x.fillStyle='#d9b45a';x.fillRect(30,82,36,3);
    if(!still)ballRaf=requestAnimationFrame(draw)};
  draw(performance.now())}

{const p=pages.home;pages.home=function(){const h=p.apply(this,arguments),c=elemCard()+oracle(),k='<div class="card hmq" id="hmq">',i=h.indexOf(k);
  return i<0?h+c:h.slice(0,i)+c+h.slice(i)}}

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
    +rows.map(r=>'<tr'+(r.top?' class="guild-banner-top"':'')+'><th scope="row">'+(r.top?'<span class="arc-crown" aria-hidden="true"></span>':'')+esc(r.blk)+(r.top?' <span class="pxtag">TOP</span>':'')+(r.n>1?' <small class="mut">'+r.n+' players</small>':'')+'</th><td>'+Math.round(r.W).toLocaleString('en')+'</td><td>'+Math.round(r.E).toLocaleString('en')+'</td></tr>').join('')+'</tbody></table></div>'
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
const Z={sid:null,P:'',pace:{on:0,t0:0,y:0},mic:null,peaks:[],cad:null,breath:null,match:0};
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
      if(r>.1&&!up&&(!Z.peaks.length||t-Z.peaks[Z.peaks.length-1]>=150)){up=1;Z.peaks.push(t);if(Z.peaks.length>9)Z.peaks.shift();Z.cad=math.cadence(Z.peaks);out()}else if(r<.05)up=0;
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
function out(){const o=$i('arc-cad');if(!o)return;const c=Z.cad,gr=pacer();
  o.textContent=c?'Frequency: '+fx(c.f,2)+' Hz | Angular: '+fx(c.w,2)+' rad/s':Z.mic&&Z.mic.kind==='echo'?'Listening… climb, and each footstep louder than the threshold is counted.':'Not listening.';
  const m=!!(c&&gr&&Math.abs(c.f-gr)/gr<=.1);if(m!==!!Z.match){Z.match=m;const t=$i('arc-tower');if(t)t.classList.toggle('arc-rune',m)}}
function pacer(){const mi=massInfo(),r=riseOf(Z.sid);return r&&mi?math.pacerRate(+Z.P,mi.kg,r):null}
let pRaf=0;
function pace(){cancelAnimationFrame(pRaf);const g=$i('ghost-pacer'),q=STAIRS.find(s=>s.id===Z.sid);if(!g||!q)return;const n=stepsOf(q),rate=pacer();
  if(!Z.pace.on||!rate){g.style.setProperty('--y','0');return}
  const still=HWUI.reduced&&HWUI.reduced(),tick=t=>{if(!g.isConnected||!Z.pace.on)return;const s=((t-Z.pace.t0)/1000*rate)%n;g.style.setProperty('--y',(s/n).toFixed(4));
    const lb=$i('arc-pst');if(lb)lb.textContent='Ghost on step '+(Math.floor(s)+1)+' of '+n;if(!still)pRaf=requestAnimationFrame(tick)};
  Z.pace.t0=performance.now();tick(Z.pace.t0)}
const allSteps=q=>Array.isArray(q.steps)?q.steps.reduce((a,b)=>a+(+b||0),0):0;                 // every flight (js/v6-stairs-data.js)
const stepsOf=q=>clamp(Math.round(Array.isArray(q.steps)&&+q.steps[0]>0?+q.steps[0]:12),4,30);  // the tower draws one flight
function chamber(id){
  const q=STAIRS.find(s=>s.id===id);if(!q)return'';if(Z.sid!==id){stopMic();Z.sid=id;Z.pace.on=0;Z.cad=null;Z.peaks=[];Z.match=0;Z.P=''}
  const n=stepsOf(q),r=riseOf(id),mi=massInfo(),rate=pacer(),tilt=math.towerTilt(q.angle);
  const best=sessions().map(s=>{const e=st.e.find(x=>x.id===s.id),g=e&&e.m&&e.m.gv;return g&&+g.P>0?+g.P:0}).reduce((a,b)=>Math.max(a,b),0);
  const steps=Array.from({length:n},(_,i)=>'<i style="--i:'+i+'"></i>').join('');
  return '<section class="arc-ch" id="stair-sense-modal" aria-labelledby="arc-ch-t"><h3 id="arc-ch-t">'+ico('stairs')+' THE ENCHANTED TOWER · '+esc(q.id)+'</h3>'
    +'<div class="arc-tg"><div class="arc-tower'+(Z.match?' arc-rune':'')+'" id="arc-tower" role="img" aria-label="'+esc(q.id)+' drawn at '+q.angle.toFixed(2)+' degrees, '+n+' steps"><div class="arc-flight" style="transform:rotateX('+tilt.toFixed(2)+'deg)">'+steps
    +'<div id="ghost-pacer" class="ghost-pacer" aria-hidden="true"></div></div></div>'
    +'<div><p>Angle <b class="num">'+q.angle.toFixed(2)+'°</b> → rotateX(90° − '+q.angle.toFixed(2)+'°) = <b class="num">'+tilt.toFixed(2)+'°</b>. '+(Array.isArray(q.steps)&&q.steps.length?'First flight: '+n+' steps'+(+q.steps[0]>30?' (30 drawn)':''):'Step count not surveyed: '+n+' steps drawn as a picture only')+'.</p>'
    +'<label>Target power for the Spectral Pacer (W)<input type="number" min="10" max="1500" step="1" inputmode="numeric" data-in="arcp" id="arc-p" value="'+esc(Z.P)+'" placeholder="'+(best?'your best: '+Math.round(best):'e.g. 120')+'"></label>'
    +(r&&mi?'<small class="mut">Rate = P ÷ (m g r) = '+(rate?fx(rate,2)+' steps/s':'type a power')+' with '+fx(mi.kg,1)+' kg and a '+fx(r*100,1)+' cm rise.</small>':'<small class="mut">The pacer needs '+(mi?'':'your weight'+(r?'':' and ')+'')+(r?'':'a known step rise for this stairway')+'.</small>')
    +'<div class="row arc-row"><button type="button" data-a="arcpace" '+(rate?'':'disabled ')+'aria-pressed="'+(Z.pace.on?'true':'false')+'">'+(Z.pace.on?'STOP THE GHOST':'SUMMON THE GHOST')+'</button></div><small class="mut" id="arc-pst" aria-live="polite"></small></div></div>'
    +'<h4>'+ico('energy')+' CADENCE ECHO</h4><p class="mut">The microphone hears footsteps: each rise in loudness (RMS over 0.1) is one step. f = 1 ÷ the mean time between steps; ω = 2πf. Nothing is recorded or sent.</p>'
    +'<div class="row arc-row"><button type="button" data-a="arcecho" aria-pressed="'+(Z.mic&&Z.mic.kind==='echo'?'true':'false')+'">'+(Z.mic&&Z.mic.kind==='echo'?'STOP LISTENING':'LISTEN FOR FOOTSTEPS')+'</button></div>'
    +'<p class="num arc-cad" id="arc-cad" aria-live="polite"></p><small class="mut">When your step frequency is within 10 % of the ghost’s, the tower’s runes glow (and the words above say so).</small>'
    +'<h4>'+ico('heart')+' LUNA’S WIND SPELL (TALK TEST)</h4><p class="mut">After the climb, breathe near the phone for 5 seconds.</p>'
    +'<div class="row arc-row"><button type="button" id="luna-breathalyzer" data-a="arcbreath" '+(Z.mic&&Z.mic.kind==='breath'?'disabled':'')+'>'+(Z.mic&&Z.mic.kind==='breath'?'LISTENING FOR 5 SECONDS…':'CAST THE WIND SPELL')+'</button></div>'+breathTxt()
    +gravityCard(q)+'</section>'}
function breathTxt(){const b=breathOn();if(!b)return'';
  return '<p class="arc-warn" role="status">'+(b.loud?stt('watch')+' Luna’s Wind Spell hears heavy breathing (loudness '+fx(b.rms,2)+'). The Metabolic Forge now uses the RER 1.0 value for the next 10 minutes.':stt('good')+' Calm breathing (loudness '+fx(b.rms,2)+'). The forge keeps the value from your meal.')+'</p>'
    +'<small class="mut">Loudness is a rough cue, not a gas measurement: the microphone cannot see which fuel your muscles use. Hard breathing does go with harder efforts.</small>'}
function paint(){const s=$i('stair-sense-modal');if(s&&Z.sid){s.outerHTML=chamber(Z.sid);out();pace()}}
INP.arcp=el=>{Z.P=el.value;const v=+el.value;if(Z.pace.on&&!(v>0))Z.pace.on=0;const b=D.querySelector('[data-a="arcpace"]'),r=pacer();if(b)b.disabled=!r;pace()};
acts.arcpace=()=>{Z.pace.on=Z.pace.on?0:1;paint()};
acts.arcecho=()=>echo();acts.arcbreath=()=>breathe();

/* 6. gravity at the campus */
const ALT=50;
function gravityCard(q){
  const mi=massInfo(),h=(()=>{const r=riseOf(q.id),n=allSteps(q);return r&&n?r*n:null})();
  const g0=math.gravity(KMK.lat,0),gB=math.gravity(KMK.lat,ALT),gT=math.gravity(KMK.lat,ALT+(h||0));
  const sea=mi?mi.kg:null,top=mi?math.scaleRead(mi.kg,g0,gT):null;
  return '<h4>'+ico('balance')+' THE GRAVITY ANOMALY</h4>'
    +'<p>g = 9.780327 (1 + 0.0053024 sin²φ − 0.0000058 sin² 2φ) − 3.086×10⁻⁶ h, at φ = 5.36°:</p>'
    +'<ul class="arc-orl num"><li>sea level: '+fx(g0,6)+' m/s²</li><li>campus (about '+ALT+' m, assumed): '+fx(gB,6)+' m/s²</li>'+(h?'<li>top of '+esc(q.id)+' (+'+fx(h,2)+' m): '+fx(gT,6)+' m/s²</li>':'')+'</ul>'
    +(mi?'<p class="arc-cmp num" title="Gravity is slightly weaker up here!"><span>Scale reading at sea level: <b>'+fx(sea,3)+' kg</b></span><span>Same scale at the stair top: <b>'+fx(top,3)+' kg</b></span></p>'
      +'<small class="mut">Gravity is slightly weaker up here! Your mass does not change; a spring scale set at sea level reads '+fx((1-gT/g0)*1e6,1)+' parts per million less, because it measures your weight m g. ('+esc(mi.src)+'.)</small>'
      :'<small class="mut">Add your weight to see what a scale would read.</small>')}
if(typeof HWStairs!=='undefined'){const p=HWStairs.logPanel;HWStairs.logPanel=function(id){const h=p.apply(this,arguments);try{return id?h+chamber(id):h}catch(e){console.warn('[HWArcana]',e);return h}}}
HWEvents.on('page:viewed',e=>{if(e.view!=='campus'){stopMic();Z.pace.on=0}});
D.addEventListener('visibilitychange',()=>{if(D.hidden)stopMic()});

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
  return '<div class="card arc-forge" id="arc-forge"><h3>'+ico('energy')+' THE METABOLIC FORGE</h3><p class="mut">Each litre of oxygen releases more energy when the body burns carbohydrate (21.1 kJ, RER 1.0) than fat (19.6 kJ, RER 0.7); a mixed diet is about 20.1 kJ.</p>'
    +body+'<small class="mut">Estimated: the fuel mix is assumed from your last logged meal (carbohydrate ≥ 60 % of its energy = high-carb, ≤ 25 % = low-carb), not measured. The difference is a few percent.</small></div>'}
function ledger(){
  let f=null,c=null;try{f=HWAlchemy.food();c=HWAlchemy.climb()}catch(e){}
  const fk=f&&f.ok?f.kJ:null,wk=c&&c.W!=null?c.W/1000:null;
  if(fk==null||wk==null)return '<div class="arc-led" id="arc-led"><p class="mut">Choose a food and a climb above to load the balance.</p></div>';
  const t=math.tilt(wk,fk),still=HWUI.reduced&&HWUI.reduced();
  return '<div class="arc-led" id="arc-led"><div class="arc-scale'+(still?' still':'')+'" role="img" aria-label="Balance: food '+Math.round(fk)+' kJ on the left, work '+fx(wk,1)+' kJ on the right; the beam rises '+fx(45-t,1)+' degrees on the work side">'
    +'<div class="scale-beam" style="--a:-'+(45-t).toFixed(1)+'deg"><div class="scale-pan" id="pan-food"><b>'+Math.round(fk).toLocaleString('en')+' kJ</b><small>food</small></div><div class="scale-pan" id="pan-work"><b>'+fx(wk,wk<10?2:1)+' kJ</b><small>work</small></div></div><i class="arc-post"></i></div>'
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
function survRes(q,R){if(!q)return'';if(!R)return '<p class="mut">Type both measurements.</p>';
  return '<p class="num">atan('+fx(+SZ.r,1)+' ÷ '+fx(+SZ.t,1)+') = <b>'+fx(R.a,2)+'°</b>; database '+q.angle.toFixed(2)+'°; difference '+fx(R.diff,2)+'° '+(R.ok?stt('good')+' within 2°':stt('caution')+' over 2°')+'</p>'
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

return{math,weather,myWeek,oracleIn,FLAGGED,BLOCKS,get wx(){return WX},get z(){return Z},stopMic,_set:o=>{if(o.wx)WX=o.wx;if('rows'in o)GW.rows=o.rows}}})();
