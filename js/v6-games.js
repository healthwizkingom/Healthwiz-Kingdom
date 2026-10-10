/* v6: mini-game framework (master prompt §63, §68, §85–86, §96, §97 step 14). Not part of the original.
   One small set of shared pieces that every mini-game uses, instead of five copies:
     GameScene       full-screen dialog with a pixel-wipe transition; the app behind it is inert
     GameHUD         title, live status line (read by screen readers), leave button (✕ or Escape)
     GameCharacter   the hero sprite (original KN image) with idle/walk/carry/cel/calm states
     GameTimer       after/every/frame helpers that stop on leave and skip while the tab is hidden
     GameParticles   bursts through the shared HWFX canvas (scaled by quality, none when reduced)
     GameAudio       short cues through the original sfx() (so the Sound setting still applies)
     GameReward      modest XP once per game per day (replays are free and still counted), plus a
                     discovery (lore / decoration) with that first daily completion
     GameCompletion  result card: character celebration, XP, discovery, play again / done
   Games register with HWGames.register({id, name, icon, area, page, blurb, note, xp, finds, start(ctx)}).
   They never log health data and never reward eating less, drinking more or pushing harder.
   State: st.mg = {xp:{date:{game:1}}, n:{game:plays}, h:[{id,d,t,ok}], c:{game:{…}}} (schema v7).
   Events: game:started, game:completed, game:cancelled (docs/EVENTS.md). */
const HWGames=(()=>{
const G={},ORDER=[];let cur=null,ts=1;
const isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const mg=()=>{const o=isO(st.mg)?st.mg:(st.mg={});['xp','n','c'].forEach(k=>{if(!isO(o[k]))o[k]={}});if(!Array.isArray(o.h))o.h=[];return o};
const data=id=>{const c=mg().c;return isO(c[id])?c[id]:(c[id]={})};
const earned=(id,d)=>!!(mg().xp[d||today()]||{})[id];
const hm=()=>{const n=new Date();return ('0'+n.getHours()).slice(-2)+':'+('0'+n.getMinutes()).slice(-2)};
function register(def){const g=G[def.id]=Object.assign({xp:10,finds:[],before:[],note:'A game only — it does not log health data.'},def);if(ORDER.includes(def.id))return g;ORDER.push(def.id);
  // the game's region page gets a launch card (before the first marker found, else at the end)
  const p=pages[g.page];if(p)pages[g.page]=(...a)=>{const h=p(...a);try{return g.show&&!g.show()?h:place(h,launch(def.id),g.before)}catch(e){console.error('[HWGames] launch card failed:',e);return h}};return g}

HWUI.css('games',`
.v6g{position:fixed;inset:0;z-index:68;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);animation:v6gin .32s steps(6)}
.v6g.out{animation:v6gout .22s steps(4) forwards}
@keyframes v6gin{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}@keyframes v6gout{to{clip-path:inset(100% 0 0 0)}}
.v6ghud{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--pn);border-bottom:4px solid var(--ln);flex:0 0 auto}
.v6ghud .ic{font-size:22px;line-height:1}.v6ghud b{font:9px/1.5 var(--fh);flex:1 1 auto;min-width:0}
.v6ghud .v6gx{min-width:40px;min-height:40px;flex:0 0 auto} /* step 25 (§81, §94): the way out is a comfortable touch target */
.v6gst{font:7px/1.6 var(--fh);color:var(--mut);text-align:right;max-width:46%}
.v6gbody{flex:1 1 auto;overflow:auto;display:flex;flex-direction:column;align-items:center;padding:10px;gap:10px}
.v6gs{position:relative;flex:0 0 auto;width:min(720px,100%,calc((100vh - 230px) * 1.45));min-width:min(280px,100%);aspect-ratio:3/2;border:4px solid var(--ln);box-shadow:4px 4px 0 var(--ln);overflow:hidden;user-select:none;-webkit-user-select:none;touch-action:manipulation;background:#5c9e4a}
.v6gs *{box-sizing:border-box}
.v6gctl{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:min(720px,100%)}
.v6gctl button{justify-content:center}
.v6gnote{font-size:12px;text-align:center;max-width:620px;margin:0}
.v6gs button.v6gt{position:absolute;min-height:0;padding:0;background:none;border:0;box-shadow:none;cursor:pointer}
.v6gs button.v6gt:focus-visible,.v6g button:focus-visible{outline:3px dashed var(--gold);outline-offset:2px}
.v6gch{position:absolute;width:clamp(30px,8%,60px);transform:translate(-50%,-92%);transition:left .7s steps(10),top .7s steps(10);z-index:4;pointer-events:none}
.v6gch img{width:100%;height:auto;display:block;image-rendering:pixelated}
.v6gch.idle img{animation:v6gbr 1.8s steps(2) infinite}.v6gch.walk img{animation:v6gwk .32s steps(2) infinite}
.v6gch.cel img{animation:v6gjp .45s steps(3) 3}.v6gch.calm img{animation:v6gbr 4s steps(4) infinite}
.v6gch .pr{position:absolute;right:-30%;bottom:18%;width:40%;aspect-ratio:1;background:#8a5a2b;border:2px solid #2b2418;border-top-width:4px;display:none}
.v6gch.carry .pr,.v6gch.full .pr{display:block}.v6gch.full .pr{background:linear-gradient(#5fb4ec 0 40%,#8a5a2b 40%)}
@keyframes v6gbr{50%{transform:translateY(-4%)}}@keyframes v6gwk{50%{transform:translateY(-9%) rotate(-3deg)}}@keyframes v6gjp{50%{transform:translateY(-30%)}}
.v6gbub{position:absolute;z-index:6;transform:translate(-50%,-100%);background:var(--pn);color:var(--ink);border:3px solid var(--ln);padding:4px 7px;font:7px/1.6 var(--fh);white-space:nowrap;pointer-events:none;animation:v6gpop .9s steps(4) forwards}
@keyframes v6gpop{0%{opacity:0;margin-top:6px}20%{opacity:1;margin-top:0}80%{opacity:1}100%{opacity:0;margin-top:-10px}}
.v6gdone{width:min(460px,100%);text-align:center;background:var(--pn);border:4px solid var(--ln);box-shadow:4px 4px 0 var(--ln);padding:14px;position:relative}
.v6gdone .ic{font-size:40px;line-height:1.1}.v6gdone h3{font:10px/1.6 var(--fh);margin:6px 0}.v6gdone p{margin:6px 0}
.v6gdone .xp{font:9px/1.6 var(--fh);color:var(--grn)}.v6gdone .fd{border:3px dashed var(--gold);padding:8px;margin:10px 0;text-align:left}
.v6gdone .hero{width:48px;margin:0 auto;display:block;image-rendering:pixelated;animation:v6gjp .45s steps(3) 3}
.v6gdone .row{justify-content:center;margin-top:10px}
.v6glc .v6gli{font-size:30px;line-height:1}.v6glc .row{align-items:center;flex-wrap:nowrap}.v6glc button{margin-top:8px}
.v6ghub .v6ghi{display:flex;gap:10px;align-items:center;border-top:2px dashed var(--p2);padding:8px 0}.v6ghub .v6ghi:first-of-type{border-top:0}
.v6ghub .v6ghi div{flex:1 1 auto;min-width:0}.v6ghub .v6ghi>span{font-size:26px}
@media(prefers-reduced-motion:reduce){.v6g,.v6g.out,.v6gch img,.v6gdone .hero,.v6gbub{animation:none!important}.v6gch{transition:none!important}}
`);

/* ---------- GameAudio ---------- */
const CUE={tap:[[440,.04]],step:[[330,.04]],soft:[[523,.07]],good:[[659,.07],[784,.09]],splash:[[300,.06],[420,.06],[540,.07]],done:[[523,.1],[659,.1],[784,.1],[1047,.16]],low:[[262,.12]]};
function sound(k){(CUE[k]||CUE.tap).forEach((c,i)=>setTimeout(()=>{if(typeof sfx==='function')sfx(c[0],c[1])},i*110))}

/* ---------- GameScene / HUD ---------- */
function open(id){const g=G[id];if(!g)return false;if(cur)close(true);
  const el=document.createElement('div');el.className='v6g v6g-'+id;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','v6gt');
  el.innerHTML='<div class="v6ghud"><span class="ic" aria-hidden="true">'+g.icon+'</span><b id="v6gt">'+esc(g.name)+'</b><span class="v6gst" aria-live="polite"></span><button class="sm g v6gx" aria-label="Leave the game">✕</button></div>'
    +'<div class="v6gbody"><div class="v6gs" role="group" aria-label="'+esc(g.name)+' scene"></div><div class="v6gctl"></div><p class="v6gnote mut">'+esc(g.note)+'</p></div>';
  document.body.appendChild(el);
  const app=[...document.querySelectorAll('.app,#mus')];app.forEach(a=>{a.inert=true;a.setAttribute('aria-hidden','true')});
  cur={id,g,el,app,timers:new Set(),ints:new Set(),rafs:new Set(),keys:null,ret:document.activeElement,done:false,gen:0,t0:Date.now()};
  el.querySelector('.v6gx').onclick=()=>close();
  HWEvents.emit('game:started',{id,name:g.name});begin();return true}
function stopAll(c){c.timers.forEach(clearTimeout);c.ints.forEach(clearInterval);c.rafs.forEach(cancelAnimationFrame);c.timers.clear();c.ints.clear();c.rafs.clear();c.keys=null}
function begin(){const c=cur;stopAll(c);c.gen++;c.done=false;c.t0=Date.now();
  const body=c.el.querySelector('.v6gbody');body.innerHTML='<div class="v6gs" role="group" aria-label="'+esc(c.g.name)+' scene"></div><div class="v6gctl"></div><p class="v6gnote mut">'+esc(c.g.note)+'</p>';
  status('');const x=ctx(c);try{c.g.start(x)}catch(e){console.error('[HWGames] '+c.id+' failed to start:',e);body.innerHTML='<div class="v6gdone"><div class="ic">⚠️</div><h3>THIS GAME HIT A SNAG</h3><p>It could not start ('+esc(e&&e.message)+'). Your saved data is untouched.</p><div class="row"><button class="g" data-gx>◀ BACK</button></div></div>';body.querySelector('[data-gx]').onclick=()=>close()}
  focusIn(c)}
function focusIn(c){const f=c.el.querySelector('.v6gbody button:not([disabled]),.v6gbody [tabindex="0"]')||c.el.querySelector('.v6gx');try{f.focus({preventScroll:true})}catch(e){}}
function status(t){if(!cur)return;const s=cur.el.querySelector('.v6gst');if(s&&s.textContent!==t)s.textContent=t}
function close(silent){const c=cur;if(!c)return;cur=null;stopAll(c);
  if(!c.done)HWEvents.emit('game:cancelled',{id:c.id,name:c.g.name,seconds:Math.round((Date.now()-c.t0)/1000)});
  c.app.forEach(a=>{a.inert=false;a.removeAttribute('aria-hidden')});
  const gone=()=>c.el.remove();if(silent||HWMotion.reduced())gone();else{c.el.classList.add('out');setTimeout(gone,230)}
  if(c.ret&&c.ret.isConnected)try{c.ret.focus({preventScroll:true})}catch(e){}
  if(c.done&&!silent&&document.getElementById('main')&&c.g.page===S.v)render()}
document.addEventListener('keydown',e=>{const c=cur;if(!c)return;
  if(e.key==='Escape'){e.preventDefault();close();return}
  if(e.key==='Tab'){const f=[...c.el.querySelectorAll('button:not([disabled]),[tabindex="0"],input,select')].filter(x=>x.offsetParent!==null);if(!f.length)return;const a=f[0],z=f[f.length-1];
    if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}else if(!c.el.contains(document.activeElement)){e.preventDefault();a.focus()}return}
  if(c.keys&&!c.done&&!(e.target&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))){try{if(c.keys(e)===true)e.preventDefault()}catch(err){console.error(err)}}},true);
// leaving the page (nav, links) closes the game first; the original go() also stops page timers
{const _go=go;go=function(){if(cur)close(true);return _go.apply(this,arguments)}}
HWEvents.on('data:reset',()=>{if(cur)close(true)});HWEvents.on('data:imported',()=>{if(cur)close(true)});

/* ---------- per-run context: timers, character, particles, reward ---------- */
function ctx(c){const gen=c.gen,alive=()=>cur===c&&c.gen===gen&&!c.done;
  const stage=c.el.querySelector('.v6gs'),controls=c.el.querySelector('.v6gctl'),reduced=HWMotion.reduced();
  const X={stage,controls,reduced,alive,status,sound,data:()=>data(c.id),
    level:HWMotion.level(),
    /** decorative element count for the current quality (static scenery keeps at least half) */
    deco:n=>Math.max(Math.ceil(n/2),HWMotion.count(n)||0),
    /** pacing time (real seconds, e.g. a breath) */
    T:ms=>ms*ts,
    /** animation wait: 0 under reduced motion, so the game never waits on movement nobody sees */
    A:ms=>reduced?0:ms*ts,
    after(ms,fn){const t=setTimeout(()=>{c.timers.delete(t);if(alive())fn()},ms);c.timers.add(t);return t},
    /** interval that pauses while the tab is hidden; fn gets the elapsed visible ms */
    every(ms,fn){let last=performance.now();const i=setInterval(()=>{const n=performance.now(),d=n-last;last=n;if(document.hidden||!alive())return;fn(Math.min(d,ms*3))},ms);c.ints.add(i);return()=>{clearInterval(i);c.ints.delete(i)}},
    frame(fn){let id=0;const f=t=>{c.rafs.delete(id);if(!alive())return;if(fn(t)===false)return;id=requestAnimationFrame(f);c.rafs.add(id)};id=requestAnimationFrame(f);c.rafs.add(id);return()=>{cancelAnimationFrame(id);c.rafs.delete(id)}},
    key(fn){c.keys=fn},
    /** GameCharacter: returns the element (placed at x%,y% of the stage) */
    hero(x,y,state){const h=document.createElement('div');h.className='v6gch '+(state||'idle');h.innerHTML=HERO(3)+'<i class="pr"></i>';h.style.left=x+'%';h.style.top=y+'%';stage.appendChild(h);return h},
    pose(h,state){h.className='v6gch '+state},
    move(h,x,y,ms){h.style.transitionDuration=reduced?'0s':(ms||700)*ts/1000+'s';h.style.left=x+'%';h.style.top=y+'%'},
    /** floating word at x%,y% (e.g. "+1 step") */
    pop(x,y,text){const b=document.createElement('div');b.className='v6gbub';b.textContent=text;b.style.left=x+'%';b.style.top=y+'%';b.setAttribute('aria-hidden','true');stage.appendChild(b);setTimeout(()=>b.remove(),reduced?1200:950)},
    /** GameParticles: burst at an element's centre or at stage x%,y% */
    burst(at,o){try{let x,y;if(at&&at.getBoundingClientRect){const r=at.getBoundingClientRect();x=r.left+r.width/2;y=r.top+r.height/2}else{const r=stage.getBoundingClientRect();x=r.left+r.width*at[0]/100;y=r.top+r.height*at[1]/100}return HWFX.burst(x,y,o||{})}catch(e){return 0}},
    button(label,fn,cls){const b=document.createElement('button');b.type='button';if(cls)b.className=cls;b.innerHTML=label;b.onclick=e=>{if(alive())fn(e)};controls.appendChild(b);return b},
    finish:r=>finish(c,gen,r||{})};
  return X}

/* ---------- GameReward + GameCompletion ---------- */
function finish(c,gen,r){if(cur!==c||c.gen!==gen||c.done)return null;c.done=true;stopAll(c);
  const M=mg(),d=today(),g=c.g,ok=r.ok!==false;M.n[c.id]=(M.n[c.id]||0)+1;M.h.push({id:c.id,d,t:hm(),ok:ok?1:0});if(M.h.length>60)M.h.splice(0,M.h.length-60);
  let xp=0,found=r.found||null;
  if(ok&&!earned(c.id,d)){(M.xp[d]=M.xp[d]||{})[c.id]=1;const keep=new Set(rng(14));Object.keys(M.xp).forEach(k=>{if(!keep.has(k))delete M.xp[k]});xp=g.xp;
    if(!found&&g.finds.length){const D=data(c.id),n=+D.f||0;if(n<g.finds.length){found=g.finds[n];D.f=n+1}}}
  save();if(xp)gain(xp,'· '+g.name);
  const res={id:c.id,name:g.name,xp,ok,result:r.result||'',found:found?found[1]:''};
  const body=c.el.querySelector('.v6gbody');
  body.innerHTML='<div class="v6gdone" role="status"><div class="ic" aria-hidden="true">'+(r.icon||g.icon)+'</div>'+HERO(3)+'<h3>'+esc(r.title||'WELL PLAYED!')+'</h3>'
    +(r.lines||[]).map(l=>'<p>'+esc(l)+'</p>').join('')
    +(found?'<div class="fd"><b>'+esc(found[0]+' '+found[1])+'</b><br><small>'+esc(found[2]||'')+'</small></div>':'')
    +'<p class="xp">'+(xp?'+'+xp+' XP':ok?'<span class="mut">Today\'s XP for this game is already earned. Play as often as you like.</span>':'')+'</p>'
    +'<div class="row"><button data-g-again>↻ PLAY AGAIN</button><button class="g" data-gx>✓ DONE</button></div></div>';
  body.querySelector('[data-g-again]').onclick=()=>{if(cur===c)begin()};body.querySelector('[data-gx]').onclick=()=>close();
  status(ok?'COMPLETE':'');sound('done');const ic=body.querySelector('.v6gdone .ic');setTimeout(()=>{if(!ic.isConnected)return;const b=ic.getBoundingClientRect();HWFX.burst(b.left+b.width/2,b.top+b.height/2,{n:30,palette:r.palette||'gold',speed:3,up:1})},60);
  focusIn(c);HWEvents.emit('game:completed',res);return res}

/* ---------- entry points: launch cards on region pages, hub on the Kingdom page, stats ---------- */
acts.game=d=>open(d.g);
const today7=()=>{const R=new Set(rng(7));return mg().h.filter(h=>R.has(h.d))};
function launch(id){const g=G[id];if(!g)return '';const n=mg().n[id]||0,e=earned(id);
  return '<div class="card v6glc" id="v6gl-'+id+'"><h3>🎮 MINI-GAME</h3><div class="row"><span class="v6gli" aria-hidden="true">'+g.icon+'</span><div><b>'+esc(g.name)+'</b><br><small>'+esc(g.blurb)+'</small><br><small class="mut">'+(e?'✓ Today\'s +'+g.xp+' XP earned':'+'+g.xp+' XP once a day')+(n?' · played '+n+'×':'')+(g.progress?' · '+esc(g.progress()):'')+'</small></div></div>'
    +'<button data-a="game" data-g="'+id+'">▶ PLAY '+esc(g.name.toUpperCase())+'</button></div>'}
function hub(){if(!ORDER.length)return '';return '<div class="card v6ghub" id="v6ghub"><h3>🎮 KINGDOM GAMES</h3><p class="mut">Short, gentle games for each region. Modest XP once a day each; replays are free.</p>'
  +ORDER.map(id=>{const g=G[id];return '<div class="v6ghi"><span aria-hidden="true">'+g.icon+'</span><div><b>'+esc(g.name)+'</b><br><small class="mut">'+(earned(id)?'✓ played today':esc(g.blurb))+'</small></div><button class="sm" data-a="game" data-g="'+id+'" aria-label="Play '+esc(g.name)+'">▶</button></div>'}).join('')+'</div>'}
function statsCard(){if(!ORDER.length)return '';const L=today7(),M=mg(),tot=ORDER.reduce((a,id)=>a+(M.n[id]||0),0);
  if(!tot)return '<div class="card" id="v6gstat"><h3>🎮 MINI-GAMES</h3><p class="mut">No games played yet. Each game lives in its region, for example the Calming Grove in the Mind Forest.</p><button class="sm" data-a="game" data-g="'+(ORDER[0]||'')+'">▶ TRY ONE</button></div>';
  const days=new Set(L.map(h=>h.d)).size;
  return '<div class="card" id="v6gstat"><h3>🎮 MINI-GAMES</h3><div class="grid"><div class="t">🎮 Plays this week<b>'+L.length+'</b></div><div class="t">📅 Days played<b>'+days+' / 7</b></div><div class="t">⭐ All-time plays<b>'+tot+'</b></div></div>'
    +ORDER.map(id=>{const g=G[id],n=L.filter(h=>h.id===id).length;return '<div class="er"><span>'+g.icon+' '+esc(g.name)+'</span><span class="mut">'+(g.progress?esc(g.progress()):'')+'</span><b>'+n+'× this week</b></div>'}).join('')
    +'<small class="mut">Game results are not health measurements.</small></div>'}
function place(h,html,marks){for(const k of marks){const i=h.indexOf(k);if(i>=0)return h.slice(0,i)+html+h.slice(i)}return h+html}
// hub and stats cards appear once at least one game is registered
{const p=pages.kingdom;pages.kingdom=(...a)=>{const h=p(...a);return place(h,hub(),['<div class="card"><h3>REGIONS</h3>'])}}
{const p=pages.stats;pages.stats=(...a)=>p(...a)+statsCard()}

/* Medius reacts once the player is back in the kingdom (bubbles stay quiet while a game is open) */
HWMedius.rules.game={p:52,cd:1800e3,line:e=>{const L={water:['The gardens drink deep. Thank thee for carrying the bucket!','Every patch watered — the bees approve.'],food:['A colourful plate! Variety is a fine spell.','The market cooks still talk of thy plate.'],trail:['Checkpoint to checkpoint — a fine little journey.','The trail remembers thy footsteps.'],grove:['The grove is calmer for thy visit. So am I.','Slow breaths, quiet pond. Well done.'],night:['The night sky smiles back at thee.','Stars counted, lanterns lit. Rest well when it is time.']}[e.id];return L?pick(L):null}};
const pick=a=>a[Math.floor(Math.random()*a.length)];
HWEvents.on('game:completed',e=>{if(e.ok)setTimeout(()=>HWMedius.say('game',e),0)});

return{register,open,close,launch,hub,statsCard,earned,data,
  get current(){return cur&&cur.id},get games(){return ORDER.map(id=>G[id])},
  /* test/accessibility hook: scales game pacing (1 = real time) */ set timeScale(v){ts=+v>0?+v:1},get timeScale(){return ts}}})();
