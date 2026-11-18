// Run from the repository root with the local Shanghai 2010 export.
// Real engine and Worker Blob bodies; Node worker_threads supplies the browser Worker transport.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
import {setTimeout as pause} from 'node:timers/promises';
import {Worker as Thread} from 'node:worker_threads';

const save = process.argv[2] || 'savedgames/test/Shanghai-2010-01-278.cmsave.json';
const output = process.argv[3] || 'evidence/road-workers/dispatch-validation/network-banner.json';
const shippedSource=readFileSync('js/sim.js','utf8');
const guard=shippedSource.match(/module && nt >= n \* G\.Z \* ([\d.]+)/);
assert.ok(guard);
const selector=process.argv[4]===undefined ? Number(guard[1]) : Number(process.argv[4]);
assert.ok([0.75,0.11,0.10].includes(selector));
const workerHashes=new Set();
const hash = b => createHash('sha256').update(b).digest('hex');
const children = new Set(), sources = new Map();
let nextBlob = 0;
Object.assign(globalThis, {window:globalThis, localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  matchMedia:()=>({matches:false}), Blob:class {constructor(parts){this.code=parts.join('');}},
  Worker:class {
    constructor(url) {
      let code=sources.get(url);
      if(code.includes('function carTree(')) {
        assert.equal(code.split(guard[0]).length,2);
        code=code.replace(guard[0], 'module && nt >= n * G.Z * '+selector);
        workerHashes.add(hash(code));
      }
      this.thread = new Thread("const {parentPort}=require('node:worker_threads');globalThis.onmessage=null;globalThis.postMessage=(m,t)=>parentPort.postMessage(m,t);"+code+"\nparentPort.on('message',data=>onmessage({data}));",{eval:true});
      children.add(this.thread);
      this.thread.on('message', data=>this.onmessage({data}));
      this.thread.on('error', err=>{throw err;});
    }
    postMessage(message,transfers){this.thread.postMessage(message,transfers);}
    terminate(){children.delete(this.thread);return this.thread.terminate();}
  }});
Object.defineProperty(globalThis,'navigator',{value:{hardwareConcurrency:12,deviceMemory:8},configurable:true});
URL.createObjectURL = b=>{const url='blob:local-'+ ++nextBlob;sources.set(url,b.code);return url;};
URL.revokeObjectURL = url=>sources.delete(url);
const run = path=>vm.runInThisContext(readFileSync(path,'utf8'),{filename:path});
const envelope=readFileSync(save,'utf8');
try {
  for (const [,src] of readFileSync('index.html','utf8').matchAll(/<script src="([^"]+)"/g)) {
    run(src); if (src==='js/save.js') break;
  }
  CM.UI=function(){};
  for(const name of ['settings','icons','corp','fleet','screens','pages'])run('js/'+name+'.js');
  const payload=CM.Save.parseEnvelope(envelope).payload;
  CM.useMap(payload.meta.map);
  const restore=CM.Game.restoreGen(payload);
  let r;
  do {r=restore.next();if(r.value===CM.SIM_WAIT)await pause(1);}while(!r.done);
  const g=r.value, m=g.model;
  CM.game=g;
  const settle=async()=>{
    while(!m.settled){m.step(10);await pause(1);}
    assert.ok(m.trafficReady() && !m.hasReviewWork());
  };
  await settle();
  const banner=()=>!m.settled && g.netVersion>0;
  const state=()=>({map:g.mapId,clock:{...g.clock},speed:g.speed,stations:g.compiled.stations.length,
    routes:g.compiled.routes.length,netVersion:g.netVersion,ready:m.trafficReady(),settled:m.settled,
    hasReview:m.hasReviewWork(),bannerCondition:banner(),funds:g.econ.funds,ledgerSHA256:hash(JSON.stringify(g.econ.ledger))});
  const snapshot=()=>{
    const digest=v=>ArrayBuffer.isView(v)?{type:v.constructor.name,length:v.length,sha:hash(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))}:v;
    const period={},daily={};
    for(const dt of ['wd','we'])for(const [i,P] of m.ctxs[dt].per.entries()){
      const row={};for(const [key,v] of Object.entries(P))if(ArrayBuffer.isView(v)||v===null||['string','number','boolean'].includes(typeof v)||key==='stats')row[key]=digest(v);
      period[dt+i]=hash(JSON.stringify(row));
    }
    for(const [k,v] of Object.entries({wd:m.dailyWk,average:m.daily,weekend:m.dailyWe,stW:m.stDailyWk,stE:m.stDailyWe,st:m.stDaily,facW:m.facDaily.wd,facE:m.facDaily.we})){
      daily[k]=hash(JSON.stringify(Object.fromEntries(Object.entries(v).map(([key,value])=>[key,digest(value)]))));
    }
    const extra={metrics:g.snapshotMetrics(),economy:g.econ.serialize(),ledger:g.econ.ledger,net:g.net,clock:g.clock,
      history:g.history,corp:g.corp,tasks:g.tasks.serialize(),fleet:g.fleet,events:g.events};
    return {period,daily,extra:Object.fromEntries(Object.entries(extra).map(([k,v])=>[k,hash(JSON.stringify(v))]))};
  };
  const before=state(), beforeHashes=snapshot();
  assert.equal(before.stations,278);assert.equal(before.map,'sh');assert.equal(before.clock.y,2010);
  assert.equal(before.speed,0);assert.equal(before.bannerCondition,false);
  const route=g.compiled.routes.find(r=>!r.svc && r.stIds.length>=10 && (g.net.lines[r.lineId].svcs||[]).length<CM.Fleet.MAX_SERVICES);
  const lid=route.lineId;
  const bases=g.compiled.routes.filter(r=>r.lineId===lid&&!r.svc),ids=bases[0].stIds;
  const skip=ids.filter((id,i)=>i%2===1 && i<ids.length-1 && g.compiled.stationLines[g.compiled.sIndex.get(id)].size<=1);
  assert.ok(skip.length);
  // Use the production default preset from showServiceEditor. Invoke its same saveService handler
  // and actual pages.js setLineLook; stub its render and save scheduling only in this offline copy.
  const service={id:null,name:'大站快车',skip};if(bases.length>1)service.via=ids.at(-1);
  CM.ui={g:()=>g,R:{},markUnsaved(){},scheduleAutosave(){},setLineLook:CM.UI.prototype.setLineLook};
  const requests=[],obs=new Map(),pool=CM.CarPool,origSubmit=pool.submit,origDone=pool.done;
  pool.submit=function(G,time,blocks,alive){
    assert.ok(banner());const rows=blocks.map(b=>[b.origins.length,b.tDest.length]);
    assert.equal(rows.length,32);const req=origSubmit.call(this,G,time,blocks,alive);
    const entry={id:req.id,zones:G.Z,nodes:G.nN,arcs:G.nA,blocks:rows.map(([n,nt])=>[n,nt,null,null])};
    requests.push(entry);obs.set(req.id,entry);return req;
  };
  pool.done=function(slot,message){
    assert.ok(banner());assert.ok(!message.stale);const entry=obs.get(message.req);
    const b=entry.blocks[message.b];assert.equal(b[2],null);b[2]=message.kernel?1:0;b[3]=this.list.indexOf(slot);
    return origDone.call(this,slot,message);
  };
  const start=performance.now();
  const result=CM.Fleet.saveService(g,lid,service);assert.equal(result.ok,true);
  const afterAction=state();assert.ok(afterAction.bannerCondition);
  assert.equal(afterAction.netVersion,before.netVersion+1);
  await settle();
  const modelUpdateMs=performance.now()-start, after=state(), afterHashes=snapshot();
  assert.deepEqual(after.clock,before.clock);assert.equal(after.stations,before.stations);
  assert.equal(after.routes,before.routes+1);assert.equal(after.funds,before.funds);assert.equal(after.ledgerSHA256,before.ledgerSHA256);
  assert.equal(after.bannerCondition,false);
  assert.deepEqual([pool,CM.OdPool,CM.SkimPool].map(p=>p.list?.length),[4,2,2]);
  assert.ok([pool,CM.OdPool,CM.SkimPool].every(p=>!p.off));
  const observedSHA=hash(shippedSource);assert.equal(workerHashes.size,1);
  const samples=requests.flatMap(q=>q.blocks.filter(b=>b[0]).map(([origins,pairs,wasm,slot])=>{
    assert.notEqual(wasm,null);assert.ok(slot>=0 && slot<4);
    assert.equal(wasm,Number(pairs>=origins*q.zones*selector));
    return {origins,pairs,zones:q.zones,wasm,slot};
  }));
  assert.ok(samples.length);
  const density=samples.map(b=>b.pairs/(b.origins*b.zones)).sort((a,b)=>a-b);
  const rules=[0.75,0.11,0.10].map(threshold=>{
    const wasm=samples.filter(b=>b.pairs>=b.origins*b.zones*threshold).length;
    return {threshold,wasm,js:samples.length-wasm};
  });
  const report={scope:'Offline Node worker_threads adapter runs the same Blob handlers. Only the Worker density guard is selected for replay. Offline wall time starts at saveService, ends when paused live model is settled. No rendering or browser frame pacing. Alternate policies also counted on the same shapes. Stops at formal live settlement before post-settlement UI work.',fixtureSHA256:hash(envelope),simSHA256:observedSHA,actualThreshold:selector,actualWorkerSourceSHA256:[...workerHashes][0],modelUpdateMs,beforeHashes,afterHashes,
    action:{line:lid,lineName:g.net.lines[lid].name,service},before,afterAction,after,
    pools:[4,2,2],requests:requests.length,blocks:samples.length,actualWasm:samples.filter(b=>b.wasm).length,
    blocksBySlot:[0,1,2,3].map(slot=>samples.filter(b=>b.slot===slot).length),rules,minDensity:density[0],medianDensity:density[density.length>>1],maxDensity:density.at(-1),
    blockColumns:['origins','requestedPairs','actualWasm','roadWorkerSlot'],assignments:requests};
  assert.equal(hash(readFileSync(save)),report.fixtureSHA256);
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,assignments:undefined,beforeHashes:undefined,afterHashes:undefined}));
}finally{await Promise.all(Array.from(children,w=>w.terminate()));}

// The game's optional jump scheduler retains a MessagePort, unused by this paused fixture.
process.exit(0);
