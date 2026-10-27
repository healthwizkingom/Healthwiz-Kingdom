/* v6: The Ascent Monument's styles (js/v6-monument.js, js/v6-monument-scene.js). Not part of the original. Theme tokens only;
   the scene itself is a night world in every theme. Pixel art at whole-number scales (image-rendering: pixelated). */
HWUI.css('monument',`
.mndoor{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.mndart{flex:0 0 auto;width:96px;height:112px;border-radius:10px;border:1px solid var(--edge,var(--ln));image-rendering:pixelated;box-shadow:0 0 14px rgba(246,201,79,.18)}
.mndtx{flex:1 1 200px;min-width:0}.mndtx h3{display:flex;align-items:center;gap:6px;margin-top:0}.mndtx p{margin:4px 0}.mndtx button{margin-top:6px;min-height:44px}
.mntag{font:600 16px/1.3 var(--fl);color:var(--gold)}.mnlead{margin:4px 0 8px;text-align:center}
.mndstat b{font:700 20px/1.2 var(--fn);font-variant-numeric:tabular-nums}
.mnstage{position:relative;overflow:hidden;border-radius:12px;background:#0a0920;border:1px solid var(--edge,var(--ln));min-height:120px}
.mncv{display:block;margin:0 auto;image-rendering:pixelated;image-rendering:crisp-edges;max-width:none}
.mnhud{position:absolute;left:8px;top:8px;right:8px;pointer-events:none;display:flex}
.mnchip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:rgba(10,9,32,.82);border:1px solid rgba(246,201,79,.55);color:#fff3c0;font:600 12px/1.4 var(--fl);max-width:62%}
.mnskip{position:absolute;right:8px;top:8px;min-height:44px;background:rgba(10,9,32,.85)!important;color:#fff3c0!important}
.mnnew{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);margin:0;padding:6px 12px;border-radius:999px;background:rgba(10,9,32,.86);border:1px solid rgba(127,240,255,.6);color:#e8fbff;font:600 13px/1.3 var(--fn);text-align:center;width:max-content;max-width:calc(100% - 24px)}
.mnnew:empty{display:none}
.mnfail{min-height:0}.mnfb{margin:12px;color:#fff3c0}
.mnalt{margin:8px 0;font-size:14px}
.mnstats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin:8px 0}
.mnstats .t{display:flex;flex-direction:column;gap:2px;padding:10px;border-radius:12px;background:var(--p2);border:1px solid var(--edge,var(--ln));min-width:0}
.mnstats .t small{font-size:12px}.mnstats .t b{font:700 22px/1.2 var(--fn);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.mnstats .mnbig{grid-column:1/-1}.mnstats .mnbig b{font-size:36px;color:var(--gold)}.mnstats .t b.mnw{font-size:17px}
.mnmain>button{min-height:44px;margin-top:4px}
.mnhero{margin:4px 0 8px}.mnhero b{font:700 28px/1.2 var(--fn);color:var(--gold);font-variant-numeric:tabular-nums}.mnhero span{color:var(--mut)}
.mnchips{display:flex;gap:6px;margin:6px 0;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}.mnchips .chip{min-height:44px;flex:0 0 auto;white-space:nowrap;scroll-snap-align:start}
.mnlbl{margin:8px 0 2px;font:600 12px/1.4 var(--fl);color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
.mnsv,.mnlad,.mnbars{display:block;width:100%;max-width:520px;height:auto;margin:0 auto;overflow:visible}
.mnsv text,.mnlad text,.mnbars text{font:12px var(--fn);fill:var(--ink)}.mnsv .mnv,.mnlad .mnv,.mnbars .mnv{font-weight:700}.mnsv .mnsm{fill:var(--mut)}
.mnbase,.mnaxis{stroke:var(--mut);stroke-width:2}.mntick{stroke:var(--mut);stroke-width:1}.mnlead{stroke:var(--mut);stroke-width:1;opacity:.6}
.mnreach{stroke:var(--gold);stroke-width:1.5;stroke-dasharray:4 3}.mnyou{fill:var(--gold);stroke:var(--bg);stroke-width:2}
.mnlm{fill:var(--vio);opacity:.88;stroke:var(--bg);stroke-width:1}.mnlm-hill,.mnlm-peak{fill:var(--grn)}.mnlm-house,.mnlm-block{fill:var(--blue)}
.mndot{fill:var(--p2);stroke:var(--mut);stroke-width:1.5}.mndot.got{fill:var(--gold);stroke:var(--gold)}.mnme{fill:var(--gold)}
.mnrows{list-style:none;margin:8px 0;padding:0}.mnrow{padding:8px 0;border-top:1px solid var(--edge,var(--ln));display:flex;flex-direction:column;gap:3px}
.mnrh{display:flex;flex-wrap:wrap;align-items:center;gap:4px 6px}.mnh{font-variant-numeric:tabular-nums;color:var(--mut)}
.mnratio b{font:700 18px/1.2 var(--fn);font-variant-numeric:tabular-nums}
.mnbar{height:10px;border-radius:5px;background:var(--bg);border:1px solid var(--edge,var(--ln));overflow:hidden}.mnbar i{display:block;height:100%;background:var(--gold);border-radius:4px;min-width:2px}
.mnrow.got .mnbar i{background:var(--grn)}.mnok{color:var(--st-good,var(--grn));display:inline-flex;align-items:center;gap:4px}
.mnfact{display:flex;gap:6px;align-items:flex-start;color:var(--ink)}.mnfact svg{flex:0 0 auto;margin-top:1px}
.mnladw summary,.mnled summary{cursor:pointer;min-height:44px;display:flex;flex-wrap:wrap;align-items:center;gap:6px}.mnled summary h3{margin:0;display:inline-flex;align-items:center;gap:6px}
.mnfl{list-style:none;margin:0;padding:0}.mnfl li{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--edge,var(--ln))}.mnfl li:first-child{border-top:0}
.mnfl li>svg{flex:0 0 auto}.mnfl p{margin:2px 0 0}
.mntiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.mntiles .t{padding:8px;border-radius:10px;background:var(--p2);border:1px solid var(--edge,var(--ln));display:flex;flex-direction:column;min-width:0}
.mntiles .t b{font:700 18px/1.2 var(--fn);font-variant-numeric:tabular-nums}
.mnb{fill:var(--gold);opacity:.75}.mnb.now{opacity:1}.mnb0{fill:var(--mut);opacity:.5}
.mnsr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.mntw{overflow-x:auto}.mntw table{width:100%;border-collapse:collapse;font-size:13px}.mntw th,.mntw td{text-align:left;padding:6px 4px;border-top:1px solid var(--edge,var(--ln));vertical-align:top}
.mntw td:nth-child(3),.mntw td:nth-child(5){font-variant-numeric:tabular-nums}
.mntime p,.mnnote p{display:block}.mntime p svg,.mnnote p svg{vertical-align:-3px}
/* compact landmark rows: name, height and percent on one line; the detail opens on tap (the owner's "too many words" request) */
.mnrow{display:block;padding:0}.mnrow>details>summary{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center;list-style:none;cursor:pointer;padding:12px 2px;min-height:48px}
.mnrow>details>summary::-webkit-details-marker{display:none}.mnrt{display:flex;flex-direction:column;gap:1px;min-width:0}.mnrt b{font:600 15px/1.25 var(--fn)}.mnrt .mnh{font-size:13px}
.mnpc{font:700 17px/1 var(--fn);font-variant-numeric:tabular-nums;display:inline-flex;align-items:center;gap:4px;justify-self:end}
.mnrow>details>summary .mnbar{grid-column:1/-1;height:8px}.mnrow>details[open]>summary{padding-bottom:6px}
.mnmore{display:flex;flex-direction:column;gap:6px;padding:4px 2px 14px}.mnmore .mnrh{font-weight:600}
.mnabout,.mnnote details{margin-top:8px}.mnabout summary,.mnnote summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font:600 14px var(--fn);color:var(--mut)}.mnnote summary h3{margin:0;border:0;padding:0}
.mnstats{grid-template-columns:1fr 1fr}.mnstats .t{text-align:center}
@media(min-width:900px){.mnmain{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;align-items:start}.mnside .mnalt{margin-top:0}.mnstats .mnbig b{font-size:32px}}
@media(max-width:420px){.mnstats .mnbig b{font-size:30px}.mntiles .t b{font-size:16px}}
`);
