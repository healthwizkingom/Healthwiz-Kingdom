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
.arc-tower{width:150px;height:150px;perspective:420px;display:flex;align-items:flex-end;justify-content:center;border:3px solid var(--ln);background:radial-gradient(circle at 50% 80%,color-mix(in srgb,var(--vio) 35%,transparent),transparent 70%);background-color:var(--p2);overflow:hidden}
.arc-flight{position:relative;width:70px;height:130px;transform-origin:50% 100%;transform-style:preserve-3d;display:flex;flex-direction:column-reverse}
.arc-flight>i{flex:1 1 0;min-height:3px;background-color:var(--pn);border:1px solid var(--ln);border-top:2px solid var(--gold)}
.arc-flight>i:nth-child(odd){background-color:var(--p2)}
.ghost-pacer{position:absolute;left:50%;bottom:calc(var(--y,0) * 100%);width:16px;height:22px;margin-left:-8px;background:#e6f6ff;opacity:.8;
  clip-path:polygon(50% 0,100% 30%,100% 100%,75% 85%,50% 100%,25% 85%,0 100%,0 30%);box-shadow:0 0 10px #9ff}
.arc-tower.arc-rune{box-shadow:0 0 0 3px var(--gold),0 0 18px 4px var(--gold)}
.arc-tower.arc-rune::after{content:"RUNES GLOW: IN STEP";position:absolute;margin:4px;font:700 12px var(--fn);color:var(--ink);background:var(--gold);padding:2px 4px}
.arc-tower{position:relative}
.arc-cad{font:700 16px var(--fn);font-variant-numeric:tabular-nums;min-height:1.4em}
.arc-cmp{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.arc-cmp span{padding:6px 8px;border:2px solid var(--ln);background:var(--p2);font:14px var(--fn)}
@media(max-width:520px){.arc-cmp{grid-template-columns:minmax(0,1fr)}}
.arc-led{margin:8px 0 12px}
.arc-scale{position:relative;height:250px;margin:8px auto;max-width:360px;overflow:hidden}
.scale-beam{position:absolute;left:18%;right:18%;top:118px;height:8px;background:var(--gold);border:2px solid var(--ln);transform-origin:50% 50%;transform:rotate(var(--a));transition:transform .8s steps(8)}
.arc-scale.still .scale-beam{transition:none}
.scale-pan{position:absolute;top:2px;width:88px;min-height:44px;padding:4px;text-align:center;border:3px solid var(--ln);border-top:0;background:var(--pn);font:12px var(--fn);font-variant-numeric:tabular-nums;
  transform-origin:50% 0;transform:rotate(calc(-1 * var(--a)))}
.scale-pan b{display:block;font:700 14px var(--fn)}#pan-food{left:-44px}#pan-work{right:-44px}
.arc-post{position:absolute;left:50%;top:122px;width:10px;margin-left:-5px;bottom:0;background:var(--ln)}
.arc-post::after{content:"";position:absolute;left:-30px;right:-30px;bottom:0;height:8px;background:var(--ln)}
.arc-srv .row{gap:8px}
@media(prefers-reduced-motion:reduce){.liquid-fill,.scale-beam{transition:none}.arc-ball{filter:none}}
`);
