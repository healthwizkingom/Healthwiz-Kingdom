/* v6: the Stairs section of the Campus page. Not part of the original.
   Stairs used to be a page of its own (route 'stair'); it is now a collapsible section, titled "Stairs", under the Observatory
   on the Campus page. The Stairs module (js/v6-stairs.js) still owns the content and the data, unchanged: the same storage
   keys, the same 'stair' / 'pulse' entries, the same ids and actions (st*, wk-*, gv*, pl*), so nothing saved needs a migration.
   * Routes: go('stair') (the Health Hall card, quests, links) and go('pulse') (Heartstone Hall) open the Campus page at the
     top (owner's request, 2026-10-20), with the Observatory's Details showing the logging forms (the workout half for
     'pulse'): logging happens in the Observatory now. This section, collapsed, keeps the history. A plain visit to the
     Campus page, from its door in the Health Hall, is the same without switching to Details. The address #stairs does the
     same as go('stair') (read on load and on change).
   * Collapsing is leaving, as far as the Stairs features go: the rhythm guide and the workout timer stop (the time so far is
     kept), a Stair Sense climb is paused, the camera pulse stops, the GPS card forgets its reading (event 'stairs:closed').
     Opening tells the heart-rate device module it may reconnect (event 'stairs:opened').
   * Nothing is rendered while it is collapsed; the header shows today's steps and the goal, which are the same numbers as before. */
const HWCampusStairs=(()=>{
const D=document,$id=i=>D.getElementById(i),ico=(n,s)=>HWPixel.icon(n,s||1);
let open=false;
const there=()=>S.v==='campus';

function summary(){const d=today(),R=rng(7),n=sp(d),k=(typeof HWStairs!=='undefined'?HWStairs.all():[]).filter(s=>R.includes(s.d)).length;
  return n+' steps today · '+k+(k===1?' session':' sessions')+' in 7 days'}
function html(){
  const body=open?pages.stair():'',help=open&&typeof HWHall!=='undefined'?HWHall.panel('stair'):'',q=open&&typeof HWHall!=='undefined'?'<button type="button" class="g sm hwq stsecq" data-a="hwq" data-k="stair" aria-expanded="false" aria-controls="hwh3" aria-label="What is this section for?">?</button>':'';
  return '<section class="stsec" id="stairs" aria-labelledby="stsec-t"><div class="pxp pxn stsech"><h2 class="pxh" id="stsec-t"><button type="button" class="stsecb" id="stsec-btn" data-a="stsec" aria-expanded="'+open+'" aria-controls="stsec-body">'
    +ico('stairs',2)+'<span class="stsect"><b>Stairs</b><small>'+(typeof HWHall!=='undefined'?'ENTERED BY YOU · ':'')+summary()+'</small></span><span class="stsecv" aria-hidden="true"></span></button>'+q+'</h2></div>'
    +'<div id="stsec-body"'+(open?'':' hidden')+'>'+help+body+'</div></section>'}

const redraw=()=>{const y=window.scrollY;render();window.scrollTo(0,y)};
function focusBtn(){const b=$id('stsec-btn');if(b)b.focus({preventScroll:true})}
function openNow(){if(open)return;open=true;HWEvents.emit('stairs:opened',{})}
function closeNow(){if(!open)return;open=false;HWEvents.emit('stairs:closed',{})}
acts.stsec=()=>{if(open)closeNow();else openNow();redraw();focusBtn()};
// OPEN STAIRS (the climbs block of the Observatory): same as the card
acts.stopen=()=>go('stair');

/** Open the section and bring it to the top of the screen (id = what to show first). */
function reveal(id){const e=$id(id)||$id('stairs');if(e)e.scrollIntoView({block:'start'})}

/* ---------- routes: the old Stairs page, and the old Pulse page, are this section ---------- */
{const g0=go;go=function(v){
  if(v==='stair'||v==='pulse'){
    if(typeof HWStairs!=='undefined')HWStairs.arrive(v);
    if(typeof HWCampus!=='undefined')HWCampus.openLog();
    const r=g0.call(this,'campus');window.scrollTo(0,0);return r}
  if(v==='campus'&&S.v!=='campus'){closeNow()} // a plain visit: collapsed
  return g0.apply(this,arguments)}}
HWEvents.on('page:viewed',e=>{if(e.view!=='campus'){open=false;clearHash()}});
HWEvents.on('data:reset',()=>{open=false});

/* ---------- the address #stairs (or #stair) opens the section, like the Health Hall card ---------- */
const hashOn=()=>/^#stairs?$/i.test(location.hash||'');
function clearHash(){if(hashOn())try{history.replaceState(null,'',location.pathname+location.search)}catch(x){}}
const applyHash=()=>{if(hashOn()&&S.v!=='onb'&&!(S.v==='welcome'&&typeof needOnb==='function'&&needOnb()))go('stair')};
addEventListener('hashchange',applyHash);
HWEvents.on('app:ready',()=>setTimeout(applyHash,0)); // once, after the first render

HWUI.css('campusstairs',`
.stsec{scroll-margin-top:8px;margin:14px 0 0}.stsech{margin-bottom:14px;padding:0}.stsech .pxh{margin:0;display:flex;align-items:center;gap:0}
.stsecb{flex:1 1 auto;min-width:0;min-height:56px;margin:0;padding:8px 12px;display:flex;align-items:center;gap:12px;text-align:left;background:none;border:0;box-shadow:none;color:var(--ink);font:inherit;text-transform:none;letter-spacing:0}
.stsect{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}.stsect b{font:var(--px-f2)/1.3 var(--fh);text-transform:uppercase}.stsect small{font:13px/1.4 var(--fn);color:var(--mut);overflow-wrap:anywhere}
.stsecv{flex:0 0 auto;width:12px;height:12px;border-right:4px solid var(--ink);border-bottom:4px solid var(--ink);transform:rotate(45deg);margin:0 6px 4px 0}
.stsecb[aria-expanded="true"] .stsecv{transform:rotate(-135deg);margin:4px 6px 0 0}
.stsecq{flex:0 0 auto;margin:0 8px 0 0}
#stsec-body[hidden]{display:none}
`);
return{html,reveal,get open(){return open}}})();
