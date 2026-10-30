/* v6: pictures for the Health Hall cards and the image buttons (owner's request, 2026-10-30). Not part of the original.
   Every picture is composed from art already in the app by tools/art/make_hall_art.py (nothing is drawn at run time):
     Health Hall cards  assets/img/hall-<tracker>.webp, 144 × 108, behind the icon and the numbers, darkened so the text stays readable.
                        Food & Water: Luke on the left and a well on the right; the app fills the well with water as the day's water
                        is logged (--wf, 0 to 1, from the same figures as the tile's "Water 0 / 2,100 mL" line; nothing new is measured).
     Image buttons      assets/img/btn-<name>.webp, 240 × 48. A picture button is still a real <button>: same data-a action, same label text
                        (kept for screen readers and the tests), same size rules. The label sits on the darkened right side.
   Pictures are decoration only: they never carry the health numbers. */
const HWArt=(()=>{
const KEYS=['food','sleep','stair','exercise','stress','body','stats','score'];
// the well sprite (assets/img/hall-well.webp, 40 × 44, drawn at 2×) has its shaft at x 9–31, y 28–40: the water is drawn over it in percent of the sprite
const WELL={l:9/40*100,w:22/40*100,b:4/44*100,h:12/44*100};
function wf(){try{const t=+st.s.water||0;return t>0?Math.max(0,Math.min(1,wt(today())/t)):0}catch(e){return 0}}
{const p=pages.health;pages.health=function(){const h=p.apply(this,arguments);return h.replace('<button class="hb" data-a="go" data-v="food">','<button class="hb" data-a="go" data-v="food" style="--wf:'+wf().toFixed(3)+'"><i class="hbwell" aria-hidden="true"><i class="hbwater"></i></i>')}}
const card=k=>'#hub.hub .hb[data-v="'+k+'"]{background-image:linear-gradient(180deg,rgba(8,6,26,.34),rgba(8,6,26,.78)),url(assets/img/hall-'+k+'.webp);background-size:100% 100%,cover;background-repeat:no-repeat;background-position:center,center 45%}';
HWUI.css('art',`
#hub.hub .hb{position:relative;overflow:hidden;min-height:150px;color:#fff;background-color:#14102c;image-rendering:pixelated;isolation:isolate}
@media(min-width:700px){#hub.hub .hb{min-height:210px}}
${KEYS.map(card).join('\n')}
#hub.hub .hb[data-v="food"]{background-position:center,left 45%}
#hub.hub .hb[data-v="stats"]{background-position:center,center 90%}#hub.hub .hb[data-v="exercise"]{background-position:center,center 35%}
#hub.hub .hb b,#hub.hub .hb small,#hub.hub .hb em,#hub.hub .hb .hwa{color:#fff;text-shadow:0 1px 0 #000,0 0 4px rgba(0,0,0,.9)}
#hub.hub .hb .bi{filter:drop-shadow(0 2px 2px rgba(0,0,0,.8))}
/* Food & Water: the well stands at the right of the card; the water inside it rises with the day's water (--wf, 0 to 1) */
.hbwell{position:absolute;z-index:-1;right:7%;bottom:14px;width:80px;height:88px;pointer-events:none;background:url(assets/img/hall-well.webp) center/100% 100% no-repeat;image-rendering:pixelated}
.hbwater{position:absolute;left:${WELL.l}%;bottom:${WELL.b}%;width:${WELL.w}%;height:calc(var(--wf,0) * ${WELL.h}%);background:linear-gradient(180deg,#8fdcff,#2f86d8 60%,#1d5cae)}
.imgbtn{display:block;width:100%;height:96px;min-height:96px;padding:0 14px 0 46%;box-sizing:border-box;text-align:right;color:#fff;font-weight:700;letter-spacing:.5px;
  text-shadow:0 2px 0 #000,0 0 6px rgba(0,0,0,.9);border:3px solid var(--ln);background-color:var(--ibc,#241a30);
  background-image:linear-gradient(90deg,transparent 0,transparent 24%,rgba(8,6,26,.9) 52%),var(--ibg);background-position:left center,left center;background-size:100% 100%,auto 100%;background-repeat:no-repeat;image-rendering:pixelated}
.imgbtn:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.ib-quests{--ibg:url(assets/img/btn-quests.webp);--ibc:#2a1c12}.ib-lab{--ibg:url(assets/img/btn-lab.webp);--ibc:#1a1440}.ib-obs{--ibg:url(assets/img/btn-obs.webp);--ibc:#18304a}
.ib-time{--ibg:url(assets/img/btn-time.webp);--ibc:#183a44}.ib-monument{--ibg:url(assets/img/btn-monument.webp);--ibc:#2c1e56}
@media(max-width:380px){.imgbtn{padding-left:40%;font-size:14px}}
`);
return{KEYS,wf}})();
