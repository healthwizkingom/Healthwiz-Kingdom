/* v6: Add More Food, guided by Luke, the apprentice (first called the Wannabe Wizard; the owner renamed him Luke on
   2026-10-14). Not part of the original.
   Master prompt "Nutrition modification", reworked at the owner's request (2026-10-14): a search engine that knows the
   calories and macros of any food, any portion, any add-on or removal, from solid, cited references.
   ADD MORE FOOD on the Nutrition page opens the wizard above the original custom-food form, which stays as it was (type
   it yourself; one SAVE CUSTOM FOOD click still saves).
   * Luke, from the owner's character design sheets of 2026-10-15 (tools/art/make_luke.py), every part of them used:
     all 22 figures (luke-poses.webp, 120 x 180: the four views, walking, casting, reading, inspecting a potion, waving,
     resting and the twelve expressions), the twelve expression heads (luke-faces.webp: happy, confused, nervous,
     determined, surprised, tired, excited, curious, thinking, laughing, sad, annoyed), the PROPS and the ROUND PORTRAIT
     (luke-props.webp: books, notes, wand, backpack, scrolls, potion, portrait) and his painted room (luke-room.webp).
     Meet Luke (Settings) steps through every figure and shows his things. The waiting pose is happy. He reacts to what happens (director() below), in CSS only:
       - waiting: happy; after 30 s of no input he is resting, tired; as you type he turns three-quarter to listen
         (surprised, then determined once you give detail) with his notes out;
       - searching: he turns all the way round through the angles (walking, three-quarter, side, back, and back again)
         with the books circling, determined;
       - a good, cited answer: excited (casting once it is logged), hopping, potion; a middling one: inspecting the
         potion, surprised, notes; a low-confidence one: nervous, swaying, backpack; one with a part whose numbers do
         not add up: confused, tilting, scrolls; not a food: curious; an error: sad, backpack; nothing found: back turned,
         nervous; found on the canteen menu: reading his spellbook; asking the portion: thinking;
       - the − and + buttons: determined, a flick of the wand; logged: casting, excited, hopping, potion.
     Still under reduced motion or the Performance mode (he holds the pose and the expression, nothing moves).
   * 1. One box: what you ate, in your words, with the portion and anything extra or left out ("nasi lemak, big plate,
     extra fried chicken, no sambal").
   * 2. Signed in, he searches the web: Google Gemini with Grounding with Google Search, through the food-guess Edge
     Function (supabase/functions/food-guess; the key stays on the server). It returns the parts of the meal, each with
     weight, kcal, protein, carbohydrate and fat, the NAME OF THE SOURCE it took them from and the arithmetic behind them
     ("per 100 g × grams"), plus the web pages it used and Google's search suggestions. A part with no source is shown as
     his own estimate. The function also checks every part: kcal against 4 × protein + 4 × carbohydrate + 9 × fat, and
     flags a part that is far off. The card labels the result an AI estimate from web sources, not a measurement;
     − and + change any part by half its amount.
   * 3. Signed out, offline, or when the web search fails, he can only look at the Kolej MARA Kulim canteen menu already in
     the app (Dewan Selera 2022: kcal per stated portion; macros are the existing estMac estimate, labelled).
   * 4. Nothing is saved until LOG IT (or CONFIRM AND LOG for a canteen dish). A web estimate is saved as a custom food with
     the macros, db: 'est', the parts [label, g, kcal, source] and up to five source links; the log shows "Wizard's
     estimate" and its macros count as estimated (EST). */
const HWAddFood=(()=>{
const D=document,ico=(n,s)=>HWPixel.icon(n,s||1);
const POSE='assets/img/luke-poses.webp',FACE='assets/img/luke-faces.webp',PROPS='assets/img/luke-props.webp',ROOM='assets/img/luke-room.webp';
const PROPN=['books','notes','wand','backpack','scrolls','potion','portrait'];   // luke-props.webp, 40 x 40 tiles
const PROPNAME={books:'Spellbooks',notes:'Magical notes',wand:'Wand',backpack:'Backpack',scrolls:'Scrolls',potion:'Potion',portrait:'Round portrait'};
const POSES=['front','three','side','back','walk','cast','read','inspect','wave','rest','happy','confused','nervous','determined','surprised','tired','excited','curious','think','laugh','sad','annoyed'];   // luke-poses.webp, in this order
const FACES=['happy','confused','nervous','determined','surprised','tired','excited','curious','thinking','laughing','sad','annoyed'];   // luke-faces.webp, in this order
// the owner's expression sheets (2026-10-27), cut head to waist by tools/art/make_luke_hires.py: the twelve expression poses show these (about four times
// the detail of the pixel figures) in the scene; the other ten poses and Meet Luke keep the pixel figures. luke-hires-1: the first six faces, -2: the rest.
const HIRES=['assets/img/luke-hires-1.webp','assets/img/luke-hires-2.webp'],HIFACE={happy:'happy',confused:'confused',nervous:'nervous',determined:'determined',surprised:'surprised',tired:'tired',excited:'excited',curious:'curious',think:'thinking',sad:'sad',annoyed:'annoyed'};
const POSENAME={front:'Front view',three:'Three-quarter view',side:'Side view',back:'Back view',walk:'Walking',cast:'Casting a spell',read:'Reading his spellbook',inspect:'Inspecting a potion',wave:'Waving hello',rest:'Resting',happy:'Happy',confused:'Confused',nervous:'Nervous',determined:'Determined',surprised:'Surprised',tired:'Tired',excited:'Excited',curious:'Curious',think:'Thinking',laugh:'Laughing',sad:'Sad',annoyed:'Annoyed'};
const pat=(L,k)=>(L.indexOf(k)/(L.length-1)*100).toFixed(4)+'%';
const r1=v=>Math.round(v*10)/10,fmt=v=>v==null?'–':(Math.round(v*10)/10).toLocaleString(undefined,{maximumFractionDigits:1});

/* ---------- the wizard's state, for this visit only ---------- */
// step: ask (what did you eat?) | guess (his web estimate) | pick, portion (the canteen menu) | done
const W0=()=>({fx:null,tired:0,sk:'',step:'ask',food:'',res:null,items:[],unknown:0,note2:'',
  q:'',busy:0,err:'',menu:[],sel:null,n:1,name:'',meal:'',done:null});
const W=W0(),reset=()=>{clearTimeout(tt);clearTimeout(ft);Object.assign(W,W0())};
const CL=()=>typeof HWCloud!=='undefined'?HWCloud:null,signed=()=>{const c=CL();return!!(c&&c.who())};

/* ---------- 1. his search: Gemini with Google Search, through the food-guess Edge Function ---------- */
const AIERR={offline:'You are offline, so I cannot search the web.',nokey:'My web search is not set up on the server yet.',
  busy:'The web search is busy right now.',limit:'That is a lot of searching for one hour!',ai:'My web search came back muddled.',signin:'Sign in so I can search the web for any food.'};
async function ball(){const c=CL();if(!c||!c.who())throw{code:'signin'};if(navigator.onLine===false)throw{code:'offline'};
  try{return await c.api('/functions/v1/food-guess',{method:'POST',body:{food:W.food},ms:45000})}
  catch(e){const b=e.body||{};throw{code:e.code==='net'?'offline':e.status===401||e.code==='auth'?'signin':e.status===429?'limit':b.error==='nokey'||e.code==='setup'?'nokey':b.error==='busy'?'busy':'ai'}}}
async function webSearch(){W.busy=1;W.err='';W.unknown=0;W.note2='';W.step='ask';draw();
  try{const r=await ball();W.busy=0;
    if(r&&r.result&&Array.isArray(r.result.items)&&r.result.items.length){W.res=r.result;W.items=r.result.items.map(i=>({label:i.label,x:1,v:i}));W.name='';W.step='guess'}
    else if(r&&r.unknown)W.unknown=1;
    else throw{code:'ai'}
    draw()}
  catch(e){W.busy=0;W.note2=(AIERR[e.code]||AIERR.ai)+' I can still look at the canteen menu.';search()}}
/** One part's values after the player's adjustment (x: 0 to 4 times what he found). */
function itemVal(it){const v=it.v,x=it.x,m=k=>v[k]==null?null:v[k]*x;return{g:v.g==null?null:v.g*x,kcal:v.kcal*x,p:m('p'),c:m('c'),f:m('f'),na:m('na'),k:m('k'),mg:m('mg')}}
// sodium, potassium and magnesium (mg): a total only when a part gave the number; null means no source had it
const MINERALS=['na','k','mg'];
function totals(){const t={kcal:0,p:0,c:0,f:0,g:0,miss:0,na:0,k:0,mg:0,seen:{}};W.items.forEach(it=>{if(!it.x)return;const v=itemVal(it);t.kcal+=v.kcal;['p','c','f'].forEach(k=>{if(v[k]==null)t.miss=1;else t[k]+=v[k]});if(v.g)t.g+=v.g;
  MINERALS.forEach(k=>{if(v[k]!=null){t[k]+=v[k];t.seen[k]=1}})});
  t.kcal=Math.round(t.kcal);['p','c','f','g'].forEach(k=>t[k]=r1(t[k]));MINERALS.forEach(k=>t[k]=t.seen[k]?Math.round(t[k]):null);return t}

/* ---------- 2. the canteen menu (offline, signed out, or when the web search is unavailable) ---------- */
// The Kolej MARA Kulim menu already in the app (Dewan Selera 2022): kcal per stated portion; macros are the existing estMac estimate.
const words=q=>String(q||'').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
function menuMatches(q){const w=words(q);if(!w.length)return[];
  return F.map((f,i)=>({f,i})).filter(x=>x.f[2]!=null&&w.every(s=>x.f[0].toLowerCase().includes(s))).slice(0,8).map(x=>({k:'menu',i:x.i,name:x.f[0],por:x.f[1],kcal:+x.f[2]}))}
function search(){W.err='';W.step='pick';W.menu=menuMatches(W.q);draw()}
function pickList(){
  return (W.menu.length?'<p class="mut">Kolej MARA Kulim canteen menu (2022), the dishes of the Dewan Selera:</p>':'')
    +'<ul class="awlist">'+W.menu.map((m,j)=>'<li><button type="button" class="g awres" data-a="awpick" data-k="m'+j+'"><b>'+esc(m.name)+'</b><small>Kolej MARA Kulim canteen menu (2022) · '+esc(m.por)+' · '+m.kcal+' kcal</small></button></li>').join('')+'</ul>'}
/** A canteen dish as chosen: every listing of that name is a portion option; i is the listing picked first. */
function menuSel(name,i){const vars=[];F.forEach((f,j)=>{if(f[2]!=null&&f[0].toLowerCase()===String(name).toLowerCase()&&!vars.some(v=>v.por===f[1]&&v.kcal===+f[2]))vars.push({i:j,por:f[1],kcal:+f[2]})});
  if(!vars.length)vars.push({i,por:F[i][1],kcal:+F[i][2]});const v=Math.max(0,vars.findIndex(x=>x.i===i));return setVar({k:'menu',name:F[vars[0].i][0],vars,v},v)}
const setVar=(s,v)=>Object.assign(s,{v,por:s.vars[v].por,kcal:s.vars[v].kcal});
const NS=[.5,1,1.5,2,3],nt=n=>n===.5?'½':n===1.5?'1½':String(n);
/** The values for the chosen canteen dish and amount: {kcal, p, c, f, label} or null. */
function calc(){if(!W.sel)return null;const m=W.sel,k=Math.round(m.kcal*W.n),x=typeof estMac==='function'?estMac(m.name,k):null;
  const mn=m.mn||{},sc=v=>v==null?null:Math.round(v*W.n);
  return{kcal:k,p:x?x.p:null,c:x?x.c:null,f:x?x.f:null,na:sc(mn.na),k:sc(mn.k),mg:sc(mn.mg),mnsrc:mn.src||'',mnbusy:!!m.mnbusy,label:nt(W.n)+' × '+m.por,menu:1}}
/** Luke looks up sodium, potassium and magnesium for one canteen dish with the same search as the macros (food-guess), with the sources he used. Null when he cannot search. */
async function mineralsFor(name,por){const c=CL();if(!c||!c.who()||navigator.onLine===false)return null;
  try{const r=await c.api('/functions/v1/food-guess',{method:'POST',body:{food:name+', '+por+' (one serving)'},ms:45000});
    const items=r&&r.result&&Array.isArray(r.result.items)?r.result.items:[];
    const sum=k=>{const v=items.filter(i=>i[k]!=null);return v.length?Math.round(v.reduce((a,i)=>a+i[k],0)):null};
    const src=[...new Set(items.filter(i=>i.src).map(i=>i.src))].join('; ');
    return{na:sum('na'),k:sum('k'),mg:sum('mg'),src}}
  catch(e){return null}}
/** One mineral row: the amount in mg; while Luke is still looking, or when no verified source had the number, it says so (never a made-up number). */
const mineralRow=(name,v,busy)=>'<tr><th scope="row">'+name+'</th><td>'+(v!=null?fmt(v)+' mg':busy?'<span class="mut">looking up…</span>':'<span class="mut">no verified source found</span>')+'</td></tr>';
function card(){const c=calc();if(!c)return '<p class="mut">Choose an amount to see the values.</p>';
  const row=(n,v,unit)=>'<tr><th scope="row">'+n+'</th><td>'+(v==null?'<span class="mut">not available</span>':fmt(v)+' '+unit)+'</td></tr>';
  const mrows=[['Sodium',c.na],['Potassium',c.k],['Magnesium',c.mg]].map(([n,v])=>mineralRow(n,v,c.mnbusy)).join('');
  return '<div class="awcard'+(W.step==='done'?' reveal':'')+'"><b>'+esc(W.name||W.sel.name)+'</b><small>'+esc(c.label)+'</small><table class="awtab"><tbody>'+row('Energy',c.kcal,'kcal')+row('Protein',c.p,'g')+row('Carbohydrate',c.c,'g')+row('Fat',c.f,'g')+mrows+'</tbody></table>'
    +'<p class="mut">kcal = '+W.sel.kcal+' kcal per portion × '+nt(W.n)+' = '+c.kcal+' kcal (Kolej MARA Kulim canteen menu, 2022). Protein, carbohydrate and fat are <b>HealthWiz estimates</b> from the dish type, not measured.</p>'
    +(c.mnsrc?'<p class="mut">Minerals: AI estimate by Google Gemini from web sources: '+esc(c.mnsrc)+'.</p>':'')+'</div>'}
function portionStep(){const s=W.sel;
  const opts=s.vars.length>1?'<p>The canteen menu lists this dish '+s.vars.length+' times. Which one was it?</p><div class="awms" role="group" aria-label="Canteen portion">'
      +s.vars.map((x,i)=>'<button type="button" class="chip awm'+(s.v===i?' on':'')+'" data-a="awvar" data-i="'+i+'" aria-pressed="'+(s.v===i)+'"><span>'+esc(x.por)+'<small>'+x.kcal+' kcal</small></span></button>').join('')+'</div>'
    :'<p>One portion on the menu: <b>'+esc(s.por)+'</b></p>';
  return opts+'<div class="row awns" role="group" aria-label="How many">'+NS.map(n=>'<button type="button" class="chip'+(W.n===n?' on':'')+'" data-a="awn" data-v="'+n+'" aria-pressed="'+(W.n===n)+'">'+nt(n)+'</button>').join('')+'</div>'
    +'<div id="awcard">'+card()+'</div>'
    +'<label>Name<input id="awname" maxlength="60" value="'+esc(W.name||s.name)+'"></label>'
    +'<label>Meal<select id="awmeal">'+MEALS.map(m=>'<option value="'+m[0]+'"'+((W.meal||S.meal)===m[0]?' selected':'')+'>'+esc(m[1]||m[0])+'</option>').join('')+'</select></label>'
    +'<div class="row"><button type="button" data-a="awsave"'+(calc()?'':' disabled')+'>CONFIRM AND LOG</button><button type="button" class="g" data-a="awback">CHOOSE ANOTHER</button></div>'
    +'<small class="mut">Nothing is saved until you confirm. You can change the name and meal first.</small>'}

/* ---------- him: Luke ---------- */
let tt=0,ft=0;   // timers: tired after 30 s of no input; the typing and wand reactions last a moment
/** What he does for what just happened: an angle (pose), an expression (face), a motion (fx, CSS) and an item he has out. */
function director(){const bad=W.step==='guess'&&W.items.some(i=>i.v&&i.v.chk),conf=(W.res&&W.res.confidence)||'low',fx=W.fx&&W.fx.k;
  if(W.step==='done')return{pose:'cast',face:'excited',fx:'hop',prop:'potion'};
  if(W.busy)return{pose:'back',face:'determined',fx:'turn',prop:'books'};            // turns all the way round; 'back' is his still pose
  if(W.err)return{pose:'sad',face:'sad',fx:'sway',prop:'backpack'};
  if(W.unknown)return{pose:'curious',face:'curious',fx:'tilt',prop:'notes'};
  if(W.step==='guess'){if(fx==='adj')return{pose:'determined',face:'determined',fx:'hop',prop:'wand'};
    if(bad)return{pose:'confused',face:'confused',fx:'tilt',prop:'scrolls'};
    if(conf==='high')return{pose:'excited',face:'excited',fx:'hop',prop:'potion'};
    if(conf==='medium')return{pose:'inspect',face:'surprised',fx:'bob',prop:'notes'};
    return{pose:'nervous',face:'nervous',fx:'sway',prop:'backpack'}}
  if(W.step==='pick')return W.menu.length?{pose:'read',face:'surprised',fx:'bob',prop:'books'}:{pose:'back',face:'nervous',fx:'sway',prop:'backpack'};
  if(W.step==='portion')return{pose:'think',face:'thinking',fx:'bob',prop:'notes'};
  if(fx==='type')return{pose:'three',face:W.q.length<12?'surprised':'determined',fx:'lean',prop:'notes'};
  if(W.tired)return{pose:'rest',face:'tired',fx:'sway',prop:''};
  return{pose:'happy',face:'happy',fx:'bob',prop:''}}
const mood=()=>{const m=director();return[m.pose,m.face]};
function say(){if(W.step==='done')return'Whoa, it worked! I mean... of course it worked. Your food is logged.';
  if(W.busy)return'Searching the great web of knowledge... one moment!';
  if(W.err)return W.err;if(W.unknown)return'Hmm... that does not sound like a food or a drink to me. Try again?';
  if(W.step==='guess'){const m=director();
    if(W.fx&&W.fx.k==='adj')return'Changing the amount... about '+totals().kcal+' kcal now!';
    if(m.face==='confused')return'Hmm, some numbers do not add up. Check the marked parts!';
    if(m.face==='nervous')return'Not so sure... about '+totals().kcal+' kcal. Check my sources!';
    if(m.face==='surprised')return'About '+totals().kcal+' kcal! I think that is close. Check my sources!';
    return'Found it, with sources! About '+totals().kcal+' kcal. Check them below!'}
  if(W.step==='pick')return W.menu.length?'I found these on the canteen menu! Which one did you eat?':'Nothing like that on the menu. Sign in so I can search the web!';
  if(W.step==='portion')return'How much did you have? Pick the closest amount.';
  if(W.fx&&W.fx.k==='type')return W.q.length<12?'Ooh, go on... I am listening!':'Ah, I am taking notes. Press search when you are ready!';
  if(W.tired)return'Yaaawn... still here! Tell me what you ate whenever you are ready.';
  return'Hi, I am Luke! Tell me what you ate, how much, and any extras. I will find the calories... probably!'}
/** the figure: the owner's detailed art for the twelve expressions, the pixel figure for the other poses */
function fig(p,fx){const k=FACES.indexOf(HIFACE[p]);
  if(k>=0)return '<span class="awfig hi '+fx+'" aria-hidden="true" data-pose="'+p+'" data-fx="'+fx+'" style="background-image:url('+HIRES[k>5?1:0]+');--hx:'+k%6+'"></span>';
  return '<span class="awfig '+fx+'" aria-hidden="true" data-pose="'+p+'" data-fx="'+fx+'" style="background-position:'+pat(POSES,p)+' 0"></span>'}
function scene(){const m=director(),p=m.pose,f=m.face,pr=m.prop;
  return '<div class="awscene"><img class="awroom" src="'+ROOM+'" alt="" width="640" height="358">'+fig(p,m.fx)
    +(pr?'<span class="awprop '+(pr==='books'&&W.busy?'orbit':pr==='wand'?'flick':'')+'" aria-hidden="true" data-prop="'+pr+'" style="background-position:'+(-PROPN.indexOf(pr)*40)+'px 0"></span>':'')
    +'<div class="awsay" role="status"><span class="awface" role="img" aria-label="Luke, '+f+'" data-face="'+f+'" style="background-position:'+pat(FACES,f)+' 0"></span><p><b>LUKE</b>'+esc(say())+'</p></div></div>'}
/** Updates only his scene (not the inputs, so typing keeps its cursor) when what he does or says has changed. */
function patch(){const key=JSON.stringify(director())+say();if(key===W.sk)return;W.sk=key;const el=D.querySelector('#awiz .awscene');if(el)el.outerHTML=scene()}
/* ---------- Meet Luke (Settings): the design sheets' figures one at a time, the four views included, and his things ---------- */
const MEET={i:0};
const meetCap=p=>'<b>'+POSENAME[p]+'</b> <span class="mut">'+(POSES.indexOf(p)+1)+' of '+POSES.length+'</span>';
const meet=()=>{const p=POSES[MEET.i];
  return '<div class="card" id="awmeet"><h3>MEET LUKE</h3><p class="mut">Every pose from his design sheets. Luke guides Add More Food on the Nutrition page.</p>'
    +'<div class="awmst"><span class="awmfig" role="img" aria-label="Luke" data-pose="'+p+'" style="background-position:'+pat(POSES,p)+' 0"></span></div>'
    +'<p class="awmcap" aria-live="polite">'+meetCap(p)+'</p>'
    +'<div class="row"><button type="button" class="sm" data-a="awmeet" data-d="-1" aria-label="Previous pose">PREV</button><button type="button" class="sm" data-a="awmeet" data-d="1" aria-label="Next pose">NEXT</button></div>'
    +'<p class="mut awmt">His things</p><ul class="awprops">'+PROPN.map((n,i)=>'<li><span class="awmprop" role="img" aria-label="'+PROPNAME[n]+'" data-prop="'+n+'" style="background-position:'+(-i*80)+'px 0"></span><small>'+PROPNAME[n]+'</small></li>').join('')+'</ul></div>'};
acts.awmeet=d=>{MEET.i=(MEET.i+(+d.d)+POSES.length)%POSES.length;const m=D.getElementById('awmeet');if(!m)return;const p=POSES[MEET.i],f=m.querySelector('.awmfig');f.dataset.pose=p;f.style.backgroundPosition=pat(POSES,p)+' 0';m.querySelector('.awmcap').innerHTML=meetCap(p)};
{const o=pages.set;pages.set=(...a)=>{const h=o(...a),k='<h2>⚙️ SETTINGS</h2>';return h.indexOf(k)>=0?h.replace(k,k+meet()):h+meet()}}
/** After 30 s with nothing happening he gets tired. */
function rest(){clearTimeout(tt);if(W.step==='ask'&&!W.busy&&!W.tired)tt=setTimeout(()=>{if(W.step==='ask'&&!W.busy&&D.getElementById('awiz')){W.tired=1;if(!(W.fx&&W.fx.k==='type'))patch()}},30000)}
const fxFor=(k,ms)=>{W.fx={k};clearTimeout(ft);ft=setTimeout(()=>{if(W.fx&&W.fx.k===k){W.fx=null;patch()}},ms)};

/* ---------- the steps ---------- */
function askBox(){const on=signed();
  return '<label for="awq"><b>What did you eat?</b> <small class="mut">Food, portion, and anything extra or left out</small></label>'
    +'<div class="row awq"><input id="awq" type="search" autocomplete="off" maxlength="200" placeholder="e.g. nasi lemak, big plate, extra fried chicken, no sambal" value="'+esc(W.q)+'">'
    +'<button type="button" data-a="awgo"'+(W.busy?' disabled':'')+'>SEARCH</button></div>'
    +'<small class="mut">'+(on?'He searches the web with Google Gemini for real nutrition data, then shows his estimate and his sources.'
      :'Signed out: he can only look at the Kolej MARA Kulim canteen menu. Sign in so he can search the web for any food.')+'</small>'
    +(W.note2?'<p class="mut awnote">'+esc(W.note2)+'</p>':'')}
function askStep(){return askBox()+(W.busy&&W.step==='ask'?'<p class="mut">Searching for <b>'+esc(W.food)+'</b>... this can take a few seconds.</p>':'')
  +(W.step==='pick'?pickList():'')+(signed()&&!W.busy&&W.step==='ask'?'<div class="row"><button type="button" class="g sm" data-a="awsearch">SEARCH THE CANTEEN MENU</button></div>':'')}
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch(_){return''}};
/** The web estimate: the total, the parts (adjustable), how sure he is, and every source he used. */
function guessCard(){const t=totals(),edit=W.step==='guess',r=W.res||{};
  const rows=W.items.map((it,i)=>{const v=itemVal(it),off=!it.x;
    return '<li class="awpart'+(off?' off':'')+'"><div><b>'+esc(it.label)+'</b><small>'+(off?'left out':v.g?fmt(v.g)+' g':'')+(it.x!==1&&!off?' ('+fmt(it.x)+' × what I found)':'')+'</small></div><span class="awpk">'+(off?'0':Math.round(v.kcal))+' kcal</span>'
      +(edit?'<span class="awadj"><button type="button" class="g sm" data-a="awadj" data-i="'+i+'" data-d="-1" aria-label="Less '+esc(it.label)+'">−</button><button type="button" class="g sm" data-a="awadj" data-i="'+i+'" data-d="1" aria-label="More '+esc(it.label)+'">+</button></span>':'')
      +(off?'':'<small class="awps">P '+fmt(v.p)+' g · C '+fmt(v.c)+' g · F '+fmt(v.f)+' g</small>'
        +'<small class="awps awref">'+(it.v.src?'Source: <b>'+esc(it.v.src)+'</b>':'<b>No source found: his own estimate</b>')+(it.v.basis?'. '+esc(it.v.basis):'')+'</small>'
        +(it.v.chk?'<small class="awps awwarn">Check this one: its calories do not match its protein, carbohydrate and fat (4 × P + 4 × C + 9 × F = '+Math.round(4*(it.v.p||0)+4*(it.v.c||0)+9*(it.v.f||0))+' kcal).</small>':''))+'</li>'}).join('');
  const nosrc=W.items.filter(i=>i.x&&!i.v.src).length;
  const src=(r.sources||[]).map(s=>'<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">'+esc(s.title||host(s.url))+'</a></li>').join('');
  return '<div class="awcard awguessc'+(W.step==='done'?' reveal':'')+'" id="awcard"><small>'+esc(r.name||W.food)+(r.portion?' · '+esc(r.portion):'')+'</small><b class="awbig">about '+t.kcal+' kcal</b>'
    +'<table class="awtab"><tbody><tr><th scope="row">Protein</th><td>'+fmt(t.p)+' g</td></tr><tr><th scope="row">Carbohydrate</th><td>'+fmt(t.c)+' g</td></tr><tr><th scope="row">Fat</th><td>'+fmt(t.f)+' g</td></tr>'+MINERALS.map((k,i)=>mineralRow(['Sodium','Potassium','Magnesium'][i],t[k])).join('')+'</tbody></table>'
    +'<ul class="awparts">'+rows+'</ul>'
    +(r.note?'<p class="mut">'+esc(r.note)+'</p>':'')
    +'<p class="mut awhow"><b>AI estimate</b> by Google Gemini'+(r.searched===false?' from its own knowledge (the web search was not available)':' from web sources')+', not a measurement. How sure: <b>'+esc(r.confidence||'low')+'</b>.'+(nosrc?' '+nosrc+' part'+(nosrc>1?'s have':' has')+' no source and '+(nosrc>1?'are':'is')+' his own estimate.':'')+' It can be wrong: check the sources, and adjust any part with − and +.</p>'
    +(src?'<p class="awsrch"><b>Where he found it</b></p><ul class="awsrcs">'+src+'</ul>':'<p class="mut">No web sources came back for this one.</p>')
    +(r.suggest&&edit?'<iframe class="awsugg" title="Google Search suggestions" sandbox="allow-popups allow-popups-to-escape-sandbox" srcdoc="'+esc(r.suggest)+'"></iframe>':'')+'</div>'}
function guessStep(){return askBox()+guessCard()
  +'<label>Name<input id="awname" maxlength="60" value="'+esc(W.name||(W.res&&W.res.name)||W.food)+'"></label>'
  +'<label>Meal<select id="awmeal">'+MEALS.map(m=>'<option value="'+m[0]+'"'+((W.meal||S.meal)===m[0]?' selected':'')+'>'+esc(m[1]||m[0])+'</option>').join('')+'</select></label>'
  +'<div class="row"><button type="button" data-a="awlog"'+(W.items.some(i=>i.x)?'':' disabled')+'>LOG IT</button><button type="button" class="g" data-a="awsearch">SEARCH THE CANTEEN MENU</button></div>'
  +'<small class="mut">Nothing is saved until you log it. Not right? Change the words above and search again.</small>'}
function doneStep(){return(W.done&&W.done.est?guessCard():card())+'<div class="row"><button type="button" data-a="awmore">ADD ANOTHER FOOD</button><button type="button" class="g" data-a="awclose">DONE</button></div>'}

function body(){if(W.step==='done')return doneStep();if(W.step==='portion')return portionStep();if(W.step==='guess')return guessStep();return askStep()}
function wizard(){return '<div class="card awcardo" id="awiz"><h3 class="awh"><span>'+ico('food')+' ADD MORE FOOD</span><span class="awav" role="img" aria-label="Luke"></span></h3>'+scene()+'<div id="awbody">'+body()+'</div></div>'}
function draw(){const el=D.getElementById('awiz');if(!el)return;const f=D.activeElement&&D.activeElement.id;W.sk=JSON.stringify(director())+say();el.outerHTML=wizard();const n=f&&D.getElementById(f);if(n)n.focus();rest()}

/* ---------- actions ---------- */
const keepName=()=>{const n=D.getElementById('awname'),m=D.getElementById('awmeal');if(n)W.name=n.value;if(m)W.meal=m.value};
acts.awgo=()=>{const i=D.getElementById('awq');W.q=i?i.value:W.q;const f=String(W.q||'').trim().slice(0,200);
  if(!f){W.err='Tell me what you ate first, for example: nasi lemak, big plate, no sambal.';draw();return}
  W.food=f;W.err='';W.note2='';if(signed())webSearch();else{W.note2='Sign in so I can search the web for any food. Here is the canteen menu.';search()}};
acts.awadj=d=>{keepName();const it=W.items[+d.i];if(!it)return;it.x=Math.max(0,Math.min(4,r1(it.x+(+d.d)*.5)));fxFor('adj',1500);draw()};
acts.awlog=()=>{keepName();const t=totals(),r=W.res;if(!r||!W.items.some(i=>i.x))return;const name=String(W.name||r.name||W.food).trim().slice(0,60)||W.food,meal=W.meal||S.meal;
  const w=HWWhen.stamp({sig:'aw'+name+t.kcal});if(!w)return;
  const parts=W.items.filter(i=>i.x).map(i=>{const v=itemVal(i);return[i.label,v.g==null?null:r1(v.g),Math.round(v.kcal),i.v.src||'']});
  add('food',t.kcal,{name,por:r.portion||'Wizard\'s web estimate',qty:1,meal,src:'Luke web search (Google Gemini)',custom:1,db:'est',how:r.searched===false?'ai':'web',g:t.g,
    p:t.miss?'':t.p,c:t.miss?'':t.c,f:t.miss?'':t.f,na:t.na,k:t.k,mg:t.mg,fb:'',parts,refs:(r.sources||[]).slice(0,5).map(s=>s.url)},'',w.d,w.t,10,'Food logged');
  HWWhen.saved(w,'Food');W.step='done';W.done={est:1};const y=window.scrollY;render();window.scrollTo(0,y)};
// the canteen menu
acts.awsearch=()=>{const i=D.getElementById('awq');W.q=i?i.value:W.q;search()};
acts.awback=()=>{W.step=W.q?'pick':'ask';W.sel=null;W.err='';if(W.step==='pick')W.menu=menuMatches(W.q);draw();const i=D.getElementById('awq');if(i)i.focus()};
acts.awpick=d=>{const j=+String(d.k||'').slice(1),src=W.menu[j];if(!src)return;W.sel=menuSel(src.name,src.i);W.name=src.name;W.n=1;W.err='';W.step='portion';draw();fetchMinerals(W.sel)};
/** Luke's own search for a dish's minerals, started when the dish is picked: nothing is asked of the player. */
function fetchMinerals(sel){if(!signed())return;sel.mnbusy=true;draw();
  const key=sel.name+'|'+sel.por;sel.mnkey=key;
  mineralsFor(sel.name,sel.por).then(mn=>{if(sel.mnkey!==key)return;sel.mnbusy=false;sel.mn=mn||{};if(W.sel===sel)draw()})}
acts.awvar=d=>{keepName();if(W.sel&&W.sel.vars&&W.sel.vars[+d.i])setVar(W.sel,+d.i);draw()};
acts.awn=d=>{keepName();W.n=+d.v;draw()};
acts.awsave=()=>{keepName();const c=calc();if(!c)return;const name=String(W.name||W.sel.name).trim().slice(0,60)||W.sel.name,meal=W.meal||S.meal;
  const w=HWWhen.stamp({sig:'aw'+name+c.kcal});if(!w)return;
  const m=W.sel;add('food',c.kcal,{name,por:m.por,qty:W.n,pm:1,meal,src:'KOLEJ MARA KULIM',na:c.na,k:c.k,mg:c.mg,mnsrc:c.mnsrc},'',w.d,w.t,10,'Food logged');
  HWWhen.saved(w,'Food');W.step='done';W.done=c;
  const y=window.scrollY;render();window.scrollTo(0,y)};
acts.awmore=()=>{reset();draw();const i=D.getElementById('awq');if(i)i.focus()};
acts.awclose=()=>{reset();S.cf=0;render()};
D.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='awq'){e.preventDefault();acts.awgo()}});
D.addEventListener('input',e=>{const t=e.target;if(!t)return;if(t.id==='awq'){W.q=t.value;W.tired=0;if(W.step==='ask'&&!W.busy){if(t.value.trim())fxFor('type',1800);else{W.fx=null;clearTimeout(ft)}patch()}rest()}else if(t.id==='awname')W.name=t.value});
{const o=acts.cf;acts.cf=function(){if(!S.cf)reset();return o.apply(this,arguments)}}
HWEvents.on('data:reset',()=>{clearTimeout(tt);clearTimeout(ft)});
/* ---------- on the Nutrition page: above the original custom form, while ADD MORE FOOD is open ---------- */
{const p=pages.food;pages.food=function(){const h=p.apply(this,arguments);if(!S.cf)return h;const k=h.indexOf('<div class="card"><h3>CUSTOM FOOD</h3>');
  return k<0?h:h.slice(0,k)+wizard()+h.slice(k).replace('<h3>CUSTOM FOOD</h3>','<h3>CUSTOM FOOD</h3><p class="mut awor">Already know the numbers? Type them yourself:</p>')}}
// in the log: a Wizard's estimate (and an entry saved by an earlier version) reads as such, not as "Custom Food" with values "by you"
{const o=desc;desc=function(e){let h=o.apply(this,arguments);const db=e&&e.c==='food'&&e.m&&e.m.db;if(!db)return h;
  h=h.replace('<span class="badge">Custom Food</span>','<span class="badge">'+(db==='fdc'?'Database entry':'Wizard\'s estimate')+'</span>').replace(' <span class="badge">kcal by you</span>','');
  return db==='est'?h.replace('tag m">YOURS','tag e">EST'):h}}
// a Wizard's estimate counts as estimated in the day's macro totals
{const o=emac;emac=function(e){const x=o.apply(this,arguments);return x&&e&&e.m&&e.m.db==='est'?{...x,est:1}:x}}

HWUI.css('addfood',`
.awscene{position:relative;line-height:0;border-radius:14px;overflow:hidden;border:1px solid var(--edge,var(--ln));margin:4px 0 10px;box-shadow:0 0 18px rgba(139,92,240,.3)}
.awscene{aspect-ratio:4/3}.awroom{display:block;width:100%;height:100%;object-fit:cover;image-rendering:auto}   /* his room is a painting, drawn smoothed */
.awfig{position:absolute;left:50%;margin-left:-37.5%;top:2%;height:150%;aspect-ratio:2/3;background:url(${POSE}) no-repeat;background-size:${POSES.length*100}% 100%;image-rendering:auto;transform-origin:50% 0;
  filter:drop-shadow(0 0 6px rgba(255,226,122,.45))}
.awfig.hi{aspect-ratio:167/192;height:100%;top:2%;margin-left:-32.6%;background-size:600% 100%;background-position:calc(var(--hx) * 20%) 0;background-repeat:no-repeat;filter:drop-shadow(0 4px 10px rgba(0,0,0,.45)) drop-shadow(0 0 8px rgba(255,226,122,.35))}
.awfig{z-index:1;transform-origin:50% 75%}
.awfig.bob{animation:awbob 3.8s ease-in-out infinite}.awfig.hop{animation:awhop .8s ease-in-out infinite}.awfig.shake{animation:awshake .5s ease-in-out 3}
.awfig.tilt{animation:awtilt 2.6s ease-in-out infinite alternate}.awfig.sway{animation:awsway 3.4s ease-in-out infinite alternate}.awfig.lean{animation:awlean 1.8s ease-in-out infinite alternate}
.awfig.turn{animation:awturn 6s steps(1) infinite}   /* turns all the way round: walking, three-quarter, side, back, side, three-quarter, front */
/* the motion follows Luna's idle: a slow breath (rise, a little squash and stretch, a hair of tilt) that never steps */
@keyframes awbob{0%,100%{transform:translateY(0) scale(1,1) rotate(0)}32%{transform:translateY(-3.5px) scale(1.02,1.028) rotate(.6deg)}68%{transform:translateY(-1.2px) scale(.992,1.012) rotate(-.5deg)}}
@keyframes awhop{0%,100%{transform:translateY(0) scale(1.03,.97)}45%{transform:translateY(-16px) scale(.98,1.03)}}
@keyframes awshake{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(-5px) rotate(-1.2deg)}75%{transform:translateX(5px) rotate(1.2deg)}}
@keyframes awtilt{from{transform:rotate(-3deg)}to{transform:rotate(3deg)}}
@keyframes awsway{from{transform:translateX(-4px) rotate(-1deg)}to{transform:translateX(4px) rotate(1.2deg)}}
@keyframes awlean{from{transform:translateX(0) rotate(0)}to{transform:translateX(10px) rotate(2deg)}}
/* a soft glow behind him and a few glints, as around Luna */
.awscene::before{content:"";position:absolute;left:50%;top:4%;width:74%;aspect-ratio:1;margin-left:-37%;border-radius:50%;pointer-events:none;background:radial-gradient(closest-side,rgba(255,226,122,.30),rgba(139,92,240,.16) 55%,transparent 76%);animation:awaura 4.2s ease-in-out infinite alternate}
@keyframes awaura{from{opacity:.55;transform:scale(.94)}to{opacity:1;transform:scale(1.06)}}
.awscene::after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle 2px at 20% 28%,#fff7c8 96%,transparent),radial-gradient(circle 2.5px at 80% 20%,#fff7c8 96%,transparent),radial-gradient(circle 1.8px at 72% 52%,#cfe9ff 96%,transparent),radial-gradient(circle 2px at 28% 58%,#fff 96%,transparent);animation:awtw 3.2s ease-in-out infinite alternate}
@keyframes awtw{from{opacity:.1}to{opacity:.95}}
html.hw-rm .awscene::before,html.hw-rm .awscene::after,html.hw-q-performance .awscene::before,html.hw-q-performance .awscene::after,html.hw-q-performance .awfig{animation:none!important}
@keyframes awturn{0%{background-position:${pat(POSES,'walk')} 0}12.5%{background-position:${pat(POSES,'three')} 0}25%{background-position:${pat(POSES,'side')} 0}37.5%{background-position:${pat(POSES,'back')} 0}62.5%{background-position:${pat(POSES,'side')} 0}75%{background-position:${pat(POSES,'three')} 0}87.5%{background-position:${pat(POSES,'front')} 0}100%{background-position:${pat(POSES,'walk')} 0}}
.awprop{position:absolute;right:6%;top:6%;z-index:1;width:40px;height:40px;background:url(${PROPS}) no-repeat;background-size:280px 40px;image-rendering:pixelated;image-rendering:crisp-edges;transform:scale(1.25);transform-origin:0 100%;
  filter:drop-shadow(0 0 6px rgba(246,201,79,.7));animation:awfloat 1.8s steps(2) infinite alternate}
.awprop.orbit{animation:aworbit 2s steps(8) infinite}.awprop.flick{animation:awflick .35s steps(2) 5 alternate}
@keyframes awfloat{to{translate:0 -5px}}@keyframes aworbit{0%{translate:0 -4px}25%{translate:12px 0}50%{translate:0 8px}75%{translate:-12px 0}100%{translate:0 -4px}}@keyframes awflick{from{rotate:-25deg}to{rotate:25deg}}
.awh{display:flex;align-items:center;justify-content:space-between;gap:8px}.awav{flex:0 0 auto;width:28px;height:28px;background:url(${PROPS}) no-repeat;background-size:196px 28px;background-position:-168px 0;image-rendering:pixelated;image-rendering:crisp-edges}
.awmst{display:flex;justify-content:center;padding:10px 8px 4px;border:2px solid var(--ln);border-radius:10px;background:var(--p2)}
.awmfig{display:block;width:240px;height:360px;max-width:100%;background:url(${POSE}) no-repeat;background-size:${POSES.length*100}% 100%;image-rendering:pixelated;image-rendering:crisp-edges;filter:drop-shadow(0 0 6px rgba(255,226,122,.45))}
.awmcap{margin:6px 0;text-align:center}#awmeet .row{justify-content:center}.awmt{margin:10px 0 4px}
.awprops{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:8px;list-style:none;padding:0;margin:0 0 4px}.awprops li{display:flex;flex-direction:column;align-items:center;gap:2px}
.awmprop{display:block;width:80px;height:80px;background:url(${PROPS}) 0 0/${PROPN.length*80}px 80px no-repeat;image-rendering:pixelated;image-rendering:crisp-edges}.awprops small{font-size:12px;color:var(--mut)}
.awsay{position:absolute;left:3%;right:3%;bottom:3%;z-index:2;display:flex;gap:8px;align-items:flex-end;line-height:1.35}.awsay p{flex:1 1 auto}
.awface{flex:0 0 auto;width:44px;height:44px;background:url(${FACE}) no-repeat;background-size:${FACES.length*44}px 44px;image-rendering:auto;border:2px solid #f6c94f;border-radius:8px;background-color:#1b1745}
.awsay p{margin:0;background:rgba(18,15,51,.88);color:#fff6dc;border:1px solid #f6c94f;border-radius:10px;padding:6px 8px;font-size:13px}.awsay p b{display:block;font:12px/1.6 var(--fl);color:#f6c94f}
@media(max-width:420px){.awsay p{font-size:12px}}
.awq{flex-wrap:nowrap}.awq input{flex:1 1 auto;min-width:0;margin:0}.awq button{flex:0 0 auto}
.awq+small,label[for="awq"] small{display:block}.awsrcs{margin:4px 0 6px;padding-left:18px;overflow-wrap:anywhere}.awsrcs li{margin:6px 0}.awsrcs a{display:inline-block;min-height:28px;line-height:28px;color:#fff0a8;text-decoration:underline}
.awsugg{display:block;width:100%;height:76px;border:0;border-radius:10px;background:#fff;margin-top:6px}.awhow{margin-top:8px}.awref{color:var(--text,inherit);opacity:.9}.awwarn{color:var(--red,#ff8a7e);font-weight:bold}
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
html.hw-rm .awfig,html.hw-rm .awprop,html.hw-rm .awcard.reveal,html.hw-q-performance .awfig,html.hw-q-performance .awprop,html.hw-q-performance .awcard.reveal{animation:none!important}
@media(prefers-reduced-motion:reduce){.awfig,.awprop,.awcard.reveal{animation:none!important}}
`);
return{menuMatches,calc,totals,get state(){return JSON.parse(JSON.stringify(W))},POSES,FACES}})();
