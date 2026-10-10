# Portfolio

An immersive, interactive 3D portfolio: visitors steer an ice-hockey puck through a playful virtual
world to discover Thomas's projects and background. Physics, hockey-inspired challenges and a bit of
storytelling turn browsing a CV into an experience that showcases the development work itself.

Status: **toolchain and gates wired; Phase 0b ends when the Owner runs the setup wizard**. The
spec for the first increment is approved (`docs/spec/increment-1.md`), the stack is decided
(`docs/adr/0003-web-3d-stack.md`), hosting is Vercel (`docs/adr/0006-hosting-vercel.md`,
`vercel.json`) and the vocabulary is in `GLOSSARY.md`. `src/` holds only the Phase 0b skeleton that
proves the toolchain; application code starts with the Phase 3 tickets.

## Run it locally
- **Devcontainer** (recommended): open the repo in VS Code and "Reopen in Container", or
  `devcontainer up --workspace-folder .`. The image (`.devcontainer/`) has Node 24, pnpm, make, jq,
  shellcheck and gitleaks; `make setup` runs on create. `devcontainer-lock.json` pins the feature digests and
  is committed; the first container start regenerates it, so a diff there is a feature update.
- **Host**: Node 24 (`.nvmrc`), `corepack enable` (pnpm comes from `packageManager`), then
  `make setup` (installs the Playwright browsers too; their OS packages need sudo on a host).
- Then: `make verify` (format check, lint, types, shellcheck, the hook and gate tests, unit and
  headless-physics tests), `make test-e2e`
  (production build driven in Chromium, Firefox and WebKit with axe; Firefox runs headed because
  headless Firefox has no WebGL: under Xvfb where `xvfb-run` exists, otherwise in a window on your
  display, and it fails to launch with neither), `make dev` (dev server, listening on every
  interface so VS Code port forwarding reaches it), `make build` + `make preview` (production
  build), `make perf` (the Lighthouse budget; needs a Chrome: `CHROME_PATH` where none is installed
  system-wide, `CHROME_NO_SANDBOX=1` inside a container). `make help` lists everything.

## Where to look
- `CLAUDE.md` / `AGENTS.md` — instructions for AI coding agents (identical files)
- `docs/workflow-guide.md` — the development process this repo follows
- `docs/constitution.md` — principles (v1.0, ratified 2026-10-08)
- `docs/spec/`, `docs/plan/`, `docs/adr/`, `docs/runbooks/`, `docs/retro.md`
- `docs/runbooks/setup-wizard.md` — the one-time dashboard setup (`scripts/setup-wizard.sh`) and how to revert it

## Branch & PR conventions
- `main` is protected by a ruleset: pull request required, no force-push, no deletion. Nobody pushes to `main`.
- Branch names: `chore/<topic>`, `feat/<topic>`, `fix/<topic>`. One ticket = one branch = one PR.
- Every PR uses the template in `.github/pull_request_template.md` and carries the label `ai-assisted`
  (agent-authored or agent-assisted change; this applies to every PR in this repo).
- Status checks, produced by `.github/workflows/ci.yml` (every job runs the same `make` targets a
  developer runs locally):

  | check | what it runs | required on `main` |
  |---|---|---|
  | `lint` | `make format-check lint typecheck`, agent-file identity and line count, `make shellcheck` (hooks, pre-commit, gates and their tests), actionlint, settings JSON, `make test-shell` (hook smoke tests, spec-freeze gate test) | yes |
  | `test` | `make test` (Vitest with the coverage ratchet) | yes |
  | `build` | `make build`, prints compressed asset sizes | after the setup wizard's ruleset stage |
  | `e2e` | `make test-e2e` (Playwright in Chromium, Firefox and WebKit with axe against the production build) | after the setup wizard |
  | `perf` | `make perf`: Lighthouse budget from `perf/budget.json` against the production build (Title Screen interactive, World playable, download until playable; one retry, all three numbers always printed) | after the setup wizard |
  | `sast` | CodeQL, javascript-typescript, results under Security → Code scanning | after the setup wizard |
  | `deps` | dependency review of the lockfile change (blocks at severity high); `pnpm audit` as a warning, and weekly in `audit.yml` | after the setup wizard |
  | `gitleaks` | secret scan over full history | yes |
  | `spec-freeze` | `scripts/spec-freeze.sh`: an approved spec changes only through `amend:` commits | after the setup wizard |
  | `ai-review` | independent Claude review (`anthropics/claude-code-action`, read-only tools, one tracking comment); skipped with a notice until `ANTHROPIC_API_KEY` is stored, and for Renovate branches | no: its findings are a Definition of Done item |

  Job ids stay stable across phases: the `main` ruleset and Vercel's Deployment Checks match them
  by name. Every job that runs project code ends with `.github/actions/clean-worktree`, which fails
  when the job left untracked or modified files: whatever a tool generates is committed or
  gitignored in the same PR (ADR 0008).
- The independent reviewer is the `ai-review` job. It posts once the setup wizard
  (`scripts/setup-wizard.sh`, runbook in `docs/runbooks/setup-wizard.md`) stores
  `ANTHROPIC_API_KEY`; until then the Definition of Done item for it is ticked as "n/a".
- Hosting is Vercel through its GitHub integration (ADR 0006): a preview deployment per pull
  request, production from `main` only, and Deployment Checks hold the production alias until the
  required jobs above pass. `vercel.json` is the whole configuration; the dashboard-only settings
  are stages of the setup wizard.
- Dependencies are kept current by Renovate (`renovate.json`, ADR 0007): grouped patch updates
  auto-merge once every required check is green, minors are ordinary PRs, majors wait for a tick on
  the Dependency Dashboard issue.

## License
Three parts, detailed in `LICENSE`:
- **Code** (source, tests, tooling, CI, process docs): MIT, Copyright (c) 2026 Thomas Cova.
- **Vendored third-party components** under `.agents/` keep their own licenses; today that is the
  skills from `mattpocock/skills` (MIT), pinned in `skills-lock.json`.
- **Content** (Exhibit content, Bio, images, video, 3D models and other media): all rights reserved.
