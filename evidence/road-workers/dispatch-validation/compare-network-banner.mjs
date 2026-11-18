// Accept four network-banner.mjs output files in chronological 75,10,10,75 percent order.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const paths=process.argv.slice(2);
assert.equal(paths.length,4,'pass four offline run reports, in order');
const raw=paths.map(path=>JSON.parse(readFileSync(path)));
assert.deepEqual(raw.map(r=>r.actualThreshold),[0.75,0.1,0.1,0.75]);
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Pipeline interleaving can reorder request IDs. Each request's block order is fixed.
const shapes=r=>r.assignments.map(a=>JSON.stringify([a.zones,a.nodes,a.arcs,
  a.blocks.map(([origins,targets])=>[origins,targets])])).sort();
const ref=raw[0],referenceShapes=shapes(ref);
const common=['fixtureSHA256','simSHA256','action','before','afterAction','after','beforeHashes','afterHashes',
  'pools','requests','blocks','rules','minDensity','medianDensity','maxDensity'];
for(const r of raw){
  for(const key of common) assert.deepEqual(r[key],ref[key],key);
  assert.deepEqual(shapes(r),referenceShapes);
  assert.equal(r.actualWasm, r.actualThreshold===0.75?0:r.blocks);
  assert.ok(r.blocksBySlot.every(n=>n>0));
}
for(const [a,b] of [[0,3],[1,2]])assert.equal(raw[a].actualWorkerSourceSHA256,raw[b].actualWorkerSourceSHA256);
assert.notEqual(raw[0].actualWorkerSourceSHA256,raw[1].actualWorkerSourceSHA256);
const rows=raw.map(r=>({threshold:r.actualThreshold,ms:r.modelUpdateMs,
  workerSourceSHA256:r.actualWorkerSourceSHA256,blocksBySlot:r.blocksBySlot,actualWasm:r.actualWasm}));
const pair=(before,after)=>({oldMs:before.ms,newMs:after.ms,pctLess:100*(1-after.ms/before.ms)});
const pairs=[pair(rows[0],rows[1]),pair(rows[3],rows[2])];
const pctLess=100*(1-(rows[1].ms+rows[2].ms)/(rows[0].ms+rows[3].ms));
const report={scope:ref.scope,host:process.platform+' '+process.arch,node:process.version,
  sameShapesSHA256:sha(referenceShapes),...Object.fromEntries(common.map(k=>[k,ref[k]])),
  runs:rows,pairs,pctLess};
writeFileSync('evidence/road-workers/dispatch-validation/network-banner-comparison.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pairs,pctLess}));
