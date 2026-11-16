// Track-mode regressions: generated fixtures and memory storage only.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),memory=new Map();
const c={console,performance,atob,btoa,TextEncoder,TextDecoder,setTimeout,clearTimeout,navigator:{hardwareConcurrency:4,deviceMemory:4},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)}};
c.window=c;vm.createContext(c);
const load=async src=>vm.runInContext(await readFile(new URL(src,root),'utf8'),c,{filename:src});
for(const[,src]of(await readFile(new URL('index.html',root),'utf8')).matchAll(/<script src="([^"]+)"/g)){await load(src);if(src==='js/save.js')break;}
const C=c.CM,M=C.Metro,copy=x=>JSON.parse(JSON.stringify(x));
C.UI=function(){};for(const src of ['settings','corp','fleet','screens'])await load('js/'+src+'.js');
C.useMap('tutorial');
const game=C.Game.create({mode:'free',tutorial:true,seed:20000101});
const net=M.empty(), first=M.newLine(net), second=M.newLine(net);
const a=M.addStation(net,10,10,{size:'M',type:'underground'},game.city);
const b=M.addStation(net,18,10,{size:'M',type:'underground'},game.city);
const one=M.addSegment(net,first,a,b,[],'underground').id;
const two=M.addSegment(net,second,a,b,[],'underground').id;
assert.equal(M.trackKey(net.segments[one]),M.trackKey(net.segments[two]));
const existing=M.clone(net); delete existing.segments[two];
const sharedCost=M.evaluate(net,existing,game.city,2000).total;
net.segments[two].trackGroup=two;
assert.ok(M.evaluate(net,existing,game.city,2000).total > sharedCost, 'Independent rails must incur construction cost');
assert.notEqual(M.trackKey(net.segments[one]),M.trackKey(net.segments[two]));
assert.equal(M.coTrackSegs(net,net.segments[one]).length,0);
const compiled=M.compile(net,game.city);
assert.notEqual(compiled.segs.get(one).shift,compiled.segs.get(two).shift);
assert.equal(compiled.segs.get(two).independentTrack,true);
assert.equal(compiled.segs.get(two).coLines,undefined);
assert.equal(M.clone(net).segments[two].trackGroup,two);
const split=M.splitSegment(net,two,14,10,{size:'M',type:'underground'},game.city);
assert.ok(split.station);
assert.ok(net.segments[one]);
assert.equal(Object.values(net.segments).filter(s=>s.trackGroup===two).length,2);
console.log('PASS independent track identity, parallel rendering, clone and station splitting');

// Reverse direction, bends and construction types retain upstream geometry rules.
const reversed = {...existing.segments[one], a:b, b:a, pts:[]};
assert.equal(M.trackKey(existing.segments[one]), M.trackKey(reversed));
assert.notEqual(M.trackKey(reversed), M.trackKey({...reversed, type:'elevated'}));
assert.notEqual(M.trackKey(reversed), M.trackKey({...reversed, pts:[[14,11]]}));
M.removeStation(net, split.station);
assert.equal(Object.values(net.segments).find(s=>s.line===second).trackGroup,two);
assert.equal(M.coTrackSegs(net,net.segments[one]).length,0);

// Sharing an explicitly independent track must reuse its identity, including on split.
const mixed=M.clone(existing), third=M.newLine(mixed), fourth=M.newLine(mixed);
const independent=M.addSegment(mixed,third,a,b,[],'underground').id;
mixed.segments[independent].trackGroup=independent;
const beforeShare=M.clone(mixed);
assert.equal(M.runAlong(mixed,fourth,b,third,a).added,1);
const shared=M.lineSegs(mixed,fourth)[0];
assert.equal(shared.trackGroup,independent);
assert.equal(M.coTrackSegs(mixed,shared).length,1);
assert.equal(M.coTrackSegs(mixed,mixed.segments[one]).length,0);
const bill=M.evaluate(mixed,beforeShare,game.city,2000);
assert.ok(bill.changes.add.some(s=>s.includes('共线运营')));
assert.equal(bill.items.filter(x=>x.ref===shared.id && x.kind==='construction').length,0);
const mixCompiled=M.compile(mixed,game.city);
assert.equal(mixCompiled.segs.get(one).coLines,undefined);
assert.equal(mixCompiled.segs.get(shared.id).coLines.length,2);
assert.equal(mixCompiled.routes.length,3);
assert.ok(mixCompiled.routes.every(r=>r.cap===mixCompiled.routes[0].cap),'No rolling stock capacity bonus');
const mid=M.splitSegment(mixed,independent,14,10,{size:'M',type:'underground'},game.city).station;
assert.equal(M.stationLines(mixed,mid).length,2);
assert.ok(mixed.segments[one]);
assert.equal(Object.values(mixed.segments).filter(s=>s.trackGroup===independent).length,4);

// Exercise the actual drawing handler and preview; no DOM or user saves are used.
await load('js/tools.js');
const ui={toast:()=>{},renderToolOpts:()=>{}};
function draw(mode, base=existing, from=a, to=b, bends=[]) {
  const work=M.clone(base), g={city:game.city, net:work, clock:game.clock,
    edit:fn=>fn(work)};
  C.game=g;
  const t=Object.create(C.Tools.prototype);
  Object.assign(t,{ui,R:{addFx:()=>{}},trackMode:mode,chain:from,bends,
    lineChoice:'new',buildType:'underground',stationSize:'M',curveMode:'pass',
    stationOpts:()=>({size:'M',type:'underground'}),syncDraft:()=>{}});
  const preview=t.coHostFor(to);
  const beforePreview=JSON.stringify(work);
  const geometry=t.previewGeom([work.stations[to].x,work.stations[to].y],to).geo;
  assert.equal(JSON.stringify(work),beforePreview,'Preview must not mutate the draft');
  t.lineClick({x:work.stations[to].x,y:work.stations[to].y},to,null,false);
  const result=work.segments[t.lastSeg];
  assert.ok(result,'Drawing must create a segment');
  return {work,result,preview,geometry};
}
const auto=draw('shared'), own=draw('independent');
assert.ok(auto.preview);
assert.equal(own.preview,null);
assert.equal(M.coTrackSegs(auto.work,auto.result).length,1);
assert.equal(own.result.trackGroup,own.result.id);
assert.equal(M.coTrackSegs(own.work,own.result).length,0);
const autoBill=M.evaluate(auto.work,existing,game.city,2000);
const ownBill=M.evaluate(own.work,existing,game.city,2000);
assert.ok(ownBill.total>autoBill.total);
const ownConstruction=ownBill.items.filter(x=>x.ref===own.result.id && x.kind==='construction');
assert.ok(ownConstruction.length>0,'Separate track construction is billed');
const reverseAuto=draw('shared',own.work,b,a);
// coHost deterministically chooses the oldest host, as in upstream.
assert.equal(reverseAuto.result.trackGroup,undefined);
const onlyOwn=M.clone(own.work); delete onlyOwn.segments[one];
const alongOwn=draw('shared',onlyOwn,b,a);
assert.equal(alongOwn.result.trackGroup,own.result.trackGroup);
assert.equal(M.coTrackSegs(alongOwn.work,alongOwn.result).length,1);
console.log('PASS actual drawing/preview, reverse sharing, mixed groups, charges and unchanged train capacity');

// Save envelopes and full restoration preserve optional identity; legacy saves stay untagged.
for (const fixture of [existing,own.work]) {
  game.net=M.clone(fixture); game.compiled=M.compile(game.net,game.city);
  const text=JSON.stringify(C.Save.envelope(game));
  const parsed=C.Save.parseEnvelope(text);
  assert.equal(parsed.payload.rulesRevision,C.CFG.RULES_REVISION);
  const restored=C.Game.restore(parsed.payload);
  assert.equal(JSON.stringify(restored.net.segments),JSON.stringify(game.net.segments));
  for(const id in fixture.segments) assert.equal(M.trackKey(restored.net.segments[id]),M.trackKey(fixture.segments[id]));
}
console.log('PASS legacy/new envelope checksum, rules compatibility and full Game.restore round trips');

// Same endpoints on separate tracks inherit both platform axes from the first-built route.
const angled=M.clone(existing);
const approach=M.addStation(angled,7,5,{size:'M',type:'underground'},game.city);
M.addSegment(angled,first,approach,a,[],'underground'); // automatic axis differs from a--b
M.setPlatformDir(angled,b,first,0.6);
const later=M.newLine(angled);
M.addSegment(angled,later,b,a,[[14,13]],'elevated');
M.setPlatformDir(angled,a,later,1.2);
M.setPlatformDir(angled,b,later,1.3);
// Reinsert the oldest segment last: selection must use IDs, not object iteration order.
const oldest=angled.segments[one]; delete angled.segments[one]; angled.segments[one]=oldest;
for(const [from,to,bends] of [[a,b,[]],[b,a,[[14,12]]]]) {
  const original=JSON.stringify(angled);
  const built=draw('independent',angled,from,to,bends);
  for(const sid of [a,b]) {
    const expected=M.platformDir(angled,sid,first);
    const actual=M.platformDir(built.work,sid,built.result.line);
    assert.ok(Math.abs(expected-actual)<0.0001,'Independent platforms must follow the oldest host');
    assert.equal(M.platformDir(built.work,sid,first),expected,'Existing platform must stay unchanged');
  }
  const final=M.segGeom(built.work,built.result,game.city);
  assert.equal(JSON.stringify(built.geometry.pts),JSON.stringify(final.pts),'Preview must match built geometry');
  assert.equal(JSON.stringify(angled),original,'Preview and drawing must not mutate the source fixture');
}
console.log('PASS independent platform alignment at both endpoints, oldest host, reverse/bent routes and preview parity');

// Display paths separate all lanes without changing simulation geometry.
const display=M.compile(own.work,game.city), paths=[];
for(const cs of display.segs.values()) {
  const before=JSON.stringify(cs.g.pts), offset=M.trackDisplayOffset(cs,3);
  paths.push(M.offsetTrackPath(cs.g.pts,offset));
  assert.equal(JSON.stringify(cs.g.pts),before);
}
assert.ok(Math.abs(paths[0][0][1]-paths[1][0][1])>=7,'Preview lanes need visible separation');
const forward=own.work.segments[own.result.id], backward={...forward,a:b,b:a};
C.game={compiled:display};
const tool=Object.assign(Object.create(C.Tools.prototype),{trackMode:'independent'}), renderer={lineWidthPx:()=>3};
const off=tool.previewTrackOffset({seg:forward},renderer);
assert.ok(off>3.5+3,'Hover preview must clear the outside existing lane');
assert.equal(tool.previewTrackOffset({seg:backward},renderer),-off,'Reverse drawing must stay on the same physical side');
assert.equal(tool.previewTrackOffset({seg:{...forward,b:'__end'}},renderer),0);
tool.trackMode='shared';assert.equal(tool.previewTrackOffset({seg:forward},renderer),0);
console.log('PASS parallel display paths, unmodified geometry, outside hover lane and reverse direction');

// Turning corridors must keep lane order even when the middle station has the largest ID.
await load('js/render.js');
for (const reverse of [0,1,2,3]) for (const dy of [-6,6]) {
  const turn=M.empty(), l1=M.newLine(turn), l2=M.newLine(turn);
  const left=M.addStation(turn,10,10,{size:'M',type:'underground'},game.city);
  const right=M.addStation(turn,22,10+dy,{size:'M',type:'underground'},game.city);
  const corner=M.addStation(turn,16,10,{size:'M',type:'underground'},game.city);
  const pairs=[[left,corner],[corner,right]], refs=[];
  for(const lid of [l1,l2]) for(const pair of pairs) {
    const [from,to]=(reverse & (lid===l1 ? 1 : 2)) ? pair.slice().reverse() : pair;
    const id=M.addSegment(turn,lid,from,to,[],'underground').id;
    if(lid===l2) turn.segments[id].trackGroup=id;
    refs.push(id);
  }
  function checkTurn(n) {
    const compiled=M.compile(n,game.city);
    C.game={compiled};
    tool.trackMode='independent';
    for(const id of refs.slice(2)) {
      const cs=compiled.segs.get(id), off=tool.previewTrackOffset({seg:cs.seg},renderer);
      assert.ok(off*cs.shift>0 && Math.abs(off)>Math.abs(M.trackDisplayOffset(cs,3))+3,
        'Hover preview must stay outside the last lane through a turn');
      assert.equal(tool.previewTrackOffset({seg:{...cs.seg,a:cs.seg.b,b:cs.seg.a}},renderer),-off);
    }
    const ends=refs.map((id,i)=>{
      const cs=compiled.segs.get(id), path=M.offsetTrackPath(cs.g.pts,M.trackDisplayOffset(cs,3));
      return cs.seg.a===corner ? path[0] : path[path.length-1];
    });
    for(const k of [0,2]) assert.ok(Math.hypot(ends[k][0]-ends[k+1][0],ends[k][1]-ends[k+1][1])<1e-6,
      'Parallel lanes must meet on the same side of a turning platform');
    for(const sid of [left,corner,right]) {
      const platforms=C.Renderer.platformsOf(n,n.stations[sid],[l2,l1]); // caller order cannot change placement
      const near=refs.slice(0,2).map(id=>compiled.segs.get(id)).find(cs=>cs.seg.a===sid||cs.seg.b===sid);
      for(const p of platforms) {
        const cs=Array.from(compiled.segs.values()).find(cs=>cs.seg.line===p.lid && M.trackGeometryKey(cs.seg)===M.trackGeometryKey(near.seg));
        const path=M.offsetTrackPath(cs.g.pts,M.trackDisplayOffset(cs,3)), end=cs.seg.a===sid ? path[0] : path[path.length-1];
        const st=n.stations[sid], px=-Math.sin(p.a)*p.off, py=Math.cos(p.a)*p.off;
        assert.ok(px*(end[0]-st.x)+py*(end[1]-st.y)>0,'Platform and track must occupy the same side');
      }
    }
  }
  checkTurn(turn);
  checkTurn(M.clone(turn));
  game.net=turn; game.compiled=M.compile(turn,game.city);
  checkTurn(C.Game.restore(C.Save.parseEnvelope(JSON.stringify(C.Save.envelope(game))).payload).net);
}
console.log('PASS turning lane continuity, signed platform order, reversed segments and save restoration');
