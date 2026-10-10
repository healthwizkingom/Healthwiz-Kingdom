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
    enter:'Pick the face that fits how you feel now. It sets a starting number out of 10 (very calm 1, calm 3, neutral 5, stressed 7, very stressed 9). Then choose what helps.',
    why:'Your own ratings show what calms you over time. It is a check-in, not a diagnosis.'},
  body:{icon:'balance',title:'BODY & ENERGY',kind:'est',
    what:'Your BMI (a screening number) and an estimate of the calories your body uses in a day.',
    enter:'Height in cm, weight in kg, age, sex and how active you are.',
    why:'Gives a rough weight-for-height category and sets your calorie and nutrient goals. Estimates, not a diagnosis.'}
};
const KIND={you:'ENTERED BY YOU',est:'ESTIMATE FROM YOUR ENTRIES'};
/* One compact row replaces the region banner, the BACK button and the header's title line: BACK · what this page is + where its numbers
   come from · "?". The 3-line header (what / enter / why) is the panel behind "?" and is always closed until tapped. S.hq[k] keeps the choice for
   this tab, so a re-render after logging does not flip it. Nothing new is saved. */
const CMP=['food','water','sleep','stair','stress','body'];
const compact=v=>CMP.indexOf(v)>=0;
const isOpen=k=>{S.hq=S.hq||{};if(S.hq[k]===undefined)S.hq[k]=false;return S.hq[k]};
function panel(k){const h=HEAD[k];if(!h)return '';
  const row=(l,t)=>'<div class="hwhr"><b>'+l+'</b><span>'+t+'</span></div>';
  return '<div class="card hwh3" id="hwh3" data-trk="'+k+'"'+(isOpen(k)?'':' hidden')+'>'+row('WHAT THIS IS',h.what)+row('WHAT TO ENTER',h.enter)+row('WHY IT MATTERS',h.why)+'</div>'}
function bar_(k,help){const h=HEAD[k],o=isOpen(k);
  return '<div class="hwcr" id="hwcr"><button type="button" class="g sm back" data-a="go" data-v="'+(PAR[k]||'health')+'" aria-label="Back to the Health Hall">◀ HEALTH</button>'
    +'<div class="bn hwct"><span>'+HWPixel.glyph(HWPixel.region(k)||BN[k][0],2)+'</span><div><b>'+BN[k][1]+'</b><small class="hwtg">'+KIND[h.kind]+'</small></div></div>'
    +(help?'<button type="button" class="g sm hwq" data-a="hwq" data-k="'+k+'" aria-expanded="'+(o?'true':'false')+'" aria-controls="hwh3" aria-label="What is this page for?">?</button>':'')+'</div>'}
function head(k){return HEAD[k]?bar_(k,1)+panel(k):''}
acts.hwq=d=>{const k=d.k;S.hq=S.hq||{};S.hq[k]=!isOpen(k);const p=document.getElementById('hwh3'),b=document.querySelector('.hwq');if(p)p.hidden=!S.hq[k];if(b)b.setAttribute('aria-expanded',S.hq[k]?'true':'false')};
// where the row goes: the first thing on the page
function place(h,k){return head(k)+h}
/* Input first: on a page whose form sat far down, the form's card moves up in front of the read-only cards. Same cards, same ids,
   only the order changes; the "jump to the form" buttons that used to scroll there are no longer needed. */
function lift(h,form,before){const t=document.createElement('template');t.innerHTML=h;const f=t.content.querySelector(form),c=f&&(f.closest('.card')||f),b=t.content.querySelector(before);
  if(!c||!b||!b.parentNode||c===b)return h;b.parentNode.insertBefore(c,b);t.content.querySelectorAll('.hwjump').forEach(x=>x.remove());return t.innerHTML}
const FIRST={food:h=>lift(h,'#fpick','.nsg'),water:h=>lift(h,'#wc','.nshd+*'),sleep:h=>lift(h,'#slb','#dbatc'),stair:h=>lift(h,'#stman','.stgoal')};

/* ---------- 4. example lines under empty inputs (replace placeholders) ---------- */
const EG={
  wc:'Example: 330 (a small bottle). One glass is about 250.',
  q:'Example: nasi lemak, teh tarik or ayam.',
  ck:'Example: 250 (kcal in one standard serving).',
  cn:'Example: Roti canai',cs:'Example: 1 plate, or 150 g',cc:'Example: 350 (from the food label)',
  cp:'Example: 12',cb:'Example: 45',cfa:'Example: 10',cfb:'Example: 3',
  bh:'Example: 165',bw:'Example: 58',ka:'Example: 16',
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
  exercise:{keep:1,act:()=>'Tap to train · logs only when you finish'},
  stair:{keep:1,act:d=>done('stair',d)?'Tap to add a climb: steps × climbs':'Tap to enter steps × climbs'},
  stress:{val:d=>str(d)==null?'no check-in yet':str(d)+'/10 today',act:d=>done('stress',d)?'Tap for another check-in':'Tap to pick how you feel'},
  body:{val:()=>(st.s.onb||st.p.cfm?'BMI '+bmi():'BMI not set')+(st.s.set?' · '+fmt(st.s.kcal)+' kcal goal':''),act:()=>'Tap to enter height + weight'},
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
  ['stress','Stress','No check-in yet today. Pick the face that fits how you feel.']];
function next(d){d=d||today();return NEXT.find(n=>!done(n[0],d)&&!(n[0]==='stair'&&typeof HWCond!=='undefined'&&HWCond.stairsHidden()))||null} // stairs wait behind a doctor note for some conditions
function nextCard(){const n=next();
  return '<div class="card hwnx" id="hwnext"><h3>'+ico('quest')+' NEXT STEP</h3>'+(n
    ?'<p><b>'+n[1]+':</b> '+n[2]+'</p><button data-a="go" data-v="'+n[0]+'" style="width:100%">OPEN '+n[1].toUpperCase()+'</button>'
    :'<p>Everything is logged for today. Look at your Statistics, or come back tomorrow.</p><button class="g" data-a="go" data-v="stats" style="width:100%">OPEN STATISTICS</button>')+'</div>'}

/* ---------- wrap the pages ---------- */
function wrap(k){const p=pages[k];if(!p)return;pages[k]=function(){let h=p.apply(this,arguments);
  if(k==='stress'){const q=S.sq;if(q&&q.ph&&q.ph!=='start')return bar_(k,0)+examples(h)}   // inside a stress quest the header would only get in the way
  if(FIRST[k])h=FIRST[k](h);
  return examples(place(h,k))}}
['food','water','sleep','stair','stress','body'].forEach(wrap);
{const p=pages.health;pages.health=function(){const h=p.apply(this,arguments),i=h.indexOf('</p>');return i<0?nextCard()+h:h.slice(0,i+4)+nextCard()+h.slice(i+4)}}

/* ---------- 5. a shorter Home ---------- */
/* Home keeps today's health (tiles, energy, nutrients, 7-day trends, health connections). The game cards that repeated the quests
   (Adventure Progress, Focus & Weekly, Daily Summary, Quest Progress) become ONE "Today's quests" card that opens the Quest Board,
   where all of them still are. The Hero card and the Kingdom map stay, as one-line rows that open (same cards, same ids). */
function questCard(d){const n=QD(d).filter(q=>q.p>=1).length;
  return '<div class="card hmq" id="hmq"><h3>'+ico('quest')+' TODAY\'S QUESTS <b class="big">'+n+'/5</b></h3>'+bar(n/5*100,'var(--gold)')
    +'<button class="g" data-a="go" data-v="quests" style="width:100%;margin-top:8px">OPEN THE QUEST BOARD</button><span class="gtag">🎮 GAME QUESTS · NOT A HEALTH MEASUREMENT</span></div>'}
function shortHome(h){const t=document.createElement('template');t.innerHTML=h;const C=t.content,q=s=>C.querySelector(s);
  ['#advq','#v6q1','#dsum','h2.sec'].forEach(s=>{const e=q(s);if(e)e.remove()});
  C.querySelectorAll('.card').forEach(c=>{const h3=c.querySelector(':scope>h3');if(h3&&/QUEST PROGRESS/.test(h3.textContent))c.remove()});
  const en=q('#encheck'),qc=document.createElement('template');qc.innerHTML=questCard(today());
  if(en)en.after(qc.content);else{const ts=q('.tstat');if(ts)ts.after(qc.content)}
  const fold=(sel,label)=>{const c=q(sel);if(!c)return;const d=document.createElement('details');d.className='hmd';d.id='hmd-'+sel.slice(1);
    d.innerHTML='<summary class="card">'+label+'</summary>';c.replaceWith(d);d.appendChild(c)};
  const L=lvl();fold('#pcard',ico('quest')+' <b>HERO CARD</b> <small>Lv '+(L.i+1)+' · '+esc(L.n)+' · game level</small>');
  fold('#kmini',ico('map')+' <b>KINGDOM MAP</b> <small>'+KR.filter(r=>klv(r[3])).length+'/8 regions restored this week</small>');
  return t.innerHTML}
{const p=pages.home;pages.home=function(){return shortHome(p.apply(this,arguments))}}

/* ---------- 6. tap targets and text size ---------- */
/* Back, help "?", edit, delete, the crisis phone numbers and the other small buttons are at least 44 × 44 px. Labels and captions
   in the main content are at least 12 px (they were 6 to 11 px). Buttons and headings keep their own sizes, and the little labels drawn
   on the game scenes (Dream Battle, Storm Within, the Counsel's name plate) stay part of the picture. */
HWUI.css('hall-size',`
html #main .back,html #main button.sm,html #main .chip,html #main .hwh,html #main .hwq,html #main button[data-a="edit"],html #main button[data-a="del"]{min-height:44px;min-width:44px}
html #main .hwh:not(.hwhl){width:44px;height:44px;margin:-9px -9px -9px -1px;font-size:11px;isolation:isolate;background:none;border:0;box-shadow:none}
html #main .hwh:not(.hwhl):before{content:"";position:absolute;inset:9px;z-index:-1;background:#1f6fb0;border:2px solid var(--ln);box-shadow:inset -2px -2px 0 rgba(0,0,0,.2),2px 2px 0 var(--ln)}
html #main .hwh[aria-expanded="true"]:not(.hwhl):before{background:var(--gold)}
:root[data-theme="dark"] #main .hwh:not(.hwhl):before{border-color:#9fc4e8}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) #main .hwh:not(.hwhl):before{border-color:#9fc4e8}}
html #main summary{min-height:44px;display:flex;align-items:center}
html #main .cshelp a,html #main .v6aq a,html #main .v6hzb a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 4px}
html #main .v6shfs{min-width:44px;min-height:44px}
html #main small,html #main em,html #main td,html #main th,html #main .gtag,html #main .tagk,html #main .tag,html #main .tl,html #main .ax,html #main .pxtag,html #main .xpb-gain,html #main .v6pk,html #main .v6mlab,
html #main .mx span,html #main .rest,html #main .later,html #main .v6wk span,html #main .chl span,html #main .tg span,html #main .hwhr b,html #main .stlab,html #main .pcl,html #main .rbsort,
html #main .attr b,html #main .empty b,html #main .v6ce b,html #main .tq b,html #main .an b,html #main .sthrh b,html #main .stclimb b,html #main .stkc b,html #main .hrdh b,html #main .v6hzb b,
html #main .wq6hud b,html #main .wq6hud .num,html #main .bn b,html #main .nshd b,html #main .nsrg,html #main .nstl,html #main .stpo,html #main .hwtg{font-size:12px!important}
`);

HWUI.css('hall',`
.hwcr{display:flex;align-items:center;gap:8px;margin:0 0 4px}.hwcr .sm{flex:0 0 auto;min-height:44px;min-width:44px;margin:0}
.hwcr .hwct{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;margin:0;padding:0;background:none;border:0;box-shadow:none;min-height:0}.hwct>div{min-width:0}.hwct b{display:block;font:10px/1.5 var(--fh)}
.pg.tr-food .nstabs,.pg.tr-water .nstabs{margin-bottom:12px}.pg.tr-food .nshd,.pg.tr-water .nshd{margin-bottom:8px}.pg.tr-food h2,.pg.tr-water h2{margin-bottom:8px}
.hwtg{display:block;font-size:12px;line-height:1.3;color:var(--mut);font-weight:400}
.hwq{font:12px var(--fh);padding:0 12px}
.hwh3{padding:6px 12px;margin-bottom:6px}.hwh3[hidden]{display:none}
.hwhr{padding:2px 0;border-top:2px dashed var(--ln);font-size:13px;line-height:1.35;overflow-wrap:anywhere}.hwhr:first-child{border-top:0}
.hwhr b{font:8px/1.8 var(--fh);color:var(--mut);margin-right:6px}
.hweg{display:block;margin-top:3px;font-size:12px;line-height:1.4;color:var(--mut);font-weight:400}.hweg[hidden]{display:none}
.hub .hb small{display:block}.hub .hb .hwa{display:block;margin-top:4px;font:12px/1.4 var(--fb);font-weight:400;letter-spacing:0;color:var(--mut)}
.hwnx p{margin:0 0 8px}
.hmq h3{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.hmq .big{margin-left:auto}
.hmd{margin:0 0 14px}.hmd>summary{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;min-height:44px;margin:0;padding:8px 12px;cursor:pointer}.hmd>summary small{font-size:12px;color:var(--mut)}.hmd[open]>summary{margin-bottom:10px}.hmd>.card{margin-bottom:0}
`);
return{head,next,examples,compact,tiles:TILE}})();