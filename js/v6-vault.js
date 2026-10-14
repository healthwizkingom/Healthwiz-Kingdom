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
   IT" shows a "BACK TO THE VAULT" button. */
const HWVault=(()=>{
// where each source is used: name, route, the formula as the app runs it, sources, HealthWiz's own choices (not the source's)
const CALCS=[
  {id:'bmi',topic:'body',name:'Body mass index',v:'body',f:'BMI = weight (kg) ÷ height (m)²',src:['cdcbmi','asianbmi'],app:'Adult category from 18 (CDC uses 20+); Asian action points shown as extra information only.'},
  {id:'energy',topic:'body',name:'Daily energy goal (BMR, TDEE)',v:'body',f:'BMR = 10 × kg + 6.25 × cm − 5 × age + 5 (male) or − 161 (female); TDEE = BMR × activity factor',src:['mifflin'],app:'Activity factors 1.2–1.9 and the surplus or deficit rules are HealthWiz\'s own (no verified source yet).'},
  {id:'macro',topic:'body',name:'Protein, carbohydrate, fat and fiber goals',v:'body',f:'protein = min(p × kg, share × kcal ÷ 4); fat = 30% of kcal ÷ 9; carbs = the rest ÷ 4; fiber = 14 g per 1,000 kcal',src:['iomdri','whodiet'],app:'Fat set at 30% of energy; protein 1.1 g/kg during a deficit is HealthWiz\'s choice. Table values still to be checked against the report.'},
  {id:'foodguess',topic:'food',name:'Add More Food: the Wizard\'s web estimate',v:'food',f:'total = the sum of the parts he finds; check on each part: kcal ≈ 4 × protein + 4 × carbohydrate + 9 × fat (flagged when more than 25 kcal and 25% off)',src:['fao77'],app:'The parts, their weights and their numbers come from web pages Google Gemini found (each part names its source and shows its arithmetic; the pages are listed on the card). It is an AI estimate, not a measurement, and can be wrong. The energy check uses the Atwater general factors.'},
  {id:'water',topic:'food',name:'Water goal',v:'body',f:'water = 35 mL × kg (+ 300 or 500 mL when very active), kept within 1,500–3,500 mL',src:['efsawater'],app:'35 mL per kg is HealthWiz\'s rule of thumb; EFSA is shown for comparison.'},
  {id:'sleep',topic:'food',name:'Recommended sleep range',v:'sleep',f:'range by age: 9–12 h (under 13), 8–10 h (13–17), 7–9 h (18–64), 7–8 h (65+)',src:['aasm','aasmkids'],app:'The ranges are used as the sleep target and in the Laboratory\'s sleep question.'},
  {id:'fv',topic:'food',name:'Fruit and vegetable portions',v:'score',f:'portions = grams of fruit and vegetable dishes ÷ 80 g; target 5 a day (400 g)',src:['whofv','whodiet'],app:'Menu dishes are counted by their category; a serving without a weight counts as one portion.'},
  {id:'stairkcal',topic:'heart',name:'Stair workout energy',v:'pulse',f:'A: MET × (BMR ÷ 1440) × minutes; B: Keytel kJ/min from heart rate ÷ 4.184 × minutes; estimate = their mean',src:['compwalk','mifflin','keytel','nistcal'],app:'The MET is scaled by your own BMR; the two methods are averaged.'},
  {id:'peak',topic:'heart',name:'Peak heart rate vs an estimated maximum',v:'pulse',f:'share = peak ÷ (220 − age) × 100',src:['tanaka'],app:'220 − age is kept because it is taught in class; Tanaka\'s 208 − 0.7 × age is shown beside it.'},
  {id:'run',topic:'heart',name:'Run calories',v:'run',f:'kcal = MET (from speed) × kg × hours',src:['comprun','compwalk','compendium'],app:'Walking table under 6 km/h; MET stops at 14.8 above 16.1 km/h.'},
  {id:'train',topic:'heart',name:'Training Hall calories',v:'exercise',f:'kcal = MET × kg × hours',src:['compcond'],app:'Each goal is matched to one Compendium entry.'},
  {id:'score',topic:'heart',name:'Health Score weights',v:'score',f:'score = Σ (weight × sub-score) ÷ Σ weights of the areas with data',src:['whopa','acsm','whofv','mifflin','aasm','aasmkids','cdcbmi','cohen','f21'],app:'The weights (25, 25, 15, 15, 10, 10) are the team\'s reasoned judgement, not a validated clinical formula.'},
  {id:'project',topic:'project',name:'Our project\'s VO₂ and energy',v:'pulse',f:'VO₂ = 15.3 × pulse after ÷ pulse before; energy = VO₂ (L/min) × minutes × 20.1 kJ/L',src:['f21','uth','mcardle','weir','nistcal'],app:'An estimated VO₂max (the pulse after is taken as the maximum). Shown as not valid when the pulse after is below the pulse before.'},
  {id:'stairways',topic:'project',name:'Measured stairways and angle bands',v:'stair',f:'tan θ = rise ÷ run; mild < 26°, moderate 26–31.2°, vigorous > 31.2°',src:['f21'],app:'Fixed bands, so a stairway keeps its label when more are added.'},
  {id:'lab',topic:'project',name:'The Laboratory\'s Group 14 sample and Evidence Trial',v:'lab',f:'pulse rate = average count × 60 ÷ 180; f = PR ÷ 60; T = 1 ÷ f; ω = 2πf',src:['f21'],app:'Participants are shown as P1–P6; every value is worked out from the report\'s raw counts.'},
  {id:'gravity',topic:'physics',name:'Stair Sense: work and power',v:'stair',f:'W = m × g × h; P = W ÷ t',src:['nistg','nistcal'],app:'Work against gravity only: not the energy the body uses.'}];
const TOPICS=[['body','Body & energy','balance'],['heart','Heart & activity','pulse'],['food','Food, water & sleep','food'],['project','Our project','flask'],['physics','Physics & units','gear']];
const Z={open:null,q:'',ret:null};
const ico=(n,s)=>HWPixel.icon(n,s||1);
const usedBy=id=>CALCS.filter(c=>c.src.includes(id));
const topicOf=id=>{const u=usedBy(id);return u.length?u[0].topic:'physics'};
const match=(r,q)=>!q||(r.t+' '+r.by+' '+r.s+' '+usedBy(r.id).map(c=>c.name).join(' ')).toLowerCase().includes(q.toLowerCase());
const NAMES={body:'Body & Energy',sleep:'Sleep',score:'Health Score',pulse:'Stairs workout',run:'Running Road',exercise:'Training Hall',stair:'Stairs',lab:'Science Laboratory'};
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
function shelf(){const all=HWSources.all().filter(r=>match(r,Z.q)),o=Z.open&&HWSources.get(Z.open)?Object.assign({id:Z.open},HWSources.get(Z.open)):null;
  return '<div class="card vault"><h3>'+ico('scroll')+' THE EVIDENCE VAULT</h3><p>Every source behind a number in HealthWiz, with what it supports and how the app uses it. Open a book to follow the chain.</p>'
    +'<label for="vq"><b>Search the Vault</b></label><input id="vq" type="search" autocomplete="off" value="'+esc(Z.q)+'" aria-describedby="vqx"><small class="mut" id="vqx">Example: sleep, BMI, oxygen</small>'
    +(o?chain(o)+'<div class="row"><button type="button" class="g sm" data-a="vclose">CLOSE THE BOOK</button></div>':'')
    +TOPICS.map(t=>{const B=all.filter(r=>topicOf(r.id)===t[0]);return B.length?'<h4 class="vshelf">'+ico(t[2])+' '+t[1].toUpperCase()+' <small>('+B.length+')</small></h4><div class="vrow">'+B.map(book).join('')+'</div>':''}).join('')
    +(all.length?'':'<p class="mut">No source matches that word yet.</p>')
    +'<details class="vcalc"><summary><b>Browse by calculation</b></summary>'+CALCS.map(c=>'<div class="vuse"><b>'+esc(c.name)+'</b><div class="row">'+c.src.map(id=>'<button type="button" class="chip sm" data-a="vopen" data-id="'+id+'">'+esc((HWSources.get(id)||{t:id}).t.split(':')[0].slice(0,42))+'</button>').join('')+'</div></div>').join('')+'</details>'
    +'<small class="mut">Sources are kept to primary research, official bodies and recognised organisations; no Wikipedia. A source is listed only after it was opened and seen to support its claim.</small></div>'}
HWLab.section('vault',{name:'Evidence Vault',icon:'scroll',render:shelf});
acts.vopen=d=>{if(!HWSources.get(d.id))return;Z.open=d.id;render();const c=document.getElementById('vch');if(c){c.scrollIntoView&&c.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'});c.focus({preventScroll:true})}};
acts.vclose=()=>{const id=Z.open;Z.open=null;render();const b=document.querySelector('[data-a="vopen"][data-id="'+id+'"]');if(b)b.focus()};
acts.vgo=d=>{Z.ret={v:d.v};go(d.v)};
acts.vback=()=>{Z.ret=null;HWLab.Z().tab='vault';go('lab')};
document.addEventListener('input',e=>{if(e.target&&e.target.id==='vq'){Z.q=e.target.value;const pos=e.target.selectionStart;render();const i=document.getElementById('vq');if(i){i.focus();try{i.setSelectionRange(pos,pos)}catch(x){}}}});
// "BACK TO THE VAULT" on the page reached from a book; it goes once the user moves on elsewhere
{const r=render;render=function(){const x=r.apply(this,arguments);try{if(Z.ret&&S.v===Z.ret.v){const m=document.querySelector('#main .pg');if(m&&!m.querySelector('.vret'))m.insertAdjacentHTML('afterbegin','<button type="button" class="g sm vret" data-a="vback">◀ BACK TO THE EVIDENCE VAULT</button>')}}catch(e){}return x}}
HWEvents.on('page:viewed',e=>{if(Z.ret&&e.view!==Z.ret.v&&e.view!=='lab')Z.ret=null});
HWUI.css('vault',`
.vault input{width:100%;min-height:44px;box-sizing:border-box;margin:4px 0 2px}.vshelf{font:8px/1.6 var(--fh);margin:14px 0 6px;display:flex;gap:6px;align-items:center}
.vrow{display:flex;gap:6px;overflow-x:auto;padding:4px 2px 10px;border-bottom:6px solid #6b4423;box-shadow:0 3px 0 #47301a}
.vbk{flex:0 0 132px;min-height:96px;display:flex;flex-direction:column;justify-content:space-between;text-align:left;padding:8px;border:3px solid var(--ln);background:var(--c,#3d4396);color:#fff;text-transform:none;letter-spacing:0}
.vbk b{font:12px/1.35 var(--fb);font-weight:700;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}.vbk b,.vbk small{color:#fff}.vbk small{font:11px/1.3 var(--fb);color:#efe8ff}
.vbk.k-method{--c:#3d4396}.vbk.k-reference{--c:#2a6f8f}.vbk.k-guideline{--c:#2f7a45}.vbk.k-constant{--c:#5a4a2a}.vbk.k-data{--c:#6b3f8f}.vbk.k-project{--c:#8a3a4a}
.vbk.on{outline:4px solid var(--gold);outline-offset:-2px}
.vch{margin:12px 0;padding:10px;border:4px solid var(--ln);background:var(--p2);box-shadow:4px 4px 0 var(--ln);animation:vopen .4s steps(4)}
@keyframes vopen{from{transform:scaleX(.2);opacity:0}}.vst{display:flex;gap:10px;margin:8px 0}.vst>div{min-width:0;flex:1 1 auto}
.vno{flex:0 0 28px;height:28px;display:grid;place-items:center;font:10px var(--fh);background:var(--gold);color:#1b1626;border:3px solid var(--ln)}
.vh{display:block;font:8px/1.6 var(--fh);color:var(--vio);margin-bottom:4px}.vst p{margin:0 0 6px}
.vuse{border-top:2px solid var(--ln);padding:8px 0}.vuse>b{display:block}.vuse small{display:block;margin:4px 0}.vuse button{min-height:44px;margin-top:4px}
.vcalc summary{min-height:44px;display:flex;align-items:center;cursor:pointer}.vcalc .chip{text-transform:none;letter-spacing:0;font:12px var(--fb)}
.vret{margin:0 0 10px;min-height:44px}
@media(prefers-reduced-motion:reduce){.vch{animation:none}}
`);
return{CALCS,TOPICS,usedBy,Z:()=>Z}})();
