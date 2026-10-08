# docs/spec — frozen specifications

One file per feature: `docs/spec/<feature>.md`, template in `docs/workflow-guide.md` §7.3.
Status line at the top: `draft | approved | amended`.

- A spec is produced by `/to-spec` after `/grill-with-docs` (Phase 1, guide §4.1).
- Approval is a commit `spec: approve <feature>`; afterwards the file is frozen.
- Changes to an approved spec are explicit `amend:` commits — agents must not edit this directory otherwise.
- Required sections: user stories with Given/When/Then acceptance criteria, non-functional requirements, data classification, non-goals, open-questions list, empty before approval.

Specs: `increment-1.md` (draft, written 2026-10-08 from issue #3; awaiting review and the `spec: approve` commit).
