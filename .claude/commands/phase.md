Plan the ticket `$ARGUMENTS` (a GitHub issue number in `cov1983/portfolio`). Plan mode only: do not
edit files, do not commit.

1. Read `docs/constitution.md`, `CLAUDE.md` and `GLOSSARY.md`. Use the glossary's vocabulary in
   everything you write.
2. Read the ticket and its discussion: `gh issue view $ARGUMENTS --comments`. Follow its tasks in
   the order given; a comment from the Owner overrides the body.
3. For every spec section the ticket cites, open the file under `docs/spec/` and confirm its first
   line says `Status: approved` or `Status: amended`. A draft spec stops the planning: report which
   section is not approved and wait.
4. Read the plan the ticket names under `docs/plan/` and the ADRs under `docs/adr/` that touch the
   area; the plan of record wins over the ticket text where they differ, and a conflict between the
   spec and the code is written into the ticket under "Blockers", not resolved silently.
5. Produce the execution plan: for each task, the files to touch, the test that proves it (which of
   the two seams: `tests/e2e` in a browser or `tests/model` under Node), and the order, riskiest
   first. Name the commit for each task (conventional commit, scope = module). Note every new
   dependency with its license and the reason, so the PR body can list it.
6. Stop and wait for the Owner's approval of the plan.
