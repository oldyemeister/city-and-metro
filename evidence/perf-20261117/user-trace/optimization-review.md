# Trace optimization review — 2026-11-17

Read-only follow-up to README.md. No runtime changes or measured speedup.
Input: the same Downloads/Trace-20261117T130822.json. Reproduce the additional
event counts with `python3 evidence/perf-20261117/user-trace/inspect-insights.py`.

## Priorities

1. **Road search: highest relevance to fast-forward wait.** Four road workers
   each spend about 12.15–12.22s sampled self elapsed in carTree; the existing
   analysis identifies about 94.6% of road handler sampled time there.
   js/sim.js:31 uses duplicate-entry binary-heap Dijkstra, full dist.fill and
   termination only after every marked destination access node is settled.
   First measure settled/visited nodes, stale heap pops, maximum heap size and
   unmet targets by origin. Compare a sparse WASM implementation or heap variant
   against this exact kernel in isolated replays. Current samples do not isolate
   lines or establish that dist.fill dominates. If search visits most nodes,
   timestamp-based lazy distance initialization may bring little benefit.
   Existing dense WASM gating at 75% OD density is not evidence of an optimal
   crossover, but lowering it alone is not a validated improvement.
   Preserve strict relaxation/tie order, Float32 rounding, destination order,
   flow accumulation and fallback equivalence. Changing the heap or search
   termination can change equal-cost paths and congestion outcomes.

2. **Tile-worker readback: concrete experiment for map sharpening.**
   js/render.js:1306 flushCanvas reads a pixel after each of 4/8/16 strips.
   js/tile-worker.js passes a fourth argument to groundChunkGen, but its current
   three-argument signature ignores it. The worker consumes every yield in one
   synchronous loop, then transfers only the completed bitmap. Thus it still
   pays strip readbacks without showing those intermediate results. Compare a
   worker-only flush policy (fewer or no intermediate readbacks); preserve the
   main-thread progressive-rendering path. Trace getImageData sampled self is
   ~3.37s summed across two parallel tile workers, including potential native
   synchronization/wait. This is not an estimate of removable wall time.
   Validate completed images, seams, cancellation, raster/memory cost and map
   readiness before adopting; comments indicate an existing rasterization concern.

3. **HUD/quick toolbar: real, small opportunities.** Explicit UI.fitHud stacks
   account for 89 Layout events /17.305ms and 89 UpdateLayoutTree events /28.427ms
   (~45.7ms across 22.8s; categories are separate sequential work at these stacks,
   not a claim about all nested browser time). updateTop is already throttled to
   250ms, writes text/styles then calls fitHud, which reads client/scroll width
   and computed style interleaved with node movement. Cache the cluster reference,
   skip unchanged text and stable layout work, and invalidate cached measurements
   on actual size/content/font/visibility changes. Q.tick triggers 502 attributed
   UpdateLayoutTree events /42.127ms; it reads offsets then writes left/top each
   frame. Reuse dimensions until resized and skip unchanged positions, considering
   transforms only after verifying existing zoom/overlay placement semantics.
   Do not equate all 394.612ms Layout or 806.925ms UpdateLayoutTree with forced
   reflow: most events have no JS stack. These changes target frame consistency,
   not the primary monthly solver wait.

4. **Mode-worker imbalance: investigate after road kernel.** Prior samples show
   odOrigin self ~3.218s vs0.496s. Determine which jobs and active origins differ
   before changing work distribution. Four road workers themselves have nearly
   equal total handler time, so aggregate trace does not establish road load
   imbalance or justify simply increasing worker count.

## Lower priority / limits

- Two recorded click interaction groups have max EventTiming duration 52.917ms
  and63.546ms. No evidence here of a slow recorded click; this is not field INP
  or an assertion about unrecorded interactions.
- No ResourceSendRequest/ResourceReceiveResponse events: insufficient evidence
  for third-party network, startup LCP, cache or loading optimization decisions.
- Autosave callback53.44ms is a separate small hitch candidate, not explanation
  of multi-second waits. Do not change save behavior without separate profiling.
- No optimization percentages or before/after results are established. Existing
  worker elapsed estimates overlap in time and cannot be added as player wait.
- Validation: baseline source verify PASS; additional inspector completed.
  Browser work/build not applicable to this offline, source-unchanged review.
