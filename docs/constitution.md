# Constitution — Portfolio   v0.1-DRAFT (not ratified)

> DRAFT. Ratification (v1.0) happens after Phase 1 when the stack and scope are known.
> Until then this file guides work but its principles may still be reworded.

## Scope
Applies to all code, infra, docs and agent configuration in this repository.

## Principles (non-negotiable once ratified; a change requires a version bump + ADR)
1. Spec first: no implementation task without an approved spec section it traces to.
2. Tests prove behaviour: every acceptance criterion has at least one automated test.
3. Small increments: a ticket is one PR, reviewable in ≤ 30 min.
4. Secure by default: least privilege, no secrets in repo/prompts, input validated at boundaries.
5. Observable: the deployed site exposes health and basic metrics; every alert has a runbook.
6. Reproducible: builds are deterministic; dependencies and CI actions pinned; infra from code only.
7. Human accountability: the owner merges, approves infra apply, and accepts risk. The independent
   reviewer is an AI reviewer running in CI; its findings are addressed or dismissed with a reason
   before merge. Agents never merge.
8. Data boundaries: this is a public portfolio. No client or confidential data, no credentials, and
   no personal data beyond what the owner deliberately publishes may enter the repository, prompts
   or any AI tool context.

## Governance
- Amendments via PR touching this file, labelled `constitution`, approved by @cov1983.
- Specs, plans and tickets are checked against this document; violations are blockers, not warnings.
