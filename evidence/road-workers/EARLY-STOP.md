# Exact road-search early-stop experiment — 2026-11-17

Branch: `performance`, HEAD `f9706d42faffdd7c3b99720923aa0259f8181943`. Production `js/sim.js` and automatic four-road/two-mode/two-metro configuration remain unchanged. The candidate is a test-only source transform in `early-stop.mjs`.

## Rule and reasoning

Keep the existing binary heap, strict relaxation comparisons, connector order, original all-access-node stop, origin order and fixed32-block flow accumulation.

For every requested destination with connections, wait until at least one of its access nodes is settled. That access gives a feasible total-time upper bound: settled Float64 road distance plus its Float64 connector time. Let `upper` be the maximum of these bounds. Stop only when the next popped road distance is **strictly greater** than `upper`.

For nonnegative connector costs, an access node beyond that bound cannot beat any destination's feasible total. Nodes tied at the bound are still processed, retaining connector-order tie choices and Float32 distance outputs. The heap executes exactly its old prefix. Selected predecessor paths are within that prefix; subsequent nodes cannot contribute positive demand to the chosen paths, so skipping them retains reverse-flow addition order. The original all-target stop is checked first and remains available. Entirely unreachable destinations prevent the bound from becoming active. Graphs with negative/nonfinite connector costs disable the new stop and retain old behavior; the solver's existing nonnegative road-cost assumption remains.

An inverse connector index is built with the per-graph workspace. Target stamps are reset on overflow; destinations sharing accesses are handled separately. This bookkeeping is a cost and may outweigh reduced search.

## Focused differential checks

`node scripts/check-road-early-stop.mjs`: **PASS,3,216 rows**. Covers ties, a zero road edge, disconnected/shared/empty access lists, repeated workspaces, stamp overflow, negative-connector fallback, large Float32 road costs/Float64 connector boundaries, and120deterministic random graphs. Complete Float32 time/km/flow buffers are compared byte-for-byte. Deliberate redundant-access tail:100settled nodes baseline vs2candidate, identical outputs.

Independent review found no counterexample to the supported stopping rule. Remaining production-adoption coverage includes existing Worker-slot graph replacement and explicit Worker failure/fallback integration. No production patch is promoted on the basis of these checks alone.

## Real road allocation

Command:

```sh
node evidence/road-workers/bench-early-stop.mjs 'savedgames/test/城市与地铁_经营挑战 · 上海 1990_2000年7月.cmsave.json' evidence/road-workers/early-stop-kernel.json
```

Local read-only fixture: Shanghai2000-07-14/121stations, SHA256 `e7f36e23da7e6b2201fbed4f4d77f1488be8db249f79450f973aab16095a7f38`. This is not the earlier2010/278station Worker-count fixture. Capture first real road allocation during a next-month jump:1,329origins,7,392nodes,20,634arcs. Seven alternating warm passes per version, identical time/km arrays, each of32block flow arrays and merged flow hashes.

| Measure | Original | Candidate |
| --- | ---: | ---: |
| Settled nodes |8,858,437|8,539,520|
| Median allocation elapsed |774.18ms|778.61ms|

3.600%fewer settlements, **0.571%longer** median elapsed. Workspace setup is recorded separately; timing includes the same32block digest/merge work in both variants. This is a Node kernel benchmark, not a Chrome gameplay speedup.

## Browser attempt 1: incomplete

Visible isolated Chrome for Testing156.0.8078.80 at localhost8001, same read-only fixture, test autosave disabled, actual pools4/2/2; no road fallback and0WASMblocks. Source interception substitutes candidate only for the isolated tab. Completed3quarter jumps (baseline1,candidate2); one matched round compares all232top-level typed period arrays by type/length/SHA256,20snapshotMetrics fields, full economy ledger hash and clocks before/after: exactly equal. This covers measured traffic/business outputs, not every internal model object.

First pair:10,823.2ms original vs9,963.0ms candidate (~7.95%shorter); second candidate10,069.0ms has no completed paired baseline. All completed scenes paused and visible, each3months/2,304JSblocks. **Do not accept this as stable speedup.** Fourth page load failed amid resource connection resets and startup TypeErrors;51aggregate errors lack per-request/case attribution in this first runner revision. Budget ended115.61s with no loaded game; screenshot is blank. Natural boundary and remaining repetitions were not reached. Source hashes were generated but execution markers were not independently asserted in this revision, another acceptance limitation.

Raw evidence: `early-stop-browser-By4dh5/{results.json,final.png}`. Existing isolated profile `/var/folders/n5/_4pxtjbd4977vwnbzxx01r340000gn/T/metro-early-stop-FyF4pL`, page left open. No further browser action until user explicitly requested refreshing it.

Independent review led to a single evidence-fix pass: runner now records successful fulfilments, injects/asserts a per-case actual-source hash/token, attributes errors and gates runtime/local-resource errors, reuses cache and reloads the existing test page. Original results remain unchanged. These improvements do not retroactively validate attempt1.

## User-authorized refresh retry

User said “重新刷新一下就好了”, authorizing a fresh bounded attempt using the same isolated profile. New120second budget; existing test tab reloaded, everyday player browser/source save untouched. Retry `early-stop-browser-LeZoYu/results.json` ended116.234s at the actual-source/case readiness guard, with **0completed cases,0fulfilments,0recorded runtime/resource errors**. No injected source token was observed and `CM.game` was absent at final inspection (`clock:{}`). Therefore refresh did not produce a valid test scene and adds no equality or timing evidence. No claim about the root cause of missing interceptions; cached resource behavior is a possible confound. Final runner revision forces cache-disabled/ignoreCache reload for a future explicitly authorized test; syntax checked only, no third browser attempt.

## Disposition and manual handoff

**Do not promote the candidate.** Focused kernel equality is strong for measured inputs, but Node timing shows no gain and browser evidence is incomplete. The single raw quarter pair's apparent7.95%gain is not a reliable actual speedup or clean browser acceptance. Repeated quarters/year/natural month boundary, execution-source assertions and a clean resource/error inventory remain pending.

The isolated Chrome window/profile stays open at [localhost8001](http://localhost:8001/), last observed blank/unloaded, not a paused loaded game. Manual: refresh this test window; once the game UI loads, disable autosave and import the copied121station July2000fixture, confirm Shanghai2000-07-14 and pause. To validate the experimental candidate, use the marked/intercepted comparison runner under a new authorized browser budget; an ordinary manual import exercises production baseline only. Preserve the everyday player page and original export. No further browser retries in this task after the authorized refresh budget.

Checks: baseline/final source verify PASS (2.7.2/12maps/103sources), focused3,216rows PASS, strict saved-report assertions PASS, script syntax and whitespace PASS. `js/sim.js` exactly equals the pre-experiment source copy; no map, geo, runtime or build-metadata edits, so build is not applicable. No commit,push or PR.
