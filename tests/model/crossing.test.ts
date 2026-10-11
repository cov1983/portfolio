import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { hubLayout, worldLayout } from '../../src/world/model/layout'
import {
  createWorldModel,
  STANDARD,
  type PuckState,
  type WorldModel,
} from '../../src/world/model/world'
import { at, collect, distance, driveUntil, NONE, PLACEHOLDER_EXHIBIT, UP } from './helpers'

// Spec seam 2, AC-10.1 (model half): Hub → Path → Zone is one continuous ice. Held at top speed the
// Puck crosses both openings without losing speed or direction; released, its glide across them
// equals an uninterrupted glide on the closed Hub, so the openings add no drag. The two layouts
// have different ice colliders, so Rapier's contact arithmetic differs in the last digits (measured:
// 5e-6 m/s at about 1 m/s, deep in the Zone); the tolerance is 1e-6 of the top speed, the series'
// scale (Owner decision on #25), and the glide distance agrees within a centimetre.
const layout = worldLayout(PLACEHOLDER_EXHIBIT)
const zone = layout.zones[0]
if (zone === undefined) throw new Error('the placeholder layout has no Zone')
const ZONE_ID = zone.exhibitId
const CAP = STANDARD.maxSpeed
const RELATIVE_TOLERANCE = 1e-6

const models: WorldModel[] = []

function create(withLayout = layout): WorldModel {
  const model = createWorldModel(RAPIER, withLayout)
  models.push(model)
  return model
}

/** Consecutive duplicates removed: the order in which the Puck visited the parts. */
function visits<T>(values: T[]): T[] {
  return values.filter((value, i) => i === 0 || value !== values[i - 1])
}

beforeAll(async () => {
  await RAPIER.init()
})

afterEach(() => {
  for (const model of models.splice(0)) model.dispose()
})

describe('Crossing Hub → Path → Zone held at top speed (AC-10.1)', () => {
  const run = () => collect(create(), UP, 400)

  it('visits the Hub, the Path and the Zone once each, in that order', () => {
    const records = run()
    const entered = records.findIndex((r) => r.place === ZONE_ID)
    expect(entered).toBeGreaterThan(0)
    expect(visits(records.slice(0, entered + 1).map((r) => r.place))).toEqual([
      'hub',
      'path',
      ZONE_ID,
    ])
  })

  it('keeps top speed through both openings', () => {
    const records = run()
    const atCap = records.findIndex((r) => r.state.speed >= CAP - 1e-6)
    const entered = records.findIndex((r) => r.place === ZONE_ID)
    expect(atCap).toBeGreaterThan(0)
    expect(atCap).toBeLessThan(entered)
    const speeds = records.slice(atCap, entered + 1).map((r) => r.state.speed)
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(CAP - 1e-6)
  })

  it('is never deflected sideways', () => {
    const records = run()
    const entered = records.findIndex((r) => r.place === ZONE_ID)
    const drift = records.slice(0, entered + 1).map((r) => Math.abs(r.state.velocity.x))
    expect(Math.max(...drift)).toBeLessThan(1e-9)
  })
})

describe('Gliding across the openings (AC-10.1)', () => {
  // Both Pucks reach the cap after the same steps, then glide about 19 m: the open one from
  // z = −15 across the openings at −20 and −35 into the Zone, the closed one from z = 15 to about
  // −7 on the Hub alone, never near a board.
  function glides(): { open: PuckState[]; closed: PuckState[]; released: PuckState[] } {
    const open = create(at(layout, { x: 0, z: -15 }))
    const closed = create(at(hubLayout(), { x: 0, z: 15 }))
    const atCap = (s: PuckState) => s.speed >= CAP - 1e-6
    const openCap = driveUntil(open, UP, atCap, 120)
    const closedCap = driveUntil(closed, UP, atCap, 120)
    expect(openCap.steps).toBe(closedCap.steps)
    const released = [openCap.state, closedCap.state]
    const openGlide = collect(open, NONE, 300)
    expect(visits(openGlide.map((r) => r.place))).toEqual(['hub', 'path', ZONE_ID])
    return {
      open: openGlide.map((r) => r.state),
      closed: collect(closed, NONE, 300).map((r) => r.state),
      released,
    }
  }

  it('has the same speed at every step as an uninterrupted glide on the closed Hub', () => {
    const { open, closed } = glides()
    const worst = Math.max(
      ...open.map((s, i) => {
        const other = closed[i]?.speed ?? Number.NaN
        return Math.abs(s.speed - other) / CAP
      }),
    )
    expect(worst).toBeLessThanOrEqual(RELATIVE_TOLERANCE)
  })

  it('covers the same distance within a centimetre', () => {
    const { open, closed, released } = glides()
    const [openStart, closedStart] = released
    const last = (states: PuckState[]) => states[states.length - 1]
    const openMetres = distance(
      last(open)?.position ?? { x: 0, z: 0 },
      openStart?.position ?? { x: 0, z: 0 },
    )
    const closedMetres = distance(
      last(closed)?.position ?? { x: 0, z: 0 },
      closedStart?.position ?? { x: 0, z: 0 },
    )
    expect(Math.abs(openMetres - closedMetres)).toBeLessThan(0.01)
  })
})
