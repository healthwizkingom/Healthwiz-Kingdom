/* v6: the Stairs features' styles (js/v6-stairs.js), split from it to keep each file under 64 KB. Not part of the original. */
HWUI.css('stairs',`
.stlabr{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.stlabr .gvbtn{min-height:44px}
.stfill{outline:3px solid var(--gold);outline-offset:2px}
.stcnt{margin:10px 0}.stlab{display:block;margin:10px 0 2px;font:12px/1.6 var(--fl)}
.stchips{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:8px;margin:8px 0}
.stchips .chip{min-height:44px;min-width:44px;padding:6px 4px;font:14px/1.2 var(--fn)}
.stbox[hidden]{display:none}.stot{margin:8px 0;font-size:16px;overflow-wrap:anywhere}
.sthud{margin:0 0 8px}.sthud .pxst{flex:1 1 130px}
.ststats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 10px}
.ststat{padding:8px 10px;background:var(--pn);border:var(--px-bw-c) solid var(--ln);display:flex;flex-direction:column;gap:2px}
.stsv{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.stsv b{font-size:22px;line-height:1.2}.stsv small,.stsl{font-size:13px;color:var(--mut)}
.stgoal{margin:0 0 12px}.stgoal small{font-size:13px;color:var(--mut)}.stnote{font-size:13px;margin:8px 0}
.stcard h3,#sthrg h3,#stlog h3{display:flex;align-items:center;gap:8px}
.sthd{display:flex;align-items:center;gap:12px;margin:22px 0 12px;padding:10px 12px;background:var(--pn);border:var(--px-bw) solid var(--ln);box-shadow:var(--px-bevel),var(--px-sh);scroll-margin-top:12px} /* also used by js/v6-body.js */
.sthd>div{min-width:0;display:flex;flex-direction:column;gap:4px;align-items:flex-start}.sthd b{font:var(--px-f2)/1.3 var(--fh);overflow-wrap:anywhere}.sthd small{font-size:13px}
.sttabs{margin-bottom:20px}.sttabs .nst .bar{min-height:10px}
.stkh{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:10px 0}.stkh>b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fl)}.stkh small{flex:1 1 100%}
.stlogr{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 4px}.stlogb{flex:1 1 140px;min-height:44px;margin:0;justify-content:center}.stcam{flex:0 1 auto;min-height:44px;display:flex;align-items:center;justify-content:center;gap:6px}
.stcount{margin:10px 0;padding:8px 10px;border:var(--px-bw-c) dashed var(--ln);background:var(--p2)}.stcount b:first-child{font:var(--px-f1)/1.6 var(--fl);margin-right:6px}
.stlogs{margin:10px 0}.stlg{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:6px 0;border-top:2px dashed var(--p2)}.stlg .stsa2{margin-left:auto;display:flex;gap:6px}
.stcats button{flex:1 1 90px}.stloc{display:flex;align-items:center;gap:6px;flex-wrap:wrap;overflow-wrap:anywhere}
.stsave{width:100%;margin-top:8px}.stbtns button{flex:1 1 100px;justify-content:center}.stbtns button:first-child{flex-grow:3}
.sttimer{display:flex;align-items:baseline;justify-content:center;gap:10px;margin-top:8px}.sttimer small{font:var(--px-f1)/1.6 var(--fl)}.sttimer b{font:var(--px-f2)/1.3 var(--fh)}
.sthrs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}
.sthr{padding:8px;border:var(--px-bw-c) solid var(--ln);box-shadow:var(--px-sh-c);background:var(--p2)}.sthr.b{border-top-color:var(--blue);border-top-width:6px}.sthr.a{border-top-color:var(--red);border-top-width:6px}
.sthrh{display:flex;align-items:center;gap:6px;margin-bottom:6px}.sthrh b{font:var(--px-f1)/1.6 var(--fl)}
.stpm{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0 6px;font-size:13px}.stpm small{font-size:13px;overflow-wrap:anywhere}
#ststudy summary{cursor:pointer;min-height:44px;display:flex;align-items:center}#ststudy summary b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fl)}
#ststudy .tbl{min-width:0;width:100%;table-layout:fixed;font:12px/1.3 var(--fb)}#ststudy th,#ststudy td{text-align:left;padding:4px 2px;vertical-align:top}#ststudy td+td{white-space:nowrap}#ststudy th{font:600 12px/1.3 var(--fb);color:var(--mut);overflow-wrap:anywhere}#ststudy th:nth-child(1){width:17%}#ststudy th:nth-child(2),#ststudy th:nth-child(3){width:11%}#ststudy th:nth-child(5){width:10%}#ststudy th:nth-child(4){width:21%}#ststudy th:nth-child(6),#ststudy th:nth-child(7){width:16%}
.sttr{width:100%;height:120px;display:block;border:3px solid var(--ln);image-rendering:pixelated}
.stkc{margin:10px 0;padding:10px;border:var(--px-bw-c) dashed var(--ln);background:var(--p2)}.stkc>b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fl)}.stkc p{margin:6px 0}
.sthrsvg{width:100%;max-width:560px;height:auto;display:block;shape-rendering:crispEdges}.sthrsvg text{font:12px var(--fb);fill:var(--mut)}
.sthrsvg .gl{stroke:var(--mut);stroke-opacity:.35;stroke-width:1}.sthrsvg .jn{stroke:var(--ink);stroke-opacity:.5;stroke-width:2}
.sthrsvg .hb{fill:var(--blue);stroke:var(--pn);stroke-width:2;shape-rendering:auto}.sthrsvg .ha{fill:var(--red);stroke:var(--pn);stroke-width:2}
.sthrsvg .hr1{fill:var(--grn);stroke:var(--pn);stroke-width:2}.sthrsvg .dsh{stroke-dasharray:3 2}
.sthrsvg .pt:hover .jn,.sthrsvg .pt:focus .jn{stroke-opacity:1}.sthrsvg .pt:focus{outline:none}.sthrsvg .pt:focus rect[fill=transparent]{stroke:var(--gold);stroke-width:2}
.stleg{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:6px;font-size:13px}.stleg span{display:flex;align-items:center;gap:6px}
.stleg i{display:inline-block;width:10px;height:10px;border:2px solid var(--ln)}.stleg i.hb{background:var(--blue);border-radius:50%}.stleg i.ha{background:var(--red)}.stleg i.hr1{background:var(--grn);clip-path:polygon(50% 0,100% 100%,0 100%)}
#st-rec:empty{display:none}#st-recavg{border-color:var(--grn)}
.sttab{width:100%;border-collapse:collapse;font-size:13px}.sttab th,.sttab td{text-align:left;padding:3px 6px;border-bottom:1px dashed var(--mut)}
.stses{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:2px dashed var(--p2);animation:pgin .3s steps(4)}.stses:first-of-type{border-top:0}
.stsi{flex:0 0 auto;padding:4px;background:var(--p2);border:var(--px-bw-s) solid var(--ln)}.stses.w .stsi{background:var(--pn);box-shadow:0 0 0 2px var(--red)}
.stsb{flex:1 1 auto;min-width:0}.stsb>b{display:block;overflow-wrap:anywhere}.stsb>small{color:var(--mut)}.stsb p{margin:4px 0}
.ststags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.stsh{display:grid;grid-template-columns:auto 1fr auto;gap:2px 8px;align-items:center;font-size:12px;max-width:340px}.stsh .bar{margin:0}
.stsa{display:flex;flex-direction:column;gap:6px;flex:0 0 auto}
.strest{display:flex;gap:6px;align-items:flex-start;margin-top:4px;font-size:13px}.strest:empty{display:none}
.stclimb{margin:10px 0;padding:8px;border:var(--px-bw-c) dashed var(--ln);background:var(--p2)}.stclimb>b{display:flex;align-items:center;gap:6px;font:var(--px-f1)/1.6 var(--fl)}
.stclimb .row label{flex:1 1 90px}.stclimb p{margin:6px 0;font-size:14px}.stclimb small{display:flex;gap:6px;align-items:center}.stsh b{display:inline-flex;align-items:center;gap:2px}
@media(prefers-reduced-motion:reduce){.stses{animation:none}}html.hw-rm .stses,html.hw-still .stses{animation:none}
`);
