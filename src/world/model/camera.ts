// The Follow Camera as pure functions of the Puck (plan §5; ADR 0005): a fixed world yaw, the
// pose trailing the Puck with easing, no easing under reduced motion, a snap on Reset. One shared
// rate eases position and target alike, so position minus target is always the rig offset and
// the view never yaws (Owner decision on #24, Q4). No three: the scene applies the pose.
import type { Vec2, Vec3 } from './layout'

export type { Vec3 }
export type CameraPose = { position: Vec3; target: Vec3 }

/** Prototype values (ADR 0005); `rate` is the exponential approach rate in 1/s. */
export const RIG = { offset: { x: 0, y: 9, z: 13 }, fovDeg: 50, rate: 4 }

export type Rig = typeof RIG

/** Where the camera wants to be for this Puck position: the constant offset, looking at the ice under the Puck. */
export function cameraGoal(puck: Vec2, rig: Rig = RIG): CameraPose {
  return {
    position: { x: puck.x + rig.offset.x, y: rig.offset.y, z: puck.z + rig.offset.z },
    target: { x: puck.x, y: 0, z: puck.z },
  }
}

function lerp(from: Vec3, to: Vec3, k: number): Vec3 {
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    z: from.z + (to.z - from.z) * k,
  }
}

/** One easing step of `dt` seconds towards the goal; the goal itself under reduced motion (AC-11.3). */
export function cameraFollow(
  current: CameraPose,
  goal: CameraPose,
  dt: number,
  reducedMotion: boolean,
  rig: Rig = RIG,
): CameraPose {
  if (reducedMotion) return goal
  const k = 1 - Math.exp(-rig.rate * dt)
  return {
    position: lerp(current.position, goal.position, k),
    target: lerp(current.target, goal.target, k),
  }
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x }
}

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z)
  return { x: v.x / length, y: v.y / length, z: v.z / length }
}

/** True when a perspective camera at `pose` with the rig's vertical field of view and `aspect` sees `point`. */
export function framesPoint(
  pose: CameraPose,
  point: Vec3,
  aspect: number,
  rig: Rig = RIG,
): boolean {
  const forward = normalise(sub(pose.target, pose.position))
  const right = normalise(cross(forward, { x: 0, y: 1, z: 0 }))
  const up = cross(right, forward)
  const d = sub(point, pose.position)
  const depth = dot(d, forward)
  if (depth <= 0) return false
  const tanHalf = Math.tan((rig.fovDeg * Math.PI) / 360)
  return (
    Math.abs(dot(d, up) / depth) <= tanHalf && Math.abs(dot(d, right) / depth) <= tanHalf * aspect
  )
}
