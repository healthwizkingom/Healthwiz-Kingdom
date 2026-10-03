/* =====================================================================
   RECONSTRUCTED (v6) — Royal Archives (stats), Wizard Tower (guide),
   Castle Keep (settings, theme, sound, backup UI for the original
   backup/restore code in legacy-tail.js, reset).
   ===================================================================== */

/* ===================== ROYAL ARCHIVES (stats) ===================== */
function streak(){const ds=new Set(st.e.map(x=>x.d));let n=0;const d=new Date();if(!ds.has(ymd(d)))d.setDate(d.getDate()-1);while(ds.has(ymd(d))){n++;d.setDate(d.getDate()-1)}return n}
const CATS=[['all','All'],['food','🍗 Food'],['water','💧 Water'],['sleep','🌙 Sleep'],['pulse','❤️ Pulse'],['stair','🧗 Stairs'],['stress','🧠 Stress'],['bmi','⚖️ BMI']];
pages.stats=()=>{const n=S.rg==='m'?30:7,R=rng(n),lab=R.map(d=>n>7?d.slice(5):d),days=new Set(st.e.map(x=>x.d)).size,L=lvl(),
lg=f=>{const v=R.map(f).filter(x=>x!=null&&x!==0);return v.length?Math.round(avg(v)*10)/10:'–'},
H=(S.fc==='all'?ALL():LC(S.fc)).slice(-40).reverse();
return '<h2>📊 ROYAL ARCHIVES</h2><p class="mut">Everything your knight has recorded.</p>'
+'<div class="grid"><div class="t">🗂️ Entries<b>'+st.e.length+'</b></div><div class="t">📅 Days tracked<b>'+days+'</b></div><div class="t">🔥 Current streak<b>'+streak()+'</b><small>days in a row</small></div><div class="t">⭐ XP<b>'+st.xp+'</b><small>Lv '+(L.i+1)+'</small></div><div class="t">🗺️ Regions<b>'+REG.filter(r=>r[2]()).length+'/6</b></div><div class="t">🏅 Badges<b>'+BG.filter(b=>st.b[b[1]]).length+'/'+BG.length+'</b></div></div>'
+'<div class="card" style="margin-top:14px"><div class="ah"><h3>📈 TRENDS</h3><div class="row" style="flex:0 0 auto">'+[['w','7 DAYS'],['m','30 DAYS']].map(g=>'<button class="chip sm'+(S.rg===g[0]?' on':'')+'" data-a="srg" data-g="'+g[0]+'">'+g[1]+'</button>').join('')+'</div></div><div class="tgrid">'
+[['🍗 CALORIES',kc,'var(--gold)','kcal',st.s.kcal],['💧 WATER',wt,'var(--blue)','mL',st.s.water],['🌙 SLEEP',slH,'var(--vio)','h',sLo()],['🧗 STAIR STEPS',sp,'var(--grn)','steps',100],['❤️ RESTING PULSE',rest,'var(--red)','BPM'],['🧠 STRESS',str,'var(--vio)','/10'],['🎮 XP GAINED',xdy,'var(--gold)','XP']].map(c=>'<div><b class="tl">'+c[0]+'</b>'+chart(R.map(c[1]),lab,c[2],c[3],c[4],c[4]?'target':'')+'</div>').join('')+'</div></div>'
+'<div class="card"><h3>🧮 AVERAGES ON LOGGED DAYS · '+n+' DAYS</h3><div class="tscroll"><table class="tbl"><thead><tr><th>MEASURE</th><th>AVERAGE</th><th>DAYS LOGGED</th></tr></thead><tbody>'
+[['Calories (kcal)',kc],['Water (mL)',wt],['Sleep (h)',slH],['Stair steps',sp],['Resting pulse (BPM)',rest],['Stress (/10)',str],['Energy (/5)',enr]].map(r=>'<tr><td>'+r[0]+'</td><td>'+lg(r[1])+'</td><td>'+R.filter(d=>{const v=r[1](d);return v!=null&&v!==0}).length+'</td></tr>').join('')+'</tbody></table></div></div>'
+cxCard(6,'cx2')
+'<div class="card"><h3>📜 HISTORY</h3><div class="row">'+CATS.map(c=>'<button class="chip sm'+(S.fc===c[0]?' on':'')+'" data-a="sfc" data-c="'+c[0]+'">'+c[1]+'</button>').join('')+'</div>'+(H.length?H.map(e=>row(e,1)).join('')+'<small class="mut">Showing the latest '+H.length+' entries.</small>':emp('🌱 NOTHING RECORDED','Entries you log anywhere in the kingdom appear here.'))+'</div>'};
acts.srg=d=>{S.rg=d.g;render()};
acts.sfc=d=>{S.fc=d.c;render()};

/* ===================== WIZARD TOWER (guide) ===================== */
// [icon, title, text] — observations from the user's own last 7 days; never diagnoses.
function guideNotes(){const R=rng(7),N=[],lo=sLo(),[,hi]=SR(+st.p.age||16),has=c=>R.some(d=>A(c,d).length);
const wd=R.filter(d=>wt(d)>0),wm=wd.filter(d=>wt(d)>=st.s.water).length;
if(wd.length>=3&&wm<wd.length/2)N.push(['💧','Water often below target','You reached your water target on '+wm+' of '+wd.length+' logged days. Keeping a bottle in sight and sipping with each meal can help.']);
else if(wd.length>=3)N.push(['💧','Steady hydration','You met your water target on '+wm+' of '+wd.length+' logged days. Nicely done.']);
const fd=R.filter(d=>A('food',d).length);if(fd.length>=3){const bf=fd.filter(d=>A('food',d).some(x=>x.m.meal==='breakfast'||x.m.meal==='sahur')).length;if(bf<fd.length/2)N.push(['🍳','Breakfast often missing','Breakfast appears on '+bf+' of '+fd.length+' food-logged days. A simple morning meal can make it easier to focus in class.']);
const over=fd.filter(d=>kc(d)>st.s.kcal*1.1).length;if(over>=3)N.push(['🍗','Above plan on several days','Calories were more than 10% above your target on '+over+' days. That can be fine on active days — check that the target in the Goal Forge still fits.']);
const fr=mref().fb,fbd=fd.filter(d=>dmac(d).fb>=fr).length;if(fbd<fd.length/2)N.push(['🌾','Fiber could be higher','Estimated fiber reached your reference ('+fr+' g) on '+fbd+' of '+fd.length+' days. Vegetables, fruit, oats, dhal and tempe add fiber.'])}
const sd=R.filter(d=>slH(d)!=null);if(sd.length>=3){const short=sd.filter(d=>slH(d)<lo).length;if(short>=Math.ceil(sd.length/2))N.push(['🌙','Short nights','On '+short+' of '+sd.length+' logged nights you slept under '+lo+' h, the lower end of the range for your age ('+lo+'–'+hi+' h). A consistent bedtime is a good first step.']);else N.push(['🌙','Sleep mostly in range','Most of your logged nights reached at least '+lo+' h.'])}
const ss=R.map(str).filter(x=>x!=null);if(ss.length>=3&&avg(ss)>=6.5)N.push(['🧠','Stress has been high','Your average self-rated stress was '+avg(ss).toFixed(1)+'/10 this week. The calm games can help in the moment; if it keeps feeling heavy, talk to someone you trust or a school counsellor.']);
if(!has('stair')&&st.e.length)N.push(['🧗','Try a stair session','No stair sessions this week. Two flights at a comfortable pace is a great start.']);
const rp=R.map(rest).filter(x=>x!=null);if(rp.length>=3)N.push(['❤️','Resting pulse average','Your average resting reading this week was '+Math.round(avg(rp))+' BPM across '+rp.length+' days.']);
if(!N.length)N.push(['📜','Not enough logs yet','Log water, meals and sleep for a few days and the Wizard will share observations from your own data here.']);
return N}
pages.guide=()=>{const N=guideNotes();return '<h2>🧙 WIZARD TOWER</h2><p class="mut">Observations from your last 7 days of logs.</p>'
+'<div class="obsay"><img class="obz" src="'+KN+'" alt="" width="96"><div class="tbx"><b>THE WIZARD SAYS</b><p>'+(st.e.length?'I have studied your scrolls, brave knight. Here is what I see — patterns, not verdicts.':'Your scrolls are still empty. Visit the regions of the kingdom and log what you do.')+'</p></div></div>'
+N.map(n=>'<div class="card"><h3>'+n[0]+' '+n[1].toUpperCase()+'</h3><p>'+n[2]+'</p></div>').join('')
+'<div class="card"><h3>📚 KINGDOM LORE</h3>'+TIPS.map(t=>'<p>• '+t+'</p>').join('')+'</div>'};

/* ===================== CASTLE KEEP (settings) ===================== */
pages.set=()=>{const th=st.s.theme||'auto';
return '<h2>⚙️ CASTLE KEEP</h2>'
+'<div class="card"><h3>🎯 DAILY TARGETS</h3><div class="row"><label>Calories (kcal)<input id="tk" type="number" min="800" max="5000" value="'+st.s.kcal+'"></label><label>Water (mL)<input id="tw" type="number" min="500" max="4000" step="50" value="'+st.s.water+'"></label></div><button data-a="tsave" style="width:100%">SAVE TARGETS</button><small class="mut">Not sure? The <button class="sm g" data-a="go" data-v="calc">GOAL FORGE</button> can estimate them.</small></div>'
+'<div class="card"><h3>🎨 DISPLAY & SOUND</h3><label>Theme</label><div class="row">'+[['auto','Auto'],['light','Light'],['dark','Dark']].map(t=>'<button class="chip'+(th===t[0]?' on':'')+'" data-a="theme" data-t="'+t[0]+'">'+t[1]+'</button>').join('')+'</div><label>Sound effects</label><div class="row"><button class="chip'+(st.s.sound?' on':'')+'" data-a="snd" data-v="1">On</button><button class="chip'+(!st.s.sound?' on':'')+'" data-a="snd" data-v="0">Off</button></div><label>Background music</label><div class="row"><button class="chip'+(st.s.mus?' on':'')+'" data-a="mus">'+(st.s.mus?'🎵 Playing — tap to stop':'🔇 Off — tap to play')+'</button></div></div>'
+'<div class="card"><h3>💾 BACKUP & RESTORE</h3><p>'+(st.s.bk?'Last backup: <b>'+esc(st.s.bk)+'</b>':'<b>No backup yet.</b> Your data lives only in this browser.')+'</p><button data-a="expj" style="width:100%">DOWNLOAD BACKUP (.json)</button>'
+'<label style="margin-top:12px">Restore from a file<input type="file" accept=".json,application/json" data-ch="impf"></label><details><summary>…or paste backup text</summary><textarea id="imptx" rows="5" placeholder=\'{"app":"HealthWiz", …}\'></textarea><button class="g" data-a="impt">CHECK PASTED BACKUP</button></details><div id="impo"></div></div>'
+'<div class="card"><h3>🏰 ABOUT</h3><p><b>HealthWiz Kingdom</b> v6 · by Group 14</p><p class="mut">Menu calories: KOLEJ MARA KULIM Dewan Selera 2022. Goals: Mifflin-St Jeor, AMDR, AASM/CDC sleep ranges. HealthWiz is a wellness tracker, not a medical device.</p><button class="g" data-a="go" data-v="welcome" style="width:100%">SHOW TITLE SCREEN</button></div>'
+'<div class="card"><h3>⚠️ DANGER ZONE</h3><p class="mut">Erase every entry, XP, badge and setting on this device. Download a backup first if you might want it back.</p><button class="g" data-a="reset" id="rstb" style="width:100%">ERASE ALL DATA</button></div>'};
acts.tsave=()=>{const k=numIn('#tk',800,5000),w=numIn('#tw',500,4000);if(!k||!w||isNaN(k)||isNaN(w)){toast('Calories 800–5000 and water 500–4000 mL');return}st.s.kcal=Math.round(k);st.s.water=Math.round(w);save();toast('🎯 Targets saved');render()};
function applyTheme(){const t=st.s.theme;if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme}
acts.theme=d=>{st.s.theme=d.t==='auto'?'':d.t;save();applyTheme();render()};
acts.snd=d=>{st.s.sound=+d.v;save();if(st.s.sound)sfx(660,.08);render()};
acts.reset=()=>{if(!S.rst){S.rst=1;const b=$('#rstb');if(b){b.textContent='TAP AGAIN TO ERASE EVERYTHING';b.style.background='var(--red)';b.style.color='#fff'}TMR.rst=setTimeout(()=>{S.rst=0},6000);return}
S.rst=0;musStop();st=DEF();save();BPQ.length=0;S.bnew={};applyTheme();toast('All data erased');goto('welcome')};
applyTheme();
