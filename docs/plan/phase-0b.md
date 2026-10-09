# Plan: Phase 0b — harden the repository

Status: accepted by the Owner on 2026-10-09 in the plan-mode review (a process plan for guide
§4.0.2, not a feature plan, so there is no `plan: approve` commit under guide §4.2). Ticket: #9,
sub-issues #10 (PR 1), #11 (PR 2), #12 (PR 3), #13 (PR 4). Guide: `docs/workflow-guide.md` §4.0.2,
adapted for a static site on Vercel. Spec: `docs/spec/increment-1.md` (Non-functional requirements,
Testing decisions). Stack: ADR 0003.

This file is the plan of record. It was approved before PR 1 and committed in PR 2 with the Owner
decisions of 2026-10-09 folded in and the outcome of PR 1 and PR 2 recorded, so later sessions read
it from here. Deviations made while implementing are listed per PR under "As delivered"; PR 4 is
still the plan as approved.

## Context

The spec is approved and ADR 0003 fixes the stack (TypeScript strict, React Three Fiber, Rapier,
Vite, Vitest, Playwright, ESLint + Prettier, pnpm). Before Phase 0b the repo held only Phase 0a
scaffolding: Makefile stubs, a placeholder CI (`lint`, `test`, `gitleaks`), the guard-bash and
log-session hooks and the docs. Phase 0b wires the real toolchain so that `make verify` runs the
same commands locally (devcontainer) and in CI, adds every automated gate the spec calls for
(performance budget, three-browser Playwright with axe, headless Rapier seam, coverage ratchet,
SAST, dependency and secret scans, spec-freeze gate, independent AI review), decides hosting
(ADR 0006, Vercel) and hands the human-only steps to a committed `/wizard` script. No feature
code: the skeleton only proves each seam end to end.

About 1,500 changed lines excluding the lockfile, split into **four sequential PRs**, each leaving
`main` green and usable on its own.

## Owner decisions (2026-10-09, binding for all four PRs)

1. **Node 24** (`.nvmrc`, `engines`, devcontainer image, CI).
2. **Version policy**: for every package the newest version that the *whole* toolchain's peer
   ranges agree on, resolved with `npm view <pkg> peerDependencies` before `pnpm add`; exact
   versions in `package.json`; the resolved table (package · version · license · reason) goes into
   the PR body. TypeScript 7 only if vite, vitest, typescript-eslint and @types/react all accept it
   (they did not: TS 6.0.3). pnpm 10 (what Vercel detects from the lockfile), pinned with its
   integrity hash. Actions pinned by commit SHA with a version comment.
3. **Dependency gate**: `actions/dependency-review-action` is the blocking gate on PRs; `pnpm audit`
   is **non-blocking** (PRs and weekly).
4. **`ai-review` skips Renovate PRs** (`github.actor == 'renovate[bot]'` or head branch `renovate/*`).
5. **The Lighthouse run retries once** on any breach or error and **always prints all three budget
   numbers** (measured · limit · pass/fail), both runs.
6. **PRs strictly sequential**: PR n+1 starts only after PR n is merged, from a fresh branch off
   `main`. No stacking, no retargeting.
7. **Devcontainer kept** as the reference toolchain (`.devcontainer/`); `make setup` on create.
8. **Coverage ratchet moves only on request**: floor 80 on all four metrics; `make coverage-ratchet`
   (`COVERAGE_RATCHET=1`) is the only thing that rewrites the thresholds; a plain `make test` never
   changes the file; lowering needs an ADR. (PR #14 review.)
9. **No `scripts` block in `package.json`**: make is the single entry point. Anything that would
   have used an npm script (`prepare`, Vercel's `buildCommand`) uses `make` or `pnpm exec`.
   (PR #14 review.)
10. **No husky**: the pre-commit hook is a plain script under `.githooks/`, wired by `make setup`
    with `git config core.hooksPath`. (Ticket #11, 2026-10-09.)
11. **actionlint in PR 2**: the `lint` job runs actionlint, which shellchecks every `run:` block
    (the rule the PR 1 retro line asked for). (Ticket #11, 2026-10-09.)
12. **Unused dependencies are not added**: drei (ADR 0003) and `@react-three/rapier` arrive with the
    first component that uses them. Rapier's wasm package is pinned to the version the binding
    bundles so one copy ships. (PR #14 and PR 2.)

Assumptions stated at approval, not asked: the Phase 0b prompt is the ticket, with one GitHub issue
and four sub-issues so every PR links a ticket; the agent cannot push, every PR ends with "commits
ready, please push"; `.github/workflows/**` and `.claude/**` edits are in scope because the ticket
says so; `.agents/**` stays untouched (the wizard library is used as is and our stages never call
`write_env`); response headers are a plan decision per the spec, so `vercel.json` carries none.

Not in scope, listed for the retro: the guard-bash "match only the command head" suggestion;
license allow/deny lists in the dependency scan (license is a PR-body DoD item).

## PR split

| # | branch | ticket | content | status |
|---|---|---|---|---|
| 1 | `chore/phase-0b` | #10 | devcontainer, pnpm/Vite/TS/R3F skeleton, ESLint + Prettier, Vitest + coverage ratchet, real Makefile, CI `lint`/`test`/`build` real, CLAUDE.md/AGENTS.md | merged, PR #14 |
| 2 | `chore/phase-0b-e2e` | #11 | Playwright 3 browsers + axe, headless Rapier model test, `world-playable` instrument, `make test-e2e`, CI `e2e`, pre-commit hook, actionlint, this file | merged, PR #15 |
| 3 | `chore/phase-0b-gates` | #12 | CI `perf` (Lighthouse budget), `sast` (CodeQL), `deps`, `spec-freeze`, `ai-review`; Renovate; ADR 0007; README checks table; PR template wording | this PR |
| 4 | `chore/phase-0b-hosting` | #13 | `vercel.json`, ADR 0006, `.claude` settings widening + format hook + `commands/{phase,fix-review}.md`, docs READMEs, wizard script + runbook, final CLAUDE.md/AGENTS.md | planned |

Every PR: conventional commits (one task per commit, agent trailer), `make verify` before each
commit, `/code-review` before `gh pr create --label ai-assisted`, retro line in `docs/retro.md`, PR
template with only the true DoD boxes ticked, new dependencies listed with license and reason.

---

## PR 1 — toolchain skeleton (`chore/phase-0b`, #10, merged as #14)

### As planned
- `.devcontainer/`: `typescript-node:5-24-bookworm` pinned by digest; make, jq, gitleaks (pinned
  release tarball, sha256-checked), corepack; github-cli feature; `postCreateCommand: make setup`.
  Playwright browsers are never baked in: `make setup` installs them so browser and package versions
  cannot drift.
- `package.json`: `packageManager` pnpm 10 with hash, `engines.node >=24`, `type: module`, exact
  versions. `.nvmrc`, `.npmrc` (`engine-strict=true`), lockfile.
- `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, bundler resolution),
  `tsconfig.json` (src, DOM, `vite/client`), `tsconfig.node.json` (configs).
- `vite.config.ts` (react plugin, no source maps), `vitest.config.ts` (see ratchet), `eslint.config.js`
  (flat: typescript-eslint strict-type-checked, react-hooks, react-refresh, eslint-config-prettier),
  `.prettierrc`, `.prettierignore` (Markdown and `docs/spec/**` never formatted), `.editorconfig`.
- `index.html`, `src/main.tsx`, `src/App.tsx` (one `<h1>` and one `<Canvas>` with one mesh),
  `src/vite-env.d.ts`.
- `src/perf/world-playable.ts` + test: `markWorldPlayable(recorder)` records the `world-playable`
  user-timing once (idempotent); provisional instrument for AC-4.1; unit test with a fake recorder.
  No jsdom and no component test: the spec defines exactly two seams.
- `Makefile`: `setup`, `format`, `format-check`, `lint`, `typecheck`, `test`, `coverage-ratchet`,
  `verify` (= format-check lint typecheck test), `build`, `dev`, `preview`, `help`.
- `.github/actions/setup/action.yml` (composite: pnpm from `packageManager`, Node from `.nvmrc`,
  pnpm cache, frozen install). `ci.yml`: `lint` (make format-check lint typecheck + the Phase 0a
  checks + 150-line limit on CLAUDE.md), `test` (make test, coverage artifact), `build` (make build,
  gzip sizes of `dist/assets/*`), `gitleaks` unchanged but pinned to the devcontainer's version.
- CLAUDE.md = AGENTS.md (byte-identical, ≤ 150 lines), README run-locally and checks table.

### Coverage ratchet
`coverage.include: src/**/*.{ts,tsx}` minus `main.tsx`, `App.tsx`, `vite-env.d.ts`, tests; v8;
thresholds lines/functions/branches/statements; `autoUpdate` only when `COVERAGE_RATCHET=1`
(decision 8). The include list is the policy and is stated in CLAUDE.md.

### As delivered (PR #14)
Resolved versions and the dependency table are in the PR body. Deviations: drei left out until a
component uses it (decision 12); `stylisticTypeChecked` removed on review; `setup-node`'s built-in
pnpm cache instead of a separate cache step; nine compiler options moved into `tsconfig.base.json`;
Prettier excludes Markdown and the hook fixtures; `.claude/settings.json` left untouched until PR 4.
On the development VM the host runs Node 22, so every make target ran through `docker run` of the
devcontainer image.

---

## PR 2 — e2e seam, model seam, pre-commit (`chore/phase-0b-e2e`, #11)

### As planned
- `playwright.config.ts`: `testDir: tests/e2e`, projects chromium / firefox / webkit, `webServer`
  = `vite preview` on 4173 (`reuseExistingServer` outside CI), list + html reporter, `retries: 0`,
  `forbidOnly` in CI.
- `tests/e2e/skeleton.spec.ts`: the built root page shows the skeleton heading and a canvas; axe
  with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` reports no violations. Presence and
  wiring only, never WebGL output (CI renders WebGL in software).
- `tests/model/rapier-headless.test.ts`: `await RAPIER.init()` from `@dimforge/rapier3d-compat`
  under Node, a ground collider and one dynamic ball, a fixed number of fixed timesteps, assert it
  rests on the ground. Spec seam 2, deterministic, no GPU. Fallback if init refuses under Node: the
  non-compat package with Vite's wasm plugin, as an Owner decision.
- `vitest.config.ts`: `test.projects` `unit` (`src/**/*.test.ts`) and `model` (`tests/model/**`,
  20 s timeout). Coverage settings stay at the root.
- `src/App.tsx`: calls `markWorldPlayable(performance)` from the first `useFrame`, so PR 3's budget
  has a mark to read.
- `Makefile`: `test-e2e` = `build` + `playwright test`; `setup` gains the browser install.
- `ci.yml`: `e2e` (needs `build`) → setup, browsers, `make test-e2e`, `playwright-report/` artifact
  on failure.
- Pre-commit: lint-staged (Prettier on everything it knows, ESLint on staged TypeScript) then
  `gitleaks git --pre-commit --staged --redact`, warning and continuing when gitleaks is missing
  (the CI `gitleaks` job is the gate; the devcontainer has it). Shellchecked in `lint`.
- CLAUDE.md/AGENTS.md: `make test-e2e`, pre-commit note, map entries `tests/e2e`, `tests/model`.
- Dependencies: @playwright/test (Apache-2.0), @axe-core/playwright (MPL-2.0),
  @dimforge/rapier3d-compat (Apache-2.0), lint-staged (MIT).

### As delivered (PR #15)
- **No husky, no `scripts` block** (decisions 9, 10): `.githooks/pre-commit`, `make setup` sets
  `core.hooksPath`. lint-staged runs ESLint with `--no-warn-ignored` so an ignored path does not
  trip `--max-warnings 0`.
- **`@react-three/rapier` not added** (decision 12); `@dimforge/rapier3d-compat` pinned to 0.19.2,
  the version the binding 2.2.0 bundles, instead of the newest 0.21.0.
- **A third e2e test** asserts the `world-playable` mark is recorded on the first frame, in all
  three browsers: the proof that the App wiring works and what PR 3 depends on.
- **Headless Firefox has no WebGL** on a machine without a GPU, whatever the software-GL prefs
  (verified in the devcontainer image); headed Firefox under Xvfb gets Mesa llvmpipe. The firefox
  project runs headed, `make test-e2e` wraps Playwright in `xvfb-run -a` where it exists (CI,
  devcontainer), the devcontainer gains `xauth` (xvfb-run needs it). Without WebGL the skeleton page
  goes blank because the Canvas throws: that is AC-22.1/22.2 territory for Phase 3 (error boundary,
  readable message), not fixed here.
- `tsconfig.node.json` covers `playwright.config.ts` and `tests/**` and adds the DOM lib, because
  the e2e spec imports `src/perf/world-playable.ts`, whose type slices the DOM `Performance`.
- **actionlint** in the `lint` job (decision 11): official image 1.7.12, pinned by digest.
- `make browsers` (Playwright browsers with OS packages) is shared by `make setup` and the CI `e2e`
  job, so CI runs no ad-hoc pnpm command; `make setup` sets the hooks path before that sudo step.
- The `e2e` test "heading and canvas" became two tests (one assertion concept each); the model
  project uses `hookTimeout` for the wasm init in `beforeAll`. Both from `/code-review`.
- The README checks table gained the `e2e` row here, not in PR 3.

---

## PR 3 — CI gates, Renovate (`chore/phase-0b-gates`, #12)

### CI shape (`.github/workflows/ci.yml`, one workflow, job ids = job names, stable)
```
lint ─► test ─► build ─► e2e
                   └───► perf
sast · deps · gitleaks · spec-freeze        (independent, start immediately)
ai-review  (needs lint, test, build; pull_request only)
```
Independent gates run in parallel instead of a strict chain: same gates, shorter wall-clock; the
requested order is kept wherever there is a real dependency. Workflow-level `permissions: contents:
read`, widened per job only where needed. Every `uses:` pinned to a commit SHA with `# vX.Y.Z`.

- **`perf`** (needs `build`): `make perf` → `scripts/perf-budget.mjs`: builds, serves `dist/` with
  `vite preview`, launches Chrome via `chrome-launcher` with `--headless=new --use-gl=angle
  --use-angle=swiftshader --enable-unsafe-swiftshader`, runs Lighthouse 13 programmatically with
  `throttlingMethod: 'devtools'` (real throttling, so the custom mark is real) and the profile from
  `perf/budget.json` (`downloadThroughputKbps: 10240`, `uploadThroughputKbps: 5120`,
  `requestLatencyMs: 40`, `cpuSlowdownMultiplier: 1`, desktop form factor, screen emulation off),
  then evaluates three lines:
  1. Title Screen interactive: `audits.interactive.numericValue` ≤ 2000 ms (TTI is still computed
     in Lighthouse 13, only hidden from the report; the plan may swap it for a Title Screen mark).
  2. World playable: `audits['user-timings'].details.items` mark `world-playable` `startTime`
     ≤ 5000 ms (fails if the mark is missing).
  3. Download until playable: Σ `transferSize` of `audits['network-requests'].details.items` with
     `networkEndTime ≤ mark.startTime` and `resourceType ∉ {Image, Media}` ≤ 4 MiB (Lighthouse 12
     removed `budget.json`, so this is computed here).
  Pure `evaluateBudget(lhr, budget)` in `scripts/perf/budget.mjs` with a Vitest unit test (project
  `unit` include widened to `scripts/**/*.test.*`). The runner **always prints all three numbers**
  (measured · limit · pass/fail) even when one is missing or the run errors, writes
  `.lighthouse/lhr.json` (uploaded as artifact), and on any breach or Lighthouse error **retries the
  whole Lighthouse run once** before exiting 1 (decision 5; both runs' numbers are printed). Budget
  numbers live in `perf/budget.json` only.
- **`sast`**: `github/codeql-action/init@v4` (`languages: javascript-typescript`, `build-mode:
  none`) + `analyze@v4` (`category: /language:javascript-typescript`); job `permissions:
  security-events: write, contents: read`. PR and push to main. Requires default setup to be off
  (wizard stage).
- **`deps`** (decision 3): `actions/dependency-review-action@v5` on `pull_request` is the blocking
  gate (`fail-on-severity: high`, `comment-summary-in-pr: on-failure`, job `pull-requests: write`).
  `pnpm audit --audit-level=high` runs **non-blocking** (`continue-on-error: true`, result surfaced
  as a `::warning`) as a second step of `deps` on PRs, and weekly in its own workflow
  `.github/workflows/audit.yml` (`schedule: Monday 06:00 UTC`, `workflow_dispatch`), so the weekly
  trigger does not run the whole CI. `deps` is `pull_request`-only; nothing audit-related runs on
  push to main.
- **`gitleaks`**: unchanged.
- **`spec-freeze`** (`pull_request` only, `fetch-depth: 0`): `scripts/spec-freeze.sh BASE HEAD`: for
  each `docs/spec/*.md` changed in `BASE...HEAD` whose BASE version contains `Status: approved`,
  every commit in `BASE..HEAD` touching it must have a subject starting with `amend:`; otherwise
  print file + offending commit and exit 1. Pure git, no network; shellchecked in `lint`; verified
  with a throwaway local branch in the PR's reviewer notes.
- **`ai-review`** (`pull_request`, same-repo PRs only; **skipped for Renovate**, decision 4):
  `anthropics/claude-code-action@<sha> # v1.0.x` with `anthropic_api_key:
  ${{ secrets.ANTHROPIC_API_KEY }}`, `github_token: ${{ secrets.GITHUB_TOKEN }}` (no Claude GitHub
  App, no `id-token`, comments appear as github-actions[bot]), `use_sticky_comment: true`, prompt =
  guide §7.7 reviewer prompt + instructions to read `CLAUDE.md`, `docs/constitution.md`,
  `GLOSSARY.md`, the linked spec sections and the ticket, and to finish with one top-level
  `gh pr comment`; `claude_args: --model claude-opus-5-5 --max-turns 40 --allowedTools
  "Bash(gh pr view:*),Bash(gh pr diff:*),Bash(gh pr comment:*),Bash(gh issue view:*)"
  --disallowedTools "Edit,Write,MultiEdit,NotebookEdit"` (reviewer model ≠ implementer model,
  guide §6). Job `permissions: contents: read, pull-requests: write`. A first step checks the secret
  and skips the review with a `::notice` when it is empty, so PRs stay green before the wizard has
  run. Not a required check (findings are a DoD item).
- `README.md`: checks table → required set `lint`, `test`, `build`, `e2e`, `perf`, `sast`, `deps`,
  `gitleaks`, `spec-freeze` (not `ai-review`); ruleset edit = wizard stage.
- `.github/pull_request_template.md`: "once wired" → real job names; "Independent AI review
  (`ai-review`)".
- `make perf` is a Makefile target (decision 9); `scripts/` joins `tsconfig.node.json`.

### Renovate (`renovate.json`)
```json
{ "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":semanticCommits", "helpers:pinGitHubActionDigests", ":dependencyDashboard"],
  "pinDigests": true,
  "lockFileMaintenance": { "enabled": true, "automerge": true },
  "packageRules": [
    { "matchUpdateTypes": ["patch", "pin", "pinDigest", "digest"], "groupName": "patch updates", "automerge": true, "automergeType": "pr" },
    { "matchUpdateTypes": ["minor"], "automerge": false },
    { "matchUpdateTypes": ["major"], "dependencyDashboardApproval": true } ] }
```
Majors appear as checkboxes on the Dependency Dashboard issue (the "ticket"); the Owner ticks one
to get its PR. Automerge uses GitHub native auto-merge, which needs "Allow auto-merge" on the repo
and at least one required status check (wizard stage). `vercel.json` disables previews for
`renovate/*` branches. No onboarding PR because the config is committed. Renovate also keeps the
devcontainer image digest and the actionlint image digest current.

### `docs/adr/0007-renovate-automerge.md`
Constitution 7 says agents never merge; a bot merging a grouped patch PR that passed every gate is
the guide §5 exception ("bot PRs auto-merge only for patch + green"); humans still own minors and
majors. One decision per ADR, so it is separate from 0006.

### As delivered (this PR)
- **Scripts are TypeScript**, not `.mjs`: `scripts/perf-budget.ts`, `scripts/perf/budget.ts` and its
  test run under plain Node 24 (type stripping, `.ts` import extensions, `allowImportingTsExtensions`
  in `tsconfig.node.json`), so ESLint and `tsc` cover them. The pure evaluator takes the Lighthouse
  result as `unknown` and narrows it; a malformed `perf/budget.json` is a typed `BudgetFileError`.
- **Chrome**: chrome-launcher finds the runner's Chrome in CI. Elsewhere `CHROME_PATH` names one
  (Playwright's Chromium after `make browsers`; `@playwright/test` exports no launcher, so the planned
  automatic fallback does not exist) and `CHROME_NO_SANDBOX=1` adds `--no-sandbox` inside a
  container, where Chrome's sandbox cannot start; `--window-size=1350,940` gives the headless window
  a desktop size since screen emulation is off. Measured on the skeleton in the devcontainer: Title
  Screen interactive ≈ 0.6 s, World playable ≈ 0.55 s, 308 KB until playable; the forced breach
  printed both runs and exited 1; a taken port prints the three lines with the error and exits 1.
- **`ai-review` sets `track_progress: true` next to `use_sticky_comment: true`** and the review is
  written into the tracking comment: with a `prompt` the action runs in agent mode and creates no
  tracking comment (verified in the action source, v1.0.248), so `use_sticky_comment` alone is a
  no-op and `gh pr comment` would add one comment per push. Allowed tools:
  `mcp__github_comment__update_claude_comment` plus the three `gh` read commands; `gh pr comment`
  dropped. Unverified end to end until the key exists.
- **`spec-freeze`** also treats `Status: amended` as frozen and skips merge commits (a merge from
  `main` is not an edit). Verified in a scratch clone: the real `amend:` commit from PR 2, a plain
  commit on the approved spec (fails, names file and commit), the same edit as `amend:`, a merge of a
  moved `main`, an `amend:` followed by a plain commit (fails), a new draft (passes).
- **The weekly `audit.yml` run exits non-zero on findings**: still non-blocking (nothing requires
  it), the red run is the notification. The PR-side audit step only warns.
- **Dependency graph** was off on the repository (dependency-review needs it); the Owner enabled it
  while this PR was built. CodeQL default setup was already off, so `sast` uploads.
- **The download limit is 4 MB decimal, 4,000,000 bytes** (Owner, 2026-10-10): the spec's "≤ 4 MB
  compressed" is read as decimal megabytes, not the 4 MiB (4,194,304 B) the PR 3 text above says.
- Pinned: lighthouse 13.5.0, chrome-launcher 1.2.2 (both Apache-2.0); codeql-action v4.38.3,
  dependency-review-action v5.0.0, claude-code-action v1.0.248 by commit SHA.
- From `/code-review`: `spec-freeze.sh` verifies both refs and works from their merge base, so an
  unresolvable ref exits 2 instead of a green empty diff (CI passes main's tip as BASE); the
  reviewer may read CI results (`gh pr checks`, a guide §7.7 input); the evaluator
  `scripts/perf/budget.ts` joined the coverage ratchet scope (CLAUDE.md updated); one `isRecord`,
  one `LINE_SPECS` table behind `evaluateBudget` and `failedReport`; a failed run logs the stack to
  stderr. Dismissed: docs in one trailing commit (the plan's commit split; the checks table
  describes the final shape), three `perf` directories (named by the plan of record).

---

## PR 4 — hosting, agent config, wizard (`chore/phase-0b-hosting`, #13)

### Vercel
- `vercel.json` (the only hosting config in the repo; `/vercel.json @cov1983` added to CODEOWNERS):
```json
{ "$schema": "https://openapi.vercel.sh/vercel.json", "framework": "vite",
  "installCommand": "pnpm install --frozen-lockfile", "buildCommand": "pnpm exec vite build", "outputDirectory": "dist",
  "cleanUrls": true, "trailingSlash": false, "git": { "deploymentEnabled": { "renovate/*": false } } }
```
  (`buildCommand` is `pnpm exec vite build`, not an npm script: decision 9.)
- `docs/adr/0006-hosting-vercel.md`: Context (static output, per-PR previews required by guide
  §4.4, no backend, solo budget). Decision (Vercel Git integration: preview per PR, production only
  from `main`, production promotion held by Vercel **Deployment Checks** until the GitHub jobs
  pass). Considered and rejected: GitHub Pages + artifact preview (no real per-PR URL without a
  third-party action, one environment), Cloudflare Pages (comparable; weaker Vite/R3F docs
  coverage, domain purchase outside the flow), Azure Static Web Apps (staging per PR but Azure
  account/subscription overhead for a static site). Consequences: `vercel.json` only; reversible
  because the custom domain is Owner-owned and no Vercel-specific code exists; no
  analytics/speed-insights scripts (constitution 10); an uptime check is still to be chosen
  (constitution 5); dashboard settings that cannot live in the file (production branch, Deployment
  Checks, domain) are in the wizard.
- `docs/adr/README.md` index (+0006, +0007); `docs/spec/README.md` (increment-1 approved
  2026-10-08; the `spec-freeze` CI gate enforces the `amend:` rule); `docs/runbooks/README.md` →
  `setup-wizard.md`.

### Claude Code config (`.claude/`)
- `settings.json` allow += `Edit(/src/**)`, `Edit(/tests/**)`, `Edit(/scripts/**)`, `Bash(pnpm *)`,
  `Bash(make setup)`, `Bash(make format*)`, `Bash(make lint)`, `Bash(make typecheck)`,
  `Bash(make test-e2e)`, `Bash(make perf)`; every deny kept verbatim; `ask` unchanged. Hooks +=
  `PostToolUse` matcher `Edit|Write` → `.claude/hooks/format-file.sh`: reads `tool_input.file_path`
  from stdin JSON (same jq/python extraction as guard-bash), runs `pnpm exec prettier --write
  --ignore-unknown` when the file is inside the project and not under `.agents/`, always exits 0.
- `.claude/hooks/tests/run.sh`: add a format-file smoke (`echo '{}' |` exits 0 silently, and a
  `.md` fixture in a temp dir gets formatted); shellcheck list extended.
- `.claude/commands/phase.md` (guide §7.5 adapted): read `docs/constitution.md`, `CLAUDE.md`,
  `GLOSSARY.md` and ticket `$ARGUMENTS` via `gh issue view --comments`; confirm the spec sections it
  cites are `Status: approved`; produce the execution plan (per task: files, proving test, order);
  stop. `.claude/commands/fix-review.md`: read PR review comments and the `ai-review` comment
  (`gh pr view --comments`, `gh api repos/{owner}/{repo}/pulls/N/comments`), address each in its own
  commit, run `make verify`, stop before push and ask the Owner.

### Wizard (`scripts/setup-wizard.sh` + `docs/runbooks/setup-wizard.md`)
Generated with `/wizard`: copy `.agents/skills/wizard/template.sh` unchanged above the marker,
author stages below it, set `TOTAL_STAGES=8`. Helpers used: `open_url`, `step`, `note`, `warn`,
`pause`, `confirm`, `ask_secret`, `set_secret`. **Never `write_env`**; the only captured value
(`ANTHROPIC_API_KEY`) goes to `gh secret set` and matches `secrets.ANTHROPIC_API_KEY` in ci.yml.
Stages (dependency order; paths verified in research, dated in the script header):
1. **Vercel project**: vercel.com/new → import `cov1983/portfolio` (install the Vercel GitHub App on
   this repo only; settings read from `vercel.json`); confirm Settings → Environments → Production →
   Branch Tracking = `main`; confirm a preview deployment appeared on the open PR.
2. **Vercel Deployment Checks**: Settings → Build and Deployment → Deployment Checks → Add Checks →
   GitHub → select `lint`, `test`, `build`, `e2e`, `perf`, `sast`, `deps`, `gitleaks`, `spec-freeze`
   (checks match by job name; the script prints the list from one array shared with stage 8).
3. **ANTHROPIC_API_KEY**: console.anthropic.com → API keys → create a key named
   `portfolio-ci-review` → `ask_secret` → `set_secret ANTHROPIC_API_KEY`. Note the review model and
   that the key is used read-only.
4. **Renovate**: github.com/apps/renovate → install on this repo only; repo Settings → General →
   enable "Allow auto-merge"; confirm the Dependency Dashboard issue appears.
5. **CodeQL**: Settings → Advanced Security → Code scanning: if "CodeQL analysis · default setup"
   is on, switch it to advanced (the committed `sast` job uploads results; default setup blocks
   uploads); confirm Dependency graph is on (dependency-review needs it); after the next CI run,
   Security → Code scanning shows results.
6. **Domain**: vercel.com/domains → search and buy (`confirm` before purchase: irreversible, costs
   money) or point an existing domain's nameservers at Vercel; assign it to the project under
   Settings → Domains; DNS records under Domains → Advanced Settings.
7. **`main` ruleset required checks**: github.com/cov1983/portfolio/settings/rules → `main` →
   Require status checks → add `build`, `e2e`, `perf`, `sast`, `deps`, `spec-freeze`; keep `lint`,
   `test`, `gitleaks`.
8. **Smoke**: `gh secret list` shows the key; `gh api repos/cov1983/portfolio/rulesets/24534327`
   lists the nine checks; print what remains manual (`SKIPPED`).
Verification: `bash -n`, `shellcheck`, `chmod +x`, static trace of value → destination. Never run
end to end by the agent. Runbook: when to re-run, what each stage changes, how to revert.

### Final docs
- CLAUDE.md/AGENTS.md: hosting line (Vercel; `vercel.json` only; dashboard steps in the wizard),
  `.claude/commands`, `scripts/` in the map, wizard pointer; ≤ 150 lines, byte-identical.
- `docs/retro.md`: one line per PR.

---

## Verification (end to end)
1. **PR 1** (done): in the devcontainer image, `make setup && make verify` green; `make build`
   emits `dist/`; CI `lint`, `test`, `build` green; `cmp CLAUDE.md AGENTS.md` and `wc -l` ≤ 150.
2. **PR 2** (done in the devcontainer image plus a throwaway layer with the browsers): `make
   test-e2e` green in Chromium, Firefox and WebKit with zero axe violations; `make test` runs the
   Rapier model test under Node; a staged file with a formatting error is rewritten by the
   pre-commit hook and a staged fake GitHub token makes it exit 1; `shellcheck` and `actionlint`
   pass. CI `e2e` is the first run on a GitHub runner.
3. **PR 3**: all jobs appear; `perf` prints the three budget lines and passes on the skeleton
   (skeleton bundle ≈ 1.2 MB gzip per ADR 0005); on a throwaway local branch, editing a line of the
   approved spec makes `scripts/spec-freeze.sh main HEAD` fail and an `amend:` commit makes it
   pass; `sast` uploads results (after the wizard's CodeQL stage); `deps` passes; `ai-review` is
   skipped with a notice until the key exists, then posts one sticky comment.
4. **PR 4**: `.claude/hooks/tests/run.sh` passes; `bash -n` + shellcheck on the wizard; after the
   Owner runs the wizard: Vercel preview URL on the PR, production promotion held until checks
   pass, Renovate dashboard issue open, CodeQL results visible, ruleset lists nine required checks.
5. Every PR: `/code-review` run, findings addressed or dismissed with reason in the PR body.
