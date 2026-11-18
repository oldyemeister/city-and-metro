import fs from 'node:fs';
import assert from 'node:assert/strict';
const file=process.argv[2],r=JSON.parse(fs.readFileSync(file));
const diffs=(a,b,p='')=>{
 if(Object.is(a,b))return [];
 if(!a||!b||typeof a!=='object'||typeof b!=='object')return [{path:p,a,b}];
 return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>diffs(a[k],b[k],p?p+'.'+k:k));
};
const stat=a=>{a.sort((x,y)=>x-y);return {min:a[0],median:a[a.length>>1],max:a.at(-1)};};
const out={source:file,browser:r.browser,error:r.error??null,completed:r.cases.filter(c=>c.after).length,comparisons:[],summary:[]};
for(const scenario of ['quarter','year','boundary']){
 const rows=r.cases.filter(c=>c.scenario===scenario&&c.after);
 for(let round=1;round<=3;round++){
  const a=rows.find(c=>c.round===round&&c.n===4),b=rows.find(c=>c.round===round&&c.n===2);if(!a||!b)continue;
  out.comparisons.push({scenario,round,beforeDiff:diffs(a.before,b.before),afterDiff:diffs(a.after,b.after)});
 }
 for(const n of [4,2]){
  const cases=rows.filter(c=>c.n===n);if(!cases.length)continue;
  for(const c of cases){assert.equal(c.timing.actualWorkers,n);assert.equal(c.check.mode,2);assert.equal(c.check.metro,2);assert.equal(c.timing.hidden,false);assert.equal(c.timing.paused,true);assert.equal(c.timing.months,scenario==='quarter'?3:scenario==='year'?12:1);assert.equal(c.timing.pending,false);assert.equal(Object.keys(c.after.arrays).length,40);}
  out.summary.push({scenario,n,runs:cases.length,elapsedMs:stat(cases.map(c=>scenario==='boundary'?c.timing.boundaryMs:c.timing.ms)),cpuPeak:stat(cases.map(c=>c.peak)),cpuAverage:stat(cases.map(c=>c.samples.reduce((a,s)=>a+s.intervalMs*s.cpuPct,0)/c.samples.reduce((a,s)=>a+s.intervalMs,0))),acrossRoundsAfterDiff:cases.slice(1).map(c=>({round:c.round,diff:diffs(cases[0].after,c.after)}))});
 }
}
console.log(JSON.stringify(out,null,2));
