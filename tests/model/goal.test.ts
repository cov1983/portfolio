import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  insideRect,
  PLACEHOLDER_EXHIBIT,
  worldLayout,
  type WorldLayout,
} from '../../src/world/model/layout'
import { createWorldModel, PUCK, type Place, type WorldModel } from '../../src/world/model/world'
import { at, collect, DOWN, drive, NONE, reboundAt, RIGHT, stepsWith, UP } from './helpers'

// Spec seam 2, the Zone's events: the Goal is a sensor volume inside the net behind the goal line,
// armed again only after the Puck has left it (AC-14.1, 14.2); posts and the net's outside are solid
// (AC-14.3); the Zone reports its first entry once per page load (AC-13.1, model half).
const layout = worldLayout(PLACEHOLDER_EXHIBIT)
const zone = layout.zones[0]
if (zone === undefined) throw new Error('the placeholder layout has no Zone')
const ZONE_ID = zone.exhibitId
const ZONE_CENTRE = zone.rect.centre
const LINE_Z = zone.goal.line.a.z
/** Where the Puck's centre is once the whole Puck has crossed the goal line. */
const GOAL_Z = LINE_Z - PUCK.radius
const STEPS = 360 // 6 s at top speed: the Zone is 30 m long

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

describe('Goal (AC-14.1)', () => {
  it('fires once, at the step the whole Puck has crossed the goal line into the net', () => {
    const run = collect(create(at(layout, ZONE_CENTRE)), UP, STEPS)
    const goals = stepsWith(run, 'goal')
    expect(goals).toHaveLength(1)
    const i = goals[0] ?? 0
    expect(run[i]?.events).toEqual([{ type: 'goal', zoneId: ZONE_ID }])
    expect(run[i]?.state.position.z).toBeLessThanOrEqual(GOAL_Z)
    expect(insideRect(zone.goal.sensor, run[i]?.state.position ?? ZONE_CENTRE)).toBe(true)
    expect(run[i - 1]?.state.position.z).toBeGreaterThan(GOAL_Z)
  })
})

describe('Goal re-arm (AC-14.2)', () => {
  it('fires nothing while the Puck stays in the net', () => {
    const entering = collect(create(at(layout, ZONE_CENTRE)), UP, STEPS)
    expect(stepsWith(entering, 'goal')).toHaveLength(1)
    expect(collect(model, UP, 120).flatMap((r) => r.events)).toEqual([])
  })

  it('reports goal-left once, at the step the Puck leaves the sensor', () => {
    collect(create(at(layout, ZONE_CENTRE)), UP, STEPS)
    const leaving = collect(model, DOWN, 120)
    const left = stepsWith(leaving, 'goal-left')
    expect(left).toHaveLength(1)
    const i = left[0] ?? 0
    expect(leaving[i]?.events).toEqual([{ type: 'goal-left', zoneId: ZONE_ID }])
    expect(leaving[i]?.state.position.z).toBeGreaterThan(GOAL_Z)
    expect(leaving[i - 1]?.state.position.z).toBeLessThanOrEqual(GOAL_Z)
    expect(leaving.slice(0, i).flatMap((r) => r.events)).toEqual([])
  })

  it('fires again once the Puck has left and re-enters', () => {
    collect(create(at(layout, ZONE_CENTRE)), UP, STEPS)
    expect(stepsWith(collect(model, DOWN, 120), 'goal-left')).toHaveLength(1)
    expect(stepsWith(collect(model, UP, STEPS), 'goal')).toHaveLength(1)
  })

  it('re-arms after a Reset out of the net, on the next step', () => {
    collect(create(at(layout, ZONE_CENTRE)), UP, STEPS)
    model.reset()
    const [first] = collect(model, NONE, 1)
    expect(first?.events).toEqual([{ type: 'goal-left', zoneId: ZONE_ID }])
    expect(stepsWith(collect(model, UP, STEPS), 'goal')).toHaveLength(1)
  })
})

describe('Posts and the net outside (AC-14.3)', () => {
  it.each<[string, { x: number; z: number }, 'x' | 'z', number]>([
    ["the net's left side, from beside it", { x: -6, z: -62 }, 'x', 1],
    ["the net's back, from behind it", { x: 0, z: -64 }, 'z', 1],
  ])('rebounds off %s without a goal', (_name, start, axis, sign) => {
    const input = axis === 'x' ? RIGHT : DOWN
    const run = collect(create(at(layout, start)), input, STEPS)
    const samples = run.map((r) => r.state)
    expect(reboundAt(samples, axis, sign)).toBeGreaterThan(0)
    expect(stepsWith(run, 'goal')).toEqual([])
    expect(run.some((r) => insideRect(zone.goal.sensor, r.state.position))).toBe(false)
  })

  it('is knocked away from the mouth by the left post it brushes on the way up, without a goal', () => {
    // The Puck's rim overlaps the post's face by 0.2 m: a round Puck on the post's corner is
    // deflected outward (measured: −8.7 m/s sideways at the contact), not reversed. The contact
    // must be the post, at the goal line, not the end board 4 m further on.
    const run = collect(create(at(layout, { x: -3.6, z: -55 })), UP, STEPS)
    const contact = run.findIndex((r) => Math.abs(r.state.velocity.x) > 0.1)
    expect(contact).toBeGreaterThan(0)
    expect(run[contact]?.state.velocity.x).toBeLessThan(-1)
    expect(run[contact]?.state.position.z).toBeGreaterThan(LINE_Z - 0.5)
    expect(stepsWith(run, 'goal')).toEqual([])
    expect(run.some((r) => insideRect(zone.goal.sensor, r.state.position))).toBe(false)
  })
})

describe('Zone entered (AC-13.1, model half)', () => {
  it('reports the first entry once, at the step the Puck enters the Zone', () => {
    const run = collect(create(layout), UP, 400)
    const entries = stepsWith(run, 'zone-entered')
    expect(entries).toHaveLength(1)
    const i = entries[0] ?? 0
    expect(run[i]?.events).toEqual([{ type: 'zone-entered', zoneId: ZONE_ID }])
    expect(run[i]?.place).toBe(ZONE_ID)
    expect(run[i - 1]?.place).toBe('path')
  })

  it('stays silent on a second entry from the Path', () => {
    collect(create(layout), UP, 400)
    const back = collect(model, DOWN, 200)
    expect(back.some((r) => r.place === 'path')).toBe(true)
    const again = collect(model, UP, 200)
    expect(stepsWith(again, 'zone-entered')).toEqual([])
    expect(model.place()).toBe(ZONE_ID)
  })

  it('stays silent on a second entry after a Reset', () => {
    collect(create(layout), UP, 400)
    model.reset()
    const again = collect(model, UP, 400)
    expect(stepsWith(again, 'zone-entered')).toEqual([])
    expect(model.place()).toBe(ZONE_ID)
  })
})

describe('place() over the whole World', () => {
  it.each<[Place, { x: number; z: number }]>([
    ['hub', { x: 0, z: 0 }],
    ['path', { x: 0, z: -27.5 }],
    [ZONE_ID, { x: 0, z: -50 }],
  ])('answers %s for a Puck resting there', (place, point) => {
    drive(create(at(layout, point)), NONE, 10)
    expect(model.place()).toBe(place)
  })
})
