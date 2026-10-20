import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT=process.env.ROOT||new URL('..', import.meta.url).pathname, T={'.js':'text/javascript','.html':'text/html','.css':'text/css'};
const srv=http.createServer((q,r)=>{const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]).replace(/\/$/,'/index.html'));fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(b)})});
await new Promise(r=>srv.listen(8772,r));
const OUTD=new URL('shots', import.meta.url).pathname; fs.mkdirSync(OUTD,{recursive:true}); // simulated GPS positions below are test values, not anyone's location
const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const W=+(process.env.W||1280),H=+(process.env.H||760), tag=process.env.TAG||'M', mode=process.env.MODE||'fantasy';
const ctx=await b.newContext({viewport:{width:W,height:H},permissions:['geolocation'],geolocation:{latitude:5.3505,longitude:100.5383,accuracy:9},...(W<900?{isMobile:true,hasTouch:true}:{})});
const p=await ctx.newPage(); await p.addInitScript(m=>{try{localStorage.setItem('cho-mode',m)}catch(e){}},mode);
const errs=[]; p.on('pageerror',e=>errs.push('pageerror '+e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+' '+m.text())});
await p.goto('http://localhost:8772/');
await p.waitForFunction(()=>window.__cho&&window.__cho.MAP&&document.querySelectorAll('.stm').length>5,null,{timeout:90000});
await p.waitForTimeout(1500);
await p.click('[data-ctl="me"]');
await p.waitForFunction(()=>{const a=window.__cho.MAP.avatar;return a&&a.ready&&a.state.visible},null,{timeout:60000});
await p.waitForTimeout(2500);
const st=()=>p.evaluate(()=>({loc:window.__cho.LOC.state,text:document.getElementById('me-t').textContent,pressed:document.querySelector('[data-ctl="me"]').getAttribute('aria-pressed'),
  av:window.__cho.MAP.avatar.state,center:window.__cho.MAP.map.getCenter(),zoom:+window.__cho.MAP.map.getZoom().toFixed(2)}));
console.log('first fix',JSON.stringify(await st()));
await p.screenshot({path:`${OUTD}/${tag}-1-standing.png`});
// walk north-east in small GPS steps
for(let i=1;i<=6;i++){ await ctx.setGeolocation({latitude:5.3505+i*0.00002,longitude:100.5383+i*0.000012,accuracy:8}); await p.waitForTimeout(900); }
console.log('walking',JSON.stringify(await st()));
await p.screenshot({path:`${OUTD}/${tag}-2-walking.png`}); await p.screenshot({path:`${OUTD}/${tag}-2z.png`,clip:{x:(W-420)/2+180,y:H/2-260,width:420,height:420}});
await p.waitForTimeout(4000);
console.log('stopped',JSON.stringify(await st()));
// far away
await ctx.setGeolocation({latitude:5.42,longitude:100.33,accuracy:20}); await p.waitForTimeout(4000);
console.log('far',JSON.stringify(await st()));
await p.screenshot({path:`${OUTD}/${tag}-3-far.png`});
await p.evaluate(()=>document.querySelector('[data-act="me-demo"]').click()); await p.waitForTimeout(5000);
console.log('demo',JSON.stringify(await st()));
await p.screenshot({path:`${OUTD}/${tag}-4-demo.png`});
await p.evaluate(()=>document.querySelector('[data-act="me-stop"]').click()); await p.waitForTimeout(800);
console.log('stopped all',JSON.stringify(await p.evaluate(()=>({loc:window.__cho.LOC.state,hidden:document.getElementById('mestat').hidden,vis:window.__cho.MAP.avatar.state.visible}))));
console.log(errs.length?[...new Set(errs)].join('\n'):'no errors');await b.close();srv.close();
