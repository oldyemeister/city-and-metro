import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const save=await fs.readFile(process.argv[2],'utf8'), payload=JSON.parse(JSON.parse(save).body);
const output=await fs.mkdtemp(path.resolve('evidence/road-workers/run-'));
const profile=await fs.mkdtemp(path.join(tmpdir(),'metro-workers-'));
const url='http://localhost:8001/', deadline=Date.now()+600000;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check){
  while(Date.now()<deadline){const value=await check();if(value)return value;await pause(100);}
  throw Error('10 minute deadline');
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
const report={saveSHA256:createHash('sha256').update(save).digest('hex'),profile,cases:[]};
const write=()=>fs.writeFile(output+'/results.json',JSON.stringify(report,null,2));
let browser,page;
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
  for(const [scenario,n] of [['normal',4],['normal',2],['two',2],['two',4],['year',4],['year',2]]){
    console.log('Loading',scenario,n);await page.call('Page.navigate',{url:'about:blank'});await until(()=>ev("location.href==='about:blank'"));
    await page.call('Page.navigate',{url});await until(()=>ev('!!window.CM?.Save?.parseEnvelope && !!CM.loadGame'));
    await ev("CM.CarPool.size=()=>"+n+";CM.Settings.set('autosave',false);CM.loadGame(CM.Save.parseEnvelope("+JSON.stringify(save)+").payload);true");
    await until(()=>ev('!!CM.game && !CM.isLoading() && CM.game.model.trafficReady() && CM.game.model.settled && !CM.game.model.hasReviewWork() && CM.R.sharpReady()'));
    const check=await ev('({clock:{...CM.game.clock},stations:Object.keys(CM.game.net.stations).length,speed:CM.game.speed,map:CM.game.mapId,road:CM.CarPool.list?.length,mode:CM.OdPool.list?.length,metro:CM.SkimPool.list?.length})');
    assert.deepEqual(check.clock,payload.clock);assert.equal(check.stations,278);assert.equal(check.map,'sh');assert.equal(check.speed,0);
    const row={scenario,n,check,before:await snapshot(),samples:[]};report.cases.push(row);
    let previous=await cpu();
    await ev(`(()=>{
      const g=CM.game;window.run={start:performance.now(),done:0,hidden:document.hidden,steps:[]};
      document.addEventListener('visibilitychange',()=>{if(document.hidden)run.hidden=true});
      if('${scenario}'==='normal'){
        const advance=g.advanceClock,target=g.clock.minute+240;
        g.advanceClock=function(dt){const left=(target-this.clock.minute)*CM.CFG.time.secPerHour/(60*this.clockRate());
          advance.call(this,Math.min(dt,left));if(dt>=left){this.setSpeed(0);run.done=performance.now();delete this.advanceClock;}};
        g.setSpeed(1);
      }else{
        const count='${scenario}'==='year'?6:1;
        g.on('jumpDone',()=>{run.steps.push(performance.now()-run.start);if(run.steps.length===count)run.done=performance.now();
          else queueMicrotask(()=>{CM.ui.closeScreen();if(!g.startJump(2))throw Error('jump rejected');});});
        if(!g.startJump(2))throw Error('jump rejected');
      }
      return true;
    })()`);
    await until(async()=>{
      await pause(150);const next=await cpu(),old=new Map(previous.p.map(p=>[p.id,p.cpuTime]));
      let delta=0;for(const p of next.p)if(old.has(p.id))delta+=Math.max(0,p.cpuTime-old.get(p.id));
      row.samples.push({intervalMs:next.at-previous.at,cpuPct:100000*delta/(next.at-previous.at)});previous=next;
      return ev('run.done>0');
    });
    row.timing=await ev('({ms:run.done-run.start,steps:run.steps,hidden:run.hidden,actualWorkers:CM.CarPool.list?.length})');
    row.after=await snapshot();assert.equal(row.timing.actualWorkers,n);
    row.peak=Math.max(...row.samples.map(s=>s.cpuPct));console.log(scenario,n,row.timing.ms,row.peak,row.after.clock);await write();
  }
}catch(e){report.error=String(e);console.error(e);process.exitCode=1;}
finally{await write();console.log(output);page?.close();browser?.close();}
