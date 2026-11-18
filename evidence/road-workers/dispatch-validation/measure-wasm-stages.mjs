// Run at the repo root: node .../measure-wasm-stages.mjs captured-allocation.bin result.json
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import v8 from 'node:v8';

const [input,output]=process.argv.slice(2);
const read=file=>fs.readFileSync(file,'utf8');
const hash=data=>createHash('sha256').update(data).digest('hex');
const digest=a=>hash(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
const exact=JSON.parse(read(new URL('sh2010-exact.json',import.meta.url)));
const raw=fs.readFileSync(input),sim=read('js/sim.js'),embedded=read('js/road-kernel.js');
assert.equal(hash(raw),exact.captureSHA256);assert.equal(hash(embedded),exact.kernelSHA256);
const {G,time,run,pS,pD,dem}=v8.deserialize(raw);
const blocks=Array.from({length:32},(_,b)=>{
  const origins=Int32Array.from(run.slice(Math.floor(b*run.length/32),Math.floor((b+1)*run.length/32)));
  const tStart=new Int32Array(origins.length+1);
  origins.forEach((o,i)=>{tStart[i+1]=tStart[i]+pS[o+1]-pS[o];});
  const tDest=new Int32Array(tStart.at(-1)),demand=new Float32Array(tDest.length);
  origins.forEach((o,i)=>{
    tDest.set(pD.subarray(pS[o],pS[o+1]),tStart[i]);
    demand.set(dem.subarray(pS[o],pS[o+1]),tStart[i]);
  });
  return {type:'block',gid:G.id,req:1,b,time,origins,tStart,tDest,dem:demand};
});

const win={CM:{}};new Function('window',embedded)(win);
const {module,worker}=win.CM.RoadKernel;
assert.ok(module instanceof WebAssembly.Module);
const stages=['sparseRowsAllocNaN','denseAlloc','scatterDemand','setInputs','wasmSolve','sliceOutputs','gatherRequested'];
const marks=new Float64Array(stages.length+1);
const mark=i=>{marks[i]=performance.now();};
function before(source,needle,index) {
  assert.equal(source.split(needle).length,2,'Expected one marker anchor: '+needle);
  return source.replace(needle,'mark('+index+');'+needle);
}
function handler(observe) {
  let s=sim.slice(sim.indexOf('  function carTree('),sim.indexOf('  // 道路图（随 roadData'));
  let adapter=worker;
  if(observe){
    let inner=before(worker.toString(),'if(!e.solve(n))',4);
    inner=before(inner,'return {rowsT:views[13].slice',5);
    adapter=new Function('mark','return ('+inner+');')(mark);
    s=before(s,'const rowsT = new Float32Array(nt)',0);
    s=before(s,'if (module && nt >= n * G.Z',1);
    s=before(s,'for (let i = 0; i < n; i++) for (let q = tStart[i]; q < tStart[i + 1]; q++) dense',2);
    s=before(s,'const result = kernel.solve(',3);
    s=before(s,'for (let i = 0; i < n; i++) for (let q = tStart[i]; q < tStart[i + 1]; q++) {',6);
    s=before(s,'postMessage({ req: m.req, b: m.b, rowsT, rowsK, aux: result.aux',7);
  }
  let answer;
  const receive=new Function('roadKernelWorker','mark','postMessage','"use strict";const INF=1e30;let onmessage;'+s+'\ncarWorkerMain();return onmessage;')(adapter,mark,r=>{answer=r;});
  receive({data:{type:'graph',G,kernel:module}});
  return block=>{answer=null;receive({data:block});return answer;};
}
const variants={plain:handler(false),observed:handler(true)};
function verify(replies) {
  const T=new Float32Array(pD.length).fill(NaN),K=T.slice(),sum=new Float32Array(G.nA);
  replies.forEach((r,b)=>{
    assert.equal(r.kernel,true);assert.equal(r.b,b);
    const m=blocks[b];
    m.origins.forEach((o,i)=>{
      T.set(r.rowsT.subarray(m.tStart[i],m.tStart[i+1]),pS[o]);
      K.set(r.rowsK.subarray(m.tStart[i],m.tStart[i+1]),pS[o]);
    });
    assert.equal(digest(r.aux),exact.blocks[b].flowSHA256);
    for(let i=0;i<sum.length;i++)sum[i]+=r.aux[i];
  });
  assert.equal(digest(T),exact.timeSHA256);assert.equal(digest(K),exact.kmSHA256);
  assert.equal(digest(sum),exact.mergedFlowSHA256);
}
function pass(which){
  const invoke=variants[which],totals=new Float64Array(stages.length),replies=[];
  let totalMs=0;
  for(const b of blocks){
    const t0=performance.now();
    const out=invoke(b);
    totalMs+=performance.now()-t0;
    replies.push(out);
    if(which==='observed')for(let i=0;i<stages.length;i++)totals[i]+=marks[i+1]-marks[i];
  }
  verify(replies);
  const stageMs=Object.fromEntries(stages.map((s,i)=>[s,totals[i]]));
  if(which==='observed')stageMs.otherHandler=totalMs-totals.reduce((a,b)=>a+b,0);
  return which==='plain'?{totalMs}:{totalMs,stageMs};
}
const median=values=>{const a=values.slice().sort((x,y)=>x-y);return (a[(a.length-1)>>1]+a[a.length>>1])/2;};
const warmups=[],pairs=[];
for(let i=0;i<8;i++){
  const row={order:i%2?['observed','plain']:['plain','observed']};
  for(const v of row.order)row[v]=pass(v);
  (i<2?warmups:pairs).push(row);
}
const stats=values=>({min:Math.min(...values),median:median(values),max:Math.max(...values)});
// Empty-marker cost includes loop/indexing overhead, independent of GC/JIT effects inside the actual handler.
const markerCalibration=[];
for(let rep=0;rep<5;rep++){
  const start=performance.now();
  for(let k=0;k<1000;k++)for(let b=0;b<blocks.length;b++)for(let i=0;i<marks.length;i++)mark(i);
  markerCalibration.push((performance.now()-start)/1000);
}
const plain=stats(pairs.map(r=>r.plain.totalMs)),observed=stats(pairs.map(r=>r.observed.totalMs));
const breakdown=Object.fromEntries([...stages,'otherHandler'].map(k=>[k,{
  ms:stats(pairs.map(r=>r.observed.stageMs[k])),
  medianSharePct:median(pairs.map(r=>100*r.observed.stageMs[k]/r.observed.totalMs))
}]));
const report={simSHA256:hash(sim),embeddedSHA256:hash(embedded),captureSHA256:hash(raw),
  node:process.version,v8:process.versions.v8,os:process.platform,arch:process.arch,
  graph:{zones:G.Z,nodes:G.nN,arcs:G.nA,origins:run.length,blocks:32,targets:blocks.reduce((v,b)=>v+b.tDest.length,0)},
  method:'One Node isolate, persistent shipped handler and kernel for each arm, natural dispatch. Two warmup passes per arm (including lazy module setup on first block), six measured alternating pairs. Eight performance.now markers/block in observed path, two outer clocks per block in both arms. Stage clocks and preemption/GC land inside the timed intervals. setInputs includes the adapter call and three typed-array sets; sliceOutputs includes two dense row slices, arc-flow slice and return; gatherRequested writes requested rows. otherHandler includes stub callback and outer overhead. Elapsed handler time excludes message transport, scheduling, post-run hashing and main ordered merge. Data from first road allocation of next Shanghai month.',
  correctness:'Each warmup and timed pass checks production WASM use and full time/km, each of 32 block flow hashes and ordered merged flow against the independently verified synchronous-JS reference.',
  totalMs:{plain,observed},emptyMarkerLoopMsPer32Blocks:stats(markerCalibration),pairedObservedMinusPlainMs:stats(pairs.map(r=>r.observed.totalMs-r.plain.totalMs)),breakdown,warmups,pairs};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({totalMs:report.totalMs,pairedObservedMinusPlainMs:report.pairedObservedMinusPlainMs,breakdown}));
