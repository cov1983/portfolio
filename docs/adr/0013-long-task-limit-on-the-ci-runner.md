# ADR 0013 — The long-task limit is 150 ms on the CI runner, judged on the median of three runs

Status: Accepted (2026-10-13)

## Context

ADR 0010 set `limits.longTaskBetweenMarksMs` to 100 ms from the Q1 prototype's three runs on a
developer machine: the longest main-thread task between `title-screen-interactive` and
`world-playable` was 53 ms (median), 65 ms (maximum). T5b (#29) wrote the limit into
`perf/budget.json` and gated plan §7 line 1's condition (b) on it. On the CI runner (GitHub's shared
`ubuntu-latest`) the same line read:

- 99 ms on PR #48's perf job (run 38426648346), one pass under the strict `< 100 ms` bound;
- 268 ms, then 73 ms after the retry, on the first run on `main` (run 38430845094).

The shared runner varies 3–4× between runs for the same build. A single Lighthouse pass cannot tell
a slow chunk from a busy runner, and the runner's "retry once on a breach" (Phase 0b, decision 5)
is a best-of-two: it hides a real regression half the time and still flakes when both passes land
on a busy runner.

## Decision

- `limits.longTaskBetweenMarksMs` is **150 ms** on the CI runner: above the 99 ms the runner reads
  for the current chunk on an ordinary pass, under the 268 ms of a busy one, and three times
  Lighthouse's 50 ms long-task floor. The rule stays "no long task ≥ the limit between the marks".
- `make perf` runs **three** Lighthouse navigations and judges every gated line on the **median**
  of the three readings (the upper median of an even count; a run without a value counts as the
  worst reading). All three readings are printed next to each median, the informational lines
  included. A run that errors (an exception or a Lighthouse `runtimeError`, e.g. `NO_NAVSTART`) is
  retried once on its own and counts once; a breach is never retried. This replaces "retry once".

This supersedes ADR 0010's number (100 ms) only. ADR 0010's pre-rendering, its single `world` chunk
and its reasoning about the long-task floor stand.

## Consequences

- The limit returns to 100 ms through the Rapier-on-mount chunk split (ADR 0010's `WorldSplit.tsx`
  prototype), a later ticket; that ticket measures on the runner with this median gate.
- The perf job runs three navigations instead of one or two, so it takes longer (each navigation
  waits at least 5.25 s of quiet, plan §7 line 2).
- One busy pass no longer fails the gate; two do. The log carries every reading, so a drift that
  stays under the limit is still visible to the Owner across PRs.
- Each run's Lighthouse result is kept as `.lighthouse/lhr-<run>.json` (a retried run also as
  `lhr-<run>-retry.json`) in the CI artifact.
