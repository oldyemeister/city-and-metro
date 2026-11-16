# Three Shanghai campuses implementation plan

Goal: implement only SISU Hongkou, ECUPL Changning and SHCM Fenyang in data_sh.js, preserving P1 and all old IDs/events. Spec: user request and AGENTS.md; branch codex/shanghai-map, baseline HEAD de555aaa.

- [x] Read status/development/plans and inspect dirty files; baseline verify passed.
- [x] Check official address history and migration; retain campus-only conservative estimates, WGS-84 OSM entrances with exactSite.
- [x] Append three uni facilities and historical migration descriptions; no geo/engine/UI changes.
- [x] Focused check: exact old data/event prefix, labels, monthly weights/activation, real land/regions/walking access and old save; run P1/label regressions/build/verify/diff.
- [ ] Visual acceptance (attempted; load timed out): visible isolated CFT, configured July2000 export, <=120 seconds; inspect three labels/details/locations, leave scene open and record gaps.
- [x] Update four handoff documents with sources, facts versus estimates, actual results. No push/PR.

Review focus: no whole-university headcount at old campus; new-campus opening versus relocation; dorm moves versus teaching moves; real entrance versus station snapping; preserved save/event indices. Implementation and verification proceed in this session as explicitly requested; no separate approval gate or unrelated refactoring.

Completion: all implementation/data checks and documentation complete. Browser attempted with visible isolated CFT; load readiness guard failed after79.41s, no campus visual pass. Manual acceptance remains open as documented in STATUS/DEVELOPMENT.
