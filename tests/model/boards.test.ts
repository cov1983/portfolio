import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  insideRect,
  PLACEHOLDER_EXHIBIT,
  worldLayout,
  type Rect,
  type Vec2,
  type WorldLayout,
} from '../../src/world/model/layout'
import { createWorldModel, type DriveInput, type WorldModel } from '../../src/world/model/world'
import { at, DOWN, drive, LEFT, randomInput, reboundAt, RIGHT, seededRandom, UP } from './helpers'

// Spec seam 2, AC-9.1 and AC-9.2 over the whole World: at top speed into every board of the Hub,
// the Path and the Zone the Puck rebounds (the velocity component towards the board reverses) and
// never leaves that part; under any input it stays inside the union of the three rects. The Hub's
// far board and the Zone's near board have an opening in the middle, so those runs start to the
// side of it; the Zone's far board is approached beside the net.
const layout = worldLayout(PLACEHOLDER_EXHIBIT)
const zone = layout.zones[0]
if (zone === undefined) throw new Error('the placeholder layout has no Zone')
const STEPS = 360 // 6 s: enough to reach any board at top speed and come back

type Part = 'Hub' | 'Path' | 'Zone'
const rects: Record<Part, Rect> = { Hub: layout.hub.rect, Path: layout.path.rect, Zone: zone.rect }
const hubCentre = layout.hub.rect.centre
const pathCentre = layout.path.rect.centre
const zoneCentre = zone.rect.centre

/** A run at one board: its part and name, the start point, the key held, the axis and sign towards it. */
type BoardCase = [Part, string, Vec2, DriveInput, 'x' | 'z', number]

const boards: BoardCase[] = [
  ['Hub', 'far board, beside the opening', { x: -6.5, z: hubCentre.z }, UP, 'z', -1],
  ['Hub', 'near board', hubCentre, DOWN, 'z', 1],
  ['Hub', 'left board', hubCentre, LEFT, 'x', -1],
  ['Hub', 'right board', hubCentre, RIGHT, 'x', 1],
  ['Path', 'left board', pathCentre, LEFT, 'x', -1],
  ['Path', 'right board', pathCentre, RIGHT, 'x', 1],
  ['Zone', 'far board, beside the net', { x: -6.5, z: zoneCentre.z }, UP, 'z', -1],
  ['Zone', 'near board, beside the opening', { x: -6.5, z: zoneCentre.z }, DOWN, 'z', 1],
  ['Zone', 'left board', zoneCentre, LEFT, 'x', -1],
  ['Zone', 'right board', zoneCentre, RIGHT, 'x', 1],
]

let model: WorldModel

function create(withLayout: WorldLayout): WorldModel {
  model = createWorldModel(RAPIER, withLayout)
  return model
}

beforeAll(async () => {
  await RAPIER.init()
})

afterEach(() => {
  model.dispose()
})

describe('Boards (AC-9.1)', () => {
  it.each(boards)('%s: rebounds off the %s', (_part, _name, start, input, axis, sign) => {
    const samples = drive(create(at(layout, start)), input, STEPS)
    expect(reboundAt(samples, axis, sign)).toBeGreaterThan(0)
  })

  it.each(boards)('%s: stays inside at the %s', (part, _name, start, input) => {
    const samples = drive(create(at(layout, start)), input, STEPS)
    const outside = samples.findIndex((s) => !insideRect(rects[part], s.position))
    expect(outside).toBe(-1)
  })
})

describe('Staying on the ice (AC-9.2)', () => {
  const union = Object.values(rects)

  it.each<[Part, Vec2]>([
    ['Hub', hubCentre],
    ['Path', pathCentre],
    ['Zone', zoneCentre],
  ])('stays on the ice through 5,000 steps of seeded random input from the %s', (_part, start) => {
    const random = seededRandom(1)
    create(at(layout, start))
    let input = randomInput(random)
    for (let step = 0; step < 5000; step += 1) {
      if (step % 20 === 0) input = randomInput(random)
      model.step(input)
      const { position } = model.puck()
      if (!union.some((rect) => insideRect(rect, position))) {
        expect.fail(`left the ice at step ${String(step)}: ${JSON.stringify(position)}`)
      }
    }
  })
})
