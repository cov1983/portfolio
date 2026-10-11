import { describe, expect, it } from 'vitest'

import { DIMENSIONS, hubLayout, insideRect, rectEdges } from './layout'

describe('DIMENSIONS', () => {
  it('holds the spec sizes of the Hub, the Path and the Zone', () => {
    expect(DIMENSIONS).toEqual({
      hub: { length: 40, width: 20 },
      path: { length: 15, width: 6 },
      zone: { length: 30, width: 20 },
      goal: { mouth: 6, depth: 2, post: 0.3 },
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
