/* v6: pictures for the Health Hall cards and the image buttons (owner's request, 2026-10-30). Not part of the original.
     Health Hall cards  assets/img/hall-<tracker>.webp: the owner's own pictures (tools/art/src/hall-*.jpg, reduced by tools/art/make_hall_art.py),
                        behind the icon and the numbers, darkened so the text stays readable. Stress uses Medius's study.
     Image buttons      assets/img/btn-<name>.webp, 240 × 48, composed from art already in the app by the same script. A picture button is still a
                        real <button>: same data-a action, same label text (kept for screen readers and the tests), same size rules.
   Pictures are decoration only: they never carry the health numbers. */
const HWArt=(()=>{
const KEYS=['food','sleep','stair','exercise','stress','body','stats','score'];
const POS={sleep:'78%',food:'62%',stair:'30%',stats:'55%',score:'60%'};
const card=k=>'#hub.hub .hb[data-v="'+k+'"]{background-image:linear-gradient(180deg,rgba(8,6,26,.34),rgba(8,6,26,.78)),url(assets/img/hall-'+k+'.webp);background-size:100% 100%,cover;background-repeat:no-repeat;background-position:center,'+(POS[k]||'50%')+' 45%}';
HWUI.css('art',`
html #hub.hub .hb{position:relative;overflow:hidden;min-height:150px;color:#fff;background-color:#14102c;image-rendering:pixelated;isolation:isolate}
@media(min-width:700px){html #hub.hub .hb{min-height:200px}}
${KEYS.map(card).join('\n')}

#hub.hub .hb b,#hub.hub .hb small,#hub.hub .hb em,#hub.hub .hb .hwa{color:#fff;text-shadow:0 1px 0 #000,0 0 4px rgba(0,0,0,.9)}
#hub.hub .hb .bi{filter:drop-shadow(0 2px 2px rgba(0,0,0,.8))}
.imgbtn{display:block;width:100%;height:96px;min-height:96px;padding:0 14px 0 46%;box-sizing:border-box;text-align:right;color:#fff;font-weight:700;letter-spacing:.5px;
  text-shadow:0 2px 0 #000,0 0 6px rgba(0,0,0,.9);border:3px solid var(--ln);background-color:var(--ibc,#241a30);
  background-image:linear-gradient(90deg,transparent 0,transparent 24%,rgba(8,6,26,.9) 52%),var(--ibg);background-position:left center,left center;background-size:100% 100%,auto 100%;background-repeat:no-repeat;image-rendering:pixelated}
.imgbtn:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.ib-quests{--ibg:url(assets/img/btn-quests.webp);--ibc:#2a1c12;height:48px;min-height:48px;padding-left:44%}   /* Home: the picture at its own size (1×) keeps the screen as short as the plain button was */.ib-lab{--ibg:url(assets/img/btn-lab.webp);--ibc:#1a1440}.ib-obs{--ibg:url(assets/img/btn-obs.webp);--ibc:#18304a}
.ib-time{--ibg:url(assets/img/btn-time.webp);--ibc:#183a44}.ib-monument{--ibg:url(assets/img/btn-monument.webp);--ibc:#2c1e56}
@media(max-width:380px){.imgbtn{padding-left:40%;font-size:14px}}
`);
/* The phone's status bar (clock, signal, battery) takes the colour of <meta name="theme-color">. A browser cannot make it transparent, so it is kept the
   same colour as the page's own background and follows the theme and the day/night look: the bar then melts into the app instead of showing as a band. */
const bar=()=>{try{const m=document.querySelector('meta[name="theme-color"]'),c=getComputedStyle(document.body).backgroundColor;if(m&&c&&c!=='rgba(0, 0, 0, 0)'&&m.getAttribute('content')!==c)m.setAttribute('content',c)}catch(e){}};
bar();new MutationObserver(bar).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-skin','class','style']});
try{const q=matchMedia('(prefers-color-scheme: dark)');q.addListener?q.addListener(bar):0}catch(e){}
return{KEYS,bar}})();
