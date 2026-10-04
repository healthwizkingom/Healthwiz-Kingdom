/* v6 (final polish): the Storm Within knight reacts to the stress rating. Not part of the original.
   The knight is the same art as everywhere else (kn.webp through the character rig, js/v6-rig.js). On top of his
   own face sits a small pixel layer (brows, eyelids, eyes, mouth, sweat, colour) drawn in the image's own pixel grid,
   so it moves with his head. Every feature is driven by CSS custom properties on the scene (.qs), worked out from the
   rating by interpolating between five reference expressions:
       1–2 calm · 3–4 slightly concerned · 5–6 tense · 7–8 distressed · 9–10 overwhelmed
   so each step of the slider changes the face a little, never a binary swap, and CSS transitions blend one rating into
   the next. A portrait close-up (the same head at 2×) makes the face readable on a phone, and a word under the
   stress meter names the mood, so nothing depends on colour or on seeing the animation.
   Also driven by the rating: breathing speed, posture (a slight crouch and lean, the shield raised when distressed, a
   faint tremble when overwhelmed), a light behind the knight (warm → cold) and flowers that droop and fade.
   Repaint: dragging the slider no longer rebuilds the scene. The weather layers are swapped and the knight, portrait,
   light and flowers are kept, with only the scene's style changing, so the face transitions instead of jumping.
   Blinking and the sweat drop are CSS loops: they stop with reduced motion / Animations Off (the original rule
   `.qs *{animation:none}` and js/v6-motion.js), pause off-screen and in a hidden tab, and cost no JavaScript. */
const HWStorm=(()=>{
// reference expressions at s = 0, .25, .5, .75, 1 (s = (rating − 1) / 9)
const K={
  lbr:[-3,-8,13,-12,-18],   // left brow angle (+ = inner end down: a frown)
  rbr:[3,8,-13,12,18],      // right brow (mirrored)
  bry:[-1,-1,.5,-1,-2],     // brows up (−) / down (+), image px
  lid:[1.4,.6,0,-.8,-1],    // upper lids lowered (+, relaxed) or opened wide (−)
  mc:[2,.6,-.8,-1.8,-2.4],  // mouth curve: + smile, − frown
  mw:[0,0,0,.5,.8],         // mouth wobble (a trembling line)
  tee:[0,0,0,.25,1],        // gritted teeth
  fur:[0,0,.9,.6,1],        // furrow between the brows
  und:[0,0,.25,.6,.9],      // shadows under the eyes
  swt:[0,0,0,.7,1],         // sweat drop
  blu:[.55,.25,0,0,0],      // warm cheeks
  pal:[0,0,.04,.08,.12],    // pale, cold tint
  brd:[3.4,3,2.4,1.8,1.3]}; // breathing period (s)
const MINE=/^\s*--(sv|lbr|rbr|bry|lid|mc|mw|tee|fur|und|swt|blu|pal|brd|m\d)\s*:/;
const WORD=['Calm','Slightly concerned','Tense','Distressed','Overwhelmed'];
const lerp=(a,s)=>{const x=Math.max(0,Math.min(1,s))*4,i=Math.min(3,Math.floor(x)),f=x-i;return a[i]+(a[i+1]-a[i])*f};
const sOf=r=>(Math.max(1,Math.min(10,+r||1))-1)/9;
const band=r=>Math.min(4,Math.floor((Math.max(1,Math.min(10,+r||1))-1)/2));
const word=r=>WORD[band(r)];
const r2=x=>Math.round(x*100)/100;
function vars(s){const v={sv:r2(s)};for(const k in K)v[k]=r2(lerp(K[k],s));
  const c=v.mc,w=v.mw;for(let i=0;i<7;i++){const u=(i-3)/3;v['m'+i]=r2(-c*u*u+(i%2?w:-w)*(i&&i<6?1:0))}
  return Object.entries(v).map(([k,x])=>'--'+k+':'+x+(k==='brd'?'s':'')).join(';')}

// the face layer, in kn.webp pixels (260 × 275); patches re-skin the original eyes and mouth, then the features
const R=(x,y,w,h,c,cl)=>'<rect'+(cl?' class="'+cl+'"':'')+' x="'+x+'" y="'+y+'" width="'+w+'" height="'+h+'" fill="'+c+'"/>';
const FACE='<g class="sf" shape-rendering="crispEdges">'
  // skin under the eyes and brows, with the shading of the original
  +R(146,51,20,17,'#f2ae85')+R(146,51,2,13,'#c8704b')+R(146,64,2,4,'#e2956f')+R(164,56,2,8,'#e09a74')+R(148,67,17,1,'#e3a37c')
  +R(171,56,11,12,'#eea47b')+R(171,61,2,7,'#cc714f')+R(180,58,2,10,'#b86d56')
  // mouth patch
  +R(155,79,18,1,'#f2b086')+R(155,80,18,1,'#eaa17d')+R(155,81,18,2,'#f1aa80')+R(155,83,18,1,'#de926d')
  // warm cheeks / under-eye shadows / furrow
  +'<g class="sfb">'+R(148,70,5,2,'#ee8a7a')+R(171,69,4,2,'#ee8a7a')+'</g>'
  +'<g class="sfu">'+R(149,68,11,1,'#b97a68')+R(173,68,6,1,'#b97a68')+'</g>'
  // eyes (the blink squashes both, lids open or close with the mood)
  +'<g class="sfe"><g class="sfd">'
  +R(148,61,5,6,'#f3ece6')+R(153,61,7,6,'#2f5a85')+R(153,65,7,1,'#4f789c')+R(156,62,2,4,'#050816')+R(154,62,1,1,'#cfe0f2')+R(160,61,2,6,'#3b2422')
  +R(173,61,4,6,'#efe6dd')+R(176,62,1,4,'#3c4c68')+R(177,62,2,4,'#04050f')+R(179,61,1,6,'#7a4f45')
  +'</g>'+R(149,67,11,1,'#d9a58e')+R(173,67,6,1,'#d9a58e')
  +'<g class="sfl">'+R(147,55,19,5,'#f2ae85')+R(147,60,19,2,'#140508')+R(171,56,10,4,'#eea47b')+R(171,60,11,2,'#140508')+'</g></g>'
  // brows
  +'<g class="sfbr sfbl">'+R(146,54,17,3,'#1a0710')+R(147,57,15,1,'#6b3a32')+'</g>'
  +'<g class="sfbr sfbr2">'+R(172,57,9,3,'#1a0710')+R(173,60,7,1,'#6b3a32')+'</g>'
  +'<g class="sff">'+R(166,56,1,3,'#b8664a')+R(167,57,1,2,'#d88a66')+'</g>'
  // mouth: seven segments that bend into a smile, a line, a frown or a tremble; gritted teeth on top
  +[0,1,2,3,4,5,6].map(i=>'<g class="sfm" style="transform:translateY(calc(var(--m'+i+',0)*1px))">'+R(156+i*2,81,2,1,'#7a2a16')+R(156+i*2,82,2,1,'#b4583a')+'</g>').join('')
  +'<g class="sft">'+R(157,80,13,4,'#4a1410')+R(158,81,11,2,'#f2e8dc')+R(161,81,1,2,'#c9b8a8')+R(164,81,1,2,'#c9b8a8')+R(167,81,1,2,'#c9b8a8')+'</g>'
  // cold tint, sweat
  +'<polygon class="sfp" points="146,51 166,50 182,58 182,84 172,92 156,92 146,84" fill="#8fa6c8"/>'
  +'<g class="sfs">'+R(142,56,2,3,'#bfe6ff')+R(142,59,2,1,'#7fbde8')+R(142,56,1,1,'#ffffff')+'</g>'
  +'</g>';

function knight(r){let h=HWRig.knight({cls:'stkr'});
  // the face goes inside the head part, after the head image, so it follows every head movement
  h=h.replace(/(<g class="r-p r-hd"[^>]*><use[^>]*\/>)/,'$1'+FACE);
  return '<div class="qh stk" role="img" aria-label="The knight looks '+word(r).toLowerCase()+'"><div class="stt"><div class="stp">'+h+'</div></div></div>'}
function portrait(r){return '<div class="stpo" aria-hidden="true"><svg viewBox="138 44 48 48" width="96" height="96" focusable="false"><image href="'+KN+'" xlink:href="'+KN+'" width="260" height="275" preserveAspectRatio="none"/>'+FACE+'</svg><b>'+word(r).toUpperCase()+'</b></div>'}
const FL=[9,27,63,83];
const extras=()=>'<div class="stau" aria-hidden="true"><i></i><i></i></div>'+FL.map((x,i)=>'<i class="stfl" aria-hidden="true" style="left:'+x+'%;--fd:'+(i*.6)+'s"><u></u></i>').join('');

// what the face shows right now (so a full re-render starts from it and transitions to the new rating)
let shown=null;
const rated=()=>typeof S!=='undefined'&&S.sq&&S.sq.r!=null&&S.sq.ph!=='start';
const _scene=sqScene;
sqScene=function(r,cr){let h=_scene(r,cr);const hero='<div class="qh">'+HERO(4)+'</div>',i=h.lastIndexOf(hero);
  if(i<0||typeof HWRig==='undefined')return h;
  const s=rated()?sOf(r):.3,from=shown==null?s:shown;
  const lr=rated()?r:1+9*s; // before a rating the knight is only a little uneasy
  h=h.slice(0,i)+extras()+knight(lr)+portrait(lr)+h.slice(i+hero.length);
  // the storm's creatures make room for the portrait in the top-left corner (after the splice: this changes lengths)
  h=h.replace(/class="qcr" style="left:([\d.]+)%/g,(m,x)=>'class="qcr" style="left:'+(22+x*.85).toFixed(1)+'%');
  h=h.replace('<div class="qs" style="','<div class="qs st6'+(s>=.85?' st6hi':'')+'" style="'+vars(from)+';');
  // next frame: blend to the rating as it is THEN (the slider may already have moved on)
  if(from!==s)requestAnimationFrame(()=>requestAnimationFrame(()=>{const q=document.querySelector('#qsc .qs.st6');if(!q)return;
    const now=rated()?S.sq.r:r;setMood(q,rated()?now:1+9*.3,rated()?sOf(now):.3)}));
  shown=s;return h};
function setMood(q,r,s){const style=q.getAttribute('style')||'',base=style.split(';').filter(x=>x.trim()&&!MINE.test(x)).join(';');
  q.setAttribute('style',base+';'+vars(s));q.classList.toggle('st6hi',s>=.85);
  q.querySelectorAll('.stpo b').forEach(b=>b.textContent=word(r).toUpperCase());
  const k=q.querySelector('.stk');if(k)k.setAttribute('aria-label','The knight looks '+word(r).toLowerCase())}

// slider repaint: swap the weather, keep the knight, portrait, light and flowers so they transition
const KEEP='.stk,.stpo,.stau,.stfl';
sqPaint=function(){const q=S.sq,host=$('#qsc'),old=host&&host.querySelector('.qs.st6');
  if(!old){host&&(host.innerHTML=sqScene(q.r,q.all))}
  else{const t=document.createElement('div');t.innerHTML=sqScene(q.r,q.all);const nw=t.firstElementChild;
    [...old.children].forEach(c=>{if(!c.matches(KEEP))c.remove()});
    nw.querySelectorAll(KEEP).forEach(c=>c.remove());const first=old.firstElementChild;[...nw.children].forEach(c=>old.insertBefore(c,first));
    old.style.background=nw.style.background;old.style.setProperty('--sp',nw.style.getPropertyValue('--sp'));
    setMood(old,q.r,sOf(q.r))}
  $('#qmt').innerHTML=sqMeter(q.r);sfx(q.r>6?150:600,.08)};

// the meter names the mood in words
const _meter=sqMeter;
sqMeter=function(r){return _meter(r)+'<div class="st6w">KNIGHT: <b>'+word(r).toUpperCase()+'</b></div>'};

HWUI.css('storm',`
.qs.st6 .qh.stk{left:auto;right:auto;left:calc(50% - 46px);bottom:13%;width:92px;z-index:4}
.stt,.stp{transform-origin:50% 100%}
.stp{transform:translateY(calc(var(--sv,0)*3px)) rotate(calc(var(--sv,0)*-2.5deg)) scaleY(calc(1 - var(--sv,0)*.045));transition:transform .8s ease}
.st6hi .stt{animation:st6tr .18s steps(2) infinite}
@keyframes st6tr{50%{transform:translateX(.8px)}}
.stk .rgk .r-bd{animation-duration:var(--brd,2.6s)}
.stk .rgk .r-sh{transition:transform .6s ease}
.st6hi .stk .rgk .r-sh{animation:none;transform:translate(-8px,-12px) rotate(-6deg)}
.sf .sfbr,.sf .sfl,.sf .sfm,.sf .sfb,.sf .sfu,.sf .sff,.sf .sft,.sf .sfp,.sf .sfs{transform-box:view-box;transition:transform .7s ease,opacity .7s ease}
.sf .sfbl{transform-origin:154.5px 55.5px;transform:translateY(calc(var(--bry,0)*1px)) rotate(calc(var(--lbr,0)*1deg))}
.sf .sfbr2{transform-origin:176.5px 58.5px;transform:translateY(calc(var(--bry,0)*1px)) rotate(calc(var(--rbr,0)*1deg))}
.sf .sfl{transform:translateY(calc(var(--lid,0)*1px))}
.sf .sfb{opacity:var(--blu,0)}.sf .sfu{opacity:var(--und,0)}.sf .sff{opacity:var(--fur,0)}.sf .sft{opacity:var(--tee,0)}.sf .sfp{opacity:var(--pal,0)}
.sf .sfs{opacity:var(--swt,0);animation:st6sw 2.6s ease-in infinite}
@keyframes st6sw{0%{transform:translateY(0)}80%{transform:translateY(7px)}100%{transform:translateY(8px);opacity:0}}
.sf .sfe{transform-box:view-box;transform-origin:0 64px;animation:st6bl var(--bk,4.6s) infinite}
.st6hi .sf .sfe{--bk:2.4s}
@keyframes st6bl{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}
.st6hi .sf .sfd{animation:st6dt 1.7s steps(1) infinite}
@keyframes st6dt{0%{transform:translateX(0)}35%{transform:translateX(-1px)}70%{transform:translateX(1px)}}
.stpo{position:absolute;left:8px;top:8px;z-index:7;width:96px;padding:0;background:#2b2418;border:3px solid var(--ln);box-shadow:3px 3px 0 rgba(0,0,0,.35),inset 0 0 0 2px var(--gold);line-height:0}
.stpo svg{display:block;width:100%;height:auto;image-rendering:pixelated;background:linear-gradient(#34465f,#4d6683)}
.stpo b{display:block;font:7px/1.6 var(--fh);color:#f6edcf;background:#2b2418;text-align:center;padding:2px 2px 1px;letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stau{position:absolute;left:calc(50% - 80px);bottom:10%;width:160px;height:120px;z-index:3;pointer-events:none}
.stau i{position:absolute;inset:0;border-radius:50%;transition:opacity .9s ease}
.stau i:first-child{background:radial-gradient(closest-side,rgba(255,226,122,.55),rgba(255,226,122,0));opacity:calc(1 - var(--sv,0)*1.4)}
.stau i:last-child{background:radial-gradient(closest-side,rgba(70,90,140,.45),rgba(70,90,140,0));opacity:calc(var(--sv,0)*1.2 - .2)}
.stfl{position:absolute;bottom:18%;z-index:3;width:8px;height:16px;transform-origin:50% 100%;transform:rotate(calc(var(--sv,0)*34deg));transition:transform 1s ease}
.stfl:before{content:"";position:absolute;left:3px;bottom:0;width:2px;height:12px;background:#2f7a38}
.stfl u{position:absolute;left:0;top:0;width:8px;height:6px;background:#f2c14e;box-shadow:inset 2px 0 #e86a5a,inset -2px 0 #e86a5a;filter:saturate(calc(1 - var(--sv,0)*.85)) brightness(calc(1 - var(--sv,0)*.3));transition:filter 1s ease;animation:st6fl 3.4s ease-in-out infinite alternate;animation-delay:calc(-1 * var(--fd,0s));transform-origin:50% 100%}
@keyframes st6fl{to{transform:rotate(8deg)}}
.st6w{font:8px/1.6 var(--fh);margin:-4px 0 8px}.st6w b{color:var(--vio)}
@media(max-width:520px){.stpo{width:72px}.stpo b{font-size:6px}.qs.st6 .qh.stk{width:80px;left:calc(50% - 40px)}}
@media(prefers-reduced-motion:reduce){.stp,.stfl,.sf *{transition:none!important}}
html.hw-q-performance .stfl u,html.hw-q-performance .st6hi .sf .sfd{animation:none}
`);
return{word,band,sOf,vars,K}})();
