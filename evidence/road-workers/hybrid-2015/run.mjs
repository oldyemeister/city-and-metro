// A fresh process per run. The previous feasibility runner owns game restore, timing and snapshots.
// CM_SOURCE_ROOT may point at a frozen copy of js/ and index.html.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [variant, saveArgument, outputArgument, limitArgument = '5'] = process.argv.slice(2);
assert.ok(['full', 'hybrid', 'major'].includes(variant) && saveArgument && outputArgument);
const save = resolve(saveArgument), output = resolve(outputArgument);
const limit = Number(limitArgument);
assert.ok(Number.isFinite(limit) && limit >= 0);
if (process.env.CM_SOURCE_ROOT) process.chdir(process.env.CM_SOURCE_ROOT);
const sha = value => createHash('sha256').update(value).digest('hex');
const exp = {variant, limit, workers:new Map(), graphs:[], counts:{hybrid:0, stockJS:0, stockWASM:0}};
const routeCounts = {nearRequests:0, farRequests:0, nearMissing:0, farMissing:0, backboneWASMBlocks:0, backboneJSBlocks:0};
const hybrid = variant === 'hybrid' ? await import('./hybrid.mjs') : null;

function replaceOnce(text, anchor, replacement) {
  assert.equal(text.split(anchor).length,2, 'Runner/source anchor changed: ' + anchor);
  return text.replace(anchor, () => replacement);
}

function installHybridWorker() {
  let graph, kernel;
  onmessage = function (event) {
    const m = event.data;
    if (m.type === 'graph') {
      graph = m.G;
      kernel = makeHybridKernel(graph,m.kernel);
      return;
    }
    if (m.type !== 'block') throw new Error('Unexpected hybrid worker message');
    if (graph.id !== m.gid) throw new Error('Hybrid worker graph mismatch');
    const {rowsT,rowsK,aux,stats} = kernel.solve(m);
    if (rowsT.length !== m.tDest.length || rowsK.length !== rowsT.length || aux.length !== graph.nA)
      throw new Error('Invalid hybrid sparse block shape');
    postMessage({req:m.req,b:m.b,rowsT,rowsK,aux,hybrid:true,stats},[rowsT.buffer,rowsK.buffer,aux.buffer]);
  };
}

let workerId = 0;
globalThis.hybridExperiment = {
  sim(source) {
    if (!hybrid) return source;
    const anchor = '    return rd.G;';
    return replaceOnce(source,anchor,'    hybridExperiment.extend(rd.G, model);\n' + anchor);
  },
  extend(graph, model) {
    exp.graphs.push(hybrid.extendGraph(graph,model,limit));
  },
  worker(source) {
    if (!source.includes('function carWorkerMain()')) return {source,id:null};
    const id = ++workerId;
    exp.workers.set(id,0);
    if (hybrid) source += '\n' + hybrid.workerSource() + '\n(' + installHybridWorker.toString() + ')();\n';
    return {source,id};
  },
  onMessage(id, data) {
    if (id === null) return;
    assert.ok(!data.stale && data.rowsT && data.rowsK && data.aux);
    assert.equal(!!data.hybrid,!!hybrid);
    exp.workers.set(id,exp.workers.get(id)+1);
    exp.counts[data.hybrid ? 'hybrid' : data.kernel ? 'stockWASM' : 'stockJS']++;
    if (data.hybrid) {
      for (const key of ['nearRequests','farRequests','nearMissing','farMissing']) {
        assert.ok(Number.isSafeInteger(data.stats[key]) && data.stats[key]>=0);
        routeCounts[key] += data.stats[key];
      }
      if (data.stats.farRequests) routeCounts[data.stats.wasm ? 'backboneWASMBlocks' : 'backboneJSBlocks']++;
    }
  },
  cold() { exp.coldCounts = {...exp.counts}; exp.coldRoutes = {...routeCounts}; },
  write(report, road) {
    assert.equal(report.stations,342);
    assert.equal(report.clock.y,2015);
    assert.equal(report.action.line,'1 号线');
    assert.equal(exp.workers.size,4);
    assert.ok([...exp.workers.values()].every(n=>n>0));
    const expected = (report.actionRoadCalls + report.coldRoadCalls)*32;
    assert.equal(Object.values(exp.counts).reduce((a,b)=>a+b,0),expected);
    if (hybrid) assert.equal(exp.counts.hybrid,expected);
    report.method = 'Independent cold Node process with 4/2/2 Worker pools, actual service edit, all eight traffic periods. Times exclude browser rendering. Pre-edit metrics are calculated from a fresh restore of the unmodified export.';
    report.variant = variant;
    report.shortTripKm = hybrid ? limit : null;
    report.graph.zoneConnSHA256 = sha(JSON.stringify(road.zoneConn));
    report.workerResults = {cold:exp.coldCounts, action:Object.fromEntries(Object.keys(exp.counts).map(k=>[k,exp.counts[k]-exp.coldCounts[k]])),
      responsesByWorker:[...exp.workers.values()]};
    // CarPool's shipped boolean counter classifies custom responses as JS. Use the verified paths above.
    delete report.coldBlocks;
    delete report.actionBlocks;
    if (hybrid) {
      report.hybridGraphs=exp.graphs;
      report.routeCounts={cold:exp.coldRoutes,action:Object.fromEntries(
        Object.keys(routeCounts).map(k=>[k,routeCounts[k] - exp.coldRoutes[k]]))};
      report.hybridWorkerSourceSHA256=sha(hybrid.workerSource());
      report.hybridModuleSHA256=sha(readFileSync(new URL('./hybrid.mjs',import.meta.url)));
    }
    writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  },
};

const common = new URL('../osm-feasibility-20261118/model-ab.mjs', import.meta.url);
let runner = readFileSync(common,'utf8');
runner = replaceOnce(runner, '    constructor(url) {', '    constructor(url) {\n      const experimentWorker = hybridExperiment.worker(sources.get(url));');
runner = replaceOnce(runner, '+ sources.get(url) +', '+ experimentWorker.source +');
runner = replaceOnce(runner, "data => this.onmessage({data})", 'data => { hybridExperiment.onMessage(experimentWorker.id,data); this.onmessage({data}); }');
runner = replaceOnce(runner, '  vm.runInThisContext(source,', "  if (file === 'js/sim.js') source = hybridExperiment.sim(source);\n  vm.runInThisContext(source,");
runner = replaceOnce(runner, 'const restoreMs = performance.now() - start;', 'const restoreMs = performance.now() - start;\nhybridExperiment.cold();');
runner = replaceOnce(runner, "writeFileSync(out,JSON.stringify(report,null,2)+'\\n');", 'hybridExperiment.write(report,road);');
process.argv = [process.execPath,fileURLToPath(common),variant === 'major' ? '3' : '2',save,output];
await import('data:text/javascript;base64,'+Buffer.from(runner).toString('base64'));
