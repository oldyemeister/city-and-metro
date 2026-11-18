// Capture the first actual allocation of a cold restore. The supplied export is read-only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {serialize} from 'node:v8';
import vm from 'node:vm';

const [fixture, output] = process.argv.slice(2);
assert.ok(fixture && output);
const root = process.env.CM_SOURCE_ROOT || process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const original = fs.readFileSync(fixture);
const halt = new Error('Captured first worker input');
const ctx = {performance, console, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator:{hardwareConcurrency:12}, matchMedia:()=>({matches:false}),
  localStorage:{getItem:()=>null, setItem(){}, removeItem(){}}};
ctx.window = ctx;
vm.createContext(ctx);
let snapshot;
ctx.observe = (G, time, run, pS, pD, dem, dt, p, model) => {
  const linkClass = Uint8Array.from(model.road.links, link => link.cls);
  const arcClass = Uint8Array.from(G.arcTo, (_, a) => linkClass[a >> 1]);
  const {CELL_M, ZONE} = ctx.CM.CFG;
  const zoneKm = ZONE * CELL_M / 1000;
  G = {...G, arcClass, zoneCols:model.ZW, zoneKm};
  snapshot = {G, time, run, pS, pD, dem, dt, p, linkClass, arcClass,
    zoneCols:model.ZW, zoneKm,
    zCx:model.zCx, zCy:model.zCy, W:model.city.W, H:model.city.H, cellMeters:CELL_M,
    nodeVert:model.road.nodeVert, arcT0:model.road.arcT0,
    fixtureSHA256:createHash('sha256').update(original).digest('hex')};
  throw halt;
};
function load(file) {
  let source = read(file);
  if (file === 'js/sim.js') {
    const needle = 'let res = null;';
    assert.equal(source.split(needle).length, 2);
    source = source.replace(needle,
      'observe(G, time, runList, pS, pD, carDem, dt, p, this); ' + needle);
  }
  vm.runInContext(source, ctx, {filename:file});
}
for (const [,file] of read('index.html').matchAll(/<script src="([^"]+)"/g)) {
  load(file);
  if (file === 'js/save.js') break;
}
const C = ctx.CM;
C.UI = function () {};
for (const name of ['settings','corp','fleet','screens']) load('js/' + name + '.js');
const payload = C.Save.parseEnvelope(original.toString('utf8')).payload;
assert.equal(payload.meta.map, 'sh');
assert.equal(Object.keys(payload.net.stations).length, 342);
C.useMap('sh');
assert.throws(() => C.Game.restore(payload), e => e === halt);
assert.ok(snapshot.run.length && snapshot.G.nA === snapshot.arcClass.length);
assert.equal(snapshot.dt, 'wd');
assert.deepEqual(fs.readFileSync(fixture), original);
fs.writeFileSync(output, serialize(snapshot));
console.log(JSON.stringify({day:snapshot.dt, period:snapshot.p, zones:snapshot.G.Z,
  zoneCols:snapshot.zoneCols, zoneKm:snapshot.zoneKm, origins:snapshot.run.length,
  requests:snapshot.pD.length, fixtureSHA256:snapshot.fixtureSHA256}));
