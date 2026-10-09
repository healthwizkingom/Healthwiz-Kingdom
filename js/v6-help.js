/* v6: contextual help ("?") buttons. Not part of the original.
   Long explanations (disclaimers, estimation notes, method details) live behind a small "?" button next to the thing
   they explain, so pages stay compact. Nothing is hover-only: the button is a real <button>, so a tap, a click, and
   Enter / Space all open a small panel; Escape, the CLOSE button, a tap outside or opening another "?" closes it.
   Keyboard and screen readers: the panel is a labelled dialog, focus moves into it and Tab stays inside (CLOSE and any
   link in the text), and on close focus goes back to the button. aria-expanded on the button tells the state.

     HWHelp.btn(key, title, html)   // HTML for the button; the text is kept under `key` until the button is used
     HWHelp.btn(key)                // same, for text registered once with HWHelp.reg(key, title, html)
     HWHelp.reg(key, title, html)   // register text (html is trusted markup: escape anything user-typed with esc())
     HWHelp.open(key|button) · close() · isOpen()

   Texts are plain strings built at render time, so a page that re-renders just registers them again; an open panel
   follows its button across re-renders and closes if the button is gone (page change). */
const HWHelp=(()=>{
const T={},esc2=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let pop=null,cur=null,trig=null,returnTo=null;
function reg(key,title,html){T[key]={t:title,h:html};return key}
/** The button. `label` is spoken as "About <title>"; the visible glyph is "?" (or `o.text` for a labelled variant). */
function btn(key,title,html,o){if(typeof html==='string')reg(key,title,html);
  const t=(T[key]||{}).t||'this',txt=o&&o.text;
  return '<button type="button" class="hwh'+(txt?' hwhl':'')+'" data-hwh="'+esc2(key)+'" aria-haspopup="dialog" aria-expanded="false" aria-label="'+esc2((o&&o.label)||('About: '+t))+'">'+(txt?esc2(txt):'?')+'</button>'}
function build(){if(pop)return pop;pop=document.createElement('div');pop.id='hwh-pop';pop.className='hwhp';pop.setAttribute('role','dialog');pop.tabIndex=-1;pop.hidden=true;
  pop.innerHTML='<b class="hwht" id="hwh-t"></b><div class="hwhb" id="hwh-b"></div><button type="button" class="hwhx g sm">CLOSE</button>';
  pop.setAttribute('aria-labelledby','hwh-t');pop.setAttribute('aria-describedby','hwh-b');document.body.appendChild(pop);return pop}
function place(){if(!pop||pop.hidden||!trig)return;
  const r=trig.getBoundingClientRect(),vw=document.documentElement.clientWidth||innerWidth,vh=innerHeight,w=Math.min(340,vw-16);
  pop.style.width=w+'px';const h=pop.offsetHeight;
  let x=Math.round(r.left+r.width/2-w/2);x=Math.max(8,Math.min(x,vw-w-8));
  const nav=vw<=760?64:0,room=vh-nav-8;let y=Math.round(r.bottom+8);
  if(y+h>room){const up=Math.round(r.top-8-h);y=up>=8?up:Math.max(8,room-h)}
  pop.style.left=x+'px';pop.style.top=y+'px'}
function find(key){return document.querySelector('.hwh[data-hwh="'+(window.CSS&&CSS.escape?CSS.escape(key):key)+'"]')}
function mark(b,on){document.querySelectorAll('.hwh[aria-expanded="true"]').forEach(x=>{if(x!==b)x.setAttribute('aria-expanded','false')});if(b)b.setAttribute('aria-expanded',on?'true':'false')}
function open(k){const b=typeof k==='string'?find(k):k;if(!b)return;const key=b.dataset.hwh,t=T[key];if(!t)return;
  build();
  if(cur===key&&trig===b&&!pop.hidden){close(true);return}
  trig=b;cur=key;returnTo=b;pop.querySelector('#hwh-t').textContent=t.t;pop.querySelector('#hwh-b').innerHTML=t.h;
  pop.hidden=false;mark(b,true);pop.style.visibility='hidden';place();pop.style.visibility='';
  // The panel is a place to read: move focus into it so keyboard and screen-reader users land on the text.
  try{pop.focus({preventScroll:true})}catch(e){pop.focus()}}
function close(refocus){if(!pop||pop.hidden)return;const b=trig&&trig.isConnected?trig:(cur&&find(cur));pop.hidden=true;mark(null,false);if(b)b.setAttribute('aria-expanded','false');
  const had=pop.contains(document.activeElement)||document.activeElement===document.body;cur=null;trig=null;
  if(b&&(refocus||had))try{b.focus({preventScroll:true})}catch(e){b.focus()}}
// A re-render replaces the button: follow it by key, or close when it is gone.
function sync(){if(!pop||pop.hidden)return;if(!trig||!trig.isConnected){const b=cur&&find(cur);if(!b){pop.hidden=true;mark(null,false);cur=null;trig=null;return}trig=b;b.setAttribute('aria-expanded','true')}place()}

document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.hwh');
  if(b){e.preventDefault();e.stopPropagation();open(b);return}
  if(!pop||pop.hidden)return;
  if(e.target.closest('.hwhx')){close(true);return}
  if(!pop.contains(e.target))close(false)},true);
document.addEventListener('keydown',e=>{if(!pop||pop.hidden)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);return}
  if(e.key==='Tab'){const f=[...pop.querySelectorAll('a[href],button')].filter(x=>!x.disabled);if(!f.length)return;
    const i=f.indexOf(document.activeElement);
    if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&(i<0||i===f.length-1)){e.preventDefault();f[0].focus()}}},true);
addEventListener('resize',()=>place());
addEventListener('scroll',()=>{if(pop&&!pop.hidden)requestAnimationFrame(sync)},{passive:true,capture:true});
// pages that re-render keep the panel on its button; leaving a page closes it
if(typeof render==='function'){const _r=render;render=function(){const r=_r.apply(this,arguments);try{sync()}catch(e){}return r}}
if(typeof HWEvents!=='undefined')HWEvents.on('page:viewed',()=>close(false));

/* ---------- the texts (moved here from inline notes; wording unchanged unless a short visible line replaced it) ---------- */
reg('nutintro','Nutrition & calories','<p>Log your meals to see calories and nutrients, today and over the week.</p>');
reg('nutest','Estimated nutrient values (EST)','<p><b>EST</b> means estimated. Macro values for menu foods are estimated from typical dish composition. Custom foods use the numbers you entered.</p>');
reg('sleepgame','Sleep visuals are a game','<p>Game visuals made from the sleep you logged. They are not a medical measurement.</p>');
reg('sleepscore','HealthWiz Sleep Score','<p>HealthWiz Sleep Score is a game score from your logged sleep. It is <b>NOT</b> a medical measurement.</p>');
reg('alarmwhy','Why the alarm can miss','<p>A web page cannot ring reliably when the browser is closed, the tab is in the background or the phone is locked, especially on iPhone.</p><p>For a sure alarm, also set your phone\'s Clock app.</p>');
reg('hrpic','Heart-rate picture','<p>A heart-rate picture, <b>not an ECG</b>.</p>');
reg('runboard','Runners\' Board: what is shown','<p>Nickname + weekly running totals only. Distance and pace come from GPS and are estimates.</p><p>What is shared is listed before you join. Leaving deletes your nickname and all your weekly totals from the server; your runs stay on this device.</p>');
reg('medpriv','Privacy and AI limits','<p><b>Medius is an AI listener, not a therapist or crisis service.</b> Your words are not saved.</p><p>Messages are processed by Google Gemini to generate Medius\'s replies and are not saved by HealthWiz.</p><p>In danger? Use the numbers on this card.</p>');
reg('bmigame','Your game form','<p>Your game form follows your BMI range. It is just for fun, not a health judgement.</p>');
reg('streakrest','Rest days and your gentle streak','<p>One rest day a week keeps your gentle streak going. Rest days are part of the journey — nothing is lost.</p>');
reg('questpick','How quests are chosen','<p>The focus quest is picked from your own logs each day; weekly quests reset on Monday. All targets stay within your own plan.</p>');
reg('statcmp','About this comparison','<p><b>Completed days only</b> (today is still in progress). Averages use days with data; stair steps are totals. Changes are descriptions, not judgments.</p>');
reg('scorenote','About the Health Score','<p>A habit score from what you logged, <b>not a diagnosis</b>.</p>');
reg('scorewt','About these weights','<p>These weights are the team\'s reasoned judgement from the sources above, not a validated clinical formula.</p><p class="mut"><small>For developers: edit WT in js/v6-score.js to change them.</small></p>');
reg('fvinfo','Fruit & vegetables','<p>1 portion = 80 g (dried fruit 30 g). Counted automatically from the fruit and vegetable dishes in your nutrition log.</p>');

HWUI.css('help',`
.hwh{position:relative;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;box-sizing:border-box;min-width:26px;width:26px;min-height:26px;height:26px;padding:0;margin:0 0 0 6px;font:bold 11px/1 var(--fh);color:#fff;background:#1f6fb0;border:2px solid var(--ln);box-shadow:inset -2px -2px 0 rgba(0,0,0,.2),2px 2px 0 var(--ln);border-radius:0;-webkit-font-smoothing:none;text-transform:none;letter-spacing:0}
.hwh:after{content:"";position:absolute;inset:-10px}
.hwh:active{transform:translate(1px,1px);box-shadow:inset -2px -2px 0 rgba(0,0,0,.2),1px 1px 0 var(--ln)}
.hwh[aria-expanded="true"]{background:var(--gold);color:#2b2418}
:root[data-theme="dark"] .hwh{border-color:#9fc4e8}@media(prefers-color-scheme:dark){:root:not([data-theme="light"]) .hwh{border-color:#9fc4e8}}
.hwh:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.hwh.hwhl{width:auto;padding:0 8px;font-size:8px;white-space:nowrap}
h3 .hwh,h2 .hwh{margin-left:8px}
.hwhp{position:fixed;z-index:130;box-sizing:border-box;max-width:calc(100vw - 16px);max-height:min(70vh,420px);overflow:auto;overscroll-behavior:contain;padding:12px;font:13px/1.55 var(--fb);color:var(--ink);background:var(--pn);border:4px solid var(--ln);box-shadow:inset -4px -4px 0 rgba(0,0,0,.18),4px 4px 0 var(--ln),0 0 0 3px var(--gold);text-align:left;text-transform:none;letter-spacing:0}
.hwhp[hidden]{display:none}
.hwhp:focus{outline:none}.hwhp:focus-visible{outline:3px solid var(--blue)}
.hwht{display:block;margin:0 0 6px;font:9px/1.6 var(--fh);color:var(--vio)}
.hwhb p{margin:0 0 8px}.hwhb p:last-child{margin-bottom:0}.hwhb a{color:var(--blue);font-weight:bold}
.hwhx{display:block;margin:10px 0 0;min-height:36px}
.hwhs{display:inline-flex;align-items:center;flex-wrap:wrap;gap:2px 0}
`);
return{reg,btn,open,close,sync,isOpen:()=>!!pop&&!pop.hidden,esc:esc2}})();
