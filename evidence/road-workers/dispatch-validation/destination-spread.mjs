// node evidence/road-workers/dispatch-validation/destination-spread.mjs SHANGHAI_CAPTURE LONDON_CAPTURE > OUTPUT_JSON
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { deserialize } from 'node:v8';

const paths = process.argv.slice(2);
assert.equal(paths.length, 2, 'Expected the Shanghai and London V8 captures, in that order.');

// Within each origin's OD row measure the RMS distance of destination centers
// from that row's own destination centroid, independent of the origin location.
function summarize(path) {
  const bytes = readFileSync(path);
  const { G, run, pS, pD, dem, W, zoneSize, cellMeters } = deserialize(bytes);
  const width = W / zoneSize;
  const km = zoneSize * cellMeters / 1000;
  const massByDest = new Float64Array(G.Z);
  const radius = [], demandRadius = [], destCount = [];
  for (const origin of run) {
    let x = 0, y = 0, r2 = 0, weightedX = 0, weightedY = 0, weightedR2 = 0, mass = 0;
    const count = pS[origin + 1] - pS[origin];
    assert.ok(count > 0);
    for (let i = pS[origin]; i < pS[origin + 1]; i++) {
      const dest = pD[i], weight = dem[i];
      const dx = (dest % width) * km, dy = Math.floor(dest / width) * km;
      const norm2 = dx * dx + dy * dy;
      x += dx;
      y += dy;
      r2 += norm2;
      weightedX += weight * dx;
      weightedY += weight * dy;
      weightedR2 += weight * norm2;
      mass += weight;
      massByDest[dest] += weight;
    }
    assert.ok(mass > 0);
    radius.push(Math.sqrt(Math.max(0, r2 / count - (x / count) ** 2 - (y / count) ** 2)));
    demandRadius.push(Math.sqrt(Math.max(0, weightedR2 / mass - (weightedX / mass) ** 2 - (weightedY / mass) ** 2)));
    destCount.push(count);
  }
  function stats(values) {
    values.sort((a, b) => a - b);
    const percentile = p => values[Math.ceil(p * values.length) - 1];
    return { mean: values.reduce((a, b) => a + b, 0) / values.length, median: percentile(.5), p90: percentile(.9) };
  }
  const total = massByDest.reduce((a, b) => a + b, 0);
  const ordered = Array.from(massByDest).filter(v => v > 0).sort((a, b) => b - a);
  let sum = 0;
  const n50 = ordered.findIndex(v => (sum += v) >= total / 2) + 1;
  return {captureSHA256:createHash('sha256').update(bytes).digest('hex'),
    zones:G.Z, origins:run.length, roadNodes:G.nN, roadArcs:G.nA, destinationsPerOrigin:stats(destCount),
    requestedDestinationRadiusKm:stats(radius), carDemandWeightedDestinationRadiusKm:stats(demandRadius),
    allOriginsDistinctPositiveDemandDestinationZones:ordered.length, destinationZonesReceivingHalfOfAllCarDemand:n50};
}
console.log(JSON.stringify({window:'First weekday road assignment in the following monthly jump',
  metric:'Each origin has equal weight when summarizing its row. Radius is the root mean square distance from the destination centroid of that row; the car-demand version weights both centroid and squared distance by car demand.',
  shanghai2010:summarize(paths[0]), london1860:summarize(paths[1])}, null, 2));
