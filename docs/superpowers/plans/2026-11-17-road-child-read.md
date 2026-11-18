# Road Child Read Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Test caching a selected child key within each downheap step, with exactly equal old/new outputs and four road Workers on `performance`.

**Architecture:** Keep original binary heap, strict right<left choice, child>=last stop, movement order and every arithmetic operation. Cache left/right keys in local variables and reuse the selected key rather than rereading `keys[child]`. Candidate stays in an isolated source transform until kernel and full-game evidence justify adoption.

**Tech Stack:** JavaScript/Node differential replay; visible isolated Chrome for Testing within120seconds.

**Spec:** Current user request for exactly equal new/old traffic/business/ledger data and measured speed; previous findings in HEAP-PARAMETERS.md.

## Global Constraints

- `performance`,four road Workers,unchanged demand/iterations/precision/32blocks/ties and sums;preserve prior work,no push/PR.
- Exact full outputs before performance claims;errors/fallback invalidate browser acceptance.
- Use independent browser profile/read-only fixture and one120second budget;leave final scene open.

## Review Focus

- Equal keys and single-left-child heaps retain exact selection.
- All internal typed work arrays/order/predecessors match,not just total cost.
- Worker source actually applies candidate,and all4workers acknowledge it;no fallback.
- New/old starting/end clocks,all period arrays,metrics and ledger equal.
- Timing excludes comparisons/hashing and records repeated alternate order/spread.

### Task1: Isolated candidate and differential measurement

**Files:** `evidence/road-workers/child-read.mjs`,`scripts/check-road-child-read.mjs`,kernel evidence.

- [ ] Add focused byte equality checks;observe missing-module RED,implement source transform,then GREEN.
- [ ] Replay real cached allocation with alternate warm passes and pinned complete output signatures;record min/median/max. No instrumentation inside timed loops.

### Task2: Full-game four-Worker comparison and disposition

**Files:** dedicated bounded browser experiment/report;STATUS/DEVELOPMENT and findings.

- [ ] Load code once in isolated visible Chrome;switch only road Worker blob source between variants before restoring the same export. Assert per-result variant acknowledgments from all4workers,actualpool4/2/2,off=false.
- [ ] Exact before/after traffic arrays,20metrics,ledger and clock;repeat alternate original/candidate quarter/boundary cases within120seconds. Hash outside timed jump interval. Record incomplete cases honestly.
- [ ] Independent review,required checks,then adopt only if exact results and measured benefit support it. Build/verify if production changes;otherwise docs/evidence only. No commit required.

Execution authorized by explicit user request;continue inline without another plan-approval pause. Local executor helper scripts absent as previously documented;progress lives here and DEVELOPMENT.

## Execution record

- Task1 complete:missing-module RED→3,216row/workspace GREEN;11realallocation passes/config exact;718.804→710.296ms median(-1.184%).
- Task2 complete as a bounded experiment:6browser cases/3pairs,all232arrays/20metrics/25keyeconomy/periodstats/ledger/network/clocks exactlyequal;actual4Worker source/ackproof,0errors,116.721seconds. Twoquarterpairs+oneboundarypair,mixedtimings. Reports CHILD-READ.md and child-read-browser-AyvbsF.
- Independentreview:no correctnessblocker;full modelcache/allinput/failure-integration and explicitseededNaN/signedzero fixtures not covered,scope disclosed. All required implementedchecksPASS.
- Ruling:do notpromote because observedgameplaydifferencesdonotshowstablebenefit;costisforegoingapossiblesmallworkload-specificgainuntil stronger measurements exist. Production unchanged,no build/commit/push/PR.
