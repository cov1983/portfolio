# docs/plan — implementation plans

One file per feature: `docs/plan/<feature>.md`, produced in Phase 2 (guide §4.2) from an approved spec.

Contents: architecture, stack decisions (each as an ADR stub in `docs/adr/`), data model, API/contracts,
test strategy, observability plan, security considerations, risks, rollout plan.

Approval is a commit `plan: approve <feature>`. Tickets are derived from the plan with `/to-tickets`.

Index
- [Phase 0b — harden the repository](phase-0b.md) — process plan (guide §4.0.2), approved 2026-10-09;
  four sequential PRs with the Owner decisions folded in and each PR's outcome recorded. Not a feature
  plan: the increment-1 plan is still to be written in Phase 2.
