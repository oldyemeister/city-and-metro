// Visible isolated Chrome; one120second budget. Load game code once; change only road Worker source.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {originalChildRead,cachedChildRead,candidateSource} from './child-read.mjs';
const settings=JSON.parse(await fs.readFile('.agents/skills/metro-browser-check/test-settings.json'));
const save=await fs.readFile(settings.savePath,'utf8'),payload=JSON.parse(JSON.parse(save).body),source=await fs.readFile('js/sim.js','utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const output=await fs.mkdtemp(path.resolve('evidence/road-workers/child-read-browser-'));
const report={sourceSHA256:hash(source),candidateSHA256:hash(candidateSource(source)),saveSHA256:hash(save),cases:[],comparisons:[],errors:[],budgetSeconds:120};
const write=()=>fs.writeFile(output+'/results.json',JSON.stringify(report,null,2));
let browser,page,current=null;const urls=new Map();
const started=Date.now(),deadline=started+120000;report.startedAt=new Date(started).toISOString();
const left=()=>deadline-Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check){while(left()>4000){const v=await check();if(v)return v;await sleep(50);}throw Error('120-second browser budget reached');}
async function connect(url){
  const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let seq=0;const pending=new Map();
  const api={close:()=>ws.close(),event:()=>{},call:(method,params={})=>new Promise((r,j)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);j(Error(method+' timeout'));},Math.max(1,Math.min(8000,left()-300)));pending.set(id,m=>{clearTimeout(timer);pending.delete(id);m.error?j(Error(JSON.stringify(m.error))):r(m.result);});ws.send(JSON.stringify({id,method,params}));})};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id)pending.get(m.id)?.(m);else api.event(m);};return api;
}
async function ev(expression){const r=await page.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function snapshot(){return ev(`(async()=>{
 const g=CM.game,m=g.model,hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join(''),textHash=o=>hash(new TextEncoder().encode(JSON.stringify(o)));
 const arrays={},periodStats={};for(const dt of ['wd','we'])for(const[i,p]of m.ctxs[dt].per.entries()){
  for(const[k,v]of Object.entries(p))if(ArrayBuffer.isView(v))arrays[dt+i+'.'+k]={type:v.constructor.name,length:v.length,sha256:await hash(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))};
  periodStats[dt+i]={stats:p.stats,error:p.error,iters:p.iters,solveSteps:p.solveSteps};
 }
 return{clock:{...g.clock},metrics:g.snapshotMetrics(),arrays,periodStats,economy:g.econ.serialize(),ledgerSHA256:await textHash(g.econ.ledger),networkSHA256:await textHash(g.net)};
})()`);}
try{
 assert.equal(await(await fetch(settings.testUrl+'js/sim.js')).text(),source,'Preview mismatch');await fs.access(settings.browserExecutable);
 const profile=await fs.mkdtemp(path.join(tmpdir(),'metro-child-read-'));report.profile=profile;
 spawn(settings.browserExecutable,['--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check','about:blank'],{detached:true,stdio:'ignore'}).unref();
 const port=await until(async()=>{try{return(await fs.readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];}catch{}});
 const get=async route=>(await fetch('http://127.0.0.1:'+port+route)).json();const version=await get('/json/version');report.browser=version.Browser;browser=await connect(version.webSocketDebuggerUrl);
 const tab=await until(async()=>(await get('/json/list')).find(t=>t.type==='page'));page=await connect(tab.webSocketDebuggerUrl);
 await page.call('Runtime.enable');await page.call('Network.enable');
 page.event=m=>{if(m.method==='Network.requestWillBeSent')urls.set(m.params.requestId,m.params.request.url);if(m.method==='Runtime.exceptionThrown')report.errors.push({case:current,type:'runtime',message:m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text});if(m.method==='Network.loadingFailed'&&!m.params.canceled)report.errors.push({case:current,type:'resource',url:urls.get(m.params.requestId),message:m.params.errorText});};
 await page.call('Page.navigate',{url:settings.testUrl});
 await until(async()=>{assert.equal(report.errors.filter(e=>e.type==='runtime').length,0,'Startup error');return ev('!!window.CM?.loadGame && !!CM.CarPool');});
 await ev(`(()=>{
  const NativeBlob=window.Blob,done=CM.CarPool.done;
  window.childReadTest={variant:'old',token:'',sources:[],acks:{},bad:[],old:${JSON.stringify(originalChildRead)},fresh:${JSON.stringify(cachedChildRead)}};
  window.Blob=class extends NativeBlob{constructor(parts,opts){
   const t=window.childReadTest;let actual=parts;
   if(parts.length===1&&typeof parts[0]==='string'&&parts[0].includes('function carTree(')){
    let s=parts[0];if(s.split(t.old).length!==2)throw Error('Unexpected road source');
    if(t.variant==='new')s=s.replace(t.old,t.fresh);
    t.sources.push({variant:t.variant,token:t.token,source:s});
    const marker=JSON.stringify(t.token);
    actual=[s+';(()=>{const send=self.postMessage.bind(self);self.postMessage=(m,transfer)=>{if(m&&m.req!==undefined)m.__childReadCase='+marker+';return send(m,transfer);};})();'];
   }super(actual,opts);
  }};
  CM.CarPool.done=function(slot,m){const t=window.childReadTest;if(!m.stale&&m.req!==undefined){if(m.__childReadCase!==t.token)t.bad.push({expected:t.token,actual:m.__childReadCase});const i=this.list.indexOf(slot);t.acks[i]=(t.acks[i]||0)+1;delete m.__childReadCase;}return done.call(this,slot,m);};
  CM.CarPool.size=()=>4;CM.Settings.set('autosave',false);return true;
 })()`);
 const groups=[{scenario:'quarter',round:1,variants:['old','new'],reserve:44},{scenario:'quarter',round:2,variants:['new','old'],reserve:44},{scenario:'boundary',round:1,variants:['old','new'],reserve:28}];
 for(const group of groups){
  if(left()<group.reserve*1000){report.incomplete='Remaining paired scenarios skipped within120second budget';break;}
  for(const variant of group.variants){
   current={scenario:group.scenario,round:group.round,variant};const errStart=report.errors.length;console.log('START',current,'remaining',left());
   await until(()=>ev('CM.CarPool.release()'));
   const token=JSON.stringify(current)+'-'+Date.now();
   await ev(`childReadTest.variant=${JSON.stringify(variant)};childReadTest.token=${JSON.stringify(token)};childReadTest.acks={};childReadTest.bad=[];CM.loadGame(CM.Save.parseEnvelope(${JSON.stringify(save)}).payload);true`);
   await until(async()=>{assert.equal(report.errors.slice(errStart).filter(e=>e.type==='runtime').length,0,'Load error');return ev('!!CM.game && !CM.isLoading() && CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && CM.R.sharpReady()');});
   const check=await ev('({clock:{...CM.game.clock},stations:Object.keys(CM.game.net.stations).length,map:CM.game.mapId,road:CM.CarPool.list?.length,mode:CM.OdPool.list?.length,metro:CM.SkimPool.list?.length,off:CM.CarPool.off,bad:childReadTest.bad,source:childReadTest.sources.at(-1)})');
   assert.deepEqual(check.clock,payload.clock);assert.equal(check.stations,121);assert.equal(check.map,'sh');assert.equal(check.road,4);assert.equal(check.mode,2);assert.equal(check.metro,2);assert.equal(check.off,false);assert.deepEqual(check.bad,[]);assert.equal(check.source.token,token);assert.equal(check.source.variant,variant);
   report.workerSources??={};report.workerSources[variant]=check.source.source;
   if(report.workerSources.old&&report.workerSources.new)assert.equal(report.workerSources.new,candidateSource(report.workerSources.old),'Actual road Worker source differs beyond child-read patch');
   check.sourceSHA256=hash(check.source.source);delete check.source;
   if(group.scenario==='boundary')await ev(`(()=>{const g=CM.game;while(g.clock.d<CM.U.daysInMonth(g.clock.y,g.clock.m)){if(g.endDay())throw Error('setup crossed month');}g.clock.minute=1439;return true;})()`);
   const row={...current,token,check,before:await snapshot()};report.cases.push(row);
   await ev(`(()=>{const g=CM.game;window.run={start:performance.now(),cross:0,done:0,hidden:document.hidden,months:0};document.addEventListener('visibilitychange',()=>{if(document.hidden)run.hidden=true});g.on('month',()=>run.months++);
    if('${group.scenario}'==='quarter'){g.on('jumpDone',()=>run.done=performance.now());document.querySelector('[data-act="jumpQuarter"]').click();if(g.jumping?.months!==3)throw Error('quarter rejected');}
    else{const end=g.endDay;g.endDay=function(){run.cross=performance.now();const r=end.call(this);if(r){this.setSpeed(0);delete this.endDay;}return r;};const update=g.update;g.update=function(...a){const r=update.apply(this,a);if(run.cross&&!this.pending&&!this.jumping&&this.model.trafficReady()&&this.model.settled&&!this.model.hasReviewWork()&&!this.taskRecheckYM){run.done=performance.now();delete this.update;}return r;};g.setSpeed(1);}return true;})()`);
   await until(()=>ev('run.done>0'));
   row.timing=await ev('({ms:run.done-(run.cross||run.start),hidden:run.hidden,months:run.months,road:CM.CarPool.list.length,off:CM.CarPool.off,paused:CM.game.speed===0,acks:{...childReadTest.acks},bad:childReadTest.bad})');
   assert.equal(row.timing.road,4);assert.equal(row.timing.off,false);assert.equal(row.timing.hidden,false);assert.equal(row.timing.paused,true);assert.deepEqual(row.timing.bad,[]);assert.equal(Object.keys(row.timing.acks).length,4);
   await until(()=>ev('CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && !CM.game.pending'));
   row.after=await snapshot();row.errors=report.errors.slice(errStart);assert.equal(row.errors.filter(e=>e.type==='runtime'||e.url?.startsWith(settings.testUrl)).length,0,'Case error');
   const peer=report.cases.find(c=>c!==row&&c.scenario===row.scenario&&c.round===row.round&&c.after);
   if(peer){assert.deepEqual(row.before,peer.before,'Starting outputs differ');assert.deepEqual(row.after,peer.after,'Ending outputs differ');report.comparisons.push({scenario:row.scenario,round:row.round,exact:true,arrays:Object.keys(row.after.arrays).length,metrics:Object.keys(row.after.metrics).length});}
   console.log('DONE',current,row.timing.ms,'pairs',report.comparisons.length);await write();
  }
 }
}catch(e){report.error=String(e);console.error(e);process.exitCode=1;}
finally{
 if(page&&left()>1000){try{report.final=await ev('({map:CM.game?.mapId,clock:{...CM.game?.clock},speed:CM.game?.speed,jumping:!!CM.game?.jumping,ready:CM.game?.model.trafficReady(),settled:CM.game?.model.settled,road:CM.CarPool.list?.length,variant:window.childReadTest?.variant})');const shot=await page.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(output+'/final.png',Buffer.from(shot.data,'base64'));}catch(e){report.finalError=String(e);}}
 report.elapsedMs=Date.now()-started;await write();console.log('OUTPUT',output,report.elapsedMs);page?.close();browser?.close();
}
