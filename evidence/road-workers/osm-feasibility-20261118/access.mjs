// Static connectivity of the restored Shanghai OD table under alternative car-graph cutoffs.
// Run from the repository root: node evidence/road-workers/osm-feasibility-20261118/access.mjs [additional Shanghai exports ...]
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {basename, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir = new URL('.', import.meta.url), root = new URL('../../../', dir);
const sourceRoot = process.env.CM_SOURCE_ROOT ? pathToFileURL(resolve(process.env.CM_SOURCE_ROOT) + '/') : root;
const hash = (v) => createHash('sha256').update(v).digest('hex');
const sourceSHA256 = {};
async function sourceFile(file) {
  const bytes = await fs.readFile(new URL(file,sourceRoot));
  sourceSHA256[file] = hash(bytes);
  return bytes.toString('utf8');
}
const ctx = {console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator: {}, matchMedia: () => ({matches:false}),
  localStorage: {getItem: () => null, setItem(){}, removeItem(){}}, minCarClass:2};
ctx.window = ctx;
vm.createContext(ctx);
function insert(source, before, after) {
  assert.equal(source.split(before).length, 2);
  return source.replace(before, after);
}
async function load(file) {
  let source = await sourceFile(file);
  if (file === 'js/city.js') {
    source = insert(source, 'return c >= 2 && this.eBlock', 'return c >= minCarClass && this.eBlock');
  }
  if (file === 'js/game.js') {
    const anchor = '      const cacheHit = !upgrade';
    source = insert(source, anchor, '      yield g;\n' + anchor);
  }
  vm.runInContext(source, ctx, {filename:file});
}
for (const [,file] of (await sourceFile('index.html')).matchAll(/<script src="([^"]+)"/g)) {
  await load(file);
  if (file === 'js/save.js') break;
}
const C = ctx.CM;
C.UI = function(){};
for (const name of ['settings', 'corp', 'fleet', 'screens']) await load('js/' + name + '.js');

function components(road) {
  const comp = new Int32Array(road.nN).fill(-1), sizes = [], stack = [];
  for (let i = 0; i < road.nN; i++) {
    if (comp[i] >= 0) continue;
    const id = sizes.length;
    comp[i] = id;
    stack.push(i);
    let size = 0;
    while (stack.length) {
      const n = stack.pop();
      size++;
      for (let j = road.outStart[n]; j < road.outStart[n + 1]; j++) {
        const next = road.arcTo[road.outArc[j]];
        if (comp[next] >= 0) continue;
        comp[next] = id;
        stack.push(next);
      }
    }
    sizes.push(size);
  }
  const groups = road.zoneConn.map(entries => Array.from(new Set(entries.map(c => comp[c.node]))));
  return {groups, sizes};
}
function walkHash(city) {
  const digest = createHash('sha256');
  for (const key of ['start','to','len','deg']) {
    const a = city.walk[key];
    digest.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  }
  return digest.digest('hex');
}
function measure(game, baseFlags) {
  const model = game.model, road = game.city.car, od = model.od;
  const {groups, sizes} = components(road);
  const connects = (a, b) => groups[a].some(c => groups[b].includes(c));
  const activeNodes = new Set(road.zoneConn.flatMap(entries => entries.map(c => c.node)));
  let nonAccessDegree2 = 0;
  for (let n=0; n<road.nN; n++) {
    if (!activeNodes.has(n) && road.outStart[n+1] - road.outStart[n] === 2) nonAccessDegree2++;
  }
  const flags = new Uint8Array(od.dest.length);
  const totals = {entries:0, mass:0, reachableEntries:0, reachableMass:0, newlyLostEntries:0, newlyLostMass:0,
    newlyGainedEntries:0, newlyGainedMass:0};
  const access = {zones:0, connectedZones:0, inhabitedZones:0, inhabitedWithoutEntry:0,
    population:0, populationWithoutEntry:0, jobs:0, jobsWithoutEntry:0,
    peopleSumNearestEntryKm:0, peopleWithEntryOver500m:0, peopleWithEntryOver1km:0};
  for (let z = 0; z < model.Z; z++) {
    const entries = road.zoneConn[z], people = model.zPop[z], jobs = model.zJobs[z];
    access.zones++;
    access.population += people;
    access.jobs += jobs;
    if (people > 0) access.inhabitedZones++;
    if (entries.length) {
      access.connectedZones++;
      const nearest = Math.min(...entries.map(c => c.km));
      access.peopleSumNearestEntryKm += people * nearest;
      if (nearest > 0.5) access.peopleWithEntryOver500m += people;
      if (nearest > 1) access.peopleWithEntryOver1km += people;
    } else {
      access.populationWithoutEntry += people;
      access.jobsWithoutEntry += jobs;
      if (people > 0) access.inhabitedWithoutEntry++;
    }
    for (let k = od.start[z]; k < od.start[z + 1]; k++) {
      const d = model.fn.hostZ[od.dest[k]];
      if (z === d) continue;
      let mass = 0;
      for (const t of od.t) mass += t[k];
      if (mass <= 0) continue;
      totals.entries++;
      totals.mass += mass;
      const ok = connects(z, d);
      if (ok) {
        flags[k] = 1;
        totals.reachableEntries++;
        totals.reachableMass += mass;
      }
      if (baseFlags && ok !== !!baseFlags[k]) {
        if (ok) {
          totals.newlyGainedEntries++;
          totals.newlyGainedMass += mass;
        } else {
          totals.newlyLostEntries++;
          totals.newlyLostMass += mass;
        }
      }
    }
  }
  access.meanNearestEntryMetersAmongConnectedResidents = access.peopleSumNearestEntryKm * 1000 /
    (access.population - access.populationWithoutEntry);
  const linkCounts = [0,0,0,0,0];
  for (const l of road.links) linkCounts[l.cls]++;
  return {flags, report: {minimumCarClass:ctx.minCarClass, nodes:road.nN, directedArcs:road.nA,
    linksByClass:linkCounts, totalComponents:sizes.length, largestComponentNodes:Math.max(...sizes),
    degreeTwoNodesOutsideAllZoneConnectors:nonAccessDegree2,
    walkSHA256:walkHash(game.city), access, allModeDemand:totals}};
}
const fixtureDir = new URL('savedgames/test/', root);
const saves = (await fs.readdir(fixtureDir)).filter(f => f.endsWith('.cmsave.json') && !f.startsWith('London')).sort()
  .map(name => ({name, path:new URL(name,fixtureDir)}));
assert.equal(saves.length,2);
for (const arg of process.argv.slice(2)) saves.push({name:basename(arg), path:resolve(arg)});
const results = [];
for (const {name:save,path} of saves) {
  const text = await fs.readFile(path,'utf8');
  C.useMap('sh');
  ctx.minCarClass = 2;
  const parsed = C.Save.parseEnvelope(text).payload;
  assert.equal(parsed.meta.map,'sh');
  const restore = C.Game.restoreGen(parsed,true);
  let game;
  for (const s of restore) {
    if (s?.model && s?.city) { game = s; break; }
  }
  assert.ok(game);
  const base = measure(game, null);
  const cases = [base.report];
  for (const cutoff of [3,4]) {
    ctx.minCarClass = cutoff;
    game.city._carInputs = null;
    game.city.buildGraphs();
    const {report} = measure(game, base.flags);
    assert.equal(report.walkSHA256,base.report.walkSHA256);
    assert.equal(report.allModeDemand.mass,base.report.allModeDemand.mass);
    assert.equal(report.allModeDemand.reachableEntries,base.report.allModeDemand.reachableEntries
      + report.allModeDemand.newlyGainedEntries - report.allModeDemand.newlyLostEntries);
    cases.push(report);
  }
  assert.equal(await fs.readFile(path,'utf8'), text);
  results.push({save, sha256:hash(text), clock:game.clock, stations:Object.keys(game.net.stations).length,
    mapSize:[game.city.W,game.city.H], cases});
}
const report = {method:'Current restore through pre-solve, then rebuild only car graph and zone connectors. Same six-purpose OD rows before mode choice for every variant. Connectivity requires at least one road component common to both ends. Zone connectors cannot be used as intermediate links. Population and jobs from restored model.zPop/zJobs. Nearest access is the modeled straight-line connection from the geometric zone center. No jump or traffic solve in this probe.',
  sourceSHA256, results};
await fs.writeFile(new URL('access.json',dir),JSON.stringify(report,null,2)+'\n');
for(const r of results) for(const c of r.cases) {
  const d = c.allModeDemand;
  console.log(r.stations, c.minimumCarClass, c.nodes, c.directedArcs, 'OD mass reachable %',
    (100*d.reachableMass/d.mass).toFixed(2), 'nearest entry m', c.access.meanNearestEntryMetersAmongConnectedResidents.toFixed(1));
}
