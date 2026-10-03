const ENL=['','Very low','Low','Okay','Good','Great'];
const enr=d=>{const x=(st.en||{})[d||today()];return x&&+x.v>=1?+x.v:null};
function enCard(d){const v=enr(d);return '<div class="card" id="encheck"><h3>⚡ HOW IS YOUR ENERGY TODAY?</h3><div class="en5" role="group" aria-label="Energy rating">'+[1,2,3,4,5].map(i=>'<button class="chip'+(v===i?' on':'')+'" data-a="ener" data-i="'+i+'" aria-pressed="'+(v===i)+'" aria-label="Energy '+i+' of 5, '+ENL[i]+'"><b class="num">'+i+'</b><small>'+ENL[i]+'</small></button>').join('')+'</div><small class="mut">'+(v?'Logged '+v+'/5 ('+ENL[v]+'). Tap to change.':'Self-rated: 1 = very low, 5 = great. Used for your health connections.')+'</small></div>'}
acts.ener=d=>{const i=+d.i,k=today();if(!(i>=1&&i<=5))return;st.en=st.en||{};const first=!st.en[k];st.en[k]={v:i,t:nowT()};save();if(first)gain(5,'Energy check-in');render()};

/* ---------- 7-day health trends (home) ---------- */
function trendCard(){const R=rng(7);return '<div class="card" id="htrend"><h3>📈 7-DAY HEALTH TRENDS</h3><div class="tgrid">'
+'<div><b class="tl">🍗 CALORIES (kcal)</b>'+chart(R.map(kc),R,'var(--gold)','kcal',st.s.kcal,'target')+'</div>'
+'<div><b class="tl">💧 WATER (mL)</b>'+chart(R.map(wt),R,'var(--blue)','mL',st.s.water,'target')+'</div>'
+'<div><b class="tl">🌙 SLEEP (hours)</b>'+chart(R.map(slH),R,'var(--vio)','h',sLo(),'min')+'</div>'
+'<div><b class="tl">🧗 STAIR STEPS</b>'+chart(R.map(sp),R,'var(--grn)','steps')+'</div></div></div>'}

/* ---------- Health connections: compare averages on "X met" vs "X not met" days (30 days) ---------- */
// [icon, outcome icon, title, x(d), split(x), group A label, group B label, y(d), y name, y scale (0=auto), unit, game?]
const CXS=()=>{const L=sLo(),T=st.s.water,wtx=d=>wt(d)>0?wt(d):null,act=d=>A('food',d).length||A('water',d).length||A('stair',d).length?A('stair',d).length:null;return[
['🌙','⚡','Sleep & energy',slH,x=>x>=L,L+'+ h sleep','under '+L+' h sleep',enr,'self-rated energy',5,'/5',0],
['💧','⚡','Water & energy',wtx,x=>x>=T,'water target met','water below target',enr,'self-rated energy',5,'/5',0],
['🧗','⚡','Activity & energy',act,x=>x>0,'stair-session','no-session',enr,'self-rated energy',5,'/5',0],
['🌙','🧠','Sleep & stress',slH,x=>x>=L,L+'+ h sleep','under '+L+' h sleep',str,'self-rated stress',10,'/10',0],
['🌙','🎮','Sleep & XP gain',slH,x=>x>=L,L+'+ h sleep','under '+L+' h sleep',d=>xdy(d),'XP gain',0,' XP',1],
['💧','🎮','Water & XP gain',wtx,x=>x>=T,'water target met','water below target',d=>xdy(d),'XP gain',0,' XP',1]]};
let CXK='',CXV=[];
function cxAll(){const key=SV+'|'+today();if(CXK===key)return CXV;const R=rng(30);CXV=CXS().map(([ie,oe,ttl,xf,spl,la,lb,yf,yn,sc,yu,game])=>{const a=[],b=[];R.forEach(d=>{const x=xf(d);if(x==null)return;const y=yf(d);if(y==null)return;(spl(x)?a:b).push(y)});const need=a.length<3||b.length<3,ma=need?0:avg(a),mb=need?0:avg(b),s2=sc||Math.max(ma,mb,1);return{ie,oe,ttl,la,lb,yn,sc,yu,game,na:a.length,nb:b.length,need,a:ma,b:mb,rel:need?0:Math.abs(ma-mb)/s2}});CXK=key;return CXV}
function cxRow(x){const s2=x.sc||Math.max(x.a,x.b,1),f=v=>x.sc?(Math.round(v*10)/10):Math.round(v),w=x.rel<.06?'about the same':(x.rel<.15?'slightly ':'noticeably ')+(x.a>x.b?'higher':'lower');
return '<div class="cxi"><b>'+x.ie+' → '+x.oe+' '+x.ttl.toUpperCase()+'</b><p>Your '+x.yn+' was <b>'+w+'</b> on '+x.la+' days than on '+x.lb+' days.</p><div class="cxb"><span>'+x.la+' <small>('+x.na+' d)</small></span>'+bar(x.a/s2*100,'var(--grn)')+'<b class="num">'+f(x.a)+x.yu+'</b></div><div class="cxb"><span>'+x.lb+' <small>('+x.nb+' d)</small></span>'+bar(x.b/s2*100,'var(--mut)')+'<b class="num">'+f(x.b)+x.yu+'</b></div>'+(x.game?'<span class="gtag">🎮 XP IS A GAME REWARD, NOT A HEALTH MEASURE</span>':'')+'</div>'}
function cxCard(lim,id){const all=cxAll(),ok=all.filter(x=>!x.need).sort((p,q)=>(p.game-q.game)||(q.rel-p.rel)).slice(0,lim),hp=all.filter(x=>!x.game),best=hp.reduce((m,x)=>Math.max(m,Math.min(3,x.na)+Math.min(3,x.nb)),0);
const body=ok.length?ok.map(cxRow).join(''):emp('🔒 CONNECTIONS STILL HIDDEN','Log sleep, water and your daily energy rating. Each comparison needs at least 3 days on both sides (for example 3 nights of '+sLo()+'+ h and 3 shorter nights).')+bar(best/6*100,'var(--blue)')+'<small class="mut">Closest comparison: '+best+'/6 days</small>';
return '<div class="card" id="'+(id||'cx')+'"><h3>🔗 HEALTH CONNECTIONS · 30 DAYS</h3>'+body+'<p class="mut" style="font-size:12px;margin:10px 0 0">Patterns in your own logs, not proof of cause. Illness, workload, caffeine, weather and more can affect energy and stress. Energy and stress are self-rated.</p></div>'}

/* ---------- Backup & restore (JSON) ---------- */
const bkJSON=()=>JSON.stringify({app:'HealthWiz',ver:'5.3',exported:new Date().toISOString(),data:st});
acts.expj=()=>{try{const b=new Blob([bkJSON()],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='healthwiz-backup-'+today()+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);st.s.bk=today();save();toast('💾 Backup downloaded');render()}catch(e){acts.exp()}};
function impParse(txt){let o;try{o=JSON.parse(txt)}catch(e){return 'That is not valid JSON. Check that the whole backup was copied.'}
if(o&&o.app==='HealthWiz'&&o.data)o=o.data;if(!o||typeof o!=='object'||!Array.isArray(o.e))return 'This does not look like a HealthWiz backup (no entry list found).';
const C=['food','water','sleep','pulse','stair','stress','bmi'],D=DEF(),ok=[];
o.e.forEach((x,i)=>{if(x&&C.includes(x.c)&&/^\d{4}-\d{2}-\d{2}$/.test(x.d)&&x.v!==''&&x.v!=null&&isFinite(+x.v))ok.push({id:String(x.id||('i'+Date.now()+i)),c:x.c,v:+x.v,m:x.m&&typeof x.m==='object'?x.m:{},n:String(x.n||''),d:x.d,t:/^\d{2}:\d{2}$/.test(x.t)?x.t:'12:00'})});
const n=Object.assign(D,o,{e:ok,s:Object.assign(D.s,o.s&&typeof o.s==='object'?o.s:{}),p:Object.assign(D.p,o.p&&typeof o.p==='object'?o.p:{}),xp:Math.max(0,+o.xp||0)});
['b','claimed','en','xd','qx'].forEach(k=>{if(n[k]!=null&&(typeof n[k]!=='object'||Array.isArray(n[k])))n[k]={}});
if(!(n.s.kcal>=800&&n.s.kcal<=5000))n.s.kcal=2200;if(!(n.s.water>=500&&n.s.water<=4000))n.s.water=2000;
return{o:n,bad:o.e.length-ok.length}}
function impShow(txt){const o=$('#impo');if(!o)return;const r=impParse(txt);if(typeof r==='string'){S.imp=null;o.innerHTML='<div class="warn">'+esc(r)+'</div>';return}
S.imp=r.o;S.ir=0;const e=r.o.e,ds=e.map(x=>x.d).sort(),cs=[...new Set(e.map(x=>x.c))];
o.innerHTML='<div class="t" style="margin-top:10px">Backup found<b class="num">'+e.length+' entries</b><small>'+(ds.length?esc(ds[0])+' → '+esc(ds[ds.length-1]):'no entries')+(cs.length?' · '+esc(cs.join(', ')):'')+' · '+r.o.xp+' XP'+(r.bad?' · '+r.bad+' invalid entr'+(r.bad>1?'ies':'y')+' skipped':'')+'</small></div><div class="row" style="margin-top:8px"><button data-a="impm">MERGE INTO CURRENT</button><button class="g" data-a="impr" id="imprb">REPLACE ALL DATA</button></div><small class="mut">Merge adds entries you don\'t already have and keeps your current targets and profile. Replace overwrites everything on this device.</small>'}
CH.impf=(v,el)=>{const f=el&&el.files&&el.files[0];if(!f)return;if(f.size>5e6){toast('That file is too large for a HealthWiz backup');return}const r=new FileReader();r.onload=()=>impShow(String(r.result||''));r.onerror=()=>toast('Could not read that file');r.readAsText(f)};
acts.impt=()=>impShow(($('#imptx')||{}).value||'');
acts.impm=()=>{const I=S.imp;if(!I)return;const ids=new Set(st.e.map(x=>x.id));let k=0;I.e.forEach(x=>{if(!ids.has(x.id)){st.e.push(x);k++}});['b','claimed','en','xd','qx','qd','ck'].forEach(f=>{if(I[f]&&typeof I[f]==='object')st[f]=Object.assign({},I[f],st[f]||{})});st.xp=Math.max(+st.xp||0,+I.xp||0);S.imp=null;save();render();toast('Merged '+k+' new entr'+(k===1?'y':'ies'))};
acts.impr=()=>{if(!S.imp)return;if(!S.ir){S.ir=1;const b=$('#imprb');if(b){b.textContent='TAP AGAIN TO REPLACE';b.style.background='var(--red)';b.style.color='#fff'}return}st=S.imp;S.imp=null;S.ir=0;save();render();toast('Backup restored')};

/* ---------- New habit badges ---------- */
let FBK=-1,FBV=0;
const fibDays=()=>{if(FBK!==SV){FBK=SV;const r=mref().fb;FBV=dys().filter(d=>dmac(d).fb>=r).length}return FBV};
BG.push(['⚡','Energy Scribe','Rate your energy on 5 days',()=>[Object.keys(st.en||{}).length,5]],['🌾','Fiber Forager','Reach your fiber reference on 3 days',()=>[fibDays(),3]],['🔗','Pattern Seer','Discover your first health connection',()=>[cxAll().filter(x=>!x.need&&!x.game).length,1]]);

render();
</script></body></html>
