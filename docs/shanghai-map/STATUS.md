# Shanghai map development status

Updated: 2026-11-16 (Asia/Shanghai).

## Objective

Develop Shanghai map improvements from an unmodified upstream baseline, with records another agent can follow. Prepare a focused contribution suitable for an upstream pull request.

## Repository state

- Active branch: `codex/shanghai-map`.
- Upstream: https://github.com/VinsonFung/city-and-metro
- Baseline: `bd76a322970ae250b8920aed03fd7661a882342a` (v2.7.2); upstream fetched on 2026-11-16.
- Fork: https://github.com/oldyemeister/city-and-metro
- Previous customized work: local branch `codex/archive-local-20261116`, snapshot commit `95fe2d1` (also includes all previously uncommitted files).
- Original branch `codex/tokyo-line-palette` and prior stash backups remain available.
- Current game source is upstream code; only agent/development documentation has been added. No Shanghai facility changes yet.
- Preview: http://localhost:8001/ serves this repository root.

## Next work

1. Select the first facility batch with the user. User candidates: Fudan Jiangwan campus, SJTU Minhang campus (Zizhu area), and CPC First National Congress Memorial.
2. Verify coordinates, coordinate reference system, map bounds, opening dates and sources.
3. Implement facilities in `js/data_sh.js`; preserve existing IDs. Consider old/new campus weights together.
4. Check opening-year behavior, facility access, estimates and save compatibility. Build and inspect the preview; log exact results.
5. Prepare a Shanghai-only upstream PR when requested, with factual sources and validation evidence.

## Checks

- `node scripts/verify-game.mjs`: PASS; version 2.7.2, maps 12, source files 103.
- `node scripts/build.mjs`: PASS; 106 output files and 85 HTML references checked.
- Tracked runtime source comparison to upstream/main: identical.
- HTTP preview configuration matches local v2.7.2 source exactly.

## Open decisions

- Final batch, coordinates and gameplay weights are not approved or implemented.
- The 2021 memorial expansion should not erase pre-existing visitor demand at the historical site.
- No upstream PR or external message has been sent.
