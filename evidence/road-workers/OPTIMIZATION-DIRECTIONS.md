# Road optimization directions and measured screening — 2026-11-17

User requests no coding first: propose several directions and use actual tests to choose them. This batch writes no implementation/prototype/test-script code. Production stays unchanged on `performance`/f9706d4 with four road Workers. Existing prior prototypes/scripts are preserved, not applied. New work is offline analysis of two existing real Chrome performance recordings and supporting JSON/docs, **not a new live browser run or an A/B optimization benchmark**.

## Actual observations

1. `evidence/shanghai-two-month/run-gvaONc/trace.json`: completed real Shanghai2010/278station two-month jump, marked start/ready interval7,059.294ms. Recording summary has one `Uncaught (in promise)` error and `dataLoss:false`; use for hotspot diagnosis, not clean functional acceptance. Reassembled CPU profiles by `(pid,profileId)` because chunks appear on V8 profiling helper threads; use Profile event's owner thread, accumulated sample deltas and clamp to the marked interval. Four road profiles identified by `carTree` frames. Derived report: `trace-road-analysis.json`.
2. `docs/Trace-20261117T130822.json.gz`: separate existing recording, no explicit start/ready marks. Reassemble its complete road profiles as an independent hotspot cross-check; no wall-time/same-scene comparison claimed. Derived report: `trace-road-crosscheck.json`.

In the marked capture, `carTree` accounts for **93.79%** of road non-idle/non-program sample weight; the independent recording gives **94.24%**. These are statistical sampled execution positions weighted by elapsed sampling intervals, not exact CPU-clock totals. Four workers' recorded `onmessage` thread-CPU totals are5,439.899/5,450.083/5,444.497/5,427.636ms: **0.41% max-to-min spread** relative to their average. Each has130handler calls, including graph/setup messages, not130road blocks. Final handler finish times span22.003ms across the7.059s window. This does not rule out individual-block imbalance, but gives little evidence of a large worker tail in this workload.

Chrome sample `lines` map to the current baseline `carTree` body using the worker callFrame's function-start offset. Assumes identical function body; source/line attribution can shift with inlining or adjacent instructions. Heap-pop/downheap lines50–58 contain **45.63% of carTree sample weight**; road arc loop plus relax/push lines63–69 contain **45.95%**. They are separate source-line groups, not exact independently timed operations. `carOriginRow` self samples contribute about5.79% of road active weight; distance fill only0.4%of carTree line samples. Worker GC sampled39.848ms aggregate across all four threads, about0.17%of road active sample weight; not a memory-leak or main-thread-GC conclusion.

## Directions and tests, in priority order

| Direction | Measured basis / screening result | Next actual test before implementation | Result-preservation constraint |
| --- | --- | --- | --- |
| 1. Reduce binary-heap pop/downheap cost | Nearly half of carTree line samples in heap removal, especially choosing/comparing child entries. **Prioritize.** | First inspect per-worker line distribution and heap size/pop/stale counts on the same real workload; then, only in a later authorized minimal A/B prototype, compare equivalent pop-loop formulations with same binary heap/ties across repeated real jumps. | Preserve left-child tie preference, comparisons, insertion/pop order and all selected predecessors. Changing heap arity or decrease-key structure is not presumed equivalent. |
| 2. Reduce arc-loop/relaxation memory access | The other major line group is outgoing-arc scanning with relaxation/insertion. **Prioritize alongside1.** | Separate arc-scan samples from successful relax/push samples; test whether repeated indexing/invariant reads are actually emitted by JIT before proposing hoisting or representation changes. A later isolated A/B must include hot-loop time and end-to-end wall time. | Same arc iteration order, Float64 addition, Float32 distance rounding, strict `<` and heap pushes. No numeric precision or graph-order change. |
| 3. Reduce repeated request data copies/allocations | Source repeats the same arc-time array per block; payload accounting establishes duplication, but trace postMessage JS self samples do not measure native structured clone cost. **Potential, currently unproven.** | Attribute serialization/deserialization/allocation/GC separately from queue waiting and actual Worker service. Existing~45ms schedule-to-handler median closely matches~45ms previous handler duration, consistent with depth2 queueing; it is not evidence of45ms network/copy time. | Immutable request snapshot, request/graph ownership, cancellation and fallback semantics. Keep32blocks and original result merge order. |
| 4. Improve fixed-block scheduling | Worker CPU totals already within0.41%, final finish spread22ms. **Deprioritize for this scene.** | Only revisit with a larger/problem save or per-request tail showing idle workers waiting on a slow block. Keep the same four workers when collecting that evidence. | Dispatch order may vary only if block membership, origin order and final floating-point merge order stay fixed. |

No speedup is promised for any direction. The screening already tests whether their alleged bottlenecks exist in actual captures; no code-free measurement can establish the speedup of an implementation that does not yet exist.

## Already measured and set aside

- Unique-target cache:7warm passes,726.10→736.53ms median plus47.22ms prep/3.92MBarrays; no benefit.
- Conservative early stop:3.60%fewer settlements,774.18→778.61ms median; no Node benefit. One incomplete-browser pair's apparent7.95%gain is not repeatable accepted evidence.
- Distance clearing/Worker GC are small in the measured hot path. Do not start there based on allocation counts alone.
- Four workers retained; no iteration/pruning/demand/precision changes and no forced dense WASM.

## Acceptance for a later implementation experiment

Same save, same scenario, four road/two mode/two metro Workers, alternate original/candidate order and multiple repeats. First require exact before/after clocks, all measured traffic-array byte hashes, business metrics and ledger; then compare medians and run-to-run spread. Runtime/resource errors and missing actual-source execution markers invalidate a case. A faster isolated loop alone does not establish a gameplay benefit. Browser checks retain repository's120second budget per authorized attempt.

This batch's verification: two trace files parsed, profile sample clocks reassembled, real thread-CPU durations independently inspected, source source-line group weights summed without double counting, derived JSON consistent. No new browser actions, player exports, implementation scripts, runtime/build files, commit,push or PR.
