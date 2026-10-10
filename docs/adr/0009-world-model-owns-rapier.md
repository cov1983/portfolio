# ADR 0009 — The World model owns Rapier and runs outside React; React Three Fiber mirrors it

Status: Proposed (2026-10-10; accepted by `plan: approve increment-1`)

## Context
The spec requires a World model that can be stepped under Node with inputs and a fixed timestep
and no renderer (test seam 2; AC-5.2, 7–10, 11.1–11.3, 12, 14 are proven there). ADR 0003 names
"Rapier (WebAssembly, via its R3F binding)"; `@react-three/rapier` keeps the physics world inside a
React tree, so a headless model would need a second copy of every body. Phase 0b decision 12 left
the binding out until a component needed it.

## Decision
`src/world/model` creates and steps the Rapier world directly (`@dimforge/rapier3d-compat`, the
package the model tests already use) and exposes `WorldModel` (step, reset, puck, place, events).
The scene (`src/world/scene`) reads the Puck pose and camera pose every frame and never steps.
App state (screen, panel, world status, capability) lives in one immutable object behind
`useSyncExternalStore`; the model is not React state. This supersedes the phrase "via its R3F
binding" in ADR 0003; the rest of ADR 0003 stands. `@react-three/rapier` and `zustand` are not added.

## Consequences
- One physics world, identical in tests and in the browser; model tests are deterministic.
- The scene loop owns the fixed-timestep accumulator; pausing is "do not step".
- A later Challenge with many bodies still lives in the model; the scene stays a mirror.
- Q2 of the plan may swap the Rapier package for the non-compat one; this ADR is then amended with the numbers.
