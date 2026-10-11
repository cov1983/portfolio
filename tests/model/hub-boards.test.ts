import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { hubLayout, insideRect } from '../../src/world/model/layout'
import { createWorldModel, type DriveInput, type WorldModel } from '../../src/world/model/world'
import { DOWN, drive, LEFT, RIGHT, UP } from './helpers'

// Spec seam 2, AC-9.1 on the Hub: at top speed into each of the four boards the Puck rebounds
// (the velocity component towards the board reverses) and never leaves the Rink. T2 adds the Path
// and the Zone boards.
const layout = hubLayout()
const STEPS = 360 // 6 s: enough to reach any board at top speed and come back

const boards: [string, DriveInput, 'x' | 'z', number][] = [
  ['far board', UP, 'z', -1],
  ['near board', DOWN, 'z', 1],
  ['left board', LEFT, 'x', -1],
  ['right board', RIGHT, 'x', 1],
]

let model: WorldModel

beforeAll(async () => {
  await RAPIER.init()
})

afterEach(() => {
  model.dispose()
})

describe('Hub boards (AC-9.1)', () => {
  it.each(boards)('rebounds off the %s', (_name, input, axis, sign) => {
    model = createWorldModel(RAPIER, layout)
    const samples = drive(model, input, STEPS)
    const reversed = samples.findIndex(
      (s) => Math.sign(s.velocity[axis]) === -sign && s.speed > 0.1,
    )
    expect(reversed).toBeGreaterThan(0)
  })

  it.each(boards)('stays inside the Hub at the %s', (_name, input) => {
    model = createWorldModel(RAPIER, layout)
    const samples = drive(model, input, STEPS)
    const outside = samples.findIndex((s) => !insideRect(layout.hub.rect, s.position))
    expect(outside).toBe(-1)
  })
})
