/* v6: the Evidence Vault (master prompt Feature G), a section of the Science Laboratory (js/v6-lab.js). Not part of the original.
   Every source HealthWiz cites (HWSources, js/v6-sources.js) on shelves by topic. Opening one shows the chain
     1 SOURCE        title, authors, where and when published, direct link (none for our own report, which is not online)
     2 IT SUPPORTS   the claim the source was checked for (HWSources s)
     3 HEALTHWIZ     each calculation that uses it: the formula the app runs and HealthWiz's own choices, kept apart from
                     the source's claim, with a button to the page where the result is shown
     4 CHECKED       how and when the source was checked, and its limits
   The same records feed every "?" panel, so the Vault and the explanations can never disagree. CALCS lists where each
   source is used; tests/62-lab.test.mjs checks that every cited source is on a shelf and every shelf entry exists.
   Context is kept: the open book and search stay while the page is visited, and the page reached through "WHERE YOU SEE
   IT" shows a "BACK TO THE VAULT" button.
   Deep link: every "?" of a calculation links to #vault=<calculation id> (CALCS id); HWVault.openCalc(id, fromView) opens the
   Vault on that calculation card, offers "BACK TO <page>", and an unknown id shows a message above the normal Vault. */
const HWVault=(()=>{
// where each source is used: name, route, the formula as the app runs it, sources, HealthWiz's own choices (not the source's)
const CALCS=[
  {id:'dass',topic:'mind',name:'Stress Quest: DASS-21 scores and the storm',v:'stress',f:'each scale (Depression, Anxiety, Stress) = sum of its 7 answers (0–3) × 2, from 0 to 42; storm level = 1 + round(9 × total of the 21 answers ÷ 63)',src:['dassfaq','lovibond95','henry05'],app:'The scores are shown without severity labels; the storm level and the creatures\' order are HealthWiz\'s own game choices, not part of the DASS.'},
  {id:'bmi',topic:'body',name:'Body mass index',v:'body',f:'BMI = weight (kg) ÷ height (m)²',src:['cdcbmi','asianbmi'],app:'Adult category from 18 (CDC uses 20+); Asian action points shown as extra information only.'},
  {id:'energy',topic:'body',name:'Daily energy goal (BMR, TDEE)',v:'body',f:'BMR = 10 × kg + 6.25 × cm − 5 × age + 5 (male) or − 161 (female); TDEE = BMR × PAL (1.55, 1.85 or 2.2)',src:['mifflin','faopal','hall'],app:'PAL is the FAO/WHO/UNU physical activity level for adult lifestyles (sedentary or light 1.40–1.69, active or moderately active 1.70–1.99, vigorous 2.00–2.40); HealthWiz uses the middle of each range, which is its own choice. The surplus (+300 kcal, at most +15%) and deficit (−400 kcal, at most −20%, never below BMR or 1,500 / 1,200 kcal) are HealthWiz\'s own cautious rules; Hall et al. show weight responds slowly to an energy change, so they do not predict a fixed weekly change.'},
  {id:'macro',topic:'body',name:'Protein, carbohydrate, fat and fiber goals',v:'body',f:'protein = min(p × kg, share × kcal ÷ 4); fat = 30% of kcal ÷ 9; carbs = the rest ÷ 4; fiber = 14 g per 1,000 kcal',src:['iomdri','whodiet'],app:'Fat set at 30% of energy; protein capped at 30% of energy under 19 and 35% from 19; protein 1.1 g/kg during a deficit is HealthWiz\'s choice. The IOM table values (protein g/kg, the ranges, fiber 14 g per 1,000 kcal) are still to be checked against the report.'},
  {id:'foodguess',topic:'food',name:'Add More Food: the Wizard\'s web estimate',v:'food',f:'total = the sum of the parts he finds; check on each part: kcal ≈ 4 × protein + 4 × carbohydrate + 9 × fat (flagged when more than 25 kcal and 25% off)',src:['fao77'],app:'The parts, their weights and their numbers come from web pages Google Gemini found (each part names its source and shows its arithmetic; the pages are listed on the card). It is an AI estimate, not a measurement, and can be wrong. The energy check uses the Atwater general factors.'},
  {id:'water',topic:'food',name:'Water goal',v:'body',f:'water = 35 mL × kg (+ 300 mL when PAL is 1.7 or more, + 500 mL at 2.0 or more), kept within 1,500–3,500 mL',src:['efsawater'],app:'35 mL per kg is HealthWiz\'s rule of thumb; EFSA is shown for comparison.'},
  {id:'trance',topic:'food',name:'Sleep Now: movement states, Mana and the Trance type',v:'sleep',f:'epoch = 5 min; variance of the phone\'s acceleration size: below 0.0006 = still (Abyssal Slumber, or The Astral Weave when the model says REM is likely), below 0.006 = Astral Drift (light), else Awake / Restless; time to cross the veil = minutes before the first 15 min of Drift or deeper; Restored Mana = min(100, hours slept ÷ your sleep-goal low end × 100); type = the state most above your own 30-night average (within ±3 points = Balanced)',src:['xie2013','fernandez2020','czeisler2007','peever2017'],app:'Everything here is a game estimate from phone movement, not a measurement of sleep stages: a phone cannot see brain waves. The thresholds, the 15-minute rule, the 90-minute minimum, the 6-hour flat-line cap and the ±3 point rule are HealthWiz\'s own choices. The four sources describe the biology that inspired the names (clearance during sleep in mice, spindles, circadian rhythms, REM); none of them validates phone-based staging.'},
  {id:'astralweave',topic:'food',name:'The Astral Weave: a modelled REM estimate',v:'sleep',f:'cycles of 90 min from sleep onset; REM window = the last share of each cycle: 10% (cycle 1), 15% (cycle 2), then 20% × (1 + 1.5 × ln(k − 2) ÷ ln 3) for cycles 3 to 5 (20%, 39%, 50%), at most 50%; a near-zero-variance epoch inside the window = The Astral Weave; from cycle 4 on, stillness outside the window = light sleep; Spell Mastery = min(100, Weave minutes ÷ (0.22 × sleep goal in minutes) × 100)',src:['peever2017','brooks2012','jones2005','buzsaki2002','scammell2017'],
   bio:[
    {t:'Motor atonia: the body is held still',s:'In REM sleep the skeletal muscles are paralysed by active inhibition: a GABA and glycine drive switches off motor neurons. This is why a still phone is used as the stand-in for REM.',src:'brooks2012',abs:'In rats, a powerful GABA and glycine drive triggers REM paralysis by switching off motor neurons, through GABA(B) and GABA(A)/glycine receptors.',full:'Brooks and Peever\'s Discussion says REM paralysis can also be started by REM-on glutamate neurons in the sublaterodorsal nucleus (SLD) region, which act indirectly by activating GABA/glycine interneurons that inhibit motor neurons. Scammell and colleagues (2017, Figure 5) say glutamatergic SLD neurons produce the muscle paralysis of REM sleep by exciting GABAergic/glycinergic neurons in the ventromedial medulla and spinal cord that hyperpolarize motor neurons.',more:'Both papers say how the SLD produces atonia, and how it relays to the motor neurons, is still debated.'},
    {t:'Cortical activation: the mind is awake-like',s:'Acetylcholine neurons fire at high rates in REM sleep, with fast, awake-like cortical activity.',src:'jones2005',abs:'ACh-containing neurons fire at high rates in paradoxical (REM) sleep in association with fast cortical activity.',full:'Scammell and colleagues (2017, Figure 5) name the source: cholinergic neurons of the pedunculopontine and laterodorsal tegmental nuclei (PPT and LDT) also promote REM sleep and may help drive the fast EEG activity typical of REM sleep. The "may" is theirs.',more:'Jones 2005 was read as an abstract only.'},
    {t:'Theta rhythm: the hippocampus is "on-line"',s:'The hippocampal theta rhythm is linked to timing neuron ensembles and changing synaptic weights, the kind of change that memory consolidation needs. In rodents REM sleep has abundant theta; in people the REM EEG shows only a modest amount.',src:'buzsaki2002',abs:'Theta oscillations represent the on-line state of the hippocampus and are believed critical for temporal coding of neuronal ensembles and modification of synaptic weights.',full:'Scammell and colleagues (2017) say that in rodents the cortical EEG during REM sleep shows abundant theta arising from the dorsal hippocampus, that in humans the REM EEG is low-amplitude and fast, like waking, with a modest amount of theta, and that cholinergic neurons of the medial septum innervate the dorsal hippocampus and help drive theta.',more:'Buzsáki 2002 was read as an abstract only, so the theta frequency range and the medial septum as the essential pacemaker are not confirmed here. REM memory consolidation is a possible function, not a settled one (Peever and Fuller, 2017).'}],
   app:'REM sleep is identified in a sleep laboratory from brain waves, eye movements and loss of muscle tone. A phone on a mattress sees none of these, so HealthWiz does not detect REM: it guesses when REM is likely from the time of night (REM periods are short early in the night and longer toward morning) and keeps the guess only when the phone was still, as a stand-in for muscle atonia. The cycle length, the window shares, the 22% target and Spell Mastery are HealthWiz\'s own game rules. Peever and Fuller (2017) is the overview of REM biology and its possible functions; the papers above are the sources for the mechanisms.'},
  {id:'sleep',topic:'food',name:'Recommended sleep range',v:'sleep',f:'range by age: 9–12 h (under 13), 8–10 h (13–17), 7–9 h (18–64), 7–8 h (65+)',src:['aasm','aasmkids','nsf'],app:'9–12 h under 13 and 8–10 h for 13–17 are the AASM ranges for 6–12 and 13–18 year olds (younger children need more). The 7–9 h (18–64) and 7–8 h (65+) ranges are the National Sleep Foundation\'s: the AASM adult statement says 7 or more hours with no upper limit and no older-adult range. Used as the sleep target and in the Laboratory\'s sleep question.'},
  {id:'fv',topic:'food',name:'Fruit and vegetable portions',v:'score',f:'portions = grams of fruit and vegetable dishes ÷ 80 g; target 5 a day (400 g)',src:['whofv','whodiet'],app:'Menu dishes are counted by their category; a serving without a weight counts as one portion.'},
  {id:'stairkcal',topic:'heart',name:'Stair workout energy',v:'pulse',f:'A: MET × (BMR ÷ 1440) × minutes; B: Keytel kJ/min from heart rate ÷ 4.184 × minutes; estimate = their mean',src:['compwalk','mifflin','keytel','nistcal'],app:'The MET is scaled by your own BMR; the two methods are averaged.'},
  {id:'peak',topic:'heart',name:'Peak heart rate vs an estimated maximum',v:'pulse',f:'share = peak ÷ (220 − age) × 100',src:['tanaka'],app:'220 − age is kept because it is taught in class; Tanaka\'s 208 − 0.7 × age is shown beside it.'},
  {id:'run',topic:'heart',name:'Run calories',v:'run',f:'kcal = MET (from speed) × kg × hours',src:['comprun','compwalk','compendium'],app:'Walking table under 6 km/h; MET stops at 14.8 above 16.1 km/h.'},
  {id:'train',topic:'heart',name:'Training Hall calories',v:'exercise',f:'kcal = MET × kg × hours',src:['compcond'],app:'Each goal is matched to one Compendium entry.'},
  {id:'score',topic:'heart',name:'Health Score weights',v:'score',f:'score = Σ (weight × sub-score) ÷ Σ weights of the areas with data',src:['whopa','acsm','whofv','mifflin','aasm','aasmkids','cdcbmi','lovibond95','henry05','f21'],app:'The weights (25, 25, 15, 15, 10, 10) are the team\'s reasoned judgement, not a validated clinical formula.'},
  {id:'project',topic:'project',name:'Our project\'s VO₂ and energy',v:'pulse',f:'VO₂ = 15.3 × pulse after ÷ pulse before; energy = VO₂ (L/min) × minutes × 20.1 kJ/L',src:['f21','uth','mcardle','weir','nistcal'],app:'An estimated VO₂max (the pulse after is taken as the maximum). Shown as not valid when the pulse after is below the pulse before.'},
  {id:'nutrients',topic:'food',name:'Menu food calories and estimated macros',v:'food',f:'kcal = the menu\'s kcal per portion × portions; protein g = kcal × protein share ÷ 4; carbohydrate g = kcal × carbohydrate share ÷ 4; fat g = kcal × fat share ÷ 9 (shares set by dish type)',src:['fao77','myfcd'],app:'The calories are the college menu list\'s and the macro shares per dish type are HealthWiz\'s own estimates; they are not taken from MyFCD, which is listed so a dish can be looked up and compared. The 4, 4 and 9 kcal per gram are the Atwater general factors.'},
  {id:'ppg',topic:'heart',name:'Camera pulse (photoplethysmography)',v:'stair',f:'BPM = 60 ÷ median time between beats (s); beats are the peaks of the fingertip\'s red brightness after a 0.7–3.5 Hz filter',src:['allen'],app:'The filter band, peak rule and quality checks are HealthWiz\'s own and are not validated here; the review explains the principle only. An estimate, never a medical measurement.'},
  {id:'recovery',topic:'heart',name:'Heart-rate recovery',v:'stair',f:'1-minute recovery = pulse just after the climb − pulse 1 minute later (BPM)',src:['cole'],app:'Shown as a number and compared with your earlier workouts. Cole et al.\'s 12 BPM cut-off was for patients after a maximal treadmill test, so HealthWiz gives no rating from it.'},
  {id:'stairways',topic:'project',name:'Measured stairways and angle bands',v:'stair',f:'tan θ = rise ÷ run; mild < 26°, moderate 26–31.2°, vigorous > 31.2°',src:['f21'],app:'Fixed bands, so a stairway keeps its label when more are added.'},
  {id:'lab',topic:'project',name:'The Laboratory\'s Group 14 sample and Evidence Trial',v:'lab',f:'pulse rate = average count × 60 ÷ 180; f = PR ÷ 60; T = 1 ÷ f; ω = 2πf',src:['f21'],app:'Participants are shown as P1–P6; every value is worked out from the report\'s raw counts.'},
  {id:'gravity',topic:'physics',name:'Stair Sense: work and power',v:'stair',f:'W = m × g × h; P = W ÷ t',src:['nistg','nistcal'],app:'Work against gravity only: not the energy the body uses.'}];
const TOPICS=[['mind','Mind & stress','mind'],['body','Body & energy','balance'],['heart','Heart & activity','pulse'],['food','Food, water & sleep','food'],['project','Our project','flask'],['physics','Physics & units','gear']];
const Z={open:null,q:'',ret:null,calc:null,bad:null,back:null,flash:0};
const ico=(n,s)=>HWPixel.icon(n,s||1);
const usedBy=id=>CALCS.filter(c=>c.src.includes(id));
const topicOf=id=>{const u=usedBy(id);return u.length?u[0].topic:'physics'};
const match=(r,q)=>!q||(r.t+' '+r.by+' '+r.s+' '+usedBy(r.id).map(c=>c.name).join(' ')).toLowerCase().includes(q.toLowerCase());
const NAMES={food:'Food',body:'Body & Energy',sleep:'Sleep',score:'Health Score',pulse:'Stairs workout',run:'Running Road',exercise:'Training Hall',stair:'Stairs',lab:'Science Laboratory'};
function book(r){const on=Z.open===r.id;
  return '<button type="button" class="vbk'+(on?' on':'')+' k-'+r.k+'" data-a="vopen" data-id="'+r.id+'" aria-expanded="'+on+'"><b>'+esc(r.t)+'</b><small>'+esc(r.by.split(',')[0])+' · '+esc(String(r.d).slice(0,4))+'</small></button>'}
function chain(r){const U=usedBy(r.id);
  return '<div class="vch" id="vch" tabindex="-1" aria-label="'+esc(r.t)+'">'
    +'<div class="vst"><span class="vno">1</span><div><b class="vh">THE SOURCE</b><ul class="hwx-src">'+HWSources.cite(r.id)+'</ul></div></div>'
    +'<div class="vst"><span class="vno">2</span><div><b class="vh">WHAT THE SOURCE SUPPORTS</b><p>'+esc(r.s)+'</p></div></div>'
    +'<div class="vst"><span class="vno">3</span><div><b class="vh">HOW HEALTHWIZ USES IT</b><span class="pxtag">HEALTHWIZ\'S OWN WORK</span>'
    +(U.length?U.map(c=>'<div class="vuse"><b>'+esc(c.name)+'</b><pre class="hwx-f">'+esc(c.f)+'</pre><small><i>HealthWiz\'s own choices:</i> '+esc(c.app)+'</small>'
      +'<button type="button" class="g sm" data-a="vgo" data-v="'+c.v+'">WHERE YOU SEE IT: '+esc(NAMES[c.v]||c.v).toUpperCase()+'</button></div>').join(''):'<p class="mut">Listed for reference.</p>')+'</div></div>'
    +'<div class="vst"><span class="vno">4</span><div><b class="vh">HOW IT WAS CHECKED</b><p>'+esc(r.c)+'</p>'+(r.x?'<p><i>Limits:</i> '+esc(r.x)+'</p>':'')+'</div></div></div>'}
const has=id=>CALCS.some(c=>c.id===id),nameOf=id=>(CALCS.find(c=>c.id===id)||{name:id}).name;
const cmatch=(c,q)=>!q||(c.name+' '+c.f).toLowerCase().includes(q.toLowerCase());
/** One calculation: the formula as the app runs it, HealthWiz's own choices, every source it rests on, and where the result is shown.
    The card opened from a "?" is open, outlined with a text tag (not colour alone) and focused. */
function calcCard(c){const on=Z.calc===c.id;
  return '<details class="vcc'+(on?' vtarget'+(Z.flash?' vflash':''):'')+'" id="vc-'+c.id+'"'+(on?' open':'')+'><summary><b>'+esc(c.name)+'</b>'+(on?' <span class="pxtag">OPENED FROM THE ? BUTTON</span>':'')+'</summary>'
    +'<b class="vh">FORMULA (AS THE APP RUNS IT)</b><pre class="hwx-f">'+esc(c.f)+'</pre>'
    +'<small><span class="pxtag">HEALTHWIZ\'S OWN WORK</span> <i>HealthWiz\'s own choices:</i> '+esc(c.app)+'</small>'
    +(c.bio?'<b class="vh">THE BIOLOGY BEHIND THE NAME</b><span class="pxtag">CHECKED AGAINST PUBMED ABSTRACTS AND TWO FULL TEXTS, 2026-10-31</span><ul class="hwx-src">'+c.bio.map(m=>'<li class="hwsrc"><b>'+esc(m.t)+'</b><br>'+esc(m.s)+'<small><i>The paper shows:</i> '+esc(m.abs)+' ('+esc((HWSources.get(m.src)||{by:m.src}).by.split(',')[0])+', '+esc((HWSources.get(m.src)||{d:''}).d)+')</small>'+(m.full?'<small><i>From the full texts (read 2026-10-31):</i> '+esc(m.full)+'</small>':'')+'<small class="mut"><i>'+(m.full?'Still open:':'More detail (standard, not in that abstract):')+'</i> '+esc(m.more)+'</small></li>').join('')+'</ul>':'')
    +'<b class="vh">SOURCES</b><ul class="hwx-src">'+c.src.map(HWSources.cite).join('')+'</ul>'
    +'<div class="row">'+c.src.map(id=>'<button type="button" class="chip sm" data-a="vopen" data-id="'+id+'">'+esc((HWSources.get(id)||{t:id}).t.split(':')[0].slice(0,42))+'</button>').join('')+'</div>'
    +'<button type="button" class="g sm" data-a="vgo" data-v="'+c.v+'">WHERE YOU SEE IT: '+esc(NAMES[c.v]||c.v).toUpperCase()+'</button></details>'}
function shelf(){const all=HWSources.all().filter(r=>match(r,Z.q)),o=Z.open&&HWSources.get(Z.open)?Object.assign({id:Z.open},HWSources.get(Z.open)):null;
  const cs=CALCS.filter(c=>cmatch(c,Z.q));
  return '<div class="card vault"><h3>'+ico('scroll')+' THE EVIDENCE VAULT</h3><p>Every source behind a number in HealthWiz, with what it supports and how the app uses it. Open a book to follow the chain, or open a calculation to see its formula and sources.</p>'
    +(Z.back?'<button type="button" class="g sm vbackto" data-a="vbackto">◀ BACK TO '+esc(NAMES[Z.back.v]||Z.back.v).toUpperCase()+'</button>':'')
    +(Z.bad?'<p class="warn" id="vwarn" role="alert" tabindex="-1">That Evidence Vault entry ("'+esc(Z.bad)+'") was not found. It may have been renamed or removed. You can search or browse everything below.</p>':'')
    +'<label for="vq"><b>Search the Vault</b></label><input id="vq" type="search" autocomplete="off" value="'+esc(Z.q)+'" aria-describedby="vqx"><small class="mut" id="vqx">Example: sleep, BMI, oxygen</small>'
    +(o?chain(o)+'<div class="row"><button type="button" class="g sm" data-a="vclose">CLOSE THE BOOK</button></div>':'')
    +TOPICS.map(t=>{const B=all.filter(r=>topicOf(r.id)===t[0]);return B.length?'<h4 class="vshelf">'+ico(t[2])+' '+t[1].toUpperCase()+' <small>('+B.length+')</small></h4><div class="vrow">'+B.map(book).join('')+'</div>':''}).join('')
    +(all.length||cs.length?'':'<p class="mut">No source or calculation matches that word yet.</p>')
    +'<details class="vcalc"'+(Z.calc||Z.q?' open':'')+'><summary><b>Browse by calculation ('+cs.length+')</b></summary>'+cs.map(calcCard).join('')+'</details>'
    +'<small class="mut">Sources are kept to primary research, official bodies and recognised organisations; no Wikipedia. A source is listed only after it was opened and seen to support its claim.</small></div>'}
HWLab.section('vault',{name:'Evidence Vault',icon:'scroll',render:shelf});
acts.vopen=d=>{if(!HWSources.get(d.id))return;Z.open=d.id;render();const c=document.getElementById('vch');if(c){c.scrollIntoView&&c.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'});c.focus({preventScroll:true})}};
acts.vclose=()=>{const id=Z.open;Z.open=null;render();const b=document.querySelector('[data-a="vopen"][data-id="'+id+'"]');if(b)b.focus()};
acts.vgo=d=>{Z.ret={v:d.v==='stair'||d.v==='pulse'?'campus':d.v};go(d.v)}; // the Stairs routes open the Campus page
/** Open the Vault on one calculation (called by the "?" links and by #vault=<id>). `from` = the page to offer a way back to. */
function openCalc(id,from){if(from==='campus')from='stair'; // a "?" on the Campus page is one in its Stairs section
  const ok=has(id);Z.q='';Z.open=null;Z.calc=ok?id:null;Z.bad=ok?null:id;Z.flash=1;
  if(from&&from!=='lab')Z.back={v:from};
  HWLab.Z().tab='vault';try{history.replaceState(null,'','#vault='+encodeURIComponent(id))}catch(e){}
  if(S.v!=='lab')go('lab');else render();
  requestAnimationFrame(()=>{const el=document.getElementById(ok?'vc-'+id:'vwarn');Z.flash=0;
    if(el){el.scrollIntoView&&el.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'});const f=el.querySelector('summary')||el;try{f.focus({preventScroll:true})}catch(e){}}})}
acts.vbackto=()=>{const b=Z.back;Z.back=null;Z.calc=null;if(b)go(b.v)};
const hashId=()=>{const m=/^#vault=([A-Za-z0-9_-]+)$/.exec(location.hash||'');return m?m[1]:null};
const applyHash=()=>{const id=hashId();if(id&&S.v!=='onb'&&!(S.v==='welcome'&&typeof needOnb==='function'&&needOnb()))openCalc(id)};
addEventListener('hashchange',applyHash);
if(document.readyState==='complete')setTimeout(applyHash,0);else addEventListener('load',()=>setTimeout(applyHash,0));
acts.vback=()=>{Z.ret=null;HWLab.Z().tab='vault';go('lab')};
document.addEventListener('input',e=>{if(e.target&&e.target.id==='vq'){Z.q=e.target.value;const pos=e.target.selectionStart;render();const i=document.getElementById('vq');if(i){i.focus();try{i.setSelectionRange(pos,pos)}catch(x){}}}});
// "BACK TO THE VAULT" on the page reached from a book; it goes once the user moves on elsewhere
{const r=render;render=function(){const x=r.apply(this,arguments);try{if(Z.ret&&S.v===Z.ret.v){const m=document.querySelector('#main .pg');if(m&&!m.querySelector('.vret'))m.insertAdjacentHTML('afterbegin','<button type="button" class="g sm vret" data-a="vback">◀ BACK TO THE EVIDENCE VAULT</button>')}}catch(e){}return x}}
HWEvents.on('page:viewed',e=>{if(Z.ret&&e.view!==Z.ret.v&&e.view!=='lab')Z.ret=null;
  if(e.view!=='lab'&&(!Z.back||e.view!==Z.back.v))Z.back=null;
  if(e.view!=='lab'&&hashId())try{history.replaceState(null,'',location.pathname+location.search)}catch(x){}});
HWUI.css('vault',`
.vault input{width:100%;min-height:44px;box-sizing:border-box;margin:4px 0 2px}.vshelf{font:12px/1.6 var(--fl);margin:14px 0 6px;display:flex;gap:6px;align-items:center}
.vrow{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 10px;border-bottom:6px solid #6b4423;box-shadow:0 3px 0 #47301a}
.vbk{flex:0 0 132px;min-height:96px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;padding:8px;border:3px solid var(--ln);background:var(--c,#3d4396);color:#fff;text-transform:none;letter-spacing:0}
.vbk b{font:12px/1.35 var(--fb);font-weight:700;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.vbk b,.vbk small{color:#fff}.vbk small{font:12px/1.3 var(--fb);color:#efe8ff}
.vbk.k-method{--c:#3d4396}.vbk.k-reference{--c:#2a6f8f}.vbk.k-guideline{--c:#2f7a45}.vbk.k-constant{--c:#5a4a2a}.vbk.k-data{--c:#6b3f8f}.vbk.k-project{--c:#8a3a4a}
.vbk.on{outline:4px solid var(--gold);outline-offset:-2px}
.vch{margin:12px 0;padding:10px;border:4px solid var(--ln);background:var(--p2);box-shadow:4px 4px 0 var(--ln);animation:vopen .4s steps(4)}
@keyframes vopen{from{transform:scaleX(.2);opacity:0}}.vst{display:flex;gap:10px;margin:8px 0}.vst>div{min-width:0;flex:1 1 auto}
.vno{flex:0 0 28px;height:28px;display:grid;place-items:center;font:16px var(--fl);background:var(--gold);color:#1b1626;border:3px solid var(--ln)}
.vh{display:block;font:12px/1.6 var(--fl);color:var(--vio);margin-bottom:4px}.vst p{margin:0 0 6px}
.vuse{border-top:2px solid var(--ln);padding:8px 0}.vuse>b{display:block}.vuse small{display:block;margin:4px 0}.vuse button{min-height:44px;margin-top:4px}
.vcalc summary{min-height:44px;display:flex;align-items:center;cursor:pointer}.vcalc .chip{text-transform:none;letter-spacing:0;font:12px var(--fb)}
.vret,.vbackto{margin:0 0 10px;min-height:44px}
.vcc{border-top:2px solid var(--ln);padding:2px 0;scroll-margin-top:80px}.vcc summary{min-height:44px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;cursor:pointer}.vcc summary:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.vcc .hwx-f{margin:6px 0}.vcc small{display:block;margin:4px 0}.vcc>button{min-height:44px;margin-top:6px}
.vtarget{border:4px dashed var(--gold);padding:4px 8px;background:var(--p2)}
.vflash{animation:vflash 2.4s ease-out 1}@keyframes vflash{0%,40%{box-shadow:0 0 0 6px var(--gold)}100%{box-shadow:0 0 0 0 transparent}}
#vwarn:focus{outline:3px solid var(--gold)}
@media(prefers-reduced-motion:reduce){.vch,.vflash{animation:none}}
`);
return{CALCS,TOPICS,usedBy,has,name:nameOf,openCalc,Z:()=>Z}})();
