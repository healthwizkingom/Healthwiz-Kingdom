/* v6: Add More Food, guided by the Wannabe Wizard, an apprentice new to the job. Not part of the original.
   Master prompt "Nutrition modification", reworked at the owner's request (2026-10-13): "make the wizard a search engine
   where he searches for the best calorie and macros based on the food and portion, and any add-ons or removed things
   that the user typed; use the Gemini API key so it can search the best estimate or real data".
   ADD MORE FOOD on the Nutrition page opens the wizard above the original custom-food form, which stays as it was (type
   it yourself; one SAVE CUSTOM FOOD click still saves).
   * Art, from the owner's "The Wannabe Wizard" sheet and his room (tools/art/make_apprentice.py): six poses
     (apprentice-poses.webp), seven expressions (apprentice-faces.webp) and his room (apprentice-room.webp). He fills most
     of the scene's height. CSS only; still under reduced motion or the Performance mode.
   * 1. One box: what you ate, in your words, with the portion and anything extra or left out ("nasi lemak, big plate,
     extra fried chicken, no sambal").
   * 2. Signed in, he searches: Google Gemini with Grounding with Google Search, through the food-guess Edge Function
     (supabase/functions/food-guess; the key stays on the server). It looks up real nutrition data, applies the changes,
     and returns the parts with weight, kcal, protein, carbohydrate and fat, the portion it used, a short note and how
     sure it is, plus the web pages it used (shown as sources) and Google's search suggestions (shown, as Google asks).
     The card labels it an AI estimate from web sources, not a measurement; − and + change any part by half its amount.
   * 3. Signed out, offline, or when the search fails, he searches his books instead: the Kolej MARA Kulim canteen menu
     and (signed in) USDA FoodData Central through the food-search Edge Function, with food-specific portions, as before.
   * 4. Nothing is saved until LOG IT (or CONFIRM AND LOG for a book match). A web estimate is saved as a custom food with
     the macros, db: 'est', the parts [label, g, kcal] and up to five source links; the log shows "Wizard's estimate"
     and its macros count as estimated (EST). */
const HWAddFood=(()=>{
const D=document,ico=(n,s)=>HWPixel.icon(n,s||1);
const POSE='assets/img/apprentice-poses.webp',FACE='assets/img/apprentice-faces.webp',ROOM='assets/img/apprentice-room.webp';
const POSES=['front','three','side','back','walk','cast'],FACES=['happy','confused','nervous','determined','surprised','tired','excited'];
const pat=(L,k)=>(L.indexOf(k)/(L.length-1)*100).toFixed(4)+'%';
const r1=v=>Math.round(v*10)/10,fmt=v=>v==null?'–':(Math.round(v*10)/10).toLocaleString(undefined,{maximumFractionDigits:1});

/* ---------- the wizard's state, for this visit only ---------- */
// step: ask (what did you eat?) | guess (his web estimate) | pick, portion (the books) | done
const W0=()=>({step:'ask',food:'',res:null,items:[],unknown:0,note2:'',
  q:'',busy:0,err:'',menu:[],db:[],dbNote:'',sel:null,food0:null,por:0,n:1,g:'',name:'',meal:'',done:null});
const W=W0(),reset=()=>Object.assign(W,W0());
const CL=()=>typeof HWCloud!=='undefined'?HWCloud:null,signed=()=>{const c=CL();return!!(c&&c.who())};

/* ---------- 1. his search: Gemini with Google Search, through the food-guess Edge Function ---------- */
const AIERR={offline:'You are offline, so I cannot search the web.',nokey:'My web search is not set up on the server yet.',
  busy:'The web search is busy right now.',limit:'That is a lot of searching for one hour!',ai:'My web search came back muddled.',signin:'Sign in so I can search the web.'};
async function ball(){const c=CL();if(!c||!c.who())throw{code:'signin'};if(navigator.onLine===false)throw{code:'offline'};
  try{return await c.api('/functions/v1/food-guess',{method:'POST',body:{food:W.food},ms:45000})}
  catch(e){const b=e.body||{};throw{code:e.code==='net'?'offline':e.status===401||e.code==='auth'?'signin':e.status===429?'limit':b.error==='nokey'||e.code==='setup'?'nokey':b.error==='busy'?'busy':'ai'}}}
async function webSearch(){W.busy=1;W.err='';W.unknown=0;W.note2='';W.step='ask';draw();
  try{const r=await ball();W.busy=0;
    if(r&&r.result&&Array.isArray(r.result.items)&&r.result.items.length){W.res=r.result;W.items=r.result.items.map(i=>({label:i.label,x:1,v:i}));W.name='';W.step='guess'}
    else if(r&&r.unknown)W.unknown=1;
    else throw{code:'ai'}
    draw()}
  catch(e){W.busy=0;W.note2=(AIERR[e.code]||AIERR.ai)+' Here is what my books say.';search()}}
/** One part's values after the player's adjustment (x: 0 to 4 times what he found). */
function itemVal(it){const v=it.v,x=it.x,m=k=>v[k]==null?null:v[k]*x;return{g:v.g==null?null:v.g*x,kcal:v.kcal*x,p:m('p'),c:m('c'),f:m('f')}}
function totals(){const t={kcal:0,p:0,c:0,f:0,g:0,miss:0};W.items.forEach(it=>{if(!it.x)return;const v=itemVal(it);t.kcal+=v.kcal;['p','c','f'].forEach(k=>{if(v[k]==null)t.miss=1;else t[k]+=v[k]});if(v.g)t.g+=v.g});
  t.kcal=Math.round(t.kcal);['p','c','f','g'].forEach(k=>t[k]=r1(t[k]));return t}

/* ---------- 2. his books: the canteen menu and USDA FoodData Central ---------- */
const words=q=>String(q||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
function menuMatches(q){const w=words(q);if(!w.length)return[];
  return F.map((f,i)=>({f,i})).filter(x=>x.f[2]!=null&&w.every(s=>x.f[0].toLowerCase().includes(s))).slice(0,6).map(x=>({k:'menu',i:x.i,name:x.f[0],por:x.f[1],kcal:+x.f[2]}))}
const ERR={signin:'Sign in to search the USDA food database. The canteen menu works without an account.',offline:'You are offline, so I cannot reach the food archive. The canteen menu still works.',
  nokey:'The food archive is not set up on the server yet. The canteen menu and typing it yourself still work.',busy:'The food archive is busy right now. Try again in a minute.',
  limit:'That is a lot of searching for one hour! Try again a little later.',db:'The food archive did not answer properly. Try again, or type it yourself.'};
async function call(body){const c=CL();if(!c||!c.who())throw{code:'signin'};if(navigator.onLine===false)throw{code:'offline'};
  try{return await c.api('/functions/v1/food-search',{method:'POST',body,ms:20000})}
  catch(e){const b=e.body||{};throw{code:e.code==='net'?'offline':e.status===401||e.code==='auth'?'signin':e.status===429?'limit':b.error==='nokey'||e.code==='setup'?'nokey':b.error==='busy'?'busy':'db'}}}
async function search(){const q=(W.q||'').trim();if(!q){W.err='Type a food first, for example: nasi lemak, apple, milk.';draw();return}
  W.err='';W.step='pick';W.menu=menuMatches(q);W.db=[];W.dbNote='';W.busy=1;draw();
  try{const d=await call({q});W.db=Array.isArray(d&&d.foods)?d.foods.filter(f=>f&&f.per100&&+f.per100.kcal>=0):[]}
  catch(e){W.dbNote=ERR[e.code]||ERR.db}
  W.busy=0;draw()}
function pickList(){const row=(a,t,s,k)=>'<li><button type="button" class="g awres" data-a="awpick" data-k="'+k+'"><b>'+esc(t)+'</b><small>'+s+'</small></button></li>';
  return '<ul class="awlist">'+W.menu.map((m,j)=>row('menu',m.name,'Kolej MARA Kulim canteen menu (2022) · '+esc(m.por)+' · '+m.kcal+' kcal','m'+j)).join('')
    +W.db.map((f,j)=>row('db',f.name,'USDA FoodData Central · '+esc(f.type)+(f.brand?' · '+esc(f.brand):'')+' · '+fmt(f.per100.kcal)+' kcal per 100 '+esc(f.unit),'d'+j)).join('')+'</ul>'
    +(W.busy?'<p class="mut">Searching the USDA FoodData Central archive...</p>':W.dbNote?'<p class="mut awnote">'+esc(W.dbNote)+'</p>':'')
    +'<div class="row"><button type="button" class="g sm" data-a="awback">SEARCH AGAIN</button></div>'}

/** A canteen dish as chosen: every listing of that name is a portion option; i is the listing picked first. */
function menuSel(name,i){const vars=[];F.forEach((f,j)=>{if(f[2]!=null&&f[0].toLowerCase()===String(name).toLowerCase()&&!vars.some(v=>v.por===f[1]&&v.kcal===+f[2]))vars.push({i:j,por:f[1],kcal:+f[2]})});
  if(!vars.length)vars.push({i,por:F[i][1],kcal:+F[i][2]});const v=Math.max(0,vars.findIndex(x=>x.i===i));return setVar({k:'menu',name:F[vars[0].i][0],vars,v},v)}
const setVar=(s,v)=>Object.assign(s,{v,por:s.vars[v].por,kcal:s.vars[v].kcal});

/* ---------- 3. a book match's portion ---------- */
// a small picture for each kind of household measure (decoration; the grams come from the database)
function kind(l){l=String(l).toLowerCase();return/cup|mug/.test(l)?'cup':/bowl/.test(l)?'bowl':/glass|bottle|can\b|ml|fl oz|carton|kotak/.test(l)?'drink':/slice|wedge|piece of pizza/.test(l)?'slice':
  /tbsp|tablespoon|tsp|teaspoon|spoon/.test(l)?'spoon':/package|packet|bar|serving on the label|container|pack/.test(l)?'pack':/plate|pinggan|serving/.test(l)?'plate':'piece'}
const PIC={cup:'<path d="M5 8h14v8a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z" fill="#f3e6cf"/><path d="M19 10h2a2 2 0 0 1 0 5h-2" fill="none" stroke="#f3e6cf" stroke-width="2"/><path d="M6 10h12" stroke="#c8553d" stroke-width="2"/>',
  bowl:'<path d="M3 11h18a9 7 0 0 1-18 0z" fill="#f3e6cf"/><path d="M5 11c2-3 12-3 14 0" fill="#fff" stroke="#e8d8b8"/>',drink:'<path d="M8 4h8l-1 17H9z" fill="#7fb6e0"/><path d="M8 4h8" stroke="#fff" stroke-width="2"/>',
  slice:'<path d="M12 21L3 6c6-3 12-3 18 0z" fill="#f6c94f"/><circle cx="10" cy="10" r="1.6" fill="#c8553d"/><circle cx="14" cy="13" r="1.6" fill="#c8553d"/>',
  spoon:'<ellipse cx="9" cy="8" rx="5" ry="4" fill="#d9dce8"/><path d="M12 11l8 9" stroke="#d9dce8" stroke-width="2.5"/>',pack:'<rect x="5" y="5" width="14" height="15" rx="2" fill="#8b5cf0"/><rect x="8" y="9" width="8" height="5" fill="#fff0a8"/>',
  plate:'<ellipse cx="12" cy="14" rx="10" ry="5" fill="#f3e6cf"/><ellipse cx="12" cy="12.5" rx="5" ry="3" fill="#f0a050"/>',piece:'<circle cx="12" cy="13" r="7" fill="#e0544a"/><path d="M12 6c0-2 2-3 3-3" stroke="#5a3" stroke-width="2" fill="none"/>'};
const pic=l=>'<svg class="awpic" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">'+PIC[kind(l)]+'</svg>';
const NS=[.5,1,1.5,2,3],nt=n=>n===.5?'½':n===1.5?'1½':String(n);
/** The measures for the chosen database food: its household portions, the label serving, or none (grams). */
function measures(f){const L=(f.portions||[]).map(p=>({label:p.label,g:+p.g}));if(f.serving)L.unshift({label:(f.serving.text?f.serving.text+', ':'')+'1 serving on the label',g:+f.serving.g});return L}
/** The amount and the values for what is chosen now: {g (total grams or ml), kcal, p, c, f, label} or null. */
function calc(){if(!W.sel)return null;
  if(W.sel.k==='menu'){const m=W.sel,k=Math.round(m.kcal*W.n),x=typeof estMac==='function'?estMac(m.name,k):null;return{kcal:k,p:x?x.p:null,c:x?x.c:null,f:x?x.f:null,label:nt(W.n)+' × '+m.por,menu:1}}
  const f=W.food0;if(!f)return null;const M=measures(f),m=M[W.por];let g,label;
  if(m){g=r1(m.g*W.n);label=nt(W.n)+' × '+m.label+' ('+fmt(m.g)+' '+f.unit+' each)'}else{g=+W.g;if(!(g>0&&g<=5000))return null;label=fmt(g)+' '+f.unit}
  const v=k=>f.per100[k]==null?null:r1(f.per100[k]*g/100);return{g,kcal:Math.round(f.per100.kcal*g/100),p:v('p'),c:v('c'),f:v('f'),label}}
function card(){const c=calc();if(!c)return '<p class="mut">Choose an amount to see the values.</p>';const f=W.food0,u=f?f.unit:'g';
  const row=(n,v,unit)=>'<tr><th scope="row">'+n+'</th><td>'+(v==null?'<span class="mut">not in the database</span>':fmt(v)+' '+unit)+'</td></tr>';
  const how=c.menu?'<p class="mut">kcal = '+W.sel.kcal+' kcal per portion × '+nt(W.n)+' = '+c.kcal+' kcal (Kolej MARA Kulim canteen menu, 2022). Protein, carbohydrate and fat are <b>HealthWiz estimates</b> from the dish type, not measured.</p>'
    :'<p class="mut">Each value = value per 100 '+u+' × '+fmt(c.g)+' '+u+' ÷ 100. Energy: '+fmt(f.per100.kcal)+' × '+fmt(c.g)+' ÷ 100 = '+c.kcal+' kcal.</p>';
  const src=c.menu?'':'<p class="mut awsrc">Source: USDA FoodData Central, '+esc(f.type)+', FDC ID '+f.id+(f.brand?' ('+esc(f.brand)+')':'')+'. Public domain (CC0). '
    +(f.type==='Survey (FNDDS)'?'Survey portion weights are typical amounts, not your exact portion. ':f.type==='Branded'?'Label values are rounded by the maker and converted per 100 '+u+' by USDA. ':'')
    +'Household measures are approximate: your real portion and recipe may differ.</p>';
  return '<div class="awcard'+(W.step==='done'?' reveal':'')+'"><b>'+esc(W.name||W.sel.name)+'</b><small>'+esc(c.label)+'</small><table class="awtab"><tbody>'+row('Energy',c.kcal,'kcal')+row('Protein',c.p,'g')+row('Carbohydrate',c.c,'g')+row('Fat',c.f,'g')+'</tbody></table>'+how+src+'</div>'}
function portionStep(){if(W.busy)return '<p class="mut">Reading the measures...</p>';const s=W.sel;
  let opts='';
  if(s.k==='menu')opts=s.vars.length>1?'<p>The canteen menu lists this dish '+s.vars.length+' times. Which one was it?</p><div class="awms" role="group" aria-label="Canteen portion">'
      +s.vars.map((x,i)=>'<button type="button" class="chip awm'+(s.v===i?' on':'')+'" data-a="awvar" data-i="'+i+'" aria-pressed="'+(s.v===i)+'"><span>'+esc(x.por)+'<small>'+x.kcal+' kcal</small></span></button>').join('')+'</div>'
    :'<p>One portion on the menu: <b>'+esc(s.por)+'</b></p>';
  else{const M=measures(W.food0);
    opts=M.length?'<div class="awms" role="group" aria-label="Measure">'+M.map((m,i)=>'<button type="button" class="chip awm'+(W.por===i?' on':'')+'" data-a="awpor" data-i="'+i+'" aria-pressed="'+(W.por===i)+'">'+pic(m.label)+'<span>'+esc(m.label)+'<small>'+fmt(m.g)+' '+W.food0.unit+'</small></span></button>').join('')+'</div>'
      :'<p>The database has no household measure for this food, so enter the amount:</p><label>Amount ('+W.food0.unit+')<input id="awg" type="number" min="1" max="5000" step="1" inputmode="decimal" value="'+esc(W.g)+'"></label>'}
  const many=s.k==='menu'||measures(W.food0).length;
  return opts+(many?'<div class="row awns" role="group" aria-label="How many">'+NS.map(n=>'<button type="button" class="chip'+(W.n===n?' on':'')+'" data-a="awn" data-v="'+n+'" aria-pressed="'+(W.n===n)+'">'+nt(n)+'</button>').join('')+'</div>':'')
    +'<div id="awcard">'+card()+'</div>'
    +'<label>Name<input id="awname" maxlength="60" value="'+esc(W.name||s.name)+'"></label>'
    +'<label>Meal<select id="awmeal">'+MEALS.map(m=>'<option value="'+m[0]+'"'+((W.meal||S.meal)===m[0]?' selected':'')+'>'+esc(m[1]||m[0])+'</option>').join('')+'</select></label>'
    +'<div class="row"><button type="button" data-a="awsave"'+(calc()?'':' disabled')+'>CONFIRM AND LOG</button><button type="button" class="g" data-a="awback">CHOOSE ANOTHER</button></div>'
    +'<small class="mut">Nothing is saved until you confirm. You can change the name and meal first.</small>'}

/* ---------- him ---------- */
function mood(){if(W.step==='done')return['cast','excited'];if(W.busy)return['walk','determined'];if(W.err||W.unknown)return['side','confused'];
  if(W.step==='guess')return['front','surprised'];
  if(W.step==='pick')return W.menu.length||W.db.length?['three','surprised']:['back','nervous'];if(W.step==='portion')return['front','determined'];return['front','happy']}
function say(){if(W.step==='done')return'Whoa, it worked! I mean... of course it worked. Your food is logged.';
  if(W.busy)return W.step==='portion'?'Reading the measures in the great book...':W.step==='pick'?'Searching my books... give me a second!':'Searching the great web of knowledge...';
  if(W.err)return W.err;if(W.unknown)return'Hmm... that does not sound like a food or a drink to me. Try again?';
  if(W.step==='guess')return'Found it! About '+totals().kcal+' kcal. Check my sources below!';
  if(W.step==='pick')return W.menu.length||W.db.length?'I found these in my books! Which one did you eat?':'Hmm... I could not find that one. Try other words, or type it yourself below.';
  if(W.step==='portion')return'How much did you have? Pick the closest measure.';
  return'Tell me what you ate, how much, and anything extra or left out. I will search for the calories... probably!'}
function scene(){const[p,f]=mood();
  return '<div class="awscene"><img class="awroom" src="'+ROOM+'" alt="" width="336" height="189"><span class="awfig'+(W.step==='done'?' cast':W.busy?' walk':'')+'" aria-hidden="true" data-pose="'+p+'" style="background-position:'+pat(POSES,p)+' 0"></span>'
    +'<div class="awsay" role="status"><span class="awface" role="img" aria-label="The Wannabe Wizard, '+f+'" data-face="'+f+'" style="background-position:'+pat(FACES,f)+' 0"></span><p><b>THE WANNABE WIZARD</b>'+esc(say())+'</p></div></div>'}

/* ---------- the steps ---------- */
function askBox(){const on=signed();
  return '<label for="awq"><b>What did you eat?</b> <small class="mut">Food, portion, and anything extra or left out</small></label>'
    +'<div class="row awq"><input id="awq" type="search" autocomplete="off" maxlength="200" placeholder="e.g. nasi lemak, big plate, extra fried chicken, no sambal" value="'+esc(W.q)+'">'
    +'<button type="button" data-a="awgo"'+(W.busy?' disabled':'')+'>'+'SEARCH'+'</button></div>'
    +'<small class="mut">'+(on?'He searches the web with Google Gemini for real nutrition data, then shows his estimate and his sources.'
      :'Signed out: he searches his books (the Kolej MARA Kulim canteen menu). Sign in so he can search the web for any food.')+'</small>'
    +(W.note2?'<p class="mut awnote">'+esc(W.note2)+'</p>':'')}
function askStep(){return askBox()+(W.busy&&W.step==='ask'?'<p class="mut">Searching for <b>'+esc(W.food)+'</b>... this can take a few seconds.</p>':'')
  +(W.step==='pick'?pickList():'')+(signed()&&!W.busy?'<div class="row"><button type="button" class="g sm" data-a="awsearch">SEARCH MY BOOKS INSTEAD</button></div>':'')}
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(_){return''}};
/** The web estimate: the total, the parts (adjustable), how sure he is, and every source he used. */
function guessCard(){const t=totals(),edit=W.step==='guess',r=W.res||{};
  const rows=W.items.map((it,i)=>{const v=itemVal(it),off=!it.x;
    return '<li class="awpart'+(off?' off':'')+'"><div><b>'+esc(it.label)+'</b><small>'+(off?'left out':v.g?fmt(v.g)+' g':'')+(it.x!==1&&!off?' ('+fmt(it.x)+' × what I found)':'')+'</small></div><span class="awpk">'+(off?'0':Math.round(v.kcal))+' kcal</span>'
      +(edit?'<span class="awadj"><button type="button" class="g sm" data-a="awadj" data-i="'+i+'" data-d="-1" aria-label="Less '+esc(it.label)+'">−</button><button type="button" class="g sm" data-a="awadj" data-i="'+i+'" data-d="1" aria-label="More '+esc(it.label)+'">+</button></span>':'')
      +(off?'':'<small class="awps">P '+fmt(v.p)+' g · C '+fmt(v.c)+' g · F '+fmt(v.f)+' g</small>')+'</li>'}).join('');
  const src=(r.sources||[]).map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title||host(s.url))+'</a></li>').join('');
  return '<div class="awcard awguessc'+(W.step==='done'?' reveal':'')+'" id="awcard"><small>'+esc(r.name||W.food)+(r.portion?' · '+esc(r.portion):'')+'</small><b class="awbig">about '+t.kcal+' kcal</b>'
    +'<table class="awtab"><tbody><tr><th scope="row">Protein</th><td>'+fmt(t.p)+' g</td></tr><tr><th scope="row">Carbohydrate</th><td>'+fmt(t.c)+' g</td></tr><tr><th scope="row">Fat</th><td>'+fmt(t.f)+' g</td></tr></tbody></table>'
    +'<ul class="awparts">'+rows+'</ul>'
    +(r.note?'<p class="mut">'+esc(r.note)+'</p>':'')
    +'<p class="mut awhow"><b>AI estimate</b> by Google Gemini'+(r.searched===false?' from its own knowledge (the web search was not available)':' from web sources')+', not a measurement. How sure: <b>'+esc(r.confidence||'low')+'</b>. It can be wrong: check the sources, and adjust any part with − and +.</p>'
    +(src?'<p class="awsrch"><b>Where he found it</b></p><ul class="awsrcs">'+src+'</ul>':'<p class="mut">No web sources came back for this one.</p>')
    +(r.suggest&&edit?'<iframe class="awsugg" title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="'+esc(r.suggest)+'"></iframe>':'')+'</div>'}
function guessStep(){return askBox()+guessCard()
  +'<label>Name<input id="awname" maxlength="60" value="'+esc(W.name||(W.res&&W.res.name)||W.food)+'"></label>'
  +'<label>Meal<select id="awmeal">'+MEALS.map(m=>'<option value="'+m[0]+'"'+((W.meal||S.meal)===m[0]?' selected':'')+'>'+esc(m[1]||m[0])+'</option>').join('')+'</select></label>'
  +'<div class="row"><button type="button" data-a="awlog"'+(W.items.some(i=>i.x)?'':' disabled')+'>LOG IT</button><button type="button" class="g" data-a="awsearch">SEARCH MY BOOKS INSTEAD</button></div>'
  +'<small class="mut">Nothing is saved until you log it. Not right? Change the words above and search again.</small>'}
function doneStep(){return(W.done&&W.done.est?guessCard():card())+'<div class="row"><button type="button" data-a="awmore">ADD ANOTHER FOOD</button><button type="button" class="g" data-a="awclose">DONE</button></div>'}

function body(){if(W.step==='done')return doneStep();if(W.step==='portion')return portionStep();if(W.step==='guess')return guessStep();return askStep()}
function wizard(){return '<div class="card awcardo" id="awiz"><h3>'+ico('food')+' ADD MORE FOOD</h3>'+scene()+'<div id="awbody">'+body()+'</div></div>'}
function draw(){const el=D.getElementById('awiz');if(!el)return;const f=D.activeElement&&D.activeElement.id;el.outerHTML=wizard();const n=f&&D.getElementById(f);if(n)n.focus()}

/* ---------- actions ---------- */
const keepName=()=>{const n=D.getElementById('awname'),m=D.getElementById('awmeal');if(n)W.name=n.value;if(m)W.meal=m.value};
acts.awgo=()=>{const i=D.getElementById('awq');W.q=i?i.value:W.q;const f=String(W.q||'').trim().slice(0,200);
  if(!f){W.err='Tell me what you ate first, for example: nasi lemak, big plate, no sambal.';draw();return}
  W.food=f;W.err='';W.note2='';if(signed())webSearch();else search()};
acts.awadj=d=>{keepName();const it=W.items[+d.i];if(!it)return;it.x=Math.max(0,Math.min(4,r1(it.x+(+d.d)*.5)));draw()};
acts.awlog=()=>{keepName();const t=totals(),r=W.res;if(!r||!W.items.some(i=>i.x))return;const name=String(W.name||r.name||W.food).trim().slice(0,60)||W.food,meal=W.meal||S.meal;
  const w=HWWhen.stamp({sig:'aw'+name+t.kcal});if(!w)return;
  const parts=W.items.filter(i=>i.x).map(i=>{const v=itemVal(i);return[i.label,v.g==null?null:r1(v.g),Math.round(v.kcal)]});
  add('food',t.kcal,{name,por:r.portion||'Wizard\'s web estimate',qty:1,meal,src:'Wannabe Wizard web search (Google Gemini)',custom:1,db:'est',how:r.searched===false?'ai':'web',g:t.g,
    p:t.miss?'':t.p,c:t.miss?'':t.c,f:t.miss?'':t.f,fb:'',parts,refs:(r.sources||[]).slice(0,5).map(s=>s.url)},'',w.d,w.t,10,'Food logged');
  HWWhen.saved(w,'Food');W.step='done';W.done={est:1};const y=window.scrollY;render();window.scrollTo(0,y)};
// the books
acts.awsearch=()=>{const i=D.getElementById('awq');W.q=i?i.value:W.q;search()};
acts.awback=()=>{W.step=W.q?'pick':'ask';W.sel=null;W.food0=null;W.err='';if(W.step==='pick'){W.menu=menuMatches(W.q)}draw();const i=D.getElementById('awq');if(i)i.focus()};
acts.awpick=async d=>{const k=String(d.k||''),j=+k.slice(1),src=k[0]==='m'?W.menu[j]:W.db[j];if(!src)return;
  W.sel=k[0]==='m'?menuSel(src.name,src.i):{k:'db',name:src.name,id:src.id};W.name=src.name;W.n=1;W.por=0;W.g='';W.err='';W.step='portion';
  if(k[0]==='m'){W.food0=null;draw();return}
  W.busy=1;W.food0=null;draw();
  try{const r=await call({id:src.id});W.food0=r&&r.food&&r.food.per100?r.food:null;if(!W.food0)throw{code:'db'}}
  catch(e){W.err=ERR[e.code]||ERR.db;W.step='pick'}
  W.busy=0;draw()};
acts.awvar=d=>{keepName();if(W.sel&&W.sel.vars&&W.sel.vars[+d.i])setVar(W.sel,+d.i);draw()};
acts.awpor=d=>{keepName();W.por=+d.i;draw()};
acts.awn=d=>{keepName();W.n=+d.v;draw()};
acts.awsave=()=>{keepName();const c=calc();if(!c)return;const name=String(W.name||W.sel.name).trim().slice(0,60)||W.sel.name,meal=W.meal||S.meal;
  const w=HWWhen.stamp({sig:'aw'+name+c.kcal});if(!w)return;
  if(W.sel.k==='menu'){const m=W.sel;add('food',c.kcal,{name,por:m.por,qty:W.n,pm:1,meal,src:'KOLEJ MARA KULIM'},'',w.d,w.t,10,'Food logged')}
  else{const f=W.food0;add('food',c.kcal,{name,por:c.label,qty:1,meal,src:'USDA FoodData Central',custom:1,db:'fdc',fdc:f.id,fdt:f.type,g:c.g,u:f.unit,
    p:c.p==null?'':c.p,c:c.c==null?'':c.c,f:c.f==null?'':c.f,fb:''},'',w.d,w.t,10,'Food logged')}
  HWWhen.saved(w,'Food');W.step='done';W.done=c;
  const y=window.scrollY;render();window.scrollTo(0,y)};
acts.awmore=()=>{reset();draw();const i=D.getElementById('awq');if(i)i.focus()};
acts.awclose=()=>{reset();S.cf=0;render()};
D.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='awq'){e.preventDefault();acts.awgo()}});
D.addEventListener('input',e=>{const t=e.target;if(!t)return;if(t.id==='awq')W.q=t.value;else if(t.id==='awg'){W.g=t.value;const c=D.getElementById('awcard');if(c)c.innerHTML=card();const b=D.querySelector('[data-a="awsave"]');if(b)b.disabled=!calc()}
  else if(t.id==='awname'){W.name=t.value}});
{const o=acts.cf;acts.cf=function(){if(!S.cf)reset();return o.apply(this,arguments)}}
/* ---------- on the Nutrition page: above the original custom form, while ADD MORE FOOD is open ---------- */
{const p=pages.food;pages.food=function(){const h=p.apply(this,arguments);if(!S.cf)return h;const k=h.indexOf('<div class="card"><h3>CUSTOM FOOD</h3>');
  return k<0?h:h.slice(0,k)+wizard()+h.slice(k).replace('<h3>CUSTOM FOOD</h3>','<h3>CUSTOM FOOD</h3><p class="mut awor">Already know the numbers? Type them yourself:</p>')}}
// in the log: a database food and a Wizard's estimate read as such, not as "Custom Food" with values "by you"
{const o=desc;desc=function(e){let h=o.apply(this,arguments);const db=e&&e.c==='food'&&e.m&&e.m.db;if(!db)return h;
  h=h.replace('<span class="badge">Custom Food</span>','<span class="badge">'+(db==='fdc'?'USDA FoodData Central':'Wizard\'s estimate')+'</span>').replace(' <span class="badge">kcal by you</span>','');
  return db==='est'?h.replace('tag m">YOURS','tag e">EST'):h}}
// a Wizard's estimate counts as estimated in the day's macro totals
{const o=emac;emac=function(e){const x=o.apply(this,arguments);return x&&e&&e.m&&e.m.db==='est'?{...x,est:1}:x}}

HWUI.css('addfood',`
.awscene{position:relative;line-height:0;border-radius:14px;overflow:hidden;border:1px solid var(--edge,var(--ln));margin:4px 0 10px;box-shadow:0 0 18px rgba(139,92,240,.3)}
.awscene{aspect-ratio:3/2}.awroom{display:block;width:100%;height:100%;object-fit:cover;image-rendering:pixelated;image-rendering:crisp-edges}
.awfig{position:absolute;left:1%;bottom:1%;height:97%;aspect-ratio:2/3;background:url(${POSE}) no-repeat;background-size:600% 100%;image-rendering:pixelated;image-rendering:crisp-edges;
  filter:drop-shadow(0 0 6px rgba(255,226,122,.45));animation:awbob 1.6s steps(2) infinite alternate}
.awfig.walk{animation:awwalk .5s steps(2) infinite alternate}.awfig.cast{animation:awcast .6s steps(3) 3}
@keyframes awbob{to{translate:0 -2px}}@keyframes awwalk{to{translate:6px -2px}}@keyframes awcast{50%{filter:drop-shadow(0 0 16px #63e6dc)}to{filter:drop-shadow(0 0 4px #fff0a8)}}
.awsay{position:absolute;right:3%;top:5%;max-width:56%;display:flex;gap:6px;align-items:flex-start;line-height:1.35}
.awface{flex:0 0 auto;width:44px;height:44px;background:url(${FACE}) no-repeat;background-size:308px 44px;image-rendering:pixelated;border:2px solid #f6c94f;border-radius:8px;background-color:#1b1745}
.awsay p{margin:0;background:rgba(18,15,51,.88);color:#fff6dc;border:1px solid #f6c94f;border-radius:10px;padding:6px 8px;font-size:13px}.awsay p b{display:block;font:7px/1.6 var(--fh);color:#f6c94f}
@media(max-width:420px){.awsay{flex-direction:column;align-items:flex-end}.awface{width:36px;height:36px;background-size:252px 36px}.awsay p{font-size:12px}}
.awq{flex-wrap:nowrap}.awq input{flex:1 1 auto;min-width:0;margin:0}.awq button{flex:0 0 auto}
.awq+small,label[for="awq"] small{display:block}.awsrcs{margin:4px 0 6px;padding-left:18px;overflow-wrap:anywhere}.awsrcs li{margin:6px 0}.awsrcs a{display:inline-block;min-height:28px;line-height:28px;color:#fff0a8;text-decoration:underline}
.awsugg{display:block;width:100%;height:76px;border:0;border-radius:10px;background:#fff;margin-top:6px}.awhow{margin-top:8px}
.awcard{border:2px solid #f6c94f;border-radius:14px;padding:10px;margin:10px 0;background-color:var(--p2);box-shadow:0 0 16px rgba(246,201,79,.25)}.awcard>b{display:block}.awcard>small{color:var(--mut)}
.awbig{font-size:26px;margin:2px 0}
.awparts{list-style:none;padding:0;margin:8px 0}.awpart{display:grid;grid-template-columns:1fr auto auto;gap:4px 8px;align-items:center;padding:6px 0;border-top:1px solid var(--edge,var(--ln))}
.awpart>div small{display:block;color:var(--mut)}.awpart.off{opacity:.55}.awpk{font-weight:bold;white-space:nowrap}.awadj{display:flex;gap:4px}.awadj button{min-width:44px;min-height:44px;margin:0;padding:0 10px}
.awps{grid-column:1/-1;color:var(--mut);font-size:12px;overflow-wrap:anywhere}
.awcard.reveal{animation:awreveal .7s steps(4) both}@keyframes awreveal{from{transform:scale(.6) rotate(-6deg);opacity:0;box-shadow:0 0 40px #63e6dc}}
.awlist{list-style:none;margin:8px 0;padding:0}.awres{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;margin:4px 0;min-height:44px}.awres small{color:var(--mut);font-weight:normal}
.awms{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:6px 0}.awm{display:flex;gap:6px;align-items:center;text-align:left;min-height:52px}.awm small{display:block;color:inherit;opacity:.85}
.awpic{flex:0 0 auto;image-rendering:pixelated;shape-rendering:crispEdges}.awns .chip{flex:1 1 0;min-height:44px}
.awtab{width:100%;border-collapse:collapse;margin:6px 0}.awtab th,.awtab td{text-align:left;padding:4px;border-top:1px solid var(--edge,var(--ln))}.awsrc{overflow-wrap:anywhere}
.awor{margin:0 0 6px}#awiz label{display:block;margin:6px 0}#awiz select,#awiz input{width:100%}#awiz .awq input{width:auto}
html.hw-rm .awfig,html.hw-rm .awcard.reveal,html.hw-q-performance .awfig,html.hw-q-performance .awcard.reveal{animation:none}
@media(prefers-reduced-motion:reduce){.awfig,.awcard.reveal{animation:none}}
`);
return{menuMatches,measures,calc,kind,totals,get state(){return JSON.parse(JSON.stringify(W))},POSES,FACES}})();
