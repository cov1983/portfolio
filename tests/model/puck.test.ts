import RAPIER from '@dimforge/rapier3d-compat'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { cameraGoal, framesPoint } from '../../src/world/model/camera'
import {
  blueLineOffset,
  hubLayout,
  insideRect,
  type WorldLayout,
} from '../../src/world/model/layout'
import {
  createWorldModel,
  FIXED_DT,
  STANDARD,
  type DriveInput,
  type WorldModel,
} from '../../src/world/model/world'
import {
  distance,
  DOWN,
  drive,
  driveUntil,
  LEFT,
  NONE,
  randomInput,
  RIGHT,
  seededRandom,
  UP,
  UP_RIGHT,
} from './helpers'

// Spec seam 2: the Puck under Direct Drive on the Hub, stepped under Node with fixed timesteps.
// Tolerances come from ADR 0005's reference numbers and plan §6 (row 8.1 as corrected on #24).
const layout = hubLayout()
const BLUE_LINE = blueLineOffset(layout.hub.rect) // 6.67 m from the centre

let model: WorldModel

function create(withLayout: WorldLayout = layout): WorldModel {
  model = createWorldModel(RAPIER, withLayout)
  return model
}

beforeAll(async () => {
  await RAPIER.init()
})

afterEach(() => {
  model.dispose()
})

describe('Direct Drive (AC-7.1, 7.3, 7.4)', () => {
  it.each<[string, DriveInput, 'x' | 'z', number]>([
    ['up', UP, 'z', -1],
    ['down', DOWN, 'z', 1],
    ['left', LEFT, 'x', -1],
    ['right', RIGHT, 'x', 1],
  ])('holding %s accelerates the Puck along that axis only', (_name, input, axis, sign) => {
    const [last] = drive(create(), input, 10).slice(-1)
    const other = axis === 'x' ? 'z' : 'x'
    expect(Math.sign(last?.velocity[axis] ?? 0)).toBe(sign)
    expect(Math.abs(last?.velocity[other] ?? 1)).toBeLessThan(1e-9)
  })

  it('gives a diagonal no more speed than a single key (within 1 %)', () => {
    const [single] = drive(create(), UP, 60).slice(-1)
    model.dispose()
    const [diagonal] = drive(create(), UP_RIGHT, 60).slice(-1)
    const singleSpeed = single?.speed ?? 0
    expect(Math.abs((diagonal?.speed ?? 0) - singleSpeed) / singleSpeed).toBeLessThan(0.01)
  })

  it('sends the Puck towards negative z on "up", with no sideways drift', () => {
    const samples = drive(create(), UP, 30)
    expect(samples.every((s) => s.velocity.z < 0 && Math.abs(s.velocity.x) < 1e-9)).toBe(true)
  })

  it('keeps the Follow Camera yaw constant while the Puck travels "up" (AC-7.4)', () => {
    const yaws = drive(create(), UP, 30).map((s) => {
      const { position, target } = cameraGoal(s.position)
      return Math.atan2(position.x - target.x, position.z - target.z)
    })
    expect(Math.max(...yaws) - Math.min(...yaws)).toBeLessThan(1e-12)
  })
})

describe('Feel (AC-8.1 to 8.4)', () => {
  it('reaches top speed in about 0.6 s and before the blue line (AC-8.1)', () => {
    const { steps, state } = driveUntil(
      create(),
      UP,
      (s) => s.speed >= STANDARD.maxSpeed - 0.5,
      120,
    )
    const metres = distance(state.position, layout.hub.resetPoint)
    console.info('[AC-8.1] top speed', { steps, seconds: steps * FIXED_DT, metres })
    expect(steps).toBeGreaterThanOrEqual(27)
    expect(steps).toBeLessThanOrEqual(45)
    expect(metres).toBeLessThanOrEqual(BLUE_LINE)
  })

  it('glides about 19 m in about 4 s from top speed to rest (AC-8.2)', () => {
    // Starts 15 m down the Hub so the whole glide fits before the far board.
    const nearEnd: WorldLayout = {
      ...layout,
      hub: { ...layout.hub, resetPoint: { x: 0, z: 15 } },
    }
    const atTop = driveUntil(create(nearEnd), UP, (s) => s.speed >= STANDARD.maxSpeed - 1e-6, 120)
    expect(atTop.state.speed).toBeGreaterThanOrEqual(STANDARD.maxSpeed - 1e-6)
    const { steps, state } = driveUntil(model, NONE, (s) => s.speed < 0.05, 400)
    const metres = distance(state.position, atTop.state.position)
    console.info('[AC-8.2] glide', { steps, seconds: steps * FIXED_DT, metres })
    expect(steps).toBeGreaterThanOrEqual(180)
    expect(steps).toBeLessThanOrEqual(300)
    expect(metres).toBeGreaterThanOrEqual(16)
    expect(metres).toBeLessThanOrEqual(22)
  })

  it('never exceeds the top speed while a key is held (AC-8.3)', () => {
    // The direction changes at top speed (40 steps in), then the Puck rebounds off boards.
    const samples = [...drive(create(), UP, 40), ...drive(model, UP_RIGHT, 560)]
    expect(samples[39]?.speed).toBeGreaterThan(STANDARD.maxSpeed - 0.5)
    expect(Math.max(...samples.map((s) => s.speed))).toBeLessThanOrEqual(STANDARD.maxSpeed + 1e-6)
  })

  it('never spins about its axis while a key is held (AC-8.4)', () => {
    const samples = [...drive(create(), UP, 40), ...drive(model, UP_RIGHT, 560)]
    expect(Math.max(...samples.map((s) => s.angularSpeed))).toBeLessThan(1e-9)
  })

  it('never spins or tips while nothing is pressed, through a rebound (AC-8.4)', () => {
    // At top speed the glide of about 19 m reaches the far board, so the samples with nothing
    // pressed include the rebound.
    const [settled] = drive(create(), NONE, 30).slice(-1)
    const height = settled?.height ?? 0
    driveUntil(model, UP, (s) => s.speed >= STANDARD.maxSpeed - 0.5, 120)
    const gliding = drive(model, NONE, 300)
    expect(Math.max(...gliding.map((s) => s.angularSpeed))).toBeLessThan(1e-9)
    expect(Math.max(...gliding.map((s) => Math.abs(s.height - height)))).toBeLessThan(2e-3)
  })

  it('never tips: its height stays constant through a rebound (AC-8.4)', () => {
    // Baseline: the Puck settled on the ice. Rapier resolves the contact inside a band of about a
    // millimetre (its allowed penetration), so the bound is 2 mm: one percent of the Puck's height,
    // far below anything a tip or a hop would show.
    const [settled] = drive(create(), NONE, 30).slice(-1)
    const height = settled?.height ?? 0
    const samples = [...drive(model, UP, 300), ...drive(model, UP_RIGHT, 300)]
    expect(Math.max(...samples.map((s) => Math.abs(s.height - height)))).toBeLessThan(2e-3)
  })
})

describe('Staying on the ice (AC-9.2)', () => {
  it('stays inside the Hub through 5,000 steps of seeded random input', () => {
    const random = seededRandom(1)
    create()
    let input = randomInput(random)
    for (let step = 0; step < 5000; step += 1) {
      if (step % 20 === 0) input = randomInput(random)
      model.step(input)
      const { position } = model.puck()
      if (!insideRect(layout.hub.rect, position)) {
        expect.fail(`left the Hub at step ${String(step)}: ${JSON.stringify(position)}`)
      }
    }
    expect(model.place()).toBe('hub')
  })
})

describe('Reset (AC-12.1, AC-5.1 model half)', () => {
  it('puts the Puck back at the Reset point', () => {
    drive(create(), UP_RIGHT, 60)
    model.reset()
    const { position } = model.puck()
    expect(position.x).toBeCloseTo(layout.hub.resetPoint.x, 6)
    expect(position.z).toBeCloseTo(layout.hub.resetPoint.z, 6)
  })

  it('leaves the Puck at rest', () => {
    drive(create(), UP_RIGHT, 60)
    model.reset()
    const { speed, angularSpeed } = model.puck()
    expect(speed).toBe(0)
    expect(angularSpeed).toBe(0)
  })

  it('stays at the Reset point while nothing is pressed', () => {
    drive(create(), UP_RIGHT, 60)
    model.reset()
    const [last] = drive(model, NONE, 60).slice(-1)
    expect(last?.position.x).toBeCloseTo(layout.hub.resetPoint.x, 4)
    expect(last?.position.z).toBeCloseTo(layout.hub.resetPoint.z, 4)
  })

  it('is framed by the Follow Camera after Reset (AC-5.1 model half)', () => {
    drive(create(), UP_RIGHT, 60)
    model.reset()
    const { position, height } = model.puck()
    const puck = { x: position.x, y: height, z: position.z }
    expect(framesPoint(cameraGoal(position), puck, 16 / 9)).toBe(true)
  })
})

describe('Determinism (plan risk 8)', () => {
  it('gives identical positions for identical inputs', () => {
    const inputs: DriveInput[] = []
    const random = seededRandom(7)
    for (let i = 0; i < 300; i += 1) inputs.push(randomInput(random))
    const first = createWorldModel(RAPIER, layout)
    const second = create()
    const run = (m: WorldModel) => inputs.map((input) => (m.step(input), m.puck().position))
    const a = run(first)
    const b = run(second)
    first.dispose()
    expect(a).toEqual(b)
  })
})
