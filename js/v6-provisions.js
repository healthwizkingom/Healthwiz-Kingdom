/* v6 (visual redesign, session 2): Nutrition and Hydration as one page, the Provisions Hall. Not part of the original.
   The page keeps the two systems' own routes as its two halves: 'food' (Nutrition Village) and 'water' (Water Valley,
   the Well of Life). So every link, quest, insight, map node, region panel and tutorial step that opened one of the old
   pages opens the matching half, the original code that checks S.v==='water' keeps working (the well animation in
   drink(), the music, exploration XP, mini-game cards), and no old route can break.
   Both halves share the title, the banner, BACK, and two system cards: today's calories and water at a glance, each a
   switch to its half. Below them: the section header (region, kingdom state) and the system's own cards, the original
   Nutrition content rearranged (js/hw-02-core.js) or the original Water Quest, unchanged apart from its headings.
   Every card stays a direct child of the page, so js/v6-motion.js still pauses scenery scrolled out of view.
   Switching is a navigation (page:viewed), but the system cards stay where they were on screen and only the content
   below them animates in, so it feels like switching tabs. */
const HWProvisions=(()=>{
const NUT=pages.food,HYD=pages.water; // the two sections, as js/hw-02-core.js builds them
const SYS={food:{n:'Nutrition',icon:'food',title:'NUTRITION & CALORIES',region:'Nutrition Village',
    line:'Log your meals to see calories and nutrients, today and over the week.'},
  water:{n:'Hydration',icon:'water',title:'WATER QUEST',region:'Water Valley',
    line:'Restore the Well of Life — every sip you log physically fills the village well.'}};
const other=v=>v==='water'?'food':'water';
const kstate=c=>{try{return HWKingdom.NAMES[HWKingdom.level(KR.find(r=>r[3]===c))]||''}catch(e){return ''}};

// a system card: today's value against the target, and the switch to that half
function sys(v,on,d){let val,goal,unit,pct,col,line;
  if(v==='food'){const k=kc(d),K=st.s.kcal,m=new Set(A('food',d).map(e=>e.m.meal)).size;
    val=k;goal=K;unit='kcal';pct=k/K*100;col=k>K*1.1?'var(--vio)':'var(--grn)';line=m?m+(m===1?' meal':' meals')+' logged today':'No meals logged yet today'}
  else{const w=wt(d),W=st.s.water;val=w;goal=W;unit='mL';pct=Math.min(100,w/W*100);col='var(--blue)';line=w>=W?'Target reached today':(W-w)+' mL to go'}
  return '<button class="nst'+(on?' on':'')+'" id="nst-'+v+'" data-a="nstab" data-v="'+v+'"'+(on?' aria-current="page"':'')+'>'
    +'<span class="nstl">'+HWPixel.icon(SYS[v].icon)+SYS[v].n+'</span><span class="nstv"><b>'+val+'</b> / '+goal+' '+unit+'</span>'
    +bar(pct,col)+'<small>'+line+'</small></button>'}

function page(v,body){const d=today(),o=other(v),s=kstate(v),S0=SYS[v];
  return '<h2>NUTRITION & HYDRATION</h2>'
    +'<div class="nstabs" role="group" aria-label="Nutrition and hydration">'+sys('food',v==='food',d)+sys('water',v==='water',d)+'</div>'
    +'<div class="nshd">'+HWPixel.icon(S0.icon,2)+'<div><b>'+S0.title+'</b><span class="nsrg">'+S0.region
      +(s?' <span class="pxtag">'+s.toUpperCase()+'</span>':'')+'</span><small>'+S0.line+'</small></div></div>'
    +body()
    +'<button class="g nsgo" data-a="nstab" data-v="'+o+'">'+HWPixel.icon(SYS[o].icon)+' GO TO '+SYS[o].n.toUpperCase()+' ▶</button>'}
pages.food=()=>page('food',NUT);
pages.water=()=>page('water',HYD);

// one Health Hall tile instead of two; one banner and one footnote for the whole page
{const i=HUB.findIndex(h=>h[0]==='food');if(i>=0)HUB.splice(i,1,['food','🍗💧','Food & Water','Provisions Hall',d=>kc(d)+' kcal · '+wt(d)+' mL today']);
  const j=HUB.findIndex(h=>h[0]==='water');if(j>=0)HUB.splice(j,1)}
{const H=['🍗','Provisions Hall','Where Nutrition Village and Water Valley meet.'];BN.food=H.concat(BN.food[3]);BN.water=H.concat(BN.water[3])}
DIS.food=DIS.water=DIS.food+' '+DIS.water;

// switch halves: the system cards stay put on screen and keep focus, and only the content below them animates in
acts.nstab=(d,el)=>{const v=d&&d.v==='water'?'water':'food';if(S.v===v)return;
  const t0=document.querySelector('.nstabs'),y0=t0?t0.getBoundingClientRect().top:56,kept=!!(el&&el.closest&&(el.closest('.nstabs')||el.classList.contains('nsgo')));
  go(v);
  const pg=document.querySelector('#main .pg'),t1=document.querySelector('.nstabs');if(pg)pg.classList.add('v6nsw');
  if(t1)window.scrollTo(0,Math.max(0,t1.getBoundingClientRect().top+window.scrollY-Math.min(Math.max(y0,56),innerHeight/2)));
  const b=document.getElementById('nst-'+v);if(b&&kept)b.focus({preventScroll:true})};

HWUI.css('provisions',`
.nstabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:0 0 20px}
.nst{position:relative;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:4px;min-width:0;min-height:0;padding:10px 10px 8px;text-align:left;font:13px/1.4 var(--fb);color:var(--ink);background:var(--p2);border:var(--px-bw-c) solid var(--ln);box-shadow:var(--px-bevel-c),var(--px-sh-c)}
.nst.on{background:var(--pn);box-shadow:var(--px-bevel-c),var(--px-sh-c),0 0 0 3px var(--gold)}
.nst.on:after{content:"";position:absolute;left:calc(50% - 8px);bottom:-15px;border:8px solid transparent;border-bottom:0;border-top-color:var(--gold)}
.nstl{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fh);letter-spacing:.04em;text-transform:uppercase;-webkit-font-smoothing:none}
.nstv{overflow-wrap:anywhere}.nstv b{font:var(--px-f2)/1.3 var(--fh)}.nst small{color:inherit}.nst .bar{margin:2px 0}
.nshd{display:flex;align-items:center;gap:12px;margin:0 0 14px;padding:8px 12px;background:var(--pn);border:var(--px-bw-c) solid var(--ln);box-shadow:var(--px-sh-c)}
.nshd>div{min-width:0}.nshd b{display:block;font:10px/1.6 var(--fh)}.nshd small{display:block;margin-top:2px}
.nsrg{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:13px}
.nsg{display:grid;grid-template-columns:1fr;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:14px;margin-bottom:14px}.nsg>.card{margin-bottom:0}#fcal .grid{grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}
.pg.tr-food .card>h3,.pg.tr-water .card>h3{display:flex;align-items:center;gap:8px}
.nsgo{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin:0 0 14px}
.pg.v6nsw,.pg.v6nsw.tr-water{animation:none}.pg.v6nsw>.nstabs~*{animation:pgin .3s steps(4)}.pg.v6nsw.tr-water>.nstabs~*{animation:trw .55s steps(6)}
@media(prefers-reduced-motion:reduce){.pg.v6nsw>.nstabs~*,.pg.v6nsw.tr-water>.nstabs~*{animation:none}}
`);
return{sections:Object.keys(SYS),state:kstate}})();
