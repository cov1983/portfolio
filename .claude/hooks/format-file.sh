#!/usr/bin/env bash
# PostToolUse hook (matcher: Edit|Write). Reads the tool call as JSON on stdin and runs Prettier on
# the file the agent just wrote, so every edit lands formatted and `make format-check` has nothing
# to say at commit time. Docs: https://code.claude.com/docs/en/hooks
#
# Not part of the audit trail (docs/adr/0001-hook-events.md): it logs nothing. It never blocks an
# edit: every path exits 0, including a payload it cannot parse, a file outside the project, a
# vendored file under .agents/, a file Prettier ignores, or a missing Prettier. .prettierignore
# decides what is formatted (Markdown and docs/spec/** never are).
set -uo pipefail

payload="$(cat)"

extract() {
  # $1 = jq path, $2 = python expression; prints "" when unavailable (same helper as guard-bash.sh)
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

file="$(extract '.tool_input.file_path' 'd.get("tool_input",{}).get("file_path","")')"
[[ -n "$file" && -f "$file" ]] || exit 0

root="$(cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null && pwd -P)" || exit 0
dir="$(cd "$(dirname "$file")" 2>/dev/null && pwd -P)" || exit 0
file="$dir/$(basename "$file")"
case "$file" in
  "$root"/.agents/*) exit 0 ;; # vendored skills are used as they are (CLAUDE.md Boundaries)
  "$root"/*) ;;
  *) exit 0 ;; # outside the project: not ours to format
esac

pnpm exec prettier --write --ignore-unknown --log-level warn "$file" >/dev/null 2>&1 || true
exit 0
