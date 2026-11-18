'use strict';
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const native = require('./sparse.node');
const hash = x => createHash('sha256').update(x).digest('hex');
const digest = v => hash(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));
const raw = fs.readFileSync('/tmp/metro-road-sample.bin');
const src = fs.readFileSync('js/sim.js','utf8');
const pinned = JSON.parse(fs.readFileSync('evidence/road-workers/early-stop-kernel.json','utf8'));
assert.equal(hash(raw),'fea83da2e1232af34ecb023688e14e5edbe97b17cb6bd0e5e1d47f6d510b24cd');
assert.equal(hash(src),pinned.sourceSHA256);
const {G,time,run,pS,pD,dem} = v8.deserialize(raw);
const origins = Int32Array.from(run);
async function main() {
  const {roadFunctions} = await import(path.resolve('evidence/road-workers/early-stop.mjs'));
  const api = roadFunctions(src);
  function replay(variant) {
    const W = api.carWork(G);
    const T = new Float32Array(pD.length).fill(NaN), K = T.slice();
    const blocks = new Float32Array(32*G.nA), sum = new Float32Array(G.nA);
    const views = Array.from({length:32},(_,i)=>blocks.subarray(i*G.nA,(i+1)*G.nA));
    const input = {...G,time,origins,pS,pD,dem,...W,T,K,blocks,sum};
    const start = performance.now();
    if (variant === 'native') {
      native(input);
    } else {
      for (let b = 0; b < 32; b++) {
        for (let i = Math.floor(b*origins.length/32); i < Math.floor((b+1)*origins.length/32); i++) {
          const o = origins[i];
          api.carOriginRow(G,time,o,pD,pS[o],pS[o+1],dem,W,T,K,0,views[b]);
        }
        for (let a = 0; a < G.nA; a++) sum[a] += views[b][a];
      }
    }
    const ms = performance.now() - start;
    assert.deepEqual({T:digest(T),K:digest(K),sum:digest(sum),blocks:views.map(digest)},pinned.signature);
    return ms;
  }
  for (let i=0;i<2;i++) {replay('js');replay('native');}
  const runs = [];
  for (let i=0;i<8;i++) {
    const pair = {};
    for (const variant of i % 2 ? ['native','js'] : ['js','native']) pair[variant] = replay(variant);
    runs.push(pair);
  }
  function stats(key) {
    const a = runs.map(p=>p[key]).sort((a,b)=>a-b);
    return {min:a[0],median:(a[3]+a[4])/2,max:a[7]};
  }
  const output = {node:process.version,v8:process.versions.v8,arch:process.arch,source:hash(src),capture:hash(raw),
    nativeSource:hash(fs.readFileSync(path.join(__dirname,'sparse.cc'))),warmups:2,runs,js:stats('js'),native:stats('native'),
    equality:'Every pass matched the pinned time/km, 32 individual block flows and ordered merged flow.',signature:pinned.signature};
  fs.writeFileSync(path.join(__dirname,'native-sparse.json'),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({...output,signature:undefined},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
