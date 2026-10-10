/* v6: saved-data schema versioning + migrations (master prompt §23–24). Not part of the original.
   Loaded before hw-02-core.js, which calls HWSchema.load(DEF) to read localStorage.

   Schema history
     1  unversioned data written by HealthWiz ≤ 5.4.3
     2  adds `sv`; badges "Shrine Visitor"/"Shrine Regular" renamed to "Tower Visitor"/"Tower Regular"
        (earned badges are keyed by name in st.b, so the keys move with their unlock dates)
     3  adds `q6` = {f:{date:{id,t,done}}, w:{week:{ids,done}}} for focus/weekly quests (js/v6-quests.js)
     4  adds `ex` = {p:{view:firstVisitDate}} for feature discovery (js/v6-streaks.js)
     5  adds `xl` = {date:{category:awardedLogs}} daily XP allowance (js/v6-xp.js)
     6  adds `md` = {last,day,seen,ms,log} Medius reaction memory (js/v6-medius.js)
     7  adds `mg` = {xp:{date:{game:1}}, n:{game:plays}, h:[{id,d,t,ok}], c:{game:{…}}} mini-games (js/v6-games.js)
     8  adds `gp` = {ok, v:{stairId:firstCheckInDate}} GPS check-in (js/v6-gps.js)

   Rules: migrations only ever move or add data, never drop entries. Before upgrading,
   repairing or discarding anything, the raw stored text is copied to a
   `healthwiz_backup_<reason>_<time>` key, so nothing is lost. */
const HWSchema=(()=>{
const V=8,KEY='healthwiz',BK='healthwiz_backup_',KEEP=3;
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const MAPS=['b','claimed','en','xd','qx','qd','ck','q6','ex','xl','md','mg','gp'];

// Security (comfort pass): an entry's structural fields are drawn into the page as they are (ids in data-id="…", values,
// times, meal keys, numbers such as servings or sleep scores), so a crafted backup file, a tampered cloud copy or edited
// storage could inject markup there. Every entry is checked here on load, cloud merge and backup import: ids, category,
// date and time must have their usual shape, values and known numeric fields must be numbers, and meal / kind keys
// plain words. Valid data is never changed; only values that could carry markup are replaced (and reported as repaired). Text fields (food names, notes) are escaped where shown.
const NUMK=['qty','pm','aw','lat','rest','score','end','hrB','hrA','hrR1','climbs','steps'],
  WORDK=['meal','kind'];
// valid data (numbers, numeric strings, null) is left exactly as it is; only values that could carry markup are replaced
const numOk=v=>v==null||v===''||(typeof v==='number'&&isFinite(v))||(typeof v==='string'&&/^\s*-?\d+(\.\d+)?\s*$/.test(v));
function cleanEntry(e,i){let f=0;
  if(!/^[\w.:-]{1,80}$/.test(e.id)){e.id='m'+Date.now()+'_'+i;f++}
  if(typeof e.c!=='string'||!/^[a-z0-9_]{1,24}$/.test(e.c)){e.c=String(e.c==null?'':e.c).toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,24)||'unknown';f++}
  if(!numOk(e.v)){e.v=0;f++}
  if(e.d!=null&&!(typeof e.d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.d))){const t=new Date();e.d=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');f++}
  if(e.t!=null&&!(typeof e.t==='string'&&/^\d{1,2}:\d{2}(:\d{2})?$/.test(e.t))){e.t='12:00';f++}
  const m=e.m;NUMK.forEach(k=>{if(!numOk(m[k])){m[k]=0;f++}});
  WORDK.forEach(k=>{if(m[k]!=null&&!(typeof m[k]==='string'&&/^[\w -]{0,40}$/.test(m[k]))){m[k]=String(m[k]).replace(/[^\w -]/g,'').slice(0,40);f++}});
  return f}

// STEPS[n] upgrades a copy of the data from schema n to n+1.
const STEPS={
1:d=>{const R={'Shrine Visitor':'Tower Visitor','Shrine Regular':'Tower Regular'};
  if(isObj(d.b))Object.keys(R).forEach(o=>{if(d.b[o]!=null){if(d.b[R[o]]==null)d.b[R[o]]=d.b[o];delete d.b[o]}});return d},
2:d=>{if(!isObj(d.q6))d.q6={f:{},w:{}};return d},
3:d=>{if(!isObj(d.ex))d.ex={p:{}};return d},
4:d=>{if(!isObj(d.xl))d.xl={};return d},
5:d=>{if(!isObj(d.md))d.md={last:{},day:{},seen:{},ms:{},log:[]};return d},
6:d=>{if(!isObj(d.mg))d.mg={xp:{},n:{},h:[],c:{}};return d},
7:d=>{if(!isObj(d.gp))d.gp={ok:0,v:{}};return d}};

/** → {data, from} on success, {err, from, data} when the data is from a newer app. Never mutates `d`. */
function migrate(d){if(!isObj(d))return{data:null,from:0};
const from=Number.isInteger(d.sv)&&d.sv>0?d.sv:1;
if(from>V)return{err:'This data was saved by a newer version of HealthWiz (data version '+from+'). Update the app before restoring it.',from,data:d};
let x=JSON.parse(JSON.stringify(d));for(let v=from;v<V;v++)x=STEPS[v](x)||x;x.sv=V;return{data:x,from}}

/** Repairs the shape the app relies on (shallow defaults, entry fields). Returns [state, repairsMade]. */
function sanitize(x,DEF){const D=DEF();let fix=0;const o=Object.assign(D,x);
if(isObj(o.q6)){if(!isObj(o.q6.f)){o.q6.f={};fix++}if(!isObj(o.q6.w)){o.q6.w={};fix++}}
if(isObj(o.ex)&&!isObj(o.ex.p)){o.ex.p={};fix++}
if(isObj(o.md)&&!Array.isArray(o.md.log)){o.md.log=[];fix++}
if(isObj(o.mg)){['xp','n','c'].forEach(k=>{if(!isObj(o.mg[k])){o.mg[k]={};fix++}});if(!Array.isArray(o.mg.h)){o.mg.h=[];fix++}}
if(isObj(o.gp)&&!isObj(o.gp.v)){o.gp.v={};fix++}
if(!Array.isArray(x.e)){o.e=[];fix++}else{o.e=x.e.filter(e=>isObj(e));fix+=x.e.length-o.e.length;
  o.e.forEach((e,i)=>{if(e.id==null){e.id='m'+Date.now()+i;fix++}else e.id=String(e.id);if(!isObj(e.m)){e.m={};fix++}if(typeof e.n!=='string')e.n=e.n==null?'':String(e.n);fix+=cleanEntry(e,i)})}
o.s=Object.assign(DEF().s,isObj(x.s)?x.s:(fix++,{}));o.p=Object.assign(DEF().p,isObj(x.p)?x.p:(fix++,{}));
MAPS.forEach(k=>{if(o[k]!=null&&!isObj(o[k])){o[k]={};fix++}});
if(!(+o.xp>=0)){o.xp=0;fix++}else o.xp=+o.xp;return[o,fix]}

function stash(raw,why){try{localStorage.setItem(BK+why+'_'+Date.now(),raw);
  const ks=Object.keys(localStorage).filter(k=>k.startsWith(BK)).sort();ks.slice(0,Math.max(0,ks.length-KEEP)).forEach(k=>localStorage.removeItem(k))}catch(e){}}
let notice='',from=0;const tell=m=>{notice=m;setTimeout(()=>{if(typeof toast==='function')toast(m)},900)};

/** Reads, migrates and repairs the stored state. Replaces the original `JSON.parse` + `Object.assign(DEF(), st)`. */
function load(DEF){let raw=null;try{raw=localStorage.getItem(KEY)}catch(e){}
if(raw==null)return DEF();
let d;try{d=JSON.parse(raw)}catch(e){d=undefined}
if(!isObj(d)){stash(raw,'unreadable');tell('⚠️ Saved data could not be read, so HealthWiz started fresh. A copy was kept on this device (healthwiz_backup_…).');return DEF()}
const m=migrate(d);
if(m.err){stash(raw,'newer');tell('⚠️ '+m.err+' A copy of your data was kept on this device.');return sanitize(d,DEF)[0]}
from=m.from;const[o,fix]=sanitize(m.data,DEF);
if(m.from<V||fix){stash(raw,fix?'repaired':'pre-v'+V);try{localStorage.setItem(KEY,JSON.stringify(o))}catch(e){}if(fix)tell('🛠️ Some saved data was damaged and has been repaired. The original was kept as a backup copy on this device.')}
return o}

return{V,migrate,sanitize,cleanEntry,load,stash,get notice(){return notice},get migratedFrom(){return from}}})();
