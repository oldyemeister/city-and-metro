// Run from the repository root with a class threshold, export path and JSON output path.
// Same worker_threads transport as dispatch-validation/network-banner.mjs.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import vm from 'node:vm';
import { Worker } from 'node:worker_threads';

const [thresholdArgument, save, out] = process.argv.slice(2);
const threshold = Number(thresholdArgument);
assert.ok([2, 3, 4].includes(threshold) && save && out);
const contents = readFileSync(save, 'utf8');
const hash = value => createHash('sha256').update(value).digest('hex');
const workers = new Set(), sources = new Map();
let nextId = 0;
Object.assign(globalThis, {
  window: globalThis, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  matchMedia: () => ({matches:false}), Blob: class { constructor(parts) { this.code = parts.join(''); } },
  Worker: class {
    constructor(url) {
      const code = "const {parentPort}=require('node:worker_threads');globalThis.onmessage=null;globalThis.postMessage=(m,t)=>parentPort.postMessage(m,t);"
        + sources.get(url) + "\nparentPort.on('message',data=>onmessage({data}));";
      this.thread = new Worker(code, { eval: true });
      workers.add(this.thread);
      this.thread.on('message', data => this.onmessage({data}));
      this.thread.on('error', e => { throw e; });
    }
    postMessage(data, transfers) { this.thread.postMessage(data, transfers); }
    terminate() { workers.delete(this.thread); return this.thread.terminate(); }
  }
});
Object.defineProperty(globalThis, 'navigator', { value:{ hardwareConcurrency:12, deviceMemory:8 }, configurable:true });
URL.createObjectURL = blob => { const key = String(++nextId); sources.set(key, blob.code); return key; };
URL.revokeObjectURL = key => sources.delete(key);

const runtimeHash = createHash('sha256');
function load(file) {
  let source = readFileSync(file, 'utf8');
  runtimeHash.update(file + '\0' + source + '\0');
  if (file === 'js/city.js') {
    const find = 'const carOn = function (e, c) { return c >= 2 &&';
    assert.equal(source.split(find).length, 2);
    source = source.replace(find, find.replace('>= 2', '>= ' + threshold));
  }
  vm.runInThisContext(source, { filename:file });
}
for (const [,file] of readFileSync('index.html','utf8').matchAll(/<script src="([^"]+)"/g)) {
  load(file);
  if (file === 'js/save.js') break;
}
CM.UI = function () {};
for (const name of ['settings','icons','corp','fleet','screens','pages']) load('js/' + name + '.js');
const payload = CM.Save.parseEnvelope(contents).payload;
assert.ok(!payload.__trafficState);
CM.useMap(payload.meta.map);
assert.equal(payload.meta.map, 'sh');
assert.deepEqual([CM.CFG.W,CM.CFG.H],[192,180]);
let calls = 0;
const submit = CM.CarPool.submit;
CM.CarPool.submit = function (...args) { calls++; return submit.apply(this,args); };
const start = performance.now();
const restore = CM.Game.restoreGen(payload);
let result;
do {
  result = restore.next();
  if (result.value === CM.SIM_WAIT) await pause(1);
} while (!result.done);
const g = result.value;
CM.game = g;
async function settle() {
  while (!g.model.settled) { g.model.step(10); await pause(1); }
  assert.ok(g.model.trafficReady() && !g.model.hasReviewWork());
}
function snapshot() {
  const d = g.model.daily;
  const road = g.city.car, vehicleKmByClass = {};
  for (const dt of ['wd','we']) for (const [p,P] of g.model.ctxs[dt].per.entries()) {
    const weight = g.model.pHours[p] * CM.CFG.trips.weekWeights[dt];
    for (let a = 0; a < road.nA; a++) {
      const cls = road.links[a >> 1].cls;
      const vehicleKm = weight * P.arcVol[a] * road.arcLen[a] / 1000;
      vehicleKmByClass[cls] = (vehicleKmByClass[cls] || 0) + vehicleKm;
    }
  }
  return {
    population:g.snapshotMetrics().pop, jobs:g.snapshotMetrics().jobs,
    dailyTrips:d.trips, dailyRiders:d.metro, dailyCar:d.car, metroShare:d.metroShare,
    roadCongestion:d.cong, weekdayAMCongestion:d.congAM, meanCarMinutes:d.carTime / d.car,
    meanCarKm:d.carPkm / d.car, weekdayCommuteMinutes:g.model.dailyWk.commute,
    coverage:d.coverage, predictedDailyFares:d.fare, assignedDailyVehicleKmByClass:vehicleKmByClass
  };
}
await settle();
const restoreMs = performance.now() - start;
const before = snapshot(), coldRoadCalls = calls, coldBlocks = {...CM.CarPool.stats};
assert.ok(coldRoadCalls > 0);
const route = g.compiled.routes.find(r => !r.svc && r.stIds.length >= 10 && (g.net.lines[r.lineId].svcs || []).length < CM.Fleet.MAX_SERVICES);
const bases = g.compiled.routes.filter(r => r.lineId === route.lineId && !r.svc), ids = bases[0].stIds;
const skip = ids.filter((id,i) => i % 2 === 1 && i < ids.length - 1 && g.compiled.stationLines[g.compiled.sIndex.get(id)].size <= 1);
assert.ok(skip.length);
const service = {id:null, name:'大站快车', skip};
if (bases.length > 1) service.via = ids.at(-1);
CM.ui = { g:()=>g, R:{}, markUnsaved(){}, scheduleAutosave(){}, setLineLook:CM.UI.prototype.setLineLook };
const preRoutes = g.compiled.routes.length;
const actionStart = performance.now();
assert.ok(CM.Fleet.saveService(g,route.lineId,service).ok);
await settle();
const actionMs = performance.now() - actionStart;
assert.equal(g.compiled.routes.length,preRoutes+1);
const pools = [CM.CarPool, CM.OdPool, CM.SkimPool];
assert.deepEqual(pools.map(p => p.list.length),[4,2,2]);
assert.ok(pools.every(p => !p.off));
const road = g.city.car, linksByClass = {};
for (const l of road.links) linksByClass[l.cls] = (linksByClass[l.cls] || 0) + 1;
assert.ok(road.links.every(l => l.cls >= threshold));
assert.equal(hash(contents),hash(readFileSync(save)));
const walkHash = createHash('sha256');
for (const a of [g.city.walk.start,g.city.walk.to,g.city.walk.len]) walkHash.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
const report = {
  method:'Independent cold Node process. Current production map, migrated export, shipping Worker code and 4/2/2 pools. Replace only carOn threshold in memory and rebuild normal zone connectors. Cold restore through traffic settlement; then add one express on the first eligible long line and time through settlement. Wall times omit browser UI.',
  threshold, fixture:basename(save), fixtureSHA256:hash(contents), mapVersion:CM.MAPS.sh.mapVersion, modelYear:g.model.year,
  unmodifiedRuntimeSHA256:runtimeHash.digest('hex'),
  citySHA256:hash(readFileSync('js/city.js')), simSHA256:hash(readFileSync('js/sim.js')),
  geoSHA256:hash(readFileSync('js/geo_sh.js')), simDataSHA256:hash(readFileSync('js/data_sh.js')),
  clock:g.clock, stations:g.compiled.stations.length, routesBefore:preRoutes,
  action:{line:g.net.lines[route.lineId].name, skippedStations:skip, route:route.lineId},
  graph:{nodes:road.nN,arcs:road.nA,linksByClass, zones:road.zoneConn.length,
    zonesWithAccess:road.zoneConn.filter(c=>c.length).length,walkSHA256:walkHash.digest('hex')},
  restoreMs,coldRoadCalls,coldBlocks,before,actionMs,actionRoadCalls:calls-coldRoadCalls,
  actionBlocks:{js:CM.CarPool.stats.js-coldBlocks.js,wasm:CM.CarPool.stats.wasm-coldBlocks.wasm}, after:snapshot()
};
writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({threshold,restoreMs,actionMs,before,graph:report.graph}));
await Promise.all([...workers].map(w=>w.terminate()));
process.exit(0);
