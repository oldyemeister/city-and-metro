// From the repository root: node evidence/road-workers/wasm-internals/profile-banner.mjs plain|profile [raw-report-path]
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const [variant,destination]=process.argv.slice(2);
assert.ok(variant==='plain'||variant==='profile');
assert.ok(destination,'Specify a path for the raw run report');
const sha=v=>createHash('sha256').update(v).digest('hex');
const dir=new URL('./',import.meta.url);
const input=new URL('../dispatch-validation/network-banner.mjs',dir);
const probePath=fileURLToPath(new URL('wasm-probe.mjs',dir));
const {plainBytes,instrumentedBytes}=await import(new URL('wasm-probe.mjs',dir));
const embedded=Buffer.from(readFileSync('js/road-kernel.js','utf8').match(/const bytes='([^']+)'/)[1],'base64');
assert.deepEqual(Buffer.from(plainBytes()),embedded);
const original=readFileSync(input,'utf8');
const wasm=variant==='plain'?embedded:Buffer.from(instrumentedBytes());
const stats=new Map();
function once(source,literal,replacement){
  assert.equal(source.split(literal).length,2,'Expected unique hook for '+literal);
  return source.replace(literal,()=>replacement);
}
function wireWorker(src){
  const driver=`
const {createProbe}=require(${JSON.stringify(probePath)});
const profileMode=${variant==='profile'};
const engineProbe=profileMode?createProbe():null;
let lastSolve=null;
function measureSolve(e,n) {
  if (engineProbe) engineProbe.reset();
  const start=performance.now(), result=e.solve(n), elapsed=performance.now()-start;
  lastSolve={wasmMs:elapsed,stage:engineProbe?engineProbe.snapshot():null};
  return result;
}`;
  const send=`
const originalPost=globalThis.postMessage;
globalThis.postMessage=(msg,transfer)=>{
  if(msg.kernel){if(!lastSolve)throw Error('Unobserved WASM solve');msg.solveProfile=lastSolve;lastSolve=null;}
  originalPost(msg,transfer);
};`;
  src=once(src,'new WebAssembly.Instance(module,{})','new WebAssembly.Instance(module,engineProbe?engineProbe.imports:{})');
  src=once(src,'if(!e.solve(n))','if(!measureSolve(e,n))');
  return driver+src+send;
}
function digestRequest(time,blocks) {
  const h=createHash('sha256');
  const put=a=>{h.update(String(a.byteLength)+'|');h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));};
  put(time);
  for(const b of blocks)for(const key of ['origins','tStart','tDest','dem'])put(b[key]);
  return h.digest('hex');
}
globalThis.bannerRun={
  module:new WebAssembly.Module(wasm),variant,wireWorker,digestRequest,
  sample(id,index,profile){assert.ok(profile&&profile.wasmMs>0);stats.set(id+'/'+index,profile);},
  finish(report){
    const solvers=[0,1,2,3].map(()=>({blocks:0,origins:0,wasmMs:0,stages:{}}));
    for (const q of report.assignments)for(const [i,[n,,flag,slot]] of q.blocks.entries()){
      if(!n)continue;
      assert.equal(flag,1);const solve=stats.get(q.id+'/'+i);assert.ok(solve);
      const aggregate=solvers[slot];aggregate.blocks++;aggregate.origins+=n;aggregate.wasmMs+=solve.wasmMs;
      if(variant==='profile'){
        assert.equal(solve.stage.blocks,1);assert.equal(solve.stage.origins,n);
        for(const key of ['tree','destinations','reverse','residual']){
          const v=solve.stage[key];assert.ok(Number.isFinite(v)&&v>=0,key);
          aggregate.stages[key]=(aggregate.stages[key]||0)+v;
        }
      } else assert.equal(solve.stage,null);
    }
    assert.equal(stats.size,report.blocks);assert.ok(solvers.every(slot=>slot.blocks&&slot.origins));
    Object.assign(report,{scope:'Offline Shanghai 278-station paused Line 1 express creation through live model settlement. Both variants retain the 10% guard and include identical request hashing and per-block outer WASM timing. Stage counters only in profiled module. Stages and outer times summed across concurrent Workers.',variant,
      wasmSHA256:sha(wasm),archiveSHA256:sha(original),solvers});
  }
};
// Apply exact, unique observer hooks to the original acceptance harness in memory.
// The game's ordinary load, edit, dispatch, model.step and result checks remain in that single harness.
let code=once(original,"code=code.replace(guard[0], 'module && nt >= n * G.Z * '+selector);",
  "assert.equal(Number(guard[1]),selector);code=bannerRun.wireWorker(code);");
code=once(code,'const restore=CM.Game.restoreGen(payload);',
  'CM.RoadKernel.module=bannerRun.module; const restore=CM.Game.restoreGen(payload);');
code=once(code,'const req=origSubmit.call(this,G,time,blocks,alive);',
  'const inputHash=bannerRun.digestRequest(time,blocks);const req=origSubmit.call(this,G,time,blocks,alive);');
code=once(code,'const entry={id:req.id,zones:G.Z', 'const entry={id:req.id,inputHash,zones:G.Z');
code=once(code,'return origDone.call(this,slot,message);',
  'bannerRun.sample(message.req,message.b,message.solveProfile);delete message.solveProfile;return origDone.call(this,slot,message);');
code=once(code,'const period={},daily={};','const period={},daily={},arrayHashes={};');
code=once(code,'period[dt+i]=hash(JSON.stringify(row));',`for(const [k,v] of Object.entries(P))if(ArrayBuffer.isView(v))arrayHashes[dt+i+'.'+k]=row[k];period[dt+i]=hash(JSON.stringify(row));`);
code=once(code,'return {period,daily,extra:',"assert.equal(Object.keys(arrayHashes).length,232);return {arrayHashes,period,daily,extra:");
code=once(code,'writeFileSync(output,JSON.stringify(report,null,2)', 'bannerRun.finish(report);writeFileSync(output,JSON.stringify(report,null,2)');
process.argv=[process.execPath,fileURLToPath(input),'savedgames/test/Shanghai-2010-01-278.cmsave.json',destination,'0.10'];
await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
