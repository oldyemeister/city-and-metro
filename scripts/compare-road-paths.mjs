// Offline route comparison using the game's synchronous solver and a read-only export.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Usage: node scripts/compare-road-paths.mjs SAVE.json REPORT.json');
const root = new URL('../', import.meta.url);
const text = await fs.readFile(input,'utf8');
const ctx = {console,performance,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,
  navigator:{hardwareConcurrency:4},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){},removeItem(){}}};
ctx.window=ctx;
vm.createContext(ctx);
let current, game;
const previous=new Map(), comparisons=[], captured=[];
function hook(source, anchor, insert) {
  assert.equal(source.split(anchor).length,2,'Expected exactly one '+anchor);
  return source.replace(anchor,insert+'\n'+anchor);
}
ctx.beginRoadSample=(graph,period,slot)=>{
  if(!game) return;
  const road=game.model.road;
  const key=period.dt+'-'+slot, month=game.clock.y+'-'+game.clock.m;
  current={key,month,road,paths:new Map(),origins:new Set(),prior:previous.get(key)};
  previous.set(key,current);
  current.count={from:current.prior?.month,to:month,period:key,identical:0,timeOnly:0,routeChanged:0};
  if(current.prior) comparisons.push(current.count);
};
ctx.sampleRoadPath=(graph,o,d,end,work,minutes)=>{
  if(!current || o%47!==13) return;
  const vertices=[current.road.nodeVert[end]];
  let node=end;
  while(work.pred[node]>=0){const edge=work.pred[node];const segment=current.road.links[edge >> 1].verts;
    if(edge & 1){for(let i=1;i<segment.length;i++) vertices.push(segment[i]);}
    else {for(let i=segment.length-2;i>=0;i--) vertices.push(segment[i]);}
    node=graph.arcFrom[edge];}
  const route=vertices.join(',');
  const key=o+','+d, time=Math.fround(minutes), old=current.prior?.paths.get(key);
  current.origins.add(o);current.paths.set(key,{route,time});
  if(old) current.count[old.route!==route?'routeChanged':old.time===time?'identical':'timeOnly']++;
};
ctx.endRoadSample=()=>{
  if(!current)return;
  captured.push({month:current.month,period:current.key,origins:current.origins.size,paths:current.paths.size});
  console.log(current.month,current.key,current.paths.size,'sampled');
  delete current.prior;current=null;
};
async function load(file){
  let src=await fs.readFile(new URL(file,root),'utf8');
  if(file==='js/sim.js'){
    src=hook(src,'const runList = [];','beginRoadSample(G,P,p);');
    src=hook(src,'outT[q - shift] = best;', 'if(o%47===13) sampleRoadPath(G,o,d,bn,W,best);');
    src=hook(src,'const A = CFG.road.bprA, capF','endRoadSample();');
  }
  vm.runInContext(src,ctx,{filename:file});
}
for(const [,file] of (await fs.readFile(new URL('index.html',root),'utf8')).matchAll(/<script src="([^"]+)"/g)){
  await load(file);if(file==='js/save.js')break;
}
const C=ctx.CM;C.UI=function(){};
for(const name of ['settings','corp','fleet','screens'])await load('js/'+name+'.js');
const payload=C.Save.parseEnvelope(text).payload;
C.useMap(payload.meta.map);
game=C.Game.restore(payload);game.model.syncSolve=true;
const start={...game.clock};assert.ok(game.startJump(2));
const target=game.jumping.target;
while(game.jumping)game.stepJump();
assert.deepEqual([game.clock.y,game.clock.m,game.clock.d],Array.from(target));
const total=comparisons.reduce((sum,c)=>sum+c.identical+c.timeOnly+c.routeChanged,0);
assert.ok(total>0,'No comparable reachable pairs');
const result={saveSHA256:createHash('sha256').update(text).digest('hex'),start,end:game.clock,stations:Object.keys(game.net.stations).length,sample:'origin % 47 === 13; reachable common destinations; exact ordered street-grid vertices including both endpoints; Float32 minutes',captured,comparisons};
await fs.writeFile(output,JSON.stringify(result,null,2));
console.log(output,total,'paired routes');
