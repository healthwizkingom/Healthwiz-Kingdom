/* v6 (final polish): badge audit. Not part of the original.
   The badge list (BG, awarded by the original chkB on every render) grew in several steps and fell behind the
   Stairs refactor (js/v6-stairs.js) and the Running Road (js/v6-running.js). This module tidies it, in place:
     • one exact duplicate is retired: 'First Drop' (log your first water entry) = 'First Sip' (log water once). The
       Water page's own achievement list keeps it; a 'First Drop' already earned stays in the save untouched.
     • badges that shared an icon get their own, so the Badge Hall reads at a glance (names never change: earned
       badges are stored by name).
     • new badges for what the app now tracks and the old list never covered:
         First Run / Road Runner (10 km) / Long Road (42 km)       runs finished on the Running Road (healthwiz_runs)
         Trial of Breath / Workout Regular (10)                    stair WORKOUT sessions (not casual climbs)
         Dream Champion                                            a night whose sleep was strong enough to win the
                                                                   Dream Battle (js/v6-dream.js strength ≥ 0.70)
   All progress is read from data that is already saved (no new storage), so it updates with the next render after
   a log, a finished run or a restored backup. */
const HWBadges=(()=>{
const RETIRED=['First Drop'];
const ICON={'Well Keeper':'⛲','Restored':'🛌','Apprentice of Medius':'🎓','Curious Scholar':'🔍','Castle Conqueror':'🏯'};
for(let i=BG.length-1;i>=0;i--)if(RETIRED.includes(BG[i][1]))BG.splice(i,1);
BG.forEach(b=>{if(ICON[b[1]])b[0]=ICON[b[1]]});

const runs=()=>{try{return typeof HWRun!=='undefined'?HWRun.runs():[]}catch(e){return[]}};
const km=()=>Math.floor(runs().reduce((s,r)=>s+(+r.dist||0),0)/100)/10;
const workouts=()=>typeof HWStairs!=='undefined'?HWStairs.all().filter(s=>s.kind==='workout').length:0;
// a Dream Battle win: the strength of some logged night (with the nights before it) reaches the winning line;
// looks at the latest 60 nights, newest first, and stops at the first win
function dreamWin(){if(typeof HWDream==='undefined')return 0;const L=st.e.filter(e=>e.c==='sleep'&&+e.v>0).sort((a,b)=>(a.d+(a.t||'')).localeCompare(b.d+(b.t||'')));
  for(let i=L.length-1,n=0;i>=0&&n<60;i--,n++){const r=HWDream.strength(L.slice(Math.max(0,i-3),i+1),st.p&&st.p.age);if(r&&r.s>=.7)return 1}return 0}
BG.push(
  ['🏃','First Run','Finish a run on the Running Road',()=>[runs().length,1]],
  ['🛣️','Road Runner','Run 10 km in total',()=>[km(),10]],
  ['🏅','Long Road','Run 42 km in total',()=>[km(),42]],
  ['🏋️','Trial of Breath','Finish a stair workout',()=>[workouts(),1]],
  ['💪','Workout Regular','Finish 10 stair workouts',()=>[workouts(),10]],
  ['⚔️','Dream Champion','Sleep well enough to win the Dream Battle',()=>[dreamWin(),1]]);

// The weekly "Mountain paths" quest counts runs as well as stair sessions (both are activity on the Stairs page).
if(typeof HWQuests!=='undefined'&&HWQuests.WEEK['w-stair']){const q=HWQuests.WEEK['w-stair'],c=q.count;
  q.text=g=>'Finish '+g+' stair sessions or runs this week.';
  q.count=D=>c(D)+runs().filter(r=>D.includes(ymd(new Date(r.start)))).length}
return{RETIRED,km,workouts,dreamWin}})();
