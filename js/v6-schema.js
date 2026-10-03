/* v6: saved-data schema versioning + migrations (master prompt §23–24). Not part of the original.
   Loaded before hw-02-core.js, which calls HWSchema.load(DEF) to read localStorage.

   Schema history
     1  unversioned data written by HealthWiz ≤ 5.4.3
     2  adds `sv`; badges "Shrine Visitor"/"Shrine Regular" renamed to "Tower Visitor"/"Tower Regular"
        (earned badges are keyed by name in st.b, so the keys move with their unlock dates)

   Rules: migrations only ever move or add data, never drop entries. Before upgrading,
   repairing or discarding anything, the raw stored text is copied to a
   `healthwiz_backup_<reason>_<time>` key, so nothing is lost. */
const HWSchema=(()=>{
const V=2,KEY='healthwiz',BK='healthwiz_backup_',KEEP=3;
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const MAPS=['b','claimed','en','xd','qx','qd','ck'];

// STEPS[n] upgrades a copy of the data from schema n to n+1.
const STEPS={
1:d=>{const R={'Shrine Visitor':'Tower Visitor','Shrine Regular':'Tower Regular'};
  if(isObj(d.b))Object.keys(R).forEach(o=>{if(d.b[o]!=null){if(d.b[R[o]]==null)d.b[R[o]]=d.b[o];delete d.b[o]}});return d}};

/** → {data, from} on success, {err, from, data} when the data is from a newer app. Never mutates `d`. */
function migrate(d){if(!isObj(d))return{data:null,from:0};
const from=Number.isInteger(d.sv)&&d.sv>0?d.sv:1;
if(from>V)return{err:'This data was saved by a newer version of HealthWiz (data version '+from+'). Update the app before restoring it.',from,data:d};
let x=JSON.parse(JSON.stringify(d));for(let v=from;v<V;v++)x=STEPS[v](x)||x;x.sv=V;return{data:x,from}}

/** Repairs the shape the app relies on (shallow defaults, entry fields). Returns [state, repairsMade]. */
function sanitize(x,DEF){const D=DEF();let fix=0;const o=Object.assign(D,x);
if(!Array.isArray(x.e)){o.e=[];fix++}else{o.e=x.e.filter(e=>isObj(e));fix+=x.e.length-o.e.length;
  o.e.forEach((e,i)=>{if(e.id==null){e.id='m'+Date.now()+i;fix++}else e.id=String(e.id);if(!isObj(e.m)){e.m={};fix++}if(typeof e.n!=='string')e.n=e.n==null?'':String(e.n)})}
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

return{V,migrate,sanitize,load,get notice(){return notice},get migratedFrom(){return from}}})();
