/* v6: Stair Sense, the Gravity Trial. A card on the Stairs page. Not part of the original.
   START CLIMB / PAUSE / FINISH time a climb, estimate steps and cadence from the phone's motion sensor, and turn the result
   into estimated physical quantities with the physics the Stairs page already teaches (rise ÷ run, js/v6-stairs.js STUDY):

     h = n × r        vertical height climbed (m)        n = steps climbed (the user confirms it), r = rise of one step (m)
     W = m × g × h    work done against gravity (J)      m = body mass (kg), g = 9.80665 m/s² (standard gravity)
     P = W ÷ t        average power (W = J/s)            t = elapsed time with the timer running (s); rests inside it lower P
     E = W ÷ 1000     the same work in kJ (SI throughout)

   Mechanical work against gravity only. It is NOT the energy the body uses (the body is far less than 100% efficient at this);
   js/v6-alchemy.js explains the difference and the kcal conversion.

   Data used, never invented
     staircase  one of the STAIRS (js/hw-02-core.js). The rise of a step is known only for the three stairways measured in the Group 14
                study (HWStairs.STUDY: ST14, ST19, ST20). Any other stairway has an angle but no step height, so the user types the
                height of a step (cm) or the height result stays unavailable.
     mass       the latest weight in the user's BMI logs (entry.m.w), else the confirmed profile weight (HWStairs.profile()); the user can
                correct it for this session. No weight: it is asked for, and work and power stay unavailable.
     duration   the timer, editable in the review.

   Sensor method: DeviceMotionEvent.accelerationIncludingGravity. The magnitude |a| = √(x²+y²+z²) does not depend on how the phone is held.
   A slow moving average (τ = 0.5 s) is taken as gravity + drift and subtracted; the remainder is lightly smoothed (τ = 0.06 s) and a
   step is counted when it rises above TH (1.1 m/s²) at least 300 ms after the last one (so at most 200 steps/min), and must fall below
   0.45 × TH before the next. Cadence = 60 000 ÷ the mean of the last 8 step gaps (steps/min), shown after 5 steps.
   It is a peak counter: carrying style, a swinging arm, texting, a bag, going down, and flat walking all change the count, so the
   number is only ever an estimate and the user reviews and corrects it before anything is saved.
   iOS asks permission (DeviceMotionEvent.requestPermission) from the START tap; a refusal, no sensor or no readings leaves the timer
   and manual entry. The listener is attached only while a climb is running: PAUSE, FINISH, cancelling, leaving the page and hiding the
   tab all remove it. Nothing leaves the device.

   Saving (only from the review, only on the user's tap): one normal 'stair' entry through HWStairs.record() with kind:'workout',
   steps = the confirmed count, climbs 1, dur in minutes, and m.gv = {gid, method, sensor, n, rise, riseSrc, mass, massSrc, secs, h, W, P}.
   gid is made at START; a gid already in the log is refused, and the button is disabled after a save, so a double tap or a retry
   cannot create a second record. A session that matches one already logged today at the same stairway with the same steps asks first.
   Existing entries are never edited. Users who told HealthWiz about a condition that needs a doctor's OK before stairs
   (HWCond.stairsHidden) must tick that they have it before START is enabled. */
const HWGravity=(()=>{
const G0=9.80665;
const ico=n=>HWPixel.icon(n,1);
const $i=i=>document.getElementById(i);
const clk=s=>{s=Math.max(0,Math.floor(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const f1=(x,d)=>(+x).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});

/* ---------- step counter (pure: tests feed it samples with their own clock) ---------- */
function counter(o){
  o=Object.assign({tau:.5,smooth:.06,th:1.1,rearm:.45,gap:300},o);
  let base=null,sm=0,armed=true,last=-1e9,t0=0,n=0;const gaps=[];
  return{push(t,x,y,z){
      const m=Math.sqrt(x*x+y*y+z*z);if(!isFinite(m))return n;
      if(base==null){base=m;t0=t;return n}
      const dt=Math.max(1,Math.min(200,t-t0))/1000;t0=t;
      base+=(m-base)*(1-Math.exp(-dt/o.tau));
      sm+=(m-base-sm)*(1-Math.exp(-dt/o.smooth));
      if(armed&&sm>o.th&&t-last>=o.gap){if(last>0)gaps.push(t-last);last=t;n++;armed=false}
      else if(!armed&&sm<o.th*o.rearm)armed=true;
      return n},
    get steps(){return n},
    /** steps per minute from the last 8 gaps (each under 1.5 s, so a rest is not averaged in); null before 5 steps */
    get cadence(){const g=gaps.slice(-8).filter(x=>x<1500);return n>=5&&g.length>=4?60000/(g.reduce((a,b)=>a+b,0)/g.length):null}}}

/* ---------- the physics (pure) ---------- */
/** n steps of rise r (m), body mass m (kg), time t (s) → h (m), W (J), P (W), kJ. A quantity is null when an input is missing or out of range. */
function physics(n,r,m,t){
  const okN=Number.isInteger(n)&&n>=1&&n<=1000,okR=r>=.05&&r<=.3,okM=m>=20&&m<=300,okT=t>=10&&t<=86400;
  const h=okN&&okR?n*r:null,W=h!=null&&okM?m*G0*h:null,P=W!=null&&okT?W/t:null;
  return{h,W,P,kJ:W==null?null:W/1000,okN,okR,okM,okT}}

/* ---------- where the numbers come from ---------- */
/* Step height (rise) of a stairway, in metres.
   measured  the three Group 14 stairways have a measured rise (HWStairs.STUDY).
   angle     every other stairway has only its angle θ (STAIRS), and tan θ = rise ÷ run, so rise = run × tan θ. The run (tread depth) is not
             stored, so it is taken as the mean of the three measured treads (0.305 m). That is an ESTIMATE, labelled as one; the user can
             replace it with a measured value. If the result is outside 5–30 cm (the steepest stairways, 59–66°, would give over 50 cm: their
             treads are evidently not like the study's), no height is guessed and the user is asked.
   Both the Gravity Trial and the Energy Workshop use this, so one stairway always has the same height. */
const RUN_EST=HWStairs.STUDY.reduce((a,r)=>a+r.run,0)/HWStairs.STUDY.length;
const measuredRise=id=>{const r=HWStairs.STUDY.find(x=>x.id===id);return r?r.rise:null};
const angleRise=id=>{const s=STAIRS.find(x=>x.id===id);if(!s)return null;const r=RUN_EST*Math.tan(s.angle*Math.PI/180);return r>=.05&&r<=.3?r:null};
const riseKind=id=>measuredRise(id)!=null?'study':angleRise(id)!=null?'angle':null;
const verifiedRise=id=>riseKind(id)==='study'?measuredRise(id):riseKind(id)==='angle'?angleRise(id):null;
function massInfo(){
  const b=LC('bmi').filter(e=>e.m&&+e.m.w>=20&&+e.m.w<=300).pop();
  if(b)return{kg:+b.m.w,src:'your weight record of '+b.d};
  const p=HWStairs.profile();return p?{kg:p.w,src:'your profile weight'}:null}
const stairOf=id=>STAIRS.find(s=>s.id===id)||null;
const checkin=()=>{const e=LC('stair').filter(x=>x.d===today()&&x.m&&(x.m.src==='gps'||x.m.chk==='gps')&&stairOf(x.m.sid)).pop();return e?stairOf(e.m.sid):null};

/* ---------- session state (memory only until the user saves) ---------- */
const TG={c:'LOG A CLIMB BY HAND',w:'SEAL THE WORKOUT',g:'GPS CHECK-IN'};   // where a STAIR SENSE button was pressed
const fresh=()=>({target:'',ph:'idle',busy:0,gid:'',sid:'',sensor:'off',est:0,got:0,acc:0,since:0,ctr:null,cadence:null,ack:0,cancel:0,dup:0,
  inp:{steps:'',rise:'',mass:'',min:'',climbs:'1'},ed:{rise:0,mass:0},saved:null});
let G=fresh(),tick=0,listening=false,chk=0;
const activeMs=()=>G.acc+(G.ph==='running'?Date.now()-G.since:0);
const gated=()=>typeof HWCond!=='undefined'&&HWCond.stairsHidden()&&!(st.qa&&st.qa.show),locked=()=>gated()&&!G.ack;

function onMotion(e){
  if(G.ph!=='running')return;const a=e&&e.accelerationIncludingGravity;
  if(!a||a.x==null||a.y==null||a.z==null)return;
  G.got++;G.est=G.ctr.push(performance.now(),+a.x,+a.y,+a.z);G.cadence=G.ctr.cadence}
function attach(){if(!listening&&G.sensor==='on'){addEventListener('devicemotion',onMotion);listening=true}}
function detach(){if(listening){removeEventListener('devicemotion',onMotion);listening=false}clearTimeout(chk)}
function ticker(on){clearInterval(tick);tick=0;if(on)tick=setInterval(live,500)}

/* ---------- pieces ---------- */
function help(){return HWHelp.btn('gvhelp','Stair Sense: how it works and what it cannot tell you',
  '<p><b>These are estimates.</b> Your phone’s motion sensor feels the phone shake as you walk. A program counts the peaks and guesses steps and cadence. A phone does not measure work or power.</p>'
  +'<p>Work and power come from a formula, not from the sensor: <b>W = m × g × h</b> and <b>P = W ÷ t</b>, using your body mass, the height of the steps and the time. If the step height or your mass is missing, the result is marked unavailable instead of guessed.</p>'
  +'<p><b>What can go wrong:</b> carrying the phone in a swinging hand or a bag, texting, walking flat or going down the stairs can add or hide steps. Count the steps of one climb yourself and correct the number before you save.</p>'
  +'<p><b>Safety:</b> hold the handrail, look where you step and climb at a pace that is comfortable for you. Stop if you feel dizzy, faint or have chest pain. This is not a challenge or a race: slower is fine, and a lower power is not worse. It is not a medical measurement.</p>'
  +'<p>The sensor only runs while a climb is running. Pausing, finishing, cancelling or leaving the page turns it off, and nothing is sent anywhere.</p>'
  +(typeof HWSources!=='undefined'?'<b class="hwx-h">SOURCES</b><ul class="hwx-src">'+['nistg','nistcal'].map(HWSources.cite).join('')+'</ul>':''),{label:'About Stair Sense',ev:'gravity'})}
function stairSelect(){
  const cur=G.sid||(HWStairs.pick&&stairOf(HWStairs.pick)?HWStairs.pick:'');
  if(!G.sid&&cur)G.sid=cur;
  return '<label for="gv-sid">Staircase</label><select id="gv-sid" data-in="gv" data-f="sid"><option value="">Choose a staircase…</option>'
    +CATS.map(c=>'<optgroup label="'+c[1]+'">'+stairsOf(c[1]).map(s=>'<option value="'+s.id+'"'+(s.id===G.sid?' selected':'')+'>'+esc(s.name)+(riseKind(s.id)==='study'?' · step height measured':riseKind(s.id)==='angle'?' · step height from angle':'')+'</option>').join('')+'</optgroup>').join('')+'</select>'}
function meter(){const k=(G.est%20)/20*100;return '<div class="gvm" id="gv-meter" role="img" aria-label="Ascent meter: decorative, it fills as steps are counted and starts again every 20 steps"><span class="gvml">ASCENT METER</span>'+bar(k,'var(--vio)')+'</div>'}
function sensTxt(){
  if(G.sensor==='unsupported')return 'This browser has no motion sensor. The timer works; count your steps and type them in at the end.';
  if(G.sensor==='denied')return 'Motion access was not allowed, so no steps are counted by the phone. The timer works; count your steps and type them in at the end.';
  if(G.sensor==='none')return 'No motion readings are arriving. Put the phone in a hand or pocket, or count your steps and type them in at the end.';
  if(G.sensor==='on')return 'Counting steps from the phone’s motion sensor. This is an estimate: you will check it before saving.';
  return 'Timer only. Count your steps and type them in at the end.'}
function live(){
  if(G.ph!=='running'){ticker(0);return}
  const t=$i('gv-time'),s=$i('gv-steps'),c=$i('gv-cad'),m=$i('gv-meter'),n=$i('gv-sens');
  if(t)t.textContent=clk(activeMs()/1000);
  if(s)s.textContent=G.sensor==='on'?G.est:'–';
  if(c)c.textContent=G.sensor==='on'&&G.cadence?Math.round(G.cadence):'–';
  if(m){const b=m.querySelector('.bar i');if(b)b.style.width=(G.sensor==='on'?(G.est%20)/20*100:0)+'%'}
  if(n&&n.textContent!==sensTxt())n.textContent=sensTxt()}
const stat=(id,v,u,l)=>'<div class="ststat gvst"><span class="stsv"><b id="'+id+'">'+v+'</b> <small>'+u+'</small></span><span class="stsl">'+l+'</span></div>';
function idle(){
  const ci=checkin(),q=stairOf(G.sid);
  return (G.target?'<p class="gvfrom" role="status"><b>Started from '+TG[G.target]+'.</b> When you finish, the steps'+(G.target==='w'?' and the time':'')+' are filled in there for you. <button type="button" class="g sm" data-a="gvuntarget">NOT FOR THAT FORM</button></p>':'')+'<p class="mut">Carry your phone while you climb. Stair Sense times the climb, estimates the steps, and at the end works out the height, the work against gravity and the average power. You check every number before anything is saved.</p>'
    +stairSelect()+(ci&&ci.id!==G.sid?'<button type="button" class="g sm gvci" data-a="gvci" data-id="'+ci.id+'">USE TODAY’S CHECK-IN: '+esc(ci.name)+'</button>':'')
    +(q?'<p class="mut gvq">'+esc(q.name)+' · '+esc(q.floor)+' · step height '+(riseKind(q.id)==='study'?'<b>'+f1(verifiedRise(q.id)*100,1)+' cm</b>, measured (Group 14 study)':riseKind(q.id)==='angle'?'<b>\u2248 '+f1(verifiedRise(q.id)*100,1)+' cm</b>, estimated from its angle ('+f1(q.angle,1)+'\u00b0)':'<b>not available</b> for this very steep stairway: you can type it at the end')+'</p>':'')
    +(gated()?'<label class="gvack"><input type="checkbox" id="gv-ack" data-in="gv" data-f="ack"'+(G.ack?' checked':'')+'> I have checked with my doctor that I can use stairs.</label><small class="mut">You told HealthWiz about something that needs a doctor’s OK first.</small>':'')
    +'<small class="mut gvph"><b>Phone placement:</b> in a hand or a trouser pocket, screen toward you. Do not swing it or type on it.</small>'
    +'<button type="button" class="gvgo" data-a="gvstart"'+(locked()||G.busy?' disabled':'')+'>START CLIMB</button>'
    +'<p class="warn gvsafe" role="note">Use the handrail and climb at a comfortable pace. Stop if you feel dizzy, faint or have chest pain. This is not a race.</p>'}
function running(){
  const p=G.ph==='paused';
  return '<div class="gvhud" role="group" aria-label="Climb in progress">'+stat('gv-time',clk(activeMs()/1000),'min:s','Elapsed')+stat('gv-steps',G.sensor==='on'?G.est:'–','steps','Estimated steps')+stat('gv-cad',G.sensor==='on'&&G.cadence?Math.round(G.cadence):'–','steps/min','Cadence (estimate)')+'</div>'
    +meter()+'<p class="mut" id="gv-sens" role="status">'+esc(sensTxt())+'</p>'
    +(p?'<p class="gvpaused" role="status">Paused. The sensor is off.</p>':'')
    +'<div class="gvbtns">'+(p?'<button type="button" data-a="gvresume">RESUME</button>':'<button type="button" class="g" data-a="gvpause">PAUSE</button>')+'<button type="button" class="gvfin" data-a="gvfinish">FINISH</button></div>'
    +'<button type="button" class="g sm gvx" data-a="gvcancel">'+(G.cancel?'TAP AGAIN TO DISCARD THIS CLIMB':'CANCEL')+'</button>'}
const lbl=(id,t,x)=>'<label for="'+id+'">'+t+'</label>'+x;
function review(){
  const q=stairOf(G.sid),mi=massInfo(),vr=q?verifiedRise(q.id):null;
  return '<h4>REVIEW YOUR CLIMB</h4><p class="mut">Check and correct each number. Nothing is saved until you press SAVE.</p>'
    +stairSelect()
    +lbl('gv-n','Steps climbed (up only)','<input id="gv-n" data-in="gv" data-f="steps" type="number" min="1" max="1000" inputmode="numeric" value="'+esc(G.inp.steps)+'">')
    +'<small class="mut" id="gv-nn">'+(G.sensor==='on'&&G.est?'The sensor estimated '+G.est+' steps. Change it if you counted differently.':'Count the steps of one climb and multiply by the number of climbs.')+'</small>'
    +(G.target?lbl('gv-k','Number of climbs','<input id="gv-k" data-in="gv" data-f="climbs" type="number" min="1" max="500" inputmode="numeric" value="'+esc(G.inp.climbs)+'">')+'<small class="mut" id="gv-kn">'+kNote()+'</small>':'')
    +lbl('gv-m','Time (minutes)','<input id="gv-m" data-in="gv" data-f="min" type="number" min="0.2" max="1440" step="0.05" inputmode="decimal" value="'+esc(G.inp.min)+'">')
    +'<small class="mut">From the timer, '+clk(G.acc/1000)+' (rests while the timer ran are included).</small>'
    +lbl('gv-r','Height of one step (cm)','<input id="gv-r" data-in="gv" data-f="rise" type="number" min="5" max="30" step="0.1" inputmode="decimal" placeholder="e.g. measured with a ruler" value="'+esc(G.inp.rise)+'">')
    +'<small class="mut" id="gv-rn">'+riseNote(q,vr)+'</small>'
    +lbl('gv-w','Body mass (kg)','<input id="gv-w" data-in="gv" data-f="mass" type="number" min="20" max="300" step="0.1" inputmode="decimal" value="'+esc(G.inp.mass)+'">')
    +'<small class="mut" id="gv-wn">'+massNote(mi)+'</small>'
    +'<div id="gv-res">'+results()+'</div>'
    +(G.dup?'<p class="warn" role="alert">You already logged a session with the same steps at this stairway today. Saving adds a second record. Press SAVE AGAIN to add it anyway.</p>':'')
    +(G.target?'<p class="mut gvsend">Nothing is saved here. The numbers go into '+TG[G.target]+', and you save from there, so the climb is logged once.</p><div class="gvbtns"><button type="button" data-a="gvsend">SEND TO '+TG[G.target]+'</button><button type="button" class="g" data-a="gvcancel">'+(G.cancel?'TAP AGAIN TO DISCARD':'DISCARD')+'</button></div>'
      :'<div class="gvbtns"><button type="button" data-a="gvsave">'+(G.dup?'SAVE AGAIN':'SAVE TO MY STAIR LOG')+'</button><button type="button" class="g" data-a="gvcancel">'+(G.cancel?'TAP AGAIN TO DISCARD':'DISCARD')+'</button></div>')}
const kNote=()=>{const n=Math.round(+G.inp.steps),k=Math.round(+G.inp.climbs);return n>=1&&k>=1?'Steps per climb = '+n+' \u00f7 '+k+' = '+Math.round(n/k)+(Math.round(n/k)*k!==n?' (rounded, so the form will hold '+Math.round(n/k)*k+' steps in all)':''):'Total steps divided by the number of climbs.'};
const riseNote=(q,vr)=>!q?'Choose the staircase above.':vr&&!G.ed.rise?(riseKind(q.id)==='study'?'Measured in the Group 14 study ('+f1(vr*100,1)+' cm). You can change it.':'Estimated from the stairway\u2019s angle: '+f1(RUN_EST*100,1)+' cm tread (average of the measured stairways) \u00d7 tan '+f1(q.angle,1)+'\u00b0. An estimate; measure one step with a ruler to replace it.'):G.inp.rise===''?'No step height can be worked out for this stairway. Measure one step with a ruler, or leave it empty and the height, work and power stay unavailable.':'Typed in by you.';
const massNote=mi=>G.inp.mass===''?'No weight on record. Enter your body mass, or work and power stay unavailable.':mi&&!G.ed.mass?'From '+mi.src+'. You can change it for this session.':'Typed in by you.';
function calc(){return physics(Math.round(+G.inp.steps),(+G.inp.rise)/100,+G.inp.mass,(+G.inp.min)*60)}
function results(){
  const c=calc(),na='<span class="gvna">unavailable</span>',q=stairOf(G.sid);
  const row=(sym,name,val,eq,why)=>'<tr><th scope="row">'+sym+'</th><td>'+name+'</td><td><b>'+val+'</b></td><td class="mut">'+eq+'</td></tr>';
  const why=[];if(!c.okN)why.push('steps (1–1000)');if(!c.okR)why.push('height of one step (5–30 cm)');if(!c.okM)why.push('body mass (20–300 kg)');if(!c.okT)why.push('time (at least 10 s)');
  const n=Math.round(+G.inp.steps),r=(+G.inp.rise)/100;
  return '<div class="gvres"><h4>ESTIMATED RESULTS <span class="pxtag">ESTIMATE</span></h4>'
    +'<table class="tbl gvt"><tbody>'
    +row('h','Vertical height climbed',c.h==null?na:f1(c.h,2)+' m',c.h==null?'h = n × r':'h = '+n+' × '+f1(r,3)+' m')
    +row('W','Work against gravity',c.W==null?na:f1(c.W,0)+' J',c.W==null?'W = m g h':'W = '+f1(+G.inp.mass,1)+' × 9.80665 × '+f1(c.h,2))
    +row('E','Same work in kilojoules',c.kJ==null?na:f1(c.kJ,2)+' kJ','E = W ÷ 1000')
    +row('P','Average power',c.P==null?na:f1(c.P,1)+' W',c.P==null?'P = W ÷ t':'P = '+f1(c.W,0)+' ÷ '+f1((+G.inp.min)*60,0)+' s')
    +'</tbody></table>'
    +(why.length?'<p class="mut" role="status">Unavailable until you enter: '+why.join(', ')+'.</p>':'')
    +'<details class="gvvar"><summary>What the letters mean</summary><dl><dt>n</dt><dd>steps climbed upward (your corrected count)</dd><dt>r</dt><dd>height of one step in metres (cm ÷ 100)</dd><dt>h</dt><dd>height gained = n × r (m)</dd><dt>m</dt><dd>your body mass (kg); a bag or the phone is not added</dd><dt>g</dt><dd>9.80665 m/s², standard gravity</dd><dt>W</dt><dd>work done lifting your body against gravity, in joules (J = kg·m²/s²)</dd><dt>t</dt><dd>time in seconds, including any rests while the timer ran</dd><dt>P</dt><dd>average power = W ÷ t, in watts (W = J/s)</dd></dl></details>'
    +'<small class="mut">Work against gravity is not the energy your body uses, which is several times larger. It is also not measured by the phone. Power is an average over the whole time, so resting inside the time lowers it. Slower and steadier is not worse.</small></div>'}
function saved(){const s=G.saved;
  return '<p role="status"><b>Saved.</b> '+esc(s.loc)+' · '+s.n+' steps · '+s.min+' min added to your stair log'+(s.W!=null?' · W ≈ '+f1(s.W/1000,2)+' kJ':'')+'.</p><button type="button" class="g" data-a="gvnew">NEW CLIMB</button>'}
function body(){return G.ph==='idle'?idle():G.ph==='running'||G.ph==='paused'?running():G.ph==='review'?review():saved()}
function card(){
  return '<div class="card stcard gv" id="gvtrial"><h3>'+ico('wizard')+' STAIR SENSE · THE GRAVITY TRIAL '+help()+'</h3><span class="pxtag gvtag">ESTIMATES ONLY</span>'+'<div id="gv-body">'+body()+'</div>'+(typeof HWAlchemy!=='undefined'?'<button type="button" class="g sm gvalc" data-a="alopen">COMPARE WITH FOOD ENERGY (OPTIONAL)</button>':'')+'</div>'}
function repaint(focus){const b=$i('gv-body');if(!b)return;b.innerHTML=body();live();if(focus){const e=$i(focus);if(e)e.focus({preventScroll:true})}}

/* ---------- actions ---------- */
function stop(){detach();ticker(0)}
acts.gvstart=async()=>{
  if(G.ph!=='idle'||G.busy||locked())return;
  G.busy=1;G.gid='gv'+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36);G.est=0;G.got=0;G.cadence=null;G.ctr=counter();G.cancel=0;
  if(typeof DeviceMotionEvent==='undefined')G.sensor='unsupported';
  else if(typeof DeviceMotionEvent.requestPermission==='function'){
    try{G.sensor=(await DeviceMotionEvent.requestPermission())==='granted'?'on':'denied'}catch(e){G.sensor='denied'}}
  else G.sensor='on';
  G.busy=0;G.ph='running';G.acc=0;G.since=Date.now();attach();ticker(1);
  if(G.sensor==='on'){chk=setTimeout(()=>{if(G.ph==='running'&&!G.got){G.sensor='none';detach();live()}},4000)}
  repaint('gv-body')};
acts.gvpause=()=>{if(G.ph!=='running')return;G.acc+=Date.now()-G.since;G.ph='paused';stop();repaint()};
acts.gvresume=()=>{if(G.ph!=='paused')return;G.ph='running';G.since=Date.now();attach();ticker(1);repaint()};
acts.gvfinish=()=>{
  if(G.ph!=='running'&&G.ph!=='paused')return;
  if(G.ph==='running')G.acc+=Date.now()-G.since;
  stop();G.ph='review';G.cancel=0;
  const mi=massInfo(),q=stairOf(G.sid);
  G.inp={steps:G.sensor==='on'&&G.est>0?String(G.est):'',rise:q&&verifiedRise(q.id)?String(Math.round(verifiedRise(q.id)*1000)/10):'',mass:mi?String(mi.kg):'',min:String(Math.round(G.acc/600)/100),climbs:'1'};
  G.ed={rise:0,mass:0};repaint()};
acts.gvcancel=()=>{
  if(!G.cancel){G.cancel=1;repaint();return}
  stop();const sid=G.sid;G=fresh();G.sid=sid;repaint();toast('Climb discarded. Nothing was saved.')};
acts.gvnew=()=>{const sid=G.sid;G=fresh();G.sid=sid;repaint()};
acts.gvci=d=>{const q=stairOf(d.id);if(q){G.sid=q.id;repaint('gv-sid')}};
INP.gv=el=>{const f=el.dataset.f;
  if(f==='ack'){G.ack=el.checked?1:0;repaint('gv-ack');return}
  if(f==='sid'){G.sid=el.value;G.dup=0;
    if(G.ph==='review'){const q=stairOf(G.sid),vr=q?verifiedRise(q.id):null;if(!G.ed.rise)G.inp.rise=vr?String(Math.round(vr*1000)/10):'';repaint('gv-sid')}else repaint('gv-sid');return}
  if(!(f in G.inp))return;G.inp[f]=el.value;G.dup=0;G.cancel=0;if(f==='rise')G.ed.rise=1;if(f==='mass')G.ed.mass=1;
  const r=$i('gv-res');if(r)r.innerHTML=results();
  const kn=$i('gv-kn');if(kn)kn.textContent=kNote();const rn=$i('gv-rn');if(rn)rn.textContent=riseNote(stairOf(G.sid),stairOf(G.sid)?verifiedRise(G.sid):null);const wn=$i('gv-wn');if(wn)wn.textContent=massNote(massInfo())};
acts.gvgo=d=>{
  const k=TG[d.k]?d.k:'';
  if(G.ph!=='running'&&G.ph!=='paused'&&G.ph!=='idle'){const sid=G.sid;G=fresh();G.sid=sid}
  G.target=k;
  if(!G.sid&&typeof HWStairs.pick==='string'&&stairOf(HWStairs.pick))G.sid=HWStairs.pick;
  repaint();const c=$i('gvtrial');
  if(c)c.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'})};
acts.gvuntarget=()=>{G.target='';repaint()};
// hand the review's numbers to the form the button was pressed beside; nothing is saved here
acts.gvsend=()=>{
  if(G.ph!=='review'||!G.target)return;
  const n=Math.round(+G.inp.steps),k=Math.round(+G.inp.climbs),min=Math.round(+G.inp.min*100)/100,t=G.target;
  if(!(Number.isInteger(n)&&n>=1&&n<=1000)){toast('Enter the steps climbed (1\u20131000)');return}
  if(!(Number.isInteger(k)&&k>=1&&k<=500)){toast('Enter the number of climbs (1\u2013500)');return}
  const per=Math.round(n/k);if(!(per>=1&&per<=1000)){toast('Steps per climb should be 1\u20131000');return}
  const sid=G.sid;G=fresh();G.sid=sid;
  if(t==='g'){
    const s=$i('gps-s'),c=$i('gps-c');
    if(!s||!c){repaint();toast('Open the GPS check-in again and press STAIR SENSE there. Steps per climb: '+per+', climbs: '+k+'.');return}
    s.value=per;c.value=k;repaint();s.scrollIntoView({block:'center',behavior:HWUI.reduced()?'auto':'smooth'});toast('From Stair Sense: '+per+' steps per climb, '+k+' climb'+(k===1?'':'s')+'. Check them, then check in.');return}
  HWStairs.fill(t,{steps:per,climbs:k,sid,dur:t==='w'&&min>=.2?min:0});
  toast('From Stair Sense: '+per+' steps per climb, '+k+' climb'+(k===1?'':'s')+(t==='w'&&min>=.2?', '+min+' min':'')+'. Check them, then save.')};
acts.gvsave=()=>{
  if(G.ph!=='review')return;
  const q=stairOf(G.sid),n=Math.round(+G.inp.steps),min=+G.inp.min;
  if(!q){toast('Choose the staircase first');return}
  if(!(Number.isInteger(n)&&n>=1&&n<=1000)){toast('Enter the steps climbed (1–1000). For more, save the climb in parts.');return}
  if(!(min>=.2&&min<=1440)){toast('Enter the time in minutes');return}
  if(LC('stair').some(e=>e.m&&e.m.gv&&e.m.gv.gid===G.gid)){toast('This climb is already saved.');G.ph='saved';repaint();return}
  const twin=LC('stair').some(e=>e.d===today()&&e.m&&e.m.sid===q.id&&+e.v===n);
  if(twin&&!G.dup){G.dup=1;repaint();return}
  const c=calc(),vr=verifiedRise(q.id),r=(+G.inp.rise)/100,mi=massInfo();
  const gv={gid:G.gid,method:G.sensor==='on'&&G.est>0&&n===G.est?'sensor':G.sensor==='on'&&G.est>0?'sensor+corrected':'manual',sensor:G.sensor==='on'?G.est:null,n,
    rise:c.okR?r:null,riseSrc:c.okR?(vr&&Math.abs(vr-r)<1e-9?riseKind(q.id):'typed'):null,mass:c.okM?+G.inp.mass:null,massSrc:c.okM?(G.ed.mass?'typed':mi&&mi.kg===+G.inp.mass?'record':'typed'):null,
    secs:Math.round(min*60),h:c.h==null?null:Math.round(c.h*1000)/1000,W:c.W==null?null:Math.round(c.W),P:c.P==null?null:Math.round(c.P*10)/10};
  const rec=HWStairs.record(q,{kind:'workout',src:'manual',steps:n,climbs:1,dur:Math.round(min*100)/100,pace:null,kcal:null});rec.gv=gv;
  add('stair',n,rec,'',today(),nowT(),25,'Stair session');
  G.saved={loc:q.name,n,min:Math.round(min*10)/10,W:gv.W};G.ph='saved';G.dup=0;render()};

// anywhere else, the sensor is off: leaving the page or hiding the tab pauses a running climb
HWEvents.on('page:viewed',e=>{if(e.view!=='stair'&&(G.ph==='running'))acts.gvpause()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.ph==='running')acts.gvpause()});
HWEvents.on('data:reset',()=>{stop();G=fresh()});HWEvents.on('data:imported',()=>{stop();G=fresh()});

{const p=pages.stair;pages.stair=function(){const h=p.apply(this,arguments),j=h.indexOf('<div class="card" id="stlog">');
  const c=card();return j<0?h+c:h.slice(0,j)+c+h.slice(j)}} // below the page's own trackers, above the Session Chronicle

HWUI.css('gravity',`
.gv h3{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;margin-bottom:4px}.gvtag{display:inline-block;margin:0 0 6px}
.gv label{display:block;margin:10px 0 2px;font-size:14px}.gv select,.gv input[type=number]{width:100%;min-height:44px;box-sizing:border-box}
.gvq{margin:6px 0}.gvph{display:block;margin:10px 0}
.gvack{display:flex!important;gap:8px;align-items:flex-start;min-height:44px}.gvack input{width:24px;height:24px;flex:0 0 auto}
.gvgo,.gvfin{width:100%;min-height:52px}.gvgo:disabled{opacity:.5}
.gvsafe{margin:10px 0 0;font-size:13px}
.gvhud{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:8px 0}.gvst{min-width:0;text-align:center;padding:8px 4px}.gvst b{font:var(--px-f2,16px)/1.3 var(--fh)}.gvst small{display:block;font-size:11px}
.gvm{margin:6px 0 10px}.gvml{font:8px var(--fh);color:var(--mut);display:block;margin-bottom:4px}
.gvm .bar i{transition:width .3s steps(4)}
.gvbtns{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.gvbtns button{flex:1 1 130px;min-height:48px}
.gvfrom{margin:0 0 8px;padding:6px 8px;border:3px solid var(--blue);background:var(--p2);font-size:13px}.gvfrom .sm{margin-left:6px;min-height:44px}.gvsend{margin:8px 0 0}
#gvtrial{scroll-margin-top:72px}
.gvx,.gvalc{width:100%;min-height:44px}.gvalc{margin-top:10px}.gvpaused{margin:4px 0;padding:6px;border:3px solid var(--blue);background:var(--p2);font-size:13px}
.gv h4{margin:12px 0 4px;font:9px/1.6 var(--fh)}
.gvres{margin-top:12px;padding:8px;border:3px solid var(--ln);background:var(--p2)}.gvres h4{margin-top:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gvt{min-width:0;width:100%}.gvt th{font:700 16px var(--fb);text-align:center;width:2ch}.gvt td{overflow-wrap:anywhere}.gvt td:nth-child(3){white-space:nowrap}
.gvna{color:var(--mut);font-weight:400;font-style:italic}
.gvvar summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:13px}.gvvar dl{margin:4px 0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:13px}.gvvar dt{font-weight:700}.gvvar dd{margin:0}
@media(max-width:380px){.gvhud{gap:4px}.gvst b{font-size:14px}.gvt td:nth-child(2){font-size:12px}.gvt td:nth-child(4){font-size:11px}}
`);
return{counter,physics,verifiedRise,riseKind,RUN_EST,massInfo,G0,get state(){return G.ph},get sensor(){return G.sensor},get listening(){return listening},get gid(){return G.gid}}})();
