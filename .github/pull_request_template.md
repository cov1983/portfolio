## <Ticket / Phase NN> — <name>
Ticket: #…   Spec: docs/spec/<feature>.md §…   Plan: docs/plan/<feature>.md

### Summary
<!-- what changed and why, 3–6 lines; link the ticket's acceptance criteria -->

### Definition of Done
- [ ] All tasks in the ticket complete; blockers section empty
- [ ] Every acceptance criterion in scope has a test; `make verify` and full test suite green
- [ ] Coverage ≥ threshold (ratchet); no new skipped tests
- [ ] No new lint/type suppressions without comment + issue
- [ ] Security: secret scan (`gitleaks`) and, once wired, SAST/dependency scans green; new deps listed below with license + reason
- [ ] Docs updated (README/API/ADR/runbook as applicable); CHANGELOG entry once one exists
- [ ] Observability: new paths emit logs/metrics/traces per plan
- [ ] Infra changes: `plan` output attached; no `apply` performed by an agent
- [ ] Independent AI review (CI job, added in Phase 0b) findings addressed or explicitly dismissed with reason
- [ ] Commits conventional, one task per commit, agent trailer present; PR labelled `ai-assisted`
- [ ] One line appended to `docs/retro.md` after merge

### New dependencies
<!-- name · version · license · reason — or "none" -->

### Risk & rollback
<!-- what could break, how to detect it, how to roll back -->

### Reviewer notes (what to look at first)
