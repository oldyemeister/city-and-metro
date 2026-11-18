// Offline diagnostic only: extracts production functions without editing sim.js.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [input,output]=process.argv.slice(2);
assert.ok(input&&output,'Usage: node evidence/road-workers/analyze-kernel.mjs SAVE REPORT');
const source=await fs.readFile('js/sim.js','utf8'), text=await fs.readFile(input,'utf8');
const ctx={console,performance,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,
  navigator:{hardwareConcurrency:4},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){},removeItem(){}}};
ctx.window=ctx;vm.createContext(ctx);
let active=false,sample;
const stop=new Error('captured road allocation');
ctx.capture=(G,time,run,pS,pD,dem)=>{
  if(!active)return;
  sample={G,time:Float32Array.from(time),run:Array.from(run),pS:Int32Array.from(pS),pD:Int32Array.from(pD),dem:Float32Array.from(dem)};
  throw stop;
};
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
async function load(file){
  let s=await fs.readFile(file,'utf8');
  if(file==='js/sim.js'){
    s=replace(s,'CM.CarPool = CarPool;','CM.CarPool = CarPool; CM.roadDiagnostic={carTree,carOriginRow,carWork};');
    s=replace(s,'let res = null;','capture(G,time,runList,pS,pD,carDem); let res = null;');
  }
  vm.runInContext(s,ctx,{filename:file});
}
for(const [,file] of (await fs.readFile('index.html','utf8')).matchAll(/<script src="([^"]+)"/g)){
  await load(file);if(file==='js/save.js')break;
}
ctx.CM.UI=function(){};
for(const n of ['settings','corp','fleet','screens'])await load('js/'+n+'.js');
const payload=ctx.CM.Save.parseEnvelope(text).payload;ctx.CM.useMap(payload.meta.map);
const game=ctx.CM.Game.restore(payload);game.model.syncSolve=true;active=true;
try{assert.ok(game.startJump(1));while(game.jumping)game.stepJump();}catch(e){if(e!==stop)throw e;}
assert.ok(sample,'No road allocation');
const {G,time,run,pS,pD,dem}=sample;
const api=ctx.CM.roadDiagnostic,tree=api.carTree.toString(),row=api.carOriginRow.toString();
// Separate instrumented pass: counters/timers are excluded from benchmark passes.
ctx.stats={rows:0,markVisits:0,targets:0,settled:0,pops:0,stale:0,arcs:0,relax:0,backtrace:0,treeMs:0,markMs:0,destMs:0,backMs:0,fillMs:0};
let itree=replace(tree,'dist.fill(INF);','let phase=performance.now(); dist.fill(INF); stats.fillMs+=performance.now()-phase;');
itree=replace(itree,'while (count) {','while (count) { stats.pops++;');
itree=replace(itree,'if (du > dist[u]) continue;','if (du > dist[u]) {stats.stale++; continue;} stats.settled++;');
itree=replace(itree,'const a = outArc[k], v = arcTo[a], nd = du + time[a];','stats.arcs++; const a = outArc[k], v = arcTo[a], nd = du + time[a];');
itree=replace(itree,'if (nd < dist[v]) {','if (nd < dist[v]) { stats.relax++;');
let irow=replace(row,'const mark = W.mark;','stats.rows++; let phase=performance.now(); const mark = W.mark;');
irow=replace(irow,'const nd = connNode[k]; if (mark[nd] !== stamp)','stats.markVisits++; const nd = connNode[k]; if (mark[nd] !== stamp)');
irow=replace(irow,'const no = need > 0 ? carTree(G, time, o, W, need, stamp) : 0;','stats.targets+=need; stats.markMs+=performance.now()-phase; phase=performance.now(); const no = need > 0 ? carTree(G, time, o, W, need, stamp) : 0; stats.treeMs+=performance.now()-phase; phase=performance.now();');
irow=replace(irow,'for (let q = no - 1; q >= 0; q--) {','stats.destMs+=performance.now()-phase; phase=performance.now(); for (let q = no - 1; q >= 0; q--) { stats.backtrace++;');
irow=irow.slice(0,irow.lastIndexOf('}'))+'stats.backMs+=performance.now()-phase;\n}';
const instrumented=vm.runInContext('(()=>{const INF=1e30;'+itree+';return '+irow+';})()',ctx);
// Candidate: cache unique destination-access nodes per origin for an unchanged layout/graph.
// Only mark preparation changes. Heap comparisons, traversal and Float32 sums remain untouched.
const prepStart=performance.now(),targets=[],seen=new Set();let targetBytes=0;
for(const o of run){seen.clear();for(let q=pS[o];q<pS[o+1];q++){const d=pD[q];if(d===o)continue;for(let k=G.start[d];k<G.start[d+1];k++)seen.add(G.nodes[k]);}
  targets[o]=Int32Array.from(seen);targetBytes+=targets[o].byteLength;
}
const prepMs=performance.now()-prepStart;
const from=row.indexOf('    for (let q = q0; q < q1; q++) {'),to=row.indexOf('    const no = need > 0');
assert.ok(from>0&&to>from);
const cachedRow=row.slice(0,from)+'    for (const nd of W.targets[o]) { mark[nd]=stamp; need++; }\n'+row.slice(to);
const cached=vm.runInContext('(()=>{const INF=1e30;'+tree+';return '+cachedRow+';})()',ctx);
function execute(fn){
  const W=api.carWork(G);W.targets=targets;
  const T=new Float32Array(pD.length).fill(NaN),K=new Float32Array(pD.length).fill(NaN),sum=new Float32Array(G.nA),block=new Float32Array(G.nA);
  const start=performance.now(),blockMs=[];
  for(let b=0;b<32;b++){
    const bs=performance.now();block.fill(0);
    for(let i=Math.floor(b*run.length/32);i<Math.floor((b+1)*run.length/32);i++){
      const o=run[i];fn(G,time,o,pD,pS[o],pS[o+1],dem,W,T,K,0,block);
    }
    blockMs.push(performance.now()-bs);
    for(let a=0;a<G.nA;a++)sum[a]+=block[a];
  }
  return {ms:performance.now()-start,blockMs,T,K,sum};
}
const digest=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const signature=r=>({times:digest(r.T),km:digest(r.K),flow:digest(r.sum)});
execute(api.carOriginRow);execute(cached);
const expected=signature(execute(api.carOriginRow)),passes=[];
for(let round=0;round<7;round++)for(const mode of (round%2?['cached','base']:['base','cached'])){
  const r=execute(mode==='base'?api.carOriginRow:cached);assert.deepEqual(signature(r),expected);
  passes.push({round,mode,ms:r.ms,blockMs:r.blockMs});
}
const counted=execute(instrumented);assert.deepEqual(signature(counted),expected);
const counts={...ctx.stats};
// Timer-only passes avoid attributing per-arc diagnostic counter overhead to search.
let timedRow=irow.replace('stats.rows++; ','').replace('stats.markVisits++; ','').replace('stats.targets+=need; ','').replace(' stats.backtrace++;','');
const timedTree=replace(tree,'dist.fill(INF);','const phase=performance.now(); dist.fill(INF); stats.fillMs+=performance.now()-phase;');
const timed=vm.runInContext('(()=>{const INF=1e30;'+timedTree+';return '+timedRow+';})()',ctx);
const phasePasses=[];
for(let i=0;i<3;i++){
  ctx.stats={treeMs:0,markMs:0,destMs:0,backMs:0,fillMs:0};
  const r=execute(timed);assert.deepEqual(signature(r),expected);phasePasses.push({...ctx.stats,totalMs:r.ms});
}
const median=a=>a.toSorted((x,y)=>x-y)[a.length>>1];
const summaries=Object.fromEntries(['base','cached'].map(mode=>{const a=passes.filter(x=>x.mode===mode).map(x=>x.ms);return [mode,{min:Math.min(...a),median:median(a),max:Math.max(...a)}];}));
const result={sourceSHA256:createHash('sha256').update(source).digest('hex'),saveSHA256:createHash('sha256').update(text).digest('hex'),saveClock:payload.clock,stations:Object.keys(game.net.stations).length,
  method:'First road allocation during next-month jump; exact production JS functions in Node VM; 32 original blocks; alternating 7 warm passes; no browser/gameplay speed claim',
  workload:{zones:G.Z,nodes:G.nN,arcs:G.nA,origins:run.length,pairs:pD.length},counts,phasePasses,
  cache:{prepMs,targetBytes},signatures:expected,exactEquality:true,summaries,passes};
await fs.writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,passes:undefined},null,2));
