/* v6: world progression (master prompt §18, §20, §21, §97 step 11). Not part of the original.
   The original kingdom map (background, region nodes, paths, dimming/glow) is unchanged. This adds
   a decoration layer inside the map's SVG so each region visibly changes with its state:
     Ruined      cracked stones + a bare tree        Recovering  sprouts
     Developing  a cottage + young tree               Thriving    flags, flowers + a strolling villager
     Flourishing flower ring, sparkles + two villagers
   plus a fog over the whole map that lifts as regions recover, and a "Kingdom chronicle" of
   region changes on the Kingdom page (st.ex.ch, last 20). Animations use the original
   reduced-motion rule (all animation off) automatically. */
const HWWorld=(()=>{
const R=(x,y,w,h,f,extra)=>'<rect x="'+(+x).toFixed(1)+'" y="'+(+y).toFixed(1)+'" width="'+w+'" height="'+h+'" fill="'+f+'"'+(extra||'')+'/>';
// props stand beside the region icon (labels sit below it), mirrored left near the right edge
function props(lv,x,y){const m=x>72,bx=m?x-19:x+6,by=y-1,X=v=>m?bx+13-v:bx+v;let g='';
  const P=(v,yy,w,h,f,ex)=>R(m?X(v)-w:X(v),yy,w,h,f,ex);
  if(lv===0)g+=P(0,by-1.4,2.4,1.4,'#7d7462')+P(3,by-1,2,1,'#5f5747')+P(1,by-2.6,.8,1.4,'#5f5747')+P(10,by-5,.8,5,'#5b3a1e')+P(8.6,by-5,3.4,.7,'#5b3a1e');
  if(lv>=1)g+=P(0,by-1.8,.8,1.8,'#5cc05a')+P(1.6,by-2.4,.8,2.4,'#3f9f4a')+P(12,by-1.8,.8,1.8,'#5cc05a');
  if(lv>=2)g+=P(6,by-4.4,5.2,4.4,'#e6d3a8')+P(5.4,by-6,6.4,1.8,'#a8473a')+P(8,by-2.2,1.2,2.2,'#5b3a1e')+P(1,by-5.2,1,5.2,'#5b3a1e')+P(-.6,by-8.4,4.2,3.6,'#2f8a3a');
  if(lv>=3)g+=P(13,by-8,.5,8,'#5b3a1e')+P(13.5,by-8,2.6,1.5,'#d9453d','class="zf"')+[0,1,2,3].map(i=>P(2.4+i*2.4,by+.3,1.1,1.1,['#f2c14e','#e0483f','#ff9be0','#fff'][i])).join('')
    +'<g class="zwk" style="--d:'+(9+x%5)+'s;--w:'+(m?-4:4)+'px">'+P(3,by-3.6,1.8,1.8,'#f1c27d')+P(2.8,by-1.8,2.2,1.8,'#2f8fd0')+'</g>';
  if(lv>=4)g+='<circle cx="'+x+'" cy="'+y+'" r="11.5" fill="none" stroke="#ff9be0" stroke-width=".7" stroke-dasharray="1 1.4" opacity=".95"/>'+[0,1,2].map(i=>R(x-7+i*7,y-12.5+(i%2)*2,1,1,'#fff8c0','class="zt" style="--d:'+(1.4+i*.4)+'s;--l:'+(i*.3)+'s"')).join('')
    +'<g class="zwk" style="--d:'+(11+x%3)+'s;--w:'+(m?4:-4)+'px">'+P(9,by-3.6,1.8,1.8,'#c68642')+P(8.8,by-1.8,2.2,1.8,'#8767c8')+'</g>';
  return '<g class="v6prop" data-lv="'+lv+'">'+g+'</g>'}
function layer(){const L=KR.map(r=>HWKingdom.level(r)),ruined=L.filter(x=>x===0).length/KR.length;
  return '<g class="v6world" data-ruined="'+ruined.toFixed(2)+'">'+KR.map((r,i)=>props(L[i],r[5],r[6])).join('')+'<rect class="v6fog" width="100" height="112" fill="#5a5f73" opacity="'+(ruined*.32).toFixed(3)+'" pointer-events="none"/></g>'}
{const k=kmap;kmap=function(){const h=k.apply(this,arguments),i=h.indexOf('</svg>');return i<0?h:h.slice(0,i)+layer()+h.slice(i)}}

HWUI.css('world','.v6world *{transform-box:fill-box}.km.mini .v6world .zwk{animation-duration:14s}');

/* chronicle of world changes */
const ch=()=>{const X=(st.ex=st.ex&&typeof st.ex==='object'?st.ex:{p:{}});if(!Array.isArray(X.ch))X.ch=[];return X.ch};
HWEvents.on('kingdom:state',e=>{const C=ch();C.push({d:today(),t:e.up?(e.to==='Flourishing'?'🌸 '+e.name+' burst into bloom — Flourishing!':'✨ '+e.name+' became '+e.to+'.'):'🍂 '+e.name+' grew quieter ('+e.to+'). It will recover when you return.'});if(C.length>20)C.splice(0,C.length-20);save()});
function chronicle(){const C=ch().slice(-8).reverse();return '<div class="card" id="v6chron"><h3>📜 KINGDOM CHRONICLE</h3>'+(C.length?C.map(x=>'<p>'+esc(x.t)+' <small class="mut">'+esc(x.d.slice(5))+'</small></p>').join(''):emp('📜 THE CHRONICLE IS BLANK','As your regions change, the royal scribe will record it here.'))+'</div>'}
{const p=pages.kingdom;pages.kingdom=(...a)=>{const h=p(...a),k='<div class="card"><h3>REGIONS</h3>',i=h.indexOf(k);return i<0?h+chronicle():h.slice(0,i)+chronicle()+h.slice(i)}}
return{props,layer,chronicle}})();
