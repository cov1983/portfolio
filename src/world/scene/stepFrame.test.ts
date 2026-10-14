import { describe, expect, it } from 'vitest'

import { exhibitIdSchema } from '../../content/schema'
import { FIXED_DT, type WorldEvent } from '../model/world'
import { MAX_FRAME_DT, MAX_STEPS_PER_FRAME, stepFrame } from './stepFrame'

const ZONE = exhibitIdSchema.parse('exhibit-1')

/** A step that records its call and returns the events planned for that call (none by default). */
function counting(planned: WorldEvent[][] = []): { step: () => WorldEvent[]; calls: () => number } {
  let calls = 0
  return {
    step: () => planned[calls++] ?? [],
    calls: () => calls,
  }
}

describe('stepFrame (plan §5, Scene loop ↔ model)', () => {
  it('runs one step per FIXED_DT in the accumulator and keeps the remainder', () => {
    const run = counting()
    const accumulator = stepFrame(0.5 * FIXED_DT, 2 * FIXED_DT, run.step)
    expect({ steps: run.calls(), accumulator }).toEqual({
      steps: 2,
      accumulator: expect.closeTo(0.5 * FIXED_DT, 9) as number,
    })
  })

  it('runs at most MAX_STEPS_PER_FRAME steps and then drops the remainder', () => {
    const run = counting()
    const accumulator = stepFrame(0, MAX_FRAME_DT, run.step)
    expect({ steps: run.calls(), accumulator }).toEqual({
      steps: MAX_STEPS_PER_FRAME,
      accumulator: 0,
    })
  })

  // The goal stops the loop before the cap can drop the remainder, so only the clamp bounds it.
  it('leaves at most MAX_FRAME_DT from a 10 s frame whose first step emits goal', () => {
    const run = counting([[{ type: 'goal', zoneId: ZONE }]])
    expect(stepFrame(0, 10, run.step)).toBeLessThanOrEqual(MAX_FRAME_DT)
  })

  it('runs no step after the one that emits goal in the same frame (AC-14.1, 16.4)', () => {
    const run = counting([[], [{ type: 'goal', zoneId: ZONE }]])
    stepFrame(0, MAX_FRAME_DT, run.step)
    expect(run.calls()).toBe(2)
  })

  it('goes on after other events', () => {
    const run = counting([
      [{ type: 'zone-entered', zoneId: ZONE }],
      [{ type: 'goal-left', zoneId: ZONE }],
    ])
    stepFrame(0, MAX_FRAME_DT, run.step)
    expect(run.calls()).toBe(MAX_STEPS_PER_FRAME)
  })
})
