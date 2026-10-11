import { describe, expect, it } from 'vitest'

import {
  DIMENSIONS,
  hubLayout,
  insideRect,
  PLACEHOLDER_EXHIBIT,
  type Rect,
  rectEdges,
  worldLayout,
} from './layout'

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
  const exhibit = PLACEHOLDER_EXHIBIT
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

  it('carries the Banner text through', () => {
    expect(zone?.banner).toEqual({ text: exhibit.bannerText })
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
