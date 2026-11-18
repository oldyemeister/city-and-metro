// node .../verify-browser.mjs RUN_DIRECTORY [--partial]
// Verify every fully recorded pair and write a compact independent summary. The default requires all six forced pairs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const runDir=process.argv[2],partial=process.argv.includes('--partial');
const read=file=>JSON.parse(fs.readFileSync(path.join(runDir,file),'utf8'));
const source=read('results.json');
const hash=s=>createHash('sha256').update(s).digest('hex');
const hex=/^[a-f0-9]{64}$/;
const split=s=>s.split(' ');
const periods=['wd0','wd1','wd2','wd3','we0','we1','we2','we3'];
const arrNames=split('arcVol arcTime skimT skimK desTot desMetro zTrips zMetro zAccess zDest zDestM zCW zCT fIn fInM fOut fOutM fP fPM freq freqDir needDir crowd load stDelay stIn stOut stXfer stBoard');
const stats=split('trips metro car timeSum commTrips commTime fare metroPkm vkt carPkm congNum congDen crowdPkm metroTime carTime tHW tSC tSH tMD tLZ tHB mHW mSC mSH mMD mLZ mHB ind indM');
const metrics=split('pop jobs funds capex debt share cong commute riders sat regions events tasksDone tasksFailed coverage stations fiscF macroRecs ridersWk ridersWe');
const economic=split('mode funds fare cross cur ledger sat mods negMonths lowSatMonths failed satFactors lastDay capex bonds bondIssued overdue overdueParts overdueMonths flow bondSeq svc fisc built');
const daily=split('weekday weekend average');
for(const k of ['stations','weekdayStations','weekendStations']) daily.push(k,...split('inn out xfer peak routeBoard').map(n=>k+'.'+n));
for(const k of ['weekdayFacilities','weekendFacilities']) daily.push(k,...split('inn innM out outM purp purpM dest destM trips metro').map(n=>k+'.'+n));
const digestNames=split('historySHA256 tasksSHA256 corpSHA256 fleetSHA256 ledgerSHA256 networkSHA256');
function keys(obj,expected){assert.deepEqual(Object.keys(obj).sort(),[...expected].sort());}
function state(s,size) {
  keys(s,['clock','metrics','arrays','periodStats','daily','economy',...digestNames]);
  keys(s.metrics,metrics); keys(s.periodStats,periods); keys(s.daily,daily);
  for(const k of digestNames) assert.match(s[k],hex);
  for(const v of Object.values(s.daily)) assert.match(v,hex);
  keys(s.arrays,periods.flatMap(p=>arrNames.map(k=>p+'.'+k)));
  for(const a of Object.values(s.arrays)){
    assert.match(a.sha256,hex);assert.match(a.type,/Array$/);assert.ok(Number.isInteger(a.length)&&a.length>=0);
  }
  for(const p of periods){
    keys(s.periodStats[p].stats,stats);
    for(const k of ['arcVol','arcTime','skimT','skimK']) assert.ok(s.arrays[p+'.'+k].length>0);
  }
  const minimum=size==='large'?[...economic,...split('rate fareMark fareAuto fareNote')]:economic;
  for(const k of minimum) assert.ok(Object.hasOwn(s.economy,k),k);
  assert.equal(hash(JSON.stringify(s.economy.ledger)),s.ledgerSHA256);
  assert.equal(s.metrics.stations,size==='large'?278:0);
}
const prior=source.resumedFrom?JSON.parse(fs.readFileSync(source.resumedFrom,'utf8')):null;
const reversed=Boolean(prior?.forcedComplete && prior?.policy);
const {baseline,JS,WASM}=source.workerSources;
const gates=[...baseline.matchAll(/if \((module && nt >= n \* G\.Z \* [\d.]+)\) \{/g)];
assert.equal(gates.length,1);
const baselineGuard=gates[0][1];
if(reversed)assert.equal(baselineGuard,prior.policy.guard);
assert.equal(baseline.split(baselineGuard).length,2);
assert.equal(JS,baseline.replace(baselineGuard,'false && module'));
assert.equal(WASM,baseline.replace(baselineGuard,'module && true'));
if(reversed){
  assert.equal(source.startedAt,prior.startedAt);
  assert.equal(source.profile,prior.profile);assert.deepEqual(source.fixtures,prior.fixtures);
  assert.equal(source.sourceSHA256,prior.policy.sourceSHA256);
  assert.equal(source.embeddedKernelSHA256,prior.embeddedKernelSHA256);
  assert.equal(JS,prior.workerSources.JS);assert.equal(WASM,prior.workerSources.WASM);
}
let policyDensity;
if(source.workerSources.POLICY){
  const threshold=/^module && nt >= n \* G\.Z \* (0\.\d+)$/.exec(source.policy.guard);
  assert.ok(threshold,'Expected the recorded minimum-density dispatch rule');
  policyDensity=Number(threshold[1]);
  assert.ok(policyDensity>0 && policyDensity<=1);
  assert.equal(source.workerSources.POLICY,baseline.replace(baselineGuard,source.policy.guard));
  assert.equal(hash(source.workerSources.POLICY),source.policy.sourceBodySHA256);
}
const fixtureChecks={
  large:{map:'sh',stations:278,y:2010,d:16,minute:547.3584000004513,sha:'f6027c5bbbd9aff5c4dcb850f846a0ce5ca45ee75638cce3e38c5fd26827c7f2'},
  small:{map:'ld',stations:0,y:1860,d:1,minute:360,sha:'ac642250139a6c3fc8dd9ddfc00d8ffbaa4ff29de2c94c49b0ac0dd9e5eac7fe'}
};
for(const [key,f] of Object.entries(fixtureChecks)){
  const r=source.fixtures[key]; assert.equal(r.sha256,f.sha);assert.equal(r.map,f.map);assert.equal(r.stations,f.stations);
  assert.deepEqual(r.clock,{y:f.y,m:1,d:f.d,minute:f.minute});
}
const bins=[0,.05,.08,.11,.2,.75,Infinity];
function median(v){const s=v.slice().sort((a,b)=>a-b);return s.length?(s[(s.length-1)>>1]+s[s.length>>1])/2:null;}
const round=v=>v===null?null:Number(v.toFixed(3));
const cache=new Map();
function check(c){
  if(cache.has(c.token))return cache.get(c.token);
  const {variant,mapSize,profile,scenario,check:loaded,timing}=c,f=fixtureChecks[mapSize];
  assert.deepEqual(c.errors,[]);assert.deepEqual(loaded.clock,source.fixtures[mapSize].clock);
  assert.equal(loaded.map,f.map);assert.equal(loaded.stations,f.stations);
  state(c.before,mapSize);state(c.after,mapSize);
  const months={quarter:3,year:12,boundary:1}[scenario],boundary=scenario==='boundary';
  assert.deepEqual(c.before.clock,boundary?{y:f.y,m:1,d:31,minute:1439}:loaded.clock);
  assert.deepEqual(c.after.clock,{y:f.y+Math.floor(months/12),m:1+months%12,d:boundary?1:f.d,minute:boundary?0:f.minute});
  assert.equal(timing.months,months);assert.ok(timing.ms>0);assert.ok(timing.paused && !timing.hidden);
  assert.equal(loaded.workerSHA256,hash(source.workerSources[variant]));
  if(profile.startsWith('mobile')) {
    assert.equal(loaded.hasWasm,profile!=='mobile-no-module');assert.ok(loaded.coarse&&loaded.touch>0);
  }
  const pools=profile==='desktop'?[4,2,2]:[2,1,1];
  assert.deepEqual([loaded.road,loaded.mode,loaded.metro],pools);assert.deepEqual(timing.pools,pools);
  assert.deepEqual(loaded.off,[false,false,false]);assert.deepEqual(timing.off,[false,false,false]);
  assert.deepEqual(loaded.bad,[]);assert.deepEqual(timing.bad,[]);
  const {columns,records}=read(c.blockFile);
  assert.deepEqual(columns,split('request block slot wasm zones nodes arcs origins targets handlerMs'));
  assert.equal(records.length,c.blocks.count);assert.ok(records.length>0);
  const counters={JS:0,WASM:0},acks={},requests=new Map(),samples=bins.slice(1).map(()=>[]);
  for(const [req,block,slot,wasm,z,n,a,origins,targets,ms] of records){
    assert.ok([0,1].includes(wasm)&&Number.isInteger(slot)&&slot>=0&&slot<pools[0]);
    assert.ok([z,n,a,origins].every(x=>Number.isInteger(x)&&x>0)&&Number.isFinite(ms)&&ms>=0);
    const density=targets/(z*origins);assert.ok(density>=0&&density<=1);
    if(variant!=='POLICY') assert.equal(wasm,Number(variant==='WASM'));
    if(profile==='mobile-no-module')assert.equal(wasm,0);
    if(variant==='POLICY')assert.equal(wasm,Number(loaded.hasWasm&&targets>=origins*z*policyDensity));
    acks[slot]=(acks[slot]||0)+1;counters[wasm?'WASM':'JS']++;
    if(!requests.has(req)) requests.set(req,new Map());
    const group=requests.get(req);assert.ok(!group.has(block));group.set(block,[z,n,a,origins,targets]);
    samples[bins.findIndex(x=>x>density)-1].push(ms);
  }
  assert.deepEqual(acks,timing.acks);assert.equal(Object.keys(acks).length,pools[0]);assert.deepEqual(counters,timing.kernelBlocks);
  // Each request covers the same 32 ordered blocks. Compare entire requests as a multiset to ignore dispatch order and request serial numbers.
  const shapes=[];
  for(const group of requests.values()){
    assert.equal(group.size,32);
    shapes.push(hash(JSON.stringify(Array.from({length:32},(_,i)=>{assert.ok(group.has(i));return group.get(i);}))));
  }
  const result={shapeSHA256:hash(JSON.stringify(shapes.sort())),records:records.length,samples,counters};
  cache.set(c.token,result);return result;
}
const out={scope:'Foreground player time starts at jump button dispatch or the natural endDay call and ends at jumpDone or settled month review. Handler times are individual road Worker blocks and overlap across slots. Work fingerprints compare block shapes and request grouping; they do not contain input array bytes.',
  sourceSHA256:source.sourceSHA256,kernelSHA256:source.embeddedKernelSHA256,browser:source.browser,
  verifiedPerSnapshot:{periods:8,typedArraySHA256s:232,metrics:20,periodStatsPerPeriod:29,dailySHA256s:43,additionalSHA256s:6},
  forced:[],policy:[]};
const pooled={};
for(const p of source.comparisons){
  const match=c=>c.mapSize===p.mapSize&&c.scenario===p.scenario;
  const policy=p.kind==='policy-vs-forced-js';
  const js=source.cases.find(c=>match(c)&&c.variant==='JS'&&c.round===(policy?1:p.round));
  const alt=source.cases.find(c=>match(c)&&c.variant===(policy?'POLICY':'WASM')&&c.round===p.round&&c.profile===p.profile);
  assert.ok(js&&alt);const a=check(js),b=check(alt);
  assert.deepEqual(js.before,alt.before);assert.deepEqual(js.after,alt.after);
  assert.equal(a.records,b.records);assert.equal(a.shapeSHA256,b.shapeSHA256);
  assert.equal(js.timing.ms,p.jsMs);assert.equal(alt.timing.ms,p.wasmMs);
  if(reversed){
    assert.equal(p.round,2);
    const first=prior.comparisons.find(x=>x.kind==='forced'&&x.mapSize===p.mapSize&&x.scenario===p.scenario&&x.round===1);
    assert.deepEqual(p.order,[...first.order].reverse());
    for(const current of [js,alt]){
      const original=prior.cases.find(x=>match(x)&&x.variant===current.variant&&x.round===1);
      assert.deepEqual(original.before,current.before);assert.deepEqual(original.after,current.after);
    }
    const priorResult=JSON.parse(fs.readFileSync(path.join(path.dirname(source.resumedFrom),'verified-summary.json'),'utf8'));
    assert.equal(a.shapeSHA256,priorResult.forced.find(x=>x.round===1&&x.map===p.mapSize&&x.scenario===p.scenario).matchedShapeSHA256);
  }
  const matchedProfile=js.profile===alt.profile;
  const row={map:p.mapSize,scenario:p.scenario,profile:p.profile,round:p.round,order:p.order,playerJsMs:matchedProfile?round(js.timing.ms):null,playerComparedMs:round(alt.timing.ms),
    playerPctLess:matchedProfile?round(100*(1-alt.timing.ms/js.timing.ms)):null,mapClock:[js.before.clock,js.after.clock],
    economyKeys:[Object.keys(js.before.economy).length,Object.keys(js.after.economy).length],matchedBlocks:a.records,matchedShapeSHA256:a.shapeSHA256,
    comparedBackend:b.counters,atLeast11PctShare:round(a.samples.slice(3).reduce((s,v)=>s+v.length,0)/a.records),
    density:a.samples.flatMap((v,i)=>{if(!v.length)return [];assert.equal(v.length,b.samples[i].length);return [{
      minPct:bins[i]*100,maxPct:Number.isFinite(bins[i+1])?bins[i+1]*100:null,blocks:v.length,
      share:round(v.length/a.records),jsHandlerMedianMs:matchedProfile?round(median(v)):null,comparedHandlerMedianMs:round(median(b.samples[i]))}];})
  };
  if(!policy&&p.round===1){
    const binsForMap=pooled[p.mapSize]??=a.samples.map(()=>({js:[],wasm:[]}));
    a.samples.forEach((v,i)=>{binsForMap[i].js.push(...v);binsForMap[i].wasm.push(...b.samples[i]);});
  }
  out[policy?'policy':'forced'].push(row);
}
out.primaryHandlerBandsByMap={};
for(const [map,bandList] of Object.entries(pooled)){
  const total=bandList.reduce((n,band)=>n+band.js.length,0);
  const eligible=bandList.slice(3).reduce((n,band)=>n+band.js.length,0);
  out.primaryHandlerBandsByMap[map]={total,atLeast11Pct:eligible,atLeast11PctShare:round(eligible/total),
    bands:bandList.flatMap(({js,wasm},i)=>js.length?[{
      minPct:bins[i]*100,maxPct:Number.isFinite(bins[i+1])?bins[i+1]*100:null,count:js.length,
      share:round(js.length/total),jsMedianMs:round(median(js)),wasmMedianMs:round(median(wasm))
    }]:[])};
}
const complete=new Set(out.forced.filter(p=>p.round===1).map(p=>p.map+'/'+p.scenario));
const expected=Object.keys(fixtureChecks).flatMap(map=>['quarter','year','boundary'].map(s=>map+'/'+s));
out.missingForced=expected.filter(k=>!complete.has(k));out.runnerErrors=source.errors;out.runnerError=source.error??null;
if(reversed){
  delete out.missingForced;
  out.matchesOriginalGameStatesAndForcedSources=true;
  out.missingReversedShanghai=['quarter','year','boundary'].filter(scenario=>!out.forced.some(p=>p.scenario===scenario));
}
out.elapsedMs=source.elapsedMs??null;out.final=source.final??null;
if(!partial){
  assert.deepEqual(source.errors,[]);assert.equal(source.error,undefined);
  if(reversed)assert.deepEqual(out.missingReversedShanghai,[]);
  else {assert.deepEqual(out.missingForced,[]);assert.equal(source.forcedComplete,true);}
}
const output=path.join(runDir,'verified-summary.json');
fs.writeFileSync(output,JSON.stringify(out,null,2)+'\n');
console.log(output,out.forced.length+' forced pairs, '+out.policy.length+' policy comparisons, '+(out.missingForced??out.missingReversedShanghai).length+' missing requested pairs');
