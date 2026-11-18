import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

// Runs during every source/dist verification, including checkouts without player exports.
export function verifyShanghaiGrid(C) {
  const map = C.MAPS.sh, grid = map.worldGrid, p = map.geo.proj;
  const w = grid.windowFor(p, map.cfg.W, map.cfg.H);
  const tower = map.data.landmarks.find(l => l.id === 'sh_pearl');
  assert.deepEqual(Array.from(grid.localPoint([0, 0], w)), [tower.x, tower.y]);
  const city = {};
  const cells = C.U.packTyped(new Uint8Array(w.width * w.height), 'u8');
  for (const key of ['pop','jobs','bh','taken','lu','street','urbanYear']) city[key] = cells;
  const a = { x: tower.x, y: tower.y }, zone = Math.floor(a.y / 4) * (w.width / 4) + Math.floor(a.x / 4);
  const sample = { meta: { mapVersion: 4 }, clock: { y: 2000, m: 1, d: 1 }, city,
    net: { stations: { s1: a }, segments: { g1: { pts: [[a.x, a.y]] } } },
    tasks: { active: [{ anchors: [a], zone }] }, corp: { contracts: [{ anchors: [a], area: a, zone }] } };
  const wire = grid.encode(sample, map);
  assert.deepEqual([wire.net.stations.s1.x, wire.net.stations.s1.y], [0, 0]);
  assert.equal(wire.corp.contracts[0].zone, '0,0');
  const larger = { ...map, cfg: { ...map.cfg, W: w.width + 40, H: w.height + 28 },
    geo: { proj: { ...p, lon0: p.lon0 - 40 / p.kx } } };
  const loaded = JSON.parse(JSON.stringify(wire));
  grid.decode(loaded, larger, 4);
  const savedAgain = grid.encode(loaded, larger);
  for (const key of ['net','tasks','corp']) assert.deepEqual(savedAgain[key], wire[key]);
}

async function checkFixture() {
  const root = new URL('../', import.meta.url);
  const ctx = { console, performance, atob, btoa, TextEncoder, TextDecoder, setTimeout, clearTimeout, navigator: {}, matchMedia: () => ({ matches: false }) };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const [, file] of (await fs.readFile(new URL('index.html', root), 'utf8')).matchAll(/<script src="([^"]+)"/g)) {
    vm.runInContext(await fs.readFile(new URL(file, root), 'utf8'), ctx, { filename: file });
    if (file === 'js/save.js') break;
  }
  const C = ctx.CM, map = C.MAPS.sh, grid = map.worldGrid, proj = map.geo.proj;
  const fixture = await fs.readFile(new URL('savedgames/test/Shanghai-2010-01-278.cmsave.json', root), 'utf8');
  const source = C.Save.parseEnvelope(fixture).payload;
  const snapshot = JSON.stringify(source);
  const envelope = C.Save.envelope({ serialize: () => source });
  const bytes = JSON.stringify(envelope), wire = JSON.parse(envelope.body);
  assert.equal(JSON.stringify(source), snapshot);
  assert.deepEqual(Array.from(grid.fromWGS(31.2415, 121.4968)), [0, 0]);
  assert.equal(wire.meta.worldGrid.datum, 'sh-pearl-250m-v1');
  assert.equal(wire.meta.mapVersion, 4);
  assert.ok(wire.net.stations.s1.x < 0);
  const tower = map.data.landmarks.find(l => l.id === 'sh_pearl');
  assert.deepEqual(Array.from(grid.localPoint([0, 0], wire.meta.worldGrid)), [tower.x, tower.y]);

  const scenarioScript = await fs.readFile(new URL('js/data_sh.js', root), 'utf8');
  function scenarioAt(projection, west, north) {
    const geo = { proj: projection, places: map.geo.places.map(([name,x,y,type]) => [name, x + west, y + north, type]) };
    const CM = { U: C.U, CFG: C.CFG, ShanghaiGrid: grid, GEOS: { sh: geo }, DATA: C.DATA };
    vm.runInNewContext(scenarioScript, { window: { CM } });
    return CM.MAP_LIST[0].data;
  }
  const baseline = scenarioAt(proj, 0, 0);
  for (const [west, north, east, south] of [[0,0,0,0],[40,0,0,28],[0,0,24,28],[12,8,4,4]]) {
    const next = { ...map, cfg: { ...map.cfg, W: 192 + west + east, H: 180 + north + south },
      geo: { ...map.geo, proj: { ...proj, lon0: proj.lon0 - west / proj.kx, lat0: proj.lat0 + north / proj.ky } } };
    const data = scenarioAt(next.geo.proj, west, north);
    for (const collection of ['landmarks','facilities']) for (const [i, src] of baseline[collection].entries()) {
      const item = data[collection][i];
      assert.equal(item.id, src.id);
      if (item.lm) { assert.equal(item.lm, src.lm); continue; }
      const [x, y] = item.at || [item.x, item.y], [x0, y0] = src.at || [src.x, src.y];
      assert.ok(Math.abs(x - x0 - west) < 1e-9 && Math.abs(y - y0 - north) < 1e-9, item.id);
    }
    C.MAPS.sh = next;
    const restored = C.Save.parseEnvelope(bytes).payload;
    const again = JSON.parse(C.Save.envelope({ serialize: () => restored }).body);
    for (const domain of ['net','netGone','tasks','corp','impactReport']) assert.deepEqual(again[domain], wire[domain], domain);
    const station = restored.net.stations.s1;
    assert.ok(Math.abs(station.x - source.net.stations.s1.x - west) < 1e-9);
    assert.ok(Math.abs(station.y - source.net.stations.s1.y - north) < 1e-9);
    const w = grid.windowFor(next.geo.proj, next.cfg.W, next.cfg.H);
    assert.deepEqual(Array.from(grid.localPoint([0, 0], w)), [tower.x + west, +(tower.y + north).toFixed(2)]);
    const original = C.U.unpackTyped(source.city.pop), actual = C.U.unpackTyped(restored.city.pop);
    for (let row = 0; row < 180; row++)
      assert.deepEqual(actual.subarray((row + north) * w.width + west, (row + north) * w.width + west + 192), original.subarray(row * 192, (row + 1) * 192));
    // An untouched v2 export loaded for the first time after expansion must reach the same world positions.
    const legacy = C.Save.parseEnvelope(fixture).payload;
    const legacyWorld = JSON.parse(C.Save.envelope({ serialize: () => legacy }).body);
    for (const domain of ['net','netGone','tasks','corp']) assert.deepEqual(legacyWorld[domain], wire[domain], 'legacy ' + domain);
  }
  C.MAPS.sh = map;
  console.log('PASS Shanghai fixed origin, negative positions, raster windows, 278 stations, tracks, tasks, PPP, replay, four extents and v2 direct import');
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await checkFixture();
