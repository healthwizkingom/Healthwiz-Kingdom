/* v6: source records and the shared calculation explanation ("?") for every number HealthWiz works out. Not part of the original.
   Master prompt: universal "?" explanation + Evidence Vault. One record per source; every "?" that explains a calculation cites
   these records by id instead of repeating a reference, so the Evidence Vault (later stage) reads the same list.

   A record: t title · by authors / organisation · in journal or publisher · d date · u direct link (DOI or official page)
   · k kind: 'method' (how a number is worked out) | 'reference' (a reference value or cut-off) | 'guideline' | 'constant' | 'data'
     | 'project' (the team's own report: not online, so u is empty and the panel shows the title without a link)
   · s what HealthWiz uses it for (the claim it supports) · c how it was checked, and when · x optional caution.
   Checked in this repository on 2026-10-13: PubMed records (title, authors, journal, DOI, abstract) and the official pages.
   A source is only listed after it was opened and seen to support its claim; where only part could be confirmed, `c` says
   which part. No Wikipedia. Never add a record from memory: open the source first.

   HWExplain.html(spec) → the panel body; HWExplain.btn(key, title, spec) → a "?" button (js/v6-help.js) that opens it.
   spec = {ev (Evidence Vault calculation id), what, inputs:[{n, v, u, o}], formula, vars:[[symbol, meaning, unit]], steps:[text], result, src:[ids], app, limits:[text]}
   o (where an input comes from): 'you' entered by you · 'device' measured by a device · 'calc' worked out by HealthWiz
   · 'est' estimate · 'default' app default · 'service' from an online service · 'missing'. Numbers in steps are the actual
   inputs, so the worked example is the user's own calculation. Text in spec is trusted markup: escape anything user-typed. */
const HWSources=(()=>{
const S={
mifflin:{t:'A new predictive equation for resting energy expenditure in healthy individuals',by:'Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO',in:'American Journal of Clinical Nutrition 51(2):241–247',d:'1990',u:'https://doi.org/10.1093/ajcn/51.2.241',k:'method',
  s:'Resting energy (BMR): men 10 × weight (kg) + 6.25 × height (cm) − 5 × age (y) + 5; women the same − 161.',c:'PubMed 2305711: the abstract gives these simplified equations, derived from 498 healthy adults aged 19–78.',x:'Derived in adults; not validated for under-19s.'},
keytel:{t:'Prediction of energy expenditure from heart rate monitoring during submaximal exercise',by:'Keytel LR, Goedecke JH, Noakes TD, et al.',in:'Journal of Sports Sciences 23(3):289–297',d:'2005',u:'https://doi.org/10.1080/02640410470001730089',k:'method',
  s:'Energy use (kJ/min) from heart rate, weight, age and sex, with the model that needs no VO₂max.',c:'PubMed 15966347: the abstract describes the model without VO₂max (r = 0.857, 115 exercising adults aged 18–45). The coefficients themselves are in the full text, not the abstract.',x:'Steady exercise at 57–90% of maximal heart rate, adults 18–45.'},
uth:{t:'Estimation of VO₂max from the ratio between HRmax and HRrest — the Heart Rate Ratio Method',by:'Uth N, Sørensen H, Overgaard K, Pedersen PK',in:'European Journal of Applied Physiology 91(1):111–115',d:'2004',u:'https://doi.org/10.1007/s00421-003-0988-y',k:'method',
  s:'VO₂max (mL/kg/min) ≈ 15.3 × HRmax ÷ HRrest.',c:'PubMed 14624296: the abstract gives the factor 15.3 (0.7), found in well-trained men aged 21–51, with HRmax measured in a maximal test.',x:'Validated for VO₂max in well-trained men using a true maximal heart rate, not for an after-exercise pulse.'},
compendium:{t:'2024 Adult Compendium of Physical Activities: a third update of the energy costs of human activities',by:'Herrmann SD, Willis EA, Ainsworth BE, et al.',in:'Journal of Sport and Health Science 13(1):6–12',d:'2024',u:'https://doi.org/10.1016/j.jshs.2023.10.010',k:'reference',
  s:'MET values for activities (1 MET = energy at rest).',c:'PubMed 38242596; MET tables at pacompendium.com, read 2026-10-13.',x:'Tailored to adults 19–59 years.'},
compwalk:{t:'2024 Adult Compendium: Walking (stair climbing and walking entries)',by:'Adult Compendium of Physical Activities',in:'pacompendium.com',d:'2024',u:'https://pacompendium.com/walking/',k:'data',
  s:'Stair climbing: 17133 slow pace 4.5 MET, 17131 general 6.8, 17134 fast pace 9.3. Walking: 17151 under 2.0 mph 2.3, 17152 2.0–2.4 mph 2.8, 17170 2.5 mph 3.0, 17190 2.8–3.4 mph 3.8, 17200 3.5–3.9 mph 4.8.',c:'Table read on 2026-10-13.'},
comprun:{t:'2024 Adult Compendium: Running',by:'Adult Compendium of Physical Activities',in:'pacompendium.com',d:'2024',u:'https://pacompendium.com/running/',k:'data',
  s:'Running by speed: 12028 4–4.2 mph 6.5 MET, 12029 4.3–4.8 mph 7.8, 12030 5.0–5.2 mph 8.5, 12045 5.5–5.8 mph 9.0, 12050 6–6.3 mph 9.3, 12060 6.7 mph 10.5, 12070 7 mph 11.0, 12080 7.5 mph 11.8, 12090 8 mph 12.0, 12100 8.6 mph 12.5, 12110 9 mph 13.0, 12115 9.3–9.6 mph 14.8, 12120 10 mph 14.8.',c:'Table read on 2026-10-13.'},
compcond:{t:'2024 Adult Compendium: Conditioning exercise',by:'Adult Compendium of Physical Activities',in:'pacompendium.com',d:'2024',u:'https://pacompendium.com/conditioning-exercise/',k:'data',
  s:'02022 calisthenics, moderate effort 3.8 MET; 02050 resistance training, vigorous effort 6.0; 02054 resistance training, multiple exercises, 8–15 reps 3.5.',c:'Table read on 2026-10-13.'},
weir:{t:'New methods for calculating metabolic rate with special reference to protein metabolism',by:'Weir JB de V',in:'Journal of Physiology 109(1–2):1–9',d:'1949',u:'https://doi.org/10.1113/jphysiol.1949.sp004363',k:'method',
  s:'Energy from oxygen use. At a respiratory exchange ratio of 0.8, 3.941 + 1.106 × 0.8 ≈ 4.83 kcal ≈ 20.2 kJ per litre of oxygen, close to the 20.1 kJ/L used by our project.',c:'PubMed 15394301 (record only; no abstract). The per-litre figure is HealthWiz\'s arithmetic from Weir\'s equation, shown here so it can be checked.'},
asianbmi:{t:'Appropriate body-mass index for Asian populations and its implications for policy and intervention strategies',by:'WHO Expert Consultation',in:'The Lancet 363(9403):157–163',d:'2004',u:'https://doi.org/10.1016/S0140-6736(03)15268-3',k:'reference',
  s:'Public health action points for Asian populations at BMI 23.0 and 27.5 (also 32.5 and 37.5); the WHO cut-offs remain the international classification.',c:'PubMed 14726171: stated in the abstract.'},
cdcbmi:{t:'Adult BMI Categories',by:'U.S. Centers for Disease Control and Prevention',in:'cdc.gov',d:'2024-03-19',u:'https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html',k:'reference',
  s:'BMI = weight (kg) ÷ height (m)²; adults 20 and older: under 18.5 underweight, 18.5 to under 25 healthy, 25 to under 30 overweight, 30 or more obesity. BMI is a screening measure.',c:'Page read on 2026-10-13.',x:'For adults; children and teens use BMI-for-age percentiles.'},
iomdri:{t:'Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids',by:'Institute of Medicine (National Academies)',in:'The National Academies Press',d:'2005',u:'https://doi.org/10.17226/10490',k:'reference',
  s:'Protein RDA by age (g/kg/day), the Acceptable Macronutrient Distribution Ranges (% of energy) and fiber (14 g per 1,000 kcal) used for the macronutrient goals.',c:'Title, publisher, year and DOI confirmed at nationalacademies.org on 2026-10-13. The table values could not be opened in this session (the NIH summary tables blocked automated access), so the numbers are still to be checked against the report.'},
whodiet:{t:'Healthy diet (fact sheet)',by:'World Health Organization',in:'who.int',d:'2026-01-26',u:'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',k:'guideline',
  s:'Everyone older than 10 years: at least 400 g of fruits and vegetables a day; free sugars under 10% of energy; total fat 30% or less of energy for adults.',c:'Page read on 2026-10-13.'},
whofv:{t:'Increasing fruit and vegetable consumption to reduce the risk of noncommunicable diseases',by:'World Health Organization (eLENA)',in:'who.int',d:'2016-02',u:'https://www.who.int/tools/elena/commentary/fruit-vegetables-ncds',k:'guideline',
  s:'More than 400 g of fruits and vegetables a day, i.e. five portions if 80 g is one serving (2002 WHO/FAO Expert Consultation).',c:'Page read on 2026-10-13.'},
efsawater:{t:'Scientific Opinion on Dietary Reference Values for water',by:'EFSA Panel on Dietetic Products, Nutrition, and Allergies',in:'EFSA Journal 8(3):1459',d:'2010',u:'https://doi.org/10.2903/j.efsa.2010.1459',k:'reference',
  s:'Adequate total water intake (drinks and food moisture): 2.0 L a day for women, 2.5 L for men, at moderate temperature and activity; from 14 years as adults.',c:'Abstract and EFSA press release found on 2026-10-13. Shown for comparison: HealthWiz\'s own water goal uses a different rule.'},
aasm:{t:'Recommended Amount of Sleep for a Healthy Adult: a joint consensus statement of the AASM and SRS',by:'Watson NF, Badr MS, Belenky G, et al.',in:'Sleep 38(6):843–844',d:'2015',u:'https://doi.org/10.5665/sleep.4716',k:'guideline',
  s:'Sleep duration recommendation for adults.',c:'PubMed 26039963 (consensus statement).'},
aasmkids:{t:'Recommended Amount of Sleep for Pediatric Populations: a consensus statement of the AASM',by:'Paruthi S, Brooks LJ, D\'Ambrosio C, et al.',in:'Journal of Clinical Sleep Medicine 12(6):785–786',d:'2016',u:'https://doi.org/10.5664/jcsm.5866',k:'guideline',
  s:'Sleep duration recommendations for children and teenagers.',c:'PubMed 27250809 (consensus statement).'},
acsm:{t:'Quantity and quality of exercise for developing and maintaining cardiorespiratory, musculoskeletal, and neuromotor fitness in apparently healthy adults',by:'Garber CE, Blissmer B, Deschenes MR, et al. (American College of Sports Medicine)',in:'Medicine & Science in Sports & Exercise 43(7):1334–1359',d:'2011',u:'https://doi.org/10.1249/MSS.0b013e318213fefb',k:'guideline',
  s:'At least 150 minutes a week of moderate exercise, or an energy expenditure of at least 500–1000 MET·min a week.',c:'PubMed 21694556: stated in the abstract. The Health Score\'s "≈ 1,000 kcal a week" target is HealthWiz\'s reading and is not in the abstract; still to be checked against the full text.'},
tanaka:{t:'Age-predicted maximal heart rate revisited',by:'Tanaka H, Monahan KD, Seals DR',in:'Journal of the American College of Cardiology 37(1):153–156',d:'2001',u:'https://doi.org/10.1016/s0735-1097(00)01054-8',k:'reference',
  s:'Maximal heart rate is better predicted by 208 − 0.7 × age; 220 − age, the common rule, underestimates it in older adults and was never validated in a large sample.',c:'PubMed 11153730: stated in the abstract.'},
whopa:{t:'World Health Organization 2020 guidelines on physical activity and sedentary behaviour',by:'Bull FC, Al-Ansari SS, Biddle S, et al.',in:'British Journal of Sports Medicine 54(24):1451–1462',d:'2020',u:'https://doi.org/10.1136/bjsports-2020-102955',k:'guideline',
  s:'Adults: 150–300 min of moderate or 75–150 min of vigorous activity a week; children and adolescents: an average of 60 min a day of moderate-to-vigorous activity.',c:'PubMed 33239350: stated in the abstract. The WHO publication page (9789240015128) was also opened.'},
cohen:{t:'A global measure of perceived stress',by:'Cohen S, Kamarck T, Mermelstein R',in:'Journal of Health and Social Behavior 24(4):385–396',d:'1983',u:'https://doi.org/10.2307/2136404',k:'method',
  s:'Perceived stress is measured by self-report (the Perceived Stress Scale).',c:'PubMed 6668417; the DOI (given in the Group 14 report) resolves at Crossref to this article, checked 2026-10-13.',x:'HealthWiz\'s stress check-in is a single self-rating, not the Perceived Stress Scale.'},
mcardle:{t:'Exercise Physiology: Nutrition, Energy, and Human Performance (8th ed.)',by:'McArdle WD, Katch FI, Katch VL',in:'Wolters Kluwer Health, Philadelphia',d:'2015',u:'https://eld.bl.uk/catalog/017933210',k:'reference',
  s:'Energy released per litre of oxygen: about 19.6 kJ at RER 0.7 (mostly fat) and 21.1 kJ at RER 1.0 (mostly carbohydrate), as cited by the Group 14 report, which interpolates 20.1 kJ/L at RER 0.8.',
  c:'The book was found in library catalogues (British Library record linked) on 2026-10-13; the page with the two values could not be opened. As a cross-check, Weir\'s equation gives 19.7 kJ/L at RER 0.7 and 21.1 kJ/L at RER 1.0.'},
f21:{t:'HealthWiz Kingdom: Group 14 F21 Full Written Report',by:'Group 14, Class F21, Program Asasi Sains, Kolej MARA Kulim',in:'Integrated STEM Project Assessment (not published online)',d:'2026-10-10',u:'',k:'project',
  s:'The three measured staircases (Table 2), the pulse counts of six participants after mild, moderate and vigorous climbing (Appendix A, Tables 7–11), the project\'s VO₂ and energy method, and its limitations (Section 4.7).',
  c:'Supplied by the owner on 2026-10-13. Every derived value in HWF21 (js/v6-f21.js) was recomputed from the raw counts and agrees with Tables 7, 8, 9 and 11, except one rounding (P2 moderate VO₂ 15.3 × 1.5 = 22.95, printed 22.9). One sentence is not supported by its own Table 9: "the vigorous climb gave the highest energy release for every participant" holds for 5 of 6 (P2: moderate 87.5 kJ, vigorous 85.1 kJ).',
  x:'Six 18-year-old male students, one session each; a classroom study, not clinical data.'},
nistg:{t:'CODATA value: standard acceleration of gravity',by:'NIST Physical Measurement Laboratory',in:'physics.nist.gov',d:'current CODATA set',u:'https://physics.nist.gov/cgi-bin/cuu/Value?gn',k:'constant',
  s:'gₙ = 9.80665 m/s² (exact).',c:'Page read on 2026-10-13.'},
nistcal:{t:'NIST Guide to the SI, Appendix B.8: Factors for units listed alphabetically',by:'NIST (Thompson A, Taylor BN, SP 811)',in:'nist.gov',d:'2008',u:'https://www.nist.gov/physical-measurement-laboratory/nist-guide-si-appendix-b8',k:'constant',
  s:'1 kilocalorie (thermochemical) = 4.184 kJ (exact).',c:'Page read on 2026-10-13.'},
fao77:{t:'Food energy - methods of analysis and conversion factors (FAO Food and Nutrition Paper 77)',by:'Food and Agriculture Organization of the United Nations',in:'fao.org',d:'2003 (report of the December 2002 workshop)',
  u:'https://www.fao.org/4/y5022e/y5022e04.htm',k:'method',
  s:'The Atwater general factor system: 17 kJ/g (4.0 kcal/g) for protein, 37 kJ/g (9.0 kcal/g) for fat and 17 kJ/g (4.0 kcal/g) for carbohydrate. HealthWiz uses it only to check that a food\'s calories agree with its macros.',
  c:'Chapter 3 (section 3.5.1) read on 2026-10-14.'},
};
const get=id=>S[id]||null;
const KIND={method:'METHOD',reference:'REFERENCE VALUE',guideline:'GUIDELINE',constant:'CONSTANT',data:'DATA TABLE',project:'OUR PROJECT'};
const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
/** A source as a short, clickable citation with what it supports and how it was checked. */
function cite(id){const r=get(id);if(!r)return '<li>Source "'+e(id)+'" is not in the list (not verified).</li>';
  return '<li class="hwsrc">'+(r.u?'<a href="'+e(r.u)+'" target="_blank" rel="noopener noreferrer">'+e(r.t)+'</a>':'<b>'+e(r.t)+'</b>')+' <span class="pxtag">'+KIND[r.k]+'</span><br><small>'+e(r.by)+' · '+e(r.in)+' · '+e(r.d)+'</small>'+
    '<small><i>Supports:</i> '+e(r.s)+'</small>'+(r.x?'<small><i>Limits:</i> '+e(r.x)+'</small>':'')+'<small class="mut"><i>Checked:</i> '+e(r.c)+'</small></li>'}
return{get,cite,all:()=>Object.keys(S).map(k=>Object.assign({id:k},S[k])),ids:()=>Object.keys(S)}})();

const HWExplain=(()=>{
const ORIGIN={you:'ENTERED BY YOU',device:'MEASURED BY A DEVICE',calc:'WORKED OUT',est:'ESTIMATE',default:'APP DEFAULT',service:'FROM A SERVICE',missing:'MISSING'};
const n=(v,d)=>{if(v==null||v==='')return '—';const x=+v;if(!isFinite(x))return String(v);const k=d==null?(Math.abs(x)>=100?0:Math.abs(x)>=10?1:2):d;return (+x.toFixed(k)).toLocaleString('en',{maximumFractionDigits:k})};
/** The panel body. Sections appear only when the spec has them, in the master prompt's order. */
function html(s){s=s||{};const out=[];
  if(s.what)out.push('<p class="hwx-w">'+s.what+'</p>');
  if(s.inputs&&s.inputs.length)out.push('<b class="hwx-h">INPUTS</b><ul class="hwx-in">'+s.inputs.map(i=>'<li><span>'+i.n+'</span> <b>'+(i.o==='missing'?'missing':n(i.v,i.d)+(i.u?' '+i.u:''))+'</b> <span class="pxtag">'+(ORIGIN[i.o]||'')+'</span></li>').join('')+'</ul>');
  if(s.formula)out.push('<b class="hwx-h">FORMULA (AS THE APP RUNS IT)</b><pre class="hwx-f">'+s.formula+'</pre>'+(s.vars&&s.vars.length?'<ul class="hwx-v">'+s.vars.map(v=>'<li><b>'+v[0]+'</b> '+v[1]+(v[2]?' ('+v[2]+')':'')+'</li>').join('')+'</ul>':''));
  if(s.steps&&s.steps.length)out.push('<b class="hwx-h">YOUR NUMBERS, STEP BY STEP</b><ol class="hwx-s">'+s.steps.map(t=>'<li>'+t+'</li>').join('')+'</ol>'+(s.result?'<p class="hwx-r">Result: <b>'+s.result+'</b></p>':''));
  if(s.src&&s.src.length)out.push('<b class="hwx-h">SOURCES</b><ul class="hwx-src">'+s.src.map(HWSources.cite).join('')+'</ul>');
  if(s.app)out.push('<b class="hwx-h">HEALTHWIZ\'S OWN CHOICES</b><p class="hwx-a">'+s.app+'</p>');
  if(s.limits&&s.limits.length)out.push('<b class="hwx-h">WHAT THIS CANNOT TELL YOU</b><ul class="hwx-l">'+s.limits.map(t=>'<li>'+t+'</li>').join('')+'</ul>');
  return '<div class="hwx">'+out.join('')+'</div>'}
const btn=(key,title,spec)=>HWHelp.btn(key,title,html(spec),{ev:spec&&spec.ev});
HWUI.css('explain',`
.hwx{font-size:14px;line-height:1.5}.hwx p{margin:0 0 8px}.hwx-h{display:block;font:8px/1.6 var(--fh);color:var(--vio);margin:12px 0 4px}
.hwx ul,.hwx ol{margin:0;padding-left:18px}.hwx li{margin:2px 0}
.hwx-in{list-style:none;padding:0!important}.hwx-in li{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;border-top:2px solid var(--ln);padding:4px 0}.hwx-in li>span:first-child{flex:1 1 8em}
.hwx-f{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;background:var(--p2);border:2px solid var(--ln);padding:6px 8px;margin:0 0 4px}
.hwhp.hwx-on{max-height:min(82vh,640px);width:min(520px,calc(100vw - 16px))} /* set by js/v6-help.js when the panel holds a worked explanation */
.hwx-r{margin-top:6px}.hwx-src small{display:block}.hwx-src a{font-weight:700;overflow-wrap:anywhere}.hwsrc{margin-bottom:8px!important}
`);
return{html,btn,num:n,ORIGIN}})();
