/* v6: Paced breathing with your own pulse, on the Stress Quest's lantern practice. Not part of the original.
   Feature 11 of the owner's catalog, in its honest form (docs/FEATURE_CONSULTS.md). The app already has the slow-breathing guide:
   "Empower Yourself" (the lantern, js/v6-relief.js over the original game in js/hw-03-part.js), 60 s, 4 s in and 6 s out. So this file
   builds NO second guide. It adds three things to that one:
     1. an optional "pulse before" field on the lantern's start screen and "pulse after" before the "How do you feel now?" step,
        with the difference shown as the user's own numbers (typed, or the watch reading when a steady one exists);
     2. a clock-based phase: the INHALE / EXHALE label and the countdown come from the time since the practice began (phase()), not from
        counting timer ticks, so a slow or throttled screen cannot stretch the cycle (the original tick, sqTick, is replaced by this one);
     3. a PACED BREATHING GUIDE button next to RECOVER NOW on the workout card (js/v6-recover.js mounts it) that opens the lantern directly.
   Pulse numbers stay in this file's memory: nothing is saved, no storage key, no schema step. A skipped field stays blank and is never
   filled in. A direct start never logs a stress check-in (the quest has no feeling recorded, so sqfin starts over without saving), and a
   quest the user had in progress is put back when they leave.
   Wording is non-clinical on purpose: slow paced breathing, about 6 breaths a minute, with a longer out-breath; some people find it calming.
   It says nothing about the vagus nerve, heart-rate variability or treating anything. Stop if lightheaded or dizzy.
   phase() and change() are pure so the tests can check worked examples. */
const HWBreath=(()=>{
const IN_MS=4000,CYCLE_MS=10000,TOTAL_MS=60000,$i=i=>document.getElementById(i);
const ok=v=>{v=typeof v==='string'&&v.trim()===''?NaN:+v;return Number.isFinite(v)&&v>=30&&v<=220?Math.round(v):null};
/** ms since the practice began → {in, label, sec (whole seconds into this half-breath), cycle (breaths done), edge (changes at every in/out switch)}. */
function phase(ms){ms=Number.isFinite(+ms)&&+ms>0?+ms:0;const cycle=Math.floor(ms/CYCLE_MS),r=ms-cycle*CYCLE_MS,inh=r<IN_MS;
  return{in:inh,label:inh?'INHALE':'EXHALE',sec:Math.floor((inh?r:r-IN_MS)/1000),cycle,edge:cycle*2+(inh?0:1)}}
/** before, after: pulse (BPM, 30–220). {b, a, diff = a − b}, or null unless both are usable. */
function change(b,a){b=ok(b);a=ok(a);return b&&a?{b,a,diff:a-b}:null}

/* ---------- the user's numbers, in memory only ---------- */
const P={b:null,a:null,bs:'',as:'',bad:{b:0,a:0}};
const clear=()=>{P.b=P.a=null;P.bs=P.as='';P.bad={b:0,a:0}};
const src=k=>P[k]?(P[k+'s']==='device'?'From your heart-rate device.':'Typed in by you.'):P.bad[k]?'Enter a pulse between 30 and 220 BPM, or leave it blank.':'';
const sgn=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
function res(){const c=change(P.b,P.a);
  if(c)return'Before '+c.b+' · after '+c.a+' · difference '+sgn(c.diff)+' BPM (your numbers; '+((P.bs==='device'||P.as==='device')?'typed or from your device':'typed by you')+'). A guide only, not a medical measurement.';
  return P.b||P.a?'Add both numbers to see the difference.':''}
const NOTE='Slow paced breathing, about 6 breaths a minute, with a longer out-breath. Some people find it calming.',SAFE='Stop if you feel lightheaded or dizzy.';
const field=(k,label)=>'<label>'+label+' (BPM) <small class="mut">(optional)</small><input id="pc-'+k+'" data-in="pc'+k+'" type="number" min="30" max="220" inputmode="numeric" value="'+(P[k]||'')+'"></label>'
  +(typeof HWHR!=='undefined'?'<button type="button" class="g sm" data-a="pcuse" data-k="'+k+'">USE MY WATCH READING</button>':'')+'<small class="mut" id="pc-s'+k+'">'+src(k)+'</small>';
const before=()=>'<div class="pcbox" id="pc-before"><p class="mut">'+NOTE+'</p>'+field('b','Pulse before')+'<small class="mut">'+SAFE+' Your pulse numbers stay on this screen and are not saved.</small></div>';
const after=()=>'<div class="pcbox" id="pc-after">'+field('a','Pulse after')+'<p id="pc-res" role="status">'+res()+'</p></div>';
const button=()=>'<button type="button" class="g sm" data-a="brstart" aria-label="Open the paced breathing guide">PACED BREATHING GUIDE</button>';
function refresh(k){const s=$i('pc-s'+k),r=$i('pc-res');if(s)s.textContent=src(k);if(r)r.textContent=res()}
INP.pcb=el=>{const v=ok(el.value);P.b=v;P.bs=v?'typed':'';P.bad.b=!v&&String(el.value).trim()!==''?1:0;refresh('b')};
INP.pca=el=>{const v=ok(el.value);P.a=v;P.as=v?'typed':'';P.bad.a=!v&&String(el.value).trim()!==''?1:0;refresh('a')};
acts.pcuse=d=>{const k=d.k==='a'?'a':'b';if(typeof HWHR==='undefined'||!HWHR.stable){toast('No heart-rate device is connected');return}
  const s=HWHR.stable();if(!s.ok||!(s.v>=30&&s.v<=220)){toast('Wait for a steady reading (10–15 s, holding still)');return}
  P[k]=Math.round(s.v);P[k+'s']='device';P.bad[k]=0;const e=$i('pc-'+k);if(e)e.value=P[k];refresh(k)};

/* ---------- the clock-based tick (replaces the original counting tick for the breathing game) ---------- */
sqTick=function(){const q=S.sq;if(!$i('bl')||!q||q.ph!=='game'){sqk();return}
  const g=q.g,ms=g.t0?Date.now()-g.t0:(g.sec+1)*1000,p=phase(ms);g.sec=Math.floor(ms/1000);
  $i('bl').textContent=p.label;$i('bt').textContent=Math.max(0,60-g.sec)+'s left';
  if(p.edge!==g.edge){g.edge=p.edge;sfx(p.in?523:330,.15)}
  if(ms>=TOTAL_MS){sqk();q.ph='rate';render()}};
// stamp the start of a breathing practice (both ways in: from an activity card, or the original "practice it now")
['rxs','sqg'].forEach(k=>{const p=acts[k];acts[k]=function(){const r=p.apply(this,arguments),q=S.sq;if(q&&q.ph==='game'&&q.g&&q.g.t==='breathe')q.g.t0=Date.now();return r}});
// a new look at the lantern starts with empty pulse fields
{const p=acts.rxo;acts.rxo=function(d){if(d&&d.id==='lantern')clear();return p.apply(this,arguments)}}

/* ---------- the pulse fields, added to the existing screens ---------- */
{const base=pages.stress;pages.stress=function(){let h=base.apply(this,arguments);const q=S.sq;if(!q||typeof h!=='string')return h;
  if(q.ph==='rx'&&q.rx&&q.rx.id==='lantern'&&!q.rx.run)h=h.replace('<button type="button" class="rxstart" data-a="rxs">',m=>before()+m);
  else if(q.ph==='rate'&&q.tech==='breathe')h=h.replace('<p><b>How do you feel now?</b></p>',m=>after()+m);
  else if(q.ph==='done'&&q.tech==='breathe'){
    if(P.b||P.a)h=h.replace('<button data-a="sqa">',m=>'<p class="pcres" id="pc-done">'+res()+'</p>'+m);
    if(q.from)h=h.replace(/<button data-a="sqa">[^<]*<\/button> <button class="g" data-a="sqn">NEXT<\/button>/,'<button data-a="brback">BACK</button>')}
  return h}}

/* ---------- the entry beside RECOVER NOW ---------- */
function leave(){const q=S.sq,from=q&&q.from||'home',prev=q&&q.prev;sqk();S.sq=prev||{ph:'start'};go(from)}
acts.brstart=()=>{const cur=S.sq,mid=cur&&typeof cur.ph==='string'&&cur.ph!=='start'&&cur.ph!=='end'&&!cur.from?cur:null,from=S.v;
  clear();go('stress');       // go() resets a quest sitting on an activity screen, so the lantern is set up after it
  S.sq={ph:'rx',r:5,r0:5,feel:'',why:[],own:'',all:['worry'],enc:['worry'],ei:0,tries:[],rx:{id:'lantern',y:0},tech:'breathe',from,prev:mid};render()};
acts.brback=leave;
{const p=acts.rxb;acts.rxb=function(){const q=S.sq;if(q&&q.from&&(q.ph==='rx'||q.ph==='game')){leave();return}return p.apply(this,arguments)}}
HWEvents.on('page:viewed',e=>{const q=S.sq;if(q&&q.from&&e.view!=='stress'){sqk();S.sq=q.prev||{ph:'start'}}});   // left by the bottom bar: the earlier quest comes back
HWEvents.on('data:reset',clear);HWEvents.on('data:imported',clear);
HWUI.css('breathe','.pcbox{margin:10px 0;padding:8px;border:3px dashed var(--ln)}.pcbox label{display:block;margin:6px 0}.pcbox input{width:100%;min-height:44px;box-sizing:border-box}.pcbox button{margin:4px 0}.pcbox small{display:block;margin-top:6px}.pcres{margin:8px 0}');
return{phase,change,button,IN_MS,CYCLE_MS,TOTAL_MS}})();
