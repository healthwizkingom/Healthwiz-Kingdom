/* v6: Cardiac drift index, a card under the workout on the Stairs workout half. Not part of the original.
   Feature 13 of the owner's catalog, in its honest form (docs/FEATURE_CONSULTS.md). The catalog asked for a plasma-volume deficit and a
   "dehydration shock risk". A pulse cannot show either, and nothing in the app's sources supports an alert threshold, so this builds a
   DESCRIPTIVE index only, with no alert, no detection flag and no risk wording.

   What: the average pulse of the second half of a long, steady workout compared with the first half.
     index = (mean pulse of the second half − mean pulse of the first half) ÷ mean pulse of the first half × 100, one decimal.
   Data: the workout timer (the Pace & Breathe guide that already times the workout) and a Bluetooth heart-rate device. The device gives
   timestamped readings (HWHR.on); the stairs code keeps only a tally, so this file keeps its own in-memory list while the timer runs.
   Camera pulse gives single numbers, not a series, so it cannot qualify.
   HEALTHWIZ'S OWN RULES (no source gives these; the card says so, they are not a medical standard):
     the timer ran unbroken for at least 8:00 · the guide stayed on one pace (a pace change or restart voids the run: "constant guided
     pace", NOT a measured cadence, because the phone's step sensor is not counting here) · the first 2:00 are left out as warm-up (the pulse
     is still climbing) · the rest is cut at its midpoint into two equal halves · each half has at least 90 readings and no gap over 15 s ·
     readings outside 30–220 BPM are dropped (so they count as a gap).
   Weather (optional context, never needed for the index): Open-Meteo's model temperature for Kolej MARA Kulim's FIXED point
   (js/v6-arcana.js HWArcana.wx), shown only when the person has already allowed the lookup and a reading exists from within an hour of the
   workout's end. This file never starts a lookup by itself; READ THE SKY reuses the existing opt-in button. No GPS is involved, and a
   missing or old reading shows nothing: there is no fallback temperature.
   Shown, never saved or scored: memory only until the next run. Stop if dizzy, faint or unwell. Not a medical measurement.
   analyze() and weatherAround() are pure so the tests can check worked examples. */
const HWDrift=(()=>{
const MIN_S=480,WARM_S=120,MIN_N=90,MAX_GAP_S=15,WX_MS=60*6e4,CAP=20000,$i=i=>document.getElementById(i);
const isN=x=>typeof x==='number'&&isFinite(x);
const mmss=s=>{s=Math.max(0,Math.round(s));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
const f1=x=>(+x).toLocaleString('en',{minimumFractionDigits:1,maximumFractionDigits:1});
/* ---------- pure ---------- */
/** buf = [{t (ms), v (BPM)}], start / end = the timer's ms. {ok:true, pct, m1, m2, n1, n2, ...} or {ok:false, why}. */
function analyze(buf,start,end){
  const durS=(end-start)/1000;
  if(!(durS>=MIN_S))return{ok:false,why:'The workout ran '+mmss(durS)+'. The index needs an unbroken guided-pace workout of at least '+mmss(MIN_S)+'.'};
  const a=start+WARM_S*1000,mid=a+(end-a)/2;
  const rows=(buf||[]).filter(r=>r&&isN(r.t)&&isN(r.v)&&r.v>=30&&r.v<=220&&r.t>=a&&r.t<=end).sort((x,y)=>x.t-y.t);
  const H=[rows.filter(r=>r.t<mid),rows.filter(r=>r.t>=mid)],lo=[a,mid],hi=[mid,end],out=[];
  for(let i=0;i<2;i++){const h=H[i],name=i?'second':'first';
    if(h.length<MIN_N)return{ok:false,why:'The '+name+' half has '+h.length+' pulse reading'+(h.length===1?'':'s')+'. It needs at least '+MIN_N+'.'};
    let gap=Math.max(h[0].t-lo[i],hi[i]-h[h.length-1].t);for(let k=1;k<h.length;k++)gap=Math.max(gap,h[k].t-h[k-1].t);
    if(gap>MAX_GAP_S*1000)return{ok:false,why:'There is a gap of '+Math.round(gap/1000)+' s in the '+name+' half of the readings (the limit is '+MAX_GAP_S+' s).'};
    out.push({n:h.length,m:h.reduce((s,r)=>s+r.v,0)/h.length})}
  return{ok:true,durS,halfS:(end-a)/2000,n1:out[0].n,n2:out[1].n,m1:out[0].m,m2:out[1].m,pct:Math.round((out[1].m-out[0].m)/out[0].m*1000)/10}}
/** The model temperature (°C) near the workout's end, or null: the lookup must have worked and be within an hour of `end`. wx = HWArcana.wx. */
function weatherAround(wx,end){return wx&&wx.st==='ok'&&wx.w&&isN(+wx.w.temp)&&isN(+wx.at)&&isN(end)&&Math.abs(wx.at-end)<=WX_MS?{temp:+wx.w.temp,at:+wx.at}:null}

/* ---------- the run (memory only) ---------- */
let R={k:'idle',buf:[],broken:''},tk=0;      // k: idle · run · done
const sgn=p=>p>0?'+'+f1(p):p<0?'−'+f1(Math.abs(p)):f1(0);
function feed(v,t){if(R.k==='run'&&S.pb&&S.pb.on&&isN(v)&&v>=30&&v<=220&&R.buf.length<CAP)R.buf.push({t:isN(t)?t:Date.now(),v})}
const wrap=(k,f)=>{const p=acts[k];acts[k]=function(){return f.call(this,p,arguments)}};
// the run's state is updated BEFORE the original code runs, because it redraws the page itself
wrap('pstart',function(p,a){
  if(R.k==='run')R.broken='The pace guide was restarted or its pace changed, so the pace was not constant.';
  else{R={k:'run',buf:[],broken:'',start:Date.now()};clearInterval(tk);tk=setInterval(live,1000)}
  return p.apply(this,a)});
wrap('pstop',function(p,a){
  if(R.k==='run'){clearInterval(tk);tk=0;const end=Date.now();R={k:'done',end,start:R.start,res:R.broken?{ok:false,why:R.broken}:analyze(R.buf,R.start,end)}}
  return p.apply(this,a)});
if(typeof HWHR!=='undefined'&&HWHR.on)HWHR.on(feed);
function live(){const e=$i('dr-live');if(!e||R.k!=='run')return;e.textContent=mmss((Date.now()-R.start)/1000)+' · '+R.buf.length+' readings'+(R.broken?' · not constant, so it will not count':'')}
HWEvents.on('data:reset',()=>{clearInterval(tk);tk=0;R={k:'idle',buf:[],broken:''}});HWEvents.on('data:imported',()=>{clearInterval(tk);tk=0;R={k:'idle',buf:[],broken:''}});

/* ---------- the card ---------- */
const SAFE='Stop if you feel dizzy, faint or unwell.';
const RULES='HealthWiz’s own rules decide when it is shown (an unbroken guided pace of at least 8:00, the first 2:00 left out as warm-up, at least 90 readings and no gap over 15 s in each half). They are not a medical standard.';
const why=r=>HWHelp.btn('xdrift','How the cardiac drift index is worked out',
  '<p>The workout is cut into a 2:00 warm-up (left out) and two equal halves.</p><p><b>index = (mean pulse of the second half − mean pulse of the first half) ÷ mean pulse of the first half × 100</b></p>'
  +(r&&r.ok?'<p>Your numbers: ('+f1(r.m2)+' − '+f1(r.m1)+') ÷ '+f1(r.m1)+' × 100 = '+sgn(r.pct)+' %, from '+r.n1+' and '+r.n2+' readings in halves of '+mmss(r.halfS)+'.</p>':'')
  +'<p class="mut">'+RULES+' The pace is the guide’s pace, not a measured cadence. No source has been checked for this index, so there is no Evidence Vault entry. It is not a medical measurement and it does not say why a pulse changed.</p>');
function wxHtml(end){
  const w=typeof HWArcana!=='undefined'?HWArcana.wx:null,o=weatherAround(w,end),opted=!!(st.s&&st.s.wx);
  if(o)return'<p>Campus air temperature about then: <b>'+f1(o.temp)+' °C</b> <small class="mut">(Open-Meteo’s model for the campus area, outdoors; not measured at your staircase)</small></p>';
  if(w&&w.st==='busy')return'<p class="mut" role="status">Reading the sky…</p>';
  return'<p class="mut">'+(opted?'No temperature from around the time of this workout.':'No temperature shown.')+'</p><button type="button" class="g sm" data-a="drwx">'+(opted?'READ THE SKY AGAIN':'READ THE SKY (OPTIONAL)')+'</button>'
    +'<small class="mut drs">It asks Open-Meteo for the weather at the college’s fixed point, never yours, and only when you tap.</small>'}
function body(){
  if(typeof HWHR==='undefined'||!HWHR.supported())return'<p class="mut">The index needs a Bluetooth heart-rate device, and this browser cannot connect one.</p>';
  if(R.k==='run')return'<p role="status"><b>Recording.</b> Keep one pace on the guide. <span id="dr-live">'+mmss((Date.now()-R.start)/1000)+' · '+R.buf.length+' readings'+(R.broken?' · not constant, so it will not count':'')+'</span></p>'
    +(R.broken?'<p class="warn" role="alert">'+R.broken+'</p>':'');
  if(R.k==='done'){const r=R.res;
    if(!r.ok)return'<p role="status"><b>Cardiac drift index: unavailable.</b> '+r.why+'</p><small class="mut">'+RULES+'</small>';
    return'<p role="status"><b>Cardiac drift index: '+sgn(r.pct)+' %</b> '+why(r)+'<br>Average pulse '+f1(r.m1)+' BPM in the first half and '+f1(r.m2)+' BPM in the second, at a constant guided pace.</p>'
      +'<p class="mut">Workout '+mmss(r.durS)+'; the first '+mmss(WARM_S)+' left out as warm-up; halves of '+mmss(r.halfS)+' ('+r.n1+' and '+r.n2+' readings). Many things can change a pulse over a long steady effort; this number does not say why.</p>'
      +wxHtml(R.end)+'<small class="mut">'+RULES+'</small>'}
  return'<p>For a long, steady workout with a heart-rate device connected: start the pace guide and keep one pace for at least 8:00. HealthWiz then compares your average pulse in the second half with the first, after a 2:00 warm-up. Campus staircases are short, so this is only for a long guided-pace workout.</p>'+why(null)}
function card(){return'<div class="card stcard drc" id="drift-card"><h3>CARDIAC DRIFT INDEX</h3><span class="pxtag gvtag">DESCRIPTIVE ONLY</span>'+body()+'<small class="mut drs">'+SAFE+' Not saved, scored or a medical measurement.</small></div>'}
const paint=()=>{const c=$i('drift-card');if(c)c.outerHTML=card()};
acts.drwx=()=>{if(typeof acts.arcwx!=='function'||typeof HWArcana==='undefined')return;acts.arcwx();paint();let n=0;const id=setInterval(()=>{n++;if(HWArcana.wx.st!=='busy'||n>20){clearInterval(id);paint()}},500)};
// (whichever way the panel is asked for, the workout half is the one that holds the heart-rate card)
{const p=HWStairs.logPanel;HWStairs.logPanel=function(){const h=p.apply(this,arguments);return typeof h==='string'&&h.includes('id="sthrc"')?h+card():h}}
HWUI.css('drift','.drc h3{margin-bottom:4px}.drc p{margin:8px 0}.drc .drs{display:block;margin-top:8px}.drc .warn{border:3px solid var(--red,#c0392b);padding:6px 8px}');
return{analyze,weatherAround,feed,card,MIN_S,WARM_S,MIN_N,MAX_GAP_S,WX_MS,get state(){return R.k},get run(){return R}}})();
