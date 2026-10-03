/* v6 safety net (not part of the original): if drawing fails, explain what happened
   instead of leaving a blank screen. Loaded after every page is defined, before boot. */
const snag=(what,e)=>'<div class="card warn"><h3>⚠️ THIS PAGE HIT A SNAG</h3><p>The '+esc(what)+' could not be drawn ('+esc(e&&e.message)+'). Your saved data is untouched.</p><button class="sm" data-a="go" data-v="home">BACK TO THE KINGDOM</button></div>';
// 1) one page fails → keep the header/nav, replace only the page body
Object.keys(pages).forEach(k=>{const f=pages[k];pages[k]=(...a)=>{try{return f(...a)}catch(e){console.error('[HealthWiz] page "'+k+'" failed:',e);return snag(k+' page',e)}}});
// 2) render itself fails (header, banners…) → show the card in #main
{const _render=render;render=function(){try{return _render.apply(this,arguments)}catch(e){console.error('[HealthWiz] render failed:',e);const m=document.querySelector('#main');if(m)m.innerHTML='<div class="pg">'+snag((S&&S.v||'')+' screen',e)+'</div>'}}}
