import { describe, expect, it } from 'vitest'

import type { PuckState } from '../model/world'
import { interpolatePuck, renderAlpha } from './interpolate'

const previous: PuckState = {
  position: { x: 1, z: -2 },
  velocity: { x: 3, z: -4 },
  speed: 5,
  height: 0.1,
  angularSpeed: 0,
}
const current: PuckState = {
  position: { x: 3, z: -6 },
  velocity: { x: 5, z: -8 },
  speed: 9,
  height: 0.3,
  angularSpeed: 2,
}

describe('interpolatePuck', () => {
  it('returns the previous state at alpha 0', () => {
    expect(interpolatePuck(previous, current, 0)).toEqual(previous)
  })

  it('returns the current state at alpha 1', () => {
    expect(interpolatePuck(previous, current, 1)).toEqual(current)
  })

  it('returns the midpoint of every field at alpha 0.5', () => {
    expect(interpolatePuck(previous, current, 0.5)).toEqual({
      position: { x: 2, z: -4 },
      velocity: { x: 4, z: -6 },
      speed: 7,
      height: 0.2,
      angularSpeed: 1,
    })
  })

  it('does not share objects with its inputs', () => {
    const blended = interpolatePuck(previous, current, 0.5)
    expect(blended.position).not.toBe(previous.position)
    expect(blended.position).not.toBe(current.position)
  })
})

describe('renderAlpha', () => {
  it('is the fraction of a step the accumulator holds', () => {
    expect(renderAlpha(1 / 240, 1 / 60)).toBeCloseTo(0.25, 12)
  })

  it('is 0 for an empty accumulator', () => {
    expect(renderAlpha(0, 1 / 60)).toBe(0)
  })

  it('never exceeds 1', () => {
    expect(renderAlpha(1, 1 / 60)).toBe(1)
  })
})
