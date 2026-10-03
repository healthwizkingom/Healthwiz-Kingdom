/* =====================================================================
   RECONSTRUCTED (v6) — symbols the original app referenced but whose
   source was never committed. Each is written to the contract implied by
   the surviving code and CSS (names, signatures, class names, st fields).
   See docs/ARCHITECTURE_AUDIT.md §3b. Load order:
   menu-data.js → legacy-core.js → reconstructed.js → legacy-tail.js
   ===================================================================== */

/* ---------- small shared helpers ---------- */
const DOW=['SUN','MON','TUE','WED','THU','FRI','SAT'];
const RGN={water:'Water Valley',food:'Nutrition Village',pulse:'Heart Temple',stair:'Stair Mountain',stress:'Mind Forest',bmi:'Balance Shrine'};
// AASM / CDC recommended sleep hours by age: [min, max]
const SR=a=>a<6?[10,13]:a<13?[9,12]:a<19?[8,10]:a<65?[7,9]:[7,8];
const sLo=()=>SR(+st.p.age||16)[0];
const slH=d=>{const a=A('sleep',d);return a.length?Math.round(a.reduce((s,x)=>s+(+x.v||0),0)*10)/10:null};
const xdy=d=>(st.xd||{})[d]||0;
const cnt=c=>st.e.filter(x=>x.c===c).length;
const emp=(t,s)=>'<div class="empty"><b>'+t+'</b><small>'+s+'</small></div>';
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));

/* ---------- pixel sprites (the original knight image was embedded data and is lost) ---------- */
function sprURL(map,pal){const w=Math.max(...map.map(r=>r.length)),c=document.createElement('canvas');c.width=w;c.height=map.length;const x=c.getContext('2d');map.forEach((r,y)=>[...r].forEach((ch,i)=>{if(pal[ch]){x.fillStyle=pal[ch];x.fillRect(i,y,1,1)}}));return c.toDataURL()}
const KN=sprURL([
'.......rr.......','......rrr.......','.....kkkkkk.....','....kssssssk....','....ksvvvvsk....','....ksvwvvsk...x',
'....kssssssk...x','.....kddddk....x','..kkkbbggbbkk..x','.kggkbbggbbbbk.x','.kgBgkbggbbbbkgg','.kgBgkbggbbbsk.k',
'.kggkbbggbbbsk..','..kkkkkkkkkkk...','....kBBkkBBk....','....kssk.ssk....','....kssk.ssk....','....kwwk.kwwk...',
'...kwwwk.kwwwk..','...kkkkk.kkkkk..'],
{k:'#2b2418',s:'#cfd6e4',d:'#8a94a8',v:'#1c1228',w:'#7a4c22',r:'#d9453d',g:'#f2c14e',b:'#2f8fd0',B:'#1f6ba3',x:'#eef3ff'});
const NIGHTMARE=sprURL([
'.....pppp.....pppp.....','....pPPPPp...pPPPPp....','...pPPPPPPpppPPPPPPp...','..pPPPPPPPPPPPPPPPPPPp..','..pPPrrPPPPPPPPPPrrPPp..',
'.pPPPrrPPPPPPPPPPrrPPPp.','.pPPPPPPPPPPPPPPPPPPPPp.','.pPPPPwPwPwPwPwPwPPPPPp.','pPPPPPPPPPPPPPPPPPPPPPPp','pPPPPPPPPPPPPPPPPPPPPPPp',
'pPPpPPPPPPPPPPPPPPPpPPPp','pPp.pPPPPPPPPPPPPPp.pPPp','pp..pPPPPPPPPPPPPPp..pPp','p...pPPPPpPPPPpPPPPp..pp','....pPPPp.pPPp.pPPPp...p',
'....pPPp...pp...pPPp....','.....pp...........pp....'],
{p:'#1c1228',P:'#4a3a7e',r:'#ff3b2f',w:'#eef3ff'});
const SHEEP=sprURL(['..wwwwww....','.wwwwwwwwkk.','wwwwwwwwwkek','wwwwwwwwwkkk','.wwwwwwwww..','..k.k..k.k..','..k.k..k.k..'],{w:'#f6f3ea',k:'#2b2418',e:'#fbf3d6'});
const avatar=sc=>'<img class="hero av" alt="Your knight" src="'+KN+'" width="'+16*sc+'" style="height:auto">';

/* ---------- nutrition: portions, macro estimates ---------- */
const PMS=[0.25,0.5,0.75,1,1.25,1.5,2];
// Energy split [protein %, carb %, fat %] and fiber g per 100 kcal, by dish type (keyword match on the Malay name).
const MTY=[
[/susu|milo|yogurt|dadih/i,[20,45,35],0],
[/\b(teh|kopi|air|sirap|jus|bandung|laici|soya|minuman|cendol|sky juice)\b/i,[3,92,5],0],
[/pisang|tembikai|betik|epal|oren|nenas|kismis|kurma|buah|anggur|jambu|mangga|limau/i,[4,93,3],3],
[/sayur|kangkung|kobis|taugeh|bayam|sawi|kacang panjang|bendi|terung|pucuk|labu|brokoli|kailan|lobak|timun|ulam|jagung|cendawan/i,[15,50,35],3],
[/\bdal\b|kacang|tempe|tauhu|kekacang/i,[25,40,35],2.5],
[/ayam|ikan|daging|telur|udang|sotong|kambing|sardin|siakap|kerang|ketam|tuna|lembu|itik|keli|kembung/i,[34,10,56],0.3],
[/kuih|kek|cucur|karipap|donut|puding|apam|seri muka|biskut|kuey|bingka|lepat|onde|wajik|dodol|pau|roti jala|popia|cekodok|keropok/i,[7,58,35],1],
[/nasi|mee|mi |bihun|kuetiau|kuey teow|roti|capati|chapati|bubur|lontong|ketupat|pasta|spageti|bijirin|oat|sandwic|burger|pizza/i,[12,63,25],0.8],
[/sup|kuah|gulai|kari|sambal|masak lemak|asam|tomyam|tom yam/i,[20,25,55],1.2]];
const MDEF=[15,55,30],MFDEF=1;
function mtype(name){for(const t of MTY)if(t[0].test(name))return t;return [null,MDEF,MFDEF]}
function estMac(name,kcal){const t=mtype(name||''),p=t[1],k=+kcal||0,r=x=>Math.round(x*10)/10;return{pr:r(k*p[0]/100/4),cb:r(k*p[1]/100/4),fa:r(k*p[2]/100/9),fb:r(k/100*t[2])}}
// Macros of one food entry: stored values if present, otherwise estimated (older entries had none).
function emac(e){const m=e.m||{};if(m.mac)return{...m.mac,est:!!m.est};if(m.nomac)return null;return{...estMac(m.name,e.v),est:true}}
function macLine(e){const x=emac(e);if(!x)return '<span class="mac">macros not entered</span>';return '<span class="mac">P '+x.pr+'g · C '+x.cb+'g · F '+x.fa+'g · Fb '+x.fb+'g '+(x.est?'<span class="tag e">EST</span>':'<span class="tag m">LABEL</span>')+'</span>'}
function dmac(d){const o={pr:0,cb:0,fa:0,fb:0,kc:0,est:false,n:0};A('food',d).forEach(e=>{o.kc+=+e.v||0;o.n++;const x=emac(e);if(!x)return;o.pr+=x.pr;o.cb+=x.cb;o.fa+=x.fa;o.fb+=x.fb;if(x.est)o.est=true});['pr','cb','fa','fb'].forEach(k=>o[k]=Math.round(o[k]*10)/10);return o}
// Reference amounts from the calorie target: AMDR midpoints (protein 15% but at least 0.8 g/kg, carbs 50%, fat 30%), fiber 14 g / 1000 kcal.
function mref(){const k=st.s.kcal;return{pr:Math.round(Math.max(k*.15/4,(+st.p.w||60)*.8)),cb:Math.round(k*.5/4),fa:Math.round(k*.3/9),fb:Math.round(k/1000*14)}}
const dys=()=>[...new Set(st.e.filter(x=>x.c==='food').map(x=>x.d))].sort();
const MXN=[['pr','PROTEIN','var(--pro)'],['cb','CARBS','var(--carb)'],['fa','FAT','var(--fat)'],['fb','FIBER','var(--fib)']];
function macPanel(d,full){const m=dmac(d),R=mref();if(!m.n)return emp('🥣 NO MEALS LOGGED YET','Pick a food below to see protein, carbs, fat and fiber.');
const kp=m.pr*4,kb=m.cb*4,kf=m.fa*9,tot=kp+kb+kf||1;
return '<div class="mac4">'+MXN.map(([k,n,c])=>'<div class="mx"><span>'+n+'</span><b>'+m[k]+'<small> g</small></b>'+bar(m[k]/R[k]*100,c)+'<em>of ~'+R[k]+' g reference</em></div>').join('')+'</div>'
+(full?'<div class="esplit" role="img" aria-label="Energy split">'+[[kp,'var(--pro)'],[kb,'var(--carb)'],[kf,'var(--fat)']].map(([v,c])=>'<i style="width:'+(v/tot*100).toFixed(1)+'%;background:'+c+'"></i>').join('')+'</div><div class="leg"><span style="--c:var(--pro)">Protein '+Math.round(kp/tot*100)+'%</span><span style="--c:var(--carb)">Carbs '+Math.round(kb/tot*100)+'%</span><span style="--c:var(--fat)">Fat '+Math.round(kf/tot*100)+'%</span></div><small class="mut">Typical ranges for adults: protein 10–35%, carbs 45–65%, fat 20–35% of energy (AMDR). '+(m.est?'Includes estimated values.':'')+'</small>':'')}
function macTable(){const R=rng(7).reverse(),t=today();return '<div class="tscroll"><table class="tbl"><thead><tr><th>DAY</th><th>KCAL</th><th>PROT</th><th>CARB</th><th>FAT</th><th>FIBER</th></tr></thead><tbody>'+R.map(d=>{const m=dmac(d),lb=(d===t?'Today':DOW[new Date(d+'T12:00:00').getDay()])+' '+d.slice(5);return '<tr'+(d===t?' class="today"':'')+'><td>'+lb+'</td>'+(m.n?'<td>'+m.kc+'</td><td>'+m.pr+'</td><td>'+m.cb+'</td><td>'+m.fa+'</td><td>'+m.fb+'</td>':'<td class="mut" colspan="5">–</td>')+'</tr>'}).join('')+'</tbody></table></div>'}
function fbase(){const f=S.sel!=null?F[S.sel]:null;if(!f)return null;return f[2]!=null?f[2]:(S.ck!==''&&+S.ck>0?+S.ck:null)}
function fprev(){const f=S.sel!=null?F[S.sel]:null;if(!f)return '';const b=fbase();if(b==null)return '<div class="fpv"><small>Enter the kcal for one standard serving to see the total.</small></div>';
const k=Math.round(b*S.qty*S.pm),x=estMac(f[0],k);return '<div class="fpv"><div><small>Total</small><b class="num">'+k+' kcal</b></div><div><small>Protein</small><b class="num">'+x.pr+' g</b></div><div><small>Carbs</small><b class="num">'+x.cb+' g</b></div><div><small>Fat</small><b class="num">'+x.fa+' g</b></div><div><small>Fiber</small><b class="num">'+x.fb+' g</b></div><span class="tag e">EST</span></div>'}

/* ---------- food actions ---------- */
acts.pick=d=>{S.sel=+d.i;S.qty=1;S.pm=1;S.ck='';render();const el=$('#det');if(el&&el.scrollIntoView)el.scrollIntoView({block:'center'})};
acts.meal=d=>{S.meal=d.m;render()};
acts.cf=()=>{S.cf=S.cf?0:1;render()};
acts.qm=()=>{S.qty=Math.max(1,S.qty-1);render()};
acts.qp=()=>{S.qty=Math.min(10,S.qty+1);render()};
acts.pm=d=>{S.pm=+d.m;render()};
acts.addfood=()=>{const f=F[S.sel];if(!f)return;const b=fbase();if(!(b>0&&b<=3000)){toast('Enter kcal per serving (1–3000)');return}const v=Math.round(b*S.qty*S.pm);
add('food',v,{name:f[0],serv:f[1],qty:S.qty,pm:S.pm,meal:S.meal,fi:S.sel,u:f[2]==null?1:0,mac:estMac(f[0],v),est:1},'',0,0,10,'Meal logged');S.sel=null;S.ck='';render()};
acts.savecf=()=>{const n=($('#cn').value||'').trim(),k=+$('#cc').value,num=id=>{const s=$(id).value;return s===''?null:+s};
if(!n){toast('Give the food a name');return}if(!(k>=0&&k<=5000)||$('#cc').value===''){toast('Calories must be 0–5000');return}
const mc={pr:num('#cp'),cb:num('#cb'),fa:num('#cfa'),fb:num('#cfb')},any=Object.values(mc).some(x=>x!=null);
if(Object.values(mc).some(x=>x!=null&&!(x>=0&&x<=1000))){toast('Check the macro values');return}
const m={name:n.slice(0,80),serv:($('#cs').value||'').trim().slice(0,40),qty:1,pm:1,meal:$('#cm').value,custom:1};
if(any)m.mac={pr:mc.pr||0,cb:mc.cb||0,fa:mc.fa||0,fb:mc.fb||0};else m.nomac=1;
add('food',Math.round(k),m,'',0,0,10,'Custom food');S.cf=0;render()};
INP.q=v=>{S.q=v;const l=$('#fl');if(l)l.innerHTML=foodItems()};
INP.ck=v=>{S.ck=v;const p=$('#fprev');if(p)p.innerHTML=fprev()};
CH.src=v=>{S.src=v;render()};

/* ---------- water actions ---------- */
acts.wa=d=>drink(+d.v);
acts.wcu=()=>drink(+($('#wc')||{}).value);
acts.dclose=(d,t)=>{const o=t.closest('.done');if(o)o.remove()};

/* ---------- sleep: dream battle + counting sheep ---------- */
function dbat(){const L=LC('sleep'),last=L.slice(-1)[0],sc=last?last.m.score||0:0,s=!last?0:sc<40?1:sc<60?2:sc<80?3:4;
const lb=['NO BATTLE YET','THE NIGHTMARE PRESSES','A HARD-FOUGHT NIGHT','THE KNIGHT STRIKES BACK','DAWN VICTORY'][s],
tx=['Log a night of sleep and your knight will face the Nightmare.','A short or restless night — the Nightmare has the upper hand. Tonight is a new battle.','Your knight held the line. A little more rest tips the balance.','Good rest powers your knight\'s attacks.','A well-rested knight drives the Nightmare away as the sun rises.'][s];
return '<div class="db s'+s+'" aria-label="'+lb+'"><div class="dbmoon"></div><div class="dbgr"></div><span class="dbl">'+lb+'</span>'+(s===0?[0,1,2].map(i=>'<span class="dbz" style="--l:'+i+'s;left:'+(14+i*5)+'%">Z</span>').join(''):'')+'<div class="dbh"><img src="'+KN+'" alt="" style="image-rendering:pixelated"></div><div class="dbo"'+(s===0?' style="opacity:.35"':'')+'><img src="'+NIGHTMARE+'" alt="" style="image-rendering:pixelated"></div>'+(s>=3?'<div class="dbfx">'+[0,1,2,3,4].map(i=>'<u style="left:'+(40+i*9)+'%;bottom:'+(25+i*7%30)+'%;animation-delay:'+(i*.2)+'s"></u>').join('')+'</div>':'')+'</div><small>'+tx+(last?' (last Sleep Score '+sc+')':'')+'</small>'}
function sheepCard(){const q=S.dq,stars=q&&!q.done?[[12,18],[30,10],[52,22],[70,12],[86,26]].map((p,i)=>'<button class="dstar" data-a="slstar" aria-label="Dream star '+(i+1)+'" style="left:'+p[0]+'%;top:'+p[1]+'%;animation-delay:'+(i*.3)+'s"></button>').join(''):'';
return '<div class="card" id="dqc"><h3>🐑 COUNTING SHEEP · DREAM QUEST</h3><div class="shs"><div class="shbg"></div><div class="shcl"><div class="shbub"></div></div><span class="shd1"></span><span class="shd2"></span>'
+[0,1,2].map(i=>'<div class="shjp" style="animation-delay:'+(i*2.4)+'s;animation-iteration-count:infinite;animation-duration:7.2s"><img src="'+SHEEP+'" alt=""></div>').join('')
+'<div class="shfn"><i></i><i></i><i></i><b></b><b></b></div>'+[0,1,2].map(i=>'<span class="zzz" style="left:'+(20+i*5)+'%;bottom:'+(18+i*7)+'%;--l:'+i+'s">Z</span>').join('')+stars+'</div>'
+(q&&!q.done?'<p>Tap the 5 dream stars: <b id="dqn">'+q.n+'/5</b></p>':q&&q.done?'<p>✨ Dream Quest complete. Sweet dreams, brave knight.</p>':'<p class="mut">A calm wind-down mini-game: count sheep, then catch five dream stars.</p><button data-a="sldq" style="width:100%">START DREAM QUEST</button>')
+'<small class="mut">Dream Quests completed: '+(st.dqn||0)+'</small></div>'}

/* ---------- badges (base list; legacy-tail.js pushes three more) ---------- */
const BG=[
['🌱','First Steps','Log your first entry',()=>[st.e.length,1]],
['💧','Hydration Hero','Reach your water target on 3 days',()=>[[...new Set(st.e.filter(x=>x.c==='water').map(x=>x.d))].filter(d=>wt(d)>=st.s.water).length,3]],
['🍽️','Balanced Plate','Log 3 different meals in one day',()=>[dys().some(d=>new Set(A('food',d).map(x=>x.m.meal)).size>=3)?1:0,1]],
['🌙','Dream Keeper','Log sleep on 7 days',()=>[sdays(),7]],
['🧗','Mountain Climber','Climb 500 stair steps in total',()=>[st.e.filter(x=>x.c==='stair').reduce((a,x)=>a+(+x.v||0),0),500]],
['❤️','Heart Listener','Save 5 pulse readings',()=>[cnt('pulse'),5]],
['🧠','Calm Mind','Finish 3 stress check-ins',()=>[cnt('stress'),3]],
['🗺️','Kingdom Explorer','Unlock all 6 regions',()=>[REG.filter(r=>r[2]()).length,6]],
['⭐','Rising Star','Reach level 3',()=>[lvl().i+1,3]]];

/* ---------- entry edit / delete / undo ---------- */
function modal(h){const m=$('#mo');m.innerHTML='<div class="card" role="dialog" aria-modal="true">'+h+'</div>';m.hidden=false;const f=m.querySelector('input,button');if(f)f.focus()}
function mclose(){const m=$('#mo');m.hidden=true;m.innerHTML=''}
acts.mclose=mclose;
acts.edit=d=>{const e=st.e.find(x=>x.id===d.id);if(!e)return;S.ed=e.id;modal('<h3>✏️ EDIT ENTRY</h3><p class="mut">'+desc(e)+'</p><label>Value ('+UNIT[e.c]+')<input id="ev" type="number" step="any" value="'+esc(e.v)+'"></label><div class="row"><label>Date<input id="ed" type="date" value="'+esc(e.d)+'" max="'+today()+'"></label><label>Time<input id="et" type="time" value="'+esc(e.t)+'"></label></div><label>Note<input id="en" maxlength="140" value="'+esc(e.n)+'"></label><div class="row" style="margin-top:10px"><button data-a="esave">SAVE</button><button class="g" data-a="mclose">CANCEL</button></div>')};
acts.esave=()=>{const e=st.e.find(x=>x.id===S.ed);if(!e)return mclose();const v=+$('#ev').value,d=$('#ed').value,t=$('#et').value;
if(!(isFinite(v)&&v>0&&v<=100000)){toast('Enter a positive number');return}if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){toast('Pick a valid date');return}
e.v=v;e.d=d;e.t=/^\d{2}:\d{2}$/.test(t)?t:e.t;e.n=($('#en').value||'').slice(0,140);if(e.c==='food'&&e.m.mac&&e.m.est)e.m.mac=estMac(e.m.name,v);save();mclose();render();toast('Entry updated')};
acts.del=d=>{const i=st.e.findIndex(x=>x.id===d.id);if(i<0)return;UD=st.e[i];st.e.splice(i,1);save();render();toast('Entry deleted <button class="sm" data-a="undo">UNDO</button>')};
acts.undo=()=>{if(!UD)return;st.e.push(UD);UD=null;save();render();toast('Entry restored')};
// Fallback export when Blob downloads are unavailable (called by legacy acts.expj).
acts.exp=()=>modal('<h3>💾 COPY YOUR BACKUP</h3><p class="mut">Downloads are blocked here. Copy this text and keep it somewhere safe.</p><textarea rows="8" readonly onfocus="this.select()">'+esc(bkJSON())+'</textarea><button class="g" data-a="mclose" style="width:100%">CLOSE</button>');

/* ---------- music (gentle chiptune loop, off by default) ---------- */
let MUS=null;const MEL=[523,0,659,0,784,659,523,0,587,0,698,0,880,698,587,0,523,659,784,1047,784,659,523,0,392,0,494,0,587,494,392,0];
function musStart(){if(MUS)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch(e){return}let i=0;MUS=setInterval(()=>{const f=MEL[i++%MEL.length];if(!f)return;try{const o=ac.createOscillator(),g=ac.createGain();o.type='triangle';o.frequency.value=f/2;g.gain.setValueAtTime(.025,ac.currentTime);g.gain.exponentialRampToValueAtTime(.0005,ac.currentTime+.22);o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+.24)}catch(e){}},230)}
function musStop(){clearInterval(MUS);MUS=null}
function musBtn(){const b=$('#mus');if(b){b.textContent=st.s.mus?'🎵':'🔇';b.setAttribute('aria-pressed',!!st.s.mus)}}
acts.mus=()=>{st.s.mus=st.s.mus?0:1;save();st.s.mus?musStart():musStop();musBtn()};

/* ---------- router, layout, render ---------- */
const NAV=[['home','🏰','Kingdom'],['food','🍗','Food'],['water','💧','Water'],['sleep','🌙','Sleep'],['stats','📊','Stats'],['set','⚙️','Settings']];
// Page banner: [icon, place name, category that unlocks it (null = always open)]
const PG={food:['🍗','Nutrition Village','food'],water:['💧','Water Valley','water'],sleep:['🌙','Dream Camp','sleep'],pulse:['❤️','Heart Temple','pulse'],stair:['🧗','Stair Mountain','stair'],stress:['🧠','Mind Forest','stress'],bmi:['⚖️','Balance Shrine','bmi'],calc:['🧮','Goal Forge',null],stats:['📊','Royal Archives',null],guide:['🧙','Wizard Tower',null],set:['⚙️','Castle Keep',null]};
const TINT={food:'#f0c07055',water:'#7cc6f055',sleep:'#8767c855',pulse:'#f0909055',stair:'#c8b8a055',stress:'#90d89055',bmi:'#c0a8f055',calc:'#f2c14e44'};
function banner(v){const p=PG[v];if(!p)return '';const on=p[2]?cnt(p[2])>0:true;return '<div class="bn"><span>'+p[0]+'</span><div><b>'+p[1].toUpperCase()+'</b><small>'+(p[2]?(on?'Region restored ✓':'Still asleep — log here to restore it'):'Castle grounds')+'</small></div><div class="hs">'+HEART(2).repeat(3)+'</div></div>'}
function hbar(){const L=lvl();return '<div class="hbar"><button class="g back" data-a="go" data-v="home">◀ KINGDOM</button><div style="text-align:right"><b class="pcl">Lv '+(L.i+1)+' · '+L.n+'</b><small>'+st.xp+' XP</small></div></div>'}
function missing(v){return '<h2>🚧 UNDER RECONSTRUCTION</h2><div class="card">'+emp('THIS AREA IS BEING REBUILT','The "'+esc(v)+'" page was lost from the original source and has not been restored yet.')+'</div>'}
function errCard(v,e){return '<h2>⚠️ SOMETHING WENT WRONG</h2><div class="card warn">The '+esc(v)+' page hit an error and could not be drawn: <code>'+esc(e&&e.message)+'</code><br>Your saved data is untouched. <button class="sm" data-a="go" data-v="home">BACK TO KINGDOM</button></div>'}
const after_={};after_.sleep=slInit;
function render(){const v=S.v==='welcome'||pages[S.v]||PG[S.v]||S.v==='home'?S.v:'home',wel=v==='welcome';S.v=v;
document.body.classList.toggle('wel',wel);document.documentElement.style.setProperty('--tint',TINT[v]||'transparent');
let h;try{h=pages[v]?pages[v]():missing(v)}catch(e){console.error('[render '+v+']',e);h=errCard(v,e)}
$('#main').innerHTML=wel?h:'<div class="pg tr-'+v+'">'+(v==='home'?'':hbar()+banner(v))+h+(DIS[v]?'<p class="dis">'+DIS[v]+'</p>':'')+'</div>';
$('#nav').innerHTML=wel?'':NAV.map(n=>'<button class="'+(n[0]===v?'on':'')+'" data-a="go" data-v="'+n[0]+'"'+(n[0]===v?' aria-current="page"':'')+'><span class="ni">'+n[1]+'</span>'+n[2]+'</button>').join('');
musBtn();if(after_[v])try{after_[v]()}catch(e){console.error(e)}if(typeof afterRender==='function')afterRender(v)}
function goto(v){S.v=v;mclose();render();try{window.scrollTo(0,0)}catch(e){}}
acts.go=d=>goto(d.v);

/* ---------- delegated events ---------- */
document.addEventListener('click',e=>{if(e.target.id==='mo'){mclose();return}const t=e.target.closest('[data-a]');if(!t)return;const f=acts[t.dataset.a];if(f){f(t.dataset,t,e)}if(st.s.mus&&!MUS)musStart()});
document.addEventListener('input',e=>{const t=e.target,k=t.dataset&&t.dataset.in;if(k&&INP[k])INP[k](t.value,t)});
document.addEventListener('change',e=>{const t=e.target,k=t.dataset&&t.dataset.ch;if(k&&CH[k])CH[k](t.value,t)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#mo').hidden){mclose();return}const t=e.target;if((e.key==='Enter'||e.key===' ')&&t.dataset&&t.dataset.a&&t.tagName!=='BUTTON'){e.preventDefault();t.click()}});

/* ---------- boot ---------- */
if(st.s.theme)document.documentElement.dataset.theme=st.s.theme;
wqRemind();
window.HW={go:goto,render,get st(){return st},S,acts};
