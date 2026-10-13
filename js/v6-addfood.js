/* v6: the Add More Food wizard, guided by the Wannabe Wizard, an apprentice new to the job. Not part of the original.
   Master prompt "Nutrition modification": ADD MORE FOOD on the Nutrition page opens the wizard above the original
   custom-food form, which stays as it was (type it yourself; one SAVE CUSTOM FOOD click still saves).
   * Art, from the owner's "The Wannabe Wizard" sheet and his room (tools/art/make_apprentice.py): six poses
     (apprentice-poses.webp: front, three, side, back, walk, cast), seven expressions (apprentice-faces.webp: happy,
     confused, nervous, determined, surprised, tired, excited) and his room (apprentice-room.webp). CSS only; still under
     reduced motion or the Performance mode.
   * 1. The guessing game (owner's request: "questions like Akinator, he deduces until he gets the answer"). He asks one
     yes/no question at a time (YES, PROBABLY, DON'T KNOW, PROBABLY NOT, NO) and narrows the dishes of the Kolej MARA
     Kulim canteen menu already in the app (Dewan Selera 2022, the items with a kcal value):
        - each dish has yes/no traits read from its Malay name and the dish type HealthWiz already uses (fcat): drink,
          rice, noodles, fried, gravy, coconut milk, chicken, fish... (QS below). They are rule-based tags, not AI;
        - every dish starts with a weight of 1 + the number of times the menu serves it, so common dishes come first;
        - an answer multiplies each dish's weight by how well it fits (YES 0.96 / 0.04 for a dish with / without the
          trait, PROBABLY 0.75 / 0.25, DON'T KNOW changes nothing), so one mistaken answer does not rule a dish out;
        - the next question is the one that splits the remaining weight closest to half;
        - he guesses "Is it ...?" once one dish holds 60 % of the weight; NO removes it. When no question can tell the
          last few apart he shows them as a short list; after three wrong guesses he gives up.
     The game only names a dish. UNDO takes back the last answer. TYPE IT INSTEAD, NONE OF THESE and giving up all lead
     to the search below.
   * 2. The search, "What did you eat?": one search looks in two places and shows where each match comes from:
        - the same canteen menu (works offline and signed out);
        - USDA FoodData Central, through the food-search Edge Function (supabase/functions/food-search; signed in; the
          data.gov key stays on the server). Its values are per 100 g (or 100 ml for some branded foods).
     The player picks the match; nothing is chosen for them. If nothing fits, the form below takes it as typed.
   * 3. The portion, specific to the food: a menu dish uses its own portion text (½, 1, 1½, 2, 3 portions; a dish the
     menu lists more than once offers each listing); a database food offers its household measures with their gram
     weights from FoodData Central (cup, slice, piece, tablespoon…), or the label serving of a packaged food, each with
     a small picture of that kind of measure; only when the database has no measure does it ask for grams. Household
     measures are approximate, and the card says so.
   * 4. The card updates at once: kcal, protein, carbohydrate and fat for the chosen amount, with the method
     (nutrient = value per 100 g × grams ÷ 100, the SR / FNDDS convention), the source (FDC ID and data type, public
     domain) and what it cannot know. A menu dish's kcal come from the menu; its macros are HealthWiz's estimate from
     the dish type (estMac), labelled.
   * 5. Nothing is saved until CONFIRM AND LOG. The entry records the match, the portion and its grams, the values, the
     source and the data type; it is back-dated like every food (HWWhen). The name and meal can be changed first. */
const HWAddFood=(()=>{
const D=document,ico=(n,s)=>HWPixel.icon(n,s||1);
const POSE='assets/img/apprentice-poses.webp',FACE='assets/img/apprentice-faces.webp',ROOM='assets/img/apprentice-room.webp';
const POSES=['front','three','side','back','walk','cast'],FACES=['happy','confused','nervous','determined','surprised','tired','excited'];
const pat=(L,k)=>(L.indexOf(k)/(L.length-1)*100).toFixed(4)+'%';
const r1=v=>Math.round(v*10)/10,fmt=v=>v==null?'–':(Math.round(v*10)/10).toLocaleString(undefined,{maximumFractionDigits:1});

/* ---------- the wizard's state, for this visit only ---------- */
// step: play (the guessing game) | ask | pick (the search) | portion | done. ev: the game's answers {q,a} and wrong guesses {g}.
const W0=()=>({step:'play',ev:[],near:[],gave:0,won:0,q:'',busy:0,err:'',menu:[],db:[],dbNote:'',sel:null,food:null,por:0,n:1,g:'',name:'',meal:'',done:null});
const W=W0(),reset=()=>Object.assign(W,W0());
const CL=()=>typeof HWCloud!=='undefined'?HWCloud:null,signed=()=>{const c=CL();return!!(c&&c.who())};

/* ---------- the guessing game ---------- */
// [id, question, hint, test(lower-case name, dish type)]. Traits come from the dish's Malay name and fcat; a few dishes
// are borderline (is Ikan Bawal Masam Manis "in a sauce"?), which is why answers weigh dishes instead of ruling them out.
const has=(...c)=>(n,t)=>c.includes(t);
const QS=[
  ['drink','Was it a drink?','Water, tea, milk, soya, a malted or a fruit drink.',(n)=>/^(air |teh|minuman|susu)/.test(n)],
  ['milk','Was there milk or soya in it?','Fresh milk, a milk drink, soya milk, cream or ice cream.',n=>/susu|soya|bermalta|bercoklat|ais krim|berkrim/.test(n)],
  ['fruit','Was it a fruit?','Apple, orange, watermelon, pineapple, guava, papaya, banana, dates, raisins.',has('fruit')],
  ['sweet','Did it taste mostly sweet?','Like a sweet drink, cake, kuih, fruit or honey.',(n,t)=>['sweet','malt','icecream','fruit','cake','bubur','cereal'].includes(t)&&!/^air kosong/.test(n)||/ban manis|kaya|kacang merah|donat|apam|madu|coklat|cucur badak/.test(n)],
  ['rice','Was it rice?','Nasi of any kind, or pulut (glutinous rice).',n=>/^nasi|pulut/.test(n)],
  ['noodle','Was it noodles or pasta?','Mi, bihun, kuetiau, spaghetti or macaroni.',has('noodle','soupnoodle')],
  ['dough','Was it made from dough or batter?','Bread, roti, pau, bun, cake, muffin, pizza or a kuih like karipap or cucur.',has('bread','wholebread','canai','pizza','cake','bun','pastry')],
  ['bread','Was it bread or roti?','Sliced bread or roti canai.',n=>/^roti/.test(n)],
  ['filled','Did it have a filling inside?','Like karipap, samosa, pau or a red-bean bun.',n=>/karipap|samosa|^pau|ban kacang/.test(n)],
  ['fried','Was it fried?','Goreng, deep-fried in batter, or a fried kuih.',n=>/goreng|celup tepung|karipap|samosa|cucur|donat|cakoi|papadom|canai|telur dadar|telur hancur/.test(n)],
  ['wet','Did it come in soup, gravy or curry?','Sup, tom yam, kari, kurma, masak lemak, asam pedas, dal.',(n,t)=>!/^nasi/.test(n)&&/^sup|tom yam|^kuah|kari|kurma|masak lemak|asam pedas|dalca|^kuah dal|bubur|soto|masak air|tumis air|berkrim/.test(n)],
  ['coconut','Was it cooked with coconut milk?','Masak lemak, kari, kurma, rendang, dalca or nasi lemak.',(n,t)=>t!=='fruit'&&/lemak|kari|kurma|rendang|dalca/.test(n)],
  ['spicy','Was it spicy or chilli-hot?','Sambal, berlada, cili, kari, tom yam, asam pedas, paprik, black pepper.',n=>/cili|sambal|berlada|pedas|kari|tom yam|belacan|paprik|black pepper|bercili|masak merah|rendang|berempah|soto|tiga rasa|jawa/.test(n)],
  ['kicap','Was it in a soy, oyster or sweet-sour sauce?','Masak kicap, sos tiram, taucu, masam manis, sweet sour, tiga rasa.',n=>/kicap|sweet sour|masam manis|tiga rasa|taucu|sos tiram/.test(n)],
  ['chicken','Did it have chicken in it?','Ayam, also as a filling or in the rice.',n=>/ayam/.test(n)&&!/^kuah/.test(n)],
  ['fish','Was it fish?','Ikan of any kind, ikan bilis or sardines.',n=>/ikan|bilis|sardin/.test(n)],
  ['prawn','Was it prawns or squid?','Udang or sotong.',n=>/udang|sotong/.test(n)],
  ['beef','Was it beef?','Daging.',n=>/daging/.test(n)],
  ['egg','Was it an egg?','Boiled, fried, scrambled or in sambal.',n=>/^telur/.test(n)],
  ['veg','Was it mainly vegetables?','Sayur, greens, cabbage, beans, bean sprouts, gourd, mushroom soup.',(n,t)=>['veg','veglemak','vegplain','vegsoup'].includes(t)&&!/^(ikan|ayam|daging|udang|sotong|nasi|mi |bihun|kuetiau)/.test(n)||/^sup cendawan/.test(n)],
  ['leafy','Was it leafy greens?','Bayam, kangkung, sawi, kailan or pucuk manis.',n=>/bayam|kangkung|sawi|kailan|pucuk/.test(n)],
  ['pulse','Was it made from lentils, beans or soya?','Dal, mung-bean porridge, red beans, baked beans, tofu, tempe, soya milk.',n=>/dal|kacang hijau|kacang merah|kacang panggang|tauhu|tempe|soya/.test(n)],
  ['side','Was it a small side or a sauce?','A kuah, sambal, papadom, a spoon of honey or a few raisins.',(n,t)=>['sauce','sambal'].includes(t)||/papadom|^kuah|^madu|kismis|^sayur$/.test(n)],
  ['soup','Was it a soup?','Sup, tom yam or soto.',n=>/^sup|tom yam|soto/.test(n)],
  ['plain','Was it plain, with nothing cooked into it?','Plain rice, plain bread, plain water, a boiled egg, breakfast cereal.',n=>/^(nasi putih|roti putih|roti bijirin penuh|air kosong|sayur$|telur rebus|bijirin sarapan|susu penuh krim)/.test(n)],
  ['cake','Was it a cake or a sweet kuih?','Kek, muffin, doughnut, apam, cakoi, cucur badak, sweet bun.',(n,t)=>t==='cake'||/donat|apam|cakoi|ban manis|cucur badak/.test(n)],
  ['tomato','Was it red with tomato or chilli sauce?','Nasi tomato, masak merah, paprik, bolognese, baked beans, sweet sour.',n=>/tomato|masak merah|paprik|bolognese|kacang panggang|sweet sour|masam manis/.test(n)],
  ['mixed','Was it a fried rice or fried noodle dish?','Nasi goreng, mi goreng, bihun goreng, kuetiau, spaghetti or macaroni goreng.',n=>/^(nasi|mi|bihun|kuetiau|spaghetti|makaroni)\b.*goreng/.test(n)],
  ['bihun','Was it bihun?','Thin rice vermicelli: bihun goreng or bihun soto.',n=>/bihun/.test(n)],
  ['pasta','Was it pasta?','Spaghetti or macaroni.',n=>/spaghetti|makaroni/.test(n)],
  ['bun','Was it a bun or a pau?','A soft bread bun (ban) or a steamed pau.',n=>/^(ban|pau) /.test(n)],
  ['choc','Did it have chocolate in it?','Chocolate cake or a chocolate milk drink.',n=>/coklat/.test(n)],
  ['banana','Did it have banana in it?','A banana, or banana cake.',n=>/pisang/.test(n)],
  ['grain','Was it wholegrain?','Wholegrain bread or breakfast cereal.',n=>/bijirin/.test(n)],
  ['melon','Was it a melon?','Watermelon or honeydew (tembikai).',n=>/tembikai/.test(n)],
  ['apple','Was it an apple or an orange?','Epal or oren.',n=>/^(epal|oren)/.test(n)],
  ['sprout','Did it have bean sprouts in it?','Taugeh.',n=>/taugeh/.test(n)],
  ['cabbage','Was it cabbage?','Kubis.',n=>/kubis/.test(n)],
  ['kunyit','Was it yellow with turmeric?','Goreng kunyit.',n=>/kunyit/.test(n)],
  ['mushroom','Did it have mushrooms in it?','Cendawan.',n=>/cendawan/.test(n)]];
const ANS=[[1,'YES'],[.75,'PROBABLY'],[.5,"DON'T KNOW"],[.25,'PROBABLY NOT'],[0,'NO']],GUESS=.6,MAXQ=18,MAXWRONG=3;
let C=null;
/** The canteen dishes he knows: one per name, each listing on the menu kept as a portion option. */
function cands(){if(C)return C;const by={},L=[],menu=typeof MENU!=='undefined'?MENU:{days:{}};
  F.forEach((f,i)=>{if(f[2]==null)return;const k=f[0].toLowerCase();let c=by[k];if(!c){c=by[k]={name:f[0],vars:[],served:0};L.push(c)}
    if(!c.vars.some(v=>v.por===f[1]&&v.kcal===+f[2]))c.vars.push({i,por:f[1],kcal:+f[2]})});
  for(const d of Object.values(menu.days||{}))for(const s of Object.values(d))for(const i of s){const f=F[i],c=f&&by[f[0].toLowerCase()];if(c)c.served++}
  L.forEach(c=>{const n=c.name.toLowerCase(),t=typeof fcat==='function'?fcat(c.name):'mixed';c.w0=1+c.served;c.t=QS.map(q=>q[3](n,t)?1:0)});
  return C=L}
/** The share of belief in each dish after these events. */
function post(ev){const L=cands(),w=L.map(c=>c.w0);
  for(const e of ev){if(e.g!=null){w[e.g]=0;continue}const qi=QS.findIndex(q=>q[0]===e.q);if(qi<0)continue;
    L.forEach((c,j)=>{w[j]*=Math.min(.96,Math.max(.04,c.t[qi]?e.a:1-e.a))})}
  const s=w.reduce((a,b)=>a+b,0);return s>0?w.map(x=>x/s):w}
/** What he does next: {k:'q',q}, {k:'guess',i}, {k:'list',L} or {k:'give',L}. */
function think(ev){const L=cands(),P=post(ev),order=L.map((c,j)=>j).sort((a,b)=>P[b]-P[a]),top=order[0];
  const asked=new Set(ev.filter(e=>e.q).map(e=>e.q)),wrong=ev.filter(e=>e.g!=null).length,near=order.filter(j=>P[j]>=.02).slice(0,8);
  if(wrong>=MAXWRONG||!(P[top]>0))return{k:'give',L:near};
  let best=null,bv=0;QS.forEach((q,qi)=>{if(asked.has(q[0]))return;let s=0;L.forEach((c,j)=>{if(c.t[qi])s+=P[j]});const v=Math.min(s,1-s);if(v>bv+1e-9){bv=v;best=q[0]}});
  if(P[top]>=GUESS)return{k:'guess',i:top};
  if(bv<.03||asked.size>=MAXQ)return near.length>1?{k:'list',L:near}:{k:'guess',i:top};
  return{k:'q',q:best}}
const live=ev=>{const P=post(ev),m=Math.max(...P);return P.filter(p=>p>0&&p>=m*.05).length};
const qOf=id=>QS.find(q=>q[0]===id);

/* ---------- him ---------- */
function mood(){if(W.step==='done')return['cast','excited'];if(W.busy)return['walk','determined'];if(W.err)return['side','confused'];
  if(W.step==='play'){const t=think(W.ev),last=W.ev[W.ev.length-1];if(t.k==='guess')return['front','surprised'];if(t.k==='list')return['three','tired'];
    if(last&&last.g!=null)return['side','confused'];return W.ev.length<3?['three','determined']:['front','excited']}
  if(W.step==='pick')return W.menu.length||W.db.length?['three','surprised']:['back','nervous'];if(W.step==='portion')return W.won?['front','excited']:['front','determined'];
  return W.gave?['back','nervous']:['front','happy']}
function say(){if(W.step==='done')return'Whoa, it worked! I mean... of course it worked. Your food is logged.';if(W.busy)return W.step==='portion'?'Reading the measures in the great book...':'Searching the archive... give me a second!';
  if(W.err)return W.err;
  if(W.step==='play'){const t=think(W.ev),last=W.ev[W.ev.length-1];if(t.k==='guess')return'I know! I know! Was it '+cands()[t.i].name+'?';
    if(t.k==='list')return'These all look the same to my spells... Which one was it?';
    return(last&&last.g!=null?'Not that one? Hmm... ':W.ev.length?'':'Think of what you ate. I will guess it! ')+qOf(t.q)[1]}
  if(W.step==='pick')return W.menu.length||W.db.length?'I found these! Which one did you eat?':'Hmm... I could not find that one. Try other words, or type it yourself below.';
  if(W.step==='portion')return W.won?'I got it! I really got it! Now, how much of it did you eat?':'How much did you have? Pick the closest measure.';
  return W.gave?'You win... I give up! What was it? I will look it up in the great book.':'What did you eat? I will find it in the great book... probably!'}
function scene(){const[p,f]=mood();
  return '<div class="awscene"><img class="awroom" src="'+ROOM+'" alt="" width="336" height="189"><span class="awfig'+(W.step==='done'?' cast':W.busy?' walk':'')+'" aria-hidden="true" data-pose="'+p+'" style="background-position:'+pat(POSES,p)+' 0"></span>'
    +'<div class="awsay" role="status"><span class="awface" role="img" aria-label="The Wannabe Wizard, '+f+'" data-face="'+f+'" style="background-position:'+pat(FACES,f)+' 0"></span><p><b>THE WANNABE WIZARD</b>'+esc(say())+'</p></div></div>'}

/* ---------- 2. search ---------- */
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
function menuSel(name,i){const c=cands().find(x=>x.name.toLowerCase()===String(name).toLowerCase());
  const vars=c?c.vars:[{i,por:F[i][1],kcal:+F[i][2]}],v=Math.max(0,vars.findIndex(x=>x.i===i));return setVar({k:'menu',name:c?c.name:name,vars,v},v)}
const setVar=(s,v)=>Object.assign(s,{v,por:s.vars[v].por,kcal:s.vars[v].kcal});

/* ---------- 3. portion ---------- */
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
  const f=W.food;if(!f)return null;const M=measures(f),m=M[W.por];let g,label;
  if(m){g=r1(m.g*W.n);label=nt(W.n)+' × '+m.label+' ('+fmt(m.g)+' '+f.unit+' each)'}else{g=+W.g;if(!(g>0&&g<=5000))return null;label=fmt(g)+' '+f.unit}
  const v=k=>f.per100[k]==null?null:r1(f.per100[k]*g/100);return{g,kcal:Math.round(f.per100.kcal*g/100),p:v('p'),c:v('c'),f:v('f'),label}}
function card(){const c=calc();if(!c)return '<p class="mut">Choose an amount to see the values.</p>';const f=W.food,u=f?f.unit:'g';
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
  else{const M=measures(W.food);
    opts=M.length?'<div class="awms" role="group" aria-label="Measure">'+M.map((m,i)=>'<button type="button" class="chip awm'+(W.por===i?' on':'')+'" data-a="awpor" data-i="'+i+'" aria-pressed="'+(W.por===i)+'">'+pic(m.label)+'<span>'+esc(m.label)+'<small>'+fmt(m.g)+' '+W.food.unit+'</small></span></button>').join('')+'</div>'
      :'<p>The database has no household measure for this food, so enter the amount:</p><label>Amount ('+W.food.unit+')<input id="awg" type="number" min="1" max="5000" step="1" inputmode="decimal" value="'+esc(W.g)+'"></label>'}
  const many=s.k==='menu'||measures(W.food).length;
  return opts+(many?'<div class="row awns" role="group" aria-label="How many">'+NS.map(n=>'<button type="button" class="chip'+(W.n===n?' on':'')+'" data-a="awn" data-v="'+n+'" aria-pressed="'+(W.n===n)+'">'+nt(n)+'</button>').join('')+'</div>':'')
    +'<div id="awcard">'+card()+'</div>'
    +'<label>Name<input id="awname" maxlength="60" value="'+esc(W.name||s.name)+'"></label>'
    +'<label>Meal<select id="awmeal">'+MEALS.map(m=>'<option value="'+m[0]+'"'+((W.meal||S.meal)===m[0]?' selected':'')+'>'+esc(m[1]||m[0])+'</option>').join('')+'</select></label>'
    +'<div class="row"><button type="button" data-a="awsave"'+(calc()?'':' disabled')+'>CONFIRM AND LOG</button><button type="button" class="g" data-a="awback">CHOOSE ANOTHER</button></div>'
    +'<small class="mut">Nothing is saved until you confirm. You can change the name and meal first.</small>'}
function doneStep(){return card()+'<div class="row"><button type="button" data-a="awmore">ADD ANOTHER FOOD</button><button type="button" class="g" data-a="awclose">DONE</button></div>'}

const candBtn=j=>{const c=cands()[j];return '<li><button type="button" class="g awres" data-a="awcand" data-i="'+j+'"><b>'+esc(c.name)+'</b><small>Kolej MARA Kulim canteen menu (2022) · '
  +c.vars.map(v=>esc(v.por)+' · '+v.kcal+' kcal').join(' or ')+'</small></button></li>'};
function playStep(){const t=think(W.ev),L=cands(),n=W.ev.filter(e=>e.q).length,tools='<div class="row">'+(W.ev.length?'<button type="button" class="g sm" data-a="awundo">UNDO</button>':'')
    +'<button type="button" class="g sm" data-a="awtype">TYPE IT INSTEAD</button></div>';
  if(t.k==='guess'){const c=L[t.i];return '<p class="awguess"><small>MY GUESS</small><b>'+esc(c.name)+'</b></p><div class="row awyn"><button type="button" data-a="awyes">YES, THAT\'S IT</button><button type="button" class="g" data-a="awno">NO</button></div>'+tools}
  if(t.k==='list')return '<p><b>Was it one of these?</b></p><ul class="awlist">'+t.L.map(candBtn).join('')+'</ul><div class="row"><button type="button" class="g" data-a="awnone">NONE OF THESE</button></div>'+tools;
  const q=qOf(t.q);
  return '<p class="awqn"><b>QUESTION '+(n+1)+'</b>'+esc(q[1])+'<small>'+esc(q[2])+'</small></p><div class="awans" role="group" aria-label="Your answer">'
    +ANS.map(a=>'<button type="button" class="g" data-a="awans" data-v="'+a[0]+'">'+a[1]+'</button>').join('')+'</div>'
    +'<p class="mut awlive">Still likely: '+live(W.ev)+' of the '+L.length+' dishes on the Kolej MARA Kulim canteen menu. I can only guess dishes from that menu; anything else, type it instead.</p>'+tools}
function body(){if(W.step==='done')return doneStep();if(W.step==='portion')return portionStep();if(W.step==='play')return playStep();
  const ask='<label for="awq"><b>What did you eat?</b></label><div class="row awq"><input id="awq" type="search" autocomplete="off" maxlength="60" placeholder="e.g. nasi lemak, apple, milk" value="'+esc(W.q)+'"><button type="button" data-a="awsearch"'+(W.busy?' disabled':'')+'>SEARCH</button></div>'
    +(signed()?'':'<small class="mut">Signed out: the canteen menu is searched. Sign in to also search USDA FoodData Central.</small>');
  const near=W.step==='ask'&&W.near.length?'<p class="mut">My closest guesses, in case one is right:</p><ul class="awlist">'+W.near.map(candBtn).join('')+'</ul>':'';
  return ask+(W.step==='pick'?pickList():near)+'<div class="row"><button type="button" class="g sm" data-a="awplay">'+(W.ev.length?'PLAY AGAIN':'LET HIM GUESS')+'</button></div>'}
function wizard(){return '<div class="card awcardo" id="awiz"><h3>'+ico('food')+' ADD MORE FOOD</h3>'+scene()+'<div id="awbody">'+body()+'</div></div>'}
function draw(){const el=D.getElementById('awiz');if(!el)return;const f=D.activeElement&&D.activeElement.id;el.outerHTML=wizard();const n=f&&D.getElementById(f);if(n)n.focus()}

/* ---------- actions ---------- */
const keepName=()=>{const n=D.getElementById('awname'),m=D.getElementById('awmeal');if(n)W.name=n.value;if(m)W.meal=m.value};
acts.awsearch=()=>{const i=D.getElementById('awq');W.q=i?i.value:W.q;search()};
acts.awback=()=>{if(W.won){W.won=0;W.sel=null;W.step='play';draw();return}W.step=W.q?'pick':'ask';W.sel=null;W.food=null;W.err='';if(W.step==='pick'){W.menu=menuMatches(W.q)}draw();const i=D.getElementById('awq');if(i)i.focus()};
acts.awpick=async d=>{const k=String(d.k||''),j=+k.slice(1),src=k[0]==='m'?W.menu[j]:W.db[j];if(!src)return;
  W.sel=k[0]==='m'?menuSel(src.name,src.i):{k:'db',name:src.name,id:src.id};W.won=0;W.name=src.name;W.n=1;W.por=0;W.g='';W.err='';W.step='portion';
  if(k[0]==='m'){W.food=null;draw();return}
  W.busy=1;W.food=null;draw();
  try{const r=await call({id:src.id});W.food=r&&r.food&&r.food.per100?r.food:null;if(!W.food)throw{code:'db'}}
  catch(e){W.err=ERR[e.code]||ERR.db;W.step='pick'}
  W.busy=0;draw()};
// the guessing game
const toAsk=gave=>{const t=think(W.ev);W.gave=gave?1:0;W.near=gave&&t.L?t.L:[];W.step='ask';draw();const i=D.getElementById('awq');if(i)i.focus()};
const after=()=>{if(think(W.ev).k==='give')return toAsk(1);draw()};
acts.awans=d=>{const t=think(W.ev);if(t.k!=='q')return;W.ev.push({q:t.q,a:+d.v});after()};
acts.awundo=()=>{W.ev.pop();draw()};
acts.awno=()=>{const t=think(W.ev);if(t.k!=='guess')return;W.ev.push({g:t.i});after()};
const choose=j=>{const c=cands()[j];if(!c)return;W.sel=setVar({k:'menu',name:c.name,vars:c.vars,v:0},0);W.won=1;W.food=null;W.name=c.name;W.n=1;W.por=0;W.g='';W.err='';W.step='portion';draw()};
acts.awyes=()=>{const t=think(W.ev);if(t.k==='guess')choose(t.i)};
acts.awcand=d=>choose(+d.i);
acts.awnone=()=>toAsk(1);
acts.awtype=()=>toAsk(0);
acts.awplay=()=>{reset();draw()};
acts.awvar=d=>{keepName();if(W.sel&&W.sel.vars&&W.sel.vars[+d.i])setVar(W.sel,+d.i);draw()};
acts.awpor=d=>{keepName();W.por=+d.i;draw()};
acts.awn=d=>{keepName();W.n=+d.v;draw()};
acts.awsave=()=>{keepName();const c=calc();if(!c)return;const name=String(W.name||W.sel.name).trim().slice(0,60)||W.sel.name,meal=W.meal||S.meal;
  const w=HWWhen.stamp({sig:'aw'+name+c.kcal});if(!w)return;
  if(W.sel.k==='menu'){const m=W.sel;add('food',c.kcal,{name,por:m.por,qty:W.n,pm:1,meal,src:'KOLEJ MARA KULIM'},'',w.d,w.t,10,'Food logged')}
  else{const f=W.food;add('food',c.kcal,{name,por:c.label,qty:1,meal,src:'USDA FoodData Central',custom:1,db:'fdc',fdc:f.id,fdt:f.type,g:c.g,u:f.unit,
    p:c.p==null?'':c.p,c:c.c==null?'':c.c,f:c.f==null?'':c.f,fb:''},'',w.d,w.t,10,'Food logged')}
  HWWhen.saved(w,'Food');W.step='done';W.done=c;
  const y=window.scrollY;render();window.scrollTo(0,y)};
acts.awmore=()=>{reset();draw()};
acts.awclose=()=>{reset();S.cf=0;render()};
D.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='awq'){e.preventDefault();acts.awsearch()}});
D.addEventListener('input',e=>{const t=e.target;if(!t)return;if(t.id==='awq')W.q=t.value;else if(t.id==='awg'){W.g=t.value;const c=D.getElementById('awcard');if(c)c.innerHTML=card();const b=D.querySelector('[data-a="awsave"]');if(b)b.disabled=!calc()}
  else if(t.id==='awname'){W.name=t.value}});
{const o=acts.cf;acts.cf=function(){if(!S.cf)reset();return o.apply(this,arguments)}}

/* ---------- on the Nutrition page: above the original custom form, while ADD MORE FOOD is open ---------- */
{const p=pages.food;pages.food=function(){const h=p.apply(this,arguments);if(!S.cf)return h;const k=h.indexOf('<div class="card"><h3>CUSTOM FOOD</h3>');
  return k<0?h:h.slice(0,k)+wizard()+h.slice(k).replace('<h3>CUSTOM FOOD</h3>','<h3>CUSTOM FOOD</h3><p class="mut awor">Not found? Type it yourself:</p>')}}
// a database food reads as such in the log, not as "Custom Food"
{const o=desc;desc=function(e){const h=o.apply(this,arguments);return e&&e.c==='food'&&e.m&&e.m.db==='fdc'?h.replace('<span class="badge">Custom Food</span>','<span class="badge">USDA FoodData Central</span>'):h}}

HWUI.css('addfood',`
.awscene{position:relative;line-height:0;border-radius:14px;overflow:hidden;border:1px solid var(--edge,var(--ln));margin:4px 0 10px;box-shadow:0 0 18px rgba(139,92,240,.3)}
.awroom{display:block;width:100%;height:auto;image-rendering:pixelated;image-rendering:crisp-edges}
.awfig{position:absolute;left:4%;bottom:3%;width:80px;height:120px;background:url(${POSE}) no-repeat;background-size:480px 120px;image-rendering:pixelated;image-rendering:crisp-edges;
  filter:drop-shadow(0 0 6px rgba(255,226,122,.45));animation:awbob 1.6s steps(2) infinite alternate}
@media(min-width:420px){.awfig{transform:scale(1.25);transform-origin:bottom left}}
.awfig.walk{animation:awwalk .5s steps(2) infinite alternate}.awfig.cast{animation:awcast .6s steps(3) 3}
@keyframes awbob{to{translate:0 -2px}}@keyframes awwalk{to{translate:6px -2px}}@keyframes awcast{50%{filter:drop-shadow(0 0 16px #63e6dc)}to{filter:drop-shadow(0 0 4px #fff0a8)}}
.awsay{position:absolute;right:3%;top:6%;max-width:62%;display:flex;gap:6px;align-items:flex-start;line-height:1.35}
.awface{flex:0 0 auto;width:48px;height:48px;background:url(${FACE}) no-repeat;background-size:336px 48px;image-rendering:pixelated;border:2px solid #f6c94f;border-radius:8px;background-color:#1b1745}
.awsay p{margin:0;background:rgba(18,15,51,.86);color:#fff6dc;border:1px solid #f6c94f;border-radius:10px;padding:6px 8px;font-size:13px}.awsay p b{display:block;font:7px/1.6 var(--fh);color:#f6c94f}
.awq{flex-wrap:nowrap}.awq input{flex:1 1 auto;min-width:0;margin:0}.awq button{flex:0 0 auto}
.awlist{list-style:none;margin:8px 0;padding:0}.awres{display:flex;flex-direction:column;align-items:flex-start;width:100%;text-align:left;margin:4px 0;min-height:44px}.awres small{color:var(--mut);font-weight:normal}
.awms{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:6px 0}.awm{display:flex;gap:6px;align-items:center;text-align:left;min-height:52px}.awm small{display:block;color:inherit;opacity:.85}
.awpic{flex:0 0 auto;image-rendering:pixelated;shape-rendering:crispEdges}.awns .chip{flex:1 1 0;min-height:44px}
.awcard{border:2px solid #f6c94f;border-radius:14px;padding:10px;margin:10px 0;background-color:var(--p2);box-shadow:0 0 16px rgba(246,201,79,.25)}.awcard>b{display:block}.awcard>small{color:var(--mut)}
.awcard.reveal{animation:awreveal .7s steps(4) both}@keyframes awreveal{from{transform:scale(.6) rotate(-6deg);opacity:0;box-shadow:0 0 40px #63e6dc}}
.awtab{width:100%;border-collapse:collapse;margin:6px 0}.awtab th,.awtab td{text-align:left;padding:4px;border-top:1px solid var(--edge,var(--ln))}.awsrc{overflow-wrap:anywhere}
.awqn{margin:6px 0;font-size:17px}.awqn b{display:block;font:8px/1.8 var(--fh);color:var(--gold,#f6c94f)}.awqn small{display:block;font-size:13px;color:var(--mut);margin-top:2px}
.awans{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:6px;margin:8px 0}.awans button{min-height:44px;margin:0}
.awguess{margin:8px 0;padding:10px;border:2px dashed #f6c94f;border-radius:12px;text-align:center}.awguess small{display:block;font:7px/1.8 var(--fh);color:var(--mut)}.awguess b{font-size:20px}
.awyn button{flex:1 1 0;min-height:44px}.awlive{font-size:12px}
.awor{margin:0 0 6px}#awiz label{display:block;margin:6px 0}#awiz select,#awiz input{width:100%}#awiz .awq input{width:auto}
html.hw-rm .awfig,html.hw-rm .awcard.reveal,html.hw-q-performance .awfig,html.hw-q-performance .awcard.reveal{animation:none}
@media(prefers-reduced-motion:reduce){.awfig,.awcard.reveal{animation:none}}
`);
return{menuMatches,measures,calc,kind,cands,post,think,QS,get state(){return JSON.parse(JSON.stringify(W))},POSES,FACES}})();
