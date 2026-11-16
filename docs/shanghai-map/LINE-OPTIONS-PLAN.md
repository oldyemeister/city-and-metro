# Line options and parallel diagram implementation plan

**Goal:** Add a direct line-wide station upgrade button and distinguish shared rails from independent parallel rails in both network diagram modes.
**Architecture:** Reuse the existing draft/undo/quote workflow. Upgrade each eligible station one size per click, respecting current unlocks and preserving larger stations. Keep shared diagram lanes tightly spaced and independent lanes wider; export uses the same paths.
**Tech Stack:** Existing browser JavaScript UI, SVG, Node VM fixtures.
**Spec:** User requests on 2026-11-16, including the diagram follow-up during implementation.

- [x] Add the upgrade button to line details in map options and operations management.
- [x] Apply parallel paths to geographic diagrams and variable physical-track spacing to schematic diagrams; include station anchor bounds.
- [x] Check draft-only mutation, one undo step, maximum size/year locks, unrelated stations and mixed physical track groups.
- [x] Attempt browser inspection (unavailable: browser access host), run focused and existing regressions, build/verify; update handoff documents. Preserve player storage and all unrelated work; no push/PR.

## Shared corridor endpoint follow-up
- [x] Reproduce logically shared rails with unequal samples caused by onward-line divergence; observe the focused regression fail.
- [x] Reuse diagram centerlines by stored route identity, retaining physical-track spacing and stored simulation geometry.
- [x] Verify the three named station pairs in existing Shanghai 2010 exports in both modes, run focused/replay/independent checks and build/verify. Live-game inspection unavailable due to missing browser worker dependency.
