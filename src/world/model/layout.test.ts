import { describe, expect, it } from 'vitest'

import { loadContentFromDisk } from '../../../build/content-plugin'
import { exhibitIdSchema } from '../../content/schema'
import {
  centreLinePieces,
  CENTRE_LINE_MARGIN,
  DIMENSIONS,
  hubLayout,
  insideRect,
  layoutFromContent,
  type Rect,
  rectEdges,
  worldLayout,
  type ZoneExhibit,
} from './layout'

/** A small Exhibit for the geometry: the schema produces its id, so no cast. */
const EXHIBIT: ZoneExhibit = {
  id: exhibitIdSchema.parse('exhibit-1'),
  title: 'Exhibit 1',
  hook: 'A fixture for the layout',
}

describe('DIMENSIONS', () => {
  it('holds the spec sizes of the Hub, the Path and the Zone', () => {
    expect(DIMENSIONS).toEqual({
      hub: { length: 40, width: 20 },
      path: { length: 15, width: 6 },
      zone: { length: 30, width: 20 },
      goal: { mouth: 6, depth: 2, post: 0.3, line: 4 },
    })
  })
})

describe('hubLayout', () => {
  const layout = hubLayout()

  it('centres a 40 by 20 m Hub on the origin', () => {
    expect(layout.hub.rect).toEqual({ centre: { x: 0, z: 0 }, length: 40, width: 20 })
  })

  it('closes the Hub with four boards on its edges', () => {
    expect(layout.hub.boards).toEqual(rectEdges(layout.hub.rect))
  })

  it('puts the Reset point at the centre of the Hub', () => {
    expect(layout.hub.resetPoint).toEqual({ x: 0, z: 0 })
  })

  it('uses the whole Hub as its caption place', () => {
    expect(layout.hub.captionPlace).toEqual(layout.hub.rect)
  })

  it('places the Path rect against the far end of the Hub, without boards yet', () => {
    expect(layout.path).toEqual({
      rect: { centre: { x: 0, z: -27.5 }, length: 15, width: 6 },
      boards: [],
    })
  })

  it('has no Zone before the content arrives', () => {
    expect(layout.zones).toEqual([])
  })

  it('is the World without an Exhibit', () => {
    expect(worldLayout(null)).toEqual(layout)
  })
})

describe('worldLayout', () => {
  const exhibit = EXHIBIT
  const layout = worldLayout(exhibit)
  const zone = layout.zones[0]

  function expectRectClose(actual: Rect | undefined, expected: Rect): void {
    expect(actual).toBeDefined()
    expect(actual?.centre.x).toBeCloseTo(expected.centre.x, 9)
    expect(actual?.centre.z).toBeCloseTo(expected.centre.z, 9)
    expect(actual?.width).toBeCloseTo(expected.width, 9)
    expect(actual?.length).toBeCloseTo(expected.length, 9)
  }

  it('keeps the Hub where hubLayout puts it', () => {
    expect(layout.hub.rect).toEqual(hubLayout().hub.rect)
    expect(layout.hub.resetPoint).toEqual({ x: 0, z: 0 })
    expect(layout.hub.captionPlace).toEqual(layout.hub.rect)
  })

  it('opens the far end of the Hub towards the Path: two far pieces, then near, left, right', () => {
    expect(layout.hub.boards).toEqual([
      { a: { x: -10, z: -20 }, b: { x: -3, z: -20 } },
      { a: { x: 3, z: -20 }, b: { x: 10, z: -20 } },
      { a: { x: -10, z: 20 }, b: { x: 10, z: 20 } },
      { a: { x: -10, z: -20 }, b: { x: -10, z: 20 } },
      { a: { x: 10, z: -20 }, b: { x: 10, z: 20 } },
    ])
  })

  it('boards the Path on its two sides only', () => {
    expect(layout.path).toEqual({
      rect: { centre: { x: 0, z: -27.5 }, length: 15, width: 6 },
      boards: [
        { a: { x: -3, z: -35 }, b: { x: -3, z: -20 } },
        { a: { x: 3, z: -35 }, b: { x: 3, z: -20 } },
      ],
    })
  })

  it('places one 30 by 20 m Zone against the far end of the Path', () => {
    expect(layout.zones).toHaveLength(1)
    expect(zone?.rect).toEqual({ centre: { x: 0, z: -50 }, length: 30, width: 20 })
  })

  it('opens the near end of the Zone towards the Path: far, two near pieces, left, right', () => {
    expect(zone?.boards).toEqual([
      { a: { x: -10, z: -65 }, b: { x: 10, z: -65 } },
      { a: { x: -10, z: -35 }, b: { x: -3, z: -35 } },
      { a: { x: 3, z: -35 }, b: { x: 10, z: -35 } },
      { a: { x: -10, z: -65 }, b: { x: -10, z: -35 } },
      { a: { x: 10, z: -65 }, b: { x: 10, z: -35 } },
    ])
  })

  it('names the Zone and its Goal after the Exhibit', () => {
    expect([zone?.id, zone?.exhibitId, zone?.goal.zoneId]).toEqual([
      exhibit.id,
      exhibit.id,
      exhibit.id,
    ])
  })

  it("writes the Exhibit's title and hook on the Banner, unchanged", () => {
    expect([zone?.banner.title, zone?.banner.hook]).toEqual([
      'Exhibit 1',
      'A fixture for the layout',
    ])
  })

  it('uses the whole Zone as its caption place', () => {
    expect(zone?.captionPlace).toEqual(zone?.rect)
  })

  it('draws the goal line 4 m from the end board, one mouth wide', () => {
    expect(zone?.goal.line).toEqual({ a: { x: -3, z: -61 }, b: { x: 3, z: -61 } })
  })

  it('makes the net frame of two sides from the line to the back, and the back', () => {
    const posts = zone?.goal.posts ?? []
    expect(posts).toHaveLength(3)
    expectRectClose(posts[0], { centre: { x: -3.15, z: -62 }, width: 0.3, length: 2 })
    expectRectClose(posts[1], { centre: { x: 3.15, z: -62 }, width: 0.3, length: 2 })
    expectRectClose(posts[2], { centre: { x: 0, z: -62.85 }, width: 6.6, length: 0.3 })
  })

  it('puts the sensor volume inside the net, one Puck radius behind the goal line', () => {
    expectRectClose(zone?.goal.sensor, { centre: { x: 0, z: -62.1 }, width: 6, length: 1.2 })
  })

  it('keeps the sensor inside the Zone', () => {
    const corners = rectEdges(zone?.goal.sensor ?? layout.hub.rect).flatMap((e) => [e.a, e.b])
    expect(corners.map((c) => insideRect(zone?.rect ?? layout.hub.rect, c))).not.toContain(false)
  })

  it('keeps the frame clear of the sensor', () => {
    const sensor = zone?.goal.sensor ?? layout.hub.rect
    expect(zone?.goal.posts.map((post) => insideRect(sensor, post.centre))).not.toContain(true)
  })
})

describe('layoutFromContent', () => {
  it("writes the real Exhibit's title and hook on its Zone's Banner (AC-13.2, 26.1)", async () => {
    const content = await loadContentFromDisk()
    const [exhibit] = content.exhibits
    expect(exhibit).toBeDefined()
    const banner = layoutFromContent(content).zones[0]?.banner
    expect([banner?.title, banner?.hook]).toEqual([exhibit?.title, exhibit?.hook])
  })

  it("builds the first Exhibit's Zone: one Path, one Zone (Q6 on #31)", () => {
    const second = { ...EXHIBIT, id: exhibitIdSchema.parse('exhibit-2') }
    expect(layoutFromContent({ exhibits: [EXHIBIT, second] })).toEqual(worldLayout(EXHIBIT))
  })

  it('closes the Hub when there is no Exhibit', () => {
    expect(layoutFromContent({ exhibits: [] })).toEqual(hubLayout())
  })
})

describe("The Banner on the Zone's ice (AC-13.2)", () => {
  const layout = worldLayout(EXHIBIT)
  const zone = layout.zones[0]
  if (zone === undefined) throw new Error('the one-Zone layout has no Zone')
  const { rect } = zone.banner
  const corners = rectEdges(rect).flatMap((edge) => [edge.a, edge.b])

  it("lies 14 m wide and 6 m deep on the Zone's centre", () => {
    expect(rect).toEqual({ centre: zone.rect.centre, width: 14, length: 6 })
  })

  it('lies inside the Zone', () => {
    expect(corners.map((corner) => insideRect(zone.rect, corner))).not.toContain(false)
  })

  it('ends at least 2 m before the goal line', () => {
    const farEdge = rect.centre.z - rect.length / 2
    expect(farEdge - zone.goal.line.a.z).toBeGreaterThanOrEqual(2)
  })

  it("overlaps none of the net's posts", () => {
    const overlaps = (a: Rect, b: Rect) =>
      Math.abs(a.centre.x - b.centre.x) < (a.width + b.width) / 2 &&
      Math.abs(a.centre.z - b.centre.z) < (a.length + b.length) / 2
    expect(zone.goal.posts.map((post) => overlaps(post, rect))).not.toContain(true)
  })

  it('points its text up away from the Hub, so it reads upright from the Hub side', () => {
    const towardsZone = {
      x: zone.rect.centre.x - layout.hub.resetPoint.x,
      z: zone.rect.centre.z - layout.hub.resetPoint.z,
    }
    const { up } = zone.banner
    expect(up.x * towardsZone.x + up.z * towardsZone.z).toBeGreaterThan(0)
  })
})

describe('centreLinePieces', () => {
  const zone = worldLayout(EXHIBIT).zones[0]
  if (zone === undefined) throw new Error('the one-Zone layout has no Zone')
  const banner = zone.banner.rect
  const pieces = centreLinePieces(zone.rect, banner)

  it("leaves the margin clear on each side of the Banner, along the Zone's centre", () => {
    const gapLeft = banner.centre.x - banner.width / 2 - CENTRE_LINE_MARGIN
    const gapRight = banner.centre.x + banner.width / 2 + CENTRE_LINE_MARGIN
    expect(pieces).toEqual([
      { a: { x: -10, z: -50 }, b: { x: gapLeft, z: -50 } },
      { a: { x: gapRight, z: -50 }, b: { x: 10, z: -50 } },
    ])
  })

  it("spans the Zone's width with the gap", () => {
    const [left, right] = pieces
    const covered = left.b.x - left.a.x + (right.b.x - right.a.x)
    const gap = banner.width + 2 * CENTRE_LINE_MARGIN
    expect(covered + gap).toBeCloseTo(zone.rect.width, 9)
  })
})

describe('rectEdges', () => {
  it('returns far, near, left and right edges of a rect', () => {
    expect(rectEdges({ centre: { x: 1, z: 2 }, length: 4, width: 2 })).toEqual([
      { a: { x: 0, z: 0 }, b: { x: 2, z: 0 } },
      { a: { x: 0, z: 4 }, b: { x: 2, z: 4 } },
      { a: { x: 0, z: 0 }, b: { x: 0, z: 4 } },
      { a: { x: 2, z: 0 }, b: { x: 2, z: 4 } },
    ])
  })
})

describe('insideRect', () => {
  const rect = { centre: { x: 0, z: 0 }, length: 40, width: 20 }

  it('accepts a point on the edge', () => {
    expect(insideRect(rect, { x: 10, z: -20 })).toBe(true)
  })

  it('rejects a point past the width', () => {
    expect(insideRect(rect, { x: 10.01, z: 0 })).toBe(false)
  })

  it('rejects a point past the length', () => {
    expect(insideRect(rect, { x: 0, z: 20.01 })).toBe(false)
  })
})
