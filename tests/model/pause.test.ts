import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { hubLayout } from '../../src/world/model/layout'
import { createWorldModel, type WorldModel } from '../../src/world/model/world'
import { distance, drive, NONE, UP } from './helpers'

// Spec seam 2, AC-6.1 and AC-6.2: pausing is the caller not calling step() (plan §5, ADR 0009),
// so the Puck's state is preserved exactly while the Title Screen is shown over the World and
// resumes unchanged, with no Reset. T5b wires this through selectWorldPaused; the model half is here.
const layout = hubLayout()
const models: WorldModel[] = []

function create(): WorldModel {
  const model = createWorldModel(RAPIER, layout)
  models.push(model)
  return model
}

beforeAll(async () => {
  await RAPIER.init()
})

afterEach(() => {
  for (const model of models.splice(0)) model.dispose()
})

describe('Pause (AC-6.1)', () => {
  it('keeps the Puck’s position and velocity while no step is taken', () => {
    const model = create()
    drive(model, UP, 40)
    const before = model.puck()
    const after = model.puck()
    expect(before.speed).toBeGreaterThan(1)
    expect(after).toEqual(before)
  })
})

describe('Resume (AC-6.2)', () => {
  it('continues the velocity exactly as if there had been no pause', () => {
    const paused = create()
    const continuous = create()
    drive(paused, UP, 40)
    const atPause = paused.puck()
    // The pause: nothing is stepped. Then both are driven the same 60 steps with nothing pressed.
    const afterPause = drive(paused, NONE, 60)
    const unbroken = drive(continuous, UP, 40)
      .concat(drive(continuous, NONE, 60))
      .slice(40)
    expect(afterPause).toEqual(unbroken)
    expect(afterPause[0]?.speed).toBeGreaterThan(atPause.speed * 0.9)
  })

  it('does no Reset: the Puck is not back at the Reset point after the pause', () => {
    const model = create()
    drive(model, UP, 40)
    const [resumed] = drive(model, NONE, 1)
    expect(resumed).toBeDefined()
    if (resumed === undefined) return
    expect(distance(resumed.position, layout.hub.resetPoint)).toBeGreaterThan(1)
  })
})
