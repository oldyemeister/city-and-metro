import fs from 'node:fs/promises';
const deadline=Date.now()+110000;
const port=Number((await fs.readFile('/var/folders/n5/_4pxtjbd4977vwnbzxx01r340000gn/T/city-metro-mobile-Ri9td8/profile/DevToolsActivePort','utf8')).split('\n')[0]);
async function connect(url){const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.j(Error(JSON.stringify(m.error))):p.r(m.result);}};return {ws,send:(method,params={})=>new Promise((r,j)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);j(Error('timeout '+method));},Math.max(1,Math.min(15000,deadline-Date.now())));pending.set(n,{r,j,timer});ws.send(JSON.stringify({id:n,method,params}));})};}
const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
let target=targets.find(t=>t.type==='page'&&/^http:\/\/localhost:8001\//.test(t.url));const created=!target;if(!target)target=await(await fetch(`http://127.0.0.1:${port}/json/new?http://localhost:8001/`,{method:'PUT'})).json();
const c=await connect(target.webSocketDebuggerUrl);
const ev=async expression=>{const r=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const out={target:{url:target.url,title:target.title},capturedAt:new Date().toISOString(),cases:[]};
try{
const browser=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();const b=await connect(browser.webSocketDebuggerUrl);try{out.gpu=await b.send('SystemInfo.getInfo');}finally{b.ws.close();}
await c.send('Page.bringToFront');
if(created){
const begin=Date.now();while(!(await ev('!!window.CM?.ui&&!!CM.Save'))){if(Date.now()-begin>15000)throw Error('Page initialization timeout');await new Promise(r=>setTimeout(r,100));}
const save=await fs.readFile('savedgames/test/城市与地铁_经营挑战 · 上海 1990_2000年7月.cmsave.json','utf8');
await ev('CM.Settings.set("autosave",false);CM.Settings.set("sound",false);CM.loadGame(CM.Save.parseEnvelope('+JSON.stringify(save)+').payload);true');
while(!(await ev('!!CM.game&&!CM.isLoading()&&CM.game.model.trafficReady()&&!CM.game.pending'))){if(Date.now()-begin>45000)throw Error('Load timeout');await new Promise(r=>setTimeout(r,150));}
await ev('CM.game.setSpeed(0);CM.ui.closeScreen();true');
}

out.initial=await ev(`(()=>{const g=CM.game,m=g.model;return {map:g.mapId,clock:{...g.clock},speed:g.speed,stations:Object.keys(g.net.stations).length,trafficReady:m.trafficReady(),review:m.hasReviewWork(),pending:!!g.pending,settled:m.settled,visibility:document.visibilityState,viewport:[innerWidth,innerHeight,devicePixelRatio],camera:{...CM.R.cam}}})()`);
if(out.initial.map!=='sh')throw Error('Wrong map');
await ev(`(()=>{window.__mp={stats:{},restore:[]};const p=window.__mp;const wrap=(o,k,name)=>{if(!o||typeof o[k]!=='function')return;const old=o[k];o[k]=function(...a){const t=performance.now();try{return old.apply(this,a);}finally{const s=p.stats[name]||(p.stats[name]={n:0,total:0,max:0});const dt=performance.now()-t;s.n++;s.total+=dt;s.max=Math.max(s.max,dt);}};p.restore.push(()=>o[k]=old);};wrap(CM.game,'update','game.update');wrap(CM.game.model,'step','model.step');wrap(CM.ui,'tick','ui.tick');wrap(CM.agents,'update','agents.update');for(const k of Object.getOwnPropertyNames(Object.getPrototypeOf(CM.R)))if(typeof CM.R[k]==='function'&&/render|draw|label|cong/i.test(k))wrap(CM.R,k,'renderer.'+k);return true;})()`);
await c.send('Profiler.enable');await c.send('Profiler.setSamplingInterval',{interval:1000});
for(const speed of [0,1]){
await ev(`CM.game.setSpeed(${speed});window.__mp.stats={};true`);
await c.send('Profiler.start');
const sample=await ev(`new Promise(resolve=>{const frames=[],start=performance.now();let last=start;function frame(t){frames.push(t-last);last=t;if(t-start<5000)requestAnimationFrame(frame);else {const g=CM.game,m=g.model;resolve({elapsed:t-start,frameIntervals:frames,stats:window.__mp.stats,trafficReady:m.trafficReady(),review:m.hasReviewWork(),pending:!!g.pending,settled:m.settled,renderMs:CM.R.lastRenderMs,queueMs:CM.R.lastQueueMs});}}requestAnimationFrame(frame);})`);
const {profile}=await c.send('Profiler.stop');
out.cases.push({speed,...sample,profile});console.log('CAPTURED speed',speed,'frames',sample.frameIntervals.length);
}
}catch(e){out.error=String(e);}
finally{try{await ev(`(()=>{CM.game.setSpeed(0);if(window.__mp){window.__mp.restore.reverse().forEach(f=>f());delete window.__mp;}return true})()`);}catch{}c.ws.close();await fs.mkdir('docs/shanghai-map/evidence/perf-20261116',{recursive:true});await fs.writeFile('docs/shanghai-map/evidence/perf-20261116/profile.json',JSON.stringify(out));}
console.log(JSON.stringify({initial:out.initial,error:out.error,gpu:out.gpu?.gpu?.featureStatus,cases:out.cases.map(x=>({speed:x.speed,frames:x.frameIntervals.length,trafficReady:x.trafficReady,review:x.review}))}));
