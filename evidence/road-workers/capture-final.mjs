import fs from 'node:fs/promises';
const dir=process.argv[2],report=JSON.parse(await fs.readFile(dir+'/results.json'));
const port=(await fs.readFile(report.profile+'/DevToolsActivePort','utf8')).split('\n')[0];
const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const tab=tabs.find(t=>t.url.startsWith('http://localhost:8001/'));
if(!tab)throw Error('isolated test tab missing');
const ws=new WebSocket(tab.webSocketDebuggerUrl),pending=new Map(),errors=[];let seq=0;
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown'||m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m);pending.get(m.id)?.(m);};
const call=(method,params={})=>new Promise((r,j)=>{const id=++seq,t=setTimeout(()=>{pending.delete(id);j(Error(method+' timeout'));},5000);pending.set(id,m=>{clearTimeout(t);pending.delete(id);m.error?j(Error(JSON.stringify(m.error))):r(m.result);});ws.send(JSON.stringify({id,method,params}));});
try{
 await call('Runtime.enable');await call('Log.enable');
 const state=await call('Runtime.evaluate',{expression:`(()=>{const g=CM.game,m=g.model;return {clock:{...g.clock},map:g.mapId,stations:Object.keys(g.net.stations).length,speed:g.speed,ready:m.trafficReady(),settled:m.settled,pending:!!g.pending,jumping:!!g.jumping,review:m.hasReviewWork(),road:CM.CarPool.list.length,mode:CM.OdPool.list.length,metro:CM.SkimPool.list.length,visible:!document.hidden,focus:document.hasFocus(),sharp:CM.R.sharpReady(),hooksRemoved:!Object.hasOwn(g,'update')&&!Object.hasOwn(g,'endDay'),resourceFailures:performance.getEntriesByType('resource').filter(x=>x.responseStatus>=400).map(x=>({name:x.name,status:x.responseStatus}))};})()`,returnByValue:true});
 if(state.exceptionDetails)throw Error(JSON.stringify(state.exceptionDetails));
 const screenshot=await call('Page.captureScreenshot',{format:'png'});await fs.writeFile(dir+'/final.png',Buffer.from(screenshot.data,'base64'));
 await fs.writeFile(dir+'/final-state.json',JSON.stringify({observedAt:new Date().toISOString(),state:state.result.value,errors},null,2));console.log(JSON.stringify(state.result.value));
}finally{ws.close();}
