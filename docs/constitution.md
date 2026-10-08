# Constitution — Portfolio   v1.0 (ratified 2026-10-08)

## Scope
Applies to all code, infra, docs and agent configuration in this repository.

## Principles (non-negotiable; a change requires a version bump + ADR)
1. Spec first: no implementation task without an approved spec section it traces to.
2. Tests prove behaviour: every acceptance criterion has at least one automated test, or a recorded
   Owner measurement where no automated seam exists.
3. Small tickets: a ticket is one PR, reviewable in ≤ 30 min.
4. Secure by default: least privilege, no secrets in repo/prompts, input validated at boundaries.
5. Observable: the site is static with no backend until a spec says otherwise. Observability means
   uptime checks and client-side performance metrics, not server health; every alert has a runbook.
6. Reproducible: builds are deterministic; dependencies and CI actions pinned; infra from code only.
7. Human accountability: the owner merges, approves infra apply, and accepts risk. The independent
   reviewer is an AI reviewer running in CI; its findings are addressed or dismissed with a reason
   before merge. Agents never merge.
8. Data boundaries: this is a public portfolio. No client or confidential data, no credentials, and
   no personal data beyond what the owner deliberately publishes may enter the repository, prompts
   or any AI tool context. An `employer-generic` Exhibit is committed only after the employer's
   written OK (e-mail is enough), referenced in the PR by date; the repository is public, so there
   is no draft state for such content. Nothing from employer systems or clients beyond a public
   profile.
9. Nothing gates content: a Challenge, a device check or a missing capability may add a hint, never
   remove access to an Exhibit.
10. No third-party embeds or scripts on the site. Nothing is stored and nothing is counted until a
   spec says otherwise. Audio, when added, is off until the Visitor turns it on.

## Governance
- Amendments via PR touching this file, labelled `constitution`, approved by @cov1983.
- Specs, plans and tickets are checked against this document; violations are blockers, not warnings.
