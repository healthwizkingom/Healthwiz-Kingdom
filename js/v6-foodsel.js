/* v6 (comfort pass): pick SEVERAL foods, then log them with one tap. Not part of the original.
   The original opened one food at a time (acts.pick → the #det card → ADD TO LOG, which redrew the page and cleared the
   choice). Here a tap on a food toggles it in a selection that stays put while you search, switch meal or menu day:
     · the list item shows it is selected (aria-pressed), and nothing else on the page is redrawn, so the search box
       keeps focus and the list does not jump;
     · the SELECTED FOODS card under the list has servings (− / +), the portion size and, for foods without a listed
       kcal, the kcal per serving, with the running total;
     · LOG SELECTED logs every food at once under the meal chip that is on, in one go (all or nothing: a missing kcal
       stops it before anything is saved), then the page redraws once so calories and macros update immediately.
       A second tap while it is logging is ignored. One summary toast replaces a toast per food.
   A small bar stays at the bottom of the screen while the SELECTED FOODS card is out of view.
   Custom foods (ADD MORE FOOD) are unchanged. Each logged food is the same entry the original wrote. */
const HWFoodSel=(()=>{
let sel=[],busy=0;
const ok=i=>Number.isInteger(i)&&i>=0&&i<F.length;
const kOf=x=>{const f=F[x.i];if(f[2]!=null)return f[2];const v=x.ck;return v!==''&&v!=null&&+v>=0&&+v<=3000?+v:null};
const tot=x=>{const k=kOf(x);return k==null?null:Math.round(k*x.qty*x.pm)};
const total=()=>sel.reduce((a,x)=>a+(tot(x)||0),0);
const has=i=>sel.findIndex(x=>x.i===i);

/* ---------- markup ---------- */
function row(x,k){const f=F[x.i],n=esc(f[0]),t=tot(x);
  return '<div class="fsr"><div class="fsn"><b>'+n+'</b><small>'+esc(f[1])+(f[2]==null?' · kcal not listed':' · '+f[2]+' kcal each')+'</small></div>'
    +'<div class="fsc"><div class="fsq" role="group" aria-label="Servings of '+n+'"><button class="g" data-a="qm" data-k="'+k+'" aria-label="Fewer servings of '+n+'">−</button><b class="num" aria-live="polite">'+x.qty+'</b><button class="g" data-a="qp" data-k="'+k+'" aria-label="More servings of '+n+'">+</button></div>'
    +'<label class="fspm">Portion<select data-ch="fspm" data-k="'+k+'" aria-label="Portion size of '+n+'">'+PMS.map(m=>'<option value="'+m+'"'+(x.pm===m?' selected':'')+'>'+m+'×</option>').join('')+'</select></label>'
    +(f[2]==null?'<label class="fsck">kcal / serving<input data-in="fsck" data-k="'+k+'" type="number" min="0" max="3000" inputmode="decimal" value="'+esc(x.ck)+'"></label>':'')
    +'<b class="fsk" data-kc="'+k+'">'+(t==null?'– kcal':t+' kcal')+'</b>'
    +'<button class="g fsrm" data-a="fsrm" data-k="'+k+'" aria-label="Remove '+n+'">✕</button></div></div>'}
function tray(){if(!sel.length)return '';
  return '<h3>SELECTED FOODS ('+sel.length+')</h3><small class="mut">Logged as <b>'+esc(MN(S.meal))+'</b>'+(HWWhen.custom()?' for <b>'+esc(HWWhen.label(HWWhen.date(),HWWhen.time(),true))+'</b>':'')+'. Tap a food in the list again to remove it.</small>'
    +sel.map(row).join('')
    +'<p class="fstot" id="fstot">Total <b class="num">'+total()+'</b> kcal</p>'
    +'<div class="fsact"><button data-a="addfood" class="fslog">LOG SELECTED ('+sel.length+')</button><button class="g" data-a="fsclr">CLEAR</button></div>'}
function barHtml(){return sel.length?'<span><b>'+sel.length+' selected</b> · <span class="num">'+total()+'</span> kcal</span><button class="g" data-a="fsgo">REVIEW</button><button data-a="addfood">LOG SELECTED</button>':''}

/* ---------- in-place updates (no page redraw while choosing) ---------- */
function sync(){const t=$('#fsel'),b=$('#fsbar');if(t){t.innerHTML=tray();t.hidden=!sel.length}if(b){b.innerHTML=barHtml();b.hidden=!sel.length;watch()}}
function totals(){const t=$('#fstot');if(t)t.innerHTML='Total <b class="num">'+total()+'</b> kcal';sel.forEach((x,k)=>{const e=document.querySelector('[data-kc="'+k+'"]');if(e){const v=tot(x);e.textContent=v==null?'– kcal':v+' kcal'}});const b=$('#fsbar');if(b&&sel.length)b.innerHTML=barHtml()}
let io=null;function watch(){const t=$('#fsel'),b=$('#fsbar');if(!t||!b||typeof IntersectionObserver!=='function')return;if(io)io.disconnect();
  io=new IntersectionObserver(es=>es.forEach(e=>b.classList.toggle('fs-near',e.isIntersecting)));io.observe(t)}
const mark=h=>h.replace(/<button class="it" data-a="pick" data-i="(\d+)">/g,(m,i)=>has(+i)>=0?'<button class="it on" data-a="pick" data-i="'+i+'" aria-pressed="true">':'<button class="it" data-a="pick" data-i="'+i+'" aria-pressed="false">');

const _fi=foodItems;foodItems=function(){return mark(_fi.apply(this,arguments))};
{const P=pages.food;pages.food=function(){const h=P.apply(this,arguments);
  return h.replace(/(<div id="fl">[\s\S]*?<\/div>)(<\/div><div class="card" id="flog">)/,(m,a,b)=>a+'<div class="fsel" id="fsel" aria-live="polite"'+(sel.length?'':' hidden')+'>'+tray()+'</div><div class="fsbar" id="fsbar"'+(sel.length?'':' hidden')+'>'+barHtml()+'</div>'+b)}}
HWEvents.on('page:viewed',e=>{if(e&&e.view==='food')watch()});
document.addEventListener('hww:change',()=>{if(sel.length)sync()});

/* ---------- actions ---------- */
const O={pick:acts.pick,addfood:acts.addfood,qm:acts.qm,qp:acts.qp};
acts.pick=(d,t)=>{const i=+d.i;if(!ok(i))return;const k=has(i);
  if(k>=0)sel.splice(k,1);else sel.push({i,qty:1,pm:1,ck:''});S.sel=null;
  if(t&&t.classList){const on=k<0;t.classList.toggle('on',on);t.setAttribute('aria-pressed',String(on))}
  if($('#fsel'))sync();else render()};
const refocus=(a,k)=>{const b=document.querySelector('[data-a="'+a+'"][data-k="'+k+'"]');if(b)b.focus({preventScroll:true})};
acts.qm=(d,t,e)=>{if(d.k==null)return O.qm(d,t,e);const x=sel[+d.k];if(!x)return;x.qty=Math.max(1,x.qty-1);sync();refocus('qm',+d.k)};
acts.qp=(d,t,e)=>{if(d.k==null)return O.qp(d,t,e);const x=sel[+d.k];if(!x)return;x.qty=Math.min(20,x.qty+1);sync();refocus('qp',+d.k)};
CH.fspm=(v,el)=>{const x=sel[+el.dataset.k];if(!x||PMS.indexOf(+v)<0)return;x.pm=+v;totals()};
INP.fsck=el=>{const x=sel[+el.dataset.k];if(!x)return;x.ck=String(el.value).slice(0,8);totals()};
acts.fsrm=d=>{const k=+d.k;if(sel[k]){sel.splice(k,1);sync();const it=$('#fl');if(it)it.innerHTML=foodItems()}};
acts.fsclr=()=>{sel=[];sync();const it=$('#fl');if(it)it.innerHTML=foodItems()};
acts.fsgo=()=>{const t=$('#fsel');if(t)t.scrollIntoView({behavior:HWMotion.reduced()?'auto':'smooth',block:'start'})};

// toasts raised while several foods are logged are collected: XP lines become one total, repeats show once
let quiet=0,held=[];const _t=toast;toast=function(m){if(quiet){held.push(String(m));return}return _t.apply(this,arguments)};
function batch(fn,done){quiet++;let r;try{r=fn()}finally{setTimeout(()=>{quiet--;const seen=new Set(),out=held.filter(m=>!/^\+\d+ XP\b/.test(m)&&!seen.has(m)&&seen.add(m));held=[];done();out.forEach(m=>_t(m))},400)}return r}

acts.addfood=(d,t,e)=>{if(!sel.length)return O.addfood(d,t,e);if(busy)return;
  const bad=sel.findIndex(x=>kOf(x)==null);
  if(bad>=0){toast('Enter kcal per serving for '+esc(F[sel[bad].i][0])+' (0–3000)');const inp=document.querySelector('[data-in="fsck"][data-k="'+bad+'"]');if(inp)inp.focus();return}
  const w=HWWhen.stamp({sig:'sel'+sel.map(x=>x.i+'x'+x.qty+'/'+x.pm).join()+S.meal});if(!w)return;
  busy=1;document.querySelectorAll('[data-a="addfood"]').forEach(b=>{b.disabled=true;b.setAttribute('aria-busy','true')});
  const list=sel.slice(),meal=S.meal,x0=st.xp,kcal=total();let n=0;
  try{batch(()=>{list.forEach(x=>{const f=F[x.i],k=kOf(x);add('food',Math.round(k*x.qty*x.pm),{name:f[0],por:f[1],qty:x.qty,pm:x.pm,meal,src:'KOLEJ MARA KULIM',u:f[2]==null?1:0},'',w.d,w.t,10,'Meal logged');n++})},
      ()=>{const xp=st.xp-x0;_t('Logged '+n+' food'+(n===1?'':'s')+' · '+kcal+' kcal'+(w.back?' · for '+HWWhen.label(w.d,w.t,true):'')+(xp>0?' · +'+xp+' XP':''))})}
  catch(err){console.error('[HWFoodSel]',err)}
  finally{sel=sel.slice(n);S.sel=null;S.ck='';render();setTimeout(()=>{busy=0},600)}};

HWUI.css('foodsel',`
#fl .it{position:relative;padding-left:42px;min-height:48px}
#fl .it:before{content:"";position:absolute;left:12px;top:50%;width:18px;height:18px;margin-top:-9px;border:3px solid var(--ln);background:var(--pn)}
#fl .it.on{background:var(--p2);box-shadow:inset 0 0 0 3px var(--gold)}
#fl .it.on:before{background:var(--grn)}
#fl .it.on:after{content:"";position:absolute;left:18px;top:50%;width:5px;height:10px;margin-top:-8px;border:solid #fff;border-width:0 3px 3px 0;transform:rotate(45deg)}
.fsel{margin:12px 0 0;padding:12px;border:3px solid var(--ln);background:var(--pn)}
.fsel h3{margin:0 0 4px}
.fsr{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:10px 0;border-bottom:2px dashed var(--p2)}
.fsn{flex:1 1 180px;min-width:0}.fsn b{display:block;overflow-wrap:anywhere}.fsn small{display:block}
.fsc{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.fsq{display:flex;align-items:center;gap:6px}.fsq button,.fsrm{min-width:44px;justify-content:center;padding:6px;font-size:14px}.fsq b{min-width:22px;text-align:center}
.fspm,.fsck{display:flex;flex-direction:column;font-size:11px;margin:0}.fspm select{width:80px;min-height:44px;margin:0}.fsck input{width:96px;min-height:44px;margin:0}
.fsk{min-width:64px;text-align:right;margin-left:auto}
.fstot{margin:10px 0 6px}
.fsact{display:flex;gap:8px;flex-wrap:wrap}.fsact .fslog{flex:1 1 auto;justify-content:center}
button[disabled]{opacity:.6;cursor:progress}
.fsbar{position:sticky;bottom:8px;z-index:15;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;padding:8px 10px;background:var(--pn);border:3px solid var(--ln);box-shadow:0 4px 0 var(--ln)}
.fsbar>span{flex:1 1 auto;font-size:13px}.fsbar.fs-near{visibility:hidden}
@media(max-width:760px){.fsbar{bottom:calc(84px + env(safe-area-inset-bottom,0px))}}
`);
return{get selected(){return sel.map(x=>Object.assign({},x))},clear:()=>{sel=[];sync()}}})();
