# Agent handoff

Read `docs/shanghai-map/STATUS.md` before working, then `docs/shanghai-map/DEVELOPMENT.md`.

## Scope

- This branch starts directly from `VinsonFung/city-and-metro` upstream, not the customized fork branch.
- Work on Shanghai map data only. Primary file: `js/data_sh.js`; change `js/geo_sh.js` only when geographic data actually requires it.
- Do not reintroduce old palette, station expansion, simulation, economy, or UI customizations from the archive branch.
- Documentation, focused map checks, and build-generated metadata are permitted supporting changes. Explain these in the development log.
- Preserve existing facility IDs and ordered historical events; old saves may reference them. Append historical events rather than reorder them.
- Use `ll`/`at` for GCJ-02 coordinates and `llW`/`atW` for WGS-84. Verify bounds and facility access; map edges can exclude candidates.
- Separate sourced facts (location/opening dates) from estimated gameplay weights. Record sources and decisions per facility in `DEVELOPMENT.md`.

## Workflow

- Keep changes reviewable in small batches. Candidate facilities are proposals until selected for implementation.
- Update `STATUS.md` at handoff with completed work, remaining work, branch/base, checks and blockers.
- Append development entries with date, intent, files, evidence, decisions, verification commands/results, and commit when available.
- Run `node scripts/verify-game.mjs` for the baseline, `node scripts/build.mjs` after data edits, and relevant focused checks. Record actual results, not assumed passes.
- Preview from repository root on port 8001: `python3 -m http.server 8001 --bind 127.0.0.1`.
- Preserve other user work. Do not push, submit a PR, or contact maintainers unless requested.
- For browser reproduction and acceptance of gameplay/display changes, use `.agents/skills/metro-browser-check/SKILL.md`: Chrome for Testing, an isolated test tab/profile, a configurable export from `savedgames/test/`, and a 120-second browser budget followed by manual handoff with the scene left open.
