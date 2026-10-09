/* v6 (RPG upgrades, part B): the Dream Battle on the Sleep page (card #dbatc). Not part of the original.
   Replaces the original five-picture battle (dbat / dbState, js/hw-05-v5-4-module.js) with a rigged knight (js/v6-rig.js)
   fighting the orc in a torch-lit dungeon, where the knight's strength follows the logged sleep CONTINUOUSLY.

   1. SLEEP → STRENGTH (strength(), 0…1, shown as 0–100). Uses the last logged night plus the two nights before it:
        duration  D(h) against the age goal [lo, hi] (AASM / CDC, SR() in the original):
                    h < lo         0.85 · ((h − 0.4·lo) / (0.6·lo))^1.3     0 at 40% of lo, 0.85 at lo
                    lo … mid       0.85 → 1.00 linearly                      mid = (lo + hi) / 2
                    mid … hi + 1   1.00
                    beyond         1 − 0.08 per extra hour (at least 0.70)   very long nights are not "stronger"
        recent    Deff = 0.75·D(last night) + 0.25·mean D(up to two earlier nights logged in the 3 days before it)
        quality   Q = 0.5·(restfulness − 1)/4 + 0.3·(1 − min(awakenings, 4)/4) + 0.2·latency
                  latency = 1 up to 15 min to fall asleep, then −1/60 per minute (at least 0.3)
        strength  S = Deff · (0.7 + 0.3·Q)        duration matters most; quality moves it by up to 30%
      With the defaults (restfulness 3, one awakening, 15 min), a 16-year-old (goal 8–10 h) gets
      4 h → 7 · 6 h → 38 · 7.2 h → 61 · 8.5 h → 83 · 9 h rested (5/5, no awakenings) → 100.
   2. BATTLE (plan(), deterministic: the same night always plays the same battle).
        The knight has up to 4 swings. Each deals 25·S/0.70 damage, so S ≥ 0.70 defeats the orc (100 HP), and the
        stronger he is the fewer swings it takes. Below 0.70 the orc survives with what is left, so the battle shows
        how close a little more sleep would bring the win. Swing speed, lunge reach, hit size, glow and how often
        his shield blocks the orc's counter all scale with S. Energy bar = S, minus effort and unblocked hits.
        Win: the orc falls, the portcullis rises and the princess is free. Loss: the knight ends tired or on one knee.
   3. SCENE layers (HWRig.paint, once per session): stone wall with torchlight baked into each block, an alcove with
      a portcullis and the princess, banner, chains, a perspective floor; foreground pillars and rubble. CSS on top:
      flickering flames and glow (opacity / scale only), shadows that sway with the flame, dust and embers.
      The princess, Princess Lyra of the Dream Realm, is an original pixel sprite drawn here.
   The battle plays once per logged night per visit (REPLAY plays it again), and starts by itself right after a sleep log
   is saved (SKIP shows the outcome at once); reduced motion shows the outcome still.
   Game visual of logged sleep only, never a medical measurement. */
const HWDream=(()=>{
const W=320,H=180,X=v=>(v/W*100).toFixed(2)+'%',Y=v=>(v/H*100).toFixed(2)+'%';
const T=0.70,ROUNDS=4;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

/* ---------- 1. sleep → strength ---------- */
function dur(h,lo,hi){const mid=(lo+hi)/2;if(!(h>0))return 0;
  if(h<lo)return .85*Math.pow(clamp((h-.4*lo)/(.6*lo),0,1),1.3);
  if(h<mid)return .85+.15*(h-lo)/(mid-lo);
  if(h<=hi+1)return 1;
  return Math.max(.7,1-.08*(h-hi-1))}
function quality(m){m=m||{};const rest=clamp(+m.rest||3,1,5),aw=clamp(+m.aw||0,0,4),lat=Math.max(0,+m.lat||0);
  const lq=lat<=15?1:Math.max(.3,1-(lat-15)/60);return .5*(rest-1)/4+.3*(1-aw/4)+.2*lq}
const day=s=>{const p=String(s||'').split('-');return Date.UTC(+p[0],+p[1]-1,+p[2])/864e5};
/** Strength from the sleep log: {s (0…1), d, q, deff, prev, last, lo, hi} or null without a logged night. */
function strength(list,age){const L=(list||[]).filter(e=>+e.v>0).slice().sort((a,b)=>(a.d+(a.t||'')).localeCompare(b.d+(b.t||'')));
  const last=L[L.length-1];if(!last)return null;const g=SR(+age||16),lo=g[0],hi=g[1];
  const d=dur(+last.v,lo,hi),q=quality(last.m),t0=day(last.d);
  const prev=L.slice(0,-1).filter(e=>{const k=t0-day(e.d);return k>=1&&k<=3}).slice(-2);
  const pd=prev.length?prev.reduce((a,e)=>a+dur(+e.v,lo,hi),0)/prev.length:null;
  const deff=pd==null?d:.75*d+.25*pd;
  return{s:clamp(deff*(.7+.3*q),0,1),d,q,deff,prev:prev.map(e=>+e.v),last,lo,hi}}
const TIER=[[.2,'EXHAUSTED','Very poor sleep: the knight can barely lift his sword.'],[.45,'WEARY','Poor sleep: slow, heavy swings.'],[.7,'SHORT ON REST','A little short: close, but not quite enough.'],[.9,'READY','Enough sleep: strong and quick.'],[1.01,'FULLY POWERED','Rested and in range: full power.']];
const tier=s=>TIER.findIndex(t=>s<t[0]);

/* ---------- 2. the battle plan ---------- */
function plan(s){const dmg=25*s/T,rounds=[];let hp=100,en=Math.round(s*100);
  for(let i=0;i<ROUNDS&&hp>0;i++){const hit=Math.max(1,Math.round(dmg+(i%2?-1:1)*s*2));hp=Math.max(0,hp-hit);en=Math.max(0,en-4);
    const r={hit,hp,en};if(hp>0){r.block=s>=.45+.12*i;if(!r.block)en=Math.max(0,en-9);r.en2=en}rounds.push(r)}
  return{s,win:hp<=0,hp,en,rounds,atk:(1.15-.5*s).toFixed(2),reach:(5+11*s).toFixed(1)}}

/* ---------- 3. the dungeon ---------- */
const TORCH=[[44,70],[224,64]],ALC=[236,48,300,128];
function back(){return HWRig.paint('db-back',W,H,d=>{const R=d.rnd,M=HWRig.mix;
  const lit=(x,y)=>{let l=0;TORCH.forEach(t=>{const k=Math.hypot(x-t[0],(y-t[1])*1.3);l=Math.max(l,1-k/92)});return clamp(l,0,1)};
  d.r(0,0,W,H,'#0d0b14');
  // wall blocks: offset rows, each block lit by its distance to the torches, a highlight on the top-left edges
  for(let y=6,row=0;y<130;y+=11,row++)for(let x=-(row%2)*9;x<W;x+=18){const l=lit(x+9,y+5),v=R()*.12;
    const base=M('#1c1a26','#6b5a4a',clamp(Math.pow(l,1.35)*1.1+v*.5,0,1)),hi=M(base,'#e8c08a',.18+l*.2),lo=M(base,'#000000',.45);
    d.r(x+1,y+1,16,9,base);d.r(x+1,y+1,16,1,hi);d.r(x+1,y+1,1,9,hi);d.r(x+1,y+9,16,1,lo);d.r(x+16,y+1,1,9,lo);
    if(R()<.18)d.r(x+4+R()*8,y+3+R()*4,2+R()*4,1,lo);if(R()<.1)d.r(x+2,y+7,4,2,M('#2f4a2a','#4f8f3a',l))}
  // ceiling vault
  d.r(0,0,W,7,'#08070d');for(let x=0;x<W;x+=40){d.poly([x,0,x+40,0,x+40,4,x+20,9,x,4],'#15131d');d.r(x+19,4,2,6,'#24202e')}
  // the alcove: deep, cold, a moon window
  const[a0,a1,a2,a3]=ALC,ac=(a0+a2)/2;
  d.poly([a0-4,a3,a0-4,a1+14,ac-18,a1-6,ac+18,a1-6,a2+4,a1+14,a2+4,a3],'#3a3240');
  d.poly([a0,a3,a0,a1+16,ac-16,a1-2,ac+16,a1-2,a2,a1+16,a2,a3],'#0a0912');
  d.poly([a0+4,a3,a0+4,a1+20,ac-12,a1+4,ac+12,a1+4,a2-4,a1+20,a2-4,a3],'#14121e');
  for(let y=a1+24;y<a3;y+=10)for(let x=a0+6+(y%20?0:7);x<a2-6;x+=14)d.r(x,y,12,8,M('#1a1826','#2a3050',(y-a1)/90*.4));
  d.r(ac-6,a1+10,12,14,'#2a3c6a');d.r(ac-5,a1+11,10,12,'#5a78b8');[ac-3,ac,ac+3].forEach(x=>d.r(x-1,a1+10,1,14,'#1b1626'));d.r(ac-6,a1+16,12,1,'#1b1626');
  for(let i=0;i<9;i++){const sx=a0-3+i*1,sy=a1+12-Math.abs(i-4)*1.5;d.r(sx,sy,1,2,'#5a5060')}
  d.r(a0,a3-2,a2-a0,2,'#221f2c');
  // banner of the Dream Realm and chains
  d.r(118,14,30,2,'#4a2f18');d.poly([120,16,146,16,146,58,133,52,120,58],M('#3a2a6a','#6a4aa8',lit(133,36)));d.r(120,16,26,2,'#f2c14e');
  d.ell(133,32,6,6,'#f2c14e');d.ell(136,30,5,5,M('#3a2a6a','#6a4aa8',lit(133,36)));d.speck(122,20,22,30,['#8f7ad0'],8);
  [[90,8,34],[170,8,46],[300,8,24]].forEach(c=>{for(let y=c[1];y<c[1]+c[2];y+=4){d.r(c[0],y,2,3,'#3a3640');d.r(c[0],y,1,1,'#7a7480')}d.r(c[0]-2,c[1]+c[2],6,3,'#2a2630')});
  d.r(14,60,8,2,'#3a3640');d.r(16,62,2,10,'#3a3640');d.r(14,72,6,3,'#2a2630');
  // torch sconces
  TORCH.forEach(t=>{d.r(t[0]-3,t[1]+4,6,3,'#2a2630');d.r(t[0]-2,t[1],4,10,'#5b3a1e');d.r(t[0]-1,t[1],1,10,'#8a5a2b');d.r(t[0]-4,t[1]-2,8,3,'#3a3640')});
  // the base of the wall, then a perspective floor lit by the torches
  d.r(0,126,W,4,'#0a0910');
  const rows=[130,134,139,145,152,160,169,180];
  for(let i=0;i<rows.length-1;i++){const y0=rows[i],y1=rows[i+1],n=8+i*2;for(let j=-n;j<=n;j++){
    const xa=160+(j-.5)*(18+i*7),xb=xa+(18+i*7),l=lit((xa+xb)/2,y0-28)*0.9+i*.03+R()*.06;
    const c=M('#15131d','#5a4a3e',clamp(l,0,1));d.r(xa+1,y0+1,xb-xa-1,y1-y0-1,c);d.r(xa+1,y0+1,xb-xa-1,1,M(c,'#d8b080',.15))}}
  d.speck(0,132,W,48,['#0a0910','#3a3240'],180);
  d.ell(124,166,16,3,'#1d2a3a');d.ell(122,165,10,2,'#3a5070');d.r(118,165,4,1,'#e8a060');
  // corner cobweb and dark edges
  for(let i=0;i<12;i++)d.r(0,i,12-i,1,i%3?'#14121c':'#4a4650');
  for(let x=0;x<W;x++){const k=Math.min(x,W-1-x);if(k<26)d.r(x,0,1,H,'rgba(5,4,10,'+(.55*(1-k/26)).toFixed(2)+')')}
},31)}
function front(){return HWRig.paint('db-front',W,H,d=>{const R=d.rnd;
  d.r(0,0,14,H,'#07060b');d.r(14,0,3,H,'#1d1a26');for(let y=4;y<H;y+=12)d.r(2,y,10,1,'#15131d');
  d.r(306,0,14,H,'#07060b');d.r(303,0,3,H,'#1d1a26');for(let y=8;y<H;y+=12)d.r(308,y,10,1,'#15131d');
  [[24,176,9],[46,179,5],[284,177,8],[262,179,4],[150,180,5]].forEach(q=>{d.ell(q[0],q[1],q[2]+1,q[2]*.6+1|0,'#0b0a10');d.ell(q[0]-1,q[1]-1,q[2],q[2]*.6|0,'#2a2632');d.r(q[0]-q[2]+2,q[1]-q[2]*.5,3,1,'#4a4552')});
  d.speck(16,170,288,10,['#2a2632','#0b0a10'],60);
  for(let y=0;y<30;y+=4){d.r(60,y,2,3,'#0b0a10');d.r(60,y,1,1,'#3a3640')}},37)}

/* ---------- the princess (original sprite: Princess Lyra of the Dream Realm) ---------- */
// 32×48, one letter per pixel ('.' empty); the ink outline is added in code. Overlays: arms clasped (worried), arms up
// and a smile (freed).
const PRC={k:'#1b1626',h:'#e4d8ff',H:'#b9a6ec',J:'#8a74c8',s:'#f2c4a0',S:'#d99c78',e:'#2b2440',i:'#5a7fd8',w:'#fffbea',p:'#f4a0a8',r:'#c4506a',c:'#eef0f8',C:'#a8aec4',m:'#8fd4ff',M:'#3a8fd0',d:'#3aa0b8',D:'#23708a',E:'#164f66',l:'#7fd0de',a:'#bfeaf2',g:'#f2c14e',G:'#c08a2a',v:'#9a7ae0',b:'#3a2a4a'};
const PROWS="................w............................c..m..c.........................cCcMcCc......................JHhcCcmcCchHJ..................JHhhhhhhhhhhhHJ................JHhwwhhhhhhhwwhHJ...............JHhhhwhhHhhwhhhHJ..............JHhhhHhhhhhhhHhhhHJ.............JHhhHsshhhhhsshHhHJ.............JHhssHHsssssHHsshHJ.............JHhsseeessseeesshHJ.............JHhssiwisssiwisshHJ.............JHhssMiisssiiMsshHJ.............JHhsppsssSsssppshHJ.............JHhssssssrsssssshHJ.............JHhhSsssssssssShhHJ.............JHhhhSssssssShhhhHJ.............JHhhhhhSsssShhhhhHJ............JHhhvvggggmggggvvhhHJ...........JHhvvvdllddddDDvvvhHJ...........JHhvvdlldddddDDDvvhHJ...........JHhHvdllddmddDDDvHhHJ...........JHhHhdlldddddDDDhHhHJ...........JHhHhggggggggggghHhHJ...........JHhHddllddddddDDDDhHJ..........JH.ddllldgaaagDDEEE.HJ..........HJ.ddllldgaaagDDEEE.JH..........JH.ddllldgaaagDDEEE.HJ.........HJ.dddlwldgaaagDDDEEE.JH........JH.dddllldgaaagDDDEEE.HJ........HJ.dddllldgaaagDDDEEE.JH........J.dddlllldgaaagDDwDEEE.J..........dddlllldgaaagDDDDEEE............dddwlllgaaaaagDDDEEE...........dddlllldwaaaaagDDDDEEE..........dddlllldgaaaaagDDDDEEE..........dddlllldgaaaaagDDwDEEE.........dddllllldgaaaaagDDDDEEEE........dddlllwldgaaaaagDDDDEEEE........dddllllldgaaaaagDDDDEEEE.......ddddllllddgaaaawgdDDDDEEEE......ddddlllldgaaaaaaawDDDDEEEE......ddddlllldgaaaaaaagDDDDEEEE.....ddddllllldgaaaaaaagDDDDDEEEE....gwgwgwgwgwgwgwgwgwgwgwgwgwgw....GGGGGGGGGGGGGGGGGGGGGGGGGGGG..............bb....bb............................................";
const POV={dn:{"22":[[9,"vS.........Sv"]],"23":[[10,"Ss.........sS"]],"24":[[11,"sS.......Ss"]],"25":[[13,"SsssssS"]],"26":[[14,"sSsSs"]]},up:{"8":[[3,"ss"],[27,"ss"]],"9":[[3,"ss"],[27,"ss"]],"10":[[4,"vs"],[26,"sv"]],"11":[[4,"vv"],[26,"vv"]],"12":[[4,"vv"],[26,"vv"]],"13":[[5,"vv"],[25,"vv"]],"14":[[5,"vv"],[25,"vv"]],"15":[[6,"vv"],[24,"vv"]],"16":[[6,"vv"],[24,"vv"]],"17":[[7,"vv"],[23,"vv"]]},happy:{"10":[[10,"sssssssssssss"]],"11":[[10,"sseeessseeess"]],"12":[[10,"ssMsssssssMss"]],"14":[[10,"sssssrwrsssss"]]}};
function pgrid(ovs){const g=[];for(let y=0;y<48;y++)g.push(PROWS.slice(y*32,y*32+32).split(''));
  ovs.forEach(o=>{for(const r in o)o[r].forEach(q=>{for(let i=0;i<q[1].length;i++)if(q[1][i]!=='.')g[r][q[0]+i]=q[1][i]})});
  const o=g.map(r=>r.slice());for(let y=0;y<48;y++)for(let x=0;x<32;x++)if(g[y][x]==='.'&&[[1,0],[-1,0],[0,1],[0,-1]].some(v=>{const c=(g[y+v[1]]||[])[x+v[0]];return c&&c!=='.'}))o[y][x]='k';return o}
function svgOf(g,cls){let r='';g.forEach((row,y)=>{let x=0;while(x<row.length){const c=row[x];let n=1;while(row[x+n]===c)n++;if(c!=='.')r+='<rect x="'+x+'" y="'+y+'" width="'+n+'" height="1" fill="'+PRC[c]+'"/>';x+=n}});
  return '<svg class="'+cls+'" viewBox="0 0 32 48" shape-rendering="crispEdges" aria-hidden="true">'+r+'</svg>'}
let PSVG=null;
function princess(){return PSVG||(PSVG=svgOf(pgrid([POV.dn]),'pa-dn')+svgOf(pgrid([POV.up,POV.happy]),'pa-up'))}

/* ---------- markup ---------- */
const played={};let run=null;
const bar=(cls,v)=>'<span class="db6bar '+cls+'"><i style="width:'+Math.round(v)+'%"></i></span>';
function hud(p,st0){return '<div class="db6hud"><div class="d-kn"><b>KNIGHT</b>'+bar('d-en',st0?p.s*100:p.en)+'<small>STR <span class="num">'+Math.round(p.s*100)+'</span></small></div>'
  +'<div class="d-rd" aria-hidden="true"></div>'
  +'<div class="d-or"><b>NIGHTMARE ORC</b>'+bar('d-hp',st0?100:p.hp)+'<small>HP <span class="num">'+(st0?100:p.hp)+'</span></small></div></div>'}
function scene(p,live){const t=p?tier(p.s):-1,L=p?TIER[t][1]:'READY FOR BATTLE',fin=!live&&p;
  const motes=HWMotion.count(10);let m='';for(let i=0;i<motes;i++)m+='<i style="left:'+(8+i*29%84)+'%;top:'+(20+i*17%50)+'%;--d:'+(6+i%3*2)+'s;animation-delay:-'+(i*1.7%7).toFixed(1)+'s"></i>';
  const em=TORCH.map((q,j)=>[0,1,2].map(i=>'<u style="left:'+X(q[0]+(i-1)*2)+';top:'+Y(q[1]-8)+';animation-delay:-'+(i*.6+j*.3).toFixed(1)+'s"></u>').join('')).join('');
  const kpose=!p?'ready':fin?(p.win?'win':p.s<.35?'down':'tired'):(p.s<.35?'tired':'ready');
  const opose=fin?(p.win?'defeat':'taunt'):'idle';
  return '<div class="db6 '+(fin?(p.win?'d-won':'d-lost'):'')+'" id="dbat" role="img" aria-label="Dream battle: '+(p?'sleep strength '+Math.round(p.s*100)+' of 100, '+(p.win?'the knight defeats the orc and frees the princess':'the orc holds; more sleep would give the knight the strength to win'):'log a night of sleep to start the battle')+'"'
    +(p?' style="--atk:'+p.atk+'s;--glow:'+(p.s*p.s).toFixed(2)+'"':'')+'><div class="db6s">'
  +'<img class="db6l" alt="" src="'+back()+'">'
  +'<div class="db6moon" style="left:'+X(ALC[0]+22)+';top:'+Y(ALC[1]+8)+';width:'+X(20)+';height:'+Y(80)+'"></div>'
  +'<div class="db6pr '+(fin&&p.win?'d-free':'')+'" style="left:'+X(268)+';top:'+Y(126)+'">'+princess()+'</div>'
  +'<div class="db6gate '+(fin&&p.win?'d-up':'')+'" style="left:'+X(ALC[0])+';top:'+Y(ALC[1]+10)+';width:'+X(ALC[2]-ALC[0])+';height:'+Y(ALC[3]-ALC[1]-10)+'"><i></i></div>'
  +TORCH.map((q,i)=>'<div class="db6tg d-t'+i+'" style="left:'+X(q[0])+';top:'+Y(q[1])+'"></div><div class="db6fl d-t'+i+'" style="left:'+X(q[0])+';top:'+Y(q[1]-1)+'"><i></i><i></i><i></i></div>').join('')
  +'<div class="db6ch db6o'+(fin&&p.win?' d-gone':'')+'" style="--x:'+X(206)+';top:'+Y(161)+'"><b class="db6sd"></b>'+HWRig.orc({pose:opose})+'</div>'
  +'<div class="db6sm" style="left:'+X(200)+';top:'+Y(110)+'"><i></i><i></i><i></i><i></i></div>'
  +'<div class="db6ch db6k" style="--x:'+X(80)+';top:'+Y(163)+'"><b class="db6sd"></b><div class="db6au"></div>'+HWRig.knight({pose:kpose})
    +(p&&p.s<.45?'<span class="db6z">z</span><span class="db6z" style="--l:1.3s;margin-left:14%">Z</span>':'')+'</div>'
  +'<div class="db6fx"></div>'
  +'<img class="db6l db6fg" alt="" src="'+front()+'">'
  +'<div class="db6mo">'+m+em+'</div>'
  +'</div>'+(p?hud(p,!fin):'')+'<div class="db6lb">'+(fin?(p.win?'VICTORY · PRINCESS FREED':'THE ORC HOLDS'):L)+'</div>'
  +(fin&&p.win?'<div class="db6rw">'+HWPixel.icon('achievement')+'<span>PRINCESS LYRA RESCUED</span></div>':'')+'</div>'}

function scale(p){const pos=Math.round(p.s*100);
  return '<div class="db6sc" aria-hidden="true"><div class="d-tr">'+TIER.map((t,i)=>'<i style="flex:'+Math.round(((t[0]>1?1:t[0])-(i?TIER[i-1][0]:0))*100)+'" class="d-z'+i+'"></i>').join('')+'</div>'
    +'<b class="d-mk" style="left:'+pos+'%"></b><b class="d-vt" style="left:'+(T*100)+'%"><span>WIN</span></b></div>'
    +'<div class="db6tl"><span>EXHAUSTED</span><span>WEARY</span><span>SHORT</span><span>READY</span><span>FULL</span></div>'}

function card(){const l=LC('sleep'),p0=strength(l,st.p.age);
  if(!p0)return scene(null,false)+'<p style="margin:0 0 4px">Log last night\'s sleep to begin the battle. The more rested the knight, the stronger he fights.</p>';
  const p=plan(p0.s),key=p0.last.id+':'+Math.round(p.s*1000),live=!played[key]&&!HWMotion.reduced(),t=tier(p.s);
  const qn=p0.last.m||{},prev=p0.prev.length?' · earlier nights '+p0.prev.map(v=>v+' h').join(', '):'';
  const cap=p.win?(p.rounds.length<ROUNDS?'Well rested: the knight wins in '+p.rounds.length+' strikes and frees the princess.':'Rested enough: the knight wears the orc down and frees the princess.')
    :'The orc holds with '+p.hp+' HP left. '+(p.s>=.55?'So close: a little more sleep would win this fight.':p.s>=.3?'More sleep would give the knight the strength he needs.':'The knight is exhausted. A full night\'s rest changes everything.');
  return scene(p,live)
  +'<p class="db6cap" style="margin:0 0 6px"><b>'+TIER[t][1]+'</b> · '+cap+'</p>'
  +scale(p)
  +'<div class="row" style="align-items:center;gap:10px;margin:8px 0 4px"><button class="chip" data-a="dbreplay">▶ REPLAY BATTLE</button><small class="mut">Sleep strength <b class="num">'+Math.round(p.s*100)+' / 100</b> · last night <b class="num">'+p0.last.v+' h</b> (goal '+p0.lo+'–'+p0.hi+' h)'+prev+'</small></div>'
  +'<details><summary>How sleep becomes strength</summary><small><p>Strength = duration × (0.7 + 0.3 × quality). It changes gradually with every half hour, never in jumps.</p>'
  +'<p>Duration '+Math.round(p0.d*100)+'/100: last night against your age goal of '+p0.lo+'–'+p0.hi+' h'+(p0.prev.length?', blended 75/25 with the nights before (now '+Math.round(p0.deff*100)+'/100)':'')+'.</p>'
  +'<p>Quality '+Math.round(p0.q*100)+'/100: restfulness '+(qn.rest||3)+'/5, '+(qn.aw||0)+' awakening'+((qn.aw||0)===1?'':'s')+', '+(qn.lat||0)+' min to fall asleep.</p>'
  +'<p>At '+Math.round(T*100)+' or more the knight defeats the orc; above that he wins faster.</p></small></details>'}

/* ---------- the battle, played once per night per visit ---------- */
function play(){const el=$('#dbat');if(!el)return;const l=LC('sleep'),p0=strength(l,st.p.age);if(!p0)return;
  const p=plan(p0.s),key=p0.last.id+':'+Math.round(p.s*1000);played[key]=1;
  if(run)run.t.forEach(clearTimeout);const R=run={t:[]},sp=api.speed;
  const at=(ms,f)=>{R.t.push(setTimeout(()=>{if(run!==R)return;if(!el.isConnected){stop();return}try{f()}catch(e){console.error('[HWDream]',e);stop()}},ms*sp))};
  const stop=()=>{R.t.forEach(clearTimeout);if(run===R)run=null};
  const k=el.querySelector('.db6k'),o=el.querySelector('.db6o'),fx=el.querySelector('.db6fx'),rd=el.querySelector('.db6hud .d-rd');
  const setBar=(c,v,n)=>{const b=el.querySelector('.db6bar.d-'+c+' i');if(b)b.style.width=Math.round(v)+'%';const s=el.querySelector('.db6hud .'+(c==='hp'?'d-or':'d-kn')+' .num');if(s&&n!=null)s.textContent=n};
  const pop=(x,y,txt,cls)=>{const d=document.createElement('span');d.className='db6pop '+(cls||'');d.style.left=x+'%';d.style.top=y+'%';d.textContent=txt;fx.appendChild(d);setTimeout(()=>d.remove(),1100)};
  const slash=(big)=>{const s=document.createElement('i');s.className='db6sl'+(big?' d-big':'');fx.appendChild(s);setTimeout(()=>s.remove(),500)};
  const burst=(n,pal,y)=>{const r=o.getBoundingClientRect();HWFX.burst(r.left+r.width*.4,r.top+r.height*(y||.4),{n,palette:pal,speed:2.6,life:600})};
  const shake=()=>{el.classList.remove('d-shk');void el.offsetWidth;el.classList.add('d-shk')};
  el.classList.remove('d-won','d-lost');el.classList.add('d-live');
  // SKIP: a short way out while the battle plays (removed when it ends)
  // (a sibling of the scene, which is role="img", placed over its bottom-right corner)
  {const c=el.parentNode;let sk=c.querySelector('.db6skip');if(!sk){sk=document.createElement('button');sk.type='button';sk.className='db6skip';sk.dataset.a='dbskip';sk.textContent='SKIP ▶▶';sk.setAttribute('aria-label','Skip the battle and show the result');el.after(sk)}
    sk.style.top=(el.offsetTop+el.offsetHeight-56)+'px';sk.style.right=(c.clientWidth-el.offsetLeft-el.offsetWidth+8)+'px'}
  HWRig.pose(k,p.s<.35?'tired':'ready');HWRig.pose(o,'idle');setBar('hp',100,100);setBar('en',p.s*100);
  k.style.setProperty('--x',X(56));o.style.setProperty('--x',X(226));
  HWRig.pose(k,'walk');HWRig.pose(o,'walk');
  at(60,()=>{k.style.setProperty('--x',X(80));o.style.setProperty('--x',X(206))});
  at(800,()=>{HWRig.pose(k,p.s<.35?'tired':'ready');HWRig.pose(o,'idle')});
  const atk=+p.atk*1000,oatk=820;let t=1200,en=p.s*100;
  p.rounds.forEach((r,i)=>{
    at(t,()=>{if(rd)rd.textContent='ROUND '+(i+1);HWRig.pose(k,'attack');k.style.setProperty('--x',X(80+ +p.reach*3.2/1.6))});
    at(t+atk*.55,()=>{HWRig.pose(o,'hurt');slash(p.s>=.7);pop(60,30,'-'+r.hit,p.s>=.7?'d-big':'');burst(Math.round(6+14*p.s),'gold');if(p.s>=.8)shake();
      setBar('hp',r.hp,r.hp);en=r.en;setBar('en',en);sfx(180+200*p.s,.07)});
    at(t+atk,()=>{k.style.setProperty('--x',X(80));HWRig.pose(k,p.s<.35?'tired':'ready')});
    t+=atk+250;
    if(r.hp>0){
      at(t,()=>{HWRig.pose(o,'attack');o.style.setProperty('--x',X(194))});
      at(t+oatk*.6,()=>{if(r.block){HWRig.pose(k,'block');pop(26,34,'BLOCK','d-blk');sfx(900,.04)}else{HWRig.pose(k,'hurt');k.classList.remove('d-hit');void k.offsetWidth;k.classList.add('d-hit');pop(26,30,'-9','d-dmg');sfx(140,.08)}
        en=r.en2;setBar('en',en)});
      at(t+oatk,()=>{o.style.setProperty('--x',X(206));HWRig.pose(o,'idle')});
      at(t+oatk+200,()=>HWRig.pose(k,p.s<.35?'tired':'ready'));
      t+=oatk+450}
    else t+=200});
  at(t,()=>{if(rd)rd.textContent='';el.classList.remove('d-live');
    if(p.win){HWRig.pose(o,'defeat');sfx(110,.2);
      setTimeout(()=>{if(run!==R||!el.isConnected)return;o.classList.add('d-gone');const sm=el.querySelector('.db6sm');if(sm)sm.classList.add('d-go');burst(24,'magic',.6)},1000*sp)}
    else{HWRig.pose(o,'taunt');HWRig.pose(k,p.s<.35?'down':'tired')}});
  at(t+1400,()=>{if(p.win){el.querySelector('.db6gate').classList.add('d-up');HWRig.pose(k,'win');[523,659,784,1047].forEach((f,i)=>setTimeout(()=>sfx(f,.1),i*130));
      setTimeout(()=>{if(!el.isConnected)return;el.querySelector('.db6pr').classList.add('d-free');const r=el.querySelector('.db6pr').getBoundingClientRect();HWFX.burst(r.left+r.width/2,r.top,{n:30,palette:'gold',speed:3,up:1,life:900})},700*sp)}
    el.classList.add(p.win?'d-won':'d-lost');
    const lb=el.querySelector('.db6lb');if(lb)lb.textContent=p.win?'VICTORY · PRINCESS FREED':'THE ORC HOLDS';
    if(p.win&&!el.querySelector('.db6rw')){const d=document.createElement('div');d.className='db6rw';d.innerHTML=HWPixel.icon('achievement')+'<span>PRINCESS LYRA RESCUED</span>';el.appendChild(d)}
    const sk=el.parentNode&&el.parentNode.querySelector('.db6skip');if(sk)sk.remove();
    stop()})}
// SKIP: stop the timers and show the finished outcome at once
function skip(){if(run){run.t.forEach(clearTimeout);run=null}const old=$('#dbat'),p0=strength(LC('sleep'),st.p.age);if(!old||!p0)return;
  played[p0.last.id+':'+Math.round(p0.s*1000)]=1;const c=old.parentNode,sk=c.querySelector('.db6skip');if(sk)sk.remove();
  const box=document.createElement('div');box.innerHTML=scene(plan(p0.s),false);c.replaceChild(box.firstChild,old);const b=c.querySelector('[data-a="dbreplay"]');if(b)b.focus({preventScroll:true})}
acts.dbskip=skip;
acts.dbreplay=()=>{const l=LC('sleep'),p0=strength(l,st.p.age);if(!p0)return;const c=$('#dbatc');if(!c)return;
  const k=p0.last.id+':'+Math.round(p0.s*1000);delete played[k];const old=$('#dbat');if(old&&old.parentNode){const box=document.createElement('div');box.innerHTML=scene(plan(p0.s),true);old.parentNode.replaceChild(box.firstChild,old)}
  if(HWMotion.reduced()){render();return}setTimeout(play,120)};

// the original names stay: dbat() draws the card body, dbState() gives the old five-step state (0 = no sleep logged)
dbat=card;
dbState=function(){const p=strength(LC('sleep'),st.p.age);return p?Math.min(4,1+Math.floor(p.s*4)):0};
// a successful sleep save starts the battle by itself (once per saved entry): the entry is already stored by then,
// so leaving, skipping or a failure here never loses it. A second tap within a moment is ignored (no duplicate night).
{const o=acts.slsave;let lock=0;acts.slsave=function(){const now=Date.now();if(now-lock<1500)return;
  const n0=st.e.length,r=o.apply(this,arguments),e=st.e[st.e.length-1];
  if(st.e.length>n0&&e&&e.c==='sleep'){lock=now;try{auto()}catch(err){console.error('[HWDream]',err)}}return r}}
function auto(){const c=$('#dbatc'),p0=strength(LC('sleep'),st.p.age);if(!c||!p0)return;
  const rm=HWMotion.reduced();delete played[p0.last.id+':'+Math.round(p0.s*1000)];
  const old=$('#dbat');if(old){const box=document.createElement('div');box.innerHTML=scene(plan(p0.s),!rm);old.parentNode.replaceChild(box.firstChild,old)}
  const el=$('#dbat');if(!el)return;el.scrollIntoView({behavior:rm?'auto':'smooth',block:'center'});
  if(rm){played[p0.last.id+':'+Math.round(p0.s*1000)]=1;return}
  // a badge popup (e.g. First Dream) covers the screen: start once it has closed, so the battle is never played unseen
  let n=0;const go=()=>{if($('#dbat')!==el)return;if(document.querySelector('.bpop')&&++n<40){setTimeout(go,250);return}
    el.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>{if($('#dbat')===el)play()},n?350:0)};
  setTimeout(go,500*api.speed)}
// autoplay after the Sleep page draws, once per logged night per visit
HWEvents.on('page:viewed',e=>{if(!e||e.view!=='sleep')return;const el=$('#dbat');if(el&&!el.classList.contains('d-won')&&!el.classList.contains('d-lost')&&$('#dbat .db6hud'))setTimeout(()=>{if($('#dbat')===el)play()},650*api.speed)});

HWUI.css('dream',`
.db6{position:relative;height:min(clamp(220px,58vw,400px),74vh);border:4px solid var(--ln);overflow:hidden;margin-bottom:8px;background:#0d0b14;contain:layout paint}
.db6 .db6s{position:absolute;left:50%;bottom:0;width:max(100%,calc(min(clamp(220px,58vw,400px),74vh) * 16 / 9));aspect-ratio:16/9;transform:translateX(-50%)}
.db6 .db6l{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;display:block;pointer-events:none}
.db6 .db6fg{z-index:8}
.db6 .db6moon{position:absolute;z-index:1;background:linear-gradient(180deg,rgba(143,180,255,.28),rgba(143,180,255,0));transform:skewX(-14deg);transform-origin:top;animation:db6mn 7s ease-in-out infinite}
@keyframes db6mn{0%,100%{opacity:.7}50%{opacity:1}}
.db6 .db6pr{position:absolute;z-index:2;width:10.5%;transform:translate(-50%,-100%)}
.db6 .db6pr svg{display:block;width:100%;height:auto;image-rendering:pixelated}
.db6 .db6pr .pa-up{display:none}.db6 .db6pr.d-free .pa-up{display:block}.db6 .db6pr.d-free .pa-dn{display:none}
.db6 .db6pr .pa-dn{animation:db6wo 1.6s steps(2) infinite}
.db6 .db6pr.d-free{animation:db6ch .5s ease-out infinite alternate}
@keyframes db6wo{50%{transform:translateX(1px)}}@keyframes db6ch{to{transform:translate(-50%,-112%)}}
.db6 .db6gate{position:absolute;z-index:3;overflow:hidden;transition:transform 1.4s steps(10)}
.db6 .db6gate i{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 9%,#2a2632 9% 12%,#6a6474 12% 13%,transparent 13% 21%),repeating-linear-gradient(180deg,transparent 0 30%,#2a2632 30% 33%,transparent 33% 50%)}
.db6 .db6gate.d-up{transform:translateY(-92%)}
.db6 .db6tg{position:absolute;z-index:7;width:44%;aspect-ratio:1;transform:translate(-50%,-50%);background:radial-gradient(closest-side,rgba(255,170,80,.34),rgba(255,140,60,.12) 55%,rgba(255,120,40,0));pointer-events:none;animation:db6tg 2.3s steps(1) infinite}
.db6 .db6tg.d-t1{animation-duration:1.9s;animation-delay:-.7s}
@keyframes db6tg{0%{opacity:.86;transform:translate(-50%,-50%) scale(1)}13%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}27%{opacity:.78;transform:translate(-50%,-50%) scale(.97)}41%{opacity:.95;transform:translate(-50%,-50%) scale(1.02)}58%{opacity:.82;transform:translate(-50%,-50%) scale(.99)}74%{opacity:1;transform:translate(-50%,-50%) scale(1.05)}88%{opacity:.88;transform:translate(-50%,-50%) scale(1)}}
.db6 .db6fl{position:absolute;z-index:7;width:2.6%;aspect-ratio:1/2;transform:translate(-50%,-100%)}
.db6 .db6fl i{position:absolute;left:15%;right:15%;bottom:0;height:70%;background:#ff8a2a;box-shadow:0 0 0 2px #e0483f inset;transform-origin:50% 100%;animation:db6fl .42s steps(3) infinite}
.db6 .db6fl i:nth-child(2){left:28%;right:28%;height:50%;background:#ffd04a;box-shadow:none;animation-duration:.36s;animation-delay:-.1s}
.db6 .db6fl i:nth-child(3){left:40%;right:40%;height:28%;background:#fff6c0;box-shadow:none;animation-duration:.3s}
@keyframes db6fl{0%{transform:scale(1,1)}33%{transform:scale(.85,1.18) translateX(6%)}66%{transform:scale(1.08,.9) translateX(-6%)}}
.db6 .db6ch{position:absolute;transform:translate(-50%,-100%);left:var(--x);transition:left .45s cubic-bezier(.3,0,.3,1)}
.db6 .db6k{width:18%;z-index:5}.db6 .db6o{width:27%;z-index:4}
.db6 .db6sd{position:absolute;left:18%;right:18%;bottom:-3%;height:7%;background:rgba(0,0,0,.5);border-radius:50%;animation:db6sd 2.3s steps(1) infinite}
.db6 .db6o .db6sd{animation-duration:1.9s}
@keyframes db6sd{0%{transform:translateX(0) scaleX(1)}13%{transform:translateX(3%) scaleX(1.06)}27%{transform:translateX(-2%) scaleX(.96)}41%{transform:translateX(2%) scaleX(1.03)}58%{transform:translateX(-1%) scaleX(.98)}74%{transform:translateX(4%) scaleX(1.07)}}
.db6 .db6au{position:absolute;left:10%;right:10%;top:20%;bottom:0;background:radial-gradient(closest-side,rgba(255,226,122,calc(var(--glow,0) * .55)),rgba(255,226,122,0));animation:db6au 1.6s ease-in-out infinite alternate;pointer-events:none}
@keyframes db6au{to{transform:scale(1.08);opacity:.7}}
.db6 .db6k .hwr{filter:drop-shadow(0 0 calc(var(--glow,0) * 5px) rgba(255,226,122,.9))}
.db6 .db6k.d-hit .hwr{animation:db6hit .35s steps(2)}@keyframes db6hit{50%{filter:brightness(2.2) sepia(1) hue-rotate(-40deg)}}
.db6 .db6o.d-gone{transition:opacity .6s steps(4);opacity:0}
.db6 .db6sm{position:absolute;width:12%;height:22%;transform:translate(-50%,-50%);pointer-events:none;z-index:6;display:none}
.db6 .db6sm.d-go{display:block}
.db6 .db6sm i{position:absolute;width:40%;height:40%;background:#8a8494;border-radius:50%;opacity:0;animation:db6smk .9s ease-out forwards}
.db6 .db6sm i:nth-child(2){left:40%;top:20%;animation-delay:.1s}.db6 .db6sm i:nth-child(3){left:10%;top:50%;animation-delay:.2s}.db6 .db6sm i:nth-child(4){left:60%;top:60%;animation-delay:.15s}
@keyframes db6smk{0%{opacity:.9;transform:scale(.4)}100%{opacity:0;transform:scale(2.4) translateY(-40%)}}
.db6 .db6z{position:absolute;left:58%;top:6%;font:12px var(--fh);color:#cfe0ff;z-index:6;animation:zk 3s linear infinite;animation-delay:var(--l,0s)}
.db6 .db6fx{position:absolute;inset:0;z-index:9;pointer-events:none}
.db6 .db6pop{position:absolute;font:12px/1 var(--fh);color:#fff;text-shadow:2px 2px 0 #2b1a10;animation:db6pp 1s steps(8) forwards;white-space:nowrap}
.db6 .db6pop.d-big{font-size:16px;color:#ffe27a}.db6 .db6pop.d-dmg{color:#ff8a7a}.db6 .db6pop.d-blk{color:#8fd4ff;font-size:9px}
@keyframes db6pp{0%{opacity:0;transform:translateY(6px) scale(.6)}20%{opacity:1;transform:translateY(0) scale(1.1)}100%{opacity:0;transform:translateY(-34px)}}
.db6 .db6sl{position:absolute;left:52%;top:22%;width:16%;height:34%;border-right:5px solid #fff;border-radius:0 60% 60% 0;transform:rotate(25deg);opacity:0;animation:db6sl .4s ease-out forwards;filter:drop-shadow(0 0 4px #ffe27a)}
.db6 .db6sl.d-big{width:22%;height:46%;border-right-width:8px;left:49%;top:16%}
@keyframes db6sl{0%{opacity:1;clip-path:inset(0 0 100% 0)}60%{opacity:1;clip-path:inset(0 0 0 0)}100%{opacity:0}}
.db6.d-shk .db6s{animation:db6sk .3s steps(4)}@keyframes db6sk{25%{margin-left:-4px}50%{margin-left:3px}75%{margin-left:-2px}}
.db6 .db6mo{position:absolute;inset:0;z-index:7;pointer-events:none}
.db6 .db6mo i{position:absolute;width:2px;height:2px;background:rgba(255,220,170,.7);animation:wq6mo var(--d,7s) ease-in-out infinite}
.db6 .db6mo u{position:absolute;width:2px;height:2px;background:#ffb04a;animation:db6em 1.8s linear infinite}
@keyframes db6em{0%{transform:translate(0,0);opacity:1}100%{transform:translate(6px,-30px);opacity:0}}
@keyframes wq6mo{0%,100%{transform:translate(0,0);opacity:0}30%{opacity:1}50%{transform:translate(14px,-18px)}80%{opacity:.6}}
.db6hud{position:absolute;left:8px;right:8px;top:8px;z-index:12;display:flex;justify-content:space-between;gap:8px;pointer-events:none}
.db6hud>div{background:rgba(10,8,18,.78);border:2px solid #fff;padding:4px 6px;color:#fff;min-width:0;width:min(40%,190px)}
.db6hud .d-rd{white-space:nowrap;width:auto;background:none;border:0;font:8px/1.6 var(--fh);color:#ffe27a;align-self:center;padding:0}
.db6hud b{display:block;font:7px/1.6 var(--fh);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.db6hud small{font:7px/1.6 var(--fh);color:#cfc8e0}
.db6bar{display:block;height:8px;border:2px solid #000;background:#2a2632;margin:2px 0}
.db6bar i{display:block;height:100%;transition:width .5s steps(6)}
.db6bar.d-en i{background:repeating-linear-gradient(90deg,#f2c14e 0 6px,#d9a02e 6px 8px)}.db6bar.d-hp i{background:repeating-linear-gradient(90deg,#e0483f 0 6px,#b0302a 6px 8px)}
.db6 .db6lb{position:absolute;left:8px;bottom:8px;z-index:12;font:8px var(--fh);color:#fff;background:rgba(0,0,0,.6);border:2px solid #fff;padding:3px 6px}
.db6.d-won .db6lb{border-color:#f2c14e;color:#f2c14e}.db6.d-lost .db6lb{border-color:#d9453d}
.db6 .db6rw{position:absolute;right:8px;bottom:8px;z-index:12;display:flex;align-items:center;gap:6px;font:8px/1.4 var(--fh);color:#2b2418;background:#f2c14e;border:2px solid #2b2418;padding:3px 6px;animation:pgin .3s steps(4)}
#dbatc{position:relative}
.db6skip{position:absolute;z-index:13;min-height:44px;min-width:44px;padding:6px 12px;font:8px/1.4 var(--fh);color:#fff;background:rgba(10,8,18,.82);border:2px solid #fff;cursor:pointer}
.db6skip:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.db6sc{position:relative;margin:14px 0 2px;height:14px}
.db6sc .d-tr{display:flex;height:10px;border:2px solid var(--ln)}
.db6sc .d-tr i{display:block;height:100%}.db6sc .d-z0{background:#7a2a3a}.db6sc .d-z1{background:#b0503a}.db6sc .d-z2{background:#d9a02e}.db6sc .d-z3{background:#5cc05a}.db6sc .d-z4{background:#f2c14e}
.db6sc .d-mk{position:absolute;top:-4px;width:4px;height:20px;margin-left:-2px;background:var(--ink);box-shadow:0 0 0 2px var(--pn)}
.db6sc .d-vt{position:absolute;top:-2px;height:16px;border-left:2px dashed var(--ink)}.db6sc .d-vt span{position:absolute;top:-12px;left:-10px;font:6px var(--fh)}
.db6tl{display:flex;justify-content:space-between;font:6px/1.6 var(--fh);color:var(--mut);margin-bottom:6px;gap:2px}
@media(max-width:420px){.db6hud b{font-size:6px}.db6hud>div{width:44%}}
@media(prefers-reduced-motion:reduce){.db6 .db6moon,.db6 .db6pr .pa-dn,.db6 .db6pr.d-free,.db6 .db6tg,.db6 .db6fl i,.db6 .db6sd,.db6 .db6au,.db6 .db6z,.db6 .db6mo i,.db6 .db6mo u{animation:none!important}.db6 .db6ch,.db6 .db6gate{transition:none!important}.db6 .db6mo{display:none}}
html.hw-q-performance .db6 .db6mo i:nth-child(2n),html.hw-q-performance .db6 .db6moon{display:none}html.hw-q-performance .db6 .db6sd,html.hw-q-performance .db6 .db6au{animation:none}
`);
const api={speed:1,strength,plan,dur,quality,tier,T,TIER,play,card,scene,skip,auto};
return api})();
