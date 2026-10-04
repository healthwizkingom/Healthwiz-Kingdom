/* v6 (RPG upgrades, part A): the Water Quest scene on the Hydration half of Nutrition & Hydration. Not part of the original.
   Replaces the original flat Well of Life scene (#wq) with a layered pixel-art valley, and the hero's log animation
   with a continuous sequence played by the rigged knight (js/v6-rig.js). What the scene shows is unchanged: today's
   water against the target (the well's water and the gauge), the original six well stages and the Well Garden
   discoveries (js/v6-water.js), and logging still goes through the original drink() → wqFlow → flood2 → render.

   Layers, back to front (each painted once per time of day by HWRig.paint, then only CSS moves):
     far        sky in banded pixel gradients, sun or moon and stars, two hazy mountain ranges
     clouds     two slow pixel clouds; birds by day
     mid        tree line, hills, the cliff and its waterfall, the spring pond (shore, shallows, depths, reflections of
                sky, cliff and trees, lily pads, pebbles), the jetty, the path and the stone well
     life       waterfall stream and foam, shimmer lines, a fish in the deep water, mist, the stage scenery
     action     the knight (and his reflection while he stands over the water), the well's water and ripples
     fg         dark grass, ferns and rocks along the bottom edge, so the action sits between two depths
     light      time-of-day tint, sun rays by day, motes or fireflies, a vignette
   Lighting follows the clock (HWTitle.phase: morning, afternoon, evening, night).

   Knight sequence when water is logged (≈5.6 s, then the original flood and re-render):
     idle → turn to the spring → walk onto the jetty → kneel → scoop with a flask (ripples, splash) → drink →
     stand with a filled bucket → turn → walk to the well → pour (stream, ripples, the well's water rises, gauge) →
     celebrate (jump, sword raised, sparkles, +mL) → the original flood overlay.
   Logging again during the sequence updates the meters straight away; the sequence is not restarted.
   The original "target reached" banner waits until the sequence ends, so it never covers it.

   Size: the scene keeps a 16:9 stage, anchored to the bottom and cropped at the sides on narrow screens and at the sky
   in short landscape screens, so nothing important leaves the frame and the page never scrolls sideways.
   Reduced motion: every pose and position is still shown, nothing loops. Performance mode drops mist, rays and half
   the motes. Everything pauses while scrolled out of view (js/v6-motion.js). */
const HWWaterQuest=(()=>{
const W=320,H=180,X=v=>(v/W*100).toFixed(2)+'%',Y=v=>(v/H*100).toFixed(2)+'%';
// key positions (bg pixels): feet of the knight
const SPOT={home:[170,160],shore:[122,148],well:[216,154]};
const POND=[84,146,66,22],WELL=[258,112,18,5];

/* ---------- time-of-day palettes ---------- */
const PH={
  morning:{sky:['#7fb6e6','#9cc8ec','#bcd9ef','#e2e0d4','#f6d7ae','#ffcf9a'],far:'#93a6c4',far2:'#7590b0',tint:['#ffcf9a',.10],sun:'#fff1c2',rays:1},
  afternoon:{sky:['#3f93dc','#56a3e3','#71b4ea','#8fc5ef','#b2d8f4','#d6ebf8'],far:'#8eaed3',far2:'#6d91bb',tint:['#ffffff',0],sun:'#fffbe2',rays:1},
  evening:{sky:['#262a63','#3e3a7a','#6c4c8c','#b05f7c','#e07e64','#ffae6a'],far:'#6b5d8d',far2:'#4d4775',tint:['#7a3e66',.28],sun:'#ffcf7a',rays:0},
  night:{sky:['#060a20','#0a1030','#0f1a40','#15224e','#1c2c5c','#26386a'],far:'#252f58',far2:'#1b2448',tint:['#0c1438',.58],moon:'#e9edff',rays:0}};
const phase=()=>{try{return HWTitle.phase()}catch(e){const h=new Date().getHours();return h>=5&&h<11?'morning':h<17&&h>=11?'afternoon':h<20&&h>=17?'evening':'night'}};

/* ---------- painted layers ---------- */
function far(p){const P=PH[p];return HWRig.paint('wq-far-'+p,W,H,d=>{
  d.bands(0,118,P.sky);
  if(p==='night'){d.speck(0,0,W,90,['#ffffff','#cfd8ff','#8fa0e0'],70);d.ell(250,30,9,9,P.moon);d.ell(253,28,7,7,'#c9d0f0');d.ell(247,33,2,2,'#b3bce0');d.ell(252,26,1,1,'#b3bce0')}
  else{const sy=p==='evening'?84:p==='morning'?60:26,sx=p==='afternoon'?236:p==='evening'?206:268;d.ell(sx,sy,15,15,HWRig.mix(P.sun,P.sky[4],.55));d.ell(sx,sy,11,11,P.sun)}
  const m1=x=>86-14*Math.abs(Math.sin(x/37))-9*Math.abs(Math.sin(x/13+1))-(x%7<2?1:0);
  d.ridge(0,W,m1,P.far,120);d.ridge(0,W,x=>m1(x)+3+(x%9<3?1:0),HWRig.mix(P.far,'#ffffff',.18),m1(0)+9);d.ridge(0,W,m1,P.far,120);
  for(let x=0;x<W;x++){const y=Math.round(m1(x));if(y<74)d.r(x,y,1,2,HWRig.mix(P.far,'#ffffff',.45))}
  d.ridge(0,W,x=>98-9*Math.abs(Math.sin(x/23+2))-4*Math.abs(Math.sin(x/7)),P.far2,120);
  d.r(0,104,W,6,HWRig.mix(P.far2,P.sky[5],.35))})}

function mid(p,lv){const P=PH[p],t=c=>HWRig.mix(c,P.tint[0],P.tint[1]);return HWRig.paint('wq-mid-'+p+'-'+(lv>=2?1:0),W,H,d=>{
  const R=d.rnd;
  // tree line on the horizon: round crowns and pines, darker toward the back
  for(let x=-6;x<W+8;x+=7+(R()*6|0)){const h=6+(R()*8|0),c=R()<.5;const col=t(R()<.5?'#2f6a3c':'#285c35');
    if(c){d.ell(x,110-h/2,5+(R()*3|0),h/2+2,col);d.ell(x-1,108-h/2,3,2,t('#3f7f4a'))}
    else{for(let k=0;k<h+4;k++)d.r(x-Math.floor(k/2.2),104-h+k,1+2*Math.floor(k/2.2),1,col)}}
  // rolling ground, lighter toward the viewer
  d.ridge(0,W,x=>110-3*Math.sin(x/40)-2*Math.sin(x/11),t('#4f8f43'),H);
  d.ridge(0,W,x=>122-3*Math.sin(x/30+1),t('#5c9e4a'),H);
  d.ridge(0,W,x=>136-2*Math.sin(x/26+2),t('#66a852'),H);
  d.speck(0,112,W,68,[t('#78b85e'),t('#4f8f43'),t('#8bc56a')],520);
  for(let i=0;i<70;i++){const x=R()*W|0,y=118+R()*60|0;d.r(x,y-2,1,3,t('#4a8a3e'));d.r(x+1,y-1,1,2,t('#7fc060'))}
  // the cliff: a dark mass with faceted crags lit from the upper left, ledges with moss, and the waterfall's channel
  d.poly([0,22,10,16,22,22,34,18,48,24,60,34,70,56,76,90,84,124,40,128,0,130],t('#4f4a44'));
  const F=[[0,24,14,18,26,24,30,50,16,58,0,54],[0,60,16,62,28,56,34,84,20,94,0,90],[0,96,22,98,36,90,40,124,0,128],[54,30,62,34,70,56,64,68,56,62],[56,72,66,74,74,92,78,118,60,122,56,100]];
  F.forEach((f,i)=>{d.poly(f,t(i%2?'#78726a':'#857f74'));const n=f.length;
    d.poly([f[0],f[1],f[2],f[3],f[2]+(f[4]-f[2])*.35,f[3]+(f[5]-f[3])*.35,f[0]+3,f[1]+8],t('#a49d8e'));
    for(let k=0;k<n;k+=2){const x0=f[k],y0=f[k+1],x1=f[(k+2)%n],y1=f[(k+3)%n];if(y1>y0+6&&x1>=x0){for(let y=y0;y<y1;y++)d.r(x0+(x1-x0)*(y-y0)/(y1-y0)-1,y,2,1,t('#5a554d'))}}
    const yb=Math.max.apply(0,f.filter((v,j)=>j%2));d.r(f[0]+2,yb-1,22,2,t('#3a3632'));d.r(f[0]+3,yb-3,12,2,t('#4f8f3a'));d.r(f[0]+5,yb-4,5,1,t('#5cc05a'))});
  for(let i=0;i<26;i++){const x=2+R()*68,y=26+R()*96;d.r(x,y,1,3+R()*4,t('#3e3a35'));d.r(x+1,y+1,1,2,t('#9a9485'))}
  d.speck(0,24,78,100,[t('#3e3a35'),t('#a9a395')],120);
  d.poly([0,22,10,16,22,22,34,18,48,24,56,30,40,30,24,27,10,24,0,28],t('#4f8f3a'));d.speck(0,16,56,16,[t('#5cc05a'),t('#3f7f34')],50);
  for(let x=0;x<56;x+=3)d.r(x,26+(x*7%5),1,2+(x%3),t('#3f7f34'));
  d.r(40,26,14,104,t('#2f3d45'));d.r(41,26,12,104,t('#24323a'));
  for(let y=40;y<120;y+=9)d.r(38+(y%2)*16,y,3,4,t('#4f8f3a'));
  // the spring: shore, shallows, depths
  const[px,py,rx,ry]=POND;
  d.ell(px,py+1,rx+6,ry+5,t('#a9a08a'));d.ell(px,py,rx+3,ry+3,t('#c9b98e'));
  const wc=p==='night'?['#1f4f7c','#173f66','#10304f','#0b233c']:p==='evening'?['#5d86b4','#3f6e9e','#2a557f','#1d3d60']:['#5fb7d6','#3c96c8','#2774a8','#1b5687'];
  d.ell(px,py,rx,ry,wc[0]);d.ell(px-2,py+1,rx-7,ry-4,wc[1]);d.ell(px-6,py+2,rx-20,ry-8,wc[2]);d.ell(px-10,py+3,rx-34,ry-12,wc[3]);
  // reflections: sky along the far edge, the cliff and the trees darker
  for(let k=0;k<4;k++){const w2=rx-10-k*6;d.r(px-w2,py-ry+2+k,2*w2,1,HWRig.mix(wc[0],P.sky[3+(k>1?1:0)],.5))}
  d.r(30,128,30,3,HWRig.mix(wc[1],'#2f3d45',.5));d.r(24,131,30,2,HWRig.mix(wc[1],'#2f3d45',.35));d.r(40,130,14,10,HWRig.mix(wc[1],'#cfeaff',.25));
  for(let x=70;x<140;x+=9)d.r(x,128,5,2,HWRig.mix(wc[0],'#285c35',.4));
  d.speck(px-rx+6,py-4,2*rx-12,ry+2,[HWRig.mix(wc[0],'#6b665c',.4)],40);
  // lily pads
  [[42,156],[58,160],[136,152],[30,148]].forEach((q,i)=>{d.ell(q[0],q[1],4,2,t('#3f9f4a'));d.r(q[0]-1,q[1]-2,2,1,wc[1]);if(i===1){d.r(q[0]-1,q[1]-3,3,2,'#ff9be0');d.px(q[0],q[1]-3,'#fff2a8')}});
  // shore rocks and reeds
  [[16,140,6],[24,160,5],[148,138,5],[154,150,4],[100,168,4],[64,170,5]].forEach(q=>{d.ell(q[0],q[1],q[2]+1,q[2]-1,t('#4f4a42'));d.ell(q[0]-1,q[1]-1,q[2],q[2]-2,t('#8a8578'));d.r(q[0]-q[2]+2,q[1]-q[2]+2,3,1,t('#b8b2a2'))});
  for(let i=0;i<18;i++){const x=(i<9?10+i*2:150+(i-9)*2)+(R()*2|0),h=6+(R()*8|0);d.r(x,136-h+(i%3),1,h,t(i%2?'#3f7f34':'#5c9e4a'));if(i%4===0)d.r(x,135-h,1,3,t('#8a5a2b'))}
  // the jetty
  d.r(112,141,40,7,t('#5b3a1e'));d.r(112,140,40,6,t('#a8693a'));for(let x=113;x<152;x+=5){d.r(x,140,1,6,t('#7a4a26'))}d.r(112,146,40,1,t('#3a2412'));
  [116,128,140,150].forEach(x=>{d.r(x,147,2,6,t('#4a2f18'));d.r(x,152,2,1,HWRig.mix(wc[1],'#4a2f18',.4))});
  // the path from the jetty to the well
  [[150,150,8],[160,155,9],[172,158,10],[186,160,10],[200,159,10],[214,156,10],[228,153,10],[242,151,9]].forEach(q=>{d.ell(q[0],q[1],q[2]+1,4,t('#b89a5e'));d.ell(q[0],q[1]-1,q[2],3,t('#d9c08a'))});
  d.speck(150,148,100,14,[t('#a8875a'),t('#efdcae')],60);
  // the well: stone body, rim, roof, crank, rope, bucket
  const[wx,wy,wr]=WELL,st=t('#a99e82'),sd=t('#7d7462'),sl=t('#cfc4a5');
  d.r(wx-wr,wy,2*wr,36,sd);d.r(wx-wr,wy,2*wr-6,36,st);d.r(wx-wr,wy,5,36,sl);
  for(let y=wy+2;y<wy+36;y+=6)for(let x=wx-wr+((y/6|0)%2)*5;x<wx+wr;x+=10)d.r(x,y,1,5,sd),d.r(x-9<wx-wr?wx-wr:x-9,y+5,9,1,sd);
  if(lv>=2)[[wx-wr+2,wy+30],[wx+wr-8,wy+8],[wx-6,wy+22]].forEach(q=>{d.r(q[0],q[1],6,3,t('#4f8f3a'));d.r(q[0]+1,q[1]-1,3,1,t('#5cc05a'))});
  else[[wx-8,wy+10],[wx+6,wy+22]].forEach(q=>{d.r(q[0],q[1],1,4,'#4f4a42');d.r(q[0]+1,q[1]+3,2,1,'#4f4a42')});
  d.ell(wx,wy,wr+3,6,t('#5f5747'));d.ell(wx,wy,wr+2,5,sl);d.ell(wx,wy,wr-1,4,t('#2b2a2e'));
  d.ell(wx,wy+37,wr+5,3,t('#3e6a34'));
  d.r(wx-wr-1,62,3,50,t('#5b3a1e'));d.r(wx+wr-2,62,3,50,t('#5b3a1e'));d.r(wx-wr,62,1,50,t('#8a5a2b'));
  d.poly([wx-wr-10,70,wx,50,wx+wr+10,70,wx+wr+6,72,wx-wr-6,72],t('#7a3a2a'));d.poly([wx-wr-10,70,wx,50,wx,54,wx-wr-4,70],t('#a8503a'));
  for(let k=0;k<4;k++)d.r(wx-wr-8+k*10,66-k*4,30-k*6,1,t('#5a2a20'));
  d.r(wx-wr,80,2*wr,2,t('#4a2f18'));d.r(wx+wr,77,4,8,t('#4a2f18'));d.r(wx+wr+3,84,3,2,t('#8a5a2b'));
  d.r(wx-1,82,1,12,t('#c9a96a'));d.r(wx-4,94,8,6,t('#5b3a1e'));d.r(wx-3,94,6,5,t('#8a5a2b'));d.r(wx-4,95,8,1,t('#3a3a48'))},11)}

function fg(p){const P=PH[p],t=c=>HWRig.mix(c,P.tint[0],P.tint[1]*1.25);return HWRig.paint('wq-fg-'+p,W,H,d=>{const R=d.rnd;
  d.ridge(0,W,x=>176-3*Math.abs(Math.sin(x/9))-(x<70||x>270?6*Math.abs(Math.sin(x/17)):0),t('#2a5a2c'),H);
  for(let i=0;i<120;i++){const x=R()*W|0,h=4+(R()*(x<60||x>280?14:6)|0);d.r(x,180-h,1,h,t(i%3?'#2f6a30':'#3f8a3e'));if(i%5===0)d.r(x+1,180-h+1,1,h-2,t('#1f4a22'))}
  [[8,172,12],[300,174,10],[46,178,7],[284,178,6]].forEach(q=>{d.ell(q[0],q[1],q[2]+1,q[2]*.7+1|0,t('#2e2b28'));d.ell(q[0]-1,q[1]-1,q[2],q[2]*.7|0,t('#57524a'));d.r(q[0]-q[2]+3,q[1]-q[2]*.5,4,1,t('#7a7468'))});
  [[30,170,'#ff9be0'],[262,172,'#f2c14e'],[312,166,'#ffffff']].forEach(q=>{d.r(q[0],q[1],1,6,t('#3f7f34'));d.r(q[0]-1,q[1]-1,3,2,t(q[2]));d.px(q[0],q[1]-1,t('#fff2a8'))})},23)}

/* ---------- stage scenery (the original well stages + Well Garden discoveries) ---------- */
function spr(k,x,y,s,cls,style){const S=HWWater.SP[k];return '<svg class="v6wsp '+(cls||'')+'" viewBox="0 0 '+S[0]+' '+S[1]+'" style="left:'+X(x)+';top:'+Y(y)+';width:'+(S[0]*(s||2)/W*100).toFixed(2)+'%;'+(style||'')+'" shape-rendering="crispEdges" aria-hidden="true">'
  +S[2].split(';').map(r=>{const q=r.split(',');return '<rect x="'+q[0]+'" y="'+q[1]+'" width="'+q[2]+'" height="'+q[3]+'" fill="'+q[4]+'"/>'}).join('')+'</svg>'}
const cloud=(x,y,s,d,rev)=>'<span class="cl" style="left:'+x+'%;top:'+y+'%;width:'+(16*s/W*100*2).toFixed(2)+'%;--d:'+d+'s'+(rev?';animation-direction:reverse':'')+'">'+spr('cloud',0,0,0,'','position:static;transform:none;width:100%')+'</span>';
const PCOL=['#ff9be0','#f2c14e','#ffffff','#e0483f','#b9a6ff'];
const fly=(x,y,d)=>'<i class="v6wff" style="left:'+X(x)+';top:'+Y(y)+';animation-delay:-'+d+'s"></i>';
function scenery(lv,n){let h='';
  if(lv===0)h+=spr('dead',196,128,2)+spr('dead',300,124,1.5);
  if(lv>=1)h+=[[160,166],[184,170],[206,166],[236,164]].map(q=>spr('sprout',q[0],q[1],2,'v6whop')).join('');
  if(lv>=2)h+=spr('tree',190,118,2,'v6wsw')+spr('tree',300,122,2.4,'v6wsw','animation-delay:-1.4s')+spr('bush',168,128,2)+spr('bush',292,160,2);
  if(lv>=3)h+=[[176,110,0],[210,128,1.1],[290,100,2],[150,120,.6],[232,96,1.7],[110,112,2.6]].slice(0,Math.max(3,HWMotion.count(6)||0)).map(q=>fly(q[0],q[1],q[2])).join('');
  if(lv>=4)h+=spr('deer',206,124,1.6,'v6whop')+spr('rabbit',286,168,2,'v6whop');
  if(lv>=5)h+=[[150,170],[196,168],[234,168],[284,150],[242,150],[176,172]].map((q,i)=>spr('flower',q[0],q[1],2,'v6whop','--pc:'+PCOL[i%5])).join('');
  if(n>=1)h+=spr('frog',58,159,2,'v6whop');
  if(n>=2)h+=spr('planter',294,152,2);
  if(n>=3)h+=spr('fly',196,96,2,'v6wfl')+spr('fly',140,122,1.6,'v6wfl','animation-delay:-1.2s');
  if(n>=4)h+=spr('lantern',204,152,2);
  return '<div class="v6wqd" aria-hidden="true" data-stage="'+lv+'">'+h+'</div>'}

/* ---------- the scene markup ---------- */
function scene(o){const p=phase(),P=PH[p],lv=HWWater.stage(),n=HWWater.finds(),pct=Math.max(0,Math.min(100,o.p)),k=pct/100;
  const motes=HWMotion.count(p==='night'||p==='evening'?12:9),night=p==='night'||p==='evening';
  const[hx,hy]=SPOT.home,[px,py,rx,ry]=POND,[wx,wy,wr,wh]=WELL;
  let m='';for(let i=0;i<motes;i++)m+='<i style="left:'+(6+i*37%88)+'%;top:'+(30+i*23%50)+'%;--d:'+(5+i%4*1.6)+'s;animation-delay:-'+(i*1.3%6).toFixed(1)+'s"></i>';
  const shim=[[30,40],[52,30],[44,62],[66,48],[22,58],[60,72]].map((q,i)=>'<i style="left:'+q[0]+'%;top:'+q[1]+'%;animation-delay:-'+(i*.7).toFixed(1)+'s"></i>').join('');
  return '<div class="wq wq6 ph-'+p+'" id="wq" role="img" aria-label="Water Quest: the Well of Life is '+Math.round(pct)+'% full today. Your knight carries every sip you log from the spring to the well.">'
  +'<div class="wq6s">'
  +'<img class="wq6l" alt="" src="'+far(p)+'">'
  +'<div class="wq6cl">'+cloud(8,8,2.4,110,0)+cloud(44,18,1.6,150,1)+cloud(78,6,1.8,130,0)+(night?'':'<b class="bd1"></b><b class="bd2"></b>')+'</div>'
  +'<img class="wq6l" alt="" src="'+mid(p,lv)+'">'
  +'<div class="wq6fall" style="left:'+X(41)+';top:'+Y(28)+';width:'+X(12)+';height:'+Y(100)+'"><i></i></div><div class="wq6foam" style="left:'+X(47)+';top:'+Y(127)+'"><i></i><i></i><i></i></div>'
  +'<div class="wqp" style="left:'+X(px-rx)+';top:'+Y(py-ry)+';width:'+X(2*rx)+';height:'+Y(2*ry)+'"><div class="wq6sh">'+shim+'</div><b class="wq6fish"></b>'
    +'<div class="wq6rf" style="left:'+((SPOT.shore[0]-(px-rx))/(2*rx)*100).toFixed(1)+'%;top:'+((SPOT.shore[1]-(py-ry))/(2*ry)*100).toFixed(1)+'%">'+HWRig.knight({cls:'rgl'})+'</div><div class="wq6pr"></div></div>'
  +'<div class="wq6mist"><i></i><i></i></div>'
  +scenery(lv,n)
  +'<div class="wqwell" style="left:'+X(wx-wr)+';top:'+Y(wy-wh)+';width:'+X(2*wr)+';height:'+Y(2*wh)+'"><i class="wq6glow" style="opacity:'+(.25+.75*k).toFixed(2)+'"></i>'
    +'<svg viewBox="0 0 36 10" preserveAspectRatio="none" aria-hidden="true" shape-rendering="crispEdges"><g class="wtr" id="wqwtr" style="transform:scale('+(0.25+0.75*k).toFixed(3)+')"><rect x="2" y="3" width="32" height="5" fill="#1c5e96"/><rect x="5" y="2" width="26" height="7" fill="#1c5e96"/><rect x="5" y="3" width="26" height="5" fill="#2f8fd0"/><rect x="9" y="4" width="10" height="1" fill="#8fd4ff"/><rect x="22" y="6" width="6" height="1" fill="#bfe6ff"/></g></svg>'
    +'<div class="v6wqr" aria-hidden="true"><svg viewBox="0 0 200 200" preserveAspectRatio="none"><g class="rp"></g></svg></div></div>'
  +'<div class="wqpr" id="wqpr"><i></i></div>'
  +'<div class="wqch" id="wqch" style="left:'+X(hx)+';top:'+Y(hy)+'"><div class="wq6k">'+HWRig.knight({cls:'rgl'})+'</div><div class="wqbk"></div><b class="wq6sd"></b></div>'
  +'<img class="wq6l wq6fg" alt="" src="'+fg(p)+'">'
  +'<div class="wq6lt" style="background:'+(P.tint[1]?HWRig.mix(P.tint[0],'#000000',.2):'transparent')+';opacity:'+(P.tint[1]*.8).toFixed(2)+'"></div>'
  +(P.rays?'<div class="wq6ray"><i></i><i></i><i></i></div>':'')
  +'<div class="wq6mo'+(night?' ff':'')+'">'+m+'</div>'
  +'</div>'
  +'<div class="wq6hud"><b>WELL OF LIFE</b><span class="num">'+Math.round(pct)+'%</span></div>'
  +'<div class="wqd" title="Today\'s water"><i style="height:'+pct+'%"></i></div>'
  +'</div>'}

/* swap the original #wq block for the new scene (it ends where the ADD WATER card begins) */
{const p0=pages.water;pages.water=(...a)=>{const h=p0(...a);try{const i=h.indexOf('<div class="wq" id="wq">');if(i<0)return h;
  const j=h.indexOf('<div class="card"><h3>',i);if(j<0)return h;const t=st.s.water||2000,w=wt();
  return h.slice(0,i)+scene({p:w/t*100})+h.slice(j)}catch(e){console.error('[HWWaterQuest] scene failed:',e);return h}}}

/* ---------- the knight's hydration sequence ---------- */
let run=null,heldDone=null;
const pct=()=>Math.min(100,wt()/(st.s.water||2000)*100);
function meters(W0){const k=pct()/100,l=W0.querySelector('#wqwtr'),g=W0.querySelector('.wqd i'),gl=W0.querySelector('.wq6glow'),hu=W0.querySelector('.wq6hud .num');
  if(l)l.style.transform='scale('+(0.25+0.75*k).toFixed(3)+')';if(g)g.style.height=(k*100)+'%';if(gl)gl.style.opacity=(.25+.75*k).toFixed(2);if(hu)hu.textContent=Math.round(k*100)+'%'}
function pose(W0,s){W0.querySelectorAll('.wqch .rgw,.wq6rf .rgw').forEach(r=>HWRig.pose(r,s))}
function face(W0,d){W0.querySelectorAll('.wqch .rgw,.wq6rf .rgw').forEach(r=>HWRig.face(r,d))}
function walkTo(ch,s,ms){ch.style.setProperty('--wd',ms+'ms');ch.style.left=X(s[0]);ch.style.top=Y(s[1])}
function ring(W0,x,y,n){if(HWMotion.reduced())return;const pd=W0.querySelector('.wq6pr');if(!pd)return;
  for(let i=0;i<(n||3);i++){const r=document.createElement('i');r.style.cssText='left:'+x+'%;top:'+y+'%;animation-delay:'+(i*.22)+'s';pd.appendChild(r);setTimeout(()=>r.remove(),1400+i*250)}}
const burst=(el,o,dy)=>{if(!el)return;const r=el.getBoundingClientRect();HWFX.burst(r.left+r.width/2,r.top+r.height*(dy==null?.5:dy),o)};
function hop(W0){const d=W0.querySelector('.v6wqd');if(d){d.classList.remove('go');void d.offsetWidth;d.classList.add('go')}}

function flow(v,prev,now){const W0=$('#wq'),ch=$('#wqch');
  if(!W0||!ch||!W0.classList.contains('wq6')){render();return}
  if(run&&run.W===W0){meters(W0);flText('+'+v+' mL',1);run.v+=v;return}
  const R=run={W:W0,v:v,t:[]},sp=api.speed;
  const at=(ms,f)=>{R.t.push(setTimeout(()=>{if(run!==R)return;if(!W0.isConnected){end();return}try{f()}catch(e){console.error('[HWWaterQuest]',e);end()}},ms*sp))};
  const end=()=>{R.t.forEach(clearTimeout);if(run===R)run=null;if(heldDone){const f=heldDone;heldDone=null;f()}};
  const rf=W0.querySelector('.wq6rf'),wl=W0.querySelector('.wqwell'),pr=$('#wqpr');
  ch.classList.remove('cel');face(W0,-1);pose(W0,'idle');
  at(220,()=>{ch.classList.add('walk');pose(W0,'walk');walkTo(ch,SPOT.shore,900)});
  at(1140,()=>{ch.classList.remove('walk');ch.classList.add('atw');if(rf)rf.classList.add('on');pose(W0,'kneel')});
  at(1420,()=>{pose(W0,'scoop')});
  at(1900,()=>{ring(W0,30,62,3);burst(W0.querySelector('.wqp'),{n:12,palette:'water',speed:2,up:1,gravity:.14,life:650},.55);sfx(420,.06)});
  at(2420,()=>{pose(W0,'drink');[520,560,600].forEach((f,i)=>setTimeout(()=>sfx(f,.04),i*220*sp))});
  at(3350,()=>{ch.classList.remove('atw');if(rf)rf.classList.remove('on');ch.classList.add('carry');pose(W0,'carry');flText('Refreshed!',0)});
  at(3620,()=>{face(W0,1)});
  at(3900,()=>{ch.classList.add('walk');pose(W0,'cwalk');walkTo(ch,SPOT.well,1050)});
  at(4980,()=>{ch.classList.remove('walk');pose(W0,'pour');sfx(300,.12)});
  at(5300,()=>{if(pr)pr.classList.add('on');ch.classList.remove('carry');
    if(wl){HWWater.ripple(wl.querySelector('.v6wqr .rp'),3);burst(wl,{n:16,palette:'water',speed:2.4,up:1,gravity:.14,life:800})}hop(W0);meters(W0)});
  at(6000,()=>{if(pr)pr.classList.remove('on');ch.classList.add('cel');pose(W0,'cel');flText('+'+R.v+' mL',0);flText('+5 XP',1);sfx(784,.12);burst(ch,{n:18,palette:'gold',speed:2.6,up:1,life:800},.2)});
  at(7250,()=>{ch.classList.remove('cel');pose(W0,'idle');flood2(R.v);end();setTimeout(render,3600)});}
wqFlow=flow;
// the original "quest complete" banner (scheduled by drink()) waits for the sequence to finish
{const c0=complete;complete=function(){if(run&&run.W&&run.W.isConnected){const a=arguments,self=this;heldDone=()=>c0.apply(self,a);return}return c0.apply(this,arguments)}}

HWUI.css('waterquest',`
.wq.wq6{--wh:min(clamp(220px,62vw,430px),76vh);height:var(--wh);min-height:190px;background:#5c9e4a;contain:layout paint}
.wq6 .wq6s{position:absolute;left:50%;bottom:0;width:max(100%,calc(var(--wh) * 16 / 9));height:auto;aspect-ratio:16/9;transform:translateX(-50%)}
.wq6 .wq6l{position:absolute;left:0;top:0;width:100%;height:100%;image-rendering:pixelated;image-rendering:crisp-edges;pointer-events:none;display:block}
.wq6 .wq6l{image-rendering:pixelated}
.wq6 .wq6fg{z-index:8}
.wq6 .wq6cl .cl{position:absolute;display:block;opacity:.92;animation:wq6cl var(--d,90s) linear infinite}
.wq6.ph-evening .wq6cl .cl{opacity:.75;filter:sepia(.6) saturate(2) hue-rotate(-20deg)}.wq6.ph-night .wq6cl .cl{opacity:.28}
@keyframes wq6cl{from{transform:translateX(-30%)}to{transform:translateX(130%)}}
.wq6 .wq6cl b{position:absolute;top:18%;left:-4%;width:1.2%;height:.6%;border-top:2px solid #2b2a3e;animation:wq6bd 26s linear infinite}
.wq6 .wq6cl b:before{content:"";position:absolute;left:100%;top:-4px;width:60%;height:3px;border-top:2px solid #2b2a3e}
.wq6 .wq6cl .bd2{top:23%;animation-delay:-3s;width:1%}
@keyframes wq6bd{0%{transform:translate(0,0)}50%{transform:translate(55vw,-12px)}100%{transform:translate(110vw,6px)}}
.wq6 .wq6fall{position:absolute;overflow:hidden;z-index:1}
.wq6 .wq6fall i{position:absolute;left:0;right:0;top:-100%;height:200%;background:repeating-linear-gradient(180deg,#dff4ff 0 6px,#8fd0ff 6px 10px,#5fb4ec 10px 16px,#bfe6ff 16px 20px);animation:wq6fa .8s linear infinite;opacity:.92}
.wq6.ph-night .wq6fall i,.wq6.ph-evening .wq6fall i{opacity:.65}
@keyframes wq6fa{to{transform:translateY(50%)}}
.wq6 .wq6foam{position:absolute;width:0;height:0;z-index:2}
.wq6 .wq6foam i{position:absolute;width:6px;height:4px;background:#fff;left:-10px;top:-4px;animation:wq6fo .7s steps(3) infinite}
.wq6 .wq6foam i:nth-child(2){left:0;animation-delay:-.25s}.wq6 .wq6foam i:nth-child(3){left:8px;animation-delay:-.5s}
@keyframes wq6fo{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-8px);opacity:0}}
.wq6 .wqp{position:absolute;z-index:2;clip-path:ellipse(50% 50% at 50% 50%);-webkit-clip-path:ellipse(50% 50% at 50% 50%);pointer-events:none}
.wq6 .wq6sh,.wq6 .wq6pr{position:absolute;inset:0}
.wq6 .wq6sh i{position:absolute;width:7%;height:2px;background:#dff4ff;opacity:0;animation:wq6sh 3.2s steps(4) infinite}
@keyframes wq6sh{0%,100%{opacity:0;transform:translateX(0)}40%{opacity:.85}70%{opacity:.3;transform:translateX(30%)}}
.wq6.ph-night .wq6sh i{background:#9fb6ff}
.wq6 .wq6fish{position:absolute;left:30%;top:56%;width:6%;height:7%;background:#0b233c;opacity:.45;animation:wq6fi 16s ease-in-out infinite}
@keyframes wq6fi{0%,100%{transform:translate(0,0) scaleX(1)}45%{transform:translate(260%,40%) scaleX(1)}50%{transform:translate(260%,40%) scaleX(-1)}95%{transform:translate(0,0) scaleX(-1)}}
.wq6 .wq6rf{position:absolute;width:38.8%;transform:translateX(-50%) scaleY(-.62);transform-origin:50% 0;opacity:0;transition:opacity .3s steps(3);-webkit-mask-image:linear-gradient(transparent 30%,#000);mask-image:linear-gradient(transparent 30%,#000)}
.wq6 .wq6rf.on{opacity:.36;animation:wq6rw 1.6s ease-in-out infinite}
@keyframes wq6rw{0%,100%{transform:translateX(-50%) scaleY(-.62) skewX(0)}50%{transform:translateX(-50%) scaleY(-.6) skewX(4deg)}}
.wq6 .wq6pr i{position:absolute;width:12%;height:12%;border:2px solid #dff4ff;border-radius:50%;transform:translate(-50%,-50%) scale(.2);opacity:0;animation:wq6rp 1.1s ease-out forwards}
@keyframes wq6rp{0%{opacity:.95;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.2,1.6)}}
.wq6 .wq6mist i{position:absolute;left:0;top:66%;width:50%;height:6%;background:rgba(255,255,255,.18);animation:wq6mi 14s ease-in-out infinite alternate;z-index:3;pointer-events:none}
.wq6 .wq6mist i+i{top:72%;left:8%;width:36%;opacity:.7;animation-duration:19s}
.wq6.ph-afternoon .wq6mist{display:none}.wq6.ph-night .wq6mist i{background:rgba(160,180,255,.12)}
@keyframes wq6mi{from{transform:translateX(-6%)}to{transform:translateX(10%)}}
.wq6 .v6wqd{z-index:4}.wq6 .v6wsp{z-index:4}
.wq6 .wqwell{position:absolute;z-index:4}
.wq6 .wqwell svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible}
.wq6 .wqwell .wtr{transform-box:fill-box;transform-origin:center;transition:transform 1.2s steps(12)}
.wq6 .wq6glow{position:absolute;left:-60%;right:-60%;top:-260%;bottom:-120%;background:radial-gradient(closest-side,rgba(143,212,255,.45),rgba(143,212,255,0));pointer-events:none;transition:opacity 1.2s steps(6)}
.wq6.ph-afternoon .wq6glow,.wq6.ph-morning .wq6glow{display:none}
.wq6 .v6wqr{position:absolute;inset:0;z-index:2}.wq6 .v6wqr svg{width:100%;height:100%;display:block;overflow:visible}
.wq6 .wqpr{position:absolute;left:73%;top:50.5%;width:2.6%;height:9.6%;display:none;z-index:6;overflow:hidden}
.wq6 .wqpr.on{display:block}.wq6 .wqpr i{position:absolute;left:0;top:-100%;width:100%;height:200%;background:repeating-linear-gradient(180deg,#bfe6ff 0 5px,#5fb4ec 5px 10px);animation:wq6fa .4s linear infinite}
.wq6 .wqch{position:absolute;width:16%;margin:0;transform:translate(-50%,-100%);z-index:6;transition:left var(--wd,1s) linear,top var(--wd,1s) linear}
.wq6 .wq6k{position:relative;z-index:1}
.wq6 .wqbk{display:none!important}
.wq6 .wq6sd{position:absolute;left:14%;right:14%;bottom:-3%;height:8%;background:rgba(0,0,0,.28);border-radius:50%;z-index:0}
.wq6 .wqch.walk .wq6sd{animation:wq6sdw .25s ease-in-out infinite alternate}
.wq6 .wqch.cel .wq6sd{animation:wq6sdj .6s ease-out 2}
@keyframes wq6sdw{to{transform:scaleX(.9)}}@keyframes wq6sdj{35%{transform:scale(.6);opacity:.5}}
.wq6 .wq6lt{position:absolute;inset:0;z-index:9;pointer-events:none;mix-blend-mode:multiply}
.wq6 .wq6s:after{content:"";position:absolute;inset:0;z-index:10;pointer-events:none;background:radial-gradient(ellipse at 50% 55%,transparent 55%,rgba(10,14,30,.32))}
.wq6 .wq6ray{position:absolute;inset:0;z-index:9;pointer-events:none;overflow:hidden}
.wq6 .wq6ray i{position:absolute;top:-20%;width:7%;height:130%;background:rgba(255,246,200,.13);transform:skewX(-24deg);animation:wq6ry 9s ease-in-out infinite}
.wq6 .wq6ray i:nth-child(1){left:62%}.wq6 .wq6ray i:nth-child(2){left:74%;width:4%;animation-delay:-3s}.wq6 .wq6ray i:nth-child(3){left:84%;width:9%;animation-delay:-6s}
@keyframes wq6ry{0%,100%{opacity:.35}50%{opacity:1}}
.wq6 .wq6mo{position:absolute;inset:0;z-index:9;pointer-events:none}
.wq6 .wq6mo i{position:absolute;width:3px;height:3px;background:rgba(255,250,220,.75);animation:wq6mo var(--d,6s) ease-in-out infinite}
.wq6 .wq6mo.ff i{width:4px;height:4px;background:#fff6a0;box-shadow:0 0 6px 2px rgba(255,240,140,.55)}
@keyframes wq6mo{0%,100%{transform:translate(0,0);opacity:0}30%{opacity:1}50%{transform:translate(14px,-18px)}80%{opacity:.6}}
.wq6 .wq6hud{position:absolute;left:8px;top:8px;z-index:12;display:flex;gap:8px;align-items:center;background:rgba(14,18,40,.72);color:#fff;border:2px solid #fff;padding:4px 8px;font:8px/1.4 var(--fh)}
.wq6 .wq6hud .num{color:#8fd4ff}
.wq6 .wqd{right:8px;top:12%;height:52%;width:12px;z-index:12;background:rgba(14,18,40,.6);border-color:#fff}
.wq6 .wqd i{background:linear-gradient(90deg,#5fb4ec 0 50%,#2f8fd0 50%)}
.wq6 .wqfl,.wq6 .wqsp{z-index:13}
@media(prefers-reduced-motion:reduce){.wq6 .wq6cl .cl,.wq6 .wq6cl b,.wq6 .wq6fall i,.wq6 .wq6foam i,.wq6 .wq6sh i,.wq6 .wq6fish,.wq6 .wq6rf.on,.wq6 .wq6mist i,.wq6 .wq6ray i,.wq6 .wq6mo i,.wq6 .wqpr i,.wq6 .wq6sd{animation:none!important}.wq6 .wqch,.wq6 .wtr{transition:none!important}.wq6 .wq6mo,.wq6 .wq6pr{display:none}}
html.hw-q-performance .wq6 .wq6mist,html.hw-q-performance .wq6 .wq6ray,html.hw-q-performance .wq6 .wq6mo i:nth-child(2n),html.hw-q-performance .wq6 .wq6cl b{display:none}
html.hw-q-performance .wq6 .wq6sh i{animation-duration:6s}
`);
const api={speed:1,SPOT,PH,phase,scene,flow,get busy(){return !!run}};
return api})();
