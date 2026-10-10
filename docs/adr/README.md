# docs/adr — architecture decision records

One file per decision: `docs/adr/NNNN-<slug>.md`, numbered sequentially, never renumbered.

Record decisions that are hard to explain later: stack choices, workflow changes (guide §4.0.3),
security trade-offs, and anything an agent proposed that a human accepted ("the model suggested it"
is not a decision record — guide §5.2).

Minimal format: Status · Context · Decision · Consequences. Supersede, don't edit.

Index
- [0001 — Hook events for the audit trail](0001-hook-events.md)
- [0002 — Issue tracker and vocabulary file](0002-tracker-and-glossary.md)
- [0003 — TypeScript, React Three Fiber and Rapier for the 3D site](0003-web-3d-stack.md)
- [0004 — Pre-rendered root and Fallback Page; the World hydrates on top](0004-pre-rendered-root.md)
- [0005 — Puck feel: the Standard ice preset, with a fixed-yaw Follow Camera](0005-puck-feel.md)
- [0006 — Vercel hosts the site through its Git integration; `vercel.json` is the only hosting config](0006-hosting-vercel.md)
- [0007 — Renovate merges grouped patch updates that passed every gate](0007-renovate-automerge.md)
