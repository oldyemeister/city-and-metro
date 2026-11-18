// Visible isolated Chrome, one cumulative user-authorized budget across every map and scenario.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const guards = { JS: 'false && module', WASM: 'module && true' };
const cli = Object.fromEntries(process.argv.slice(2).map(opt=>opt.split('=')));
if (!cli['--large'] || !cli['--small']) throw Error('Pass --large=/path/to/save and --small=/path/to/save');
const budgetSec = Number(cli['--seconds'] || 120);
assert.ok(Number.isInteger(budgetSec) && budgetSec >= 10 && budgetSec <= 480);
const settings=JSON.parse(await fs.readFile('.agents/skills/metro-browser-check/test-settings.json'));
const source=await fs.readFile('js/sim.js','utf8'), embedded=await fs.readFile('js/road-kernel.js','utf8');
const selectors=[...source.matchAll(/if \((module && nt >= n \* G\.Z \* [\d.]+)\) \{/g)];
assert.equal(selectors.length,1);
const originalDispatch=selectors[0][1];
const hash=s=>createHash('sha256').update(s).digest('hex');
const fixtures={};
const fixturesInfo={};
for(const size of ['large','small']){
 const text=await fs.readFile(cli['--'+size],'utf8'),payload=JSON.parse(JSON.parse(text).body);
 const info={file:path.basename(cli['--'+size]),sha256:hash(text),map:payload.meta.map,clock:payload.clock,stations:Object.keys(payload.net.stations).length};
 fixtures[size]={text,info}; fixturesInfo[size]=info;
}
assert.equal(fixturesInfo.large.map,'sh');assert.equal(fixturesInfo.large.stations,278);
assert.equal(fixturesInfo.large.clock.y,2010);assert.equal(fixturesInfo.small.map,'ld');assert.equal(fixturesInfo.small.clock.y,1860);
const output=await fs.mkdtemp(path.resolve('evidence/road-workers/dispatch-calibration/browser-'));
const report={sourceSHA256:hash(source),embeddedKernelSHA256:hash(embedded),fixtures:fixturesInfo,cases:[],comparisons:[],errors:[],budgetSeconds:budgetSec};
const write=()=>fs.writeFile(output+'/results.json',JSON.stringify(report,null,2));
let browser,page,current=null;const urls=new Map();
const previous=cli['--resume']?JSON.parse(await fs.readFile(cli['--resume'],'utf8')):null;
const reverseLarge=cli['--reverse-large']==='yes';
if(reverseLarge)assert.ok(previous?.forcedComplete && previous.policy);
const started=previous?Date.parse(previous.startedAt):Date.now(),deadline=started+budgetSec*1000;report.startedAt=new Date(started).toISOString();
if(previous){assert.equal(reverseLarge?previous.policy.sourceSHA256:previous.sourceSHA256,report.sourceSHA256);assert.deepEqual(previous.fixtures,fixturesInfo);assert.ok(path.basename(previous.profile).startsWith('metro-dispatch-calibration-'));report.resumedFrom=cli['--resume'];}
const left=()=>deadline-Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check){while(left()>4000){const v=await check();if(v)return v;await sleep(50);}throw Error('Shared browser deadline reached');}
async function connect(url){
  const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let seq=0;const pending=new Map();
  const api={close:()=>ws.close(),event:()=>{},call:(method,params={})=>new Promise((r,j)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);j(Error(method+' timeout'));},Math.max(1,Math.min(8000,left()-300)));pending.set(id,m=>{clearTimeout(timer);pending.delete(id);m.error?j(Error(JSON.stringify(m.error))):r(m.result);});ws.send(JSON.stringify({id,method,params}));})};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id)pending.get(m.id)?.(m);else api.event(m);};return api;
}
async function ev(expression){const r=await page.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function snapshot(){return ev(`(async()=>{
 const g=CM.game,m=g.model,hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join(''),textHash=o=>hash(new TextEncoder().encode(JSON.stringify(o)));
 const arrays={},periodStats={};
 for(const dt of ['wd','we'])for(const[i,p]of m.ctxs[dt].per.entries()){
   for(const[k,v]of Object.entries(p))if(ArrayBuffer.isView(v))arrays[dt+i+'.'+k]={type:v.constructor.name,length:v.length,sha256:await hash(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))};
   periodStats[dt+i]=Object.fromEntries(Object.entries(p).filter(([k,v])=>v===null||['number','boolean','string'].includes(typeof v)||k==='stats'));
 }
 const daily={};
 for(const [name,obj] of Object.entries({weekday:m.dailyWk,weekend:m.dailyWe,average:m.daily,
   weekdayStations:m.stDailyWk,weekendStations:m.stDailyWe,stations:m.stDaily,weekdayFacilities:m.facDaily.wd,weekendFacilities:m.facDaily.we})){
   daily[name]=await textHash(Object.fromEntries(Object.entries(obj).filter(([,v])=>!ArrayBuffer.isView(v))));
   for(const [k,v] of Object.entries(obj))if(ArrayBuffer.isView(v))daily[name+'.'+k]=await hash(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));
 }
 return {clock:{...g.clock},metrics:g.snapshotMetrics(),arrays,periodStats,daily,economy:g.econ.serialize(),
 historySHA256:await textHash(g.history),tasksSHA256:await textHash(g.tasks.serialize()),corpSHA256:await textHash(g.corp),fleetSHA256:await textHash(g.fleet),
 ledgerSHA256:await textHash(g.econ.ledger),networkSHA256:await textHash(g.net)};
})()`);}
function observeRoadWorker(token) {
 let graph,active=null;
 const handler=self.onmessage,send=self.postMessage.bind(self);
 self.onmessage=function(event){
   const m=event.data;
   if(m.type==='graph')graph=m.G;
   if(m.type==='block')active={zones:graph.Z,nodes:graph.nN,arcs:graph.nA,rows:m.origins.length,pairs:m.tDest.length,start:performance.now()};
   try{return handler.call(this,event);}finally{active=null;}
 };
 self.postMessage=(m,transfers)=>{
   if(active && m && m.req!==undefined){
     m.__sample=[token,active.zones,active.nodes,active.arcs,active.rows,active.pairs,performance.now()-active.start];
   }
   return send(m,transfers);
 };
}
function install(original,choices,observer){
 const NativeBlob=window.Blob,done=CM.CarPool.done;
 const t=window.dispatchTest={variant:'JS',token:'',sources:[],bad:[],records:null,acks:{},choices,roadSize:CM.CarPool.size,availableModule:CM.RoadKernel.module};
 window.Blob=class extends NativeBlob{
   constructor(parts,options){
     let actual=parts;
     if(parts.length===1&&typeof parts[0]==='string'&&parts[0].includes('function carTree(')){
       const baseline=parts[0];
       if(baseline.split(original).length!==2)throw Error('Unexpected road source');
       const adjusted=baseline.replace(original,choices[t.variant]);
       t.sources.push({baseline,adjusted,token:t.token,variant:t.variant});
       actual=[adjusted+';('+observer+')('+JSON.stringify(t.token)+');'];
     }
     super(actual,options);
   }
 };
 CM.CarPool.done=function(slot,m){
   if(!m.stale && m.req!==undefined){
     const a=m.__sample,idx=this.list.indexOf(slot);
     if(!a || a[0]!==t.token)t.bad.push([t.token,a?.[0]]);
     else if(t.records){t.acks[idx]=(t.acks[idx]||0)+1;t.records.push([m.req,m.b,idx,m.kernel?1:0,...a.slice(1)]);}
     delete m.__sample;
   }
   return done.call(this,slot,m);
 };
 CM.CarPool.size=()=>4;CM.Settings.set('autosave',false);
 t.restore=()=>{
   if(!CM.CarPool.release())throw Error('Cannot restore an active road pool');
   window.Blob=NativeBlob;CM.CarPool.done=done;CM.CarPool.size=t.roadSize;
   CM.RoadKernel.module=t.availableModule;CM.CarPool.ready();
 };
}
function describeBlocks(records){
 assert.ok(records.length>0);
 const summary=a=>{a.sort((x,y)=>x-y);return{min:a[0],median:a[Math.floor(a.length/2)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)};};
 const graphs={},densities=[],service=[];
 let totalPairs=0,totalCells=0;
 for(const [req,block,slot,kernel,z,n,arcs,rows,pairs,ms] of records){
   const graph=[z,n,arcs].join('/');graphs[graph]=(graphs[graph]||0)+1;
   densities.push(pairs/(z*rows));service.push(ms);totalPairs+=pairs;totalCells+=rows*z;
 }
 return {count:records.length,graphs,weightedDensity:totalPairs/totalCells,density:summary(densities),handlerMs:summary(service)};
}
async function setScenario(scenario) {
 if(scenario==='boundary')await ev(`(()=>{const g=CM.game;g.setSpeed(0);while(g.clock.d<CM.U.daysInMonth(g.clock.y,g.clock.m)){if(g.endDay())throw Error('unexpected month in setup');}g.clock.minute=1439;return true;})()`);
}
function begin(scenario){
 const g=CM.game,t=window.dispatchTest;
 t.records=[];t.acks={};
 const run=window.run={stats0:{...CM.CarPool.stats},start:performance.now(),cross:0,done:0,hidden:document.hidden,months:0};
 const listener=()=>{if(document.hidden)run.hidden=true;};
 run.stopVisibility=()=>document.removeEventListener('visibilitychange',listener);
 document.addEventListener('visibilitychange',listener);
 g.on('month',()=>run.months++);
 if(scenario!=='boundary'){
   const months=scenario==='year'?12:3;
   g.on('jumpDone',()=>{run.done=performance.now();});
   document.querySelector(months===12?'[data-act="jumpYear"]':'[data-act="jumpQuarter"]').click();
   if(g.jumping?.months!==months)throw Error('Jump failed '+scenario);
 }else{
   const end=g.endDay,update=g.update;
   g.endDay=function(){run.cross=performance.now();const crossed=end.call(this);if(crossed){this.setSpeed(0);delete this.endDay;}return crossed;};
   g.update=function(...args){const value=update.apply(this,args);if(run.cross&&!this.pending&&!this.jumping&&this.model.trafficReady()&&this.model.settled&&!this.model.hasReviewWork()&&this.taskRecheckYM!==this.ym()){run.done=performance.now();delete this.update;}return value;};
   g.setSpeed(1);
 }
}
try{
 let preview;
 try{preview=await fetch(settings.testUrl+'js/sim.js');}catch(e){
  if(e.cause?.code!=='ECONNREFUSED' && !(e.cause?.errors?.length && e.cause.errors.every(v=>v.code==='ECONNREFUSED')))throw e;
  const server=spawn('python3',['-m','http.server','8001','--bind','127.0.0.1'],{detached:true,stdio:'ignore'}); server.unref();
  await until(async()=>{try{preview=await fetch(settings.testUrl+'js/sim.js');return true;}catch{return false;}});
 }
 assert.equal(await preview.text(),source,'Preview mismatch');assert.equal(await(await fetch(settings.testUrl+'js/road-kernel.js')).text(),embedded,'Preview WASM mismatch');await fs.access(settings.browserExecutable);
 const profile=previous?.profile??await fs.mkdtemp(path.join(tmpdir(),'metro-dispatch-calibration-'));report.profile=profile;
 if(!previous)spawn(settings.browserExecutable,['--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check','about:blank'],{detached:true,stdio:'ignore'}).unref();
 const port=await until(async()=>{try{return(await fs.readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];}catch{}});
 const get=async route=>(await fetch('http://127.0.0.1:'+port+route)).json();const version=await get('/json/version');report.browser=version.Browser;browser=await connect(version.webSocketDebuggerUrl);
 const tab=await until(async()=>(await get('/json/list')).find(t=>t.type==='page'));page=await connect(tab.webSocketDebuggerUrl);
 await page.call('Runtime.enable');await page.call('Network.enable');
 page.event=m=>{if(m.method==='Network.requestWillBeSent')urls.set(m.params.requestId,m.params.request.url);if(m.method==='Runtime.exceptionThrown')report.errors.push({case:current,type:'runtime',message:m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text});if(m.method==='Network.loadingFailed'&&!m.params.canceled)report.errors.push({case:current,type:'resource',url:urls.get(m.params.requestId),message:m.params.errorText});};
 await page.call('Page.navigate',{url:settings.testUrl});
 await until(async()=>{assert.equal(report.errors.filter(e=>e.type==='runtime').length,0,'Startup error');return ev('!window.dispatchTest && !!window.CM?.loadGame && !!CM.CarPool');});
 await ev('('+install.toString()+')('+[JSON.stringify(originalDispatch),JSON.stringify(guards),JSON.stringify(observeRoadWorker.toString())].join(',')+')');
 // Keep game imports sequential in the same visible tab. Every side receives the same original envelope.
 const phases=reverseLarge?['quarter','year','boundary'].map(scenario=>{
   const first=previous.comparisons.find(c=>c.kind==='forced' && c.mapSize==='large' && c.scenario===scenario);
   assert.ok(first.exact && first.sameBlocks);
   return ['large',scenario,[...first.order].reverse()];
 }):[
   ['small','quarter',['WASM','JS']],['large','quarter',['JS','WASM']],
   ['small','year',['JS','WASM']],['large','year',['WASM','JS']],
   ['small','boundary',['JS','WASM']],['large','boundary',['WASM','JS']],
 ];
 const roomFor=(size,scenario)=>{
   if(reverseLarge)return previous.cases.filter(c=>c.mapSize===size&&c.scenario===scenario&&c.round===1&&c.variant!=='POLICY').reduce((total,c)=>total+c.caseWallMs,8000);
   const prior=report.cases.filter(c=>c.mapSize===size && c.scenario===scenario && c.timing);
   return prior.length ? Math.max(...prior.map(c=>c.caseWallMs))*2+4500 : 5000;
 };
 let policy=null;
 const simStamp=await ev('CM.SIM_STAMP');
 report.stampLoaded=simStamp;
 const policySets=[];
 const repeats=[];
 async function readPolicy(){
   const policyFile=cli['--policy']||'evidence/road-workers/dispatch-calibration/policy.json';
   let raw;
   try{raw=JSON.parse(await fs.readFile(policyFile,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}
   const actual=await fs.readFile('js/sim.js','utf8');
   assert.equal(actual,source.replace(originalDispatch,raw.guard),'Shipped source differs beyond approved dispatch change');
   const workerText=await fs.readFile('src-sim/road-worker.js','utf8');
   function actualBody(sim){
     const functions=sim.slice(sim.indexOf('  function carTree('),sim.indexOf('  // 道路图（随 roadData'));
     return new Function(workerText+'\n'+functions+'\nreturn [roadKernelWorker,carTree,carOriginRow,carWork,carWorkerMain];')().map(f=>f.toString());
   }
   const cols=actualBody(actual);
   const body='"use strict";\nconst INF = 1e30;\n'+cols.join('\n')+'\ncarWorkerMain();\n';
   assert.equal(body,report.workerSources.baseline.replace(originalDispatch,raw.guard),'Final on-disk generated Worker body differs');
   const stampDisk=await fs.readFile('js/sim-stamp.js','utf8');
   report.policy={guard:raw.guard,sourceSHA256:hash(actual),sourceBodySHA256:hash(body),stampLoaded:simStamp,stampOnDisk:stampDisk.trim()};
   guards.POLICY=raw.guard;
   await page.call('Page.reload',{ignoreCache:true});
   await until(()=>ev('!window.dispatchTest && !!window.CM?.loadGame && !!CM.CarPool'));
   const refreshedStamp=await ev('CM.SIM_STAMP');
   assert.ok(stampDisk.includes("'"+refreshedStamp+"'"));
   report.policy.stampReloaded=refreshedStamp;
   await ev('('+install.toString()+')('+[JSON.stringify(raw.guard),JSON.stringify(guards),JSON.stringify(observeRoadWorker.toString())].join(',')+')');
   return raw;
 }
 for(let phase=0;;phase++){
   if(reverseLarge && phase>=phases.length)break;
   if(phase===6){
     const candidates=report.comparisons.filter(c=>c.round===1 && c.exact);
     candidates.sort((a,b)=>Math.abs(a.pctLess)-Math.abs(b.pctLess));
     for(const c of candidates)if(c.mapSize==='small'||Math.abs(c.pctLess)<10)repeats.push([c.mapSize,c.scenario,[...c.order].reverse()]);
     policySets.push(['large','quarter',['POLICY']],['small','quarter',['POLICY']],['small','quarter',['POLICY'],'mobile'],['small','quarter',['POLICY'],'mobile-no-module']);
     report.forcedComplete=true;await write();
   }
   let chosen=phases[phase];
   if(!chosen){
     if(!policy && !repeats.length && cli['--policy'] && left()>30000)policy=await readPolicy();
     if(policy && policySets.length)chosen=policySets.shift();
     else if(repeats.length && !policy)chosen=repeats.shift();
     else if(!policy && cli['--policy'] && left()>32000){await sleep(1000);continue;}
     else break;
   }
   const [mapSize,scenario,variants,profile='desktop']=chosen;
   const policyCase=variants[0]==='POLICY';
   const round=reverseLarge?2:policyCase?1:1+report.comparisons.filter(c=>c.scenario===scenario&&c.mapSize===mapSize&&c.kind==='forced').length;
   if(left()<roomFor(mapSize,scenario)/(policyCase?2:1)){
     report.incomplete={mapSize,scenario,round,profile,reason:'Shared browser deadline approaching'};if(!reverseLarge && phase<6)break;continue;
   }
   if(profile.startsWith('mobile')){
     await until(()=>ev('CM.CarPool.release() && CM.OdPool.release() && CM.SkimPool.release()'));
     await page.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
     await page.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
     await ev("CM.CarPool.size=dispatchTest.roadSize;CM.RoadKernel.module="+(profile==='mobile-no-module'?'null':'dispatchTest.availableModule'));
   }
   const fixture=fixtures[mapSize],rows=[];
   for(const variant of variants){
     const caseStart=Date.now(),errStart=report.errors.length;
     current={mapSize,scenario,round,variant,profile};console.log('START',current,'remaining',left());
     await until(()=>ev('CM.CarPool.release()'));
     const token=[mapSize,scenario,round,variant,Date.now()].join('/');
     await ev('dispatchTest.variant='+JSON.stringify(variant)+';dispatchTest.token='+JSON.stringify(token)+';dispatchTest.bad=[];dispatchTest.records=null;CM.loadGame(CM.Save.parseEnvelope('+JSON.stringify(fixture.text)+').payload);true');
     await until(async()=>{assert.equal(report.errors.slice(errStart).filter(e=>e.type==='runtime').length,0,'Load error');return ev('!!CM.game && !CM.isLoading() && CM.game.speed===0 && CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && CM.R.sharpReady()');});
     await ev('CM.CarPool.ready() && CM.OdPool.ready() && CM.SkimPool.ready()');
     const check=await ev('({clock:{...CM.game.clock},stations:Object.keys(CM.game.net.stations).length,map:CM.game.mapId,road:CM.CarPool.list?.length,mode:CM.OdPool.list?.length,metro:CM.SkimPool.list?.length,off:[CM.CarPool.off,CM.OdPool.off,CM.SkimPool.off],source:dispatchTest.sources.at(-1),bad:dispatchTest.bad,coarse:matchMedia("(pointer: coarse)").matches,touch:navigator.maxTouchPoints,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,hasWasm:!!CM.RoadKernel.module})');
     const expectedPools=profile==='desktop'?[4,2,2]:[2,1,1];
     if(profile!=='desktop'){assert.ok(check.coarse && check.touch>0);assert.equal(check.hasWasm,profile!=='mobile-no-module');}
     assert.deepEqual(check.clock,fixture.info.clock);assert.equal(check.stations,fixture.info.stations);assert.equal(check.map,fixture.info.map);assert.deepEqual([check.road,check.mode,check.metro],expectedPools);assert.deepEqual(check.off,[false,false,false]);assert.deepEqual(check.bad,[]);
     const s=check.source;assert.equal(s.token,token);assert.equal(s.variant,variant);assert.equal(s.adjusted,s.baseline.replace(policyCase?policy.guard:originalDispatch,guards[variant]));
     report.workerSources??={};report.workerSources.baseline??=s.baseline;
     assert.equal(s.baseline,policyCase?report.workerSources.baseline.replace(originalDispatch,policy.guard):report.workerSources.baseline);
     report.workerSources[variant]=s.adjusted;check.workerSHA256=hash(s.adjusted);if(policyCase)assert.equal(check.workerSHA256,report.policy.sourceBodySHA256);delete check.source;
     if(reverseLarge)assert.equal(s.adjusted,previous.workerSources[variant]);
     await setScenario(scenario);
     const row={...current,token,check,before:await snapshot()};rows.push(row);report.cases.push(row);
     await ev('('+begin.toString()+')('+JSON.stringify(scenario)+')');await until(()=>ev('run.done>0'));
     await until(()=>ev('CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && !CM.game.pending'));
     const {timing,records}=await ev(`(()=>{const t=dispatchTest,r=run;r.stopVisibility();const captured=t.records;t.records=null;return {timing:{ms:r.done-(r.cross||r.start),hidden:r.hidden,months:r.months,paused:CM.game.speed===0,pools:[CM.CarPool.list?.length,CM.OdPool.list?.length,CM.SkimPool.list?.length],off:[CM.CarPool.off,CM.OdPool.off,CM.SkimPool.off],kernelBlocks:{WASM:CM.CarPool.stats.wasm-r.stats0.wasm,JS:CM.CarPool.stats.js-r.stats0.js},acks:t.acks,bad:t.bad},records:captured};})()`);
     row.timing=timing;
     const other=variant==='WASM'?'JS':'WASM';
     if(!policyCase)assert.ok(timing.kernelBlocks[variant]>0 && timing.kernelBlocks[other]===0);assert.equal(records.length,timing.kernelBlocks.JS+timing.kernelBlocks.WASM);if(profile==='mobile-no-module')assert.equal(timing.kernelBlocks.WASM,0);
     assert.deepEqual(timing.pools,expectedPools);assert.deepEqual(timing.off,[false,false,false]);assert.ok(!timing.hidden && timing.paused);
     assert.deepEqual(timing.bad,[]);assert.equal(Object.keys(timing.acks).length,expectedPools[0]);
     const wantWasm=variant==='WASM'?1:0;if(!policyCase)assert.ok(records.every(r=>r[3]===wantWasm));
     if(policyCase){
       const route=new Function('module','nt','n','G','return Boolean('+guards.POLICY+')');
       assert.ok(records.every(r=>Boolean(r[3])===route(check.hasWasm,r[8],r[7],{Z:r[4],nN:r[5],nA:r[6]})),'Actual routing differs from policy');
     }
     row.blocks=describeBlocks(records);
     row.blockFile=[mapSize,scenario,round,variant,profile,'blocks.json'].join('-');await fs.writeFile(path.join(output,row.blockFile),JSON.stringify({columns:['request','block','slot','wasm','zones','nodes','arcs','origins','targets','handlerMs'],records}));
     row.after=await snapshot();
     const first=row.before.clock,last=row.after.clock,months=scenario==='year'?12:scenario==='quarter'?3:1;
     assert.equal(timing.months,months);assert.equal((last.y-first.y)*12+last.m-first.m,months,'Incomplete game calendar interval');assert.equal(last.d,scenario==='boundary'?1:first.d);
     if(scenario==='boundary')assert.equal(last.minute,0);
     row.errors=report.errors.slice(errStart);assert.equal(row.errors.filter(e=>e.type==='runtime'||e.url?.startsWith(settings.testUrl)).length,0);
     row.caseWallMs=Date.now()-caseStart;
     console.log('DONE',current,Math.round(timing.ms),row.blocks.count,'blocks');await write();
   }
   const one=rows[0],two=rows[1]||report.cases.find(c=>c.variant==='JS'&&c.round===1&&c.mapSize===mapSize&&c.scenario===scenario);
   const diff=(a,b)=>Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
   const beforeDiff=diff(one.before,two.before),afterDiff=diff(one.after,two.after);
   const js=policyCase?two:rows.find(r=>r.variant==='JS'),wasm=policyCase?one:rows.find(r=>r.variant==='WASM');
   const pair={kind:policyCase?'policy-vs-forced-js':'forced',mapSize,scenario,round,profile,order:variants,jsMs:js.timing.ms,wasmMs:wasm.timing.ms,pctLess:100*(1-wasm.timing.ms/js.timing.ms),beforeDiff,afterDiff,exact:!beforeDiff.length&&!afterDiff.length,sameBlocks:js.blocks.count===wasm.blocks.count};
   report.comparisons.push(pair);await write();console.log('PAIR',pair);
   if(!pair.exact||!pair.sameBlocks)throw Error('Matched outputs or work diverged: '+JSON.stringify(pair));
   if(reverseLarge)for(const c of rows){
     const first=previous.cases.find(f=>f.mapSize===mapSize&&f.scenario===scenario&&f.variant===c.variant);
     assert.deepEqual(c.before,first.before);assert.deepEqual(c.after,first.after);
   }
 }
 if(reverseLarge && left()>1200){await ev('dispatchTest.restore();delete window.dispatchTest;true');report.productionPoolRestored=true;}
}catch(e){report.error=String(e);console.error(e);process.exitCode=1;}
finally{
 if(page&&left()>1000){try{report.final=await ev('({map:CM.game?.mapId,clock:{...CM.game?.clock},speed:CM.game?.speed,jumping:!!CM.game?.jumping,ready:CM.game?.model.trafficReady(),settled:CM.game?.model.settled,road:CM.CarPool.list?.length,variant:window.dispatchTest?.variant})');}catch(e){report.finalError=String(e);}}
 report.elapsedMs=Date.now()-started;await write();console.log('OUTPUT',output,report.elapsedMs);page?.close();browser?.close();
}
