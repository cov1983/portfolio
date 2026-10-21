# ADR 0015 — Retro fold 2: where the increment-1 lessons went

Status: Accepted (2026-10-22)

## Context

Guide §4.0.3 and `docs/retro.md` say that every 3–5 tickets the "rule I would add" column is
converted into something executable: a `CLAUDE.md` rule, an edit to a skill we own, a lint rule, a
test or a CI gate. Twenty-two rows accumulated between 2026-10-10 (chore/retro-fold, the fold-1
ticket itself) and 2026-10-21 (T10 #35, increment-1 live): the fold-1 follow-ups, the increment-1
plan, the tickets T0–T10, the perf-gate tickets #49 and #58, the Firefox-poll diagnosis #46, the
Banner #55, the mockup preview #66 and #70. T10 counted them past the window and the Owner made the
fold its own ticket (#76; plan `docs/plan/retro-fold-2.md`, accepted in plan mode 2026-10-21, the
nine open questions answered Q1–Q9 = A on #76). Two sources outside the rows: PR #73's three
`ai-review` rounds and the Owner's comment on #76 from the #77 review (ratchet toolchain drift; the
index-vs-spec question). Every item was re-checked against the surfaces as they were at `main`
2f0fa1e: `CLAUDE.md` (150 lines, the cap), `.claude/settings.json`, the guard hook and its 19
fixtures, `ci.yml`, the Makefile, `scripts/`, `tests/`, the agent docs and the vendored skills.
Retro rows are never edited; this record carries the verdicts.

Three constraints shaped the fold. `CLAUDE.md` sits at its 150-line cap, so every rule that went
there replaced a line with a line (fourteen lines, no line added or freed). Rules that belong to a
skill's way of working got three new sections in `docs/agents/skill-overrides.md` ("Plans and
probes", "`/tdd` in this repo", "`/diagnosing-bugs`"), each sentence citing its retro line, and
`/phase` carries the instruction with a pointer, not the enumeration. And the Owner opened exactly
three protected paths for this ticket: `.claude/commands/phase.md`, `.claude/hooks/tests/` and the
`ai-review` job of `.github/workflows/ci.yml`; `.claude/hooks/guard-bash.sh` (#62) and
`.claude/commands/fix-review.md` stayed closed.

**Count:** 66 items: 62 rules and 1 pointer from the 22 rows, the bounded-rounds rule from PR #73
and the two items of the #76 comment. The table sums to 53 fold · 11 enforced · 2 obsolete.

## Decision

Legend: **enforced** = already a hook, gate, test, config or `CLAUDE.md` rule, marked only (cited) ·
**fold** = made executable or written down in this PR · **obsolete** = one-off, recorded elsewhere.
"so" = `docs/agents/skill-overrides.md`; "fixtures header" = the craft-rules block in
`tests/e2e/fixtures.ts`. Rows 1–63 follow `docs/retro.md` order.

| # | row | lesson ("rule I would add") | verdict | becomes |
|---|---|---|---|---|
| 1 | chore/retro-fold | a new deny fixture is run against the previous hook first and must fail there | fold | `.claude/hooks/tests/run.sh --prove <fixture> [previous-hook]`: a denied-* fixture must be allowed by `git show HEAD:…/guard-bash.sh` and denied by the working tree, an allowed-* fixture the reverse; "already denied at HEAD" is a FAIL; local only, `make test-shell` unchanged (Q7); so `/tdd` |
| 2 | chore/retro-fold | a regex gate's delimiter classes are listed in a comment next to the fixtures that cover them | fold | `run.sh` header: the dotenv class of `guard-bash.sh:26` with the fixtures covering each side, and `allowed-env-example` as the template normalisation, not the class |
| 3 | fix/ai-review-output | a job running a third-party agent uploads its execution file as an artifact when the step fails | fold | `ci.yml` `ai-review`: `id: review`; "Upload review execution file on failure", `actions/upload-artifact` (the sha already pinned in the file), `if: failure() && steps.review.outputs.execution_file != ''`, `ai-review-execution`, 14 days (Q6). Read at the pinned action commit: `run-claude-sdk.ts:222` writes the file before every failure throw, `run.ts:318` sets the output in its catch before `setFailed` at 324 |
| 4 | fix/ai-review-output | full output is a one-run diagnosis switch on a branch, never merged | enforced | `ci.yml`: no `show_full_output`; the sentence in so `/diagnosing-bugs` |
| 5 | docs/plan-increment-1 | an open question whose answer lands in an ADR is answered before that ADR is accepted | fold | `docs/agents/domain.md` "ADRs and the plan rows that cite them"; so "Plans and probes" |
| 6 | docs/plan-increment-1 | a plan PR has its ticket number and retro line before `/code-review` | fold | `CLAUDE.md` Working protocol: the retro line is appended before `/code-review` runs |
| 7 | T0 #23 | an expected-failure test fails only through the thing under test, never through a wait on it | fold | so `/tdd` |
| 8 | T0 #23 | a test-infrastructure change is run against a stub first so its red proves the check | fold | so `/tdd` |
| 9 | T1 #24 | a numeric tolerance is derived from the model's equations when the row is written | fold | so "Plans and probes" (the single home of the row-level rules; `/phase` step 5 points there and says a plan that skips one says why) |
| 10 | T1 #24 | a contract's callbacks are function-typed properties, never method signatures | fold | `eslint.config.js`: `@typescript-eslint/method-signature-style: ['error', 'property']` (Q1). With the rule on, `make lint` reported 12 method signatures in four files, not the 11 in three the plan's grep found (the twelfth an inline type literal in `scripts/links/check.ts`); all 12 converted in the same commit |
| 11 | T1 #24 | a CI-compared file is named next to its twin in the map; `make verify` runs the comparison | enforced | `CLAUDE.md` map (`AGENTS.md` line); `make agent-docs` in `verify`; the `lint` job |
| 12 | T2 #25 | a relative tolerance names its normaliser in the plan row | fold | so "Plans and probes" (as 9) |
| 13 | T2 #25 | a proof-only test green on its first run cites the negative case that shows it can fail | fold | `CLAUDE.md` Tests: "a proof shows its red"; so `/tdd` |
| 14 | T2 #25 | a rebound assertion names the obstacle it expects, never only the sign flip | fold | so `/tdd` |
| 15 | T3 #26 | a dependency row names the version it was researched against; the installing ticket re-checks it | fold | `CLAUDE.md` Dependencies; so "Plans and probes" (as 9) |
| 16 | T3 #26 | a synchronous contract names where its asynchronous inputs are gathered | fold | so "Plans and probes" |
| 17 | T4 #27 | a plan statement about a tool's behaviour is checked against the tool's source by the first dependent ticket | fold | `/phase` step 5 ("a premise the plan rests on is probed before it becomes a design, with the result in the plan"); so "Plans and probes" |
| 18 | T4 #27 | a spawned production build sets `NODE_ENV` explicitly | enforced | `tests/build/production-build.ts` (`NODE_ENV: 'production'` on the spawn) |
| 19 | T4 #27 | markup a document must not contain is never removed; the document is written without it | obsolete | recorded in `build/prerender.ts` (`fallbackShell`) |
| 20 | T5a #28 | what a library emits is read in the production bundle before the test that depends on it | fold | so "Plans and probes" |
| 21 | T5b #29 | a visibility assertion on a container names what gives it a box | fold | fixtures header (`worldContainer`) |
| 22 | T5b #29 | a threshold an ADR measures is reconciled in every plan row that cites it at acceptance | fold | `docs/agents/domain.md`; so "Plans and probes" |
| 23 | T5b #29 | a code path written for a later ticket is that ticket's first risk, exercised first | fold | so "Plans and probes" (as 9) |
| 24 | T5b #29 | an import that navigation can abort is proven against navigation-away in all three browsers | enforced | `src/app/App.tsx` (the beforeunload signal); `tests/e2e/title-screen.spec.ts` "each Exhibit list entry navigates" under the fixture, three projects |
| 25 | #49 | a limit that gates CI is measured on the CI runner over at least three runs | enforced | ADR 0013; `perf/budget.json` |
| 26 | #49 | a gate on a noisy reading judges the median, never a best-of | enforced | `scripts/perf-budget.ts`; `scripts/perf/budget.ts` `medianOf` |
| 27 | #49 | a secret pattern in the guard hook is anchored on a word boundary | fold | #62 cited, stays open as its own ticket (Q2); its comment of 2026-10-21 records the fourth firing, a read-only command naming the ADR 0013 file, with the command and the hook's answer verbatim. `guard-bash.sh` untouched here |
| 28 | #46 | an `expect.poll` predicate uses only non-waiting reads | fold | fixtures header; so `/tdd` points there |
| 29 | #46 | read a poll's error text before calling a timeout slow | fold | so `/diagnosing-bugs` |
| 30 | #46 | a stress run is compared against the same run on main before its failures count | fold | so `/diagnosing-bugs` |
| 31 | T6 #30 | a plan naming an AC for a media kind checks the real content has one before choosing the seam | fold | so "Plans and probes" |
| 32 | T6 #30 | a focus trap on a native modal is proven by a Tab test in all three projects | enforced | `tests/e2e/exhibit-panel.spec.ts` (Tab and Shift+Tab) |
| 33 | T6 #30 | the plan comment is the first action after approval when plan mode held it back | fold | `CLAUDE.md` Working protocol ("as the first action after approval"); `/phase` step 6 |
| 34 | T7 #31 | a placeholder is as long as the real content it stands in for | fold | so `/tdd` |
| 35 | T7 #31 | a test helper's name says what it builds from | fold | fixtures header |
| 36 | T7 #31 | the perf runner retries a run whose gated audits all errored like a runtimeError | enforced | ADR 0014; `scripts/perf-budget.ts` (`invalidReason`) |
| 37 | T7 #31 | a test that drives to a target has a bound tied to its claim (model time), never a wall-clock timeout | fold | fixtures header (`modelTime`); so `/tdd` |
| 38 | #55 | a processing parameter chosen before the source is measured is checked against the source's statistics | fold | so "Plans and probes" |
| 39 | #55 | a texture under the bundler's inline limit is checked against the CSP's `img-src` | fold | `tests/build/chunk-checks.ts` `dataUrls()` with two positive unit cases (the red) and one negative; `tests/build/chunks.test.ts` reads every `.js` and `.css` under the build's `assets/`, named for the CSP's `'self'` sources since fonts and media are caught too (Q5). The real build carries no `data:` URL, so the pattern stays unnarrowed |
| 40 | #55 | a licence claim for a third-party asset is taken from its source page before it enters a plan | fold | `CLAUDE.md` Third-party code (`assets/ice/SOURCE.md` is the instance) |
| 41 | T8a #32 | a timer an e2e must control runs on an injected host and is mutated once before it counts | fold | so `/tdd` |
| 42 | T8a #32 | `page.clock` is installed after any user-timing mark a helper polls | enforced | `tests/e2e/announcer.spec.ts`; the fixtures header repeats the sentence |
| 43 | T8a #32 | an Owner confirmation is cited only after it exists on the tracker, read back before use | fold | `docs/agents/issue-tracker.md`; `CLAUDE.md` Working protocol; `/phase` step 6 |
| 44 | T8a #32 | a timer test bounds its absence check under the timer's real duration, mutation-checked | fold | so `/tdd` |
| 45 | T8a #32 | a live region's text arrives after its container leaves `inert` | enforced | `tests/e2e/announcer.spec.ts` (AC-18.2) |
| 46 | #58 | a sanity check on a reading is derived from the readings of passing runs in the CI log | fold | so "Plans and probes" (probe shape) |
| 47 | #58 | a gate change that waits on the runner states its acceptance as runs on main after merge | fold | `.github/pull_request_template.md` Reviewer notes: the post-merge checks prompt (Q9) |
| 48 | T8b #33 | a plan premise about a tool's capability is probed against the installed tool before it becomes a design | fold | `/phase` step 5; so "Plans and probes" (decision 1) |
| 49 | T8b #33 | a capability probe asks for exactly what the renderer asks for, read in its source | fold | so "Plans and probes" |
| 50 | T8b #33 | a spec sentence the code outgrows is amended in the PR that outgrows it | fold | `docs/spec/README.md`, the approval bullet (Q4) |
| 51 | T8b #33 | an e2e that breaks a request consumes the browser's own console line, per browser, after the page's | fold | fixtures header |
| 52 | T8b #33 | a library that logs before it throws is consumed as a named second line, never silenced | fold | fixtures header (`expectRecorded`) |
| 53 | T8b #33 | a chained command gates a commit on the runner's exit status, never on a grep of its output | fold | `CLAUDE.md` Working protocol ("commit on its exit status") |
| 54 | #66 | a claim that a repo-wide tool reaches a folder is checked by running it read-only first, result in the plan | fold | `/phase` step 5; so "Plans and probes" |
| 55 | #70 | a Vercel Root Directory carries its own `vercel.json` | enforced | `docs/runbooks/mockup-preview.md` and `mockups/project-discovery/vercel.json`; the rule's wording in 56 |
| 56 | #70 | a dashboard setting the agent cannot see is written into a runbook from the Owner's words, with the deploy check that proves it | fold | so `/wizard`, with 55 as cause and effect: a Root Directory carries its own `vercel.json`, because without one Vercel applies the repository root's (the mockup project's first two deploys failed that way, runbook lines 28–29) |
| 57 | T9 #34 | a probe that needs a server and a browser is a scratchpad file run against a server the Owner starts | fold | so "Plans and probes" (probe shape); a pointer sentence in `/prototype` |
| 58 | T9 #34 | a denied command is quoted verbatim in the next report | fold | `CLAUDE.md` Boundaries, last bullet |
| 59 | T9 #34 | a plan names the engine it suspects as a question; the probe answers it | fold | so "Plans and probes" |
| 60 | T10 #35 | a ticket conditioned on "if N rows" takes its count at planning time; past the window it is a hand-off | fold | `docs/retro.md` header; `/phase` step 5 |
| 61 | T10 #35 | a status line is rewritten with every neighbouring claim the same event made stale | fold | `CLAUDE.md` Docs convention |
| 62 | T10 #35 | a ratchet raise is proven by two runs on the new floor, the lower reading committed | fold | `CLAUDE.md` Coverage ratchet |
| 63 | T10 #35 | "fold 2 starts from the 22 rows up to this one (#76)" | obsolete | a pointer: this ticket |
| 64 | PR #73 | `ai-review` rounds are bounded: one fix commit per round, at most two rounds, then a follow-up issue (round 1 → dbf3ffd, round 2 → c895ee8, round 3 → #74 and one finding on record) | fold | `CLAUDE.md` Working protocol; the PR template's Definition of Done; decision 3. `/fix-review` untouched: its step 3 defers to `CLAUDE.md` (Q3) |
| 65 | #76 comment | a `test` failure on a Renovate PR with no `src/` change is read as ratchet toolchain drift first; an ADR lowers the floor, never a silent edit or a toolchain pin | fold | `CLAUDE.md` Coverage ratchet, as a clause; the full rule in the `vitest.config.ts` thresholds comment and so `/diagnosing-bugs` |
| 66 | #76 comment | does the rule sentence of `docs/spec/README.md` cover the index itself? | fold (answer: no) | `scripts/spec-freeze.sh` freezes a `docs/spec/*.md` whose first line at the merge base reads `Status: approved` or `amended`; the index has no status line and #77 edited it in a plain commit, green. `docs/spec/README.md` says so, and its rule sentence now says "a spec file", not "this directory" (Q4) |

Three of the folds change the workflow and are the decision proper:

1. **A premise is probed before it becomes a design.** What a tool does, what the installed tool can
   do and what a repo-wide tool reaches are read in the source or tried, with the result in the plan,
   before a task rests on them; `/phase` step 5 carries the instruction and the row-level rules
   (tolerances, dependency rows, probe shapes, a later ticket's code path) live once, under "Plans
   and probes" in `docs/agents/skill-overrides.md`. A plan that skips one says why (items 9, 12,
   15–17, 20, 23, 31, 38, 46, 48, 49, 54, 57, 59).
2. **A proof shows its red before it counts.** A test green on arrival cites the case that fails it;
   an expected failure can only fail through the thing under test; a new hook fixture is run against
   the committed hook (`run.sh --prove`) and must be wrong there; a controlled timer is mutated once.
   Two of the folds are executable: the lint rule that keeps a contract's callbacks function-typed
   and the build case that keeps `data:` URLs out of the chunks (items 1, 7, 8, 10, 13, 37, 39, 41,
   44).
3. **`ai-review` rounds are bounded.** One fix commit per round, at most two rounds; what the third
   pass still finds goes to a follow-up issue or on record, and the PR merges on its green. The
   failing step's execution file is an artifact, so the first failure explains itself (items 3, 64).

## Consequences

- Each rule folded here is on probation, as fold 1's were: a rule that never fires again after two
  more folds is deleted (guide §4.0.3). Fold-1 carry-over, checked in the plan's §2: fired since
  2026-10-10 are ADR 0008's rules 1 (the secret tier, four times on the ADR 0013 file name, a false
  positive tracked as #62), 2 and 22 (the devcontainer), 3, 14 and 16 (a denied call is never worked
  around), 11 (no GPU), 12 and 15 (the spec gate, three `amend:` commits), 18 (hand-offs with an
  issue: #52, #33, #63, #76, #74), 20 (peer ranges), 26 (the plan leaves the chat), 27 and 31 (the
  shell tests, every verify), 28 (action inputs against source), 29 (`gh api` settings), 32
  (shellcheck). Not fired yet: 6 (`/wizard` dotenv), 7 (skill review at install), 9 (grilling
  outcomes), 10 (`/prototype` numeric first), 13 (`/to-spec` as a comment), 17 (the amendment's
  principle), 21 (the formatter never touches `docs/spec/**`: silent, no spec reformatted), 23
  (actionlint), 25 (scanner fixtures). The clean-worktree action (4, 30) has failed
  no job and was applied once (#55's `.gitignore`). Nothing deleted here; fold 3 reviews the not-fired
  list for deletion and the fold-2 rules for a first firing.
- `CLAUDE.md` is at its 150-line cap: this fold replaced fourteen lines with longer lines and added
  none, so a fold now adds width, not lines. Freeing lines (the `mockups/` map line is #70's open
  point) is a fold-3 candidate, together with the #62 fix and #74.
- `make lint` now rejects a method signature in an interface or type literal; a class method still
  satisfies a function-typed property, so implementers did not change. A new contract written as
  methods goes red on the first `make verify`, which is the point.
- The `ai-review-execution` artifact holds the review's messages and tool results: the output of
  the four read-only `gh` commands the step allows (`gh pr view`, `gh pr diff`, `gh pr checks`,
  `gh issue view`), public PR text that never carries either secret as an argument. The runner
  masks logs, not artifacts, so the file is as plain as its inputs; a wider tool list would need
  this sentence rechecked. Uploaded only on a failed step, kept 14 days like the other artifacts.
- `run.sh --prove` reads the committed hook through `git show HEAD:`, so it runs in a clone only;
  `make test-shell` and the `lint` job are unchanged and still prove every fixture against the
  working-tree hook.
- The build case reads every chunk and stylesheet, three and Rapier included; a library that one day
  ships a `data:` URL of its own turns it red, and the answer then is to narrow the pattern to
  `data:image/` and record the exemption in the test header (Q5), not to drop the case.
- Reversible per item: turn the lint rule off (the 12 converted signatures stay valid), delete the
  upload step, drop `--prove` from `run.sh`, remove the build case, revert the doc sentences. The
  retro rows stay as they are.
