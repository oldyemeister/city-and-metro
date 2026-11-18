// Compare the two shipped Worker handlers on a captured allocation. No network or browser.
import fs from 'node:fs';
import v8 from 'node:v8';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const [capturePath, reportPath] = process.argv.slice(2);
assert.ok(capturePath && reportPath, 'Expected capture and output paths');
const capture = fs.readFileSync(capturePath);
const {G,time,run,pS,pD,dem,W,zoneSize} = v8.deserialize(capture);
const sim = fs.readFileSync('js/sim.js','utf8');
const wasmSource = fs.readFileSync('js/road-kernel.js','utf8');
const hash = data => createHash('sha256').update(data).digest('hex');
const w = {CM:{}};
new Function('window',wasmSource)(w);
const road = w.CM.RoadKernel;
const workerSource = sim.slice(sim.indexOf('  function carTree('),sim.indexOf('  // 道路图（随 roadData'));
assert.ok(road.module);
function handler(wasm) {
  const selector = /if \(module && nt >= n \* G\.Z \* [\d.]+\) \{/g;
  assert.equal([...workerSource.matchAll(selector)].length,1,'Expected one density gate');
  const code = workerSource.replace(selector,wasm?'if (module) {':'if (false) {');
  let result;
  const onmessage = new Function('roadKernelWorker','postMessage',
    '"use strict";const INF=1e30;let onmessage;'+code+'\ncarWorkerMain();return onmessage;')(
    road.worker, message => { result=message; });
  onmessage({data:{type:'graph',G,kernel:road.module}});
  return block => {
    result=null;
    onmessage({data:block});
    assert.equal(!!result?.kernel,wasm);
    return result;
  };
}
function makeBlock(b, localLimit) {
  const origins = Int32Array.from(run.slice(Math.floor(b*run.length/32),Math.floor((b+1)*run.length/32)));
  const tStart = [0], dests=[], demands=[];
  for (const o of origins) {
    let positions=Array.from({length:pS[o+1]-pS[o]},(_,i)=>pS[o]+i);
    if (localLimit) {
      const width=W/zoneSize;
      assert.ok(Number.isInteger(width));
      const d2 = q => (o%width-pD[q]%width)**2+(Math.floor(o/width)-Math.floor(pD[q]/width))**2;
      positions.sort((i,j)=>d2(i)-d2(j)||i-j);
      positions=positions.slice(0,localLimit).sort((i,j)=>i-j);
    }
    for (const q of positions) {dests.push(pD[q]); demands.push(dem[q]);}
    tStart.push(dests.length);
  }
  return {type:'block',gid:G.id,req:1,b,time,origins,tStart:Int32Array.from(tStart),tDest:Int32Array.from(dests),dem:Float32Array.from(demands)};
}
const median = a => {const s=a.slice().sort((x,y)=>x-y);return (s[(s.length-1)>>1]+s[s.length>>1])/2;};
const result={captureSHA256:hash(capture),sourceSHA256:hash(sim),embeddedSHA256:hash(wasmSource),
  workload:{zones:G.Z,nodes:G.nN,arcs:G.nA,origins:run.length},warmups:2,measuredPairs:5,
  scope:'Single Node isolate; includes the shipped dense adapter. Per-block timings omit transport, merge and parity hashes. Local subset diagnostic rows, where present, use only nearest requested destinations per origin in the original grid and request order. They are not gameplay.',
  cases:[]};
const limits = [...new Set([0, 1, 4, 12, ...[0.02, 0.04, 0.05, 0.08, 0.10, 0.12].map(d => Math.ceil(d * G.Z))])];
for (const limit of limits) {
  const indexes=limit ? [3,12,21,29] : Array.from({length:32},(_,i)=>i);
  const blocks=indexes.map(b=>makeBlock(b,limit)).filter(b=>b.origins.length);
  const paths={js:handler(false),wasm:handler(true)};
  const rows=blocks.map(b=>({b:b.b,origins:b.origins.length,destinations:b.tDest.length,density:b.tDest.length/(b.origins.length*G.Z),js:[],wasm:[]}));
  const repeats=G.nN<1000?15:1;
  const signature = values => hash(Buffer.concat([values.rowsT,values.rowsK,values.aux].map(a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength))));
  for(let r=-2;r<5;r++){
    for(let i=0;i<blocks.length;i++){
      let reference;
      for(const name of (r%2===0?['js','wasm']:['wasm','js'])){
        const start=performance.now();
        let out;
        for(let k=0;k<repeats;k++) out=paths[name](blocks[i]);
        const ms=(performance.now()-start)/repeats;
        const key=signature(out);
        if(reference===undefined) reference=key; else assert.equal(key,reference);
        if(r>=0)rows[i][name].push(ms);
      }
    }
  }
  for(const row of rows){row.jsMedian=median(row.js);row.wasmMedian=median(row.wasm);}
  const sum = key=>rows.reduce((v,row)=>v+row[key],0);
  result.cases.push({nearestLimit:limit||null,blocks:rows,repeatsPerTiming:repeats,
    sumOfBlockMedians:{js:sum('jsMedian'),wasm:sum('wasmMedian')},wasmWins:rows.filter(row=>row.wasmMedian<row.jsMedian).length});
}
fs.writeFileSync(reportPath,JSON.stringify(result,null,2)+'\n');
console.log(result.cases.map(c=>({nearest:c.nearestLimit,blocks:c.blocks.length,wasmWins:c.wasmWins,...c.sumOfBlockMedians})));
