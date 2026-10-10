/* v6: kingdom states and region inspection (master prompt §16–19, §97 step 8). Not part of the original.
   The original regions (KR), their levels klv() 0–3 (days logged in the last 7) and the map stay.
   Added:
     • state names per §16: Ruined → Recovering → Developing → Thriving → Flourishing.
       The first four are the original levels (labels renamed in hw-04 KS). "Flourishing" is a
       fifth tier for regions Thriving this week AND last week. It never applies to Balance Tower
       (BMI) or the Energy Forge (calories), so nothing rewards weighing more often or calorie control.
     • a region detail panel (§19): state, progress to the next state, 7-day log view, related
       stats, related quests (daily / focus / weekly) and a button to enter the activity.
   Events: 'kingdom:state' {key, name, from, to} when a region's state changes after a log. */
const HWKingdom=(()=>{
const NAMES=['Ruined','Recovering','Developing','Thriving','Flourishing'],NOFLOUR={forge:1,bmi:1};
const NEED=[1,3,5]; // days logged in the last 7 to reach Recovering / Developing / Thriving (original klv rule)
const days7=(c,R)=>c==='forge'?R.filter(d=>{const k=kc(d);return k>=st.s.kcal*.6&&k<=st.s.kcal*1.1}).length:R.filter(d=>logd(c,d)).length;
function level(r){const c=r[3],L=klv(c);if(L<3||NOFLOUR[c])return L;return days7(c,rng(15).slice(0,7))>=5?4:3} // last week (completed days) also thriving
function info(i){const r=KR[i],c=r[3],R=rng(7),lv=level(r),n=c==='bmi'?null:days7(c,R),next=lv<3&&c!=='bmi'?NEED[lv]:null;
  return{i,key:r[0],icon:r[1],name:r[2],cat:c,page:r[4],lv,state:NAMES[lv],n,next,hint:KH[i],flourish:lv===4,canFlourish:!NOFLOUR[c],
    dots:c==='bmi'?null:R.map(d=>({d,on:c==='forge'?days7('forge',[d])>0:!!logd(c,d)}))}}
const all=()=>KR.map((r,i)=>info(i));

/* stats + quests related to a region */
const STAT={water:d=>wt(d)+' mL today · '+Math.round(avg(rng(7).map(wt).filter(Boolean))||0)+' mL avg on logged days',food:d=>kc(d)+' kcal today · '+new Set(A('food',d).map(x=>x.m.meal)).size+' meals',sleep:()=>{const s=LC('sleep').pop();return s?s.v+' h last logged ('+s.d.slice(5)+')':'no sleep logged yet'},
  pulse:()=>{const p=LC('stair').filter(e=>e.m&&(+e.m.hrB||+e.m.hrA)).pop();return p?'last workout '+(+p.m.hrB||'–')+' → '+(+p.m.hrA||'–')+' BPM ('+p.d.slice(5)+')'+(+p.m.hrA>0&&+p.m.hrR1>0&&p.m.hrA>p.m.hrR1?' · fell '+(p.m.hrA-p.m.hrR1)+' BPM after 1 min':''):'no workout heart rate logged yet'}, /* workouts only (js/v6-stairs.js) */stair:d=>sp(d)+' steps today · '+rng(7).reduce((s,x)=>s+A('stair',x).length,0)+' sessions this week',
  stress:d=>str(d)==null?'no check-in today':str(d)+'/10 today (self-rated)',bmi:()=>LC('bmi').length?'last saved '+LC('bmi').pop().d.slice(5):'not saved yet',forge:()=>st.s.kcal+' kcal daily plan'};
const QAREA={water:'water',food:'food',sleep:'sleep',stair:'stair',stress:'stress',pulse:'pulse'};
function quests(x){const d=today(),o=[];try{QD(d).forEach(q=>{if(q.v===x.page)o.push((q.p>=1?'✔ ':'• ')+q.n+': '+q.t)})}catch(e){}
  if(typeof HWQuests!=='undefined'){const f=HWQuests.focus();if(f.area===QAREA[x.cat])o.push((f.p>=1?'✔ ':'🎯 ')+'Focus: '+f.name);HWQuests.weekly().forEach(w=>{if(w.area===QAREA[x.cat])o.push((w.p>=1?'✔ ':'🗓️ ')+'Weekly: '+w.name+' ('+Math.min(w.n,w.goal)+'/'+w.goal+')')})}return o}
function panel(i){const x=info(i),prog=x.next?'<p>'+x.n+'/7 days logged this week · <b>'+NAMES[x.lv+1]+'</b> at '+x.next+' days.</p>'+bar(x.n/x.next*100,'var(--grn)'):x.lv===3&&x.canFlourish?'<p>Thriving! Keep it up next week too and it will <b>flourish</b>.</p>':x.lv===4?'<p>🌸 Flourishing — thriving two weeks running.</p>':x.cat==='bmi'?'<p>Restored by saving your BMI occasionally. There is no benefit to weighing more often.</p>':'<p>'+x.state+'.</p>';
  const q=quests(x);
  return '<h3>'+x.icon+' '+esc(x.name)+'</h3><p><b class="big" style="font-size:16px">'+x.state.toUpperCase()+'</b></p>'+prog
  +(x.dots?'<div class="v6wk">'+x.dots.map(o=>'<span class="'+(o.on?'on':'rest')+'">'+['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date(o.d+'T12:00:00').getDay()]+'<b>'+(o.on?'✔':'·')+'</b></span>').join('')+'</div>':'')
  +'<p><small class="mut">📊 '+(STAT[x.cat]?STAT[x.cat](today()):'')+'</small></p>'+(q.length?'<p><b>Quests here</b><br>'+q.map(esc).join('<br>')+'</p>':'<p class="mut">'+esc(x.hint)+' to restore it.</p>')
  +'<div class="row"><button data-a="kgo" data-v="'+x.page+'">ENTER '+esc(x.name.toUpperCase())+'</button><button class="g" data-a="mclose">CLOSE</button></div><span class="gtag">🎮 RESTORATION = DAYS LOGGED, NOT HEALTH</span>'}
acts.kreg=d=>{const m=$('#mo');m.innerHTML='<div class="card" role="dialog" aria-modal="true" aria-label="Region details">'+panel(+d.i)+'</div>';m.hidden=false;const b=m.querySelector('button');if(b)b.focus()};
if(!acts.mclose)acts.mclose=()=>{$('#mo').hidden=true};
acts.kgo=d=>{acts.mclose();go(d.v)}; // close the panel before entering the region
document.addEventListener('click',e=>{if(e.target&&e.target.id==='mo'&&!$('#mo').hidden&&$('#mo [aria-label="Region details"]'))acts.mclose()});

/* kingdom page: Flourishing label, ℹ detail buttons; map: flourishing glow */
HWUI.css('kingdom',`.kn.kf .ki{filter:drop-shadow(0 0 6px #ff9be0) drop-shadow(0 0 2px #fff)}.kn.kf i:after{content:" ✿";color:#ff9be0}`);
{const p=pages.kingdom;pages.kingdom=(...a)=>{let h=p(...a);all().forEach(x=>{const btn='aria-label="Go to '+x.name+'">▶</button>';h=h.replace(btn,btn+'<button class="sm g" data-a="kreg" data-i="'+x.i+'" aria-label="Details for '+esc(x.name)+'">ℹ</button>');if(x.flourish)h=h.replace('<b>'+x.name+' · Thriving</b>','<b>'+x.name+' · Flourishing ✿</b>')});
  const n=all().filter(x=>x.flourish).length;return n?h.replace('RESTORED</b>','RESTORED</b><small class="mut">'+n+' flourishing ✿</small>'):h}}
{const k=kmap;kmap=function(mini){let h=k.apply(this,arguments);all().forEach(x=>{if(x.flourish)h=h.replace('class="kn k3" style="left:'+KR[x.i][5]+'%','class="kn k3 kf" style="left:'+KR[x.i][5]+'%')});return h}}

/* events: announce state changes caused by logging */
// baseline taken now (saved data is already loaded), not on app:ready — a log before app:ready would otherwise be missed
const snap=()=>all().map(x=>x.lv);let last=snap();
['entry:added','entry:deleted','entry:restored','entry:edited','energy:rated'].forEach(t=>HWEvents.on(t,()=>{const now=snap();now.forEach((lv,i)=>{if(lv!==last[i])HWEvents.emit('kingdom:state',{key:KR[i][0],name:KR[i][2],from:NAMES[last[i]],to:NAMES[lv],up:lv>last[i]})});last=now}));
['data:imported','data:reset'].forEach(t=>HWEvents.on(t,()=>{last=snap()}));
return{NAMES,level,info,all,panel}})();
