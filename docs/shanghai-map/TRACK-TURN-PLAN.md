# Parallel track turn ordering implementation plan

**Goal:** Keep independent parallel lines on the same side through turning platforms.
**Architecture:** Orient display lanes along the lowest-numbered line's continuous topology, then use that directed tangent for platform ordering. Keep physical geometry and persisted saves unchanged.
**Tech Stack:** Browser JavaScript and Node VM regressions.
**Spec:** User request of 2026-11-16; authorized runtime exception to map-only scope.

## Review focus
- Nonmonotonic station IDs at a turning junction must not reverse lanes.
- Reversed segment storage must produce the same physical paths.
- Platform axes crossing 0/π must retain the same lane ordering.
- Shared tracks retain identity, charges and operating limits.
- Recompilation and save restoration must reproduce layout without migration.

## Task 1: Continuous display direction
Files: js/metro.js, js/render.js, js/tools.js, scripts/check-independent-tracks.mjs.
- [x] Add regression for turning corridors, reversed storage, platform alignment and restoration; observe failure.
- [x] Add topology-based display direction; use the reference line for segment lanes and platform normals. Adjust hover preview to use compiled lane orientation.
- [x] Run focused regression, existing v27 checks, build, baseline verification and whitespace checks.
- [x] Review diff and update STATUS/DEVELOPMENT; leave changes uncommitted with other user work.

Execution: inline under the user's direct repair request; no approval checkpoint or delegation needed.
