// Run after the full/hybrid crossover and the unconnected major-road control.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(name + '.json', import.meta.url)));
const repeats = ['a','b','c','d'];
const base = repeats.map(run => read('full-' + run));
const hybrid = repeats.map(run => read('hybrid-' + run));
const major = [read('major-reference')];
const limits = [3,8].map(km => read('hybrid-' + km + 'km'));
const mean = a => a.reduce((total, x) => total + x, 0) / a.length;
function difference(reference, trial) {
  return {reference, trial, delta:trial - reference, percent:100 * (trial - reference) / reference};
}
for (const run of [...base, ...hybrid, ...major, ...limits]) {
  for (const key of ['fixtureSHA256','unmodifiedRuntimeSHA256','clock','action','stations','routesBefore',
    'mapVersion','modelYear','coldRoadCalls','actionRoadCalls']) {
    assert.deepEqual(run[key], base[0][key], key);
  }
  for (const stage of ['before','after']) {
    for (const key of ['population','jobs','coverage']) assert.equal(run[stage][key], base[0][stage][key], key);
  }
  assert.equal(run.graph.walkSHA256, base[0].graph.walkSHA256);
}
for (const run of [...hybrid,...limits]) {
  assert.deepEqual(run.graph, base[0].graph);
  assert.equal(run.hybridModuleSHA256,hybrid[0].hybridModuleSHA256);
  for (const stage of ['cold','action']) {
    assert.equal(run.workerResults[stage].hybrid, 32 * 32);
    assert.equal(run.workerResults[stage].stockJS + run.workerResults[stage].stockWASM, 0);
  }
}
for (const cases of [base,hybrid]) {
  for (const repeat of cases.slice(1)) {
    for (const key of ['before','after','graph']) assert.deepEqual(cases[0][key],repeat[key],key);
    for (const stage of ['cold','action']) assert.deepEqual(cases[0].workerResults[stage],repeat.workerResults[stage]);
  }
}
assert.equal(base[0].stations, 342);
assert.ok(hybrid.every(run => run.shortTripKm === 5));
assert.deepEqual(limits.map(run => run.shortTripKm), [3,8]);
const routeChecks = [];
for (const [km, file] of [[3,'check-routes-3km'], [5,'check-routes'], [8,'check-routes-8km']]) {
  const report = read(file), {short, long} = report.groups;
  assert.equal(report.shortKm, km);
  assert.equal(report.hybridSHA256, hybrid[0].hybridModuleSHA256);
  assert.equal(report.fixtureSHA256, base[0].fixtureSHA256);
  assert.equal(short.requests + long.requests, 633687);
  assert.equal(short.newLoss + short.gained + long.newLoss + long.gained, 0);
  assert.equal(short.exactCost, short.originalReachable);
  assert.equal(short.exactKm, short.originalReachable);
  routeChecks.push({shortTripKm:km, shortReachable:short.originalReachable, longReachable:long.originalReachable,
    lost:short.newLoss+long.newLoss, longCarDemandShare:long.carDemand/(short.carDemand+long.carDemand),
    traced:report.unitTests.traced});
}
const keys = ['dailyRiders','predictedDailyFares','metroShare','meanCarMinutes','weekdayAMCongestion'];
function compare(cases) {
  const times = {}, before = {}, after = {}, expressEffect = {};
  for (const key of ['actionMs','restoreMs']) {
    const full = base.map(r=>r[key]), measured = cases.map(r=>r[key]);
    times[key] = {full, measured, ...difference(mean(full),mean(measured))};
  }
  for (const key of keys) {
    before[key] = difference(base[0].before[key], cases[0].before[key]);
    after[key] = difference(base[0].after[key], cases[0].after[key]);
  }
  for (const key of ['dailyRiders','predictedDailyFares']) {
    expressEffect[key] = difference(base[0].after[key] - base[0].before[key],
      cases[0].after[key] - cases[0].before[key]);
  }
  return {times, before, after, expressEffect};
}
console.log(JSON.stringify({fixtureSHA256:base[0].fixtureSHA256, shortTripKm:hybrid[0].shortTripKm, routeChecks,
  hybrid:compare(hybrid), majorOnly:compare(major),
  sensitivity:limits.map(run => ({shortTripKm:run.shortTripKm, ...compare([run])}))}, null, 2));
