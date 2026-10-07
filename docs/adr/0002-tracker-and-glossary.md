# ADR 0002 — Issue tracker and vocabulary file

Status: Accepted (2026-10-07)

## Context

The engineering skills from `mattpocock/skills` (installed on `chore/skills`) need two things settled
per repo: where issues live, and which file holds the project's shared vocabulary.

The workflow guide (§2, §4.0, §4.1, §7.1, Appendix C) names the vocabulary file `CONTEXT.md`. The
skills (`/grill-with-docs`, `/domain-modeling`, `/code-review`, `/improve-codebase-architecture`)
read and write `GLOSSARY.md`. Keeping both would split the vocabulary across two files.

## Decision

1. **GitHub Issues is the issue tracker.** Configured in `docs/agents/issue-tracker.md`; skills use
   the `gh` CLI. Why: native blocking links between issues (used by `/wayfinder` and `/triage`), and
   the backlog is visible without a clone. Alternatives: local markdown under `.scratch/` (no
   blocking links, not visible outside the repo); an external tracker (another system to maintain
   for a solo project).
2. **`GLOSSARY.md` at the repo root is the single vocabulary file.** Written by `/grill-with-docs`
   in Phase 1. Why: the skills write it, and one file means one source of truth. The guide's name
   `CONTEXT.md` is kept only as a reference: `CLAUDE.md` notes the alias once, and the guide is not
   edited.

## Consequences

- `CLAUDE.md` and `AGENTS.md` reference `GLOSSARY.md`; `docs/workflow-guide.md` still says
  `CONTEXT.md`. Readers of the guide map the name via the note in `CLAUDE.md`.
- Triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`)
  exist on the GitHub repo; `docs/agents/triage-labels.md` maps them.
- Switching trackers later means re-running `/setup-matt-pocock-skills` and superseding this ADR.
