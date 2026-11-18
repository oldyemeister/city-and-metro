// Run from repository root. Arguments are LABEL, V8_CAPTURE, OUTPUT_JSON, optional standard GAME_EXPORT.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import v8 from 'node:v8';
import { roadFunctions } from '../early-stop.mjs';

const [scenario, capturePath, outPath, savePath] = process.argv.slice(2);
assert.ok(scenario && capturePath && outPath);
const hash = data => createHash('sha256').update(data).digest('hex');
const raw = fs.readFileSync(capturePath);
const {G, time, run, pS, pD, dem, W, H, zoneSize, cellMeters} = v8.deserialize(raw);
// The old Shanghai 2000 capture omitted grid metadata. Its 152x152 cells are the map's production configuration.
const width = W ?? 152, height = H ?? 152, zone = zoneSize ?? 4, cellKm = (cellMeters ?? 250) / 1000;
assert.equal(width*height/(zone*zone), G.Z);
const zw = width / zone, sizeKm = zone*cellKm;
const sim = fs.readFileSync('js/sim.js','utf8');
const needle = '    return no;';
assert.equal(sim.slice(0,sim.indexOf('  function carOriginRow')).split(needle).length, 2);
const {carWork,carOriginRow} = roadFunctions(sim.replace(needle,'    W.settled += no; return no;'));
const work = carWork(G);
work.settled = 0;
const T = new Float32Array(pD.length).fill(NaN), K = T.slice(), aux = new Float32Array(G.nA);
let pairs = 0, positive = 0, demand = 0, roadDemand = 0;
let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
let straightSum=0, straightWeighted=0, straightLocal=0, straightLocalMass=0;
let roadSum=0, roadWeighted=0, roadLocal=0, roadLocalMass=0;
const straight=[], road=[], perOrigin=[], blockDensities=[], perOriginReach=[];
function touch(z) {
  const x = z%zw, y = Math.floor(z/zw);
  x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y);
}
for (let b=0;b<32;b++) {
  const start = Math.floor(run.length*b/32), stop = Math.floor(run.length*(b+1)/32);
  let blockPairs = 0;
  aux.fill(0);
  for (let i=start;i<stop;i++) {
    const o = run[i], before = work.settled;
    carOriginRow(G,time,o,pD,pS[o],pS[o+1],dem,work,T,K,0,aux);
    perOriginReach.push((work.settled-before)/G.nN);
    const count = pS[o+1]-pS[o];
    blockPairs += count; perOrigin.push(count);
    touch(o);
    for (let q=pS[o];q<pS[o+1];q++) {
      const d=pD[q], mass=dem[q];
      assert.notEqual(o,d,'These scenarios use non-self OD layout');
      touch(d);
      const km=sizeKm*Math.hypot(o%zw-d%zw,Math.floor(o/zw)-Math.floor(d/zw));
      pairs++; demand+=mass;
      if (mass>0) positive++;
      straight.push(km); straightSum+=km; straightWeighted+=km*mass;
      if (km<=5) { straightLocal++; straightLocalMass+=mass; }
      if (!Number.isFinite(K[q])) continue;
      road.push(K[q]); roadSum+=K[q]; roadWeighted+=K[q]*mass; roadDemand+=mass;
      if (K[q]<=5) { roadLocal++; roadLocalMass+=mass; }
    }
  }
  if (stop>start) blockDensities.push(blockPairs/((stop-start)*G.Z));
}
function dist(values) {
  const sorted=values.sort((a,b)=>a-b);
  const q=p=>sorted[Math.max(0,Math.ceil(p*sorted.length)-1)];
  return {min:sorted[0],median:q(.5),p90:q(.9),p95:q(.95),max:sorted.at(-1)};
}
const activeDiagonalKm=sizeKm*Math.hypot(x1-x0,y1-y0);
const straightStats=dist(straight), roadStats=dist(road);
if (savePath) {
  const env=JSON.parse(fs.readFileSync(savePath,'utf8'));
  const p=JSON.parse(env.body);
  var fixture={sha256:hash(fs.readFileSync(savePath)),map:p.meta.map,seed:p.meta.seed,clock:p.clock,stations:Object.keys(p.net.stations).length,mode:p.meta.mode};
}
const out={scenario,fixture,simSourceSHA256:hash(sim),captureSHA256:hash(raw),
  zones:G.Z,origins:run.length,nodes:G.nN,arcs:G.nA,widthKm:width*cellKm,heightKm:height*cellKm,
  activeCenterBboxKm:{width:(x1-x0)*sizeKm,height:(y1-y0)*sizeKm,diagonal:activeDiagonalKm},
  activeCenterBboxDefinition:'Bounding box of centers of every requested origin and destination. Grid dimensions additionally include cell extents.',
  requested:pairs,positiveDemandPairs:positive,totalModeledCarDemand:demand,meanDestinations:pairs/run.length,
  destinationsPerOrigin:dist(perOrigin),density:pairs/run.length/G.Z,blockDensity:dist(blockDensities),
  meanSettledFraction:work.settled/run.length/G.nN,settledFractionPerOrigin:dist(perOriginReach),
  straightKm:{...straightStats,mean:straightSum/pairs,demandWeightedMean:straightWeighted/demand,
    fractionOfRequestedWithin5Km:straightLocal/pairs,fractionOfDemandWithin5Km:straightLocalMass/demand,
    p90OverActiveCenterDiagonal:straightStats.p90/activeDiagonalKm},
  roadKm:{...roadStats,reachablePairs:road.length,mean:roadSum/road.length,demandWeightedMean:roadWeighted/roadDemand,
    fractionOfReachableRequestedWithin5Km:roadLocal/road.length,fractionOfReachableDemandWithin5Km:roadLocalMass/roadDemand,
    reachableDemandFraction:roadDemand/demand},period:'first road allocation of following monthly jump; weekday period zero'};
assert.ok(positive>0 && demand>0 && road.length>0 && road.length<=pairs);
fs.writeFileSync(outPath,JSON.stringify(out,null,2)+'\n');
console.log(scenario,JSON.stringify({nN:G.nN,origins:run.length,cnt:out.meanDestinations,den:out.density,settled:out.meanSettledFraction,
  requestedWithin5Km:out.straightKm.fractionOfRequestedWithin5Km,demandWithin5Km:out.straightKm.fractionOfDemandWithin5Km,kmDemand:out.roadKm.demandWeightedMean}));
