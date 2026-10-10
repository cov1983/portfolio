#!/usr/bin/env bash
# Smoke test for the hooks. Runs locally and in CI (lint job).
# guard-bash.sh: fixtures named allowed-*.json / allowed.json must pass through silently with
# exit 0; fixtures named denied-*.json / denied.json must produce a deny decision.
# format-file.sh: an empty payload is a silent exit 0, and a JSON file inside the project root
# (here: a temp dir passed as CLAUDE_PROJECT_DIR) comes back formatted. The second check needs
# Prettier (`make setup`); without it the check is reported as SKIP, not as a failure.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hook="$here/../guard-bash.sh"
export GUARD_BASH_LOG
GUARD_BASH_LOG="$(mktemp)"
trap 'rm -f "$GUARD_BASH_LOG"' EXIT

fail=0
for fixture in "$here"/*.json; do
  name="$(basename "$fixture" .json)"
  out="$("$hook" <"$fixture")"; rc=$?
  case "$name" in
    allowed*)
      if [[ $rc -eq 0 && -z "$out" ]]; then echo "PASS  $name (allowed)"; else echo "FAIL  $name: expected allow, rc=$rc out=$out"; fail=1; fi ;;
    denied*)
      if [[ $rc -eq 0 && "$out" == *'"permissionDecision":"deny"'* ]]; then echo "PASS  $name (denied)"; else echo "FAIL  $name: expected deny, rc=$rc out=$out"; fail=1; fi ;;
    *) echo "SKIP  $name (unknown prefix)" ;;
  esac
done

fixtures=("$here"/*.json)
lines="$(wc -l <"$GUARD_BASH_LOG")"
expected="${#fixtures[@]}"
if [[ "$lines" -eq "$expected" ]]; then echo "PASS  audit log has $lines entries"; else echo "FAIL  audit log has $lines entries, expected $expected"; fail=1; fi

# --- format-file.sh --------------------------------------------------------------------------
format="$here/../format-file.sh"
out="$(echo '{}' | "$format")"; rc=$?
if [[ $rc -eq 0 && -z "$out" ]]; then echo "PASS  format-file: empty payload is a silent exit 0"; else echo "FAIL  format-file: empty payload rc=$rc out=$out"; fail=1; fi

if (cd "$here/../../.." && pnpm exec prettier --version >/dev/null 2>&1); then
  tmp="$(mktemp -d)"
  printf '{"a":1}\n' >"$tmp/x.json"
  out="$(cd "$here/../../.." && printf '{"tool_input":{"file_path":"%s"}}' "$tmp/x.json" | CLAUDE_PROJECT_DIR="$tmp" "$format")"; rc=$?
  content="$(cat "$tmp/x.json")"
  rm -rf "$tmp"
  if [[ $rc -eq 0 && -z "$out" && "$content" == '{ "a": 1 }' ]]; then echo "PASS  format-file: JSON file inside the project root is formatted"; else echo "FAIL  format-file: rc=$rc out=$out content=$content"; fail=1; fi
else
  echo "SKIP  format-file: Prettier not available (run make setup)"
fi

exit "$fail"
