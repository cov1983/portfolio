import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { hubLayout } from '../../src/world/model/layout'
import {
  createWorldModel,
  FIXED_DT,
  STANDARD,
  type PuckState,
  type WorldModel,
} from '../../src/world/model/world'
import { at, collect, oneZoneLayout, distance, driveUntil, NONE, reboundAt, UP } from './helpers'

// Spec seam 2, AC-10.1 (model half): Hub → Path → Zone is one continuous ice. Held at top speed the
// Puck crosses both openings without losing speed or direction; released, its glide across them
// equals an uninterrupted glide on the closed Hub, so the openings add no drag. The two layouts
// have different ice colliders, so Rapier's contact arithmetic differs in the last digits (measured:
// 5e-6 m/s at about 1 m/s, deep in the Zone); the tolerance is 1e-6 of the top speed, the series'
// scale (Owner decision on #25), and the glide distance agrees within a centimetre.
const layout = oneZoneLayout()
const zone = layout.zones[0]
if (zone === undefined) throw new Error('the one-Zone layout has no Zone')
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

describe('Driving over the Banner (AC-13.2: a marking, no collider)', () => {
  // A run-up on the Path brings the Puck to the Zone's near end at top speed; bounded by the run-up
  // at top speed plus the time full acceleration needs to reach it. Then the drive key stays held
  // for exactly the steps that cover the near end to the Banner's far edge at top speed, plus one.
  const nearZ = zone.rect.centre.z + zone.rect.length / 2
  const farEdge = zone.banner.rect.centre.z - zone.banner.rect.length / 2
  const RUN_UP = 8

  function overTheBanner(): { arrival: PuckState; samples: PuckState[] } {
    const model = create(at(layout, { x: 0, z: nearZ + RUN_UP }))
    const runUp =
      Math.ceil(RUN_UP / CAP / FIXED_DT) + Math.ceil(CAP / STANDARD.acceleration / FIXED_DT)
    const { state: arrival } = driveUntil(model, UP, (s) => s.position.z <= nearZ, runUp)
    const steps = Math.ceil((nearZ - farEdge) / CAP / FIXED_DT) + 1
    return { arrival, samples: collect(model, UP, steps).map((r) => r.state) }
  }

  it("reaches the Zone's near end within the run-up's bound", () => {
    expect(overTheBanner().arrival.position.z).toBeLessThanOrEqual(nearZ)
  })

  it('arrives there at top speed', () => {
    expect(overTheBanner().arrival.speed).toBeGreaterThanOrEqual(CAP - 1e-6)
  })

  it("passes the Banner's far edge in the model time top speed needs", () => {
    const { samples } = overTheBanner()
    expect(samples[samples.length - 1]?.position.z).toBeLessThan(farEdge)
  })

  it('is never sent back on the way', () => {
    const { samples } = overTheBanner()
    expect(reboundAt(samples, 'z', -1)).toBe(-1)
  })
})
