// Replay dispatch decisions against previously recorded paired block-handler timings.
// Run from the repository root. No simulation, browser work, or new timing sample.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const input = 'evidence/road-workers/dispatch-calibration';
const output = 'evidence/road-workers/dispatch-validation/thresholds.json';
const datasets = {};
for (const map of ['sh2010','london','qingwan']) {
  const raw = fs.readFileSync(input+'/'+map+'-blocks.json');
  const data = JSON.parse(raw);
  const exact = JSON.parse(fs.readFileSync('evidence/road-workers/dispatch-validation/'+map+'-exact.json'));
  assert.equal(data.captureSHA256,exact.captureSHA256);
  assert.equal(data.sourceSHA256,exact.calibrationSourceSHA256??exact.simSHA256);
  assert.equal(data.embeddedSHA256,exact.kernelSHA256);
  const full = data.cases.find(c=>c.nearestLimit===null).blocks;
  assert.equal(full.length,32);
  const clipped = data.cases.filter(c=>c.nearestLimit!==null).flatMap(c=>c.blocks);
  function classify(rows, threshold) {
    const eligible = rows.filter(row=>row.density>=threshold);
    return {
      rows:rows.length, dispatchedToWasm:eligible.length,
      eligibleWasmSlower:eligible.filter(row=>row.wasmMedian>row.jsMedian).length,
      sumOfSelectedBlockMediansMs:rows.reduce((sum,row)=>sum+
        (row.density>=threshold?row.wasmMedian:row.jsMedian),0)
    };
  }
  datasets[map] = {
    timingInputSHA256:createHash('sha256').update(raw).digest('hex'),
    captureSHA256:data.captureSHA256,
    policies:[0,.05,.08,.10,.11,.12,.75,1].map(threshold=>({
      inclusiveMinimumDensity:threshold,
      realAllocation:classify(full,threshold),nearestSubsets:classify(clipped,threshold)
    }))
  };
}
fs.writeFileSync(output,JSON.stringify({
  scope:'Counterfactual sums of recorded, paired per-block median Node handler times. Omit scheduling, transport, merge and graph preparation. The nearest-only subsets repeat selected blocks after clipping destination lists; only realAllocation uses unchanged game traffic. No end-to-end time or universal crossover implied.',datasets
},null,2)+'\n');
