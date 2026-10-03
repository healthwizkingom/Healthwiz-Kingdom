/* v6: shared UI helpers for the v6 add-ons. Not part of the original.
   index.html (markup + stylesheet) stays byte-identical to the original, so v6 styles are
   injected from here. Uses the original design tokens (--pn, --ln, --gold, --fh …). */
const HWUI=(()=>{
const done=new Set();
function css(id,text){if(done.has(id))return;done.add(id);const s=document.createElement('style');s.dataset.v6=id;s.textContent=text;document.head.appendChild(s)}
const reduced=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
css('ui',`
.v6cel{position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top,0px));z-index:80;transform:translateX(-50%);width:min(340px,92vw);display:flex;gap:10px;align-items:center;background:var(--pn);color:var(--ink);border:4px solid var(--ln);box-shadow:4px 4px 0 var(--ln),0 0 0 3px var(--gold);padding:10px 12px;pointer-events:auto;cursor:pointer;animation:v6in .35s steps(4)}
.v6cel.out{opacity:0;transition:opacity .3s}.v6cel .ic{font-size:30px;line-height:1}.v6cel b{display:block;font:9px/1.6 var(--fh);color:var(--vio)}.v6cel span{display:block;font-size:14px}.v6cel em{font:10px var(--fh);font-style:normal;color:var(--grn)}
.v6cel u{position:absolute;left:30px;top:24px;width:5px;height:5px;background:var(--gold);opacity:0;animation:v6sp .8s ease-out forwards}
@keyframes v6in{from{transform:translate(-50%,-14px);opacity:0}}@keyframes v6sp{0%{opacity:1;transform:translate(0,0)}100%{opacity:0;transform:translate(var(--x),var(--y))}}
@media(prefers-reduced-motion:reduce){.v6cel,.v6cel u{animation:none!important}.v6cel u{display:none}}
.v6q .aq .an small.why{display:block;font-size:11px;color:var(--mut)}.v6q .tagk{display:inline-block;font:7px/1.6 var(--fh);border:2px solid var(--ln);padding:1px 4px;margin-left:4px;background:var(--p2);vertical-align:1px}
`);
// Short, tappable completion banner (§33/§85). Queued so several never stack.
const Q=[];let busy=0;
function celebrate(o){Q.push(o);if(!busy)next()}
function next(){const o=Q.shift();if(!o){busy=0;return}busy=1;const el=document.createElement('div');el.className='v6cel';el.setAttribute('role','status');
el.innerHTML='<div class="ic">'+(o.icon||'⭐')+'</div><div><b>'+esc(o.title||'QUEST COMPLETE!')+'</b><span>'+esc(o.sub||'')+'</span>'+(o.xp?'<em>+'+o.xp+' XP</em>':'')+'</div>'+(reduced()?'':Array.from({length:10},(_,i)=>{const a=i/10*6.283;return '<u style="--x:'+Math.round(Math.cos(a)*60)+'px;--y:'+Math.round(Math.sin(a)*40)+'px;animation-delay:'+(i%3*.06)+'s"></u>'}).join(''));
let gone=0;const close=()=>{if(gone)return;gone=1;el.classList.add('out');setTimeout(()=>{el.remove();next()},300)};el.onclick=close;setTimeout(close,o.ms||2600);document.body.appendChild(el);
if(typeof sfx==='function')[659,784,988].forEach((f,i)=>setTimeout(()=>sfx(f,.09),i*90))}
return{css,celebrate,reduced}})();
