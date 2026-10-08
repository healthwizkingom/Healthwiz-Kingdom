/* v6 (comfort pass): every progress bar in the modern HealthWiz style; the EXP bar as flowing mana. Not part of the original.
   ALL BARS (the shared .bar from bar(): calories, water, quests, attributes, macros, Health Hall tiles, connections…;
   the Dream Battle's energy/HP bars; the macro energy split; the sleep-strength scale) keep their data, colours
   (--c) and markup, and get one look: a slim rounded track, a soft highlight on the fill, no pixel segments or
   chunky borders, and a smooth width transition. When a page is redrawn and a bar's value changed (e.g. calories
   after logging), it flows from the old value to the new one; unchanged bars never move.
   THE EXP BAR (the page header's .lv and the Hero Card on Home) additionally:
     · a blue → violet energy fill with a soft gold edge and a slow sheen;
     · when XP rises, the fill flows from the value last shown to the new one, and a small "+N XP" rises beside it;
     · on a level-up the fill flows to full, glows once, then refills from the start of the new level;
     · each bar is a progressbar for screen readers (current XP of the level's range).
   Reduced motion: no flow, sheen or glow — bars simply show the new value. */
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
    b.dataset.flowing='1';setTimeout(()=>{delete b.dataset.flowing},1300);
    requestAnimationFrame(()=>{b.classList.add('xpb-flow');
      if(up){set(i,1,true);setTimeout(()=>{if(!b.isConnected)return;b.classList.add('xpb-up');set(i,0,false);requestAnimationFrame(()=>set(i,frac(L),true));
        setTimeout(()=>b.classList.remove('xpb-up'),1400)},700)}
      else set(i,frac(L),true);
      setTimeout(()=>b.classList.remove('xpb-flow'),1300)});
    b.querySelectorAll('.xpb-gain').forEach(x=>x.remove());const g=document.createElement('span');g.className='xpb-gain';g.textContent=up?'LEVEL UP':'+'+gained+' XP';g.setAttribute('aria-hidden','true');b.appendChild(g);setTimeout(()=>g.remove(),1600)});
  shown={xp:st.xp,lv:L.i}}
// every bar: just before a page draw, measure what each bar shows on screen (mid-flow included); after the draw, a bar
// of the same page whose value changed flows from there to its new value. Unchanged bars never move.
let cap={v:null,w:new Map()};
// a bar's identity: the nearest element with an id (a card, a tile…) and its position inside it
function keyed(){const n=new Map(),out=[];document.querySelectorAll('#main .bar > i').forEach(i=>{const h=i.parentNode.closest('[id]'),id=h?h.id:'',c=(n.get(id)||0)+1;n.set(id,c);out.push([id+'#'+c,i])});return out}
function measure(){const w=new Map();keyed().forEach(([k,i])=>{const p=i.parentNode.getBoundingClientRect().width;if(p)w.set(k,i.getBoundingClientRect().width/p*100)});cap={v:S.v,w}}
function flowAll(){if(cap.v!==S.v||HWMotion.reduced())return;
  keyed().forEach(([k,i])=>{const from=cap.w.get(k),to=parseFloat(i.style.width);if(from==null||!isFinite(to)||Math.abs(from-to)<.5)return;
    if(i.parentNode.dataset.flowing)return; // the EXP bar's own flow is running
    i.style.transition='none';i.style.width=from.toFixed(2)+'%';void i.offsetWidth;i.style.transition='';requestAnimationFrame(()=>{i.style.width=to+'%'})})}
// after every page draw, and when XP arrives without one (e.g. the exploration reward)
{const r=render;render=function(){try{measure()}catch(e){cap={v:null,w:new Map()}}const x=r.apply(this,arguments);try{draw();flowAll()}catch(e){console.error('[HWExpBar]',e)}return x}}
HWEvents.on('xp:gained',()=>requestAnimationFrame(()=>{try{
  const L=lvl(),h=document.querySelector('main header .lv');
  if(h){const b=h.querySelector('b'),s=h.querySelector('small');if(b)b.textContent='Lv '+(L.i+1)+' · '+L.n;if(s)s.textContent=st.xp+' XP'+(L.hi?' / '+L.hi:'')}
  draw()}catch(e){console.error('[HWExpBar]',e)}}));
// a reset or import starts from the stored value, never "flows" from the old one
['data:reset','data:imported'].forEach(t=>HWEvents.on(t,()=>{shown=null}));

HWUI.css('expbar',`
.bar{height:12px;border:0;border-radius:999px;background:var(--p2);background:color-mix(in srgb,var(--ink) 12%,var(--p2));box-shadow:inset 0 1px 2px rgba(0,0,0,.22);overflow:hidden;margin:6px 0}
.bar:after{display:none}
.bar i{border-radius:inherit;background:linear-gradient(180deg,rgba(255,255,255,.3),rgba(255,255,255,0) 65%),var(--c);box-shadow:none;transition:width .8s cubic-bezier(.25,.8,.3,1)}
.attr .bar,.ts .bar,.mx .bar{height:8px;margin:4px 0;border:0}
.esplit{height:12px;border:0;border-radius:999px;background:var(--p2);background:color-mix(in srgb,var(--ink) 12%,var(--p2));box-shadow:inset 0 1px 2px rgba(0,0,0,.22)}
.esplit i{background-image:linear-gradient(180deg,rgba(255,255,255,.3),rgba(255,255,255,0) 65%)}
.esplit i+i{box-shadow:-1px 0 0 var(--pn)}
.db6bar{height:7px;border:0;border-radius:999px;background:rgba(255,255,255,.16);box-shadow:inset 0 1px 2px rgba(0,0,0,.5);overflow:hidden}
.db6bar i{border-radius:inherit;transition:width .5s cubic-bezier(.25,.8,.3,1)}
.db6bar.d-en i{background:linear-gradient(180deg,#ffe08a,#f2c14e 60%,#d9a02e)}.db6bar.d-hp i{background:linear-gradient(180deg,#ff8a7a,#e0483f 60%,#b0302a)}
.db6sc .d-tr{border:0;border-radius:999px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.25)}
.db6sc .d-mk{border-radius:2px}
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
@media(prefers-reduced-motion:reduce){.bar i,.db6bar i,.bar.xpb i{transition:none!important}.bar.xpb i:after{animation:none!important;display:none}.xpb-gain{display:none}}
html.hw-q-performance .bar.xpb i:after{animation:none;display:none}
`);
return{draw,get shown(){return shown}}})();
