# Plan: retro fold 1 — Phase 0–1 lessons

Status: accepted by the Owner on 2026-10-10 in the plan-mode review, with three changes folded in
(expansions in quoted values stay command heads; a single ticket's plan is a comment on the ticket
and only multi-PR or process work gets a `docs/plan` file; skill overrides live in
`docs/agents/skill-overrides.md` and `CLAUDE.md` stays at or under 130 lines). A process plan for
guide §4.0.3, not a feature plan, so there is no `plan: approve` commit. No tracker issue: the
Owner's instruction is the ticket. Branch `chore/retro-fold`, one PR
`chore(retro): fold Phase 0–1 lessons`. The fold table (verdict and destination per lesson) is in
ADR 0008 and the PR body.

This file is the plan of record because the fold changes the process (hook matching, a CI gate,
`make verify`), which is the case `/phase` step 6 names for a committed plan.

## Context

`docs/retro.md` held 14 rows and guide §4.0.3 asks for a fold every 3–5 tickets. An inventory of
the enforcement surfaces (settings, hooks and fixtures, `ci.yml`, Makefile, scripts, docs, vendored
skills) showed 11 lessons already enforced, 4 obsolete and 17 still reminders. Three of the 17 can
become executable (hook, CI gate, verify target); the rest become rules in `CLAUDE.md`, the agent
docs or the `/phase` command.

## Tasks, in commit order

1. `docs(plan): retro fold 1 plan of record` — this file and the `docs/plan/README.md` index.
2. `chore(claude): guard-bash matches command heads; heredoc bodies and message text are not commands`
   — two pattern tiers in `guard-bash.sh`; fixtures `allowed-heredoc-body`, `allowed-commit-message`,
   `denied-heredoc-interpreter`, `denied-command-substitution-in-body`, `denied-secret-in-heredoc`;
   `run.sh` asks Prettier which fixture type the ignore rules cover.
3. `test(spec-freeze): scratch-repo test with a passing and a failing case` — `scripts/spec-freeze.test.sh`.
4. `build(make): shellcheck and test-shell in verify; devcontainer installs shellcheck` — Makefile
   targets, Dockerfile apt list, `lint` job calls the targets, README.
5. `ci: a job that leaves untracked or modified files fails` — clean-worktree step in `lint`, `build`, `e2e`.
6. `chore(claude): /phase posts or commits the approved plan and checks repository settings`.
7. `docs: fold the Phase 0–1 retro lines into CLAUDE.md, the agent docs and ADR 0008` — CLAUDE.md
   (and the identical AGENTS.md), `docs/agents/skill-overrides.md` (new), `issue-tracker.md`,
   `domain.md`, ADR 0008 and its index line, the retro pointer line and this ticket's retro row.
8. `/code-review`, PR with the fold table, stop before `git push`.

## Verification

`make verify` through the rebuilt devcontainer image after every commit (the image needs shellcheck
now, so the rebuild happens before task 4's verify). `make test-shell` green with 13 hook fixtures
and the three spec-freeze cases. `cmp CLAUDE.md AGENTS.md` and `wc -l CLAUDE.md` ≤ 130. actionlint
over `ci.yml` through the pinned image. On the PR: every CI job green, `spec-freeze` untouched.

## As delivered

- Commit order as planned, then one `chore(review)` commit for the `/code-review` findings (Standards
  and Spec axes, both run against `main`).
- Hook, beyond the plan: an unquoted heredoc tag keeps the body lines the shell would expand; an
  interpreter given by path (`/bin/bash`) is recognised; a heredoc without a terminator, or a literal
  `<<` inside a string, falls back to matching the whole text; the dotenv pattern's delimiter class
  was widened, since `.env)` had never been denied and the amendment-1 fixture was proving that hole,
  not the tiering. 19 fixtures instead of 8 + 4; the secret-in-heredoc fixture carries a private-key
  marker, not a `ghp_` token, so the gitleaks job never fires on a fixture.
- The clean-worktree step became the composite action `.github/actions/clean-worktree`, used by every
  job that runs project code (`lint`, `test`, `build`, `e2e`, `perf`), not only three of them.
- CLAUDE.md: the three skill subsections became bullets and the Errors and Logging lines merged to
  hold the 130-line target; the shell-gates rule names the gates it covers (the guard hook and
  `scripts/spec-freeze.sh`), since the logging and formatting hooks are not gates.
- Dismissed review findings, with the reason: intermediate commits cite ADR 0008 before it lands (the
  approved order ends with the record of the whole fold); the PASS/FAIL echo shape is duplicated
  across the two test scripts (two instances); a single-quoted `'$(…)'` value is kept as command
  head although the shell does not expand it (the Owner's amendment, taken literally).
