import fs from 'node:fs/promises';
import v8 from 'node:v8';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {candidateSource,roadFunctions} from './child-read.mjs';
const source=await fs.readFile('js/sim.js','utf8'),prior=JSON.parse(await fs.readFile('evidence/road-workers/early-stop-kernel.json','utf8'));
const hash=a=>createHash('sha256').update(a).digest('hex');
assert.equal(hash(source),prior.sourceSHA256);
const raw=await fs.readFile('/tmp/metro-road-sample.bin'),{G,time,run,pS,pD,dem}=v8.deserialize(raw);
assert.deepEqual({zones:G.Z,nodes:G.nN,arcs:G.nA,origins:run.length},prior.workload);
const old=roadFunctions(source),fresh=roadFunctions(candidateSource(source));
const digest=a=>hash(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
function execute(api){
  const W=api.carWork(G),T=new Float32Array(pD.length).fill(NaN),K=T.slice(),sum=new Float32Array(G.nA),blocks=Array.from({length:32},()=>new Float32Array(G.nA));
  const start=performance.now();
  for(let b=0;b<32;b++){
    for(let i=Math.floor(b*run.length/32);i<Math.floor((b+1)*run.length/32);i++){
      const o=run[i];api.carOriginRow(G,time,o,pD,pS[o],pS[o+1],dem,W,T,K,0,blocks[b]);
    }
    for(let a=0;a<G.nA;a++)sum[a]+=blocks[b][a];
  }
  const ms=performance.now()-start;
  const signature={T:digest(T),K:digest(K),sum:digest(sum),blocks:blocks.map(digest)};
  assert.deepEqual(signature,prior.signature,'Pinned unmodified allocation output');
  const workspace=Object.fromEntries(Object.entries(W).map(([k,v])=>[k,ArrayBuffer.isView(v)?digest(v):v]));
  return {ms,signature,workspace};
}
for(let i=0;i<2;i++){execute(old);execute(fresh);}
const reference=execute(old),passes=[];
for(let round=1;round<=11;round++)for(const variant of(round%2?['old','new']:['new','old'])){
  const r=execute(variant==='old'?old:fresh);assert.deepEqual(r.signature,reference.signature);assert.deepEqual(r.workspace,reference.workspace);
  passes.push({round,variant,ms:r.ms});
}
const stats=variant=>{const a=passes.filter(p=>p.variant===variant).map(p=>p.ms).toSorted((a,b)=>a-b);return {min:a[0],median:a[a.length>>1],max:a.at(-1),runs:a.length};};
const result={sourceSHA256:hash(source),candidateSHA256:hash(candidateSource(source)),saveSHA256:prior.saveSHA256,rawCaptureSHA256:hash(raw),clock:prior.clock,stations:prior.stations,workload:prior.workload,exactEquality:true,workspaceExactEquality:true,signature:reference.signature,workspace:reference.workspace,timing:'Allocation+original ordered merge only; setup/allocation/hashing outside timed interval;2warmups/config,11alternating passes/config',old:stats('old'),new:stats('new'),passes};
await fs.writeFile('evidence/road-workers/child-read-kernel.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,signature:undefined,workspace:undefined,passes:undefined},null,2));
