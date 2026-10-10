# docs/runbooks — operational procedures

One file per procedure: `docs/runbooks/<topic>.md`. Every alert defined in Phase 5 (guide §4.5)
points at a runbook here; every incident ends with a runbook update and, where applicable, a
regression test.

Procedures:
- [`setup-wizard.md`](setup-wizard.md) — the one-time dashboard setup the Owner runs
  (`scripts/setup-wizard.sh`): Vercel project and Deployment Checks, the CI review key, Renovate,
  CodeQL, domain and DNS, required checks on `main`; what each stage changes and how to revert it.
