# Road Early Stop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate a conservative Dijkstra stopping condition with exactly unchanged traffic and business results and four road Workers, on `performance`.

**Architecture:** Retain the current heap, tie rules, connector selection and 32-block accumulation order. Once each requested destination has a settled access, its total time gives an upper bound; stop only when the next road distance strictly exceeds the maximum bound. Retain the original all-target stop as well. Use an isolated candidate until differential checks pass; reject a slower candidate rather than ship speculative code.

**Tech Stack:** JavaScript, Node VM differential tests, visible isolated Chrome for Testing/CDP.

**Spec:** User request in this chat, 2026-11-17; exact-result constraints in `evidence/road-workers/KERNEL-FINDINGS.md`.

## Global Constraints

- Branch `performance`; preserve all preexisting work; no push or PR.
- Four road Workers, unchanged iterations, demand, numeric types, heap tie rules and accumulation order.
- Compare traffic arrays, business metrics, ledger and clocks exactly before reporting a validated gameplay speedup.
- Browser preparation/acceptance has one 120-second budget; leave isolated scene open and paused.

## Review Focus

- Equal-cost alternatives/zero connector times: strict stopping inequality retains original winner.
- Disconnected access nodes: one reachable access suffices, entirely unreachable destinations still exhaust the heap.
- Multiple destinations sharing an access: update each requested destination once.
- Worker/main-thread parity and failure fallback: same functions and original fixed blocks.
- Graph/layout changes and stale workspace: target stamps and inverse access maps follow graph lifetime.

### Task 1: Prove and measure an isolated candidate

**Files:** Create `evidence/road-workers/early-stop.mjs` (candidate factory), `scripts/check-road-early-stop.mjs` (synthetic differential checks); extend offline capture only through a separate experimental runner.

**Interfaces:** factory consumes baseline `carTree/carOriginRow/carWork` functions and returns matching signatures; no production hook/config option.

- [ ] Write synthetic fixtures for ties, disconnected/shared accesses, graph replacement, repeated workspace reuse and randomized graphs. Require byte-equal time/km/flow outputs and demonstrated fewer settled nodes in a deliberate redundant-access case.
- [ ] Run `node scripts/check-road-early-stop.mjs`; expected initial FAIL for missing candidate, then PASS after implementation.
- [ ] Replay real first road allocation with fixed blocks, alternating baseline/candidate runs and exact hashes. Expected no differences; record actual work and wall times. Reject or revise only with concrete evidence.

### Task 2: End-to-end four-Worker comparison and disposition

**Files:** Create bounded evidence runner/report; modify `js/sim.js` only if measured candidate is worthwhile and exact checks pass, then regenerate build metadata. Update handoff/log.

**Interfaces:** consumes Task1 functions; browser runner serves original/candidate JS in isolated pages without changing player data; compare complete typed period arrays, snapshot metrics, ledger and clocks; assert actual pools4/2/2 and no fallback.

- [ ] Run visible isolated Chrome for Testing comparisons within120seconds total, using the configured read-only fixture, same initial scene and actual asynchronous jump path. Expected exact snapshot equality; report actual timing, repetitions and any missing coverage.
- [ ] If adopting, run focused checks, `node scripts/build.mjs`, `node scripts/verify-game.mjs`, relevant replay checks and whitespace. If rejecting, keep production source unchanged and document measured reason.
- [ ] Review stop proof and differential coverage separately from implementation; record outcome, branch, checks and remaining limits in STATUS/DEVELOPMENT. No commit/push required by this experiment.

Execution ruling: the user explicitly authorized continuing validation and execution; no extra plan-approval pause. This is a bounded experiment, not an authorization to merge or publish. Supporting skill scripts referenced by executing-plans are absent locally; keep progress in this plan and DEVELOPMENT instead.

## Execution record

- Task1 complete: missing-module RED,3,216row GREEN;seven alternating real passes/configuration exact;3.6%fewer settlements but0.571%longer median.
- Task2 attempted, production promotion declined: one browser pair's232arrays/20metrics/ledger/clocks exact, incomplete/unclean repeat evidence. Initial115.61s attempt then user-authorized116.234s refresh retry;second has no completed cases. No third retry. Full browser speed/equality acceptance pending;do not label this task's acceptance complete.
- Independent review completed;source-proof/error-gating evidence fixes applied,negative/rounding fixtures GREEN. Worker graph replacement/failure integration remains a production-adoption gap. No runtime patch/build/commit/push.
- Ruling: keep prototype/evidence only rather than promote an unproven optimization;cost is foregoing a possible small benefit until clean repeated acceptance exists. No deferred cosmetic findings.
