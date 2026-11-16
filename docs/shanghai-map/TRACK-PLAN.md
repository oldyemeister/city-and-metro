# Independent/shared track restoration implementation plan

**Goal:** Restore the archived drawing toggle on codex/shanghai-map, as explicitly requested on 2026-11-16.
**Architecture:** Port only track identity, its edit lifecycle, the drawing controls and overlapping-track rendering. Keep existing upstream construction and operating rules; distinguish physical tracks through trackKey.
**Tech Stack:** Browser JavaScript; Node VM regression checks.
**Spec:** User request recorded in DEVELOPMENT.md.

## Constraints and review focus
- This request explicitly permits this UI/runtime exception to the map-only AGENTS.md scope. No other archive customizations, performance work, pushes or PRs.
- Old untagged saves keep geometry-based sharing. New trackGroup persists through clone, save/restore, shared extensions and station insertion/removal.
- Check reversed endpoints, bends/types, mixed shared/independent routes, costs and shared frequency caps.
- Restrict rendering changes to identical geometry; do not port archive's broader endpoint-only layout.

## Tasks
- [ ] Add focused regression, observe failure on upstream behavior.
- [ ] Selectively port metro/tools/ui/render changes from archive 95fe2d1; run focused checks.
- [ ] Check saves, construction charges, capacity caps and existing regression suites; build and verify source/dist.
- [ ] Serve root on 8001, verify loaded browser code and toggle, review diff, update STATUS/DEVELOPMENT. Leave uncommitted for review.

## Execution ledger
- Baseline node scripts/verify-game.mjs: PASS (2.7.2, 12 maps, 103 files).
- Archive origin: git log -S trackMode identifies 95fe2d1.
- Execute inline per user authorization. No approval checkpoint needed; final diff remains available for review.
