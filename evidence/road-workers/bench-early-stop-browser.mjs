// One 120-second visible isolated-browser experiment. Source interception is test-only.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {candidateSource} from './early-stop.mjs';
const settings=JSON.parse(await fs.readFile('.agents/skills/metro-browser-check/test-settings.json'));
const save=await fs.readFile(settings.savePath,'utf8'),source=await fs.readFile('js/sim.js','utf8'),candidate=candidateSource(source);
const hash=s=>createHash('sha256').update(s).digest('hex');
const output=await fs.mkdtemp(path.resolve('evidence/road-workers/early-stop-browser-'));
const report={saveSHA256:hash(save),sourceSHA256:hash(source),candidateSHA256:hash(candidate),cases:[],errors:[],comparisons:[],fulfilments:[],budgetSeconds:120};
const write=()=>fs.writeFile(output+'/results.json',JSON.stringify(report,null,2));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let browser,page,variant='base',currentCase=null,caseToken='initial';
const requests=new Map();
const started=Date.now(),deadline=started+120000;
report.startedAt=new Date(started).toISOString();
function remaining(){return deadline-Date.now();}
async function until(check){while(remaining()>4500){const r=await check();if(r)return r;await pause(80);}throw Error('120-second browser budget reached');}
async function connect(url){
  const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const pending=new Map();let seq=0;
  const api={close:()=>ws.close(),event:()=>{},call:(method,params={})=>new Promise((r,j)=>{
    const id=++seq,timer=setTimeout(()=>{pending.delete(id);j(Error(method+' timeout'));},Math.max(1,Math.min(8000,remaining()-200)));
    pending.set(id,m=>{clearTimeout(timer);pending.delete(id);m.error?j(Error(JSON.stringify(m.error))):r(m.result);});ws.send(JSON.stringify({id,method,params}));
  })};
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id)pending.get(m.id)?.(m);else api.event(m);};return api;
}
async function ev(expression){const r=await page.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function snapshot(){return ev(`(async()=>{
  const g=CM.game,m=g.model,hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a)),x=>x.toString(16).padStart(2,'0')).join('');
  const arrays={};for(const dt of ['wd','we'])for(const [i,p]of m.ctxs[dt].per.entries())for(const [k,v]of Object.entries(p))if(ArrayBuffer.isView(v))arrays[dt+i+'.'+k]={type:v.constructor.name,length:v.length,hash:await hash(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))};
  return {clock:{...g.clock},metrics:g.snapshotMetrics(),arrays,ledger:await hash(new TextEncoder().encode(JSON.stringify(g.econ.ledger)))};
})()`);}
try{
  assert.equal((await fetch(settings.testUrl+'js/sim.js')).status,200);
  assert.equal(await(await fetch(settings.testUrl+'js/sim.js')).text(),source,'Preview source mismatch');
  await fs.access(settings.browserExecutable);
  const profile=process.argv[2]||await fs.mkdtemp(path.join(tmpdir(),'metro-early-stop-'));report.profile=profile;report.reusedProfile=!!process.argv[2];
  if(!process.argv[2])spawn(settings.browserExecutable,['--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check',settings.testUrl],{detached:true,stdio:'ignore'}).unref();
  const port=await until(async()=>{try{return(await fs.readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];}catch{}});
  const get=async route=>(await fetch('http://127.0.0.1:'+port+route)).json();
  const version=await get('/json/version');report.browser=version.Browser;browser=await connect(version.webSocketDebuggerUrl);
  const tab=await until(async()=>(await get('/json/list')).find(t=>t.url.startsWith(settings.testUrl)));page=await connect(tab.webSocketDebuggerUrl);
  await page.call('Runtime.enable');await page.call('Network.enable');await page.call('Network.setCacheDisabled',{cacheDisabled:true});
  page.event=m=>{
    if(m.method==='Fetch.requestPaused'){
      const v=variant,s=v==='fast'?candidate:source,h=hash(s);
      const token=caseToken;
      page.call('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/javascript'},{name:'Cache-Control',value:'no-store'}],body:Buffer.from(s+'\n;window.__roadExperimentSourceHash='+JSON.stringify(h)+';window.__roadExperimentCase='+JSON.stringify(token)+';').toString('base64')}).then(()=>report.fulfilments.push({variant:v,hash:h,token,case:currentCase})).catch(e=>report.errors.push({case:currentCase,type:'interception',message:String(e)}));
    }
    if(m.method==='Network.requestWillBeSent')requests.set(m.params.requestId,m.params.request.url);
    if(m.method==='Runtime.exceptionThrown')report.errors.push({case:currentCase,type:'runtime',message:m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text});
    if(m.method==='Network.loadingFailed'&&!m.params.canceled)report.errors.push({case:currentCase,type:'resource',url:requests.get(m.params.requestId),message:m.params.errorText});
  };
  await page.call('Fetch.enable',{patterns:[{urlPattern:'*://localhost:8001/js/sim.js*',requestStage:'Request'}]});
  const cases=[];
  for(let round=1;round<=3;round++)for(const v of(round%2?['base','fast']:['fast','base']))cases.push({scenario:'quarter',round,variant:v});
  for(const v of['fast','base'])cases.push({scenario:'boundary',round:1,variant:v});
  for(const item of cases){
    if(remaining()<25000){report.incomplete='Remaining cases skipped to preserve browser within120seconds';break;}
    variant=item.variant;currentCase=item;caseToken=JSON.stringify(item)+'-'+Date.now();const errorStart=report.errors.length;console.log('START',item,'remaining',remaining());
    await page.call('Page.reload',{ignoreCache:true});
    await until(async()=>{assert.equal(report.errors.slice(errorStart).filter(e=>e.type==='runtime'||e.type==='interception').length,0,'Startup script error');return ev('window.__roadExperimentCase==='+JSON.stringify(caseToken)+' && !!window.CM?.loadGame && !!CM.Save?.parseEnvelope');});
    assert.equal(await ev('window.__roadExperimentSourceHash'),hash(variant==='fast'?candidate:source),'Executed source marker mismatch');
    await ev(`CM.CarPool.size=()=>4;CM.Settings.set('autosave',false);CM.loadGame(CM.Save.parseEnvelope(${JSON.stringify(save)}).payload);true`);
    await until(()=>ev('!!CM.game && !CM.isLoading() && CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && CM.R.sharpReady()'));
    const check=await ev('({clock:{...CM.game.clock},stations:Object.keys(CM.game.net.stations).length,map:CM.game.mapId,road:CM.CarPool.list?.length,mode:CM.OdPool.list?.length,metro:CM.SkimPool.list?.length})');
    assert.equal(check.map,'sh');assert.equal(check.stations,121);assert.equal(check.road,4);assert.equal(check.mode,2);assert.equal(check.metro,2);
    if(item.scenario==='boundary')await ev(`(()=>{const g=CM.game;while(g.clock.d<CM.U.daysInMonth(g.clock.y,g.clock.m)){if(g.endDay())throw Error('unexpected month crossed');}g.clock.minute=1439;return true;})()`);
    const row={...item,check,before:await snapshot()};report.cases.push(row);
    await ev(`(()=>{
      const g=CM.game;window.run={start:performance.now(),done:0,crossStart:0,hidden:document.hidden,months:0};document.addEventListener('visibilitychange',()=>{if(document.hidden)run.hidden=true});g.on('month',()=>run.months++);
      if('${item.scenario}'==='quarter'){
        g.on('jumpDone',()=>run.done=performance.now());const b=document.querySelector('[data-act="jumpQuarter"]');if(!b)throw Error('quarter button absent');b.click();if(!g.jumping||g.jumping.months!==3)throw Error('quarter jump rejected');
      }else{
        const end=g.endDay;g.endDay=function(){run.crossStart=performance.now();const crossed=end.call(this);if(crossed){this.setSpeed(0);delete this.endDay;}return crossed;};
        const tick=g.update;g.update=function(...args){const r=tick.apply(this,args);if(run.crossStart&&!this.pending&&!this.jumping&&this.model.trafficReady()&&this.model.settled&&!this.model.hasReviewWork()&&!this.taskRecheckYM){run.done=performance.now();delete this.update;}return r;};g.setSpeed(1);
      }return true;
    })()`);
    await until(()=>ev('run.done>0'));
    row.timing=await ev('({ms:run.crossStart?run.done-run.crossStart:run.done-run.start,months:run.months,hidden:run.hidden,road:CM.CarPool.list.length,off:CM.CarPool.off,wasm:CM.CarPool.stats.wasm,js:CM.CarPool.stats.js,paused:CM.game.speed===0})');
    assert.equal(row.timing.hidden,false);assert.equal(row.timing.off,false);assert.equal(row.timing.road,4);
    await until(()=>ev('CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && !CM.game.pending'));
    row.after=await snapshot();
    row.errors=report.errors.slice(errorStart);
    assert.equal(row.errors.filter(e=>e.type==='runtime'||e.type==='interception'||(e.type==='resource'&&e.url?.startsWith(settings.testUrl))).length,0,'Runtime/local resource error invalidates this case');
    const peer=report.cases.find(c=>c!==row&&c.scenario===row.scenario&&c.round===row.round&&c.after);
    if(peer){assert.deepEqual(row.before,peer.before);assert.deepEqual(row.after,peer.after);report.comparisons.push({scenario:row.scenario,round:row.round,exact:true,arrays:Object.keys(row.after.arrays).length});}
    console.log('DONE',item,row.timing.ms,'exact pairs',report.comparisons.length);await write();
  }
}catch(e){report.error=String(e);console.error(e);process.exitCode=1;}
finally{
  if(page&&remaining()>1000){try{report.final=await ev('({map:CM.game?.mapId,clock:{...CM.game?.clock},speed:CM.game?.speed,jumping:!!CM.game?.jumping,ready:CM.game?.model.trafficReady(),settled:CM.game?.model.settled,road:CM.CarPool.list?.length})');const shot=await page.call('Page.captureScreenshot',{format:'png'});await fs.writeFile(output+'/final.png',Buffer.from(shot.data,'base64'));}catch(e){report.finalError=String(e);}}
  report.elapsedMs=Date.now()-started;await write();console.log('OUTPUT',output,'elapsed',report.elapsedMs);page?.close();browser?.close();
}
