#!/usr/bin/env bash
# SessionEnd hook: one line per session for the compliance trail (docs/adr/0001-hook-events.md).
# Fields: utc-timestamp  session_id  cwd  branch  HEAD  transcript_path
set -euo pipefail

LOG="${LOG_SESSION_FILE:-${CLAUDE_PROJECT_DIR:-.}/.claude/sessions.log}"
payload="$(cat)"

field() {
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$payload" | jq -r ".$1 // empty" 2>/dev/null || true
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$payload" | python3 -c "import json,sys
try:
    print(json.load(sys.stdin).get('$1',''))
except Exception:
    pass" 2>/dev/null || true
  fi
}

session_id="$(field session_id)"
cwd="$(field cwd)"
transcript="$(field transcript_path)"
branch="$(git -C "${cwd:-.}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo n/a)"
head="$(git -C "${cwd:-.}" rev-parse --short HEAD 2>/dev/null || echo n/a)"

mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
printf '%s\t%s\t%s\t%s\t%s\t%s\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${session_id:-unknown}" "${cwd:-n/a}" "$branch" "$head" "${transcript:-n/a}" \
  >>"$LOG" 2>/dev/null || true
exit 0
