/* v6: the staircase stop (owner's request, 2026-10-21, after a Pokestop). Not part of the original.
   On the map every staircase is a heart spinning on a post, in its difficulty colour (observatory/map.js, the Blender
   sprite of tools/art/make_heart_sprite.py). Tapping one (or picking it in the search on the map) zooms a disc out of the
   heart to fill the map: its photo (none has been taken yet, so the frame says so instead of showing a made-up one), its
   name, its ID, difficulty and whether its place is measured or estimated. The Details card pops up right below the
   map at the same time, with the stair illustration and everything to log there. Closing turns the disc back into the
   heart and shrinks it onto its post. With reduced motion the disc simply appears and disappears.
   State: memory only (which stop is open); nothing is saved. */
const HWCampusStop=(()=>{
let cur=null,enter=false,dx=0,dy=0,ds=260;
const CAT={MILD:['Mild',1],MODERATE:['Moderate',2],VIGOROUS:['Vigorous',3]};
const rec=id=>typeof HWCampusData!=='undefined'?HWCampusData.record(id):null;
const ctl=()=>typeof HWCampus!=='undefined'?HWCampus.map:null;
/** Where the heart is, from the middle of the map stage (px): the disc grows from there. */
function from(id){const c=ctl(),st=document.getElementById('cmpstage');if(!c||!c.ready||!st||typeof HWCampus==='undefined')return[0,0];
  const g=HWCampus.points().find(p=>p.items.some(s=>s.id===id)),q=g&&c.screenOf(g.key);if(!q)return[0,0];
  const m=c.map.getContainer().getBoundingClientRect(),r=st.getBoundingClientRect();
  return[Math.round(m.left-r.left+q.x-r.width/2),Math.round(m.top-r.top+q.y-26-r.height/2)]}
/** The disc's size: as big as the map stage allows below the name and above the button, at most 300 px. */
function size(){const st=document.getElementById('cmpstage');if(!st)return 260;const r=st.getBoundingClientRect();return Math.max(140,Math.min(300,r.height-200,r.width-80))}
function open(id){const s=rec(id);if(!s)return;[dx,dy]=from(id);ds=size();cur=id;enter=true;
  const y=scrollY;render();scrollTo(0,y);setTimeout(()=>{enter=false},700);
  // the whole stop on screen: above the bottom navigation bar of phones, below the top
  const st=document.getElementById('cmpstage'),nav=document.getElementById('nav');
  if(st){const r=st.getBoundingClientRect(),nt=nav&&getComputedStyle(nav).position==='fixed'?Math.min(innerHeight,nav.getBoundingClientRect().top):innerHeight;
    if(r.bottom>nt)scrollBy(0,Math.min(r.top,r.bottom-nt+6));else if(r.top<0)scrollBy(0,r.top)}
  const b=document.querySelector('#cmpstop .cmpstopx');if(b)b.focus({preventScroll:true})}
function close(then){const el=document.getElementById('cmpstop');if(!el||!cur){cur=null;if(then)then();return}
  const id=cur;[dx,dy]=from(id);el.style.setProperty('--dx',dx+'px');el.style.setProperty('--dy',dy+'px');
  const done=()=>{if(cur!==id)return;cur=null;el.remove();if(then)then()};
  if(HWUI.reduced())return done();
  el.classList.remove('enter');el.classList.add('out');setTimeout(done,460)}
function html(){const s=cur&&rec(cur);if(!s)return '';const c=CAT[s.appCategory]||['–',2];
  return '<div class="cmpstop c'+c[1]+(enter?' enter':'')+'" id="cmpstop" role="dialog" aria-modal="false" aria-labelledby="cmpstop-t" style="--dx:'+dx+'px;--dy:'+dy+'px;--ds:'+ds+'px">'
    +'<div class="cmpstopbg" aria-hidden="true"></div>'
    +'<div class="cmpstoph"><b id="cmpstop-t">'+esc(s.name)+'</b><small>'+s.id+' · '+c[0]+' (app category) · '+(s.locationStatus==='measured'?'measured location':'real location')+'</small></div>'
    +'<div class="cmpdisc"><div class="cmpdiscr" aria-hidden="true"></div><div class="cmpphoto" role="img" aria-label="No photo of this staircase yet">'+HWPixel.icon('camera',2)+'<span>No photo yet</span><small>A photo of this staircase will go here once it is taken.</small></div></div>'
    +'<div class="cmpstopa"><button type="button" data-a="cmpstoplog">LOG A CLIMB HERE</button></div>'
    +'<button type="button" class="cmpstopx" data-a="cmpstopx" aria-label="Close and go back to the map">×</button></div>'}
acts.cmpstopx=()=>close();
// with the map, Details are the sheet inside it (js/v6-campus-hud.js): it rises to half the map
acts.cmpstoplog=()=>close(()=>{if(typeof HWCampusHud!=='undefined'&&document.querySelector('.hudbtn')){HWCampus.openSheet('stairs','half');return}const e=document.getElementById('cmpdet')||document.getElementById('cmplog');if(e)e.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'})});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&cur&&S.v==='campus'&&!document.querySelector('dialog[open], .hwh-pop:not([hidden])'))close()});
HWEvents.on('page:viewed',e=>{if(e&&e.view!=='campus'){cur=null;enter=false}});
HWEvents.on('data:reset',()=>{cur=null});

HWUI.css('campusstop',`
.cmpstop{position:absolute;inset:0;z-index:9;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;justify-items:center;align-items:center;padding:14px 12px 16px;--mc:var(--m2,#f2c14e)}
.cmpstop.c1{--mc:var(--m1,#4fbf6a)}.cmpstop.c2{--mc:var(--m2,#f2c14e)}.cmpstop.c3{--mc:var(--m3,#e8573f)}
.cmpstopbg{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,color-mix(in srgb,var(--mc) 55%,transparent),color-mix(in srgb,var(--mc) 85%,#0b1430) 70%);opacity:.92}
.cmpstoph{position:relative;max-width:100%;padding:0 52px;text-align:center;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6)}.cmpstoph b{display:block;font-size:17px;line-height:1.25}.cmpstoph small{font-size:12px;opacity:.9}
.cmpdisc{position:relative;width:var(--ds,260px);height:var(--ds,260px);box-sizing:border-box;border-radius:50%;padding:12px;background:conic-gradient(from 0deg,#fff,color-mix(in srgb,var(--mc) 60%,#fff),#fff,color-mix(in srgb,var(--mc) 60%,#fff),#fff);box-shadow:0 0 0 6px color-mix(in srgb,var(--mc) 80%,#fff),0 0 0 14px rgba(255,255,255,.35),0 10px 30px rgba(0,0,0,.35)}
.cmpdiscr{position:absolute;inset:-18px;border-radius:50%;border:3px solid rgba(255,255,255,.7);pointer-events:none}
.cmpphoto{width:100%;height:100%;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#eef1f5;color:#4a5262;text-align:center;padding:16%}
.cmpphoto span{font-weight:700}.cmpphoto small{font-size:12px;line-height:1.3}
@media(max-height:520px),(max-width:420px){.cmpphoto small{display:none}.cmpstoph b{font-size:15px}}
.cmpstopa{position:relative}.cmpstopa button{min-height:44px;margin:0}
.cmpstopx{position:absolute;left:50%;bottom:-2px;transform:translate(-50%,0);width:44px;height:44px;border-radius:50%;border:2px solid #fff;background:rgba(11,20,48,.55);color:#fff;font-size:24px;line-height:1;padding:0;display:none}
.cmpstopa+.cmpstopx{position:absolute;right:12px;top:12px;left:auto;bottom:auto;transform:none;display:block}
/* the zoom: the disc grows out of the heart, turning; closing turns it back and shrinks it onto the post */
.cmpstop.enter .cmpdisc{animation:stopin .55s cubic-bezier(.2,.8,.25,1)}
.cmpstop.enter .cmpstopbg{animation:stopfade .45s ease-out}
.cmpstop.enter .cmpstoph,.cmpstop.enter .cmpstopa{animation:stopfade .5s .25s both}
.cmpstop.out .cmpdisc{animation:stopout .45s ease-in forwards}
.cmpstop.out .cmpstopbg,.cmpstop.out .cmpstoph,.cmpstop.out .cmpstopa,.cmpstop.out .cmpstopx{animation:stopfade .35s reverse forwards}
@keyframes stopin{from{transform:translate(var(--dx),var(--dy)) scale(.07) rotateY(540deg);opacity:.6}70%{transform:scale(1.04)}to{transform:none;opacity:1}}
@keyframes stopout{from{transform:none}40%{transform:scale(.6) rotateY(180deg)}to{transform:translate(var(--dx),var(--dy)) scale(.05) rotateY(540deg);opacity:0}}
@keyframes stopfade{from{opacity:0}to{opacity:1}}
html.hw-rm .cmpstop *,html.hw-still .cmpstop *{animation:none!important}
@media (prefers-reduced-motion:reduce){.cmpstop *{animation:none!important}}
/* Details pop up under the map when a stop opens */
.cmpdet.pop{animation:detpop .45s cubic-bezier(.2,.8,.25,1)}@keyframes detpop{from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:none}}
html.hw-rm .cmpdet.pop,html.hw-still .cmpdet.pop{animation:none}
`);
return{open,close,html,get current(){return cur}}})();
