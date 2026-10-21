# Repo overrides for vendored skills

The skills under `.agents/skills/` are vendored from `mattpocock/skills` and never edited:
`skills-lock.json` pins their content and CODEOWNERS protects the directory. Where this repo works
differently, the override is written here and wins over the skill's own text. `CLAUDE.md` points
here and `/phase` reads this file first. Each entry names the retro line it came from
(`docs/retro.md`; fold 1 is ADR 0008, fold 2 ADR 0015).

## `/to-spec`

Publish the spec as a comment on the input issue (`gh issue comment <n> --body-file -`), not as a
new issue, and write the file to `docs/spec/<feature>.md` with `Status: draft` on its first line.
The `spec: approve` commit is the freeze, enforced by the `spec-freeze` job; the skill applies no
`ready-for-agent` label. (retro 2026-10-08, chore/increment-1-spec)

## `/wizard`

A generated wizard sets `ENV_FILE=/dev/null` before its stages and never writes a dotenv file; the
library (`.agents/skills/wizard/template.sh`) is embedded unchanged and `scripts/setup-wizard.sh`
is the reference. The guard hook denies dotenv reads and writes regardless. A vendored script used
with its own library gets a shellcheck run (`make shellcheck`) before the stages are written.
(retro 2026-10-07, chore/skills review; 2026-10-10, PR 4) A dashboard setting the agent cannot see
is written into a runbook from the Owner's words, with the deploy check that proves it. A Vercel
Root Directory carries its own `vercel.json`: without one Vercel applies the repository root's, which
is how the mockup project's first two deploys failed (`docs/runbooks/mockup-preview.md`).
(retro 2026-10-20, #70)

## `/prototype`

A prototype of physics feel runs the model headless under Node against the Rink dimensions, the
`tests/model` way with fixed timesteps, before any browser run. The agent machine has no GPU: the
browser check is the Owner's, and the plan says so up front. (retro 2026-10-07, chore/puck-feel-prototype)
A probe that needs a server and a browser takes the shape given under "Plans and probes": a file in
the scratchpad against a server the Owner starts. (retro 2026-10-21, T9 #34)

## `/grilling`, `/grill-me`, `/grill-with-docs`

Outcomes that are neither a glossary term nor a decision (scope, rules, targets, open questions)
go to a tracker issue, as #3 did for increment 1; the glossary stays a glossary and ADRs stay
decisions. A proposed constitution amendment names its target principle number when it is first
raised, so the ratifying ticket is a transcription. Hand-offs to "its own ticket" get the tracker
issue in the PR of the approving commit (`docs/agents/issue-tracker.md`). (retro 2026-10-07,
chore/phase-1-align review; 2026-10-08, chore/constitution-v1 and chore/license)

## `/setup-matt-pocock-skills`

After the installer runs, `git status`: every file it created is committed or gitignored in the
same PR. Each new or updated skill is reviewed against the Boundaries in `CLAUDE.md` with the result
in the PR body, and `skills-lock.json` changes in the same commit. (retro 2026-10-07, chore/skills)

## Plans and probes (`/phase`, `/to-tickets`, `/research`)

`/phase` step 5 carries the instruction; the row-level rules live here, once. A plan that skips one
says why.

- **A premise is probed, not assumed**, with the result in the plan. A plan statement about a tool's
  behaviour ("X serves Y") is checked against the tool's source by the ticket that first depends on
  it, before its first task (retro 2026-10-12, T4 #27). What a library emits is read in the bundle
  the seam runs, production, not the dev one (2026-10-13, T5a #28). A plan premise about a tool's
  capability is probed against the installed tool, and a capability probe asks for exactly what the
  renderer asks for, read in the renderer's source, never a wider set (2026-10-20, T8b #33). A claim
  that a repo-wide tool does or does not reach a folder is checked by running the tool against the
  folder, read-only, with the result in the plan (2026-10-20, #66). A plan that names an AC for a
  media kind checks the real content has one before choosing the seam (2026-10-14, T6 #30). A
  processing parameter chosen before the source is measured is checked against the source's
  statistics before the output is committed (2026-10-15, #55).
- **A probe's shape.** A probe that needs a server and a browser is a file in the scratchpad run
  against a server the Owner starts (`xvfb-run -a node <file>`), never one chained command with a
  background process and a pkill; the plan names the engine it suspects as a question, and the
  probe answers which engine it is (2026-10-21, T9 #34). A sanity check on a reading is derived
  from the readings of passing runs in the CI log before it is written (2026-10-19, #58).
- **A row carries its derivation.** A numeric tolerance is derived from the model's equations when
  the row is written, never read off the spec's spatial wording (2026-10-11, T1 #24); a tolerance
  written as relative names its normaliser in the row (2026-10-11, T2 #25). A contract that is
  synchronous names where its asynchronous inputs are gathered (2026-10-12, T3 #26). A dependency
  row names the version it was researched against, and the installing ticket re-checks the row's
  assumptions (types shipped, install scripts) against the newest version before adding it
  (2026-10-12, T3 #26). A code path written for a later ticket is listed as that ticket's first
  risk and exercised first (2026-10-13, T5b #29). A threshold an ADR measures is reconciled in every
  plan row that cites it at ADR acceptance, and an open question whose answer lands in an ADR is
  answered before that ADR is accepted (2026-10-13, T5b #29; 2026-10-10, docs/plan-increment-1;
  `docs/agents/domain.md`).

## `/tdd` in this repo

- **A proof shows its red before it counts.** A proof-only test that is green on its first run
  cites the negative case that shows it can fail (retro 2026-10-11, T2 #25). An expected-failure
  test has a body that can only fail through the thing under test, never through a wait on it, and
  a test-infrastructure change is run against a stub first so its red proves the check, not a
  timeout (2026-10-11, T0 #23). A new hook fixture is run against the committed hook first
  (`.claude/hooks/tests/run.sh --prove <fixture>`) and must be wrong there, so a PASS proves the
  change (2026-10-10, chore/retro-fold). A timer an e2e must control runs on an injected host and
  is mutated once before the test counts; an absence check is bounded under the timer's real
  duration and mutation-checked by moving the clock install (2026-10-16, T8a #32).
- **A test names what it proves.** A rebound assertion names the obstacle it expects (position at
  the contact), never only the sign flip (2026-10-11, T2 #25). A test that drives to a target has a
  bound tied to the claim it proves, model time, never a generous wall-clock timeout that cannot
  fail (2026-10-14, T7 #31). A placeholder string is as long as the real content it stands in for,
  so layout limits show before the content arrives (2026-10-14, T7 #31).
- The e2e suite's craft rules (poll predicates, a container's box, console lines per browser, helper
  names, `page.clock`) are in the header of `tests/e2e/fixtures.ts`.

## `/diagnosing-bugs`

- Read a poll's error text (a Received value vs "waiting on the predicate") before calling a
  timeout slow; a stress run is compared against the same run on main before its failures count
  (retro 2026-10-14, #46).
- A failing `ai-review` step leaves its execution file as the `ai-review-execution` artifact
  (`ci.yml`), so the first failure explains itself. `show_full_output` prints tool results and the
  reviewer can read any runner file: a diagnosis switch set for one run on a branch, never merged
  (2026-10-10, fix/ai-review-output).
- A `test` failure on a Renovate PR with no `src/` change is read as toolchain drift of the coverage
  ratchet first (V8's branch and statement counts move with Node, Vitest or the coverage provider);
  the fix is an ADR lowering the floor to the new reading, never a silent threshold edit and never a
  toolchain pin to dodge it (no retro row: the Owner's comment of 2026-10-21 on #76 from the #77
  review; ADR 0015, item 65).
