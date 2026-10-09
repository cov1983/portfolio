#!/usr/bin/env bash
# spec-freeze gate (CLAUDE.md Boundaries, docs/spec/README.md): a frozen spec changes only through
# commits whose subject starts with `amend:`. Usage: scripts/spec-freeze.sh BASE HEAD, where BASE is
# the merge base of the pull request and HEAD its last commit. For every docs/spec/*.md that differs
# between the two, the BASE version decides whether the file is frozen (its first line carries
# `Status: approved` or `Status: amended`); a frozen file may only be touched by `amend:` commits.
# Merge commits are skipped: merging main into a branch is not an edit. Pure git, no network.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "usage: $0 BASE HEAD" >&2
  exit 2
fi
base=$1
head=$2

violations=0
checked=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  # A file that did not exist at BASE is a new draft, never frozen. `read` takes the first line
  # without a pipeline, so a long file does not end in SIGPIPE under pipefail.
  if ! IFS= read -r status_line < <(git show "$base:$file" 2>/dev/null); then
    continue
  fi
  if ! grep -Eq 'Status: *(approved|amended)' <<<"$status_line"; then
    continue
  fi
  checked=$((checked + 1))
  while IFS= read -r commit; do
    [ -n "$commit" ] || continue
    subject=$(git log -1 --format=%s "$commit")
    case "$subject" in
      amend:*) ;;
      *)
        echo "spec-freeze: $file is frozen ($status_line) but $commit does not amend it: $subject" >&2
        violations=$((violations + 1))
        ;;
    esac
  done < <(git rev-list --no-merges "$base..$head" -- "$file")
done < <(git diff --name-only --no-renames "$base...$head" -- 'docs/spec/*.md')

if [ "$violations" -gt 0 ]; then
  echo "spec-freeze: $violations commit(s) edit a frozen spec without an amend: subject" >&2
  exit 1
fi
echo "spec-freeze: ok ($checked frozen spec file(s) changed, all through amend: commits)"
