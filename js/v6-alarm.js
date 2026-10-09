/* v6: wake-up alarm on the Sleep page (card #v6alm). Not part of the original.
   Honest by design: a web page cannot ring reliably when the browser is closed, the tab is in the background or the
   phone is locked (iPhone Safari stops it almost at once). So there are three layers, and the card says so:
     1. IN-APP ALARM while HealthWiz is open: time, repeat days, original WebAudio sounds (chimes / birds / castle bell,
        played through tn() at the music volume) with a fade-in, SNOOZE 5 / 10 min and STOP, a dim BEDSIDE CLOCK that
        keeps the screen on (Screen Wake Lock, where supported), and the sleeping hero waking up (the ringing screen
        and the Counting Sheep dream scene). No sound before the user's first tap (browser autoplay rules): until then
        the ringing screen asks for a tap.
     2. ANDROID: SET IN CLOCK APP opens the phone's Clock with the time filled in (intent URL,
        android.intent.action.SET_ALARM with the HOUR and MINUTES extras). If nothing opens, it says what to do instead.
     3. iPHONE: steps for the Clock app. ALL DEVICES: a calendar reminder (.ics) to download.
   Suggested wake time = bedtime + the low end of the sleep goal (st.g.sleep, else SR(age)) + 15 min to fall asleep.
   Saved in st.s.alarm = {on (0/1), t 'HH:MM', days [0–6, Sunday = 0; empty = once], snd 'chimes'|'birds'|'bell',
   fade (0/1), snz (ms of a snooze, or null), fired 'YYYY-MM-DD HH:MM' (the last slot that rang)}. A new field only:
   older saves simply have no alarm. */
const HWAlarm=(()=>{
const D=document,N=navigator,isO=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const DEF={on:0,t:'06:30',days:[1,2,3,4,5],snd:'chimes',fade:1,snz:null,fired:''};
const SND={chimes:'Chimes',birds:'Birds',bell:'Castle bell'};
const DAY=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const LATE=10*60e3,MISS=3*3600e3,RINGMAX=10*60e3,FALL=15;
const ico=(n,s,l)=>HWPixel.icon(n,l?{s:s||1,label:l}:s||1);
const btn=(a,t,cls,x)=>'<button class="'+(cls||'')+'" data-a="'+a+'"'+(x||'')+'>'+t+'</button>';
const okT=t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(String(t));
/** The saved alarm with defaults filled in (never written until the user changes something). */
function cfg(){const a=isO(st.s.alarm)?st.s.alarm:{};return{on:a.on?1:0,t:okT(a.t)?a.t:DEF.t,days:Array.isArray(a.days)?a.days.filter(d=>Number.isInteger(d)&&d>=0&&d<=6):DEF.days.slice(),
  snd:SND[a.snd]?a.snd:DEF.snd,fade:a.fade===0?0:1,snz:+a.snz>0?+a.snz:null,fired:typeof a.fired==='string'?a.fired:''}}
function put(o){st.s.alarm=Object.assign(cfg(),o);save()}
const hm=t=>{const m=/^(\d\d):(\d\d)$/.exec(t);return m?[+m[1],+m[2]]:[6,30]};
const two=n=>(n<10?'0':'')+n,fmt=d=>two(d.getHours())+':'+two(d.getMinutes());
const ymdL=d=>d.getFullYear()+'-'+two(d.getMonth()+1)+'-'+two(d.getDate());
const at=(d,t)=>{const x=new Date(d),h=hm(t);x.setHours(h[0],h[1],0,0);return x};

/* ---------- suggestion: bedtime + sleep goal + time to fall asleep ---------- */
function goalH(){const g=st.g&&Array.isArray(st.g.sleep)?st.g.sleep:SR(+st.p.age||16);return[+g[0]||8,+g[1]||10]}
function suggest(bed){if(!okT(bed))return null;const h=hm(bed),m=(h[0]*60+h[1]+goalH()[0]*60+FALL)%1440;return two(Math.floor(m/60))+':'+two(m%60)}
let bed=null;const bedNow=()=>{if(bed)return bed;const l=LC('sleep').slice(-1)[0];return l&&okT(l.m&&l.m.bed)?l.m.bed:'23:00'};

/* ---------- when it rings ---------- */
/** The next time the alarm rings (Date), or null when it is off. A snooze comes first. */
function next(a,now){a=a||cfg();now=now||new Date();if(a.snz&&a.snz>now.getTime())return new Date(a.snz);if(!a.on)return null;
  for(let i=0;i<8;i++){const d=new Date(now);d.setDate(d.getDate()+i);const x=at(d,a.t);
    if(x<=now||a.fired===ymdL(x)+' '+a.t)continue;if(a.days.length&&a.days.indexOf(x.getDay())<0)continue;return x}return null}
function until(x){const m=Math.max(0,Math.round((x-Date.now())/60e3));return m<60?m+' min':Math.floor(m/60)+' h '+two(m%60)+' min'}
function check(){const a=cfg(),now=new Date(),t=now.getTime();if(ring)return;
  if(a.snz&&t>=a.snz){put({snz:null});start('snooze');return}
  if(!a.on)return;const x=at(now,a.t),key=ymdL(now)+' '+a.t,late=t-x.getTime();
  if(late<0||a.fired===key||(a.days.length&&a.days.indexOf(now.getDay())<0))return;
  const once=!a.days.length;
  if(late<=LATE){put({fired:key,on:once?0:1});start('alarm');return}
  if(late<=MISS){put({fired:key,on:once?0:1});toast(ico('alarm')+' Missed alarm at '+esc(a.t)+': HealthWiz was not open on screen. Use your phone\'s Clock app for a sure alarm.');paintCard()}}
let TK=0;function schedule(){clearInterval(TK);TK=0;const a=cfg();if(a.on||a.snz)TK=setInterval(check,15e3);check()}

/* ---------- sound: original WebAudio patterns through tn() (music volume), with a fade-in ---------- */
let armed=!!(N.userActivation&&N.userActivation.hasBeenActive),T=[],S0=0,LOOP=0;
const PAT={
  chimes:[2400,f=>[1046.5,1318.5,1568,2093].forEach((n,i)=>later(()=>tn(n,.9,'triangle',.05*f),i*180))],
  birds:[2600,f=>{[2600,3100,2600,3300,2800].forEach((n,i)=>later(()=>tn(n,.07,'sine',.03*f),i*70));
    [1900,2300,2100].forEach((n,i)=>later(()=>tn(n,.09,'sine',.026*f),900+i*110))}],
  bell:[3000,f=>[[392,0],[329.63,750]].forEach(b=>later(()=>{const n=b[0];tn(n,3,'sine',.07*f);tn(n*2,2.2,'sine',.03*f);tn(n*2.4,1.6,'sine',.022*f);tn(n*3,1.1,'sine',.014*f)},b[1]))]};
function later(fn,ms){T.push(setTimeout(fn,ms))}
function quiet(){clearInterval(LOOP);LOOP=0;T.forEach(clearTimeout);T=[]}
function level(fade){return fade?Math.min(1,.12+.88*(Date.now()-S0)/45e3):1}
function sound(){quiet();if(!armed)return;const a=cfg(),P=PAT[a.snd];S0=Date.now();if(MT)acts.mus(); // the alarm, not the music
  const one=()=>{if(!ring||Date.now()-S0>RINGMAX){quiet();if(ring)paintRing();return}P[1](level(a.fade))};one();LOOP=setInterval(one,P[0])}
function preview(){quiet();const a=cfg();PAT[a.snd][1](1)}

/* ---------- screen wake lock (bedside clock) ---------- */
let WL=null;
function wake(on){const w=N.wakeLock;if(on){if(WL||!w||D.visibilityState==='hidden')return;w.request('screen').then(l=>{WL=l;l.addEventListener('release',()=>{if(WL===l)WL=null})}).catch(()=>{})}
  else if(WL){const l=WL;WL=null;l.release().catch(()=>{})}}

/* ---------- the hero in bed (original pixel sprite, 24×14, the icon palette) ---------- */
const BED=['nNNNNNNNNNNNNNNNNNNNNNNn','N......................N','N......................N'];
const HERO={sleep:['........................','........................','........................','........................','........................',
  'n.......................','n..NNNq..................','n.wNqqqbbbbbbbbbbbbbbbb.','n.wwqeqbbbbbbbbbbbbbbbbB','nwwwwwbbbbbbbbbbbbbbbbbB','nnnnnnnnnnnnnnnnnnnnnnnn'].concat(BED),
  wake:['.....q.NNNN.q...........','.....q.NqqN.q...........','.....qqeqqeqq...........','.......qqqq.............','.......oooo.............',
  'n.....oooooo............','n.ww..oooooo............','n.www.oooooobbbbbbbbbbb.','n.wwwwoooooobbbbbbbbbbbB','nwwwwwbbbbbbbbbbbbbbbbbB','nnnnnnnnnnnnnnnnnnnnnnnn'].concat(BED)};
const SPR={};const hero=k=>SPR[k]||(SPR[k]=spr(HERO[k],HWPixel.PAL,4));

/* ---------- ringing screen and bedside clock ---------- */
let ring=null,clockOn=0,CK=0;
function layer(id){let el=D.getElementById(id);if(!el){el=D.createElement('div');el.id=id;D.body.appendChild(el)}return el}
function paintRing(){const el=layer('v6alr'),a=cfg(),up=armed&&ring.woke,silent=MV()<.01;
  el.className='v6alo'+(up?' up':'');el.setAttribute('role','alertdialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','v6alrt');
  el.innerHTML='<div class="v6alb pxp pxn pxdk"><div class="v6alh">'+ico('alarm',2,'Alarm')+'<b id="v6alrt">'+(ring.k==='snooze'?'SNOOZE OVER':'WAKE UP')+'</b>'+ico('bell',2)+'</div>'
    +'<div class="v6alt num">'+fmt(new Date())+'</div>'
    +'<div class="v6alhero" aria-hidden="true">'+hero(up?'wake':'sleep')+(up?'':'<span class="v6alz">'+ico('snooze',2)+'</span>')+'</div>'
    +(!armed?'<button class="v6altap" data-a="altap">'+ico('bell')+' TAP TO START THE ALARM SOUND</button><small>Browsers only play sound after a tap on the page.</small>'
      :silent?'<small>Music volume is 0, so the alarm is silent. Raise it in Settings → Sound.</small>'
      :Date.now()-S0>RINGMAX?'<small>The sound stopped after 10 minutes.</small>':'<small>'+esc(SND[a.snd])+(a.fade?' · getting louder':'')+'</small>')
    +'<div class="v6alr">'+btn('alsnz',ico('snooze')+' SNOOZE 5 MIN','g',' data-m="5"')+btn('alsnz',ico('snooze')+' SNOOZE 10 MIN','g',' data-m="10"')+'</div>'
    +btn('alstop','STOP','v6alstop')+'</div>';
  el.hidden=false}
function start(k){ring={k,at:Date.now(),woke:0};D.body.classList.add('v6wake','v6ring');try{if(N.vibrate)N.vibrate([400,200,400,200,400])}catch(e){}
  if(armed){sound();later(()=>{if(ring){ring.woke=1;paintRing()}},HWUI.reduced()?0:1200)}
  paintRing();const b=D.querySelector('#v6alr .v6altap,#v6alr .v6alstop');if(b)b.focus({preventScroll:true})}
function end(){quiet();ring=null;D.body.classList.remove('v6ring');const el=D.getElementById('v6alr');if(el){el.hidden=true;el.innerHTML=''}try{if(N.vibrate)N.vibrate(0)}catch(e){}paintCard()}
function paintClock(){const el=D.getElementById('v6alc');if(!el||el.hidden)return;const n=next(),t=el.querySelector('.v6alt');
  if(t){t.textContent=fmt(new Date());el.querySelector('small').textContent=n?'Alarm '+fmt(n)+' · in '+until(n):'No alarm set'}}
function openClock(){clockOn=1;const el=layer('v6alc'),n=next();el.className='v6alo v6alcl';el.setAttribute('role','dialog');el.setAttribute('aria-label','Bedside clock');
  el.innerHTML='<div class="v6alcb">'+ico('sleep',2)+'<div class="v6alt num" role="timer">'+fmt(new Date())+'</div><small>'+(n?'Alarm '+fmt(n)+' · in '+until(n):'No alarm set')+'</small>'
    +'<p>Keep HealthWiz open on this screen and the phone plugged in. '+(N.wakeLock?'The screen stays on while this clock shows.':'This browser cannot keep the screen on: set your phone not to lock, or use its Clock app.')+'</p>'
    +btn('alclock','EXIT BEDSIDE CLOCK','g')+'</div>';el.hidden=false;wake(1);clearInterval(CK);CK=setInterval(paintClock,10e3)}
function closeClock(){clockOn=0;clearInterval(CK);CK=0;wake(0);const el=D.getElementById('v6alc');if(el){el.hidden=true;el.innerHTML=''}}

/* ---------- phone layers ---------- */
const android=()=>/Android/i.test(N.userAgent||''),ios=()=>/iPhone|iPad|iPod/i.test(N.userAgent||'')||(/Macintosh/.test(N.userAgent||'')&&N.maxTouchPoints>1);
function intent(t){const h=hm(t);return'intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR='+h[0]+';i.android.intent.extra.alarm.MINUTES='+h[1]
  +';S.android.intent.extra.alarm.MESSAGE=HealthWiz%20wake-up;B.android.intent.extra.alarm.SKIP_UI=false;end'}
let note='',popen=null; // popen: the phone section opened/closed by the user (open by default on phones)
D.addEventListener('toggle',e=>{if(e.target&&e.target.classList&&e.target.classList.contains('v6alp'))popen=e.target.open},true);
function clockApp(){const a=cfg();if(!android()){note='This button works on Android phones only. On this device, open your Clock app and set an alarm for '+a.t+'.';paintCard();return}
  let left=0;const gone=()=>{left=1};addEventListener('blur',gone,{once:true});D.addEventListener('visibilitychange',gone,{once:true});
  try{location.href=intent(a.t)}catch(e){left=0}
  setTimeout(()=>{removeEventListener('blur',gone);D.removeEventListener('visibilitychange',gone);
    note=left?'':'Your phone did not open the Clock app. Open Clock yourself, tap Alarm, then + and set '+a.t+(a.days.length?' (repeat: '+a.days.map(d=>DAY[d].slice(0,3)).join(', ')+')':'')+'.';paintCard()},1500)}
function ics(){const a=cfg(),n=next(Object.assign({},a,{on:1,snz:null}))||at(new Date(Date.now()+864e5),a.t),p=d=>d.getFullYear()+two(d.getMonth()+1)+two(d.getDate())+'T'+two(d.getHours())+two(d.getMinutes())+'00',
    BY=['SU','MO','TU','WE','TH','FR','SA'],z=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,'');
  const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//HealthWiz Kingdom//Wake-up alarm//EN','BEGIN:VEVENT','UID:hw-wake-'+Date.now()+'@healthwiz','DTSTAMP:'+z,'DTSTART:'+p(n),'DURATION:PT5M',
    'SUMMARY:Wake up (HealthWiz)','DESCRIPTION:Wake-up reminder from HealthWiz Kingdom.'].concat(a.days.length?['RRULE:FREQ=WEEKLY;BYDAY='+a.days.map(d=>BY[d]).join(',')]:[])
    .concat(['BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Wake up','TRIGGER:PT0M','END:VALARM','END:VEVENT','END:VCALENDAR']);
  return L.join('\r\n')+'\r\n'}
function download(){try{const b=new Blob([ics()],{type:'text/calendar'}),u=URL.createObjectURL(b),x=D.createElement('a');x.href=u;x.download='healthwiz-wake-up.ics';D.body.appendChild(x);x.click();x.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);
  toast('Calendar reminder downloaded. Open it to add it to your calendar.')}catch(e){toast('Could not create the calendar file on this device.')}}

/* ---------- the Sleep page card ---------- */
function card(){const a=cfg(),n=next(a),b=bedNow(),s=suggest(b),G=goalH(),plat=android()?'a':ios()?'i':'';
  return '<h3>'+ico('alarm',1,'Alarm clock')+' WAKE-UP ALARM</h3>'
    +'<div class="v6alw" role="note">'+ico('warning')+'<span><b>Rings only while HealthWiz is open on screen.</b> For a sure alarm, also set your phone\'s Clock app below.'+HWHelp.btn('alarmwhy')+'</span></div>'
    +'<div class="v6als">'+ico('sleep',1,'Moon')+'<div><label>Bedtime tonight<input id="al-bed" type="time" data-in="albed" value="'+esc(b)+'"></label>'
    +'<p id="al-sug">'+(s?'Suggested wake time: <b>'+s+'</b><br><small class="mut">'+esc(b)+' + '+G[0]+' h (the low end of your '+G[0]+'–'+G[1]+' h sleep goal) + '+FALL+' min to fall asleep.</small>':'Enter a bedtime.')+'</p>'
    +btn('alsug','USE '+(s||'--:--'),'sm g',s?'':' disabled')+'</div></div>'
    +'<div class="row"><label>Alarm time<input id="al-t" type="time" data-ch="alt" value="'+esc(a.t)+'"></label></div>'
    +'<p class="v6all">Repeat <small class="mut">(none = once)</small></p><div class="row v6ald">'+DAY.map((d,i)=>btn('alday',d.slice(0,3).toUpperCase(),'chip'+(a.days.indexOf(i)>=0?' on':''),' data-d="'+i+'" aria-pressed="'+(a.days.indexOf(i)>=0)+'" aria-label="'+d+'"')).join('')+'</div>'
    +'<p class="v6all">Sound</p><div class="row">'+Object.keys(SND).map(k=>btn('alsnd',SND[k],'chip'+(a.snd===k?' on':''),' data-s="'+k+'" aria-pressed="'+(a.snd===k)+'"')).join('')+btn('alprev',ico('bell')+' PREVIEW','sm g')+'</div>'
    +'<div class="row"><button class="chip'+(a.fade?' on':'')+'" data-a="alfade" aria-pressed="'+!!a.fade+'">FADE-IN '+(a.fade?'ON':'OFF')+'</button></div>'
    +'<small class="mut">Plays at your music volume ('+(st.s.mv==null?70:+st.s.mv)+'%)'+(MV()<.01?': it is 0, so the alarm would be silent. Raise it in Settings → Sound.':'.')+' On phones, also turn off silent mode.</small>'
    +'<div class="row v6alon">'+btn('alon',ico('alarm')+' ALARM: '+(a.on?'ON':'OFF'),a.on?'':'g',' aria-pressed="'+!!a.on+'"')+btn('alclock',ico('sleep')+' BEDSIDE CLOCK','g')+'</div>'
    +'<p class="v6aln" role="status">'+(n?ico('bell')+' Next: <b>'+esc(DAY[n.getDay()].slice(0,3)+' '+fmt(n))+'</b> (in '+until(n)+')'+(a.snz&&n.getTime()===a.snz?' · snoozed':'')+'. Keep this page open.':'No alarm set.')+'</p>'
    +'<details class="v6alp"'+(((popen==null?plat:popen)||note)?' open':'')+'><summary>'+ico('alarm')+' PHONE ALARM (works when locked)</summary>'
    +'<div class="'+(plat==='a'?'on':'')+'"><b>Android</b><p>Opens your Clock app with '+esc(a.t)+' filled in. Check it and save. Repeat days are set in the Clock app.</p>'+btn('alandroid','SET IN CLOCK APP','sm')+'</div>'
    +'<div class="'+(plat==='i'?'on':'')+'"><b>iPhone</b><ol><li>Open the <b>Clock</b> app and tap <b>Alarm</b>.</li><li>Tap <b>+</b>, set <b>'+esc(a.t)+'</b>'+(a.days.length?' and Repeat: '+esc(a.days.map(d=>DAY[d]).join(', ')):'')+'.</li><li>Tap <b>Save</b>. Leave the ring/silent switch as you like: Clock alarms still sound.</li></ol></div>'
    +'<div><b>All devices</b><p>Add a calendar reminder at '+esc(a.t)+' (a notification, quieter than an alarm).</p>'+btn('alics','DOWNLOAD CALENDAR REMINDER (.ics)','sm g')+'</div>'
    +(note?'<p class="v6alw" role="alert">'+ico('warning')+'<span>'+esc(note)+'</span></p>':'')+'</details>'}
function paintCard(){const el=D.getElementById('v6alm');if(el)el.innerHTML=card()}
{const p=pages.sleep;pages.sleep=(...x)=>{const h=p(...x),c='<div class="card" id="v6alm">'+card()+'</div>',k='<div class="card"><h3>📅 SLEEP CONSISTENCY';
  return h.indexOf(k)>=0?h.replace(k,c+k):h+c}}

const change=o=>{const a=cfg();if(o.on==null&&!a.on&&o.snz===undefined)o.on=1;put(o);note='';schedule();paintCard()};
acts.alsug=()=>{const s=suggest(bedNow());if(s){change({t:s,fired:''});toast(ico('alarm')+' Alarm set for '+s+'.')}};
CH.alt=v=>{if(okT(v))change({t:v,fired:''})};
INP.albed=el=>{bed=okT(el.value)?el.value:null;const s=suggest(bedNow()),G=goalH(),p=D.getElementById('al-sug'),b=D.querySelector('[data-a="alsug"]');
  if(p)p.innerHTML=s?'Suggested wake time: <b>'+s+'</b><br><small class="mut">'+esc(bedNow())+' + '+G[0]+' h (the low end of your '+G[0]+'–'+G[1]+' h sleep goal) + '+FALL+' min to fall asleep.</small>':'Enter a bedtime.';
  if(b){b.textContent='USE '+(s||'--:--');b.disabled=!s}};
acts.alday=d=>{const a=cfg(),i=+d.d,L=a.days.indexOf(i)>=0?a.days.filter(x=>x!==i):a.days.concat(i).sort();change({days:L})};
acts.alsnd=d=>{put({snd:d.s});paintCard();preview()};
acts.alprev=()=>preview();
acts.alfade=()=>{put({fade:cfg().fade?0:1});paintCard()};
acts.alon=()=>{const a=cfg();put({on:a.on?0:1,snz:a.on?null:a.snz});schedule();paintCard();toast(a.on?'Alarm off.':ico('alarm')+' Alarm on. Keep HealthWiz open on screen; also set your phone\'s Clock app for a sure alarm.')};
acts.alclock=()=>{if(clockOn)closeClock();else openClock()};
acts.altap=()=>{armed=1;sound();later(()=>{if(ring){ring.woke=1;paintRing()}},HWUI.reduced()?0:1200);paintRing()};
acts.alsnz=d=>{const m=+d.m===10?10:5,u=Date.now()+m*60e3;put({snz:u});end();schedule();toast(ico('snooze')+' Snoozed for '+m+' min: rings at '+fmt(new Date(u))+'.')};
acts.alstop=()=>{put({snz:null});end();schedule();toast(ico('alarm')+' Good morning, adventurer. Your hero is awake.')};
acts.alandroid=()=>clockApp();
acts.alics=()=>download();

// the first tap anywhere unlocks sound (autoplay rules); until then a ringing alarm asks for one
const unlock=()=>{armed=1;D.removeEventListener('pointerdown',unlock,true);D.removeEventListener('keydown',unlock,true)};
if(!armed){D.addEventListener('pointerdown',unlock,true);D.addEventListener('keydown',unlock,true)}
D.addEventListener('visibilitychange',()=>{if(D.visibilityState==='visible'){check();if(clockOn)wake(1);paintClock()}});
HWEvents.on('app:ready',schedule);
HWEvents.on('page:viewed',e=>{if(!ring&&e&&e.view!=='sleep')D.body.classList.remove('v6wake')});
HWEvents.on('data:reset',()=>{end();closeClock();clearInterval(TK);TK=0;D.body.classList.remove('v6wake')});

HWUI.css('alarm',`
#v6alm h3{display:flex;align-items:center;gap:8px}
.v6alw{display:flex;gap:8px;align-items:flex-start;padding:8px;margin:0 0 10px;border:2px dashed var(--ln);background:var(--p2);font-size:13px}
.v6als{display:flex;gap:10px;align-items:flex-start;margin:0 0 8px}.v6als>div{flex:1 1 auto;min-width:0}.v6als p{margin:6px 0}
.v6all{margin:8px 0 4px}.v6ald{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.v6ald button{min-width:0;min-height:44px;padding:4px 0;margin:0;font-size:7px}
#v6alm .row button,#v6alm input{min-height:44px}.v6alon button{flex:1 1 140px;display:flex;align-items:center;justify-content:center;gap:6px}
.v6aln{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.v6alp summary{display:flex;align-items:center;gap:6px;min-height:44px;cursor:pointer;font:var(--px-f1)/1.6 var(--fh)}
.v6alp>div{margin:8px 0;padding:8px;border:2px solid var(--ln);background:var(--p2)}.v6alp>div.on{box-shadow:0 0 0 3px var(--gold)}.v6alp p,.v6alp ol{margin:4px 0}
.v6alo{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(6,9,13,.88)}
.v6alo[hidden]{display:none}
.v6alb{width:min(100%,380px);text-align:center;display:flex;flex-direction:column;gap:10px;align-items:stretch;animation:v6alsh .5s steps(2) infinite}
.v6alh{display:flex;align-items:center;justify-content:center;gap:10px}.v6alh b{font:var(--px-f2)/1.3 var(--fh)}
.v6alt{font:var(--px-f3)/1.2 var(--fh);font-size:40px}
.v6alhero{position:relative;display:flex;justify-content:center;padding:8px 0}.v6alhero img{image-rendering:pixelated;max-width:100%;height:auto}
.v6alz{position:absolute;right:12%;top:0}
.v6alr{display:flex;gap:8px}.v6alr button{flex:1 1 0;min-height:52px;display:flex;align-items:center;justify-content:center;gap:6px}
.v6alstop{min-height:64px;font-size:16px;background:var(--red);color:#fff}.v6altap{min-height:56px;display:flex;align-items:center;justify-content:center;gap:6px}
@keyframes v6alsh{50%{transform:translateX(2px)}}
.v6alo.up .v6alb{animation:none}
.v6alcl{background:#000;color:#7a3f1d}
.v6alcb{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;max-width:360px;opacity:.75}
.v6alcb .v6alt{font-size:56px;color:#c8743a}.v6alcb small{color:#c8743a}.v6alcb p{font-size:13px;color:#8a6a50}
.v6alcb button{min-height:48px;background:#1b1626;color:#c8743a;border-color:#3a2a20}
/* the dream scene (Counting Sheep): while ringing and after STOP the dream pops and morning light comes in */
body.v6wake .shs .zzz,body.v6wake .shs .shcl,body.v6wake .shs .shd1,body.v6wake .shs .shd2{display:none}
body.v6wake .shs:before{content:"!";position:absolute;z-index:3;left:40%;top:22%;padding:6px 10px;font:16px/1 var(--fh);color:#2b2418;background:#f2c14e;border:3px solid #1b1626;box-shadow:3px 3px 0 #1b1626}
body.v6wake .shs:after{content:"";position:absolute;inset:0;background:rgba(255,214,120,.28);pointer-events:none}
@media(prefers-reduced-motion:reduce){.v6alb{animation:none}}html.hw-rm .v6alb,html.hw-still .v6alb{animation:none}
`);
return{cfg,next,suggest,ics,intent,check,get ringing(){return !!ring},get armed(){return !!armed}}})();
