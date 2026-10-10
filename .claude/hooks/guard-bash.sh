#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash). Reads the tool call as JSON on stdin, appends the command to
# the audit log, and denies commands that touch secrets, production targets or protected refs.
# Docs: https://code.claude.com/docs/en/hooks  ·  Decisions: docs/adr/0001-hook-events.md (events),
# docs/adr/0008-retro-fold-1.md (what is matched where).
#
# Second line of defence behind permissions.deny in .claude/settings.json: permission rules match
# the literal command prefix, this script matches patterns in the command text, in two tiers.
#   HEAD_PATTERNS run against the command heads only. A heredoc body that is not fed to an
#   interpreter (`gh pr create --body-file - <<'EOF'`, `git commit -F -`, `cat > file`) and a quoted
#   -m/--body/--title value are text, not commands, and are blanked before matching. A quoted value
#   that contains `$(`, a backtick or `${` is kept: the shell expands it, so it is a command.
#   ANY_PATTERNS (secret material) run against the whole text: a token in a PR body is still a leak.
#   An unquoted heredoc tag (<<EOF) lets the shell expand the body, so body lines holding `$(`, a
#   backtick or `${` are kept; a heredoc without a terminator (or a literal `<<` inside a string)
#   falls back to matching the whole text. Known limit: a body written to a file and run on a later
#   line is not seen as code; the interpreter is detected on the heredoc line only.
# Needs GNU sed (-z, \x27) and a POSIX awk (mawk in CI). On another sed the pipeline exits non-zero
# and the hook fails open, like an unparsable payload. Never fails closed on missing tooling: if the
# payload cannot be parsed, it logs and allows.
set -euo pipefail

# --- deny patterns (case-insensitive ERE) with a static reason each ---------------------------
# Format: <ERE pattern>@@<reason>. Keep reasons free of quotes/backslashes: they go into JSON verbatim.
HEAD_PATTERNS=(
  '(^|[[:space:]/"'"'"'=(])\.env($|[[:space:]."'"'"';)|&<>])@@Reads or writes a .env file (secrets). Use .env.example for templates.'
  'secrets/@@Touches a secrets/ directory.'
  'git[[:space:]]+push[[:space:]].*(--force|-f([[:space:]]|$))@@Force-push is forbidden (main is protected; history is append-only).'
  'git[[:space:]]+push[[:space:]].*(^|[[:space:]:])main([[:space:]]|$)@@Pushing to main is forbidden; open a PR from a branch.'
  'gh[[:space:]]+pr[[:space:]]+merge@@Humans merge (constitution principle 7).'
  '(terraform|tofu)[[:space:]]+apply@@Infra apply is a human action with an approval gate.'
  'kubectl[[:space:]]+delete@@Destructive cluster command.'
  'az[[:space:]].*[[:space:]]delete@@Destructive Azure CLI command.'
  'rm[[:space:]]+-[a-z]*(r[a-z]*f|f[a-z]*r)[a-z]*[[:space:]]+/([[:space:]]|$)@@Refusing rm -rf on the filesystem root.'
  # Bash(pnpm exec *) is allowed in settings.json; permission rules match the command prefix only,
  # so the two escapes below are closed here instead (Owner, 2026-10-10).
  'pnpm[[:space:]]+exec[[:space:]]+(curl|wget)([[:space:]]|$)@@curl and wget are denied; pnpm exec does not change that.'
  '(^|[[:space:]]|[;&|(])(npx|pnpm[[:space:]]+dlx)[[:space:]]+@@npx and pnpm dlx fetch and run an arbitrary package; add it after review in the PR body, then use pnpm exec.'
)
ANY_PATTERNS=(
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

# Command heads: drop heredoc bodies unless the heredoc line runs an interpreter (then the body is
# code), and blank quoted message/body/title values unless the shell would expand them.
# Portable awk (mawk in CI): match() with RSTART/RLENGTH only. `<<<` is a here-string, not a heredoc.
# shellcheck disable=SC2016  # the $ and backticks in the sed program are for sed, not for the shell
heads="$(printf '%s\n' "$normalised" | awk '
  BEGIN { skip = 0; tag = ""; unquoted = 0; out = ""; all = "" }
  {
    all = all $0 "\n"
    if (skip) {
      line = $0; sub(/^[ \t]+/, "", line)
      if (line == tag) { skip = 0; next }
      if (unquoted && $0 ~ /\$\(|`|\$\{/) out = out $0 "\n"
      next
    }
    out = out $0 "\n"
    probe = $0; gsub(/<<</, "HERESTRING", probe)
    if (match(probe, /<<-?[ \t]*['"'"'"]?[A-Za-z_][A-Za-z0-9_]*['"'"'"]?/)) {
      t = substr(probe, RSTART, RLENGTH); sub(/^<<-?[ \t]*/, "", t)
      unquoted = (t !~ /^['"'"'"]/)
      gsub(/['"'"'"]/, "", t)
      rest = substr(probe, 1, RSTART - 1) " " substr(probe, RSTART + RLENGTH)
      if (rest !~ /(^|[ \t;&|(])([^ \t;&|(]*\/)?(bash|sh|zsh|dash|ksh|fish|node|deno|bun|python[0-9.]*|perl|ruby|php|eval|source|exec|xargs|ssh|\.)([ \t]|$)/) {
        skip = 1; tag = t
      }
    }
  }
  END { printf "%s", (skip ? all : out) }
' | sed -Ez 's/(^|[[:space:]])(-m|-b|-t|--message|--body|--title|--notes|--comment)([[:space:]]+|=)(\x27([^\x27`$]|\$[^({\x27`])*\x27|"(\\.|[^"\\`$]|\$[^({"`\\])*")/\1\2\3<text>/g')"

deny() {
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"guard-bash: %s"}}\n' "$1"
  exit 0
}

for entry in "${ANY_PATTERNS[@]}"; do
  if printf '%s' "$normalised" | grep -Eiq -- "${entry%%@@*}"; then deny "${entry#*@@}"; fi
done
for entry in "${HEAD_PATTERNS[@]}"; do
  if printf '%s' "$heads" | grep -Eiq -- "${entry%%@@*}"; then deny "${entry#*@@}"; fi
done
exit 0
