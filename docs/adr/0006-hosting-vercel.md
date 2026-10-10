# ADR 0006 — Vercel hosts the site through its Git integration; `vercel.json` is the only hosting config

Status: Accepted (2026-10-10)

## Context

The site is static output (`dist/` from `pnpm exec vite build`, decision 9 of the Phase 0b plan: no
`scripts` block) with no backend (constitution principle 5, spec "Availability"). The guide (§4.4)
asks for an ephemeral preview per pull request so the Owner and the independent reviewer can try
behaviour, not only read code; the spec handed the hosting choice and the domain to the plan
(`docs/spec/increment-1.md`, open questions). The project is solo and unfunded: one dashboard, no
cloud account to administer, and a production release that cannot go out before the CI gates pass.

Candidates named in the spec: GitHub Pages with an artifact preview, Cloudflare Pages, Vercel,
Netlify, Azure Static Web Apps.

## Decision

Vercel, through its GitHub integration ("Vercel for GitHub"), with the project imported from
`cov1983/portfolio`:

- A preview deployment per pull request; production deployments only from `main` (Branch
  Tracking = `main` under Settings → Environments → Production).
- Production promotion is held by Vercel **Deployment Checks** until the GitHub jobs `lint`, `test`,
  `build`, `e2e`, `perf`, `sast`, `deps`, `gitleaks` and `spec-freeze` have passed for that commit.
  Checks match CI job names, which is why the job ids are stable (CLAUDE.md).
- `vercel.json` at the repository root is the only hosting configuration: framework preset,
  install and build commands, output directory, clean URLs, no trailing slash, and no deployment
  for `renovate/*` branches (their gates run in CI; a preview of a patch bump is noise). No
  response headers: the spec treats them as a plan decision and none is needed for a static site
  today.
- Settings that cannot live in the file (production branch, Deployment Checks, the custom domain
  and its DNS) are stages of the setup wizard (`scripts/setup-wizard.sh`,
  `docs/runbooks/setup-wizard.md`), run by the Owner.

## Considered and rejected

- **GitHub Pages + artifact preview**: no real per-PR URL without a third-party action; one
  environment, so production and preview cannot differ; no hold-until-green for production.
- **Cloudflare Pages**: comparable features and price; weaker documentation coverage for Vite and
  React Three Fiber; the domain purchase happens outside the deployment flow.
- **Azure Static Web Apps**: staging environment per PR, but an Azure account and subscription to
  administer for a static site with no backend.
- **Netlify**: comparable; not evaluated further once Vercel's Deployment Checks matched the
  "production only after the gates" requirement without extra workflow code.

## Consequences

- One config file, no Vercel-specific code: the site stays plain static output, so moving hosts
  means a new config file and new DNS records. The custom domain is Owner-owned, not bought through
  Vercel.
- No Vercel Analytics or Speed Insights scripts: constitution principle 10 forbids third-party
  scripts on the site. Observability stays uptime checks and client-side metrics (principle 5); the
  uptime check is still to be chosen and gets its own ticket once the site is on its domain.
- `vercel.json` is owned by `@cov1983` in CODEOWNERS like the workflow files: it decides what runs
  on the host.
- Until the Owner runs the wizard there is no project, no preview URL and no production hold; the
  repository is unchanged by that, so the wizard can be run any time after this PR merges.
