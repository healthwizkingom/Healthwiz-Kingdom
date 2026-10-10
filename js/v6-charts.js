/* v6: interactive, accessible charts + period comparison (master prompt §61–62, §89, §97 step 10).
   Not part of the original. Every chart in the app is drawn by the original chart(); this wraps it:
     • touch / mouse / keyboard: tap or hover a bar, or focus the chart and use ← →, to read
       "Tue 30 Sep: 1,200 mL" in a live region (the original showed values only on desktop hover)
     • sparse date labels (first / middle / last) on charts with more than 7 bars
     • role="img" with a spoken summary (days with data, average, peak, target)
     • a useful empty state instead of an empty box
   The Statistics page also gets "This week vs last week" (completed days only, neutral wording). */
const HWCharts=(()=>{
const fmtD=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)?new Date(s+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}):String(s);
const num=x=>{const r=Math.round(x*10)/10;return r.toLocaleString()};
const NAMES={kcal:'calories',mL:'water',h:'sleep',steps:'stair steps',BPM:'heart rate','/10':'stress','/5':'energy',g:'grams','%':'quest progress',XP:'XP'};
const _chart=chart;
chart=function(v,lb,c,u,tg,tl){const vals=v.map(x=>x==null||isNaN(+x)?null:+x),has=vals.filter(x=>x),what=NAMES[u]||u||'values';
  if(!has.length)return '<div class="v6ce" role="img" aria-label="No '+esc(what)+' logged in this period"><b>📭 NO '+esc(what.toUpperCase())+' YET</b><small>Nothing logged in this period. Log '+esc(what)+' and this chart will fill in.</small></div>';
  let h=_chart.apply(this,arguments);
  const a=has.reduce((s,x)=>s+x,0)/has.length,pk=Math.max(...has),label=esc(what)+' chart, '+lb.length+' '+(lb.length===24?'hours':'days')+': '+has.length+' with data, average '+num(a)+' '+esc(u)+', peak '+num(pk)+' '+esc(u)+(tg?', '+esc(tl||'target')+' '+num(tg)+' '+esc(u):'')+'. Use left and right arrow keys to read each value.';
  h=h.replace('<div class="ch">','<div class="ch v6ch" role="img" tabindex="0" aria-label="'+label+'" data-u="'+esc(u)+'" data-v="'+esc(JSON.stringify(vals))+'" data-l="'+esc(JSON.stringify(lb))+'">');
  if(lb.length>7){const at=[0,Math.floor((lb.length-1)/2),lb.length-1];const sp='<div class="chl v6sl">'+at.map(i=>'<span style="left:'+(i/(lb.length-1)*100)+'%">'+esc(/^\d{4}-\d{2}-\d{2}$/.test(lb[i])?lb[i].slice(5):String(lb[i]))+'</span>').join('')+'</div>';const i=h.indexOf('<small>');h=i>=0?h.slice(0,i)+sp+h.slice(i):h+sp}
  return h+'<div class="v6cr" aria-live="polite"></div>'};

HWUI.css('charts',`.v6ch{cursor:crosshair;touch-action:pan-y}.v6ch>div.sel i{outline:2px solid var(--ink);outline-offset:1px;filter:brightness(1.15)}
.v6cr{min-height:1.5em;font-size:13px;font-variant-numeric:tabular-nums;color:var(--ink)}.v6cr b{font-family:var(--fn,inherit)}
.v6sl{position:relative;height:1.4em}.v6sl span{position:absolute;transform:translateX(-50%);white-space:nowrap}.v6sl span:first-child{transform:none}.v6sl span:last-child{transform:translateX(-100%)}
#v6cmp .tbl{min-width:0;table-layout:fixed}#v6cmp th{white-space:normal;overflow-wrap:anywhere;font:700 12px/1.3 var(--fb);vertical-align:bottom}#v6cmp th:first-child{width:27%}#v6cmp th small{display:block;font-weight:400}#v6cmp td{overflow-wrap:anywhere}#v6cmp td small{color:var(--mut);font-size:11px}.v6ce{border:3px dashed var(--p2);padding:14px 10px;text-align:center}.v6ce b{display:block;font:8px/1.7 var(--fh);margin-bottom:4px}.v6ce small{color:var(--mut)}`);

function bars(ch){return [...ch.children].filter(x=>x.tagName==='DIV')}
function sel(ch,i){const B=bars(ch);if(!B.length)return;i=Math.max(0,Math.min(B.length-1,i));B.forEach((b,k)=>b.classList.toggle('sel',k===i));ch.dataset.i=i;
  let V=[],L=[];try{V=JSON.parse(ch.dataset.v);L=JSON.parse(ch.dataset.l)}catch(e){}const out=ch.parentNode&&[...ch.parentNode.children].slice([...ch.parentNode.children].indexOf(ch)).find(x=>x.classList&&x.classList.contains('v6cr'));
  if(out)out.innerHTML=esc(fmtD(L[i]))+': <b>'+(V[i]==null||V[i]===0?'nothing logged':num(V[i])+' '+esc(ch.dataset.u))+'</b>'}
const at=(e)=>{const b=e.target.closest&&e.target.closest('.v6ch > div');if(!b)return null;const ch=b.parentNode;return{ch,i:bars(ch).indexOf(b)}};
document.addEventListener('pointerdown',e=>{const x=at(e);if(x)sel(x.ch,x.i)});
document.addEventListener('pointerover',e=>{if(e.pointerType==='mouse'){const x=at(e);if(x)sel(x.ch,x.i)}});
document.addEventListener('keydown',e=>{const ch=e.target;if(!ch.classList||!ch.classList.contains('v6ch'))return;const n=bars(ch).length,i=ch.dataset.i==null?n-1:+ch.dataset.i;
  if(e.key==='ArrowLeft'){e.preventDefault();sel(ch,ch.dataset.i==null?n-1:i-1)}else if(e.key==='ArrowRight'){e.preventDefault();sel(ch,ch.dataset.i==null?0:i+1)}else if(e.key==='Home'){e.preventDefault();sel(ch,0)}else if(e.key==='End'){e.preventDefault();sel(ch,n-1)}});

/* Statistics: this week vs last week (completed days, neutral arrows) */
function compare(){const d=rng(15).slice(0,14),w1=d.slice(0,7),w0=d.slice(7),M=[['💧 Water',wt,'mL','avg'],['🍗 Calories',kc,'kcal','avg'],['🌙 Sleep',slH,'h','avg'],['🧗 Stair steps',sp,'steps','sum'],['🧠 Stress',str,'/10','avg'],['⚡ Energy',enr,'/5','avg']];
  const val=(w,f,m)=>{const a=w.map(f).filter(x=>x!=null&&x!==0);if(!a.length)return null;return m==='sum'?a.reduce((s,x)=>s+x,0):a.reduce((s,x)=>s+x,0)/a.length};
  const rows=M.map(([n,f,u,m])=>{const a=val(w0,f,m),b=val(w1,f,m);if(a==null&&b==null)return '';const ar=a==null||b==null?'':Math.abs(a-b)<(b||1)*.05?'→ about the same':a>b?'▲ higher':'▼ lower';
    return '<tr><td>'+n+'</td><td>'+(a==null?'–':num(a)+' '+u)+(ar?'<br><small>'+ar+'</small>':'')+'</td><td>'+(b==null?'–':num(b)+' '+u)+'</td></tr>'}).join('');
  return '<div class="card" id="v6cmp"><h3>⚖️ THIS WEEK VS LAST WEEK '+HWHelp.btn('statcmp')+'</h3>'+(rows?'<div class="tscroll"><table class="tbl"><tr><th>METRIC</th><th>LAST 7 DAYS<br><small>today not counted</small></th><th>WEEK BEFORE</th></tr>'+rows+'</table></div>':emp('📭 NOT ENOUGH DATA YET','Log for a week or two to compare periods.'))+'</div>'}
{const p=pages.stats;pages.stats=(...a)=>{const h=p(...a),k='<div class="grid" style="margin:12px 0">',i=h.indexOf(k);if(i<0)return h+compare();const e=h.indexOf('</div><div class="grid">',i);return e>0?h.slice(0,e+6)+compare()+h.slice(e+6):h+compare()}}
return{compare}})();
