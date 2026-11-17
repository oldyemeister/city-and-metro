import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const start=Date.now(), limit=start+119000, url='http://localhost:8001/';
const output=await fs.mkdtemp(path.resolve('evidence/shanghai-two-month/run-'));
const profile=await fs.mkdtemp(path.join(tmpdir(),'metro-trace-'));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const report={profile,url,completed:false,errors:[]};
let ws,recording=false,stream,seq=0;
const pending=new Map();
const launch=(bin,args)=>spawn(bin,args,{detached:true,stdio:'ignore'}).unref();
async function until(fn,end=limit-12000){while(Date.now()<end){let value=await fn();if(value)return value;await pause(100);}throw Error('Deadline reached');}
async function call(method,params={}){
 const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},Math.max(1,Math.min(8000,limit-Date.now())));pending.set(id,m=>{clearTimeout(timer);m.error?reject(Error(JSON.stringify(m.error))):resolve(m.result)});ws.send(JSON.stringify({id,method,params}));});
}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const state='(()=>{const g=CM.game;if(!g)return null;return {map:g.mapId,clock:{...g.clock},stations:Object.keys(g.net.stations).length,ready:g.model.trafficReady(),review:g.model.hasReviewWork(),pending:!!g.pending,jumping:!!g.jumping,settled:g.model.settled,sharp:CM.R.sharpReady(),speed:g.speed,visible:document.visibilityState}})()';
try{
const save=await fs.readFile(process.argv[2],'utf8'),payload=JSON.parse(JSON.parse(save).body);report.saveSHA256=createHash('sha256').update(save).digest('hex');
try{await fetch(url,{signal:AbortSignal.timeout(1500)})}catch{launch('python3',['-m','http.server','8001','--bind','127.0.0.1']);await pause(600);}
if(await (await fetch(url+'js/sim.js')).text()!==await fs.readFile('js/sim.js','utf8'))throw Error('Preview mismatch');
const cfg=JSON.parse(await fs.readFile('.agents/skills/metro-browser-check/test-settings.json'));launch(cfg.browserExecutable,['--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check',url]);
const port=await until(async()=>{try{return (await fs.readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]}catch{}});
const targets=()=>fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json());
const tab=await until(async()=>(await targets()).find(t=>t.url.startsWith(url)));
ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id);}if(m.method==='Tracing.tracingComplete'){stream=m.params.stream;report.dataLoss=!!m.params.dataLossOccurred;}if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params.exceptionDetails.text);};
await call('Runtime.enable');await call('Page.bringToFront');report.browser=(await call('Browser.getVersion')).product;
await until(()=>evaluate('!!window.CM?.Save?.parseEnvelope && !!CM.loadGame'));
await evaluate("CM.Settings.set('autosave',false);CM.loadGame(CM.Save.parseEnvelope("+JSON.stringify(save)+").payload);true");
await until(()=>evaluate('!!CM.game && !CM.isLoading()'));
await evaluate('CM.game.setSpeed(0);true');report.before=await until(async()=>{const s=await evaluate(state);return s?.ready&&s.settled&&!s.review&&!s.pending&&s.sharp&&s.visible==='visible'&&s;});
if(report.before.map!==payload.meta.map||['y','m','d'].some(k=>report.before.clock[k]!==payload.clock[k])||report.before.stations!==Object.keys(payload.net.stations).length)throw Error('Loaded save mismatch');
console.log('Ready',report.before);
await call('Tracing.start',{transferMode:'ReturnAsStream',categories:'devtools.timeline,blink.user_timing,loading,v8,toplevel,disabled-by-default-devtools.timeline,disabled-by-default-v8.cpu_profiler'});recording=true;
const accepted=await evaluate("performance.mark('two-month-start');CM.game.startJump(2)");
if(!accepted)throw Error('Jump rejected');
report.after=await until(async()=>{const s=await evaluate(state);return !s.jumping&&s.ready&&!s.pending&&s;});
report.elapsedMs=await evaluate("performance.mark('two-month-ready');performance.measure('two-month-jump','two-month-start','two-month-ready').duration");
report.completed=report.after.clock.y===2010&&report.after.clock.m===3&&report.after.clock.d===16;
}catch(e){report.error=String(e);}
finally{
if(recording)try{await call('Tracing.end');await until(()=>stream,limit-1000);const file=await fs.open(output+'/trace.json','w');try{for(;;){const r=await call('IO.read',{handle:stream,size:1048576});await file.writeFile(Buffer.from(r.data,r.base64Encoded?'base64':'utf8'));if(r.eof)break;}}finally{await file.close();}await call('IO.close',{handle:stream});report.trace='trace.json';}catch(e){report.traceError=String(e);}
ws?.close();await fs.writeFile(output+'/summary.json',JSON.stringify(report,null,2));console.log(output,report);}
