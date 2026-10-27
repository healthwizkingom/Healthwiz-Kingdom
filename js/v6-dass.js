/* v6: the Stress Quest asks the DASS-21 (owner's request, 2026-10-20: "change the questions and follow the DASS test
   format; keep the calming methods; the mood still sets the weather, but from the DASS result"). Not part of the original.
   * The questions: the 21 statements of the DASS-21 (Lovibond & Lovibond; the DASS is in the public domain, per its
     authors' site), one at a time, each answered on the DASS scale 0–3 for how much it applied "over the past week".
     They replace the original's "How do you feel?" faces, the list of reasons and the stress slider.
   * The result: each scale (Depression, Anxiety, Stress) is the sum of its 7 answers × 2 (0–42), the scoring the DASS FAQ
     gives for the 21-item form. HealthWiz shows the three scores and does not name severity bands: the DASS's cut-offs
     are in its manual, which was not opened for this app, and the authors call them arbitrary. It is a self-check, not a
     diagnosis; the help numbers are always shown with the result.
   * The weather: the storm's level (1–10, the original scene and the knight of js/v6-storm.js) follows the total of all
     21 answers (0–63): level = 1 + round(9 × total ÷ 63). Henry & Crawford (2005) found the three scales share a general
     distress factor, which is what the total stands for. It is a game picture, not a measurement.
   * Then the original quest goes on unchanged: the creatures in the storm (their order now follows the highest scale:
     Stress → Rusher, Perfectionist; Anxiety → Worry Wisp, Overthinker; Depression → Distractor), the calming activities
     of js/v6-relief.js, "How do you feel now?", and the saved check-in.
   * Saved: the same 'stress' entry as before (value = the weather level, 1–10), with m.feel naming the three scores and a
     new optional m.dass = {d, a, s (0–42 each), t (0–63), i: the 21 answers}. Older check-ins are read as they are, so no
     migration is needed. Nothing is saved until the quest is finished (FINISH QUEST), as before. */
const HWDass=(()=>{
// [scale, statement]: d depression, a anxiety, s stress; the DASS-21 in its published order
const IT=[['s','I found it hard to wind down'],['a','I was aware of dryness of my mouth'],['d','I couldn\'t seem to experience any positive feeling at all'],
  ['a','I experienced breathing difficulty (e.g. excessively rapid breathing, breathlessness in the absence of physical exertion)'],['d','I found it difficult to work up the initiative to do things'],
  ['s','I tended to over-react to situations'],['a','I experienced trembling (e.g. in the hands)'],['s','I felt that I was using a lot of nervous energy'],
  ['a','I was worried about situations in which I might panic and make a fool of myself'],['d','I felt that I had nothing to look forward to'],['s','I found myself getting agitated'],
  ['s','I found it difficult to relax'],['d','I felt down-hearted and blue'],['s','I was intolerant of anything that kept me from getting on with what I was doing'],
  ['a','I felt I was close to panic'],['d','I was unable to become enthusiastic about anything'],['d','I felt I wasn\'t worth much as a person'],['s','I felt that I was rather touchy'],
  ['a','I was aware of the action of my heart in the absence of physical exertion (e.g. sense of heart rate increase, heart missing a beat)'],['a','I felt scared without any good reason'],
  ['d','I felt that life was meaningless']];
const OPT=['Did not apply to me at all','Applied to me to some degree, or some of the time','Applied to me to a considerable degree, or a good part of the time','Applied to me very much, or most of the time'];
const NAME={d:'Depression',a:'Anxiety',s:'Stress'};
/** answers (21 numbers 0–3) → {d, a, s: scale × 2 (0–42), t: total of the answers (0–63)} */
function scores(ans){const r={d:0,a:0,s:0};IT.forEach((x,i)=>{r[x[0]]+=+ans[i]||0});return{d:r.d*2,a:r.a*2,s:r.s*2,t:r.d+r.a+r.s}}
/** the storm's level for a total: 0 → 1 (calm) … 63 → 10 */
const level=t=>Math.max(1,Math.min(10,1+Math.round(9*t/63)));
// which creatures appear first: the highest scale's (ties keep the order Stress, Anxiety, Depression)
const CREW={s:['rusher','perfectionist'],a:['worry','overthinker'],d:['distractor']};
function crew(sc){const l=[];['s','a','d'].slice().sort((x,y)=>sc[y]-sc[x]).forEach(k=>CREW[k].forEach(m=>l.includes(m)||l.push(m)));
  ['rusher','overthinker','distractor','perfectionist','worry'].forEach(m=>l.includes(m)||l.push(m));return l}

const HELP='<div class="dshelp" role="note"><b>If you might be in danger or thinking of harming yourself, please reach out now:</b><ul>'
  +'<li>Emergency: <a href="tel:999"><b>999</b></a> (Malaysia) or your local emergency number</li><li>Befrienders KL (24 h emotional support): <a href="tel:+60376272929"><b>03-7627 2929</b></a></li>'
  +'<li>Talian Kasih: <a href="tel:15999"><b>15999</b></a></li><li>Your campus counselling unit, or a trusted friend or family member</li></ul></div>';
const young=()=>{const a=+(st.p&&st.p.age);return a>0&&a<14};

function question(q){const i=q.i,x=IT[i];
  return '<p class="dsstep">Statement <b>'+(i+1)+'</b> of 21</p>'+bar((i)/21*100,'var(--vio)')
    +'<p class="mut dsinst">How much did this statement apply to you <b>over the past week</b>? There are no right or wrong answers. Do not spend too much time on any statement.</p>'
    +'<p class="dsq" id="dsq">'+esc(x[1])+'</p><div class="dsopts" role="group" aria-labelledby="dsq">'
    +OPT.map((o,v)=>'<button type="button" class="g dso'+(q.ans[i]===v?' on':'')+'" data-a="dsa" data-v="'+v+'"'+(q.ans[i]===v?' aria-pressed="true"':'')+'><b>'+v+'</b><span>'+o+'</span></button>').join('')+'</div>'
    +'<div class="row dsnav">'+(i?'<button type="button" class="g sm" data-a="dsb">BACK</button>':'')+'<button type="button" class="g sm" data-a="sqz">LEAVE THE CHECK-IN</button></div>'
    +'<small class="mut">DASS-21: Lovibond &amp; Lovibond, in the public domain. Nothing is saved until you finish the quest.</small>'}
function result(q){const D=q.dass,row=k=>'<div class="dsrow"><span>'+NAME[k]+'</span><b class="num">'+D[k]+'</b><small>of 42</small>'+bar(D[k]/42*100,'var(--vio)')+'</div>';
  const how='<p>Each scale adds up its 7 answers (0 to 3 each) and multiplies by 2, so it runs from 0 to 42: the scoring the DASS authors give for the 21-statement form, so it can be compared with the full DASS.</p>'
    +'<p>Higher means you noticed more of those feelings over the past week. The DASS manual also sets severity bands; HealthWiz shows the scores only.</p>'
    +'<p>The storm follows your total, '+D.t+' of 63: level = 1 + round(9 × '+D.t+' ÷ 63) = '+q.r+' of 10. The weather is a game picture, not a measurement.</p>';
  return '<div class="big">YOUR DASS-21 CHECK-IN</div>'
    +'<div class="dsres">'+row('d')+row('a')+row('s')+'</div>'
    +'<p class="dsnote"><b>A self-check questionnaire, not a diagnosis.</b> '+(typeof HWHelp!=='undefined'?HWHelp.btn('dasshow','How these scores are worked out',how):'')+' If these feelings are strong or keep going, talking to a counsellor, a doctor or someone you trust can help.</p>'
    +(young()?'<p class="mut">The DASS is made for ages 14 and up; for younger people its authors suggest the youth version.</p>':'')
    +HELP+'<p>The world now reflects your answers.</p><button data-a="sqe">MEET WHAT’S IN THE STORM</button>'}

/* ---------- the page: the DASS phases come before the original quest ---------- */
const base=pages.stress;
pages.stress=function(){const q=S.sq;
  if(q&&(q.ph==='dass'||q.ph==='res')){
    const top=q.ph==='res'?'<div id="qsc">'+sqScene(q.r,q.all)+'</div><div id="qmt" class="qm">'+sqMeter(q.r)+'</div>':'';
    return '<h2>🧠 STRESS QUEST</h2><div class="card dscard">'+top+(q.ph==='dass'?question(q):result(q))+'</div><div class="card"><h3>CHECK-INS</h3>'+list('stress')+'</div>'}
  return base.apply(this,arguments)};

/* The DASS-21 is a WEEKLY check-in (its statements ask about "the past week"): finishing the 21 statements logs it by itself,
   once per Monday–Sunday week, and that week then counts as done on the Health Hall (the tile and the Next step stop asking).
   FINISH QUEST later completes this same entry (the storm, the calming tools) instead of adding a second one. */
const mon=d=>{const x=new Date((d||today())+'T12:00:00');x.setDate(x.getDate()-((x.getDay()+6)%7));return ymd(x)};
const sun=d=>{const x=new Date(mon(d)+'T12:00:00');x.setDate(x.getDate()+6);return ymd(x)};
/** this week's DASS-21 entry (the one containing day d, default today), or undefined */
const weekEntry=d=>{const a=mon(d),z=sun(d);return LC('stress').filter(e=>e.m&&e.m.dass&&e.d>=a&&e.d<=z).pop()};
const weekDone=d=>!!weekEntry(d);
function autolog(q){if(!q||!q.dass||weekDone())return;const w=HWWhen.stamp({sig:'s'+q.r0});if(!w)return;const D=q.dass;
  add('stress',q.r0,{feel:q.feel,end:q.r0,why:[],tech:[],dass:{d:D.d,a:D.a,s:D.s,t:D.t,i:D.i.slice()}},'',w.d,w.t,10,'DASS-21 check-in');
  q.dassId=st.e[st.e.length-1].id;HWWhen.saved(w,'Check-in')}
// BEGIN THE QUEST: the 21 statements (instead of the faces, the reasons and the slider)
acts.sqs=()=>{sqk();S.sq={ph:'dass',i:0,ans:[]};render();const e=document.getElementById('dsq');if(e)e.scrollIntoView({block:'center',behavior:'auto'})};
acts.dsa=d=>{const q=S.sq;if(!q||q.ph!=='dass')return;const v=+d.v;if(!(v>=0&&v<=3))return;q.ans[q.i]=v;
  if(q.i<IT.length-1){q.i++;render();return}
  const sc=scores(q.ans),r=level(sc.t);
  S.sq={ph:'res',r,r0:r,dass:Object.assign(sc,{i:q.ans.slice()}),feel:'DASS-21: Depression '+sc.d+', Anxiety '+sc.a+', Stress '+sc.s+' (of 42)',why:[],own:'',all:crew(sc),tries:[]};
  autolog(S.sq);render();window.scrollTo(0,0)};
acts.dsb=()=>{const q=S.sq;if(q&&q.ph==='dass'&&q.i>0){q.i--;render()}};
// the saved check-in keeps the DASS answers and scores (an optional field; nothing else in the entry changes)
{const f0=acts.sqfin;acts.sqfin=(...a)=>{const q=S.sq,n=st.e.length,D=q&&q.dass;
  const e0=q&&q.dassId&&st.e.find(x=>x.id===q.dassId);
  if(e0){sqk();e0.m.end=q.r;e0.m.why=(q.why||[]).map(i=>SQW[i][1]);e0.m.tech=q.tries;e0.n=q.own||'';save();gain(10+q.tries.length*5,'Quest complete');q.ph='end';render();return}
  f0(...a);
  const e=st.e[st.e.length-1];if(D&&st.e.length>n&&e&&e.c==='stress'){e.m.dass={d:D.d,a:D.a,s:D.s,t:D.t,i:D.i.slice()};save()}}}

HWUI.css('dass',`
.dsstep{margin:0 0 4px}.dsinst{margin:8px 0}.dsq{font:600 18px/1.45 var(--fn);margin:12px 0}
.dsopts{display:grid;gap:8px}.dso{margin:0;min-height:52px;display:flex;align-items:center;gap:12px;text-align:left;font:15px/1.35 var(--fn);text-transform:none;letter-spacing:0}
.dso b{flex:0 0 auto;width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:var(--vio);color:#fff;font:700 16px var(--fn)}
.dso.on{outline:3px solid var(--gold);outline-offset:1px}.dsnav{margin:12px 0 6px;gap:8px}
.dsres{display:grid;gap:10px;margin:10px 0}.dsrow{display:grid;grid-template-columns:minmax(96px,auto) auto 1fr;align-items:center;gap:4px 10px}
.dsrow .num{font-size:24px}.dsrow .bar{grid-column:1/-1;margin:0}.dsnote{margin:10px 0}
.dshelp{border:3px solid var(--red);padding:8px 12px;margin:10px 0;font-size:14px}.dshelp ul{margin:6px 0;padding-left:18px}.dshelp a{color:var(--gold)}
`);
return{IT,OPT,scores,level,crew,weekDone,weekEntry}})();
