#!/usr/bin/env bash
# A stand-in for the previous hook in run.sh's self-test (#80): denies everything, like a hook that
# already had the pattern a fixture proves. The JSON is guard-bash.sh's own deny shape.
printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"prove/deny-all: a stub that denies everything"}}\n'
exit 0
