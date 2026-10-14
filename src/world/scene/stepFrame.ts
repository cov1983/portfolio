// The scene's fixed-timestep loop (plan §5, Scene loop ↔ model), pure so the unit project can
// prove it: WorldCanvas.tsx calls it once per frame while the World is not paused.
import { FIXED_DT, type WorldEvent } from '../model/world'

// Plan §5: a frame longer than 0.1 s (a tab in the background) counts as 0.1 s, and one frame runs
// at most four steps (0.067 s), after which the remainder is dropped so a stall never spirals.
// Below 15 fps the World therefore runs slower than real time, by design: the Visitor sees a
// slower Puck, never a jump.
export const MAX_FRAME_DT = 0.1
export const MAX_STEPS_PER_FRAME = 4

/**
 * Adds the frame's delta to `accumulator`, runs `step` once per FIXED_DT in it and returns what is
 * left. The step that emits `goal` is the frame's last: the store pauses the World on that event
 * (AC-14.1), so no later step of the same frame may move the Puck behind the Panel (AC-16.4).
 */
export function stepFrame(accumulator: number, dt: number, step: () => WorldEvent[]): number {
  let left = accumulator + Math.min(dt, MAX_FRAME_DT)
  let steps = 0
  while (left >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    const events = step()
    left -= FIXED_DT
    steps += 1
    if (events.some((event) => event.type === 'goal')) break
  }
  return steps === MAX_STEPS_PER_FRAME ? 0 : left
}
