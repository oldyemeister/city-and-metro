// Offline diagnostic only: extracts production functions without editing sim.js.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {candidateSource,roadFunctions} from './early-stop.mjs';
import v8 from 'node:v8';
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

await fs.writeFile('/tmp/metro-road-sample.bin',v8.serialize(sample));
const base=roadFunctions(source),fast=roadFunctions(candidateSource(source));
const digest=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
function execute(api,count=false){
  const setup=performance.now(),W=api.carWork(G),setupMs=performance.now()-setup;
  const T=new Float32Array(pD.length).fill(NaN),K=T.slice(),sum=new Float32Array(G.nA),block=new Float32Array(G.nA),blocks=[];
  let settled=0;const start=performance.now();
  for(let b=0;b<32;b++){
    block.fill(0);
    for(let i=Math.floor(b*run.length/32);i<Math.floor((b+1)*run.length/32);i++){
      const o=run[i];if(count)W.order.fill(-1);
      api.carOriginRow(G,time,o,pD,pS[o],pS[o+1],dem,W,T,K,0,block);
      if(count)for(const n of W.order)if(n>=0)settled++;
    }
    blocks.push(digest(block));
    for(let a=0;a<G.nA;a++)sum[a]+=block[a];
  }
  const ms=performance.now()-start;
  return {ms,setupMs,settled,signature:{T:digest(T),K:digest(K),sum:digest(sum),blocks}};
}
execute(base);execute(fast);
const expected=execute(base).signature,passes=[];
for(let round=0;round<7;round++)for(const mode of(round%2?['fast','base']:['base','fast'])){
  const r=execute(mode==='base'?base:fast);assert.deepEqual(r.signature,expected);passes.push({mode,round,ms:r.ms,setupMs:r.setupMs});
}
const counts={};for(const [mode,api]of[['base',base],['fast',fast]]){const r=execute(api,true);assert.deepEqual(r.signature,expected);counts[mode]=r.settled;}
const median=a=>a.toSorted((x,y)=>x-y)[a.length>>1];
const medians=Object.fromEntries(['base','fast'].map(mode=>[mode,median(passes.filter(p=>p.mode===mode).map(p=>p.ms))]));
const result={sourceSHA256:createHash('sha256').update(source).digest('hex'),saveSHA256:createHash('sha256').update(text).digest('hex'),clock:payload.clock,stations:Object.keys(game.net.stations).length,workload:{zones:G.Z,nodes:G.nN,arcs:G.nA,origins:run.length},exactEquality:true,counts,medians,passes,signature:expected};
await fs.writeFile(output,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,passes:undefined,signature:undefined},null,2));
