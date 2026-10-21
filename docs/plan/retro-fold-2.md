# Plan: retro fold 2 — the increment-1 lessons (#76)

Status: accepted by the Owner on 2026-10-21 in the plan-mode review, with four changes folded in (item
27 is a fold that cites #62; the bounded-rounds sentence reads "one fix commit per round, at most two
rounds, then a follow-up issue"; the docs commit is split in three; a denied command is quoted verbatim,
not only the hook's error line). The open questions Q1–Q9 of §6 are answered on #76. A process plan for
guide §4.0.3, not a feature plan, so there is no `plan: approve` commit. Ticket #76, branch
`chore/retro-fold-2`, one PR `chore(retro): fold the increment-1 lessons`. The fold table of record is
ADR 0015; this file carries the inventory the ADR is cut from, the fold-1 probation check and the
commit order.

This file is the plan of record because the fold changes the process (the hook test runner, a CI step,
`/phase`, the lint rules), which is the case `/phase` step 6 names for a committed plan.

## Context

`docs/retro.md` holds 22 rows since ADR 0008 (2026-10-10 chore/retro-fold … 2026-10-21 T10 #35). T10
counted them past the 3–5 window and the Owner made the fold its own ticket (#76, Q1 = A on #35).
Two sources outside the rows: PR #73's three `ai-review` rounds and the Owner's comment on #76 from #77.
Every "rule I would add" item was re-checked against the surfaces as they are today: `CLAUDE.md`
(150 lines, the cap; `AGENTS.md` identical), `.claude/settings.json`, the guard hook and its 19
fixtures, `ci.yml`, the Makefile, `scripts/`, `tests/`, the agent docs, the vendored skills.

**Count:** 66 items, against the issue's "about 60": 62 rules and 1 pointer from the 22 rows (63), plus
the bounded-rounds rule from PR #73 and the two items of the #76 comment (ratchet toolchain drift; the
index-vs-spec question). Provisional verdicts, the table summed as written: 53 fold · 11 enforced · 2 obsolete.

Denied in the planning session (the guard hook's API-key pattern, #62, on a read-only command that
named the ADR 0013 file, the fourth time since #49). The command as the audit log recorded it, then
the hook's answer, both verbatim:

```
echo '--- audit log tail'; tail -5 .claude/audit.log; echo '--- git remote/branch'; git remote -v | head -2; git branch --show-current; git log --oneline -1; echo '--- adr 0013/0014 heads'; sed -n 1,12p docs/adr/0013-long-task-limit-on-the-ci-runner.md; echo; sed -n 1,12p docs/adr/0014-perf-runner-warm-up-and-invalid-run-retry.md; echo '--- runbook mockup-preview head'; sed -n 1,15p docs/runbooks/mockup-preview.md
```

```
PreToolUse:Bash hook error: guard-bash: API secret key in command.
```

## 1. Inventory

Legend: **enforced** = a hook, gate, test, config or `CLAUDE.md` rule already does it (cited) ·
**fold** = made executable or written down in this PR · **obsolete** = one-off, recorded elsewhere.
"so" = `docs/agents/skill-overrides.md`. Items 1–63 are the rows in `docs/retro.md` order.

| # | row | lesson ("rule I would add") | verdict | destination / evidence |
|---|---|---|---|---|
| 1 | 10-10 chore/retro-fold | a new deny fixture is run against the previous hook first and must fail there | fold | `.claude/hooks/tests/run.sh --prove <fixture>`: the fixture against `git show HEAD:…/guard-bash.sh` (must allow) and the working tree (must deny); so `/tdd` |
| 2 | chore/retro-fold | a regex gate's delimiter classes are listed in a comment next to the fixtures that cover them | fold | `run.sh` header: the dotenv class of `guard-bash.sh:26` and the fixtures that cover it (`allowed-env-example`, `allowed-process-env`, `denied`) |
| 3 | 10-10 fix/ai-review-output | a job running a third-party agent uploads its execution file as an artifact when the step fails | fold | `ci.yml` `ai-review`: `id: review` on the action step, `actions/upload-artifact` `if: failure()` of `steps.review.outputs.execution_file` (the action's output, `action.yml:173-175` at the pinned commit) |
| 4 | fix/ai-review-output | full output is a one-run diagnosis switch on a branch, never merged | enforced | `ci.yml:251-282`: no `show_full_output`; sentence in so `/diagnosing-bugs` |
| 5 | 10-10 docs/plan-increment-1 | an open question whose answer lands in an ADR is answered before that ADR is accepted | fold | `docs/agents/domain.md` (ADR paragraph); so "Plans and probes" |
| 6 | docs/plan-increment-1 | a plan PR has its ticket number and retro line before `/code-review` | fold | `CLAUDE.md:139-140` (retro line "appended before `/code-review` runs"), line-neutral |
| 7 | 10-11 T0 #23 | an expected-failure test fails only through the thing under test, never through a wait on it | fold | so `/tdd` |
| 8 | T0 #23 | a test-infrastructure change is run against a stub first so its red proves the check | fold | so `/tdd` |
| 9 | 10-11 T1 #24 | a numeric tolerance is derived from the model's equations when the row is written | fold | so "Plans and probes"; `/phase` step 5 |
| 10 | T1 #24 | a contract's callbacks are function-typed properties, never method signatures | fold | `eslint.config.js`: `@typescript-eslint/method-signature-style: ['error', 'property']`; today 11 method signatures in `src/world/input/keyboard.ts:30-32`, `src/world/model/world.ts:75-81`, `src/content/types.ts:59-64` go red and are converted (Q1) |
| 11 | T1 #24 | a CI-compared file is named next to its twin in the map; `make verify` runs the comparison | enforced | `CLAUDE.md:84-85`; `Makefile:57-60` (`agent-docs` in `verify`); `ci.yml:39-43` |
| 12 | 10-11 T2 #25 | a relative tolerance names its normaliser in the plan row | fold | so "Plans and probes" |
| 13 | T2 #25 | a proof-only test green on its first run cites the negative case that shows it can fail | fold | `CLAUDE.md:110-111` Tests ("a proof shows its red"), line-neutral; so `/tdd` |
| 14 | T2 #25 | a rebound assertion names the obstacle it expects, never only the sign flip | fold | so `/tdd` (model seam) |
| 15 | 10-12 T3 #26 | a dependency row names the version it was researched against; the installing ticket re-checks it | fold | `CLAUDE.md:96-97` Dependencies, line-neutral; `/phase` step 5 |
| 16 | T3 #26 | a synchronous contract names where its asynchronous inputs are gathered | fold | so "Plans and probes" |
| 17 | 10-12 T4 #27 | a plan statement about a tool's behaviour is checked against the tool's source by the first dependent ticket | fold | so "Plans and probes"; `/phase` step 5 |
| 18 | T4 #27 | a spawned production build sets `NODE_ENV` explicitly | enforced | `tests/build/production-build.ts:43-46` |
| 19 | T4 #27 | markup a document must not contain is never removed; the document is written without it | obsolete | recorded in `build/prerender.ts:2,40` (`fallbackShell`) |
| 20 | 10-13 T5a #28 | what a library emits is read in the production bundle before the test that depends on it | fold | so "Plans and probes" |
| 21 | 10-13 T5b #29 | a visibility assertion on a container names what gives it a box | fold | `tests/e2e/fixtures.ts` header block (e2e craft) |
| 22 | T5b #29 | a threshold an ADR measures is reconciled in every plan row that cites it at acceptance | fold | `docs/agents/domain.md` ADR paragraph; so "Plans and probes" |
| 23 | T5b #29 | a code path written for a later ticket is that ticket's first risk, exercised first | fold | so "Plans and probes"; `/phase` step 5 |
| 24 | T5b #29 | an import that navigation can abort is proven against navigation-away in all three browsers | enforced | `src/app/App.tsx:92-100` (beforeunload signal); `tests/e2e/title-screen.spec.ts:66` under `fixtures.ts` (console.error fails) in three projects |
| 25 | 10-13 #49 | a limit that gates CI is measured on the CI runner over at least three runs | enforced | ADR 0013 (Status, Context); `perf/budget.json` |
| 26 | #49 | a gate on a noisy reading judges the median, never a best-of | enforced | `scripts/perf-budget.ts:8-13`; `scripts/perf/budget.ts:408-413` (`medianOf`) |
| 27 | #49 | a secret pattern in the guard hook is anchored on a word boundary | fold | #62 cited, stays open (scoped to the fix); its comment records the fourth firing with the denied command verbatim (above); `guard-bash.sh` is not an opened path (Q2) |
| 28 | 10-14 #46 | an `expect.poll` predicate uses only non-waiting reads | fold | `tests/e2e/fixtures.ts` header block; so `/tdd` |
| 29 | #46 | read a poll's error text (Received vs "waiting on the predicate") before calling a timeout slow | fold | so `/diagnosing-bugs` |
| 30 | #46 | a stress run is compared against the same run on main before its failures count | fold | so `/diagnosing-bugs` |
| 31 | 10-14 T6 #30 | a plan naming an AC for a media kind checks the real content has one before choosing the seam | fold | so "Plans and probes" |
| 32 | T6 #30 | a focus trap on a native modal is proven by a Tab test in all three projects | enforced | `tests/e2e/exhibit-panel.spec.ts:281` (Tab and Shift+Tab, three projects) |
| 33 | T6 #30 | the plan comment is the first action after approval when plan mode held it back | fold | `CLAUDE.md:131-132` Working protocol, line-neutral; `/phase` step 6 |
| 34 | 10-14 T7 #31 | a placeholder is as long as the real content it stands in for | fold | so `/tdd` |
| 35 | T7 #31 | a test helper's name says what it builds from | fold | `tests/e2e/fixtures.ts` header block |
| 36 | T7 #31 | the perf runner retries a run whose gated audits all errored like a runtimeError | enforced | ADR 0014; `scripts/perf-budget.ts:13-16` (`invalidReason`, NO_NAVSTART) |
| 37 | T7 #31 | a test that drives to a target has a bound tied to its claim (model time), never a wall-clock timeout | fold | `tests/e2e/fixtures.ts` header block (the `modelTime` helper); so `/tdd` |
| 38 | 10-15 #55 | a processing parameter chosen before the source is measured is checked against the source's statistics | fold | so "Plans and probes" |
| 39 | #55 | a texture under the bundler's inline limit is checked against the CSP's `img-src` | fold | `tests/build/chunk-checks.ts` `dataUrls()` + unit case (the red); `tests/build/chunks.test.ts`: no `data:` URL in `dist/assets/*.{js,css}` (Q5) |
| 40 | #55 | a licence claim for a third-party asset is taken from its source page before it enters a plan | fold | `CLAUDE.md:98-99` Third-party code, line-neutral (`assets/ice/SOURCE.md` is the instance) |
| 41 | 10-16 T8a #32 | a timer an e2e must control runs on an injected host and is mutated once before it counts | fold | so `/tdd` |
| 42 | T8a #32 | `page.clock` is installed after any user-timing mark a helper polls | enforced | `tests/e2e/announcer.spec.ts:118-124`; the `fixtures.ts` header block repeats the sentence |
| 43 | T8a #32 | an Owner confirmation is cited only after it exists on the tracker, read back before use | fold | `docs/agents/issue-tracker.md` (Execution plans and hand-offs); `CLAUDE.md:130`, line-neutral |
| 44 | T8a #32 | a timer test bounds its absence check under the timer's real duration, mutation-checked | fold | so `/tdd` |
| 45 | T8a #32 | a live region's text arrives after its container leaves `inert` | enforced | `tests/e2e/announcer.spec.ts:37` (AC-18.2) |
| 46 | 10-19 #58 | a sanity check on a reading is derived from the readings of passing runs in the CI log | fold | so "Plans and probes" (probe shape) |
| 47 | #58 | a gate change that waits on the runner states its acceptance as runs on main after merge | fold | `.github/pull_request_template.md` Reviewer notes: a "post-merge checks" line (Q9) |
| 48 | 10-20 T8b #33 | a plan premise about a tool's capability is probed against the installed tool before it becomes a design | fold | so "Plans and probes"; `/phase` step 5 (decision 1 of the ADR) |
| 49 | T8b #33 | a capability probe asks for exactly what the renderer asks for, read in its source | fold | so "Plans and probes" |
| 50 | T8b #33 | a spec sentence the code outgrows is amended in the PR that outgrows it, not carried as a candidate | fold | `docs/spec/README.md` (Q4) |
| 51 | T8b #33 | an e2e that breaks a request consumes the browser's own console line, per browser, after the page's | fold | `tests/e2e/fixtures.ts` header block |
| 52 | T8b #33 | a library that logs before it throws is consumed as a named second line, never silenced | fold | `tests/e2e/fixtures.ts` header block |
| 53 | T8b #33 | a chained command gates a commit on the runner's exit status, never on a grep of its output | fold | `CLAUDE.md:133` ("run `make verify`, then commit on its exit status"), line-neutral |
| 54 | 10-20 #66 | a claim that a repo-wide tool reaches a folder is checked by running it read-only first, result in the plan | fold | so "Plans and probes"; `/phase` step 5 |
| 55 | 10-20 #70 | a Vercel Root Directory carries its own `vercel.json` | enforced | `docs/runbooks/mockup-preview.md` (Settings) and the project's `vercel.json` |
| 56 | #70 | a dashboard setting the agent cannot see is written into a runbook from the Owner's words, with the deploy check that proves it | fold | so `/wizard` |
| 57 | 10-21 T9 #34 | a probe that needs a server and a browser is a scratchpad file run against a server the Owner starts | fold | so "Plans and probes" (probe shape), next to `/prototype` |
| 58 | T9 #34 | a denied command is quoted verbatim in the next report | fold | `CLAUDE.md:126-127` Boundaries, last bullet, line-neutral |
| 59 | T9 #34 | a plan names the engine it suspects as a question; the probe answers it | fold | so "Plans and probes" |
| 60 | 10-21 T10 #35 | a ticket conditioned on "if N rows" takes its count at planning time; past the window it is a hand-off | fold | `docs/retro.md` header (line 4; the rows stay untouched); `/phase` step 5 |
| 61 | T10 #35 | a status line is rewritten with every neighbouring claim the same event made stale | fold | `CLAUDE.md:115` Docs convention, line-neutral |
| 62 | T10 #35 | a ratchet raise is proven by two runs on the new floor, the lower reading committed | fold | `CLAUDE.md:92-93` ratchet line, line-neutral (`vitest.config.ts:53-55` records the instance) |
| 63 | T10 #35 | "fold 2 starts from the 22 rows up to this one (#76)" | obsolete | a pointer: this ticket |
| 64 | PR #73 (not a row) | `ai-review` rounds are bounded: one fix commit per round, at most two rounds, then a follow-up issue. Evidence: round 1 (7 findings) → dbf3ffd, round 2 (A–C) → c895ee8, round 3 (1, 3) → #74, 2 on record; merged on the third green | fold | `CLAUDE.md:137-138` (the sentence as written here), line-neutral; PR template DoD line; `/fix-review` untouched (Q3); decision 3 of the ADR. The declined shared drive helper (`/code-review` on #73) is a code choice, not a rule: no item |
| 65 | #76 comment (#77) | a `test` failure on a Renovate PR with no `src/` change is read as ratchet toolchain drift first; an ADR lowers the floor, never a silent edit or a toolchain pin | fold | `CLAUDE.md:93-95` ratchet line, line-neutral; `vitest.config.ts` thresholds comment; so `/diagnosing-bugs` |
| 66 | #76 comment (#77) | does the rule sentence of `docs/spec/README.md` cover the index itself? | fold (answer: no) | `scripts/spec-freeze.sh:31-36,49` freezes a `docs/spec/*.md` whose first line at the merge base says `Status: approved|amended`; the index has no status line and #77 edited it in a plain commit with `spec-freeze` green. One sentence in `docs/spec/README.md` (Q4) |

Families as the ADR's decisions proper: (1) a plan premise about a tool is probed before it becomes a
design (17, 20, 31, 48, 49, 54, 57, 59); (2) a proof shows its red before it counts (1, 7, 8, 13, 37, 41,
44); (3) `ai-review` rounds are bounded: one fix commit per round, at most two rounds, then a follow-up
issue (64).

## 2. Fold-1 probation (ADR 0008 Consequences): what fired since, nothing deleted

| ADR 0008 # | rule | fired since 2026-10-10 |
|---|---|---|
| 1 | command heads, not text (two hook tiers) | the secret tier: ADR 0013's file name denied in #49, T7 #54, #58 #61 (rows 10-13, 10-14, 10-19) and in this session, a false positive (#62). The head tier: no heredoc denial since |
| 2, 22 | devcontainer; a host without Node 24 runs make through it | T0 #23 (commits on the host), T5a #28 (`CHROME_PATH` in the container), T9 #34 (`/usr/bin/time` absent) |
| 3, 14, 16 | the sandbox; a denied call is never worked around | T9 #34: the denied probe went to the Owner, who prescribed the file run; #70: `curl` denied, the schema read through the allowed WebFetch |
| 4, 30 | clean-worktree action; generated files committed or ignored | no job has failed on it (the five failed runs since 10-10: `perf` ×2, `lint` ×2 on the CLAUDE.md check, `ai-review` ×1); applied by #55 (`.gitignore` for the crop, d11943d) |
| 6 | `/wizard` never touches dotenv | not fired: no wizard run (#70 added a runbook pointer only) |
| 7 | vendored skills reviewed at install | not fired: no skill installed or updated |
| 9 | grilling outcomes to a tracker issue | not fired: no grilling |
| 10 | `/prototype` numeric first | not fired: no prototype |
| 11 | no GPU: visual checks to the Owner | T6 #30 (320 px HTML screenshot only), #55 (the EliteBook check), T9 #34 (the Owner started the preview) |
| 12, 15 | spec dir on ask; `spec-freeze` gate | three `amend:` commits passed it (69bfe15; a8e8c3c #55; 8b687be #63); #77 edited the index in a plain commit, green |
| 13 | `/to-spec` publishes as a comment | not fired: no new spec |
| 17 | an amendment names its principle | not fired: no constitution amendment |
| 18 | hand-offs get an issue | T6 → #52, T5b → #33, T8b → #63, T10 → #76, #73 → #74 |
| 20 | peer ranges first | T3 #26 (markdown-it 15, sharp 0.35 re-checked) → item 15 refines it |
| 21 | formatter never touches `docs/spec/**` | silent: no spec reformatted |
| 23 | actionlint on CI YAML | not fired: `links.yml` (T9) passed on its first run |
| 25 | scanner fixtures look random | not fired: no new scanner fixture |
| 26 | the plan leaves the chat at approval | T5b #29 and T6 #30 (plan mode held the comment back) → item 33 refines it |
| 27 | a shell gate ships with both cases | runs in every `make verify`; no new gate since |
| 28 | action inputs checked against source | #70 (the Vercel schema), T9 (`links.yml`) |
| 29 | repository settings read with `gh api` | T10 #35 (the ruleset's nine checks) |
| 31 | `run.sh` asks Prettier `--file-info` | runs in every `make verify`, never failed |
| 32 | shellcheck in `verify` | #66 (the dry run showed what reaches `mockups/`), T9 (`links.yml`'s run blocks) |
| 5, 8, 19, 24 | obsolete in fold 1 | nothing to fire |

Deletion is fold 3's call (the guide's "two cycles"); the ADR lists the not-fired ones as its probation
carry-over.

## 3. Executable items: land or hand off

| item | decision | how |
|---|---|---|
| `ai-review` failure artifact (3) | land | `ci.yml`: `id: review` on the action step; a step `actions/upload-artifact@cf430e0…` (the sha already pinned at `ci.yml:72`) `if: failure() && steps.review.outputs.execution_file != ''`, name `ai-review-execution`, 14 days. Before writing it: read the pinned action's run step (`action.yml`, `src/entrypoints/run.ts`) to confirm the output is written before a failing exit; if not, the path is the runner's temp glob the action documents |
| hook-fixture rule (1, 2) | land | `run.sh --prove <fixture>` as in item 1; header lists the delimiter class and its fixtures (item 2). `make test-shell` unchanged; `make shellcheck` covers the edit |
| `method-signature-style: property` (10) | land (Q1) | the rule in `eslint.config.js`; the 11 signatures in the three files become function-typed properties in the same commit so `make verify` stays green per commit |
| `tests/build` "no `data:` URL" (39) | land (Q5) | `dataUrls()` in `chunk-checks.ts` with its unit red; the case over every `dist/assets/*.js` and `*.css` in `chunks.test.ts`, naming `img-src 'self'` (`vercel.json:16`) |
| #62 guard-hook pattern (27) | cite, #62 stays open (Q2) | the ADR row cites #62; a comment on #62 records the fourth firing with the denied command and the hook's answer quoted verbatim (this session, a read-only command). `guard-bash.sh` stays untouched: not an opened path |

## 4. Protected paths this ticket opens

Exactly three, as #76 names them: `.claude/commands/phase.md` (steps 5 and 6), `.claude/hooks/tests/`
(`run.sh`), `.github/workflows/ci.yml` (the `ai-review` job's steps only). Nothing else protected is
touched: not `.claude/commands/fix-review.md` (Q3), not `.claude/hooks/guard-bash.sh` (#62), not
`.claude/settings.json`, not `.agents/**`, not CODEOWNERS. `.github/pull_request_template.md` is not
protected. `docs/spec/README.md` is on ask, not a spec (Q4).

## 5. Commits after the plan, one surface group each, `make verify` before each

1. `docs(plan): retro fold 2 plan of record` — this file and the `docs/plan/README.md` index. Then the push (on the Owner's instruction in the ticket brief) and the #76 comment with the summary and the open questions; a comment on #62 quoting the denied command; no PR yet.
2. `chore(claude): run.sh --prove runs a new deny fixture against the committed hook` — `.claude/hooks/tests/run.sh`.
3. `ci(ai-review): upload the execution file when the review step fails` — `ci.yml`, `ai-review` only; actionlint through the pinned image.
4. `chore(lint): a contract's callbacks are function-typed properties` — `eslint.config.js`; `src/world/input/keyboard.ts`, `src/world/model/world.ts`, `src/content/types.ts`.
5. `test(build): no asset is inlined as a data: URL in the chunks or stylesheets` — `tests/build/chunk-checks.ts`, `chunk-checks.test.ts`, `chunks.test.ts`.
6. `chore(claude): /phase probes plan premises and posts the plan first` — `.claude/commands/phase.md`.
7. `docs(agents): overrides for plans and probes, /tdd, /diagnosing-bugs, /prototype, /wizard` — `docs/agents/skill-overrides.md` (three new sections, two sentences), `docs/agents/domain.md`, `docs/agents/issue-tracker.md`.
8. `test(e2e): the suite's craft rules in the fixture header` — `tests/e2e/fixtures.ts` header block (21, 28, 35, 37, 42, 51, 52).
9. `docs(spec): the index is not frozen; an outgrown sentence is amended in the PR that outgrows it` — `docs/spec/README.md` (the `Edit(/docs/spec/**)` ask fires; `spec-freeze` proves the index is not gated).
10. Three commits for the docs surfaces:
    - 10a `docs(claude): fold the 22 rows into CLAUDE.md` — `CLAUDE.md` then `cp CLAUDE.md AGENTS.md`; `wc -l CLAUDE.md` = 150 exactly, `cmp` clean, `make agent-docs` green before `make verify`.
    - 10b `docs: the PR template's review bound and post-merge line, the retro header, the ratchet-drift note` — `.github/pull_request_template.md` (DoD review line: one fix commit per round, at most two rounds, then a follow-up issue; Reviewer notes post-merge line); `docs/retro.md` lines 4–6 (count rule, fold-2 pointer; rows untouched); `vitest.config.ts` thresholds comment (65).
    - 10c `docs(adr): 0015 retro fold 2` — `docs/adr/0015-retro-fold-2.md` (Status · Context · Decision table · three decisions · Consequences with the probation carry-over) and `docs/adr/README.md`.
11. `docs(retro): the line for #76`.
12. `/code-review` against `main`, then the PR (`gh pr create --label ai-assisted`, the fold table in the body), stop before `git push`.

Verification: `make verify` green after every commit; `make test-shell` shows `--prove` on one existing
fixture pair; `make build` then the new build case red-then-green (the unit red on `dataUrls`; the build
case green on the real chunks, Q5 if a library carries a `data:` URL); `make lint` red on the 11
signatures before the conversion, green after; on the PR every required job green, `ai-review` posts.

## 6. Open questions for the Owner (answered "Qn = A" on #76)

1. **Q1 lint rule.** `method-signature-style: property` flags 11 signatures in three `src/` files. A: land here, rule and conversion in one commit (recommended: mechanical, `make verify` proves it, the lesson is executable only with the rule on). B: hand off to its own ticket, the rule off until then.
2. **Q2 #62.** A: cite #62 in the ADR row, keep it open as its own ticket, add the fourth firing (today, quoted) to it (recommended: `guard-bash.sh` is not an opened path). B: open `.claude/hooks/guard-bash.sh` for this ticket and fold #62's fix here.
3. **Q3 `/fix-review`.** The bounded-rounds rule lands in `CLAUDE.md` and the PR template. A: `.claude/commands/fix-review.md` untouched; its step 3 already defers to `CLAUDE.md` (recommended). B: open it for one sentence in step 3.
4. **Q4 `docs/spec/README.md`.** Two sentences (the index carries no status line and is not frozen, the gate reads the status line; an outgrown spec sentence is amended in the PR that outgrows it) in a plain `docs(spec):` commit, the ask answered at edit time. A: yes (recommended). B: leave the README; put both in `CLAUDE.md`.
5. **Q5 `data:` case scope.** A: every chunk and stylesheet under `dist/assets/`; if a library chunk carries a `data:` URL of its own, narrow to `data:image/` and record the exemption in the test header (recommended). B: the entry chunk and stylesheets only.
6. **Q6 artifact shape.** A: `ai-review-execution`, `if: failure()`, 14 days, the action's `execution_file` output (recommended; the file holds the review's tool results, public PR text, both secrets masked). B: `if: always()` like the coverage artifact.
7. **Q7 hook-fixture rule shape.** A: `run.sh --prove <fixture>` against `HEAD`'s hook, local only, no Makefile or CI change (recommended). B: a Makefile target `test-shell-prove` as well.
8. **Q8 `CLAUDE.md`.** Every edit is line-neutral at the 150-line cap (fold 1's 130 target is gone since T8a); no line is freed for `mockups/` here (#70's open point). A: confirm (recommended). B: free lines in this ticket.
9. **Q9 PR template.** A: Reviewer notes gains one "post-merge checks" line (item 47) and the DoD review line names the two-round bound (item 64) (recommended). B: DoD line only.

## As delivered

Commit order as planned, the Owner's go before each commit, `make verify` green before each:

| # | commit | sha |
|---|---|---|
| 1 | `docs(plan): retro fold 2 plan of record` | 53d55a4 |
| 2 | `chore(claude): run.sh --prove runs a new deny fixture against the committed hook` | 0bb3e9d |
| 3 | `ci(ai-review): upload the execution file when the review step fails` | 14e91ec |
| 4 | `chore(lint): a contract's callbacks are function-typed properties` | 8aede60 |
| 5 | `test(build): no asset is inlined as a data: URL in the chunks or stylesheets` | dc18c74 |
| 6 | `chore(claude): /phase probes plan premises and posts the plan first` | f7151c8 |
| 7 | `docs(agents): overrides for plans and probes, /tdd, /diagnosing-bugs, /prototype, /wizard` | b728e8f |
| 8 | `test(e2e): the suite's craft rules in the fixture header` | 893f514 |
| 9 | `docs(spec): the index is not frozen; an outgrown sentence is amended in the PR that outgrows it` | 4f28a86 |
| 10a | `docs(claude): fold the 22 rows into CLAUDE.md` | 361663f |
| 10b | `docs: the PR template's review bound and post-merge line, the retro header, the ratchet-drift note` | 5a7f205 |
| 10c | `docs(adr): 0015 retro fold 2` | e502a6e |
| 11 | `docs(retro): the line for #76` | 97deb39 |
| 12 | this section, then `/code-review` and the PR | see the PR |

Deviations from the plan, each decided by the Owner on the tracker or in the review of the commit:

- **Item 10: 12 signatures in four files, not 11 in three.** With the rule on, `make lint` found an
  inline type literal in `scripts/links/check.ts` that the plan's line-anchored grep had missed. All
  12 converted in the rule's commit; `make lint` red with 12 errors before, green after.
- **`/phase` step 5 condensed.** The command carries the instruction (a premise is probed, the count
  is taken now) and a pointer to "Plans and probes" with "a plan that skips one says why"; the
  row-level rules (items 9, 12, 15, 23 and the probe shape) have that section as their single home.
- **The Vercel wording (item 56).** The runbook (lines 28–29) and the Owner's #70 comment record the
  fallthrough: without a `vercel.json` in the Root Directory, Vercel applies the repository root's.
  The `/wizard` sentence keeps it as cause and effect, not as an "or" clause.
- **The ratchet-drift rule (item 65) is a clause in `CLAUDE.md`**, "Lowering one needs an ADR, also
  for toolchain drift (…); never a silent edit or a toolchain pin"; the full rule is in the
  `vitest.config.ts` thresholds comment and `/diagnosing-bugs`.
- **The `data:` case (item 39) is named for the CSP's `'self'` sources**, not `img-src`: an inlined
  font or media file is caught by the same check. The real build carried no `data:` URL, so the
  pattern stayed unnarrowed (Q5's narrowing not needed).
- **`run.sh --prove` takes an optional previous hook.** Its PASS path cannot occur against `HEAD`
  without a hook change, so the proof ran against two stub hooks (one allows everything, one denies
  everything) and showed PASS, "already denied", "already allowed" and the usage exit.
- **actionlint and the push ran on the Owner's host.** The devcontainer has no docker, podman or
  actionlint binary (clean on 14e91ec from the host); the agent's push of commit 1 failed with
  `Host key verification failed.` and the Owner pushed. No remote was changed.
- **ADR 0015 is dated 2026-10-22**, the commit date in the Owner's local time; the plan's acceptance
  stays 2026-10-21.
- **CLAUDE.md:** fourteen lines replaced in place, none added or freed; at the cap a fold adds width,
  not lines (the retro line's rule; fold 3 frees lines before it adds rules).

Denied in the implementation session: none. The one denial of the planning session (the guard hook
on a read-only command naming the ADR 0013 file) is quoted in Context and on #62.
