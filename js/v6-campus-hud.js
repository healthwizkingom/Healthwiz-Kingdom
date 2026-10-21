/* v6: the Campus map's HUD (owner's request, 2026-10-21, after two screen recordings of Pokemon GO the owner sent: a
   reference for the mechanics and the look only; every drawing here is original). Not part of the original.
   * One HealthWiz button at the bottom middle of the map holds every map button that sat down the right side, the
     search and the Legend from the left: tapped, a mint menu opens over the map with the search on top and the buttons as
     round icons under their names. The round x at the bottom, Escape, or any button in it closes it.
   * Details live inside the map: a sheet rises from the bottom with two tabs, STAIRS (the staircase, its climb forms and
     its data) and WORKOUT (the workout with heart rate). It opens as a strip a fifth of the map high; dragging its handle
     (or tapping it) takes it to half the map. Its content scrolls inside it. The round x closes it; the staircase stays
     picked and the selection bar's Details button opens it again.
   * NEAREST STAIRS: a round button that sends a wave out of the avatar (or the middle of the map while no position is
     known) and opens the closest staircases with CHECK IN for one you are standing at: the GPS check-in of
     js/v6-gps.js, which reads the position once and never saves it. A demo walk's position is simulated, so it lists
     the nearest staircases without CHECK IN.
   * Stay aware: each time the map opens, a notice asks the player to mind their surroundings; OK closes it.
   State: memory only (menu, sheet size, legend, notice); nothing is saved. Shown only with the map (http(s) + WebGL);
   without it the Details stay below the map as before. */
const HWCampusHud=(()=>{
const D0=document,$id=i=>D0.getElementById(i),ico=(n,s)=>HWPixel.icon(n,s||1);
let menu=false,leg=false,size='peek',aw=false,seen=false,dragged=false;
const C=()=>typeof HWCampus!=='undefined'?HWCampus:null;
const redraw=()=>{const c=C();if(c&&c.redraw)c.redraw()};
const reduced=()=>typeof HWUI!=='undefined'&&HWUI.reduced();

/* ---------- the HealthWiz button and its menu ---------- */
const WAVE='<svg viewBox="0 0 24 24" aria-hidden="true" class="cmpsv2"><circle cx="12" cy="12" r="2.5"/><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9"/><path d="M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8"/></svg>';
function menuHtml(o){
  return '<div class="hudmenu" id="hudmenu" role="dialog" aria-modal="false" aria-label="HealthWiz map menu"><div class="hudscr">'
    +'<div class="hudfind">'+o.find+'</div>'
    +'<ul class="hudgrid">'+o.items.map(([a,l,t,i,x])=>'<li><span class="hudl" aria-hidden="true">'+l+'</span><button type="button" class="hudi" data-a="'+a+'" aria-label="'+t+'" title="'+t+'"'+(x||'')+'>'+i+'</button></li>').join('')+'</ul></div>'
    +'<button type="button" class="hudx" data-a="hudmenu" aria-label="Close the menu">×</button></div>'}
/** Everything the HUD draws on the map stage. o: {items, find, legend, sheet}. */
function html(o){if(!seen){seen=true;aw=true}
  return '<button type="button" class="hudbtn" data-a="hudmenu" aria-expanded="'+menu+'" aria-controls="hudmenu" aria-label="HealthWiz menu: map buttons, search and legend"><img src="assets/icons/icon-192.png" alt="" width="56" height="56"></button>'
    +'<button type="button" class="hudwavebtn" data-a="hudwave" aria-label="Find the nearest stairs" title="Find the nearest stairs">'+WAVE+'<span>Nearest stairs</span></button>'
    +(menu?menuHtml(o):'')
    +(leg?'<div class="hudleg" id="hudleg" role="dialog" aria-modal="false" aria-labelledby="hudleg-t"><b id="hudleg-t">Legend</b><div class="cmpleg">'+o.legend+'</div><button type="button" class="cmpsx" data-a="hudleg" aria-label="Close the legend">×</button></div>':'')
    +(o.sheet||'')+(aw?awareHtml():'')}

/* ---------- Details: the sheet inside the map ---------- */
function sheet(tab,body){const t=(k,ic,n)=>'<button type="button" role="tab" class="hudtab" data-a="hudtab" data-t="'+k+'" aria-selected="'+(tab===k)+'">'+ico(ic)+'<span>'+n+'</span></button>';
  return '<section class="hudsheet" id="hudsheet" data-size="'+size+'" aria-label="Details">'
    +'<div class="hudgrab" data-a="hudgrow" role="button" tabindex="0" aria-label="Make the details '+(size==='peek'?'taller':'shorter')+'"><i></i></div>'
    +'<div class="hudtabs" role="tablist" aria-label="Details">'+t('stairs','stairs','Stairs')+t('workout','energy','Workout')+'</div>'
    +'<div class="hudbody" id="hudbody" role="tabpanel">'+body+'</div>'
    +'<button type="button" class="hudx" data-a="hudsheetx" aria-label="Close the details (the staircase stays picked)">×</button></section>'}
function setSize(v){size=v==='half'?'half':'peek';const s=$id('hudsheet');if(!s)return;s.style.height='';s.dataset.size=size;
  const g=s.querySelector('.hudgrab');if(g)g.setAttribute('aria-label','Make the details '+(size==='peek'?'taller':'shorter'))}
// drag the handle: the sheet follows the finger and settles at the nearer of its two heights
D0.addEventListener('pointerdown',e=>{const g=e.target.closest&&e.target.closest('.hudgrab');if(!g)return;const s=$id('hudsheet'),st=$id('cmpstage');if(!s||!st)return;
  const y0=e.clientY,h0=s.getBoundingClientRect().height,H=st.getBoundingClientRect().height;let moved=false;
  const mv=ev=>{const dy=y0-ev.clientY;if(Math.abs(dy)>6)moved=true;if(moved){s.classList.add('drag');s.style.height=Math.max(120,Math.min(H*.6,h0+dy))+'px'}};
  const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);s.classList.remove('drag');
    if(moved){dragged=true;setSize(s.getBoundingClientRect().height>H*.35?'half':'peek')}};
  addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up)});
D0.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.classList&&e.target.classList.contains('hudgrab')){e.preventDefault();acts.hudgrow()}});

/* ---------- NEAREST STAIRS: the wave ---------- */
function wave(x,y){const st=$id('cmpstage');if(!st||reduced())return;const w=D0.createElement('div');w.className='hudwave';w.setAttribute('aria-hidden','true');
  w.style.left=x+'px';w.style.top=y+'px';w.innerHTML='<i></i><i></i><i></i>';st.appendChild(w);setTimeout(()=>w.remove(),1900)}
function scan(){const c=C();if(!c||typeof HWGps==='undefined')return;const h=c.here(),st=$id('cmpstage'),r=st?st.getBoundingClientRect():{width:0,height:0};
  wave(h&&h.x!=null?h.x:r.width/2,h&&h.y!=null?h.y:r.height/2);
  const L=h?HWGps.scan(h):(acts.gpsok(),null); // no position on the map yet: one reading, the browser asks first
  setTimeout(()=>{if(S.v!=='campus')return;const n=L&&L[0];if(n&&n.d<1500)c.focus(n.s.id);c.openSheet('stairs','half')},reduced()?0:1100)}

/* ---------- Stay aware of your surroundings ---------- */
const SIGN='<svg viewBox="0 0 120 108" class="hudsign" aria-hidden="true" focusable="false"><path d="M60 3 117 104H3Z" fill="#fff7a8" opacity=".75"/>'
  +'<path d="M60 12 108 97H12Z" fill="#fffab8" stroke="#1d3c48" stroke-width="5" stroke-linejoin="round"/><g fill="#1d3c48">'
  +'<path d="M25 86h70" stroke="#1d3c48" stroke-width="2.4"/>'
  +'<circle cx="46" cy="41" r="4.6"/><path d="M40.5 38.2c1.2-3.6 8.6-4.3 10.6-.6l3.4.4-.4 1.6-13.6-.6z"/>'
  +'<rect x="35" y="49" width="6" height="11" rx="2.4"/><path d="M41.4 47.6c3-1.7 6.4-1.7 8.6.4l1.8 10.4 5.3 3.4-1.3 1.9-6.3-3.4-.9 4.2 5.6 9.3 4.1 3.2-1.6 2.1-5.6-3.8-5-8.3-3.6 8.7-4.6 3.3-1.5-2 3.9-3.3 3.1-10.8z"/>'
  +'<rect x="54.6" y="60" width="3" height="5" rx=".6"/>'
  +'<path d="M66 84.5c4-.4 5-5 9.4-5.2 4.6-.2 5.2 5.4 10 5.4 3.2 0 4.6-2.4 4.4-5.6-.2-3.4-2.2-5.4-1.2-8.6" fill="none" stroke="#1d3c48" stroke-width="4.4" stroke-linecap="round"/>'
  +'<path d="M84.2 70.8c1.4-3.4 6.8-4 8.6-.8 1 1.8-.4 3.4-2.8 3.6l-4.8.2c-1.4 0-1.8-1.6-1-3z"/>'
  +'<path d="M84.8 72.2l-3.8.6m3.8-.6-3.4 2.2" stroke="#1d3c48" stroke-width="1.1" fill="none"/><circle cx="89.4" cy="70.6" r=".9" fill="#fffab8"/></g></svg>';
function awareHtml(){return '<div class="hudaware" id="hudaware" role="alertdialog" aria-modal="true" aria-labelledby="hudaware-t" aria-describedby="hudaware-d"><div class="hudawc">'+SIGN
  +'<b id="hudaware-t">Stay Aware of Your Surroundings</b><p id="hudaware-d">Do not enter dangerous areas while playing HealthWiz Kingdom.</p>'
  +'<button type="button" class="hudok" data-a="hudaware">OK</button></div></div>'}
function aware(v){aw=!!v;const e=$id('hudaware');if(!aw&&e)e.remove();if(!aw){const b=D0.querySelector('.hudbtn');if(b)b.focus({preventScroll:true})}}

/* ---------- actions ---------- */
acts.hudmenu=()=>{menu=!menu;leg=false;redraw();const f=menu?$id('cmpfind'):D0.querySelector('.hudbtn');if(f)f.focus({preventScroll:true})};
acts.hudleg=()=>{leg=!leg;redraw()};
acts.hudtab=d=>{const c=C();if(c)c.openSheet(d.t==='workout'?'workout':'stairs')};
acts.hudgrow=()=>{if(dragged){dragged=false;return}setSize(size==='peek'?'half':'peek')};
acts.hudsheetx=()=>{const c=C();if(c)c.closeSheet()};
acts.hudwave=()=>scan();
acts.hudaware=()=>aware(false);
// a button in the menu does its job with the menu closed (the map must be seen to zoom, turn or tilt)
D0.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('#hudmenu .hudi,#hudmenu [data-a="cmppick"]');if(!t)return;menu=false;
  if(t.dataset.a==='hudlegopen'){leg=true}
  setTimeout(()=>{const m=$id('hudmenu');if(m&&!menu)m.remove();const b=D0.querySelector('.hudbtn');if(b)b.setAttribute('aria-expanded','false')},0)},true);
acts.hudlegopen=()=>redraw();
D0.addEventListener('keydown',e=>{if(e.key!=='Escape'||S.v!=='campus')return;if(aw&&$id('hudaware')){aware(false);return}if(menu){acts.hudmenu();return}if(leg){acts.hudleg()}});
HWEvents.on('page:viewed',e=>{if(e&&e.view!=='campus'){menu=false;leg=false;aw=false;seen=false;size='peek'}});

/* Redraws on the same page keep the page still: render() rebuilds the page wrapper, whose entrance fade (index.html: .pg pgin)
   made switching a map feature on or off look like the screen reloading. A new page still fades in. */
{let last=null;const r=render;render=function(){const same=S.v===last;last=S.v;const x=r.apply(this,arguments);if(same){const p=D0.querySelector('#main>.pg');if(p)p.classList.add('pgstay')}return x}}

HWUI.css('campushud',`
.pg.pgstay{animation:none}
.hudbtn{position:absolute;z-index:7;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);width:68px;height:68px;min-height:0;margin:0;padding:4px;border-radius:50%;border:3px solid #fff;background:radial-gradient(circle at 50% 40%,#2b3a7a,#141c45);box-shadow:0 4px 14px rgba(0,0,0,.35),0 0 0 3px rgba(242,193,78,.65);display:grid;place-items:center}
.hudbtn img{width:56px;height:56px;border-radius:50%;image-rendering:pixelated}
.hudbtn:active{transform:translateX(-50%) scale(.94)}
.hudwavebtn{position:absolute;z-index:7;right:12px;bottom:max(18px,env(safe-area-inset-bottom));min-height:0;margin:0;width:56px;height:56px;padding:0;border-radius:50%;border:2px solid #fff;background:#3fa5a0;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.3);display:grid;place-items:center}
/* NEAREST STAIRS stays usable while Details are open: it rides just above the sheet */
#cmpstage:has(#hudsheet) .hudwavebtn{z-index:9;bottom:calc(max(170px,20%) + 24px)}#cmpstage:has(#hudsheet[data-size="half"]) .hudwavebtn{bottom:calc(max(260px,50%) + 24px)}
#cmpstage:has(#hudsheet.drag) .hudwavebtn{visibility:hidden}
.hudwavebtn svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}.hudwavebtn svg circle{fill:currentColor;stroke:none}
.hudwavebtn span{position:absolute;bottom:-15px;left:50%;transform:translateX(-50%);white-space:nowrap;font:700 10px/1 var(--font);letter-spacing:.04em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.8)}
/* the menu: mint, round buttons under their names, the x at the bottom middle (the recording's look) */
.hudmenu{position:absolute;inset:0;z-index:11;background:linear-gradient(180deg,rgba(236,250,240,.97),rgba(196,236,210,.97));color:#2d5a5f;animation:hudin .22s ease-out}
.hudscr{position:absolute;inset:0 0 72px;overflow:auto;overscroll-behavior:contain;padding:12px 12px 8px;display:flex;flex-direction:column;gap:8px}
.hudmenu::after{content:'';position:absolute;left:0;right:0;bottom:72px;height:18px;background:linear-gradient(rgba(196,236,210,0),rgba(196,236,210,.97));pointer-events:none}
.hudfind{position:relative}.hudmenu .cmpfind{position:relative;left:auto;top:auto;width:100%}
.hudmenu .cmpfind input{border-radius:999px;border:0;background:#fff;color:#22424a;text-align:center;box-shadow:0 1px 4px rgba(30,90,80,.2)}
.hudmenu .cmpfres{background:#fff;border:0}
.hudgrid{list-style:none;margin:6px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:10px 4px;justify-items:center}
.hudgrid li{display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0}
.hudl{font:700 10.5px/1.15 var(--font);letter-spacing:.06em;text-transform:uppercase;color:#4e7b7c;text-align:center;min-height:2.3em;display:flex;align-items:flex-end}
.hudi{width:48px;height:48px;min-height:0;margin:0;padding:0;border-radius:50%;border:3px solid #3fa5a0;background:#fff;color:#3fa5a0;display:grid;place-items:center;font:800 16px var(--font);box-shadow:0 2px 6px rgba(30,90,80,.18)}
.hudi svg{width:22px;height:22px}.hudi .cmpsv2{fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.hudi[aria-pressed="true"],.hudi[aria-expanded="true"]{background:#3fa5a0;color:#fff;border-color:#2f8a86}
.hudx{position:absolute;z-index:2;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);width:50px;height:50px;min-height:0;margin:0;padding:0;border-radius:50%;border:3px solid #3fa5a0;background:#fff;color:#3fa5a0;font:700 26px/1 var(--font);box-shadow:0 3px 10px rgba(30,90,80,.25)}
.hudleg{position:absolute;z-index:10;left:10px;right:10px;bottom:92px;max-height:calc(100% - 170px);overflow:auto;padding:10px 40px 10px 12px;border-radius:14px;background:#f2fbf5;color:#22424a;box-shadow:0 6px 24px rgba(20,60,50,.25);font-size:12.5px}
.hudleg .cmpleg{position:static;max-width:none;background:none;border:0;box-shadow:none;padding:0;color:inherit}
.hudleg .cmpsx{position:absolute;right:6px;top:6px}
/* Details: the sheet */
.hudsheet{position:absolute;z-index:8;left:0;right:0;bottom:0;height:max(170px,20%);display:flex;flex-direction:column;background:#f3fbf6;color:#22333b;border-radius:18px 18px 0 0;box-shadow:0 -6px 24px rgba(0,0,0,.28);transition:height .25s ease;animation:hudup .28s cubic-bezier(.2,.8,.25,1)}
.hudsheet[data-size="half"]{height:max(260px,50%)}.hudsheet.drag{transition:none}
.hudgrab{flex:0 0 auto;height:22px;display:grid;place-items:center;cursor:grab;touch-action:none}.hudgrab i{width:44px;height:5px;border-radius:3px;background:#9cc8bf}
.hudtabs{flex:0 0 auto;display:flex;border-bottom:1px solid #d3e8de}
.hudtab{flex:1 1 0;min-height:44px;margin:0;padding:4px 6px 6px;border:0;border-radius:0;background:none;color:#5d7d80;display:flex;flex-direction:column;align-items:center;gap:2px;font:700 11px/1 var(--font);letter-spacing:.06em;text-transform:uppercase;box-shadow:inset 0 -3px 0 transparent}
.hudtab[aria-selected="true"]{color:#2f7f80;box-shadow:inset 0 -3px 0 #3fa5a0}
.hudbody{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:10px 12px 24px;-webkit-overflow-scrolling:touch}
.hudbody .cmpdet{padding:0;border:0;background:none}
.hudsheet .hudx{left:auto;right:8px;top:24px;bottom:auto;transform:none;width:40px;height:40px;border-width:2px;font-size:20px}
.hudsheet .hudtabs{padding-right:52px}
/* the wave out of the avatar */
.hudwave{position:absolute;z-index:6;width:0;height:0;pointer-events:none}
.hudwave i{position:absolute;left:-150px;top:-150px;width:300px;height:300px;border-radius:50%;border:3px solid rgba(90,220,215,.95);box-shadow:0 0 18px rgba(90,220,215,.7),inset 0 0 18px rgba(90,220,215,.45);transform:scale(.05);opacity:0;animation:hudwv 1.5s ease-out forwards}
.hudwave i:nth-child(2){animation-delay:.25s}.hudwave i:nth-child(3){animation-delay:.5s}
@keyframes hudwv{0%{transform:scale(.05);opacity:1}100%{transform:scale(1.4);opacity:0}}
@keyframes hudin{from{opacity:0;transform:translateY(16px)}}@keyframes hudup{from{transform:translateY(100%)}}
/* stay aware */
.hudaware{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:24px;background:linear-gradient(160deg,#66b089,#3f7f80 55%,#355d76)}
.hudawc{width:min(380px,100%);background:#f7f8f6;border-radius:6px;box-shadow:0 10px 40px rgba(0,0,0,.3);padding:28px 22px 24px;text-align:center;color:#3b4d56}
.hudsign{width:min(240px,70%);height:auto;display:block;margin:0 auto 18px}
.hudawc b{display:block;font:800 20px/1.3 var(--font);margin-bottom:12px}.hudawc p{margin:0 0 22px;font-size:16px;line-height:1.45;color:#5b6b73}
.hudok{min-height:50px;width:min(260px,100%);margin:0;border:0;border-radius:999px;background:linear-gradient(90deg,#b6dea0,#8fd6a6 60%,#62c8b0);color:#fff;font:800 16px var(--font);letter-spacing:.14em;text-shadow:0 1px 1px rgba(40,90,70,.4)}
html.hw-rm .hudmenu,html.hw-rm .hudsheet,html.hw-still .hudmenu,html.hw-still .hudsheet{animation:none;transition:none}
@media (prefers-reduced-motion:reduce){.hudmenu,.hudsheet{animation:none;transition:none}}
/* with the HUD, the map's own corners are free: the selection bar under the mode switch, the position bar above the button */
.cmpstage .cmppill,.cmpstage .cmpav{top:58px}.cmpstage .cmpmebar{bottom:96px}
.cmpstage .cmpskyp,.cmpstage .cmplayp{top:58px;right:10px;left:10px;max-width:none}
`);
return{html,sheet,setSize,aware,get state(){return{menu,leg,size,aware:aw}}}})();
