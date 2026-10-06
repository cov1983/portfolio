#!/usr/bin/env bash
# Smoke test for guard-bash.sh. Runs locally and in CI (lint job).
# Fixtures named allowed-*.json / allowed.json must pass through silently with exit 0;
# fixtures named denied-*.json / denied.json must produce a deny decision.
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

exit "$fail"
