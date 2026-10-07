# ADR 0005 — Puck feel: the Standard ice preset, with a fixed-yaw Follow Camera

Status: Accepted (2026-10-07)

## Context

ADR 0003 left the Puck feel (ice friction under Direct Drive) to a throwaway `/prototype` on the
chosen stack, to be settled before the spec is written (issue #3). The prototype was one 40 m by
20 m Rink with boards, the Puck under Direct Drive, a Follow Camera, and three presets switchable
at runtime: Slick, Standard and Grippy. Each preset set Coulomb friction, linear damping, Direct
Drive acceleration, a speed cap and board restitution. The Owner drove all three and wrote the
verdict; the code was then deleted. Commit `d72851e` on branch `chore/puck-feel-prototype` is the
primary source. It must stay reachable: merge that branch with a merge commit, never a squash.

## Decision

The Puck feels like **Standard**, with the preset's values left unchanged: it reaches top speed
at about the blue line, which reads as realistic for the Rink size, and after release it glides a
little less than half a Rink. In the Owner's words, that is fast enough to feel like ice and slow
enough to stop at a Goal on purpose.

The Follow Camera keeps a fixed world yaw and trails the Puck's position. A camera that swings
behind the direction of travel was tried and gave a worse overview.

Considered and rejected by the Owner after driving them (descriptions are the prototype's design
intent, not the Owner's verdict):

- **Slick**: tuned as near-real ice, about one Rink length of glide after release. True ice values
  (μ ≈ 0.03) were tried first and coasted over three Rink lengths, unplayable on a Rink this size.
- **Grippy**: tuned as arcade handling, stops within a few metres and changes direction at once.

## Consequences

- ADR 0003 asked for the feel in words only; this ADR adds reference numbers because the code is
  gone and the plan needs a starting point. Measured in the prototype and reproduced in Rapier
  under Node: friction μ 0.1, linear damping 0.4 /s, acceleration 24 m/s², speed cap 12 m/s, board
  restitution 0.5; Puck mass 1, rotations locked. Top speed in about 0.6 s, about 19 m of glide
  from top speed in about 4 s. The spec records the feel; the numbers may move as long as the
  feel above holds, measured against the Hub's actual size.
- In the prototype Direct Drive was camera-relative; with the fixed-yaw Follow Camera that equals
  world-relative, so "up" is always the same direction on the ice. Keep that property.
- Rink dimensions change the feel. If the Hub is not about 40 m long, re-check the blue-line and
  half-Rink statements before freezing the spec.
- Spike facts for the plan: the full bundle with three.js, R3F, drei and Rapier (wasm inlined)
  built to about 1.2 MB gzipped, against the 4 MB initial-download ceiling in issue #3.
