/* v6: button hierarchy and visibility. Not part of the original (index.html stays untouched; styles are injected).
   What the audit found (390 px, every page, light and every dark theme): in the light themes every button already has a clear
   edge and fill. In the dark themes the secondary buttons (quiet chips, nav tabs, BACK, the tiles) had an edge of about
   1.4:1 against their card, so they blended into it. WCAG 1.4.11 asks 3:1 for the edge of a control.
   So, with the existing colours kept:
   · PRIMARY   = the original gold button: unchanged.
   · SECONDARY = quiet (.g, unselected .chip, nav tabs, food items…): unchanged in the light themes; in the dark themes
                 the edge becomes the theme's own muted text colour (--mut, ≥ 4.5:1 on the card), the fill stays.
   · SELECTED  = gold (.chip.on, nav .on): unchanged.
   · DISABLED  = flat, dashed edge, muted text, no shadow, so it no longer looks like a faded secondary button.
   · HOVER (mouse only) = a gold ring inside a secondary button; PRESSED and FOCUS keep their own looks; focus is a blue ring
                 (3px, outside) that no button colour uses.
   Plus two jump buttons that tell people what to do next on the two longest pages: LOG A MEAL (Nutrition) and LOG LAST
   NIGHT'S SLEEP (Sleep). They scroll to the form; nothing else changes. */
const HWButtons=(()=>{
const SEC='button.g,button.chip:not(.on),nav button:not(.on),button.nst:not(.on),button.it:not(.on),button.v6sw,.ts>button';
const dark=sel=>':root[data-theme="dark"] '+sel.split(',').join(',:root[data-theme="dark"] ');
const auto=sel=>':root:not([data-theme="light"]) '+sel.split(',').join(',:root:not([data-theme="light"]) ');
HWUI.css('buttons',`
@media(prefers-color-scheme:dark){${auto(SEC)}{border-color:var(--mut)}}
${dark(SEC)}{border-color:var(--mut)}
button:disabled,button[aria-disabled="true"]{background:var(--p2);color:var(--mut);border-style:dashed;box-shadow:none;filter:none;opacity:.8}
@media(hover:hover){button.g:hover:not(:disabled),button.chip:not(.on):hover:not(:disabled),button.it:not(.on):hover:not(:disabled){outline:2px solid var(--gold);outline-offset:-5px}}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:3px solid #1f5fa8;outline-offset:2px}
:root[data-theme="dark"] :focus-visible{outline-color:#8fc7ff}
@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) :focus-visible{outline-color:#8fc7ff}}
.hwjump{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin:0 0 14px}
`);
function jump(h,before,id,label){const i=h.indexOf(before);if(i<0)return h;
  return h.slice(0,i)+'<button type="button" class="hwjump" data-a="hwjump" data-t="'+id+'">'+label+' ↓</button>'+h.slice(i)}
acts.hwjump=d=>{const el=document.getElementById(d.t),c=el&&(el.closest('.card')||el);if(!c)return;
  c.scrollIntoView({block:'start',behavior:HWUI.reduced()?'auto':'smooth'});
  const f=c.querySelector('input,select,button:not(.hwwb)');if(f)try{f.focus({preventScroll:true})}catch(e){}};
{const p=pages.sleep;pages.sleep=function(){return jump(p.apply(this,arguments),'<div class="card" id="dbatc">','slb','🛏️ LOG LAST NIGHT\'S SLEEP')}}
{const p=pages.food;pages.food=function(){return jump(p.apply(this,arguments),'<div class="nsg">','fpick','🍽️ LOG A MEAL')}}
return{SEC}})();
