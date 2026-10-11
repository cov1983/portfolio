import { describe, expect, it } from 'vitest'

import { cameraFollow, cameraGoal, framesPoint, RIG, type CameraPose, type Vec3 } from './camera'
import { hubLayout } from './layout'

// AC-11.1 (trails with easing, fixed world yaw), AC-11.3 (no easing under reduced motion),
// AC-12.1 (snap on Reset), AC-5.1 (the Follow Camera frames the Puck at the Reset point).
const DT = 1 / 60
const ASPECTS = [21 / 9, 16 / 9, 3 / 2, 4 / 3]

function minus(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z)
}

function distanceTo(goal: CameraPose, pose: CameraPose): number {
  return length(minus(goal.position, pose.position)) + length(minus(goal.target, pose.target))
}

function expectVec3Close(actual: Vec3, expected: Vec3, digits = 9): void {
  expect(actual.x).toBeCloseTo(expected.x, digits)
  expect(actual.y).toBeCloseTo(expected.y, digits)
  expect(actual.z).toBeCloseTo(expected.z, digits)
}

describe('cameraGoal', () => {
  it('keeps the camera at the rig offset from the Puck wherever it is (fixed world yaw)', () => {
    for (let i = 0; i < 50; i += 1) {
      const puck = { x: Math.sin(i) * 10, z: Math.cos(i * 0.7) * 20 }
      const goal = cameraGoal(puck)
      expectVec3Close(minus(goal.position, goal.target), RIG.offset)
    }
  })

  it('looks at the Puck on the ice', () => {
    expect(cameraGoal({ x: 3, z: -4 }).target).toEqual({ x: 3, y: 0, z: -4 })
  })
})

describe('cameraFollow', () => {
  const goal = cameraGoal({ x: 0, z: 0 })
  const far = cameraGoal({ x: 10, z: 0 })

  it('approaches the goal monotonically without overshooting', () => {
    let pose = far
    let last = distanceTo(goal, pose)
    for (let i = 0; i < 120; i += 1) {
      pose = cameraFollow(pose, goal, DT, false)
      const next = distanceTo(goal, pose)
      expect(next).toBeLessThan(last)
      last = next
    }
  })

  it('is within a centimetre of the goal after two seconds', () => {
    let pose = far
    for (let i = 0; i < 120; i += 1) pose = cameraFollow(pose, goal, DT, false)
    expect(distanceTo(goal, pose)).toBeLessThan(0.01)
  })

  it('keeps the world yaw fixed while easing: position minus target stays the rig offset', () => {
    // The Puck sprints sideways at top speed; one shared rate for position and target keeps the
    // eased offset exact, so the view never yaws (Owner decision on #24, Q4).
    let pose = cameraGoal({ x: 0, z: 0 })
    for (let i = 1; i <= 120; i += 1) {
      pose = cameraFollow(pose, cameraGoal({ x: 12 * i * DT, z: 0 }), DT, false)
      expectVec3Close(minus(pose.position, pose.target), RIG.offset)
    }
  })

  it('returns the goal in one call under reduced motion', () => {
    expect(cameraFollow(far, goal, DT, true)).toEqual(goal)
  })

  it('snaps: following from the goal to the goal is the goal', () => {
    expect(cameraFollow(goal, goal, DT, false)).toEqual(goal)
  })
})

describe('framesPoint', () => {
  const { resetPoint } = hubLayout().hub
  const pose = cameraGoal(resetPoint)
  const puck = { x: resetPoint.x, y: 0.1, z: resetPoint.z }

  it.each(ASPECTS)('frames the Puck at the Reset point at aspect %f', (aspect) => {
    expect(framesPoint(pose, puck, aspect)).toBe(true)
  })

  it('does not frame a point behind the camera', () => {
    expect(framesPoint(pose, { x: 0, y: 0, z: 100 }, 16 / 9)).toBe(false)
  })

  it('does not frame a point far outside the view', () => {
    expect(framesPoint(pose, { x: 60, y: 0, z: 0 }, 16 / 9)).toBe(false)
  })
})
