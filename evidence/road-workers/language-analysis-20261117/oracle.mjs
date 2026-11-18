// From the project root: node evidence/road-workers/language-analysis-20261117/oracle.mjs CAPTURE [REPORT]
// bench-early-stop.mjs recreates the local V8 allocation capture from the test save.
// Original production Dijkstra, with additional counters only. No timing.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import v8 from 'node:v8';

const [capturePath, reportPath] = process.argv.slice(2);
assert.ok(capturePath, 'Expected a V8 allocation capture');
const raw = fs.readFileSync(capturePath);
const { G, time, run, pS, pD } = v8.deserialize(raw);
const source = fs.readFileSync('js/sim.js', 'utf8');
const hash = data => createHash('sha256').update(data).digest('hex');
const { roadFunctions } = await import(pathToFileURL(path.resolve('evidence/road-workers/early-stop.mjs')));
const needle = 'if (nd < dist[v]) {';
assert.equal(source.slice(0, source.indexOf('  function carOriginRow')).split(needle).length, 2);
const measured = source.replace(needle,
  'if (dist[v] <= du) W.cannotImprove++;' +
  'if (nd === dist[v] && W.pred[v] !== a) {' +
  '  W.equal++; if (Math.fround(W.dkm[u]+arcKm[a]) !== W.dkm[v]) W.equalDifferentKm++;' +
  '} if (nd < dist[v]) { W.relax++;');
const { carTree, carWork } = roadFunctions(measured);
const W = carWork(G);
W.cannotImprove = W.equal = W.equalDifferentKm = W.relax = 0;
const rank = new Int32Array(G.nN), selected = new Uint8Array(G.nN);
const initialSignatures = new Set(), nodeSets = new Set(), gates = new Set();
const degree = Array(16).fill(0);
let outArcIdentity = 0;
for (let a = 0; a < G.nA; a++) if (G.outArc[a] === a) outArcIdentity++;
for (let n = 0; n < G.nN; n++) degree[Math.min(15, G.outStart[n+1]-G.outStart[n])]++;
let total = 0, sumReachable = 0, sumBest = 0, allArc = 0, reachArc = 0, perfectArc = 0;
let destCount = 0, allUnreachable = 0, tiedDest = 0, uniqWinning = 0, winningPathEdges = 0;
for (const o of run) {
  const conn = [];
  for (let k = G.start[o]; k < G.start[o+1]; k++) {
    conn.push([G.nodes[k], G.times[k], G.km[k]]);
    gates.add(G.nodes[k]);
  }
  initialSignatures.add(JSON.stringify(conn));
  nodeSets.add(JSON.stringify(conn.map(x => x[0]).sort((a,b) => a-b)));
  // need=0 forces an exhaustive tree (baseline independently exhausts all heaps).
  const no = carTree(G, time, o, W, 0, 1);
  total += no;
  rank.fill(0);
  selected.fill(0);
  for (let i = 0; i < no; i++) rank[W.order[i]] = i + 1;
  let reachRank = 0, winRank = 0;
  for (let q = pS[o]; q < pS[o+1]; q++) {
    const d = pD[q];
    if (o === d) continue;
    destCount++;
    let best = 1e30, bn = -1, tied = false;
    for (let k = G.start[d]; k < G.start[d+1]; k++) {
      const n = G.nodes[k], cost = W.dist[n] + G.times[k];
      reachRank = Math.max(reachRank, rank[n]);
      if (cost < best) { best = cost; bn = n; tied = false; }
      else if (cost === best && best < 1e30) tied = true;
    }
    if (bn < 0) allUnreachable++;
    else {
      winRank = Math.max(winRank, rank[bn]);
      if (tied) tiedDest++;
      if (!selected[bn]) { selected[bn] = 1; uniqWinning++; }
    }
  }
  sumReachable += reachRank;
  sumBest += winRank;
  for (let i = 0; i < no; i++) {
    const n = W.order[i], nArcs = G.outStart[n+1] - G.outStart[n];
    allArc += nArcs;
    // The real target stop runs before scanning the final settled node's arcs.
    if (i + 1 < reachRank) reachArc += nArcs;
    if (i + 1 < winRank) perfectArc += nArcs;
  }
  for (let i = no-1; i >= 0; i--) {
    const n = W.order[i], a = W.pred[n];
    if (selected[n] && a >= 0) { winningPathEdges++; selected[G.arcFrom[a]] = 1; }
  }
}
assert.equal(total, 8858437);
assert.equal(allArc, 25335318);
const out = { sha:hash(raw), simSourceSHA256:hash(source), firstTimeSHA256:hash(Buffer.from(time.buffer,time.byteOffset,time.byteLength)), run:run.length,
  orderedUniqueSources:initialSignatures.size, uniqueSourceNodeSets:nodeSets.size, gates:gates.size, degree, outArcIdentity,
  arcs:G.nA, total, sumReachable, sumBest, allArc, reachArc, perfectArc, reachSavings:1-sumReachable/total,
  winningSavings:1-sumBest/total, reachArcSavings:1-reachArc/allArc, winningArcSavings:1-perfectArc/allArc,
  destCount, allUnreachable, withTiedBestDestAccess:tiedDest, equalCostAlternatePred:W.equal, tiesDifferentPredKm:W.equalDifferentKm,
  relax:W.relax, skipRelaxEligible:W.cannotImprove, uniqTargetNodes:uniqWinning, kmInWinningPath:winningPathEdges };
console.log(JSON.stringify(out, null, 2));
if (reportPath) fs.writeFileSync(reportPath, JSON.stringify(out, null, 2)+'\n');
