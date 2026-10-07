# PROTOTYPE — Puck feel (throwaway)

**Question:** which ice-friction preset makes the Puck feel right under Direct Drive with a Follow
Camera? Answer goes into ADR 0005 in words; this code is then deleted (ADR 0003, issue #3).

Not production. No tests, no lint, no error handling. Lives on branch `chore/puck-feel-prototype`
only. Stack per ADR 0003: Vite, TypeScript, React Three Fiber, drei, Rapier.

## Run

From the repository root:

    make prototype

(or `pnpm --dir prototype/puck-feel install && pnpm --dir prototype/puck-feel dev`). Open the URL Vite prints.

## Controls

| Key            | Action                                                      |
| -------------- | ----------------------------------------------------------- |
| WASD / arrows  | Direct Drive, relative to the camera's yaw                  |
| 1 / 2 / 3      | Preset: Slick / Standard / Grippy (values shown on screen)  |
| R              | Reset to centre                                             |
| C              | Follow Camera mode: `fixed` world yaw ↔ swings behind travel |

## What each preset changes

`src/presets.ts` is the only file worth editing. Knobs: Coulomb friction μ (puck on ice, decelerates
at μ·g), Rapier linear damping (velocity-proportional drag), Direct Drive acceleration, speed cap,
board restitution.

## Protocol

Per preset, do these and note the feel in one or two sentences each:

1. Full-length sprint, release at the blue line: where does it stop?
2. Hit the far boards at full speed: does the bounce feel like hockey or like a bug?
3. U-turn at speed: can you place the Puck on a target, or does it skate past?
4. Thread between the centre line and a board using small taps.

Then pick one preset and write the verdict below.

## Verdict

_(fill in: preset chosen, the feel in words, any knob you changed from the defaults)_

## Measured (Rapier in Node, same bodies; release at top speed on flat ice)

| Preset   | time to top speed | coasting distance | coasting time |
| -------- | ----------------- | ----------------- | ------------- |
| Slick    | 0.9 s             | 47 m (≈ 1.2 rink lengths) | 9 s   |
| Standard | 0.6 s             | 19 m (≈ half a rink)      | 4 s   |
| Grippy   | 0.4 s             | 5 m                       | 1.3 s |

Slick was first tuned as real ice (μ 0.03, damping 0.05) and coasted 137 m: unplayable on a 40 m
Rink, so it was pulled in to about one rink length.

## Spike facts

- `vite build`: one chunk, about 3.4 MB raw / 1.17 MB gzipped with three.js, R3F, drei, Rapier
  (wasm inlined). Against the 4 MB initial-download ceiling in issue #3 before any World assets.
