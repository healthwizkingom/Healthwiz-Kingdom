/* v6: styles for the Arcana upgrades (js/v6-arcana.js), split out like v6-campus-css.js. Theme tokens only (--pn --p2 --ln --ink --mut
   --gold --blue --vio --edge --glow, status --st-*); numbers in the sans (--fn) with tabular figures; motion off under reduced motion. */
HWUI.css('arcana',`
.arc-elg,.arc-org,.arc-tg{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:start}
@media(max-width:520px){.arc-elg,.arc-tg{grid-template-columns:minmax(0,1fr)}}
.arc-elem p,.arc-orc p,.arc-gw p,.arc-ch p,.arc-srv p,.arc-forge p{margin:6px 0}
.arc-elem small,.arc-orc small,.arc-gw small,.arc-ch small,.arc-srv small,.arc-forge small,.arc-led small{display:block;font-size:12px;margin-top:4px}
.arc-pot{display:flex;gap:12px;align-items:center}.arc-pot .num,.arc-thermo .num,.arc-orc .num{font:700 20px var(--fn);font-variant-numeric:tabular-nums}
.arc-st{display:block;margin:4px 0}
.potion-bottle{position:relative;width:48px;height:72px;flex:0 0 48px;border:4px solid var(--ln);border-top-width:6px;background:var(--p2);
  clip-path:polygon(30% 0,70% 0,70% 18%,100% 34%,100% 100%,0 100%,0 34%,30% 18%);overflow:hidden}
.potion-bottle .cork{position:absolute;left:34%;right:34%;top:0;height:8px;background:#8a5a2b;z-index:2}
.liquid-fill{position:absolute;left:0;right:0;bottom:0;background:linear-gradient(var(--blue),var(--vio));background-color:var(--blue);transition:height .6s steps(6)}
.liquid-fill::before{content:"";position:absolute;left:0;right:0;top:0;height:4px;background:rgba(255,255,255,.55)}
.arc-pot.full .potion-bottle{box-shadow:0 0 16px 4px var(--gold),0 0 4px 1px #fff}
.arc-thermo{display:flex;gap:10px;align-items:flex-start}
.therm{position:relative;flex:0 0 14px;height:64px;border:3px solid var(--ln);background:var(--p2);border-radius:0}
.therm i{position:absolute;left:0;right:0;bottom:0;background:var(--blue)}.arc-thermo.hot .therm i{background:var(--red)}
.arc-warn{padding:6px 8px;border:2px solid var(--ln);background:var(--p2)}
.arc-ball{width:96px;height:96px;image-rendering:pixelated;filter:drop-shadow(0 0 8px var(--vio))}
.arc-orl{margin:4px 0 4px 18px;padding:0}.arc-orl li{margin:2px 0;font:14px var(--fn);font-variant-numeric:tabular-nums}
.arc-gw label,.arc-srv label,.arc-ch label{display:block;margin:8px 0 2px;font-size:14px}
.arc-gw select,.arc-srv select,.arc-srv input,.arc-ch input{width:100%;min-height:44px;box-sizing:border-box;max-width:100%}
.arc-row{gap:8px;margin:8px 0}.arc-row button{min-height:44px}
.arc-tw{overflow-x:auto;margin:10px 0}
.leaderboard{width:100%;border-collapse:collapse;font:14px var(--fn);font-variant-numeric:tabular-nums}
.leaderboard caption{text-align:left;font-size:12px;padding:0 0 4px}
.leaderboard th,.leaderboard td{border:2px solid var(--ln);padding:6px 8px;text-align:right}.leaderboard th[scope=row],.leaderboard thead th:first-child{text-align:left}
.leaderboard thead th{background:var(--p2);font:700 13px var(--fn)}
.guild-banner-top{background:color-mix(in srgb,var(--gold) 22%,transparent)}
.guild-banner-top th[scope=row]{border-left:6px solid var(--gold)}
.arc-crown{display:inline-block;width:2px;height:2px;margin:0 16px 6px 2px;vertical-align:middle;color:var(--gold);
  box-shadow:0 0 0 0,4px 4px 0 0,8px 0 0 0,12px 4px 0 0,16px 0 0 0,0 4px 0 0,0 8px 0 0,4px 8px 0 0,8px 8px 0 0,12px 8px 0 0,16px 8px 0 0,16px 4px 0 0;transform:scale(1.5);transform-origin:left center}
.arc-ch{margin-top:14px;padding-top:10px;border-top:3px dashed var(--ln)}.arc-ch h4{margin:14px 0 4px;font:700 15px var(--fl)}
.arc-cad{font:700 16px var(--fn);font-variant-numeric:tabular-nums;min-height:1.4em}
.arc-cmp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.arc-cmp span{padding:6px 8px;border:2px solid var(--ln);background:var(--p2);font:14px var(--fn)}
@media(max-width:520px){.arc-cmp{grid-template-columns:minmax(0,1fr)}}
.arc-led{margin:8px 0 12px}
.arc-scale{position:relative;height:300px;margin:8px auto;max-width:360px;overflow:hidden}
.scale-beam{position:absolute;left:18%;right:18%;top:118px;height:8px;background:var(--gold);border:2px solid var(--ln);transform-origin:50% 50%;transform:rotate(var(--a));transition:transform .8s steps(8)}
.arc-scale.still .scale-beam{transition:none}
.scale-pan{position:absolute;top:2px;width:88px;min-height:44px;padding:4px;text-align:center;border:3px solid var(--ln);border-top:0;background:var(--pn);font:12px var(--fn);font-variant-numeric:tabular-nums;
  transform-origin:50% 0;transform:rotate(calc(-1 * var(--a)))}
.scale-pan b{display:block;font:700 14px var(--fn)}#pan-food{left:-44px}#pan-work{right:-44px}
.arc-post{position:absolute;left:50%;top:122px;width:10px;margin-left:-5px;bottom:0;background:var(--ln)}
.arc-post::after{content:"";position:absolute;left:-30px;right:-30px;bottom:0;height:8px;background:var(--ln)}
.arc-srv .row{gap:8px}
@media(prefers-reduced-motion:reduce){.liquid-fill,.scale-beam{transition:none}.arc-ball{filter:none}}

.arc-hg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:stretch}
@media(max-width:560px){.arc-hg{grid-template-columns:minmax(0,1fr)}}
.arc-hg h4{margin:0 0 8px;font:700 14px var(--fl);color:var(--gold)}
.arc-hg>div{display:flex;flex-direction:column;align-items:flex-start;text-align:left;min-width:0;padding:10px;border:2px solid var(--ln);background:var(--p2)}
.arc-hg .arc-pot{flex-direction:row;align-items:center;gap:12px;min-height:96px}
.arc-hg .arc-orbw{align-self:flex-start}
.arc-hg .arc-more{margin-top:auto;align-self:stretch;background:var(--pn)}.arc-hg .arc-sc,.arc-hg>div>p{margin-bottom:8px}
.arc-orc .arc-more,.arc-orc .arc-warn{text-align:left;align-self:stretch}
.arc-mn{margin:0 0 12px}.arc-mn h4{margin:0 0 8px;font:700 14px var(--fl);color:var(--gold)}.arc-mn .aq{margin-bottom:6px}
.arc-sc{margin:4px 0}.arc-sc .big{font:700 32px var(--fn);font-variant-numeric:tabular-nums}
.arc-more{margin-top:8px;border:2px solid var(--ln);background:var(--p2)}.arc-more>summary{min-height:44px;display:flex;align-items:center;padding:0 10px;cursor:pointer;font:600 13px var(--fn)}
.arc-more>*:not(summary){margin-left:10px;margin-right:10px}.arc-more[open]{padding-bottom:8px}
.arc-thermo{flex-wrap:wrap}
`);
/* ---------- the enchantments: every loop runs only with full motion and outside Performance mode ---------- */
HWUI.css('arcana-fx',`
.arc-potw{position:relative;flex:0 0 auto}
.potion-bottle{width:56px;height:84px;flex-basis:56px;background-color:color-mix(in srgb,var(--p2) 70%,#0a1030)}
.liquid-fill{overflow:hidden;box-shadow:inset 0 0 12px rgba(127,243,255,.45)}
.liquid-fill .wave{position:absolute;left:-50%;top:-5px;width:200%;height:10px;
  background:radial-gradient(circle at 6px 10px,var(--blue) 6px,transparent 6.5px) 0 0/12px 10px repeat-x;filter:brightness(1.35);image-rendering:pixelated}
.liquid-fill .bub{position:absolute;bottom:2px;width:4px;height:4px;background:rgba(255,255,255,.75);opacity:0}
.liquid-fill .bub:nth-of-type(1){left:18%}.liquid-fill .bub:nth-of-type(2){left:46%;width:2px;height:2px}.liquid-fill .bub:nth-of-type(3){left:68%}.liquid-fill .bub:nth-of-type(4){left:32%;width:2px;height:2px}
.potion-bottle .shine{position:absolute;left:18%;top:38%;width:4px;height:36%;background:rgba(255,255,255,.4);box-shadow:4px 0 0 rgba(255,255,255,.15)}
.arc-pot.full .potion-bottle{box-shadow:0 0 0 2px var(--gold),0 0 22px 6px color-mix(in srgb,var(--gold) 70%,transparent)}
.arc-spark{position:absolute;inset:-14px;pointer-events:none}
.arc-spark i{position:absolute;width:4px;height:4px;background:var(--gold);box-shadow:0 0 6px var(--gold);left:50%;top:50%;opacity:0}
.arc-spark i:nth-child(1){--x:-34px;--y:-30px}.arc-spark i:nth-child(2){--x:34px;--y:-26px}.arc-spark i:nth-child(3){--x:-38px;--y:8px}.arc-spark i:nth-child(4){--x:38px;--y:12px}
.arc-spark i:nth-child(5){--x:-20px;--y:46px}.arc-spark i:nth-child(6){--x:22px;--y:44px}.arc-spark i:nth-child(7){--x:0;--y:-50px}.arc-spark i:nth-child(8){--x:4px;--y:54px}
.arc-thermo{position:relative}
.arc-sun{position:absolute;left:-10px;top:-12px;width:36px;height:36px;border-radius:50%;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,color-mix(in srgb,var(--gold) 70%,transparent) 0 10deg,transparent 10deg 30deg);
  -webkit-mask:radial-gradient(circle,transparent 7px,#000 8px,#000 17px,transparent 18px);mask:radial-gradient(circle,transparent 7px,#000 8px,#000 17px,transparent 18px)}
.arc-thermo.hot .therm i{background:linear-gradient(#ffd86b,var(--red));box-shadow:0 0 10px var(--red)}
.therm::after{content:"";position:absolute;left:50%;bottom:-10px;width:16px;height:16px;margin-left:-8px;background:var(--blue);border:3px solid var(--ln)}
.arc-thermo.hot .therm::after{background:var(--red);box-shadow:0 0 12px var(--red)}
.therm{margin-bottom:10px}
.arc-orbw{position:relative;width:132px;height:132px;display:grid;place-items:center;color:var(--gold)}
.arc-orbw .arc-ball{width:120px;height:120px;filter:drop-shadow(0 0 14px var(--vio)) drop-shadow(0 0 4px #9ff);position:relative}
.arc-orbw.dim .arc-ball{filter:grayscale(.6)}
.arc-ring{position:absolute;inset:0;width:100%;height:100%;opacity:.75}
.arc-ring text{font:8px var(--fn);fill:currentColor;letter-spacing:2px}
.arc-orbw.dim .arc-ring{opacity:.3}
@media(max-width:520px){.arc-org{grid-template-columns:minmax(0,1fr);justify-items:center}.arc-org>div:last-child{justify-self:stretch}}
.leaderboard td:nth-child(2){background:linear-gradient(90deg,color-mix(in srgb,var(--vio) 45%,transparent) var(--p),transparent var(--p))}
.guild-banner-top{position:relative;background-image:linear-gradient(110deg,transparent 30%,color-mix(in srgb,var(--gold) 40%,transparent) 48%,transparent 66%);background-size:250% 100%;background-repeat:no-repeat}
.guild-banner-top td:nth-child(2){background:linear-gradient(90deg,color-mix(in srgb,var(--gold) 55%,transparent) var(--p),transparent var(--p))}
.arc-crown{margin-bottom:8px}
.arc-echo{position:relative;height:56px;margin:4px 0;display:grid;place-items:center;overflow:hidden}
.arc-echo b{width:14px;height:14px;background:var(--pn);border:3px solid var(--ln);transform:rotate(45deg)}
.arc-echo.on b{background:#9ff;box-shadow:0 0 10px #9ff}
.arc-rip{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px;border:2px solid #9ff;opacity:0;transform:rotate(45deg)}
.arc-wind{position:relative;height:40px;overflow:hidden;margin:4px 0}
.arc-wind i{position:absolute;left:-40%;height:2px;width:36%;background:linear-gradient(90deg,transparent,#cfe9ff,transparent)}
.arc-wind i:nth-child(1){top:4px}.arc-wind i:nth-child(2){top:10px;animation-delay:.3s}.arc-wind i:nth-child(3){top:16px;animation-delay:.7s}.arc-wind i:nth-child(4){top:22px;animation-delay:.15s}
.arc-wind i:nth-child(5){top:28px;animation-delay:.5s}.arc-wind i:nth-child(6){top:33px;animation-delay:.9s}.arc-wind i:nth-child(7){top:37px;animation-delay:.6s}
.arc-grav{margin:8px 0;padding:0}.arc-grav svg{display:block;width:100%;max-width:420px;height:auto;background:linear-gradient(#070b24,#1a1450);border:3px solid var(--ln)}
.arc-grav figcaption{font-size:12px;margin-top:4px}
.arc-field line{stroke:rgba(180,140,255,.35);stroke-width:1;stroke-dasharray:3 9}
.arc-gst{stroke:#d9c7ff;stroke-width:3}.arc-fig{fill:#ffd86b}.arc-g{stroke:#ffd86b;stroke-width:3}
.arc-grav text{font:700 9px var(--fn);fill:#f6edcf}
.arc-fg{display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:center}@media(max-width:520px){.arc-fg{grid-template-columns:minmax(0,1fr)}}
.arc-flame{--c1:#ffd86b;--c2:#ff8a3d;--c3:#ff4d4d;position:relative;width:84px;height:96px;margin:0 auto}
.arc-flame.f-low-carb,.arc-flame.f-fasting{--c1:#c9fff4;--c2:#4fe0c8;--c3:#2a7fd0}
.arc-flame.f-mixed{--c1:#fff1b0;--c2:#ffb84d;--c3:#b48cff}
.arc-flame i{position:absolute;bottom:26px;width:12px;background:linear-gradient(var(--c1),var(--c2) 55%,var(--c3));transform-origin:50% 100%;
  clip-path:polygon(50% 0,100% 40%,100% 100%,0 100%,0 40%);filter:drop-shadow(0 0 6px var(--c2))}
.arc-flame i:nth-child(1){left:12px;height:30px}.arc-flame i:nth-child(2){left:22px;height:46px}.arc-flame i:nth-child(3){left:34px;height:60px;width:16px}
.arc-flame i:nth-child(4){left:48px;height:44px}.arc-flame i:nth-child(5){left:58px;height:28px}.arc-flame i:nth-child(6){left:28px;height:34px;opacity:.8}.arc-flame i:nth-child(7){left:44px;height:38px;opacity:.8}
.arc-anvil{position:absolute;left:6px;right:6px;bottom:0;height:26px;background:#3a3550;border:3px solid var(--ln);clip-path:polygon(0 0,100% 0,82% 45%,82% 100%,18% 100%,18% 45%);box-shadow:inset 0 4px 0 #6b6488}
.arc-flame s{position:absolute;bottom:40px;width:3px;height:3px;background:var(--c1);opacity:0;text-decoration:none}
.arc-flame s:nth-of-type(1){left:20px}.arc-flame s:nth-of-type(2){left:40px;animation-delay:.6s}.arc-flame s:nth-of-type(3){left:60px;animation-delay:1.1s}.arc-flame s:nth-of-type(4){left:30px;animation-delay:1.6s}.arc-flame s:nth-of-type(5){left:52px;animation-delay:.3s}
.arc-srv{background-image:linear-gradient(color-mix(in srgb,var(--gold) 8%,transparent) 1px,transparent 1px),linear-gradient(90deg,color-mix(in srgb,var(--gold) 8%,transparent) 1px,transparent 1px);background-size:16px 16px}
.arc-tri{display:block;width:100%;max-width:300px;height:auto;margin:8px 0}
.arc-tp{fill:color-mix(in srgb,var(--vio) 25%,transparent);stroke:var(--ink);stroke-width:2.5;stroke-linejoin:miter;stroke-dasharray:600;stroke-dashoffset:0}
.arc-ta{fill:none;stroke:var(--gold);stroke-width:2.5}
.arc-tri text{font:600 10px var(--fn);fill:var(--ink)}.arc-tri .arc-tav{font-weight:800;fill:var(--gold)}
.arc-tri.ghost{opacity:.35}.arc-tri.ok .arc-tp{stroke:var(--st-good,var(--grn));filter:drop-shadow(0 0 5px var(--st-good,var(--grn)))}.arc-tri.off .arc-tp{stroke:var(--st-caution,var(--red))}
.scale-beam{box-shadow:0 0 10px color-mix(in srgb,var(--gold) 70%,transparent)}
.scale-pan{background:linear-gradient(var(--pn),var(--p2));border-radius:0 0 40% 40% / 0 0 30% 30%;padding-top:10px}
.scale-pan::before,.scale-pan::after{content:"";position:absolute;top:-30px;width:2px;height:30px;background:repeating-linear-gradient(var(--gold) 0 4px,transparent 4px 6px)}
.scale-pan::before{left:12px;transform:rotate(-18deg);transform-origin:bottom}.scale-pan::after{right:12px;transform:rotate(18deg);transform-origin:bottom}
.scale-pan{top:30px}
#pan-food{box-shadow:0 0 16px color-mix(in srgb,var(--gold) 55%,transparent)}
.arc-coins{display:flex;justify-content:center;gap:1px;margin:-4px 0 2px}.arc-coins i{width:6px;height:6px;background:var(--gold);box-shadow:inset -2px -2px 0 #b8862b}
.arc-coins i:nth-child(even){transform:translateY(-3px)}
.arc-feather{display:block;width:16px;height:6px;margin:-2px auto 2px;background:#cfe9ff;clip-path:polygon(0 50%,30% 0,100% 40%,100% 60%,30% 100%)}
.arc-post{background:linear-gradient(90deg,#6b4a1f,#d9b45a,#6b4a1f)}
.arc-post::before{content:"";position:absolute;left:-7px;top:-14px;width:24px;height:24px;background:radial-gradient(circle,#fff 0 3px,var(--vio) 4px 8px,transparent 9px)}

:root[data-motion="full"]:not(.hw-q-performance) .liquid-fill .wave{animation:arcWave 1.6s steps(6) infinite}
:root[data-motion="full"]:not(.hw-q-performance) .liquid-fill .bub{animation:arcBub 2.4s steps(8) infinite}
:root[data-motion="full"]:not(.hw-q-performance) .liquid-fill .bub:nth-of-type(2){animation-delay:.8s}
:root[data-motion="full"]:not(.hw-q-performance) .liquid-fill .bub:nth-of-type(3){animation-delay:1.5s}
:root[data-motion="full"]:not(.hw-q-performance) .liquid-fill .bub:nth-of-type(4){animation-delay:2s}
:root[data-motion="full"] .arc-spark i{animation:arcBurst 1.2s steps(6) 1 forwards}
:root[data-motion="full"]:not(.hw-q-performance) .arc-spark i{animation:arcBurst 2.4s steps(8) infinite}
:root[data-motion="full"]:not(.hw-q-performance) .arc-sun{animation:arcSpin 12s linear infinite}
:root[data-motion="full"]:not(.hw-q-performance) .arc-thermo.hot .therm i{animation:arcShim .9s steps(3) infinite alternate}
:root[data-motion="full"]:not(.hw-q-performance) .arc-ring{animation:arcSpin 40s linear infinite}
:root[data-motion="full"]:not(.hw-q-performance) .guild-banner-top{animation:arcSweep 3.5s ease-in-out infinite}
:root[data-motion="full"]:not(.hw-q-performance) .arc-crown{animation:arcBob 1.2s steps(2) infinite}
:root[data-motion="full"] .arc-rip{animation:arcRip 1.2s ease-out forwards}
:root[data-motion="full"]:not(.hw-q-performance) .arc-echo.on b{animation:arcBeat .8s steps(2) infinite}
:root[data-motion="full"] .arc-wind i{animation:arcWind 1.1s linear infinite}
:root[data-motion="full"]:not(.hw-q-performance) .arc-field line{animation:arcFall 1.6s linear infinite}
:root[data-motion="full"]:not(.hw-q-performance) .arc-flame i{animation:arcFlick .5s steps(3) infinite alternate}
:root[data-motion="full"]:not(.hw-q-performance) .arc-flame i:nth-child(even){animation-duration:.7s;animation-delay:-.2s}
:root[data-motion="full"]:not(.hw-q-performance) .arc-flame s{animation:arcEmber 2.2s steps(8) infinite}
:root[data-motion="full"] .arc-tri:not(.ghost) .arc-tp{animation:arcDraw .9s steps(9) 1}
:root[data-motion="full"] .arc-scale:not(.still) .scale-beam{animation:arcSettle 1.6s cubic-bezier(.3,1.6,.5,1) 1}
:root[data-motion="full"] .arc-scale:not(.still) .scale-pan{animation:arcSettleP 1.6s cubic-bezier(.3,1.6,.5,1) 1}
@keyframes arcWave{to{transform:translateX(12px)}}
@keyframes arcBub{0%{opacity:0;transform:translateY(0)}15%{opacity:1}100%{opacity:0;transform:translateY(-70px)}}
@keyframes arcBurst{0%{opacity:0;transform:translate(0,0)}30%{opacity:1}100%{opacity:0;transform:translate(var(--x),var(--y))}}
@keyframes arcSpin{to{transform:rotate(360deg)}}
@keyframes arcSpin2{50%{opacity:.6}}
@keyframes arcShim{to{filter:brightness(1.4)}}
@keyframes arcSweep{0%{background-position:120% 0}100%{background-position:-120% 0}}
@keyframes arcBob{50%{transform:scale(1.5) translateY(-2px)}}
@keyframes arcTwinkle{to{opacity:.45}}
@keyframes arcRip{0%{opacity:1;transform:rotate(45deg) scale(1)}100%{opacity:0;transform:rotate(45deg) scale(5)}}
@keyframes arcBeat{50%{transform:rotate(45deg) scale(1.2)}}
@keyframes arcWind{to{left:110%}}
@keyframes arcFall{to{stroke-dashoffset:-12}}
@keyframes arcFlick{0%{transform:scaleY(.85) skewX(-4deg)}100%{transform:scaleY(1.08) skewX(4deg)}}
@keyframes arcEmber{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(6px,-60px)}}
@keyframes arcDraw{from{stroke-dashoffset:600}to{stroke-dashoffset:0}}
@keyframes arcSettle{0%{transform:rotate(calc(.55 * var(--a)))}100%{transform:rotate(var(--a))}}
@keyframes arcSettleP{0%{transform:rotate(calc(-.55 * var(--a)))}100%{transform:rotate(calc(-1 * var(--a)))}}
`);

/* ---------- the Enchanted Tower and the Scrying Glass ---------- */
HWUI.css('arcana-tower',`
.arc-tg2{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:start}
@media(min-width:700px){.arc-tg2{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}}
.arc-stage{position:relative;isolation:isolate;width:100%;max-width:380px;aspect-ratio:4/5;margin:0 auto;overflow:hidden;
  border:3px solid var(--ln);background:#070b24;box-shadow:0 0 0 2px color-mix(in srgb,var(--vio) 60%,transparent),0 0 24px color-mix(in srgb,var(--vio) 45%,transparent)}
.arc-stage canvas{position:relative;z-index:1;display:block;width:100%;height:100%;image-rendering:pixelated;background:transparent}
.arc-stage video{position:absolute;inset:0;z-index:-1;width:100%;height:100%;object-fit:cover}
.arc-stage.ar{background:transparent;box-shadow:0 0 0 2px #5ff6ff,0 0 28px 4px rgba(95,246,255,.55)}
.arc-stage.ar canvas{filter:drop-shadow(0 0 3px #5ff6ff) drop-shadow(0 0 8px rgba(180,120,255,.8))}
.arc-stage.arc-rune{box-shadow:0 0 0 3px var(--gold),0 0 26px 6px color-mix(in srgb,var(--gold) 70%,transparent)}
.arc-scry-tag{position:absolute;z-index:2;left:8px;top:8px;padding:2px 8px;font:700 12px var(--fn);color:#041018;background:#5ff6ff;box-shadow:0 0 10px #5ff6ff}
.arc-book{padding:12px;border:3px solid var(--ln);background:linear-gradient(color-mix(in srgb,var(--vio) 14%,var(--pn)),var(--pn));background-color:var(--pn);
  box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--gold) 35%,transparent)}
.arc-book h4{margin:0 0 8px;font:700 16px var(--fd,var(--fl));color:var(--gold)}
.arc-book dl{margin:0;display:grid;gap:6px}
.arc-bk{display:grid;grid-template-columns:minmax(88px,auto) minmax(0,1fr);gap:8px;align-items:baseline;padding:4px 0;border-bottom:1px dashed color-mix(in srgb,var(--ln) 70%,transparent)}
.arc-bk dt{font:600 13px var(--fn);color:var(--mut)}.arc-bk dd{margin:0;font:700 16px var(--fn);font-variant-numeric:tabular-nums;text-align:right;overflow-wrap:anywhere}
.arc-bk dd small{display:block;font:400 12px var(--fn);color:var(--mut)}
.arc-bk dd input{width:7ch;min-height:44px;text-align:right;font:700 16px var(--fn);font-variant-numeric:tabular-nums}
.arc-btns{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0 6px}
.arc-btns .btn-primary{flex:1 1 220px;min-height:48px}
.arc-btns .btn-secondary{flex:0 0 auto;min-height:44px;padding:0 14px}
.arc-listen{position:relative;box-shadow:0 0 0 3px #9ff}
:root[data-motion="full"] .arc-listen{animation:arcListen 1.1s ease-in-out infinite}
:root[data-motion="full"]:not(.hw-q-performance) .arc-stage.live{animation:arcStage 3s ease-in-out infinite alternate}
@keyframes arcListen{0%,100%{box-shadow:0 0 0 2px #9ff,0 0 0 0 rgba(159,255,255,.6)}50%{box-shadow:0 0 0 2px #9ff,0 0 0 10px rgba(159,255,255,0)}}
@keyframes arcStage{to{box-shadow:0 0 0 2px color-mix(in srgb,var(--vio) 80%,transparent),0 0 34px 6px color-mix(in srgb,var(--vio) 60%,transparent)}}
.arc-scry-tag.seen{background:#ffd86b;box-shadow:0 0 10px #ffd86b}
.arc-btns .arc-xr-btn{flex:1 1 220px;min-height:48px;background:linear-gradient(#7ff3ff,#3fb6d0);background-color:#5ff6ff;color:#04121a}
.arc-btns .arc-xr-btn[hidden]{display:none}
.arc-xr-ui{position:fixed;left:0;right:0;bottom:0;z-index:99;padding:12px 16px calc(16px + env(safe-area-inset-bottom,0px));background:rgba(8,6,30,.82);color:#f6edcf;font:15px var(--fn);border-top:2px solid #5ff6ff}
.arc-xr-ui[hidden]{display:none}.arc-xr-ui p{margin:4px 0}.arc-xr-m{font-variant-numeric:tabular-nums;color:#bfefff}
.arc-xr-b{display:flex;gap:8px;margin-top:8px}.arc-xr-b button{flex:1;min-height:48px}
.arc-sight-note{display:block;margin:4px 0}
`);
