/* v6: shared UI helpers for the v6 add-ons. Not part of the original.
   index.html (markup + stylesheet) stays byte-identical to the original, so v6 styles are
   injected from here. Uses the original design tokens (--pn, --ln, --gold, --fh …). */
const HWUI=(()=>{
const done=new Set();
function css(id,text){if(done.has(id))return;done.add(id);const s=document.createElement('style');s.dataset.v6=id;s.textContent=text;document.head.appendChild(s)}
// Device setting, or the in-app Motion/Animations settings once js/v6-motion.js has loaded.
const reduced=()=>{if(typeof HWMotion!=='undefined')return HWMotion.reduced();try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
css('ui',`
.v6cel{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top,0px));z-index:80;transform:translateX(-50%);width:min(340px,92vw);display:flex;gap:10px;align-items:center;background:var(--pn);color:var(--ink);border:4px solid var(--ln);box-shadow:4px 4px 0 var(--ln),0 0 0 3px var(--gold);padding:10px 12px;pointer-events:auto;cursor:pointer;animation:v6in .35s steps(4)}
.v6cel.out{opacity:0;transition:opacity .3s}.v6cel .ic{font-size:30px;line-height:1}.v6cel b{display:block;font:9px/1.6 var(--fh);color:var(--vio)}.v6cel span{display:block;font-size:14px}.v6cel em{font:10px var(--fh);font-style:normal;color:var(--grn)}
.v6cel u{position:absolute;left:30px;top:24px;width:5px;height:5px;background:var(--gold);opacity:0;animation:v6sp .8s ease-out forwards}
@keyframes v6in{from{transform:translate(-50%,-14px);opacity:0}}@keyframes v6sp{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--x),var(--y))}}
@media(prefers-reduced-motion:reduce){.v6cel,.v6cel u{animation:none!important}.v6cel u{display:none}}
#mo{overflow-y:auto}#mo>.card{margin:auto}
.er>span:nth-child(2){word-break:break-word;overflow-wrap:anywhere}
.tsk:active{transform:translate(calc(-50% + 2px),2px)}
.v6q .aq .an small.why{display:block;font-size:11px;color:var(--mut)}.v6q .tagk{display:inline-block;font:7px/1.6 var(--fh);border:2px solid var(--ln);padding:1px 4px;margin-left:4px;background:var(--p2);vertical-align:1px}
`);
// Short, tappable completion banner (§33/§85). Queued so several never stack.
const Q=[];let busy=0;
function celebrate(o){const go=()=>{Q.push(o);if(!busy)next()};if(typeof HWPop!=='undefined')return HWPop.banner(go);go()}
function next(){const o=Q.shift();if(!o){busy=0;return}busy=1;const el=document.createElement('div');el.className='v6cel';el.setAttribute('role','status');
el.innerHTML='<div class="ic">'+(o.icon||'⭐')+'</div><div><b>'+esc(o.title||'QUEST COMPLETE!')+'</b><span>'+esc(o.sub||'')+'</span>'+(o.xp?'<em>+'+o.xp+' XP</em>':'')+'</div>'+(reduced()?'':Array.from({length:typeof HWMotion!=='undefined'?HWMotion.count(10):10},(_,i)=>{const a=i/10*6.283;return '<u style="--x:'+Math.round(Math.cos(a)*60)+'px;--y:'+Math.round(Math.sin(a)*40)+'px;animation-delay:'+(i%3*.06)+'s"></u>'}).join(''));
let gone=0;const close=()=>{if(gone)return;gone=1;el.classList.add('out');setTimeout(()=>{el.remove();next()},300)};el.onclick=close;setTimeout(close,o.ms||2600);document.body.appendChild(el);
if(typeof sfx==='function')[659,784,988].forEach((f,i)=>setTimeout(()=>sfx(f,.09),i*90))}
/* Found while testing (§81, §93, step 25):
   - The shared #mo dialog (edit entry, region details) behaves as a dialog for keyboard and screen-reader users:
     labelled, focus moves in and stays inside, Escape closes it, and focus returns to the button that opened it.
     On a short screen (phone in landscape, keyboard open) it scrolls, so SAVE stays reachable (CSS above).
   - Long unbroken notes or food names in entry rows wrap instead of widening the page on phones (CSS above).
   - SKIP TUTORIAL works by mouse and touch: the shared pressed style (translate 2px) replaced its centring transform,
     so the button jumped half its width away under the finger and the click landed on "next step" (CSS above).
   - The THEME button's choice is remembered (st.s.theme, optional; missing = follow the device as before). */
{const mo=document.querySelector('#mo');let back=null,out=null,open=false;
document.addEventListener('focusin',e=>{if(mo&&!mo.contains(e.target))out=e.target});
const focusables=()=>[...mo.querySelectorAll('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(e=>!e.disabled&&e.offsetParent!==null);
if(mo&&typeof MutationObserver==='function')new MutationObserver(()=>{
  if(mo.hidden){if(!open)return;open=false;const b=back;back=null;if(b&&b.isConnected&&(mo.contains(document.activeElement)||document.activeElement===document.body))b.focus();return}
  if(!open){open=true;back=out}
  const card=mo.querySelector('[role="dialog"]')||mo.firstElementChild;
  if(card&&!card.hasAttribute('role')){card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');const h=card.querySelector('h3');if(h&&!card.hasAttribute('aria-label'))card.setAttribute('aria-label',h.textContent.trim())}
  if(!mo.contains(document.activeElement)){const f=focusables()[0];if(f)f.focus()}
}).observe(mo,{attributes:true,attributeFilter:['hidden'],childList:true});
if(mo)document.addEventListener('keydown',e=>{if(mo.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(acts.mclose)acts.mclose();else mo.hidden=true;return}
  if(e.key==='Tab'){const f=focusables();if(!f.length)return;const i=f.indexOf(document.activeElement);
    if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}}},true)}
{const t=st.s&&st.s.theme;if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;
const o=acts.theme;if(o)acts.theme=function(){const r=o.apply(this,arguments);st.s.theme=document.documentElement.dataset.theme;save();return r}}
return{css,celebrate,reduced}})();

/* v6 (usability, item 3): one popup at a time. XP toasts, other toasts, completion banners and badge cards used to stack on top
   of each other (three on a first visit) and could land on a form or the sign-in dialog. Now they share one line:
   · one popup shows; the rest wait their turn (a short pause between two)
   · XP toasts, completion banners and badge cards never show while a field has focus, a dialog is open (the shared #mo dialog,
     the sign-in dialog) or the Registry / title screen is open: they wait until the way is clear. Feedback for what you just did
     ("Check height and weight", "Saved") is not held back by that, only kept in line.
   · XP toasts waiting together are merged into one (+10 XP Water, Meal); an XP toast that waited 20 s is dropped as stale.
   Nothing here is saved. */
const HWPop=(()=>{
const Q=[];let cur=null,tm=0;
const XP=/^\+(\d+) XP\s*(.*)$/;
function busy(){const a=document.activeElement,mo=document.getElementById('mo'),sv=typeof S!=='undefined'?S.v:'';
  return !!(a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName))||!!(mo&&!mo.hidden)||!!document.querySelector('.v6ac,[role="dialog"]:not([hidden])')||sv==='onb'||sv==='welcome'}
const pri=x=>x.crit?0:x.xp?2:1;   // feedback first, then badge cards and banners, then the XP line
function pump(){clearTimeout(tm);tm=0;if(cur||!Q.length)return;const now=Date.now();
  for(let i=Q.length-1;i>=0;i--)if(Q[i].xp&&now-Q[i].at>20000)Q.splice(i,1);
  // feedback for what you just did goes first; rewards wait until nothing is in the way
  let i=-1;const b=busy();Q.forEach((x,k)=>{if(b&&!x.crit)return;if(i<0||pri(x)<pri(Q[i]))i=k});
  if(i<0){if(Q.length)tm=setTimeout(pump,500);return}
  const it=Q.splice(i,1)[0];let fin=0;const end=()=>{if(fin)return;fin=1;if(cur===it)cur=null;if(it.gap===0)pump();else tm=setTimeout(pump,100)};cur=it;it.end=end;it.show(end)}
function add(it){it.at=Date.now();Q.push(it);
  if(cur&&cur.cut&&(it.crit&&cur.xp||it.urgent))cur.cut();   // a reward on screen gives way to feedback for what you just did; a warning gives way to nothing
  pump()}
// wait until a popup the old code made is gone (it removes itself), then free the line
function watch(sel,end,n){n=n||0;if(!document.querySelector(sel)||n>100)return end();setTimeout(()=>watch(sel,end,n+1),50)}
function toast(m){const x=XP.exec(String(m));
  if(x){const q=Q.find(y=>y.xp);if(q){q.n+=+x[1];if(x[2])q.why.push(x[2]);return}}
  const it={xp:!!x,crit:!x,urgent:!x&&/^⚠️/.test(String(m)),n:x?+x[1]:0,why:x&&x[2]?[x[2]]:[],m:m,show(end){const d=document.createElement('div');
    d.innerHTML=this.xp?'+'+this.n+' XP '+this.why.join(' · '):this.m;const T=document.getElementById('toasts');if(!T){end();return}T.appendChild(d);
    const t=setTimeout(()=>{d.remove();end()},Q.length?1800:3200);this.cut=()=>{clearTimeout(t);d.remove();this.gap=0;end()}}};
  add(it)}
const badge=go=>add({kind:'badge',show(end){go();watch('.bpop',end)}});
const banner=go=>add({show(end){go();watch('.v6cel',end)}});
return{toast,badge,banner,get waiting(){return Q.length},idle:()=>!cur&&!Q.length&&!tm,badgePending:()=>Q.some(x=>x.kind==='badge')||!!(cur&&cur.kind==='badge')}})();
