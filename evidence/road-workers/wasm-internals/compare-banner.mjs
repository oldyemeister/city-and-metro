// node .../compare-banner.mjs PLAIN_A PROFILE_A PROFILE_B PLAIN_B OUTPUT
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';

const args=process.argv.slice(2);
assert.equal(args.length,5,'pass four raw run paths in ABBA order followed by the output');
const output=args.pop(),runs=args.map(file=>JSON.parse(readFileSync(file)));
const ref=runs[0],sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
assert.deepEqual(runs.map(r=>r.variant),['plain','profile','profile','plain']);
const history=JSON.parse(readFileSync(new URL('../dispatch-validation/network-banner-comparison.json',import.meta.url)));
const common=['fixtureSHA256','simSHA256','action','before','afterAction','after','pools','requests','blocks'];
const hashes=r=>r.assignments.map(a=>a.inputHash).sort();
const work=hashes(ref);
assert.ok(work.every(k=>/^[a-f0-9]{64}$/.test(k)));
for(const r of runs){
  for(const key of common)assert.deepEqual(r[key],ref[key],key);
  assert.equal(r.actualThreshold,0.1);
  assert.equal(r.blocks,1024);assert.equal(r.requests,32);assert.equal(r.actualWasm,r.blocks);
  assert.equal(r.solvers.length,4);assert.equal(r.solvers.reduce((s,x)=>s+x.blocks,0),r.blocks);
  assert.deepEqual(hashes(r),work,'all origin, target, demand and arc-time input bytes');
  for(const which of ['beforeHashes','afterHashes']){
    const result=r[which];
    assert.equal(Object.keys(result.arrayHashes).length,232);
    assert.deepEqual(result,ref[which]);
    for(const key of ['period','daily','extra'])assert.deepEqual(result[key],history[which][key],which+'/'+key);
  }
}
for(const group of [[0,3],[1,2]]){
  const [a,b]=group.map(i=>runs[i]);
  assert.equal(a.wasmSHA256,b.wasmSHA256);assert.equal(a.actualWorkerSourceSHA256,b.actualWorkerSourceSHA256);
}
assert.notEqual(runs[0].wasmSHA256,runs[1].wasmSHA256);
const add=(a,b)=>a+b;
const stages=['tree','destinations','reverse','residual'];
function summary(r,i){
  const sum=k=>r.solvers.map(s=>s[k]).reduce(add,0);
  const wasmMs=sum('wasmMs'),stageMs=r.variant==='plain'?{}:Object.fromEntries(stages.map(k=>[k,r.solvers.map(s=>s.stages[k]).reduce(add,0)]));
  const internalMs=Object.values(stageMs).reduce(add,0);
  const pctOfStages=Object.fromEntries(Object.entries(stageMs).map(([k,time])=>[k,100*time/internalMs]));
  return {file:path.relative(path.dirname(output),args[i]),variant:r.variant,wasmSHA256:r.wasmSHA256,
    workerBodySHA256:r.actualWorkerSourceSHA256,wallMs:r.modelUpdateMs,blocks:sum('blocks'),origins:sum('origins'),wasmMs,stageMs,pctOfStages,
    totalsAcrossWorkers:r.solvers};
}
const summaryRuns=runs.map(summary),pairs=[[0,1],[3,2]].map(([a,b])=>{
  const plain=summaryRuns[a],profile=summaryRuns[b];
  return {plainWallMs:plain.wallMs,profileWallMs:profile.wallMs,wallOverheadPct:100*(profile.wallMs/plain.wallMs-1),
    outerSolveOverheadPct:100*(profile.wasmMs/plain.wasmMs-1)};
});
const totals=Object.fromEntries(stages.map(k=>[k,summaryRuns[1].stageMs[k]+summaryRuns[2].stageMs[k]]));
const stageSum=Object.values(totals).reduce(add,0);
const report={scope:ref.scope,pairedOrder:runs.map(r=>r.variant),...Object.fromEntries(common.map(k=>[k,ref[k]])),
  commonRequestInputsSHA256:sha(work),uniqueRequestInputs:new Set(work).size,
  identicalBeforeAndAfter:{trafficArraysPerSnapshot:232,weekdayAndWeekendPeriods:8,metricsEconomyLedgerTasks:ref.afterHashes.extra,
    beforeResultsSHA256:sha(ref.beforeHashes),afterResultsSHA256:sha(ref.afterHashes),matchesHistoricalRun:true},
  runs:summaryRuns,pairs,combinedStagePct:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,100*v/stageSum])),
  meanWallOverheadPct:100*((summaryRuns[1].wallMs+summaryRuns[2].wallMs)/(summaryRuns[0].wallMs+summaryRuns[3].wallMs)-1),
  meanOuterSolveOverheadPct:100*((summaryRuns[1].wasmMs+summaryRuns[2].wasmMs)/(summaryRuns[0].wasmMs+summaryRuns[3].wasmMs)-1)};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pairs,combinedStagePct:report.combinedStagePct,meanWallOverheadPct:report.meanWallOverheadPct,meanOuterSolveOverheadPct:report.meanOuterSolveOverheadPct}));
