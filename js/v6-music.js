/* v6: the default background music is a recorded theme (assets/audio/home-theme.mp3, looped). The original generated
   WebAudio melodies stay, but only for the scenes that have their own track: Sleep, Water, Stress, the Wizard's Counsel
   chat and the Traveller's Registry (TRK in js/hw-05-v5-4-module.js). Everything else that used the 'home' tune (the title
   screen, Home and every other page) now plays the recording.
   It plays through the same switch and volume as before: the music button (acts.mus, MT) and Settings → Sound (MV()).
   The file is fetched and decoded with WebAudio, so the service worker caches one whole response (no range requests)
   and the volume follows the slider. If the file cannot load (the standalone single-file build, or offline before it was
   cached once) the original home tune plays instead. Nothing here changes saved data. */
const HWMusic=(()=>{
const SRC='assets/audio/home-theme.mp3',FADE=.8;
let buf=null,bad=0,loading=0,src=null,gain=null,wd=0;
const desired=()=>!!MT&&MK==='home'&&!bad;
function load(){if(buf||bad||loading)return;
  if(/^file:/.test(location.protocol)){bad=1;if(MT&&MK==='home')musTick();return}   // opened from disk the browser refuses fetch(): go straight to the built-in tune, without a console error
  loading=1;
  fetch(SRC).then(r=>{if(!r.ok)throw 0;return r.arrayBuffer()}).then(a=>new Promise((ok,no)=>{ac=ac||new(window.AudioContext||window.webkitAudioContext)();ac.decodeAudioData(a,ok,no)}))
    .then(b=>{buf=b;loading=0;sync()}).catch(()=>{bad=1;loading=0;if(MT&&MK==='home')musTick()})}
function start(){if(src||!buf)return;try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();
  gain=ac.createGain();gain.gain.value=0;src=ac.createBufferSource();src.buffer=buf;src.loop=true;src.connect(gain);gain.connect(ac.destination);src.start(0);
  gain.gain.linearRampToValueAtTime(vol(),ac.currentTime+FADE)}catch(e){src=gain=null}}
function stop(){if(!src)return;const s=src,g=gain;src=gain=null;try{g.gain.cancelScheduledValues(ac.currentTime);g.gain.setValueAtTime(g.gain.value,ac.currentTime);g.gain.linearRampToValueAtTime(0,ac.currentTime+.3);s.stop(ac.currentTime+.35)}catch(e){try{s.stop()}catch(e2){}}}
const vol=()=>Math.min(1,MV()/3*.9);
// a 400 ms check (volume slider, music button, page changes) runs only while the recording is wanted or still fading out,
// so an idle page keeps no timer alive (tests/24-performance)
function sync(){if(desired()){if(!buf)load();else if(!src)start();else try{gain.gain.setTargetAtTime(vol(),ac.currentTime,.1)}catch(e){}}else stop();
  if(desired()||src){if(!wd)wd=setInterval(sync,400)}else if(wd){clearInterval(wd);wd=0}}
// the 'home' track's own tick: only the fallback tune, and only when the recording cannot be used
TRK.home[1]=()=>{if(bad){musTick();return}try{ac=ac||new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume()}catch(e){}   // made inside the button tap, so phones allow it
  if(!buf)load();sync()};
/* Music starts by itself when the app opens, unless the user has turned sound off (Settings → Sound, st.s.sound = 0) or has switched the
   music button off themselves (st.s.musOff = 1, saved when they tap it; the alarm and other code that stops the music do not set it).
   Browsers only let sound play after the person has touched the page, so the music is set up at once and the audio context is resumed on
   the first tap, key press or click; where the browser already allows sound (an installed app, a returning visitor) it is heard straight away. */
{const orig=acts.mus,orig2=acts.mus2,remember=()=>{const off=MT?0:1;if(!!st.s.musOff!==!!off){st.s.musOff=off;save()}};
  acts.mus=function(d,t,e){const r=orig.apply(this,arguments);if(e&&e.isTrusted)remember();return r};
  acts.mus2=function(d,t,e){const r=orig2.apply(this,arguments);if(e&&e.isTrusted)remember();return r}}
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
return{state:()=>({playing:!!src,loaded:!!buf,failed:!!bad}),src:SRC,auto}})();
