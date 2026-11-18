'use strict';
const fs = require('node:fs'), v8 = require('node:v8'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const sim = fs.readFileSync('js/sim.js','utf8'), embedded = fs.readFileSync('js/road-kernel.js','utf8');
const capture = fs.readFileSync('/tmp/metro-road-sample.bin');
const {G,time,run,pS,pD,dem} = v8.deserialize(capture);
const expected = JSON.parse(fs.readFileSync('evidence/road-workers/early-stop-kernel.json','utf8'));
const hash = a => crypto.createHash('sha256').update(a).digest('hex');
const digest = a => hash(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
assert.equal(hash(sim),expected.sourceSHA256);
const w = {CM:{}};
new Function('window',embedded)(w);
const kernel = w.CM.RoadKernel;
assert.ok(kernel.module instanceof WebAssembly.Module);
const blocks = [];
for(let b=0;b<32;b++){
  const origins=Int32Array.from(run.slice(Math.floor(b*run.length/32),Math.floor((b+1)*run.length/32)));
  const tStart=new Int32Array(origins.length+1);
  for(let i=0;i<origins.length;i++)tStart[i+1]=tStart[i]+pS[origins[i]+1]-pS[origins[i]];
  const tDest=new Int32Array(tStart.at(-1)),demand=new Float32Array(tDest.length);
  for(let i=0;i<origins.length;i++){const o=origins[i];tDest.set(pD.subarray(pS[o],pS[o+1]),tStart[i]);demand.set(dem.subarray(pS[o],pS[o+1]),tStart[i]);}
  blocks.push({type:'block',gid:G.id,req:1,b,time,origins,tStart,tDest,dem:demand});
}
function makeHandler(force){
  let text=sim.slice(sim.indexOf('  function carTree('),sim.indexOf('  // 道路图（随 roadData'));
  const guard='nt >= n * G.Z * 0.75';
  assert.equal(text.split(guard).length,2);
  if(force)text=text.replace(guard,'true');
  let reply;
  const cb = new Function('roadKernelWorker','postMessage','"use strict";const INF=1e30;let onmessage;'+text+'\ncarWorkerMain();return onmessage;')(kernel.worker,data=>{reply=data;});
  cb({data:{type:'graph',G,kernel:kernel.module}});
  return m => {reply=null;cb({data:m});assert.equal(!!reply.kernel,force);return reply;};
}
const handles={js:makeHandler(false),wasm:makeHandler(true)};
function measure(id){
  const results=[];
  const begin=performance.now();
  for(const block of blocks)results.push(handles[id](block));
  const ms=performance.now()-begin;
  const T=new Float32Array(pD.length).fill(NaN),K=T.slice(),sum=new Float32Array(G.nA),outblocks=[];
  for(let b=0;b<32;b++){
    const r=results[b],m=blocks[b];
    for(let i=0;i<m.origins.length;i++){
      const o=m.origins[i];T.set(r.rowsT.subarray(m.tStart[i],m.tStart[i+1]),pS[o]);K.set(r.rowsK.subarray(m.tStart[i],m.tStart[i+1]),pS[o]);}
    outblocks.push(digest(r.aux));for(let a=0;a<sum.length;a++)sum[a]+=r.aux[a];
  }
  assert.deepEqual({T:digest(T),K:digest(K),sum:digest(sum),blocks:outblocks},expected.signature);
  return ms;
}
const densities=blocks.map(b=>b.tDest.length/(G.Z*b.origins.length));
for(let i=0;i<2;i++){measure('js');measure('wasm');}
const timings=[];
for(let r=0;r<6;r++){const a={};for(const id of r%2?['wasm','js']:['js','wasm'])a[id]=measure(id);timings.push(a);}
const stats=id=>{const t=timings.map(a=>a[id]).sort((a,b)=>a-b);return {min:t[0],median:(t[2]+t[3])/2,max:t.at(-1)};};
const report={source:hash(sim),capture:hash(capture),node:process.version,v8:process.versions.v8,origins:run.length,graph:[G.Z,G.nN,G.nA],blockSparseTotal:blocks.reduce((s,b)=>s+b.tDest.length,0),density:[Math.min(...densities),Math.max(...densities)],mode:'Single isolate Node, one persistent actual handler/variant, same 32 blocks; just force dispatch predicate true. Include result array allocation, packing/copies and unpacking, exclude transport, main merge, hashing, graph setup, warmups. All requested times/lengths and 32 block + ordered merged flow hash checked in all runs.',warmups:2,timings,js:stats('js'),wasm:stats('wasm'),signature:expected.signature};
fs.writeFileSync('/private/tmp/city-metro-wasm-alloc-20261117.json',JSON.stringify(report,null,2));console.log(JSON.stringify({...report,signature:undefined},null,2));
