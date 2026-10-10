# ADR 0009 — The World model owns Rapier and runs outside React; React Three Fiber mirrors it

Status: Proposed (2026-10-10; accepted by `plan: approve increment-1`)

## Context

The spec requires a World model that can be stepped under Node with inputs and a fixed timestep
and no renderer (test seam 2; AC-5.2, 7.1/7.3/7.4, 8, 9, 10, 11, 12.1, 13.1 and the model half of 14
are proven there). ADR 0003 names "Rapier (WebAssembly, via its R3F binding)"; `@react-three/rapier`
keeps the physics world inside a React tree, so a headless model would need a second copy of every
body. Phase 0b decision 12 left the binding out until a component needed it.

## Decision

`src/world/model` creates and steps the Rapier world directly (`@dimforge/rapier3d-compat`, the
package the model tests already use) and exposes `WorldModel` (step, reset, puck, place, events,
dispose). The scene (`src/world/scene`) reads the Puck pose and camera pose every frame and never
steps. App state (screen, panel, world status, capability) lives in one immutable object behind
`useSyncExternalStore`; the model is not React state. This supersedes the phrase "via its R3F
binding" in ADR 0003; the rest of ADR 0003 stands. `@react-three/rapier` and `zustand` are not added.

## Consequences

- One physics world, identical in tests and in the browser; model tests are deterministic.
- The scene loop owns the fixed-timestep accumulator; pausing is "do not step".
- A later Challenge with many bodies still lives in the model; the scene stays a mirror.
- **Q2, measured 2026-10-10** (tag `prototype/q1-q4`, commit adce29a; three `make perf` runs per package
  on the 10 Mbit profile against `vite preview`, medians): `@dimforge/rapier3d-compat` 0.19.2 puts
  `world-playable` at 1312 ms with 1,143,068 B downloaded (one `world` chunk: 3.14 MB raw,
  1.07 MB gzip); `@dimforge/rapier3d` 0.19.2 + `vite-plugin-wasm` 3.6.0 puts it at 1857 ms with
  1,915,168 B (a 1.09 MB chunk, 270 KB gzip, plus a 1.57 MB `.wasm` that the glue fetches only
  after the chunk has evaluated, and that `vite preview` serves uncompressed). The non-compat
  package buys nothing on either line (+545 ms, +772 KB): the streaming compile cannot pay for a
  second, serialised round trip. `vite preview`, which the gate measures, serves `.wasm`
  uncompressed while Vercel would compress it, so part of B's download gap is a measurement
  artefact; the decision rests on the +545 ms serialised second fetch, which compression does not
  remove. **The compat package stays.** Revisit only if the download line
  gets tight and the `.wasm` can be both preloaded next to the chunk (`modulepreload` does not
  cover it) and compressed by the server the gate measures.
