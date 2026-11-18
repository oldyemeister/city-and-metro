# Road Worker dispatch calibration implementation plan

**Goal** — Use Shanghai 2010 (278 stations) and a real small map with fewer, geographically closer destinations to choose a browser-compatible road kernel dispatch rule.

**Architecture** — Compare the shipped sparse JS and embedded Rust/WASM paths while keeping the four original road Workers, their inputs and their ordered reduction. Only an evidence-backed selector belongs in the runtime.

**Constraints** — Preserve gameplay, saves, traffic and business results, mobile/desktop worker allocation, existing fallback and dependencies. The user authorized eight minutes for this round of visible isolated Chrome testing. Keep player exports local.

- [x] Validate input provenance, measure OD distributions, and compare three-month, one-year and natural rollover cases using the real game entry points. Save raw before/after state, executed Worker evidence, elapsed time and any errors under `evidence/road-workers/dispatch-calibration/`.
- [x] Gate all timing interpretations on equality of the traffic arrays, period stats, business metrics, full economic state, clock and network. Compare lower-density vs higher-density blocks in the fixtures to avoid guessing an unsupported crossover.
- [x] Apply the smallest supported change in `js/sim.js`. Keep the previous path for untested workloads when the evidence does not support extension. Verify missing/failed Wasm and Worker fallback, mobile allocation and unchanged browser requirements.
- [x] Run a source build and regression checks for a runtime change. Independently reconcile all timings and update `docs/shanghai-map/STATUS.md` and `DEVELOPMENT.md`.

[Measured results and verification](../../../evidence/road-workers/dispatch-calibration/README.md)
