// From the project root: node evidence/road-workers/language-analysis-20261117/weights.mjs SAVE [REPORT] [CAPTURE]
// A synchronous fallback replay for input observation. No timing or browser measurement.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import v8 from 'node:v8';

const [savePath, reportPath, capturePath] = process.argv.slice(2);
assert.ok(savePath, 'Expected the Shanghai 2000-07 save path');
const text = await fs.readFile(savePath, 'utf8');
const hash = data => createHash('sha256').update(data).digest('hex');
const digest = array => hash(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
const ctx = {console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator:{hardwareConcurrency:4}, matchMedia:()=>({matches:false}),
  localStorage:{getItem:()=>null, setItem(){}, removeItem(){}}};
ctx.window = ctx;
vm.createContext(ctx);
const snapshots = [], seen = [], requests = [];
let active = false, sourceSHA256;
ctx.observe = (g, time, dt, p, its, run) => {
  if (!active) return;
  const f = Float32Array.from(time), sha = digest(f);
  const prevIndex = requests.findLastIndex(row => row.dt === dt && row.p === p);
  const differences = snapshots.map(prior => {
    let changed = 0;
    for (let i=0; i<f.length; i++) if (f[i] !== prior[i]) changed++;
    return changed;
  });
  requests.push({gid:g.id, dt, p, its, run:run.length, h:sha.slice(0,12), sha256:sha, repeat:seen.indexOf(sha),
    minPriorChanged:differences.length ? Math.min(...differences) : null, samePeriodChanged:prevIndex >= 0 ? differences[prevIndex] : null});
  snapshots.push(f);
  seen.push(sha);
};
async function load(file) {
  let s = await fs.readFile(file,'utf8');
  if (file === 'js/sim.js') {
    sourceSHA256 = hash(s);
    const needle = 'let res = null;';
    assert.equal(s.split(needle).length, 2);
    s = s.replace(needle,'observe(G,time,dt,p,P.iters,runList); '+needle);
  }
  vm.runInContext(s,ctx,{filename:file});
}
for (const [,file] of (await fs.readFile('index.html','utf8')).matchAll(/<script src="([^"]+)"/g)) {
  await load(file);
  if (file === 'js/save.js') break;
}
ctx.CM.UI = function(){};
for (const n of ['settings','corp','fleet','screens']) await load('js/'+n+'.js');
const payload = ctx.CM.Save.parseEnvelope(text).payload;
ctx.CM.useMap(payload.meta.map);
const game = ctx.CM.Game.restore(payload);
game.model.syncSolve = true;
active = true;
assert.ok(game.startJump(1));
while (game.jumping) game.stepJump();
let captureTimeSHA256 = null;
if (capturePath) {
  captureTimeSHA256 = digest(v8.deserialize(await fs.readFile(capturePath)).time);
  assert.equal(seen[0],captureTimeSHA256);
}
const out = {fixture:path.basename(savePath), hash:hash(text), sourceSHA256, captureTimeSHA256,
  arcCount:snapshots[0].length, requests:requests.length, distinct:new Set(seen).size, r:requests};
console.log(JSON.stringify(out,null,2));
if (reportPath) await fs.writeFile(reportPath,JSON.stringify(out,null,2)+'\n');
