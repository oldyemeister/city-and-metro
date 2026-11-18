import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const file=process.argv[2], report=JSON.parse(await fs.readFile(file));
assert.equal(report.cases.length,6);
const diff=(a,b)=>Object.keys({...a,...b}).filter(k=>a[k]!==b[k]);
const comparisons=[];
for(const scenario of ['normal','two','year']){
  const get=n=>report.cases.find(x=>x.n===n && x.scenario===scenario);
  const four=get(4),two=get(2);
  assert.deepEqual(four.before.clock,two.before.clock);
  assert.deepEqual(four.after.clock,two.after.clock);
  assert.equal(four.timing.hidden||two.timing.hidden,false);
  const result={scenario,clock:four.after.clock};
  for(const endpoint of ['before','after']){
    const a=four[endpoint],b=two[endpoint];
    result[endpoint]={metricsCompared:Object.keys(a.metrics).length,metricsDifferent:diff(a.metrics,b.metrics),arraysCompared:Object.keys(a.arrays).length,arraysDifferent:diff(a.arrays,b.arrays),ledgerEqual:a.ledger===b.ledger};
  }
  for(const row of [four,two]){
    const times=row.samples.map(x=>x.intervalMs).sort((a,b)=>a-b);
    result[row.n+'workers']={elapsedMs:row.timing.ms,peak:row.peak,average:row.samples.reduce((s,x)=>s+x.cpuPct*x.intervalMs,0)/times.reduce((s,x)=>s+x,0),samples:times.length,medianIntervalMs:times[times.length>>1]};
  }
  comparisons.push(result);
}
console.log(JSON.stringify(comparisons,null,2));
