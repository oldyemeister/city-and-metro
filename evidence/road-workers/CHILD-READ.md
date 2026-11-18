# Cached heap-child key: old/new equality and performance — 2026-11-17

## Disposition

**Equality passed for all measured cases; no consistent gameplay speedup,so do not promote.** Branch `performance`,HEAD f9706d4;production `js/sim.js` unchanged,four road Workers retained. Candidate lives only in `child-read.mjs` and test-generated road Worker code. No early-stop,target-cache,heap-type,iteration,demand or precision changes.

## Exact change and equivalence

Old downheap reads `keys[right]` and `keys[left]` to select the child,then `keys[child]` to compare against the last key,and again when moving it. Candidate reads the left/right key into local numbers and reuses the selected value. Both use strict right<left,left on ties,child>=last stopping,the same index/node moves and the same final assignment. Ordinary unshared typed arrays cannot change between these reads. No different floating-point calculation is introduced;NaN comparison and signed-zero choice are equivalent by inspection. The normal solver never enqueues a NaN cost because insertion requires a strict finite-distance improvement. Explicit seeded-NaN/signed-zero heap fixtures were not added;existing random/tie/zero-edge/large-value tests and source review cover the implemented input path.

Independent final review found no correctness blocker. `scripts/check-road-child-read.mjs` initially failed missing module (RED),then **3,216rows PASS**,including all typed workspace bytes (`dist`,`dkm`,`pred`,`order`,`accN`,`heapK`,`heapV`,`mark`) and scalar stamp after each row,as well as time/km/flow buffers. Ties,single-child/small heaps,long-tail,zero edge,disconnected/shared/empty connectors,overflow and repeated workspaces retain exact old state.

## Real allocation comparison

Command: `node evidence/road-workers/bench-child-read.mjs`.

Read-only cached actual Shanghai2000-07-14/121station first monthly allocation,1,329origins,7,392nodes,20,634arcs. Raw capture hash and source/fixture hashes are in `child-read-kernel.json`. Same earlier capture with pinned unmodified outputs,not a newly captured live month. Both variants match all complete time/km arrays,32individual block-flow hashes,merged arc-flow hash and every final workspace array/scalar. Two warmups per variant,then11alternating passes each. Workspace/output allocation and all hashing outside timed interval;original ordered merge included.

| Allocation wall time | Old | New |
| --- | ---: | ---: |
| Min |711.956ms|705.997ms|
| Median |718.804ms|710.296ms|
| Max |728.108ms|762.857ms|

Median1.184%shorter,overlapping ranges and a candidate outlier. Isolated Node result is not a browser gameplay improvement claim.

## Full real game: four road Workers

Runner: `node evidence/road-workers/bench-child-read-browser.mjs`. Raw results and full snapshots: [`child-read-browser-AyvbsF/results.json`](child-read-browser-AyvbsF/results.json). Independently regenerated comparisons: [`child-read-browser-AyvbsF/comparison.json`](child-read-browser-AyvbsF/comparison.json).

Visible isolated Chrome for Testing156.0.8078.80,[localhost8001](http://localhost:8001/),same copied fixture SHA256 `e7f36e23da7e6b2201fbed4f4d77f1488be8db249f79450f973aab16095a7f38`,autosave disabled. Single code/page load avoids previous repeated resource-load failures. Before each case,release the idle road pool and restore the identical original export. A test-only Blob wrapper changes only the road Worker source. Successful results from **all four slots** carry a unique per-case acknowledgment;source text is captured and asserted to differ old/new **only by the exact child-read patch**. Worker acknowledgment bookkeeping is identical in both variants. Actual road/mode/metro=4/2/2,road off=false,no fallback,hidden=false. No resource or runtime errors across entire run,including startup.

**Six completed cases,three paired comparisons.** Every pair's complete before/after snapshot is exactly equal in all of:

- **232typed period arrays** (weekday/weekend×4periods,all top-level typed arrays),including constructor,length and full-buffer SHA256.
- **20snapshotMetrics fields** and per-period stats/error/iters/solveSteps.
- **Full serialized economy,25top-level keys**,compared directly as structured data.
- **Full ledger SHA256**,network SHA256 and clocks.

No tolerance or rounding in comparison. This is exact equality for the measured outputs/scenarios,not a claim every internal cache or all possible saves were compared. Browser tests only the Worker implementation with no fallback;main-thread implementation equivalence comes from extracted-function/workspace checks.

| Scenario / order | Old | New | New time change |
| --- | ---: | ---: | ---: |
| Quarter round1,old→new |10,044.4ms|10,056.5ms|+0.120%|
| Quarter round2,new→old |9,825.2ms|10,025.5ms|+2.039%|
| Natural month boundary,old→new |8,286.6ms|8,078.3ms|−2.514%|

Quarter two-run mean9,934.8→10,041.0ms(+1.069%);only two observations/version,not a statistical regression estimate. Boundary is one pair. Quarter timing is actual jump button through jumpDone,hashing outside;boundary timing starts in actual endDay crossing and ends when pending/traffic/reviews complete. Small mixed differences do not establish stable benefit. No whole-year or long-session speed claim.

Completed in116.721s within single120second browser budget. Final existing isolated page left open in **candidate** test environment,Shanghai2000-08-01 minute0,paused,ready/settled,no jump,four road Workers. Profile `/var/folders/n5/_4pxtjbd4977vwnbzxx01r340000gn/T/metro-child-read-WohaBd`;final screenshot `child-read-browser-AyvbsF/final.png`. Disk source and everyday player profile/export unaffected.

## What this does and does not establish

Provides the requested new/old **data-equality evidence** and measured timing differences. It does **not** provide evidence that new is reliably faster. Repeated source-level loads may already be optimized by V8,or the changed branch shape may offset savings;these remain hypotheses without JIT/hardware-counter analysis. Source access reductions are not proof of reduced physical memory traffic. Keep the experiment/evidence,leave production unchanged.

Checks:baseline/final source verify PASS(2.7.2/12maps/103sources),focused3,216rows PASS,kernel11passes/version exact,actual Worker-source diff/4slot acknowledgments PASS,three browser before/after snapshot comparisons PASS,errors0,syntax/whitespace PASS. No build because no production data/runtime/build inputs changed. No commit,push or PR.
