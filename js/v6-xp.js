/* v6: fair XP (master prompt §37, §97 step 8). Not part of the original.
   The original gives XP for every saved entry, so logging and deleting repeatedly farms XP.
   Here, logging XP has a daily allowance per category, counted by WHEN the log happens
   (backfilling old days cannot farm either) and never refunded by deleting. Over the
   allowance the entry is still saved — only the XP is skipped, with one gentle note.
   Also: a one-time exploration reward for visiting each region, and gain(0) is now a no-op
   (no "+0 XP" toast, no event). State: st.xl = {date: {category: awardedLogs}} (schema v5). */
const HWXP=(()=>{
const CAP={water:8,food:6,sleep:2,pulse:3,stair:4,stress:3,bmi:1};
const REGIONS={food:'Nutrition Village',water:'Water Valley',sleep:'Dream Realm',pulse:'Heartstone Hall',stair:'Stair Mountain',stress:'Mind Forest',bmi:'Balance Tower',calc:'Energy Forge',body:'Body & Energy'};
const xl=()=>(st.xl=st.xl&&typeof st.xl==='object'?st.xl:{},st.xl);
function prune(){const X=xl(),keep=new Set(rng(14));Object.keys(X).forEach(d=>{if(!keep.has(d))delete X[d]})}
const used=(c,d)=>((xl()[d||today()]||{})[c]||0);
const noted=new Set();

const _gain=gain;gain=function(x){if(!(+x))return;return _gain.apply(this,arguments)};
const _add=add;add=function(c,v,m,note,d,t,xp,msg){const cap=CAP[c],k=today();
  if(cap!=null){const n=used(c,k);if(n>=cap){xp=0;if(!noted.has(k+c)){noted.add(k+c);setTimeout(()=>toast('✅ Logged. XP for '+c+' is full for today — logging still counts for your stats and quests.'),350)}}
    else{const X=xl();X[k]=X[k]||{};X[k][c]=n+1;prune()}}
  return _add.call(this,c,v,m,note,d,t,xp,msg)};

// exploration: first visit to each region page gives a small one-time reward
HWEvents.on('page:viewed',e=>{if(!REGIONS[e.view])return;const X=(st.ex=st.ex||{p:{}});X.r=X.r||{};if(X.r[e.view])return;X.r[e.view]=today();save();setTimeout(()=>gain(5,'Explored '+REGIONS[e.view]),0)});
return{CAP,used,remaining:(c)=>CAP[c]==null?Infinity:Math.max(0,CAP[c]-used(c))}})();
