import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { hubLayout } from '../../src/world/model/layout'
import { createWorldModel, type WorldModel } from '../../src/world/model/world'
import { distance, drive, NONE, UP } from './helpers'

// Spec seam 2, AC-6.1 and AC-6.2: pausing is the caller not calling step() (plan §5, ADR 0009).
// The model keeps no clock, so the Puck's state is a function of the steps taken alone: a run
// split around a pause is the unbroken run, which is what lets the scene stop stepping while the
// Title Screen is shown and resume without a catch-up or a Reset. T5b wires this through
// selectWorldPaused; the model half is here.
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

describe('Pause and resume (AC-6.1, 6.2)', () => {
  it('resumes exactly where it paused: a run split around a pause equals the unbroken run', () => {
    const split = create()
    const unbroken = create()
    drive(split, UP, 40)
    // The pause: nothing is stepped, whatever the wall clock does meanwhile.
    const resumed = drive(split, NONE, 60)
    const straight = drive(unbroken, UP, 40)
      .concat(drive(unbroken, NONE, 60))
      .slice(40)
    expect(resumed).toEqual(straight)
  })

  it('keeps the velocity through the pause: the first resumed step still glides', () => {
    const model = create()
    drive(model, UP, 40)
    const atPause = model.puck()
    const [resumed] = drive(model, NONE, 1)
    expect(resumed?.speed).toBeGreaterThan(atPause.speed * 0.9)
  })

  it('does no Reset: the Puck is not back at the Reset point after the pause', () => {
    const model = create()
    drive(model, UP, 40)
    const [resumed] = drive(model, NONE, 1)
    expect(
      distance(resumed?.position ?? layout.hub.resetPoint, layout.hub.resetPoint),
    ).toBeGreaterThan(1)
  })
})
