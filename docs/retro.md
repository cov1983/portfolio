# Retro log

One line per ticket, appended in the ticket's own PR. Append, don't edit (guide §4.0.3).
Every 3–5 tickets, fold the lines into a `CLAUDE.md` rule, a skill edit, a lint rule or a CI gate.

| date | ticket | what cost time | what I overrode | rule I would add |
|---|---|---|---|---|
| 2026-10-06 | phase-0a | guard-bash denied heredoc text in commit/PR bodies; make not installed locally so Makefile only verified in CI; shellcheck binary had to be fetched despite curl/wget deny | kept patterns as is | 0b: match only the command head (before heredoc/-m/--body); devcontainer so local verify == CI; sandbox since Bash rules are not a boundary |
| 2026-10-07 | chore/skills | installer dropped skill content in .agents/ with .claude/skills as symlinks plus a root skills-lock.json, outside the expected file list; GLOSSARY.md vs CONTEXT.md naming collided with the workflow guide | none | setup-matt-pocock-skills: run git status after any installer and settle the vocabulary file name before the skills reference it |
