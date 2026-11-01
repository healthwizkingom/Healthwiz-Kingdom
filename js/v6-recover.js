/* v6: Recover Now, a guided 2-minute rest on the Stairs workout card. Not part of the original.
   Why: the workout already has an optional "1 minute after you stop (BPM)" field (m.hrR1, js/v6-stairs.js) and shows the drop
   (pulse right after stopping minus the pulse 1 minute later). This module only times that minute so the reading is taken at
   the same moment every time. It adds no storage key and no new measurement: the number saved is the one the user types
   (or reads from their own device or camera estimate), through the field that already exists.

   What it is not: the drop is a plain difference of two pulse numbers. It is NOT a measure of vagal tone, fitness or health,
   and nothing here is a diagnosis (docs/DISCLAIMERS.md). The label is "heart-rate drop".

   Flow: RECOVER NOW starts a 2:00 countdown (the elapsed time comes from the clock, so a slow screen cannot stretch it). At 1:00
   the timer asks for the pulse; USE THIS copies it into the 1-minute field. Skipping, stopping or leaving the page saves nothing.
   Source for the method and its limits: js/v6-vault.js entry 'recovery' (Cole et al. 2000, source id 'cole').

   drop() is pure so the tests can check worked examples. */
const HWRecover=(()=>{
const WIN=120,MARK=60,D=document,$i=i=>D.getElementById(i);
const ok=v=>{v=typeof v==='string'&&v.trim()===''?NaN:+v;return Number.isFinite(v)&&v>=30&&v<=220?Math.round(v):null};
/** a = pulse right after stopping, r = pulse 1 minute later (BPM, 30–220). {a, r, drop = a − r}, or null when either is missing or out of range. */
function drop(a,r){a=ok(a);r=ok(r);return a&&r?{a,r,drop:a-r}:null}
/** seconds → m:ss, counting down (rounded up so 0:00 shows only at the end) */
function clock(s){s=Math.max(0,Math.ceil(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
let t0=0,tick=0,asked=false;
function stop(){if(tick)clearInterval(tick);tick=0;t0=0;asked=false;const m=$i('rec-mount');if(m)m.innerHTML=''}
const html=()=>'<div class="stkc" id="rec-box" role="group" aria-label="Recover Now: two minutes of rest">'
  +'<b>RECOVER NOW</b> <b id="rec-clock" role="timer" aria-label="Time left">'+clock(WIN)+'</b>'
  +'<p class="mut" id="rec-msg">Stand or sit still and breathe easily. At 1:00 the timer asks for your pulse.</p>'
  +'<div id="rec-in" hidden><label>Pulse now (BPM)<input id="rec-r" type="number" min="30" max="220" inputmode="numeric"></label> '
  +'<button type="button" class="g sm" data-a="recuse">USE THIS</button></div>'
  +'<button type="button" class="g sm" data-a="recstop">STOP</button>'
  +'<small class="mut">A guide only. The drop is two pulse numbers subtracted: it is not a medical measurement.</small></div>';
/** the button and an empty place for the panel; the Stairs card puts it under the "1 minute after" field */
const mount=()=>'<button type="button" class="g sm" data-a="recstart" aria-label="Recover Now: start the 2 minute rest timer">RECOVER NOW</button><div id="rec-mount"></div>';
function frame(){
  const c=$i('rec-clock');if(!c||!t0){stop();return}      // the card was redrawn or left: the timer ends, nothing is saved
  const s=(Date.now()-t0)/1000;c.textContent=clock(WIN-s);
  if(s>=MARK&&!asked){asked=true;const i=$i('rec-in'),m=$i('rec-msg');if(i)i.hidden=false;if(m)m.textContent='One minute. Take your pulse now (count 15 seconds and multiply by 4, or read your device) and type it.';
    try{sfx(660,.15)}catch(e){}const f=$i('rec-r');if(f)f.focus({preventScroll:true})}
  if(s>=WIN){clearInterval(tick);tick=0;const m=$i('rec-msg');if(m)m.textContent='Two minutes done. You can keep resting a little longer.'}}
acts.recstart=()=>{if(tick||!$i('rec-mount'))return;$i('rec-mount').innerHTML=html();t0=Date.now();asked=false;tick=setInterval(frame,250)};
acts.recstop=()=>stop();
acts.recuse=()=>{const f=$i('rec-r'),v=f?ok(f.value):null;
  if(!v){toast('Type a pulse between 30 and 220 BPM');return}
  const w=$i('wk-r');if(!w){stop();return}
  w.value=v;INP.stw(w);toast('1-minute pulse used: '+v+' BPM');stop()};
return{drop,clock,mount,WIN,MARK}})();
