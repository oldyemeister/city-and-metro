import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const save=await fs.readFile(process.argv[2],'utf8'), payload=JSON.parse(JSON.parse(save).body);
const output=await fs.mkdtemp(path.resolve('evidence/road-workers/repeated-'));
const profile=await fs.mkdtemp(path.join(tmpdir(),'metro-workers-'));
const url='http://localhost:8001/', deadline=Date.now()+1200000;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){
  while(Date.now()<deadline){const value=await check();if(value)return value;await pause(100);}
  throw Error('20 minute deadline');
}
async function connect(url){
  const ws=new WebSocket(url);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  const pending=new Map();let seq=0;
  ws.onmessage=e=>{const m=JSON.parse(e.data);pending.get(m.id)?.(m);};
  return {close:()=>ws.close(),call:(method,params={})=>new Promise((r,j)=>{
    const id=++seq;const timer=setTimeout(()=>{pending.delete(id);j(Error(method+' timeout'));},10000);
    pending.set(id,m=>{clearTimeout(timer);pending.delete(id);m.error?j(Error(JSON.stringify(m.error))):r(m.result);});
    ws.send(JSON.stringify({id,method,params}));
  })};
}
const report={startedAt:new Date().toISOString(),sourceRevision:'f9706d42faffdd7c3b99720923aa0259f8181943',method:'actual quarter/year button handlers; natural boundary from derived Jan31 23:59 setup',saveSHA256:createHash('sha256').update(save).digest('hex'),profile,cases:[]};
const write=()=>fs.writeFile(output+'/results.json',JSON.stringify(report,null,2));
let browser,page;
console.log('OUTPUT',output);
try{
  if(await(await fetch(url+'js/sim.js')).text()!==await fs.readFile('js/sim.js','utf8'))throw Error('Preview mismatch');
  const settings=JSON.parse(await fs.readFile('.agents/skills/metro-browser-check/test-settings.json'));
  spawn(settings.browserExecutable,['--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check',url],{detached:true,stdio:'ignore'}).unref();
  const port=await until(async()=>{try{return (await fs.readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0];}catch{}});
  const get=async route=>(await fetch('http://127.0.0.1:'+port+route)).json();
  const version=await get('/json/version');report.browser=version.Browser;browser=await connect(version.webSocketDebuggerUrl);
  const tab=await until(async()=>(await get('/json/list')).find(t=>t.url.startsWith(url)));page=await connect(tab.webSocketDebuggerUrl);
  async function ev(expression){const r=await page.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  async function cpu(){const p=await browser.call('SystemInfo.getProcessInfo');return {at:performance.now(),p:p.processInfo};}
  const snapshot=async()=>ev(`(async()=>{
    const g=CM.game,m=g.model,digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    const arrays={};for(const dt of ['wd','we'])for(const [i,p] of m.ctxs[dt].per.entries())for(const k of ['arcTime','arcVol','load','stIn','stOut']){
      const v=p[k];if(v)arrays[dt+i+k]=await digest(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));
    }
    return {clock:{...g.clock},metrics:g.snapshotMetrics(),ledger:await digest(new TextEncoder().encode(JSON.stringify(g.econ.ledger))),arrays};
  })()`);
  const cases=[];for(let round=1;round<=3;round++)for(const scenario of ['quarter','year','boundary'])for(const n of (round%2?[4,2]:[2,4]))cases.push([scenario,n,round]);
  for(const [scenario,n,round] of cases){
    console.log('Loading',scenario,n,'round',round);await page.call('Page.navigate',{url:'about:blank'});await until(()=>ev("location.href==='about:blank'"));
    await page.call('Page.navigate',{url});await until(()=>ev('!!window.CM?.Save?.parseEnvelope && !!CM.loadGame'));
    await ev("CM.CarPool.size=()=>"+n+";CM.Settings.set('autosave',false);CM.loadGame(CM.Save.parseEnvelope("+JSON.stringify(save)+").payload);true");
    await until(()=>ev('!!CM.game && !CM.isLoading() && CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && CM.R.sharpReady()'));
    const check=await ev('({clock:{...CM.game.clock},stations:Object.keys(CM.game.net.stations).length,speed:CM.game.speed,map:CM.game.mapId,road:CM.CarPool.list?.length,mode:CM.OdPool.list?.length,metro:CM.SkimPool.list?.length})');
    assert.deepEqual(check.clock,payload.clock);assert.equal(check.stations,278);assert.equal(check.map,'sh');assert.equal(check.speed,0);
    if(scenario==='boundary')await ev(`(()=>{const g=CM.game;while(g.clock.d<CM.U.daysInMonth(g.clock.y,g.clock.m)){if(g.endDay())throw Error('unexpected month crossed in setup');}g.clock.minute=1439;return true;})()`);
    const row={scenario,n,round,check,before:await snapshot(),samples:[]};report.cases.push(row);
    let previous=await cpu();
    await ev(`(()=>{
      const g=CM.game;window.run={start:performance.now(),done:0,crossStart:0,hidden:document.hidden,steps:[],months:0};
      document.addEventListener('visibilitychange',()=>{if(document.hidden)run.hidden=true});
      g.on('month',()=>run.months++);
      if('${scenario}'==='boundary'){
        const end=g.endDay;
        g.endDay=function(){run.crossStart=performance.now();const crossed=end.call(this);if(crossed){this.setSpeed(0);delete this.endDay;}return crossed;};
        const tick=g.update;
        g.update=function(...args){const result=tick.apply(this,args);if(run.crossStart&&!this.pending&&!this.jumping&&this.model.trafficReady()&&this.model.settled&&!this.model.hasReviewWork()&&!this.taskRecheckYM){run.done=performance.now();delete this.update;}return result;};
        g.setSpeed(1);
      }else{
        g.on('jumpDone',()=>{run.steps.push(performance.now()-run.start);run.done=performance.now();});
        const button=document.querySelector('[data-act="${scenario==='quarter'?'jumpQuarter':'jumpYear'}"]');
        if(!button)throw Error('button missing');button.click();
        if(!g.jumping||g.jumping.months!==${scenario==='quarter'?3:12})throw Error('button jump rejected');
      }
      return true;
    })()`);
    await until(async()=>{
      await pause(150);const next=await cpu(),old=new Map(previous.p.map(p=>[p.id,p.cpuTime]));
      let delta=0;for(const p of next.p)if(old.has(p.id))delta+=Math.max(0,p.cpuTime-old.get(p.id));
      row.samples.push({intervalMs:next.at-previous.at,cpuPct:100000*delta/(next.at-previous.at)});previous=next;
      return ev('run.done>0');
    });
    row.timing=await ev('({ms:run.done-run.start,boundaryMs:run.crossStart?run.done-run.crossStart:null,steps:run.steps,months:run.months,hidden:run.hidden,actualWorkers:CM.CarPool.list?.length,paused:CM.game.speed===0,settled:CM.game.model.settled,ready:CM.game.model.trafficReady(),pending:!!CM.game.pending})');
    await until(()=>ev('CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && !CM.game.pending'));
    row.after=await snapshot();assert.equal(row.timing.actualWorkers,n);
    row.peak=Math.max(...row.samples.map(s=>s.cpuPct));console.log(scenario,n,'round',round,JSON.stringify(row.timing),'peak',row.peak,JSON.stringify(row.after.clock));await write();
  }
}catch(e){report.error=String(e);console.error(e);process.exitCode=1;}
finally{await write();console.log(output);page?.close();browser?.close();}
