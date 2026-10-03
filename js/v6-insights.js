/* v6: data-driven insight engine (master prompt §25–27, §97 step 5). Not part of the original.
   Adds observations that compare the user with THEIR OWN recent data (personal baselines,
   this week vs last week, today vs a typical day, consistency, cross-metric patterns),
   ranks them and shows a short list. The original insights()/anomalies() and their
   guide cards are kept untouched; this adds a "Medius notices" card on top.

   Language rules: observational ("your logged…"), no diagnoses, no praise for eating less,
   no guilt for gaps, estimates labelled, and every insight states what data it is based on.

     HWInsights.list()      → ranked insights (cached per data version)
     HWInsights.top(n)      → best n, at most one per health area
   Events: 'insights:updated' {ids}, 'insight:new' {insight} when a new insight reaches the top 3. */
const HWInsights=(()=>{
const W=7,T=()=>st.s,r1=x=>Math.round(x*10)/10,pct=(a,b)=>b?(a-b)/b:0;
// completed days only (today is partial): w0 = the 7 days before today, w1 = the 7 before that
const wins=()=>{const d=rng(15).slice(0,14);return{w1:d.slice(0,7),w0:d.slice(7)}};
const vals=(days,f)=>days.map(f).filter(v=>v!=null&&v!==0&&!isNaN(v));
const plural=(n,w)=>n+' '+w+(n===1?'':'s');
const I=(o)=>Object.assign({tone:'info',pri:30},o);

const GEN=[
// 1. welcome back after a gap (no guilt)
()=>{const ds=dys();if(!ds.length)return null;const last=ds[ds.length-1],gap=Math.round((new Date(today()+'T12:00:00')-new Date(last+'T12:00:00'))/864e5);
  if(gap<3)return null;return I({id:'gap',area:'logging',icon:'🏰',title:'Welcome back',tone:'info',pri:80,
  text:'Your last log was '+plural(gap,'day')+' ago. Nothing was lost — your kingdom waited for you.',action:'Start small: log one glass of water.',basis:'based on your log dates',go:'water'})},
// 2. hydration: this week vs last week, else target consistency
()=>{const{w0,w1}=wins(),a=vals(w0,wt),b=vals(w1,wt);if(a.length<3)return null;const A0=Math.round(avg(a));
  if(b.length>=3){const B0=Math.round(avg(b)),ch=pct(A0,B0);
    if(ch<=-.15)return I({id:'water-down',area:'water',icon:'💧',title:'Water lower than last week',tone:'notice',pri:62,text:'You logged about '+A0+' mL a day this week, compared with about '+B0+' mL the week before.',action:'Pair a glass of water with each meal.',basis:'based on '+a.length+' + '+b.length+' logged days',go:'water'});
    if(ch>=.15)return I({id:'water-up',area:'water',icon:'💧',title:'More water than last week',tone:'good',pri:38,text:'You logged about '+A0+' mL a day this week, up from about '+B0+' mL.',action:'Keep the routine that is working.',basis:'based on '+a.length+' + '+b.length+' logged days',go:'water'})}
  const met=w0.filter(d=>wt(d)>=T().water).length;
  return met<a.length/2?I({id:'water-target',area:'water',icon:'💧',title:'Water target reached on '+met+' of '+a.length+' days',tone:'notice',pri:52,text:'On days you logged water this week you averaged about '+A0+' mL; your target is '+T().water+' mL.',action:'Spread sips across the day rather than all at once.',basis:'based on '+a.length+' logged days',go:'water'})
    :I({id:'water-good',area:'water',icon:'💧',title:'Steady hydration',tone:'good',pri:28,text:'You reached your water target on '+met+' of '+a.length+' logged days this week.',action:'More than your target is not better — steady is the goal.',basis:'based on '+a.length+' logged days',go:'water'})},
// 3. hydration today vs a typical day for you (only later in the day, never a nag in the morning)
()=>{const base=vals(rng(15).slice(0,14),wt);if(base.length<4||new Date().getHours()<15)return null;const B=Math.round(avg(base)),now=wt(today());
  if(now>=B*.5)return null;return I({id:'water-today',area:'water',icon:'💧',title:'Less water than usual so far today',tone:'notice',pri:57,text:'So far today you logged '+now+' mL. On a typical day you reach about '+B+' mL.',action:'A glass with your next meal is an easy catch-up.',basis:'your average over '+base.length+' logged days',go:'water'})},
// 4. sleep: average vs age range, then consistency, then trend
()=>{const{w0,w1}=wins(),a=vals(w0,slH);if(a.length<3)return null;const[lo,hi]=SR(+st.p.age||16),A0=r1(avg(a)),b=vals(w1,slH);
  if(A0<lo)return I({id:'sleep-short',area:'sleep',icon:'🌙',title:'Nights shorter than your range',tone:'notice',pri:60,text:'Your logged sleep averaged '+A0+' h this week. The recommended range for your age is '+lo+'–'+hi+' h.',action:'Try a steady bedtime and screens down 30 minutes before.',basis:'based on '+plural(a.length,'night'),go:'sleep'});
  const bm=LC('sleep').filter(e=>w0.indexOf(e.d)>=0).map(e=>tmin(e.m.bed)).filter(x=>x!=null).map(nrm),sd=bstd(bm);
  if(bm.length>=3&&sd>60)return I({id:'sleep-irregular',area:'sleep',icon:'🌙',title:'Bedtimes varied a lot',tone:'notice',pri:42,text:'Your logged bedtimes varied by about ±'+Math.round(sd)+' minutes this week.',action:'A regular bedtime, even on weekends, helps steady energy.',basis:'based on '+plural(bm.length,'bedtime'),go:'sleep'});
  if(b.length>=3&&A0-avg(b)>=.75)return I({id:'sleep-up',area:'sleep',icon:'🌙',title:'More sleep than last week',tone:'good',pri:36,text:'You averaged '+A0+' h this week, up from '+r1(avg(b))+' h.',action:'Nice — keep protecting that time.',basis:'based on '+a.length+' + '+b.length+' nights',go:'sleep'});
  return I({id:'sleep-good',area:'sleep',icon:'🌙',title:'Sleep within your range',tone:'good',pri:26,text:'Your logged sleep averaged '+A0+' h this week, inside the '+lo+'–'+hi+' h range for your age.',action:'Keep your wind-down routine.',basis:'based on '+plural(a.length,'night'),go:'sleep'})},
// 5. stress: trend vs your previous week, or high average
()=>{const{w0,w1}=wins(),a=vals(w0,str);if(a.length<3)return null;const A0=r1(avg(a)),b=vals(w1,str);
  if(A0>=7)return I({id:'stress-high',area:'stress',icon:'🧠',title:'Stress check-ins have been high',tone:'notice',pri:66,text:'Your self-rated stress averaged '+A0+'/10 this week.',action:'Try a calming practice in the Mind Forest, and talk to someone you trust if it continues.',basis:'based on '+plural(a.length,'check-in day'),go:'stress'});
  if(b.length>=3){const B0=avg(b);if(A0-B0>=1.5)return I({id:'stress-up',area:'stress',icon:'🧠',title:'Stress higher than last week',tone:'notice',pri:55,text:'Your self-rated stress averaged '+A0+'/10 this week, compared with '+r1(B0)+'/10 the week before.',action:'A few slow breaths with Medius can help in the moment.',basis:'based on '+a.length+' + '+b.length+' check-in days',go:'stress'});
    if(B0-A0>=1.5)return I({id:'stress-down',area:'stress',icon:'🧠',title:'Stress easing',tone:'good',pri:40,text:'Your self-rated stress averaged '+A0+'/10 this week, down from '+r1(B0)+'/10.',action:'Notice what helped this week.',basis:'based on '+a.length+' + '+b.length+' check-in days',go:'stress'})}
  return null},
// 6. activity: stair sessions this week vs last week (only if the user is logging at all)
()=>{const d=rng(14),w1=d.slice(0,7),w0=d.slice(7),n=w=>w.reduce((s,x)=>s+A('stair',x).length,0),a=n(w0),b=n(w1),any=w0.some(x=>A('water',x).length||A('food',x).length||A('sleep',x).length);
  if(!any&&!a)return null;
  if(!a&&!b)return I({id:'stair-none',area:'stair',icon:'🧗',title:'Stair Mountain is waiting',tone:'info',pri:22,text:'No stair sessions in the last two weeks.',action:'One easy flight at a comfortable pace is a fine start.',basis:'based on 14 days',go:'stair'});
  if(b>=2&&a<b/2)return I({id:'stair-down',area:'stair',icon:'🧗',title:'Fewer stair sessions this week',tone:'info',pri:34,text:'You logged '+plural(a,'session')+' this week, compared with '+b+' the week before.',action:'Rest weeks are fine. When ready, try one easy session.',basis:'based on 14 days',go:'stair'});
  if(a>b&&a>=2)return I({id:'stair-up',area:'stair',icon:'🧗',title:'More active than last week',tone:'good',pri:34,text:'You logged '+plural(a,'stair session')+' this week, up from '+b+'.',action:'Keep a comfortable pace and rest when needed.',basis:'based on 14 days',go:'stair'});
  return null},
// 7. nutrition: logging completeness, calories vs plan (never praises eating less), fiber (estimated)
()=>{const{w0}=wins(),fd=w0.filter(d=>A('food',d).length);if(fd.length<3)return null;const meals=avg(fd.map(d=>new Set(A('food',d).map(x=>x.m.meal)).size)),K=Math.round(avg(fd.map(kc)));
  if(meals<2)return I({id:'food-partial',area:'food',icon:'🍗',title:'Some meals may be missing',tone:'info',pri:44,text:'On days you log food you usually log '+r1(meals)+' meal'+(meals>=1.5?'s':'')+' (about '+K+' kcal).',action:'Logging every meal makes these notes more accurate.',basis:'based on '+fd.length+' food-logged days',go:'food'});
  if(K>T().kcal*1.1)return I({id:'food-over',area:'food',icon:'🍗',title:'Above your planned range',tone:'info',pri:40,text:'Your logged intake averaged about '+K+' kcal a day; your plan is '+T().kcal+' kcal.',action:'That can be fine on active days. Check the plan still fits in the Energy Forge.',basis:'based on '+fd.length+' food-logged days',go:'calc'});
  const fb=avg(fd.map(d=>dmac(d).fb)),ref=mref().fb;
  if(ref&&fb<ref*.7)return I({id:'food-fiber',area:'food',icon:'🌾',title:'Fiber could be higher (estimated)',tone:'info',pri:32,text:'Estimated fiber averaged about '+Math.round(fb)+' g on logged days; a typical reference for your plan is '+ref+' g.',action:'Vegetables, fruit, oats, dhal or tempe add fiber.',basis:'estimates from '+fd.length+' food-logged days',go:'food'});
  return I({id:'food-good',area:'food',icon:'🍗',title:'Meals logged consistently',tone:'good',pri:24,text:'You logged about '+r1(meals)+' meals a day on '+fd.length+' days this week.',action:'Variety across the week matters more than any single day.',basis:'based on '+fd.length+' food-logged days',go:'food'})},
// 8. strongest personal pattern from the original health-connections analysis (30 days)
()=>{let c;try{c=cxAll().filter(x=>!x.need&&!x.game&&x.rel>=.15).sort((p,q)=>q.rel-p.rel)[0]}catch(e){c=null}if(!c)return null;const f=v=>c.sc?r1(v):Math.round(v);
  return I({id:'pattern-'+c.ttl,area:'pattern',icon:'🔗',title:'A pattern in your logs: '+c.ttl.toLowerCase(),tone:'info',pri:33,text:'On '+c.la+' days your '+c.yn+' averaged '+f(c.a)+c.yu+', versus '+f(c.b)+c.yu+' on '+c.lb+' days.',action:'An observed pattern in your own data, not proof of cause.',basis:'based on '+c.na+' + '+c.nb+' days',go:'stats'})},
// 9. consistency streak (positive, low priority)
()=>{const ds=new Set(dys());let n=0;const d=new Date();if(!ds.has(ymd(d)))d.setDate(d.getDate()-1);while(ds.has(ymd(d))){n++;d.setDate(d.getDate()-1)}
  return n>=3?I({id:'streak',area:'logging',icon:'🔥',title:plural(n,'day')+' of logging in a row',tone:'good',pri:20,text:'You have logged something every day for '+plural(n,'day')+'.',action:'Missing a day never costs hearts. Return whenever you can.',basis:'based on your log dates',go:'quests'}):null}];

let ck=-1,cache=[];
function list(){if(ck===SV)return cache;const out=[];for(const g of GEN){try{const x=g();if(x)out.push(x)}catch(e){console.error('[HWInsights]',e)}}ck=SV;return cache=out.sort((a,b)=>b.pri-a.pri)}
function top(n){const seen=new Set(),o=[];for(const x of list()){if(seen.has(x.area))continue;seen.add(x.area);o.push(x);if(o.length>=(n||3))break}return o}
const TONE={notice:'var(--blue)',good:'var(--grn)',info:'var(--mut)'};
function card(n,id){const L=top(n);if(!L.length)return '';return '<div class="card" id="'+id+'"><h3>🔮 MEDIUS NOTICES</h3>'+L.map(x=>'<div class="aq" data-ins="'+esc(x.id)+'"><span class="ae">'+x.icon+'</span><div class="an"><b>'+esc(x.title)+'</b><small>'+esc(x.text)+'</small><small style="display:block;color:'+TONE[x.tone]+'">➜ '+esc(x.action)+'</small><small class="mut" style="display:block;font-size:11px">'+esc(x.basis)+'</small></div>'+(x.go?'<button class="sm g" data-a="go" data-v="'+x.go+'" aria-label="Open '+esc(x.title)+'">▶</button>':'')+'</div>').join('')+'<span class="gtag">OBSERVATIONS FROM YOUR OWN LOGS · NOT MEDICAL ADVICE</span></div>'}

// surfaces: guide (top 5, above the original cards) and home (top 2, before "Your adventure")
{const g=pages.guide;pages.guide=(...a)=>{const h=g(...a),c=card(5,'insg'),k='<h2>💡 HEALTHWIZ GUIDE</h2>';return h.indexOf(k)>=0?h.replace(k,k+c):c+h}}
{const hm=pages.home;pages.home=(...a)=>{const h=hm(...a),c=card(2,'insh'),k='<h2 class="sec">YOUR ADVENTURE</h2>';return h.indexOf(k)>=0?h.replace(k,c+k):h+c}}

// events: recompute after data changes; announce insights that newly reach the top 3
let shown=new Set();
function refresh(announce){const t=top(3),ids=t.map(x=>x.id);HWEvents.emit('insights:updated',{ids});if(announce)t.filter(x=>!shown.has(x.id)).forEach(x=>HWEvents.emit('insight:new',{insight:x}));shown=new Set(ids)}
['entry:added','entry:edited','entry:deleted','entry:restored','energy:rated'].forEach(t=>HWEvents.on(t,()=>refresh(true)));
['data:imported','data:reset','app:ready'].forEach(t=>HWEvents.on(t,()=>refresh(false)));
return{list,top,card,refresh}})();
