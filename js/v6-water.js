/* v6: well scene data for the Water page (master prompt §48–49, §68, §85, §97 step 15). Not part of the original.
   The Water page's scene is drawn by js/v6-waterquest.js (layered valley, rigged knight). This file decides what the
   scene shows: stage() follows the original six well stages (water tracking days, never the amount in one day:
   dry → sprouts → trees and moss → fireflies → deer and a rabbit → flowers), finds() counts the earlier Well Garden
   discoveries kept in the save (st.mg.c.water.f; the Well Garden game itself was removed, nothing new is added),
   ripple() spreads rings across the well, and SP holds the pixel sprites (also used by the Calming Grove).
   Everything still is static under reduced motion; Performance mode stops the looping ambient bits. */
const HWWater=(()=>{
/* ---------- pixel sprites: "x,y,w,h,colour;…" in sprite pixels ---------- */
const SP={
  sprout:[5,5,'2,2,1,3,#3f9f4a;0,1,2,1,#5cc05a;3,0,2,1,#5cc05a;1,2,1,1,#5cc05a;3,1,1,1,#5cc05a'],
  tree:[12,16,'5,10,2,6,#5b3a1e;2,2,8,6,#2f8a3a;0,5,12,4,#2f8a3a;1,8,10,2,#2a7a34;4,0,4,2,#3f9f4a;3,3,3,2,#5cc05a;8,6,2,1,#5cc05a'],
  dead:[10,12,'4,4,2,8,#5b3a1e;1,3,3,1,#5b3a1e;6,1,1,4,#5b3a1e;7,1,2,1,#5b3a1e;0,2,1,1,#5b3a1e;3,11,4,1,#4a2f18'],
  flower:[5,6,'2,3,1,3,#3f9f4a;1,0,3,3,var(--pc,#ff9be0);0,1,5,1,var(--pc,#ff9be0);2,1,1,1,#f2c14e;3,4,2,1,#5cc05a'],
  deer:[14,12,'2,3,8,4,#a8693a;9,1,3,3,#a8693a;12,2,2,1,#2b2418;10,1,1,1,#2b2418;8,0,1,2,#6b4a2b;11,0,1,2,#6b4a2b;2,7,1,5,#7a4a26;4,7,1,5,#7a4a26;7,7,1,5,#7a4a26;9,7,1,5,#7a4a26;3,4,2,1,#f1d9b0;1,3,1,1,#f1d9b0'],
  rabbit:[7,7,'1,3,4,3,#e9e3d6;4,2,2,2,#e9e3d6;4,0,1,2,#e9e3d6;5,0,1,2,#d8cfc0;5,3,1,1,#2b2418;0,4,1,1,#ffffff;1,6,1,1,#bdb3a2;4,6,1,1,#bdb3a2'],
  frog:[7,5,'1,1,5,3,#4cae4c;0,3,7,2,#3f9f4a;1,0,2,2,#4cae4c;4,0,2,2,#4cae4c;1,0,1,1,#2b2418;5,0,1,1,#2b2418;2,3,3,1,#cfe8a0'],
  planter:[11,9,'0,4,11,5,#8a5a2b;0,4,11,1,#a8693a;1,0,2,4,#3f9f4a;4,1,2,3,#5cc05a;7,0,2,4,#2f8a3a;5,0,1,1,#e0f0c0;9,2,1,2,#5cc05a;2,6,2,1,#6b4a2b;7,6,2,1,#6b4a2b'],
  lantern:[5,14,'2,3,1,11,#3a3a48;0,0,5,1,#3a3a48;1,1,3,3,#f2c14e;1,1,3,1,#fff2a8;0,4,5,1,#3a3a48;1,13,3,1,#3a3a48'],
  fly:[5,4,'0,0,2,2,#ff9be0;3,0,2,2,#ff9be0;0,2,2,1,#f2a6e8;3,2,2,1,#f2a6e8;2,0,1,4,#2b2418'],
  cloud:[16,6,'3,1,10,4,#ffffff;5,0,6,1,#ffffff;1,3,14,3,#ffffff;0,4,16,2,#eef6ff'],
  bush:[10,6,'1,1,8,5,#2f8a3a;0,3,10,3,#2a7a34;2,0,3,2,#3f9f4a;6,0,2,1,#3f9f4a;3,2,2,1,#5cc05a']};
/* the original well stage (pages.water): tracking days, never intake */
const STAGE=['Old Well','First Sprouts','Green Trees','Fireflies','Animals Return','Village Restored'];
function stage(){const wd=wdays();return wd>=21?5:wd>=14?4:wd>=9?3:wd>=5?2:wd>=2?1:0}
const finds=()=>{try{return Math.max(0,+HWGames.data('water').f||0)}catch(e){return 0}};

HWUI.css('water',`
.v6wsp{position:absolute;transform:translate(-50%,-100%);image-rendering:pixelated;pointer-events:none;overflow:visible;height:auto}
.v6wqd,.v6wqr{position:absolute;inset:0;pointer-events:none}.v6wqd{z-index:1}
.wq .wqp,.wq .wqwell,.wq .wqd{z-index:2}.wq .v6wqr{z-index:3}
.v6wqr .rim{position:absolute;right:9%;top:12%;width:46%;max-width:300px;aspect-ratio:1}
.v6wqr svg{width:100%;height:100%;display:block;overflow:visible}
.v6wcl{animation:v6wcl var(--d,70s) linear infinite}@keyframes v6wcl{from{margin-left:-8%}to{margin-left:8%}}
.v6wff{position:absolute;width:4px;height:4px;background:#fff6a0;box-shadow:0 0 4px #fff6a0;animation:v6wff 3.2s steps(8) infinite;pointer-events:none}
@keyframes v6wff{0%,100%{opacity:.2;transform:translate(0,0)}50%{opacity:1;transform:translate(6px,-5px)}}
.v6wfl{animation:v6wfl 2.4s steps(4) infinite alternate}@keyframes v6wfl{to{margin-top:-6px;margin-left:5px}}
.v6wsw{transform-origin:50% 100%;animation:v6wsw 3.6s steps(4) infinite alternate}@keyframes v6wsw{from{transform:translate(-50%,-100%) rotate(-2deg)}to{transform:translate(-50%,-100%) rotate(2deg)}}
.v6wqd.go .v6whop{animation:v6whop .5s steps(3) 2}@keyframes v6whop{50%{margin-top:-7px}}
.v6wrip{fill:none;stroke:#dff4ff;stroke-width:3;opacity:0;transform-origin:100px 100px;animation:v6wrip 1.3s steps(9) forwards}
@keyframes v6wrip{0%{opacity:.95;transform:scale(.15)}100%{opacity:0;transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.v6wcl,.v6wff,.v6wfl,.v6wsw,.v6wqd.go .v6whop{animation:none!important}.v6wrip{display:none}}
html.hw-q-performance .v6wcl,html.hw-q-performance .v6wsw,html.hw-q-performance .v6wfl{animation:none!important}html.hw-q-performance .v6wff:nth-of-type(2n){display:none}
`);

/* ---------- 1. shared with the Water Quest scene (js/v6-waterquest.js) ---------- */
// rings spread across a well's water: circles in a 200×200 svg group
function ripple(svg,n){if(!svg||HWMotion.reduced())return;for(let i=0;i<(n||3);i++){const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('class','v6wrip');c.setAttribute('cx',100);c.setAttribute('cy',100);c.setAttribute('r',58);c.style.animationDelay=i*.28+'s';svg.appendChild(c);setTimeout(()=>c.remove(),1400+i*300)}}

return{stage,finds,ripple,SP}})();
