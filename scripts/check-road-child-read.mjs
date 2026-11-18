import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {candidateSource,roadFunctions} from '../evidence/road-workers/child-read.mjs';
const source=await fs.readFile('js/sim.js','utf8');
const base=roadFunctions(source),fast=roadFunctions(candidateSource(source));
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function graph(n,edges,connections){
  const arcs=edges.flatMap(([a,b,t])=>[[a,b,t],[b,a,t]]),out=Array.from({length:n},()=>[]);
  arcs.forEach(([a],i)=>out[a].push(i));const start=[0],oa=[];
  for(const a of out){oa.push(...a);start.push(oa.length);}
  const cs=[0],nodes=[],times=[],km=[];
  for(const a of connections){for(const [v,t] of a){nodes.push(v);times.push(t);km.push(t/60);}cs.push(nodes.length);}
  return {G:{nN:n,nA:arcs.length,Z:connections.length,outStart:Int32Array.from(start),outArc:Int32Array.from(oa),arcFrom:Int32Array.from(arcs.map(a=>a[0])),arcTo:Int32Array.from(arcs.map(a=>a[1])),arcKm:Float64Array.from(arcs.map(a=>a[2]/60)),start:Int32Array.from(cs),nodes:Int32Array.from(nodes),times:Float64Array.from(times),km:Float64Array.from(km)},time:Float32Array.from(arcs.map(a=>a[2]))};
}
let rows=0;
function compare({G,time},repeats=3){
  const wb=base.carWork(G),wf=fast.carWork(G),dest=Int32Array.from({length:G.Z},(_,i)=>i),dem=Float32Array.from(dest,(_,i)=>i%3?Math.fround(.1+i):0);
  for(let r=0;r<repeats;r++)for(let o=0;o<G.Z;o++){
    if(r===1){wb.stamp=wf.stamp=2147480000;}
    const run=(api,W)=>{const T=new Float32Array(G.Z).fill(NaN),K=T.slice(),flow=new Float32Array(G.nA);api.carOriginRow(G,time,o,dest,0,G.Z,dem,W,T,K,0,flow);return [T,K,flow];};
    const a=run(base,wb),b=run(fast,wf);for(let i=0;i<3;i++)assert.deepEqual(bytes(b[i]),bytes(a[i]));for(const key of Object.keys(wb)){if(ArrayBuffer.isView(wb[key]))assert.deepEqual(bytes(wf[key]),bytes(wb[key]),key);else assert.equal(wf[key],wb[key],key);} rows++;
  }
}
// Alternate connector far away and unreachable, shared accesses, ties, no connections.
compare(graph(9,[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1],[0,6,2],[6,2,0]],[[[0,0]],[[1,0],[5,20],[8,0]],[[2,0],[6,0]],[[1,0]],[],[[7,0]]]));
compare(graph(4,[[0,1,1],[0,2,1],[1,3,1],[2,3,1]],[[[0,0]],[[3,0],[1,1]],[[2,0],[3,0]]]));
// Negative connector and large-cost inputs must preserve original outputs too.
compare(graph(5,[[0,1,1],[1,2,1],[2,3,1],[3,4,1]],[[[0,0]],[[1,0],[4,-10]],[[2,0]]]));
compare(graph(5,[[0,1,2**24],[1,2,1],[2,3,1],[3,4,2**24]],[[[0,0]],[[2,.125],[4,0]],[[3,.25]]]));
let seed=42;const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
for(let t=0;t<120;t++){
  const n=8+rnd(35),edges=[];for(let k=0;k<n*3;k++){const a=rnd(n),b=rnd(n);if(a!==b)edges.push([a,b,1+rnd(40)/8]);}
  const con=Array.from({length:3+rnd(12)},()=>Array.from({length:rnd(5)},()=>[rnd(n),rnd(30)/8]));
  compare(graph(n,edges,con));
}
// Long-tail search also retains identical settled-node order and count.
const s=graph(100,Array.from({length:99},(_,i)=>[i,i+1,1]),[[[0,0]],[[1,0],[99,100]]]);
function settled(api){const W=api.carWork(s.G),out=new Float32Array(1).fill(NaN);W.order.fill(-1);api.carOriginRow(s.G,s.time,0,Int32Array.of(1),0,1,Float32Array.of(1),W,out,out.slice(),0,new Float32Array(s.G.nA));return W.order.filter(x=>x>=0).length;}
assert.equal(settled(fast),settled(base));
console.log(JSON.stringify({pass:true,rows,deliberateSettled:{baseline:settled(base),candidate:settled(fast)}}));
