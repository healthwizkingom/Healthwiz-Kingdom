/* v6: Add More Food, guided by the Wannabe Wizard, an apprentice new to the job. Not part of the original.
   Master prompt "Nutrition modification", reworked at the owner's request (2026-10-13): "questions like Akinator: type any
   food, he asks about the portion, toppings and sauces, then he guesses the calories and macros, not the food".
   ADD MORE FOOD on the Nutrition page opens the wizard above the original custom-food form, which stays as it was (type
   it yourself; one SAVE CUSTOM FOOD click still saves).
   * Art, from the owner's "The Wannabe Wizard" sheet and his room (tools/art/make_apprentice.py): six poses
     (apprentice-poses.webp), seven expressions (apprentice-faces.webp) and his room (apprentice-room.webp). He fills most
     of the scene's height. CSS only; still under reduced motion or the Performance mode.
   * 1. "What did you eat?": any words (nasi kerabu, teh tarik kurang manis, a cheeseburger...).
   * 2. His questions, one at a time, Akinator style, about what changes the numbers most: how it was cooked, how much,
     what came with it, sauces, what went into a drink. NOT SURE takes his default; UNDO takes an answer back.
        - Signed in, the crystal ball: Google Gemini through the food-guess Edge Function (supabase/functions/food-guess;
          the key stays on the server). It writes the questions for any food and then lists the parts it thinks were
          eaten, each with a weight and values. A part that matches one of the reference foods below keeps the AI's
          weight but takes its values from USDA; every other part is labelled "AI estimate (Google Gemini)".
        - Signed out, offline, or when the crystal ball fails, the book: fixed questions for common families (rice,
          noodles, bread, drinks, soup, fast food, fruit, snacks, sides) and the dishes he knows by name (DISH: he ticks
          their usual sides for you to check). Its parts are USDA FoodData Central foods (js/v6-foodparts.js, copied by
          tools/food/make_food_parts.py from the official FNDDS and SR Legacy downloads) and a few canteen dishes.
          Where USDA has no exact match the nearest food is used and the card says which (salted egg → duck egg...).
   * 3. His guess: the total kcal, protein, carbohydrate and fat, then every part with its amount, values and source.
     It is an estimate, and says so; − and + change any part by half its amount. Nothing is saved until CLOSE ENOUGH,
     LOG IT. The entry is a custom food with the macros, db: 'est' and the parts [label, g, kcal, source]; the log shows
     "Wizard's estimate" and the macros count as estimated (EST).
   * The search is still there (SEARCH THE BOOKS INSTEAD): the canteen menu and, signed in, USDA FoodData Central through
     the food-search Edge Function, with food-specific portions, as before. */
const HWAddFood=(()=>{
const D=document,ico=(n,s)=>HWPixel.icon(n,s||1);
const POSE='assets/img/apprentice-poses.webp',FACE='assets/img/apprentice-faces.webp',ROOM='assets/img/apprentice-room.webp';
const POSES=['front','three','side','back','walk','cast'],FACES=['happy','confused','nervous','determined','surprised','tired','excited'];
const pat=(L,k)=>(L.indexOf(k)/(L.length-1)*100).toFixed(4)+'%';
const r1=v=>Math.round(v*10)/10,fmt=v=>v==null?'–':(Math.round(v*10)/10).toLocaleString(undefined,{maximumFractionDigits:1});

/* ---------- the wizard's state, for this visit only ---------- */
// step: ask (what did you eat?) | q (his questions) | guess (his calorie guess) | pick, portion (the search) | done
const W0=()=>({step:'ask',food:'',mode:'',hist:[],cur:null,sel2:[],items:[],note:'',fam:'',ans:{},order:[],unknown:0,
  q:'',busy:0,err:'',menu:[],db:[],dbNote:'',sel:null,food0:null,por:0,n:1,g:'',name:'',meal:'',done:null});
const W=W0(),reset=()=>Object.assign(W,W0());
const CL=()=>typeof HWCloud!=='undefined'?HWCloud:null,signed=()=>{const c=CL();return!!(c&&c.who())};

/* ---------- 1. the parts he builds a guess from ---------- */
// USDA FoodData Central foods (js/v6-foodparts.js, copied from the official downloads) and Kolej MARA Kulim canteen dishes
// ('m:' + the menu name: kcal per the stated portion from the menu, macros the existing estMac estimate).
const FP=typeof HWFoodParts!=='undefined'?HWFoodParts:{};
const menuRow=n=>F.find(f=>f[2]!=null&&f[0].toLowerCase()===n.toLowerCase());
/** One part's values for n units (USDA: n × its household measure; canteen: n × the stated portion). */
function partVal(k,n){
  if(k.startsWith('m:')){const f=menuRow(k.slice(2));if(!f)return null;const kcal=+f[2]*n,x=estMac(f[0],kcal);
    return{g:null,kcal,p:x.p,c:x.c,f:x.f,amt:fmtN(n)+' × '+f[1],src:'Kolej MARA Kulim canteen menu (2022): kcal from the menu; protein, carbohydrate and fat a HealthWiz estimate from the dish type',menu:1}}
  const r=FP[k];if(!r)return null;const g=r[8]*n,v=i=>r[i]*g/100;
  return{g,kcal:v(3),p:v(4),c:v(5),f:v(6),amt:fmtN(n)+' × '+r[7]+' ('+fmt(r[8])+' g each) = '+fmt(g)+' g',src:'USDA FoodData Central, '+r[1]+', FDC ID '+r[0]+': '+r[2]}}
const fmtN=n=>{const w=Math.floor(n),f=n-w,F2={.25:'¼',.5:'½',.75:'¾'}[Math.round(f*4)/4];return Math.abs(f)<.01?String(w):F2&&Math.abs(f-Math.round(f*4)/4)<.01?(w?w:'')+F2:String(r1(n))};

// [label, part, units by default, note when the part is the nearest match, not the same food]
const T={chickenfried:['Fried chicken (1 piece)','chickenfried',.6],chickengrill:['Grilled or roasted chicken','chickengrill',1.5],chickencurry:['Chicken curry','chickencurry',.5],
  chickenwing:['Chicken wings','chickenwing',2],fishfried:['Fried fish','fishfried',1],fishbaked:['Grilled or baked fish','fishbaked',1],beefcurry:['Beef curry or rendang','beefcurry',.5,'Rendang: the nearest is USDA "Beef curry"'],
  eggfried:['Fried egg','eggfried',1],eggboiled:['Boiled egg','eggboiled',1],omelette:['Omelette or scrambled egg','omelette',1],duckegg:['Salted egg','duckegg',1,'Salted egg: the nearest is USDA "Duck egg, cooked"'],
  prawnfried:['Fried prawns','prawnfried',3],prawn:['Boiled prawns','prawn',3],squidfried:['Fried squid','squidfried',4],anchovy:['Ikan bilis','anchovy',5,'Ikan bilis: the nearest is USDA "Fish, anchovy"; dried fried anchovies are richer'],
  peanuts:['Peanuts','peanuts',.5],tofufried:['Fried tofu','tofufried',3],tempeh:['Tempeh','tempeh',.25],sausage:['Sausage','sausage',1],nugget:['Chicken nuggets','nugget',4],
  cucumber:['Cucumber','cucumber',.25],greens:['Ulam or raw greens','greens',1,'Ulam: the nearest is USDA "Lettuce, raw"'],stirveg:['Stir-fried vegetables','stirveg',.5],sprouts:['Bean sprouts','sprouts',.5],
  keropok:['Keropok (crackers)','keropok',3,'Keropok: the nearest is USDA "Shrimp chips"'],cheese:['Cheese slice','cheese',1],butter:['Butter or margarine','butter',1],
  sambal:['Sambal','m:Sambal Udang',1,'Sambal: the nearest is the canteen\'s Sambal Udang'],curry:['Curry gravy (kuah)','curry',3],dal:['Dal','dal',.25],peanutsauce:['Peanut sauce','peanutsauce',2],
  soy:['Soy sauce (kicap)','soy',1],chilisauce:['Chilli sauce','chilisauce',1],ketchup:['Ketchup','ketchup',1],mayo:['Mayonnaise','mayo',1],budu:['Budu','fishsauce',1,'Budu: the nearest is USDA "Fish sauce"'],
  kerisik:['Kerisik (toasted coconut)','coconut',.1,'Kerisik: the nearest is USDA "Coconut, fresh"; toasted coconut is drier and richer'],meatsauce:['Bolognese sauce','meatsauce',.5],
  condensed:['Condensed milk','condensed',.5],sugar:['Sugar (teaspoons)','sugar',2],milk:['Fresh milk','milk',2],
  burger:['Burger','burger',1],cheeseburger:['Cheeseburger','cheeseburger',1],pizza:['Pizza (slices)','pizza',2],fries:['French fries (cups)','fries',1],hotdog:['Hot dog','hotdog',1],
  doughnut:['Doughnut','doughnut',1],icecream:['Ice cream (scoop)','icecream',1],karipap:['Karipap (2 pieces)','m:Karipap Berinti Kentang',1],kuih:['Cucur (2 pieces)','m:Cucur Badak',1],
  apple:['Apple','apple',1],banana:['Banana','banana',1],orange:['Orange','orange',1],guava:['Guava','guava',1],papaya:['Papaya (slices)','papaya',2],watermelon:['Watermelon (canteen slice)','m:Tembikai Merah',1]};
// the main part's name and, where USDA has no exact match, which food stands in for it
const BASE={rice:['Rice'],ricecoco:['Coconut rice'],ricefried:['Fried rice'],riceoil:['Rice cooked with oil'],ricebrown:['Brown rice'],riceglut:['Glutinous rice'],noodle:['Noodles'],ricenoodle:['Rice noodles'],pasta:['Pasta'],
  paratha:['Roti canai or paratha','Roti canai: the nearest is USDA "Bread, paratha"'],chapati:['Chapati'],bread:['Bread'],tea:['Tea'],coffee:['Coffee'],chocmilk:['Chocolate malt drink','Milo: the nearest is USDA "Chocolate milk, whole"'],
  milk:['Milk'],soda:['Soft drink or sirap','Sirap: the nearest is USDA "Soft drink"'],oj:['Juice','The nearest is USDA "Orange juice"'],water:['Water'],chickensoup:['Chicken soup','Tom yam: the nearest is USDA "Soup, chicken, canned"'],vegsoup:['Vegetable soup'],beefsoup:['Beef soup']};
const TOPS=['chickenfried','chickengrill','chickencurry','fishfried','beefcurry','eggfried','eggboiled','omelette','duckegg','prawnfried','squidfried','anchovy','peanuts','tofufried','tempeh','sausage','cucumber','greens','stirveg','sprouts','keropok'];
const SAUCES=['sambal','curry','dal','peanutsauce','soy','chilisauce','ketchup','mayo','budu','kerisik'];

/* ---------- 2. his book: the questions he asks without the crystal ball (signed out, offline, or AI unavailable) ---------- */
// Each family: its main part and the questions that change the numbers most. Amount options are counts of the part's
// household measure from USDA (one cup of cooked rice = 158 g); the canteen plate is the menu's 200 g of rice.
const FAM=[['rice','A rice dish (nasi)'],['noodle','Noodles or pasta'],['bread','Bread, roti or chapati'],['fast','Burger, pizza or fast food'],['drink','A drink'],['soup','A soup'],['fruit','Fruit'],['snack','A snack, kuih or dessert'],['side','Meat, fish, egg or vegetables on their own'],['other','Something else']];
const FAMRE=[['rice',/\bnasi\b|\brice\b|pulut|b[ei]?r[iy]+an?i/],['noodle',/\b(mee|mi|bihun|kuey ?teow|kue?tiau|char kw?ay|laksa|noodles?|maggi|ramen|spaghetti|pasta|makaroni|macaroni|udon|pho)\b/],
  ['bread',/\broti\b|bread|toast|sandwich|chapati|paratha|prata|naan|murtabak/],['fast',/burger|pizza|nugget|fries|hot ?dog/],['soup',/\bsup\b|soup|tom ?yam/],
  ['drink',/\b(teh|tea|kopi|coffee|milo|susu|milk|air|juice|jus|soda|cola|sirap|drink|minuman|water)\b/],['fruit',/\b(fruit|buah|apple|epal|banana|pisang|orange|oren|guava|jambu|papaya|betik|tembikai|watermelon)\b/],
  ['snack',/kuih|cake|\bkek\b|donut|doughnut|karipap|curry puff|cucur|ice cream|ais krim|biscuit|keropok/],['side',/ayam|chicken|ikan|fish|daging|beef|telur|egg|udang|prawn|sotong|squid|tauhu|tofu|tempe|satay|sate|sayur|vegetable/]];
// dishes he recognises by name: what he assumes, and the usual sides he ticks for you to check (you can untick them)
const DISH=[[/nasi lemak/,{base:'ricecoco',tops:['peanuts','anchovy','eggboiled','cucumber','sambal']}],[/nasi kerabu/,{base:'rice',tops:['fishfried','duckegg','keropok','greens','kerisik','budu','sambal']}],
  [/nasi dagang/,{base:'ricecoco',tops:['fishbaked','eggboiled','curry']}],[/nasi goreng/,{base:'ricefried',tops:['eggfried','keropok','cucumber']}],[/nasi ayam|chicken rice/,{base:'riceoil',tops:['chickengrill','cucumber','chilisauce','soy']}],
  [/b[ei]?r[iy]+an?i|nasi minyak|nasi tomato/,{base:'riceoil',tops:['chickencurry','dal']}],[/nasi kandar/,{base:'rice',tops:['chickenfried','curry']}],[/nasi campur|nasi putih|economy rice/,{base:'rice'}],[/pulut/,{base:'riceglut'}],
  [/(mee|mi|maggi) goreng/,{base:'noodle',style:'fried',tops:['eggfried','stirveg']}],[/kue?y? ?te?o?w|kue?tiau|char kw?ay/,{base:'ricenoodle',style:'fried',tops:['prawnfried','sprouts','eggfried']}],
  [/bihun goreng/,{base:'ricenoodle',style:'fried',tops:['stirveg']}],[/laksa/,{base:'ricenoodle',style:'coco',tops:['sprouts','eggboiled']}],[/(mee|mi) kari|curry mee/,{base:'noodle',style:'coco',tops:['tofufried','sprouts']}],
  [/(mee|mi) sup|soto|bihun sup|pho|ramen/,{base:'noodle',style:'soup',tops:['chickengrill','sprouts']}],[/spaghetti|pasta|makaroni|macaroni/,{base:'pasta',style:'dry',tops:['meatsauce']}],
  [/roti telur/,{base:'paratha',tops:['omelette','curry','dal']}],[/roti canai|prata|paratha/,{base:'paratha',tops:['curry','dal']}],[/chapati/,{base:'chapati',tops:['dal']}],
  [/roti bakar|toast|sandwich/,{base:'bread',n:2,tops:['butter']}],[/cheese ?burger/,{tops:['cheeseburger']}],[/burger/,{tops:['burger']}],[/pizza/,{tops:['pizza']}],[/nugget/,{tops:['nugget']}],[/fries/,{tops:['fries']}],
  [/teh tarik|teh susu|teh c\b|milk tea/,{base:'tea',tops:['condensed']}],[/teh o|\btea\b|\bteh\b/,{base:'tea',tops:['sugar']}],[/kopi o|black coffee/,{base:'coffee',tops:['sugar']}],[/kopi|coffee/,{base:'coffee',tops:['condensed']}],
  [/milo/,{base:'chocmilk'}],[/air kosong|water/,{base:'water'}],[/susu|\bmilk\b/,{base:'milk'}],[/sirap|soda|cola|soft drink/,{base:'soda'}],[/jus|juice/,{base:'oj'}]];
const dishOf=t=>{const d=DISH.find(x=>x[0].test(t));return d?d[1]:{}};
const famOf=t=>{const f=FAMRE.find(x=>x[1].test(t));return f?f[0]:''};
const cupQ=(part,more)=>({id:'amt',q:'How much '+(part==='pasta'?'pasta':/noodle/.test(part)?'noodles':'rice')+' was there?',hint:'One cup of '+(BASE[part]||[part])[0].toLowerCase()+' is about '+(FP[part]?FP[part][8]:'?')+' g (USDA). '+more,
  opts:[['Half a cup',.5],['One cup',1],['One and a half cups',1.5],['Two cups (a big plate)',2],['Three cups',3]],def:1.5});
/** The book's next question for this food, or null when he is ready to guess. */
function bookNext(){const t=W.food.toLowerCase(),d=dishOf(t),fam=W.ans.fam||famOf(t)||'',A=W.ans;
  if(!fam)return{id:'fam',q:'What kind of food was it?',opts:FAM.map(f=>[f[1],f[0]])};
  if(fam==='other')return null;
  const base=A.base||d.base,steps=[];
  if(fam==='rice'){if(!base)steps.push({id:'base',q:'How was the rice cooked?',opts:[['Plain steamed (white or blue)','rice'],['With coconut milk (lemak, dagang)','ricecoco'],['Fried (nasi goreng)','ricefried'],['With oil, ghee or spices (ayam, beriyani)','riceoil'],['Brown rice','ricebrown'],['Glutinous (pulut)','riceglut']],def:'rice'});
    steps.push(cupQ(base||'rice','A Kolej MARA Kulim canteen plate of plain rice is 200 g.'))}
  if(fam==='noodle'){if(!base)steps.push({id:'base',q:'What kind of noodles?',opts:[['Yellow mee or instant noodles','noodle'],['Bihun or kuey teow (rice noodles)','ricenoodle'],['Spaghetti or macaroni','pasta']],def:'noodle'});
    if(!(A.style||d.style))steps.push({id:'style',q:'Were they fried, in soup, or dry?',opts:[['Fried','fried'],['In a clear soup','soup'],['In a coconut or curry soup','coco'],['Dry, with sauce','dry']],def:'fried'});
    steps.push(cupQ(base||'noodle','A canteen plate of mi goreng is 180 g.'))}
  if(fam==='bread'){if(!base)steps.push({id:'base',q:'What kind of bread?',opts:[['Roti canai or paratha','paratha'],['Chapati','chapati'],['Sliced bread or toast','bread']],def:'paratha'});
    steps.push({id:'amt',q:'How many pieces?',opts:[['One',1],['Two',2],['Three',3],['Four',4]],def:d.n||1})}
  if(fam==='drink'){if(!base)steps.push({id:'base',q:'What kind of drink?',opts:[['Tea','tea'],['Coffee','coffee'],['Milo or chocolate malt','chocmilk'],['Milk','milk'],['Soft drink or sirap','soda'],['Juice','oj'],['Plain water','water']],def:'tea'});
    steps.push({id:'amt',q:'How big was it?',opts:[['A cup (about 240 ml)',8],['A mug or glass (about 350 ml)',12],['A big glass or bottle (about 470 ml)',16]],def:8});
    if(['tea','coffee'].includes(base))steps.push({id:'tops',q:'What went in it? Tap all that apply.',multi:1,opts:['condensed','sugar','milk'].map(k=>[T[k][0],k])})}
  if(fam==='soup'){if(!base)steps.push({id:'base',q:'What kind of soup?',opts:[['Chicken soup or tom yam','chickensoup'],['Vegetable soup','vegsoup'],['Beef soup','beefsoup']],def:'chickensoup'});
    steps.push({id:'amt',q:'How many bowls (about one cup each)?',opts:[['Half a bowl',.5],['One bowl',1],['A big bowl (two cups)',2]],def:1})}
  const pick=L=>({id:'tops',q:'What did you have? Tap all that apply.',multi:1,opts:L.map(k=>[T[k][0],k])});
  if(fam==='fast')steps.push(pick(['burger','cheeseburger','pizza','nugget','fries','hotdog','chickenfried','chickenwing']));
  if(fam==='fruit')steps.push(pick(['apple','banana','orange','guava','papaya','watermelon']));
  if(fam==='snack')steps.push(pick(['karipap','kuih','doughnut','icecream','keropok']));
  if(['rice','noodle','bread','soup','side'].includes(fam))steps.push({id:'tops',q:fam==='side'?'What was on the plate? Tap all that apply.':'What came with it? Tap all that apply.',multi:1,opts:TOPS.map(k=>[T[k][0],k])});
  if(['rice','noodle','bread','side','fast'].includes(fam))steps.push({id:'sauce',q:'Any sauce, gravy or sambal? Tap all that apply.',multi:1,opts:(fam==='fast'?['chilisauce','ketchup','mayo']:SAUCES.concat(base==='pasta'?['meatsauce']:[])).map(k=>[T[k][0],k])});
  const pre=(d.tops||[]);steps.forEach(s=>{if(s.multi)s.pre=s.opts.map(o=>o[1]).filter(k=>pre.includes(k))});
  return steps.find(s=>!(s.id in A))||null}
/** The book's guess: the parts from the answers. */
function bookItems(){const t=W.food.toLowerCase(),d=dishOf(t),A=W.ans,fam=A.fam||famOf(t),base=A.base||d.base,L=[];
  const add=(k,n,label,near)=>{const v=partVal(k,n);if(v)L.push({k,n,x:1,label,near:near||''})};
  if(base&&fam!=='fast'&&fam!=='fruit'&&fam!=='snack'&&fam!=='side'){const b=BASE[base]||[base];add(base,A.amt!=null?A.amt:(d.n||1),b[0],b[1])}
  const style=A.style||d.style;
  if(fam==='noodle'&&style==='fried')add('oil',1,'Cooking oil','HealthWiz assumption: about 1 tablespoon of oil to fry a plate');
  if(fam==='noodle'&&(style==='soup'||style==='coco'))add('broth',1.5,'Soup broth','The nearest is USDA "Soup, chicken, canned"');
  if(fam==='noodle'&&style==='coco')add('coconutmilk',2,'Coconut milk in the soup','HealthWiz assumption: about 2 fl oz (60 g) of coconut milk');
  for(const k of [].concat(A.tops||[],A.sauce||[])){const x=T[k];if(x)add(x[1],x[2],x[0],x[3])}
  return L}

/* ---------- 3. the crystal ball: Gemini through the food-guess Edge Function (signed in) ---------- */
const AIERR={signin:'Sign in and I can use my crystal ball for any food.',offline:'You are offline, so my crystal ball is dark.',nokey:'My crystal ball is not set up on the server yet.',
  busy:'My crystal ball is busy right now.',limit:'That is a lot of guessing for one hour!',ai:'My crystal ball went cloudy.'};
async function ball(){const c=CL();if(!c||!c.who())throw{code:'signin'};if(navigator.onLine===false)throw{code:'offline'};
  try{return await c.api('/functions/v1/food-guess',{method:'POST',body:{food:W.food,answers:W.hist,ref:Object.keys(FP).map(k=>[k,FP[k][2]])},ms:30000})}
  catch(e){const b=e.body||{};throw{code:e.code==='net'?'offline':e.status===401||e.code==='auth'?'signin':e.status===429?'limit':b.error==='nokey'||e.code==='setup'?'nokey':b.error==='busy'?'busy':'ai'}}}
async function askBall(){W.busy=1;W.err='';draw();
  try{const r=await ball();W.busy=0;
    if(r&&r.ask){W.cur={id:'ai'+W.hist.length,q:r.ask.q,opts:r.ask.options.map(o=>[o,o]),multi:r.ask.multi?1:0,pre:[]};W.sel2=[];W.step='q'}
    else if(r&&r.guess){W.items=r.guess.items.map(i=>{const p=i.part&&FP[i.part];return p?{k:i.part,n:i.g/p[8],x:1,label:i.label,ai:1}:{k:'',x:1,label:i.label,v:{g:i.g,kcal:i.kcal,p:i.p,c:i.c,f:i.f}}});
      W.note=r.guess.note||'';W.step='guess'}
    else if(r&&r.unknown){W.step='ask';W.unknown=1}
    else throw{code:'ai'}}
  catch(e){W.busy=0;W.mode='book';W.note2=(AIERR[e.code]||AIERR.ai)+' I will use my book instead.';W.hist=[];startBook()}
  draw()}
function startBook(){W.mode='book';W.ans={};W.order=[];nextBook()}
function nextBook(){const q=bookNext();if(q){W.cur=q;W.sel2=(q.pre||[]).slice();W.step='q';return}
  if((W.ans.fam||famOf(W.food.toLowerCase()))==='other'){W.step='ask';W.err='That one is not in my book. Search for it below, sign in so I can use my crystal ball, or type it yourself in the form below.';return}
  W.items=bookItems();W.note='';W.step='guess'}

/** The values of one guessed part, after the player's adjustment (x). */
function itemVal(it){const x=it.x;if(it.k){const v=partVal(it.k,it.n*x);return v&&{...v,ai:it.ai}}
  const v=it.v;return{g:v.g*x,kcal:v.kcal*x,p:v.p==null?null:v.p*x,c:v.c==null?null:v.c*x,f:v.f==null?null:v.f*x,amt:fmt(v.g*x)+' g',src:'AI estimate (Google Gemini): not from a food database, not measured',aiOnly:1}}
function totals(){const t={kcal:0,p:0,c:0,f:0,g:0,miss:0};W.items.forEach(it=>{const v=itemVal(it);if(!v||!it.x)return;t.kcal+=v.kcal;['p','c','f'].forEach(k=>{if(v[k]==null)t.miss=1;else t[k]+=v[k]});if(v.g)t.g+=v.g});
  t.kcal=Math.round(t.kcal);['p','c','f','g'].forEach(k=>t[k]=r1(t[k]));return t}

/* ---------- 3. the search (canteen menu + USDA FoodData Central) ---------- */
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

/* ---------- 4. a search match's portion ---------- */
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
  if(W.step==='q')return W.order.length+W.hist.length<2?['three','determined']:['front','excited'];if(W.step==='guess')return['front','surprised'];
  if(W.step==='pick')return W.menu.length||W.db.length?['three','surprised']:['back','nervous'];if(W.step==='portion')return['front','determined'];return['front','happy']}
function say(){if(W.step==='done')return'Whoa, it worked! I mean... of course it worked. Your food is logged.';
  if(W.busy)return W.step==='portion'?'Reading the measures in the great book...':W.step==='pick'?'Searching the archive... give me a second!':'Hmm... let me look into my crystal ball...';
  if(W.err)return W.err;if(W.unknown)return'Hmm... that does not sound like a food or a drink to me. Try again?';
  if(W.step==='q')return W.cur.q;
  if(W.step==='guess')return'My guess: about '+totals().kcal+' kcal! Am I close?';
  if(W.step==='pick')return W.menu.length||W.db.length?'I found these! Which one did you eat?':'Hmm... I could not find that one. Try other words, or type it yourself below.';
  if(W.step==='portion')return'How much did you have? Pick the closest measure.';
  return'What did you eat? Tell me anything, and I will work out the calories... probably!'}
function scene(){const[p,f]=mood();
  return '<div class="awscene"><img class="awroom" src="'+ROOM+'" alt="" width="336" height="189"><span class="awfig'+(W.step==='done'?' cast':W.busy?' walk':'')+'" aria-hidden="true" data-pose="'+p+'" style="background-position:'+pat(POSES,p)+' 0"></span>'
    +'<div class="awsay" role="status"><span class="awface" role="img" aria-label="The Wannabe Wizard, '+f+'" data-face="'+f+'" style="background-position:'+pat(FACES,f)+' 0"></span><p><b>THE WANNABE WIZARD</b>'+esc(say())+'</p></div></div>'}

/* ---------- the steps ---------- */
function askStep(){return '<label for="awq"><b>What did you eat?</b></label><div class="row awq"><input id="awq" type="search" autocomplete="off" maxlength="80" placeholder="e.g. nasi kerabu, teh tarik, cheeseburger" value="'+esc(W.q)+'">'
    +'<button type="button" data-a="awgo"'+(W.busy?' disabled':'')+'>GUESS IT</button></div>'
    +'<small class="mut">'+(signed()?'He asks a few questions with his crystal ball (Google Gemini), then guesses the calories and macros, part by part.'
      :'Signed out: he uses his book (USDA FoodData Central and the canteen menu) for common foods. Sign in so his crystal ball (Google Gemini) can take any food.')+'</small>'
    +(W.note2?'<p class="mut awnote">'+esc(W.note2)+'</p>':'')
    +'<div class="row"><button type="button" class="g sm" data-a="awsearch">SEARCH THE BOOKS INSTEAD</button></div>'
    +(W.step==='pick'?pickList():'')}
function qStep(){if(W.busy)return '<p class="mut">Thinking about <b>'+esc(W.food)+'</b>...</p>';
  const q=W.cur,n=(W.mode==='ai'?W.hist.length:W.order.length)+1;
  const opts=q.multi?'<div class="awopts" role="group" aria-label="Your answer">'+q.opts.map((o,i)=>{const on=W.sel2.includes(o[1]);return '<button type="button" class="chip awo'+(on?' on':'')+'" data-a="awtog" data-i="'+i+'" aria-pressed="'+on+'">'+esc(o[0])+'</button>'}).join('')+'</div>'
      +'<div class="row"><button type="button" data-a="awdone">'+(W.sel2.length?'DONE':'NONE OF THESE')+'</button></div>'
    :'<div class="awopts awone" role="group" aria-label="Your answer">'+q.opts.map((o,i)=>'<button type="button" class="g awo" data-a="awopt" data-i="'+i+'">'+esc(o[0])+'</button>').join('')+'</div>';
  return '<p class="awqn"><b>QUESTION '+n+' · '+esc(W.food)+'</b>'+esc(q.q)+(q.hint?'<small>'+esc(q.hint)+'</small>':'')+(q.multi&&q.pre&&q.pre.length?'<small>I ticked what usually comes with it. Untick what you did not have.</small>':'')+'</p>'+opts
    +'<div class="row"><button type="button" class="g sm" data-a="awunsure">NOT SURE</button>'+(n>1?'<button type="button" class="g sm" data-a="awundo">UNDO</button>':'')+'<button type="button" class="g sm" data-a="awrestart">START OVER</button></div>'
    +(W.note2&&W.mode==='book'?'<p class="mut awnote">'+esc(W.note2)+'</p>':'')}
/** The guess card: the total, then every part with its amount, its values and where they come from. */
function guessCard(){const t=totals(),edit=W.step==='guess';
  const rows=W.items.map((it,i)=>{const v=itemVal(it);if(!v)return'';const off=!it.x;
    return '<li class="awpart'+(off?' off':'')+'"><div><b>'+esc(it.label)+'</b><small>'+(off?'left out':esc(v.amt))+'</small></div><span class="awpk">'+(off?'0':Math.round(v.kcal))+' kcal</span>'
      +(edit?'<span class="awadj"><button type="button" class="g sm" data-a="awadj" data-i="'+i+'" data-d="-1" aria-label="Less '+esc(it.label)+'">−</button><button type="button" class="g sm" data-a="awadj" data-i="'+i+'" data-d="1" aria-label="More '+esc(it.label)+'">+</button></span>':'')
      +'<small class="awps">'+(off?'':'P '+fmt(v.p)+' g · C '+fmt(v.c)+' g · F '+fmt(v.f)+' g · ')+esc(v.src)+(it.near?'. '+esc(it.near):'')+(it.ai&&it.k?'. Weight: AI estimate; values for that weight from USDA':'')+'</small></li>'}).join('');
  const anyAi=W.items.some(it=>!it.k||it.ai),anyNear=W.items.some(it=>it.near);
  return '<div class="awcard awguessc'+(W.step==='done'?' reveal':'')+'" id="awcard"><small>MY GUESS · '+esc(W.name||W.food)+'</small><b class="awbig">about '+t.kcal+' kcal</b>'
    +'<table class="awtab"><tbody><tr><th scope="row">Protein</th><td>'+fmt(t.p)+' g</td></tr><tr><th scope="row">Carbohydrate</th><td>'+fmt(t.c)+' g</td></tr><tr><th scope="row">Fat</th><td>'+fmt(t.f)+' g</td></tr></tbody></table>'
    +'<ul class="awparts">'+rows+'</ul>'
    +'<p class="mut">This is an <b>estimate</b>, not a measurement: the total is the sum of the parts. USDA part = value per 100 g × grams ÷ 100.'
    +(anyAi?' Parts marked "AI estimate" come from Google Gemini and can be wrong.':'')+(anyNear?' Some parts use the nearest food in the database.':'')+' Portions and recipes vary, so adjust any part with − and +.</p>'
    +(W.note?'<p class="mut">His assumption: '+esc(W.note)+'</p>':'')+'</div>'}
function guessStep(){return guessCard()
  +'<label>Name<input id="awname" maxlength="60" value="'+esc(W.name||W.food)+'"></label>'
  +'<label>Meal<select id="awmeal">'+MEALS.map(m=>'<option value="'+m[0]+'"'+((W.meal||S.meal)===m[0]?' selected':'')+'>'+esc(m[1]||m[0])+'</option>').join('')+'</select></label>'
  +'<div class="row"><button type="button" data-a="awlog"'+(totals().kcal>0||W.items.some(i=>i.x)?'':' disabled')+'>CLOSE ENOUGH, LOG IT</button><button type="button" class="g" data-a="awundo">CHANGE AN ANSWER</button><button type="button" class="g" data-a="awrestart">START OVER</button></div>'
  +'<small class="mut">Nothing is saved until you log it.</small>'}
function doneStep(){return(W.done&&W.done.est?guessCard():card())+'<div class="row"><button type="button" data-a="awmore">ADD ANOTHER FOOD</button><button type="button" class="g" data-a="awclose">DONE</button></div>'}

function body(){if(W.step==='done')return doneStep();if(W.step==='portion')return portionStep();if(W.step==='q')return qStep();if(W.step==='guess')return guessStep();return askStep()}
function wizard(){return '<div class="card awcardo" id="awiz"><h3>'+ico('food')+' ADD MORE FOOD</h3>'+scene()+'<div id="awbody">'+body()+'</div></div>'}
function draw(){const el=D.getElementById('awiz');if(!el)return;const f=D.activeElement&&D.activeElement.id;el.outerHTML=wizard();const n=f&&D.getElementById(f);if(n)n.focus()}

/* ---------- actions ---------- */
const keepName=()=>{const n=D.getElementById('awname'),m=D.getElementById('awmeal');if(n)W.name=n.value;if(m)W.meal=m.value};
acts.awgo=()=>{const i=D.getElementById('awq');W.q=i?i.value:W.q;const f=String(W.q||'').trim().slice(0,80);
  if(!f){W.err='Tell me what you ate first, for example: nasi kerabu, teh tarik, a cheeseburger.';draw();return}
  Object.assign(W,{food:f,err:'',unknown:0,note2:'',hist:[],ans:{},order:[],items:[],note:'',name:'',meal:''});
  if(signed()){W.mode='ai';W.step='q';W.cur=null;askBall()}else{startBook();draw()}};
const answer=v=>{const q=W.cur;if(!q)return;
  if(W.mode==='ai'){W.hist.push({q:q.q,a:v});askBall();return}
  W.ans[q.id]=v;W.order.push(q.id);nextBook();draw()};
acts.awopt=d=>{const o=W.cur&&W.cur.opts[+d.i];if(o)answer(W.mode==='ai'?o[0]:o[1])};
acts.awtog=d=>{const o=W.cur&&W.cur.opts[+d.i];if(!o)return;const k=o[1],j=W.sel2.indexOf(k);if(j<0)W.sel2.push(k);else W.sel2.splice(j,1);draw()};
acts.awdone=()=>{const q=W.cur;if(!q)return;answer(W.mode==='ai'?(W.sel2.length?W.sel2.join(', '):'None of these'):W.sel2.slice())};
acts.awunsure=()=>{const q=W.cur;if(!q)return;answer(W.mode==='ai'?'Not sure':q.multi?(q.pre||[]).slice():q.def!=null?q.def:q.opts[0][1])};
acts.awundo=()=>{if(W.mode==='ai'){if(!W.hist.length){W.step='ask';draw();return}W.hist.pop();askBall();return}
  const id=W.order.pop();if(id==null){W.step='ask';draw();return}delete W.ans[id];nextBook();draw()};
acts.awrestart=()=>{const q=W.q;reset();W.q=q;draw();const i=D.getElementById('awq');if(i)i.focus()};
acts.awadj=d=>{keepName();const it=W.items[+d.i];if(!it)return;it.x=Math.max(0,Math.min(4,r1(it.x+(+d.d)*.5)));draw()};
acts.awlog=()=>{keepName();const t=totals();if(!W.items.length)return;const name=String(W.name||W.food).trim().slice(0,60)||W.food,meal=W.meal||S.meal;
  const w=HWWhen.stamp({sig:'aw'+name+t.kcal});if(!w)return;
  const parts=W.items.filter(i=>i.x).map(i=>{const v=itemVal(i);return[i.label,v.g==null?null:r1(v.g),Math.round(v.kcal),i.k?(i.k.startsWith('m:')?'menu':i.ai?'usda+ai':'usda'):'ai']});
  add('food',t.kcal,{name,por:'Wizard\'s estimate from '+parts.length+' part'+(parts.length>1?'s':''),qty:1,meal,src:'Wannabe Wizard estimate',custom:1,db:'est',how:W.mode,g:t.g,
    p:t.miss?'':t.p,c:t.miss?'':t.c,f:t.miss?'':t.f,fb:'',parts},'',w.d,w.t,10,'Food logged');
  HWWhen.saved(w,'Food');W.step='done';W.done={est:1};const y=window.scrollY;render();window.scrollTo(0,y)};
// the search
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
.awqn{margin:6px 0;font-size:17px}.awqn b{display:block;font:8px/1.8 var(--fh);color:var(--gold,#f6c94f);overflow-wrap:anywhere}.awqn small{display:block;font-size:13px;color:var(--mut);margin-top:3px}
.awopts{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.awopts{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr))}.awopts .awo{min-height:44px;margin:0;text-align:left;white-space:normal;line-height:1.25}.awopts.awone{grid-template-columns:1fr}
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
return{menuMatches,measures,calc,kind,partVal,bookNext,bookItems,totals,famOf,dishOf,T,get state(){return JSON.parse(JSON.stringify(W))},POSES,FACES}})();
