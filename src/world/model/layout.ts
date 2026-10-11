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
/**
 * The Goal: `line` is the goal line between the posts, `sensor` the volume inside the net behind
 * it (the Puck's position inside it is a goal), `posts` the net's solid frame: the two sides from
 * the goal line to the back, and the back (spec: "posts and net outside are solid").
 */
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

/**
 * Spec dimensions in metres; the Goal numbers are the plan's start values: the mouth between the
 * posts, the net's depth behind the goal line, the frame's thickness, and the goal line's distance
 * from the Zone's end board (Owner decision on #25, Q1).
 */
export const DIMENSIONS = {
  hub: { length: 40, width: 20 },
  path: { length: 15, width: 6 },
  zone: { length: 30, width: 20 },
  goal: { mouth: 6, depth: 2, post: 0.3, line: 4 },
}

export type Dimensions = typeof DIMENSIONS

/** The Puck's body, shared by the model (its collider), the scene (its mesh) and the Goal rule. Metres. */
export const PUCK = { radius: 0.5, height: 0.2 }

/** What the layout needs of an Exhibit: T7's `layoutFromContent` derives it from the content. */
export type ZoneExhibit = { id: ExhibitId; bannerText: string }

/**
 * The one Zone's Exhibit until the content exists: only T3's schema produces an ExhibitId, so this
 * is the single cast in the code base; T7 replaces it with `layoutFromContent` and deletes it.
 */
export const PLACEHOLDER_EXHIBIT: ZoneExhibit = {
  id: 'exhibit-1' as ExhibitId,
  bannerText: 'Exhibit 1 — placeholder',
}

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
export function rectEdges(rect: Rect): [Segment, Segment, Segment, Segment] {
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

/** An edge along x split around an opening of `width` centred on it: the piece on each side. */
function withOpening(edge: Segment, width: number): Segment[] {
  const middle = (edge.a.x + edge.b.x) / 2
  return [
    { a: edge.a, b: { x: middle - width / 2, z: edge.a.z } },
    { a: { x: middle + width / 2, z: edge.b.z }, b: edge.b },
  ]
}

/**
 * The Goal at the far end of a Zone: goal line, the net's solid frame and the sensor inside it.
 * The sensor starts one Puck radius behind the goal line, so the Puck's centre is inside it only
 * once the whole Puck has crossed the line (Owner decision on #42), and ends at the net's back.
 */
function goalOf(zoneId: ExhibitId, zone: Rect, dims: Dimensions): Goal {
  const { mouth, depth, post, line } = dims.goal
  const cx = zone.centre.x
  const lineZ = zone.centre.z - zone.length / 2 + line
  const half = mouth / 2
  const sensorLength = depth - post - PUCK.radius
  return {
    zoneId,
    line: { a: { x: cx - half, z: lineZ }, b: { x: cx + half, z: lineZ } },
    sensor: {
      centre: { x: cx, z: lineZ - PUCK.radius - sensorLength / 2 },
      width: mouth,
      length: sensorLength,
    },
    posts: [
      { centre: { x: cx - half - post / 2, z: lineZ - depth / 2 }, width: post, length: depth },
      { centre: { x: cx + half + post / 2, z: lineZ - depth / 2 }, width: post, length: depth },
      { centre: { x: cx, z: lineZ - depth + post / 2 }, width: mouth + 2 * post, length: post },
    ],
  }
}

/**
 * The World: the Hub, the Path leaving its far end and, with an Exhibit, one Zone at the end of the
 * Path, all one continuous ice (the openings are left out of the boards). Without an Exhibit the
 * Hub is closed and the Path rect is only placed, as T1 shipped it. T7's `layoutFromContent`
 * derives the Exhibit from the content; until then the caller passes a placeholder.
 */
export function worldLayout(
  exhibit: ZoneExhibit | null,
  dims: Dimensions = DIMENSIONS,
): WorldLayout {
  const hub: Rect = { centre: { x: 0, z: 0 }, length: dims.hub.length, width: dims.hub.width }
  const path: Rect = {
    centre: { x: 0, z: -(dims.hub.length + dims.path.length) / 2 },
    length: dims.path.length,
    width: dims.path.width,
  }
  const [hubFar, hubNear, hubLeft, hubRight] = rectEdges(hub)
  const closed: WorldLayout = {
    hub: {
      id: 'hub',
      rect: hub,
      boards: [hubFar, hubNear, hubLeft, hubRight],
      captionPlace: hub,
      resetPoint: { x: hub.centre.x, z: hub.centre.z },
    },
    path: { rect: path, boards: [] },
    zones: [],
  }
  if (exhibit === null) return closed

  const zone: Rect = {
    centre: { x: 0, z: path.centre.z - (dims.path.length + dims.zone.length) / 2 },
    length: dims.zone.length,
    width: dims.zone.width,
  }
  const [, , pathLeft, pathRight] = rectEdges(path)
  const [zoneFar, zoneNear, zoneLeft, zoneRight] = rectEdges(zone)
  return {
    hub: {
      ...closed.hub,
      boards: [...withOpening(hubFar, path.width), hubNear, hubLeft, hubRight],
    },
    path: { rect: path, boards: [pathLeft, pathRight] },
    zones: [
      {
        id: exhibit.id,
        exhibitId: exhibit.id,
        rect: zone,
        boards: [zoneFar, ...withOpening(zoneNear, path.width), zoneLeft, zoneRight],
        goal: goalOf(exhibit.id, zone, dims),
        banner: { text: exhibit.bannerText },
        captionPlace: zone,
      },
    ],
  }
}

/** The Hub alone, closed on four sides: ADR 0005's reference Rink for the feel tests. */
export function hubLayout(dims: Dimensions = DIMENSIONS): WorldLayout {
  return worldLayout(null, dims)
}
