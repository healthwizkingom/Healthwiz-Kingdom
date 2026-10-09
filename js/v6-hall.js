/* v6 (usability pass, item 1): make the Health Hall tap flow obvious. Not part of the original.
   Users pressed a heart on the map and did not know what to log. This file adds, without rebuilding any page:
     1. ONE shared 3-line header for every tracker page (HWHall.head): WHAT THIS IS · WHAT TO ENTER · WHY IT MATTERS,
        with a tag that says whether the numbers are entered by you or are estimates. It is inserted by wrapping
        pages[key], so no tracker page carries its own copy.
     2. Health Hall tiles that show the tile's one required input and today's value ("1,200 / 2,000 mL · Tap to add 250 mL").
        A tile still only opens its tracker; it never logs anything by itself.
     3. A "Next step" line at the top of the Health Hall: the first tracker not logged today.
     4. A short example line under each empty input ("Example: 330"), replacing the old placeholder text. The line is
        linked to its input (aria-describedby) and hides as soon as the field has a value.
   Nothing here touches saved data. Health numbers keep their labels (measurement you typed in / estimate); the
   header never shows game XP. */
const HWHall=(()=>{
const ico=(n,s)=>HWPixel.icon(n,s||1);
const fmt=n=>(+n||0).toLocaleString('en');

/* ---------- 1. the shared tracker header ---------- */
// kind: who the numbers come from. 'you' = entered by you; 'est' = the app works them out from what you entered.
const HEAD={
  food:{icon:'food',title:'FOOD LOG',kind:'est',
    what:'Your meals today and the calories in them.',
    enter:'Pick each food you ate, then how many servings.',
    why:'Shows how today compares with your own calorie target. Calories and nutrients are estimates.'},
  water:{icon:'water',title:'WATER LOG',kind:'you',
    what:'A count of the water you drink today.',
    enter:'The amount you drank, in mL. Tap +250 mL for one glass.',
    why:'Helps you spread drinking across the day. Needs vary from person to person.'},
  sleep:{icon:'sleep',title:'SLEEP LOG',kind:'you',
    what:'How long you slept last night.',
    enter:'The time you went to bed and the time you woke up.',
    why:'Shows whether your sleep fits the range suggested for your age. The dream battle is only a game.'},
  stair:{icon:'stairs',title:'STAIRS & WORKOUT',kind:'you',
    what:'Stair climbs, stair workouts and runs.',
    enter:'Steps per climb and how many climbs. For a workout, also your pulse in BPM before and after.',
    why:'Turns movement into a daily step count and shows how your pulse changes with effort.'},
  stress:{icon:'mind',title:'STRESS CHECK-IN',kind:'you',
    what:'A quick check of how stressed you feel right now.',
    enter:'A number from 1 (calm) to 10 (very stressed), then what helps.',
    why:'Your own ratings show what calms you over time. It is a check-in, not a diagnosis.'},
  bmi:{icon:'balance',title:'BMI',kind:'est',
    what:'Body mass index: a screening number worked out from height and weight.',
    enter:'Your height in cm and weight in kg.',
    why:'Gives a rough weight-for-height category. It does not diagnose anything.'},
  calc:{icon:'energy',title:'DAILY ENERGY',kind:'est',
    what:'An estimate of the calories your body uses in a day.',
    enter:'Your age, sex, height, weight and how active you are.',
    why:'Sets your calorie target and nutrient goals. It is an estimate, not a prescription.'}
};
const KIND={you:'ENTERED BY YOU',est:'ESTIMATE FROM YOUR ENTRIES'};
function head(k){const h=HEAD[k];if(!h)return '';
  const row=(l,t)=>'<div class="hwhr"><b>'+l+'</b><span>'+t+'</span></div>';
  return '<div class="card hwh3" id="hwh3" data-trk="'+k+'"><div class="hwht">'+ico(h.icon)+'<b>'+h.title+'</b><span class="pxtag">'+KIND[h.kind]+'</span></div>'
    +row('WHAT THIS IS',h.what)+row('WHAT TO ENTER',h.enter)+row('WHY IT MATTERS',h.why)+'</div>'}
// where the header goes: after the page title (and the Nutrition & Hydration section header), before the cards
function place(h,k){const c=head(k);if(!c)return h;
  const nh=h.indexOf('<div class="nshd">');if(nh>=0){const e=h.indexOf('</div></div>',nh);if(e>=0)return h.slice(0,e+12)+c+h.slice(e+12)}
  const t=h.indexOf('</h2>');if(t>=0&&t<400){let e=t+5;const m=/^<p class="mut"[^>]*>[\s\S]*?<\/p>/.exec(h.slice(e));if(m)e+=m[0].length;return h.slice(0,e)+c+h.slice(e)}
  return c+h}

/* ---------- 4. example lines under empty inputs (replace placeholders) ---------- */
const EG={
  wc:'Example: 330 (a small bottle). One glass is about 250.',
  q:'Example: nasi lemak, teh tarik or ayam.',
  ck:'Example: 250 (kcal in one standard serving).',
  cn:'Example: Roti canai',cs:'Example: 1 plate, or 150 g',cc:'Example: 350 (from the food label)',
  cp:'Example: 12',cb:'Example: 45',cfa:'Example: 10',cfb:'Example: 3',
  sld:'Fills itself from your two times, for example 7.5.',
  'wk-b':'Example: 72 (beats counted for 15 s, times 4)','wk-a':'Example: 110',
  'wk-s':'Example: 20','wk-c':'Example: 3','wk-d':'Example: 5',
  'wk-lo':'Example: 80','wk-av':'Example: 110','wk-hi':'Example: 140',
  ss:'Example: 20',sc:'Example: 3',sd:'Example: 5',sb:'Example: 72',sa:'Example: 110'
};
function examples(h){return h.replace(/<input\b[^>]*>/g,tag=>{const m=/\bid="([^"]+)"/.exec(tag),id=m&&m[1];
  if(!id||!Object.prototype.hasOwnProperty.call(EG,id)||/\bvalue="[^"]+"/.test(tag)||/\btype="(hidden|checkbox|radio)"/.test(tag))return tag;
  return tag.replace(/\s+placeholder="[^"]*"/,'').replace(/>$/,' aria-describedby="hwe-'+id+'">')+'<small class="hweg" id="hwe-'+id+'">'+EG[id]+'</small>'})}
document.addEventListener('input',e=>{const el=e.target,s=el&&el.id?document.getElementById('hwe-'+el.id):null;if(s)s.hidden=el.value!==''});

/* ---------- 2. Health Hall tiles ---------- */
const done=(c,d)=>c==='stress'?!!(A('stress',d).length||(st.qd||{})[d]):A(c,d).length>0;
// the one required input and today's value for each tile. val(d) = today's value; act(d) = what to do next.
const TILE={
  // one tile for both (Provisions Hall): two values, and the one input for each
  food:{val:d=>'Food '+fmt(kc(d))+' / '+fmt(st.s.kcal)+' kcal<br>Water '+fmt(wt(d))+' / '+fmt(st.s.water)+' mL',act:d=>'Tap to pick a food or add '+(wt(d)>=st.s.water?'a drink':'250 mL')},
  sleep:{val:d=>{const s=A('sleep',d).pop();return s?s.v+' h slept':'not logged today'},act:d=>done('sleep',d)?'Logged · tap to review':'Tap to enter bedtime + wake-up'},
  stair:{keep:1,act:d=>done('stair',d)?'Tap to add a climb: steps × climbs':'Tap to enter steps × climbs'},
  stress:{val:d=>str(d)==null?'no check-in yet':str(d)+'/10 today',act:d=>done('stress',d)?'Tap for another check-in':'Tap to rate 1–10'},
  bmi:{val:()=>st.s.onb||st.p.cfm?'BMI '+bmi()+' (from your profile)':'not set yet',act:()=>'Tap to enter height + weight'},
  calc:{val:()=>st.s.set?fmt(st.s.kcal)+' kcal target':'not set yet',act:()=>'Tap to enter age, weight, height'},
  body:{val:()=>st.s.set?fmt(st.s.kcal)+' kcal target':'not set yet',act:()=>'Tap to enter height + weight'},
  stats:{val:()=>'all your trends',act:()=>'Nothing to enter'},
  score:{keep:1,act:()=>'Nothing to enter · uses your logs'}
};
function tiles(){HUB.forEach(h=>{if(h[5])return;const k=h[0],t=TILE[k],base=h[4];
  h[5]=1;h[4]=d=>(t&&t.val?t.val(d):base(d))+'<span class="hwa">'+(t?t.act(d):'Nothing to enter')+'</span>'})}
tiles();

/* ---------- 3. Next step ---------- */
const NEXT=[
  ['water','Water','Nothing logged yet today. Add a drink, for example 250 mL.'],
  ['food','Food','No meal logged yet today. Pick what you ate.'],
  ['sleep','Sleep','Last night is not logged. Enter your bedtime and wake-up time.'],
  ['stair','Stairs','No climb logged yet today. Enter steps per climb and the number of climbs.'],
  ['stress','Stress','No check-in yet today. Rate how stressed you feel, 1 to 10.']];
function next(d){d=d||today();return NEXT.find(n=>!done(n[0],d))||null}
function nextCard(){const n=next();
  return '<div class="card hwnx" id="hwnext"><h3>'+ico('quest')+' NEXT STEP</h3>'+(n
    ?'<p><b>'+n[1]+':</b> '+n[2]+'</p><button data-a="go" data-v="'+n[0]+'" style="width:100%">OPEN '+n[1].toUpperCase()+'</button>'
    :'<p>Everything is logged for today. Look at your Statistics, or come back tomorrow.</p><button class="g" data-a="go" data-v="stats" style="width:100%">OPEN STATISTICS</button>')+'</div>'}

/* ---------- wrap the pages ---------- */
function wrap(k){const p=pages[k];if(!p)return;pages[k]=function(){let h=p.apply(this,arguments);
  if(k==='stress'){const q=S.sq;if(q&&q.ph&&q.ph!=='start')return examples(h)}   // inside a stress quest the header would only get in the way
  return examples(place(h,k))}}
['food','water','sleep','stair','stress','bmi','calc'].forEach(wrap);
{const p=pages.health;pages.health=function(){const h=p.apply(this,arguments),i=h.indexOf('</p>');return i<0?nextCard()+h:h.slice(0,i+4)+nextCard()+h.slice(i+4)}}

HWUI.css('hall',`
.hwh3{padding:10px 12px}.hwht{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 6px}.hwht b{font:10px/1.6 var(--fh)}
.hwhr{display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px;padding:4px 0;border-top:2px dashed var(--ln)}
.hwhr b{font:8px/1.8 var(--fh);color:var(--mut)}.hwhr span{font-size:14px;line-height:1.4;overflow-wrap:anywhere}
.hweg{display:block;margin-top:3px;font-size:12px;line-height:1.4;color:var(--mut);font-weight:400}.hweg[hidden]{display:none}
.hub .hb small{display:block}.hub .hb .hwa{display:block;margin-top:4px;font:12px/1.4 var(--fb);font-weight:400;letter-spacing:0;color:var(--mut)}
.hwnx p{margin:0 0 8px}
@media(max-width:380px){.hwhr{grid-template-columns:1fr;gap:0}}
`);
return{head,next,examples,tiles:TILE}})();
