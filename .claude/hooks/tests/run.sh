#!/usr/bin/env bash
# Smoke test for the hooks. Runs locally (`make test-shell`, part of `make verify`) and in CI (lint job).
# guard-bash.sh: fixtures named allowed-*.json / allowed.json must pass through silently with
# exit 0; fixtures named denied-*.json / denied.json must produce a deny decision.
# format-file.sh: an empty payload is a silent exit 0; a JSON file inside the project comes back
# formatted and a Markdown file next to it stays byte-identical (.prettierignore), both with the
# hook started from a different working directory. Before relying on that, the test asks Prettier
# itself (`--file-info`) which of the two fixtures the repo's ignore rules cover, so a change to
# .prettierignore fails here instead of silently testing nothing (retro 2026-10-10, PR 4). The
# fixtures live in a temp dir at the repo root (Prettier also honours .gitignore, so an ignored dir
# would hide the formatting); it is removed on exit. Those checks need Prettier (`make setup`);
# without it they are reported as SKIP, not as a failure.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
hook="$here/../guard-bash.sh"
export GUARD_BASH_LOG
GUARD_BASH_LOG="$(mktemp)"
FORMAT_TMP=""
trap 'rm -f "$GUARD_BASH_LOG"; [[ -n "$FORMAT_TMP" ]] && rm -rf "$FORMAT_TMP"' EXIT

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

root="$(cd "$here/../../.." && pwd -P)"
if (cd "$root" && pnpm exec prettier --version >/dev/null 2>&1); then
  FORMAT_TMP="$(mktemp -d "$root/format-file-smoke.XXXXXX")"
  printf '{"a":1}\n' >"$FORMAT_TMP/x.json"
  printf '# a  \n' >"$FORMAT_TMP/x.md"
  # The fixture choice rests on the repo's ignore rules: Prettier must format .json and ignore .md.
  ignored() { (cd "$root" && pnpm exec prettier --file-info "$1" 2>/dev/null | grep -Eo '"ignored": *(true|false)' | grep -Eo 'true|false'); }
  json_ignored="$(ignored "$FORMAT_TMP/x.json")"; md_ignored="$(ignored "$FORMAT_TMP/x.md")"
  if [[ "$json_ignored" == false ]]; then echo "PASS  format-file: Prettier reports x.json as not ignored"; else echo "FAIL  format-file: x.json ignored=$json_ignored; pick a fixture type the ignore rules do not cover"; fail=1; fi
  if [[ "$md_ignored" == true ]]; then echo "PASS  format-file: Prettier reports x.md as ignored"; else echo "FAIL  format-file: x.md ignored=$md_ignored; pick a fixture type the ignore rules cover"; fail=1; fi
  for f in x.json x.md; do
    out="$(cd / && printf '{"tool_input":{"file_path":"%s"}}' "$FORMAT_TMP/$f" | CLAUDE_PROJECT_DIR="$root" "$format")"; rc=$?
    if [[ $rc -ne 0 || -n "$out" ]]; then echo "FAIL  format-file: $f rc=$rc out=$out"; fail=1; fi
  done
  json="$(cat "$FORMAT_TMP/x.json")"; md="$(cat "$FORMAT_TMP/x.md")"
  if [[ "$json" == '{ "a": 1 }' ]]; then echo "PASS  format-file: JSON file inside the project is formatted"; else echo "FAIL  format-file: JSON not formatted: $json"; fail=1; fi
  if [[ "$md" == '# a  ' ]]; then echo "PASS  format-file: Markdown stays untouched (.prettierignore read from the project root)"; else echo "FAIL  format-file: Markdown was rewritten: $md"; fail=1; fi
else
  echo "SKIP  format-file: Prettier not available (run make setup)"
fi

exit "$fail"
