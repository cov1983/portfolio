# ADR 0005 — Puck feel: the Standard ice preset

Status: Accepted (2026-10-07)

## Context

ADR 0003 left the Puck feel (ice friction under Direct Drive) to a throwaway `/prototype` on the
chosen stack, to be settled before the spec is written (issue #3). The prototype was one 40 m by
20 m Rink with boards, the Puck under Direct Drive, a Follow Camera, and three presets switchable
at runtime: Slick, Standard and Grippy. Each preset set Coulomb friction, linear damping, Direct
Drive acceleration, a speed cap and board restitution. The Owner drove all three and wrote the
verdict; the code was then deleted. The prototype branch `chore/puck-feel-prototype` (commit
`d72851e`) is the primary source.

## Decision

The Puck feels like **Standard**: it reaches top speed at about the blue line, which reads as
realistic for the Rink size, and after release it glides a little less than half a Rink. That is
fast enough to feel like ice and slow enough to stop at a Goal on purpose. Boards give a firm,
moderate bounce, never a dead stop and never a pinball.

The Follow Camera keeps a fixed world yaw and trails the Puck's position. A camera that swings
behind the direction of travel was tried and gave a worse overview.

Rejected:

- **Slick**: near-real ice, about one Rink length of glide after release. Needs anticipation the
  Visitor has no reason to bring; the Puck skates past the Goal. True ice values (μ ≈ 0.03) were
  tried first and coasted over three Rink lengths, unplayable on a Rink this size.
- **Grippy**: arcade handling, stops within a few metres and turns on the spot. Precise, but it no
  longer feels like a puck on ice, which is the whole point of the World.

## Consequences

- Starting values for the spec and plan, measured in the prototype and reproduced in Rapier under
  Node: friction μ 0.1, linear damping 0.4 /s, acceleration 24 m/s², speed cap 12 m/s, board
  restitution 0.5; Puck mass 1, rotations locked. Top speed in about 0.6 s, about 19 m of glide
  from top speed in about 4 s. The spec records the feel; the numbers may move as long as the
  feel above holds, measured against the Hub's actual size.
- Direct Drive is camera-relative; with the fixed-yaw Follow Camera that equals world-relative, so
  "up" is always the same direction on the ice.
- Rink dimensions change the feel. If the Hub is not about 40 m long, re-check the blue-line and
  half-Rink statements before freezing the spec.
- Spike facts for the plan: the full bundle with three.js, R3F, drei and Rapier (wasm inlined)
  built to about 1.2 MB gzipped, against the 4 MB initial-download ceiling in issue #3.
