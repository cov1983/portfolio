# docs/spec — frozen specifications

One file per feature: `docs/spec/<feature>.md`, template in `docs/workflow-guide.md` §7.3.
Status line at the top: `draft | approved | amended`.

- A spec is produced by `/to-spec` after `/grill-with-docs` (Phase 1, guide §4.1).
- Approval is a commit `spec: approve <feature>`; afterwards the file is frozen. A spec sentence the
  code outgrows is amended in the PR that outgrows it, never carried as a candidate for the next
  increment (T8b #33: the preload exception became an `amend:` after `ai-review`; ADR 0015).
- Changes to an approved spec are explicit `amend:` commits — agents must not edit a spec file otherwise.
  The CI job `spec-freeze` (`scripts/spec-freeze.sh`) fails a pull request that touches a frozen spec
  through any other commit; frozen is a `docs/spec/*.md` whose first line reads `Status: approved` or
  `Status: amended` at the merge base. This index carries no status line and is not frozen: it is
  edited in a plain `docs(spec):` commit, as #77 did (fold 2, ADR 0015).
- Required sections: user stories with Given/When/Then acceptance criteria, non-functional requirements, data classification, non-goals, open-questions list, empty before approval.

Specs: `increment-1.md` (written 2026-10-08 from issue #3; approved 2026-10-08, commit 408c7f8, and
frozen since; amended by 69bfe15, a8e8c3c (#55) and 8b687be (#63); shipped as increment-1 by T10 (#35),
measured on production 1bf12bd).
