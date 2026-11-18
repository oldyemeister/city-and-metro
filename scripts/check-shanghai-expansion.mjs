// Check the expanded map using the same monthly traffic and save import APIs as the game.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const ctx = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout,
  navigator: { hardwareConcurrency: 4 }, matchMedia: () => ({ matches: false }) };
ctx.window = ctx;
vm.createContext(ctx);
for (const [, file] of (await readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
  vm.runInContext(await readFile(new URL(file, root), 'utf8'), ctx, { filename: file });
  if (file === 'js/save.js') break;
}
const C = ctx.CM;
// Exercise the browser lazy-load path with a cached pre-expansion Shanghai file.
const map = C.MAPS.sh, full = map.geo;
const stub = { file: 'js/geo_sh.js', asset: 'js/geo_sh.js?v=test', proj: full.proj };
let loaded = { ...full, proj: { ...full.proj, lon0: 121.31 } };
map.geo = stub;
ctx.document = {
  createElement: () => ({ remove() {} }),
  head: { appendChild(script) {
    assert.equal(script.src, stub.asset);
    queueMicrotask(() => { C.GEOS.sh = loaded; script.onload(); });
  } },
};
await assert.rejects(C.loadGeo('sh'), /坐标不一致/);
assert.equal(C.geoReady('sh'), false);
loaded = full;
await C.loadGeo('sh');
assert.equal(stub.roads, full.roads);
delete ctx.document;
C.GEOS.sh = map.geo = full;
C.useMap('sh');
assert.ok(C.GEOS.sh.roads.every(row => [2, 3, 4].includes(row[1])), 'supported renderer road classes');
assert.deepEqual([C.CFG.W, C.CFG.H], [192, 180]);
const fixture = await readFile(new URL('savedgames/test/Shanghai-2010-01-278.cmsave.json', root), 'utf8');
const original = JSON.parse(JSON.parse(fixture).body);
const migrated = C.Save.parseEnvelope(fixture).payload;
assert.equal(migrated.meta.mapVersion, 4);
for (const [id, st] of Object.entries(original.net.stations)) {
  const dest = migrated.net.stations[id];
  assert.deepEqual([dest.x, dest.y], [st.x + 40, st.y]);
}
for (const [id, seg] of Object.entries(original.net.segments)) {
  if (seg.pts) assert.deepEqual(Array.from(migrated.net.segments[id].pts, p => Array.from(p)),
    seg.pts.map(([x, y]) => [x + 40, y]));
}
// A signed PPP, open tenders, and archived projects use the same geometry for
// map labels and contract evaluation. Recreate a v3 save from before the fix.
const broken = JSON.parse(JSON.stringify(migrated));
broken.corp = structuredClone(original.corp);
for (const group of ['tenders', 'contracts', 'closed']) {
  for (const [i, before] of original.corp[group].entries()) {
    if (!before.area) continue;
    const after = migrated.corp[group][i];
    assert.equal(after.area.x, before.area.x + 40);
    assert.equal(after.zone, Math.floor(after.area.y / 4) * 48 + Math.floor(after.area.x / 4));
    for (const [j, a] of before.anchors.entries()) assert.equal(after.anchors[j].x, a.x + 40);
  }
}
for (const [i, t] of original.tasks.active.entries()) broken.tasks.active[i].parts = structuredClone(t.parts);
function reimport(payload) {
  const body = JSON.stringify({ ...payload, meta: { ...payload.meta, mapVersion: 3 } }), env = JSON.parse(fixture);
  return C.Save.parseEnvelope(JSON.stringify({ ...env, body, checksum: C.U.fnv(body) })).payload;
}
const repaired = reimport(broken);
for (const group of ['tenders', 'contracts', 'closed']) assert.equal(JSON.stringify(repaired.corp[group]), JSON.stringify(migrated.corp[group]));
for (const t of repaired.tasks.active) for (const part of t.parts || []) if (part.at) {
  const a = t.anchors.find(a => a.name === part.at);
  assert.deepEqual([part.x, part.y], [a.x, a.y], t.title);
}
assert.equal(JSON.stringify(reimport(repaired)), JSON.stringify(repaired), 'repeat load preserves corrected records');
// The Shanghai optional challenge and the Pudong bypass use named points from
// the active map. A previously upgraded save can contain old and new offers together.
const bypass = C.Tasks.withPlan({ mapId: 'sh' }, C.DATA.histTasks.find(t => t.id === 'sh9'));
const avoid = bypass.parts[0].avoid;
const scenario = C.DATA.scenarios.find(s => s.id === 'sh-sc1');
const offer = { scenario: scenario.id, anchors: scenario.anchors.map(([name, r]) => ({ ...C.Tasks.placeOf(name), r })) };
const mixed = JSON.parse(JSON.stringify(repaired));
mixed.tasks.offers = [structuredClone(offer), structuredClone(offer)];
for (const a of mixed.tasks.offers[0].anchors) a.x -= 40;
mixed.tasks.active.push(JSON.parse(JSON.stringify(bypass)));
mixed.tasks.active.at(-1).parts[0].avoid.x -= 40;
const checked = reimport(mixed);
assert.equal(JSON.stringify(checked.tasks.offers[0]), JSON.stringify(offer));
assert.equal(JSON.stringify(checked.tasks.offers[1]), JSON.stringify(offer));
assert.equal(checked.tasks.active.at(-1).parts[0].avoid.x, avoid.x);
// Independently compare player-built station locations with the geodata station layer.
for (const name of ['徐家汇', '陆家嘴', '世纪大道']) {
  const station = Object.values(migrated.net.stations).find(s => s.name === name);
  const place = C.GEO.places.find(p => p[0] === name && p[3] === 0);
  assert.ok(Math.hypot(station.x - place[1], station.y - place[2]) < 2, name);
}
const mask = C.U.unpackTyped(migrated.city.fillNew);
for (let y = 0; y < 180; y++) for (let x = 0; x < 192; x++)
  assert.equal(mask[y * 192 + x], x < 40 || y >= 152 ? 1 : 0);
assert.deepEqual({ ...migrated.firedEvents }, original.firedEvents);
assert.equal(migrated.econ.funds, original.econ.funds);
const city = new C.City();
city.generate(19900101, 2025);
const model = new C.Model(city, { deferDemand: true });
const sites = C.Fac.list(city);
const find = id => sites.find(f => f.id === id);
// All new destinations, including both museum sites, should render at the surveyed point.
for (const id of ['sh_waigaoqiao', 'sh_sspu_caolu', 'sh_circus', 'sh_natural_history_old',
  'sh_natural_history_new', 'sh_circuit', 'sh_necc', 'sh_sjtu_minhang']) {
  const f = find(id), site = C.DATA.facilities.find(s => s.id === id);
  assert.deepEqual([f.x, f.y], Array.from(site.at), id);
}
for (const [id, name, radius] of [['sh_natural_history_new', '自然博物馆', 1],
  ['sh_circuit', '上海赛车场', 2], ['sh_necc', '国家会展中心', 1]]) {
  const f = find(id);
  assert.ok(C.GEO.places.some(p => p[0] === name && Math.hypot(p[1] - f.x, p[2] - f.y) < radius), id);
}
const race = find('sh_circuit'), necc = find('sh_necc'), campus = find('sh_sjtu_minhang');
for (const f of [race, necc, campus]) {
  const cell = city.cellAt(f.x, f.y);
  assert.ok(cell >= 0 && city.landMax[cell] >= 0.5 && (f.x < 40 || f.y >= 152), f.name);
  assert.ok(C.Fac.siteCells(f, city).length);
}
assert.ok(C.Fac.active(campus, 1990, city));
assert.equal(C.Fac.active(necc, 2014 + 8 / 12, city), false);
assert.ok(C.Fac.active(necc, 2014 + 9 / 12, city));
for (let y = 2004; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
  const raceMonth = y === 2004 ? 9 : y <= 2008 ? 10 : y <= 2019 || y === 2024 ? 4 :
    y === 2025 || y === 2026 ? 3 : 0;
  const date = y + (m - 1) / 12;
  const share = C.Fac.share(race, date) / C.CFG.trips.facBoost;
  assert.ok(Math.abs(share - (m === raceMonth ? 0.012 : 0.0008)) < 1e-10, y + '/' + m);
  if (raceMonth && (m === raceMonth || m === raceMonth + 1)) {
    const stable = { model: { trafficReady: () => true }, ym: () => C.U.ymIndex(y, m) };
    assert.ok(C.Game.prototype.trafficDue.call(stable, date, false));
  }
}
// Hold the city fixed; only move the model date through the 2025 Grand Prix.
const visits = [];
for (const month of [2, 3, 4]) {
  model.setYear(2025 + (month - 1) / 12);
  model.buildZones();
  model.buildDemand();
  const destination = model.Z + model.fn.ids.indexOf(race.id);
  visits.push(model.od.dest.reduce((total, d, i) => total + (d === destination ? model.od.t[4][i] : 0), 0));
}
assert.ok(visits[0] > 0 && visits[1] > 5 * visits[0] && visits[1] > 5 * visits[2]);
console.log('PASS Shanghai extent, migrated stations/segments and fill mask, three sites, F1 calendar and local leisure trips', visits);

// Cover years with March 1 on every weekday, including a Sunday that belongs
// to February's final weekend. Replay the same day-boundary decision as fast-forward.
for (let y = 2027; y <= 2054; y++) {
  let secondSaturday = 8;
  while (new Date(Date.UTC(y, 2, secondSaturday)).getUTCDay() !== 6) secondSaturday++;
  let trafficYear = y + 1 / 12;
  for (let day = 1; day <= 31; day++) {
    const t = y + 2 / 12 + (day - 1) / 365;
    const on = day === secondSaturday || day === secondSaturday + 1;
    const weight = C.Fac.share(race, t) / C.CFG.trips.facBoost;
    assert.ok(Math.abs(weight - (on ? 0.045 : 0.0008)) < 1e-10, [y, day]);
    const boundary = day === secondSaturday || day === secondSaturday + 2;
    if (day > 1) {
      const refresh = C.Game.prototype.advanceDay.call({ endDay: () => false, year: () => t,
        model: { year: trafficYear }, refreshFacilityDay: () => true });
      assert.equal(!!refresh, boundary);
    }
    if (boundary) trafficYear = t;
  }
}
console.log('PASS second March weekend and Monday reset, 2027–2054');
// Take the real day-end path across the simulated 2027 race, including both demand rebuilds.
const game = new C.Game();
Object.assign(game, { city, model, clock: { y: 2027, m: 3, d: 12 }, net: C.Metro.empty(),
  econ: { cross: {}, day() {} } });
game.compiled = C.Metro.compile(game.net, city);
model.setYear(game.year());
model.buildZones();
model.buildDemand();
model.setNetwork(game.compiled);
const dailyVisits = [];
for (const day of [13, 14, 15]) {
  const refresh = game.advanceDay();
  assert.equal(game.clock.d, day);
  assert.equal(!!refresh, day !== 14);
  if (refresh) for (const step of refresh) assert.notEqual(step, C.SIM_WAIT);
  const destination = model.Z + model.fn.ids.indexOf(race.id);
  dailyVisits.push(model.od.dest.reduce((total, d, i) => total + (d === destination ? model.od.t[4][i] : 0), 0));
}
assert.equal(dailyVisits[0], dailyVisits[1]);
assert.ok(dailyVisits[1] > 5 * dailyVisits[2]);
console.log('PASS 2027 race Saturday, Sunday and following Monday, local leisure trips', dailyVisits);
