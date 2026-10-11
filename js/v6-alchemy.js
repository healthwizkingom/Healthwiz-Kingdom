/* v6: The Alchemist's Energy Workshop (route 'alchemy'). Not part of the original.
   An optional, neutral lesson about three different quantities that are all measured in energy units but are NOT interchangeable:
     1. food energy              chemical energy in food, as stated on the menu data (kcal) or typed by the user
     2. work against gravity     W = m g h, the mechanical work of lifting the body up the steps (J)
     3. metabolic energy use     what the body actually uses to do it, which is several times W, and which only an estimate can give
   Nothing here is saved: no entry is added, no setting changes, no XP. The numbers live in this file's memory (tests/57-alchemy.test.mjs
   checks the save is byte-identical). It is not a weight-loss tool: it never turns food into a number of stairs, never says food has to be
   "earned" or "made up for", and shows no goal, streak or score.

   Sources, all existing
     food       MENU.foods = [name, stated portion, kcal] (js/hw-01-menu-data.js, Kolej MARA Kulim). Some items have no kcal: the user types it.
                A food outside the menu is typed in (kcal, optional stated portion). Portion multiples are PMS (js/hw-06). With no stated
                portion the energy is used as typed and cannot be scaled.
     climb      a stairway (STAIRS) and a step count, or one of the user's recorded stair sessions (HWStairs.all()). Step height: only the three
                stairways measured in the Group 14 study have one (HWGravity.verifiedRise); a Stair Sense record carries its own. Otherwise the
                user types it, or the work stays unavailable. Mass: the session's own, else HWGravity.massInfo() (weight record, then profile).
     work       HWGravity.physics(): h = n r, W = m g h with g = 9.80665 m/s².
     metabolic  (a) the estimate the Stairs page saved with the session (HWStairs.estimate: MET × resting energy, with the heart-rate formula
                    when there was one), shown as it was saved; (b) an illustration, W ÷ efficiency with efficiency ASSUMED at 25% and 20% (the
                    share of the energy the body uses that ends up as the mechanical work of lifting). Both are labelled estimates.
   Conversion: 1 kcal = 4.184 kJ exactly (the thermochemical calorie, 4184 J); 1 kJ = 1000 J. */
const HWAlchemy=(()=>{
const KJ=4.184,ico=n=>HWPixel.icon(n,1),$i=i=>document.getElementById(i);
const kj=kcal=>kcal*KJ,kcalOfJ=j=>j/(KJ*1000);
const fmt=(x,d)=>(+x).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const en=x=>x>=100||(x>=10&&Math.abs(x-Math.round(x))<1e-9)?fmt(x,0):x>=10?fmt(x,1):fmt(x,2);                      // enough digits, not false precision
const MIN_ETA=.20,MAX_ETA=.25;
const Z0=()=>({src:'menu',q:'',fi:'',pm:1,kc:'',por:'',nm:'',sid:'',n:'',rise:'',mass:'',rec:'',recRise:'',recMass:'',scale:0,ed:{rise:0,mass:0}});
let Z=Z0();

/* ---------- the three quantities ---------- */
function food(){
  const m=Z.src==='menu'&&Z.fi!==''?F[+Z.fi]:null;
  if(Z.src==='menu'&&!m)return{ok:0,why:'Choose a food from the menu, or type your own.'};
  const typed=+Z.kc,hasT=Z.kc!==''&&isFinite(typed)&&typed>=0&&typed<=5000;
  let base=null,src='',por='';
  if(m){por=m[1];if(m[2]!=null){base=+m[2];src='the Kolej MARA Kulim menu data (an estimate for the standard serving)'}else if(hasT){base=typed;src='typed by you (the menu does not list its energy)'}}
  else if(hasT){base=typed;src='typed by you';por=Z.por.trim()}
  if(base==null)return{ok:0,name:m?m[0]:Z.nm.trim()||'Your food',por,why:m?'The menu does not list the energy of this item. Type it per stated portion (from a label, or leave it out).':'Type the energy of your food in kcal (0–5000).'};
  const name=m?m[0]:Z.nm.trim()||'Your food',scalable=!!por;
  const pm=scalable&&+Z.pm>0&&+Z.pm<=20?+Z.pm:1,kcal=base*pm;
  return{ok:1,name,por,scalable,pm,base,kcal,kJ:kj(kcal),src}}
function climbRec(){return Z.rec?HWStairs.all().find(s=>s.id===Z.rec):null}
function climb(){
  const q=STAIRS.find(s=>s.id===Z.sid)||null,n=Math.round(+Z.n),vr=q?HWGravity.verifiedRise(q.id):null;
  const mi=HWGravity.massInfo(),rec=climbRec();
  const riseCm=Z.rise!==''?+Z.rise:(Z.recRise!==''?+Z.recRise:vr?vr*100:null);
  const massKg=Z.mass!==''?+Z.mass:(Z.recMass!==''?+Z.recMass:mi?mi.kg:null);
  const riseSrc=Z.rise!==''?'typed by you':Z.recRise!==''?'saved with that Stair Sense record':vr?'measured in the Group 14 study':'';
  const massSrc=Z.mass!==''?'typed by you':Z.recMass!==''?'saved with that Stair Sense record':mi?mi.src:'';
  const P=HWGravity.physics(n,riseCm==null?NaN:riseCm/100,massKg==null?NaN:massKg,60);
  const saved=rec&&rec.kcal?rec.kcal:null;
  return{q,n,okN:P.okN,riseCm,massKg,riseSrc,massSrc,h:P.h,W:P.W,okR:P.okR,okM:P.okM,saved,rec,
    lo:P.W==null?null:P.W/MAX_ETA,hi:P.W==null?null:P.W/MIN_ETA}}                  // J of metabolic energy if 25% / 20% of it becomes the lifting work

/* ---------- pieces ---------- */
function foodOptions(){
  const q=Z.q.trim().toLowerCase(),L=F.map((f,i)=>[f,i]).filter(([f])=>!q||f[0].toLowerCase().includes(q)).sort((a,b)=>a[0][0].localeCompare(b[0][0]));
  return '<option value="">Choose a food… ('+L.length+')</option>'+L.map(([f,i])=>'<option value="'+i+'"'+(String(i)===String(Z.fi)?' selected':'')+'>'+esc(f[0])+' · '+esc(f[1])+' · '+(f[2]==null?'energy not listed':f[2]+' kcal')+'</option>').join('')}
function foodCard(){
  const m=Z.src==='menu';
  return '<div class="card alc" id="al-food"><h3>'+ico('food')+' INGREDIENT CARD</h3><span class="pxtag">FOOD ENERGY</span>'
    +'<div class="row alseg" role="group" aria-label="Where the food comes from"><button type="button" class="chip'+(m?' on':'')+'" data-a="alsrc" data-v="menu" aria-pressed="'+m+'">MENU ITEM</button><button type="button" class="chip'+(!m?' on':'')+'" data-a="alsrc" data-v="manual" aria-pressed="'+!m+'">TYPE MY OWN</button></div>'
    +(m?'<label for="al-q">Search the menu</label><input id="al-q" data-in="al" data-f="q" value="'+esc(Z.q)+'" placeholder="e.g. nasi, ayam, susu"><label for="al-fi">Food</label><select id="al-fi" data-in="al" data-f="fi">'+foodOptions()+'</select>'
      :'<label for="al-nm">Food name <small class="mut">(optional)</small></label><input id="al-nm" data-in="al" data-f="nm" maxlength="40" value="'+esc(Z.nm)+'">'
       +'<label for="al-po">Stated portion <small class="mut">(optional, e.g. 1 plate, 150 g)</small></label><input id="al-po" data-in="al" data-f="por" maxlength="40" value="'+esc(Z.por)+'">')
    +'<div id="al-kc">'+kcInput()+'</div>'
    +'<div id="al-pm">'+pmBlock()+'</div>'
    +'<div id="al-fres">'+foodRes()+'</div></div>'}
function kcInput(){
  const f=food(),m=Z.src==='menu'&&Z.fi!==''?F[+Z.fi]:null;
  if(m&&m[2]!=null)return '';
  if(Z.src==='menu'&&!m)return '';
  return '<label for="al-kcin">Energy per '+(m?'stated portion':'portion')+' (kcal)</label><input id="al-kcin" data-in="al" data-f="kc" type="number" min="0" max="5000" step="1" inputmode="decimal" value="'+esc(Z.kc)+'">'+(f.ok?'':'')}
function pmBlock(){
  const f=food();if(!f.ok||!f.por)return f.ok&&!f.por?'<small class="mut">No portion is stated, so the energy is used exactly as typed and cannot be scaled.</small>':'';
  return '<label>Portion <small class="mut">(compared with the stated '+esc(f.por)+')</small></label><div class="pm" role="group" aria-label="Portion size">'+PMS.map(x=>'<button type="button" class="chip'+(+Z.pm===x?' on':'')+'" data-a="alpm" data-v="'+x+'" aria-pressed="'+(+Z.pm===x)+'">'+x+'×</button>').join('')+'</div>'}
function foodRes(){
  const f=food();if(!f.ok)return '<p class="mut" role="status">'+esc(f.why)+'</p>';
  return '<div class="alres" role="status"><p><b>'+esc(f.name)+'</b>'+(f.por?' · stated portion <b>'+esc(f.por)+'</b>'+(f.pm!==1?' × '+f.pm+' = your portion':''):' · <b>portion not stated</b>')+'</p>'
    +'<p class="alnum"><b>'+en(f.kcal)+'</b> kcal <span class="mut">=</span> <b>'+en(f.kJ)+'</b> kJ</p>'
    +'<small class="mut">'+en(f.kcal)+' kcal × 4.184 kJ/kcal = '+en(f.kJ)+' kJ. Source: '+esc(f.src)+(f.pm!==1?'. Scaled from the stated portion, assuming the energy grows in proportion':'')+'. A food-energy figure is itself an estimate.</small></div>'}
function climbCard(){
  const L=HWStairs.all().filter(s=>s.total>0).slice(-12).reverse();
  return '<div class="card alc" id="al-climb"><h3>'+ico('stairs')+' ASCENT CRYSTAL</h3><span class="pxtag">MOVEMENT</span>'
    +(L.length?'<label for="al-rec">A climb you recorded <small class="mut">(optional)</small></label><select id="al-rec" data-in="al" data-f="rec"><option value="">Pick a recorded climb…</option>'+L.map(s=>'<option value="'+esc(s.id)+'"'+(s.id===Z.rec?' selected':'')+'>'+esc(s.d)+' · '+esc(s.loc.length>34?s.loc.slice(0,33)+'…':s.loc)+' · '+s.total+' steps</option>').join('')+'</select>':'<small class="mut">No stair sessions recorded yet. Choose a staircase and type a step count to explore.</small>')
    +'<label for="al-sid">Staircase</label><select id="al-sid" data-in="al" data-f="sid"><option value="">Choose a staircase…</option>'+CATS.map(c=>'<optgroup label="'+c[1]+'">'+stairsOf(c[1]).map(s=>'<option value="'+s.id+'"'+(s.id===Z.sid?' selected':'')+'>'+esc(s.name)+(HWGravity.verifiedRise(s.id)?' · step height measured':'')+'</option>').join('')+'</optgroup>').join('')+'</select>'
    +'<label for="al-n">Steps climbed (up only)</label><input id="al-n" data-in="al" data-f="n" type="number" min="1" max="1000" inputmode="numeric" value="'+esc(Z.n)+'">'
    +'<label for="al-r">Height of one step (cm)</label><input id="al-r" data-in="al" data-f="rise" type="number" min="5" max="30" step="0.1" inputmode="decimal" placeholder="measured value" value="'+esc(Z.rise)+'">'
    +'<label for="al-m">Body mass (kg)</label><input id="al-m" data-in="al" data-f="mass" type="number" min="20" max="300" step="0.1" inputmode="decimal" value="'+esc(Z.mass)+'">'
    +'<div id="al-cres">'+climbRes()+'</div></div>'}
function climbRes(){
  const c=climb();let h='';
  const need=[];if(!c.q)need.push('a staircase');if(!c.okN)need.push('steps climbed (1–1000)');if(!c.okR)need.push('the height of one step (5–30 cm)'+(c.q&&!HWGravity.verifiedRise(c.q.id)?', which is not measured for this staircase':''));if(!c.okM)need.push('your body mass (20–300 kg)');
  h+='<small class="mut">Step height: '+(c.okR?fmt(c.riseCm,1)+' cm, '+esc(c.riseSrc):'<b>unavailable</b>')+'. Mass: '+(c.okM?fmt(c.massKg,1)+' kg, '+esc(c.massSrc):'<b>unavailable</b>')+'.</small>';
  if(c.W==null)return h+'<p class="mut" role="status">The work against gravity is unavailable. Needs: '+need.join('; ')+'.</p>'+(c.saved?savedLine(c):'');
  return h+'<div class="alres" role="status"><p class="alnum">h = '+c.n+' × '+fmt(c.riseCm/100,3)+' m = <b>'+fmt(c.h,2)+' m</b></p><p class="alnum">W = m g h = '+fmt(c.massKg,1)+' × 9.80665 × '+fmt(c.h,2)+' = <b>'+fmt(c.W,0)+' J</b> <span class="mut">=</span> <b>'+en(c.W/1000)+' kJ</b> <span class="mut">=</span> '+en(kcalOfJ(c.W))+' kcal</p>'
    +'<small class="mut">Mechanical work of lifting your body only (not a bag, not the phone). An estimate from the numbers above.</small></div>'+(c.saved?savedLine(c):'')}
const savedLine=c=>'<p class="alsaved"><b>Saved estimate for that session:</b> about '+c.saved.v+' kcal ('+c.saved.lo+'–'+c.saved.hi+') = '+en(kj(c.saved.v))+' kJ, from the Stairs page (MET × your resting energy'+(c.saved.m==='met+hr'?', averaged with a heart-rate formula':'')+', over the time of the workout). An estimate of the energy the body used in total, including what it uses at rest.</p>';
function crystals(){
  const f=food(),c=climb();
  const cr=(cls,title,what,val,sub)=>'<div class="alcr '+cls+'"><i class="alg" aria-hidden="true"></i><div><b>'+title+'</b><span class="alwhat">'+what+'</span>'+val+(sub||'')+'</div></div>';
  const na='<span class="gvna">unavailable</span>';
  return '<div class="alcrs">'
    +cr('f','FOOD ENERGY','chemical energy stated for the food',f.ok?'<span class="alnum"><b>'+en(f.kcal)+'</b> kcal · <b>'+en(f.kJ)+'</b> kJ</span>':na)
    +cr('w','WORK AGAINST GRAVITY','W = m g h, lifting the body only',c.W==null?na:'<span class="alnum"><b>'+en(c.W/1000)+'</b> kJ · '+en(kcalOfJ(c.W))+' kcal</span>')
    +cr('m','ESTIMATED BODY ENERGY USE','what the body spends to do it · estimate',c.W==null&&!c.saved?na:'<span class="alnum">'+(c.saved?'saved: <b>'+c.saved.v+'</b> kcal ('+c.saved.lo+'–'+c.saved.hi+')<br>':'')+(c.W==null?'':'if 20–25% of it becomes the lifting work: <b>'+en(kcalOfJ(c.lo))+'–'+en(kcalOfJ(c.hi))+'</b> kcal')+'</span>','<span class="mut alas">'+(c.W==null?'':'= '+en(c.lo/1000)+'–'+en(c.hi/1000)+' kJ. The 20% and 25% are assumptions, not measurements of you.')+'</span>')
    +'</div>'}
function scale(){
  if(!Z.scale)return '<button type="button" class="g alshow" data-a="alscale">SHOW THE ENERGY SCALE</button>';
  const f=food(),c=climb(),rows=[];
  if(f.ok)rows.push(['f','Food energy',f.kJ]);
  if(c.W!=null)rows.push(['w','Work against gravity',c.W/1000]);
  if(c.W!=null)rows.push(['m','Estimated body energy use (20–25% assumption)',c.hi/1000,c.lo/1000]);
  else if(c.saved)rows.push(['m','Saved body-energy estimate',kj(c.saved.v)]);
  const mx=Math.max(...rows.map(r=>r[2]),0);
  return '<div class="alscale"><div class="alsc" aria-label="Energy scale, kilojoules, all bars on one scale">'
    +(rows.length?rows.map(r=>{const w=mx?Math.max(.6,r[2]/mx*100):0;return '<div class="alsr '+r[0]+'"><span class="alsl">'+r[1]+'</span><span class="alsb"><i style="width:'+w.toFixed(2)+'%"></i></span><span class="alsv">'+en(r[2])+(r[3]!=null?'–'+en(r[3]):'')+' kJ</span></div>'}).join(''):'<p class="mut">Choose a food and a climb to see the scale.</p>')
    +'</div><small class="mut">One scale for all bars (kJ). They are three different kinds of energy, not an exchange rate: this is a picture of size, not a target, a trade or a way to make up for a meal.</small>'
    +'<button type="button" class="g sm" data-a="alscale">HIDE THE SCALE</button></div>'}
function lesson(){
  return '<div class="card" id="al-lesson"><h3>'+ico('scroll')+' HOW ENERGY IS MEASURED</h3>'
    +'<ul class="alli"><li><b>Units.</b> Energy is measured in joules (J). Food labels use the kilocalorie, written kcal or “Calories”. <b>1 kcal = 4.184 kJ</b> (4184 J), so kJ = kcal × 4.184 and kcal = kJ ÷ 4.184.</li>'
    +'<li><b>Food energy</b> is the chemical energy stored in food. It is worked out from the amount of protein, carbohydrate and fat, so every food figure is an estimate.</li>'
    +'<li><b>Mechanical work against gravity</b> is the physics quantity W = m g h: the work of lifting a mass m up a height h, with g = 9.80665 m/s². It counts the lifting only.</li>'
    +'<li><b>Metabolic energy use</b> is what the body actually spends. Muscles turn only a fraction of it into work, the rest becomes heat, and the body keeps using energy at rest. It can only be estimated, for example from a MET value or heart rate, and it is much larger than W.</li>'
    +'<li>These three are related but <b>not interchangeable</b>: work is not the body’s energy use, and neither is a measure of what a food is “worth”.</li></ul>'
    +'<small class="mut">Your body uses energy all day for breathing, thinking, growing and keeping warm. Eating is for fuel, growth and enjoyment. Nothing here says how much anyone should eat or move.</small></div>'}
function help(){return HWHelp.btn('alhelp','About the Energy Workshop','<p><b>EXPLORING ONLY.</b> Nothing you choose here is saved, logged or changed. Your food and exercise records stay as they are.</p><p>This is a lesson about energy, not a plan. Food is not something to earn or make up for, and there is no number of stairs that “cancels” a meal. It is optional: you can ignore it.</p><p>Every value is an estimate: menu energy is an estimate per standard serving, the step height comes from a measurement of that staircase (or yours), and the body-energy range rests on an assumed muscle efficiency.</p><p>It is not medical or dietary advice. If food, eating or exercise worry you, talk to a parent, teacher, doctor or dietitian.</p>',{label:'About the Energy Workshop'})}
function page(){
  return '<h2>'+ico('scroll')+' THE ALCHEMIST’S ENERGY WORKSHOP</h2>'
    +'<div class="card alhd"><div class="alsimr"><p class="alsim" role="note">EXPLORING ONLY — NOTHING HERE IS SAVED OR CHANGES YOUR LOGS.</p>'+help()+'</div><p>A calm look at three kinds of energy: the energy in a food, the work of lifting your body up some stairs, and the energy your body uses to do it. Pick a food and a climb to compare their sizes. This is a lesson in physics and units. It is optional, and it is not a goal or a plan.</p></div>'
    +'<div class="alg2">'+foodCard()+climbCard()+'</div>'
    +'<div class="card" id="al-out"><h3>'+ico('energy')+' THE THREE ENERGIES</h3><div id="al-cr">'+crystals()+'</div><div id="al-sc">'+scale()+'</div>'
    +'<small class="mut">Food energy, work against gravity and the body’s energy use are different things. The body-energy figures are estimates and say nothing certain about you.</small></div>'
    +lesson()}

/* ---------- updates ---------- */
function refresh(){
  const set=(id,h)=>{const e=$i(id);if(e)e.innerHTML=h};
  set('al-fres',foodRes());set('al-cres',climbRes());set('al-cr',crystals());set('al-sc',scale());set('al-pm',pmBlock())}
INP.al=el=>{const f=el.dataset.f;if(!(f in Z))return;Z[f]=el.value;
  if(f==='q'){const s=$i('al-fi');if(s)s.innerHTML=foodOptions();return}
  if(f==='fi'){Z.pm=1;Z.kc='';const k=$i('al-kc');if(k)k.innerHTML=kcInput()}
  if(f==='rise')Z.ed.rise=1;if(f==='mass')Z.ed.mass=1;
  if(f==='sid'){const q=STAIRS.find(s=>s.id===Z.sid);if(Z.rec){Z.rec='';Z.recRise=Z.recMass=''}const r=$i('al-r');if(r&&q&&HWGravity.verifiedRise(q.id)&&!Z.ed.rise)r.placeholder=fmt(HWGravity.verifiedRise(q.id)*100,1)+' (measured)';else if(r)r.placeholder='measured value'}
  if(f==='rec'){const s=climbRec();Z.recRise=Z.recMass='';
    if(s){Z.sid=s.sid||'';Z.n=String(s.total);const e=st.e.find(x=>x.id===s.id),g=e&&e.m&&e.m.gv;
      if(g){if(+g.rise>0)Z.recRise=String(Math.round(g.rise*1000)/10);if(+g.mass>0)Z.recMass=String(g.mass)}
      Z.rise='';Z.mass='';Z.ed={rise:0,mass:0}}
    const q=$i('al-sid'),n=$i('al-n'),r=$i('al-r'),m=$i('al-m');if(q)q.value=Z.sid;if(n)n.value=Z.n;if(r)r.value='';if(m)m.value=''}
  refresh()};
acts.alsrc=d=>{Z.src=d.v==='manual'?'manual':'menu';Z.pm=1;Z.kc='';render()};
acts.alpm=d=>{if(PMS.includes(+d.v)){Z.pm=+d.v;refresh()}};
acts.alscale=()=>{Z.scale=Z.scale?0:1;refresh()};
acts.alopen=()=>{go('alchemy')};

pages.alchemy=()=>page();
PAR.alchemy='health';
BN.alchemy=['📜','The Alchemist’s Workshop','Three kinds of energy, side by side.','rgba(135,103,200,.28)'];
DIS.alchemy='A lesson about energy units, not advice. Food and exercise energy here are estimates; nothing is saved, and nothing is a goal. HealthWiz is a wellness tracker, not a medical device.';
HWEvents.on('page:viewed',e=>{if(e.view!=='alchemy')Z=Z0()});
HWEvents.on('data:reset',()=>{Z=Z0()});HWEvents.on('data:imported',()=>{Z=Z0()});

// a quiet doorway from the Nutrition page: optional, below everything else
const door=()=>'<div class="card aldoor" id="al-door"><h3>'+ico('scroll')+' THE ALCHEMIST’S ENERGY WORKSHOP</h3><p>Curious how the energy in a food compares with the energy of climbing stairs? An optional lesson in units and physics. Nothing is saved.</p><button type="button" class="g" data-a="alopen">OPEN THE WORKSHOP</button></div>';
{const p=pages.food;pages.food=function(){return p.apply(this,arguments)+door()}}

HWUI.css('alchemy',`
.tr-alchemy>h2{font-size:13px;line-height:1.7}.alg2>*{min-width:0}.alc select,.alc input{max-width:100%}.alhd{background:linear-gradient(var(--pn),var(--p2))}.alsimr{display:flex;align-items:flex-start;gap:8px;margin:0 0 8px}.alsimr .hwh{flex:0 0 auto;margin:0}.alsim{flex:1 1 auto;min-width:0;margin:0;padding:6px 8px;border:3px solid var(--vio);background:var(--pn);font:9px/1.7 var(--fh);overflow-wrap:anywhere}
.alg2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}@media(max-width:700px){.alg2{grid-template-columns:minmax(0,1fr)}}
.alc{margin-bottom:0}.alc label{display:block;margin:10px 0 2px;font-size:14px}.alc select,.alc input:not([type=checkbox]){width:100%;min-height:44px;box-sizing:border-box}
.alseg{gap:6px;margin:8px 0}.alseg .chip,.alc .pm .chip{min-height:44px}
.alres{margin:10px 0 0;padding:8px;border:3px solid var(--ln);background:var(--p2)}.alres p{margin:4px 0}.alnum{font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.alnum b{font:700 16px var(--fb)}
.alsaved{margin:8px 0 0;padding:6px 8px;border:2px dashed var(--vio);font-size:13px}
.alcrs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:8px 0}@media(max-width:700px){.alcrs{grid-template-columns:minmax(0,1fr)}}
.alcr{display:flex;gap:10px;padding:10px;border:3px solid var(--ln);background:var(--p2);min-width:0}.alcr>div{min-width:0}.alcr b{display:block;font:9px/1.6 var(--fh)}.alwhat{display:block;font-size:12px;color:var(--mut);margin:2px 0 6px}
.alg{flex:0 0 26px;height:34px;margin-top:2px;background:var(--c);clip-path:polygon(50% 0,100% 28%,100% 72%,50% 100%,0 72%,0 28%);box-shadow:inset -5px -5px 0 rgba(0,0,0,.2),inset 5px 5px 0 rgba(255,255,255,.25);filter:drop-shadow(0 0 4px var(--c))}
.alcr.f{--c:var(--gold)}.alcr.w{--c:var(--blue)}.alcr.m{--c:var(--vio)}.alas{display:block;font-size:12px;margin-top:4px}
.alscale{margin-top:8px;padding:8px;border:3px solid var(--vio);background:var(--pn);box-shadow:0 0 6px rgba(135,103,200,.45)}
.alsr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;margin:8px 0}.alsl{font-size:13px;grid-column:1/-1}.alsb{height:16px;border:3px solid var(--ln);background:var(--p2);display:block;min-width:0}.alsb i{display:block;height:100%;background:var(--c)}
.alsr.f{--c:var(--gold)}.alsr.w{--c:var(--blue)}.alsr.m{--c:var(--vio)}.alsv{font:700 13px var(--fb);white-space:nowrap}
.alshow{width:100%;min-height:44px}.alscale .sm{min-height:44px;margin-top:6px}
.alli{margin:6px 0 8px 18px}.alli li{margin:6px 0;font-size:14px}.aldoor{border-style:dashed}.aldoor button{width:100%;min-height:44px}
html.hw-rm .alg{filter:none}@media(prefers-reduced-motion:reduce){.alg{filter:none}}
`);
return{KJ,food,climb,Z:()=>Z}})();
