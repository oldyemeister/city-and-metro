// Run from the repo root: node .../count-operations.mjs capture.bin results.json [--london-forced]
// Counters instrument the embedded Wasm directly. No compiler or external packages.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import inspector from 'node:inspector/promises';

const sha = x => createHash('sha256').update(x).digest('hex');
const embedded = fs.readFileSync('js/road-kernel.js','utf8');
const original = Buffer.from(embedded.match(/const bytes='([^']+)'/)[1],'base64');
const binarySHA256 = sha(original);
assert.equal(binarySHA256, '58a691130b3df19c45cd9c1dfbad81813866129f4bdf37be83212d3c606337ac');

// Each row names a Rust operation and the absolute module offset *before*
// the original instruction. Inspect the original via Debugger.disassembleWasmModule.
// For comparisons the bump has zero net stack effect, preserving both operands.
const sites = [
  ['originTrees',12580,'block $label40'],                         // validated origin enters tree; includes distance reset
  ['sourceGateVisits',12856,'block $label45'],
  ['sourceGatePushes',12901,'local.get $var10'],                   // improving source gate, before dist[v]=t
  ['sourcePushKeyComparisons',12982,'f64.le'],
  ['sourcePushMoves',12993,'local.get $var5'],                     // sift-up continues after failed stop
  ['pops',13118,'local.get $var9'],                                // guarded count>0, before reading root key
  ['popSiblingKeyComparisons',13257,'f64.lt'],                     // right child exists, pick right only on <
  ['popStopKeyComparisons',13276,'f64.ge'],                        // stop on child key >= last key
  ['popDownMoves',13287,'local.get $var5'],                        // sift-down moved child
  ['settledNodes',13392,'local.get $var22'],                       // take non-stale branch, append order
  ['outgoingArcScans',13497,'f64.lt'],                             // nd < dist[v]
  ['improvingArcs',13501,'local.get $var39'],
  ['relaxPushKeyComparisons',13600,'f64.le'],
  ['relaxPushMoves',13611,'local.get $var5'],
  ['candidateDestinations',13730,'block $label66'],                // zones[], before skipping origin
  ['nonSelfDestinations',13750,'block $label78'],
  ['destinationGateComparisons',13950,'f64.lt'],                  // dist[node] + egress cost < best
  ['destinationGateImprovements',13954,'local.get $var1'],
  ['reachableDenseDestinations',14056,'local.get $var70'],        // writes rows_t and rows_k
  ['positiveReachableDemandAssignments',14148,'block $label80'],  // branch taken when dem[off+d] > 0
  ['reverseNodeVisits',14440,'f64.gt'],                            // acc[node] > 0
  ['reversePositiveNodes',14444,'local.get $var4'],
  ['reverseArcPropagations',14471,'local.get $var4'],              // pred>=0; write aux[e] and acc[from[e]]
];

async function verifySites() {
  const session = new inspector.Session();
  session.connect();
  try {
    let scriptId;
    session.on('Debugger.scriptParsed',({params})=>{
      if(params.scriptLanguage==='WebAssembly') scriptId=params.scriptId;
    });
    await session.post('Debugger.enable');
    new WebAssembly.Instance(new WebAssembly.Module(original));
    const {chunk,totalNumberOfLines}=await session.post('Debugger.disassembleWasmModule',{scriptId});
    assert.equal(chunk.lines.length,totalNumberOfLines);
    for(const [name,offset,instruction] of sites) {
      const idx=chunk.bytecodeOffsets.indexOf(offset);
      assert.equal(chunk.lines[idx]?.trim(),instruction,name);
    }
  } finally { session.disconnect(); }
}

function readULEB(bytes,start) {
  let n=0,shift=0,i=start;
  for(;;) {
    const b=bytes[i++];
    n+=(b&127)*2**shift;
    if(!(b&128)) return [n,i];
    shift+=7; assert.ok(shift<=28);
  }
}
function encode(n) {
  const a=[];
  do { const low=n%128; n=Math.floor(n/128); a.push(low+(n?128:0)); } while(n);
  return Buffer.from(a);
}
const join = (...parts) => Buffer.concat(parts.map(p=>Buffer.from(p)));
function vectorAppend(bytes,added) {
  const [count,from]=readULEB(bytes,0);
  return join(encode(count+added.length),bytes.subarray(from),...added);
}
async function countModule() {
  await verifySites();
  const sections=[original.subarray(0,8)];
  for(let i=8;i<original.length;) {
    const id=original[i], [len,start]=readULEB(original,i+1);
    i=start+len;
    let bytes=original.subarray(start,i);
    if(id===6) { // Only one original global, no imports. Appending keeps all original indices.
      assert.equal(bytes[0],1);
      bytes=vectorAppend(bytes,sites.map(()=>[0x7e,1,0x42,0,0x0b])); // (mut i64) = 0
    }
    if(id===7) bytes=vectorAppend(bytes,sites.map(([name],k)=>
      join(encode(name.length),Buffer.from(name),[3],encode(k+1))));
    if(id===10) {
      const [functions,first]=readULEB(bytes,0);
      const codes=[encode(functions)];
      for(let off=first,index=0;index<functions;index++) {
        const [size,body]=readULEB(bytes,off);
        off=body+size;
        let code=bytes.subarray(body,off);
        if(index===7) { // exported solve; the compiler inlined tree and push
          const chunks=[];
          let pos=0;
          for(const [k,[,abs]] of sites.entries()) {
            const here=abs-start-body;
            assert.ok(here>=pos && here<size);
            chunks.push(code.subarray(pos,here),join([0x23],encode(k+1),[0x42,1,0x7c,0x24],encode(k+1)));
            pos=here;
          }
          chunks.push(code.subarray(pos)); code=Buffer.concat(chunks);
        }
        codes.push(encode(code.length),code);
      }
      bytes=Buffer.concat(codes);
    }
    sections.push(Buffer.from([id]),encode(bytes.length),bytes);
  }
  const bytes=Buffer.concat(sections);
  assert.ok(WebAssembly.validate(bytes));
  return bytes;
}
const binary=await countModule();
const countsModule=new WebAssembly.Module(binary);

// Use the shipped adapter and road Worker handler, including the actual threshold,
// dense scatter/gather, memory reuse and reply. Expose only the counter exports.
const env={CM:{}};
new Function('window',embedded)(env);
const adapter=env.CM.RoadKernel.worker.toString(), anchor='let views,capacity=0;';
assert.equal(adapter.split(anchor).length,2);
let exports;
const observedAdapter=new Function('receive','return ('+adapter.replace(anchor,'receive(e);'+anchor)+')')(e=>exports=e);
const sim=fs.readFileSync('js/sim.js','utf8');
let result;
const forceLondon=process.argv[4]==='--london-forced';
if(process.argv[4]) assert.ok(forceLondon);
let source=sim.slice(sim.indexOf('  function carTree('),sim.indexOf('  // 道路图（随 roadData'));
if(forceLondon) {
  const guard='module && nt >= n * G.Z * 0.10';
  assert.equal(source.split(guard).length,2);
  source=source.replace(guard,'module');
}
const onmessage=new Function('roadKernelWorker','postMessage','"use strict"; const INF=1e30;let onmessage;'+source+'\ncarWorkerMain();return onmessage;')(observedAdapter,r=>result=r);
const readCounts = () => Object.fromEntries(sites.map(([name])=>[name,Number(exports[name].value)]));

function toyCheck() {
  // 0->1 (6), 0->2 (1), 2->1 (1), 1->3 (1): first discovery of node 1 becomes stale.
  const I=Int32Array.from.bind(Int32Array),D=Float64Array.from.bind(Float64Array);
  const G={Z:4,nN:4,nA:4,outStart:I([0,2,3,4,4]),outArc:I([0,1,2,3]),arcFrom:I([0,0,1,2]),
    arcTo:I([1,2,3,1]),start:I([0,1,2,3,4]),nodes:I([0,1,2,3]),times:D([0,0,0,0]),km:D([0,0,0,0]),
    zones:I([0,1,2,3]),arcKm:D([1,1,1,1])};
  const solve=observedAdapter(countsModule,G);
  const answer=solve.solve({origins:I([0]),time:Float32Array.of(6,1,1,1),dem:Float32Array.of(0,3,0,2)});
  assert.deepEqual([...answer.rowsT],[NaN,2,1,3]);
  assert.deepEqual([...answer.aux],[0,5,2,5]);
  const expected={originTrees:1,sourceGateVisits:1,sourceGatePushes:1,sourcePushKeyComparisons:0,sourcePushMoves:0,
    pops:5,popSiblingKeyComparisons:0,popStopKeyComparisons:0,popDownMoves:0,settledNodes:4,outgoingArcScans:4,
    improvingArcs:4,relaxPushKeyComparisons:3,relaxPushMoves:3,candidateDestinations:4,nonSelfDestinations:3,destinationGateComparisons:3,destinationGateImprovements:3,
    reachableDenseDestinations:3,positiveReachableDemandAssignments:2,reverseNodeVisits:4,reversePositiveNodes:4,reverseArcPropagations:3};
  for(const [key,n] of Object.entries(expected))assert.equal(readCounts()[key],n,key);
  return readCounts();
}
const toyCounts=toyCheck();
// Five independent source gates, initial keys 5,4,3,2,1. Before popping the heap
// is [1,2,4,5,3]. Removing 1 compares (2,4), then (3,5) after moving 2.
// Removing 2 compares (3,4) and moves 3; removing 3 compares (5,4) and stops.
const int=Int32Array.from.bind(Int32Array), double=Float64Array.from.bind(Float64Array);
const fiveGates={Z:2,nN:5,nA:0,outStart:int([0,0,0,0,0,0]),outArc:int([]),arcFrom:int([]),arcTo:int([]),
  start:int([0,5,6]),nodes:int([0,1,2,3,4,0]),times:double([5,4,3,2,1,0]),km:double([0,0,0,0,0,0]),zones:int([0,1]),arcKm:double([])};
const fiveReply=observedAdapter(countsModule,fiveGates).solve({origins:int([0]),time:Float32Array.of(),dem:Float32Array.of(0,1)});
assert.deepEqual([...fiveReply.rowsT],[NaN,5]);
const fiveExpected={sourcePushKeyComparisons:6,sourcePushMoves:6,pops:5,popSiblingKeyComparisons:2,popStopKeyComparisons:4,popDownMoves:2,improvingArcs:0};
for(const [name,n] of Object.entries(fiveExpected)) assert.equal(readCounts()[name],n,name);
if(!process.argv[2]){console.log('Instrumented binary, all disassembly sites and tiny hand-checked graph passed.');process.exit(0);}
const file=forceLondon?'london-exact.json':'sh2010-exact.json';
const pinned=JSON.parse(fs.readFileSync(new URL('../dispatch-validation/'+file,import.meta.url)));
const raw=fs.readFileSync(process.argv[2]); assert.equal(sha(raw),pinned.captureSHA256);
const {G,time,run,pS,pD,dem}=deserialize(raw);
onmessage({data:{type:'graph',G,kernel:countsModule}});
const T=new Float32Array(pD.length).fill(NaN),K=T.slice(),flow=new Float32Array(G.nA);
const digest=a=>sha(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
let requested=0,positive=0;
const blocks=[];
for(let b=0;b<32;b++) {
  const origins=Int32Array.from(run.slice(Math.floor(run.length*b/32),Math.floor(run.length*(b+1)/32)));
  const tStart=new Int32Array(origins.length+1);
  origins.forEach((o,i)=>{tStart[i+1]=tStart[i]+pS[o+1]-pS[o];});
  const tDest=new Int32Array(tStart.at(-1)),demand=new Float32Array(tDest.length);
  origins.forEach((o,i)=>{
    tDest.set(pD.subarray(pS[o],pS[o+1]),tStart[i]);
    demand.set(dem.subarray(pS[o],pS[o+1]),tStart[i]);
  });
  requested+=tDest.length;
  for(const v of demand)if(v>0)positive++;
  onmessage({data:{type:'block',req:1,gid:G.id,b,time,origins,tStart,tDest,dem:demand}});
  assert.equal(result.kernel,true);assert.equal(result.b,b);
  origins.forEach((o,i)=>{
    T.set(result.rowsT.subarray(tStart[i],tStart[i+1]),pS[o]);
    K.set(result.rowsK.subarray(tStart[i],tStart[i+1]),pS[o]);
  });
  const flowSHA256=digest(result.aux);assert.equal(flowSHA256,pinned.blocks[b].flowSHA256);
  for(let i=0;i<flow.length;i++)flow[i]+=result.aux[i];
  blocks.push({b,origins:origins.length,requested:tDest.length,flowSHA256});
}
const counts=readCounts();
assert.equal(digest(T),pinned.timeSHA256);assert.equal(digest(K),pinned.kmSHA256);assert.equal(digest(flow),pinned.mergedFlowSHA256);
assert.equal(counts.originTrees,run.length);
assert.equal(counts.candidateDestinations,run.length*G.zones.length);
assert.equal(counts.pops,counts.sourceGatePushes+counts.improvingArcs);
assert.equal(counts.settledNodes,counts.reverseNodeVisits);
assert.equal(counts.nonSelfDestinations,counts.candidateDestinations-run.length);
let expectedGateCandidates=0,expectedSourceVisits=0;
for(const o of run) {
  expectedSourceVisits+=G.start[o+1]-G.start[o];
  for(const d of G.zones)if(d!==o)expectedGateCandidates+=G.start[d+1]-G.start[d];
}
assert.equal(counts.destinationGateComparisons,expectedGateCandidates);assert.equal(counts.sourceGateVisits,expectedSourceVisits);
assert.equal(positive,requested,'In this capture every requested OD has positive car demand');
assert.equal([...T].filter(Number.isFinite).length,counts.positiveReachableDemandAssignments);
const report={node:process.version,v8:process.versions.v8,simSHA256:sha(sim),rustSourceSHA256:sha(fs.readFileSync('src-sim/road.rs')),
  binarySHA256,instrumentedBinarySHA256:sha(binary),embeddedSHA256:sha(embedded),captureSHA256:sha(raw),
  dispatch:forceLondon?'Forced WASM on all 32 London blocks to examine kernel operations; actual game uses both paths.':'Actual 10% threshold, all 32 road blocks use WASM.',
  note:'Untimed counters, one full 32-block allocation. Only Wasm globals, their exports, and stack-neutral increments inside the embedded solve function are added to the binary. Reachable dense destinations include nonrequested zones. Counts describe logical operations, not time or hardware instructions.',
  graph:{origins:run.length,zones:G.Z,roadZones:G.zones.length,nodes:G.nN,arcs:G.nA,denseLayoutCells:run.length*G.Z,requested,positive},
  toyCounts,sites,counts,
  derived:{stalePops:counts.pops-counts.settledNodes,distResetCells:counts.originTrees*G.nN,denseOutputCellsWrittenAsPairs:counts.reachableDenseDestinations,
    reachableRequestedDestinations:counts.positiveReachableDemandAssignments,
    extraReachableUnrequestedDestinations:counts.reachableDenseDestinations-counts.positiveReachableDemandAssignments,
    heapKeyComparisons:counts.sourcePushKeyComparisons+counts.relaxPushKeyComparisons+counts.popSiblingKeyComparisons+counts.popStopKeyComparisons,
    upMoves:counts.sourcePushMoves+counts.relaxPushMoves},
  exact:{timeSHA256:digest(T),kmSHA256:digest(K),mergedFlowSHA256:digest(flow),blocks}};
fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({graph:report.graph,counts,derived:report.derived}));
