# Shanghai P1 Facilities Implementation Plan

> Execute inline in this workspace; the user requests completed data and verification, preserving existing work.

**Goal:** Implement all twelve selected P1 destinations and their campus/old-site allocations.
**Architecture:** Shanghai data only, existing facility curves and monthly dates; no simulation/UI change. Append facilities/events, preserve stable IDs and old event order. Use WGS-84 OSM footprints and explicit site coordinates that bypass station-name snapping.
**Tech Stack:** Browser JavaScript, Node VM checks, isolated Chromium/CDP measurements.
**Spec:** User request; FACILITY-PLAN.md P1 rows 1–12; EDUCATION-PLAN.md.

## Constraints and review focus

Preserve unrelated uncommitted work and player saves; no push/PR. No ordinary pax. Distinguish facts from gameplay estimates. Test startup land/road access and stable IDs, old-save restoration, campus aggregate allocation, residual outpatient demand, monthly expansion boundaries and no duplicate nodes.

## Tasks

- [x] Baseline: capture savedgames save hash and current data snapshot; reproduce browser timing at fixed 1440×900, camera (76,76,zoom 10), speed 1. Record cold restore, first full solve vs repeated traffic solves, frame CPU and frame intervals, reset same save for a 12-month jump. Save is July 2000, not 2020: explicitly limit conclusions to its network/year.
- [x] Batch A: Renji east/west, science museum, Jinjiang, Oriental Sports Center, Global Harbor, continuous First Congress Memorial. Append fixed WGS-84 sites, dates and conservative curves. Check active months, no same-name station snapping and 2021 May/June/July. Repeat identical benchmark.
- [x] Batch B: SHNU Xuhui, USST Jungong group, SHU Yanchang/Baoshan; retain combined SHU 0.02 after 1999. Test historical aggregate and labels. Repeat benchmark.
- [x] Batch C: Fudan Jiangwan/Zhangjiang/Handan allocation, Fudan pediatric Minhang with residual Fenglin old-site clinic. Test openings and conserved allocation around transfers; repeat benchmark.
- [ ] Final: focused real-city/save checks, existing regressions, build/verify, visual facility inspection in isolated profile, update planning and development/status evidence. No player data writes.

Each batch must pass focused checks; performance captures are observations, never inferred from an error-free run. Benchmarks after data edits require a fresh build so worker signatures match.

## Execution findings

Data portions A/B/C completed; focused checks pass. Performance substeps remain partial: A120s timeout, B/C skip one-year jump when insufficient budget remains; B has only4frame samples and cannot establish steady state. C records ready/review/solve/render flags but one sample is not a robust regression estimate. User declined240s expansion. Final noModel correction for Jinjiang fixes the generic820×660m scenic model while preserving demand; its graphics performance is not separately benchmarked. The prior headless ordinary-Chrome timing is historical diagnostics, not the final CFT baseline.

Execution: all runtime batches implemented and script-verified. Performance substeps incomplete under user-retained120s budget (A timeout; B/C jumps unrun). Final broad checks passed; final Jinjiang browser visual acceptance requires manual handoff. See DEVELOPMENT for exact failures/evidence. No commit requested; changes remain reviewable in working tree.
