# ADR 0014 — The perf runner warms up first and retries a run that is not a measurement

Status: Accepted (2026-10-19). Supersedes the retry sentence of ADR 0013's Decision ("A run that
errors … is retried once on its own") only; the 150 ms limit and the median of three runs stand.

## Context

The perf job failed on the runner, not on the code: on #54, twice on #57 and on the merge of #57
to `main` (76969a5), where the red check held the Vercel promotion and thomascova.dev lagged `main`
for three days. The perf job of the eleven CI runs of 2026-10-14 to 2026-10-16 (33 Lighthouse runs)
shows the shape:

| observation | count | readings |
|---|---|---|
| run 1 (cold) is the job's worst long-task reading | 11 of 11 | 711 · 87 · 351 · 152 · 170 · 147 · 554 · 246 · 109 · 238 · 63 ms |
| run 1 alone breaches the 150 ms limit | 7 of 11 | the median survives only while the other two runs are valid |
| trace lost on every audit (NO_NAVSTART on each, no top-level runtimeError) | 1 of 33, and #54 before | every gated line n/a; not retried, ADR 0013 retried a runtimeError only |
| main thread lost after hydration: both marks present, TTI ≈ 210 ms, longest task 0 ms, TBT 0 ms | 2 of 33 | counted as the *best* reading |

A cold run plus one invalid run decides the median against the code. Each Lighthouse run launches
a fresh Chrome, so what warms is outside the profile: the OS file cache, the preview server,
Chromium's binary.

The ticket asked for "TTI below its own world-playable mark" as a sanity check. In every valid run
TTI is below the mark: Lighthouse's TTI is the end of the last long task before its quiet window,
and `world-playable` is recorded on the next frame after Rapier's init. The gap is 0–197 ms over
the 30 valid runs (median about 50 ms); the two broken runs read 1034 and 1100 ms. A strict check
would have invalidated every run.

## Decision

- `make perf` runs one **warm-up navigation** before the three measured runs, exactly like a
  measured run (same Chrome flags, same Lighthouse config). Its readings are printed under
  "warm-up (discarded)" for information; it is never judged, retried or counted.
- A run is **invalid** (`invalidReason` in `scripts/perf/budget.ts`) when
  1. no gated line has a reading: an exception, a Lighthouse `runtimeError`, or NO_NAVSTART (any
     trace error) on every trace audit;
  2. TTI is more than **500 ms** before `world-playable` (`TTI_BEFORE_PLAYABLE_TOLERANCE_MS`: 2.5×
     the largest legitimate gap, half the smallest broken one);
  3. the longest task between the marks reads **0 ms** with a non-zero playable time. No tolerance:
     Lighthouse's long-task floor is 50 ms, so a reading is 0 or ≥ 50, and every valid run read
     52 ms or more.
  The checks run in this order: rule 1; then a gated line that reads and breaches makes the run a
  measurement, so a breach is never retried, whatever its TTI gap or long-task reading; then rules
  2 and 3. One missing gated reading alone is ADR 0013's worst reading, not an invalid run. Rule 3's
  reason names this ADR and #60, so a job that trips it after the chunk split explains itself.
- An invalid run is **retried once** on its own; the retry counts as it came out. Invalid twice,
  the run **counts as the worst reading** (no reading on any line, sorted above every number by
  `medianOf`; #50 Q1 stands). The rule and the bookkeeping are pure (`settleRun`), unit-tested on
  stubbed runs; the Lighthouse driver only loops.
- The printout names the warm-up as discarded, each retried run with its reason, and a run counted
  as the worst reading, in a summary line under the median's heading; a discarded attempt prints
  its readings and Lighthouse's own account, so nothing measured leaves the log.

## Consequences

- The job runs 4 to 7 navigations instead of 3 (1 warm-up + 3 runs + at most 3 retries), about
  20 s each on the runner; typically 4. No further cap: "once" bounds it.
- Rules 2 and 3 assume the World chunk's evaluation is a long task, which holds for the single
  `world` chunk and which the Rapier-on-mount chunk split (#60, the "later ticket" of ADR 0013)
  sets out to break. #60 re-derives both rules from the CI log after the split and drops or
  re-bases them. Should 0 ms become the norm before that, every run goes invalid and the job fails
  loudly, never silently.
- The tolerance lives in the evaluator with its data, not in `perf/budget.json`: it is a sanity
  bound on the runner, not a budget line.
- Artifacts: `.lighthouse/lhr-warmup.json`, `lhr-<run>.json`, a retry's `lhr-<run>-retry.json`.
- The CI job is unchanged: it runs `make perf` and uploads `.lighthouse/`.
