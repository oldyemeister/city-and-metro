// Real Shanghai city, read-only exported fixture, memory-only save storage.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),memory=new Map();
const c={console,performance,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,navigator:{hardwareConcurrency:4,deviceMemory:4},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}};c.window=c;vm.createContext(c);
const load=async f=>vm.runInContext(await fs.readFile(new URL(f,root),'utf8'),c,{filename:f});
for(const[,f]of(await fs.readFile(new URL('index.html',root),'utf8')).matchAll(/<script src="([^"]+)"/g)){await load(f);if(f==='js/save.js')break;}
const C=c.CM,plain=x=>JSON.parse(JSON.stringify(x)),ym=(y,m)=>y+(m-1)/12;
C.UI=function(){};for(const f of ['settings','corp','fleet','screens'])await load('js/'+f+'.js');
const current=C.MAPS.sh.data;
const bc={CM:{U:C.U,CFG:C.CFG,GEOS:C.GEOS,DATA:{plans:C.DATA.plans}}};bc.window=bc;vm.createContext(bc);
vm.runInContext(execFileSync('git',['show','de555aaa37a18ddd91033cda6977712d33bb4ed1:js/data_sh.js'],{cwd:root,encoding:'utf8'}),bc);
const old=bc.CM.MAP_LIST.find(x=>x.id==='sh').data;bc.CM.MAP_LIST=[];
vm.runInContext(await fs.readFile(new URL('js/data_sh.js',root),'utf8'),bc);
const raw=bc.CM.MAP_LIST.find(x=>x.id==='sh').data;
const ids=['sh_sisu_hongkou','sh_ecupl_changning','sh_shcm_fenyang'];
assert.deepEqual(plain(raw.facilities.slice(0,-3)),plain(old.facilities),'all pre-batch facilities including P1 byte-equivalent objects');
assert.deepEqual(plain(raw.facilities.slice(-3).map(f=>f.id)),ids);
assert.deepEqual(plain(raw.events.slice(0,old.events.length)),plain(old.events),'preserve complete historical prefix');
for(const k of Object.keys(old))if(!['facilities','events'].includes(k))assert.deepEqual(plain(raw[k]),plain(old[k]),'unrelated data '+k);
C.useMap('sh');
const fixture=new URL('savedgames/test/城市与地铁_经营挑战 · 上海 1990_2000年7月.cmsave.json',root);
const text=await fs.readFile(fixture,'utf8'),payload=C.Save.parseEnvelope(text).payload;
const g=C.Game.restore(payload);assert.equal(g.mapId,'sh');assert.equal(g.clock.y,2000);assert.equal(g.clock.m,7);assert.equal(Object.keys(g.net.stations).length,121);
assert.deepEqual(plain(g.net),plain(payload.net),'old network survives');assert.equal(g.econ.funds,payload.econ.funds);assert.deepEqual(plain(g.econ.ledger),plain(payload.econ.ledger));
const all=C.Fac.list(g.city),by=id=>{const f=all.find(f=>f.id===id);assert.ok(f,'missing '+id);return f;};
assert.equal(new Set(all.map(f=>f.id)).size,all.length,'unique generated and explicit IDs');
const weight=(id,t)=>C.Fac.share(by(id),t)/C.CFG.trips.facBoost;
const expected=[
 [1990,[.0025,.002,.0006]], [2000,[.003,.002769230769230769,.0008]],
 [ym(2001,10),[.0027,null,null]], [2005,[.0015,.003,.0009]],
 [ym(2005,8),[.0015,.0012,null]], [2007,[.0015,null,null]], [2010,[.0012,.0015,.001]],
 [ym(2019,8),[.0012,.0015,.001]], [ym(2019,9),[.0012,.0015,.00065]], [2020,[.0012,.0015,.00065]]
];
for(const [t,ws]of expected)for(let k=0;k<3;k++)if(ws[k]!=null)assert.ok(Math.abs(weight(ids[k],t)-ws[k])<1e-10,ids[k]+' weight '+t+' got '+weight(ids[k],t));
for(let y=1990;y<=2025;y++)for(let m=1;m<=12;m++){
 let sum=0;
 for(const id of ids){const f=by(id);assert.ok(C.Fac.active(f,ym(y,m),g.city),id+' monthly activation '+y+'/'+m);const w=weight(id,ym(y,m));assert.ok(w>0&&w<=.01);sum+=w;}
 assert.ok(sum<=.0074,'bounded campus teaching allocation');
}
const coords=[[31.2773147,121.4783703],[31.2257692,121.4140921],[31.2146606,121.4503251]];
for(let i=0;i<3;i++){
 const id=ids[i],f=by(id),src=current.facilities.find(s=>s.id===id),[lat,lon]=coords[i];
 assert.equal(f.t,'uni');assert.deepEqual(plain(f.p),{sc:1});assert.equal(f.label.replace('\n',''),f.name);assert.equal(f.label.split('\n').length,2);
 assert.ok(!f.pax&&!f.ext&&!src.we&&!src.p,'no external riders, event purpose or mode overrides');assert.ok(src.exactSite);
 assert.equal(f.x,+((lon-121.31)*380.6).toFixed(2));assert.equal(f.y,+((31.42-lat)*442.3).toFixed(2));
 assert.ok(f.x>=0&&f.y>=0&&f.x<152&&f.y<152);assert.ok(g.city.landMax[g.city.cellAt(f.x,f.y)]>=.5);assert.ok(C.Fac.siteCells(f,g.city).length);
 assert.equal(C.Fac.active(f,f.open-1/12,g.city),false,'before address use');
 console.log('SITE',id,f.x,f.y,'open',f.open);
}
const city=g.city,VW=city.VW,road=cc=>{const v=((cc/city.W)|0)*VW+cc%city.W;return city.walk.deg[v]>0||city.walk.deg[v+1]>0||city.walk.deg[v+VW]>0||city.walk.deg[v+VW+1]>0;};
for(const t of [1990,ym(2001,9),ym(2001,10),ym(2005,7),ym(2005,8),ym(2019,8),ym(2019,9),2020]){
 const state=new C.City();state.generate(19900101,t);const list=C.Fac.list(state),probe={city:state,Z:0,year:t};const fn=C.Model.prototype.buildFacNodes.call(probe);
 for(const id of ids){const f=list.find(f=>f.id===id),cc=state.cellAt(f.x,f.y);assert.ok(C.Fac.active(f,t,state));assert.ok(state.regionOpen[state.region[cc]],id+' region open '+t);assert.equal(fn.ids.filter(x=>x===id).length,1);assert.equal(fn.reach[fn.ids.indexOf(id)],0,'no artificial remote entrance');}
 const model=new C.Model(state,{deferDemand:true});model.year=t;model.buildZones();
 for(const id of ids){const k=model.fn.ids.indexOf(id);const rings=[...model.fn.ringFac].filter(([,ks])=>ks.includes(k)).map(([cc])=>cc);assert.ok(rings.some(road),id+' real road ring '+t);}
 const sum=model.fn.list.reduce((s,f)=>s+C.Fac.share(f,t)*(f.p.sc||0),0);assert.ok(sum<C.CFG.trips.facCap,'education below cap');
 // Same city/population, remove only this batch to compare ordinary generated facilities and demand totals.
 const data=C.DATA.facilities,gen=list.filter(f=>f.gen).map(f=>f.id);
 model.buildDemand();const after=Array.from(model.od.tot),visits=ids.map(id=>{const k=model.Z+model.fn.ids.indexOf(id);return Array.from(model.od.dest).reduce((s,d,j)=>s+(d===k?model.od.t[1][j]:0),0);});
 C.DATA.facilities=data.filter(f=>!ids.includes(f.id));const beforeModel=new C.Model(state,{deferDemand:true});beforeModel.year=t;beforeModel.buildZones();beforeModel.buildDemand();
 assert.deepEqual(plain(C.Fac.list(state).filter(f=>f.gen).map(f=>f.id)),plain(gen),'no automatic facility duplication/suppression');
 for(let p=0;p<after.length;p++)assert.ok(Math.abs(after[p]-beforeModel.od.tot[p])<Math.max(1,after[p])*1e-9,'city purpose total unchanged '+p);
 C.DATA.facilities=data;
 console.log('DEMAND',JSON.stringify({year:t,educationShare:sum,cap:C.CFG.trips.facCap,totalAfter:after,totalBefore:Array.from(beforeModel.od.tot),campusSchoolPurposeTours:visits}));
}
{
 const city=new C.City();city.generate(19900101,2021.5);const net=C.Metro.empty(),facs=C.Fac.list(city);
 for(const id of ids){const f=facs.find(f=>f.id===id);const line=C.Metro.newLine(net);const stations=[];
  for(const [dx,dy] of [[-1.6,0],[1.6,0],[0,-1.6],[0,1.6],[-2,-1],[2,1]]){
   const x=f.x+dx,y=f.y+dy;if(!C.Metro.checkSite(city,x,y,'underground').ok)continue;
   const st=C.Metro.addStation(net,x,y,{size:'M',type:'underground'},city);if(!stations.includes(st))stations.push(st);if(stations.length===2)break;
  }
  assert.equal(stations.length,2,id+' nearby buildable service');C.Metro.addSegment(net,line,stations[0],stations[1],[],'underground');
 }
 const model=new C.Model(city,{deferDemand:true});model.year=2021.5;model.buildZones();const compiled=C.Metro.compile(net,city),acc=model.computeAccess(compiled);
 for(const id of ids){const k=model.fn.ids.indexOf(id);assert.ok(k>=0);assert.ok(acc.zCov[model.Z+k]>0,id+' actual walking access');assert.ok(acc.zl[model.Z+k]?.length,id+' station access list');}
 console.log('PASS actual Shanghai walking graph: three campuses connect to nearby synthetic operating stations');
}
assert.equal(await fs.readFile(fixture,'utf8'),text,'source fixture untouched');
console.log('PASS education batch: immutable P1/IDs/events, monthly activation/weights, labels, land/regions, walking graph, fixed total demand and old save');
