import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const started=Date.now(),deadline=started+115000,folder='docs/shanghai-map/evidence/perf-20261116/foreground-2';
const profilePath='/var/folders/n5/_4pxtjbd4977vwnbzxx01r340000gn/T/city-metro-mobile-Ri9td8/profile';
await fs.mkdir(folder,{recursive:true});
const out={started:new Date(started).toISOString(),cases:[],profilePath};let c,b,profileOn=false;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(url){const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;setTimeout(()=>j(Error('WebSocket connect timeout')),3000).unref();});let seq=0;const waits=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data),w=waits.get(m.id);if(w){waits.delete(m.id);clearTimeout(w.t);m.error?w.j(Error(JSON.stringify(m.error))):w.r(m.result);}};return {ws,send:(method,params={})=>new Promise((r,j)=>{const id=++seq,t=setTimeout(()=>{waits.delete(id);j(Error('CDP timeout '+method));},Math.max(1,Math.min(7000,deadline-Date.now())));waits.set(id,{r,j,t});ws.send(JSON.stringify({id,method,params}));})};}
const ev=async expression=>{const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const state=`(()=>{const g=CM.game,m=g.model;return {map:g.mapId,clock:{...g.clock},speed:g.speed,visibility:document.visibilityState,focus:document.hasFocus(),trafficReady:m.trafficReady(),review:m.hasReviewWork(),pending:!!g.pending,settled:m.settled,sharpReady:CM.R.sharpReady(),viewport:[innerWidth,innerHeight,devicePixelRatio],camera:{cx:CM.R.cam.cx,cy:CM.R.cam.cy,zoom:CM.R.cam.zoom,view:CM.R.cam.view},stations:Object.keys(g.net.stations).length}})()`;
try{
const port=Number((await fs.readFile(profilePath+'/DevToolsActivePort','utf8')).split('\n')[0]);
const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(3000)})).json();
const t=targets.find(t=>t.type==='page'&&/^http:\/\/(localhost|127.0.0.1):8001\//.test(t.url));if(!t)throw Error('No existing isolated test tab; manual setup needed');out.url=t.url;
c=await connect(t.webSocketDebuggerUrl);const ver=await(await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(3000)})).json();b=await connect(ver.webSocketDebuggerUrl);out.browser=ver.Browser;
const win=await b.send('Browser.getWindowForTarget',{targetId:t.id});await b.send('Browser.setWindowBounds',{windowId:win.windowId,bounds:{windowState:'normal'}});
execFileSync('/usr/bin/osascript',['-e','tell application "/Users/jacky/Applications/Google Chrome for Testing.app" to activate'],{timeout:5000});
await c.send('Page.bringToFront');await delay(700);
out.gpu=(await b.send('SystemInfo.getInfo')).gpu;
const source=await(await fetch('http://localhost:8001/js/render.js',{signal:AbortSignal.timeout(3000)})).text();if(source!==await fs.readFile('js/render.js','utf8'))throw Error('Preview source mismatch');
await ev(`(()=>{if(window.__mp){window.__mp.restore.reverse().forEach(f=>f());delete window.__mp;}CM.Settings.set('autosave',false);CM.game.setSpeed(0);CM.ui.closeScreen();CM.ui.closePanel(true);return true})()`);
out.initial=await ev(state);if(out.initial.map!=='sh'||out.initial.visibility!=='visible'||!out.initial.focus)throw Error('Need actual visible focused Shanghai tab; no focus emulation');
const warmEnd=Math.min(deadline-35000,Date.now()+20000);while(Date.now()<warmEnd){const s=await ev(state);if(s.trafficReady&&!s.review&&!s.pending&&s.sharpReady)break;await delay(250);}await delay(1500);out.afterWarmup=await ev(state);
if(!out.afterWarmup.trafficReady||out.afterWarmup.review||out.afterWarmup.pending||!out.afterWarmup.sharpReady)throw Error('Warmup not ready');
await ev(`(()=>{window.__fg={stats:{},restores:[],frames:[],visibility:[],active:false};const p=__fg;const wrap=(o,k,name)=>{if(typeof o?.[k]!=='function')return;const old=o[k];o[k]=function(...a){const s=p.stats[name]||(p.stats[name]=[]),t=performance.now();try{return old.apply(this,a);}finally{if(p.active)s.push(performance.now()-t);}};p.restores.push(()=>o[k]=old);};wrap(CM.game,'update','game.update');wrap(CM.game.model,'step','model.step');wrap(CM.ui,'tick','ui.tick');wrap(CM.agents,'update','agents.update');for(const k of ['render','drawLabels','layoutLabels','drawFacilitySprite','drawMetro'])wrap(CM.R,k,'renderer.'+k);return true})()`);
await c.send('Profiler.enable');await c.send('Profiler.setSamplingInterval',{interval:1000});
for(const kind of ['paused-idle','paused-drag','running-1x']){
 if(Date.now()>deadline-15000)throw Error('Budget exhausted before '+kind);
 await ev(`CM.game.setSpeed(${kind==='running-1x'?1:0});true`);await delay(400);
 execFileSync('/usr/bin/osascript',['-e','tell application \"/Users/jacky/Applications/Google Chrome for Testing.app\" to activate'],{timeout:3000});await c.send('Page.bringToFront');await delay(300);const before=await ev(state);if(before.visibility!=='visible'||!before.focus)throw Error('Focus lost before '+kind);
 await ev(`(()=>{const p=__fg;p.stats={};p.frames=[];p.visibility=[];p.active=true;p.last=0;const f=t=>{if(!p.active)return;if(p.last)p.frames.push(t-p.last);p.last=t;p.visibility.push(document.visibilityState);p.raf=requestAnimationFrame(f);};p.raf=requestAnimationFrame(f);return true})()`);
 await c.send('Profiler.start');profileOn=true;const begin=Date.now();
 if(kind==='paused-drag'){
  const [w,h]=before.viewport,x=w*.55,y=h*.55;
  await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});await c.send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'middle',buttons:4,clickCount:1});
  while(Date.now()-begin<4000){const phase=(Date.now()-begin)/4000*Math.PI*4;await c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+110*Math.sin(phase),y:y+40*Math.sin(phase/2),button:'middle',buttons:4});await delay(33);}
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'middle',buttons:0,clickCount:1});
 }else await delay(4000);
 const sample=await ev(`(()=>{const p=__fg;p.active=false;cancelAnimationFrame(p.raf);return {stats:p.stats,frames:p.frames,visibility:p.visibility}})()`);
 const {profile}=await c.send('Profiler.stop');profileOn=false;const after=await ev(state);await fs.writeFile(folder+'/'+kind+'.cpuprofile',JSON.stringify(profile));out.cases.push({kind,elapsedMs:Date.now()-begin,before,after,...sample});await fs.writeFile(folder+'/raw.json',JSON.stringify(out));console.log('CAPTURED',kind,'frames',sample.frames.length,'visible',sample.visibility.every(x=>x==='visible'),'camera',JSON.stringify(after.camera));
}
}catch(e){out.error=String(e);console.log('INCOMPLETE',out.error);}
finally{
if(c){try{if(profileOn){const {profile}=await c.send('Profiler.stop');await fs.writeFile(folder+'/incomplete.cpuprofile',JSON.stringify(profile));}await ev(`(()=>{CM.game.setSpeed(0);if(window.__fg){__fg.active=false;cancelAnimationFrame(__fg.raf);__fg.restores.reverse().forEach(f=>f());delete window.__fg;}return true})()`);out.cleanupConfirmed=true;out.final=await ev(state);}catch(e){out.cleanupError=String(e);}c.ws.close();}b?.ws.close();out.totalMs=Date.now()-started;await fs.writeFile(folder+'/raw.json',JSON.stringify(out));console.log(JSON.stringify({cases:out.cases.map(c=>c.kind),error:out.error,totalMs:out.totalMs,cleanup:out.cleanupConfirmed,final:out.final}));}
