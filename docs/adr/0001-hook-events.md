# ADR 0001 — Hook events for the audit trail

Status: Accepted (2026-10-06)

## Context

Guide §7.5 wires a `log-session.sh` hook to the `Stop` event and asks to verify event names against
the current Claude Code docs. Per the docs (code.claude.com/docs/en/hooks, checked 2026-10-06),
`Stop` fires once per assistant turn, while `SessionEnd` fires once when a session ends.
The hook's purpose is a per-session compliance record, not a per-turn one.

## Decision

- `log-session.sh` runs on `SessionEnd`, not `Stop`.
- `guard-bash.sh` runs on `PreToolUse` with matcher `Bash` and appends every command to
  `.claude/audit.log` before deciding whether to deny it.
- Both logs stay local and are gitignored.

## Consequences

- A session that crashes or is killed produces no `sessions.log` entry; the per-command
  `audit.log` still covers it.
- Logs live only on the developer machine until a log store exists (Phase 0b / Phase 4).
  Shipping them is a follow-up, not part of the seed.
- The `Stop` event remains available if a per-turn record is wanted later.
