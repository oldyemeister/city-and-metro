// Run from the repo root with: node .../profile-allocation.mjs capture.bin js-reference.json result.json
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import {plainBytes, instrumentedBytes, createProbe} from './wasm-probe.mjs';

const [capturePath, referencePath, resultPath] = process.argv.slice(2);
const reference = JSON.parse(readFileSync(referencePath));
const hash = data => createHash('sha256').update(data).digest('hex');
const raw = readFileSync(capturePath);
assert.equal(hash(raw), reference.captureSHA256);
const {G, run, pS, pD, dem, time} = deserialize(raw);
const embedded = readFileSync('js/road-kernel.js', 'utf8');
assert.equal(hash(embedded), reference.kernelSHA256);
const window = {CM:{}};
new Function('window', embedded)(window);
const adapter = window.CM.RoadKernel.worker.toString();
const sim = readFileSync('js/sim.js', 'utf8');
const guard = /if \(module && nt >= n \* G\.Z \* ([\d.]+)\)/g;
const thresholds = [...sim.matchAll(guard)];
assert.equal(thresholds.length, 1);
const cutoff = Number(thresholds[0][1]);

const blocks = reference.blocks.map(({block, pairs, origins:count}) => {
  const nb = reference.blocks.length;
  const origins = Int32Array.from(run.slice(Math.floor(block * run.length / nb), Math.floor((block + 1) * run.length / nb)));
  assert.equal(origins.length, count);
  const dense = new Float32Array(count * G.Z);
  let requested = 0;
  origins.forEach((o, i) => {
    for (let q = pS[o]; q < pS[o + 1]; q++) {
      dense[i * G.Z + pD[q]] = dem[q];
      requested++;
    }
  });
  assert.equal(requested, pairs);
  return {origins, dem:dense, time, qualifies:requested >= dense.length * cutoff};
});

const phases = ['tree', 'destinations', 'reverse', 'residual'];
const fields = ['outerMs', ...phases];
function buildVariant(bytes, probe) {
  const module = new WebAssembly.Module(bytes);
  // Keep both arms on the shipped memory/adapter path. The two outer clocks bracket only the export.
  const instanceAnchor = 'new WebAssembly.Instance(module,{})';
  const solveAnchor = 'if(!e.solve(n))';
  for (const anchor of [instanceAnchor, solveAnchor]) assert.equal(adapter.split(anchor).length, 2);
  const timedAdapter = adapter.replace(instanceAnchor, 'new WebAssembly.Instance(module,imports)')
    .replace(solveAnchor, 'if(!timeExport(e,n))');
  let outerMs = 0;
  const timeExport = (e,n) => {
    const start = performance.now();
    const success = e.solve(n);
    outerMs = performance.now() - start;
    return success;
  };
  const make = new Function('imports', 'timeExport', 'return (' + timedAdapter + ')');
  const kernel = make(probe?.imports ?? {}, timeExport)(module, G);
  return block => {
    probe?.reset();
    const result = kernel.solve(block);
    const stage = probe?.snapshot();
    if (stage) {
      assert.equal(stage.blocks, 1);
      assert.equal(stage.origins, block.origins.length);
      for (const field of phases) assert.ok(Number.isFinite(stage[field]) && stage[field] >= 0, field);
    }
    return {result, clocks:{outerMs, ...stage}};
  };
}
const original = plainBytes(), observed = instrumentedBytes();
assert.equal(hash(original), hash(Buffer.from(embedded.match(/const bytes='([^']+)'/)[1], 'base64')));
const variants = {stock:buildVariant(original, null), probe:buildVariant(observed, createProbe())};
const denseReference = [];
function pass(name) {
  const activeFields = name === 'probe' ? fields : ['outerMs'];
  const zero = () => Object.fromEntries(activeFields.map(field => [field, 0]));
  const totals = {all:zero(), qualifying:zero()};
  const times = new Float32Array(pD.length).fill(NaN), kms = times.slice(), flow = new Float32Array(G.nA);
  for (const [index, block] of blocks.entries()) {
    const {result:{rowsT, rowsK, aux}, clocks} = variants[name](block);
    for (const field of activeFields) {
      totals.all[field] += clocks[field];
      if (block.qualifies) totals.qualifying[field] += clocks[field];
    }
    const denseHashes = [hash(rowsT), hash(rowsK)];
    if (!denseReference[index]) denseReference[index] = denseHashes;
    else assert.deepEqual(denseHashes, denseReference[index], 'Full dense rows in block ' + index);
    block.origins.forEach((o,i) => {
      for (let q = pS[o]; q < pS[o+1]; q++) {
        const k = i * G.Z + pD[q];
        times[q] = rowsT[k];
        kms[q] = rowsK[k];
      }
    });
    assert.equal(hash(aux), reference.blocks[index].flowSHA256);
    for (let a = 0; a < flow.length; a++) flow[a] += aux[a];
  }
  assert.equal(hash(times), reference.timeSHA256);
  assert.equal(hash(kms), reference.kmSHA256);
  assert.equal(hash(flow), reference.mergedFlowSHA256);
  return totals;
}
// Preflight equality before collecting timing. The next pair provides an additional warmup per arm.
const preflightOrder = ['stock', 'probe'];
for (const v of preflightOrder) pass(v);
for (const v of [...preflightOrder].reverse()) pass(v);
const pairs = [];
for (let i = 0; i < 6; i++) {
  const order = i % 2 ? ['probe','stock'] : ['stock','probe'];
  const row = {order};
  for (const name of order) row[name] = pass(name);
  pairs.push(row);
}
function stats(values) {
  const sorted = [...values].sort((a,b) => a-b), n = sorted.length;
  return {min:sorted[0], median:(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2, max:sorted[n-1]};
}
const summary = {};
for (const group of ['all','qualifying']) {
  const values = pairs.map(row => row.probe[group]);
  summary[group] = {
    stockMs:stats(pairs.map(row => row.stock[group].outerMs)),
    probeMs:stats(values.map(row => row.outerMs)),
    pairedProbeMinusStockMs:stats(pairs.map(row => row.probe[group].outerMs - row.stock[group].outerMs)),
    phases:Object.fromEntries(phases.map(key => [key, {
      ms:stats(values.map(row => row[key])),
      sharePct:stats(values.map(row => 100 * row[key] / row.outerMs))
    }]))
  };
}
const report = {node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,
  method:'Shipped WASM and exact bytecode with phase probes, persistent instances in one Node isolate. Timers bracket exported solve only. Two warmup passes (first verifies stock/probe correctness before timed pairs), six measured pairs with alternating arm order. Both arms compute all 32 blocks. Qualifying group filters blocks meeting the actual shipping cutoff. Hashing, adapter copies and JS input preparation outside measured export. Phase shares divide by observed outer solve. Blocks are summed within each pass before taking median across passes.',
  correctness:'Each pass checks all requested time/km (including NaNs), each block flow and ordered merged flow against the pinned synchronous-JS hashes. All dense time/km rows including unrequested pairs also match stock WASM on every block and pass.',
  captureSHA256:hash(raw),moduleSHA256:hash(original),probeSHA256:hash(observed),embeddedSHA256:hash(embedded),simSHA256:hash(sim),
  cutoff,zones:G.Z,nodes:G.nN,arcs:G.nA,origins:run.length,requests:reference.pairs,blocks:blocks.length,
  qualifyingBlocks:blocks.filter(b=>b.qualifies).length,verifiedPassesPerArm:8,summary,pairs};
writeFileSync(resultPath, JSON.stringify(report,null,2)+'\n');
console.log(resultPath, JSON.stringify(report.summary));
