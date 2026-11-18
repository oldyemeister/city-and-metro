import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const settings = JSON.parse(await fs.readFile('.agents/skills/metro-browser-check/test-settings.json','utf8'));
const source = await fs.readFile('js/sim.js', 'utf8'), embedded = await fs.readFile('js/road-kernel.js','utf8');
const guard = 'module && nt >= n * G.Z * 0.10';
assert.equal(source.split(guard).length, 2);
const hash = data => createHash('sha256').update(data).digest('hex');
const fixture = await fs.readFile('savedgames/test/Shanghai-2010-01-278.cmsave.json','utf8');
assert.equal(hash(fixture),'f6027c5bbbd9aff5c4dcb850f846a0ce5ca45ee75638cce3e38c5fd26827c7f2');
const output = await fs.mkdtemp(path.resolve('evidence/road-workers/dispatch-validation/fare-browser-'));
const previous = process.argv[2] ? JSON.parse(await fs.readFile(process.argv[2],'utf8')) : null;
const started = previous ? Date.parse(previous.startedAt) : Date.now(), deadline = started+120000;
const report = {startedAt:new Date(started).toISOString(),budgetMs:120000,sourceSHA256:hash(source),fixtureSHA256:hash(fixture),cases:[],errors:[]};
const write = () => fs.writeFile(output+'/results.json',JSON.stringify(report,null,2));
let browser,page,current;
const urls = new Map();
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

function observeFare() {
  const g = CM.game, m = g.model, ui = CM.ui;
  const undo = [], now = () => performance.now();
  const pools = {road:CM.CarPool, mode:CM.OdPool, metro:CM.SkimPool};
  const intervals = [], begins = new Map(), roadDensities = [], blockCounts = {road:0,mode:0,metro:0};
  const slotCounts = {road:{},mode:{},metro:{}};
  const before = {fare:{...g.econ.fare},clock:{...g.clock},cycles:m.cycles,road:{...CM.CarPool.stats}};
  const banner = () => ui.banner.textContent.includes('交通数据正在更新');
  if (!m.settled || !m.trafficReady() || banner() || g.speed) throw Error('Invalid initial scene');
  const marks = {}, frames = [];
  let hidden = document.hidden, frameId, lastFrame, stepTime = 0, maxStep = 0;
  const visibility = () => { hidden ||= document.hidden; };
  document.addEventListener('visibilitychange',visibility);
  const markBanner = () => {
    if (banner()) marks.bannerAppeared ??= now();
    else if (marks.bannerAppeared) marks.bannerCleared ??= now();
  };
  const watcher = new MutationObserver(markBanner);
  watcher.observe(ui.banner,{childList:true,subtree:true,characterData:true});
  const wrap = (obj,key,fn) => {
    const original = obj[key], own = Object.hasOwn(obj,key);
    obj[key] = fn(original);
    undo.push(() => { if (own) obj[key] = original; else delete obj[key]; });
  };
  for (const [name,pool] of Object.entries(pools)) {
    const methods = name === 'metro' ? ['submit','submitLoad'] : ['submit'];
    for (const key of methods) wrap(pool,key,original => function(...args) {
      const at = now();
      if(name==='road') {
        const [G,,blocks]=args;
        for(const b of blocks) if(b.origins.length) roadDensities.push(b.tDest.length/(b.origins.length*G.Z));
      }
      const req = original.apply(this,args);
      begins.set(name+'/'+req.id,{pool:name,method:key,id:req.id,at});
      return req;
    });
    wrap(pool,'done',original => function(slot,msg) {
      const entry = begins.get(name+'/'+msg.req);
      const req = name==='road' ? pool.reqs.get(msg.req) : name==='metro' ? slot.job?.req : slot.req;
      const val = original.call(this,slot,msg);
      if (entry) {
        blockCounts[name]++;
        const idx = pool.list.indexOf(slot);
        slotCounts[name][idx] = (slotCounts[name][idx] || 0) + 1;
        if (name==='road' ? req.remaining===0 : req.done) {
          intervals.push({...entry,end:now()});
          begins.delete(name+'/'+msg.req);
        }
      }
      return val;
    });
  }
  wrap(m,'finishTraffic',original => function(...args) {
    const result=original.apply(this,args);
    if (marks.start!==undefined && this.settled && this.trafficReady()) marks.settled ??= now();
    return result;
  });
  wrap(m,'step',original => function(...args) {
    const at=now(), result=original.apply(this,args), ms=now()-at;
    if (marks.start!==undefined && at<(marks.settled ?? Infinity)) {
      stepTime+=ms;
      maxStep=Math.max(maxStep,ms);
    }
    return result;
  });
  function frame(t) {
    if (marks.settled===undefined || t<=marks.settled) {
      if (lastFrame!==undefined) frames.push(t-lastFrame);
      lastFrame=t;
      frameId=requestAnimationFrame(frame);
    }
  }
  function undoAll() {
    for (const restore of undo.splice(0).reverse()) restore();
    watcher.disconnect();
    cancelAnimationFrame(frameId);
    document.removeEventListener('visibilitychange',visibility);
  }
  const probe = window.fareProbe = {marks,cleanup:undoAll,finish() {
    undoAll();
    const stats = { ...CM.CarPool.stats };
    return {before,after:{fare:{...g.econ.fare},clock:{...g.clock},cycles:m.cycles,settled:m.settled,ready:m.trafficReady(),
      review:m.hasReviewWork(),queues:[...Object.values(pools)].map(p=>p.queue.length)},
      marks:{...marks},hidden,frameGaps:frames,stepTime,maxStep,intervals,roadDensities,blockCounts,slotCounts,unfinished:begins.size,
      roadBlocks:{js:stats.js-before.road.js,wasm:stats.wasm-before.road.wasm}};
  }};
  const route=g.compiled.routes.find(r=>!r.svc && r.stIds.length>=10 && (g.net.lines[r.lineId].svcs||[]).length<CM.Fleet.MAX_SERVICES);
  ui.showServiceEditor(route.lineId);
  const apply=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='加开' && !b.disabled);
  if(!apply) throw Error('Missing enabled express service button');
  frameId=requestAnimationFrame(frame);
  marks.start=now();apply.click();marks.unsettled=now();
  if(m.settled || g.netVersion<1)throw Error('Service creation failed');
  return {clock:g.clock,netVersion:g.netVersion,fare:g.econ.fare};
}

async function loadFixture() {
  await ev('CM.loadGame(CM.Save.parseEnvelope('+JSON.stringify(fixture)+').payload);true');
  await until(()=>ev('!!CM.game && !CM.isLoading() && CM.game.speed===0 && CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork()'));
}
const scene = () => ev('({map:CM.game?.mapId,clock:CM.game?.clock,stations:Object.keys(CM.game?.net.stations??{}).length, speed:CM.game?.speed,ready:CM.game?.model.trafficReady(),settled:CM.game?.model.settled, banner:CM.ui.banner?.textContent,pools:[CM.CarPool,CM.OdPool,CM.SkimPool].map(p=>p.list?.length),off:[CM.CarPool,CM.OdPool,CM.SkimPool].map(p=>p.off),fare:CM.game?.econ.fare,hidden:document.hidden})');
function summarize(measurement) {
  const {marks,intervals,frameGaps}=measurement;
  const union=rows=>{
    let duration=0,end=-Infinity;
    for(const {at,end:done} of [...rows].sort((a,b)=>a.at-b.at)) {
      duration+=Math.max(0,done-Math.max(end,at)); end=Math.max(end,done);
    }
    return duration;
  };
  const stage={};
  for(const name of ['road','mode','metro']) {
    const rows=intervals.filter(r=>r.pool===name);
    stage[name]={requests:rows.length,blocks:measurement.blockCounts[name],occupiedUnionMs:union(rows)};
  }
  const sorted=[...frameGaps].sort((a,b)=>a-b);
  const densities=measurement.roadDensities;
  const atLeast=cut=>densities.filter(r=>r>=cut).length;
  return {actionToSettledMs:marks.settled-marks.start,bannerMs:marks.bannerCleared-marks.bannerAppeared,
    roadDensity:{min:Math.min(...densities),max:Math.max(...densities),below10:densities.length-atLeast(.10),
      from10to11:atLeast(.10)-atLeast(.11),from11to75:atLeast(.11)-atLeast(.75),atLeast75:atLeast(.75)},
    appearedAfterActionMs:marks.bannerAppeared-marks.start,clearedAfterSettledMs:marks.bannerCleared-marks.settled,
    workerRequestOccupiedMs:union(intervals),stage,frames:sorted.length,frameP95Ms:sorted[Math.ceil(.95*sorted.length)-1],frameMaxMs:sorted.at(-1),
    framesOver50Ms:sorted.filter(ms=>ms>50).length,framesOver100Ms:sorted.filter(ms=>ms>100).length,mainModelStepMs:measurement.stepTime};
}
try {
 let preview;
 try{preview=await fetch(settings.testUrl+'js/sim.js');}catch(e){
  if(e.cause?.code!=='ECONNREFUSED' && !(e.cause?.errors?.length && e.cause.errors.every(v=>v.code==='ECONNREFUSED')))throw e;
  const server=spawn('python3',['-m','http.server','8001','--bind','127.0.0.1'],{detached:true,stdio:'ignore'}); server.unref();
  await until(async()=>{try{preview=await fetch(settings.testUrl+'js/sim.js');return true;}catch{return false;}});
 }
 assert.equal(await preview.text(),source,'Preview mismatch');assert.equal(await(await fetch(settings.testUrl+'js/road-kernel.js')).text(),embedded,'Preview WASM mismatch');await fs.access(settings.browserExecutable);
 const profile=previous?.profile??await fs.mkdtemp(path.join(tmpdir(),'metro-fare-observe-'));report.profile=profile;
 if(!previous)spawn(settings.browserExecutable,['--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check','about:blank'],{detached:true,stdio:'ignore'}).unref();
 const port=await until(async()=>{try{return(await fs.readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];}catch{}});
 const get=async route=>(await fetch('http://127.0.0.1:'+port+route)).json();const version=await get('/json/version');report.browser=version.Browser;browser=await connect(version.webSocketDebuggerUrl);
 const tab=await until(async()=>(await get('/json/list')).find(t=>t.type==='page'));page=await connect(tab.webSocketDebuggerUrl);
 await page.call('Runtime.enable');await page.call('Network.enable');
 page.event=m=>{
   if(m.method==='Network.requestWillBeSent')urls.set(m.params.requestId,m.params.request.url);
   if(m.method==='Runtime.exceptionThrown')report.errors.push({case:current,type:'runtime',message:m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text});
   if(m.method==='Runtime.consoleAPICalled' && m.params.type==='error')report.errors.push({case:current,type:'runtime',message:m.params.args.map(a=>a.description||String(a.value)).join(' ')});
   if(m.method==='Network.loadingFailed'&&!m.params.canceled)report.errors.push({case:current,type:'resource',url:urls.get(m.params.requestId),message:m.params.errorText});
 };
 await page.call('Page.navigate',{url:settings.testUrl});
 await until(async()=>{assert.equal(report.errors.filter(e=>e.type==='runtime').length,0,'Startup error');return ev('!window.dispatchTest && !!window.CM?.loadGame && !!CM.CarPool');});
 await ev(`window.fareDispatch={native:window.Blob,mode:'JS',sources:[]};
 window.Blob=class extends fareDispatch.native{constructor(parts,opts){if(typeof parts[0]==='string'&&parts[0].includes('function carTree(')){
 const original=parts[0];if(original.split(${JSON.stringify(guard)}).length!==2)throw Error('Unexpected road Worker source');
 const adjusted=fareDispatch.mode==='JS'?original.replace(${JSON.stringify(guard)},'false && module'):original;
 fareDispatch.sources.push({mode:fareDispatch.mode,original,adjusted});parts=[adjusted];}super(parts,opts);}};
 CM.Settings.set('autosave',false);true`);
 for(const variant of ['policy10','JS']) {
   if(left()<21000 && report.cases.length)break;
   current=variant;
   await until(()=>ev('CM.CarPool.release() && CM.OdPool.release() && CM.SkimPool.release()'));
   await ev('fareDispatch.mode='+JSON.stringify(variant));
   await loadFixture();
   await ev('CM.CarPool.ready() && CM.OdPool.ready() && CM.SkimPool.ready()');
   const sources=await ev('fareDispatch.sources.at(-1)');
   assert.equal(sources.mode,variant);
   assert.equal(sources.adjusted,variant==='JS'?sources.original.replace(guard,'false && module'):sources.original);
   const check=await scene();
   assert.equal(check.map,'sh');assert.equal(check.stations,278);assert.deepEqual(check.pools,[4,2,2]);assert.deepEqual(check.off,[false,false,false]);
   const row={variant,check,workerSHA256:hash(sources.adjusted),productionWorkerSHA256:hash(sources.original),before:await snapshot()};
   report.cases.push(row);await write();
   row.action=await ev('('+observeFare.toString()+')()');console.log('FARE',variant,row.action);
   await until(()=>ev('!!fareProbe.marks.settled && !!fareProbe.marks.bannerCleared'));
   row.measurement=await ev('fareProbe.finish()');
   row.summary=summarize(row.measurement);
   row.after=await snapshot();
   await write();
   assert.ok(!row.measurement.hidden && row.measurement.after.ready && row.measurement.after.settled && !row.measurement.after.review);
   assert.ok(variant==='JS' ? row.measurement.roadBlocks.js>0 && !row.measurement.roadBlocks.wasm : row.measurement.roadBlocks.wasm>0);
   assert.deepEqual(row.measurement.after.queues,[0,0,0]);assert.equal(row.measurement.unfinished,0);
   assert.equal(Object.keys(row.measurement.slotCounts.road).length,4);assert.notEqual(row.before.networkSHA256,row.after.networkSHA256);
   console.log('MEASURED',variant,row.summary);
 }
 if(report.cases.length!==2) throw Error("No time for second variant");
 const [one,two]=report.cases;
 report.parity={before:Object.keys(one.before).filter(k=>JSON.stringify(one.before[k])!==JSON.stringify(two.before[k])),
 after:Object.keys(one.after).filter(k=>JSON.stringify(one.after[k])!==JSON.stringify(two.after[k]))};
 assert.deepEqual(report.parity,{before:[],after:[]});
 assert.equal(one.productionWorkerSHA256,two.productionWorkerSHA256);
 assert.deepEqual(one.measurement.blockCounts,two.measurement.blockCounts);
 if(left()>20000) {
   await ev('window.Blob=fareDispatch.native;true');
   await loadFixture();
   report.originalRestored=true;
 }
 assert.equal(report.errors.filter(e=>e.type==='runtime'||e.url?.startsWith(settings.testUrl)).length,0);
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;}
finally{
 if(page && left()>1800)try{
   await ev('if(window.fareProbe)fareProbe.cleanup();if(window.fareDispatch)window.Blob=fareDispatch.native;if(CM.game)CM.game.setSpeed(0);true');
   report.final=await scene();
 }catch(e){report.finalError=String(e);}
 report.elapsedMs=Date.now()-started;
 await write();
 console.log('REPORT',output,report.elapsedMs);
 page?.close();browser?.close();
}
