// Run from the repository root with the 2026-11-17 Shanghai Geofabrik PBF as the argument.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const pbfPath = process.argv[2];
assert.ok(pbfPath, 'Pass the path to the Shanghai PBF');
const hash = data => createHash('sha256').update(data).digest('hex');
const context = vm.createContext({window: {CM: {}}});
for (const file of ['js/geo.js', 'js/geo_sh.js']) {
  vm.runInContext(readFileSync(file, 'utf8'), context);
}
const { Geo, GEOS } = context.window.CM;
const { roads, names, proj } = GEOS.sh;
const examples = [
  // Zero-based rows in GEOS.sh.roads, followed by contemporary OSM way IDs.
  [1298, 'w191104453', 'original', 'secondary', 3],
  [37127, 'w1070951330', 'expansion', 'secondary', 2],
  [1162, 'w1391144442', 'original', 'secondary', 3],
  [32466, 'w186999879', 'expansion', 'secondary', 2],
  [33962, 'w341726208', 'expansion', 'primary', 3],
  [24383, 'w268316750', 'original', 'motorway', 4],
  [75, 'w142591549', 'original', 'trunk', 4]
];
const tmp = mkdtempSync(join(tmpdir(), 'sh-geo-tags-'));
let exported;
try {
  const subset = join(tmp, 'examples.osm.pbf');
  execFileSync('osmium', ['getid', '-r', '-o', subset, pbfPath, ...examples.map(row => row[1])]);
  exported = execFileSync('osmium', ['export', '--geometry-types', 'linestring', '-u', 'type_id', '-f', 'geojsonseq', subset], {encoding: 'utf8'});
} finally {
  rmSync(tmp, {recursive: true, force: true});
}
const features = new Map(exported.trim().split('\n').map(line => {
  const feature = JSON.parse(line.replace(/^\x1e/, ''));
  return [feature.id, feature];
}));
const report = {
  mapSha256: hash(readFileSync('js/geo_sh.js')),
  sourceSha256: hash(readFileSync(pbfPath)),
  source: 'Geofabrik Shanghai, replication timestamp 2026-11-17T21:24:30Z',
  classifiedRoadPolylines: roads.length,
  nonRampMajorAndExpressPolylines: roads.filter(r => r[1] >= 3 && !(r[2] & 4)).length,
  flaggedMajorAndExpressRampPolylines: roads.filter(r => r[1] >= 3 && (r[2] & 4)).length,
  lowerStreetPolylines: GEOS.sh.streets.split('!').length,
  examples: []
};
for (const [row, id, region, highway, gameClass] of examples) {
  const feature = features.get(id);
  assert.equal(feature.properties.highway, highway);
  const [nameId, cls, flags, path] = roads[row];
  assert.equal(cls, gameClass);
  assert.equal(names[nameId], feature.properties.name);
  assert.equal(flags & 4, 0);
  const coords = feature.geometry.coordinates;
  const raw = coords.map(([x, y]) => [
    Math.round((x - proj.lon0) * proj.kx * 64),
    Math.round((proj.lat0 - y) * proj.ky * 64)
  ]);
  const pts = Geo.dec(path);
  let rawIndex = -1, firstIndex;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i] * 64, y = pts[i + 1] * 64;
    const next = raw.findIndex(([rx, ry], j) => j > rawIndex && rx === x && ry === y);
    assert.ok(next >= 0, 'Every map vertex must occur in order on its named OSM way');
    if (i === 0) firstIndex = next;
    rawIndex = next;
  }
  assert.ok(pts.length >= 6);
  report.examples.push({
    row, region, name: names[nameId], gameClass: cls, osmWay: id,
    highway, mapVerticesMatchedInOrder: pts.length / 2, osmVertices: coords.length,
    firstMatchedLonLat: coords[firstIndex], lastMatchedLonLat: coords[rawIndex]
  });
}
console.log(JSON.stringify(report, null, 2));
