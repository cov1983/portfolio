#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash). Reads the tool call as JSON on stdin, appends the command to
# the audit log, and denies commands that touch secrets, production targets or protected refs.
# Docs: https://code.claude.com/docs/en/hooks  ·  Decision: docs/adr/0001-hook-events.md
#
# Second line of defence behind permissions.deny in .claude/settings.json: permission rules match
# the literal command prefix, this script matches patterns anywhere in the command text.
# Never fails closed on missing tooling: if the payload cannot be parsed, it logs and allows.
set -euo pipefail

# --- deny patterns (case-insensitive ERE) with a static reason each ---------------------------
# Format: <ERE pattern>@@<reason>. Keep reasons free of quotes/backslashes: they go into JSON verbatim.
PATTERNS=(
  '(^|[[:space:]/"'"'"'=])\.env($|[[:space:]]|\.)@@Reads or writes a .env file (secrets). Use .env.example for templates.'
  'secrets/@@Touches a secrets/ directory.'
  'git[[:space:]]+push[[:space:]].*(--force|-f([[:space:]]|$))@@Force-push is forbidden (main is protected; history is append-only).'
  'git[[:space:]]+push[[:space:]].*(^|[[:space:]:])main([[:space:]]|$)@@Pushing to main is forbidden; open a PR from a branch.'
  'gh[[:space:]]+pr[[:space:]]+merge@@Humans merge (constitution principle 7).'
  '(terraform|tofu)[[:space:]]+apply@@Infra apply is a human action with an approval gate.'
  'kubectl[[:space:]]+delete@@Destructive cluster command.'
  'az[[:space:]].*[[:space:]]delete@@Destructive Azure CLI command.'
  'rm[[:space:]]+-[a-z]*(r[a-z]*f|f[a-z]*r)[a-z]*[[:space:]]+/([[:space:]]|$)@@Refusing rm -rf on the filesystem root.'
  'ghp_[A-Za-z0-9]{20,}@@GitHub personal access token in command.'
  'gho_[A-Za-z0-9]{20,}@@GitHub OAuth token in command.'
  'AKIA[0-9A-Z]{16}@@AWS access key id in command.'
  'sk-[A-Za-z0-9_-]{20,}@@API secret key in command.'
  '-----BEGIN [A-Z ]*PRIVATE KEY@@Private key material in command.'
)

LOG="${GUARD_BASH_LOG:-${CLAUDE_PROJECT_DIR:-.}/.claude/audit.log}"

payload="$(cat)"

extract() {
  # $1 = jq path, $2 = python expression; prints "" when unavailable
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$payload" | jq -r "$1 // empty" 2>/dev/null || true
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$payload" | python3 -c "import json,sys
try:
    d=json.load(sys.stdin); print($2)
except Exception:
    pass" 2>/dev/null || true
  fi
}

command_text="$(extract '.tool_input.command' 'd.get("tool_input",{}).get("command","")')"
session_id="$(extract '.session_id' 'd.get("session_id","")')"

ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
if [[ -z "$command_text" ]]; then
  printf '%s\t%s\t%s\n' "$ts" "${session_id:-unknown}" "<unparsed payload>" >>"$LOG" 2>/dev/null || true
  exit 0
fi
printf '%s\t%s\t%s\n' "$ts" "${session_id:-unknown}" "${command_text//$'\n'/ }" >>"$LOG" 2>/dev/null || true

# Normalise: template env files are allowed, so remove them before matching.
normalised="$(printf '%s' "$command_text" | sed -E 's/\.env\.(example|template|sample)//g')"

for entry in "${PATTERNS[@]}"; do
  pattern="${entry%%@@*}"
  reason="${entry#*@@}"
  if printf '%s' "$normalised" | grep -Eiq -- "$pattern"; then
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"guard-bash: %s"}}\n' "$reason"
    exit 0
  fi
done
exit 0
