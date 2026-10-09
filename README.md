# Portfolio

An immersive, interactive 3D portfolio: visitors steer an ice-hockey puck through a playful virtual
world to discover Thomas's projects and background. Physics, hockey-inspired challenges and a bit of
storytelling turn browsing a CV into an experience that showcases the development work itself.

Status: **toolchain wired, Phase 0b in progress**. The spec for the first increment is approved
(`docs/spec/increment-1.md`), the stack is decided (`docs/adr/0003-web-3d-stack.md`) and the
vocabulary is in `GLOSSARY.md`. `src/` holds only the Phase 0b skeleton that proves the toolchain;
application code starts with the Phase 3 tickets.

## Run it locally
- **Devcontainer** (recommended): open the repo in VS Code and "Reopen in Container", or
  `devcontainer up --workspace-folder .`. The image (`.devcontainer/`) has Node 24, pnpm, make, jq
  and gitleaks; `make setup` runs on create.
- **Host**: Node 24 (`.nvmrc`), `corepack enable` (pnpm comes from `packageManager`), then
  `make setup` (installs the Playwright browsers too; their OS packages need sudo on a host).
- Then: `make verify` (format check, lint, types, unit and headless-physics tests), `make test-e2e`
  (production build driven in Chromium, Firefox and WebKit with axe; Firefox runs headed because
  headless Firefox has no WebGL: under Xvfb where `xvfb-run` exists, otherwise in a window on your
  display, and it fails to launch with neither), `make dev` (dev server),
  `make build` + `make preview` (production build). `make help` lists everything.

## Where to look
- `CLAUDE.md` / `AGENTS.md` — instructions for AI coding agents (identical files)
- `docs/workflow-guide.md` — the development process this repo follows
- `docs/constitution.md` — principles (v1.0, ratified 2026-10-08)
- `docs/spec/`, `docs/plan/`, `docs/adr/`, `docs/runbooks/`, `docs/retro.md`

## Branch & PR conventions
- `main` is protected by a ruleset: pull request required, no force-push, no deletion. Nobody pushes to `main`.
- Branch names: `chore/<topic>`, `feat/<topic>`, `fix/<topic>`. One ticket = one branch = one PR.
- Every PR uses the template in `.github/pull_request_template.md` and carries the label `ai-assisted`
  (agent-authored or agent-assisted change; this applies to every PR in this repo).
- Status checks, produced by `.github/workflows/ci.yml` (every job runs the same `make` targets a
  developer runs locally):

  | check | what it runs | required on `main` |
  |---|---|---|
  | `lint` | `make format-check lint typecheck`, agent-file identity and line count, shellcheck (hooks, pre-commit), actionlint, settings JSON, hook smoke test | yes |
  | `test` | `make test` (Vitest with the coverage ratchet) | yes |
  | `build` | `make build`, prints compressed asset sizes | after Phase 0b PR 4 (wizard updates the ruleset) |
  | `e2e` | `make test-e2e` (Playwright in Chromium, Firefox and WebKit with axe against the production build) | after Phase 0b PR 4 |
  | `gitleaks` | secret scan over full history | yes |

  Phase 0b PR 3 adds `perf`, `sast`, `deps`, `spec-freeze` and `ai-review`. Job ids
  stay stable across phases: the `main` ruleset and Vercel's Deployment Checks match them by name.
- The independent reviewer is an AI reviewer running in CI (`ai-review`, Phase 0b PR 3). Until then
  the Definition of Done item for it is ticked as "n/a".

## License
Three parts, detailed in `LICENSE`:
- **Code** (source, tests, tooling, CI, process docs): MIT, Copyright (c) 2026 Thomas Cova.
- **Vendored third-party components** under `.agents/` keep their own licenses; today that is the
  skills from `mattpocock/skills` (MIT), pinned in `skills-lock.json`.
- **Content** (Exhibit content, Bio, images, video, 3D models and other media): all rights reserved.
