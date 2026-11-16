# Shanghai map development status

Updated: 2026-11-16 (Asia/Shanghai).

- User now identifies primary gameplay stalls after fast-forward and committing an entire new line (~10+stations); prioritize topology/month refresh over minor warm-label costs. User mainly plays2D, views new landmarks in2.5D (reported lower displayed smoothness, not refuted by JS cadence). Source trace: confirmDraft→compile→setNetwork→buildMetro→synchronous computeAccess; topology changes invalidate dimensions/buffers and require new traffic iterations. updateTrafficImpact later predicts pre/post networks, rebuilding both when comparisonC supplied. Fast-forward monthGen uses refreshCityGen/buildDemandGen/computeAccessGen and solveGen/reviews. No phase timings established yet. Attempted isolated one-month real profile stopped immediately because test tab no longer exists; no jump/import/source changes executed. Failure/probe in evidence/perf-20261116/month-refresh/. Need reopen isolated test tab and preferably suitable before/after whole-line exports for real reproduction; no auto retry or optimization patch.

- Road-name investigation: repeated foreground2D6s drag confirms144layouts,143with moving=false, average3737road candidates per query versus36actual road-font labels;538105candidate visits. Whole-label layout78.7ms,total road spatial query20.5ms; whole layout~0.547ms/reflow,0.109ms/render, not road-only cost. Final static funnel3415candidates→1825basic eligible→151long→102visible midpoint→34unique names. Main opportunities: drawLabels5215–5221 movement/relayout scheduling; layoutLabels5367–5384 road eligibility/candidate iteration; Geo.query191 bucket dedup only~0.142ms/query. Text widths/sprites0misses. Evidence road-labels-verified/summary.json; first road-labels count mistakenly included same-name stations and is explicitly superseded for road counts. No code optimization; page remains visible/focused/paused/clear.

- Detailed2D profiling: warm foreground121stations/150segments/zoom24.80; completed3x6s +6s no-selection control. Metro bitmap cache rebuilt0times,paintMetro/drawTrack/stationSprite not invoked. Drag layoutLabels144calls/6s,mean0.557ms,total80.2ms; CPU line ticks chiefly road candidate query/filter at render.js5367–5369. textW/labelSprite misses both0. Selection `{kind:seg,id:g142}` caused strokeArr once/render (~0.125ms); clearing only selection reduced drawMetro0.151→0.021ms/render with no strokeArr, then selection restored. Priorities: road-name candidate iteration, label relayout scheduling, optional selected-segment stroke; not station sprites/metro core/cache rewrite. All2D intervals~8.33ms,p95~9.3ms; no sustained bottleneck. Evidence `evidence/perf-20261116/2d-detail/` and `2d-no-selection/`. Probes removed, page visible/focused/paused/sharp; no game source edits.

- Clear foreground2.5D profiling completed: required8consecutive200ms readiness checks; inspected ready.png. Same Shanghai2000/121station scene,1200x762/DPR2/zoom24.80, settled model, foreground focus confirmed. Paused drag render mean4.296ms/p955.9ms vs normal1x3.320ms/p953.8ms; drawMetro ~1.24/1.18ms per render, drag labels0.507ms (layout1.378ms on97calls), model.step ~0.005/0.003ms. Warm facility sprites inexpensive (~0.12/0.046ms aggregate per frame); previous cold single-frame spike not reproduced. All >33ms rAF gaps at sample index0 immediately following profiler start, likely measurement startup interference; retain raw and exclude-first summaries. Dominant measured load is drawing, not settled simulation; no sustained freeze reproduced. Evidence `evidence/perf-20261116/iso-ready/` includes screenshot,raw,summary,probe,three cpuprofiles. Final scene visible/focused/paused/sharp; hooks removed. No runtime edits; source verify/diff checks PASS.

- Foreground profiling follow-up: OS-activated existing isolated CFT, no emulated focus; current Shanghai July 2000 scene,121 stations,2D zoom24.80,1200x762/DPR2,traffic settled. Completed ~4s each paused idle/paused middle-button drag/normal1x, all sampled frames visible and start/end focused. rAF mean intervals8.49/8.47/8.47ms, p95 9.3/9.3/9.2ms. Render mean1.77/1.43/1.08ms per render; agents update0.14/0.13/0.58ms; model step~0.005ms. No sustained main-thread bottleneck reproduced here; rare74–83ms frame gaps remain unexplained. Previous slow labels/sprites are not reproduced in this warm2D scene. Short2.5D follow-up failed sharpReady prerequisite, no profile; no further browser retry. Page left visible, focused, paused in2.5D; hooks restored. Evidence `evidence/perf-20261116/foreground-2/summary.json` and cpuprofiles; next investigation is2.5D warmup/cold tile-sprite generation, not premature optimization. No game code edits.

- Performance investigation (no optimization edits): confirmed JS/Canvas + workers. Existing `measure-shanghai-p1.mjs` forces synchronous `solveNow`, disabling workers, so its long forced-refresh timings are not representative of ordinary gameplay. Current isolated CFT reports Canvas/compositing/raster GPU features enabled. Bounded live probe captured only one paused frame with document visibility `hidden` (12.55s interval), then running-case evaluation timed out. Candidate cold-frame costs: render 1287ms, labels 446ms (layout 378ms nested), facility sprites 374ms; not steady-state bottleneck proof. Raw profile/summary/probe in `evidence/perf-20261116/`. Next: manually foreground test tab, refresh to remove temporary probes, pause and warm caches; collect foreground steady-state/pan/normal-speed samples. No further automatic browser retries this turn. Source verify and diff whitespace PASS.

- Browser skill follow-up: verified Chrome for Testing is installed/executable under `~/Applications/Google Chrome for Testing.app`; configured the explicit executable. User now permits ordinary Chrome with a dedicated isolated test profile as fallback. Both must be visible; 120-second budget and scene preservation unchanged. Installation verified, browser control not exercised.

- Browser acceptance skill added: `.agents/skills/metro-browser-check/`; AGENTS routes gameplay/display verification to it. Defaults: visible Chrome for Testing in an isolated test tab/profile, port 8001, configurable Shanghai export copied into `savedgames/test/`, and a 120-second total browser setup/acceptance budget before manual handoff with the scene left open. Skill validation, fixture/config checks and source verify PASS. This creates the workflow only; no browser acceptance was performed in this turn. Existing implementation work remains untouched.

## Objective

Develop Shanghai map improvements from an unmodified upstream baseline, with records another agent can follow. Prepare a focused contribution suitable for an upstream pull request.

## Repository state

- Active branch: `codex/shanghai-map`.
- Upstream: https://github.com/VinsonFung/city-and-metro
- Baseline: `bd76a322970ae250b8920aed03fd7661a882342a` (v2.7.2); upstream fetched on 2026-11-16.
- Fork: https://github.com/oldyemeister/city-and-metro
- Previous customized work: local branch `codex/archive-local-20261116`, snapshot commit `95fe2d1` (also includes all previously uncommitted files).
- Original branch `codex/tokyo-line-palette` and prior stash backups remain available.
- Shanghai facility display names now distinguish the existing Fudan Handan, SJTU Xuhui, SHU Baoshan and DHU Yan’an Road campuses using two-line map labels; no facilities, locations, weights or dates added/changed. User-requested drawing controls are present as uncommitted runtime changes. The follow-up independent-track platform alignment is implemented and tested; see the development log. The selected P1 campuses/facilities and coordinated weights are now implemented; other proposals remain documentation only.
- Preview: http://localhost:8001/ serves this repository root.

## Next work

- All 12 selected P1 items are implemented in `js/data_sh.js`, plus the required Fenglin outpatient old-site companion; see FACILITY-PLAN implementation table and DEVELOPMENT per-facility record. Fudan Handan and SHU Baoshan weights are coordinated; Renji west remains active. No P2/P3/deferred runtime additions, no `geo_sh.js` edit.
- Jinjiang follow-up: `noModel:true` suppresses the generic 820×660m amusement-park model that obscured the original interchange/rails; facility location, radius and demand weights retained. Final visual evidence is recorded separately from earlier performance captures.
- Performance acceptance remains incomplete: batch A timed out; B and C have diagnostic timing captures but no one-year jump within the 120s budget. B frame sample was only4frames with large stalls; do not call it stable performance or a pass. Baseline/C show no obvious forced-refresh regression but single observations and software-rendering flags prevent a general performance claim. User explicitly kept120s limit and requested missing items be recorded.
- The `savedgames/test/` fixture is Shanghai2000-07-14,121stations, not a post2020 network. Later facility activation and 2021memorial transitions pass actual-city script checks; later-date browser visuals require a suitable export/manual acceptance. No player save changed.
- Remaining candidates are P2/P3/deferred proposals (including Wukang); do not implement them automatically. User authorized syncing this branch to origin on 2026-11-16; no PR or external contact requested.

## Checks

- Final P1 focused check PASS, including real Shanghai walking graph access through nearby synthetic operating stations, old save/network/funds/ledger, ID/event invariants, monthly stages and actual renderer exclusion of the Jinjiang giant model. Final build/source verify and whitespace PASS; no player exports modified.

- P1 implementation baseline verify PASS; final focused actual-city/save checks, build and regressions are recorded at the end of DEVELOPMENT. Old checks below are retained as earlier-session evidence. Performance and future-date browser gaps above remain open.

- 3/4 shared-corridor follow-up: fixed diagram grouping that incorrectly required identical sampled curves at divergent endpoints. July/August 2010 Shanghai exports reproduce the failure; all three Zhongshan Park–Yishan Road pairs now have separate computed lanes in both modes (geographic gap 11 units; schematic endpoint gaps ≥12.5). Focused line-options, independent-track, replay, build, verify and whitespace checks PASS. Current live save and browser visuals remain unverified: Browser worker dependency missing; today’s 1997 export does not yet contain this line-4 corridor. Exports/player data untouched; changes uncommitted on same branch/base.

- Interrupted-session recovery: found a later `js/netmap.js` fix and focused regression for shared rails at divergent line endpoints (unequal sampled geometry). Focused line-options, independent-track, school-label, v27 and replay checks all PASS on the recovered files. Initial verify FAILED because the release manifest was stale; rebuilt successfully (106 files, 33,624,507 bytes, 85 HTML references), then source verify and whitespace checks PASS. No implementation repeated; browser visual inspection remains pending. Branch/base and uncommitted status unchanged.

- Line options: direct “一键升级所有车站” button added to map line details and operations management. Each eligible station upgrades one tier per click through one undoable draft step, respecting year locks and skipping maxed stations. Network diagrams now draw parallel lanes in both modes, with wider independent-track spacing, including mixed corridors. Focused line-options checks, v27/independent/replay regressions, build and verify PASS. Browser visual check unavailable (CUA browser access host unavailable). Changes remain uncommitted on the same branch/base.

- Turning-platform lane order: fixed topology-based continuous display direction, deterministic platform ordering and hover-preview alignment. `node scripts/check-independent-tracks.mjs` (six groups, including both turn directions, reversed segment storage and save restoration), v27 checks, school-label checks, build, verify and whitespace checks: PASS. Existing saves rebuild the corrected display without migration. Browser visual inspection remains unperformed; reload port 8001 preview to load the repair. Changes remain uncommitted; branch/base unchanged.

- School labels: `node scripts/check-school-labels.mjs`, `node scripts/build.mjs`, `node scripts/verify-game.mjs`, `git diff --check`: PASS. Browser fixture using actual Canvas drawFacilities visually checked (Fudan/SJTU visible); all four campuses checked for line spacing and collision height. Ordinary-map landmark/standalone labels checked with a synthetic layout. Existing port 8001 server serves the updated repository files; no player saves changed.

- `node scripts/verify-game.mjs`: PASS; version 2.7.2, maps 12, source files 103.
- `node scripts/build.mjs`: PASS; 106 output files and 85 HTML references checked.
- Tracked runtime source comparison to upstream/main: identical at the original baseline only; current drawing-controls changes are an explicit user-authorized exception to map-only scope.
- HTTP preview configuration matches local v2.7.2 source exactly.
- Independent-track follow-up: `node scripts/check-independent-tracks.mjs`, `node scripts/test-v27-fixes.mjs`, `node scripts/build.mjs`, `node scripts/verify-game.mjs` and `git diff --check`: PASS. Same-pair independent tracks inherit both endpoint platform angles from the earliest existing segment; reverse/bent connections and preview parity checked. Browser visual inspection of this follow-up remains unperformed.

## Open decisions

- P1 weights are explicitly conservative gameplay estimates; better same-campus/same-year statistics can refine them later. Current scope does not require exact headcounts or measured metro passenger forecasts.
- Future-date visual acceptance and complete comparable stable per-batch timing/jump measurements remain unverified under the120s cap.
- No upstream PR or external message has been sent.

## GitHub synchronization

User authorized origin/codex/shanghai-map publication. Current runtime, supporting records/skill/checks and diagnostic evidence are included; player save exports remain local/ignored. See latest DEVELOPMENT entry for verification and publication result.
