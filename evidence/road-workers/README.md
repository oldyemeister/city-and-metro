# Road Worker comparison reviewed 2026-11-17

Existing completed run: `run-uFBqvu/results.json`; derived report: `run-uFBqvu/comparison.json`. This review reuses all six completed cases; no browser replay or runtime source change. Runner: `bench.mjs`; comparison: `compare.mjs`.

Same export SHA-256 `f6027c5bbbd9aff5c4dcb850f846a0ce5ca45ee75638cce3e38c5fd26827c7f2`, Shanghai 2010-01-16, 278 stations. Chrome for Testing executable configured by the repository, reported Chrome/156.0.8078.80, visible isolated profile. Each case reloads the same export, disables test autosave, waits for traffic settled/review complete/sharp map, then overrides only `CM.CarPool.size` to 4 or 2. Mode/metro pools remain 2/2. Routing algorithms, precision, iterations and gameplay logic unchanged.

| Scenario | 4 road Workers elapsed | 2 road Workers elapsed | Additional wait with 2 | CPU peak 4 / 2 | CPU average 4 / 2 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Normal 1x, 4 game hours | 9.995 s | 10.001 s | 0.006 s | 263.2% / 274.7% | 199.3% / 211.9% |
| Fast-forward 2 months | 6.109 s | 10.834 s | 4.725 s (+77.3%) | 554.5% / 355.7% | 471.7% / 290.2% |
| Consecutive 6 × 2 months | 50.297 s | 86.866 s | 36.569 s (+72.7%) | 610.3% / 446.5% | 474.3% / 286.4% |

CPU is the summed CPU-time delta of processes in this isolated browser instance, including rendering/GPU/browser processes, sampled at approximately 253 ms intervals using CDP SystemInfo.getProcessInfo. 100% means one CPU core. These are sampled interval peaks, not instantaneous peaks or road-only utilization. Elapsed fast-forward is wall time through jumpDone, not a separately measured Worker queue wait. Normal play duration is clock-controlled, so equal elapsed time is expected; this short within-day case does not exercise a monthly rebuild or establish long-session performance. Year case automatically closes each report and starts the next two-month jump; it is not a single 12-month API request.

All three pairs have exactly equal starting and ending clocks, all 20 snapshotMetrics fields, all 40 SHA-256 traffic array digests (weekday/weekend × four periods × arcTime/arcVol/load/stIn/stOut), and economy ledger digest. This covers measured traffic and business outputs, not every internal state field. Ending dates: normal 2010-01-16 four hours later; two months 2010-03-16; year 2011-01-16. Actual road counts verified 4/2, mode/metro 2/2; no hidden-page event recorded. Final normal and jump scenes paused by the runner; no new browser-state observation in this review.

Interpretation: 2 Workers reduced sampled fast-forward CPU peaks by 35.9% (two months) and 26.8% (year), while increasing completion time substantially. No CPU reduction demonstrated during this short normal-play case. One observation per configuration/scenario, varied execution order but no repeated trials; differences are not statistical estimates. No thermal, power or sustained memory conclusion.

Review checks: baseline `node scripts/verify-game.mjs` PASS; comparator regenerated successfully; independent strict assertions PASS for all before/after snapshots, actual worker counts, page visibility and expected jump completion counts. Original result file preserved. No player export edits, commit, push or PR.
