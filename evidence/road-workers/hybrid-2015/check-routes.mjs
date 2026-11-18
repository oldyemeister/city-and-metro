// Run in the repo root with a V8-serialized 2015 road allocation and a JSON output path.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {deserialize} from 'node:v8';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {extendGraph, workerSource} from './hybrid.mjs';

const shortKm = Number(process.argv[4] ?? 5);
assert.ok(Number.isFinite(shortKm) && shortKm>=0);
const tol = 0.0004;
const [samplePath, output] = process.argv.slice(2);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = readFileSync('js/sim.js','utf8');
const original = vm.runInNewContext('const INF=1e30;\n' + source.slice(source.indexOf('  function carTree('),source.indexOf('  // 工作线程入口：收到道路图')) + '\n({carOriginRow,carWork})');
assert.ok(original.carWork && original.carOriginRow);
const i32 = values => Int32Array.from(values), f32 = values => Float32Array.from(values);

function graphForTests() {
  // Two feeder arcs at both ends. An interior class-2 shortcut is legal only on the short trip.
  // The reverse direction is deliberately slower on every local arc and faster on the motorway.
  const edges = [[0,1,2,0.25,0.5,1.2],[1,2,2,0.5,1,1.4],
    [2,3,3,2,3,1.5],[3,4,4,3,4,2],[4,5,2,0.5,0.5,1.3],
    [5,6,2,0.25,1,1.6],[2,7,2,0.5,0.4,0.8],[7,4,2,0.5,0.4,0.8],[8,9,2,0.5,1,2]];
  const nN = 10, nA = edges.length * 2, Z = 9;
  const arcFrom = [], arcTo = [], arcKm = [], time = [], adjacency = Array.from({length:nN},()=>[]);
  for (const [u,v,,km,t,tr] of edges) {
    adjacency[u].push(arcFrom.length); adjacency[v].push(arcFrom.length+1);
    arcFrom.push(u,v); arcTo.push(v,u); arcKm.push(km,km); time.push(t,tr);
  }
  const outStart = [0];
  for (const arcs of adjacency) outStart.push(outStart.at(-1)+arcs.length);
  const connectors = [[[0,1,0.125]],[],[],[],[],[[6,2,0.25]],[[6,2,0.25]],[],[[8,1,0.125]]];
  const nodes = [], times = [], km = [], zones = [], start=[0];
  for (const [z,conns] of connectors.entries()) {
    for (const [node,t,k] of conns) { nodes.push(node);times.push(t);km.push(k);zones.push(z); }
    start.push(nodes.length);
  }
  return {G:{Z,nA,nN,id:1,outStart:i32(outStart),outArc:i32(adjacency.flat()),arcTo:i32(arcTo),arcFrom:i32(arcFrom),arcKm:Float64Array.from(arcKm),nodes:i32(nodes),start:i32(start),times:Float64Array.from(times),km:Float64Array.from(km),zones:i32(zones)}, time:f32(time),linkClass:Uint8Array.from(edges,x=>x[2]),zoneCols:9,zoneKm:1};
}
function block(origin, dest, time, dem) {
  return {origins:i32([origin]), tStart:i32([0,dest.length]),tDest:i32(dest), dem:f32(dem), time};
}
function near(a,b,name) { assert.ok(Math.abs(a-b)<=tol,`${name}: ${a} != ${b}`); }
function verifyUnit(result, gd, o, d, isShort) {
  const {G,time,linkClass} = gd, obsT=result.rowsT[0], obsK=result.rowsK[0];
  let roadT=0, roadKm=0, nArcs=0;
  const outgoing = new Map(), flows = new Map();
  for (let a=0;a<G.nA;a++) {
    const f=result.aux[a];
    assert.ok(Number.isInteger(f) && f>=0,`unit flow on arc ${a}: ${f}`);
    if (!f) continue;
    nArcs+=f; roadT+=time[a]*f; roadKm+=G.arcKm[a]*f;
    flows.set(a,f);
    const u=G.arcFrom[a]; if (!outgoing.has(u)) outgoing.set(u,[]);
    outgoing.get(u).push(a);
  }
  if (Number.isNaN(obsT)) { assert.ok(Number.isNaN(obsK));assert.equal(nArcs,0);return null; }
  function trail(u,last,remaining,phase,path) {
    if (remaining===0) return u===last ? path.slice() : null;
    for (const a of outgoing.get(u) || []) {
      if (!flows.get(a)) continue;
      const major=linkClass[a>>1]>=3;
      if (!isShort && phase===2 && major) continue;
      const next=major ? 1 : phase===0 ? 0 : 2;
      flows.set(a,flows.get(a)-1);path.push(a);
      const found=trail(G.arcTo[a],last,remaining-1,next,path);
      flows.set(a,flows.get(a)+1);path.pop();
      if (found) return found;
    }
    return null;
  }
  for (let i=G.start[o];i<G.start[o+1];i++) for(let j=G.start[d];j<G.start[d+1];j++) {
    if (Math.abs(roadT+G.times[i]+G.times[j]-obsT)>tol || Math.abs(roadKm+G.km[i]+G.km[j]-obsK)>tol) continue;
    const path=trail(G.nodes[i],G.nodes[j],nArcs,0,[]);
    if (path) return {path, classes:path.map(a=>linkClass[a>>1])};
  }
  assert.fail(`Could not reconstruct ${o} -> ${d}: ${nArcs} real arcs, ${obsT} min, ${obsK} km`);
}
function zoneDistance(o,d,cols,km){return km*Math.hypot(o%cols-d%cols,Math.floor(o/cols)-Math.floor(d/cols));}

// Every unrestricted first doorway reachable on local roads, without a cap on candidates.
function possibleBackbones(gd) {
  const {G,linkClass}=gd;
  const isMajor=new Uint8Array(G.nN), component=new Int32Array(G.nN).fill(-1);
  for(let a=0;a<G.nA;a++) if(linkClass[a>>1]>=3) isMajor[G.arcFrom[a]]=1;
  const components=[], work=[];
  for(let root=0;root<G.nN;root++){
    if(component[root]>=0) continue;
    const id=components.length;
    components.push({major:Boolean(isMajor[root]),gates:new Set()});
    work.push(root);component[root]=id;
    while(work.length){
      const u=work.pop();
      for(let i=G.outStart[u];i<G.outStart[u+1];i++){
        const a=G.outArc[i],v=G.arcTo[a];
        if(component[v]>=0 || isMajor[u]!==isMajor[v] || (linkClass[a>>1]>=3)!==Boolean(isMajor[u])) continue;
        component[v]=id;work.push(v);
      }
    }
  }
  for(let a=0;a<G.nA;a++){
    const u=G.arcFrom[a],v=G.arcTo[a];
    if(!isMajor[u] && isMajor[v]) components[component[u]].gates.add(component[v]);
  }
  return Array.from({length:G.Z},(_,z)=>{
    const set=new Set();
    for(let k=G.start[z];k<G.start[z+1];k++){
      const id=component[G.nodes[k]], c=components[id];
      if(c.major) set.add(id);
      else for(const gateway of c.gates) set.add(gateway);
    }
    return set;
  });
}

const moduleBytes=Buffer.from(readFileSync('js/road-kernel.js','utf8').match(/const bytes='([^']+)'/)[1],'base64');
const module=new WebAssembly.Module(moduleBytes);
const originalFns=source.slice(source.indexOf('  function carTree('),source.indexOf('  function carWorkerMain('));
const make=vm.runInThisContext('(function(){const INF=1e30;\n'+originalFns+'\n'+readFileSync('src-sim/road-worker.js','utf8')+'\n'+workerSource()+'\nreturn makeHybridKernel;})()');
function solveFor(gd,cutoff=shortKm) {
  const {G,linkClass,zoneCols,zoneKm}=gd;
  const arcClass=Uint8Array.from(G.arcTo,(_,a)=>linkClass[a>>1]);
  const model={ZW:zoneCols,zoneKm,arcClass,road:{links:Array.from(linkClass,cls=>({cls}))}};
  extendGraph(G,model,cutoff);
  const kernel=make(G,module);
  return m=>kernel.solve(m);
}

const toy=graphForTests();
const sampleKernel=solveFor(toy,5);
const cases=[
  {o:0,d:5,path:[0,2,12,14,8,10]}, // Exactly 5 km, uses the interior class-2 shortcut.
  {o:0,d:6,path:[0,2,4,6,8,10]},  // Same access node at the destination, 6 km trip.
  {o:6,d:0,path:[11,9,7,5,3,1]}, // Opposite direction with own weights.
  {o:0,d:8,path:null},           // Destination on road component without a major road.
  {o:8,d:0,path:null},
  {o:0,d:7,path:null},           // No access node.
  {o:0,d:0,path:null}            // Production skips intrazonal skim.
];
for(const {o,d,path} of cases) {
  const result=sampleKernel(block(o,[d],toy.time,[1]));
  const used=verifyUnit(result,toy,o,d,Math.abs(o-d)<=5);
  assert.deepEqual(used?.path ?? null,path);
}
const mixed=sampleKernel({origins:i32([0,6]), tStart:i32([0,3,4]),tDest:i32([5,6,8,0]),dem:f32([3,4,8,2]),time:toy.time});
const expected=new Float32Array(toy.G.nA);
for(const [i,f] of [3,4,2].entries()) for(const a of cases[i].path) expected[a]+=f;
assert.deepEqual(Array.from(mixed.aux),Array.from(expected));

const bytes=readFileSync(samplePath);
const actual=deserialize(bytes), {G,time,run,pS,pD,dem,zoneCols,zoneKm}=actual;
assert.equal(actual.fixtureSHA256, 'a2e1a3cc1fce0982d0b2e8e557ebb445ff8a7b921d01a71888eda03ac1a56f00');
assert.equal(G.nA,30272);
const solve=solveFor(actual), work=original.carWork(G);
const refT=new Float32Array(pD.length).fill(NaN),refK=new Float32Array(pD.length).fill(NaN);
const aux=new Float32Array(G.nA);
for(const o of run) original.carOriginRow(G,time,o,pD,pS[o],pS[o+1],dem,work,refT,refK,0,aux);
const counters=()=>({requests:0,carDemand:0,originalUnreachable:0,hybridUnreachable:0,newLoss:0,lostCarDemand:0,baselineRoutedCarDemand:0,originalReachable:0,gained:0,common:0,exactCost:0,exactKm:0,maxFasterMin:0,maxSlowerMin:0,sameKmDiff:0,commonDemand:0,demandTimeChange:0});
const groups={short:counters(),long:counters()};
const possible=possibleBackbones(actual);
const atMajor=new Uint8Array(G.nN);
for(let a=0;a<G.nA;a++) if(actual.linkClass[a>>1]>=3) atMajor[G.arcFrom[a]]=1;
const mustFeed=Array.from({length:G.Z},(_,z)=>G.start[z]<G.start[z+1] &&
  !G.nodes.subarray(G.start[z],G.start[z+1]).some(n=>atMajor[n]));
const losses={noLegalTrunkPath:0,noLegalTrunkPathDemand:0,legalPathOmitted:0,legalPathOmittedDemand:0};

const samples=new Map();
for(let b=0;b<32;b++) {
  const os=run.slice(Math.floor(run.length*b/32),Math.floor(run.length*(b+1)/32));
  const starts=[0],ds=[],dd=[];
  for(const o of os) {
    for(let q=pS[o];q<pS[o+1];q++){ds.push(pD[q]);dd.push(dem[q]);}
    starts.push(ds.length);
  }
  const msg={origins:i32(os),tStart:i32(starts),tDest:i32(ds),dem:f32(dd),time};
  const result=solve(msg);
  for(const [i,o] of os.entries()) for(let k=starts[i];k<starts[i+1];k++) {
    const q=pS[o]+k-starts[i],d=ds[k];
    if(o===d)continue;
    const isShort=zoneDistance(o,d,zoneCols,zoneKm)<=shortKm;
    const group=isShort?groups.short:groups.long;
    const t=result.rowsT[k],km=result.rowsK[k],rt=refT[q],rk=refK[q],mass=dd[k];
    group.requests++;group.carDemand+=mass;
    if(!Number.isFinite(rt))group.originalUnreachable++;
    else {group.originalReachable++;group.baselineRoutedCarDemand+=mass;}
    if(!Number.isFinite(t)) group.hybridUnreachable++;
    if(Number.isFinite(rt) && !Number.isFinite(t)) {
      group.newLoss++;group.lostCarDemand+=mass;
      if(!isShort){
        const reason=[...possible[o]].some(id=>possible[d].has(id)) ? 'legalPathOmitted' : 'noLegalTrunkPath';
        losses[reason]++; losses[reason+'Demand']+=mass;
      }
    }
    if(!Number.isFinite(rt) && Number.isFinite(t)) group.gained++;
    if(isShort) {
      assert.equal(Number.isFinite(rt),Number.isFinite(t),'short reachability');
      if(Number.isFinite(rt)) {near(t,rt,'short route minutes');near(km,rk,'short km');}
    }
    if(!Number.isFinite(t) || !Number.isFinite(rt)) continue;
    assert.ok(Number.isFinite(km) && km>=0);
    assert.ok(t>=rt-tol,`hybrid faster than unrestricted graph ${o}->${d} ${t} ${rt}`);
    group.common++;group.exactCost+=t===rt;group.exactKm+=km===rk;
    group.maxFasterMin=Math.max(group.maxFasterMin,rt-t);
    group.maxSlowerMin=Math.max(group.maxSlowerMin,t-rt);
    group.sameKmDiff=Math.max(group.sameKmDiff,Math.abs(km-rk));
    group.commonDemand+=mass;group.demandTimeChange+=mass*(t-rt);
    const rank=Math.imul(q+1,1199540897)>>>0;
    const bucket=rank%19;
    const category=isShort ? 'short' : mustFeed[o] && mustFeed[d] ? 'long-two-feeders' : t-rt>0.05 ? 'long-detour' : 'long-equal';
    const key=category+'-'+bucket;
    if(mass>0 && rank<(samples.get(key)?.rank ?? Infinity)) samples.set(key,{o,d,isShort,rank});
  }
}
assert.equal(groups.short.gained+groups.short.newLoss+groups.long.gained,0);
const unitTests={traced:0,long:0,longUsingFeeder:0,longUsingFeederAtEachEnd:0};
for (const {o,d,isShort} of samples.values()) {
  const result=solve(block(o,[d],time,[1]));
  const {classes}=verifyUnit(result,actual,o,d,isShort);
  unitTests.traced++;
  if (!isShort) {
    unitTests.long++;unitTests.longUsingFeeder+=classes.includes(2);
    unitTests.longUsingFeederAtEachEnd+=Number(classes[0]===2 && classes.at(-1)===2);
  }
}
assert.ok(unitTests.longUsingFeederAtEachEnd>0);
const report={shortKm,sampleSHA256:hash(bytes),fixtureSHA256:actual.fixtureSHA256,stockSimSHA256:hash(source),hybridSHA256:hash(readFileSync(new URL('hybrid.mjs',import.meta.url))),
  method:'First restored weekday road allocation. Requested off-diagonal zone pairs with an origin scheduled to run. Short rows compare to the original full tree under the same arc times, before congestion feedback. Single-pair checks reassemble directed unit arc flows into a complete original-connector path, reproduce the cost and length including both connectors, and prohibit an interior feeder between major arcs on long trips.',
  zones:G.Z,origins:run.length,fullGraph:{nodes:G.nN,arcs:G.nA},demandUnit:'passenger vehicles per model period hour',groups,losses,unitTests,manualSyntheticCases:cases.length+1};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({groups,unitTests}));
