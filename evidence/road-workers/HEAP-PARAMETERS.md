# Road heap parameters measured — 2026-11-17

Branch `performance`,HEAD f9706d4. Four road Workers/configuration and production source unchanged. No new implementation or test script file; observer instrumentation was constructed and executed in memory through an inline Node diagnostic command. Supporting output is `heap-parameters.json`.

## Workload and verification

Replayed the cached real first monthly road allocation from local Shanghai2000-07-14/121station export:1,329origins,1,444zones,7,392nodes,20,634arcs. Capture `/tmp/metro-road-sample.bin` was created by the earlier `bench-early-stop.mjs`; report records its raw SHA256,source hash and original fixture hash. Verified current source and fixture hashes against prior report,workload metadata,and **exact full time/km/32individual block-flow/merged-flow hashes** against the prior unmodified baseline. Capture has no embedded provenance header; matching raw output/metadata is the validation,not an independently recaptured monthly run.

This is an offline replay of real graph/time/demand input. It is **not** a new live four-Worker run,whole-month/economy acceptance or timing benchmark. Previous Chrome hotspots were2010/278stations; do not assume this2000snapshot's heap peak applies to that larger network or all dates/maps. No browser/player-save actions.

## Sizes

| Parameter | Measured value |
| --- | ---: |
| Preallocated heap capacity,per workspace |20,638entries|
| Float64 time keys |165,104bytes|
| Int32 node IDs |82,552bytes|
| Total preallocated heap arrays |247,656bytes (~241.85KiB)|
| All carWork typed-array scratch |484,200bytes (~472.85KiB)|
| Largest occupied heap |257entries|
| Logical active-prefix payload at peak |3,084bytes (~3.01KiB)|
| Per-origin peak occupancy,median /p95 |167 /240entries|
| Mean occupancy sampled after push/before pop |102.47entries|

Only1.245%of the preallocated capacity was occupied at peak in this input. The two heap arrays operate on their occupied prefixes;3KiB is their combined logical entry payload,not the entire graph/distance-array working set or exact cache-line footprint. Four independent worker workspaces would allocate~0.945MiB of heap arrays total,not measured total browser RAM. Capacity is deliberately conservative; **do not shrink it to257based on one workload**.

## Operation counts and movement

| Parameter | Measured value |
| --- | ---: |
| Pushes /pops |9,621,986 /9,621,986|
| Initial connector pushes /relaxation pushes |3,864 /9,618,122|
| Settled nodes /stale pops |8,858,437 /763,549|
| Stale fraction of pops |7.935%|
| Arc scans and relaxation comparisons |25,335,318|
| Upward moves per push,mean /median /p95 /max |0.165 /0 /1 /4|
| Pushes with zero upward moves |85.852%|
| Downward moves per pop,mean /median /p95 /max |5.344 /5 /7 /7|
| Parent-key comparisons while inserting |11,201,476 (1.164perpush)|
| Child-pair comparisons while removing |52,904,194|
| Child-versus-last-key stop comparisons |53,152,766|
| Both removal comparison types per pop |11.022|
| Total heap key comparisons |117,258,436|
| Total upward /downward moves |1,584,633 /51,417,252|

These count actual source-level key comparisons,not all loop-bound/index comparisons or machine instructions. Instrumented passes preserve original branches,heap order,typed arrays,numeric operations and accumulation order; observer overhead makes their wall time unsuitable for speed claims.

Logical heap accesses:242,406,842key reads,72,244,212node-ID reads,72,244,212key writes and72,244,212node-ID writes. Width-weighted logical totals are~2.228GBreads and~0.867GBwrites accumulated over all origins. **These are repeated typed-array source accesses,not DRAM/bus traffic,bandwidth measurements or cache misses.** JIT may reuse loads; caches may serve repeated accesses. Do not interpret these totals as physical RAM transfer.

## Search termination check

All1,329origin searches exhausted the heap;none stopped with queued entries remaining. A separate observer-only pass recorded the residual target counter and counted marked nodes with `dist>=INF`:they match for every origin. All origins have at least one unreachable requested access node;minimum1,mean48.620,maximum624. This refers to **access nodes**,not necessarily wholly unreachable destination zones:another access to the same destination may be reachable.

This explains why the original all-access-target stop does not fire in this allocation. It does not prove a new stopping/filtering scheme will improve speed or preserve results; graph-component/reachability screening would require a separate measured proposal preserving multi-access origins,connector choices and all floating-point accumulation order.

## Interpretation

- Heap capacity/RAM exhaustion is not supported as the dominant explanation for this input:the occupied heap prefix is small.
- Removal/downheap is more promising to examine than insertion/upheap:removal moves32.45times as many levels in aggregate,and insertion usually stays in place. This agrees with the earlier Chrome sample attribution but does not measure isolated removal CPU time here.
- Serial child comparisons,branches and dependent accesses are plausible costs. Wider graph/arc/distance memory access may still matter. **CPU-bound versus cache/latency-bound remains unmeasured without hardware/JIT evidence.**
- Keep production algorithm and four Workers unchanged. No heap replacement,precision reduction,capacity shrink or unreachable-target filtering is implemented.

Checks: baseline source verify PASS; all counter/histogram/per-origin conservation assertions and both full-output comparisons PASS; final source unchanged,JSON assertions and whitespace PASS. No build for diagnostic/docs-only changes,no commit,push or PR.
