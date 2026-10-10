#!/usr/bin/env bash
# Test for the spec-freeze gate (scripts/spec-freeze.sh). Runs locally (`make test-shell`, part of
# `make verify`) and in CI (lint job). Builds a scratch repository with one approved spec of two
# thousand lines (the first line is read without a pipeline: PR 3 lost every frozen spec to SIGPIPE
# under pipefail) and checks the gate's three answers: a plain commit on a frozen spec fails, an
# `amend:` commit passes, a new draft file passes. Every shell gate ships with a passing and a
# failing case before its CI job exists (retro 2026-10-10, PR 3). Needs only git.
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
gate="$here/spec-freeze.sh"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

git_() { git -C "$scratch" -c user.name=test -c user.email=test@example.invalid -c commit.gpgsign=false "$@"; }
commit() { git_ add -A >/dev/null && git_ commit -q -m "$1"; }

git_ init -q -b main
mkdir -p "$scratch/docs/spec"
{ echo 'Status: approved'; echo; seq -f 'line %g of the frozen spec' 1 2000; } >"$scratch/docs/spec/a.md"
commit 'spec: approve a'
base="$(git_ rev-parse HEAD)"

fail=0
run_gate() { (cd "$scratch" && "$gate" "$base" "$(git rev-parse HEAD)" >/dev/null 2>&1); echo $?; }
expect() { # $1 = case name, $2 = expected exit code
  rc="$(run_gate)"
  if [[ "$rc" == "$2" ]]; then echo "PASS  spec-freeze: $1 (exit $rc)"; else echo "FAIL  spec-freeze: $1: expected exit $2, got $rc"; fail=1; fi
  git_ checkout -q "$base"
}

git_ checkout -q -b plain-edit
echo 'an unreviewed sentence' >>"$scratch/docs/spec/a.md"
commit 'docs: tweak the spec'
expect 'a plain commit on a frozen spec fails' 1

git_ checkout -q -b amend-edit
echo 'a reviewed sentence' >>"$scratch/docs/spec/a.md"
commit 'amend: a reviewed sentence'
expect 'an amend: commit on a frozen spec passes' 0

git_ checkout -q -b new-draft
printf 'Status: draft\n\nnew spec\n' >"$scratch/docs/spec/b.md"
commit 'spec: draft b'
expect 'a new draft spec passes' 0

exit "$fail"
