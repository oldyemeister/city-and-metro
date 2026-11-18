// node .../sample-stock-tree.mjs CAPTURE.bin RESULT.json [--sample-us=700]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {deserialize} from 'node:v8';
import {plainBytes,plainSHA256} from './wasm-probe.mjs';

const [capture,output,...options]=process.argv.slice(2);
const hash=x=>createHash('sha256').update(x).digest('hex');
const reference=JSON.parse(fs.readFileSync(new URL('../dispatch-validation/sh2010-exact.json',import.meta.url)));
const starts=[function rdSampleOne(){},function rdSampleTwo(){},function rdSampleThree(){},function rdSampleFour(){},function rdSampleEnd(){}];

function play(){
  const raw=fs.readFileSync(capture);assert.equal(hash(raw),reference.captureSHA256);
  const {G,time,run,pS,pD,dem}=deserialize(raw),app={CM:{}};
  new Function('window',fs.readFileSync('js/road-kernel.js','utf8'))(app);
  const kernel=app.CM.RoadKernel.worker(new WebAssembly.Module(plainBytes()),G);
  const blocks=reference.blocks.map(({block})=>{
    const origins=Int32Array.from(run.slice(Math.floor(block*run.length/32),Math.floor((block+1)*run.length/32)));
    const dense=new Float32Array(G.Z*origins.length);
    origins.forEach((o,i)=>{for(let j=pS[o];j<pS[o+1];j++)dense[i*G.Z+pD[j]]=dem[j];});
    return {origins,dem:dense,time};
  });
  function pass(){
    const t=new Float32Array(pD.length).fill(NaN),km=t.slice(),flow=new Float32Array(G.nA);
    blocks.forEach((b,index)=>{
      const r=kernel.solve(b);assert.equal(hash(r.aux),reference.blocks[index].flowSHA256);
      b.origins.forEach((o,i)=>{for(let j=pS[o];j<pS[o+1];j++){
        t[j]=r.rowsT[i*G.Z+pD[j]];km[j]=r.rowsK[i*G.Z+pD[j]];
      }});
      for(let j=0;j<flow.length;j++)flow[j]+=r.aux[j];
    });
    assert.equal(hash(t),reference.timeSHA256);assert.equal(hash(km),reference.kmSHA256);assert.equal(hash(flow),reference.mergedFlowSHA256);
  }
  pass();pass();
  for(let i=0;i<4;i++){starts[i]();pass();}
  starts.at(-1)();
}

// Absolute offsets in the original solve function, verified against LLVM/Wasm disassembly.
// The 0x3440..0x345d stale/order interval is broken out from pop and arc traversal.
const groups=[
  [0x27bd,0x3124,'residual'],[0x3124,0x3333,'treeInitAndSources'],
  [0x3333,0x3440,'heapPopAndSift'],[0x3440,0x345d,'staleAndOrder'],
  [0x345d,0x358e,'arcRelaxAndPush'],[0x358e,0x3828,'destinations'],
  [0x3828,0x3960,'reverse'],[0x3960,0x3979,'treeOrderLoopTail'],
  [0x3979,0x3994,'residual']
];
function analyze(nativeText,logText){
  const sections=nativeText.split('--- WebAssembly code ---').filter(s=>s.startsWith('\nname: wasm-function[7]\nindex: 7\n'));
  const modules=sections.map(section=>{
    const base=Number(section.match(/\n(0x[0-9a-f]+)\s+0\s/)[1]);
    const size=Number(section.match(/^Instructions \(size = (\d+)\)/m)[1]),compiler=section.match(/^compiler: (.+)$/m)[1];
    const positionsText=section.split(/Source positions:\s+pc offset\s+position\n/)[1];
    const positions=[];
    if(positionsText)for(const line of positionsText.split('\n')){
      const m=line.match(/^\s*([0-9a-f]+)\s+(\d+)\s*$/);if(!m)break;
      positions.push([parseInt(m[1],16),Number(m[2])+0x27bd]);
    }
    return {base,size,compiler,positions};
  });
  const lines=logText.split('\n');
  const boundaries=starts.map(f=>{
    const marks=lines.filter(s=>s.startsWith('function,first-execution,')&&s.endsWith(','+f.name));
    assert.equal(marks.length,1,'Expected V8 timestamp marker '+f.name);return Number(marks[0].split(',')[6]);
  });
  const hot=modules.filter(m=>m.compiler==='TurboFan');
  assert.ok(hot.length>0&&hot.every(m=>m.positions.length>100));
  assert.ok(modules.every(m=>lines.some(s=>s.startsWith('code-creation,JS,')&&s.includes(',0x'+m.base.toString(16)+',')&&s.includes(',wasm-function[7],'))));
  const group=off=>groups.find(([lo,hi])=>off>=lo&&off<hi)?.[2]??'unknown';
  const passes=Array.from({length:4},()=>({allTicks:0,outsideSolve:0,otherTier:0,optimizedTicks:0,groupCounts:{},exactPositionCounts:{}}));
  const hist=hot.map(()=>new Map());
  for(const line of lines){
    if(!line.startsWith('tick,'))continue;
    const [,pcText,timestamp]=line.split(',',3),time=Number(timestamp);
    const i=boundaries.findIndex((v,n)=>n<4&&time>=v&&time<boundaries[n+1]);if(i<0)continue;
    const p=passes[i],pc=Number(pcText);
    p.allTicks++;
    const module=modules.find(m=>pc>=m.base&&pc<m.base+m.size);
    if(!module){p.outsideSolve++;continue;}
    if(module.compiler!=='TurboFan'){p.otherTier++;continue;}
    p.optimizedTicks++;
    const offset=pc-module.base,points=module.positions;
    const ri=points.findIndex(([v])=>v>=offset);
    const right=points[ri],left=points[ri-1];
    const exact=right&&right[0]===offset;
    // If adjacent native mappings disagree on Wasm source region, leave the tick unassigned.
    const label=exact?group(right[1]):left&&right&&group(left[1])===group(right[1])?group(left[1]):'unattributed';
    p.groupCounts[label]=(p.groupCounts[label]||0)+1;
    if(exact)p.exactPositionCounts[label]=(p.exactPositionCounts[label]||0)+1;
    const bucket=hist[hot.indexOf(module)];
    const row=bucket.get(offset)??{pcOffset:offset,previous:left??null,next:right??null,label,exact:Boolean(exact),counts:[0,0,0,0]};
    row.counts[i]++;bucket.set(offset,row);
  }
  const total={};
  for(const p of passes)for(const [key,n] of Object.entries(p.groupCounts))total[key]=(total[key]||0)+n;
  assert.ok(passes.every(p=>p.optimizedTicks>100),'Too few resolved warm samples');
  return {passes,totalByGroup:total,boundariesUs:boundaries,optimizedNativeHistograms:hot.map((m,i)=>({instructionsBytes:m.size,
    positionTableEntries:m.positions.length,sampledOffsets:[...hist[i].values()].sort((a,b)=>a.pcOffset-b.pcOffset)}))};
}

if(options.includes('--worker'))play();
else{
  const sampleUs=Number(options.find(s=>s.startsWith('--sample-us='))?.split('=')[1]??700);
  assert.ok(sampleUs>=100&&sampleUs<=2000);
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'metro-wasm-pcs-'));
  const logfile=path.join(tmp,'v8.log'),assembly=path.join(tmp,'asm.txt');
  const args=['--prof','--prof-sampling-interval='+sampleUs,'--log-function-events','--log-source-position','--print-wasm-code',
    '--print-wasm-code-function-index=7','--no-logfile-per-isolate','--logfile='+logfile];
  const fd=fs.openSync(assembly,'w');
  let r;
  try{r=spawnSync(process.execPath,[...args,fileURLToPath(import.meta.url),capture,output,'--worker'],{stdio:['ignore',fd,'inherit']});}
  finally{fs.closeSync(fd);}
  assert.equal(r.status,0);const rawLog=fs.readFileSync(logfile,'utf8'),asm=fs.readFileSync(assembly,'utf8');
  const result=analyze(asm,rawLog);
  fs.writeFileSync(output,JSON.stringify({node:process.version,v8:process.versions.v8,arch:process.arch,
    binarySHA256:plainSHA256,captureSHA256:reference.captureSHA256,rawLogSHA256:hash(rawLog),asmSHA256:hash(asm),sampleIntervalUs:sampleUs,
    method:'V8 --prof actual top native PCs, stock binary/default tiering, 2 warmups and 4 measured full allocations. Every pass verified pinned time/km/32 block flows/ordered merged flow. V8 first-execution timestamps delimit passes, including checks outside solve. Only TurboFan solve(7) instruction spans count as optimized. Native PC offsets converted through V8 source positions relative to solve body at 0x27bd. Exact listed PC or consistent bracketing source group; unresolved brackets unassigned. Weighted by samples, not instructions or hardware cycles. Compiler rearrangement, interrupts, sampling skid and sparse position tables limit line attribution. Histograms retain every sampled solve PC and bracketing evidence per pass.',
    wasmByteRanges:groups,...result},null,2)+'\n');
  console.log(JSON.stringify({passes:result.passes,total:result.totalByGroup,rawDirectory:tmp}));
}
