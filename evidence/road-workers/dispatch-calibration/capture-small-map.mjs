// Run from the repository root: node evidence/road-workers/dispatch-calibration/capture-small-map.mjs MAP_ID OUTPUT_SAVE OUTPUT_SAMPLE
// Or use an existing export read-only: node evidence/road-workers/dispatch-calibration/capture-small-map.mjs --restore INPUT_SAVE OUTPUT_SAMPLE
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import v8 from 'node:v8';

const [map, savePath, capturePath] = process.argv.slice(2);
assert.ok(map && savePath && capturePath, 'Expected MAP_ID OUTPUT_SAVE OUTPUT_SAMPLE');
const ctx = {console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator:{hardwareConcurrency:4}, matchMedia:()=>({matches:false}),
  localStorage:{getItem:()=>null, setItem(){}, removeItem(){}}};
ctx.window = ctx;
vm.createContext(ctx);
let active = false, captured;
const stop = new Error('Observed first allocation in next month');
ctx.observe = (G, time, run, pS, pD, dem, dt, p, W, H, zoneSize, cellMeters) => {
  if (!active) return;
  captured = {G, time:Float32Array.from(time), run:Array.from(run), pS:Int32Array.from(pS),
    pD:Int32Array.from(pD), dem:Float32Array.from(dem), dt, p, W, H, zoneSize, cellMeters};
  throw stop;
};
async function load(file) {
  let s = await fs.readFile(file,'utf8');
  if (file === 'js/sim.js') {
    const needle = 'let res = null;';
    assert.equal(s.split(needle).length, 2);
    s = s.replace(needle,'observe(G,time,runList,pS,pD,carDem,dt,p,this.city.W,this.city.H,CFG.ZONE,CFG.CELL_M); '+needle);
  }
  vm.runInContext(s,ctx,{filename:file});
}
for (const [,file] of (await fs.readFile('index.html','utf8')).matchAll(/<script src="([^"]+)"/g)) {
  await load(file);
  if (file === 'js/save.js') break;
}
ctx.CM.UI = function(){};
for (const n of ['settings','corp','fleet','screens']) await load('js/'+n+'.js');
const CM = ctx.CM;
let envelope;
if (map === '--restore') {
  envelope = await fs.readFile(savePath,'utf8');
  CM.useMap(CM.Save.parseEnvelope(envelope).payload.meta.map);
} else {
  CM.useMap(map);
  const options = {map, mode: map === 'tutorial' ? 'free' : 'challenge',
    seed:CM.CFG.START.y * 10000 + 101, tutorial:map === 'tutorial'};
  const game = CM.Game.create(options);
  envelope = JSON.stringify(CM.Save.envelope(game));
  assert.equal(CM.Save.parseEnvelope(envelope).payload.meta.map,map);
  await fs.writeFile(savePath,envelope);
  console.log(JSON.stringify({map,options,savePath,clock:game.clock,stations:Object.keys(game.net.stations).length,
    stable:game.model.trafficReady(),bytes:Buffer.byteLength(envelope),Z:game.model.Z,nN:game.model.road.nN,nA:game.model.road.nA}));
}
// Restore the exact exported envelope just as a browser runner would. Do not change the map, OD or road data.
const replay = CM.Game.restore(CM.Save.parseEnvelope(envelope).payload);
replay.model.syncSolve = true;
active = true;
try {
  assert.ok(replay.startJump(1));
  while (replay.jumping) replay.stepJump();
} catch (e) {
  if (e !== stop) throw e;
}
assert.ok(captured && captured.run.length);
await fs.writeFile(capturePath,v8.serialize(captured));
console.log(JSON.stringify({capturePath,origins:captured.run.length,day:captured.dt,period:captured.p,W:captured.W,H:captured.H,
  zoneSize:captured.zoneSize,cellMeters:captured.cellMeters}));
