/* v6 (comfort pass): the EXP bar as flowing mana. Not part of the original.
   The two level bars (the page header's .lv and the Hero Card on Home) keep their data, text and markup (a .bar with
   one <i> fill, from bar()); this add-on restyles them and animates CHANGES only:
     · a slim rounded track, a blue → violet energy fill with a soft gold edge and a slow sheen (no pixel segments);
     · when XP rises, the fill flows from the value last shown to the new one, and a small "+N XP" rises beside it;
     · on a level-up the fill flows to full, glows once, then refills from the start of the new level, and the label
       reads LEVEL UP for a moment;
     · each bar is a progressbar for screen readers (current XP of the level's range).
   Reduced motion: no flow, sheen or glow — the bar simply shows the new value. Redrawn pages never replay a change. */
const HWExpBar=(()=>{
let shown=null; // {xp, lv} last drawn
const frac=L=>L.hi?Math.max(0,Math.min(1,(st.xp-L.lo)/(L.hi-L.lo))):1;
const bars=()=>[...document.querySelectorAll('main header .lv .bar, #pcard .pci > .bar')];
function label(b,L){b.setAttribute('role','progressbar');b.setAttribute('aria-label','Experience, level '+(L.i+1));
  b.setAttribute('aria-valuemin','0');b.setAttribute('aria-valuemax',String(L.hi?L.hi-L.lo:1));b.setAttribute('aria-valuenow',String(L.hi?Math.max(0,st.xp-L.lo):1));
  b.setAttribute('aria-valuetext',st.xp+' XP'+(L.hi?', '+(L.hi-st.xp)+' to level '+(L.i+2):', max level'))}
function set(i,w,anim){i.style.transition=anim?'':'none';i.style.width=(w*100).toFixed(2)+'%';if(!anim)void i.offsetWidth}
function draw(){const L=lvl(),B=bars();if(!B.length){shown={xp:st.xp,lv:L.i};return}
  const rm=HWMotion.reduced(),prev=shown,gained=prev&&st.xp>prev.xp?st.xp-prev.xp:0,up=prev&&L.i>prev.lv;
  B.forEach(b=>{b.classList.add('xpb');label(b,L);const i=b.querySelector('i');if(!i)return;
    if(b.dataset.xpAt===String(st.xp))return; // already drawn (and maybe still flowing)
    if(!gained||rm){set(i,frac(L),false);b.dataset.xpAt=st.xp;return}
    b.dataset.xpAt=st.xp;
    // start from what was on screen, then flow
    const pl=LV[prev.lv],ph=LV[prev.lv+1],from=up?(ph?(prev.xp-pl[1])/(ph[1]-pl[1]):1):(L.hi?(prev.xp-L.lo)/(L.hi-L.lo):1);
    set(i,Math.max(0,Math.min(1,from)),false);
    requestAnimationFrame(()=>{b.classList.add('xpb-flow');
      if(up){set(i,1,true);setTimeout(()=>{if(!b.isConnected)return;b.classList.add('xpb-up');set(i,0,false);requestAnimationFrame(()=>set(i,frac(L),true));
        setTimeout(()=>b.classList.remove('xpb-up'),1400)},700)}
      else set(i,frac(L),true);
      setTimeout(()=>b.classList.remove('xpb-flow'),1300)});
    b.querySelectorAll('.xpb-gain').forEach(x=>x.remove());const g=document.createElement('span');g.className='xpb-gain';g.textContent=up?'LEVEL UP':'+'+gained+' XP';g.setAttribute('aria-hidden','true');b.appendChild(g);setTimeout(()=>g.remove(),1600)});
  shown={xp:st.xp,lv:L.i}}
// after every page draw, and when XP arrives without one (e.g. the exploration reward)
{const r=render;render=function(){const x=r.apply(this,arguments);try{draw()}catch(e){console.error('[HWExpBar]',e)}return x}}
HWEvents.on('xp:gained',()=>requestAnimationFrame(()=>{try{
  const L=lvl(),h=document.querySelector('main header .lv');
  if(h){const b=h.querySelector('b'),s=h.querySelector('small');if(b)b.textContent='Lv '+(L.i+1)+' · '+L.n;if(s)s.textContent=st.xp+' XP'+(L.hi?' / '+L.hi:'')}
  draw()}catch(e){console.error('[HWExpBar]',e)}}));
// a reset or import starts from the stored value, never "flows" from the old one
['data:reset','data:imported'].forEach(t=>HWEvents.on(t,()=>{shown=null}));

HWUI.css('expbar',`
.bar.xpb{height:12px;border:0;border-radius:999px;background:var(--p2);background:color-mix(in srgb,var(--ink) 14%,var(--p2));box-shadow:inset 0 1px 2px rgba(0,0,0,.25);overflow:visible;margin:6px 0 4px}
.bar.xpb:after{display:none}
.bar.xpb i{position:relative;height:100%;border-radius:inherit;overflow:hidden;min-width:0;
  background:linear-gradient(90deg,#3f8fd6,#6f7fe0 55%,#9a7ae0);box-shadow:0 0 6px rgba(120,130,230,.45),inset 0 1px 0 rgba(255,255,255,.35);
  transition:width .9s cubic-bezier(.25,.8,.3,1)}
.bar.xpb i:before{content:"";position:absolute;right:0;top:0;bottom:0;width:6px;border-radius:inherit;background:linear-gradient(90deg,rgba(242,193,78,0),rgba(255,226,140,.9))}
.bar.xpb i:after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 0 35%,rgba(255,255,255,.28) 50%,transparent 65% 100%);background-size:220% 100%;animation:xpbsh 4.5s linear infinite}
.bar.xpb.xpb-flow i:after{animation-duration:1.2s}
@keyframes xpbsh{from{background-position:120% 0}to{background-position:-100% 0}}
.bar.xpb.xpb-up i{box-shadow:0 0 12px 2px rgba(242,193,78,.75),inset 0 1px 0 rgba(255,255,255,.4)}
.bar.xpb{position:relative}
.xpb-gain{position:absolute;right:0;top:-4px;transform:translateY(-100%);font:7px/1 var(--fh);color:var(--ink);background:var(--pn);border:2px solid var(--gold);border-radius:6px;padding:3px 5px;white-space:nowrap;pointer-events:none;animation:xpbg 1.6s ease-out forwards}
@keyframes xpbg{0%{opacity:0;transform:translateY(-60%)}15%{opacity:1;transform:translateY(-100%)}75%{opacity:1}100%{opacity:0;transform:translateY(-150%)}}
@media(prefers-reduced-motion:reduce){.bar.xpb i{transition:none!important}.bar.xpb i:after{animation:none!important;display:none}.xpb-gain{display:none}}
html.hw-q-performance .bar.xpb i:after{animation:none;display:none}
`);
return{draw,get shown(){return shown}}})();
