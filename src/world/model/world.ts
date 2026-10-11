// The World model (plan §5, Puck controller ↔ physics; ADR 0009): owns the Rapier world and steps
// it in fixed 1/60 s steps under Direct Drive. The scene mirrors it and never steps; tests step it
// under Node without a renderer (spec seam 2). The caller passes the initialised Rapier module, so
// this file imports types only. Pure of React, three and the DOM.
import type RAPIER from '@dimforge/rapier3d-compat'

import type { ExhibitId } from '../../content/types'
import {
  insideRect,
  type Rect,
  type Segment,
  type Vec2,
  type Vec3,
  type WorldLayout,
  type Zone,
} from './layout'

export type DriveInput = { up: boolean; down: boolean; left: boolean; right: boolean }

/** Nothing pressed. Spread it to start a fresh input. */
export const NO_INPUT: DriveInput = { up: false, down: false, left: false, right: false }

export type PuckFeel = {
  friction: number
  linearDamping: number
  acceleration: number
  maxSpeed: number
  boardRestitution: number
  mass: number
}

/** ADR 0005's Standard preset; the numbers may move while AC-8.1 and AC-8.2 hold on the real Hub. */
export const STANDARD: PuckFeel = {
  friction: 0.1,
  linearDamping: 0.4,
  acceleration: 24,
  maxSpeed: 12,
  boardRestitution: 0.5,
  mass: 1,
}

export const FIXED_DT = 1 / 60

/** The Puck's body, shared with the scene so the mesh matches the collider. Metres. */
export const PUCK = { radius: 0.5, height: 0.2 }

/** A board's cross-section, shared with the scene. Metres. */
export const BOARD = { thickness: 0.4, height: 1.2 }

const GRAVITY = { x: 0, y: -9.81, z: 0 }
const ICE_MARGIN = 1
const ICE_THICKNESS = 1

export type PuckState = {
  position: Vec2
  velocity: Vec2
  speed: number
  /** Height of the Puck's centre above the ice; constant while it never tips (AC-8.4). */
  height: number
  /** Magnitude of the angular velocity; zero while rotations stay locked (AC-8.4). */
  angularSpeed: number
}

export type Place = 'hub' | 'path' | ExhibitId

export type WorldEvent =
  | { type: 'zone-entered'; zoneId: ExhibitId }
  | { type: 'goal'; zoneId: ExhibitId }
  | { type: 'goal-left'; zoneId: ExhibitId }

export interface WorldModel {
  readonly layout: WorldLayout
  /** Exactly one FIXED_DT step; diagonal input is normalised. Pausing is not calling step(). */
  step(input: DriveInput): WorldEvent[]
  /** The Puck at rest at hub.resetPoint (AC-12.1). */
  reset(): void
  puck(): PuckState
  place(): Place
  /** Frees the Rapier world. */
  dispose(): void
}

/** The unit drive vector on the ice for the keys held, or null when nothing is pressed (AC-7.3). */
export function driveVector(input: DriveInput): Vec2 | null {
  const x = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const z = (input.down ? 1 : 0) - (input.up ? 1 : 0)
  const length = Math.hypot(x, z)
  return length === 0 ? null : { x: x / length, z: z / length }
}

/** The smallest rect holding every rect of the layout, grown by a margin: the ice under the World. */
function iceRect(layout: WorldLayout, margin: number): Rect {
  const rects = [layout.hub.rect, layout.path.rect, ...layout.zones.map((zone) => zone.rect)]
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const rect of rects) {
    minX = Math.min(minX, rect.centre.x - rect.width / 2)
    maxX = Math.max(maxX, rect.centre.x + rect.width / 2)
    minZ = Math.min(minZ, rect.centre.z - rect.length / 2)
    maxZ = Math.max(maxZ, rect.centre.z + rect.length / 2)
  }
  return {
    centre: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 },
    width: maxX - minX + 2 * margin,
    length: maxZ - minZ + 2 * margin,
  }
}

export type Box = {
  centre: Vec3
  size: Vec3
}

/**
 * The box of a board: along its segment, just outside the rect it belongs to, standing on the ice.
 * Each board runs a thickness past its ends, so two boards meeting at a corner leave no gap. The
 * collider and the mesh are built from the same box.
 */
export function boardBox(segment: Segment, rect: Rect): Box {
  const { a, b } = segment
  const half = BOARD.thickness / 2
  const alongZ = a.x === b.x
  if (!alongZ && a.z !== b.z) {
    throw new Error(`boards must be axis-aligned: ${JSON.stringify(segment)}`)
  }
  const outward = alongZ ? Math.sign(a.x - rect.centre.x) : Math.sign(a.z - rect.centre.z)
  return {
    centre: {
      x: (a.x + b.x) / 2 + (alongZ ? outward * half : 0),
      y: BOARD.height / 2,
      z: (a.z + b.z) / 2 + (alongZ ? 0 : outward * half),
    },
    size: {
      x: alongZ ? BOARD.thickness : Math.abs(b.x - a.x) + 2 * BOARD.thickness,
      y: BOARD.height,
      z: alongZ ? Math.abs(b.z - a.z) + 2 * BOARD.thickness : BOARD.thickness,
    },
  }
}

/** A rect of the layout standing on the ice as a box of `height`: the net's frame, shared with the scene. */
export function rectBox(rect: Rect, height: number): Box {
  return {
    centre: { x: rect.centre.x, y: height / 2, z: rect.centre.z },
    size: { x: rect.width, y: height, z: rect.length },
  }
}

/** A solid the Puck rebounds off: boards and the net's frame share the board restitution and no friction. */
function solidCollider(rapier: typeof RAPIER, box: Box, feel: PuckFeel): RAPIER.ColliderDesc {
  const { centre, size } = box
  return rapier.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2)
    .setTranslation(centre.x, centre.y, centre.z)
    .setFriction(0)
    .setRestitution(feel.boardRestitution)
}

export function createWorldModel(
  rapier: typeof RAPIER,
  layout: WorldLayout,
  feel: PuckFeel = STANDARD,
): WorldModel {
  const world = new rapier.World(GRAVITY)
  world.timestep = FIXED_DT

  const ice = iceRect(layout, ICE_MARGIN)
  world.createCollider(
    rapier.ColliderDesc.cuboid(ice.width / 2, ICE_THICKNESS / 2, ice.length / 2)
      .setTranslation(ice.centre.x, -ICE_THICKNESS / 2, ice.centre.z)
      .setFriction(feel.friction)
      .setRestitution(0),
  )

  const solids = world.createRigidBody(rapier.RigidBodyDesc.fixed())
  const rinks = [
    layout.hub,
    { rect: layout.path.rect, boards: layout.path.boards },
    ...layout.zones,
  ]
  for (const rink of rinks) {
    for (const segment of rink.boards) {
      world.createCollider(solidCollider(rapier, boardBox(segment, rink.rect), feel), solids)
    }
  }
  for (const zone of layout.zones) {
    for (const post of zone.goal.posts) {
      world.createCollider(solidCollider(rapier, rectBox(post, BOARD.height), feel), solids)
    }
  }

  const restHeight = PUCK.height / 2
  const start = layout.hub.resetPoint
  const body = world.createRigidBody(
    rapier.RigidBodyDesc.dynamic()
      .setTranslation(start.x, restHeight, start.z)
      .lockRotations()
      .setLinearDamping(feel.linearDamping)
      .setCcdEnabled(true),
  )
  world.createCollider(
    rapier.ColliderDesc.cylinder(PUCK.height / 2, PUCK.radius)
      .setMass(feel.mass)
      .setFriction(feel.friction)
      .setRestitution(feel.boardRestitution),
    body,
  )

  const force = feel.acceleration * feel.mass

  // The events' state (plan §5): a Zone reports its first entry once per page load, which is the
  // model's lifetime; each Goal is armed until the Puck's position enters its sensor volume and
  // armed again once it has left (AC-14.2), so a Panel closed over a Puck still in the net does not
  // reopen. Reset emits nothing itself: the next step sees the Puck outside and re-arms.
  const entered = new Set<ExhibitId>()
  const goals = layout.zones.map((zone) => ({ zone, armed: true }))

  function readPuck(): PuckState {
    const t = body.translation()
    const v = body.linvel()
    const w = body.angvel()
    return {
      position: { x: t.x, z: t.z },
      velocity: { x: v.x, z: v.z },
      speed: Math.hypot(v.x, v.z),
      height: t.y,
      angularSpeed: Math.hypot(w.x, w.y, w.z),
    }
  }

  function zoneAt(position: Vec2): Zone | undefined {
    return layout.zones.find((zone) => insideRect(zone.rect, position))
  }

  function placeOf(position: Vec2): Place {
    if (insideRect(layout.hub.rect, position)) return 'hub'
    return zoneAt(position)?.exhibitId ?? 'path'
  }

  function eventsAt(position: Vec2): WorldEvent[] {
    const events: WorldEvent[] = []
    const zone = zoneAt(position)
    if (zone !== undefined && !entered.has(zone.exhibitId)) {
      entered.add(zone.exhibitId)
      events.push({ type: 'zone-entered', zoneId: zone.exhibitId })
    }
    for (const goal of goals) {
      const inside = insideRect(goal.zone.goal.sensor, position)
      if (inside && goal.armed) {
        goal.armed = false
        events.push({ type: 'goal', zoneId: goal.zone.exhibitId })
      } else if (!inside && !goal.armed) {
        goal.armed = true
        events.push({ type: 'goal-left', zoneId: goal.zone.exhibitId })
      }
    }
    return events
  }

  return {
    layout,

    step(input) {
      const drive = driveVector(input)
      body.resetForces(false)
      if (drive !== null) body.addForce({ x: drive.x * force, y: 0, z: drive.z * force }, true)
      world.step()
      // The speed cap applies to travel on the ice; a cap inside the solver would fight the drive.
      const v = body.linvel()
      const speed = Math.hypot(v.x, v.z)
      if (speed > feel.maxSpeed) {
        const scale = feel.maxSpeed / speed
        body.setLinvel({ x: v.x * scale, y: v.y, z: v.z * scale }, true)
      }
      return eventsAt(readPuck().position)
    },

    reset() {
      body.resetForces(false)
      body.setLinvel({ x: 0, y: 0, z: 0 }, false)
      body.setAngvel({ x: 0, y: 0, z: 0 }, false)
      body.setTranslation({ x: start.x, y: restHeight, z: start.z }, true)
    },

    puck() {
      return readPuck()
    },

    place() {
      return placeOf(readPuck().position)
    },

    dispose() {
      world.free()
    },
  }
}
