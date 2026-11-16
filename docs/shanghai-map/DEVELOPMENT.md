# Shanghai map development log

## 2026-11-16 — Establish clean upstream baseline

**Request:** Preserve existing work, restart from unmodified upstream, limit future changes to maps, and record development for agents.

**Actions:**
- Fetched upstream; latest main is `bd76a322970ae250b8920aed03fd7661a882342a` (v2.7.2).
- Saved the complete customized working state, including three untracked files, on `codex/archive-local-20261116` at `95fe2d1`.
- Created `codex/shanghai-map` directly from upstream/main in the existing directory. No customized commits were carried into its ancestry.
- Added `AGENTS.md`, this log, and `STATUS.md`. These documents are development aids; they are not game runtime changes.
- Rebuilt ignored `dist/` to replace the previous customized build.

**Decisions:** Keep the established working directory and localhost origin. Use a clean branch rather than duplicate the repository. Keep the archive local. Defer facility edits until a batch is selected.

**Verification:**
- `node scripts/verify-game.mjs`: PASS (`2.7.2`, 12 maps, 103 source files).
- `node scripts/build.mjs`: PASS (`dist`, 106 files, 33,614,896 bytes, 85 HTML references checked).
- `git diff --exit-code upstream/main -- .`: PASS before documentation commit; all tracked runtime files identical to upstream.
- HTTP GET `http://127.0.0.1:8001/js/config.js` with proxies bypassed: PASS; downloaded file exactly matches local baseline via `cmp`.
- Only added files are `AGENTS.md` and the two documents under `docs/shanghai-map/`.

## Candidate research — proposals, not implemented

| Candidate | Evidence | Modeling decision still needed |
| --- | --- | --- |
| Fudan Jiangwan | https://news.fudan.edu.cn/2017/0401/c54a67576/page.htm — 2005 first phase, later department moves | Start and growth curve; coordinate and entrance |
| SJTU Minhang | https://sjtuhistory.sjtu.edu.cn/info/1044/1304.htm — campus opened 1987 | Present at 1990 start; map-edge check; balance Xuhui weights |
| CPC First National Congress Memorial | https://www.shanghai.gov.cn/hsly/20260625/10d0e931417d4614b0d8bbbbd03495c1.html — site opened 1952; new hall opened 2021-06-03 | Retain early site demand; increase weight for new hall, avoid double counting |

Approximate map bounds from projection and 152×152 grid: longitude 121.31–121.7094, latitude 31.0763–31.42 (WGS-84). Check actual positions and land access before adding candidates.

## Entry format for subsequent work

Record: date / goal / changed files / facilities and stable IDs / factual sources and coordinate system / estimated values and rationale / verification commands and observed results / remaining work / commit reference.

## Contribution and attribution

- A contribution PR should contain Shanghai map work and necessary supporting files only.
- Use the contributor's intended Git author identity; check it before committing contribution code. Do not rewrite old history automatically.
- A merged contribution is evidence of upstream contribution, not repository membership or write access. Keep PR links, change summaries and verification evidence for a resume.
