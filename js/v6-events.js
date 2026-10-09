/* v6: app event bus (master prompt §97 step 4). Not part of the original.
   Loaded after the original parts, before v6-safety.js and boot. It changes no behaviour:
   it observes the original functions by wrapping their global names and emits domain
   events that later systems (insights, Medius, quests, kingdom) can subscribe to.
   Catalog and payloads: docs/EVENTS.md.

     HWEvents.on('entry:added', e => …)   // returns an unsubscribe function
     HWEvents.on('*', e => …)             // every event
     HWEvents.once(type, fn) · off(type, fn) · emit(type, payload) · recent(type?, n?)

   Every event is {type, at (ISO time), ...payload}. Listeners run synchronously after the
   action that caused them; a listener that throws is logged and never breaks the app. */
const HWEvents=(()=>{
const L={},LOG=[],MAX=200;let depth=0,queue=[],quiet=0;
function on(t,f){(L[t]=L[t]||[]).push(f);return()=>off(t,f)}
function off(t,f){L[t]=(L[t]||[]).filter(x=>x!==f)}
function once(t,f){const u=on(t,e=>{u();f(e)});return u}
function deliver(ev){LOG.push(ev);if(LOG.length>MAX)LOG.shift();for(const f of [...(L[ev.type]||[]),...(L['*']||[])]){try{f(ev)}catch(err){console.error('[HWEvents] listener for "'+ev.type+'" failed:',err)}}}
// Breadth-first: events raised while others are being delivered join the end of the queue,
// so every direct effect of an action is delivered before reactions to those effects.
// Guard: an accidental event loop (a listener re-emitting what it handles) is cut off after
// 5000 deliveries in one flush instead of freezing the page.
let flushing=0;function flush(){if(flushing)return;flushing=1;let n=0;try{while(queue.length){if(++n>5000){console.error('[HWEvents] event loop detected; dropped',queue.length,'events, last type:',queue[queue.length-1].type);queue=[];break}deliver(queue.shift())}}finally{flushing=0}}
// the event name always wins over payload fields
function emit(type,p){const ev=Object.assign({},p||{},{type,at:new Date().toISOString()});queue.push(ev);if(!depth)flush();return ev}
// Runs fn; events raised inside are held, then delivered after `lead()`'s events, so
// effects follow their cause (entry:added → xp:gained → quest:completed).
function cause(fn,lead){depth++;let r,leads=[];try{r=fn()}finally{depth--;try{leads=(lead&&lead(r))||[]}catch(e){console.error(e)}
  const L2=leads.map(([t,p])=>Object.assign({},p||{},{type:t,at:new Date().toISOString()}));
  if(!depth){queue=L2.concat(queue);flush()}else L2.forEach(ev=>queue.push(ev))}return r}
const recent=(t,n)=>LOG.filter(e=>!t||e.type===t).slice(-(n||MAX));
return{on,off,once,emit,cause,recent,get log(){return LOG.slice()},get quiet(){return quiet},hush(fn){quiet++;try{return fn()}finally{quiet--}}}})();

/* ---------- observe the original app ---------- */
{const E=HWEvents,clone=x=>JSON.parse(JSON.stringify(x));
// baselines for awards made inside render() (quests in st.qx, badges in st.b)
let bQX={},bB={},bClaimed={};const snap=()=>{bQX=Object.assign({},st.qx||{});bB=Object.assign({},st.b||{});bClaimed=Object.assign({},st.claimed||{})};snap();
function awards(){if(E.quiet){snap();return[]}const ev=[];
  Object.keys(st.qx||{}).filter(k=>!bQX[k]).forEach(k=>{const[d,i]=k.split(':'),q=(()=>{try{return QD(d)[+i]}catch(e){return null}})();ev.push(['quest:completed',{kind:'daily',date:d,index:+i,name:q?q.n:'',xp:q?q.x:0}])});
  Object.keys(st.claimed||{}).filter(k=>!bClaimed[k]&&/^\d{4}-\d{2}-\d{2}$/.test(k)).forEach(d=>ev.push(['quests:all-completed',{date:d}]));
  Object.keys(st.b||{}).filter(k=>!bB[k]).forEach(n=>{const b=BG.find(x=>x[1]===n);ev.push(['badge:unlocked',{name:n,icon:b?b[0]:'',date:st.b[n]}])});
  snap();return ev}

const _gain=gain;gain=function(x,m){const l0=lvl().i;return E.cause(()=>_gain.apply(this,arguments),()=>{const L=lvl(),ev=[['xp:gained',{amount:+x||0,reason:m||'',total:st.xp}]];if(L.i>l0)ev.push(['level:up',{level:L.i+1,name:L.n,total:st.xp}]);return ev})};
const _add=add;add=function(){const n0=st.e.length;return E.cause(()=>_add.apply(this,arguments),()=>st.e.length>n0?[['entry:added',{entry:clone(st.e[st.e.length-1])}]]:[])};
const _render=render;render=function(){return E.cause(()=>_render.apply(this,arguments),awards)};
const _go=go;go=function(v){const from=S.v;return E.cause(()=>_go.apply(this,arguments),()=>[['page:viewed',{view:S.v,from,requested:v}]])};

const wrapAct=(k,f)=>{const o=acts[k];if(o)acts[k]=function(d,t,e){return f(o,d,t,e)}};
wrapAct('esave',(o,d,t,e)=>{const x=st.e.find(y=>y.id===S.ed),b=x&&clone(x);return E.cause(()=>o(d,t,e),()=>{const a=b&&st.e.find(y=>y.id===b.id);return a&&JSON.stringify(a)!==JSON.stringify(b)?[['entry:edited',{entry:clone(a),before:b}]]:[]})});
wrapAct('del',(o,d,t,e)=>{const x=st.e.find(y=>y.id===d.id),b=x&&clone(x);return E.cause(()=>o(d,t,e),()=>b&&!st.e.some(y=>y.id===b.id)?[['entry:deleted',{entry:b}]]:[])});
wrapAct('undo',(o,d,t,e)=>{const u=UD&&clone(UD);return E.cause(()=>o(d,t,e),()=>u&&!UD&&st.e.some(y=>y.id===u.id)?[['entry:restored',{entry:u}]]:[])});
wrapAct('ener',(o,d,t,e)=>{const k=typeof HWWhen!=='undefined'?HWWhen.date():today(),had=!!(st.en&&st.en[k]);return E.cause(()=>o(d,t,e),()=>st.en&&st.en[k]?[['energy:rated',{value:st.en[k].v,first:!had,date:k}]]:[])});
// bulk changes: update baselines silently so old awards are not re-announced
wrapAct('impm',(o,d,t,e)=>{const n0=st.e.length,had=!!S.imp;E.hush(()=>o(d,t,e));snap();if(had&&!S.imp)E.emit('data:imported',{mode:'merge',added:st.e.length-n0,total:st.e.length})});
wrapAct('impr',(o,d,t,e)=>{const s0=st;E.hush(()=>o(d,t,e));snap();if(st!==s0)E.emit('data:imported',{mode:'replace',added:st.e.length,total:st.e.length})});
wrapAct('rst',(o,d,t,e)=>{const s0=st;E.hush(()=>o(d,t,e));snap();if(st!==s0)E.emit('data:reset',{})});

// after boot: report migration (if any) and readiness. Wait for DOMContentLoaded (every script has run, incl. boot's
// first render): a bare timer can fire between two script files, before later add-ons (insights, Medius…) subscribe.
const ready=()=>setTimeout(()=>{if(HWSchema.migratedFrom&&HWSchema.migratedFrom<HWSchema.V)E.emit('data:migrated',{from:HWSchema.migratedFrom,to:HWSchema.V});E.emit('app:ready',{view:S.v,entries:st.e.length,xp:st.xp,schema:st.sv})},0);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready()}
