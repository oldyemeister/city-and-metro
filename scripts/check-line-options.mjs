// Synthetic networks and memory-only storage; never opens player saves.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),memory=new Map();
const c={console,performance,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,navigator:{hardwareConcurrency:4},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}};
c.window=c;vm.createContext(c);
const load=async f=>vm.runInContext(await readFile(new URL(f,root),'utf8'),c,{filename:f});
for(const[,f]of(await readFile(new URL('index.html',root),'utf8')).matchAll(/<script src="([^"]+)"/g)){await load(f);if(f==='js/save.js')break;}
const C=c.CM,M=C.Metro; C.UI=function(){};
for(const f of ['settings','icons','corp','fleet','netlayout'])await load('js/'+f+'.js');
c.testH=(tag,props,...children)=>({tag,props,children});
vm.runInContext((await readFile(new URL('js/pages.js',root),'utf8')).replace('const h = U.h, ic = CM.icon;','const h = testH, ic = CM.icon;'),c);
vm.runInContext((await readFile(new URL('js/netmap.js',root),'utf8')).replace('  CM.NetMap = NetMap;','  CM.testMapAPI = API; CM.testMapMode = v => geographic = v; CM.NetMap = NetMap;'),c);
C.useMap('tutorial');const g=C.Game.create({mode:'free',tutorial:true,seed:20000101});
const n=M.empty(),lid=M.newLine(n),other=M.newLine(n),ids=[];
for(let i=0;i<5;i++)ids.push(M.addStation(n,10+4*i,10,{size:['S','M','L','XL','S'][i],type:'underground'},g.city));
for(let i=1;i<4;i++)M.addSegment(n,lid,ids[i-1],ids[i],[],'underground');
M.addSegment(n,other,ids[1],ids[4],[],'underground');
g.net=n;g.compiled=M.compile(n,g.city);
const messages=[],ui=Object.assign(new C.UI(),{g:()=>g,toast:(...x)=>messages.push(x)});
const before=JSON.stringify(n),funds=g.econ.funds;
const button=ui.lineUpgradeButton(lid);assert.equal(button.props.disabled,null);button.props.onclick();
assert.equal(JSON.stringify(n),before,'Only draft stations may change');assert.equal(g.econ.funds,funds);
assert.equal(g.draft.undo.length,1,'One undo step for the whole line');
assert.deepEqual(ids.map(id=>g.draft.net.stations[id].size),['M','L','L','XL','S']);
assert.ok(g.draftEval().total>0);assert.ok(messages[0][0].includes('2 座'));
g.undo();assert.equal(JSON.stringify(g.draft.net),before);g.redo();
assert.equal(ui.lineUpgradeButton(lid).props.disabled,null);ui.lineUpgradeButton(lid).props.onclick();
assert.deepEqual(ids.map(id=>g.draft.net.stations[id].size),['L','L','L','XL','S']);
assert.equal(ui.lineUpgradeButton(lid).props.disabled,true);
const undo=g.draft.undo.length;ui.lineUpgradeButton(lid).props.onclick();assert.equal(g.draft.undo.length,undo);
// Unlock XL using only this synthetic map's stage rule.
const data=C.DATA,oldStages=data.stages,oldFictional=data.fictional;
data.fictional=false;data.stages=[[2000]];g.clock.y=2000;
ui.lineUpgradeButton(lid).props.onclick();assert.deepEqual(ids.map(id=>g.draft.net.stations[id].size),['XL','XL','XL','XL','S']);
data.stages=oldStages;data.fictional=oldFictional;
assert.equal(JSON.stringify(n),before);g.cancelDraft();
console.log('PASS line-wide single-tier upgrades, draft/undo/costs, shared stations, year locks, max/empty states');

for(const geographic of [false,true]) {
  C.testMapMode(geographic);
  const gaps=[];
  for(const independent of [false,true]) for(const reverse of [false,true]) {
    const net=M.empty(),l1=M.newLine(net),l2=M.newLine(net);
    const a=M.addStation(net,10,10,{size:'M',type:'underground'},g.city), b=M.addStation(net,20,10,{size:'M',type:'underground'},g.city), mid=M.addStation(net,16,16,{size:'M',type:'underground'},g.city);
    for(const lid of [l1,l2]) for(const [from,to] of [[a,mid],[mid,b]]) {
      const id=M.addSegment(net,lid,reverse&&lid===l2?to:from,reverse&&lid===l2?from:to,[],'underground').id;
      if(independent&&lid===l2)net.segments[id].trackGroup=id;
    }
    const snapshot=JSON.stringify(net),R=M.withSegIndex([net],()=>C.testMapAPI.computeRoutes(g,net,[],1));
    const at=(track,sid)=>track.seg.a===sid?track.screen[0]:track.screen.at(-1);
    const tracks=R.tracks,first=tracks.filter(t=>t.seg.line===l1),second=tracks.filter(t=>t.seg.line===l2);
    const distance=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
    const gap=distance(at(first[0],a),at(second[0],a));assert.ok(gap>8,'All parallel colors need distinct lanes');gaps.push(gap);
    for(const line of [first,second])assert.ok(distance(at(line[0],mid),at(line[1],mid))<1e-5,'Lanes must connect through the turn');
    assert.equal(JSON.stringify(net),snapshot);assert.ok(R.stationAnchors.get(mid).length>=2);
  }
  assert.ok(gaps[2]>gaps[0]+3 && gaps[3]>gaps[1]+3,'Independent rails need wider separation');
  assert.ok(Math.abs(gaps[0]-gaps[1])<1e-5 && Math.abs(gaps[2]-gaps[3])<1e-5);
}
console.log('PASS geographic/schematic parallel lanes, wider independent rails, reverse storage, turning continuity and no net mutation');
// A single straight corridor can change from shared rails to independent rails.
for(const geographic of [false,true]) {
  C.testMapMode(geographic);
  const net=M.empty(),l1=M.newLine(net),l2=M.newLine(net),ids=[10,16,22].map(x=>M.addStation(net,x,10,{size:'M',type:'underground'},g.city));
  for(const lid of [l1,l2])for(let i=1;i<ids.length;i++){
    const id=M.addSegment(net,lid,ids[i-1],ids[i],[],'underground').id;
    if(lid===l2&&i===2)net.segments[id].trackGroup=id;
  }
  const R=M.withSegIndex([net],()=>C.testMapAPI.computeRoutes(g,net,[],1)),paths=R.tracks.map(t=>t.screen);
  const gap=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1]);
  assert.ok(gap(paths[1].at(-1),paths[3].at(-1))>gap(paths[0][0],paths[2][0])+3,'Mixed corridor must widen specifically in its independent section');
}
const empty=M.newLine(g.net);assert.equal(ui.lineUpgradeButton(empty).props.disabled,true);
console.log('PASS mixed shared/independent sections in one corridor and empty-line button');
// Shared rails can have different sampled platform tangents where the two lines diverge.
for(const geographic of [false,true]) {
  C.testMapMode(geographic);
  const net=M.empty(),l1=M.newLine(net),l2=M.newLine(net);
  const station=(x,y)=>M.addStation(net,x,y,{size:'M',type:'elevated'},g.city);
  const a=station(10,10),b=station(20,10),east=station(28,10),south=station(20,18);
  const one=M.addSegment(net,l1,a,b,[],'elevated').id,two=M.addSegment(net,l2,b,a,[],'elevated').id;
  M.addSegment(net,l1,b,east,[],'elevated');M.addSegment(net,l2,b,south,[],'elevated');
  for(const s of Object.values(net.segments))s.curve='smooth';
  assert.equal(M.trackKey(net.segments[one]),M.trackKey(net.segments[two]));
  assert.notEqual(JSON.stringify(M.segGeom(net,net.segments[one],g.city).pts),JSON.stringify(M.segGeom(net,net.segments[two],g.city).pts.slice().reverse()));
  const snapshot=JSON.stringify(net),R=M.withSegIndex([net],()=>C.testMapAPI.computeRoutes(g,net,[],1));
  const tracks=[one,two].map(id=>R.tracks.find(t=>t.seg.id===id));
  const at=(t,sid)=>t.seg.a===sid?t.screen[0]:t.screen.at(-1);
  for(const sid of [a,b]){
    const p=at(tracks[0],sid),q=at(tracks[1],sid);
    assert.ok(Math.hypot(p[0]-q[0],p[1]-q[1])>8,'Shared rails with divergent endpoint tangents must still have parallel diagram lanes');
  }
  assert.equal(JSON.stringify(net),snapshot);
}
console.log('PASS shared rails at divergent line endpoints despite unequal sampled geometry');
