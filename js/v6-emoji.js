/* v6 (visual redesign): every emoji the app shows is drawn as pixel art. Not part of the original.
   The app writes about 750 emoji (200+ different ones) into its pages, toasts, dialogs, Medius and the mini-games.
   Rather than editing each string, this watches the page and swaps every emoji for a crisp 16×16 pixel picture of
   the same thing, in the HealthWiz icon style (one palette, a 1-pixel ink outline, see docs/PIXEL_STYLE.md):
   * a hand-drawn icon from js/v6-pixel.js when one shows the same object (💧 ❤️ 🍗 🏆 ⚠️ …, see SAME);
   * otherwise the emoji itself, pixelated once on a canvas: drawn large, sampled down to a 14×14 grid (each cell the
     average colour of its block, kept only if mostly covered), snapped to the icon palette and outlined.
   The emoji character stays in the page, inside the picture and invisible, so screen readers read it as before, and
   textContent, the tutorial's text search and the add-ons' string anchors are unchanged.
   Pictures are sized to the text around them, in steps of 8 px (at least 16 px), so the pixels stay even.
   Not converted: form fields and <option> text (they cannot hold pictures), SVG, and typographic symbols that are
   drawn as text (✓ ✕ ▶ ◀ ★ ✿). If a device cannot draw an emoji (no glyph), it is left as it is. */
const HWEmoji=(()=>{
// an emoji: one that is drawn as a picture by default, or any emoji symbol asked to be one (U+FE0F), with skin tones,
// keycaps and ZWJ joins. Built at run time: an engine without \p{…} escapes simply keeps its emoji.
const SRC='(?:\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F)(?:\\p{Emoji_Modifier}|\\uFE0F|\\u20E3)*(?:\\u200D(?:\\p{Emoji_Presentation}|\\p{Emoji})(?:\\p{Emoji_Modifier}|\\uFE0F)*)*';
let RE=null,RE1=null;try{RE=new RegExp(SRC,'gu');RE1=new RegExp(SRC,'u')}catch(e){}
const has=s=>!!RE1&&RE1.test(s); // RE (global) is only used by swap()'s exec loop
// emoji whose hand-drawn icon shows the same object (keys without U+FE0F)
const SAME={'❤':'heart','💧':'water','🍗':'food','🌙':'sleep','🏃':'running','🌩':'stress','⚡':'energy','🏆':'achievement',
  '⚠':'warning','✅':'success','🧙':'wizard','🧙‍♂':'wizard','⚖':'balance','📊':'chart','📜':'scroll','⚙':'gear','⚔':'quest',
  '🗺':'map','🔔':'bell'};
// the icon palette, plus a few hues emoji need (pink, magenta, teal)
const PAL=Object.assign({},HWPixel.PAL,{P:'#f4a3c4',M:'#c4508e',T:'#36a89a',D:'#1d6b62'});
const RGB=Object.keys(PAL).filter(k=>k!=='k').map(k=>[parseInt(PAL[k].slice(1,3),16),parseInt(PAL[k].slice(3,5),16),parseInt(PAL[k].slice(5,7),16)]);
const near=(r,g,b)=>{let best=RGB[0],bd=1e12;for(const c of RGB){const m=(r+c[0])/2,dr=r-c[0],dg=g-c[1],db=b-c[2],d=(2+m/256)*dr*dr+4*dg*dg+(2+(255-m)/256)*db*db;if(d<bd){bd=d;best=c}}return best};
const FONT='"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif';
const N=14,K=8,SZ=N*K,cache=new Map();
let sheet=null,nid=0;

// 14×14 colour grid → 16×16 PNG with the ink outline
function png(grid){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d'),on=(i,j)=>i>=0&&j>=0&&i<N&&j<N&&grid[j*N+i];
  for(let j=-1;j<=N;j++)for(let i=-1;i<=N;i++){const v=on(i,j);if(v){x.fillStyle=v;x.fillRect(i+1,j+1,1,1)}
    else if(on(i-1,j)||on(i+1,j)||on(i,j-1)||on(i,j+1)){x.fillStyle=PAL.k;x.fillRect(i+1,j+1,1,1)}}
  return c.toDataURL()}
function drawn(name){const g=HWPixel.grid(name),c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');
  g.forEach((r,j)=>{for(let i=0;i<16;i++)if(r[i]!=='.'){x.fillStyle=PAL[r[i]];x.fillRect(i,j,1,1)}});return c.toDataURL()}
function pixelate(e){const c=document.createElement('canvas');c.width=c.height=SZ*2;const x=c.getContext('2d');
  x.textAlign='center';x.textBaseline='alphabetic';x.font=SZ+'px '+FONT;
  let m=x.measureText(e);const w=(m.actualBoundingBoxLeft||0)+(m.actualBoundingBoxRight||0),h=(m.actualBoundingBoxAscent||0)+(m.actualBoundingBoxDescent||0);
  if(!(w>0&&h>0))return null;
  x.font=SZ*Math.min(SZ/w,SZ/h)+'px '+FONT;m=x.measureText(e);
  x.fillText(e,SZ+(m.actualBoundingBoxLeft-m.actualBoundingBoxRight)/2,SZ+(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2);
  const d=x.getImageData(SZ/2,SZ/2,SZ,SZ).data,grid=[];let any=0;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){let a=0,r=0,g=0,b=0;
    for(let y=0;y<K;y++)for(let z=0;z<K;z++){const p=((j*K+y)*SZ+i*K+z)*4,al=d[p+3]/255;a+=al;r+=d[p]*al;g+=d[p+1]*al;b+=d[p+2]*al}
    if(a/(K*K)>=.45){const q=near(r/a,g/a,b/a);grid.push('rgb('+q.join(',')+')');any=1}else grid.push(null)}
  return any?png(grid):null}
/** The pixel picture for an emoji (a data: URL), or null if it is not an emoji or the device cannot draw it. */
function src(e){e=String(e);if(cache.has(e))return cache.get(e);let u=null;
  if(has(e)){const k=e.replace(/️/g,'');try{u=SAME[k]?drawn(SAME[k]):pixelate(e)}catch(err){u=null}}
  cache.set(e,u);return u}
// one CSS class per picture, so the page holds a short class name instead of the image data
const cls=new Map();
function klass(e){if(cls.has(e))return cls.get(e);const u=src(e);let k=null;
  if(u){if(!sheet){const s=document.createElement('style');s.dataset.v6='emoji';document.head.appendChild(s);sheet=s.sheet}
    k='pxe'+(nid++);sheet.insertRule('.'+k+'{background-image:url('+u+')}',sheet.cssRules.length)}
  cls.set(e,k);return k}

const SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,OPTION:1,SELECT:1,TITLE:1,NOSCRIPT:1,INPUT:1};
const skip=el=>!el||SKIP[el.tagName]||el.namespaceURI==='http://www.w3.org/2000/svg'||(el.classList&&el.classList.contains('pxe'));
function size(el){const f=parseFloat(getComputedStyle(el).fontSize)||15;return Math.max(16,Math.round(f*1.2/8)*8)}
function swap(t){const p=t.parentNode,e=t.parentElement;if(!p||!e||skip(e)||e.closest('.pxe'))return;const s=t.nodeValue;if(!has(s))return;
  const f=document.createDocumentFragment(),px=size(e);let last=0;RE.lastIndex=0;
  for(let m;(m=RE.exec(s));){const k=klass(m[0]);if(!k)continue;
    if(m.index>last)f.appendChild(document.createTextNode(s.slice(last,m.index)));
    const b=document.createElement('span');b.className='pxe '+k;b.style.width=b.style.height=px+'px';
    const i=document.createElement('span');i.textContent=m[0];b.appendChild(i);f.appendChild(b);last=m.index+m[0].length}
  RE.lastIndex=0;if(!last)return;if(last<s.length)f.appendChild(document.createTextNode(s.slice(last)));p.replaceChild(f,t)}
function walk(root){if(!root)return;if(root.nodeType===3){swap(root);return}if(root.nodeType!==1&&root.nodeType!==11)return;if(root.nodeType===1&&skip(root))return;
  const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,{acceptNode:n=>n.nodeType===1?(skip(n)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_SKIP):has(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP}),L=[];
  for(let n;(n=w.nextNode());)L.push(n);L.forEach(swap)}

HWUI.css('emoji',`
.pxe{display:inline-block;vertical-align:-.22em;overflow:hidden;line-height:1;background:center/100% 100% no-repeat;image-rendering:pixelated;flex:0 0 auto}
.pxe>span{opacity:0}
`);
// convert what is on the page now, then everything that is added or changed later (renders, toasts, dialogs, games)
if(RE){walk(document.body);
if(typeof MutationObserver==='function')new MutationObserver(rs=>{for(const r of rs){if(r.type==='characterData')swap(r.target);else r.addedNodes.forEach(walk)}})
  .observe(document.body,{childList:true,subtree:true,characterData:true})}
return{src,convert:walk,test:has}})();
