# ADR 0007 — Renovate merges grouped patch updates that passed every gate

Status: Accepted (2026-10-10)

## Context

Constitution principle 7 says the Owner merges and agents never merge. Guide §5 (Dependencies) names
one exception: bot pull requests auto-merge only for patch updates that are green. Phase 0b PR 3
(ticket #12) adds Renovate (`renovate.json`) to keep npm packages, the pinned GitHub Actions, the
devcontainer image digest and the actionlint image digest current. Without automerge every patch
bump is a pull request the Owner has to open, read and merge by hand, on a solo project where the
gates (`lint`, `test`, `build`, `e2e`, `perf`, `sast`, `deps`, `gitleaks`, `spec-freeze`) already
prove what a human would check for a patch.

## Decision

Renovate may merge, through GitHub's native auto-merge, a pull request that bundles **patch, pin
and digest updates** ("patch updates" group) or **lockfile maintenance**, and only once every
required status check on `main` is green. Everything else stays with the Owner: minor updates
arrive as ordinary pull requests, major updates appear as checkboxes on the Dependency Dashboard
issue and get a pull request only when the Owner ticks one. The independent AI review is skipped for
Renovate branches (plan, Owner decision 4): nothing in a version bump is for it to review, and the
gates are the review. Commits follow the conventional format (`:semanticCommits`), so the history
reads the same for bot and human changes.

This is the guide §5 exception made explicit, not a change to principle 7: the bot is not an agent
that wrote code, and it merges nothing a human would have had to think about.

## Consequences

- Renovate needs "Allow auto-merge" on the repository and at least one required status check on
  `main`; both are stages of the setup wizard (Phase 0b PR 4). Until then its patch pull requests
  wait for the Owner like any other.
- A patch that breaks the site must be caught by a gate; when one slips through, the fix is a
  stronger gate, not a weaker automerge rule (retro, `docs/retro.md`).
- Reversible: delete the `automerge` keys from `renovate.json` and every update returns to the
  Owner. The `main` ruleset keeps protecting the branch either way.
