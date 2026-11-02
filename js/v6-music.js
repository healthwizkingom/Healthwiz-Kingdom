/* v6: the default background music is a recorded theme (assets/audio/home-theme.mp3, looped). The original generated
   WebAudio melodies stay, but only for the scenes that have their own track: Sleep, Water, Stress, the Wizard's Counsel
   chat and the Traveller's Registry (TRK in js/hw-05-v5-4-module.js). Everything else that used the 'home' tune (the title
   screen, Home and every other page) now plays the recording.
   The music button also swaps to a second recording, assets/audio/first-light-on-the-lawn.mp3 (see the cycle below).
   It plays through the same switch and volume as before: the music button (acts.mus, MT) and Settings → Sound (MV()).
   The file is fetched and decoded with WebAudio, so the service worker caches one whole response (no range requests)
   and the volume follows the slider. If the file cannot load (the standalone single-file build, or offline before it was
   cached once) the original home tune plays instead. Nothing here changes saved data. */
const HWMusic=(()=>{
const SRCS=['assets/audio/home-theme.mp3','assets/audio/first-light-on-the-lawn.mp3'],SRC=SRCS[0],FADE=.8;
// sel = which recording the music button has chosen (0 = the home theme, 1 = First Light on the Lawn); buf holds only the chosen one (bufOf says which)
let buf=null,bufOf=-1,sel=0,bad=0,loading=0,src=null,gain=null,wd=0;
const desired=()=>!!MT&&MK==='home'&&!bad;
function load(){if((buf&&bufOf===sel)||bad||loading)return;
  if(/^file:/.test(location.protocol)){bad=1;if(MT&&MK==='home')musTick();return}   // opened from disk the browser refuses fetch(): go straight to the built-in tune, without a console error
  loading=1;const my=sel;
  fetch(SRCS[my]).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(a=>new Promise((ok,no)=>{ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.decodeAudioData(a,ok,no)}))
    .then(b=>{buf=b;bufOf=my;loading=0;sync()}).catch(()=>{loading=0;if(my){sel=0;sync();return}bad=1;if(MT&&MK==='home')musTick()})}   // the second song missing: back to the home theme
function start(){if(src||!buf||bufOf!==sel)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();
  gain=ac.createGain();gain.gain.value=0;src=ac.createBufferSource();src.buffer=buf;src.loop=true;src.connect(gain);gain.connect(ac.destination);src.start(0);
  gain.gain.linearRampToValueAtTime(vol(),ac.currentTime+FADE)}catch(e){src=gain=null}}
function stop(){if(!src)return;const s=src,g=gain;src=gain=null;try{g.gain.cancelScheduledValues(ac.currentTime);g.gain.setValueAtTime(g.gain.value,ac.currentTime);g.gain.linearRampToValueAtTime(0,ac.currentTime+.3);s.stop(ac.currentTime+.35)}catch(e){try{s.stop()}catch(e2){}}}
const vol=()=>Math.min(1,MV()/3*.9);
// a 400 ms check (volume slider, music button, page changes) runs only while the recording is wanted or still fading out,
// so an idle page keeps no timer alive (tests/24-performance)
function sync(){if(desired()){if(!buf||bufOf!==sel)load();else if(!src)start();else try{gain.gain.setTargetAtTime(vol(),ac.currentTime,.1)}catch(e){}}else stop();
  if(desired()||src){if(!wd)wd=setInterval(sync,400)}else if(wd){clearInterval(wd);wd=0}}
// the 'home' track's own tick: only the fallback tune, and only when the recording cannot be used
TRK.home[1]=()=>{if(bad){musTick();return}try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch(e){}   // made inside the button tap, so phones allow it
  if(!buf||bufOf!==sel)load();sync()};
/* Music starts by itself when the app opens, unless the user has turned sound off (Settings → Sound, st.s.sound = 0) or has switched the
   music button off themselves (st.s.musOff = 1, saved when they tap it; the alarm and other code that stops the music do not set it).
   Browsers only let sound play after the person has touched the page, so the music is set up at once and the audio context is resumed on
   the first tap, key press or click; where the browser already allows sound (an installed app, a returning visitor) it is heard straight away. */
{const orig=acts.mus,orig2=acts.mus2,remember=()=>{const off=MT?0:1;if(!!st.s.musOff!==!!off){st.s.musOff=off;save()}};
  acts.mus=function(d,t,e){const r=orig.apply(this,arguments);if(e&&e.isTrusted)remember();return r};
  acts.mus2=function(d,t,e){const r=orig2.apply(this,arguments);if(e&&e.isTrusted)remember();return r}}
/* The music button cycles: tap 1 swaps the home theme for First Light on the Lawn, tap 2 mutes, tap 3 starts the first song (the home theme) again.
   Only a person's tap swaps (e.isTrusted); the alarm and other code that call acts.mus() without an event still just stop or start the music.
   Scene tracks (Sleep, Water, Stress...) keep the plain on/off behaviour. */
{const pick=n=>{sel=n;buf=null;bufOf=-1;stop();sync()},
  press=e=>{if(e&&e.isTrusted&&MT&&MK==='home'&&!bad&&sel===0){pick(1);try{toast('Now playing: First Light on the Lawn')}catch(x){}return true}if(sel)pick(0);return false},
  m1=acts.mus,m2=acts.mus2;
  acts.mus=function(d,t,e){if(press(e))return;return m1.apply(this,arguments)};
  acts.mus2=function(d,t,e){if(press(e)){render();return}return m2.apply(this,arguments)}}
function auto(){
  if(!st.s.sound||st.s.musOff||MT)return;
  try{acts.mus()}catch(e){return}
  const evs=['pointerdown','touchend','keydown','click'],kick=ev=>{
    if(ev&&ev.isTrusted===false)return;
    evs.forEach(n=>removeEventListener(n,kick,true));
    try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch(e){}
    sync()};
  evs.forEach(n=>addEventListener(n,kick,true))}
HWEvents.on('app:ready',auto);
return{state:()=>({playing:!!src,loaded:!!buf,failed:!!bad,track:sel}),src:SRC,srcs:SRCS,auto}})();
