// Usage from repository root: node .../verify-allocation.mjs capture.bin output.json
import fs from 'node:fs';
import v8 from 'node:v8';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {roadFunctions} from '../early-stop.mjs';

const [captureFile, outputFile] = process.argv.slice(2);
const raw = fs.readFileSync(captureFile);
const {G,time,run,pS,pD,dem} = v8.deserialize(raw);
const sim = fs.readFileSync('js/sim.js','utf8');
const embedded = fs.readFileSync('js/road-kernel.js','utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const bytes = a => Buffer.from(a.buffer,a.byteOffset,a.byteLength);
const app = {CM:{}};
new Function('window',embedded)(app);
const {worker,module} = app.CM.RoadKernel;
assert.ok(module instanceof WebAssembly.Module);
const {carWork,carOriginRow} = roadFunctions(sim);
const work = carWork(G);
const source = sim.slice(sim.indexOf('  function carTree('),sim.indexOf('  // 道路图（随 roadData'));
function makeHandler(wasm) {
  const gate = /if \(module && nt >= n \* G\.Z \* [\d.]+\) \{/g;
  assert.equal([...source.matchAll(gate)].length,1);
  const forced = source.replace(gate,wasm?'if (module) {':'if (false) {');
  let result;
  const onmessage = new Function('roadKernelWorker','postMessage',
    '"use strict";const INF=1e30;let onmessage;'+forced+'\ncarWorkerMain();return onmessage;')(worker, m => {result=m;});
  onmessage({data:{type:'graph',G,kernel:module}});
  return block => {
    result = null;
    onmessage({data:block});
    assert.equal(!!result?.kernel,wasm);
    return result;
  };
}
const paths = {js:makeHandler(false),wasm:makeHandler(true)};
const globalT = new Float32Array(pD.length).fill(NaN), globalK = globalT.slice();
const sums = Object.fromEntries(['js','wasm','reference'].map(k=>[k,new Float32Array(G.nA)]));
const blocks=[];
for (let b=0;b<32;b++) {
  const origins = Int32Array.from(run.slice(Math.floor(b*run.length/32),Math.floor((b+1)*run.length/32)));
  const offsets = [0], refAux = new Float32Array(G.nA);
  for (const o of origins) {
    carOriginRow(G,time,o,pD,pS[o],pS[o+1],dem,work,globalT,globalK,0,refAux);
    offsets.push(offsets.at(-1)+pS[o+1]-pS[o]);
  }
  const tDest = new Int32Array(offsets.at(-1)), demand = new Float32Array(tDest.length);
  origins.forEach((o,i)=>{
    tDest.set(pD.subarray(pS[o],pS[o+1]),offsets[i]);
    demand.set(dem.subarray(pS[o],pS[o+1]),offsets[i]);
  });
  const block = {type:'block',gid:G.id,req:1,b,origins,time,tStart:Int32Array.from(offsets),tDest,dem:demand};
  for (const [name,invoke] of Object.entries(paths)) {
    const {rowsT,rowsK,aux} = invoke(block);
    origins.forEach((o,i)=>{
      for (const [actual,ref] of [[rowsT,globalT],[rowsK,globalK]]) {
        assert.ok(bytes(actual.subarray(offsets[i],offsets[i+1])).equals(bytes(ref.subarray(pS[o],pS[o+1]))),name+' row '+o);
      }
    });
    assert.ok(bytes(aux).equals(bytes(refAux)),name+' flow block '+b);
    for (let i=0;i<G.nA;i++) sums[name][i]+=aux[i];
  }
  for (let i=0;i<G.nA;i++) sums.reference[i]+=refAux[i];
  blocks.push({block:b,origins:origins.length,pairs:tDest.length,flowSHA256:hash(bytes(refAux))});
}
for (const name of Object.keys(paths)) assert.ok(bytes(sums[name]).equals(bytes(sums.reference)));
// Existing timing reports were recorded with the 75% condition. Normalization allows replay after the cutoff changes.
const calibrationSource = sim.replace(/nt >= n \* G\.Z \* [\d.]+/,'nt >= n * G.Z * 0.75');
const report = {captureSHA256:hash(raw),simSHA256:hash(sim),calibrationSourceSHA256:hash(calibrationSource),kernelSHA256:hash(embedded),
  comparison:'Byte equality of both shipped Worker handlers versus the synchronous JS carOriginRow on every requested OD time and distance (including NaNs), every per-block arc flow and ordered merged arc flow.',
  origins:run.length,pairs:blocks.reduce((s,b)=>s+b.pairs,0),zones:G.Z,nodes:G.nN,arcs:G.nA,blocks,
  timeSHA256:hash(bytes(globalT)),kmSHA256:hash(bytes(globalK)),mergedFlowSHA256:hash(bytes(sums.reference))};
fs.writeFileSync(outputFile, JSON.stringify(report,null,2)+'\n');
console.log(outputFile, report.pairs, 'OD pairs and all 32 blocks matched');
