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
vm.runInContext(execFileSync('git',['show','bd76a322970ae250b8920aed03fd7661a882342a:js/data_sh.js'],{cwd:root,encoding:'utf8'}),bc);
const old=bc.CM.MAP_LIST.find(x=>x.id==='sh').data;bc.CM.MAP_LIST=[];
vm.runInContext(await fs.readFile(new URL('js/data_sh.js',root),'utf8'),bc);
const raw=bc.CM.MAP_LIST.find(x=>x.id==='sh').data;
const mutable=new Set(['sh_fudan','sh_shu','sh_renji','sh_sjtu','sh_dhu']);for(const f of raw.facilities){const prev=old.facilities.find(b=>b.id===f.id);if(prev&&!mutable.has(f.id))assert.deepEqual(plain(f),plain(prev),'unrelated facility '+f.id);}
const oldIds=old.facilities.map(f=>f.id);assert.deepEqual(plain(current.facilities.slice(0,oldIds.length).map(f=>f.id)),plain(oldIds),'existing ID order');assert.deepEqual(plain(raw.landmarks),plain(old.landmarks),'landmark IDs/locations unchanged');assert.deepEqual(plain(raw.events.slice(0,old.events.length)),plain(old.events),'historical event prefix unchanged');
C.useMap('sh');
const fixture=new URL('savedgames/test/城市与地铁_经营挑战 · 上海 1990_2000年7月.cmsave.json',root);
const text=await fs.readFile(fixture,'utf8'),payload=C.Save.parseEnvelope(text).payload;
const g=C.Game.restore(payload);assert.equal(g.mapId,'sh');assert.equal(g.clock.y,2000);assert.equal(g.clock.m,7);assert.equal(Object.keys(g.net.stations).length,121);
assert.deepEqual(plain(g.net),plain(payload.net),'old network survives');assert.equal(g.econ.funds,payload.econ.funds);assert.deepEqual(plain(g.econ.ledger),plain(payload.econ.ledger));
const all=C.Fac.list(g.city),by=id=>{const f=all.find(f=>f.id===id);assert.ok(f,'missing '+id);return f;};
assert.equal(C.DATA.facilities.find(f=>f.id==='sh_jinjiang').noModel,true,'Jinjiang uses existing map, no oversized theme park model');
assert.equal(all.find(f=>f.id==='sh_jinjiang').noModel,true,'model suppression survives facility compilation');
const phase=process.argv[2]||'all';
const groups={a:['sh_renji_east','sh_science','sh_jinjiang','sh_oriental_sports','sh_global_harbor','sh_cpc_first'],b:['sh_shnu_xuhui','sh_usst_jungong','sh_shu_yanchang'],c:['sh_fudan_jiangwan','sh_fudan_zhangjiang','sh_pediatric_minhang','sh_pediatric_fenglin']};
const ids=Object.entries(groups).filter(([k])=>phase==='all'||k<=phase).flatMap(([,v])=>v);
assert.equal(new Set(all.map(f=>f.id)).size,all.length,'unique real/generated IDs');
for(const id of ids){const f=by(id),src=current.facilities.find(s=>s.id===id);assert.ok(f.x>=0&&f.y>=0&&f.x<152&&f.y<152,id+' bounds');assert.ok(!f.pax&&!f.ext,id+' ordinary facility');assert.ok(src.exactSite,id+' bypass station snapping');assert.ok(Math.hypot(f.x-src.at[0],f.y-src.at[1])<.01,id+' no land relocation');assert.ok(g.city.landMax[g.city.cellAt(f.x,f.y)]>=.5,id+' land');assert.ok(C.Fac.siteCells(f,g.city).length,id+' site cells');console.log('SITE',id,f.x,f.y,'open',f.open);}
const w=(id,y,m=1)=>C.Fac.share(by(id),ym(y,m))/C.CFG.trips.facBoost;
assert.equal(by('sh_jinjiang').noModel,true,'Jinjiang must not get the 820x660m generic themepark model');
await load('js/render.js');await load('js/scenery.js');const renderer=Object.create(C.Renderer.prototype);renderer.game=g;assert.ok(!renderer.facModels(g.city,2000.5).some(x=>x.fac==='sh_jinjiang'),'Actual renderer skips Jinjiang generic model');
const first=by('sh_cpc_first');assert.ok(C.Fac.active(first,1990,g.city));assert.equal(w(first.id,1990),.002);for(const t of [2010,2015,2020,ym(2021,5),ym(2021,6)-1/12000])assert.equal(C.Fac.share(first,t)/1.25,.004);
assert.equal(w(first.id,2021,6),.009);assert.equal(w(first.id,2021,7),.009);assert.equal(all.filter(f=>/一大/.test(f.name)).length,1);
for(const [id,y,m] of [['sh_renji_east',1999,10],['sh_science',2001,12],['sh_oriental_sports',2011,3],['sh_global_harbor',2013,7],...(phase==='all'||phase>='c'?[['sh_fudan_jiangwan',2005,9],['sh_fudan_zhangjiang',2005,9],['sh_pediatric_minhang',2008,3]]:[])]){const f=by(id);assert.equal(C.Fac.active(f,ym(y,m)-1/12,g.city),false,id+' before opening');}
assert.equal(w('sh_science',2005,4),.006);assert.equal(w('sh_science',2005,5),.01);assert.equal(w('sh_oriental_sports',2011,8),.001);assert.equal(w('sh_oriental_sports',2011,9),.004);assert.ok(w('sh_renji',2020)>0);assert.ok(w('sh_renji_east',2000)<w('sh_renji_east',2020));
if(phase==='all'||phase>='b'){for(let y=1990;y<=2021;y++){const sum=w('sh_shu_yanchang',y)+(y>=1999?w('sh_shu',y):0);assert.ok(Math.abs(sum-.02)<1e-9,'SHU allocation '+y);}for(const id of groups.b)assert.ok(by(id).label.includes('\n'));}
if(phase==='all'||phase>='c'){for(let y=1990;y<=2021;y++)for(let m=1;m<=12;m++){const sum=w('sh_fudan',y,m)+(ym(y,m)>=ym(2005,9)?w('sh_fudan_jiangwan',y,m)+w('sh_fudan_zhangjiang',y,m):0);assert.ok(Math.abs(sum-.035)<1e-9,'Fudan allocation '+y+'/'+m);}assert.ok(w('sh_pediatric_fenglin',2009)>0);assert.ok(by('sh_pediatric_fenglin').name.includes('（旧址）'));assert.ok(!by('sh_renji').name.includes('旧址'));}
// Real road graph and facility perimeter: every new destination has a walkable ring without fallback water crossing.
const city=g.city,VW=city.VW,road=cc=>{const v=((cc/city.W)|0)*VW+cc%city.W;return city.walk.deg[v]>0||city.walk.deg[v+1]>0||city.walk.deg[v+VW]>0||city.walk.deg[v+VW+1]>0;};
for(const y of [1990,2000,2006,2009,2014,2021]){city.updateYear?.(y);g.model.year=y;g.model.buildFacNodes();for(const id of ids){const f=by(id);if(y<f.open)continue;const k=g.model.fn.ids.indexOf(id);assert.ok(k>=0,id+' active node '+y);const rings=[...g.model.fn.ringFac].filter(([,ks])=>ks.includes(k)).map(([cc])=>cc);assert.ok(rings.some(road),id+' road entry '+y);assert.equal(g.model.fn.reach[k],0,id+' no artificial remote entrance');}}
// Generate actual city states, including new land and landmark activation, independently of the player's network.
for(const [y,m] of [[1990,1],[2005,8],[2005,9],[2008,2],[2008,3],[2008,6],[2011,3],[2011,9],[2021,5],[2021,6],[2021,7]]){
 const year=ym(y,m),state=new C.City();state.generate(19900101,year);const list=C.Fac.list(state);
 const probe={city:state,Z:0,year};const fn=C.Model.prototype.buildFacNodes.call(probe);
 for(const id of ids){const f=list.find(f=>f.id===id);assert.ok(f);const expected=year>=f.open&&(f.close==null||year<f.close);assert.equal(C.Fac.active(f,year,state),expected,id+' activation '+y+'/'+m);assert.equal(fn.ids.filter(x=>x===id).length,expected?1:0,id+' unique demand node '+y+'/'+m);}
}
if(phase==='all'){
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
 console.log('PASS actual Shanghai walking graph: all P1 sites connect to nearby synthetic operating stations');
}
assert.equal(await fs.readFile(fixture,'utf8'),text,'source fixture untouched');
console.log('PASS Shanghai '+phase+': dates, stages, IDs/events, campus allocations, old save/network and land/road access');
