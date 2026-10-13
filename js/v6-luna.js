/* v6: Luna, the apprentice witch, HealthWiz's friendly companion. Not part of the original.
   Luna speaks the event bubbles that Medius used to (js/v6-medius.js keeps the rules, cooldowns and limits). Medius
   stays the Wizard King: the tutorial, the Traveller's Registry, the Wizard's Counsel and the Health Orb are his.
   * Art: one hand-placed pixel sprite (BASE, 44 x 51, light from the top left) with patches for the eyes, mouth and
     waving arm, her teal familiar as its own layer, and the 1-pixel ink outline added around the composed picture
     (docs/PIXEL_STYLE.md). Drawn with code at 2x, so it costs nothing from the image budget. Expressions follow the
     owner's reference sheet: cheerful, curious, focused, thoughtful, surprised, encouraging, apologetic (+ idle, greet).
   * Motion: blink, a 1-pixel idle breath, the familiar bobbing and a staff sparkle, in whole pixels on a slow timer.
     Only while a picture is on screen and the tab is visible; reduced motion and the Performance mode draw one still frame.
   * Ask Luna (HWLuna.open): a panel with no AI. It finds features (names and the trackers' own header text from
     js/v6-hall.js) and opens the "?" explanations already on the page (js/v6-help.js), pointing at each one. It never
     reads or changes saved entries and sends nothing anywhere.
   * Preferences (Settings): help style st.s.lst ('q' Quick · 'g' Guided, default · 'e' Explore), size st.s.lsz
     (0 full · 1 compact portrait) and how often she talks (st.s.med, unchanged: 2 Chatty · 1 Calm · 0 Off).
     Missing keys mean the defaults, so older saves need no migration. RESET puts all three back. */
const HWLuna=(()=>{
const PAL={k:'#1b1626',H:'#3d2c84',h:'#5b47b5',j:'#251a55',b:'#2b4cb0',B:'#1a2d73',y:'#f6c94f',Y:'#b9832b',z:'#fff0a8',
  P:'#7246c4',p:'#a27cf0',Q:'#452680',s:'#ffe3cc',S:'#f2b99c',r:'#f49aaa',e:'#2a1858',v:'#8b5cf0',V:'#c4a6ff',w:'#ffffff',
  m:'#b8475e',N:'#272a66',n:'#3d4396',M:'#17183f',L:'#c9b8f4',l:'#efe8ff',t:'#7d4b2c',T:'#4b2b19',d:'#2e2546',D:'#1e182f',
  u:'#563596',U:'#33205c',c:'#8fe3ff',C:'#3aa4e6',o:'#1f5fa8',a:'#63e6dc',A:'#2aa8ac',g:'#c4fff7'};
const W=44,H=51;
const BASE=[
'...................................',
'..........................jj.......',
'........................hHHj.......',
'......yy...............hHHj........',
'....yzcCy.............hHHHj........',
'...yzcwcCy...........hHHHj.........',
'...ycccCCy..........hhHHHj.........',
'...yCcCCoy.........hhHHHHj.........',
'....yCooy........hhhHHHHHj.........',
'....Y.yY.......hhhHHHHHHHj.........',
'.....yzY.....hhhHHHHHHHHHHj........',
'......zY....hhHHHHyHHHHHHHHHj......',
'......zY...BbbbbbyzybbbbbbbbbB.....',
'......zY...YyyyyyyYyyyyyyyyyyY.....',
'......hhhhhhhHHHHHHHHHHHHHHHHHH....',
'...hhhhHHHHHHHHHHHHHHHHHHHHHHHHHjj.',
'.....jjjjjjQQQQQQQQQQQQQQQjjjjjj...',
'......zY.QPPPPPPPPPPPPPPPPPQ.......',
'......zYQPPpPPPPPPPPPPpPPPPPQ......',
'......zYQPPPpPPPPPPPPPPpPPPPQ......',
'......zYQPPPPsPPssPssPPsPPPPQQ.....',
'......zYQPPPeeeesssseeeeePPPQQ.....',
'......zYQPPPsewvsssssvweSPPPQQ.....',
'......zYQPPPsevvsssssvveSPPPQQ.....',
'......zYQPPPseVVsssssVVeSPPPQQ.....',
'......zYQPPPrrsssssssssrrPPPQQ.....',
'......zYQPPPsssssmsmssssSPPPQQ.....',
'......zYQPPPPSssssmssssSPPPPQQ.....',
'......zYQPPPPPPSsssssSPPPPPPQQ.....',
'......zYQPPNnNylLSSSLlyNnNPPQQ.....',
'......zYQNnnnNylLlClLlyNNnNNPQQ....',
'......zYNnnNnNylLlLlLlyNNMNnNQQ....',
'......zYNnNNnNylLlLlLlyNNMNnNQQ....',
'......zYLlLNnNylLlLlLlyNNMNnNQQ....',
'......sssSPNnNyttTtTttyNNMNnNQQ....',
'......zYSPPNnNyttTtTttyNNMLlLQQ....',
'......zYQPPNNTTTTyzyTTTTNNsSPQQ....',
'......zYQPNNNNlLlLlLlLlNNttNPQQ....',
'......zYQNNNNNllLllLlllNNtTNNQQ....',
'......zYQNNNNNlLlLlLlLlNNNNNNQQ....',
'......zYQnNNNNLlLlLlLlLNNNNMQQ.....',
'......zY.yyyyylLlLlLlLlyyyyy.......',
'......zY.......dD...dD.............',
'......zY.......dD...dD.............',
'......zY.......dD...dD.............',
'......zY.......dD...dD.............',
'......zY......uuuU.uuuU............',
'......zY......uyuU.uyuU............',
'......zY.....uuuuU.uuuuU...........',
'......zY.....UUUUU.UUUUU...........',
'...................................'];
// Eyes: the left eye's 4 x 4 block (columns 12-15, rows 21-24); the right eye mirrors it unless given separately.
const EYES={open:['eeee','sewv','sevv','seVV'],shut:['ssss','ssss','eeee','ssss'],happy:['ssss','sses','sese','ssss'],
  wide:['seee','ewve','ewwe','seee'],half:['ssss','eeee','sevv','seVV'],up:['eeee','sevv','seVV','ssss'],soft:['ssss','ssee','seVe','ssss'],
  side:{l:['eeee','swev','swvv','sVVe'],r:['eeee','wevs','wvvs','VVeS']},wink:{l:['eeee','sewv','sevv','seVV'],r:['ssss','sess','eseS','sssS']}};
// Mouth: columns 16-20, rows 26-27.
const MOUTH={v:['smsms','ssmss'],open:['smmms','ssrss'],o:['ssmss','ssmss'],flat:['ssmms','sssss'],side:['sssms','sssss'],frown:['ssmss','smsms']};
// Her free arm (viewer's right) raised in a wave; the hanging arm is painted over with hair. ' ' keeps the pixel.
const WAVE=[[28,23,'sss'],[28,24,'sss'],[28,25,'sSs'],[28,26,'LlL'],[27,27,'NnN'],[27,28,'NnN'],[26,29,'NnN'],
  [26,31,'PPP'],[26,32,'PPP'],[26,33,'PPP'],[26,34,'PPP'],[26,35,'PPP'],[26,36,'PP']];
// The familiar: a small teal spirit cat, two frames (its wisp of a tail sways).
const FAM=[['.a.....a.','.aa...aa.','aaaaaaaaa','aggggggga','agegggega','agrgAgrga','.aggggga.','..aaaaa..','...aA.a..'],
           ['.a.....a.','.aa...aa.','aaaaaaaaa','aggggggga','agegggega','agrgAgrga','.aggggga.','..aaaaa..','..a.Aa...']];
const SPARK=[[[2,2],[11,3],[1,10],[10,9]],[[5,1],[12,6],[2,7],[9,11]]];
const EXPR={idle:{e:'open',m:'v'},cheerful:{e:'happy',m:'open'},curious:{e:'side',m:'o'},focused:{e:'half',m:'flat'},
  thoughtful:{e:'up',m:'side'},surprised:{e:'wide',m:'o'},encouraging:{e:'wink',m:'open'},apologetic:{e:'soft',m:'frown',drop:1},
  greet:{e:'open',m:'open',wave:1}};
const NAMES=['cheerful','curious','focused','thoughtful','surprised','encouraging','apologetic'];

/** The picture as rows of palette letters. o = {expr, blink, breath, fam (0/1 frame), bob (0/-1), cast (0/1/2)} */
function grid(o){o=o||{};const x=EXPR[o.expr]||EXPR.idle,g=BASE.map(r=>(r+'.'.repeat(W)).slice(0,W).split(''));
  const put=(c,r,s)=>{for(let i=0;i<s.length;i++)if(s[i]!==' ')g[r][c+i]=s[i]};
  const ey=o.blink?EYES.shut:EYES[x.e],L=ey.l||ey,R=ey.r||ey.map(s=>s.split('').reverse().join(''));
  for(let i=0;i<4;i++){put(12,21+i,L[i]);put(21,21+i,R[i]);if(g[21+i][24]==='s')g[21+i][24]='S'}
  const M=MOUTH[x.m];put(16,26,M[0]);put(16,27,M[1]);
  if(x.drop){put(26,19,'c');put(26,20,'C')}
  if(x.wave)WAVE.forEach(p=>put(p[0],p[1],p[2]));
  if(o.cast)for(let r=3;r<10;r++)for(let c=3;c<10;c++)g[r][c]=({C:'c',o:'C',c:'w'})[g[r][c]]||g[r][c];
  if(o.breath){for(let r=29;r>0;r--)g[r]=g[r-1].slice();g[0]=g[0].map(()=>'.')}
  FAM[o.fam?1:0].forEach((s,i)=>put(33,19+i+(o.bob||0),s.replace(/\./g,' ')));
  const out=g.map(r=>r.slice());for(let r=0;r<H;r++)for(let c=0;c<W;c++)if(g[r][c]==='.'&&[[1,0],[-1,0],[0,1],[0,-1]].some(d=>{const v=(g[r+d[1]]||[])[c+d[0]];return v&&v!=='.'&&v!=='k'}))out[r][c]='k';
  if(o.cast)SPARK[o.cast-1].forEach(p=>{if(out[p[1]][p[0]]==='.')out[p[1]][p[0]]='z'});
  return out.map(r=>r.join(''))}
// compact: the face and hat brim only (a portrait, like the reference sheet's mobile widget)
const CROP={x:8,y:9,w:22,h:22},FACE={x:10,y:14,w:17,h:17}; // FACE: the header button
function paint(cv,o){const g=grid(o),c=o&&o.compact?(o.compact==='face'?FACE:CROP):{x:0,y:0,w:W,h:H},x=cv.getContext('2d');if(!x)return;
  if(cv.width!==c.w)cv.width=c.w;if(cv.height!==c.h)cv.height=c.h;const im=x.createImageData(c.w,c.h);
  for(let r=0;r<c.h;r++)for(let k=0;k<c.w;k++){const ch=g[r+c.y][k+c.x],v=PAL[ch];if(!v)continue;const i=(r*c.w+k)*4;
    im.data[i]=parseInt(v.slice(1,3),16);im.data[i+1]=parseInt(v.slice(3,5),16);im.data[i+2]=parseInt(v.slice(5,7),16);im.data[i+3]=255}
  x.putImageData(im,0,0)}
const still=()=>HWUI.reduced()||typeof HWMotion!=='undefined'&&HWMotion.level&&HWMotion.level()==='performance';
/** Puts an animated Luna in `host` (any element). o = {expr, compact, scale (default 2), cast (sparkle at first)}.
    Returns the canvas. All pictures share one timer, which stops once none is left on the page. */
function mount(host,o){o=Object.assign({expr:'idle',scale:2},o||{});const cv=document.createElement('canvas'),c=o.compact?(o.compact==='face'?FACE:CROP):{w:W,h:H};
  cv.className='v6luna';cv.setAttribute('aria-hidden','true');cv.style.width=c.w*o.scale+'px';cv.style.height=c.h*o.scale+'px';
  host.appendChild(cv);const st0={expr:o.expr,compact:o.compact,cast:0,fam:0,bob:0,breath:0,blink:0};
  if(still()){paint(cv,st0);return cv}
  let t=0,nextBlink=6+Math.floor(Math.random()*8),cast=o.cast?8:0;
  const tick=()=>{t++;st0.breath=t%6<3?0:1;st0.fam=t%4<2?0:1;st0.bob=t%8<4?0:-1;st0.blink=t===nextBlink?1:0;if(t>nextBlink)nextBlink=t+10+Math.floor(Math.random()*12);
    st0.cast=cast>0?(cast--%2)+1:0;paint(cv,st0)};
  live.add({cv,tick});if(!iv)iv=setInterval(loop,260);paint(cv,Object.assign({},st0,{cast:cast?1:0}));return cv}
// one timer for every Luna on screen: a picture that left the page is dropped, a hidden one waits, none left stops it
const live=new Set();let iv=null;
function loop(){live.forEach(a=>{if(!a.cv.isConnected){live.delete(a);return}if(!document.hidden&&!a.cv.closest('[hidden]'))a.tick()});if(!live.size){clearInterval(iv);iv=null}}

/* ---------- preferences ---------- */
const style=()=>['q','g','e'].includes(st.s.lst)?st.s.lst:'g';
const compact=()=>+st.s.lsz===1;

/* ---------- Ask Luna ---------- */
// Features she can find: [route, icon, name, search words, what it is, how to start]. Trackers with a shared header
// (js/v6-hall.js) use that header's text instead of the last two.
const FEAT=[
['water','water','Water log','water drink hydration glass ml thirsty'],
['food','food','Food log','food meal eat calories kcal nutrition breakfast lunch dinner snack menu'],
['sleep','sleep','Sleep log','sleep bed wake rest alarm dream tired'],
['stair','stairs','Stairs & workout','stairs steps climb workout gps stair sense gravity'],
['pulse','pulse','Heart rate','heart rate pulse bpm camera watch strap recovery','Your heart-rate logs: before and after activity.','Count by hand, use the camera or connect a heart-rate strap, then LOG BPM.'],
['stress','stress','Stress check-in','stress mood calm breathe relax worried counsel medius chat grove'],
['body','balance','Body & Energy','bmi weight height energy target macros protein forge'],
['score','achievement','Health Score','score what-if simulator orb recommendations','One 0 to 100 score built from five areas of what you logged.','Open it to see each area and try the What-if simulator.'],
['exercise','workout','Training Hall','exercise training muscle moves calisthenics gym','Pick a goal, then a muscle and a move with its tutorial.','Choose a goal first; Running Road is further down.'],
['run','running','Running Road','run running jog gps pace distance','A GPS run tracker: distance, moving time and pace.','Tap START before you set off; it needs location permission.'],
['stats','chart','Statistics','stats statistics charts trends history report weekly chronicle','Charts of everything you logged, by day, week or month.','Pick a range; the weekly report is at the top.'],
['alchemy','scroll','Alchemist\'s Workshop','alchemy energy food work physics joules','Food energy compared with the work of climbing stairs (a simulation).','Pick a food and a climb to compare.'],
['guide','scroll','HealthWiz guide','guide insights tips patterns notice','Patterns from your own logs, and Luna\'s recent words.','Log for a few days; insights appear as patterns show up.'],
['quests','quest','Quest Board','quests daily weekly xp level rewards','Today\'s quests, weekly quests and your level.','Each logged habit moves a quest forward.'],
['badges','badge','Badge Hall','badges achievements medals collection','Every badge, earned or still to find.','Badges come from logging and games.'],
['kingdom','map','Kingdom map','kingdom map regions world','The eight regions and how each is doing.','Tap a region to see what restores it.'],
['set','gear','Settings','settings backup restore theme music account sign in cloud export delete luna medius','Backup, themes, sound, account and Luna.','Backup and restore are near the top.']];
const H_=()=>typeof HWHall!=='undefined'&&HWHall.heads||{};
const featText=f=>{const h=H_()[f[0]];return h?{what:h.what,how:h.enter,why:h.why,tag:h.kind==='est'?'ESTIMATES':'ENTERED BY YOU'}:{what:f[4],how:f[5]}};
function find(q){q=String(q||'').toLowerCase().trim();if(!q)return FEAT.slice(0,8);const w=q.split(/\s+/);
  return FEAT.map(f=>{const hay=(f[2]+' '+f[3]).toLowerCase();return{f,n:w.filter(x=>hay.includes(x)).length}}).filter(x=>x.n).sort((a,b)=>b.n-a.n).map(x=>x.f)}
const helps=()=>[...document.querySelectorAll('#main .hwh')].filter(b=>b.offsetParent!==null);
const helpName=b=>(b.getAttribute('aria-label')||'').replace(/^About:?\s*/,'')||'Explanation';
function results(q){const s=style(),L=find(q);if(!L.length)return '<p class="mut">No page matches that yet. Try a word such as water, sleep or stairs.</p>';
  return L.map(f=>{const t=featText(f);return '<div class="v6lf"><span class="v6lfi">'+HWPixel.icon(f[1],2)+'</span><div><b>'+esc(f[2])+(t.tag&&s==='e'?' <span class="pxtag">'+t.tag+'</span>':'')+'</b>'+
    (s!=='q'&&t.what?'<small>'+esc(t.what)+'</small>':'')+(s!=='q'&&t.how?'<small><i>Start:</i> '+esc(t.how)+'</small>':'')+(s==='e'&&t.why?'<small><i>Why:</i> '+esc(t.why)+'</small>':'')+
    '</div><button class="g sm" data-a="lunago" data-v="'+f[0]+'" aria-label="Open '+esc(f[2])+'">GO</button></div>'}).join('')}
function sheet(q){const s=style(),H2=helps(),n=(BN[S.v]||[])[1]||'this page';
  return '<div class="card v6lp" role="dialog" aria-modal="true" aria-labelledby="v6lpt"><div class="v6lph"><span class="v6lpic"></span><div><h3 id="v6lpt">ASK LUNA</h3>'+
  '<small>I find pages and open the explanations already in HealthWiz. I don\'t read or change your entries, and I\'m not a doctor.</small></div></div>'+
  '<div class="row" role="group" aria-label="How much help">'+[['q','Quick'],['g','Guided'],['e','Explore']].map(m=>'<button class="chip'+(s===m[0]?' on':'')+'" data-a="lunast" data-m="'+m[0]+'" aria-pressed="'+(s===m[0])+'">'+m[1]+'</button>').join('')+'</div>'+
  '<label for="v6lq"><b>Find a feature</b></label><input id="v6lq" type="search" autocomplete="off" value="'+esc(q||'')+'" aria-describedby="v6lqx v6lres"><small class="mut" id="v6lqx">Example: water, sleep, heart rate</small>'+
  '<div id="v6lres" aria-live="polite">'+results(q)+'</div>'+
  '<h4>Explanations on '+esc(n)+'</h4>'+(H2.length?'<div class="v6lh">'+H2.map((b,i)=>'<button class="chip" data-a="lunahelp" data-i="'+i+'">? '+esc(helpName(b))+'</button>').join('')+'</div>':
    '<p class="mut">This page has no "?" explanations. Calculations such as calories, Health Score and BMI have one beside them.</p>')+
  (s!=='q'?'<div class="row"><button class="g sm" data-a="lunatour">SHOW ME AROUND</button></div><small class="mut">The tour is narrated by Medius, the Wizard King.</small>':'')+
  '<div class="row"><button data-a="mclose">CLOSE</button></div></div>'}
let opened=0;
function open(q){const m=$('#mo');if(!m||!m.hidden&&!m.querySelector('.v6lp'))return; // never over another open dialog
  m.innerHTML=sheet(q);m.hidden=false;opened=1;mount(m.querySelector('.v6lpic'),{expr:'greet',compact:1});
  const i=m.querySelector('#v6lq');if(i){i.oninput=()=>{const r=m.querySelector('#v6lres');if(r)r.innerHTML=results(i.value);const x=m.querySelector('#v6lqx');if(x)x.hidden=!!i.value};if(q)i.dispatchEvent(new Event('input'))}
  HWEvents.emit('luna:opened',{view:S.v})}
function close(){const m=$('#mo');if(m&&m.querySelector('.v6lp')){m.hidden=true;m.innerHTML=''}}
acts.luna=()=>open();
acts.lunast=d=>{st.s.lst=d.m;save();const q=($('#v6lq')||{}).value||'';if($('#mo .v6lp')){open(q);const b=$('#mo [data-a="lunast"][data-m="'+d.m+'"]');if(b)b.focus()}else render()};
acts.lunago=d=>{close();go(d.v)};
acts.lunatour=()=>{close();go('tut')};
// Points at a "?" on the page: scrolls to it, marks it, then opens its explanation.
acts.lunahelp=d=>{const b=helps()[+d.i];close();if(!b)return;b.scrollIntoView({block:'center',behavior:HWUI.reduced()?'auto':'smooth'});b.classList.add('v6lpt');
  setTimeout(()=>b.classList.remove('v6lpt'),2600);setTimeout(()=>{if(b.isConnected&&typeof HWHelp!=='undefined')HWHelp.open(b)},style()==='q'?0:450)};
acts.lunasz=d=>{st.s.lsz=+d.m;save();render();toast('Luna: '+(+d.m?'compact portrait':'full size'))};
acts.lunarst=()=>{delete st.s.lst;delete st.s.lsz;st.s.med=1;save();render();toast('Luna\'s preferences are back to the defaults.')};

/* ---------- a button that opens Ask Luna: the Home bar, and the header of every other page ---------- */
const btn=()=>'<button type="button" class="g v6lb" data-a="luna" aria-label="Ask Luna for help" title="Ask Luna"></button>';
function launcher(){if(S.v==='welcome'||S.v==='onb')return;const m=$('#main');if(!m||m.querySelector('.v6lb'))return;
  const hb=m.querySelector('.hbar>button'),hd=m.querySelector('header');let b=null;
  if(hb){hb.insertAdjacentHTML('beforebegin',btn());b=hb.previousElementSibling}else if(hd){hd.insertAdjacentHTML('beforeend',btn());b=hd.lastElementChild}
  if(b)mount(b,{expr:'idle',compact:'face'})}
{const r=render;render=function(){const x=r.apply(this,arguments);try{launcher()}catch(e){}return x}}

HWUI.css('luna',`
.v6luna{display:block;image-rendering:pixelated;image-rendering:crisp-edges}
.v6lb{display:inline-grid;place-items:center;width:44px;height:44px;min-height:44px;padding:0;margin-left:auto;flex:0 0 auto;overflow:hidden}
header .v6lb{margin-right:56px;align-self:flex-start}.hbar .v6lb{margin:0 0 0 auto}@media(min-width:360px){.hbar>button[data-v=quests]{white-space:nowrap;flex:0 0 auto}}
.hbar>div{min-width:0}.hbar small{overflow-wrap:anywhere} /* a long name wraps instead of widening the page */
.v6lp{width:min(460px,100%)}.v6lph{display:flex;gap:10px;align-items:center;margin-bottom:8px}.v6lph h3{margin:0 0 4px}
.v6lpic{flex:0 0 auto;border:3px solid var(--ln);background:var(--pxdk-bg,#2a2350);box-shadow:3px 3px 0 var(--ln);line-height:0}
.v6lp input{width:100%;margin:4px 0 2px}.v6lp h4{font:8px/1.6 var(--fh);margin:12px 0 6px}
.v6lf{display:flex;gap:8px;align-items:center;border-top:2px solid var(--ln);padding:8px 0}.v6lf>div{flex:1 1 auto;min-width:0}
.v6lf b{display:block}.v6lf small{display:block;color:var(--mut);margin-top:2px}.v6lfi{flex:0 0 auto;line-height:0}
.v6lh{display:flex;flex-wrap:wrap;gap:6px}
.hwh.v6lpt{outline:4px solid var(--gold);outline-offset:3px;animation:v6lpt .5s steps(2) infinite alternate}@keyframes v6lpt{to{outline-color:var(--vio)}}
@media(prefers-reduced-motion:reduce){.hwh.v6lpt{animation:none}}
`);
return{grid,paint,mount,open,close,style,compact,find,expressions:NAMES,EXPR:Object.keys(EXPR),size:{w:W,h:H,crop:CROP,face:FACE}}})();
