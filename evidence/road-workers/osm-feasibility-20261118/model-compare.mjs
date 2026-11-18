// Validate inputs and deterministic repeats before comparing the measured A/B runs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => JSON.parse(readFileSync(new URL(file, import.meta.url)));
const pct = (a,b) => 100 * (b / a - 1);
const mean = values => values.reduce((a,b) => a+b,0) / values.length;
for (const year of [2010,2000,2015]) {
  const pairs = (year===2010 ? ['1','2'] : ['1']).map(number =>
    ['a','b'].map(variant => read('model-' + year + '-' + variant + number + '.json')));
  const [base,major] = pairs[0];
  for (const [a,b] of pairs) {
    assert.deepEqual([a.threshold,b.threshold],[2,3]);
    for (const k of ['fixtureSHA256','unmodifiedRuntimeSHA256','mapVersion','clock','action','stations','routesBefore','modelYear']) assert.deepEqual(a[k],b[k],k);
    assert.equal(a.graph.walkSHA256,b.graph.walkSHA256);
    for (const k of ['population','jobs','coverage']) assert.equal(a.before[k],b.before[k],k);
    for (const [trial,first] of [[a,base],[b,major]]) {
      for (const k of ['before','after','graph','action','coldRoadCalls','actionRoadCalls','coldBlocks','actionBlocks','unmodifiedRuntimeSHA256']) assert.deepEqual(trial[k],first[k],k);
    }
  }
  const times = {};
  for (const k of ['restoreMs','actionMs']) {
    const baseline = pairs.map(p=>p[0][k]), filtered = pairs.map(p=>p[1][k]);
    times[k] = {baseline,filtered,meanChangePct:pct(mean(baseline),mean(filtered))};
  }
  const vehicleKm = base.before.assignedDailyVehicleKmByClass;
  const metrics = {};
  for (const k of ['dailyTrips','dailyRiders','dailyCar','metroShare','meanCarMinutes','roadCongestion','weekdayAMCongestion','weekdayCommuteMinutes','predictedDailyFares']) {
    const a = base.before[k], b = major.before[k];
    metrics[k] = {baseline:a,filtered:b,change:b-a,changePct:pct(a,b)};
  }
  console.log(JSON.stringify({year,times,metrics,baselineAssignedClass2VehicleKmShare:vehicleKm[2]/Object.values(vehicleKm).reduce((a,b)=>a+b,0)},null,2));
}
