// Fixed-timestep interpolation for the scene loop (plan §5): the model steps at FIXED_DT, frames
// arrive at the display's rate, so a frame holds 0, 1 or 2 steps of displacement. Rendering the
// state a fraction of a step behind, blended between the last two steps, makes the per-frame
// displacement smooth (Owner's feel sign-off on #41: the Puck juddered against the ice markings
// while the eased camera was smooth). Pure; no three, no Rapier.
import type { PuckState } from '../model/world'

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha
}

/** The state `alpha` of the way from `previous` to `current`: 0 is `previous`, 1 is `current`. */
export function interpolatePuck(previous: PuckState, current: PuckState, alpha: number): PuckState {
  return {
    position: {
      x: lerp(previous.position.x, current.position.x, alpha),
      z: lerp(previous.position.z, current.position.z, alpha),
    },
    velocity: {
      x: lerp(previous.velocity.x, current.velocity.x, alpha),
      z: lerp(previous.velocity.z, current.velocity.z, alpha),
    },
    speed: lerp(previous.speed, current.speed, alpha),
    height: lerp(previous.height, current.height, alpha),
    angularSpeed: lerp(previous.angularSpeed, current.angularSpeed, alpha),
  }
}

/** The fraction of a step left in the accumulator after the step loop, clamped to [0, 1]. */
export function renderAlpha(accumulator: number, stepDt: number): number {
  return Math.min(Math.max(accumulator / stepDt, 0), 1)
}
