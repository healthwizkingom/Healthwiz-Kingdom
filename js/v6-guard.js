/* v6: Link guard (not part of the original). Two small protections that apply to every page, present and future:
   * Links that leave the app (another site) always carry rel="noopener noreferrer", so the other site cannot reach this
     page through window.opener and is not told which page the visitor came from. Added to links already on the page and to
     every link drawn later.
   * A link or form that would run code or load a page of its own (javascript:, vbscript:, data:text/html) is stopped
     before it acts, whatever drew it. Downloads (blob:), the alarm's Android intent, mailto:, tel: and normal web links are
     left alone.
   Nothing is stored and nothing is sent. */
const HWGuard=(()=>{
const D0=document,BAD=/^\s*(javascript|vbscript|data:text\/html)/i;
const ext=a=>{try{const u=new URL(a.getAttribute('href'),location.href);return /^https?:$/.test(u.protocol)&&u.origin!==location.origin}catch(e){return false}};
const bad=h=>typeof h==='string'&&BAD.test(h.replace(/[\u0000- ]+/g,''));
function fix(a){if(!a||a.tagName!=='A'||!a.hasAttribute('href'))return;
  if(bad(a.getAttribute('href'))){a.removeAttribute('href');return}
  if(ext(a)){const r=new Set((a.getAttribute('rel')||'').split(/\s+/).filter(Boolean));r.add('noopener');r.add('noreferrer');a.setAttribute('rel',Array.from(r).join(' '))}}
const scan=n=>{if(!n||n.nodeType!==1)return;fix(n);if(n.querySelectorAll)n.querySelectorAll('a[href]').forEach(fix)};
let seen=0;
try{new MutationObserver(ms=>{for(const m of ms){if(m.type==='attributes')fix(m.target);else m.addedNodes.forEach(scan)}})
  .observe(D0.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href']})}catch(e){}
scan(D0.documentElement);
D0.addEventListener('click',e=>{const a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(a&&bad(a.getAttribute('href'))){e.preventDefault();e.stopImmediatePropagation();seen++}},true);
D0.addEventListener('submit',e=>{const f=e.target;if(f&&f.getAttribute&&bad(f.getAttribute('action'))){e.preventDefault();e.stopImmediatePropagation();seen++}},true);
return{fix:scan,safe:h=>!bad(h),blocked:()=>seen}})();
