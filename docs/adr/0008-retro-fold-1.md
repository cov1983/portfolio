# ADR 0008 — Retro fold 1: where the Phase 0–1 lessons went

Status: Accepted (2026-10-10)

## Context

Guide §4.0.3 and `docs/retro.md` say that every 3–5 tickets the "rule I would add" column is
converted into something executable: a `CLAUDE.md` rule, an edit to a skill we own, a lint rule, a
test or a CI gate. Fourteen rows accumulated between 2026-10-06 and 2026-10-10 (Phase 0a, the skill
install, Phase 1 alignment, the puck-feel prototype, the increment-1 spec and its guardrail, the
constitution, the license and the four Phase 0b PRs) and no fold had happened. Each row was checked
against the surfaces the repo already has (`.claude/settings.json`, the three hooks and their
fixtures, `ci.yml`, the Makefile, `scripts/`, the docs and the vendored skills) and given one of
three verdicts. Retro rows are never edited; this record carries the verdicts.

Three constraints shaped the fold. Vendored skills under `.agents/skills/` cannot be edited
(content-hash lockfile, CODEOWNERS), so repo-specific skill behaviour needed a home of its own:
`docs/agents/skill-overrides.md`. `CLAUDE.md` is capped at 150 lines by CI and the Owner set a
target of 130 for this fold, so rules went there only when no executable surface fits. And the
Owner decided in plan mode (2026-10-10) that protected paths were in scope for this one ticket:
`.claude/hooks`, `.claude/commands`, `.github/workflows`, `.devcontainer`.

## Decision

Legend: **enforced** = already a hook, CI gate or `CLAUDE.md` rule, marked only · **fold** = made
executable or written down in this PR · **obsolete** = one-off, the decision is recorded elsewhere.

| # | row | lesson ("rule I would add") | verdict | becomes |
|---|---|---|---|---|
| 1 | phase-0a | guard-bash matches only the command head, not heredoc, `-m` or `--body` text | fold | `guard-bash.sh` two tiers: command heads for the deny patterns, whole text for secret material; a quoted value with `$(`, a backtick or `${` stays a command head; 5 fixtures |
| 2 | phase-0a | devcontainer so local verify == CI | enforced | `.devcontainer/`, CLAUDE.md Environment |
| 3 | phase-0a | sandbox, since Bash rules are not a boundary | enforced | the devcontainer is the sandbox; CLAUDE.md Boundaries: a denied call is never worked around |
| 4 | chore/skills | `git status` after any installer | fold | clean-worktree step in the `lint`, `build` and `e2e` jobs; CLAUDE.md generated-files rule; `skill-overrides.md` |
| 5 | chore/skills | settle the vocabulary file name before skills reference it | obsolete | `GLOSSARY.md` fixed by ADR 0002 and CLAUDE.md |
| 6 | chore/skills (review) | the wizard skill must not touch dotenv files | fold | `skill-overrides.md` (`ENV_FILE=/dev/null`, as `setup-wizard.sh` does); the hook denies dotenv paths |
| 7 | chore/skills (review) | vendored skills are reviewed against Boundaries at install time | fold | `skill-overrides.md`; CLAUDE.md third-party-code convention |
| 8 | phase-1-align | grill: ask repo visibility and the shared URL first | obsolete | both decided and recorded: CLAUDE.md "public repository", ADR 0004 |
| 9 | phase-1-align (review) | fix where non-glossary, non-ADR grilling outcomes go | fold | `skill-overrides.md` and `docs/agents/domain.md`: a tracker issue; the glossary stays a glossary |
| 10 | puck-feel | prototype feel presets numerically against the Rink before a browser run | fold | `skill-overrides.md` (`/prototype`) |
| 11 | puck-feel | no GPU: say so up front, hand the visual check to the Owner | fold | CLAUDE.md Environment fact; closes row 24 as well |
| 12 | increment-1-spec | allow creating a spec when none exists; `spec: approve` is the freeze | enforced | `docs/spec/**` on ask; `spec-freeze` job |
| 13 | increment-1-spec | `/to-spec` publishes as a comment on the input issue | fold | `skill-overrides.md`; `docs/agents/issue-tracker.md` |
| 14 | guardrail | a denied tool call is never worked around | enforced | CLAUDE.md Boundaries |
| 15 | guardrail | spec dir deny → ask, CI gate for approved specs | enforced | settings ask; `spec-freeze` job |
| 16 | guardrail | a deny on one tool is not a boundary while another reaches the file | enforced | same two surfaces; the gate is the boundary |
| 17 | constitution-v1 | a proposed amendment names its target principle at grilling time | fold | `skill-overrides.md` (grilling); CLAUDE.md constitution line |
| 18 | license | spec hand-offs to "its own ticket" get a tracker issue at approve time | fold | CLAUDE.md Working protocol; `docs/agents/issue-tracker.md` Hand-offs |
| 19 | license | decide the holder's public name and the process-docs bucket before LICENSE | obsolete | LICENSE merged |
| 20 | PR 1 | resolve peer ranges first; record the table | enforced | CLAUDE.md Dependencies convention; the table is the PR body |
| 21 | PR 1 | a formatter never touches `docs/spec/**` | enforced | `.prettierignore` `*.md`; CLAUDE.md Conventions |
| 22 | PR 1 | an engine-strict repo documents the devcontainer as the way to run make | fold | CLAUDE.md Environment: a host without Node 24 or shellcheck runs make through the devcontainer |
| 23 | PR 1 | shell in CI YAML is shellchecked too | enforced | actionlint step in `lint` |
| 24 | PR 2 | probe `getContext('webgl')` before promising software WebGL | obsolete | the answer is recorded: `playwright.config.ts`, the amend commit, row 11 |
| 25 | PR 2 | fixtures for a secret scanner must look random | fold | CLAUDE.md Tests convention |
| 26 | PR 2 | the approved plan is committed at approval time | fold | `/phase` step 6 and CLAUDE.md: a single ticket's plan is a comment on the ticket before implementation; work spanning PRs or changing the process gets `docs/plan/<name>.md` in the first commit |
| 27 | PR 3 | a shell gate gets a scratch run with a passing and a failing case first | fold | `scripts/spec-freeze.test.sh`; `make test-shell` in `verify` and the `lint` job; CLAUDE.md Conventions |
| 28 | PR 3 | third-party action inputs are checked against the action's source | fold | `/phase` step 5; CLAUDE.md third-party-code convention |
| 29 | PR 3 | planning verifies the repository settings a new job needs with `gh api` | fold | `/phase` step 5 |
| 30 | PR 4 | a generated file is committed or gitignored in the same PR | fold | clean-worktree step (with row 4); CLAUDE.md generated-files rule |
| 31 | PR 4 | a hook smoke test checks the ignore rules before choosing its fixture | fold | `run.sh` asks `prettier --file-info` that `x.md` is ignored and `x.json` is not |
| 32 | PR 4 | a vendored script gets shellcheck before its stages are written | fold | `make shellcheck` in `verify`; shellcheck in the devcontainer image; `skill-overrides.md` (`/wizard`) |

Three of the folds change the workflow and are the decision proper:

1. **Command heads, not text.** The guard hook denies on what the shell would execute: a heredoc body
   that is not fed to an interpreter and a quoted message, body or title value are blanked before
   the deny patterns run. A quoted value the shell would expand (`$(`, a backtick, `${`) is kept as
   a command head. Secret material (tokens, key ids, private-key markers) is still matched over the
   whole text, because a secret in a PR body is a leak whatever the command. The hook stays
   fail-open on an unparsable payload (ADR 0001).
2. **A job leaves a clean worktree.** `lint`, `build` and `e2e` end by failing when `git status`
   reports anything: whatever an installer, `make setup`, a build or a browser run leaves behind is
   committed or gitignored in the same PR.
3. **Shell is verified like TypeScript.** `make verify` runs `shellcheck` over every script and the
   shell tests (`make test-shell`: hook fixtures and the spec-freeze gate test); the devcontainer
   image carries shellcheck; the `lint` job calls the same targets. A shell gate ships with a passing
   and a failing case before its CI job exists.

## Consequences

- `make verify` needs the shellcheck binary: the rebuilt devcontainer has it, a host without it
  fails loudly with the instruction to use the devcontainer (a silent skip would make a green verify
  mean less than a green `lint` job).
- The `.claude/audit.log` still records every command in full; only the matching changed. A phrase
  in a commit message or PR body no longer blocks the agent, and a command that reads a dotenv file
  through an expansion still does.
- Each rule folded here is on probation: a rule that never fires again after two more folds is
  deleted (guide §4.0.3). The next fold is due after 3–5 more retro rows, recorded as ADR
  `000N-retro-fold-2.md` with the same table shape.
- Reversible per item: revert the hook to single-tier matching, drop the clean-worktree steps, or
  take `shellcheck test-shell` out of `verify`. The retro rows stay as they are.
