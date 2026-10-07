# ADR 0003 — TypeScript, React Three Fiber and Rapier for the 3D site

Status: Accepted (2026-10-07)

## Context

The site is a browser-only 3D World with real HTML overlays (Title Screen, Exhibit Panel, Fallback
Page) and a physics-driven Puck. It is the Owner's first real 3D web project, so the stack must
have a strong community, good TypeScript support and be well known to AI coding agents. The Owner
is learning three.js through Three.js Journey. Paid engines and closed-source tooling are refused.

## Decision

TypeScript (strict) with three.js through React Three Fiber (R3F) and the drei helpers; Rapier
(WebAssembly, via its R3F binding) for physics; Vite, Vitest, Playwright, ESLint, Prettier and
pnpm as the toolchain. Why: R3F is where the Owner's learning path ends up, it makes the HTML UI a
first-class part of the same tree, and its ecosystem is the one agents and docs cover best.

Considered and rejected:

- **Babylon.js**: capable, but a second ecosystem with far less R3F-style tooling and a smaller
  agent knowledge base.
- **Godot web export**: a full engine with its own language and build; the web export is large and
  the HTML UI would live outside the engine.
- **Plain three.js without React**: fewer layers while learning, but the overlays would need a
  second UI approach, and ready components (controls, loaders, physics bindings) are built for R3F.
- **cannon-es or hand-rolled 2D physics**: enough for a puck on a plane today, but every later
  Challenge wants real collisions, and Rapier is what the R3F ecosystem documents and maintains.

## Consequences

- Rapier's WebAssembly is the largest download after three.js. The spec's initial-download budget
  must cover three.js, R3F, Rapier and the World's assets together. Exhibit images and video are
  outside it: they load only with their Exhibit Panel.
- The Puck feel (ice friction) is settled by a throwaway `/prototype` built on this stack before
  the spec is written. The prototype doubles as the stack spike; its code is deleted afterwards and
  only the chosen feel is recorded in words.
- Toolchain details (configs, versions, CI gates) are Phase 0b work; this ADR records the choice,
  not the configuration.
