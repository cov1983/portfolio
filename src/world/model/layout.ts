// The World layout (plan §5, Content ↔ World model): the Rinks, their boards, the Path and the Zones
// as plain data on the ice plane. +x is right, −z is "up" (away from the Follow Camera); a Rect's
// length runs along z, its width along x. Pure: no React, no three, no Rapier, no DOM.
import type { ExhibitId } from '../../content/types'

export type Vec2 = { x: number; z: number }
export type Vec3 = { x: number; y: number; z: number }
export type Rect = { centre: Vec2; length: number; width: number }
export type Segment = { a: Vec2; b: Vec2 }
/** A boarded playable surface; `boards` exclude the openings a Path leaves. */
export type Rink = { id: 'hub' | ExhibitId; rect: Rect; boards: Segment[] }
export type Goal = { zoneId: ExhibitId; line: Segment; sensor: Rect; posts: Rect[] }
export type Zone = Rink & {
  exhibitId: ExhibitId
  goal: Goal
  banner: { text: string }
  captionPlace: Rect
}
export type WorldLayout = {
  hub: Rink & { captionPlace: Rect; resetPoint: Vec2 }
  path: { rect: Rect; boards: Segment[] }
  zones: Zone[]
}

/** Spec dimensions in metres; the Goal numbers are the plan's start values. */
export const DIMENSIONS = {
  hub: { length: 40, width: 20 },
  path: { length: 15, width: 6 },
  zone: { length: 30, width: 20 },
  goal: { mouth: 6, depth: 2, post: 0.3 },
}

export type Dimensions = typeof DIMENSIONS

/** True when the point lies inside the rect, edges included. */
export function insideRect(rect: Rect, point: Vec2): boolean {
  return (
    Math.abs(point.x - rect.centre.x) <= rect.width / 2 &&
    Math.abs(point.z - rect.centre.z) <= rect.length / 2
  )
}

/** Distance of a Rink's blue lines from its centre, along z: a sixth of the length (the prototype's marking). */
export function blueLineOffset(rect: Rect): number {
  return rect.length / 6
}

/** The four edges of a rect as segments: far (−z), near (+z), left (−x), right (+x). */
export function rectEdges(rect: Rect): Segment[] {
  const { x, z } = rect.centre
  const hw = rect.width / 2
  const hl = rect.length / 2
  return [
    { a: { x: x - hw, z: z - hl }, b: { x: x + hw, z: z - hl } },
    { a: { x: x - hw, z: z + hl }, b: { x: x + hw, z: z + hl } },
    { a: { x: x - hw, z: z - hl }, b: { x: x - hw, z: z + hl } },
    { a: { x: x + hw, z: z - hl }, b: { x: x + hw, z: z + hl } },
  ]
}

/**
 * The Hub alone, closed on four sides, as T1 ships it: the Path rect is placed at the far end for
 * the camera and the scene to know where the World continues, without boards until T2 opens the
 * Hub towards it. T7's `layoutFromContent` derives the Zones from the Exhibits.
 */
export function hubLayout(dims: Dimensions = DIMENSIONS): WorldLayout {
  const hub: Rect = { centre: { x: 0, z: 0 }, length: dims.hub.length, width: dims.hub.width }
  const path: Rect = {
    centre: { x: 0, z: -(dims.hub.length + dims.path.length) / 2 },
    length: dims.path.length,
    width: dims.path.width,
  }
  return {
    hub: {
      id: 'hub',
      rect: hub,
      boards: rectEdges(hub),
      captionPlace: hub,
      resetPoint: { x: hub.centre.x, z: hub.centre.z },
    },
    path: { rect: path, boards: [] },
    zones: [],
  }
}
