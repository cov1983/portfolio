# Repo overrides for vendored skills

The skills under `.agents/skills/` are vendored from `mattpocock/skills` and never edited:
`skills-lock.json` pins their content and CODEOWNERS protects the directory. Where this repo works
differently, the override is written here and wins over the skill's own text. `CLAUDE.md` points
here and `/phase` reads this file first. Each entry names the retro line it came from
(`docs/retro.md`; fold 1 is ADR 0008).

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
(retro 2026-10-07, chore/skills review; 2026-10-10, PR 4)

## `/prototype`

A prototype of physics feel runs the model headless under Node against the Rink dimensions, the
`tests/model` way with fixed timesteps, before any browser run. The agent machine has no GPU: the
browser check is the Owner's, and the plan says so up front. (retro 2026-10-07, chore/puck-feel-prototype)

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
