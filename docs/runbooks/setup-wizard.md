# Runbook — the setup wizard (`scripts/setup-wizard.sh`)

The wizard walks the Owner through the steps an agent must not do: creating the Vercel project,
holding production behind the CI gates, storing the one CI secret, installing Renovate, switching
CodeQL to the committed workflow, pointing the domain at Vercel and making every gate a required
check on `main`. Nothing it does lives in the repository; this page says what each stage changes,
where, and how to undo it. Generated with `/wizard` in Phase 0b PR 4 (ticket #13); the library half
of the script is `.agents/skills/wizard/template.sh` unchanged, the stages are ours.

## When to run it

- Once, after Phase 0b PR 4 is merged: the repository is complete, the dashboards are not.
- Again, in part, when a stage's target changes: a new API key (stage 3), a new domain (stage 6), a
  job renamed in `ci.yml` (stages 2 and 7: both read the `CHECKS` array at the top of the script, so
  update that array first), a fresh Vercel project. Every stage ends with a y/N question; answer `n`
  to a stage you are not repeating and it is listed under "still to do by hand" instead of failing.
- Never by an agent, never in CI: it opens a browser and waits for a human at every stage.

## How to run it

```
gh auth status            # stage 3 and the smoke stage use gh; without it they are reported as skipped
scripts/setup-wizard.sh
```

Ctrl-C stops it at any point; re-run from the start and answer `n` to the stages already done. The
wizard captures exactly one value, `ANTHROPIC_API_KEY`, through hidden input, and hands it straight
to `gh secret set`; it never writes a dotenv file and never prints the key. The variable is unset
before the next stage.

## What each stage changes, and how to revert it

| stage | where | what changes | revert |
|---|---|---|---|
| 1 Vercel project | vercel.com, GitHub app installation | A Vercel project linked to `cov1983/portfolio`; the Vercel GitHub App installed on this repository only; production tracks `main`; a preview per pull request | Project → Settings → Advanced → Delete Project; GitHub → Settings → Applications → Vercel → Uninstall |
| 2 Deployment Checks | Vercel project → Settings → Build and Deployment → Deployment Checks | Production deployments wait for the nine CI jobs named in `CHECKS` before they are aliased to the domain | Remove the checks there; "Force Promote" on a deployment bypasses them once |
| 3 `ANTHROPIC_API_KEY` | console.anthropic.com; GitHub repository secrets | A key named `portfolio-ci-review`; the repository secret the `ai-review` job reads | Delete the key in the console (the job goes back to "skipped with a notice"); `gh secret delete ANTHROPIC_API_KEY` |
| 4 Renovate | github.com/apps/renovate; repository Settings → General | The Renovate app on this repository; "Allow auto-merge" on; a Dependency Dashboard issue | Uninstall the app; untick "Allow auto-merge" (ADR 0007: patch PRs then wait for the Owner) |
| 5 CodeQL, dependency graph | repository Settings → Code security | CodeQL "default setup" off so the committed `sast` job can upload; dependency graph on for the `deps` job | Switch default setup back on (the `sast` job then fails to upload; remove the job first) |
| 6 Domain | Vercel project → Settings → Domains; Infomaniak DNS zone | The Owner's existing domain assigned to the project; an A record (apex) and a CNAME (`www`) in the Infomaniak zone with the values Vercel shows; Vercel issues the certificate. Fallback, only on an explicit yes: a domain bought through Vercel | Remove the domain from the project; delete the two records at Infomaniak (the old site, if any, needs its records back) |
| 7 `main` ruleset | github.com/cov1983/portfolio/settings/rules → `main` (id 24534327) | Required status checks go from `lint`, `test`, `gitleaks` to all nine in `CHECKS` | Remove checks from the ruleset; never below `lint`, `test`, `gitleaks` |
| 8 Smoke | read-only `gh` calls | Nothing; prints what it could verify (secret present, auto-merge on, ruleset lists the nine checks) and what stays manual | – |

## What stays manual after the wizard

- Confirming in the Vercel dashboard that the preview appeared on the open pull request and that a
  merge to `main` produced a production deployment that waited for the checks.
- Choosing and configuring the uptime check (constitution principle 5; ADR 0006 leaves it open).
- Rotating `ANTHROPIC_API_KEY`: create the new key, re-run the wizard answering `n` to every stage
  but 3, then delete the old key in the console.

## Related

`docs/adr/0006-hosting-vercel.md` (why Vercel), `docs/adr/0007-renovate-automerge.md` (why
auto-merge), `vercel.json` (every build setting; the dashboard carries none),
`.github/workflows/ci.yml` (the job names the checks match).
