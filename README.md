# Portfolio

An immersive, interactive 3D portfolio: visitors steer an ice-hockey puck through a playful virtual
world to discover Thomas's projects and background. Physics, hockey-inspired challenges and a bit of
storytelling turn browsing a CV into an experience that showcases the development work itself.

Status: **prototype / pre-spec**. The stack is decided (`docs/adr/0003-web-3d-stack.md`); the
vocabulary is in `GLOSSARY.md`. This repository currently holds the
process scaffolding (Phase 0a of `docs/workflow-guide.md`), not application code.

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
- Required status checks, produced by `.github/workflows/ci.yml`:

  | check | today | later |
  |---|---|---|
  | `lint` | agent-file consistency, shellcheck, settings JSON, hook smoke test, Makefile stubs | formatter, linter, type checker |
  | `test` | placeholder | unit / integration / e2e |
  | `gitleaks` | secret scan over full history | unchanged |

  **After the first CI run**, add all three to the `main` ruleset: Settings → Rules → Rulesets → main →
  "Require status checks to pass" → add `lint`, `test`, `gitleaks`. The job ids stay stable across
  phases so the ruleset never needs editing when the jobs grow real content.
- The independent reviewer is an AI reviewer running in CI; it is wired in Phase 0b. Until then the
  Definition of Done item for it is ticked as "n/a".

## License
Three parts, detailed in `LICENSE`:
- **Code** (source, tests, tooling, CI, process docs): MIT, Copyright (c) 2026 Thomas Cova.
- **Vendored third-party components** under `.agents/` keep their own licenses; today that is the
  skills from `mattpocock/skills` (MIT), pinned in `skills-lock.json`.
- **Content** (Exhibit content, Bio, images, video, 3D models and other media): all rights reserved.
