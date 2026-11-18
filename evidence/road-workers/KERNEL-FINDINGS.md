# Road computation investigation — 2026-11-17

Decision: retain the existing four-road/two-mode/two-metro allocation on this machine. No runtime source changes. User requires unchanged traffic and business results.

## Evidence and method

`analyze-kernel.mjs` loads the real city/save in an isolated Node VM and captures the first road allocation during a next-month jump. It extracts the production `carTree`, `carOriginRow` and `carWork` functions, then replays exactly the original 32 blocks, origin order and Float32 block/merge arithmetic. No browser or original save writes. Runtime source and input hashes, operations, phase timings and every benchmark pass are in `kernel-analysis.json`.

Available local fixture is **Shanghai 2000-07-14, 121 stations**, SHA-256 `e7f36e23da7e6b2201fbed4f4d77f1488be8db249f79450f973aab16095a7f38`. This is **different from the 2010/278-station Worker comparison**. No claim of directly comparable wall times or browser Worker performance. The capture stops at the first road allocation; it does not complete a month or measure final business outcomes.

Reproduce from repository root:

```sh
node evidence/road-workers/analyze-kernel.mjs 'savedgames/test/城市与地铁_经营挑战 · 上海 1990_2000年7月.cmsave.json' evidence/road-workers/kernel-analysis.json
```

## Findings

- Graph: 1,444 zones, 7,392 nodes, 20,634 arcs; 1,329 computed origins. The full sparse layout has 377,938 OD pairs (not a count of only the selected origins).
- 1,102,808 destination-access marking visits produce 981,224 unique targets across origins. Search settles 8,858,437 nodes, about **90.2% of all graph nodes per origin on average**, and scans 25,335,318 outgoing arcs. Sparse OD tables do not make this a spatially small search.
- Heap pops: 9,621,986; stale pops: 763,549 (~7.9%). Successful relaxations: 9,618,122. Exact heap instruction self-time is not measured.
- Reverse flow propagation scans all 8,858,437 settled-node entries, including nodes without positive accumulated demand. It is a secondary candidate after shortest-path search.
- The operation-count pass adds hot-loop overhead. Its phase durations must **not** be used to rank production time. Separate timer-only passes in `phasePasses` are the timing evidence; warm untimed-loop benchmark passes in `passes` compare the candidate.
- Three timer-only passes: total 723.3–733.0 ms; search 687.3–695.6 ms (~95%, including distance fill), target marking 3.6–4.0 ms, destination evaluation 6.1–6.6 ms, reverse propagation 25.1–25.6 ms (~3.5%). Distance fill nested inside search is 3.25–3.28 ms (<0.5% of total). These are Node microbenchmark timings, not independent Worker CPU profiles.

## Tested candidate: precomputed unique target lists

Only replace repeated per-destination marking with a cached unique node list for each origin. Preserve the original shortest-path heap, target stamps, destination evaluation, reverse traversal and arithmetic order. Preparation is outside the warm timed passes, which favors the candidate. Seven alternating warm passes per version; timer/count probes excluded.

All 14 pass signatures equal the baseline **byte for byte** for the complete Float32 time table, distance table and merged arc-flow array, including untouched NaN entries. This validates this one captured road allocation, not all dates or full monthly business output.

Final baseline/cached medians are **726.10/736.53 ms** (~1.4% slower for the candidate), with 47.22 ms initial cache preparation excluded. Cache payload is 3,924,896 bytes (~3.74 MiB), excluding object overhead. Each worker storing every origin would multiply this payload; the current prototype does not implement worker cache distribution or invalidation. **Do not adopt this cache: no demonstrated benefit, additional preparation and memory.**

## Next candidates, in priority order

1. **Exact sparse search termination.** Present code waits until every access node of every requested destination is settled. Investigate a lower-bound stop once no unsettled access can improve any destination's current best total time (road distance plus destination connector). Keep the current heap/tie rules and destination connector order. Equality boundaries, disconnected targets, Float64 additions, Float32 distance rounding and reverse-flow order need explicit proof and differential tests. This is an unimplemented hypothesis with the largest relevant measured work base, not a promised speedup. The broad destination footprint may still require most of the graph.
2. **Reuse immutable request data across a worker's blocks.** `CarPool.pump` currently clones the same arc-time array with every block. Sending it once per worker/request instead of once per block can reduce 32 copies to at most 4 for this allocation (about 2.64 MB to 0.33 MB at this graph size). This is payload accounting, not a measured transport-time saving. Keep a request ID and exact immutable Float32 snapshot; overlapping requests, graph changes, cancellation and fallback need correct ownership. Destination/start arrays may also be reusable only when graph, OD layout and selected origin set match. Measure before implementing broad caches.
3. **Fixed-block scheduling and flow propagation.** Measure Worker service time and block tail imbalance with the four workers. Dispatching original blocks in a different order can preserve results if block contents and final merge order stay fixed. Current offline `blockMs` measures sequential warm execution only; it is not a real Worker queue profile. Reducing reverse-flow scans is worth investigating only if the original positive additions and their order can be retained.

Low priority: removing `dist.fill` (small bulk operation), `queue.shift` (only 32 block dispatches per request), or forcing dense WASM. Existing dense WASM has a different work shape; a sparse WASM port preserving exact JS comparison/rounding/tie behavior would be a separate, larger experiment. No justification to change iterations, OD pruning, numeric types, BPR line search, block count, path ties or demand weights.

## Acceptance for any production patch

Keep four road workers and existing model parameters. Compare before/after clocks, traffic arrays, metrics and ledger with exact equality across quarter/year/natural month boundary and repeated runs; also cover graph/layout changes and Worker failure fallback. Kernel equality alone is necessary but insufficient for an end-to-end patch. No production patch or full-game acceptance in this investigation.

The preexisting `repeated-SjxJDO/summary.json` additionally contains 18 completed Worker-count cases (three rounds each of quarter/year/natural month boundary, two configurations), with no before/after or across-round snapshot differences. These were discovered during this review and were not rerun. They strengthen the decision to keep four workers; they do not validate a new kernel implementation.
